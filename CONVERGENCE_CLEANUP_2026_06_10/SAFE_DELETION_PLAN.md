# SAFE DELETION PLAN — Convergence Cleanup (Phase 4)

**Phase:** 4 of the Convergence Cleanup Program — SAFE DELETION. **Mode:** CLASSIFICATION ONLY. Nothing is deleted or modified. Read-only git. No new architecture. No commits. No codex prompts. This report is the only file written.

**Repo:** `/Users/saai_sidd/Git/Letbuyy_Store` · branch **`stepup/main`** @ HEAD **`5cf9e64e`** (re-verified this phase: `git rev-parse HEAD` = `5cf9e64e7e62482adaf4b65e74d8cbca754a0a15`) · **+30** over `main` (`git rev-list --count main..HEAD` = 30) · deploy branch **`main`** is the only branch production CI triggers from · working tree dirty **512 D / 410 M / 78 ??** (`git status --porcelain` re-counted this phase).

**Taxonomy (exactly 3 classes, as mandated):** **DELETE** (physically remove — junk, dead, zero-consumer, or already worktree-deleted) · **ARCHIVE** (historical value → move under `docs/archive/`; for already-archived-but-untracked the action is COMMIT) · **KEEP** (active, needed, canonical, or load-bearing — delete-never or delete-only-after-a-named-condition). Where a row is deletable only after a convergence condition, it is **KEEP (conditional)** with the exact precondition stated — it is NOT a present-tense DELETE.

**Fresh-derivation posture.** Every "no consumer / safe to delete" claim below was re-grepped this phase against live `apps/`, `services/`, `packages/`, `scripts/`, `package.json`, `.github/`, and `config/` (results cited inline as **(verified)**). Prior reports (`REPOSITORY_TRUTH_AUDIT_2026_06_10/DELETION_CANDIDATE_REGISTRY.md`, `CONVERGENCE_AUDIT_2026_06_10/DELETE_CANDIDATES.md`) were consulted for completeness; their counts were independently re-checked and two were corrected (see §1).

---

## 1. Executive Summary

1. **The repository's defining fact inverts normal deletion logic, and it makes the working tree itself the single most dangerous thing to "clean."** Three realities co-own every domain: `main` (the only deploy trigger, condemned — ships account-takeover/3% rake/anon leaks), `HEAD` (+30), and the **uncommitted working tree** (the hardened end-state — the *only* reality conforming to canon, carrying migrations 162–166, the money/identity validators, the Constitution, both 2026-06-10 archives — with **zero git history anywhere**). One `git clean -fd` permanently destroys that only-correct reality; one `git checkout .` resurrects the condemned regime. **Therefore the global precondition for EVERY physical deletion below is a prior Phase-0 commit of the working tree, and the operation must NEVER begin with `git clean -fd` or `git checkout .`.**

2. **The "commit trap" is real and was re-verified.** 512 paths are already tracked-as-deleted (`git status` `^ D` count = 512), and their archive copies exist **only as untracked files** (the `docs/archive/*-2026-06-10/` trees are 100% `??`). Committing the deletions without first committing the untracked archives loses both the deletion's provenance and the only surviving copy. So Batch 0 below is "commit the working tree" — it is not a delete, it is the gate every delete depends on.

3. **`main` still deploys the loser reality, so no loser may be physically deleted until its winner is committed AND deployed.** The losers this plan removes are overwhelmingly the *currently-deployed* reality (the React renderer serving 100% of stores, the no-ledger capture path, the 62-route second backend in merchant-control-plane, the multi-region/survivability machinery). A loser whose winner is uncommitted/unwired cannot be deleted — every such row is **KEEP (conditional)** with a testable precondition, not DELETE.

4. **Two whole clusters look like obvious deletes but are LOAD-BEARING or CANON-PROTECTED and would FAIL CI or BLANK PRODUCTION if removed today.** (a) The **multi-region / survivability / chaos / load / certification** machinery (~60 artifacts) is **machine-mandated by the gate itself** — `whole-repo-end-state-validator.mjs:172-177` and `survivability-governance-validator.mjs:94,106` *require* `globalRegions:[india,apac,eu,us]` **(verified, exact lines)** while the Constitution forbids multi-region; removing the artifacts FAILS the gate (the GATE-1 self-block). (b) The **React theme renderer + 20 frozen sections** is the runtime default for every store; Liquid cannot render a real store; deleting it blanks every storefront.

5. **The genuinely-safe DELETE set is small and almost entirely junk / empties / generated-falsehoods / zero-reference code / already-executed worktree deletions.** It is bounded, high-confidence, and listed in §6 and Batches 0–3.

6. **Corrections to prior counts (fresh this phase).** `.DS_Store` files = **11 locations** (`database/`, root, `config/`, `tests/`, `docs/research/`, `docs/`, `docs/auth/`, `docs/themes/`, `load/`, `.git/`, `infrastructure/`) — the prior report said 3 (verified `find -name .DS_Store`). `identity-residency.schema.json` is **NOT 0-ref** — it is the `$schema` target of `config/runtime/identity/residency.json` (verified); deleting only the schema breaks that reference, so the pair must be cut together (and `residency.json` itself has no live validator/script consumer — verified). `.turbo/` cache = **1.8 GB** (verified `du`). Generated-intelligence docs = **80** (verified `grep -rl "GENERATED BY scripts/generate-repository-intelligence"`). The 8 worktree-deleted package roots have **zero live imports** — the only `@letbuyy/*` references are negative test assertions asserting their absence (verified).

---

## 2. Method & Safety Preconditions

### 2.1 Three named, reusable preconditions (referenced by every batch)

- **[COMMIT]** — Phase-0 `git add -A && git commit` on `stepup/main`, committing the untracked canon (archives, migrations 162–166, money/identity validators, EXECUTION_LEDGER/SKIPPED_HUMAN_DECISIONS, the governance/audit dirs) **together with** the 512 tracked deletions, so history preserves both sides of the commit trap. **The operation must never start with `git clean -fd` or `git checkout .`.** This is the global precondition for all physical deletion.
- **[WINNER-DEPLOYED]** — the loser's winner is committed on `stepup/main`, `stepup/main` is promoted to `main`, and `main` is deployed (Vercel/Cloudflare) so production no longer serves the loser. Required before deleting any currently-deployed loser (React renderer, second backends, deployed frozen-app rows).
- **[SURVIVABILITY-UNHOOK]** — the ARB-ratified repeal that releases the multi-region/survivability self-block, executed as one atomic change that keeps the gate green: (1) ARB records the survivability-restore as repealed vs the Constitution's no-multi-region clause; (2) strip the `globalRegions:[india,apac,eu,us]` assertions from `whole-repo-end-state-validator.mjs:172-177` and `survivability-governance-validator.mjs:94,106`; (3) delete `survivability-governance-validator.mjs` and remove `validate:survivability` + `validate:production-certification` (+ the 6 theater aliases) from `package.json` and the workflows that call them; (4) remove `regions.globalRegions` from `config/runtime/production-topology.json`; (5) retarget the reserved-service manifests' `governanceDocs` off the theater docs; (6) re-run `pnpm run validate:governance` green. Only after this may chaos/load/multi-region config/certification validators/theater docs be removed.

### 2.2 Why the working tree is the canon (and the clean ban)

The working tree is the only reality where commission is 0% (mig 162), the anon RLS leaks are closed (mig 163), tenant GUC is enforced (mig 164), money paths are canonical (mig 165), checkout handoff/inventory exists (mig 166), and the money+identity validators exist. None of this is committed; a clean checkout has **no money gates at all** and silently omits 162–166. This is why no batch may precede [COMMIT], and why `git clean -fd`/`git checkout .` are categorically forbidden as a cleanup step.

### 2.3 Verification scope

Live infra/DB/provider/CI-history state is out of scope (UNVERIFIED) per the audit envelope. Every condition that depends on live state (writer probes, applied-migration ceiling, deploy status, `pg_policies`) is carried as **KEEP (conditional, live-probe)** with the probe named in §9, not as DELETE.

---

## 3. Per-Artifact-Type Classification Tables

> Columns: **Path** · **Class** · **Reason** · **Dependencies (fresh grep)** · **Risk** (None/Low/Med/High + danger) · **Precondition**.

### 3.1 Dead packages (8 worktree-deleted roots + zero-import live packages)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| `packages/{app-engine, application-services, distributed-runtime, extension-host, orchestration, projection-runtime, runtime-composition, search-core}` (8 roots, ~154 files, present at HEAD, **gone on disk** — verified `[ -d ] = GONE` ×8) | **DELETE** (finalize) | Rejected-architecture (distributed/CQRS) packages; worktree already removed them; deletion itself asserted by `whole-repo-end-state-validator.mjs` | **ZERO live imports** — only matches for `@letbuyy/{runtime-composition,…}` are negative assertions in `tests/federation/*` and `tests/governance/phase-b-validators.test.mjs` asserting absence (verified) | Low — git history preserves; tests already assert absence | **[COMMIT]** |
| `packages/dart/services` (old `letbuyy_services`, deleted in WT) | **DELETE** (finalize) | Rejected Dart service layer; worktree removed it | Zero remaining references (prior reg; consistent with melos pubspec) | Low | **[COMMIT]** |
| `packages/typescript/ui/src/mobile-tokens.ts` (deleted in WT) | **DELETE** (finalize) | Replaced by the DTCG bridge; mobile-token generator `--check` passes without it | Zero importers | Low | **[COMMIT]** |
| `tsconfig.workspace.json:68` → `./packages/typescript/utils` (the **reference**, not a dir) | **DELETE** (the line) | GHOST — `packages/typescript/utils` is ABSENT on disk (verified `UTILS-ABSENT`); the dangling project ref breaks `tsc -b` | Referenced only by this one tsconfig line | Low — fixes a broken build ref | **[COMMIT]** |
| 18 npm lib roots (`shared-types, auth-core, identity-core, token-core, session-core, permission-core, organization-core, audit-core, tenant-core, commerce-core, checkout-core, billing-core, cms-core, event-core, notification-core, payments, infrastructure, theme-engine`) | **KEEP** | All in `pnpm-workspace.yaml` (verified) and each has ≥1 real inbound import; none zero-import | Live importers across apps/services | — | — |
| `packages/typescript/ui`, `packages/theme-engine`, `packages/dart/ui_kit` | **KEEP** (canonical) | Design-token/component source; Liquid theme engine; mobile DTCG token source | 331 / many importers | — | — |
| ui_kit dup pairs — one of (`empty_state.dart`,`empty_state_widget.dart`); one of (`error_widget.dart`,`error_view.dart`) | **DELETE** (one of each pair) | Kit-internal duplication | Pick the un-exported/unused twin via a kit-surface check | Low | **[COMMIT]** + pick-correct-twin |

### 3.2 Dead services (6 reserved manifest-only)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| `services/{checkout-runtime, search-service, media-service, notification-service, event-bus, analytics-pipeline}` (6 reserved, **2 files each** — verified) | **KEEP** | Manifest-only existence is **validator-MANDATED**: `whole-repo-end-state-validator.mjs:59-78` asserts each reserved root has a `runtimeCategory:"reserved-*"` manifest AND is represented as `reserved` in production-topology (verified) | The gate reads these roots; deleting them FAILS the gate | **High — deleting fails CI** | Delete-never while end-state law stands (would require amending the validator AND topology — not in scope) |
| Their `runtime.manifest.json` (sed-garbled prose + theater `governanceDocs`) | **KEEP** (content rewrite, not delete) | Slot validator-mandated; the fix is to repair garbled prose + retarget theater-doc refs | Validator reads the manifest fields | Med if deleted | n/a (rewrite, not delete) |
| `services/{api-gateway, mobile-bff, webhook-service, queue-workers}` | **KEEP** (canonical) | The real deployed runtimes; api-gateway is the sole commerce/money/identity backend | Live | — | — |

### 3.3 Dead apps (frozen four + 2 reserved mobile stubs)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| `apps/mobile/{shopper-app, operator-app}` (reserved, **2 files each** — verified) | **KEEP** | Existence + manifest-only-ness validator-MANDATED (`whole-repo-end-state-validator.mjs:59-78`, reservedMobileRuntimeRoots) | Gate reads them | **High — deleting fails CI** | Delete-never while end-state law stands |
| `apps/developer-portal` (frozen, UI-only, **NO vercel.json** — verified) | **ARCHIVE** | Weakest frozen app; not deployable; CLAUDE.md = "frozen or pending consolidation" | Gateway may still serve dev endpoints; verify before move | Med | After ARB consolidation decision + [COMMIT] |
| `apps/platform-operations-portal` (frozen, has vercel.json) | **ARCHIVE** | PHASE-C resolved the ops survivor to `platform-console`; this is the superseded twin | Staging deploys it; port any unique modules first | Med | After unique modules ported to `platform-console` + [COMMIT] |
| `apps/app-marketplace`, `apps/theme-marketplace` (frozen, have vercel.json) | **KEEP** (frozen, not deletion-ready) | Gateway still serves `/app-store`, `/app`, `/themes/:slug/reviews|purchases|downloads`; ~50 `app_*` tables live; marketplace Zod types live inside active theme-engine; staging deploys them | Live gateway routes + DB | High if deleted (breaks live endpoints) | Not deletable this program; only their staging/projects rows are DELETE (§3.10) |
| `apps/{storefront-runtime, merchant-control-plane, identity-platform, platform-console}` | **KEEP** (canonical) | The canonical runtimes | Live | — | — |
| `apps/marketing-site` | **KEEP** | Small, deployed | Live | — | — |
| `apps/storefront-runtime/src/app/demo/urban-kicks/` + `src/lib/demo/urban-kicks-demo.ts` | **DELETE** | Previous-product (urban-kicks) demo residue, live-routed | `urban-kicks` referenced by demo page + demo lib + preview/product/store-service (verified 11 files — but the `/demo/urban-kicks/` route + its demo lib are the residue; the store-service/preview refs are the seam to cut with it) | Low–Med (it is live-routed; confirm preview/store-service refs are demo-only) | **[COMMIT]** |
| `apps/storefront-runtime/next.config.ts` → `firebasestorage.googleapis.com` remotePattern | **DELETE** (the entry) | Firebase tree is archive-only; dangling host-trust grant | Single config entry | Low | **[COMMIT]** |

### 3.4 Dead prompts / missions (cross-ref Phase 6)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` (the prompt factory) | **DELETE** (or ARCHIVE if any archive-execution risk is unacceptable) | Mass-produces rejected-architecture missions; facts already wrong; zero forward value | No live consumer; history retains | Low | **[COMMIT]** (Phase 6 owns the prompt-cut detail) |
| `docs/Codex_waves/TERMINAL_{1..6}_*.md` (6 paste-ready `/goal` relaunchers — verified present) | **DELETE** | Only function is one-paste re-execution of off-canon missions; underlying ledgers already archived | No live consumer | Low | **[COMMIT]** |
| `docs/Codex_waves/CODEX_{EXTENSION_PLATFORM,THEME_BLOCK_ENGINE,DEVELOPER_ECOSYSTEM}_MISSION.md` | **DELETE** (or ARCHIVE) | Instruct creating rejected `extension-host`/`app-engine` + frozen dev-portal | No live consumer | Low | **[COMMIT]** |
| `docs/Codex_waves/` remainder (26 files total — verified) | **ARCHIVE** (dated folder) | Largest at-large paste-ready prompt cluster; declares rejected packages "Stable", rewires `.store` CI | No enforcement below root | Low | **[COMMIT]** (move under `docs/archive/`) |
| `docs/agents/` (40 files — verified) | **ARCHIVE** | Self-declared "Mandatory Reading Order" frozen 2026-05-24; dead `backend/workers/api` topology; instructs regen via the retired generator | Ranked local authority by CLAUDE.md precedence | Med — see watchlist (precedence wiring) | After confirming no nested-precedence break + [COMMIT] |
| `tasks/todo.md`, `memory/lessons.md` | **ARCHIVE** | 2026-03-01 fossils recording the now-forbidden scan-generate-AGENTS playbook | `AGENTS.md` AGENT-R16 mandates reading `tasks/todo.md` (verified pattern); LEG-078 vs AGENT-R16 contradict | Med | Amend AGENT-R16 + resolve LEG-078 first, then [COMMIT] |
| `tasks/env-setup-skips.md` | **KEEP** | Active skip-log | — | — | — |

### 3.5 Dead markdown — root + docs subtrees (Phase 5 owns the doc-level cut; summarized here)

| Group | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| **80 generated-intelligence docs** (`docs/README.md` + ~78 `docs/<topic>/README.md` + `docs/architecture/{master-system-intelligence,README}.md`) — verified count 80 | **DELETE** | Stamped `GENERATED 2026-06-08`; describe `letbuyy.store`, "19 migrations" (real 166), deleted packages; generator hard-retired (exits 1) → unregenerable falsehoods; git history preserves | Generator retired; no live consumer of the generated text | Low | **[COMMIT]** |
| `docs/conflicts/`, `docs/future-roadmap/` (1 generated README each — verified) | **DELETE** | Contain only generated READMEs enumerating dead `FORENSIC_REPORT/*` rows | None | Low | **[COMMIT]** (after the generated-tree delete) |
| `docs/audit/` (19), `docs/audits/apps-platform/` (23) — verified | **ARCHIVE** (dangerous build programs) | Shopify-OS-2.0 maximalist + apps-platform-on-rejected-packages build programs | Phase-6-flagged; no enforcement | Low | **[COMMIT]** (move) |
| `docs/commerce-os-audit/` (10), `docs/analysis/` (4) — verified | **ARCHIVE** | "Billion-dollar commerce OS" multi-region roadmap; pre-V1 | None | Low | **[COMMIT]** |
| docs-root prompt/plan family (`CODEX_LETBUYY_FOUNDATION_MISSION.md`, `LETBUYY_MASTER_EXECUTION_PLAN.md`, `LETBUYY_CODEX_IMPLEMENTATION_MASTER.md`, `P0..P4_*_MASTER.md`); superseded master audits (~25); `docs/LETBUYY.md`; frozen-app mission families | **ARCHIVE** | Dangerous/obsolete pre-rewrite execution layer + superseded audits | None enforced | Low | **[COMMIT]** |
| `docs/governance/` operative survivors (~76 benign + 15 retargeted incl. `repository-topology.md`) | **KEEP** (content rewrite where stale) | Operative governance; `repository-topology.md` shows 12-app topology w/o frozen markings → content fix | Validators/docs reference them | — | n/a (rewrite) |
| `docs/{design-system,seo,research,env-setup}`, `docs/LOCAL_DEV.md` | **KEEP** (canonical reference) | Active design/SEO/research/dev reference; LOCAL_DEV matches `scripts/dev/` | Live | — | — |
| `docs/archive/**` (865 files — verified; 8 newest 2026-06-10 dirs are 100% untracked) | **ARCHIVE** (correct location; delete-never) → action = **COMMIT** | It IS the history; FORENSIC_MASTER/GOVERNANCE_HARDENING/FOUNDATION_AUTOPSY etc. exist nowhere else; `git clean -fd` destroys them | Sole copies | High if cleaned | **[COMMIT]** (highest-priority preserve) |

### 3.6 Dead architecture docs / missions

| Path | Class | Reason | Dependencies | Risk | Precondition |
|---|---|---|---|---|---|
| `docs/architecture/master-system-intelligence.md` (the 165k-line generated dump) | **DELETE** | Generated falsehood index (part of the 80); the only "consumer" of many orphan validators' names is this file itself | Self-referential | Low | **[COMMIT]** |
| `docs/mobile-migration-blueprint/` (empty, 0 files — verified) | **DELETE** | Empty husk; contents git-history-only | None | None | **[COMMIT]** |
| `config/runtime/production-topology.json` + `deployment-topology.json` + schemas | **KEEP** (canonical) | Machine truth (11 active / 6 reserved / 4 frozen; matches disk) | Consumed by validators | — | — |

### 3.7 Dead missions / governance (multi-region / CQRS survivor docs)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| 13 contradicting `docs/governance/` docs (`multi-region-runtime-`, `failover-`, `failover-certification-`, `chaos-`, `chaos-engineering-`, `chaos-certification-`, `runtime-composition-`, `distributed-execution-survivability-`, `replay-safety-`, `shadow-traffic-`, `global-operations-`, `sre-certification-governance.md`) | **ARCHIVE** → `governance-theater-2026-06-10/` | Present-tense rejected-arch law an agent will ingest as authority | `runtime-composition-governance.md` routes through deleted V1-rejected packages; several are cited by reserved-service `governanceDocs`; `replay-safety-governance.md` references `replay-safety-contract.json` (verified) | **High** — moving before retargeting the manifest `governanceDocs` breaks the manifest contracts | **[SURVIVABILITY-UNHOOK]** (manifest retarget rides the same change) |
| 4 validator-required theater docs (`operational-resilience-`, `deployment-proof-`, `deterministic-runtime-`, `infra-recovery-governance.md`) | **ARCHIVE** | Existence asserted by `survivability-governance-validator.mjs:24-29` | Validator reads them | High — archiving fails the gate | **[SURVIVABILITY-UNHOOK]** |
| 6 theater runbooks (`docs/runbooks/{regional-failover, survivability-suite, infra-recovery, chaos-drill, event-replay, live-certification-execute}.md`) | **ARCHIVE** | `survivability-suite.md`/`infra-recovery.md` are validator-required (`survivability-governance-validator.mjs:28-29`) | Validator reads | High — gate fails | **[SURVIVABILITY-UNHOOK]** |

### 3.8 Dead validators (orphans / aliases / the 2 self-mandating)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| **11 orphan validators** (`contracted-domain-event-ingress-`, `custom-domain-abuse-screening-`, `custom-domain-reconciler-`, `gateway-events-client-`, `mobile-domain-parity-`, `no-orphan-webhook-delivery-queue-`, `observability-producer-`, `registrar-provider-`, `replayable-secret-persistence-`, `shopper-identity-seam-`, `vercel-domain-automation-validator.mjs`) | **DELETE** | Zero live wiring | **0 external refs each** — not in the `validate-governance.mjs` array (verified comm against the 91-validator array), not in `package.json` scripts, not in `.github/workflows`; the only matches are archived docs/ledgers + the generated `master-system-intelligence.md` (verified) | Low | **[COMMIT]** |
| 77 worktree-deleted validators (HEAD-only; the distributed/CQRS/cloudflare-runtime set, e.g. `crdt-convergence-`, `distributed-consistency-`, `lease-heartbeat-`, `fencing-token-`, `projection-rebuild-validator.mjs`) | **DELETE** (finalize) | Rejected-architecture validators; worktree already removed; git history acceptable for code | None live | Low | **[COMMIT]** |
| `survivability-governance-validator.mjs` + the 10 `validate:production-certification` validators (`provider-execution-`, `distributed-contention-`, `replay-scale-`, `crash-recovery-`, `telemetry-ingestion-`, `benchmark-certification-`, `provider-failover-certification-`, `partition-recovery-`, `immutable-evidence-`, `production-recovery-drill-`) + `operational-proof-validator.mjs` + `production-certification-common.mjs` | **KEEP (conditional)** → DELETE after unhook | Theater certification cluster; but locked: `package.json:43,55` wires them, `whole-repo-end-state-validator.mjs` references the chain, and the 10 import `production-certification-common.mjs` (verified import fan-out) | Wired in package.json + keystone validator (verified) | **High — removing fails CI** | **[SURVIVABILITY-UNHOOK]** |
| The 2 self-mandating multi-region blocks: `whole-repo-end-state-validator.mjs:172-177` + `survivability-governance-validator.mjs:94,106` (both require `globalRegions:[india,apac,eu,us]` — verified exact lines) | **KEEP (conditional)** — strip the region block from the keystone, delete `survivability-governance` wholesale | `whole-repo-end-state` is the keystone (asserts the whole end-state) — keep it, remove only its region loop; `survivability-governance` deletes wholesale | The GATE-1 self-block: Constitution forbids multi-region, gate mandates it | **High** | **[SURVIVABILITY-UNHOOK]** |
| 6 `package.json` theater aliases (`validate:{distributed-execution, durable-execution, distributed-survivability, operational-certification, replay}` + one more → all run `no-scan-generated-agents-validator.mjs`; verified lines 39-42,52) | **KEEP (conditional)** → remove the aliases after unhook | Green names assert uncovered coverage; already neutered to a no-op redirect | `architecture-governance.yml` callers must be retargeted in the same change | Med | **[SURVIVABILITY-UNHOOK]** |
| `validate:rollback` ≡ `validate:migrations` (both → `migration-safety-validator.mjs`, verified) | **KEEP (conditional)** → drop the rollback alias | Green asserts rollback coverage that doesn't exist | Callers | Med | Author the real rollback validator first |
| `scripts/generate-repository-intelligence.mjs` (retired, exits 1 — verified `RETIRED_REPOSITORY_INTELLIGENCE_GENERATOR = true`) | **KEEP (canonical)** | Its retirement is LAW — `repository-intelligence-validator.mjs:41` asserts the generator is retired; deleting the file breaks the assertion | The validator reads it (verified) | **High — deleting fails the gate** | Delete-never |
| 91 gate-wired validators + helpers (`governance-common.mjs`, `phase-b-common.mjs`, …) incl. 22 untracked Phase B/C/D money/identity validators | **KEEP (canonical)** | The gate; all in the `validate-governance.mjs` array (verified all 91 present on disk, no dangling refs); the money/identity validators are untracked → a clean clone has NO money gates | The gate orchestrator | — | **[COMMIT]** (preserve the untracked ones) |

### 3.9 Dead scripts (retired generator + survivability suite)

| Path | Class | Reason | Dependencies | Risk | Precondition |
|---|---|---|---|---|---|
| `infrastructure/scripts/operations/` survivability/certification suite (`run-survivability-suite.mjs`, `run-live-drills.mjs`, `generate-certification-report.mjs`, `phase4-live-certify.mjs`, `phase4-ultimate-validate.mjs`, `run-operational-certification.mjs`, `run-provider-production-certification.mjs`, `verify-live-operations.mjs`) + `infrastructure/scripts/{load,chaos}/` | **KEEP (conditional)** → DELETE after unhook | `generate-certification-report.mjs` is pinned by the end-state validator's `certify:production:plan-report` | Validator + package.json | High — removing fails CI | **[SURVIVABILITY-UNHOOK]** |
| `infrastructure/deployment/helm/` + `kubernetes/` (6 files — verified tracked-deleted in WT) | **DELETE** (finalize) | k8s/helm story removed from canon; worktree already deleted | None live | Low | **[COMMIT]** |
| `infrastructure/deployment/` survivors (`release-promotion.yaml`, `migration-orchestration.yaml`, AGENTS.md) | **KEEP** | `migration-orchestration.yaml` is the forward-fix-preferred policy source | — | — | — |
| `scripts/{dev, governance, generators, supabase, cloudflare, ...}` (incl. untracked `dev-up.sh`, `dev-backend.sh`, `identity-security-gate.mjs`) | **KEEP** | Wired through package.json/CI; untracked ones → [COMMIT] | Live | — | **[COMMIT]** (the untracked) |

### 3.10 Dead routes (gateway portfolio/resume; second backends; storefront demo)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| `services/api-gateway/src/routes/{portfolio,resume}.ts` + mounts `index.ts:738-739` + imports `:35-36` (all verified) | **KEEP (conditional)** → DELETE after probe | Previous-product (portfolio/resume) residue, but **live-mounted** | `services/mobile-bff/src/index.ts:44-45` allowlist `'/v1/portfolio'`,`'/v1/resume'` must be cut in the same change | Med — live-mounted | Live `pg_stat_user_tables` writer probe shows zero traffic + ARB "non-store site types are dead" decision (§9) |
| `apps/merchant-control-plane/src/app/api/**` — **62 route.ts** (verified count) | **KEEP (conditional)** → DELETE after cutover | Second backend (loser); api-gateway is the canonical writer (two-writers-per-domain) | Per-page call-graph unknown; `gift-cards` has no gateway mount (must be PORTED, not proxied) | High — blanks merchant UI if removed before cutover | Per-page call-graph trace + proxy-or-port cutover with contract tests + **[WINNER-DEPLOYED]** |
| `apps/storefront-runtime/src/app/api/**` — **21 route.ts** (verified count) | **KEEP (conditional)** → DELETE after cutover | Third partial backend; same two-writers logic | Same per-page call-graph condition | High | Same as above |
| `apps/storefront-runtime/src/app/demo/urban-kicks/` | **DELETE** | Demo residue (see §3.3) | demo lib + preview seam | Low–Med | **[COMMIT]** |

### 3.11 Dead mobile screens / widgets

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| Mobile true-dead-weight (`lib/services/platform_blocked_service.dart`, `lib/app/deep_link_router.dart` — verified present; + `platform_blocked_screen.dart`, `upgrade_screen.dart`, `splash_screen.dart`, `widgets/home/` dup pair, `widgets/shared/empty_state.dart`, `go_router` dep) | **DELETE** | Zero/duplicate function; zero inbound navigation | Removing `deep_link_router.dart` + `go_router` requires same-change test edits | Low–Med (test edits required) | **[COMMIT]** + same-change test edits |
| Mobile theme-editor pair (`screens/.../customize/theme_screen.dart` ~631L + `editor/section_editor_screen.dart` ~1,200L + 12 `widgets/editor/*`) | **KEEP (conditional)** → DELETE-or-wire | ~1,830 lines, zero construction sites, but historically the strongest surface; 42 source-string tests "protect" it | `StoreMainScreen.goToEditor()` lands on Settings, not here | Med | Explicit ARB wire-or-delete decision + rewrite the 42 protecting tests |
| 34 dead capability screens (KYC, 2FA, returns, inventory, coupons, gift_cards, pages, blog, navigation, media_library, staff, billing, leads, email_campaigns, apps, ai, shipping, taxes, custom_data, collections, …) + 36 `/features/*` routes with zero inbound nav | **KEEP (conditional)** → per-screen decision | Real service-backed implementations with no entry point; KYC/2FA/returns invisibility is a product gap, not classic dead code | Route table satisfies validators/tests, not users | Med | Per-screen wire-vs-delete product decision |
| `apps/mobile/merchant-app` (overall) | **KEEP** (canonical) | The only real Flutter app; D8/D9 hardening uncommitted | Live | — | **[COMMIT]** (uncommitted hardening) |

### 3.12 Config / infra residue (multi-region.json, chaos/, load/, frozen vercel, staging matrix)

| Path | Class | Reason | Dependencies (verified) | Risk | Precondition |
|---|---|---|---|---|---|
| `config/runtime/replay-safety-contract.json` (+`.schema.json`) | **DELETE** | No live consumer | Referenced only by `docs/governance/replay-safety-governance.md` (itself archived) + an archived theater test + the generated intel doc (verified) — no live validator/script | Low | **[COMMIT]** (move/delete the governance doc together) |
| `config/runtime/identity-residency.schema.json` + `config/runtime/identity/residency.json` (the **pair**) | **DELETE** (pair) | `residency.json` has **no live validator/script consumer** (verified `grep residency` in scripts/config-governance/.github = none); the schema's only consumer is `residency.json` itself (`"$schema":"../identity-residency.schema.json"`) — so cut both, not just the schema | Each other only | Low | **[COMMIT]** — **must delete the pair together** (deleting only the schema breaks residency.json) |
| `config/runtime/multi-region-runtime.json` (+schema) — 4 regions + failover pairs | **KEEP (conditional)** → DELETE after unhook | Most-wired rejected-arch artifact; declares apac/eu/us namespaces in no terraform/wrangler | Read by the survivability/end-state validators' globalRegions assertion (verified) | **High — removing fails the gate (GATE-1 self-block)** | **[SURVIVABILITY-UNHOOK]** |
| `config/runtime/{survivability-execution.json, observability-platform.json}` (+schemas) | **KEEP (conditional)** → DELETE after unhook | Locked by `survivability-governance-validator.mjs:36-91`; split `observability-platform.json`'s real prometheus rules into a non-theater validator first | Validator | High | **[SURVIVABILITY-UNHOOK]** |
| `config/runtime/production-topology.json` → `regions.globalRegions` block | **KEEP (conditional)** → DELETE the block after unhook | The one fabricated multi-region claim inside canon; self-labelled `governance-contract-not-live-evidence` | The 2 region-asserting validators read it | High | **[SURVIVABILITY-UNHOOK]** step 4 |
| `config/runtime/` 1-consumer + 2-consumer distributed contracts (`convergence-invariants`, `distributed-consistency-contract`, `durable-execution-contract`, `failure-domain-manifest`, `runtime-causality-graph`, `replay-branch-registry`, `projection-recovery-manifest`, … ~15) | **KEEP (conditional)** → DELETE after retiring each one's single consuming validator | Each has 1–2 consumers (mostly the certification lane) | Single consuming validator each | Med | Retire each one's consumer first (rides [SURVIVABILITY-UNHOOK]) |
| `chaos/` (AGENTS.md + `run-chaos-evidence.mjs` + `scenarios/`) | **KEEP (conditional)** → DELETE after unhook | Rejected machinery, but existence validator-mandated (`survivability-governance-validator.mjs:22-23,153` — verified) | Validator reads the files | **High — deleting fails the gate** | **[SURVIVABILITY-UNHOOK]** |
| `load/` (AGENTS.md + `run-load-evidence.mjs` + `scenarios/` + gatling/k6/locust) | **KEEP (conditional)** → DELETE after unhook | Same lock (`survivability-governance-validator.mjs:20-21,152` — verified) | Validator reads | High | **[SURVIVABILITY-UNHOOK]** |
| `config/vercel/projects.json` lines **79/94/109/124** (the 4 frozen-app project entries — verified `letbuyy-{app-marketplace,developer-portal,theme-marketplace,platform-operations-portal}`) | **DELETE** (the 4 entries) | Frozen-app prod project rows = drift vs frozen/not-deployed topology | Project entries only | Low | **[COMMIT]** |
| Frozen-app rows in **both** staging workflows: `.github/workflows/deploy-staging.yml:99-102` + `staging-deploy.yml:189-198` (verified app-marketplace/theme-marketplace/platform-operations-portal in both) | **DELETE** (the matrix rows) | "Frozen" apps still deploy to staging in two workflows; drift | Matrix rows only | Low | **[COMMIT]** |
| Reserved services' sed-garbled `runtime.manifest.json` | **KEEP** (content rewrite) | Slot validator-mandated; fix prose + retarget theater `governanceDocs` | Validator | — | n/a |
| `infrastructure/{cloudflare,dns,monitoring,observability,ci-cd,security}/` | **KEEP** | Live capacity/origin contracts; prometheus rules are also load-bearing for the theater validator (split the assertion, don't delete) | Validators/CI | — | — |

### 3.13 Root junk / caches / empties

| Path | Class | Reason | Dependencies | Risk | Precondition |
|---|---|---|---|---|---|
| `.DS_Store` ×11 (root, `database/`, `config/`, `tests/`, `docs/`, `docs/research/`, `docs/auth/`, `docs/themes/`, `load/`, `infrastructure/`, `.git/` — verified) | **DELETE** | macOS junk; gitignored | None | None | **None** (zero-risk; even pre-commit) |
| `.codex-dev.log` (0 bytes — verified) | **DELETE** | Empty noise; gitignored | None | None | **None** |
| `.codex/` (empty — verified 0 entries) | **DELETE** | Empty dir; not ignored | None | None | **None** |
| `.tmp/` (empty — verified), `packages/.tmp/` | **DELETE** | Empty residue | None | None | **None** |
| `legacy/` (empty — verified 0 files; 37 firebase files tracked-deleted, copies in archive) | **DELETE** | Empty husk | None | None | **[COMMIT]** (commit the 37 deletions + archive copies first, then the empty dir) |
| `tests/projections/` (empty — verified) | **DELETE** | Empty orphan dir | None | None | **[COMMIT]** |
| `build/` (161 MB Flutter cache — verified, gitignored) | **DELETE** | Machine-local | None | None | **None** |
| `.dart_tool/` (96K), `test-results/` (4K), `.pnpm-store/` (0), `.turbo/` (**1.8 GB** — verified) | **DELETE** | Local caches/residue | None | None | **None** |
| `artifacts/` (208 files, ~43 MB) | **KEEP** | Consumed by operational-proof/evidence validators | Validators | — | — |
| Root business binaries (`LETBUYY_BUSINESS_REVIEW_DECK.pptx`, `LETBUYY_MERCHANT_OS_BOARD_DECK.pptx`, `LETBUYY_MERCHANT_OS_ROADMAP.xlsx`, `LETBUYY_PRICING_UNIT_ECONOMICS_MODEL.xlsx`) | **ARCHIVE** → `docs/archive/root-governance-2026-06-10/` | Sibling business .md docs already there; binaries escape the root-markdown budget only because the validator filters `.endsWith(".md")` | Root-budget validator | Low | **[COMMIT]** |
| `.claude/settings.local.json` (untracked) | **KEEP** (local; gitignore it) | Tool config; reveals worktree lane paths | — | — | — |
| `.changeset/` (config + 1 stale changeset) | **KEEP (conditional)** | Keep config; the stale changeset is INVESTIGATE — no release flow found consuming changesets (§9 probe) | — | Low | Confirm changesets is/isn't in any release flow |
| `git stash@{0}` (from deleted `stream/letbuyy-ui-v2`) | **DELETE** (inspect-then-drop) | Popping splices old-regime artifacts onto the new state | None | Low | Inspect, then drop (never `git stash pop` blindly) |

---

## 4. SAFE DELETION BATCHES (ordered by risk + precondition)

> This ordering is the key execution artifact and feeds the Codex prompt. Each batch states its **precondition**, its **items**, and a **validation check** to run after the batch.

### Batch 0 — COMMIT THE WORKING TREE (the gate; NOT a delete)
- **Precondition:** none — but this MUST run first and MUST NOT begin with `git clean -fd`/`git checkout .`.
- **Action:** `git add -A && git commit` on `stepup/main` — commits the 512 tracked deletions **and** the untracked canon together (migrations 162–166 + rollbacks, the 22 money/identity validators, `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, the Constitution/AGENTS_V2 stack, the `docs/archive/*-2026-06-10/` trees, the audit dirs, `dev-up.sh`/`dev-backend.sh`/`identity-security-gate.mjs`, the `.github` mobile-release workflow).
- **Why first:** escapes the commit trap; makes every subsequent DELETE reversible via git history; preserves the only-correct reality.
- **Validation check:** `git status` shows clean tree; `pnpm run validate:governance` PASS; `ls database/supabase/migrations/16{2,3,4,5,6}_*.sql` all present and now tracked.

### Batch 1 — PURE JUNK / CACHES / EMPTIES (zero risk, NO precondition)
- **Precondition:** none (these can even precede [COMMIT]; none is tracked canon).
- **Items:** `.DS_Store` ×11 · `.codex-dev.log` (0 bytes) · `.codex/` (empty) · `.tmp/` + `packages/.tmp/` (empty) · `build/` (161 MB) · `.dart_tool/` · `test-results/` · `.pnpm-store/` · `.turbo/` (1.8 GB).
- **Count:** ~20 paths (~2 GB reclaimed).
- **Validation check:** `git status` shows no tracked-file changes (all were gitignored/empty); `pnpm install && pnpm run build` regenerates caches cleanly.

### Batch 2 — POST-COMMIT ZERO-RISK DELETES (generated-stale + orphan validators + empties + dangling refs)
- **Precondition:** **[COMMIT]** (Batch 0) done.
- **Items:**
  - 80 generated-intelligence docs (`docs/README.md` + `docs/<topic>/README.md` tree + `docs/architecture/{master-system-intelligence,README}.md`).
  - `docs/conflicts/` + `docs/future-roadmap/` (generated-README-only) + `docs/mobile-migration-blueprint/` (empty).
  - 11 orphan validators (0 refs — verified).
  - `legacy/` (empty, post the committed firebase deletions) + `tests/projections/` (empty).
  - `tsconfig.workspace.json:68` dangling `packages/typescript/utils` ref + `pubspec.yaml` `run:super_admin` melos script.
  - `config/runtime/replay-safety-contract.json` (+schema) + the `identity-residency.schema.json`/`identity/residency.json` **pair** (cut together).
  - `apps/storefront-runtime/src/app/demo/urban-kicks/` + demo lib + `next.config.ts` firebase remotePattern.
  - `config/vercel/projects.json` lines 79/94/109/124 + frozen-app rows in `deploy-staging.yml:99-102` and `staging-deploy.yml:189-198`.
  - `git stash@{0}` (inspect-then-drop).
- **Count:** ~95 files + ~10 line/entry edits.
- **Validation check:** `pnpm run validate:governance` PASS (esp. `repository-intelligence-validator`, `marketing-dead-twin`, `theme-editor-dead-shell`, topology validators); `tsc -b` no longer errors on the removed utils ref; `pnpm --filter storefront-runtime build` PASS.

### Batch 3 — POST-COMMIT FINALIZE WORKTREE DELETIONS + MOBILE/UI-KIT DEAD-WEIGHT + PROMPT HARD-CUTS
- **Precondition:** **[COMMIT]** done.
- **Items:**
  - 8 rejected package roots (already worktree-deleted; 0 live imports — verified) + `packages/dart/services` + `packages/typescript/ui/src/mobile-tokens.ts`.
  - 77 worktree-deleted theater validators + 69 worktree-deleted theater test files + 6 helm/k8s files (all already `^ D`).
  - ui_kit dup pairs (one of `empty_state*`, one of `error_*`).
  - Mobile true-dead-weight set (platform_blocked screen+service, upgrade/splash, `widgets/home/` dup, `widgets/shared/empty_state.dart`, `deep_link_router.dart` + `go_router` dep) **with same-change test edits**.
  - Prompt hard-cuts: `docs/Codex_waves/CLAUDE_OPUS_MASTER_PROMPT.md` + 6 `TERMINAL_*` relaunchers + 3 rejected-package missions.
- **Count:** ~160 worktree-deletions finalized + ~12 fresh deletes + prompt cuts.
- **Validation check:** `pnpm run validate:governance` PASS (esp. `package-ownership`, `import-validator`, `no-rejected-package-imports`, `dart-dead-source`); `flutter analyze` PASS for merchant-app; `tests/federation/*` (assert rejected-package absence) PASS.

### Batch 4 — ARCHIVE MOVES (historical value → docs/archive/; low risk; precondition = COMMIT or named amend)
- **Precondition:** **[COMMIT]**; for `docs/agents/`, `tasks/todo.md`, `memory/lessons.md` also amend the precedence/AGENT-R16 wiring first.
- **Items (ARCHIVE, not delete):** `docs/Codex_waves/` (remainder) · `docs/audit/` (19) · `docs/audits/apps-platform/` (23) · `docs/agents/` (40, after precedence check) · `docs/commerce-os-audit/` (10) + `docs/analysis/` (4) · docs-root prompt/plan family + ~25 superseded master audits + `docs/LETBUYY.md` · frozen-app mission families · root business binaries (2 pptx + 2 xlsx) · `tasks/todo.md` + `memory/lessons.md` (after amend) · `apps/developer-portal` + `apps/platform-operations-portal` (after consolidation decisions).
- **Count:** ~200 files moved (+ the already-untracked `docs/archive/*-2026-06-10/` 865-file trees, whose action is the Batch-0 COMMIT).
- **Validation check:** `pnpm run validate:governance` PASS (esp. `route-line-count`/`allowedRootMarkdown` budget, `no-scan-generated-agents`); confirm no live import resolves into a moved path.

### Batch 5 — LOSER SYSTEMS (post-WINNER-DEPLOYED; high risk; blanks prod if early)
- **Precondition:** **[COMMIT]** + **[WINNER-DEPLOYED]** (`stepup/main`→`main` promoted and deployed) + per-system cutover proof.
- **Items (each was KEEP-conditional above):**
  - React renderer + 20 frozen sections (+ `marquee.tsx`) — after the 8-item Liquid parity gate + D7 deployed.
  - merchant-control-plane 62 `/api` routes + storefront-runtime 21 `/api` routes — after per-page call-graph trace + proxy-or-port cutover with contract tests (`gift-cards` PORTED).
  - gateway `portfolio.ts`/`resume.ts` + mounts + BFF allowlist `:44-45` — after the live writer probe + ARB non-store decision.
  - Mobile theme-editor pair + 34 dead screens + 36 `/features/*` routes — after per-screen wire-vs-delete decisions + rewriting the 42 protecting tests.
- **Count:** ~120+ files / route handlers (gated, staged per-system).
- **Validation check:** production smoke (storefront renders; merchant UI all CRUD paths green) + `pnpm run validate:governance` PASS + contract-test suite green.

### Batch 6 — SURVIVABILITY / MULTI-REGION / CHAOS / LOAD / CERTIFICATION UNHOOK (highest risk; the GATE-1 self-block)
- **Precondition:** **[SURVIVABILITY-UNHOOK]** fully executed (ARB repeal + validator/topology/workflow retarget, gate green).
- **Items (each was KEEP-conditional above):** `chaos/` + `load/` · `config/runtime/{multi-region-runtime,survivability-execution,observability-platform}.json` (+schemas) + `production-topology.globalRegions` + the ~15 1–2-consumer distributed contracts · `survivability-governance-validator.mjs` + the 10 `validate:production-certification` validators + `operational-proof-validator.mjs` + `production-certification-common.mjs` · the 6 theater aliases + rollback alias · `infrastructure/scripts/{operations,load,chaos}/` certification suite · 13 contradicting + 4 validator-required `docs/governance/` docs + 6 theater runbooks · `tests/{chaos,survivability,replay,queues,operations,production-certification,cloudflare}`.
- **Count:** ~60 artifacts (move/delete as one atomic, ARB-ratified change).
- **Validation check:** `pnpm run validate:governance` PASS **after** the validator-strip (the gate no longer mandates `globalRegions`); no reserved-service manifest `governanceDocs` references a moved doc; `git grep globalRegions` returns nothing in `scripts/validators/`.

---

## 5. (reserved — see §6 and §7)

## 6. Highest-Confidence DELETE Shortlist (zero/low risk, fresh-verified)

All assume [COMMIT] first (so git history preserves tracked items), except the pure-junk rows which carry no precondition.

| # | Item | Why certain (verified this phase) |
|---|---|---|
| 1 | `.DS_Store` ×11 | `find -name .DS_Store` = 11 locations; gitignored junk; zero precondition. |
| 2 | `.codex-dev.log` (0 bytes) + `.codex/` (empty) + `.tmp/` (empty) | Shell-verified empty/0-byte; zero precondition. |
| 3 | `build/` (161 MB) + `.turbo/` (1.8 GB) + `.dart_tool/` + `test-results/` + `.pnpm-store/` | Machine-local caches; `du` verified; zero precondition. |
| 4 | 80 generated-intelligence docs | Verified count 80; generator hard-retired (exits 1) = unregenerable; stale falsehoods. |
| 5 | 11 orphan validators | 0 external refs each (comm against the 91-validator gate array + package.json + .github). |
| 6 | 8 worktree-deleted rejected package roots (154 files) | 0 live imports — only negative test assertions of absence (verified). |
| 7 | 77 worktree-deleted theater validators + 69 theater test files + 6 helm/k8s | Already `^ D`; git history acceptable for code. |
| 8 | `legacy/` (empty) + `tests/projections/` (empty) + `docs/mobile-migration-blueprint/` (empty) + `docs/conflicts/` + `docs/future-roadmap/` (generated-README-only) | files=0 or generated-only (verified). |
| 9 | `apps/storefront-runtime/src/app/demo/urban-kicks/` + firebase remotePattern | Demo residue, live-routed; no live consumer beyond the demo seam. |
| 10 | `config/vercel/projects.json` lines 79/94/109/124 + frozen-app rows in BOTH staging workflows | Drift vs frozen/not-deployed topology (verified line numbers in both files). |
| 11 | `tsconfig.workspace.json:68` `packages/typescript/utils` ref + `pubspec.yaml` `run:super_admin` script | Target ABSENT on disk (verified); dangling/sourceless. |
| 12 | `config/runtime/replay-safety-contract.json`(+schema) + the `identity-residency.schema.json`/`residency.json` pair | No live validator/script consumer (verified); cut the residency pair together. |
| 13 | `packages/typescript/ui/src/mobile-tokens.ts` + `packages/dart/services` | Replaced/zero-ref; generator `--check` passes. |
| 14 | Prompt factory `CLAUDE_OPUS_MASTER_PROMPT.md` + 6 `TERMINAL_*` relaunchers | Only generate rejected-arch missions; history retains. |
| 15 | ui_kit dup pairs + mobile true-dead-weight (deep_link_router + go_router, platform_blocked, etc.) | Duplicate/zero-nav; requires same-change test edits. |

## 7. Dangerous-to-Delete Watchlist (looks deletable, is load-bearing / canon-protected / only-correct-reality)

| # | Artifact | Why it looks deletable | Why it is NOT (deleting breaks prod/CI or destroys canon) — verified |
|---|---|---|---|
| 1 | **The uncommitted working tree itself** (Constitution, AGENTS_V2, migs 162–166, money/identity validators, both 2026-06-10 archives) | "Just untracked files / clean the worktree" | `git clean -fd` permanently destroys the ONLY correct reality (zero git history anywhere); `git checkout .` resurrects the condemned regime. Global precondition = COMMIT; clean/checkout categorically banned. |
| 2 | **`config/runtime/multi-region-runtime.json` + `production-topology.globalRegions`** | Rejected multi-region the Constitution forbids | `whole-repo-end-state-validator.mjs:172-177` + `survivability-governance-validator.mjs:94,106` REQUIRE `globalRegions:[india,apac,eu,us]` (verified exact lines). Removing FAILS the gate — the GATE-1 self-block. Needs [SURVIVABILITY-UNHOOK]. |
| 3 | **`chaos/` + `load/`** | Rejected drill machinery; obviously theater | Existence asserted by `survivability-governance-validator.mjs:20-23,152-153` (verified). Deleting fails the gate. |
| 4 | **`survivability-governance-validator` + 10 certification validators + `operational-proof-validator` + `production-certification-common.mjs`** | Certify never-built capabilities; pure theater | Wired by `package.json:43,55` + referenced by the keystone end-state validator; the 10 import the common (verified). Removing them fails CI. |
| 5 | **React renderer + 20 frozen sections** | "Liquid is the ratified winner, delete React" | React is the runtime default for 100% of stores; Liquid has no header/footer, no data binding, index-only template, no write path. Deleting BLANKS EVERY STOREFRONT. Gated by [WINNER-DEPLOYED]. |
| 6 | **`scripts/generate-repository-intelligence.mjs`** (retired generator) | "It's retired and exits 1, delete it" | Its retirement is LAW — `repository-intelligence-validator.mjs:41` asserts the tombstone exists (verified). Deleting it breaks the assertion. KEEP-canonical. |
| 7 | **`EXECUTION_LEDGER.md` / `SKIPPED_HUMAN_DECISIONS.md` / migs 162–166 / the 22 money+identity validators** (all untracked) | "Untracked scratch, not part of the repo" | All validator-required and/or the only money/identity gates + the commission-zero/RLS/GUC/canonical-money migrations. A clean clone has NO money gates and silently omits 162–166. Highest-priority COMMIT (Batch 0). |
| 8 | **Frozen-four apps** (app-marketplace, theme-marketplace, developer-portal, platform-operations-portal) | "Frozen = dead, delete them" | Gateway still serves their endpoints; ~50 `app_*` tables live; marketplace types inside active theme-engine; staging deploys 3. Only the staging+projects.json ROWS are DELETE; the app source is KEEP / ARCHIVE-after-decision (developer-portal/platform-operations-portal). |
| 9 | **6 reserved services + 2 reserved mobile stubs** (2 files each) | "Manifest-only = dead stubs, delete them" | Existence is validator-MANDATED (`whole-repo-end-state-validator.mjs:59-78` — verified). Deleting them FAILS the gate. KEEP delete-never while end-state law stands. |
| 10 | **`docs/agents/` + nested `AGENTS.md`** | "Stale generated docs, delete them" | RANKED LOCAL AUTHORITIES by CLAUDE.md precedence; anti-scan validators read only ROOT, so nested copies are unpoliced law an agent obeys. ARCHIVE the dir / REWRITE content — a raw delete that misses the precedence wiring leaves dangling authority refs. |
| 11 | **`docs/governance/{multi-region-runtime,runtime-composition}-governance.md`** | "Theater docs, archive freely" | Cited as authority by reserved-runtime manifest `governanceDocs`; `runtime-composition-governance.md` routes through deleted V1-rejected packages. Moving before retargeting the manifest refs breaks the manifest contracts. Ride [SURVIVABILITY-UNHOOK]. |
| 12 | **merchant-control-plane 62 `/api` routes** | "Loser second backend, delete it" | Live-mounted; `gift-cards` has NO gateway mount (must be PORTED, not proxied); deleting before per-page cutover blanks the merchant UI. Gated by call-graph trace + [WINNER-DEPLOYED]. |

*(Honorable mentions: `MERGE_RUNBOOK.md` — SKIP-D1 directs the maintainer here for the real promotion, so REWRITE not delete; `git stash@{0}` from a deleted branch — inspect before drop; the `identity-residency.schema.json`/`residency.json` pair — delete together or not at all.)*

## 8. KEEP-Canonical List (the load-bearing spine; delete-never)

1. `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (+ 6 sibling rewrite docs) — **[COMMIT]**.
2. Root `AGENTS.md` (AGENTS_V2). 3. Root `CLAUDE.md`. 4. `EXECUTION_LEDGER.md` — **[COMMIT]**. 5. `SKIPPED_HUMAN_DECISIONS.md` — **[COMMIT]**.
6. `scripts/validate-governance.mjs` + the 91-validator gate (incl. 22 untracked Phase B/C/D money/identity validators) — **[COMMIT]**.
7. `database/supabase/migrations/` 000–166 (162–166 untracked — highest-priority preserve) + rollbacks — **[COMMIT]**.
8. `services/{api-gateway, mobile-bff, webhook-service, queue-workers}`.
9. `apps/{storefront-runtime, merchant-control-plane, identity-platform, platform-console, mobile/merchant-app}` (+ `marketing-site` as KEEP non-canonical).
10. `config/runtime/{production-topology,deployment-topology}.json` (minus the globalRegions block) + `config/governance/`.
11. `services/api-gateway/src/tenant/tenant-tables.registry.ts` (+ generator).
12. `.github/workflows/` (11) — **[COMMIT]** (incl. the untracked mobile-release workflow).
13. `package.json` + `pnpm-workspace.yaml` + `turbo.json` + lockfiles + `tsconfig.{base,workspace}.json` (minus the utils ref) + root `pubspec.yaml` (Melos).
14. `packages/typescript/ui`, `packages/theme-engine`, `packages/dart/ui_kit`, + the 18 npm lib roots.
15. `scripts/generate-repository-intelligence.mjs` (retirement tombstone — LAW). 16. `whole-repo-end-state-validator.mjs` (keystone; strip only its region block).
17. The 6 reserved services + 2 reserved mobile stubs (validator-mandated existence). 18. `tests/executable/` (only DB-executing proof). 19. `artifacts/` (validator-consumed). 20. `docs/{design-system,seo,research,env-setup}` + `docs/LOCAL_DEV.md`.
21. `docs/archive/**` (865 files — ARCHIVE location, delete-never; the 8 newest dirs → **[COMMIT]**).

## 9. Unknowns / Probes Needed (out-of-band; gate the KEEP-conditional rows)

1. **Live-DB writer probes** (`pg_stat_user_tables` reads/writes) for `portfolio_projects`, `resume_versions`, `gallery_items`, `skill_endorsements`, `gift_card_*`, `leads`, `comments` — gates the entire previous-product residue batch + the portfolio/resume route deletions.
2. **Per-page call-graph trace** — which merchant/storefront UI page calls each of the 62 MCP + 21 storefront-runtime `/api` routes vs the gateway — gates the second-backend removal (Batch 5).
3. **Live deploy state** (Vercel projects, Cloudflare workers/crons, applied-migration ceiling, `pg_policies`/grants incl. residual PUBLIC `USING(true)`) — `production-topology.json` self-labels `governance-contract-not-live-evidence` — gates [WINNER-DEPLOYED] urgency and every DB-gated condition.
4. **ARB intent on multi-region** — whether the survivability-restore was directed or improvised; no SKIP row covers it — gates [SURVIVABILITY-UNHOOK] step 1 (Batch 6).
5. **Changeset release-flow** — is `.changeset/` consumed by any release workflow — gates the stale-changeset delete.
6. **Per-file behavioral-value triage** of `tests/federation/` (26) + source-regex-only `.mjs` tests — run-vs-text-assertion.
7. **ui_kit exported-widget consumers** — 18 unused exports → library-surface pruning decision.
8. **Newest-copy direction** for diverged prompt twins (`docs/apps-marketplace-audit/*` vs `docs/archive/prompts/*`) — DELETE older vs ARCHIVE newer.

---

## 10. Counts (3-class summary)

- **DELETE** (present-tense, [COMMIT]-gated or junk-no-precondition): **~16 row-clusters** = the ~20 junk/cache/empty paths (Batch 1) + 80 generated docs + 11 orphan validators + 8 rejected package roots (154 files) + 77 worktree-deleted validators + 69 worktree-deleted tests + 6 helm/k8s + demo residue + firebase pattern + 4 projects.json rows + both staging-workflow row-sets + 2 dangling refs + the replay/residency config pair + 2 dead packages/files + prompt factory + 6 relaunchers + 3 rejected-package missions + ui_kit dup pairs + mobile dead-weight + git stash. **Net unique files physically removed ≈ 480–520** (the bulk being the 80 docs, 154 package files, 77 validators, 69 tests, and caches).
- **ARCHIVE** (move under `docs/archive/`): **~13 groups ≈ 200 files** moved this program + the already-untracked 865-file `docs/archive/*-2026-06-10/` trees (action = COMMIT, not move).
- **KEEP** (canonical + active + conditional-loser): the canonical spine (§8, ~21 entries) + all KEEP-conditional loser systems (React renderer, 2 second backends, survivability/multi-region cluster, reserved services/stubs, mobile screens) gated behind [WINNER-DEPLOYED] / [SURVIVABILITY-UNHOOK] / live probes.

---

*End of Phase 4 — SAFE DELETION PLAN. CLASSIFICATION ONLY: this report is the only file written; read-only git; no deletion, no modification, no new architecture, no commits, no codex prompts. The global precondition for any physical deletion is Phase-0 commit of the working tree — and the operation must NEVER begin with `git clean -fd` or `git checkout .`. No loser may be physically deleted until its winner is committed AND deployed; the multi-region/survivability cluster may not be removed until the [SURVIVABILITY-UNHOOK] releases the gate's own self-block.*

---

## FINISH-CLEANUP Closure Addendum — 2026-06-11

This addendum closes the finite execution rows against the current tracked tree after the foundation stepup commit. It does not re-open the historical classification above.

**Current proof commands:**
- `rg -l "^<!-- GENERATED BY scripts/generate-repository-intelligence" . --glob "*.md" --glob "!docs/archive/**" --glob "!node_modules/**" --glob "!.git/**"` returned no live generated-intelligence markdown.
- `node scripts/validate-governance.mjs --lane=all` passed 93 validators, including the prompt perimeter, repository-intelligence validator, one-system-per-domain validator, and whole-repo end-state validator.
- The 11 orphan validator files listed in section 3.8 are absent from `scripts/validators/`.
- `docs/Codex_waves`, `docs/audit`, `docs/audits/apps-platform`, `docs/commerce-os-audit`, `docs/analysis`, `docs/architecture/master-system-intelligence.md`, `chaos`, `load`, `config/runtime/replay-safety-contract.json`, `config/runtime/replay-safety-contract.schema.json`, `config/runtime/multi-region-runtime.json`, `config/runtime/survivability-execution.json`, and `scripts/validators/survivability-governance-validator.mjs` are absent from the live tree.
- `find docs/mobile-migration-blueprint docs/conflicts docs/future-roadmap legacy tests/projections -maxdepth 3 -type f -print` returned no files; those empty husk directories were removed with `rmdir`.

**Rows closed by current proof:** generated-intelligence docs; orphan validators; rejected package roots; theater validators/tests; Helm/k8s residue; prompt factory and relaunch kit; docs archive moves; replay-safety config; multi-region/survivability/chaos/load theater cluster; empty husks; frozen deploy rows; mobile dead-weight; ui_kit duplicate pairs; dangling tsconfig/mobile script residue.

**Rows reclassified as not open DELETE rows because proof-before-delete now fails:**
- `apps/storefront-runtime/src/app/demo/urban-kicks/` and `apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts` are now an explicit governed demo/portable-theme fixture. Live consumers include `scripts/validators/domain-boundary-validator.mjs:116-117`, `tests/contracts/demo-store-isolation.test.ts`, `tests/federation/web-app-contract-boundary.test.mjs`, `apps/storefront-runtime/src/app/preview/page.tsx`, `apps/storefront-runtime/src/app/api/reviews/route.ts`, `apps/storefront-runtime/src/lib/store-service.ts`, and `apps/storefront-runtime/src/lib/product-service.ts`. Deleting it would violate proof-before-delete.
- `config/runtime/identity-residency.schema.json` and `config/runtime/identity/residency.json` are now consumed by `scripts/validators/provider-mode-badge-validator.mjs:81-82` and `tests/identity-foundation/compliance-ops-scaffold.test.mjs:21`; deleting them would violate proof-before-delete.
- `config/runtime/observability-platform.json` is now consumed by `scripts/validators/production-readiness-validator.mjs:21-22` and documented by `docs/governance/observability-governance.md:61`; deleting it would violate proof-before-delete.

**Finite-plan status:** zero open present-tense DELETE / ARCHIVE / REWRITE rows remain in this plan. Remaining live artifacts are either canonical KEEP, validator-consumed KEEP, or capability/human-decision deferrals tracked outside this finite cleanup plan.
