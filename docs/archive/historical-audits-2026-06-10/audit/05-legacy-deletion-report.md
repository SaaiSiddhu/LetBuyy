# 05 — Legacy Deletion Report (Phase 4) + Exact File Lists (Deliverables 4, 14, 18)

Dead-code and legacy audit. Every item: path, evidence of non-use, risk, deletion order. Git facts verified: `build/` untracked, `.DS_Store` untracked (13 on disk). **No file may be deleted before its listed gate passes.** Run `node scripts/validate-governance.mjs` + `turbo typecheck` after each wave.

---

## 1. Wave D0 — Zero-risk (delete immediately; no build impact possible)

### D0.1 Root working ledgers — 68 files, ≈1.3 MB (orphaned: referenced by no source, no governance doc, no AGENTS.md)
KEEP: `AGENTS.md`, `CLAUDE.md`, `README.md`. DELETE (exact list):

```
BRANDING_RECOMMENDATIONS.md            CODEX_BRAND_UNIFICATION_MISSION.md
CODEX_DESIGN_SYSTEM_LEDGER.md          CODEX_DEVELOPER_ECOSYSTEM_STATUS.md
CODEX_ENV_CLEANUP_LEDGER.md            CODEX_ENV_CLEANUP_STATUS.md
CODEX_FEDERATION_LEDGER.md             CODEX_FEDERATION_MISSION.md
CODEX_FEDERATION_STATUS.md             CODEX_FOUNDATION_MISSION.md
CODEX_FOUNDATION_STATUS_V2.md          CODEX_IDENTITY_MARKETING_LEDGER.md
CODEX_MARKETPLACE_LEDGER.md            CODEX_MASTER_EXECUTION_LEDGER.md
CODEX_MASTER_EXECUTION_STATUS.md       CODEX_MISSION_LEDGER.md
CODEX_MOBILE_PARITY_LEDGER.md          CODEX_MOBILE_PARITY_STATUS.md
CODEX_OPERATIONS_LEDGER.md             CODEX_PARALLEL_STREAMS.md
CODEX_PRODUCTION_LEDGER.md             CODEX_PRODUCTION_READINESS_MISSION.md
CODEX_PRODUCTION_STATUS.md             CODEX_REMEDIATION_LEDGER.md
CODEX_SHOPIFY_EXPERIENCE_STATUS.md     CODEX_SHOPIFY_UX_LEDGER.md
CODEX_SHOPIFY_UX_MISSION.md            CODEX_STOREFRONT_LEDGER.md
CODEX_WS10_LEDGER.md                   CODEX_WS11_LEDGER.md
CODEX_WS11_STATUS.md                   CODEX_WS12_LEDGER.md
CODEX_WS12_STATUS.md                   CODEX_WS13_LEDGER.md
CODEX_WS13_STATUS.md                   CODEX_WS1_LEDGER.md
CODEX_WS7_LEDGER.md                    CODEX_WS9_LEDGER.md
DESIGN_SYSTEM_V2.md                    EMPTY_STATE_SYSTEM.md
FOUNDATION_STATUS.md                   LETBUYY_BRAND_DECISION_REPORT.md
LETBUYY_BRAND_PREVIEW.md               LETBUYY_BRAND_SYSTEM_V1.md
LETBUYY_COLOR_IMPACT_REPORT.md         LETBUYY_COLOR_MIGRATION_REPORT.md
LETBUYY_COLOR_UNIFICATION_PLAN.md      LETBUYY_DEEP_AUDIT_AND_SHOPIFY_BLUEPRINT.md
LETBUYY_ENTERPRISE_ARCHITECTURE_AUDIT.md  LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md
LETBUYY_FOUNDATION_MISSION.md          LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md
LETBUYY_SHOPIFY_PARITY_BLOCKERS.md     LETBUYY_STAGING_PRODUCTION_ONLY_PLAN.md
LETBUYY_STATE.md                       LETBUYY_UX_RECONSTRUCTION_REPORT.md
SHOPIFY_GAP_ANALYSIS.md                STORYBOOK_PREVIEW_REPORT.md
TOKEN_AUDIT_REPORT.md                  TOKEN_MIGRATION_REPORT.md
UI_POLISH_AUDIT.md                     UI_POLISH_EXECUTION_REPORT.md
WAVE1_REPORT.md  WAVE2_REPORT.md  WAVE3_REPORT.md  WAVE4_FULL_FLUTTER_REPORT.md
WAVE4_PILOT_REPORT.md  WAVE5_REPORT.md  WAVE6_REPORT.md  WAVE7_REPORT.md
```
Risk: SAFE. Option: `git mv` to `docs/archive/ledgers-2026-06/` instead of delete if provenance wanted.

### D0.2 Agent-scaffold directories & files
| Path | Evidence | Risk |
|---|---|---|
| `.codex/` (empty), `.codex-dev.log` (0 bytes) | empty | SAFE |
| `Audit/` (6 report_part*.md) | historical AI audit, unreferenced | SAFE |
| `memory/lessons.md`, `tasks/{todo.md,env-setup-skips.md}` | agent notes; **note** AGENTS.md tells agents to read them — update AGENTS.md in same commit | SAFE w/ AGENTS.md edit |
| `artifacts/shopify-ux/` (~26 MB PNG before/after) | unreferenced by CI/source | SAFE |
| `build/` (~45 MB Flutter output, untracked) | build artifact | SAFE; ensure `.gitignore` has `build/` |
| 12 × `.DS_Store` | macOS noise, untracked | SAFE; ensure `.gitignore` entry |
| `apps/merchant-control-plane/fix_markdown.py` | targets a .md that no longer exists (glob-verified) | SAFE |

### D0.3 Empty directories (22) — all SAFE
```
apps/app-marketplace/src/lib/{types,auth,supabase}/
apps/identity-platform/src/lib/supabase/
apps/merchant-control-plane/src/lib/supabase/
apps/merchant-control-plane/src/app/codex-theme-editor-empty-proof/
apps/merchant-control-plane/src/app/__codex-theme-editor-empty-proof/
apps/merchant-control-plane/src/app/api/subscribe/status/
apps/storefront-runtime/src/types/
apps/storefront-runtime/src/app/api/payments/paypal/{webhook,capture,create}/
apps/storefront-runtime/src/app/api/payments/razorpay/{verify,create}/
apps/storefront-runtime/src/app/api/payments/stripe/{webhook,checkout}/
apps/storefront-runtime/src/app/api/customer/request-password-reset/
apps/theme-marketplace/src/{types,lib/supabase}/
apps/mobile/merchant-app/lib/screens/{profile,onboarding}/
packages/.tmp/
```

### D0.4 Archived docs
`docs/archive/migrations-history/` (SQL 001–072, superseded by `database/supabase/migrations/000_baseline.sql`) — SAFE. `docs/archive/flutter-legacy/` — SAFE. Remainder of `docs/archive/` (14 MB total): Wave D2 review.

## 2. Wave D1 — Low risk (gate: `turbo typecheck` + `turbo build` green after)

| Path | Evidence | Risk |
|---|---|---|
| `apps/merchant-control-plane/src/components/theme-editor/{AddSectionModal,CenterPanel,EditorHeader,IconRail,LeftSidebar,RightSidebar,SectionItem,ThemeSettingsPanel}.tsx` (8 files) | grep: zero importers; live editor imports only `SchemaFormRenderer` | LOW |
| `@letbuyy/extension-host` in `apps/merchant-control-plane/package.json` | 0 imports in app src | LOW |
| Env template vars: `APPLE_OAUTH_CLIENT_ID/SECRET`, `RAZORPAY_ROUTE_{ACCOUNT_ID,KEY_SECRET,WEBHOOK_SECRET,MODE}`, `NEXT_PUBLIC_API_URL` alias — in `config/env/*.example|*.template` only | zero source references | LOW (template-only edit) |
| `turbo.json` build env `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` | apps no longer read them; stale cache input | LOW |
| `apps/mobile/operator-app/` | verbatim Flutter counter template; **keep `runtime.manifest.json` + `AGENTS.md`** (canonical runtime slot per CLAUDE.md), delete `lib/`, `web/`, platform dirs | LOW; check CI matrix first |
| `legacy/firebase/` (rules, functions, indexes, `firebase.json` referencing dead `apps/admin`) | platform is Supabase; no CI references (verified in workflows) | LOW |
| `.github/workflows/production-deploy.yml` **or** `deploy-production.yml` | overlapping triggers (both push→main); pick one, delete other | LOW; diff first |
| `apps/storefront-runtime/src/app/api/seed/route.ts` | dev seeding; 410 in prod | LOW; delete at Phase 1 or guard behind env allowlist |

## 3. Wave D2 — Review-gated (medium; product/CI confirmation required)

| Path | Question to settle | Risk |
|---|---|---|
| `apps/merchant-control-plane/src/app/[store]/appearance/page.tsx` | Fold brand settings into theme settings (V-08) then delete | MEDIUM |
| `docs/archive/` remainder | provenance value only | MEDIUM |
| `database/supabase/verification/*.sql` (17) | keep if wired into migration smoke job (currently not in CI) | MEDIUM |
| `tests/{api-graphql,billing,gst,localization,logistics}/` | audit individually for empty stubs | MEDIUM |
| `supabase/` root dir | keep `config.toml` (local dev); delete empty `migrations/` + nested residue to stop root-vs-`database/supabase` confusion | MEDIUM |
| `chaos/`, `load/` | KEEP (governance-wired) but descope validators that fake-gate on them (doc 17) | — |
| Validator suite (132) | retire ~60% self-referential manifest asserts into one topology linter; keep import/topology/migration-safety/env validators | MEDIUM (CI gates reference `validate:governance`) |

## 4. Wave D3 — Phase-7-gated deletions (delete only at storefront cutover; doc 14)

```
apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx
apps/storefront-runtime/src/components/sections/  (20 files — after Liquid parity per-section)
apps/storefront-runtime/src/components/layout/dynamic-header.tsx
apps/storefront-runtime/src/components/layout/dynamic-footer.tsx
apps/storefront-runtime/src/lib/demo/urban-kicks-demo.ts
store-service.ts: normalizeSectionType() alias map, isUrbanKicksDemoSubdomain(), urban-kicks fallback
apps/storefront-runtime/src/app/api/customer/** + api/orders/{check,login,set-password} (10 routes → gateway)
packages/theme-engine/src/theme-renderer.ts: JsonContractThemeRenderer (after converter ships)
DB: theme_editor_drafts table + theme_preview_sessions.draft_id legacy pointer (doc 11)
Editor page.tsx: PREVIEW_PRODUCTS, REQUIRED_URBAN_KICKS_SECTIONS constants
```
Risk: HIGH if premature — each item has a named replacement task in doc 14.

## 5. Explicit DO-NOT-DELETE register

`pubspec.yaml`/`pubspec.lock`/`analysis_options.yaml` (root = live Flutter workspace); `apps/developer-portal/` (working shell, future SDK home); `apps/mobile/shopper-app/` manifest (reserved runtime slot — deleting violates runtime-boundaries.md); `docs/governance/**` (referenced by every runtime.manifest.json); `chaos/`, `load/`; `database/supabase/migrations/**`; `config/runtime/**` until validator descope lands; `packages/distributed-runtime` et al. (unexercised ≠ unused — gateway/queue-workers import them; revisit post-Phase 9).

## 6. Unused-dependency verdicts (package.json level)

- merchant-control-plane: drop `@letbuyy/extension-host` (D1). `@letbuyy/theme-engine` **stays** (editor page imports `getSectionSchemas`/`getThemeSettingsSchema`/`getDefaultStorefrontThemeTemplate`/`hasRenderableThemeTemplate`).
- storefront-runtime / identity-platform / theme-engine: no unused deps found (`@vercel/speed-insights` verify-then-keep).
- Feature-flag SDK (`evaluateFeatureFlag` in shared-types): defined, never called by apps/services — **keep SDK, note zero flags defined**; do not build flag tooling until a consumer exists.

## 7. Database deletion candidates (execute via doc 11 migrations, not file deletes)

`theme_editor_drafts` (after draft convergence); `inventory_level_duplicate_snapshots` (name self-describes as dedupe artifact — verify writer absent); legacy pointer columns: `theme_preview_sessions.draft_id`, `sites.template_config` (post-release-snapshot era: demote to cache or drop), dual `site_id`/`store_id` (collapse → one, doc 11 §2). Unused-by-code tables to confirm before drop: `theme_migrations`, `app_billing_charges`, `smart_collections` (writer search required — flagged, not yet proven dead).

## 8. Summary counts

| Wave | Items | Bytes reclaimed (approx) |
|---|---|---|
| D0 | 68 ledgers + 7 dirs/files + 22 empty dirs + archives | ~90 MB (incl. 26 MB screenshots, 45 MB build/) |
| D1 | 8 components + 1 dep + 7 env vars + 1 workflow + operator-app lib + legacy/firebase | ~2 MB |
| D2 | review set | n/a |
| D3 | ~35 source files + 1 table + legacy columns | n/a (architectural) |

Nothing in D0–D1 is referenced by `scripts/validate-governance.mjs` (its file-existence lists cover `docs/governance/`, manifests, infra — not ledgers; verified in `scripts/validators/architecture-validator.mjs` hardcoded list). Re-run it after every wave regardless.
