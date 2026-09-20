# 03 — Working-Tree Change Classification

> ## ⚠️ CORRECTION NOTICE — applied 2026-08-09 by the Wave 0 Doc Correction agent
>
> **Evidence artifact, not governance authority.** This block was appended after publication. The body below is preserved as originally written except where a `[CORRECTED …]` / `[RETRACTED …]` marker appears inline — history is annotated, not rewritten.
>
> | Field | Value |
> |---|---|
> | Repo | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` (original tree, read-only — no write, no git mutation) |
> | Branch / HEAD | `stepup/main` @ `bf35062eda22f4d881efd61fb1d36c8fc83baed1` |
> | Date | 2026-08-09 |
> | Commands used | `git status --porcelain=v1\|v2`, `git diff HEAD --numstat`, `git diff HEAD --raw`, `git diff HEAD --shortstat`, `git ls-files -s`, `git hash-object`, `git cat-file -s` |
> | EXECUTED vs INFERRED | Every figure in this notice was EXECUTED this session against the original tree and its exit code observed. Nothing is INFERRED. |
>
> ### Correction 1 — REFUTED: "777 real content changes"
>
> **What was wrong.** §10 of this document reports **777** content modifications ("92 textual + 678 binary … = 99 textual total + 678 binary total"). The 678 "binary content changes" are **not content changes at all**. They are pure `100644 → 100755` file-mode flips on files whose blob is byte-identical between index and worktree. `git diff --numstat` prints `- -` for any binary path that appears in a diff *for any reason including a mode-only change*, and this document read `- -` as "the blob changed".
>
> **What it is now.** The true count of real content changes in the dirty working tree is **99**, all textual. There are **zero** binary content changes.
>
> **Evidence (EXECUTED, full set — not a sample).** For each of the 678 binary-marked paths, the index blob SHA (`git ls-files -s`) was compared against the worktree blob SHA (`git hash-object`):
> ```
> binary paths where index blob == worktree blob : 678
> binary paths where blobs DIFFER                : 0
> binary paths missing from disk                 : 0
> ```
> and the mode transition for those same 678 paths is uniform:
> ```
> $ git diff HEAD --raw | awk '{print substr($1,2), $2}' | sort | uniq -c   (restricted to the 678)
>  678 100644 100755
> ```
> **678/678 are mode-only flips with identical content. Proven, not sampled.**
>
> ### Correction 2 — the §4 "commit would produce zero-byte files" claim is REFUTED for git 2.50.1
>
> §4 states that a `git commit` right now "would commit them as **zero-byte files**". A controlled reproduction of the exact intent-to-add index shape (throwaway repo, `git version 2.50.1 (Apple Git-155)`) shows a **different and more dangerous** behaviour: the paths are **silently omitted from the commit entirely**. See the inline `[CORRECTED]` marker in §4 and the full behaviour matrix in `30_CORRECTIONS_AND_STASH_HAZARD.md` §3.
>
> ### Correction 3 — timing note on 6,825 vs 6,826
>
> §1's `6825` was correct when measured. Current measured value is **6826**; the delta is one additional **untracked** path (30 → 31) that appeared while Wave 0 agents wrote concurrently into `docs/launch/`. The tracked-diff count is unchanged: `git diff HEAD --numstat | wc -l` → **6795** then and now.
>
> ### Corrected decomposition of the dirty tree (all EXECUTED this session)
>
> | Bucket | Count | Basis |
> |---|---:|---|
> | Mode-only / zero-content tracked paths | **6,696** | 6,018 textual with `0 0` numstat **+ 678 binary with identical blobs** |
> | Tracked files with real content change | **89** | textual, nonzero numstat, already in the index |
> | Intent-to-add new files with real content | **10** | index holds empty blob `e69de29b`; disk holds 789 lines / 43,929 bytes |
> | Untracked | **31** | `??` in porcelain |
> | **Total** | **6,826** | 6,696 + 89 + 10 + 31 ✓ |
>
> Cross-check: 6,696 + 89 + 10 = **6,795** = `git diff HEAD --numstat | wc -l` ✓. Real content changes = 89 + 10 = **99**, not 777.
>
> **Found by:** Wave 0 Doc Correction agent, by hashing every binary path rather than trusting the `- -` marker. **See:** `30_CORRECTIONS_AND_STASH_HAZARD.md` and the matching notice in `04_CONTENT_VS_MODE_CHANGE_REGISTER.md`.

**Status:** Evidence artifact (NOT governance authority). Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → local `AGENTS.md` → canonical governance rewrite docs.

**Agent:** Agent B — Git and Working-Tree Forensics Auditor, Wave 0 Phase 1, read-only.

**Repo SHA at time of audit (HEAD):** `bf35062eda22f4d881efd61fb1d36c8fc83baed1`
**Branch:** `stepup/main`
**Timestamp used:** 2026-08-09 (literal, per task brief)

**Method:** `git status --porcelain=v2` was parsed programmatically (Python, field-safe against filenames containing spaces — several exist, e.g. `apps/merchant-control-plane/public/Emptystate Illustration/Collections Emptystatae.png`) and cross-joined against `git diff --numstat` by exact path, then bucketed by the `<mode-in-HEAD> <mode-in-index> <mode-in-worktree>` triple and the numstat add/delete counts. Every count below reconciles arithmetically against the raw totals (6,795 tracked-changed paths + 30 untracked paths = 6,825, matching `wc -l` of the full porcelain dump). A representative sample from every bucket was spot-checked with `git diff --stat`/`git diff -- <path>`; the remaining volume in the largest bucket (pure mode-flip) was confirmed by the same programmatic cross-join, not by manual sampling alone, because the join validates every single path, not just a sample.

**What remains unverified:** *Why* the mode bits flipped (external tool, chmod, editor, filesystem-permissions change during a prior session, etc.) is not determinable from git alone and is not claimed here — only the fact and scope of the flip is reported.

---

## 1. Top-level counts (all independently recomputed this session)

```
$ git status --porcelain=v2 | wc -l          → 6825
$ git diff --numstat | wc -l                  → 6795   (tracked, unstaged-vs-index changes)
$ git diff --cached --numstat | wc -l         → 0      (nothing staged beyond intent-to-add placeholders, see §4)
$ git diff --shortstat
  6795 files changed, 6496 insertions(+), 1344 deletions(-)
```
All exit code 0.

Total dirty paths = **6,825** = 6,795 tracked changes + 30 untracked paths. This is close to, but not identical to, the historical brief figure of "~6821 paths" (off by 4 at the time of this independent recount — treat the historical figure as approximate/stale, this document's 6,825 is the current ground truth).

## 2. Primary classification: content vs. mode-only vs. new-file vs. untracked

| Bucket | Count | Definition |
|---|---|---|
| **Pure mode-only change** (no content diff) | **6,018** | Tracked file, mode flipped `100644→100755` in the worktree relative to the index, `git diff --numstat` shows `0 0` (or, for the one edge case below, effectively no line delta) |
| **Mode-flip + real content change** (both at once) | **770** ⚠️ | Tracked file with `100644→100755` mode flip **and** nonzero numstat delta (678 of these are binary — see §3 — 92 are textual).<br>**[CORRECTED 2026-08-09]** This bucket is mis-named. Only **92** of the 770 carry a real content change. The other **678** are binary paths that `git diff --numstat` marks `- -` *purely because their mode flipped* — their index blob and worktree blob are byte-identical (678/678 verified by `git ls-files -s` vs `git hash-object`, zero mismatches). The honest name for this bucket is "mode-flip, 92 of which also changed content". |
| **Content-only change, mode unchanged** | **7** | Tracked file, mode identical in HEAD/index/worktree, real line-level diff present |
| **New tracked file (`git add -N` / intent-to-add)** | **10** | Appear as `.A` in porcelain with `mode(HEAD)=000000, mode(index)=000000, mode(worktree)=100644`; see §4 for the important nuance here |
| **Untracked (new, never `git add`-ed)** | **30** | `?` in porcelain; not in the index at all |
| **Total** | **6,825** | 6,018 + 770 + 7 + 10 (10 is a subset already counted inside "770" numerically — see note) + 30 |

Arithmetic note: the 10 intent-to-add files are **already included** inside the 770-count "mode-flip + content-change" bucket (their `mode(index)=000000 ≠ mode(worktree)=100644` reads as a "mode change," and they carry real new content), not additive on top of it. So: 6,018 (pure mode) + 770 (mode+content, includes the 10 new files) + 7 (content-only) + 30 (untracked) = **6,825**. ✓ reconciles exactly against §1.

Cross-check performed (Python script, full-set not sample):
```
mode_map entries: 6795   content_map entries: 6795   intersection: 6795
mode changed + content changed: 770
mode changed + content SAME (pure mode noise): 6018
mode SAME + content changed (real edits): 7
mode SAME + content SAME: 0
```

## 3. Mode-only bucket detail (6,018 files — 88% of all dirty paths)

Every one of these 6,018 files transitions `100644 (HEAD) → 100644 (index) → 100755 (worktree)` with `0 0` in `git diff --numstat`. Diff spot-check for a random member of this bucket:

```
$ git diff -- packages/typescript/ui/codemods/token-alias-rename.cjs
diff --git a/packages/typescript/ui/codemods/token-alias-rename.cjs b/packages/typescript/ui/codemods/token-alias-rename.cjs
old mode 100644
new mode 100755
```
No `@@` hunk — confirms zero content delta, mode-only.

**This is the dominant signal in the whole working tree**: of 6,914 total tracked files in the repo (`git ls-files | wc -l`), only 62 are executable (`100755`) in the committed index (`git ls-files --stage`), but 6,778 files (6,018 pure-mode + 760 mode+content, see §5) have `100755` in the worktree right now — i.e. **98% of the repository's tracked files have had their permission bit flipped from `644` to `755` in the uncommitted working tree.** This is consistent with a bulk `chmod -R` or an extraction/copy operation on the whole tree (the directory is literally named `.../Copy/Letbuyy_Store`), not with deliberate per-file edits. No functional/semantic significance for any single file; aggregate risk is "noisy diff, easy to hide a real change inside it" (addressed directly in `04_CONTENT_VS_MODE_CHANGE_REGISTER.md`).

## 4. New tracked files via intent-to-add (10 files) — nuance worth flagging

```
$ git status --porcelain=v2 -- database/supabase/migrations/196_theme_rls_tenant_hardening.sql
1 .A N... 000000 000000 100644 0000000000000000000000000000000000000000 0000000000000000000000000000000000000000 database/supabase/migrations/196_theme_rls_tenant_hardening.sql

$ git ls-files --stage -- database/supabase/migrations/196_theme_rls_tenant_hardening.sql
100644 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 0  database/supabase/migrations/196_theme_rls_tenant_hardening.sql
```
`e69de29b…` is git's canonical **empty-blob** hash. The file *is* present in the index (so `git ls-files` lists it, and it is technically "tracked"), but as an empty placeholder — this is the signature of `git add -N` / `git add --intent-to-add`, not a full `git add`. Consequently:
- `git diff --cached` / `--cached --numstat` / `--cached --summary` show **nothing** for these 10 files (confirmed empty, exit 0, see §1).
- `git diff` (unstaged) shows their **entire real content** as new-file insertions (e.g. `109 0 database/supabase/migrations/196_theme_rls_tenant_hardening.sql`).

**Practical implication:** anyone running `git diff --cached` or `git status` casually would see these files as "staged: new file" but a `git commit` right now would commit them as **zero-byte files**, not with their real content, unless a full `git add <path>` is run first. All 10 are database migration/rollback SQL files (V1-relevant, canonical schema surface):

> **[CORRECTED 2026-08-09 — the "zero-byte files" sentence above is REFUTED for the git in use here.]**
> Reproduced on `git version 2.50.1 (Apple Git-155)` in a throwaway repo replicating this exact index shape (`git add -N` → index blob `e69de29b`, real content on disk). Measured behaviour:
>
> | Operation | Actual result on git 2.50.1 | Hazard |
> |---|---|---|
> | `git commit` (other paths staged) | the intent-to-add path is **silently omitted from the commit**; the `.A` index entry survives afterwards, so nothing looks wrong | **Worse than zero-byte.** Migrations 196/197 and 8 rollbacks vanish from the commit while dependent code lands. |
> | `git commit` (nothing else staged) | refuses — "Changes not staged for commit" | safe |
> | `git write-tree` / `git archive` | path absent from the resulting tree | silent loss |
> | `git checkout-index -a` | writes a **0-byte file** to disk | **this is where the zero-byte outcome actually occurs** |
> | `git stash push` | **fails**: `error: Entry '<path>' not uptodate. Cannot merge.` | stash is currently blocked in this tree |
> | `git commit -a` / `git commit -- <paths>` / `git add <paths>` first | full content committed (verified byte-exact) | safe |
>
> So the correct warning is: **a naive `git commit` loses these 10 files outright**, and index-materialising tooling produces zero-byte SQL. Full matrix and commands in `30_CORRECTIONS_AND_STASH_HAZARD.md` §3.

```
database/supabase/migrations/196_theme_rls_tenant_hardening.sql            (109 lines new)
database/supabase/migrations/197_letbuyy_core_first_class_theme.sql        (350 lines new)
database/supabase/rollback/180_urban_kicks_liquid_theme.rollback.sql       (60 lines new)
database/supabase/rollback/181_urban_kicks_settings_schema_complete.rollback.sql (16 lines new)
database/supabase/rollback/188_letbuyy_core_theme_row.rollback.sql         (46 lines new)
database/supabase/rollback/189_theme_persistence_idempotency.rollback.sql  (14 lines new)
database/supabase/rollback/190_theme_library_q.rollback.sql                (47 lines new)
database/supabase/rollback/191_theme_purchases_rls_tenant_scope.rollback.sql (26 lines new)
database/supabase/rollback/196_theme_rls_tenant_hardening.rollback.sql     (55 lines new)
database/supabase/rollback/197_letbuyy_core_first_class_theme.rollback.sql (66 lines new)
```
Migrations 196/197 each have a matching rollback file present (rollback-integrity pattern intact structurally), but migration 197 has **two** rollback candidates on disk pattern-matching it (`188_...rollback.sql` name doesn't match 197 directly — the pairing above is migration-number-to-rollback-number by filename prefix and looks consistent: 196↔196, 197↔197; the 180/181/188/189/190/191 rollbacks correspond to earlier migration numbers not in this dirty set, meaning those migrations were already committed previously and only their rollback files are newly added now). This numbering nuance is flagged for a schema/migration-focused audit agent to verify against the actual committed migration sequence — out of scope for this git-forensics pass beyond flagging it.

## 5. Untracked files (30) — full list and classification

```
$ awk '$1=="?"' git-status-porcelain-v2-full.txt | wc -l
30
```

| Path | Classification |
|---|---|
| `LAUNCH_READINESS_2026_06_12/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/` | V1-relevant (docs) |
| `apps/developer-portal/public/` | **Frozen-surface** (developer-portal is frozen per Constitution/root AGENTS.md) |
| `apps/developer-portal/src/components/PortalShell.tsx` | **Frozen-surface** |
| `apps/developer-portal/src/lib/navigation.ts` | **Frozen-surface** |
| `apps/merchant-control-plane/public/__g3.html` | V1-relevant |
| `apps/merchant-control-plane/public/activation/` | V1-relevant |
| `apps/mobile/merchant-app/lib/config/v1_capability_policy.dart` | **Mobile-only** (V1.1-deferred surface) |
| `apps/mobile/merchant-app/test/v1_capability_policy_test.dart` | **Mobile-only** |
| `apps/storefront-runtime/src/lib/webpack/` | V1-relevant |
| `artifacts/letbuyy-theme-system-current-state.zip` | Generated artifact |
| `artifacts/letbuyy-theme-system-current-state.zip.sha256` | Generated artifact |
| `docs/merchant-system-discovery/` | V1-relevant (docs) |
| `docs/theme-system-current-state/` | V1-relevant (docs) |
| `packages/theme-engine/examples/letbuyy-core-liquid/files/sections/collection-filter.liquid` | V1-relevant (theme-engine) |
| `packages/theme-engine/examples/letbuyy-core-liquid/files/sections/faq-accordion.liquid` | V1-relevant |
| `packages/theme-engine/examples/letbuyy-core-liquid/files/templates/contact.json` | V1-relevant |
| `packages/theme-engine/examples/letbuyy-core-liquid/files/templates/list-collections.json` | V1-relevant |
| `packages/theme-engine/examples/urban-kicks-liquid/files/sections/collection-filter.liquid` | V1-relevant |
| `packages/theme-engine/examples/urban-kicks-liquid/files/sections/faq-accordion.liquid` | V1-relevant |
| `packages/theme-engine/examples/urban-kicks-liquid/files/templates/contact.json` | V1-relevant |
| `packages/theme-engine/examples/urban-kicks-liquid/files/templates/list-collections.json` | V1-relevant |
| `packages/theme-engine/src/theme-library-schemas.ts` | V1-relevant |
| `packages/theme-engine/test/liquid-render-limit-contention.test.ts` | V1-relevant (test) |
| `packages/typescript/ui/src/sidebar-navigation.stories.tsx` | V1-relevant (shared UI) |
| `packages/typescript/ui/tests/components/navigation-linked-parent.test.tsx` | V1-relevant (test) |
| `services/api-gateway/src/__tests__/storefront-handle-resolution.test.ts` | V1-relevant (test) |
| `supabase/.gitignore` | Unrelated/tooling |
| `supabase/config.toml` | Unrelated/tooling (local Supabase CLI config) |
| `tests/security/theme-tenant-isolation.test.mjs` | V1-relevant (test) |
| `tools/central-intelligence/package-lock.json` | Generated artifact (LCIS V2 tooling, not a V1 runtime) |

Untracked totals: 20 V1-relevant, 3 frozen-surface (developer-portal), 2 mobile-only, 5 unrelated/generated-artifact.

**No untracked path touches a deprecated alias** (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`) — confirmed by direct prefix match against the full 6,825-path dirty set, zero hits.

## 6. Reserved/manifest-only topology — touched but not modified

```
$ grep for reserved-service/mobile-app prefixes in the dirty set
apps/mobile/operator-app/AGENTS.md                    0 0  (mode-only)
apps/mobile/operator-app/runtime.manifest.json         0 0  (mode-only)
apps/mobile/shopper-app/AGENTS.md                      0 0  (mode-only)
apps/mobile/shopper-app/runtime.manifest.json          0 0  (mode-only)
services/analytics-pipeline/AGENTS.md                  0 0  (mode-only)
services/analytics-pipeline/runtime.manifest.json      0 0  (mode-only)
services/checkout-runtime/AGENTS.md                    0 0  (mode-only)
services/checkout-runtime/runtime.manifest.json        0 0  (mode-only)
services/event-bus/AGENTS.md                           0 0  (mode-only)
services/event-bus/runtime.manifest.json               0 0  (mode-only)
services/media-service/AGENTS.md                       0 0  (mode-only)
services/media-service/runtime.manifest.json           0 0  (mode-only)
services/notification-service/AGENTS.md                0 0  (mode-only)
services/notification-service/runtime.manifest.json    0 0  (mode-only)
services/search-service/AGENTS.md                      0 0  (mode-only)
services/search-service/runtime.manifest.json          0 0  (mode-only)
```
All 16 hits are the reserved placeholders' own `AGENTS.md`/`runtime.manifest.json` files, and all 16 are **pure mode-only flips (`0 0` in numstat)** — no content was added to any reserved/manifest-only surface. This confirms the reserved-topology freeze was not violated by anything in this working tree.

## 7. Frozen-or-forbidden-surface changes with real content (not just mode)

`apps/developer-portal` (frozen per Constitution/root AGENTS.md — "not a production deploy target") has **13 files with real textual content changes**, not just mode flips (full list and line counts in `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` §2), plus 3 new untracked files (§5 above) and its own `public/` directory newly created. This is a genuine finding: substantive development work is happening inside a frozen surface. It is reported here as fact; whether it is sanctioned (e.g. pre-freeze cleanup, unrelated local exploration) is outside this agent's read-only git-forensics scope and should be escalated to whoever owns the freeze decision.

No content changes were found in `apps/app-marketplace`, `apps/theme-marketplace`, or `apps/platform-operations-portal` (the other three frozen surfaces) — zero dirty paths under any of those three prefixes.

## 8. Rename/delete anomalies

```
$ grep -iE "delete|rename|copy" git-diff-summary-full.txt
 mode change 100644 => 100755 CONVERGENCE_AUDIT_2026_06_10/DELETE_CANDIDATES.md
 mode change 100644 => 100755 apps/marketing-site/src/components/resources/CopyLinkButton.tsx
 mode change 100644 => 100755 apps/merchant-control-plane/src/app/api/themes/[themeId]/rename/route.ts
 ...(4 more, all "mode change" lines whose *filenames* happen to contain the substring "rename"/"DELETE"/"Copy")...

$ grep "^2 " git-status-porcelain-v2-full.txt     (record-type "2" = rename/copy)
(empty)

$ grep "^u " git-status-porcelain-v2-full.txt     (record-type "u" = unmerged/conflict)
(empty)

$ awk '$1=="1"{print $2}' ... | grep -i D          (any XY code containing "D" = deleted)
(empty)

$ git diff --cached | head -5
(empty)
```
**Finding: zero true rename/delete/copy/unmerged anomalies exist in this working tree.** Every "delete"/"rename"/"copy" match in `git diff --summary` is a false positive from a filename substring (e.g. `DELETE_CANDIDATES.md`, a route folder literally named `rename`, a component named `CopyLinkButton.tsx`) on an ordinary mode-change line, not an actual git rename/delete/copy operation. Confirmed via git's own record-type discriminators (`2`=rename/copy, `u`=unmerged), both empty, and via XY-code scan for any `D` (deleted) status, also empty.

## 9. Secret-shaped files — path and tracked/ignored status ONLY (no contents read or reproduced)

Scanned all 6,825 dirty paths against secret-shaped patterns (`.env`, `credentials`, `.pem`, `.key`, `id_rsa`, `service-role`, `secret-matrix`, excluding `.example`/`.template` which are non-secret by convention). 8 candidates found, **all pre-existing tracked source/schema/migration files, all 0/0 mode-only (no content changed)**:

| Path | Tracked/ignored |
|---|---|
| `config/env/schemas/staging-production-secret-matrix.schema.json` | Tracked |
| `config/env/staging-production-secret-matrix.json` | Tracked |
| `database/supabase/migrations/111_customer_credentials_source_of_truth.sql` | Tracked |
| `docs/archive/migrations-history/025_customer_credentials.sql` | Tracked |
| `packages/lcis-adapters/src/shared/credentials.ts` | Tracked |
| `scripts/validators/app-utils-service-role-edge-validator.mjs` | Tracked |
| `scripts/validators/no-blanket-service-role-validator.mjs` | Tracked |
| `tests/contracts/app-utils-service-role-edge.test.ts` | Tracked |

Additionally checked for **actual `.env` files** (not `.example`/`.template`) anywhere in the repo, tracked or untracked/ignored:
```
$ git ls-files | grep -E '\.env(\.|$)' | grep -vE '\.(example|template|sample)$'
(empty — no real .env file is ever committed)

$ git status --ignored --porcelain=v2 | grep -E '\.env(\.|$)' | grep -vE '\.(example|template|sample)'
! apps/app-marketplace/.env.local
! apps/developer-portal/.env.local
! apps/identity-platform/.env.local
! apps/marketing-site/.env.local
! apps/merchant-control-plane/.env.local
! apps/platform-console/.env.local
! apps/platform-operations-portal/.env.local
! apps/storefront-runtime/.env.local
! apps/theme-marketplace/.env.local
```
**Finding: 9 real `.env.local` files exist on disk, one per app, and all 9 are correctly gitignored (`!` = ignored, not tracked, not part of the dirty-path set audited above).** No secret content was read, printed, or copied anywhere in this audit. No secret-shaped file is part of any content change in this working tree.

## 10. Bucket count summary (answers the task's "counts per bucket" requirement)

| Bucket | Count |
|---|---|
| Content modification (real line-level diff, tracked) | ~~777~~ → **99** **[CORRECTED 2026-08-09]**. The original row read "777 (770 mode+content bucket, of which 92 textual + 678 binary, **+ 7** mode-unchanged content-only = 99 textual total + 678 binary total)". The 678 binary paths are **mode-only flips with byte-identical blobs** (678/678 verified) and must not be counted as content changes. Correct total: 92 (textual inside the mode-flip bucket, incl. the 10 intent-to-add) **+ 7** (mode-unchanged content-only) = **99 textual, 0 binary**. |
| File-mode-only modification (no content diff) | ~~6,018~~ → **6,696** **[CORRECTED 2026-08-09]** = 6,018 textual `0 0` + **678 binary identical-blob mode flips** that were previously mis-bucketed as content changes. |
| Generated artifact (untracked) | 5 (`artifacts/*.zip`/`.sha256`, `tools/central-intelligence/package-lock.json`, `supabase/.gitignore`, `supabase/config.toml`) |
| Potential-secret file (path-pattern match) | 8 (all confirmed mode-only, zero content risk) |
| V1-relevant change (textual + binary + untracked, non-mobile, non-frozen) | ~~74 textual + majority of the 678 binary + 20 untracked~~ → **74 textual + 0 binary + 20 untracked** **[CORRECTED 2026-08-09]**. Only the binary term changes: "majority of the 678 binary" is **withdrawn in full** — none of the 678 changed content. The **74 textual figure stands and was re-verified**: 99 − 13 (`apps/developer-portal/**`, frozen) − 12 mobile (11 under `apps/mobile/**` plus root `pubspec.lock`, the Flutter lockfile) = 74. That 74 already includes `apps/merchant-control-plane/src/app/globals.css`, even though `04_...md` failed to enumerate it (see that document's correction notice). |
| Mobile-only change | 12 textual + 2 untracked |
| Frozen-or-forbidden-surface change | 13 textual (developer-portal) + 3 untracked (developer-portal); 0 on deprecated aliases |
| Unrelated user work | 5 untracked (supabase CLI local config, lockfile, generated artifacts) |

See `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` for the individual file-by-file register of every one of the 99 textual real changes plus the 10 new files.

> **[CORRECTED 2026-08-09]** That register enumerates only **98** of the 99. The missing path is `apps/merchant-control-plane/src/app/globals.css` (+271/-73), verified present in `git diff HEAD --numstat` and verified absent from every group A–O of `04_...md` by full-set `grep -F` over all 99 paths (1 missing, 98 found). It is corrected there.

## Raw evidence

`/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/agent-b/git-status-porcelain-v2-full.txt`, `git-diff-numstat-full.txt`, `git-diff-cached-numstat-full.txt`, `git-diff-summary-full.txt`, `git-diff-cached-summary-full.txt`.
