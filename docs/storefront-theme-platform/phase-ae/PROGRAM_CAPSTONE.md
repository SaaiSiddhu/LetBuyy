# LetBuyy Theme Platform — Program Capstone (M→AE)

**Document type:** Whole-program capstone
**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phases covered:** M through AE (19 phases)
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Author:** Phase AE documentation pass — read-only, no source edits, no git commands
**Audience:** Engineering leadership, ARB, future platform teams

---

## 1. Program Verdict

**PROGRAM COMPLETE.**

The M→AE program delivered 19 phases of structural theme platform work across four packages and one database migration set. All packages typecheck clean at HEAD. The full committed test corpus passes: **1726/1726** theme-engine · **915/915** storefront-runtime · **771/771** merchant-control-plane · 3 pre-existing FOREIGN api-gateway failures (unchanged, not program regressions).

The program delivered Shopify-class theme capabilities to the LetBuyy platform: a canonical theme document format, a preset and experience engine, a full merchant editor stack (drafts, revisions, publish, rollback, template system, live preview, section groups, controls, files/media, dynamic sources, app extensions, markets/localization, custom CSS, AI customization, versioning), platform certification, and a marketplace partner-submission validation gate.

**What this document does NOT attest to:**

- That the Liquid canary flag has been flipped — it has not. `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` at `theme-governance.ts:14`. ARB authority.
- That any of the NOT-CONNECTED seams are connected — they are not (detailed in §4).
- That migrations 188/189/190/191 have been applied to production — they require ARB/human sign-off.
- That the marketplace apps are unfrozen or that any live partner-submission pipeline exists — they are not.
- That the 3 FOREIGN api-gateway test failures have been remediated — they are pre-program WIP.

---

## 2. Phase Shipping Record

### Heritage: B→L (Liquid Transformation Foundation)

Before the M→AE documentation program began, 11 phases of B→L work on `stepup/main` established the foundational primitives that M→AE composes:

| Phase | Title | Key deliverables |
|-------|-------|-----------------|
| B | Bundle schema | `LiquidThemePackageBundleSchema` (Zod), `parseLiquidThemePackageBundle`, G4 schema_version gate |
| C | Linter | `lintThemeBundle`, forbidden-tag/attr rules, schema-block lint, `THEME_LINTER_CONFIG` |
| D | Governance | `theme-governance.ts`, `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`, 25 governance schemas, canary flag |
| E | App blocks | `LiquidAppBlockSchema`, `isLiquidAppBlockType`, `BLOCKED_APP_BLOCK_SETTING_KEYS`, `filterAppBlockSettings` |
| F | Version | `ThemeBundleVersionSchema`, `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS`, `isThemeBundleSchemaCompatible`, version gate |
| G | Migration | `LIQUID_BUNDLE_SCHEMA_MIGRATIONS`, migration chain from v1→v2 |
| H | Renderer | `LiquidRenderer`, DOMPurify sanitizer (`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`), output escape |
| I | AI color system | `generateColorSystem`, `meetsWcagAA`, `contrastRatio`, `deterministicPalette` |
| J | AI typography / layout | `suggestTypographyPairing`, `EXPERIENCE_FONT_REGISTRY`, `generateSectionOrder`, `PARITY_SECTION_TYPES` |
| K | AI theme generator | `generateThemeFromBrief`, `ThemeBrief`, structured input only |
| L | AI primitives + SDK | `analyzeThemeAccessibility`, `suggestAccessibilityFixes`, `theme-ai-sdk.ts`, `MODEL_BOUNDARY` |

All B→L commits (11) are real ancestors of HEAD. Phase L = HEAD at program start (`29f87115`).

---

### M→AE (19 phases, 2026-07-11)

| Phase | Title | Key deliverables | Tests at close |
|-------|-------|-----------------|----------------|
| M | Repository truth + Shopify parity | Discovery only; 12 cert docs; SHOPIFY_PARITY_MATRIX.md (70 rows); RISK-SEC-001 seeded | 643/643 |
| N | Canonical Theme Document V2 | `theme-document.ts` (647 lines): `ThemeDocumentSchema`, `parseThemeDocument`, `toThemeDocumentV2`, version gate, error classes, pollution guards; RISK-DUAL-N01 registered | 689/689 (+46) |
| O | Preset & Experience Engine 2.0 | `experience-compositions.ts` (373 lines, 10 experiences × 3 templates); `experience-apply.ts` (719 lines, pure diff + fail-closed apply); `section-type-map.ts` (25-entry bridge); 345 new tests | 1034/1034 (+345) |
| P | Drafts / revisions / publish / rollback | `publish_theme_release` RPC integration; `rollbackRelease` CAS guard; `validateDocument`; migration 189 (`theme_releases` idempotency_key); ARB-gated | — |
| Q | Merchant theme library | Migration 190 (`owned_by_site_id`, `is_site_private` on themes); Hono routes with `verifySiteOwnership`; 41 gateway tests | — |
| R | Visual editor shell | `editor-bridge-protocol.ts`; editor shell components; RISK-R01 (later CLOSED in T) | — |
| S | Live preview inspector | `StorefrontPreviewBridge`; same-origin `postMessage`; origin check fail-closed; +33 storefront tests | 1048/1048 |
| T | Section groups + nested blocks | `ThemeBundleTemplateSectionSchema` block depth enforcement; `SectionTreePanel.tsx` `BlockEntry.children`; RISK-T01–T06 registered | 1063/1063 |
| U | Settings control renderer | Schema-field controls; rich setting types; RISK-SEC-U01/U02/U03, RISK-A11Y-U01/U02 registered | 1136/1136 |
| V | Template system | Template management; `ThemeTemplatePanel`; Lane A+B; `36d6f342` / `e9462067` | 1385/1385 |
| W | Dynamic sources + custom data | `dynamic-source-binding.ts`; W-binding descriptor; `DynamicSourcePickerControl`; +56 engine tests | 1441/1441 |
| X | Files & media library | `ThemeMediaLibraryClient`; `MediaPickerControl`; `ResourcePickerControl`; Cloudflare R2 integration routes; 8 findings resolved | 1441/1441 |
| Y | Theme app extensions | `filterAppBlockSettings`; `AppBlockReferenceSchema`; `@app` block render pipeline; `MAX_APP_BLOCKS_PER_SLOT`; +28 tests | 1469/1469 |
| Z | Markets + localization | `theme-locale.ts` (`tLocale`, `normalizeLocale`, `formatThemeCurrencyDisplay`); `THEME_DEFAULT_STORE_LOCALE='en-IN'`; FX NOT-CONNECTED | 1525/1525 |
| AA | Custom CSS + code workspace | `custom-css-sanitizer.ts` (465 lines, 22 injection classes, 67 tests); `CustomCssWorkspace.tsx`; server-side CSS gate; render path NOT-CONNECTED | 1592/1592 |
| AB | Theme versioning + updates | `theme-safe-update.ts` (planThemeSafeUpdate, NO-DATA-LOSS LAW); `ThemeUpdatePanel.tsx`; `mountThemeUpdateRoutes`; migration 189 (idempotency_key) | 1634/1634 |
| AC | AI-assisted customization | `ai-intent-parser.ts` (`proposeThemeCustomization`, 5 intent kinds); `AICustomizationPanel.tsx`; structured intents only; free-text NOT-CONNECTED; 61 new tests | 1695/1695 |
| AD | Certification + canary | Whole-program cert (M→AC); `CANARY_READINESS_ARB_PACKAGE.md`; `NOT_CONNECTED_REGISTER.md`; integrity attestation; gate matrix confirmed | 1695/1695 |
| AE | Marketplace + partner readiness | `validateThemeForMarketplace` (354 lines, K/AA/Y/N composition); 31 new tests; migration 191 (RISK-SEC-001 closed); `PARTNER_READINESS.md` | 1726/1726 |

---

## 3. What Was Delivered — By Domain

### 3.1 Core engine (`packages/theme-engine/`)

**Test corpus at program close:** 1726/1726 pass

| Capability | Files | Phase |
|-----------|-------|-------|
| Canonical theme document format | `theme-document.ts`, `theme-document-migrations.ts` | N |
| Preset + experience engine | `experience-compositions.ts`, `experience-apply.ts`, `section-type-map.ts` | O |
| Draft / publish / rollback core | `theme-install.ts`, `theme-version.ts` | B→L, P |
| Section groups + nested blocks | `theme-bundle.ts` (schema), `theme-governance.ts` | T |
| Dynamic sources + bindings | `dynamic-source-binding.ts` | W |
| Theme app extensions | `app-block-model.ts` | E, Y |
| Markets + localization | `theme-locale.ts` | Z |
| Custom CSS sanitizer | `custom-css-sanitizer.ts` | AA |
| Theme safe updates | `theme-safe-update.ts` | AB |
| AI customization intent layer | `ai-intent-parser.ts` | AC |
| Marketplace gate | `theme-marketplace-contract.ts` | AE |
| AI primitives (color, typography, layout, generator, a11y, optimizer, personalization) | `ai-color-system.ts`, `ai-typography.ts`, `ai-layout.ts`, `ai-theme-generator.ts`, `ai-accessibility.ts`, `ai-optimizer.ts`, `ai-personalization.ts`, `theme-ai-sdk.ts` | I–L |

### 3.2 Merchant editor (`apps/merchant-control-plane/`)

**Test corpus at program close:** 771/771 pass

| Capability | Component | Phase |
|-----------|-----------|-------|
| Visual editor shell | `ThemeEditorPage`, `ThemeEditorLayout` | R |
| Live preview inspector | `SectionInspectorPanel`, `StorefrontPreviewBridge` | S |
| Section tree + nested blocks | `SectionTreePanel`, `BlockEntry.children` | T |
| Settings controls | `SchemaFieldRenderer`, control library | U |
| Template management | `ThemeTemplatePanel` | V |
| Dynamic sources | `DynamicSourcePickerControl` | W |
| Files + media library | `ThemeMediaLibraryClient`, `MediaPickerControl` | X |
| Custom CSS workspace | `CustomCssWorkspace.tsx` | AA |
| Theme update panel | `ThemeUpdatePanel.tsx` | AB |
| AI customization panel | `AICustomizationPanel.tsx` | AC |

### 3.3 Storefront runtime (`apps/storefront-runtime/`)

**Test corpus at program close:** 915/915 pass

| Capability | File | Phase |
|-----------|------|-------|
| Preview bridge | `storefront-preview-bridge.tsx` | S |
| Theme rendering (Liquid + React hybrid) | `theme-renderer.ts`, `proxy.ts` | H (B→L), ongoing |

### 3.4 API gateway (`services/api-gateway/`)

**Typecheck at program close:** 32/32 tasks PASS; ~537/540 tests PASS (3 pre-existing FOREIGN failures)

| Capability | Route file | Phase |
|-----------|-----------|-------|
| Draft save + publish | `theme-execution.adapter.ts` | P |
| Theme library | `routes/themes.ts` | Q |
| Resource search | `routes/themes.ts` | X |
| Theme updates | `routes/themes/theme-update-route.ts` | AB |

### 3.5 Database migrations

| Migration | Title | Phase | ARB status |
|-----------|-------|-------|-----------|
| 188 | (pre-M, B→L era) | B→L | ARB-gated |
| 189 | `theme_releases` idempotency_key + index | P | ARB-gated |
| 190 | `themes.owned_by_site_id` + `is_site_private` | Q | ARB-gated |
| 191 | `theme_purchases` RLS tighten (RISK-SEC-001) | AE | ARB-gated |

---

## 4. Honest NOT-CONNECTED Seams

Every NOT-CONNECTED seam below is real — "NOT-CONNECTED" means the structural wiring exists in code but a live credential, runtime, or platform piece is absent. No fabricated connection, no mocked live value.

| Seam | Exact missing piece | Impact |
|------|--------------------|--------------------|
| Liquid canary (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`) | ARB approval to flip from `false` to `true` | Liquid-rendered storefronts not enabled for any store |
| Custom CSS render path | `buildLiquidThemeHeadAssets` exists + accepts `rawCustomCss`; call site at `layout.tsx:585` not updated | Merchant custom CSS not applied in storefront output |
| AI free-text NLU | `POST /v1/theme-ai/parse-brief` gateway route does not exist; `THEME_AI_PROVIDER_API_KEY` not set | Free-text AI intents return NOT-CONNECTED; structured intents work fully |
| AI NL colour mood → seed hex | Same model boundary | Available only with model provider wired |
| AI NL section intent → SectionGoal[] | Same model boundary | Available only with model provider wired |
| Metafield resolution in storefront | Metafield fetch from Supabase not wired in render path | Dynamic metafield references render empty |
| Live FX rates (markets) | `fxConnected: false` literal type; `formatThemeCurrencyDisplay` is display-only for non-INR | Merchant-configured currency display only; no live rates |
| Live app-block runtime | `AppBlockReference` resolution requires a live app provider; static @app block settings are validated, not runtime | `@app` blocks rendered as placeholders in preview |
| `POST /v1/theme-ai/parse-brief` (gateway) | Route does not exist | AI customization panel shows disabled free-text input |
| Theme marketplace submission pipeline | Frozen apps; `validateThemeForMarketplace` gate exists but is not called from any route | No live partner submission workflow yet |
| Migrations 188/189/190/191 in production | ARB sign-off required for production apply | New database capabilities not yet live in production |

---

## 5. ARB Canary Gate

The Liquid canary (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`) controls whether Liquid rendering is active for any LetBuyy store. It remains `false` at program close.

**What must be true before the ARB can approve the flip:**

1. **Technical readiness** (all CONFIRMED at Phase AD / AE close):
   - DOMPurify FORBID config intact (`FORBID_ATTR:['style']`, `FORBID_TAGS:['base','embed','object','script']`).
   - `outputEscape:'escape'` on Liquid template output.
   - `LIQUIDJS_STRICT_VARIABLES=true` (Liquid variable resolution — undefined → error, not empty string).
   - Custom CSS validator applied before any custom CSS reaches the renderer.
   - App-block credential keys blocked at submission gate (Phase AE) and runtime filter (Phase Y `filterAppBlockSettings`).
   - Theme-governance-validator: PASS (25 schema checks, all green, Liquid OFF confirmed).
   - Migration-safety-validator: PASS on all four pending migrations.

2. **Human / business gates** (NOT resolved by the program):
   - Migration 191 applied to production (ARB approval).
   - Migration 189 applied to production (idempotency_key on `theme_releases`).
   - Migration 190 applied to production (`is_site_private` column).
   - Storefront canary cohort defined and instrumented.
   - Rollback procedure documented and tested.
   - Partner review queue operational (if marketplace is launching).

3. **Open risks requiring resolution before flip** (see §6):
   - RISK-Z01 (`buildCandidates('en')` India-first inversion — LOW, deferred).
   - RISK-TOCTOU-Q01 (plan-limit non-atomic — MEDIUM, ARB-gated).
   - RISK-SEC-U01/U02/U03 (control renderer auth gaps — MEDIUM).

**The program does NOT authorise or recommend flipping the flag.** The technical gate is ready. The business and operational gate requires ARB review.

---

## 6. Open Risk Summary (Carried at Program Close)

The following risks remain open at program close. They are not blocking the flag flip by themselves, but should be addressed before or during production rollout.

| ID | Severity | Summary | Target |
|----|----------|---------|--------|
| RISK-AE-SEC-003 (FIND-AE-SEC-003) | LOW | `user_id = auth.uid()` cross-UUID-space residual risk in migration 191 | First `users_custom` schema migration |
| RISK-TOCTOU-Q01 | MEDIUM | Plan-limit count-then-insert non-atomic in `theme_instances` | ARB-gated, deferred |
| RISK-SEC-P01 | MEDIUM | `theme_editor_drafts` RLS user_id-only (no realtime subscription added) | First realtime subscription add |
| RISK-Z01 | LOW | `buildCandidates('en')` India-first inversion | First `theme-locale.ts` touch |
| RISK-SEC-U01/U02/U03 | MEDIUM | Control renderer auth surface gaps | First `schema-field-extensions.ts` touch |
| RISK-AC-01/02 | MEDIUM | Overlay keys not filtered at proxy layer; WCAG AA only proven against white background | First `ai-intent-parser.ts` or proxy route touch |
| RISK-T01 | MEDIUM | Pre-Zod stack-depth guard in block parsing | First `theme-bundle.ts` block depth touch |
| RISK-T05 | MEDIUM | `allowedChildTypes` not wired in `SectionTreePanel.tsx` | First SectionTreePanel touch |
| RISK-DATA-001 | INFO | Migrations 188/189/190/191 committed but not applied to production | ARB production apply gate |
| RISK-GOV-001 | MEDIUM | Tenant-registry drift (pre-existing; `validate-governance.mjs` EXIT=1) | Separate governance scope |

**Fixed in-phase (Phase AE hardening):** RISK-AE-SEC-001 (MEDIUM — `walkStringLeaves` depth cap CSS-injection bypass at `settings_data.current` depth ≥ 5). The walker now caps at `MAX_SETTINGS_WALK_DEPTH = 12` (above every legitimate theme depth) and fails closed beyond it — an over-deep bundle is rejected with a blocking `AA:settings-too-deep` violation rather than silently skipped. Locked by tests AE-AA-07 / AE-AA-08. This closed the last MEDIUM found in the program's capstone marketplace safety gate.

All risks predating AE that are MEDIUM or higher should be triaged in the first post-AE engineering sprint.

---

## 7. Parity Snapshot at Program Close

Baseline from Phase M (SHOPIFY_PARITY_MATRIX.md, 70 capability rows):
- **COMPLETE:** 37 rows → raised substantially by phases O/P/Q/R/S/T/U/V/W/X/Y/Z/AA/AB/AC/AE
- **PARTIAL:** 15 rows → reduced as phases completed capabilities
- **MISSING:** 13 rows → primarily live-data-dependent features (metafields, FX, realtime, app runtime)
- **NOT_CONNECTED:** 4 rows → AI NLU seams, live analytics
- **STUB:** 1 row → AI editor (now replaced with deterministic intent layer in AC)

The editor is no longer the largest gap cluster. The primary remaining gaps are NOT-CONNECTED live-data seams (metafield render, FX rates, AI NLU, app-block runtime).

---

## 8. Test Corpus Evolution

| Checkpoint | theme-engine | storefront-runtime | merchant | api-gateway |
|------------|-------------|-------------------|----------|-------------|
| Phase M baseline | 643/643 | 687/687 | 14 tasks | 32 tasks |
| After Phase O | 1034/1034 | — | — | — |
| After Phase S | 1048/1048 | 795/795 | 93/93 | — |
| After Phase U | 1136/1136 | 795/795 | 196/196 | 479/479 |
| After Phase W | 1441/1441 | 795/795 | 286/286 | 491/491 |
| After Phase X | 1441/1441 | 795/795 | 1429/1471 | 519+/522 |
| After Phase AB | 1634/1634 | 795/795 | 712/712 | 1489+/1516 |
| After Phase AC | 1695/1695 | 915/915 | 771/771 | ~537/540 |
| **After Phase AE** | **1726/1726** | **915/915** | **771/771** | **~537/540** |

Pre-existing FOREIGN failures in api-gateway (3: ai#1, executive-analytics#130, payments#298) are unchanged throughout the program. They are not program regressions.

---

## 9. Final Statement

The LetBuyy M→AE theme platform program is complete. The platform now has:

- A canonical, versioned, editor-native theme document format (Phase N).
- 10 merchant experiences with 3 templates each (Phase O).
- A production-safe draft/publish/rollback pipeline (Phase P).
- A merchant theme library with tenancy enforcement (Phase Q).
- A live-preview visual editor shell (Phases R–U).
- A full template system (Phase V).
- Dynamic sources and custom data bindings (Phase W).
- Files and media library with R2 integration (Phase X).
- Sandboxed theme app extensions (Phase Y).
- India-first markets and localization (Phase Z).
- A locked custom CSS sanitizer with 22 injection classes blocked (Phase AA).
- A NO-DATA-LOSS safe theme update engine (Phase AB).
- A deterministic AI customization intent layer (Phase AC).
- A whole-program certification and ARB canary package (Phase AD).
- A fail-closed partner submission validation gate (Phase AE).

**Program status: COMPLETE. Canary flip: ARB authority.**
