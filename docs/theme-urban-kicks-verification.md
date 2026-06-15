# Urban Kicks End-to-End Verification — Phase 2

> Mission Phase 2 deliverable. **Evidence-only**; cites `file:line`, real test output, and the generated bundle. No new engine/format. Reuses `packages/theme-engine`, `apps/storefront-runtime`, the existing bundle + parity tooling.

## Verdict

**NOT rendering correctly end-to-end yet.** Capability is strong (bundle valid + broad, 56/56 unit tests green); the **integration wiring is incomplete** — a HIGH-severity chrome double-render defect and 9 of 12 bundle templates have no themed route. Fix the chrome composition before any store is canary-rendered.

## 1. The chain — theme source → rendered storefront

| Stage | Artifact | Evidence |
|------|----------|----------|
| Source of truth | `createUrbanKicksLiquidThemeBundleFixture()` | `packages/theme-engine/src/theme-bundle.ts:1806` |
| Build + validate | `build-urban-kicks-bundle.mjs` (parses, re-validates, asserts `renderer.engine === 'liquid'`) | `scripts/liquid-parity/build-urban-kicks-bundle.mjs:35-44` |
| Persist (additive) | migrations `171_liquid_bundle_persistence.sql` (L1 baseline) + `172_liquid_bundle_refresh.sql` (full) — `UPDATE themes SET default_template = … || jsonb_build_object('liquidBundle', …)` | `build-…mjs:62-66` |
| Seed evidence | `database/supabase/seeds/generated/urban-kicks-liquid-bundle.json` (81 KB) + `…-attach.sql`; appended into `seeds/urban-kicks-theme.sql` | generated 2026-06-13 |
| Load | `StoreService.mapSupabaseToStore` reads `templateConfig.liquidBundle` **or falls back to the in-code fixture** | `store-service.ts:670-673` |
| Select | `resolveStorefrontTemplate` → `rendererEngine: 'liquid'` (canary-gated; default now safe) | `template-resolver.ts:223` |
| Render | `renderLiquidPlan` → `createThemeRenderer('liquid').render()` → `layoutHtml` | `composition-engine.tsx:327-368` |

**Bundle facts (from the generated JSON):** slug `urban-kicks-liquid`, `schema_version 2026-06-liquid-sections`, `renderer = { engine: 'liquid', renderer_version: '0.1.0', liquid_ready: true, assets: {} }`, **12 templates**, **33 sections**, 3 blocks, **0 snippets**, **0 assets**, `layout.theme` = a full HTML document.

## 2. Per-surface verification

| Surface | Route file | route `type` → bundle template | Status |
|---------|-----------|--------------------------------|--------|
| Homepage | `app/store/[subdomain]/page.tsx` | `index` → `index` ✓ | resolves; renders Liquid body — **chrome defect (§3.1)** |
| Product | `…/product/[productId]/page.tsx` | `product` → `product` ✓ | resolves |
| Collection | `…/collections/[slug]/page.tsx` | `collection` → `collection` ✓ | resolves |
| Products | `…/products/page.tsx` | `collection` → `collection` ✓ | resolves |
| Shop | `…/shop/page.tsx` | `collection` → `collection` ✓ | resolves |
| Navigation / header | `layout.tsx:214` section group | `header` template | renders **React `DynamicHeader`** (registry falls back via `section.type`→`core.header`) |
| Footer | `layout.tsx:224` section group | `footer` template | **DOUBLE** — React `DynamicFooter` + Liquid `content_for_footer` (§3.1) |
| Cart | *(no route — dir absent)* | `cart` template exists | **unreachable**; cart is client-hydrated via `/api/storefront/{sub}/cart` |
| Search | *(no themed route)* | `search` template exists | **unreachable** |
| Customers ×5 | *(no themed route)* | `customers/{account,login,order,orders,register}` | **unreachable** via theme |

## 3. Missing links (the Phase 2 ask)

### 3.1 HIGH — chrome double-render / full-document injection
- The Liquid `layout.theme.source` is a complete document: `<!doctype html><html><head>… {{ content_for_header }}</head><body><main>{{ content_for_layout }}</main>{{ content_for_footer }}</body></html>`.
- `composition-engine.tsx:81-88` injects that string via `dangerouslySetInnerHTML` into a `<div>` that already lives inside `layout.tsx`'s React `<body>`.
- `layout.tsx:214-253` **unconditionally** renders React header + footer section groups (no `rendererEngine` check). Liquid header/footer sections resolve to `core.header`/`core.footer` (`renderer-registry.tsx:236-240`), i.e. React `DynamicHeader`/`DynamicFooter`.
- **Consequences:** (a) the Liquid `<head>` (title, meta, `content_for_header`) is discarded by the HTML-fragment parser; (b) **footer renders twice** (React `DynamicFooter` + Liquid `content_for_footer`); (c) a nested `<!doctype><html><head>` inside a `<div>` is malformed.
- **Fix direction (no new engine):** `layout.tsx` must branch on `renderPlan.rendererEngine === 'liquid'` and render only `{children}` (let the Liquid document own the chrome) — **or** the renderer/`renderLiquidPlan` emits a body-only fragment when embedded in the React shell. This is a design decision; record it for Phase 8/9.
- **Confidence:** high (code + HTML-spec reasoning). Final DOM confirmation needs a live render (Phase 6, env-bound).

### 3.2 MED — 9 of 12 bundle templates are unreachable
`search`, `cart`, `customers/account|login|order|orders|register` have no themed route calling `resolveStorefrontTemplate`. `cart` route dir confirmed absent. Either add themed routes or trim the bundle to the reachable set (index/product/collection + header/footer) before claiming full coverage.

### 3.3 MED — Liquid head/SEO contributions dropped
Because the injected document's `<head>` is discarded (§3.1), any Liquid-authored `<title>`/meta/`content_for_header` never reaches the DOM. Acceptable **only** if Next `generateMetadata` (`page.tsx:12`, `layout.tsx:38`) fully covers head — verify in Phase 4/8.

### 3.4 LOW — bundle ships 0 snippets / 0 assets
`renderer.assets = {}`, no `snippets`/`assets` keys. Phase 3 will determine whether sections are self-contained (expected) or whether snippet/asset compilation is missing.

### 3.5 LOW — index template ships demo content
`templates.index` section settings hardcode demo products (e.g. "Velocity Runner", "Rs 4,999"). Real data binding is `buildSectionDataPlan`/`liquidContext` — Phase 4.

## 4. What IS verified working (evidence)

- **`pnpm --filter @letbuyy/theme-engine test` → 56/56 pass** (2.3 s): renderer L2–L13 (assets/compiler/chrome/product/collection/search/cart/auth/account/orders/tracking/authoring), DOMPurify sanitizer preserves hydration elements while stripping active content, renderer auto-escapes merchant settings before raw-block HTML.
- Bundle is schema-valid; `renderer.engine === 'liquid'`; **33 sections ≥ 20** parity-required; test 54 confirms parity section files for the 20 frozen React sections.
- Generation chain is runnable standalone (`tsx`); persistence is additive + idempotent.
- Governance test 53 asserts Liquid stays **per-theme canary** with the platform-wide flip **deferred** — consistent with the Phase 1 safe-default fix.

## 5. What could NOT be verified here (honesty)

- A real browser render of a Liquid store (needs a running storefront + a seeded canary store).
- Parity (Phase 6) — the harness is **live-HTTP** (`harness-lib.mjs:80` `fetch(baseUrl/store/sub)`); requires `STAGING_STOREFRONT_BASE_URL` + a React store + a Liquid store. Not runnable here; results will not be fabricated.
- The §3.1 double-footer is confirmed by code+spec reasoning; final DOM confirmation is a live-render step.

## 6. Recommendation

Capability is real and well-tested; the blocker is **integration wiring**, not the engine. Before any canary store renders Liquid: (1) fix §3.1 chrome composition, (2) decide on §3.2 route coverage. Then run Phase 6 parity in staging. Per-theme activation (Phase 9) stays gated on that parity evidence.
