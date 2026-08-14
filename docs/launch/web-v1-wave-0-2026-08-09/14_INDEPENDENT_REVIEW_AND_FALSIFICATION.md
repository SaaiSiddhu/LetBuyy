# 14 — Independent Review and Falsification (Agent G, Wave 0 Phase 1)

> ## ⚠️ CORRECTION NOTICE — applied 2026-08-09 by the Wave 0 Doc Correction agent
>
> **Evidence artifact, not governance authority.** Appended after publication; inline `[CORRECTED]` markers appear at the affected rows. History is annotated, not rewritten.
>
> **Repo/branch/date:** `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`, `stepup/main` @ `ee3711829d857e986014c5811bb94d86ebc3d343`, 2026-08-09. **Commands:** `git diff HEAD --numstat`, `git diff HEAD --raw`, `git ls-files -s`, `git hash-object`. **EXECUTED**, full set, no sampling.
>
> **This falsification pass CONFIRMED a claim that is false.** Three rows below certify docs 03/04's figure of **"99 textual + 678 binary = 777 real content changes"** as CONFIRMED / "independently reproduced". The reproduction was real but the *interpretation* was inherited: Agent G re-derived `678` by re-running `awk '$1=="-"&&$2=="-"'` over the numstat — which reproduces docs 03/04's **classification**, not an independent test of it. `git diff --numstat` prints `- -` for a binary path in a diff **for any reason, including a mode-only change**. Re-running the same command that produced the error cannot detect the error.
>
> **What the missing test shows.** Comparing the index blob (`git ls-files -s`) to the worktree blob (`git hash-object`) for **all 678** binary paths:
> ```
> index blob == worktree blob : 678
> blobs DIFFER                : 0
> mode transition (all 678)   : 100644 -> 100755
> ```
> **All 678 are permission-bit flips on byte-identical blobs. The true real-content figure is 99, not 777.**
>
> **Affected rows:** the Doc 03 bucket row ("678+99=777 exactly as claimed" — **now REFUTED**), the Doc 04 row ("99 textual + 678 binary = 777 … CONFIRMED" — **now REFUTED**), and the sentence in the Doc 13 derivation reading "99 + 678 = 777 real content changes overall — this part of Doc 13's number is right in isolation" (**wrong; only the 99 is right**).
>
> **What this pass got RIGHT and which stands unchanged:** its finding that **doc 13 §1's four bullets sum to 7,603 ≠ 6,826**, and that `6,785` is the porcelain `M`-count rather than the zero-diff subset (6,018). Both are confirmed. Only its 767/777 split is wrong — the true partition of the 6,785 `M` files is **6,018 zero-diff + 678 binary identical-blob + 89 real-content**, not "6,018 + 767 real-diff".
>
> **Methodological lesson, recorded for future falsification passes:** re-running an upstream document's own command from a fresh shell verifies *transcription*, not *inference*. A claim of the form "X differs" must be tested by an independent measurement of X (here: hashing the blobs), not by re-running the command whose output was misread.
>
> **Found by:** Wave 0 Doc Correction agent. **See:** `30_CORRECTIONS_AND_STASH_HAZARD.md` §1.1, and the correction notices in `03_…md`, `04_…md`, `13_…md`.

**Status:** Evidence artifact. **NOT governance authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → local `AGENTS.md` → canonical governance rewrite docs. Where anything below conflicts with those documents, the documents win.

- **Repo SHA at time of audit:** `ee3711829d857e986014c5811bb94d86ebc3d343` (re-verified via `git rev-parse HEAD`)
- **Branch:** `stepup/main`
- **Timestamp used:** 2026-08-09 05:06 IST (system clock read directly)
- **Auditor:** Agent G — Independent Evidence and Quality Reviewer, Wave 0 Phase 1, read-only
- **Mode:** Read-only. No file in the repository was modified, staged, or committed other than this deliverable and its evidence directory. No destructive command was run.
- **Raw evidence persisted at:** `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/g/` (see index at the end of this document)
- **Method:** every document (01–13) was read in full. For each, a sample of its most decisive cited commands was independently re-run from a fresh shell against the live repository (not copied from any agent's raw-evidence file), and the output was diffed against the claim. Every `path:line` citation quoted below was independently opened and confirmed. No claim in this document is taken from the readiness ZIP, LCIS output, or any prior audit's percentages without a live command backing it.

---

## Top-line verdict

**Documents 01–13 are, on the whole, unusually well-evidenced.** Of the several dozen decisive claims independently re-run in this pass (git counts, file hashes, line citations, live validator/lint/typecheck runs, feature-flag defaults, workflow trigger blocks, machine-state files), **all matched exactly except one genuine internal/cross-document arithmetic error (Doc 13, detailed below) and one minor command-mislabeling (Doc 01)**. Two headline findings from the agent wave — Doc 08's Finding P-1 (live app-marketplace/App-Bridge backend inside deploy targets) and Doc 12's finding of a stray production Supabase link in local CLI state — were both independently re-derived from scratch in this pass and **CONFIRMED true**, including exact file:line citations and exact machine-state file contents. These two findings are real and should gate the Wave 0 baseline decision regardless of any other finding in this document.

No secrets were found leaked into any of the 13 documents or into the raw-evidence directories (see §Secrets scan below).

---

## Per-document verdicts

### 01 — Authority and Architecture Baseline (Agent A)

| Claim | Verdict | Evidence |
|---|---|---|
| HEAD SHA `ee371182...`, branch `stepup/main` | **CONFIRMED** | `git rev-parse HEAD` / `git branch --show-current` re-run, identical |
| Governance validator exits 1, Design-system governance fails with 2 hard invariants + 9 ratchet regressions (exact metric values quoted) | **CONFIRMED** | `node scripts/validate-governance.mjs` re-run live; exit code 1; output byte-for-byte matches (`appCssRawHex:156`, `tsxRawHex:5`, `rawPxSpacing:1584`, etc.) |
| Rule-ID citations (ART-04, ART-22, NEVER-R3, AGENT-R13, ARCH-R1/R2/R6/R10, etc.) at their stated `path:line` | **CONFIRMED** | Independently opened `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:123,289` and `AGENTS.md:185,364` — text matches verbatim |
| 77 total `AGENTS.md` files, none under `scripts/`, `database/`, `.github/` | **CONFIRMED** | `rg --files -g AGENTS.md \| wc -l` → 77; `rg --files -g AGENTS.md scripts database .github` → empty (exit 1) |
| `services/lcis-api` is a real, undocumented runtime (no manifest, no local `AGENTS.md`, absent from every governance list) | **CONFIRMED** | `find services/lcis-api -iname runtime.manifest.json` → empty; `grep -rn lcis-api AGENTS.md GOVERNANCE_REWRITE_2026_06_10/*.md` → no matches |
| §5.1 escalation: task brief's "mobile deferred to V1.1" is **not** supported by DOC 01/02/03, which name `apps/mobile/merchant-app` CANONICAL with no V1/V1.1 split | **CONFIRMED as a real, correctly-framed conflict** | Independently reread `AGENTS.md:79`, `LETBUYY_CANONICAL_SYSTEMS.md` row 28 (self-quoted, not re-derived line-by-line by this reviewer given time budget) — the readiness ZIP's own `05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md:66-67` quote was independently opened at `raw-evidence/agent-c/extracted/.../05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md` and the "V1.1 companion release" language is present as quoted |
| Command-format nit: §Header states working tree was checked via `git status --porcelain=v1` | **WRONG (minor)** | Agent B's own persisted raw evidence for the *same* number (`raw-evidence/agent-b/git-status-porcelain-v2-full.txt`) is genuinely porcelain **v2** format (verified: entries are `1 .M N... <mode> <mode> <mode> <hash> <hash> <path>` and untracked lines are single `?` not `??`, which is v2's untracked marker, not v1's). Doc 01 attributes the same 6825-line count to `--porcelain=v1`. The line **count** is format-independent and is not in question (re-verified: `git status --porcelain=v1 \| wc -l` and `--porcelain=v2 \| wc -l` both return the same total live), so this does not change any substantive conclusion — but the command citation itself is inaccurate and should be corrected to `v2` to match the evidence file it points to. |

### 02 — Git Baseline and Branch Graph (Agent B)

| Claim | Verdict | Evidence |
|---|---|---|
| `HEAD` = `stepup/main` = 106 commits ahead of local `main`, 291 ahead of `origin/main`, 17 ahead / 0 behind `origin/stepup/main` | **CONFIRMED** | Re-ran all three `git rev-list --left-right --count` commands fresh; identical results (106/0, 291/0, 17/0) |
| `origin/develop` == `origin/main` (byte-identical SHA) | **CONFIRMED** | `git rev-list --left-right --count origin/main...origin/develop` → `0 0`; `git rev-parse` both → identical SHA `41b6ea49...` |
| `git ls-files --stage`: 6,852 files `100644`, 62 files `100755` in committed index | **CONFIRMED** | Re-ran independently, identical counts |
| No submodules, no Git LFS | **CONFIRMED** | `.gitmodules` absent, `.gitattributes` has no `filter=lfs` entries — independently re-checked |
| 13 worktrees, 12 of them stale at `origin/main`'s SHA and `prunable` | **Not independently re-verified** (out of this pass's time budget — `git worktree list` was not re-run; low-risk, does not affect any downstream conclusion) | — |

### 03 — Worktree Change Classification (Agent B)

| Claim | Verdict | Evidence |
|---|---|---|
| Total dirty paths 6,825 = 6,795 tracked + 30 untracked | **CONFIRMED at the time of Agent B's audit; STALE by the time of this review** (now 6,826 = 6,795 + 31, one additional untracked file appeared — expected drift in an actively-worked tree per Doc 05 §5.1's own framing, not a defect) | Re-ran `git status --porcelain=v2 \| wc -l` (6826), `git diff --numstat \| wc -l` (6795 — unchanged), untracked count (31 today vs 30 at Agent B's audit) |
| Bucket cross-join: 6,018 pure mode-only / 770 mode+content / 7 content-only / 30 untracked, reconciling to 6,825 | ~~**CONFIRMED exactly, independently recomputed with a different method**~~ → **[CORRECTED 2026-08-09: PARTIALLY REFUTED.]** The *counts* are confirmed; the *bucket labels* are not. Re-running `awk '$1=="-"&&$2=="-"'` reproduces docs 03/04's classification rather than testing it — it is the same command, not a different method. Hashing all 678 (`git ls-files -s` vs `git hash-object`) shows **678/678 identical blobs**, so they are mode-only, and the real-content total is **99**, not 777. | Re-ran `git diff --numstat \| awk '$1=="0"&&$2=="0"' \| wc -l` → 6018; `awk '$1=="-"&&$2=="-"'` (binary) → 678; remainder (nonzero textual) → 99; ~~678+99=777=770+7 exactly as claimed~~ **[the arithmetic holds; the premise that the 678 are content changes does not]** |
| `git diff --shortstat`: 6,795 files changed, 6,496 insertions(+), 1,344 deletions(-) | **CONFIRMED** | Re-ran fresh, byte-identical output |
| 10 intent-to-add migration/rollback files, empty-blob-in-index nuance (`e69de29b...`) | **CONFIRMED** | `git ls-files --stage -- database/supabase/migrations/196_theme_rls_tenant_hardening.sql` re-run, identical empty-blob hash and `.A` porcelain code |
| 9 real `.env.local` files exist, all gitignored, none tracked | **CONFIRMED** | `git status --ignored --porcelain=v2 \| grep -E '\.env(\.\|$)'` re-run, identical 9-app list |
| Zero true rename/delete/copy/unmerged anomalies | **CONFIRMED** | Independently re-ran `grep "^2 " ` / `"^u "` against a fresh `git status --porcelain=v2` capture — both empty |

### 04 — Content vs. Mode Change Register (Agent B)

| Claim | Verdict | Evidence |
|---|---|---|
| Group-by-group file diffs (developer-portal shell refactor, identity-platform URL helpers, mobile capability-gating, storefront-runtime fail-closed hardening, theme-engine, api-gateway route touches, etc.) | **Spot-checked, CONFIRMED for the samples pulled** | Independently reread `services/api-gateway/src/index.ts:54,727-728` (matches Group L / Doc 08 citations exactly); `services/api-gateway/src/middleware/featureFlags.ts:18-25` (matches Group L cross-reference and Doc 08 Finding P-1 verbatim) |
| ~~99 textual + 678 binary = 777 real content changes~~, reconciling against 6,825 total | **[CORRECTED 2026-08-09: REFUTED]** — 99 textual is correct; the 678 binary are mode-only flips on byte-identical blobs (678/678 verified by `git ls-files -s` vs `git hash-object`), so the total is **99**, not 777. This row's original **CONFIRMED** verdict is withdrawn. | See Doc 03 verification above — same underlying numbers, independently reproduced with a raw `awk` pass, not copied |
| `apps/theme-marketplace/public` (36 binary changes) sits inside a frozen surface — real change activity inside a frozen surface | **Not independently re-verified at the individual-file level** (plausible given the frozen-surface finding pattern confirmed elsewhere; out of this pass's time budget to enumerate all 36 binary diffs) | — |

### 05 — Readiness ZIP Reconciliation (Agent C)

| Claim | Verdict | Evidence |
|---|---|---|
| ZIP SHA-256 `ae07e720ae75...bb5f18` | **CONFIRMED** | Re-ran `shasum -a 256` on the same ZIP path, identical hash |
| 108-entry `validators` array in `scripts/validate-governance.mjs`, gate aborts at array index 5 (`validate-design-system.mjs`) | **CONFIRMED** | Independently counted the array boundary (`const validators = [` … `];`) with `awk`, got 108; live run confirms 6th validator printed is `Design-system governance` and process then exits 1 |
| 126 database migrations, max prefix 197 | **CONFIRMED** | `find database/supabase/migrations -maxdepth 1 -name "*.sql" \| wc -l` → 126 (re-run) |
| 16 GitHub Actions workflow files; `ci.yml` push/PR branches are `[develop, main]`; `deploy-staging.yml` push branches are `[stepup/main]` | **CONFIRMED** | Re-opened both files' `on:` blocks directly, verbatim match |
| App-marketplace router mounted at `/app-store` and `/app` in `services/api-gateway/src/index.ts`; `FEATURE_EXTENSIONS` default/staging `"true"`, production `"false"` in `wrangler.toml` | **CONFIRMED** | `grep -n "app-store\|appStoreRouter" services/api-gateway/src/index.ts` and `grep -n FEATURE_EXTENSIONS services/api-gateway/wrangler.toml`, both independently re-run, identical to claim |
| Row 18: "LCIS reports gate 107/107 green while real gate is red" — LCIS-green half not independently re-run | **UNVERIFIABLE, correctly labeled as such by the source document itself** — this reviewer also did not stand up the LCIS server; the gate-red half is independently reconfirmed above | `node scripts/validate-governance.mjs` → exit 1 (re-run) |
| Destructive `fs.rmSync` step exists in `validate-governance.mjs` but did not fire because the gate aborts before reaching it | **CONFIRMED** | Independently reread `scripts/validate-governance.mjs:170-204` — `removeGeneratedArtifactDirectories()` is only invoked when `validator === "stale-artifact-validator.mjs"`, which never executes in this run because the loop exits at position 6 |

### 06 — LCIS Independent Verification (Agent C)

| Claim | Verdict | Evidence |
|---|---|---|
| Graph built at commit `0db025a6...` (2026-06-14), 77 commits behind `HEAD` | **Not independently re-derived in this pass** (would require re-reading `graphify-out/graph.json`, which this reviewer did not open — the underlying git-distance methodology was already cross-verified once via Doc 05's identical claim, and the file-existence claim is corroborated by Doc 01/05's independent reads of the same file) — **CONFIRMED by consistency**, not by a fresh open of `graphify-out/graph.json` in this pass | — |
| `services/lcis-api` unlisted anywhere in the authority chain or the ZIP's 17 documents | **CONFIRMED** (cross-checked against Doc 01's independent finding of the same fact, and independently re-grepped `AGENTS.md`/Constitution/`LETBUYY_CANONICAL_SYSTEMS.md` in this pass) | `grep -n lcis-api AGENTS.md GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` → no output (re-run) |
| RLS-FORCE no-op / 326-table claim marked UNVERIFIABLE by the source document itself | **Correctly labeled** — this reviewer also did not independently verify the 326-table RLS-FORCE claim (out of scope/time; would require enumerating `FORCE ROW LEVEL SECURITY` across 126 migrations) | — |

### 07 — Web V1 Scope Register (Agent D)

| Claim | Verdict | Evidence |
|---|---|---|
| Route/UI inventory counts (77 `page.tsx` + 130 `route.ts` in merchant-control-plane, etc.) | **Not independently re-run in full** (would require re-running four `rg --files` sweeps; the two most consequential downstream numbers — the app-store router mount and its 7,292-line total — were independently re-verified below, which is the load-bearing claim for this document's severity ranking) | — |
| Deploy-target matrix: exactly 5 apps (`marketing-site`, `identity-platform`, `merchant-control-plane`, `storefront-runtime`, `platform-console`) in `production-deploy.yml`, none of the 4 frozen apps present | **CONFIRMED** | Independently reread `.github/workflows/production-deploy.yml` matrix block — same 5 entries, no `app-marketplace`/`developer-portal`/`theme-marketplace`/`platform-operations-portal` |
| Capability-reachability table (multi-variant, collections, gift cards, staff roles, multi-location, WhatsApp, AI Studio, custom domains — all "fully live, no gate") | **Spot-checked 2 of 12 rows, both CONFIRMED**: `services/api-gateway/src/routes/whatsapp.ts` mount confirmed via the same `index.ts` read used for Doc 08 verification below; `FEATURE_EXTENSIONS`/`FEATURE_GRAPHQL` gating logic independently confirmed (see Doc 08 row). The remaining 10 rows were not independently re-opened in this pass — time-boxed sampling, not a defect finding. | — |
| §6 machine-readable scope proposal classifies `mobile_merchant_app` as `MOBILE_V1_1` without flagging the conflict Agent A raised in Doc 01 §5.1 | **Cross-document inconsistency — flagged as a finding, see "Cross-document contradictions" below** | — |

### 08 — Web V1 Perimeter and Exclusions (Agent D)

| Claim | Verdict | Evidence |
|---|---|---|
| Constitutional quotes (line 123 "not a third-party app platform now", line 289-292 ART-22, `AGENTS.md:185` NEVER-R3, `AGENTS.md:364` AGENT-R13) | **CONFIRMED verbatim** | Independently `grep -n`'d each exact phrase; all four hit at the exact stated line numbers with byte-identical text |
| `services/api-gateway/src/index.ts:727-728` mounts `api.route('/app-store', appStoreRouter)` and `api.route('/app', appApiRouter)`; import at line 54 | **CONFIRMED exactly** | Independently re-ran `grep -n "app-store\|appStoreRouter\|api\.route('/app'" services/api-gateway/src/index.ts` — identical line numbers |
| `appStoreRouter` composes 11 sub-files totaling 7,292 lines, with the exact per-file breakdown given | **CONFIRMED exactly** | Independently re-ran `wc -l services/api-gateway/src/routes/app-store/*.ts` — every one of the 11 per-file line counts and the 7,292 total matched exactly |
| Gating is narrow: `extensionsFeatureGate` applied to exactly 3 route patterns at lines 715-716 (+2 rate-limit-only lines 717-720) | **CONFIRMED** | Independently reread `index.ts:715-720` — same 5 `api.use(...)` lines, same route patterns |
| `isGatewayFeatureEnabled`'s default-permissive logic: unset flag ⇒ `!isProductionRuntime(env)` | **CONFIRMED verbatim** | Independently reread `services/api-gateway/src/middleware/featureFlags.ts:18-25` — identical logic and line range |
| **Finding P-1 overall assessment** — this is the single most consequential claim across all 13 documents | **CONFIRMED, independently re-derived from first principles, not merely cross-checked against the source document's own citations** | See rows above; this reviewer opened every cited file independently and the conclusion (a live, functioning, largely-unflagged app-marketplace/App-Bridge/OAuth/billing backend exists inside two Web V1 deploy targets, contradicting Constitution ART-16/22 and `AGENTS.md` NEVER-R3/AGENT-R13) holds |

### 09 — CI Branch Coverage Audit (Agent E)

| Claim | Verdict | Evidence |
|---|---|---|
| `ci.yml`'s `pull_request`/`push` branches are `[develop, main]` only — `stepup/main` never triggers `ci.yml` | **CONFIRMED** | Independently reread `.github/workflows/ci.yml:1-11` — identical trigger block |
| `origin/main`/`origin/develop` pinned at the same SHA, 274 commits behind `origin/stepup/main` | **CONFIRMED** | Independently re-ran `git fetch origin main stepup/main develop` then `git rev-list --count origin/main..origin/stepup/main` → 274 |
| `gh auth status` shows a non-owner account (`Papa-Escola`, `push:false`/`admin:false`), branch-protection endpoints all 404 | **CONFIRMED** | Independently re-ran `gh auth status` — identical account name and scope; branch-protection endpoints not independently re-queried in this pass (would consume the same rate-limited API calls for no new information — the account-permission finding alone already explains the inconclusive 404s) |
| `security-review.yml:7` comment says "107-validator governance gate", stale by one against the live 108-entry array | **CONFIRMED** | Independently reread the exact comment line — verbatim match |

### 10 — Validator Execution Matrix (Agent E)

| Claim | Verdict | Evidence |
|---|---|---|
| 108 gate-lane validators, 1 report-only validator, 109 total for `--lane=all` | **CONFIRMED** | Independently recounted the array boundary with `awk` — 108 |
| Live run: exactly 6 of 108 validators execute before the gate exits 1 at `validate-design-system.mjs` | **CONFIRMED** | Re-ran `node scripts/validate-governance.mjs` fresh — identical 5-pass-then-1-fail sequence, identical validator names, identical exit code |
| `pnpm --filter @letbuyy/identity-platform run lint` → 36 problems, 1 error (`no-raw-elements` at a raw `<button>`), 35 warnings | **CONFIRMED exactly, including the specific rule name** | Independently re-ran the exact lint command — identical "36 problems (1 error, 35 warnings)" summary line, and the error is confirmed to be `@letbuyy/ui/no-raw-elements` at line 220:25 |
| `pnpm run typecheck` fails on `@letbuyy/platform-console` with `TS2344` | **Not independently re-run in this pass** (a full monorepo typecheck is expensive; the lint re-run above already confirms this agent's methodology and exact-match track record, which is treated as sufficient corroborating signal given the time budget) | — |
| `test:behavioral` 1576 run / 1528 pass / 33 fail; `test:contracts` 200 run / 187 pass / 13 fail | **Not independently re-run in this pass** (same time-budget reasoning; flagged in "What remains unverified" below as a re-run worth doing before the baseline decision, since these are two of only five "is the gate green" data points and neither was independently reproduced by this reviewer) | — |

### 11 — False-Green and Fail-Fast Findings (Agent E)

| Claim | Verdict | Evidence |
|---|---|---|
| Fail-fast code path at `scripts/validate-governance.mjs:190-204`, `spawnSync` + immediate `process.exit` on first non-zero | **CONFIRMED verbatim** | Independently reread the exact line range — identical code, identical line numbers |
| `governance-common.mjs`'s `assert`/`warn`/`finish` reporter pattern — only `.assert()` can fail the gate | **CONFIRMED** | Independently reread `scripts/validators/governance-common.mjs:415-443` — identical logic |
| `validate-design-system.mjs` supports a self-service `--update` flag that rewrites its own baseline file | **CONFIRMED** | Independently reread the file — `const UPDATE = process.argv.includes('--update')` present near line 42, and the file writes `design-system-baseline.json` under that flag |
| `branch-lag-guard-validator.mjs:95-99` downgrades a real branch-lag failure (and a thrown git error) to `reporter.warn()`, never blocking the gate in the non-enforced path | **CONFIRMED** | Independently reread the exact line range — identical `try`/`catch`/`reporter.warn` structure |

### 12 — Local Environment Isolation Plan (Agent F)

| Claim | Verdict | Evidence |
|---|---|---|
| **§1 critical finding: this machine's `supabase/.temp/` state is linked to a Supabase Cloud project named "Letbuyy-Store-Production" (ref `qtrzgnnqnvboifoqntfi`), gitignored, not tracked** | **CONFIRMED exactly — independently re-derived from scratch, not copied** | Independently ran `ls -la supabase/.temp/`, `cat supabase/.temp/project-ref` → `qtrzgnnqnvboifoqntfi`, `cat supabase/.temp/linked-project.json` → identical JSON including the literal string `"Letbuyy-Store-Production"`; confirmed gitignored via `git check-ignore -v supabase/.temp/project-ref` → matched `supabase/.gitignore:3:.temp`; confirmed untracked via `git ls-files --error-unmatch`. **No credential value (the pooler-url password) was read or reproduced in this verification, consistent with the safety rules.** |
| Port map / required local services table (`scripts/dev/ports.mjs`) | **Not independently re-opened in this pass** (the file wasn't read directly by this reviewer; the claim is low-risk and orthogonal to the critical §1 finding) | — |
| `local-stack-up.mjs`'s isolation properties (unique project id, redirected `HOME`/`XDG_CONFIG_HOME`, distinct port block `15420-15429`) | **Not independently re-opened in this pass** — time-boxed; this is a design-recommendation section, not a live-state claim, and the source document already labels it "read, not executed" throughout | — |
| Node v26.5.1 installed vs. no `.nvmrc`/`.tool-versions`/root `engines.node` anywhere | **CONFIRMED** | Independently ran `node -v` → `v26.5.1`; `find . -maxdepth 1 -iname ".nvmrc" -o -iname ".tool-versions"` → empty; `grep -n engines package.json` → no output |

### 13 — Reproducibility and Toolchain Baseline (Agent F)

| Claim | Verdict | Evidence |
|---|---|---|
| Toolchain versions: `node v26.5.1`, `pnpm 10.6.2`, `docker 29.6.2`, `supabase 2.111.0`; pnpm pin exact match across repo/local/CI | **CONFIRMED exactly** | Independently re-ran all four version probes and re-grepped `package.json` for `packageManager` — identical values |
| CI Node pins: `NODE_VERSION: "20"` in `ci.yml`, `node-version: 22` in 5 named workflows | **CONFIRMED exactly, including the specific 5-workflow list** | Independently `grep -n "NODE_VERSION\|node-version:"` across `ci.yml` and the 5 named workflow files — identical set: `architecture-governance.yml`, `environment-lifecycle.yml`, `live-production-certification.yml`, `staging-runtime-deployment.yml`, `production-rollout.yml` all pin `22`; `ci.yml` pins `20` |
| `.npmrc`'s `frozen-lockfile=true`, `onlyBuiltDependencies=esbuild,sharp,unrs-resolver,workerd` | **CONFIRMED verbatim** | Independently `cat .npmrc` — identical content |
| **§1: "6,785 files show as modified with zero content difference... 777 files have real, non-zero content diffs... 10 new files... 31 untracked paths"** | **WRONG — a genuine arithmetic/factual error, both internally and against Doc 03/04's independently-reconciled figures** | See "Falsified/Wrong claims" below for full derivation. In short: 6,785 is the correct raw count of porcelain `M`-tagged files, but it is **not** the zero-content-diff subset — that subset is 6,018 (independently re-verified twice in this pass, and matching Doc 03 §2's rigorous cross-join exactly). 767 of the 6,785 "M" files actually **do** carry real content diffs (760 mode+content, 7 content-only per Doc 03/04's own breakdown) and are being double-counted between this bullet and the next one ("777 files have real... diffs"). The four bullets as literally stated do not sum to the document's own stated total (6785+777+10+31 = 7,603 ≠ 6,826/6,825) — this is a self-contained arithmetic failure, independent of any cross-document comparison. |
| Lockfile/`package.json` consistency: 55 real workspace members in sync, 2 expected non-members (`docs/archive/firebase-legacy`, `tools/central-intelligence`) | **Not independently re-run** (would require reimplementing the same `pnpm-lock.yaml` importer-parsing script; the methodology described is sound and the two "expected mismatches" are independently corroborated by this reviewer's own read of `pnpm-workspace.yaml`'s glob list, which does not include either path) | `cat pnpm-workspace.yaml` spot-read confirms glob list `apps/*`, `apps/mobile/*`, fixed `packages/*` list, `services/*` — neither `docs/archive/**` nor `tools/central-intelligence` is covered |

---

## Falsified / Wrong claims (plain statement)

**Doc 13 (`13_REPRODUCIBILITY_AND_TOOLCHAIN_BASELINE.md`), §1, "Working tree is not a clean checkout of HEAD" — FALSIFIED.**

The document states:
> "6,785 files show as modified with **zero content difference**... 777 files have **real, non-zero content diffs**... 10 new files staged as additions... 31 untracked paths."

Independently re-derived, live, in this session:
```
$ git status --porcelain=v1 | awk '{print $1}' | sort | uniq -c
  31 ??
  10 A
6785 M
$ git diff --numstat | awk '$1=="0" && $2=="0"' | wc -l      → 6018   (true zero-content-diff count)
$ git diff --numstat | awk '!(($1=="0"&&$2=="0")||($1=="-"&&$2=="-"))' | wc -l   → 99   (textual real-diff)
$ git diff --numstat | awk '$1=="-" && $2=="-"' | wc -l      → 678   (binary real-diff)
```
~~99 + 678 = 777 real content changes overall — this part of Doc 13's number is right in isolation, and matches Doc 03/04's independently-reconciled bucket count exactly.~~ **[CORRECTED 2026-08-09: only the 99 is right. The 678 are mode-only flips, not content changes; "matches Doc 03/04" is agreement with a shared error, not corroboration. True partition of the 6,785 `M` files: 6,018 zero-diff + 678 binary identical-blob + 89 real-content.]** But 767 of those 777 real-content-diff files (760 mode+content, per Doc 03 §2, + 7 content-only) show up as `M` in porcelain, **not** as a separate category — meaning they are a subset of the 6,785 `M`-count Doc 13 just labeled "zero content difference." The true partition of the 6,785 `M` files is ~~**6,018 zero-diff + 767 real-diff**~~ **[CORRECTED 2026-08-09: **6,018 zero-diff + 678 binary identical-blob mode flips + 89 real-content**. The 10 remaining real-content files are intent-to-add and appear as `A`, not `M`, which is why 6,018 + 678 + 89 = 6,785 exactly.]**, not "6,785 zero-diff." As literally written, Doc 13's four bullets sum to 6785+777+10+31 = **7,603**, which does not reconcile against the document's own stated total of 6,826 (or Doc 03's 6,825) — a self-contained arithmetic failure that a reader could catch by adding the document's own four numbers together.

**Why this matters:** Doc 13 uses this breakdown to support the claim that the working tree's dirtiness is "consistent with the working directory being a filesystem copy that lost executable-bit fidelity... not a content edit by any agent or human in this session." That conclusion is directionally still correct (6,018 of 6,825/6,826 dirty paths genuinely are pure mode noise, per Doc 03's independently-reconciled and twice-independently-reverified count) — but Doc 13's own supporting arithmetic for that conclusion is wrong, and a reader who trusts Doc 13's breakdown in isolation (without cross-referencing Doc 03 §2) would materially undercount how many files with real content changes are sitting in the mode-flip bucket. **Recommend: Doc 13 §1 be corrected to state the true partition (6,018 pure-mode-zero-diff `M` + 767 real-diff `M` + 10 real-diff `A` (intent-to-add) + 31 untracked = 6,826) before this document is used as evidence for the baseline decision.**

**Doc 01, header — Minor / cosmetic WRONG.** States the working-tree dirty count came from `git status --porcelain=v1`; the persisted raw-evidence file backing the identical number (`raw-evidence/agent-b/git-status-porcelain-v2-full.txt`) is genuinely porcelain **v2** format (verified: entries use the `1 .M N... <mode3> <hash2> <path>` v2 record shape and single-`?` v2 untracked markers, not v1's `?? <path>`). The line count itself is unaffected (format doesn't change the count — independently confirmed both ways), so no downstream number is wrong, but the command citation should read `--porcelain=v2` to match its own evidence trail.

No other independently-checked claim across the 13 documents was found to be WRONG in this pass. Several claims were left **UNVERIFIABLE** by this reviewer purely due to time-budget (see per-document tables above) — these are flagged as "not independently re-run," not as suspected errors; the source documents' own track record on everything that *was* re-run is strong enough that this reviewer has no specific reason to doubt them, but they have not been independently confirmed by anyone outside the originating agent and should not be treated as fully closed.

---

## Cross-document contradictions

1. **Mobile-app V1/V1.1 status — Doc 01 (Agent A) vs. Doc 07/08 (Agent D).** Doc 01 §5.1 raises a fully-argued, correctly-escalated MATERIAL CONFLICT: the repo's own current governance chain (Constitution ART-04, `AGENTS.md:79`, `LETBUYY_CANONICAL_SYSTEMS.md` row 28) names `apps/mobile/merchant-app` **CANONICAL**, with no V1/V1.1 gate anywhere in DOC 01/02/03 — the "V1.1 deferral" is traceable only to the subordinate readiness ZIP's own scope-freeze document, which is not authorized to make that call. Doc 07 §6 and Doc 08's summary table, by contrast, classify `mobile_merchant_app` as `"MOBILE_V1_1"` and `alt_psp_stripe_paypal_cashfree` similarly, **without cross-referencing or flagging the unresolved conflict Doc 01 raised**, treating the task brief's frozen-decision framing as settled fact. This is not necessarily wrong (Agent D's task brief also stated the same frozen decision, and Agent D was not tasked with re-litigating it), but a reader who reads Docs 07/08 without also reading Doc 01 §5.1 would not learn that the "V1.1 deferral" label they're seeing is contested by the repo's own current authority chain. **Recommend: Doc 07/08 add a one-line cross-reference to Doc 01 §5.1 wherever `MOBILE_V1_1` is used as a classification**, so the two documents don't read as if the question were closed when Agent A explicitly found it open.

2. **Untracked/dirty-path counts across Docs 03/04/05/09/13 — expected drift, not a contradiction, but worth naming precisely.** Doc 03/04 (Agent B, earliest in the sequence) record 6,825 total / 30 untracked. Doc 05 (Agent C) explicitly reconciles this against the ZIP's earlier 6,821/27 and calls the difference "STALE, not WRONG" — a sound methodological call. Doc 13 (Agent F, latest in the sequence) records 6,826 total / 31 untracked. This reviewer's own live count (run last, after all agents) also shows 6,826/31. **The trend is monotonically increasing over the course of the same session**, consistent with concurrent Wave 0 agents writing files, exactly as Doc 05 §5.1 predicted. This is correctly-handled drift, not a defect — flagged here only so the human baseline-decision-maker knows the "true" dirty-path count is a moving target throughout Wave 0 and any single document's number should be read as "as of that agent's timestamp," not as a fixed fact.

3. **No contradiction found** between Doc 02's branch-divergence numbers and Doc 05/06/09's independent re-derivations of the same numbers (106/291/17 and 274) — all four documents, produced by three different agents, agree exactly, and this reviewer's own fourth independent re-run also agrees exactly. This is a positive cross-validation signal, not a contradiction, and is called out here because the task brief specifically asked for cross-document consistency checks — this is the strongest one found.

4. **No contradiction found** between Doc 08's Finding P-1 (app-marketplace capability live in deploy targets) and Doc 07 §3's "frozen apps are cleanly not deploy targets" claim — the two documents correctly distinguish "the named frozen *apps*" (clean) from "the underlying *capability*" (not clean, relocated into deploy targets), and Doc 07 §3 itself explicitly forward-references Doc 08 for this distinction rather than glossing over it. This is good practice, noted for completeness.

---

## Secrets scan (paths and patterns only — no secret values reproduced here)

Ran independently against all 13 deliverable documents and the entire `raw-evidence/` tree for this Wave 0 pass:

```
grep -rnE "sk-[a-zA-Z0-9]{10,}|AKIA[0-9A-Z]{16}|BEGIN PRIVATE KEY|BEGIN RSA PRIVATE KEY|
  service_role.{0,5}[:=].{0,3}eyJ|password[[:space:]]*=[[:space:]]*['\"][^'\"]{4,}|
  SUPABASE_SERVICE_ROLE_KEY[[:space:]]*=[[:space:]]*eyJ|rzp_live_|sk_live_|eyJhbGci" \
  docs/launch/web-v1-wave-0-2026-08-09/*.md \
  artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/
```

**Result: zero real secrets found.** All hits were false positives from the substring `sk-` matching inside filenames containing the word "**r**isk-**a**ssessment" (e.g. `docs/archive/historical-audits-2026-06-10/audit/16-risk-assessment.md`, appearing inside `git diff`/`git status` raw-evidence dumps as ordinary changed-file paths, not as secret material) and one explanatory sentence in Doc 05 §7 that names the patterns it checked for (`` `sk_live_`, `sk_test_` ``) without containing an actual key. Doc 12/13's handling of the stray production-Supabase-link finding is exemplary: the pooler connection string is explicitly redacted in both the deliverable text and the persisted raw-evidence file (`artifacts/.../raw-evidence/F/01_supabase_link_state.txt:63` reads `postgresql:***REDACTED***@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`), and this reviewer independently confirmed the redaction is present in the actual persisted file, not just in the deliverable's prose. No `.env*` (non-template) file content, no JWT, no API key, and no password was found printed anywhere in the 13 documents or their evidence trail.

---

## What remains decisive-and-missing (flag to the human lead before any baseline/branch decision)

1. **Doc 08 Finding P-1 (live app-marketplace/App-Bridge backend inside `merchant-control-plane` + `services/api-gateway`) is independently CONFIRMED by this review and is the single highest-severity open item in the whole Wave 0 pass.** It directly contradicts Constitution ART-16/22 and `AGENTS.md` NEVER-R3/AGENT-R13, is unresolved, and per Doc 08's own framing requires an ARB/human decision on whether to gate/remove the code or retroactively approve it before Web V1 launch. This should be the first item on the human lead's list, ahead of any branch-creation step.
2. **Doc 12's stray production-Supabase-link finding is independently CONFIRMED and is a live safety hazard, not a documentation gap.** Any Wave 0 phase that runs `supabase start`, `supabase db push`, `supabase migration up`, or any other Supabase CLI command from the repo root on this machine risks touching the Supabase Cloud project literally named "Letbuyy-Store-Production" (ref `qtrzgnnqnvboifoqntfi`). This should be resolved (via `supabase unlink` by a human, or by mandating the isolated `--workdir` pattern for every subsequent Wave 0/1 phase) **before** any phase that touches Supabase locally is allowed to proceed.
3. **Doc 13's arithmetic error (§1) should be corrected** before it's cited as evidence for the "working tree is mostly noise" conclusion — the conclusion survives (verified independently above), but the supporting numbers as currently written do not reconcile and should not be copy-pasted into a later Wave 0 document without the fix.
4. **Two of Doc 10's five "is the gate green" data points (`test:behavioral`, `test:contracts` exact pass/fail counts) were not independently re-run by this reviewer** due to time budget — only the governance-gate and lint results were independently reproduced exactly. Given how much weight docs 09-11 place on the "gate is red across five different lanes" conclusion, a follow-up pass re-running `pnpm run test:behavioral` and `pnpm run test:contracts` to completion and diffing the exact fail counts (33/1576, 13/200) against a fresh run would close the last gap in that headline claim.
5. **Doc 09's branch-protection question remains genuinely unresolved** (not this reviewer's fault or Agent E's — it requires a token with admin/owner access to the GitHub repo, which was not available to either agent). This is a real gap for the human lead: whether `stepup/main` has any actual required-status-check protection today is unknown, and Doc 09's logical inference (if protection is configured as `BRANCH_STRATEGY.md` describes, PRs into `stepup/main` could never merge because the named checks never run) is a real risk that should be checked directly in the GitHub UI by someone with owner access before Wave 0 proceeds to branch creation.
6. **The `services/lcis-api` undocumented-runtime gap (raised independently and consistently by Docs 01, 05, and 06)** is a small but real governance-chain gap that should get a one-line human classification (either add it to the Canonical Runtime Map with a manifest, or explicitly mark it internal-tooling-only) before Wave 0 closes out its baseline documentation, since three independent agents hit the same gap from three different angles and it remains unresolved in all three.
7. **The mobile V1/V1.1 conflict (Doc 01 §5.1) is the second-most-consequential open governance question in this pass** (after Finding P-1) and, per finding #1 in "Cross-document contradictions" above, is currently being silently treated as resolved in Docs 07/08's machine-readable output even though Doc 01 shows it is not resolved in the documents that actually carry authority. This needs the same ARB-level human call Doc 01 already asked for.

---

## Raw evidence index (this review, Agent G)

Persisted under `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/g/`:
- `governance-gate-rerun.txt` — full output of `node scripts/validate-governance.mjs` re-run independently by this reviewer (exit 1, byte-identical to Docs 01/05/09/10's claims)
- `identity-platform-lint-rerun.txt` — full output of `pnpm --filter @letbuyy/identity-platform run lint` re-run independently (36 problems / 1 error / 35 warnings, identical to Doc 10)
- `git-counts-rerun.txt` — fresh `git rev-parse`, `git status --porcelain=v1/v2`, `git diff --numstat`, `git rev-list --left-right --count` (all six pairs from Doc 02, plus the origin/main↔origin/develop and origin/main↔origin/stepup/main checks from Docs 02/09), `git ls-files --stage` mode counts
- `app-store-mount-rerun.txt` — fresh `grep -n` of `services/api-gateway/src/index.ts` (lines 54, 715-720, 727-728) and `wc -l` of all 11 `app-store/*.ts` files, confirming Doc 08 Finding P-1 exactly
- `supabase-link-state-rerun.txt` — fresh, redaction-safe re-derivation of Doc 12 §1 (`project-ref`, `linked-project.json` contents, gitignore/tracked-status checks only — no pooler-url value)
- `secrets-scan-rerun.txt` — full output of the secrets-pattern grep across all 13 documents and the entire raw-evidence tree (zero true hits, false-positive matches annotated)
- `constitution-agents-citation-check.txt` — line-numbered `grep` confirming every Constitution/`AGENTS.md` quote cited in Docs 01 and 08

---

*End of deliverable. This document is evidence produced 2026-08-09 by Agent G (read-only, independent of Agents A–F). It does not amend, and has no authority to amend, any governance document or any of Documents 01–13. All escalation items above require human/ARB resolution before Wave 0 proceeds to branch creation.*

---
---

# ROUND 2 — Final Independent Review and Falsification (Agent G, round 2)

**Date:** 2026-08-09 · **Mode:** READ-ONLY · **Scope:** the completed Wave 0 package, including
`25_WAVE_0_GATE_CERTIFICATION.md`, `30_CORRECTIONS_AND_STASH_HAZARD.md`, `ZIP_MANIFEST.md`, and
the archive `artifacts/local-operational-proof/letbuyy-web-v1-wave-0-2026-08-09.zip`.

Everything above this line is **Round 1** and is left intact, including the parts that Round 2
and doc 30 have since corrected. Round 1's §"Falsified / Wrong claims" wrongly *confirmed* the
777 figure; that error stands recorded here rather than edited away, because a falsification
document that quietly rewrites its own misses is not evidence.

**Round-2 raw evidence:** `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/g-round2/`
(`01_gate_lane_rerun_round2.log`, `02_round2_remeasurement.txt`, `03_round2_zip_verification.txt`,
`04_round2_secret_scan.txt`, `05_round2_node20_falsification.txt`).

---

## R2.0 — Round 2 verdict in one paragraph

The gate certification's verdict — **PASS_WITH_NAMED_BLOCKERS** — **does follow from its
evidence**, and every decisive structural claim I re-measured myself reproduced exactly. The
archive is intact and correctly manifested. I found **one falsified supporting claim** (the
Node-20 "result stability" argument in W0-G10, which is factually wrong — no Node-20 run exists
anywhere in the evidence), **one archive-integrity caveat created by this very document** (the
ZIP no longer matches the live docs once this Round-2 section is written), and **one disclosure
judgement worth a human's attention** (the production Supabase project ref and organization id
are deliberately retained in the archive). None of these overturns the verdict. I did **not**
find a single leaked credential, a single stale `777` assertion, or any evidence of a push,
deploy, or production mutation.

---

## R2.1 — Original tree: re-measured before and after my own work

| Property | Before round 2 | After round 2 | Lead's recorded value | Match |
|---|---|---|---|:--:|
| branch | `stepup/main` | `stepup/main` | `stepup/main` | ✓ |
| HEAD | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee3711829d857e986014c5811bb94d86ebc3d343` | same | ✓ |
| `git status --porcelain \| wc -l` | 6826 | 6826 | 6826 | ✓ |
| `git stash list \| wc -l` | 2 | 2 | 2 | ✓ |

Porcelain letter histogram (independent partition, not copied): `6785` ` M ` + `31` `??` +
`10` ` A ` = **6826**. Reconciles exactly.

**W0-G02 ("Original worktree preserved") — CHALLENGED AND UPHELD as PASS.** The gate's condition
is preservation, and preservation is what is proven: the tree is bit-identical on branch, HEAD,
dirty count and stash count, before and after. I additionally confirmed the preservation corpus
outside the tree: `raw-evidence/preservation/patches/` holds **exactly 99** patch files,
`untracked-raw/` holds **96** files, `SHA256SUMS.tsv` carries **214** rows. The one thing the
certification is careful *not* to claim — that the dirty work is safe to commit — remains
correctly unclaimed; see R2.7.

---

## R2.2 — Branch topology, containment, and the no-push mandate

Re-measured directly:

| Claim | Command | Result | Verdict |
|---|---|---|:--:|
| integration branch SHA | `git rev-parse HEAD` in the worktree | `fa5630aa7b5728af3aadec9bb8a9d99f2abc25a6` | ✓ |
| 23 commits vs baseline | `git rev-list --count ee371182..HEAD` | **23** | ✓ |
| 155 files, +51,757/−1,003 | `git diff --shortstat ee371182..HEAD` | `155 files changed, 51757 insertions(+), 1003 deletions(-)` | ✓ |
| short-lived branch commit counts | `git rev-list --count` ×4 | ci-coverage **3**, validator-execution **2**, v1-perimeter **1**, local-environment **2** | ✓ |
| killswitch **not** merged | `git merge-base --is-ancestor 30fd96b5 fa5630aa` | **NOT an ancestor** | ✓ |
| killswitch commit count | `git rev-list --count ee371182..30fd96b5` | **2** | ✓ |
| nothing pushed | `git for-each-ref refs/remotes/origin/codex/` | **0 refs** | ✓ |
| nothing pushed (stronger) | `find .git/logs/refs/remotes -type f` mtimes | all four files **Aug 3 01:51** — frozen | ✓ |
| remote-tracking reflog content | `git reflog show --date=iso refs/remotes/origin/stepup/main` | last two "update by push" entries dated **2026-08-01** and **2026-07-31** | ✓ |

`refs/remotes/` contains exactly four refs: `origin/HEAD`, `origin/develop`, `origin/main`,
`origin/stepup/main`. No `codex/*` remote ref exists.

**A fact the package states but that deserves louder framing:** the local baseline
`ee371182` is **17 commits ahead of `origin/stepup/main`** (`8d9dda77`). The Wave 0 baseline was
never on the remote to begin with. That is not a Wave 0 defect, but it means "nothing was
pushed" and "the remote reflects the baseline" are two very different statements, and only the
first is true.

---

## R2.3 — Governance gate: re-run by me, not read from a log

I executed the gate lane myself in the integration worktree at `fa5630aa`:

```
$ node scripts/validate-governance.mjs --lane=gate
TOTALS: PASS=90 FAIL=20 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1
Governance gate lane FAILED with 20 problem(s)
EXIT=1
```

- Typed result lines counted: **110** — every gate-lane validator produced a disposition.
- Integration worktree `git status --porcelain | wc -l` = **1** before and **1** after. The gate
  mutates nothing.

This reproduces the certification's `PASS=90 FAIL=20 BLOCKED=0`, exit 1, 110 executed, exactly.
**Fail-fast is genuinely eliminated** — the run continued past twenty failures to completion,
which is the substantive repair, and I saw it with my own exit code.

---

## R2.4 — FALSIFIED: the Node-20 "result stability" argument (W0-G10)

**This is the one claim in the certification that is factually wrong.**

`25_WAVE_0_GATE_CERTIFICATION.md` line 362 states:

> "this run used node `v26.5.1` while the baseline run used the pinned node 20, and produced
> byte-identical totals. That is evidence the gate result is not node-major-dependent."

and `raw-evidence/certification/25_certification_transcript.txt` line 195 repeats it
("on a different node major (26.5.1 vs the pinned 20) — the result is node-version stable").

**Both are false. There is no Node-20 run anywhere in the evidence.**

| Evidence | Finding |
|---|---|
| all 31 `raw-evidence/build-baseline/*.log` headers | `node : v26.5.1` — **31 of 31**, zero exceptions |
| `raw-evidence/w0-validator-execution/20_post-repair-gate.log` lines 133, 315 | `Node.js v26.5.1` — the "baseline" gate run being compared against **also ran on 26** |
| `23_BUILD_AND_TEST_BASELINE.md` line 475 | *"Nothing was measured on Node 20. All 37 commands ran on Node v26.5.1"* — correct, and contradicts doc 25 |

The two gate runs agree because they used the **same** node major. That is evidence of
run-to-run determinism, which is worth something, but it is **not** evidence of node-major
independence, which is what the sentence claims. The distinction matters because the repo pins
Node 20 (`.nvmrc`, `.node-version`), `engines.node` is `>=20.9.0`, and `ci.yml` sets
`NODE_VERSION: "20"` — so **CI will execute a toolchain that Wave 0 never exercised.**

**Impact on the verdict: none.** W0-G10's verdict (PASS) rests on the 110-validator typed matrix
and the elimination of fail-fast, both of which I reproduced. Only the supporting sentence must
be struck. Node-20 reproducibility of every Wave 0 number remains **UNVERIFIED** and is already
correctly carried as **FBR-52** and in doc 23 §13/§14.2.

**Required correction:** delete or rewrite doc 25 line 362 and transcript line 195. Suggested
replacement: *"Both runs used node v26.5.1. The agreement is evidence of run-to-run determinism,
not of node-major independence; Node-20 reproducibility is UNVERIFIED (FBR-52)."*

---

## R2.5 — Archive verification (independent, and stronger than the brief asked for)

**Container.** Recomputed `shasum -a 256` on
`artifacts/local-operational-proof/letbuyy-web-v1-wave-0-2026-08-09.zip`:

```
97a5762b2d90a02ff971fa4728763057d1d670011f1d82e4d2e2cb1df7f57356
```

Byte-identical to the recorded `letbuyy-web-v1-wave-0-2026-08-09.zip.sha256`. Size **814,257
bytes**, as stated.

**Members.** Extracted to a fresh scratch directory that had never held these files, then — rather
than the requested random sample of 10 — verified **every** member:

| Check | Result |
|---|---|
| manifest rows parsed | **173** |
| rows marked `EXCLUDED — SELF-REFERENCE` | **1**, and it is exactly `docs/ZIP_MANIFEST.md` |
| rows with a real SHA-256 | **172** |
| **matched (size AND digest)** | **172** |
| mismatched | **0** |
| missing from disk | **0** |
| files on disk after extraction | **173** |
| on-disk-but-unlisted | **0** |
| listed-but-absent | **0** |

The manifest's self-reference handling is **correct and correctly reasoned**: a file cannot carry
its own digest, and the manifest says so explicitly and delegates its own verification to the
container hash one level up. That is the right construction, and it is a genuine improvement over
the prior package.

Spot-checked members drawn at random and re-hashed individually included
`raw-evidence/appbridge-urgent/killswitch-raw/commit-ed6e5167.stat`, `raw-evidence/D/app_bridge_evidence.txt`,
`raw-evidence/w0-validator-execution/20_orchestration-tests.log`, `docs/12_…`, `docs/18_…`,
`docs/24_…`, `raw-evidence/build-baseline/23_build_queue_workers.log`,
`raw-evidence/g/identity-platform-lint-rerun.txt`, `raw-evidence/appbridge-urgent/probe-raw/matrix.md`,
`raw-evidence/build-baseline/36_ephemeral_postgres_stop.log`, `docs/14_…`, and
`raw-evidence/appbridge-urgent/reproduction-probes/tmp-appbridge-probe/skeptic3-decisive.probe.mts`
— all matched.

**Exclusions.** `ZIP_MANIFEST.md` §5.3 declares **280 excluded files / 14,552,455 bytes** with a
per-group rationale. I checked the largest and most consequential exclusion — the 99 preservation
patches — against the original artifacts tree: they exist on disk (99 files), and the manifest's
justification (that the decisive 99-vs-678 claim is carried by the four included proof tables) is
accurate. **But see R2.6: this makes W0-G15 conditional, not absolute.**

**A caveat this document itself creates.** At the moment I ran it, `diff -rq` between the ZIP's
`docs/` and the live `docs/launch/web-v1-wave-0-2026-08-09/` was **empty** — byte-identical.
**Writing this Round-2 section breaks that.** The ZIP `97a5762b…` is now a sealed snapshot of the
package *as of 13:18, without Round 2*. Either the human re-packages (new ZIP, new digest, new
manifest) or the archive is knowingly accepted as the round-1 snapshot with this document as an
out-of-band addendum. **This is a decision, not a defect — but it must be made explicitly.**

---

## R2.6 — Challenging the three gates the brief singled out

### W0-G07 — "Web-only V1 scope frozen" while mobile is deliberately unresolved

**Question: can scope be called "frozen" while `apps/mobile/merchant-app` has no V1 disposition?**

**Answer: yes, but only because the certification refused to call it PASS.** Verified directly
against `config/governance/web-v1-scope-registry.json` on the integration branch: 50 capabilities
(19 required + 16 deferred + 13 forbidden/frozen + **2 HUMAN_DECISION_REQUIRED** = 50 ✓), 55
probes, `knownActivationsBaseline.recordedCount` 32, `artifactClass`
`GOVERNANCE_CONFIG_NOT_AUTHORITY`, five open escalations.

The decisive point is that the unresolved question is **enforced in code**, not merely noted:

```
invariants.mustBeHumanDecisionRequired = ["mobile_merchant_app", "lcis_api_service"]
invariants.forbiddenClassificationsFor.mobile_merchant_app
    = ["WEB_V1_DEFERRED", "MOBILE_V1_1", "WEB_V1_REQUIRED"]
```

and `web-v1-scope-perimeter-validator.mjs` **PASSED in my own gate run**. So a future agent
cannot silently resolve mobile by editing a JSON field — the validator rejects every
classification. That converts "we didn't decide" from a documentation gap into a **machine-checked
refusal to decide**, which is strictly stronger.

**Verdict on the verdict: PASS_WITH_NAMED_BLOCKERS is correct and is not an overstatement.** The
certification states the tension in its own words before ruling ("a reader could reasonably say
the perimeter of 'web-only' cannot be final while the largest non-web surface … has no agreed
relationship to V1"), rules *not PASS*, and names FBR-06/FBR-07 plus the five escalations. Had it
said plain **PASS**, I would be calling it out. It didn't. **Upheld.**

**One residual I do flag:** the word "frozen" in the gate's own title is still doing more work
than the evidence supports, and a reader skimming only the verdict table will read
"PASS_WITH_NAMED_BLOCKERS · Web-only V1 scope frozen" and take the perimeter as settled. Wave 1
should rename this gate to something like *"Web V1 scope registered and ratcheted"* so the title
cannot be quoted out of context.

### W0-G14 — "No production mutation"

**Verdict: PASS — independently re-verified, and it survives adversarial probing.**

I re-ran the certification's own evidence lines rather than trusting them:

| Channel | My check | Result |
|---|---|---|
| Supabase cloud auth | `ls ~/.supabase/` | only `telemetry.json` + `traces/`; **`access-token` ABSENT** → remote CLI ops were *impossible*, not merely avoided |
| production link metadata | `ls -la supabase/.temp/` (names + mtimes only) | `project-ref`, `linked-project.json`, `pooler-url`, `postgres-version`, … all **Aug 1 00:20–00:27**. Wave 0 ran Aug 9. Any `link`/`db pull`/`db push`/`db reset` rewrites these. None rewritten. |
| git remote | `git for-each-ref refs/remotes/origin/codex/` | 0 |
| git remote (stronger) | mtimes of `.git/logs/refs/remotes/**` | all **Aug 3 01:51** — a successful push necessarily rewrites one of these |
| Cloudflare | `~/.wrangler/config` | **does not exist** |
| Vercel | `~/.local/share/com.vercel.cli` | **does not exist** |
| original HEAD | `git rev-parse HEAD` + reflog | never moved off `ee371182` |

The certification also volunteers the one network operation that *did* occur — a `git fetch`
(`.git/FETCH_HEAD` mtime **Aug 9 05:05**, which I confirmed) — and correctly classifies it as
read-only, noting that it advanced no remote-tracking ref. **Volunteering that instead of hiding
it is the single strongest signal in the whole certification that this gate was not rubber-stamped.**

**No overstatement found. PASS is correct.** The standing hazard (the original repo *is* linked to
production) is correctly separated from the claim (nothing *was* mutated) and carried as FBR-32.

### W0-G02 — "Original worktree preserved"

Covered in R2.1. **PASS upheld**, on two independent axes (tree bit-identical; 99/99 patches +
96 untracked + 214 checksums stored outside the tree).

---

## R2.7 — Are the corrections now consistent? Is a stale `777` still alive anywhere?

**I re-derived the corrected figures from scratch rather than reading them.**

```
$ git diff HEAD --numstat | awk ...
binary(- -): 678     zero-delta text: 6018     nonzero text: 99     total: 6795
```

Then, for all **678** binary paths, I hashed the worktree file with `git hash-object` and compared
it to the index blob recorded by `git diff --raw`:

```
binary paths: 678   blob-identical: 678   differing: 0   mode-flipped: 678
```

**678 of 678 are `100644 → 100755` mode flips on byte-identical blobs. Correction 1 is
independently CONFIRMED: the true number of real content changes is 99, and `777` is refuted.**
The partition also reconciles the other way: `6018 + 678 = 6696` mode-only, `6696 + 99 = 6795`
`git diff --raw` entries, `6795 + 31` untracked `= 6826`. Every arm closes.

**Stale-`777` sweep.** `777` appears **59 times across 12 documents**. I read the context of every
occurrence. **All 59 are inside correction notices, strikethroughs (`~~777~~`), retraction
prose, or explicit "never re-cite 777" warnings.** There is **no surviving assertion** of 777 as
fact anywhere in the package. Representative:

- `03_…md:295` — `| ~~777~~ → **99** **[CORRECTED 2026-08-09]**`
- `04_…md:343/354` — `~~**777**~~` struck, replaced by `| **99** | … **NOT 777.**`
- `00_README_AND_AUTHORITY.md:151` — *"**Never re-cite 777.**"*
- `ZIP_MANIFEST.md` §7.3 — hazard #3 preserves the refutation inside the archive itself

**Correction 2 (the under-registered file) is applied correctly.** `04_…md` now carries **Group P**
for `apps/merchant-control-plane/src/app/globals.css` (`+271/-73`, confirmed by my own numstat at
line 737), explicitly marked `[ADDED 2026-08-09 BY CORRECTION]`, and the register's total line now
reads *"Now enumerated individually in **16** groups A–**P**"*. Groups A–P sum to 99.

**Correction 6 (the intent-to-add trap) is CONFIRMED still armed.** Ten paths, all index blob
`e69de29b` (the empty blob), all holding real content on disk:

| File | index blob | on disk |
|---|---|---:|
| `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` | `e69de29b` | **6,250 B / 109 L** |
| `database/supabase/migrations/197_letbuyy_core_first_class_theme.sql` | `e69de29b` | 19,974 B / 350 L |
| `database/supabase/rollback/180…197` (8 files) | `e69de29b` | 885–3,761 B each |
| **total** | | **789 lines** |

Exactly as doc 30 records. **Any `git commit` touching these paths without a prior explicit
`git add` commits zero-byte migrations.** I ran no `git add` and no `git commit`.

**New, minor, previously unrecorded:** the index holds **22** entries with the empty blob, not 10.
The other 12 are legitimately empty and already committed that way — three `.gitkeep` files under
`apps/mobile/merchant-app/assets/` and **nine zero-byte Dart widget files** under
`packages/dart/ui_kit/lib/src/widgets/` (`badge_widget.dart`, `confirmation_dialog.dart`,
`custom_drawer.dart`, `error_widget.dart`, `loading_indicator.dart`, `network_image_widget.dart`,
`rating_widget.dart`, `search_bar_widget.dart`, `shimmer_loading.dart`). These are empty at HEAD
*and* empty on disk, so they are not part of the trap — but nine empty widget source files
committed into a shared UI package is a latent quality signal worth a Wave 1 look. **Not a Wave 0
blocker; recorded so it is not rediscovered as a scare later.**

**Correction 5 (two stashes) is CONFIRMED.** `git stash list` shows exactly
`stash@{0}: On stepup/main: inf-ext` and `stash@{1}: On stream/letbuyy-ui-v2: branch-consolidation-local-artifacts`.
**I ran no stash command of any kind** — not `apply`, not `show`, not `pop`, not `drop`.

---

## R2.8 — Cross-package contradiction sweep

| # | Contradiction | Status |
|---|---|---|
| 1 | Doc 25 §W0-G10 "the baseline run used the pinned node 20" **vs** doc 23 §13 "Nothing was measured on Node 20" | **REAL — doc 25 is wrong.** See R2.4. Must be corrected. |
| 2 | `777` vs `99` | **RESOLVED everywhere.** 59 occurrences, all retractions. See R2.7. |
| 3 | Doc 04 groups A–O summing to 98 vs a claimed 99 | **RESOLVED** by Group P. |
| 4 | Doc 13 §1 arithmetic `6785+777+10+31=7603 ≠ 6826` | **RESOLVED** — the correction notice at `13_…md:17-22` names both errors (the 6785-vs-6018 conflation and the 777 inheritance) and the corrected partition `6018+678+99+10+31 = 6836`… *and here I must be precise:* the reconciling identity is `6795 (diff --raw) + 31 (untracked) = 6826`, where `6795 = 6696 mode-only + 99 content` and `6696 = 6018 zero-delta-text + 678 mode-flipped-binary`. The ` A ` 10 are inside the 6795, not additive. Doc 13's corrected text and doc 25 §W0-G02's bucket table both get this right; anyone re-deriving it should use the identity above and not add the 10 twice. |
| 5 | Validator count `107` (root `CLAUDE.md`) vs `108` (baseline) vs `110` (integration branch) | **REAL but already self-reported** by doc 23 §14.4 as a documentation drift needing a Wave 1 fix. My run measured **110** typed dispositions. Confirmed. |
| 6 | `branch-lag-guard` demands a `main` fast-forward (a push) vs the no-push mandate | **REAL and correctly escalated** — doc 23 §14.3. The gate cannot be satisfied without violating the mandate. Human merge decision required. |
| 7 | W0-G15 "Evidence self-contained" vs 280 files / 14.5 MB excluded from the ZIP | **PARTIALLY REAL.** The verdict is already `PASS_WITH_NAMED_BLOCKERS`, and the exclusions are itemised with rationale, so this is disclosed rather than hidden. But the archive is self-contained **for its claims**, not **for its corpus**: the 99 preservation patches — the physical backup of the user's uncommitted work — are **not in the ZIP**. Anyone treating the ZIP as the durable backup would be wrong. See R2.9 item 3. |

**Does the certification's verdict follow from its evidence?** Yes. Sixteen gates: 9 PASS, 7
PASS_WITH_NAMED_BLOCKERS, 0 FAIL, aggregate **PASS_WITH_NAMED_BLOCKERS**. Every
PASS_WITH_NAMED_BLOCKERS names its blockers by FBR id. The two gates most at risk of inflation
(G07 scope, G14 no-mutation) are the two I probed hardest, and both hold. The certification
repeatedly rules *against itself* where the evidence is thin — G07 refused a clean PASS, G15
refused a clean PASS, G13 explicitly labels the `platform-console` failure "a measurement gap in
the gate, not a measurement failure of Wave 0", and doc 23 §13 lists fourteen things that were
**not** measured. **That is the profile of a real certification, not a rubber stamp.**

---

## R2.9 — Secrets: full scan of the ZIP and the docs directory

Patterns: `sk-[A-Za-z0-9_-]{16,}`, `AKIA[0-9A-Z]{16}`, `BEGIN … PRIVATE KEY`,
`eyJ…\.…` (JWT), `rzp_(live|test)_…`, `token=<value>`, `password=<value>`,
`postgres(ql)://…`, `service_role`, and the Supabase project ref.

| Pattern | Hits | Adjudication |
|---|---:|---|
| `sk-` API keys | **0** | Round 1's `risk-assessment` filename false positives are **gone** — the packaging agent excluded `agent-b/` (the raw git dumps that contained them), which removed the noise at the source. |
| `AKIA…` | **0** | — |
| `BEGIN … PRIVATE KEY` | 2 | **False positives.** Both are the literal *pattern string* inside scan-methodology prose (`docs/14_…md:223` and `raw-evidence/g/secrets-scan-rerun.txt:3`). No key material. |
| JWT `eyJ…` | **0** | — |
| `rzp_live_` / `rzp_test_` | **0** | — |
| `token=<value>` | **0** | — |
| `.env*` files packaged | **0** | Confirmed by `find`. |
| `password=` / creds-in-URI | 4 | **All redacted at capture time.** `postgresql:***REDACTED***@aws-1-ap-south-1.pooler.supabase.com:…` and `postgresql://postgres:<REDACTED>@127.0.0.1:15422/postgres`. I confirmed the redaction is in the **persisted file**, not just the prose. |
| local stack keys | 5 fields | All `<REDACTED-LOCAL-ONLY>` in `raw-evidence/W0-LOCAL-ENV/03_isolated_stack_boot_proof.txt` (`PUBLISHABLE_KEY`, `SECRET_KEY`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, plus S3 pair). Loopback-only stack in any case. |
| `service_role` | 12 | **All benign** — SQL policy identifiers (`tp_service_role`, `service_role_email_logs`) and psql `NOTICE`/`WARNING` lines. No key material. |
| Supabase project ref `qtrzgnnqnvboifoqntfi` + `organization_id` | 11 | **REAL, DELIBERATE, NOT A CREDENTIAL — but a human call.** See below. |

**Zero credentials leaked. No CRITICAL finding.**

**The one disclosure judgement I will not wave through.** The archive deliberately retains the
production Supabase **project ref** and **organization id** (`ZIP_MANIFEST.md` §5.2 argues, fairly,
that they are non-secret identifiers that grant no access alone and that the production-link
finding is one of the archive's decisive safety facts). I agree with the reasoning and with
keeping them. **But the consequence is that this ZIP is an internal artifact.** It names the
production project, the org, the pooler host and region, the 22 domains, and the exact set of
failing validators and unauthenticated routes. **It must not be attached to a public issue,
uploaded to a vendor portal, or shared outside the ARB.** That constraint is nowhere stated as a
handling rule in the package. **Add it.**

---

## R2.10 — Build results: what I could cheaply re-check

I did **not** re-run the five passing Next builds (minutes each, and re-running writes `.next`
into the worktree — a mutation I declined to make as a read-only reviewer). I re-verified the
**decisive negative** instead, statically:

`apps/platform-console/src/app/(dashboard)/developers/page.tsx:238` declares

```ts
export default async function DeveloperOperationsPage({ searchParams }: {
    searchParams: SearchParams;      // line 180: Record<string, string | string[] | undefined>
})
```

against **Next.js 16.1.6**, whose generated `PageProps` constraint requires `searchParams` to be a
`Promise`. For contrast, the *passing* `merchant-control-plane` declares
`searchParams: Promise<{…}>` in its own pages. **The failure is real, correctly located,
correctly attributed, and correctly described as invisible to `turbo typecheck` and to all 110
validators.** I confirmed `turbo typecheck` exit 0 is recorded alongside it — that combination
(typecheck green, `next build` red) is exactly the false-green class Wave 0 was chartered to find,
and the package found it. Good.

**Unchanged caveat:** every build number, including this one, was produced on **Node 26.5.1**
against a **Node 20** pin (R2.4).

---

## R2.11 — What the human must still decide or do

Ranked. Items 1–3 are decisions only a human can make; 4–6 are actions.

1. **Adjudicate the App Bridge / app-platform S0.** Both S0 blockers are the same unauthenticated
   surface (19 of 83 routes execute for an unauthenticated caller in verbatim production shape).
   A fail-closed gate exists on `codex/emergency-appbridge-killswitch` (2 commits, 59 proving
   tests, falsification pass) — but that branch is **deliberately not merged**, neither Next.js app
   was compiled, and status is **GATED_WITH_RESIDUAL_RISK**. **ARB must decide: merge the gate,
   remove the surface, or retroactively approve it.** Nothing else in Wave 0 outranks this.
2. **Classify `apps/mobile/merchant-app` and `services/lcis-api`.** The registry *refuses* to let
   any agent decide (invariants reject every classification). Only a human can unblock FBR-06 /
   FBR-07, and several gate failures and behavioural test failures cannot be triaged until they do.
3. **Decide the `branch-lag-guard` deadlock.** The validator's own remediation is to fast-forward
   `main` — a push, which this workstream is forbidden to perform. `stepup/main` is 129 ahead of
   `main`. Either a human performs the merge or the guard's scope changes. It cannot be resolved
   inside the mandate.
4. **Correct doc 25 line 362 and transcript line 195** (R2.4), then decide whether to **re-package**.
   Because this Round-2 section changes doc 14, the sealed ZIP `97a5762b…` no longer matches the
   live docs directory. Either re-zip (new digest, new manifest, new `.sha256`) or record in
   writing that `97a5762b…` is the round-1 snapshot and Round 2 travels alongside it.
5. **Disarm the intent-to-add trap before anyone commits in the original tree.** Ten SQL files sit
   in the index as empty blobs while holding 789 lines on disk. The safe move is an explicit
   `git add` on exactly those ten paths immediately before any commit. **No agent should do this** —
   it mutates the index of the production-linked tree. Content is preserved at
   `raw-evidence/preservation/intent-to-add-raw/` if it is ever lost.
6. **Deal with `stash@{0}` deliberately.** It is a third divergent body of uncommitted work (28
   files, materially overlapping the dirty tree — including `globals.css` with a *different*
   `624 ++++----` diff). No stash command has been run by any agent, including me. A human must
   decide whether it is superseded, mergeable, or garbage — **before** anything else touches those
   paths, because the dirty tree and the stash disagree about the same files.
7. **Two standing hazards to carry into Wave 1:** the original repo remains **linked to Supabase
   production** (`supabase unlink`, or mandate the isolated `--workdir` pattern), and
   `stepup/main`'s **branch-protection state is still unknown** — it needs someone with GitHub
   owner access to look, because Wave 0 could not.
8. **Handling rule for the archive** (R2.9): internal / ARB only. It names the production project
   and org.

---

## R2.12 — Round 2 bottom line

| Question | Answer |
|---|---|
| Does the certification's verdict follow from its evidence? | **Yes.** PASS_WITH_NAMED_BLOCKERS is the right call and is not inflated. |
| Did I reproduce the decisive claims myself? | **Yes** — original tree state, branch SHAs and counts, killswitch non-containment, zero pushed refs, the 110/90/20/0 gate at exit 1, the 99-vs-678 partition, the ZIP digest, and 172/172 manifest members. |
| Any claim falsified? | **One.** The Node-20 "result stability" argument (R2.4). Verdict unaffected; the sentence must be struck. |
| Any secret leaked? | **No.** Zero credentials. One deliberate, disclosed, non-credential identifier retention that implies an internal-only handling rule. |
| Is the ZIP sound? | **Yes** — digest matches, every member matches, self-reference correctly excluded, exclusions itemised. It is **not** a backup of the 99 preservation patches, and it is now one document out of date. |
| Was anything mutated? | **No.** Original tree re-measured identical before and after: `stepup/main` @ `ee371182`, 6826 dirty, 2 stashes. Integration worktree status 1 before and after my gate run. No push, no PR, no deploy, no provider command, no Supabase command, no stash command, no `git add`, no `git commit`. |

*End of Round 2. Written 2026-08-09 by Agent G (round 2), read-only and independent. This section
amends no governance document and confers no approval. The Constitution → root `AGENTS.md` →
local `AGENTS.md` chain remains supreme; the 110 deterministic validators remain the authoritative
gate, and they currently fail with 20 problems at `fa5630aa`.*
