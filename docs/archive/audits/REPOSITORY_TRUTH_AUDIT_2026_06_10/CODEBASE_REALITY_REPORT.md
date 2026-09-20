# CODEBASE REALITY REPORT — LetBuyy Repository Truth Audit

- Audit date: 2026-06-10
- Axis: CODEBASE REALITY (actual topology, ownership, package graph, deploy configs, dead code, local runnability)
- Method: discovery-only. Code/config/build-graph inspection + read-only git + one read-only gate run. Documentation cited only to show drift.
- Repo state at audit: branch `stepup/main`, HEAD `c4fc3cd6` ("fix(foundation): resolve final audit drift", 2026-06-10). Working tree dirty: **512 deleted, 410 modified, 76 untracked** (`git status --short | awk '{print $1}' | sort | uniq -c`). `main` is at `4bcae19a` (2026-06-09); `stepup/main` is **30 commits ahead of main, 0 behind** (`git rev-list --count`). All Phase A–D13 changes recorded in `EXECUTION_LEDGER.md` are **uncommitted** (every row says "not committed").

---

## 1. Executive Summary

1. **The real system is small and concentrated.** One backend monolith (`services/api-gateway`, 261 TS files / 84,549 lines, 60 route modules, ~75 mounted path prefixes) + 3 thin satellite workers (mobile-bff is literally **one 449-line file** proxying to the gateway service binding) + 5 production Next.js apps + 1 real Flutter app. Everything else in `apps/*` and `services/*` is frozen source, or AGENTS.md+manifest placeholders.
2. **Production deploys from `main` only** (`.github/workflows/production-deploy.yml:3-7` — `on: push: branches: [main]`). `main` is 30 commits behind HEAD and ~1,000 changed paths behind the working tree. **Nothing from the waves or Phases A–D13 is deployable as configured today** — the entire hardening effort (migrations 162–166, identity issuance, RLS, validators) exists only on an unpushed branch + uncommitted tree.
3. **The "frozen four" are only frozen in production.** Working-tree `production-deploy.yml` trims the Vercel matrix to 5 apps, but `staging-deploy.yml` (worktree AND HEAD) still deploys `theme-marketplace`, `app-marketplace`, `platform-operations-portal` to staging (lines 189-200). At HEAD the production matrix still contains all 9 apps. `config/vercel/projects.json` still declares production projects/URLs for all 9 (lines 79-137). Frozen apps remain in the pnpm workspace, are built by CI (`pnpm turbo build` in `ci.yml:248`), and 3 of 4 keep their `vercel.json`.
4. **Reserved roots are genuinely empty.** All 6 reserved services + `shopper-app` + `operator-app`: 0 source files, only `AGENTS.md` + `runtime.manifest.json`. But each reserved manifest is ~127 lines of ~60 prose "ownership" fields, and the D11 package deletion was propagated into them by mechanical find/replace, leaving garbled text like "payment service-local event helpers entrypoints" and "delegates to service-owned read planners and service-owned read planners" (`services/checkout-runtime/runtime.manifest.json:13,83`).
5. **The D11 deletion was clean at the import level.** 8 package roots deleted in the working tree (154 files) — `distributed-runtime`(77), `projection-runtime`(18), `orchestration`(16), `runtime-composition`(15), `application-services`(15), `app-engine`(5), `search-core`(4), `extension-host`(4) — and **zero residual `@letbuyy/<deleted>` imports** remain anywhere in apps/services/packages/scripts/config. All 21 surviving library packages have ≥1 real inbound import.
6. **The TypeScript build graph is broken at the root, at HEAD and in the worktree.** `tsconfig.workspace.json:68` references `./packages/typescript/utils`, which does not exist on disk **or at HEAD** (`git ls-tree HEAD packages/typescript/` shows only api-client, api-types, ui). No package has a built `dist/` despite every lib tsconfig being `composite` + `emitDeclarationOnly` + `outDir: ./dist` — so standalone `tsc --noEmit` against packages with references hits TS6305 (the ledger itself records the hits for checkout-core and theme-engine); only the turbo path (`typecheck` dependsOn `^build`) works.
7. **Validator mass shrank but theater patterns persist.** Worktree: 133 validators on disk (HEAD had 210; 77 deleted), gate lane runs 90 and **passes** ("Governance gate lane passed (90 validators)"). At least 10 validators have zero references from package.json/CI/gate/tests. Six root package.json scripts (`validate:distributed-execution`, `durable-execution`, `distributed-survivability`, `operational-certification`, `replay`, `survivability-intelligence`) are all aliases for the same `no-scan-generated-agents-validator.mjs` (`package.json:39-42,52,58`).
8. **Big production-dark surfaces ship inside the gateway.** `FEATURE_GRAPHQL`, `FEATURE_EXTENSIONS`, `FEATURE_LIQUID` are all `"false"` in `[env.production.vars]` (`services/api-gateway/wrangler.toml:243-245`) — the 3,941-line GraphQL layer, 623-line extension host, and the D7 Liquid render path are feature-flagged dark in production (on in staging). All 6 `oauth2/*` routes in identity-platform are 5-line `oidcSkeletonResponse` stubs.
9. **A second, parallel backend surface lives inside merchant-control-plane.** 62 Next API routes under `apps/merchant-control-plane/src/app/api/stores/[store]/*` (products, orders, inventory, taxes, coupons, billing, payment-config…) duplicate domains that `services/api-gateway` also owns. Plus resume/portfolio-product residue (`ats-score`, `projects`, `certifications`, `education`, `experience`, `skills` pages; gateway `/portfolio`, `/resume` routers) from a previous product life.
10. **Root-level Flutter is intentional but leaky.** Root `pubspec.yaml` is a Melos 7 Dart workspace (merchant-app + 4 `packages/dart/*`); root `build/` (9 files, Flutter test cache) and `.dart_tool/` are gitignored residue of running flutter at the root. The Melos script `run:super_admin` points at `apps/mobile/operator-app`, which has no Flutter source (`pubspec.yaml:34-36`). Root `analysis_options.yaml:14-23` globally suppresses `dead_code`/`unused_*` analyzer warnings ("reserved for future use").

---

## 2. Method

- File inspection via Read/Grep on `/Users/saai_sidd/Git/Letbuyy_Store`; shell via the mounted clone (`find`, `wc`, `git status/diff/ls-tree/show/rev-list`, `node -e` JSON parsing of every workspace package.json).
- One read-only validator run: `node scripts/validate-governance.mjs --lane=gate` (exit 0, "90 validators", branch-lag warning "30 commit(s) ahead of main").
- No installs, no builds, no test runs, no file changes other than this report.
- Route counting: Next.js `page.tsx` + `route.ts` under `src/app`; Hono `.route(...)` mounts in worker `index.ts`; `app.get/post(...)` for non-Hono-router workers.
- Worktree vs HEAD distinguished with `git show HEAD:<path>` / `git ls-tree HEAD` / `git status --short` throughout.
- Note: the harness Glob tool returned empty results against this mount and was abandoned in favor of `find`/Grep; no findings rely on it.

---

## 3. Runtime Topology Table (working tree)

"Prod target" = present in the worktree `production-deploy.yml` matrix/jobs. "Stage target" = worktree `staging-deploy.yml`. Counts from `find` (TS files under `src/`; pages = `page.tsx`; API = `route.ts`).

| Unit | Status | Source reality | Routes | Deploy config | Prod target | Stage target | Evidence |
|---|---|---|---|---|---|---|---|
| apps/storefront-runtime | REAL | 124 TS | 23 pages + 21 API + `src/proxy.ts` host middleware | vercel.json (bom1) | Y | Y | matrix `production-deploy.yml:376`; `src/proxy.ts:221-260` |
| apps/merchant-control-plane | REAL | 164 TS | 61 pages + 62 API + proxy.ts | vercel.json | Y | Y | matrix line 374; route census §5 |
| apps/identity-platform | REAL | 65 TS | 10 pages + 28 API + proxy.ts | vercel.json | Y | Y | matrix line 372; §5 |
| apps/marketing-site | REAL (small) | 21 TS | 5 pages, 0 API, no proxy.ts | vercel.json | Y | Y | matrix line 370 |
| apps/platform-console | REAL | 36 TS | 20 pages + 4 API (console-auth) + proxy.ts | vercel.json | Y | Y | matrix line 378 |
| apps/app-marketplace | FROZEN (full source) | 91 TS | 21 pages + 8 API + proxy.ts | vercel.json **kept** | N (worktree) / **Y at HEAD** | **Y** | HEAD matrix `git show HEAD:...production-deploy.yml:363`; staging `staging-deploy.yml:192` |
| apps/developer-portal | FROZEN | 20 TS | 9 pages, 0 API, no proxy.ts | **no vercel.json** | N (worktree) / Y at HEAD | N | HEAD matrix line 365; `find . -name vercel.json` lacks it |
| apps/theme-marketplace | FROZEN (full source) | 65 TS | 29 pages + 3 API + proxy.ts | vercel.json kept | N (worktree) / Y at HEAD | **Y** | HEAD line 361; staging line 189 |
| apps/platform-operations-portal | FROZEN | 32 TS | 20 pages, 0 API, proxy.ts | vercel.json kept | N (worktree) / Y at HEAD | **Y** | HEAD line 369; staging line 198 |
| apps/mobile/merchant-app | REAL (Flutter) | 159 .dart + android/ios | n/a | pubspec.yaml; dart-defines/{staging,production}.json | Y (ci.yml `mobile-merchant`; signed AAB via `mobile-merchant-release.yml`, workflow_dispatch, **untracked file**) | — | `ci.yml:196-225`; release yml lines 1-60 |
| apps/mobile/shopper-app | RESERVED | 0 .dart; AGENTS.md + runtime.manifest.json only | — | none | N | N | `ls apps/mobile/shopper-app` |
| apps/mobile/operator-app | RESERVED | 0 .dart; AGENTS.md + manifest only | — | none | N | N | same; yet root `pubspec.yaml:34-36` melos script targets it |
| services/api-gateway | REAL (monolith) | 261 TS / **84,549 lines** | 60 route modules, ~75 mounts | wrangler.toml `letbuyy-api` | Y (wrangler deploy, `production-deploy.yml:307-309`) | Y | §4, §5 |
| services/mobile-bff | REAL (thin) | **1 TS file, 449 lines** | 4 endpoints | wrangler.toml `letbuyy-mobile-bff` | Y (lines 355-357) | Y | `src/index.ts:419-422` |
| services/webhook-service | REAL (small) | 4 TS / 1,683 lines | 7 endpoints | wrangler.toml `letbuyy-webhook` | Y (lines 324-326) | Y | §4 |
| services/queue-workers | REAL | 11 TS / 4,766 lines | queue()+scheduled(), no HTTP | wrangler.toml `letbuyy-queue-workers` | Y (lines 340-342) | Y | §4 |
| services/checkout-runtime | RESERVED | 0 TS; AGENTS.md+manifest | — | none ("Reserved only — no deployable runtime artifact", manifest line 45) | N | N | `runtime.manifest.json:121-126` |
| services/search-service | RESERVED | 0 TS; manifest-only | — | none | N | N | `ls` |
| services/media-service | RESERVED | 0 TS; manifest-only | — | none | N | N | `ls` |
| services/notification-service | RESERVED | 0 TS; manifest-only | — | none | N | N | `ls` |
| services/event-bus | RESERVED | 0 TS; manifest-only | — | none | N | N | `ls` |
| services/analytics-pipeline | RESERVED | 0 TS; manifest-only | — | none | N | N | `ls` |

`config/runtime/production-topology.json` (worktree, topologyVersion 2, **`"mode": "governance-contract-not-live-evidence"`**, line 6) matches this table: 11 active runtimes, 6 reserved, 4 frozen with `deploymentKind: "not-deployed"` and empty manifests (lines 202-233) — **but** 3 of those 4 "not-deployed" apps still carry a live `vercel.json` and remain staging targets, and `config/vercel/projects.json` still lists all four with production project IDs/URLs (`apps.letbuyy.com`, `developers.letbuyy.com`, `themes.letbuyy.com`, `ops.letbuyy.com`, lines 79-137). `deployment-topology.json` mirrors the same 16 nodes with reserved scaling pinned to 0 (`maxInstances: 0`, lines 237-355).

---

## 4. Service / Route Ownership

### services/api-gateway (`letbuyy-api`, api.letbuyy.com) — the backend monolith
- `src/index.ts` (966 lines) mounts ~75 path prefixes from 60 route modules in `src/routes/` (84 route files including `app-store/`, `internal-console/`, `operations/`, `storefront/` subdirs). Mount list at `index.ts:673-771`. Public surface: `/auth, /contacts, /storefront(/graphql), /checkout, /stores, /themes, /app-store, /app, /whatsapp/inbound, /wa/webhook`. Internal: `/internal/{console,billing,events,store-access,custom-domain-reconcile}`. Merchant/admin: `/admin(/graphql), /products, /orders, /risk, /returns, /shipping(/labels), /payouts, /wallet, /commission, /settlements, /billing, /security, /cod, /kyc, /2fa, /payments, /upload, /portfolio, /resume, /employees, /blog, /customers, /notifications, /email, /whatsapp, /marketing, /media, /metafields, /ai, /export, /shipping-tax, /tax, /onboarding, /inventory, /coupons|/discounts, /categories, /analytics, /reviews, /form-submissions, /pages, /operations/{rbac,risk,support,trust-safety,marketplace-reviews,developers}, ...`.
- Internal layout: `routes/` 52,474 lines; `lib/` 40 files; `graphql/` 6 files/3,941 lines; `execution/` 14 files; `extensions/` 1 file/623 lines; `identity-foundation/` 18 files; `tenant/` 2 files/3,179 lines; `middleware/` 14 files; `__tests__/` 63 files; `durable/` one 46-line `LetbuyyRuntimeDurableObject` (health/checkpoint KV).
- `scheduled()` (index.ts:~772-192 region) drains outbox + 3 logical queues (`analytics-events`, `search-indexing`, `payment-events`) every cron tick; prod cron `*/15 * * * *` (wrangler.toml:233), default/staging crons emptied "Beta free-tier".

### services/mobile-bff (`letbuyy-mobile-bff`, bff.letbuyy.com) — thin proxy
- Whole service = `src/index.ts` (449 lines). Endpoints: `GET /health`, `GET /v1/health`, `GET /v1/mobile/dashboard` (composite), `POST /v1/auth/mobile/turnstile/verify` (`index.ts:419-422`). All real work forwarded over the `API_GATEWAY_SERVICE` service binding (`index.ts:282,416`). Fails closed (HTTP 500) if `INTERNAL_API_SECRET` unset (wrangler.toml comments lines 30-38).

### services/webhook-service (`letbuyy-webhook`, webhooks.letbuyy.com)
- `src/index.ts` (1,327 lines) + 3 helpers. Endpoints: `GET /health`, `POST /app-lifecycle/dispatch`, `POST /webhook-deliveries/dispatch` (internal, called via gateway's `WEBHOOK_SERVICE` binding), and inbound payment-provider webhooks `POST /razorpay`, `/stripe`, `/paypal`, `/cashfree` (index.ts:534-1205).

### services/queue-workers (`letbuyy-queue-workers`) — consumer + cron
- `queue()` handler (index.ts:541-600): persists batch → drains DB-backed platform queues → fans out to `dispatchEmailDeliveries`, risk-scoring, review-checks, support-automation, compliance, executive-analytics, incident-command processors; acks or retries whole batch.
- `scheduled()` (index.ts:601-666, cron `17 */6 * * *` all envs): custom-domain reconciler trigger, inventory-reservation sweeper (**untracked new file** `src/inventory-reservations.ts`), executive analytics rollup, incident postmortem reminders, compliance audit export dry-run. `push-dispatcher.ts` (400 lines) exists with `PUSH_DISPATCH_MODE="dry-run"` default / `"live"` in prod vars but FCM/APNS creds all `SKIP_NEEDS_HUMAN_*` placeholders (wrangler.toml:39-47,261-269).
- Consumes 7 production queues (`letbuyy-events/analytics/search/notifications/dead-letters/production-queue/production-dead-letter-queue`, wrangler.toml:271-330).

### Next-app API surfaces (overlap)
- **identity-platform** owns `/api/auth/*` (14 routes incl. `switch`, `login`, `signup`, `create-store`, `accounts`, `stores`), OIDC skeleton (`/oauth2/*` 6 stubs), `/jwks`, `/.well-known/{jwks.json,openid-configuration}`, `/auth/callback`, 2 `/api/email/*` routes.
- **merchant-control-plane** owns a second commerce CRUD surface: `/api/stores/[store]/{products,orders,inventory,taxes,coupons,reviews,policies,posts,pages,navigation,media,billing,plan,payment-config,users,analytics,ai,...}` (~50 routes) + `/api/themes/*` (9 routes: editor, draft, sections, releases, rollback, publish, install, preview-session) + `/api/auth/logout`, `/api/plans`, `/api/subscribe(/verify)`. These domains are also mounted in api-gateway (`/products`, `/orders`, `/themes`, `/billing`, ...) — **two writers per domain across two runtimes**.
- **storefront-runtime** owns shopper-side `/api/customer/*` (10), `/api/orders*` (4), `/api/reviews`, `/api/coupons/validate`, `/api/themes(/install)`, `/api/store-lookup`, `/api/seed` (disabled: 404 in prod, 410 otherwise). Also rewrites `/api/storefront/:subdomain/:path*` → gateway `/storefront/...` (next.config.ts:104-111). Host→store resolution + password gate + custom-domain redirect live in `src/proxy.ts` (lines 221-260).
- **platform-console** owns only `/api/console-auth/{login,logout,mfa,callback}`; everything else reads the gateway (`/internal/console` + `PLATFORM_CONSOLE_API_TOKEN` secret in deploy workflow line 294).

---

## 5. Route Census per App (working tree)

| App | page.tsx | route.ts | Notable |
|---|---|---|---|
| storefront-runtime | 23 | 21 | `/store/[subdomain]/...` (16 pages incl. catch-all `[...path]`, cart, checkout, paypal-return, account/*), `/preview(/coming-soon)`, `/demo/urban-kicks` demo residue |
| merchant-control-plane | 61 | 62 | `[store]/...` admin (products, orders, online-store/themes/[themeId]/editor, settings/* 18 pages) **plus portfolio residue**: `ats-score`, `projects`, `certifications`, `education`, `experience`, `skills`, `gallery`, `testimonials`, `leads`, `comments` |
| identity-platform | 10 | 28 | auth pages (login/signup/lookup/select/onboarding/...); `oauth2/*` = 6 × 5-line `oidcSkeletonResponse` stubs (`oauth2/token/route.ts:1-5`) |
| platform-console | 20 | 4 | `(dashboard)`: merchants, stores, revenue, risk, trust-safety, compliance, operations, marketplace-governance, audit-logs, subscriptions, users, employees, analytics, settings |
| marketing-site | 5 | 0 | `/`, `/create`, `/signup`, `/pricing`, `/sitemap` |
| app-marketplace (frozen) | 21 | 8 | full marketplace UI still present |
| theme-marketplace (frozen) | 29 | 3 | largest frozen app by pages |
| platform-operations-portal (frozen) | 20 | 0 | UI-only |
| developer-portal (frozen) | 9 | 0 | UI-only, no deploy config |

Duplicate/overlapping route surfaces (same concern, multiple owners): theme CRUD in merchant-control-plane `/api/themes/*` + storefront `/api/themes` + gateway `/themes`; orders in storefront `/api/orders*` + merchant `/api/stores/[store]/orders*` + gateway `/orders`; auth/logout in identity + merchant + console; reviews in storefront + merchant + gateway.

---

## 6. Package Graph

### Workspace membership (worktree `pnpm-workspace.yaml`)
34 npm workspace packages: 9 `apps/*` + 4 `services/*` (with package.json; the 6 reserved roots and `apps/mobile/*` have none, so pnpm ignores them) + 18 named `packages/*` + 3 `packages/typescript/*`. **Note:** at HEAD the workspace file was *already* an explicit list; the worktree change is removal of the 8 rejected entries (diff: 8 deletions), not a glob→list rewrite.

### Declared workspace edges (from every package.json, `workspace:*` deps)
- `shared-types` ← 17 lib packages + most apps/services (leaf; only external dep zod).
- `auth-core` ← 8 apps/services + identity/token/session/permission/organization/audit-core + api-types.
- Identity decomposition chain: `identity-core` ← token/session/permission/organization/audit-core; all six consumed by api-gateway.
- `theme-engine` ← storefront-runtime, merchant-control-plane, theme-marketplace, api-gateway, tenant-core, api-types.
- `infrastructure` (depends on `payments`) ← api-gateway, queue-workers, webhook-service.
- `api-client` + `ui` ← all 9 apps. `api-types` ← marketing-site, api-gateway (declared); real imports: 1 source file (`services/api-gateway/src/execution/schema-registry-execution.adapter.ts:9`) + next.config transpile aliases in 3 apps.
- api-gateway declares 19 of the 21 libs (all except api-client, ui).

### Actual inbound import-line counts (grep `from '@letbuyy/<pkg>'` across apps+services)
`ui` 331, `shared-types` 143, `infrastructure` 76, `theme-engine` 67, `api-client` 60, `auth-core` 47, `tenant-core` 29, `commerce-core` 26, `checkout-core` 19, `billing-core` 19, `cms-core` 16, `identity-core` 9, `event-core` 7, `notification-core` 5, `payments` 3, `session-core` 3, `permission-core` 3, `audit-core` 3, `token-core` 2, `organization-core` 2, `api-types` 1. **Zero-inbound packages in the worktree: none** — but token/session/permission/organization/audit-core and api-types are single-consumer (api-gateway) and near-minimum usage.

### Deleted-in-worktree, present-at-HEAD (the D11 set)
`git status --short | grep '^ D packages/'` by root: `distributed-runtime` 77 files, `projection-runtime` 18, `orchestration` 16, `runtime-composition` 15, `application-services` 15, `app-engine` 5, `search-core` 4, `extension-host` 4 (= 154 files / 8 roots), plus partial deletions `packages/dart` 4 files and `packages/typescript/ui/src/mobile-tokens.ts` (D9 token consolidation). Residual reference check: `@letbuyy/{app-engine,application-services,distributed-runtime,projection-runtime,orchestration,runtime-composition,search-core,extension-host}` → **0 hits** in apps/services/packages/scripts/config.

### Dart workspace (separate, Melos)
Root `pubspec.yaml` = Melos 7 workspace: `apps/mobile/merchant-app` + `packages/dart/{core,api_client,models,ui_kit}`. Not part of pnpm. Melos script `run:super_admin` targets `apps/mobile/operator-app` which has no Flutter source (`pubspec.yaml:34-36`) — dead script.

---

## 7. Dependency-Graph Health (TS build graph)

- `tsconfig.workspace.json` (worktree): 22 project references. **Reference #22 `./packages/typescript/utils` is dangling — the directory exists neither on disk nor at HEAD** (`git ls-tree HEAD packages/typescript/` → api-client, api-types, ui only). A workspace-level `tsc -b` cannot succeed. This was already broken at HEAD (HEAD also referenced the now-deleted `search-core` and `runtime-composition`; the worktree removed those two but kept `utils`).
- Every library package: `composite: true`, `declaration: true`, `emitDeclarationOnly: true`, `outDir: ./dist` (e.g., `packages/shared-types/tsconfig.json:10-15`), while package.json `main`/`types`/`exports` all point at `./src/index.ts` (runtime resolution never uses dist).
- **No `dist/` exists in any of the 21 library packages** (checked all). Consequence: any standalone `tsc --noEmit -p <pkg>` whose tsconfig carries `references` (e.g., `packages/checkout-core/tsconfig.json:29-36`) demands built declaration output → TS6305. The ledger records exactly this: D6-VERIFY "`npx tsc --noEmit -p packages/checkout-core/tsconfig.json` hit pre-existing TS6305 referenced-package dist issue"; D7-VERIFY same for theme-engine against shared-types (EXECUTION_LEDGER.md rows D6/D7). The only working typecheck path is `turbo typecheck` (dependsOn `^build`, `turbo.json:50-55`), which builds dist first.
- Per-package `paths` aliases map `@letbuyy/*` straight to `../*/src/index.ts` (checkout-core tsconfig lines 8-15), so editor/bundler resolution works without dist — the breakage is confined to project-reference builds.

---

## 8. Deployed Systems per Config (config evidence only; live state UNVERIFIED)

### Cloudflare Workers (4 wrangler.toml)
| Worker | prod name / route | staging name / routes | Bindings (prod) | Crons |
|---|---|---|---|---|
| api-gateway | `letbuyy-api` → `api.letbuyy.com` | `letbuyy-api-staging` → `api-staging.letbuyy.com`, `api.staging.letbuyy.com` | 5 queue producers (EVENT/ANALYTICS/SEARCH/NOTIFICATION/RUNTIME), KV `CACHE` (id `ee82af47…`), R2 `letbuyy-media-production`, Hyperdrive `9e08563f…`, D1 `letbuyy-production-d1` (`76d197a5…`), DO `RUNTIME_COORDINATOR`→`LetbuyyRuntimeDurableObject`, service `WEBHOOK_SERVICE`→`letbuyy-webhook`, AE dataset `letbuyy-production-telemetry` | prod `*/15 * * * *`; default/staging `[]` ("Beta free-tier… keep it idle", wrangler.toml:19-22,116-117) |
| queue-workers | `letbuyy-queue-workers` | `letbuyy-queue-workers-staging` | 7 queue consumers (events/analytics/search/notifications/dead-letters/production-queue/production-DLQ), service `API_GATEWAY_SERVICE`, AE dataset | `17 */6 * * *` all envs |
| mobile-bff | `letbuyy-mobile-bff` → `bff.letbuyy.com` | `letbuyy-mobile-bff-staging` → 2 routes | service `API_GATEWAY_SERVICE`, AE dataset; secrets INTERNAL_API_SECRET/TURNSTILE_SECRET_KEY (fail-closed) | none |
| webhook-service | `letbuyy-webhook` → `webhooks.letbuyy.com` | `letbuyy-webhook-staging` → 2 routes | service `API_GATEWAY_SERVICE`, AE dataset | none |

Production wrangler vars carry **committed `SKIP_NEEDS_HUMAN_*` placeholders** for AI model, Razorpay key id, WhatsApp/Twilio, FCM/APNS (api-gateway lines 255-267; queue-workers lines 262-269) — live provider wiring is explicitly unfinished in config.

### Vercel
- Root `vercel.json`: install command only. 8 per-app `vercel.json` (all `bom1`, turbo-filtered builds); developer-portal has none.
- `config/vercel/projects.json`: 9 projects with staging+production URLs (incl. all four frozen apps) — **drifts from frozen status and from the trimmed prod matrix**.

### Terraform / infra
- `infrastructure/cloudflare/queues.tf`: 4 domain queues ×2 envs + runtime queue/DLQ pairs + dead-letters + `cloudflare_queue_consumer` resources bound to the consumer worker.
- `infrastructure/dns/{dns.tf,letbuyy_com.tf}` (D6 added checkout origin contract; `CHECKOUT_ORIGIN=https://checkout.letbuyy.com` in gateway prod vars line 273 — note `services/checkout-runtime` is reserved/empty, so checkout.letbuyy.com has no runtime owner in code).
- Deleted in worktree: `infrastructure/deployment/helm/*` and `kubernetes/*` (6 files) — k8s story removed.

### CI/CD (11 workflows)
- `ci.yml` (PR/push develop+main): typecheck/lint/unit on affected, secret-hygiene, governance gate, full-repo merge-safety-gate (turbo typecheck + gateway unit + behavioral + contracts + flutter analyze/test), mobile debug builds, `turbo build` of all affected (frozen apps included — no exclusion).
- `staging-deploy.yml`: 4 workers + **8 apps** (incl. 3 frozen) to staging, creds-gated.
- `production-deploy.yml` (push→main): branch-lag-guard (enforces `stepup/main` merged), credential preflight, migration gate + prod migration, staging E2E gate, 4 workers via `wrangler deploy --env production` with ~19 gateway secrets pushed, then 5-app Vercel matrix, smoke tests against `letbuyy.com`.
- `mobile-merchant-release.yml` (untracked, workflow_dispatch): signed Android AAB with keystore secrets.
- Others: architecture-governance, live-production-certification, production-rollout, environment-lifecycle, staging-runtime-deployment, hot-table-partition-maintenance.

### Database
- `database/supabase/migrations/`: 96 files, `000_baseline.sql` … `166_d6_checkout_handoff_inventory.sql`; **162–166 + their 5 rollbacks are untracked** (working tree only). D1 migrations dir referenced from wrangler (`../../database/cloudflare/d1/migrations`).

---

## 9. Dead / Unreachable / Abandoned Census

**Reserved/manifest-only (8 roots):** 6 services + 2 mobile apps — confirmed empty (§3). Each carries a ~60-field prose manifest; D11's mechanical concept-renaming left garbled text across all 10 service manifests ("service-local event helpers" appears 5–11× per manifest; nonsense duplication at `services/checkout-runtime/runtime.manifest.json:83`).

**Feature-flagged dark in production:** GraphQL routers (`/storefront/graphql`, `/admin/graphql`, 3,941 lines), extension host (623 lines), Liquid rendering — `FEATURE_GRAPHQL/EXTENSIONS/LIQUID = "false"` in `[env.production.vars]` (api-gateway wrangler.toml:243-245); all `"true"` in staging.

**Stubbed:** all 6 identity `oauth2/*` routes → `oidcSkeletonResponse` (5 lines each); storefront `/api/seed` → 404 (prod) / 410.

**Previous-product residue (live-routed but off-domain):** merchant-control-plane resume/portfolio pages (`ats-score`, `projects`, `certifications`, `education`, `experience`, `skills`, `gallery`, `testimonials`, `leads`) + api-gateway `/portfolio` and `/resume` routers (index.ts:738-739); storefront `/demo/urban-kicks`; `firebasestorage.googleapis.com` still whitelisted in storefront image remotePatterns (next.config.ts:41-45) despite the legacy/firebase tree being deleted.

**Orphan validators (0 references from package.json/CI/gate/tests/other scripts):** `contracted-domain-event-ingress`, `custom-domain-abuse-screening`, `custom-domain-reconciler`, `gateway-events-client`, `mobile-domain-parity`, `observability-producer`, `registrar-provider`, `replayable-secret-persistence`, `shopper-identity-seam`, `vercel-domain-automation` (10 of 133; another 5 have exactly 1 reference). 77 validators deleted in the worktree (HEAD: 210 → worktree: 133; gate runs 90).

**Aliased no-op gate scripts:** `validate:distributed-execution|durable-execution|distributed-survivability|operational-certification|replay|survivability-intelligence` all → `no-scan-generated-agents-validator.mjs` (package.json:39-42,52,58) — six differently-named checks, one validator.

**Tests:** 30 dirs under `tests/`; 69 files deleted in worktree (operations 34, contracts 7, replay 7, survivability 7, cloudflare 6, queues 5, projections 3 — archived to `docs/archive/validator-theater-tests-2026_06_10/` per D11). `tests/projections/` now empty (orphan dir). `tests/e2e/` holds 10 `.spec.ts` (smoke×2, federation×6, 2 journeys) matching `playwright.config.ts` testDir and the CI smoke job.

**Root utility dirs (all referenced, not dead):** `chaos/` (3 files; `chaos:plan|execute`), `load/` (k6/gatling/locust + runner; `load:plan|execute`), `artifacts/` (208 files: `local-operational-proof/`, `shopify-ux/`; consumed by operational-proof/evidence validators), `memory/lessons.md`, `tasks/` (2 files remain; 16 deleted).

**Deleted-in-worktree trees still at HEAD:** `legacy/` (37 files — entire firebase tree), `FORENSIC_REPORT/` (27), `FORENSIC_REPORT_OPERATIONS/` (16), ~50 root-level audit/ledger `.md` files (AGENTS_*…BUILD_GRAPH.md etc.), 38 docs files, 159 package files, 77 validators, 16 tasks, 6 infra helm/k8s files.

---

## 10. Root-Level Residue Findings

| Item | Verdict | Evidence |
|---|---|---|
| `pubspec.yaml`, `pubspec.lock`, `analysis_options.yaml` at root | **Intentional** — Melos 7 Dart workspace root (not misplacement) | pubspec.yaml:11-16 `workspace:` list |
| `build/` at root (9 files: `test_cache/`, `unit_test_assets/`, `native_assets/macos/`) | Untracked Flutter test/build residue from running flutter at the workspace root; gitignored (`.gitignore:31` / `**/build/`) | `find build -type f`; `git check-ignore -v build` |
| `.dart_tool/` at root | Present, gitignored (`.gitignore:25`) | `ls -d .dart_tool` |
| Root `analysis_options.yaml` | Globally downgrades `dead_code`, `unused_field/element/local_variable`, `deprecated_member_use` to ignore — repo-wide dead-Dart-code blindness by policy | lines 12-27 |
| `playwright.config.ts` at root | Active: testDir `./tests/e2e`, used by staging-E2E + prod smoke CI jobs | config lines 3-25; production-deploy.yml:483 |
| `test-results/.last-run.json` | Playwright residue, gitignored | `.gitignore:110` |
| Melos `run:super_admin` script | Dead — targets sourceless `apps/mobile/operator-app` | pubspec.yaml:34-36 |
| Root office files (`LETBUYY_*.pptx/.xlsx`) | Business artifacts living in repo root, untracked-or-tracked clutter outside code graph | root `ls` |

---

## 11. HEAD vs Working Tree vs main — Divergence Notes

- **Three-layer divergence:** `main` (`4bcae19a`, 2026-06-09, the only branch production CI deploys from) ← `stepup/main` +30 commits (waves 0–7 foundation work, Turnstile fixes, identity foundation) ← **uncommitted working tree** (Phases A–D13: 512 D / 410 M / 76 ??). The auth/identity/RLS/money hardening (migrations 162–166, `identity-session-verifier`, `tenant-transaction`, new validators) exists **only** in the uncommitted layer.
- Gate evidence: branch-lag validator output "Local working branch is 30 commit(s) ahead of main"; `production-deploy.yml:32-37` enforces `stepup/main` merged-to-main before release (added in the uncommitted D1 work — i.e., the enforcement of merging is itself unmerged).
- **Prod deploy matrix:** HEAD = 9 Vercel apps (incl. frozen four); worktree = 5. **Staging matrix unchanged at 8 (3 frozen apps still deployed).**
- pnpm-workspace: HEAD already explicit; worktree removes 8 rejected packages. tsconfig.workspace: worktree removes search-core + runtime-composition refs, keeps dangling `typescript/utils`.
- Untracked additions (76): 21 new validator files + `phase-b-common.mjs`, migrations 162–166 + rollbacks, `scripts/dev/{dev-up.sh,dev-backend.sh}`, `scripts/governance/identity-security-gate.mjs`, gateway D3–D6 tests + `identity-session-verifier.ts`/`tenant-transaction.ts`/`queue-tenant-envelope.ts`, queue-workers `inventory-reservations.ts`/`queue-projection-plans.ts`, identity `identity-issued-session.ts`, `ProviderModeBadge.tsx` (web + Flutter), `mobile-merchant-release.yml`, `GOVERNANCE_REWRITE_2026_06_10/`, `STRATEGIC_CANONICALIZATION_2026_06_10/`, `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, docs/archive/* trees.
- Working-tree governance gate **passes** (90 validators, exit 0) — i.e., the repo grades its current uncommitted self as compliant.

---

## 12. What Actually Runs Locally

- Port map (`scripts/dev/ports.mjs`): apps 9000–9008 (storefront 9000 … ops-portal 9008), storybook 9009, workers 9010–9013 (+ inspectors 9110–9113); gateway is the local API origin (`http://localhost:9010/v1`).
- `pnpm dev` → `scripts/dev/setup-local-env.mjs` (generates `.env.local`/`.dev.vars`) + `turbo run dev` for all `apps/*` + `@letbuyy/ui`. Variants: `dev:apps`, `dev:services`, `dev:all`, `dev:storybook` (package.json:5-10).
- `scripts/dev/dev-up.sh` (untracked): kills 9001/9002/9009, regenerates env, then turbo dev for **merchant-control-plane + identity-platform + ui storybook only** (lines 9, 26-29).
- `scripts/dev/dev-backend.sh` (untracked): kills 9010-9013/9110-9113, then turbo dev `--filter=./services/*` — all 4 workers via wrangler dev (lines 11, 28).
- Test entry points: `pnpm test` = `node --test tests/*/*.test.mjs` + contract tests; `test:unit:gateway`; wave wrappers `test:foundation:wave0..7` (some need Docker/ephemeral Postgres or Flutter); `turbo test` per package.
- `node_modules/` present at repo root (dependencies installed; D11-D13-VERIFY recorded a `pnpm install --no-frozen-lockfile` refresh).

---

## 13. Unknowns / UNVERIFIED

1. **Live remote state** (Vercel projects incl. whether the frozen four are still serving; Cloudflare workers/queues/D1/KV/R2 actually provisioned; DNS) — repo configs are explicit but self-label `"mode": "governance-contract-not-live-evidence"` (production-topology.json:6; cloudflare-topology.json:4). Not verifiable from the repository.
2. **TS6305 failures** were verified by config inspection (composite refs + absent dist) and by the ledger's own recorded hits; I did not run `tsc` (no-build rule).
3. Whether the **staging matrix retaining 3 frozen apps** is intentional (canary) or an oversight of Phase A-HARD-006 — no code comment either way.
4. Exact runtime reachability of merchant-control-plane's `/api/stores/[store]/*` surface vs gateway equivalents (which one the UI actually calls per page) was not exhaustively traced — both surfaces exist and are routable; per-page call-graph tracing is out of scope here.
5. `git status` deletions/modifications were summarized at directory level; the full 512-file deletion list was not reproduced inline (reproducible via `git status --short | grep '^ D '`).
