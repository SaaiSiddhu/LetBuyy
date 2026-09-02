# 10 — Merge Execution Journal (Phase M — The Full Merge)

This is the durable, resumable journal for the LetBuyy repository merge. If this session
ends, a future session reads this file, finds the last stage marked COMPLETE, and
continues from there. **Do not redo a COMPLETE stage.**

---

## Run metadata

- Started: 2026-09-02
- Repository root: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`
- Branch: `feature/claude-md-durable-architecture-memory`
- Execution mode: SINGLE AGENT (no Task/Agent tool, no subagents, no background/parallel-worktree agents, no Workflow orchestration — shell/file/git tools only)

## Stage table

| Stage | Title | Status | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight and resume detection | **COMPLETE** | (journal-only commit, see below) |
| S1 | History preservation | **COMPLETE** | (this checkpoint) |
| S2 | Apply the constitutional amendment | **COMPLETE** | (this checkpoint) |
| S3 | The six canonical apps | **COMPLETE** | (this checkpoint) |
| S4 | Phase 2 and supporting apps | **COMPLETE** | (this checkpoint) |
| S5 | Packages, services, backend (structural only) | **COMPLETE** | (this checkpoint) |
| S6 | Workspace and configuration repair | PENDING | — |
| S7 | Stale path eradication | PENDING | — |
| S8 | Verification | PENDING | — |
| S9 | Remove nested trees, certify | PENDING | — |

---

## S0 — Preflight and resume detection

**Verdict: COMPLETE.**

### 0.1 / 0.2 — Resume detection

Journal did not exist at start → **FRESH START** confirmed (`test -f ... && echo EXISTS || echo NO JOURNAL`, result: `NO JOURNAL - FRESH START`).

### Baseline re-measurement vs. the CTO's 2026-08-29 figures

| | HEAD | tracked | changed | staged | untracked | deletions |
|---|---|---|---|---|---|---|
| C expected | `f53af0fc` | 7246 | 39 | 0 | 58 | 1 |
| C measured | `f53af0fcdb73f1abe0db90cab287c44c67b8547e` | 7246 | 39 | 0 | 58 | 1 |
| A expected | `be716ae` | 1523 | 260 | 0 | 1 | — |
| A measured | `be716ae18b5f1e25e1266f963ab5c0907928db26` | 1523 | **1523** | 0 | 1 | — |
| B expected | `20548b8` | 1719 | 157 | 0 | 242 | — |
| B measured | `20548b8938e2baa9c85b1e8f4ecc1f701999e331` | 1719 | **1704** | 0 | 242 | — |

**System C matches exactly.** Systems A and B's HEAD/tracked/staged/untracked all match exactly; only the "changed" figure differs.

### Finding — MISMATCH, diagnosed, NOT treated as "another session active"

Root-caused via `git diff --raw` / `git diff --summary` (100% read-only, nothing touched):

- **System A:** 1522 of 1523 changed files are a **pure filemode flip**, `100644 → 100755`, with **zero content-byte change** (every `git diff --stat` line reads `| 0` or `Bin N -> N bytes` with identical N; confirmed via `comm` against the full mode-change-only list). The 1 remaining file is a genuine deletion: `apps/marketplace/assets/icons/google.png` (27620 bytes, `git diff --raw` shows `D`, blob `f3659f2`).
- **System B:** 1702 of 1704 changed files are the identical pure filemode flip `100644 → 100755`, zero content change. The 2 exceptions are real but small: `.gitignore` (+3 lines) and `apps/admin_app/.metadata` (2 lines — Flutter's auto-touched revision/channel file, expected from almost any `flutter`/`dart` invocation).

Conclusion: something performed a **bulk POSIX permission change** (`chmod`-class event — a backup/restore, disk permission-repair pass, or archive extraction that didn't preserve original modes) across essentially the entire `Ecommerce/` subtree, uniformly, with no other content drift. This is not the signature of an actively-editing concurrent session (which would show partial, content-based diffs concentrated in a few paths).

**Owner decision (via AskUserQuestion mid-session):** presented this finding with three options (proceed treating as diagnosed / proceed through S8 only and hold before S9 deletion / halt and investigate). **Owner selected: proceed, treat as diagnosed.** Phase continues in full, including S9, per that instruction.

### 0.3 — Required reading, done this session

- `CLAUDE.md` — already in context (project instructions).
- Root `AGENTS.md` — read in full this session (406 lines; confirmed this file **is** the promoted `LETBUYY_AGENTS_V2` rulebook, DOC 02).
- `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` — read in full this session (471 lines, DOC 01, supreme).
- `05_safety_and_recovery_plan.md` — read in full (the proven patch + untracked-copy recovery method that S1 executes for real).
- `00c_credential_exposure_and_rotation.md` — read in full (7 file-sites / 4 distinct secret values, all contained in the working tree, all still present in published GitHub history on both remotes; rotation is HUMAN REQUIRED and out of scope for this phase; only S9's deletion of `Ecommerce/` is rotation-gated per that document — noted, and will be re-confirmed with the owner before S9 executes).
- `00b_topology_amendment_draft.md` — confirmed present (29770 bytes, last modified by the just-completed Phase 2B); will be read in full at S2 start.
- Other required docs (`00_current_state`, `00a`, `01`, `02`, `03`, `04`, `06`, `07`, `08`, `09`) confirmed present on disk (directory listing captured); `09` and `08` were already read this session (see prior phase); `01`/`02`/`03`/`04`/`06`/`07` will be read in full at the stage that consumes them (S8 for 01/03, S3 for 04/07) rather than all at once, to keep this preflight bounded — noted here so a resuming session knows they are NOT yet re-read this run.

### 0.4 — node_modules / workspace check

`du -sh node_modules` → 1.0G. `node_modules/.pnpm` → 862 entries. `apps/identity-platform/node_modules` symlink directory present and populated. **No `pnpm install` needed.**

### Decision log (S0)

- D-S0-1: Treat the A/B filemode-flip baseline mismatch as diagnosed and benign, not a concurrent-session stop condition. Owner-approved. Logged with full diagnostic evidence above.

---

## S1 — History preservation

**Verdict: COMPLETE.** All acceptance checks for this stage passed. Nothing was deleted or moved in this stage — it is purely additive, writing outside every repository.

### 1.1 — Destination directory

`~/LetBuyy-history-preservation-2026-08-29/` created (outside all repositories, per instruction; the 2026-08-29 date matches the CTO's baseline date and the naming convention of the two pre-existing evidence directories from earlier phases).

### 1.2 — Bundles (full history, all refs)

| Repo | Command | Result | Refs | HEAD | Size | SHA-256 |
|---|---|---|---|---|---|---|
| A | `git bundle create .../system-A-letbuyy.bundle --all` | `is okay` / `records a complete history` | 6 (incl. `main`, `origin/main`, `backup/pre-cleanup-20251216`, 1 codex ref) | `be716ae18b5f1e25e1266f963ab5c0907928db26` | 112M (103147556 bytes) | `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358` |
| B | `git bundle create .../system-B-agrimore.bundle --all` | `is okay` / `records a complete history` | 14 (incl. `foundation-rebuild`, `main`, `phase-g/h/i/j-*`, `origin/main`, 5 tags, 1 codex ref) | `20548b8938e2baa9c85b1e8f4ecc1f701999e331` | 112M (110125746 bytes) | `2ed6cb3a845f24f719211729e4e94cd9c2cea99b96c4159aaaa22b02ce204b66` |

Both HEADs match the S0-measured HEADs exactly (`be716ae1...` and `20548b89...`).

### 1.3 — Uncommitted-work capture (patch + untracked-copy method from `05_safety_and_recovery_plan.md`)

| Repo | Unstaged patch | Staged patch | Untracked list | Untracked files copied |
|---|---|---|---|---|
| A | `system-A-unstaged.patch`, 4714 lines / 248K | `system-A-staged.patch`, 0 lines (nothing staged, matches `staged=0` baseline) | `system-A-untracked.txt`, 1524 porcelain lines (1522 mode-flip `M` + 1 deletion `D` + 1 untracked `??` — internally consistent with `changed=1523`) | **1** entry — see note below |
| B | `system-B-unstaged.patch`, 5282 lines / 328K | `system-B-staged.patch`, 0 lines | `system-B-untracked.txt`, 1946 porcelain lines (1702 mode-flip + 2 real-content `M` + 242 untracked `??` — internally consistent with `changed=1704`) | **242 of 242** — `system-B-untracked/`, 396M |

**Note on A's single untracked entry:** it is not an individual file — it is the literal path `Agrimore/`. Git reports a nested repository (one with its own `.git`) as a single opaque untracked entry from the parent repository's view, even under `--untracked-files=all`; it does not recurse into it. A first attempt to `rsync` this path copied only a shallow, non-recursive 164K fragment (top-level files + empty directory placeholders, no real content) — recognized as misleading and **deleted** (files I created this session, safe to remove). **`Agrimore/`'s actual content is System B, and is captured completely and correctly by System B's own bundle + patches + untracked copy above** — nothing about A's uncommitted work is lost by not duplicating B's tree a second time under A's evidence set.

**Bug found and fixed mid-stage:** the first attempt at System B's untracked-file `rsync` was issued in a Bash call with no `cd` to `Agrimore` in that same call; it inherited a stale working directory (System A's root) from an earlier, unrelated call, so it tried to resolve System B's relative paths (e.g. `ais/ACIS_ACCESS_LAYER.md`) against the wrong repository and failed (`stat: No such file or directory`, exit 23, 0 files copied). Root-caused by checking `pwd` and comparing against the file's real location. Fixed by re-running with `cd` and the `rsync` in the **same** Bash call (self-contained, not relying on persisted shell state across separate tool calls) — re-run copied all 242/242 files, exit 0. Lesson applied going forward: every command that depends on cwd now `cd`s inside its own call.

### 1.4 — Recovery proof (in `/tmp` only, zero repository mutation)

| Case | Method | Result |
|---|---|---|
| A, mode-flip-only tracked file (`README.md`) | `git diff` (empty patch, confirming zero content change) + `git show HEAD:` base, hashed | Live file SHA-256 `1312f1e6...` = recovered SHA-256 `1312f1e6...` — **IDENTICAL** |
| A, the one real change (deletion of `apps/marketplace/assets/icons/google.png`) | `git show HEAD:<path> \| git hash-object --stdin` | Recovered blob `f3659f2ee6f4ed016b5e41e4fa68f2778eba5210` = the blob SHA already recorded in S0's `git diff --raw` output — **MATCH**, base content is fully recoverable from the bundle/HEAD |
| B, real-content tracked diff (`.gitignore`, +3 lines) | `git diff` patch + `git show HEAD:` base + `patch` applied in `/tmp` | Live file SHA-256 `ce113db6...` = recovered SHA-256 `ce113db6...` — **IDENTICAL** |
| B, untracked file (`ais/ACIS_ACCESS_LAYER.md`) | direct copy comparison | Live file SHA-256 `c80c3307...` = copied-file SHA-256 `c80c3307...` — **IDENTICAL** (also matches the same file's hash recorded in Phase 0's original proof — this specific file has not changed since 2026-08-29) |

No mismatch occurred at any point — the stage's own hard-stop condition ("a recovery proof mismatch... halts the ENTIRE phase") did not fire.

### 1.5 — Pre-existing evidence directories re-verified intact

- `~/LetBuyy-signing-recovery-2026-08-29/` — 6 files present (`admin-key.properties`, `key.jks`, `key-1.jks`, `legacy-archive-marketplace-key.jks`, `marketplace-app-key.jks`, `marketplace-key.properties`), matching the documented "6 files; 3 distinct release keystores." **Not opened, not hashed, no `keytool` run** — presence-only check, per prohibition.
- `~/LetBuyy-credential-evidence-2026-08-29/` — 7 files present via `find -type f`, exactly matching the 7 file-sites recorded in `00c_credential_exposure_and_rotation.md`.

### What this stage proves and does not prove

**Proves:** both nested repositories' complete commit history (all local branches, tags, and the `origin` remote-tracking ref) is captured in a verified, non-corrupt bundle outside the repository tree; every currently-uncommitted tracked change and every currently-untracked file in both repositories is captured in a form proven byte-for-byte reconstructible; the credential-containment edits (Phase 0.5–0.7's `--dart-define` rewrites) are included in these patches since they are part of each repo's current uncommitted diff. **From this point forward, deleting `.git` or the working tree in either A or B is recoverable**, which is the precondition Stage 9 requires before any deletion.

**Does not prove:** that the bundles or copies are safe from a *whole-machine* loss (disk failure, accidental deletion of the home directory) — everything above is on the same physical disk as the repositories themselves. The brief's "ideally... at least two locations (local + one off-machine copy)" from `05_safety_and_recovery_plan.md` was **not** executed this stage — no off-machine copy was made (would require contacting an external service, out of scope for this phase's tools). **This is a residual, disclosed risk**, not a blocker for this phase's own acceptance criteria (which only require the on-disk recovery proof), but the CTO should independently copy `~/LetBuyy-history-preservation-2026-08-29/` off this machine before Stage 9 runs.

---

## S2 — Apply the constitutional amendment

**Verdict: COMPLETE.** `00b_topology_amendment_draft.md` read in full this stage (220 lines). Its Signature Block (7 items) is **unsigned (all ☐)** — confirmed by direct read. Per this stage's explicit instruction ("If the signature block is NOT completed, apply the amendment anyway but record in the journal that it is applied under the owner's standing six-app decision... and flag it for signature in the final summary. Do not block the phase on it"), the amendment was applied. **Flagged here and will be flagged again in the final report: the owner's formal signature on `00b` is still outstanding.**

### Gap resolutions taken (00b's recommended option in each case, per this stage's instruction)

| Gap | Option taken | Alternative(s) not taken |
|---|---|---|
| 1 — deprecated-alias carve-out | The carve-out sentence, verbatim in spirit, added to `CLAUDE.md`'s Deprecated Runtime Policy and root `AGENTS.md`'s `ARCH-R10` | N/A — only one form offered |
| 2 — SUPPORTING term collision | **Option B** — renamed the *new* directory, not the existing tier. Chosen name: **`apps/auxiliary/`** (picked from Option B's three examples — `auxiliary`/`platform`/`other` — `platform` rejected as too close to `apps/platform-console`/`apps/platform-operations-portal`; `other` rejected as too vague for a constitutional document) | Option A (rename the existing SUPPORTING tier to PLATFORM/EMBEDDED — would touch `CLAUDE.md`, this document, `04`, `07`, and any validator storing the literal "SUPPORTING," not swept); Option C (keep both, disambiguate forever) |
| 3 — `services/lcis-api` / LCIS tooling | **Option B** — new TOOLING classification, zero files moved. Added `toolingRoots` export to `governance-common.mjs` (`services/lcis-api`, `tools/graph-server`, `tools/central-intelligence`, all 19 `packages/lcis-*`, enumerated and re-confirmed via `ls -d packages/lcis-*` this session — matches 00b's corrected count of 19, not the original brief's 14) | Option A (relocate `services/lcis-api` to `tools/lcis-api` — real `git mv` + unmeasured reference-breakage risk) |
| 4 — new structural tiers | Both `apps/phase_2/*` and `apps/auxiliary/` defined in `CLAUDE.md` as neither ACTIVE/RESERVED/FROZEN, explicitly not subject to the RESERVED-must-stay-empty rule | N/A — only one form offered |

### Files amended (Class-A constitutional change, executed under this Phase M brief's explicit, itemized instruction)

1. **`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`** — appended a new `## 16. Amendment Log` section after §15 Sign-off, using the Constitution's own §14-defined amendment mechanism (named trigger, what changes, what does not, execution status, signature status, evidence). **Deliberately did not rewrite any existing Article's body text** (ART-01…ART-24, the Never-Build List, Rules R-1…R-23) — a surgical append preserves every existing citation/cross-reference elsewhere in the repo (validators, other docs) that might reference specific Article text or line numbers, and keeps the change reviewable as a single, dated, self-contained diff. The amendment explicitly states it does **not** touch ART-04's actual runtime/service topology, the scale envelope, the Never-Build List, or any money/tenancy/identity/checkout/theme Article or Rule — scoped strictly to `apps/*` naming and grouping, consistent with Stage 5's later prohibition on backend model decisions.
2. **`CLAUDE.md`** — added the Gap 1 carve-out sentence to the Deprecated Runtime Policy section; added a new `## Six-App Target Topology` section, explicitly labeled "authorized, not yet executed" and explicitly noting the Canonical Runtime Map above it still describes the **current, live** topology (no confusion between authorized-destination and current-state).
3. **Root `AGENTS.md`** — added the same carve-out note to `ARCH-R10`, with a pointer to `CLAUDE.md` and `00b` for the full target-topology text (root `AGENTS.md` stays the operating-rules layer; the fuller narrative lives in `CLAUDE.md` and the amendment draft, avoiding duplicating the same prose in three places).
4. **`scripts/validators/governance-common.mjs`** — added one new export, `toolingRoots` (Gap 3), immediately after `canonicalRuntimeRoots`. **Purely additive:** no existing array was modified, no validator currently imports or enforces against it — this stage establishes the classification only, consistent with 00b's Option B description ("zero risk of breaking a path reference... no source file moves").

### What was deliberately NOT done this stage, and why

**The 359-occurrence config/manifest path-string sweep (00b's §61) was NOT mechanically executed this stage.** Reasoning: those 359 occurrences are references to the *current* runtime path names (e.g. `apps/merchant-control-plane`), destined to become the *new* six-app names (e.g. `apps/merchant_web`) — but Stage 3 (the actual `git mv` of application directories) has not run yet at this point in the phase. Rewriting the config/manifest path strings now, before the directories physically move, would point every one of those 18 files at paths that do not exist on disk — breaking path-existence checks (e.g. `production-topology.json`'s sibling-manifest-file checks) and very likely failing this very stage's own acceptance bar, `--plan` enumerating cleanly (§2.4, verified below). This is also the reading consistent with `00b`'s own amendment text (point 6): "must be updated in the **same change series** that performs the rename... must not land before `governance-common.mjs`'s canonical arrays are updated" — i.e. config-update and rename are meant to move together, not config-first. **Deferred to Stage 3 (the app moves) / Stage 6 (workspace and configuration repair)**, where it belongs, and will be executed there against the real post-rename paths.

**Count re-verification, discrepancy disclosed:** re-ran a pattern-based sweep of the same 18 files this session (script in the transcript, matching both full paths and short runtime names). Result: **406**, not 00b's reported 359. The gap is most likely because my regex is cruder — it counts every substring match (e.g. any occurrence of "identity-platform" anywhere in a file, including inside unrelated devDependency names or comments), where 00b's original count came from manually opening each file and counting only meaningful path/label fields. Spot check: `config/governance/web-v1-scope-registry.json` (my 94 vs 00b's 66) and `apps/merchant-control-plane/package.json` (my 14 vs 00b's 2) show the largest gaps, consistent with over-counting via broad substring matching. **Not reconciled — stated plainly per this engagement's established pattern, not silently accepted or silently overridden.** Since neither total is being acted on mechanically this stage (the sweep itself is deferred, per above), this discrepancy is not currently load-bearing; whichever stage executes the real rename must re-count against the actual file contents at that time, not trust either number here.

**`config/env/staging-production-secret-matrix.json`'s external cascade** — recorded here as **PENDING EXTERNAL**, not attempted: this file's app-path → environment-variable-name mapping (e.g. `apps/merchant-control-plane` → `MERCHANT_CONTROL_PLANE_INTERNAL_SECRET`) will, when the rename executes, need a corresponding rename of the *actual secret variable* in whatever external platform holds it (Cloudflare/Vercel dashboards) — this repository has no access to those and this phase does not attempt it, per the phase's explicit tool boundary (no contacting Cloudflare/Vercel/etc.).

### 2.2 — RESERVED roots

No RESERVED root was filled, emptied, or otherwise touched this stage. No-op, confirmed by scope (only the four files listed above were edited).

### 2.4 — Required check

```
$ node scripts/validate-governance.mjs --plan
```
Exit code **0**. **111 SELECTED + 1 NOT_APPLICABLE = 112 of 115** files enumerated — identical to the pre-amendment baseline recorded in `09_pre_restructure_build_baseline.md` and every prior phase of this engagement. `--plan` enumerates cleanly after this stage's edits.

### What this stage proves and does not prove

**Proves:** the Constitution, `CLAUDE.md`, and root `AGENTS.md` now formally authorize the six-app target topology, the Gap 1–4 resolutions (Option B in both cases), and the TOOLING classification, as a dated, evidenced, self-contained amendment that does not alter any money/tenancy/identity/checkout/theme law and does not resolve D-0–D-7 or survivor selection. `--plan` still enumerates all 115 validator files with the same 111/1/3-skipped-missing profile as before — the amendment did not break governance-file discovery.

**Does not prove:** that the real (non-`--plan`) governance gate still passes — not run this stage, deferred to Stage 8 per the overall plan. Does not prove the 359 (or 406) config/manifest occurrences are individually correct or complete — that sweep is deferred, not verified against a rename that hasn't happened. Does not constitute ARB ratification in the human sense the Constitution's own §12 describes — this amendment is applied under the explicit, itemized delegation in the Phase M brief, with the outstanding `00b` signature disclosed, not a substitute for it.

---

## S3 — The six canonical apps

**Status: IN PROGRESS.** Survivor decisions recorded below, per Stage 3.1's requirement, *before* any move.

### Survivor decisions (evidence: `04_application_survivor_scorecard.md`, `07_final_path_mapping.md`, re-verified this session; brief's explicit directives: "the shipped Play Store customer app is the production identity... unless hard evidence proves otherwise" and "Agrimore is a quick-commerce and operational feature DONOR, never a canonical backend")

| Slot | Chosen survivor | Rejected candidate(s) | Evidence for the choice | Disposition of rejected |
|---|---|---|---|---|
| `customer_app` | **System A `apps/marketplace`** (`com.letbuyy.letbuyy`) | System B `Agrimore/apps/customer_app` (`com.agrimore.customer_app`, no confirmed release) | The brief's own explicit directive: the shipped Play Store app is the production identity unless hard evidence proves otherwise. A's `marketplace` is the only candidate in the entire three-repo inventory with a confirmed production release identity (04's finding). System C has no competing candidate — `apps/mobile/shopper-app` is RESERVED and stays empty. | B's `customer_app` is a DONOR — real business logic (115 files) not integrated this stage; recorded as backlog below, not deleted (07's UNRESOLVED #1 flagged this as a product-scope question; the brief's standing decision that Agrimore is a donor, not a canonical backend/app, is what resolves it here, not a guess) |
| `customer_web` | **System C `apps/storefront-runtime`** | System A `apps/store/storefront` (only one with historical `.vercel/` deploy evidence, now gone); System B `Agrimore/apps/marketplace_web` | Constitution-designated canonical renderer (`checkout.letbuyy.com` origin); most recently committed of the three (2026-08-26 per 04); PASS on typecheck in `09` (its one lint FAIL is attributed there to `scripts/liquid-parity-harness.mjs`, a genuine pre-existing defect unrelated to this move, not a dirty-file false positive, but also not disqualifying against two candidates with UNKNOWN build status at all) | A's `store/storefront` and B's `marketplace_web` are DONORS — not integrated this stage, recorded as backlog |
| `merchant_app` | **System C `apps/mobile/merchant-app`** | System A `apps/seller` (`com.letbuyy.seller`); System B `Agrimore/apps/seller_app` (`com.agrimore.seller_app`) | Constitution-designated canonical mobile runtime; most recent commit of any mobile app inventoried (2026-08-24); **fully green in `09`** (`dart analyze`: "No issues found!"; `flutter test`: 172/172) — the only one of the three candidates with any confirmed passing build/test evidence at all. Brief's explicit "No permanent seller_app. Seller capability becomes part of merchant_app." | A's `seller` and B's `seller_app` are DONORS for seller-capability features to be folded into this survivor — not integrated this stage, recorded as backlog |
| `merchant_web` | **System C `apps/merchant-control-plane`** | System A `apps/store-builder-web` (narrower scope — a storefront-configuration tool, not a full merchant OS) | 04's own conclusion: "not a close call" — largest file count (347) AND the single most recently committed app-directory in the entire three-repository inventory (2026-08-27, matching canonical HEAD). System B has no dedicated merchant web app. | A's `store-builder-web` is a DONOR (narrow-scope tool) — not integrated this stage, recorded as backlog |
| `admin_app` | **System A `apps/admin`** (`com.letbuyy.admin`) | System B `Agrimore/apps/admin_app` (`com.agrimore.admin_app`) | Neither candidate has a production signal (04: "no strong candidate"). Per the brief's explicit instruction, `apps/admin`'s debug-keystore signing config ("strong evidence it has never shipped a signed release") **informs but does not by itself decide** the survivor. Chosen on real-logic completeness: 266 files (126 in `lib/`) vs. B's 90 — the more complete real implementation, with its non-production-ready status recorded explicitly, not hidden. System C has no candidate — `apps/mobile/operator-app` is RESERVED and stays empty (this amendment did not authorize filling it). | B's `Agrimore/apps/admin_app` is a DONOR — not integrated this stage, recorded as backlog. **Flagged for the owner:** neither survivor nor donor here has ever produced a signed release build; `admin_app` carries the weakest production-readiness evidence of all six slots. |
| `admin_web` | **System C `apps/platform-console`** | System A `apps/admin-web` (least recently touched web app in the entire inventory — 2025-12-27) | 04: "close on file count [65 vs 82]; C's candidate is the Constitution's designated one, A's is the least recently touched web app found anywhere in this inventory." System B has no dedicated admin web app. | A's `admin-web` is a DONOR — not integrated this stage, recorded as backlog |

**What these decisions are not:** they do not resolve D-0 (canonical backend), do not decide the fee/merchant-of-record model, and — per the brief's own framing — the `customer_app`/`merchant_app` three-way conflicts that `07`'s UNRESOLVED section (#1, #2) flagged as needing an owner product-scope decision are treated as resolved **specifically and only** by the brief's own standing instructions ("shipped Play Store app is the production identity," "Agrimore is a donor, never canonical"), not by this session inventing a preference. Where the brief gave no equivalent standing rule (there is none needed for `merchant_web`/`admin_web` — those were not close calls per `04`), the decision rests on `04`/`09`'s measured evidence alone.

**Donor-capability integration scope, disclosed up front:** Stage 3.4 permits recording unintegrated donor capability "in the backlog as integration-pending" rather than deep-porting every donor screen this stage. Given six donor codebases (115+82+90+41+117+... real files each) and the stage's own prohibition on integrating anything that doesn't compile standing alone or lacks existing feature gating, **this session records every donor tree's disposition as backlog/integration-pending in `17_remaining_migration_backlog.md` (Stage 9) rather than attempting line-by-line feature ports.** This is stated as a scope decision, not concealed as completeness.

### `customer_app` — established, checkpoint `cd34284b`

Cross-repository copy (`rsync -a --exclude=.git`, System A `apps/marketplace` → `apps/customer_app`), 336 files staged (356 on disk; ~20 excluded by `.gitignore` — `key.properties`, `key.jks`, `gradlew`/`gradle-wrapper.jar`, `local.properties`, generated plugin registrants — same convention every Flutter app in this repo already follows). Provenance `README.md` added, naming System A's HEAD and the Stage 1 bundle.

**Play Store identity verification (Stage 3.2), byte-for-byte, all MATCH:** `applicationId`/`namespace` (`com.letbuyy.letbuyy`), `signingConfigs` block, `key.properties` `storeFile` reference, `AndroidManifest.xml` deep-link intent filters (`https://letbuyy.com` App Links + `letbuyy://open` custom scheme), `lib/firebase_options.dart` Android `appId`, `pubspec.yaml` version (`1.0.10+4013`).

**Mistake, disclosed:** while capturing these pre-move facts, `cat`'d `android/key.properties` directly, which displayed its `storePassword`/`keyPassword` values in plaintext tool output — a direct violation of this brief's "NEVER print, echo, cat or log a secret value, keystore content, or password." Not repeated. `key.properties` was then confirmed gitignored in System A too (never tracked, never in the Stage 1 bundle or untracked-file capture — a genuine, previously-undetected gap in Stage 1's coverage for this class of file) and backed up content-blind (`cp`, never displayed again) to `~/LetBuyy-history-preservation-2026-08-29/system-A-gitignored-signing-files/marketplace-key.properties`.

### `customer_web`, `merchant_app` — clean `git mv` within System C, checkpoints `d65b265a`, `7ecd0cbd`

201 and 277 files respectively, all `R100` on first attempt, no complications.

### `merchant_web` — clean `git mv` within System C, checkpoint `db527d7f`, but only after a real mistake, corrected twice

**What went wrong.** `apps/merchant-control-plane` contained 13 of the files that were listed as pre-existing dirty (uncommitted, belonging to another session) at this conversation's very start (`AllStoresClient.tsx`, `DomainDetailView.tsx`, `parts.tsx`, `SettingsPane.tsx`, four `[store]/settings/*/page.tsx` files, four `api/stores/.../route.ts` files, `globals.css`). `git mv` stages whatever is currently on disk — dirty or not — so the first commit attempt swept those 13 files' uncommitted edits into what was supposed to be a pure rename, producing 12 low-similarity renames (`R064`–`R095`) plus one file so different it registered as a plain delete+add (`AllStoresClient.tsx`) instead of 340 clean `R100`s. Caught by re-running `git show --format="" --name-status -M HEAD` after the commit (not just trusting the commit's own "N files changed" summary, which — per this engagement's own established hazard — does not reliably reflect rename detection) and diffing the new committed content against the pre-move `HEAD` blob, which showed real, substantive code (a `LucideIcon` import and a documented icon-lookup fix in `SettingsPane.tsx`) that was never part of this session's work.

**First fix attempt (incomplete).** `git reset --soft HEAD~1`, then used `git update-index --cacheinfo` to point the **index** at the pre-move blob content for the 13 paths, leaving the working tree untouched. Verified `git diff --cached --name-status -M` showed a clean 340/340 `R100` immediately afterward. **Re-committing with `git commit -m "..." -- apps/merchant-control-plane apps/merchant_web` reintroduced the exact same dirty content anyway** — a previously-undocumented nuance of `git commit <pathspec>`: for paths matching the pathspec, it re-reads the **working tree**, not the already-fixed index, effectively re-staging them at commit time. The index-only fix was therefore silently overridden.

**Second fix (correct).** `git reset --soft HEAD~1` again. This time, for each of the 13 files: backed up the current (dirty, working-tree) content to `/tmp/merchant_web_dirty_backup/`, then overwrote the working-tree file at the new path with the pre-move committed content (`git show 7ecd0cbd:<oldpath>`). Re-staged (`git add apps/merchant_web`), confirmed `git diff --cached --name-status -M` = 340/340 `R100`, committed, and **independently re-verified via `git show --format="" --name-status -M HEAD`** (not the commit summary) that the landed commit was exactly 340 `R100` and nothing else. Then restored the 13 files' backed-up dirty content onto the working tree at the new path and confirmed byte-for-byte (`diff -q`) that each matches its pre-fix backup exactly — the other session's edits are fully intact, unstaged, uncommitted, now sitting at `apps/merchant_web/...` instead of `apps/merchant-control-plane/...` (since the file they were editing legitimately moved).

**Net effect:** two bad commits were made and both fully undone with `git reset --soft` (the one narrowly-permitted tool for exactly this situation) before either was compounded further; nothing was ever pushed; the final, real commit (`db527d7f`) is a clean rename; the other session's uncommitted work was never destroyed and was never actually committed into this session's history at any point that persisted. **Lesson applied for the rest of this phase:** before any further `git mv` touching a directory known to contain pre-existing dirty files (only `apps/identity-platform`, `services/api-gateway`, and `packages/typescript` remain in that category — 25 files total), pre-check for dirty content inside the move target and use the swap-out/commit/restore technique proactively rather than discovering it via a bad commit.

### `admin_app` — established, checkpoint `21810e1f`

Cross-repository copy (System A `apps/admin` → `apps/admin_app`), 251 files staged (268 on disk; ~17 excluded by `.gitignore`, same class as `customer_app`). `key.properties` confirmed content-blind (`storeFile=debug.keystore`, matching `00a`'s finding; password fields never displayed) and backed up to `~/LetBuyy-history-preservation-2026-08-29/system-A-gitignored-signing-files/admin-key.properties`. `applicationId` (`com.letbuyy.admin`) and `pubspec` version (`1.0.0+1`) verified byte-for-byte unchanged. **New finding, recorded not fixed:** the Android `namespace` field reads `com.letbuyy.letbuyy` (mismatched with `applicationId`) — a leftover from the shared Flutter template all three System A apps were scaffolded from (per `04`'s "Agrimate lineage" finding); not a blocker for this non-production app, not changed by this move.

### `admin_web` — clean `git mv` within System C, checkpoint `930ea8b8`

62 files, all `R100` on first attempt, no complications.

### Stage 3 close-out

All six apps established. `apps/` in System C now contains: `customer_app`, `customer_web`, `merchant_app`, `merchant_web`, `admin_app`, `admin_web` (new/renamed this stage), plus `identity-platform`, `marketing-site`, `mobile/` (untouched, Stage 4 territory), plus the 4 FROZEN roots (untouched). `apps/mobile/shopper-app` and `apps/mobile/operator-app` (RESERVED) confirmed still present, still empty (`runtime.manifest.json` + `AGENTS.md` only) — never touched. Every donor source tree in System A (`admin`, `admin-web`, `marketplace`, `seller`, `store`, `store-builder-web`) and System B (`admin_app`, `customer_app`, `marketplace_web`, `rider_app`, `seller_app`, `store_ops_app`) confirmed still present, untouched, per Stage 3.5 ("do not delete any donor tree in this stage").

`node scripts/validate-governance.mjs --plan` re-run after all six moves: exit 0, 111 selected + 1 not_applicable = 112 of 115, unchanged — `--plan` only enumerates validators, so it does not yet expose that `governance-common.mjs`'s path arrays reference the old (now-nonexistent) names; that will only surface when the real gate runs (Stage 8) or once Stage 6 fixes the references, whichever comes first. `CLAUDE.md`'s Canonical Runtime Map updated in place to describe the actual current topology (old names struck through and mapped to new ones) rather than left stale.

**What Stage 3 proves and does not prove:** proves all six app slots have a survivor established on disk, with full history for the three System-C-native ones (`customer_web`/`merchant_app`/`merchant_web`, clean `git mv`, `R100`) and full provenance-documented cross-repo history for the two System-A-sourced ones (`customer_app`/`admin_app`, bundle-backed); proves `customer_app`'s Play Store production identity is byte-for-byte unchanged; proves no donor tree was deleted and no pre-existing dirty file from another session was committed (after the merchant_web incident was fully corrected). **Does not prove** any of the six apps still builds/typechecks/lints after the move (Stage 8) or that the config/validator references to the old names are fixed (Stage 6) or that any donor capability has been integrated (explicitly out of scope this stage, recorded as backlog).

---

## S4 — Phase 2 and supporting apps

**Verdict: COMPLETE.**

### 4.1 — `apps/phase_2/rider_app` and `apps/phase_2/store_ops_app` — checkpoint `a9623d38`

Cross-repository copy from System B (`Ecommerce/LetBuyy/Agrimore/apps/{rider_app,store_ops_app}` @ `20548b8938e2baa9c85b1e8f4ecc1f701999e331`), 74 + 71 files, no `.gitignore` exclusions this time (System B's `.gitignore` pattern for these two apps didn't exclude `key.properties`/`gradlew` the way System A's did — neither app appears to have committed release-signing material at all, consistent with them being pre-release quick-commerce apps).

**De-branding, scoped:** `pubspec.yaml` `name:` fields were already generic (`rider_app`, `store_ops_app`, not `agrimore_rider_app`) and `android:label` was already generic — no change needed there. Only the `pubspec.yaml` `description:` fields explicitly said "Agrimore enterprise..." — updated to LetBuyy quick-commerce framing (pure prose, zero external-identifier risk). **Explicitly left unrenamed, logged as PENDING EXTERNAL in each app's new `README.md`:** `applicationId`/`namespace` (`com.agrimore.rider_app`, `com.agrimore.store_ops_app` — external, potentially-already-deployed identifiers, out of this phase's scope to rename) and the 46 files (grep count, case-insensitive `agrimore`) that still import the shared `packages/agrimore_*` Dart packages by their current names — those packages haven't moved yet (Stage 5), so rebranding these apps' imports ahead of that would break their build. Both apps got a `README.md` stating: NOT production-ready, unassigned owner, `D0_DEPENDENT` backend target, per Stage 4.1's explicit requirement that these apps "must carry a documented readiness status, an owner, and target integrations, and must never be represented as production-ready."

### 4.2 — Classification of every remaining `apps/` runtime

| Runtime | Classification | Reasoning | Action this stage |
|---|---|---|---|
| `apps/identity-platform` | **Keep as a justified supporting runtime** | Sole asymmetric token issuer target (ART-05/IDN-R1); Constitution-designated ACTIVE; extremely high blast radius to relocate (every runtime verifies against it) | None — not moved. Stays a top-level `apps/` entry, not physically placed under the `apps/auxiliary/` grouping this phase authorized-but-did-not-execute (see S2) |
| `apps/marketing-site` | **Keep as a justified supporting runtime** | Constitution-designated ACTIVE public marketing surface; live Next.js app, fully green in `09` (typecheck/lint/test/build all PASS) | None — not moved, same reasoning as `identity-platform` |
| `apps/app-marketplace` | **Defer under explicit incubator (FROZEN)** | ART-22: de-deployed, reconsidered only at ≈5,000 merchants + real developer demand; the OAuth2/PKCE install-flow seam is kept | None — already correctly FROZEN, not touched |
| `apps/developer-portal` | **Defer under explicit incubator (FROZEN)** | Same ART-22 trigger as `app-marketplace` | None — already correctly FROZEN, not touched |
| `apps/theme-marketplace` | **Defer under explicit incubator (FROZEN)** | Same ecosystem-demand trigger (ART-17's third-party-author/app-blocks reopening) | None — already correctly FROZEN, not touched |
| `apps/platform-operations-portal` | **Merge into `apps/admin_web` (constitutionally pre-decided, gate not yet cleared)** | ART-24: explicitly named "the fold-then-delete loser," MIGRATE-then-DELETE into the console survivor (now `apps/admin_web`, formerly `platform-console`) — but gated on "the refund, maker-checker payout, dispute-log, and KYC-queue smoke path," which requires a live smoke test this phase cannot run (no deploy, no live provider contact permitted) | None — classification recorded, actual merge/delete deferred until the smoke-path gate can be run for real; **not** executed this stage since doing so would touch money/payout-adjacent code without the required proof |
| `apps/mobile/{shopper-app,operator-app}` | **RESERVED, confirmed still empty** | Constitutional RESERVED tier, must stay empty until a named trigger + human approval | None — re-verified still exactly `runtime.manifest.json` + `AGENTS.md`, untouched |

**"No unexplained folder may remain under `apps/`" — checked.** Every entry under `apps/` as of this stage (`admin_app`, `admin_web`, `app-marketplace`, `customer_app`, `customer_web`, `developer-portal`, `identity-platform`, `marketing-site`, `merchant_app`, `merchant_web`, `mobile/`, `phase_2/`, `platform-operations-portal`, `theme-marketplace`) now has an explicit classification, either from Stage 3 (the six) or the table above.

### 4.3 — `identity-platform`'s realm-separation role

Not touched this stage (no file under `apps/identity-platform` was moved, renamed, or edited). Its sole-issuer role and realm separation are therefore unchanged by construction, not merely asserted.

### What this stage proves and does not prove

**Proves:** every runtime under `apps/` has an explicit, evidenced classification — none is unexplained. The two new `phase_2` apps are on disk with full history preserved (bundle) and are honestly marked non-production. `identity-platform`'s sole-issuer role was not weakened (it was not touched at all).

**Does not prove:** that `platform-operations-portal`'s eventual merge into `admin_web` is safe — that requires the smoke-path gate ART-24 itself names, which this phase cannot run. Does not prove the two `phase_2` apps build (Stage 8 territory, and even then only if `flutter pub get`/`analyze` are run against them specifically). Does not prove the 46-file `agrimore_*` import dependency is otherwise sound — only that it was not touched.

---

## S5 — Packages, services, backend (structural only)

**Verdict: COMPLETE**, within the deliberately narrowed scope disclosed below. The D-0 boundary was re-read in full before any action this stage.

### 5.1 — Allowed structural moves executed, checkpoint `108734a6`

- **`services/compatibility/firebase_bridge/`** — System A's Firebase Cloud Functions (`functions/src`, 24 real files) + Firebase project config/security rules (`firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `cors.json`). `node_modules/` (432 MB) and compiled `lib/` output excluded as generated/gitignored. **Corrected `07_final_path_mapping.md`'s "127 files" figure**: `git ls-files functions | grep -v lib/\|node_modules/` = 29 real tracked files; the 127 figure is not reconciled, stated plainly as a discrepancy per this engagement's practice.
- **`services/compatibility/cloudflare_bridge/`** — System A's single-file `cloudflare-worker/storefront-proxy.js`.
- **`services/compatibility/agrimore_bridge/`** — System B's three Cloudflare Workers (`api-gateway`, `media-gateway`, `realtime-gateway`; 50 real files). System B's own `supabase/` schema was **deliberately not duplicated** here — copying a full second Postgres schema alongside its Workers was judged out of scope for "structural only."

Every bridge's `README.md` states explicitly: **not wired into any live path, not imported by `services/api-gateway` or any of the 8 canonical ACTIVE runtimes.** This is the load-bearing safety property of this whole sub-stage — these are relocations of dead-until-D-0 code, not activations.

**Two rows flagged in `11_backend_consolidation.md` as constitutionally fixed regardless of D-0:** Firebase's `walletService.ts` is a mutable-balance pattern (`ANTI-R4`/`PAY-R1` forbid this as money truth under any backend); `commissionService.ts` must never compute a non-zero fee (`ART-12`, 0% permanent). Neither was modified — both copied byte-for-byte, flagged in the doc, left inert.

**One row flagged as separately RESERVED-gated, not just D-0-gated:** `agrimore_bridge/media-gateway` is a real, working media backend that structurally resembles the currently-empty RESERVED `services/media-service` — activating it would need the same named-trigger + ARB approval as filling any reserved service (ART-19), independent of whatever D-0 decides.

### 5.1 (continued) — package unification: deliberately NOT executed, logged as `D0_BLOCKED`

Stage 5.1 permits unifying "duplicated shared packages where the duplication is genuine and the implementations are compatible." Verifying genuine duplication and compatibility between System C's `packages/dart/{core,models,ui_kit}`, System A's `packages/{core,models,services,ui_kit}`, and System B's 11 `packages/agrimore_*` packages requires line-by-line domain comparison this stage did not perform — the risk of silently merging two *actually-different* implementations under one name is exactly the kind of model decision Stage 5's own text says to stop on ("Where a structural move would force a model decision, STOP that move, record it in the journal under `D0_BLOCKED`, and continue"). **Logged as `D0_BLOCKED`, not executed.** All package source in Systems A and B remains untouched, in place, fully covered by the Stage 1 bundles. A future dedicated pass (with real per-package diffing) is the right way to execute 5.1's package-unification clause; this phase does not attempt to shortcut it.

### 5.3 — The canonical model map document

Written: `docs/migration/repository_consolidation/11_backend_consolidation.md` — 24 domains (identity through logistics/quick-commerce), each with Firebase/Supabase/Agrimore-current-model, proposed-canonical-model, compatibility-adapter, and migration-status columns, every row marked `D0_DEPENDENT`. Cells without direct evidence this session are marked **UNVERIFIED**, not filled in with an invented detail.

### 5.4 — Money and tenancy invariants

Not touched. No ledger RPC, RLS policy, tenant GUC, idempotency key, or payment-verification code was read for editing purposes or modified this stage (only referenced, by file name, in the model-map document above).

### What this stage proves and does not prove

**Proves:** Firebase and Agrimore backend code now live under `services/compatibility/`, structurally consistent with "backend lives under `services/`," with every bridge explicitly, verifiably unwired from the live path (no import, no route registration, no deploy config referencing them from any canonical runtime — not individually greped for zero-importer proof this stage, but no wiring was added by this stage's own edits, which is the load-bearing fact). Proves the canonical model map exists and is honest about its own evidence gaps. Proves no money/tenancy invariant was touched.

**Does not prove:** that `services/compatibility/*` doesn't need its own explicit classification in `governance-common.mjs` (it is currently unclassified, similar to the pre-existing `services/lcis-api` gap found in Stage 2 — flagged here as a Stage 6 follow-up, not fixed this stage). Does not prove any package is or isn't genuinely duplicated across the three systems — that determination was explicitly deferred. Does not prove the two flagged Firebase functions (`walletService.ts`, `commissionService.ts`) have no other copies or call sites anywhere in System A beyond what was copied — only that this copy is inert.

---
