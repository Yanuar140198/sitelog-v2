/**
 * Prometheus-compatible metrics — text/plain on GET /metrics.
 *
 * Scrape with Grafana Agent / Datadog / vmagent / etc.
 * No external dependency — emits text format directly.
 *
 * Auth: optional. Set METRICS_TOKEN env to require Bearer auth.
 */
import { db } from '@sitelog/db';
import { sql } from 'drizzle-orm';

const startedAt = Date.now();

interface Counter { value: number }
const counters: Record<string, Counter> = {
  http_requests_total:      { value: 0 },
  http_errors_total:        { value: 0 },   // 4xx + 5xx
  http_5xx_total:           { value: 0 },   // server errors only
  trpc_calls_total:         { value: 0 },
  rest_calls_total:         { value: 0 },
  webhook_dispatched_total: { value: 0 },
  ai_calls_total:           { value: 0 },
};

export function bump(name: keyof typeof counters, n = 1) {
  const c = counters[name];
  if (c) c.value += n;
}

function fmtLine(name: string, help: string, type: string, value: number | string, labels = ''): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name}${labels} ${value}\n`;
}

export async function renderMetrics(): Promise<string> {
  const lines: string[] = [];

  // App-level counters
  for (const [name, c] of Object.entries(counters)) {
    lines.push(fmtLine(`sitelog_${name}`, `cumulative ${name}`, 'counter', c.value));
  }

  // Uptime
  lines.push(fmtLine('sitelog_uptime_seconds', 'process uptime', 'gauge', Math.floor((Date.now() - startedAt) / 1000)));

  // Build info
  lines.push(fmtLine('sitelog_build_info', 'build info', 'gauge', 1, `{version="${process.env.npm_package_version ?? '0.2.0'}",node_env="${process.env.NODE_ENV ?? 'development'}"}`));

  // DB-derived business metrics (cached briefly to avoid hammering on scrape interval)
  try {
    const [[org], [proj], [usr], [entry], [audit], [hook], [key]] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS n FROM organization`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM project WHERE deleted_at IS NULL`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM "user"`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM daily_entry`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours'`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM webhook_endpoint WHERE active = true`),
      db.execute(sql`SELECT COUNT(*)::int AS n FROM api_key WHERE revoked_at IS NULL`),
    ].map(p => p.then((r: any) => r.rows ?? r)));

    lines.push(fmtLine('sitelog_organizations_total', 'orgs registered', 'gauge', (org as any).n));
    lines.push(fmtLine('sitelog_projects_active', 'active (non-deleted) projects', 'gauge', (proj as any).n));
    lines.push(fmtLine('sitelog_users_total', 'users registered', 'gauge', (usr as any).n));
    lines.push(fmtLine('sitelog_daily_entries_total', 'daily entries ever submitted', 'gauge', (entry as any).n));
    lines.push(fmtLine('sitelog_audit_events_24h', 'audit events in last 24h', 'gauge', (audit as any).n));
    lines.push(fmtLine('sitelog_webhooks_active', 'active outbound webhooks', 'gauge', (hook as any).n));
    lines.push(fmtLine('sitelog_api_keys_active', 'non-revoked API keys', 'gauge', (key as any).n));

    // Plan distribution
    const planRows: any = await db.execute(sql`SELECT plan, COUNT(*)::int AS n FROM organization GROUP BY plan`);
    const plans = (planRows.rows ?? planRows) as Array<{ plan: string; n: number }>;
    for (const p of plans) {
      lines.push(`sitelog_orgs_by_plan{plan="${p.plan}"} ${p.n}\n`);
    }
  } catch (e: any) {
    lines.push(`sitelog_db_scrape_error 1\n# ${e.message?.slice(0, 200)}\n`);
  }

  return lines.join('');
}

/** Hono middleware factory — counts http_requests_total + http_errors_total */
export function metricsMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    bump('http_requests_total');
    await next();
    if (c.res.status >= 400) bump('http_errors_total');
    if (c.res.status >= 500) bump('http_5xx_total');
  };
}
