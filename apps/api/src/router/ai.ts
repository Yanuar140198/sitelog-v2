/**
 * AI assistant router — Claude-powered helpers, BYO key per org.
 *   - status:           is an Anthropic key configured for this org?
 *   - setApiKey/clear:  owner/admin manage the org's own Anthropic key (encrypted at rest)
 *   - draftDailyReport: narrative daily report from a daily entry's data
 *   - explainRate:      plain-language explanation of an AHSP unit rate
 *
 * Each org supplies its own Anthropic API key (sealed via AES-256-GCM). A
 * server-level ANTHROPIC_API_KEY is used only as a fallback (self-hosting).
 * All data is org-scoped before being sent to Claude.
 */
import { z } from 'zod';
import { and, eq, or, isNull, asc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import {
  dailyEntry, entryActivity, entryEquipmentUtil, unit, project,
  ahspItem, ahspResource, orgSecret,
} from '@sitelog/db';
import { runClaude, ENV_ANTHROPIC_KEY } from '../lib/anthropic.js';
import { seal, open } from '../lib/secret-box.js';
import { computeAhspRate, type AhspCategory } from '../lib/ahsp-rate.js';
import {
  DAILY_REPORT_SYSTEM, buildDailyReportUser,
  EXPLAIN_RATE_SYSTEM, buildExplainRateUser, type ExplainRateRow,
  SUGGEST_SCOPES_SYSTEM, buildSuggestScopesUser,
} from '../lib/ai-prompts.js';

const N = (v: unknown) => Number(v ?? 0);
const PROVIDER = 'anthropic';

async function getOrgSecret(ctx: any) {
  const [sec] = await ctx.db.select().from(orgSecret)
    .where(and(eq(orgSecret.organizationId, ctx.session.organizationId), eq(orgSecret.provider, PROVIDER)))
    .limit(1);
  return sec ?? null;
}

/** Resolve the API key to use: the org's own key, else the server fallback. */
async function resolveKey(ctx: any): Promise<string | null> {
  const sec = await getOrgSecret(ctx);
  if (sec) {
    try { return open({ ciphertext: sec.ciphertext, iv: sec.iv, authTag: sec.authTag }); }
    catch { return null; }
  }
  return ENV_ANTHROPIC_KEY;
}

async function keyOrThrow(ctx: any): Promise<string> {
  const key = await resolveKey(ctx);
  if (!key) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'AI belum dikonfigurasi. Masukkan Anthropic API key organisasi Anda di halaman AI Assistant.',
    });
  }
  return key;
}

export const aiRouter = router({
  status: orgProcedure.query(async ({ ctx }) => {
    const sec = await getOrgSecret(ctx);
    if (sec) return { configured: true, source: 'org' as const, hint: sec.hint ?? null };
    if (ENV_ANTHROPIC_KEY) return { configured: true, source: 'server' as const, hint: null };
    return { configured: false, source: 'none' as const, hint: null };
  }),

  setApiKey: requireRole('owner', 'admin')
    .input(z.object({ key: z.string().min(20).max(300) }))
    .mutation(async ({ ctx, input }) => {
      const key = input.key.trim();
      if (!key.startsWith('sk-ant-')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Format key tidak valid (harus diawali "sk-ant-").' });
      }
      const sealed = seal(key);
      const hint = `…${key.slice(-4)}`;
      await ctx.db.insert(orgSecret).values({
        organizationId: ctx.session.organizationId,
        provider: PROVIDER,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        hint,
        createdById: ctx.session.user.id,
      }).onConflictDoUpdate({
        target: [orgSecret.organizationId, orgSecret.provider],
        set: { ciphertext: sealed.ciphertext, iv: sealed.iv, authTag: sealed.authTag, hint, updatedAt: new Date() },
      });
      return { configured: true, hint };
    }),

  clearApiKey: requireRole('owner', 'admin').mutation(async ({ ctx }) => {
    await ctx.db.delete(orgSecret)
      .where(and(eq(orgSecret.organizationId, ctx.session.organizationId), eq(orgSecret.provider, PROVIDER)));
    return { configured: false };
  }),

  draftDailyReport: orgProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await keyOrThrow(ctx);
      // Org-scope the entry via its project.
      const [row] = await ctx.db
        .select({ entry: dailyEntry, projectName: project.name })
        .from(dailyEntry)
        .innerJoin(project, eq(dailyEntry.projectId, project.id))
        .where(and(eq(dailyEntry.id, input.entryId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const [activities, equipRows] = await Promise.all([
        ctx.db.select().from(entryActivity).where(eq(entryActivity.dailyEntryId, input.entryId)),
        ctx.db
          .select({ e: entryEquipmentUtil, nomor: unit.nomor, jenis: unit.jenisAlat })
          .from(entryEquipmentUtil)
          .leftJoin(unit, eq(entryEquipmentUtil.unitId, unit.id))
          .where(eq(entryEquipmentUtil.dailyEntryId, input.entryId)),
      ]);

      const e = row.entry;
      const user = buildDailyReportUser({
        projectName: row.projectName,
        entryDate: e.entryDate,
        shift: e.shift,
        weather: e.weather,
        effectiveHours: e.effectiveHours,
        workforce: e.workforce,
        notes: e.notes,
        activities: activities.map((a) => ({
          description: a.description, quantity: a.quantity, satuan: a.satuan, station: a.station,
        })),
        equipment: equipRows.map((r) => ({
          unitLabel: r.nomor ? `${r.nomor}${r.jenis ? ` (${r.jenis})` : ''}` : null,
          hmWork: r.e.hmWork, hmIdle: r.e.hmIdle, hmBreakdown: r.e.hmBreakdown,
          fuelLiters: r.e.fuelLiters, trips: r.e.trips, status: r.e.status,
        })),
      });

      return runClaude(apiKey, DAILY_REPORT_SYSTEM, user);
    }),

  explainRate: orgProcedure
    .input(z.object({ ahspItemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await keyOrThrow(ctx);
      // Readable if org-owned OR a global catalog item (organizationId null).
      const [item] = await ctx.db.select().from(ahspItem)
        .where(eq(ahspItem.id, input.ahspItemId)).limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      if (item.organizationId && item.organizationId !== ctx.session.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const resources = await ctx.db.select().from(ahspResource)
        .where(eq(ahspResource.ahspItemId, item.id));

      const cat = (c: string) => resources
        .filter((r) => r.category === c)
        .map((r): ExplainRateRow => ({
          uraian: r.uraian,
          koefisien: N(r.koefisien),
          hsd: N(r.hsd),
          subtotal: N(r.koefisien) * N(r.hsd),
        }));
      const sub = (rows: ExplainRateRow[]) => rows.reduce((s, r) => s + N(r.subtotal), 0);
      const tenaga = cat('tenaga'), bahan = cat('bahan'), peralatan = cat('peralatan');

      const totals = computeAhspRate(
        resources.map((r) => ({ category: r.category as AhspCategory, koefisien: N(r.koefisien), hsd: N(r.hsd) })),
        N(item.ohpPct),
      );

      const user = buildExplainRateUser({
        kode: item.kode,
        jenis: item.jenis,
        satuan: item.satuan,
        ohpPct: N(item.ohpPct),
        sections: {
          tenaga: { rows: tenaga, total: sub(tenaga) },
          bahan: { rows: bahan, total: sub(bahan) },
          peralatan: { rows: peralatan, total: sub(peralatan) },
        },
        totals: { abcSubtotal: totals.jumlahABC, ohpAmount: totals.ohpAmt, unitRate: totals.unitRate },
      });

      return runClaude(apiKey, EXPLAIN_RATE_SYSTEM, user, 1500);
    }),

  suggestScopes: orgProcedure
    .input(z.object({ description: z.string().min(10).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await keyOrThrow(ctx);
      // Ground the suggestion in AHSP codes this org can actually use
      // (org-owned items + the shared global catalog). Capped to keep the prompt bounded.
      const catalog = await ctx.db
        .select({ kode: ahspItem.kode, jenis: ahspItem.jenis })
        .from(ahspItem)
        .where(or(eq(ahspItem.organizationId, ctx.session.organizationId), isNull(ahspItem.organizationId)))
        .orderBy(asc(ahspItem.kode))
        .limit(200);

      const user = buildSuggestScopesUser({
        description: input.description,
        catalog: catalog.map((c) => ({ kode: c.kode, jenis: c.jenis })),
      });

      return runClaude(apiKey, SUGGEST_SCOPES_SYSTEM, user, 2000);
    }),
});
