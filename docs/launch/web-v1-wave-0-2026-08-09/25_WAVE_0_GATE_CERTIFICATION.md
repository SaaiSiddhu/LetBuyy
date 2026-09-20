# 25 — Wave 0 Gate Certification

**Evidence artifact, not governance authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → the relevant local `AGENTS.md` → the canonical governance rewrite documents. Nothing in this document authorises an action, grants an exception, changes a policy, or approves a merge, a push, or a deployment. It records sixteen verdicts and the measurements behind them.

| Field | Value |
|---|---|
| **Repo** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` — the original, production-linked tree |
| **Branch / HEAD (original tree)** | `stepup/main` @ `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
| **Certified subject** | `codex/web-v1-integration` @ `8ec05e210e2282bbaa70fd39bbf61904cb9e21ab`, in worktree `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration` |
| **Date** | 2026-08-09 |
| **Agent** | Wave 0 Gate Certification agent |
| **Mode** | **Read-only against git and against every provider.** No `commit`, `add`, `stage`, `stash push/pop/apply/drop/clear/branch`, `clean`, `reset`, `checkout --`, `restore`, `chmod`, `worktree remove/prune`, push, PR, or deploy. No `supabase` command of any kind. No provider command. |
| **Writes performed** | Only `docs/launch/web-v1-wave-0-2026-08-09/25_WAVE_0_GATE_CERTIFICATION.md` and `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/certification/25_certification_transcript.txt` — the two authorised paths |
| **Raw evidence** | `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/certification/25_certification_transcript.txt` |

## Original-tree state, measured by this agent before and after its entire run

| Measurement | Before | After |
|---|---|---|
| `git rev-parse --abbrev-ref HEAD` | `stepup/main` | `stepup/main` |
| `git rev-parse HEAD` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
| `git status --porcelain \| wc -l` | `6826` | `6826` |
| `git status --porcelain=v2 \| wc -l` | `6826` | (unchanged) |
| `git stash list \| wc -l` | `2` | `2` |

**The original working tree is preserved byte-for-byte.** Both writes this agent made land under `docs/launch/` (already a single `??` entry) and under `artifacts/local-operational-proof/` (gitignored at `.gitignore:74`), so the dirty-path count is unchanged.

## EXECUTED vs INFERRED — the standard applied here

Every verdict below cites either (a) a command **this agent ran in this session**, with the exit code it saw, or (b) a persisted log file **this agent opened and read**. Where a verdict rests on a prior agent's document rather than on a re-measurement, that is stated in the verdict. **No percentage, count, or readiness figure from an upstream Wave 0 document was copied without re-derivation.** Two upstream figures were re-derived and found correct (110 validators / PASS=90 FAIL=20; 99 real content changes); one was re-derived and found to have been already-corrected (777 → 99).

### What this certification could NOT verify (UNVERIFIED, stated up front)

1. **GitHub-side branch protection** on `main`, `stepup/main`, or `codex/web-v1-integration`. No repo-owner API access exists in this session, and reading it would require a remote call this agent is forbidden to make. The repository's own `.github/BRANCH_STRATEGY.md` is asserted (by `workflow-trigger-coverage-validator.mjs`) to state that this is not verifiable from the repository — which is honest, but is not the same as knowing the setting.
2. **Whether any workflow actually runs** on `codex/web-v1-integration`. Nothing is pushed, so no CI run has ever occurred on that branch. What is verified is the *declared* trigger surface in the YAML.
3. **Live production runtime state.** No deployed environment variable, no live flag value, no production database row was read, by design and by mandate.
4. **Node-20 reproducibility of the gate.** This agent's shell has node `v26.5.1`; no node 20 toolchain (`nvm`, `fnm`, `volta`, `n`, `node@20`) exists on this machine. The gate result reproduced identically anyway, which is evidence of node-version stability, not proof of it.

---

# Part 1 — The sixteen gate verdicts

Legend: **PASS** = the gate's own condition is satisfied and was verified. **PASS_WITH_NAMED_BLOCKERS** = the gate's condition is satisfied, and a specific, named, evidence-bearing defect remains open that a later wave must close. **FAIL** = the gate's condition is not satisfied.

---

## W0-G01 — Authority loaded

### Verdict: **PASS**

**Condition:** the Lead and the working agents read the governing documents before acting, and the authority chain they applied is the repository's own, not an invented one.

**Evidence (READ by this agent):** `01_AUTHORITY_AND_ARCHITECTURE_BASELINE.md:45` records the primary sources read in full — `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (472 lines) and root `AGENTS.md` (406 lines) — plus `LETBUYY_CANONICAL_SYSTEMS.md` and `CLAUDE.md` in relevant part. Lines 49–53 reconstruct the five-tier authority ladder with a `path:line` citation for each tier. Line 56 explicitly reconciles the chain against the `CLAUDE.md` project instruction and records **no drift**. Lines 62–68 map each governed domain (topology, branch policy, deletion, money, identity, RLS/tenancy, deployment) to its Constitutional article and rule range with file:line anchors.

The document does not merely assert reading; it produces falsifiable derived claims from what it read and then tests them against disk: line 86 verifies the eight reserved manifest-only roots contain only `AGENTS.md` + `runtime.manifest.json`; line 90 verifies all nine deprecated app aliases are **absent from disk**, path by path.

**Why PASS and not lower:** the gate asks whether authority was loaded, and the answer is demonstrated rather than claimed — every tier is cited to a line, and the derived topology claims were checked against the filesystem. Every subsequent Wave 0 document carries the same subordination header.

**No named blocker.**

---

## W0-G02 — Original worktree preserved

### Verdict: **PASS**

**Condition:** no user-authored change was lost or destructively altered; the original tree remains exactly as found.

**Evidence (EXECUTED by this agent, twice — once before any other command, once after all of them):**

```
git rev-parse --abbrev-ref HEAD   → stepup/main                                     (both)
git rev-parse HEAD                → bf35062eda22f4d881efd61fb1d36c8fc83baed1        (both)
git status --porcelain | wc -l    → 6826                                            (both)
git status --porcelain=v2 | wc -l → 6826
git stash list | wc -l            → 2                                               (both)
git reflog -5                     → HEAD@{0} is still the baseline commit; HEAD never moved
```

All four target values match the state the Lead recorded. `git stash list` shows the two expected entries (`stash@{0}: On stepup/main: inf-ext`, `stash@{1}: On stream/letbuyy-ui-v2: branch-consolidation-local-artifacts`).

**Independent partition proof that nothing was silently altered.** This agent re-derived the composition of the 6,826 dirty paths from scratch:

| Bucket | Count | How derived |
|---|---:|---|
| ` M ` (modified, tracked) | 6,785 | `6826 − 41` where 41 = `git status --porcelain \| grep -vE '^ M '` |
| ` A ` (intent-to-add) | 10 | counted in that 41 |
| `??` (untracked) | 31 | counted in that 41 |
| **Total** | **6,826** | ✓ reconciles exactly |

and `git diff --raw` enumerates **6,795** entries (= 6,785 ` M ` + 10 ` A `), which partitions as **6,696 mode-only + 99 real content** (§C of the transcript). Every arm reconciles.

**Preservation of the 99.** `raw-evidence/preservation/patches/` contains **exactly 99** patch files — a count derived by an agent that never saw this agent's blob-hash computation, and which matches it exactly. `raw-evidence/preservation/SHA256SUMS.tsv` carries 214 checksummed rows and `MANIFEST.json`; `untracked-raw/` holds 96 preserved untracked files.

**Why PASS:** the gate's condition is preservation, and preservation is proven on two independent axes — the tree is bit-identical to its found state, and every one of the 99 real changes has a byte-exact patch stored outside the tree.

**No named blocker for this gate.** (The intent-to-add trap and the stash hazard are real, and are recorded under G03 and in Part 2 — but they are *hazards to future actions*, not losses that have occurred.)

---

## W0-G03 — Dirty changes classified

### Verdict: **PASS_WITH_NAMED_BLOCKERS**

**Condition:** every material content change has a disposition.

**Corrected figure, independently re-derived (EXECUTED):** the number of real content changes is **99**, not 777. This agent did not take that on trust from the correction documents; it recomputed it by comparing the index blob to the worktree blob for all 6,795 `git diff --raw` entries, hashing the file with `git hash-object` wherever the worktree blob reads `000000`:

```
mode-only (index blob == worktree blob) : 6696
genuinely different content             :   99
                                          6795  ✓
```

**Coverage of the 99 is now complete.** The register in `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` originally grouped 98 files across groups A–O; `30_CORRECTIONS_AND_STASH_HAZARD.md:304` records that a **Group P** was added for `apps/merchant-control-plane/src/app/globals.css` (+271/−73) specifically so the register sums to 99. A patch exists for that file (`031__apps__merchant-control-plane__src__app__globals.css.patch`). Disposition coverage is therefore **99/99**.

**Why not PASS.** The classification's *disposition* for the overwhelming majority of the 99 is "preserved as a patch on no branch" — which is a disposition, but a fragile one, and two named defects remain armed in the tree:

- **NAMED BLOCKER — FBR-33 (S1 / BLOCKS-WAVE-0 / MITIGATED):** 99 real content changes exist on no branch. They live only as patch files in a gitignored directory on one laptop. "MITIGATED" means preserved, not landed.
- **NAMED BLOCKER — FBR-34 (S2 / BLOCKS-WAVE-0 / MITIGATED):** the intent-to-add empty-blob trap is **still armed**, re-verified by this agent. Ten SQL files sit in the index at the empty blob `e69de29b…` while holding real content on disk:

  | bytes | path |
  |---:|---|
  | 6,250 | `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` |
  | 19,974 | `database/supabase/migrations/197_letbuyy_core_first_class_theme.sql` |
  | 3,119 | `database/supabase/rollback/180_urban_kicks_liquid_theme.rollback.sql` |
  | 885 | `database/supabase/rollback/181_urban_kicks_settings_schema_complete.rollback.sql` |
  | 2,325 | `database/supabase/rollback/188_letbuyy_core_theme_row.rollback.sql` |
  | 776 | `database/supabase/rollback/189_theme_persistence_idempotency.rollback.sql` |
  | 1,875 | `database/supabase/rollback/190_theme_library_q.rollback.sql` |
  | 1,711 | `database/supabase/rollback/191_theme_purchases_rls_tenant_scope.rollback.sql` |
  | 3,253 | `database/supabase/rollback/196_theme_rls_tenant_hardening.rollback.sql` |
  | 3,761 | `database/supabase/rollback/197_letbuyy_core_first_class_theme.rollback.sql` |
  | **43,929** | **total at risk** |

  A `git commit` without a prior explicit `git add` on those exact paths commits ten zero-byte SQL files and destroys 43,929 bytes of migration and rollback logic. **Wave 1 must `git add` these ten paths explicitly before any commit in the original tree.**

---

## W0-G04 — Mode noise isolated

### Verdict: **PASS**

**Condition:** mode-only changes are quantified and were not accidentally merged.

**Quantified (EXECUTED by this agent, full population, no sampling):** **6,696** of the 6,795 `git diff --raw` entries are permission-bit flips on byte-identical blobs. The 678 paths that `git diff --numstat` marks binary (`- -`) are a **subset** of those 6,696, and all 678 are `100644 → 100755` on identical blobs. This independently confirms the retraction of the "777 real content changes" claim and of doc 04's "36 binary changes inside the frozen `apps/theme-marketplace` surface" finding.

**Not merged (EXECUTED):** the integration branch was tested directly for mode contamination:

```
git diff --raw bf35062e 8ec05e21 | (entries where srcmode == dstmode) → 0
```

**Zero mode-only entries** exist in the 155-file, +51,757/−1,003 diff between the baseline and the integration head. The mode noise was isolated in the original tree and none of it crossed onto the branch.

**Noted, not a blocker:** the integration *worktree* carries one uncommitted change, `packages/theme-engine/src/theme-cli.ts`, and `git diff --stat` confirms it is `1 file changed, 0 insertions(+), 0 deletions(-)`, `old mode 100644 / new mode 100755` — i.e. it is itself mode-only, uncommitted, and therefore cannot contaminate the branch. It is carried as a defect under G06.

**FBR-35 (6,696 unexplained mode flips) is classified S3 / NON-BLOCKING** in the register, which this agent agrees with: the flips carry zero content, and their *cause* being unexplained is a hygiene question, not a correctness one.

---

## W0-G05 — Baseline approved

### Verdict: **PASS**

**Condition:** the exact baseline SHA is evidence-backed, human-approved, and governance-compatible.

**Evidence (EXECUTED):** `git rev-parse HEAD` in the original tree returns `bf35062eda22f4d881efd61fb1d36c8fc83baed1`, and `git reflog -5` shows `HEAD@{0}: commit: feat(demo): mount Turnstile so the form works in production` — the baseline is the tip of `stepup/main` and has not moved.

The SHA is **load-bearing in machine-checkable places**, not merely asserted in prose:

- `config/governance/web-v1-scope-registry.json` → `baselineSha: "bf35062eda22f4d881efd61fb1d36c8fc83baed1"`, `recordedOn: "2026-08-09"` (read by this agent from the file on the integration branch).
- `15_BASELINE_DECISION_RECORD.md` carries the decision record; the SHA is repeated in the header of every Wave 0 document, including the correction notices that re-measured it.

Human approval of this specific SHA is recorded by the Lead as a precondition of this task and is not something this agent can independently re-witness; it is recorded here as **INFERRED from the Lead's instruction**, with the SHA itself EXECUTED and confirmed.

**Governance compatibility:** the baseline is a real commit on the repository's active integration branch (`stepup/main`), which is the branch `deploy-staging.yml` deploys from — i.e. it is the branch the repository's own deployment topology already treats as the working head. No deprecated-alias path exists at it (verified at G01).

**No named blocker.**

---

## W0-G06 — Clean V1 worktree created

### Verdict: **PASS_WITH_NAMED_BLOCKERS**

**Condition:** `codex/web-v1-integration` exists locally in a clean, isolated worktree.

**Evidence (EXECUTED):**

```
git rev-parse codex/web-v1-integration                    → 8ec05e210e2282bbaa70fd39bbf61904cb9e21ab
git rev-list --count bf35062e..codex/web-v1-integration   → 23
git diff --shortstat bf35062e codex/web-v1-integration    → 155 files changed, 51757 insertions(+), 1003 deletions(-)
git worktree list                                         → worktree present at
    /Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration
git merge-base --is-ancestor codex/emergency-appbridge-killswitch codex/web-v1-integration
                                                          → exit 1 (NOT an ancestor)
```

All five short-lived branches and the integration branch each hold their own worktree under `letbuyy-w0-worktrees/`, wholly outside the original checkout. All twenty-three commits are reachable; the kill-switch branch is confirmed excluded.

**Why not PASS:**

- **NAMED BLOCKER — the worktree is not byte-clean.** `git status --porcelain` in it returns one entry: ` M packages/theme-engine/src/theme-cli.ts`. It is mode-only (`0 insertions, 0 deletions`, `100644 → 100755`), so it is harmless to the branch content, but a certification that calls a worktree "clean" when `git status` is non-empty would be false. It must be either committed deliberately or reverted before Wave 1 begins work there.
- **NAMED BLOCKER — FBR-26 (S3 / BLOCKS-LAUNCH / OPEN) and FBR-33:** the branch is local-only. `git branch -r --list 'origin/codex/*'` returns **empty**, and `git for-each-ref refs/remotes` returns exactly four refs (`origin/HEAD`, `origin/develop`, `origin/main`, `origin/stepup/main`). Twenty-three commits of Wave 0 repair exist on one laptop and nowhere else. This is the correct state for an unapproved branch, and simultaneously the single largest durability risk in Wave 0.

---

## W0-G07 — Web-only V1 scope frozen

### Verdict: **PASS_WITH_NAMED_BLOCKERS**

**This is the gate the task asked me not to fudge, so I will state the tension plainly before giving the verdict.**

**Condition as written:** required / deferred / forbidden / reserved are registered.

**What is genuinely true (EXECUTED — read directly from `config/governance/web-v1-scope-registry.json` on the integration branch, not from a doc):**

| Property | Measured value |
|---|---|
| `artifactClass` | `GOVERNANCE_CONFIG_NOT_AUTHORITY` |
| `baselineSha` | `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
| Capabilities | **50** |
| `WEB_V1_REQUIRED` | 19 |
| `WEB_V1_DEFERRED` | 16 |
| `FORBIDDEN_FROZEN` | 13 |
| `HUMAN_DECISION_REQUIRED` | 2 |
| Sum check | 19 + 16 + 13 + 2 = **50** ✓ |
| Probes across capabilities | **55** |
| `knownActivationsBaseline.recordedCount` | **32** (signals array length 32 — self-consistent) |
| Open escalations | **5** — `ESC-APPBRIDGE`, `ESC-DEFERRED-LIVE`, `ESC-GATE-FAILFAST`, `ESC-STRIPE-LIVE`, `ESC-WASM-APPFUNCTIONS` |

The freeze is **enforced, not documented**. `web-v1-scope-perimeter-validator.mjs` **PASSED** in this agent's own gate run at `8ec05e21` (reporting 378 assertions), and the registry encodes the unresolved questions as *invariants the code rejects violations of*:

```
invariants.mustBeHumanDecisionRequired = ["mobile_merchant_app", "lcis_api_service"]
invariants.forbiddenClassificationsFor:
    mobile_merchant_app -> ["WEB_V1_DEFERRED", "MOBILE_V1_1", "WEB_V1_REQUIRED"]
    lcis_api_service    -> ["WEB_V1_DEFERRED", "WEB_V1_REQUIRED"]
```

That is the honest engineering move: rather than guessing mobile's classification and letting the guess harden into fact, the registry makes it a **validator error to assert any classification for it**. The unresolved question cannot be silently resolved by a future edit.

**The tension.** "Web-only V1 scope frozen" reads as a completeness claim, and the scope is **not complete**: 2 of 50 capabilities are deliberately undecided, and 5 escalations are open. A reader could reasonably say the perimeter of "web-only" cannot be final while the largest non-web surface in the repository (`apps/mobile/merchant-app`) has no agreed relationship to V1 at all.

**Verdict and why.** **PASS_WITH_NAMED_BLOCKERS**, not PASS, and not FAIL.

- Not FAIL, because the gate's actual condition — that the four buckets are *registered* — is met for all 50 capabilities, the ratchet is enforced and negative-tested, and the perimeter validator passes.
- Not PASS, because two capabilities have no V1 disposition and five escalations are open. Calling that "frozen" without qualification would be the exact fudge I was told not to commit.

**Named blockers:**
- **FBR-06 (S3 / BLOCKS-WAVE-1 / HUMAN_DECISION_REQUIRED):** `apps/mobile/merchant-app` — CANONICAL runtime per `AGENTS.md`, yet with no V1 classification. A human must decide; the code currently rejects any agent that tries to decide for them.
- **FBR-07 (S3 / BLOCKS-WAVE-1 / HUMAN_DECISION_REQUIRED):** `services/lcis-api` plus 19 `lcis-*` surfaces unclassified against ARCH-R2. Several gate failures and behavioural test failures cannot be triaged until this is settled.
- **The five open escalations** listed above, each of which is a human/ARB decision, not an engineering task.

---

## W0-G08 — Mobile work preserved but excluded

### Verdict: **PASS**

**Condition:** mobile work is not lost, and is not mixed into Web V1.

**Not mixed (EXECUTED):**

```
git diff --name-only bf35062e 8ec05e21 | grep -c '^apps/mobile/'   → 0
```

**Zero** mobile paths appear anywhere in the integration branch's 155-file diff. The same test against the frozen apps (`app-marketplace`, `developer-portal`, `theme-marketplace`, `platform-operations-portal`) also returns empty. The integration branch is web-runtime and governance-tooling only.

**Not lost:** mobile work is preserved on three independent axes —
1. every mobile file among the 99 real content changes has a patch under `raw-evidence/preservation/patches/` (e.g. `034__apps__mobile__merchant-app__android__app__src__main__AndroidManifest.xml.patch`);
2. the untracked mobile files (`apps/mobile/merchant-app/lib/config/v1_capability_policy.dart`, `apps/mobile/merchant-app/test/v1_capability_policy_test.dart`) appear as `??` entries still on disk in the original tree and are captured in `preservation/untracked-raw/`;
3. an independent readiness ZIP exists at `artifacts/local-operational-proof/letbuyy-merchant-app-v1-readiness-2026-08-09.zip` (121,531 bytes), with its extracted contents under `raw-evidence/agent-c/extracted/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/`.

**Excluded correctly rather than deferred silently:** the registry classifies `mobile_merchant_app` as `HUMAN_DECISION_REQUIRED` and forbids `WEB_V1_DEFERRED` / `MOBILE_V1_1` / `WEB_V1_REQUIRED` for it in code. Exclusion from Web V1 is therefore a *recorded open question*, not an implicit demotion.

**No named blocker for this gate.** (FBR-06 is carried under G07, where the decision belongs.)

---

## W0-G09 — CI covers V1 integration

### Verdict: **PASS_WITH_NAMED_BLOCKERS**

**Condition:** PRs targeting the V1 branch receive the intended **non-deploying** gates.

**Gates reach the branch (READ from the workflow files on `8ec05e21`):** exactly two workflows reference `codex/web-v1-integration` — `.github/workflows/ci.yml` and `.github/workflows/architecture-governance.yml`. `ci.yml`'s trigger block is verbatim:

```yaml
on:
  pull_request:
    branches: [develop, main, stepup/main, codex/web-v1-integration]
  push:
    branches: [develop, main, stepup/main, codex/web-v1-integration]
env:
  NODE_VERSION: "20"
  PNPM_VERSION: "10.6.2"
```

`NODE_VERSION: "20"` matches the repo's `.nvmrc` and `.node-version` (both `20`), so CI and the local pin agree.

**No deploy lane reaches the branch (READ from every deploying workflow):**

| Workflow | Branch trigger |
|---|---|
| `deploy-staging.yml` | `push: [stepup/main]` + `workflow_dispatch` |
| `production-deploy.yml` | `push: [main]` + `workflow_dispatch` |
| `staging-deploy.yml` | `workflow_dispatch` only (push trigger commented out) |
| `staging-runtime-deployment.yml` | `push: [main, "release/**"]`, path-filtered, + `workflow_dispatch` |
| `production-rollout.yml` | `workflow_dispatch` only |
| `live-production-certification.yml` | `workflow_dispatch` only |

**No deploying workflow can be reached by a push to any `codex/*` branch.** That is the "non-deploying" half of this gate, and it holds.

**This coverage is itself validator-enforced and negative-tested.** `workflow-trigger-coverage-validator.mjs` parses 16 workflows and asserts 4 gated branches and 8 deploy lanes. `raw-evidence/19_seeded_regression_proof.txt` records **seven seeded regressions**, each mutating a copy and each caught (exit 1): removing the branch from `ci.yml`; adding `codex/**` to `production-deploy.yml`'s push trigger (caught, with the validator naming all three codex branches it would newly deploy); deleting the gate-aggregate step; restoring fail-fast; corrupting the YAML with a tab; ungating the staging bootstrap in `environment-lifecycle.yml`; and dropping the integration lane from `BRANCH_STRATEGY.md`. Baseline re-checked clean (exit 0) before and after.

**Why not PASS:**

- **NAMED BLOCKER — FBR-23 (S3 / BLOCKS-LAUNCH / HUMAN_DECISION_REQUIRED):** **GitHub-side branch protection is UNVERIFIED.** No repo-owner access exists in this session and reading it requires a remote call this agent is forbidden to make. A workflow that *declares* it gates a branch is not the same as a branch that *requires* that workflow to pass. Until a human reads the protection settings, the enforcement half of this gate is unknown.
- **NAMED BLOCKER — FBR-22 / FBR-24 (both REPAIRED-LOCAL-UNPUSHED):** the repaired `ci.yml` and `architecture-governance.yml` exist only on unpushed branches. **No CI run has ever executed on `codex/web-v1-integration`,** because nothing has been pushed. The declared trigger surface is correct; the observed behaviour is unmeasured and cannot be measured without a push.

---

## W0-G10 — Validators report completely

### Verdict: **PASS**

**Condition:** all applicable validators execute, or report an explicit truthful blocker.

**Evidence — EXECUTED BY THIS AGENT at `8ec05e21`, not copied:**

```
$ cd /Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration
$ git rev-parse HEAD
8ec05e210e2282bbaa70fd39bbf61904cb9e21ab
$ node scripts/validate-governance.mjs --lane=gate
exit 1
TOTALS: PASS=90 FAIL=20 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1
```

Progress markers ran continuously from `[1/110]` to `[110/110]`: **110 validators selected, 110 executed, none skipped, none blocked.** The single `NOT_APPLICABLE` is `foundation-stepup-report-validator.mjs`, with the explicit truthful reason *"not part of the `--lane=gate` selection"* — it is a report-lane validator, and the gate says so rather than silently omitting it.

```
$ node scripts/validate-governance.mjs --lane=report
exit 0
TOTALS: PASS=1 FAIL=0 BLOCKED=0 SKIP=0 NOT_APPLICABLE=110
"Governance report lane passed (1 validators executed and passed; 111 discovered on disk)."
```

Both lanes account for **every one of the 111 validator files discovered on disk**, in every run, with a typed disposition for each.

**Fail-fast is genuinely eliminated.** At the baseline the gate died at validator #2, leaving 106 of 108 unexecuted (FBR-08). This agent's run executed all 110 and *continued past twenty failures* to completion. That is the substantive repair, and it reproduced under this agent's own hand.

**Two blockers that prior documents recorded as open are now closed by this run:**

- **FBR-41 ("Full gate never run on `8ec05e21`", BLOCKS-WAVE-0, OPEN)** — **now measured.** This certification run is the full gate at `8ec05e21`, with the typed matrix above.
- **FBR-47 ("2 validators BLOCKED — `typescript` unresolvable", BLOCKS-WAVE-0, OPEN)** — **BLOCKED=0** in this run. The earlier `BLOCKED=2` (`cycle-budget-validator.mjs`, `route-ownership-validator.mjs`, in `raw-evidence/w0-validator-execution/20_post-repair-gate.log`) was caused by absent `node_modules`, not by a validator defect. With dependencies installed both execute; `route-ownership-validator.mjs` then reports a genuine `FAIL`, which is a real finding it could not previously reach. **Note for Wave 1: the BLOCKED→FAIL transition means one of the 20 current failures was previously invisible.**

**Result stability (CORRECTED 2026-08-09, round-2 falsification):** this run and the earlier post-repair run produced byte-identical totals, but **both ran on node `v26.5.1`** — `raw-evidence/w0-validator-execution/20_post-repair-gate.log` prints `Node.js v26.5.1`, and all 31 build-baseline logs record `v26.5.1` (31/31). The agreement therefore demonstrates **run-to-run determinism on the same node major, not node-major independence**. **No Node 20 run exists anywhere in this evidence corpus**, despite Node 20 being the version now pinned in `.nvmrc`/`.node-version`. The original sentence claimed the baseline used pinned node 20 and inferred node-major independence from it; that claim was false and is struck. Doc 23 line 475 already stated the position correctly ("Nothing was measured on Node 20"). **W0-G10's PASS verdict is unaffected** — it rests on all 110 validators executing, not on cross-version stability. Verifying the gate under Node 20 is a Wave 1 action.

**Non-mutation of the subject:** `git status --porcelain` in the integration worktree was identical before and after both lanes (the single pre-existing mode-only entry, nothing more). The validators wrote nothing into the worktree.

**No named blocker for this gate.** The twenty failures are real findings correctly reported — reporting them completely is precisely what this gate asks for. They are carried under Part 2.

---

## W0-G11 — No false green

### Verdict: **PASS_WITH_NAMED_BLOCKERS**

**Condition:** required failures make the aggregate command fail.

**Evidence (EXECUTED):** the aggregate returns **exit 1** with 20 named problems (§G of the transcript). Twenty real failures produce a red gate. Conversely the report lane returns exit 0 with 1 executed / 110 not-applicable — a green that is honest because it names what it did not run.

**The two historically soft-failing validators now hard-assert**, and this agent observed both outcomes in its own run:

- `branch-lag-guard-validator.mjs` → **FAIL** (genuinely: the branch is far ahead of `main`). Its previous `reporter.warn` could never block.
- The pricing-catalog validator → **PASS**, and now a real pass rather than a structural no-op.

That is the correct shape: one of the two repaired validators fails and one passes. A repair that turned both green would be suspicious; a repair that turned both red would be over-fitting.

**Aggregate logic proven against seeded outcomes.** `raw-evidence/19_aggregate_gate_logic_proof.txt` extracts the `gate-aggregate` shell step verbatim from `architecture-governance.yml` and executes it under six simulated outcome sets. Cases B–E all correctly exit 1, including **Case B — "governance fails first AND typecheck fails", the historically hidden case** that fail-fast ordering used to mask, and **Case D — an outcome is empty because the step never ran**, and **Case E — a step was `skipped`**. Only "all success" exits 0.

**Why not PASS — two residual false-green paths, both named:**

- **NAMED BLOCKER — vacuous-pass residual (Case F, disclosed in the proof itself).** The aggregate iterates `env | grep -E '^OUTCOME_[A-Z_]+='`. With **zero** `OUTCOME_*` variables present, the loop body never runs, `failed` stays `0`, and the step prints *"All architecture governance steps succeeded."* and exits **0**. A workflow-level misconfiguration that stopped exporting the outcome variables would produce a green gate that verified nothing. The aggregate needs a floor assertion — a minimum expected outcome count — before it can be trusted unconditionally. To the credit of the agent that built it, this hole is documented in its own proof rather than hidden; it is nonetheless open.
- **NAMED BLOCKER — FBR-11 (S2 / BLOCKS-WAVE-1 / OPEN):** the design-system ratchet has a self-service `--update` bypass. A ratchet whose baseline the ratcheted party can rewrite is a false green by construction.

---

## W0-G12 — Isolated environment established

### Verdict: **PASS_WITH_NAMED_BLOCKERS**

**Condition:** proven local and reproducible, or the exact external blocker is documented.

**Isolation proven BEFORE any command ran** — this is the right order, and `raw-evidence/W0-LOCAL-ENV/01_isolation_proof.txt` shows five independent guarantees established as preconditions:

- **A/B** — the local-env worktree has no `supabase/.temp`, no `supabase/config.toml`, and `find` for `project-ref` / `linked-project.json` returns no matches;
- **C** — the production project ref appears only inside `docs/archive/**` prose, never in CLI state;
- **D** — the original repo *is* linked (file names listed read-only, no values printed), which is why all work happened elsewhere;
- **E** — `~/.supabase/access-token` does not exist, so authenticated remote operation is **impossible**, not merely avoided. This agent re-verified E independently: `ACCESS_TOKEN_FILE_ABSENT`.

**The stack really booted** (`03_isolated_stack_boot_proof.txt`, read by this agent):

- DB URL `postgresql://postgres:<REDACTED>@127.0.0.1:15422/postgres`; API/REST/GraphQL/Functions on `127.0.0.1:15421`; Mailpit `127.0.0.1:15424`.
- `supabase_db_letbuyy-w0-local-env  Up About a minute (healthy)  0.0.0.0:15422->5432/tcp`.
- **124** migrations applied, matching **124** migration files on disk; **438** tables.
- Explicitly contrasted in-file: *"Remote production would be `*.pooler.supabase.com` / `aws-1-ap-south-1`"* — the local port is demonstrably not the remote pooler.
- Every key emitted as `<REDACTED-LOCAL-ONLY>`.

**Why not PASS — the "reproducible" half is broken, and it is broken in the scripts, not the environment:**

- **NAMED BLOCKER — FBR-43 (S2 / BLOCKS-WAVE-1 / OPEN):** `local-stack-up.mjs` is **unrunnable** as written (it performs a db reset, seeds App Bridge, and touches frozen apps). The successful boot recorded above was hand-driven, not script-driven. A hand-driven boot is a demonstration, not a reproducible environment.
- **NAMED BLOCKER — FBR-42 (S2 / BLOCKS-WAVE-1 / OPEN):** `local-stack-down.mjs` **destroys evidence and operates against the real `HOME`**. A teardown script that can delete outside its sandbox must not be run until it is fixed; a non-destructive teardown was performed manually instead (`06_nondestructive_teardown.txt`).
- **NAMED BLOCKER — FBR-52 (S3 / NON-BLOCKING / MITIGATED):** a node-20-versus-≥22 conflict exists between the repo pin and some scripts. Related and worth recording here: **no node 20 toolchain exists on this machine at all** (`nvm`, `fnm`, `volta`, `n`, `node@20` all absent; the shell is `v26.5.1`), so the pinned version is *declared* but not *installable-on-demand* in this environment.

The environment condition is met — an isolated stack was proven and booted, with the external constraints documented exactly. The reproducibility condition is not.

---

## W0-G13 — Baseline commands measured

### Verdict: **PASS**

**Condition:** real exit codes and logs.

**Evidence:** `raw-evidence/build-baseline/00_COMMAND_LEDGER.tsv` is a 48-row TSV (plus header) with columns `slug, workdir, command, start_utc, end_utc, duration_s, exit_code, log`, and a matching `.log` file for every row — 47 log files present. Every row records the worktree it ran in (`.../letbuyy-w0-worktrees/web-v1-integration`), so no measurement is attributable to the original tree.

**This agent opened the logs and confirmed the exit codes rather than trusting the ledger column:**

| Command | Exit | Confirmed from the log |
|---|---:|---|
| `validate-governance --lane=gate` | 1 | log tail `exit_code : 1`; and independently re-run by this agent → exit 1 |
| `validate-governance --lane=report` | 0 | re-run by this agent → exit 0 |
| `pnpm typecheck` (root) | 0 | log tail `exit_code : 0` |
| build `merchant-control-plane` | 0 | ledger + log |
| build `storefront-runtime` | 0 | ledger + log |
| build `identity-platform` | 0 | ledger + log |
| build `marketing-site` | 0 | ledger + log |
| build `api-gateway` (`tsc --noEmit`) | 0 | ledger + log; esbuild bundle separately exit 0 on the 4th attempt |
| **build `platform-console`** | **1** | log line 24: `Type error: Type '{ searchParams: SearchParams; }' does not satisfy the constraint 'PageProps'.` |
| `test:behavioral` **with** Postgres | 1 | log: `tests 1608 / pass 1582 / fail 11` |
| `test:behavioral` **without** Postgres | 1 | log tail `exit_code : 1` |
| `lint` per app × 5 | 1 each | five separate logs |
| `lint:css` | 2 | log tail `exit_code : 2` |

Two figures deserve to be stated precisely because they are easy to misquote: **`fail 11` of `tests 1608`** with the Postgres fixture up, and **`platform-console` is the only failing app build** — and its failure is a Next 16 `PageProps` type error in `(dashboard)/developers/page.tsx` that **`turbo typecheck` returns exit 0 on and that none of the 110 validators detects.** That is a measurement gap in the gate, not a measurement failure of Wave 0.

**No named blocker for this gate.** The failures measured are carried under Part 2 (FBR-17…FBR-21, and the `platform-console` build).

---

## W0-G14 — No production mutation

### Verdict: **PASS**

**Condition:** no deploy, DNS, provider, secret, or production-database mutation occurred.

I treated this as the gate most deserving of adversarial verification, because it is the one where a false PASS would be most damaging. Six independent lines of evidence, all EXECUTED by this agent:

**1. Supabase remote operation was impossible, not merely avoided.**
`~/.supabase/` contains only `telemetry.json` and `traces/`. `~/.supabase/access-token` → **absent**. Without an access token the CLI cannot authenticate to any remote project, so `supabase link`, `db push`, `db pull`, `db reset`, `db seed`, and `migration up` against the cloud were all unavailable regardless of intent.

**2. The production link metadata was never touched.**
Every file under `<original repo>/supabase/.temp` (`project-ref`, `linked-project.json`, `pooler-url`, `postgres-version`, …) carries an mtime of **Aug 1 00:20–00:27**. Wave 0 ran on **Aug 9**. Any `supabase link`, `db pull`, `db push`, or `db reset` rewrites files in this directory. None was rewritten. *(File names only were listed; no content was read and no value is reproduced anywhere in this certification or its evidence.)*

**3. Nothing was pushed.**
`git branch -r --list 'origin/codex/*'` → **empty**. `git for-each-ref refs/remotes` → exactly four refs, none of them `codex/*`. And decisively: every file under `.git/logs/refs/remotes/origin/` carries an mtime of **Aug 3 01:51**, so **no remote-tracking ref has moved since Aug 3**. A successful push updates the corresponding remote-tracking ref and its reflog. None was updated.

**4. Even if something had been pushed, no deploy lane would have fired.**
Read from the workflow files: `deploy-staging.yml` triggers on push to `stepup/main`; `production-deploy.yml` on push to `main`; `staging-runtime-deployment.yml` on `main` / `release/**` with path filters; `staging-deploy.yml`, `production-rollout.yml` and `live-production-certification.yml` are `workflow_dispatch`-only. **No `codex/*` branch reaches any deploying workflow.** This is additionally enforced by `workflow-trigger-coverage-validator.mjs` and proven by seeded regression NEG-2, which catches an attempt to add `codex/**` to the production push trigger.

**5. No other provider CLI holds credentials on this machine.**
`~/.wrangler/config` → does not exist. `~/.local/share/com.vercel.cli` → does not exist. No Cloudflare or Vercel deploy could have been authenticated.

**6. The original checkout's HEAD never moved.**
`git reflog -5` shows `HEAD@{0}` is still the baseline commit; there is no `reset`, `checkout`, `merge`, or `rebase` entry from the Wave 0 window.

**One network operation DID occur, and I record it rather than omit it.** `.git/FETCH_HEAD` has an mtime of **Aug 9 05:05**, so a `git fetch` ran during Wave 0. A fetch is a **read-only** operation: it wrote `FETCH_HEAD` and advanced **no** remote-tracking ref (point 3 proves the refs are frozen at Aug 3) and mutated nothing on any remote. It is not a production mutation. Stating it explicitly is what distinguishes a verified PASS from an assumed one.

**Verdict: PASS.** Every mutation channel — Supabase cloud, git remote, CI deploy lane, Cloudflare, Vercel, and the local production-linked checkout — is independently shown to be either unauthenticated, untriggered, or unmoved.

**No named blocker.** *(FBR-32 — the original repo is linked to Supabase production — is a standing hazard for Wave 1, not evidence of a Wave 0 mutation. It is carried in Part 2.)*

---

## W0-G15 — Evidence self-contained

### Verdict: **PASS_WITH_NAMED_BLOCKERS**

**Condition:** decisive evidence persisted outside `/tmp`, redacted, checksum-indexed.

**Outside `/tmp`: satisfied.** `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/` holds **420 files** across 18 subtrees (`build-baseline/` 47 logs + ledger, `W0-LOCAL-ENV/`, `W0-V1-PERIMETER/`, `w0-validator-execution/`, `appbridge-urgent/`, `preservation/` with 99 patches + 96 untracked-raw files, `doc-corrections/`, and the per-agent trees). The 30 Wave 0 documents live under `docs/launch/web-v1-wave-0-2026-08-09/`. Both are on disk in the repository, not in a scratch directory.

**Redacted: satisfied, and verified adversarially by this agent.** Two scans over the full document set and the full evidence set:

- Secret-shaped literals (`SUPABASE_SERVICE_ROLE_KEY=`, `sk_live`, `rzp_live`, `eyJhbGciOi`) → 5 files hit. Each inspected with output truncated to ≤24 characters. **All five are non-secrets**: `sk_live_should_never_…` is a negative-test fixture, `rzp_live_…` is an elided prefix in prose, and one hit is the scanner's own pattern definition.
- Env-assignment shape `^[A-Z_]{6,}=[A-Za-z0-9/+_-]{16,}$` → 2 files hit, all benign: a container name, a database name, and `CUSTOMER_SESSION_SECRET=local-customer-session-placeholder` — a literal placeholder.
- The local-stack boot log redacts every key as `<REDACTED-LOCAL-ONLY>` / `<REDACTED>`.
- **No `.env*` file content appears anywhere** in the documents or the evidence.

**Why not PASS — checksum indexing is partial:**

- **NAMED BLOCKER — checksum coverage is 1 of 18 evidence subtrees.** The only checksum index is `raw-evidence/preservation/SHA256SUMS.tsv` (214 rows). `build-baseline/` (the 47 command logs and the ledger that back G13 entirely), `W0-LOCAL-ENV/`, `W0-V1-PERIMETER/`, `w0-validator-execution/`, `appbridge-urgent/`, `doc-corrections/`, and the per-agent trees have **no SHA-256 index**. The decisive evidence for four of the sixteen gates is therefore not tamper-evident.
- **NAMED BLOCKER — no top-level evidence index and no ZIP existed at the time of this certification.** `artifacts/local-operational-proof/` contains the mobile readiness ZIP and the `web-v1-wave-0-2026-08-09/` directory, but no Wave 0 archive and no `.sha256` beside it. Packaging is a separate agent's task; until it completes, "self-contained" means "present on this laptop", which is the same durability exposure as FBR-26/FBR-33.
- **Minor, recorded:** some evidence files reference paths under the session scratchpad (e.g. the machine-readable gate matrix written to `/private/tmp/.../post-repair-gate.json`). The *decisive* copies were re-persisted under `raw-evidence/`, but the logs' internal path references point at a directory that will not survive the session.

---

## W0-G16 — Independent falsification complete

### Verdict: **PASS**

**Condition:** an independent agent reviewed and challenged the result.

**This is the strongest gate in Wave 0, and it is strong because the falsification actually found things.**

- **First pass** — `14_INDEPENDENT_REVIEW_AND_FALSIFICATION.md` (Agent G), a dedicated adversarial review of the Phase 1 documents.
- **Second pass** — `30_CORRECTIONS_AND_STASH_HAZARD.md`, which **falsified the falsification**. It found that Agent G had "CONFIRMED" the claim of *"99 textual + 678 binary = 777 real content changes"* by re-running the same `awk` over the same `numstat` — reproducing the upstream **classification** rather than testing it. Doc 14's own correction notice now states the methodological lesson verbatim: *"re-running an upstream document's own command from a fresh shell verifies transcription, not inference."* The missing test (index blob vs worktree blob, all 678 paths) showed 678/678 identical blobs, all `100644 → 100755`. **This agent re-derived that result independently and reached the same number: 6,696 mode-only, 99 real content.**

**Five substantive corrections were forced by falsification, not by review-by-agreement:** the 777→99 refutation; the retraction of doc 04's "36 binary changes inside frozen `apps/theme-marketplace`"; the under-registration of `globals.css` (Group P added so the register sums to 99); doc 13 §1's arithmetic (6785+777+10+31=7603 ≠ 6826, conflating the porcelain `M`-count with the zero-diff subset); and doc 01's v1/v2 mislabel. A sixth finding — **two stashes, with stash@{0} holding a third divergent body of uncommitted work** — was new, appearing in no prior document. This agent re-verified it read-only: **28 files, 1,128 insertions / 1,203 deletions, and all 28 also carry uncommitted work in the current dirty tree**, so applying the stash would conflict with or overwrite every one of them.

**Corrections were applied as annotations, not rewrites.** Docs 01, 03, 04, 13 and 14 each carry a dated `⚠️ CORRECTION NOTICE` header with inline `[CORRECTED]` markers, and doc 14's notice opens with *"This falsification pass CONFIRMED a claim that is false."* History is annotated; nothing was quietly edited to look correct in hindsight.

**This certification is itself a third independent pass.** It re-derived the 99, the 6,696, the 110/PASS=90/FAIL=20, the branch topology, the ancestry exclusion, the stash contents, and the non-mutation evidence from primary commands rather than from the documents — and in doing so closed two open blockers (FBR-41, FBR-47) and found one defect no prior document names: **the integration worktree is not byte-clean** (§G06).

**No named blocker.**

---

# Part 2 — Wave 0 overall result

## Verdict tally

| Gate | Verdict |
|---|---|
| W0-G01 Authority loaded | **PASS** |
| W0-G02 Original worktree preserved | **PASS** |
| W0-G03 Dirty changes classified | **PASS_WITH_NAMED_BLOCKERS** |
| W0-G04 Mode noise isolated | **PASS** |
| W0-G05 Baseline approved | **PASS** |
| W0-G06 Clean V1 worktree created | **PASS_WITH_NAMED_BLOCKERS** |
| W0-G07 Web-only V1 scope frozen | **PASS_WITH_NAMED_BLOCKERS** |
| W0-G08 Mobile preserved but excluded | **PASS** |
| W0-G09 CI covers V1 integration | **PASS_WITH_NAMED_BLOCKERS** |
| W0-G10 Validators report completely | **PASS** |
| W0-G11 No false green | **PASS_WITH_NAMED_BLOCKERS** |
| W0-G12 Isolated environment established | **PASS_WITH_NAMED_BLOCKERS** |
| W0-G13 Baseline commands measured | **PASS** |
| W0-G14 No production mutation | **PASS** |
| W0-G15 Evidence self-contained | **PASS_WITH_NAMED_BLOCKERS** |
| W0-G16 Independent falsification complete | **PASS** |

**9 PASS · 7 PASS_WITH_NAMED_BLOCKERS · 0 FAIL.**

---

## WAVE 0 OVERALL RESULT: **PASS_WITH_NAMED_BLOCKERS**

### Why this is not FAIL

No gate's condition is unmet. Every one of the sixteen has an executed measurement behind it, and the seven qualified verdicts are qualified by **named, evidence-bearing, individually tracked defects** — not by missing work or unverifiable claims.

The decisive point is what Wave 0's job actually was: **to make the repository's true state measurable and to stop it lying.** That job succeeded, and the proof is uncomfortable rather than flattering. At the baseline the gate died at validator #2 and 106 of 108 validators never ran; today all 110 execute and **twenty of them fail loudly**. A wave that ends with more visible red than it started with, on a gate that previously could not fail honestly, has done its job. The failures are the deliverable.

### Why this is not PASS

Seven gates carry open defects, and three of them are structural rather than cosmetic:

- **Nothing has left this laptop.** Twenty-three commits of repair, five branches, 420 evidence files, and 99 preservation patches exist in exactly one place. `git branch -r --list 'origin/codex/*'` is empty and no remote-tracking ref has moved since Aug 3. A disk failure erases Wave 0 entirely.
- **The mobile question is deliberately unresolved,** and so the "web-only V1 scope" is frozen without being complete (G07).
- **Two false-green residuals survive** — the vacuous aggregate pass when no `OUTCOME_*` variables exist, and the self-service ratchet `--update` bypass (G11).

### Named blockers gating Wave 0 closure

Carried from the register (`24_WAVE_0_FAILURE_AND_BLOCKER_REGISTER.md`: 52 entries; S0=2, S1=11, S2=18, S3=20, n/a=1; BLOCKS-WAVE-0=18, BLOCKS-WAVE-1=14, BLOCKS-LAUNCH=12, NON-BLOCKING=8 — summary table re-read by this agent at lines 117–122), with this certification's own updates applied:

**Closed by this certification:**
- **FBR-41** — full gate never run on `8ec05e21` → **now run**: exit 1, PASS=90 / FAIL=20 / BLOCKED=0 / NOT_APPLICABLE=1, 110/110 executed.
- **FBR-47** — 2 validators BLOCKED on unresolvable `typescript` → **BLOCKED=0** with dependencies installed. *Caveat for Wave 1: `route-ownership-validator.mjs` moves from BLOCKED to FAIL, so one of the 20 current failures was previously invisible.*

**New, found by this certification:**
- **The integration worktree is not byte-clean** — ` M packages/theme-engine/src/theme-cli.ts`, mode-only (`100644 → 100755`). Commit deliberately or revert before Wave 1 work begins there.
- **Vacuous aggregate pass (Case F)** — the `gate-aggregate` step exits 0 when zero `OUTCOME_*` variables are present. Add a minimum-outcome-count floor assertion.
- **Checksum coverage is 1 of 18 evidence subtrees** — `build-baseline/` in particular, which is the sole backing for G13, is not tamper-evident.

**Standing, must be closed before Wave 0 can be declared closed:**
1. **Push the five branches** (FBR-26, FBR-33). Nothing in Wave 0 is durable until it leaves this machine.
2. **Read GitHub branch protection** and reconcile it with the repaired `ci.yml` (FBR-23, FBR-22, FBR-24). This is the one gate condition no agent in this session could verify.
3. **Decide `branch-lag-guard`** — it now fails every branch (FBR-28); the option DEPLOY-R1 mandates is to fast-forward `main`, which also closes FBR-27.
4. **Triage the 20 gate FAILs** plus the four red lanes (FBR-17…FBR-20) and the `platform-console` build failure into real defects versus stale expectations.
5. **Classify `services/lcis-api`** (FBR-07) — several gate and behavioural failures cannot move until it is classified.
6. **Human decision on `apps/mobile/merchant-app`** (FBR-06).

**Standing hazards to the original tree — no agent may act on these without explicit human instruction:**
- **The intent-to-add trap is armed:** 10 SQL files staged at the empty blob while holding **43,929 bytes** on disk. `git add` those exact paths before any commit, or lose them silently.
- **Two stashes exist.** `stash@{0}` holds 28 files (+1,128 / −1,203) that **all 28** overlap uncommitted work in the dirty tree. No stash command may be run. Document only.
- **The original checkout is linked to Supabase production** (FBR-32). It remains read-only for all Supabase and provider operations.

### What a Wave 0 pass does and does not mean

**A Wave 0 PASS does NOT mean Web V1 is launch-ready.** It means the repository is ready to begin controlled Wave 1 implementation — and nothing more than that.

Concretely, Wave 0 establishes that the baseline is known and approved, that no user work has been lost, that the gate now executes completely and fails honestly, that a scoped integration branch exists in isolation, that a local environment can be stood up without touching production, and that nothing in production was mutated. It establishes **the ability to measure**, not the quality of what was measured.

It says nothing about whether Web V1 can take traffic. The register's own launch section is unambiguous: **12 entries are BLOCKS-LAUNCH**, and both S0 findings — the same unauthenticated app-platform surface, adjudicated REACHABLE in verbatim production shape with 19 of 83 routes executing for an unauthenticated caller — are open at the baseline commit. The kill switch for them is committed on `codex/emergency-appbridge-killswitch` (`6c3e17df`), which this agent confirmed is **not an ancestor** of the integration branch and which has been neither reviewed by ARB, compiled, nor deployed; its status is **GATED_WITH_RESIDUAL_RISK**. Until ARB decides that rollout and a human confirms the live flag values, **the production state is the baseline state**.

---

**End of certification.** This document records verdicts and measurements. It approves nothing, authorises nothing, and merges nothing.
