# STRATEGIC WINNERS — FINAL (Convergence Cleanup Program, Phase 2)

> **Document type:** Definitive Winner/Loser registry for every duplicated domain, re-derived FRESH from canon + code.
> **Phase:** 2 — Strategic Winners Final (DISCOVERY/DECISION ONLY; no implementation, no code changes, no commits, no deletions, read-only git).
> **Date:** 2026-06-10 · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store`
> **Baseline (re-verified this run):** branch `stepup/main` · HEAD `5cf9e64e` · **+30 over `main`** (`git rev-list --count main..HEAD = 30`) · working tree **512 D / 410 M / 78 ??** (`git status --porcelain | wc -l = 1000`).
> **Authority for winner selection (the ratified canon, in order):** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (DOC 01) → root `AGENTS.md` (= promoted `LETBUYY_AGENTS_V2`, DOC 02) → `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03). V1/Freeze content is absorbed into DOC 01 (P.2) and preserved in `docs/archive/root-governance-2026-06-10/`.
> **Method:** every winner call is re-derived from a quoted canon line AND a quoted code reality independently re-verified at `path:line` this run. Prior reports (`REPOSITORY_TRUTH_AUDIT_2026_06_10/`, `CONVERGENCE_AUDIT_2026_06_10/STRATEGIC_WINNER_DECISIONS.md`) were consulted for completeness only; nothing is asserted on their say-so without fresh code confirmation.

---

## Executive Summary

**Overturn count vs prior audits: 0 of 14.** Every canon winner survives a fresh, independent, code-grounded re-derivation. The prior convergence audit found zero overturns; I tested that conclusion against live code rather than assuming it, and it holds. Not one winner/loser direction flips when the actual `path:line` evidence is re-read. The winners are **decided conflicts whose losers are still alive** — alive because the winning code is overwhelmingly **uncommitted (plane C, the working tree)** while the deploy branch `main` ships the losers.

The single structural fact that governs this entire registry is **temporal triplication**: three realities per domain.
- **Plane A = `main`** — the *only* branch CI deploys (`production-deploy.yml:5-6` triggers on `main`), 30 commits behind, max migration **158**, ships every loser (account-takeover, 3% rake, anon leaks, mutable money, regex sanitizer).
- **Plane B = HEAD `stepup/main`** — +30, max *tracked* migration **161**; the canonical ledger kernel (mig 139/160) and most winners exist here as committed code.
- **Plane C = working tree** — adds untracked migrations **162–166** (`162_phase_a_commission_zero`, `163_d2_live_data_leak_rls`, `164_d4_tenant_role_guc`, `165_d5_canonical_money_paths`, `166_d6_checkout_handoff_inventory`), the asymmetric identity issuer, RLS+GUC enforcement, DOMPurify, **and the 512 staged deletions** that remove the DEAD CQRS package cluster. The hardened end-state lives here with **zero git history** (all `??`/`D`).

Two findings sharpen the prior picture (neither is an overturn; both are reality-plane mechanics confirmed by git this run):

1. **The DEAD rejected-architecture packages are already deleted — but only in the uncommitted tree.** `packages/app-engine`, `packages/distributed-runtime`, `packages/projection-runtime`, `packages/runtime-composition`, `packages/orchestration`, `packages/extension-host` and their `docs/governance/*-governance.md` exist tracked on **both main and HEAD**, and are **`D` (staged-deleted) in the worktree**. They make up a large share of the "512 D." The convergence is *drafted in the tree*, not committed.

2. **The multi-region/survivability self-block is REAL and partly already-committed.** `scripts/validators/survivability-governance-validator.mjs` (tracked, **on main**) asserts `multi-region-runtime.json` must contain regions `india/apac/eu/us` (`:94`), failover pairs with replay+RTO/RPO (`:98-102`), and `production-topology.json.regions.globalRegions.length >= 4` (`:106`). The companion `scripts/validators/whole-repo-end-state-validator.mjs` (**untracked, plane C only, absent on main**) re-asserts the same 4 regions (`:172-176`) and wires `validate:survivability` into 3 workflows (`:178-194`). **Committing plane C therefore ARMS a whole-repo gate that requires the very multi-region topology the Constitution forbids** (DOC 01 §6; AGENTS `ENV-R2`/`ARCH-R8`/`NEVER-R1`). The survivability-unhook must precede or accompany the Phase-0 commit, or the commit fails CI against itself.

**Four losers need genuine capability work before removal** (a `git add` does not resolve them): (1) the **React renderer** — Liquid has no header/footer and binds nothing; (2) the **storefront un-ledgered capture** (`confirm_order_payment_with_ledger`) — the every-shopper path posts **zero** canonical ledger lines and the ledgered path is wired to nothing the buyer touches; (3) the **payout rail** — `initiateTransfer` unconditionally throws, no provider client exists in any plane; (4) the **mutable wallet/recon model** — the reconciliation refreshers that would let the ledger feed the wallet have zero runtime callers, so the wallet read fails closed forever. The remaining ten losers are governance/commit/version-control gaps that fall once plane C is committed, ratified, and deployed — in dependency order, behind the deploy meta-blocker and the survivability-unhook.

---

## Method

For each of the 14 domains: a Winner/Loser table, a **Reason** that quotes the governing **canon** line and the **code** reality (re-verified `path:line` this run), a **Risk** class (S0–S3), a **Migration Complexity** rating with justification, the **Reality plane** each side lives on (which branch), the **Removal-blocking condition**, and an explicit **Overturn Test** (did fresh evidence confirm or challenge the canon winner?).

**Risk classes:** S0 = live security/money-integrity defect shipping now · S1 = correctness/compliance gap that blocks real money or violates canon load-bearing rule · S2 = drift / maintenance-tax / honesty defect · S3 = cosmetic / dead-weight.
**Migration complexity:** Trivial (doc/archive move or zero-importer delete) · Low (commit + retarget a validator) · Med (wire a winner that exists but is unfed, or cutover with contract tests) · High (genuine capability must be built before the loser can go).
**Reality planes:** A = `main` (deploy, condemned) · B = HEAD `stepup/main` (+30) · C = working tree (uncommitted end-state).

---

## Decision 1 — React Renderer vs Liquid Renderer (theme runtime)

| | Winner | Loser |
|---|---|---|
| System | **Liquid / portable-theme (OS-2.0-shaped) renderer** | React section-registry renderer |
| Class | CANONICAL (build/flip) | **FROZEN — explicitly NOT deletable now** |

**Reason.**
- *Canon:* DOC 03 §3.5 / Rule C2: "**Liquid renderer wins over React** … because only Liquid supports a theme marketplace, 3rd-party authors, and portable themes." `THEME-R1`: "The React section-registry renderer is the live read path, kept as a **first-party compatibility fast-path, FROZEN**, and delete-or-frozen by **data at Wave 6** — **NOT deleted now for completeness.**"
- *Code:* `packages/theme-engine/src/theme-governance.ts:14` `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`; `:16-21` `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = { status: 'deferred', authority: 'ARB' }`; `:15` parity required = **20** sections; the parity table `:23-44` lists exactly 20 React→Liquid mappings and **contains no header/footer entry** (no `header`, no `footer`, no section-group chrome). Liquid is flag-off, the flip is ARB-deferred, and the chrome that every storefront needs has no Liquid map.

**Risk:** S2 (the loser is a maintenance-tax fork — duplicate schema source + compose fork — not a live breach; deleting it early would be S0-grade self-harm, which is exactly why canon freezes it).
**Migration Complexity:** **High.** Liquid must gain header/footer + section-group routing, real commerce data-binding (not hard-coded strings), a full template set (product/collection/cart/page, not `index`-only), real cart/customer drops, a canary write path, a merchant install/edit surface, and a per-section parity harness — none of which exist. This is a build, not a cutover.
**Reality plane:** React renders on A/B/C (runtime default everywhere — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`). The Liquid hardening (DOMPurify, the 20-section parity table, the freeze flag) is `M` on plane C; A/B ship the older governance file.
**Removal-blocking condition:** the full 8-part parity gate (Liquid header/footer + section routing + commerce binding + full templates + real cart/customer drops + canary write path + merchant edit/preview surface + ARB ratification of the deferred platform-wide flip) plus the Security/SSTI suite green (`THEME-R6`). Until then `THEME-R2` (CI ban on new React sections) freezes the fork and React **must stay**.

**Overturn Test — CONFIRMED.** Fresh code re-reads the exact flag (`false`), the exact deferred status, and the 20-section parity table with no chrome. Liquid wins on architecture/ecosystem-fit per C2; React is correctly the FROZEN non-deletable loser per C3. No challenge.

---

## Decision 2 — Legacy Gateway Sessions (randomHex + AUTH_SECRET HS256) vs Identity-Platform Asymmetric Sole Issuer

| | Winner | Loser |
|---|---|---|
| System | **`apps/identity-platform` = sole asymmetric token issuer (all 3 realms)** | Gateway randomHex mint + shared `AUTH_SECRET` HS256 family |
| Class | CANONICAL | LEGACY/DEAD (collapse to verify-only) |

**Reason.**
- *Canon:* DOC 03 #3 + Rule C2: "**identity-platform wins over gateway `routes/auth.ts`** … because one asymmetric issuer is the only design that unblocks OIDC and stops shared-secret forgery." `IDN-R2`: "Tokens are asymmetric, single-signer (EdDSA/Ed25519; ES256 fallback) … MUST NOT sign with a shared symmetric secret." `SEC-R7`: the shared-`AUTH_SECRET` HS256 "where the verification key *is* the forgery key across seven domains is DEAD."
- *Code:* `AUTH_SECRET` is still imported by **10** runtime files (`grep -rln AUTH_SECRET services apps packages`): `services/webhook-service/src/index.ts`, `services/api-gateway/src/index.ts` + `routes/{checkout,internal-console,export,media}.ts` + `routes/storefront/cart-routes.ts`, `apps/platform-console/src/lib/console-session.ts`, `apps/identity-platform/src/lib/auth/cookies.ts`, and the gateway `identity-foundation/mock-key-service.ts`. The asymmetric winner's files — `apps/identity-platform/src/lib/auth/identity-issued-session.ts` and `services/api-gateway/src/lib/identity-session-verifier.ts` — are **`??` untracked** and **absent on main** (`git cat-file -e main:…/identity-issued-session.ts` → ABSENT). The shared-secret forgery monoculture is the committed reality; the asymmetric issuer is plane-C-only.

**Risk:** S0 (the loser plane ships the `/api/auth/switch` account-takeover live on `main` — see Decision below; a shared symmetric secret across identity + money-signing + webhook dispatch is a live forgery surface).
**Migration Complexity:** **Med→High.** Merchant-session asymmetric verification exists on C, but shopper/console/app-OAuth/magic-link and the PII-bearing `lb_accounts` cookie still ride HS256; each needs an asymmetric or dedicated-secret replacement, then a dual-verify drain proving zero legacy-HS256 verifications before `AUTH_SECRET` retires. Plus the 18-file `identity-foundation` shadow stack must reach verify-only first.
**Reality plane:** Loser on A/B (live). Winner on C only (issuer + verifier untracked).
**Removal-blocking condition:** commit + deploy the asymmetric topology; pass the `IDN-R2` dual-verify **drain gate** (telemetry = zero legacy-HS256 verifications); move shopper/console/app/`lb_accounts` issuance into identity-platform; replace the `|| AUTH_SECRET` webhook fallback with a dedicated `INTERNAL_API_SECRET` (`SEC-R7`); then retire the gateway mint path and `AUTH_SECRET`. The `identity-foundation` shadow (18 files, `D` in tree) is SAFE_DELETE only after identity-platform serves verify-only (`IDN-R3`).

**Overturn Test — CONFIRMED.** Fresh evidence shows the asymmetric issuer files genuinely exist (untracked) and the HS256 surface genuinely persists across 10 files. The winner is right by C2/`IDN-R2`; the nuance (asymmetric covers only the merchant token today; non-merchant realms still HS256) sharpens but does not overturn it.

---

## Decision 3 — Legacy Mutable Wallet/Commission/Payout Model vs Canonical Append-Only Ledger

| | Winner | Loser |
|---|---|---|
| System | **Canonical 8-account append-only double-entry ledger (mig 139/160), balance derived, bigint paise** | Mutable wallet/commission/payout balances (mig 119) as money truth |
| Class | CANONICAL (the flagship C2 call) | LEGACY → compatibility projection |

**Reason.**
- *Canon:* DOC 03 §3.3 / Rule C2: "Only the canonical ledger models COD cash-in-transit, reserves, reversing entries, and a balanced settlement … Make the volume paths *feed* the survivor; do not crown the busy path." `PAY-R1`: "Balance is **always derived** (`ledger_account_balance_minor`), never a mutable column."
- *Code:* `139_executable_foundation_ledger_core.sql:113` `writer_module text NOT NULL ... CHECK (writer_module = 'settlement')` (single-writer), `:163`+`:361-376` `reject_ledger_mutation()` trigger on UPDATE/DELETE across ledger tables (append-only by trigger), `:381` balance constraint `DEFERRABLE INITIALLY DEFERRED` (double-entry). `160_foundation_money_ledger_authority.sql:173` `CREATE ... FUNCTION ledger_account_balance_minor(...)` — balance derived (used `:224`,`:398`). Mig 139/160 are **tracked on HEAD**. The loser: `119_mobile_money_ledgers.sql` still defines mutable balance tables with `commission_bps integer DEFAULT 300` (`:81`,`:108`). The kernel is genuinely well-built — it is simply **un-fed** (see Decision 13).

**Risk:** S1 (mutable-balance-as-truth is the root-cause class behind historical payout/refund defects; the winner exists but is not yet operationally live, so money cannot reconcile end-to-end).
**Migration Complexity:** **High.** Every capture/refund/COD must post to the ledger (today the busy path posts nothing — Decision 13); the compat wallet/gift/store-credit/partner-payout tables become projections; the reconciliation refreshers must be wired to a scheduler (they have zero callers today); a zero-drift recon proof on live data is required; then a bigint expand/contract cutover (Wave 5).
**Reality plane:** Loser on A/B/C (compat tables persist). Winner kernel on B/C; full authority (mig 160) on B/C; the canonical money-path RPCs (mig 165) on **C only**.
**Removal-blocking condition:** `DEL-R2` DELETE_AFTER_MIGRATION — commit mig 160/162/165; wire recon refreshers to a scheduler; produce a zero-drift reconciliation proof; backfill `wallet_ledger_entries` → canonical; only then demote the compat tables. Add `REVOKE UPDATE/DELETE` + RESTRICT FKs (`PAY-R6`) if not already present.

**Overturn Test — CONFIRMED.** Fresh code shows a Stripe-grade append-only kernel (trigger + writer CHECK + derived balance) that is real and tracked, and a mutable model that is the loser. The C2 call (crown the less-complete-but-correct ledger over the busy mutable path) holds verbatim. No challenge.

---

## Decision 4 — Ownership via Raw Service-Role/REST vs RLS+FORCE+GUC (`withTenantTx`)

| | Winner | Loser |
|---|---|---|
| System | **3-layer fail-closed isolation: app-guard + ownership + RLS `ENABLE`+`FORCE`+per-tx GUC (`app_tenant` role)** | Blanket `service_role` + raw-REST `supabaseServiceHeaders` as the operative tenant plane |
| Class | CANONICAL (L3 load-bearing) | LEGACY → demote service_role to audited break-glass |

**Reason.**
- *Canon:* `WIN-R3`/`SEC-R9`: "RLS+FORCE+GUC over the app-only tenant guard (the guard stays as an outer layer, not the sole control)"; "The gateway MUST NOT connect as blanket `service_role` for tenant data … runs over a pooled transactional connection under a non-`BYPASSRLS` `app_tenant` role." `SEC-R6`: any `USING(true)` to PUBLIC is "DEAD (S0)."
- *Code:* baseline carries **58** `USING (true)` / `WITH CHECK (true)` policies (`grep -cE ... 000_baseline.sql`). The untracked fix `163_d2_live_data_leak_rls.sql` DROPs the PUBLIC-named-but-`USING(true)` `service_role_*` policies and recreates them `TO service_role`, then adds `*_tenant_site_guc` policies `USING (COALESCE(site_id, store_id) = public.current_site_id())` (`:10-35`). The untracked `164_d4_tenant_role_guc.sql:11` `CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS`, `:64` `ALTER TABLE ... FORCE ROW LEVEL SECURITY`, `:68` per-table `app_tenant` GUC policies. Both are **`??` plane-C-only**. The committed planes run single-layer (app-guard + blanket service_role).

**Risk:** S0 (anon-readable tenant PII/orders/customers via `USING(true)` PUBLIC policies on the deploy plane; raw-REST helpers bypass the app-layer guard entirely).
**Migration Complexity:** **Med→High.** Mig 163/164 must commit; per-route `withTenantTx` adoption must be proven with the RT-1…9 red-team suite (`TEST-R4`); the raw-REST `supabaseServiceHeaders` callers need tenant-guard parity or removal; the queue tenant envelope must fail-closed; FORCE+GUC must backfill across all tenant tables.
**Reality plane:** Loser on A/B/C (service_role default + raw-REST helpers persist). Winner policies (mig 163/164) on **C only**.
**Removal-blocking condition:** commit mig 163/164; RT-1…9 green and build-failing (`TEST-R4`); close every surviving permissive policy; give raw-REST helpers tenant-guard parity or delete their callers; then `service_role` survives only as `withServiceRole(reason, fn)` break-glass.

**Overturn Test — CONFIRMED.** Fresh code shows the 58 permissive policies, the untracked `app_tenant` NOBYPASSRLS role, FORCE RLS, and GUC predicates. RLS+GUC is the canon load-bearing layer; the blanket service_role is a *substitute* for tenancy (kept one), and the raw-REST bypass is a real hole. No challenge.

---

## Decision 5 — Scan-Generated AGENTS.md Regime vs Constitution/AGENTS_V2

| | Winner | Loser |
|---|---|---|
| System | **One Constitution (DOC 01) + AGENTS_V2 (DOC 02, the promoted root `AGENTS.md`) + Canonical Systems (DOC 03) + a validator suite that enforces V1** | The auto-generated `AGENTS.md` regime (9-app topology + CQRS manifests + stale counts as law) |
| Class | CANONICAL | DEAD → regenerate as a subordinate map of V1 |

**Reason.**
- *Canon:* DOC 01 P.2: "The generated `AGENTS.md` … its **constitutional claims are REVOKED**." `DOC-R1`/`ANTI-R8`: "MUST NOT generate a governance/authority document from a repository scan." The promoted root `AGENTS.md` opens: "**HAND-AUTHORED LAW. NOT GENERATED** … Supersedes the previous root `AGENTS.md` (the file with header `GENERATED BY scripts/generate-repository-intelligence.mjs`)."
- *Code/Repo:* the root `AGENTS.md` read this run **is** `LETBUYY_AGENTS_V2` (header line 1: "LETBUYY_AGENTS_V2 — The Agent Operating Rulebook (hand-authored law)") — i.e. AGENTS_V2 is already promoted to root in the working tree. The seven-doc canon stack exists in `GOVERNANCE_REWRITE_2026_06_10/` (Constitution, AGENTS_V2, Canonical Systems, Legacy Plan, Roadmap, UI/UX, Scorecard). The generator and the ~36 fiction validators are the loser; the survivability validator (Decision 8) is the surviving theater.

**Risk:** S2 (a generated doc as law misleads every agent/human about the real architecture and certifies the rejected end-state; not a runtime breach but the root cause of drift-as-law).
**Migration Complexity:** **Low.** Commit the canon stack; retarget/retire the generator (exit 1); regenerate `AGENTS.md` as the subordinate map of V1 §6; archive the ~60 superseded root docs. The work is governance + a commit, not capability.
**Reality plane:** The promoted AGENTS_V2-as-root is on plane C (the prior generated regime is what A/B carry as committed law).
**Removal-blocking condition:** Phase-0 `git add -A` commit of the constitutional stack **avoiding the commit trap** (tracked root docs are staged-deleted while their archive copies are untracked — a tracked-only commit orphans the archive); human ARB ratification (DOC 01 self-declares a ratification; record `SKIP-GATE1-ARB-RATIFICATION`); retarget the asserting validators **first** (`DEL-R3`) before deleting the generator/fiction validators.

**Overturn Test — CONFIRMED.** Fresh read confirms the root `AGENTS.md` is the hand-authored V2 (the supersession already drafted in-tree). The winner is correct per `DOC-R1`; the loser's only edge is that it is the *committed* law while the winner is uncommitted — a version-control gap, not an architecture one. No challenge.

---

## Decision 6 — Old Mission/Blueprint Docs (Codex waves, Shopify-OS-2.0 maximalism) vs Executable Architecture/Constitution

| | Winner | Loser |
|---|---|---|
| System | **Executable Architecture (V1+Freeze absorbed into the Constitution) — monolith + 4 satellites + empty reserved seams** | The maximalist blueprint corpus (CQRS/distributed/multi-region/Wasm, billion-$ OS, reserved-fleet activation) |
| Class | CANONICAL | DEAD → archive (a machine-enforced subset is gated — see Decision 8) |

**Reason.**
- *Canon:* DOC 01 P.2: "The maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` … **FORMALLY REJECTED as active topology and ARCHIVED**." `AUTH-R2`: "MUST NOT cite … the maximalist CHECKOUT_PLATFORM vision (1M-merchant / 22-service / Wasm) … formally rejected (ADR-021)." `ARCH-R7`: the rejected end-state packages "are `SAFE_DELETE` (DEAD) … MUST NOT 'complete,' 'fix,' or 're-enable' any of them."
- *Code/Repo:* the dangerous docs still live **outside `docs/archive/`** present-tense: `docs/audit/13-final-architecture-blueprint.md`, `docs/audits/apps-platform/20-final-architecture-blueprint.md`, `14-apps-marketplace-blueprint.md`, `15-partner-platform-blueprint.md`, `11-theme-app-extensions-blueprint.md`, `12-liquidjs-integration-blueprint.md`, etc. (10+ found). The rejected package dirs (`packages/app-engine`, `distributed-runtime`, `projection-runtime`, `runtime-composition`, `orchestration`, `extension-host`) exist **tracked on main AND HEAD**, and are **`D` (staged-deleted) in the worktree** — the deletion is drafted, uncommitted.

**Risk:** S2 (a future agent ingesting `13-final-architecture-blueprint.md` rebuilds the rejected topology; value-negative misdirection, not a live breach).
**Migration Complexity:** **Trivial→Low** for the docs (`git mv` to `docs/archive/`, `DOC-R4`) and **Low** for the DEAD packages (retarget the asserting validators first, then the deletions already drafted in-tree land). The *blocked* subset is the machine-enforced distributed layer (Decision 8): the survivability/end-state validators require those configs to exist, so they must be retargeted before the configs/docs can archive.
**Reality plane:** Docs + packages live on A/B/C (tracked); the archival/deletion is a C-only working-tree draft (the 512 `D`).
**Removal-blocking condition:** mostly archive moves; BUT the machine-enforced subset is blocked on Decision 8's validator repeal/retarget (`DEL-R3` ordering) — deleting the distributed configs/docs before retargeting `survivability-governance-validator.mjs` fails CI.

**Overturn Test — CONFIRMED.** Fresh `find` shows the maximalist docs still active outside archive and the DEAD packages tracked-but-staged-for-deletion. The Executable Architecture wins per DOC 01 P.2 / `ARCH-R7`. No challenge.

---

## Decision 7 — `main` vs `stepup/main` Working Tree (the branch decision)

| | Winner | Loser |
|---|---|---|
| System | **`stepup/main` working tree (plane C) = the hardened end-state** | `main` as the operative/deployable state |
| Class | CANONICAL (intended truth) | CONDEMNED (deploy source of a pre-hardening platform) |

**Reason.**
- *Canon:* `DEPLOY-R1`: "The deploy meta-blocker is the keystone — fix it first. `production-deploy.yml` triggers on `main`; `main` was 30 commits behind the fix branch, so every remediation was undeployable. MUST keep `git rev-list --count main..stepup/main = 0`." `ANTI-R11`: "MUST NOT treat working-tree completion as production state; `main` was 30 commits behind, so 'complete' was '~0% live.'"
- *Code:* `production-deploy.yml:5-6` triggers `on: push: branches: [main]` — `main` is the sole deploy source. Re-verified this run: `git rev-list --count main..HEAD = 30`; `main` max migration **158**, HEAD tracked max **161**, worktree adds **162–166** untracked. The most-hardened reality is, by config, *not* the one that deploys.

**Risk:** S0 (the deploy plane is the pre-hardening platform — account-takeover, anon leaks, mutable money, 3% rake all ship from `main`; the fixes are stranded in an uncommitted tree).
**Migration Complexity:** **Med.** The commit itself is mechanical but carries the **commit trap** (tracked deletions vs untracked archive copies) and **arms the survivability self-block** (Decision 8). It must be sequenced: survivability-unhook + commit + ratify + fast-forward `main` + deploy.
**Reality plane:** This decision *is* the plane decision. C is the intended truth; A is condemned-deployable; B (HEAD) is interim.
**Removal-blocking condition:** Phase-0 — `git add -A` on `stepup/main` avoiding the commit trap; ARB-ratify; **unhook the survivability/multi-region gate in the same change** (else the commit fails CI against itself); fast-forward `main` (branch-lag guard → 0); deploy; run live-seam probes. **Hard warning (`ANTI-R11`):** never "resolve" the triplication with `git checkout .` / `git clean -fd` — that destroys plane C (Constitution, AGENTS_V2, migrations 162–166, the RLS/identity/ledger hardening — all `??`/`M`/`D` with zero history).

**Overturn Test — CONFIRMED.** Fresh git shows +30, `main`-only deploy trigger, and the migration-level gap (158 vs 161 vs 166). Plane C is the canon winner per `DEPLOY-R1`/`ANTI-R11`. No challenge.

---

## Decision 8 — One-Region Monolith vs Multi-Region/Distributed/CQRS/Survivability Topology

| | Winner | Loser |
|---|---|---|
| System | **One-region modular monolith (`api-gateway`) + 4 satellites + one RLS Postgres (ap-south), `letbuyy.com`** | Multi-region/distributed/CQRS/survivability topology (4-region failover, replay-runtime, event-store) |
| Class | CANONICAL | DEAD/FORBIDDEN — **but self-mandated by a CI gate (the hard case)** |

**Reason.**
- *Canon:* DOC 01 §6: "**NEVER optimize for 100,000+ or 1,000,000+** … No sharding, no multi-region, no CQRS, no event sourcing, no service mesh … out of scope by constitutional rule." `ENV-R2`/`ARCH-R8`/`NEVER-R1` forbid multi-region/CQRS/saga. DOC 01 §5.3: "Validators **must enforce *this* Constitution, never the rejected end-state** … may not certify multi-region survivability."
- *Code (the self-block, verified this run):* `scripts/validators/survivability-governance-validator.mjs:94` asserts `multi-region-runtime.json` must contain regions `["india","apac","eu","us"]`; `:98-102` failover pairs must declare replay + positive RTO/RPO; `:106` `productionTopology.regions.globalRegions.length >= 4`; `:43` required evidence categories include `"multi-region"`,`"replay-runtime"`,`"event-store"`. This validator is **tracked AND on main** (`git cat-file -e main:… → ON MAIN`). The untracked `scripts/validators/whole-repo-end-state-validator.mjs:172-176` re-asserts the same 4 regions and `:178-194` wires `validate:survivability` into 3 workflows — and it is **`??`, absent on main** (`WHOLE-REPO ABSENT ON MAIN`). Config files `config/runtime/multi-region-runtime.json`, `survivability-execution.json`, `runtime-survivability-intelligence.json` exist and `production-topology.json` carries the `globalRegions` block.

**Risk:** S1 (the gate enforces a constitutionally-forbidden topology; committing plane C *worsens* it by adding whole-repo end-state enforcement — a governance-theater violation of DOC 01 §5.3 that also blocks convergence deletions via `DEL-R3`).
**Migration Complexity:** **Low mechanically, but ARB-gated.** No `SKIP` row authorizes *keeping* the contract; an **ARB decision to repeal** it is required, then a **single paired change** must land: `survivability-governance-validator.mjs` + the `whole-repo-end-state-validator.mjs` region/`validate:survivability` assertions + the `production-topology.json.globalRegions` block + the 3 workflows. Only then do the configs + ≥10 distributed-governance docs become archivable.
**Reality plane:** Monolith topology on A/B/C. The multi-region *contract* (configs + survivability validator) is tracked → lives on A/B/C, partly on main. The end-state validator that locks it is C-only — so **committing C without fixing this makes the contradiction gate-enforced repository-wide.**
**Removal-blocking condition:** ARB repeal + the one-change paired retarget above, sequenced **before or with** the Phase-0 commit. This is the "survivability-unhook must precede/accompany the commit" pivot.

**Overturn Test — CONFIRMED (winner) + the most important nuance in the registry.** Fresh code proves the validators literally require `india/apac/eu/us`, replay, RTO/RPO, and `globalRegions>=4` — directly against DOC 01 §6/§5.3. The one-region monolith remains the unambiguous canon winner; the loser is partly **already-committed law** (survivability validator on main) and partly **armed-by-commit** (whole-repo end-state on C). No overturn — but the loser is uniquely self-mandated, so its removal is the gating sequence-critical step.

---

## Decision 9 — api-gateway Monolith vs merchant-control-plane Second Backend

| | Winner | Loser |
|---|---|---|
| System | **`api-gateway` modular monolith = the single commerce backend** | `merchant-control-plane` acting as a second backend (62 `/api` routes) + storefront-runtime's partial 3rd surface |
| Class | CANONICAL | LEGACY → proxy-or-port to the gateway |

**Reason.**
- *Canon:* `ARCH-R1` gives the gateway the commerce backend; `ARCH-R17`: "**Apps** own routing, rendering, presentation, runtime adapters, transport, and hooks **only**." DOC 03 #27 makes `merchant-control-plane` a *control plane*, not a backend. `WIN-R4`/`ANTI-R1`: never two writers per domain.
- *Code:* `find apps/merchant-control-plane -path "*/api/*" -name route.ts | wc -l = 62` — routes covering gateway-owned domains: `stores/[store]/{products,customers,settings,payment-config,gift-cards,shipping/zones,coupons,policies,navigation,plan}` etc. `find apps/storefront-runtime …/api… = 21` (the third partial surface). **Five** logout/auth surfaces exist: `apps/merchant-control-plane/.../api/auth/logout`, `apps/storefront-runtime/.../api/customer/logout`, `apps/platform-console/.../api/console-auth/logout`, `apps/identity-platform/.../api/auth/logout`, `apps/identity-platform/.../oauth2/logout`.

**Risk:** S2 (two writers per domain = drift, double-maintenance, ambiguous source-of-truth for every merchant mutation; not a live breach but a structural `WIN-R4` violation).
**Migration Complexity:** **Med.** Requires per-page call-graph tracing (UNVERIFIED — which UI page calls which of the 62 routes vs the gateway) before a safe proxy-or-port cutover with contract tests per route. Note `gift-cards` is single-writer but in the *wrong* runtime (no gateway mount) — it must be **ported**, not just proxied.
**Reality plane:** Both backends exist on A/B/C — a **spatial** duplicate, independent of the commit gap.
**Removal-blocking condition:** per-page call-graph trace; proxy-or-port cutover with per-route contract tests; port `gift-cards` to the gateway; resolve the 5 logout surfaces to the identity-platform realm boundaries (`ARCH-R18`/`IDN-R4`).

**Overturn Test — CONFIRMED.** Fresh counts (62 MCP routes, 21 storefront routes, 5 logout surfaces) confirm the second-backend anti-pattern. The monolith wins per `ARCH-R1`/`ARCH-R17`. No challenge.

---

## Decision 10 — Mobile: Navigator+BFF-Composite vs Dead GoRouter; ui_kit Tokens vs App-Local; Theme-Editor Survivor

| | Winner | Loser |
|---|---|---|
| 10a Navigation | **Classic Navigator + composite `mobile-bff` dashboard** | Dead `AppDeepLinkRouter` (GoRouter) + the `go_router` dep |
| 10b Tokens | **`ui_kit` generated DTCG token bridge** | App-local token/color forks |
| 10c Theme editor | **Re-wire the section editor (else fall back to read-only LivePreview)** | The 1,200-line `SectionEditorScreen` left as dead code |

**Reason.**
- *Canon:* DOC 03 #28/#35: "`ThemeData` re-pointed at the generated token bridge"; "ONE token source … generated Dart bridge." `UI-R1`: "the Dart `ui_kit` consumes a **generated bridge** … MUST NOT introduce a … bypassing mobile `ThemeData`/color class." DOC 03 #28 names the TD-5 parity catalog + duplicate `LetbuyyColorTokens` as dead weight; #25 protects the theme editor as renderer-agnostic.
- *Code (verified this run):* `SectionEditorScreen` appears **only** in its own definition (`apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart:26-33`) — **zero construction/navigation sites** elsewhere in `lib` (dead code). `AppDeepLinkRouter` appears **only** in `lib/app/deep_link_router.dart:16-17` — **zero callers**; yet `pubspec.yaml:48` `go_router: ^17.0.0` is a live dependency feeding nothing. `services/mobile-bff/src/index.ts` is the composite BFF (the live nav winner). The theme editor (`theme_screen.dart`, `theme_versions_screen.dart`) is the richest mobile surface but unreachable.

**Risk:** S3 for the dead GoRouter / app-local forks (pure dead-weight); S2 for the dead theme editor (1,200+ lines of the strongest mobile feature with zero reachability — a honesty/maintenance defect). A separate **login Turnstile double-spend** is an S1 bug that blocks any mobile launch regardless of these calls.
**Migration Complexity:** **Trivial** for 10a/10b (delete the zero-caller GoRouter + drop `go_router`; the token forks are already `D` on plane C). **Low** for 10c (re-wiring is a navigation fix — give the editor a construction site/route — not a rebuild; or delete it if not re-wired this cycle).
**Reality plane:** The composite BFF, token bridge, and parity-catalog deletion are on **plane C**; A/B ship debug-signed builds + the parity catalog. The dead editor and the GoRouter exist on A/B/C.
**Removal-blocking condition:** (10a) confirm no external `/features/*`/deep-link consumer targets the GoRouter (none found in-repo) → delete + drop the dep. (10b) commit the token-fork deletions; `ui_kit --check` exit 0. (10c) ARB/PM decision: re-wire (preferred — most valuable mobile surface) or delete; **fix the login Turnstile double-spend first** regardless (it is a bug, not a seam).

**Overturn Test — CONFIRMED.** Fresh grep proves the section editor and the GoRouter each appear only in their own definition (zero callers), and the composite BFF exists. The canon survivors (Navigator+BFF, generated token bridge, protected-but-must-be-reachable editor) hold. No challenge; the 10c honest tension (implementation-complete ≠ user-reachable) is real but does not flip the winner.

---

## Decision 11 — Commission 0 bps vs 300 bps

| | Winner | Loser |
|---|---|---|
| System | **`commission_bps = 0` (0% transaction fee, permanent)** | `commission_bps DEFAULT 300` (3% GMV rake) + 18% GST-on-fee |
| Class | CANONICAL | DEAD |

**Reason.**
- *Canon:* DOC 01 §4.4 + `PAY-R3`/`NEVER-R5`: "0% transaction fee, permanent. MUST set `commission_bps = 0`; the 3% GMV rake default + the 18% GST-on-fee are **DEAD**. A `commission_bps=0` ratchet validator prevents regression."
- *Code (verified this run):* tracked `119_mobile_money_ledgers.sql:81` and `:108` both `commission_bps integer DEFAULT 300 NOT NULL` — the 3% rake default is in **every committed plane**. The untracked `162_phase_a_commission_zero.sql` sets `ALTER COLUMN commission_bps SET DEFAULT 0` on `commission_schedules` + `commission_reconciliation_entries`, then `UPDATE ... SET commission_bps = 0` on historical rows (and zeroes `commission_amount_minor`/`gst_amount_minor`). Code-side, `services/api-gateway/src/routes/payouts.ts:345` already reads `commission_bps ?? 0` (worktree fallback) and `:400` computes `platformFeeMinor = round(gross * commissionBps / 10000)` — so with mig 162 the fee resolves to 0.

**Risk:** S2 (the 3% rake is the business-model liability canon kills; it is live on `main` as a competitive/trust defect, but it is a pricing defect, not a security breach).
**Migration Complexity:** **Low.** Commit mig 162 + the `commission-bps-zero` ratchet validator; verify live-DB row state. One ARB nuance: mig 162 rewrites past commission rows **in-place with no ledger correction entry** — an audit contradiction inside the fix; ARB must choose ledgered-correction vs accepted-backfill.
**Reality plane:** Loser on A/B (DB default 300, committed). Winner on C only (mig 162 untracked + the `?? 0` fallback).
**Removal-blocking condition:** commit mig 162 + the ratchet; ARB call on the in-place history rewrite; verify live rows.

**Overturn Test — CONFIRMED.** Fresh code shows DEFAULT 300 in the tracked migration and the zeroing only in the untracked mig 162. 0 bps wins per `PAY-R3`/`NEVER-R5`. No challenge.

---

## Decision 12 — Payout: Provider-Split Rails vs RazorpayX Self-Custody

| | Winner | Loser |
|---|---|---|
| System | **PA-split rails (Razorpay Route / Cashfree) — LetBuyy never custodies** | RazorpayX self-custody rail |
| Class | CANONICAL | DEAD (regulatory; `NEVER-R2`) |

**Reason.**
- *Canon:* DOC 01 §4.3 + `PAY-R4`/`NEVER-R2`: "Never custody. Money-out is a **PA-split instruction** … The `razorpayx` self-custody rail is **DEAD**; MUST NOT re-enable it." `NEVER-R2`: "MUST NOT build a **money-custody** payout/disbursement engine."
- *Code (verified this run):* `packages/infrastructure/payout-transfer-adapter/index.ts:1` `type MerchantPayoutRail = 'razorpay_route' | 'razorpayx' | 'upi' | 'manual'` (razorpayx still a legal enum member — residue); `:73` `defaultRail()` returns `'razorpay_route'` (worktree default = the correct rail); `:85-86`,`:104` `initiateTransfer` throws `PayoutProviderUnavailable('… payout provider client is not configured / credentials are not configured')`. **No real provider client exists — no payout moves money in ANY plane.** So this is a decision between a correct-but-unbuilt rail and a forbidden-and-unbuilt rail.

**Risk:** S1 (self-custody is the regulatory/insolvency posture canon forbids; the winner is a target with no working client, so merchants cannot be paid end-to-end today).
**Migration Complexity:** **High.** A real payout provider client must be **built** (genuine capability gap that survives any merge); a migration must purge razorpayx from enums/CHECKs; live Route credentials are a `[HUMAN-REQUIRED]` seam (`HR-PA-SPLIT-LIVE`, 503 in live mode).
**Reality plane:** razorpayx default on A/B; `razorpay_route` default + the `no-self-custody-rail` validator on C. Both rails are **dead code on all planes** (transfer throws everywhere).
**Removal-blocking condition:** commit the worktree (removes the razorpayx default); migration to purge the razorpayx enum/CHECK residue; **build a real PA-split provider client**; provision live Route creds.

**Overturn Test — CONFIRMED.** Fresh code shows the worktree default is `razorpay_route`, razorpayx survives as enum residue, and `initiateTransfer` unconditionally throws. PA-split wins per `PAY-R4`/`NEVER-R2`. No challenge.

---

## Decision 13 — Storefront Capture: Ledgered (target) vs `confirm_order_payment_with_ledger` (no-ledger)

| | Winner | Loser |
|---|---|---|
| System | **Ledgered capture (posts canonical ledger: debit `pa_clearing` / credit `merchant_payable`)** | `confirm_order_payment_with_ledger` — the every-shopper path that posts **zero** canonical ledger lines |
| Class | CANONICAL (target) | DEAD-as-name (naming theater) → becomes an adapter, then LEGACY |
| **Both gateway-owned; NEITHER is the wired winner today** | | |

**Reason.**
- *Canon:* `PAY-R2`: "MUST NOT add a money path that captures without posting (the legacy `confirm_order_payment_with_ledger` posts **zero** ledger entries despite its name — it becomes an adapter, then LEGACY)." DOC 03 §3.3 Payments: the legacy RPC "posts no ledger."
- *Code (verified this run, the flagship finding):* `database/supabase/migrations/000_baseline.sql:1590-1709` — `confirm_order_payment_with_ledger(...)` calls `confirm_order_payment` (`:1599`, flips order status), UPDATEs/INSERTs `payment_transactions` to `'captured'` (`:1618-1670`), INSERTs `payment_attempts` (`:1673-1705`), and **contains NO call to `post_ledger_transaction` or `post_settlement_ledger_transaction`** — a `grep -c` over the function body (`:1590-1709`) returns **0**. The "_with_ledger" suffix refers only to `payment_transactions`. The real ledgered poster `post_settlement_ledger_transaction` exists only in the **untracked** `165_d5_canonical_money_paths.sql:214-265` (validates source ownership, sets the GUC from resolved ownership not param `:252`, posts via `post_ledger_transaction` `:253`) — and it is wired to the V1 `/payments` surface, **not** the storefront/webhook confirm chain the buyer hits.

**Risk:** S1 — the single largest unfinished winner in the repo. Un-ledgered captures mean paid orders contribute to payout-statement gross but not to `merchant_payable`, so the payout claim guard (correctly) refuses to release — **money cannot flow end-to-end.** This is *why* the wallet read fails closed (Decision 3).
**Migration Complexity:** **High.** The storefront/webhook confirm chain (verify route + all 4 provider webhooks) must post canonical ledger entries (or route through the canonical capture adapter) — a genuine capability gap that **survives any commit/merge**; the same is required for the two un-ledgered refund paths (`complete_order_refund`, webhook `refund.created`); plus a reconciliation-harness zero-drift proof. The `canonical-ledger-only-validator` is structurally blind here (SQL-side; `orders`/capture RPCs not in its ratchet list) and must be extended.
**Reality plane:** the no-ledger path is the buyer-facing reality on **A/B/C**; the ledgered poster exists on B/C (mig 165 on **C only**). This is the one major money pair where **even plane C has not made the winner live.**
**Removal-blocking condition:** wire canonical ledger posting into the storefront/webhook capture chain; do the same for both refund paths; reconciliation harness green (`TEST-R3`, the money-cluster deploy + deletion gate); extend the validator to see SQL writers + add `orders`/capture to its table list.

**Overturn Test — CONFIRMED + the most consequential confirmation.** Fresh read of the actual function body proves zero ledger calls inside the "_with_ledger" RPC — canon's claim is literally true at `path:line`. The ledgered capture is the right target per `PAY-R2`; the no-ledger path is the loser-as-name even though it is the complete, every-buyer path. No overturn — and this is the gap that gates real money regardless of any merge.

---

## Decision 14 — Notifications/Alerting: Real Channel (WhatsApp-first router) vs Dead Prometheus/otel Config

| | Winner | Loser |
|---|---|---|
| System | **WhatsApp-first notifications router in the monolith (→ SMS → email → push), honest mock-by-default, multi-ESP failover; the reserved `notification-service` stays empty** | The Prometheus/otel observability config with **no runtime SDK** (config-only theater) + the reserved `notification-service` as fabricated topology |
| Class | CANONICAL (build, P1) | DEAD config / FROZEN-empty service |

**Reason.**
- *Canon:* DOC 03 #30: "A WhatsApp-first notifications router in the monolith … multi-ESP failover; preferences/suppression/consent. … `notification-service` stays FROZEN-empty; its fabricated `production` topology entry." `AGENT-R11`/`PAY-R10`: human-required integrations are mock-by-default, badged, never faked. DOC 01 §5.3: validators may not certify a survivability/observability stack the platform does not run.
- *Code (verified this run):* `packages/notification-core/src/index.ts:45` `EmailProviderSchema = z.enum(['mock_resend','mock_ses','mock_sendgrid','resend','ses','sendgrid'])`, `:101` `EmailMode = 'mock' | 'sandbox' | 'live'`, `:117` `MOCK_EMAIL_PROVIDERS` default, `:208` `planEmailProviderFailover(...)` — a real provider-mode + failover model with honest mock defaults. The router has DB backing (`148_executable_notifications_router.sql`, 38 table/notification refs) and a gateway route (`services/api-gateway/src/routes/notifications.ts`); the queue send-side proxies to the gateway (`services/queue-workers/src/index.ts:523`). The **loser**: `infrastructure/observability/prometheus-rules.yaml` + `otel-collector.yaml` exist as config, but `grep -rln '@opentelemetry|prom-client|prometheus' **/package.json` returns **empty** — **no metrics SDK is installed in any runtime**, so the observability contract emits nothing. The `survivability-governance-validator.mjs:75-88` nonetheless asserts those Prometheus rules/dashboards must exist (governance theater over a dead pipeline).

**Risk:** S2 (no real alerting/observability channel despite config that asserts one — an honesty/operability gap; the notification router is correctly mock-by-default so it does not *falsely* report live).
**Migration Complexity:** **Med** to make notifications real (build the router's live ESP/WhatsApp BSP adapters behind flags — P1 capability, but the contract + honest mocks already exist), **Low** to purge the dead observability theater (retarget `survivability-governance-validator.mjs` off the Prometheus assertions, then archive the config or wire a real SDK).
**Reality plane:** the notification-core contract + honest mocks are on B/C; the observability config theater is tracked on A/B/C and asserted by the survivability validator (which is on main).
**Removal-blocking condition:** for the dead observability config — retarget the survivability validator off the Prometheus/dashboard assertions **first** (`DEL-R3`), then either install a real metrics SDK or archive the config. For notifications — build the live adapters behind flags with the honesty badge (`AGENT-R11`); never let a mock read as `live`/`success`.

**Overturn Test — CONFIRMED.** Fresh evidence: the notification router contract is real with honest mock-by-default providers (winner), while the Prometheus/otel config has zero backing SDK (dead) yet is gate-asserted. The canon winner (real router + honest mocks; reserved service empty; dead observability config purged) holds. No challenge.

---

## Winner Registry

| # | Domain | WINNER (the one canonical system) | Class | Canon anchor |
|---|---|---|---|---|
| 1 | Theme runtime | **Liquid / portable-theme renderer** | CANONICAL (flip) | DOC 03 §3.5; `THEME-R1` |
| 2 | Identity / sessions | **identity-platform asymmetric sole issuer (all 3 realms)** | CANONICAL | DOC 03 #3; `IDN-R1/R2` |
| 3 | Money model | **Canonical 8-account append-only double-entry ledger** | CANONICAL | DOC 03 §3.3; `PAY-R1` |
| 4 | Tenant isolation | **RLS `ENABLE`+`FORCE`+per-tx GUC (`app_tenant`/`withTenantTx`)** | CANONICAL (L3) | `SEC-R9`/`WIN-R3` |
| 5 | Governance | **Constitution + AGENTS_V2 + Canonical Systems** | CANONICAL | DOC 01 P.2/P.3; `DOC-R1` |
| 6 | Architecture docs | **Executable Architecture / Constitution (monolith + seams)** | CANONICAL | DOC 01 P.2; `ARCH-R7` |
| 7 | Branch reality | **`stepup/main` working tree (plane C)** | CANONICAL | `DEPLOY-R1`/`ANTI-R11` |
| 8 | Topology | **One-region modular monolith + 4 satellites** | CANONICAL | DOC 01 §6; `ENV-R2`/`ARCH-R8` |
| 9 | Commerce backend | **api-gateway monolith (single backend)** | CANONICAL | `ARCH-R1/R17`; DOC 03 #27 |
| 10a | Mobile nav | **Navigator + composite mobile-bff** | CANONICAL | DOC 03 #28 |
| 10b | Mobile tokens | **ui_kit generated DTCG token bridge** | CANONICAL | `UI-R1`; DOC 03 #35 |
| 10c | Mobile theme editor | **Re-wire section editor (else read-only LivePreview)** | CANONICAL (protect) | DOC 03 #25 |
| 11 | Commission | **0 bps (0% fee, permanent)** | CANONICAL | `PAY-R3`/`NEVER-R5` |
| 12 | Payout rail | **PA-split (never custody)** | CANONICAL | `PAY-R4`/`NEVER-R2` |
| 13 | Storefront capture | **Ledgered capture (target; not yet wired)** | CANONICAL (build) | `PAY-R2`; DOC 03 §3.3 |
| 14 | Notifications | **WhatsApp-first router, honest mock-by-default; reserved svc empty** | CANONICAL (build P1) | DOC 03 #30; `AGENT-R11` |

---

## Loser Registry (with removal-blocking conditions)

| # | Loser | Removal-blocking condition (must ALL hold) | Capability gap? |
|---|---|---|---|
| 1 | React section renderer | 8-part Liquid parity gate (header/footer + routing + commerce binding + full templates + real drops + canary write path + merchant edit surface) + Security suite + ARB flip ratification | **YES — Liquid unbuilt for a real store** |
| 2 | Gateway randomHex + `AUTH_SECRET` HS256 family | commit+deploy asymmetric; `IDN-R2` zero-legacy-HS256 drain telemetry; move shopper/console/app/`lb_accounts` off HS256; `identity-foundation` (18 files) verify-only first | Partial — non-merchant realms still HS256 |
| 3 | Mutable wallet/commission/payout model | commit mig 160/162/165; wire recon refreshers to a scheduler; live zero-drift proof; backfill `wallet_ledger_entries` → canonical | **YES — refreshers have 0 callers; wallet 409s** |
| 4 | Raw service-role / raw-REST plane | commit mig 163/164; RT-1…9 per-route adoption proof; raw-REST helpers get tenant-guard parity or callers removed; close 58 permissive policies; fail-close queue envelope | Partial — permissive policies + raw-REST bypass real |
| 5 | Scan-generated AGENTS.md regime | Phase-0 commit (avoid commit trap); ARB GATE-1 ratification; retarget generator/fiction validators **first**; resolve any DOC divergence | NO — governance/commit gap |
| 6 | Maximalist blueprint docs + DEAD CQRS packages | archive moves (`DOC-R4`); machine-enforced subset blocked on Decision 8 validator retarget (`DEL-R3`) | NO — but gate-blocked subset |
| 7 | `main` as operative state | Phase-0 commit + ratify + **survivability-unhook in the same change** + fast-forward `main` (lag→0) + deploy; never `git clean -fd` | NO — version-control gap (+ self-block) |
| 8 | Multi-region/survivability topology | **ARB repeal** + one paired change (2 validators + `production-topology.json` regions + 3 workflows) **before/with** the commit, then archive configs/docs | NO — but self-mandated by the CI gate |
| 9 | merchant-control-plane second backend | per-page call-graph trace; proxy-or-port cutover with per-route contract tests; port `gift-cards` (no gateway mount); resolve 5 logout surfaces | NO — but tracing UNVERIFIED |
| 10a | Dead GoRouter (`AppDeepLinkRouter`) + `go_router` dep | confirm no external `/features/*`/deep-link consumer (none in-repo); delete + drop dep | NO |
| 10b | App-local token/color forks | commit the (already-`D`) fork deletions; `ui_kit --check` exit 0 | NO |
| 10c | Dead `SectionEditorScreen` (1,200 LOC) | ARB/PM decision: re-wire (nav fix) or delete; fix login Turnstile double-spend regardless | The double-spend is a bug, not a seam |
| 11 | 300 bps commission (3% rake) | commit mig 162 + ratchet; verify live rows; ARB call on in-place history rewrite | NO |
| 12 | RazorpayX self-custody | commit (removes default); migration to purge enum/CHECK residue; **build a real payout provider client**; live Route creds | **YES — no provider client exists** |
| 13 | `confirm_order_payment_with_ledger` no-ledger chain | storefront/webhook capture must post canonical ledger (or route via the canonical adapter); same for 2 refund paths; reconciliation harness green; extend validator to SQL + `orders` | **YES — the largest unfinished winner** |
| 14 | Dead Prometheus/otel observability config | retarget `survivability-governance-validator.mjs` off the Prometheus assertions **first**; then install a real metrics SDK or archive the config | Partial — no metrics SDK in any runtime |

---

## Migration-Complexity Rollup

**Trivial-delete (zero-importer / doc-archive — fall the moment the validator is retargeted or the commit lands):**
- 10a Dead GoRouter + `go_router` dep (zero callers, verified).
- 10b App-local token forks (already `D` in tree).
- 6 (doc subset) Maximalist blueprint docs → `git mv` to `docs/archive/`.

**Low (commit + retarget a validator; governance/version-control, no capability):**
- 5 Scan-generated AGENTS.md regime (commit canon + retarget generator).
- 7 `main` as operative state (commit + fast-forward) — *but sequence-coupled to Decision 8*.
- 8 Multi-region/survivability topology — mechanically a one-change paired retarget, **ARB-gated** (no SKIP authorizes keeping it); **the keystone: must precede/accompany the commit or it self-blocks CI.**
- 11 300 bps commission (commit mig 162 + ratchet; ARB nuance on in-place rewrite).
- 14 (config subset) Dead Prometheus/otel config (retarget validator, then archive or wire SDK).

**Med (wire an existing winner that is unfed, or cutover with contract tests):**
- 2 (merchant token done; non-merchant realms need asymmetric/dedicated-secret cutover + drain gate).
- 4 (commit mig 163/164; RT-1…9 adoption proof; raw-REST parity).
- 9 merchant-control-plane backend (call-graph trace → proxy-or-port with contract tests).
- 10c Theme editor (re-wire = navigation fix) + the S1 login double-spend bug.
- 14 (notifications) build live ESP/WhatsApp adapters behind flags (contract + honest mocks exist).

**High — GENUINE CAPABILITY must be built before the loser can go (a `git add` does NOT resolve these four):**
- **1 React renderer** — Liquid has no header/footer, binds nothing, `index`-only template; the renderer winner must be *built*, not flipped.
- **3 Mutable money model** — the canonical ledger is the winner but is **un-fed**; the recon refreshers have zero callers, so the wallet read fails closed forever until they are wired + a live zero-drift proof exists.
- **12 Payout rail** — `initiateTransfer` throws in every plane; **no provider client exists** and must be built.
- **13 Storefront un-ledgered capture** — the every-shopper path posts zero canonical ledger lines; canonical posting must be **wired** into capture + both refund paths. *(This is the gap that gates real money regardless of any merge — the single largest unfinished winner.)*

**The four capability-gated losers (1, 3, 12, 13) are the real critical path.** Everything else is a commit, a validator retarget, an archive move, or a contract-tested cutover — none of which moves a rupee. The money path (3 + 12 + 13) cannot complete until the canonical ledger is fed by capture, a payout provider client exists, and the recon refreshers run.

---

## Unknowns / UNVERIFIED (never silently upgraded to fact)

1. **Live deployed state** of every domain — CI deploys from `main` (plane A); the repo cannot prove what production actually runs (live identity plane, live DB migration level, live RLS/grant state, live commission rows, live Vercel projects) — all UNVERIFIED. Migration 107's header + the 58 baseline `USING(true)` policies are strong evidence the anon leaks are live, but a `\dp public.orders` / anon-key probe is the proof.
2. **merchant-control-plane per-page call-graph** (Decision 9) — which UI page calls which of the 62 MCP routes vs the gateway is UNVERIFIED; blocks safe cutover sequencing.
3. **`production-topology.json` `globalRegions` semantics** (Decision 8) — whether the 4-region block encodes Cloudflare *edge* presence (compatible with one-region doctrine) or a *data-region* contract (incompatible). The survivability validator's `failoverPairs` + `replayRequired` assertions read as a data-region/failover contract (incompatible), but this should be ARB-confirmed.
4. **ARB intent on the survivability contract** (Decision 8) — whether keeping it was directed or program improvisation is UNVERIFIED; **no `SKIP` row authorizes keeping it**, only the act of its existence. Repeal requires an explicit ARB decision.
5. **Mobile login Turnstile double-spend** (Decision 10c) — code-derived; the dart-define site keys look like real `0x4…` keys (would fail on duplicate), but no network access to confirm live behavior.
6. **Behavioral test execution** — many "tests" cited across the canon are structural lints / source-string assertions, not behavior; the money-kernel depth and the RT-1…9 suite are specified-not-built (`TEST-R10`) and must be authored + made build-failing before the money/tenancy deletions are validated.
7. **Migration 162 in-place history rewrite** (Decision 11) — whether the ARB accepts an un-ledgered backfill of past commission rows or requires a ledgered correction entry is an open human decision.
8. **`REVOKE UPDATE/DELETE` on ledger tables** — the append-only *trigger* (`reject_ledger_mutation`) and single-writer CHECK are verified in mig 139; whether the paired `REVOKE`/RESTRICT-FK hardening (`PAY-R6`) is fully present across all ledger tables in 160 vs a later migration was not exhaustively traced — confirm before treating trigger-only as sufficient.
9. **Composite/severity judgments** are anchored to cited `path:line` evidence; the **winner/loser direction is robust** (no fresh evidence inverts which side wins on architecture + canon-fit for any of the 14), but exact risk classes are defensible estimates, not measurements.

---

*End of STRATEGIC_WINNERS_FINAL.md. Discovery/decision only — the single file written is this report; no code, schema, git state, or other document was modified. Every winner re-derived FRESH from canon (DOC 01/02/03) + code (`path:line` re-verified at `stepup/main` @ `5cf9e64e`, working tree dirty, 2026-06-10). Overturns vs prior audits: 0 of 14.*
