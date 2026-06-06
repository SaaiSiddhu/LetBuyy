# WEB FEATURE MATRIX — Merchant Control Plane

**App:** `apps/merchant-control-plane` (`@letbuyy/merchant-control-plane`)
**Stack:** Next.js 16.1.6 (App Router), React 19, Tailwind v4, TypeScript; deployed on Vercel (`bom1`).
**Backend:** thin authorizing proxy → `@letbuyy/api-client` → `api.letbuyy.store/v1` gateway. No Supabase client in this app (`src/lib/supabase/` is empty). No realtime/websockets anywhere.
**Purpose of this doc:** define the full parity target for the Flutter merchant app.

> **Architectural fact that shapes everything:** the control plane is **not just a store admin** — it is a **multi-site-type control plane** serving 5 site types (`store`, `portfolio`, `resume`, `landing`, `blog`) under one `[store]` route tree, with site-type-driven navigation (`src/components/merchantNavigation.ts`). The Flutter app targets the **`store`** site type; portfolio/resume/blog/landing surfaces are out of merchant-mobile scope unless explicitly prioritized.

---

## 1. How the web app talks to the backend (infra contract)

| Concern | Implementation | Evidence |
|---|---|---|
| API access | Every `app/api/**/route.ts` is a thin proxy: `resolveOwnedStoreId()` → ownership check → `createMerchantApiClient()` → gateway | `src/lib/api/client.ts`, `src/lib/stores/resolve-owned-store.ts` |
| Session | Cookie `lb_session`; middleware `src/proxy.ts` redirects unauthenticated `/[store]/*` to `accounts.letbuyy.store/lookup` | `src/proxy.ts` |
| Server→gateway auth | HMAC internal session headers via `createLetbuyyInternalSessionHeaders(token, secret)` using `INTERNAL_API_SECRET`/`AUTH_SECRET`; `X-Client: admin-web` | `src/lib/api/client.ts:62-80` |
| Session validation | `getSessionUser()` → gateway `GET /auth/custom/session` | `src/lib/auth/session.ts:11-26` |
| Login/signup/2FA | **Separate app** `apps/identity-platform` (`accounts.letbuyy.store`): login, signup, lookup, onboarding, forgot/reset/set-password | `apps/identity-platform/src/app/**` |
| File upload | Browser → `POST /api/stores/[store]/upload` (multipart) → gateway `POST /upload` (R2) → `POST /media` record | `src/app/api/stores/[store]/upload/route.ts` |
| Realtime | **None** — all request/response, `cache: 'no-store'`; only `postMessage` (theme preview iframe + app bridge) | — |
| i18n | 9 Indian-language admin locales scaffolded (`en-IN` default) but strings hardcoded English; not wired | `src/lib/i18n/admin-locales.ts` |

**Implication for mobile:** the web app's auth pattern depends on a *trusted server* holding `INTERNAL_API_SECRET`. A native app cannot replicate it — hence the mobile session bridge (see API_ALIGNMENT_MATRIX.md / MOBILE_ARCHITECTURE_V2.md).

---

## 2. Full route/screen map (the `store` site type + settings)

`[store]` = store subdomain. App shell `src/components/AdminShell.tsx` = HeaderBar + site-type Sidebar + TrialBanner + ⌘K CommandPalette + AISidebar. Full-screen flows (editor, checkout) bypass the shell.

### Commerce
| URL | File | Status |
|---|---|---|
| `/{store}/dashboard` | `dashboard/page.tsx` (+ `DashboardClient.tsx`) | ✅ Home + onboarding checklist |
| `/{store}/orders` | `orders/page.tsx` | ✅ Strong |
| `/{store}/products` | `products/page.tsx` | ✅ |
| `/{store}/products/new` & `/[productId]` | `products/new/page.tsx` (re-export for edit) | ✅ Strong |
| `/{store}/products/collections` | `products/collections/page.tsx` | 🟠 list+create only |
| `/{store}/products/inventory` | `products/inventory/page.tsx` | ✅ levels + adjust |
| `/{store}/products/gift-cards` | `products/gift-cards/page.tsx` | ✅ list + issue |
| `/{store}/products/purchase-orders` | `products/purchase-orders/page.tsx` | ❌ "not available yet" stub |
| `/{store}/products/transfers` | `products/transfers/page.tsx` | ❌ stub |
| `/{store}/customers` | `customers/page.tsx` | 🟠 list/search only (no detail/CRUD) |
| `/{store}/coupons` | `coupons/page.tsx` | ✅ full CRUD |
| `/{store}/reviews` | `reviews/page.tsx` | ✅ moderation |
| `/{store}/analytics` | `analytics/page.tsx` | 🟠 basic, read-only |

### Online store / theming / CMS
| URL | File | Status |
|---|---|---|
| `/{store}/online-store/themes` | `online-store/themes/page.tsx` | ✅ install/import/publish |
| `/{store}/online-store/themes/[themeId]/editor` | `…/editor/page.tsx` (1,891 LOC) | ✅ Strong (sections/blocks/schema/versions/live preview) |
| `/{store}/online-store/pages` | `online-store/pages/page.tsx` | ✅ pages + policies + menu |
| `/{store}/online-store/preferences` | `online-store/preferences/page.tsx` | ✅ storefront SEO |
| `/{store}/pages` | `pages/page.tsx` | ✅ |
| `/{store}/posts` | `posts/page.tsx` | ✅ blog posts |
| `/{store}/categories` | `categories/page.tsx` | ✅ |
| `/{store}/comments` | `comments/page.tsx` | ✅ blog comments |
| `/{store}/apps` & `/apps/[installationId]` | `apps/**` | ✅ installed apps + embedded App Bridge |
| `/{store}/ai` | `ai/page.tsx` | 🟠 read-only credits; sidebar chat stubbed |

### Settings hub (own layout/shell)
| URL | Status | URL | Status |
|---|---|---|---|
| `settings` (index) | ✅ | `settings/payments` | ✅ Razorpay config |
| `settings/general` | ✅ (+ Delete Store) | `settings/checkout` | ✅ |
| `settings/business` | ❌ needs-backend stub | `settings/shipping` | ✅ zones CRUD |
| `settings/localization` | ❌ needs-backend stub | `settings/taxes` | ✅ GST rates CRUD |
| `settings/plan` | ✅ | `settings/domains` | 🟠 stores string, no DNS/SSL |
| `settings/billing` | ✅ history | `settings/notifications` | ✅ toggles |
| `settings/subscribe/checkout` | ✅ Razorpay | `settings/policies` | ✅ |
| `settings/users` | ✅ staff CRUD | `settings/apps` | ✅ |
| `settings/security` | ❌ needs-backend stub (2FA) | `settings/custom-data` | ❌ needs-backend stub (metafields) |

### Top-level / billing flow
`/` (store redirector), `/stores` (multi-store picker), `/launching-soon`, `/{store}/access_account/checkout/select-plan`.

### Non-store site types (out of merchant-mobile scope)
projects, gallery, skills, experience, education, certifications, testimonials, contact, leads, export (PDF), ats-score, appearance — for portfolio/resume/blog/landing.

---

## 3. Feature inventory by domain (the parity checklist)

Legend: ✅ strong · 🟠 partial · ❌ stub/missing in web · ⚙️ backend supports more than web exposes.

### Store setup / onboarding — 🟠
Dashboard onboarding checklist driven by `GET /api/stores/[store]/dashboard/setup` (computes `productsCount`, `shippingZonesCount`, `pagesCount`; `SetupStatus` flags `themeCustomized`, `domainConfigured`, `paymentConfigured`, `hasShipping`). **Store/account creation is NOT here — it's in `identity-platform/onboarding`.** AISidebar onboarding helper exists but chat is a hardcoded stub calling a nonexistent `/api/store-data`.

### Products — ✅ (strongest domain)
Create/edit form: title, description, **multi-file media upload**, category, pricing (price/compare-at/cost/charge-tax), inventory (track qty, SKU, barcode, sell-when-OOS), shipping (physical, weight+unit, country of origin, HS code), **variant options builder** (Size/Color), SEO (page title/meta/handle + live preview), status, type, vendor, tags. `POST/PATCH /api/stores/[store]/products[/:id]`. **CSV import** `POST …/products/import`. ⚙️ *Caveat:* variants captured as options only; form sends `variants: []` (no per-variant SKU/price matrix client-side).

### Collections — 🟠
List + create (`GET/POST …/collections`). No edit/delete in UI.

### Inventory — 🟠 (web) / ⚙️ (backend is full WMS)
Web: stock table + adjust (`POST …/inventory/adjust`, `GET …/inventory/levels`). Transfers + Purchase Orders are explicit stubs. ⚙️ Backend exposes a **full WMS**: locations, suppliers, purchase-orders (+receive), transfers (+ship/receive), bulk-adjust, history.

### Orders — ✅ / refunds ⚙️
Status tabs (pending→…→refunded), payment-status filter, search, sort, **bulk actions**, inline status transitions, **fulfillment with tracking**, cancel with reason, expandable detail (customer, ship-to, line items, totals). `GET/PATCH …/orders[/:id]`, fulfill via `POST /orders/:id/fulfill`. ⚙️ **Refunds: backend-supported (`POST /orders/:id/refund`) but NO web UI action** — refund is only a status filter. Draft/abandoned views are nav links without dedicated implementation.

### Customers — 🟠
List + saved views + search (`GET …/customers`). **No detail page, no create/edit, no address management.** ⚙️ Backend exposes customer get + address CRUD.

### Domains — 🟠
Read-only primary subdomain + single custom-domain input with static CNAME hint; persists `custom_domain` via settings PATCH. **No DNS verification, SSL status, or connect/disconnect lifecycle.**

### Themes — ✅
Library: list, **install from catalog** (`POST /api/themes/install`), **import package** (JSON bundle), **publish/unpublish**. Marketplace discovery lives in `apps/theme-marketplace`.

### Theme editor / customization — ✅ (Shopify OS 2.0-style)
`online-store/themes/[themeId]/editor` + `src/components/theme-editor/*`: header/footer/template **sections**, **blocks within sections**, **schema-driven settings forms** (`SchemaFormRenderer.tsx`), add-section modal, **drag-reorder** (`PUT …/sections/reorder`), visibility, theme-level settings, 3 panel modes (sections/settings/**versions**). **Live preview** via iframe `postMessage`. **Draft/publish/version lifecycle**: load editor, save/discard draft, preview-session, releases list, **rollback**. Undo/redo (`useEditorHistory`).

### Pages / CMS / content — ✅
Store pages CRUD (`/api/stores/[store]/pages`), navigation menus (read + `PUT …/navigation/[location]`), blog posts CRUD, comment moderation, categories. Portfolio/resume content via generic `/content/[section]`.

### Discounts / promotions — ✅
Coupon CRUD + toggle-active + delete (`/api/stores/[store]/coupons[/:id]`). Gift cards: list + issue. ⚙️ Backend also `POST /coupons/validate`, promotions/promotion_rules tables. No automated-discount/BXGY/campaign builder beyond coupons.

### Analytics / reports — 🟠
Period selector, orders-by-status, monthly revenue (when available), "next best actions". `GET …/analytics` → gateway `/analytics/dashboard` + `/analytics/orders`. Read-only; no custom report builder or export.

### Payments — 🟠
Razorpay account config + accepted methods (Razorpay/COD/UPI) via `GET/POST …/payment-config`. **No payouts/balance/settlement UI.**

### Shipping — ✅ (zones) / 🟠 (rates)
Shipping **zones** full CRUD (`/api/stores/[store]/shipping/zones[/:id]`). ⚙️ Backend exposes per-zone rate CRUD; web manages zones with rate coverage shown.

### Taxes — ✅
Tax-rate CRUD + store-level inclusive-pricing setting (GST-oriented).

### Apps / marketplace — ✅
Installed-apps list (`GET /app-store/installations`). **Embedded App Bridge** (`EmbeddedAppBridgeClient.tsx`): sandboxed iframe, `letbuyy:bridge.*` postMessage protocol, scoped GET-only API proxy via `POST /app-store/bridge/fetch` (OAuth bearer, allow-listed prefixes), Admin UI extensions via `@letbuyy/extension-host`. Discovery is external (`apps.letbuyy.store`).

### Settings — ✅ (with documented stubs)
General (details, currency/language display, **site-type read-only**, **Delete Store**), Checkout, Notifications, Policies, Online-store SEO. **Needs-backend stubs** (render `BackendNeededPane` documenting the missing gateway contract): Business details (GSTIN/legal), Localization, Security (2FA/passkeys/recovery), Custom data (metafields/metaobjects).

### Staff & permissions — 🟠 (UI) / enforcement backend-only
Invite/list/role-change/remove (`/api/stores/[store]/users[/:id]` → gateway `/employees`). Roles: **manager, editor, viewer, fulfillment** + implicit **owner**. **No client-side permission gating** — enforcement delegated to backend. No 2FA UI.

### Subscriptions / billing — ✅ (Razorpay)
Plan page (current/trial/features, change/upgrade, **cancel** `POST …/plan/cancel`), Billing page (subscription + payment method + **invoice history**), Razorpay subscribe checkout (`POST /api/subscribe` + `/verify`).

### Marketing / SEO — 🟠
"Marketing" nav groups coupons + reviews (store) or contact/leads (portfolio/landing). No email-campaign/automation. SEO is per-product + storefront preferences; no sitemap/redirects/structured-data UI.

---

## 4. API call inventory (web → gateway)

The browser calls **only same-origin `/api/...`** routes; those proxy to the gateway via `@letbuyy/api-client` (`packages/typescript/api-client/src/index.ts`). Representative gateway contract (all `/v1`):

- **Auth:** `GET /auth/custom/session`
- **Stores:** `GET/POST /stores`, `GET /stores/public/:subdomain`, `GET/PATCH/DELETE /stores/:id`, `POST /stores/:id/publish`, `GET/POST /stores/:id/payment-config`
- **Products:** `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, `POST /products/bulk`, `GET/POST /products/collections`, `GET/POST /products/gift-cards`, `POST /export/import-products`
- **Categories / Inventory:** `/categories*`; `GET /inventory/levels`, `POST /inventory/adjust` (+ WMS: locations/suppliers/purchase-orders/transfers/bulk-adjust/history)
- **Orders:** `GET /orders`, `GET/PATCH /orders/:id`, `POST /orders`, `POST /orders/:id/fulfill`, `POST /orders/:id/refund`
- **Customers:** `GET /customers`, `GET /customers/:email`, addresses CRUD
- **Pages/policies/navigation, Coupons (+validate), Blog (posts/comments), Form submissions, Reviews, Resume content**
- **Shipping/tax:** `/shipping-tax/shipping/zones*`, rates, taxes
- **Themes:** list/schema/categories/industries/purchases/installations/install/purchase(+verify)/packages-upload/editor(+draft)/publish/preview-session/releases/rollback
- **Payments:** `GET /payments/plans`, `/subscription`(+history/cancel), `/subscription/order`+`/verify`, provider orders
- **AI:** `GET /ai/credits`, `/ai/usage`
- **Media/upload:** `/media*`, `POST /upload`, `DELETE /upload/:key`
- **Employees:** `GET/POST /employees`, `PATCH/DELETE /employees/:id`
- **Analytics:** `GET /analytics/dashboard`, `/analytics/orders`
- **App store / App Bridge:** apps/reviews/install/uninstall/OAuth/billing-charge, `POST /app-store/bridge/fetch`
- **Storefront (public, for previews/lookup):** large `/storefront/*` surface

(Full endpoint enumeration and mobile mapping: **API_ALIGNMENT_MATRIX.md**.)

---

## 5. Permissions / RBAC model

- **Authorization = store ownership via session, enforced server-side.** Every API handler + server page calls `resolveOwnedStoreId()`/`getStoreForUser()`; non-owned store → 401/404. Middleware gates `/[store]/*` on cookie presence.
- **Staff roles (data model):** `manager` (full), `editor` (products/pages/blog), `viewer` (read-only), `fulfillment` (orders/shipping), implicit **owner**. Invite/manage via `/employees`.
- **No client-side permission gating** in web — role scoping enforced by the backend (`auth-core` predefined roles: Administrator/Merchandiser/Support/Partner/Ops-Reviewer; `middleware/rbac.ts`).
- **2FA/passkeys/recovery: not implemented** (Security settings is a stub).

---

## 6. Highest-signal web capabilities the mobile app must reach

1. **Products** (create/edit/variants/media/SEO) — the core.
2. **Orders** (queue, status transitions, fulfillment w/ tracking, **refunds** — backend-ready, missing even in web).
3. **Theme editor** (sections/blocks/schema/versions/live preview) — the hardest to port.
4. **Inventory** (web is basic; backend is full WMS — opportunity for mobile to *exceed* web).
5. **Customers** (backend supports detail+addresses the web omits — mobile can leapfrog).
6. **Discounts, Shipping, Taxes, Settings, Subscriptions** — bread-and-butter config.
7. **Apps / App Bridge** — the extensibility moat; hard on mobile (embedded iframes).
