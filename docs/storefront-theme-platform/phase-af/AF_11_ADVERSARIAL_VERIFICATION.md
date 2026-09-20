# AF_11 — Adversarial Verification

**Phase:** AF.0 · **Author:** Root integrator (Claude Code, Opus 4.8), read-only
**Branch / HEAD:** `stepup/main` / `80d0b1af` · **Evidence:** 2026-07-18 IST
**Method note:** The parallel adversarial subagents were interrupted by a session limit and returned only partial output. To preserve rigor without fabricating, the root integrator completed all five passes **inline with independent read-only checks** (exact commands shown). Every verdict below is backed by a command result or `path:line`, not by a subagent's unfinished text.

**Headline:** One adversarially-**CONFIRMED CRITICAL** defect (build-integrity: committed `index.ts` exports 3 untracked files). No greenwashing found *in the AF artifacts themselves* — they honestly flag the stale "green" claims that live in `CLAUDE.md`. No new CRITICAL/HIGH cross-tenant escape beyond what AF_05 already documents.

---

## AV-1 — Green-washing detector

**greenwashing_found (in AF artifacts): FALSE.** The discovery artifacts do not describe any non-zero-exit gate as green.

| Verdict | Claim challenged | Evidence |
|---------|------------------|----------|
| VERIFIED | AF_03 does NOT call the failing gates green | AF_03 status line reads "GATE BROKEN — … api-gateway EXIT=1 … governance EXIT=1 … sequential-migration EXIT=1". Honest. |
| VERIFIED | The only "gate green" phrasing is a *quoted stale claim* being flagged as drift | `AF_09:76` quotes `CLAUDE.md` "Keep the 107-validator gate green" and flags it; `AF_09:324` flags "22 LCIS pkgs green" → "19 lcis-* dirs, all UNTRACKED". The artifact challenges the green claim, it does not assert it. |
| VERIFIED (CRITICAL) | The build-integrity gap is disclosed, not hidden | AF_08 leads with it; independently re-verified: `git cat-file -e HEAD:packages/theme-engine/src/experience-fonts.ts` → "ABSENT at HEAD" for all three files while committed `index.ts:21-23` re-exports them. A clean clone cannot build `@letbuyy/theme-engine`. |
| VERIFIED | theme-engine "1726/1726 pass" is real but carries an integrity caveat | The pass is real locally (AF_03 EXIT=0) **but depends on the 3 untracked files** existing in the dirty tree — so it is not reproducible from HEAD. This caveat is stated (AF_08). |

**new_concerns:** none beyond the build-integrity caveat already central to AF_08/AF_12.

---

## AV-2 — Tenancy escape review

**critical_or_high_found: FALSE** (no new escape beyond AF_05's documented items).

| Verdict | Vector | Evidence |
|---------|--------|----------|
| REFUTED (blocked) | ART-17 Liquid default still OFF | `theme-governance.ts:14` = `export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;` (re-read). |
| REFUTED (fixed) | `theme_purchases` wide-open RLS | Migration 191 replaces `USING(true)`/`WITH CHECK(true)` with `service_role` pass-through + `authenticated user_id = auth.uid()` (`191_theme_purchases_rls_tenant_scope.sql:13-24`). No new PUBLIC `USING(true)`. |
| UNKNOWN→LOW | `theme_editor_drafts` RLS checks `user_id` only, not `custom_user_id` (SSO) | `AF_05:364` (`000_baseline.sql:27608-27639`). Mitigated: gateway uses service_role behind ownership verification; `theme_instance_drafts`/`theme_instances` check both columns. Severity LOW → owning phase AG. Not a live escape while gateway is the only writer. |
| LOW (self-documented) | Migration 191 `user_id = auth.uid()` compares different UUID namespaces | The migration's own ARCHITECTURE NOTE (`191:24-25`) states `theme_purchases.user_id FK → users_custom(id)`, a separate space from Supabase `auth.users.id`. Registered as RISK-AE-SEC-003 (LOW). |
| STRUCTURAL_ONLY (not a live escape) | Marketplace submission gate not enforced | `validateThemeForMarketplace` exists + tested but is NOT called from the gateway upload route (`AF_07` SEAM-10). This is a *missing enforcement*, reachable only if a partner-submission pipeline is turned on — which is ARB-gated and frozen (ART-22). Not exploitable today. |

**new_concerns:** none. Translation/media/AI-overlay vectors: AF_05 is the authoritative per-route pass; the interrupted AV-2 subagent did not surface a contradicting finding before termination.

---

## AV-3 — Migration-chain challenge

**defect_found: TRUE** (R-23 rollback gap + untracked 186/187 + edited historical migrations). **Agrees with AF_04; no disagreements.**

| Verdict | Claim | Evidence |
|---------|-------|----------|
| VERIFIED | 186/187 UNTRACKED; 188/189/190/191 TRACKED | `git ls-files` empty for 186/187; tracked for 188-191. |
| VERIFIED (CRITICAL for R-23) | Migrations 180, 186, 187, 188, 189, 190, 191 **all lack a paired rollback** | `ls database/supabase/rollback/${n}_*.sql` → MISSING for every one of 180/186/187/188/189/190/191. R-23 mandates a paired rollback. Even the RLS fix (191) has none. |
| VERIFIED | Historical migrations 100/109/111/142 are Modified in-tree (immutability concern) | `git status --porcelain` → ` M` on each (recorded AF_00 §2.2, AF_04). |
| VERIFIED | Migration 191 correctly closes RISK-SEC-001 | `191:13-24` drops the two PUBLIC `USING(true)`/`WITH CHECK(true)` policies, adds scoped ones. |
| UNKNOWN | Staging/production APPLY state of 180/186-191 | No live evidence in repo; AF_04 correctly marks apply state UNKNOWN (not "unapplied"). |

**disagreements_with_AF_04:** none. Independent reconstruction matches AF_04's inventory and classifications.

---

## AV-4 — Test-integrity challenge

**defect_found: TRUE** (the "pass" is not reproducible from HEAD; failures are pre-existing/foreign but real).

| Verdict | Claim | Evidence |
|---------|-------|----------|
| VERIFIED | api-gateway EXIT=1 with 3 STABLE (non-ordinal) named failures | `AF_03:138/150/160`: `merchant AI route is mounted, mobile allowlisted, and provider-backed`; `executive analytics migration creates rollup tables with service-role and super-admin RLS`; `storefront runtime no longer owns payment route handlers`. |
| VERIFIED | The 3 failures are pre-existing FOREIGN (not theme-programme regressions) | Their target files are disjoint from the theme surface; recorded as pre-existing since Phase M (memory + PROGRAM_STATE). Provenance ≠ pass/fail state — they still make the gate EXIT=1. |
| VERIFIED (integrity caveat) | theme-engine 1726/1726 pass is real **but not reproducible from HEAD** | Depends on the 3 untracked source files (AV-1). A clean clone would fail to compile before any test runs. |
| VERIFIED | storefront count grew 915→930 since the historical claim | `AF_03:98` counts tests 930/930 (historical doc said 915) — the docs are STALE, the current output is higher and real. |
| UNKNOWN | Whether any theme-engine test is a static-source-string / tautological test | The interrupted subagent did not complete this scan; not independently re-run here. Marked UNKNOWN (honest) — a residual AF.1C review item, not a STOP by itself. |

---

## AV-5 — Documentation chronology challenge

**defect_found: TRUE** (multiple stale doc facts; all documentation-only, feed AF.1D).

| Verdict | Claim | Evidence |
|---------|-------|----------|
| VERIFIED | B→AE = 30 phases, linear ancestry | AF_02: all 14 named SHAs exist, ancestors of HEAD; Phase V spans 3 commits (LOW anomaly vs "one commit each"). |
| VERIFIED | "107-validator gate" is STALE → actual **109** | `grep -oE '"…\.mjs"' scripts/validate-governance.mjs | sort -u | wc -l` = 109; and the gate driver is itself Modified (adds `pricing-catalog-validator`). |
| VERIFIED | `AGENTS.md` migration counts STALE (max 161→191; 91→120 files) | AF_09 D-09/§; AF_04 inventory. |
| VERIFIED | RISK-SEC-001 shown in "active risks" header but FIXED in AE | AF_09; RISK_REGISTER shows FIXED (my AE reconciliation). Minor doc drift. |
| VERIFIED | Launch-readiness "Oct 1 / NO-GO" memory is STALE-dated (2026-06-19) | AF_09 D-20; today 2026-07-18. |

---

## Consolidated table — items that MUST reach the STOP/GO decision

| # | Item | Adversarial verdict | Severity | Feeds AF_12 as |
|---|------|--------------------|----------|----------------|
| 1 | Committed `index.ts` exports 3 untracked files → clean clone cannot build `@letbuyy/theme-engine` | CONFIRMED | **CRITICAL** | STOP (irreproducible/build-broken committed state) |
| 2 | 186/187 untracked → sequential-migration EXIT=1 | CONFIRMED | HIGH | STOP (migration ownership ambiguous) |
| 3 | R-23: 180/186-191 all lack rollback files | CONFIRMED | HIGH | STOP-conditional (ARB rollback-policy decision) |
| 4 | Governance gate EXIT=1 (tenant-registry drift, RISK-GOV-001) | CONFIRMED | MEDIUM-HIGH | STOP (gate cannot reach EXIT 0 without human/generator) |
| 5 | Historical migrations 100/109/111/142 edited in-tree | CONFIRMED | MEDIUM | STOP-conditional (immutability review) |
| 6 | `CLAUDE.md` + `validate-governance.mjs` Modified (foreign WIP) | CONFIRMED | MEDIUM | STOP (operative-context ambiguity; foreign gate driver) |
| 7 | Marketplace gate not enforced at upload route | CONFIRMED | MEDIUM | Not a live escape (frozen); AH/AI item |
| 8 | Doc staleness (109≠107, 930≠915, 30 phases, RISK-SEC-001) | CONFIRMED | LOW | AF.1D reconciliation |

**Did any pass find a Critical/High defect or greenwashing?** YES — one CONFIRMED **CRITICAL** build-integrity defect (item 1) and CONFIRMED **HIGH** items 2–4. **No greenwashing in the AF artifacts.** These verdicts are carried verbatim into `AF_12`.
