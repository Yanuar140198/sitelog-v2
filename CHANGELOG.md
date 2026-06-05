# Changelog

## [0.18.0](https://github.com/Yanuar140198/sitelog-v2/compare/v0.17.0...v0.18.0) (2026-06-05)


### Features

* **ai:** Suggest BOQ scopes tool + revive feature-flag gating ([0f183e9](https://github.com/Yanuar140198/sitelog-v2/commit/0f183e935f3e3d4f376b8cd010017e8479ae8ccd))
* **observability:** install Sentry SDKs + harden gitignore ([150e291](https://github.com/Yanuar140198/sitelog-v2/commit/150e291370d8d19236631f9f271c17178c4d3ee0))

## [0.17.0](https://github.com/Yanuar140198/sitelog-v2/compare/v0.16.0...v0.17.0) (2026-06-05)


### Features

* /changelog/rss.xml RSS feed + ops/alerts.yml Prometheus rules ([41b7e9e](https://github.com/Yanuar140198/sitelog-v2/commit/41b7e9e1bbe0a359a67b57f42bf0c136b2328f42))
* **admin:** revokeApiKey + listApiKeys procedures + debug/echo E2E ([a9ea6e7](https://github.com/Yanuar140198/sitelog-v2/commit/a9ea6e710719635b502611dce6e8e57e4253920b))
* **admin:** searchUsers procedure (was missing from prior commit) ([bbfcde2](https://github.com/Yanuar140198/sitelog-v2/commit/bbfcde2b4e5e57c8cda5a076ba5a1bcb84512d81))
* **admin:** stats query returns recency counts (entries 24h/7d, audit 24h, growth 7d, webhooks+keys active) ([ddcc577](https://github.com/Yanuar140198/sitelog-v2/commit/ddcc57733362ca01e8b1a4fbae9731a0d4945fed))
* **admin:** super-admin recentWebhookDeliveries query (last 100 across all orgs) ([83d16c8](https://github.com/Yanuar140198/sitelog-v2/commit/83d16c86b25f5b04069a8a1c62f1438d94cdb96a))
* **ahsp+boq:** rich AHSP detail + HSD master + quick-add wizard ([ef27839](https://github.com/Yanuar140198/sitelog-v2/commit/ef278391ea69049ce11fd8b2b1f16b16e49e5d07))
* **ahsp:** auto-merge all duplicates + auto-archive zero-rate + sanity bulk actions ([bc498d0](https://github.com/Yanuar140198/sitelog-v2/commit/bc498d09f3f71960bc590996fbde375162187ddc))
* **ahsp:** catalog inline rename + bulk archive + pins + keyboard shortcuts ([fc63b87](https://github.com/Yanuar140198/sitelog-v2/commit/fc63b874cde7ddea315f4cfafc0e5703c42ae146))
* **ahsp:** catalog upgrade — search/filter/sort + computed rate column + clone ([f917ef6](https://github.com/Yanuar140198/sitelog-v2/commit/f917ef6c9c62e29161ff8ef8dd1cebe687b78da6))
* **ahsp:** compare + usage stats + sanity check tools ([7b62cb8](https://github.com/Yanuar140198/sitelog-v2/commit/7b62cb8a12ceee94987e6aa60963871c5f873447))
* **ahsp:** data quality fix (Bina Marga jenis names) + dedup wizard ([a579c2b](https://github.com/Yanuar140198/sitelog-v2/commit/a579c2b8a2a4c933f5dd955e0f1738a1dc936064))
* **ahsp:** detail page always-editable + keyboard shortcuts + quick-pick + auto-save toast ([929d9be](https://github.com/Yanuar140198/sitelog-v2/commit/929d9be82de0f8f89b8ee6ecb2e9e27c2a9cfb2c))
* **ahsp:** detail-edit infra + xlsx import endpoint + print view (finalize agents B+D) ([a6dffb7](https://github.com/Yanuar140198/sitelog-v2/commit/a6dffb7dea8c6cf18136ecdb05d563f420c80840))
* **ahsp:** extend Bina Marga lookup + auto-classify category column ([4a8d026](https://github.com/Yanuar140198/sitelog-v2/commit/4a8d026f4ea24d93c75f951bd7c5e80ac7def600))
* **ahsp:** formula notation for koefisien (explicit calculation basis) ([d873366](https://github.com/Yanuar140198/sitelog-v2/commit/d8733667134bf9577ad91e718118b78e90a91bab))
* **ahsp:** quick-edit drawer from catalog list (no navigation needed) ([b965cda](https://github.com/Yanuar140198/sitelog-v2/commit/b965cda3979327053cd23afe3cccebe50563b85e))
* **ahsp:** search by resource + productivity calculator + cost breakdown ([adb386f](https://github.com/Yanuar140198/sitelog-v2/commit/adb386f8ece297b42ffb0ab8ef4c8a3307c29932))
* **ahsp:** show koefisien formula in the print/PDF sheet ([6642fad](https://github.com/Yanuar140198/sitelog-v2/commit/6642fad6facbeacd3a635bde6e555dd0301bd1e5))
* **ahsp:** wire BY RESOURCE + PRODUCTIVITY + IMPORT tool links to catalog header ([5a0f05e](https://github.com/Yanuar140198/sitelog-v2/commit/5a0f05e0ca046c84985a3fd18d8b8dace802955d))
* **ahsp:** wire detail page inline edit + history + nav (finalize Agent T) ([d943d45](https://github.com/Yanuar140198/sitelog-v2/commit/d943d45a630fb6723657715c29fb4cb6ffe9c865))
* **ai:** bring-your-own Anthropic API key per org (encrypted at rest) ([d9694c0](https://github.com/Yanuar140198/sitelog-v2/commit/d9694c09fdefa91e80e82cf3117d24316a4c8459))
* **ai:** Claude-powered assistant — draft daily reports + explain AHSP rates ([604fd14](https://github.com/Yanuar140198/sitelog-v2/commit/604fd141fd086fe6b04206f97ed3d5f45071592b))
* announcement banner in app shell + severity styling ([da45295](https://github.com/Yanuar140198/sitelog-v2/commit/da4529591497f29e2b17b72c46bd5422f554b294))
* **auth:** wire 2FA enable/disable + change password UI ([a03805f](https://github.com/Yanuar140198/sitelog-v2/commit/a03805fdd55504b49186599d871464a24c518d44))
* **boq:** show koefisien formula in the BOQ resource breakdown drawer ([c05d3ec](https://github.com/Yanuar140198/sitelog-v2/commit/c05d3ec9a8174ef6b732001b5a951fe398593ac8))
* **crew:** crew management + project assignments ([51b7578](https://github.com/Yanuar140198/sitelog-v2/commit/51b757848922fa64538dd8327809fc62d4d56c20))
* custom 404/500 pages + Postman collection ([4cb6449](https://github.com/Yanuar140198/sitelog-v2/commit/4cb6449e1ce92fcb9f23123f60f88274c44d1d3b))
* **deploy:** self-host compose runs alongside other apps (auto schema+seed) ([4a3af0c](https://github.com/Yanuar140198/sitelog-v2/commit/4a3af0c90da476b49fdb1cf993b7b343bddc76b8))
* **export:** PNG + print for schedule, HTML project summary ([71dc49a](https://github.com/Yanuar140198/sitelog-v2/commit/71dc49a6dd888702f94c8a223a6199ceabc19913))
* feature flags system (per-org gating + % rollout) ([ba6a996](https://github.com/Yanuar140198/sitelog-v2/commit/ba6a9969b7ffb8b571157b9af53f024d62f00c04))
* gate AI Suggest button behind 'ai-suggest' feature flag + 2 E2E tests ([d1fab6d](https://github.com/Yanuar140198/sitelog-v2/commit/d1fab6d3897f1aba0f9c892b4ad9e65b7f451967))
* **gdpr:** data export + deletion endpoints (Article 15 + 17 compliance) ([10ecd8a](https://github.com/Yanuar140198/sitelog-v2/commit/10ecd8a933a73a7fc47027a971e9757506984802))
* **hse:** incident logging per project ([14dd8d1](https://github.com/Yanuar140198/sitelog-v2/commit/14dd8d1dd2c7762ca8d82546db2c7eae4074e221))
* idempotency-key support + POST /api/v1/entries ([d214645](https://github.com/Yanuar140198/sitelog-v2/commit/d2146455890a17319c95c13feb12cb5b703442c6))
* local backup helper script ([bb4d4fe](https://github.com/Yanuar140198/sitelog-v2/commit/bb4d4fe12414fad22be054ac54f5415006aff6b7))
* maintenance mode middleware (MAINTENANCE_MODE=1 → 503 all but /healthz, /status, /metrics) ([67f7a82](https://github.com/Yanuar140198/sitelog-v2/commit/67f7a822ffd561a9712577b8d7626124037035c1))
* **material:** stock balance + delivery log per project ([cf06a9a](https://github.com/Yanuar140198/sitelog-v2/commit/cf06a9ab9a3c769b46ad6850e7da3aac15c34ad9))
* Next.js security headers + CSP (web parity with API) ([081e6fd](https://github.com/Yanuar140198/sitelog-v2/commit/081e6fd209d3c4ca24f1adb3d8896ed3a8fca7a4))
* **notifications:** add Slack/Discord/Email integration channels ([ffd3d8d](https://github.com/Yanuar140198/sitelog-v2/commit/ffd3d8d42e70ca45392e9bb8228ef21e861589e1))
* **observability:** runtime error logging (server + client) with super-admin viewer ([78a4a6a](https://github.com/Yanuar140198/sitelog-v2/commit/78a4a6aca5f0b079b9158f658933ac0714acd2de))
* optional server-side Sentry init (loaded only when SENTRY_DSN set) ([18c3f7f](https://github.com/Yanuar140198/sitelog-v2/commit/18c3f7f2ef07da1b8a6b6ebf43734a6342fa15aa))
* per-API-key rate limit on REST v1 ([3fa89af](https://github.com/Yanuar140198/sitelog-v2/commit/3fa89af1ae276edc00cf5980b5a6e629539299b7))
* per-org feature flag override panel on /superadmin/orgs/[slug] ([ae9c580](https://github.com/Yanuar140198/sitelog-v2/commit/ae9c5802da5017a8fba087abb7a805cd871c9ec3))
* platform announcement banner (super-admin CRUD + active list) ([3c600a3](https://github.com/Yanuar140198/sitelog-v2/commit/3c600a3ce2834d3083ab1cc5699f85b0c982cde5))
* POST /api/v1/debug/echo for customer integration sanity check ([a696ca3](https://github.com/Yanuar140198/sitelog-v2/commit/a696ca385cc566be05cb6731a1fe755a83611876))
* privacy UI + GDPR shared helpers + 8 unit tests ([0f099f9](https://github.com/Yanuar140198/sitelog-v2/commit/0f099f9c6428b5af6638e0162b60de7b63ed0ff1))
* public /changelog page + /badge/status shields.io endpoint ([d69dc33](https://github.com/Yanuar140198/sitelog-v2/commit/d69dc337fb55db3a8469ee2681fcd647ff6ea19a))
* public /stats JSON + /badge/projects + /badge/entries ([79e1e06](https://github.com/Yanuar140198/sitelog-v2/commit/79e1e06aba369b363cdf5678f871a63245fd89f1))
* **qc:** quality control test results + retest workflow ([d58c0c5](https://github.com/Yanuar140198/sitelog-v2/commit/d58c0c548aeab683a1d57097e61c15899efd9e80))
* **qc:** register qc schema export ([261dfcb](https://github.com/Yanuar140198/sitelog-v2/commit/261dfcbd2f6a92d625f74a961040b6f523bb357f))
* register 7 new ops routers in appRouter (crew, hse, material, subcon, vo, qc, weather) ([484d68b](https://github.com/Yanuar140198/sitelog-v2/commit/484d68ba965d3d307d385191f0c4e0f6cf78456b))
* request ID middleware (X-Request-ID propagation) ([8b17eb5](https://github.com/Yanuar140198/sitelog-v2/commit/8b17eb50ac68e5a01a91bbd3c41b9183255cdff9))
* REST CSV exports for projects + entries ([5acb711](https://github.com/Yanuar140198/sitelog-v2/commit/5acb711b65181e1a9487bc4f411c3009f5b88912))
* **schedule:** fix ACTUAL S-curve, inline date editing, baseline rollback ([bc8fc2b](https://github.com/Yanuar140198/sitelog-v2/commit/bc8fc2bec0812e52a02d96a989b74cca49f254cb))
* **schedule:** S-curve + Gantt + baseline rebase (Primavera-style) ([75f7f74](https://github.com/Yanuar140198/sitelog-v2/commit/75f7f7410deedc82558fd590befb227f63e8b63e))
* security headers + idempotency-key prune cron ([22253cf](https://github.com/Yanuar140198/sitelog-v2/commit/22253cf3856a46d29fddc23ff83e7a373829474a))
* SEO + security disclosure (security.txt, robots.txt, sitemap.xml) ([dcc12cd](https://github.com/Yanuar140198/sitelog-v2/commit/dcc12cde9cbd08b1d926b09f6dc9f9ed4bb7bfec))
* session.list/revoke/revokeOthers tRPC procedures ([ee4d582](https://github.com/Yanuar140198/sitelog-v2/commit/ee4d582fb59dd713111b900eaece78b129bb4966))
* settings/security page (2FA enable link + sessions placeholder + org info) ([f6b1b6d](https://github.com/Yanuar140198/sitelog-v2/commit/f6b1b6d4f8b56970ec0ac68d05000db6c565f685))
* structured JSON logger (Loki/CloudWatch/Datadog parseable) ([ec41845](https://github.com/Yanuar140198/sitelog-v2/commit/ec418453c649d49f1d77c122f35b066b19af7d3b))
* structured log on project.created event ([9020088](https://github.com/Yanuar140198/sitelog-v2/commit/9020088c0301f2502c084582065d0e1e1acb80e6))
* **subcontractor:** master + per-project contracts + invoice ledger ([79538f9](https://github.com/Yanuar140198/sitelog-v2/commit/79538f9d194549458416c1e9ab1d6e66c8b9ef78))
* super-admin feature flags UI + useFeatureFlag hook ([1f07189](https://github.com/Yanuar140198/sitelog-v2/commit/1f0718919b9a64aadebc3bba579a57c6ccb31c9a))
* **superadmin:** /api-keys page (active/revoked + revoke action) ([7527560](https://github.com/Yanuar140198/sitelog-v2/commit/75275604bbef64843508ea0a67bcfe8d215d6794))
* **superadmin:** /database page (table sizes + connection stats) ([bc98c30](https://github.com/Yanuar140198/sitelog-v2/commit/bc98c30bad263daa8efa48dc2d8e8d9cee8b4cf4))
* **superadmin:** /superadmin/announcements CRUD UI ([99ac83d](https://github.com/Yanuar140198/sitelog-v2/commit/99ac83df0252d9c93b47ee59ada4dc748d17f60f))
* **superadmin:** /superadmin/webhooks activity log page ([12094fa](https://github.com/Yanuar140198/sitelog-v2/commit/12094fa38dbbcc82339d2f8ab8b0cc761364dd3e))
* **superadmin:** cross-org audit log viewer + AUDIT nav tab ([1681d50](https://github.com/Yanuar140198/sitelog-v2/commit/1681d50cc7f394053516b8b307fe3df3773bf2fa))
* **superadmin:** failed login monitor + SECURITY nav tab ([18d572d](https://github.com/Yanuar140198/sitelog-v2/commit/18d572db10aa380781d32914c55b5f6f97ed4797))
* **superadmin:** FLAGS nav tab ([8cf6745](https://github.com/Yanuar140198/sitelog-v2/commit/8cf67453c5184da57d73e35e7c7c57ebd60163cb))
* **superadmin:** killUserSessions kill switch (force re-login any user) ([6e5cee4](https://github.com/Yanuar140198/sitelog-v2/commit/6e5cee47f54715e2df110fa7f4e5bd2652f98256))
* **superadmin:** platform recency metrics (entries/audit 24h, growth 7d, webhooks/keys) ([ba68a6b](https://github.com/Yanuar140198/sitelog-v2/commit/ba68a6bf95d01991ee69071bad5f34061a6fd01b))
* **superadmin:** user search page (/superadmin/users) ([f38f0dc](https://github.com/Yanuar140198/sitelog-v2/commit/f38f0dc95c95279748c18fc4a2109088480fa857))
* **superadmin:** users page exposes KILL SESSIONS action ([b1804ef](https://github.com/Yanuar140198/sitelog-v2/commit/b1804ef7200c41ac8644ae13950e09e32fc557c5))
* **superadmin:** WEBHOOKS nav tab ([3a51910](https://github.com/Yanuar140198/sitelog-v2/commit/3a51910251f0020666d208af0bf24fc96133cebf))
* track http_5xx_total separately (5xx for alerting, 4xx less critical) ([e02149b](https://github.com/Yanuar140198/sitelog-v2/commit/e02149b2df3f86dc00f60f772ca4246e7687ea06))
* usage page (live quota meters) + structured log on Stripe webhook errors ([50605da](https://github.com/Yanuar140198/sitelog-v2/commit/50605dad2d1ff76e5fe8180b93643c2102fd1852))
* **vo:** variation order / change request workflow ([c0eecfd](https://github.com/Yanuar140198/sitelog-v2/commit/c0eecfd33839a50f6c338353b10074235bea68d8))
* **weather:** daily weather log + rain delay tracking ([bc67ac9](https://github.com/Yanuar140198/sitelog-v2/commit/bc67ac9eed938ae8d0ffbd6e1dc22a9ab22d764d))
* **web:** /app/boq editor hub (fix broken nav link → 404) ([ff1812a](https://github.com/Yanuar140198/sitelog-v2/commit/ff1812a912a425b6c9689023dc0fd6a93c0275fc))
* **webhooks:** delivery history modal per endpoint ([6a092de](https://github.com/Yanuar140198/sitelog-v2/commit/6a092de9c2cc1d797fda18b497109ea8ccabfac1))
* **web:** responsive mobile layout across the app ([edfec29](https://github.com/Yanuar140198/sitelog-v2/commit/edfec295ebf9eb78542f261425489eaa0b58bf99))
* **web:** security page wires session.list with revoke per device + REVOKE ALL OTHERS ([c75ce95](https://github.com/Yanuar140198/sitelog-v2/commit/c75ce954ae30fb8b216b6a6e37c716a00b9f3433))


### Bug Fixes

* admin.recentFailedLogins procedure (was missing from prior commit) ([7ce6908](https://github.com/Yanuar140198/sitelog-v2/commit/7ce69086a80739dc7c1415cac252ec2591fb4e58))
* **admin:** daily_entry uses submitted_at not created_at column ([ceb4db6](https://github.com/Yanuar140198/sitelog-v2/commit/ceb4db6cfdd6ff5e8066a918cba6c7fbb3f24e2e))
* **admin:** qualify relname in databaseStats SQL (ambiguous column) ([09404a3](https://github.com/Yanuar140198/sitelog-v2/commit/09404a31d35801dcb6fd7db840fd09d342355a22))
* **ahsp:** normalize satuan + seed default resource lines for 62 broken items ([d872910](https://github.com/Yanuar140198/sitelog-v2/commit/d872910e67f1d2ad49c3c1a110719e0f6426f2f8))
* **api:** close tenant-isolation gaps + harden CORS ([0f09ea1](https://github.com/Yanuar140198/sitelog-v2/commit/0f09ea159262c427dc8af3aad79c21be07a8568f))
* **api:** timing-safe secret checks + parameterized SQL id-lists + QC range guard ([358f9da](https://github.com/Yanuar140198/sitelog-v2/commit/358f9daaf4a3fb37d14eaf26f6f102f23ef65f0b))
* **ci,db:** apply full schema dump + reference seed for fresh DBs ([d7dffac](https://github.com/Yanuar140198/sitelog-v2/commit/d7dffac04dddb46da260b652509ce251e71f37d6))
* **ci,db:** apply ordered SQL migrations so fresh DBs get the full schema ([495e6e4](https://github.com/Yanuar140198/sitelog-v2/commit/495e6e4251c4fe4097fb535771383cd3b2d82eda))
* **deploy:** API must be browser-reachable on its own origin (not the web URL) ([1f033bc](https://github.com/Yanuar140198/sitelog-v2/commit/1f033bce4d272d9d941c988b17e20bf3dbd63289))
* **docker:** build in a single stage with full source so workspaces resolve ([96c62b5](https://github.com/Yanuar140198/sitelog-v2/commit/96c62b5b23767a455fea9ca0a0b9366abd1ac400))
* **docker:** bun install does not accept --production=false / pnpm lockfile ([e75bc35](https://github.com/Yanuar140198/sitelog-v2/commit/e75bc352bc97a6c8fc3515e737aa351ad98fe7ff))
* **observability:** don't log expected tRPC auth errors (UNAUTHORIZED/FORBIDDEN/NOT_FOUND) ([a41fd09](https://github.com/Yanuar140198/sitelog-v2/commit/a41fd09ef6ac08449f36eadd2e98cd5f18ed6741))
* **web,deploy:** internal rewrite target + cross-subdomain session cookie ([d27caf5](https://github.com/Yanuar140198/sitelog-v2/commit/d27caf53500a4dcecfa430e330cd205eb799ccd3))
* **web:** number-input coercion + missing form error displays ([2a227f1](https://github.com/Yanuar140198/sitelog-v2/commit/2a227f1db8945f1ea8d642815a9dc33a8c75d25e))
* **web:** wrap AHSP catalog in Suspense boundary ([719fe72](https://github.com/Yanuar140198/sitelog-v2/commit/719fe724f52fd9245c7c032a7f1a9ab4c38cc512))


### Performance

* add k6 load tests (smoke + stress) + ESLint ignore loadtest/ ([3f30242](https://github.com/Yanuar140198/sitelog-v2/commit/3f302427c2ef04c4627073dd7b7ea23ff5c89442))


### Refactors

* **ai:** remove all AI features (router/page/components/flag/docs) ([54c01c3](https://github.com/Yanuar140198/sitelog-v2/commit/54c01c3d77a6eb37f5370dacc03f56f3ccbff082))
* **api:** extract productivity estimator to pure helper + unit tests ([94d0220](https://github.com/Yanuar140198/sitelog-v2/commit/94d02200896d27b6dc695d15fb9cf342069bc81a))
* **gdpr:** API uses shared DELETE_CONFIRMATION_PHRASE + helpers ([9a14d25](https://github.com/Yanuar140198/sitelog-v2/commit/9a14d2537843b38d61d7af61dc2fa21e9f96bd07))


### Documentation

* Add LICENSE (proprietary) + CODE_OF_CONDUCT (Contributor Covenant v2.1) ([6fa02ec](https://github.com/Yanuar140198/sitelog-v2/commit/6fa02eccb182a26f41d84c37e1f26c1fe1393020))
* CHANGELOG entries for v0.2.1 / v0.2.2 / v0.2.3 / v0.2.4 ([90f3cc1](https://github.com/Yanuar140198/sitelog-v2/commit/90f3cc1e65c158ae7ef4067fd48e08917a8226fa))
* CHANGELOG v0.2.5 entry ([9620cdf](https://github.com/Yanuar140198/sitelog-v2/commit/9620cdf796d29030f6a7e13b1287b869bbefecc8))
* CHANGELOG v0.2.6 ([2a3be74](https://github.com/Yanuar140198/sitelog-v2/commit/2a3be7470d1a40db066257c1d19a2cb660407d43))
* CHANGELOG v0.2.7 ([cee98f4](https://github.com/Yanuar140198/sitelog-v2/commit/cee98f41dca96ef91366873a4c14d9070e87ecec))
* CHANGELOG v0.2.8 ([ae15163](https://github.com/Yanuar140198/sitelog-v2/commit/ae15163796833bb5c81b46b3c35b4a16de291e65))
* CHANGELOG v0.2.9 ([6463e81](https://github.com/Yanuar140198/sitelog-v2/commit/6463e8164cf70bb96e08abeea4ce4d58d6bfac7e))
* CHANGELOG v0.3.0 ([e365e65](https://github.com/Yanuar140198/sitelog-v2/commit/e365e652aa1a6e60119fc8c29e33fadef9cd5eca))
* CHANGELOG v0.3.1 + v0.3.2 ([8ce2856](https://github.com/Yanuar140198/sitelog-v2/commit/8ce2856439bdb20d8edcf22290e0356b3ffda381))
* CHANGELOG v0.3.3 ([4c53a6d](https://github.com/Yanuar140198/sitelog-v2/commit/4c53a6d2857fd437fe1bcf361071ac329c64d1c2))
* CHANGELOG v0.8.0 consolidated milestone notes ([4f2247c](https://github.com/Yanuar140198/sitelog-v2/commit/4f2247cb7bcbcc3b4557541c49b660888580d801))
* **openapi:** expand info.description with rate limits + tracing + idempotency ([c4d6980](https://github.com/Yanuar140198/sitelog-v2/commit/c4d69808c05724b1531dcb50bb4699fac3461815))
* README badges +2 (projects, entries) + bump test count ([407a0f8](https://github.com/Yanuar140198/sitelog-v2/commit/407a0f8f4c046cc69ac19ab9e877dcf9b8549218))
* webhook-verify examples for customer consumer side (Node + Python) ([6ca770a](https://github.com/Yanuar140198/sitelog-v2/commit/6ca770a6816b3fa0c9752c00a8c5aa3abff7d863))

## v0.13.0 — 2026-05-22

### Removed
- **All AI features** — surgical removal of Claude/Anthropic integration to refocus on operational features.
  - Deleted `apps/api/src/router/ai.ts` (ask, suggestBoq, analyzePhoto, rateSanity procedures)
  - Deleted `/app/ai` page, `AiSuggestPanel`, `PhotoAiPanel`, `RateSanityPanel`
  - Removed `photo-tagger` cron + library, AI healthz check, `ai_calls_total` metric
  - Removed `AI Assistant` sidebar entry, command-palette `?` AI mode, project AI button
  - Removed `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` env vars from `.env.example`, CSP `api.anthropic.com` whitelist, DEPLOY_NOW Anthropic step
  - DB columns (`ai_caption`, `ai_tags`, `ai_progress_pct`, `ai_analyzed_at`) and `ai_calls` usage metric left dormant for backward-compat; `ai-suggest` feature flag left in DB migration history

## v0.8.0 — 2026-05-22

Consolidated milestone since v0.5.0.

### Major features
- **Feature flag system** (v0.7.0/v0.7.1/v0.7.2):
  - DB tables + 5 seeded flags
  - FNV-1a hash for deterministic per-org bucketing
  - 4 tRPC procedures + super-admin UI
  - `useFeatureFlag` React hooks
  - AI Suggest button gated on `ai-suggest` (live wiring)
- **REST API expansion**:
  - GET /exports/projects.csv + /exports/entries.csv
  - POST /debug/echo integration sanity
  - 12 total REST endpoints
- **Session management**:
  - session.list/revoke/revokeOthers tRPC
  - Settings ActiveSessions UI with CURRENT badge
- **Super-admin tooling**:
  - /superadmin/{users, audit, security, api-keys, announcements, flags, webhooks}
  - admin.{recentAudit, recentWebhookDeliveries, recentFailedLogins, killUserSessions, revokeApiKey, setPlan, listApiKeys, searchUsers}
- **Public endpoints**:
  - GET /stats + /badge/{status,projects,entries}

### Tests
- 86 unit (+8 feature-flags) | 64 E2E | **Total: 150**

### Final stats
- 41 release tags · 32 tRPC routers + 12 REST endpoints
- 10 settings tabs + 10 super-admin tabs

## v0.3.3 — 2026-05-22

### Tests
- 15 edge-case unit tests added: empty/zero inputs, SPI extremes, antipodal geofence, plan-quota boundaries
- Total unit tests: 55 → 70
- Total tests overall: 99 → **114** (70 unit + 44 E2E)

## v0.3.2 — 2026-05-22

### Features
- `/superadmin/announcements` CRUD UI page (title/body/severity/ends-at/dismissible form + table)
- `/app/settings/security` page (2FA enable + sessions placeholder + org info)
- 4 new E2E tests for privacy + announcements

### Stats
- Total E2E: 40 → 44
- Settings tabs: 8 → 9 (added SECURITY)
- Super-admin nav: 3 → 4 tabs

## v0.3.1 — 2026-05-22

### Features
- `/superadmin/announcements` UI

## v0.3.0 — 2026-05-22

### Features
- Next.js security headers + CSP (web parity with API)
  - X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP with `frame-ancestors 'none'`
  - `connect-src` includes Sentry, PostHog, Anthropic for proper allowlist
- Platform announcement banner (super-admin CRUD)
  - DB migration `0010_announcements.sql` + Drizzle schema
  - tRPC `announcement.active` / `listAll` / `create` / `delete`
  - App shell renders active banners with severity colors (info/warning/critical)
  - Per-user dismiss via localStorage
- `appRouter.announcement` added (now 30 routers total)

## v0.2.9 — 2026-05-22

### Features
- Security headers middleware on every response
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security` (when `x-forwarded-proto: https`)
- `/api/cron/prune-idempotency` (hourly Vercel cron) — deletes idempotency keys older than 24h

### Tests
- 3 E2E tests for security headers + request ID propagation
- Total E2E: 37 → 40

## v0.2.8 — 2026-05-22

### Features
- POST `/api/v1/entries` REST endpoint (write scope) — submit daily entries via API
- Idempotency-Key header support (Stripe-style)
  - Same key + same body within 24h → cached 201 response with `X-Idempotent-Replay: 1`
  - Same key + different body → 409 `IDEMPOTENCY_CONFLICT`
- DB migration `0009_idempotency_keys.sql` (24h retention window)
- OpenAPI 3.1 spec updated with `/entries` POST operation

### Tests
- 2 idempotency E2E tests (replay + conflict)
- Total E2E: 35 → 37

## v0.2.7 — 2026-05-22

### Features
- Request ID middleware: auto-generates UUID, honors upstream `X-Request-ID`, always echoed on response
- Maintenance mode middleware: `MAINTENANCE_MODE=1` → 503 most paths (exempts `/healthz`, `/status`, `/metrics`)
  - `X-Maintenance-Bypass` header + `MAINTENANCE_BYPASS_SECRET` admin override
  - Custom message via `MAINTENANCE_MESSAGE` env
- Structured JSON logger (Loki/CloudWatch/Datadog parseable, level filter via `LOG_LEVEL`)
- `.well-known/security.txt` (RFC 9116) for vulnerability disclosure
- `robots.txt` + Next.js sitemap.xml for SEO
  - Disallows `/app`, `/superadmin`, `/api`, `/share` (private surfaces)

## v0.2.6 — 2026-05-22

### Features
- Privacy settings page (`/app/settings/privacy`) with EXPORT + DELETE flows
  - Branded UI matching app design system (orange + black + red danger banner)
  - Indonesian copy explaining GDPR Article 15 + 17
  - DELETE button gated by exact phrase input
- Settings layout tab nav: PRIVACY added (8th tab)
- `@sitelog/shared` GDPR helpers: `DELETE_CONFIRMATION_PHRASE`, `isValidDeletionConfirmation`, `scheduledDeletionDate`, `anonymizeEmail`
- API gdpr router refactored to import shared helpers (now unit-tested)

### Tests
- 8 GDPR unit tests (phrase validation, 30-day calc, email anonymization determinism)
- Total unit tests: 47 → 55

## v0.2.5 — 2026-05-22

### Features
- GDPR `gdpr.exportMyData` query — JSON dump of all user-attributable rows (Article 15)
- GDPR `gdpr.requestDeletion` mutation — anonymize + scheduled hard delete (Article 17)
- Custom 404 `not-found.tsx` + 500 `error.tsx` pages (branded, Sentry-aware)
- Postman collection in `examples/` for non-CLI customers
- `http_5xx_total` metric counter (separates server errors from 4xx for alerting)

## v0.2.4 — 2026-05-22

### Features
- k6 load test scripts (smoke + stress) at `loadtest/`
- Nightly CI workflow (E2E + k6 against staging, gated on `STAGING_BASE_URL` repo var)
- Bundle size workflow (soft 150 KB FLJS budget)

## v0.2.3 — 2026-05-22

### Features
- A11y test suite (5 axe-core tests on public pages, WCAG 2.0/2.1 AA)
- LICENSE (proprietary) + CODE_OF_CONDUCT (Contributor Covenant v2.1)
- Docker build smoke test job added to CI
- Webhook signature verification examples for customer consumers (Node + Python)

### Bug fixes
- WCAG link-in-text-block violation in signup + login (color-only distinguishability)

## v0.2.2 — 2026-05-22

### Features
- Metrics counters wired into actual handlers (live data flow per request)
- CodeQL SAST workflow (security-extended + security-and-quality)
- Optional server-side Sentry init (dynamic import pattern)
- Local backup helper script (`scripts/backup-local.sh`)

### Tests
- 6 rate-limiter unit tests (token bucket invariants)

## v0.2.1 — 2026-05-22

### Features
- OpenAPI 3.1 spec at `/api/v1/openapi.json`
- Scalar interactive docs at `/api/v1/docs`
- Prometheus `/metrics` endpoint (7 counters + 7 business gauges)
- Grafana dashboard JSON (12 panels)
- 3 example SDK clients (bash + Node + Python)
- Deep status endpoint with live Stripe ping when configured

### Tests
- 4 observability E2E tests
- 2 OpenAPI spec E2E tests

## v0.2.0 — 2026-05-22

### Features
- **REST API v1**: `/api/v1/{me,projects,ahsp,entries}` with Bearer `sk_live_*` auth, scope-based RBAC
- **Super admin org detail**: `/superadmin/orgs/[slug]` with billing breakdown + force-plan mutation
- **Docker self-hosted**: `apps/api/Dockerfile` + `docker-compose.yml` for non-Vercel deploys
- **Deep status endpoint**: live Stripe ping (when key set), version info, critical-only HTTP semantics

### Quality
- ESLint flat config + typescript-eslint + unused-imports plugin (0 errors / 0 warnings)
- Husky pre-commit + lint-staged auto-fix
- @sitelog/shared package: pure math/validation/signing extracted + 41 unit tests
- Wired shared into API: plan-limits, entry router (validateEntry, geofence), boq router (projectTotal), rest.ts (projectTotal)
- Playwright E2E: 18 smoke + 6 REST contract tests (65 tests total)
- 3 GitHub workflows: ci, release-please, deploy-preview
- Dependabot grouped weekly updates
- CODEOWNERS + issue/PR templates

### Bug fixes
- `retention.ts`: drop `.returning()` select shape (postgres-js incompatible)
- 35 unused imports auto-removed via eslint-plugin-unused-imports
- AhspDetailDrawer: mark unused projectId arg with underscore prefix

### Docs
- `SECURITY.md` — threat model + 18 controls + disclosure SLA
- `CONTRIBUTING.md` — quality gates + code layout + commit style
- `.env.example` — full env reference
- README REST API section with 6 example curls

### Stats
- 23 commits since v0.1.0
- 200+ source files
- 9 packages typecheck clean
- 65 tests total (41 unit + 24 E2E)
- 3 deploy paths (Vercel, Docker, local)

---

## v0.1.0 — 2026-05-21 (Initial release)

Production-ready Sitelog construction SaaS. Verified end-to-end via headless browser smoke test.

### Core features

- **Auth**: Better Auth signup/login + multi-tenant org sessions + 2FA TOTP + magic link + invite tokens
- **BOQ engine**: AHSP catalog with resource lines (Tenaga + Bahan + Peralatan), unit rate baseline computation, override per-item, markup/contingency/PPN, financial summary panel
- **AHSP detail page**: full Bina Marga breakdown matching Excel parity (verified Rp 38,102/m³)
- **Daily entries**: shift + weather + activities + equipment + photos, geofence validation, offline queue (mobile)
- **Analytics**: live SPI/CPI computation from entry quantities vs plan, per-project progress bars
- **BOQ versions**: snapshot + restore + A/B diff
- **Templates**: org-custom + public marketplace, save from project + apply to new
- **AI Suggest**: Anthropic Claude integration with stub fallback (3 hardcoded scope recommendations by project type)
- **Rate Sanity**: flags BOQ items >10% off AHSP baseline
- **Audit log**: every mutation tracked with actor/IP/UA + CSV export
- **Webhooks**: outbound HMAC-SHA256 signed events + retry queue
- **API keys**: `sk_live_*` bearer tokens with scope-based RBAC
- **Plan quotas**: trial=3 projects, starter=10, pro=∞, middleware-enforced
- **XLSX export**: full BOQ download (verified Rp 3.49B grand total)
- **Public share**: anonymous client view via `/share/{token}`
- **Custom domain**: per-org enterprise white-label
- **Super admin**: platform overview + org detail + force-plan mutation
- **Status page**: real-time component health (DB/Stripe/AI/R2)
- **Cmd+K palette**: navigation + AI ask mode (`?` prefix)

### Stack

- Turborepo 2.9 + pnpm 11 monorepo
- Next.js 15.5 + React 19 + Tailwind v4 (web, 32 pages)
- Expo 52 + React Native 0.76 + Expo Router (mobile, 9 screens)
- Hono 4.6 + tRPC v11 + Bun (API, 28 routers)
- PostgreSQL + Drizzle (12 schema modules, 8 migrations)
- Better Auth 1.1 with custom UUID generator + bridge tables for legacy schema
- Auto-detect DB driver: neon-http for Neon serverless, postgres-js for self-hosted

### Runtime bugs fixed during smoke test (22)

1. observability.ts dynamic import wrapped in `new Function()` to defeat webpack static analysis
2. react/react-dom pinned to exact 19.2.6 (was version mismatch)
3. Onboarding page Suspense boundary added for useSearchParams
4. tRPC reserved word `apply` renamed to `applyToProject`
5. DB driver auto-detection added (Neon vs postgres-js by URL)
6. Better Auth `account` + `verification` tables added to schema + adapter
7. `session.updatedAt` column added (Better Auth required)
8. Better Auth `generateId: () => crypto.randomUUID()` config (UUID columns)
9. `trustedOrigins` config + `defaultCookieAttributes` for cross-port cookies
10. `/api/auth/*` mounted in Hono server
11. `credentials: 'include'` in tRPC fetch + Cookie in CORS allowHeaders
12. Next.js rewrites `/api/*` to same-origin (cookie auth cross-port fix)
13. tRPC mount endpoint config + `onError` log
14. `resolveAuthSession` allows no-org session (new signups need org.create access)
15. `orgProcedure` checks empty orgId
16. Project new form: empty date strings coerced to undefined
17. Zod transforms `''` for optional date fields
18. AHSP seed: insert detail items as own items (not just metadata link to rate items)
19. Dashboard portfolio: live SQL aggregation from boq_item × ahsp_resource
20. Dashboard portfolio: earned value live from entry_activity actual vs plan
21. XLSX + PDF exports: rate from resource lines baseline (was defaulting to 0)
22. retention.ts: drop `.returning()` select shape overload (postgres-js incompatible)

### Demo data populated

- 1 org Demo Construction (Pro plan, 25 seats)
- 4 projects (3× LS 45 + 1× MMS 12 via template)
- 6 BOQ scopes (Rp 7.13B portfolio)
- 3 daily entries (25,500 m³ actual)
- 2 BOQ versions
- 1 saved template (Mining DT Standard 50K)
- 1 invite (supervisor@sitelog.local)
- 1 API key (CI Integration, ADMIN scope)
- 1 webhook (3 events HMAC signed)
- 12 audit log entries
- 1 public share link (anon)

### Files

- 200+ source files tracked
- 6 commits
- 8 packages typecheck clean
- Web build: 32 routes, 102 KB First Load JS
- API build: 1,896 modules, 8.64 MB bundle
