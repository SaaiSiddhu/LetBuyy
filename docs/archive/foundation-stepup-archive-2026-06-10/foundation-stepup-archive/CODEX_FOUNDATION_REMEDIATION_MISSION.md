# CODEX — FOUNDATION REMEDIATION MISSION (Truth-First Step-Up)

**Version:** 1.0 · **Date:** 2026-06-09 · **Type:** EXECUTION mission (Codex writes code) · **Authority:** governed by `AGENTS.md` → local `AGENTS.md` → `docs/governance/`, then this file.
**Evidence base (read first, trust the code it cites, not its prose):** `FOUNDATION_FORENSICS_2026_06_09/` (17 reports + README). Headline verdict: *“a good commerce core wearing a costume three sizes too big.”* Composite ≈45/100, **REQUIRES RESTRUCTURING** — a two-quarter foundation step-up, **not** a rewrite.

> This mission fixes the **foundation** before any further feature work. You are not adding features. You are making what already exists **true, safe, and legible**. The hard, valuable parts (ledger kernel, inventory concurrency, order state machine, theme engine, design tokens, clean module graph) already exist and are FROZEN. The danger is the gap between what the repo *claims* and what it *does*. Close that gap.

---

## 0. PRIME DIRECTIVES (these override convenience, velocity, and your own cleverness)

1. **TRUTH OVER APPEARANCE — never fabricate.** Do not invent identifiers, balances, statuses, receipts, or “success”. If a real integration cannot be completed (no credentials, no vendor), you **gate the feature OFF** behind an explicit flag and surface an honest *“not available”* — you do **not** simulate it. The existing fake `UTR${token}` payout is the exact anti-pattern this mission exists to delete.
2. **MONEY IS SACRED.** Every money state-change (capture, refund, payout, commission, COD, wallet) MUST post to the canonical double-entry ledger (`database/supabase/migrations/139_*`) **atomically, in the same DB transaction** as the state change, **idempotently**. The ledger is the system of record, never a projection of in-memory math. No money may be marked “released”/“paid” without a real provider reference persisted.
3. **TENANCY IS FAIL-CLOSED.** Because the request path runs as `service_role` (RLS is inert — see WS-2 evidence), isolation MUST be enforced by a data layer that *refuses* to touch a tenant table without a `store_id`/`site_id` predicate. A forgotten scope must throw, not leak.
4. **DON’T BREAK THE FROZEN CORE** (Section 3). If a change requires touching frozen code, stop and open a `HUMAN_REQUIRED` note instead.
5. **NO STUBS-AS-DONE.** A task is “done” only when a real behavioral test proves it. Name-grep validators and self-attesting certifications do **not** count as proof (≈46% of the 177 validators are decorative — do not add to them; see WS-0).
6. **SMALL, REVERSIBLE, VERIFIED.** One workstream per branch, one concern per commit, conventional-commit messages, every PR green on the *behavioral* gates. Prefer quarantine over deletion; preserve git history.
7. **WHEN BLOCKED, ESCALATE — don’t paper over.** Anything you cannot legitimately do (provision real secrets, sign vendor contracts) goes in `HUMAN_REQUIRED.md` (Section 9), and the dependent feature ships **disabled**, not faked.

---

## 1. GROUND TRUTH (what LetBuyy actually is — build on this, stop fighting it)

- **One real backend:** `services/api-gateway` (~62 routes, Hono on Cloudflare Workers, Supabase, no ORM). The microservice-mesh / event-sourced / distributed-runtime narrative executes in **zero** production paths. Accept the modular monolith; it works.
- **Real & FROZEN assets:** double-entry ledger kernel (`migrations/139`), order state machine (`migrations/147`), `SELECT … FOR UPDATE` inventory (`migrations/141`), section/block theme engine (`packages/theme-engine`), four-layer design tokens (`packages/typescript/ui/src/tokens.ts`, 303 `--lb-` tokens), acyclic package graph (0 app↔app imports).
- **The failures are localized to swappable adapters and a few wiring gaps** — not diffused through the architecture. That is precisely why this is a restructuring, not a rewrite.

---

## 2. FROZEN — DO NOT MODIFY, REDESIGN, OR “IMPROVE” (without a `HUMAN_REQUIRED` sign-off)

- The ledger kernel schema and its triggers: `database/supabase/migrations/139_*` (append-only trigger, deferred balance enforcement, idempotency key, `post_ledger_transaction`, `ledger_balance_breaks()`).
- The order state machine (`migrations/147`) and inventory locking (`migrations/141`).
- The section/block theme model (`packages/theme-engine/src/theme-registry.ts`) and draft→publish lifecycle.
- The design-token source of truth (`packages/typescript/ui/src/tokens.ts`) and the single `LetbuyyThemeProvider` (`packages/typescript/ui/src/theme-provider.tsx`).
- Package boundaries (acyclic graph; no app imports another app; no package imports an app; no `createClient` in app `src/`).
- The real auth primitives already verified good: bcrypt-12 hashing, AES-GCM TOTP construction, opaque server-revocable sessions, SEC-H3 weak-key refusal (`apps/identity-platform/src/lib/auth/cookies.ts`), and the fixed `/api/auth/switch` device-proof check.

You may *consume*, *wire*, and *extend* these. You may not rewrite them.

---

## 3. OUT OF SCOPE FOR THIS MISSION (do NOT start — they come after the foundation is true)

OIDC provider build · App marketplace / extensions / app-blocks build · Analytics pipeline · Search service · Real-time / AI features · Net-new product surfaces · Any “V2 platform” distributed-runtime work.
If you find yourself building any of the above, **stop** — you’ve left the mission.

---

## 4. WORKING AGREEMENT

- **Branches:** `fix/ws-<n>-<slug>` (e.g. `fix/ws1-money-integrity`). One workstream per branch; land it green before the next.
- **Commits:** conventional commits, scoped, atomic. Reference the workstream (e.g. `fix(payments): post capture to ledger [WS-1.2]`).
- **Validation you MUST run before opening a PR** (real gates only):
  - `pnpm run validate:dependencies` (acyclic graph, undeclared imports, exports) — must stay green.
  - `pnpm run test` and the relevant `pnpm --filter @letbuyy/<pkg> run test` for code you touched.
  - The **new** behavioral tests this mission requires (money-reconciliation, tenant-isolation, anti-fabrication — Sections 6 & 8).
  - Do **not** rely on name-grep validators or `certify:production` self-attestation as proof of done.
- **Ledger of work:** append a dated entry to `CODEX_FOUNDATION_REMEDIATION_LEDGER.md` (create it) per workstream: what changed, file:line, the test that proves it, and any `HUMAN_REQUIRED` items spun off. Keep claims falsifiable.
- **Prohibited:** committing real secrets; widening `service_role` usage; adding fake/mock data to a production path; marking a feature “done” while it returns simulated output; deleting validators (reclassify instead).
- **Sequencing gate:** **WS-3.1 (backups/PITR) must be live before any WS-1 money-schema migration is applied to a shared/staging/prod database.** Never run destructive money migrations without a tested restore path.

---

## 5. WORKSTREAMS

Execute in this order (matches the CTO priority list). Each is self-contained: **Problem → Definition of Done → Steps → Guardrails → Acceptance.**

---

### WS-0 · FOUNDATION STEP-UP — make the foundation legible & make change safe

**Problem (evidence):**
- A distributed-systems tower runs in **zero** product paths yet sits in the build closure: `tsconfig.workspace.json:24,26` reference `packages/distributed-runtime` (74 files) and `packages/projection-runtime` (15 files); product mutations actually go route → `*ExecutionAdapter` → raw `db.from(table)` + an `outbox_events` upsert. ~10K LOC compiled every CI run for nothing.
- A dormant parallel identity stack (gateway-side `services/api-gateway/src/identity-foundation/` and app-side `apps/identity-platform/src/lib/identity-foundation/` + the 5 contract packages `token-core/session-core/permission-core/organization-core/audit-core`) is reachable from nothing real.
- Six manifest-only “services” are presented as topology: `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/` (only `AGENTS.md` + `runtime.manifest.json`).
- ≈46% of the 177 validators “prove” invariants by grepping for a function-name string (e.g. `scripts/validators/split-brain-validator.mjs`), and 57 assert against manifests that self-declare `"governance-contract-not-live-evidence"`.

**Definition of Done:**
- The dead tower and dormant identity V2 are **quarantined** (excluded from the build/test/deploy closure and from any “capability” manifest) — not deleted, history preserved, clearly labeled non-runtime.
- The 6 paper services are explicitly marked **reserved** and excluded from `build`/`deploy`/topology — they can never be deployed or counted as capability.
- Validators are split into two lanes: **`gate`** (behavior-testing → blocks CI) and **`report`** (decorative/name-grep → informational only). Only `gate` blocks merges.
- The **anti-fabrication harness** (Section 8) exists and runs in CI as a `gate`.

**Steps:**
1. Confirm zero runtime importers of `@letbuyy/distributed-runtime` / `@letbuyy/projection-runtime` from `apps/**` and `services/**` (re-grep; the forensics found none). If truly zero, remove their `{ "path": … }` entries from `tsconfig.workspace.json`, drop them from `turbo`/build filters, and move them under a top-level `quarantine/` (or mark `"private": true` + exclude from `pnpm` build filter) with a `README` explaining they are non-runtime pending a real wiring decision.
2. Same treatment for `identity-foundation/` dormant V2 and the 5 unused identity-contract packages **if** no runtime path imports them (verify per-package; some `-core` *types* may still be imported — keep those that are, quarantine those that aren’t).
3. In `pnpm-workspace.yaml` / `turbo.json` deploy filters, tag the 6 reserved services so no pipeline deploys them; ensure CLAUDE.md’s “reserved” status is reflected in the actual filters, not just docs.
4. Add a `validators.manifest.json` classifying every script in `scripts/validators/` as `gate` or `report`; update `package.json` so CI runs `gate` as blocking and `report` as non-blocking. Do **not** delete any validator.

**Guardrails:** Quarantine, never `rm`. If any quarantine candidate has even one real runtime importer, leave it and log it. Do not touch the FROZEN list.

**Acceptance:** `pnpm run build` and `pnpm run validate:dependencies` stay green with the tower out of the closure; a CI run shows the `gate`/`report` split; `git grep` shows no `apps/**` or `services/**` runtime import of the quarantined packages.

---

### WS-1 · MONEY INTEGRITY — the ledger becomes the truth, and money cannot be faked

**Problem (evidence — all verified firsthand):**
- **Payouts are fabricated.** `packages/infrastructure/payout-transfer-adapter/index.ts:82-103` makes **no provider HTTP call** in any mode and mints a fake bank UTR (`utr: \`UTR${referenceToken.slice(0,16)}\``); `services/api-gateway/src/routes/payouts.ts:544-577` debits the wallet and posts a ledger “release” for money that never moved.
- **Capture never posts to the ledger.** `buildPaymentCaptureLedgerPosting` (`packages/payments/src/index.ts:420`) exists but its **only caller is the unit test** (`packages/payments/test/payments.test.ts`). The ledger is therefore a downstream projection of `orders.total`, not the system of record.
- **Mock is the default money mode.** `services/api-gateway/src/routes/payments.ts:130` resolves provider mode to `… || 'mock'`; mock capture writes a synthetic `provider_payment_id` and marks orders paid with **no** provider involvement (`payments.ts:604`).
- **Money-width overflow.** `database/supabase/migrations/119_*` declares `*_minor` amounts as `integer` (e.g. `gross_amount_minor`, `net_payable_minor`) → overflow at ₹21,474,836.47; canonical `139/151` correctly use `bigint`.
- Counterweight (already real — keep): inbound webhook HMAC verification + `payment_webhook_events` idempotency in `services/webhook-service`; `/subscription/verify` server-side Razorpay re-check (`payments.ts:1101-1118`).

**Definition of Done:**
- Every successful **capture** posts a balanced ledger entry to `pa_clearing` in the same transaction, idempotently.
- **Payouts** either (a) execute a real provider transfer (RazorpayX / Cashfree Payouts) and persist the provider’s real reference, or (b) are **disabled** behind a feature flag with an honest “payouts not available” response — **never** a fabricated UTR, and **never** a wallet debit / ledger “release” without a real provider reference.
- `mock` payment mode is **impossible** in any production-like runtime (fail-closed); there is no `'mock'` default.
- All money columns are `bigint` minor units.
- Every money mutation requires an idempotency key and rejects duplicates.
- A reconciliation test proves `ledger_balance_breaks()` returns empty across a full capture→settle→payout lifecycle.

**Steps:**
1. **Wire capture → ledger.** Call the ledger posting (`buildPaymentCaptureLedgerPosting` / `post_ledger_transaction`) at the real capture success points in `routes/payments.ts` and the payment execution adapter, inside the same DB transaction as the order/payment state write. Debit `pa_clearing`; credit the merchant payable per the ledger model.
2. **De-fang mock mode.** Remove the `|| 'mock'` default in `resolvePaymentProviderMode` (`payments.ts:130`); require an explicit mode; in a production runtime (`isProductionRuntime(env)`), **reject** `mock` with a hard error at boot/first-use. Keep `mock` usable only under an explicit non-prod test flag.
3. **Replace the payout adapter** (`packages/infrastructure/payout-transfer-adapter/index.ts`): implement a real provider transfer with signature/idempotency; on success persist the **real** UTR/reference; on missing credentials, throw a typed `PayoutProviderUnavailable` that the route translates into a disabled-feature response. Update `routes/payouts.ts` so the wallet debit + ledger “release” happen **only after** a confirmed provider transfer, atomically. Add the provider credentials to `HUMAN_REQUIRED.md`.
4. **Migrate money width.** New forward migration converting all `integer` `*_minor` columns in the `119` family to `bigint` (no data loss). Add a schema test asserting no tenant money column is `integer`.
5. **Idempotency:** ensure capture/refund/payout/commission accept and enforce an idempotency key (extend the inbound pattern outbound).

**Guardrails:** Do not alter the FROZEN ledger kernel schema/triggers — *use* them. Never post a ledger entry for money that did not move. If unsure whether a path moves real money, treat it as real and gate it.

**Acceptance (behavioral tests, must be green):**
- `capture → ledger`: a capture produces a balanced `pa_clearing` posting; replaying the same capture is a no-op (idempotent).
- `payout truth`: with no provider credentials, payout returns disabled and performs **no** wallet debit and **no** ledger entry; with a (mocked-at-the-HTTP-boundary) provider success, a real reference is persisted and the ledger balances.
- `no-mock-in-prod`: booting the gateway with `isProductionRuntime` and mode `mock` fails closed.
- `money width`: a property test pushes an amount > ₹21,474,836.47 through capture/settlement without overflow.
- `reconciliation`: `ledger_balance_breaks()` is empty after a full lifecycle.

---

### WS-2 · TENANT ISOLATION — correct-by-construction, not by convention

**Problem (evidence):**
- The authenticated data path runs as **service_role**, bypassing all 685 RLS policies: `services/api-gateway/src/lib/supabase.ts` exposes `getSupabaseAdmin` (service role — “bypasses RLS”, **98 call-sites**) and `getSupabaseUser` (respects RLS, **0 call-sites**). Isolation survives only because handlers hand-write `verifySiteOwnership` / `.eq('store_id', …)` (`lib/auth-user.ts:40-67`, `lib/tenant-context.ts:176-249`). The first `:id` handler that forgets the scope is a silent cross-tenant breach with no DB backstop.
- A static `PLATFORM_CONSOLE_API_TOKEN` mints a synthetic `super_admin` with a fake audit subject (`services/api-gateway/src/middleware/auth.ts:216-231`; `rbac.ts:330-333`). `requireRole` trusts a JWT role claim.

**Definition of Done:**
- A **tenant-scoped data-access layer** exists that *refuses* (throws) any read/write of a tenant-owned table without an explicit `store_id`/`site_id`/owner predicate. Tenant routes use it; raw `getSupabaseAdmin().from(<tenant table>)` without scope is lint-banned.
- Every `:id` tenant resource handler is proven non-IDOR by a cross-tenant access test.
- The static `super_admin` god-token is removed; console/ops access uses real per-principal identities with real audit subjects; `requireRole` derives authority from a server-side membership lookup, not a token claim.

**Steps:**
1. Introduce `tenantScoped(db, ctx)` (or a thin repository) that wraps the service client and, for a known set of tenant tables, *requires* a scoping predicate and injects it; accessing a tenant table without it throws `UnscopedTenantQueryError`. Centralize the tenant-table registry.
2. Migrate the highest-risk routes first (`orders`, `customers`, `payouts`, `settlements`, `products`, `wallet`, `contacts`, `kyc`) to the scoped layer; then the rest. Keep `verifySiteOwnership` as a second factor.
3. Add an ESLint rule (or a `gate` validator) banning `getSupabaseAdmin(…).from('<tenant table>')` outside the scoped layer.
4. Remove the static-token `super_admin` shortcut; replace with real principal auth + real audit subject. Make `requireRole` look up role server-side.
5. (Optional, defense-in-depth) where feasible, route reads through `getSupabaseUser` so the 685 RLS policies actually engage.

**Guardrails:** Don’t loosen any existing ownership check while adding the new layer — add, then migrate, then ban. Don’t weaken cross-realm cookie isolation (FROZEN).

**Acceptance:** a parameterized **IDOR test** that, for each tenant resource, authenticates as tenant A and attempts to read/mutate tenant B’s `:id` → expects 403/404 for all; a unit test that `tenantScoped` throws on an unscoped tenant-table access; a test that the removed god-token no longer authenticates.

---

### WS-3 · PRODUCTION READINESS — backups, eyes, and no placeholder secrets

**Problem (evidence):**
- **No continuous backup / PITR** — only a 7-day pre-migration artifact (`/.github/workflows/production-deploy.yml:234-237`; no PITR step in `docs/runbooks/infra-recovery.md`).
- **Observability is config-only** — Prometheus/Grafana/Loki/otel exist as unapplied YAML (`infrastructure/observability/*`), no wired datasource, no deploy step.
- **Placeholder production secrets committed** — `services/api-gateway/wrangler.toml:253-262` contains `SKIP_NEEDS_HUMAN_*` for `WHATSAPP_WEBHOOK_SECRET`, `TWILIO_*`, `AI_*`, `AI_CREDIT_RAZORPAY_KEY_ID`.
- **Domain split** — CI builds with `letbuyy.com` (`ci.yml:253`) while deploy injects `letbuyy.com` (`production-deploy.yml:394-411`); cookie `COOKIE_DOMAIN` defaults to `.letbuyy.com`.

**Definition of Done:**
- **WS-3.1 (do first, prerequisite for WS-1 migrations):** continuous DB backups + PITR configured, with a **tested restore drill** documented in a runbook.
- Observability is **deployed and reachable**: api-gateway emits structured logs + error tracking (e.g. Sentry) + traces; metrics dashboards have live datasources; a minimal alert set fires.
- A deploy-time **secret preflight** hard-fails if any production secret still equals a `SKIP_NEEDS_HUMAN*` sentinel; the dependent features (WhatsApp, Twilio, AI-credit) ship **disabled** until real secrets exist. Real secret values go in `HUMAN_REQUIRED.md` (you cannot self-provision them).
- One canonical domain is chosen and used consistently across build, deploy, and `COOKIE_DOMAIN` (env-driven, no contradiction).

**Steps:**
1. Configure Supabase PITR / scheduled logical backups to R2 with retention; write + dry-run a restore runbook. Block WS-1 money migrations until this is live in staging.
2. Wire observability: deploy the otel collector + dashboards with real datasources; add structured logging + error + trace emission in `services/api-gateway`; define alerts (error rate, payment failures, queue depth, DB saturation).
3. Add `secret-preflight` (a `gate`) run by `production-deploy.yml` that fails on any `SKIP_NEEDS_HUMAN*`; gate WhatsApp/Twilio/AI features behind `feature.enabled = secretPresent`.
4. Unify the domain: pick canonical (per repo memory, `letbuyy.com`), make build+deploy+`COOKIE_DOMAIN` agree via one env var; document the cutover.

**Guardrails:** Never commit a real secret to resolve the preflight — that’s the human’s job; you only make placeholders *impossible to ship silently*.

**Acceptance:** a restore drill succeeds from backup in staging; a deploy with a `SKIP_NEEDS_HUMAN*` secret **fails** the preflight; dashboards show live api-gateway metrics; a synthetic error appears in the error tracker; grep shows no `letbuyy.com`/`letbuyy.com` contradiction across build+deploy+cookies.

---

### WS-4 · DESIGN GOVERNANCE — one authority, enforced (not aspirational)

**Problem (evidence — fresh counts):**
- The design-token system is strong and adopted (`@letbuyy/ui` imported by **9/9** apps; **0** hardcoded hex in `.tsx`; 303 `--lb-` tokens). The weakness is **enforcement + three divergences**.
- `scripts/validators/design-system-baseline.json` **exists** — so the task is to confirm it is wired as a **failing CI gate**, not to create it.
- **Parallel token system:** `apps/marketing-site/src/app/globals.css` defines a second token set (25 hardcoded hex + raw rgba locals; 5,319-line globals).
- **Mobile fork:** **334** raw `Color(0xFF…)` literals across **5** hand-authored Dart color files — not generated from the web token bridge (`scripts/generators/generate-mobile-tokens.mjs`).
- **Inline-style sprawl:** `storefront-runtime` has **574** `style={{…}}` usages (vs 0 in console/ops).
- **Arbitrary scale bypass:** `merchant-control-plane` has **152** `rounded-[…]` arbitrary radii (theme-marketplace 106, ops-portal 54, console 26) bypassing the token radius scale; there are **0** committed `tailwind.config.*` files, so the scale is not centrally enforced.
- **Component dup:** `console-workspace.tsx` and `ops-workspace.tsx` are character-identical and self-tagged `[CONSOLIDATE -> @letbuyy/ui]`; `developer-portal` renders tables as raw HTML instead of the `Table` component; **4** `Header` implementations and **2** `Sidebar` implementations exist across apps.

**Definition of Done:**
- The design-system ratchet (`design-system-baseline.json`) is a **blocking** CI gate; new hardcoded values / arbitrary scale / raw elements fail the build.
- One token authority: `marketing-site` either migrates onto canonical tokens or is formally declared a non-product island excluded from the design surface (decide explicitly; migration preferred).
- Mobile colors are **generated** from the token bridge — the 5 hand-authored color files are replaced by generated output; the `generate-mobile-tokens.mjs --check` gate is green.
- An ESLint/stylelint rule bans arbitrary `rounded-[`/`shadow-[`/`#hex` in app `.tsx`; storefront inline styles get a capped burn-down (token/className conversion) with the cap enforced.
- `ConsoleWorkspace`/`OpsWorkspace` promoted to `@letbuyy/ui`; `developer-portal` tables use the `Table` component; `Header`/`Sidebar` consolidated to the shared shell where feasible.

**Steps:** wire the ratchet as `gate`; add the lint rules; run the mobile token generator and delete the hand-authored color files; migrate marketing-site tokens (or exile + exclude from score); promote the duplicated workspaces; convert developer-portal tables; burn down storefront inline styles against a tracked target.

**Guardrails:** Do not fork tokens to “fix” a screen — converge on `tokens.ts`. Do not touch the FROZEN token source except to *add* missing semantic tokens (with sign-off).

**Acceptance:** CI fails on a deliberately-added hardcoded hex / arbitrary radius; `generate-mobile-tokens.mjs --check` green; grep shows the 5 Dart color files gone (generated equivalents present); storefront inline-style count below the committed cap; no `console-workspace`/`ops-workspace` duplication.

---

### WS-5 · AUTH CONSOLIDATION — one identity world, MFA real

**Problem (evidence):**
- **Two parallel merchant auth systems** coexist and the gateway accepts both: Supabase GoTrue JWT (`routes/auth.ts:1244-1268`) vs custom `users_custom` + opaque session (`routes/auth.ts:411-480`).
- **MFA is enrolled-but-not-enforced** — `authenticate` ignores `merchant_2fa_factors` (`routes/auth.ts:411-480`).
- **Shared admin TOTP** — a single `PLATFORM_CONSOLE_TOTP_SECRET` for all admins (`services/api-gateway/src/identity-foundation/admin-mfa-scaffold.ts:8`).
- **Sessions** are 30-day absolute with no idle timeout and no rotation (`last_active` tracked but unused).

**Definition of Done:** one canonical merchant auth path (the other removed, not left as fallback); MFA enforced at login when enrolled; per-principal admin TOTP; sessions gain idle timeout + rotation. (The good primitives in Section 3 stay FROZEN.)

**Steps:** choose canonical (recommend the custom opaque-session path — it’s real and server-revocable — unless you consolidate onto GoTrue deliberately); remove dual-acceptance; enforce the MFA challenge in `authenticate`; replace the shared admin TOTP with per-principal secrets; add idle-timeout + rotation to session validation.

**Guardrails:** Don’t regress the `/api/auth/switch` fix or cross-realm cookie isolation. Migrate existing sessions safely.

**Acceptance:** a test that credentials accepted by the removed path now fail; an enrolled-MFA login is challenged and rejected without the second factor; two admins cannot share a TOTP secret; an idle session expires; a rotated session invalidates the prior token.

---

### WS-6 · OIDC / IDENTITY-PROVIDER HONESTY — stop advertising what returns 501

**Problem (evidence):** OIDC is a **501 skeleton + mock JWKS**. The mock discovery doc + hardcoded fake JWKS (`x:'mock-x-coordinate'`) live in `apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts`, surfaced through the Next routes `apps/identity-platform/src/app/.well-known/` (incl. `jwks.json`), `apps/identity-platform/src/app/jwks`, and `apps/identity-platform/src/app/oauth2/*` (one-line 501 wrappers). The gateway-side counterpart is `services/api-gateway/src/identity-foundation/oauth-skeleton.ts` (string-concat “hash” of codes). The `FEATURE_IDENTITY_PROVIDER` gate (default false) is read in `services/api-gateway/src/index.ts`.

**Definition of Done (this mission only — do NOT build a real OP here):** ensure `FEATURE_IDENTITY_PROVIDER` is **off** in every real runtime; the discovery/JWKS endpoints return an honest “not enabled” (no `mock:true` doc, no fake keys presented as real); every doc/manifest that presents OIDC as a live capability is corrected; a roadmap stub records OIDC as a *future, real* build with acceptance criteria.

**Steps:** confirm the flag default and runtime gating (`services/api-gateway/src/index.ts`); in `apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts` and the `.well-known`/`jwks`/`oauth2` routes, replace the `mock:true` discovery + `mock-x-coordinate` JWKS payloads with a clean 501/404 “provider not enabled”; do the same for the gateway `oauth-skeleton.ts`; purge OIDC-as-live claims from manifests/READMEs; add `docs/roadmap/oidc.md` describing the real build (deferred).

**Guardrails:** Do not partially implement an OP — honesty now, real build later (out of scope).

**Acceptance:** hitting `.well-known/openid-configuration` in a real runtime returns “not enabled” (never a `mock:true` doc or fake JWKS); no manifest lists OIDC as a delivered capability.

---

## 6. CROSS-CUTTING MISSION-COMPLETE GATES (the whole mission is “done” only when ALL pass)

1. **Anti-fabrication harness** (Section 8) is green: no fabricated identifiers/statuses on any production path.
2. **Money reconciliation** test green; `ledger_balance_breaks()` empty; capture posts to ledger; no money “released” without a real provider reference; all money columns `bigint`.
3. **Tenant IDOR** test green for every tenant resource; `tenantScoped` throws on unscoped access; god-token gone.
4. **Backups restore drill** passes; **secret preflight** blocks `SKIP_NEEDS_HUMAN*`; observability live.
5. **Design ratchet** blocks regressions; mobile tokens generated; no parallel token system in product apps.
6. **Auth**: single merchant path; MFA enforced; per-principal admin TOTP; session idle+rotation.
7. **OIDC** returns honest “not enabled”; no mock JWKS presented as real.
8. `pnpm run validate:dependencies` + `pnpm run test` + the new behavioral suites all green; the dead tower is out of the build closure.

---

## 7. SEQUENCING & STOP CONDITIONS

- Order: **WS-0 → WS-3.1 (backups) → WS-1 → WS-2 → rest of WS-3 → WS-4 → WS-5 → WS-6.** (Backups jump ahead of their workstream because WS-1 mutates money schema.)
- **STOP and escalate** if: a quarantine candidate has a real runtime importer; a money path’s correctness is ambiguous; a fix would require modifying FROZEN code; or a feature cannot be made real without a secret/vendor you don’t have (gate it off, log it, move on).
- Land each workstream green before starting the next. Do not batch unrelated changes.

---

## 8. ANTI-FABRICATION HARNESS (add as a `gate`; this is how we prevent regressions to theater)

Create `scripts/validators/anti-fabrication-validator.mjs` (behavioral where possible, grep as a backstop) that **fails CI** if any production code path:
- synthesizes a financial/provider identifier without a provider call — e.g. string-built `UTR…`, `txn_…`, `payout_…`, `irn_…`, `utr` assembled from a token (seed pattern: the current `payout-transfer-adapter`);
- returns a hardcoded `success`/`paid`/`released`/`settled` status on a money path without a corresponding provider reference + ledger posting;
- presents a `mock:true` payload or a literal like `mock-x-coordinate` from a non-test runtime endpoint;
- ships a `SKIP_NEEDS_HUMAN*` value in a production secret;
- reads a tenant table via `getSupabaseAdmin(...).from('<tenant table>')` outside the `tenantScoped` layer.
Pair each rule with a real unit/integration test where feasible; the grep rules are the backstop, not the proof.

---

## 9. HUMAN_REQUIRED.md (create + maintain — the honest backlog of what Codex CANNOT do)

For every item you cannot legitimately complete, append: the feature, the exact blocker, the file/flag that gates it OFF in the meantime, and the acceptance criteria for when the human supplies the missing piece. Expected entries: real payout-provider credentials (RazorpayX/Cashfree Payouts), `WHATSAPP_WEBHOOK_SECRET` + `TWILIO_*`, `AI_*`/`AI_CREDIT_RAZORPAY_KEY_ID`, KYC vendor (Signzy/HyperVerge), logistics carrier (Shiprocket/Delhivery), tax IRP/e-invoice provider, Supabase PITR plan/tier, error-tracking (Sentry) DSN, and the canonical-domain DNS/cookie cutover decision. **Gate, log, never fake.**

---

## 10. WHAT “GOOD” LOOKS LIKE AT THE END

A merchant can take money (already real) **and the platform can truthfully pay them out or honestly say it can’t** — with every cent reflected in one ledger that reconciles. A forgotten scope can’t leak another tenant’s orders. Production can be seen and restored. The build contains only code that runs. The design system is enforced, not hoped for. Nothing in the product returns a fabricated success. That is the foundation the rest of LetBuyy (OIDC, marketplace, AI — later) gets to stand on.

> Build less. Make it true. Leave the costume in `quarantine/`.
