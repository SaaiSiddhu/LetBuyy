# LIQUID_GAP_ANALYSIS.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · code-cited. Every missing Liquid capability, by build category.

> **Theme:** the *read/render* half is real and complete; nearly every *authoring / seeding / styling / flip* surface is missing. And — corrected from the feasibility report — the *commerce backends* (cart/account/orders) already exist and are engine-agnostic, so most gaps are **template authoring**, not backend.

## GAP 1 — Bundle persistence (no store ships a Liquid bundle)

- **State:** read path complete (`resolveLiquidBundle` `template-resolver.ts:110-125`); the only producer is `buildBundleTemplateConfig` (`schema-registry-execution.adapter.ts:164-187`) via `POST /themes/packages/upload`. urban-kicks is seeded React/`theme-engine-v1` (`database/supabase/seeds/urban-kicks-theme.sql`, no `liquidBundle`).
- **Missing:** a seeded Liquid bundle on `themes.default_template`. **Lever:** if `themes.default_template` carries a `liquidBundle`, install auto-propagates it to `sites.template_config` (`theme-execution.adapter.ts:601-607`). Buildable from `createLiquidParitySectionFiles` (`theme-bundle.ts:769-1156`).
- **Missing files/APIs:** a seed/migration writing the bundle; no `liquid_bundle` DB column (lives in JSON).

## GAP 2 — CSS pipeline (Liquid ships no styling)

- **State:** Liquid layout has **no** `<style>`/`:root`/stylesheet (`theme-bundle.ts:1819-1835`); `renderer.assets` schema supports `stylesheet` (`:209-214`) but fixtures are `{}`; `asset_url` filter returns `/assets/<file>` (`theme-renderer.ts:638`) with **no backend serving it**; DOMPurify strips inline `style` (`:157`) → must be class-based.
- **Good news:** the `lb-*` CSS already exists, fully authored, in `globals.css:554-710` (plain CSS + CSS vars, **not** `@apply`) → ~90% portable by extraction.
- **Missing:** (a) `:root` token block injected into `layout/theme.liquid` (port `layout.tsx:126-160`); (b) the `lb-*` stylesheet extracted to a served asset (+ ~10% new rules for `lb-spotlight`/`lb-badge`); (c) an `/assets/*` serving route (R2/static) + a resolver that injects `<link>` from `renderer.assets`; (d) verify DOMPurify (WHOLE_DOCUMENT) preserves `<style>`/`<link>` in `<head>`.

## GAP 3 — Page templates (only index/header/footer exist)

- **State:** `resolveLiquidTemplateKey` falls back to `index` when a key is absent (`template-resolver.ts:127-137`); schema allows arbitrary keys (`theme-bundle.ts:441`). product/collection sections exist as fixtures; **no `cart`/`customers/*`/`order` section or template fixtures.**
- **Missing templates (authored `.liquid` + `{% schema %}` in the bundle):** `product`, `collection`, `cart`, `customers/account`, `customers/login`, `customers/register`, `customers/order`, `page`, `search`, `404`. cart/customers/order are net-new section authoring.

## GAP 4 — Commerce data binding (drops partially filled)

- **State:** real pipeline (`productToLiquidDrop` `composition-engine.tsx:229`); `product` binds; **`collection` discards real title/desc (`:301-308`), `cart` stubbed `item_count:0` (`:279-287`), `customer:null` (`:323`).** Home index uses hardcoded demo blocks, not `collection.products`.
- **Missing:** populate `collection`/`cart`/`customer` drops server-side (or hydrate client-side via islands + `/api/customer/session`); point home product sections at real `collection.products`; add variant→price recompute to `lb-variant-picker`.

## GAP 5 — Cart integration (backend EXISTS; template missing)

- **Corrected:** full server cart at `services/api-gateway/src/routes/storefront/cart-routes.ts` (POST/GET/PATCH/buyer-identity/discount-codes/checkout-url/DELETE; `carts` table; server re-pricing; cart events). React cart + Liquid islands share `lb_cart`/`lb_cart_token` → **unified state**. Islands proxy `/cart` to it (works).
- **Missing:** a full-page Liquid `cart` template (the drawer island exists); optional server cart-drop injection (read token cookie → GET `/cart/:token`).

## GAP 6 — Account integration (backend EXISTS; templates missing)

- **State:** all `/api/customer/*` BFF endpoints exist and are engine-agnostic (login/session/profile/addresses/wishlist/set-password/orders).
- **Missing:** `customers/*` Liquid templates calling the SAME endpoints; populate the `customer` drop (or client-hydrate from `/api/customer/session`).

## GAP 7 — Order integration (backend EXISTS; templates missing)

- **State:** `/api/customer/orders` + `/api/orders/{check,login,set-password}` exist (logged-in history + guest lookup).
- **Missing:** Liquid order-history + `customers/order` (detail/status) templates over the same APIs.

## GAP 8 — Merchant Liquid authoring (no on-ramp)

- **State:** the editor emits portable JSON only; `editor/route.ts:29-40` accepts a `liquidBundle` but the UI never sends one. **No portable-JSON→Liquid compiler exists** (only the reverse, `buildLiquidRuntimeSectionSchemas`). The sole Liquid on-ramp is *importing* a prebuilt `renderer.engine:'liquid'` package; editing it via the visual editor then **strips the bundle** (engine desync).
- **Missing (largest authoring piece):** a `portableTemplateConfig → LiquidThemePackageBundle` compiler + editor wiring to emit `liquidBundle`(+`liquidRenderingCanary`); or a Liquid code editor. **Deferrable** if V1 ships one fixed default Liquid theme with no merchant Liquid editing.

## GAP 9 — Canary control (read-only flag, no writer)

- **State:** `resolveThemeLiquidRenderingEnabled` reads `liquidRenderingCanary` from JSON (`theme-governance.ts:144-168`); default false; **no DB column, no writer surface, no operator endpoint.** Platform flip ARB-`deferred` (`:16-21`).
- **Missing:** a per-store canary writer (template_config write or a `sites.liquid_rendering_canary` column) + operator endpoint for cohort rollout.

## GAP 10 — Parity validation (0/200, never run)

- **State:** `PARITY_MATRIX.md` 200 cells PENDING; harness `scripts/liquid-parity/run-parity-matrix.mjs` exists but never executed; tests are grep-only (`first-party-liquid-portability.test.mjs` checks file existence, the one real render test asserts only XSS escaping — real data binding untested).
- **Missing:** an executed parity run on staging + real render/island behavioral tests; `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT=20` must be green before the ARB flip.

## GAP 11 — Liquid chrome (CAP-C08)

- **State:** `layout.tsx:214,224` renders **React** header/footer even over Liquid bodies (`theme-governance-validator.mjs:114`).
- **Missing:** Liquid header/footer chrome + switching the layout to it; until then no Liquid page is fully Liquid.

## Severity summary

| Gap | Size | Blocks |
|---|---|---|
| 1 Bundle persistence | S–M (seed) | everything |
| 2 CSS pipeline | M (mostly extraction + serving) | any styled Liquid page |
| 3 Page templates | M–L (cart/customers/order net-new) | product/collection/cart/account/order pages |
| 5/6/7 Cart/account/order | S each (templates only; backends exist) | tail pages |
| 8 Merchant authoring | L (compiler) | merchant-editable Liquid themes (deferrable) |
| 9 Canary control | S | rollout |
| 10 Parity validation | M | ARB flip |
| 11 Chrome | S | full-Liquid pages |
