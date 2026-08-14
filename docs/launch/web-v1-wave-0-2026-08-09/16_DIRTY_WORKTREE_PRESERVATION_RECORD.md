# 16 — Dirty Working-Tree Preservation Record

**Evidence artifact, not governance authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → the relevant nested `AGENTS.md` → `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`. Nothing in this document creates, amends, or relaxes a rule.

| Field | Value |
|---|---|
| **Repo SHA (HEAD)** | `ee3711829d857e986014c5811bb94d86ebc3d343` |
| **Branch described** | `stepup/main` in the ORIGINAL working tree `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` |
| **Worktree used for code changes** | **None.** This agent made zero code changes. It is read-only with respect to the original tree; it wrote only into the two authorised evidence/deliverable paths. |
| **Date** | 2026-08-09 |
| **Toolchain** | `git version 2.50.1 (Apple Git-155)`, `Python 3.9.6`, Darwin 25.3.0 |
| **Preservation area** | `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/preservation/` (7.7 MB, 214 files = 213 indexed artifacts + the `SHA256SUMS.tsv` index itself) |

**Safety statement.** No `supabase` command of any kind was run. No `git clean`/`stash`/`reset`/`checkout --`/`restore`/`chmod`/`worktree remove` was run. No push, no PR, no deploy. `git status --porcelain=v1 | wc -l` was **6826 before and 6826 after** this agent's entire run — the dirty tree is bit-for-bit as it was found. The preservation directory is already ignored by `.gitignore:74` (`artifacts/local-operational-proof/`), verified with `git check-ignore -v`, so writing it added nothing to the dirty set.

---

## 0. Executive summary — what this record proves, and the two corrections it forces

1. **Every real content change is preserved and reconstructible.** The 99 real content changes were captured as a `git diff --binary` patch set. Applying that patch to a *clean* extraction of `ee371182` reproduces **99/99 files byte-for-byte identical** to the live dirty worktree (SHA-256 compared per file). This is an executed proof, not an assertion — see §5.
2. **CORRECTION 1 (material).** The prior register's headline figure of **777 real content changes (99 textual + 678 binary) is wrong. The true figure is 99.** All 678 "binary content changes" are **mode-only flips misread as content changes**, because `git diff --numstat` prints `-\t-` for *any* binary path in a diff — including one whose only delta is the permission bit. Proven by comparing the git blob hash of every worktree file against its index blob: **678/678 identical**. See §3.
3. **CORRECTION 2 (small but real).** The prior register `04_CONTENT_VS_MODE_CHANGE_REGISTER.md` narrates 98 of the 99 textual changes. **`apps/merchant-control-plane/src/app/globals.css` (+271/−73) is missing from it entirely** — a real, sizeable Web-V1-surface change that was unaccounted for until this pass. See §2.3.
4. **The work is NOT already committed anywhere durable.** All 99 post-image blobs exist in the object database, but *only* because a single Codex CLI turn-diff checkpoint ref holds them — and that ref points at a **tree**, not a commit, and is on no branch. `git log --all --find-object` returns nothing for them. If that ref is pruned and the worktree is cleaned, the work is gone. See §6.
5. **New hazard found: two stashes exist and were not in scope of any prior Wave 0 document.** `stash@{0}` ("On stepup/main: inf-ext") holds **28 further changed files**, overlapping the dirty tree (`AdminShell.tsx`, `merchantNavigation.ts`, `app-shell.tsx`, `tokens.ts`, `identity-platform` onboarding/select/create-store, 5 migrations, 3 `wrangler.toml`). This is a **second uncommitted body of work** nobody has classified. See §8.1.
6. **Three tracked changes have hard dependencies on untracked files.** Committing only the tracked set breaks the build. See §7.2.

---

## 1. Commands executed (all exit 0 unless stated)

```
git rev-parse HEAD                                        -> ee3711829d857e986014c5811bb94d86ebc3d343
git status --porcelain=v1 | wc -l                          -> 6826
git status --porcelain=v2 -z                               (parsed programmatically, NUL-safe)
git diff --numstat -z                                      -> 6795 rows
git diff --cached --numstat                                -> 0 rows
git diff --shortstat                                       -> 6795 files changed, 6496 insertions(+), 1344 deletions(-)
git status --porcelain=v1 --untracked-files=all            -> 123 untracked FILES (31 top-level entries)
git ls-files --stage -- <path>                             (index blob per path)
git hash-object -- <path>                                  (worktree blob per path; NO -w, nothing written)
git cat-file -s e69de29b...                                -> 0        (empty-blob proof)
git diff --binary -- <path>                                (99 per-file patches)
git diff --binary -- <99 paths>                            (combined patch)
git archive ee371182 | tar -x -C <scratch>                 (clean baseline, read-only)
git apply --check <patch>  ; git apply <patch>             (round-trip, exit 0 both)
git rev-list --all --objects                               -> 39870 objects
git for-each-ref                                           (ref inventory)
git stash list                                             -> 2 entries
git stash show --name-only stash@{0}                       -> 28 files
git check-ignore -v artifacts/local-operational-proof/...  -> .gitignore:74
```

**EXECUTED:** every count, hash, classification, patch, and the round-trip apply in §5. **INFERRED:** the *cause* of the 6,696-file permission flip (consistent with a bulk copy/extract into `.../Copy/Letbuyy_Store`, but git cannot prove it) and the *intent* behind any individual author's edit. **UNVERIFIED:** whether any of these changes compile, pass tests, or pass the validator gate — this agent ran no build, no test, and no validator (see §9).

---

## 2. The real-content-change set, recomputed from scratch

### 2.1 Bucket reconciliation (independent recount, not copied)

| Bucket | Count | Definition |
|---|---:|---|
| Tracked paths with any delta (porcelain record type `1`) | 6,795 | |
| — mode-only, text (`numstat 0 0`) | 6,018 | `100644 → 100755`, no content delta |
| — mode-only, binary (`numstat - -`, **blob proven identical**) | 678 | **the 678 previously miscounted as content changes** |
| — **real content change, mode also flipped** | 92 | |
| — **real content change, mode unchanged** | 7 | |
| Renames (record type `2`) | 0 | |
| Unmerged (record type `u`) | 0 | |
| Deletions (any `D` in XY) | 0 | |
| Untracked top-level entries (`?`) | 31 | = 123 files when expanded with `--untracked-files=all` |
| **Total dirty paths** | **6,826** | 6,795 + 31 |

Arithmetic: 6,018 + 678 + 92 + 7 = 6,795 ✓.

> **`REAL CONTENT CHANGES = 99`** (92 + 7). **`MODE-ONLY NOISE = 6,696`** (6,018 + 678) — 98.5% of the tracked dirty set.

The untracked count moved 30 → 31 versus doc `03` because this Wave 0 workflow's own `docs/launch/` directory now exists. That is the only delta; no other path entered or left the dirty set.

### 2.2 The 10 intent-to-add files, and the exact shape of the trap

All 10 are porcelain-v2 `.A` records (`X='.'`, `Y='A'`), all DB migration/rollback SQL:

```
$ git ls-files --stage -- database/supabase/migrations/196_theme_rls_tenant_hardening.sql
100644 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 0  database/...196_theme_rls_tenant_hardening.sql
$ git cat-file -s e69de29bb2d1d6434b8b29ae775ad8c2e48c5391   -> 0
$ wc -c database/supabase/migrations/196_theme_rls_tenant_hardening.sql -> 6250
```

**The trap, stated precisely (the task brief's phrasing needs one correction):**

- `git diff --cached` shows **nothing** for these 10 (verified: `git diff --cached --numstat` returns 0 rows). A `git commit` *without* `-a` therefore commits **zero-byte files** — 6,250 bytes of migration 196 would be destroyed silently while `git status` reported the file as staged-new.
- **`git diff` (worktree-vs-index) DOES capture their full content** — verified: the patch for 196 opens `new file mode 100644 / index 00000000..1afa0aa1 / @@ -0,0 +1,109 @@` and carries all 109 lines. So the preserved patch set *is* content-complete for these 10.
- The residual risk is **applicability, not capture**: those hunks declare `new file`, so `git apply` fails against any tree where the path already exists in the index as the empty blob. Belt-and-braces was applied anyway.

**Mitigation executed:** all 10 files were additionally copied verbatim to `preservation/intent-to-add-raw/`, each with its worktree byte-count, worktree SHA-256, and the recorded empty index blob, in `MANIFEST.json` → `intent_to_add[]`.

| File | Lines | Bytes on disk | Index blob |
|---|---:|---:|---|
| `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` | 109 | 6,250 | `e69de29b` (EMPTY) |
| `database/supabase/migrations/197_letbuyy_core_first_class_theme.sql` | 350 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/180_urban_kicks_liquid_theme.rollback.sql` | 60 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/181_urban_kicks_settings_schema_complete.rollback.sql` | 16 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/188_letbuyy_core_theme_row.rollback.sql` | 46 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/189_theme_persistence_idempotency.rollback.sql` | 14 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/190_theme_library_q.rollback.sql` | 47 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/191_theme_purchases_rls_tenant_scope.rollback.sql` | 26 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/196_theme_rls_tenant_hardening.rollback.sql` | 55 | — | `e69de29b` (EMPTY) |
| `database/supabase/rollback/197_letbuyy_core_first_class_theme.rollback.sql` | 66 | — | `e69de29b` (EMPTY) |

(Exact per-file bytes and SHA-256 for all 10 are in `MANIFEST.json`; only the first is inlined here to keep this document readable.)

### 2.3 Reconciliation against docs `03` and `04`

| Prior claim | Verdict | Evidence |
|---|---|---|
| 6,825 dirty paths | **Superseded** → 6,826 (`docs/launch/` appeared) | §2.1 |
| 6,018 pure mode-only | **CONFIRMED** for the text subset | §2.1 |
| 770 "mode-flip + content" | **CONFIRMED as a count**, but 678 of them are mode-only | §3 |
| 7 content-only | **CONFIRMED** | §2.1 |
| 10 intent-to-add, empty index blob | **CONFIRMED** | §2.2 |
| 30 untracked | **CONFIRMED at the time**, now 31 | §2.1 |
| 0 renames / 0 deletes / 0 unmerged | **CONFIRMED** | §2.1 |
| 99 textual real changes | **CONFIRMED** | §2.1 |
| **678 binary real content changes** | **REFUTED** — all 678 are mode-only | **§3** |
| **"Total real content changes = 777"** | **REFUTED** — the true figure is **99** | **§3** |
| doc `04` registers every real textual change | **REFUTED** — `apps/merchant-control-plane/src/app/globals.css` (+271/−73) is absent from all 15 groups (A–O sum to 98, not 99); `grep -n "globals.css" 04_...md` returns only the developer-portal line | §2.1 |

---

## 3. The 678 "binary content changes" are mode-only — proof

`git diff --numstat` emits `-\t-` for a binary path **whenever that path appears in the diff at all**, regardless of whether the blob changed. The prior classification joined on numstat and therefore read 678 permission-bit flips as content deltas.

**Decisive test executed** — compare the index blob against `git hash-object` of the on-disk file for all 678:

```
binary numstat rows        : 678
blob IDENTICAL (mode-only) : 678
blob DIFFERENT (real)      : 0
```

**Independent corroboration:**

```
$ git diff -- packages/typescript/ui/assets/fonts
diff --git a/.../geist-mono-latin.woff2 b/.../geist-mono-latin.woff2
old mode 100644
new mode 100755
```
No `@@` hunk, no `GIT binary patch` section, no `Binary files ... differ` line. And across a combined `git diff --binary` over all 777 previously-claimed "real" paths: `grep -c '^GIT binary patch'` = **0**, `grep -c 'Binary files'` = **0**, `grep -c '^literal '` = **0**. A real binary delta cannot produce a `--binary` patch containing none of those.

**Consequence for the task's binary sub-question.** The question "of the 678 binary changes, which are generated artifacts and which are user-authored source?" is **moot** — none of them changed. Nothing needs to be patched, and nothing may be claimed as authored work. For completeness the full per-file evidence is preserved anyway:

- `preservation/BINARY_MODE_ONLY_PROOF.tsv` — 678 rows: `path · index_blob · worktree_git_blob · identical=YES`.
- `preservation/BINARY_CHANGES.tsv` — the same 678 with directory-based provenance labels (334 Storybook/visual-regression baselines under `packages/typescript/ui`, 176 under `artifacts/shopify-ux`, 33 `docs/archive`, 19 `docs/research`, 116 app/public asset candidates), each now carrying `verdict = MODE-ONLY (blob identical) — NOT a content change` in `MANIFEST.json`.

The 36 binaries under the frozen `apps/theme-marketplace/public/previews` that doc `04` flagged as "real change activity inside a frozen surface" are in this set. **That finding is retracted: no content changed there.**

---

## 4. Preserved artifacts (all SHA-256 indexed)

Root: `artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/preservation/`

| Artifact | What it is |
|---|---|
| `patches/NNN__<flattened-path>.patch` | **99 per-file `git diff --binary` patches**, one per real content change, numbered `001`–`099`, path-flattened (`/`→`__`). Includes all 10 intent-to-add files. |
| `REAL_CONTENT_CHANGES_99.binary.patch` | Single combined `git diff --binary` over all 99. **525,394 bytes.** SHA-256 `d3c306dd255ac20c763ee8ab3d9f69098756aa9434f2a15bdcd976fc07c165c1` |
| `REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch` | Same content, with all **82** `old mode 100644 / new mode 100755` line pairs stripped. **Use this one for the port** (see §7.1). SHA-256 `f4f79390e9e99dc8d254ff054e525e7cf343fcdbf5ca09f6698563f42ec35132` |
| `intent-to-add-raw/` | 10 verbatim on-disk copies — the empty-blob trap mitigation (§2.2). |
| `untracked-raw/` | 96 verbatim copies of untracked **source/doc/test** files. |
| `BINARY_MODE_ONLY_PROOF.tsv` | 678-row blob-identity proof (§3). SHA-256 `7e2d96bbe7f5dd5a29280fb958a4de4e822687a6d0ff1aa8fff56719cb18f85d` |
| `BINARY_CHANGES.tsv` | 678-row provenance manifest with per-file SHA-256. |
| `MODE_ONLY_NOISE.txt` | All **6,696** mode-only paths, header explaining the numstat `- -` pitfall. |
| `ROUNDTRIP_PROOF.tsv` | 99 rows: reconstructed SHA-256 vs live-worktree SHA-256 vs `MATCH`. SHA-256 `f031966db6ec2db0a591af55cdbb649401dd6833401bdf0c4a96346fb7b6128a` |
| `DISPOSITION_REGISTER.tsv` | 99 tracked + 123 untracked rows, each with exactly one disposition. SHA-256 `c6d34185a73abdc91c997bb783e4b91dd2b8abd7eaa4e7841550fc6b862cf234` |
| `MANIFEST.json` | Machine-readable manifest: counts, patch index, intent-to-add index, untracked index, binary verdicts, explicit `CORRECTION` field. |
| `SHA256SUMS.tsv` | **The index. 213 artifacts, every one hashed.** SHA-256 of the index itself: `ac6c0cb4114e3d6bd1edc34034095e3d16b1f670dfd405ac6fc8bbdf6cfd0a50` |

### 4.1 Secret exclusion

Every one of the 6,826 dirty paths plus all 123 untracked files was screened against `.env(.|$)`, `*.pem`, `*.key`, `id_rsa`, `*credentials*`, `*secret*`, `*.p12`, `*.jks`, `*keystore*` (with `.example`/`.template`/`.sample` exempted by convention).

- **Zero secret-shaped files appear in any patch or any copied artifact** (`secret_shaped_excluded_paths: []` in `MANIFEST.json`).
- `config/env/production.env.example` and `config/env/staging.env.example` are in the 99 and are templates, not secrets. Their +13/−0 adds **variable NAMES only**: `CONTACT_RESEND_API_KEY`, `CONTACT_RESEND_FROM_EMAIL`, `CONTACT_NOTIFY_EMAIL`, `CONTACT_TEAM_INBOXES`, plus explanatory comments. **No value from these files is reproduced anywhere in this document or in any deliverable.** Values were redacted at inspection time.
- `supabase/config.toml` and `supabase/.gitignore` (untracked) sit in a **production-linked checkout**. They were deliberately **not copied and not read** — path and untracked status recorded only, disposition `HUMAN_REVIEW`.
- Doc `03` §9's finding that 9 real `.env.local` files exist on disk and all 9 are correctly gitignored was re-confirmed structurally; no `.env` file is tracked, none is in the dirty set, none was opened.

---

## 5. Round-trip proof: every real change is reconstructible

This is the core claim of this record, and it was **executed**, not reasoned about.

```
1. git archive ee3711829d857e986014c5811bb94d86ebc3d343 | tar -x -C <scratch>/rt2
   -> 6904 files, a pristine baseline containing NONE of the dirty changes
2. cd <scratch>/rt2 && git apply --check REAL_CONTENT_CHANGES_99.binary.patch   -> exit 0
3. cd <scratch>/rt2 && git apply         REAL_CONTENT_CHANGES_99.binary.patch   -> exit 0
4. For each of the 99 paths: sha256(rt2/<path>) == sha256(LIVE-WORKTREE/<path>)?
   -> 99/99 byte-identical, 0 mismatches
```

Repeated against `REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch` in a second pristine extraction (`rt3`): `--check` exit 0, apply exit 0, **99/99 byte-identical**, and only 2 files left executable — `config/env/production.env.example` and `config/env/staging.env.example`, both of which are **already `100755` at HEAD** (their diff headers read `index 6029ef35..bf4b8d7b 100755`). The plain patch left 84 files executable; the stripped patch leaves the 82 spurious flips behind. Per-row evidence: `ROUNDTRIP_PROOF.tsv`.

**Therefore: no real content change can be lost by this workflow.** Both patches, all 99 per-file patches, the 10 raw intent-to-add copies, and 96 untracked source copies are on disk and hashed.

---

## 6. Where the work currently lives — and why it is *not* safely committed

For all 99 files, `git cat-file -e <worktree-blob>` succeeds — the post-image blobs exist in the object database. That looks reassuring and is not.

```
git log --all --oneline --find-object=<blob>   -> EMPTY for every blob tested
git rev-list --all --objects | grep <blob>     -> 1 hit each
```

The single container is `refs/codex/turn-diffs/checkpoints/<...>/b40e356d-16e9-419c-8021-15d829a498ba` → `f5f783f99b027c2441d434f3586bdbfb14c6c03f`. Two facts about it:

- `git branch -a --contains f5f783f9` → `error: object f5f783f9... is a tree, not a commit`. **It is a bare tree, not a commit.** It has no author, no message, no parent, and is on no branch.
- All **99/99** real-change blobs are inside it (verified by intersecting `git rev-list --objects f5f783f9` — 8,102 objects — with the 99 worktree blob hashes).

This is a Codex CLI turn-diff snapshot: an editor-tool implementation detail. It is not a commit, not pushed, not reviewable, and disappears when the tool prunes its checkpoints.

**Conclusion: zero of the 99 real content changes are "already in a commit."** Every one of them depends on (a) the dirty working tree staying untouched, or (b) the patch set produced by this pass. That is precisely why the patches exist.

Branch context re-confirmed (consistent with doc `02`): `stepup/main` = `ee371182`; `origin/stepup/main` = `8d9dda77` (17 unpushed local commits); `main` and `origin/main`/`origin/develop` = `41b6ea49`; five Wave 0 worktree branches and `codex/emergency-appbridge-killswitch` all sit at `ee371182`.

---

## 7. Disposition of every real change

Full per-file register: `preservation/DISPOSITION_REGISTER.tsv` (99 tracked rows + 123 untracked rows). Every path carries exactly one disposition.

### 7.1 The 99 tracked real content changes

| Disposition | Count |
|---|---:|
| `PORT_TO_WEB_V1` | **62** |
| `PRESERVE_OUTSIDE_WEB_V1` | **25** |
| `HUMAN_REVIEW` | **12** |
| `REWORK_LATER` | 0 |
| `REJECT` | 0 |

| Group | Files | Disposition | Rationale |
|---|---:|---|---|
| A — `EXECUTION_LEDGER.md`, `LAUNCH_READINESS_2026_06_12/000_LAUNCH_READINESS_INDEX.md` | 2 | **HUMAN_REVIEW** | Both **assert a mobile V1.1 deferral**. The index diff literally reads: *"Re-tests the prior `V1_SCOPE_LOCK_2026_06_12` mobile-as-V2 classification and **upholds it**, restated as V1.1 gated on four named items."* This contradicts **HUMAN DECISION 1** (mobile = `HUMAN_DECISION_REQUIRED`, not deferred) and the governance chain: `AGENTS.md:79` lists `apps/mobile/merchant-app` in the canonical topology with no V1 split, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md:99` (row 28, Mobile) marks it **CANONICAL**. No ARB amendment authorising a deferral was found. **Must not be ported as written.** The ledger row additionally narrates the App-Bridge gating and so overlaps the separate `codex/emergency-appbridge-killswitch` escalation. |
| B — `apps/developer-portal/**` | 13 | **PRESERVE_OUTSIDE_WEB_V1** | Frozen surface (`CLAUDE.md` frozen-runtime policy; root `AGENTS.md`). Not a deploy target, not Web V1 scope. Preserved as patches `003`–`015`. |
| C — `apps/identity-platform` URL helpers + 3 consumers | 4 | **PORT_TO_WEB_V1** | Removes banned `letbuyy.store` literals — **DEPLOY-R3** (`AGENTS.md:332`). Verified in §8. |
| D — `apps/marketing-site/src/app/[locale]/contact/page.tsx` | 1 | **PORT_TO_WEB_V1** | Web V1 marketing surface; coheres with tip commits `4ac324e7`/`ee371182`. |
| E — `apps/merchant-control-plane/**` (incl. the previously-unregistered `globals.css`) | 13 | **PORT_TO_WEB_V1** | Core Web V1 runtime. `next.config.ts` checked for false-green hazards: **no `ignoreBuildErrors`, no `ignoreDuringBuilds`** — it adds `devIndicators:false`, `serverExternalPackages:['jsdom']`, and a `NormalModuleReplacementPlugin` for `node:crypto`. |
| F — `apps/mobile/merchant-app/**` + `pubspec.lock` | 12 | **PRESERVE_OUTSIDE_WEB_V1** | **HUMAN DECISION 1.** Preserved as patches `034`–`045` and never merged into the Web V1 integration branch. Classified `HUMAN_DECISION_REQUIRED` at the capability level; **not** "MOBILE_V1_1", **not** "deferred". |
| G — `apps/storefront-runtime/**` | 3 | **PORT_TO_WEB_V1** | Fail-closed access-mode hardening (`SEC-R1` cited in the code comment) + build config. |
| H — `config/env/{production,staging}.env.example` | 2 | **PORT_TO_WEB_V1** | Template only, variable NAMES only (§4.1). Provisioning real `CONTACT_*` values is a human/ops action. |
| I — `database/supabase/migrations/196,197` + 8 rollbacks | 10 | **HUMAN_REVIEW** | Schema **and RLS** changes in a checkout whose `supabase/.temp` points at production. The Constitution requires ARB for RLS/schema. Committing the SQL files is reviewable; **applying them is forbidden to every agent in this workflow.** Also open: six rollbacks (180/181/188/189/190/191) are being added *retroactively* for already-committed migrations, which implies rollback-integrity was previously unmet or unmeasured. |
| J — `packages/theme-engine/src` + tests | 11 | **PORT_TO_WEB_V1** | Shared package. **Depends on an untracked file** — see §7.2. |
| K — `packages/theme-engine/examples/**` fixtures | 12 | **PORT_TO_WEB_V1** | Bundle/manifest/settings for both example themes. **Depends on 8 untracked files** — see §7.2. |
| L — `services/api-gateway/**` | 8 | **PORT_TO_WEB_V1** | Includes the tenant registry regeneration and the `stores.ts` security + `sites.published` work (§8). |
| M — `packages/infrastructure/resend-adapter`, `packages/shared-types` | 2 | **PORT_TO_WEB_V1** | `shared-types/src/index.ts` adds `export * from './contact'`; `contact.ts` is **already tracked** — no dangling dependency here. |
| N — `packages/typescript/ui/**` | 4 | **PORT_TO_WEB_V1** | Shared `@letbuyy/ui`; feeds Groups B and E. Note UI-R7/design-system ratchet interaction is **UNVERIFIED** here (no validator run). |
| O — `tests/executable/foundation-wave1-money-postgres.test.mjs`, `tests/governance/foundation-wave3-production-safety.test.ts` | 2 | **PORT_TO_WEB_V1** | Gate correctness fixes; directly relevant to the Wave 0 validator/test lane (§8). |

**Porting instruction.** Use `REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch` and apply only the `PORT_TO_WEB_V1` subset. Applying the plain patch would carry **82 spurious `100644→100755` flips** into the Web V1 branch and permanently commit the very noise Wave 0 is trying to isolate.

### 7.2 The 123 untracked files — and three dependency breaks

| Disposition | Files |
|---|---:|
| `PORT_TO_WEB_V1` | 76 |
| `PRESERVE_OUTSIDE_WEB_V1` | 25 |
| `HUMAN_REVIEW` | 20 |
| `REJECT` | 3 |

- **`REJECT` (3, generated):** `artifacts/letbuyy-theme-system-current-state.zip`, `.zip.sha256`, `tools/central-intelligence/package-lock.json`. Must not be committed.
- **`HUMAN_REVIEW` (20):** the 18-document `LAUNCH_READINESS_2026_06_12/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/` package (asserts the mobile V1.1 deferral — same conflict as Group A), plus `supabase/config.toml` and `supabase/.gitignore` (production-linked; path recorded only, contents never read).
- **`PRESERVE_OUTSIDE_WEB_V1` (25):** 7 frozen `apps/developer-portal/**` (`PortalShell.tsx`, `navigation.ts`, 5 `public/` assets), 2 mobile (`lib/config/v1_capability_policy.dart`, `test/v1_capability_policy_test.dart`), and this workflow's own 15 `docs/launch/` files.
- **`PORT_TO_WEB_V1` (76):** 8 theme-engine fixture sections/templates, `theme-library-schemas.ts`, 5 new tests, `node-crypto-client-stub.ts`, 3 merchant-control-plane activation assets, and 53 discovery/theme-state documentation files.

**Atomic-set breakages — committing only the tracked changes breaks the build:**

| Tracked change | Requires (UNTRACKED) | Failure if separated |
|---|---|---|
| `packages/theme-engine/src/index.ts` (+2) adds `export * from './theme-library-schemas'` | `packages/theme-engine/src/theme-library-schemas.ts` | Unresolved module — theme-engine and every consumer fail to build. |
| `apps/mobile/merchant-app/lib/app/routes.dart` imports `../config/v1_capability_policy.dart` | `apps/mobile/merchant-app/lib/config/v1_capability_policy.dart` | Flutter compile error. |
| `apps/storefront-runtime/next.config.ts` resolves `src/lib/webpack/node-crypto-client-stub.ts` | `apps/storefront-runtime/src/lib/webpack/node-crypto-client-stub.ts` | Webpack plugin points at a missing module. |

(The merchant-control-plane equivalent stub `apps/merchant-control-plane/src/lib/webpack/node-crypto-client-stub.ts` **is** already tracked — checked, not assumed.)

---

## 8. Independent re-verification of the ~8 claimed audit fixes

Each was re-derived from the **actual diff**, not from the ledger prose. Two of the eight claims are materially incomplete as stated.

### Fix 1 — Tenant table registry 261 → 265 · `services/api-gateway/src/tenant/tenant-tables.registry.ts` (+59/−5)
- **Still exists:** yes. **Verified count:** `git show HEAD:<file> | grep -c '^    "table":'` → **261**; worktree → **265**. Exactly as claimed.
- **New rows:** `founding_merchant_allocations` (176), `site_domain_verifications` (185), `site_domains` (185), `subscription_coupon_redemptions`. Plus `sourceFiles` back-fills on `customer_credentials` (111), `outbox_events` (179), `sites` (176/182/187), and a generator-timestamp bump `2026-06-10T23:05:38Z` → `2026-08-08T18:51:06Z`.
- **Correct:** structurally yes — it is a header-declared generated file (`GENERATED by scripts/generators/generate-tenant-table-registry.mjs … Do not hand-edit`), and the added tables cite the exact migrations that introduced them.
- **Governance:** multi-tenancy/RLS surface; `getSupabaseAdmin`-class blast radius. **Web V1 relevance: HIGH** — unregistered tenant tables are an isolation gap.
- **Test evidence: NONE OBSERVED by this agent.** The ledger claims `tenant-isolation 1→0`; **UNVERIFIED** — no validator was run here. **Also unverified:** that re-running the generator reproduces this file byte-for-byte (the honest check for a generated artifact). → `PORT_TO_WEB_V1`, with generator re-run required before merge.

### Fix 2 — Wave 1 money test fixture · `tests/executable/foundation-wave1-money-postgres.test.mjs` (+8/−0)
- **Still exists:** yes. Adds `CREATE TABLE public.store_customers (…store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE…)` inside `resetDatabase()`.
- **Correct:** consistent with the claim that migration 142 FKs to `store_customers`, so the fixture could never satisfy the FK. **Web V1 relevance: HIGH** (money lane).
- **Test evidence: NOT RUN.** Requires live Postgres; out of scope for this read-only agent. → `PORT_TO_WEB_V1`, **UNVERIFIED**.

### Fix 3 — Wave 3 `.com` assertion · `tests/governance/foundation-wave3-production-safety.test.ts` (+6/−1)
- **Still exists:** yes. Flips `assert.match(source, /… = 'letbuyy\.store'/)` → `'letbuyy\.com'`, with an inline comment citing **DEPLOY-R3** and **ANTI-R3**.
- **Correct:** yes, and independently corroborated — all four files the test reads now declare `letbuyy.com`: `apps/marketing-site/src/lib/public-urls.ts:14`, `apps/theme-marketplace/src/lib/public-urls.ts:8`, `apps/app-marketplace/src/lib/site-url.ts:19`, `apps/developer-portal/src/lib/site-url.ts:6`. The old assertion **demanded the banned literal** — a textbook ANTI-R3 governance-theater defect (`AGENTS.md:316`), and it contradicted the test's own name.
- **Open observation (not a blocker):** two of the four files the test reaches into live in **frozen** surfaces (`theme-marketplace`, `app-marketplace`). A Web V1 governance test coupling itself to frozen apps is worth a design call.
- **Test evidence: NOT RUN.** → `PORT_TO_WEB_V1`, **UNVERIFIED**.

### Fix 4 — Identity URL helpers remove `.store` literals · 4 files (+32/−8)
- **Still exists:** yes. `urls.ts` adds `DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com'` plus `getPlatformRootDomain()` / `getStorefrontHost()` / `getStorefrontUrl()`, each env-overridable via `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` / `PLATFORM_ROOT_DOMAIN` (names only).
- **Literals actually removed — 3 observed, not 5:** `create-store/route.ts` (``https://${normalizedSubdomain}.letbuyy.store`` → `getStorefrontUrl(...)`), `select/page.tsx` (`{store.subdomain}.letbuyy.store` → `getStorefrontHost(...)`), and `onboarding/page.tsx` (+4/−4, two call sites). **The ledger's "5 literals" is not reproducible from the diff at ±1 precision** — depending on whether the two `onboarding` sites count as one or two, the diff supports 3–4. Recorded as a minor overstatement, not a defect.
- **Correct:** yes, and materially so — the previous code shipped a **dead store URL to every newly onboarded merchant**. **Web V1 relevance: HIGH** (merchant onboarding path). **DEPLOY-R3.**
- **Residual:** a `reservedFutureIssuerHost: 'id.letbuyy.store'` string survives in `apps/storefront-runtime/.next/server/chunks/4898.js` — a **generated build artifact**, not source; the source origin was not located in this pass and is **UNVERIFIED**. `com.letbuyy.store` iOS bundle identifiers are **not** DEPLOY-R3 violations (they are reverse-DNS app IDs, not domains). → `PORT_TO_WEB_V1`.

### Fix 5 — Flutter Material-ancestor / ink-splash defect · 6 mobile screens
- **Still exists:** yes. The canonical instance, `post_editor_screen.dart`, wraps `SwitchListTile` in `Material(type: MaterialType.transparency, …)` with the comment *"The tile needs its own Material ancestor: it paints ink splashes on the nearest Material, and the decorated card above would hide them."* **4** such `Material(` wraps were added across `lib/screens/`.
- `login_screen.dart` additionally fixes a **real typed-route bug**: `Navigator.pushNamed<String>` was failing the internal `as Route<String>?` cast because the shared route factory builds `MaterialPageRoute<dynamic>`; the fix pushes untyped and casts the result. It also migrates hard-coded `Color(0xFFEF4444)`/`14`/`13` to `AppThemeColors`/`LetbuyySpacingTokens`/`LetbuyyTypographyTokens` — a **design-token compliance** improvement, which is more than "a test fix".
- **Naming correction:** the fix is a *Material ancestor* fix, not "a Flutter Material ancestor **test**". The ledger's "fixed 5 failing Flutter widget tests" is a claim about test outcomes; **no Flutter test was run by this agent — UNVERIFIED.**
- → `PRESERVE_OUTSIDE_WEB_V1` (HUMAN DECISION 1).

### Fix 6 — `sites.published` written on publish/unpublish · `services/api-gateway/src/routes/stores.ts` (+73/−19)
- **Still exists:** yes, and the claim **understates the diff by a wide margin.** This one file contains four distinct changes:
  1. **`sites.published` lockstep.** `POST /:id/publish` now writes `published: true`; `PATCH /:id` now writes `updates.published = (updates.status === 'published')` whenever status changes — which is what covers *unpublish* (there is **no separate `/unpublish` route**; `grep -n unpublish stores.ts` → no match). **Independently corroborated:** `apps/storefront-runtime/src/proxy.ts:380-381` gates on `site.published && site.status === 'published'`, and `:392` denies on `!site.published`; `database/supabase/migrations/090_custom_domains_and_store_access.sql:10` declares `published boolean NOT NULL DEFAULT false` with an index at `:34`. A column with readers, an index, and no writer — the merchant admin reported "live" while the storefront denied every request. **This is a genuine, high-severity Web V1 bug fix.**
  2. **PostgREST raw-filter hardening (SECURITY).** Nine `.or(\`custom_user_id.eq.${id},user_id.eq.${id}\`)` interpolations replaced by `ownedByCustomUserFilter()`, which double-quotes and backslash-escapes the value. `.or()` takes a **raw** filter string that postgrest-js does not quote, so an interpolated value carrying `,` or `(` rewrites the predicate. Today the value is a uuid, so this is defence-in-depth — but it is a **tenant-ownership predicate**, the highest-consequence place to leave that pattern.
  3. **Handle resolution correctness + safety.** `GET /handle/:handle` moves from `.or(store_name.eq.${handle},subdomain.eq.${handle})` to `.eq('subdomain', handle)` — parameter-encoded, and single-valued (`subdomain` is NOT NULL + UNIQUE), fixing a case where one handle could select two owned rows and fail `maybeSingle()`.
  4. **Fail-closed uniqueness probe.** Store creation now probes `subdomain` and `store_name` separately via `.eq(...).maybeSingle()` and returns **503 `SUBDOMAIN_CHECK_UNAVAILABLE`** if either probe errors, instead of falling through to race the UNIQUE index into an opaque 500. Comment cites **SEC-R1**.
- **Governance:** multi-tenancy + `verifySiteOwnership` surface. **Web V1 relevance: CRITICAL.** **Test evidence: NONE OBSERVED** — the untracked `services/api-gateway/src/__tests__/storefront-handle-resolution.test.ts` appears to target item 3 but **was not executed**. → `PORT_TO_WEB_V1`, and this file warrants a dedicated security review on the way in.

### Fix 7 — Android `INTERNET` hardening · `apps/mobile/merchant-app/android/app/src/main/AndroidManifest.xml` (+8/−0)
- **Still exists:** yes. Adds `<uses-permission android:name="android.permission.INTERNET" />` to `src/main` with a comment stating `src/debug` and `src/profile` already declared it and that release was inheriting it **transitively from a plugin's library manifest**.
- **Correct:** the change is sound and low-risk. But the justification ("verified by a release manifest-merge diff") is **self-reported inside the diff itself — no merged manifest was produced or inspected by this agent. UNVERIFIED.** The ledger's own framing is honest here: the original S0 was **REFUTED**, and this is hardening, not a defect fix.
- → `PRESERVE_OUTSIDE_WEB_V1` (HUMAN DECISION 1).

### Fix 8 — Mobile V1 capability policy · `lib/app/routes.dart` (+33/−1) + untracked `lib/config/v1_capability_policy.dart` (127 lines) + `test/v1_capability_policy_test.dart` (143 lines)
- **Still exists:** yes. Every route resolves through `AppRoutes.generateRoute`, which now consults `V1CapabilityPolicy.availabilityFor(spec.id)` and substitutes `_gatedPage()` when unavailable — so the screen is **never constructed** and cannot issue requests as a routing side effect. The rationale (91 routes, 36 `/features/*` aliases, 31 screens reachable from 2–3 paths, app marketplace from 3 — so hiding nav entries hides nothing) is coherent.
- **Dependency check:** `../widgets/shared/capability_gate.dart` **exists and is already tracked** (committed in `c50d4d59`). `v1_capability_policy.dart` is **untracked** → atomic-set dependency (§7.2).
- **ESCALATION — do not action in this workflow.** `_forbidden` gates `AppRouteId.apps`, `AppRouteId.featureAppMarketplace`, and `AppRouteId.featureEmbeddedAppBridge`, citing ART-16/ART-22/NEVER-R3/R-12. **This directly overlaps the separate urgent App-Bridge security task on `codex/emergency-appbridge-killswitch`.** Per the standing instruction, no App-Bridge / app-store / marketplace code was touched, read for modification, or ported here. Recorded as an open cross-workflow escalation only.
- **Also note:** `v1_capability_policy.dart` cites `LAUNCH_READINESS_2026_06_12/MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09/05_V1_SCOPE_FREEZE_AND_EXCLUSIONS.md` as its **scope authority** — a document classified `HUMAN_REVIEW` in §7.2 precisely because it asserts the deferral HUMAN DECISION 1 forbids. The policy's `_deferred` map therefore rests on contested authority. `_forbidden` rests on the Constitution and does not.
- **Test evidence:** 143 lines of tests exist on disk; **not executed. UNVERIFIED.**
- → `PRESERVE_OUTSIDE_WEB_V1`.

### 8.1 New hazard: two stashes, never classified by any Wave 0 document

```
$ git stash list
stash@{0}: On stepup/main: inf-ext
stash@{1}: On stream/letbuyy-ui-v2: branch-consolidation-local-artifacts
```

`stash@{0}` holds **28 changed files** and materially overlaps the dirty tree — `apps/identity-platform/src/app/{api/auth/create-store/route.ts,onboarding/page.tsx,select/page.tsx,globals.css,layout.tsx}`, `apps/merchant-control-plane/src/components/{AdminShell.tsx,HeaderBar.tsx,merchantNavigation.ts}`, `apps/merchant-control-plane/src/app/globals.css`, `packages/typescript/ui/src/{app-shell.tsx,navigation/app-navigation.tsx,tokens.ts}`, `services/api-gateway/src/{middleware/idempotency.ts,routes/auth.ts}`, `database/supabase/config.toml`, 4 migrations (100/109/111/142), and `services/{mobile-bff,queue-workers,webhook-service}/wrangler.toml`. `stash@{1}` reports 0 files under `git stash show` (index/untracked-only content, not inspected further).

This is a **third body of uncommitted work**, distinct from the working tree and from the Codex checkpoint tree, containing an *older, divergent* version of files that are also dirty right now. **No stash operation was performed** (`pop`/`apply`/`drop`/`branch` are all forbidden here). Flagged for human decision; out of this record's scope, which is the working tree.

---

## 9. Accounting: no change is unaccounted for

| # | Class | Count | Where it is accounted |
|---|---|---:|---|
| 1 | Already in a durable commit | **0** | §6 — proven: `git log --all --find-object` empty for all 99; the only container is a bare tree on a Codex tool ref. |
| 2 | Preserved as a reviewed patch | **99** | §4 — 99 per-file patches + 2 combined patches; **round-trip proven 99/99 byte-identical** (§5). Every one carries a disposition (§7.1). |
| 3 | Intentionally ported into Web V1 | **62 tracked + 76 untracked** | `PORT_TO_WEB_V1` rows in `DISPOSITION_REGISTER.tsv`. **Not yet executed** — this record authorises and scopes the port; no branch was written. |
| 4 | Intentionally left in the original worktree (never entering Web V1) | **25 tracked + 25 untracked** | `PRESERVE_OUTSIDE_WEB_V1` — mobile (HUMAN DECISION 1) and frozen `developer-portal`. Preserved as patches; original tree untouched. |
| 5 | Explicitly classified generated / mode-only noise | **6,696 mode-only + 3 generated untracked** | `MODE_ONLY_NOISE.txt` (6,696, incl. the 678 proven in `BINARY_MODE_ONLY_PROOF.tsv`); `REJECT` rows for 2 zip artifacts + 1 lockfile. |
| 6 | Held for human decision | **12 tracked + 20 untracked** | `HUMAN_REVIEW` — DB/RLS migrations, the two deferral-asserting governance docs, the 18-doc readiness package, `supabase/` local config. |
| 7 | Secret-shaped, path-only | **0 in any artifact** | §4.1 — nothing secret-shaped entered a patch or a copy; 2 untracked `supabase/` paths recorded by path/status only. |

**Reconciliation:** 99 tracked real content changes = 62 + 25 + 12 ✓. 123 untracked files = 76 + 25 + 20 + 3 (the 25 `PRESERVE_OUTSIDE_WEB_V1` includes this workflow's own 15 `docs/launch/` files) ✓. 6,795 tracked dirty paths = 6,696 mode-only + 99 real ✓. 6,826 total dirty paths = 6,795 + 31 untracked top-level entries ✓.

---

## 10. What remains UNVERIFIED

1. **Every functional claim.** No `pnpm build`, no `pnpm test`, no `flutter test`, no `node scripts/validate-governance.mjs` was run by this agent. Nothing in §8 asserts a fix works — only that the diff exists, is internally coherent, and is corroborated by adjacent source where stated.
2. **The tenant registry is a generated file.** It was not proven that re-running `scripts/generators/generate-tenant-table-registry.mjs` reproduces the worktree file byte-for-byte. Until it does, `261 → 265` is an observed count, not a verified regeneration.
3. **The Android release manifest-merge claim** (Fix 7) is self-reported inside the diff. No merged manifest was produced.
4. **The "5 `letbuyy.store` literals removed" figure** is not reproducible at ±1 from the diff (3–4 observable). Minor overstatement.
5. **The `id.letbuyy.store` string** in `apps/storefront-runtime/.next/server/chunks/4898.js` (a generated build artifact) — its source origin was not located.
6. **`stash@{1}`** contents were not enumerated beyond `git stash show` returning zero files.
7. **Cause of the 6,696-file `644→755` flip.** Consistent with a bulk copy/extract; git cannot prove it and this record does not claim it.
8. **Whether the `PORT_TO_WEB_V1` set applies cleanly onto the Web V1 integration branch.** It was proven to apply onto a clean `ee371182` extraction; that branch is currently also at `ee371182`, so it should — but that was not executed.

## 11. Escalations requiring a human

| # | Item | Why |
|---|---|---|
| E1 | **Doc `04` under-registered a real change.** `apps/merchant-control-plane/src/app/globals.css` (+271/−73) was in no group. | A register that misses a 344-line change on a V1 runtime surface should be re-run, not patched by hand. |
| E2 | **Doc `03`/`04`'s "777 real content changes" is refuted; the true figure is 99.** | Any downstream readiness number derived from 777 is wrong. The "36 binary changes inside frozen `theme-marketplace`" finding is retracted. |
| E3 | **Two governance-adjacent files and an 18-doc package assert a mobile V1/V1.1 deferral** that HUMAN DECISION 1 forbids and that no ARB amendment supports (`AGENTS.md:79`; `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md:99` row 28 = CANONICAL). | Must be resolved before any of that prose is committed or cited as authority. |
| E4 | **`stash@{0}` holds 28 unclassified changed files** overlapping the dirty tree, including 4 migrations and 3 `wrangler.toml`. | A third divergent copy of live work. No stash command was run. |
| E5 | **The mobile V1 capability policy overlaps the App-Bridge emergency task** on `codex/emergency-appbridge-killswitch`. | Two workflows touching the same forbidden surface. Untouched here by instruction. |
| E6 | **Migrations 196/197 touch RLS in a production-linked checkout**, and six rollbacks are being back-filled for already-committed migrations. | ARB required. **No agent in this workflow may apply a migration.** |
| E7 | **The intent-to-add empty-blob trap is still armed in the original tree.** | Any `git commit` without a prior `git add` on those 10 paths destroys ~789 lines of migration/rollback SQL. Mitigated by `intent-to-add-raw/`, but the live tree is still exposed. |
| E8 | **Committing tracked changes without their untracked dependencies breaks three builds** (§7.2). | The port must move each atomic set together. |

---

## 12. Where the evidence lives

```
/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/
  artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/preservation/
    SHA256SUMS.tsv                                   <- 213 artifacts, the index
      sha256(SHA256SUMS.tsv) = ac6c0cb4114e3d6bd1edc34034095e3d16b1f670dfd405ac6fc8bbdf6cfd0a50
    REAL_CONTENT_CHANGES_99.binary.patch
    REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch   <- use this to port
    ROUNDTRIP_PROOF.tsv
    BINARY_MODE_ONLY_PROOF.tsv
    BINARY_CHANGES.tsv
    MODE_ONLY_NOISE.txt
    DISPOSITION_REGISTER.tsv
    MANIFEST.json
    patches/            (99 per-file binary-safe patches)
    intent-to-add-raw/  (10 verbatim copies — empty-blob trap)
    untracked-raw/      (96 verbatim untracked source copies)
```
