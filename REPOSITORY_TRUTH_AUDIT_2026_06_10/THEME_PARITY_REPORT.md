# THEME SYSTEM TRUTH — Parity Report (CRITICAL axis)

Repository Truth Audit 2026-06-10 · branch `stepup/main` · HEAD `5cf9e64e` · working tree dirty (998 entries)
Scope: React renderer vs Liquid renderer — completeness, parity, runtime routing, sanitizer, editor, publishing, marketplace.
Method: code-first verification. Every claim cites `path:lines`. HEAD vs working-tree state is flagged wherever they differ. Discovery only.

---

## Executive Summary

1. **The D7-THEME-LIQUID-PARITY ledger claims are substantially TRUE at the code level, and entirely UNCOMMITTED.** DOMPurify+jsdom replaced the 3-regex sanitizer, LiquidJS auto-escape (`outputEscape: 'escape'`) is on, fragment/head/document sanitizer modes exist, a 20-entry parity table exists and is covered by Liquid section files in the first-party bundle, the per-theme canary gate exists with default OFF, and the React section freeze validator enumerates exactly 20 files. All of it exists only in the working tree (`git status`: `M packages/theme-engine/src/*`, `?? jsdom-runtime.d.ts`, `?? no-new-react-sections-validator.mjs`). At HEAD the sanitizer is still regex (`/tmp` extraction of `HEAD:packages/theme-engine/src/theme-renderer.ts` lines 606–610) and there is **no parity table, no flip-decision record, no auto-escape**.
2. **"Parity" is type-level, not functional.** The 20 mappings map React *file names* to Liquid *section types*. The Liquid sections are skeletal (e.g. Liquid `hero-banner` = 5 plain text settings; React hero = 8 schema fields + multi-banner carousel + overlay/height/align + framer-motion). No commerce data binding: first-party Liquid `product-grid`/`featured-products` render **hard-coded block strings** (title/price/url), while React versions are bound to the live catalog through the data-binding engine.
3. **Two React surfaces have no Liquid counterpart at all: header and footer** (`core.header`/`core.footer` → `dynamic-header.tsx`/`dynamic-footer.tsx`). Worse, when the Liquid canary is ON the render plan hard-codes `sectionGroups: { header: [], footer: [] }` (template-resolver.ts:213–216), so a Liquid-canary store renders **no header and no footer** (no nav, no cart icon, no search, no account).
4. **Runtime default is React/JSON-contract for every store.** Liquid renders only when (a) a per-store boolean canary is true AND (b) a valid Liquid bundle parses from the store's template/release config. **No write path exists for the canary** — no API route, no editor control, no migration sets `liquidRenderingCanary` anywhere in the repo; the only mechanism is hand-editing JSONB in the database.
5. **The only first-party Liquid bundle (`urban-kicks-liquid`) is a test fixture.** It is referenced exclusively from `theme-bundle.ts` (its own definition) and tests. It is not seeded in any SQL, not in the theme catalog, has only an `index` template — so under Liquid, product/cart/collection routes fall back to rendering the **home** template.
6. **No editor (web or mobile) can see, edit, install, or toggle Liquid.** Zero `liquid` matches in `apps/merchant-control-plane/src` and in the Flutter app `apps/mobile/merchant-app/lib`.
7. **Deletion-readiness verdict for the React renderer: NOT-READY.** Type-level mapping is 20/20 for the frozen section files, but 20/22 of the registered React renderer surface (header/footer unmapped), and functional parity is unproven for every data-bound section and every capability row (editor, templates, data binding, head control, embeds). Gap list in §9.

---

## 1. Method

- File reading/grepping on `/Users/saai_sidd/Git/Letbuyy_Store` (working tree); read-only git via mounted shell (`git status`, `git show HEAD:<file>`).
- Ran (read-only): `node scripts/validators/theme-governance-validator.mjs` → PASS; `node scripts/validators/no-new-react-sections-validator.mjs` → PASS (20 frozen sections); `node --test tests/theme-engine/first-party-liquid-portability.test.mjs tests/theme-engine/liquid-renderer-contract.test.mjs` → 8/8 PASS.
- `pnpm --filter @letbuyy/theme-engine run test` (behavioral tests incl. DOMPurify/auto-escape) could **not** be executed in the audit sandbox: `tsx` fails with esbuild darwin-arm64/linux-arm64 platform mismatch (node_modules installed on macOS). The behavioral test *code* was read and is quoted below; execution status in this environment: UNVERIFIED (environment artifact, not a code failure).
- Today: 2026-06-10.

---

## 2. React Inventory

### 2.1 Section component files — exactly 20 (all frozen)

`apps/storefront-runtime/src/components/sections/` contains exactly these 20 `.tsx` files (Glob, matches the freeze validator list `scripts/validators/no-new-react-sections-validator.mjs:9-30` 1:1):

about-section, app-block-slot, banner-carousel, brand-marquee, category-grid, contact-form, cta-section, experience-timeline, featured-products, hero, marquee, newsletter, portfolio-grid, product-detail-section, product-grid, rich-content-section, services-grid, skills-section, testimonials, trust-badges.

Plus 2 layout components outside the frozen set: `apps/storefront-runtime/src/components/layout/dynamic-header.tsx`, `dynamic-footer.tsx`.

Notes:
- `banner-carousel.tsx` has **no registry entry of its own**; it is a sub-component of hero (`hero.tsx:7 import BannerCarousel from './banner-carousel'`).
- `marquee.tsx` is **dead code**: imported by nothing in `apps/` (grep for `from './marquee'`/`import Marquee` → 0 matches). It still appears in the parity table as `frozen.marquee`.

### 2.2 Renderer registry — 20 renderer keys

`apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:198-345` (`SECTION_RENDERER_DEFINITIONS`) registers 20 keys:

core.header, core.footer, core.hero, core.product-grid, core.product-detail, core.featured-products, core.testimonials, core.about, core.newsletter, core.portfolio-grid, core.skills, core.experience-timeline, core.contact-form, core.cta, core.services-grid, core.rich-content, commerce.category-grid, commerce.brand-marquee, commerce.trust-badges, apps.app-block-slot.

Unknown types render an explicit fallback placeholder (`UnknownSectionFallback`, renderer-registry.tsx:385-407).

### 2.3 React-side ghosts: 5 of 24 built-in types have NO renderer

`packages/theme-engine/src/built-in-section-schemas.ts:3-28` declares 24 `BUILT_IN_SECTION_TYPES`. Grep of `apps/storefront-runtime/src` finds **zero renderer** for: `announcementBar`, `collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero`. They are schema-only: the editor can add them; the storefront renders the fallback box. Notably the **default** Urban Kicks JSON template includes an `announcementBar` section (`packages/theme-engine/src/theme-registry.ts:625-633` `announcement-default`), so default stores render a placeholder there. (`announcement-bar` *does* exist as a Liquid section — Liquid exceeds React here.)

### 2.4 What relies on React rendering today

- Header/footer/nav/cart/search/account chrome: `app/store/[subdomain]/layout.tsx:214-254` renders header/footer groups through the React registry only.
- Live catalog data binding: `lib/theme-engine/data-binding-engine.ts` feeds `products`/`product` into React renderers (`renderer-registry.tsx:233-259`).
- Site-type gating (`store` vs portfolio/resume): React render functions return `null` for non-store sites (renderer-registry.tsx:233-235, 241-251, 257-259).
- Editor preview per-section frames: `EditorPreviewSectionFrame` wraps each React section (`composition-engine.tsx:45-55`); Liquid output is one opaque `dangerouslySetInnerHTML` blob (composition-engine.tsx:79-89).
- Product/shop/cart/account/checkout routes all compose through the same engine with React fallback sections (e.g. `product/[productId]/page.tsx:43-49` uses `createProductDetailFallbackSection()`; `lib/theme-engine/product-route.ts:28-40`).
- SEO: Next.js `generateMetadata` + JSON-LD (`product/[productId]/page.tsx:13-31, 56-74`) for both engines.

### 2.5 Settings schema support (React)

Two schema sources merged at runtime: package registry `SECTION_SCHEMAS` (theme-registry.ts:419-432, 12 entries) and `RUNTIME_SECTION_SCHEMAS` (renderer-registry.tsx:66-188, 10 entries), plus `BUILT_IN_SECTION_SCHEMAS` in template validation (`packages/theme-engine/src/index.ts:719-722`). Rich field types (text/textarea/richtext/color/image/select/toggle/range/number/url/radio — theme-registry.ts:13), presets, blocks_schema.

---

## 3. Liquid Inventory

### 3.1 Engine & versions

- `liquidjs` **10.27.0** (declared `^10.27.0` packages/theme-engine/package.json:23; locked `liquidjs@10.27.0` pnpm-lock.yaml). `dompurify` **3.4.9**; `jsdom` **^29.1.1** (package.json:21-22).
- Engine config — `packages/theme-engine/src/theme-renderer.ts:322-342`:
  `cache: false, dynamicPartials: false, strictFilters: true, strictVariables: false, ownPropertyOnly: true, outputEscape: 'escape', jsTruthy: false, parseLimit: 300_000, renderLimit: 250 (ms), memoryLimit: 2_000_000`; `templateLimit: 20_000` (liquidRenderOptions, lines 310-314).
- **Auto-escape is ON in the working tree only.** HEAD's engine config has `strictFilters`/`ownPropertyOnly` but **no `outputEscape`** (verified via `git show HEAD:packages/theme-engine/src/theme-renderer.ts`).

### 3.2 Sanitizer truth (DOMPurify; regex sanitizer gone)

Working tree (`theme-renderer.ts:690-741`):

```ts
const [{ default: createDOMPurify }, { JSDOM }] = await Promise.all([
  import('dompurify'),
  import('jsdom'),
]);
...
export async function sanitizeRenderedHtml(html, options = {}) {
  const { purify, createDocument } = await getThemeDomPurify();
  if (options.allowHeadMetadata) { ... WHOLE_DOCUMENT wrap, return head.innerHTML ... }   // head mode
  return purify.sanitize(html, options.wholeDocument
    ? LIQUID_RENDERED_HTML_DOMPURIFY_DOCUMENT_CONFIG                                      // document mode
    : LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG);                                             // fragment mode (default)
}
```

Policy (`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`, theme-renderer.ts:108-159): `USE_PROFILES: { html: true }`; `ADD_TAGS` = the 4 hydration custom elements + `iframe` + `meta`; explicit `ADD_ATTR` allowlist; `CUSTOM_ELEMENT_HANDLING.tagNameCheck: /^lb-(?:add-to-cart|cart-drawer|search|variant-picker)$/`; `FORBID_ATTR: ['style']`; `FORBID_TAGS: ['base','embed','object','script']`. An `uponSanitizeAttribute` hook (lines 698-711) drops data-attributes containing `<`/`>` and `javascript:`/`data:text/html` URL attributes.

Old regex sanitizer: present at **HEAD** (`HEAD:theme-renderer.ts:606-610` — three chained `.replace()` for `<script>`, `on*=`, `javascript:|data:text/html` hrefs); **gone from the working tree** — repo-wide grep for the regex bodies returns 0 matches. The `theme-governance-validator.mjs:90-92` now fails if `.replace(` appears inside `sanitizeRenderedHtml`, and `tests/theme-engine/liquid-renderer-contract.test.mjs:40-47` asserts the same (text-level assertions). Behavioral proof lives in `packages/theme-engine/test/theme-engine.test.ts:247-264` (hydration elements preserved, `<script>`/`onclick`/`javascript:` removed) and 266-327 (auto-escape of merchant settings) — read but not executable in this sandbox (esbuild platform mismatch), so behavior-at-runtime: UNVERIFIED-BY-EXECUTION here, asserted by the repo's own test suite.

Sanitizer modes claim — verified: fragment (default), head (`allowHeadMetadata` used for header embeds, theme-renderer.ts:216), document (`wholeDocument` used for layoutHtml, line 283).

### 3.3 Liquid "files" — there are NO .liquid files on disk

`find … -name "*.liquid"` (excluding node_modules) → **0 files**. All Liquid source lives as TypeScript string literals inside `packages/theme-engine/src/theme-bundle.ts`. The bundle schema models virtual paths (`sections/*.liquid`, `blocks/*.liquid`, `layout/theme.liquid` — theme-bundle.ts:20-28) with per-file caps (200 KB, line 56) and forbidden fragments (`<script`, `javascript:`, `data:text/html`, `{% include %}`, `{% layout %}`, `{% render %}` — ThemeLiquidSourceSchema lines 96-119; i.e., **no partials/snippets mechanism at all**).

Inventory of Liquid sections (working tree):

- `createLiquidParitySectionFiles()` (theme-bundle.ts:769-1003) — **15 sections**: about-section, app-block-slot, banner-carousel, brand-marquee, contact-form, cta-section, experience-timeline, marquee, portfolio-grid, product-detail, rich-content, services-grid, skills-section, testimonials, trust-badges.
- `createUrbanKicksLiquidThemeBundleFixture()` (theme-bundle.ts:1653-2398) adds **7 inline sections**: announcement-bar, hero-banner, category-grid, featured-products, product-grid, spotlight, newsletter-signup → **22 section types total** in the Urban Kicks Liquid bundle; **3 blocks**: category, product-card, badge; **1 layout** (`layout/theme.liquid`); **1 template** (`index` only); locales: `en` only.
- `createMinimalLiquidThemeBundleFixture()` (theme-bundle.ts:1459-1651): spotlight section + badge block.

### 3.4 Drops, filters, tags

- Scope/drops (`buildLiquidScope`, theme-renderer.ts:427-464): `shop`, `request`, `settings`, `routes` (root/cart/search), `product`, `collection`, `collections`, `cart`, `customer`, plus `section`/`block` objects. Drop sanitization (`toLiquidDrop`, lines 509-532): depth ≤ 4, ≤ 80 keys, ≤ 100 array items, identifier-only keys, blocklist (`password`, `access_token`, `signing_secret`, … line 475).
- Custom filters (`registerLetbuyyLiquidFilters`, lines 548-554): `money`, `money_with_currency`, `json` (drop-sanitized + `<` escaped), `asset_url`, `image_url` (both via `safeLiquidUrl`, lines 568-575). LiquidJS built-in filters remain available (`strictFilters` only rejects unknown names).
- Tags: standard LiquidJS tags; `{% schema %}` blocks are stripped pre-render (`stripLiquidSchemaBlocks`, lines 362-364); include/layout/render are banned at bundle validation (3.3).
- Commerce context wiring at runtime: `composition-engine.tsx:269-309` builds `shop/product/collection/collections/cart/customer` from section data; cart is a **hard-coded empty stub** (`item_count: 0`, lines 301-306), customer `null` — server-side cart/customer drops are not real; client hydration islands fetch the actual cart (`liquid-hydration-islands.tsx`).

### 3.5 Settings schema parsing & hydration islands

Per-section `{% schema %}` is mandatory (ThemeLiquidSectionFileSchema, theme-bundle.ts:185-197), Zod-validated; runtime editor schemas are derived (`buildLiquidRuntimeSectionSchemas`, lines 1053-1090) with renderer keys `liquid.section.<type>` / `liquid.block.<type>` / `liquid.app-block` (lines 1339-1344). Hydration islands: `lb-add-to-cart`, `lb-cart-drawer`, `lb-search`, `lb-variant-picker` (theme-bundle.ts:30-51) with a real client web-component runtime (`apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx`).

---

## 4. Feature Parity Matrix

### 4.1 The 20-mapping table — VERIFIED to exist and be covered

`packages/theme-engine/src/theme-governance.ts:15` `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT = 20`; table at lines 23-44 (**working-tree only; absent at HEAD**). All 20 `liquidSectionType`s exist in the Urban Kicks bundle (test `theme-engine.test.ts:232-245`; gap-checker `collectLiquidPortableSectionParityGaps` governance.ts:170-175).

| # | React file (frozen) | rendererKey | Liquid section | Type-mapped? | Functional parity? (evidence) |
|---|---|---|---|---|---|
| 1 | about-section.tsx | core.about | about-section | YES | PARTIAL — Liquid: 4 settings incl. image/layout (bundle:771-787) |
| 2 | app-block-slot.tsx | apps.app-block-slot | app-block-slot | YES | PARTIAL — Liquid `@app` blocks render injected sanitized HTML (renderer:577-598) |
| 3 | banner-carousel.tsx | frozen.banner-carousel | banner-carousel | YES | LOW — React file is hero's carousel sub-component, not separately registered; Liquid renders `<a><span>` per slide, no images/autoplay logic (bundle:803-823) |
| 4 | brand-marquee.tsx | commerce.brand-marquee | brand-marquee | YES | PARTIAL — static name list both sides |
| 5 | category-grid.tsx | commerce.category-grid | category-grid | YES | PARTIAL — Liquid blocks are static name/slug/tagline (bundle:2013-2064) |
| 6 | contact-form.tsx | core.contact-form | contact-form | YES | PARTIAL — Liquid posts to `/contact`, no email/address settings (bundle:836-851) |
| 7 | cta-section.tsx | core.cta | cta-section | YES | PARTIAL — no `style` variant setting (React schema renderer-registry:145-156) |
| 8 | experience-timeline.tsx | core.experience-timeline | experience-timeline | YES | PARTIAL |
| 9 | featured-products.tsx | core.featured-products | featured-products | YES | **NO** — React binds live `data.products` (renderer-registry:254-260); Liquid iterates static product-card blocks with hard-coded title/price/url (bundle:2065-2133) |
| 10 | hero.tsx | core.hero | hero-banner | YES | **NO** — React: 8 schema fields + multi-banner carousel + overlay/height/align (theme-registry:82-111, hero.tsx:61-70); Liquid: 5 text/url settings, no image (bundle:1950-2012) |
| 11 | marquee.tsx | frozen.marquee | marquee | YES | N/A — React file is dead (no importers); Liquid renders one `<p>` (bundle:885-894) |
| 12 | newsletter.tsx | core.newsletter | newsletter-signup | YES | PARTIAL — Liquid posts to `/contact` (bundle:2255-2305) |
| 13 | portfolio-grid.tsx | core.portfolio-grid | portfolio-grid | YES | PARTIAL — no masonry/columns settings |
| 14 | product-detail-section.tsx | core.product-detail | product-detail | YES | **NO** — Liquid uses `{{ product.* }}` + add-to-cart island (bundle:911-926) but no gallery/variants/quantity/buy-now (React schema renderer-registry:67-78); and no product template routes to it (§5) |
| 15 | product-grid.tsx | core.product-grid | product-grid | YES | **NO** — same static-blocks issue as #9 (bundle:2134-2195); React has 11+ settings + sort + catalog binding |
| 16 | rich-content-section.tsx | core.rich-content | rich-content | YES | PARTIAL |
| 17 | services-grid.tsx | core.services-grid | services-grid | YES | PARTIAL |
| 18 | skills-section.tsx | core.skills | skills-section | YES | PARTIAL — Liquid ignores `level` bars layout |
| 19 | testimonials.tsx | core.testimonials | testimonials | YES | PARTIAL — no carousel/autoplay/rating settings |
| 20 | trust-badges.tsx | commerce.trust-badges | trust-badges | YES | PARTIAL |
| — | layout/dynamic-header.tsx | core.header | **NONE** | **NO** | Header (nav/search/cart/account) has no Liquid counterpart; Liquid plan empties header group (template-resolver:213-216) |
| — | layout/dynamic-footer.tsx | core.footer | **NONE** | **NO** | Same |

**Score: 20/20 frozen files type-mapped (100%); 20/22 of the registered React renderer surface (90.9%); functional/settings parity proven for ~0 of the commerce-data-bound sections.**

### 4.2 Capability parity rows

| Capability | React | Liquid | Parity? | Evidence |
|---|---|---|---|---|
| Editor integration | Full (sections/blocks/settings forms, undo/redo, versions) | **None** (0 `liquid` matches in merchant-control-plane src) | NO | editor page.tsx:67-111; grep |
| Editor preview | Per-section frames | Single opaque HTML blob; `editorMode` only sets a data attribute | NO | composition-engine.tsx:45-55 vs 79-89 |
| Preview tokens | Yes (both engines share route) | Yes — same `resolveStorefrontTemplate` path | YES (incidental) | store/[subdomain]/page.tsx:35-49 |
| Publishing | Draft→publish RPC, releases | Upload-only via `POST /v1/themes/packages/upload` (themes.ts:604); release manifest embeds liquidBundle + `renderer_engine:'liquid'` if present | PARTIAL | theme-execution.adapter.ts:178-182, 595-642 |
| Theme settings | Settings schema + CSS variables in layout | settings_data merged into scope; CSS-var layer still React layout's | PARTIAL | layout.tsx:106-160; theme-renderer.ts:448-451 |
| Snippets/partials | n/a (React components compose) | **Banned** (`{% render %}`/`{% include %}` forbidden) | NO (by design) | theme-bundle.ts:101-109 |
| Asset pipeline | Next.js assets | Manifest only (`renderer.assets`), `asset_url` rewrites to `/assets/...`; no storage/serving path found | NO | theme-bundle.ts:209-215; theme-renderer.ts:568-575 |
| SEO/head control | Next metadata + JSON-LD | `theme.liquid` layout + header embeds rendered, then **layoutHtml discarded** — only `contentForLayout` is injected | NO | composition-engine.tsx:352 (`return result.liquid.contentForLayout`) |
| App embeds | App blocks injected into React sections | Header/footer embeds sanitized + section `@app` slots; **header embeds lost at runtime** (live only inside discarded layoutHtml) | PARTIAL | theme-renderer.ts:216-217, 271-280; composition-engine.tsx:157-216, 352 |
| Localization | localizeThemeTemplateConfig on store config | Bundle `locales` + `t:` resolution; fixtures `en`-only | PARTIAL | theme-bundle.ts:536-656 |
| Performance/SSR/caching | ISR `revalidate=60/30`, cacheTags both paths | Same route caching; LiquidJS `cache:false`, parse on every render; limits 250ms/2MB | PARTIAL | page.tsx:10; template-resolver.ts:221-227; theme-renderer.ts:310-332 |
| Multi-template routing (product/collection/cart/page) | Yes — per-route templates + fallback sections | **Only `index`** exists in the only bundle; non-index routes fall back to index template | NO | theme-bundle.ts:1737-1899; template-resolver.ts:127-137 |
| Site-type gating | Yes (store vs portfolio) | None | NO | renderer-registry.tsx:233-259 |

---

## 5. Runtime Routing Truth (working tree)

**Which renderer serves a request today: React/JSON-contract, for every store, unless a per-store canary boolean is hand-set in the DB.**

Decision chain (all working tree):
1. Page/layout → `resolveStorefrontTemplate(store, route)` (`store/[subdomain]/page.tsx:45-49`, `layout.tsx:107-111`).
2. `template-resolver.ts:198-201`: `liquidEnabled = options.liquidEnabled ?? resolveThemeLiquidRenderingEnabled({ templateConfig, defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED })` — default constant **false** (`theme-governance.ts:14`).
3. `resolveThemeLiquidRenderingEnabled` (governance.ts:144-168) checks, in order: `templateConfig.liquidRenderingCanary`, `themeSettings.liquidRenderingCanary|liquid_rendering_canary`, `releaseManifest.liquidRenderingCanary|liquid_rendering_canary|liquidCanary|liquid_canary`, `rendererManifest.*` — accepts boolean/string/`{enabled:...}` forms.
4. If enabled, `resolveLiquidBundle` (template-resolver.ts:110-125) Zod-parses `templateConfig.liquidBundle` → `releaseManifest.liquidBundle` → `.themeBundle` → `.bundle`. Only on success: `rendererEngine: 'liquid'` plan with **empty header/footer groups** (lines 207-228).
5. `StorefrontCompositionEngine` (composition-engine.tsx:355-387): Liquid plan → server-renders via `createThemeRenderer('liquid')` and injects `result.liquid.contentForLayout` via `dangerouslySetInnerHTML` + hydration islands; otherwise React `RenderSectionList`. **`layoutHtml` (the full Liquid document incl. `content_for_header` embeds) is never used by the storefront route** (line 352).
6. Store model source: `store-service.ts:653-657, 705-706` maps `templateConfig.liquidBundle` and a strictly-boolean `liquidRenderingCanary` from the store's template_config/release JSONB.

Canary/flip seams:
- **Platform-wide flip is recorded as DEFERRED** in code: `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = { status:'deferred', authority:'ARB', reason:'…per-theme canary only until render-parity, security, SSTI/XSS, and performance evidence is green.', defaultEnabled:false }` (governance.ts:16-21). The `theme-governance-validator.mjs:58-63` hard-fails if the default flips ON or the deferred record disappears.
- **No setter exists**: repo-wide grep for `liquidRenderingCanary|liquid_canary|liquidCanary` finds only the read paths above + tests. No API route, no editor UI, no SQL.
- Gateway env flag `FEATURE_LIQUID` exists (`featureFlags.ts:4`; wrangler.toml: dev/staging `"true"`, production `"false"` line 245; asserted by `tests/feature-flags/gateway-feature-gates.test.mjs:16`) but **no `featureGate('FEATURE_LIQUID', …)` exists** — only GRAPHQL/EXTENSIONS gates are constructed (api-gateway/src/index.ts:653-662). The flag is currently decorative.
- Route/template fallback hazard: `resolveLiquidTemplateKey` (template-resolver.ts:127-137) falls back to `index` when the requested template (e.g. `product`) is absent — with the only bundle having `index` only, **product/cart/shop pages on a Liquid-canary store render the home template** (product route confirmed: `product/[productId]/page.tsx:43-49` passes `type:'product'`).

HEAD state: same default-OFF constant existed (`HEAD:theme-governance.ts` has `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`) but no parity table, no flip record; HEAD renderer lacks auto-escape and uses the regex sanitizer. The canary plumbing in `template-resolver.ts`/`store-service.ts` is modified-uncommitted.

---

## 6. Sanitizer / Security Truth

- **Working tree**: defense-in-depth = LiquidJS auto-escape (`outputEscape:'escape'`, renderer:328) → DOMPurify per-section/per-block (renderer:266, 419) and whole-document for layout (renderer:283) and head-mode for header embeds (renderer:216) → upload-time source bans (`<script`, include/layout/render, js: URLs — theme-bundle.ts:101-109) → drop sanitization (depth/keys/blocklist, renderer:472-532) → template_config JSON safety validation (`isUnsafeThemeKey` incl. `dangerouslysetinnerhtml`, `on*`; `validateSafeThemeJson` — index.ts:252-303).
- **HEAD**: regex-only output sanitizer (3 `.replace()` chains), no auto-escape. The D7 security upgrade is real but **deployable only after commit** — at HEAD the weaker sanitizer ships.
- `{{ block.content | raw }}` / `{{ content_for_layout | raw }}` patterns are safe-by-construction because block HTML and embeds are pre-sanitized before insertion (renderer:419, 593-594, 540-545) — and behaviorally asserted in `theme-engine.test.ts:266-327`.
- Residual notes: `ADD_TAGS` includes `iframe` (with `sandbox` attr allowed; app-block iframes get `sandbox="allow-forms allow-popups allow-scripts allow-same-origin"` — composition-engine.tsx:108-110, which neuters the sandbox same-origin protection for the embedded app origin — pre-existing app-blocks pattern, same in React path). `FORBID_ATTR: ['style']` blocks inline styles in Liquid themes entirely (a parity limitation for theme authors as much as a security control).
- One real behavioral test gap: package tests could not be executed in this sandbox (esbuild platform mismatch, §1 Method); D7-VERIFY (EXECUTION_LEDGER.md:33) claims they were run by the implementer. UNVERIFIED-BY-EXECUTION in this audit.

---

## 7. Editor & Publishing Truth

### 7.1 Editors edit JSON/React themes ONLY — no Liquid anywhere

- **Web** (`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`): editor state is `{ themeSettings, sections: { header, footer, template[] } }` (lines 67-74); schema-driven forms (`SchemaFormRenderer`); uses `getSectionSchemas`/`getThemeSettingsSchema` static fallbacks (lines 36-41). Grep `liquid` in `apps/merchant-control-plane/src` → **0 matches**. No code/file editor of any kind. (Schema plumbing could in principle render `liquid.section.*` settings forms if a Liquid theme were installed — `buildLiquidRuntimeSectionSchemas` exists — but no install path puts one in front of a merchant.)
- **Mobile Flutter** (`apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart`): edits `templateConfig`/`themeSettings` via `ThemeEditorPayload` (`packages/dart/models/lib/src/merchant_app/theme_editor_models.dart:67`). Grep `liquid` in `apps/mobile/merchant-app/lib` and `packages/mobile` → **0 matches**.
- Legacy editor archived at `docs/archive/legacy-theme-editor/` (historical only).

### 7.2 Publishing flow

- Editor draft/publish: `PUT /themes/:slug/editor/draft` + `POST /themes/:slug/publish` (api-gateway routes/themes.ts:494, 533) → `publish_theme_release` RPC → `theme_releases` (all-JSONB; no liquid columns — database/supabase/migrations/000_baseline.sql:12838-12867).
- Liquid entry point: `POST /themes/packages/upload` accepts the union `PortableThemePackageBundleSchema` (JSON-contract | Liquid) (themes.ts:604; theme-bundle.ts:504-514); persistence via `buildLiquidThemePackagePersistencePayload` (theme-bundle.ts:1266-1349) embeds the full bundle into `package_manifest` with `liquid_ready: true` and `liquid.section.*` approved renderer keys.
- On publish, `buildReleaseArtifacts` (theme-execution.adapter.ts:595-642) sets `renderer_engine: 'liquid'` and embeds `liquidBundle`/`themeBundle` in `release_manifest` **iff `releaseConfig.liquidBundle` parses** (resolveLiquidBundleArtifact, lines 178-182).
- **Seam inconsistency**: drafts/publishes validate template_config via `collectThemeTemplateValidationIssues` (adapter:246-260), which caps any string at **5,000 chars** and the whole config at 256 KB (index.ts:300-302, 707-710) — while the Liquid bundle schema allows **200 KB per source file** (theme-bundle.ts:56). A non-trivial Liquid theme carried inside template_config would be rejected by the draft/publish path; only the package-upload path tolerates real-size sources. No end-to-end install→release→render path for a Liquid theme was found wired for merchants.
- `urban-kicks-liquid` appears **only** in `theme-bundle.ts` and tests (repo-wide grep) — not in any SQL seed or catalog.

### 7.3 D7 ledger row vs reality

`EXECUTION_LEDGER.md:32` claims are TRUE in the working tree with two precision issues: (a) everything is **uncommitted**; (b) "kept the React renderer frozen through the **existing** no-new-sections ratchet" — `scripts/validators/no-new-react-sections-validator.mjs` is **untracked/new** (git `??`), registered in `scripts/validate-governance.mjs:96` (also working-tree). At HEAD there is no React-freeze validator.

---

## 8. Theme Marketplace State

- `apps/theme-marketplace` is a complete Next.js app still in-tree (themes browse/detail/checkout/dashboard/developer listing/upload panel, own `/api/themes` routes, `theme-catalog.ts`). Frozen per root CLAUDE.md ("frozen or pending consolidation, not production deploy targets").
- **No live code coupling found**: no imports of/from `theme-marketplace` in `apps/`, `services/`, `packages/` (grep) and no mention in root `vercel.json`/workflows. Marketplace *types and Zod schemas* (ThemePurchase, ThemeReview, ThemeDownloadPlatformSchema incl. `'wordpress'|'html'|'react'` platforms, pricing fields) still live in the active `packages/theme-engine/src/index.ts:924-1231` — shared-contract residue, not runtime coupling.
- DB residue: theme purchase/review/collection tables exist in the baseline migration; api-gateway still serves `/themes/:slug/reviews`, purchases, downloads (routes/themes.ts:645-994).

---

## 9. Gap List (exact, evidence-backed)

1. **Header/footer have no Liquid counterpart**; Liquid plan empties both groups → canaried store loses all chrome. (template-resolver.ts:213-216; layout.tsx:214-254; parity table omits core.header/core.footer.)
2. **No commerce data binding in first-party Liquid sections** — product-grid/featured-products/category-grid render hard-coded block strings; only product-detail uses `{{ product.* }}`. The drops exist; the sections don't consume `collection.products`. (theme-bundle.ts:1794-1856, 2065-2195 vs renderer-registry.tsx:230-259 + data-binding-engine.)
3. **Single-template bundle**: only `index` in `urban-kicks-liquid`; product/collection/cart/page/blog templates absent → non-index routes render home content under Liquid. (theme-bundle.ts:1737-1899; template-resolver.ts:127-137.)
4. **Server-side cart/customer drops are stubs** (`item_count: 0`, `customer: null`) — real cart only via client islands. (composition-engine.tsx:300-307.)
5. **Liquid head/SEO control is dead at runtime**: layoutHtml + header app embeds rendered then discarded; only `contentForLayout` is injected. (composition-engine.tsx:352; theme-renderer.ts:271-286.)
6. **No canary write path** (no API/UI/SQL sets `liquidRenderingCanary`); `FEATURE_LIQUID` gateway flag is consumed by no gate. (grep; api-gateway/src/index.ts:653-662.)
7. **No merchant-facing Liquid install/edit surface** (web editor and Flutter editor are JSON-only; `urban-kicks-liquid` unseeded). (§7.1; grep for seeds.)
8. **Settings-schema depth mismatch** across nearly all mapped sections (hero 8+carousel vs 5; productGrid 11 vs 3; testimonials layout/autoplay/rating missing; contact email/address missing). (theme-registry.ts:82-127; renderer-registry.tsx:66-188 vs theme-bundle.ts:769-1003.)
9. **Editor preview granularity**: Liquid output is one opaque blob — no per-section frames/selection. (composition-engine.tsx:68-89.)
10. **No partials/snippets, no inline styles, no on-disk .liquid assets, no asset storage/serving pipeline** for Liquid themes. (theme-bundle.ts:101-109; theme-renderer.ts:157; find.)
11. **Template_config 5,000-char string cap vs 200 KB Liquid source cap** — draft/publish path cannot carry realistic Liquid sources. (index.ts:300-302 vs theme-bundle.ts:56.)
12. **Site-type gating** (store vs portfolio/resume null-rendering) exists only in React render functions. (renderer-registry.tsx:233-259.)
13. React-side ghosts (context, not a Liquid gap): 5 of 24 built-in types (announcementBar, collectionFilter, instagramFeed, faqAccordion, videoHero) have no React renderer; default template ships an announcementBar that renders a fallback box. Liquid has announcement-bar — coverage is asymmetric in both directions. (built-in-section-schemas.ts:3-28; grep; theme-registry.ts:625-633.)
14. **Everything D7 is uncommitted** — at HEAD the platform still has the regex sanitizer, no auto-escape, no parity table, no freeze validator. (git status; git show HEAD.)

---

## 10. Deletion-Readiness Verdict — React renderer

**NOT-READY.** (As the constraint anticipated; this is the evidence-based confirmation, not a default.)

Parity is **proven only at the type-mapping level** (20/20 frozen files ↔ Liquid section types, enforced by `theme-engine.test.ts:232-245` and the validators). It is **explicitly not proven** at:
- surface level — 20/22 of registered React renderers mapped; header/footer (the highest-traffic chrome on every page) have no Liquid equivalent and the Liquid path actively removes them;
- data level — zero Liquid section is bound to the live catalog the way `core.product-grid`/`core.featured-products`/`core.product-detail` are; cart/customer drops are stubs;
- route level — only `index` exists; every other route regresses under Liquid;
- operational level — no merchant can install, edit, preview-per-section, or enable a Liquid theme; the canary has no write path; the one Liquid theme is a test fixture;
- visual/settings level — mapped Liquid sections implement a fraction of the React settings schemas and none of the motion/carousel/layout variants.

The platform's own code agrees: `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` pending "render-parity, security, SSTI/XSS, and performance evidence" (theme-governance.ts:16-21), and `theme-governance-validator.mjs:58-63` hard-fails any attempt to flip the default. Deleting the React renderer today would blank every storefront. The exact remaining work, discovered (named only, per discovery-only mandate): Liquid header/footer sections + section-group routing; commerce-drop-driven product/collection sections; product/collection/cart/page templates in the first-party bundle; real cart/customer drops; layoutHtml/head adoption or an explicit decision to keep Next-controlled head; a canary write path + merchant install/edit surface; per-section Liquid editor preview; settings-schema parity per section; asset pipeline; then commit + deploy of D7 itself.

---

## 11. Unknowns / UNVERIFIED

- **Behavioral test execution** (`packages/theme-engine/test/theme-engine.test.ts`, `tests/contracts/liquid-commerce-embeds.test.ts`): not executable in the audit sandbox (esbuild darwin-arm64 binaries under Linux). Test source read and quoted; D7-VERIFY claims they pass. UNVERIFIED-BY-EXECUTION here. The 8 plain-node `tests/theme-engine/*.mjs` assertions executed: PASS — but note 7 of those 8 files are **source-text regex assertions**, not behavior.
- **Live/deployed state**: per the repo's own forensic memory, working-tree changes are undeployed; whether ANY production store row carries `liquidRenderingCanary: true` or a `liquidBundle` in JSONB is a database question — no seed or setter exists in the repo, so presumed none. UNVERIFIED against live DB.
- Whether `apps/theme-marketplace` is deployed anywhere live (it has its own `vercel.json`) — not determinable from the repo; code-level coupling to active runtimes: none found.
- `tests/theme-engine/` directory-mode `node --test tests/theme-engine/` produced 1 failure artifact while explicit file invocation passed 8/8 — likely a directory-glob/runner artifact (other non-theme `.mjs` in path or runner default); explicit-file results are authoritative for the two D7 test files. The remaining 5 theme `.mjs` test files were inventoried (liquid-bundle-contract, liquid-hydration-islands, liquid-lifecycle-contract, storefront-liquid-runtime, theme-template-editor) but not individually executed.
- The exact reason `marquee.tsx`/`banner-carousel.tsx` are in the parity table but not in the renderer registry (intentional "frozen.*" placeholders vs oversight) — inferred intentional from `frozen.` key prefix; UNVERIFIED intent.
