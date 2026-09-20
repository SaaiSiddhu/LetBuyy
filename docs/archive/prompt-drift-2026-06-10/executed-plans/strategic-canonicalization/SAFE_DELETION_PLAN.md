# LETBUYY SAFE DELETION PLAN

**Companion to `LEGACY_ERADICATION_REGISTER.md` · Architecture Review Board deliverable**

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Author** | Principal Platform Engineer, Architecture Review Board |
| **Repo** | `/Users/saai_sidd/Git/Letbuyy_Store` |
| **Branch / HEAD** | `stepup/main` @ `c4fc3cd6` |
| **Cross-ref** | Each `DEL-xxx` block deletes the correspondingly-numbered `LEG-xxx` row from the register. |

---

## 1. Methodology & governing rules

This plan converts every `SAFE_DELETE` and `DELETE_AFTER_MIGRATION` row from the register into an ordered, gated removal. It exists so that no engineer or agent deletes a load-bearing thing, and so that every deletion is reversible until proven safe.

**Three inviolable rules:**

1. **Nothing is deleted until its validation is complete.** Every block has a Pre-deletion validation gate (at minimum a zero-importer proof + build/test green) that MUST pass before the Deletion step.
2. **`DELETE_AFTER_MIGRATION` items do not delete until their replacement is LIVE.** The Strategic Winner must be deployed and serving, and the legacy importer count must have returned to zero, before the legacy artifact is removed. The Dependencies field names the predecessor.
3. **`SAFE_DELETE` (zero-importer) items go first and cheap.** They require no winner, only proof of zero references. They are batched into Wave 2 and clear the deck before the harder migrations.

**Deletion happens on a branch, behind the deploy meta-blocker fix.** Because `main` is ~30 commits behind (LEG-028/DEL-0 prerequisite), every deletion that needs a deploy is validated on `stepup/main` → `develop` → `main` only after the merge pipeline is restored (Wave 0).

---

## 2. Deletion-Validation Taxonomy

Every deletion is gated by a subset of these six checks. The block's Pre-/Post-deletion fields name which apply.

| Code | Check | What it proves | How to run |
|---|---|---|---|
| **V-IMPORT** | **Importer / dependent scan** | Zero non-self, non-validator references to the artifact (path, symbol, table name, package name). The core "it's dead / it's unwired" proof. | `grep -rIl '<name>' apps services packages --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.js' --include='*.dart' \| grep -v '<own-dir>' \| grep -v 'scripts/validators/'` → must be empty. For tables: grep name across `*.sql,*.ts,*.dart,*.json`. |
| **V-BUILD** | **Build green** | The workspace still typechecks + builds after removal. | `pnpm turbo build` (or scoped `pnpm --filter <affected> build`); `flutter analyze` for Dart. |
| **V-TEST** | **Test-suite green** | Unit/contract/behavioral suites still pass; the deleted code had no live test dependency that mattered. | `pnpm test` / `ci.yml` merge-safety-gate (gateway/behavioral/contract); `flutter test`; targeted suite for the touched domain. |
| **V-GOV** | **Governance-validator green (after retarget)** | `validate-governance.mjs` passes once the validators that *asserted the deleted thing* are removed/retargeted. Prevents the validator-liveness deadlock. | `node scripts/validate-governance.mjs` — run AFTER the paired validator edit, never before. |
| **V-SMOKE** | **Runtime smoke** | The live path still serves after a `DELETE_AFTER_MIGRATION` removal (the winner is actually carrying the traffic). | Deploy to staging; hit the affected route(s) (storefront render, auth login, payment capture, payout, theme draft save) and confirm 200 + correct behavior. |
| **V-ROLLBACK** | **Rollback (revert) validation** | The deletion is reversible: `git revert` of the deletion commit restores a building, passing tree; for DB, the paired DOWN migration restores the dropped object. | Dry-run `git revert --no-commit <sha>` then V-BUILD; for tables, apply the archived `CREATE` DDL / DOWN migration on a scratch DB. |

**Gate matrix by class:**

- **SAFE_DELETE (code/package):** V-IMPORT → V-BUILD → V-TEST → V-GOV(if a validator referenced it) → commit → V-ROLLBACK.
- **SAFE_DELETE (DB table/index):** V-IMPORT → (live writer confirmation) → archive DDL → DROP in a paired migration → V-BUILD → V-ROLLBACK(DOWN migration restores).
- **DELETE_AFTER_MIGRATION:** winner live + V-SMOKE on winner → V-IMPORT returns to **0** → V-BUILD → V-TEST → V-GOV → V-SMOKE(legacy path gone, winner serving) → commit → V-ROLLBACK.

---

## 3. Ordered Deletion Waves

> Ordering law: clear the deploy meta-blocker (W0), batch all zero-importer `SAFE_DELETE`s (W2), then gate each `DELETE_AFTER_MIGRATION` on its winner. Money-correctness winners (W1) precede their legacy-path deletions; theme/schema deletions come last (W4/W5).

| Wave | Theme | DEL blocks | Gate to enter |
|---|---|---|---|
| **W0** | Deploy/security unblock | DEL-0 (meta), DEL-028, DEL-067, DEL-069a | none (this is the prerequisite wave) |
| **W2a** | Zero-importer SAFE_DELETE (code) | DEL-001…006, 009, 073 | W0 done; `pnpm turbo build` green baseline |
| **W2b** | Governance/infra/doc SAFE_DELETE + retargets | DEL-063, 064, 065, 066, 071, 074, 075, 076, 078, 007, 077, 069 | W2a (dead packages gone so validators can be cut) |
| **W2c** | Identity/runtime-composition unwire+delete | DEL-008, 024, 025, 026, 027, 029, 030, 053, 068 | A1 winner (identity-platform sole issuer) live; A6 storefront query-layer moved |
| **W1** | Money-correctness legacy-path deletion | DEL-031…043, 054 | A3 winner (canonical ledger + PA-split rail) live & smoked |
| **W3** | Product-completeness deletions | DEL-010, 011, 020, 021, 022, 023, 072 | W0; relevant winners (REST scope, ops sliver, real screens) live |
| **W4** | Theme-Liquid deletions | DEL-045, 046, 047 | A5 winner (Liquid at parity) live; LEG-044/048 stay frozen |
| **W5** | Schema canonicalization + long-tail | DEL-050, 051, 052, 055, 056, 057, 058, 059, 060, 061, 062, 034…038, 043 | schema-canon migrations live; live-DB writer confirmation |

---

## 4. Per-Deletion Detail Blocks

> Each block: Current State · Why-safe-to-delete · Pre-deletion validation · Deletion step · Post-deletion validation · Rollback Plan · Risk · Complexity · Wave · Dependencies · Success Criteria. Risk ∈ {Low, Medium, High}; Complexity ∈ {S, M, L}.

### Wave 0 — Deploy & security unblock (prerequisite)

#### DEL-0 — Fix the deploy meta-blocker (enables every other deletion)
- **Current State:** `main` ~30 commits behind `stepup/main`; `production-deploy.yml` triggers only on `main`. No deletion that needs a deploy can be validated end-to-end.
- **Why-safe:** Not a deletion — a prerequisite. Without it, V-SMOKE is impossible for all `DELETE_AFTER_MIGRATION` items.
- **Pre-deletion validation:** `MERGE_RUNBOOK.md` dry-run; clean-tree gate.
- **Deletion step:** Execute the merge runbook: fast-forward `develop` → `main`; tag a security release (carries DEL-028).
- **Post-deletion validation:** V-SMOKE on staging+prod; confirm waves 0–7 code is live.
- **Rollback Plan:** Standard deploy rollback (Cloudflare/Vercel previous deployment).
- **Risk:** High · **Complexity:** M · **Wave:** W0 · **Dependencies:** none · **Success:** `git rev-list --count main..stepup/main` = 0; pipeline green.

#### DEL-028 — Remove the `/api/auth/switch` takeover behavior (replace-in-place)
- **Current State (LEG-028):** HEAD `route.ts` mints a session for any verified email; the fix is uncommitted, its test `auth-switch-guard.test.ts` untracked.
- **Why-safe:** The "deletion" is removing the vulnerable code path by committing the already-written fix (rate-limit→CSRF→valid-session→proven-account). No external importer depends on the takeover behavior.
- **Pre-deletion validation:** V-TEST on `auth-switch-guard.test.ts` (commit it first); V-BUILD.
- **Deletion step:** Commit the working-tree fix + test; cherry-pick to `main`/`develop`; tag security release.
- **Post-deletion validation:** V-SMOKE — `/api/auth/switch` rejects unproven accounts; V-GOV.
- **Rollback Plan:** `git revert` the security commit (NOT recommended — reintroduces S0); rely on deploy rollback only if the fix itself regresses login.
- **Risk:** High · **Complexity:** S · **Wave:** W0 · **Dependencies:** DEL-0 · **Success:** S0 closed; HEAD has the guard; takeover test passes.

#### DEL-067 — Delete the duplicate staging workflow `deploy-staging.yml`
- **Current State (LEG-067):** `deploy-staging.yml` and `staging-deploy.yml` both fire on `push→develop`, double-deploying the four workers with divergent app matrices.
- **Why-safe:** `staging-deploy.yml` (+ the app matrix folded in) fully covers staging; the second workflow only causes a race.
- **Pre-deletion validation:** Confirm `staging-deploy.yml` carries all apps the kept workflow needs (port the app matrix into it first).
- **Deletion step:** Port app matrix → `staging-deploy.yml`; `git rm .github/workflows/deploy-staging.yml`.
- **Post-deletion validation:** Push to `develop`; confirm a single deterministic staging deploy (V-SMOKE).
- **Rollback Plan:** `git revert` restores the file.
- **Risk:** Low · **Complexity:** S · **Wave:** W0 · **Dependencies:** none · **Success:** one staging workflow; no double-deploy.

#### DEL-069a — Move secret-shaped `[env.production.vars]` to `wrangler secret`
- **Current State (LEG-069):** WHATSAPP_WEBHOOK_SECRET, TWILIO_ACCOUNT_SID, AI_CREDIT_RAZORPAY_KEY_ID… are plaintext vars in the deployed gateway config.
- **Why-safe:** Preflight already rejects sentinel values; moving them to the secret store removes them from the deploy unit with no behavior change.
- **Pre-deletion validation:** Provision the keys via `wrangler secret put`; confirm gateway reads them.
- **Deletion step:** Remove the secret-shaped keys from `wrangler.toml` `[env.production.vars]`.
- **Post-deletion validation:** V-SMOKE (the consuming routes still resolve secrets); preflight green.
- **Rollback Plan:** Re-add the vars (sentinel) to `wrangler.toml`.
- **Risk:** Medium · **Complexity:** S · **Wave:** W0/W2b · **Dependencies:** secret provisioning · **Success:** no secret-shaped vars in deploy config.

### Wave 2a — Zero-importer SAFE_DELETE (the rejected package cluster)

> These six packages share one deletion procedure and one ordering constraint: their asserting validators (DEL-063) and the manifest authority prose (DEL-064) must be retargeted in the SAME change set, because they are the only consumers. Delete the cluster + cut the validators + slim the manifests atomically.

#### DEL-001 — Delete `packages/app-engine` (2,190 LOC)
- **Current State (LEG-001):** Rejected app-engine scaffolding; `src/index.ts` is a 2,084-line god-file.
- **Why-safe:** `grep @letbuyy/app-engine` = 0 non-self/non-validator importers (verified 2026-06-10). Only `beta-readiness-validator.mjs` references it.
- **Pre-deletion validation:** V-IMPORT (0); remove `app-engine` from `pnpm-workspace.yaml` + `tsconfig.workspace`; retarget `beta-readiness-validator.mjs` (DEL-063).
- **Deletion step:** `git rm -r packages/app-engine`; drop workspace + tsconfig entries.
- **Post-deletion validation:** V-BUILD; V-TEST; V-GOV.
- **Rollback Plan:** `git revert`; re-add workspace entry. V-ROLLBACK dry-run before merge.
- **Risk:** Low · **Complexity:** S · **Wave:** W2a · **Dependencies:** DEL-063 (validator), DEL-0 (green build) · **Success:** package gone; build+gov green.

#### DEL-002 — Delete `packages/application-services` (1,078 LOC)
- **Current State (LEG-002):** Re-exports `@letbuyy/orchestration`; named `workflowAuthority` in all 13 runtime manifests.
- **Why-safe:** `grep @letbuyy/application-services` = 0 app/service importers. Its only inbound reference is the manifest prose (DEL-064) + validators.
- **Pre-deletion validation:** V-IMPORT (0); **retarget the 13 manifests first** (DEL-064) so `workflowAuthority` no longer names it; remove from workspace/tsconfig.
- **Deletion step:** `git rm -r packages/application-services`.
- **Post-deletion validation:** V-BUILD; V-TEST; V-GOV (manifest + runtime validators).
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W2a · **Dependencies:** DEL-064 (manifest slim), DEL-005/006 (consumes orchestration/distributed) · **Success:** gone; manifests no longer cite it.

#### DEL-003 — Delete `packages/extension-host` (358 LOC)
- **Current State (LEG-003):** R-11-rejected extension host.
- **Why-safe:** `grep` = 0; validators only.
- **Pre-deletion validation:** V-IMPORT (0); retarget any extension validator (DEL-063).
- **Deletion step:** `git rm -r packages/extension-host`; workspace/tsconfig drop.
- **Post-deletion validation:** V-BUILD; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W2a · **Dependencies:** DEL-063 · **Success:** gone; build+gov green.

#### DEL-004 — Delete `packages/projection-runtime` (1,023 LOC)
- **Current State (LEG-004):** CQRS projection runtime (R-5 rejected); imports `distributed-runtime`.
- **Why-safe:** `grep` = 0 non-self importers.
- **Pre-deletion validation:** V-IMPORT (0); retarget `projection-recovery-validator.mjs` + `projection-*` validators (DEL-063).
- **Deletion step:** `git rm -r packages/projection-runtime`.
- **Post-deletion validation:** V-BUILD; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W2a · **Dependencies:** DEL-063, DEL-006 (delete together — projection imports distributed) · **Success:** gone.

#### DEL-005 — Delete `packages/orchestration` (1,393 LOC)
- **Current State (LEG-005):** Saga/replay contracts (R-4 rejected); imported only by dead `application-services`.
- **Why-safe:** Once DEL-002 removes `application-services`, orchestration has zero importers.
- **Pre-deletion validation:** V-IMPORT (must be 0 AFTER DEL-002); retarget `saga-recovery-validator.mjs` (DEL-063).
- **Deletion step:** `git rm -r packages/orchestration`.
- **Post-deletion validation:** V-BUILD; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W2a · **Dependencies:** DEL-002, DEL-063 · **Success:** gone.

#### DEL-006 — Delete `packages/distributed-runtime` (7,303 LOC, 74 files)
- **Current State (LEG-006):** Largest dead artifact; CQRS/CRDT/saga/control-plane; imported only by dead `orchestration` + `projection-runtime`.
- **Why-safe:** Once DEL-004/005 remove its only consumers, distributed-runtime has zero importers.
- **Pre-deletion validation:** V-IMPORT (must be 0 AFTER DEL-004/005); retarget `distributed-runtime-validator.mjs`, `execution-layer-validator.mjs`, `convergence-*`, `replay-*`, `wal-*`, `lease-*`, `fencing-token`, `split-brain`, `partition-recovery` (DEL-063).
- **Deletion step:** `git rm -r packages/distributed-runtime`.
- **Post-deletion validation:** V-BUILD; V-TEST (projections/replay/survivability/chaos suites that test it must also be deleted — see DEL-063 note); V-GOV.
- **Rollback Plan:** `git revert` (large diff; keep the deletion as a single isolated commit for clean revert). V-ROLLBACK dry-run mandatory.
- **Risk:** Medium (size + test entanglement) · **Complexity:** M · **Wave:** W2a · **Dependencies:** DEL-004, DEL-005, DEL-063 · **Success:** 7.3k LOC gone; build+gov green.

#### DEL-009 — Delete `schema-registry-execution.adapter.ts`
- **Current State (LEG-009):** R-4-rejected schema-registry adapter in the gateway.
- **Why-safe:** Dead-weight; minimal version-check (if any) folds into `event-core`.
- **Pre-deletion validation:** V-IMPORT on the adapter symbol; fold any used version-check into `event-core` first.
- **Deletion step:** `git rm services/api-gateway/src/execution/schema-registry-execution.adapter.ts`.
- **Post-deletion validation:** V-BUILD; V-TEST; V-GOV (`event-schema-validator`, `event-versioning-validator` retarget).
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W2a · **Dependencies:** event-core version-check landed · **Success:** gone.

#### DEL-073 — Delete `packages/dart/services` (8-LOC facade)
- **Current State (LEG-073):** Phantom workspace member; contents removed in WS8 M5.
- **Why-safe:** Absent from `merchant-app/pubspec.yaml:17-24`; only in root `pubspec.yaml`.
- **Pre-deletion validation:** V-IMPORT (confirm no Dart importer); `melos list` shows no dependents.
- **Deletion step:** `git rm -r packages/dart/services`; remove from root `pubspec.yaml` workspace.
- **Post-deletion validation:** `melos bootstrap`; `flutter analyze`; `flutter test`.
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W2a · **Dependencies:** none · **Success:** workspace member gone; melos clean.

### Wave 2b — Governance / infra / doc SAFE_DELETE + retargets

#### DEL-063 — Delete ~36 rejected-architecture validators (with the dead packages)
- **Current State (LEG-063):** `replay-*`(10), `projection-*`(5), `saga-recovery`, `crdt-convergence`, `convergence-*`, `distributed-*`(7), `failover-certification`, `wal-*`, `lease-*`, `fencing-token`, `split-brain`, `partition-recovery`, `execution-layer`, multi-region survivability — 36 validators (of 187) certify a distributed system that does not run. Some are the only consumers of LEG-001…006.
- **Why-safe:** They enforce R-4/R-5/R-13 fiction; deleting them removes the validator-liveness loop blocking DEL-001…006. The kept validators are the V1-conformance set.
- **Pre-deletion validation:** Inventory which validators are listed in `validate-governance.mjs`; confirm each targets a rejected concept (not a real invariant). Also delete the test suites under `tests/` that exercise replay/projection/saga/CRDT/survivability/chaos (they fail once the packages go).
- **Deletion step:** `git rm` the 36 validator files; remove their entries from `scripts/validate-governance.mjs`; `git rm` the matching dead test suites.
- **Post-deletion validation:** V-GOV (`node scripts/validate-governance.mjs` passes with the slimmed set); V-BUILD.
- **Rollback Plan:** `git revert` the governance commit.
- **Risk:** Medium (governance gate is CI-blocking) · **Complexity:** M · **Wave:** W2b (must land WITH/just-before DEL-001…006) · **Dependencies:** coordinated with the package deletions · **Success:** validator count ~151; gov green; dead packages deletable.

#### DEL-064 — Slim the 13 runtime manifests (retarget authority prose)
- **Current State (LEG-064):** `workflowAuthority`/`orchestrationAuthority`/`replayOperationsOwnership`/`observabilityInfrastructureOwnership` keys point at dead `application-services`, empty `event-bus`, unprovisioned Grafana/Tempo/Loki/Prometheus.
- **Why-safe:** The prose governs nothing real; slimming to fields validators actually check (root, platform, deploy config, deps) removes `application-services`' last named dependent (unblocks DEL-002).
- **Pre-deletion validation:** Define the slim manifest schema; update `runtime-manifest-validator.mjs` to the slim schema.
- **Deletion step:** Strip authority/ownership prose keys from all 13 `runtime.manifest.json`.
- **Post-deletion validation:** V-GOV (manifest validator green against slim schema).
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** M · **Wave:** W2b (before DEL-002) · **Dependencies:** slim-schema validator update · **Success:** manifests cite no dead/empty/unprovisioned components.

#### DEL-065 — Regenerate `production-topology.json` / `deployment-topology.json` from the deploy matrix
- **Current State (LEG-065):** Six reserved services declared `environment:"production"` with Helm manifests backed by dead `distributed-runtime`.
- **Why-safe:** The machine-readable "production truth" is fabricated; regenerating from `.github/workflows` deploy matrix makes it real and lets the dead Helm refs (DEL-066) go.
- **Pre-deletion validation:** Build the topology from the actual workflow deploy matrix; diff against the fabricated file.
- **Deletion step:** Replace the topology JSONs; mark reserved roots `reserved`; remove Helm `deploymentManifests`.
- **Post-deletion validation:** V-GOV (`runtime-topology-validator` against the real matrix).
- **Rollback Plan:** `git revert`.
- **Risk:** Medium (validators consume it) · **Complexity:** M · **Wave:** W2b · **Dependencies:** topology validator retarget (overlaps DEL-063) · **Success:** topology = deploy reality; no reserved-as-production.

#### DEL-066 — Archive `infrastructure/deployment/{kubernetes,helm}` (fantasy infra)
- **Current State (LEG-066):** K8s namespace/quota + Helm chart for a Workers+Vercel platform; `grep helm|kubectl .github/workflows` = 0.
- **Why-safe:** No pipeline uses helm/kubectl; only `production-topology.json` (now fixed, DEL-065) + one validator referenced it.
- **Pre-deletion validation:** V-IMPORT (confirm 0 workflow refs after DEL-065); remove the `production-readiness-validator.mjs` helm assertion.
- **Deletion step:** `git mv infrastructure/deployment/kubernetes infrastructure/deployment/helm docs/archive/`.
- **Post-deletion validation:** V-GOV; V-BUILD.
- **Rollback Plan:** `git mv` back.
- **Risk:** Low · **Complexity:** S · **Wave:** W2b · **Dependencies:** DEL-065 · **Success:** no live K8s/Helm; archived.

#### DEL-071 — Archive `legacy/firebase/` (~15,323 LOC)
- **Current State (LEG-071):** Complete abandoned Firebase backend at repo root, frozen since 2026-05-25.
- **Why-safe:** Imported by nothing; superseded by Supabase + Workers. Precedent: `docs/archive/flutter-legacy`.
- **Pre-deletion validation:** V-IMPORT (confirm no app/service imports `legacy/`); confirm git-tracked status (UNVERIFIED note — run `git ls-files legacy/`).
- **Deletion step:** `git mv legacy/ docs/archive/firebase-legacy/`.
- **Post-deletion validation:** V-BUILD; V-GOV (dead-source detection green).
- **Rollback Plan:** `git mv` back.
- **Risk:** Low · **Complexity:** S · **Wave:** W2b · **Dependencies:** none · **Success:** root `legacy/` gone; history under archive.

#### DEL-074 — Archive `tasks/executable/001…016` (superseded missions)
- **Current State (LEG-074):** 16 Build-Mission specs, some contradicting V1 (010 vs R-2).
- **Why-safe:** V1 Appendix C reconciled them; risk is agents executing stale instructions.
- **Pre-deletion validation:** Stamp each with its V1 Appendix C verdict.
- **Deletion step:** `git mv tasks/executable docs/archive/build-missions/`.
- **Post-deletion validation:** none (docs only).
- **Rollback Plan:** `git mv` back.
- **Risk:** Low · **Complexity:** S · **Wave:** W2b · **Dependencies:** none · **Success:** no executable mission specs at root.

#### DEL-075 — Archive ~60+ superseded root governance docs (root-doc budget)
- **Current State (LEG-075):** 92 root artifacts + 9 root audit dirs; 21 `CODEX_*` triples, superseded `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md`, the maximalist `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md`, 33 reports; newest authority set untracked.
- **Why-safe:** ONE constitution (V1+Freeze) + ONE current STATUS is the winner; the rest are historical/competing.
- **Pre-deletion validation:** Commit-or-archive everything untracked first (so nothing is lost); list the keep-set (constitution, README, CLAUDE, current STATUS, this STRATEGIC dir).
- **Deletion step:** `git mv` the superseded docs + 9 audit dirs → `docs/archive/2026-06-10/`.
- **Post-deletion validation:** Root `.md` count within budget; no untracked authority docs.
- **Rollback Plan:** `git mv` back (history preserved).
- **Risk:** Low · **Complexity:** M · **Wave:** W2b · **Dependencies:** none · **Success:** root-doc budget met; single constitution discoverable.

#### DEL-076 — Regenerate `AGENTS.md` from V1 (remove the rejected 9-app canon)
- **Current State (LEG-076):** Stale generated `AGENTS.md` claims 19 migrations vs 91 and encodes the 9-app canon; CLAUDE.md ranks it first; pipelines implement it.
- **Why-safe:** Not a file delete — a regeneration that removes the rejected content; the V1 §6 topology replaces it.
- **Pre-deletion validation:** Update `generate-repository-intelligence.mjs` to express V1 §6; confirm it reads V1.
- **Deletion step:** Regenerate `AGENTS.md`; add a CI step to regenerate on topology-affecting merges.
- **Post-deletion validation:** V-GOV; diff shows 4-surface topology + correct migration count.
- **Rollback Plan:** `git revert` the regenerated file + generator change.
- **Risk:** Medium (constitution change) · **Complexity:** M · **Wave:** W2b · **Dependencies:** DEL-065 (topology source), ARB sign-off on V1 §6 · **Success:** AGENTS.md = V1 topology; not stale.

#### DEL-078 — Repo clutter cleanup (gitignore + delete empties + move founder content)
- **Current State (LEG-078):** `build/`, `.tmp/`, `test-results/`, `.codex/`, `memory/lessons.md`, 176 tracked screenshots, 319 PNG baselines, untracked `FOUNDER_CONTENT_ENGINE/` + `founder-journey/`.
- **Why-safe:** Caches are regenerable; founder content is non-engineering IP; proof/baselines belong in CI artifacts/LFS.
- **Pre-deletion validation:** Extend `.gitignore` (build/, test-results/, .tmp/); confirm baselines have a CI/LFS home before moving.
- **Deletion step:** Delete empties; `git rm --cached` caches; move founder dirs to a content repo; move proof/baselines to LFS or CI artifacts.
- **Post-deletion validation:** `git status` clean; V-TEST (visual-regression still finds baselines).
- **Rollback Plan:** Restore from history/LFS.
- **Risk:** Low · **Complexity:** S · **Wave:** W2b · **Dependencies:** LFS/CI-artifact home for baselines · **Success:** no caches/founder IP in tree; baselines relocated.

#### DEL-007 — Drop `search-core` from `api-types` then delete the package
- **Current State (LEG-007):** Dormant `search-core` leaked via `api-types/src/index.ts:92` `export *`, consumed by `api-gateway`/`marketing-site`.
- **Why-safe:** Replacing `export *` with explicit used-type exports drops `search-core` to 0 importers.
- **Pre-deletion validation:** Replace `export * from '@letbuyy/search-core'` with explicit exports of used types; V-IMPORT (search-core → 0 after DEL-002 removes application-services too).
- **Deletion step:** `git rm -r packages/search-core`; drop from `api-types` deps + workspace.
- **Post-deletion validation:** V-BUILD (api-gateway, marketing-site); V-TEST; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W2b · **Dependencies:** DEL-002 · **Success:** search-core gone; api-types exports explicit.

#### DEL-077 — Canonicalize `letbuyy.store` → `letbuyy.com` in deploy code/config
- **Current State (LEG-077):** 143 files / 514 lines carry `letbuyy.store`; split-brain `api.letbuyy.store` vs `bff.letbuyy.com`.
- **Why-safe:** A0 winner is `letbuyy.com` canonical with `.store` 301s; the `.store` literals are the partially-migrated remnant.
- **Pre-deletion validation:** Map every `.store` literal (wrangler routes, vercel envs, dns.tf); stage `.com` zone records + 301s.
- **Deletion step:** One migration PR: routes/envs/domains → `letbuyy.com`; add a validator banning `letbuyy.store` in deploy config.
- **Post-deletion validation:** V-SMOKE (cookies/CORS/SEO on `.com`; `.store` 301s); the new ban-validator green.
- **Rollback Plan:** Revert the PR; DNS revert.
- **Risk:** High (live domains) · **Complexity:** M · **Wave:** W2b · **Dependencies:** DEL-0; `.com` DNS provisioned · **Success:** 0 `.store` in deploy config; single apex.

#### DEL-068 — Disable the hot-table partition cron + the 131 active mirror
- **Current State (LEG-068/LEG-057):** Monthly prod cron runs partition DDL; 131 trigger actively mirrors 5 tables into `_partitioned` shadows (doubles writes). Partitioning is V1-deferred to P2.
- **Why-safe:** No current need; keeping `workflow_dispatch` plan-mode preserves the seam.
- **Pre-deletion validation:** Confirm no consumer reads the `_partitioned` shadows (DB §6.1: `*_partitioned_default` are 0-ref); confirm the swap never happened.
- **Deletion step:** Remove the `schedule:` trigger from `hot-table-partition-maintenance.yml`; disable the 131 mirror trigger via a paired migration (keep the shadow tables — LEG-057 KEEP_TEMPORARILY).
- **Post-deletion validation:** V-SMOKE (writes to base tables succeed without the mirror); V-GOV.
- **Rollback Plan:** Re-enable trigger/cron via revert + DOWN migration.
- **Risk:** Medium (prod-DB trigger) · **Complexity:** M · **Wave:** W2b · **Dependencies:** DEL-0 · **Success:** no scheduled prod DDL; mirror off; shadows retained empty.

### Wave 2c — Identity & runtime-composition (gated on A1 + A6 winners)

#### DEL-008 — Unwire then delete `packages/runtime-composition` (1,119 LOC)
- **Current State (LEG-008):** WIRED into the production storefront page + gateway adapter + queue consumer (+2 gateway tests).
- **Why-safe (after migration):** Once the storefront query-layer moves into `storefront-runtime`/monolith (A6), the three importers are rewritten and `grep` returns 0.
- **Pre-deletion validation:** A6 winner live; rewrite `store/[subdomain]/page.tsx:7`, `queue-execution.adapter.ts:16`, `platform-queue-consumer.ts:16` off `composeStorefrontRuntimeProjection`; update the 2 gateway tests; V-IMPORT → 0.
- **Deletion step:** `git rm -r packages/runtime-composition`; workspace/tsconfig drop.
- **Post-deletion validation:** V-BUILD; V-TEST; V-SMOKE (storefront renders; queue consumes); V-GOV.
- **Rollback Plan:** `git revert` (restores package + re-points importers).
- **Risk:** High (live storefront read path) · **Complexity:** L · **Wave:** W2c · **Dependencies:** A6 storefront query-layer migration LIVE · **Success:** storefront serves without the package; 0 importers; gone.

#### DEL-024 — Delete gateway `routes/auth.ts` session minting (1,441 LOC)
- **Current State (LEG-024):** Legacy issuer on the live request path (`index.ts:662-670`).
- **Why-safe (after migration):** identity-platform becomes sole issuer (A1); merchant/staff login no longer routes here.
- **Pre-deletion validation:** identity-platform sole-issuer LIVE + V-SMOKE (login/refresh via identity-platform); confirm no client calls the legacy routes; V-IMPORT.
- **Deletion step:** Remove the auth routes + their mounts; `git rm`/trim `routes/auth.ts`.
- **Post-deletion validation:** V-SMOKE (login works via identity-platform only); V-TEST (auth contract); V-GOV.
- **Rollback Plan:** `git revert` (re-mount legacy routes).
- **Risk:** High (auth) · **Complexity:** L · **Wave:** W2c · **Dependencies:** A1 identity-platform sole issuer LIVE · **Success:** single issuer; legacy routes gone.

#### DEL-025 — Delete `identity-foundation/` shadow stack (1,655 LOC)
- **Current State (LEG-025):** WIRED via `middleware/auth.ts:19` (`auth-verifier-registry`); 18 scaffold files; backed by migration 159.
- **Why-safe (after migration):** identity-platform verification replaces the shadow verifier.
- **Pre-deletion validation:** Rewire `middleware/auth.ts` to identity-platform verification; V-IMPORT (identity-foundation → 0); shadow-compare evidence shows parity (then retire shadow-compare itself).
- **Deletion step:** `git rm -r services/api-gateway/src/identity-foundation`; drop the middleware import.
- **Post-deletion validation:** V-SMOKE (every authed route still verifies); V-TEST; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** High (request-path verifier) · **Complexity:** L · **Wave:** W2c · **Dependencies:** A1 winner LIVE; DEL-024 · **Success:** no shadow stack on the request path.

#### DEL-026 — Delete legacy Supabase `/auth/password/reset`
- **Current State (LEG-026):** Second reset pipeline (`auth.ts:1399-1413`), no `destroyAllUserSessions`.
- **Why-safe (after migration):** Custom single-use + session-kill reset (A1) is the sole flow.
- **Pre-deletion validation:** Confirm all resets route through the custom flow; V-SMOKE.
- **Deletion step:** Remove the legacy reset route.
- **Post-deletion validation:** V-SMOKE (reset kills all sessions); V-TEST.
- **Rollback Plan:** `git revert`.
- **Risk:** Medium · **Complexity:** S · **Wave:** W2c · **Dependencies:** A1 winner; DEL-024 · **Success:** one reset pipeline.

#### DEL-027 — Delete legacy Supabase `/auth/*` public surface
- **Current State (LEG-027):** signin/signup/otp/password public Supabase routes; role-escalation oracle via `supabase.auth.updateUser`.
- **Why-safe (after migration):** identity-platform issues all realms (A1).
- **Pre-deletion validation:** identity-platform realms LIVE; V-IMPORT/V-SMOKE confirm no client depends on the Supabase routes.
- **Deletion step:** Remove the public `/auth/*` routes + mounts.
- **Post-deletion validation:** V-SMOKE; V-TEST; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** High (auth surface) · **Complexity:** M · **Wave:** W2c · **Dependencies:** A1 winner LIVE; DEL-024 · **Success:** no Supabase-native auth surface.

#### DEL-029 — Fold + delete 6 identity contract micro-packages
- **Current State (LEG-029):** `{identity,session,token,permission,organization,audit}-core` (334 LOC) consumed only by `api-gateway` (+ each other).
- **Why-safe:** Fold into `auth-core` sub-path exports; importers re-point to `auth-core`.
- **Pre-deletion validation:** Move the types into `auth-core`; re-point `api-gateway` imports; V-IMPORT (each micro-package → 0).
- **Deletion step:** `git rm -r` the 6 packages; workspace/tsconfig drop.
- **Post-deletion validation:** V-BUILD; V-TEST; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** M · **Wave:** W2c · **Dependencies:** auth-core sub-path exports landed · **Success:** 6 packages → folded; build green.

#### DEL-030 — Delete 4 per-app hand-rolled session libs
- **Current State (LEG-030):** `merchant-control-plane`, `storefront-runtime`, `platform-console` (+identity-platform) each hand-roll session.ts.
- **Why-safe:** `auth-core` session helpers are the single source (A1).
- **Pre-deletion validation:** Replace each app's session lib with an `auth-core` import; V-IMPORT.
- **Deletion step:** `git rm` the forked session libs.
- **Post-deletion validation:** V-BUILD per app; V-SMOKE (session lifecycle per app); V-TEST.
- **Rollback Plan:** `git revert`.
- **Risk:** Medium · **Complexity:** M · **Wave:** W2c · **Dependencies:** auth-core session helpers; A1 · **Success:** one session implementation.

#### DEL-053 — Drop `sessions_v2` table (dormant successor)
- **Current State (LEG-053):** `sessions_v2` (159:113) referenced only by the identity-foundation boundary (dormant); 161 says `sessions` remains authoritative.
- **Why-safe:** Once identity-platform owns one session model and DEL-025 removes the identity-foundation boundary, `sessions_v2` is orphaned.
- **Pre-deletion validation:** V-IMPORT (sessions_v2 → 0 after DEL-025); live-DB confirm no writes.
- **Deletion step:** Paired migration: archive DDL, `DROP TABLE sessions_v2` (+ dependent identity-foundation tables from 159 as a set).
- **Post-deletion validation:** V-BUILD; V-ROLLBACK (DOWN migration recreates).
- **Risk:** Medium · **Complexity:** M · **Wave:** W2c/W5 · **Dependencies:** DEL-025; A1 single session model · **Success:** one session table.

### Wave 1 — Money-correctness legacy-path deletion (gated on A3 canonical ledger LIVE)

> Pattern for DEL-031…033: the legacy un-ledgered path is first *replaced* by a canonical post (TRANSITIONAL fix in W1), the new path is smoked, THEN the legacy RPC is retired. Money paths never delete-before-replace.

#### DEL-031 — Retire legacy capture RPC `confirm_order_payment_with_ledger`
- **Current State (LEG-031):** Writes no `ledger_entries`; called by `checkout-payment-routes.ts:620`, `internal-payment-routes.ts:163`.
- **Why-safe (after migration):** Capture path rewired to a real canonical `post_ledger_transaction` adapter (A3); the misnamed RPC has no caller.
- **Pre-deletion validation:** Canonical capture-post LIVE; V-SMOKE (a storefront capture posts `pa_clearing`/`merchant_payable`); V-IMPORT (RPC callers → 0); reconciliation shows `pa_clearing` balances.
- **Deletion step:** Paired migration dropping the legacy RPC (after callers removed).
- **Post-deletion validation:** V-SMOKE; V-TEST (payments suite); ledger reconciles to zero-or-suspense.
- **Rollback Plan:** DOWN migration recreates the RPC; revert the route rewire.
- **Risk:** High (money) · **Complexity:** L · **Wave:** W1 · **Dependencies:** A3 canonical ledger LIVE (PAY-001 fix) · **Success:** every capture posts canonical; legacy RPC gone.

#### DEL-032 — Retire legacy returns-refund RPC `complete_order_refund`
- **Current State (LEG-032):** Un-ledgered refund; called `returns.ts:279`, `order-execution.adapter.ts:495`.
- **Why-safe (after migration):** Refund path posts canonical (debits `merchant_payable`, credits `refund_clearing`).
- **Pre-deletion validation:** Canonical refund-post LIVE; V-SMOKE (a refund moves the ledger); cumulative-refund cap sees prior refunds (closes PAY-012); V-IMPORT.
- **Deletion step:** Paired migration retiring the legacy refund RPC.
- **Post-deletion validation:** V-SMOKE; V-TEST; `refund_clearing` non-zero under real refunds.
- **Rollback Plan:** DOWN migration; revert route.
- **Risk:** High (money) · **Complexity:** L · **Wave:** W1 · **Dependencies:** A3 canonical ledger LIVE (PAY-002) · **Success:** refunds ledgered; legacy RPC gone.

#### DEL-033 — Retire COD compat-only write path
- **Current State (LEG-033):** `cod-reconciliation.ts:305` writes only `wallet_ledger_entries`.
- **Why-safe (after migration):** Canonical `cod_receivable`/`cod_remittance` modeling (A3) replaces the compat-only write.
- **Pre-deletion validation:** Canonical COD posting LIVE; V-SMOKE (COD order debits receivable, remittance relieves it); V-IMPORT.
- **Deletion step:** Remove the compat-only write branch.
- **Post-deletion validation:** V-SMOKE; V-TEST; COD cash-in-transit visible in the 8-account ledger.
- **Rollback Plan:** `git revert`.
- **Risk:** High (money) · **Complexity:** M · **Wave:** W1 · **Dependencies:** A3 (PAY-003) · **Success:** COD on canonical.

#### DEL-039 — Delete hardcoded `razorpayx` rail branch
- **Current State (LEG-039):** `payoutRail()` returns `'razorpayx'` (`payouts.ts:120`; `queue-execution.adapter.ts:151`; `app-store/shared.ts:322`); metadata falsely stamps `no_custody`.
- **Why-safe (after migration):** PA-split rail (`razorpay_route`/Cashfree) LIVE; LetBuyy never custodies (A3, R-6).
- **Pre-deletion validation:** Split-instruction rail LIVE; V-SMOKE (a payout uses split, not own-balance); `no_custody` metadata now true; V-IMPORT (razorpayx branch → 0).
- **Deletion step:** Remove the `razorpayx` case from `payoutRail()` + adapter default.
- **Post-deletion validation:** V-SMOKE; V-TEST; honesty badge consistent with rail.
- **Rollback Plan:** `git revert`.
- **Risk:** High (money-out) · **Complexity:** M · **Wave:** W1 · **Dependencies:** A3 PA-split rail LIVE (PAY-014) · **Success:** no self-custody rail.

#### DEL-040 — Delete forgeable step-up stub
- **Current State (LEG-040):** `security-controls.ts:27-83` string-length+timestamp check is the only auth on refund/payout.
- **Why-safe (after migration):** Real crypto step-up with stored challenge (A3) replaces it.
- **Pre-deletion validation:** Real step-up LIVE; V-SMOKE (forged string is rejected); V-TEST.
- **Deletion step:** Replace the stub body with the real verifier (in-place removal of forgeable logic).
- **Post-deletion validation:** V-SMOKE; V-TEST (refund/payout require real second factor).
- **Rollback Plan:** `git revert` (NOT recommended — reintroduces forgeable control).
- **Risk:** High (money auth) · **Complexity:** M · **Wave:** W1 · **Dependencies:** A3 real step-up (PAY-018) · **Success:** no forgeable step-up.

#### DEL-041 — Remove GUC-from-param posting in `post_settlement_ledger_transaction`
- **Current State (LEG-041):** Sets tenant GUC from its own parameter (151:23), neutralizing the inner guard; whole app posts through it.
- **Why-safe (after migration):** Tenant derived from ownership (A2/A3); the param-GUC line removed.
- **Pre-deletion validation:** Ownership-derived tenancy LIVE; V-SMOKE (cross-store post is rejected); V-TEST.
- **Deletion step:** Paired migration replacing the function body (drop the param-GUC set).
- **Post-deletion validation:** V-SMOKE; V-TEST; cross-tenant ledger isolation holds.
- **Rollback Plan:** DOWN migration restores the prior function.
- **Risk:** High (tenancy on money) · **Complexity:** M · **Wave:** W1 · **Dependencies:** A2/A3 (PAY-020) · **Success:** no param-GUC bypass.

#### DEL-042 — Retire the 3% GMV rake default (set `commission_bps=0`)
- **Current State (LEG-042):** Default 300 bps + 18% GST-on-fee; contradicts 0%-fee marketing.
- **Why-safe:** A3 permanent 0% fee; the rake logic is retired (config/migration, not code-delete).
- **Pre-deletion validation:** Confirm `commission_bps` default 0 in migration + code; align pricing page.
- **Deletion step:** Migration sets default 0; remove the fee-deduction branch from payout; add a validator scanning for non-zero commission bps.
- **Post-deletion validation:** V-SMOKE (a payout deducts no fee); V-TEST; marketing/code aligned.
- **Rollback Plan:** Revert migration + code.
- **Risk:** High (revenue model) · **Complexity:** M · **Wave:** W1 · **Dependencies:** ARB pricing sign-off (A3) · **Success:** 0% fee enforced; rake gone.

#### DEL-034…038 — Retire compat ledger tables + mutable balances onto canonical
- **Current State (LEG-034…038):** `wallet_ledger_entries`, `partner_payout_ledger_entries`, `gift_card_ledger_entries`+mutable `gift_card_accounts.balance`, `store_credit_ledger_entries`, `ai_credits` balance — single-entry/mutable, the live mobile-money write targets.
- **Why-safe (after migration):** Canonical `ledger_*` (139) with tenders for gift-card/store-credit/AI replaces them; balances become derived (`ledger_account_balance_minor`).
- **Pre-deletion validation:** Canonical tenders LIVE; all writers re-pointed to canonical; backfill reconciled (151/160 bridge); V-IMPORT per table → 0 from app code; live-DB shows no new compat writes.
- **Deletion step:** Per-table paired migration: archive DDL, drop the compat table / mutable column after the canonical balance is authoritative.
- **Post-deletion validation:** V-SMOKE (wallet/gift-card/store-credit balances derive from canonical); V-TEST; V-ROLLBACK (DOWN recreates).
- **Rollback Plan:** DOWN migrations recreate; revert writer re-points.
- **Risk:** High (money truth) · **Complexity:** L · **Wave:** W5 (after W1 ledger LIVE) · **Dependencies:** A3 canonical-as-truth LIVE; DEL-031…033 · **Success:** one ledger paradigm; no mutable balances.

#### DEL-043 — Migrate integer-paise / numeric-rupee money columns to bigint-minor
- **Current State (LEG-043):** 32-bit `integer` paise (overflow ₹2.14cr) + `numeric`-rupee columns.
- **Why-safe (after migration):** bigint minor units everywhere (A3); values copied to `_bigint` shadows then the old columns retired.
- **Pre-deletion validation:** `_bigint` shadows backfilled + reads switched; V-IMPORT (old columns unread); reconcile shadow == old.
- **Deletion step:** Paired migration dropping the legacy money columns (after reads switched).
- **Post-deletion validation:** V-SMOKE; V-TEST; no `integer`/`numeric` money columns remain.
- **Rollback Plan:** DOWN migration recreates columns + backfill from shadow.
- **Risk:** High (money representation) · **Complexity:** L · **Wave:** W5 · **Dependencies:** A3; DB-002/003 migration LIVE · **Success:** bigint-minor only.

#### DEL-054 — Converge dual payment rows (retire `payment_transactions` writes)
- **Current State (LEG-054):** `payments` (142) vs legacy `payment_transactions`; linked by FK; dual payment truth.
- **Why-safe (after migration):** Single `payments` session model (A3); legacy capture (DEL-031) no longer writes `payment_transactions`.
- **Pre-deletion validation:** All capture on `payments`; V-IMPORT (`payment_transactions` writers → 0); historical rows backfilled/linked.
- **Deletion step:** Stop writing `payment_transactions`; retain as read-only history or drop via paired migration after archival.
- **Post-deletion validation:** V-SMOKE; V-TEST; single payment source.
- **Rollback Plan:** DOWN migration; revert capture path.
- **Risk:** High (money) · **Complexity:** L · **Wave:** W5 · **Dependencies:** DEL-031 · **Success:** one payment row model.

### Wave 3 — Product-completeness deletions

#### DEL-010 — Build-exclude + delete GraphQL (dead-by-flag in prod)
- **Current State (LEG-010):** 6 files, `schema.ts` 1,835 LOC; `FEATURE_GRAPHQL="false"` prod / `"true"` staging; ships in the prod bundle unused.
- **Why-safe:** REST routes are the V1 scope; prod never executes GraphQL.
- **Pre-deletion validation:** ARB-record GraphQL out of scope OR build-exclude for prod; confirm no prod client calls `/graphql`; V-IMPORT.
- **Deletion step:** Remove the GraphQL router/mounts + `src/graphql/`; drop the feature flag.
- **Post-deletion validation:** V-BUILD (smaller bundle); V-TEST; V-SMOKE.
- **Rollback Plan:** `git revert`.
- **Risk:** Medium · **Complexity:** M · **Wave:** W3 · **Dependencies:** ARB scope decision · **Success:** no GraphQL in the bundle.

#### DEL-011 — Delete `app-functions-runtime.ts` (R-11, dead-by-flag)
- **Current State (LEG-011):** 623 LOC; `FEATURE_EXTENSIONS="false"` prod; CHK side-door in the live payment route.
- **Why-safe:** R-11 rejects app-functions in the money path; prod never runs it.
- **Pre-deletion validation:** Confirm the payment route has no live extension hook; V-IMPORT.
- **Deletion step:** Remove the runtime + its mount; drop the flag.
- **Post-deletion validation:** V-BUILD; V-TEST; V-SMOKE (checkout has no extension side-door).
- **Rollback Plan:** `git revert`.
- **Risk:** Medium · **Complexity:** M · **Wave:** W3 · **Dependencies:** none · **Success:** no app-functions in the payment path.

#### DEL-020 / DEL-021 — Gate `app-marketplace` / `developer-portal` out of the prod deploy matrix (FREEZE, not delete)
- **Current State (LEG-020/021):** Both deploy to prod (R-11 rejected); `app-marketplace` 19,557 LOC, `developer-portal` 4,903 LOC (no local vercel.json).
- **Why-safe:** FROZEN — keep the code + OAuth2/PKCE seam; stop deploying/maintaining. This is a deploy-matrix removal, not a source delete.
- **Pre-deletion validation:** Confirm no other surface depends on them at runtime; ARB confirms R-11 freeze.
- **Deletion step:** Remove both from `production-deploy.yml:363-366` matrix (optionally keep staging).
- **Post-deletion validation:** V-SMOKE (no prod URL serves them); the rest of the estate deploys clean.
- **Rollback Plan:** Re-add matrix rows.
- **Risk:** Medium · **Complexity:** S · **Wave:** W3 · **Dependencies:** ARB R-11 confirmation · **Success:** rejected surfaces not in prod; code frozen.

#### DEL-022 / DEL-023 — Consolidate the two internal consoles to one (delete the non-survivor)
- **Current State (LEG-022/023):** `platform-console` (5,983 LOC) + `platform-operations-portal` (4,044 LOC), both deployed, both "scaffold."
- **Why-safe (after migration):** A9 mandates ONE thin ops sliver; the survivor gets refund/maker-checker/dispute/KYC; the other is then dead.
- **Pre-deletion validation:** ARB picks the survivor; port the V1 sliver capabilities into it; V-SMOKE on the survivor; confirm no link/route depends on the non-survivor; V-IMPORT.
- **Deletion step:** `git rm -r` the non-survivor app; remove from deploy matrix.
- **Post-deletion validation:** V-SMOKE (ops tasks work in the survivor); V-BUILD; V-GOV.
- **Rollback Plan:** `git revert`.
- **Risk:** Medium · **Complexity:** L · **Wave:** W3 · **Dependencies:** ARB survivor decision; sliver capabilities live in survivor · **Success:** one ops surface.

#### DEL-072 — Remove the mobile parity catalog route then delete the files (974 LOC)
- **Current State (LEG-072):** Routed at `routes.dart:59-60,764,774-776` (`MerchantFeatureDefinitions.byRoute` → `MerchantFeatureScreen`).
- **Why-safe:** TD-5; real merchant screens are the winner; remove the route, then the files are unreferenced.
- **Pre-deletion validation:** Remove the route case + the 2 imports in `routes.dart`; V-IMPORT (`flutter analyze` finds no reference); confirm no deep-link targets the parity routes.
- **Deletion step:** `git rm apps/mobile/merchant-app/lib/screens/parity/{merchant_feature_definitions,merchant_feature_screen}.dart`.
- **Post-deletion validation:** `flutter analyze`; `flutter test`; debug build green.
- **Rollback Plan:** `git revert`.
- **Risk:** Low · **Complexity:** S · **Wave:** W3 · **Dependencies:** none (route removal is self-contained) · **Success:** parity catalog gone; analyze clean.

### Wave 4 — Theme-Liquid deletions (gated on A5 Liquid parity LIVE; LEG-044/048 stay frozen)

#### DEL-045 — Delete storefront-local duplicate section schemas
- **Current State (LEG-045):** `RUNTIME_SECTION_SCHEMAS`+`schemaFor()` re-declare ~11 schemas (`renderer-registry.tsx:66`).
- **Why-safe (after migration):** `theme-engine` `BUILT_IN_SECTION_SCHEMAS` is the single source; storefront consumes it.
- **Pre-deletion validation:** Re-point storefront to engine schemas; V-IMPORT; V-SMOKE (sections render with engine schemas).
- **Deletion step:** Remove the local schema re-declarations.
- **Post-deletion validation:** V-BUILD; V-SMOKE; V-TEST.
- **Rollback Plan:** `git revert`.
- **Risk:** Medium · **Complexity:** M · **Wave:** W4 · **Dependencies:** A5; engine schema consumption landed · **Success:** one schema source.

#### DEL-046 — Delete storefront-local duplicate compose logic
- **Current State (LEG-046):** `resolveStorefrontTemplate` + `template-resolver.ts` re-implement sort/visibility/group vs engine `composeStorefrontTheme`.
- **Why-safe (after migration):** Call the engine's compose for the React path too.
- **Pre-deletion validation:** Re-point to `composeStorefrontTheme`; V-SMOKE (ordering/visibility identical); V-IMPORT.
- **Deletion step:** Remove the duplicate compose code.
- **Post-deletion validation:** V-BUILD; V-SMOKE; V-TEST.
- **Rollback Plan:** `git revert`.
- **Risk:** Medium · **Complexity:** M · **Wave:** W4 · **Dependencies:** A5; DEL-045 · **Success:** one compose path.

#### DEL-047 — Drop legacy `theme_editor_drafts` table (dual draft systems)
- **Current State (LEG-047):** Legacy draft store; `saveDraft` dual-writes legacy + instance-draft + patch.
- **Why-safe (after migration):** `theme_instance_drafts`+`theme_draft_patches` is the winner; cut the legacy write, backfill, drop.
- **Pre-deletion validation:** Stop writing `theme_editor_drafts`; backfill open drafts into the new spine; V-IMPORT (table writers → 0); V-SMOKE (draft save/publish/preview via new spine).
- **Deletion step:** Paired migration: archive DDL, `DROP TABLE theme_editor_drafts`.
- **Post-deletion validation:** V-SMOKE; V-TEST; V-ROLLBACK (DOWN recreates).
- **Risk:** Medium · **Complexity:** M · **Wave:** W4 · **Dependencies:** A5; new draft spine sole writer · **Success:** one draft system.

### Wave 5 — Schema canonicalization + long-tail SAFE_DELETE

#### DEL-050 — Drop 6 superseded theme tables (DDL)
- **Current State (LEG-050):** `theme_templates`, `theme_assets`, `theme_layouts`, `theme_presets`, `theme_block_definitions`, `theme_section_definitions` — 0 code refs.
- **Why-safe:** Runtime uses the `theme_instances`/`theme_packages`/`theme_renderer_manifests` model.
- **Pre-deletion validation:** V-IMPORT (0, HIGH confidence); live-DB writer confirmation (no out-of-band writes); archive DDL.
- **Deletion step:** Paired migration dropping the 6 tables.
- **Post-deletion validation:** V-BUILD; V-SMOKE (theme runtime unaffected); V-ROLLBACK.
- **Rollback Plan:** DOWN migration recreates from archived DDL.
- **Risk:** Low · **Complexity:** S · **Wave:** W5 · **Dependencies:** live-DB writer confirmation · **Success:** superseded theme tables gone.

#### DEL-051 — Collapse dual tenant key on `orders` (`store_id` ≡ `site_id`)
- **Current State (LEG-051):** Both NOT NULL, kept equal by `sync_orders_tenant_keys` trigger; spans 108/130/158.
- **Why-safe (after migration):** `site_id` canonical; `store_id` → generated/compat column; retire the sync trigger.
- **Pre-deletion validation:** Confirm all code reads `site_id` (or a compatible accessor); V-IMPORT on direct `store_id` reads; live-DB `site_id == store_id` for all rows.
- **Deletion step:** Paired migration: make `store_id` generated-from-`site_id` (or drop after consumers move); drop the sync trigger.
- **Post-deletion validation:** V-SMOKE (orders create/read); V-TEST; V-ROLLBACK.
- **Rollback Plan:** DOWN migration restores the column + trigger.
- **Risk:** High (orders tenancy) · **Complexity:** L · **Wave:** W5 · **Dependencies:** A2; consumers moved to `site_id` · **Success:** one tenant key; no sync trigger.

#### DEL-052 — Collapse dual user tables (`users` → view over `users_custom`)
- **Current State (LEG-052):** `users_custom` is the credential store (FKs point at it); `users` is profile-only.
- **Why-safe (after migration):** `users_custom` canonical; `users` becomes a view.
- **Pre-deletion validation:** Confirm profile reads can source from a `users` view; V-IMPORT; live-DB FK integrity.
- **Deletion step:** Paired migration: replace `users` table with a view over `users_custom` (+ profile columns).
- **Post-deletion validation:** V-SMOKE; V-TEST; V-ROLLBACK.
- **Rollback Plan:** DOWN migration restores the table.
- **Risk:** High (identity schema) · **Complexity:** L · **Wave:** W5 · **Dependencies:** A2; A1 identity model settled · **Success:** single canonical user table.

#### DEL-055 / DEL-056 — Drop JSONB dual models (`orders.items`, `products` variants)
- **Current State (LEG-055/056):** Relational `order_items`/`product_variants` declared authoritative but JSONB kept "for compatibility"; reconcile report-only.
- **Why-safe (after migration):** Relational is the winner; converge then drop JSONB.
- **Pre-deletion validation:** Confirm all reads use relational; reconcile JSONB == relational; V-IMPORT on JSONB column reads.
- **Deletion step:** Paired migration dropping the JSONB columns.
- **Post-deletion validation:** V-SMOKE (order/product read+write); V-TEST; V-ROLLBACK.
- **Rollback Plan:** DOWN migration recreates JSONB + backfill.
- **Risk:** High (orders/products) · **Complexity:** L · **Wave:** W5 · **Dependencies:** A4; relational sole read source · **Success:** no JSONB dual model.

#### DEL-057 — (KEEP_TEMPORARILY) retain partition shadows; mirror disabled in DEL-068
- **Current State (LEG-057):** 8 `_partitioned` shadow tables; the 131 mirror is disabled by DEL-068.
- **Why-safe:** Partitioning is V1-deferred to P2; the shadow tables are the allowed seam — KEEP empty.
- **Pre-deletion validation:** n/a (not deleted now).
- **Deletion step:** None this program; revisit at P2.
- **Post-deletion validation:** n/a.
- **Rollback Plan:** n/a.
- **Risk:** Low · **Complexity:** S · **Wave:** W5 · **Dependencies:** DEL-068 (mirror off) · **Success:** shadows retained empty; mirror off.

#### DEL-058 — Renumber the duplicate migration `129`
- **Current State (LEG-058):** Two `129_*` files risk version-collision.
- **Why-safe:** Renumber one (e.g. `129_mobile_customer_segments` → next free) with a ledger note.
- **Pre-deletion validation:** Confirm both already applied live (UNVERIFIED — check Supabase migration history); choose the safe renumber.
- **Deletion step:** Rename one file; add a governance note; (if live-applied, encode an explicit ordering record rather than re-running).
- **Post-deletion validation:** V-GOV (no duplicate prefix); migration-pairing validator green.
- **Rollback Plan:** Rename back.
- **Risk:** Medium (migration lineage) · **Complexity:** S · **Wave:** W5 · **Dependencies:** live-apply confirmation · **Success:** no duplicate prefix.

#### DEL-059 — Author the 3 missing rollbacks (138/140/157) + pairing validator
- **Current State (LEG-059):** 138, 140, 157 have no paired rollback.
- **Why-safe:** Closes the gap; adds a validator so the rule self-enforces.
- **Pre-deletion validation:** Write the 3 rollback files; V-ROLLBACK (each DOWN reverses its forward on a scratch DB).
- **Deletion step:** Add `rollback/138_*.rollback.sql`, `140_*`, `157_*`; add a validator: every `migrations/1[3-9][0-9]_*.sql` (≥138) needs a paired rollback.
- **Post-deletion validation:** V-GOV (pairing validator green).
- **Rollback Plan:** n/a (adds files).
- **Risk:** Low · **Complexity:** S · **Wave:** W5 · **Dependencies:** none · **Success:** 100% pairing ≥138; validator live.

#### DEL-060 — Add missing `DROP COLUMN` to 151/160 rollbacks
- **Current State (LEG-060):** Forward-only `ADD COLUMN` residue (`canonical_ledger_transaction_id`, `_bigint`).
- **Why-safe:** Symmetric rollback; no behavior change forward.
- **Pre-deletion validation:** V-ROLLBACK (the amended DOWN now drops the columns on a scratch DB).
- **Deletion step:** Add the `DROP COLUMN` statements to `151.rollback`/`160.rollback`.
- **Post-deletion validation:** V-GOV; V-ROLLBACK.
- **Rollback Plan:** n/a.
- **Risk:** Low · **Complexity:** S · **Wave:** W5 · **Dependencies:** none · **Success:** symmetric rollbacks.

#### DEL-061 — Drop ~37 product-dead tables (DDL, after writer confirmation)
- **Current State (LEG-061):** ops-theater/diagnostic/superseded tables ≈ 9% of the 419-table surface (excludes the 6 theme tables in DEL-050).
- **Why-safe:** 0 code refs (DB §6.1); written (if at all) by ops scripts, read by nothing in the product.
- **Pre-deletion validation:** V-IMPORT (0, per table); **live-DB write-count confirmation** (`pg_stat_user_tables`) — drop only tables with no recent writers; exclude the 4 RPC-mediated (`runtime_leases`, `session_token_rotation_events`) + 4 partition-default false positives; archive DDL.
- **Deletion step:** Paired migration(s) dropping the confirmed-dead tables in batches.
- **Post-deletion validation:** V-BUILD; V-SMOKE (product unaffected); V-ROLLBACK.
- **Rollback Plan:** DOWN migration recreates from archived DDL.
- **Risk:** Medium (DB surface) · **Complexity:** M · **Wave:** W5 · **Dependencies:** live-DB writer confirmation · **Success:** ~37 dead tables gone; schema lean.

#### DEL-062 — Drop the duplicate `provider_payment_id` unique index
- **Current State (LEG-062):** `idx_..._global` (107:135) ≡ `..._v1_uniq` (142:148), same predicate.
- **Why-safe:** Redundant; keep one unique index.
- **Pre-deletion validation:** Confirm both are identical predicates; choose the canonical name.
- **Deletion step:** Paired migration dropping the duplicate index name.
- **Post-deletion validation:** V-GOV; V-SMOKE (uniqueness still enforced).
- **Rollback Plan:** DOWN recreates the dropped index.
- **Risk:** Low · **Complexity:** S · **Wave:** W5 · **Dependencies:** none · **Success:** one unique index.

---

## 5. Rollback strategy (program-level)

- **Code deletions:** each deletion is an isolated commit; rollback = `git revert <sha>` followed by V-BUILD. Large deletions (DEL-006 distributed-runtime) are kept as single commits specifically so the revert diff is clean.
- **DB deletions:** never a bare `DROP`. Every table/column/index drop ships as a **paired migration** (forward DROP + DOWN that recreates from archived DDL). V-ROLLBACK applies the DOWN on a scratch DB before merge. This closes the existing rollback-coverage gap (LEG-059/060) as a precondition for the schema waves.
- **Deploy-level:** Cloudflare Workers + Vercel keep previous deployments; any `DELETE_AFTER_MIGRATION` that regresses V-SMOKE is reverted at the deploy layer immediately, then `git revert`ed.
- **Governance:** validator/manifest/topology changes (DEL-063/064/065) are revertible commits; because they gate CI, they land in the same change set as the artifact they describe so a revert restores a consistent state.
- **Money waves (W1):** every money-path deletion gates on the canonical-ledger winner being LIVE and smoked; if reconciliation breaks, the winner is rolled back (deploy + revert) before the legacy path is touched — the legacy path is only retired after the winner proves correct.

## 6. Sequencing summary (one-line gates)

1. **W0:** restore deploy pipeline (DEL-0), commit the auth-switch fix (DEL-028), collapse staging workflows (DEL-067), move secrets (DEL-069a).
2. **W2a:** delete the 6 zero-importer packages (DEL-001…006) atomically with their validators (DEL-063) + manifest slim (DEL-064); plus DEL-009, DEL-073.
3. **W2b:** governance/infra/doc SAFE_DELETE + topology/AGENTS regen + domain canonicalization (DEL-065…077).
4. **W2c:** unwire+delete runtime-composition (DEL-008) and the legacy identity stack (DEL-024…030, 053) once identity-platform + storefront query-layer are LIVE.
5. **W1:** retire legacy money paths (DEL-031…042, 054) once the canonical ledger + PA-split rail are LIVE and smoked.
6. **W3:** product-scope deletions (DEL-010, 011, 020…023, 072).
7. **W4:** theme schema/compose/draft deletions (DEL-045…047) once Liquid is at parity; the live React renderer stays frozen.
8. **W5:** schema canonicalization + long-tail DDL (DEL-034…038, 043, 050…062).

*End of Safe Deletion Plan. Cross-referenced to `LEGACY_ERADICATION_REGISTER.md`. Evidence pinned at `stepup/main` @ `c4fc3cd6`, 2026-06-10.*
