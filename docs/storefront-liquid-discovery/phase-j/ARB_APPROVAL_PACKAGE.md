# ARB Approval Package — Platform-Wide Liquid Flip
## Storefront Liquid Rendering: GO/NO-GO Decision Package

**Document ID:** ARB-PKG-2026-07-10  
**Phase:** J — ARB Approval Package  
**Date:** 2026-07-10  
**Branch:** stepup/main  
**Authored by:** Subagent — Phase J ARB package author role  
**Inputs:** Phases B–I committed evidence; `docs/storefront-liquid-discovery/phase-j/ROLLOUT_READINESS_PACKAGE.md`; `docs/storefront-liquid-discovery/phase-i/QA_CERTIFICATION.md`; `docs/storefront-liquid-discovery/certification/RISK_CLOSURE_REPORT.md`

---

## AUTHORITY STATEMENT — CRITICAL

**This document does not flip any flag. It does not activate Liquid rendering for any store, environment, or traffic segment. It is read-only planning documentation.**

The platform-wide Liquid flip is ARB-AUTHORITY. The decision object at `packages/theme-engine/src/theme-governance.ts:16–21` encodes this:

```typescript
export const THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = {
  status: 'deferred',
  authority: 'ARB',
  reason: 'Liquid remains per-theme canary only until render-parity, security, SSTI/XSS, and performance evidence is green.',
  defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED,
} as const;
```

`THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false` (line 14, same file). `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` remains `'deferred'`. No human or automated process may change these values without a recorded ARB decision. This document is the evidence the ARB would consume to make that decision.

---

## 1. Executive Summary

Seven programs (Phases B–I) on branch `stepup/main` have transformed the storefront Liquid platform from a prototype to a production-grade, React-fallback-safe rendering engine. The core safety architecture is complete: per-section crash isolation, composition-engine outer catch, G4 version gate, and F5 chrome-fallback seam together ensure that any Liquid failure degrades gracefully to a full React page with no blank-page or HTTP 500 outcome.

Five of the seven original ARB-gate blockers are **CLOSED** with code evidence. Two are **MITIGATED** (infrastructure built; no concrete usage yet required). Three items were found during Phase H/I security and QA work. One (I-F1, DOMPurify clobbering bug on the customer-register form) is **CLOSED** — the form field was renamed to `name="fullName"` in `packages/theme-engine/src/theme-bundle.ts:2433` in commit 4eaf3e84; the register route reads `form.get('fullName') ?? form.get('name')`; A11Y-5 asserts `name="fullName"` survives DOMPurify and `name="name"` is absent (221/221 PASS). Two (H-F2, H-F3) are MEDIUM/LOW: H-F2 is CLOSED (path-traversal guard in place), H-F3 is open LOW and does not block a cautious per-store rollout.

**Current verdict on the platform flip (ARB to adjudicate):**

| Dimension | State |
|---|---|
| Safety net (crash recovery + React fallback) | READY |
| Core render-parity (20 section types + experience fonts + linklists + search) | READY |
| Security — SSTI/XSS/prototype-pollution automated coverage | READY (unit scope) |
| Security — DOMPurify clobbering bug (I-F1, no-JS customer-register name field) | **CLOSED** — renamed to `name="fullName"` in `theme-bundle.ts:2433` (commit 4eaf3e84); A11Y-5 asserts fix |
| Performance — in-process budget (cold ≤ 150 ms, steady ≤ 50 ms) | READY (local benchmark) |
| Performance — production profiling | NOT-CONNECTED (requires live Worker + Analytics Engine) |
| Observability — structured telemetry emission points | CONNECTED (log emission exists) |
| Observability — live dashboards / alert wiring | NOT-CONNECTED (requires Logpush / Analytics Engine) |
| Per-store canary soak | NOT-CONNECTED (no production stores confirmed on Liquid yet) |
| Governance — theme-governance-validator, migration-safety-validator | PASS |
| Governance — validate-governance (tenant registry) | FAIL (pre-existing, non-blocker, human-owned) |

The ARB may grant a conditional GO scoped to a supervised per-store canary ramp. I-F1 is now CLOSED (pre-condition satisfied). The remaining honest gates are: live observability is NOT-CONNECTED (Cloudflare Logpush/Analytics Engine not wired), and no percentage-of-stores gradual rollout mechanism exists (per-store activation is the only staged path). A full platform flip (global default ON) warrants waiting for production profiling and a canary soak period with fallback-rate telemetry.

---

## 2. Scope — What Liquid-First Covers

### 2.1 Rendering engine scope

The Liquid renderer (`packages/theme-engine/src/theme-renderer.ts`, `LiquidRenderer`) covers:

- **20 section types** declared in `THEME_LIQUID_PORTABLE_SECTION_PARITY` (`theme-governance.ts:23–44`): `about-section`, `app-block-slot`, `banner-carousel`, `brand-marquee`, `category-grid`, `contact-form`, `cta-section`, `experience-timeline`, `featured-products`, `hero-banner`, `marquee`, `newsletter-signup`, `portfolio-grid`, `product-detail`, `product-grid`, `rich-content`, `services-grid`, `skills-section`, `testimonials`, `trust-badges`.
- **Full page layout** (header, content-for-layout, footer) assembled via `LiquidThemePackageBundle` (`theme-bundle.ts`).
- **10 Liquid island custom elements** (`lb-add-to-cart`, `lb-cart-drawer`, `lb-search`, `lb-variant-picker`, `lb-review-form`, `lb-wishlist-toggle`, `lb-cart`, `lb-customer-settings`, `lb-address-manager`, `lb-logout`) hydrated client-side from SSR-rendered `data-*` attributes.
- **6 experience presets** (Urban Kicks, Aura, Craft, Dawn, Sense, Refresh) with correct Google Font loading (`layout.tsx:138`).
- **7 storefront templates**: home, product, collection, search, cart, blog, article/content page. 404, password, customer-login, and customer-register as additional Liquid-rendered pages.
- **Shopify-convention Liquid scope** (`linklists`, `shop`, `product`, `collection`, `cart`, `customer`, `search`, `page`, `blog`, `article`) wired in `buildLiquidScope()` (defined `theme-renderer.ts:792`; called for the main layout render at `theme-renderer.ts:568`).
- **No-JS form paths** for customer login (`POST /storefront/:subdomain/customer/login`) and registration (`POST /storefront/:subdomain/customer/register`), gated by dual content-type dispatch in the gateway.

### 2.2 Out of scope (reserved, not activated by the flip)

- **Subscription flows**: no subscriptions domain exists; `linklists` for a subscription menu is not wired.
- **App extensions/blocks** (`app-block-slot` section type renders a placeholder; no app-bridge integration is built into Liquid templates).
- **Real-time inventory webhooks** inside Liquid templates: product data is fetched at SSR time from the gateway; no push-based update path exists.
- **Theme editor settings live preview**: the editor renders its own React preview path; Liquid rendering in the editor is wired via the `?engine=liquid` dev override (`template-resolver.ts:228–233`), blocked in production.
- **Multi-storefront / custom domain** edge routing: `proxy.ts` host routing is a React-era concern unaffected by the Liquid flip. The `X-Lb-Render-Engine` header reflects the global env var only (see §4).

### 2.3 What the flip changes — the exact one-line change

The platform-wide Liquid flip is a **single constant change and a storefront-runtime redeploy**:

```typescript
// packages/theme-engine/src/theme-governance.ts:14
// BEFORE (current committed state):
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;

// AFTER (ARB-authorized flip — NOT done here):
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true;
```

After this change is committed and `storefront-runtime` is redeployed to Vercel/Cloudflare, `resolveThemeLiquidRenderingEnabled()` falls through to `true` when no per-entity explicit engine is set. All stores without an explicit `renderer_engine` in their `theme_releases.release_manifest` would attempt Liquid rendering (falling back to React per the safety net if the bundle is absent or invalid).

**This change is NOT made here.** It requires an ARB-recorded decision followed by a human-authored commit and a supervised deployment.

---

## 3. ARB-Gate Blocker Reconciliation

The seven original blockers are from `docs/storefront-liquid-discovery/11_GAP_ANALYSIS.md` and `certification/ARCHITECTURE_CERTIFICATION.md`. Each is reconciled against committed evidence on `stepup/main` as of 2026-07-10.

| # | Blocker | Phase Closed | Current State | Evidence |
|---|---|---|---|---|
| B-1 | postMessage key mismatch: `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION`; `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected`. Editor section-selection broken. | Phase C (C-04, C5) | **CLOSED** | `StorefrontPreviewBridge` at `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`. Imports `EDITOR_LEGACY_SELECTION_MESSAGE = 'LETBUYY_THEME_EDITOR_SELECTION'` from `packages/theme-engine/src/editor-bridge-protocol.ts:6`. Line 83: listens for legacy message; line 89: calls `selectSection()` which re-posts as `letbuyy:theme-editor:section-selected`; `EditorPreviewSectionFrame` receives namespaced event. Protocol centralized in `editor-bridge-protocol.ts` (Phase C C5). |
| B-2 | `newsletter` / `newsletter-signup` type split: Liquid bundle indexes under `newsletter-signup`; React schema uses `newsletter`; render-time lookup silently fails. | Phase C (C4) + Phase D (D compile-time) | **CLOSED** (two defense layers) | Layer 1 (compile time): `PORTABLE_TO_LIQUID_TYPE_OVERRIDES` in `packages/theme-engine/src/portable-to-liquid.ts:50` maps `newsletter → newsletter-signup`. Layer 2 (render time): `LIQUID_SECTION_TYPE_ALIASES` at `theme-renderer.ts:280–284` resolves `newsletter → newsletter-signup` before each bundle lookup. Residual LOW: a bundle written directly to DB bypassing the compiler with `type:'newsletter'` is not caught at Zod parse time; the render-time alias covers this path. Not a GO gate. |
| B-3 | Fonts not wired: `buildGoogleFontsHref()` dead code; `FONT_MAP` missing four families; `--font-playfair` aliased to Geist Sans (wrong typeface). Aura/Craft/Dawn/Sense experiences render system-font fallback. | Phase D (D7) | **CLOSED** | `buildGoogleFontsHref()` wired at `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:138`. `FONT_MAP` extended with `Cormorant Garamond`, `Libre Baskerville`, `Source Sans Pro`, `Lato`. `--font-playfair` corrected to `"Playfair Display", Georgia, "Times New Roman", serif` in `globals.css:28`. CSP extended for `fonts.googleapis.com` / `fonts.gstatic.com` in `next-security-headers.ts:66–67`. Test: `D7 font loading wires experience fonts for active theme settings` (in 221/221 PASS). Confirmed in `certification/RISK_CLOSURE_REPORT.md` R-09 entry. |
| B-4 | `linklists` absent from Liquid scope: `StoreModel.navigation` fetched but never forwarded to `buildLiquidCommerceContext()` or `buildLiquidScope()`; `{{ linklists.main_menu }}` resolves to nil. | Phase D (D1) | **CLOSED** | `navToLinklists()` at `composition-engine.tsx:335–355` converts `StoreModel.navigation` to Shopify-convention `linklists` with underscore-keyed handles (`main_menu`, `footer_menu`, `policy_menu`). Linklists enter `buildLiquidScope()` (defined `theme-renderer.ts:792`) via `input.liquidContext.linklists`, assembled at the layout render call at `theme-renderer.ts:568`. Tests: `D1-A linklists key in LiquidCommerceDrops`; `D1-B underscore keys survive toLiquidDrop sanitizer`. Residual LOW: `linklist` singular alias not registered; canonical Shopify convention is the plural form. Not a GO gate. |
| B-5 | Schema migration engine: `ThemeSectionSchemaMigration` interface built; zero concrete migration objects registered; backward-incompatible schema changes cannot be auto-migrated. | Phase G (G1) | **MITIGATED** (infrastructure built; zero usage required yet) | `migrateThemeTemplateSchemas()` and the migration registry implemented in `packages/theme-engine/src/section-schema-migrations.ts` (Phase G G1). `CURRENT_SECTION_SCHEMA_VERSION` established. Zero concrete `ThemeSectionSchemaMigration` objects are registered — correct, because no breaking schema change has shipped. Infrastructure is proven and tested. `G3-consume` (wiring canonicalization at publish time) explicitly deferred pending a coordinated editor-side migration. The ARB should note that any future breaking schema change must be accompanied by a registered migration before deployment. |
| B-6 | `letbuyy-core` DB row missing: `LETBUYY_CORE_THEME_SLUG = 'letbuyy-core'` referenced in code; `public.themes` had no matching row; slug-based queries returned 0 rows. | Phase G (G5) | **CLOSED** (conditional on migration run) | `database/supabase/migrations/188_letbuyy_core_theme_row.sql` committed on `stepup/main`. Clones `urban-kicks` row with `slug = 'letbuyy-core'` using `ON CONFLICT (slug) DO NOTHING` (idempotent). Inherits `default_template` (which includes `rendererEngine: 'liquid'` from migration 180), `settings_schema`, `is_active`. **Caveat:** the migration must be run against the target database before this blocker is fully resolved in production. |
| B-7 | Settings divergence: DB stores flat `appearance` group (migrations 180–181); TypeScript `THEME_SETTINGS_SCHEMA` defines 5 groups (`theme-registry.ts:436–489`); dual shapes are incompatible. | Phase G (G3) | **MITIGATED** (render-tolerant; structural canonicalization available but not wired to publish/editor) | `packages/theme-engine/src/settings-schema-canonical.ts` (Phase G G3) provides lossless `group(flat) → 5-group` and `flatten(5-group) → flat` round-trip functions, proven correct by tests. Liquid render path tolerates both shapes (Phase D D2 drop-level coercion). `G3-consume` (wiring at publish time) explicitly deferred — would rewrite stored `settings_schema` into 5-group and break editor settings-form rendering without a coordinated editor-side migration. **Acknowledged dual-shape state**: editor and Liquid render may show different settings organization until G3-consume lands. Non-blocking for the render path. |

**Summary:** 5 of 7 CLOSED, 2 MITIGATED. No original ARB blocker remains in an OPEN state that would prevent a cautious per-store rollout. The MITIGATED items (B-5, B-7) are operational notes for the ARB, not GO-gates, because they do not affect live rendering correctness.

---

## 4. Readiness Scorecard

### 4.1 Phase I QA Matrix (summarized — full matrix in `docs/storefront-liquid-discovery/phase-i/QA_CERTIFICATION.md`)

| Category | Status | Gate Numbers | Notes |
|---|---|---|---|
| Unit | CONNECTED | theme-engine 221/221 PASS; storefront-runtime 78/78 PASS; merchant-control-plane 15/15 PASS | Core schema, renderer, DOMPurify, crash recovery, SDK, experience fonts, blog/article/page/404/password/routes, auth, A11Y, security |
| Integration | PARTIAL | CONNECTED: 78/78 contract tests; NOT-CONNECTED: live gateway + Supabase integration | Live integration harness not authored; no `pnpm test:integration` script exists |
| Accessibility | PARTIAL | CONNECTED: 8 A11Y tests in 221/221; NOT-CONNECTED: axe-core in live browser | A11Y-5 asserts `name="fullName"` survives DOMPurify and `name="name"` is absent (I-F1 CLOSED, commit 4eaf3e84) |
| Performance | PARTIAL | CONNECTED: F9 benchmark (cold=24 ms, steady=11 ms, p95=17 ms, total=288 ms, N=25, all under PROPOSED budget cold ≤ 150 ms / steady ≤ 50 ms); NOT-CONNECTED: production CPU/memory profiling | Local benchmark only; production Cloudflare Worker profiling requires `OTEL_EXPORTER_OTLP_ENDPOINT` |
| SEO | NOT-CONNECTED | 0 tests | No Lighthouse CI or live URL; `<title>` emits `{{ shop.name }}` (correct); no `<meta name="description">` in current Liquid layout template |
| Hydration | CONNECTED | 13 new + 40 existing in 78/78 PASS | All 10 lb-* islands; SSR data-attribute parity; `customElements` server-safe guard |
| SSR | CONNECTED | 13 new + 140 existing in 78/78 PASS | E8 no-JS login contract; F5 fallback_reason ternary pin; SSR attribute shape per island |
| Load | NOT-CONNECTED | 0 tests | k6 + staging stack required; PROPOSED SLO: p95 TTFB ≤ 500 ms at 50 VUs |
| Stress | NOT-CONNECTED | 0 tests | Cross-request LRU (engine pooling) not implemented |
| Memory | NOT-CONNECTED | 0 tests | `domPurifyPromise` singleton has no `.catch()` rejection handler (OPEN) |
| Browser | NOT-CONNECTED | 0 tests | Playwright not installed in storefront-runtime |
| Mobile | NOT-CONNECTED | 0 tests | Playwright mobile viewport preset not installed |
| Regression | CONNECTED | 221/221 + 78/78 + 15/15; gate history: B(blocked) → C(89+19) → D(101+31) → E(109+52) → F(157+52) → G(157+52) → H(198+52) → I(221+78) | No regression introduced by any Phase B–I commit |
| Visual-Diff | NOT-CONNECTED | 0 tests | No screenshot baseline or diffing tool |
| Security | PARTIAL | CONNECTED: 13 security tests in 221/221; NOT-CONNECTED: DAST | SEC-1–10 cover FORBID_TAGS, FORBID_ATTR, SSTI, prototype-pollution (including JSON.parse `__proto__` path, SEC-6b), BLOCKED_DROP_KEYS, CSS injection, data-* XSS hook, protocol-based XSS |
| Chaos | NOT-CONNECTED | 0 tests | Phase C crash isolation unit-tested; no live fault-injection harness |

**CONNECTED / PARTIAL:** 8 of 16 categories.  
**NOT-CONNECTED:** 8 categories require live infrastructure.  

### 4.2 Validator Gate

| Validator | Result | Classification |
|---|---|---|
| `node scripts/validators/theme-governance-validator.mjs` | **PASS** | 25 section schemas; WARN mode; Liquid default OFF; schema migration runner wired |
| `node scripts/validators/migration-safety-validator.mjs` | **PASS** | No destructive ALTER/DROP patterns in migration history |
| `node scripts/validate-governance.mjs` | **FAIL (pre-existing non-blocker)** | Tenant-table registry (`tenant-tables.registry.ts`) out of sync with schema-derived registry. This failure pre-dates Phase B and is unrelated to Liquid rendering. Fix: run `scripts/generators/generate-tenant-table-registry.mjs`. **Owner: human engineering team (not Phase J scope).** |
| `node scripts/validators/sequential-migration-validator.mjs` | **FAIL (pre-existing non-blocker)** | Migrations 186/187 on disk but uncommitted WIP pre-dating Phase B. **Owner: human engineering team (not Phase J scope).** |

The two FAIL validators are **named non-blockers** with human owners. Neither affects Liquid rendering, the safety net, or any payment/auth/RLS code path. The ARB should acknowledge them as pre-existing operational debt unrelated to this decision.

### 4.3 Observability Posture

| Signal | Status | Emission Point |
|---|---|---|
| `lb:canary:render` structured log (per SSR render) | CONNECTED | `composition-engine.tsx:663–677` — fields: `event`, `engine`, `subdomain`, `template`, `route_type`, `latency_ms`, `editor_mode`, `fallback_reason`, `cache_hit: null` |
| `lb:canary:render:fallback` structured warn (unexpected throw) | CONNECTED | `composition-engine.tsx:629–633` — fields: `event`, `reason` (truncated 200 chars), `subdomain`, `template` |
| `lb:liquid:block-error` structured warn (per-block crash) | CONNECTED | `packages/theme-engine/src/theme-renderer.ts:777` (Phase C C1 block-level catch) — fields: `event`, `blockId`, `blockType`, `error` (truncated to 200 chars). No `sectionId` field; correlation to a specific store requires joining on timestamp with surrounding `lb:canary:render` events. |
| `renderer_engine` in `theme_releases.release_manifest` | CONNECTED (DB) | `theme-execution.adapter.ts:643` — written at publish time; queryable via SQL |
| `liquid_ready` in `theme_releases.release_manifest` | CONNECTED (DB) | `theme-execution.adapter.ts:644` — boolean; written at publish time |
| `X-Lb-Render-Engine` HTTP response header | CONNECTED (global env only) | `proxy.ts:175–176` — reflects `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true'`, NOT per-store resolution. With global OFF and per-store Liquid ON, header reads `'react'`. **Cannot be used to measure per-store Liquid adoption.** |
| Live `lb:canary:render` ingestion, fallback rate, p95 latency dashboards | NOT-CONNECTED | Requires Cloudflare Analytics Engine with `OTEL_EXPORTER_OTLP_ENDPOINT` or Cloudflare Logpush. No adapter wired in repo. |
| Live count of stores with `renderer_engine='liquid'` in production | NOT-CONNECTED | Requires production Supabase service-role credentials. Query: `SELECT COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` |
| Production CPU time / memory per Liquid render | NOT-CONNECTED | Cloudflare Workers Analytics Engine. `scripts/` has no profiling script; F9 benchmark gives local numbers only. |

---

## 5. GO/NO-GO Criteria

The following criteria must be evaluated by the ARB before authorizing the platform flip. Each criterion is labeled with its current status.

### 5.1 Render Parity Evidence

| Criterion | Required evidence | Current status |
|---|---|---|
| All 20 section types in `THEME_LIQUID_PORTABLE_SECTION_PARITY` render correctly | CONNECTED: unit tests for each section type in 221/221 PASS | READY |
| Experience fonts load for all 6 presets (Aura/Craft/Dawn/Sense/Urban Kicks/Refresh) | CONNECTED: `D7 font loading wires experience fonts` test in 221/221 PASS | READY |
| Navigation (`linklists`) renders in header/footer | CONNECTED: D1-A/D1-B tests in 78/78 PASS | READY |
| No-JS customer login POST works | CONNECTED: E8 contract tests in 78/78 PASS | READY |
| Customer register no-JS POST works with correct name field | CONNECTED: **I-F1 CLOSED** — field renamed to `name="fullName"` in `theme-bundle.ts:2433` (commit 4eaf3e84). Register route reads `form.get('fullName') ?? form.get('name')`. A11Y-5 asserts `name="fullName"` present and `name="name"` absent after DOMPurify (221/221 PASS). | **CLOSED** |
| Blog and article pages render | CONNECTED: template keys implemented in Phase E; tests in 221/221 PASS | READY |
| 404, password, CMS page render | CONNECTED: Phase E templates; tests in 221/221 PASS | READY |

### 5.2 Security / SSTI / XSS

| Criterion | Required evidence | Current status |
|---|---|---|
| Liquid in section settings is not re-evaluated (SSTI) | CONNECTED: SEC-3a (`{{ 7 \| times: 7 }}` → does not appear as `49` in output) + SEC-3b (`{%` raw tag literals in output) in 221/221 PASS | READY |
| Prototype-pollution keys blocked in drops | CONNECTED: SEC-6 (JS literal path) + SEC-6b (JSON.parse own-enumerable `__proto__` path) in 221/221 PASS | READY |
| DOMPurify FORBID_TAGS blocks `<base>`, `<embed>`, `<object>` | CONNECTED: SEC-1a/b/c in 221/221 PASS | READY |
| DOMPurify FORBID_ATTR blocks inline `style=` | CONNECTED: SEC-2 in 221/221 PASS | READY |
| `data-*` attribute XSS hook (values containing `<` or `>`) | CONNECTED: SEC-9 in 221/221 PASS | READY |
| `javascript:` href and `data:text/html` src blocked | CONNECTED: SEC-10 in 221/221 PASS | READY |
| `BLOCKED_DROP_KEYS` 13-key completeness (credential-adjacent keys) | CONNECTED: SEC-7 in 221/221 PASS | READY |
| `toLiquidDrop` depth-4 and 80-key-slice limits | CONNECTED: SEC-4, SEC-5 in 221/221 PASS | READY |
| CSS injection in `settings_data` head assets neutralized | CONNECTED: SEC-8 in 221/221 PASS | READY |
| Path traversal in `theme-artifact-exporter.ts` (H-F2) | **CLOSED** — `assertSafeArtifactPath()` (`packages/theme-engine/src/theme-artifact-exporter.ts:58–68`) is applied at all path composition points (lines 75, 82, 90, 116, 124). Throws `UnsafeThemeArtifactPathError` on absolute paths or `..` segments. | **CLOSED** |
| `settings_data` exported without `BLOCKED_DROP_KEYS` filter (H-F3) | Code comment at `theme-artifact-exporter.ts:101–107` documents this as intentional: settings_data holds design tokens, not credentials; render-time BLOCKED_DROP_KEYS filtering is a separate defence. Risk remains if untrusted merchant data reaches the export pipeline. | **OPEN LOW (acknowledged design choice)** |
| Linter `forbidAttrs` (H-F1) | **CLOSED** — `for (const attr of forbidAttrs)` at `theme-linter.ts:101` iterates FORBID_ATTR dynamically from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`. Rule is named `forbidden-attr` (not `forbidden-style-attr`). Single source of truth. | **CLOSED** |
| DAST scan against live storefront | NOT-CONNECTED: requires OWASP ZAP / Burp Suite + live staging URL | **NOT-CONNECTED** |

### 5.3 Performance Budget

All thresholds below are **PROPOSED** and have not been validated in production.

| Metric | PROPOSED threshold | Current evidence | Status |
|---|---|---|---|
| Cold render time (first parse per template) | ≤ 150 ms | F9 benchmark: 24 ms (N=25, Urban Kicks, 25 sections, local) | CONNECTED (local only) |
| Steady-state render time (LRU-warm) | ≤ 50 ms | F9 benchmark: 11 ms (p95=17 ms) | CONNECTED (local only) |
| Total for 25 renders | ≤ 1,250 ms | F9 benchmark: 288 ms | CONNECTED (local only) |
| Production p95 TTFB at 50 VUs | ≤ 500 ms | NOT-CONNECTED | NOT-CONNECTED |
| Production error rate at 50 VUs | < 0.1% | NOT-CONNECTED | NOT-CONNECTED |
| Cloudflare Worker CPU time per request | Under Worker CPU limit | NOT-CONNECTED | NOT-CONNECTED |

Note: the F9 benchmark (`packages/theme-engine/test/liquid-render-benchmark.test.ts`) measures pure LiquidJS render cost only. Production p95 TTFB includes gateway fetch + Supabase query + ISR revalidation cost and is expected to be materially higher. The local numbers provide confidence that the Liquid render itself is not the bottleneck, but production profiling is required before committing to public SLOs.

### 5.4 Per-Entity Canary Soak

Before a global platform flip, the ARB should require a supervised per-store canary soak period using the existing per-store activation mechanism (publishing a Liquid release to a named store). The following criteria apply to the soak period:

| Criterion | PROPOSED threshold | Measurement source |
|---|---|---|
| Fallback rate (% of Liquid-plan requests that fell back to React) | < 0.5% over 7 days | `lb:canary:render` with `fallback_reason = 'renderer_returned_null'` ÷ total with `engine plan = 'liquid'` — requires Cloudflare Analytics Engine (NOT-CONNECTED today) |
| `lb:canary:render:fallback` event rate (unexpected throws) | < 0.1% | `lb:canary:render:fallback` event count from `composition-engine.tsx:629–633` via Logpush |
| HTTP 500 rate for Liquid stores | No increase vs React baseline | Cloudflare error rate or Vercel function error dashboard |
| Median render latency for Liquid renders | ≤ 2× React baseline | `latency_ms` from `lb:canary:render` aggregated by `engine` |

**The canary soak infrastructure (Logpush / Analytics Engine) is NOT-CONNECTED today.** Before activating any stores on Liquid for a formal soak, the ARB should require that these metrics be wired and observable. Ad-hoc monitoring via `wrangler tail --format=json` is available as a manual alternative for a small pilot.

---

## 6. Phased Ramp Gate Criteria

The recommended progression from current state to a full platform flip:

### Gate 0 — Pre-Activation (prerequisite, must be done before any store activation)

| Item | Owner | Status |
|---|---|---|
| Fix I-F1: rename `name="name"` → `name="fullName"` in customer-register Liquid template (`theme-bundle.ts`) and align gateway handler | Engineering | **CLOSED** (commit 4eaf3e84; `theme-bundle.ts:2433`; route reads `form.get('fullName') ?? form.get('name')`; A11Y-5 green) |
| Wire `FEATURE_LIQUID` gateway flag to `featureGate()` in `services/api-gateway/src/index.ts` as a kill switch, or document it as intentionally dormant with ARB sign-off | ARB + Engineering | OPEN |
| Apply migration 188 (`letbuyy_core_theme_row.sql`) to production database | Operations | Required for B-6 CLOSED in production |
| Confirm live observability: at minimum, `wrangler tail --format=json` piped to a log aggregation sink capable of filtering `lb:canary:render` and `lb:canary:render:fallback` | Operations | NOT-CONNECTED |

### Gate 1 — Supervised Per-Store Canary (1–5 stores, 7 days)

| Item | Criterion | Owner |
|---|---|---|
| Activate 1–5 known stores on Liquid by publishing a Liquid release (sets `renderer_engine='liquid'` in `theme_releases.release_manifest`) | Successful publish; no 500 errors | Engineering |
| Observe fallback rate | < 0.5% over 7 days | Operations |
| Observe `lb:canary:render:fallback` event rate | < 0.1% over 7 days | Operations |
| Confirm no blank-page / empty-chrome incidents | Zero SEV-1 attributed to Liquid renderer | Engineering / Support |
| Collect production p95 TTFB for Liquid stores | Establish baseline (no PROPOSED threshold set yet) | Operations |

### Gate 2 — Expanded Canary (10–50 stores, 14 days)

| Item | Criterion |
|---|---|
| Expand to 10–50 stores | Fallback rate and error rate remain under Gate 1 thresholds |
| First production memory profiling run | No sustained heap growth above React baseline |
| DAST scan against a Liquid-rendered staging URL | No Critical or High findings not already tracked |
| Visual-diff baseline established for at least 3 store templates | < 1% pixel diff vs React render for same merchant content |
| H-F2 (path traversal in exporter) assessed and either fixed or formally risk-accepted | Engineering + ARB |

### Gate 3 — ARB Platform Flip Decision

The ARB convenes with the evidence from Gates 1 and 2. If all thresholds are met and open items from §7 are resolved or formally accepted, the ARB may authorize:

1. A human-authored commit changing `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true` in `packages/theme-engine/src/theme-governance.ts:14`.
2. A supervised storefront-runtime redeploy with a rollback runbook on standby.
3. Updating `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` from `'deferred'` to `'approved'` in the same file (documentation only; does not gate anything at runtime).

**No part of this Phase J document, and no automated script in this repository, performs Gate 3.**

---

## 7. Open Risks

| ID | Severity | Description | Owner | Blocker for |
|---|---|---|---|---|
| I-F1 | ~~HIGH~~ **CLOSED** | DOMPurify 3.x clobbering bug on customer-register form — **FIXED** in commit 4eaf3e84. Field renamed from `name="name"` to `name="fullName"` in `packages/theme-engine/src/theme-bundle.ts:2433`. Register route (`apps/storefront-runtime/src/app/api/customer/register/route.ts:45`) reads `form.get('fullName') ?? form.get('name')`. A11Y-5 asserts `name="fullName"` survives DOMPurify and `name="name"` is absent (221/221 PASS). | Engineering | **CLOSED — not a blocker** |
| H-F2 | **CLOSED** | Path traversal in `theme-artifact-exporter.ts` — fixed. `assertSafeArtifactPath()` (`packages/theme-engine/src/theme-artifact-exporter.ts:58–68`) guards all path composition points (lines 75, 82, 90, 116, 124). Throws `UnsafeThemeArtifactPathError` on absolute paths or `..` segments. Previously listed as OPEN MEDIUM; code evidence confirms closure. | Engineering | **CLOSED** |
| H-F1 | **CLOSED** | Linter `forbidAttrs` — fixed. `for (const attr of forbidAttrs)` at `theme-linter.ts:101` iterates FORBID_ATTR dynamically from `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`. Rule name is `forbidden-attr`. Previously listed as OPEN MEDIUM with wrong claim of hardcoded regex; code confirms the sanitizer is the single source of truth. | Engineering | **CLOSED** |
| H-F3 | LOW | `theme-artifact-exporter.ts` lines 101–110: `settings_data` exported as-is. Code comment (lines 101–107) documents this as intentional: settings_data holds design tokens; BLOCKED_DROP_KEYS is a render-time defence, not an export-time one. Risk exists if untrusted merchant data reaches the export pipeline. | Engineering | Gate 2 — assess or formally risk-accept |
| UC-19 | LOW | `FEATURE_LIQUID` gateway flag (`services/api-gateway/src/middleware/featureFlags.ts:4`, `wrangler.toml:248`) is declared but `featureGate('FEATURE_LIQUID', ...)` is never called. The flag has zero runtime effect. ARB should decide: wire it as a kill switch (requires gateway deploy to activate) or document it as intentionally dormant. | ARB + Engineering | Gate 0 — decision required before activation |
| B-5 residual | LOW | Schema migration registry has zero concrete migrations registered. Any future breaking section schema change must register a `ThemeSectionSchemaMigration` before deployment or stored `template_snapshot` data in `theme_releases` will not be upgraded. | Engineering | Ongoing — process gate, not a current blocker |
| B-7 residual | LOW | `G3-consume` (settings-schema canonicalization at publish time) deferred. Editor and Liquid render may show different settings organization (flat appearance vs 5-group) until G3-consume lands, coordinated with an editor-side migration. | Engineering | Ongoing — acknowledged dual-shape state |
| OQ-13 | UNKNOWN | Count of production stores currently with `renderer_engine='liquid'` in `release_manifest` (from migration 180 cascade via publish). Cannot be determined from static analysis. Query required: `SELECT COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'`. | Operations | Gate 0 — run query before activating any stores (establish baseline) |
| Governance tenant-registry | NON-BLOCKER (named) | `scripts/validate-governance.mjs` FAIL: `tenant-tables.registry.ts` out of sync with schema-derived registry. Pre-dates Phase B. Fix: run `scripts/generators/generate-tenant-table-registry.mjs`. No relationship to Liquid rendering. | Human engineering team | Not a Liquid GO gate |
| Sequential migration validator | NON-BLOCKER (named) | `scripts/validators/sequential-migration-validator.mjs` FAIL: migrations 186/187 on disk but uncommitted WIP pre-dating Phase B. No relationship to Liquid rendering. | Human engineering team | Not a Liquid GO gate |

---

## 8. Rollback Runbook (Reference)

If a Liquid store exhibits errors after per-store activation, the rollback does not require a code deploy.

**Fastest rollback (< 90 seconds, no deploy):**

1. Execute the following SQL against the production database via Supabase service-role credentials:
   ```sql
   UPDATE theme_releases
   SET release_manifest = release_manifest - 'renderer_engine' 
                        || '{"renderer_engine": "json-contract"}'::jsonb
   WHERE id = (
     SELECT current_theme_release_id FROM sites WHERE subdomain = '<store-subdomain>'
   );
   ```
2. Wait up to 60 seconds for ISR revalidation (`export const revalidate = 60` in `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx`). Subsequent requests render React.

**Canary flag rollback (no deploy, < 90 seconds):**

Set any of the 11 canary aliases to a falsy value in `sites.template_config` or `theme_releases.release_manifest`:
```json
{ "liquidRenderingCanary": "false" }
```
Falsy values recognized by `readBooleanDecision()` at `theme-governance.ts:130`: `'0'`, `'false'`, `'disabled'`, `'off'`.

**Platform-level kill switch (gateway deploy required):**

Wire `FEATURE_LIQUID` to `featureGate('FEATURE_LIQUID', ...)` in `services/api-gateway/src/index.ts`. Set `FEATURE_LIQUID = 'false'` in `wrangler.toml` production vars. This requires a gateway deploy and is currently dormant (UC-19 above).

**Global default rollback (storefront-runtime redeploy required):**

If the global flip has been executed and must be reverted, change `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` in `packages/theme-engine/src/theme-governance.ts:14` and redeploy storefront-runtime to Vercel. This is the only mechanism that reverts all stores simultaneously.

---

## 9. Document Lineage

This package synthesizes evidence from the following committed documents:

| Phase | Document | Key contribution |
|---|---|---|
| B | `certification/ARCHITECTURE_CERTIFICATION.md` | 7 original ARB blockers identified |
| B | `certification/RISK_CLOSURE_REPORT.md` | 56-item risk register; per-item CLOSED/OPEN/REFUTED verdicts |
| B | `certification/EVIDENCE_REPORT.md` | Phase B static audit evidence |
| C–I | `phase-{c..i}/PHASE_*_REPORT.md` | Per-phase implementation evidence |
| H | `phase-h/PHASE_H_REPORT.md` | Security findings H-F1, H-F2, H-F3 |
| I | `phase-i/PHASE_I_REPORT.md` | QA certification; I-F1 DOMPurify clobbering bug found and fixed (name="fullName", commit 4eaf3e84, A11Y-5 asserts); test authoring record |
| I | `phase-i/QA_CERTIFICATION.md` | 16-category QA matrix; CONNECTED/NOT-CONNECTED breakdown |
| J | `phase-j/ROLLOUT_READINESS_PACKAGE.md` | Activation mechanics; telemetry map; blocker reconciliation; open items |
| 11 | `11_GAP_ANALYSIS.md` | Original gap analysis; source of 7 ARB blockers |
| 12 | `12_MASTER_LIQUID_MIGRATION_PLAN.md` | Migration plan and phase scope |

---

*ARB Approval Package — Storefront Liquid Platform | 2026-07-10 | Branch: stepup/main | Author: Subagent (Phase J ARB package author role)*  
*This document is planning and evidence only. No flag is flipped. No deployment is made. ARB authority required for any platform-wide activation.*
