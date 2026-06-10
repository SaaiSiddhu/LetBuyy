# SINGLE SOURCE OF TRUTH MASTERPLAN — Convergence Cleanup 2026-06-10 (Phase 3)

> **Phase:** 3 of N — SINGLE SOURCE OF TRUTH MASTERPLAN. For **every major domain**, define the convergence to **ONE OWNER / ONE IMPLEMENTATION / ONE AUTHORITY**, and the ordered **delete / archive / commit / retarget** path that collapses N competing sources into 1.
> **Mode:** DISCOVERY / PLANNING ONLY. No implementation, no code changes, no commits, no deletions, no migrations, no new architecture. Read-only git. **"Convergence path" = delete / archive / commit / retarget / retarget-validator steps, NOT software design.** The single file written this phase is this report.
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch `stepup/main` @ HEAD `5cf9e64e7e62482adaf4b65e74d8cbca754a0a15` · `main` is the only deploy branch, **+30 behind** (`git rev-list --count main..HEAD = 30`). Working tree re-verified this phase: **512 D · 410 M · 79 ??** (`git status --porcelain` counts; the Phase-1 prose cited 78 ?? — live count is **79**, flagged in Unknowns).
> **Direct inputs (read in full this phase):** `CONVERGENCE_CLEANUP_2026_06_10/REPOSITORY_FORENSICS_REPORT.md` (Phase 1 — duplicate authorities per domain) and `CONVERGENCE_CLEANUP_2026_06_10/STRATEGIC_WINNERS_FINAL.md` (Phase 2 — 14 winners, 0 overturns). Prior `CONVERGENCE_AUDIT_2026_06_10/SINGLE_SOURCE_OF_TRUTH_PLAN.md` consulted for completeness; every reused fact re-verified against source.
> **Consistency contract:** this is a FRESH re-derivation that is **consistent with** Phase 1 forensics and Phase 2 winners. Every Target SoT below equals a Phase-2 winner with **zero overturns**. Where this phase re-derives a count or fact, it is re-verified at `path:line` or by command this run.

---

## Executive Summary

1. **The conflicts are already decided; the obstacle to a Single Source of Truth is almost never "which one wins."** For all ~22 domains the canon (Phase 2) already names ONE owner, and a fresh re-derivation confirms it with **zero overturns**. The losers are still alive for one of four mechanical reasons, never because the choice is open: (a) the winning code is **uncommitted** (temporal triplication — plane C, the working tree, holds the hardened end-state with zero git history); (b) the winner is **undeployed** (`main`, the only deploy branch, is +30 behind); (c) a **validator structurally mandates the loser** (the survivability self-block, plus per-domain `legacyAllowed*` allowlists); or (d) the named owner **was never built or wired** — a genuine capability gap that no `git add` resolves.

2. **The single fact that governs every block is temporal triplication.** Three realities co-own each domain: **plane A = `main`** (the only branch CI deploys — `production-deploy.yml:5-6`; ships every loser: account-takeover, 3% rake, anon RLS leaks, mutable money, un-ledgered capture), **plane B = HEAD `stepup/main`** (+30; the canonical ledger kernel and most winners exist here as committed code), **plane C = the working tree** (adds untracked migrations 162–166, the asymmetric identity issuer, RLS+GUC, the 512 staged deletions of the dead CQRS cluster — the only Constitution-conforming reality, and the only one with **zero version-control protection**). **Authority and durability are inversely correlated**, so **Phase-0 (commit the working tree as the Truth Freeze, then ratify + fast-forward `main`) is a hard prerequisite on nearly every convergence path below.**

3. **The Phase-0 commit is double-edged: it *arms* the multi-region self-block.** Re-verified this run: `scripts/validators/survivability-governance-validator.mjs` is **tracked AND on `main`** (`git cat-file -e main:… → ON-MAIN-CONFIRMED`) and asserts `multi-region-runtime.json` must contain regions `india/apac/eu/us` (`:94`) with failover/replay/RTO/RPO and `globalRegions.length >= 4` (`:106`). Its companion `whole-repo-end-state-validator.mjs` is **untracked / absent on `main`** (`WHOLE-REPO-ABSENT-ON-MAIN`) and re-asserts the same 4 regions (`:172-177`) and wires `validate:survivability` into 3 workflows. **Committing plane C therefore makes the contradiction repository-wide and gate-enforced** — the gate requires the very multi-region topology the Constitution forbids (Phase 2 Decision 8). **The survivability-unhook must precede or accompany the Phase-0 commit, or the commit fails CI against itself.** This is the pivotal sequencing fact carried from Phase 1/2.

4. **The merchant-control-plane "second backend" is a *proxy-layer* duplicate, not a second DB writer (fresh Wave-A fact, honored).** Re-verified: merchant-control-plane's **62** `/api` `route.ts` are **BFF proxies** that call `createMerchantApiClient()` and hold **no** supabase/gateway client of their own (`grep @supabase / createServiceClient` in its `src` = 0). **All 917 `getSupabaseAdmin` occurrences across 99 files are 100% inside `services/api-gateway`.** The storefront/orders/inventory/shipping/tax "duplication" is therefore **duplicate route/contract ownership removable by a call-graph trace + proxy-or-port cutover**, not the collapse of two databases. This re-classes the heaviest-looking spatial duplicate into a Med-complexity tracing problem.

5. **Six money/identity domains are honest dead-ends for convergence and must be tagged as engineering, not cleanup.** Their canonical owner is *named* but posts/pays/clears/verifies/binds **nothing** in any of the three realities: **storefront capture** (`confirm_order_payment_with_ledger` writes **0** canonical ledger entries — re-confirmed `000_baseline.sql:1590-1709`), **payout client** (`initiateTransfer` throws `PayoutProviderUnavailable` in every plane — no provider client exists), **ledger reconciliation** (refreshers have **0** runtime callers → wallet 409s forever), **step-up crypto** (mock key service / disabled OIDC), **Liquid chrome/data-binding** (no header/footer, binds nothing, `index`-only), and **mobile login** (Turnstile double-spend). For these the block is marked **"SoT BLOCKED BY CAPABILITY GAP — not convergence,"** the gap is named, and the convergence steps are limited to what genuinely converges (duplicate-writer collapse) — this phase does **not** design the fix.

6. **Fresh key counts honored this run (Phase 1, re-verified):** `getSupabaseAdmin` = **917 / 99 files** (100% api-gateway); merchant-control-plane BFF proxies = **62** `route.ts`; api-gateway routes = **84**; storefront-runtime API routes = **21**; nested non-root `AGENTS.md` = **79** (61 active + 18 archived); validators on disk = **133** (.mjs), **77** `D`-deleted in WT, **90** gate-referenced; distributed packages present-at-HEAD = **8 / 150 files** (`app-engine 5 · application-services 15 · distributed-runtime 77 · extension-host 4 · orchestration 16 · projection-runtime 18 · runtime-composition 15 · search-core 4` — `search-core` is present at HEAD but is **not** in the 7-entry `rejectedPackageRoots`, an asymmetry flagged below); `confirm_order_payment_with_ledger` ledger writes = **0**; commission 300-bps in live source = **0** (tests + rollback only); migrations **162–166 untracked**; canonical roots = 6 apps / 4 services / 18 domain-packages (+`infrastructure`) / 3 TS workspace / 3 Dart workspace; frozen apps = 4 (still shipping src); reserved services = 6 (manifest-only); reserved mobile = 2.

---

## Method

- **Per-domain block — EXACTLY six fields, as mandated:**
  1. **Current Sources of Truth** — every competing owner, with `path` and **reality plane** (A=`main`/committed-deployable · B=HEAD `stepup/main` · C=working tree · ALL=present in all three).
  2. **Target Single Source of Truth** — the ONE owner/impl/authority; **must equal the Phase-2 winner** (Decision # cited).
  3. **Required Convergence Path** — ordered **delete / archive / commit / retarget** steps only (NOT software design).
  4. **Deletion Candidate** — what specifically gets removed once converged.
  5. **Risk** — S0–S3 + one line.
  6. **Blocking Dependencies** — one or more of: **Phase-0 commit** · **ARB survivability-unhook** · **ARB ratification** (governance/topology/React-deletion) · **call-graph trace** · **GENUINE CAPABILITY GAP** (named).
- **Risk scale (consistent with Phase 1/2):** **S0** = live user-facing money/identity/security exposure now, or the law mandates its own loser · **S1** = correctness/compliance gap that blocks real money or violates a load-bearing canon rule · **S2** = drift / maintenance-tax / honesty defect · **S3** = cleanup / cosmetic / dead-weight.
- **Convergence vs capability (the central distinction).** Where SoT is reachable by delete/commit/retarget, the path ends in a Deletion Candidate. Where a real capability gap exists, the block is marked **"SoT BLOCKED BY CAPABILITY GAP — not convergence,"** the gap is named, and the steps are limited to the genuine convergence (duplicate-writer collapse + validator-retarget so the gap stops being invisible). **A delete does not fix a capability gap.**
- **Deletion-not-migration assumption (carried from canon):** no prod users / no prod data / no migration constraints ⇒ paths are **DELETE-not-MIGRATE** wherever the only constraint was production safety; Phase-0 commits the working tree and governance is ratified before any loser is touched.
- **Verification.** Every load-bearing path/line/count re-derived this phase (`grep`/`find`/`git`/`Read`) or carried from Phase 1/2 and spot-checked here. **Live production/DB/payment-provider state is UNVERIFIED throughout** (CI deploys from committed refs, so live ≈ `main`).

---

## ~22 Domain Single-Source-of-Truth Blocks

### 1. Canonical apps

- **Current Sources of Truth (all competing owners + paths + plane):**
  - **6 canonical apps** (`governance-common.mjs:57-64`): `apps/storefront-runtime`, `apps/merchant-control-plane`, `apps/identity-platform`, `apps/marketing-site`, `apps/platform-console`, `apps/mobile/merchant-app` — ALL.
  - **4 frozen apps still shipping source** (`governance-common.mjs:66-71`): `apps/app-marketplace` (91 ts/tsx), `apps/theme-marketplace` (65), `apps/platform-operations-portal` (32), `apps/developer-portal` (20) — ALL (also carry `vercel.json`).
  - **7 deprecated app aliases** (`governance-common.mjs:78-94`): `apps/admin|auth|checkout|internal|merchant|storefront|analytics` (+ `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`) — historical only; any live reference is drift.
- **Target Single Source of Truth:** the **6 canonical app roots** are the only production app topology; the 4 frozen apps are frozen-or-pending-consolidation (non-deploy), deprecated aliases never recur as active topology. (Phase 2 Decision 6/8/9; `governance-common.mjs:57-64`.)
- **Required Convergence Path:** (1) **commit** plane C so the canonical-root manifests + deletions are durable (Phase 0). (2) **retarget** any validator/topology row that still treats a frozen app as deployable. (3) **archive** the 4 frozen apps' source under `docs/archive/` (or freeze-in-place per ARB) and **delete** their `vercel.json` rows so the deploy matrix matches topology. (4) **delete** any surviving reference to a deprecated alias.
- **Deletion Candidate:** frozen-app `vercel.json` deploy rows; deprecated-alias references; (ARB) the frozen apps' source trees.
- **Risk:** **S2** — frozen-but-shipping apps + deprecated aliases are drift/maintenance-tax and deploy-matrix dishonesty, not a live breach.
- **Blocking Dependencies:** **Phase-0 commit**; **ARB ratification** (freeze-in-place vs archive-and-delete for the 4 frozen apps — a human topology call, not pure cleanup).

### 2. Canonical services

- **Current Sources of Truth:**
  - **4 real services** (have `wrangler.toml`, deployable Cloudflare Workers; `governance-common.mjs:97-102`): `services/api-gateway`, `services/mobile-bff`, `services/webhook-service`, `services/queue-workers` — ALL.
  - **6 reserved services** (manifest-only, must stay non-deployable; `governance-common.mjs:104-111`): `services/checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline` — ALL (each has `runtime.manifest.json` + `AGENTS.md`, **no** `package.json`/`src`/`wrangler.toml`). Their named capabilities are **already implemented inside the monolith** (checkout in api-gateway, notifications in mig 148/149 + gateway routes, events in `event-core`) — placeholder duplication of ownership.
- **Target Single Source of Truth:** the **4 real services** are the only deployable service topology; the 6 reserved roots stay **FROZEN-empty manifests** owned by their implemented monolith capability until a human-approved scope adds real source/tests/deploy config. (Phase 2 Decision 8/14; `governance-common.mjs:97-111`.)
- **Required Convergence Path:** (1) **commit** plane C (Phase 0). (2) **retarget** `whole-repo-end-state-validator.mjs:59-85` (reserved-service emptiness) to remain enforced post-commit. (3) **delete** any reserved-service row in `production-topology.json` that is mislabeled deployable; keep them `environment:"reserved", deploymentKind:"manifest-only"`. (4) No source deletion — the reserved roots are already empty.
- **Deletion Candidate:** mislabeled deployable rows for reserved services (if any); nothing else (manifests are intentionally empty).
- **Risk:** **S2** — reserved manifests are fabricated future-topology if ever marked live; otherwise inert.
- **Blocking Dependencies:** **Phase-0 commit**; **ARB survivability-unhook** (the reserved-service assertions live in the same end-state validator family as the multi-region self-block — retargeting must be the one paired change).

### 3. Canonical packages

- **Current Sources of Truth:**
  - **18 domain packages + `infrastructure` + 3 TS workspace + 3 Dart workspace** (`governance-common.mjs:118-160`) — ALL. Import counts (Phase 1): `shared-types` 148, `theme-engine` 62, `infrastructure` 57, `auth-core` 56 … bottom five `organization-core` 2, `token-core` 2, `permission-core` 3, `session-core` 3, `audit-core` 3 (redundancy candidates, **not** dead).
  - **8 distributed/CQRS packages present at HEAD, `D`-deleted only in WT** (re-verified `git ls-tree -r HEAD`): `distributed-runtime` 77, `projection-runtime` 18, `orchestration` 16, `runtime-composition` 15, `application-services` 15, `app-engine` 5, `extension-host` 4, `search-core` 4 (= 150 files) — present **A/B**, deleted **C**. `rejectedPackageRoots` (`governance-common.mjs:142-148`) lists exactly **7** (omits `search-core`).
- **Target Single Source of Truth:** the **22 canonical workspace packages** are the only package topology; the **8 distributed packages are DEAD/SAFE_DELETE** (monolith decision). (Phase 2 Decision 6/8; `ARCH-R7`.)
- **Required Convergence Path:** (1) **retarget first** `whole-repo-end-state-validator.mjs:52-54` (asserts each rejected root deleted) + `governance-common.mjs:142-148` so the deletion does not fail the gate against HEAD (`DEL-R3` ordering). (2) **add `packages/search-core`** to `rejectedPackageRoots` (asymmetry: present at HEAD, deletable, but not listed). (3) **commit** the 8-package deletion already drafted in plane C (Phase 0). (4) **delete** (ratify) `organization-core`/`token-core` etc. only if a consolidation decision merges them — otherwise keep (low-import ≠ dead).
- **Deletion Candidate:** the 8 distributed/CQRS package trees (150 files); their `docs/governance/*-governance.md` companions.
- **Risk:** **S0** (governance theater) — the end-state validator passes only against plane C and would **FAIL against HEAD/`main`** (the deploy reality still carries all 8); the gate and the deploy branch disagree.
- **Blocking Dependencies:** **Phase-0 commit**; **ARB survivability-unhook** (same validator family); **call-graph trace** not required (rejected packages are dead by canon).

### 4. Canonical identity (who issues principals)

- **Current Sources of Truth:**
  - **A — identity-platform asymmetric issuer** (`apps/identity-platform/src/lib/auth/identity-issued-session.ts`, EdDSA/ES256) + gateway JWKS verify (`services/api-gateway/src/lib/identity-session-verifier.ts`) — **untracked, plane C only, absent on `main`**. Covers ONE token type today (merchant session).
  - **B — gateway opaque mint** `auth.ts:1140` `token = providedToken || randomHex(32)` — **A/B (deployable)**; carries the `/api/auth/switch` account-takeover.
  - **C — gateway `identity-foundation/` shadow stack** (18 files: `oauth-skeleton.ts`, `mock-key-service.ts`, `auth-verifier-registry.ts`, `admin-mfa-scaffold.ts`, …) — A/B/C.
  - **D — `auth-core` HS256 minters** over shared `AUTH_SECRET` (customer/console/magic-link/storefront-access) — ALL.
  - **E — OIDC issuer** `apps/identity-platform/src/app/oauth2/*` (token/authorize/userinfo/consent/logout/callback) — **all 404/501 disabled**; `oidc-disabled.ts` serves placeholder JWKS — ALL.
- **Target Single Source of Truth:** **A — identity-platform as the sole asymmetric token issuer for all 3 realms; gateway and all others verify-only.** (Phase 2 Decision 2; `IDN-R1/R2`.)
- **Required Convergence Path:** (1) **commit** plane C so A's two untracked files exist (Phase 0). (2) **commit/provision** live keypairs/JWKS so A can issue in prod. (3) **retarget** shopper/console/magic-link/`lb_accounts` issuance from D into A; **retarget** gateway to verify-only; run the `IDN-R2` dual-verify drain (telemetry = zero legacy-HS256 verifications). (4) **delete** B's `randomHex(32)` mint + the `/api/auth/switch` mint branch only after drain proves zero legacy verifications. (5) **delete** the 18-file `identity-foundation/` shadow stack once A serves verify-only live (`IDN-R3`).
- **Deletion Candidate:** gateway `randomHex(32)` mint + `/api/auth/switch` mint branch; the 18-file `identity-foundation/` shadow; D's minters once every realm is re-homed.
- **Risk:** **S0** — the deployable reality (B) mints unauthenticated sessions and ships the takeover; the winner is uncommitted.
- **Blocking Dependencies:** **Phase-0 commit**; **GENUINE CAPABILITY GAP** = *live identity keypairs/JWKS not provisioned + step-up crypto is a mock (`mock-key-service.ts`) + OIDC is a 501 skeleton* — A covers only the merchant token today; non-merchant realms still ride HS256, which is a build, not a convergence. `IDN-R2` drain telemetry + `IDN-R3` verify-only-live gate.

### 5. Canonical payments (capture path — order money in)

- **Current Sources of Truth:**
  - **A — ledgered V1 capture:** `POST /payments/:id/capture` → `post_settlement_ledger_transaction` (`services/api-gateway/src/routes/payments.ts`); the real poster lives in **untracked** mig `165_d5_canonical_money_paths.sql` (`post_ledger_transaction`). Exists on the low-traffic V1 surface only — B/C (mig 165 = **C only**).
  - **B — no-ledger storefront/webhook confirm:** every storefront Razorpay verify + all 4 provider webhooks → `confirm_order_payment_with_ledger` (`000_baseline.sql:1590-1709`; re-read in full this phase — writes ONLY `payment_transactions` + `payment_attempts`, **0** canonical-ledger inserts; the `_with_ledger` suffix is naming theater). **This is the path every shopper hits, in all three realities** — ALL.
- **Target Single Source of Truth:** **A — ledgered capture is the canonical poster; the storefront/webhook confirm must post canonical ledger entries (or route through A).** (Phase 2 Decision 13; `PAY-R2`.)
- **Required Convergence Path:** Convergence **cannot** produce SoT here. Genuine convergence steps only: (1) **retarget** `canonical-ledger-only-validator` to see SQL writers and add `orders`/capture to its ratchet table list, so the gap stops being invisible. (2) **delete** the misleading `_with_ledger` name only **after** a ledgered path replaces it. The rest is a build (out of scope this phase).
- **Deletion Candidate:** none safely deletable now — B is the live buyer path. After the build: the no-ledger confirm SQL.
- **Risk:** **S0** — the books for the primary money path do not exist; un-ledgered captures don't credit `merchant_payable`, so payout cannot release.
- **Blocking Dependencies:** **SoT BLOCKED BY CAPABILITY GAP — not convergence.** Gap = *the storefront/webhook capture chain writes zero canonical ledger entries (the single largest unfinished winner; survives any commit/merge).* Also depends on the reconciliation harness (Ledger domain). **Phase-0 commit** (mig 165) is necessary but not sufficient.

### 6. Canonical ledger (money truth model)

- **Current Sources of Truth:**
  - **A — canonical append-only double-entry:** `ledger_accounts/transactions/entries` (mig `139_executable_foundation_ledger_core.sql` — single-writer CHECK `:113`, `reject_ledger_mutation()` trigger `:361-376`, balance derived via `ledger_account_balance_minor` mig `160:173`; UPDATE/DELETE REVOKE in **untracked** mig 165). Tracked on B/C; full authority (160) on B/C; money-path RPCs (165) on **C only**.
  - **B — mutable mobile model:** `wallet_ledger_entries`, `payout_statements`, `commission_*` (mig `119`, `commission_bps DEFAULT 300`, mutable `balance_after` as truth) — ALL.
  - **C — mini-ledgers:** `gift_card_ledger_entries` (baseline), `partner_payout_ledger_entries` (baseline), `store_credit.balance_minor`, `ai_credits.balance` — mutable running balances — ALL.
- **Target Single Source of Truth:** **A — canonical append-only ledger; B and C demoted to read-only projections, balance always derived.** (Phase 2 Decision 3 — the flagship call; `PAY-R1`.)
- **Required Convergence Path:** (1) **commit** migrations 160/162/165 (Phase 0) so A's authority layer (reconciliation tables, claim guard, UPDATE/DELETE revoke) exists on a deployable ref. (2) **retarget** `wallet.ts` reads to derive from A; B/C become projections. (3) Convergence **stops here** — clearing the wallet requires wiring the reconciliation refreshers (mig `160:198-355`, **0 runtime callers**) to a scheduler + a zero-drift proof + a backfill (a build). (4) **delete** B/C as truth sources only after the projection derives cleanly (`DEL-R2`).
- **Deletion Candidate:** mutable `wallet_ledger_entries`/`payout_statements`/`commission_*` *as truth* (kept as projections until zero-drift); mini-ledger mutable balances.
- **Risk:** **S1** — wallet read fails closed at HTTP 409 `LEDGER_RECONCILIATION_REQUIRED` **forever** until an operator manually backfills; combined with the capture gap, 409 is the default state for real stores.
- **Blocking Dependencies:** **Phase-0 commit** (160/162/165); **SoT BLOCKED BY CAPABILITY GAP (partial)** = *reconciliation refreshers have zero callers + no in-product operator action to clear the 409*; live zero-drift proof (Class B human decision).

### 7. Canonical settlement (`merchant_payable` credit + payout objects)

- **Current Sources of Truth:**
  - **A — capture posting** `payments.ts` (writes `merchant_payable`) — B/C.
  - **B — commission reconcile** `commission.ts` + settlement ingest `settlements.ts` (caller-declared amounts) — ALL.
  - **C — payout statement gross from `orders.total`** (`payouts.ts`) — a fourth, ledger-independent number — ALL.
  - **Two payout object models:** `payout_statements` (claim guard, mig `160`) vs settlement-ingest `payouts` instruction rows (`settlements.ts`, written `scheduled`, **never consumed**) — ALL.
- **Target Single Source of Truth:** **a single-writer settlement module (one writer per account) + one payout object model (statements + claim guard); payout gross derived from the ledger, not `orders.total`.** (Phase 2 §gaps; Decision 3/12 family.)
- **Required Convergence Path:** (1) **commit** mig 165 (settlement source-row ownership) (Phase 0). (2) Convergence **stops at duplicate-writer collapse design**, which is an **ARB call** on which writer survives per flow; the execution side is a capability gap (no executor consumes the `scheduled` rows; nothing dedups across per-source idempotency keys). (3) **delete** the orphan `payouts` instruction-row model once ARB confirms statements are canonical and no executor is built; (4) **retarget** payout gross to derive from the ledger.
- **Deletion Candidate:** the never-consumed `scheduled` `payouts` instruction rows; the `orders.total`-derived gross number.
- **Risk:** **S1** — un-deduped triple+1 writers admit double-credit; the parallel payout model goes nowhere.
- **Blocking Dependencies:** **Phase-0 commit**; **ARB ratification** (which writer survives per flow; statements-vs-instructions); **GENUINE CAPABILITY GAP (partial)** = *no cross-source dedup; no executor for scheduled payout rows*.

### 8. Canonical checkout

- **Current Sources of Truth:**
  - **A — checkout in `services/api-gateway`** (`routes/checkout.ts` + `routes/storefront/cart-routes.ts`; the real implementation, owns DB via `getSupabaseAdmin`) — ALL. Cart/checkout tokens are signed with shared `AUTH_SECRET` (`checkout.ts:88`, `cart-routes.ts:307`).
  - **B — `packages/checkout-core`** (21 importers; domain types/logic) — ALL.
  - **C — reserved `services/checkout-runtime`** (manifest-only, **no source**; future duplicate of the capability A already owns) — ALL.
- **Target Single Source of Truth:** **checkout lives in the `api-gateway` monolith (A), typed by `checkout-core` (B); `checkout-runtime` stays FROZEN-empty.** (Phase 2 Decision 8/9; `ARCH-R1`.)
- **Required Convergence Path:** (1) **commit** plane C (Phase 0). (2) **retarget** cart/checkout token signing off shared `AUTH_SECRET` to a dedicated secret / identity-platform issuance (ties to Identity). (3) **retarget** the reserved-service validator to keep `checkout-runtime` empty. (4) No source deletion (A is canonical; B is its library; C is empty).
- **Deletion Candidate:** the `AUTH_SECRET`-signed cart/checkout token path (replaced, not removed, by Identity convergence); nothing structural in checkout itself.
- **Risk:** **S1** — checkout token signing rides the shared-secret forgery surface (ties to the identity S0), but the checkout *flow* is single-owner and real.
- **Blocking Dependencies:** **Phase-0 commit**; **ARB survivability-unhook** (reserved-service assertion family); depends on **Identity** convergence for the token-signing retarget.

### 9. Canonical orders

- **Current Sources of Truth:**
  - **A — order writes in `api-gateway`** (`routes/orders.ts` + the SQL `confirm_order_payment` / `confirm_order_payment_with_ledger` / `complete_order_refund` RPCs; the DB owner) — ALL.
  - **B — merchant-control-plane `/api/.../orders` BFF proxy** (`route.ts` → `createMerchantApiClient()`, no DB client) — ALL.
  - **C — storefront-runtime `/api/.../orders` proxy** (`orders/route.ts` → `createStorefrontApiClient()`) — ALL.
- **Target Single Source of Truth:** **`api-gateway` is the sole order writer (A); B and C are presentation-only proxies.** (Phase 2 Decision 9; `ARCH-R17` apps own routing/rendering only.)
- **Required Convergence Path:** (1) **call-graph trace** each MCP/storefront order route to confirm it is a pure proxy (Wave-A says all 62 MCP routes are proxies; verify per-route). (2) **commit** plane C (Phase 0). (3) **retarget** any order proxy that re-implements logic to a thin gateway call (proxy-or-port with per-route contract tests). (4) **delete** any duplicate order-mutation logic found outside the gateway.
- **Deletion Candidate:** duplicate order-mutation logic in any proxy route (expected: none — proxies only); the misnamed `confirm_order_payment_with_ledger` (after the capture build, per Payments).
- **Risk:** **S2** — duplicate route/contract ownership (drift, double-maintenance), not a second DB writer; the order-money correctness gap is the Payments S0, tracked there.
- **Blocking Dependencies:** **call-graph trace** (per-route proxy confirmation); **Phase-0 commit**.

### 10. Canonical inventory

- **Current Sources of Truth:**
  - **A — inventory writes in `api-gateway`** (gateway routes + the untracked mig `166_d6_checkout_handoff_inventory.sql` checkout→inventory handoff) — B/C (mig 166 = **C only**).
  - **B — merchant-control-plane `/api/.../inventory` BFF proxy** (`route.ts` → `createMerchantApiClient()`) — ALL.
- **Target Single Source of Truth:** **`api-gateway` is the sole inventory writer (A); merchant-control-plane is a proxy.** (Phase 2 Decision 9.)
- **Required Convergence Path:** (1) **call-graph trace** the inventory proxy route(s) to confirm pure proxy. (2) **commit** plane C including mig 166 (Phase 0). (3) **retarget** any inventory proxy that re-implements logic. (4) **delete** duplicate inventory logic if any.
- **Deletion Candidate:** duplicate inventory-mutation logic outside the gateway (expected: none).
- **Risk:** **S2** — proxy-layer duplication; the checkout→inventory handoff correctness depends on mig 166 being committed (else over-sell window persists on `main`).
- **Blocking Dependencies:** **call-graph trace**; **Phase-0 commit** (mig 166).

### 11. Canonical shipping

- **Current Sources of Truth:**
  - **A — shipping/zones in `api-gateway`** (gateway routes own `shipping/zones` DB) — ALL.
  - **B — merchant-control-plane `/api/stores/[store]/shipping/zones` BFF proxy** — ALL.
- **Target Single Source of Truth:** **`api-gateway` is the sole shipping writer (A); merchant-control-plane is a proxy.** (Phase 2 Decision 9.)
- **Required Convergence Path:** (1) **call-graph trace** the shipping proxy route(s). (2) **commit** plane C (Phase 0). (3) **retarget**/proxy-or-port. (4) **delete** duplicate logic if any.
- **Deletion Candidate:** duplicate shipping logic outside the gateway (expected: none).
- **Risk:** **S2** — proxy-layer route duplication; no live-money exposure.
- **Blocking Dependencies:** **call-graph trace**; **Phase-0 commit**.

### 12. Canonical tax

- **Current Sources of Truth:**
  - **A — taxes in `api-gateway`** (gateway routes own `taxes` DB) — ALL.
  - **B — merchant-control-plane `/api/stores/[store]/taxes` BFF proxy** — ALL.
- **Target Single Source of Truth:** **`api-gateway` is the sole tax writer (A); merchant-control-plane is a proxy.** (Phase 2 Decision 9.)
- **Required Convergence Path:** (1) **call-graph trace** the tax proxy route(s). (2) **commit** plane C (Phase 0). (3) **retarget**/proxy-or-port. (4) **delete** duplicate logic if any. (Note: GST-on-fee is DEAD per the 0-bps commission decision — tax-of-commission is voided, not a tax-engine concern.)
- **Deletion Candidate:** duplicate tax logic outside the gateway (expected: none); the GST-on-fee computation (voided by 0-bps commission — tracked under Settlement/commission).
- **Risk:** **S2** — proxy-layer duplication.
- **Blocking Dependencies:** **call-graph trace**; **Phase-0 commit**.

### 13. Canonical storefront

- **Current Sources of Truth:**
  - **A — `apps/storefront-runtime`** (the canonical consumer storefront app; 21 API routes, all proxies to the gateway via `createStorefrontApiClient()`) — ALL.
  - **B — deprecated alias `apps/storefront-runtime/consumer-storefront`** + `apps/storefront` (forbidden runtime roots; `governance-common.mjs:88-94`) — historical only.
  - **Backend ownership:** the gateway (84 routes, data owner) is the storefront's single backend; the storefront app holds **no** DB client.
- **Target Single Source of Truth:** **`apps/storefront-runtime` is the sole storefront app (A), proxying the `api-gateway` backend; deprecated aliases never recur.** (Phase 2 Decision 9; `governance-common.mjs:57-64`.)
- **Required Convergence Path:** (1) **call-graph trace** the 21 storefront API routes to confirm pure proxy. (2) **commit** plane C (Phase 0). (3) **delete**/archive any reference to the deprecated `consumer-storefront`/`apps/storefront` aliases. (4) **retarget** storefront cookie/token handling to the canonical identity realm (ties to Identity/cookies).
- **Deletion Candidate:** deprecated-alias references; any duplicate backend logic in the storefront app (expected: none).
- **Risk:** **S2** — proxy-layer + alias drift; the storefront's money correctness is the Payments S0 (capture), tracked there.
- **Blocking Dependencies:** **call-graph trace**; **Phase-0 commit**; depends on **Identity** for cookie-realm convergence.

### 14. Canonical themes (Liquid vs React)

- **Current Sources of Truth:**
  - **A — React section-registry renderer** (`apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx`; the live default — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`, `packages/theme-engine/src/theme-governance.ts:14`) — ALL (runtime default everywhere).
  - **B — Liquid / portable-theme path** (`liquid-hydration-islands.tsx`, `composition-engine.tsx`, `template-resolver.ts`; flag-off canary; parity table lists 20 sections with **no header/footer**) — ALL (Liquid hardening `M` on C).
  - **Two theme-engine roots:** `apps/storefront-runtime/src/lib/theme-engine/*` (live) vs `packages/theme-engine/*` (8 ts, imported 62×) — ALL.
- **Target Single Source of Truth:** **Liquid / portable-theme renderer is the canonical winner; the React registry is FROZEN as a first-party fast-path, delete-or-frozen by data at Wave 6 — NOT deleted now.** (Phase 2 Decision 1; `THEME-R1`.)
- **Required Convergence Path:** Convergence **cannot** flip this now — it is a build. Genuine convergence steps: (1) **commit** the Liquid hardening (DOMPurify, 20-section parity table, freeze flag) on plane C (Phase 0). (2) **retarget** `THEME-R2` (CI ban on new React sections) to freeze the fork. (3) Consolidate the two theme-engine roots **only as a later cutover** (not now). (4) **delete** React sections only after the 8-part Liquid parity gate + Security/SSTI suite + ARB flip ratification.
- **Deletion Candidate:** the React section renderer — **only after** Liquid parity + ARB flip; **NOT deletable now** (deleting it blanks every store).
- **Risk:** **S2** — the loser is a maintenance-tax fork; deleting it early would be S0-grade self-harm (exactly why canon freezes it).
- **Blocking Dependencies:** **GENUINE CAPABILITY GAP** = *Liquid has no header/footer/section-group chrome, binds no commerce data, is `index`-only, has no merchant edit/canary surface — a build, not a flip*; **ARB ratification** (the deferred platform-wide flip); **Phase-0 commit** (Liquid hardening durability).

### 15. Canonical UI system (ui_kit / design tokens)

- **Current Sources of Truth:**
  - **A — `packages/typescript/ui/src/tokens.ts → tokens.json`** (canonical design-token authority; `token-source-single-validator.mjs:11-15`) — ALL.
  - **B — `packages/dart/ui_kit/.../letbuyy_tokens.dart`** (generated DTCG bridge from A via `scripts/generators/generate-mobile-tokens.mjs`, header-checked) — ALL.
  - **C — forbidden token forks** (`mobile-tokens.ts`, `letbuyy_color_tokens.dart`, `light/dark/store_admin_colors.dart`) — **now GONE from disk**; only the policing validator remains.
  - **Marketplace UI forks:** `app-marketplace`/`theme-marketplace` local `logger.ts` + `MarketplaceUnavailable` must wrap `@letbuyy/ui` (`marketplace-single-source-validator.mjs:40-67`) — ALL.
  - **Note (Phase-1 DELTA, honored):** `packages/token-core` is an **AUTH-token** package (`TokenKind = id_token|access_token|…`), **NOT** a design-token package — it belongs to Identity (Domain 4), not here.
- **Target Single Source of Truth:** **`packages/typescript/ui` tokens are the single design-token source; `ui_kit` consumes the generated Dart bridge; no fork.** (Phase 2 Decision 10b; `UI-R1`.)
- **Required Convergence Path:** (1) **commit** plane C (the fork deletions are already `D`) (Phase 0). (2) **retarget**/keep `token-source-single-validator.mjs` + `mobile-token-validator.mjs` enforcing A→B generation; run `ui_kit --check` exit 0. (3) **retarget** the marketplace UI forks to wrap `@letbuyy/ui`. (4) **delete** nothing further (forbidden forks already removed).
- **Deletion Candidate:** the (already-`D`) token/color forks; the marketplace-local logger/Unavailable forks once they wrap shared UI.
- **Risk:** **S2/S3** — token drift is a design-system honesty/maintenance defect; forbidden forks already gone.
- **Blocking Dependencies:** **Phase-0 commit**; no ARB, no capability gap (governance + generation discipline only).

### 16. Canonical mobile

- **Current Sources of Truth:**
  - **A — `apps/mobile/merchant-app`** (the one real Flutter app) + composite `services/mobile-bff` (live nav/dashboard) — ALL.
  - **B — dead `AppDeepLinkRouter` (GoRouter)** + `go_router` dep (`pubspec.yaml:48`) — **zero callers** — ALL.
  - **C — dead `SectionEditorScreen`** (~1,200 LOC, the richest mobile surface, **zero navigation sites**) — ALL.
  - **D — mobile model forks:** `apps/mobile/merchant-app/lib/models/*` vs `packages/dart/models/.../merchant_app/*` (5 colliding basenames incl. `theme_editor_models.dart` 7-line shim vs 160-line real) — ALL.
  - **E — 2 reserved mobile roots** (`apps/mobile/shopper-app`, `apps/mobile/operator-app`; manifest-only) — ALL.
- **Target Single Source of Truth:** **`merchant-app` + composite `mobile-bff` (Navigator nav); `ui_kit` token bridge; section editor re-wired (else read-only LivePreview); model forks resolved to `packages/dart/models`; reserved roots stay empty.** (Phase 2 Decision 10a/10b/10c.)
- **Required Convergence Path:** (1) **commit** plane C (token-fork + parity-catalog deletions are already `D`) (Phase 0). (2) **delete** the zero-caller `AppDeepLinkRouter` + drop `go_router`. (3) **retarget** the 5 forked models to the `packages/dart/models` definitions; **delete** the app-local shims. (4) **ARB/PM decision**: re-wire `SectionEditorScreen` (nav fix) or delete it. (5) keep reserved roots empty.
- **Deletion Candidate:** `AppDeepLinkRouter` + `go_router` dep; 5 app-local model forks; (ARB) the dead `SectionEditorScreen`.
- **Risk:** **S3** for dead GoRouter/forks (dead-weight); **S2** for the dead editor (honesty/maintenance). A separate **login Turnstile double-spend** is an **S1** that blocks any mobile launch regardless.
- **Blocking Dependencies:** **Phase-0 commit**; **ARB ratification** (re-wire-vs-delete the editor); **GENUINE CAPABILITY GAP** = *mobile login Turnstile double-spend blocks prod login (a bug to fix, not a seam)*.

### 17. Canonical notifications

- **Current Sources of Truth:**
  - **A — WhatsApp-first router in the monolith** (`packages/notification-core` provider-mode + failover model with honest mock-by-default; DB backing mig `148_executable_notifications_router.sql`; gateway `routes/notifications.ts`; queue proxies to gateway) — B/C strong, contract real.
  - **B — reserved `services/notification-service`** (manifest-only, fabricated `production` topology row) — ALL.
  - **C — dead observability config** (`infrastructure/observability/prometheus-rules.yaml` + `otel-collector.yaml`; **no metrics SDK installed in any runtime** — `grep @opentelemetry|prom-client` in package.json = empty) yet asserted by `survivability-governance-validator.mjs:75-88` — ALL.
- **Target Single Source of Truth:** **the WhatsApp-first notifications router in the monolith (honest mock-by-default, multi-ESP failover); `notification-service` stays FROZEN-empty; the dead Prometheus/otel config is purged.** (Phase 2 Decision 14; DOC 03 #30.)
- **Required Convergence Path:** (1) **commit** plane C (Phase 0). (2) **retarget** `survivability-governance-validator.mjs` off the Prometheus/dashboard assertions **first** (`DEL-R3`). (3) **archive** the dead observability config (or wire a real SDK — a build, out of scope). (4) **delete** the fabricated `notification-service` production-topology row. (5) the live ESP/WhatsApp adapters are a P1 build (contract + honest mocks already exist) — not convergence.
- **Deletion Candidate:** the Prometheus/otel config (after validator retarget); the fabricated `notification-service` topology row.
- **Risk:** **S2** — no real alerting/observability channel despite asserting config; the notification router is correctly mock-by-default so it does not falsely report live.
- **Blocking Dependencies:** **ARB survivability-unhook** (the Prometheus assertions live in the same validator); **Phase-0 commit**; **GENUINE CAPABILITY GAP (partial)** = *no metrics SDK / alerting channel in any runtime; live ESP/WhatsApp adapters unbuilt*.

### 18. Canonical infrastructure

- **Current Sources of Truth:**
  - **A — Cloudflare Workers** (4 `wrangler.toml` = the 4 real services) — ALL.
  - **B — Vercel** (9 `vercel.json`: root + 8 apps incl. all 4 frozen apps) — ALL.
  - **C — topology config family** (`config/runtime/`: `deployment-topology.json`, `production-topology.json` (21 runtime roots incl. reserved+frozen), `cloudflare-topology.json`, `cloudflare-binding-ownership.json`, `deployment-lineage-manifest.json`, `environment-lifecycle.json`, `rollout-lifecycle.json`) — ALL.
  - **D — multi-region/distributed contract** (`multi-region-runtime.json` india/apac/eu/us + `distributed-*-contract.json` + `durable-execution-contract.json` + `replay-*.json` + `runtime-causality-graph.json` + survivability configs) — ALL (the loser, mandated by the gate).
  - **E — archived helm/k8s dead twin** (`docs/archive/infra-deployment-legacy-2026-06-10/`) — archive only.
- **Target Single Source of Truth:** **one-region modular monolith (`api-gateway`) + 4 satellites + one RLS Postgres (ap-south), `letbuyy.com`; Cloudflare (services) + Vercel (the 6 canonical apps) as the only deploy substrates; the multi-region/distributed contract is DEAD.** (Phase 2 Decision 8; DOC 01 §6.)
- **Required Convergence Path:** (1) **ARB repeal** of the survivability contract (no `SKIP` row authorizes keeping it). (2) **retarget — in one paired change** — `survivability-governance-validator.mjs` (regions/failover/`globalRegions>=4`) + `whole-repo-end-state-validator.mjs:172-177` + the `production-topology.json.globalRegions` block + the 3 workflows wiring `validate:survivability`. (3) **commit** plane C **with** step 2 (the unhook must precede/accompany the commit, else it self-blocks CI). (4) **archive** the multi-region/distributed config family + the ≥10 distributed-governance docs. (5) **delete** frozen-app `vercel.json` rows + reserved/frozen rows mislabeled deployable.
- **Deletion Candidate:** the multi-region/distributed config family (`multi-region-runtime.json`, `distributed-*`, `durable-execution`, `replay-*`, survivability configs); the survivability/end-state region assertions; frozen-app deploy rows.
- **Risk:** **S0** (governance theater) — the gate enforces a constitutionally-forbidden topology; committing plane C *worsens* it by making the contradiction repository-wide.
- **Blocking Dependencies:** **ARB survivability-unhook** (the keystone — explicit ARB repeal + one paired retarget); **Phase-0 commit** (sequenced with the unhook).

### 19. Canonical deployment model

- **Current Sources of Truth:**
  - **A — `production-deploy.yml` triggers on `main`** (`:5-6`); `main` is the only deploy source, +30 behind — A.
  - **B — HEAD `stepup/main`** (+30; interim) — B.
  - **C — the working tree** (the hardened end-state: migrations 162–166, asymmetric identity, RLS+GUC, 512 staged deletions; **zero git history**) — C.
- **Target Single Source of Truth:** **`stepup/main` working tree (plane C) is the intended truth; after Phase-0 it is committed and `main` is fast-forwarded so `git rev-list --count main..stepup/main = 0`.** (Phase 2 Decision 7; `DEPLOY-R1`/`ANTI-R11`.)
- **Required Convergence Path:** (1) **commit** plane C with `git add -A` **avoiding the commit trap** (tracked root/governance docs are staged-deleted while their archive copies are untracked — a tracked-only commit orphans the archive). (2) **unhook** the survivability/multi-region gate in the **same** change (Domain 18). (3) **ARB-ratify** (record `SKIP-GATE1-ARB-RATIFICATION`). (4) **fast-forward `main`** (branch-lag guard → 0). (5) deploy; run live-seam probes. **Hard warning (`ANTI-R11`): never `git checkout .` / `git clean -fd` — that destroys plane C (Constitution, AGENTS_V2, migrations 162–166, all `??`/`M`/`D` with zero history).**
- **Deletion Candidate:** none (this domain *is* the commit/fast-forward that makes every other deletion durable); `main`'s stale state is superseded by fast-forward, not deleted.
- **Risk:** **S0** — the deploy plane is the pre-hardening platform (account-takeover, anon leaks, mutable money, 3% rake all ship from `main`); the fixes are stranded in an uncommitted tree.
- **Blocking Dependencies:** **Phase-0 commit** (this domain defines it); **ARB survivability-unhook** (same change); **ARB ratification** (GATE-1).

### 20. Canonical governance

- **Current Sources of Truth:**
  - **A — root `AGENTS.md` = promoted `LETBUYY_AGENTS_V2`** ("HAND-AUTHORED LAW. NOT GENERATED"; already promoted in the working tree) + the 7-doc canon stack in `GOVERNANCE_REWRITE_2026_06_10/` (Constitution > AGENTS_V2 > Canonical Systems > Legacy+Roadmap > UI/UX > Scorecard) — C (the prior generated regime is what A/B carry as committed law).
  - **B — the scan-generated AGENTS.md regime** (9-app topology + CQRS manifests + stale counts as law; the generator `scripts/generate-repository-intelligence.mjs`) — A/B.
  - **C — 61 active + 18 archived nested `AGENTS.md`** (packages 24, apps 12, services 10, infrastructure 7, docs 5, …) each a ranked local authority — ALL.
  - **D — `docs/governance/` = 38 files `D`-deleted in WT** — A/B (tracked), deletion drafted on C.
- **Target Single Source of Truth:** **one Constitution (DOC 01) + AGENTS_V2 (DOC 02, the promoted root `AGENTS.md`) + Canonical Systems (DOC 03); the generated regime is DEAD and regenerated as a subordinate map of V1.** (Phase 2 Decision 5; `DOC-R1`.)
- **Required Convergence Path:** (1) **commit** the canon stack avoiding the commit trap (Phase 0). (2) **retarget**/retire the generator (exit 1) **before** deleting the fiction validators (`DEL-R3`). (3) **archive** the ~60 superseded root docs + the 18 archived nested copies as already drafted. (4) **delete** `docs/governance/` (already `D`) + regenerate `AGENTS.md` as the subordinate map of V1 §6. (5) reconcile the 61 active nested `AGENTS.md` to subordinate maps (not competing law).
- **Deletion Candidate:** the generator + ~36 fiction validators; `docs/governance/` (38 files); the superseded root docs.
- **Risk:** **S2** — a generated doc as law misleads every agent/human and certifies the rejected end-state; root cause of drift-as-law, not a runtime breach.
- **Blocking Dependencies:** **Phase-0 commit** (avoid commit trap); **ARB ratification** (GATE-1 — DOC 01 self-declares a ratification; record the skip); retarget the asserting validators **first**.

### 21. Canonical validators

- **Current Sources of Truth:**
  - **133 `.mjs` on disk** (`ls scripts/validators/*.mjs`) — ALL.
  - **77 `D`-deleted in WT** (the distributed/fiction validators) — A/B (tracked), deletion drafted on C.
  - **90 referenced by `scripts/validate-governance.mjs`** (with 6-lane aliasing → fewer real checks) — ALL.
  - **The self-mandating pair:** `survivability-governance-validator.mjs` (**on `main`**) + `whole-repo-end-state-validator.mjs` (**C-only**) require the forbidden 4 regions — ALL/C.
  - **The grandfathering allowlists:** `identity-sole-issuer-validator.mjs:10-15` (`legacyAllowedUntilD3`), `canonical-ledger-only-validator.mjs:22-32` (`legacyAllowedUntilD5`, 9 files) — ALL.
- **Target Single Source of Truth:** **one validator suite that enforces *this* Constitution (DOC 01 §5.3), never the rejected end-state; de-aliased; allowlists drained as their D-gates clear.** (Phase 2 Decision 5/8; `DEL-R3`.)
- **Required Convergence Path:** (1) **retarget** the survivability/end-state region + `validate:survivability` assertions (the paired change, Domain 18) **before** any deletion. (2) **commit** plane C so the 77 deletions land (Phase 0). (3) **de-alias** the 6 lane-aliases to their underlying checks. (4) **retarget** then **delete** the fiction/distributed validators. (5) **drain** the `legacyAllowed*` allowlists as Identity-D3 / Ledger-D5 close, then remove the allowlist branches. (6) **retarget** `canonical-ledger-only-validator` to see SQL writers + add `orders`/capture (ties to Payments).
- **Deletion Candidate:** the 77 distributed/fiction validators; the 6 lane-aliases; the `legacyAllowed*` branches (after drain); the multi-region region assertions.
- **Risk:** **S1** (with an S0 facet) — the suite mandates a forbidden topology and grandfathers the losing money/identity implementations; money has zero validator enforcement at the SQL writer.
- **Blocking Dependencies:** **ARB survivability-unhook** (region assertions); **Phase-0 commit** (the 77 deletions); the allowlist drains depend on Identity/Ledger/Payments **capability gaps** closing.

### 22. Canonical database ownership

- **Current Sources of Truth:**
  - **A — `services/api-gateway` is the sole DB writer** (`getSupabaseAdmin` = **917 occurrences / 99 files, 100% in api-gateway**) — ALL. merchant-control-plane (62 routes) + storefront-runtime (21 routes) hold **no** DB client (BFF proxies).
  - **B — admin client re-declared 3×** (canonical `gateway/src/lib/supabase.ts getSupabaseAdmin` + `internal-developer-ops.ts` + `internal-compliance.ts`) — ALL.
  - **C — tenant-isolation plane:** blanket `service_role` + raw-REST `supabaseServiceHeaders` (A/B/C) **vs** RLS `ENABLE`+`FORCE`+per-tx GUC `app_tenant` (`withTenantTx`) in **untracked** mig 163/164 (**C only**); baseline carries **58** `USING(true)` permissive policies — ALL/C.
  - **D — migrations:** max on `main` = 158, HEAD tracked = 161, WT adds **162–166 untracked** (+090/100 modified) — A/B/C.
- **Target Single Source of Truth:** **`api-gateway` is the single DB owner over a pooled transactional `app_tenant` (NOBYPASSRLS) connection with RLS FORCE + per-tx GUC; `service_role` survives only as audited `withServiceRole(reason, fn)` break-glass.** (Phase 2 Decision 4; `SEC-R9`/`WIN-R3`.)
- **Required Convergence Path:** (1) **commit** migrations 163/164 (+162/165/166) (Phase 0). (2) **retarget** the 3× admin-client re-declarations to the one canonical factory. (3) **retarget** per-route reads to `withTenantTx`; **delete**/parity the raw-REST `supabaseServiceHeaders` callers; **close** the 58 permissive `USING(true)` policies. (4) the RT-1…9 red-team adoption proof is a build (out of scope this phase). (5) **delete** blanket `service_role` default once break-glass-only.
- **Deletion Candidate:** the 2 duplicate admin-client re-declarations; the 58 permissive policies; the raw-REST bypass callers; blanket `service_role` default.
- **Risk:** **S0** — anon-readable tenant PII/orders/customers via `USING(true)` PUBLIC policies on the deploy plane; raw-REST helpers bypass the app-layer guard.
- **Blocking Dependencies:** **Phase-0 commit** (mig 163/164); **GENUINE CAPABILITY GAP (partial)** = *RT-1…9 per-route `withTenantTx` adoption proof + raw-REST parity are unbuilt*; not ARB-gated.

---

## Convergence Dependency Map

Every domain is sorted into exactly one **primary** bucket by its **binding** blocker (the constraint that gates the SoT). Secondary blockers are noted, because many domains carry more than one — but the bucket is the thing that must clear *first*.

### Bucket 1 — Unblocked by Phase-0 commit alone (quick wins) — **5 domains**
The winner is correct and complete but lives only in the uncommitted working tree; a `git add -A` (avoiding the commit trap) + ratify + fast-forward `main` makes it live and the loser dead code to delete. No ARB topology call, no engineering, no trace.
- **3. Canonical packages** (commit the 8-package deletion drafted on C — *but secondary: the validator-retarget belongs to Bucket 2's paired change; the deletion itself is commit-gated*).
- **15. Canonical UI system** (commit the already-`D` token-fork deletions; generation discipline only).
- **20. Canonical governance** (commit the canon stack; *secondary: ARB GATE-1 ratification*).
- **21. Canonical validators** (commit the 77 deletions; *secondary: the region-assertion retarget is Bucket 2*).
- **19. Canonical deployment model** (the commit + fast-forward itself; *secondary and inseparable: the survivability-unhook must ride the same change — Bucket 2*).
> Honest caveat: Governance, Validators, Packages, and the Deployment commit are **commit-first** but each carries a **Bucket-2 secondary** (GATE-1 ratification, or the survivability-unhook that must accompany the very same commit). Pure-clean quick win with no ARB tail = **UI system** only. The other four are "commit-gated, with an ARB rider."

### Bucket 2 — Need an ARB decision before any delete (governance / topology / React-deletion) — **5 domains**
A human governance/topology/loser-protection decision must land before the convergence can start; the survivability-unhook is the keystone and must precede or accompany the Phase-0 commit.
- **18. Canonical infrastructure** — **ARB repeal of the survivability contract** + the one paired retarget (2 validators + topology + 3 workflows). *The keystone; committing C without this makes the self-block repository-wide.*
- **2. Canonical services** — reserved-service emptiness assertions live in the same end-state validator family (one paired change).
- **8. Canonical checkout** — reserved `checkout-runtime` assertion family (same change); secondary dependency on Identity for token signing.
- **1. Canonical apps** — frozen-app freeze-in-place vs archive-and-delete is a human topology call.
- **14. Canonical themes** — **ARB ratification of the deferred React→Liquid flip**; React is FROZEN by a ratified validator and **must not be deleted now** (also Bucket 4 on the Liquid build side).
> Notifications (17) also depends on the survivability-unhook (the Prometheus assertion lives in `survivability-governance-validator.mjs`) but is bucketed in 3/4 by its alerting capability gap; its validator-retarget rides the Bucket-2 paired change.

### Bucket 3 — Need a call-graph trace (storefront / orders / inventory / shipping / tax proxy routing) — **5 domains**
The "second backend" is a **proxy-layer** duplicate (62 BFF proxies, 0 DB client; all 917 `getSupabaseAdmin` in api-gateway). SoT is reachable by tracing each proxy route to its gateway owner, then proxy-or-port with per-route contract tests — Med complexity, not a DB collapse.
- **9. Canonical orders** (trace the MCP + storefront order proxies).
- **10. Canonical inventory** (trace the inventory proxy; secondary commit-gate on mig 166).
- **11. Canonical shipping** (trace the shipping/zones proxy).
- **12. Canonical tax** (trace the taxes proxy).
- **13. Canonical storefront** (trace the 21 storefront API routes; secondary dependency on Identity cookie realm).

### Bucket 4 — Need genuine engineering (capability gaps) — **7 domains** (6 hard + partials)
The named owner posts/pays/clears/verifies/binds nothing in any reality; a delete does not produce a working SoT. Convergence collapses the duplicate writers around the gap; **this phase names the gap, does not design the fix.**
- **5. Canonical payments** — *storefront/webhook capture writes 0 canonical ledger entries* (the single largest unfinished winner). **Hard.**
- **6. Canonical ledger** — *reconciliation refreshers have 0 callers → wallet 409s forever.* **Hard (partial: commit lands the kernel).**
- **7. Canonical settlement** — *no executor for scheduled payout rows; no cross-source dedup* (also ARB which-writer). **Hard (partial).**
- **12 (payout)/Canonical settlement** — *no payout provider client; `initiateTransfer` throws in every plane.* **Hard.** *(The payout-rail capability; the rail decision itself is canon-clean, the client is the gap.)*
- **14. Canonical themes** — *Liquid has no header/footer/chrome, binds no data, `index`-only, no merchant/canary surface.* **Hard (also Bucket 2 ARB flip).**
- **16. Canonical mobile** — *login Turnstile double-spend blocks prod login* (a bug; also ARB re-wire/delete the editor). **Partial.**
- **17. Canonical notifications** — *no metrics SDK / alerting channel in any runtime; live ESP/WhatsApp adapters unbuilt.* **Partial (also Bucket 2 validator-retarget).**
- **4. Canonical identity** — *live keypairs/JWKS unprovisioned; step-up crypto is a mock; OIDC is a 501 skeleton; non-merchant realms still HS256.* **Partial (commit lands the merchant issuer).**
- **22. Canonical database ownership** — *RT-1…9 `withTenantTx` adoption proof + raw-REST parity unbuilt* (the commit lands mig 163/164). **Partial.**

> **The four hardest capability gates are the real critical path: 5 (capture ledgering), 6 (reconciliation wiring), 12/7 (payout client + executor), 14 (Liquid build).** The money path (6 + 7 + 12 + 5) cannot complete until the canonical ledger is fed by capture, a payout provider client exists, the recon refreshers run, and dedup exists. Everything else is a commit, a validator retarget, an archive move, or a contract-tested proxy cutover — none of which moves a rupee.

---

## SoT Summary Table

| # | Domain | #Current sources | Target Single Source of Truth | Blocker class | Risk |
|---|---|---|---|---|---|
| 1 | Canonical apps | 3 classes (6 canonical / 4 frozen / 7 deprecated) | 6 canonical app roots | ARB ratification + Phase-0 | S2 |
| 2 | Canonical services | 2 (4 real / 6 reserved) | 4 real services | ARB survivability-unhook + Phase-0 | S2 |
| 3 | Canonical packages | 2 (22 canonical / 8 distributed) | 22 workspace packages | Phase-0 commit (+ Bucket-2 rider) | S0 (theater) |
| 4 | Canonical identity | 5 (A asym / B randomHex / C shadow / D HS256 / E OIDC) | identity-platform sole asymmetric issuer | CAPABILITY GAP (keys/step-up/OIDC) + Phase-0 | S0 |
| 5 | Canonical payments | 2 (A ledgered V1 / B no-ledger confirm) | ledgered capture (poster) | CAPABILITY GAP (capture ledgering) | S0 |
| 6 | Canonical ledger | 3 (A canonical / B mutable / C mini) | canonical append-only ledger | CAPABILITY GAP (recon wiring) + Phase-0 | S1 |
| 7 | Canonical settlement | 4 writers + 2 payout models | single-writer settlement + statements | CAPABILITY GAP (executor/dedup) + ARB + Phase-0 | S1 |
| 8 | Canonical checkout | 3 (A gateway / B core / C reserved) | checkout in api-gateway (typed by checkout-core) | ARB survivability-unhook + Phase-0 (+Identity) | S1 |
| 9 | Canonical orders | 3 (A gateway / B MCP proxy / C storefront proxy) | api-gateway sole order writer | call-graph trace + Phase-0 | S2 |
| 10 | Canonical inventory | 2 (A gateway / B MCP proxy) | api-gateway sole inventory writer | call-graph trace + Phase-0 (mig 166) | S2 |
| 11 | Canonical shipping | 2 (A gateway / B MCP proxy) | api-gateway sole shipping writer | call-graph trace + Phase-0 | S2 |
| 12 | Canonical tax | 2 (A gateway / B MCP proxy) | api-gateway sole tax writer | call-graph trace + Phase-0 | S2 |
| 13 | Canonical storefront | 2 (A app / B deprecated aliases) + 1 backend | apps/storefront-runtime (proxies gateway) | call-graph trace + Phase-0 (+Identity) | S2 |
| 14 | Canonical themes | 2 renderers + 2 engine roots | Liquid renderer (React FROZEN, not deleted now) | CAPABILITY GAP (Liquid build) + ARB flip | S2 |
| 15 | Canonical UI system | 2 live (ui→ui_kit) + removed forks + marketplace forks | packages/typescript/ui tokens (one source) | Phase-0 commit | S2/S3 |
| 16 | Canonical mobile | 5 (A app+bff / B GoRouter / C editor / D model forks / E reserved) | merchant-app + composite mobile-bff | CAPABILITY GAP (login) + ARB (editor) + Phase-0 | S3 (S1 login) |
| 17 | Canonical notifications | 3 (A router / B reserved svc / C dead obs config) | WhatsApp-first router (honest mock-by-default) | CAPABILITY GAP (alerting) + ARB unhook + Phase-0 | S2 |
| 18 | Canonical infrastructure | 5 (Cloudflare / Vercel / topology / multi-region / helm-k8s) | one-region monolith + 4 satellites | ARB survivability-unhook (keystone) + Phase-0 | S0 (theater) |
| 19 | Canonical deployment model | 3 (A main / B HEAD / C worktree) | stepup/main worktree → committed → main ff | Phase-0 commit + ARB unhook + GATE-1 | S0 |
| 20 | Canonical governance | 4 (A canon stack / B generated / C 61 nested / D docs/governance) | Constitution + AGENTS_V2 + Canonical Systems | Phase-0 commit + ARB GATE-1 | S2 |
| 21 | Canonical validators | 133 disk / 77 D / 90 referenced + self-block + allowlists | one Constitution-enforcing suite | ARB survivability-unhook + Phase-0 | S1 (S0 facet) |
| 22 | Canonical database ownership | 4 (A gateway / B 3× client / C service_role-vs-RLS / D migrations) | api-gateway over app_tenant RLS+FORCE+GUC | CAPABILITY GAP (RT-1…9) + Phase-0 (mig 163/164) | S0 |

**Bucket counts:** Bucket 1 (Phase-0 only) = **5** (one pure: UI; four commit-with-rider) · Bucket 2 (ARB) = **5** · Bucket 3 (call-graph trace) = **5** · Bucket 4 (capability gap) = **7** (with several domains carrying a secondary blocker in another bucket). **S0 domains = 6** (identity, payments, infrastructure, deployment, database, packages-as-theater); **all survive the merge** until Phase-0 + the unhook + the capability builds land.

---

## Unknowns / UNVERIFIED (never silently upgraded to fact)

1. **Untracked file count delta:** live `git status --porcelain | grep -c '^??'` = **79** this run; the Phase-1 prose cited **78**. The 1-file delta is within normal working-tree churn (likely this report's siblings or a transient artifact) and does not affect any winner/blocker; flagged for honesty. Counts D=512 / M=410 re-confirmed exactly.
2. **`packages/search-core` asymmetry:** present at HEAD (4 files), in the distributed cluster by nature, but **not** listed in `rejectedPackageRoots` (7 entries). Whether it is intentionally retained or an omission is **UNVERIFIED** — the convergence path flags adding it; ARB should confirm before deletion.
3. **Live deployed state** of every domain — CI deploys from `main` (plane A); the repo cannot prove what production runs (live identity plane, live DB migration level, live RLS/grant state, live commission rows, live Vercel projects). All **UNVERIFIED**. The 58 baseline `USING(true)` policies are strong evidence the anon leaks are live, but a `\dp public.orders` / anon-key probe is the proof.
4. **merchant-control-plane per-route call-graph** (Domains 9–13) — Wave A established the 62 routes are BFF proxies *in aggregate* (0 DB client); **which UI page calls which route vs the gateway, per route, is UNVERIFIED** and gates safe cutover sequencing. The trace is the Bucket-3 work.
5. **`production-topology.json` `globalRegions` semantics** (Domain 18) — whether the 4-region block encodes Cloudflare *edge* presence (compatible with one-region) or a *data-region* contract (incompatible). The survivability validator's `failoverPairs`+`replayRequired` read as a data-region contract (incompatible), but ARB should confirm.
6. **ARB intent on the survivability contract** (Domains 18/21) — whether keeping it was directed or program improvisation is **UNVERIFIED**; no `SKIP` row authorizes keeping it, only its existence. Repeal requires an explicit ARB decision.
7. **The four capability gaps' exact build scope** (capture ledgering, payout client, reconciliation wiring, Liquid chrome/data-binding, step-up crypto, mobile login) — this phase **names** them and does **not** design the fix; their effort/sequence is the Phase-8 masterplan's job.
8. **Whether every `M` (410 modified) file is part of the convergence end-state** vs incidental — sampled (migrations 090/100, validators, theme-governance), not exhaustively diffed.
9. **Migration 162 in-place commission-history rewrite** — whether ARB accepts an un-ledgered backfill of past rows or requires a ledgered correction entry is an open human decision (affects Ledger/Settlement honesty).
10. **Validator de-aliasing** — the 90 gate-referenced names include ~6 lane-aliases of one underlying check; counted, not fully de-aliased.

---

*End of Phase 3 SINGLE SOURCE OF TRUTH MASTERPLAN. Discovery/planning only — the single file written is this report; no code, schema, git state, migration, or other document was modified. Every Target SoT equals a Phase-2 winner (0 overturns); every load-bearing path/line/count re-derived or re-verified this phase against `stepup/main` @ `5cf9e64e`, working tree dirty (512 D / 410 M / 79 ??), 2026-06-10. This feeds the Phase-8 masterplan: Bucket 1 = quick wins, Bucket 2 = ARB, Bucket 3 = call-graph trace, Bucket 4 = capability builds.*
