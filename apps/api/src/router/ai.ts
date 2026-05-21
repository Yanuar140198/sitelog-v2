/**
 * AI assistant — Claude API for BOQ estimation help, report drafting, photo analysis.
 *
 * Requires ANTHROPIC_API_KEY env var.
 * V1: chat-style ask endpoint. V2: structured tools (generate BOQ scaffolding, suggest unit rates).
 */
import { z } from 'zod';
import { router, orgProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { rateLimitMiddleware } from '../lib/rate-limit.js';

const SYSTEM_PROMPT = `You are Sitelog AI, an assistant for Indonesian construction estimators using AHSP Bina Marga rates.
You help with: drafting BOQ scopes, suggesting unit rates, explaining cost breakdowns, and writing daily report summaries.
Answer in Bahasa Indonesia. Be concise and reference AHSP codes when relevant.`;

// Rate-limit AI calls aggressively: 20/min per user. (Plan quota separately enforced.)
const aiRateLimited = orgProcedure.use(rateLimitMiddleware({ limit: 20, windowMs: 60_000, scope: 'user' }));

export const aiRouter = router({
  ask: aiRateLimited
    .input(z.object({
      message: z.string().min(1).max(4000),
      context: z.object({
        projectId: z.string().uuid().optional(),
        ahspKode: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'ANTHROPIC_API_KEY not configured' });

      let contextNote = '';
      if (input.context?.projectId) contextNote += `\nCurrent project: ${input.context.projectId}`;
      if (input.context?.ahspKode) contextNote += `\nCurrent AHSP code: ${input.context.ahspKode}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT + contextNote,
          messages: [{ role: 'user', content: input.message }],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Claude API: ${res.status} ${txt.slice(0, 200)}` });
      }
      const data = await res.json() as any;
      const reply = data.content?.[0]?.text ?? '';
      try {
        const { recordUsage } = await import('../lib/usage.js');
        await recordUsage(ctx.session.organizationId, 'ai_calls', 1);
      } catch {}
      return { reply, model: data.model, usage: data.usage };
    }),

  rateSanity: aiRateLimited
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { boqItem, ahspItem, ahspResource } = await import('@sitelog/db');
      const { eq } = await import('drizzle-orm');
      const rows = await ctx.db.select({
        boq: boqItem, kode: ahspItem.kode, jenis: ahspItem.jenis, satuan: ahspItem.satuan,
      }).from(boqItem)
        .innerJoin(ahspItem, eq(boqItem.ahspItemId, ahspItem.id))
        .where(eq(boqItem.projectId, input.projectId));
      const flags: Array<{ kode: string; jenis: string; rate: number; baseline: number; deviationPct: number; severity: 'info'|'warning'|'error'; note: string }> = [];
      for (const r of rows) {
        if (!r.boq.unitRateOverride) continue;
        const rate = Number(r.boq.unitRateOverride);
        const baselineRows = await ctx.db.select({ koef: ahspResource.koefisien, hsd: ahspResource.hsd })
          .from(ahspResource).where(eq(ahspResource.ahspItemId, r.boq.ahspItemId));
        const baseline = baselineRows.reduce((a, l) => a + Number(l.koef) * Number(l.hsd), 0);
        if (baseline <= 0) continue;
        const dev = ((rate - baseline) / baseline) * 100;
        const absDev = Math.abs(dev);
        if (absDev < 10) continue;
        const severity: 'info'|'warning'|'error' = absDev > 50 ? 'error' : absDev > 25 ? 'warning' : 'info';
        flags.push({
          kode: r.kode, jenis: r.jenis, rate, baseline,
          deviationPct: Math.round(dev * 10) / 10, severity,
          note: dev > 0 ? `Rate ${absDev.toFixed(1)}% above baseline` : `Rate ${absDev.toFixed(1)}% below baseline`,
        });
      }
      return { flags, totalChecked: rows.length, flagged: flags.length };
    }),

  analyzePhoto: aiRateLimited
    .input(z.object({
      imageUrl: z.string().url(),
      context: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return { caption: 'Set ANTHROPIC_API_KEY for AI photo analysis', detectedEquipment: [], progressEstimate: null, tags: [] };
      }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: 'You analyze construction site photos. Return JSON: {caption, detectedEquipment[], progressEstimate (0-100 or null), tags[]}. Bahasa Indonesia.',
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: input.imageUrl } },
              { type: 'text', text: `Analyze this site photo. ${input.context ?? ''} Return JSON.` },
            ],
          }],
        }),
      });
      if (!res.ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Claude: ${res.status}` });
      const data = await res.json() as any;
      const text = data.content?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let parsed: any = { caption: text };
      if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch {} }
      try {
        const { recordUsage } = await import('../lib/usage.js');
        await recordUsage(ctx.session.organizationId, 'ai_calls', 1);
      } catch {}
      return {
        caption: parsed.caption ?? '',
        detectedEquipment: parsed.detectedEquipment ?? [],
        progressEstimate: parsed.progressEstimate ?? null,
        tags: parsed.tags ?? [],
      };
    }),

  suggestBoq: aiRateLimited
    .input(z.object({
      projectType: z.string(),
      planVolumes: z.object({
        cutSoil: z.number().optional(),
        cutRock: z.number().optional(),
        fill: z.number().optional(),
        landClearing: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) {
        return {
          suggestions: [
            { ahspKode: 'CL-LC-001', defaultQty: input.planVolumes?.landClearing ?? 0, reason: 'Land clearing area awal' },
            { ahspKode: 'CH-SDT-003', defaultQty: input.planVolumes?.cutSoil ?? 0, reason: 'Cut hard soil Excavator + DT' },
            { ahspKode: 'FL-SDT-001', defaultQty: input.planVolumes?.fill ?? 0, reason: 'Fill timbunan' },
          ],
          rationale: 'Stub — set ANTHROPIC_API_KEY for AI suggestions.',
        };
      }
      const prompt = `BOQ scope untuk project "${input.projectType}". Volume plan: ${JSON.stringify(input.planVolumes ?? {})}. Return JSON array: [{ahspKode, defaultQty, reason}]. Pakai kode AHSP Bina Marga.`;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Claude: ${res.status}` });
      const data = await res.json() as any;
      const text = data.content?.[0]?.text ?? '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      let suggestions: any[] = [];
      if (jsonMatch) { try { suggestions = JSON.parse(jsonMatch[0]); } catch {} }
      try {
        const { recordUsage } = await import('../lib/usage.js');
        await recordUsage(ctx.session.organizationId, 'ai_calls', 1);
      } catch {}
      return { suggestions, rationale: text };
    }),
});
