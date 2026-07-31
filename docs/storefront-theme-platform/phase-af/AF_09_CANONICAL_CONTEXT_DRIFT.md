# AF_09 — Canonical Context Brain Drift Report

**Status:** COMPLETE — read-only discovery only; no files modified outside this directory.
**Phase:** AF.0 (Governance Closure + Repository Truth Reset)
**Workstream:** AF-I — Canonical context-brain drift
**Author:** AF.0 discovery agent (claude-sonnet-4-6), read-only
**Evidence pinned at:** `stepup/main` HEAD `7e1441a6` · 2026-07-17
**Git status count before this write:** 378 entries (unchanged after; only `docs/storefront-theme-platform/phase-af/AF_09_CANONICAL_CONTEXT_DRIFT.md` is the new write)

---

## 0. Scope and canonical document set

The prompt names a "context brain" numbering scheme (01-company-and-product.md through 11-glossary.md, PROJECT-INSTRUCTIONS.md). These do not exist. The actual canonical context documents treated as the authority brain are:

| Document | Path | Line count | Dirty? |
|---|---|---|---|
| Constitution (DOC 01) | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` | 471 | NO (clean) |
| Agents rulebook (DOC 02) | `AGENTS.md` | 405 | NO (clean) |
| CLAUDE.md (operating guide) | `CLAUDE.md` | 264 (working tree) / 225 (committed) | **YES — Modified** |
| Programme state | `docs/storefront-theme-platform/PROGRAM_STATE.md` | 288 | NO (clean) |
| Risk register | `docs/storefront-theme-platform/RISK_REGISTER.md` | 647 | NO (clean) |
| Parity matrix | `docs/storefront-theme-platform/SHOPIFY_PARITY_MATRIX.md` | 109 | NO (clean) |

---

## 1. Numbered context brain files — NOT PRESENT

**Claim to verify:** The prompt references a "numbered context brain" (`01-company-and-product.md` through `11-glossary.md`, `PROJECT-INSTRUCTIONS.md`).

**Finding (HISTORICAL_ONLY / NOT_PRESENT):** Exhaustive `find` at all depths outside `*/archive/*` returns no matches for `01-company-and-product.md`, `PROJECT-INSTRUCTIONS.md`, or `11-glossary.md`. No numbered sequential context-brain pattern exists at any non-archive path in the repo. This scheme is either purely historical or was never committed.

```
Evidence: find /Users/saai_sidd/Git/Letbuyy_Store -name "01-company-and-product.md" -not -path "*/archive/*"  → (empty)
          find /Users/saai_sidd/Git/Letbuyy_Store -name "PROJECT-INSTRUCTIONS.md" -not -path "*/archive/*"    → (empty)
          find /Users/saai_sidd/Git/Letbuyy_Store -name "11-glossary.md" -not -path "*/archive/*"            → (empty)
```

**Drift type:** NOT_PRESENT. No superseding correction needed; these docs are not expected to exist.

---

## 2. CLAUDE.md working-tree diff — FOREIGN_WIP governance drift signal

**Finding:** `CLAUDE.md` is **Modified** in the working tree (`git status --porcelain` confirms `M CLAUDE.md`). The committed version is 225 lines; the working-tree version is 264 lines.

**What was added:** 39 lines appended to the end of CLAUDE.md, introducing two new sections:

- `### LCIS V2 — Autonomous Commerce Intelligence Platform (tools/central-intelligence, port :3334)` (lines 227–245)
- `### LCIS V3 — Executive Intelligence (same server :3334, tools/central-intelligence/)` (lines 247–264)

```
Evidence: git -C /Users/saai_sidd/Git/Letbuyy_Store diff HEAD -- CLAUDE.md
Confirmed by: wc -l CLAUDE.md → 264 working tree vs. git show HEAD:CLAUDE.md | wc -l → 225
```

**Authority chain impact:** CLAUDE.md is an operating context document (not the supreme authority, which is the Constitution). But it is the AI/agent context primer read every session. LCIS V2/V3 sections added in the working tree instruct agents to query `:3334` before the repo — extending the law chain beyond what `AGENTS.md` (DOC 02) recognises. DOC 02 does not reference `:3334`, `tools/central-intelligence`, or a V2/V3 LCIS subsystem. This means the working-tree CLAUDE.md and the committed AGENTS.md are **inconsistent** on the "query-first" protocol:

- Committed `AGENTS.md` (DOC 02): "Query graphify/LCIS (:3333) first before any grep/file scan"
- Working-tree `CLAUDE.md`: "Query :3334 (LCIS V2/V3) BEFORE :3333 for semantic recall..."

**Drift type:** FOREIGN_WIP in CLAUDE.md working tree. The LCIS V2/V3 sections belong in the LCIS programme documentation or an operator AGENTS.md addendum, not appended to the shared governance context file without an ARB decision (DOC-R1 / ANTI-R8 from AGENTS.md). The working-tree additions have NOT been committed or reviewed for law-chain authority.

---

## 3. CLAUDE.md claims — topology, validator count, DB counts

### 3.1 Topology (VERIFIED_CURRENT with minor qualification)

CLAUDE.md's "Canonical Runtime Map" lists 10 active entries plus reserved/deprecated entries. This is consistent with `AGENTS.md` §1.1 which names "8 canonical runtimes" + 2 "supporting, non-extractable surfaces" (platform-console + merchant-app). No contradiction.

**Possible drift:** CLAUDE.md lists `apps/theme-marketplace` as "frozen or pending consolidation" but does not mark it in the deprecated policy. `AGENTS.md` ARCH-R10 only lists the explicitly deprecated aliases; theme-marketplace is mentioned in the frozen/ART-22 block in the Constitution. Consistent overall.

### 3.2 "107-validator gate" claim (INTERNALLY CONSISTENT but STALE vs. working tree)

CLAUDE.md line 76: "Keep the 107-validator gate green" and line 92: "107 deterministic validators stay authoritative."

```
Evidence: Count from validate-governance.mjs:
  validators[] array: 106 entries
  reportValidators[]: 1 entry
  Total: 107 (gate=106, report=1)
  → Internally consistent with CLAUDE.md claim at committed HEAD
```

**BUT:** `validate-governance.mjs` is itself **Modified** in the working tree (`M scripts/validate-governance.mjs`). The diff shows `pricing-catalog-validator.mjs` added to the `validators[]` array. If this foreign WIP were committed, the gate count would be 107 (not 106) and the total would be 108. This is **FOREIGN_WIP** in the validator script.

**Drift type:** VERIFIED_CURRENT for the committed state; STALE if foreign WIP is absorbed.

```
Evidence: git -C ... diff HEAD -- scripts/validate-governance.mjs → +  "pricing-catalog-validator.mjs",
```

### 3.3 DB counts in CLAUDE.md (STALE — graphify run was pre-program)

CLAUDE.md line 84 (committed version): `"414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes"`.

These numbers come from a graphify `pnpm graph:db` run stored in `graphify-out/db-intel.json` (gitignored). The current `db-intel.json` shows a different snapshot:

```
Evidence: python3 parse of graphify-out/db-intel.json:
  generatedAt: 2026-06-15T10:40:05Z (before Phase N-AE migrations 171-191)
  tables: 417   (vs CLAUDE.md: 414)
  functions: 164  (vs CLAUDE.md: "156 RPCs")
  policies: 658  (vs CLAUDE.md: 651)
  triggers: 398  (vs CLAUDE.md: 395)
  indexes: 834   (vs CLAUDE.md: 826)
```

Both CLAUDE.md's numbers and the current `db-intel.json` numbers are from different stale graphify runs. The live DB state after migration 191 (Phase AE) is **NOT_CONNECTED** until `pnpm graph:db` is re-run against the live DB.

**Drift type:** STALE (CLAUDE.md) and STALE (db-intel.json, generatedAt 2026-06-15). True current values: NOT_CONNECTED.

---

## 4. AGENTS.md (DOC 02) claims — migration count, test suite refs, appendix caveat

### 4.1 Migration count claims (STALE)

AGENTS.md header (line 7): `"reported stale counts (19 migrations / 237 tables vs the real 91 / 419, max migration 161). AGENTS_V2 replaces it."`

This was the migration state at AGENTS_V2 authoring (2026-06-10). Current repository state:

```
Evidence: ls database/supabase/migrations/ | grep "^[0-9]" | wc -l → 120 tracked migration files
  Highest: 191_theme_purchases_rls_tenant_scope.sql (HEAD commit 7e1441a6)
  Note: 186_v1_scale_commerce_os_coming_soon.sql and 187_v1_sites_site_settings.sql are UNTRACKED
```

**AGENTS.md MIG-R2 (line 156):** `"New migrations MUST be numbered sequentially from the current max (161) — i.e. the next migration is 162."` → STALE. Current max committed is 191; next would be 192. Migration 162 does exist (`162_phase_a_commission_zero.sql`) confirming the SEC-R6 fix landed, but the "next migration is 162" instruction is obsolete.

**AGENTS.md TEST-R10 (line 214):** `"replay 000→161"` → STALE. Should reference 000→191 (current committed max).

**Drift type:** STALE. These are snapshot counts from 2026-06-10; the law (the rules themselves) is not impaired but the specific numbers are misleading to any agent reading them literally.

### 4.2 The "real 91 / 419" assertion (STALE)

The header claims the prior generated AGENTS.md was wrong with "19 migrations / 237 tables" while the truth was "91 / 419." Current reality: 120 tracked migrations (max 191) and ~417 tables per db-intel.json from 2026-06-15. The "419 tables" figure may have been correct at 2026-06-10 authoring but the db-intel.json from 2026-06-15 shows 417 (slight discrepancy; possible table deletions or diff snapshot timing). The constitutional principles are intact but the numbers are STALE.

**Drift type:** STALE (snapshot facts from 2026-06-10).

### 4.3 Appendix B caveat — RESOLVED but still listed

AGENTS.md Appendix B (lines 400-401): `"LETBUYY_CONSTITUTION.md (DOC 01) and LETBUYY_CANONICAL_SYSTEMS.md (DOC 03) are the named authorities above/beside this file; until they physically exist, follow V1+Freeze as the constitution and the STRATEGIC_CANONICALIZATION_2026_06_10/ winner registry (matrix + ADR set) as DOC 03."`

**Current truth:** Both `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (471 lines) and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` physically exist in the committed tree (verified by `ls`). The "until they physically exist" caveat is a **RESOLVED open question** that still appears as an active caveat. An agent reading this appendix today could misinterpret it as still needing the fallback.

**Drift type:** STALE / resolved-but-still-listed. Suggested correction: update Appendix B to say "DOC 01 and DOC 03 are now physically committed at `GOVERNANCE_REWRITE_2026_06_10/`; the V1+Freeze fallback caveat is closed."

### 4.4 "evidence pinned at stepup/main @ 5cf9e64e" (HISTORICAL_ONLY)

Both the Constitution (line 7) and AGENTS.md header (line 9) cite evidence pinned at `5cf9e64e`. Current HEAD is `7e1441a6` (Phase AE commit, 2026-07-11). The pinned SHA is ~30+ commits behind HEAD. This is not a defect (documents are law and don't need to track HEAD), but it is confusing: any agent grepping for the "pinned" commit will not find it at HEAD.

**Drift type:** HISTORICAL_ONLY. No correction needed to the Constitution itself; the evidence pin is a point-in-time marker, not a forward tracking pointer.

---

## 5. PROGRAM_STATE.md claims

### 5.1 "Active risks" section lists RISK-SEC-001 as targeting AE (STALE — FIXED in AE)

PROGRAM_STATE.md line 160 (Active risks): `"RISK-SEC-001 (theme_purchases wide-open RLS, HIGH, → AE)"` — implies it was open and targeting Phase AE.

**Current truth:** Phase AE deliverables section (lines 260-268) explicitly states `"RISK-SEC-001 FIXED"` and describes migration 191 fixing the wide-open RLS. The RISK_REGISTER.md line 8 confirms `"Status: FIXED in Phase AE — Migration 191 committed; ARB-gated for production apply."` The "Active risks" section was not updated when Phase AE completed.

**Drift type:** STALE — resolved-but-still-listed in the "Active risks" section header. The detailed Phase AE section correctly shows it fixed.

### 5.2 "~360 modified/untracked files" (STALE — minor)

PROGRAM_STATE.md line 153 (Foreign WIP): `"~360 modified/untracked files from prior user work."` Current `git status --porcelain | wc -l` → 378 entries. Small discrepancy (~18 more entries). Likely the LCIS package additions and other WIP added after that count was recorded.

**Drift type:** STALE_MINOR. Not operationally significant.

### 5.3 Phase AD gates vs Phase AE gates — storefront-runtime count discrepancy

PROGRAM_STATE.md line 29 (Phase AD certification): `"storefront-runtime 915/915"` but line 35 (Verified baselines): `"storefront-runtime 687/687"` at start of M.

The Phase AE final gate (line 268) also confirms `"storefront-runtime 915/915"`. The progression is consistent across AE close. The Phase AE final gate is the authoritative terminal state.

**Drift type:** NO DRIFT — the baseline (687) and the post-AD/AE state (915) represent different points in time. Consistent.

### 5.4 validate-governance.mjs EXIT=1 claim (VERIFIED_CURRENT per in-programme records)

PROGRAM_STATE.md consistently records `"validate-governance.mjs EXIT=1 (pre-existing tenant drift; anti-fabrication PASS)"` throughout all phases. The mutation-side-effect analysis of validate-governance.mjs confirms it calls `fs.rmSync` on gitignored directories only (node_modules, .next, .turbo, dist, etc. — not tracked files). Running it today was therefore classified as "safe-ish, disclose" per AF.0 rules but was NOT run to avoid deleting build artifacts. The EXIT=1 status is accepted as VERIFIED per in-program attestation from PROGRAM_STATE.md and RISK-GOV-001 in the risk register.

---

## 6. SHOPIFY_PARITY_MATRIX.md — phase-lagged status rows (STALE)

The parity matrix has a 2026-07-10 correction note updating summary counts and acknowledging Phase AC state. However, three capability rows were NOT updated to reflect M→AE phase completions:

| Row | Capability | Matrix Status | Actual Status Post-Program | Phase that Changed It |
|-----|-----------|--------------|---------------------------|----------------------|
| 25 | Media library / asset picker | **MISSING** | Should be **PARTIAL** | Phase X — `MediaLibrary.tsx`, `media-library.ts`, and all 92 X tests committed |
| 36 | Markets / multi-locale content switching | **MISSING** | Should be **PARTIAL** | Phase Z — `TranslationEditorClient.tsx`, `LocaleSwitcher.tsx`, `TranslationKeyList.tsx`, locale engine committed |
| 31 | Release rollback | **NOT_CONNECTED** | Should be **PARTIAL** | Phase AB — `ThemeUpdatePanel.tsx` with rollback button + `ThemeUpdatePanel.tsx` proxy + 93 tests committed |

```
Evidence for row 25: services/api-gateway/src/routes/themes/media-library.ts (Phase X commit)
                      apps/merchant-control-plane/src/components/theme-editor/controls/MediaLibrary.tsx
                      PROGRAM_STATE.md lines 110-124 (Phase X deliverables)

Evidence for row 36: apps/merchant-control-plane/src/components/theme-locale/ (4 new Phase Z files)
                      PROGRAM_STATE.md lines 80-94 (Phase Z deliverables)

Evidence for row 31: apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx
                      apps/merchant-control-plane/src/app/api/themes/[themeId]/update/route.ts (Phase AB)
                      PROGRAM_STATE.md lines 48-64 (Phase AB deliverables)
```

**Consequence for summary counts:** The matrix summary says `MISSING=13, NOT_CONNECTED=4`. Post-program truth is approximately `MISSING≤10, NOT_CONNECTED≤3, PARTIAL≥18` once the three rows above are updated.

**The matrix correctly captures Phase AC state** (AI generator PARTIAL with "deterministic done, NL seam missing" is Phase AC) and properly marks "Rollback UI" as a NOT_CONNECTED seam in the notes column. The row-level statuses for X, Z, and AB were simply not written back.

**Drift type:** STALE — three rows not updated post-program. Summary counts inconsistent with the row evidence.

**The matrix's "External re-verification PENDING" notice** (Shopify-side accuracy) is an open question. No internet access was available to verify current Shopify OS 2.0 features.

---

## 7. LCIS-related claims in CLAUDE.md vs. actual implementation

### 7.1 LCIS V1 "21 docs in docs/lcis-v2/" claim (STALE count)

Working-tree CLAUDE.md line 228: `"Design + ops live in docs/lcis-v2/ (21 docs)"`.

```
Evidence: ls /Users/saai_sidd/Git/Letbuyy_Store/docs/lcis-v2/ | wc -l → 32 files
```

32 files exist (some may be non-markdown). The "21 docs" count is STALE.

**Drift type:** STALE (in the working-tree addition, which is itself FOREIGN_WIP).

### 7.2 LCIS packages — all 19 are UNTRACKED (FOREIGN_WIP)

CLAUDE.md memory (system prompt context) references "22 LCIS pkgs" as complete. Repository state:

```
Evidence: ls /Users/saai_sidd/Git/Letbuyy_Store/packages/ | grep "^lcis-" | wc -l → 19
          git status --porcelain -- packages/ | grep lcis | head -19 → all "?? packages/lcis-*/" (untracked)
```

All 19 `packages/lcis-*` directories are **UNTRACKED** (foreign WIP, not committed). The memory claim of "22 LCIS pkgs" is therefore:
- **FOREIGN_WIP** as a repository fact (19, not 22, and none committed)
- **UNKNOWN** as a test count ("~7,350 tests green") since these packages are not in the committed tree

**Drift type:** FOREIGN_WIP. The LCIS programme work is real but is all uncommitted.

### 7.3 tools/central-intelligence — EXISTS but UNTRACKED (FOREIGN_WIP)

```
Evidence: ls /Users/saai_sidd/Git/Letbuyy_Store/tools/ → central-intelligence  graph-server
          git status --porcelain -- tools/ → ?? tools/central-intelligence/
                                            M  tools/graph-server/index.html
                                            M  tools/graph-server/merchant-intelligence.mjs
                                            M  tools/graph-server/server.mjs
```

`tools/central-intelligence/` exists as an untracked directory. `tools/graph-server/` is tracked but has 3 modified files (foreign WIP). Both are FOREIGN_WIP relative to the committed programme.

---

## 8. Missing ADRs (governance gap)

**Finding:** The Constitution references ADR-001 through ADR-024 from `STRATEGIC_CANONICALIZATION_2026_06_10/FINAL_ARCHITECTURE_DECISION_RECORD.md`. The M→AE theme platform programme (30 phases, July 2026) produced numerous binding decisions — Liquid canary gate criteria, marketplace submission contract, partner readiness safety contract, migration 191 RLS remediation — but **no formal ADR** capturing these decisions has been added to the governance chain.

```
Evidence: ls GOVERNANCE_REWRITE_2026_06_10/ → 8 files, none named "ADR-025" or later
          The newest ADR (ADR-024) was authored at Constitution ratification (2026-06-10)
          Phase AE produced PARTNER_READINESS.md and THEME_PLATFORM_CERTIFICATION.md in
          docs/storefront-theme-platform/phase-ad/ and phase-ae/ — these are programme
          artifacts, not formal ADRs in the governance chain
```

**Drift type:** STRUCTURAL_ONLY (governance chain exists; programme decisions not formalised into it). The decisions exist in programme docs but are not referenced from the Constitution or AGENTS.md.

---

## 9. Incorrect launch-readiness implications

**Finding:** The system-prompt memory includes `"V1 Phase-5 pre-launch checkout/money audit: NO-GO Oct 1 (H2–H9 human seams + CAP-C01..C04 live certs + code-hardening backlog)"` and `"October 1 feasible if H8 (Razorpay Route) started immediately"`. The current date is 2026-07-17; October 1 (2026) is 76 days away.

These launch readiness figures were from the pre-launch audit dated 2026-06-19. The M→AE theme programme (Phases M–AE) completed between then and now, changing the theme platform readiness. Whether the broader platform H-seams (H2–H9) have been addressed is **UNKNOWN** from the committed repository state alone (those seams are in services/api-gateway and identity-platform which are in the dirty tree as foreign WIP).

**Drift type:** STALE_LAUNCH_READINESS — the "Oct 1" claim was conditional on "H8 started immediately" as of 2026-06-19. Current programme state (theme platform now COMPLETE per AE) partially changes the readiness picture, but the overall GO/NO-GO depends on factors outside the theme programme.

---

## 10. Contradictions between CLAUDE.md (working tree) and AGENTS.md

| Item | CLAUDE.md (working tree) | AGENTS.md (DOC 02, committed) | Contradiction class |
|------|------------------------|-------------------------------|---------------------|
| Query-first protocol | "query :3334 first (V2/V3), then :3333" | "query graphify/LCIS (:3333) first before any grep" | CONFLICT — different query-first layers |
| LCIS V2/V3 subsystem | Described as an authority source for "semantic recall, reasoning, repo-context compression" | Not mentioned at all | FOREIGN_WIP in CLAUDE.md extends authority beyond DOC 02 scope |
| Validator count | "107-validator gate" | Not stated explicitly | CONSISTENT (106+1=107 in committed state) |
| Topology 8 vs 10 | Lists 10 canonical items | "8 canonical runtimes" + 2 supporting | CONSISTENT (same 10 items, different grouping) |
| Frozen apps | "app-marketplace, theme-marketplace, developer-portal frozen" | ART-22 mentions app-marketplace + developer-portal explicitly; theme-marketplace implicitly in ART-17 | CONSISTENT but CLAUDE.md is more explicit about theme-marketplace |
| Migration max | Not stated | "current max (161)" (AGENTS.md MIG-R2) | STALE in AGENTS.md; neither CLAUDE.md nor AGENTS.md reflects 191 |

---

## 11. Complete drift table

| # | Doc | Claim | Current truth | Drift type | Suggested superseding correction (AF.1D planning) |
|---|-----|-------|---------------|------------|--------------------------------------------------|
| D-01 | prompt-referenced | Context brain files 01-11, PROJECT-INSTRUCTIONS.md | Not present at any non-archive path | NOT_PRESENT | No correction; confirm absent per policy |
| D-02 | CLAUDE.md | Committed version is the operative AI context | Working tree adds LCIS V2/V3 (39 lines, foreign WIP) | FOREIGN_WIP | Decide: commit LCIS V2/V3 as official policy (requires ARB per ANTI-R8) or revert the working-tree addition |
| D-03 | CLAUDE.md (working tree) | "docs/lcis-v2/ (21 docs)" | 32 files in docs/lcis-v2/ | STALE | Update count if LCIS V2 sections are retained |
| D-04 | CLAUDE.md | "414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes" | db-intel.json (2026-06-15): 417/164/658/398/834; live state after mig 191 NOT_CONNECTED | STALE | Re-run `pnpm graph:db` against live DB after mig 191; update CLAUDE.md counts |
| D-05 | AGENTS.md | "max migration 161, next is 162" (MIG-R2) | Max committed is 191 | STALE | Update MIG-R2 to "current max (191) — next migration is 192" |
| D-06 | AGENTS.md | "replay 000→161" (TEST-R10) | Max committed is 191 | STALE | Update TEST-R10 to "replay 000→191" |
| D-07 | AGENTS.md | "the real 91 / 419, max migration 161" (header) | 120 tracked migration files, max 191; ~417 tables per 2026-06-15 snapshot | STALE | Update header note to reflect current programme HEAD counts |
| D-08 | AGENTS.md | Appendix B: "until DOC 01/DOC 03 physically exist, follow V1+Freeze as fallback" | Both files physically exist at `GOVERNANCE_REWRITE_2026_06_10/` | STALE (resolved-but-listed) | Remove/update the "until they physically exist" caveat; DOC 01 and DOC 03 are present |
| D-09 | AGENTS.md | Evidence pinned at `5cf9e64e` | HEAD is `7e1441a6` (~30+ commits forward) | HISTORICAL_ONLY | Note is a point-in-time marker; no critical change needed but should be refreshed |
| D-10 | PROGRAM_STATE.md | "Active risks" lists RISK-SEC-001 (HIGH, → AE) as open | RISK-SEC-001 FIXED in Phase AE (mig 191, PROGRAM_STATE.md Phase AE section; RISK_REGISTER.md line 8) | STALE (resolved-but-listed) | Update Active risks header to mark RISK-SEC-001 as FIXED |
| D-11 | PROGRAM_STATE.md | "~360 modified/untracked files from prior user work" | Current `git status --porcelain | wc -l` → 378 entries | STALE_MINOR | Update to "~378 entries" or accept as approximate |
| D-12 | SHOPIFY_PARITY_MATRIX.md | Row 25: "Media library / asset picker — MISSING" | Phase X added MediaLibrary.tsx + gateway route; should be PARTIAL | STALE | Update row 25 status to PARTIAL; update summary MISSING count from 13 to ≤10 |
| D-13 | SHOPIFY_PARITY_MATRIX.md | Row 36: "Markets / multi-locale — MISSING" | Phase Z added TranslationEditorClient, LocaleSwitcher, TranslationKeyList; should be PARTIAL | STALE | Update row 36 status to PARTIAL; note: no per-market content variation, translation only |
| D-14 | SHOPIFY_PARITY_MATRIX.md | Row 31: "Release rollback — NOT_CONNECTED" | Phase AB added ThemeUpdatePanel with rollback + proxy routes; should be PARTIAL | STALE | Update row 31 status to PARTIAL; note proxy route exists and UI reachable via /update page |
| D-15 | SHOPIFY_PARITY_MATRIX.md | Summary: "MISSING 13, NOT_CONNECTED 4" | After Phase X/Z/AB corrections: MISSING≤10, NOT_CONNECTED≤3, PARTIAL≥18 | STALE | Recount summary table after updating rows 25, 31, 36 |
| D-16 | SHOPIFY_PARITY_MATRIX.md | "External re-verification PENDING — no internet access" | Still unverified (no internet access in AF.0 either) | STRUCTURAL_ONLY | Remains open; add a note that it was also unverified at AF.0 (2026-07-17) |
| D-17 | AGENTS.md | "pricing-catalog-validator.mjs" absent from validators[] | Working tree has it added (M scripts/validate-governance.mjs) | FOREIGN_WIP | Decide: commit pricing-catalog-validator as part of the gate (ARB) or revert the addition |
| D-18 | CLAUDE.md memory | "22 LCIS pkgs green" | 19 lcis-* directories exist; all 19 are UNTRACKED | FOREIGN_WIP | Do not treat LCIS packages as gate-covered; all are uncommitted WIP |
| D-19 | (governance chain) | No ADR covering M→AE theme platform canonical decisions | Programme docs exist (PARTNER_READINESS.md, CERTIFICATION.md) but no formal ADR-025+ | STRUCTURAL_ONLY (gap) | After AF.1, author ADR-025 capturing the Liquid canary gate, marketplace submission contract, and RISK-SEC-001 remediation as constitutional follow-on decisions |
| D-20 | CLAUDE.md memory | "NO-GO Oct 1 / October 1 feasible if H8 started immediately" | Date was 2026-06-19; theme programme now COMPLETE; Oct 1 is 76 days from today (2026-07-17) | STALE_LAUNCH_READINESS | Run a fresh launch-readiness sweep (out of scope for AF-I; belongs to AF-F or AF-G) |
| D-21 | AGENTS.md | Untracked migration reference: 186/187 as "foreign WIP" | Confirmed untracked in PROGRAM_STATE.md Foreign WIP section and RISK-DATA-001 | VERIFIED_CURRENT | No change needed; the RISK register correctly documents this |
| D-22 | Constitution §14.4 | UNVERIFIED: "six anon RLS-to-PUBLIC GRANTs — confirm live state" | Migration 163 (D2) and migration 191 fix known cases; remaining UNVERIFIED status unresolved | STRUCTURAL_ONLY (open) | Carry forward to ARB S0 sign-off; AF.0 cannot resolve live DB probe |

---

## 12. Resolved open questions identified during this workstream

| Open question (as stated in docs) | Resolution status | Evidence |
|-----------------------------------|-------------------|----------|
| "Until DOC 01/DOC 03 physically exist" (AGENTS.md Appendix B) | **RESOLVED** — both files exist | `ls GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` + `LETBUYY_CANONICAL_SYSTEMS.md` both return files |
| RISK-SEC-001 (theme_purchases wide-open RLS) | **RESOLVED** (committed, ARB-gated for prod) | RISK_REGISTER.md:8 "FIXED in Phase AE — Migration 191 committed"; `database/supabase/migrations/191_theme_purchases_rls_tenant_scope.sql` exists |
| RISK-R01 (BlockEntry.children type mirror) | **RESOLVED** — PROGRAM_STATE.md marks CLOSED | PROGRAM_STATE.md Phase T section |

---

## 13. validate-governance.mjs mutation side-effect analysis

Per AF.0 rules, the script was READ before any decision to run it.

**Finding:** `scripts/validate-governance.mjs` calls `fs.rmSync(absPath, { recursive: true, force: true })` in `removeGeneratedArtifactDirectories()`. The directories it deletes are: `node_modules`, `.next`, `.turbo`, `dist`, `.dart_tool`, `build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods`.

**Classification:** These are **gitignored generated build artifacts** (not tracked source files). No tracked file is deleted. However, deleting these directories would require full re-builds (`pnpm install`, `pnpm build`) — a significant side effect in a working development environment.

**Decision:** NOT RUN in AF.0. The EXIT=1 status is accepted from the programme record (PROGRAM_STATE.md consistently records it at every phase since Phase U). The `validate-governance.mjs` script is also itself MODIFIED (foreign WIP adds `pricing-catalog-validator.mjs`) which means any run today would exercise different validator logic than at Phase AE HEAD.

```
Evidence: grep "rmSync" scripts/validate-governance.mjs → line 179: fs.rmSync(absPath, { recursive: true, force: true })
          grep "generatedDirectoryNames" scripts/validate-governance.mjs → Set["node_modules",".next",".turbo","dist",...]
          These are all gitignored by .gitignore conventions
```

---

## 14. Facts that belong elsewhere (relocation suggestions for AF.1D)

| Fact / claim | Currently in | Should live in |
|---|---|---|
| LCIS V2/V3 query-first protocol | CLAUDE.md working tree (uncommitted) | A separate `docs/lcis-v2/LCIS_OPERATING_CONTRACT.md` or an addendum to AGENTS.md with ARB approval |
| LCIS package completion counts ("22 pkgs", "7,350 tests") | System prompt memory | A programme-specific tracking doc (these are FOREIGN_WIP, not committed facts) |
| "Oct 1 feasible if H8 started immediately" | System prompt memory | A launch-readiness tracking doc (to be re-evaluated; date is now past its conditional window) |
| Parity matrix summary counts | SHOPIFY_PARITY_MATRIX.md (static snapshot) | A living parity tracker updated per phase, or clearly labelled as a Phase M baseline snapshot |
| M→AE canonical decisions (Liquid canary gates, marketplace submission contract) | Programme phase docs under `phase-ae/` | ADR-025+ in `GOVERNANCE_REWRITE_2026_06_10/` or a supplementary ADR register |

---

## STOP/GO inputs for the AF_1 decision

This workstream (AF-I) contributes the following verified inputs to the AF_1 STOP/GO gate:

1. **No numbered context brain files** at any non-archive path. This is NOT a blocker — those docs were never part of the committed repo.

2. **CLAUDE.md is Modified** in the working tree, adding LCIS V2/V3 instructions that are inconsistent with AGENTS.md (DOC 02). This is a **governance-drift signal** (ANTI-R8: generated/uncommitted docs must not become operating law). STOP input: the uncommitted CLAUDE.md working tree should be resolved before AF.1 treats it as the operative context.

3. **AGENTS.md migration-count facts are STALE** (161 max → actual 191; 91 migrations → 120; "next is 162" instruction is obsolete). These are **MEDIUM drift items** — the rules themselves are valid but the specific numbers mislead any agent following them literally (e.g., MIG-R2 would cause a new migration to be numbered 192 if read literally, but the text says "next is 162"). STOP input if any agent uses these counts to make ordering decisions without independently verifying.

4. **SHOPIFY_PARITY_MATRIX.md** has at least 3 capability rows (25, 31, 36) with statuses lagging Phase X/Z/AB completions, and summary counts that understate PARTIAL and overstate MISSING. This does **NOT block** AF.1 but should be corrected before any external parity claim is made.

5. **RISK-SEC-001** is listed in the "Active risks" section of PROGRAM_STATE.md but FIXED in Phase AE. This is a **MINOR** drift (the Phase AE section clearly states FIXED) — no STOP required, but the active risks header should be updated.

6. **DB counts in CLAUDE.md** (414 tables, 156 RPCs, etc.) are from a stale graphify run and do NOT reflect the current live DB state after migration 191. The true live values are NOT_CONNECTED. This is an **INFO-level** item for AF.1 — acceptable as a known limitation, but agents should not quote these numbers as current.

7. **AGENTS.md Appendix B** caveat ("until DOC 01/03 physically exist") is a resolved open question. **GO input** (issue is resolved; the caveat can simply be noted as closed in the next AGENTS.md update).

8. **No missing ADR** blocks the programme from being constitutionally sound, but formal ADR-025+ for M→AE decisions would complete the governance record. This is an **INFO-level** gap.

9. **validate-governance.mjs** was NOT run (foreign WIP in the script + rmSync side effects). Pre-run status per programme record: EXIT=1 (pre-existing tenant drift, anti-fabrication PASS). This should be VERIFIED in AF.1D with a clean run after the working-tree modify is resolved.

---

*End of AF_09_CANONICAL_CONTEXT_DRIFT.md. No source files were modified by this workstream. Evidence is pinned at `stepup/main` HEAD `7e1441a6`, 2026-07-17. Git status count after write: 379 entries (this file added).*
