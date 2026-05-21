/**
 * Daily entry router — mobile app submits production reports here.
 */
import { z } from 'zod';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import {
  dailyEntry, entryActivity, entryEquipmentUtil, entryPhoto, project,
} from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { audit } from '../lib/audit.js';

export const entryRouter = router({
  list: orgProcedure
    .input(z.object({
      projectId: z.string().uuid().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const conds = [eq(project.organizationId, ctx.session.organizationId)];
      if (input.projectId) conds.push(eq(dailyEntry.projectId, input.projectId));
      if (input.from) conds.push(gte(dailyEntry.entryDate, input.from));
      if (input.to) conds.push(lte(dailyEntry.entryDate, input.to));
      const rows = await ctx.db
        .select({ entry: dailyEntry, projectCode: project.code, projectName: project.name })
        .from(dailyEntry)
        .innerJoin(project, eq(dailyEntry.projectId, project.id))
        .where(and(...conds))
        .orderBy(desc(dailyEntry.entryDate))
        .limit(input.limit);
      return rows;
    }),

  detail: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select({ entry: dailyEntry })
        .from(dailyEntry)
        .innerJoin(project, eq(dailyEntry.projectId, project.id))
        .where(and(eq(dailyEntry.id, input.id), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!entry) throw new TRPCError({ code: 'NOT_FOUND' });
      const [activities, equipment, photos] = await Promise.all([
        ctx.db.select().from(entryActivity).where(eq(entryActivity.dailyEntryId, input.id)),
        ctx.db.select().from(entryEquipmentUtil).where(eq(entryEquipmentUtil.dailyEntryId, input.id)),
        ctx.db.select().from(entryPhoto).where(eq(entryPhoto.dailyEntryId, input.id)),
      ]);
      return { ...entry.entry, activities, equipment, photos };
    }),

  submit: requireRole('owner', 'admin', 'supervisor', 'estimator', 'scheduler')
    .input(z.object({
      projectId: z.string().uuid(),
      entryDate: z.string(),
      shift: z.enum(['day', 'night', 'all']).default('day'),
      weather: z.enum(['clear', 'cloudy', 'rain_light', 'rain_heavy', 'storm']).optional(),
      effectiveHours: z.number().optional(),
      workforce: z.number().int().optional(),
      notes: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      appVersion: z.string().optional(),
      activities: z.array(z.object({
        ahspItemId: z.string().uuid().optional(),
        description: z.string().min(1),
        quantity: z.number().nonnegative(),
        satuan: z.string().optional(),
        station: z.string().optional(),
      })).default([]),
      equipment: z.array(z.object({
        unitId: z.string().uuid().optional(),
        hmStart: z.number().optional(),
        hmEnd: z.number().optional(),
        hmWork: z.number().optional(),
        hmIdle: z.number().optional(),
        hmBreakdown: z.number().optional(),
        fuelLiters: z.number().optional(),
        odometerKm: z.number().optional(),
        trips: z.number().int().optional(),
        status: z.string().optional(),
        note: z.string().optional(),
      })).default([]),
      photoKeys: z.array(z.object({
        storageKey: z.string(),
        caption: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        sizeBytes: z.number().optional(),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      // Geofence validation (if configured)
      let geofenceWarning: string | null = null;
      if (proj.siteLat && proj.siteLng && proj.geofenceRadiusM && input.lat !== undefined && input.lng !== undefined) {
        const lat1 = Number(proj.siteLat), lng1 = Number(proj.siteLng);
        const R = 6371000;
        const dLat = (input.lat - lat1) * Math.PI / 180;
        const dLng = (input.lng - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(input.lat*Math.PI/180) * Math.sin(dLng/2)**2;
        const distM = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (distM > Number(proj.geofenceRadiusM)) {
          geofenceWarning = `Submitted ${Math.round(distM)}m from site (radius ${proj.geofenceRadiusM}m)`;
        }
      }

      const [entry] = await ctx.db.insert(dailyEntry).values({
        projectId: input.projectId,
        entryDate: input.entryDate,
        shift: input.shift,
        weather: input.weather,
        effectiveHours: input.effectiveHours !== undefined ? String(input.effectiveHours) : null,
        workforce: input.workforce ?? null,
        notes: input.notes,
        submittedAtLat: input.lat !== undefined ? String(input.lat) : null,
        submittedAtLng: input.lng !== undefined ? String(input.lng) : null,
        appVersion: input.appVersion,
        submittedById: ctx.session.user.id,
      }).returning();
      if (!entry) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      if (input.activities.length > 0) {
        await ctx.db.insert(entryActivity).values(input.activities.map(a => ({
          dailyEntryId: entry.id,
          ahspItemId: a.ahspItemId,
          description: a.description,
          quantity: String(a.quantity),
          satuan: a.satuan,
          station: a.station,
        })));
      }
      if (input.equipment.length > 0) {
        await ctx.db.insert(entryEquipmentUtil).values(input.equipment.map(e => ({
          dailyEntryId: entry.id,
          unitId: e.unitId,
          hmStart: e.hmStart !== undefined ? String(e.hmStart) : null,
          hmEnd: e.hmEnd !== undefined ? String(e.hmEnd) : null,
          hmWork: e.hmWork !== undefined ? String(e.hmWork) : null,
          hmIdle: e.hmIdle !== undefined ? String(e.hmIdle) : null,
          hmBreakdown: e.hmBreakdown !== undefined ? String(e.hmBreakdown) : null,
          fuelLiters: e.fuelLiters !== undefined ? String(e.fuelLiters) : null,
          odometerKm: e.odometerKm !== undefined ? String(e.odometerKm) : null,
          trips: e.trips,
          status: e.status,
          note: e.note,
        })));
      }
      if (input.photoKeys.length > 0) {
        await ctx.db.insert(entryPhoto).values(input.photoKeys.map(p => ({
          dailyEntryId: entry.id,
          storageKey: p.storageKey,
          caption: p.caption,
          lat: p.lat !== undefined ? String(p.lat) : null,
          lng: p.lng !== undefined ? String(p.lng) : null,
          width: p.width, height: p.height, sizeBytes: p.sizeBytes,
        })));
      }

      await audit(ctx, { action: 'entry.submit', resource: 'daily_entry', resourceId: entry.id, after: { date: input.entryDate, shift: input.shift, activities: input.activities.length, geofenceWarning } });
      return { id: entry.id, ok: true, geofenceWarning };
    }),
});
