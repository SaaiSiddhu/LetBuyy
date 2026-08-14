# 30 — Corrections Applied to Wave 0 Documents, and Two Uncontained-Work Hazards

**Evidence artifact, not governance authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → the relevant local `AGENTS.md` → the canonical governance rewrite documents. Nothing in this document authorises an action, changes a policy, or grants an exception. It records measurements.

| Field | Value |
|---|---|
| **Repo** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` — the **original, production-linked** tree |
| **Branch / HEAD** | `stepup/main` @ `ee3711829d857e986014c5811bb94d86ebc3d343` |
| **Worktree** | the original checkout (not `letbuyy-w0-worktrees/*`; the integration branch was not consulted for any figure here) |
| **Date** | 2026-08-09 |
| **Agent** | Wave 0 Doc Correction agent |
| **Mode** | **Read-only against git.** No `commit`, `add`, `stage`, `stash push/pop/apply/drop/clear/branch`, `clean`, `reset`, `checkout --`, `restore`, `chmod`, `worktree remove/prune`, push, PR, or deploy. No `supabase` command of any kind. No provider command. |
| **Writes performed** | Only under `docs/launch/web-v1-wave-0-2026-08-09/` and `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/` — the two authorised paths. |
| **Raw evidence** | `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/doc-corrections/` — `verification-transcript-2026-08-09.txt`, `678-binary-mode-only-paths.txt`, `99-real-content-changed-paths.txt`, `stash0-28-files.txt`, `stash0-numstat.txt` |

**Original-tree state, measured before and after this agent's entire run:**

| Measurement | Before | After |
|---|---|---|
| `git rev-parse --abbrev-ref HEAD` | `stepup/main` | `stepup/main` |
| `git rev-parse HEAD` | `ee3711829d857e986014c5811bb94d86ebc3d343` | `ee3711829d857e986014c5811bb94d86ebc3d343` |
| `git status --porcelain \| wc -l` | `6826` | `6826` |
| `git stash list \| wc -l` | `2` | `2` |

The two writes this agent made land in `docs/launch/` (already a single `??` entry) and in `artifacts/local-operational-proof/` (gitignored at `.gitignore:74`), so the dirty-path count is unchanged.

### Commands used

```
git rev-parse HEAD / --abbrev-ref HEAD
git status --porcelain[=v1|=v2]
git diff HEAD --numstat / --raw / --shortstat
git diff --cached --numstat
git ls-files -s -- <path>
git hash-object -- <path>
git cat-file -s <sha>
git log -1 --format=... <ref>
git merge-base --is-ancestor
git rev-list --count
git stash list
git stash show --stat / --name-only / --numstat / --include-untracked --stat
```

### EXECUTED vs INFERRED

- **EXECUTED** — every count, SHA, byte size, line delta, and blob comparison in this document. Each command was run in this session against the original tree and its output read. The 678-path blob-identity check and the 99-path register-coverage check are **full-set loops, not samples**.
- **EXECUTED in a throwaway repo** — the intent-to-add behaviour matrix in §3. It was reproduced in a disposable scratch repository (`git init` in the session scratchpad) that replicates the exact index shape. It was **not** executed against the original tree, because doing so would require a `git commit`.
- **INFERRED** — that the original tree's git will behave identically to the scratch reproduction. Both use the same binary (`git version 2.50.1 (Apple Git-155)`). This is an extrapolation, marked as such.
- **UNVERIFIED / not attempted** — whether any of the 99 changes or the 28 stashed changes builds, typechecks, lints, or passes a validator. Whether the stash's edits are wanted. Any judgement about *why* 6,696 file modes flipped. No live/deployed environment was contacted; no secret value was read or printed anywhere in this document (env var **names** only).

---

## 1. Corrections applied

Six corrections were requested. Five were confirmed and applied. **One was itself refuted on inspection and is reported as refuted rather than applied** — see 1.5 and §5.

### 1.1 REFUTED: "777 real content changes" → the true figure is **99**

**Where it appeared:** `03_WORKTREE_CHANGE_CLASSIFICATION.md` §10; `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` header + Summary counts; inherited into `13_REPRODUCIBILITY_AND_TOOLCHAIN_BASELINE.md` §1.

**The error.** `git diff --numstat` prints `- -` for a binary path whenever that path appears in a diff — **including when the only thing that changed is the file mode**. Doc 04 read `- -` as "the blob changed", asserted *"Every one of these 678 paths genuinely differs in blob content (confirmed …)"*, and in the same paragraph declared the check that would have established this ("a manual visual/hash diff per file") to be **out of scope**. The claim was inferred, not confirmed. Doc 03 then propagated it into its bucket table, and doc 13 into its §1 arithmetic.

**The verification (full set of 678, zero sampling).** For each binary path, index blob SHA vs worktree blob SHA:

```
idx=$(git ls-files -s -- "$p" | awk '{print $2}')
wt=$(git hash-object -- "$p")

index blob == worktree blob : 678
blobs DIFFER                : 0
missing from disk           : 0
```

and, restricted to those same 678 paths:

```
$ git diff HEAD --raw | awk '{print substr($1,2), $2}' | sort | uniq -c
 678 100644 100755
```

**Every one is a `100644 → 100755` permission-bit flip on a byte-identical blob.** No image, screenshot, icon, or font asset in this working tree has changed.

**Independent corroboration.** Summing only the 99 nonzero-numstat rows gives `insertions=6496 deletions=1344`, which is *exactly* `git diff HEAD --shortstat` (`6795 files changed, 6496 insertions(+), 1344 deletions(-)`). The 678 binary paths contribute **zero** lines to the total — they cannot be content changes.

**Corrected figure: 99 real content changes, all textual, zero binary.**

### 1.2 RETRACTED: "36 binary changes inside the frozen `apps/theme-marketplace` surface"

Doc 04 flagged this as *"real change activity inside a frozen surface"*, alongside the developer-portal finding. **Withdrawn in full.**

```
binary (mode-only) paths under apps/theme-marketplace/ : 36
real content changes under apps/theme-marketplace/     : 0   ← of all 99
```

All 36 are mode-only flips. **There is no change activity of any kind inside `apps/theme-marketplace`.** Any ARB item, blocker, or governance escalation citing this finding must be withdrawn.

**Not retracted:** the parallel Group B finding for `apps/developer-portal` (13 files). Those are genuine textual edits with real line deltas and stand exactly as written.

**Also corrected in doc 04:** the claim that `packages/typescript/ui`'s 337 Storybook PNGs were *"re-baselined"* alongside the Group N `@letbuyy/ui` component changes. Those 337 are byte-identical to their committed blobs — **no visual-regression baseline was regenerated**. The Group N component edits are therefore *unaccompanied* by refreshed baselines, which is the opposite risk posture from what doc 04 implied.

### 1.3 Under-registration: doc 04's groups enumerated 98 of 99

Each of the 99 real-change paths was `grep -F`'d against doc 04. Result: **98 found, 1 missing.**

```
MISSING: apps/merchant-control-plane/src/app/globals.css
total missing: 1

$ git diff HEAD --numstat -- apps/merchant-control-plane/src/app/globals.css
271     73      apps/merchant-control-plane/src/app/globals.css
```

**Added to doc 04 as Group P**, with a description written from the actual diff hunks (matching that document's stated method). The change re-themes the merchant admin shell: the sidebar rail flips from light lavender `rgb(244 242 254)` to dark ink `rgb(44 38 66)`, and ~56 hardcoded violet literals (`rgba(139, 92, 246, …)`) are routed through four new `--lb-color-primary*` tokens via `color-mix(in srgb, …)`, with `--lb-color-primary` defined as `var(--sidebar-bg)`.

**Why the omission mattered:** `apps/merchant-control-plane` is a **canonical V1 runtime**, not a frozen surface, and this is a `--lb-*` design-token consolidation — precisely the class of change the design-system ratchet governs. By total line delta (344) it is the **5th-largest of all 99 diffs** — verified by sorting the 99 numstat rows — and it went unregistered.

**Note:** doc 03 §10's aggregate "74 textual V1-relevant" was **already correct** and already included this file (99 − 13 developer-portal − 12 mobile = 74; mobile = 11 under `apps/mobile/**` plus root `pubspec.lock`). Only doc 04's per-file enumeration was short. That was re-verified rather than assumed.

### 1.4 Doc 13 §1: arithmetic error and a conflation

Doc 13 §1 states the tree has **6,826** paths, then lists buckets summing to **7,603**:

```
6,785 + 777 + 10 + 31 = 7,603 ≠ 6,826
```

Three independent defects:

1. **Conflation.** `6,785` is the raw porcelain `M` count — *all* modified tracked paths — placed in a slot doc 13's own label reserves for files with *"zero content difference"*. The true zero-line-delta subset is **6,018**. Content-changed files were counted twice: once inside 6,785, again in the 777 bucket.
2. **The 777 is refuted** (see 1.1).
3. **The `10` bucket is not disjoint** from the content bucket — the 10 intent-to-add SQL files carry real content and are already inside the 99.

**Corrected decomposition (reconciles exactly):**

| Bucket | Count |
|---|---:|
| Mode-only / zero-content tracked paths (6,018 textual `0 0` + 678 binary identical-blob) | **6,696** |
| Tracked files with real content change | **89** |
| Intent-to-add new files with real content (subset of "real content", broken out for visibility) | **10** |
| Untracked | **31** |
| **Total** | **6,826** ✓ |

Cross-checks, all EXECUTED: 6,696 + 89 + 10 = **6,795** = `git diff HEAD --numstat | wc -l` ✓ · 89 + 10 = **99** ✓ · porcelain `M` = 6,018 + 678 + 89 = **6,785** ✓ · 6,795 + 31 = 6,826 ✓.

Doc 13's load-bearing conclusion is **unaffected**: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `supabase/config.toml` each return `0 0`, so its dependency analysis is still valid against committed `ee371182` content.

### 1.5 Doc 01: porcelain v1/v2 mislabel (cosmetic — and materially a non-issue)

Doc 01's header credited the `6825` dirty-path count to `git status --porcelain=v1`; it came from Agent B's `--porcelain=v2` run (doc 03 §1 says `=v2` explicitly). Corrected.

**Material impact: none, and this was verified rather than assumed.** Without `--branch`, both forms emit exactly one line per path:

```
$ git status --porcelain=v1 | wc -l  → 6826
$ git status --porcelain=v2 | wc -l  → 6826
```

(`--porcelain=v2 --branch` emits 6830 — four header lines — which is the only way the two could have diverged, and it was not used.)

**On 6825 vs 6826:** docs 01 and 03 recorded `6825`; current is `6826`. The delta is **one additional untracked path** (30 → 31) that appeared while Wave 0 agents wrote concurrently into `docs/launch/`. The tracked-diff count is identical then and now: `git diff HEAD --numstat | wc -l` → **6795**.

### 1.6 The brief's claim that the stash hazard is "not in any prior doc" — REFUTED

The correction brief characterised the two stashes as a *"NEW HAZARD, not in any prior doc"*. **That is not true and is corrected here rather than repeated.**

`16_DIRTY_WORKTREE_PRESERVATION_RECORD.md` §8.1 and its risk row **E4** already document both stashes, `stash@{0}`'s 28-file overlap, and the "third body of uncommitted work" framing. `15_BASELINE_DECISION_RECORD.md` §3.2 and §3.3 independently adjudicate `stash@{0}` as a non-baseline-candidate and flag `git stash drop`/`clear` as an irrecoverable-loss risk.

What §2 below adds is **new measurement**, not the discovery: the per-file delta comparison between stash and dirty tree, the 9-vs-19 split, and the money-surface content of the stash-only 19 — none of which appears in doc 16 or doc 15.

**One small error in doc 16 is noted for the record** (not edited, as doc 16 is outside this correction's scope): its §8.1 correctly says *4 migrations*; its summary bullet at line 24 says *5 migrations*. The verified figure is **4** (migrations `100`, `109`, `111`, `142`) plus `database/supabase/config.toml`, which is likely where the miscount came from.

---

## 2. Hazard A — two stashes, one of them a third divergent body of live work

**Read-only inspection only.** The commands run were `git stash list`, `git stash show --stat|--name-only|--numstat`, `git stash show --include-untracked --stat`, `git rev-parse`, `git log -1`, `git merge-base --is-ancestor`, `git rev-list --count`. **No `git stash pop`, `apply`, `drop`, `clear`, `branch`, or `push` was run, and none may be.**

```
$ git stash list
stash@{0}: On stepup/main: inf-ext
stash@{1}: On stream/letbuyy-ui-v2: branch-consolidation-local-artifacts
```

| | `stash@{0}` | `stash@{1}` |
|---|---|---|
| Object SHA | `b85eeb03e89cbf20ce5a8bf3894d7a203b7ec3e9` | `4d73cfe4b5dfcb21a0e760b795f8a204fb708c33` |
| Created | 2026-06-14 21:40:13 +0530 | 2026-06-08 22:32:43 +0530 |
| Based on | `122ed174` — **53 commits behind** baseline `ee371182` | `17152bbe` (on `stream/letbuyy-ui-v2`) |
| Ancestor of `ee371182`? | **No** — unreachable from the baseline | No |
| Tracked diff | **28 files, +1,128 / −1,203** | **empty** |
| Untracked payload | — | **10 files, +214** (a `.~lock…xlsx#` file, 8 visual-regression failure PNGs, and `apps/storefront-runtime/src/middleware.ts.bak` at +213) |

### 2.1 `stash@{0}` overlaps the dirty tree completely — and diverges from it on 9 files

**All 28** of `stash@{0}`'s paths are also dirty in the working tree right now (`comm -12` against the 6,826-path dirty set → 28). The set splits in two:

**(a) 9 files that carry a *different* real content diff in each place.** Two incompatible uncommitted versions of the same file exist:

| Path | Δ in `stash@{0}` | Δ in dirty tree |
|---|---:|---:|
| `apps/identity-platform/src/app/onboarding/page.tsx` | +144 / −659 | +4 / −4 |
| `apps/merchant-control-plane/src/app/globals.css` | +301 / −323 | +271 / −73 |
| `packages/typescript/ui/src/app-shell.tsx` | +117 / −35 | +132 / −42 |
| `apps/merchant-control-plane/src/components/merchantNavigation.ts` | +23 / −21 | +64 / −35 |
| `apps/merchant-control-plane/src/components/AdminShell.tsx` | +38 / −29 | +13 / −5 |
| `apps/identity-platform/src/app/select/page.tsx` | +33 / −48 | +2 / −2 |
| `packages/typescript/ui/src/tokens.ts` | +15 / −7 | +9 / −0 |
| `apps/identity-platform/src/app/api/auth/create-store/route.ts` | +12 / −6 | +2 / −2 |
| `packages/typescript/ui/src/navigation/app-navigation.tsx` | +8 / −1 | +17 / −5 |

`globals.css` is the file doc 04 forgot entirely (§1.3) — and it is simultaneously the file with the largest stash-vs-worktree divergence. Applying the stash would conflict with, or silently overwrite, the working-tree version of all nine.

**(b) 19 files where the stash is the *only* place the edit exists.** In the dirty tree these 19 are mode-only / zero-diff, so this work exists nowhere else — not in the working tree, not in the baseline, not on the integration branch:

| Path | Δ in `stash@{0}` | Note |
|---|---:|---|
| `database/supabase/migrations/109_orders_money_width.sql` | +10 / −0 | **edits an already-committed migration on the money surface** |
| `database/supabase/migrations/111_customer_credentials_source_of_truth.sql` | +3 / −0 | **already-committed migration, credentials surface** |
| `database/supabase/migrations/100_app_discovery_foundation.sql` | +2 / −2 | **already-committed migration** |
| `database/supabase/migrations/142_executable_payment_sessions.sql` | +1 / −1 | **already-committed migration, payments surface** |
| `services/api-gateway/src/middleware/idempotency.ts` | +7 / −2 | idempotency middleware — money-path adjacent |
| `services/api-gateway/src/routes/auth.ts` | +1 / −0 | gateway auth route |
| `services/mobile-bff/wrangler.toml` | +0 / −3 | **deletion-only** worker config change |
| `services/queue-workers/wrangler.toml` | +0 / −3 | **deletion-only** worker config change |
| `services/webhook-service/wrangler.toml` | +0 / −3 | **deletion-only** worker config change |
| `apps/identity-platform/src/app/globals.css` | +388 / −51 | |
| `apps/merchant-control-plane/src/components/HeaderBar.tsx` | +10 / −2 | |
| `apps/identity-platform/src/components/AuthIcon.tsx` | +6 / −0 | |
| `apps/identity-platform/src/lib/auth/cookies.ts` | +3 / −1 | session cookie handling |
| `database/supabase/config.toml` | +1 / −1 | |
| `apps/identity-platform/src/app/layout.tsx` | +1 / −1 | |
| `apps/platform-console/package.json` | +1 / −1 | |
| `apps/storefront-runtime/package.json` | +1 / −1 | |
| `apps/app-marketplace/next-env.d.ts` | +1 / −1 | |
| `apps/developer-portal/next-env.d.ts` | +1 / −1 | |

### 2.2 Plain statement of the hazard

- **A third divergent body of uncommitted work exists.** Alongside (i) the dirty working tree and (ii) the Codex integration worktrees, `stash@{0}` is a third, older, *incompatible* version of live files — including four **already-committed** database migrations (money, payments, credentials), gateway idempotency and auth code, and three `wrangler.toml` worker configs whose stashed change is **deletion-only**.
- **It is unreachable from the baseline.** `git merge-base --is-ancestor stash@{0} HEAD` → false. Its base `122ed174` is 53 commits behind `ee371182`, so replaying it is a rebase, not a fast-forward.
- **It is destructible.** `git stash drop` / `git stash clear`, and eventual reflog expiry, would destroy it irrecoverably. It is not protected by any tag or branch.
- **Modifying committed migrations is a governance concern in its own right.** Migrations `100/109/111/142` are already applied at baseline (124/124 migrations apply cleanly on the isolated local stack per `22_LOCAL_STACK_EXECUTION_EVIDENCE.md`). A stash that rewrites them would break migration immutability if applied. **Not adjudicated here** — flagged for a human/ARB decision.
- **`stash@{1}` is low-value but non-empty:** its tracked diff is empty; its payload is 10 untracked files — a stale editor lock file, 8 visual-regression failure screenshots, and `apps/storefront-runtime/src/middleware.ts.bak` (213 lines). A `.bak` of storefront middleware is worth a glance before anyone discards it.

**Required posture:** document only. **No stash command beyond `list`/`show` may be run in the original tree.** If the work is wanted, the safe first step is a human-approved `git tag` on `b85eeb03` so it survives reflog expiry — recommended, **not performed here**.

---

## 3. Hazard B — the intent-to-add empty-blob trap is still armed

### 3.1 The state (EXECUTED against the original tree)

Ten SQL files sit in the index holding git's **empty blob** `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` while holding real content on disk — the signature of `git add -N` / `git add --intent-to-add`:

| Path | index blob | worktree blob | bytes | lines |
|---|---|---|---:|---:|
| `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` | `e69de29b` | `1afa0aa1` | 6,250 | 109 |
| `database/supabase/migrations/197_letbuyy_core_first_class_theme.sql` | `e69de29b` | `3bd7daf9` | 19,974 | 350 |
| `database/supabase/rollback/180_urban_kicks_liquid_theme.rollback.sql` | `e69de29b` | `dd42ecaa` | 3,119 | 60 |
| `database/supabase/rollback/181_urban_kicks_settings_schema_complete.rollback.sql` | `e69de29b` | `e680de3b` | 885 | 16 |
| `database/supabase/rollback/188_letbuyy_core_theme_row.rollback.sql` | `e69de29b` | `39d6346c` | 2,325 | 46 |
| `database/supabase/rollback/189_theme_persistence_idempotency.rollback.sql` | `e69de29b` | `8f2302bf` | 776 | 14 |
| `database/supabase/rollback/190_theme_library_q.rollback.sql` | `e69de29b` | `f25780d4` | 1,875 | 47 |
| `database/supabase/rollback/191_theme_purchases_rls_tenant_scope.rollback.sql` | `e69de29b` | `a53fe4a0` | 1,711 | 26 |
| `database/supabase/rollback/196_theme_rls_tenant_hardening.rollback.sql` | `e69de29b` | `af67900b` | 3,253 | 55 |
| `database/supabase/rollback/197_letbuyy_core_first_class_theme.rollback.sql` | `e69de29b` | `1db06a0f` | 3,761 | 66 |
| **Total** | | | **43,929** | **789** |

`git status` shows all ten as `A` ("staged: new file"). `git diff --cached --numstat | wc -l` → **0** — the staged view shows *nothing at all*, so the trap is invisible to the most common pre-commit check.

### 3.2 What actually happens — measured, and it is NOT what doc 03 §4 said

Doc 03 §4 warned that a commit *"would commit them as **zero-byte files**"*. Reproduced in a **throwaway scratch repository** replicating this exact index shape, on `git version 2.50.1 (Apple Git-155)`:

| Operation | Measured result | Verdict |
|---|---|---|
| `git commit` with **other paths staged** | the intent-to-add path is **silently omitted from the commit entirely**; the `.A` index entry **survives** afterwards, so `git status` looks unchanged and nothing signals the loss | ⛔ **worse than zero-byte** |
| `git commit` with **nothing else staged** | refuses — *"Changes not staged for commit"* | ✅ safe |
| `git write-tree` | succeeds; the path is **absent** from the resulting tree | ⛔ silent loss |
| `git archive <tree>` | path absent from the archive | ⛔ silent loss |
| `git checkout-index -a` | writes a **0-byte file** to disk | ⛔ **this is where zero-byte actually occurs** |
| `git stash push` | **fails**: `error: Entry '<path>' not uptodate. Cannot merge. / Cannot save the current worktree state` | ⚠️ stash is currently **blocked** in this tree |
| `git commit -a` | full content committed, byte-exact | ✅ safe |
| `git commit -- <paths>` | full content committed, byte-exact | ✅ safe |
| `git add <paths>` then `git commit` | full content committed, byte-exact | ✅ safe |

### 3.3 Plain statement of the hazard

- **A naive `git commit` in the original tree does not commit zero-byte SQL — it drops all ten files outright.** If anyone stages other work and commits, migrations `196` and `197` and eight rollback scripts (789 lines / 43,929 bytes) will simply not be in the commit, the index entries will still read `A`, and `git status` afterwards will look exactly as it does now. The failure is silent in both directions.
- **Zero-byte SQL is still reachable**, just via a different route: any tooling that materialises the index (`git checkout-index`, export/packaging scripts, some CI checkout paths) writes 0-byte files for all ten. A 0-byte migration that "applies" successfully is the worst possible outcome on a schema surface.
- **The blast radius is the canonical schema surface.** Migration `196` is theme **RLS tenant hardening** — a tenant-isolation control. Losing it while committing code that assumes it is in place produces a silent tenant-isolation regression.
- **`git stash push` is currently blocked** by these entries. This is protective by accident, but it will surprise anyone trying to park work, and it interacts with Hazard A: the tree cannot be stashed while the trap is armed.
- **The safe fix is one command, and it is a human's to run:** `git add database/supabase/migrations/196_*.sql database/supabase/migrations/197_*.sql database/supabase/rollback/*.rollback.sql` **before** any commit — or use `git commit -a` / `git commit -- <paths>`. **Not performed here**; this agent ran no `git add` and no `git commit` in the original tree.

---

## 4. Documents changed by this correction pass

| Document | Change |
|---|---|
| `01_AUTHORITY_AND_ARCHITECTURE_BASELINE.md` | Correction notice + inline `[CORRECTED]`: porcelain v1/v2 label; re-measured counts; 6825→6826 timing note |
| `03_WORKTREE_CHANGE_CLASSIFICATION.md` | Correction notice + inline markers in §2 (bucket table), §4 (zero-byte claim refuted), §10 (777→99, 6,018→6,696, binary term withdrawn, 98-of-99 note) |
| `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` | Correction notice; header claim corrected; binary-section premise refuted; **theme-marketplace finding retracted**; "re-baselined" inference withdrawn; **Group P added** (`apps/merchant-control-plane/src/app/globals.css`, +271/−73) so the register sums to 99; Summary-counts table superseded with a corrected, reconciling table |
| `13_REPRODUCIBILITY_AND_TOOLCHAIN_BASELINE.md` | Correction notice + inline markers on all four §1 bullets; corrected decomposition table; stash cross-reference added |
| `14_INDEPENDENT_REVIEW_AND_FALSIFICATION.md` | **Not in the original correction scope — added after a grep showed it still asserts 777 as fact.** Correction notice + inline markers on the three rows that certified "99 textual + 678 binary = 777" as **CONFIRMED**. That verdict is withdrawn; the pass re-ran the same `awk` that produced the error, which verifies transcription, not inference. Its doc-13 arithmetic finding (7,603 ≠ 6,826) is confirmed and stands. |
| `19_CI_REPAIR_AND_BRANCH_PROTECTION_EVIDENCE.md` | **Not in the original correction scope — added for the same reason.** One inline `[CORRECTED]` at the "777 real uncommitted content changes" reference (line ~367). The paragraph's argument about the tenant-table registry is unaffected. |
| `30_CORRECTIONS_AND_STASH_HAZARD.md` | **New** — this document |

**Already carrying the correction independently, and not modified:** `16_DIRTY_WORKTREE_PRESERVATION_RECORD.md` (§3, risk row E2/E4) and `24_WAVE_0_FAILURE_AND_BLOCKER_REGISTER.md` (FBR-36, already RETRACTED). Verified by grep — both state the 99 figure and the theme-marketplace retraction correctly.

No other Wave 0 document was modified. No source file, config file, workflow, migration, or governance document was modified.

---

## 5. What this pass could not establish

1. **Why 6,696 file modes flipped.** Doc 03's filesystem-copy hypothesis is plausible and consistent with the repo path (`.../Copy/Letbuyy_Store`), but git cannot prove it. Unchanged from doc 03's own caveat.
2. **Whether any of the 99 changes is correct.** No build, typecheck, lint, test, or validator was run by this agent. Doc 23's baseline stands on its own measurements.
3. **Whether the stashed work is wanted.** Not adjudicated. Requires a human/ARB decision.
4. **How `git stash pop`/`apply` would actually resolve against the 9 divergent files.** Establishing that requires running the operation, which is forbidden here. The divergence is proven from the numstats; the merge outcome is not.
5. **Whether other Wave 0 documents inherited the 777 figure indirectly.** All 27 Wave 0 documents were grepped for the literal strings `777` and `678`; that surfaced docs 14 and 19, which were corrected, and confirmed docs 16 and 24 already carry the correction. A figure **paraphrased** without either literal string ("the ~780 changed files", "the binary asset churn") would not have been caught by this method.
6. **Whether the intent-to-add behaviour holds on other git versions.** §3.2 is measured on `git 2.50.1 (Apple Git-155)` only. Older git releases are documented to behave differently (some error on `write-tree`), so a contributor on a different git may see a different failure mode — possibly the literal zero-byte commit doc 03 originally described.

---

## 6. Verified figures — quick reference

| Figure | Value | Superseded value |
|---|---:|---|
| Dirty paths (`git status --porcelain \| wc -l`) | **6,826** | 6,825 (timing) |
| Tracked diff rows (`git diff HEAD --numstat \| wc -l`) | **6,795** | — |
| **Real content changes** | **99** | ~~777~~ |
| — of which already tracked | 89 | — |
| — of which intent-to-add | 10 | — |
| — of which binary | **0** | ~~678~~ |
| Mode-only / zero-content paths | **6,696** | ~~6,018~~ |
| — textual `0 0` | 6,018 | — |
| — binary identical-blob `100644→100755` | 678 | — |
| Untracked | **31** | 30 (timing) |
| Line delta | **+6,496 / −1,344** | unchanged |
| Real content changes under `apps/theme-marketplace/` | **0** | ~~36~~ |
| Paths enumerated by doc 04 groups | **99** (was 98) | 98 |
| Stashes | **2** | — |
| `stash@{0}` files | **28** (+1,128 / −1,203) | — |
| — divergent in both stash and dirty tree | 9 | — |
| — existing only in the stash | 19 | — |
| `stash@{1}` files | **10**, untracked-only (+214) | 0 |
| Intent-to-add files armed | **10** (789 lines / 43,929 bytes) | — |
