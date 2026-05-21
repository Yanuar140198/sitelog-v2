/**
 * Sitelog REST API v1 — TypeScript example.
 *
 * Run:  SITELOG_API_KEY=sk_live_xxx bun examples/node-sdk.ts
 *       SITELOG_API_KEY=sk_live_xxx npx tsx examples/node-sdk.ts
 */

const API_BASE = process.env.SITELOG_API_BASE ?? 'https://api.sitelog.app/api/v1';
const API_KEY = process.env.SITELOG_API_KEY;
if (!API_KEY) {
  console.error('Set SITELOG_API_KEY env var (generate at /app/settings/api-keys)');
  process.exit(1);
}

interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface ProjectDetail extends Project {
  boqItemCount: number;
  totals: {
    subtotal: number;
    markup: number;
    contingency: number;
    prePpn: number;
    ppn: number;
    grandTotal: number;
  };
}

class SitelogClient {
  constructor(private apiKey: string, private baseUrl = API_BASE) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${this.apiKey}`, accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    const body = await res.json();
    return body.data;
  }

  me() { return this.get<{ orgId: string; scope: string; apiVersion: string }>('/me'); }
  listProjects() { return this.get<Project[]>('/projects'); }
  getProject(id: string) { return this.get<ProjectDetail>(`/projects/${id}`); }
  projectEntries(id: string) { return this.get<unknown[]>(`/projects/${id}/entries`); }
  getEntry(id: string) { return this.get<unknown>(`/entries/${id}`); }
  ahspCatalog() { return this.get<unknown[]>('/ahsp'); }
}

const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

async function main() {
  const client = new SitelogClient(API_KEY!);

  const me = await client.me();
  console.log(`Authenticated: org=${me.orgId} scope=${me.scope}`);

  const projects = await client.listProjects();
  console.log(`\nProjects (${projects.length}):`);
  for (const p of projects) console.log(`  ${p.code.padEnd(12)} ${p.name.slice(0, 40).padEnd(40)} status=${p.status}`);

  if (projects[0]) {
    const detail = await client.getProject(projects[0].id);
    console.log(`\nDetail for ${detail.code}:`);
    const t = detail.totals;
    console.log(`  Subtotal:    ${fmtIDR(t.subtotal)}`);
    console.log(`  + Markup:    ${fmtIDR(t.markup)}`);
    console.log(`  + Conting:   ${fmtIDR(t.contingency)}`);
    console.log(`  + PPN:       ${fmtIDR(t.ppn)}`);
    console.log(`  GRAND TOTAL: ${fmtIDR(t.grandTotal)}`);
  }

  const catalog = await client.ahspCatalog();
  console.log(`\nAHSP catalog: ${catalog.length} items`);
}

main().catch(e => { console.error(e); process.exit(1); });
