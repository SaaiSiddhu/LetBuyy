# 04 — Storefront Runtime Forensic Analysis (Phase 3)

Subject: `apps/storefront-runtime` (133 source files, ~17,723 TS/TSX LOC, Next.js 16 App Router, Vercel `bom1`).
Question: **Can it survive, or must it be deleted?**

---

## 1. Anatomy

| Layer | Files | Role |
|---|---|---|
| Edge routing | `src/proxy.ts` | Subdomain→path rewrite (`x-store-subdomain` header → `x-forwarded-host` → hostname `*.letbuyy.store` → rewrite `/store/{sub}{path}`); `storefront` subdomain passthrough; sets `lb_theme_preview_{sub}` cookie (15 min, httpOnly) from `theme_preview_token`. No separate `middleware.ts` — proxy.ts is the middleware module. |
| Pages | `src/app/store/[subdomain]/**` (23) | home, `[...path]`, product/[productId], products, shop, blog/[slug], cart, checkout (+success, paypal-return), account/{addresses,orders,settings,wishlist}, orders, 4 legal pages, `/preview` (editor iframe target), `/preview/coming-soon`, `/demo/urban-kicks` redirect |
| Theme pipeline | `src/lib/theme-engine/{template-resolver.ts, data-binding-engine.ts, composition-engine.tsx, renderer-registry.tsx}` + `src/lib/store-service.ts` | Resolve→bind→compose→render (see doc 02 §5 sequence) |
| Section components | `src/components/sections/*` (20 files) | Hardcoded React renderers for json-contract engine |
| Shell | `src/app/store/[subdomain]/layout.tsx`, `src/components/layout/dynamic-header.tsx`, `dynamic-footer.tsx` | React header/footer/cart-drawer/search/mobile-menu + ~40 inline CSS vars |
| Client state | CartProvider, CustomerAuthProvider, WishlistProvider (wrapped in layout for `store`-type sites) | |
| API routes | `src/app/api/**` (21) | customer auth/session/wishlist/orders (10), reviews, coupons/validate, store-lookup, themes (install/list), seed (410 in prod), payments dirs (several **empty**) |

## 2. Dependency & Coupling Census

12 workspace deps: `api-client, app-engine, auth-core, checkout-core, cms-core, commerce-core, extension-host, runtime-composition, shared-types, tenant-core, theme-engine, ui` (+utils). Coupling observations:

- **Healthy:** all data via `createStorefrontApiClient()` → `https://api.letbuyy.store/v1` with Next fetch cache tags (`storefront:{sub}`, `theme:{id}`, `release:{id}`, `template:{id}`, `route:{type}:{id}`), ISR 60s. Zero direct DB. Release-snapshot consumption (`current_theme_release.template_snapshot` preferred over `sites.template_config`) is exactly right.
- **Editor coupling (acceptable, two-way):** `?editor=1` wraps sections in `EditorPreviewSectionFrame` emitting postMessage; editor sends `LETBUYY_THEME_EDITOR_SELECTION` — **no listener implemented storefront-side** (one-way bridge, dead half).
- **Theme ownership violations (the disease):**
  1. Shell outside the theme: header/footer/cart/search/menu are fixed JSX; `layout/theme.liquid` from bundles is never used as the document frame (V-01/V-15).
  2. `renderer-registry.tsx`: 20 section types → static React imports; new section type = code deploy (V-14).
  3. `store-service.ts`: `getDefaultStorefrontThemeTemplate()` (urban-kicks) injected as fallback for **any** store without renderable config; `isUrbanKicksDemoSubdomain()` special-case; `normalizeSectionType()` 17-entry alias map papering over schema drift; demo store object in `src/lib/demo/urban-kicks-demo.ts`.
  4. `data-binding-engine.ts`: only `productGrid`/`featuredProducts` (+`settings.productIds`) fetch data — collections, menus, blog, pages, cart summary all unbound (V-03).
  5. ~40 CSS custom properties + dark-mode math inline in `layout.tsx` L124–205, fed by the *flat* legacy `ThemeSettings`, not `settings_data.json` (V-06).
- **Auth duplication:** 10 `api/customer*`+`api/orders*` cookie-session routes (`LETBUYY_CUSTOMER_SESSION_COOKIE`, HMAC-signed internal headers) functionally parallel to gateway `/v1/storefront/customer/*` (V-17). Both write the same Supabase tables.

## 3. Engine Duality Measured

| Property | json-contract path | liquid path |
|---|---|---|
| Trigger | default | `templateConfig.liquidBundle` or `releaseManifest.liquidBundle` parses via `LiquidThemePackageBundleSchema` |
| Renderer | `renderRegisteredSection()` → React components | `createThemeRenderer('liquid')` → sanitized HTML + `LiquidHydrationIslands` |
| Sections source | DB sections[] / sectionGroups / templates map (3 legacy shapes normalized in `mapSupabaseToStore()`) | bundle `sections/*.liquid` mapped to `rendererKey: liquid.section.{type}` |
| Shell | React shell | **same React shell** (bundle layout ignored) |
| Data | bind-plan (2 types) | same bind-plan |
| Editor | full support | preview renders, but editor edits json-contract config model |

Net: Liquid is correctly *plumbed through the right pipeline* (resolver → composition), which is the strongest possible signal for refactor-over-rewrite.

## 4. Hardcode Inventory (worst offenders)

| File | Issue | Disposition |
|---|---|---|
| `src/components/layout/dynamic-header.tsx` | Full header UX hardcoded; behavior default `'hide-on-scroll'`; fixed logo/nav structure | Rebuild as theme section group rendered by engine (doc 06 §4) |
| `src/components/layout/dynamic-footer.tsx` | Same pattern | Same |
| `src/app/store/[subdomain]/layout.tsx` | CSS var + dark-mode + `--footer-bg` math inline | Replace with settings_data→CSS-var compiler output |
| `src/lib/store-service.ts` | urban-kicks fallback; demo special-case; alias map; tri-shape normalizer | Split: tenant resolution → thin client of gateway; normalizer dies with json-contract |
| `src/lib/demo/urban-kicks-demo.ts` | Whole store hardcoded | Move to seed data |
| `renderer-registry.tsx` + 20 section components | Default engine | Freeze as legacy adapter; delete at Phase 7 cutover |
| `src/app/api/customer/**` (10 routes) | Parallel auth stack | Collapse onto gateway endpoints w/ cookie adapter |
| Empty: `src/types/`, `api/payments/{paypal×3, razorpay×2, stripe×2}/`, `api/customer/request-password-reset/` | Dead scaffolding | Delete (doc 05 §7) |

## 5. What Is Production-Shaped (salvage list)

`proxy.ts` (clean, header-priority resolution, preview cookie); cache-tag strategy + ISR; release-snapshot precedence; preview-token flow (`PreviewTokenSchema` TTL 60–3600s, draft-backed store fetch); checkout UI (Stripe/Razorpay/PayPal return-paths) calling gateway orders; cart/wishlist/customer providers; composition pipeline layering; `EditorPreviewSectionFrame` bridge (needs its other half); hydration-island wiring; legal/account/blog page scaffolds.

## 6. Verdict

**REFACTOR IN PLACE — deletion not justified.** Quantified: ~65% of the app is engine-agnostic plumbing aligned with target architecture; ~35% is the hardcoded shell + react-registry + demo residue + duplicate auth, all of which is *removable behind the existing pipeline seams* without breaking routes. A rewrite would re-create proxy/caching/preview/checkout for zero architectural gain and lose the working editor bridge.

Conditions attached to survival (tracked in doc 14):
1. Phase 2: shell ownership moves to theme layout rendering (kills V-01/V-15).
2. Phase 3: data-binding contract generalized (kills V-03); json-contract frozen → adapter (starts V-12/V-14 retirement).
3. Phase 7: react section components + alias map + urban-kicks fallback deleted; customer-auth routes collapsed (V-16/V-17); only then may `renderer-registry.tsx` be removed.
4. Permanent: storefront-runtime never gains DB access or business logic (AGENTS.md single-gateway rule stays).

Failure mode to avoid: building Liquid v2 *beside* the React engine indefinitely — the repo already demonstrates that dual systems persist (drafts ×2, engines ×2, deploy workflows ×2). Each phase must end with a deletion, not just an addition.
