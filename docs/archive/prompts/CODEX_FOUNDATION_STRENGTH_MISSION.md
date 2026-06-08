# CODEX FOUNDATION-STRENGTH MISSION (FS)

**Objective:** Make LetBuyy *fundamentally* production-strong in a single mission. Resolve every finding in `PRODUCTION_READINESS_AUDIT_2026-06-07.md` (P0 → P3). Where a step requires a human/account/credential/DNS action, **do not stop** — implement the safe code path, leave a typed/guarded skip marker, record it under `SKIPPED — NEEDS HUMAN` with a future-proof command, and continue. Land everything green against the **real** gates, not the simulation gates.

> **Prime directive — never block on a human.** If a task needs secrets, DNS, a provider account, a protected DB, or a deploy credential: write the production-correct code, gate it behind an explicit fail-loud/`SKIP_NEEDS_HUMAN_*` marker or `SkipNeedsBackendException`, add the test/validator that will enforce it once the human action lands, append a `SKIPPED — NEEDS HUMAN` entry (with the exact future-proof command), and move to the next task. The mission must run end-to-end in one go.

---

## 0. Canonical references (read first, in this order)

1. `AGENTS.md` (root constitution) — obey first.
2. The nearest local `AGENTS.md` for every package/app/service you touch.
3. `docs/governance/`.
4. `CLAUDE.md` (runtime map, deprecated-alias policy, reserved-service policy).
5. `PRODUCTION_READINESS_AUDIT_2026-06-07.md` (the findings this mission closes).
6. Prior pattern: `CODEX_DOMAIN_SPLIT_LEDGER.md` / `…_STATUS.md` and `CODEX_FOUNDATION_HARDENING_STATUS.md` — match this LEDGER/STATUS style exactly.

**Respect existing architecture decisions** (from the domain-split mission):
- `letbuyy.com` = platform control-plane apex (admin, accounts, api, console, developer, marketplaces, webhooks, transactional email). `letbuyy.store` = **storefront-only** (wildcard `*.letbuyy.store` shopper storefronts + merchant custom domains). **Do not rewrite legitimate storefront `.store` usage to `.com`.** Only platform/control-plane + email + payment-redirect + mobile-platform endpoints move to `.com`.
- Platform cookies are env-scoped via `COOKIE_DOMAIN`; storefront cookies stay host-only (`__Host-`, no `domain`). Do not regress this.
- Reserved services/mobile apps stay manifest-only until a human-approved scope adds real source. Do not implement reserved roots; do make the topology honest about them (FS-9).

---

## 1. Branch, deliverables, working-tree rules

- Work on branch `stream/foundation-strength`. If it exists with unique commits, or switching would overwrite user-owned dirty files, **do not** reset/stash/force — record the collision under `SKIPPED — NEEDS HUMAN` and keep working on the current worktree.
- Create and continuously update two artifacts in the repo root for the duration of the mission:
  - `CODEX_FOUNDATION_STRENGTH_LEDGER.md` — architecture decisions, baseline capture, and a timestamped progress log (`[FS-N] <title> — DONE | DONE/SKIPPED HUMAN`, with **Commands run exactly**, **Evidence**, and any **SKIPPED — NEEDS HUMAN**).
  - `CODEX_FOUNDATION_STRENGTH_STATUS.md` — current phase, baseline vs current gate metrics, and the consolidated `SKIPPED — NEEDS HUMAN` list (each with a **Future proof command**).
- Every code change ships with its enforcement: a unit/contract/behavioral test **and**, where structural, a new `scripts/validators/*.mjs` wired into `scripts/validate-governance.mjs`. **Governance is additive** — final validator count ≥ baseline count.
- Never weaken or delete a validator to make a gate pass. Never commit real secrets. Keep `.gitignore` coverage intact.

---

## 2. Skip protocol (use the existing conventions — do not invent new ones)

- **Secrets/bindings:** never hardcode. If a value must exist for code to run but is human-provisioned, reference it from `env`/Worker secret and fail loud at boot if absent in production. Where a placeholder is unavoidable in committed config, use the existing `SKIP_NEEDS_HUMAN_<NAME>` token and ensure runtime **refuses** it (don't silently run with a placeholder).
- **Backend-not-ready (mobile/UI):** keep using `SkipNeedsBackendException` / equivalent guarded UI, but only where the backend genuinely cannot exist yet. If this mission builds the backend, remove the skip and wire the real call.
- **Mission-level human action:** add to `SKIPPED — NEEDS HUMAN` in STATUS with a copy-pasteable **Future proof command** (e.g. `wrangler secret put …`, `vercel env add …`, `supabase db push --db-url …`, `gh pr create …`).
- Add a new validator `scripts/validators/skip-marker-integrity-validator.mjs` that asserts: (a) no `*_SECRET|*_KEY|*_TOKEN` appears as a plaintext value in any `wrangler.toml [vars]` / committed `*.env` (non-example); (b) every `SKIP_NEEDS_HUMAN_*` / `SkipNeedsBackendException` site is matched by an entry in `CODEX_FOUNDATION_STRENGTH_STATUS.md`. Wire it into governance.

---

## 3. Baseline first — FS-0

Capture the real baseline before any change; record verbatim in the LEDGER. Run from a clean tree:

```
pnpm install --frozen-lockfile --force
pnpm turbo typecheck --output-logs=errors-only --log-order=grouped
pnpm lint
pnpm turbo build
pnpm turbo test --output-logs=errors-only --log-order=grouped
pnpm run test:contracts
pnpm run test:behavioral
flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models
find apps services packages -type d \( -name node_modules -o -name .turbo -o -name .next -o -name .wrangler -o -name dist -o -name .dart_tool \) -prune -exec rm -rf {} +
pnpm run validate:governance
```

Record pass/fail + counts for each. If the sandbox blocks network/IPC (npm registry DNS, TSX `listen EPERM`), note it and rerun with the escalation already documented in prior ledgers; never let a sandbox-only failure mask a real one. **`pnpm turbo build` passing is a required gate in this mission** (the audit relied on per-package `tsc`; this mission must prove the whole graph builds).

---

## 4. Execution phases

Each phase: implement the real fix, add enforcement (test + validator), run the phase gate (`pnpm turbo typecheck` + targeted tests + `pnpm run validate:governance`), log it. Order matters — P0 deploy-blockers first.

### FS-1 · Kill committed placeholder secrets (P0-1)
- `services/mobile-bff/wrangler.toml` lines ~30/60/100: remove `INTERNAL_API_SECRET = "SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET"` from `[vars]`/`[env.*.vars]`. The value must come from a Worker **secret**, not committed config.
- `services/mobile-bff/src/index.ts` (~139): keep/strengthen the guard that **rejects** any internal secret starting with the placeholder prefix or empty → return 503 with a clear `PAYMENT/SERVICE_UNCONFIGURED`-style code, and log loudly at boot.
- Add `scripts/validators/skip-marker-integrity-validator.mjs` (see §2) and wire into `validate-governance.mjs`.
- **SKIPPED — NEEDS HUMAN:** provision the real secret. Future proof: `wrangler secret put INTERNAL_API_SECRET --env production` (and `--env staging`) for `services/mobile-bff`, matching the value used by `services/api-gateway`.

### FS-2 · Rate limiter must not fail the whole site (P0-2)
- `services/api-gateway/src/middleware/rateLimit.ts` (~793-804, 958-965): when production and Upstash Redis is unavailable, **fall back to the always-present KV (`CACHE`) limiter** instead of returning `unavailable: true`. Only hard-fail if BOTH Redis and KV are unavailable. Preserve current limits/semantics on the KV path.
- Add `scripts/validators/rate-limit-fallback-validator.mjs` asserting the limiter has a KV fallback and is not unconditionally fail-closed in prod; add a behavioral test simulating "Redis absent" → requests still served + throttled via KV.
- Add a production deploy gate (extend `validate:security` or `production-readiness-validator`) that records Upstash as **recommended** and KV fallback as **required**.
- **SKIPPED — NEEDS HUMAN:** provision Upstash for prod. Future proof: `wrangler secret put UPSTASH_REDIS_REST_URL --env production && wrangler secret put UPSTASH_REDIS_REST_TOKEN --env production`.

### FS-3 · Finish the domain migration (P0-3)
- Sweep all hardcoded `letbuyy.store` literals in **TypeScript and Dart** that belong to platform/control-plane/email/payment-redirect/mobile-platform surfaces. Replace with env/config-driven values; make the env **required & fail-loud** (no `|| 'https://...letbuyy.store'` fallbacks). Known anchors:
  - `apps/identity-platform/src/lib/auth/cookies.ts` (cookie domain), `config/env/production.env.example` (`COOKIE_DOMAIN`) — make required; invert the template so `.com` is the active default and `.store` is the `# ROLLBACK:` comment.
  - `apps/storefront-runtime/next.config.ts` (CSP `frame-ancestors` for admin/console) — env-driven, required.
  - `apps/identity-platform/src/lib/email/resend.ts` (`FROM_EMAIL`, support links) → `.com`, config-driven.
  - `services/api-gateway/src/routes/payments.ts` (~756-757 Stripe success/cancel URLs) → config-driven storefront/checkout base; **note** checkout success/cancel belong to the storefront realm — drive from the storefront base URL config, not a literal.
  - Mobile: `apps/mobile/merchant-app/lib/config/app_config.dart` + `packages/dart/core/lib/src/constants/*` (BFF/identity/platform endpoints → `.com`; keep storefront `.store` where it is genuinely the storefront).
  - Footers/proxies in `app-marketplace`, `theme-marketplace`, `developer-portal`, platform portals.
- **Do not touch** legitimate storefront wildcard `.store` usage (per domain-split decision). When ambiguous, treat control-plane/admin/api/accounts/webhooks/email as `.com`; shopper storefront as `.store`.
- Add `scripts/validators/dart-domain-literal-validator.mjs` (none exists for Dart) that fails on raw `letbuyy.store`/`letbuyy.com` string literals in `.dart` outside `AppConfig`/declared constants; extend the existing TS domain/cookie validators to cover the new anchors. Add contract tests.
- **SKIPPED — NEEDS HUMAN:** the live env flip + DNS/host cutover (same release). Future proof: `vercel env add COOKIE_DOMAIN production` = `.letbuyy.com`; move Worker routes in `wrangler.toml` + `config/runtime/cloudflare-topology.json`; 301 old hosts. (Carry forward any open items already listed in `CODEX_DOMAIN_SPLIT_STATUS.md`.)

### FS-4 · Fail-loud signing secrets (P0-4)
- Remove every `process.env.<X>_SECRET || ''` / `|| ""` fallback for signing/HMAC/JWT keys. Anchors: `apps/identity-platform/src/lib/auth/cookies.ts:5`, `apps/platform-console/src/lib/console-session.ts:24`. Add a shared `requireSecret(name)` helper that throws at module init/boot when missing in production.
- Add `scripts/validators/no-empty-secret-fallback-validator.mjs` that greps for `_SECRET`/`_KEY`/`JWT`/`AUTH_SECRET` followed by `|| ''|""` and fails. Add a unit test for `requireSecret`.

### FS-5 · Enforce tenant isolation (P1-1)
- The api-gateway runs as service-role (RLS bypassed) in ~500 places; isolation rests on 151 manual `verifySiteOwnership` calls across 36 route files. Make it enforced:
  - Introduce a typed, store-scoped query helper (e.g. `tenantQuery(db, { storeId })`) that requires a verified `storeId`, and migrate tenant-scoped reads/writes onto it incrementally where low-risk.
  - Add `scripts/validators/tenant-ownership-coverage-validator.mjs` + a behavioral test that enumerates routes touching tenant tables (`orders`, `products`, `sites`, `subscriptions`, `customers`, etc.) and asserts each is preceded by an ownership check **or** carries an explicit reviewed `// tenant-public: <reason>` allowlist annotation.
  - For any route that is genuinely ambiguous, add the annotation + a `SKIPPED — NEEDS HUMAN` review note rather than guessing.

### FS-6 · Build the missing notification surfaces (P1-2)
- Implement real sends via the existing `RESEND_API_KEY` binding (notification-service is reserved/empty — implement in `api-gateway` and/or `queue-workers`, not the reserved service):
  - Employee invite email — `services/api-gateway/src/routes/employee.ts:287`, `admin.ts:283`.
  - Contact-form notification to store owner — `services/api-gateway/src/routes/contacts.ts:48`.
  - `order.paid` consumer — emit already exists (`routes/payments.ts emitOrderPaidEvent`); add a consumer (queue-workers or webhook fan-out) that sends the merchant order-alert + customer receipt.
- Add contract/behavioral tests with Resend mocked. Remove the corresponding `TODO`s.
- **SKIPPED — NEEDS HUMAN:** verify Resend sending domain/DNS (SPF/DKIM) for `.com`. Future proof: configure domain in Resend dashboard + DNS records; `wrangler secret put RESEND_API_KEY` per env if not set.

### FS-7 · Constant-time secrets + internal-route brute-force (P1-3, P1-4)
- `services/webhook-service/src/index.ts:568,658`: replace `dispatchAuthHeader(...) !== secret` with the already-imported `timingSafeEqual`.
- `services/api-gateway/src/index.ts:565-568`: add a strict per-IP limiter (keyed on `CF-Connecting-IP`, counts rejected auth attempts) on `/internal/console`, `/internal/billing`, `/internal/events`, `/internal/store-access` — independent of the global leaky bucket.
- Add validators/tests: extend `single-source-crypto`/security validators to forbid `!==` on secret comparisons repo-wide; behavioral test for the internal-route limiter.

### FS-8 · Resilience: sessions, error boundaries, edge middleware (P1-5, P1-8, P1-9)
- `apps/merchant-control-plane/src/lib/auth/session.ts:23,46,91`: distinguish 401/403 (real logout) from network/5xx (transient) — on transient, throw a typed error that renders an error boundary; do not redirect-to-login or `notFound()` a valid merchant.
- Add root `error.tsx` + `not-found.tsx` to **every** Next.js app (start with `storefront-runtime`, `merchant-control-plane`, `identity-platform`); branded, no framework-info leak. Add `loading.tsx` where server components can stall.
- `apps/storefront-runtime/src/middleware.ts:39,45,50`: move required-env assertions to `instrumentation.ts` (boot-time, fail-loud) and make the request path degrade gracefully (typed 503 page) instead of throwing per-request.
- Validator: assert each app has `error.tsx` + `not-found.tsx`; behavioral test for session error-vs-logout branching.

### FS-9 · Make deployment topology honest (P1-6)
- `config/runtime/deployment-topology.json`: mark the six reserved services (`event-bus`, `analytics-pipeline`, `checkout-runtime`, `media-service`, `notification-service`, `search-service`) with `"status":"placeholder"`; exclude them from health-check evaluation and from being declared hard dependencies of live services.
- Update the topology/health validators + survivability tests to assert placeholder services are **not** health-checked and **not** treated as live deps. Keep CLAUDE.md's reserved-policy intact.

### FS-10 · Mobile completeness (P1-7 + P2 mobile)
- Device tokens / push: implement `POST/DELETE /v1/push/device-tokens` in the gateway (+ BFF passthrough); remove the throws in `apps/mobile/merchant-app/lib/services/push_service.dart:71,81` and wire the real call.
- Wire onboarding save (`create_store_wizard.dart:285`) to the existing onboarding endpoint; implement product-row tap → edit nav (`products_screen.dart:931`); implement export against `routes/export.ts` (`products_screen.dart:333`); add an analytics timeseries endpoint + render the existing chart widget (`analytics_screen.dart:120-353`); declare `mobile_scanner` in `pubspec.yaml` and un-skip the barcode path (`inventory_service.dart:686`).
- Update `flutter analyze` + `mobile_services_test.dart`; keep `SkipNeedsBackendException` only where a backend still genuinely can't exist (then add a `SKIPPED — NEEDS HUMAN` note).
- Remove dead shopper-app API surface from the shared `packages/dart/core` (move to a reserved package or delete) per the dead-source policy.

### FS-11 · Input & output hardening (P2)
- `services/api-gateway/src/routes/contacts.ts`: add a Zod schema + `validate('json', ContactFormSchema)` (message ≤ 2000, email/phone format, store_id uuid).
- XSS (`middleware/security.ts:113-124`): decide and enforce — mandatory output-escaping in `theme-engine` rendering (add a validator/test that storefront templates escape product/blog content) and/or sanitize rich fields at ingestion. Pick the theme-escaping path as the primary, enforced control.

### FS-12 · Split real gates from evidence theater (P1-10) — the foundation fix
- In `package.json`, introduce:
  - `validate:ci-gates` = the **real** gates: `turbo typecheck` + `turbo build` + structural validators (architecture, circular-import, undeclared-import, package-export, domain-boundary, dead-residue, single-writer-ownership, single-source-crypto, the new FS validators) + `test:contracts` + `test:behavioral` + `turbo test`.
  - `validate:evidence` = the certification/lineage/convergence/replay-simulation family (the ~60-70 markdown/JSON string-match validators) — runs **advisory, non-blocking, human-review**.
- `.github/workflows/ci.yml`: make `validate:ci-gates` the blocking gate; run `validate:evidence` as a non-blocking advisory job. Keep `validate:governance` runnable but no longer the sole readiness signal. Document this in `docs/governance/` so the meaning of "green" is explicit.

### FS-13 · Repo hygiene & enforcement (P3)
- `git mv` root AI work-logs into `docs/archive/root-residue/2026-06-07/`: `CODEX_FOUNDATION_HARDENING_*`, `CODEX_UI_FOUNDATION_*`, `CODEX_DOMAIN_SPLIT_*`, `LETBUYY_*`, `MERGE_RUNBOOK.md`, and the `FORENSIC_REPORT*/` dirs. **Do not move this mission's own `CODEX_FOUNDATION_STRENGTH_*` files or `PRODUCTION_READINESS_AUDIT_2026-06-07.md` while the mission is in flight.** Update any references; run `node scripts/generate-repository-intelligence.mjs` after.
- Add a pre-push hook (husky or lefthook) that runs `pnpm run validate:ci-gates` on changed scopes; document it.
- Move/retire the pure-simulation validators into the `validate:evidence` bucket (do not delete history; keep them runnable).

### FS-14 · Final certification + PR
- Clean artifacts, then run the full real-gate suite (the FS-0 command set) and confirm: `turbo build` PASS, `turbo typecheck` PASS, `test:contracts`/`test:behavioral`/`turbo test` PASS, `flutter analyze` PASS, `validate:governance` PASS with count ≥ baseline, `validate:ci-gates` PASS.
- Regenerate `node scripts/generate-repository-intelligence.mjs`.
- Finalize `CODEX_FOUNDATION_STRENGTH_STATUS.md` with the full `SKIPPED — NEEDS HUMAN` list (each with a future-proof command) and the staging smoke-test checklist below.
- Open a PR `stream/foundation-strength` → `develop` titled `feat(foundation): production-strength hardening (P0–P3)`, body = the STATUS file. If blocked by a dirty-branch collision, record it under `SKIPPED — NEEDS HUMAN` with the future-proof `git`/`gh` commands and stop short of force-anything.

---

## 5. Definition of done (the real readiness bar — replaces "167 validators green")

A. `pnpm turbo build` + `pnpm turbo typecheck` + `pnpm lint` all PASS on a clean checkout.
B. `pnpm run test:contracts` + `pnpm run test:behavioral` + `pnpm turbo test` + `flutter analyze` all PASS.
C. `pnpm run validate:ci-gates` PASS; `validate:governance` PASS with validator count ≥ FS-0 baseline (new FS validators added).
D. No committed plaintext secret; no empty-string signing-key fallback; no platform `letbuyy.store` literal that env can't override; rate limiter degrades to KV, not 503.
E. Every deferred human action is in `CODEX_FOUNDATION_STRENGTH_STATUS.md → SKIPPED — NEEDS HUMAN` with a copy-paste future-proof command.
F. **Human-gated final acceptance (record as SKIPPED — NEEDS HUMAN, do not attempt in sandbox):** staging smoke test — signup → create store → add product → storefront checkout → pay (Razorpay/Stripe) → order recorded → merchant + customer notification sent. Future proof: run against staging after secrets/DNS/migrations are applied.

---

## 6. Guardrails (do not violate)
- Follow `AGENTS.md` first; run `node scripts/validate-governance.mjs` after any topology/import/package/env/generated-artifact change.
- Additive governance only; never weaken/delete a validator to pass.
- Never recreate deprecated app aliases; never implement reserved roots.
- Never overwrite user-owned dirty files; never `git reset --hard`/`stash drop`/force-push without a human.
- One mission, one pass: skip-and-continue on every human gate; finish with everything else green.
