<!-- CODEX MISSION PROMPT — whole codebase foundation. Paste this entire file to Codex, or point Codex at this path. Single-go, autonomous. Consolidates: PRODUCTION_READINESS_AUDIT_2026-06-07, the existing CODEX_FOUNDATION_STRENGTH_MISSION (FS-1..FS-14), the apps/app-marketplace audit + its 50 cross-boundary contracts, and the architecture-reality ground truth. -->

# CODEX MISSION — LetBuyy Foundation (Whole Codebase, V1)

> **You are Codex.** This is the foundation phase: make the **entire LetBuyy monorepo fundamentally strong** in one autonomous run. Fix the real launch blockers, finish the half-done migrations, enforce the invariants the platform only *assumes*, fulfill the open marketplace contracts, and — most important — **stop measuring readiness with governance theater and start measuring it with real gates** (build + real tests + a working end-to-end smoke). Work the waves in order, commit as you go, and **never stop for human approval** — when something needs a human/secret/business decision, log it `SKIPPED (NEEDS-HUMAN)` and keep going. Read this whole file before writing code.

---

## 0. The core reframe (why this mission exists)

LetBuyy's product code is largely real: `services/api-gateway` (~40k LOC, Hono on Cloudflare Workers + Supabase) is the genuine backend; Razorpay/Stripe payments have HMAC verification, idempotency, ownership and double-pay guards; the Flutter merchant app is ~60 real screens; RLS has 354 policies; no real secrets are committed.

**The foundation problem is an inverted pyramid of confidence:** there are **167 governance validators that all pass**, 100KB+ of `CODEX_*` ledgers and "convergence/saga/split-brain" certifications — wrapped around a product that still has a committed placeholder secret that 500s the entire mobile backend, a rate limiter that 503s every request if one env var is missing, and a half-finished domain migration. **~60–70 of the 167 validators only string-match words in markdown/JSON; the test suite mostly spawns validators and asserts they print "passed."** All-green tells you the docs are internally consistent, not that the system works.

**Your prime directive:** drive off the real issue list (§5 waves), and replace the "167 green" readiness signal with the real Definition of Done in §6. Do **not** add more theater.

---

## 1. Non-negotiables (read first)

1. **SINGLE-GO, AUTONOMOUS, WHOLE-REPO.** You may edit anywhere in the repo that a wave requires (`apps/**`, `services/**`, `packages/**`, `database/**`, `config/**`, `scripts/**`, `infrastructure/**`, root). This is the opposite of the marketplace task's narrow boundary — here you own the foundation. Run on a dedicated branch; assume **no other task runs in parallel** (this mission touches shared files).
2. **NEVER BLOCK ON HUMANS.** No prompts, no waiting. Anything needing a real secret, a business decision, production data, DNS, or governance sign-off → `SKIPPED (NEEDS-HUMAN)` in the skip log (§4) with the exact unblock step, then continue. Do every code/config change around it that does *not* require the human.
3. **TRUTH OVER THEATER.** Do not add validators, ledgers, "proofs", or evidence files to make numbers go green. If a check can't run real code, it is not a gate. Honest empty/error/degraded states only. Never fake data, metrics, reviews, health, or secrets.
4. **DON'T BREAK WHAT'S HEALTHY.** Do not weaken payment-signature verification, idempotency, ownership checks, double-pay guards, the dev-auth-bypass gating, RLS policies, or `.gitignore`. Preserve tenant isolation; strengthen it, never loosen it.
5. **DOMAIN RULE (do not get this wrong).** `letbuyy.com` = **platform control-plane apex** (admin, accounts, api, console, developer, the marketplaces, webhooks, transactional email, mobile-platform endpoints, payment redirects). `letbuyy.store` = **storefront-only** (wildcard `*.letbuyy.store` shopper storefronts + merchant custom domains). **Only platform/control-plane/email/payment/mobile surfaces move to `.com`. Do NOT rewrite legitimate storefront `.store` usage.**
6. **REAL GATES BEFORE DONE.** Every wave ends green on the *real* gates (§6): `turbo typecheck`, `turbo build`, `node --test` integration/unit tests, and the structural validators (circular-import, undeclared-import, dependency-graph, domain-boundary, dead-residue). Evidence/certification validators are non-gating.
7. **EVIDENCE OR IT DIDN'T HAPPEN.** Every issue closed gets a ledger row with files changed + how you verified it with a real gate (not "validator printed passed").
8. **SCOPE = the issue list.** Implement §5 (which consolidates the readiness audit P0–P3, the FS phases, and the 50 marketplace contracts). New real defects you discover → log `FOUND-###` and fix; don't wander into speculative rewrites.

---

## 2. Canonical references (read first, in this order)

1. `PRODUCTION_READINESS_AUDIT_2026-06-07.md` — **the issue source of truth** (P0-1..P0-4, P1-1..P1-10, P2, P3 with exact file:line anchors). If this file is absent from root, look in `docs/archive/` or `docs/` (root work-logs get archived).
2. `CODEX_FOUNDATION_STRENGTH_MISSION.md` (FS-1..FS-14) — the prior phase plan this mission **consolidates and supersedes**; reuse its skip conventions and anchors; do not duplicate its work if already applied (check its ledger/status).
3. Root `AGENTS.md` + `CLAUDE.md` — the engineering constitution, canonical runtime map, deprecated-alias policy, and required validation (`node scripts/validate-governance.mjs`).
4. `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` + `docs/apps-marketplace-audit/*` — the marketplace audit; and **`apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md`** — the **50 open contracts (C-001..C-096)** you must fulfill in Wave 7.
5. The architecture-reality ground truth (this mission §0 + §3) — service-role bypasses RLS in ~500 places behind 151 manual `verifySiteOwnership` calls; six services are empty stubs.

---

## 3. Ownership / runtime map (where the real code lives)

Active runtimes (edit these): `apps/storefront-runtime`, `apps/merchant-control-plane` (largest), `apps/identity-platform`, `apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, `apps/marketing-site`, `apps/platform-console`, `apps/platform-operations-portal`, `apps/mobile/merchant-app` (Flutter), `services/api-gateway` (THE backend), `services/mobile-bff`, `services/webhook-service`, `services/queue-workers`, plus `packages/**`, `database/supabase`, `config/**`, `scripts/**`.

Empty manifest-only stubs (do NOT treat as live; decide gate-or-build in Wave 4): `services/checkout-runtime`, `services/search-service`, `services/media-service`, `services/notification-service`, `services/event-bus`, `services/analytics-pipeline`, `apps/mobile/shopper-app`, `apps/mobile/operator-app`. Reserved roots are manifest-and-AGENTS-only by policy — adding real source needs human-approved scope → `SKIPPED (NEEDS-HUMAN)`.

Never resurrect deprecated aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/storefront`, etc.) — they are intentionally removed.

---

## 4. Skip protocol & work files (match existing conventions)

Maintain at repo root (or `docs/` if root work-logs are archived) — these are the mission's interface to the human:

- `CODEX_LETBUYY_FOUNDATION_LEDGER.md` — one row per issue: `| id (P0-1/.../C-007/FOUND-001) | wave | area(s) | status (DONE/PARTIAL/SKIPPED) | files changed | real-gate verification |`
- `CODEX_LETBUYY_FOUNDATION_STATUS.md` — rollup: counts by status, the real-gate results (typecheck/build/tests/smoke), open human skips, and remaining marketplace contracts.
- `CODEX_LETBUYY_FOUNDATION_SKIPS.md` — every human-gated item:

```
- <id> <title> — SKIPPED (NEEDS-HUMAN)
  Reason: <secret / business decision / DNS / data / governance sign-off>
  Unblock: <exact command or decision a human must provide>
  Code done anyway: <what you implemented/guarded so the moment the human acts, it works>
```

MUST be skipped (never guessed): provisioning real secrets (`wrangler secret put …`), the final commission/revenue-share **rate**, which launch-partner apps to seed, KYC/identity policy, review-policy wording, DNS cutover, applying DB migrations to a live environment, and any change requiring a new runtime name / governance decision. Implement the *code* that consumes the secret/decision; skip only the human act.

---

## 5. Execution waves (do in order; green real gates after each)

> Every wave: implement → run real gates (§6) → commit (`fix|feat(<area>): <id> <short> [wave N]`) → update ledger/status. File:line anchors below are from the readiness audit; verify current positions before editing.

### Wave 1 — Deploy blockers (P0-1, P0-2, P0-4) + a real anti-regression gate
- **P0-1 BFF dead (committed placeholder secret).** `services/mobile-bff/wrangler.toml` (~lines 30/60/100) ships `INTERNAL_API_SECRET = "SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET"`; `src/index.ts:~139` rejects placeholder-prefixed secrets → HTTP 500 on every session-auth request. Remove the literal from committed config; require the value from a Worker **secret**. SKIP (NEEDS-HUMAN) the actual `wrangler secret put INTERNAL_API_SECRET` (staging+production, matching api-gateway).
- **P0-2 Rate limiter fail-closed → 503 everywhere.** `services/api-gateway/src/middleware/rateLimit.ts:~793-804,958-965` returns `unavailable:true` with no Upstash Redis; mounted on `api.use('/*')` (`index.ts:~523`). Make it **degrade to the always-present KV (`CACHE`)** instead of hard-failing, AND add a deploy gate that refuses production without `UPSTASH_REDIS_REST_URL/_TOKEN`. Never let a missing optional dep 503 the whole site.
- **P0-4 Empty-string signing-key fallback.** `apps/identity-platform/src/lib/auth/cookies.ts:5` (`process.env.AUTH_SECRET || ''`) and `apps/platform-console/src/lib/console-session.ts:24`. Replace with a `requireSecret()` that throws at boot on empty/missing. Never `|| ''` for a key.
- **Anti-regression gate (real):** add a CI check + structural validator that fails if any committed config contains `SKIP_NEEDS_HUMAN`, an empty-secret fallback (`_SECRET|_KEY|JWT|AUTH_SECRET` followed by `|| ''`/`|| ""`), or a platform-surface `letbuyy.store` literal env can't override.

### Wave 2 — Finish the domain migration (P0-3) — respect the .com/.store rule (§1.5)
Sweep hardcoded `letbuyy.store` literals on **platform/control-plane/email/payment/mobile** surfaces (TS **and** Dart), replace with required, fail-loud env/config (no `|| 'https://...letbuyy.store'` fallback). Anchors:
- Cookie domain: `apps/identity-platform/src/lib/auth/cookies.ts:~40`, `config/env/production.env.example:~52` (`COOKIE_DOMAIN=.letbuyy.store`) → SSO breaks at cutover.
- Storefront CSP `frame-ancestors`: `apps/storefront-runtime/next.config.ts:~13-14`.
- Email: `apps/identity-platform/src/lib/email/resend.ts:~4,232,291` (`noreply@letbuyy.store`).
- Stripe redirect: `services/api-gateway/src/routes/payments.ts:~756-757` (`https://letbuyy.store/checkout/...`).
- Mobile: `apps/mobile/merchant-app/lib/config/app_config.dart:~11,17,23,29` + `packages/dart/core/.../api_constants.dart` → use `--dart-define`.
- Footers/proxies in `app-marketplace`, `theme-marketplace`, `developer-portal`, platform portals.
- Invert `config/env/production.env.example` so `.com` is the default for platform URLs.
- **Add `scripts/validators/dart-domain-literal-validator.mjs`** (none exists for Dart) failing on raw `letbuyy.store/.com` literals in `.dart` outside declared `AppConfig` constants; extend the TS domain/cookie validators to the new anchors; add contract tests. Leave legitimate `*.letbuyy.store` storefront usage alone. SKIP (NEEDS-HUMAN) the DNS cutover itself.

### Wave 3 — Security & reliability (P1-1, P1-3, P1-4, P1-5, P1-8, P1-9)
- **P1-3 timing-safe compare.** `services/webhook-service/src/index.ts:~568,658` uses `!==` on `INTERNAL_API_SECRET`; switch to the already-imported `timingSafeEqual` (api-gateway already does).
- **P1-4 internal-route brute force.** `services/api-gateway/src/index.ts:~565-568` mounts `/internal/console|billing|events|store-access` before `authMiddleware`; add a strict per-IP limiter keyed on `CF-Connecting-IP` regardless of auth outcome.
- **P1-5 admin logout-on-blip.** `apps/merchant-control-plane/src/lib/auth/session.ts:~23,46,91` `catch { return null/[] }`; distinguish 401/403 from network/5xx, render an error boundary instead of redirecting valid merchants to login.
- **P1-8 error/not-found pages.** Add root `error.tsx` + `not-found.tsx` to at least `storefront-runtime` and `merchant-control-plane` (ideally all apps) — branded, no framework leakage.
- **P1-9 edge middleware throws on missing env.** `apps/storefront-runtime/src/middleware.ts:~39,45,50` throws in the request path → 500 on every storefront request; validate env in `instrumentation.ts`, degrade gracefully.
- **P1-1 tenant isolation enforced, not assumed.** service-role bypasses RLS in ~500 places behind 151 manual `verifySiteOwnership` calls. Add a **real** route-level test/validator asserting every tenant-scoped query path is preceded by an ownership check; introduce a typed query wrapper that requires a verified `storeId`/`site_id`. This is the single most important durability fix — make the invariant mechanical.

### Wave 4 — Product-surface honesty & decisions (P1-2, P1-6, P1-7, P2 stubs)
- **P1-2 notifications.** Wire the three dropped flows or gate them honestly: employee-invite email (`routes/employee.ts:~287`, `admin.ts:~283`), contact-form notification (`routes/contacts.ts:~48`), `order.paid` consumer (notification-service empty). Prefer shipping via Resend now where a real adapter exists; otherwise feature-gate + document. Do not leave silent TODO drops.
- **P1-6 honest topology.** `config/runtime/deployment-topology.json` gives the 6 empty services health-checks + dependency edges; mark them `"status":"placeholder"` and exclude from health evaluation so operators don't chase non-existent services.
- **P1-7 mobile push.** `apps/mobile/merchant-app/lib/services/push_service.dart:~71,81` throw `SkipNeedsBackendException`; implement `POST/DELETE /v1/push/device-tokens` in api-gateway + remove the throws (or gate push behind a flag if the provider needs a human secret → SKIP the secret only).
- **P2 stub UI hidden from users:** merchant `ats-score` `StubPage`, platform-ops "blocked" modules, platform-console `marketplace-governance` "backend missing" — hide from nav until built (don't ship "Coming Soon" to users).
- **Empty-service decision:** for `checkout-runtime`/`search-service`/`media-service`/`notification-service`/`event-bus`/`analytics-pipeline`, do NOT scaffold new runtimes (needs human-approved scope → SKIP). Instead ensure the live surface (api-gateway) covers what's promised, and that nothing in the product silently depends on an empty service.

### Wave 5 — Input/output hardening (P2)
- **`POST /contacts` validation:** `routes/contacts.ts:~8-49` has manual `if` checks only — add `validate('json', zod)` with length caps.
- **XSS:** `services/api-gateway/src/middleware/security.ts:~113-124` logs-but-allows dangerous content; decide ingestion sanitization vs. mandatory output-escaping in themes and **enforce** the chosen one.
- **Dead scaffolding:** confirm `packages/dart/core/.../api_constants.dart` (shopper surface unused by merchant app) and the unused Durable Object `runtime-coordinator.ts` are either wired or archived under `docs/archive/` (don't delete history; follow the dead-residue validator).

### Wave 6 — Governance reform (P1-10) + repo hygiene (P3) — the foundation fix
- **P1-10 split the CI signal.** Reorganize validation into (a) **REAL GATES** (`turbo typecheck`, `turbo build`, `node --test` unit/integration, and the structural validators: circular-import, undeclared-import, dependency-graph, package-export, domain-boundary, dead-residue) that **block**, and (b) **evidence/certification validators** (the string-matching/convergence/saga/replay family) marked **non-gating, human-review**. Make `validate-governance.mjs` (or a new `validate-real.mjs`) run only the real gates for the readiness decision. Do not delete the evidence validators in this pass; reclassify them.
- **P3 hygiene:** `git mv` the root AI work-logs into `docs/archive/root-residue/` (`CODEX_FOUNDATION_HARDENING_*`, `CODEX_UI_FOUNDATION_*`, `CODEX_DOMAIN_SPLIT_*`, `FORENSIC_REPORT*/`); add a pre-commit/pre-push hook (husky/lefthook) running the real gates; begin consolidating/retiring the simulation-only validator family (reclassify now, retire later with a note).

### Wave 7 — Fulfill the 50 marketplace contracts + fix the route-freeze
The marketplace task (`apps/app-marketplace`) shipped UI behind off-by-default flags and wrote **50 contracts** in `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md` (`C-001..C-096`). Fulfill them here (backend/db/shared-packages are in *your* scope now):
- **Backend/DB/shared-types:** seed catalog + categories (`C-001`, data only — SKIP which launch apps), `app-update`/versioning endpoint + re-review (`C-002`/`C-046`), fix the search `.or()` injection in `services/api-gateway/src/routes/app-store.ts` (`C-004`), reconcile `revenue_share_bps` default vs the published rate (`C-003`; SKIP the rate decision, implement the single source), real review gating/scanning (`C-006`), `usage_based` pricing enum (`C-017`), per-app analytics (`C-015`), app-health/API-usage (`C-016`), review-reply model (`C-023`), media upload (`C-014`; needs media-service decision), payout statements/GST invoices/refunds (`C-067/068/069`), and the rest in the contract file. Add the corresponding methods to `@letbuyy/api-client` + types to `@letbuyy/shared-types`.
- **THE ROUTE-FREEZE FIX (critical):** `apps/app-marketplace` enforces `@letbuyy/ui`/boundary lint rule `no-new-next-api-route`, which blocked the marketplace from adding the BFF routes needed to wire OAuth-install, billing approval, API-key rotation, manifest validation, extension config, embed-session, and collaborator flows — so those are inert UI today. **Resolve it** one of two ways (pick the one consistent with `config/eslint/letbuyy-boundaries.mjs`): (a) grant a scoped, documented exception for the specific marketplace BFF pass-through routes, or (b) expose these capabilities through an allowed path so the marketplace can reach them. Then flip the relevant `NEXT_PUBLIC_MP_*` capability flags on and confirm the surfaces work end-to-end.
- After fulfilling each contract, update its `Status:` in the contract file to `DELIVERED` and flip the matching marketplace flag.

### Wave 8 — Real certification & PR
Run the full real-gate suite on a clean checkout with production-shaped env; run the **staging smoke test**: signup → create store → add product → checkout → pay → order (the readiness bar). Fill ledger/status/skip-log. Open a PR summarizing: P0/P1/P2/P3 status, contracts delivered, the new real-gates-vs-evidence split, and the explicit human-skip list.

---

## 6. Definition of Done (the real readiness bar — replaces "167 validators green")

Done = ALL of:
- `turbo typecheck` and `turbo build` clean across the repo with production-shaped (`.com`) env.
- Real `node --test` unit/integration suites green (not validator-spawn tests).
- Structural validators green: circular-import, undeclared-import, dependency-graph, package-export, domain-boundary, dead-residue.
- The end-to-end smoke passes on staging: **signup → create store → add product → checkout → pay → order**.
- No committed `SKIP_NEEDS_HUMAN`, no empty-string signing-key fallback, no platform-surface `letbuyy.store` literal env can't override; rate limiter degrades to KV (no 503 storm).
- Tenant-isolation ownership check is mechanically enforced/tested, not just convention.
- Marketplace: route-freeze resolved; contracts `DELIVERED` or explicitly `SKIPPED (NEEDS-HUMAN)` with reason.
- Ledger/status/skip-log complete and honest; evidence validators reclassified non-gating.

The "167 validators green" number is **not** a DoD criterion. If it conflicts with the real gates, the real gates win.

---

## 7. Guardrails (do not violate)

- One branch, single-go; no parallel task on shared files during this mission.
- Don't add theater (validators/ledgers/proofs to move numbers). Don't delete the evidence validators — reclassify.
- Don't rewrite legitimate `*.letbuyy.store` storefront usage; only platform/control-plane/email/payment/mobile → `.com`.
- Don't weaken payments, auth, ownership checks, RLS, dev-bypass gating, or `.gitignore`.
- Don't scaffold reserved/empty runtimes (needs human scope) — cover the surface via api-gateway or gate the feature.
- Never commit a real secret; implement secret *consumption* and SKIP the `wrangler secret put`.
- Keep `site_id`/store ownership explicit on every tenant-scoped operation.
- Regenerate `AGENTS.md` via `node scripts/generate-repository-intelligence.mjs` after topology/route/schema changes; commit the regenerated files (this is whole-repo scope, unlike the marketplace task).

---

## 8. First actions (now, in order)

1. Read §2 references — especially `PRODUCTION_READINESS_AUDIT_2026-06-07.md`, `apps/app-marketplace/CROSS_BOUNDARY_CONTRACTS.md`, root `AGENTS.md`/`CLAUDE.md`, and the existing FS mission ledger to see what's already applied.
2. Create the ledger/status/skip-log (§4).
3. **Baseline the real gates** (`turbo typecheck`, `turbo build`, `node --test` real suites, structural validators) with production-shaped env; record results + which were already failing pre-mission.
4. Execute Wave 1 → Wave 8 in order. Commit per issue. Mark human items SKIPPED and keep moving. End on the §6 real DoD, not the validator count.

> Foundation strength = the green checkmark finally measures the right thing: a repo that **builds, passes real tests, enforces its own invariants, and completes a real purchase end-to-end** — with every remaining gap either fixed or honestly logged for a human.
