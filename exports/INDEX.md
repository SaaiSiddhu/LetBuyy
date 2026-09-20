# LetBuyy Theme Platform — Documentation Archive

**Exported:** 2026-07-11 · **Repo HEAD at export:** `80d0b1af` · **Branch:** `stepup/main`
**Total documents:** 152 (`storefront-theme-platform/` = 110 · `storefront-liquid-discovery/` = 42)

This archive bundles the complete documentation for the LetBuyy Liquid theme
platform transformation — **30 phases across two sequential programs (B→L, then
M→AE), all committed on `stepup/main`, one verified commit per phase.**

> **Honesty note (applies to every doc):** structural work is real and committed;
> every *live* value is labelled CONNECTED (with its emission point) or
> NOT-CONNECTED (with the exact missing piece). The Liquid canary flag
> `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains **`false`** — flipping it is
> ARB authority and was never performed. Migrations 188/189/190/191 are
> local-only; production apply is ARB/human-gated. Frozen apps
> (`app-marketplace`, `developer-portal`, `theme-marketplace`) were never touched.

---

## Two folders in this archive

### 1. `storefront-theme-platform/` — the M→AE program (19 phases)
The billion-dollar "Shopify-parity" merchant theme editor + platform. **This is
the primary body of work.** Read these top-level docs first:

| Doc | What it is |
|-----|-----------|
| `PROGRAM_STATE.md` | The scoreboard — every phase, deliverables, gates, "PROGRAM COMPLETE" |
| `phase-ae/PROGRAM_CAPSTONE.md` | Whole-program closure: verdict, shipping record, parity snapshot, open risks |
| `RISK_REGISTER.md` | Every risk raised across the program with disposition (OPEN / FIXED / deferred) |
| `SHOPIFY_PARITY_MATRIX.md` | 70-capability parity baseline vs Shopify |
| `SECURITY_MODEL.md` · `DATA_MODEL.md` · `API_CONTRACTS.md` · `EDITOR_GUIDE.md` | Architecture references |
| `PREFLIGHT.md` · `RESUME.md` | Operating context for the phased program |

**Per-phase folders** (each has DISCOVERY → PLAN → REPORT → SECURITY_REVIEW →
TEST_REPORT, plus a domain reference doc where relevant):

| Phase | Folder | Theme |
|-------|--------|-------|
| M | `PHASE_M_*.md` (top level) | Repository truth + Shopify parity contract (docs only) |
| N | `phase-n/` | Canonical ThemeDocument V2 (`section_definitions` / `block_definitions`) |
| O | `phase-o/` | Preset & Experience Engine 2.0 (content-preservation law) |
| P | `phase-p/` | Drafts, revisions, publishing, rollback (tenant-safe; migration 189) |
| Q | `phase-q/` | Merchant theme library (migration 190) |
| R | `phase-r/` | Visual editor shell (conflict dialog, section tree) |
| S | `phase-s/` | Live preview inspector (cross-origin postMessage bridge) |
| T | `phase-t/` | Section groups + depth-bounded nested blocks |
| U | `phase-u/` | Complete settings control renderer (`CONTROL_TYPE_REFERENCE.md`) |
| V | `phase-v/` | Complete template system (`TEMPLATE_REFERENCE.md`) |
| W | `phase-w/` | Dynamic sources + custom data (`DYNAMIC_SOURCES_REFERENCE.md`) |
| X | `phase-x/` | Files & media library (`MEDIA_LIBRARY_REFERENCE.md`) |
| Y | `phase-y/` | Theme app extensions (`APP_BLOCK_REFERENCE.md`) |
| Z | `phase-z/` | Markets + localization (`LOCALIZATION_REFERENCE.md`, India-first `en-IN`) |
| AA | `phase-aa/` | Custom CSS + safe code workspace (`CUSTOM_CODE_SECURITY.md`) |
| AB | `phase-ab/` | Theme versioning + safe updates (`SAFE_UPDATE_REFERENCE.md`) |
| AC | `phase-ac/` | AI-assisted customization (`AI_CUSTOMIZATION_REFERENCE.md`; model boundary NOT-CONNECTED) |
| AD | `phase-ad/` | Certification + canary readiness (ARB package, NOT_CONNECTED register) |
| **AE** | `phase-ae/` | **Marketplace + partner readiness — the final phase** (`PARTNER_READINESS.md`, `PROGRAM_CAPSTONE.md`) |

**Phase AE highlights** (final commit `80d0b1af`):
- `validateThemeForMarketplace` — a pure, deterministic, fail-closed partner-submission gate composing the Stage K / AA / Y / N validators.
- Closed **RISK-SEC-001** (HIGH, carried since Phase M) via migration 191 — tightened the wide-open `theme_purchases` RLS to service-role pass-through + `user_id = auth.uid()` scope.
- Hardened **FIND-AE-SEC-001** (MEDIUM) in-phase — the CSS-injection scanner now covers all legitimate nesting depths and rejects over-deep bundles fail-closed (`AA:settings-too-deep`), locked by tests AE-AA-07/08.
- Final gate: theme-engine **1726/1726**.

### 2. `storefront-liquid-discovery/` — foundation (discovery + B→L program, 42 docs)
The enterprise discovery mission (`01`–`12` numbered deliverables) that mapped the
React storefront and produced the migration plan, plus the **B→L** foundation
program reports (`phase-c/` … `phase-l/`), the developer platform docs
(`developer/`), rollout package (`phase-j/`), and architecture certification
(`certification/`). The M→AE program builds directly on this.

Start with `storefront-liquid-discovery/README.md` and
`storefront-liquid-discovery/12_MASTER_LIQUID_MIGRATION_PLAN.md`.

---

## Complete file listing (152 files)

- storefront-liquid-discovery/01_REPOSITORY_DISCOVERY.md
- storefront-liquid-discovery/02_LIQUID_PLATFORM_DISCOVERY.md
- storefront-liquid-discovery/03_STOREFRONT_DISCOVERY.md
- storefront-liquid-discovery/04_REACT_DEPENDENCY_MAP.md
- storefront-liquid-discovery/05_THEME_EDITOR_DISCOVERY.md
- storefront-liquid-discovery/06_PRESET_LIBRARY_DISCOVERY.md
- storefront-liquid-discovery/07_RENDER_PIPELINE_DISCOVERY.md
- storefront-liquid-discovery/08_DYNAMIC_SOURCE_DISCOVERY.md
- storefront-liquid-discovery/09_THEME_SCHEMA_DISCOVERY.md
- storefront-liquid-discovery/10_ASSET_PIPELINE_DISCOVERY.md
- storefront-liquid-discovery/11_GAP_ANALYSIS.md
- storefront-liquid-discovery/12_MASTER_LIQUID_MIGRATION_PLAN.md
- storefront-liquid-discovery/PROGRAM_CAPSTONE.md
- storefront-liquid-discovery/README.md
- storefront-liquid-discovery/certification/ARCHITECTURE_CERTIFICATION.md
- storefront-liquid-discovery/certification/EVIDENCE_REPORT.md
- storefront-liquid-discovery/certification/RISK_CLOSURE_REPORT.md
- storefront-liquid-discovery/developer/01-theme-sdk-api.md
- storefront-liquid-discovery/developer/02-theme-cli.md
- storefront-liquid-discovery/developer/03-liquid-section-authoring.md
- storefront-liquid-discovery/developer/04-example-artifacts.md
- storefront-liquid-discovery/developer/README.md
- storefront-liquid-discovery/phase-c/PHASE_C_REPORT.md
- storefront-liquid-discovery/phase-d/PHASE_D_REPORT.md
- storefront-liquid-discovery/phase-e/PHASE_E_REPORT.md
- storefront-liquid-discovery/phase-f/PHASE_F_REPORT.md
- storefront-liquid-discovery/phase-g/PHASE_G_REPORT.md
- storefront-liquid-discovery/phase-h/PHASE_H_REPORT.md
- storefront-liquid-discovery/phase-i/PHASE_I_REPORT.md
- storefront-liquid-discovery/phase-i/QA_CERTIFICATION.md
- storefront-liquid-discovery/phase-j/ARB_APPROVAL_PACKAGE.md
- storefront-liquid-discovery/phase-j/OBSERVABILITY_AND_ALERTING.md
- storefront-liquid-discovery/phase-j/PHASE_J_REPORT.md
- storefront-liquid-discovery/phase-j/README.md
- storefront-liquid-discovery/phase-j/RELEASE_NOTES.md
- storefront-liquid-discovery/phase-j/ROLLBACK_RUNBOOK.md
- storefront-liquid-discovery/phase-j/ROLLOUT_PLAN.md
- storefront-liquid-discovery/phase-j/ROLLOUT_READINESS_PACKAGE.md
- storefront-liquid-discovery/phase-k/PHASE_K_REPORT.md
- storefront-liquid-discovery/phase-k/THEME_PLATFORM_CONTRACT.md
- storefront-liquid-discovery/phase-l/AI_THEME_PLATFORM_CONTRACT.md
- storefront-liquid-discovery/phase-l/PHASE_L_REPORT.md
- storefront-theme-platform/API_CONTRACTS.md
- storefront-theme-platform/DATA_MODEL.md
- storefront-theme-platform/EDITOR_GUIDE.md
- storefront-theme-platform/PHASE_M_ADR.md
- storefront-theme-platform/PHASE_M_DISCOVERY.md
- storefront-theme-platform/PHASE_M_REPORT.md
- storefront-theme-platform/PREFLIGHT.md
- storefront-theme-platform/PROGRAM_STATE.md
- storefront-theme-platform/RESUME.md
- storefront-theme-platform/RISK_REGISTER.md
- storefront-theme-platform/SECURITY_MODEL.md
- storefront-theme-platform/SHOPIFY_PARITY_MATRIX.md
- storefront-theme-platform/phase-aa/CUSTOM_CODE_SECURITY.md
- storefront-theme-platform/phase-aa/PHASE_AA_DISCOVERY.md
- storefront-theme-platform/phase-aa/PHASE_AA_PLAN.md
- storefront-theme-platform/phase-aa/PHASE_AA_REPORT.md
- storefront-theme-platform/phase-aa/PHASE_AA_SECURITY_REVIEW.md
- storefront-theme-platform/phase-aa/PHASE_AA_TEST_REPORT.md
- storefront-theme-platform/phase-ab/PHASE_AB_DISCOVERY.md
- storefront-theme-platform/phase-ab/PHASE_AB_PLAN.md
- storefront-theme-platform/phase-ab/PHASE_AB_REPORT.md
- storefront-theme-platform/phase-ab/PHASE_AB_SECURITY_REVIEW.md
- storefront-theme-platform/phase-ab/PHASE_AB_TEST_REPORT.md
- storefront-theme-platform/phase-ab/SAFE_UPDATE_REFERENCE.md
- storefront-theme-platform/phase-ac/AI_CUSTOMIZATION_REFERENCE.md
- storefront-theme-platform/phase-ac/PHASE_AC_DISCOVERY.md
- storefront-theme-platform/phase-ac/PHASE_AC_PLAN.md
- storefront-theme-platform/phase-ac/PHASE_AC_REPORT.md
- storefront-theme-platform/phase-ac/PHASE_AC_SECURITY_REVIEW.md
- storefront-theme-platform/phase-ac/PHASE_AC_TEST_REPORT.md
- storefront-theme-platform/phase-ad/CANARY_READINESS_ARB_PACKAGE.md
- storefront-theme-platform/phase-ad/NOT_CONNECTED_REGISTER.md
- storefront-theme-platform/phase-ad/PHASE_AD_CERTIFICATION.md
- storefront-theme-platform/phase-ad/THEME_PLATFORM_CERTIFICATION.md
- storefront-theme-platform/phase-ae/PARTNER_READINESS.md
- storefront-theme-platform/phase-ae/PHASE_AE_DISCOVERY.md
- storefront-theme-platform/phase-ae/PHASE_AE_PLAN.md
- storefront-theme-platform/phase-ae/PHASE_AE_REPORT.md
- storefront-theme-platform/phase-ae/PHASE_AE_SECURITY_REVIEW.md
- storefront-theme-platform/phase-ae/PHASE_AE_TEST_REPORT.md
- storefront-theme-platform/phase-ae/PROGRAM_CAPSTONE.md
- storefront-theme-platform/phase-n/PHASE_N_DISCOVERY.md
- storefront-theme-platform/phase-n/PHASE_N_PLAN.md
- storefront-theme-platform/phase-n/PHASE_N_REPORT.md
- storefront-theme-platform/phase-n/PHASE_N_SECURITY_REVIEW.md
- storefront-theme-platform/phase-n/PHASE_N_TEST_REPORT.md
- storefront-theme-platform/phase-o/PHASE_O_DISCOVERY.md
- storefront-theme-platform/phase-o/PHASE_O_PLAN.md
- storefront-theme-platform/phase-o/PHASE_O_REPORT.md
- storefront-theme-platform/phase-o/PHASE_O_SECURITY_REVIEW.md
- storefront-theme-platform/phase-o/PHASE_O_TEST_REPORT.md
- storefront-theme-platform/phase-p/PHASE_P_DISCOVERY.md
- storefront-theme-platform/phase-p/PHASE_P_MIGRATION_REPORT.md
- storefront-theme-platform/phase-p/PHASE_P_PLAN.md
- storefront-theme-platform/phase-p/PHASE_P_REPORT.md
- storefront-theme-platform/phase-p/PHASE_P_SECURITY_REVIEW.md
- storefront-theme-platform/phase-p/PHASE_P_TEST_REPORT.md
- storefront-theme-platform/phase-q/PHASE_Q_DISCOVERY.md
- storefront-theme-platform/phase-q/PHASE_Q_PLAN.md
- storefront-theme-platform/phase-q/PHASE_Q_REPORT.md
- storefront-theme-platform/phase-q/PHASE_Q_SECURITY_REVIEW.md
- storefront-theme-platform/phase-q/PHASE_Q_TEST_REPORT.md
- storefront-theme-platform/phase-r/PHASE_R_DISCOVERY.md
- storefront-theme-platform/phase-r/PHASE_R_PLAN.md
- storefront-theme-platform/phase-r/PHASE_R_REPORT.md
- storefront-theme-platform/phase-r/PHASE_R_TEST_REPORT.md
- storefront-theme-platform/phase-s/PHASE_S_DISCOVERY.md
- storefront-theme-platform/phase-s/PHASE_S_PLAN.md
- storefront-theme-platform/phase-s/PHASE_S_REPORT.md
- storefront-theme-platform/phase-s/PHASE_S_SECURITY_REVIEW.md
- storefront-theme-platform/phase-s/PHASE_S_TEST_REPORT.md
- storefront-theme-platform/phase-t/PHASE_T_DISCOVERY.md
- storefront-theme-platform/phase-t/PHASE_T_PLAN.md
- storefront-theme-platform/phase-t/PHASE_T_REPORT.md
- storefront-theme-platform/phase-t/PHASE_T_SECURITY_REVIEW.md
- storefront-theme-platform/phase-t/PHASE_T_TEST_REPORT.md
- storefront-theme-platform/phase-u/CONTROL_TYPE_REFERENCE.md
- storefront-theme-platform/phase-u/PHASE_U_DISCOVERY.md
- storefront-theme-platform/phase-u/PHASE_U_PLAN.md
- storefront-theme-platform/phase-u/PHASE_U_REPORT.md
- storefront-theme-platform/phase-u/PHASE_U_TEST_REPORT.md
- storefront-theme-platform/phase-v/PHASE_V_DISCOVERY.md
- storefront-theme-platform/phase-v/PHASE_V_PLAN.md
- storefront-theme-platform/phase-v/PHASE_V_REPORT.md
- storefront-theme-platform/phase-v/PHASE_V_TEST_REPORT.md
- storefront-theme-platform/phase-v/TEMPLATE_REFERENCE.md
- storefront-theme-platform/phase-w/DYNAMIC_SOURCES_REFERENCE.md
- storefront-theme-platform/phase-w/PHASE_W_DISCOVERY.md
- storefront-theme-platform/phase-w/PHASE_W_PLAN.md
- storefront-theme-platform/phase-w/PHASE_W_REPORT.md
- storefront-theme-platform/phase-w/PHASE_W_SECURITY_REVIEW.md
- storefront-theme-platform/phase-w/PHASE_W_TEST_REPORT.md
- storefront-theme-platform/phase-x/MEDIA_LIBRARY_REFERENCE.md
- storefront-theme-platform/phase-x/PHASE_X_DISCOVERY.md
- storefront-theme-platform/phase-x/PHASE_X_PLAN.md
- storefront-theme-platform/phase-x/PHASE_X_REPORT.md
- storefront-theme-platform/phase-x/PHASE_X_SECURITY_REVIEW.md
- storefront-theme-platform/phase-x/PHASE_X_TEST_REPORT.md
- storefront-theme-platform/phase-y/APP_BLOCK_REFERENCE.md
- storefront-theme-platform/phase-y/PHASE_Y_DISCOVERY.md
- storefront-theme-platform/phase-y/PHASE_Y_PLAN.md
- storefront-theme-platform/phase-y/PHASE_Y_REPORT.md
- storefront-theme-platform/phase-y/PHASE_Y_SECURITY_REVIEW.md
- storefront-theme-platform/phase-y/PHASE_Y_TEST_REPORT.md
- storefront-theme-platform/phase-z/LOCALIZATION_REFERENCE.md
- storefront-theme-platform/phase-z/PHASE_Z_DISCOVERY.md
- storefront-theme-platform/phase-z/PHASE_Z_PLAN.md
- storefront-theme-platform/phase-z/PHASE_Z_REPORT.md
- storefront-theme-platform/phase-z/PHASE_Z_SECURITY_REVIEW.md
- storefront-theme-platform/phase-z/PHASE_Z_TEST_REPORT.md
