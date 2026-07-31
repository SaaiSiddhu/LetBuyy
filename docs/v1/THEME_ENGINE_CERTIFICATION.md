# Theme Engine Certification (V1)

**Type:** Research / certification — no code changes.
**Date:** 2026-06-16
**Scope:** `packages/theme-engine` (Liquid engine) + `apps/storefront-runtime/src/lib/theme-engine` (composition) + `apps/merchant-control-plane` (theme editor). Parent: [STOREFRONT_CERTIFICATION_AUDIT.md](STOREFRONT_CERTIFICATION_AUDIT.md).

---

## A. Theme Engine — Verdict Table

| Capability | Verdict | Evidence (file:line) |
|---|---|---|
| Liquid render **without React** | **CONNECTED (works) but GATED OFF** | Real `liquidjs` renderer `packages/theme-engine/src/theme-renderer.ts:2,321` (`class LiquidRenderer`), invoked at request time `composition-engine.tsx:354` `createThemeRenderer('liquid')`; full-Liquid page emits header+body+footer with no React chrome `composition-engine.tsx:386-387`, `layout.tsx:218,245` |
| React **fully removed** | **FALSE — hybrid, React default** | `theme-governance.ts:14` `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`; `proxy.ts:175` `? 'liquid' : 'react'`; React registry `renderer-registry.tsx` |
| Liquid **on by default** | **DISCONNECTED (default OFF)** | `theme-governance.ts:14` = `false`; per-theme opt-in only `template-resolver.ts:241-246` |
| Theme **publish** | **CONNECTED** | gateway `theme-execution.adapter.ts:1311` `publish()` → `:666-669` `db.rpc('publish_theme_release')` |
| Theme **rollback** | **CONNECTED** | gateway `theme-execution.adapter.ts:1416` `rollbackRelease()`; GraphQL `schema.ts:1794` `themeRollback(releaseId, idempotencyKey)`; merchant route `api/themes/[themeId]/releases/[releaseId]/rollback/route.ts` |
| Theme **versioning** | **CONNECTED** | `ThemeRelease.release_version` + `rollback_of_release_id` `packages/theme-engine/src/index.ts:137-153`; `release_version` snapshots in adapter |
| Theme **asset loading** | **PARTIAL** | base stylesheet injected as sanitized inline `<style>` `theme-renderer.ts:172-229`; external asset route not used (no `<link>` to keep sanitizer FORBID list intact `theme-renderer.ts:174-175`) |
| **Sanitizer lock** | **CONNECTED (locked)** | DOMPurify `theme-renderer.ts:114-167` `FORBID_TAGS:['base','embed','object','script']`, `FORBID_ATTR:['style']`; Liquid `outputEscape:'escape'` `:430`; `sanitizeRenderedHtml` `:891` |
| Theme **bundle loading / manifest parsing** | **CONNECTED** | `LiquidThemePackageBundleSchema.safeParse` `template-resolver.ts:120`, `store-service.ts:670`; bundle templates/sections coerced `template-resolver.ts:157-217` |
| Theme **hydration** | **CONNECTED (islands)** | `liquid-hydration-islands.tsx` (`use client`) mounted after Liquid HTML `composition-engine.tsx:86` |

**Net:** the Liquid engine is **real and fully wired**, not a stub. Its single disqualifier for "Liquid platform" is that it is **off by default** and only one theme ships a Liquid bundle.

---

## B. React Inventory (everything still React)

| React surface | File:line | Role |
|---|---|---|
| Render-engine default = react | `proxy.ts:175`; `theme-governance.ts:14` | Platform default |
| React section **registry** | `lib/theme-engine/renderer-registry.tsx:55-205` (`SECTION_RENDERER_DEFINITIONS`), dispatch `:268-272` | Maps section type → React component |
| Registered React renderers (~20) | `renderer-registry.tsx` | `core.header/footer/hero/product-grid/product-detail/featured-products/testimonials/about/newsletter/portfolio-grid/skills/experience-timeline/contact-form/cta/services-grid/rich-content`, `commerce.category-grid/brand-marquee/trust-badges`, `apps.app-block-slot` |
| React section components | `components/sections/*.tsx` (19 files) | hero, product-grid, featured-products, testimonials, newsletter, banner-carousel, category-grid, cta-section, about-section, contact-form, trust-badges, brand-marquee, portfolio-grid, skills-section, services-grid, experience-timeline, rich-content-section, product-detail-section, app-block-slot |
| React layout chrome | `app/store/[subdomain]/layout.tsx:117-119,218,245` | `liquidPage ? children : <React header/footer>` |
| React composition engine | `lib/theme-engine/composition-engine.tsx` (`RenderSectionList` `:17-66`) | Default render path |
| React hydration islands | `lib/theme-engine/liquid-hydration-islands.tsx` (`use client`) | Cart/interactivity for Liquid pages |
| React editor-preview frame | `lib/theme-engine/editor-preview-section-frame.tsx` (`use client`) | Editor overlay |
| React product detail client | `app/store/[subdomain]/product/[productId]/product-details-client.tsx` | Uses `DEFAULT_THEME_SETTINGS` |

**Conclusion:** React is the **primary** storefront renderer. Liquid is the secondary, opt-in renderer that, when active, still uses React **hydration islands** for interactivity. This is architecture (c)/(b) hybrid — *not* React-removed.

---

## C. Theme Engine Score — **72 / 100**

**Credit (what's genuinely built):**
- Real `liquidjs` renderer with section/template/chrome rendering and warnings (`theme-renderer.ts:257-388`).
- Locked DOMPurify sanitizer + Liquid `outputEscape:'escape'` (`theme-renderer.ts:114-167,430`).
- Commerce drops (product/collection/cart/shop) built for Liquid context (`composition-engine.tsx:229-339`).
- App-block + app-embed Liquid rendering (`composition-engine.tsx:100-216`).
- Full theme lifecycle types + RPC-backed publish/rollback/versioning.

**Deductions:**
- −15 Off by default; not the production renderer (`theme-governance.ts:14`).
- −6 Only one theme is Liquid-first; no Liquid bundle for general themes ⇒ silent React fallback.
- −4 Demo-fixture Liquid bundle is the production fallback (`store-service.ts:670-673`).
- −3 Asset pipeline is inline-style only (no external/cacheable asset route).

---

## D. Per-Section Data Source Table

| Section (type / renderer) | File:line | Data source |
|---|---|---|
| Hero / banner (`heroBanner`, `core.hero`) | `components/sections/hero.tsx`, `banner-carousel.tsx` | MERCHANT-CONFIGURED (section settings) |
| Product grid (`productGrid`, `core.product-grid`) | `components/sections/product-grid.tsx`; data `data-binding-engine.ts:92-103` | **REAL DB** (gateway products) |
| Featured products (`featuredProducts`) | `components/sections/featured-products.tsx`; `data-binding-engine.ts` | **REAL DB** |
| Product detail (`product-detail`) | `components/sections/product-detail-section.tsx`; `data-binding-engine.ts:59-64,101` | **REAL DB** (single product) |
| Category grid (`commerce.category-grid`) | `components/sections/category-grid.tsx` | MERCHANT-CONFIGURED (collections referenced) |
| Testimonials / About / CTA / Rich content | `components/sections/{testimonials,about-section,cta-section,rich-content-section}.tsx` | MERCHANT-CONFIGURED |
| Newsletter / Contact form | `components/sections/{newsletter,contact-form}.tsx` | MERCHANT-CONFIGURED (submits to gateway forms) |
| Trust badges / Brand marquee | `components/sections/{trust-badges,brand-marquee}.tsx` | HARDCODED defaults unless settings provided |
| Portfolio / Skills / Experience / Services | `components/sections/{portfolio-grid,skills-section,experience-timeline,services-grid}.tsx` | MERCHANT-CONFIGURED (non-store site types) |
| App-block slot (`apps.app-block-slot`) | `components/sections/app-block-slot.tsx`; `store-service.ts:208-276` | MERCHANT-CONFIGURED (marketplace app instances) |
| Header / Footer chrome | `components/layout/{dynamic-header,dynamic-footer}.tsx` | REAL (store + navigation from gateway `store-service.ts:485-493`) |
| Collection listing | `collections/[slug]/page.tsx:102-108` | **REAL DB** (gateway collection+products) |
| **Liquid fallback bundle** | `store-service.ts:670-673` | **DEMO FIXTURE** (only when Liquid on, no bundle) |

---

## E. Mocks / Fixtures / Dead code in the theme engine layer

| Item | File:line | Note |
|---|---|---|
| Urban Kicks Liquid bundle fixture | `store-service.ts:670-673` | Production fallback when a store's Liquid bundle is missing/invalid (Liquid path only) |
| Demo store + product catalog + reviews | `lib/demo/urban-kicks-demo.ts:17-185,240-263` | Hardcoded; reachable via `/preview` & demo-store reviews only |
| Default `themeId='urban-kicks'` | `store-service.ts:557` | Demo theme is the platform default identity |
| `UnknownSectionFallback` | `renderer-registry.tsx:243-265` | Graceful "renderer not available" placeholder (not a mock, but renders visible fallback text) |
| `local-fallback:` release id | `theme-execution.adapter.ts:807` | Publish path that bypasses the `publish_theme_release` RPC if the RPC errors |

No dead theme-engine source was identified; `packages/theme-engine` is imported broadly by the storefront (types + `createThemeRenderer` + fixtures).

---

## F. Theme Editor Certification

### F.1 Verdict Table

| Flow | Verdict | Evidence (file:line) |
|---|---|---|
| Edit (sections/blocks/settings/schema) | **CONNECTED** | `editor/page.tsx` (1897 lines, `'use client'`) panels `sections|settings|versions`; schema-driven `getSectionSchemas`/`getThemeSettingsSchema` (`editor/page.tsx:36-40`), `SchemaFormRenderer`, `CenterPanel` |
| Save (persist draft) | **CONNECTED** | `api/themes/[themeId]/editor/draft/route.ts:77-90` `themes.saveDraft(...)` → gateway `theme-execution.adapter.ts:1157` `saveDraft` → `saveEditorDraftRecord`/`saveInstanceDraftSnapshot` |
| Draft isolation + concurrency | **CONNECTED** | `base_version` optimistic concurrency `editor/draft/route.ts:65,80`; drafts in `theme_editor_drafts`/`theme_instance_drafts` (domain-intel) |
| Preview (unpublished) | **CONNECTED** | preview session `api/themes/[themeId]/preview-session/route.ts` → adapter `createPreviewSession` `:1499`; storefront renders preview via `theme-preview-server.ts` + `getPreviewStoreBySubdomain` (`store-service.ts:72-85`) |
| Publish (draft → live) | **CONNECTED** | `api/themes/publish/route.ts` → adapter `publish` `:1311` → `db.rpc('publish_theme_release')` `:669`; sets `current_theme_release_id` `:771` |
| Rollback | **CONNECTED** | `api/themes/[themeId]/releases/[releaseId]/rollback/route.ts` → adapter `rollbackRelease` `:1416-1485`; versions panel in editor |

### F.2 Save → Publish flow trace (no stubs found in the hot path)

1. Editor edits state (`editor/page.tsx`, React).
2. Auto-save dirty draft → `POST /api/themes/[themeId]/editor/draft` (`editor/draft/route.ts:44`) → `resolveOwnedStoreId` (ownership) `:74` → `merchantApiClient.themes.saveDraft` `:77`.
3. Gateway `ThemeExecutionAdapter.saveDraft` `:1157` validates schema (`validateTemplateConfig` `:246`) + persists draft snapshot.
4. Publish → `POST /api/themes/publish` → `ThemeExecutionAdapter.publish` `:1311` → `publishReleaseSnapshot` `:666` → `db.rpc('publish_theme_release')` `:669`; on RPC error → `publishReleaseSnapshotFallback` `:695` (**non-RPC fallback**, `local-fallback:` id `:807`).
5. Store row updated `current_theme_release_id` `:771`; storefront reads new release via `current_theme_release` (`store-service.ts:543-557`).

### F.3 Theme Editor Score — **78 / 100**

**Credit:** complete, schema-driven, ownership-checked, optimistic-concurrency drafts, real publish/rollback/preview through the gateway and canonical RPC; versions panel for rollback; device preview.
**Deductions:**
- −10 The editor primarily edits **section settings/order + theme settings**, not Liquid template *authoring*; a merchant cannot hand-author a Liquid theme bundle here (they edit a React-section model that can carry a `liquidBundle`/`liquidRenderingCanary` toggle — `editor/draft/route.ts:23-36`).
- −6 `local-fallback` publish path can publish a release without the canonical `publish_theme_release` RPC (`theme-execution.adapter.ts:695,807`) — acceptable resilience, but a non-canonical write path.
- −6 Live preview render fidelity (draft → exact storefront output) is **unverified** (no running env; research-only).

---

## G. What must be built before a "Liquid-only" storefront is real

1. **Flip the default decision.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is `false` (`theme-governance.ts:14`). A Liquid platform needs this `true` *and* a Liquid bundle for **every** shipped theme (today only Urban Kicks qualifies).
2. **Liquid bundles for all themes** so `resolveLiquidBundle` (`template-resolver.ts:110-125`) stops returning `undefined` → React.
3. **Remove the demo-fixture Liquid fallback** in the production mapper (`store-service.ts:670-673`) or replace it with the store's real theme bundle.
4. **React/Liquid visual + functional parity tests** (cart islands, product detail, checkout entry) before retiring React renderers.
5. **Liquid template authoring** in the editor (or a theme-package import pipeline) so merchants/partners can ship Liquid themes without engineering.
6. **Asset pipeline** beyond inline `<style>` (cacheable external theme assets) if richer themes are required.
7. **Retire/guard the React registry** only after 1–5, since it is the current default path.
