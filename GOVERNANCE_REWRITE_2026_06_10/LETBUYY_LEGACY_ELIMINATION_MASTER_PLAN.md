# LETBUYY LEGACY ELIMINATION MASTER PLAN — DESTROY THE PARALLEL UNIVERSES (DOC 04)

> **Document type:** Authority document — the legacy-elimination master plan. The operative, ordered, gated register of **every** duplicate, obsolete, deprecated, conflicting, or dead system in the tree, each with a verdict (**KEEP / MIGRATE / ARCHIVE / DELETE**), a replacement, a gate, a wave, a validation-before-delete, and evidence. This is how the platform collapses from "two of nearly everything" to one system per domain.
> **Date:** 2026-06-10 · **Author:** Architecture Review Board (ARB) · **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty.
> **Status:** Active law. The companion to DOC 03 (`LETBUYY_CANONICAL_SYSTEMS.md`) — DOC 03 names the winner per domain; **this document names every loser and the exact order in which it dies.**

---

## 0. Mission, mandate, and the prime directive

**Mission: destroy the parallel universes.** The repository carries two of nearly everything — two constitutions, four identity implementations, two theme renderers, two ledger paradigms, two tenant keys on `orders`, two user tables, ~13,345 LOC of rejected CQRS/saga packages that nothing imports, ~15,323 LOC of an abandoned Firebase backend, ~37 product-dead tables, ~36 validators that certify a distributed system that does not exist, and 60+ root documents competing for "what is the topology." DOC 03 settled which system wins in each domain. This plan eliminates the rest — in an order that never breaks a live path and never deletes a load-bearing thing before its replacement is proven.

**Authority-chain position (per `_GOVERNANCE_SPINE.md` §S2):** rank 4 — below the Constitution (DOC 01), AGENTS_V2 (DOC 02), and the Canonical Systems registry (DOC 03); above domain governance (DOC 06). On a "which system" question, DOC 03 wins; on a "how/when to remove the loser" question, **this document is the operative reference.**

### 0.1 The prime directive — NOTHING IS DELETED UNTIL VALIDATION IS GREEN

> **Rule X (inviolable).** No artifact in this plan is deleted until (a) its **pre-deletion validation gate** passes — at minimum a zero-importer proof + build/test green — and (b) for any `MIGRATE-then-DELETE` item, its **replacement (the DOC 03 winner) is LIVE and serving** and the legacy importer count has returned to **zero**. If validation is red, the deletion does not happen. There are no exceptions and no "it's obviously dead" shortcuts: even a zero-LOC phantom waits for its zero-importer proof.

Three corollaries:
1. **`DELETE` (zero-importer) items go first and cheap** — they need no winner, only proof of zero references (V-IMPORT) + a green build. They clear the deck before the harder migrations.
2. **`MIGRATE-then-DELETE` items never delete before their replacement is LIVE.** The Strategic Winner must be deployed and smoked, and the legacy importer count must be zero, before the legacy artifact is removed. The Gate column names the predecessor.
3. **Deletion happens on a branch, behind the deploy meta-blocker fix.** Because `main` is ~30 commits behind (the Wave-0 prerequisite), every deletion that needs a deploy is validated on `stepup/main` → `develop` → `main` only after the merge pipeline is restored.

### 0.2 The verdict scheme (the four verdicts + their mapping from the classification legend)

This plan reduces the five-class strategic legend to **four operative verdicts**. The mapping is exact and load-bearing:

| Strategic class (DOC 03 / matrix) | → Verdict here | Meaning |
|---|---|---|
| **CANONICAL** | **KEEP** | It is a winner. Do not touch (except to finish it). Listed here only to disambiguate a loser sibling or a deny-list that must stay. |
| **TRANSITIONAL** | **MIGRATE** (then retire the bridge) | A managed bridge — real today, kept only until the winner lands, then removed. Coexistence is permitted *only* under its named retirement gate. |
| **LEGACY** | **MIGRATE-then-DELETE** | Superseded and wired into a live path today. Migrate the path onto the winner, prove zero drift, then delete. Gated on the winner. |
| **FROZEN** / historical | **ARCHIVE** | Rejected-for-envelope (keep an empty seam) OR historical record. De-deploy / `git mv` to `docs/archive/`. Not deleted, not extended. |
| **DEAD** | **DELETE** | No value or actively dangerous; SAFE_DELETE / remove now (after a zero-importer proof). No winner required. |

> **Note on ARCHIVE vs DELETE for DEAD items.** A DEAD artifact that carries *historical or seam value* (the Firebase backend, the k8s/Helm charts, the maximalist 1M-merchant architecture doc, the 60+ superseded governance docs, the superseded mission specs) is **ARCHIVED** (`git mv` to `docs/archive/`), not destroyed — the company keeps its history. A DEAD artifact that is pure weight (the CQRS package cluster, fiction validators, duplicate index, dead tables) is **DELETED**. Both pass Rule X first.

### 0.3 The deletion-validation taxonomy (the six gates every removal passes a subset of)

| Code | Check | What it proves | How to run |
|---|---|---|---|
| **V-IMPORT** | Importer / dependent scan | Zero non-self, non-validator references (path, symbol, table, package). The core "it's dead / it's unwired" proof. | `grep -rIl '<name>' apps services packages --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.dart' \| grep -v '<own-dir>' \| grep -v 'scripts/validators/'` → empty. Tables: grep name across `*.sql,*.ts,*.dart,*.json`. |
| **V-BUILD** | Build green | The workspace typechecks + builds after removal. | `pnpm turbo build` (or scoped `--filter`); `flutter analyze` for Dart. |
| **V-TEST** | Test-suite green | Unit/contract/behavioral suites still pass. | `pnpm test` / `ci.yml` merge-safety-gate; `flutter test`; targeted suite. |
| **V-GOV** | Governance-validator green (after retarget) | `validate-governance.mjs` passes once the validators that asserted the deleted thing are removed/retargeted. Prevents the validator-liveness deadlock. | `node scripts/validate-governance.mjs` — AFTER the paired validator edit, never before. |
| **V-SMOKE** | Runtime smoke | The live path still serves after a `MIGRATE-then-DELETE` removal (the winner is carrying the traffic). | Deploy to staging; hit the affected route(s) — storefront render, login, capture, payout, theme draft save — confirm 200 + correct behavior. |
| **V-ROLLBACK** | Rollback (revert) validation | The deletion is reversible. | Dry-run `git revert --no-commit <sha>` then V-BUILD; for DB, apply the paired DOWN migration on a scratch DB. |

**Gate matrix by verdict:**
- **DELETE (code/package):** V-IMPORT → V-BUILD → V-TEST → V-GOV(if a validator referenced it) → commit → V-ROLLBACK.
- **DELETE (DB table/index):** V-IMPORT → live-writer confirmation → archive DDL → DROP in a paired migration → V-BUILD → V-ROLLBACK(DOWN restores).
- **MIGRATE-then-DELETE:** winner LIVE + V-SMOKE on winner → V-IMPORT returns to **0** → V-BUILD → V-TEST → V-GOV → V-SMOKE(legacy gone, winner serving) → commit → V-ROLLBACK.
- **ARCHIVE:** V-IMPORT(0 live importers) → `git mv` → V-BUILD → V-GOV. Reversible by `git mv` back.
- **MIGRATE (bridge):** no deletion until the winner lands; then it converts to a DELETE under its gate.

---

## 1. Headline: what is being eliminated (the volume)

**The 83-row loser register (LEG-001…083) reduced to four verdicts:**

| Verdict | Rows | What it covers |
|---|---:|---|
| **DELETE** (now, zero-importer / DEAD-now) | **15** | The 6 CQRS/saga packages, `schema-registry` adapter, 6 superseded theme tables (DDL), ~37 dead tables, duplicate index, ~36 fiction validators, duplicate staging workflow, fabricated topology.json, Dart phantom, repo clutter. |
| **ARCHIVE** (DEAD-with-history → `docs/archive/`) | **4** | `legacy/firebase` (~15.3k LOC), k8s/Helm fantasy infra, the 16 superseded mission specs, the 60+ superseded root governance docs. |
| **MIGRATE-then-DELETE** (LEGACY, wired today, gated on winner) | **49** | The 4 parallel auth impls, the un-ledgered money paths + 4 compat ledgers + mutable balances + razorpayx rail + 3% rake, the dual schemas, the theme schema/draft/compose forks, the client React cart, inventory side-doors, scalar discount RPC, hand-rolled navs, web token-source forks, the `.store` literals, `runtime-composition`, the GraphQL/extensions dead-by-flag code, the ops-console non-survivor, the TD-5 parity catalog. |
| **KEEP-FROZEN** (rejected-for-envelope seam; de-deploy, do not delete) | **13** | The 6 reserved services, `app-marketplace` + `developer-portal`, the React renderer, the orphaned Liquid renderer classes, the 8 partition-shadow tables. |
| **KEEP** (CANONICAL disambiguation / deny-list that stays) | **2** | The theme-marketplace machinery, the deprecated-alias deny-list. |
| **Total** | **83** | — |

**Headline DELETE volume (no winner required — DEAD-now, after Rule-X proof):**
- **~13,345 LOC** of rejected CQRS/saga/extension packages (`app-engine`, `application-services`, `extension-host`, `projection-runtime`, `orchestration`, `distributed-runtime`) — **zero production importers**. *(The biggest single deletion.)*
- **~15,323 LOC** of `legacy/firebase` — an entire abandoned backend — **ARCHIVED**, not destroyed.
- **974 LOC** of the mobile TD-5 parity catalog + its route.
- **~36 rejected-architecture validators** (of 187) certifying replay/projection/saga/CRDT/failover/WAL/lease that no runtime runs.
- **~37 product-dead Postgres tables** (~9% of the 419-table surface) + 6 superseded theme tables + 1 duplicate index.
- **1 duplicate staging workflow**, **1 dead Dart phantom package**, **the k8s/Helm fantasy** (0 workflow refs), **~60+ superseded root governance docs**.

**The meta-blocker (the universal precondition):** `main` is ~30 commits behind the fix branch; nothing ships. No deletion that requires a deploy can be validated end-to-end until the merge pipeline is fixed. **This is Wave 0 for the whole program and a hard predecessor of every `MIGRATE-then-DELETE` row.**

---

## 2. THE ELIMINATION REGISTER (every loser — verdict · replaced-by · gate · wave · validation · evidence)

> **Columns:** ID · System / Path · Type · **Verdict** · Replaced-by (the DOC 03 winner) · **Gate** (what must be LIVE/true first) · **Wave** · **Validate-before-delete** · Evidence (importer/dependent proof, pinned 2026-06-10).
> **Verdicts:** KEEP · MIGRATE · MIGRATE-then-DELETE · ARCHIVE · DELETE. **Waves** map to §3. Anchor refs (A0–A9) + forensic IDs (TOPO/ARCH/DB/AUTH/THEME/PAY) trace to the evidence base.

### 2.1 Dead packages — the rejected CQRS / saga / extension cluster (the biggest deletion) — A9

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-001 | `packages/app-engine` (2 files, 2,190 LOC) | dead | **DELETE** | nothing (capability absent from envelope) | validators retargeted (LEG-063); green build | W2a | V-IMPORT(0) → V-BUILD → V-TEST → V-GOV → V-ROLLBACK | `grep @letbuyy/app-engine` = **0** non-self/non-validator; only `beta-readiness-validator.mjs` |
| LEG-002 | `packages/application-services` (12 files, 1,078 LOC) | dead | **DELETE** | service API contracts in-monolith | manifests slimmed (LEG-064) so `workflowAuthority` no longer names it; LEG-005/006 ordering | W2a | V-IMPORT(0) → V-BUILD → V-TEST → V-GOV | `grep` = **0** app/service importers; only re-exports `@letbuyy/orchestration`; named `workflowAuthority` in 13 manifests |
| LEG-003 | `packages/extension-host` (1 file, 358 LOC) | dead | **DELETE** | nothing (R-11 rejects app-functions runtime) | extension validator retargeted (LEG-063) | W2a | V-IMPORT(0) → V-BUILD → V-GOV | `grep` = **0**; validators only |
| LEG-004 | `packages/projection-runtime` (15 files, 1,023 LOC) | dead | **DELETE** | nothing (R-5 rejects CQRS projections) | `projection-*` validators retargeted (LEG-063); delete WITH LEG-006 | W2a | V-IMPORT(0) → V-BUILD → V-GOV | `grep` = **0** non-self; imports `distributed-runtime` intra-cluster |
| LEG-005 | `packages/orchestration` (13 files, 1,393 LOC) | dead (transitive) | **DELETE** | nothing (R-4 rejects general saga engine) | LEG-002 removed first (its only importer); `saga-recovery-validator` retargeted | W2a | V-IMPORT(0 AFTER LEG-002) → V-BUILD → V-GOV | only importer = dead `application-services/*` (9 files); zero live importers |
| LEG-006 | `packages/distributed-runtime` (74 files, 7,303 LOC) | dead (transitive) | **DELETE** | nothing (R-4/R-5/R-13) | LEG-004/005 removed first; `distributed/replay/wal/lease/fencing/split-brain/partition` validators retargeted | W2a | V-IMPORT(0 AFTER LEG-004/005) → V-BUILD → V-TEST(delete the replay/chaos suites too) → V-GOV → V-ROLLBACK(single commit) | only importers = dead `orchestration/*`(4) + `projection-runtime/*`(11); zero live; **largest single dead artifact** |
| LEG-007 | `packages/search-core` (4 files, 47 LOC) | dormant (leaked) | **MIGRATE-then-DELETE** | search stays in monolith; reserved `search-service` empty | replace `api-types` `export *` with explicit exports; LEG-002 removed | W2b | V-IMPORT(0 after un-leak) → V-BUILD(api-gateway, marketing-site) → V-TEST | leaked via `api-types/src/index.ts:92` (`export * from '@letbuyy/search-core'`) into `api-gateway`/`marketing-site` |
| LEG-009 | `api-gateway/.../execution/schema-registry-execution.adapter.ts` | dead | **DELETE** | `event-core` typed catalog | fold any version-check into `event-core` first | W2a | V-IMPORT → V-BUILD → V-TEST → V-GOV(event-schema/versioning validators) | ARCH-027; R-4 rejects schema-registry infra |
| LEG-073 | `packages/dart/services` (8-LOC facade) | dead (phantom) | **DELETE** | app-local services over `letbuyy_api_client` | none | W2a | V-IMPORT(no Dart importer) → `melos bootstrap` → `flutter analyze` → `flutter test` | absent from `merchant-app/pubspec.yaml:17-24`; only in root `pubspec.yaml` workspace |

### 2.2 Dormant / wired-rejected packages & dead-by-flag code — A6, A9

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-008 | `packages/runtime-composition` (15 files, 1,119 LOC) | parallel (rejected, **WIRED**) | **MIGRATE-then-DELETE** | storefront query-layer moved into `storefront-runtime`/monolith (A6) | A6 query-layer migration LIVE; rewrite the 3 importers; V-IMPORT→0 | W2c | V-IMPORT(0) → V-BUILD → V-TEST → V-SMOKE(storefront renders; queue consumes) → V-GOV | **WIRED:** `storefront-runtime/.../store/[subdomain]/page.tsx:7`, `api-gateway/.../queue-execution.adapter.ts:16`, `queue-workers/.../platform-queue-consumer.ts:16` (+2 tests). **Unwire FIRST** — it is on the production read path |
| LEG-010 | `api-gateway/src/graphql/` (6 files; `schema.ts` 1,835 LOC) | obsolete (dead-by-flag in prod) | **MIGRATE-then-DELETE** | REST routes (V1 scope) | ARB scope decision (REST-only) OR build-exclude prod; no prod `/graphql` client | W3 | V-IMPORT → V-BUILD(smaller bundle) → V-TEST → V-SMOKE | `FEATURE_GRAPHQL="false"` prod (`wrangler.toml:239`), `"true"` staging; mounted `index.ts:78-80,320` |
| LEG-011 | `api-gateway/src/extensions/app-functions-runtime.ts` (623 LOC) | obsolete (dead-by-flag; R-11) | **MIGRATE-then-DELETE** | nothing (R-11 rejects app-functions in money path) | confirm the payment route has no live extension hook | W3 | V-IMPORT → V-BUILD → V-TEST → V-SMOKE(checkout has no extension side-door) | `FEATURE_EXTENSIONS="false"` prod / `"true"` staging; CHK side-door risk in the live payment route |

### 2.3 Reserved services & frozen apps — A9 (KEEP-FROZEN: de-deploy, do NOT delete)

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-012 | `services/checkout-runtime` (manifest-only, 0 LOC) | dormant (reserved) | **KEEP-FROZEN** | capability in `api-gateway` monolith | reopen at ~5k merchants (named trigger) | — | n/a (not deleted; its fabricated topology entry is deleted via LEG-065) | manifest-only; `AGENTS.md`+`runtime.manifest.json` only |
| LEG-013 | `services/event-bus` (manifest-only) | dormant (reserved) | **KEEP-FROZEN** | transactional outbox + typed catalog | reopen trigger | — | n/a | manifest-only on disk; **falsely `environment:"production"`** in `production-topology.json:117-127` (deleted via LEG-065) |
| LEG-014 | `services/notification-service` (manifest-only) | dormant (reserved) | **KEEP-FROZEN** | `notification-core` + queue-workers | reopen trigger | — | n/a | manifest-only |
| LEG-015 | `services/analytics-pipeline` (manifest-only) | dormant (reserved) | **KEEP-FROZEN** | queue-workers analytics rollups | reopen trigger | — | n/a | manifest-only |
| LEG-016 | `services/media-service` (manifest-only) | dormant (reserved) | **KEEP-FROZEN** | media handling in monolith | reopen trigger | — | n/a | manifest-only |
| LEG-017 | `services/search-service` (manifest-only) | dormant (reserved) | **KEEP-FROZEN** | search in monolith | reopen trigger | — | n/a | manifest-only |
| LEG-018 | `apps/mobile/shopper-app` (manifest-only, 0 LOC) | dormant (reserved) | **KEEP-FROZEN** | n/a (reserved) | reopen trigger | — | n/a | manifest-only |
| LEG-019 | `apps/mobile/operator-app` (manifest-only, 0 LOC) | dormant (reserved) | **KEEP-FROZEN** | n/a (reserved) | reopen trigger | — | n/a | manifest-only |
| LEG-020 | `apps/app-marketplace` (107 files, 19,557 LOC) | obsolete-scope (V1-rejected, deployed) | **KEEP-FROZEN** (de-deploy) | n/a (R-11 rejects for envelope) | ARB R-11 freeze confirmation | W3 | V-SMOKE(no prod URL serves it; rest of estate deploys clean) | deployed via `production-deploy.yml:363-364`; imports `billing-core`. **Keep code + OAuth2/PKCE seam; stop deploying. NOT a source delete.** |
| LEG-021 | `apps/developer-portal` (31 files, 4,903 LOC) | obsolete-scope (V1-rejected, deployed) | **KEEP-FROZEN** (de-deploy) | n/a (R-11) | ARB R-11 freeze confirmation | W3 | V-SMOKE | deployed `production-deploy.yml:365-366`; no local `vercel.json`; absent from staging. Gate out of prod matrix; freeze |

### 2.4 Internal / platform console consolidation — A9

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-022 | `apps/platform-console` (56 files, 5,983 LOC) | survivor (thin ops sliver) | **KEEP** | ONE V1 "thin ops sliver" | `GATE-OPS-SURVIVOR` recorded; sliver capabilities (refund/maker-checker payout/dispute/KYC) live in this survivor before the non-survivor is removed | W3 | V-SMOKE(ops tasks work in survivor) → V-BUILD → V-GOV | chosen for ops-task fit and existing super-admin boundary, not because of `AppNavigation`; final ARB signature is tracked as skipped-human |
| LEG-023 | `apps/platform-operations-portal` (52 files, 4,044 LOC) | non-survivor duplicate | **MIGRATE-then-DELETE** | `apps/platform-console` consolidated ops sliver | LEG-022 sliver capabilities landed and smoked; final ARB signature tracked as skipped-human | W3 | V-SMOKE → V-BUILD → V-GOV → V-IMPORT(no link/route depends on it) → remove from deploy matrix | employee-portal scaffold folds into `platform-console`; no longer a conditional fate |

**GATE-OPS-SURVIVOR record.** Repository decision: `apps/platform-console` is the survivor. `apps/platform-operations-portal` is the non-survivor and is frozen except for migration of refund, maker-checker payout, dispute-log, and KYC-queue capability into `platform-console`. Owner: ARB chair for final signature; deadline: before any Wave 3 ops-console deletion. Code may proceed against this fixed default; the signature itself is recorded in `SKIPPED_HUMAN_DECISIONS.md`.

### 2.5 Parallel identity / auth systems — A1 (the four-implementation collapse)

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-024 | `api-gateway/src/routes/auth.ts` (1,441 LOC) — session minting + `/auth/signin\|signup\|otp` | parallel (legacy issuer) | **MIGRATE-then-DELETE** | `identity-platform` as SOLE issuer (A1) | **identity-platform sole-issuer LIVE** + V-SMOKE(login/refresh via identity-platform); no client calls legacy | W2c | V-IMPORT → V-SMOKE(login via identity-platform only) → V-TEST(auth contract) → V-GOV | mounted `index.ts:662-670`; on the live request path; public Supabase JWT path, no rotation/CSRF |
| LEG-025 | `api-gateway/src/identity-foundation/` (18 files, 1,655 LOC; oauth/csrf/mfa scaffolds, shadow-compare, token-shadow, mock-key-service) | parallel (shadow stack) + scaffold | **MIGRATE-then-DELETE** | `identity-platform` (A1) | A1 winner LIVE; rewire `middleware/auth.ts` to identity-platform verification; shadow-compare shows parity; LEG-024 done | W2c | V-IMPORT(identity-foundation→0) → V-SMOKE(every authed route verifies) → V-TEST → V-GOV | **WIRED:** `api-gateway/src/middleware/auth.ts:19` imports `auth-verifier-registry`; backed by migration `159` |
| LEG-026 | Legacy Supabase `/auth/password/reset` (`auth.ts:1399-1413`) | parallel (second reset pipeline) | **MIGRATE-then-DELETE** | custom single-use + `destroyAllUserSessions` reset (A1) | all resets route through the custom flow; LEG-024 | W2c | V-SMOKE(reset kills all sessions) → V-TEST | `supabase.auth.resetPasswordForEmail`; different token guarantees, no session-kill |
| LEG-027 | Legacy Supabase `/auth/*` public surface (signin/signup/otp/password) | parallel (legacy realm) | **MIGRATE-then-DELETE** | identity-platform OTP + host-scoped cookies (A1) | identity-platform realms LIVE; no client depends on Supabase routes; LEG-024 | W2c | V-IMPORT → V-SMOKE → V-TEST → V-GOV | `index.ts:662-670` coarse rate-limit; `supabase.auth.updateUser` role-escalation oracle |
| LEG-028 | `/api/auth/switch` takeover path (`identity-platform/.../api/auth/switch/route.ts` at HEAD) | obsolete (vulnerable, **S0**) | **MIGRATE-then-DELETE** (replace-in-place) | the working-tree fixed `route.ts` (rate-limit→CSRF→valid-session→proven-account) | DEL-0 (deploy unblock) | **W0** | V-TEST(`auth-switch-guard.test.ts`, commit it first) → V-BUILD → V-SMOKE(rejects unproven accounts) → V-GOV | HEAD `5cf9e64e` mints a session for any verified email; fix **uncommitted**; test untracked. **The highest-priority security fix.** |
| LEG-029 | Six identity micro-packages `packages/{identity,session,token,permission,organization,audit}-core` (334 LOC) | duplicate (over-decomposition) | **MIGRATE-then-DELETE** | fold into `auth-core` with sub-path exports (A1) | `auth-core` sub-path exports landed; importers re-pointed | W2c | V-IMPORT(each→0) → V-BUILD → V-TEST → V-GOV | each consumed only by `api-gateway` (+ each other); 6 pipelines for ~5 files of types |
| LEG-030 | Per-app hand-rolled session libs (`merchant-control-plane`, `storefront-runtime`, `platform-console`, ×4) | duplicate (4 forks) | **MIGRATE-then-DELETE** | `auth-core` session helpers (A1) | `auth-core` session helpers landed; A1 | W2c | V-IMPORT → V-BUILD(per app) → V-SMOKE(session lifecycle per app) → V-TEST | four hand-rolled session libs in four deployed apps; none sourced from `auth-core` |

### 2.6 Parallel money / ledger systems — A3 (money paths never delete-before-replace)

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-031 | Legacy capture RPC `confirm_order_payment_with_ledger` (baseline:1590) — writes NO `ledger_entries` | parallel (un-ledgered money path) | **MIGRATE-then-DELETE** | canonical ledger post (`post_ledger_transaction`, 139) via an adapter (A3) | **canonical capture-post LIVE & smoked** (PAY-001 fix); reconciliation shows `pa_clearing` balances | W1 | V-SMOKE(a capture posts `pa_clearing`/`merchant_payable`) → V-IMPORT(callers→0) → V-TEST(payments) → reconcile-to-zero | called `checkout-payment-routes.ts:620`, `internal-payment-routes.ts:163`; `grep INSERT INTO ledger_` = 0. Misnamed "with_ledger" |
| LEG-032 | Legacy returns-refund RPC `complete_order_refund` (baseline:1039-1208) — un-ledgered | parallel (un-ledgered refund) | **MIGRATE-then-DELETE** | canonical refund post (A3) | canonical refund-post LIVE; cumulative-refund cap sees prior refunds | W1 | V-SMOKE(a refund moves the ledger) → V-IMPORT → V-TEST → `refund_clearing` non-zero | called `returns.ts:279`, `order-execution.adapter.ts:495`; touches no ledger table |
| LEG-033 | COD remittance write `cod-reconciliation.ts:305` → only `wallet_ledger_entries`, never canonical `cod_receivable`/`cod_remittance` | parallel (compat-only path) | **MIGRATE-then-DELETE** | canonical COD cash-in-transit modeling (A3) | canonical COD posting LIVE | W1 | V-SMOKE(COD debits receivable, remittance relieves) → V-IMPORT → V-TEST | `insertWalletCreditIfMissing` writes compat row only; no `post_settlement_ledger_transaction` in file |
| LEG-034 | `wallet_ledger_entries` (119:44) — mutable single-entry "ledger" | parallel (compat ledger) | **MIGRATE-then-DELETE** | canonical `ledger_*` (139) as adapter target / retired | A3 canonical-as-truth LIVE; all writers re-pointed; backfill reconciled (151/160); DEL-031…033 | W5 | V-IMPORT(table→0 from app code) → live-DB no new compat writes → V-SMOKE(balance derives) → V-ROLLBACK(DOWN) | live write target on mobile money routes; bridged via `canonical_ledger_transaction_id` FK (151:42); `BEFORE UPDATE` sync trigger (160:137) |
| LEG-035 | `partner_payout_ledger_entries` (baseline) — compat ledger | parallel (compat ledger) | **MIGRATE-then-DELETE** | canonical `ledger_*` (A3) | A3 LIVE; writers re-pointed | W5 | V-IMPORT → V-SMOKE → V-ROLLBACK | single-entry mutable; no reject trigger |
| LEG-036 | `gift_card_ledger_entries` (baseline:10225) + mutable `gift_card_accounts.balance` (baseline:9355) | parallel (compat ledger + mutable balance) | **MIGRATE-then-DELETE** | gift cards as a tender on the canonical ledger (A3) | A3 tenders LIVE; balance becomes derived | W5 | V-IMPORT → V-SMOKE(gift-card balance derives) → V-ROLLBACK | balance mutated in place `SET balance = balance - …` (baseline:1836); DUP-8 precision mismatch (12,2 vs 10,2) |
| LEG-037 | `store_credit_ledger_entries` (153:54) + mutable store-credit balance | parallel (compat ledger) | **MIGRATE-then-DELETE** | store credit as a ledger tender (A3) | A3 tenders LIVE | W5 | V-IMPORT → V-SMOKE → V-ROLLBACK | no reject trigger; mutable |
| LEG-038 | `ai_credits` balance (baseline) — mutable | obsolete (mutable balance) | **MIGRATE-then-DELETE** | AI credits as a ledger tender (A3) | A3 tenders LIVE (AI is a P2 seam) | W5 | V-IMPORT → V-SMOKE → V-ROLLBACK | mutable balance column |
| LEG-039 | Hardcoded `razorpayx` payout rail (`payouts.ts:120`; `queue-execution.adapter.ts:151`; `app-store/shared.ts:322`) | obsolete (**R-6 self-custody breach**) | **MIGRATE-then-DELETE** | PA-split mirror (`razorpay_route`/Cashfree) — never custody (A3) | **PA-split rail LIVE & smoked** (PAY-014); `no_custody` metadata now true | W1 | V-SMOKE(a payout uses split, not own-balance) → V-IMPORT(razorpayx→0) → V-TEST → honesty-badge consistent | `payoutRail()` returns `'razorpayx'`; metadata falsely stamps `no_custody:true` (settlements.ts:249,298) |
| LEG-040 | Forgeable step-up check `security-controls.ts:27-83` (string-length + timestamp, no crypto) | obsolete (fake control) | **MIGRATE-then-DELETE** (replace-in-place) | real crypto step-up with stored challenge (A3) | real step-up LIVE | W1 | V-SMOKE(forged string rejected) → V-TEST(refund/payout require real 2nd factor) | sole "auth" on refund/payout (`payments.ts:491`, `payouts.ts`); accepts any plausible string |
| LEG-041 | GUC-from-param cross-store posting `post_settlement_ledger_transaction` (151:23) | obsolete (tenancy bypass) | **MIGRATE-then-DELETE** | derive tenant from ownership, not a param (A3/A2) | ownership-derived tenancy LIVE | W1 | V-SMOKE(cross-store post rejected) → V-TEST(cross-tenant ledger isolation) → V-ROLLBACK(DOWN) | sets tenant GUC from its own parameter, neutralizing the inner guard; whole app posts through it |
| LEG-042 | Live default 3% GMV rake (`commission_bps` default 300) + 18% GST-on-fee | obsolete (rejected pricing) | **MIGRATE-then-DELETE** (config/migration) | `commission_bps=0`, permanent 0% fee (A3) | ARB pricing sign-off | W1 | V-SMOKE(a payout deducts no fee) → V-TEST → marketing/code aligned → add `commission_bps=0` validator | `payouts.ts:398-401`; contradicts 0%-fee copy (`FAQ.tsx:17-18`) |
| LEG-043 | 32-bit `integer` paise columns (overflow ₹2.14cr) + `numeric`-rupee money columns | obsolete (wrong representation) | **MIGRATE-then-DELETE** | `bigint` minor units (paise) everywhere (A3) | `_bigint` shadows backfilled + reads switched; reconcile shadow==old | W5 | V-IMPORT(old columns unread) → V-SMOKE → V-TEST → V-ROLLBACK(DOWN recreates) | legacy money columns across baseline; new kernel is bigint-minor |
| LEG-054 | Dual payment row `payments` (142:43) vs `payment_transactions` (baseline) | duplicate (dual payment truth) | **MIGRATE-then-DELETE** | single `payments` session model (A3) | all capture on `payments`; LEG-031 done; historical rows backfilled | W5 | V-IMPORT(`payment_transactions` writers→0) → V-SMOKE → V-TEST | linked via FK (142:81); both carry `provider_payment_id` with separate uniques |

### 2.7 Theme system — React-vs-Liquid & dual drafts — A5 (the C3-protected case)

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-044 | `storefront-runtime/src/lib/theme-engine/` React renderer-registry + composition fork (9 files, 1,849 LOC) | parallel (live first-party renderer) | **KEEP-FROZEN** (freeze; NOT deleted for completeness) | Liquid-first OS-2.0 renderer in `theme-engine` (A5) | **Wave-6 data-driven fork** (delete only at parity, else keep frozen as a first-party fast-path) | W6 (decision) | n/a in early waves — **explicitly NOT deleted** (directive's test); freeze to NEW sections; designate ONE seam | **LIVE read path** — the only renderer that runs; `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (`theme-governance.ts:14`) |
| LEG-045 | Duplicate storefront-local section schemas `RUNTIME_SECTION_SCHEMAS` + `schemaFor()` (`renderer-registry.tsx:66`) | duplicate (schema fork) | **MIGRATE-then-DELETE** | `theme-engine` `BUILT_IN_SECTION_SCHEMAS` (24) as single source | engine schema consumption landed (A5) | W4 | V-IMPORT → V-SMOKE(sections render with engine schemas) → V-BUILD → V-TEST | storefront re-declares ~11 schemas locally instead of consuming the engine's |
| LEG-046 | Duplicate storefront compose `resolveStorefrontTemplate` + `template-resolver.ts` | duplicate (compose fork) | **MIGRATE-then-DELETE** | engine `composeStorefrontTheme` (`execution-runtime.ts:288`) | re-pointed to engine compose; LEG-045 | W4 | V-IMPORT → V-SMOKE(ordering/visibility identical) → V-BUILD → V-TEST | both sort `isVisible`+`order`; storefront duplicates compose |
| LEG-047 | `theme_editor_drafts` table (baseline) — legacy draft store | duplicate (dual draft systems) | **MIGRATE-then-DELETE** | `theme_instance_drafts` + `theme_draft_patches` (new spine) | new draft spine sole writer; open drafts backfilled | W4 | V-IMPORT(writers→0) → V-SMOKE(draft save/publish/preview via new spine) → V-ROLLBACK(DOWN) | `saveDraft` writes legacy **and** instance-draft **and** a patch (themes route :475) |
| LEG-048 | Orphaned engine renderer classes `LiquidRenderer`/`JsonContractThemeRenderer`/`createThemeRenderer` (Liquid flag-off) | dormant (road-not-taken) | **KEEP-FROZEN** | become the canonical renderer when Liquid lands (A5) | un-orphaned at the Liquid flip (W4) | W4 (un-freeze) | n/a — **these are the winner's code, currently dead behind the flag. KEEP, do not delete.** | only importer = `storefront-runtime/.../composition-engine.tsx`; otherwise unexercised |
| LEG-049 | `theme-marketplace` near-empty catalog (production seeds only `urban-kicks`) | dormant (under-stocked machinery) | **KEEP** (machinery CANONICAL) | seed at demand (A5) | n/a — machinery kept; catalog dormant-by-design | — | n/a — **DO NOT delete; the machinery is real** | upload/install/purchase/reviews real; `verification/055_only_urban_kicks_theme_catalog.sql` |
| LEG-050 | 6 superseded theme tables: `theme_templates`, `theme_assets`, `theme_layouts`, `theme_presets`, `theme_block_definitions`, `theme_section_definitions` | obsolete (superseded model) | **DELETE** (DDL) | `theme_instances`/`theme_packages`/`theme_renderer_manifests` | live-DB writer confirmation (no out-of-band writers) | W5 | V-IMPORT(0, HIGH confidence) → archive DDL → drop (paired migration) → V-SMOKE(theme runtime unaffected) → V-ROLLBACK | 0 code refs (DB §6.1); runtime uses the instance/package model |

### 2.8 Duplicate schemas & dead/duplicate migrations — A2, DB

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-051 | Dual tenant key on `orders`: `store_id` ≡ `site_id` + `sync_orders_tenant_keys` trigger (130:14-31) | duplicate (always-equal columns) | **MIGRATE-then-DELETE** | single `site_id` canonical; `store_id` → generated/compat then retired (A2) | all code reads `site_id`; live-DB `site_id==store_id` for all rows | W5 | V-IMPORT(direct `store_id` reads) → V-SMOKE(orders create/read) → V-TEST → V-ROLLBACK(DOWN) | both NOT NULL, forced equal by trigger; spans 108/130/158 |
| LEG-052 | Dual user tables `users` vs `users_custom` | duplicate (split identity) | **MIGRATE-then-DELETE** | `users_custom` canonical; expose `users` as a view (A2) | A1 identity model settled; profile reads sourceable from a view | W5 | V-IMPORT → live-DB FK integrity → V-SMOKE → V-TEST → V-ROLLBACK | FKs point at `users_custom` (e.g. 091 `created_by`); `users` is profile-only |
| LEG-053 | Dual session tables `sessions` vs `sessions_v2` (159:113) | duplicate (successor dormant) | **MIGRATE-then-DELETE** | one session model under identity-platform (A1) | LEG-025 removes the identity-foundation boundary; A1 single session | W2c/W5 | V-IMPORT(sessions_v2→0 after LEG-025) → live-DB no writes → V-ROLLBACK(DOWN) | 161 says "current sessions table remains authoritative"; `sessions_v2` referenced only by the identity-foundation boundary |
| LEG-055 | `orders.items` JSONB vs `order_items` relational | duplicate (JSONB↔relational) | **MIGRATE-then-DELETE** | `order_items` relational authoritative; drop JSONB (A4) | relational sole read source; reconcile JSONB==relational | W5 | V-IMPORT(JSONB column reads) → V-SMOKE(order read+write) → V-TEST → V-ROLLBACK | `085_orders_items_reconcile` declares relational authoritative but keeps JSONB "for rollback"; reconcile report-only |
| LEG-056 | `products` embedded variants JSONB vs `product_variants` relational | duplicate (JSONB↔relational) | **MIGRATE-then-DELETE** | `product_variants` relational (A4) | relational sole read source; reconcile | W5 | V-IMPORT → V-SMOKE(product read+write) → V-TEST → V-ROLLBACK | `086_products_variants_reconcile` mirror of 085 |
| LEG-057 | 8 partition-shadow tables `*_partitioned` + `*_partitioned_default` (079–083, 131) | duplicate (deferred-partition seam, active-mirroring) | **KEEP-FROZEN** (seam) — mirror disabled | n/a — partitioning DEFERRED to P2 (V1 §5) | n/a — keep the shadow tables empty; the 131 mirror is disabled (the cron + trigger) | W5 | n/a (tables kept) — but the **mirror is turned off** (V-SMOKE: writes to base tables succeed without the mirror) | mirrored by trigger (131:9-56) ahead of an unexecuted swap; doubles writes — **disable the mirror, keep the seam** |
| LEG-058 | Duplicate migration prefix `129` (two `129_*` files) | dead (collision) | **MIGRATE-then-DELETE** (renumber) | renumber one with a ledger note (DB hygiene) | confirm both already applied live (**UNVERIFIED**); choose safe renumber | W5 | V-GOV(no duplicate prefix; pairing validator) | both files exist; Supabase versions by numeric prefix → collision risk. "Delete" = one file's number |
| LEG-059 | Migrations 138, 140, 157 with no paired rollback | dead (missing rollback path) | **MIGRATE-then-DELETE** (author the rollbacks) | forward+rollback pairing ≥138 (V1 §7) | n/a — write the 3 rollbacks | W5 | V-ROLLBACK(each DOWN reverses its forward on a scratch DB) → V-GOV(pairing validator) | `rollback/` has 21 files vs 24 forwards ≥138. The *missing* rollback is the defect |
| LEG-060 | Forward-only `ADD COLUMN` residue in 151/160 rollbacks | dead (incomplete rollback) | **MIGRATE-then-DELETE** (add `DROP COLUMN`) | symmetric rollbacks (V1 §7) | n/a — amend the DOWNs | W5 | V-ROLLBACK(amended DOWN drops the columns) → V-GOV | 151:38-46 vs 151.rollback; 160:28-40 vs 160.rollback |
| LEG-061 | ~37 product-dead Postgres tables (theme-legacy ×6 [in LEG-050], ops-theater `provider_*`/`replay_*`/`rollout_*`/`shadow_traffic_*`/`failover`/`chaos`/`load_test`, diagnostics, `plan_entitlements`, `collection_products`) | dead (orphan tables) | **DELETE** (DDL, after writer confirmation) | n/a (no winner — pure dead weight) | **live-DB write-count confirmation** (`pg_stat_user_tables`); exclude 4 RPC-mediated + 4 partition-default false positives | W5 | V-IMPORT(0 per table) → live-DB no recent writers → archive DDL → drop (batched paired migrations) → V-SMOKE → V-ROLLBACK | DB §6.1 zero-reference orphans; ~9% of the 419-table surface |
| LEG-062 | Duplicate `provider_payment_id` unique index under two names (107:135 ≡ 142:148) | duplicate (redundant index) | **DELETE** (drop one) | one unique index | confirm identical predicates; choose canonical name | W5 | V-GOV → V-SMOKE(uniqueness still enforced) → V-ROLLBACK(DOWN recreates) | same predicate `(gateway, provider_payment_id) WHERE … IS NOT NULL AND deleted_at IS NULL` |

### 2.9 Dead governance layer — validators, manifests, fantasy infra — A0

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-063 | ~36 rejected-architecture validators (of 187): `replay-*`(10), `projection-*`(5), `saga-recovery`, `crdt-convergence`, `convergence-*`, `distributed-*`(7), `failover-certification`, `wal-*`, `lease-*`, `fencing-token`, `split-brain`, `partition-recovery`, `execution-layer`, multi-region survivability | dead (governance theater) | **DELETE** | retargeted validators that enforce V1 conformance (A0) | **must land WITH/just-before LEG-001…006** (validator-liveness loop) | W2a/W2b | confirm each targets a rejected concept (not a real invariant); delete the paired replay/projection/saga/CRDT/chaos test suites too → V-GOV(slimmed set passes) → V-BUILD | certify R-4/R-5/R-13 concepts no runtime runs; some are the ONLY consumers of the dead packages. **Delete order matters** |
| LEG-064 | Runtime manifest authority prose: `workflowAuthority`/`orchestrationAuthority`/`replayOperationsOwnership`/`observabilityInfrastructureOwnership` in all 13 `runtime.manifest.json` | dead (governance fiction) | **MIGRATE-then-DELETE** | slim manifest schema (root, platform, deploy config, deps only) | **must be retargeted before LEG-002/005/006** (manifests name `application-services` as authority); slim-schema validator updated | W2b | strip the prose keys → V-GOV(manifest validator green vs slim schema) | e.g. `developer-portal/runtime.manifest.json:65,71,73`; same keys in all manifests; point at dead `application-services`, empty `event-bus`, unprovisioned Grafana/Tempo/Loki/Prometheus |
| LEG-065 | `production-topology.json` declaring 6 reserved services as `environment:"production"` with Helm `deploymentManifests` | dead (fabricated topology) | **DELETE** (regenerate from deploy matrix) | topology derived from actual `.github/workflows` deploy matrix | topology validator retargeted (overlaps LEG-063) | W2b | build topology from the workflow matrix; diff against the fabrication → V-GOV(`runtime-topology-validator` vs real matrix) | `production-topology.json:117-127` + 5 siblings; mark reserved roots `reserved`, never `production`; remove Helm refs |
| LEG-066 | `infrastructure/deployment/{kubernetes,helm}/` (namespace/quota 16 CPU/64Gi/120 pods + Helm Chart) | dead (fantasy infra) | **ARCHIVE** (→ `docs/archive/`) | n/a — platform deploys to Cloudflare Workers + Vercel only | LEG-065 done (topology no longer references Helm) | W2b | V-IMPORT(`grep helm\|kubectl .github/workflows` = 0) → remove `production-readiness-validator` helm assertion → `git mv` → V-GOV → V-BUILD | referenced only by `production-topology.json` (now fixed) + one validator |
| LEG-067 | `.github/workflows/deploy-staging.yml` (duplicate of `staging-deploy.yml`) | duplicate (double-deploy race) | **DELETE** | single staging workflow (`staging-deploy.yml` + app matrix) | port the app matrix into `staging-deploy.yml` first | **W0** | confirm `staging-deploy.yml` carries all apps → `git rm` → V-SMOKE(one deterministic staging deploy) | both trigger `push→develop`; overlapping scope → nondeterministic staging. Three staging workflows exist; collapse to one |
| LEG-068 | `hot-table-partition-maintenance.yml` scheduled prod cron (`cron "15 2 1 * *"`, `EXECUTE_MAINTENANCE=true`) + the 131 active mirror | obsolete (V1-deferred capability armed) | **MIGRATE-then-DELETE** (disable schedule + mirror) | partitioning DEFERRED to P2 (V1 §5/§7) | confirm no consumer reads `_partitioned` shadows; confirm the swap never happened | W2b | remove `schedule:` trigger; disable the 131 mirror (paired migration, **keep the shadow tables — LEG-057**) → V-SMOKE(base-table writes succeed) → V-GOV | runs monthly prod-DB DDL for a deferred capability; keep `workflow_dispatch` plan-mode |
| LEG-069 | `SKIP_NEEDS_HUMAN` secret-shaped values as plaintext `[env.production.vars]` (`wrangler.toml:253-262`) | obsolete (config smell) | **MIGRATE-then-DELETE** (move to `wrangler secret`) | secret store; vars only for non-secrets | provision keys via `wrangler secret put`; gateway reads them | W0/W2b | V-SMOKE(consuming routes resolve secrets; preflight green) | 74 `SKIP_NEEDS_HUMAN` repo-wide; preflight guards non-sentinel. Honest+guarded, but secrets-shaped vars in the deploy unit |

### 2.10 Deprecated aliases, orphans, doc sprawl, domain literals — A0

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-070 | Deprecated app aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `consumer-storefront`, `operator-team-app`) | obsolete (deprecated topology) | **KEEP** (deny-list stays) | the V1 runtime map | n/a — **nothing to delete; they do not exist on disk** | — | n/a — the deny-list validator is the winner and STAYS | **None exist on disk**; only deny-list entries in `governance-common.mjs:76-87`. Disambiguation row |
| LEG-071 | `legacy/firebase/` (Firebase functions/rules: wallet/commission/settlement/notifications; ~15,323 LOC) | dead (abandoned backend) | **ARCHIVE** (→ `docs/archive/firebase-legacy/`) | Supabase + Workers (current backend) | none | W2b | V-IMPORT(no app/service imports `legacy/`) → confirm git-tracked (**UNVERIFIED** — `git ls-files legacy/`) → `git mv` → V-BUILD → V-GOV | imported by nothing; frozen since 2026-05-25; precedent `docs/archive/flutter-legacy` |
| LEG-072 | Mobile parity catalog `merchant-app/lib/screens/parity/{merchant_feature_definitions,merchant_feature_screen}.dart` (974 LOC) + route | dead (TD-5, routed) | **MIGRATE-then-DELETE** (remove route, then files) | real merchant screens (A7) | remove the route case + 2 imports in `routes.dart` | W3 | V-IMPORT(`flutter analyze` finds no ref) → no deep-link targets the parity routes → `flutter test` → debug build green | **routed:** `routes.dart:59-60,764,774-776` (`MerchantFeatureDefinitions.byRoute` → `MerchantFeatureScreen`). V1 §10 "removed outright" |
| LEG-074 | `tasks/executable/001…016` (16 superseded Build-Mission task specs) | obsolete (superseded missions) | **ARCHIVE** (→ `docs/archive/build-missions/`) | V1 Appendix C reconciliation | stamp each with its V1 Appendix C verdict | W2b | none (docs only) | retained verbatim at root; some contradict V1 (010 notifications-service vs R-2). Risk: agents execute stale instructions |
| LEG-075 | ~60+ superseded root governance/mission/ledger/status docs (21 `CODEX_*` triples, superseded `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`, 12 foundation-wave state docs, 33 audit/scorecard reports, the maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md`, 9 root audit dirs) | obsolete (competing constitutions/ledgers) | **ARCHIVE** (→ `docs/archive/2026-06-10/`) | ONE constitution (DOC 01) + ONE current STATUS | commit-or-archive everything untracked FIRST (lose nothing); define the keep-set | W2b | root `.md` count within budget; no untracked authority docs | 92 root artifacts + 9 root audit dirs; ≥5 authority claimants; newest set untracked. Adopt a root-doc budget |
| LEG-076 | Stale generated `AGENTS.md` (claims 19 migrations vs 91; encodes the rejected 9-app canon) | obsolete (stale constitution) | **MIGRATE-then-DELETE** (regenerate from V1) | regenerated `AGENTS.md` expressing V1 §6 topology (A0) | LEG-065 (topology source); ARB sign-off on V1 §6; update `generate-repository-intelligence.mjs` | W2b | V-GOV → diff shows 4-surface topology + correct migration count | `CLAUDE.md` ranks it first; `production-deploy.yml` implements its 9-app canon; never re-run since 2026-06-08. **The rejected content is removed by regeneration** |
| LEG-077 | `letbuyy.store` domain literals in active deploy code/config (143 files, 514 lines; `api.letbuyy.store` vs `bff.letbuyy.com` split-brain) | obsolete (partially-migrated domain) | **MIGRATE-then-DELETE** (canonicalize to letbuyy.com) | `letbuyy.com` canonical + `.store` 301s (A0) | `.com` DNS provisioned; map every `.store` literal; DEL-0 | W2b | V-SMOKE(cookies/CORS/SEO on `.com`; `.store` 301s) → new ban-validator green | wrangler routes, vercel envs, dns.tf pin `.store`; `bff.letbuyy.com` only migrated surface. One PR + a validator banning `letbuyy.store` |
| LEG-078 | Repo clutter: `build/` (Flutter cache), `.tmp/`, `test-results/`, `.codex/`, `memory/lessons.md`, 176 tracked screenshots, 319 PNG baselines, untracked `FOUNDER_CONTENT_ENGINE/` + `founder-journey/` | obsolete (build residue + non-eng IP) | **DELETE** / gitignore / relocate | n/a | LFS/CI-artifact home for baselines | W2b | extend `.gitignore`; confirm baselines have a CI/LFS home → `git status` clean → V-TEST(visual-regression finds baselines) | `git status`; `find build -type f` (dill caches). Move founder IP out of the code tree |

### 2.11 Phase C forced legacy rows — formerly prose-only losers

| ID | System / Path | Type | Verdict | Replaced-by | Gate | Wave | Validate-before-delete | Evidence |
|---|---|---|---|---|---|---|---|---|
| LEG-079 | Client React cart authority: `apps/storefront-runtime/src/context/cart-context.tsx` plus `cart-drawer.tsx`, cart page, checkout client, product cards | parallel (client cart authority) | **MIGRATE-then-DELETE** (demote to thin view, then remove authority) | server-authoritative cart + hosted checkout handoff (A4) | P8 hosted origin + cart-bound signed handoff LIVE; public order-create gated behind server cart | W3 | V-SMOKE(server cart add/update/checkout) → V-IMPORT(no authority reads from `useCart`) → V-TEST(cart forgery rejected) → V-GOV | `cart-context.tsx` still carries `stock: 999` and backs storefront cart/checkout UI; DOC 03 already named it a loser but no LEG row existed |
| LEG-080 | Inventory direct-decrement side doors: `services/api-gateway/src/routes/inventory.ts`, `apps/merchant-control-plane/src/app/api/stores/[store]/inventory/{adjust,levels}/route.ts`, order-edit add-item paths | side-door (oversell bypass) | **MIGRATE-then-DELETE** | single reserve→commit lifecycle + scheduled stale-reservation sweeper | `expire_inventory_reservations` scheduled; order edits and merchant adjustments route through reservation/commit semantics or audited stock adjustment | W3 | V-SMOKE(inventory adjust) → oversell concurrency test (last unit exactly one winner) → V-IMPORT(no direct `available` decrement side-door) → V-GOV | CHK-002…005 named the side doors; DOC 03 prose named the loser but no LEG row existed |
| LEG-081 | Scalar single-code discount path: `services/api-gateway/src/routes/coupons.ts`, public storefront coupon validate routes, scalar `coupon_code` order fields | transitional discount authority | **MIGRATE-then-DELETE** (compat endpoint only until no caller depends on scalar-only behavior) | typed 3-class `combines_with` discount engine in `@letbuyy/checkout-core` | typed engine active in checkout/order RPC; scalar callers migrated to engine-backed validation | W3 | V-TEST(discount-class combine matrix, coupon concurrency) → V-IMPORT(no scalar-only validation callers) → V-SMOKE(checkout coupon path) → V-GOV | `combines_with` exists, but scalar validate routes still expose single-code behavior; DOC 03 prose named the loser but no LEG row existed |
| LEG-082 | Merchant shell fork: `apps/merchant-control-plane/src/components/AdminShell.tsx`, `Sidebar.tsx`, `HeaderBar.tsx` | duplicate shell/navigation | **MIGRATE-then-DELETE** | `@letbuyy/ui` `AppNavigation` + shared app shell | merchant control plane adopts `AppNavigation` with first-class Money node; local shell importers reach zero | W4 | V-IMPORT(no app-local `AdminShell`/`Sidebar`/`HeaderBar`) → V-BUILD(merchant-control-plane) → V-SMOKE(primary dashboard/settings/orders navigation) → V-GOV | canonical shell exists in `packages/typescript/ui`; merchant app still imports local shell fork |
| LEG-083 | Web token-source forks: app-local `--lb-*` redefinitions in app CSS and token-like theme constants outside `packages/typescript/ui/src/tokens.ts` / generated `tokens.json` | duplicate token authority | **MIGRATE-then-DELETE** | one DTCG token source in `packages/typescript/ui/src/tokens.ts` → generated web/Dart bridges | token bridge generated and adopted by web apps + Flutter; design-system ratchet blocks new app-local token authority | W4/W5 | token snapshot parity → V-IMPORT(no app-local token authority) → `validate:design-system` hard-fails new drift → V-GOV | DOC 03 named per-app token redefs as losers; this row gives them a gate and rollback-safe fate |

> **Coverage:** all 83 LEG rows are represented above. **DEAD-now/S0 paths that are not "removable files" but invariant fixes** (the 6 `USING(true)`→PUBLIC RLS policies, the anon-writable `super_admin_allowlist`, the `user_metadata.role` client-writable channel, the `MOCK_JWKS` literal, the `AUTH_SECRET` internal-secret fallback, the `gift_cards.balance` precision duplicate, the `emitDomainEvent` swallow-errors path, the `compensation_actions` zero-executor) are tracked in DOC 03 §3 and the forensic register (ISSUE-003…009, AUTH-004, IDN-029, PAY-007/023/026) — they are *replaced-in-place*, not deleted as artifacts, and are sequenced in Waves 0–1 below.

---

## 3. THE EXACT DELETION ORDER (ordered execution sequence)

> **Ordering law.** (1) Clear the deploy meta-blocker (W0 — nothing else can be validated end-to-end first). (2) Batch all zero-importer `DELETE`s + their paired validator/manifest retargets (W2a). (3) Archive the historical dead weight + regenerate the fabricated artifacts (W2b). (4) `MIGRATE-then-DELETE` each wired legacy system **gated on its winner being LIVE** — identity + storefront query-layer (W2c), money (W1), product-scope (W3), theme (W4), schema/long-tail (W5). (5) The C3-protected React renderer fork is a **W6 data-driven decision**, never an early deletion.
> Each wave is gated; **a wave does not start until the prior gate is green** (waves may parallelize where their gates are independent, but the gate order is fixed).

### Wave 0 — Deploy & security unblock (the keystone; gates everything)
> **Gate to enter:** none. **Gate to exit:** `git rev-list --count main..stepup/main` = 0; pipeline green; the S0 fixes live.

1. **DEL-0** — Fix the deploy meta-blocker. Execute `MERGE_RUNBOOK.md` (`stepup/main` → `develop` → `main`); add a branch-lag guard. *(Not a deletion — the prerequisite. Without it, V-SMOKE is impossible for every `MIGRATE-then-DELETE` row.)*
2. **LEG-028 / DEL-028** — Commit + deploy the `/api/auth/switch` fix (replace-in-place). Commit `auth-switch-guard.test.ts` first; tag a security release. **The single highest-priority item in the entire plan.**
3. **The 3 RLS S0 invariant fixes** (replace-in-place, not file deletes): drop/replace the 6 `USING(true)`→PUBLIC policies (products/orders/sites/store_customers/billing/subscriptions); fix the anon-writable `super_admin_allowlist` (`TO service_role` + audited migration writes). *(Pure SQL; no identity dependency — can land in W0.)*
4. **LEG-067 / DEL-067** — Delete the duplicate staging workflow (port its app matrix into `staging-deploy.yml` first).
5. **LEG-069 / DEL-069a** — Move secret-shaped `[env.production.vars]` to `wrangler secret`.

### Wave 2a — Zero-importer `DELETE` (the CQRS cluster + its validators, atomically)
> **Gate to enter:** W0 done; `pnpm turbo build` green baseline. **Ordering constraint:** the dead packages and their *only consumers* (the fiction validators LEG-063 + the manifest prose LEG-064) must be cut in the **same change set** — the validator-liveness loop. **Delete the cluster + cut the validators + slim the manifests atomically.**

6. **LEG-064 / DEL-064** — Slim the 13 runtime manifests (retarget `workflowAuthority` etc.) — **before** LEG-002.
7. **LEG-063 / DEL-063** — Delete the ~36 fiction validators + their dead test suites — **with/just-before** the packages.
8. **LEG-002, LEG-005, LEG-006, LEG-004** — Delete `application-services` → `orchestration` → `distributed-runtime` → `projection-runtime` in dependency order (each V-IMPORT=0 only *after* its consumer is gone).
9. **LEG-001, LEG-003** — Delete `app-engine`, `extension-host` (independent zero-importer).
10. **LEG-009** — Delete `schema-registry-execution.adapter.ts` (fold any version-check into `event-core` first).
11. **LEG-073** — Delete `packages/dart/services` phantom.

### Wave 2b — Archive the historical dead weight + regenerate the fabrications + domain canonicalize
> **Gate to enter:** W2a (dead packages gone, so the topology/AGENTS regen is consistent).

12. **LEG-065 / DEL-065** — Regenerate `production-topology.json` from the real deploy matrix (reserved roots → `reserved`).
13. **LEG-066 / DEL-066** — **ARCHIVE** the k8s/Helm fantasy (`git mv` → `docs/archive/`).
14. **LEG-071 / DEL-071** — **ARCHIVE** `legacy/firebase` (~15.3k LOC) (`git mv` → `docs/archive/firebase-legacy/`).
15. **LEG-074 / DEL-074** — **ARCHIVE** the 16 superseded mission specs.
16. **LEG-075 / DEL-075** — **ARCHIVE** the ~60+ superseded root governance docs (commit-or-archive untracked FIRST; adopt a root-doc budget).
17. **LEG-076 / DEL-076** — Regenerate `AGENTS.md` from V1 §6; re-rank `CLAUDE.md` (V1 first); add a CI regen step.
18. **LEG-007 / DEL-007** — Un-leak then delete `search-core` (replace `api-types` `export *` with explicit exports).
19. **LEG-077 / DEL-077** — Canonicalize `letbuyy.store` → `letbuyy.com` (one PR + a ban-validator).
20. **LEG-068 / DEL-068** — Disable the hot-table partition cron + the 131 active mirror (**keep** the LEG-057 shadow tables).
21. **LEG-069 (remainder) / LEG-078 / DEL-078** — Finish the secret migration; repo-clutter cleanup (gitignore caches, delete empties, relocate founder IP + baselines).

### Wave 2c — Identity collapse + `runtime-composition` unwire (gated on A1 + A6 winners LIVE)
> **Gate to enter:** A1 (identity-platform sole issuer) LIVE + smoked; A6 (storefront query-layer moved into runtime/monolith) LIVE.

22. **LEG-008 / DEL-008** — Unwire (rewrite the 3 importers) **then** delete `runtime-composition`. *(High risk — live storefront read path; unwire FIRST.)*
23. **LEG-024 / DEL-024** — Delete gateway `routes/auth.ts` session minting (after identity-platform is sole issuer).
24. **LEG-025 / DEL-025** — Delete the `identity-foundation/` shadow stack (rewire `middleware/auth.ts` to identity-platform first; shadow-compare parity).
25. **LEG-026, LEG-027 / DEL-026, DEL-027** — Delete the legacy Supabase reset + `/auth/*` public surface.
26. **LEG-029 / DEL-029** — Fold the 6 identity micro-packages into `auth-core`, then delete the shells.
27. **LEG-030 / DEL-030** — Delete the 4 per-app hand-rolled session libs (replace with one `auth-core` import each).
28. **LEG-053 / DEL-053** — Drop `sessions_v2` (after LEG-025 removes its only referent).

### Wave 1 — Money-correctness legacy-path deletion (gated on A3 canonical ledger + PA-split rail LIVE)
> **Gate to enter:** A3 (canonical ledger + PA-split rail + real step-up) LIVE & smoked; **the reconciliation harness proves zero drift on the path being replaced.** Pattern: the legacy un-ledgered path is first *replaced* by a canonical post (the W1 fix), the new path is smoked, THEN the legacy artifact is retired. **Money paths never delete-before-replace.**

29. **LEG-031, LEG-032, LEG-033 / DEL-031…033** — Retire the legacy capture / refund / COD compat paths (each after its canonical post is LIVE + smoked).
30. **LEG-039 / DEL-039** — Delete the hardcoded `razorpayx` self-custody rail (after the PA-split rail is LIVE).
31. **LEG-040 / DEL-040** — Replace the forgeable step-up with real crypto (in-place).
32. **LEG-041 / DEL-041** — Remove the GUC-from-param posting in `post_settlement_ledger_transaction`.
33. **LEG-042 / DEL-042** — Set `commission_bps=0` (kill the 3% rake + GST-on-fee); add the `commission_bps=0` validator.

### Wave 3 — Product-completeness deletions (gated on the relevant winners LIVE)
> **Gate to enter:** W0; the relevant winner (REST scope, ops sliver, real mobile screens, hosted checkout) LIVE.

34. **LEG-010 / DEL-010** — Build-exclude + delete the dead-by-flag GraphQL (ARB scope decision).
35. **LEG-011 / DEL-011** — Delete `app-functions-runtime.ts` (no extension in the payment path).
36. **LEG-020, LEG-021 / DEL-020, DEL-021** — Gate `app-marketplace` + `developer-portal` **out of the prod deploy matrix** (FREEZE, not source delete).
37. **LEG-022, LEG-023 / DEL-022, DEL-023** — Consolidate the two ops consoles into `apps/platform-console`; migrate the thin ops sliver, then delete `apps/platform-operations-portal` after V-SMOKE.
38. **LEG-072 / DEL-072** — Remove the mobile TD-5 parity catalog route, then delete the 974-LOC files.
- **LEG-079 / DEL-079** — Demote the client React cart to a thin view and remove its authority once P8 server cart + hosted handoff serve.
- **LEG-080 / DEL-080** — Remove inventory direct-decrement side doors after the reserve→commit lifecycle and stale-reservation sweeper are live.
- **LEG-081 / DEL-081** — Retire scalar single-code discount authority after the typed `combines_with` engine serves checkout/order flows.

### Wave 4 — Theme-Liquid deletions (gated on A5 Liquid at parity LIVE; the React renderer stays FROZEN)
> **Gate to enter:** A5 (Liquid at parity, per-theme + canary) LIVE; Security suite green. **LEG-044/048 are NOT deleted here** — the React renderer stays frozen; the orphaned Liquid classes are un-frozen (become the live renderer).

39. **LEG-045, LEG-046 / DEL-045, DEL-046** — Delete the storefront-local duplicate section schemas + compose fork (re-point to the engine).
40. **LEG-047 / DEL-047** — Drop the legacy `theme_editor_drafts` table (after the new draft spine is the sole writer + backfill).
- **LEG-082 / DEL-082** — Delete the merchant `AdminShell`/`Sidebar`/`HeaderBar` fork after `AppNavigation` is adopted and smoked.
- **LEG-083 / DEL-083** — Delete app-local web token-source forks after the canonical token bridge is adopted and the design-system ratchet blocks new drift.

### Wave 5 — Schema canonicalization + long-tail DDL (gated on schema-canon migrations + live-DB writer confirmation)
> **Gate to enter:** schema-canonicalization migrations LIVE; **live-DB writer confirmation** for every table drop. The paired-rollback gap (LEG-059/060) is closed *first* as a precondition for the schema waves.

41. **LEG-059, LEG-060** — Author the 3 missing rollbacks (138/140/157) + add the pairing validator; add the missing `DROP COLUMN`s to 151/160 rollbacks. *(Precondition.)*
42. **LEG-034…038 / DEL-034…038** — Retire the 4 compat ledger tables + mutable balances onto the canonical ledger (balances become derived).
43. **LEG-043, LEG-054 / DEL-043, DEL-054** — Bigint money cutover; converge the dual payment rows.
44. **LEG-051, LEG-052 / DEL-051, DEL-052** — Collapse `store_id`≡`site_id`; collapse `users` → view over `users_custom`.
45. **LEG-055, LEG-056 / DEL-055, DEL-056** — Drop the JSONB dual models (`orders.items`, `products` variants).
46. **LEG-050 / DEL-050** — Drop the 6 superseded theme tables (DDL).
47. **LEG-061 / DEL-061** — Drop the ~37 product-dead tables (batched paired migrations, after `pg_stat_user_tables` confirmation).
48. **LEG-062 / DEL-062** — Drop the duplicate `provider_payment_id` index.
49. **LEG-058 / DEL-058** — Renumber the duplicate migration prefix `129`.
50. **LEG-057** — Confirm the partition shadows are retained empty + the mirror is off (no deletion).

### Wave 6 — The data-driven fork (the only place the C3-protected loser is decided)
> **Gate to enter:** Liquid carrying production traffic at parity for a full canary cycle; perf data (Liquid p50/p95 within budget).

51. **LEG-044** — Decide the React renderer's fate **on data**: delete-at-parity (full suite green per-section) OR keep frozen as a documented first-party fast-path. **This is the directive's explicit test — React is never deleted "for completeness," only on proof.**

---

## 4. PROGRAM-LEVEL RULES (binding)

### R-DEL-1 — Nothing is deleted until validation is green (Rule X, restated as law)
Every `DELETE`/`ARCHIVE`/`MIGRATE-then-DELETE` MUST pass its pre-deletion gate (§2 "Validate-before-delete" column) before removal. A red gate halts the deletion. No exceptions.

### R-DEL-2 — `MIGRATE-then-DELETE` waits for a LIVE winner
A wired legacy system is removed only after its DOC 03 winner is **deployed and serving** (V-SMOKE on the winner) and its importer count is **zero** (V-IMPORT). The Gate column names the predecessor; the deletion does not begin before it.

### R-DEL-3 — Never a bare `DROP`; every DB removal is a paired migration
Every table/column/index drop ships as a paired migration (forward DROP + a DOWN that recreates from archived DDL). V-ROLLBACK applies the DOWN on a scratch DB before merge. The existing rollback-coverage gap (LEG-059/060) is closed as a precondition for the schema waves (Wave 5 step 41).

### R-DEL-4 — The validator-liveness loop: cut the asserting validator WITH the asserted code
A validator that is the only consumer of a dead artifact is deleted/retargeted in the **same change set** as that artifact (LEG-063/064 with LEG-001…006). Editing the governance gate before the code it asserts, or after, breaks `validate-governance.mjs`; they move together.

### R-DEL-5 — Archive, don't destroy, anything with history
DEAD artifacts with historical or seam value (Firebase, k8s/Helm, the maximalist architecture doc, the 60+ governance docs, the mission specs) are `git mv`-ed to `docs/archive/`, never `rm`-ed. History is preserved; the active tree is clean.

### R-DEL-6 — The React renderer (and every C3-protected loser) is NOT deleted early
A loser whose winner exists is **not** automatically deletable. Where the loser is the live read/write path, it is KEPT-FROZEN until its winner reaches parity, and the delete-or-keep fork is a data-driven decision (Wave 6 for the React renderer). Deleting it early breaks the live path — forbidden.

### R-DEL-7 — Money and security deletions are the most gated
Wave-0 security fixes are replace-in-place behind the deploy fix (no artifact lingers). Wave-1 money deletions gate on the canonical ledger being LIVE **and** the reconciliation harness proving zero drift; if reconciliation breaks, the winner is rolled back (deploy + revert) **before** the legacy path is touched — the legacy path is retired only after the winner proves correct.

### R-DEL-8 — Rollback is a precondition, not an afterthought
Code deletions are isolated commits (large ones — `distributed-runtime` — kept as a single commit for a clean revert). Governance/manifest/topology edits land in the same change set as the artifact they describe, so a `git revert` restores a consistent state. Deploy-level rollback (Cloudflare/Vercel previous deployment) is the immediate lever for any `MIGRATE-then-DELETE` that regresses V-SMOKE.

---

## 5. ELIMINATION SCORECARD (the one-screen rollup)

| Verdict | Rows | Headline targets |
|---|---:|---|
| **DELETE** | 15 | CQRS cluster (~13.3k LOC, the biggest), `schema-registry` adapter, Dart phantom, 6 theme tables, ~37 dead tables, duplicate index, ~36 fiction validators, duplicate staging workflow, fabricated topology.json, repo clutter |
| **ARCHIVE** | 4 | `legacy/firebase` (~15.3k LOC), k8s/Helm fantasy, 16 mission specs, 60+ root governance docs |
| **MIGRATE-then-DELETE** | 49 | 4 auth impls, un-ledgered money + 4 compat ledgers + mutable balances + razorpayx + 3% rake, dual schemas, theme schema/draft/compose forks, client React cart, inventory side-doors, scalar discount RPC, hand-rolled navs, web token-source forks, `.store` literals, `runtime-composition`, GraphQL/extensions dead-by-flag, ops-console non-survivor, TD-5 catalog |
| **KEEP-FROZEN** | 13 | 6 reserved services, `app-marketplace` + `developer-portal`, React renderer, orphaned Liquid classes, partition shadows |
| **KEEP** | 2 | theme-marketplace machinery, deprecated-alias deny-list |
| **Total** | **83** | — |

**The biggest single deletion:** the **~13,345-LOC CQRS/saga/extension package cluster** (`app-engine` 2,190 + `application-services` 1,078 + `extension-host` 358 + `projection-runtime` 1,023 + `orchestration` 1,393 + `distributed-runtime` 7,303) — **zero production importers, DELETE, Wave 2a.** The largest single artifact within it is `packages/distributed-runtime` (74 files, 7,303 LOC). The largest *archive* is `legacy/firebase` (~15,323 LOC, ARCHIVE not DELETE).

**The keystone:** Wave 0 — fix the deploy meta-blocker (`main` ~30 behind) + commit/deploy the `/api/auth/switch` S0 fix. Until this clears, no `MIGRATE-then-DELETE` can be validated end-to-end.

---

## 6. TRACEABILITY & UNVERIFIED

- **Every row traces to** `_GOVERNANCE_SPINE.md` §S5 (the winners) + the source register `STRATEGIC_CANONICALIZATION_2026_06_10/LEGACY_ERADICATION_REGISTER.md` (LEG-001…078) + the gated execution blocks in `SAFE_DELETION_PLAN.md` (DEL-0…DEL-078) + an anchor (A0–A9). This plan crystallizes those into the operative ordered law; it re-derives nothing.
- **DOC 03 cross-reference:** every verdict here maps to a DOC 03 §2/§3 winner ("Replaced-by"). DOC 03 names the winner; this document names the loser, the gate, the order, and the validation.
- **Forensic anchoring:** `FORENSIC_MASTER_2026_06_10/000_MASTER_INDEX.md` (291 issues / 9 S0; all 7 load-bearing claims re-confirmed against code) + `TOP_250_PLATFORM_ISSUES.md` (ISSUE-001…291) + `REPO_TOPOLOGY_AUDIT.md` (TOPO-001…041) for path evidence.

### 6.1 UNVERIFIED (preserved from the source audits; gates that must be discharged before the relevant deletion)
- **`legacy/` git-tracked status** (37 reported vs empty from the Linux mount) — on-disk ~15.3k LOC confirmed; ARCHIVE verdict unchanged; **proof required before LEG-071 ARCHIVE:** `git ls-files legacy/` from the macOS repo root.
- **Live-DB writers for the ~37 product-dead tables (LEG-061) + 6 superseded theme tables (LEG-050)** cannot be confirmed code-only (some RPC/ops-script written) — **proof required before the DROP:** `pg_stat_user_tables` write counts + audit-log scan. (This is why those are Wave 5, gated on writer confirmation.)
- **GraphQL / extensions / Liquid actual prod execution** (LEG-010/011/044) — flags are `false` in prod config, but live behavior is UNVERIFIED (no prod probe) — confirm no prod client before the delete.
- **The 6 anon RLS table GRANTs** are set by Supabase's managed bootstrap (not repo SQL) — **proof before final S0 sign-off:** an anon-key probe / `\dp public.orders` (migration 107's header is strong evidence they are live).
- **Whether `pnpm turbo build` is green** across the workspaces — assumed by the Wave-2a dead-package deletions; not executed (runtime > sandbox timeout). Establish the green baseline before W2a.
- **Migration `129` live-apply status** (LEG-058) — confirm both `129_*` already applied before choosing the safe renumber.

*End of LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md (DOC 04). Destroy the parallel universes. 83 losers, four verdicts, one order, nothing deleted until validation is green. Companion to DOC 03 (`LETBUYY_CANONICAL_SYSTEMS.md`). Evidence pinned at `stepup/main` @ `5cf9e64e`, working tree dirty, 2026-06-10.*
