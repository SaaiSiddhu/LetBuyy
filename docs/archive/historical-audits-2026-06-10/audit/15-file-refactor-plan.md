# 15 — File-by-File Refactor Plan (Deliverables 15 & 19)

Exact files to refactor, what changes, and when (phase = doc 14). Deletions live in doc 05; new services in doc 18. Grouped by runtime. "Split" = file decomposed; "Rewrite" = same path, new internals; "Extend" = additive.

---

## 1. packages/theme-engine (stream A)

| File | Action | Phase | Change |
|---|---|---|---|
| `src/theme-renderer.ts` | Extend→Split | 2–3 | LiquidRenderer v2: layout rendering, snippets/`{% render %}`, tags (`section(s)`, style/javascript/paginate/form), error-isolation per section, parsed-LRU. Split into `renderer/{engine.ts,tags/*,filters/*,drops/*}`. `JsonContractThemeRenderer` frozen P3, deleted P7 |
| `src/theme-bundle.ts` | Extend | 2–3 | add `snippets/`, `assets/` paths + schemas; unblock `{% render %}` in forbidden list (P3); `theme.json` manifest schema (P5); fixtures relocate to `__fixtures__/` (P3) |
| `src/theme-registry.ts` | Extend | 3 | `data_requirements` in `SectionSchema`; new field types (font_picker/product/collection/page/blog/link_list/video_url/liquid); flat `ThemeSettings`→settings_schema bridge (deprecate flat type P7) |
| `src/index.ts` | Extend | 2–7 | export resolver/renderer v2 APIs; deprecate then remove flat-settings + json-contract exports (P7) |
| `src/execution-runtime.ts` | Extend | 2–3 | `ThemeHydrationManifest` emitter; render telemetry hooks |
| NEW `src/runtime/resolver.ts` | Build | 2 | ThemeResolver (store→release→bundle, preview branch, KV cache iface) |
| NEW `src/migrate/json-contract-converter.ts` | Build | 3 | legacy config→liquid bundle; per-section mapping table §3 |
| NEW `src/validate/theme-check.ts` | Build | 5 | letbuyy-theme-check (doc 09 §3) |
| NEW `__tests__/conformance/**` | Build | 3 | golden renders, fuzz, perf budget |

## 2. apps/storefront-runtime (stream A)

| File | Action | Phase | Change |
|---|---|---|---|
| `src/proxy.ts` | Keep | — | none (verified clean) |
| `src/app/store/[subdomain]/page.tsx` + `[...path]/page.tsx` + per-type pages (`product/[productId]`, `products`, `shop`, `blog/[slug]`, `cart`) | Rewrite→Merge | 2 | single catch-all `[[...path]]` route → route→template map; per-type pages become template keys; account/checkout/legal pages keep own routes |
| `src/app/store/[subdomain]/layout.tsx` | Rewrite | 2 | drop inline CSS-var block (L124–205) + React shell; emit theme `<link theme-settings.css>`; providers shrink to islands scope |
| `src/lib/store-service.ts` | Split | 2–7 | → `tenant-client.ts` (store/release fetch, cache tags — keep) ; delete urban-kicks fallback + demo check + `normalizeSectionType` (P7); tri-shape normalizer dies with converter |
| `src/lib/theme-engine/template-resolver.ts` | Rewrite | 2 | thin wrapper over pkg ThemeResolver; all template keys |
| `src/lib/theme-engine/data-binding-engine.ts` | Rewrite | 3 | generic `data_requirements` fulfillment via runtime-composition; delete `PRODUCT_SECTION_TYPES` |
| `src/lib/theme-engine/composition-engine.tsx` | Rewrite | 2–3 | liquid-only path + hydration manifest; json branch behind legacy flag until P7 |
| `src/lib/theme-engine/renderer-registry.tsx` + `src/components/sections/*` (20) | Freeze→Delete | 3→7 | parity-mapped (§3), then removed |
| `src/components/layout/dynamic-header.tsx`, `dynamic-footer.tsx` | Port→Delete | 2→7 | logic ported into default-theme `sections/header.liquid`/`footer.liquid` + islands |
| `src/components/sections/app-block-slot.tsx` | Extend | 6 | restricted-drop inline mode, SRI iframe mode per doc 10 §4 |
| `src/app/preview/**` | Extend | 4 | canvas listener: SECTION_CLICKED/HOVERED, REPLACE_SECTION swap + island re-hydrate |
| `src/app/api/customer/**`, `api/orders/{check,login,set-password}` (10) | Rewrite→Delete | 7 | thin cookie adapter onto `/v1/storefront/customer/*`, then remove |
| `src/app/api/seed/route.ts` | Delete | 1 | doc 05 |
| `CheckoutExtensionHost.tsx` | Extend | 6 | all 4 checkout targets + bridge RPC |

## 3. Legacy section → Liquid parity map (converter spec, P3)

| React component (delete P7) | Target liquid section | Notes |
|---|---|---|
| hero.tsx | `hero-banner.liquid` | exists in urban-kicks fixture |
| product-grid.tsx | `product-grid.liquid` | data_req `products_by_collection` |
| featured-products.tsx | `featured-products.liquid` | `products_by_ids` |
| category-grid.tsx | `category-grid.liquid` | `collections` |
| testimonials.tsx / about-section.tsx / newsletter.tsx / cta-section.tsx / trust-badges.tsx / brand-marquee.tsx / marquee.tsx / banner-carousel.tsx / rich-content-section.tsx / services-grid.tsx / contact-form.tsx | same-name `.liquid` | settings-only (no data_req) except contact-form → `{% form 'contact' %}` |
| portfolio-grid.tsx / skills-section.tsx / experience-timeline.tsx | site-type sections in `letbuyy-portfolio` theme | segregation per V-32 |
| product-detail-section.tsx | `templates/product.json` main section | route resource |
| app-block-slot.tsx | `@app` host (stays as island host) | doc 10 |

## 4. apps/merchant-control-plane (stream B)

| File | Action | Phase |
|---|---|---|
| `[store]/online-store/themes/[themeId]/editor/page.tsx` (2,067 ln) | Split per doc 08 §8 (`state/ panels/ canvas/ fields/ modals/`) | 4 |
| `src/components/theme-editor/SchemaFormRenderer.tsx` | Move→`editor/fields/` + new field widgets/pickers | 4 |
| `src/app/api/themes/**` BFF routes | Extend (patches, preview-render, diff, schedule, export/import/duplicate/upgrade proxies) | 4–5 |
| `[store]/appearance/page.tsx` | Migrate settings into theme settings → delete | 4 |
| `[store]/apps/**` | Extend: scopes UI, extension/embeds toggles, activity | 6 |
| `[store]/ats-score/page.tsx` (StubPage) + vertical pages | Segregate under SiteType nav config | backlog (V-32) |
| `package.json` | drop extension-host (P1) → re-add when admin mounts land (P6) | 1/6 |

## 5. services/api-gateway (stream C)

| File/Area | Action | Phase |
|---|---|---|
| `src/routes/storefront.ts` | **Fix `isInternalRequest` L1376–1378 fail-closed**; by-email (L3387) /status hardening; customer module becomes sole auth path (cookie-adapter endpoints) | 1→7 |
| `src/routes/themes*.ts` | Extend: draft patches, preview-render, diff, schedule, export/import/duplicate/upgrade, packages submit/validate/sign | 3–5 |
| `src/routes/app-store.ts` (+NEW `app-oauth.ts`, `extensions.ts`) | OAuth/PKCE, scoped tokens, registry CRUD, embeds toggles, compliance enforcement | 6 |
| `src/middleware/*` | idempotency broadened; appTokenAuth; error envelope unification; console JWT | 1–6 |
| `src/routes/orders.ts` + payments | tenancy assert (pre-080); later extraction proxy → checkout-runtime | 1→8/9 |
| route Zod schemas | site_id canonical, store_id deprecated alias + sunset header | 1–7 |
| `__tests__/**` (source-regex) | Replace with contract tests (OpenAPI) + real handler tests | 3+ |
| `src/index.ts` | mount v2 GraphQL persisted-queries; no new domain routers rule | 3 |

## 6. Other runtimes

| File | Action | Phase |
|---|---|---|
| `packages/runtime-composition/storefront-query-layer/index.ts` | Extend: DataRequirementResolver kinds (menu via navigation_menus, blog, cart_summary, search, policies) | 3 |
| `packages/extension-host/src/index.ts` | Absorb storefront targets + embed targets; registry types | 6 |
| `packages/app-engine/src/index.ts` | keep manifest side; OAuth/client fields; embed manifest entries | 6 |
| `packages/shared-types` | API error envelope type; sunset/deprecation header consts | 1 |
| `apps/identity-platform/src/lib/db/schema.sql` | Delete (CI guard added) | 1 |
| `apps/theme-marketplace/src/**` | consumer-only polish (changelog, demo links, badges); dev area moves to developer-portal | 5/8 |
| `apps/developer-portal/src/lib/reference.ts` | Replace with OpenAPI-generated reference; dashboard panels wired | 8 |
| `apps/platform-console` | review queues UI (themes/apps), compliance health board, JWT auth swap | 5–6 |
| `packages/dart/api_client` | regenerate from OpenAPI; gateway-session bridge (status docs' admitted gap) | 8 |
| `.github/workflows/*` | single prod pipeline; staging gains migration-verification + contract tests + non-skippable smoke | 0→9 |
| `scripts/validators/**` | retire ~60% manifest-asserts → `topology-lint.mjs` (import/alias/manifest-presence/migration-safety/env kept) | 9 |
| `turbo.json` | drop stale NEXT_PUBLIC_SUPABASE_* inputs | 0 |
| `load/k6/black-friday-commerce.js` | real commerce flow (browse→cart→checkout w/ test PSP) + thresholds enforced | 9 |
| `tests/e2e/*.spec.ts` | remove `test.skip` reachability bypass on the ONE designated smoke spec; runs against staging as hard gate | 9 |

## 7. Counts

Refactor: ~70 named files/areas above. Delete (doc 05): ~140 files D0–D1 + ~35 D3. New builds: ~30 modules (docs 06–10, 18). Every Phase-7 deletion has its replacement named in §§1–2 — enforcement: PR template requires linking the deletion task ID.
