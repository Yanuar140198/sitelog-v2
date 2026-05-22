import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const revalidate = 3600;

function readChangelog(): string {
  const root = process.cwd();
  for (const p of [join(root, '..', '..', 'CHANGELOG.md'), join(root, 'CHANGELOG.md')]) {
    try { return readFileSync(p, 'utf-8'); } catch {}
  }
  return '';
}

/**
 * Parse CHANGELOG.md into RSS items. Each `## v...` heading becomes an item.
 */
function parseEntries(md: string): Array<{ version: string; date: string; body: string }> {
  const lines = md.split('\n');
  const entries: Array<{ version: string; date: string; body: string }> = [];
  let current: { version: string; date: string; body: string } | null = null;
  for (const line of lines) {
    const match = /^##\s+(v[\d.]+)\s+—\s+(\d{4}-\d{2}-\d{2})/.exec(line);
    if (match) {
      if (current) entries.push(current);
      current = { version: match[1]!, date: match[2]!, body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) entries.push(current);
  return entries;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET(): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://sitelog.app';
  const entries = parseEntries(readChangelog());
  const items = entries.map(e => `
    <item>
      <title>${escapeXml(e.version)}</title>
      <link>${base}/changelog#${e.version.replace(/\./g, '-')}</link>
      <guid isPermaLink="false">${e.version}</guid>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <description>${escapeXml(e.body.trim().slice(0, 1000))}</description>
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sitelog Changelog</title>
    <link>${base}/changelog</link>
    <description>Release notes for Sitelog construction SaaS.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
