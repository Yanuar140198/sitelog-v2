/**
 * Background photo tagger — finds unanalyzed entryPhoto rows, calls Claude vision, stores metadata.
 *
 * Run via cron every 5-15 min. Processes batch of 10 at a time to respect rate limits.
 */
import { db, entryPhoto } from '@sitelog/db';
import { isNull, and, sql } from 'drizzle-orm';

interface Analyzed { caption: string; tags: string[]; progressEstimate: number | null }

async function analyze(imageUrl: string): Promise<Analyzed | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: 'You analyze construction site photos. Return JSON: {caption, tags[], progressEstimate (0-100 or null)}. Bahasa Indonesia.',
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: 'Analyze photo. Return JSON only.' },
      ] }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as any;
  const text = data.content?.[0]?.text ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function processUntaggedPhotos(limit = 10): Promise<{ analyzed: number; failed: number; skipped: number }> {
  const rows = await db.select().from(entryPhoto)
    .where(and(isNull(entryPhoto.aiAnalyzedAt), sql`${entryPhoto.url} IS NOT NULL`))
    .limit(limit);
  let analyzed = 0, failed = 0, skipped = 0;
  for (const p of rows) {
    if (!p.url) { skipped++; continue; }
    try {
      const result = await analyze(p.url);
      if (!result) { failed++; continue; }
      await db.update(entryPhoto).set({
        aiCaption: result.caption,
        aiTags: JSON.stringify(result.tags ?? []),
        aiProgressPct: result.progressEstimate !== null ? String(result.progressEstimate) : null,
        aiAnalyzedAt: new Date(),
      }).where(sql`${entryPhoto.id} = ${p.id}`);
      analyzed++;
    } catch { failed++; }
  }
  return { analyzed, failed, skipped };
}
