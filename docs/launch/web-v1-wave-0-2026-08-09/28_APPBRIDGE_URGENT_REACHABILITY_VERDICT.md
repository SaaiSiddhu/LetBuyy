# 28 — App Bridge / app-store URGENT reachability: adjudicated verdict

**Date:** 2026-08-09
**Wave:** Web V1 — Wave 0, urgent out-of-band adjudication
**Role:** Adjudicator over three independent lenses
**Baseline commit:** `ee3711829d857e986014c5811bb94d86ebc3d343`
**Isolated worktree for code change:** `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/emergency-appbridge-killswitch` (branch `codex/emergency-appbridge-killswitch`)

---

## 0. Safety attestation for THIS adjudication

- **Zero network.** No request was made to `letbuyy.com`, `apps.letbuyy.com`, `api.letbuyy.com`, Supabase Cloud, Cloudflare, Razorpay, Resend, Turnstile, or any other host. All work was `Read` / `grep` / `sed` over local files, plus `python3` over the JSON that Lens 3 had already produced offline.
- **No provider or deploy command.** No `supabase` CLI, no `wrangler`, no `git push`, no PR, no deploy, no `git reset --hard` / `clean` / `stash` / `checkout --`.
- **The production-linked repo was not modified** except this deliverable at
  `docs/launch/web-v1-wave-0-2026-08-09/28_APPBRIDGE_URGENT_REACHABILITY_VERDICT.md`.
- **No secret values read or printed.** Env var **names** only.
- **No code change was made in this adjudication.** The kill-switch design in §7 is a *specification*; implementation belongs in the isolated worktree.

---

## 1. Bottom line

> **The App Bridge / `/v1/app-store` / `/v1/app` / marketplace / embed-session / bridge-fetch surface is REACHABLE TODAY in ALL THREE config shapes — local, staging-shaped, and production-shaped.**
>
> This is not an inference. It is an **executed** result: in a **verbatim production-shaped environment** (`[env.production.vars]`, `FEATURE_EXTENSIONS = "false"`), **19 of 83 routes execute their handler for a caller with no credential of any kind** — nine of them returning `200 {"success":true,…}` — and **81 of 83 routes are unaffected by the only feature flag that exists.**
>
> **A KILL SWITCH IS REQUIRED.** Both independent trigger conditions in the mandate are met, twice over.

All three lenses returned **REACHABLE**. They agree on the verdict and on every load-bearing fact. Where their *framing* diverged, §3 adjudicates with re-read primary source.

**This adjudication also found one thing all three lenses missed** — a second, independent proxy entry point into the same capability from `services/mobile-bff`, itself a production deploy target. See §5.

---

## 2. Per-config-shape verdict table (decisive)

Evidence class: **EXECUTED** = observed HTTP status from Lens 3's in-process probe, re-verified by me against the raw JSON in `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/appbridge-urgent/probe-raw/`. **SOURCE** = read from primary source by me.

| Config shape | Verdict | Evidence class | Decisive evidence |
|---|---|---|---|
| **local** (`wrangler dev`, no `--env` → top-level `[vars]`, `wrangler.toml:31-40`, `FEATURE_EXTENSIONS="true"`) | **REACHABLE** | EXECUTED + SOURCE | Behaviourally identical to the staging shape (same vars block semantics). 9× `200 success:true` unauthenticated; `bridge/fetch` and `oauth/token` both `400 VALIDATION` (handler ran). Rate limiting is skipped entirely locally (`services/api-gateway/src/middleware/rateLimit.ts:53-56`). |
| **local (developer shape:** `ENVIRONMENT=APP_ENV=NODE_ENV=development`, flag unset**)** | **REACHABLE — and *more* reachable** | EXECUTED | `probe-raw/local.json`: extension routes → `401 UNAUTHORIZED` (i.e. **ENABLED**), *not* `404 EXTENSIONS_DISABLED`. This is the fail-open default branch firing. |
| **staging-shaped** (verbatim `[env.staging.vars]`, `wrangler.toml:122-131`, `FEATURE_EXTENSIONS="true"`; deployed by `.github/workflows/staging-deploy.yml:106-109` `wrangler deploy --env staging`) | **REACHABLE** | EXECUTED | `probe-raw/staging.json`: 83 routes → 9×200, 5×400, 60×401, 2×403, 4×404(record-not-found), 1×500. **Zero routes 404 as “disabled.”** The two extension routes are ENABLED. egress 0. |
| **production-shaped** (verbatim `[env.production.vars]`, `wrangler.toml:238-247`, `FEATURE_EXTENSIONS="false"`; deployed by `.github/workflows/production-deploy.yml:336-338` `wrangler deploy --env production`) | **REACHABLE** | EXECUTED | `probe-raw/production.json`: **9×200 unauthenticated**, **5×400 VALIDATION from the handler** (incl. `bridge/fetch` and `oauth/token`), 4×404 record-not-found, 1×500, 2×403 internal-secret, **60×401 from the routers' own `authMiddleware`** (reachable to any authenticated merchant). **Only 2 of 83 routes 404 as `EXTENSIONS_DISABLED`.** egress 0. |
| **Cloudflare edge / WAF in front of the Worker** | **UNDETERMINED** | — | Cannot be tested offline and must not be queried. No such rule exists in `services/api-gateway/wrangler.toml`. Stated plainly per the mandate; it does not change any verdict below, because a hypothetical edge rule is not a repository control and is not fail-closed by construction. |

### 2.1 The production-shaped rows that settle it

Re-verified by me from `probe-raw/production.json` (`FEATURE_EXTENSIONS = "false"`, `ENVIRONMENT/APP_ENV/NODE_ENV = "production"`, `egressCount: 0`):

**19 routes execute for a caller with no credential whatsoever:**

| Status | Route | Meaning |
|---|---|---|
| `200 SUCCESS` ×9 | `/v1/app-store/categories`, `/apps`, `/apps/:id`, `/categories/:slug/features`, `/collections`, `/featured`, `/partners`, `/growth/new-this-week`, `/growth/bundles` | Handler ran to a success envelope, anonymously |
| `400 VALIDATION` | **`POST /v1/app-store/oauth/token`** → `"grant_type must be authorization_code or refresh_token"` | **The live third-party OAuth2 token endpoint negotiating, in a production-shaped env** |
| `400 VALIDATION` | **`POST /v1/app-store/bridge/fetch`** → `"Only scoped GET bridge requests are supported"` | **The live App Bridge data proxy responding** |
| `400 VALIDATION` ×3 | `/discovery/events`, `/telemetry/events`, `/growth/requests` | Unauth service-role write paths, handler-validated only |
| `404 NOT_FOUND` ×4 | `/collections/:slug`, `/apps/:id/recommendations`, `/review-policies/:slug`, `/developers/:id` | **Record**-not-found from the handler, *not* route-not-mounted |
| `500` ×1 | `/apps/:id/reviews` | Handler ran; stub-DB artifact |

**The only two routes that the existing flag disables:**

| Route | staging | production |
|---|---|---|
| `GET /v1/app-store/installations/:id/extensions` | `401` (reachable) | `404 EXTENSIONS_DISABLED` |
| `PATCH /v1/app-store/installations/:id/extensions/:registrationId` | `401` (reachable) | `404 EXTENSIONS_DISABLED` |

**2 of 83 = 2.4 % coverage.** Everything else — install/uninstall, the full OAuth2 authorization-code flow, `embed-session`, `bridge/fetch`, `functions/:registrationId`, the app billing / revenue-share engine, the developer platform, and the entire `/v1/app` third-party data API — is untouched by the flag in every environment.

**Reachability of the 401 rows is real, not phantom.** Lens 3's isolated-router control (`probe-raw/isolated.json`) shows a synthetic unmounted path returning a bare `404 Not Found` while `POST /app-store/installations/:id/embed-session` still returns `401 UNAUTHORIZED` **from its own router-level `authMiddleware`** with no global auth wall present. I re-verified both rows. So `embed-session`, `apps/:id/install`, the charge endpoints, and all four `/v1/app/*` routes are mounted, executing, and available to any authenticated merchant session in production.

---

## 3. Reconciliation — where the lenses diverged, and who was right

All three verdicts were **REACHABLE**. There were no verdict-level disagreements. Five framing/counting divergences needed primary-source adjudication.

### 3.1 “FEATURE_EXTENSIONS defaults to ENABLED outside production” — is the default fail-open or not?

- **Briefing + Lens 2:** the flag mechanism is **fail-open** (unset ⇒ enabled unless a production marker is present).
- **Lens 1:** the fallback is *“effectively dead code”* — because `wrangler.toml` sets `NODE_ENV = "production"` in the top-level block (`:34`) **and** the staging block (`:125`), an unset flag would resolve **DISABLED** even on staging; the explicit `"true"` is what keeps extensions on.
- **Lens 3:** agreed with Lens 1's nuance and tested it.

**Adjudication — BOTH are right about different halves, and the executable matrix settles the exact boundary.** Re-read primary source, `services/api-gateway/src/middleware/featureFlags.ts:13-26`:

```ts
function isProductionRuntime(env) {                       // :13-17
    return [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV]
        .filter((v) => typeof v === 'string')
        .some((v) => v.toLowerCase() === 'production');
}
export function isGatewayFeatureEnabled(env, flag) {      // :19-26
    const value = normalizedFlagValue(env[flag]);
    if (value) return ['1','true','on','enabled','yes'].includes(value);
    return !isProductionRuntime(env);                     // :25  ← fail-OPEN default
}
```

Re-verified `wrangler.toml`: `NODE_ENV = "production"` at `:34` (top-level `[vars]`) and `:125` (`[env.staging.vars]`) — **Lens 1's reading is factually correct.** And the executed evidence, which I re-ran over the raw JSON:

| Probe shape | `ENVIRONMENT` | `FEATURE_EXTENSIONS` | `GET …/installations/:id/extensions` |
|---|---|---|---|
| `probe-raw/local.json` | `development` (no production marker anywhere) | **unset** | **`401 UNAUTHORIZED` → ENABLED** |
| `probe-raw/staging-noflag.json` | `staging` (but `NODE_ENV=production`) | **unset** | `404 EXTENSIONS_DISABLED` |
| `probe-raw/staging.json` | `staging` | `"true"` | `401` → ENABLED |
| `probe-raw/production.json` | `production` | `"false"` | `404 EXTENSIONS_DISABLED` |

**Verdict:** **Lens 1 is right** that the fallback is not what keeps extensions on in the committed staging config — the explicit `FEATURE_EXTENSIONS = "true"` at `wrangler.toml:40` and `:131` is. **Lens 2 (and the briefing) are right** that the mechanism itself is fail-open: `probe-raw/local.json` is executed proof that on any runtime with no `production` marker, an **absent** flag resolves **ENABLED**. Lens 1's phrase “effectively dead code” overstates it: the branch is live and reachable — it fires on a developer machine, in any CI or preview runtime that does not set one of the three markers, and in any future env block that omits `NODE_ENV`.

**Consequence for the mandate, either way:** the second trigger condition (“production-shape safety depends only on a flag that defaults to enabled elsewhere”) is satisfied for the 2 gated routes; and it is *moot* for the other 81, whose production safety depends on **nothing at all**.

### 3.2 “~3 sub-routes are gated” (prior audit) vs 2 (Lens 1/2/3)

**Adjudication: the lenses are right; the prior audit was counting `api.use` lines.** Re-read `services/api-gateway/src/index.ts:714-716`:

```
714: api.use('/storefront/:subdomain/checkout/extensions', extensionsFeatureGate);
715: api.use('/app-store/installations/:id/extensions',     extensionsFeatureGate);
716: api.use('/app-store/installations/:id/extensions/:registrationId', extensionsFeatureGate);
```

Three `api.use` registrations; **two** are `/app-store` paths. The third is a storefront checkout-extensions path (also an ART-16 seam — see §7.4). Both app-store gates are **exact literal paths with no wildcard**, so the gate does not spread to sibling routes under `/installations/:id/…`. Confirmed executably: the staging→production diff moves **exactly two rows** and nothing else.

### 3.3 Route counts: “83” (Lens 1, Lens 3) vs “79” (Lens 2)

**Adjudication: not a disagreement — different denominators, both correct.** Lens 3 enumerated from Hono's own `router.routes` arrays: **79** under `appStoreRouter` + **4** under `appApiRouter` = **83**. I re-verified the count in `probe-raw/production.json`: 83 non-control rows, and **no route registered at the bare paths `/v1/app-store` or `/v1/app`**. Lens 2's “2 of 79” is the `/app-store`-only ratio; Lens 1/3's “2 of 83” is the whole App Bridge surface. **Use 2 of 83** — because the `/v1/app` third-party data API is squarely in scope and is 100 % ungated by the flag.

### 3.4 “17 unauthenticated routes” (Lens 1) vs Lens 3's executed histogram

**Adjudication: Lens 1's classification is correct and Lens 3's numbers confirm it; the two must be added, not compared.** From `probe-raw/production.json`, **21** rows returned something other than `401`/`403`; of those, 2 are `404 EXTENSIONS_DISABLED`. That leaves **19 routes that execute their handler for an anonymous caller**:

- **17** with *no credential check at all* — exactly Lens 1's list (9×`200`, 3×`400` on the unauth write paths, 4×`404` record-not-found, 1×`500`).
- **2 more** — `POST /v1/app-store/oauth/token` and `POST /v1/app-store/bridge/fetch` — which Lens 1 correctly classified separately because they verify an OAuth grant / app-scoped bearer **in-handler**. They are not “unauthenticated” in the security sense, but they **are mounted, reachable and executing** for an anonymous caller, which is the governance question.

**Both lenses were right. The reconciled number to quote is: 17 fully unauthenticated, 19 anonymously executing, in a verbatim production-shaped environment.**

### 3.5 “local” shape: top-level `[vars]` (Lens 1/2) vs `ENVIRONMENT=development` (Lens 3)

**Adjudication: both are legitimate local shapes and neither changes the verdict.** Lens 1/2 are mechanically right that `wrangler dev` with no `--env` loads top-level `[vars]` (`ENVIRONMENT="staging"`, `FEATURE_EXTENSIONS="true"`, `wrangler.toml:31-40`). Lens 3's `local` shape (`probe-raw/probe2.mts:80` — `ENVIRONMENT/APP_ENV/NODE_ENV=development`) is a developer-machine / `.dev.vars` shape. **Both are REACHABLE**, and Lens 3's shape has the extra evidentiary value of proving the fail-open default branch (§3.1). Recorded as two rows in the table in §2.

### 3.6 Weighting rule applied

Per the mandate, **executable evidence outranks source inference wherever both exist.** Every reachability claim in §2 is EXECUTED. Lens 1's core structural claim — that Hono composes in registration order and so the global `api.use('/*', authMiddleware)` at `index.ts:750` never runs for routers mounted at `:727-728` — was source inference; **Lens 3's isolated-router probe converted it to executed fact**, and I re-verified the control rows myself. Nothing in this document rests on unproven inference except the single item explicitly marked **UNDETERMINED** (the Cloudflare edge, §2).

---

## 4. Primary source re-verified by me (independent of all three lenses)

| Claim | Verified at | Result |
|---|---|---|
| Both routers mounted in the **public** block, before the auth wall | `services/api-gateway/src/index.ts:701` (`// Public routes (no auth required)`), `:727` `api.route('/app-store', appStoreRouter);`, `:728` `api.route('/app', appApiRouter);`, `:750` `api.use('/*', authMiddleware);`, `:751` `csrfProtection`, `:752` `protectedMutationIdempotency` | **CONFIRMED** — mounts are 23 lines *before* the perimeter |
| `api = app.basePath('/v1')` | `services/api-gateway/src/index.ts:672` | **CONFIRMED** — public prefixes are `/v1/app-store`, `/v1/app` |
| Feature gate covers exactly 2 app-store paths | `services/api-gateway/src/index.ts:714-716` | **CONFIRMED** |
| Lines `717-720` are a **rate limiter**, not a gate | `services/api-gateway/src/index.ts:717-720` (`appOAuthRateLimit`) | **CONFIRMED** — throttles `oauth/authorize`, `oauth/token`, `oauth/token-exchange`, `bridge/fetch`; blocks nothing |
| Flag default is fail-open | `services/api-gateway/src/middleware/featureFlags.ts:19-26`, gate returns 404 at `:28-45` | **CONFIRMED** |
| `wrangler.toml` flag values | `:40` `"true"` (`[vars]`), `:131` `"true"` (`[env.staging.vars]`), `:247` `"false"` (`[env.production.vars]`) | **CONFIRMED** |
| **No global kill switch exists** | `grep -rn "MARKETPLACE_ENABLED\|APP_STORE_ENABLED\|FEATURE_APP_STORE\|FEATURE_MARKETPLACE" services/api-gateway` | **CONFIRMED — zero hits** |
| `services/api-gateway` is a production deploy target | `.github/workflows/production-deploy.yml:336-338` (`wrangler deploy --env production`), staging at `staging-deploy.yml:106-109` | **CONFIRMED** |
| `apps/merchant-control-plane` is a production deploy target | `.github/workflows/production-deploy.yml:404` (`- app: merchant-control-plane`); staging `staging-deploy.yml:186` | **CONFIRMED** |
| Merchant UI has **no** capability gate | no `apps/merchant-control-plane/middleware.ts`; `grep -rn "FEATURE_EXTENSIONS\|FEATURE_APP\|MARKETPLACE_ENABLED\|APP_STORE_ENABLED" apps/merchant-control-plane/src` → **zero hits**; `src/proxy.ts:13-43` gates on session only, no path allow/deny list | **CONFIRMED** |
| App Bridge UI surface exists and ships | `src/app/[store]/apps/page.tsx`, `src/app/[store]/apps/[installationId]/page.tsx`, `src/components/apps/EmbeddedAppBridgeClient.tsx`, `src/app/[store]/settings/apps/page.tsx` + `AppsSettingsClient.tsx`; static SDK `public/letbuyy-app-bridge.js` and `public/example-app-bridge.html` shipped in the deployed app's `public/` | **CONFIRMED** |
| Governance text | `LETBUYY_CONSTITUTION.md:123` (“Not a third-party app / extension platform now”), ART-16 §, ART-22 §, `AGENTS.md:185` (NEVER-R3), `AGENTS.md:364` (AGENT-R13) | **CONFIRMED verbatim** |

### 4.1 Governance finding

- **ART-22** freezes `apps/app-marketplace` and `apps/developer-portal` — *“de-deployed from active topology — with the OAuth2/PKCE install-flow **seam** kept.”*
- **Constitution §”LetBuyy is explicitly NOT” item 4** (`:123`): *“Not a third-party app / extension platform now — no live app marketplace, checkout extensions, or Wasm extensibility runtime. (ART-16/22.)”*
- **NEVER-R3** (`AGENTS.md:185`): MUST NOT build **as live capability** a 3rd-party app marketplace / checkout extensions / app-functions.
- **AGENT-R13** (`AGENTS.md:364`): *“The agent's job at a frozen seam is to preserve the interface, not to implement behind it.”*

**Finding:** a *seam* is a preserved interface with nothing behind it. What is present is **9,566 lines** behind the interface (`src/routes/app-store/*.ts` = 7,292 + `src/routes/app-store.ts` = 1,472 + `src/routes/app-api.ts` = 802), mounted in **two** production deploy targets, serving `200 {"success":true}` to unauthenticated callers and negotiating OAuth2 `grant_type` in a verbatim production environment.

**That is a live capability, not a dormant seam. It is a live violation of ART-22, ART-16, NEVER-R3 and AGENT-R13.** The freeze of `apps/app-marketplace` / `apps/developer-portal` is irrelevant to it: the capability was rebuilt *inside* deploy targets and slipped underneath the app-shell-level freeze.

**No validator catches this.** `scripts/validators/deploy-matrix-topology-validator.mjs:34-35` freezes only the two app shells as *deploy targets*; `scripts/validators/marketplace-single-source-validator.mjs` only asserts `@letbuyy/ui` export paths. Nothing in the 107-validator gate asserts the app-store capability is unmounted in `services/api-gateway`.

---

## 5. NEW FINDING — a second entry point all three lenses missed

**`services/mobile-bff` explicitly allow-lists the App Bridge surface for proxying to the gateway, and it is a production deploy target.**

```
services/mobile-bff/src/index.ts:27   const ALLOWED_PREFIXES = [
services/mobile-bff/src/index.ts:68     '/v1/app-store',
services/mobile-bff/src/index.ts:69     '/v1/app',
services/mobile-bff/src/index.ts:236-240  function isAllowedPath(pathname) { … ALLOWED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`)) }
```

Requests that pass `isAllowedPath` are forwarded to the gateway over the service binding
(`env.API_GATEWAY_SERVICE.fetch(...)` at `services/mobile-bff/src/index.ts:336` and `:470`).
`mobile-bff` is deployed to production at `.github/workflows/production-deploy.yml:383-385` and to staging at `.github/workflows/staging-deploy.yml:160-163`.

There is also a **Flutter client** for the capability in the merchant mobile app:
`apps/mobile/merchant-app/lib/services/app_marketplace_service.dart` (references `'/app-store/bridge/fetch'` at `:231`).

**Impact on the design:** none, in the good sense — because `mobile-bff` *proxies to the gateway rather than reimplementing*, the gateway-side gate in §7.1 closes this path too. It is nonetheless recorded here because (a) it widens the governance finding to a **third** deploy target, and (b) it is a *positive allow-list entry* for a frozen capability, which is worth removing as a cheap adjacent hardening (§7.3).

---

## 6. Decision: IS A KILL SWITCH REQUIRED?

**YES — REQUIRED. Both trigger conditions in the mandate are independently satisfied.**

| Mandate trigger | Met? | Proof |
|---|---|---|
| “ANY of those route families is reachable in ANY **non-production** config shape” | **YES** | `probe-raw/staging.json` and `probe-raw/local.json`: 83/83 routes reachable, 9 returning `200 success:true` unauthenticated, `embed-session` + `bridge/fetch` + the OAuth2 flow all live, and the 2 extension routes ENABLED. Staging is a real deploy (`staging-deploy.yml:106-109`). |
| “production-shape safety depends **only** on a flag that defaults to enabled elsewhere” | **YES** | The only gate is `extensionsFeatureGate` (`index.ts:715-716`) over `isGatewayFeatureEnabled`, whose fallback at `featureFlags.ts:25` is `!isProductionRuntime(env)` — proven fail-open in `probe-raw/local.json`. |

And a third condition, stronger than either, which the mandate did not even need to name:

| Additional, decisive | Met? | Proof |
|---|---|---|
| The surface is reachable **in the production shape itself** | **YES** | `probe-raw/production.json`: 19 routes execute anonymously, 9 of them `200`; 60 more are available to any authenticated merchant; only 2 of 83 are disabled. |

---

## 7. MINIMAL fail-closed kill-switch design

**Design principles, in order:**

1. **Fail CLOSED.** Deny unless a value is *explicitly and positively* set. **No environment-based fallback of any kind** — that fallback (`featureFlags.ts:25`) is precisely the defect being closed, so the existing `featureGate` / `isGatewayFeatureEnabled` helper is deliberately **not** reused.
2. **Perimeter, not per-route.** The existing gate under-covers at 2/83 because it enumerates literal paths. The new gate must be a **prefix** middleware registered **before** the mounts, so it cannot drift as routes are added.
3. **Smallest possible surface.** One new middleware file, four `api.use` lines, one `Env` field, one import. **No change to any file under `services/api-gateway/src/routes/app-store/`, `app-store.ts`, or `app-api.ts`.**
4. **No config change is the *point*.** The switch is **absent ⇒ off**. Nothing is added to `wrangler.toml`, so no environment can be silently on.

All edits below are to be made **only** in the isolated worktree
`/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/emergency-appbridge-killswitch`.

---

### 7.1 Component A — the gateway hard gate *(load-bearing; this alone makes every route unreachable)*

**A1 — NEW FILE:** `services/api-gateway/src/middleware/appPlatformKillSwitch.ts`

```ts
import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

const POSITIVE = new Set(['1', 'true', 'on', 'enabled', 'yes']);

/**
 * ART-22 / ART-16 / NEVER-R3 / AGENT-R13 hard gate.
 *
 * The third-party app platform is a FROZEN SEAM. This gate is FAIL-CLOSED:
 * the surface is unreachable unless FEATURE_APP_PLATFORM is explicitly set to a
 * positive value. There is deliberately NO environment-based fallback — see
 * middleware/featureFlags.ts:25, whose `!isProductionRuntime(env)` default is
 * the fail-open behaviour this gate exists to replace.
 *
 * Re-enabling requires a human-approved constitutional act (ART-22 trigger:
 * ~5,000 merchants + real developer demand). Do NOT set this var.
 */
export function isAppPlatformEnabled(env: Pick<Env, 'FEATURE_APP_PLATFORM'>): boolean {
    const value = env.FEATURE_APP_PLATFORM?.trim().toLowerCase();
    return value ? POSITIVE.has(value) : false;   // absent / empty / anything else => DISABLED
}

export const appPlatformKillSwitch = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    if (isAppPlatformEnabled(c.env)) {
        await next();
        return;
    }

    return c.json(
        { success: false, error: { code: 'APP_PLATFORM_DISABLED', message: 'Not found' } },
        404,
    );
});
```

**A2 — `services/api-gateway/src/index.ts`, import.** Insert immediately after the existing line `8`:

```
  8: import { featureGate } from './middleware/featureFlags';
+ 9: import { appPlatformKillSwitch } from './middleware/appPlatformKillSwitch';
```

**A3 — `services/api-gateway/src/index.ts`, `Env` interface.** `export interface Env {` is at `:101`; the feature-flag fields are at `:257-259`. Insert immediately after line `259` (`FEATURE_LIQUID?: string;`):

```ts
    /** ART-22 kill switch. ABSENT = app platform disabled. Do not set. */
    FEATURE_APP_PLATFORM?: string;
```

**A4 — `services/api-gateway/src/index.ts`, the gate registration — THE critical insertion point.**
Insert **immediately after line `714`** and **before line `715`** (i.e. after the storefront checkout-extensions gate, before the two app-store `extensionsFeatureGate` lines). This is **13 lines before the `api.route('/app-store', …)` mount at `:727`** and **36 lines before the auth wall at `:750`** — Hono composes middleware in registration order, so this position is mandatory: registering it *after* `:727-728` would not run.

```ts
// ART-22 / ART-16 / NEVER-R3 hard gate — the third-party app platform is a frozen
// seam, not a live capability. Fail-closed: unreachable unless FEATURE_APP_PLATFORM
// is explicitly positive. Registered BEFORE the mounts at :727-728 (Hono composes in
// registration order) so it cannot be bypassed and cannot drift as routes are added.
api.use('/app-store', appPlatformKillSwitch);
api.use('/app-store/*', appPlatformKillSwitch);
api.use('/app', appPlatformKillSwitch);
api.use('/app/*', appPlatformKillSwitch);
```

*Why four lines and not two:* the bare-path registrations are belt-and-braces. Verified from `probe-raw/production.json` that **no route is currently registered at exactly `/v1/app-store` or `/v1/app`**, so the two wildcard lines are sufficient today — the bare-path lines cost nothing and remove a future-drift hole. Hono path matching is segment-based, so `'/app/*'` matches only `/v1/app/...` and never `/v1/app-store/...`; no other router is mounted under a `/v1/app…` prefix.

*Why before `:715-720` and not just before `:727`:* placing it first also short-circuits ahead of `extensionsFeatureGate` and `appOAuthRateLimit`, so a blocked caller never consumes rate-limit budget. Functionally either position works; this one is strictly cleaner.

**A5 — `services/api-gateway/wrangler.toml`: NO CHANGE. This is deliberate and load-bearing.**
Do **not** add `FEATURE_APP_PLATFORM` to `[vars]` (`:31-40`), `[env.staging.vars]` (`:122-131`), or `[env.production.vars]` (`:238-247`). Its absence in all three blocks is what makes the switch **off in every shape by default**. The existing `FEATURE_EXTENSIONS` lines (`:40`, `:131`, `:247`) are **left untouched** — removing or changing them is not required and is out of scope.

**Resulting behaviour (what the tests in §7.5 must assert):** all **83** routes → `404 {"success":false,"error":{"code":"APP_PLATFORM_DISABLED"}}` in **every** config shape — local, staging, production, and any shape with the var absent — while `/v1/health`, `/v1/products`, and every other route are byte-for-byte unchanged.

**This single component closes:** all 83 gateway routes; the merchant UI's server-side calls (it has no local DB access and no `app/api/app-store` proxy — it calls the gateway via `@letbuyy/api-client`); the `mobile-bff` proxy path of §5; and the Flutter client. It is the whole kill switch.

---

### 7.2 Component B — merchant-control-plane UI hard gate *(recommended; still minimal)*

Component A already makes the embed page non-functional. Component B stops a **frozen capability from being *presented*** in a production deploy target — a `/{store}/apps` page and a live “Browse marketplace → https://apps.letbuyy.com” CTA are themselves the ART-22 surface.

**B1 — NEW FILE:** `apps/merchant-control-plane/src/lib/app-platform-flag.ts`

```ts
const POSITIVE = new Set(['1', 'true', 'on', 'enabled', 'yes']);

/** ART-22 fail-closed gate. Absent env var => disabled. Mirrors the gateway kill switch. */
export function isAppPlatformEnabled(): boolean {
    const value = process.env.FEATURE_APP_PLATFORM?.trim().toLowerCase();
    return value ? POSITIVE.has(value) : false;
}
```

**B2 — three one-line guards.** All three files already import `notFound` from `next/navigation`, so each edit is exactly one added import line plus one added statement:

| File | Insertion point |
|---|---|
| `apps/merchant-control-plane/src/app/[store]/apps/page.tsx` | as the **first statement** of `AppsPage` (currently `:21`, `const { store } = await params`) → `if (!isAppPlatformEnabled()) notFound()` |
| `apps/merchant-control-plane/src/app/[store]/apps/[installationId]/page.tsx` | as the **first statement** of `EmbeddedAppPage` (currently `:14`) → same guard |
| `apps/merchant-control-plane/src/app/[store]/settings/apps/page.tsx` | as the **first statement** of `AppsSettingsPage` (currently `:11`) → same guard |

**B3 — no workflow change.** Do **not** add `FEATURE_APP_PLATFORM` to the Next env blocks in `.github/workflows/production-deploy.yml` (~`:428-451`) or `.github/workflows/staging-deploy.yml` (~`:214-235`). Absent ⇒ disabled.

**B4 — cosmetic residue, explicitly accepted.** The nav entries (`src/components/merchantNavigation.ts:42-47,60,171,371-376`; `src/components/settings-navigation.ts:158-167`; the products empty-state CTA at `src/app/[store]/products/page.tsx:429`) will link to pages that now `404`. Hiding them is a one-line filter but is **cosmetic, not a gate** — record it as optional follow-up rather than expanding this change.

**B5 — static assets, explicitly out of scope.** `apps/merchant-control-plane/public/letbuyy-app-bridge.js` and `public/example-app-bridge.html` remain served as static files. They are inert without a live gateway. **Deleting them is removal ⇒ Wave 1 + ARB.**

---

### 7.3 Component C — `mobile-bff` allow-list narrowing *(optional; two line deletions)*

Delete the two entries from `ALLOWED_PREFIXES` in `services/mobile-bff/src/index.ts`:

```
 68: -  '/v1/app-store',
 69: -  '/v1/app',
```

Not required — Component A already returns `404 APP_PLATFORM_DISABLED` through the service binding. This simply removes a standing *positive allow* for a frozen capability, and the allow-list is fail-closed by construction (anything not listed is rejected at `:236-240`). Include only if the ARB wants the belt-and-braces; it is a pure deletion from a deny-by-default list, not a refactor.

---

### 7.4 Explicitly considered and EXCLUDED from the minimal design

| Candidate | Decision | Reason |
|---|---|---|
| Gate `/v1/storefront/:subdomain/checkout/extensions` (`index.ts:714`) with the same kill switch | **EXCLUDED from minimal core** | Same ART-16 family and same fail-open flag, but it is the **storefront checkout** path, not the App Bridge surface this mandate scopes. Gating it changes local/staging storefront-checkout behaviour and needs its own blast-radius check. **Flag to the ARB as the obvious next item; do not bundle it here.** |
| Remove `api.route('/app-store', …)` / `api.route('/app', …)` at `:727-728` outright | **EXCLUDED** | That is **removal**, i.e. Wave 1 + ARB. A gate is reversible by one env var; an unmount is a code change to reverse. |
| Fix / narrow / extend `extensionsFeatureGate` to cover more routes | **EXCLUDED** | That is *improving* the marketplace gating — explicitly forbidden by the mandate, and it inherits the fail-open default. |
| Change `isGatewayFeatureEnabled`'s fallback at `featureFlags.ts:25` to fail-closed | **EXCLUDED** | It is shared by `FEATURE_GRAPHQL` and `FEATURE_LIQUID`; flipping it is a cross-cutting behaviour change with its own blast radius. The new gate deliberately does not depend on it. |
| Delete the 9,566 lines of app-store route code | **EXCLUDED** | Removal ⇒ Wave 1 + ARB. |
| Add a new deterministic validator to the 107-gate asserting the capability stays gated | **DEFERRED (recommended, not in this change)** | Correct long-term control (nothing in the gate covers this today — §4.1), but it is new governance tooling, not the minimal hard gate. Propose separately. |

---

### 7.5 Tests to accompany the gate *(the only other permitted change)*

Runner: **`tsx --test` / `node:test`** — `services/api-gateway/package.json` → `"test:unit": "cd ../.. && tsx --test services/api-gateway/src/__tests__/*.test.ts"`. In-process HTTP harness is an established pattern in this repo (`src/__tests__/upload.security.test.ts:7-21`). **No network, no DB — Supabase stubbed in-process exactly as Lens 3 did.**

**NEW FILE:** `services/api-gateway/src/__tests__/app-platform-killswitch.test.ts`

1. **Fail-closed across every shape.** Build the assembled gateway from `src/index.ts` and, for each of four env shapes — (a) developer shape `ENVIRONMENT=APP_ENV=NODE_ENV=development`, (b) verbatim `[env.staging.vars]`, (c) verbatim `[env.production.vars]`, (d) verbatim staging vars with `FEATURE_APP_PLATFORM` explicitly `"false"` — assert **every one of the 83 routes** (enumerated from `appStoreRouter.routes` / `appApiRouter.routes`, *not* hard-coded) returns `404` with `error.code === 'APP_PLATFORM_DISABLED'`.
2. **Positive control — the gate is what is doing it.** With `FEATURE_APP_PLATFORM='true'`, assert `GET /v1/app-store/categories` is **not** `404 APP_PLATFORM_DISABLED`. Without this, a mount error would pass test 1.
3. **No collateral damage.** In the production shape assert `GET /v1/health` → `200`, and that a non-app-store protected route (e.g. `GET /v1/products`) returns its pre-existing status (`401`), **not** `404 APP_PLATFORM_DISABLED` — proving `'/app/*'` does not over-match.
4. **Registration-order regression guard**, in the repo's existing source-assertion idiom (`readFileSync` + `assert.match`, as in `security-v1.test.ts`): assert `src/index.ts` registers `appPlatformKillSwitch` at a **lower line number** than `api.route('/app-store'` and `api.route('/app'`. This is the one property a runtime test cannot express durably, and it is exactly the property that breaks silently.
5. **Config assertion:** assert `FEATURE_APP_PLATFORM` appears **nowhere** in `services/api-gateway/wrangler.toml`. Absence is the fail-closed guarantee; a future “helpful” addition must break the build.
6. **Egress assertion:** replace `globalThis.fetch` before any application import and assert `egressCount === 0`, mirroring the probe's own instrumentation.

Lens 3's probes (`tmp-appbridge-probe/` in the worktree, archived to `…/raw-evidence/appbridge-urgent/probe-raw/`) are the direct template for 1–3 and 6. They are **not** tests and must not be wired into `pnpm test`; the new file supersedes them.

---

## 8. OUT OF SCOPE — restated explicitly

The following are **NOT** permitted under this change and must not be attempted:

1. **No extension, repair, improvement, hardening, or refactor of the App Bridge / app-marketplace / developer-platform implementation.** Not the OAuth2 flow, not the billing/revenue-share engine, not `embed-session`, not `bridge/fetch`, not the 17 unauthenticated routes, not the unauth service-role INSERT paths (`/discovery/events`, `/growth/requests`, `/telemetry/events`), not the missing Turnstile on `/growth/requests`, not the `500` on `/apps/:id/reviews`. **These are real defects and they are documented here as findings only.** Fixing them would deepen the ART-22 violation by investing further in a frozen seam. They become moot the moment the gate lands.
2. **No permanent removal.** Not the `api.route()` mounts, not the 9,566 lines under `src/routes/app-store*`, not the UI pages, not `public/letbuyy-app-bridge.js` / `public/example-app-bridge.html`, not the Flutter `app_marketplace_service.dart`, not the DB migrations or `app_*` tables. **Removal is Wave 1 and requires ARB approval** under the AGENT-LEGACY gated process (`AGENTS.md` §16.5).
3. **No change to `FEATURE_EXTENSIONS`,** its values in `wrangler.toml` (`:40`, `:131`, `:247`), or the shared `isGatewayFeatureEnabled` / `featureGate` helper — those are shared with `FEATURE_GRAPHQL` and `FEATURE_LIQUID`.
4. **No deploy, no push, no PR, no provider call, no production or staging data access.** The gate is written and tested in the isolated worktree only. **Rollout sequencing is an ARB decision, not this document's.**
5. **No modification to the production-linked repo** beyond this deliverable and the evidence directory.

---

## 9. Deliverables and evidence

| Artifact | Path |
|---|---|
| **This adjudication** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/docs/launch/web-v1-wave-0-2026-08-09/28_APPBRIDGE_URGENT_REACHABILITY_VERDICT.md` |
| Lens 1 — gateway route mount audit | `…/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/appbridge-urgent/lens1-gateway-mounts.md` |
| Lens 2 — merchant UI + config shapes | `…/raw-evidence/appbridge-urgent/lens2-ui-config-shapes.md` |
| Lens 3 — local executable proof | `…/raw-evidence/appbridge-urgent/lens3-executable-proof.md` |
| Executed status matrices (7 shapes, 85 rows each, `egressCount: 0`) | `…/raw-evidence/appbridge-urgent/probe-raw/{local,staging,staging-extfalse,staging-noflag,production,production-noflag,isolated}.json` + `matrix.md` |

**Verdict: REACHABLE in all three config shapes. Kill switch REQUIRED. Minimal fail-closed design specified in §7.1 (gateway, load-bearing) with §7.2 (UI) recommended and §7.3 optional. Implementation belongs in the isolated worktree; rollout is an ARB decision.**
