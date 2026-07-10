# Phase J — Production Rollout Readiness Package

**Document ID:** PHASE-J-ROLLOUT-READINESS-2026-07-10
**Date:** 2026-07-10
**Branch:** stepup/main
**Authority law:** Platform-wide Liquid flip is ARB-AUTHORITY. `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` stays `false`. `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` stays `deferred`. This document is the GO/NO-GO evidence package the ARB would consume — it does not flip anything.
**Honesty law:** Every claim is grounded in committed source on `stepup/main`. CONNECTED = verifiable from the repo now. NOT-CONNECTED = requires live Cloudflare Analytics Engine / Supabase / deployed Worker. No fabricated SLOs or dashboard screenshots.

---

## 1. Activation Levers

All levers verified against current committed source.

### 1.1 Global Default — OFF

`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`
Location: `packages/theme-engine/src/theme-governance.ts:14`

This is the floor. `resolveThemeLiquidRenderingEnabled()` (same file, line 144) falls through to this value when no explicit per-entity signal is found. The ARB platform flip would change this constant and re-deploy storefront-runtime. It is the only mechanism that activates Liquid for all stores simultaneously.

The platform-wide decision object at line 16–21:
```
THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = {
  status: 'deferred',
  authority: 'ARB',
  ...
}
```
This constant is documentation-only. It is NOT read by `resolveThemeLiquidRenderingEnabled()` and does not gate anything at runtime.

### 1.2 Per-Entity Activation — The Only Live Liquid Path Today

`resolveThemeLiquidRenderingEnabled()` at `packages/theme-engine/src/theme-governance.ts:144–182` evaluates four explicit engine signals first, then eleven canary aliases, then falls through to the global default.

**Explicit engine signals (any one = 'liquid' activates Liquid for that entity):**
| Signal path | Where set |
|---|---|
| `templateConfig.rendererEngine` | `store-service.ts:684–686` passes through from `resolvedTemplateConfig` |
| `releaseManifest.renderer_engine` | `theme-execution.adapter.ts:620–643` (gateway `buildReleaseArtifacts`, set = 'liquid' when liquidBundle present) |
| `releaseManifest.rendererEngine` | alias |
| `releaseManifest.renderer.engine` or `releaseManifest.renderer_manifest.engine` | alias |

**Cascade for `urban-kicks` / `letbuyy-core` stores:**
Migration 180 (`database/supabase/migrations/180_urban_kicks_liquid_theme.sql:37`) sets `themes.default_template.rendererEngine = 'liquid'`. The gateway `STOREFRONT_SITE_SELECT` (`public-routes.ts:23`) does **not** join the `themes` table, so `themes.default_template` never reaches the store payload directly. The cascade is: when a merchant publishes a theme release, `buildReleaseArtifacts()` detects the `liquidBundle` present and sets `release_manifest.renderer_engine = 'liquid'` in `theme_releases`. The storefront-runtime reads this via `mapSupabaseToStore()` → `templateConfig.releaseManifest` → `resolveThemeLiquidRenderingEnabled()`. Stores on urban-kicks with **no published release** still render React.

**Eleven canary aliases (any truthy value activates Liquid):**
Checked in `resolveThemeLiquidRenderingEnabled()` lines 162–179:
- `templateConfig.liquidRenderingCanary`
- `themeSettings.liquidRenderingCanary`, `themeSettings.liquid_rendering_canary`
- `releaseManifest.liquidRenderingCanary`, `releaseManifest.liquid_rendering_canary`, `releaseManifest.liquidCanary`, `releaseManifest.liquid_canary`
- `rendererManifest.liquidRenderingCanary`, `rendererManifest.liquid_rendering_canary`, `rendererManifest.liquidCanary`, `rendererManifest.liquid_canary`

Truthy values accepted: `1`, `true`, `'true'`, `'enabled'`, `'on'`, `'canary'` (via `readBooleanDecision()` at line 125–142). Also recurses into object-typed candidates checking nested `enabled`, `liquid_enabled`, `liquidEnabled`, `canary`, `value` keys. This creates a broader effective surface than the eleven listed paths.

**Dev-only engine override (non-production only):**
`resolveDevEngineOverride(engine)` at `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:228–233`. `?engine=liquid` forces Liquid ON; `?engine=react` forces OFF. Blocked by `process.env.NODE_ENV === 'production'` check at line 229. Called only from `app/store/[subdomain]/page.tsx:49` (index route). Product/collection/blog/article pages do not accept this override.

**Gateway `FEATURE_LIQUID` — DORMANT:**
Declared in `services/api-gateway/src/middleware/featureFlags.ts:4` and `src/index.ts:227`. Set to `'false'` in production wrangler (`wrangler.toml:248`), `'true'` in staging/dev (lines 41, 132). However, `featureGate('FEATURE_LIQUID', ...)` is never called anywhere in the gateway routes — only `graphQLFeatureGate` and `extensionsFeatureGate` are instantiated. This flag has zero runtime effect on Liquid rendering. The actual canary gate is `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` + per-store `rendererEngine`.

### 1.3 Safety Net — Crash Recovery → React Fallback

Phase C closed the hard-500 risk. Current safety net (all CONNECTED):

1. **Per-section try/catch** in `renderLiquidTemplateSections()` (`theme-renderer.ts`, C1 at Phase C). A crashing section is skipped; `sectionErrors` counter incremented. If all main sections crash, `status: 'error'` is returned.
2. **Per-region try/catch** for header, body, footer in `LiquidRenderer.render()` (same file). Any region failure degrades to empty string.
3. **G4 version gate**: unknown `schema_version` throws `UnsupportedLiquidBundleSchemaVersionError` at `theme-bundle.ts:1361`, caught at `theme-renderer.ts:491` → `status: 'unsupported'` → composition-engine React fallback.
4. **Composition-engine outer catch** (`composition-engine.tsx:623–635`): any unexpected throw from `renderLiquidPlan` is caught, logs `lb:canary:render:fallback`, returns `null` → React renders.
5. **Chrome-fallback seam** (F5): when `plan.rendererEngine === 'liquid'` but `liquidHtml === null`, `StorefrontCompositionEngine` renders React body sections wrapped with React header/footer from `plan.sectionGroups` (composition-engine.tsx:706–735). Prevents a header-less/footer-less page on fallback.

The entire design degrades to a full React page on any Liquid failure. No failure mode produces a blank page or hard 500 (assuming the React sections are themselves renderable).

### 1.4 Rollback Levers (Fast Per-Store Revert to React)

To revert a specific store from Liquid to React without a code deploy:

1. **Remove or change `renderer_engine` in `theme_releases.release_manifest`** for the store's current release. Set `renderer_engine` to `'json-contract'` or `'react'` (any non-'liquid' string). Next request after ISR revalidation (60 seconds per `export const revalidate = 60` in `page.tsx`) reverts to React.

2. **Set any canary alias to a falsy value** in the store's `sites.template_config` or `theme_releases.release_manifest`: `liquidRenderingCanary: false`, or any of the eleven aliases to `'false'`, `'0'`, `'disabled'`, `'off'`. Verified via `readBooleanDecision()` at `theme-governance.ts:130`.

3. **Publish a new theme release without a `liquidBundle`**: `buildReleaseArtifacts()` sets `renderer_engine = 'json-contract'` when no liquidBundle is found. This is the standard merchant-facing path.

4. **Platform-level kill switch** (currently dormant): Wire `FEATURE_LIQUID` to `featureGate()` in the gateway. When `FEATURE_LIQUID = 'false'` in production wrangler.toml, all Liquid theme-publish routes would be blocked. This is an infrastructure change requiring a gateway deploy.

There is no single-env-var kill switch in storefront-runtime that bypasses the per-store `renderer_engine`. The global `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is a compile-time constant (not a runtime env var), so a flip requires a Next.js redeploy. The fastest emergency revert is a DB update to `theme_releases.release_manifest`.

---

## 2. Telemetry Points

### CONNECTED (emission point verified in committed source)

| Signal | Emission point | Fields | Notes |
|---|---|---|---|
| `lb:canary:render` | `composition-engine.tsx:663–677` | `event`, `engine` ('liquid'/'react'), `subdomain`, `template`, `route_type`, `latency_ms`, `editor_mode`, `fallback_reason` (null or 'renderer_returned_null'), `cache_hit: null` | Emitted for every storefront SSR render. `fallback_reason` is non-null only when plan intended Liquid but renderer returned null. `cache_hit` field is present but always null (NOT CONNECTED). |
| `lb:canary:render:fallback` | `composition-engine.tsx:629–633` (catch in `renderLiquidPlan`) | `event`, `reason` (error message, truncated to 200 chars), `subdomain`, `template` | Emitted only on unexpected throw; does NOT fire on normal `status:'error'`/`status:'unsupported'` returns from the renderer. |
| `lb:liquid:block-error` | `theme-renderer.ts:777` (Phase C C1 block-level catch) | `event`, `blockId`, `blockType`, `error` (truncated to 200 chars). No `sectionId` field; correlation to a specific store requires joining on timestamp with surrounding `lb:canary:render` events. | Per-block crash; emitted via `console.warn`. |
| `renderer_engine` in `release_manifest` | `theme-execution.adapter.ts:643` | Field in `theme_releases.release_manifest` JSON | Written at publish time; readable via `SELECT release_manifest->>'renderer_engine' FROM theme_releases WHERE store_id = ?`. CONNECTED at DB layer. |
| `liquid_ready` in `release_manifest` | `theme-execution.adapter.ts:644` | Boolean field in `theme_releases.release_manifest` | Written at publish time. |
| `X-Lb-Render-Engine` response header | `proxy.ts:175–176` in `rewriteToStore()` | `'liquid'` or `'react'` based on `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true'` | **WARNING**: reflects the global env var, NOT the per-store resolution. With global default OFF and per-store Liquid ON, this header reads `'react'` even for a Liquid-rendered page. It cannot be used to measure per-store Liquid adoption. Useful only to confirm global flip status. |
| `<!-- lb:section-error sectionId="..." type="..." -->` in HTML | `theme-renderer.ts` (Phase C C1 per-section catch) | HTML comment in rendered output | Marks a skipped section. Detectable via log scraping on rendered HTML if needed. |

### NOT-CONNECTED (live infrastructure required)

| Signal | What is needed | Exact source / env var |
|---|---|---|
| Live `lb:canary:render` ingestion and dashboards | Cloudflare Analytics Engine or Cloudflare Logpush to a log sink | `OTEL_EXPORTER_OTLP_ENDPOINT` (for OTel adapter) or `wrangler tail --format=json` for ad-hoc monitoring |
| Fallback rate (% of Liquid plans that fell back to React) | `lb:canary:render` with `fallback_reason != null`, divided by total with `engine='liquid'` plan requests | Cloudflare Analytics Engine query or log aggregation pipeline |
| Render latency by engine | `latency_ms` in `lb:canary:render` | Same as above |
| G4 version-gate rejection rate | `lb:canary:render` with `engine='react'` where plan intended Liquid | No dedicated signal for G4 rejections; inferrable from `fallback_reason='renderer_returned_null'` + no `lb:canary:render:fallback` (the renderer returns `status:'unsupported'` without throwing, so the outer catch does not fire) |
| Live store count with `renderer_engine='liquid'` | Supabase query: `SELECT COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` | Production Supabase service-role credentials |
| Production CPU time / memory per Liquid render | Cloudflare Workers Analytics | Cloudflare Workers deployment with Analytics Engine |
| DOMPurify JSDOM heap growth under load | Node.js heap profiling on storefront-runtime | Long-running load test + heap snapshot toolchain |

---

## 3. ARB-Gate Blocker Reconciliation

The seven original ARB-gate blockers are from `docs/storefront-liquid-discovery/11_GAP_ANALYSIS.md` / `certification/ARCHITECTURE_CERTIFICATION.md`. Current state is reconciled against Phases C–I commits on `stepup/main`.

### B-1: postMessage naming inconsistency (editor section-selection broken)

**Original:** `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION`; `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected`. Key mismatch breaks section-selection highlight in the theme editor.

**Current state: CLOSED.**
Evidence: `StorefrontPreviewBridge` at `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` (Phase C, commit 073bcbfe area). Imports `EDITOR_LEGACY_SELECTION_MESSAGE = 'LETBUYY_THEME_EDITOR_SELECTION'` from `packages/theme-engine/src/editor-bridge-protocol.ts:6`. Listens for the legacy message type (line 83), calls `selectSection()` (line 89), which re-posts as `letbuyy:theme-editor:section-selected`. `EditorPreviewSectionFrame` receives the namespaced event. C-04 is CLOSED. Protocol centralized in `editor-bridge-protocol.ts` (Phase C C5).

### B-2: `newsletter` / `newsletter-signup` type split (silent section miss)

**Original:** Liquid bundle indexes sections under `newsletter-signup`; React schema uses `newsletter`; render-time lookup silently fails.

**Current state: CLOSED (two defense-in-depth layers).**
Evidence:
- Layer 1 (compile time): `PORTABLE_TO_LIQUID_TYPE_OVERRIDES` in `packages/theme-engine/src/portable-to-liquid.ts:50` maps `newsletter` → `newsletter-signup` during bundle compilation.
- Layer 2 (render time): `LIQUID_SECTION_TYPE_ALIASES` in `packages/theme-engine/src/theme-renderer.ts:280–284` resolves `newsletter` → `newsletter-signup` before each bundle section lookup. Added in Phase C (C4).
- Residual (LOW, not a blocker): a bundle written directly to DB bypassing the compiler with `type:'newsletter'` would not be caught at Zod parse time. The render-time alias covers this. A Zod parse-time guard was noted as a hardening item; its absence does not break the happy path.

### B-3: Fonts not wired (Aura/Craft/Dawn/Sense experiences render system-font fallback)

**Original:** `buildGoogleFontsHref()` was dead code (exported, never called); four font families (`Cormorant Garamond`, `Libre Baskerville`, `Source Sans Pro`, `Lato`) missing from storefront `FONT_MAP`; `--font-playfair` aliased to Geist Sans (wrong typeface).

**Current state: CLOSED (Phase D D7).**
Evidence:
- `buildGoogleFontsHref()` wired at `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:138`.
- `FONT_MAP` extended with four missing families.
- `--font-playfair` corrected to `"Playfair Display", Georgia, "Times New Roman", serif` in `globals.css:28`.
- CSP updated for `fonts.googleapis.com` / `fonts.gstatic.com` in `next-security-headers.ts:66–67`.
- Test: `D7 font loading wires experience fonts for active theme settings`.
Source confirmed in `certification/RISK_CLOSURE_REPORT.md` R-09 entry.

### B-4: `linklists` / linklist Liquid object absent from scope

**Original:** `StoreModel.navigation` fetched server-side but never forwarded to `buildLiquidCommerceContext()` or `buildLiquidScope()`; `{{ linklists.main_menu }}` and `{{ shop.navigation }}` resolve to nil in every Liquid render.

**Current state: CLOSED (Phase D D1).**
Evidence:
- `navToLinklists()` at `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:335–355` converts `StoreModel.navigation` to Shopify-convention `linklists` object with underscore-keyed handles: `main_menu`, `footer_menu`, `policy_menu`.
- `active` is computed from `plan.route.path` for top-level links (honest SSR behavior).
- Linklists enter `buildLiquidScope()` (defined `packages/theme-engine/src/theme-renderer.ts:792`, called for the layout render at `theme-renderer.ts:568`) via `input.liquidContext.linklists`.
- Tests: `D1-A linklists key in LiquidCommerceDrops`; `D1-B navToLinklists runtime: underscore keys survive toLiquidDrop sanitizer`.
- Residual (LOW, not a blocker): `linklist` singular alias is not registered (only `linklists` plural). Themes using `{{ linklists.main_menu }}` work; themes using `{{ linklist.main_menu }}` do not, but the canonical Shopify convention is the plural form.

### B-5: Schema migration engine — no concrete migrations registered

**Original:** `ThemeSectionSchemaMigration` interface built; zero concrete migration objects; future backward-incompatible section schema changes cannot be auto-migrated.

**Current state: MITIGATED (infrastructure built; usage empty).**
Evidence:
- Section-schema migration registry + `migrateThemeTemplateSchemas()` function implemented in `packages/theme-engine/src/section-schema-migrations.ts` (Phase G G1).
- `CURRENT_SECTION_SCHEMA_VERSION` constant established.
- `migrateThemeTemplateSchemas()` exported and integrated.
- Tests: Phase G G1 suite (see `lb-g-schema-governance.test.mjs`).
- Zero concrete `ThemeSectionSchemaMigration` objects are registered. The infrastructure is proven and available, but no migration has been authored because no breaking schema change has shipped.

This is an operational readiness gap, not a technical blocker. The ARB should note that if any section schema breaking change is shipped without a corresponding registered migration, stored `template_snapshot` data in `theme_releases` will not be automatically upgraded. The fix (registering a migration) is a one-function call; it does not require any architectural work.

Additionally, canonical settings-schema canonicalization (`packages/theme-engine/src/settings-schema-canonical.ts`, Phase G G3) is implemented but **G3-consume is explicitly DEFERRED** — wiring at publish time would change what the editor reads for settings forms without an editor-side migration. The render path tolerates both shapes already.

### B-6: `letbuyy-core` DB row missing

**Original:** `LETBUYY_CORE_THEME_SLUG = 'letbuyy-core'` defined in `packages/theme-engine/src/theme-bundle-core.ts`; `public.themes` had no row with `slug = 'letbuyy-core'`; any DB query by canonical slug returned 0 rows.

**Current state: CLOSED (Phase G G5).**
Evidence:
- Migration file `database/supabase/migrations/188_letbuyy_core_theme_row.sql` exists on `stepup/main`.
- Clones the `urban-kicks` row with `id = gen_random_uuid()`, `name = 'LetBuyy Core'`, `slug = 'letbuyy-core'` using `ON CONFLICT (slug) DO NOTHING` (idempotent).
- Inherits `default_template`, `settings_schema`, `is_active`, etc. from `urban-kicks`.
- If `urban-kicks` row does not exist (fresh DB before seed), the SELECT returns 0 rows and no error is thrown; the migration re-runs cleanly after the seed.
- Caveat: the migration file ships on `stepup/main` but applies only after it is run against the production database via the deploy pipeline. The ARB package assumes the migration has been applied or will be applied as part of the rollout.

### B-7: Settings divergence (DB flat `appearance` group vs TS 5-group `THEME_SETTINGS_SCHEMA`)

**Original:** `migrations/180–181` create a single flat `appearance` group in the DB; `packages/theme-engine/src/theme-registry.ts:436–489` defines a 5-group `THEME_SETTINGS_SCHEMA`; the two shapes are incompatible and code expecting one fails on the other.

**Current state: MITIGATED (render-tolerant; structural canonicalization available but not wired to publish/editor).**
Evidence:
- `packages/theme-engine/src/settings-schema-canonical.ts` (Phase G G3) provides lossless `group(flat) → 5-group` and `flatten(5-group) → flat` round-trip functions, proven correct by tests.
- The Liquid render path already tolerates both shapes via Phase D D2 (drop-level coercion).
- **G3-consume is explicitly DEFERRED**: wiring canonicalization at publish time would rewrite the stored `settings_schema` into 5-group shape, changing what the editor reads for settings form rendering. This requires a coordinated editor-side migration to avoid breaking the merchant editor UI. Per the no-breaking-changes law, this cannot be done without visual-parity proof.

This is an acknowledged dual-shape state: new stores get the flat appearance schema; TypeScript canonical schema has 5 groups. The render path works correctly with either shape. The ARB should note that the editor and the Liquid render path may show different settings organization until G3-consume is landed.

---

## 4. Known Open Items Carried into Phase J

Items from Phase I that are NOT resolved and require Phase J or ARB attention:

| ID | Severity | File | Description |
|---|---|---|---|
| I-F1 | ~~HIGH~~ **CLOSED** | `theme-bundle.ts:2433` (register template) | DOMPurify 3.x clobbering bug — **FIXED** in commit 4eaf3e84. Field renamed from `name="name"` to `name="fullName"`. Register route reads `form.get('fullName') ?? form.get('name')`. A11Y-5 asserts `name="fullName"` survives DOMPurify and `name="name"` is absent (221/221 PASS). |
| H-F2 | **CLOSED** | `packages/theme-engine/src/theme-artifact-exporter.ts` | `assertSafeArtifactPath()` (lines 58–68) called at all path composition points (75, 82, 90, 116, 124). Throws `UnsafeThemeArtifactPathError` on absolute paths or `..` segments. Previously OPEN MEDIUM; code confirms closure. |
| H-F3 | LOW | `theme-artifact-exporter.ts:101–110` | `settings_data` exported as-is. Code comment (lines 101–107) documents this as intentional: settings_data holds design tokens; BLOCKED_DROP_KEYS is a render-time defence. Risk remains if untrusted merchant data reaches the export pipeline. Acknowledge or formally risk-accept. |
| H-F1 | **CLOSED** | `theme-linter.ts:64,101` | `for (const attr of forbidAttrs)` at line 101 iterates FORBID_ATTR from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`. Rule is named `forbidden-attr`. Previously OPEN MEDIUM with wrong claim of hardcoded regex; code confirms single source of truth. |
| UC-19 | LOW | `api-gateway/src/middleware/featureFlags.ts` | `FEATURE_LIQUID` gateway flag is dormant; no route is gated by it. An ARB decision is needed: either wire it as a kill switch or document it as intentionally dormant. |
| — | KNOWN NON-BLOCKER | `scripts/validate-governance.mjs` | Tenant-table registry out of sync with generated schema (pre-existing, pre-Phase B). Run `scripts/generators/generate-tenant-table-registry.mjs` to close. Human-owned. |
| — | KNOWN NON-BLOCKER | `scripts/validators/sequential-migration-validator.mjs` | Migrations 186/187 on disk but uncommitted WIP (pre-Phase B). Human-owned. |

---

## 5. QA Posture Summary (from Phase I QA_CERTIFICATION.md)

| Category | Status | Gate numbers |
|---|---|---|
| Unit | CONNECTED | 221/221 theme-engine, 78/78 storefront-runtime, 15/15 merchant |
| Integration (contract) | PARTIAL | Contract tests CONNECTED (78/78 includes 8 contract test files); live gateway integration NOT-CONNECTED |
| Accessibility | PARTIAL | 8 A11Y assertions CONNECTED; axe-core browser scan NOT-CONNECTED; I-F1 (name clobbering) CLOSED — A11Y-5 asserts `name="fullName"` survives DOMPurify (commit 4eaf3e84) |
| Performance | PARTIAL | F9 benchmark CONNECTED (cold=24ms, steady=11ms, total=288ms, all PASS vs budget); production profiling NOT-CONNECTED |
| SEO | NOT-CONNECTED | 0 SEO tests exist; live Lighthouse CI requires deployed storefront URL |
| Hydration | CONNECTED | 40+13=53 island assertions in 78/78 |
| SSR | CONNECTED | SSR contract tests included in 78/78 |
| E2E Browser | NOT-CONNECTED | No Playwright live-browser tests exist; infrastructure: Playwright + staging URL |
| Load / Stress | NOT-CONNECTED | No load test harness; needs k6 or Playwright against deployed Worker |
| Security (structural) | CONNECTED | 13 security assertions in 221/221 (DOMPurify, SSTI, drop limits, key blocks) |
| Security (DAST/CSP) | NOT-CONNECTED | Live browser CSP enforcement test requires deployed URL |
| Fault injection | NOT-CONNECTED | No chaos test harness |

---

## 6. ARB GO/NO-GO Evidence Summary

The ARB would evaluate the following before authorizing the platform-wide flip:

**Structural evidence (CONNECTED, ready):**
- All 7 original ARB-gate blockers reconciled: 5 CLOSED (B-1, B-2, B-3, B-4, B-6), 2 MITIGATED (B-5, B-7), 0 still OPEN as blockers.
- Crash recovery proven: per-section, per-region, layout-level, and composition-engine-level try/catch form a defense-in-depth chain.
- G4 version gate: unknown schema_version degrades to React, never crashes.
- Security: 13 assertions on DOMPurify, SSTI, drop key limits all PASS in 221/221.
- Per-store activation and rollback mechanisms verified in code.
- Test gate: 221/221 + 78/78 + 15/15 PASS.

**Live evidence gaps (ARB must acknowledge as NOT-CONNECTED):**
- Zero production Liquid-renders have been observed; `lb:canary:render` telemetry is structurally wired but no Cloudflare Analytics Engine sink exists.
- Fallback rate, render latency under production traffic, and memory behavior under real concurrency are unknown.
- No live SEO, E2E, or DAST certification exists.
- The number of stores currently on the Liquid path in production is unknown (requires a live Supabase query).

**Open product bugs (status as of 2026-07-10):**
- I-F1 (DOMPurify clobbering on customer-register form) — **CLOSED** in commit 4eaf3e84. Field renamed to `name="fullName"` in `theme-bundle.ts:2433`. Register route reads `form.get('fullName') ?? form.get('name')`. A11Y-5 asserts the fix (221/221 PASS). This item is not a GO gate.

**ARB-exclusive decisions:**
- Whether to wire `FEATURE_LIQUID` as a gateway kill switch before flipping.
- Whether to require live telemetry signal before authorizing the platform flip.
- Whether to flip to a % of stores first (gradual rollout infrastructure does not yet exist — no automated % gate is implemented; per-store activation is the only available gradual path).
