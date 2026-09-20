# SINGLE SOURCE OF TRUTH PLAN — Convergence Audit Phase 3

**Phase:** 3 of 10 — SINGLE SOURCE OF TRUTH. For every major domain this phase defines the **one canonical owner** and the **convergence path** (delete / archive / commit / retarget) that collapses N competing sources of truth into 1. It binds the winner spine (`_PREMISES_SEED.md`), the current-authority map (`DUPLICATE_AUTHORITY_REPORT.md`, Phase 2), and the scored winners (`STRATEGIC_WINNER_DECISIONS.md`, Phase 4); it draws launch-blocker / capability-gap classification from `FOUNDATION_GAP_REPORT.md` (Phase 7); code citations carry forward from `REPOSITORY_TRUTH_AUDIT_2026_06_10/`.
**Mode:** DISCOVERY / PLANNING ONLY. No code, no architecture, no codex prompts, no implementation. Read-only git. "Convergence path" = **delete / archive / commit / retarget** steps only — NOT software design. The single file written is this report.
**Repo state (re-verified this phase):** branch `stepup/main` @ HEAD `c4fc3cd6` (2026-06-10); deploy branch `main` 30 commits behind; working tree dirty **512 D / 410 M / 78 ??**. Migrations 162–166 + their rollbacks are **untracked** at `database/supabase/migrations/`; identity issuer/verifier files untracked; MCP second backend = **62** `/api/route.ts`; storefront-runtime = **21**; `getSupabaseAdmin(` = **664** call-sites; **79** nested non-root `AGENTS.md`.

> **What "Single Source of Truth" means here.** A domain has SoT when exactly one owner has the right *and the wiring* to be authoritative, and every other implementation is either deleted, archived, or demoted to a verify-only / read-only projection. This phase distinguishes three failure modes sharply:
> 1. **SoT achievable by convergence** — N sources exist, the winner works, and collapsing to 1 is delete/commit/retarget plumbing.
> 2. **SoT BLOCKED BY COMMIT** — the winner is correct and complete but lives only in the uncommitted working tree; Phase 0 commit flips it.
> 3. **SoT BLOCKED BY CAPABILITY GAP, not convergence** — the canonical owner is *named but not built/wired*; deleting the loser does not produce a working SoT because no working SoT exists in any reality. These are flagged explicitly and the gap is named. **A delete does not fix a capability gap.**

---

## Executive Summary

1. **For 21 domains, the canon already names a single owner; the obstacle to SoT is almost never "which one wins" — it is durability, deployment, and four genuine capability gaps.** Every Target SoT below matches the winner spine and the Phase-4 scored winner with **zero overturns**. The conflicts are *decided*; the losers are still alive because the winner is uncommitted (temporal triplication), undeployed, validator-mandated, or — in four money/identity domains — *not actually built*.

2. **The blocker classes sort into three buckets that do not substitute for each other** (this is the rollup that feeds Phase 9):
   - **Quick-wins — unblocked by Phase 0 commit alone (≈6 domains):** Governance, Validators, Mobile (dead-nav/token cleanup), plus the *committable* halves of Database, Commission, and the Branch-reality collapse. Once the working tree is committed and `main` fast-forwards, the winner is live and the loser is dead code to delete.
   - **ARB-gated — need a human governance/topology decision before any delete (≈3 domains):** Infrastructure and Validators' **multi-region self-block** (the new gate *requires* 4 forbidden regions), Storefront/Themes' loser-protection (React FROZEN by ratified validator; deleting it blanks every store), and the prompt/doc archive moves that the survivability validator transitively pins.
   - **Capability-gated — SoT cannot be achieved by convergence at all (4 hard domains + 2 partials):** **Payments-capture** (storefront confirm writes 0 ledger lines), **Settlement/payout-rail** (no payout provider client — `initiateTransfer` throws), **Ledger** (reconciliation RPCs have 0 callers → wallet 409s forever), and **Identity step-up** (mock token theater); **Themes** (Liquid has no header/footer/data-binding) and **Mobile login** (Turnstile double-spend) are capability-gapped on the winner side too. For these, the convergence path stops at "commit + retarget what exists" and then **names the missing build** — it does not pretend a delete completes the SoT.

3. **The master obstacle sits above all 21 domains: the winner is the least durable reality.** Every Target SoT for an S0/S1 domain lives in the uncommitted working tree with zero git history; a `git checkout .` / `git clean -fd` resurrects the losers and destroys the winner. **Phase 0 (commit the working tree as the Truth Freeze, avoiding the tracked-deletion/untracked-archive commit trap, then ratify + fast-forward `main`) is a hard prerequisite for nearly every convergence path below** and is listed as a blocking dependency on each.

4. **Two convergence paths are self-blocked by the new law and cannot start without an ARB repeal.** `whole-repo-end-state-validator.mjs:172–186` *requires* `globalRegions ⊇ [india,apac,eu,us]` and wires `validate:survivability` into 3 workflows; `survivability-governance-validator.mjs:106` requires `globalRegions.length >= 4` — both contradict `LETBUYY_CONSTITUTION.md:98,108,112` (India-only, may not certify multi-region). Deleting the multi-region artifacts **fails CI**. Infrastructure SoT (one-region monolith) therefore cannot converge until ARB repeals the survivability contract and the two validators + topology + 3 workflows are retargeted in one paired change.

5. **Four domains are honest dead-ends for convergence and must be tagged as engineering, not cleanup.** Payments-capture, Payout-rail/Settlement-execution, Ledger-reconciliation, and Identity-step-up each have a *named* canonical owner that posts/pays/clears/verifies **nothing** in any of the three realities. The Phase-9 roadmap must carry these as builds; this phase's contribution is to draw the line precisely: convergence collapses the *duplicate writers* around them, but the SoT itself stays BLOCKED until the capability ships.

---

## Method

- **Per-domain block (exact fields, as mandated):** Current Sources of Truth (all competing owners, with `path` + which reality `main`/HEAD/worktree each lives in) · Target Source of Truth (the single canonical owner, bound to the spine + Phase 4) · Required Convergence Path (ordered **delete / archive / commit / retarget** steps only) · Deletion Candidate (what specifically dies once converged) · Risk (S0–S3 + one line) · Blocking Dependencies (what must be true first).
- **Risk scale (consistent with Phase 2/7):** **S0** = user-facing money/identity/security exposure or law-mandates-its-own-loser · **S1** = security/integrity latent or blocks a winner from going live · **S2** = correctness/governance-honesty/throughput · **S3** = cleanup/cosmetic.
- **Convergence vs capability (the central distinction):** where the SoT can be reached by delete/commit/retarget, the path ends in a Deletion Candidate. Where a **genuine capability gap** exists (Phase 7 Class C), the block is marked **"SoT BLOCKED BY CAPABILITY GAP, not convergence,"** the gap is named, and the convergence steps are limited to what genuinely converges (duplicate-writer collapse) — explicitly *not* claiming the delete produces a working SoT.
- **Convergence assumption (from the seed):** "no prod users / no prod data / no migration constraints" + aggressive-deletion ⇒ paths are **DELETE-not-MIGRATE** wherever the only constraint was production safety; Phase 0 commits the working tree and ratifies governance before any loser is touched.
- **Verification.** Every load-bearing path/line re-verified this phase (grep/find/git status) or carried from a prior report spot-checked here. Live deployed state is UNVERIFIED throughout (CI deploys from `main`; `production-topology.json` self-labels `governance-contract-not-live-evidence`). Where this phase's count diverges from the seed it is flagged **[SEED-CONFLICT, magnitude]**; the winner spine is unchanged.

---

## 21 Domain Single-Source-of-Truth Blocks

### 1. Identity (who issues principals)

- **Current Sources of Truth:**
  - **A — `apps/identity-platform` asymmetric ES256/EdDSA issuer** (`src/lib/auth/identity-issued-session.ts`, **untracked, worktree-only**) + gateway JWKS verify (`services/api-gateway/src/lib/identity-session-verifier.ts`, **untracked, worktree-only**). Covers exactly ONE token type today (merchant session).
  - **B — gateway opaque session mint** `auth.ts:1140` `token = providedToken || randomHex(32)` (**HEAD + `main`, the deployable reality**); carries the `/api/auth/switch` account-takeover.
  - **C — `services/api-gateway/src/identity-foundation/` shadow stack** (18 files: `token-shadow.ts`, `shadow-compare.ts`, `mock-key-service.ts`, `oauth-skeleton.ts`, …) — verified 18 files (HEAD/worktree).
  - **D — `packages/auth-core` HS256 minters** (app-scoped / customer / console / magic-link) over shared `AUTH_SECRET` (all realities).
- **Target Source of Truth:** **A — identity-platform as sole asymmetric issuer; gateway and all others verify-only.** (Spine "Identity"; Phase 4 Decision 2, composite 6.3 vs 4.0.)
- **Required Convergence Path:** (1) **commit** the working tree so A's two untracked files exist (Phase 0). (2) **commit + provision** live keypairs/JWKS (`SKIP-D3`) so A can issue in prod. (3) **retarget** shopper/console/app/magic-link/`lb_accounts` issuance from D into A (each needs an asymmetric or dedicated-secret replacement — see Tokens). (4) **retarget** gateway to verify-only; run the `IDN-R2` dual-verify drain (telemetry: zero legacy-HS256 verifications). (5) **delete** B's `randomHex(32)` mint path and the `/api/auth/switch` mint only after drain proves zero legacy verifications. (6) **delete** C (the 18-file shadow stack) once A serves verify-only live (`IDN-R3` SAFE_DELETE gate).
- **Deletion Candidate:** gateway `randomHex(32)` mint (`auth.ts:1140`) + `/api/auth/switch` mint branch; the 18-file `identity-foundation/` shadow stack; D's minters once every realm is re-homed.
- **Risk:** **S0** — the deployable reality (B) mints unauthenticated sessions and ships the takeover; the winner is uncommitted.
- **Blocking Dependencies:** Phase 0 commit; live identity keys (`SKIP-D3`, Class B); per-realm re-homing of D (engineering, not pure convergence); `IDN-R2` drain telemetry; `IDN-R3` verify-only-live gate.

### 2. Payments (capture path — order money in)

- **Current Sources of Truth:**
  - **A — ledgered V1 capture:** `POST /payments/:id/capture` → `post_settlement_ledger_transaction` (`services/api-gateway/src/routes/payments.ts:289–309`). Posts canonical ledger lines. Exists on the low-traffic V1 surface only (HEAD/worktree).
  - **B — no-ledger storefront/webhook confirm:** every storefront Razorpay verify + all 4 provider webhooks → `confirm_order_payment_with_ledger` (`database/supabase/migrations/000_baseline.sql`, fn body has **0** canonical-ledger writes — naming theater). **This is the path every shopper hits, in all three realities.**
- **Target Source of Truth:** **A — ledgered capture is the canonical poster; the storefront/webhook confirm must post ledger entries (or route through A).** (Spine "Money-capture"; Phase 4 Decision 13, target 6.0 vs 4.6 — but neither side is the wired winner.)
- **Required Convergence Path:** Convergence *cannot* produce SoT here. The only genuine convergence step is (1) **retarget** the `canonical-ledger-only-validator` to see SQL writers and add `orders` to its ratchet table list, so the gap stops being invisible. Everything else is a build: the storefront/webhook confirm chain must be made to post `payment_capture` canonical entries. (2) **delete** the no-ledger `confirm_order_payment_with_ledger` body's misleading `_with_ledger` name only *after* a ledgered path replaces it.
- **Deletion Candidate:** none safely deletable now — B is the live buyer path. After the build: the no-ledger confirm SQL.
- **Risk:** **S0** — the platform's books for its primary money path do not exist; un-ledgered captures don't credit `merchant_payable`, so payout cannot release.
- **Blocking Dependencies:** **SoT BLOCKED BY CAPABILITY GAP, not convergence.** Gap = *the storefront/webhook capture chain writes zero canonical ledger entries (Phase 7 PAY-1, the single largest unfinished winner).* Survives any commit/merge. Also depends on reconciliation harness green (Ledger domain).

### 3. Ledger (money truth model)

- **Current Sources of Truth:**
  - **A — canonical append-only double-entry:** `ledger_accounts/transactions/entries` (mig `139`, append-only triggers `139:358–382`; UPDATE/DELETE REVOKE in **untracked** mig `165:463–464`). The ratified money truth.
  - **B — mutable mobile model:** `wallet_ledger_entries`, `payout_statements`, `commission_*` (mig `119`) — mutable `balance_after` as truth (all realities).
  - **C — mini-ledgers:** `gift_card_ledger_entries`, `store_credit.balance_minor` (`153:39`), `ai_credits.balance` — mutable running balances.
- **Target Source of Truth:** **A — canonical append-only ledger; B and C demoted to read-only projections.** (Spine "Money-ledger"; Phase 4 Decision 3, composite 6.7 vs 3.6.)
- **Required Convergence Path:** (1) **commit** migrations 160/162/165 (Phase 0) so A's authority layer (reconciliation tables, claim guard, UPDATE/DELETE revoke) exists on a deployable ref. (2) **retarget** `wallet.ts` reads to derive from A; B/C become projections. (3) The convergence *stops here* — clearing the wallet requires a build: the reconciliation refreshers (`refresh/assert_money_ledger_site_reconciliation`, `backfill_wallet_ledger_to_canonical`, `160:198–355`) have **zero runtime callers** and must be wired to a scheduler; then a zero-drift reconciliation proof (`SKIP-D5`) and a backfill. (4) **delete** B/C as truth sources only after the projection derives cleanly without manual ops (`DEL-R2` DELETE_AFTER_MIGRATION).
- **Deletion Candidate:** mutable `wallet_ledger_entries`/`payout_statements`/`commission_*` *as truth* (kept as projections until zero-drift); mini-ledger mutable balances.
- **Risk:** **S1** — wallet read fails closed at HTTP 409 `LEDGER_RECONCILIATION_REQUIRED` (`wallet.ts:172`) **forever** until an operator manually backfills; combined with PAY-1, 409 is the default state for real stores.
- **Blocking Dependencies:** Phase 0 commit (160/162/165); **SoT BLOCKED BY CAPABILITY GAP (partial)** = *reconciliation refreshers have zero callers + no in-product operator action to clear the 409 (Phase 7 PAY-3)*; live zero-drift proof (`SKIP-D5`, Class B).

### 4. Settlement (`merchant_payable` credit + payout objects)

- **Current Sources of Truth:**
  - **A — capture posting** `payments.ts:289` (writes `merchant_payable`).
  - **B — commission reconcile** `commission.ts:321` + settlement ingest `settlements.ts:207` (caller-declared amounts).
  - **C — payout statement gross from `orders.total`** (`payouts.ts:384`) — a fourth, ledger-independent number.
  - **Plus two payout object models:** `payout_statements` (claim guard `160:357`) vs settlement-ingest `payouts` instruction rows (`settlements.ts:283`, written `scheduled`, **never consumed**).
- **Target Source of Truth:** **a single-writer settlement module (one writer per account) + one payout object model (statements + claim guard).** (Spine §gaps #4; Phase 2 §3.3 Settlement rows.)
- **Required Convergence Path:** (1) **commit** mig 165 (settlement source-row ownership) (Phase 0). (2) The convergence *stops at duplicate-writer collapse design*, which is an ARB call on which writer survives per flow — **but the execution side is a capability gap**: no executor consumes the `scheduled` `payouts` rows; nothing dedups across A/B/C's per-source idempotency keys (the same rupee can enter twice). (3) **delete** the orphan `payouts` instruction-row model (B's payout object) once ARB confirms statements are canonical and no executor is built for it; or build the executor — ARB decides. (4) **retarget** payout gross to derive from the ledger, not `orders.total`.
- **Deletion Candidate:** the never-consumed `scheduled` `payouts` instruction rows (`settlements.ts:283`); the `orders.total`-derived gross number.
- **Risk:** **S1** — un-deduped triple+1 writers admit double-credit; the parallel payout model goes nowhere.
- **Blocking Dependencies:** Phase 0 commit; **ARB decision** (which writer survives per flow; statements-vs-instructions); **SoT BLOCKED BY CAPABILITY GAP (partial)** = *no cross-source dedup; no executor for scheduled payout rows (Phase 7 PAY-5, SET-3)*.

### 5. Checkout (order-creation + handoff authority)

- **Current Sources of Truth:**
  - **A — monolith-hosted origin** `CHECKOUT_ORIGIN=https://checkout.letbuyy.com` (gateway `wrangler.toml:273`) + DNS; cart-content HMAC digest binding + `create_order_with_inventory_reservations` reserve→commit authority (**untracked** mig `166:8–66`).
  - **B — reserved `services/checkout-runtime`** (manifest-only, empty).
  - The checkout success path **converges onto B-of-Payments** (`confirm_order_payment_with_ledger`, no-ledger) and the signature-only verify — it inherits, not adds, those money gaps.
- **Target Source of Truth:** **A — the monolith-hosted checkout origin with committed inventory/digest authority.** (Spine "Deployment-checkout origin"; Phase 2 §3.11 checkout row.)
- **Required Convergence Path:** (1) **commit** mig 166 (Phase 0) so the digest binding + reserve→commit authority exist (without it `main` has a tamper-survivable cart + oversell window). (2) **provision** the live checkout cutover (`SKIP-D6`: DNS + Vercel host + `CHECKOUT_SIGNING_SECRET` + carrier creds). (3) **Do NOT** "resolve" the A-vs-B duplicate by activating `checkout-runtime` — B is a reserved manifest seam that *dissolves at the live cutover*, not a deletion target. (4) Capture-ledger gap is inherited from Payments domain, not closed here.
- **Deletion Candidate:** none — B stays reserved; the duplicate dissolves at cutover.
- **Risk:** **S1** — without mig 166, tampered carts survive and oversell; production checkout URLs fail closed without `SKIP-D6`.
- **Blocking Dependencies:** Phase 0 commit (166); `SKIP-D6` live cutover (Class B); inherits the Payments capture-ledger capability gap.

### 6. Orders (mutation + refund authority)

- **Current Sources of Truth:**
  - **A — gateway order routes** + ledgered V1 refund `payments.ts:462–625` (step-up, cap, `merchant_payable→refund_clearing`).
  - **B — MCP order routes** (subset of the 62 `apps/merchant-control-plane` `/api/route.ts` second-backend surface).
  - **Refund writers (3):** A's V1 ledgered refund; **orders RPC** `orders.ts:1294`→`complete_order_refund` (`baseline:1039`, **no ledger**); **webhook** `refund.created`→`record_order_payment_failure_with_ledger` (**no ledger**).
- **Target Source of Truth:** **A — gateway owns order mutation; one ledgered refund authority.** (Spine "Storefront backend"; Phase 2 §3.3 refund row; Phase 4 Decision 8.)
- **Required Convergence Path:** (1) **commit** (Phase 0). (2) **retarget** B's MCP order routes to thin proxies of A (or port), gated on a per-page call-graph trace (UNVERIFIED). (3) For refunds, convergence collapses the *routing* but the SoT needs a build: the two un-ledgered refund paths must post canonical reversing entries. (4) **delete** the MCP duplicate order writers after contract tests; **delete** the un-ledgered refund branches only after they post ledger lines.
- **Deletion Candidate:** MCP duplicate order routes (after call-graph trace); the two un-ledgered refund code paths (after ledgering).
- **Risk:** **S1** — 2 of 3 refund paths are un-ledgered (refund state diverges from books on the paths merchants actually use).
- **Blocking Dependencies:** Phase 0 commit; per-page call-graph trace (UNVERIFIED — CODEBASE_REALITY §13.4); **SoT BLOCKED BY CAPABILITY GAP (partial)** = *2/3 refund paths post no canonical ledger entry (Phase 7 PAY-4)*.

### 7. Inventory

- **Current Sources of Truth:**
  - **A — gateway `/inventory`** (`services/api-gateway/src/index.ts:756`) — canonical commerce backend.
  - **B — MCP** `/stores/[store]/inventory/adjust`, `/inventory/levels` (part of the 62-route second backend).
- **Target Source of Truth:** **A — gateway `/inventory`.** (Spine "Storefront backend"; Phase 2 §3.5 Inventory.)
- **Required Convergence Path:** (1) **commit** (Phase 0). (2) **retarget** each B route to a thin proxy of A, or port it, after a per-page call-graph trace + contract tests. (3) **delete** the MCP inventory writers once no UI page calls them directly.
- **Deletion Candidate:** MCP inventory `/api/route.ts` writers (after call-graph + contract tests).
- **Risk:** **S2** — two writers per domain (drift / double-maintenance), not user-facing money/identity.
- **Blocking Dependencies:** Phase 0 commit; per-page call-graph trace (UNVERIFIED); contract tests per route. Pure convergence (no capability gap).

### 8. Shipping

- **Current Sources of Truth:**
  - **A — gateway `/shipping-tax`** (`index.ts:754`).
  - **B — MCP shipping** under store settings/taxes surface (part of the 62-route second backend).
- **Target Source of Truth:** **A — gateway `/shipping-tax`.** (Spine "Storefront backend"; Phase 2 §3.5 Shipping.)
- **Required Convergence Path:** (1) **commit** (Phase 0). (2) **retarget** B → proxy of A (or port) after call-graph trace. (3) **delete** the MCP shipping writers post-cutover.
- **Deletion Candidate:** MCP shipping `/api/route.ts` writers.
- **Risk:** **S2** — duplicate writer, drift risk.
- **Blocking Dependencies:** Phase 0 commit; per-page call-graph trace (UNVERIFIED). Pure convergence.

### 9. Tax

- **Current Sources of Truth:**
  - **A — gateway `/tax`, `/shipping-tax`** (`index.ts:753–754`).
  - **B — MCP** `/stores/[store]/taxes`, `/taxes/[taxId]` (part of the 62-route second backend).
- **Target Source of Truth:** **A — gateway `/tax`.** (Spine "Storefront backend"; Phase 2 §3.5 Tax.)
- **Required Convergence Path:** (1) **commit** (Phase 0). (2) **retarget** B → proxy/port after call-graph trace + contract tests. (3) **delete** MCP tax writers post-cutover.
- **Deletion Candidate:** MCP tax `/api/route.ts` writers.
- **Risk:** **S2** — duplicate writer, drift risk.
- **Blocking Dependencies:** Phase 0 commit; per-page call-graph trace (UNVERIFIED). Pure convergence.

### 10. Storefront (which backend owns store APIs)

- **Current Sources of Truth:**
  - **A — `services/api-gateway` monolith** — canonical commerce backend (`ARCH-R1`).
  - **B — `apps/merchant-control-plane` Next `/api`** — **62** `route.ts` second writer (verified this phase) across products/orders/inventory/themes/billing/staff.
  - **C — `apps/storefront-runtime` Next `/api`** — **21** routes (verified this phase) third partial surface (`/api/customer/*`, `/api/orders*`, `/api/reviews`, `/api/coupons/validate`, `/api/themes`).
- **Target Source of Truth:** **A — gateway monolith owns commerce; apps do routing/rendering/adapters only (`ARCH-R17`).** (Spine "Storefront backend"; Phase 4 Decision 8, composite 6.7 vs 3.4.)
- **Required Convergence Path:** (1) **commit** (Phase 0). (2) **trace** the per-page call-graph (which UI page calls which of the 62 + 21 routes vs the gateway) — UNVERIFIED, gates everything. (3) **retarget** each B/C route to a thin proxy of A, or port it, with contract tests per route; note `gift-cards` is single-writer but in the *wrong* runtime (no gateway mount) → **port, not proxy**. (4) **delete** the duplicate B/C writers post-cutover.
- **Deletion Candidate:** the 62 MCP `/api/route.ts` + the 21 storefront-runtime `/api/route.ts` duplicate writers (after call-graph + contract tests).
- **Risk:** **S1** — two-writers-per-domain across ~20 commerce domains; ambiguous source-of-truth for every merchant mutation.
- **Blocking Dependencies:** Phase 0 commit; **per-page call-graph trace (UNVERIFIED)** — the single hardest blocker here; contract tests; port (not proxy) for `gift-cards`. Pure convergence once traced.

### 11. Themes (rendering engine)

- **Current Sources of Truth:**
  - **A — React section-registry renderer** — 22 registered keys, **the default for every store** (`renderer-registry.tsx:198–345`); forks schema (`RUNTIME_SECTION_SCHEMAS`, `renderer-registry.tsx:66`) and compose path (`template-resolver.ts`). All realities.
  - **B — Liquid renderer** — server-authoritative, sandboxed; **canary-only**, default OFF (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`, `packages/theme-engine/src/theme-governance.ts:14`, verified); no header/footer, no data binding, `index`-only template, no canary write path, no editor.
- **Target Source of Truth:** **B — Liquid renderer (ratified strategic winner).** (Spine "Themes"; Phase 4 Decision 1, target 4.7 vs React 6.6 — React wins completeness-today 9 vs 2.)
- **Required Convergence Path:** Convergence *cannot* delete the loser here — and that is the point. (1) **commit** (Phase 0) so Liquid's worktree hardening (DOMPurify, auto-escape, parity table, freeze validator) exists. (2) The SoT then **stops at "keep both"**: React is a FROZEN loser, explicitly NOT deletable (`THEME-R1`/Rule C3; `no-new-react-sections-validator.mjs` freezes it). Reaching SoT requires a build, not a delete: Liquid header/footer + section-group routing + commerce data binding + full template set + real cart/customer drops + a canary **write path** + a merchant install/edit surface + per-section parity harness + ARB ratification of the deferred platform-wide flip. (3) **delete** React only after all 8 gate items are true.
- **Deletion Candidate:** none now — React FROZEN and load-bearing for 100% of stores; deleting it blanks every storefront.
- **Risk:** **S2** (S1 *if* React deleted prematurely — every store goes blank).
- **Blocking Dependencies:** Phase 0 commit; **SoT BLOCKED BY CAPABILITY GAP, not convergence** = *Liquid has no header/footer, no data binding, no full template set, no canary write path, no editor (Phase 7 THM-1)*; ARB ratification of the deferred flip. **React parity must be proven before any React deletion.**

### 12. Liquid (the Liquid plan ownership + sanitizer)

- **Current Sources of Truth:**
  - **A — engine bundle source** (`theme-bundle.ts`, 214 section refs) — the intended Liquid authority.
  - **B — storefront `template-resolver.ts`** — currently *owns the Liquid render plan* (hard-codes empty header/footer groups at `template-resolver.ts:213–216`) — i.e. the Liquid plan lives *inside the React-side loser file*.
  - **Sanitizer split:** `main`/HEAD ship a 3-regex sanitizer with no auto-escape (`HEAD:theme-renderer.ts:606–610`); DOMPurify + LiquidJS auto-escape exist **worktree-only**.
- **Target Source of Truth:** **A — the engine owns the Liquid plan/compose/canary resolution; one sandboxed sanitizer (DOMPurify + auto-escape).** (Spine "Themes"; Phase 2 §3.6 compose/schema rows.)
- **Required Convergence Path:** (1) **commit** (Phase 0) so the DOMPurify sanitizer becomes the deployable one (closes XSS on every storefront). (2) **retarget** the Liquid plan/canary resolution out of `template-resolver.ts` into the engine `composeStorefrontTheme` — convergence of *where the plan lives*. (3) **delete** the 3-regex sanitizer once DOMPurify is live. (4) The header/footer-group emptiness is a Liquid *build* (Themes domain), not a convergence step.
- **Deletion Candidate:** the 3-regex sanitizer (`theme-renderer.ts:606–610`) after commit; the in-`template-resolver` Liquid plan after it moves to the engine.
- **Risk:** **S1** — regex sanitizer = XSS exposure on every storefront until committed; plan-in-loser-file blocks the engine from owning compose.
- **Blocking Dependencies:** Phase 0 commit; the engine must absorb plan/canary resolution (retarget, low-risk); Liquid chrome build is a separate capability gap (Themes).

### 13. React (renderer disposition + schema/compose forks)

- **Current Sources of Truth:**
  - **A — React renderer** as the live default (see Themes) + its **schema fork** `RUNTIME_SECTION_SCHEMAS` (`renderer-registry.tsx:66`, merged `:191`: `SECTION_SCHEMAS || RUNTIME_SECTION_SCHEMAS || fallback`) + its **compose fork** `template-resolver.ts`.
  - **B — engine `SECTION_SCHEMAS`/`BUILT_IN_SECTION_SCHEMAS`** (`theme-registry.ts:419`) + engine `composeStorefrontTheme` — the intended single source for schema and compose.
- **Target Source of Truth:** **B — engine is the single schema + compose source; React renderer survives only as the FROZEN compatibility renderer until Liquid parity.** (Spine "Themes"; Phase 2 §3.6 schema/compose rows.)
- **Required Convergence Path:** (1) **commit** (Phase 0). (2) **retarget** the ~10 runtime-only schemas from `RUNTIME_SECTION_SCHEMAS` into the engine `SECTION_SCHEMAS` (collapse the schema fork). (3) **retarget** compose to the engine (collapse the compose fork). (4) **delete** the React renderer itself only on the Themes-domain gate (Liquid parity proven) — *not* here. The schema/compose forks can converge to the engine *independently* of the renderer-deletion gate (they are S3 cleanup that does not blank stores).
- **Deletion Candidate:** `RUNTIME_SECTION_SCHEMAS` re-declaration; the `template-resolver.ts` compose re-impl (after migration into the engine). The renderer itself: deferred to Themes gate.
- **Risk:** **S3** (forks) — duplication/drift in schema and compose; the renderer-deletion risk is tracked under Themes (S1-if-premature).
- **Blocking Dependencies:** Phase 0 commit; editor depends on the merged schema set (migrate, don't break); renderer deletion blocked by **React parity proven** (Themes capability gap).

### 14. Mobile (navigation + tokens + theme editor)

- **Current Sources of Truth:**
  - **Nav:** **A — classic Navigator** `MaterialApp(onGenerateRoute: AppRoutes.generateRoute)` (`app.dart:54`, 87 routes) vs **B — dead GoRouter** `lib/app/deep_link_router.dart` (verified present; never mounted; `go_router ^17.0.0` dep; tests-only consumer).
  - **Dashboard data:** **A — composite BFF** `/v1/mobile/dashboard` (home) vs **B — 5-call gateway fan-out** `AnalyticsService.getStoreAnalytics` (`analytics_service.dart:371`, analytics screen).
  - **Tokens:** **A — `ui_kit` generated tokens** (DTCG, `--check` exit 0) vs **B — app-local token forks** (deleted in worktree).
  - **Widgets:** `widgets/dashboard/*` (used) vs `widgets/home/` same-name twins (dead).
  - **Theme editor:** `ThemeScreen`(631L)+`SectionEditorScreen`(1,200L)+12 editor widgets (DEAD — 0 construction sites) vs read-only `LivePreviewScreen` (what the dashboard actually opens).
- **Target Source of Truth:** **Navigator + composite BFF + `ui_kit` generated tokens + one *reachable* surface per capability.** (Spine "Mobile nav/tokens"; Phase 4 Decision 10a/10b/10c.)
- **Required Convergence Path:** (1) **commit** (Phase 0) so the token-fork deletions + composite BFF + fail-closed signing land. (2) **delete-now** the dead GoRouter `deep_link_router.dart` + `go_router` dep (after retargeting source-string tests `mobile_services_test.dart:3791–3797`). (3) **delete-now** the `widgets/home/` dead twins (flutter analyze/test green). (4) **retarget** the analytics screen onto the composite BFF once it covers that field set, then collapse the 5-call fan-out. (5) **Theme editor: ARB decision** — re-wire the section editor (a navigation fix, give it a construction site/route) OR delete its 1,800 lines; it cannot persist as dead code.
- **Deletion Candidate:** `deep_link_router.dart` + `go_router` dep; `widgets/home/` twins; app-local token forks (already deleted on worktree); the dead theme editor *if not re-wired*.
- **Risk:** **S1** (34/64 screens unreachable incl. theme editor) for reachability; **S3** for the dead-nav/token/widget cleanup.
- **Blocking Dependencies:** Phase 0 commit; confirm no external `/features/*`/deep-link consumers (none in-repo); BFF field-set coverage for the analytics retarget; **ARB pick** on the theme editor; **mobile login Turnstile double-spend is a separate capability gap (Phase 7 MOB-1) that blocks any mobile launch regardless** — see Notifications/identity seam below. Nav/token/widget = quick-win convergence; editor = ARB; login = capability.

### 15. Notifications (channel + alerting)

- **Current Sources of Truth:**
  - **A — Prometheus rules** `prometheus-rules.yaml` (7 alerts on `letbuyy_*`/`http_*` metrics) — **zero code emitters** (grep-verified); 2 alerts owned by empty `services/event-bus`.
  - **B — `otel-collector.yaml`** exports to `*.letbuyy-observability.svc.cluster.local` (deleted k8s).
  - **C — `production-safety-preflight.json:23–26`** names `MONEY_LEDGER_RECONCILIATION_ALERT_READY` as a precondition — a flag name with no backing capability.
  - **No error-tracking SDK in any runtime** (zero sentry/otel/pager dep in any `package.json`/`pubspec.yaml`); **no alert delivery channel** (no PagerDuty/Opsgenie/Slack/webhook).
- **Target Source of Truth:** **one real alert delivery channel fed by emitted metrics + one error-tracking SDK.** (Phase 7 OBS-1/OBS-2.)
- **Required Convergence Path:** Convergence collapses only the *config theater*: (1) **retarget** the observability configs to the real Cloudflare Analytics Engine dataset (`letbuyy-production-telemetry`) **or archive** the Grafana/SLO JSONs pointing at deleted k8s/empty reserved roots. (2) The SoT itself is a build: an alert channel + metric emitters + an error SDK must exist (provisioning the Sentry DSN, `SKIP-W3`, does nothing because no SDK consumes it). (3) **archive** `prometheus-rules.yaml`/`otel-collector.yaml`/Grafana JSONs once retargeted-or-replaced.
- **Deletion Candidate:** the dangling Prometheus rules + otel collector + 6 Grafana dashboard JSONs (archive, after retarget/replace).
- **Risk:** **S0** — a money-reconciliation break, payment failure, or breach produces **no signal**; first notification is a customer report. Launch-blocking for any money platform.
- **Blocking Dependencies:** **SoT BLOCKED BY CAPABILITY GAP, not convergence** = *no alert channel, no metric emitters, no error SDK (Phase 7 OBS-1/OBS-2)*. Sentry DSN seam (`SKIP-W3`, Class B) is moot without the SDK build.

### 16. WhatsApp

- **Current Sources of Truth:**
  - Single notification-channel integration (gated). Live sends are `SKIP-D10`/`SKIP-W7` (sandbox-badged today). No competing second implementation found.
- **Target Source of Truth:** **the single existing WhatsApp channel, live-provisioned.** (Phase 7 §6 de-scope: sandbox-badged sends acceptable for beta.)
- **Required Convergence Path:** No convergence needed — there is one source, not N. (1) **provision** live credentials (`SKIP-D10`/`SKIP-W7`) when promoting beyond sandbox. No delete/retarget.
- **Deletion Candidate:** none.
- **Risk:** **S3** — feature/channel, not a launch blocker; explicitly de-scoped (Phase 7 §6).
- **Blocking Dependencies:** `SKIP-D10`/`SKIP-W7` live creds (Class B) for non-sandbox sends. Not a SoT conflict.

### 17. Email

- **Current Sources of Truth:**
  - Transactional email is sent through the same notification surface; provider secrets are placeholders in prod wrangler (`SKIP-PROVIDER-SECRETS`, `wrangler.toml:255–267`). No competing duplicate sender found in the canonical runtimes (the legacy/notification-service root is a reserved manifest-only placeholder per `CLAUDE.md`).
- **Target Source of Truth:** **the single existing transactional email path, provider-provisioned.** (No spine conflict; Phase 7 `SKIP-PROVIDER-SECRETS`.)
- **Required Convergence Path:** No convergence needed (one source). (1) **provision** provider secrets (`SKIP-PROVIDER-SECRETS`, Class B). If a `services/notification-service` reserved root is ever activated, it must NOT become a second sender (reserved-seam rule).
- **Deletion Candidate:** none in the active runtimes.
- **Risk:** **S2** — provider placeholders mean live email is unconfigured, but no duplicate-authority conflict.
- **Blocking Dependencies:** `SKIP-PROVIDER-SECRETS` (Class B). Not a SoT conflict; guard against reserved-root reactivation as a second sender.

### 18. Governance (the law)

- **Current Sources of Truth:**
  - **A — `LETBUYY_CONSTITUTION.md` "RATIFIED. SUPREME." + root `AGENTS.md` (promoted AGENTS_V2) + Canonical Systems** (worktree).
  - **B — scan-generated root `AGENTS.md`** (`<!-- GENERATED BY … 2026-06-08 -->`, HEAD/`main`) + **79 nested scan `AGENTS.md`** (verified this phase; **[SEED-CONFLICT, magnitude]** — seed/Phase 2 said 38) — each a *ranked local authority* by `CLAUDE.md:3` precedence; anti-scan validators read **only root** (`no-scan-generated-agents-validator.mjs:7`), so all nested copies are unpoliced.
  - **C — `docs/agents/AGENTS.md` "central constitution"** + 21 rule files + 19 subagents (facts frozen 2026-05-24, dead topology).
  - **Ratification:** A self-declares "RATIFIED" while `SKIPPED_HUMAN_DECISIONS.md:5` (`SKIP-GATE1-ARB-RATIFICATION`) shows it is mechanical-complete but **human-unsigned**.
- **Target Source of Truth:** **A — Constitution stack → root AGENTS_V2 → Canonical Systems.** (Spine "Governance"; Phase 4 Decision 5, composite 6.4 vs 3.0.)
- **Required Convergence Path:** (1) **commit** the constitutional stack (Phase 0), avoiding the commit trap (60 tracked root docs are staged-deleted while archive copies are untracked — a tracked-only `git commit -am` orphans the archive). (2) **ratify** GATE-1 (human ARB signature). (3) **retarget** the anti-scan validator below root to police the 79 nested files; **delete-now** the 79 nested scan `AGENTS.md` and the scan-generated root copy once A is committed (B is committed law at HEAD — must not be deleted before A replaces it). (4) **archive** `docs/agents/` (zero live refs, but a ranked local authority by filename). (5) **fix** A's status line ("RATIFIED" → pending until signed) per `DOC-R3`.
- **Deletion Candidate:** the 79 nested scan `AGENTS.md` + the scan-generated root `AGENTS.md` (after A is committed); `docs/agents/` (archive).
- **Risk:** **S1** — the law governing everything is uncommitted/unratified; nested copies re-teach drift.
- **Blocking Dependencies:** **Phase 0 commit (avoid commit trap)** + **ARB GATE-1 ratification** (Class B). Quick-win convergence once committed; the nested-file deletion needs the validator retargeted below root first.

### 19. Database (access plane / ownership)

- **Current Sources of Truth:**
  - **A — `withTenantTx` GUC plane:** `SET LOCAL ROLE app_tenant` + `app.site_id` GUC + FORCE RLS (**untracked** mig `164`).
  - **B — guarded service-role:** **664** `getSupabaseAdmin()` sites behind the pattern-based Proxy guard (verified this phase; **[SEED-CONFLICT, magnitude]** — Phase 2 said 917; this phase's grep of `services apps packages` minus the definition = 664).
  - **C — raw-REST bypass:** `packages/infrastructure/supabase-adapter/index.ts:65–150` `supabaseServiceHeaders`/`select`/`patchSupabaseRows` — direct `fetch` with service-role, **no Proxy** + anon clients + fail-open queue envelope.
  - **Residual:** 25 PUBLIC `USING(true)`/`WITH CHECK(true)` policies survive the final state outside the validator allowlist (incl. `service_role_*`-named-but-PUBLIC on gift_cards/pages/collections/…).
- **Target Source of Truth:** **A — RLS+FORCE+GUC as the load-bearing isolation layer; B demoted to audited `withServiceRole(reason,fn)` break-glass; C eliminated.** (Spine "Tenancy"; Phase 4 Decision 4, composite 6.3 vs 3.9.)
- **Required Convergence Path:** (1) **commit** migrations 163 (close PUBLIC `USING(true)` on 11 sensitive tables) + 164 (`app_tenant` FORCE) (Phase 0) — on `main` these don't exist, so the anon-leak class is live. (2) **retarget** routes to `withTenantTx`; prove per-route adoption with the RT-1…9 suite. (3) **delete-now the raw-REST bypass callers** (C) or give them tenant-guard parity — they actively bypass A/B. (4) **retarget** the 25 surviving permissive policies closed; **retarget** the queue tenant envelope to fail-closed. (5) B (664 sites) stays as guarded compat until per-route adoption is proven, then demoted to break-glass.
- **Deletion Candidate:** the raw-REST bypass callers (`supabase-adapter` helpers' unguarded consumers); the 25 permissive policies (closed via 163 + follow-up).
- **Risk:** **S1** — cross-tenant leakage risk; on `main` the anon-leak class (orders/wishlists/subscriptions readable by any anon-key holder) is **live** until 163/164 commit.
- **Blocking Dependencies:** Phase 0 commit (163/164); per-route `withTenantTx` adoption proof (RT-1…9); live `pg_policies`/grants check for the 25 policies (`SKIP-D2`/`SKIP-D4`, Class B, UNVERIFIED). The commit half is a quick-win; the raw-REST/25-policy closure is partial-capability (some policies need new shapes).

### 20. Validators (governance gate)

- **Current Sources of Truth:**
  - **A — honest lane names + the worktree 90-gate** (133 files + 23 new Phase validators).
  - **B — HEAD 187-file / 181-gate** with theater (CRDT/replay/failover) + **6 lane aliases → 1 validator** (`validate:distributed-execution/durable-execution/distributed-survivability/operational-certification/replay` → `no-scan-generated-agents-validator.mjs`) + `validate:migrations`≡`validate:rollback` → `migration-safety-validator.mjs` + **5 duplicated assertions** in `whole-repo-end-state-validator.mjs`.
  - **C — 11 true orphans + 10 zero-reference validators** (`custom-domain-reconciler`, `mobile-domain-parity`, `shopper-identity-seam`, `vercel-domain-automation`, …).
  - **The self-block:** `whole-repo-end-state-validator.mjs:172–186` requires `globalRegions ⊇ [india,apac,eu,us]` + wires `validate:survivability` into 3 workflows; `survivability-governance-validator.mjs:106` requires `globalRegions.length >= 4` — both contradict `LETBUYY_CONSTITUTION.md:98,108,112` (verified this phase).
- **Target Source of Truth:** **A — honest lane names + 90-gate; EXCEPT the multi-region pair, which neither validator should assert (Constitution wins, one region).** (Spine "Deployment topology" + Phase 2 §3.11 validator rows; Phase 4 Decision 9.)
- **Required Convergence Path:** (1) **commit** the 90-gate consolidation (Phase 0) so HEAD's 181-gate stops being CI. (2) **delete-now the 6 lane aliases** but **retarget `architecture-governance.yml`/`production-rollout.yml`/`live-production-certification.yml` workflows in the SAME change** (`DEL-R3`); author the real rollback validator first. (3) **delete-now the 5 duplicated assertions** in `whole-repo-end-state-validator.mjs` EXCEPT the region pair. (4) **delete** the 11 orphan / 10 zero-reference validators after confirming no out-of-band invocation. (5) **The multi-region self-block is ARB-gated:** repeal the survivability contract, then in one paired change **retarget** both validators + `production-topology.json` `globalRegions` + the 3 workflows; only then is it removable — deleting first **fails CI**.
- **Deletion Candidate:** the 6 lane aliases (paired retarget); the 5 duplicated assertions (non-region); the 21 orphan/zero-ref validators; the HEAD 181-gate; the 4-region assertions + `validate:survivability` wiring (ARB-gated).
- **Risk:** **S0** (the region self-block — law mandates its own loser, gate fails on removal); **S2** (alias/orphan/duplicate-assertion theater — green asserts uncovered coverage).
- **Blocking Dependencies:** Phase 0 commit (alias/orphan/duplicate cleanup = quick-win, but paired-retarget required); **ARB repeal of the survivability/multi-region contract** for the region pair (Class B governance decision). Mixed: quick-win + ARB-gated.

### 21. Infrastructure (topology / distributed contract layer)

- **Current Sources of Truth:**
  - **A — one-region monolith canon** (`LETBUYY_CONSTITUTION.md:98,108,112`) — `.com`, monolith + 4 satellites + reserved manifest-only seams.
  - **B — multi-region/distributed contract layer:** `config/runtime/multi-region-runtime.json` (4 regions + failoverPairs) + `survivability-execution.json` + `distributed-consistency-contract.json` + `chaos/` + `load/` + ≥10 distributed `docs/governance/*.md`; **machine-mandated** by the two survivability validators (the GATE-1 self-block).
  - **C — reserved-fleet blueprints** (`docs/audit/13-final-architecture-blueprint.md`, `docs/commerce-os-audit/…`, `docs/Codex_waves/…`) activating 6 reserved services + a Wasm extension runtime.
- **Target Source of Truth:** **A — one-region monolith + empty reserved seams.** (Spine "Deployment topology"; Phase 4 Decision 9, composite 7.1 vs 2.6 — the widest topology gap.)
- **Required Convergence Path:** Convergence cannot start without an ARB repeal (B is machine-mandated). (1) **ARB decision** to repeal the survivability contract (no `SKIP` row covers keeping it). (2) **retarget**, in one paired change, the two validators + `production-topology.json` `globalRegions` block + the 3 workflows (see Validators) — removing the artifacts first **fails CI**. (3) **delete** `config/runtime/multi-region-runtime.json` + `survivability-execution.json` + `distributed-consistency-contract.json` + `chaos/` + `load/` after the validators no longer require them. (4) **archive** the ≥10 distributed governance docs (B) and the reserved-fleet blueprints (C) — pure doc moves (`DOC-R4`), but the machine-enforced subset waits on step 2. (5) reserved roots stay manifest-only (NOT activated).
- **Deletion Candidate:** the multi-region/distributed config JSONs + `chaos/`/`load/` (after validator retarget); archive the distributed docs + reserved-fleet blueprints.
- **Risk:** **S0** — the new gate mandates the architecture its own supreme law voids; committing the working tree *without* fixing this makes the contradiction gate-enforced.
- **Blocking Dependencies:** **ARB repeal of the survivability/multi-region contract** (Class B, the gating decision); paired validator+topology+workflow retarget; then doc archives. Fully ARB-gated; not achievable by Phase 0 commit alone (commit *worsens* it).

---

## Convergence Dependency Map (quick-wins vs ARB-gated vs capability-gated)

The 21 domains sort into three buckets by *what unblocks the convergence path*. This is the rollup that feeds the Phase 9 roadmap. Several domains appear in two buckets because their convergence has a committable half and a gated half — those are noted.

### Bucket 1 — UNBLOCKED BY PHASE 0 COMMIT ALONE (quick-wins)
*The winner is correct and complete; committing the working tree (+ fast-forward `main`, + the anti-scan validator retarget below root) makes the winner live and the loser dead code to delete. No human governance decision, no engineering build.*

- **Governance** — commit the Constitution stack + ratify; delete the 79 nested + scan-generated root `AGENTS.md` (after the below-root validator retarget); archive `docs/agents/`. *(Caveat: needs the ARB ratification signature to be law, but the convergence delete is commit-gated.)*
- **Validators (cleanup half)** — delete the 6 lane aliases (paired workflow retarget), the 5 non-region duplicated assertions, the 21 orphan/zero-ref validators, the HEAD 181-gate.
- **Mobile (nav/token/widget half)** — delete the dead GoRouter + `go_router` dep, the `widgets/home/` twins, the app-local token forks; retarget analytics onto the composite BFF.
- **Database (commit half)** — commit 163/164 to kill the live anon-leak class; the per-route adoption proof follows.
- **Commission / Money-policy (commit half — folds into Ledger/Settlement)** — commit mig 162 + the zero-bps validator to end the 3% rake default on every committed ref.
- **Branch reality (the master quick-win)** — Phase 0 `git add -A` + commit + ratify + fast-forward `main` (lag→0) is *itself* the quick-win that flips PR for nearly every other domain. **Must avoid the tracked-deletion/untracked-archive commit trap; must never be "resolved" by `git checkout .`/`git clean -fd` (that destroys the winner).**

**Count: ~6 domains** (Governance, Validators-cleanup, Mobile-nav, Database-commit, Commission-commit, Branch-reality) — plus the *committable halves* of Themes/Liquid (DOMPurify sanitizer), Checkout (mig 166), Orders (commit), and the 4 commerce-split domains' commit step.

### Bucket 2 — NEED AN ARB DECISION (governance / topology / loser-protection)
*A human ARB ruling must land before any delete can proceed; committing alone does not unblock (and for the multi-region case, commit *worsens* it).*

- **Infrastructure** — ARB must repeal the survivability/multi-region contract before the config JSONs + chaos/load can be deleted; paired validator+topology+workflow retarget; then doc archives.
- **Validators (multi-region pair)** — same ARB repeal gates deletion of the 4-region assertions + `validate:survivability` wiring; removing first fails CI.
- **Themes / React deletion** — React is FROZEN by ratified validator (`no-new-react-sections-validator.mjs`); ARB must ratify the deferred platform-wide Liquid flip before React can be deleted — AND Liquid parity must be built first (also capability-gated). Deleting React prematurely blanks every store.
- **Settlement (writer survival)** — ARB picks which `merchant_payable` writer survives per flow and whether the scheduled `payouts` instruction model is executed or deleted.
- **Mobile theme editor** — ARB picks re-wire vs delete for the 1,800-line dead section editor.
- **Storefront/Orders/Inventory/Shipping/Tax (cutover sequencing)** — not strictly ARB, but gated on the **per-page call-graph trace** (UNVERIFIED) before any MCP/storefront-runtime route can be deleted; listed here as the non-commit, non-engineering gate.

**Count: ~3 core ARB-gated domains** (Infrastructure, Validators-region, Themes-React) + the writer/editor/cutover sub-decisions.

### Bucket 3 — NEED GENUINE ENGINEERING (capability gaps — SoT NOT achievable by convergence)
*The canonical owner is named but posts/pays/clears/verifies nothing in any reality. No commit and no secret closes these. The convergence path collapses the duplicate writers around them, then stops; the SoT stays BLOCKED until the build ships. These are the Phase-9 long pole.*

- **Payments (capture)** — **GAP: storefront/webhook confirm writes 0 canonical ledger entries.** The #1 unfinished winner (Phase 7 PAY-1).
- **Settlement / Payout-rail** — **GAP: no payout provider client (`initiateTransfer` throws `PayoutProviderUnavailable`, `payouts.ts:546`).** Merchants can never be paid (Phase 7 PAY-2). Plus no cross-source dedup.
- **Ledger (reconciliation)** — **GAP: reconciliation refreshers have 0 runtime callers → wallet 409s forever** (`wallet.ts:172`); no in-product operator action to clear it (Phase 7 PAY-3).
- **Identity (step-up)** — **GAP: step-up is a self-served mock token (≥12-char) certified by a validator; guards refund/payout/DSR-erase** (Phase 7 ID-3). No real TOTP/passkey/re-auth in any branch.
- **Notifications (alerting)** — **GAP: no alert channel, no metric emitters, no error SDK** (Phase 7 OBS-1/OBS-2). A money-break produces no signal.
- **Themes (Liquid chrome)** — **GAP: Liquid has no header/footer, no data binding, no full template set, no canary write path, no editor** (Phase 7 THM-1). The ratified winner cannot run a real store.
- **Mobile (login)** — **GAP: Turnstile token double-spent (BFF consumes → identity re-verifies → `timeout-or-duplicate`)** (Phase 7 MOB-1). Blocks any mobile launch regardless of the nav cleanup.
- **Orders (refunds, partial)** — **GAP: 2/3 refund paths post no canonical ledger entry** (Phase 7 PAY-4).

**Count: 4 hard capability-gated domains** (Payments-capture, Payout-rail, Ledger-reconciliation, Identity-step-up) **+ Notifications-alerting** as a 5th launch-blocker, **+ 3 partials** (Themes-Liquid-chrome, Mobile-login, Orders-refunds). These survive any commit/merge; the roadmap must carry them as builds.

**The shape of the rollup:** Phase 0 commit is the master quick-win that flips ~6 domains and the committable halves of most others overnight. ~3 domains then wait on an ARB ruling (the multi-region repeal is the keystone — it gates Infrastructure *and* the Validators region pair *and* is worsened by commit). And ~4–5 domains cannot reach SoT by convergence at all — they need genuine money/identity/operability engineering. **A convergence sweep that deletes losers without the ARB repeal fails CI; a sweep that deletes losers without the engineering leaves a platform that cannot ledger a sale, pay a merchant, show a wallet, enforce step-up, alert on a break, render a Liquid store, or log into mobile.**

---

## SoT Convergence Summary Table

Blocker class: **CMT** = unblocked by Phase 0 commit alone · **ARB** = needs an ARB governance/topology decision · **CAP** = capability gap (SoT not achievable by convergence) · **TRACE** = gated on the UNVERIFIED per-page call-graph · combinations noted.

| # | Domain | #Current sources | Target SoT (single owner) | Blocker class | Risk |
|---|---|---|---|---|---|
| 1 | Identity | 4 (A asym issuer / B gateway mint / C shadow stack / D HS256) | identity-platform asymmetric sole issuer | CMT + CAP (per-realm re-home) + B (live keys) | S0 |
| 2 | Payments (capture) | 2 (A ledgered V1 / B no-ledger confirm) | ledgered capture poster | **CAP** (storefront confirm posts 0 ledger) | S0 |
| 3 | Ledger | 3 (A canonical / B mutable wallet / C mini-ledgers) | canonical append-only ledger | CMT (160/162/165) + **CAP** (0 reconciliation callers) | S1 |
| 4 | Settlement | 3+1 writers, 2 payout models | single-writer module + statements model | ARB (writer pick) + **CAP** (no dedup/executor) | S1 |
| 5 | Checkout | 2 (A monolith origin / B reserved runtime) | monolith-hosted origin | CMT (166) + B (SKIP-D6); inherits CAP from #2 | S1 |
| 6 | Orders | 2 backends, 3 refund writers | gateway routes + one ledgered refund | TRACE + **CAP** (2/3 refunds un-ledgered) | S1 |
| 7 | Inventory | 2 (gateway / MCP) | gateway `/inventory` | TRACE (call-graph + contract tests) | S2 |
| 8 | Shipping | 2 (gateway / MCP) | gateway `/shipping-tax` | TRACE | S2 |
| 9 | Tax | 2 (gateway / MCP) | gateway `/tax` | TRACE | S2 |
| 10 | Storefront | 3 (gateway / MCP-62 / storefront-21) | gateway monolith | TRACE (the hardest) | S1 |
| 11 | Themes | 2 (A React default / B Liquid canary) | Liquid renderer | ARB (flip) + **CAP** (Liquid chrome) | S2 (S1 if React deleted early) |
| 12 | Liquid | 2 plan owners + sanitizer split | engine owns plan + DOMPurify sanitizer | CMT (sanitizer/plan move) + CAP (chrome) | S1 |
| 13 | React | renderer + schema fork + compose fork | engine = single schema/compose; React frozen | CMT (fork collapse) + ARB/CAP (renderer delete) | S3 (forks) |
| 14 | Mobile | nav×2, dashboard×2, tokens×2, widgets×2, editor×2 | Navigator + composite BFF + ui_kit tokens | CMT (nav/token) + ARB (editor) + **CAP** (login) | S1 / S3 |
| 15 | Notifications | 3 dead config surfaces, 0 channel | one real alert channel + emitters + SDK | **CAP** (no channel/emitters/SDK) | S0 |
| 16 | WhatsApp | 1 (single channel) | the single channel, live | B (SKIP-D10/W7) — no SoT conflict | S3 |
| 17 | Email | 1 (single path) | the single path, provider-provisioned | B (SKIP-PROVIDER-SECRETS) — no SoT conflict | S2 |
| 18 | Governance | 3 (A Constitution / B scan-79 / C docs-agents) | Constitution stack → AGENTS_V2 | **CMT** + B (ARB ratify signature) | S1 |
| 19 | Database | 3 (A GUC / B 664 admin / C raw-REST) + 25 policies | RLS+FORCE+GUC (`withTenantTx`) | CMT (163/164) + CAP (raw-REST/25 policies) | S1 |
| 20 | Validators | A 90-gate / B 181-gate+aliases / C orphans + region pair | honest 90-gate; no region assertion | **CMT** (cleanup) + **ARB** (region pair) | S0 (region) / S2 |
| 21 | Infrastructure | 3 (A monolith / B multi-region contract / C reserved-fleet) | one-region monolith | **ARB** (repeal — commit worsens it) | S0 |

**Tally:** **Pure/primary CMT (commit-unblocked) ≈ 6** (Governance, Validators-cleanup, Mobile-nav, Database-commit, Commission/Ledger-commit, Branch-reality) + committable halves of 6 more. **Primary ARB-gated ≈ 3** (Infrastructure, Validators-region, Themes-React) + writer/editor sub-decisions. **Primary CAP-gated (SoT NOT reachable by convergence) = 4 hard** (Payments-capture, Payout-rail, Ledger-reconciliation, Identity-step-up) **+ Notifications** **+ 3 partials** (Themes-Liquid-chrome, Mobile-login, Orders-refunds). **TRACE-gated (call-graph) = 5** (Storefront + Inventory/Shipping/Tax/Orders-routing). **No-conflict (single source, provision only) = 2** (WhatsApp, Email).

---

## Unknowns / Unverified

1. **Live deployed reality for every temporal claim** — which of `main`/HEAD/worktree actually serves production (Vercel projects, workers, applied migrations, out-of-band hotfixes). Repo-only; CI deploys from `main`; `production-topology.json` self-labels `governance-contract-not-live-evidence`. Every "Target SoT lives on worktree" carries this caveat.
2. **Per-page call-graph (the TRACE gate)** — which surface (gateway vs MCP-62 vs storefront-runtime-21) each merchant/storefront UI page actually calls. Winner stands on canon; **removability of every MCP/storefront-runtime route is unverifiable until this trace exists** (CODEBASE_REALITY §13.4). Blocks Storefront/Orders/Inventory/Shipping/Tax deletions.
3. **`getSupabaseAdmin` count divergence** — this phase grepped **664** (`services apps packages` minus the definition); Phase 2 reported 917. Whether the delta is scope (this phase's grep set) or net-new bypass is untraced. Count only; the winner (RLS+GUC) is unchanged. **[SEED-CONFLICT, magnitude]**
4. **Nested `AGENTS.md` count divergence** — this phase found **79** non-root `AGENTS.md`; seed/Phase 2 said 38. The convergence delete-set for Governance is larger than the seed implied. **[SEED-CONFLICT, magnitude]**
5. **ARB intent on multi-region** — whether keeping the survivability contract was directed or program improvisation is UNVERIFIED; no `SKIP` row covers the decision (only the act). Infrastructure SoT cannot start without this ruling.
6. **Migration 162 in-place history rewrite** — whether the ARB accepts an un-ledgered backfill of past commission rows or requires a ledgered correction is an open human decision that gates the clean Commission convergence (`DATABASE_TRUTH §7.1`).
7. **Live `pg_policies`/grants for the 25 residual permissive policies** — runtime anon-reachability of the `service_role_*`-named-but-PUBLIC policies depends on table-level GRANTs not visible statically (`SKIP-D2`/`SKIP-D4`). The policy *shape* is verified; live exposure is not. Gates the Database raw-REST/policy closure.
8. **Newest-copy direction for diverged prompt twins** (`docs/apps-marketplace-audit/*` vs `docs/archive/prompts/*`) — divergence confirmed by prior `diff -q`; recency not established. Gates the Prompts archive reconciliation (folded into Governance/Infrastructure doc moves).
9. **Out-of-band consumers** of the 21 orphan/zero-ref validators and the dead `/features/*` mobile routes (ops scripts, support tooling) — none found in-repo; external use unknowable here. Gates the final validator/mobile deletes.
10. **`_GOVERNANCE_SPINE.md`** — cited 26× by canon docs yet exists nowhere; the winner-registry's own anchor is a missing reality (authored-and-lost vs never-written undetermined). Affects whether Governance convergence has a dangling-citation cleanup step.
11. **Whether the storefront capture / payout / step-up / alerting gaps were closed out-of-band in production** — the capability-gap calls are code-derived from all three repo realities; live behavior UNVERIFIED. If any shipped out-of-band, the corresponding CAP tag would soften — but no repo evidence supports that.

---

*End of SINGLE_SOURCE_OF_TRUTH_PLAN (Phase 3). DISCOVERY / PLANNING ONLY — the single file written is this report. Every Target SoT binds to `_PREMISES_SEED.md` and matches the Phase-4 scored winner with zero overturns. No deletion, archive, commit, retarget, or code change was executed; every convergence path is a plan. Capability gaps are named explicitly and not represented as fixable by a delete. [SEED-CONFLICT, magnitude] flags mark where this phase's counts (664 admin sites, 79 nested AGENTS.md) diverge from the seed; the winner spine is unchanged. Live deployed state is UNVERIFIED throughout.*
