# LetBuyy — Staging + Production Only (Remove Local Dev) Plan

**Intent:** eliminate the local‑dev environment entirely. **Two environments only — `staging` and `production`.** All development config, `.dev.vars`, local emulators, and local stack tooling are removed; **all testing runs against `staging`.**
**Verification basis:** direct scan of the repo — found ~21 local env files, 8 `local:*`/`federation:local` package scripts, 9 local‑stack scripts, wrangler `[env.dev]` blocks (+ `api-dev`/`cdn-dev`/`localhost` defaults), a `config/env/templates/local.env.example`, and localhost fallbacks in app source.

> ⚠️ **Read §5 before executing.** Every Codex mission written so far proves work against a **real local stack** (`federation:local:up`). Removing local changes that proof model to **staging**. This is the one consequential decision in this plan — §5 resolves it.

---

## 1. COMPLETE REMOVAL INVENTORY (every local artifact)

### A. Local env files (delete all)
- `./.env.local` (root — a full local infra env: `DATABASE_URL`, `REDIS_URL`, `QUEUE_EMULATOR_URL`, `EVENT_STORE_URL`, `REPLAY_RUNTIME_URL`, OTEL/Prometheus/Grafana/Loki/Tempo, `MAILPIT_*`, `*_SANDBOX_URL`, `*_SANDBOX_MODE`).
- `apps/*/.env.local` — 9 files: `app-marketplace`, `identity-platform`, `marketing-site`, `merchant-control-plane`, `platform-console`, `platform-operations-portal`, `storefront-runtime`, `theme-marketplace` (+ root).
- `apps/mobile/merchant-app/.dart-defines.local`, `apps/mobile/merchant-app/dart-defines/local.json`, `apps/mobile/operator-app/.dart-defines.local`, `apps/mobile/shopper-app/.dart-defines.local`.
- `services/*/.dev.vars` — 8 files: `media-service`, `notification-service`, `checkout-runtime`, `webhook-service`, `analytics-pipeline`, `search-service`, `event-bus`, `queue-workers`.
- `config/env/templates/local.env.example` (the local template the root `.env.local` is generated from).

### B. package.json scripts (remove)
`dev`, `federation:local:up`, `federation:local:down`, `local:bootstrap`, `local:up`, `local:health`, `local:reset`, `local:seed`, and `setup:env` if it generates local. **Keep/repoint** `build`, `lint`, `typecheck`, `test`, `validate:*`, and the `cloudflare:bootstrap:staging|production` + `certify:production` scripts.

### C. Local stack scripts (delete)
`scripts/dev/` (`local-stack-up.mjs`, `local-stack-down.mjs`, `README.md`) and `infrastructure/scripts/local/` (`bootstrap-local.mjs`, `common.mjs`, `health-local-stack.mjs`, `reset-local-stack.mjs`, `seed-local-data.mjs`, `start-local-stack.mjs`).

### D. Wrangler `[env.dev]` blocks (remove the dev env)
In `services/api-gateway/wrangler.toml`, `services/queue-workers/wrangler.toml`, `services/webhook-service/wrangler.toml`: delete every `[env.dev]…` block and the `api-dev.letbuyy.store` / `cdn-dev.letbuyy.store` routes, and replace base‑config `localhost`/`letbuyy-local-storage` defaults (`ASSET_PUBLIC_BASE_URL = "http://localhost:8787/..."`, `preview_bucket_name = "letbuyy-local-storage"`) with staging equivalents. **Keep only `[env.staging]` and `[env.production]`.**

### E. App/source localhost fallbacks (repoint to staging)
Default URLs in `apps/*/src/lib/api/client.ts`, `apps/identity-platform/src/lib/config/urls.ts`, `apps/*/src/proxy.ts`, `apps/storefront-runtime/next.config.ts|robots.ts|seo.ts`, marketing components, theme‑editor `CenterPanel.tsx`, etc. — any `localhost:8787|54321|3000…` fallback must default to **staging** (e.g. `https://api.staging.letbuyy.store/v1`), never localhost. Flutter `supabase_config.dart` defaults already point at production — keep those; just remove the local dart‑defines.

### F. CI (rewire to staging)
`.github/workflows/environment-lifecycle.yml` (and any workflow referencing `local`/`federation:local`): remove local steps; CI builds → deploys to **staging** → runs tests/E2E **against staging**.

### G. .gitignore / docs
Remove `.env.local`, `.dev.vars`, `.dart-defines.local` patterns from local‑setup docs; update READMEs (no "run locally" section — replace with "deploy to staging").

---

## 2. TARGET — two environments only

| | **staging** | **production** |
|---|---|---|
| Web (Next) | Vercel — `*.staging.letbuyy.store` | Vercel — `letbuyy.store` etc. |
| Workers | Cloudflare `[env.staging]` — `api.staging.letbuyy.store` | Cloudflare `[env.production]` — `api.letbuyy.store` |
| Supabase | staging project | production project |
| Mobile | `dart-defines/staging.json` | `dart-defines/production.json` |
| Purpose | **all dev + all testing** | live merchants only |

`dev` collapses into `staging`. No `localhost`, no emulators, no `.env.local`/`.dev.vars` anywhere.

---

## 3. SECRETS & CONFIG MODEL (no local files)

Secrets **never** live in files in the repo. They live in the platform secret stores, exactly two sets:
- **Vercel project envs** (staging + production) for the Next apps.
- **Cloudflare Worker secrets** (`wrangler secret put … --env staging|production`) for the workers.
- **GitHub Environments** (`staging`, `production`) for CI secrets.
- **Supabase** staging/prod project keys in the above stores.
- **Mobile:** `dart-defines/{staging,production}.json` hold **non‑secret** config (URLs, public anon key, environment); real signing/keys are injected at build/CI time → `[SKIP — NEEDS HUMAN]` until provided.

Keep `config/env/{staging,production}.env.template` + `staging-production-secret-matrix.json` as the **documentation of which secret goes where** (they already exist). The human fills the actual values in the platform stores.

---

## 4. TESTING ON STAGING (the new model)

1. **No local test runs against a stack.** Unit tests + typecheck + lint + governance (128/128) still run in CI **without** a stack (they're static / pure).
2. **Integration + E2E run against staging:** CI builds the branch → deploys to a **staging/preview** target → runs Playwright (`LETBUYY_E2E_BASE_URL=https://*.staging.letbuyy.store`) + the J1‑J5 journeys against the **real staging gateway + staging Supabase**.
3. **Per‑branch preview (recommended):** use **Vercel preview deployments** (automatic per PR) for the web tier and a **shared staging gateway/DB** for the API, so a branch can be tested before merge without a localhost.
4. **Provisioning proof** (the old "fresh DB" check) now runs against a **disposable staging DB** (apply `000_baseline.sql` to a fresh staging Supabase), not localhost.

---

## 5. IMPACT ON THE EXISTING MISSIONS (the one big change)

Every mission (`CODEX_PRODUCTION_HARDENING`, `…FEDERATION`, `…SHOPIFY_UX`, `…MOBILE_PARITY`, the master sequential, the WS stages) currently encodes a **"REAL‑E2E Law"** that says *"prove against the real local stack via `federation:local:up`."* With local removed, that clause must be **re‑pointed to staging**:

> **Revised REAL‑E2E Law:** prove against the **staging** stack (deployed `api.staging.letbuyy.store` + staging Supabase). UI is proven via Storybook/component screenshots during development and via **staging preview deployments** after push; full J1‑J5 run against staging. If staging is not yet provisioned/credentialed, mark the live‑proof `[SKIP — NEEDS HUMAN: staging deploy + secrets]` and continue (build/typecheck/lint/governance still gate every commit).

**Practical consequence for autonomous agents:** a Codex agent can't spin up a localhost stack to screenshot anymore. During dev it proves UI with **Storybook + component tests**; the **real‑data proof happens in CI against staging** after the branch is pushed/previewed. So the agent's loop becomes *build → typecheck/lint/governance green → push → staging preview → screenshot/E2E*. This is **more realistic** (tests deployed infra) but **needs staging to be live + credentialed** — that's the human‑gated prerequisite.

➡️ **Action:** when you run the cleanup mission (below), it also patches the mission docs' REAL‑E2E clause from `federation:local:up` → staging.

---

## 6. TRADEOFFS & WATCH‑OUTS (honest)

- **Slower inner loop.** No localhost = every integration test needs a staging/preview deploy (seconds–minutes vs instant). Mitigate with Vercel previews + keeping unit/Storybook fast and local‑free.
- **Always‑on cost.** Staging Supabase + workers + Vercel run 24/7. Budget for it.
- **No offline dev.** You (and agents) must be online and staging must be up.
- **Debugging is remote.** Use staging logs/observability (Cloudflare + Supabase + OTEL) instead of localhost breakpoints.
- **Secrets discipline is mandatory.** With no `.env.local`, everything depends on the platform secret stores being correctly set per environment — get the `staging-production-secret-matrix.json` filled first.
- **Don't delete the migration baseline or the seed *logic*** — just the *local* runner. You still need to seed **staging** (a `scripts/staging/seed.mjs` that targets the staging DB) — convert `seed-local-data.mjs` → a staging seeder rather than deleting the seeding capability outright.

**Recommended stance:** keep this, but add **per‑PR preview deploys** so the loss of localhost doesn't cripple iteration. That's the standard "cloud‑dev / staging‑first" model and it works well — just fund staging and wire previews.

---

## 7. EXECUTION

Run the executable cleanup mission: **`docs/Codex_waves/CODEX_ENV_CLEANUP_MISSION.md`** (a Codex mission in the same lineage — keep 128 green, SKIP human‑gated secret setup, small reversible commits). It deletes the local surface (§1), collapses wrangler to staging+production (§1.D/§2), repoints source defaults to staging (§1.E), converts the local seeder to a **staging** seeder (§6), rewires CI to test on staging (§1.F/§4), and patches the missions' REAL‑E2E clause to staging (§5).

**Order:** (1) human fills the staging + production secret stores (Vercel/Cloudflare/GitHub/Supabase) from the secret matrix → `[SKIP — NEEDS HUMAN]` blocks the *live* parts until done; (2) Codex executes the removal + repoint + CI rewire (doesn't need secrets); (3) first staging deploy + staging E2E proves the new model.

---

## 8. ONE‑LINE NORTH STAR

Two environments, zero localhost: **staging is where you build and test, production is where merchants live** — no `.env.local`, no `.dev.vars`, no emulators, every change proven on real deployed staging infra.
