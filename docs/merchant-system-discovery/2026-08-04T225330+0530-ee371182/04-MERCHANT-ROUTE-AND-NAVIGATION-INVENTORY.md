# 04 — MERCHANT ROUTE AND NAVIGATION INVENTORY

| Field | Value |
|---|---|
| Run ID | `docs/merchant-system-discovery/2026-08-04T225330+0530-bf35062e` |
| Branch | `stepup/main` |
| Commit | `bf35062e` |
| Run date | 2026-08-04 (+0530) |
| Scope | `apps/merchant-control-plane` (77 web pages, 130 same-origin API proxies, all navigation definitions) + `apps/mobile/merchant-app` (Flutter, 64 screen files, 91 registered route ids) at route/screen level |
| Evidence basis | Agent B notes (`_agent-notes/B-merchant-ui-routes.md`, read in full) + first-party re-verification in this document: scripted route/state/fetch extraction over `apps/merchant-control-plane/src/app`, scripted `var(--lb-*)` resolution diff, and direct reads of `merchantNavigation.ts`, `settings-navigation.ts`, `TrialBanner.tsx`, `tokens.ts`, and the Flutter `routes.dart` / screen graph |
| Evidence types used | `UI_CODE`, `PROXY_CODE`, `GATEWAY_CODE`, `API_CLIENT_CODE`, `DOC_CLAIM`, `UNIT_TEST`, `PROVIDER_OR_CONFIG_EVIDENCE` |

**METHOD DISCLOSURE — nothing in this document was runtime-verified.** No page was rendered, no proxy was called, no gateway request was issued, no Flutter build or simulator run was performed, no persistence was observed. Every "works" verdict is a static-reading verdict. The ceiling status in this document is therefore `IMPLEMENTED_NOT_RUNTIME_VERIFIED`; **no row is `VERIFIED_E2E`**.

**No secrets or PII appear in this document.** Environment variable *names* appear; no values, tokens, connection strings, customer records, email addresses, phone numbers or payment identifiers do.

---

## 1. Recommendation / verdict

The merchant navigation layer is structurally sound and should **not** be rebuilt. It has **zero dead navigation links** across all 61 distinct nav/shortcut/quick-action targets, a single enforced tenancy gate on every merchant page, and no direct database access anywhere in the UI. That is better than most pre-launch admin consoles.

Act on five things, in this order:

1. **Build the missing merchant surfaces, not new navigation.** Returns/RMA, GST tax invoice, packing slip and shipping labels all exist in the gateway and are unreachable from the web merchant OS (`MCP-DISC-100`). An Indian merchant today cannot open a GST invoice or process a return from the admin. This is a scope gap, not an engineering-difficulty gap — the endpoints exist.
2. **Close the money-surface honesty gap before any merchant touches live money.** The provider-mode badge is present on payments/shipping/billing/fulfilment and **absent on the refund panel, payouts, gift cards and the merchant's own plan checkout** (`MCP-DISC-101`). Mobile covers payouts; web does not. A sandbox refund is presently indistinguishable from a live one.
3. **Fix the two affordances that silently lie about outcomes.** Bulk export truncates at 100 rows and reports success (`MCP-DISC-102`); the dashboard reports a gateway failure as "Analytics are still warming up" and renders ₹0 (`MCP-DISC-113`).
4. **Make a founder decision on the unbacked money promises in the paid-plan checkout** (`MCP-DISC-103`) — ₹1,500 in subscription credits and bonus AI credits are rendered at the point of payment with no implementation anywhere in the repository.
5. **Decide whether the mobile app ships at all in its current navigation state.** Newly verified in this document: a large set of Flutter screens — returns, gift cards, coupons, staff, billing, reviews, leads, campaigns, apps, AI, shipping, taxes, KYC, 2FA, inventory, collections, pages, blog, media, navigation, custom data — are **registered as routes with no in-app navigation entry point of any kind** (`MCP-DISC-117`). They are dark code in a shipping binary.

Do **not** treat the 77-route count as the measure of completeness. Route coverage is high; *action* coverage on the highest-value routes is not — the order detail page has no order actions at all (`MCP-DISC-109`), and neither client gates a single action on staff permissions (`MCP-DISC-105`).

---

## 2. Scope

**In scope.** Every `page.tsx` under `apps/merchant-control-plane/src/app`; the navigation definitions (`merchantNavigation.ts`, `settings/settings-navigation.ts`, `AdminShell.tsx`, `CommandPalette.tsx`); the 130 same-origin API proxies as *data sources for routes*; the Flutter merchant app's route table, screen files and in-app navigation graph; the dead/no-op affordance surface; provider-mode badge coverage.

**Out of scope (owned by other agents/documents).** Gateway route handlers, RPC bodies, RLS policies, ledger correctness, session issuance, the mobile-BFF, storefront runtime, and everything below the `/v1` boundary. Every trace in this document terminates at the app-proxy → gateway boundary and is marked accordingly.

**Deliberately not run.** `pnpm validate:governance` and `pnpm run validate:*` (the orchestrator deletes `node_modules`/`dist`/`.next` before validating — proven finding G-L-01), builds, installs, migrations, deploys, and any git state mutation.

---

## 3. How to read these tables

| Column | Meaning |
|---|---|
| **In nav** | Which site-type navigation (`store` / `portfolio` / `resume` / `landing` / `blog`) or settings-nav group lists this route. `—` means no navigation entry exists anywhere. Source: `src/components/merchantNavigation.ts:34-290`, `src/components/settings/settings-navigation.ts:39-180`. |
| **Primary merchant actions** | Merchant-facing affordances, derived from action labels and mutating call sites in the route folder. |
| **Data source** | The proxy path(s) under `src/app/api/...` or the typed client method the route reads/writes through. |
| **Gate** | `S+O` = merchant session + store-ownership resolution enforced by `src/app/[store]/layout.tsx:19-28` and re-resolved per proxy by `src/lib/stores/resolve-owned-store.ts`. **No route in the app applies a role or permission gate** (`MCP-DISC-105`). |
| **Flag** | Feature flag read on this route. Verified by grep for `featureFlag`/`FEATURE_FLAG`/`isEnabled(`/`flags.`/`canary` across `src` excluding `app/api`: the only hit is a hardcoded copy string in `components/theme-editor/controls/LiquidControl.tsx:71-78`. **No merchant route reads a feature flag.** Client env reads are limited to eight `NEXT_PUBLIC_*` base-URL names. |
| **L·E·X** | Loading · Empty · Error state handling, by the same scripted heuristic Agent B used (`Skeleton\|isLoading\|loading ?\|Spinner\|setLoading` / `EmptyState\|emptyState\|emptyMessage\|emptyTitle` / `setError\|loadError\|tone="critical"\|variant="critical"\|variant:'critical'\|variant="danger"`). My independent re-run reproduces Agent B's figure exactly: **44 of 77 routes have all three.** A `–` means the heuristic found no such handling in the route folder; it does not prove the state is unhandled by a shared component. |
| **Status** | Taxonomy status. Ceiling is `IMPLEMENTED_NOT_RUNTIME_VERIFIED` — see the method disclosure. |
| **Gaps** | `MCP-DISC-NNN` gap IDs that land on this route. |

Status shorthand used in the tables: **INRV** = `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.

---

## 4. Complete web route inventory — all 77 routes

Route count verified first-party: 77 `page.tsx` files, 130 `route.ts` API proxies under `apps/merchant-control-plane/src/app`. Numbering matches the Agent B notes so cross-references remain stable.

| # | Route | In nav (site types) | Primary merchant actions | Data source | Gate | Flag | L·E·X | Status | Gaps |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/[store]/access_account/checkout/checkout` | — (flow step from `select-plan/SelectPlanClient.tsx:76`) | Apply/remove discount code; enter billing address + GSTIN; "Start your plan" (pay) | `POST /api/subscribe`, `/api/subscribe/coupon`, `/api/subscribe/verify` | S+O | — | – – X | `PARTIAL` (offers block is `STUB_OR_MOCK`) | 103, 101 |
| 2 | `/[store]/access_account/checkout/select-plan` | — (from `settings/plan/page.tsx:273`) | Choose billing period; compare plans; proceed to checkout | `apiClient.payments.plans`, `apiClient.payments.subscription.get`, `apiClient.foundingProgram.remaining` | S+O | — | – – – | `PARTIAL` (hardcoded competitor + sold-but-unbuilt highlights) | 103 |
| 3 | `/[store]/ai` | store → Marketing → AI Studio | Read credit balance + generation history; refresh. **Six tool cards with no handler** | `GET /api/stores/:s/ai` (read-only) | S+O | — | L E X | `PARTIAL` (credits INRV; tools `UI_ONLY`, generation `BACKEND_ONLY`) | 111 |
| 4 | `/[store]/analytics` | store, portfolio, resume, landing, blog (`g a`) | Select 7/30/90-day range; refresh; read revenue/orders/AOV/products + orders-by-status | `GET /api/stores/:s/analytics?period=` → `apiClient.analytics.{dashboard,orders,revenue}` | S+O | — | L E X | `PARTIAL` (period does not scope the breakdown) | 112 |
| 5 | `/[store]/appearance` | portfolio, landing, blog | Set primary colour, font family, logo/favicon URL | `GET`/`PATCH /api/stores/:s/settings` | S+O | — | L – X | INRV | 115 |
| 6 | `/[store]/apps` | all five (nav item "Add", `g x`) | "Browse marketplace" (outbound), open an installation | `apiClient.appStore.installations` | S+O | — | – E – | `BROKEN` (primary action targets a frozen runtime) | 116 |
| 7 | `/[store]/apps/[installationId]` | — (detail from `apps/page.tsx:56`) | Open embedded app session | `apiClient.appStore.embedSession`, `.extensionRegistry` | S+O | — | – – – | INRV | 116 |
| 8 | `/[store]/categories` | store → Products → Categories; blog | Add / edit / delete category | `GET /api/stores/:s/categories`, `DELETE .../:id` | S+O | — | L E X | INRV | — |
| 9 | `/[store]/certifications` | resume | Add / edit / delete certification | `/api/stores/:s/content/certifications` | S+O | — | L E X | INRV | 108 |
| 10 | `/[store]/comments` | store → Content; blog | Approve / mark spam / delete blog comment | `GET`/`PATCH`/`DELETE /api/stores/:s/blog-comments` | S+O | — | L E X | INRV | — |
| 11 | `/[store]/contact` | portfolio (nav label "Marketing") | Read / status-update / delete contact submission | `GET /api/stores/:s/form-submissions?type=contact` | S+O | — | L E X | INRV | — |
| 12 | `/[store]/coupons` | store → Marketing (group parent, `g m`/`g d`) | Create coupon (%, fixed ₹, free shipping), edit, delete | `GET`/`PATCH`/`DELETE /api/stores/:s/coupons` | S+O | — | L E X | INRV | — |
| 13 | `/[store]/customers` | store (`g c`) | Search/filter customers; copy emails (bulk) | `GET /api/stores/:s/customers` | S+O | — | L E X | INRV | — |
| 14 | `/[store]/customers/[email]` | — (detail) | Read profile/orders; add a note | `GET /api/stores/:s/customers/:email`, `GET`/`POST .../notes` | S+O | — | L E X | INRV | 115 |
| 15 | `/[store]/customers/segments` | store → Customers → Segments | Create segment (status/consent/tags/order count/spend); preview audience | `GET /api/stores/:s/customers/segments`, `POST .../preview` | S+O | — | L E X | INRV | 115 |
| 16 | `/[store]/dashboard` | all five (`g h`) | Read revenue/orders/products/AOV; copy domain; "Up next" checklist; store settings | server-side `apiClient.analytics.*`, `.orders.list`, `.products.list`, `.pages.list`, `.shipping.zones.list`, `.stores.paymentConfig.get` | S+O | — | L E – | `PARTIAL` (failure renders as zeros) | 113, 110, 104, 101 |
| 17 | `/[store]/education` | portfolio, resume | Add / edit / delete education entry | `/api/stores/:s/content/education` | S+O | — | L E X | INRV | 108 |
| 18 | `/[store]/experience` | resume | Add / edit / delete work experience | `/api/stores/:s/content/work_experience` | S+O | — | L E X | INRV | 108 |
| 19 | `/[store]/export` | store → Products → Export and import | Download products/orders/customers CSV; import products CSV | `GET /api/stores/:s/{products,orders,customers}?limit=100`, `POST .../products/import` | S+O | — | – – X | `BROKEN` (silent 100-row truncation, success toast) | 102 |
| 20 | `/[store]/gallery` | **portfolio only** (`merchantNavigation.ts:184`) | Upload / delete media | `GET`/`DELETE /api/stores/:s/media` | S+O | — | L E X | `PARTIAL` (page + proxy work; invisible to store-type merchants) | 114 |
| 21 | `/[store]/leads` | landing | Read / status-update / delete lead | `GET /api/stores/:s/form-submissions?type=lead` | S+O | — | L E X | INRV | — |
| 22 | `/[store]/login` | — | Client redirect to the accounts app | none | S+O | — | – – – | `PARTIAL` (opts out of the design system) | 119 |
| 23 | `/[store]/marketing` | store → Marketing → Campaigns | Create campaign, preview audience, save draft, **send** | `GET`/`POST /api/stores/:s/marketing/campaigns`, `.../:id/send`, `.../audience-preview` | S+O | — | L E X | `PARTIAL` (sandbox send reports success) | 118, 115 |
| 24 | `/[store]/online-store` | store (`g t`) | none — client `router.replace` to `/online-store/themes` | none | S+O | — | – – – | `PARTIAL` (renders `null`, blank frame before redirect) | 120 |
| 25 | `/[store]/online-store/pages` | store → Online Store → Store pages | Create/edit/delete store page; edit policies; edit main navigation | `GET`/`DELETE /api/stores/:s/pages`, `PUT .../navigation/main`, `/policies` | S+O | — | L E X | INRV | 108, 115 |
| 26 | `/[store]/online-store/preferences` | store → Online Store → Preferences | Edit store SEO title/meta | `GET`/`PATCH /api/stores/:s/settings` | S+O | — | L – X | INRV | — |
| 27 | `/[store]/online-store/themes` | store → Online Store → Themes (`g t`) | Install / publish theme; edit storefront password; "Discover themes" (outbound) | `GET /api/themes`, `POST /api/themes/install`, `/publish` | S+O | — | L – X | `PARTIAL` (theme-store links target a frozen runtime) | 116, 115 |
| 28 | `/[store]/online-store/themes/[themeId]/editor` | — (from themes) | Edit sections/settings, undo/redo, device preview, save draft, view versions | `GET`/`PUT /api/themes/:id/editor`, `/editor/draft`, `/sections`, `/releases`, `/preview-session` | S+O | — | L – X | INRV | 115 |
| 29 | `/[store]/online-store/themes/[themeId]/editor/translations` | **— (no inbound link anywhere)** | Edit theme translations | `/api/stores/:s/localization*` | S+O | — | L – – | `UI_ONLY` (built, unreachable) | 114 |
| 30 | `/[store]/online-store/themes/update` | **— (no inbound link anywhere)** | View theme version diff, apply update, roll back | `GET /api/themes/:id/releases`, `/update-preview`, `/update` | S+O | — | L – X | `UI_ONLY` (built, unreachable) | 114, 115 |
| 31 | `/[store]/orders` | store (`g o`) | Filter; bulk confirm/mark processing/mark delivered; **Ship** (tracking no.); **Cancel**; **Refund** (step-up gated) | `GET /api/stores/:s/orders`, `PATCH .../:id`, `POST .../:id/refund`, `GET .../shipping/zones` | S+O | — | L E X | `PARTIAL` (fulfilment badged, refund not) | 101, 100, 109 |
| 32 | `/[store]/orders/[orderId]` | — (detail from list row) | **None** — read-only; only navigates to the customer profile or back | `GET /api/stores/:s/orders/:id` | S+O | — | L E X | `PARTIAL` (read-only detail) | 109, 100, 101, 115 |
| 33 | `/[store]/pages` | store → Content (parent); portfolio, landing, blog | Create / edit / delete CMS page; set status | `GET`/`POST`/`PATCH`/`DELETE /api/stores/:s/pages` | S+O | — | L E X | INRV | — |
| 34 | `/[store]/payouts` | store → Money → Payouts | Read payout rows (minor units); **Release** (step-up gated) | `GET /api/stores/:s/payouts`, `POST .../:id/settle` | S+O | — | L E X | `PARTIAL` (no provider-mode badge; local currency formatter) | 101 |
| 35 | `/[store]/posts` | store → Content → Blog posts; blog | Create / edit / delete post; set status | `GET`/`DELETE /api/stores/:s/posts` | S+O | — | L E X | INRV | — |
| 36 | `/[store]/products` | store (`g p`, exact) | Filter by status; edit product status; add product | `GET`/`PATCH /api/stores/:s/products` | S+O | — | L E X | INRV | — |
| 37 | `/[store]/products/[productId]` | — (detail) | Re-export of `products/new` (`export { default } from '../new/page'`) | see #43 | S+O | — | – – – | INRV | — |
| 38 | `/[store]/products/collections` | store → Products → Collections | Create collection; assign products | `GET`/`POST /api/stores/:s/collections`, `PUT .../:id/products` | S+O | — | L E X | INRV | 115 |
| 39 | `/[store]/products/gift-cards` | store → Money → Gift cards | **Issue gift card** (initial value, recipient); enable/disable | `GET`/`POST /api/stores/:s/gift-cards`, `PATCH .../:id` | S+O | — | L E X | `PARTIAL` (no provider-mode badge; not step-up gated) | 101, 115 |
| 40 | `/[store]/products/inventory` | store → Inventory (`g i`) | Search; adjust available quantity | `GET /api/stores/:s/inventory/levels`, `POST .../adjust` | S+O | — | L E X | INRV | 115 |
| 41 | `/[store]/products/inventory-history` | store → Inventory → Inventory history | Filter/paginate movement ledger; read analytics | `GET /api/stores/:s/inventory/history`, `/analytics` | S+O | — | L E X | INRV | 115 |
| 42 | `/[store]/products/locations` | store → Inventory → Locations | Add / edit location (India address fields) | `GET`/`POST /api/stores/:s/inventory-locations` | S+O | — | L E X | INRV | 115 |
| 43 | `/[store]/products/new` | store → Products → Add product (`n p`) | Create/edit product: pricing, cost, SKU/barcode, weight, HS code, country of origin, SEO, status | `GET`/`POST /api/stores/:s/products`, `POST .../upload` | S+O | — | L E X | INRV | 115 |
| 44 | `/[store]/products/operations-dashboard` | store → Inventory → Operations dashboard | Read 4 KPI panels; refresh | `GET /api/stores/:s/commerce-analytics/*` (4 endpoints) | S+O | — | L E X | `PARTIAL` (7 unresolved tokens on the KPI cards) | 115 |
| 45 | `/[store]/products/purchase-orders` | store → Purchasing (parent) | Create PO (supplier, destination, lines, unit cost); receive quantities | `GET`/`POST /api/stores/:s/purchase-orders`, `POST .../:id/receive` | S+O | — | L E X | INRV | 115 |
| 46 | `/[store]/products/receipts` | store → Purchasing → Receipts | Filter/paginate receiving history | `GET /api/stores/:s/inventory/receipts` | S+O | — | L E X | INRV | 115 |
| 47 | `/[store]/products/reservations` | store → Inventory → Reservations | Filter by status; paginate | `GET /api/stores/:s/inventory/reservations` | S+O | — | L E X | INRV | 115 |
| 48 | `/[store]/products/smart-collections` | store → Products → Smart collections | Build rule set (AND/OR, field/operator/value); preview matches | `GET /api/stores/:s/smart-collections`, `.../:id/preview` | S+O | — | L E X | INRV | 115 |
| 49 | `/[store]/products/suppliers` | store → Purchasing → Vendors | Add supplier (contact + India address) | `GET`/`POST /api/stores/:s/suppliers` | S+O | — | L E X | INRV | 115 |
| 50 | `/[store]/products/transfers` | store → Purchasing → Transfers | Create transfer (source/destination, lines); ship; receive | `GET`/`POST /api/stores/:s/transfers`, `POST .../:id/ship`, `/receive` | S+O | — | L E X | INRV | 115 |
| 51 | `/[store]/projects` | portfolio (`g p`) | Add / edit / delete project | `/api/stores/:s/content/projects` | S+O | — | L E X | INRV | 108 |
| 52 | `/[store]/reviews` | store → Marketing → Reviews (`g r`) | Approve / reject / delete review | `GET`/`PATCH`/`DELETE /api/stores/:s/reviews` | S+O | — | L E X | INRV | — |
| 53 | `/[store]/settings` | all five (`g s`) | Static index over `SETTINGS_NAV_ITEMS` + phase cards | none | S+O | — | – – – | `PARTIAL` (a phase references a nav item that does not exist) | 114 |
| 54 | `/[store]/settings/apps` | settings → Apps and sales channels | List installations; "Browse app marketplace" (outbound) | `apiClient.appStore.installations` | S+O | — | – E X | `PARTIAL` (outbound target frozen) | 116 |
| 55 | `/[store]/settings/billing` | store → Money (parent, `g y`) + settings → Billing | Read invoices, filter paid/unpaid; open billing profile; manage plan | `GET /api/stores/:s/billing`, `/settings` | S+O | — | L E X | `PARTIAL` (US-locale invoice dates) | 108, 101 |
| 56 | `/[store]/settings/billing/profile` | — (from `settings/billing/page.tsx:263,284`) | Edit billing profile; **capture GSTIN (validated)** | `GET /api/stores/:s/billing`, `PATCH .../settings` | S+O | — | L – X | INRV | 106 |
| 57 | `/[store]/settings/business` | settings → Business details | Legal/trade name, entity type, PAN last-4, **GSTIN (unvalidated)**, GST state, invoice prefix; KYC submit/refresh; read commission | `GET`/`PATCH /api/stores/:s/settings`, `POST .../kyc`, `.../kyc/documents/:id/refresh`, `GET .../commission` | S+O | — | L – X | `PARTIAL` (unvalidated GSTIN; commission defaults to 0% on fetch failure and rounds with `.toFixed(0)`) | 106, 113 |
| 58 | `/[store]/settings/checkout` | settings → Checkout | Configure contact method, account creation, name/company/notes/tipping fields | `GET`/`PATCH /api/stores/:s/settings` | S+O | — | L – X | INRV | — |
| 59 | `/[store]/settings/custom-data` | settings → Custom data (badged "Needs backend") | none — `BackendNeededPane` | none | S+O | — | – – – | `NOT_IMPLEMENTED` (honestly declared) | — |
| 60 | `/[store]/settings/domains` | settings → Domains | Connect existing domain; find a domain; set primary/redirect; verify DNS | `/api/stores/:s/domains/*` via `src/lib/domains/client.ts` | S+O | — | L – X | `PARTIAL` (US-locale dates in `DomainDetailView`) | 108, 121 |
| 61 | `/[store]/settings/general` | settings → General | Store name/handle/tagline, currency, timezone, country, invoice address; add/edit/delete locales | `GET`/`PATCH`/`DELETE /api/stores/:s/settings`, `/localization*` | S+O | — | L – X | INRV | — |
| 62 | `/[store]/settings/localization` | **— (referenced by a dead `itemHref` in `settings/page.tsx:37`)** | none — server `redirect()` to `settings/general` | none | S+O | — | – – – | `PARTIAL` (intentional redirect; the referencing phase card silently drops it) | 114 |
| 63 | `/[store]/settings/notifications` | settings → Notifications | Toggle order/low-stock/customer/review/campaign emails; filter delivery logs by channel/status | `GET`/`PUT /api/stores/:s/notifications/preferences`, `GET .../delivery-logs` | S+O | — | L E X | INRV | 115 |
| 64 | `/[store]/settings/payments` | settings → Payments | Configure Razorpay key id/secret, account mode; toggle COD | `GET`/`POST`/`PATCH /api/stores/:s/payment-config` | S+O | — | L – X | INRV (**badge present** `page.tsx:365`) | — |
| 65 | `/[store]/settings/plan` | settings → Plan | View current plan; go to plan selector; cancel plan | `GET /api/stores/:s/plan`, `POST .../plan/cancel`, `GET /api/plans` | S+O | — | L – X | INRV | 104 |
| 66 | `/[store]/settings/policies` | settings → Policies | Edit refund/privacy/terms/shipping policy | `GET`/`PATCH /api/stores/:s/settings` | S+O | — | L – X | INRV | — |
| 67 | `/[store]/settings/security` | settings → Security | Enrol / verify / disable TOTP two-factor | `GET /api/stores/:s/security/two-factor`, `POST .../enroll`, `/verify`, `/disable` | S+O | — | L E X | INRV | 108 |
| 68 | `/[store]/settings/shipping` | settings → Shipping and delivery | Add/delete zone; add/delete rate | `GET`/`DELETE /api/stores/:s/shipping/zones`, `POST`/`DELETE .../rates` | S+O | — | L E X | INRV (**badge present** `page.tsx:459`) | 100 |
| 69 | `/[store]/settings/subscribe/checkout` | settings → Subscribe checkout | none — server `redirect()` to `access_account/checkout/checkout` | none | S+O | — | – – – | INRV | — |
| 70 | `/[store]/settings/taxes` | settings → Taxes and duties | Add/edit/delete tax rate; price mode; shipping taxes; compound | `GET`/`PATCH`/`DELETE /api/stores/:s/taxes` | S+O | — | L E X | INRV | 100 |
| 71 | `/[store]/settings/users` | settings → Users and permissions | Invite staff (email, name, **role**); change role; remove | `GET`/`POST`/`PATCH`/`DELETE /api/stores/:s/users` | S+O | — | L – X | `PARTIAL` (persists permissions that gate nothing) | 105, 107, 108 |
| 72 | `/[store]/skills` | portfolio, resume | Add / edit / delete skill | `/api/stores/:s/content/skills` | S+O | — | L E X | INRV | — |
| 73 | `/[store]/testimonials` | portfolio | Add / edit / delete testimonial | `/api/stores/:s/content/testimonials` | S+O | — | L E X | INRV | — |
| 74 | `/accept-invite` | — (email link) | Set password and accept a staff invite | `POST /api/employees/accept-invite` | invite token | — | L – X | `UNVERIFIED_RUNTIME` (not in the proxy allow-list) | 122, 115 |
| 75 | `/launching-soon` | — (proxy allow-list only) | none | none | none | — | – – – | INRV | — |
| 76 | `/` | — | Server redirect fan-out | none | session | — | – – – | INRV | — |
| 77 | `/stores` | — (HeaderBar "All stores") | Pick a store | server `getUserStores` | session | — | – E – | INRV | — |

### 4.1 Layouts, middleware and shell bypasses

| Element | Path | Behaviour |
|---|---|---|
| Root layout | `src/app/layout.tsx` | `LetbuyyThemeProvider` + `ThemeScript` + local fonts + `globals.css` |
| **The single tenancy gate** | `src/app/[store]/layout.tsx:19-28` | `getSessionUser()` → redirect to accounts; `getStoreForUser(store, user.id)` → `notFound()`. Note `src/lib/auth/session.ts:111-113` — the `_userId` parameter is **unused**; ownership is delegated entirely to the gateway. Whether the gateway enforces `verifySiteOwnership` on `stores.getByHandle` is **NOT VERIFIED** here (Agent A). |
| Settings layout | `src/app/[store]/settings/layout.tsx` | Swaps in `SettingsShell` with its own floating sidebar + a real mobile drawer (focus trap, scroll lock, `SettingsShell.tsx:59-89`) |
| Full-screen flows | `access_account/checkout/{checkout,select-plan}/layout.tsx`, `settings/subscribe/checkout/layout.tsx` | Bypass the admin shell |
| Shell bypass | `src/components/AdminShell.tsx:52-57` | Skips the shell for `/access_account/checkout`, `/subscribe/checkout`, `/editor` |
| Middleware | `src/proxy.ts:18-26` (Next 16 `proxy.ts` convention; `package.json:21` = `next 16.1.6`) | Allow-list is `/`, `/_next`, `/api`, `/launching-soon`, and anything containing `.`. Everything else requires a verified `lb_session` cookie. **`/accept-invite` is not allow-listed** → `MCP-DISC-122`. |

---

## 5. Navigation definition inventory

### 5.1 Site-type navigations (`src/components/merchantNavigation.ts`)

| Site type | Top-level items | Notes |
|---|---|---|
| `store` (`:61-165`) | Home · Orders · Products (+Add product, Collections, Smart collections, Categories, Export and import) · Inventory (+Inventory history, Reservations, Locations, Operations dashboard) · Purchasing (+Transfers, Receipts, Vendors) · Customers (+Segments) · Money (+Payouts, Gift cards) · Marketing (+Reviews, Campaigns, AI Studio) · Content (+Blog posts, Comments) · Analytics · Online Store (+Themes, Store pages, Preferences) · Add · Settings | The `products` and `pages` items are `exact:true` so warehousing routes do not force the group open (`:70-76`, `:143`). `merchantNavigation.ts:66-69` documents a previously-removed dead link (`orders?view=drafts`) — evidence this exercise was run once before. |
| `portfolio` (`:167-200`) | Home · Content (Projects, **Gallery**, Pages) · Profile (Skills, Education, Testimonials) · Marketing (`contact`) · Online Store (`appearance`) · Analytics · Add · Settings | `gallery` appears **only here** (`:184`) |
| `resume` (`:203-218`) | Home · Profile (Experience, Education, Skills, Certifications) · Analytics · Add · Settings | |
| `landing` (`:220-226`) | Home · Content (`pages`) · Marketing (`leads`) · Online Store (`appearance`) · Analytics · Add · Settings | |
| `blog` (`:228-244`) | Home · Content (Posts, Categories, Comments, Pages) · Online Store (`appearance`) · Analytics · Add · Settings | |

Keyboard shortcuts (`shortcutDestinations`, `:254-290`): store gets 14 (`g h/o/p/i/c/m/d/r/t/y/a/x/s`, `n p`); portfolio 7; resume 5; landing and blog similar. Every shortcut target resolves to a real page.

### 5.2 Settings navigation (`src/components/settings/settings-navigation.ts`)

6 groups / 16 items: **Store foundation** (General, Business details) · **Plan and billing** (Plan, Billing, Subscribe checkout) · **People** (Users and permissions, Security) · **Selling** (Payments, Checkout, Shipping and delivery, Taxes and duties) · **Store operations** (Domains, Notifications, Policies) · **Extensions** (Apps and sales channels, Custom data — `status: 'backend-needed'`, `:174`).

Not in the settings nav despite being real pages: `settings/billing/profile` (linked from Billing) and `settings/localization` (a permanent redirect referenced by a phase card that has no matching nav item — `MCP-DISC-114`).

### 5.3 Command palette

`src/components/CommandPalette.tsx` (⌘K) renders `getMerchantCommandItems`, which is derived from the same nav definitions — it introduces no additional destinations and therefore no additional dead-link surface.

---

## 6. Dead nav links

**Zero.** All 61 distinct nav / shortcut / quick-action targets resolve to a real `page.tsx`. Verified by Agent B with a script diffing every `path:` / `href:` / shortcut / quick-action literal against the 77-page route set; the definitions were re-read first-party for this document and no target outside the route set was found.

Status: `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. This is a genuine strength and should be protected by a validator (see the completion contract, §14).

The **only** navigation-definition defect is the inverse case: `src/app/[store]/settings/page.tsx:37` lists `'localization'` in the "Store foundation" phase `itemHrefs`, `SETTINGS_NAV_ITEMS` has no such entry, and `.filter(Boolean)` at `:110` silently drops it — so the card advertises "language settings" and renders **2/2** instead of 3. That is a *silently swallowed* dead reference, not a rendered dead link. → `MCP-DISC-114`.

---

## 7. Hidden pages — real page, no navigation entry (12)

| # | Route | Verdict | Evidence | Gap |
|---|---|---|---|---|
| 1 | `access_account/checkout/checkout` | OK — flow step | reached from `select-plan/SelectPlanClient.tsx:76` | — |
| 2 | `access_account/checkout/select-plan` | OK — flow step | reached from `settings/plan/page.tsx:273` | — |
| 7 | `apps/[installationId]` | OK — detail | `apps/page.tsx:56` | — |
| 14 | `customers/[email]` | OK — detail | customers list row | — |
| 22 | `login` | OK — redirect shim | — | — |
| 28 | `online-store/themes/[themeId]/editor` | OK — from themes | — | — |
| 29 | `online-store/themes/[themeId]/editor/translations` | **UNREACHABLE** | `grep -rn "editor/translations" src` outside its own folder → 0 hits. 255 LOC | `MCP-DISC-114` |
| 30 | `online-store/themes/update` | **UNREACHABLE** | `grep -rn "themes/update" src` outside its own folder → 0 hits. 301 LOC + `components/theme-editor/ThemeUpdatePanel.tsx` (real version diff / apply / rollback UI) | `MCP-DISC-114` |
| 32 | `orders/[orderId]` | OK — detail from list row | but see `MCP-DISC-109` — it has no actions | `MCP-DISC-109` |
| 37 | `products/[productId]` | OK — detail | `export { default } from '../new/page'` | — |
| 56 | `settings/billing/profile` | OK — linked | `settings/billing/page.tsx:263,284` | — |
| 62 | `settings/localization` | Intentional redirect, but referenced by a dropped `itemHref` | `page.tsx:9-11`; `settings/page.tsx:37,110` | `MCP-DISC-114` |
| 20 | `gallery` | **Nav-invisible to store merchants** | in `portfolioNavigation` only (`merchantNavigation.ts:184`); the `/api/stores/:s/media` proxy exists and works for any site type | `MCP-DISC-114` |

Three shipped features (theme safe-update, theme translations, the store media library) are therefore dark on the site type that matters most.

---

## 8. Orphaned API proxies — defined, never called by any UI route

Script-verified by Agent B against all non-API source in the app.

| Proxy | Status | Consequence |
|---|---|---|
| `src/app/api/stores/[store]/dashboard/setup/route.ts:22-27` | **Fully orphaned** | Returns exactly `{ productsCount, shippingZonesCount, pagesCount }` — precisely what the setup assistant needs. The assistant instead calls a non-existent endpoint. → `MCP-DISC-110` |
| `src/app/api/themes/[themeId]/sections/reorder` | Orphaned | The editor persists ordering via `themes.saveDraft` instead (`editor/page.tsx:1216 moveSection`) → `MCP-DISC-121` |
| `src/app/api/stores/[store]/domains/[domain]/[action]` | Partially orphaned | Only `/verify` is used (`src/lib/domains/client.ts:52`); the generic `[action]` catch-all is otherwise unused → `MCP-DISC-121` |

(The four `commerce-analytics/*` proxies were flagged and then cleared by Agent B — `products/operations-dashboard/page.tsx:115-121` builds their URLs by concatenation, which the first scan missed. They are used.)

---

## 9. Flutter merchant-app inventory (`apps/mobile/merchant-app`)

**Not built, not run.** 151 `.dart` files under `lib/`; **64 screen files** (63 `*_screen.dart` + `create_store_wizard.dart`); 39 service files; 5 test files. Transport: `lib/config/app_config.dart:9-17` — `bffBaseUrl` and `apiBaseUrl` both default to the mobile-BFF host, so the app talks to `services/mobile-bff`, **not** the gateway directly (correct per topology).

Bottom navigation (`lib/screens/main/store_main_screen.dart:12`): **Home · Orders · Products · Customers · More** (5 tabs).

### 9.1 Registered primary routes → screen → reachability

Route ids: `AppRouteId` enum, **91 values** = 57 primary + 34 `/features/*` aliases (`lib/app/routes.dart:61-151`). Paths at `:178-238`. "Reached from" was derived first-party for this document by enumerating every `Navigator.pushNamed` / `pushReplacementNamed` / `MaterialPageRoute` construction in `lib/`.

| # | Route path | Screen | Reached from (in-app) | Status |
|---|---|---|---|---|
| 1 | `/` | `auth_wrapper.dart` | app root | INRV |
| 2 | `/splash` | `splash/splash_screen.dart` | route table only | `UNVERIFIED_RUNTIME` |
| 3 | `/login` | `auth/login_screen.dart` | auth wrapper, `settings_screen.dart:64` (logout) | INRV |
| 4 | `/otp` | `auth/otp_screen.dart` | `login_screen.dart` | INRV |
| 5 | `/turnstile-challenge` | `auth/turnstile_challenge_screen.dart` | `login_screen.dart`, `otp_screen.dart` | INRV |
| 6 | `/error` | `auth/error_screen.dart` | `auth_wrapper.dart:155`, `routes.dart:312` | INRV |
| 7 | `/create-store` (`/onboarding` alias) | `wizard/create_store_wizard.dart` | `login_screen.dart:236,240`, `otp_screen.dart:69`, `home_screen.dart:877` | INRV |
| 8 | `/store-published` | `wizard/store_published_screen.dart` | `create_store_wizard.dart:370` | INRV |
| 9 | `/main` | `main/store_main_screen.dart` | `login_screen.dart:234`, `otp_screen.dart:69`, `store_published_screen.dart:653,742` | INRV |
| 10 | `/upgrade` | `premium/upgrade_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 11 | `/live-preview` | `preview/live_preview_screen.dart` | `home_screen.dart:423` (Quick actions → Editor) | INRV |
| 12 | `/domain-settings` | `settings/domain_settings_screen.dart` | `settings_screen.dart:169` | INRV |
| 13 | `/seo-settings` | `settings/seo_settings_screen.dart` | `settings_screen.dart:178` | INRV |
| 14 | `/store-details` | `settings/store_details_screen.dart` | `settings_screen.dart:111,120,154`, `home_screen.dart:439` | INRV |
| 15 | `/store-health` | `store_health/store_health_screen.dart` | `settings_screen.dart:164` | INRV |
| 16 | `/notifications` | `settings/notifications_screen.dart` | `home_screen.dart:549` | INRV |
| 17 | `/staff` | `settings/staff_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 18 | `/billing` | `settings/billing_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 19 | `/reviews` | `marketing/reviews_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 20 | `/leads` | `marketing/leads_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 21 | `/email-campaigns` | `marketing/email_campaigns_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 22 | `/apps` | `apps/apps_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 23 | `/ai` | `ai/ai_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 24 | `/shipping` | `settings/shipping_screen.dart` | **nothing** (two editor sheets emit a `'href': '/shipping'` data value, not navigation) | `UI_ONLY` (unreachable) |
| 25 | `/taxes` | `settings/taxes_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 26 | `/localization-markets` | `settings/localization_markets_screen.dart` | `settings_screen.dart:184` | INRV |
| 27 | `/custom-data` | `settings/custom_data_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 28 | `/help` | `settings/help_screen.dart` | `settings_screen.dart:287,293` | INRV |
| 29 | `/analytics` | `analytics/analytics_screen.dart` | `settings_screen.dart:193`, `home_screen.dart:435` | INRV |
| 30 | `/customers` | `customers/customers_screen.dart` | bottom-nav tab 4 | INRV |
| 31 | `/customers/detail` | `customers/customer_detail_screen.dart` | `customers_screen.dart:882` | INRV |
| 32 | `/coupons` | `discounts/coupons_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 33 | `/coupons/form` | `discounts/coupon_form_screen.dart` | `coupons_screen.dart` (itself unreachable) | `UI_ONLY` (transitively unreachable) |
| 34 | `/gift-cards` | `discounts/gift_cards_screen.dart` | **nothing** | `UI_ONLY` (unreachable) — money surface |
| 35 | `/pages` | `content/pages_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 36 | `/blog` | `content/blog_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 37 | `/navigation` | `content/navigation_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 38 | `/media` | `content/media_library_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 39 | `/inventory` | `inventory/inventory_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 40 | `/inventory/locations` | `inventory/locations_screen.dart` | `inventory_screen.dart:220` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| 41 | `/inventory/suppliers` | `inventory/suppliers_screen.dart` | `inventory_screen.dart:225` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| 42 | `/inventory/purchase-orders` | `inventory/purchase_orders_screen.dart` | `inventory_screen.dart:230` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| 43 | `/inventory/transfers` | `inventory/transfers_screen.dart` | `inventory_screen.dart:235` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| 44 | `/collections` | `products/collections_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 45 | `/products` | `products/products_screen.dart` | bottom-nav tab 3, `home_screen.dart:427` | INRV |
| 46 | `/orders` | `orders/orders_screen.dart` | bottom-nav tab 2, `home_screen.dart:431` | INRV |
| 47 | `/orders/detail` | `orders/order_detail_screen.dart` | `orders_screen.dart:1456`, `customer_detail_screen.dart`, deep link `orders/:id` | INRV |
| 48 | `/returns` | `orders/returns_screen.dart` | **nothing** | `UI_ONLY` (unreachable) — the capability web lacks entirely |
| 49 | `/money` | `money/money_screen.dart` | `home_screen.dart:668` | INRV (**badges present** `:220,227,231`) |
| 50 | `/kyc` | `kyc/kyc_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 51 | `/two-factor` | `security/two_factor_screen.dart` | **nothing** | `UI_ONLY` (unreachable) |
| 52 | `/pricing` | `subscription/pricing_screen.dart` | `settings_screen.dart:260`, `billing_screen.dart:102`, `upgrade_screen.dart`, `hero_store_card.dart` | INRV |
| 53 | `/connect-razorpay` | `subscription/connect_razorpay_screen.dart` | `settings_screen.dart:271` | INRV |

Screens with **no route id at all**, pushed directly via `MaterialPageRoute`:

| Screen | Pushed from | Status |
|---|---|---|
| `products/product_form_screen.dart` | `products_screen.dart:317,325` | INRV |
| `products/import_products_screen.dart` | `products_screen.dart:341` | INRV |
| `content/page_editor_screen.dart` | `pages_screen.dart:76` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| `content/post_editor_screen.dart` | `blog_screen.dart:104` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| `subscription/razorpay_checkout_screen.dart` | `pricing_screen.dart:262`, `billing_screen.dart:102` | INRV |
| `apps/app_bridge_runtime_screen.dart` | `apps_screen.dart:603` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| `customize/theme_screen.dart` | **nothing — zero references outside its own file** | `UI_ONLY` (unreachable) |
| `customize/theme_versions_screen.dart` | `theme_screen.dart:206` (parent unreachable) | `UI_ONLY` (transitively unreachable) |
| `editor/section_editor_screen.dart` | **nothing — zero references outside its own file** | `UI_ONLY` (unreachable) |
| `platform/platform_blocked_screen.dart` | **nothing** — `PlatformBlockedService.features` is an empty const list (`lib/services/platform_blocked_service.dart:25`), so `featureForRoute` can never return a feature and the screen can never be constructed | `STUB_OR_MOCK` (inert mechanism) |

### 9.2 The 34 `/features/*` alias routes

`routes.dart:590-770`. Every alias re-mounts an existing screen; three carry a tab index (`/features/payouts-settlement` → `MoneyScreen(initialTab: 0)`, `/features/wallet` → tab 1, `/features/commission` → tab 2). **No code inside `lib/` navigates to any `/features/*` path** (verified: the only repository references outside `routes.dart` are in `test/mobile_services_test.dart`). They exist as deep-link / entitlement targets for `PlatformBlockedService.featureForRoute`, which is inert because its feature list is empty. This is scaffolding, not a shipped capability.

### 9.3 Deep links

`routes.dart:213-235`: `orders/:id`, `payment-return?…`, `share/:storeId?url=&name=`.

### 9.4 Flutter role gate

`lib/app/role_gate.dart` defines `MerchantStaffRole { owner, admin, manager, editor, support, marketing, staff }` plus four capability predicates (`canManageStaff`, `canManageCatalog`, `canManageOrders`, `canReadAnalytics`). The **only** consumer in the entire app is a display chip: `lib/screens/settings/staff_screen.dart:200 StaffRoleGate.labelsFor(member.role)`. **No screen gates on role.** → `MCP-DISC-105`, `MCP-DISC-107`.

---

## 10. Web vs mobile capability comparison

### 10.1 In Flutter, absent from the web merchant control plane

| Capability | Flutter | Web | Gap |
|---|---|---|---|
| **Returns / RMA** | `screens/orders/returns_screen.dart` + `services/return_service.dart`; route `/returns` (unreachable in-app) | **NONE** — no page, no proxy; only a read-only `return_status` badge at `orders/[orderId]/page.tsx:544` | `MCP-DISC-100`, `MCP-DISC-117` |
| Store health | `screens/store_health/store_health_screen.dart` (reachable) | none | — |
| Wallet + commission as first-class surfaces | `MoneyScreen` tabs 1 and 2 (reachable) | commission is buried inside `settings/business` | — |
| Media library on a store-type account | `/media` route (unreachable in-app) | `/gallery` exists but is portfolio-nav-only | `MCP-DISC-114`, `MCP-DISC-117` |
| Store creation wizard | `screens/wizard/create_store_wizard.dart` (reachable) | delegated to the accounts app | — |
| Live storefront preview | `screens/preview/live_preview_screen.dart` (reachable) | only inside the theme editor | — |
| Dedicated KYC screen | `screens/kyc/kyc_screen.dart` (unreachable in-app) | inside `settings/business` | `MCP-DISC-117` |
| **Provider-mode badge on the payouts surface** | `money_screen.dart:220,227,231` | **missing** | `MCP-DISC-101` |

### 10.2 In web, absent from Flutter

Smart collections · categories · inventory history · reservations · receipts · the operations dashboard · customer segments · blog comment moderation · theme translations · theme safe-update · `settings/policies` · `settings/checkout` · **and all four non-store site types** (portfolio / resume / landing / blog). Mobile is store-only, so a portfolio, resume, landing or blog merchant has **no mobile app at all**.

### 10.3 Capability parity summary

| Capability | Web | Mobile | Reachable on mobile? |
|---|---|---|---|
| Orders list + detail | yes | yes | yes |
| Order refund (step-up) | yes | see Agent D/mobile scope | — |
| Returns / RMA | **no** | yes | **no** |
| Products + product form | yes | yes | yes |
| Product CSV import | yes | yes | yes |
| Collections | yes | yes | **no** |
| Smart collections | yes | **no** | — |
| Inventory levels/adjust | yes | yes | **no** |
| Locations / suppliers / POs / transfers | yes | yes | **no** (parent unreachable) |
| Inventory history / reservations / receipts | yes | **no** | — |
| Customers + detail | yes | yes | yes |
| Customer segments | yes | **no** | — |
| Coupons | yes | yes | **no** |
| Gift cards | yes | yes | **no** |
| Payouts / wallet / commission | yes (payouts only) | yes (all three) | yes |
| Billing / plan | yes | yes | **no** (billing); yes (pricing) |
| KYC | yes (inside business settings) | yes (dedicated) | **no** |
| Two-factor | yes | yes | **no** |
| Staff | yes | yes | **no** |
| Reviews / leads / campaigns | yes | yes | **no** |
| AI studio | yes (read-only) | yes | **no** |
| Shipping / taxes | yes | yes | **no** |
| Pages / blog / navigation / media | yes | yes | **no** |
| Apps marketplace | yes (frozen target) | yes | **no** |
| Theme editor | yes (full) | `theme_screen.dart` exists | **no** |
| Analytics | yes | yes | yes |
| GST tax invoice / packing slip / shipping labels | **no** | **no** | — |
| Portfolio / resume / landing / blog site types | yes | **no** | — |

---

## 11. Dead / no-op affordances

| # | Surface | Evidence (`path:line`) | Class | Gap |
|---|---|---|---|---|
| 1 | Dashboard trial banner **"Select a plan"** | `src/components/TrialBanner.tsx:69-75` — `<a href="#" … onClick={(e) => e.preventDefault()}>Select a plan</a>`; rendered by `AdminShell.tsx:151-156` | **Button with no handler** — complete no-op on the platform's primary in-product conversion path | `MCP-DISC-104` |
| 2 | Trial banner **"Extend your trial"** | `TrialBanner.tsx:61` copy; no extend action anywhere in the app | Copy promises an action that does not exist | `MCP-DISC-104` |
| 3 | Trial banner feature bullets | `TrialBanner.tsx:64-68` — "Unlimited products / Custom domain / Priority support" hardcoded | **Fake data rendered as real** (not plan-derived) | `MCP-DISC-104` |
| 4 | Trial banner dismiss | `TrialBanner.tsx:13,51` — `useState` only | **Form/action with no persistence** — banner returns every visit | `MCP-DISC-104` |
| 5 | Setup-assistant progress source | `src/components/AISidebar.tsx:122,131` — fetches `/api/store-data?...`; `find src/app/api -type d -name store-data` → nothing | **Always-404 data source**, failures swallowed at `:119-136` | `MCP-DISC-110` |
| 6 | Setup-assistant checkboxes | `AISidebar.tsx:146-151 toggleTodo` | **No persistence** — ticks reset on every open | `MCP-DISC-110` |
| 7 | AI Studio six tool cards | `src/app/[store]/ai/page.tsx:49-84` (hardcoded catalogue) + `:296` unconditional `<Badge label="Available" variant="success"/>`; zero handlers or links on the page | **Fake availability rendered as real** + six affordances with no handler | `MCP-DISC-111` |
| 8 | Plan checkout "N offers included" | `src/lib/billing/plan-ui.ts:208-217` → `CheckoutClient.tsx:645-660` | **Unbacked monetary promise** at the point of payment; grep across `services/`, `packages/`, `database/` finds no implementation | `MCP-DISC-103` |
| 9 | Plan-selection competitor table | `plan-ui.ts:170-185` → `SelectPlanClient.tsx:81` | **Hardcoded competitor pricing presented as current fact** | `MCP-DISC-103` |
| 10 | Commerce OS plan highlights | `plan-ui.ts:187-196` → `SelectPlanClient.tsx:387` | Sells "B2B catalogs", "AI Copilot", "Enterprise automations", "Dedicated success manager"; `grep -rln "b2b" services/api-gateway/src/routes/` → nothing | `MCP-DISC-103` |
| 11 | Campaign send toast | `src/app/[store]/marketing/page.tsx:388-395` — `variant:'success'`, "N emails sent", fired without consulting `result.sandbox` which the same handler holds at `:373-379` | **Success reported for a non-event** (a correcting banner exists at `:612-624`) | `MCP-DISC-118` |
| 12 | Bulk export success toast | `src/app/[store]/export/page.tsx:183-187,226-230,257-261` — reports the truncated count as the total, `variant:'success'` | **Success reported over silent data loss** | `MCP-DISC-102` |
| 13 | Dashboard "Analytics are still warming up" | `dashboard/page.tsx:247-249` (`catch { return emptyDashboardHomeData() }`), `:252-264`; banner `DashboardClient.tsx:585-589` | **Hard failure rendered as a benign state**, money figures shown as ₹0 | `MCP-DISC-113` |
| 14 | Commission "0%" | `settings/business/page.tsx:400` (`?? 0` on a best-effort fetch that fails silently at `:247-252`), `:623` `.toFixed(0)`, `:620` hardcoded copy | **Confident zero on failure** + rounding (25 bps → "0%", 50 bps → "1%") | `MCP-DISC-113` |
| 15 | Liquid canary badge | `src/components/theme-editor/controls/LiquidControl.tsx:71-79` — always renders "NOT-CONNECTED — Liquid rendering disabled (canary flag off)" regardless of actual flag state | **Hardcoded status badge** — honest today, will lie the moment a canary flips on | `MCP-DISC-111` (family) |
| 16 | Orders list filters | `orders/page.tsx` local state; `merchantNavigation.ts:66-68` confirms the page never reads `useSearchParams` | Filter state not URL-addressable → no shareable/bookmarkable filtered views | `MCP-DISC-109` (family) |
| 17 | `/[store]/online-store` | `page.tsx` client-side `router.replace` returning `null` | Blank frame before redirect; should be a server `redirect()` | `MCP-DISC-120` |
| 18 | `themes/update` + `editor/translations` pages | zero inbound links (see §7) | **Shipped features with no entry point** | `MCP-DISC-114` |
| 19 | Settings "Store foundation" phase card | `settings/page.tsx:37,110` | Advertises "language settings", silently drops the item, renders 2/2 | `MCP-DISC-114` |
| 20 | Flutter `PlatformBlockedService` | `apps/mobile/merchant-app/lib/services/platform_blocked_service.dart:25` — `static const features = <PlatformBlockedFeature>[];` | **Inert mechanism**: `featureForRoute` can never match, `PlatformBlockedScreen` can never render, the 34 `/features/*` aliases have no consumer | `MCP-DISC-117` |
| 21 | Flutter unreachable screens | §9.1 — 20 primary routes and 5 direct-push screens with no in-app entry point | **Dark code in a shipping binary** | `MCP-DISC-117` |

Grep for the classic fabrication tells (`TODO`, `FIXME`, `coming soon`, `not implemented`, `placeholder data`, `mock`, `sample data`, `dummy`, `lorem`) across `src/**/*.{ts,tsx}` returns **no fabricated-data residue** — the only "coming soon" strings are data-driven (`SelectPlanClient.tsx:177,217` from `plan.status`) or honest (`settings/page.tsx:151` for `status:'backend-needed'`). The defects above are specific and enumerable, not systemic fakery.

---

## 12. Provider-mode honesty badge coverage

Rule: `AGENTS.md:254` (PAY-R10) and `AGENTS.md:293` (UI-R6) — *"Every money/fulfillment surface renders a truthful mock/sandbox/live badge"*. Component: `src/components/ProviderModeBadge.tsx:13-23`; `normalizeProviderMode` maps `'test' → 'sandbox'`; **`:14` returns `null` for an unknown/absent mode**, which is itself a soft honesty hole (an unresolved mode renders nothing rather than "unknown").

| Surface | Money surface? | Badge present? | Evidence |
|---|---|---|---|
| `settings/payments` | yes | **YES** | `page.tsx:365` |
| `settings/shipping` | fulfilment | **YES** | `page.tsx:459` |
| `settings/billing` (payment methods) | yes | **YES** | `components/billing/BillingPaymentMethods.tsx:166` |
| `settings/billing/profile` | yes | partial — parses `provider_mode` at `:47` | |
| `settings/business` (KYC) | yes | partial — bespoke `kyc.provider_mode === 'sandbox'` block at `:434`, not the shared badge | |
| Orders → **fulfilment** panel | fulfilment | **YES** | `orders/page.tsx:784` ("Carrier provider") |
| Orders → **refund** panel | **yes — highest stakes** | **NO** | `orders/page.tsx:798-825` |
| `orders/[orderId]` detail | yes | **NO** | zero `ProviderModeBadge` occurrences |
| `payouts` | **yes — money out** | **NO** | zero occurrences |
| `products/gift-cards` | **yes — stored-value liability** | **NO** | zero occurrences |
| `access_account/checkout/checkout` | **yes — the merchant is paying** | **NO** | zero occurrences |
| `marketing` campaign send | no (delivery) | no badge — honest banner instead (`page.tsx:612-624`) | acceptable but inconsistent |
| `dashboard` money metrics | yes | **NO** | |
| Flutter `money_screen` (payouts/wallet/commission) | yes | **YES** | `lib/screens/money/money_screen.dart:220,227,231` |
| Flutter `home_screen` | yes | **YES** | `lib/screens/dashboard/home_screen.dart:728` |
| Flutter `billing_screen` | yes | **YES** | `lib/screens/settings/billing_screen.dart:250` |

**Coverage: 4 of 11 web money/fulfilment surfaces fully badged. Mobile badges the payouts surface; web does not.** → `MCP-DISC-101`.

---

## 13. Implemented vs missing

### 13.1 Implemented (static-verified, not runtime-verified)

- 77 merchant pages, 130 same-origin proxies, **zero direct database access** in the UI (no `supabase`/`createClient`/service-role import anywhere in `src/` outside the proxy layer).
- **Zero dead navigation links** across 61 nav/shortcut/quick-action targets.
- A single, consistently applied tenancy gate (`[store]/layout.tsx:19-28`) plus per-proxy ownership re-resolution (`src/lib/stores/resolve-owned-store.ts`).
- A real, cryptography-backed TOTP step-up on **refund** and **payout release** — `StepUpDialog.tsx:79,102` performs a genuine factor lookup / enrolment / challenge round-trip and passes the returned token through; it is not a string-length check.
- Payout rows are typed in **minor units** (`payouts/page.tsx:16-18`) and divided by 100 only for display (`:29`) — consistent with the bigint-paise law.
- Honest degradation primitives that are actually used: `BackendNeededPane` (`settings/custom-data`), the sandbox banner on campaign send, the `NOT-CONNECTED` badge on Liquid, archived dead-code contract tests.
- 44/77 routes handle loading, empty and error states; the analytics, operations-dashboard, AI, marketing, orders, payouts and gift-card pages all have real `Skeleton` + `EmptyState` + retry `Banner`.

### 13.2 Missing

| Missing | Where it should live | Gap |
|---|---|---|
| Returns / RMA merchant surface | a Returns page under Orders + `orders/[orderId]` actions | `MCP-DISC-100` |
| GST tax invoice view/download | `orders/[orderId]` action | `MCP-DISC-100` |
| Packing slip print | `orders/[orderId]` action | `MCP-DISC-100` |
| Shipping label rate / buy / print / void | fulfilment panel + order detail | `MCP-DISC-100` |
| Provider-mode badge on refund, payouts, gift cards, order detail, plan checkout, dashboard | those surfaces | `MCP-DISC-101` |
| Paginated (or server-streamed) bulk export | `export` | `MCP-DISC-102` |
| GST/tax column in the orders CSV | `export/page.tsx:204` header list | `MCP-DISC-102` |
| Any permission gating in either client | nav builder + destructive actions | `MCP-DISC-105` |
| A single shared role vocabulary | `packages/*` shared with Dart generation | `MCP-DISC-107` |
| Shared GSTIN validation on `settings/business` | `src/lib/india/` | `MCP-DISC-106` |
| Order actions on the order detail page | `orders/[orderId]` | `MCP-DISC-109` |
| A working setup-assistant data source | `AISidebar` → the already-built `dashboard/setup` proxy | `MCP-DISC-110` |
| An AI generate proxy + invocation UI | `/api/stores/[store]/ai/generate` + `ai` page | `MCP-DISC-111` |
| Period-scoped order breakdown | analytics proxy + gateway loader | `MCP-DISC-112` |
| Distinct "analytics failed" state | `dashboard` | `MCP-DISC-113` |
| Entry points for `themes/update`, `editor/translations`, store-type `gallery` | nav + themes page + editor | `MCP-DISC-114` |
| A consumer-side token-resolution validator | `scripts/validators/` | `MCP-DISC-115` |
| A frozen-runtime outbound-link validator | `scripts/validators/` | `MCP-DISC-116` |
| Mobile navigation for ~20 registered routes | Flutter More tab / home | `MCP-DISC-117` |
| Mobile support for the four non-store site types | Flutter | out of scope for launch? — founder call |

### 13.3 End-to-end traces (navigation-layer; every trace stops at the gateway boundary)

**(a) Refund — the highest-stakes merchant money action reachable from navigation. [HIGH-STAKES]**

```
Merchant entry point : sidebar "Orders" (merchantNavigation.ts:65, shortcut `g o`)
-> page/route         : /[store]/orders (orders/page.tsx) — list row expansion, "Refund" (orders/page.tsx:437)
-> step-up            : StepUpDialog(action='refund.approve') (orders/page.tsx:681)
                        GET  /api/stores/:s/security/two-factor        (StepUpDialog.tsx:79)
                        POST /api/stores/:s/security/two-factor/enroll (StepUpDialog.tsx:102) if no active factor
                        POST /api/stores/:s/security/step-up           -> { token, verifiedAt }
-> app proxy          : POST /api/stores/:s/orders/:id/refund
                        body: idempotency_key = `refund-${id}-${crypto.randomUUID()}`,
                              amount_minor = Math.round(parseFloat(input)*100)   <- CLIENT-SUPPLIED
                              step_up_token, step_up_verified_at
                        src/app/api/stores/[store]/orders/[orderId]/refund/route.ts -> resolveOwnedStoreId -> gateway
-> typed client       : src/lib/api/client.ts (internal HMAC session headers, :62-80)
-> /v1 gateway route  : NOT TRACED HERE (Agent A/D)
-> auth issuer/authz  : merchant ES256 session + store ownership at the proxy; NO role/permission check   MISSING
-> server-authoritative amount cap : UNVERIFIED — the UI sends a client-typed amount              MISSING (verify)
-> RPC/tables + RLS   : NOT TRACED HERE (Agent D)
-> provider mode shown to merchant : MISSING (no ProviderModeBadge on the refund panel)           MISSING
-> refundable remainder shown      : MISSING (only the full order total as a placeholder)         MISSING
-> UI consequence     : success toast "Refund recorded" + loadOrders() refetch
-> tests              : tests/launch/lb34-stepup-frontend.test.mjs references this app (contents not read)
-> runtime            : NOT OBSERVED
```

**(b) Returns / RMA — the capability with no web entry point at all. [HIGH-STAKES]**

```
Merchant entry point : MISSING — no nav item, no page, no proxy
-> page/route         : MISSING
-> app proxy          : MISSING (the 130-proxy inventory contains no `returns` route)
-> typed client       : MISSING
-> /v1 gateway route  : PRESENT — services/api-gateway/src/routes/returns.ts:131 GET /, :170 GET /:id,
                        :186 POST /, :214 PATCH /:id, :259 POST /:id/refund/complete
-> mobile equivalent  : PRESENT but UNREACHABLE — apps/mobile/merchant-app/lib/screens/orders/returns_screen.dart,
                        route `/returns` (routes.dart), navigated to by nothing
-> web consequence    : orders/[orderId]/page.tsx:516,544 renders a read-only `return_status` badge only
-> tests              : none found on the web side
-> runtime            : NOT OBSERVED
```

**(c) Trial conversion — the navigation path that dead-ends.**

```
Merchant entry point : dashboard trial banner (AdminShell.tsx:151-156, dashboard only)
-> CTA                : TrialBanner.tsx:69-75  href="#" + onClick preventDefault()      MISSING (no destination)
-> intended page      : /[store]/access_account/checkout/select-plan  (EXISTS, already linked from
                        settings/plan/page.tsx:273)
-> app proxy          : /api/subscribe, /api/subscribe/coupon, /api/subscribe/verify (exist)
-> /v1 gateway route  : NOT TRACED HERE (Agent D)
-> consequence        : the only in-product conversion affordance on the dashboard does nothing
-> tests              : none asserting the CTA target
-> runtime            : NOT OBSERVED
```

---

## 14. Gap IDs

Allocated from block **MCP-DISC-100 – MCP-DISC-129**. Lowest number = most severe. Statuses use the exact taxonomy strings. Every entry below is a static-evidence finding; **none is runtime-verified**.

---

### MCP-DISC-100 — Returns/RMA, GST tax invoice, packing slip and shipping labels have gateway support but no web merchant surface — [HIGH-STAKES]

- **Domain:** merchant UI / fulfilment / India compliance
- **Status:** `BACKEND_ONLY`
- **User/business impact:** Four merchant-critical workflows exist server-side and are unreachable from the merchant web OS. (1) **Returns/RMA** — the merchant cannot see, approve, reject or refund a return on the web; only a read-only badge. (2) **GST tax invoice** — an Indian merchant cannot view or download the GST invoice for an order. (3) **Packing slip** — cannot print. (4) **Shipping labels** — cannot rate, buy, print or void; fulfilment is manual tracking-number entry.
- **Evidence:**
  - Returns backend `GATEWAY_CODE`: `services/api-gateway/src/routes/returns.ts:131` (`GET /`), `:170` (`GET /:id`), `:186` (`POST /`), `:214` (`PATCH /:id`), `:259` (`POST /:id/refund/complete`).
  - Web absence `PROXY_CODE`: no `returns` route in the 130-proxy inventory; `apps/merchant-control-plane/src/app/[store]/orders/[orderId]/page.tsx:516,544` renders `return_status` read-only.
  - Mobile has it but cannot reach it `UI_CODE`: `apps/mobile/merchant-app/lib/screens/orders/returns_screen.dart` + `lib/services/return_service.dart`; route `/returns` navigated to by nothing (§9.1).
  - GST invoice `GATEWAY_CODE`: `services/api-gateway/src/routes/tax.ts:119` (`GET /invoice/:orderId`); web grep for `tax.invoice|taxInvoice` in `apps/merchant-control-plane/src` → 0.
  - Packing slip `GATEWAY_CODE`: `services/api-gateway/src/routes/orders.ts:913` builds packing-slip HTML; web grep for `packing` → 0.
  - Shipping labels `GATEWAY_CODE`: `services/api-gateway/src/routes/shipping-labels.ts:256` (`POST /rates`), `:279` (`POST /`), `:364` (`GET /:id/pdf`), `:397` (`POST /:id/void`). The web app consumes **only** `:266 GET /provider-mode`, at `apps/merchant-control-plane/src/app/api/stores/[store]/shipping/zones/route.ts:20`, purely to render the honesty badge. Fulfilment UI is a free-text tracking input at `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:785-791`.
- **Expected behavior:** each of these reachable from the merchant web OS.
- **Missing link / root cause:** app proxies + pages/actions. **Not** a backend gap — the endpoints exist. Root cause is scope sequencing.
- **Blast radius:** every merchant handling a return or needing a tax invoice. GST invoice access is a statutory expectation in India.
- **Invariant:** **[HIGH-STAKES]** — returns touch refunds (money out); GST invoices are compliance artefacts.
- **Severity:** P1 (returns + GST invoice) · P2 (labels + packing slip) · **Likelihood:** HIGH
- **Dependencies:** none technical. Requires a scope decision and `MCP-DISC-109` (there is nowhere natural to put the actions until the order detail page can act).
- **Remediation approach:** add same-origin proxies mirroring the existing gateway routes (never write the DB locally, never mutate money outside the SECURITY DEFINER RPCs); add a Returns page under Orders; add invoice / packing-slip actions to the order detail page; decide whether labels are launch scope.
- **Acceptance criteria:** a merchant can approve a return and complete its refund from the web; a merchant can open the GST invoice for a paid order; every new proxy is a gateway proxy with ownership resolution.
- **Required tests:** proxy contract tests; an integration test for return-approve → refund-complete; an India-compliance test that a paid order exposes an invoice.
- **Required owner:** founder (scope) + lead engineer + CA-tax (invoice content)
- **Reversibility:** additive, fully reversible · **Confidence:** HIGH

---

### MCP-DISC-101 — Provider-mode honesty badge missing on refunds, payouts, gift cards, order detail and plan checkout — [HIGH-STAKES] [IRREVERSIBLE]

- **Domain:** merchant UI / payments honesty
- **Status:** `PARTIAL`
- **User/business impact:** UI-R6 / PAY-R10 require a truthful mock/sandbox/live badge on **every** money and fulfilment surface. Coverage is 4 of 11. A merchant issuing a refund in sandbox sees the same "Refund recorded" success toast as in live, with no indication the provider is a sandbox — the customer is not paid and nobody on the merchant side can tell.
- **Evidence:**
  - Rule `DOC_CLAIM`: `AGENTS.md:254` (PAY-R10), `AGENTS.md:293` (UI-R6), `AGENTS.md:322` (ANTI-R9).
  - Component `UI_CODE`: `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx:13-23`; `:14` `if (!mode) return null` — an unknown mode renders nothing rather than an explicit unknown.
  - Present: `settings/payments/page.tsx:365`; `settings/shipping/page.tsx:459`; `components/billing/BillingPaymentMethods.tsx:166`; `orders/page.tsx:784` (fulfilment panel only).
  - Absent: `orders/page.tsx:798-825` (**refund panel**); `payouts/page.tsx` (0 occurrences); `products/gift-cards/page.tsx` (0); `orders/[orderId]/page.tsx` (0); `access_account/checkout/checkout/CheckoutClient.tsx` (0); `dashboard/DashboardClient.tsx` (0).
  - Mobile covers more `UI_CODE`: `apps/mobile/merchant-app/lib/screens/money/money_screen.dart:220,227,231`; `lib/screens/dashboard/home_screen.dart:728`; `lib/screens/settings/billing_screen.dart:250`.
- **Expected behavior:** the badge on every money/fulfilment surface, with an explicit state when the mode is unknown.
- **Missing link / root cause:** the badge was added surface-by-surface with no enumerating validator.
- **Blast radius:** all merchant money actions on web.
- **Invariant:** **[HIGH-STAKES]**, **[IRREVERSIBLE]** — a sandbox refund believed to be live leaves a real customer unpaid.
- **Severity:** P1 · **Likelihood:** MEDIUM (bites only in sandbox/mock — which is precisely the pre-launch state)
- **Dependencies:** each surface needs the provider mode on its server payload (payments/shipping already have it).
- **Remediation approach:** render `ProviderModeBadge` on the refund panel, payouts, gift cards, order detail and plan checkout, sourcing the mode from the same server field; make an unresolved mode render an explicit "unknown" rather than nothing. Do **not** infer the mode client-side.
- **Acceptance criteria:** a validator enumerates money/fulfilment surfaces and fails when one lacks the badge; a sandbox refund visibly reads as sandbox before and after submission.
- **Required tests:** a governance validator listing money surfaces (extend the existing honesty-validator family) + UI tests asserting the badge renders with `mode='sandbox'` and with an unknown mode.
- **Required owner:** security / payments-provider + lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-102 — Bulk export silently truncates at 100 rows and reports success — [HIGH-STAKES]

- **Domain:** merchant UI / data portability / accounting
- **Status:** `BROKEN`
- **User/business impact:** "Export and import" downloads at most 100 products, 100 orders and 100 customers with no pagination, no warning, and a green success toast naming the truncated count as though it were the total. A merchant exporting orders for accounting, GST reconciliation or a platform migration silently loses everything past row 100 and is told the export succeeded.
- **Evidence `UI_CODE`:**
  - `apps/merchant-control-plane/src/app/[store]/export/page.tsx:151` — `fetch(\`/api/stores/${...}/products?limit=100\`)`
  - `:187` — `new URLSearchParams({ limit: '100' })` for orders
  - `:232` — `customers?limit=100`
  - Success toasts at `:183-187`, `:226-230`, `:257-261` present the truncated count as the result, `variant: 'success'`.
  - No loop over `meta.has_next` / `page` anywhere in the file, although the orders proxy returns `has_next` (`src/app/api/stores/[store]/orders/route.ts:37`).
  - The route has **no loading, no empty and no error UI** — everything is toast-only (§4, row 19).
- **Expected behavior:** the export contains every row, or the merchant is told plainly that it is partial and why.
- **Missing link / root cause:** pagination was never implemented; the limit was likely a development default.
- **Blast radius:** any store with more than 100 of anything — i.e. any real store.
- **Invariant:** **[HIGH-STAKES]** (the orders CSV is what a merchant hands an accountant); **[IRREVERSIBLE]** in the sense that a migration performed off a truncated file loses data.
- **Severity:** P1 · **Likelihood:** HIGH
- **Dependencies:** whether the gateway also imposes a 100-row cap is **UNVERIFIED** (Agent D) — a client-side fix may not be sufficient.
- **Remediation approach:** paginate to completion, or move to a server-side streamed export job; until then the toast must state the row count **and** whether more rows remain, and must not be `variant:'success'` when partial.
- **Acceptance criteria:** a 250-order store exports 250 rows; a partial export cannot render a success toast without saying it is partial.
- **Required tests:** an integration test over a >100-row fixture asserting the full row count; a UI test that a truncated result renders a warning, not a success.
- **Required owner:** lead engineer (+ CA-tax on required columns)
- **Reversibility:** fully reversible · **Confidence:** HIGH
- **Adjacent:** the orders CSV writes `customer_name, customer_email, customer_phone` (`export/page.tsx:205-209`) with no confirmation step and no audit hook visible from the UI — compliance owner should review. The CSV also has **no tax/GST column** (`:204` header list), so it cannot serve GST filing even when complete.

---

### MCP-DISC-103 — Unbacked monetary offers rendered inside the paid-plan checkout — [HIGH-STAKES]

- **Domain:** merchant UI / billing / consumer protection
- **Status:** `STUB_OR_MOCK`
- **User/business impact:** At the moment the merchant is about to pay, the checkout renders an accordion headed "N offers included" containing two promises of monetary value — subscription credits toward future bills for connecting a custom domain, and bonus AI credits plus a free store-setup review in the first 30 days on any paid plan. No implementation of either exists anywhere in the repository.
- **Evidence:**
  - Definition `UI_CODE`: `apps/merchant-control-plane/src/lib/billing/plan-ui.ts:208-217`.
  - Rendered at the point of payment `UI_CODE`: `apps/merchant-control-plane/src/app/[store]/access_account/checkout/checkout/CheckoutClient.tsx:645-660`.
  - Absence of `SERVICE_CODE` / `DB_SCHEMA`: grep for `domain credit|domain_credit|subscription_credit|onboarding bonus|store-setup review` across `services/`, `packages/`, `database/`, `apps/merchant-control-plane/src` returns **only the copy string itself**.
  - The file's own comment (`plan-ui.ts:205-207`) concedes these are "Informational/marketing — distinct from coupon codes (which are DB-driven…)".
- **Expected behavior:** any credit or bonus shown at checkout is backed by a real, auditable issuance path, or it is removed.
- **Missing link / root cause:** no subscription-credit ledger concept exists.
- **Blast radius:** every paid conversion.
- **Invariant:** **[HIGH-STAKES]** — money promised to a paying customer with no mechanism to honour it; India consumer-protection exposure.
- **Severity:** P1 · **Likelihood:** HIGH (unconditional on every non-free checkout)
- **Dependencies:** a subscription-credit concept (does not exist), or founder sign-off to remove.
- **Remediation approach:** founder decision first — either remove the accordion, or build issuance **through the canonical SECURITY DEFINER ledger RPCs** (never a direct money-table write) with an explicit terms page. Do not leave the copy while the mechanism is absent.
- **Acceptance criteria:** every offer rendered at checkout resolves to an implemented, auditable issuance path, or the block is gone.
- **Required tests:** a contract test that `SUBSCRIPTION_OFFERS` is empty or every entry maps to a known issuance capability.
- **Required owner:** founder (+ legal/CA)
- **Reversibility:** reversible (copy removal) · **Confidence:** HIGH on absence-in-repo; MEDIUM on whether an out-of-band manual process exists
- **Adjacent, same file, lower severity:** `plan-ui.ts:170-185` hardcodes competitor pricing shown as current fact (stale-claim risk, owner: founder); `plan-ui.ts:187-196` sells "B2B catalogs", "Enterprise automations", "Dedicated success manager" — `grep -rln "b2b" services/api-gateway/src/routes/` returns nothing.

---

### MCP-DISC-104 — Dashboard trial-banner "Select a plan" CTA is a hard-coded no-op

- **Domain:** merchant UI / monetisation
- **Status:** `BROKEN`
- **User/business impact:** Every trialing merchant sees a "Select a plan" button on the dashboard. Clicking it does nothing. This is the platform's primary in-product conversion affordance and it is dead. A merchant who wants to pay cannot from here.
- **Evidence `UI_CODE`:** `apps/merchant-control-plane/src/components/TrialBanner.tsx:69-75` —
  ```tsx
  <a href="#" className="admin-trial-toast-btn" onClick={(e) => e.preventDefault()}>Select a plan</a>
  ```
  Rendered only on the dashboard: `apps/merchant-control-plane/src/components/AdminShell.tsx:151-156`. A working destination already exists at `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/page.tsx` and is already linked from `apps/merchant-control-plane/src/app/[store]/settings/plan/page.tsx:273`.
- **Expected behavior:** the CTA navigates to `/{store}/access_account/checkout/select-plan`.
- **Missing link / root cause:** UNKNOWN — plausibly a placeholder that outlived the build-out of the select-plan route.
- **Same component, same gap:** the banner offers "Extend your trial" in copy (`:61`) with no extend action anywhere; the feature list (`:64-68`) is hardcoded rather than plan-derived; `dismissed` (`:13,51`) is local state so the banner returns on every dashboard visit.
- **Blast radius:** every trialing merchant on every dashboard view.
- **Invariant:** none technically; revenue-blocking.
- **Severity:** P1 · **Likelihood:** HIGH (unconditional)
- **Dependencies:** none — the destination route already exists.
- **Remediation approach:** point the CTA at the existing select-plan route (or remove the CTA and rely on `settings/plan`); drive the feature bullets from the plan payload; persist dismissal server-side or with a bounded local key.
- **Acceptance criteria:** clicking "Select a plan" lands on the plan selector for the current store; the bullets reflect the merchant's actual plan; a dismissed banner stays dismissed for a defined window.
- **Required tests:** a unit assertion that `TrialBanner` renders no `href="#"`; an E2E that clicks the CTA and asserts the resulting URL.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-105 — Staff permissions are defined and persisted but gate nothing in either client — [HIGH-STAKES]

- **Domain:** merchant UI / authorization affordance
- **Status:** `BACKEND_ONLY` (as far as either client is concerned)
- **User/business impact:** A merchant invites a `viewer` (read-only) or `editor` (catalogue only). Both are served the identical navigation and the identical action buttons as the owner — including **Money → Payouts** with its "Release" button, **Gift cards**, **Settings → Payments**, **Settings → Users**, and the **Refund** button on every paid order. Even if the gateway rejects the call, the merchant's mental model of "who can do what" is broken and staff routinely hit 403s on buttons the product offered them.
- **Evidence:**
  - Catalogue exists and is persisted `UI_CODE`: `apps/merchant-control-plane/src/lib/staff/roles.ts:25-38` (12 permissions), `:46-92` (6 roles), `:108-110 permissionsForRole`; written at `apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx:199,230`.
  - Nothing consumes it: grep for `hasPermission|canAccess|user\.role|currentRole` across `apps/merchant-control-plane/src` excluding `app/api` → hits only inside `settings/users/page.tsx` (label rendering).
  - The nav builder is role-blind `UI_CODE`: `apps/merchant-control-plane/src/components/AdminShell.tsx:184-202 buildNavigationSections(store, siteType)` takes only the site type.
  - The session model carries no role `UI_CODE`: `apps/merchant-control-plane/src/lib/auth/session.ts:82-87 SessionUser = { id, email, fullName, avatarUrl }`.
  - Flutter is the same `UI_CODE`: `apps/mobile/merchant-app/lib/app/role_gate.dart` defines `StaffRoleGate` with four capability predicates; the only consumer in the whole app is a display chip at `apps/mobile/merchant-app/lib/screens/settings/staff_screen.dart:200`.
- **Expected behavior:** navigation and destructive actions reflect the signed-in staffer's permissions, as defence in depth over server enforcement.
- **Missing link / root cause:** the role never reaches the client session model, so nothing downstream can gate on it.
- **Server-side status:** `tests/launch/lb-merchant-admin.test.mjs` names tests for a "Staff RBAC enforcement middleware… owner-bypass + fail-safe by design" and "products write routes wired to the staff guard" — **not read or verified here**; Agent A owns that. The UI-layer gap stands regardless.
- **Blast radius:** every multi-staff store, both clients.
- **Invariant:** **[HIGH-STAKES]** — payouts and refunds are exposed to every role in the UI.
- **Severity:** P2 (**P1 if server enforcement is also absent** — Agent A to resolve) · **Likelihood:** HIGH once merchants add staff
- **Dependencies:** `MCP-DISC-107` (a single role vocabulary must exist first).
- **Remediation approach:** carry the staff role/permissions on the session, filter `getMerchantNavigation` and the settings nav by permission, hide or disable destructive actions the role lacks — **never as a replacement for server enforcement**.
- **Acceptance criteria:** a `viewer` session shows no Payouts nav item and no Refund button; a `fulfillment` session shows Orders but not Settings → Payments.
- **Required tests:** UI tests per role; a contract test that the nav builder consumes permissions.
- **Required owner:** security + lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH on the UI-layer facts; UNKNOWN on server enforcement

---

### MCP-DISC-106 — Two GSTIN capture surfaces with divergent validation — [HIGH-STAKES]

- **Domain:** merchant UI / India compliance
- **Status:** `PARTIAL`
- **User/business impact:** GSTIN can be captured in two places. One validates the format; the other does not. A malformed GSTIN saved from Business details flows into GST tax invoices, which are immutable once issued.
- **Evidence `UI_CODE`:**
  - Validating surface: `apps/merchant-control-plane/src/app/[store]/settings/billing/profile/page.tsx:62` — a full checksum-shaped `GSTIN_RE` regex, applied to the input.
  - Non-validating surface: `apps/merchant-control-plane/src/app/[store]/settings/business/page.tsx:489` renders the GSTIN input; `:275-281 onGstinChange` only uppercases and derives the state code via `deriveGstStateCode` (`src/lib/india/gst-states.ts`); `:299 handleSave` PATCHes `gstin: data.gstin || null` to `/api/stores/:s/settings`. Grep for `GSTIN_RE|validateGstin|pattern=` in that file → **0 hits**.
  - Stakes stated in-product: `settings/business/page.tsx:485` — the copy tells the merchant a GSTIN enables compliant GST tax invoices.
- **Expected behavior:** one validation rule, applied on both surfaces, and enforced server-side.
- **Missing link / root cause:** the regex lives inline in one page instead of in the shared `src/lib/india/` module next to `gst-states.ts`.
- **Unknown:** whether the gateway rejects a malformed GSTIN — **NOT VERIFIED** here (Agent D/E).
- **Blast radius:** every merchant issuing GST invoices.
- **Invariant:** **[HIGH-STAKES]** (GST) and **[IRREVERSIBLE]** downstream (invoices are immutable once issued).
- **Severity:** P2 (**P1 if the server also does not validate**) · **Likelihood:** MEDIUM
- **Dependencies:** confirmation of server-side behaviour.
- **Remediation approach:** move the validator into `src/lib/india/`, use it on both surfaces, and require server-side rejection.
- **Acceptance criteria:** an invalid GSTIN cannot be saved from either surface; a server test rejects it.
- **Required tests:** a unit test on the shared validator; a gateway contract test; a GST audit assertion.
- **Required owner:** CA-tax (rule) + lead engineer (implementation)
- **Reversibility:** reversible for capture; downstream invoices are not · **Confidence:** HIGH on the UI divergence, UNKNOWN on server behaviour

---

### MCP-DISC-107 — Staff role catalogues diverge across web, Flutter and the documented DB constraint — [HIGH-STAKES]

- **Domain:** merchant UI / contract drift
- **Status:** `CONTRADICTORY_EVIDENCE`
- **User/business impact:** Three different role vocabularies. A role assigned on the web that Flutter does not know silently degrades to the least-privileged bucket, so the two clients would disagree about a staffer's capabilities the moment either starts gating on role.
- **Evidence:**
  - Web `UI_CODE`: `apps/merchant-control-plane/src/lib/staff/roles.ts:46-92` → `manager, editor, fulfillment, marketing, support, viewer`.
  - Flutter `UI_CODE`: `apps/mobile/merchant-app/lib/app/role_gate.dart:1-9` → `owner, admin, manager, editor, support, marketing, staff`; `:15-23` maps anything unrecognised (including `fulfillment` and `viewer`) to `MerchantStaffRole.staff`.
  - The web file's own comment (`roles.ts:3-5`) states the DB CHECK constraint is `support/sales/marketing/operations/manager/admin/editor/viewer/fulfillment/staff` — which matches **neither** client (`sales` and `operations` appear in neither).
  - Actual DB constraint: **NOT VERIFIED** here (Agent D/E).
- **Expected behavior:** one shared role vocabulary sourced from a single package.
- **Missing link / root cause:** no shared permission package; each client declared its own enum.
- **Blast radius:** every multi-staff store, both clients.
- **Invariant:** authorization-adjacent → **[HIGH-STAKES]**
- **Severity:** P2 · **Likelihood:** MEDIUM (latent until either client gates on role — `MCP-DISC-105`)
- **Dependencies:** the DB CHECK constraint must be read first.
- **Remediation approach:** define the catalogue once in a shared package, generate the Dart side from it as the token pipeline already does, and assert it against the DB CHECK constraint in a validator.
- **Acceptance criteria:** a validator proves web enum ≡ Flutter enum ≡ DB CHECK constraint.
- **Required tests:** the cross-client role validator.
- **Required owner:** security + lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH on the client divergence; UNKNOWN on the DB constraint

---

### MCP-DISC-108 — US-locale dates on merchant billing and other surfaces, blessed by a governance test — [HIGH-STAKES]

- **Domain:** merchant UI / India-first
- **Status:** `CONTRADICTORY_EVIDENCE`
- **User/business impact:** An Indian merchant reads invoice dates, next-charge date and trial-end date in US format while the rest of the product uses `en-IN`. On money and compliance surfaces this is genuinely ambiguous.
- **Evidence:**
  - Formatters are explicitly `en-US` `UI_CODE`: `packages/typescript/ui/src/formatting.ts:108-117` (`formatUsShortDate`), `:119-127` (`formatUsLongDate`).
  - Used on money surfaces: `apps/merchant-control-plane/src/app/[store]/settings/billing/page.tsx:200` (invoice date column), `:254` (upcoming charge), `:322` (trial end).
  - Also: `apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx:390`; `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:470,528`; `apps/merchant-control-plane/src/components/domains/DomainDetailView.tsx:195,287,319`.
  - **The contradiction** `UNIT_TEST` vs `DOC_CLAIM`: `tests/contracts/date-format-single-source.test.ts:29-30` asserts the US-formatted output of `formatUsShortDate`/`formatUsLongDate`, and `:38-48` only forbids *locally declared* formatter helpers — so governance sanctions US dates, while `CLAUDE.md`'s India-first standard mandates `en-IN` dates.
  - Separately, 10 call sites bypass the shared formatter with raw `toLocaleDateString('en-IN', …)`: `experience/page.tsx:77`, `projects/page.tsx:96`, `education/page.tsx:77`, `certifications/page.tsx:74`, `settings/security/page.tsx:190`, `products/gift-cards/page.tsx:343`, `CheckoutClient.tsx:182,193,200`, `FoundingMerchantCard.tsx:54`.
- **Expected behavior:** one documented decision — either the US formatters are removed from merchant surfaces, or governance explicitly records why US dates are correct for an India-first merchant OS.
- **Missing link / root cause:** the contract test was written around the existing formatters rather than around the India-first rule.
- **Blast radius:** billing history, staff admin, domains, CMS.
- **Invariant:** **[HIGH-STAKES]** on billing (invoice dating).
- **Severity:** P2 · **Likelihood:** HIGH
- **Dependencies:** an ARB/founder decision — this is a decision, not a bug fix.
- **Remediation approach:** decide, then either migrate the call sites to the India formatters and update the contract test, or record the exception in governance with a written rationale.
- **Acceptance criteria:** one documented rule; the contract test enforces it; no raw `toLocaleDateString` in app source.
- **Required tests:** the updated `date-format-single-source` contract test.
- **Required owner:** ARB (decision) + lead engineer (execution)
- **Reversibility:** fully reversible · **Confidence:** HIGH on the facts

---

### MCP-DISC-109 — The order detail page is read-only; every order action requires going back to the list

- **Domain:** merchant UI / order operations
- **Status:** `PARTIAL`
- **User/business impact:** `/{store}/orders/{orderId}` renders customer, items, totals, refund/return status — and offers **no order action at all**: no confirm, process, ship, deliver, cancel, refund, invoice, packing slip or label. The only buttons navigate to the customer profile or back to the list. All actions live on the list-row expansion, so a merchant who deep-links to an order (including from the mobile `orders/:id` deep link) must navigate back to act.
- **Evidence `UI_CODE`:** `apps/merchant-control-plane/src/app/[store]/orders/[orderId]/page.tsx` — the only `onClick` handlers are `:310-315` and `:331-336` (both `router.push` to the customer profile) and `:661,667` (retry / back). The page's only network call is `GET /api/stores/:s/orders/:id` (`:579`). Contrast `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:742-825`, where every action lives.
- **Expected behavior:** the detail page is the canonical place to act on one order.
- **Missing link / root cause:** the action component was built inline in the list page and never extracted.
- **Blast radius:** every order workflow; compounds `MCP-DISC-100` (there is nowhere natural to hang invoice / packing-slip / returns actions).
- **Invariant:** touches refunds → **[HIGH-STAKES]** by association.
- **Severity:** P2 · **Likelihood:** HIGH
- **Dependencies:** none.
- **Remediation approach:** lift the shared order-action component out of the list page and mount it on the detail page (one implementation, both surfaces), then hang invoice / packing-slip / returns off it.
- **Acceptance criteria:** every action available on a list row is available on the detail page.
- **Required tests:** a UI test asserting action parity between list row and detail page.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH
- **Related:** orders-list filter state is local-only and not URL-addressable (`orders/page.tsx`; `merchantNavigation.ts:66-68` confirms the page never reads `useSearchParams`), so filtered order views cannot be shared or bookmarked.

---

### MCP-DISC-110 — Setup assistant reads a non-existent endpoint; the onboarding checklist is permanently wrong

- **Domain:** merchant UI / onboarding
- **Status:** `BROKEN`
- **User/business impact:** The "Setup assistant" derives its checklist from a product count and a payment-configured flag. Both come from `/api/store-data`, which does not exist in this app. Both fetches 404, the failures are swallowed, and the fallbacks (`productCount = 0`, `hasPayment = false`) are used forever. The assistant therefore tells every merchant to "add your first product" and "set up payments" even after they have done both — on the first-run experience.
- **Evidence:**
  - `apps/merchant-control-plane/src/components/AISidebar.tsx:122` — `fetch(\`/api/store-data?store=${store}&type=product_count\`)`
  - `apps/merchant-control-plane/src/components/AISidebar.tsx:131` — `fetch(\`/api/store-data?store=${store}&type=payment_check\`)`
  - `PROXY_CODE` (absence): `find apps/merchant-control-plane/src/app/api -type d -name "store-data"` → no result; `grep -rn "store-data" src` → only these two lines.
  - Failures swallowed at `:119-127` and `:128-136` (`if (prodRes.ok)` + bare `catch {}`) — no error surface.
  - **The correct proxy exists and is orphaned:** `apps/merchant-control-plane/src/app/api/stores/[store]/dashboard/setup/route.ts:22-27` returns `{ productsCount, shippingZonesCount, pagesCount }` and is called by nothing.
- **Expected behavior:** the checklist reflects real store state.
- **Missing link:** `AISidebar` → `/api/stores/[store]/dashboard/setup` (payment status additionally needs `/api/stores/[store]/payment-config`, which exists and is used by `settings/payments`).
- **Blast radius:** every merchant, every session, from first login onward.
- **Invariant:** none · **Severity:** P2 · **Likelihood:** HIGH (unconditional)
- **Dependencies:** none.
- **Remediation approach:** repoint the two fetches at the existing proxies and surface a visible degraded state instead of silently assuming zero.
- **Acceptance criteria:** a store with ≥1 product and a configured payment method shows those items complete.
- **Required tests:** a contract test asserting `AISidebar` references only routes that exist under `src/app/api` — exactly the class of bug the existing `settings-apps-dead-twin` / `theme-editor-dead-shell` tests were written for.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH
- **Related:** the checklist ticks are local-only (`AISidebar.tsx:146-151`), so progress never persists.

---

### MCP-DISC-111 — AI Studio badges six capabilities "Available" with no way to invoke any of them

- **Domain:** merchant UI / AI
- **Status:** `UI_ONLY` (generation is `BACKEND_ONLY`)
- **User/business impact:** The AI Studio page renders six tool cards — product descriptions, SEO content, blog drafts, social posts, email copy, image alt text — each with an unconditional green "Available" badge. The page has **no generate button, no input, no link and no handler** for any of them; it only reads credits and usage history. A merchant on a paid plan sold on "AI features included" finds six advertised tools and no way to use one.
- **Evidence:**
  - Hardcoded catalogue `UI_CODE`: `apps/merchant-control-plane/src/app/[store]/ai/page.tsx:49-84`.
  - Unconditional badge `UI_CODE`: `:296` — `<Badge label="Available" variant="success" />`.
  - The page's only network call is a GET: `:123`.
  - The only AI proxy is read-only `PROXY_CODE`: `apps/merchant-control-plane/src/app/api/stores/[store]/ai/route.ts:5-29` (credits + usage).
  - **The backend is real and complete** `GATEWAY_CODE`: `services/api-gateway/src/routes/ai.ts:616 POST /generate` — validated, credit-gated (`:648-650` returns 402 `INSUFFICIENT_CREDITS`), provider-adapter-gated, and honest when unconfigured (`:663-689` records a failed `ai_usage` row and returns 503).
- **Expected behavior:** either each card invokes the generate endpoint through a proxy, or the badges report the capability's actual state.
- **Missing link:** a `POST /api/stores/[store]/ai/generate` proxy + any invocation UI.
- **Blast radius:** every merchant on a plan that advertises AI; `plan-ui.ts:193` also sells "AI Copilot" in the checkout highlights.
- **Invariant:** ANTI-R9 flavour — a non-invocable capability reads as `success`.
- **Severity:** P2 · **Likelihood:** HIGH
- **Dependencies:** none technical.
- **Remediation approach:** add the generate proxy and wire at least one tool end-to-end; until then drive the badge from a real capability signal (adapter availability from the gateway) rather than a string literal.
- **Acceptance criteria:** the badge state derives from server truth; any card showing "Available" produces a generation when clicked.
- **Required tests:** a contract test that no `variant="success"` capability badge on this page is a string literal; an integration test for the generate proxy.
- **Required owner:** lead engineer (+ founder on the plan copy)
- **Reversibility:** fully reversible · **Confidence:** HIGH
- **Same family:** `src/components/theme-editor/controls/LiquidControl.tsx:71-79` renders a hardcoded "NOT-CONNECTED — Liquid rendering disabled (canary flag off)" badge regardless of the actual flag. Honest today (Liquid is default-OFF), it will lie in the opposite direction the moment a per-theme canary flips on.

---

### MCP-DISC-112 — Analytics period selector does not scope the "Orders by status" breakdown it claims to scope

- **Domain:** merchant UI / analytics honesty
- **Status:** `BROKEN`
- **User/business impact:** The reporting-period control tells the merchant it governs "the summary cards **and order breakdown**". It does not govern the breakdown: those counts and percentages are all-time regardless of the selection. A merchant reading "Pending 40%" for "Last 7 days" is reading an all-time figure.
- **Evidence:**
  - Claim `UI_CODE`: `apps/merchant-control-plane/src/app/[store]/analytics/page.tsx:111` — `description="Choose the range used by the summary cards and order breakdown."`
  - Card rendered from `data.ordersByStatus`: `:191-212` (percentages at `:203`).
  - Proxy passes `period` to two of three calls `PROXY_CODE`: `apps/merchant-control-plane/src/app/api/stores/[store]/analytics/route.ts:18` (`dashboard`, with period), `:19` (`orders`, **no period**), `:20` (`revenue`, with period).
  - Gateway breakdown takes no period `GATEWAY_CODE`: `services/api-gateway/src/routes/analytics.ts:402` — `loadRollupOrderBreakdown(db, storeId)`; `:403` `loadRollups(db, storeId, ['orders.status'], undefined, 2000)` (the `undefined` is the since-date).
- **Expected behavior:** the breakdown honours the selected period, or the copy states it is all-time.
- **Missing link:** `period` is never threaded into the gateway breakdown loader.
- **Blast radius:** the analytics page, every merchant.
- **Invariant:** ANTI-R9 flavour (a metric labelled as something it is not) · **Severity:** P2 · **Likelihood:** HIGH
- **Dependencies:** a gateway change (Agent D/coordination).
- **Remediation approach:** thread `period` through the gateway breakdown loader, or relabel the card "All time" until it does.
- **Acceptance criteria:** changing the period changes the breakdown, or the card is explicitly labelled all-time.
- **Required tests:** a gateway test that `?period=7d` differs from `?period=90d` on seeded data; a UI test on the label.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-113 — Dashboard reports a gateway failure as "Analytics are still warming up" and shows zeros

- **Domain:** merchant UI / honesty
- **Status:** `PARTIAL`
- **User/business impact:** Any failure of the analytics calls (5xx, timeout, auth) is caught and collapsed into all-zero metrics. The only signal is an info-tone banner saying analytics are still warming up. A merchant with real revenue sees ₹0 and a reassuring message.
- **Evidence `UI_CODE`:** `apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:247-249` (`catch { return emptyDashboardHomeData() }`), `:252-264` (all zeros, `analyticsAvailable:false`); banner at `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx:585-589`; the metric cards render the zeros at `:592-600`.
- **Expected behavior:** distinguish "no activity yet" from "we could not load your analytics", and never render ₹0 as authoritative when the fetch failed.
- **Missing link / root cause:** one catch-all collapses two distinct states into one.
- **Blast radius:** the dashboard, every merchant, during any gateway degradation.
- **Invariant:** ANTI-R9 flavour on a money-adjacent surface · **Severity:** P2 · **Likelihood:** MEDIUM (only on failure)
- **Dependencies:** none.
- **Remediation approach:** distinguish the two states in `loadDashboardHomeData`; render an explicit error with retry when the load failed; suppress money figures rather than showing zeros.
- **Acceptance criteria:** a forced gateway 500 renders an error state, not ₹0.
- **Required tests:** a render test with a failing client.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH
- **Same family, lower severity:** `apps/merchant-control-plane/src/app/[store]/settings/business/page.tsx:400` defaults `commission_bps` to `0` when the best-effort commission fetch fails (`:247-252`) and renders a confident "0%" at `:623`; `:623` also uses `.toFixed(0)` so 25 bps would display "0%" and 50 bps "1%", while `:620` hardcodes the "no commission" copy independent of the number.

---

### MCP-DISC-114 — Shipped merchant pages are unreachable: theme safe-update, theme translations, store-type media library, and a dropped settings item

- **Domain:** merchant UI / navigation / theme
- **Status:** `UI_ONLY` (built, not reachable)
- **User/business impact:** Real engineering investment is dark. `online-store/themes/update` is a 301-line page plus a real `ThemeUpdatePanel` (version diff, apply, rollback) with **no inbound link anywhere**. `online-store/themes/[themeId]/editor/translations` (255 lines) likewise. `/[store]/gallery` (media library, 359 lines) is in `portfolioNavigation` only, so a store-type merchant has a working media library and `/api/stores/:s/media` proxy with no nav entry. And the settings home advertises "language settings" in a phase card whose item is silently dropped.
- **Evidence `UI_CODE` (absence):**
  - `grep -rn "themes/update" apps/merchant-control-plane/src` excluding the route's own folder → **0 hits**. Route folder: `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/{page.tsx,UpdatePageClient.tsx}` + `apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx`.
  - Same for `editor/translations`.
  - `apps/merchant-control-plane/src/components/merchantNavigation.ts:184` — `gallery` appears only in `portfolioNavigation`.
  - `apps/merchant-control-plane/src/app/[store]/settings/page.tsx:37` lists `'localization'` in the "Store foundation" phase `itemHrefs`; `SETTINGS_NAV_ITEMS` (`settings/settings-navigation.ts:180`) has no such entry; `.filter(Boolean)` at `settings/page.tsx:110` silently drops it, so the card renders 2/2 instead of 3.
- **Expected behavior:** every shipped page is reachable, or is archived per the repo's existing dead-code convention (`docs/archive/dead-code/…`, enforced by `tests/contracts/settings-apps-dead-twin.test.ts`).
- **Missing link / root cause:** nav entries were never added when the pages landed; no reachability validator exists.
- **Blast radius:** three unreachable features + one mis-rendered settings card.
- **Invariant:** none · **Severity:** P2 · **Likelihood:** HIGH (deterministic)
- **Dependencies:** none.
- **Remediation approach:** either link them (Themes page → "Update theme"; editor → "Translations"; store nav → Media library) or archive them under the existing dead-code convention. Fix or remove the `'localization'` `itemHref`.
- **Acceptance criteria:** a validator asserts every `page.tsx` under `[store]` is either nav-reachable, linked from another page, or a documented detail/flow route; the settings phase card counts match its items.
- **Required tests:** the reachability validator (a natural extension of the existing dead-twin family).
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-115 — Referenced `--lb-*` design tokens do not resolve; deprecated aliases are deleted by the producer and still consumed

- **Domain:** merchant UI / design system
- **Status:** `BROKEN` (visual) · `NOT_IMPLEMENTED` (the validator that would catch it)
- **User/business impact:** Pages reference `var(--lb-…)` names the runtime token map never emits. Per CSS, an unresolvable `var()` with no fallback invalidates the declaration at computed-value time — border colours fall back to `currentColor`, font sizes to inherited, backgrounds to transparent. Clusters of pages render off-design and will not follow a theme or brand change.
- **Evidence:**
  - Agent B's scripted diff over every `var(--lb-…)` reference in `apps/merchant-control-plane/src` against the union of `packages/typescript/ui/src/tokens.ts` emissions and `apps/merchant-control-plane/src/app/globals.css` definitions: **140 referenced, 51 unresolved.**
  - **Independent re-run for this document** (narrower method: `var(--lb-*)` occurrences in `.ts`/`.tsx` only, excluding `globals.css` references): **108 referenced, 35 unresolved across 29 files.** The two runs agree on direction and on every top offender; the delta is method scope (Agent B also counted CSS-file references, which is why `--lb-color-danger` appears in their deprecated count — it is referenced at `apps/merchant-control-plane/src/app/globals.css:11807-11844`, not in TSX). **No contradiction.**
  - **Deliberate deletion** `UI_CODE`: `packages/typescript/ui/src/tokens.ts:9-21` declares an 11-member `deprecatedTokenAliasVariables` set and `:1095-1097` executes `deprecatedTokenAliasVariables.forEach((alias) => { delete variables[alias]; })`. The merchant app still consumes `--lb-color-text-primary`, `--lb-color-text-secondary`, `--lb-color-border-subtle` from TSX and `--lb-color-danger` from CSS.
  - Concrete rendering consequence: `apps/merchant-control-plane/src/app/[store]/products/operations-dashboard/page.tsx:35` `border-[var(--lb-color-border-subtle)]` → `border-color` resolves to `currentColor`, so KPI cards draw borders in the text colour; `:37` `text-[length:var(--lb-font-size-xs)]` and `:39` `--lb-font-size-2xl` → font sizes fall back to inherited, so the "2xl" KPI value is not visually a KPI.
  - Worst files (independent re-run): `products/inventory-history` (10 unresolved), `products/suppliers` (8), `products/transfers` (8), `products/locations` (7), `products/operations-dashboard` (7), `products/receipts` (7), `products/reservations` (7), `products/purchase-orders` (6), `components/theme-editor/AICustomizationPanel.tsx` (6).
  - Most-referenced unresolved tokens: `--lb-font-size-sm` (13 files), `--lb-color-surface-hovered` (9), `--lb-color-text-secondary` (9), `--lb-color-border-subtle` (8), `--lb-color-text-primary` (8), `--lb-font-size-xs` (8), `--lb-size-icon-lg` (6).
  - **No governance covers it:** `scripts/validators/token-source-single-validator.mjs` guards token *authority*; `packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs` and `ui-no-new-token-alias-validator.mjs` snapshot the *producer*; the five UI ESLint rules (`packages/typescript/ui/eslint/index.cjs:145`) cover hex / raw colour / raw element / raw form control / Tailwind default colour. **Nothing validates that a consumer's token reference resolves.**
- **Expected behavior:** every `var(--lb-*)` reference resolves to an emitted token.
- **Missing link / root cause:** no consumer-side resolution validator; the deprecation of four aliases was executed on the producer without migrating consumers.
- **Blast radius:** ~29–30 files including `orders/[orderId]`, `customers/[email]`, `customers/segments`, `marketing`, the whole `products/*` warehousing cluster, `settings/notifications`, the theme editor and theme library, and `accept-invite`.
- **Invariant:** none · **Severity:** P2 · **Likelihood:** HIGH (deterministic)
- **Dependencies:** none.
- **Remediation approach:** add a governance validator that extracts emitted token names from `tokens.ts` + app CSS and fails on any unresolved `var(--lb-*)` in app source; then migrate the references to live tokens. Do **not** "fix" this by re-adding the deprecated aliases — that would reverse a deliberate decision.
- **Acceptance criteria:** the validator is wired into the governance gate and reports zero unresolved references.
- **Required tests:** the new validator + its self-test.
- **Required owner:** lead engineer (design system)
- **Reversibility:** fully reversible · **Confidence:** HIGH on the diff; MEDIUM on the exact per-property visual outcome (pages were not rendered)

---

### MCP-DISC-116 — Live merchant navigation links out to two frozen, not-deployed runtimes

- **Domain:** merchant UI / governance
- **Status:** `BROKEN` (link targets) · `CONTRADICTORY_EVIDENCE` (product vs manifest)
- **User/business impact:** The top-level "Add" nav item (shortcut `g x`) opens the Apps page whose **primary action** is "Browse marketplace" → the app-marketplace host. The Themes page offers two theme-store links. Both target runtimes the Constitution and their own manifests declare frozen and not deployed.
- **Evidence:**
  - `PROVIDER_OR_CONFIG_EVIDENCE`: `apps/app-marketplace/runtime.manifest.json` — `"deploymentAuthority": { "platform": "frozen-not-deployed" }`; `apps/theme-marketplace/runtime.manifest.json:49` — same.
  - Links `UI_CODE`: `apps/merchant-control-plane/src/app/[store]/apps/page.tsx:42` (PageHeader `primaryAction`), `:84` (empty-state CTA); `apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsClient.tsx:26`; `apps/merchant-control-plane/src/lib/public-urls.ts:4,47-52` → rendered at `apps/merchant-control-plane/src/app/[store]/online-store/themes/page.tsx:518,557`.
  - Nav placement `UI_CODE`: `apps/merchant-control-plane/src/components/merchantNavigation.ts:42-48` (`appsItem`, section `'apps'`, shortcut `g x`), included in all five site-type navs.
- **Expected behavior:** the merchant OS does not advertise a destination that is not deployed.
- **Missing link / root cause:** no validator cross-references outbound app URLs against runtime manifests.
- **Blast radius:** every merchant; four visible links, one of them a top-level nav destination's primary action.
- **Invariant:** none technically; an honesty/UX defect and a visible contradiction with the frozen-runtime law.
- **Severity:** P2 · **Likelihood:** HIGH (unconditional)
- **Dependencies:** ARB — this is explicitly **not** "unfreeze the marketplace".
- **Remediation approach:** gate the outbound links behind a real "marketplace live" signal, or replace them with honest copy about the marketplace's status.
- **Acceptance criteria:** no merchant surface links to a runtime whose manifest says `frozen-not-deployed`.
- **Required tests:** a governance validator cross-referencing outbound app URLs against `runtime.manifest.json` deployment authority.
- **Required owner:** ARB (policy) + lead engineer (implementation)
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-117 — Roughly two dozen Flutter merchant screens are registered as routes with no in-app navigation entry point

- **Domain:** mobile merchant app / navigation
- **Status:** `UI_ONLY`
- **User/business impact:** A merchant using the mobile app cannot reach returns, gift cards, coupons, staff, billing, reviews, leads, email campaigns, apps, AI, shipping, taxes, custom data, KYC, two-factor, inventory (and therefore locations / suppliers / purchase orders / transfers), collections, pages, blog, navigation, media, the theme screen, the section editor or the upgrade screen — **by any tap path that exists in the code**. The screens are compiled into the binary and are dark. The mobile app's *effective* capability set is: Home, Orders (+detail), Products (+form, +import), Customers (+detail), Analytics, Money, Notifications, Store details/health, Domain and SEO settings, Localisation, Help, Pricing, Connect Razorpay, Live preview.
- **Evidence (first-party for this document, `UI_CODE`):**
  - Route table: `apps/mobile/merchant-app/lib/app/routes.dart:61-151` (91 `AppRouteId` values), paths at `:178-238`, feature aliases at `:590-770`.
  - Complete enumeration of every `Navigator.pushNamed` / `pushReplacementNamed` / `MaterialPageRoute` construction in `lib/` yields the reachability map in §9.1. `AppRoutes.returns`, `.giftCards`, `.coupons`, `.staff`, `.billing`, `.reviews`, `.leads`, `.emailCampaigns`, `.apps`, `.ai`, `.shipping`, `.taxes`, `.customData`, `.pages`, `.blog`, `.navigation`, `.media`, `.inventory`, `.collections`, `.kyc`, `.twoFactor`, `.upgrade`, `.splash` are referenced **only** inside `routes.dart`.
  - The More tab exposes 12 destinations only: `apps/mobile/merchant-app/lib/screens/settings/settings_screen.dart:111-311`.
  - Home exposes 8: `apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart:423-439,549,668,877`.
  - `ThemeScreen` (`lib/screens/customize/theme_screen.dart`) and `SectionEditorScreen` (`lib/screens/editor/section_editor_screen.dart`) have **zero references outside their own files**.
  - The 34 `/features/*` aliases have no consumer in `lib/`: their only intended consumer is `PlatformBlockedService.featureForRoute`, and `apps/mobile/merchant-app/lib/services/platform_blocked_service.dart:25` declares `static const features = <PlatformBlockedFeature>[]` — an **empty list**, so `featureForRoute` can never match and `PlatformBlockedScreen` can never render.
  - The only repository references to `/features/*` outside `routes.dart` are in `apps/mobile/merchant-app/test/mobile_services_test.dart` — i.e. **the tests assert the routes are registered, not that they are reachable.**
- **Expected behavior:** every shipped mobile screen is reachable from the app's navigation, or is removed from the binary.
- **Missing link / root cause:** UNKNOWN. Consistent with a More-tab menu that was never expanded to match the built screens, plus an entitlement/deep-link mechanism (`PlatformBlockedService`) that was scaffolded and left empty.
- **Blast radius:** the entire mobile merchant experience; includes a money surface (gift cards) and a refund-adjacent surface (returns).
- **Invariant:** **[HIGH-STAKES]** by association (gift cards and returns are money surfaces).
- **Severity:** P2 · **Likelihood:** HIGH (deterministic — verified from source, not runtime)
- **Dependencies:** a product decision on mobile scope; `MCP-DISC-105` (role gating) if the More tab becomes permission-aware.
- **Remediation approach:** decide the mobile scope, then either build the More-tab menu out to cover the intended screens or remove the unreachable ones; either populate `PlatformBlockedService.features` so the `/features/*` aliases have a real consumer, or delete the alias table. Do **not** ship a binary containing unreachable money screens.
- **Acceptance criteria:** a reachability test walks the navigation graph from the app root and fails on any registered route or screen file with no inbound path; `PlatformBlockedService` is either populated or removed along with its screen.
- **Required tests:** a Dart reachability test (mirror of the web reachability validator in `MCP-DISC-114`); the existing `mobile_services_test.dart` route assertions extended from "is registered" to "is reachable".
- **Required owner:** founder (mobile scope) + lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH on the static navigation graph; **MEDIUM** on the user-visible conclusion, because the app was not built or run and a runtime-constructed route name (for example from a push payload or a remote menu) would not appear in this analysis — see §17

---

### MCP-DISC-118 — Campaign send toast reports "sent" as success even in sandbox

- **Domain:** merchant UI / honesty
- **Status:** `PARTIAL`
- **User/business impact:** After sending an email campaign in sandbox the merchant gets a green toast reading "Campaign sent — N emails sent." A correcting banner appears alongside it, but the toast is the immediate, dismissible signal and it is untrue.
- **Evidence `UI_CODE`:** `apps/merchant-control-plane/src/app/[store]/marketing/page.tsx:388-395` — `notify({ title:'Campaign sent', description: '… emails sent.', variant:'success' })` fires without consulting `result.sandbox`, which the same handler already holds at `:373-379`. The honest banner is at `:612-624`.
- **Expected behavior:** the toast reflects sandbox.
- **Missing link / root cause:** the sandbox flag is read for the banner but not for the toast.
- **Blast radius:** every campaign send while sandbox is the default.
- **Invariant:** ANTI-R9 (`AGENTS.md:322`) · **Severity:** P3 · **Likelihood:** HIGH while sandbox is the default
- **Dependencies:** none.
- **Remediation approach:** branch the toast on `result.sandbox` (warning tone, "logged in sandbox — no emails delivered"); consider a `ProviderModeBadge` on the campaigns surface for consistency.
- **Acceptance criteria:** a sandbox send never produces a `variant:'success'` "sent" toast.
- **Required tests:** a UI test asserting the sandbox branch.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-119 — Login page opts out of the design system entirely

- **Domain:** merchant UI / design system
- **Status:** `PARTIAL`
- **User/business impact:** The login/redirect page is styled with raw Tailwind palette classes instead of tokens, so it will not follow a brand or theme change and is the one merchant page whose dark mode is hand-rolled. It is the first thing an unauthenticated merchant sees.
- **Evidence `UI_CODE`:** `apps/merchant-control-plane/src/app/[store]/login/page.tsx:23-26` — `bg-zinc-50 dark:bg-zinc-950`, `text-zinc-600 dark:text-zinc-400`, `border-zinc-300`, `h-8 w-8`, `rounded-full`, `border-2`, `mb-4`. It is one of only two `.tsx` files in the app that import nothing from `@letbuyy/ui`. ESLint's `@letbuyy/ui/no-tailwind-default-color` is set to `"warn"` (`apps/merchant-control-plane/eslint.config.mjs:21`), so this does not fail the build.
- **Expected behavior:** compose from `@letbuyy/ui` primitives and `--lb-*` tokens.
- **Blast radius:** one page.
- **Invariant:** none · **Severity:** P3 · **Likelihood:** HIGH
- **Dependencies:** clearing the raw-styling tail first (26 Tailwind default-scale radius classes across 12 files — including the orders **refund** and **fulfilment** panels at `orders/page.tsx:778,800` — and 23 files with raw px or raw palette classes).
- **Remediation approach:** rebuild on `@letbuyy/ui` primitives and tokens; then consider raising `no-tailwind-default-color` to `error`.
- **Acceptance criteria:** the page imports from `@letbuyy/ui` and contains no raw Tailwind palette class.
- **Required tests:** the ESLint rule at `error`.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-120 — `/[store]/online-store` renders a blank frame while redirecting client-side

- **Domain:** merchant UI / navigation
- **Status:** `PARTIAL`
- **User/business impact:** The "Online Store" top-level nav item (`g t`) points at a page that mounts, returns `null`, and then `router.replace`s to `/online-store/themes`. The merchant sees a blank frame on every use of a primary navigation item.
- **Evidence `UI_CODE`:** `apps/merchant-control-plane/src/app/[store]/online-store/page.tsx` (17 LOC) — client component, `router.replace`, returns `null`. Contrast the two routes that do this correctly with a server `redirect()`: `settings/localization/page.tsx:9-11` and `settings/subscribe/checkout/page.tsx`.
- **Expected behavior:** a server-side `redirect()` so no blank client frame is rendered.
- **Missing link / root cause:** the page was written as a client component.
- **Blast radius:** one nav destination, every store-type merchant.
- **Invariant:** none · **Severity:** P3 · **Likelihood:** HIGH (unconditional)
- **Dependencies:** none.
- **Remediation approach:** convert to a server component using `redirect()`, matching the two existing correct examples.
- **Acceptance criteria:** navigating to `/{store}/online-store` never renders an empty frame.
- **Required tests:** a route test asserting a redirect response rather than a rendered page.
- **Required owner:** lead engineer
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-121 — Orphaned API proxies with no UI consumer

- **Domain:** merchant UI / dead code
- **Status:** `NOT_IMPLEMENTED` (consumer side)
- **User/business impact:** None directly on merchants; the cost is maintenance surface and a false impression of capability when reading the proxy inventory.
- **Evidence `PROXY_CODE`:**
  - `apps/merchant-control-plane/src/app/api/themes/[themeId]/sections/reorder` — orphaned; the editor persists ordering via `themes.saveDraft` instead (`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:1216 moveSection`).
  - `apps/merchant-control-plane/src/app/api/stores/[store]/domains/[domain]/[action]` — only the `/verify` action is used (`apps/merchant-control-plane/src/lib/domains/client.ts:52`); the generic `[action]` catch-all is otherwise unused.
  - (`api/stores/[store]/dashboard/setup` is also orphaned but is tracked under `MCP-DISC-110`, where it is the *fix*, not the problem.)
- **Expected behavior:** every proxy has a consumer, or is archived under the repo's dead-code convention.
- **Blast radius:** two proxy routes.
- **Invariant:** none · **Severity:** P3 · **Likelihood:** HIGH (deterministic)
- **Dependencies:** none.
- **Remediation approach:** delete or archive; a catch-all `[action]` proxy in particular widens the forwarding surface without a consumer and should be narrowed to `verify`.
- **Acceptance criteria:** a validator asserts every `route.ts` under `src/app/api` has at least one non-API caller, or is listed as intentionally external.
- **Required tests:** the proxy-reachability validator.
- **Required owner:** lead engineer (+ security on the catch-all narrowing)
- **Reversibility:** fully reversible · **Confidence:** HIGH

---

### MCP-DISC-122 — `/accept-invite` is not in the middleware allow-list, so an invited staffer is bounced to accounts first

- **Domain:** merchant UI / onboarding / navigation
- **Status:** `UNVERIFIED_RUNTIME`
- **User/business impact:** A staff invite email links to `/accept-invite`. `src/proxy.ts:18-26` allow-lists only `/`, `/_next`, `/api`, `/launching-soon` and anything containing a dot; everything else requires a verified `lb_session` cookie. An invited staffer, by definition, has no session, so the invite link redirects to the accounts lookup with a `return_to`. Whether the invite token survives that round-trip is **not verified**. If it does not, staff invitations are unusable.
- **Evidence `PROXY_CODE`:** `apps/merchant-control-plane/src/proxy.ts:18-26` (allow-list); `apps/merchant-control-plane/src/app/accept-invite/page.tsx` (121 LOC, `POST /api/employees/accept-invite`).
- **Expected behavior:** an invited staffer can complete the invite from the email link.
- **Missing link / root cause:** either the allow-list is missing the route, or the accounts lookup preserves the token — **UNKNOWN**, requires Agent A / a runtime check.
- **Blast radius:** every staff invitation.
- **Invariant:** authorization-adjacent → **[HIGH-STAKES]** if it silently drops the token
- **Severity:** P2 · **Likelihood:** UNKNOWN (MEDIUM if the token is dropped, LOW if preserved)
- **Dependencies:** Agent A confirmation of the accounts `return_to` behaviour.
- **Remediation approach:** confirm the round-trip behaviour first. If the token is dropped, allow-list `/accept-invite` in `proxy.ts` while keeping the page's own token validation as the real gate — do not weaken the session requirement for any other route.
- **Acceptance criteria:** an end-to-end invite acceptance succeeds from a clean browser with no prior session.
- **Required tests:** an E2E covering the invite email link → password set → staff active.
- **Required owner:** lead engineer + security
- **Reversibility:** fully reversible · **Confidence:** MEDIUM (the allow-list omission is certain; the consequence is not)

---

## 15. Completion contract and acceptance criteria

The navigation and route layer is "done" when all of the following hold. Each is machine-checkable; none requires judgement.

| # | Contract | Acceptance criterion | Enforced by | Gaps closed |
|---|---|---|---|---|
| C1 | Every nav target resolves | Zero nav/shortcut/quick-action literals without a matching `page.tsx` | validator (extend the existing dead-twin family) | maintains today's zero |
| C2 | Every page is reachable | Every `page.tsx` under `[store]` is nav-reachable, linked from another page, or a documented detail/flow route | reachability validator | 114 |
| C3 | Every proxy has a consumer | Every `route.ts` under `src/app/api` has a non-API caller or is declared intentionally external | proxy-reachability validator | 121, 110 |
| C4 | Every money/fulfilment surface is badged | An enumerated list of money surfaces each renders `ProviderModeBadge`; unknown mode renders an explicit unknown | honesty validator + UI tests | 101 |
| C5 | No affordance without a destination | No `href="#"`, no `onClick` that only calls `preventDefault`, in any shipped component | lint rule | 104 |
| C6 | No success toast over a partial or sandbox result | A truncated export and a sandbox send cannot render `variant:'success'` | UI tests | 102, 118 |
| C7 | Failure is distinguishable from emptiness | A forced gateway 500 on the dashboard renders an error state, not ₹0 | render test with a failing client | 113 |
| C8 | Every capability badge derives from server truth | No `variant="success"` capability badge is a string literal | contract test | 111 |
| C9 | Every token reference resolves | Zero unresolved `var(--lb-*)` in app source | token-resolution validator | 115 |
| C10 | No link to a frozen runtime | No merchant surface links to a host whose `runtime.manifest.json` says `frozen-not-deployed` | governance validator | 116 |
| C11 | One role vocabulary | web enum ≡ Flutter enum ≡ DB CHECK constraint | cross-client role validator | 107 |
| C12 | Navigation reflects permissions | A `viewer` session renders no Payouts nav item and no Refund button | per-role UI tests | 105 |
| C13 | Order actions live on the order | Every action available on an orders list row is available on the order detail page | action-parity UI test | 109 |
| C14 | India-compliance surfaces exist | A paid order exposes a GST invoice and a packing slip; a return can be approved and refunded from the web | E2E + India-compliance test | 100 |
| C15 | One date rule | One documented date rule, enforced by the contract test; no raw `toLocaleDateString` in app source | updated contract test | 108 |
| C16 | Mobile screens are reachable | A navigation-graph walk from the app root reaches every registered route and screen file, or the unreachable ones are removed | Dart reachability test | 117 |
| C17 | Invite links work cold | An invite email link completes with no prior session | E2E | 122 |

**Runtime acceptance gate (applies to all of the above).** None of C1–C17 may be marked complete on static evidence alone. Each requires at least one executed test or observed runtime behaviour, because **this entire document is static**.

---

## 16. Risks

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| A sandbox refund is believed to be live; a real customer goes unpaid | MEDIUM (certain while sandbox is the default) | **P1 / irreversible for the customer** | `MCP-DISC-101` — badge every money surface before any merchant touches live money |
| A merchant migrates off a truncated 100-row order export and loses data | HIGH | **P1 / irreversible** | `MCP-DISC-102` — paginate; never render success over partial |
| A merchant pays for a plan expecting credits that cannot be issued | HIGH | **P1 / legal** | `MCP-DISC-103` — founder decision before the next paid conversion |
| An Indian merchant cannot produce a GST invoice from the admin | HIGH | **P1 / statutory** | `MCP-DISC-100` — the endpoint exists; add the proxy and the action |
| A `viewer` staffer clicks Refund or Release, and the only thing standing between them and a money mutation is unverified server RBAC | HIGH once staff exist | **P1 if server RBAC is absent** | `MCP-DISC-105` + Agent A must confirm server enforcement before multi-staff stores are enabled |
| Trial merchants cannot convert from the dashboard | HIGH | P1 / revenue | `MCP-DISC-104` — one-line destination fix |
| Mobile ships with unreachable money screens (gift cards, returns) | HIGH | P2 | `MCP-DISC-117` — decide scope, then build the menu or remove the screens |
| Governance is green while an India-first rule is violated on billing | HIGH | P2 | `MCP-DISC-108` — resolve the contradiction rather than living with it |
| Pages render off-brand and will not follow a theme change | HIGH | P2 | `MCP-DISC-115` — consumer-side token validator |
| A merchant clicks into a marketplace that is not deployed | HIGH | P2 | `MCP-DISC-116` |
| **Everything in this document is wrong in some detail because nothing was executed** | — | — | Treat every status as provisional until a runtime pass is run; see §18 |

---

## 17. Open questions / human approvals needed

| # | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | Does the gateway enforce `verifySiteOwnership` on `stores.getByHandle`? The entire merchant tenancy model rests on it — `src/lib/auth/session.ts:111-113` ignores `_userId`. | The tenancy verdict for all 77 routes | Agent A / security |
| Q2 | Does server-side staff RBAC exist and is it complete? `tests/launch/lb-merchant-admin.test.mjs` names such tests; they were not read here. | Severity of `MCP-DISC-105` (P2 vs P1) | Agent A / security |
| Q3 | Is the refund `amount_minor` capped server-side to the refundable remainder? The UI sends a client-typed amount. | Whether the refund path is safe at all | Agent D / payments |
| Q4 | Does the gateway impose the same 100-row cap as the export UI? | Whether a client-side fix to `MCP-DISC-102` is sufficient | Agent D |
| Q5 | Does the gateway validate GSTIN format? | Severity of `MCP-DISC-106` (P2 vs P1) | Agent D/E + CA-tax |
| Q6 | What is the actual `employees.role` CHECK constraint? | `MCP-DISC-107` remediation target | Agent D/E |
| Q7 | Does any out-of-band manual process honour the checkout offers? | Whether `MCP-DISC-103` is a copy removal or a build | **founder** |
| Q8 | Is the marketplace being unfrozen, or should the links go? | `MCP-DISC-116` | **ARB** |
| Q9 | Are US dates on merchant billing an accepted exception, or a defect? | `MCP-DISC-108` | **ARB / founder** |
| Q10 | Is the mobile app in launch scope, and at what capability level? | `MCP-DISC-117` — whether to build ~20 menu entries or delete the screens | **founder** |
| Q11 | Are shipping labels and packing slips launch scope, or post-launch? | Sequencing within `MCP-DISC-100` | **founder** |
| Q12 | Should gift-card issuance be step-up gated like refunds and payouts? It creates stored-value liability and today is not gated. | A possible new gap; not asserted here | **ARB** |
| Q13 | Does the accounts lookup preserve the invite token across the proxy bounce? | `MCP-DISC-122` | Agent A |
| Q14 | Does the internal HMAC header between the merchant app and the gateway (`src/lib/api/client.ts:62-80`; env var names `INTERNAL_API_SECRET`, `LETBUYY_INTERNAL_API_SECRET`) cross a trust domain under ART-05? | Architecture verdict, not a route verdict | Agent A / ARB |

---

## 18. Confidence and the main uncertainty

| Claim class | Confidence | Basis |
|---|---|---|
| The 77-route and 130-proxy counts, and the route list | **HIGH** | Enumerated first-party from the filesystem for this document; matches Agent B exactly |
| Zero dead nav links | **HIGH** | Agent B's script + first-party re-read of both navigation definition files |
| Hidden/unreachable web pages | **HIGH** | Grep-verified absence of inbound links |
| Per-route loading/empty/error column | **MEDIUM** | A regex heuristic, independently re-run and reproducing Agent B's 44/77 exactly. It cannot see state handled by a shared parent component, so a `–` is a signal to look, not proof of absence |
| Per-route primary actions | **MEDIUM–HIGH** | Derived from action labels and mutating call sites in each route folder; calls made through helper wrappers rather than literal `fetch(` are under-counted |
| Provider-mode badge coverage | **HIGH** | Occurrence counts per file |
| Dead/no-op affordances | **HIGH** | Each one quoted at `path:line`; `TrialBanner.tsx` re-read in full for this document |
| Undefined token references | **HIGH on direction, MEDIUM on the exact count** | Two independent scripted runs with different scopes (140/51 vs 108/35) agreeing on every top offender; the delta is method scope, explained in `MCP-DISC-115`. No page was rendered, so the visual consequence is reasoned from the CSS spec |
| Flutter route/screen inventory | **HIGH** | Enumerated first-party from `routes.dart` and the screen tree |
| **Flutter unreachability conclusion** | **MEDIUM** | The static navigation graph is certain. The user-visible conclusion is not: a route name constructed at runtime (from a push payload, a remote menu, or a deep link the analysis did not model) would not appear in a static reference scan, and the app was neither built nor run |
| Anything below the `/v1` gateway boundary | **NOT ASSESSED** | Out of scope; every trace is marked at the boundary |

**The main uncertainty is the same for every row: nothing was executed.** No page was rendered, no proxy called, no persistence observed, no Flutter build produced. A route marked `IMPLEMENTED_NOT_RUNTIME_VERIFIED` may still fail at runtime for reasons no static read can surface — a gateway 500, a missing environment variable, a hydration error, a proxy that forwards but whose response shape the page cannot parse. The second-largest uncertainty is the Flutter reachability conclusion in `MCP-DISC-117`, which is the only finding in this document where a plausible runtime mechanism could invalidate a static conclusion.

Nothing here is `VERIFIED_E2E`, and nothing here should be reported to anyone as verified.

---

## 19. Provisional-ID → MCP-DISC-NNN mapping

| Provisional ID (Agent B notes) | Final ID | Title |
|---|---|---|
| G-B-07 | **MCP-DISC-100** | Returns/RMA, GST tax invoice, packing slip and shipping labels have gateway support but no web merchant surface |
| G-B-05 | **MCP-DISC-101** | Provider-mode honesty badge missing on refunds, payouts, gift cards, order detail and plan checkout |
| G-B-09 | **MCP-DISC-102** | Bulk export silently truncates at 100 rows and reports success |
| G-B-04 | **MCP-DISC-103** | Unbacked monetary offers rendered inside the paid-plan checkout |
| G-B-01 | **MCP-DISC-104** | Dashboard trial-banner "Select a plan" CTA is a hard-coded no-op |
| G-B-14 | **MCP-DISC-105** | Staff permissions are defined and persisted but gate nothing in either client |
| G-B-13 | **MCP-DISC-106** | Two GSTIN capture surfaces with divergent validation |
| G-B-16 | **MCP-DISC-107** | Staff role catalogues diverge across web, Flutter and the documented DB constraint |
| G-B-10 | **MCP-DISC-108** | US-locale dates on merchant billing and other surfaces, blessed by a governance test |
| G-B-17 | **MCP-DISC-109** | The order detail page is read-only; every order action requires going back to the list |
| G-B-02 | **MCP-DISC-110** | Setup assistant reads a non-existent endpoint; the onboarding checklist is permanently wrong |
| G-B-03 | **MCP-DISC-111** | AI Studio badges six capabilities "Available" with no way to invoke any of them |
| G-B-08 | **MCP-DISC-112** | Analytics period selector does not scope the "Orders by status" breakdown it claims to scope |
| G-B-11 | **MCP-DISC-113** | Dashboard reports a gateway failure as "Analytics are still warming up" and shows zeros |
| G-B-12 | **MCP-DISC-114** | Shipped merchant pages are unreachable: theme safe-update, theme translations, store-type media library, dropped settings item |
| G-B-06 | **MCP-DISC-115** | Referenced `--lb-*` design tokens do not resolve; deprecated aliases are deleted by the producer and still consumed |
| G-B-15 | **MCP-DISC-116** | Live merchant navigation links out to two frozen, not-deployed runtimes |
| *(new — first verified in this document)* | **MCP-DISC-117** | Roughly two dozen Flutter merchant screens are registered as routes with no in-app navigation entry point |
| G-B-18 | **MCP-DISC-118** | Campaign send toast reports "sent" as success even in sandbox |
| G-B-19 | **MCP-DISC-119** | Login page opts out of the design system entirely |
| *(notes §3.6, flagged P3 without an ID)* | **MCP-DISC-120** | `/[store]/online-store` renders a blank frame while redirecting client-side |
| *(notes §2c, flagged without an ID)* | **MCP-DISC-121** | Orphaned API proxies with no UI consumer |
| *(notes §1 Middleware + §14, flagged as an unknown)* | **MCP-DISC-122** | `/accept-invite` is not in the middleware allow-list, so an invited staffer is bounced to accounts first |

**Allocated range:** MCP-DISC-100 – MCP-DISC-122 (23 IDs). **Unused in block:** MCP-DISC-123 – MCP-DISC-129.

Provisional IDs from the Agent B notes with **no** final ID: none. All 19 provisional gaps are carried forward.
