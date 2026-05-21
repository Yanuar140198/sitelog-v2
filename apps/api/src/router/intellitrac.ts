/**
 * IntelliTrac GPS adapter — fetch HM / odometer / position per unit per date.
 *
 * Auth: login → session cookie used for subsequent calls.
 * V1: simple proxy reads from upstream. V2: scheduled sync into entryEquipmentUtil rows.
 */
import { z } from 'zod';
import { router, orgProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

const BASE = process.env.INTELLITRAC_BASE ?? 'https://i-app2.intellitrac.com.au';

let cachedCookie: { value: string; expiresAt: number } | null = null;

async function login(): Promise<string> {
  if (cachedCookie && cachedCookie.expiresAt > Date.now()) return cachedCookie.value;
  const user = process.env.INTELLITRAC_USER;
  const pass = process.env.INTELLITRAC_PASS;
  if (!user || !pass) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'IntelliTrac creds not configured' });

  const body = new URLSearchParams({ username: user, password: pass }).toString();
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  if (!setCookie) throw new TRPCError({ code: 'BAD_GATEWAY', message: 'IntelliTrac login: no cookie' });
  cachedCookie = { value: setCookie.split(';')[0]!, expiresAt: Date.now() + 30 * 60 * 1000 };
  return cachedCookie.value;
}

export const intellitracRouter = router({
  hmForUnit: orgProcedure
    .input(z.object({ unit: z.string(), date: z.string() }))
    .query(async ({ input }) => {
      const cookie = await login();
      const url = `${BASE}/api/reports/common_summary?unit=${encodeURIComponent(input.unit)}&date=${input.date}`;
      const res = await fetch(url, { headers: { cookie } });
      if (!res.ok) throw new TRPCError({ code: 'BAD_GATEWAY', message: `IntelliTrac: ${res.status}` });
      const data = await res.json();
      return { unit: input.unit, date: input.date, raw: data };
    }),

  /** Scheduled sync — pulls HM for assigned units, upserts dailyEntry+equipment. */
  syncProject: orgProcedure
    .input(z.object({ projectId: z.string().uuid(), date: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { unit, projectFleetAssignment, dailyEntry, entryEquipmentUtil } = await import('@sitelog/db');
      const { eq, and, isNull } = await import('drizzle-orm');
      const assigned = await ctx.db.select({ u: unit })
        .from(projectFleetAssignment)
        .innerJoin(unit, eq(projectFleetAssignment.unitId, unit.id))
        .where(and(
          eq(projectFleetAssignment.projectId, input.projectId),
          isNull(projectFleetAssignment.unassignedAt),
        ));
      let synced = 0, failed = 0;
      for (const { u } of assigned) {
        if (!u.externalTrackingId || u.trackingProvider !== 'intellitrac') continue;
        try {
          const cookie = await login();
          const url = `${BASE}/api/reports/common_summary?unit=${encodeURIComponent(u.externalTrackingId)}&date=${input.date}`;
          const res = await fetch(url, { headers: { cookie } });
          if (!res.ok) { failed++; continue; }
          const raw = await res.json() as any;
          const [existing] = await ctx.db.select().from(dailyEntry)
            .where(and(eq(dailyEntry.projectId, input.projectId), eq(dailyEntry.entryDate, input.date))).limit(1);
          let entryId = existing?.id;
          if (!entryId) {
            const [created] = await ctx.db.insert(dailyEntry).values({
              projectId: input.projectId, entryDate: input.date, shift: 'day',
              submittedById: ctx.session.user.id, notes: '[auto] IntelliTrac sync',
            }).returning();
            entryId = created!.id;
          }
          await ctx.db.insert(entryEquipmentUtil).values({
            dailyEntryId: entryId!, unitId: u.id,
            hmWork: raw.hm_work ? String(raw.hm_work) : null,
            odometerKm: raw.odometer_km ? String(raw.odometer_km) : null,
            status: 'auto-tracked', note: 'IntelliTrac sync',
          });
          synced++;
        } catch { failed++; }
      }
      return { synced, failed, totalAssigned: assigned.length };
    }),
});
