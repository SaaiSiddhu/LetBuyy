# LETBUYY PLATFORM ECOSYSTEM MAP
Generated: 2026-06-19

---

## Platform Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER-FACING TIER                                 │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────┐              │
│  │           storefront-runtime  (port 9000)                 │              │
│  │  {store}.letbuyy.com  |  custom domains                   │              │
│  │  Status: ACTIVE                                           │              │
│  │  Users: Shoppers/customers                                │              │
│  │  Domains: Browse → Cart → Checkout → Account → Orders    │              │
│  └──────────────────────────────────────────────────────────┘              │
│                                                                             │
│  ┌─────────────────────────────┐                                           │
│  │  mobile/shopper-app         │                                           │
│  │  Status: RESERVED           │                                           │
│  │  (no source; future)        │                                           │
│  └─────────────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        MERCHANT-FACING TIER                                 │
│                                                                             │
│  ┌───────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │ merchant-control-plane        │   │ mobile/merchant-app              │  │
│  │ (port 9001)                   │   │ Flutter (iOS + Android)          │  │
│  │ Status: ACTIVE                │   │ Status: ACTIVE                   │  │
│  │ Users: Merchants              │   │ Users: Merchants (mobile)        │  │
│  │ Domain: All commerce ops      │   │ Domain: Mobile merchant ops      │  │
│  └───────────────────────────────┘   └─────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │              identity-platform  (port 9002)                           │ │
│  │  accounts.letbuyy.com                                                 │ │
│  │  Status: ACTIVE                                                       │ │
│  │  Users: Merchants (auth entry point)                                  │ │
│  │  Domain: Auth / Identity / Store creation / OAuth2 server             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        MARKETING TIER                                       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │              marketing-site  (port 9006)                              │ │
│  │  letbuyy.com                                                          │ │
│  │  Status: ACTIVE                                                       │ │
│  │  Users: Prospective merchants (public)                                │ │
│  │  Domain: Growth / SEO / Content / Blog / Pricing                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPERATOR TIER                                        │
│                                                                             │
│  ┌──────────────────────────────┐   ┌─────────────────────────────────┐   │
│  │  platform-console            │   │  platform-operations-portal      │   │
│  │  (port 9007)                 │   │  (port 9008)                     │   │
│  │  Status: ACTIVE              │   │  Status: ACTIVE                  │   │
│  │  Users: Founders/engineers   │   │  Users: Ops/success/support team │   │
│  │  Domain: Super-admin control │   │  Domain: Merchant success / CRM  │   │
│  │  Auth: MFA required          │   │  Auth: Invite-only               │   │
│  └──────────────────────────────┘   └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     ECOSYSTEM / MARKETPLACE TIER  [FROZEN]                  │
│                                                                             │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐ │
│  │  app-marketplace    │  │  theme-marketplace    │  │  developer-portal  │ │
│  │  (port 9003)        │  │  (port 9005)          │  │  (port 9004)       │ │
│  │  Status: FROZEN     │  │  Status: FROZEN       │  │  Status: FROZEN    │ │
│  │  Users: Merchants   │  │  Users: Merchants     │  │  Users: Developers │ │
│  │  + App devs         │  │  + Theme devs         │  │                    │ │
│  └─────────────────────┘  └──────────────────────┘  └───────────────────┘ │
│  Pending consolidation. Not active deploy targets (CLAUDE.md governance).   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER (referenced, not apps)                 │
│                                                                             │
│  services/api-gateway  (port 9010)  — Hono, single API surface for all    │
│  services/queue-workers              — Async job processing                 │
│  services/webhook-service            — HMAC-signed webhook delivery         │
│  services/mobile-bff                 — Mobile-specific API surface          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Active vs Frozen vs Reserved

### Active (6 web apps + 1 Flutter app)

| App | Domain | Deploy Target |
|-----|---------|---------------|
| storefront-runtime | `{store}.letbuyy.com` + custom domains | Vercel |
| merchant-control-plane | `admin.letbuyy.com` | Vercel |
| identity-platform | `accounts.letbuyy.com` | Vercel |
| marketing-site | `letbuyy.com` | Vercel |
| platform-console | `console.letbuyy.com` | Vercel |
| platform-operations-portal | `ops.letbuyy.com` | Vercel |
| mobile/merchant-app | iOS App Store + Google Play | Flutter CI |

### Frozen (3 web apps)

These apps have source code but are NOT active production deploy targets. They are pending consolidation or redesign decisions. Their capabilities are not yet promoted into the active runtimes.

| App | Freeze Reason |
|-----|---------------|
| app-marketplace | Pending consolidation with merchant-control-plane apps section |
| theme-marketplace | Pending consolidation; theme install flows exist in storefront-runtime and merchant-control-plane |
| developer-portal | Pending consolidation; developer docs not yet actively maintained |

### Reserved (1 mobile app placeholder)

| App | Status |
|-----|--------|
| mobile/shopper-app | Manifest-only, no source. Active shopper flows live in storefront-runtime. |

---

## Inter-App Dependencies

```
marketing-site
  └─ drives signups → identity-platform (via /signup redirect)
  └─ references @letbuyy/shared-types (BRAND, structured data)
  └─ references @letbuyy/ui

identity-platform
  └─ authenticates merchants → issues ES256 JWT session
  └─ on store creation → redirects to merchant-control-plane
  └─ serves OAuth2/OIDC for → app-marketplace, theme-marketplace, developer-portal
  └─ references @letbuyy/auth-core, @letbuyy/tenant-core, @letbuyy/ui

merchant-control-plane
  └─ reads identity-platform session cookie (ES256 JWT)
  └─ proxies all API calls → services/api-gateway (:9010)
  └─ links out to storefront-runtime (live preview, store URL)
  └─ links out to app-marketplace (app install flow)
  └─ links out to theme-marketplace (theme install flow)
  └─ references @letbuyy/ui, @letbuyy/theme-engine, @letbuyy/cms-core, @letbuyy/auth-core

storefront-runtime
  └─ host-routing via src/proxy.ts middleware (subdomain → tenant)
  └─ all API calls → services/api-gateway (:9010)
  └─ receives theme install triggers from merchant-control-plane
  └─ preview mode receives context from merchant-control-plane theme editor
  └─ references @letbuyy/theme-engine, @letbuyy/checkout-core, @letbuyy/commerce-core

mobile/merchant-app (Flutter)
  └─ API calls → services/api-gateway (:9010) via services/mobile-bff
  └─ auth → identity-platform (ES256 JWT)
  └─ app install WebView bridge → embedded web via webview_flutter

platform-console
  └─ independent auth (console-auth, MFA)
  └─ all data reads → services/api-gateway (:9010)
  └─ governing body for app-marketplace, risk, compliance

platform-operations-portal
  └─ independent auth (invite-based)
  └─ all data reads → services/api-gateway (:9010)
  └─ surfaces data from merchants, CRM, support tickets

app-marketplace [FROZEN]
  └─ auth → identity-platform (OAuth2)
  └─ app install → services/api-gateway (:9010)
  └─ reviews governed by platform-console

theme-marketplace [FROZEN]
  └─ auth → identity-platform (merchant session cookie)
  └─ theme install → storefront-runtime + services/api-gateway

developer-portal [FROZEN]
  └─ minimal deps (only @letbuyy/ui)
  └─ documentation only; no live API integration
```

---

## Domain Boundaries

| Domain | Primary Owner App | Supporting Apps |
|--------|------------------|-----------------|
| Auth / Identity | identity-platform | merchant-control-plane, storefront-runtime, mobile/merchant-app |
| Merchant Operations | merchant-control-plane | mobile/merchant-app |
| Customer Storefront | storefront-runtime | — |
| Products / Inventory | merchant-control-plane | mobile/merchant-app, storefront-runtime |
| Orders / Checkout | storefront-runtime | merchant-control-plane, mobile/merchant-app |
| Payments / Billing | services/api-gateway (ledger RPCs) | merchant-control-plane, storefront-runtime |
| Themes | merchant-control-plane (editor) | storefront-runtime (runtime), theme-marketplace (frozen) |
| Apps / Integrations | app-marketplace (frozen) | merchant-control-plane (installed apps) |
| Platform Governance | platform-console | — |
| Merchant Success / CRM | platform-operations-portal | — |
| Growth / Marketing | marketing-site | — |
| Developer Platform | developer-portal (frozen) | app-marketplace (frozen) |

---

## User Journeys

### New Merchant Journey

```
1. DISCOVER
   letbuyy.com (marketing-site)
   └── reads features, pricing, use cases

2. SIGNUP
   marketing-site → /signup
   └── redirects to accounts.letbuyy.com (identity-platform)
       ├── email → OTP → set password
       ├── select store type (store / portfolio / resume / landing / blog)
       ├── pick subdomain ({subdomain}.letbuyy.com)
       └── store created → redirect to merchant-control-plane

3. ONBOARD
   merchant-control-plane /[store]/dashboard
   ├── complete setup checklist (business info, payment config, shipping)
   ├── customize themes (/online-store/themes → theme editor)
   ├── add products (/products/new)
   └── configure settings (payments, shipping, taxes, domains)

4. LAUNCH
   storefront-runtime → {store}.letbuyy.com
   └── store live for customers

5. OPERATE (daily)
   merchant-control-plane OR mobile/merchant-app
   ├── process orders
   ├── manage inventory
   ├── run marketing (coupons, reviews)
   └── view analytics
```

### Customer Journey

```
1. DISCOVER
   {store}.letbuyy.com (storefront-runtime)
   └── lands on store homepage (via Google / social / direct link)

2. BROWSE
   └── views products, collections, blog content

3. PURCHASE
   ├── adds items to cart
   ├── proceeds to checkout (address → shipping → payment)
   ├── pays via Razorpay / COD / PayPal
   └── receives order confirmation

4. ACCOUNT
   └── creates account or logs in (HS256 customer session)
       ├── views order history
       ├── tracks orders
       ├── manages addresses
       └── manages wishlist

5. POST-PURCHASE
   └── leaves review (visible in merchant-control-plane /reviews)
```

### Operator Journey

```
1. SUPER-ADMIN (LetBuyy founder/engineer)
   console.letbuyy.com (platform-console)
   ├── MFA login
   ├── monitors platform KPIs (revenue, subscriptions, merchant count)
   ├── reviews risk alerts and trust/safety escalations
   ├── governs app/theme marketplace submissions
   ├── reconciles money ledger
   └── browses immutable audit logs

2. OPS TEAM (customer success / support / marketing)
   ops.letbuyy.com (platform-operations-portal)
   ├── handles merchant support tickets
   ├── manages CRM pipeline
   ├── monitors merchant health scores
   ├── manages onboarding queue (guide new merchants)
   └── runs retention campaigns and communications
```

### Developer Journey (External)

```
1. DISCOVER
   developer-portal (frozen) — reads API docs, OAuth guide, webhook guide

2. BUILD
   └── builds integration using LetBuyy REST API via OAuth2

3. SUBMIT
   app-marketplace (frozen) → /developers/apps/new
   ├── submits app for review
   └── platform-console moderator approves/rejects

4. PUBLISH
   └── app visible in app-marketplace catalogue
   └── merchants install via merchant-control-plane /apps
```

---

## Design System Alignment

All active web apps share a single design system foundation:

| Layer | Source |
|-------|--------|
| Design tokens | `config/tailwind/letbuyy-tokens.css` (`--lb-*` prefix) |
| Component library | `packages/typescript/ui` (`@letbuyy/ui`) |
| Font stack | Geist Sans + Geist Mono (local `woff2`, all apps) |
| Theme provider | `LetbuyyThemeProvider` (all apps) |
| Theme script | `ThemeScript` (FOUC prevention, all apps) |
| Icon system | Lucide React (web) + FontAwesome (Flutter) |

### ThemeProvider Surface Values

| App | Surface | Default Theme |
|-----|---------|---------------|
| identity-platform | `identity` | system |
| marketing-site | `storefront` | system |
| merchant-control-plane | `admin` | system |
| storefront-runtime | `storefront` | system |
| platform-console | `operations` | dark (forced) |
| platform-operations-portal | `operations` | dark (forced) |
| app-marketplace | `marketplace` | system |
| developer-portal | `marketplace` density="compact" | system |
| theme-marketplace | `marketplace` | system |

---

## Key Architectural Invariants

1. **Single auth issuer per actor type.** Merchant auth: ES256 JWT from identity-platform. Customer auth: HS256 JWT from storefront-runtime API. These two token types are NEVER crossed.

2. **All money mutations go through Postgres RPCs.** No web app writes directly to money tables. `create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card` are the only mutation paths, called via `db.rpc` in the gateway.

3. **RLS is always ON.** Every tenant table has Row Level Security. Service-role access only occurs behind `verifySiteOwnership` in the gateway. No app bypasses RLS directly.

4. **New API routes are gateway proxies.** Web apps never talk directly to the database. All data access goes through `services/api-gateway` (:9010). Each app's `/api/*` routes are thin proxy handlers, not business logic.

5. **Storefront is React-default, Liquid is canary.** `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`. The theme engine supports Liquid + React hybrid, but Liquid is opt-in per store until the canary is promoted.

6. **Frozen apps are NOT deploy targets.** app-marketplace, theme-marketplace, and developer-portal have source code but governance rules (CLAUDE.md) prohibit treating them as active topology. Their capabilities are pending consolidation into the active runtimes.

7. **`--lb-*` tokens only.** The design-system ratchet forbids raw `rounded-[...]`/px values. All spacing, color, and radius must use `--lb-*` CSS custom properties from `letbuyy-tokens.css`.
