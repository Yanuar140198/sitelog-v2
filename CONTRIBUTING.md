# Contributing to Sitelog v2

Welcome. This monorepo follows a tight quality bar — every change ships through CI gates.

## Quick start

```bash
git clone <repo>
cd sitelog-v2
pnpm install           # installs all workspaces + husky pre-commit hook
pnpm dev:db            # boots Docker Postgres + applies migrations
pnpm api:dev           # API on :4000
pnpm web:dev           # Web on :3000
```

## Quality gates (all must pass before PR merge)

| Gate | Command | Threshold |
|---|---|---|
| TypeScript | `pnpm typecheck` | 9/9 packages clean |
| Unit tests | `pnpm test` | 41/41 pass |
| E2E smoke | `pnpm test:e2e` | 14/14 pass (needs live dev server) |
| Lint | `pnpm lint` | 0 errors |
| Build | `pnpm build` | Web + API succeed |

CI runs all of these on every push + PR (`.github/workflows/ci.yml`).

## Pre-commit hook

`.husky/pre-commit` runs `lint-staged` which auto-fixes touched files. Bypass with `--no-verify` only for emergency.

## Code layout

```
apps/web        Next.js 15 — UI surfaces (marketing, app, superadmin, public share)
apps/api        Hono + tRPC — all business logic + DB writes
apps/mobile     Expo 52 — field daily-entry app
packages/db     Drizzle schema + migrations + seeds
packages/auth   Better Auth config + session resolver
packages/shared Pure math/validation/signing (unit-tested)
packages/api-client tRPC + React Query provider
packages/emails React Email templates
```

## Adding a feature

1. **DB schema change?** Edit `packages/db/src/schema/*.ts`, then `pnpm db:generate` to produce SQL migration, then `pnpm db:migrate` to apply locally.
2. **New tRPC procedure?** Add to `apps/api/src/router/<domain>.ts`. Use `orgProcedure` for org-scoped, `protectedProcedure` for any-authenticated, `requireRole('owner', 'admin')` for RBAC-gated.
3. **Pure math?** Put it in `packages/shared/src/` with a `.test.ts` next to it. Aim for 100% coverage of edge cases.
4. **Web page?** Add to `apps/web/src/app/<route>/page.tsx`. Use Tailwind + brutalist tokens (`--color-brand`, `--color-ink`).
5. **Mobile screen?** Add to `apps/mobile/app/<route>.tsx`. Use Expo Router. Keep dependencies minimal — every native module bloats the EAS build.

## Style

- TypeScript strict throughout. No `any` unless interfacing with untyped lib.
- Tailwind utility classes; no styled-components or CSS-in-JS.
- Functional React only; no class components.
- tRPC mutations return the created/updated row; query procedures return shaped DTOs.
- Errors throw `TRPCError` with explicit `code`; never bare `throw new Error()`.

## Tests

- Pure logic → `packages/shared/src/*.test.ts` (Vitest, fast, no DB).
- Router behavior → mock DB or integration test (TBD).
- User flows → `e2e/*.spec.ts` (Playwright, runs against live dev server).

## Commits

- Imperative present-tense subject ("Add X", "Fix Y", "Refactor Z").
- Body explains *why*, not *what*. The diff already shows what.
- Reference issue/PR in body when applicable.
- One logical change per commit. Squash WIP commits before opening PR.

## Reporting bugs

Open a GitHub issue with reproduction steps + expected vs actual + environment.

## Reporting security issues

See [SECURITY.md](./SECURITY.md). Do **not** open public issues for vulnerabilities.

## License

Contributions are licensed under the same proprietary license as the project.
