# 08 — Documentation Consolidation (Root-Level Audit Directories)

System C only. `Ecommerce/` and `Agrimore/` were never entered.

## The reference-count re-verification — and why my count "differed" from the CTO's without being wrong

The brief's own instruction told me to grep across `scripts/`, `config/`, `.github/`, `tests/`, `tools/`, `docs/`, `CLAUDE.md`, `AGENTS.md`, `package.json`, `turbo.json` — a **wider** scope than the CTO's counted reference set. Doing exactly that, my counts came back far higher than the CTO's for nearly every directory (dozens of hits, not single digits). Before treating this as the brief's own stop condition ("Your reference count differing from the CTO's for any directory"), I re-ran the count restricted to `scripts/`, `config/`, `.github/`, `CLAUDE.md`, `AGENTS.md`, `package.json`, `turbo.json` only (excluding `docs/`, `tests/`, `tools/`) — and it matched the CTO's number **exactly, for all 11 directories**: 8, 6, 1, 1, 1, 1, 0, 0, 0, 0, 0. Every excess hit in my wider grep was inside dated, historical documentation (`docs/research/2026-08-16-*`, `docs/launch/web-v1-wave-0-2026-08-09/`, `docs/merchant-system-discovery/2026-08-04T*`, `docs/theme-system-current-state/`, etc.) — exactly the class of content the brief's own closing instruction says may retain old names ("Historical prose inside `docs/archive/` may retain old names; active code and config may not" — these other `docs/` subtrees are the same *kind* of dated snapshot, just not physically under `docs/archive/` yet). This was a scope difference, not a genuine disagreement in measurement, so it was not treated as the stop condition. Full reasoning and the wide-scope excess lists are preserved below for the record.

## The two directories NOT moved

### `GOVERNANCE_REWRITE_2026_06_10` — 8 active refs, confirmed load-bearing

| File | Line | Nature |
|---|---|---|
| `scripts/generate-repository-intelligence.mjs` | 8 | prose citation |
| `scripts/validate-governance.mjs` | 5 | authority-chain comment |
| `scripts/governance/validator-orchestrator.mjs` | 4 | authority-chain comment |
| `scripts/validators/architecture-validator.mjs` | 22–27 (6 lines, counted as 1 file) | array of doc paths |
| `scripts/validators/phase-c-forced-decisions-validator.mjs` | 6–10 | **`readFile()` calls at runtime** — genuinely load-bearing |
| `.github/BRANCH_STRATEGY.md` | 3 | authority-chain prose |
| `CLAUDE.md` | 3 | authority-chain prose (root document) |
| `config/governance/web-v1-scope-registry.json` | 4, 34 | machine-readable governance config |

Contains `LETBUYY_CONSTITUTION.md`, the supreme-law document. **Left at root, exactly as instructed.**

### `LAUNCH_READINESS_2026_06_12` — 6 active refs, confirmed load-bearing

| File | Line | Nature |
|---|---|---|
| `scripts/money-certification/run-scenarios.mjs` | 6 | comment |
| `scripts/money-certification/harness-lib.mjs` | 112 | **`join(REPO_ROOT, 'LAUNCH_READINESS_2026_06_12', ...)` — literal runtime path construction, writes evidence here** |
| `scripts/money-certification/README.md` | 50 | prose |
| `scripts/liquid-parity/README.md` | 7, 67 | prose (2 lines, 1 file) |
| `scripts/liquid-parity/harness-lib.mjs` | 9 | **same pattern — runtime path construction** |
| `scripts/liquid-parity/run-parity-matrix.mjs` | 86, 90 | console output referencing the evidence path |

Two harness scripts **construct this path at runtime and write real evidence files under it**. Moving this directory mid-phase would require coordinated changes to money-certification and Liquid-parity harnesses well beyond "update one string" — deferred exactly as instructed. **Left at root.**

## The nine directories moved

All via `git mv <old> <new>`, one command per directory, verified individually.

| # | Old path | New path | `git mv` command | File count before→after |
|---|---|---|---|---|
| 1 | `CONVERGENCE_AUDIT_2026_06_10` | `docs/archive/audits/CONVERGENCE_AUDIT_2026_06_10` | `git mv CONVERGENCE_AUDIT_2026_06_10 docs/archive/audits/CONVERGENCE_AUDIT_2026_06_10` | 12 → 12 |
| 2 | `REPOSITORY_TRUTH_AUDIT_2026_06_10` | `docs/archive/audits/REPOSITORY_TRUTH_AUDIT_2026_06_10` | `git mv REPOSITORY_TRUTH_AUDIT_2026_06_10 docs/archive/audits/REPOSITORY_TRUTH_AUDIT_2026_06_10` | 13 → 13 |
| 3 | `FINAL_TRUTH_AUDIT_2026_06_11` | `docs/archive/audits/FINAL_TRUTH_AUDIT_2026_06_11` | `git mv FINAL_TRUTH_AUDIT_2026_06_11 docs/archive/audits/FINAL_TRUTH_AUDIT_2026_06_11` | 13 → 13 |
| 4 | `FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12` | `docs/archive/certifications/FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12` | `git mv FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12 docs/archive/certifications/FINAL_REPOSITORY_TRUTH_CERTIFICATION_2026_06_12` | 1 → 1 |
| 5 | `FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12` | `docs/archive/certifications/FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12` | `git mv FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12 docs/archive/certifications/FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12` | 1 → 1 |
| 6 | `FOUNDATION_CLOSURE_2026_06_12` | `docs/archive/certifications/FOUNDATION_CLOSURE_2026_06_12` | `git mv FOUNDATION_CLOSURE_2026_06_12 docs/archive/certifications/FOUNDATION_CLOSURE_2026_06_12` | 14 → 14 |
| 7 | `V1_SCOPE_LOCK_2026_06_12` | `docs/archive/certifications/V1_SCOPE_LOCK_2026_06_12` | `git mv V1_SCOPE_LOCK_2026_06_12 docs/archive/certifications/V1_SCOPE_LOCK_2026_06_12` | 83 → 83 |
| 8 | `CONVERGENCE_CLEANUP_2026_06_10` | `docs/archive/research/CONVERGENCE_CLEANUP_2026_06_10` | `git mv CONVERGENCE_CLEANUP_2026_06_10 docs/archive/research/CONVERGENCE_CLEANUP_2026_06_10` | 7 → 7 |
| 9 | `STRATEGIC_CANONICALIZATION_2026_06_10` | `docs/archive/research/STRATEGIC_CANONICALIZATION_2026_06_10` | `git mv STRATEGIC_CANONICALIZATION_2026_06_10 docs/archive/research/STRATEGIC_CANONICALIZATION_2026_06_10` | 15 → 15 |

**159 files total.** `docs/archive/{audits,certifications,research}/` did not previously exist — no destination collision. `git diff --cached --stat -M` after all nine moves: **"159 files changed, 0 insertions(+), 0 deletions(-)"** — every single moved file registered as a pure 100%-similarity rename, proving byte-identical content across all 159 files (stronger than a 3-file spot-check; shown here for the record on directory 1 as a representative sample):

```
rename {CONVERGENCE_AUDIT_2026_06_10 => docs/archive/audits/CONVERGENCE_AUDIT_2026_06_10}/000_CONVERGENCE_INDEX.md (100%)
rename {CONVERGENCE_AUDIT_2026_06_10 => docs/archive/audits/CONVERGENCE_AUDIT_2026_06_10}/ARCHITECTURAL_DRIFT_REPORT.md (100%)
rename {CONVERGENCE_AUDIT_2026_06_10 => docs/archive/audits/CONVERGENCE_AUDIT_2026_06_10}/DELETE_CANDIDATES.md (100%)
```

## A finding beyond the CTO's counted scope: `PROMPTS.md` and the prompt-perimeter validator

`scripts/validators/prompt-perimeter-validator.mjs` is not just a "1 reference" file for two of the moved directories — it **reads files at runtime by literal path** (`readFile(spentFoundationPrompt)`) and **cross-checks its own hardcoded path constants against rows in `PROMPTS.md`**, a root-level prompt registry file that was in neither the CTO's counted scope nor my own initial wide-scope grep (it lives at repo root, not under `scripts/`/`config/`/`.github/`). Reading the validator's full source revealed:

- It builds `canonicalPaths`/`registeredActivePaths` from every row in `PROMPTS.md` classified `CANONICAL-*`/`EXECUTED-*`, and asserts specific path strings are present in those sets.
- It classifies every tracked `.md` file whose basename matches `MISSION`/`PROMPT`/`BLUEPRINT`/`MASTERPLAN`/`DELETION`/`TERMINAL_*` as "prompt-class," and requires each one to be **either** registered active in `PROMPTS.md` (if outside `docs/archive/`) **or** carry/inherit the exact sentinel `ARCHIVED — REJECTED ARCHITECTURE — DO NOT EXECUTE` (if under `docs/archive/`).

Searching for prompt-class files inside the moved directories found 8, spread across 5 of the 9 moves: `CONVERGENCE_CLEANUP_2026_06_10` (1), `FINAL_TRUTH_AUDIT_2026_06_11` (1), `FOUNDATION_CLOSURE_2026_06_12` (2), `FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12` (1), `V1_SCOPE_LOCK_2026_06_12` (3) — **all 8 already registered in `PROMPTS.md` as `CANONICAL-*` or `EXECUTED-*`, at their old root-level paths, none of which were counted in either the CTO's "1 ref" tally or my own initial re-verification** (`PROMPTS.md` isn't under `scripts/`, `config/`, or `.github/`).

Checked before moving anything: `docs/archive/README.md:3` **already carries the exact sentinel text**, and `archiveHasSentinel()`'s walk-up logic checks every ancestor directory's `README.md` up to and including `docs/archive` itself — so any file moved to any depth under `docs/archive/` automatically inherits it. This made the moves themselves safe from the sentinel check. It did **not** make the `PROMPTS.md` rows automatically correct, since those are plain path strings the validator compares by exact match — updating them was necessary for the registry to keep describing the true location, and is a pure path-string change (same class as every other reference update in this phase), not a change to the validator's logic. Updated 7 rows (lines 7, 8, 11, 20, 21, 22, 23, 24 — 8 path occurrences across 7 rows) via a content-blind `sed` substitution on the path prefix only, leaving every ID, classification, and description column untouched.

## Every active reference updated — path:line, before and after

| File | Line(s) | Old | New |
|---|---|---|---|
| `scripts/validators/prompt-perimeter-validator.mjs` | 13 | `FINAL_TRUTH_AUDIT_2026_06_11/LETBUYY_FINAL_CONVERGENCE_CODEX_EXECUTION_PROMPT.md` | `docs/archive/audits/FINAL_TRUTH_AUDIT_2026_06_11/LETBUYY_FINAL_CONVERGENCE_CODEX_EXECUTION_PROMPT.md` |
| `scripts/validators/prompt-perimeter-validator.mjs` | 14 | `CONVERGENCE_CLEANUP_2026_06_10/CODEX_FOUNDATION_STEPUP_MASTER_EXECUTION_PROMPT.md` | `docs/archive/research/CONVERGENCE_CLEANUP_2026_06_10/CODEX_FOUNDATION_STEPUP_MASTER_EXECUTION_PROMPT.md` |
| `PROMPTS.md` | 7 | `CONVERGENCE_CLEANUP_2026_06_10/...` | `docs/archive/research/CONVERGENCE_CLEANUP_2026_06_10/...` |
| `PROMPTS.md` | 8 | `FINAL_TRUTH_AUDIT_2026_06_11/...` | `docs/archive/audits/FINAL_TRUTH_AUDIT_2026_06_11/...` |
| `PROMPTS.md` | 11 | `FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/...` | `docs/archive/certifications/FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/...` |
| `PROMPTS.md` | 20, 21 | `FOUNDATION_CLOSURE_2026_06_12/...` (×2) | `docs/archive/certifications/FOUNDATION_CLOSURE_2026_06_12/...` (×2) |
| `PROMPTS.md` | 22, 23, 24 | `V1_SCOPE_LOCK_2026_06_12/...` (×3) | `docs/archive/certifications/V1_SCOPE_LOCK_2026_06_12/...` (×3) |
| `.github/workflows/staging-deploy.yml` | 6 | `# ... governance-gated per FOUNDATION_CLOSURE_2026_06_12).` (YAML comment) | `# ... governance-gated per docs/archive/certifications/FOUNDATION_CLOSURE_2026_06_12).` |
| `AGENTS.md` | 11 | `` `STRATEGIC_CANONICALIZATION_2026_06_10/` `` | `` `docs/archive/research/STRATEGIC_CANONICALIZATION_2026_06_10/` `` |
| `AGENTS.md` | 37 | same | same, updated |
| `AGENTS.md` | 401 | same | same, updated |

**Beyond the counted scope, updated for accuracy (not required to keep the gate green, but left stale would actively mislead a reader):** `.agents/skills/letbuyy-cto-handoff/SKILL.md` lines 126, 128, 134, 142 — a Claude Code skill's "Known traps" section that names these exact paths as examples of dated, superseded documents. This is advisory reference prose for future sessions, not a runtime dependency and not a historical ledger entry — updating it serves its actual purpose (pointing a future reader at where the file really is) with zero risk (pure prose, no code path).

**Deliberately left unchanged — historical record, not active reference:** `EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, `CAPABILITY_BACKLOG.md`, `EXECUTABLE_HUMAN_REQUIRED.md`. `EXECUTION_LEDGER.md` in particular is a commit-by-commit audit trail — every row cites an exact commit hash (e.g. `7a0342e0`, `960e3e0b`, `cd4ad72b`) and describes what a **specific past commit did**, using the paths **as they existed at that historical moment**. Rewriting those paths would misrepresent history, exactly the same category of thing the brief explicitly allows to remain untouched under `docs/archive/`. Every other `docs/` subtree hit found in the wide-scope grep (`docs/research/2026-08-16-*`, `docs/launch/web-v1-wave-0-2026-08-09/`, `docs/merchant-system-discovery/2026-08-04T*`, `docs/theme-system-current-state/`, `docs/lcis-*`, `docs/v1-execution/`, `docs/storefront-theme-platform/`, `docs/launch-readiness/`, `docs/design-intelligence/`) is the same category: dated snapshots citing these directories as they were at the time each snapshot was written.

## Full-tree sweep after every edit — no active reference to a now-nonexistent root path remains

Re-ran `grep -rl` for each of the 9 moved directory names across the entire tree (excluding `.git`, `node_modules`) and filtered out everything under `docs/archive/`. Every remaining hit was individually classified:

- **The moved directories' own files, at their new `docs/archive/...` locations** — expected (a file legitimately contains its own directory name).
- **`PROMPTS.md`, the two validator constants, `.github/workflows/staging-deploy.yml`, `AGENTS.md`, `.agents/skills/.../SKILL.md`** — all now show the **updated** `docs/archive/...`-prefixed path, confirmed by direct read, not stale.
- **`EXECUTION_LEDGER.md`, `SKIPPED_HUMAN_DECISIONS.md`, `CAPABILITY_BACKLOG.md`, `EXECUTABLE_HUMAN_REQUIRED.md`** — historical record, left as-is, reasoning above.
- **Every other hit** — dated documentation elsewhere under `docs/` or already under `docs/archive/` (prompt-drift, root-governance, codex-prompts, etc.), citing these paths as historical fact.

**Zero hits found anywhere outside `docs/archive/` and the historical-ledger class of files above that point at a root-level path with no active code/config dependency on it.**

## `node scripts/validate-governance.mjs --plan` — verbatim

```
==============================================================================
LetBuyy governance gate — lane=gate
repository root       : /Users/saai_siddharth/Projects/Start_Up/LetBuyy
validator directory   : scripts/validators
discovered on disk    : 115 .mjs modules
  executable validators: 112
  library modules      : 2 (governance-common.mjs, phase-b-common.mjs)
  hook-only modules    : 1 (frozen-path-override-gate.mjs)
declared in lanes     : 112 (gate 111, report 1)
selected for this run : 111
per-validator timeout : 240000ms
==============================================================================

--plan: NO VALIDATORS EXECUTED. This is an inventory listing, not a gate result.
```

**115 discovered / 112 executable / 111 selected, exit code 0 — matches the known-good output exactly.** The destructive default `--lane=gate` was never run.

## Acceptance criteria — verified

1. Tracked count in System C: **7234, unchanged** (`git mv` moved, did not add/remove). 2. Systems A and B: HEAD, tracked, changed, untracked all **identical** to the phase's own starting baseline (1523/260/1 and 1719/157/242) — neither repository was entered. 3. `GOVERNANCE_REWRITE_2026_06_10` and `LAUNCH_READINESS_2026_06_12` **still at repository root**, confirmed by directory listing. 4. `--plan` returns **115/112/111, exit 0**. 5. Full-tree sweep found no active reference to a nonexistent root path (above). 6. All 9 directories' file counts match before/after (12/13/13/1/1/14/83/7/15), and `git diff --cached --stat -M` shows **159 files changed, 0 insertions, 0 deletions** across all of them — every file byte-identical. 7. No file deleted; no commit (`HEAD` still `073676fc0203acbdc77a55f17bd609afd0d72390`). 8. This document.

## What I did not verify

I did not run the destructive `--lane=gate` (explicitly prohibited). I did not open every file inside the 9 moved directories individually — I relied on `git diff --cached --stat -M`'s zero-insertion/zero-deletion proof across all 159 files rather than a manual per-file diff, which I judge to be stronger evidence, not weaker. I did not attempt to determine whether `docs/archive/root-governance-2026-06-10/directories/FORENSIC_MASTER_2026_06_10/` (cited alongside `STRATEGIC_CANONICALIZATION_2026_06_10` in `AGENTS.md`) is itself accurately pathed — it was already under `docs/archive/` before this phase and outside this phase's scope.
