# 03 — Shopify Gap Analysis & Compatibility Report (Phase 2)

Benchmark: **Shopify Online Store 2.0** (sections-everywhere JSON templates, Liquid runtime, theme app extensions/app blocks, theme editor, theme store). Every violation lists paths, severity (CRITICAL / HIGH / MEDIUM / LOW), impact, and fix. Scores: 0 = absent, 10 = Shopify-equivalent.

---

## 1. Scoring Matrix (weighted total: 41/100)

| # | Capability area | Weight | Score | Weighted |
|---|---|---|---|---|
| 1 | Liquid rendering engine | 1.5 | 6 | 9.0 |
| 2 | Theme configuration (settings_schema / settings_data) | 1.0 | 7 | 7.0 |
| 3 | JSON templates / sections / blocks / snippets / assets | 1.5 | 6 | 9.0 |
| 4 | Storefront runtime (rendering ownership) | 1.5 | 4 | 6.0 |
| 5 | Theme editor | 1.0 | 5 | 5.0 |
| 6 | Theme versioning / publishing / drafts | 1.0 | 6 | 6.0 |
| 7 | Theme install / duplicate / export / import / update | 1.0 | 3 | 3.0 |
| 8 | Theme marketplace (store, review, distribution) | 0.5 | 3 | 1.5 |
| 9 | App marketplace + app model (OAuth, billing, webhooks) | 0.5 | 3 | 1.5 |
| 10 | Theme extensions / app blocks / app embeds | 1.0 | 4 | 4.0 |
| 11 | Merchant admin | 0.5 | 7 | 3.5 |
| 12 | Store data layer | 1.0 | 5 | 5.0 |
| | **Total (÷1.5)** | 12.0 | | **60.5/147 → 41/100** |

---

## 2. Violations Register

### Area 1 — Liquid Rendering Engine (score 6)

**What exists (genuinely):** `liquidjs@^10.27.0` in `packages/theme-engine/package.json`; `LiquidRenderer` in `packages/theme-engine/src/theme-renderer.ts` with `parseLimit: 300_000`, `renderLimit: 250`, `memoryLimit: 2_000_000`; per-section `parseAndRender`; output sanitization (strips `<script>`, `on*` handlers); scope objects `shop.*`, `request.*`, `settings.*`, `section.*`, `block.*`, `routes.*`; forbidden fragments enforced at bundle validation (`{% include %}`, `{% layout %}`, `{% render %}`, `<script`, `javascript:`); 4 hydration islands (`lb-add-to-cart`, `lb-cart-drawer`, `lb-search`, `lb-variant-picker`) declared in `theme-bundle.ts`.

| ID | Violation | Paths | Sev | Impact | Fix |
|----|-----------|-------|-----|--------|-----|
| V-01 | **Liquid cannot render the layout.** `layout/theme.liquid` is part of the bundle schema but the runtime injects Liquid output only into the React page body; header/footer/shell are React. | `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx` (CSS var injection L124–205); `src/components/layout/dynamic-header.tsx`, `dynamic-footer.tsx`; `packages/theme-engine/src/theme-renderer.ts` | **CRITICAL** | Themes can never change page shell → not OS 2.0; theme devs blocked | Render `layout/theme.liquid` as the document frame with `{{ content_for_header/layout/footer }}` (doc 07 §3) |
| V-02 | `{% render %}` / snippets are **forbidden**, not implemented — Shopify themes rely on snippets pervasively | `packages/theme-engine/src/theme-bundle.ts` (forbidden fragments list) | HIGH | Cannot port real Shopify-style themes; no code reuse inside themes | Implement `snippets/*.liquid` + safe `{% render %}` with cycle/size limits (doc 07 §4) |
| V-03 | Shopify object model coverage is minimal: no `product`, `collection`, `cart`, `customer`, `linklists/menus`, `paginate`, `all_products`; data context = whatever `buildSectionDataPlan` injects | `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts` (`PRODUCT_SECTION_TYPES` = productGrid, featuredProducts only) | **CRITICAL** | Liquid sections beyond hero/marketing content can't be authored | Declarative `data_requirements` in section schema → resolver registry (doc 07 §6) |
| V-04 | Filter library is stock LiquidJS; no `money`, `img_url/image_url`, `asset_url`, `t` (translation), `link_to` etc. | `packages/theme-engine/src/theme-renderer.ts` | HIGH | Real-world theme code won't render | Ship LetBuyy filter pack (doc 07 §5) |
| V-05 | Per-request render is synchronous in the Next.js RSC path with no render-time cache of parsed templates | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` | MEDIUM | CPU cost per request; ISR(60s) masks it | LRU parsed-template cache keyed by release id (doc 07 §8) |

### Area 2 — Theme Configuration System (score 7)

**Exists:** `config/settings_schema.json` + `config/settings_data.json` in both bundle formats; schema-driven `ThemeSettingsSchema` groups/fields with 11 field types (`text, textarea, richtext, color, image, select, toggle, range, number, url, radio`) in `packages/theme-engine/src/theme-registry.ts`; presets in settings_data.

| ID | Violation | Paths | Sev | Impact | Fix |
|----|-----------|-------|-----|--------|-----|
| V-06 | Legacy flat `ThemeSettings` (primaryColor, fontFamily, borderRadius…) coexists with schema-driven settings; storefront consumes the flat one for CSS vars | `packages/theme-engine/src/index.ts`; `storefront-runtime/.../layout.tsx` | HIGH | Two sources of truth for theme settings | Migrate flat fields into settings_schema groups; generate CSS vars from settings_data (doc 06 §4) |
| V-07 | Missing Shopify field types: `font_picker`, `collection`, `product`, `blog`, `page`, `link_list`, `video`, `liquid` | `theme-registry.ts` field union | MEDIUM | Sections can't reference store resources by picker | Add resource-picker field types + editor widgets (docs 07 §7, 08 §6) |
| V-08 | `[store]/appearance` page writes brand settings to `site_settings` JSON **outside** the theme system (banner in file admits "flagship live theme editor work remains in UX7") | `apps/merchant-control-plane/src/app/[store]/appearance/page.tsx` | MEDIUM | Settings drift between two customizers | Fold into theme settings; retire page (doc 15) |

### Area 3 — JSON Templates / Sections / Blocks / Snippets / Assets (score 6)

**Exists:** `templates/*.json` as `{sections: map, order: []}` (Shopify-shaped) validated by `validatePortableTemplates()`; `sections/*.liquid` **must** embed `{% schema %}` (enforced by `ThemeLiquidSectionFileSchema`); reusable `blocks/*.liquid`; `@app` block type (`ThemeLiquidAppBlockSchema`, `type: z.literal('@app')`); section groups w/ roles `header|footer|aside|custom`; 23 built-in section types; complete `urban-kicks-liquid` fixture (`createUrbanKicksLiquidThemeBundleFixture` in `theme-bundle.ts`).

| ID | Violation | Paths | Sev | Impact | Fix |
|----|-----------|-------|-----|--------|-----|
| V-09 | **No snippets/ in bundle format at all** | `LIQUID_THEME_BUNDLE_PATHS` in `theme-bundle.ts` | HIGH | See V-02 | Add `snippets/` path + schema |
| V-10 | **No assets/ pipeline**: no theme CSS/JS asset storage, fingerprinting, or `asset_url`; `theme_assets` table exists but no upload/serve path in code | table in `database/supabase/migrations/000_baseline.sql`; no handler in `services/api-gateway/src/routes/themes*` | HIGH | Themes can't ship their own stylesheets/JS | R2-backed asset store + CDN URLs (docs 07 §9, 18) |
| V-11 | Zero on-disk themes; the only theme is a TypeScript fixture; default theme hardwired as fallback for *every* store | `theme-bundle.ts` fixtures; `storefront-runtime/src/lib/store-service.ts` (`fallbackTemplateConfig = getDefaultStorefrontThemeTemplate(themeId)`) | HIGH | Theme dev workflow impossible; demo bleed into prod | Move fixtures to `themes/` dir + seed pipeline; explicit per-store default (doc 06 §6) |
| V-12 | Dual bundle formats live simultaneously (`2026-05-json-contract` and `2026-06-liquid-sections`) with divergent renderers | `theme-bundle.ts`, `theme-renderer.ts` (`JsonContractThemeRenderer` + `LiquidRenderer`) | HIGH | Every feature ×2; editor/runtime drift | Freeze json-contract; auto-convert on save; remove after migration (doc 14 Phase 3/7) |
| V-13 | Templates limited to `index` + fallback in resolver; product/collection/page/blog/cart/404 JSON templates not route-wired | `storefront-runtime/src/lib/theme-engine/template-resolver.ts` | HIGH | "Sections everywhere" not met — only home is template-driven | Route→template map for all page types (doc 06 §3) |

### Area 4 — Storefront Runtime (score 4) — full forensics in doc 04

| ID | Violation | Paths | Sev |
|----|-----------|-------|-----|
| V-14 | 20 hardcoded React section renderers as default engine | `storefront-runtime/src/lib/theme-engine/renderer-registry.tsx`; `src/components/sections/*` (20 files) | **CRITICAL** |
| V-15 | Hardcoded header/footer/cart-drawer/search/mobile-menu React shell | `src/components/layout/dynamic-header.tsx`, `dynamic-footer.tsx` | **CRITICAL** |
| V-16 | Demo-store special-casing in tenant path (`urban-kicks-demo` hardcoded store; `isUrbanKicksDemoSubdomain()`; 17-entry `normalizeSectionType()` alias map) | `src/lib/demo/urban-kicks-demo.ts`; `src/lib/store-service.ts` L714–742 | MEDIUM |
| V-17 | Customer auth/session implemented twice (cookie sessions in app routes ∥ gateway `/v1/storefront/customer/*`) | `storefront-runtime/src/app/api/customer/*` (10 routes) vs `services/api-gateway/src/routes/storefront.ts` | HIGH |

### Areas 5–6 — Theme Editor (5) & Versioning/Publishing (6)

**Exists:** schema-driven editor (sections tree, add/remove/reorder via buttons, visibility, block CRUD, theme settings, undo/redo 50 states, autosave drafts, publish, releases list, rollback route, device preview 1440/820/390, preview iframe with `postMessage` selection bridge) — all in one file `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (2,067 lines). Release model: `theme_releases` (`release_status published|superseded|rolled_back`, `is_current`, `rollback_of_release_id`, immutable `template_snapshot`).

| ID | Violation | Paths | Sev | Impact | Fix |
|----|-----------|-------|-----|--------|-----|
| V-18 | 2,067-line client monolith; 8 of 9 sibling components orphaned (only `SchemaFormRenderer` imported) | editor `page.tsx`; `src/components/theme-editor/{AddSectionModal,CenterPanel,EditorHeader,IconRail,LeftSidebar,RightSidebar,SectionItem,ThemeSettingsPanel}.tsx` | HIGH | Unmaintainable; editor velocity ~0 | Decompose per doc 08 §8; delete orphans (doc 05) |
| V-19 | No drag-and-drop (up/down buttons only); no in-canvas click-to-select (postMessage sent, storefront listener absent); single template (page selector is a dead label); hardcoded `PREVIEW_PRODUCTS` (8 items) and `REQUIRED_URBAN_KICKS_SECTIONS` | editor `page.tsx` L145–183 | HIGH | Editor UX far below Shopify | Doc 08 §§4–6 |
| V-20 | **Dual draft stores**: `theme_editor_drafts` (legacy, no RLS listed) ∥ `theme_instance_drafts` (+`theme_draft_patches` patch log); `theme_preview_sessions` carries dual pointers (`draft_id` + `theme_instance_draft_id`) — schema comment admits migration-in-progress | `database/supabase/migrations/000_baseline.sql` | HIGH | Split-brain drafts; editor/runtime divergence | Converge on instance-drafts; drop legacy (doc 11 §4) |
| V-21 | No release diffing, no scheduled publish, no theme duplication ("Save as copy") | gateway `themes` routes | MEDIUM | Below Shopify publish workflow | Doc 09 §5 |

### Area 7 — Install / Duplicate / Export / Import / Update (score 3)

**Exists:** install via `client.themes.install(slug)` and private upload `client.themes.uploadPackage(bundle,'private_install')` (`apps/merchant-control-plane/src/app/api/themes/install/route.ts`, mirrored in storefront-runtime); rollback route. **Missing:** export (no route despite portable `PortableThemePackageBundleSchema` designed for it), import UI, duplication, **update/upgrade flow for installed themes** (`theme_instances.instance_status` includes `upgrading` but no code path drives it), version pinning/migrations between theme versions (`theme_migrations` table exists, unused). Severity: **HIGH** (V-22, marketplace lifecycle is acquisition-only). Fix: doc 09 §§4–6.

### Areas 8–9 — Theme Marketplace (3) & App Marketplace (3)

Theme-marketplace app (browse/detail/checkout/dashboard) and app-marketplace app (catalog, developer registration, install) are UI-real but pipeline-absent.

| ID | Violation | Paths | Sev |
|----|-----------|-------|-----|
| V-23 | No theme submission→validation→review→signing→publish pipeline; `theme_packages.status` + `theme_package_versions.release_status` model it but only ops route `POST /operations/marketplace-reviews/:id/decision` exists | `services/api-gateway/src/routes/operations.ts`; theme-marketplace app | HIGH |
| V-24 | No theme signing/integrity (no checksum/signature verify on install) | gateway themes routes | HIGH |
| V-25 | No revenue share/payout model for theme & app developers (`theme_purchases` exists; no developer-payout tables/flows) | `000_baseline.sql` | MEDIUM |
| V-26 | App model lacks OAuth install flow (no client_id/secret/scope grants; installs are direct rows), no app billing API (`app_billing_charges` table unused), no app review pipeline | `packages/app-engine/src/index.ts`; `app_installations` et al. | HIGH |
| V-27 | Mandatory compliance webhooks enumerated (`customers/data_request`, `customers/redact`, `shop/redact` in app-engine) but no enforcement that installed apps register/respond | `packages/app-engine/src/index.ts` (`MANDATORY_COMPLIANCE_WEBHOOK_TOPICS`) | MEDIUM |

### Area 10 — Theme Extensions / App Blocks / App Embeds (score 4)

**Exists:** `appBlockSlot` section + `AppBlockSlot` component (`storefront-runtime/src/components/sections/app-block-slot.tsx`); `StoreService.injectAppBlocksIntoSections()`; Liquid `@app` recognition incl. `app:*` prefixes; iframe/inline render modes; 4 storefront injection targets in app-engine (`storefront.home.after-hero`, `storefront.product.after-form`, `storefront.collection.after-grid`, `storefront.footer.before`); typed admin targets (4) + checkout targets (4) with sandbox policies in `packages/extension-host/src/index.ts`; `app_extension_registrations` + `app_function_registrations` tables (migration 076).

| ID | Violation | Paths | Sev |
|----|-----------|-------|-----|
| V-28 | **No app embeds** (body-wide floating/injected scripts à la Shopify "app embed blocks") — only slot-targeted blocks | extension-host, app-engine | HIGH |
| V-29 | extension-host defines admin+checkout targets but **no storefront targets**, while app-engine defines storefront targets — split-brain extension registries | `packages/extension-host/src/index.ts` vs `packages/app-engine/src/index.ts` | HIGH |
| V-30 | No sandboxed execution for app-provided Liquid/content beyond HTML sanitize; no resource/time quotas per extension; no extension versioning/lifecycle service | doc 10 | HIGH |
| V-31 | App function hooks enumerated (`cart.discount.calculate`, `checkout.shipping.rate`, `checkout.payment.customize`, `checkout.validation.run`) with **no execution runtime** (no Wasm/isolate runner) | `packages/app-engine/src/index.ts` (`LETBUYY_APP_FUNCTION_HOOKS`) | MEDIUM |

### Area 11 — Merchant Admin (score 7)

Strong coverage (61 pages: products incl. variants/options/inventory/transfers/PO/gift cards, orders, customers, coupons, analytics, blog/pages, 14 settings areas, apps). Violations: V-32 non-commerce verticals (resume/portfolio pages: `ats-score` [StubPage], `skills`, `experience`, `certifications`…) interleaved with commerce admin — product-focus dilution, MEDIUM, segregate by `SiteType` (`packages/tenant-core` already defines `store|portfolio|resume|blog|landing`); V-33 `fix_markdown.py` + empty `codex-theme-editor-empty-proof` dirs as hygiene debt, LOW (doc 05).

### Area 12 — Store Data Layer (score 5)

233 tables w/ good domain spread; theme model (packages→versions→instances→drafts→releases) is genuinely Shopify-grade in shape. Violations (detail doc 11): V-34 nullable `store_id` on `products`/`orders`, missing FK `products.store_id→sites(id)` — **CRITICAL**; V-35 dual tenant columns `store_id`+`site_id`, HIGH; V-36 missing indexes (`orders(store_id,status,created_at)`, `orders.customer_email`, `products(store_id,status)`, `products.slug` unique-per-store, `carts.customer_id` FK), HIGH; V-37 duplicate identity schema `apps/identity-platform/src/lib/db/schema.sql` w/ `USING(true)` RLS, HIGH; V-38 no down-migrations; baseline non-idempotent, MEDIUM; V-39 `themes` table hard-delete only (no `deleted_at`), LOW.

---

## 3. Severity Rollup

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 5 | V-01, V-03, V-14, V-15, V-34 |
| HIGH | 19 | V-02, V-04, V-06, V-09–V-13, V-17–V-20, V-22–V-24, V-26, V-28–V-30, V-35–V-37 |
| MEDIUM | 9 | V-05, V-07, V-08, V-16, V-21, V-25, V-27, V-31, V-32, V-38 |
| LOW | 2 | V-33, V-39 |

**Gate to claim "Shopify OS 2.0 architecture":** clear all 5 CRITICALs + V-12/V-13/V-20/V-22 — that is the Phase 2–7 backbone of doc 14.
