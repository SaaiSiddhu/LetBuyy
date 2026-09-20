# LETBUYY LEGACY ERADICATION REGISTER

**Part 3 of the Strategic Canonicalization Program · Architecture Review Board deliverable**

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Author** | Principal Platform Engineer, Architecture Review Board |
| **Repo** | `/Users/saai_sidd/Git/Letbuyy_Store` |
| **Branch / HEAD at register** | `stepup/main` @ `c4fc3cd6` (working tree DIRTY, audited as-is) |
| **Companion deliverable** | `SAFE_DELETION_PLAN.md` (same directory) — every `SAFE_DELETE`/`DELETE_AFTER_MIGRATION` row here has a `DEL-xxx` execution block there |
| **Authoritative inputs** | `_ANCHOR_DECISIONS_SPINE.md` (A0–A9), `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (§6 topology, §9.9 TD register), `FORENSIC_MASTER_2026_06_10/` (REPO_TOPOLOGY / ARCHITECTURE_COMPLIANCE / DATABASE / AUTH / THEME / PAYMENTS forensic audits) |

---

## 1. Methodology

This register enumerates **every** superseded, duplicated, dormant, partially-migrated, parallel, or dead artifact in the tree and assigns each a deletion classification. It is not a wish-list: a thing is only called **dead** when the dependent graph proves nothing wires it.

**Procedure (evidence-only):**

1. **Winners first.** Read `_ANCHOR_DECISIONS_SPINE.md` A0–A9; the Strategic Winner per domain is fixed. Anything that is not the winner is a candidate for this register.
2. **Inventory.** Pull the path-level inventory from `REPO_TOPOLOGY_AUDIT.md` (TOPO-001…041), the parallel-system pairs from AUTH/THEME/PAYMENTS forensics, and the schema-level duplicates/orphans/dead-migrations from `DATABASE_FORENSIC_AUDIT.md` (DUP-1…9, §6 orphans, A-1…8, DB-001…025).
3. **Dependent-graph proof.** For every candidate, `grep -rIl '@letbuyy/<pkg>'` (or the table/symbol name) across `apps services packages` excluding the artifact's own directory and `scripts/validators/`. **Zero non-self, non-validator importers ⇒ eligible for `SAFE_DELETE`.** A non-empty importer set ⇒ `DELETE_AFTER_MIGRATION` or `KEEP_TEMPORARILY`. All grep results in this register were run against the working tree on 2026-06-10 and are reproduced in the Evidence column.
4. **Classify** with the verbatim legend below.
5. **Wave-assign** consistent with the cross-cutting sequencing law (A0 spine): S0 security/deploy first, then money-correctness, then tenancy/architecture true-up + governance retarget, then product completeness, then theme-Liquid + design-debt.

### Classification legend (verbatim)

| Class | Meaning |
|---|---|
| **SAFE_DELETE** | No production importers, no value. Delete after a zero-importer proof + build/test green. Cheapest; goes first. |
| **DELETE_AFTER_MIGRATION** | Wired into a live path **today**. Delete only once the Strategic Winner replaces it and the importer count returns to zero. Gated on a named predecessor. |
| **KEEP_TEMPORARILY** | A transitional bridge that must stay until a later wave (it is load-bearing during migration). Not deleted in this program's early waves; scheduled for a named trigger. |
| **CANONICAL** | It is a Strategic Winner. Keep. Listed here only where a forensic doc mistook it for legacy, or where its *legacy sibling* needs disambiguation. |
| **FROZEN** | Rejected-for-envelope but an empty seam is retained; reconsider at a named business trigger (≈5k merchants / developer demand). Not deleted, not extended. |

### Dead-vs-wired evidence summary (the load-bearing greps)

| Candidate | Non-self, non-validator importers (2026-06-10) | Verdict basis |
|---|---|---|
| `@letbuyy/app-engine` | **0** | dead |
| `@letbuyy/application-services` | **0** | dead (but named `workflowAuthority` in 13 manifests → retarget first) |
| `@letbuyy/extension-host` | **0** | dead |
| `@letbuyy/projection-runtime` | **0** | dead |
| `@letbuyy/orchestration` | 9 — all inside dead `application-services/*` | transitively dead |
| `@letbuyy/distributed-runtime` | 15 — all inside dead `orchestration/*` + `projection-runtime/*` | transitively dead |
| `@letbuyy/runtime-composition` | `storefront-runtime/.../store/[subdomain]/page.tsx`, `api-gateway/execution/queue-execution.adapter.ts`, `queue-workers/platform-queue-consumer.ts` (+2 gateway tests) | **WIRED — DELETE_AFTER_MIGRATION** |
| `@letbuyy/search-core` | `api-types/src/index.ts:92` (`export *`) + dead `application-services` | leaked into active surface |

---

## 2. Executive Summary

**291-issue ecosystem audit reduced to the deletion question:** what in this tree is legacy, and what is safe to remove? The repository carries two of nearly everything — two constitutions, four identity implementations, two theme renderers, two ledger paradigms, two tenant keys on `orders`, two user tables, 13,345 LOC of rejected CQRS/saga packages that nothing imports, ~15.3k LOC of an abandoned Firebase backend, ~37 product-dead tables, 36 validators that certify a distributed system that does not exist, and 92 root documents competing for "what is the topology." The Strategic Winners are settled (A0–A9). This register names the losers and grades their removability.

**Classification counts (this register, 78 rows LEG-001…LEG-078; counted from the table cells):**

| Classification | Count | Share | Row IDs |
|---|---:|---:|---|
| **SAFE_DELETE** | **19** | 24% | LEG-001…006, 009, 050, 061, 062, 063, 065, 066, 067, 071, 073, 074, 075, 078 |
| **DELETE_AFTER_MIGRATION** | **44** | 56% | LEG-007, 008, 010, 011, 022…043 (excl. 044), 045, 046, 047, 051…056, 058, 059, 060, 064, 068, 069, 072, 076, 077 |
| **KEEP_TEMPORARILY** | **11** | 14% | LEG-012…019 (reserved/frozen-empty), 044, 048, 057 |
| **FROZEN** | **2** | 3% | LEG-020 (app-marketplace), 021 (developer-portal) |
| **CANONICAL** (disambiguation) | **2** | 3% | LEG-049 (theme-marketplace machinery), 070 (deprecated-alias deny-list) |
| **Total** | **78** | 100% | — |

> Note on the split: **DELETE_AFTER_MIGRATION dominates (56%)** because the highest-LOC dead artifacts (the rejected package cluster, the orphan tables) are zero-importer and small-in-count, while the *wired* legacy systems (4 identity paths, 5 money paths, 5 schema duplicates, theme forks) are each individually a `DELETE_AFTER_MIGRATION` row gated on a winner. By **deletable LOC**, SAFE_DELETE is far larger than its row-count share (see headline volume below).

**Headline deletable volume (SAFE_DELETE, no winner required):**

- **~13,345 LOC** of rejected CQRS/saga/extension packages (`app-engine`, `application-services`, `extension-host`, `projection-runtime`, `orchestration`, `distributed-runtime`) — zero production importers.
- **~15,323 LOC** of `legacy/firebase` — an entire abandoned backend (wallet/commission/settlement/notifications).
- **974 LOC** of the mobile parity catalog (TD-5) + its route.
- **~36 rejected-architecture validators** (of 187) certifying replay/projection/saga/CRDT/failover/WAL/lease that no runtime runs.
- **~37 product-dead Postgres tables** (theme-legacy, ops-theater, diagnostics) ≈ 9% of the 419-table surface.
- **8 partition-shadow tables**, **1 dead Dart facade package**, **1 duplicate staging workflow**, **k8s/Helm fantasy infra** (0 workflow refs), **~60+ superseded root governance docs**.

**Largest DELETE_AFTER_MIGRATION items and what each gates on:**

- `runtime-composition` → gates on the storefront query-layer moving into the monolith/storefront (A6).
- Gateway `routes/auth.ts` session minting + `identity-foundation` shadow stack (3,096 LOC combined) + legacy Supabase `/auth/*` → gate on `identity-platform` becoming sole issuer with asymmetric keys (A1).
- Legacy un-ledgered money paths + 4 compat "ledger" tables + mutable balances + hardcoded `razorpayx` rail → gate on the canonical double-entry ledger (139–161) becoming the single source of truth and PA-split rail going live (A3).
- The React section-registry renderer (live) → gates on Liquid reaching parity (A5); **frozen, not deleted**, because it is the live read path today.
- `users`/`users_custom`, `orders.store_id`/`site_id`, JSONB↔relational dual models → gate on schema canonicalization migrations (A2/DB).

**The deletion meta-blocker (A0):** `main` is ~30 commits behind the fix branch; nothing ships. No deletion that requires a deploy can be validated end-to-end until the merge pipeline is fixed. This is Wave-0 for the whole program and is a hard predecessor of every `DELETE_AFTER_MIGRATION` row.

---

## 3. The Legacy Eradication Register

> **Columns:** ID · System/Path · Type (duplicate / dormant / dead / parallel / obsolete / scaffold / partially-migrated) · Classification · Replaced-by (the winner) · Importer/dependent evidence (path) · Wave · Notes.
> **Waves** map to the program roadmap: **W0** deploy/security unblock · **W1** money-correctness · **W2** tenancy + architecture true-up + governance retarget · **W3** product completeness · **W4** theme-Liquid + design/perf debt · **W5** schema canonicalization + long-tail.
> Anchor refs (A0–A9) and forensic IDs (TOPO/ARCH/DB/AUTH/THEME/PAY) are in Notes for traceability.

### 3.1 Dead packages — rejected CQRS / saga / extension scaffolding (A9)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-001 | `packages/app-engine` (2 files, 2,190 LOC) | dead | **SAFE_DELETE** | nothing (capability absent from envelope) | `grep @letbuyy/app-engine apps services packages` = **0** non-self/non-validator; only `beta-readiness-validator.mjs` | W2 | A9 DEAD list; TOPO-008. `src/index.ts` is a 2,084-line god-file. |
| LEG-002 | `packages/application-services` (12 files, 1,078 LOC) | dead | **SAFE_DELETE** | service API contracts in-monolith | `grep` = **0** app/service importers; only re-exports `@letbuyy/orchestration`. Named `workflowAuthority` in 13 `runtime.manifest.json` → manifests must be retargeted first (see LEG-064) | W2 | TOPO-014. "Workflow authority" that nothing calls; deletion gated on manifest slim-down (DEL cross-ref). |
| LEG-003 | `packages/extension-host` (1 file, 358 LOC) | dead | **SAFE_DELETE** | nothing (R-11 rejects app-functions runtime) | `grep @letbuyy/extension-host` = **0**; validators only | W2 | A9 DEAD; V1 R-11. |
| LEG-004 | `packages/projection-runtime` (15 files, 1,023 LOC) | dead | **SAFE_DELETE** | nothing (R-5 rejects CQRS projections) | `grep @letbuyy/projection-runtime` = **0** non-self; imports `distributed-runtime` intra-cluster | W2 | A9 DEAD; V1 R-5. |
| LEG-005 | `packages/orchestration` (13 files, 1,393 LOC) | dead (transitive) | **SAFE_DELETE** | nothing (R-4 rejects general saga engine) | only importer = dead `application-services/*` (9 files); zero live importers | W2 | A9 DEAD; transitively dead once LEG-002 goes. |
| LEG-006 | `packages/distributed-runtime` (74 files, 7,303 LOC) | dead (transitive) | **SAFE_DELETE** | nothing (R-4/R-5/R-13) | only importers = dead `orchestration/*` (4) + dead `projection-runtime/*` (11); zero live importers | W2 | A9 DEAD; largest single dead artifact. 74 `*-runtime.ts` files of CQRS/CRDT/saga/control-plane. |
| LEG-007 | `packages/search-core` (4 files, 47 LOC) | dormant (leaked) | **DELETE_AFTER_MIGRATION** | search capability stays in monolith; reserved `search-service` empty | leaked via `api-types/src/index.ts:92` (`export * from '@letbuyy/search-core'`) consumed by `api-gateway`, `marketing-site`; also dead `application-services` | W2 | TOPO-026. Replace `export *` with explicit used-type exports (LEG-063), then this drops to 0 importers → SAFE. |

### 3.2 Dormant / wired-rejected packages (A6, A9)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-008 | `packages/runtime-composition` (15 files, 1,119 LOC) | parallel (rejected, wired) | **DELETE_AFTER_MIGRATION** | storefront query-layer moved into `storefront-runtime`/monolith (A6) | **WIRED:** `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:7` (`composeStorefrontRuntimeProjection`), `api-gateway/src/execution/queue-execution.adapter.ts:16`, `queue-workers/src/platform-queue-consumer.ts:16` | W2 | A6/A9; TOPO-005. The freeze's "dormant" claim is fiction for this package — it is on the production storefront read path. Unwire FIRST. |
| LEG-009 | `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` | dead | **SAFE_DELETE** | `event-core` typed catalog | R-4 rejects schema-registry infra; adapter is dead-weight surface | W2 | ARCH-027. Fold any minimal version-check into `event-core`, then delete. |
| LEG-010 | `services/api-gateway/src/graphql/` (6 files; `schema.ts` 1,835 LOC) | obsolete (dead-by-flag in prod) | **DELETE_AFTER_MIGRATION** | REST routes (V1 scope) | `FEATURE_GRAPHQL="false"` in prod (`wrangler.toml:239`), `"true"` in staging (`:36`); mounted `index.ts:78-80,320` | W3 | TOPO-018, ARCH-028. Ships in the prod Worker bundle but never executes in prod. ARB-record or build-exclude+delete. |
| LEG-011 | `services/api-gateway/src/extensions/app-functions-runtime.ts` (623 LOC) | obsolete (dead-by-flag; R-11) | **DELETE_AFTER_MIGRATION** | nothing (R-11 rejects app-functions in money path) | `FEATURE_EXTENSIONS="false"` prod / `"true"` staging (`wrangler.toml:240/37`); CHK side-door risk in the live payment route | W3 | A4 DEAD (checkout-extensions in payment route); TOPO-018. |

### 3.3 Reserved services & frozen apps (A9)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-012 | `services/checkout-runtime` (2 files, 0 LOC) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | capability in `api-gateway` monolith | manifest-only; `AGENTS.md`+`runtime.manifest.json` only | — | A9 FROZEN-empty. Stays manifest-only. Not deleted (it is the named future seam); not extended. |
| LEG-013 | `services/event-bus` (2 files, 0 LOC) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | transactional outbox + typed catalog (A9 events winner) | manifest-only on disk; **but falsely declared `environment:"production"`** in `config/runtime/production-topology.json:117-127` with Helm manifests (LEG-066) | — | A9; TOPO-013. The directory stays; its fabricated production-topology entry is SAFE_DELETE (LEG-066). |
| LEG-014 | `services/notification-service` (2 files) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | `notification-core` + `queue-workers` | manifest-only | — | A9. |
| LEG-015 | `services/analytics-pipeline` (2 files) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | `queue-workers` analytics jobs | manifest-only | — | A9. |
| LEG-016 | `services/media-service` (2 files) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | media handling in monolith | manifest-only | — | A9. |
| LEG-017 | `services/search-service` (2 files) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | search in monolith | manifest-only | — | A9. |
| LEG-018 | `apps/mobile/shopper-app` (2 files, 0 LOC) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | n/a (reserved) | manifest-only | — | A7 FROZEN-empty. |
| LEG-019 | `apps/mobile/operator-app` (2 files, 0 LOC) | dormant (reserved) | **KEEP_TEMPORARILY** (frozen-empty) | n/a (reserved) | manifest-only | — | A7 FROZEN-empty. |
| LEG-020 | `apps/app-marketplace` (107 files, 19,557 LOC) | obsolete-scope (V1-rejected, deployed) | **FROZEN** | n/a (R-11 rejects for envelope) | deployed via `production-deploy.yml:363-364`; imports `billing-core` | W2 | A9 FROZEN; TOPO-004. Keep the OAuth2/PKCE seam; gate OUT of the production deploy matrix; do NOT delete the code (reconsider at ≈5k merchants). Net change = stop deploying, freeze investment. |
| LEG-021 | `apps/developer-portal` (31 files, 4,903 LOC) | obsolete-scope (V1-rejected, deployed) | **FROZEN** | n/a (R-11) | deployed `production-deploy.yml:365-366`; **no local `vercel.json`**; absent from staging matrix | W2 | A9 FROZEN; TOPO-004/033. Gate out of prod matrix; freeze. |

### 3.4 Internal / platform console consolidation (A9)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-022 | `apps/platform-console` (56 files, 5,983 LOC) | duplicate (over-build) | **DELETE_AFTER_MIGRATION** | ONE V1 "thin ops sliver" (pick one console as canonical) | deployed `production-deploy.yml:367-368`; own AGENTS.md self-describes "Super admin scaffold" | W3 | A9: consolidate 2 consoles → 1. **One of {platform-console, platform-operations-portal} survives as the thin sliver; the other is LEGACY.** Decision row — see LEG-023. |
| LEG-023 | `apps/platform-operations-portal` (52 files, 4,044 LOC) | duplicate (over-build) | **DELETE_AFTER_MIGRATION** | the surviving consolidated ops sliver | deployed `production-deploy.yml:369-370`; self-describes "Employee portal scaffold" | W3 | A9. The non-surviving console of the LEG-022/023 pair is deleted after the refund/maker-checker/dispute/KYC sliver lands in the survivor. ARB picks the survivor. |

### 3.5 Parallel identity / auth systems (A1)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-024 | `services/api-gateway/src/routes/auth.ts` (1,441 LOC) — session minting + `/auth/signin\|signup\|otp` | parallel (legacy issuer) | **DELETE_AFTER_MIGRATION** | `identity-platform` as SOLE issuer (A1) | mounted `api-gateway/src/index.ts:662-670`; on the live request path | W2 | A1 LEGACY; AUTH-011, TOPO-007. Public Supabase JWT path with no rotation/CSRF. Delete after identity-platform owns merchant/staff login. |
| LEG-025 | `services/api-gateway/src/identity-foundation/` (18 files, 1,655 LOC; `oauth-skeleton.ts`, `csrf-scaffold.ts`, `admin-mfa-scaffold.ts`, `shadow-compare.ts`, `token-shadow.ts`, `mock-key-service.ts`…) | parallel (shadow stack) + scaffold | **DELETE_AFTER_MIGRATION** | `identity-platform` (A1) | **WIRED:** `api-gateway/src/middleware/auth.ts:19` imports `auth-verifier-registry`; backed by migration `159_identity_foundation_core.sql` | W2 | A1 LEGACY; TOPO-007. "Two parallel systems" shadow. Live *scaffolding* on the request path. Delete after identity-platform is sole verifier. |
| LEG-026 | Legacy Supabase `/auth/password/reset` (`auth.ts:1399-1413`) | parallel (second reset pipeline) | **DELETE_AFTER_MIGRATION** | custom single-use + `destroyAllUserSessions` reset (A1) | `supabase.auth.resetPasswordForEmail`; different token guarantees, no session-kill | W2 | A1; AUTH-010. Two reset flows with different invalidation guarantees. |
| LEG-027 | Legacy Supabase `/auth/*` public surface (signin/signup/otp/password) | parallel (legacy realm) | **DELETE_AFTER_MIGRATION** | identity-platform OTP + host-scoped cookies (A1) | `index.ts:662-670` coarse rate-limit; `supabase.auth.updateUser` role-escalation oracle (AUTH §) | W2 | A1; AUTH-011/022. The Supabase-native auth regime; retire once identity-platform issues all realms. |
| LEG-028 | `/api/auth/switch` takeover path (`apps/identity-platform/src/app/api/auth/switch/route.ts` at HEAD) | obsolete (vulnerable) | **DELETE_AFTER_MIGRATION** (replace-in-place) | the working-tree fixed `route.ts` (rate-limit→CSRF→valid-session→proven-account) | HEAD `c4fc3cd6` mints a session for any verified email; fix is **uncommitted** + test `auth-switch-guard.test.ts` untracked | W0 | A1 DEAD-now (S0); TOPO-001. Commit + deploy the fix immediately; the dead code is the *old* behavior, removed by the in-place fix. |
| LEG-029 | Six identity contract micro-packages: `packages/{identity,session,token,permission,organization,audit}-core` (334 LOC total) | duplicate (over-decomposition) | **DELETE_AFTER_MIGRATION** | fold into `auth-core` with sub-path exports (A1/A8 single-source spirit) | each consumed only by `api-gateway` (+ each other); `identity-core` consumed by audit/org/permission/session/token-core | W2 | TOPO-029. 6 package.json/tsconfig/AGENTS pipelines for ~5 files of types. Merge then delete the shells. |
| LEG-030 | Per-app hand-rolled session libs: `merchant-control-plane/src/lib/auth/session.ts` (166), `storefront-runtime/src/lib/session.ts` (129), `platform-console/src/lib/console-session.ts` | duplicate (4 forks) | **DELETE_AFTER_MIGRATION** | `auth-core` session helpers (A1) | four hand-rolled session libs in four deployed apps; none sourced from `auth-core` | W2 | TOPO Duplicate-Systems #2. Replace with a single `auth-core` import per app, then delete the forks. |

### 3.6 Parallel money / ledger systems (A3)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-031 | Legacy capture RPC `confirm_order_payment_with_ledger` (baseline:1590) — writes NO `ledger_entries` | parallel (un-ledgered money path) | **DELETE_AFTER_MIGRATION** | canonical ledger post (`post_ledger_transaction`, 139) via an adapter (A3) | called by `checkout-payment-routes.ts:620`, `internal-payment-routes.ts:163`; `grep INSERT INTO ledger_ baseline` = 0 | W1 | A3; PAY-001 (S1). Misnamed "with_ledger" — does not write the ledger. Replace path with a real canonical post, then retire the legacy RPC. |
| LEG-032 | Legacy returns-refund RPC `complete_order_refund` (baseline:1039-1208) — un-ledgered | parallel (un-ledgered refund) | **DELETE_AFTER_MIGRATION** | canonical refund post (A3) | called `returns.ts:279`, `order-execution.adapter.ts:495`; touches no ledger table | W1 | A3; PAY-002 (S1). `refund_clearing` stays 0 while real refunds flow. |
| LEG-033 | COD remittance write `cod-reconciliation.ts:305` → only `wallet_ledger_entries`, never canonical `cod_receivable`/`cod_remittance` | parallel (compat-only path) | **DELETE_AFTER_MIGRATION** | canonical COD cash-in-transit modeling (A3) | `insertWalletCreditIfMissing` writes compat row only; no `post_settlement_ledger_transaction` in file | W1 | A3; PAY-003 (S1). |
| LEG-034 | `wallet_ledger_entries` (table, 119:44) — mutable single-entry "ledger" | parallel (compat ledger) | **DELETE_AFTER_MIGRATION** | canonical `ledger_*` (139); becomes an adapter target or retired | live write target on mobile money routes; bridged via `canonical_ledger_transaction_id` FK (151:42) + backfill (160:279) | W1→W5 | A3; DUP-4, PAY §. Mutable, has a `BEFORE UPDATE` sync trigger (160:137). Append-only by convention only. |
| LEG-035 | `partner_payout_ledger_entries` (baseline) — compat ledger | parallel (compat ledger) | **DELETE_AFTER_MIGRATION** | canonical `ledger_*` (A3) | single-entry mutable; no reject trigger | W5 | A3; PAY §. One of the 4 compat "ledger" tables. |
| LEG-036 | `gift_card_ledger_entries` (baseline:10225) + mutable `gift_card_accounts.balance` (baseline:9355) | parallel (compat ledger + mutable balance) | **DELETE_AFTER_MIGRATION** | gift cards as a tender on the canonical ledger (A3) | balance mutated in place `gift_card_accounts SET balance = balance - …` (baseline:1836); also DUP-8 precision mismatch (12,2 vs 10,2) | W5 | A3; PAY §, DUP-8. Move onto ledger as a tender, then retire. |
| LEG-037 | `store_credit_ledger_entries` (153:54) + mutable store-credit balance | parallel (compat ledger) | **DELETE_AFTER_MIGRATION** | store credit as a ledger tender (A3) | no reject trigger; mutable | W5 | A3; PAY §. |
| LEG-038 | `ai_credits` balance (baseline) — mutable | obsolete (mutable balance) | **DELETE_AFTER_MIGRATION** | AI credits as a ledger tender (A3) | mutable balance column; AI is a P2 seam anyway (R-15) | W5 | A3. |
| LEG-039 | Hardcoded `razorpayx` payout rail (`payouts.ts:120`; `queue-execution.adapter.ts:151`; `app-store/shared.ts:322`) | obsolete (R-6 violation) | **DELETE_AFTER_MIGRATION** | PA-split mirror (`razorpay_route`/Cashfree) — LetBuyy never custodies (A3) | `payoutRail()` returns `'razorpayx'`; metadata falsely stamps `no_custody:true`/`instruction_only:true` (settlements.ts:249,298) | W1 | A3 DEAD; PAY-014 (S1). Self-custody breach. Switch rail to split-instruction, then delete the razorpayx branch. |
| LEG-040 | Forgeable step-up check `security-controls.ts:27-83` (string-length + timestamp, no crypto/stored challenge) | obsolete (fake control) | **DELETE_AFTER_MIGRATION** | real crypto step-up with stored challenge (A3) | sole "auth" on refund/payout (`payments.ts:491`, `payouts.ts`); accepts any plausible string | W1 | A3 DEAD; PAY-018 (S1). Replace with real verification, then delete the stub. |
| LEG-041 | GUC-from-param cross-store posting `post_settlement_ledger_transaction` (151:23) | obsolete (tenancy bypass) | **DELETE_AFTER_MIGRATION** | derive tenant from ownership, not a param (A3/A2) | sets tenant GUC from its own parameter, neutralizing the inner cross-tenant guard; whole app posts through it | W1 | A3 DEAD; PAY-020 (S1). |
| LEG-042 | Live default 3% GMV rake (`commission_bps` default 300) + 18% GST-on-fee | obsolete (rejected pricing) | **DELETE_AFTER_MIGRATION** | `commission_bps=0`, permanent 0% fee (A3) | `payouts.ts:398-401`; contradicts marketing 0%-fee copy (`FAQ.tsx:17-18`) | W1 | A3 DEAD; ARCH-001/025. Set default 0; it is a config/migration change, not a code deletion, but the rake *logic* is retired. |
| LEG-043 | 32-bit `integer` paise columns (overflow at ₹2.14cr) + `numeric`-rupee money columns | obsolete (wrong representation) | **DELETE_AFTER_MIGRATION** | `bigint` minor units (paise) everywhere (A3) | legacy money columns across baseline; new kernel is bigint-minor | W5 | A3; DB-002/003. Migrate values to `_bigint` shadow then retire the old columns. |

### 3.7 Theme system — React-vs-Liquid renderers & dual drafts (A5)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-044 | `apps/storefront-runtime/src/lib/theme-engine/` React renderer-registry + composition fork (9 files, 1,849 LOC; `renderer-registry.tsx`, `composition-engine.tsx`, `template-resolver.ts`, `data-binding-engine.ts`) | parallel (live first-party renderer) | **KEEP_TEMPORARILY** (freeze; transitional fast-path) | Liquid-first OS-2.0 renderer in `theme-engine` (A5) — DEFERRED to W4 | **LIVE read path** — the only renderer that runs; `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (`theme-governance.ts:14`) | W4 | A5; THEME-002/003. **Explicitly NOT deleted for completeness** (directive's test). Freeze to NEW sections; designate ONE seam; delete only once Liquid hits parity. |
| LEG-045 | Duplicate storefront-local section schemas `RUNTIME_SECTION_SCHEMAS` + `schemaFor()` (`renderer-registry.tsx:66`) re-declaring productDetail/featured/about/portfolio | duplicate (schema fork) | **DELETE_AFTER_MIGRATION** | `theme-engine` `BUILT_IN_SECTION_SCHEMAS` (24) as single source | storefront re-declares ~11 schemas locally instead of consuming the engine's | W4 | A5; THEME §7. Consume engine schemas, then delete the local re-declarations. |
| LEG-046 | Duplicate storefront compose logic `resolveStorefrontTemplate` + `template-resolver.ts` (re-implements sort/visibility/group vs engine's `composeStorefrontTheme`) | duplicate (compose fork) | **DELETE_AFTER_MIGRATION** | engine `composeStorefrontTheme` (`execution-runtime.ts:288`) | both sort `isVisible`+`order`; storefront duplicates compose instead of calling engine | W4 | A5; THEME §7. |
| LEG-047 | `theme_editor_drafts` table (baseline) — legacy draft store | duplicate (dual draft systems) | **DELETE_AFTER_MIGRATION** | `theme_instance_drafts` + `theme_draft_patches` (new draft spine) | `saveDraft` writes legacy draft **and** instance-draft **and** a patch (themes route :475); 3 code files ref each | W4 | A5; THEME §6. Dual-written today; cut the legacy write, backfill, then drop the table. |
| LEG-048 | Orphaned engine renderer classes `LiquidRenderer`/`JsonContractThemeRenderer`/`createThemeRenderer` while Liquid is flag-off | dormant (road-not-taken) | **KEEP_TEMPORARILY** | become the canonical renderer when Liquid lands (A5) | only importer = `apps/storefront-runtime/.../composition-engine.tsx`; otherwise unexercised | W4 | A5; THEME §2b/§7. These are the *winner's* code, currently dead behind the flag — KEEP, do not delete. Resolve under the single-renderer decision. |
| LEG-049 | `theme-marketplace` near-empty catalog (production seeds only `urban-kicks`) | dormant (under-stocked machinery) | **CANONICAL** (machinery) / dormant (catalog) | seed at demand (A5) | machinery is real (upload/install/purchase/reviews); `verification/055_only_urban_kicks_theme_catalog.sql` | — | A5; THEME-008. CANONICAL machinery — DO NOT delete; the *catalog* is dormant-by-design. Disambiguation row. |
| LEG-050 | 6 superseded theme tables: `theme_templates`, `theme_assets`, `theme_layouts`, `theme_presets`, `theme_block_definitions`, `theme_section_definitions` | obsolete (superseded model) | **SAFE_DELETE** (DDL) | `theme_instances`/`theme_packages`/`theme_renderer_manifests` (current model) | 0 code refs (DB §6.1, HIGH confidence); runtime uses the instance/package model | W5 | DB §6.1/DB-025. Drop after confirming no out-of-band writers; archive DDL. |

### 3.8 Duplicate schemas & dead/duplicate migrations (A2, DB)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-051 | Dual tenant key on `orders`: `store_id` ≡ `site_id` + `sync_orders_tenant_keys` trigger (130:14-31) | duplicate (always-equal columns) | **DELETE_AFTER_MIGRATION** | single `site_id` canonical; `store_id` → generated/compat then retired (A2) | both NOT NULL, forced equal by trigger; spans migrations 108/130/158 | W5 | A2; DUP-1/DB-017 (TD-7). Two columns kept identical by a trigger with no end date. |
| LEG-052 | Dual user tables `users` vs `users_custom` | duplicate (split identity) | **DELETE_AFTER_MIGRATION** | `users_custom` canonical; expose `users` as a view (A2) | FKs across schema point at `users_custom` (e.g. 091 `created_by`); `users` is profile-only | W5 | A2; DUP-2/DB-018 (TD-7). |
| LEG-053 | Dual session tables `sessions` vs `sessions_v2` (159:113) | duplicate (successor dormant) | **DELETE_AFTER_MIGRATION** | one session model under identity-platform (A1) | 161 says "current sessions table remains authoritative"; `sessions_v2` referenced only by identity-foundation boundary (dormant) | W2 | A1; DUP-3. Tied to LEG-025 retirement. |
| LEG-054 | Dual payment row `payments` (142:43) vs `payment_transactions` (baseline) | duplicate (dual payment truth) | **DELETE_AFTER_MIGRATION** | single payment session model `payments` (A3) | linked via `payment_transactions.payment_id` FK (142:81); both carry `provider_payment_id` with separate uniques | W5 | A3; DUP-5. Legacy capture writes `payment_transactions`; new API writes `payments`. |
| LEG-055 | `orders.items` JSONB vs `order_items` relational (permanent dual model) | duplicate (JSONB↔relational) | **DELETE_AFTER_MIGRATION** | `order_items` relational authoritative; drop JSONB (A4) | `085_orders_items_reconcile` declares relational authoritative but keeps JSONB "for rollback/compatibility"; reconcile is report-only | W5 | DB DUP-6/A-8. Tech-debt frozen as architecture; converge then drop JSONB. |
| LEG-056 | `products` embedded variants JSONB vs `product_variants` relational | duplicate (JSONB↔relational) | **DELETE_AFTER_MIGRATION** | `product_variants` relational (A4) | `086_products_variants_reconcile` mirror of 085 | W5 | DB DUP-7. |
| LEG-057 | 8 partition-shadow tables: `*_partitioned` + `*_partitioned_default` for outbox/webhook/queue/telemetry/worker-logs (079–083, 131) | duplicate (deferred-partition seam, now active-mirroring) | **KEEP_TEMPORARILY** | n/a — partitioning DEFERRED to P2 (V1 §5) | mirrored by trigger (131:9-56) ahead of an unexecuted rename swap; doubles writes | W5 | DB DUP-9; ARCH-031. Allowed seam, but the 131 *active mirror* doubles write amplification — keep the seam, disable the mirror (see SAFE_DELETION DEL for the cron/trigger). |
| LEG-058 | Duplicate migration prefix `129` (`129_internal_os_executive_analytics_rollups.sql` + `129_mobile_customer_segments.sql`) | dead (collision) | **DELETE_AFTER_MIGRATION** (renumber) | renumber one with a ledger note (DB hygiene) | both files exist; Supabase versions by numeric prefix → version-collision risk | W5 | A-1; ARCH-015. Not a code delete — a rename to remove the collision; one file's number is "deleted." |
| LEG-059 | Migrations 138, 140, 157 with no paired rollback | dead (missing rollback path) | **DELETE_AFTER_MIGRATION** (author the missing rollbacks) | forward+rollback pairing ≥138 (V1 §7) | `rollback/` has 21 files vs 24 forwards ≥138 | W5 | TOPO-011; ARCH-014. The *missing* rollback is the defect; "delete" = close the gap + add the pairing validator. |
| LEG-060 | Forward-only `ADD COLUMN` residue in 151/160 rollbacks (`canonical_ledger_transaction_id`, `_bigint`) | dead (incomplete rollback) | **DELETE_AFTER_MIGRATION** (add `DROP COLUMN`) | symmetric rollbacks (V1 §7) | 151:38-46 vs 151.rollback; 160:28-40 vs 160.rollback | W5 | DB-008. Add the missing drops. |
| LEG-061 | ~37 product-dead Postgres tables (theme-legacy ×6 in LEG-050; ops-theater `provider_*`/`*_operation_snapshots`/`replay_*`/`rollout_*`/`shadow_traffic_*`/`failover`/`chaos`/`load_test`; diagnostics `dual_model_reconciliation_reports`, `inventory_level_duplicate_snapshots`; `plan_entitlements`, `collection_products`) | dead (orphan tables) | **SAFE_DELETE** (DDL, after writer confirmation) | n/a (no winner — pure dead weight) | DB §6.1 zero-reference orphans (43 listed; ~37 genuine after removing 4 RPC-mediated + 4 partition-default false positives) | W5 | DB §6.1/DB-025. ~9% of the 419-table surface. Drop after live-DB writer confirmation; archive DDL. |
| LEG-062 | Duplicate `provider_payment_id` unique index under two names (107:135 `idx_…_global` ≡ 142:148 `…_v1_uniq`) | duplicate (redundant index) | **SAFE_DELETE** (drop one) | one unique index | same predicate `(gateway, provider_payment_id) WHERE … IS NOT NULL AND deleted_at IS NULL` | W5 | A-6; DB §7.2. Harmless redundancy; drop the duplicate name. |

### 3.9 Dead governance layer — validators, manifests, fantasy infra (A0)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-063 | ~36 rejected-architecture validators (of 187): `replay-*` (10), `projection-*` (5), `saga-recovery`, `crdt-convergence`, `convergence-*`, `distributed-*` (7), `failover-certification`, `wal-*`, `lease-*`, `fencing-token`, `split-brain`, `partition-recovery`, `execution-layer`, `multi-region` survivability | dead (governance theater) | **SAFE_DELETE** | retargeted validators that enforce V1 conformance (A0) | certify R-4/R-5/R-13 concepts no runtime runs; some are the ONLY consumers of the dead packages (LEG-001…006) | W2 | A0; TOPO-024, ARCH §. **Delete order matters:** these validators must go *with or just before* the dead packages they assert (validator-liveness loop), else `validate-governance.mjs` breaks. |
| LEG-064 | Runtime manifest authority prose: `workflowAuthority`/`orchestrationAuthority`/`replayOperationsOwnership`/`observabilityInfrastructureOwnership` keys in all 13 `runtime.manifest.json` pointing at dead `application-services`, empty `event-bus`, unprovisioned Grafana/Tempo/Loki/Prometheus | dead (governance fiction) | **DELETE_AFTER_MIGRATION** | slim manifest schema (root, platform, deploy config, deps only) | e.g. `developer-portal/runtime.manifest.json:65,71,73`; same keys in all manifests; consumed by `runtime-manifest-validator.mjs` | W2 | A0; TOPO-014. **Must be retargeted before LEG-002/005/006 delete** (manifests name `application-services` as authority). Slim schema, then the dead packages lose their last named dependent. |
| LEG-065 | `production-topology.json` declaring 6 reserved services as `environment:"production"` with Helm `deploymentManifests` backed by dead `distributed-runtime` | dead (fabricated topology) | **SAFE_DELETE** (regenerate from deploy matrix) | topology derived from actual `.github/workflows` deploy matrix | `config/runtime/production-topology.json:117-127` + 5 siblings; `deployment-topology.json` reserved nodes with scaling/health | W2 | A0; TOPO-013. Mark reserved roots `reserved`, never `production`; delete Helm references. |
| LEG-066 | `infrastructure/deployment/kubernetes/` (namespace/quota 16 CPU/64Gi/120 pods) + `infrastructure/deployment/helm/letbuyy-production/` Chart | dead (fantasy infra) | **SAFE_DELETE** (→ `docs/archive/`) | n/a — platform deploys to Cloudflare Workers + Vercel only | `grep helm\|kubectl .github/workflows` = **0**; referenced only by `production-topology.json` (LEG-065) + one validator | W2 | A0; TOPO-015. Aspirational K8s/Helm for a serverless platform. Move to archive. |
| LEG-067 | `.github/workflows/deploy-staging.yml` (duplicate of `staging-deploy.yml`) | duplicate (double-deploy race) | **SAFE_DELETE** | single staging workflow (`staging-deploy.yml` + app matrix) | both trigger `push→develop`; overlapping scope, different matrices → nondeterministic staging | W0 | TOPO-016. Three staging workflows exist (`deploy-staging`, `staging-deploy`, `staging-runtime-deployment`); collapse to one. |
| LEG-068 | `hot-table-partition-maintenance.yml` scheduled prod cron (`cron "15 2 1 * *"`, `EXECUTE_MAINTENANCE=true`) | obsolete (V1-deferred capability armed) | **DELETE_AFTER_MIGRATION** (disable schedule) | partitioning DEFERRED to P2 (V1 §5/§7) | runs monthly prod-DB DDL for a deferred capability; keep `workflow_dispatch` plan-mode | W2 | TOPO-040. Disable the schedule; revisit at P2 trigger. Pairs with LEG-057 mirror disable. |
| LEG-069 | `SKIP_NEEDS_HUMAN` secret-shaped values as plaintext `[env.production.vars]` (`wrangler.toml:253-262`: WHATSAPP_WEBHOOK_SECRET, TWILIO_ACCOUNT_SID, AI_CREDIT_RAZORPAY_KEY_ID…) | obsolete (config smell) | **DELETE_AFTER_MIGRATION** (move to `wrangler secret`) | secret store; vars only for non-secrets | 74 `SKIP_NEEDS_HUMAN` repo-wide; preflight guards non-sentinel (`production-safety-preflight.json:9`) | W0 | TOPO-030. Honest+guarded, but secrets-shaped vars in the deploy unit. Migrate keys, then delete from vars. |

### 3.10 Deprecated aliases, orphans, doc sprawl, domain literals (A0)

| ID | System / Path | Type | Classification | Replaced-by | Importer / dependent evidence | Wave | Notes |
|---|---|---|---|---|---|---|---|
| LEG-070 | Deprecated app aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `consumer-storefront`, `operator-team-app`) | obsolete (deprecated topology) | **CANONICAL** (already absent — keep deny-list) | the V1 runtime map | **None exist on disk**; only deny-list entries in `governance-common.mjs:76-87` | — | A0; TOPO §3.3 PASS. Disambiguation row: nothing to delete; the deny-list validator is the winner and STAYS. |
| LEG-071 | `legacy/firebase/` (Firebase functions/rules: wallet/commission/settlement/notifications; ~15,323 LOC on disk) | dead (abandoned backend) | **SAFE_DELETE** (→ `docs/archive/firebase-legacy/`) | Supabase + Workers (current backend) | imported by nothing; frozen since 2026-05-25; not under `docs/archive/` where V1 puts history | W2 | TOPO-019. Precedent exists (`docs/archive/flutter-legacy`). `git mv` to archive. |
| LEG-072 | Mobile parity catalog `apps/mobile/merchant-app/lib/screens/parity/{merchant_feature_definitions,merchant_feature_screen}.dart` (974 LOC) + route | dead (TD-5, routed) | **DELETE_AFTER_MIGRATION** (remove route, then files) | real merchant screens (A7) | **routed:** `lib/app/routes.dart:59-60,764,774-776` (`MerchantFeatureDefinitions.byRoute` → `MerchantFeatureScreen`) | W3 | A7 DEAD; TOPO-012, ARCH-009. V1 §10 "removed outright." Remove the route case + imports, then delete both files; re-run `flutter analyze`. |
| LEG-073 | `packages/dart/services` (8-LOC facade; "removed in WS8 M5") | dead (phantom workspace member) | **SAFE_DELETE** | app-local services over `letbuyy_api_client` | absent from `merchant-app/pubspec.yaml:17-24`; only in root `pubspec.yaml` workspace list | W2 | TOPO-028. Delete package + workspace entry. |
| LEG-074 | `tasks/executable/001…016` (16 superseded Build-Mission task specs) | obsolete (superseded missions) | **SAFE_DELETE** (→ `docs/archive/`) | V1 Appendix C reconciliation | retained verbatim at root; some contradict V1 (e.g. 010 notifications-service activation vs R-2) | W2 | TOPO-038. Risk: agents execute superseded instructions. Stamp + archive. |
| LEG-075 | ~60+ superseded root governance/mission/ledger/status docs (21 `CODEX_*` triples, superseded `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`, 12 foundation-wave state docs, 33 audit/scorecard reports, the maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md`, the 9 root audit dirs) | obsolete (competing constitutions/ledgers) | **SAFE_DELETE** (→ `docs/archive/<date>/`) | ONE constitution = V1 + Freeze; ONE current STATUS (A0) | 92 root artifacts + 9 root audit dirs; ≥5 authority claimants; newest set untracked (`git status ??`) | W2 | A0; TOPO-020/037. Adopt a root-doc budget (constitution, README, CLAUDE, current STATUS). Commit-or-archive everything untracked; archive the superseded. |
| LEG-076 | Stale generated `AGENTS.md` (claims 19 migrations vs 91; encodes the rejected 9-app canon) | obsolete (stale constitution) | **DELETE_AFTER_MIGRATION** (regenerate from V1) | regenerated AGENTS.md expressing V1 §6 topology (A0) | `CLAUDE.md` ranks it first; `production-deploy.yml` implements its 9-app canon; never re-run since 2026-06-08 | W2 | A0; TOPO-003/021, ARCH-024. Not a file delete — a regeneration; the *rejected content* is removed. The generator + CLAUDE ranking are the real fix. |
| LEG-077 | `letbuyy.store` domain literals in active deploy code/config (143 files, 514 lines; split-brain `api.letbuyy.store` vs `bff.letbuyy.com`) | obsolete (partially-migrated domain) | **DELETE_AFTER_MIGRATION** (canonicalize to letbuyy.com) | `letbuyy.com` canonical + `.store` 301s (A0) | wrangler routes, vercel envs, dns.tf all pin `.store`; `bff.letbuyy.com` only migrated surface | W2 | A0; TOPO-006, ARCH-018. One migration PR + a validator banning `letbuyy.store` in deploy config. |
| LEG-078 | Repo clutter: `build/` (Flutter cache), `.tmp/` (empty), `test-results/`, `.codex/` (empty), `memory/lessons.md` (stale), 176 tracked screenshots in `artifacts/`, 319 PNG visual baselines, untracked `FOUNDER_CONTENT_ENGINE/` + `founder-journey/` | obsolete (build residue + non-eng IP) | **SAFE_DELETE** / gitignore | n/a | `git status`; `find build -type f` (dill caches) | W2 | TOPO-031/032/034. Gitignore caches, delete empties, move founder content out of the code tree, move proof/baselines to CI artifacts or LFS. |

---

## 4. Cross-references & traceability

- **Anchor coverage:** A0 (LEG-063…077), A1 (LEG-024…030, 053, 076), A2 (LEG-051, 052), A3 (LEG-031…043, 054), A4 (LEG-055, 056), A5 (LEG-044…050), A6 (LEG-008), A7 (LEG-018, 019, 072), A9 (LEG-001…023, 057).
- **Forensic ID coverage:** TOPO-001…041, ARCH-001/009/014/015/018/024/025/027/028/031, DB DUP-1…9 + §6.1 orphans + A-1/A-6/A-8 + DB-008/017/018/025, AUTH-010/011/022, THEME-001/002/003/008, PAY-001/002/003/014/018/020.
- **Every SAFE_DELETE and DELETE_AFTER_MIGRATION row** has a matching `DEL-xxx` block in `SAFE_DELETION_PLAN.md` with its gated, validated deletion procedure.

## 5. UNVERIFIED (and what would prove it)

- **`legacy/` git-tracked status from the workspace mount returned empty** for `git ls-files legacy/` (the Linux mount may not be the git root, or `legacy/` is gitignored there); the topology forensic reports **37 git-tracked files** at the real repo. On-disk content (15,323 LOC) is confirmed. *Proof:* `git ls-files legacy/` from `/Users/saai_sidd/Git/Letbuyy_Store`.
- **Live-DB writers for the ~37 orphan tables (LEG-061) and the 6 superseded theme tables (LEG-050)** cannot be confirmed code-only (some are RPC/ops-script written). *Proof:* live-DB `pg_stat_user_tables` write counts + audit-log scan before any `DROP`.
- **Full RLS/FORCE coverage per tenant table** (76/419 FORCE confirmed in migrations) needs live `pg_policies` introspection — relevant to whether dropping legacy tables changes the isolation surface.
- **Whether `pnpm turbo build` is currently green** across 50 workspaces (not executed; runtime > sandbox timeout). The dead-package deletions assume a green baseline.
- **Which of `platform-console` / `platform-operations-portal` survives** (LEG-022/023) is an ARB decision, not a code fact.
- **GraphQL/extensions/Liquid actual prod execution** (LEG-010/011/044) — flags are `false` in prod config, but live behavior is UNVERIFIED (no prod probe from this tree).

*End of Legacy Eradication Register. Evidence pinned at `stepup/main` @ `c4fc3cd6`, working tree dirty, 2026-06-10.*
