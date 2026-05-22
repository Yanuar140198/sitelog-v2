import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-static';
export const revalidate = 3600;

export const metadata = {
  title: 'Changelog · Sitelog',
  description: "What's new in Sitelog. Release notes per version.",
};

function readChangelog(): string {
  try {
    const root = process.cwd();
    // Web is apps/web, CHANGELOG.md is at repo root → ../../CHANGELOG.md
    const candidates = [
      join(root, '..', '..', 'CHANGELOG.md'),
      join(root, 'CHANGELOG.md'),
    ];
    for (const p of candidates) {
      try { return readFileSync(p, 'utf-8'); } catch {}
    }
    return '# Changelog\n\nUnable to load CHANGELOG.md at build time.';
  } catch {
    return '# Changelog\n\nUnable to load CHANGELOG.md.';
  }
}

function renderMd(md: string): React.ReactNode {
  // Minimal markdown — handles ## h2, ### h3, - bullets, **bold**, `code`, blank lines as paragraph breaks.
  // For richer rendering, swap for react-markdown later.
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={out.length} className="list-disc pl-6 space-y-1 text-sm leading-relaxed">
          {bullets.map((b, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(b) }} />)}
        </ul>
      );
      bullets = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith('# ')) { flush(); out.push(<h1 key={out.length} className="font-display text-4xl font-bold mt-8 mb-4">{line.slice(2)}</h1>); }
    else if (line.startsWith('## ')) { flush(); out.push(<h2 key={out.length} className="font-display text-2xl font-bold mt-8 mb-2 text-[var(--color-brand)]">{line.slice(3)}</h2>); }
    else if (line.startsWith('### ')) { flush(); out.push(<h3 key={out.length} className="font-display text-lg font-bold mt-4 mb-1">{line.slice(4)}</h3>); }
    else if (line.startsWith('- ')) { bullets.push(line.slice(2)); }
    else if (line.trim() === '---') { flush(); out.push(<hr key={out.length} className="my-8 border-t border-neutral-300" />); }
    else if (line.trim()) { flush(); out.push(<p key={out.length} className="text-sm my-2" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />); }
    else { flush(); }
  }
  flush();
  return out;
}

function renderInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-200 px-1 font-mono text-xs">$1</code>');
}

export default function ChangelogPage() {
  const md = readChangelog();
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] px-6 py-12">
      <article className="max-w-3xl mx-auto">
        {renderMd(md)}
      </article>
    </div>
  );
}
