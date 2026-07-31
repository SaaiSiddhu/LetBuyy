# AF_12 — STOP / GO Decision

**Phase:** AF.0 → AF.1 gate · **Author:** Root integrator (Claude Code, Opus 4.8), read-only
**Branch / HEAD:** `stepup/main` / `7e1441a6` · **Evidence:** 2026-07-17/18 IST
**Decision authority:** This document proposes the verdict; **the founder holds final approval.** AF.1 remediation has not begun.

---

## 1. Decision

# `AF_1_STOP`

AF.1 source/governance/test remediation **must not begin** until the founder resolves the blockers in §11. The repository's *theme-platform structure* is constitutionally sound and its committed history is clean and linear — but the **committed state is not reproducible or buildable from a clean clone**, two migrations are **untracked**, the **governance and sequential-migration gates are red**, and the working tree carries a large **foreign-WIP mass** (377 entries, incl. the gate driver and `CLAUDE.md` themselves). Several remediation steps require **ARB / human decisions** (migration ownership, R-23 rollback policy, tenant-registry regeneration) that AF.0 is explicitly forbidden to make. Per the AF prompt §10, **any one** of these triggers STOP; here **six** do.

---

## 2. Executive summary

- **Ancestry is clean (GO signal):** all 14 named B→AE SHAs exist, are ancestors of HEAD, and form a linear chain; HEAD `7e1441a6` is the claimed AE/export head (AF_02). 30 phases confirmed.
- **Core invariants intact (GO signal):** Liquid default `false` (`theme-governance.ts:14`); DOMPurify FORBID lists locked; money ledger, auth issuers, and frozen apps untouched since Phase M; migration 191 *tightened* (not opened) `theme_purchases` RLS (AF_02/AF_05/AF_11).
- **But the committed state does not build (CRITICAL STOP):** `packages/theme-engine/src/index.ts` at HEAD re-exports `./industry-experience-map`, `./theme-bundle-core`, `./experience-fonts`, and **all three are ABSENT at HEAD** (`git cat-file -e HEAD:… → ABSENT`; untracked, working-tree-only). A clean clone cannot compile `@letbuyy/theme-engine`. The 1726/1726 pass is real only because the dirty tree supplies these files (AF_08, AF_11 AV-1/AV-4).
- **Gates are red (STOP):** governance gate EXIT=1 (tenant-registry drift, RISK-GOV-001) and sequential-migration EXIT=1 (186/187 untracked). api-gateway unit tests EXIT=1 (3 pre-existing foreign failures) (AF_03/AF_04/AF_01).
- **Migration hygiene gaps (STOP-conditional):** 186/187 untracked; historical 100/109/111/142 edited in-tree (immutability); **R-23 rollback files MISSING for all of 180/186-191** (AF_04/AF_07/AF_11 AV-3).
- **Foreign WIP everywhere (STOP):** 377 dirty entries including `CLAUDE.md` (+39 LCIS lines) and `validate-governance.mjs` (adds `pricing-catalog-validator`). AF.0 wrote only to `phase-af/` — zero overlap — but AF.1 targets (tenant registry, gate, docs) sit amid foreign WIP (AF_00/AF_09).

---

## 3. Current HEAD & worktree state

| Field | Value |
|-------|-------|
| Branch / HEAD | `stepup/main` / `7e1441a6` (attached, intended branch) |
| Upstream | none configured; remote `origin` present |
| Working tree | **377 dirty** (146 M, 2 D, 229 ??); none under `phase-af/` |
| Worktrees | 11 stale agent worktrees at ancestor `41b6ea49`, each with uncommitted content; isolated under `.claude/worktrees/`; not removed |
| In-progress git op | none (no rebase/merge/cherry-pick/bisect) |
| AF.0 mutation footprint | **zero** tracked-file changes; only `phase-af/AF_00..AF_13` created; every discovery agent verified porcelain count 378→378 |

---

## 4. Gate matrix (current, observed)

| Gate | Exit | Counts | Class | Provenance |
|------|-----:|--------|-------|-----------|
| typecheck (theme-engine / storefront / merchant / api-gateway) | 0 | — | VERIFIED_CURRENT | clean |
| theme-engine test | 0 | 1726/1726 | PASS **(not reproducible from HEAD — see §5/CRITICAL)** | current |
| storefront-runtime test | 0 | 930/930 | VERIFIED_CURRENT (historical doc said 915 — STALE) | current |
| merchant-control-plane test | 0 | 771/771 | VERIFIED_CURRENT | current |
| api-gateway unit test | **1** | 537/540 (3 fail) | BROKEN | 3 pre-existing FOREIGN failures (named, AF_03 §3.4.1) |
| `validate-governance.mjs` (full) | **1** | stops at `tenant-isolation-validator` | BROKEN | tenant-registry drift (RISK-GOV-001), pre-existing |
| sequential-migration validator | **1** | — | BROKEN | 186/187 untracked (FOREIGN_WIP) |
| migration-safety validator | 0 | — | PASS | current |
| no-public-using-true validator | 0 | — | PASS | current |

Validator inventory: **109** validators (not "107"); `sequential-migration` is invoked; the gate driver itself is Modified (AF_01 §3).

---

## 5. Current migration state

| Migration | Tracked | Rollback (R-23) | Class |
|-----------|:------:|:---------------:|-------|
| 180 | yes | **MISSING** | TRACKED_CURRENT · R-23 gap |
| 100/109/111/142 | yes but **Modified in-tree** | — | SECURITY_REVIEW_REQUIRED (immutability) |
| 186 `v1_scale_commerce_os_coming_soon` | **UNTRACKED** | MISSING | FOREIGN_WIP / ORDER_BLOCKED |
| 187 `v1_sites_site_settings` | **UNTRACKED** | MISSING | FOREIGN_WIP / ORDER_BLOCKED · source already committed references `site_settings` (live-path regression risk if unapplied) |
| 188 / 189 / 190 | yes | **MISSING** | TRACKED_CURRENT · R-23 gap |
| 191 `theme_purchases_rls_tenant_scope` | yes | **MISSING** | TRACKED_CURRENT · R-23 gap; closes RISK-SEC-001 |
| Apply state (staging/production) of all above | — | — | **UNKNOWN** (no live evidence in repo; do NOT assume "unapplied") |

Hard rule (carried from AF_04): **no migration proceeds to staging in Phase AI until every UNKNOWN / FOREIGN_WIP / ORDER_BLOCKED entry is resolved and every candidate migration has a paired rollback.**

---

## 6. Critical / High / Medium risk summary

- **CRITICAL:** Build-integrity — committed `index.ts` exports 3 untracked files; clean clone cannot build `@letbuyy/theme-engine` (AF_08/AF_11). *Repository reproducibility is broken.*
- **HIGH:** 186/187 untracked → sequential-migration gate red; migration ownership ambiguous. R-23 rollback missing for all of 180/186-191.
- **HIGH (pre-existing, FOREIGN):** api-gateway 3 failing tests; governance gate red (tenant-registry drift).
- **MEDIUM:** historical migrations 100/109/111/142 edited in-tree; `CLAUDE.md` + `validate-governance.mjs` Modified (operative-context ambiguity, foreign gate driver); RISK-TOCTOU-Q01 plan-limit bypass (fix before paid tiers); typography-apply silently fails when gateway deployed (AF_06).
- **LOW (documented, mitigated):** `theme_editor_drafts` RLS `user_id`-only for SSO merchants; migration 191 cross-UUID-space residual (RISK-AE-SEC-003); custom-CSS `rawCustomCss` not passed at render (AF_07 SEAM-5).

No **new** cross-tenant CRITICAL/HIGH escape was found beyond AF_05's documented items (AF_11 AV-2).

---

## 7. NOT-CONNECTED summary (AF_07)

7 of 12 seams genuinely NOT-CONNECTED/STRUCTURAL (metafield resolution, live FX, live app-block runtime, analytics telemetry, settings canonicalisation consumption, schema-migration registry [empty by design], partner-marketplace pipeline). GO-confirmed live: Liquid flag hardcoded `false`; `buildLiquidThemeHeadAssets` wired at `theme-renderer.ts:585` (but `rawCustomCss` arg not passed — custom CSS not injected); rollback UI→proxy→gateway→RPC chain structurally connected. Marketplace gate = STRUCTURAL_ONLY (defined/tested, not enforced at upload).

---

## 8. Contradictions discovered (docs vs current source)

"107 validators" → **109**. storefront "915" → **930**. `AGENTS.md` migration max "161" → **191**, "91 files" → **120**. RISK-SEC-001 in "active" header but **FIXED**. `CLAUDE.md` committed vs on-disk differ (+39 LCIS lines). Launch-readiness "Oct 1 NO-GO" memory dated 2026-06-19 (stale). All are documentation-only; none changes a hard rule. → AF.1D reconciliation.

---

## 9. Proposed AF.1 file **allowlist** (only after GO + human approval; each item still gated)

- `scripts/generators/*tenant*registry*` **run** (not hand-edit) to regenerate `tenant-tables.registry.ts` — **only** after human confirms it introduces no foreign rows (AF.1A). *Blocked today: AF.0 forbids running it; the working tree is dirty.*
- The 3 untracked theme-engine source files (`experience-fonts.ts`, `industry-experience-map.ts`, `theme-bundle-core.ts`) — **founder decides**: commit them (if they are the intended source) OR remove the `index.ts` exports (AF.1-build-integrity). *This is the CRITICAL unblock.*
- Failing-test source/test contracts **only** where current canonical behaviour is proven (AF.1C) — never weaken/skip.
- Phase AF documentation (`docs/storefront-theme-platform/phase-af/**`).
- Canonical documentation reconciliation (superseding corrections): `CLAUDE.md` validator count, `AGENTS.md` migration counts, `PROGRAM_STATE.md`/`RISK_REGISTER.md` stale headers, capability matrix, NOT-CONNECTED register (AF.1D).

## 10. Proposed AF.1 file **denylist** (hard — never touched in AF)

Money/payment/checkout/refund/payout/gift-card/GST code · identity/auth/OAuth/session/step-up · RLS & SECURITY DEFINER migrations/functions · production config & secrets · the Liquid default flag · DOMPurify FORBID config · frozen apps (app-marketplace/developer-portal/theme-marketplace/platform-operations-portal) · marketplace runtime · metafield/custom-CSS/analytics/app-block/AI runtime wiring · any AG–AK feature source · **any FOREIGN_WIP / UNKNOWN_OWNERSHIP file** (the 377 dirty entries, 186/187, edited 100/109/111/142, the modified `validate-governance.mjs`, the 11 agent worktrees).

---

## 11. Required human / ARB decisions (blockers to AF.1 GO)

1. **[CRITICAL] Build integrity:** Are `experience-fonts.ts` / `industry-experience-map.ts` / `theme-bundle-core.ts` intended committed source? Decide **commit them** or **remove the `index.ts` exports**. Until then HEAD is not buildable from a clean clone.
2. **[HIGH] Migrations 186/187:** commit them (with rollback files) **or** delete them with a documented rationale and a replacement at the next free sequence number. This is what makes the sequential-migration gate red. (ARB — touches schema.)
3. **[HIGH] R-23 rollback policy:** either author rollback files for 180/186-191, **or** ARB formally ratifies "forward-fix-only" and amends R-23. (ARB — constitutional.)
4. **[HIGH] Tenant-registry drift (RISK-GOV-001):** approve regenerating `tenant-tables.registry.ts` and review the diff for foreign rows before it is trusted. (Human — AF.0 forbids running the generator.)
5. **[MEDIUM] Edited historical migrations 100/109/111/142:** review why already-numbered migrations are modified in-tree; decide revert vs forward-migration. (ARB — immutability.)
6. **[MEDIUM] Operative context:** resolve the Modified `CLAUDE.md` (+39 LCIS lines) and Modified `validate-governance.mjs` — commit, revert, or explicitly scope-out — before AF.1 treats either as law.
7. **[PROCESS] Foreign-WIP isolation:** confirm AF.1 may proceed on a clean lane without touching the 377-entry WIP mass and the 11 stale worktrees.

---

## 12. Rollback strategy

AF.0 made **no** source/git mutation, so there is nothing to roll back — every AF.0 artifact lives under `docs/storefront-theme-platform/phase-af/` and is uncommitted; deleting that folder fully reverts AF.0. For the future AF.1, each proposed edit is individually reversible (docs = superseding corrections; the tenant registry is generated; failing-test fixes are narrow conventional commits per remediation group) — detailed in AF_13.

---

## 13. Confidence & unknowns

**Confidence in the STOP verdict: HIGH.** The two decisive facts (build-integrity gap; 186/187 untracked → gate red) are independently re-verified by the integrator with exact commands, and six independent STOP conditions concur. **Principal unknowns (honestly UNKNOWN, not assumed):** (a) staging/production **apply state** of migrations 180/186-191 — no repo evidence; (b) whether any theme-engine test is a static-string/tautological test — the interrupted AV-4 subagent did not finish that scan; (c) full RLS/FORCE coverage per tenant table beyond the theme surface — requires live DB introspection, out of AF.0 scope. None of these unknowns can turn the verdict to GO; several independently reinforce STOP.

---

**Decision: `AF_1_STOP`. AF.1 remediation is planned in `AF_13` but must not execute until the founder resolves §11.**
