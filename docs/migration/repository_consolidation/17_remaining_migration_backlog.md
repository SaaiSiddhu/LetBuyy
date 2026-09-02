# 17 — Remaining Migration Backlog

Everything below is genuinely open. Nothing in this document should be read as "done" — it is the opposite, a deliberately complete list of what Phase M did **not** finish, so the next phase doesn't have to rediscover it. Every item below only exists as source inside the two Stage 1 bundles (`~/LetBuyy-history-preservation-2026-08-29/system-{A,B}-*.bundle`) — `Ecommerce/LetBuyy` and `Agrimore` no longer exist on disk.

## 1 — Founder/owner decisions still open (never relitigated by this phase)

- **D-0**: which backend is canonical (Supabase/Cloudflare `services/api-gateway`, Firebase, or a bounded hybrid). See `11_backend_consolidation.md`'s 24-domain map — every row is `D0_DEPENDENT`.
- **D-1 through D-7** and the fee/merchant-of-record model for quick-commerce — never named in this engagement beyond "D-0" and the fee-model reference in `00b`; not resolved.
- **The `00b_topology_amendment_draft.md` Signature Block** — still unsigned (all 7 items ☐). The six-app rename was applied under the brief's explicit "apply anyway, flag it" instruction, not under a completed signature.
- **Gap 2/Gap 3's alternative options** — this phase took `00b`'s *recommended* option in both cases (Option B for the auxiliary-tier name; Option B for the TOOLING classification). The owner may prefer Option A or C for either; nothing forecloses changing this later, but changing it now means re-touching `CLAUDE.md`, `AGENTS.md`, and `governance-common.mjs` again.

## 2 — Packages never consolidated — CLOSED 2026-09-03 (Phase N), namespaced not merged

**Superseded.** Phase N (`docs/migration/repository_consolidation/18_dart_package_recovery_journal.md`, `19_dart_package_recovery.md`) recovered all 11 packages this section originally described as blocked — System A's 4 (`packages/{core,models,services,ui_kit}`) and System B's 7-package transitive closure (the declared 6 plus a discovered `agrimore_core` dependency) — from the Phase M bundles, under new `marketplace_*`/`quickcommerce_*` names to avoid colliding with this repository's own `packages/dart/{core,models,ui_kit}`. **Namespacing, not the "real per-package line-by-line comparison" this row originally called for** — that comparison was done (Stage 2's collision evidence: `letbuyy_ui_kit` near-identical, `letbuyy_core` a light refactor, `letbuyy_models` genuinely different scope) but package *unification* itself remains a real, open, D0-adjacent decision. See `19_dart_package_recovery.md`'s own "D0_BLOCKED" and "Everything left unresolved" sections for what's still genuinely open (3 packages/apps BLOCKED from Dart pub workspace membership by real dependency-version conflicts, unrelated to the collision question).

**Direct consequence, updated:** `apps/customer_app` and `apps/admin_app` **are** now Dart pub workspace members and both `flutter analyze` clean (zero issues). `apps/phase_2/rider_app`/`apps/phase_2/store_ops_app` remain outside the shared workspace (a `flutter_secure_storage` version conflict with `apps/merchant_app`, not a missing-package problem) but now resolve and analyze **standalone**, with 2 of 3 test files passing per app — see `19_dart_package_recovery.md` for the exact status and first errors.

## 3 — Donor capability never integrated (by design — Stage 3.4/4.1's own scope decision)

Every donor app/package listed in `docs/architecture/APPLICATION_OWNERSHIP.md`'s "Donor apps not integrated" table. None of their unique features were ported into the six survivor apps this phase — the whole donor tree exists only in the bundles now. Specific known unique capabilities not yet ported:
- System B's `customer_app`/`seller_app`/`admin_app` (quick-commerce-specific UX, not audited feature-by-feature against the marketplace survivors)
- System A's `store-builder-web`/`store/builder` ("build your storefront" tooling, both web and Flutter — `07`'s own UNRESOLVED #5 flags these as possibly complementary or redundant, never determined)
- System A's `admin-web` (the rejected `admin_web` candidate)

## 4 — `platform-operations-portal`'s constitutionally-pre-decided merge, gate not cleared

ART-24 names `apps/platform-operations-portal` as MIGRATE-then-DELETE into `apps/admin_web`, gated on "the refund, maker-checker payout, dispute-log, and KYC-queue smoke path" — a live smoke test this phase's tooling cannot run (no deploy, no live provider contact). The merge itself was not executed. `apps/platform-operations-portal` remains FROZEN, untouched, on disk.

## 5 — The auxiliary tier's physical relocation

`CLAUDE.md`'s Constitution amendment authorizes `apps/auxiliary/` as a directory grouping for `apps/identity-platform` and `apps/marketing-site`, but neither was physically moved there this phase (explicitly deferred — high blast radius for a sole token issuer, judged not worth the risk without a dedicated pass). Both remain top-level `apps/` entries today.

## 6 — Config/documentation sweep loose ends

- **`config/env/staging-production-secret-matrix.json`'s external cascade** — the repo-side path→short-name mapping was updated; the actual external secret variable names (`MERCHANT_CONTROL_PLANE_INTERNAL_SECRET` etc., living in GitHub/Cloudflare/Vercel) were **not** renamed (this repository has no access to those platforms). PENDING EXTERNAL, owner action required.
- **The 00b §61 sweep's count discrepancy** — 00b's own count was 359 occurrences; this session's independent re-measurement got 406 (broader pattern matching, not fully reconciled). Neither figure was authoritative for the actual mechanical sweep executed in Stage 6, which fixed every occurrence found by direct search, not by trusting either count.
- **~380 files classified HISTORICAL at the category level** (dated `docs/` research/audit/launch-readiness trees), not individually opened and verified. If any turns out to be load-bearing, that's a mis-classification worth flagging.
- **`EXECUTION_LEDGER.md`, `CAPABILITY_BACKLOG.md`, `SKIPPED_HUMAN_DECISIONS.md`, `EXECUTABLE_HUMAN_REQUIRED.md`'s narrative prose** still names the pre-rename app paths inside historical descriptions (their `path:line` citations were fixed; the surrounding sentences describing past events were deliberately not rewritten).

## 7 — Governance gate: 2 disclosed, unresolved findings (of the real gate's final 6 failures)

- **`foundation-antifabrication-gate.mjs`**: `services/compatibility/firebase_bridge/src/commissionService.ts`'s inherited `status: "released"` literal (inert, unwired code). An allowlist-entry fix was attempted and reverted after it broke `session-security-validator`'s separate invariant. Needs either a real fix to that validator's exemption design, or acceptance that this bridge will always fail this specific check until it's deleted or the literal is edited.
- **`environment-validator.mjs`**: flags Firebase Web API keys in `customer_app`/`admin_app`/`firebase_bridge` as secret-like. Already independently classified as NOT real secrets in `00c_credential_exposure_and_rotation.md` (Google's own documented public-client-identifier model) — a validator false positive with no existing exemption mechanism in that validator's source.
- The other 4 gate failures (`validate-design-system`, `sequential-migration-validator`, `raw-error-message-validator`, `branch-lag-guard-validator`) are **pre-existing**, unrelated to this phase, tracked since `09_pre_restructure_build_baseline.md` (2026-09-01).

## 8 — Credential rotation (still not done — was never in scope)

Per `00c_credential_exposure_and_rotation.md`, unchanged by this phase: the Razorpay key pair and 3 Gemini API key values remain live in both GitHub remotes' published history. **Plus, new this phase**: 2 previously-undiscovered hardcoded Razorpay test-mode key IDs (see `12_final_verification.md`'s "Security finding" section) should be added to the same rotation list, even though test-mode. All rotation remains a HUMAN REQUIRED owner action outside any repository tooling.

## 9 — Carried forward from `07_final_path_mapping.md`'s own UNRESOLVED and OBSERVED-NOT-ACTED-ON sections, still true

- `apps/store/builder` vs. `apps/store-builder-web` — complementary or redundant, never determined.
- System B's `graphify/` vs. this repository's `tools/graph-server`+`tools/central-intelligence` — never compared file-for-file.
- `database/supabase/` vs. root-level `supabase/snippets` — never determined if the latter is stray or intentional.
- System B's `tooling/` directory contents — never opened.
- `storefront-liquid-discovery.zip`'s correspondence to tracked/untracked source — never determined.
- `.claude/worktrees/` — 6 live worktrees (one registered outside this repository entirely), ~9.1 GB, never opened or audited this entire multi-phase engagement. Still true.
- `infra/terraform/envs/staging/.terraform/` (was in System B) — a downloaded Terraform provider binary, never swept. Now only in the System B bundle.

## 10 — Branch state

`feature/claude-md-durable-architecture-memory` is now 60 commits ahead of `main` (`git rev-list --count main..HEAD`), up from 39 before Phase N — Phase N alone added 20 checkpoint commits across its 8 stages (S0–S7). `branch-lag-guard-validator` continues to flag this — the underlying fix (fast-forward `main` per `MERGE_RUNBOOK.md`) is unchanged, pre-existing process debt, not something this phase was asked to resolve.
