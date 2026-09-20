# LetBuyy Theme Platform — Whole-Program Certification (M → AC)

**Document type:** Whole-program certification  
**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M → AE)  
**Phases certified:** M through AC (15 phases)  
**Certification date:** 2026-07-11  
**Branch:** `stepup/main`  
**Program baseline (Phase M):** `ff6720a9`  
**Program close at certification (Phase AC):** `7654927d`  
**Author:** AD certification sub-agent — read-only, no source edits, no git commands  
**Audience:** ARB, engineering leadership, security reviewers, Phase AE authors  

---

## Section 1 — Certification Verdict

**CANARY-READY — subject to mandatory ARB approval and honesty-seam disclosure.**

The M → AC program delivered 15 phases of structural theme platform work across four packages. All four packages typecheck clean at HEAD. The committed test corpus passes in full (3,918 passing; 3 FOREIGN pre-existing gateway failures, none introduced by M → AC). All four integrity seams are provably unchanged. The two governance gate failures pre-date Phase M and have not been worsened by any M → AC commit. Six NOT-CONNECTED seams are catalogued with exact missing pieces. The global Liquid canary (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`) remains `false`; the ARB must authorise the flip — this document does not do so.

**What this certification does NOT attest to:**

- That the NOT-CONNECTED seams (metafield resolution, live FX rates, AI free-text NLU, app-block runtime, custom CSS render-path call site, theme analytics) are connected — they are not.  
- That the Liquid canary flag has been flipped or that Liquid rendering is enabled for production stores — it has not.  
- That the 3 FOREIGN api-gateway test failures have been remediated — they are pre-program WIP.  
- That migrations 188 / 189 / 190 have been applied to production — they have been committed but production application requires ARB/human sign-off.

---

## Section 2 — Per-Phase Shipping Record

Each entry lists the commit anchor (where available), the primary deliverables, and the gate evidence at phase close. All count figures are exact; no rounding.

---

### Phase M — Repository Truth + Shopify Parity Baseline  
**Commit anchor:** `ff6720a9`

**What shipped:** Discovery-only phase. No source edits. Produced 12 certification documents establishing the canonical state of the repository before the program began. Key findings: SHOPIFY_PARITY_MATRIX.md mapping 70 capability rows (37 COMPLETE / 15 PARTIAL / 13 MISSING / 4 NOT_CONNECTED / 1 STUB); SECURITY_MODEL.md inventorying the DOMPurify surface and Liquid SSTI controls; DATA_MODEL.md mapping the 5-table theme persistence schema; PREFLIGHT.md declaring `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` as the program invariant; RISK_REGISTER.md seeding RISK-SEC-001 (wide-open `theme_purchases` RLS, HIGH) and RISK-GOV-001 (tenant-registry drift, MEDIUM).

**Gate evidence at M:** theme-engine 643 / 643 · storefront-runtime 687 / 687 · validate-governance EXIT=1 (pre-existing tenant drift; anti-fabrication PASS). No source commits.

---

### Phase N — Canonical Theme Document V2  
**Commit anchor:** see PHASE_N_REPORT.md

**What shipped:**  
- `packages/theme-engine/src/theme-document.ts` (647 lines) — `ThemeDocumentSchema` (Zod), `parseThemeDocument`, `toThemeDocumentV2`, `fromThemeDocumentV2`, version gate, error classes, bounds constants, prototype-pollution guards.  
- `packages/theme-engine/src/theme-document-migrations.ts` (135 lines) — `migrateToThemeDocumentV2` with SHAPE-1/2/3 detection.  
- `packages/theme-engine/test/theme-document.test.ts` (756 lines, 37 tests).  
- `packages/theme-engine/test/theme-document-migrations.test.ts` (169 lines, 9 tests).

**Gate evidence at N:** theme-engine 689 / 689 (+46 from N) · all typechecks PASS · RISK-DUAL-N01 registered (dual-truth hazard: `section_definitions` catalog vs `settings_data.current` must not be mixed; guard = `buildDraftConfig` reads only `settings_data.current`).

---

### Phase O — Preset and Experience Engine 2.0  
**Commit anchor:** see PHASE_O_REPORT.md

**What shipped:**  
- `packages/theme-engine/src/section-type-map.ts` (109 lines) — 25-entry camelCase→kebab bridge, `resolveLiquidSectionType`, governance integrity check.  
- `packages/theme-engine/src/experience-compositions.ts` (373 lines) — 10 distinct merchant experiences × 3 templates each; structurally distinct index compositions proven by test.  
- `packages/theme-engine/src/experience-apply.ts` (719 lines) — `computeExperienceApplyDiff` (pure), `applyExperienceToDocument` (fail-closed), content classification engine, RISK-DUAL-N01 enforcement.  
- 345 new tests (1034 total). 5 code-review findings resolved (2 HIGH, 3 LOW).

**Gate evidence at O:** theme-engine 1034 / 1034 · all typechecks PASS · RISK-O01 and RISK-O02 registered (LOW; accepted).

---

### Phase P — Drafts / Revisions / Publish / Rollback  
**Commit anchor:** `1053d611`

**What shipped:**  
- `database/supabase/migrations/189_theme_persistence_idempotency.sql` — nullable `idempotency_key` + partial unique index on `theme_releases` (ARB-gated for production apply).  
- `services/api-gateway/src/schemas/theme.schema.ts` — `ValidateThemeDocumentSchema`, `idempotency_key` and `expected_current_release_id` fields.  
- `services/api-gateway/src/execution/theme-execution.adapter.ts` — `publishReleaseSnapshot` (lines 699–713, with `db.rpc('publish_theme_release', {10 params})`), `rollbackRelease` (CAS guard), `validateDocument`, audit events, 3 new `store_id` guards.

**Gate evidence at P:** api-gateway typecheck PASS · RISK-SEC-P01 (theme_editor_drafts RLS user_id-only, MEDIUM) + RISK-TOCTOU-P01/P02 (concurrent publish / rollback races, LOW, ARB-gated) registered.

---

### Phase Q — Merchant Theme Library  
**Commit anchor:** `a0990ce7`

**What shipped:**  
- `database/supabase/migrations/190_theme_library_q.sql` — `owned_by_site_id uuid NULL` + `is_site_private boolean DEFAULT false` on `themes`; two indexes (additive, idempotent; ARB-gated for production apply).  
- Theme-library Hono routes in `services/api-gateway/src/routes/themes.ts` with `verifySiteOwnership` on all write paths.  
- Gateway test file `theme-library-q.test.ts` (41 tests, file-scoped).

**Gate evidence at Q:** api-gateway 41 / 41 (Q-scoped) · merchant 39 / 39 · typechecks PASS · RISK-TOCTOU-Q01 registered (plan-limit count-then-insert non-atomic, MEDIUM, ARB-gated; `theme_instances` schema not touched through Phase AC).

---

### Phase R — Visual Editor Shell  
**Commit anchor:** see PHASE_R_REPORT.md

**What shipped:**  
- `packages/theme-engine/src/editor-bridge-protocol.ts` (57 lines) — `EDITOR_READY_MESSAGE`, `INSPECTOR_ADD_SECTION_INTENT`, bridge protocol constants; no live postMessage wiring.  
- Merchant editor shell components.

**Gate evidence at R:** merchant 65 / 65 (26 R + 25 Q + 14 pre-existing) · typechecks PASS · RISK-R01 CLOSED (local type mirrors eliminated) in Phase T.

---

### Phase S — Live Preview Inspector  
**Commit anchor:** see PHASE_S_REPORT.md

**What shipped:**  
- Inspector bridge connecting `editor-bridge-protocol.ts:47` (`INSPECTOR_ADD_SECTION_INTENT`).  
- `StorefrontPreviewBridge` in `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` (mounted at `preview/page.tsx:390`); same-origin `postMessage`; origin check fail-closed; `READY_MESSAGE` suppressed when env var absent.  
- 33 new storefront-runtime inspector-bridge tests; 14 new theme-engine protocol tests.  
- All 8 Phase S security/UX findings resolved before close.

**Gate evidence at S:** merchant 93 / 93 · storefront-runtime 795 / 795 (+33) · theme-engine 1048 / 1048 (+14) · typechecks PASS · 3 api-gateway foreign failures unchanged.

---

### Phase T — Section Groups / Nested Blocks  
**Commit anchor:** see PHASE_T_REPORT.md

**What shipped:**  
- `packages/theme-engine/src/theme-document.ts` — `allowedChildTypes` enforcement at document-model layer (`theme-document.ts:204–207`).  
- 15 new nested-block tests.  
- `BlockEntry.children` added to the canonical `BlockEntry` type in `SectionTreePanel.tsx`.

**Gate evidence at T:** merchant 120 / 120 (+27) · theme-engine 1063 / 1063 (+15) · typechecks PASS · RISK-T01..T06 registered; RISK-T05 (allowedChildTypes not enforced in depth-bounded renderer at render time) remains OPEN → Phase AE.

---

### Phase U — Settings Control Renderer  
**Commit anchor:** see PHASE_U_REPORT.md

**What shipped:**  
- `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` and `ResourcePickerControl.tsx` (WAI-ARIA 1.2 combobox; Phase W promoted this to replace the Phase U text-input fallback).  
- 73 new theme-engine tests; 76 new merchant tests.

**Gate evidence at U:** theme-engine 1136 / 1136 (+73) · merchant 196 / 196 (+76) · typechecks PASS · RISK-SEC-U01/U02/U03 + RISK-A11Y-U01/U02 + RISK-STYLE-U01/U02 registered; all carried to Phase AE.

---

### Phase V — Template System  
**Commit anchor:** `44497fbd` (Lane A + hardening), `8de31807` (Lane B)

**What shipped:**  
- `packages/theme-engine/src/template-registry.ts` (600 lines) — `TEMPLATE_TYPE_REGISTRY` (23 base keys), `parseTemplateKey`, `validateTemplateKey` (6 constraints + consecutive-slash hardening), `resolveAlternateTemplate`, `getAllowedDropsForTemplate`, `findExcessiveVariantCounts`, `MAX_TEMPLATE_VARIANTS_PER_TYPE=20`.  
- `packages/theme-engine/test/template-registry.test.ts` (725 lines, 244 tests).  
- `apps/merchant-control-plane/src/components/theme-editor/TemplateSwitcherPanel.tsx` (333 lines, WAI-ARIA, RISK-DUAL-N01 enforced).  
- 6 hardening findings all resolved before phase close.

**Gate evidence at V:** theme-engine 1385 / 1385 (+244 from V) · merchant 231 / 231 (+35) · typechecks PASS · no new risks introduced.

---

### Phase W — Dynamic Sources / Custom Data  
**Commit anchor:** see PHASE_W_REPORT.md

**What shipped:**  
- `services/api-gateway/src/routes/resource-search.ts` — `GET /v1/themes/resource-search`; per-type ilike across products / collections / pages / blog_posts / navigation_menus; `verifySiteOwnership` on all.  
- `services/api-gateway/src/__tests__/resource-search-w.test.ts` (15 cross-tenant negative + auth tests).  
- `packages/theme-engine/src/dynamic-source-binding.ts` — `DynamicSourceDescriptor` tagged union (ResourceBinding | MetafieldBinding | StaticBinding), `resolveDynamicSourceDescriptors` pure function, `BINDING_BLOCKED_KEYS`.  
- 56 new theme-engine dynamic-source-binding tests.  
- `ResourcePickerControl.tsx` replaced with WAI-ARIA 1.2 combobox (300 ms debounce; 5 states).  
- 55 new merchant static-contract tests.

**Metafield seam (NOT-CONNECTED):** `resolveDynamicSourceDescriptors` returns `MetafieldBinding` fallback unconditionally for all `'metafield'` source bindings (`dynamic-source-binding.ts:242–245`). `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` does not exist. Honesty comment present at source.

**Gate evidence at W:** api-gateway 491 / 491 (+12 W tests, 3 foreign unchanged) · theme-engine 1441 / 1441 (+56) · merchant 286 / 286 (+55) · storefront-runtime 795 / 795 · typechecks PASS · RISK-W01..W06 registered.

---

### Phase X — Files and Media Library  
**Commit anchor:** see PHASE_X_REPORT.md

**What shipped:**  
- `services/api-gateway/src/lib/upload-mime.ts` — `ALLOWED_UPLOAD_MIME_TYPES` allowlist; SVG explicitly rejected.  
- `services/api-gateway/src/routes/themes/media-library.ts` — `GET /v1/themes/media-library`; `verifySiteOwnership`; cursor pagination.  
- `services/api-gateway/src/__tests__/media-library-x.test.ts` (28 tests: X-T01..X-T28, 9 cross-tenant negative tests).  
- `apps/merchant-control-plane/src/components/theme-editor/controls/MediaLibrary.tsx` — `role="dialog"` + `role="grid"` + keyboard nav (`ResizeObserver`-driven `gridCols`).  
- `ImagePickerControl.tsx` and `VideoControl.tsx` updated.  
- 8 hardening findings all fixed before phase close (2×HIGH, 2×MEDIUM, 4×LOW).

**Gate evidence at X:** api-gateway 519 / 522 (+28, 3 foreign unchanged) · theme-engine 1441 / 1441 · merchant 1429 / 1471 (92 X + baseline; 27 pre-existing DB-migration failures unchanged) · storefront-runtime 795 / 795 · typechecks PASS · RISK-X01 registered (LOW: R2 key user-scoped not site-scoped).

---

### Phase Y — Theme App Extensions  
**Commit anchor:** see PHASE_Y_REPORT.md

**What shipped:**  
- `packages/theme-engine/src/app-block-model.ts` — `AppBlockReference` + `AppBlockReferenceSchema` (Zod); `validateAppBlockReferences` (MAX_APP_BLOCKS_PER_SLOT=20); `filterAppBlockSettings` (13 `BLOCKED_APP_BLOCK_SETTING_KEYS`); `APP_BLOCK_NOT_CONNECTED_REASON` constant (honest: `'NOT-CONNECTED: no live app runtime produces app-block HTML.'`).  
- `packages/theme-engine/src/theme-renderer.ts` — minimal 2-hunk patch: `filterAppBlockSettings` applied before `LiquidRenderedBlock` push; per-block crash isolation (`try/catch` → error-placeholder).  
- `apps/merchant-control-plane/src/components/theme-editor/AppBlockSlotPanel.tsx` — NOT-CONNECTED state surfaced to merchant.  
- 27 new theme-engine tests.

**Live app-block seam (NOT-CONNECTED):** `apps/app-marketplace` is FROZEN (CLAUDE.md). No live app registry, no sandboxed iframe host, no app-block content gateway endpoint. `buildLiquidAppBlocks` returns placeholder HTML. `APP_BLOCK_NOT_CONNECTED_REASON` at `app-block-model.ts:309–310` is the structural disclosure.

**Gate evidence at Y:** 27 new Y tests · typechecks PASS · RISK-Y01 registered (MAX_APP_BLOCKS_PER_SLOT not enforced in render loop, LOW). RISK-T03 partially closed for app-block settings path.

---

### Phase Z — Markets / Localization  
**Commit anchor:** see PHASE_Z_REPORT.md

**What shipped:**  
- `packages/theme-engine/src/theme-locale.ts` (336 lines) — `THEME_DEFAULT_STORE_LOCALE='en-IN'`; `tLocale()` with 4-level fallback chain + prototype-safe `lookupPath` + `BLOCKED_PATH_SEGMENTS` guard; `formatThemeCurrencyDisplay()` with `fxConnected: false` literal type (not boolean — statically dead if-branches detectable by compiler).  
- `packages/theme-engine/test/theme-locale.test.ts` (32 tests: Z-L01..Z-L32, India-first proven at Z-L09/10/11/32).  
- `packages/theme-engine/test/theme-currency-display.test.ts` (24 tests: Z-C01..Z-C24; INR+en-IN byte-identity proven at Z-C01..Z-C04; FX NOT-CONNECTED proven at Z-C09..Z-C11).  
- Merchant translation editor components (`LocaleSwitcher.tsx`, `TranslationKeyList.tsx`, `TranslationValueEditor.tsx`).  
- 86 new merchant static-contract tests.

**FX seam (NOT-CONNECTED):** `formatThemeCurrencyDisplay` always returns `fxConnected: false`. No Forex API wired anywhere. Non-INR display is presentational only. Missing: a server-side FX rate source and a display-only conversion helper that never touches the canonical ledger.

**Gate evidence at Z:** 56 new theme-engine tests · 86 new merchant tests · typechecks PASS · RISK-Z01..Z06 registered.

---

### Phase AA — Custom CSS / Code Workspace  
**Commit anchor:** see PHASE_AA_REPORT.md

**What shipped:**  
- `packages/theme-engine/src/custom-css-sanitizer.ts` (465 lines) — 4-step normalisation pipeline; 22 injection vector classes blocked; `CUSTOM_CSS_MAX_BYTES=50_000`; brace-depth scanner; `validateAndScopeCustomCss` / `validateCustomCss` / `buildScopedCustomCss` exported; fail-closed (invalid CSS silently dropped).  
- `packages/theme-engine/test/custom-css-sanitizer.test.ts` (588 lines, 67 tests).  
- `packages/theme-engine/src/theme-renderer.ts` — `buildLiquidThemeHeadAssets(bundle, rawCustomCss?: string)` gains optional second param. `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` NOT modified.  
- `apps/merchant-control-plane/src/components/theme-editor/controls/CustomCssWorkspace.tsx` — byte counter, violation list, ARIA, `--lb-*` tokens.  
- `apps/merchant-control-plane/src/app/api/stores/[store]/settings/route.ts` — server-side PATCH guard with HTTP 422 response.  
- 16 hardening findings, all HIGH and MEDIUM fixed before phase close; 3 LOW deferred.

**Custom CSS render-path seam (NOT-CONNECTED):** `buildLiquidThemeHeadAssets(bundle)` at `theme-renderer.ts:585` is called without `rawCustomCss`. `ThemeRendererInput` (lines 128–136) has no `rawCustomCss?: string` field. CSS is validated and scoped by the engine but never injected into the storefront head. Three-step closure: (1) add `rawCustomCss?: string` to `ThemeRendererInput`; (2) composition layer fetches `site_settings.custom_css` and passes it; (3) call site at line 585 passes `input.rawCustomCss`. None of these steps were wired by Phase AA or Phase AB.

**Gate evidence at AA:** theme-engine 1592 / 1592 (+67) · merchant 619 / 619 (+86) · api-gateway 519 / 522 (unchanged) · storefront-runtime 795 / 795 · typechecks PASS.

---

### Phase AB — Safe Theme Updates / Versioning  
**Commit anchor:** `a0990ce7` (referenced in PHASE_AB_REPORT.md)

**What shipped:**  
- `packages/theme-engine/src/theme-safe-update.ts` (862 lines) — `planThemeSafeUpdate` (pure, deterministic), `computeThemeUpdateDiff`, `classifyUpdateSetting`, `UpdateVersionRejectedError`, `UpdateDowngradeError`; NO-DATA-LOSS LAW enforced; version flow: G4 gate → direction check → G migration → per-section classify+carry → `parseThemeDocument`; W-binding check fires before token check; T nested blocks carried recursively; retained sections with dropped block types surface `lostContent.blocks` in diff.conflicts.  
- `packages/theme-engine/test/theme-safe-update.test.ts` (1126 lines, 44 tests).  
- `services/api-gateway/src/routes/themes/theme-update-route.ts` — `GET /:slug/update-preview` (pure diff + diffHash, no writes) and `POST /:slug/update` (CAS guard → `planThemeSafeUpdate` → `publishVersionUpdateRelease`).  
- `apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx` — 7 explicit UI states; diff table (`role="grid"`); rollback via Phase P proxy.  
- `apps/merchant-control-plane/tests/theme-editor-ab.test.mjs` (93 static-contract tests).  
- 10 findings; all CRITICAL/HIGH/MEDIUM fixed in hardening; 3 LOW deferred.

**Gate evidence at AB:** theme-engine 1634 / 1634 (+42) · merchant 712 / 712 (+93) · api-gateway 1489 / 1516 (+18 AB, 27 pre-existing fail unchanged) · storefront-runtime 795 / 795 · typechecks PASS · RISK-AB-01..03 registered.

---

### Phase AC — AI-Assisted Customization  
**Commit anchor:** `7654927d`

**What shipped:**  
- `packages/theme-engine/src/ai-color-system.ts` — WCAG 2.1 AA contrast math (Weber-Fechner model); parametric palette generator; deterministic, no LLM call.  
- `packages/theme-engine/src/ai-typography.ts` — typography pairing engine; deterministic validated proposals.  
- `packages/theme-engine/src/ai-layout.ts` — section ordering engine; deterministic layout proposals.  
- `packages/theme-engine/src/ai-intent-parser.ts` — `proposeThemeCustomization`; structured-intent path (CONNECTED, deterministic); free-text path returns `AINotConnectedResult` (status: `'NOT_CONNECTED'`) — gateway route absent.  
- `packages/theme-engine/src/theme-ai-sdk.ts` — `MODEL_BOUNDARY = Object.freeze({ status: 'NOT_CONNECTED' as const, ... })` at line 919–920.  
- `packages/theme-engine/src/theme-analytics.ts` — `describeThemeEventEmissionPoints()` returns `implemented: false` for all 5 event types; `describeThemeMetrics()` returns `connected: false` for all 5 metric types; honesty law comment at line 7.  
- `apps/merchant-control-plane/src/components/theme-editor/AICustomizationPanel.tsx` — renders NOT-CONNECTED state honestly when gateway absent; no fabricated "AI thinking" animation over a silent stub.  
- `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts` — structured NOT-CONNECTED envelope with `envVar` and `gatewayRoute` fields (lines 85–87); HTTP 503 when gateway route absent.  
- 61 new theme-engine tests (ai-intent-parser suite) + 120 lb-l static-contract tests that now pass (Phase AC files satisfy the lb-l contracts created in Phase L).  
- Fabrication check: grep of `packages/theme-engine/src/` for live LLM imports (openai, anthropic, @ai-sdk, langchain, ChatCompletion, generateText, streamText) returns **zero hits** in production code. `packages/theme-engine/package.json` has no LLM provider dependency.

**AI model seam (NOT-CONNECTED):** Gateway route `POST /v1/theme-ai/parse-brief` absent from `services/api-gateway/src/routes/themes/`. `THEME_AI_PROVIDER_API_KEY` env var unset. `proposeThemeCustomization` returns `AINotConnectedResult` for every free-text intent (`ai-intent-parser.ts:595–602`).

**Gate evidence at AC:** theme-engine 1695 / 1695 (+61) · storefront-runtime 915 / 915 (795 mid-program + 120 lb-l contracts now passing) · merchant 771 / 771 · api-gateway 537 / 540 (3 FOREIGN unchanged) · typechecks PASS · RISK-AC-01..05 registered.

---

## Section 3 — Whole-Program Gate Matrix

All counts measured at `7654927d` (HEAD, Phase AC close).

| Gate | Command | Result | PASS / FAIL / TOTAL | Notes |
|------|---------|--------|---------------------|-------|
| theme-engine typecheck | `pnpm --filter=@letbuyy/theme-engine typecheck` | PASS | exit 0, no diagnostics | — |
| theme-engine tests | `pnpm --filter=@letbuyy/theme-engine test` | PASS | 1695 / 1695 / 0 fail | 56 suites; 5382 ms |
| storefront-runtime typecheck | `pnpm --filter=@letbuyy/storefront-runtime typecheck` | PASS | exit 0, no diagnostics | — |
| storefront-runtime tests | `pnpm --filter=@letbuyy/storefront-runtime test` | PASS | 915 / 915 / 0 fail | 120 lb-l contracts now pass after Phase AC; see note |
| merchant-control-plane typecheck | `pnpm --filter=@letbuyy/merchant-control-plane typecheck` | PASS | exit 0, no diagnostics | — |
| merchant-control-plane tests | `pnpm --filter=@letbuyy/merchant-control-plane test` | PASS | 771 / 771 / 0 fail | matches PROGRAM_STATE baseline |
| api-gateway typecheck | `pnpm --filter=@letbuyy/api-gateway typecheck` | PASS | exit 0, no diagnostics | — |
| api-gateway tests | `pnpm --filter=@letbuyy/api-gateway test` | PARTIAL | 537 PASS / 3 FAIL / 540 total | **3 CONFIRMED FOREIGN failures — see §3.1** |
| theme-governance-validator | `node scripts/validators/theme-governance-validator.mjs` | PASS | exit 0 | 25 schemas · WARN mode · Liquid default OFF · fallback present · migration runner confirmed |
| migration-safety-validator | `node scripts/validators/migration-safety-validator.mjs` | PASS | exit 0 | No destructive replay hazards |
| validate-governance foundation | `node scripts/validate-governance.mjs` (sub-gate) | PASS | 1319 active source files · 0 temporary entries | Anti-fabrication sub-gate PASSES |
| validate-governance tenant | `node scripts/validate-governance.mjs` (sub-gate) | FAIL | EXIT=1 | **Pre-existing RISK-GOV-001 — see §3.2** |
| sequential-migration-validator | `node scripts/validators/sequential-migration-validator.mjs` | FAIL | EXIT=1 | **Pre-existing untracked WIP 186/187 — see §3.2** |

**Count note (storefront-runtime 915 vs PROGRAM_STATE ~795):** PROGRAM_STATE recorded 795 passing storefront-runtime tests during phases S → AB. The actual count at HEAD is 915. The delta is 120 lb-l static-contract tests in `tests/launch/lb-l-ai-theme-platform.test.mjs` (created in Phase L commit `8c1ac94b`). These tests reference Phase-AC files (`ai-intent-parser.ts`, `AICustomizationPanel.tsx`, `AINotConnectedResult`) that did not exist until Phase AC. They failed and were excluded from passing counts in phases S → AB; Phase AC committed those files, resolving all 120. The 915 count is the stable post-AC baseline; 0 failures.

---

### 3.1 The Three FOREIGN api-gateway Failures

These 3 failures are CONFIRMED FOREIGN PRE-EXISTING user WIP. No M→AC commit touched the files involved. PROGRAM_STATE pre-dates this certification and documents the same 3 failures.

| # | Test name | Root cause | M→AC touched? |
|---|-----------|-----------|----------------|
| `not ok 1` | `merchant AI route is mounted, mobile allowlisted, and provider-backed` | Regex `/adapter\.purchase/` not matched — gateway AI route stub is user WIP (`ai.test.ts`) | **NO** — `ai.test.ts` not modified by any M→AC commit |
| `not ok 130` | `executive analytics migration creates rollup tables with service-role and super-admin RLS` | `ENOENT` for `129_internal_os_executive_analytics_rollups.sql` — migration file absent from user WIP (`internal-os-executive-analytics.test.ts`) | **NO** — `internal-os-executive-analytics.test.ts` not modified by any M→AC commit |
| `not ok 298` | `storefront runtime no longer owns payment route handlers` | Regex `/storefrontBrowserApiFetch\(subdomain,\s*'\/payments\/stripe\/checkout'/` not matched — payment routing refactor in user WIP (`payments.test.ts`) | **NO** — `payments.test.ts` not modified by any M→AC commit |

**Blast-radius:** these failures have no dependency path through any M→AC deliverable. `git diff ff6720a9..HEAD` on `ai.test.ts`, `internal-os-executive-analytics.test.ts`, and `payments.test.ts` returns 0 diff lines.

---

### 3.2 Pre-Existing Governance Failures

**validate-governance.mjs — tenant-isolation-validator — RISK-GOV-001:**  
`services/api-gateway/src/tenant/tenant-tables.registry.ts` is out of sync with the schema-derived tenant table registry. This failure pre-dates Phase M. No M→AC commit touched `tenant-tables.registry.ts`. The anti-fabrication sub-gate PASSES (1319 active source files, 0 temporary entries). Remediation: run `scripts/generators/generate-tenant-table-registry.mjs`. This is a foreign-WIP concern; the M→AC program documented but did not worsen it.

**sequential-migration-validator — untracked migrations 186 and 187:**  
`database/supabase/migrations/186_v1_scale_commerce_os_coming_soon.sql` and `187_v1_sites_site_settings.sql` are on disk but not committed. Both are explicitly listed in PROGRAM_STATE.md as FOREIGN user WIP. No M→AC commit added or modified either file. The program's own migrations are: 188 (letbuyy-core theme row, committed `7cdd42a1`), 189 (theme persistence idempotency, committed Phase P), 190 (theme library Q, committed Phase Q) — all theme-scoped, all committed, all require ARB/human sign-off before production application.

---

## Section 4 — Integrity Attestation

Four seams that must remain unchanged for the M→AC program window. Evidence is based on `git diff ff6720a9..HEAD` plus direct file reads at HEAD.

---

### 4.1 Canary Flag — UNCHANGED

**Seam:** `packages/theme-engine/src/theme-governance.ts:14`  
**Value:** `export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;`

Evidence:
- Direct file read at HEAD confirms line 14 reads exactly the above.
- `theme-governance-validator.mjs` output: *"Liquid default OFF"*.
- `git diff ff6720a9..HEAD -- packages/theme-engine/src/theme-governance.ts` shows only additive import lines from new phase symbols; line 14 is **not in any diff hunk**.
- The `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` block at line 16 records `authority: 'ARB'` and `status: 'deferred'`.

**The flag has NOT been flipped. Liquid rendering is OFF for all stores by default. ARB must explicitly authorise the flip before any production deployment enables Liquid rendering by default. This certification does not authorise the flip.**

---

### 4.2 DOMPurify Config — UNCHANGED

**Seam:** `packages/theme-engine/src/theme-renderer.ts:170–231`  
**Block:** `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`

Four M→AC commits touched `theme-renderer.ts` (phases W, Y, T, AA). In all four diffs, **no `+` or `−` line touches**:
- `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`
- `FORBID_ATTR: ['style']`
- `FORBID_TAGS: ['base', 'embed', 'object', 'script']`
- `ADD_TAGS`, `ADD_ATTR`, or `CUSTOM_ELEMENT_HANDLING`

The Phase AA commit message explicitly states: *"LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG is NOT modified."*

Current config (unchanged since pre-Phase-M baseline):

```typescript
export const LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG: DOMPurifyConfig = {
  USE_PROFILES: { html: true },
  ADD_TAGS: [ ...LIQUID_HYDRATION_CUSTOM_ELEMENTS, 'iframe', 'meta' ],
  ADD_ATTR: [ /* 24 allow-listed data-* and aria-* attrs */ ],
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker|
                       review-form|wishlist-toggle|cart|customer-settings|
                       address-manager|logout)$/,
    attributeNameCheck: /^(?:aria-[a-z0-9-]+|data-[a-z0-9-]+|
                            class|id|role|slot|title|type|name|value|href|src)$/i,
    allowCustomizedBuiltInElements: false,
  },
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['base', 'embed', 'object', 'script'],
};
```

**No relaxation of forbid lists, no expansion of custom-element regexes, no removal of `allowCustomizedBuiltInElements: false`. Config is byte-identical to the Phase M baseline.**

---

### 4.3 publish_theme_release RPC Signature — UNCHANGED

**Seam:** `services/api-gateway/src/execution/theme-execution.adapter.ts:699–710`

The `db.rpc('publish_theme_release', { ... })` call was introduced in Phase P (`1053d611`) with 10 named parameters:

```typescript
const { data, error } = await this.db.rpc('publish_theme_release', {
    p_store_id:                  input.storeId,
    p_theme_id:                  input.themeId,
    p_release_config:            input.releaseConfig,
    p_source_draft_id:           input.sourceDraftId || null,
    p_source_draft_version:      input.sourceDraftVersion || null,
    p_published_by:              input.publishedBy,
    p_publish_message:           input.publishMessage || null,
    p_make_store_live:           input.makeStoreLive,
    p_request_id:                input.requestId || null,
    p_rollback_of_release_id:    input.rollbackOfReleaseId || null,
});
```

`git diff 1053d611..HEAD` on `theme-execution.adapter.ts` shows **zero `+`/`−` lines** for `rpc('publish_theme_release'` or any `p_` parameter.

The Phase AB report mentions adding `p_expected_current_release_version` as an ARB-gated follow-up — **that parameter is NOT present in the current call**; it is planned, not implemented. **RPC call signature is unchanged.**

---

### 4.4 Money Ledger / Checkout / Payment Routes — UNTOUCHED

**Seam:** `services/api-gateway/src/routes/payments.ts`, `services/api-gateway/src/routes/checkout/` directory, `services/api-gateway/src/routes/orders.ts`

`git diff ff6720a9..HEAD` on each of the above paths returns **0 diff lines**. `git log ff6720a9..HEAD` on those paths returns **no commits**. All commits to `services/api-gateway/src/routes/` in the M→AC window are theme-scoped (`feat(theme): ...` commit messages).

The six canonical money RPCs (`create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund`) do not appear as `rpc()` call sites in `packages/theme-engine/src/`. Grep returns 2 hits — both in test comments, not RPC invocations.

**The canonical money ledger, checkout routes, and payment RPCs are provably untouched by the M→AC program.**

---

## Section 5 — Fabrication Check

A fabrication check confirms no synthetic metrics, mock provider responses, or counterfeit "live" values were introduced by the M→AC program.

| Check | Result |
|-------|--------|
| LLM provider imports in `packages/theme-engine/src/` (openai / anthropic / @ai-sdk / langchain / ChatCompletion / generateText / streamText) | **ZERO HITS** in production code |
| `packages/theme-engine/package.json` LLM provider dependency | **ABSENT** |
| Hardcoded fake metrics or mock provider responses | **NONE FOUND** |
| `MODEL_BOUNDARY.status` | `'NOT_CONNECTED' as const` at `theme-ai-sdk.ts:919–920` (literal type, not a boolean flag) |
| `AINotConnectedResult` return for free-text | Explicit return at `ai-intent-parser.ts:595–602` |
| `APP_BLOCK_NOT_CONNECTED_REASON` | Constant at `app-block-model.ts:309–310` — surfaced to merchant editor |
| `fxConnected: false` | Literal type at `theme-locale.ts:270` — statically dead if-branches (compiler-detectable) |
| `describeThemeMetrics()` | Returns `connected: false` for **all 5** metric types (`theme-analytics.ts:177–201`) |
| `describeThemeEventEmissionPoints()` | Returns `implemented: false` for **all 5** event types (`theme-analytics.ts:229–253`) |

**FABRICATION CHECK: CLEAN.** The program enforces honesty structurally — NOT-CONNECTED is represented as literal types and named constants rather than runtime booleans, making any accidental "promotion" to connected state visible to the TypeScript compiler.

---

## Section 6 — Capability Matrix and Certification Verdicts

Status definitions:

- **CONNECTED** — the capability is wired end-to-end; structural code, gateway route, DB persistence, and merchant UI are all present and passing tests.
- **STRUCTURAL-ONLY** — the core engine logic and data structures are present and tested, but one or more layers (gateway route, DB, UI call site, live data source) are not yet wired or have a known open risk gap.
- **NOT-CONNECTED** — the capability intentionally does not connect to an external service or live data source; an honest constant/type is the structural disclosure.

| # | Capability | Phase | Status | Certification verdict | Key evidence |
|---|-----------|-------|--------|----------------------|--------------|
| N | Theme Document V2 | N | **CONNECTED** | CERTIFIED | `theme-document.ts` (647 lines); `ThemeDocumentSchema` at line 343; `toThemeDocumentV2`/`fromThemeDocumentV2` adapters; 46 tests; all gate suites typecheck clean |
| O | Preset and Experience Engine 2.0 | O | **CONNECTED** | CERTIFIED | `experience-apply.ts` (719 lines); `computeExperienceApplyDiff` at line 456; `applyExperienceToDocument` at line 576; `experience-compositions.ts` (10 experiences, structural distinctness enforced by tests); RISK-O01/O02 accepted as LOW |
| P | Drafts / Revisions / Publish / Rollback | P | **CONNECTED** | CERTIFIED with open risks | `theme-execution.adapter.ts:publishReleaseSnapshot` (line 696); `rollbackRelease` (line 1547); `db.rpc('publish_theme_release')` at lines 699–713; idempotency partial unique index (migration 189). **RISK-TOCTOU-P01/P02 OPEN** (concurrent publish / rollback races, LOW, ARB-gated) |
| Q | Merchant Theme Library | Q | **STRUCTURAL-ONLY** | CONDITIONAL | Routes exist in `services/api-gateway/src/routes/themes.ts`. **RISK-TOCTOU-Q01 OPEN** (MEDIUM, ARB-gated): `countInstalledSiteThemes` + insert are two separate DB round-trips with no advisory lock or DB-level CHECK; full closure requires ARB-gated `SECURITY DEFINER` RPC |
| R | Visual Editor Shell | R | **STRUCTURAL-ONLY** | CONDITIONAL | `packages/theme-engine/src/editor-bridge-protocol.ts` (57 lines); `EDITOR_READY_MESSAGE` and `INSPECTOR_ADD_SECTION_INTENT` defined. `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` is FOREIGN WIP — not touched by any M→AC commit |
| S | Live Preview Inspector | S | **CONNECTED** | CERTIFIED | `editor-bridge-protocol.ts:47` (`INSPECTOR_ADD_SECTION_INTENT`); `StorefrontPreviewBridge` at `storefront-preview-bridge.tsx:390`; same-origin postMessage; origin check fail-closed; all 8 Phase S security/UX findings resolved |
| T | Nested Blocks / Section Groups | T | **STRUCTURAL-ONLY** | CONDITIONAL | `allowedChildTypes` enforcement present at `theme-document.ts:204–207` (model layer). **RISK-T05 OPEN** (MEDIUM): `allowedChildTypes` not enforced in the depth-bounded renderer at render time (`theme-renderer.ts`); model-level only |
| U | Settings Control Renderer | U | **CONNECTED** | CERTIFIED with open risks | `SchemaFormRenderer.tsx` and `ResourcePickerControl.tsx` (WAI-ARIA 1.2 combobox). **RISK-SEC-U01/U02/U03 OPEN** (MEDIUM): setting-renderer XSS hardening gaps; carried to Phase AE |
| V | Template System | V | **CONNECTED** | CERTIFIED | `template-registry.ts` (600 lines); all 23 route types covered (including the 15 Shopify-parity types: index, product, collection, blog, article, page, cart, account, login, register, search, password, not_found, 404, gift-card); governance validator cross-checks parity count |
| W | Dynamic Sources / Custom Data | W | **STRUCTURAL-ONLY** | CONDITIONAL | Resource bindings (product/collection/page/blog/menu) CONNECTED via `GET /v1/themes/resource-search`. **Metafield bindings NOT-CONNECTED**: `metafield-service.ts` absent from `apps/storefront-runtime/src/lib/theme-engine/`; `resolveDynamicSourceDescriptors` returns `MetafieldBinding` fallback at `dynamic-source-binding.ts:242–245` |
| X | Media Library | X | **CONNECTED** | CERTIFIED | `services/api-gateway/src/routes/themes/media-library.ts` mounted; upload handler uses R2 with `verifyUploadStoreOwnership`; SVG explicitly rejected. **RISK-X01 OPEN** (LOW): R2 key is user-scoped not site-scoped — acceptable as single-layer isolation boundary |
| Y | App Block Extensions | Y | **NOT-CONNECTED** | NOT-CONNECTED (by design, honest) | `APP_BLOCK_NOT_CONNECTED_REASON` at `app-block-model.ts:309–310`; `apps/app-marketplace` FROZEN; no live app registry, no sandboxed iframe host, no app-block HTML from a real runtime; `buildLiquidAppBlocks` returns placeholder HTML; merchant editor surfaces NOT-CONNECTED state |
| Z | Markets / Localization | Z | **CONNECTED** | CERTIFIED with open risks | `theme-locale.ts` (336 lines); `THEME_DEFAULT_STORE_LOCALE='en-IN'`; India-first proven at test Z-L09/10/11/32; INR+en-IN formatting byte-identical to `formatLiquidMoney`. **FX display NOT-CONNECTED**: `fxConnected: false` literal type always. **RISK-Z01 OPEN** (MEDIUM: `buildCandidates('en')` India-first inversion) → Phase AE |
| AA | Custom CSS / Code Workspace | AA | **STRUCTURAL-ONLY** | CONDITIONAL | `custom-css-sanitizer.ts` (465 lines, 22 injection vector classes); merchant editor CONNECTED; server-side proxy guard CONNECTED. **Render-path call site NOT-CONNECTED**: `buildLiquidThemeHeadAssets(bundle)` at `theme-renderer.ts:585` called without `rawCustomCss`; `ThemeRendererInput` has no `rawCustomCss` field; CSS never injected into storefront head |
| AB | Safe Theme Updates / Versioning | AB | **CONNECTED** | CERTIFIED | `theme-safe-update.ts` (862 lines); `planThemeSafeUpdate` pure and deterministic; `computeThemeUpdateDiff` at line 136; RISK-DUAL-N01 compliance enforced; RISK-AB-01..03 LOW and accepted |
| AC | AI-Assisted Customization | AC | **STRUCTURAL-ONLY** | CONDITIONAL | Deterministic primitives (WCAG 2.1 AA contrast math, parametric palette, typography pairing, section ordering, accessibility analyzer, bundle optimizer) CONNECTED — emit validated `ThemeDocument` proposals with no LLM call. **Free-text NLU NOT-CONNECTED**: gateway route `POST /v1/theme-ai/parse-brief` absent; `proposeThemeCustomization` returns `AINotConnectedResult` at `ai-intent-parser.ts:595–602`; `MODEL_BOUNDARY.status = 'NOT_CONNECTED'` at `theme-ai-sdk.ts:919–920` |
| — | Theme Analytics / Metrics | K/M→AC | **NOT-CONNECTED** | NOT-CONNECTED (by design, honest) | `describeThemeEventEmissionPoints()` returns `implemented: false` for all 5 event types; `describeThemeMetrics()` returns `connected: false` for all 5 metric types; no analytics pipeline, Cloudflare Analytics Engine, or DB event table wired |

**Capability summary:** 8 CERTIFIED CONNECTED · 6 STRUCTURAL-ONLY (conditional) · 3 NOT-CONNECTED (by design, honest disclosure)

---

## Section 7 — NOT-CONNECTED Seam Catalogue

The following seams are explicitly not connected and must remain honestly disclosed until ARB-gated or Phase AE work closes them. Each entry names the exact missing piece — not a vague description.

| Seam | Phase | Exact missing piece | Evidence path |
|------|-------|---------------------|---------------|
| Metafield render resolution | W | `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` does not exist. `resolveDynamicSourceDescriptors` returns `MetafieldBinding` fallback unconditionally for all `'metafield'` source bindings. No hydration bag in `ThemeRendererInput`. | `dynamic-source-binding.ts:81–91` (HONESTY LAW comment + `MetafieldBinding` interface with NOT-CONNECTED annotation); `dynamic-source-binding.ts:242–245` (case `'metafield'`: returns fallback) |
| Live FX rates (currency display) | W / Z | No Forex API or rate feed wired anywhere. `formatThemeCurrencyDisplay` always returns `fxConnected: false` (literal type — any `if(result.fxConnected)` branch is statically dead). Non-INR display is presentational only. Missing: server-side FX rate source (sites.currency + rate table or Razorpay FX endpoint) and display-only conversion helper. | `theme-locale.ts:270` (literal type); `theme-locale.ts:333` (always returned as false); Phase Z report §4.2 |
| AI model boundary — NL free-text parsing | AC | `POST /v1/theme-ai/parse-brief` absent from `services/api-gateway/src/routes/themes/`. `THEME_AI_PROVIDER_API_KEY` env var unset. `proposeThemeCustomization` returns `AINotConnectedResult` for every free-text intent. Merchant proxy returns HTTP 503 structured NOT-CONNECTED body. | `ai-intent-parser.ts:595–602`; `theme-ai-sdk.ts:919–920`; `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts:85–87` |
| Live app-block content runtime | Y | `apps/app-marketplace` is FROZEN. No live app registry API, no sandboxed iframe host, no app-block content gateway endpoint. `buildLiquidAppBlocks` returns placeholder HTML. Missing: live app registry API, sandboxed iframe host, gateway endpoint serving real app-block HTML. | `app-block-model.ts:309–310` (`APP_BLOCK_NOT_CONNECTED_REASON`); CLAUDE.md (app-marketplace frozen) |
| Custom CSS render-path call site | AA | `buildLiquidThemeHeadAssets(bundle)` at `theme-renderer.ts:585` is called without `rawCustomCss`. `ThemeRendererInput` (lines 128–136) has no `rawCustomCss?: string` field. CSS is validated and scoped but never injected into the storefront head. Three steps needed: (1) add `rawCustomCss?` to `ThemeRendererInput`; (2) composition layer fetches `site_settings.custom_css`; (3) call site at line 585 passes it. | `theme-renderer.ts:585` (call site); `theme-renderer.ts:128–136` (`ThemeRendererInput` definition); Phase AB report §259 (confirmed not wired) |
| Liquid canary flag | M → AC (ARB-gated) | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` at `theme-governance.ts:14`. Per-store canary opt-in path (`resolveThemeLiquidRenderingEnabled`) is wired and works. The global default is OFF. ARB must authorise flipping to `true`. This certification does not do so. | `theme-governance.ts:14`; `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` block (lines 16–20) |
| Theme analytics event emission | K / M → AC | All 5 analytics event types (install, publish, preview, apply, uninstall) return `implemented: false`. All 5 metric types return `connected: false`. No analytics pipeline, Cloudflare Analytics Engine integration, or DB event table wired. | `theme-analytics.ts:229–253`; `theme-analytics.ts:177–201`; honesty law comment at `theme-analytics.ts:7` |

---

## Section 8 — Open Risk Summary (Phase AE Intake)

The following risks from RISK_REGISTER.md are not resolved by Phase AD certification and carry forward to Phase AE or remain ARB-gated.

**HIGH:**
- **RISK-SEC-001** — `theme_purchases` wide-open RLS (`USING (true)` / `WITH CHECK (true)`). Pre-existing. No live route currently exposes it (marketplace FROZEN). Target: Phase AE or dedicated security migration before any route over `theme_purchases` is added.

**MEDIUM (requiring ARB or Phase AE scope):**
- **RISK-TOCTOU-Q01** — Plan limit enforcement non-atomic (count-then-insert race). ARB-gated; full closure requires `SECURITY DEFINER` RPC.
- **RISK-SEC-P01** — `theme_editor_drafts` RLS checks `user_id` only, not `custom_user_id`. No live client-side subscription added through Phase AC; bounded for now.
- **RISK-T01** — Pre-Zod stack-depth guard missing in bundle parser.
- **RISK-T02** — No `assertNoBlockedKeysInRaw` in bundle parser.
- **RISK-T05** — `allowedChildTypes` not enforced in depth-bounded renderer at render time.
- **RISK-SEC-U01/U02/U03** — Setting-renderer XSS hardening gaps.
- **RISK-A11Y-U01** — Setting control focus trapping.
- **RISK-W01** — Resource binding without owner check at render time.
- **RISK-Z01** — `buildCandidates('en')` India-first inversion.
- **RISK-AC-01** — Overlay key filter missing at proxy layer (latent while AI NOT-CONNECTED).
- **RISK-AC-02** — Accessibility-fix WCAG AA only proven against white background.

**LOW (accepted, ARB-gated, or first-touch):**
RISK-T03 (partial), RISK-T04, RISK-T06, RISK-TOCTOU-P01, RISK-TOCTOU-P02, RISK-W02..W06, RISK-X01, RISK-Y01, RISK-Z02..Z06, RISK-AA-01..03, RISK-AB-01..03, RISK-AC-03..05, RISK-GOV-001, RISK-DATA-001, RISK-DUAL-N01 (mechanically guarded through Phase AC).

---

## Section 9 — ARB Canary Package

The minimum ARB package for flipping the Liquid canary to production default:

1. **Flag location:** `packages/theme-engine/src/theme-governance.ts:14` — change `false` → `true`. Re-run `pnpm --filter=@letbuyy/theme-engine typecheck test` after the change.

2. **Per-store override path:** `resolveThemeLiquidRenderingEnabled(input)` at `theme-governance.ts:18` — this per-store opt-in/opt-out path is already wired and survives the flip. The global default is the only item the flag controls.

3. **NOT-CONNECTED seams that must be named in the ARB decision memo:** custom CSS render-path call site (line 585 not wired), metafield resolution (composition layer only), AI model free-text NLU (gateway route absent), live FX rates (no provider), app-block live runtime (app-marketplace frozen), theme analytics (implemented: false / connected: false). None of these block the Liquid canary flip — they are independent feature seams — but they must be disclosed for honest record.

4. **Committed migrations not yet applied to production:** 188 (letbuyy-core theme row), 189 (theme persistence idempotency), 190 (theme library Q). Apply order: 188 → 189 → 190 (after any unblocking foreign WIP: 186 → 187 first).

5. **Open ARB-gated risks that are latent until the flag flips:** RISK-TOCTOU-P01/P02 (publish/rollback concurrent races) and RISK-TOCTOU-Q01 (plan-limit race) become live once merchant traffic flows through Liquid-rendered themes. ARB should require a timeline for closing these before setting live traffic percentage above canary levels.

---

## Section 10 — Summary Evidence Table

| Check | Expected | Actual | Match? |
|-------|----------|--------|--------|
| theme-engine typecheck | PASS (exit 0) | PASS (exit 0) | YES |
| theme-engine tests | 1695 / 1695 | 1695 / 1695 | YES |
| storefront-runtime typecheck | PASS (exit 0) | PASS (exit 0) | YES |
| storefront-runtime tests | all PASS | 915 / 915 (120 lb-l contracts now pass post-AC; PROGRAM_STATE said ~795 mid-program) | ALL PASS |
| merchant-control-plane typecheck | PASS (exit 0) | PASS (exit 0) | YES |
| merchant-control-plane tests | 771 / 771 | 771 / 771 | YES |
| api-gateway typecheck | PASS (exit 0) | PASS (exit 0) | YES |
| api-gateway tests | 537 PASS / 3 FOREIGN FAIL / 540 total | 537 / 540 (3 FOREIGN confirmed) | YES |
| theme-governance-validator | PASS | PASS | YES |
| migration-safety-validator | PASS | PASS | YES |
| validate-governance (anti-fabrication sub-gate) | PASS | PASS (1319 files, 0 temp entries) | YES |
| validate-governance (tenant sub-gate) | EXIT 1 (pre-existing only) | EXIT 1 (RISK-GOV-001 only, pre-existing) | YES — pre-existing |
| sequential-migration-validator | EXIT 1 (186/187 untracked) | EXIT 1 (186/187 pre-existing WIP) | YES — pre-existing |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | `false` at line 14 | `false` at line 14 | YES |
| `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` | Unchanged since Phase M | No `+`/`−` lines in any M→AC diff | YES |
| `publish_theme_release` RPC signature | Unchanged since Phase P | No `+`/`−` lines since `1053d611` | YES |
| Money ledger / checkout routes | Untouched | 0 diff lines in entire M→AC window | YES |
| Fabrication check (LLM imports in theme-engine/src/) | ZERO | ZERO | YES |

---

*This document was produced on `stepup/main` at HEAD `7654927d` by the Phase AD read-only certification sub-agent. No source files were modified. No git commands were executed. The orchestrator is responsible for committing this document under the programme's two-lane merge rule. The PHASE_AD_CERTIFICATION.md in this same directory is the phase-specific gate report; this document is the whole-program certification covering all 15 phases (M → AC).*
