# 11 — INFRASTRUCTURE, PROVIDER AND ENVIRONMENT READINESS

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

**Environment variables appear by NAME ONLY. No value, key, token or connection string is
reproduced anywhere in this package.**

---

## 1. Environment matrix

| Dimension | Local | Staging | Production |
|---|---|---|---|
| Proven in this program | **Yes** (partially) | **No** | **No** |
| Database | Ephemeral Postgres fixture container `letbuyy-executable-pg` (postgres:16-alpine) — **used, 4 behavioural suites green** | Not probed | Not probed |
| Full Supabase stack | Available (`supabase` CLI 2.111.0 installed) but **not started**; `setup-local-env.mjs` targets `http://localhost:54321`, nothing listening | — | — |
| API gateway / BFF / identity / storefront | **Not booted** — see §2 | — | — |
| Flutter merchant app | `analyze` clean, 164/164 tests, **release APK built** (throwaway key) | — | — |
| Live provider adapters | All **NOT CONNECTED** | NOT CONNECTED | NOT CONNECTED |
| Deploy ever executed | n/a | **No evidence** | **No** — branch lag 291 vs `origin/main` |

**No claim of staging or production readiness is made anywhere in this package.**

## 2. Why the full local stack was not booted

The ephemeral Postgres fixture named by the program brief (`pnpm foundation:pg:start`) **was**
booted and produced the strongest evidence in this package (doc 09 §7).

The application runtimes were not, and the reason is a hard dependency, not a shortcut:
`scripts/dev/setup-local-env.mjs` renders every local env file against `http://localhost:54321` —
the **Supabase local stack**, which is not running. Booting it (`supabase start`) would spin up the
full Supabase container suite and replay 126 migrations. That is feasible, but:

- The canonical config is `database/supabase/config.toml`; the **root** `supabase/config.toml` is a
  retired duplicate the migration validator explicitly flags.
- `supabase/.temp/linked-project.json` shows the user has a **linked Supabase project rooted at
  `supabase/`**. Starting or reconfiguring the stack risked disturbing that link.

So the honest position: **the DB layer has real behavioural proof; the HTTP layer does not.** The
merchant→buyer journey has **not** been executed end-to-end anywhere. Recorded as the central
evidence gap in doc 15.

## 3. Canonical topology conformance (ART-04, ART-19, ART-22)

### 3.1 Reserved services — **COMPLIANT**

All six are manifest-only, exactly as ART-19/ARCH-R4 requires:

```
services/checkout-runtime       AGENTS.md  runtime.manifest.json
services/event-bus              AGENTS.md  runtime.manifest.json
services/notification-service   AGENTS.md  runtime.manifest.json
services/analytics-pipeline     AGENTS.md  runtime.manifest.json
services/media-service          AGENTS.md  runtime.manifest.json
services/search-service         AGENTS.md  runtime.manifest.json
```

No source, no tests, no deploy config. **This program added nothing to them and must not.**

### 3.2 Frozen apps — deploy-layer compliant, source-layer drifting

`apps/developer-portal`, `apps/app-marketplace`, `apps/theme-marketplace`,
`apps/platform-operations-portal` have **no deploy configuration** in any workflow or `vercel.json`.
At the deploy layer ART-22 holds.

**But `apps/developer-portal` has ~2,125 lines of uncommitted UI work in the working tree**
(`globals.css` alone went from 0 to 55 raw hex values, contributing directly to the 9 design-system
ratchet regressions that make the governance gate red). Building on a frozen app is not a topology
violation, but it is scope drift into a surface the Constitution froze, and it is currently the
proximate cause of the red gate. Recorded in doc 07 as user-owned.

### 3.3 The one real topology violation

The **app-marketplace / developer platform / checkout-extension surface is mounted inside the
canonical monolith** (`services/api-gateway/src/index.ts:727`), with the App Bridge endpoints
reachable in production despite `FEATURE_EXTENSIONS="false"`. Full evidence in doc 10 §5.3.

## 4. Cloudflare Worker configuration

`services/api-gateway/wrangler.toml` feature flags by environment — verified line by line:

| Block | `FEATURE_GRAPHQL` | `FEATURE_EXTENSIONS` | `FEATURE_LIQUID` | Lines |
|---|---|---|---|---|
| `[vars]` (default — used by `wrangler dev` and any deploy without `--env`) | `true` | **`true`** | **`true`** | 39–41 |
| `[env.staging.vars]` | `true` | **`true`** | **`true`** | 130–132 |
| `[env.production.vars]` | `false` | `false` | `false` | 246–248 |

Production is correct. **The default block is not.** A `wrangler deploy` without an explicit
`--env production` ships extensions and Liquid **enabled** — flipping the Liquid default
cohort-wide is exactly what ART-17/THEME-R6 forbid without the parity/security/perf gate.

`[env.production.vars]` also sets `FEATURE_AI_CREDIT_PURCHASE = "false"` and carries a
founder-approved temporary note that the query-cost rate limiter has **no Upstash Redis backend
provisioned**; without it the limiter falls back and, per the production-safety validator, must fail
closed.

## 5. Secrets contract

`production-deploy.yml` injects secrets with `wrangler secret put ... --env production`. Names only,
as they appear in the workflow:

`PRODUCTION_SUPABASE_URL` · `PRODUCTION_SUPABASE_ANON_KEY` · `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` ·
`PRODUCTION_AUTH_SECRET` · `PRODUCTION_CSRF_SECRET` · `PRODUCTION_CUSTOMER_SESSION_SECRET` ·
`PRODUCTION_STEP_UP_SIGNING_SECRET` · `PRODUCTION_IDENTITY_PUBLIC_JWKS` ·
`PRODUCTION_CHECKOUT_SIGNING_SECRET` · `PRODUCTION_TURNSTILE_SECRET_KEY` ·
`PRODUCTION_API_GATEWAY_INTERNAL_SECRET` (→ both `INTERNAL_API_SECRET` and
`LETBUYY_INTERNAL_API_SECRET`)

Mobile release: `LETBUYY_ANDROID_KEYSTORE_BASE64`, `LETBUYY_ANDROID_KEYSTORE_PATH`,
`LETBUYY_ANDROID_KEY_ALIAS`, `LETBUYY_ANDROID_KEY_PASSWORD`, `LETBUYY_ANDROID_STORE_PASSWORD`.

**Repository hygiene: clean.** No secret is committed. `services/api-gateway/.dev.vars` exists
locally and is correctly ignored (`.gitignore:93`). `SEC-R2` / `R-21` hold.

## 6. Provider modes — every one is mock or unconnected

| Provider | Mode at `bf35062e` | Sentinel / evidence |
|---|---|---|
| Razorpay (payments) | **Not connected** | `RAZORPAY_KEY_ID = SKIP_NEEDS_HUMAN_PRODUCTION_RAZORPAY_KEY_ID` in `dart-defines/production.json` |
| Cloudflare Turnstile | **Not connected** (site keys real, secret/token absent) | `TURNSTILE_TOKEN = SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN` |
| Sentry (crash reporting) | **Not connected** | `SENTRY_DSN = SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN`; app keeps reports in a local diagnostics outbox and calls no provider |
| Push (FCM/APNs) | **Structurally absent** | No FCM/APNs dependency in `pubspec.yaml`; `MOBILE_PUSH_DEVICE_TOKEN` is a build-time constant, empty in both dart-define files |
| Resend (email) | Not connected | `LETBUYY_EMAIL_MODE` unset |
| Supabase / GitHub / Cloudflare / Vercel (LCIS live adapters) | **NOT CONNECTED** | `pnpm lcis live adapters` names the exact env vars for each |

> These sentinels are **correct engineering**, not defects. AGENT-R11/R12 and PAY-R10 require
> mock-by-default, honest-always: a stub must never read as success. The `SKIP_NEEDS_HUMAN_*`
> pattern makes each gap loud. They are launch **prerequisites**, recorded in doc 14.

**Consequence for the store:** Turnstile fails closed, so with `TURNSTILE_TOKEN` unset a store
reviewer **cannot log in** — an automatic rejection independent of code quality.

## 7. Endpoints the mobile app targets

From `dart-defines/production.json` (all on the canonical `.com` domain — DEPLOY-R3 compliant):

```
BFF_BASE_URL        https://bff.letbuyy.com/v1
API_BASE_URL        https://bff.letbuyy.com/v1
IDENTITY_BASE_URL   https://accounts.letbuyy.com
STOREFRONT_BASE_URL https://letbuyy.com
```

Architecturally correct and matching ARCH-R1 — `app_config.dart` documents that the app sends
`lb_session` **only** to the BFF, which signs internal headers and proxies to the gateway. None of
these hosts is known to resolve or serve; DNS is `[HUMAN-REQUIRED]` (H-6).

`infrastructure/dns/dns.tf` exists (contradicting an older program note that claimed no zone file
existed), but a Terraform file is a declaration, not a live zone.

## 8. Workflows present (16)

`architecture-governance` · `branch-lag-monitor` · `ci` · `deploy-staging` ·
`environment-lifecycle` · `full-security-audit` · `graph-intelligence` ·
`hot-table-partition-maintenance` · `lcis-pr-analysis` · `live-production-certification` ·
`mobile-merchant-release` · `production-deploy` · `production-rollout` · `security-review` ·
`staging-deploy` · `staging-runtime-deployment`

Two structural problems:

1. **`ci.yml` does not run on the active branch.** It triggers only on `develop`/`main`; work
   happens on `stepup/main`. The branch therefore has no typecheck, lint, unit, governance or
   Flutter gate.
2. **`production-deploy.yml` triggers on `main`, which is 291 commits behind `stepup/main`.** Its
   first step is a branch-lag guard, so it cannot pass. **Nothing has ever been deployed from this
   repository state.**

## 9. Local development — what actually works today

| Command | State |
|---|---|
| `pnpm foundation:pg:start` / `:stop` | **Works.** Container `letbuyy-executable-pg`, no host port. Started by this program, restored to its prior stopped state afterwards. |
| `node --test tests/executable/*.mjs` | **Works** against that fixture — 4 suites green |
| `flutter analyze` / `flutter test` | **Work** — clean / 164 pass |
| `flutter build apk --release` | **Works only with signing secrets**; correctly refuses otherwise |
| `pnpm validate:*` | Run individually; the aggregate gate is red (doc 09 §3) |
| `pnpm dev:store` / per-filter dev servers | **Not exercised** — require the Supabase local stack (§2) |

> ⚠ **`pnpm validate:governance` has a destructive side effect.** At
> `scripts/validate-governance.mjs:170-188` it recursively deletes `.dart_tool`, `build`,
> `coverage`, `.cache`, `.wrangler`, `.vercel`, `Pods` under `apps`/`packages`/`services` before
> `stale-artifact-validator` (index 70). It did **not** fire in this program because the gate
> fail-fasts at index 5, and `git status` confirms 0 deleted tracked files — but once the
> design-system failure is fixed, a routine gate run will wipe every local build cache and iOS
> `Pods`. Expect to re-run `pod install` and a full Flutter rebuild.
