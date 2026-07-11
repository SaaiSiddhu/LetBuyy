# Canary Readiness ARB Decision Package
## Liquid Theme Platform — M→AC Build Programme

**Document ID:** ARB-PKG-M-AC-2026-07-11
**Phase:** AD — Certification + Canary Readiness
**Decision date:** 2026-07-11
**Branch:** `stepup/main`
**HEAD certified:** `83d61e0a` (Phase AC — AI-assisted customization)
**Programme window:** `9186188e` (Phase M baseline) → `83d61e0a` (Phase AC close)
**Authored by:** AD certification sub-agent (read-only; no source changes; no git; orchestrator commits)
**Inputs:** Phase AD certification evidence JSON; `docs/storefront-theme-platform/phase-ad/PHASE_AD_CERTIFICATION.md`; Phase J ARB package at `docs/storefront-liquid-discovery/phase-j/ARB_APPROVAL_PACKAGE.md`; Phase J rollout readiness at `docs/storefront-liquid-discovery/phase-j/ROLLOUT_READINESS_PACKAGE.md`; `docs/storefront-theme-platform/PROGRAM_STATE.md`; `docs/storefront-theme-platform/RISK_REGISTER.md`

---

## AUTHORITY STATEMENT — CRITICAL

**This document does not flip any flag. It does not change `THEME_LIQUID_RENDERING_DEFAULT_ENABLED`. It does not activate Liquid rendering for any store, environment, or traffic segment. It is read-only decision material for the ARB.**

The platform-wide Liquid flip requires an ARB-recorded decision followed by a human-authored commit and a supervised deployment. The decision object in committed source at `packages/theme-engine/src/theme-governance.ts:16–21` encodes this:

```typescript
export const THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = {
  status: 'deferred',
  authority: 'ARB',
  reason: 'Liquid remains per-theme canary only until render-parity, security, SSTI/XSS, and performance evidence is green.',
  defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED,
} as const;
```

`THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false` at `packages/theme-engine/src/theme-governance.ts:14`. The Phase AD programme did not touch this constant. The theme-governance-validator confirms `Liquid default OFF` at every gate run. This document is the evidence the ARB would consume — it does not authorise anything.

---

## 1. Executive Summary

Nineteen phases (M through AC) on branch `stepup/main` have built what is now the most capable version of the LetBuyy Liquid theme platform: Theme Document V2, Preset and Experience Engine 2.0, Drafts/Revisions/Publish/Rollback, Merchant Theme Library, Visual Editor Shell, Live Preview Inspector, Nested Blocks, Settings Control Renderer, Template System, Dynamic Sources, Media Library, App Block Extensions, Markets/Localization, Custom CSS Workspace, Safe Theme Updates/Versioning, and AI-Assisted Customization. All four core packages (theme-engine 1695/1695, storefront-runtime 915/915, merchant-control-plane 771/771, api-gateway 537/540 with 3 confirmed-foreign pre-existing failures) typecheck clean and pass their full test suites at HEAD.

**The critical distinction this ARB package makes explicit: structural readiness is not flip-readiness.**

The platform is structurally CANARY-READY. It is NOT platform-flip-ready. Six live seams identified in the Phase AD capability audit are NOT-CONNECTED — these are not engineering gaps that were overlooked; they are explicit, honest NOT-CONNECTED annotations in committed source with exact descriptions of what is missing. Four of these seams (metafield resolution, custom-CSS render-path wiring, live FX rates, AI NL model) must be wired or formally risk-accepted by the ARB before a platform-wide flip to `true` can be authorised. Two additional seams (app-block runtime, analytics emission) must be tracked through canary stages.

The seven original ARB blockers from the storefront-liquid-discovery programme (Phases B–J) remain at their reconciled state: five CLOSED, two MITIGATED. The M→AC programme does not regress any of these closures.

**ARB verdict recommended by this package:** Approve per-store supervised canary ramp per the seven-stage plan in Section 6. Defer the global platform flip until Stages 1–5 produce live telemetry and all mandatory pre-flip seams are wired.

---

## 2. Structural Readiness — What IS Built and Tested

### 2.1 Gate results (Phase AD certification evidence)

All gates verified at HEAD `83d61e0a`. Pre-existing failures are confirmed non-programme regressions.

| Package | Gate | Result | Count / Exit |
|---------|------|--------|-------------|
| `@letbuyy/theme-engine` | `pnpm --filter=@letbuyy/theme-engine typecheck` | PASS | exit 0, 0 diagnostics |
| `@letbuyy/theme-engine` | `pnpm --filter=@letbuyy/theme-engine test` | PASS | 1695 / 1695 pass, 0 fail, 0 skip |
| `@letbuyy/storefront-runtime` | `pnpm --filter=@letbuyy/storefront-runtime typecheck` | PASS | exit 0, 0 diagnostics |
| `@letbuyy/storefront-runtime` | `pnpm --filter=@letbuyy/storefront-runtime test` | PASS | 915 / 915 pass, 0 fail |
| `@letbuyy/merchant-control-plane` | `pnpm --filter=@letbuyy/merchant-control-plane typecheck` | PASS | exit 0, 0 diagnostics |
| `@letbuyy/merchant-control-plane` | `pnpm --filter=@letbuyy/merchant-control-plane test` | PASS | 771 / 771 pass, 0 fail |
| `@letbuyy/api-gateway` | `pnpm --filter=@letbuyy/api-gateway typecheck` | PASS | exit 0, 0 diagnostics |
| `@letbuyy/api-gateway` | `pnpm --filter=@letbuyy/api-gateway test` | 3 FOREIGN failures | 537 pass / 3 fail / 540 total |
| `node scripts/validators/theme-governance-validator.mjs` | — | PASS | exit 0 — 25 section schemas, WARN mode, Liquid default OFF, fallback placeholder, schema migration runner |
| `node scripts/validators/migration-safety-validator.mjs` | — | PASS | exit 0 — no destructive replay hazards |
| `node scripts/validate-governance.mjs` | — | FAIL (pre-existing) | Exit 1 — RISK-GOV-001 (tenant-tables.registry.ts drift); anti-fabrication sub-validator PASS (1319 active source files, 0 temporary entries) |
| `node scripts/validators/sequential-migration-validator.mjs` | — | FAIL (pre-existing) | Exit 1 — migrations 186/187 on disk, uncommitted WIP; not introduced by M→AC |

**Note on storefront-runtime test count delta:** PROGRAM_STATE.md records `~795` mid-programme. The count at HEAD is 915 because 120 lb-L contract tests (in `tests/launch/lb-l-ai-theme-platform.test.mjs`) check Phase AC source files that were absent until Phase AC landed `ai-intent-parser.ts` and `AICustomizationPanel.tsx`. All 915 pass.

**Note on api-gateway 3 failures:** All three are CONFIRMED FOREIGN pre-existing failures: (1) `ai.test.ts` — regex `/adapter.purchase/` not matched, gateway AI route stub incomplete; (2) `internal-os-executive-analytics.test.ts` — ENOENT for migration 129; (3) `payments.test.ts` — regex `/storefrontBrowserApiFetch/` not matched. No M→AC commit touches these files. These failures are unchanged since Phase P baseline.

### 2.2 Integrity seams (confirmed byte-identical across M→AC programme)

| Seam | File | Evidence |
|------|------|---------|
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | `packages/theme-engine/src/theme-governance.ts:14` | `git diff 9186188e..HEAD` on this file shows zero lines changed on this constant. theme-governance-validator output: `Liquid default OFF`. |
| `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` (FORBID_ATTR, FORBID_TAGS, ADD_ATTR, CUSTOM_ELEMENT_HANDLING) | `packages/theme-engine/src/theme-renderer.ts:170-231` | 4 commits touch theme-renderer.ts in M→AC (phases W/Y/T/AA) but 0 diff lines touch the DOMPurify config block, FORBID_ATTR, FORBID_TAGS, ADD_TAGS, ADD_ATTR, or CUSTOM_ELEMENT_HANDLING. Config is byte-identical to Phase M baseline. |
| `publish_theme_release` RPC call (10 parameters at lines 699-710) | `services/api-gateway/src/execution/theme-execution.adapter.ts:699-710` | `git diff fa4e4786..HEAD` on this adapter shows no +/- lines for `rpc('publish_theme_release'` or any `p_` parameter. The `p_expected_current_release_version` ARB-gated extension (mentioned in Phase AB notes) is NOT present in the current call. |
| Money ledger (checkout/payment/order routes) | `services/api-gateway/src/routes/payments.ts`, `orders.ts`, checkout routes directory | `git diff 9186188e..HEAD` on these paths returns 0 diff lines. All M→AC commits to `services/api-gateway/src/routes/` are theme-scoped (`feat(theme): ...`). The six canonical money RPCs do not appear as `rpc()` calls in `packages/theme-engine/src/` (2 hits are in test comments, not RPC invocations). |
| Fabrication check | All production source in `packages/theme-engine/src/` | Grep for live LLM imports (`openai`, `anthropic`, `@ai-sdk`, `langchain`, `ChatCompletion`, `generateText`, `streamText`) returns zero hits. `packages/theme-engine/package.json` has no LLM provider dependency. Four honesty mechanisms structurally verified (see §3.4). |

### 2.3 Capability matrix — what is built

| Phase | Capability | Status | Key evidence |
|-------|-----------|--------|-------------|
| N | Theme Document V2 | CONNECTED | `packages/theme-engine/src/theme-document.ts`: `ThemeDocumentSchema` at line 343, `toThemeDocumentV2`/`fromThemeDocumentV2` adapters. All gate suites typecheck clean against this schema. |
| O | Preset and Experience Engine 2.0 | CONNECTED | `packages/theme-engine/src/experience-apply.ts`: `computeExperienceApplyDiff` at line 456, `applyExperienceToDocument` at line 576. `experience-compositions.ts`: 10 experiences with structural distinctness enforced by tests. RISK-O01/O02 accepted as low. |
| P | Drafts / Revisions / Publish / Rollback | CONNECTED | `services/api-gateway/src/execution/theme-execution.adapter.ts`: `publishReleaseSnapshot` (line 696), `rollbackRelease` (line 1547), `db.rpc('publish_theme_release')` at lines 699–713, idempotency_key partial unique index (migration 189). RISK-TOCTOU-P01/P02 (TS-level CAS gaps) open but ARB-gated. |
| Q | Merchant Theme Library | STRUCTURAL-ONLY | Routes exist in `services/api-gateway/src/routes/themes.ts`. Plan-limit enforcement is non-atomic (RISK-TOCTOU-Q01): `countInstalledSiteThemes` + insert are two separate DB round-trips with no advisory lock or DB-level CHECK constraint. Full closure requires ARB-gated SECURITY DEFINER RPC. |
| R | Visual Editor Shell | STRUCTURAL-ONLY | `packages/theme-engine/src/editor-bridge-protocol.ts`: 57 lines, `EDITOR_READY_MESSAGE` and `INSPECTOR_ADD_SECTION_INTENT` defined. `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` is FOREIGN WIP — not touched by any M→AC commit. |
| S | Live Preview Inspector | CONNECTED | `editor-bridge-protocol.ts:47` (`INSPECTOR_ADD_SECTION_INTENT`). All 8 Phase S security/UX findings resolved before phase close per RISK_REGISTER.md. Bridge origin check is fail-closed; READY_MESSAGE suppressed when env var absent. |
| T | Nested Blocks / Section Groups | STRUCTURAL-ONLY | `packages/theme-engine/src/theme-document.ts:204–207` (`allowedChildTypes` enforcement in document model). RISK-T05 open: `allowedChildTypes` not enforced in the depth-bounded renderer (`theme-renderer.ts`) at render time. Depth-bounding is model-level only. |
| U | Settings Control Renderer | CONNECTED | `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` and `ResourcePickerControl.tsx`. RISK-SEC-U01/U02/U03 (setting-renderer XSS hardening gaps) open, carried to Phase AE. |
| V | Template System | CONNECTED | `packages/theme-engine/src/template-registry.ts`: 600 lines, all 15/15 route types covered (index, product, collection, blog, article, page, cart, account, login, register, search, password, not_found, 404, gift-card) as of Phase E commit `0e3d763e`. Governance validator cross-checks parity list count. |
| W | Dynamic Sources / Custom Data | STRUCTURAL-ONLY | Resource bindings (product/collection/page/blog/menu) CONNECTED via `GET /v1/themes/resource-search`. **Metafield bindings NOT-CONNECTED** (see §3). |
| X | Media Library | CONNECTED | `services/api-gateway/src/routes/themes/media-library.ts` exists and is mounted. Upload handler uses R2 with `verifyUploadStoreOwnership`. RISK-X01 (R2 key user-scoped not site-scoped) is OPEN/LOW and deferred. |
| Y | App Block Extensions | NOT-CONNECTED | `packages/theme-engine/src/app-block-model.ts:309–310`: `APP_BLOCK_NOT_CONNECTED_REASON` constant. `apps/app-marketplace` is FROZEN. `buildLiquidAppBlocks` returns placeholder HTML only. |
| Z | Markets / Localization | CONNECTED | `packages/theme-engine/src/theme-locale.ts`: 336 lines, `en-IN` India-first constant explicit, `tLocale` helper with prototype-safe fallback chain. **FX display structural-only** (`fxConnected: false` literal type always). RISK-Z01 open, carried to AE. |
| AA | Custom CSS + Code Workspace | STRUCTURAL-ONLY | `custom-css-sanitizer.ts` blocks 22 injection vector classes. Merchant editor (`CustomCssWorkspace.tsx`) and server-side proxy guard CONNECTED. **Render-path call site NOT wired** (see §3). |
| AB | Safe Theme Updates / Versioning | CONNECTED | `packages/theme-engine/src/theme-safe-update.ts`: 862 lines, `planThemeSafeUpdate` pure and deterministic. RISK-DUAL-N01 compliance enforced. |
| AC | AI-Assisted Customization | STRUCTURAL-ONLY | Deterministic primitives (WCAG 2.1 AA contrast math, parametric palette generator, typography pairing, section ordering, accessibility analyzer, bundle optimizer) CONNECTED — emit validated `ThemeDocument` proposals with no LLM call. **NL free-text parsing NOT-CONNECTED** (see §3). |

---

## 3. NOT-CONNECTED Seams — Must Be Resolved Before Platform-Wide Flip

This section is the authoritative catalogue of live seams that are not connected at HEAD. Each entry identifies the exact missing piece, the file evidence for the NOT-CONNECTED annotation, and whether the seam must be wired before the global flip or may be accepted as a deferred capability.

### 3.1 Mandatory pre-flip seams (the ARB must wire or formally risk-accept all four before authorising a global flip)

#### Seam 1 — Custom CSS render-path wiring (Phase AA)

| Field | Value |
|-------|-------|
| **Phase** | AA |
| **Status** | NOT-CONNECTED |
| **Criticality** | MANDATORY PRE-FLIP |
| **What is built** | `buildLiquidThemeHeadAssets(bundle, rawCustomCss?: string)` gains optional second param. `validateAndScopeCustomCss` blocks 22 injection vector classes. Merchant editor (`CustomCssWorkspace.tsx`) and server-side proxy guard at `settings/route.ts` are CONNECTED. |
| **What is missing** | Three steps not yet implemented: (1) add `rawCustomCss?: string` field to `ThemeRendererInput` at `packages/theme-engine/src/theme-renderer.ts:128–136`; (2) have the composition layer fetch `site_settings.custom_css` from the DB and pass it into `ThemeRendererInput`; (3) update the call at `theme-renderer.ts:585` from `buildLiquidThemeHeadAssets(bundle)` to `buildLiquidThemeHeadAssets(bundle, input.rawCustomCss)`. |
| **Evidence** | `theme-renderer.ts:585` (called as `buildLiquidThemeHeadAssets(bundle)` — no second argument); `theme-renderer.ts:128–136` (`ThemeRendererInput` definition — `rawCustomCss` field absent); `docs/storefront-theme-platform/phase-aa/PHASE_AA_REPORT.md` (call site at line 585 is NOT changed in Phase AA); `docs/storefront-theme-platform/phase-ab/PHASE_AB_REPORT.md:259` (custom_css render wiring NOT-CONNECTED, Phase AB did not wire it). |
| **Risk if flipped without wiring** | Merchant-authored and sanitizer-approved custom CSS is stored in the DB but never injected into the Liquid storefront head. All custom CSS is silently dropped on Liquid renders. No security risk (sanitizer already validates on write), but visual correctness is degraded for every merchant who has applied custom CSS. |
| **Owner** | Engineering — Phase AE scope |

#### Seam 2 — Metafield render resolution (Phase W)

| Field | Value |
|-------|-------|
| **Phase** | W |
| **Status** | NOT-CONNECTED |
| **Criticality** | MANDATORY PRE-FLIP (or ARB risk-acceptance that metafield content displays its fallback placeholder for all stores) |
| **What is built** | `ThemeRendererInput` metafield binding interface at `packages/theme-engine/src/dynamic-source-binding.ts:81–91` (HONESTY LAW comment + `MetafieldBinding` interface with NOT-CONNECTED annotation). Resource bindings (product/collection/page/blog/menu) resolve correctly via `GET /v1/themes/resource-search`. |
| **What is missing** | `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` does not exist. `ThemeRendererInput` has no metafield hydration bag. `resolveDynamicSourceDescriptors` returns the `MetafieldBinding` fallback unconditionally for all `'metafield'` source bindings at `dynamic-source-binding.ts:242–245`. |
| **Evidence** | `packages/theme-engine/src/dynamic-source-binding.ts:81–91` (HONESTY LAW comment); `dynamic-source-binding.ts:242–245` (`case 'metafield': returns fallback`, comment: `Exact missing piece: apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts`); directory listing of `apps/storefront-runtime/src/lib/theme-engine/` confirms `metafield-service.ts` absent. |
| **Risk if flipped without wiring** | Any section binding that reads a metafield key (e.g., a product description extension or a custom page attribute) renders its fallback placeholder rather than the live metafield value. No error is surfaced to the merchant. Stores that rely heavily on metafield-bound sections would see degraded content on all Liquid-rendered pages. |
| **Owner** | Engineering — Phase AE scope |

#### Seam 3 — Live FX rate feed for non-INR currency display (Phase W/Z)

| Field | Value |
|-------|-------|
| **Phase** | W / Z |
| **Status** | NOT-CONNECTED |
| **Criticality** | MANDATORY PRE-FLIP for any store with `sites.currency != 'INR'`; risk-acceptable for INR-only stores in Stage 1–2 |
| **What is built** | `formatThemeCurrencyDisplay(amountMinorUnits, currencyCode?, locale?)` in `packages/theme-engine/src/theme-locale.ts:270`. INR+en-IN output is byte-identical to `formatLiquidMoney`. Non-INR display uses major-unit division (`/ 100`) with no conversion applied. |
| **What is missing** | No Forex API, rate feed, or exchange table wired anywhere. `fxConnected: false` is a **literal type** (not a runtime boolean) at `theme-locale.ts:270` — any `if(result.fxConnected)` branch is statically dead code. Missing: a server-side FX rate source (e.g., `sites.currency` + a rate table or Razorpay FX endpoint) and a display-only conversion helper that never touches the canonical money ledger. |
| **Evidence** | `packages/theme-engine/src/theme-locale.ts:270` (`fxConnected: false` literal type in return interface); `theme-locale.ts:333` (always returned as `false` in `formatThemeCurrencyDisplay`); `docs/storefront-theme-platform/phase-z/PHASE_Z_REPORT.md §4.2` (zero occurrences of `exchangeRate`/`exchange_rate`/`convertCurrency` in non-LCIS source). |
| **Risk if flipped without wiring** | Non-INR stores display amounts in their configured currency symbol but at the INR minor-unit scale (i.e., ₹10,000 would display as $10,000 without conversion). This is a merchant-trust and legal-compliance issue. INR-only stores are unaffected. |
| **Owner** | Engineering — Phase AE scope; risk-acceptable for INR-only Stage 1/2 canary if all activated stores are confirmed INR |

#### Seam 4 — AI model boundary — NL free-text customization parsing (Phase AC)

| Field | Value |
|-------|-------|
| **Phase** | AC |
| **Status** | NOT-CONNECTED |
| **Criticality** | MANDATORY PRE-FLIP if the AI customization feature is marketed as enabled; risk-acceptable if the 503 response and NOT-CONNECTED UI badge are treated as expected behaviour for a preview feature |
| **What is built** | Deterministic AI primitives (WCAG 2.1 AA contrast math at `ai-color-system.ts`, parametric palette generator, typography pairing at `ai-typography.ts`, section ordering at `ai-layout.ts`, accessibility analyzer, bundle optimizer) are CONNECTED and emit validated `ThemeDocument` proposals with no LLM call. The `AICustomizationPanel.tsx` component correctly shows the NOT-CONNECTED state. |
| **What is missing** | Gateway route `POST /v1/theme-ai/parse-brief` does not exist (`services/api-gateway/src/routes/themes/` contains only `media-library.ts` and `theme-update-route.ts`). `THEME_AI_PROVIDER_API_KEY` env var unset. `proposeThemeCustomization` returns `AINotConnectedResult` (`status: 'NOT_CONNECTED'`) for every free-text intent at `ai-intent-parser.ts:595–602`. `MODEL_BOUNDARY.status = 'NOT_CONNECTED'` at `theme-ai-sdk.ts:919–920`. Merchant proxy returns HTTP 503 structured NOT_CONNECTED body when gateway route absent. |
| **Evidence** | `packages/theme-engine/src/ai-intent-parser.ts:595–602` (free-text branch: `status: 'NOT_CONNECTED'`); `packages/theme-engine/src/theme-ai-sdk.ts:919–920` (`MODEL_BOUNDARY = Object.freeze({ status: 'NOT_CONNECTED' as const, ... })`); `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts:85–87` (structured NOT_CONNECTED envelope with `envVar` and `gatewayRoute` fields). |
| **Risk if flipped without wiring** | AI free-text customization always returns 503. The deterministic primitives (colour, typography, layout) continue to work. Merchant-facing impact is limited to the NL input path; all other editor and Liquid rendering paths are unaffected. If the feature is gated behind a NOT-CONNECTED badge in the editor (current state), risk is low but must be ARB-acknowledged. |
| **Owner** | Engineering — Phase AE scope; ARB risk-acceptance required for Stage 3+ canary |

### 3.2 Deferred seams (may proceed through canary stages with NOT-CONNECTED disclosure; ARB must track and close before 1000-store stage)

#### Seam 5 — Live app-block content runtime (Phase Y)

| Field | Value |
|-------|-------|
| **Phase** | Y |
| **Status** | NOT-CONNECTED |
| **Criticality** | DEFERRED — acceptable through Stage 1–4 canary; must be resolved or formally removed from scope before Stage 5 (1000 stores) |
| **What is built** | `APP_BLOCK_NOT_CONNECTED_REASON` constant at `packages/theme-engine/src/app-block-model.ts:309–310`. `buildLiquidAppBlocks` returns placeholder HTML. `app-block-slot` section type is listed in `THEME_LIQUID_PORTABLE_SECTION_PARITY` but renders placeholder only. |
| **What is missing** | `apps/app-marketplace` is FROZEN. No live app registry API, no sandboxed iframe host, no app-block content gateway endpoint. Missing: live app registry API, sandboxed iframe host, and gateway endpoint serving real app-block HTML. |
| **Evidence** | `packages/theme-engine/src/app-block-model.ts:309–310` (`APP_BLOCK_NOT_CONNECTED_REASON`); `CLAUDE.md` (app-marketplace frozen/pending consolidation); `docs/storefront-theme-platform/phase-y/PHASE_Y_REPORT.md:13`. |
| **Risk** | Stores that display third-party app content via `app-block-slot` sections see an empty placeholder. No error is surfaced. Functional for stores with no app blocks. |

#### Seam 6 — Theme analytics event emission and metrics (Phase K / M→AC)

| Field | Value |
|-------|-------|
| **Phase** | K / M→AC |
| **Status** | NOT-CONNECTED |
| **Criticality** | DEFERRED — but the canary soak monitoring plan in §6 depends on `lb:canary:render` Cloudflare Logpush being wired before Stage 1 |
| **What is built** | Log emission points exist: `lb:canary:render` at `composition-engine.tsx:663–677`, `lb:canary:render:fallback` at `composition-engine.tsx:629–633`, `lb:liquid:block-error` at `theme-renderer.ts:777`. These are structured `console.log`/`console.warn` calls — the emission points are CONNECTED. |
| **What is missing** | All 5 theme analytics event types (`install`, `publish`, `preview`, `apply`, `uninstall`) return `implemented: false` from `describeThemeEventEmissionPoints()`. All 5 metric types return `connected: false` from `describeThemeMetrics()`. No analytics pipeline, Cloudflare Analytics Engine integration, or DB event table wired for theme events. No Logpush sink wired to capture `lb:canary:render` from a deployed Worker. |
| **Evidence** | `packages/theme-engine/src/theme-analytics.ts:229–253` (`implemented: false` for all 5 event types); `theme-analytics.ts:177–201` (`connected: false` for all 5 metric types); `theme-analytics.ts:7` (honesty law comment). |
| **Risk** | The canary soak monitoring plan cannot measure fallback rate, latency, or error rate without Logpush being wired. Stage 1 canary may proceed with manual `wrangler tail --format=json` monitoring, but this is not sustainable past Stage 2. |

### 3.3 Summary NOT-CONNECTED register

| Seam | Phase | Must wire before flip? | Acceptable through Stage |
|------|-------|----------------------|------------------------|
| Custom CSS render-path wiring | AA | YES — mandatory | Stage 0 (block on Phase AE delivery) |
| Metafield render resolution | W | YES — mandatory (or ARB risk-acceptance for placeholder fallback) | Stage 1 only if ARB explicitly accepts placeholder behaviour |
| Live FX rate feed | W/Z | YES for non-INR stores; risk-acceptable for INR-only | Stage 1–2 (INR-only stores only) |
| AI model boundary (NL parsing) | AC | ARB risk-acceptance required — 503 response is disclosed | Stage 1–5 with NOT-CONNECTED badge |
| Live app-block content runtime | Y | No (placeholder acceptable) — must close before Stage 5 | Stage 1–4 |
| Theme analytics emission | K/M→AC | Logpush must be wired before Stage 1 canary monitoring | Cannot defer Logpush past Gate 0 |
| Liquid canary flag itself | M→AC | ARB must authorise — this document does not do so | N/A (the flip is the destination) |

---

## 4. Original ARB Blocker Reconciliation

The seven blockers from `docs/storefront-liquid-discovery/11_GAP_ANALYSIS.md` and `certification/ARCHITECTURE_CERTIFICATION.md`, first reconciled in the Phase J ARB package. The M→AC programme does not regress any closure.

| # | Blocker | Phase Closed (original programme) | Current state (M→AC HEAD) | M→AC change? |
|---|---------|----------------------------------|--------------------------|-------------|
| B-1 | postMessage key mismatch — editor section-selection broken | Phase C (commit `70a40c2a`) | **CLOSED** | No regression. `StorefrontPreviewBridge` at `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` bridges `LETBUYY_THEME_EDITOR_SELECTION` to `letbuyy:theme-editor:section-selected` via same-origin postMessage. Phase AD certification verified R-10 REFUTED. |
| B-2 | `newsletter` / `newsletter-signup` type split — silent render-time lookup miss | Phase C+D (commits `70a40c2a` + `def512cb`) | **CLOSED** | No regression. `PORTABLE_TO_LIQUID_TYPE_OVERRIDES` at `portable-to-liquid.ts:46` maps `newsletter → newsletter-signup` at compile time. Both migrations 171 and 172 store sections with `type:newsletter-signup`. |
| B-3 | Fonts not wired — dead `buildGoogleFontsHref`, wrong typefaces | Phase D (commit `def512cb`) | **CLOSED** | No regression. `buildGoogleFontsHref` wired into `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx`; 6 experience fonts load correctly; CSP `style-src`/`font-src` extended. |
| B-4 | `linklists` absent from Liquid scope — `{{ shop.navigation }}` nil | Phase D (commit `def512cb`) | **CLOSED** | No regression. `navToLinklists()` converts `StoreModel.navigation` to Shopify-convention `linklists` array; wired into `buildLiquidScope` in `packages/theme-engine/src/theme-renderer.ts`. |
| B-5 | Schema migration engine — zero concrete migrations registered | Phase G (commit `40741cb8`) | **MITIGATED** | No regression. `applySectionSchemaMigrations` wired in the gateway publish path (`theme-execution.adapter.ts`). Registry is honestly empty — no breaking renames yet authored. Full closure requires the first concrete migration entry to be registered. |
| B-6 | `letbuyy-core` DB row missing — theme-editor 404 for letbuyy-core stores | Phase G (commit `40741cb8`) | **CLOSED (conditional on migration run)** | No regression. Migration `188_letbuyy_core_theme_row.sql` committed (idempotent `INSERT … ON CONFLICT (slug) DO NOTHING`). Production closure requires migration 188 to be applied to the production database. RISK-DATA-001 remains open. |
| B-7 | Settings dual-shape — DB flat object vs TS 5-group structure | Phase G (commit `40741cb8`) | **MITIGATED** | No regression. Canonicalization utility (`settingsCanonicalizeFlat` / `settingsCanonicalizeGrouped`) shipped in `packages/theme-engine/src/settings-schema-canonical.ts`. End-to-end consumption replacing all ad-hoc shape assumptions is deferred (G3-consume not yet enforced). |

**Summary:** 5 of 7 CLOSED, 2 MITIGATED, 0 open blockers. The M→AC programme does not touch the closure evidence for any of these seven items.

---

## 5. Per-Stage Canary Ramp

The ramp reuses the Phase J ROLLOUT_PLAN structure and extends it to cover the M→AC platform capability base. Seven stages. No stage may be skipped. Each stage requires evidence before the next gate opens. The global flag is NOT flipped until Stage 7.

### Stage 0 — Pre-Activation Prerequisites (owner: Engineering + Operations)

Must be completed before any store is activated on Liquid. No time limit; this stage is synchronous.

| Item | Required action | Evidence gate |
|------|----------------|--------------|
| Custom CSS render-path wiring | Implement Phase AE: add `rawCustomCss` to `ThemeRendererInput`, wire DB fetch of `site_settings.custom_css` in composition layer, update `theme-renderer.ts:585` call | `buildLiquidThemeHeadAssets(bundle, rawCustomCss)` call site committed; typecheck + test green |
| Metafield service | Implement `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` and wire hydration bag into `ThemeRendererInput` | File exists; `resolveDynamicSourceDescriptors` returns live values for `'metafield'` sources |
| Logpush / log sink wired | Wire Cloudflare Logpush or Analytics Engine to capture `lb:canary:render` and `lb:canary:render:fallback` structured log events from the deployed storefront-runtime Worker | Operator can query fallback rate from log sink; `wrangler tail --format=json` as fallback for Stage 1 only |
| Migration 188 applied to production DB | Run `database/supabase/migrations/188_letbuyy_core_theme_row.sql` against the production Supabase instance | `SELECT slug FROM themes WHERE slug = 'letbuyy-core'` returns 1 row |
| FX scope declared | ARB records whether the Stage 1 canary is restricted to INR-only stores (risk-acceptable) or whether FX wiring is required first | ARB decision document; if non-INR stores are included, FX wiring must be completed before Stage 1 |
| `FEATURE_LIQUID` gateway flag decision | ARB records whether to wire `FEATURE_LIQUID` to `featureGate()` as a kill switch or document it as intentionally dormant | Decision recorded in ARB minutes; if wired, gateway deploy verified |
| `validate-governance.mjs` tenant drift | Run `scripts/generators/generate-tenant-table-registry.mjs` and commit the output | `node scripts/validate-governance.mjs` exits 0 (or ARB formally accepts the pre-existing non-blocker) |

### Stage 1 — Internal Canary (≤5 LetBuyy-internal stores, ≥7 days)

**Activation:** Publish a Liquid-engine release for 1–5 internal LetBuyy team stores by setting `renderer_engine='liquid'` in `theme_releases.release_manifest` at publish time (the existing per-store canary path; no flag change required).

**Monitoring commitment:** Operator must observe `lb:canary:render` events via Logpush or `wrangler tail --format=json`. Manual monitoring acceptable for Stage 1.

| Criterion | Gate threshold | Measurement source |
|-----------|---------------|-------------------|
| Liquid publish succeeds for all activated stores | No HTTP 500 on publish; `renderer_engine='liquid'` in `release_manifest` | Supabase `SELECT release_manifest->>'renderer_engine' FROM theme_releases WHERE id = ...` |
| Fallback rate (`lb:canary:render` with non-null `fallback_reason`) | < 0.5% over 7 days | `lb:canary:render` log filter on `fallback_reason != null` |
| Unexpected throw rate (`lb:canary:render:fallback` events) | < 0.1% over 7 days | `lb:canary:render:fallback` event count |
| HTTP 500 rate | No increase vs React baseline | Cloudflare error rate or Vercel function error dashboard |
| Blank-page / empty-chrome incidents | Zero SEV-1 attributed to Liquid renderer | Engineering + Support incident log |
| Custom CSS renders correctly | Merchant-applied CSS visible in Liquid-rendered storefronts | Manual QA on activated stores |
| Metafield bindings render (or placeholder is acceptable) | ARB-declared scope | Manual QA on activated stores |
| No `lb:canary:render:fallback` events from custom CSS path | Zero `buildLiquidThemeHeadAssets` failures in fallback events | Log review |

**Exit gate:** Operations submits a Stage 1 Soak Report to the ARB. ARB reviews and formally opens Stage 2.

### Stage 2 — Demo Store Canary (LetBuyy demo/showcase stores, ≥7 days)

**Activation:** Extend Liquid to LetBuyy's publicly accessible demo stores. These are real-traffic stores with external visitors.

| Criterion | Gate threshold | Measurement source |
|-----------|---------------|-------------------|
| All Stage 1 thresholds hold | Same thresholds as Stage 1 | Log sink (Logpush recommended — `wrangler tail` not suitable for 14+ days) |
| Production p95 TTFB for Liquid stores | ≤ 2× React baseline (establish baseline in Stage 2) | Cloudflare Analytics Engine or Vercel speed insights |
| SEO — page title and meta rendering | `<title>` renders `{{ shop.name }}` correctly (non-nil); no `<meta name="description">` regression | Lighthouse CI or manual inspection against a React baseline |
| DAST scan against a Liquid-rendered staging URL | No Critical or High findings | OWASP ZAP or Burp Suite against a staging deployment |
| H-F3 risk-accepted or resolved | ARB records whether `settings_data` export without `BLOCKED_DROP_KEYS` filter is formally accepted | ARB decision in Stage 2 review minutes |
| FX scope confirmed | If non-INR demo stores are activated, FX wiring must be complete | FX wiring commit; no `fxConnected: false` in live theme-locale responses for non-INR |
| AI NOT-CONNECTED disclosure active | `AICustomizationPanel.tsx` shows NOT-CONNECTED badge for all demo stores | Manual QA |

**Exit gate:** Operations submits a Stage 2 Soak Report. ARB reviews DAST results and formally opens Stage 3.

### Stage 3 — Urban Kicks Anchor Store (the production letbuyy-core / UK store, ≥7 days)

**Activation:** Activate Liquid on the Urban Kicks (`urban-kicks`) and `letbuyy-core` anchor stores. These are the stores for which migration 180 set `rendererEngine: 'liquid'` in `themes.default_template` and migration 188 provisioned the `letbuyy-core` theme row. They are the canonical design reference stores for the 10 experience presets.

| Criterion | Gate threshold |
|-----------|---------------|
| All Stage 2 thresholds hold | No regression from Stage 2 |
| Migration 188 applied and `letbuyy-core` row confirmed | `SELECT slug FROM themes WHERE slug = 'letbuyy-core'` returns 1 row in production |
| All 10 experience presets render correctly in Liquid | Visual QA across all 10 presets on both stores |
| All 6 Google Font families load correctly | Network inspection confirms `fonts.googleapis.com` requests succeed; CSP allows `style-src fonts.googleapis.com` |
| ARB AI risk-acceptance for free-text NL seam | ARB formally accepts 503 response for NL customization or requires gateway route before Stage 4 | ARB decision in Stage 3 review minutes |

**Exit gate:** ARB reviews Stage 3 Soak Report and formally opens Stage 4.

### Stage 4 — 10-Store Canary (≥14 days)

**Activation:** Expand to 10 named production stores via per-store Liquid release publishing. Stores should be selected to cover a range of plan tiers, section type usage, and product catalogue sizes.

| Criterion | Gate threshold |
|-----------|---------------|
| All Stage 3 thresholds hold | No regression |
| Logpush / Analytics Engine fully wired | Manual `wrangler tail` is no longer acceptable; structured log pipeline must be queryable |
| Production CPU time / memory per Liquid render | Under Cloudflare Worker CPU budget; no sustained heap growth above React baseline (first memory profiling run) |
| Per-block error rate (`lb:liquid:block-error` events) | < 1% of rendered blocks | Log sink aggregation on `lb:liquid:block-error` event count / total rendered blocks |
| App-block NOT-CONNECTED disclosure active | Stores using `app-block-slot` sections see placeholder; no merchant support escalation about blank app blocks | Support ticket review |
| RISK-TOCTOU-Q01 status | ARB reviews plan-limit enforcement non-atomicity (RISK-TOCTOU-Q01) and either closes it (SECURITY DEFINER RPC) or formally accepts it for current merchant scale | ARB decision document |

**Exit gate:** ARB reviews Stage 4 Soak Report including first production memory profiling data. Formally opens Stage 5.

### Stage 5 — 100-Store Canary (≥14 days)

**Activation:** Expand to 100 production stores. At this scale, `wrangler tail` monitoring is operationally impractical; full observability pipeline must be in place.

| Criterion | Gate threshold |
|-----------|---------------|
| All Stage 4 thresholds hold at 100-store scale | No regression at higher traffic volume |
| Observability pipeline production-grade | `lb:canary:render` events queryable from Logpush sink with < 5 min latency; dashboards viewable by on-call operator |
| Visual-diff baseline established | < 1% pixel diff vs React render for same merchant content on at least 10 store templates | Playwright or visual regression tool |
| App-block seam resolution decision | ARB decides: wire live app registry before Stage 6, or formally record app-block as out-of-scope for the Liquid platform (documented in `SHOPIFY_PARITY_MATRIX.md`) | ARB decision document |
| AI NL seam resolution decision | ARB decides: wire gateway route `POST /v1/theme-ai/parse-brief` before Stage 6, or formally accept 503 as platform behaviour through Stage 7 | ARB decision document |
| Theme analytics `implemented: false` status reviewed | ARB acknowledges that `describeThemeEventEmissionPoints()` returns `implemented: false` for all 5 event types at this stage | ARB decision document |

**Exit gate:** ARB reviews Stage 5 Soak Report. Formally opens Stage 6.

### Stage 6 — 1000-Store Canary (≥21 days)

**Activation:** Expand to 1000 production stores. This is the final pre-flip validation at realistic platform scale.

| Criterion | Gate threshold |
|-----------|---------------|
| All Stage 5 thresholds hold at 1000-store scale | No regression |
| Fallback rate stable | < 0.5% sustained over 21 days with no upward trend in the last 7 days |
| `lb:canary:render:fallback` event rate stable | < 0.1% sustained over 21 days |
| HTTP 500 rate | Statistically indistinguishable from React baseline across all active Liquid stores |
| Production p95 TTFB | PROPOSED: ≤ 500 ms at production traffic levels (ARB sets this threshold based on Stage 4–5 data) |
| Load test completed | k6 or Artillery load test at ≥ 50 VUs for ≥ 60 minutes against a Liquid-enabled staging stack | Load test report submitted to ARB |
| Chaos test (crash injection) | Per-section crash recovery (`L2`) confirmed in staging: sections with injected panics produce `<!-- lb:section-error -->` comments and neighbouring sections continue rendering | Staging chaos test report |
| All mandatory pre-flip seams closed | Custom CSS wired, metafield service wired, FX wired (or ARB non-INR exclusion recorded) | Commit evidence for each |
| Governance validator clean | `node scripts/validate-governance.mjs` exits 0 | Gate run log |
| RISK-TOCTOU-P01/P02 (Drafts/Publish CAS gaps) | ARB reviews and either closes (adds `p_expected_current_release_version` parameter per Phase AB notes) or formally accepts as an operational risk at 1000-store scale | ARB decision document |

**Exit gate:** ARB receives Stage 6 Soak Report with all threshold evidence. ARB formally authorises Stage 7.

### Stage 7 — Platform-Wide Flip (ARB authority only)

**Activation:** ARB convenes with Stage 6 evidence. If all thresholds are met and all open items are resolved or formally accepted, the ARB may authorise:

1. A human-authored commit changing `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true` at `packages/theme-engine/src/theme-governance.ts:14`.
2. A supervised `storefront-runtime` redeploy with the Stage 4–6 rollback runbook on standby.
3. Updating `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` from `'deferred'` to `'approved'` in the same file (documentation constant only; does not gate anything at runtime).

**No part of this document, and no automated script in this repository, performs Stage 7. The entire Phase AD programme does not flip any flag.**

---

## 6. Go / No-Go Criteria Summary

The table below condenses the stage-by-stage gates into a single ARB reference. GREEN = evidence exists. YELLOW = evidence partially exists or requires live infrastructure. RED = not available without deliberate engineering action.

| Domain | Current state | Minimum stage where met |
|--------|--------------|------------------------|
| Type safety (all four packages) | GREEN — 4/4 typechecks exit 0 | NOW |
| Committed test suites | GREEN — 1695+915+771+537 pass (3 foreign failures excluded) | NOW |
| Crash recovery / React fallback safety net | GREEN — 5 layers (G4 version gate, per-section, per-region, outer catch, chrome-fallback seam) | NOW |
| DOMPurify config integrity | GREEN — byte-identical to Phase M baseline | NOW |
| Money ledger isolation | GREEN — 0 diff lines in M→AC on checkout/payment/order routes | NOW |
| Custom CSS render-path wiring | RED — `ThemeRendererInput.rawCustomCss` absent, call site not updated | Stage 0 prerequisite |
| Metafield resolution | RED — `metafield-service.ts` absent | Stage 0 prerequisite |
| Observability log pipeline | YELLOW — emission points CONNECTED; Logpush NOT-CONNECTED | Stage 0 prerequisite |
| FX rate feed (non-INR) | RED — `fxConnected: false` literal type always | Stage 0 (or ARB INR-only restriction) |
| AI NL customization gateway route | RED — `POST /v1/theme-ai/parse-brief` does not exist | Stage 3 risk-acceptance required |
| Live app-block runtime | RED — `apps/app-marketplace` FROZEN | Stage 5 decision required |
| Production memory profiling | NOT-CONNECTED | Stage 4 |
| DAST scan against live URL | NOT-CONNECTED | Stage 2 |
| Load test at 50 VUs | NOT-CONNECTED | Stage 6 |
| Visual-diff baseline | NOT-CONNECTED | Stage 5 |
| Per-store canary soak data (7 days) | NOT-CONNECTED (zero production Liquid renders) | Stage 1 |
| Theme analytics `implemented: true` | NOT-CONNECTED | Not required for flip; ARB tracking |
| `validate-governance.mjs` exits 0 | YELLOW — anti-fabrication PASS; tenant-registry FAIL (pre-existing) | Stage 6 prerequisite |
| B-5/B-7 residual mitigations | YELLOW — infrastructure built; G3-consume deferred | Ongoing operational gates |

---

## 7. Open Risk Register

Open risks inherited from the M→AC programme that the ARB must acknowledge. Pre-existing risks not introduced by M→AC are marked.

| ID | Severity | Description | Blocker for stage | Owner |
|----|---------|-------------|------------------|-------|
| RISK-GOV-001 | MEDIUM (pre-existing) | `validate-governance.mjs` FAIL: `tenant-tables.registry.ts` out of sync with schema-derived registry. Fix: run `scripts/generators/generate-tenant-table-registry.mjs`. | Stage 6 prerequisite | Human engineering team |
| RISK-DATA-001 | MEDIUM | Migration 188 committed but unapplied in production. `letbuyy-core` DB row absent until run. | Stage 0 prerequisite | Operations |
| RISK-TOCTOU-P01/P02 | MEDIUM (ARB-gated) | Publish/rollback CAS gaps: TS-level compare-and-swap only. `p_expected_current_release_version` parameter extension identified in Phase AB notes but not yet implemented. | Stage 6 review | Engineering + ARB |
| RISK-TOCTOU-Q01 | MEDIUM (ARB-gated) | Plan-limit enforcement non-atomic: `countInstalledSiteThemes` + insert are two separate DB round-trips. Full closure: SECURITY DEFINER RPC. | Stage 4 review | Engineering + ARB |
| RISK-SEC-U01/U02/U03 | MEDIUM | Setting-renderer XSS hardening gaps in `SchemaFormRenderer.tsx`. Carried to Phase AE. | Phase AE delivery | Engineering |
| RISK-T05 | LOW | `allowedChildTypes` not enforced at render time in `theme-renderer.ts` — model-level only. | Canary monitoring | Engineering |
| RISK-X01 | LOW | R2 media key path is user-scoped not site-scoped. Single-layer isolation boundary. | Phase AE review | Engineering |
| RISK-Z01 | LOW | Locale-adjacency edge case carried from Phase Z. | Phase AE delivery | Engineering |
| RISK-AB-01 | LOW | TOCTOU duplicate releases race condition (theme update). | Stage 6 review | Engineering |
| H-F3 (pre-existing) | LOW | `settings_data` exported without `BLOCKED_DROP_KEYS` filter in `theme-artifact-exporter.ts`. Acknowledged design choice; code comment at lines 101–107. | Stage 2 formal risk-acceptance | ARB |
| UC-19 (pre-existing) | LOW | `FEATURE_LIQUID` gateway flag declared (`featureFlags.ts:4`, `wrangler.toml:248`) but `featureGate()` never called — zero runtime effect. | Stage 0 decision required | ARB + Engineering |
| B-5 residual | LOW | Schema migration registry empty. Any future breaking section schema change must register a `ThemeSectionSchemaMigration` before deployment. | Ongoing process gate | Engineering |
| B-7 residual | LOW | G3-consume (settings-schema canonicalization at publish time) deferred. Dual-shape acknowledged. | Ongoing operational gate | Engineering |

---

## 8. Rollback Runbook (reference — no changes from Phase J)

Per-store rollback does not require a code deploy. The fastest path is a DB update to `theme_releases.release_manifest`.

**Fastest per-store rollback (< 90 seconds, no deploy):**

```sql
UPDATE theme_releases
SET release_manifest = release_manifest - 'renderer_engine'
                     || '{"renderer_engine": "json-contract"}'::jsonb
WHERE id = (
  SELECT current_theme_release_id FROM sites WHERE subdomain = '<store-subdomain>'
);
```

Effect timing: ISR revalidation at `export const revalidate = 60` in `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx` (60 s) + gateway SWR (up to 300 s). Worst case: 7 minutes to full effect.

**Per-store canary flag rollback (no deploy):**

Set any of the 11 canary aliases in `sites.template_config` or `theme_releases.release_manifest` to a falsy value (`'false'`, `'0'`, `'disabled'`, `'off'`). Verified via `readBooleanDecision()` at `theme-governance.ts:130`.

**Platform-level kill switch (currently dormant):**

Wire `FEATURE_LIQUID` to `featureGate('FEATURE_LIQUID', ...)` in `services/api-gateway/src/index.ts`. When `FEATURE_LIQUID = 'false'` in production `wrangler.toml`, theme-publish routes that set `renderer_engine='liquid'` can be blocked. This requires a gateway deploy (UC-19 decision required at Stage 0).

**Global default rollback after a platform flip (storefront-runtime redeploy required):**

Revert `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` at `packages/theme-engine/src/theme-governance.ts:14` and redeploy `apps/storefront-runtime`. This is the current state of the constant — no code change required today.

---

## 9. What This Phase Does Not Do

This section is a binding constraint, not a courtesy note.

- This phase does **not** change `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` at `packages/theme-engine/src/theme-governance.ts:14`. The constant remains `false`. The theme-governance-validator confirms `Liquid default OFF` at every gate run.
- This phase does **not** wire the custom CSS render-path call site at `theme-renderer.ts:585`.
- This phase does **not** implement `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts`.
- This phase does **not** wire a FX rate feed.
- This phase does **not** create the gateway route `POST /v1/theme-ai/parse-brief` or set `THEME_AI_PROVIDER_API_KEY`.
- This phase does **not** activate any store on Liquid rendering.
- This phase does **not** commit to the production database.
- This phase does **not** apply migration 188 to any environment.

The ARB is the only authority that may authorise Stage 7. No automated script, no subagent, and no orchestration workflow in this repository performs Stage 7.

---

## 10. Document Traceability

| Reference | Document |
|-----------|---------|
| Phase AD certification | `docs/storefront-theme-platform/phase-ad/PHASE_AD_CERTIFICATION.md` |
| Programme state | `docs/storefront-theme-platform/PROGRAM_STATE.md` |
| Risk register | `docs/storefront-theme-platform/RISK_REGISTER.md` |
| Shopify parity matrix | `docs/storefront-theme-platform/SHOPIFY_PARITY_MATRIX.md` |
| Phase J ARB package (original) | `docs/storefront-liquid-discovery/phase-j/ARB_APPROVAL_PACKAGE.md` |
| Phase J rollout readiness | `docs/storefront-liquid-discovery/phase-j/ROLLOUT_READINESS_PACKAGE.md` |
| Phase J rollback runbook | `docs/storefront-liquid-discovery/phase-j/ROLLBACK_RUNBOOK.md` |
| Phase J observability design | `docs/storefront-liquid-discovery/phase-j/OBSERVABILITY_AND_ALERTING.md` |
| Theme governance constant | `packages/theme-engine/src/theme-governance.ts:14` (flag), `:16–21` (decision object) |
| Theme governance validator | `scripts/validators/theme-governance-validator.mjs` |
| Canary resolution | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:228–244` |
| Composition engine safety net | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:623–635` |
| NOT-CONNECTED: custom CSS call site | `packages/theme-engine/src/theme-renderer.ts:585` |
| NOT-CONNECTED: metafield binding | `packages/theme-engine/src/dynamic-source-binding.ts:242–245` |
| NOT-CONNECTED: FX feed | `packages/theme-engine/src/theme-locale.ts:270` |
| NOT-CONNECTED: AI model boundary | `packages/theme-engine/src/theme-ai-sdk.ts:919–920` |
| NOT-CONNECTED: app-block runtime | `packages/theme-engine/src/app-block-model.ts:309–310` |
| NOT-CONNECTED: analytics | `packages/theme-engine/src/theme-analytics.ts:177–253` |

---

*Canary Readiness ARB Decision Package — LetBuyy Liquid Theme Platform M→AC | 2026-07-11 | Branch: `stepup/main` | Head certified: `83d61e0a` | Author: AD certification sub-agent (read-only; no source changes; no git) | This document is documentation only. It does not modify any source file, environment variable, database row, or governance constant.*
