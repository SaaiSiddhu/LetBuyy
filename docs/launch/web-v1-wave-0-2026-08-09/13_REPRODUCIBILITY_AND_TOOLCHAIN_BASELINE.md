# 13 — Reproducibility and Toolchain Baseline

> ## ⚠️ CORRECTION NOTICE — applied 2026-08-09 by the Wave 0 Doc Correction agent
>
> **Evidence artifact, not governance authority.** Appended after publication; §1 below carries inline `[CORRECTED …]` markers. History is annotated, not rewritten.
>
> | Field | Value |
> |---|---|
> | Repo | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` (original tree, read-only) |
> | Branch / HEAD | `stepup/main` @ `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
> | Date | 2026-08-09 |
> | Commands used | `git status --porcelain`, `git diff HEAD --numstat`, `git diff HEAD --raw`, `git ls-files -s`, `git hash-object` |
> | EXECUTED vs INFERRED | Every figure below EXECUTED this session; exit codes observed. Nothing INFERRED. |
>
> **What was wrong — §1's buckets do not sum to §1's own total.** §1 states the tree has **6,826** changed/untracked paths, then lists four buckets:
> ```
> 6,785 (mode-only, zero content) + 777 (real content) + 10 (staged additions) + 31 (untracked) = 7,603 ≠ 6,826
> ```
> Two independent errors produce the 777-path overshoot:
>
> 1. **Conflation.** `6,785` is the raw `M` count from `git status --porcelain` — *every* modified tracked path. It is **not** the zero-content subset. The true zero-line-delta subset is **6,018**. §1 used the raw M-count in a slot that its own label ("show as modified with **zero** content difference") reserves for the zero-diff subset, so the content-changed files got counted twice: once inside 6,785 and again in the 777 bucket.
> 2. **The 777 itself is refuted.** Inherited from `03_…md` §10 / `04_…md`. **678** of those 777 are binary paths that `git diff --numstat` marks `- -` **purely because their mode flipped** — index blob and worktree blob are byte-identical (678/678 verified, zero exceptions). The real content-change count is **99**. See the correction notices in `03_…md` and `04_…md`.
>
> Additionally the `10` bucket is **not disjoint** from the content bucket: the 10 intent-to-add SQL files carry real new content and are already inside the 99.
>
> **What it is now — a decomposition that reconciles exactly:**
>
> | Bucket | Count | Definition |
> |---|---:|---|
> | Mode-only / zero-content tracked paths | **6,696** | 6,018 textual `0 0` + 678 binary identical-blob `100644→100755` |
> | Tracked files with real content change | **89** | nonzero numstat, already in the index |
> | Intent-to-add new files with real content | **10** | index holds empty blob `e69de29b`; disk holds 789 lines / 43,929 bytes |
> | Untracked | **31** | `??` |
> | **Total** | **6,826** | ✓ matches `git status --porcelain \| wc -l` |
>
> Cross-checks: 6,696 + 89 + 10 = **6,795** = `git diff HEAD --numstat | wc -l` ✓ · 89 + 10 = **99** real content changes ✓ · 6,018 + 678 + 99 = 6,795 ✓ · porcelain `M`=6,785 = 6,018 + 678 + 89 ✓ (the 10 show as `A`, not `M`).
>
> **Impact on this document's conclusions: none.** §1's load-bearing claim — that `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc` and `supabase/config.toml` each return `0 0` and so the dependency analysis is valid against committed `bf35062e` content — is unaffected and still stands. Only the framing counts were wrong. The **direction** of §1's warning is if anything strengthened: a fresh `git clone` of `bf35062e` reproduces **99** files of real drift plus 31 untracked paths, and the mode-only noise (6,696 paths, not 6,018) is larger than stated.
>
> **Found by:** Wave 0 Doc Correction agent, by re-adding §1's own four numbers and then re-deriving each bucket from raw git output. **See:** `30_CORRECTIONS_AND_STASH_HAZARD.md`.

**Status:** evidence artifact (not governance authority). Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, root `AGENTS.md`, and the relevant local `AGENTS.md` files.

**Audit identity**
- Agent: F — Local Environment and Reproducibility Auditor, Wave 0 Phase 1 (read-only)
- Repo root: `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store`
- Branch: `stepup/main`
- HEAD SHA at time of audit: `bf35062eda22f4d881efd61fb1d36c8fc83baed1`
- Timestamp used: literal date **2026-08-09**
- Mode: read-only. `pnpm install` was **never run** by this audit — every dependency-resolution claim below comes from **static comparison of `pnpm-lock.yaml` against every workspace `package.json`**, not from executing pnpm.
- Raw evidence: `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/F/00_git_and_tool_versions.txt`, `04_lockfile_vs_package_json_check.txt`, `05_toolchain_pins.txt`

---

## 1. Working tree is not a clean checkout of HEAD — this matters for how to read every claim below

`git status --short` reports **6,826** changed/untracked paths against `bf35062e`. This was independently re-verified, not taken from any prior report. Breaking it down (`git diff --name-status` / `git diff --numstat`, both run fresh):

> **[CORRECTED 2026-08-09] — the four bullets below sum to 7,603, not 6,826. Read the corrected table underneath them, not the bullets.**

- ~~**6,785 files** show as modified with **zero content difference**~~ **[CORRECTED: 6,785 is the raw porcelain `M` count — *all* modified tracked paths, not the zero-content subset. The zero-line-delta subset is **6,018**; adding the 678 binary identical-blob mode flips gives **6,696** truly content-free paths. `6,785 = 6,018 + 678 + 89 content-changed`.]** — pure file-mode changes, `old mode 100644` → `new mode 100755` (confirmed by inspecting `.gitattributes` and `CLAUDE.md`'s diffs directly: `0 insertions(+), 0 deletions(-)`, mode-only). This is consistent with the working directory being a **filesystem copy** of the repository (its own path is literally `.../Copy/Letbuyy_Store`) that lost the original executable-bit fidelity during copy/extraction — not a content edit by any agent or human in this session. *(The copy/extraction explanation is unaffected by this correction and still stands.)*
- ~~**777 files** have **real, non-zero content diffs**~~ **[CORRECTED: **99**. 678 of the 777 were binary paths marked `- -` by `git diff --numstat` *because their mode flipped*, with byte-identical index and worktree blobs — 678/678 verified. See `04_…md` correction notice.]** (line insertions/deletions) — genuine uncommitted local work already present before this audit began, e.g. `apps/developer-portal/src/app/**`, `apps/identity-platform/src/app/api/auth/create-store/route.ts`.
- **10 new files staged as additions**, all under `database/supabase/migrations/` and `database/supabase/rollback/` (migrations 196/197 and their rollback scripts). **[CORRECTED: this bucket is *not* disjoint from the bucket above — these 10 carry real content and are already counted inside the 99. Also: they are `git add -N` intent-to-add entries holding the **empty blob** `e69de29b` in the index while holding 789 lines / 43,929 bytes on disk. A naive `git commit` silently drops all 10. See `30_CORRECTIONS_AND_STASH_HAZARD.md` §3.]**
- **31 untracked paths** (`git status --short | grep '^??'`), including a `docs/launch/` tree (Wave 0's own output directory — expected, other agents are writing there concurrently) and assorted app/theme scaffolding.

**Corrected decomposition (EXECUTED 2026-08-09; reconciles exactly):**

| Bucket | Count |
|---|---:|
| Mode-only / zero-content tracked paths (6,018 textual `0 0` + 678 binary identical-blob) | 6,696 |
| Tracked files with real content change | 89 |
| Intent-to-add new files with real content (subset of "real content", listed separately for visibility) | 10 |
| Untracked | 31 |
| **Total** | **6,826** ✓ |

Real content changes = 89 + 10 = **99**. Tracked diff rows = 6,696 + 99 = **6,795** = `git diff HEAD --numstat | wc -l` ✓. Porcelain `M` = 6,018 + 678 + 89 = **6,785** ✓.

**Load-bearing fact for this document:** the files this reproducibility analysis actually depends on — `package.json` (root), `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `supabase/config.toml` — were individually checked with `git diff --numstat` and each returned `0 0` (no content diff, mode-only at most). So the dependency-resolution analysis below is valid against the **committed** `bf35062e` content, not against some drifted local edit. This was verified, not assumed.

This 6,826-file dirty state is otherwise out of scope for a read-only audit to remediate (and this audit did not touch it), but it should be surfaced to whoever owns the Wave 0 baseline decision: **a "reproducible checkout" claim for this specific working directory needs the caveat that it is not currently `git clean`.** A fresh `git clone` of `bf35062e` would not reproduce the ~~777-file~~ **[CORRECTED: 99-file]** content drift or the 10 new migration files ~~, only the mode-only noise would disappear~~ **[CORRECTED: nor the 31 untracked paths; the mode-only noise — 6,696 paths, not 6,018 — is the only bucket that would disappear]**.

> **[ADDED 2026-08-09]** A third divergent body of uncommitted work exists that this document never accounted for: **two git stashes**, `stash@{0}` ("On stepup/main: inf-ext", 28 files, based 53 commits behind the baseline) and `stash@{1}` ("On stream/letbuyy-ui-v2", 10 untracked-only files). All 28 of `stash@{0}`'s paths are also dirty right now, 9 of them with a *different* real content diff. Reproducibility from `bf35062e` therefore has three drift sources, not one. **No stash command other than read-only `list`/`show` was run.** See `30_CORRECTIONS_AND_STASH_HAZARD.md` §2.

---

## 2. Installed tool versions on this machine (read-only version probes only)

```
$ node -v
v26.5.1

$ pnpm -v
10.6.2

$ docker -v
Docker version 29.6.2, build dfc4efb

$ supabase --version
2.111.0
```

None of these commands contact a daemon, install anything, or mutate state — they print version strings only. Full output persisted at `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/F/00_git_and_tool_versions.txt`.

---

## 3. Toolchain pinning — what's pinned, what isn't, and where it diverges

| Tool | Repo pin | Installed locally | CI pin (`ci.yml`) | Verdict |
|---|---|---|---|---|
| pnpm | `packageManager: "pnpm@10.6.2"` (root `package.json`) | `10.6.2` | `PNPM_VERSION: "10.6.2"` | **Exact match, all three.** Fully reproducible. |
| Node | **no pin anywhere in the actively-maintained workspace** (`.nvmrc` absent, `.tool-versions` absent, root `package.json.engines` absent) | `v26.5.1` | `NODE_VERSION: "20"` (most jobs); `node-version: 22` in 5 workflows (`architecture-governance.yml`, `environment-lifecycle.yml`, `live-production-certification.yml`, `staging-runtime-deployment.yml`, `production-rollout.yml`) | **No repo-level guardrail, and the version actually installed on this machine is a major-version mismatch against every CI pin.** This is the single largest reproducibility gap found. |
| Docker | none | `29.6.2` | not applicable (CI does not run Docker-based Supabase; it's a local-dev-only dependency) | No pin exists or is needed at the CI layer; local-only concern. |
| Supabase CLI | none | `2.111.0` | not applicable (no CI job installs/pins a Supabase CLI version — confirmed absent from `ci.yml` node-version grep and not found elsewhere in workflow scan) | Unpinned; CLI behavior (e.g. new flags, config schema changes across major CLI versions) could silently diverge between contributors. |
| `tools/central-intelligence` (Node) | `"engines": { "node": ">=20" }` (its own `package.json`, not the workspace root) | satisfies (`v26.5.1 ≥ 20`) | n/a — this tool is outside the pnpm workspace glob | Loosely pinned (floor only, no ceiling), scoped to a tool that is not part of the core V1 web/service topology. |

**Recommendation (design only, nothing executed):** add a root `.nvmrc` (or `engines.node` in root `package.json`) pinned to `20` to match the dominant CI pin, or explicitly widen CI to a matrix and pin local dev to whichever version becomes canonical. Either way, close the gap — right now there is *no* mechanism (file or CI check) that would catch a contributor running Node 26 locally against code whose CI contract is Node 20/22.

---

## 4. Lockfile / `package.json` consistency — independently recomputed, not read from any prior report

**Method:** wrote a small line-based parser (no `pnpm install`, no network) that walks `pnpm-lock.yaml`'s `importers:` block and extracts, per workspace member, the declared dependency+devDependency names for that importer, then diffs that set against the same member's `package.json` `dependencies`/`devDependencies` keys. Run against every `package.json` in the repo found via `git ls-files` (i.e. tracked files only), excluding `node_modules`.

```
Total package.json files (git-tracked, non-node_modules): 57
  with zero declared deps: 0
  checked (have >=1 dep): 57
Mismatches found: 2
 - docs/archive/firebase-legacy/functions/package.json: NO IMPORTER ENTRY … (workspace member possibly not registered)
 - tools/central-intelligence/package.json: NO IMPORTER ENTRY … (workspace member possibly not registered)
```

Both "mismatches" are **expected, not defects**: neither path matches any glob in `pnpm-workspace.yaml` (`apps/*`, `apps/mobile/*`, a fixed list of `packages/*`, `packages/typescript/*`, `services/*`) — `docs/archive/**` is explicitly archived/historical, and `tools/central-intelligence` is deliberately outside the pnpm workspace (it has its own untracked `package-lock.json`, see §5). So:

**All 55 real pnpm-workspace members have dependency declarations that are fully in sync with `pnpm-lock.yaml`** — zero missing entries, zero extra/orphaned entries, across every app, service, and package. This is strong evidence the lockfile is not stale relative to `package.json` across the workspace, as of `bf35062e`.

Full script output persisted at `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/F/04_lockfile_vs_package_json_check.txt`.

Sanity-checked the root importer by hand as well: root `package.json.devDependencies` has 8 entries (`@cloudflare/workers-types`, `@playwright/test`, `eslint`, `stylelint`, `stylelint-config-standard`, `tsx`, `turbo`, `typescript`); `pnpm-lock.yaml`'s `importers: '.'` block lists exactly the same 8 with matching specifiers. `pnpm-lock.yaml` declares `lockfileVersion: '9.0'`, which is the format pnpm 9/10 write — consistent with the pinned `pnpm@10.6.2`.

**Enforcement already in place:** `.npmrc` sets `frozen-lockfile=true`. This means a real `pnpm install` on this repo will **fail loudly** rather than silently rewriting the lockfile if any drift exists — the strongest practical guarantee available short of a CI lockfile-diff check. (Whether CI actually runs with this flag honored, and whether it fails today, is unverified — installing was out of scope for this audit; see §6.)

### 4.1 `tools/central-intelligence` — real reproducibility gap

`tools/central-intelligence/package-lock.json` (npm, not pnpm) **exists on this machine but is not tracked by git and is not gitignored either** — confirmed via `git ls-files --error-unmatch` (fails: not tracked) and `git check-ignore -v` (no match: not ignored, just absent from history). `git status --short` does not list it as untracked either in the current listing scope — it is simply outside version control with no explicit exclusion rule recorded for it specifically (the directory's own `.gitignore` covers `node_modules/`, `.env`, `*.pyc`, `__pycache__/`, and some graph-cache paths, but not `package-lock.json`).

Practically: anyone who clones the repo fresh gets **no lockfile at all** for this tool. `npm install` there would resolve dependencies fresh against whatever `npm` registry state exists at install time — not deterministic across machines or over time, unlike the rest of the pnpm workspace. Low blast radius (this tool is AI-infrastructure tooling, not a production runtime, per the Canonical Runtime Map), but worth a one-line fix (`git add tools/central-intelligence/package-lock.json`) whenever that tool is next touched.

---

## 5. `onlyBuiltDependencies` / native deps

`.npmrc`: `onlyBuiltDependencies=esbuild,sharp,unrs-resolver,workerd` — an explicit allowlist for which packages are permitted to run native postinstall/build scripts under pnpm's default-blocked-scripts posture. This is itself a reproducibility control (prevents arbitrary postinstall scripts from running unpinned/unaudited), and matches `docs/LOCAL_DEV.md`'s own note that first install "installs native deps (`esbuild`, `workerd`, `sharp`)". Consistent, no discrepancy found.

---

## 6. What remains unverified (deferred — this audit ran no install/build/boot commands)

- **Whether `pnpm install --frozen-lockfile` actually succeeds from a clean state.** `node_modules` already exists on this machine (~1.0 GB, populated before this audit started) — a fresh install was not attempted, and this audit did not delete or touch the existing `node_modules` (that would violate the read-only/no-mutation mandate). The static importer-vs-lockfile comparison in §4 is strong circumstantial evidence install would succeed, but it is not a substitute for actually running it.
- **Whether any `pnpm --filter <app> build` succeeds** — per root `AGENTS.md`'s note that the 107-validator gate does not cover `next build`, and per this audit's explicit scope (read-only, no execution), no build was attempted.
- **Whether Node v26.5.1 (installed) actually works correctly against this codebase**, given CI only exercises 20/22. Nothing observed suggests it wouldn't, but this was not tested — it is exactly the kind of drift a missing `.nvmrc` is designed to catch and didn't.
- **Whether the Supabase CLI at `2.111.0` is compatible with `major_version = 17` Postgres and the config schema in `supabase/config.toml`** — the config file parsed without any obviously-deprecated keys during manual review, but no `supabase start`/`status` was run to confirm CLI/config compatibility at runtime.
- **Whether `tools/central-intelligence`'s untracked `package-lock.json` (§4.1) actually reflects what `npm install` would produce today** — not diffed against a fresh resolution.

---

## 7. Conflicts / escalation items

None found specific to this document's scope. See doc 12 §8 for the one machine-state-vs-intended-posture conflict (stray production Supabase link) discovered during this audit, which is a local-environment-isolation concern rather than a toolchain-reproducibility one but was uncovered by the same pass.
