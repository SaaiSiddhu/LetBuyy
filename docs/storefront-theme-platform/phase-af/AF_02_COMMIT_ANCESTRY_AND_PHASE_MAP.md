# AF_02 — Commit Ancestry & B→AE Phase Reconstruction

**Status:** VERIFIED_CURRENT  
**Workstream:** AF-B (read-only git only)  
**Agent:** Claude Sonnet 4.6 (subagent), AF.0 discovery fleet  
**Evidence timestamp:** 2026-07-17 IST  
**Branch:** `stepup/main` · **HEAD:** `80d0b1af653411aeb024b4d7f4a3e0eb06f09198`  
**Mode:** REPOSITORY EVIDENCE BEATS DOCUMENTATION — every claim below is directly verified against current on-disk git history.

---

## 0. Executive summary

All 14 explicitly-named SHAs (B, C, D, E, F, G, H, I, J, K, L, M, AC, AE) **exist as commit objects** and are **ancestors of current HEAD**. The chain is a **strict linear sequence with no merge commits** (all 32 commits have exactly 1 parent). HEAD (`80d0b1af`) is the AE/export head — confirmed both as current HEAD and as the same object. No squashes or amendments detected (one benign no-op `reset: moving to HEAD` in reflog at 7654927d/AC). No reports are written before their owning code commits. One structural anomaly is noted: Phase V splits across 3 commits rather than 1. All key protective invariants (ART-17 Liquid flag, ART-22 frozen apps, ART-08/09 RLS, ART-10 money ledger) survived the B→AE run as verified by current on-disk source.

---

## 1. Identity & HEAD confirmation

| Claim | Verified value | Command |
|-------|----------------|---------|
| Current HEAD | `80d0b1af653411aeb024b4d7f4a3e0eb06f09198` | `git rev-parse HEAD` |
| Claimed AE SHA | `80d0b1af` | task assignment |
| HEAD == claimed AE | **YES** — same object | `git rev-parse HEAD` == `git rev-parse 80d0b1af` |
| HEAD is AE/export head | **YES** — commit message: "Phase AE" | `git log --oneline -1 HEAD` |
| Branch | `stepup/main` (not detached) | `git branch --show-current` |
| HEAD ancestor of itself | **YES** (`--is-ancestor HEAD HEAD`) | trivially true |

---

## 2. Complete B→AE phase table

**Verification method for each row:**
- `exists`: `git cat-file -t <sha>` == `commit`
- `ancestor_of_HEAD`: `git merge-base --is-ancestor <sha> HEAD` exits 0
- `parent_chain`: verified via `git log --format="%H %P" 93419c58^..80d0b1af`
- `scope_match`: commit subject line verified against claimed phase label

### 2.1 Phases B through L (named in commit messages)

| Phase | Claimed SHA | Full SHA | Exists | Ancestor of HEAD | Commit timestamp (IST) | Commit subject | Scope match | Verdict |
|-------|------------|----------|--------|-----------------|----------------------|----------------|-------------|---------|
| B | `93419c58` | `93419c58bf8929c9dd66eb28975e9183fb512ffa` | YES | YES | 2026-07-04 06:18 | `phase-b(certification): architecture certification of storefront/Liquid discovery corpus` | MATCH — architecture cert | VERIFIED_CURRENT |
| C | `be56a6fd` | `be56a6fd392979d5eeb4202833b4c3cbd5ee0206` | YES | YES | 2026-07-04 07:29 | `phase-c(storefront): critical platform fixes - Liquid crash recovery, React fallback, Urban Kicks leak, newsletter alias, postMessage hardening` | MATCH | VERIFIED_CURRENT |
| D | `4546f27b` | `4546f27b84327a55696984750cfd6d1b18ba54a1` | YES | YES | 2026-07-04 08:23 | `phase-d(storefront): data completeness - linklists, settings parity, drops, fonts, search, hero, registration no-JS` | MATCH | VERIFIED_CURRENT |
| E | `7b111a94` | `7b111a94ed4b60ae01270a9a3aaa11e459ea6a35` | YES | YES | 2026-07-04 09:41 | `phase-e(storefront): template completion - blog, article, CMS page, 404, password, routes parity, login no-JS` | MATCH | VERIFIED_CURRENT |
| F | `51d9dd74` | `51d9dd74129db33a8e668acf5f038b6f8c26ab0c` | YES | YES | 2026-07-05 13:25 | `phase-f(storefront): performance engineering - parse cache, parallel sections, chrome seam, password/logout hardening` | MATCH | VERIFIED_CURRENT |
| G | `7cdd42a1` | `7cdd42a16d77d0ce991c0602071faedf0d4ddffc` | YES | YES | 2026-07-10 10:29 | `phase-g(storefront): schema governance - migration engine wired, version gate, canonicalization, letbuyy-core row, experience validation` | MATCH | VERIFIED_CURRENT |
| H | `06d3cc85` | `06d3cc858b3f637365eb31ae52fd66dce7571a3b` | YES | YES | 2026-07-10 11:28 | `phase-h(storefront): developer platform - theme SDK, compiler/validator/linter/packager, .liquid artifact exporter, CLI, examples, docs` | MATCH | VERIFIED_CURRENT |
| I | `dbcf173a` | `dbcf173a91d2b3e14440ce1924a9c2f17ee84a01` | YES | YES | 2026-07-10 12:25 | `phase-i(storefront): enterprise QA - a11y/security/SSR-hydration/regression coverage + honest infra-bound catalog + real bug fix` | MATCH | VERIFIED_CURRENT |
| J | `77a5872f` | `77a5872f41b8ad042258edadd42d64426216b445` | YES | YES | 2026-07-10 13:38 | `phase-j(storefront): production rollout prep - ARB package, phased canary ramp, rollback runbook, observability design, release notes (PLANNING ONLY)` | MATCH — docs/planning only | VERIFIED_CURRENT |
| K | `b71b93bf` | `b71b93bf49782bd015a09a42aed943023210c5e7` | YES | YES | 2026-07-10 14:13 | `phase-k(storefront): theme platform - versioning/compatibility, upgrade planning, install validation, publish manifest, analytics contract (marketplace stays frozen)` | MATCH | VERIFIED_CURRENT |
| L | `8c1ac94b` | `8c1ac94b2b2938c05fdbdb1c03051a7fd0f256f0` | YES | YES | 2026-07-10 15:30 | `phase-l(storefront): AI theme platform - deterministic validated generative primitives + merchant AI SDK; model boundary NOT-CONNECTED` | MATCH | VERIFIED_CURRENT |

### 2.2 Phases M through AE (M→AE program — 21 commits for 19 phases, Phase V has 3 commits)

**Important structural note:** MEMORY.md claims "one verified commit each." This is STALE for Phase V, which spans 3 commits. All other phases have exactly 1 commit.

| Phase | SHA(s) | Timestamp(s) (IST) | Commit subject | Docs directory | Scope match | Verdict |
|-------|--------|--------------------|----------------|----------------|-------------|---------|
| M | `ff6720a9` | 2026-07-10 17:38 | `docs(theme): certify repository truth and Shopify parity baseline` | `PHASE_M_*.md` files at root level (no phase-m/ dir) | MATCH — discovery/cert commit, no source edits, confirms B-L as verified ancestors of `8c1ac94b` | VERIFIED_CURRENT |
| N | `bf8a0c34` | 2026-07-10 18:33 | `feat(theme-engine): introduce canonical theme document v2` | `phase-n/` | MATCH | VERIFIED_CURRENT |
| O | `80f797b1` | 2026-07-10 19:41 | `feat(theme): upgrade presets into complete merchant experiences` | `phase-o/` | MATCH | VERIFIED_CURRENT |
| P | `1053d611` | 2026-07-10 20:44 | `feat(theme): add tenant-safe drafts revisions publishing and rollback` | `phase-p/` | MATCH | VERIFIED_CURRENT |
| Q | `a0990ce7` | 2026-07-10 22:17 | `feat(theme): add merchant theme library workspace` | `phase-q/` | MATCH | VERIFIED_CURRENT |
| R | `ddd975b7` | 2026-07-10 23:18 | `feat(theme): add editor conflict dialog and accessible section tree panel` | `phase-r/` | MATCH | VERIFIED_CURRENT |
| S | `955b6355` | 2026-07-11 00:13 | `feat(theme): add secure live preview inspector (click/hover/scroll bridge)` | `phase-s/` | MATCH | VERIFIED_CURRENT |
| T | `0c5c6322` | 2026-07-11 01:26 | `feat(theme): implement depth-bounded nested block children and section groups` | `phase-t/` | MATCH | VERIFIED_CURRENT |
| U | `45df4ae3` | 2026-07-11 02:16 | `feat(theme): complete Shopify-parity setting control renderer` | `phase-u/` | MATCH | VERIFIED_CURRENT |
| V | `8de31807` (Lane-B) · `44497fbd` (Lane-A) · `94a2e359` (docs) | 02:34 / 02:54 / 03:10 | V-LaneB: TemplateSwitcherPanel + useTemplateSwitcher; V-LaneA: template registry + hardening; V-docs: Phase V template-system reports and template reference | `phase-v/` | MATCH — **3 commits, not 1** (subagents committed code independently, orchestrator committed docs). Temporal order correct: code before docs. | STRUCTURAL_ONLY (anomaly: 3 commits vs claimed 1, but all 3 are ancestors of HEAD with correct content) |
| W | `7a507bbd` | 2026-07-11 03:55 | `feat(theme): add dynamic sources with tenant-safe resource search and binding` | `phase-w/` | MATCH | VERIFIED_CURRENT |
| X | `a1ab7f3f` | 2026-07-11 04:53 | `feat(theme): add tenant-safe media library with upload MIME allowlist` | `phase-x/` | MATCH | VERIFIED_CURRENT |
| Y | `2aae6693` | 2026-07-11 05:35 | `feat(theme): add sandboxed theme app-block extension model` | `phase-y/` | MATCH | VERIFIED_CURRENT |
| Z | `c62ed7a8` | 2026-07-11 06:26 | `feat(theme): add markets and localization with India-first defaults` | `phase-z/` | MATCH | VERIFIED_CURRENT |
| AA | `d2262cef` | 2026-07-11 08:07 | `feat(theme): add safe custom-CSS validator with render-time enforcement` | `phase-aa/` | MATCH | VERIFIED_CURRENT |
| AB | `47166838` | 2026-07-11 09:56 | `feat(theme): add safe theme version updates preserving merchant customizations` | `phase-ab/` | MATCH | VERIFIED_CURRENT |
| AC | `7654927d` | 2026-07-11 11:01 | `feat(theme): add deterministic AI theme customization (model boundary NOT-CONNECTED)` | `phase-ac/` | MATCH — claimed SHA `7654927d` confirmed | VERIFIED_CURRENT |
| AD | `9b4ad6fb` | 2026-07-11 11:52 | `docs(theme): Phase AD whole-program certification + ARB canary-readiness package` | `phase-ad/` | MATCH — docs-only, confirms "no flag flip" | VERIFIED_CURRENT |
| AE | `80d0b1af` | 2026-07-11 12:42 | `feat(theme): add marketplace partner-submission validation gate + close theme_purchases RLS (Phase AE)` | `phase-ae/` | MATCH — claimed SHA `80d0b1af` confirmed. IS current HEAD. Includes migration 191 (RLS tightening) | VERIFIED_CURRENT |

---

## 3. Linear chain verification

**Total commits in range B→AE (`93419c58^..80d0b1af`):** 32  
**Phase count (B-L = 11, M-AE = 19):** 30 phases  
**Discrepancy:** +2 commits explained by Phase V having 3 commits (Lane-A, Lane-B, docs)

**No merge commits:** All 32 commits have exactly 1 parent. Verified: `git log --format="%H %P" 93419c58^..80d0b1af | awk '{print NF-2}' | sort -u` → `1` only.

**Parent of Phase B (93419c58):** `57760d0c feat(theme-engine): make Urban Kicks a first-class Liquid theme` — correct baseline; Urban Kicks is first-class theme, not the result of a squash.

**Strictly monotone timestamps:** All 32 commits have increasing commit timestamps. No commit is backdated. Spot-checked:
- Phase B: 2026-07-04 06:18  
- Phase F (gap): 2026-07-05 13:25 (gap of ~1 day between E→F; not a concern — single day gap)  
- Phase G: 2026-07-10 10:29 (gap from F; not a concern — gap between F and G is normal programme scheduling)  
- Phase AE: 2026-07-11 12:42 (the latest)

**Reflog anomaly at AC:** `HEAD@{2}: reset: moving to HEAD` at SHA `7654927d` (Phase AC). This is a **no-op self-reset** (to HEAD itself) — the SHA before and after the reset operation is identical. No amendment took place; AC's commit object was not rewritten. Source: `git reflog show --format="%H %gd %gs" | grep "HEAD@{2}"`.

---

## 4. Report-before-commit analysis

For each phase, the phase discovery/plan/report docs are included in the **same commit** as the code (or, for Phase M, in the Phase M commit which is itself a docs-only commit). No case was found where a phase report document was committed in commit N and the code was committed in commit N+k (future commit).

**Phase V edge case:** The code commits (Lane-A `44497fbd` at 02:54, Lane-B `8de31807` at 02:34) precede the docs commit (`94a2e359` at 03:10). The docs commit body explicitly acknowledges this: "subagents committed the CODE themselves… This commit adds the phase-v/ reports the subagents left uncommitted." Code-before-report ordering is **correct** (not a report-before-commit violation).

---

## 5. High-blast symbol touches in B→AE range

### 5.1 `getSupabaseAdmin`

Appears in diffs of many theme platform commits (`80f797b1`, `1053d611`, `a0990ce7`, `ddd975b7`, `955b6355`, `44497fbd`, `45df4ae3`, `0c5c6322`, `7a507bbd`, `a1ab7f3f`, `2aae6693`, `c62ed7a8`, `d2262cef`, `47166838`, `7654927d`, `80d0b1af`). Command used: `git log --oneline 93419c58^..80d0b1af -S "getSupabaseAdmin"`.

**Assessment:** These are additive route files in `services/api-gateway/src/routes/themes/` that call `getSupabaseAdmin` for tenancy-gated DB access — the same pattern used by all gateway routes. No modification to the `getSupabaseAdmin` function itself was detected in the range; each commit adds a new usage in a new theme sub-route. This is **expected** and does not constitute a change to the high-blast symbol itself.

### 5.2 `create_checkout_order`

Appears in `9b4ad6fb` (AD docs), `47166838` (AB), `d2262cef` (AA), `c62ed7a8` (Z). Command: `git log --oneline 93419c58^..80d0b1af -S "create_checkout_order"`.

**Assessment:** All occurrences are in:
- Documentation files (`.md`) — referencing canonical money RPCs in certification docs (`9b4ad6fb`)
- Test files — **negative assertions** (`doesNotMatch`) confirming theme-engine code does NOT call money RPCs (in `47166838`, `d2262cef`, `c62ed7a8` test suites). Example from AB: `assert.doesNotMatch(src, /create_checkout_order|payment_transactions|confirm_order_payment|payouts/, 'Must not touch money ledger')`.

No TS source file in `services/api-gateway` or `apps/` introduces an actual `rpc('create_checkout_order')` call in these commits. The money ledger was **not modified** by B→AE.

### 5.3 `packages/theme-engine`

Heavily modified across the M→AE program — this is the primary deliverable scope. All changes are in `packages/theme-engine/src/` (new modules: `theme-document.ts`, `theme-marketplace-contract.ts`, `theme-safe-update.ts`, `custom-css-sanitizer.ts`, `theme-locale.ts`, `app-block-model.ts`, `dynamic-source-binding.ts`, `media-library.ts`) and their test files. No changes to money/auth/checkout paths.

### 5.4 `packages/shared-types`

`git log --oneline 93419c58^..80d0b1af -- "packages/shared-types/**"` → **no output**. Shared-types package was not modified in B→AE.

---

## 6. Protected surface audit (invariant verification)

### 6.1 ART-17: Liquid canary flag (VERIFIED_CURRENT)

`packages/theme-engine/src/theme-governance.ts:14`:  
```
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;
```  
Source: `grep -n "THEME_LIQUID_RENDERING_DEFAULT_ENABLED" packages/theme-engine/src/theme-governance.ts`  
**Status: FLAG = false. ART-17 invariant INTACT.**

DOMPurify FORBID lists at `packages/theme-engine/src/theme-renderer.ts:229-230`:  
```
FORBID_ATTR: ['style'],
FORBID_TAGS: ['base', 'embed', 'object', 'script'],
```  
Source: `grep -n "FORBID" packages/theme-engine/src/theme-renderer.ts`  
**Status: LISTS UNCHANGED. ART-17 sanitizer invariant INTACT.**

### 6.2 ART-22: Frozen apps not modified (VERIFIED_CURRENT)

`git log --oneline 93419c58^..80d0b1af -- "apps/app-marketplace/**" "apps/developer-portal/**" "apps/theme-marketplace/**"` → **no output**.  
**Status: FROZEN APPS UNTOUCHED in B→AE.**

### 6.3 ART-08/09: RLS policies (VERIFIED_CURRENT)

**Phase AE (80d0b1af) introduced migration 191** which closes RISK-SEC-001: the pre-existing `USING(true)/WITH CHECK(true)` on `theme_purchases` with no role qualifier (effective to PUBLIC) was replaced with:  
- `TO service_role USING (true) WITH CHECK (true)` — explicit service_role pass-through (gateway pattern, per migration 163). Service_role bypasses RLS anyway; this makes intent explicit.  
- `TO authenticated USING (user_id = auth.uid())` — scoped SELECT.  
- `TO authenticated WITH CHECK (user_id = auth.uid())` — scoped INSERT.  

Verified at `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql:63-91`.  
**Status: No new USING(true)/WITH CHECK(true) to PUBLIC introduced. The one existing wide-open policy was TIGHTENED. ART-08/09 invariant IMPROVED.**

### 6.4 ART-10: Money ledger (VERIFIED_CURRENT)

- No `.from(money_table).insert/update` pattern in theme platform code (negative assertions in test suites across AA/AB/Z confirm this mechanically).  
- `create_checkout_order` appears only in docs and test negative-assertions.  
- Migration 191 explicitly states "does NOT touch purchase amounts, the canonical ledger, checkout, or any payment RPCs."  
**Status: MONEY LEDGER UNTOUCHED in B→AE. ART-10 invariant INTACT.**

### 6.5 ART-05: Identity/JWT issuers

`git log --oneline 93419c58^..80d0b1af -S "ES256|HS256|issueCustomerSession|LETBUYY_IDENTITY"` → **no output**.  
**Status: AUTH ISSUERS NOT TOUCHED in B→AE. ART-05 invariant INTACT.**

---

## 7. Anomalies and findings

| # | Severity | Type | Description | Evidence | Status |
|---|----------|------|-------------|----------|--------|
| 1 | LOW | Structural | Phase V spans 3 commits (`8de31807`, `44497fbd`, `94a2e359`) instead of the 1-per-phase norm; MEMORY.md claim "one verified commit each" is STALE for Phase V | `git log --oneline 8c1ac94b..80d0b1af` shows 3 Phase-V entries; `94a2e359` body documents this explicitly | KNOWN — acknowledged in `94a2e359` commit body; code-before-docs ordering correct; no integrity concern |
| 2 | LOW | Reflog | `HEAD@{2}: reset: moving to HEAD` at `7654927d` (AC) — no-op self-reset; SHA before and after reset is identical | `git reflog show … | grep "HEAD@{2}"` | BENIGN — no amendment, no force-push |
| 3 | INFO | Timestamp gap | Phases F→G have a ~5-day gap (2026-07-05 to 2026-07-10); all other phases are within hours of each other | `git log --format="%H %ai"` | NOT SUSPICIOUS — explains programme scheduling hiatus; ancestry is intact |
| 4 | INFO | Commit count | 32 total commits for 30 phases; documented discrepancy is Phase V's 3 commits | `git log --oneline 93419c58^..80d0b1af | wc -l` = 32 | STRUCTURAL ONLY — not a defect |
| 5 | INFO | validate-governance.mjs | Script contains `fs.rmSync` on `generatedDirectoryNames` (node_modules, .next, .turbo, dist, .cache, .wrangler, .vercel, .symlinks, Pods, build, coverage) — only when `stale-artifact-validator.mjs` runs | `grep -n "rmSync" scripts/validate-governance.mjs` → line 179; `sed -n '155,170p'` for set definition | NOT RUN in AF-B (read-only); these are gitignored generated dirs, not tracked source files; safe-ish to run but not required for this workstream |
| 6 | INFO | Working tree before artifact write | 378 dirty entries (verified pre-write) | `git status --porcelain | wc -l` | AF-B adds exactly 1 file; post-write delta expected = +1 |

---

## 8. Complete ordered phase-to-commit registry

For integrators and AF-B downstream consumers, the authoritative ordered list:

```
Seq  Phase  SHA        Date+Time (IST)      Subject
---- -----  --------   ------------------   -------------------------------------------------------
 1   B      93419c58   2026-07-04 06:18     phase-b(certification): architecture certification
 2   C      be56a6fd   2026-07-04 07:29     phase-c(storefront): critical platform fixes
 3   D      4546f27b   2026-07-04 08:23     phase-d(storefront): data completeness
 4   E      7b111a94   2026-07-04 09:41     phase-e(storefront): template completion
 5   F      51d9dd74   2026-07-05 13:25     phase-f(storefront): performance engineering
 6   G      7cdd42a1   2026-07-10 10:29     phase-g(storefront): schema governance
 7   H      06d3cc85   2026-07-10 11:28     phase-h(storefront): developer platform
 8   I      dbcf173a   2026-07-10 12:25     phase-i(storefront): enterprise QA
 9   J      77a5872f   2026-07-10 13:38     phase-j(storefront): production rollout prep [PLANNING ONLY]
10   K      b71b93bf   2026-07-10 14:13     phase-k(storefront): versioning/compatibility
11   L      8c1ac94b   2026-07-10 15:30     phase-l(storefront): AI theme platform
12   M      ff6720a9   2026-07-10 17:38     docs(theme): certify repository truth [M→AE program start]
13   N      bf8a0c34   2026-07-10 18:33     feat(theme-engine): canonical theme document v2
14   O      80f797b1   2026-07-10 19:41     feat(theme): upgrade presets
15   P      1053d611   2026-07-10 20:44     feat(theme): drafts/revisions/publishing/rollback
16   Q      a0990ce7   2026-07-10 22:17     feat(theme): merchant theme library workspace
17   R      ddd975b7   2026-07-10 23:18     feat(theme): editor conflict dialog + section tree panel
18   S      955b6355   2026-07-11 00:13     feat(theme): secure live preview inspector
19   T      0c5c6322   2026-07-11 01:26     feat(theme): nested block children + section groups
20   U      45df4ae3   2026-07-11 02:16     feat(theme): Shopify-parity setting control renderer
21   V-B    8de31807   2026-07-11 02:34     feat(theme): Phase V Lane-B TemplateSwitcherPanel [V-code-1]
22   V-A    44497fbd   2026-07-11 02:54     feat(theme): Phase V Lane-A template registry + hardening [V-code-2]
23   V-D    94a2e359   2026-07-11 03:10     docs(theme): Phase V template-system reports [V-docs]
24   W      7a507bbd   2026-07-11 03:55     feat(theme): dynamic sources + resource search + binding
25   X      a1ab7f3f   2026-07-11 04:53     feat(theme): tenant-safe media library with upload MIME allowlist
26   Y      2aae6693   2026-07-11 05:35     feat(theme): sandboxed theme app-block extension model
27   Z      c62ed7a8   2026-07-11 06:26     feat(theme): markets and localization with India-first defaults
28   AA     d2262cef   2026-07-11 08:07     feat(theme): safe custom-CSS validator with render-time enforcement
29   AB     47166838   2026-07-11 09:56     feat(theme): safe theme version updates preserving merchant customizations
30   AC     7654927d   2026-07-11 11:01     feat(theme): deterministic AI theme customization [NOT-CONNECTED model boundary]
31   AD     9b4ad6fb   2026-07-11 11:52     docs(theme): Phase AD whole-program certification + ARB canary-readiness package
32   AE     80d0b1af   2026-07-11 12:42     feat(theme): marketplace partner-submission validation gate + close theme_purchases RLS
```

---

## 9. STOP/GO inputs for AF_1 decision

The following AF-B findings are inputs to the AF_12 STOP/GO gate:

1. **GO signal (ancestry clean):** All 14 named SHAs (B, C, D, E, F, G, H, I, J, K, L, M, AC, AE) exist as commit objects, are ancestors of HEAD, and form a strictly linear chain. No merge commits, no force-push rewriting detected. `git merge-base --is-ancestor <sha> HEAD` exits 0 for every named SHA.

2. **GO signal (HEAD is claimed AE/export head):** `80d0b1af` == `git rev-parse HEAD` == `git rev-parse 80d0b1af`. This is both the current HEAD and the export head claimed for the programme.

3. **GO signal (ART-17 / ART-22 / ART-10 / ART-05 invariants intact):** Liquid flag false at `theme-governance.ts:14`; DOMPurify FORBID lists intact at `theme-renderer.ts:229-230`; frozen apps untouched; money ledger untouched; auth issuers untouched. All verified in current on-disk source.

4. **GO signal (RLS tightened, not opened):** Migration 191 (Phase AE) closes the pre-existing HIGH risk (RISK-SEC-001) — replaces wide-open PUBLIC USING(true) with scoped service_role + authenticated policies. Does not introduce any new USING(true)/WITH CHECK(true) to PUBLIC.

5. **KNOWN ANOMALY (LOW, not a STOP):** Phase V spans 3 commits rather than 1. All 3 are ancestors of HEAD in correct temporal order. MEMORY.md claim of "one verified commit each" is stale for Phase V only. No integrity concern.

6. **KNOWN ANOMALY (LOW, not a STOP):** No-op reflog reset at Phase AC SHA; benign.

7. **UNKNOWN — partial:** Phase J is explicitly "PLANNING ONLY" (no flag flip, no source change). Downstream workstreams (AF-C through AF-K) should independently confirm whether Phase J's rollout planning docs accurately reflect current production capability and whether any ARB commitment from Phase J's ARB package has been acted on.

8. **PENDING (mutation-side-effect rule):** `scripts/validate-governance.mjs` was NOT run in AF-B because it is a validator rather than a pure reader; its `stale-artifact-validator.mjs` path calls `fs.rmSync` on generated directories. It is safe to run (only removes gitignored build artifacts, not tracked source), but is PENDING for the human-authorized AF.1 remediation gate to run deliberately.

---

*AF-B read-only discovery agent. No files modified other than this artifact. `git status --porcelain | wc -l` was 378 before this write.*
