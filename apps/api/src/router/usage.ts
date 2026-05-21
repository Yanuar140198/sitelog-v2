import { router, orgProcedure } from '../trpc.js';
import { aggregateMonth } from '../lib/usage.js';
import { getOrgPlanLimits } from '../lib/plan-limits.js';

export const usageRouter = router({
  current: orgProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.organizationId;
    const [aiCalls, photosMB, apiCalls, entries] = await Promise.all([
      aggregateMonth(orgId, 'ai_calls'),
      aggregateMonth(orgId, 'photos_uploaded_mb'),
      aggregateMonth(orgId, 'api_calls'),
      aggregateMonth(orgId, 'entries_submitted'),
    ]);
    const limits = await getOrgPlanLimits(orgId);
    return {
      period: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
      metrics: { aiCalls, photosMB, apiCalls, entries },
      limits,
      pct: {
        aiCalls: limits.aiCallsPerMonth > 0 ? Math.round((aiCalls / limits.aiCallsPerMonth) * 100) : 0,
        storage: limits.storageGb > 0 ? Math.round((photosMB / (limits.storageGb * 1024)) * 100) : 0,
      },
    };
  }),
});
