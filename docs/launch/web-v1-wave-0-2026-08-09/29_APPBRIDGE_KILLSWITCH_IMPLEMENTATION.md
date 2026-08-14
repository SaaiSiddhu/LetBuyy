# 29 — App Bridge / app-platform kill switch: implementation record

**Status:** IMPLEMENTED AND LOCALLY PROVEN, AFTER ONE ADVERSARIAL ROUND THAT FOUND AND CLOSED THREE REAL BYPASSES — committed, **not pushed, not deployed**.
**Branch:** `codex/emergency-appbridge-killswitch`
**Worktree:** `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/emergency-appbridge-killswitch`
**Base:** `ee371182`
**Final commits (in order):**
1. `ed6e5167567efcde01a349a2354d5e3591dad6e4` — the prefix gate over `/v1/app-store` + `/v1/app` (Parts I below).
2. `30fd96b57d0b41b5191fdbaf5254f3cd3313fe73` — **FINAL HEAD.** Closes the three ungated seams that a prefix perimeter cannot see (**Part II** below).

**Mandate:** doc `28_APPBRIDGE_URGENT_REACHABILITY_VERDICT.md` §7 (adjudicated minimal design).
**Governance:** ART-16 / ART-22 (`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:245,289`), NEVER-R3 (`AGENTS.md:185`), AGENT-R13 (`AGENTS.md:364`).

> **READ PART II FIRST.** Part I (§0–§8) is the record of commit `ed6e5167` and is accurate *about that commit*. Three of its claims were later shown to be **too broad**: independent adversarial review proved the app platform was still reachable from three seams outside the `/v1/app-store` + `/v1/app` prefixes. Part II (§9 onward) records the reproduction, the fix, the final test results, and the residual risk. Where Part I and Part II disagree, **Part II is authoritative.**

---

## 0. Safety attestation

- No production or staging URL was contacted. No Supabase Cloud project, Razorpay, Cloudflare, Resend, Vercel or GitHub API was called.
- Both new test suites replace `globalThis.fetch` **before** any application module is imported; the only answered origin is an in-process stub. The gateway suite asserts `egressAttempts === []` as its final test. **Zero sockets were opened.**
- No `supabase db push/pull/reset/seed/link`, no `wrangler deploy`, no `pnpm install`, no deploy command was run anywhere.
- Every code change is inside the isolated worktree. The production-linked repo at `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` received only this document and the evidence directory below.
- Nothing was pushed. No PR. No `git reset --hard`, `git clean`, `git stash`, `git checkout --`, force push or history rewrite.
- No secret value appears anywhere in this change. Only the **name** `FEATURE_APP_PLATFORM` is recorded, and it is deliberately declared in no config file.

---

## 1. What was verified before implementing (not assumed)

| Claim from the audit / adjudication | Verified how | Result |
|---|---|---|
| `featureFlags.ts` default is fail-OPEN | Read `services/api-gateway/src/middleware/featureFlags.ts:20-26` | **Confirmed.** `isGatewayFeatureEnabled` returns `!isProductionRuntime(env)` when the flag is unset. |
| Only 2 of the app-store routes are gated | Read `index.ts:715-716` (both `extensionsFeatureGate`) | **Confirmed.** |
| The mounts are at `index.ts:727-728` | `grep -n` before editing | **Confirmed** (`api.route('/app-store', appStoreRouter)`, `api.route('/app', appApiRouter)`). |
| "83 routes" | Enumerated at runtime from `appStoreRouter.routes` + `appApiRouter.routes` inside the new test | **Confirmed — exactly 83.** The falsification run reports `83/83 app-platform routes were REACHABLE` with the gate disabled. |
| ART-16 / ART-22 / NEVER-R3 / AGENT-R13 forbid this as a live capability | Read the Constitution and root `AGENTS.md` | **Confirmed.** ART-22:289 freezes the app-marketplace and developer-portal, keeping only the OAuth2/PKCE **seam**; NEVER-R3:185 forbids a third-party app marketplace as a live capability; AGENT-R13:364 requires a frozen seam to be left **empty**. |

---

## 2. Files changed

Commit `ed6e5167` — **8 files, 605 insertions, 0 deletions.** Zero lines removed anywhere; zero changes to any file under `services/api-gateway/src/routes/app-store*` or `app-api.ts`.

### Component A — gateway hard gate (load-bearing)

| File | Change |
|---|---|
| `services/api-gateway/src/middleware/appPlatformKillSwitch.ts` | **NEW.** `isAppPlatformEnabled(env)` + `appPlatformKillSwitch` middleware. |
| `services/api-gateway/src/index.ts` | **+12 lines, 3 hunks.** One import after `:8`; one `Env` field after `FEATURE_LIQUID`; four `api.use` registrations + comment inserted after `:714`, i.e. **before** the mounts. |
| `services/api-gateway/wrangler.toml` | **DELIBERATELY UNCHANGED.** The variable is declared in no `[vars]`, `[env.staging.vars]` or `[env.production.vars]` block. Absence **is** the off state. |

### Component B — merchant-control-plane UI guard

| File | Change |
|---|---|
| `apps/merchant-control-plane/src/lib/app-platform-flag.ts` | **NEW.** Same fail-closed semantics over `process.env.FEATURE_APP_PLATFORM`. |
| `apps/merchant-control-plane/src/app/[store]/apps/page.tsx` | +1 import, +1 first-statement guard. |
| `apps/merchant-control-plane/src/app/[store]/apps/[installationId]/page.tsx` (the App Bridge iframe host) | +1 import, +1 first-statement guard. |
| `apps/merchant-control-plane/src/app/[store]/settings/apps/page.tsx` | +1 import, +1 first-statement guard. |
| `.github/workflows/production-deploy.yml`, `staging-deploy.yml` | **DELIBERATELY UNCHANGED.** Absent ⇒ disabled. |

### Tests

| File | Change |
|---|---|
| `services/api-gateway/src/__tests__/app-platform-killswitch.test.ts` | **NEW** — 17 tests. Auto-globbed by `test:unit` (`src/__tests__/*.test.ts`), so it runs in CI without any script edit. |
| `tests/app-platform/app-platform-killswitch-ui.test.mjs` | **NEW** — 5 tests. Auto-globbed by the root `test` / `test:behavioral` scripts (`tests/*/*.test.mjs`). |

**Not committed:** `tmp-appbridge-probe/` remains untracked in the worktree (Lens 3's forensic probes, already archived under `raw-evidence/appbridge-urgent/probe-raw/`). It is not wired into any test script.

---

## 3. The gate mechanism

### 3.1 Fail-closed, with no environment fallback

```ts
const POSITIVE = new Set(['1', 'true', 'on', 'enabled', 'yes']);

export function isAppPlatformEnabled(env: Pick<Env, 'FEATURE_APP_PLATFORM'>): boolean {
    const value = env.FEATURE_APP_PLATFORM?.trim().toLowerCase();
    return value ? POSITIVE.has(value) : false;
}
```

Absent, empty, whitespace-only, `"false"`, `"0"`, `"off"`, `"maybe"`, `"truthy"` — all **denied**. Denial returns `404 {"success":false,"error":{"code":"APP_PLATFORM_DISABLED","message":"Not found"}}`.

The existing `isGatewayFeatureEnabled` / `featureGate` helper is **deliberately not reused**: its unset-flag branch (`featureFlags.ts:25`) returns `!isProductionRuntime(env)`, which is the fail-open defect this gate closes. A test asserts the new middleware's executable code references neither that helper nor any environment variable.

### 3.2 Perimeter, not enumeration

```ts
api.use('/app-store', appPlatformKillSwitch);
api.use('/app-store/*', appPlatformKillSwitch);
api.use('/app', appPlatformKillSwitch);
api.use('/app/*', appPlatformKillSwitch);
```

Registered at `index.ts:723-726` (post-change line numbers), i.e. **before** `api.route('/app-store', appStoreRouter)` at `:739` and `api.route('/app', appApiRouter)` at `:740`. Hono composes middleware in registration order, so this position is load-bearing; a test asserts the ordering by line number and refuses to accept commented-out registrations. Because it is a prefix gate rather than a path list, new app-store routes **under these two prefixes** are covered automatically.

> ⚠️ **CORRECTED IN PART II.** Commit `ed6e5167` also claimed "the failure mode that left the old gate at 2 of 83 cannot recur". That claim was **wrong**, and adversarial review proved it: a URL-prefix perimeter cannot see an app-platform read that lives under a *different* prefix. The 2-of-83 enumeration gap was replaced by a 2-of-4-mount-prefix gap. See §9.

Placing it ahead of `extensionsFeatureGate` and `appOAuthRateLimit` also means a blocked caller consumes no rate-limit budget.

Hono path matching is segment-based, so `'/app/*'` matches `/v1/app/...` and never `/v1/app-store/...` or `/v1/appearance...`; both are asserted.

### 3.3 Off in every deploy shape by construction

`FEATURE_APP_PLATFORM` appears in **no** config file: not `wrangler.toml` (any of its three var blocks), not `production-deploy.yml`, not `staging-deploy.yml`. Two tests assert this absence, so a future "helpful" addition breaks the build.

### 3.4 What this closes

> ⚠️ **SCOPE CORRECTION (Part II).** Everything in §3.4 is true, but it is not the whole app platform. Component A closes the two *mount prefixes*. It does **not** close the public storefront app-block reader, the public checkout-extension registry, or the marketplace/developer operator plane — all of which read the same frozen tables under other prefixes. Those are closed by commit `30fd96b5`; see §9.

Component A alone closes all 83 gateway routes; the merchant UI's server-side calls (it has no local DB access and no `app/api/app-store` proxy — it calls the gateway via `@letbuyy/api-client`); the `services/mobile-bff` proxy path, which forwards through the gateway service binding; and the Flutter client at `apps/mobile/merchant-app/lib/services/app_marketplace_service.dart`. Component B additionally stops the frozen capability being **presented** in a production deploy target.

---

## 4. Tests — real commands, real exit codes, real output

All commands were run from the worktree root, offline.

### 4.1 Gateway kill-switch suite — **exit 0, 17/17 pass**

```
$ ./node_modules/.bin/tsx --test services/api-gateway/src/__tests__/app-platform-killswitch.test.ts
```

```
✔ the app-platform surface is non-empty and enumerated from the live routers (not hard-coded)
✔ every app-platform route is unreachable — developer shape (flag absent)
✔ every app-platform route is unreachable — wrangler [env.staging.vars] verbatim (flag absent)
✔ every app-platform route is unreachable — wrangler [env.production.vars] verbatim (flag absent)
✔ every app-platform route is unreachable — staging vars + FEATURE_APP_PLATFORM="false"
✔ every app-platform route is unreachable — staging vars + FEATURE_APP_PLATFORM="" (empty)
✔ every app-platform route is unreachable — staging vars + FEATURE_APP_PLATFORM="   " (whitespace)
✔ every app-platform route is unreachable — staging vars + FEATURE_APP_PLATFORM="maybe" (malformed)
✔ every app-platform route is unreachable — staging vars + FEATURE_APP_PLATFORM="0"
✔ every app-platform route is unreachable — staging vars + FEATURE_APP_PLATFORM="truthy" (prefix-of-true)
✔ the App Bridge / marketplace route families are individually gated (named-family assertion)
✔ positive control: an explicit opt-in re-opens the surface (so the 404s above are the gate, not a broken mount)
✔ no collateral damage: non-app-platform routes are untouched in the production shape
✔ the gate is registered BEFORE the app-store / app mounts (registration-order regression guard)
✔ the kill switch does not reuse the fail-open feature-flag helper
✔ FEATURE_APP_PLATFORM is absent from wrangler.toml in every environment block
✔ the whole suite ran with zero network egress
ℹ tests 17   ℹ pass 17   ℹ fail 0   ℹ duration_ms 1268.14
EXIT=0
```

Each of the nine shape tests iterates **all 83** enumerated routes, so the run performs 747 gated requests plus the family, control and collateral checks.

The named-family test covers, individually and by name: marketplace catalog (unauthenticated `categories` / `apps` / `featured`), the three unauthenticated service-role write paths (`discovery/events`, `growth/requests`, `telemetry/events`), app OAuth2 (`oauth/token`, `oauth/token-exchange`, `apps/:id/oauth/authorize`), **`installations/:id/embed-session`**, **`bridge/fetch`**, install lifecycle (`apps/:id/install` POST + DELETE), app billing / revenue share (`installations/:id/charges`, `charges/:id/approve`), the developer platform (`developers/register`, `developers/apps`), the extensions registry, and all four `/v1/app` third-party data routes.

### 4.2 Merchant UI kill-switch suite — **exit 0, 5/5 pass**

```
$ node --test tests/app-platform/app-platform-killswitch-ui.test.mjs
```

```
✔ the merchant UI flag is fail-closed for absent, empty and malformed values
✔ the merchant UI flag opens only on an explicit positive opt-in
✔ every App Bridge / marketplace page guards before it does anything else
✔ FEATURE_APP_PLATFORM is not declared in any deploy workflow (absence is the off state)
✔ the merchant UI flag does not fall back to the environment
ℹ tests 5   ℹ pass 5   ℹ fail 0   ℹ duration_ms 215.81
EXIT=0
```

The flag module is transpiled and executed in a `node:vm` sandbox (the idiom already used by `tests/app-platform/app-bridge.test.mjs`), so its semantics are executed, not merely pattern-matched.

### 4.3 Falsification — the tests genuinely detect an absent gate

The four `api.use` registrations were temporarily commented out and the suite re-run, then restored verbatim (the restored state is what is committed; `git diff` after restoration matched the intended design exactly).

```
EXIT=1   ℹ tests 17   ℹ pass 7   ℹ fail 10
83/83 app-platform routes were REACHABLE under "developer shape (flag absent)"
83/83 app-platform routes were REACHABLE under "wrangler [env.staging.vars] verbatim (flag absent)"
83/83 app-platform routes were REACHABLE under "wrangler [env.production.vars] verbatim (flag absent)"
83/83 app-platform routes were REACHABLE under "staging vars + FEATURE_APP_PLATFORM=..."
```

This independently **reproduces the adjudicated finding** (83 routes reachable in the verbatim production shape) inside the test harness, and proves the 404s in §4.1 are produced by the gate rather than by a broken mount, a rate limiter, or a stub error. The registration-order guard was subsequently hardened so a commented-out registration cannot satisfy it.

### 4.4 Directly affected existing suites

| Command | Exit | Result |
|---|---|---|
| `node --test tests/app-platform/app-bridge.test.mjs` (the existing App Bridge contract suite) | **0** | **6/6 pass — unchanged.** |
| `./node_modules/.bin/tsx --test services/api-gateway/src/__tests__/*.test.ts` (whole gateway unit suite, 78 files) | 1 | **562 tests, 559 pass, 3 fail.** All 3 failures are **pre-existing at base `ee371182`** and unrelated: `ai.test.ts` asserts `/adapter\.purchase/` in `routes/ai.ts`; `internal-os-executive-analytics.test.ts` opens a migration file that does not exist (`database/supabase/migrations/129_*.sql`, `ENOENT`); `payments.test.ts` asserts on `apps/storefront-runtime/.../checkout-client.tsx`. **None of those three files is touched by this commit** (`git diff --stat` = 4 files), so their results are identical to base. |
| `node --test --test-concurrency=1 tests/*/*.test.mjs` (root behavioural glob) | 1 | **1566 tests, 1521 pass, 30 fail, 15 skipped.** 22 of the 30 are `tests/executable/*-postgres.test.mjs`, which require a local Postgres that was deliberately not started (offline mandate). The remaining 8 are pre-existing source/inventory drift in `apps/marketing-site`, `apps/platform-console`, `packages/theme-engine`, `services/api-gateway/src/schemas/theme.schema.ts` and dependency/typescript governance — all in files this commit does not touch. **No failure references `appPlatformKillSwitch`, `app-platform-flag`, or the three guarded pages.** |
| `node scripts/validate-governance.mjs` | 1 | Fails **fast** at the 2nd validator: *"`services/api-gateway/src/tenant/tenant-tables.registry.ts` must match schema-derived tenant table registry"*. That validator compares `database/supabase/migrations/*.sql` against the checked-in registry — **neither is touched by this commit**, so it is a pre-existing base-state failure. Because the runner exits on first failure, the remaining validators could not be reached through it. |
| 16 individually-run validators most plausibly affected | mixed | **12 pass**, including `architecture-validator` (6904 files), `import-validator` (3070 files), `circular-import-validator`, `marketplace-single-source-validator`, `settings-apps-dead-twin-validator`, `frozen-path-override-gate`, `wrangler-env-validator`, `cloudflare-environment-validator`, `env-isolation-validator`, `fail-closed-internal-routes-validator`, `app-utils-service-role-edge-validator`, `no-rejected-package-imports-validator`. The 4 failures (`undeclared-import`, `route-ownership`, `route-line-count`, `environment`) name only `packages/lcis-live`, `packages/theme-engine`, `routes/custom-domains.ts` and `routes/themes.ts` — **pre-existing, none touched here**. |
| `tsc --noEmit` in `services/api-gateway` | 2 | **20 errors, all pre-existing**, all in `src/lib/contact-request-email.ts` and `src/routes/contact-public.ts`, all caused by `packages/shared-types/src/contact.ts` not being re-exported from `packages/shared-types/src/index.ts` at base `ee371182` (verified with `git grep HEAD`). **Zero errors reference any file in this commit** (`grep -c "appPlatform\|app-platform" = 0`). |

### 4.5 What could NOT be run locally — stated plainly

- **`apps/merchant-control-plane` typecheck and `next build` were NOT run.** The worktree has no `apps/merchant-control-plane/node_modules` (only `services/api-gateway/node_modules` exists), and installing it would require network access to the package registry, which the mandate excludes. Running the root `tsc` against the app's tsconfig produced 7,563 "Cannot find module 'react' / 'next' / '@letbuyy/ui'" errors — an environment artefact, not a signal. **Component B is therefore proven by executable flag semantics and source-level guard-ordering assertions, not by a compiled build.** A `pnpm --filter @letbuyy/merchant-control-plane build` must be run before Component B ships. The edits are three one-line guards plus three import lines using the app's existing `@/lib/...` alias and its already-imported `notFound`, so the compile risk is low — but it is unproven here and must not be reported as proven.
- **No deployed Cloudflare var/secret override was queried**, by design. All env shapes are reconstructed verbatim from `services/api-gateway/wrangler.toml` at base. This does not weaken the result: the gate denies on *anything* other than an explicit positive value, so an unknown deployed override can only be irrelevant (absent) or a deliberate opt-in.
- **No edge/WAF layer was probed.** Unchanged from doc 28: a hypothetical edge rule is not a repository control.

---

## 5. What is proven

1. **All 83 App Bridge / app-marketplace / `/v1/app` routes are unreachable** — `404 APP_PLATFORM_DISABLED` — in the developer shape, the verbatim `[env.staging.vars]` shape, and the verbatim `[env.production.vars]` shape. Routes are enumerated from the live routers, so the proof covers the whole surface rather than a hand-written list and cannot silently under-count.
2. **The gate is genuinely fail-closed.** Absent, empty, whitespace-only, `"false"`, `"0"`, `"maybe"` and `"truthy"` all deny, in both the gateway middleware and the merchant UI flag. There is no environment-based fallback and no dependence on `FEATURE_EXTENSIONS`.
3. **The named high-risk families are individually gated**: embed-session, bridge/fetch, all three OAuth2 endpoints, the three unauthenticated service-role write paths, install/uninstall, the app billing and revenue-share endpoints, the developer platform, and the four `/v1/app` third-party data routes.
4. **The 404s are caused by the gate**, not by a broken mount: a positive opt-in re-opens `/v1/app-store/categories` for six positive spellings, and disabling the four registrations restores 83/83 reachability.
5. **No collateral damage:** `/v1/health` still returns 200 and `/v1/products` still returns its pre-existing 401 in the production shape; `'/app/*'` does not over-match.
6. **The switch is off in every deploy shape by construction** — `FEATURE_APP_PLATFORM` is declared in no `wrangler.toml` block and no deploy workflow, and both absences are asserted by tests.
7. **The registration-order property is protected** by a source-level regression guard, which is the one property a runtime test cannot express durably and the one that breaks silently.
8. **Zero network egress** during the entire gateway suite, asserted in-test.
9. **Nothing was removed, extended, repaired or refactored.** The diff is 605 insertions and 0 deletions; no file under `routes/app-store*` or `app-api.ts` was touched; `FEATURE_EXTENSIONS` and the shared `featureFlags.ts` helper are byte-for-byte unchanged.

## 5.1 What is explicitly NOT proven

- That `apps/merchant-control-plane` compiles (see §4.5).
- That the gate behaves identically under a real `workerd` runtime rather than the in-process Hono handler. The harness exercises the same `app.fetch` entry point Cloudflare invokes, and doc 28's probes used the same method, but no `wrangler dev` process was started.
- That the repository's full 107-validator gate is green — it fails fast at a pre-existing tenant-registry drift unrelated to this change.

---

## 6. Rollout note (ARB decision, not this document's)

This is a **reversible gate**, not a removal: setting `FEATURE_APP_PLATFORM=true` in a `[vars]` block restores prior behaviour exactly. Deploying it makes 17 currently-unauthenticated public endpoints, the OAuth2 token flow, and the App Bridge embed return 404. Any third party or internal client depending on them will break — which is the intent, but the ARB owns the sequencing and the communication.

---

## 7. What remains for Wave 1 / ARB

**Removal (Wave 1, ARB-gated under `AGENTS.md` §16.5 AGENT-LEGACY):**

1. Delete the `api.route('/app-store', …)` / `api.route('/app', …)` mounts and the ~9,566 lines under `services/api-gateway/src/routes/app-store*` + `app-api.ts`.
2. Delete the merchant UI pages, `components/apps/EmbeddedAppBridgeClient.tsx`, and the shipped static assets `apps/merchant-control-plane/public/letbuyy-app-bridge.js` and `public/example-app-bridge.html` (inert without a live gateway, but still served).
3. Retire `apps/mobile/merchant-app/lib/services/app_marketplace_service.dart` and the `app_*` tables / migrations.

**Referred to the ARB, deliberately not bundled here:**

4. **`/v1/storefront/:subdomain/checkout/extensions`** (`index.ts:714`) — same ART-16 family, same fail-open `FEATURE_EXTENSIONS` default, but it is the storefront checkout path. Gating it changes local/staging checkout behaviour and needs its own blast-radius check. **This is the obvious next item.**
5. **`services/mobile-bff/src/index.ts:68-69`** — remove `'/v1/app-store'` and `'/v1/app'` from `ALLOWED_PREFIXES`. Not required (Component A already 404s through the service binding); it removes a standing positive allow from a deny-by-default list. Two pure deletions.
6. **`featureFlags.ts:25`** — the `!isProductionRuntime(env)` fail-open default is shared with `FEATURE_GRAPHQL` and `FEATURE_LIQUID`. Flipping it to fail-closed is the right long-term fix but is cross-cutting.
7. **A deterministic validator in the 107-gate** asserting the app-platform seam stays gated. Nothing covers this today (doc 28 §4.1) — which is why the violation went unnoticed. The two new suites are the behavioural stand-in; a validator is the durable control.
8. **Cosmetic residue:** nav entries at `src/components/merchantNavigation.ts:42-47,60,171,371-376`, `src/components/settings-navigation.ts:158-167`, and the products empty-state CTA at `src/app/[store]/products/page.tsx:429` now link to 404s, and the "Browse marketplace → apps.letbuyy.com" CTA still advertises a frozen capability. One-line filters; cosmetic, not a gate.
9. **Defects recorded but deliberately not fixed** (fixing them would deepen the ART-22 violation by investing in a frozen seam; they become moot behind the gate): three unauthenticated service-role INSERT paths, missing Turnstile on `/growth/requests`, and the `500` on `/apps/:id/reviews`.
10. **Pre-existing base-state failures surfaced during verification**, unrelated to this change but blocking a clean gate: tenant-table registry drift, `packages/shared-types` not re-exporting `contact.ts`, `routes/themes.ts` over the 1500-line route limit, `custom-domains.ts:483` route-ownership, and the missing migration `129_internal_os_executive_analytics_rollups.sql`.

---

## 8. Evidence

- **Commit:** `ed6e5167567efcde01a349a2354d5e3591dad6e4` on `codex/emergency-appbridge-killswitch` (local only — not pushed).
- **Raw logs:** `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/appbridge-urgent/killswitch-raw/`
  - `ks-final.log` — the passing 17-test gateway run (exit 0)
  - `ks-falsify.log` — the gate-disabled run proving 83/83 reachability returns (exit 1)
  - `ui-ks.log` — the passing 5-test merchant UI run (exit 0)
  - `appbridge-existing.log` — the pre-existing App Bridge suite, 6/6 (exit 0)
  - `gateway-suite.log` — full gateway unit suite, 559/562
  - `behavioral.log` — root behavioural glob, 1521/1566
  - `tsc-gateway.log`, `gov.log` — pre-existing typecheck / governance-gate state
  - `commit-ed6e5167.patch`, `commit-ed6e5167.stat` — the exact change
- **Upstream:** `docs/launch/web-v1-wave-0-2026-08-09/28_APPBRIDGE_URGENT_REACHABILITY_VERDICT.md` and `raw-evidence/appbridge-urgent/probe-raw/`.

---
---

# PART II — Adversarial round: three real bypasses, reproduced and closed

**Final HEAD:** `30fd96b57d0b41b5191fdbaf5254f3cd3313fe73` on `codex/emergency-appbridge-killswitch` (local only — **not pushed**, no PR, not deployed).

---

## 9. The bypasses: raised, independently reproduced, real

Three independent skeptics were run against commit `ed6e5167` on separate angles (route-mount, config/precedence, UI+proxy). **All three returned `bypass_found: true` and `claim_survives: false`, converging on the same root cause from different directions.** Each finding was then re-verified here from scratch before any code was changed — not accepted on report.

### 9.1 Root cause (one sentence)

The gate was drawn on **URL prefixes**. The frozen app platform is defined by **data** (`marketplace_apps`, `app_installations`, `app_extensions`, `app_extension_registrations`, `app_developers`, `app_billing_charges`, `partner_payout_ledger_entries`, `payout_disputes`, `marketplace_review_records`), and that data is read from three seams that live under *other* prefixes. A prefix perimeter is structurally incapable of seeing them.

### 9.2 SEAM 1 — public, unauthenticated, verbatim `[env.production.vars]`

| | |
|---|---|
| **Request** | `GET /v1/storefront/{subdomain}` (also `GET /v1/storefront/store/{storeId}` and `GET /v1/storefront/{subdomain}/theme-preview`) |
| **Config** | `services/api-gateway/wrangler.toml` `[env.production.vars]` verbatim; `FEATURE_APP_PLATFORM` **absent** |
| **Observed at `ed6e5167`** | `200 OK`, `data.app_blocks` populated with a third-party block: `"render_mode":"iframe"`, `"iframe_url":"https://evil-third-party.example.com/block"` |
| **Tables actually queried** | `worker_request_logs, sites, theme_releases, **app_extension_registrations**, **app_installations**` |
| **Chain** | `index.ts:735` `api.route('/storefront', storefrontRouter)` (a third, ungated app-platform mount) → `routes/storefront/public-routes.ts:582` / `:347` / `:553` → `routes/storefront.ts:921` `loadPublicStorefrontAppBlocks` → `:936` `app_extension_registrations` (`surface='theme.app_block'`) and `:957` `app_installations → marketplace_apps → app_extensions` |
| **Why it matters beyond disclosure** | `apps/storefront-runtime/src/lib/store-service.ts:666-669` injects these into rendered sections and `.../theme-engine/composition-engine.tsx:115-118` emits `<iframe src="${block.iframe_url}" sandbox="allow-forms allow-popups allow-scripts allow-same-origin">`. `allow-scripts` + `allow-same-origin` together is an escapable sandbox, so third-party marketplace code still executes on the live storefront. |

**Reproduced here** (in-process against the real `services/api-gateway/src/index.ts` default export, offline, `egress: []`) before any fix — output archived in `raw-evidence/appbridge-urgent/31_bypass_reproduction_and_closure.txt`.

### 9.3 SEAM 2 — public, unauthenticated, `[vars]` and `[env.staging.vars]`

| | |
|---|---|
| **Request** | `GET /v1/storefront/{subdomain}/checkout/extensions` |
| **Config** | `[env.staging.vars]` verbatim (`wrangler.toml:131` `FEATURE_EXTENSIONS = "true"`); `FEATURE_APP_PLATFORM` **absent** |
| **Observed at `ed6e5167`** | `200 OK` returning `app_extension_registrations` rows with `source_url: https://evil-third-party.example.com/checkout-ext.js`, `renderer`, `scopes`, `capabilities`, `settings` |
| **Chain** | `index.ts:717` `api.use('/storefront/:subdomain/checkout/extensions', extensionsFeatureGate)` — the **only** gate — → `routes/storefront/public-routes.ts:391-421` |
| **The sting** | That single gate is `featureGate('FEATURE_EXTENSIONS', …)`, whose unset branch at `middleware/featureFlags.ts:25` is `return !isProductionRuntime(env)` — **the exact fail-OPEN defect the kill switch was written to close.** The flag is `"true"` in the top-level `[vars]` block (the no-`--env` deploy shape) and in `[env.staging.vars]`. |
| **Control** | Same request under `[env.production.vars]` (`FEATURE_EXTENSIONS = "false"`) returned `404 EXTENSIONS_DISABLED` — proving reachability was governed by `FEATURE_EXTENSIONS` and **never** by `FEATURE_APP_PLATFORM`. Part I §7 item 4 explicitly deferred this route; that deferral was the hole. |

### 9.4 SEAM 3 — the marketplace/developer operator plane

| | |
|---|---|
| **Mounts** | `index.ts:832` `api.route('/operations/marketplace-reviews', …)`, `index.ts:833` `api.route('/operations/developers', …)` — neither covered by `index.ts:723-726` |
| **Observed at `ed6e5167`** | `401 UNAUTHORIZED` (i.e. **live and ungated**, reachable to any staff session with the RBAC permission) vs the control `/v1/app-store/categories` → `404 APP_PLATFORM_DISABLED` |
| **Still-working actions** | `POST /v1/operations/marketplace-reviews/{id}/decision` (`marketplace-reviews.ts:684` → `:208-224` `db.from('marketplace_apps').update({ status: … })`) — **a third-party app could still be APPROVED and PUBLISHED into the catalog while the catalog itself 404s**. `POST /v1/operations/developers/{id}/payouts/{payoutId}/release` (`developers.ts:308`, writes `partner_payout_ledger_entries`) — app revenue share, named in the kill switch's own in-scope docblock. Also `/{id}/moderation` (`developers.ts:164`) and `/{id}/reconciliation/run` (`:393`). |
| **Driven by a live, unflagged UI** | `apps/platform-console/src/app/(dashboard)/layout.tsx:36,40` nav entries → `marketplace-governance/page.tsx:35` and `developers/page.tsx:139,165`. `platform-console` is a production deploy target (`production-deploy.yml:408`). Component B guarded `merchant-control-plane` only. |
| **Calibration (stated honestly)** | This is a **scope** gap, not an auth bypass: it needs a platform-console staff session plus `review:decide` / `developer:manage`. It does **not** re-open App Bridge, embed-session, `bridge/fetch`, app OAuth2, or install. |

### 9.5 A fourth item found while fixing: app-platform EGRESS from ungated routes

`dispatchStoreAppComplianceWebhook` (`routes/app-store/compliance-routes.ts:55`) is called from **outside** the perimeter — `routes/admin.ts:148` (`DELETE /v1/admin/stores/:id` → `shop/redact`) and `routes/customers.ts:1313` (`customers/redact`). With the platform frozen it could still deliver signed payloads to third-party app endpoints. Not reachability, but app-platform behaviour surviving the gate.

### 9.6 What the skeptics tried and could NOT break (recorded as verified)

These are positive results and should not be re-litigated:

- **Path normalisation is not a bypass.** Exact prefix, trailing slash, double slash, percent-encoded segments (`%63`, `%2D`, `%61`), dot segments (`/v1/./app-store/…`, `/v1/foo/../app-store/…`), query strings and all named danger routes → `404 APP_PLATFORM_DISABLED`. The variants that *escape* the middleware (`/v1//app-store/…`, `/v1/APP-STORE/…`, `/v1/app-store%2fcategories`) **match no handler**, proven twice: once with `FEATURE_APP_PLATFORM=true` (still 401, i.e. never reaches a handler) and once in an isolated Hono replica with auth removed (`handlerReached=false`). The gate's coverage gap and Hono's routing gap are the **same** gap, so it is not exploitable. **I re-ran this decisively for the newly gated prefixes too** — see §10.4.
- **No proxy seam in `merchant-control-plane`.** All 129 `src/app/api/**/route.ts` handlers enumerated: none reference `app-store`, `installations`, `embed-session` or `bridge/fetch`. No `src/middleware.ts`, no `rewrites()` in `next.config.ts`.
- **The merchant UI guards are genuine server-side guards**, first statement of an async RSC page, before `await params` and before `createMerchantApiClient()`. Pages are dynamic (no `generateStaticParams`, `cookies()` via `getSessionUser`), so there is no prerendered copy to serve.
- **A previously minted app token has no surviving data plane.** `grep app_token|appToken|app_access_token|installation_id` across `services/api-gateway/src/middleware/*.ts` → zero hits; no gateway middleware accepts an app-scoped bearer on general merchant routes.
- **`mobile-bff` is not a bypass.** `ALLOWED_PREFIXES` does list `/v1/app-store` and `/v1/app`, but forwarding is via `env.API_GATEWAY_SERVICE.fetch`, so the gateway gate fires. Component C's omission is confirmed harmless.
- **The GraphQL admin REST shim re-enters the chain** (`index.ts:691`, `:767` use `app.fetch(request, c.env)`), so `graphql/admin.ts:375-376` correctly returns the `APP_PLATFORM_DISABLED` envelope.
- **The flag parser itself is sound.** ~25 string shapes exercised; `""`, `"   "`, `"false"`, `"0"`, `"01"`, `"off"`, `"no"`, `"maybe"`, `"truthy"`, `"tru"`, `"true1"`, `"enable"`, `"y"`, absent → all denied. Non-string TOML shapes (`= true`, `= 1`, array, inline table) throw at `?.trim()` and `app.onError` converts that to 500 — still denied, loudly rather than cleanly.
- **The merchant admin App Bridge embed is genuinely dead** (3 pages + `bridge/fetch` + `embed-session`).

### 9.7 One test-coverage nit inherited from Part I (not a reachability gap)

`app-platform-killswitch.test.ts:157` does `if (route.method === 'ALL') continue;`, so `router.all()` / `router.on()` routes are excluded from the 83-route enumeration. The prefix perimeter still covers them, so unreachability is unaffected — the enumeration simply under-counts. Recorded, not fixed.

---

## 10. The fix — commit `30fd96b5`

**8 files, 0 deletions.** Still no repair, extension or refactor of any marketplace implementation; nothing under `routes/app-store*` or `app-api.ts` changed except the one egress guard in §10.1(d).

### 10.1 Gateway

| # | File | Change |
|---|---|---|
| a | `services/api-gateway/src/routes/storefront.ts` | +1 import; **+1 guard as the first statement of `loadPublicStorefrontAppBlocks`**: `if (!isAppPlatformEnabled(c.env)) return [];`. Gated at the **data reader**, so all three public callers inherit it and **no app-platform table is queried at all**. |
| b | `services/api-gateway/src/index.ts` | `api.use('/storefront/:subdomain/checkout/extensions', appPlatformKillSwitch)` registered **before** the existing `extensionsFeatureGate` line, so the app platform — not the fail-open `FEATURE_EXTENSIONS` — owns that route. |
| c | `services/api-gateway/src/index.ts` | Four registrations for `/operations/marketplace-reviews`, `/operations/marketplace-reviews/*`, `/operations/developers`, `/operations/developers/*`, placed **ahead of the global auth middleware** (`index.ts:779`) so the surface returns a uniform hard `404` to every caller instead of leaking its existence via a `401`, and a blocked request performs no auth work. No other router owns either prefix (verified by enumerating every route in `routes/operations.ts` and `routes/operations/incident-command.ts`). |
| d | `services/api-gateway/src/routes/app-store/compliance-routes.ts` | +1 import; +1 guard that short-circuits **before** `dispatchAppLifecycleSubscriptions`. **The GDPR data-subject record is still written** — only the outbound third-party delivery is suppressed. |

`services/api-gateway/wrangler.toml`, `production-deploy.yml` and `staging-deploy.yml` remain **untouched**. `FEATURE_APP_PLATFORM` is still declared nowhere; absence is the off state. `FEATURE_EXTENSIONS` and `middleware/featureFlags.ts` are still byte-for-byte unchanged.

### 10.2 platform-console UI (extends Component B)

| File | Change |
|---|---|
| `apps/platform-console/src/lib/app-platform-flag.ts` | **NEW.** Executable-semantics mirror of the merchant flag (a test asserts the two are byte-identical after comment/whitespace stripping — divergence is how a fail-open branch returns). |
| `apps/platform-console/src/app/(dashboard)/marketplace-governance/page.tsx` | +1 `notFound` import, +1 flag import, +1 first-statement guard. |
| `apps/platform-console/src/app/(dashboard)/developers/page.tsx` | Same. |

### 10.3 Tests

| File | Change |
|---|---|
| `services/api-gateway/src/__tests__/app-platform-seam-killswitch.test.ts` | **NEW — 29 tests.** Auto-globbed by `test:unit`. |
| `tests/app-platform/app-platform-killswitch-ui.test.mjs` | **+2 tests** (5 → 7): the two platform-console pages, and the flag-parity assertion. |

The new suite runs SEAM 1 / SEAM 2 / SEAM 3 across **seven** fail-closed env shapes each — developer, verbatim top-level `[vars]`, verbatim `[env.staging.vars]`, verbatim `[env.production.vars]`, and `"false"` / `""` / `"maybe"` — plus a positive control, a no-collateral-damage test over seven sibling `/v1/operations/*` routes and a non-segment prefix collision, three structural guards, a **drift guard**, and a zero-egress assertion.

**The drift guard is the durable control that was missing.** It live-scans every `.ts` file under `services/api-gateway/src` for a read of any of the ten app-platform tables and asserts each such file is either inside the gated mounts or explicitly listed **with its gate named**. A new ungated reader — the exact class of defect that produced these bypasses — fails the build. Part I §7 item 7 called for this; it now exists behind the suite (a 107-gate validator is still the stronger form, see §13).

### 10.4 Decisive re-check of the new prefixes

I did **not** assume the skeptics' path-variant conclusion transferred. Twenty-one variants were driven against the real gateway on the new prefixes, then every escaping variant was re-run in an isolated Hono replica with auth removed to answer the only question that matters — *does it reach a handler?*

```
GATED                       /v1/operations/marketplace-reviews          404 GATED
GATED                       /v1/operations/marketplace-reviews/         404 GATED
GATED                       /v1/operations/marketplace-reviews/abc      404 GATED
GATED                       /v1/operations/%6darketplace-reviews        404 GATED
GATED                       /v1/operations/risk/../marketplace-reviews  404 GATED
GATED                       /v1/operations/developers/search            404 GATED
GATED                       /v1/operations/%64evelopers/search          404 GATED
GATED                       /v1/storefront/demo/checkout/extensions     404 GATED
GATED                       /v1/storefront/demo/checkout/./extensions   404 GATED
GATED                       /v1/storefront/DEMO/checkout/extensions     404 GATED
GATED                       /v1/storefront/demo/checkout/%65xtensions   404 GATED
escaped, no handler (404)   /v1/operations/MARKETPLACE-REVIEWS          404 Not Found
escaped, no handler (404)   /v1//operations/marketplace-reviews         404 Not Found
escaped, no handler (404)   /v1/operations/marketplace-reviews%2fabc    404 Not Found
escaped, no handler (404)   /v1/operations/DEVELOPERS/search            404 Not Found
escaped, no handler (404)   /v1/storefront/demo/checkout/extensions/    404 Not Found
escaped, no handler (404)   /v1/storefront/demo/CHECKOUT/extensions     404 Not Found
escaped, no handler (404)   /v1/storefront/demo/checkout%2fextensions   404 Not Found
```

**Every variant that escapes the gate matches no handler.** Same conclusion as for the original prefixes, independently established.

---

## 11. Final test results — real commands, real exit codes

All commands run from the isolated worktree, **offline**. Raw output: `raw-evidence/appbridge-urgent/30_final_test_results.txt`.

| Command | Result | **Real exit** |
|---|---|---|
| `tsx --test services/api-gateway/src/__tests__/app-platform-seam-killswitch.test.ts` | **tests 29 · pass 29 · fail 0** | **0** |
| `tsx --test services/api-gateway/src/__tests__/app-platform-killswitch.test.ts` | **tests 17 · pass 17 · fail 0** | **0** |
| `node --test tests/app-platform/app-platform-killswitch-ui.test.mjs` | **tests 7 · pass 7 · fail 0** | **0** |
| `node --test tests/app-platform/app-bridge.test.mjs` (pre-existing contract suite) | **tests 6 · pass 6 · fail 0 — unchanged** | **0** |

### 11.1 Falsification — the new tests genuinely detect an absent gate

All four seam fixes were temporarily neutralised (the storefront data guard, the checkout-extensions registration, the four operator registrations, the egress guard), the suite re-run, then **restored verbatim from a pre-falsification byte copy**; `grep -rn FALSIFICATION` over `src/` and `apps/` afterwards returns nothing.

```
tests 29 | pass 4 | fail 25 | EXIT=1
  SEAM 1 ×7 FAILED — "GET /v1/storefront/demo LEAKED third-party marketplace app blocks under …"
  SEAM 2 ×8 FAILED — "the APP PLATFORM (not FEATURE_EXTENSIONS) must own this route"
  SEAM 3 ×7 FAILED — "11/11 operator-plane app-platform routes were REACHABLE under …"
  + 3 structural guards FAILED (registration order, data-seam guard, egress guard)
```

The 4 still-passing tests are the positive control, no-collateral-damage, drift guard and zero-egress — **none of which assert the gate**, which is exactly right.

### 11.2 Regression baseline — no new failures

| Command | Result | Real exit |
|---|---|---|
| `tsx --test services/api-gateway/src/__tests__/*.test.ts` | **591 tests, 588 pass, 3 fail** — the *same three* pre-existing failures as at base `ee371182` (`ai.test.ts`, `internal-os-executive-analytics.test.ts` `ENOENT` on migration 129, `payments.test.ts`), none in a file this change touches | 1 |
| `node --test --test-concurrency=1 tests/*/*.test.mjs` | **1568 tests, 1523 pass, 30 fail, 15 skipped.** Base was 1566/1521/**30**/15 — **the fail count is unchanged**; +2 tests/+2 passes are the new platform-console assertions. 22 of the 30 need a local Postgres deliberately not started; 8 are pre-existing drift. **Zero failures reference app-platform.** | 1 |
| `tsc --noEmit` in `services/api-gateway` | **20 errors, all pre-existing**, all in `src/lib/contact-request-email.ts` + `src/routes/contact-public.ts` (`packages/shared-types` does not re-export `contact.ts` at base). `grep -ci app-platform` on the error log = **0**. | 2 |
| `node scripts/validate-governance.mjs` | Anti-fabrication gate passes (1907 files), then **fails fast at the same pre-existing** tenant-table-registry drift. Neither the registry nor any migration is touched here. | 1 |
| 20 individually-run validators | **17 pass**, incl. `architecture-validator`, `import-validator`, `circular-import-validator`, `marketplace-single-source-validator`, `settings-apps-dead-twin-validator`, `frozen-path-override-gate`, `wrangler-env-validator`, `cloudflare-environment-validator`, `env-isolation-validator`, `fail-closed-internal-routes-validator`, `storefront-access-gate-validator`, `one-system-per-domain-validator`, `dead-residue-validator`, `typescript-dead-source-validator`, `no-blanket-service-role-validator`, `app-utils-service-role-edge-validator`, `no-rejected-package-imports-validator`. **3 fail, all pre-existing**: `route-ownership` (`custom-domains.ts:483`), `route-line-count` (`themes.ts` 1870 lines), `domain-boundary` (`theme.schema.ts`, `marketing-site`, two `platform-console` **founding** routes, an inventory count of 188 vs an expected 129). **None name any file in this commit.** | mixed |

### 11.3 The one real regression I caused, and fixed

The first draft of the operator-gate comment contained the literal string `api.use('/*', authMiddleware)`. `founding.test.ts:32` locates that registration with `String.indexOf`, so my **comment** was matched instead of the real line and `"public founding routes mount BEFORE the auth middleware"` failed (4 failures instead of 3). The comment was reworded; the suite returned to the exact base failure set. Recorded because it is the same class of defect the Part I registration-order guard was written to prevent — a comment satisfying a source-level assertion.

### 11.4 The skeptics' own probes, re-run against the fix

| Probe assertion at `ed6e5167` | At `30fd96b5` |
|---|---|
| `/v1/storefront/demo` (production) leaks `app_blocks` with `iframe_url` | **`app_blocks: []`**; tables queried are now `worker_request_logs, sites, theme_releases` — `app_installations` and `app_extension_registrations` are **no longer touched at all** |
| `/v1/storefront/demo/checkout/extensions` (staging) returns 200 with `source_url` | **`404 APP_PLATFORM_DISABLED`**; zero app-platform tables queried |
| "path B is governed by `FEATURE_EXTENSIONS`, not `FEATURE_APP_PLATFORM`" | **assertion now fails** — i.e. the config-dependence is gone |
| `/v1/operations/marketplace-reviews` returns `401` (live) | **`404 APP_PLATFORM_DISABLED`** |
| `egress attempts: []` | **`[]`** — still zero |

---

## 12. Final proven / NOT proven

### 12.1 Proven (locally, offline, with observed output)

1. All **83** `/v1/app-store` + `/v1/app` routes are `404 APP_PLATFORM_DISABLED` in the developer, verbatim-staging and verbatim-production shapes (unchanged from Part I).
2. **SEAM 1:** `GET /v1/storefront/:subdomain` and `/v1/storefront/store/:storeId` return `200` with `app_blocks: []` and query **zero** app-platform tables, in all seven fail-closed shapes. The public storefront contract is preserved — only the app blocks are emptied.
3. **SEAM 2:** `/v1/storefront/:subdomain/checkout/extensions` is `404 APP_PLATFORM_DISABLED` in all seven shapes **including the staging shape where `FEATURE_EXTENSIONS="true"`**, with a dedicated regression witness pinning that case.
4. **SEAM 3:** all 11 enumerated marketplace-review and developer operator routes — including `POST …/decision` (publishes an app) and `POST …/payouts/{id}/release` — are `404 APP_PLATFORM_DISABLED` in all seven shapes, to **every** caller including an authenticated one.
5. **Egress:** the compliance dispatcher cannot deliver `shop/redact` / `customers/redact` to a third-party app endpoint while the platform is frozen; the GDPR record is still written.
6. **The 404s are the gate**, not a broken mount: an explicit opt-in (`1`/`true`/`on`/`enabled`/`yes`) re-opens all three seams — app blocks repopulate, checkout extensions stop being `APP_PLATFORM_DISABLED`, and the operator plane falls through to its own `401`.
7. **No collateral damage:** the storefront payload still loads its site row and stays `200`; `/v1/operations/{runtime,oncall,postmortems,rbac,risk,support,trust-safety}/…` and a `developers-not-a-route` non-segment collision are untouched.
8. **Path variants cannot desynchronise the new perimeter** — every escaping variant matches no handler (§10.4).
9. **A drift guard now fails the build** on any new ungated app-platform table reader.
10. **Zero network egress** across every suite, asserted in-test.
11. **Nothing removed, repaired or extended.** Both commits are insertions only; `FEATURE_EXTENSIONS` and `featureFlags.ts` are byte-for-byte unchanged.

### 12.2 NOT proven — stated plainly, do not report these as proven

1. **No Next.js app was compiled.** Neither `apps/merchant-control-plane` nor `apps/platform-console` was typechecked or built: the worktree has no `node_modules` for either app and installing needs registry network access the mandate excludes. (Running the root `tsc` against an app tsconfig produced ~7,500 "Cannot find module 'react'/'next'/'@letbuyy/ui'" errors — an environment artefact, not a signal.) **Component B is proven by executed flag semantics (`node:vm`) plus source-level guard-ordering assertions, not by a compile.** `pnpm --filter @letbuyy/merchant-control-plane build` **and** `pnpm --filter @letbuyy/platform-console build` must run before the UI half ships. Risk is low — five one-line guards plus imports using each app's existing `@/lib/*` alias and `next/navigation` — but it is **unverified**.
2. **No real `workerd` runtime.** The harness drives the same `app.fetch` entry point Cloudflare invokes (the same method doc 28's probes used), but no `wrangler dev` process was started.
3. **The full 107-validator gate is not green.** `validate-governance.mjs` fails fast at a pre-existing tenant-registry drift, so validators after it are unreachable through the runner; 20 relevant ones were run individually instead (17 pass, 3 pre-existing fails in untouched files).
4. **Live staging/production environment variable values were never accessed — deliberately, by design.** Every env shape in every test is reconstructed **verbatim from `services/api-gateway/wrangler.toml` at base `ee371182`**, not from deployed Cloudflare vars or secrets. No Cloudflare, Supabase, Vercel, Razorpay, Resend, Turnstile or GitHub API was queried. This does not weaken the result — the gate denies on anything other than an explicit positive value, so an unknown deployed override can only be irrelevant (absent) or a deliberate opt-in — but **a human must confirm the actual live values** (§13).
5. **No edge/WAF layer was probed.** A hypothetical edge rule is not a repository control and is not fail-closed by construction.
6. **`app_extension_registrations` reads under the internal perimeter and the queue** were **not** gated (§12.3 item 3) — reachability is unchanged from base, but they are app-platform code that still runs.

### 12.3 Residual risk (accepted, documented)

1. **`routes/internal-console.ts:1028`** (`app_installations`) and **`execution/queue-execution.adapter.ts`** (`marketplace_apps`, `app_developers`, `partner_payout_ledger_entries`) still read app-platform data. Both sit behind the internal perimeter (`INTERNAL_API_SECRET`) or an HMAC-signed queue envelope and are **not customer-reachable**; gating them risks breaking unrelated internal/queue paths. They are named in the drift guard's allowlist so they cannot be forgotten. **Referred to ARB.**
2. **`middleware/rbac.ts`** resolves developer identity from `app_developers` for the now-gated operator plane. Harmless behind the gate; not touched.
3. **Static assets still served:** `apps/merchant-control-plane/public/letbuyy-app-bridge.js` and `public/example-app-bridge.html` are Next.js `/public` files and remain fetchable. They are **inert** without a live gateway (every endpoint they call is now 404), but the SDK and a working demo host page are still downloadable. Deleting them is *removal* ⇒ Wave 1 + ARB.
4. **Cosmetic residue:** nav entries (`merchantNavigation.ts:42-47,60,171,371-376`, `settings-navigation.ts:158-167`, `products/page.tsx:429`, `platform-console` `(dashboard)/layout.tsx:36,40`) and the "Browse marketplace → apps.letbuyy.com" CTA now link to 404s.
5. **Rollout blast radius (ARB owns sequencing, not this document):** deploying this makes 17 currently-unauthenticated public endpoints, the OAuth2 token flow, the App Bridge embed, the public storefront app blocks, the public checkout-extension registry, and the marketplace/developer operator plane all return 404 or empty. Any third-party or internal client depending on them breaks. **That is the intent.**
6. **Known defects left unfixed by design** (fixing them would deepen the ART-22 violation by investing in a frozen seam; all are moot behind the gate): three unauthenticated service-role INSERT paths, missing Turnstile on `/growth/requests`, the `500` on `/apps/:id/reviews`, and the `ALL`-method enumeration gap in §9.7.
7. **Pre-existing base-state failures** blocking a clean gate, unrelated to this change: tenant-table registry drift; `packages/shared-types` not re-exporting `contact.ts`; `routes/themes.ts` over the 1500-line limit; `custom-domains.ts:483` route-ownership; missing migration `129_internal_os_executive_analytics_rollups.sql`; `domain-boundary` app-local API inventory 188 vs expected 129.

---

## 13. What requires HUMAN / ARB action

**This task deliberately stopped at a locally-proven, unpushed commit. The following are not mine to do.**

1. **Confirm the actual live environment values in staging and production — NOT DONE HERE, BY DESIGN.** No deployed Cloudflare var or secret was read. A human must confirm that `FEATURE_APP_PLATFORM` is genuinely absent (or not positive) in the real `letbuyy-api-gateway` staging and production Worker configs, and in the `merchant-control-plane` and `platform-console` deploy environments. The repository guarantees only that *the repository* declares it nowhere.
2. **Compile the two Next.js apps** before the UI half ships (§12.2 item 1) — `pnpm --filter @letbuyy/merchant-control-plane build` and `pnpm --filter @letbuyy/platform-console build`.
3. **Decide the rollout** — push, PR, review, merge lane, deploy order, and the communication to anyone consuming the 17 public marketplace endpoints (§12.3 item 5). Nothing has been pushed; `origin/codex/emergency-appbridge-killswitch` does not exist.
4. **Permanent removal — Wave 1, ARB-gated under `AGENTS.md` §16.5 (AGENT-LEGACY).** This commit is a *reversible gate*, not a removal: one environment variable re-opens everything. Removal means deleting the ~9,566 lines under `routes/app-store*` + `app-api.ts`, the mounts, the merchant and console UI pages, `components/apps/EmbeddedAppBridgeClient.tsx`, the shipped `public/letbuyy-app-bridge.js` + `public/example-app-bridge.html`, `apps/mobile/merchant-app/lib/services/app_marketplace_service.dart`, and eventually the `app_*` tables and their migrations. **Out of scope here and correctly so.**
5. **Promote the drift guard into the 107-validator gate.** §10.3 gives a behavioural guard inside a test suite. A deterministic validator (`scripts/validators/app-platform-seam-gated-validator.mjs`) asserting that every read of the ten app-platform tables is behind `isAppPlatformEnabled` or a gated mount is the durable control — nothing covered this, which is why the original violation went unnoticed for so long.
6. **Fix `featureFlags.ts:25`.** The `!isProductionRuntime(env)` unset-flag default is fail-OPEN and is shared with `FEATURE_GRAPHQL` and `FEATURE_LIQUID`. This change routes *around* it rather than fixing it. Cross-cutting; needs its own blast-radius review.
7. **Decide on the residual internal/queue readers** (§12.3 item 1) and on **narrowing `services/mobile-bff` `ALLOWED_PREFIXES`** (two pure deletions; not required, since the gateway 404s through the service binding).
8. **Clear the pre-existing base-state failures** (§12.3 item 7) — none are caused by this change, but the gate cannot be green until they are fixed.

---

## 14. Evidence index (Part II)

- **Final HEAD:** `30fd96b57d0b41b5191fdbaf5254f3cd3313fe73` — local only, **not pushed**, no PR, not deployed. Working tree clean apart from three untracked skeptic probe directories (`tmp-appbridge-probe/`, `tmp-appbridge-mount-probe/`, `tmp-probe-cfg-bypass/`), none wired into any test script.
- **Cumulative diff vs base `ee371182`:** 14 files, **1,356 insertions, 0 deletions.**
- `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/appbridge-urgent/`
  - `30_final_test_results.txt` — the four proving suites with real exit codes
  - `31_bypass_reproduction_and_closure.txt` — each bypass before → after, plus the decisive handler-reachability matrix
  - `32_falsification_and_regression.txt` — the falsification run and the full regression baseline
  - (Part I artefacts under `killswitch-raw/` and `probe-raw/` are unchanged.)

### 14.1 Safety attestation (Part II)

No production or staging URL, Supabase project, Cloudflare, Razorpay, Resend, Vercel or GitHub API was contacted. No `supabase db` or `wrangler` command was run. No `pnpm install`. Nothing pushed; no PR; no `git reset --hard`, `git clean`, `git stash`, `git checkout --`, force push or history rewrite. Falsification edits were restored from a byte-exact copy, not by any git-revert command. Every test replaces `globalThis.fetch` before any application import and asserts the egress list is empty. The production-linked repository received only this document and the three evidence files above. **No secret value appears anywhere — only the variable NAME `FEATURE_APP_PLATFORM`, which is deliberately declared in no config file.**
