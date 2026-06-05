# Phase 10 — Duplication Investigation

Investigation date: 2026-06-05

> Forensic, documentation-only pass. Nothing was modified, deleted, moved, or renamed. Each finding cites side-by-side paths with line references and quantifies copy counts. "Duplication" is reported at three levels: **copy-paste** (byte/near-identical bodies), **structural** (same shape re-implemented per workspace), and **conceptual/layered** (the same model expressed in several layers by design).

---

## Method

- **Distinctive-string + function-name greps** across `apps/`, `apps/mobile/`, `packages/`, `packages/typescript/`, `packages/dart/`, `services/`, `database/` (excluding `node_modules`, `.git`, `.next`, `dist`, `build`, `.dart_tool`, `coverage`).
- For each suspected duplicate, the implementation bodies were opened side-by-side (`Read`) to confirm identical vs merely similar, and copy counts were tallied with `grep -rln "<signature>"`.
- DB duplication assessed from `CREATE TABLE` extraction over `database/supabase/migrations/*.sql` (249 tables) and `database/cloudflare/d1/migrations/*.sql`.

---

## Headline numbers

| Duplicate cluster | Copies | Level |
|---|---|---|
| Per-app API client wrappers over `@letbuyy/api-client` | **6 apps** (+1 console variant) | structural |
| `getApiBaseUrl()` env-fallback helper | **6** verbatim-ish copies | copy-paste |
| `hmacSha256Hex` (HMAC-SHA256 → hex) | **4** independent impls | copy-paste |
| `timingSafeEqual*` constant-time compare | **5** impls | copy-paste |
| `sha256Hex` | **5** impls | copy-paste |
| Local `formatDate()` in page components | **27** | copy-paste |
| Local `formatCurrency()` (en-IN/INR) | **6–7** | copy-paste |
| Local `slugify()` | **3** (+1 canonical in `cms-core`) | copy-paste |
| Marketing-site nav/hero/section components (live vs dead twin set) | **~9 pairs** | duplicate components |
| `getSupabaseAdmin()` admin-client helper | **2** | copy-paste |
| Payment provider HMAC helpers across adapters | **3** distinct + 1 cross-adapter import | copy-paste / coupling |
| Schema/type definition layering (domain pkg → api-types barrel → gateway Zod) | **3 layers** | conceptual (by design) |
| Theme definition layering (theme-engine ↔ gateway adapter ↔ editor) | **3 layers** | conceptual |

Overall: the **package-level** architecture is mostly single-source (one `@letbuyy/api-client`, one `@letbuyy/shared-types`, one `@letbuyy/ui`), so cross-package responsibility duplication is low. The real duplication is (a) **per-app boilerplate** re-implemented N times instead of shared, and (b) **small utility functions** copy-pasted into page components and a few into `routes/storefront.ts`.

---

## 1. Duplicate per-app API client wrappers — **structural, 6× (+1)**

Every Next app wraps the single shared `@letbuyy/api-client` (`createLetbuyyApiClient`, `packages/typescript/api-client/src/index.ts`, 1698 lines — the canonical client) with an almost-identical thin factory that (i) reads the session cookie, (ii) injects internal-auth headers, (iii) resolves the base URL. Six near-duplicate factories:

| App | File | Factory |
|---|---|---|
| storefront-runtime | `apps/storefront-runtime/src/lib/api/client.ts` (190) | `createStorefrontApiClient` |
| merchant-control-plane | `apps/merchant-control-plane/src/lib/api/client.ts` (170) | `createMerchantApiClient` |
| identity-platform | `apps/identity-platform/src/lib/api/client.ts` (199) | (identity client) |
| app-marketplace | `apps/app-marketplace/src/lib/api/client.ts` (85) | `createAppMarketplaceApiClient` |
| theme-marketplace | `apps/theme-marketplace/src/lib/api/client.ts` (57) | `createThemeMarketplaceApiClient` |
| platform-operations-portal | `apps/platform-operations-portal/src/lib/api/client.ts` (68) | `createPlatformOperationsApiClient` |

Plus a 7th variant `apps/platform-console/src/lib/console-api.ts` (126).

Shared boilerplate, e.g. the identical imports and `DEFAULT_API_BASE_URL` + session-cookie injection:
```ts
// app-marketplace/src/lib/api/client.ts:3-16
import { LetbuyyApiError, createLetbuyyApiClient, type LetbuyyApiClient } from '@letbuyy/api-client';
import { LETBUYY_MERCHANT_SESSION_COOKIE, createLetbuyyInternalSessionHeaders,
         getLetbuyyInternalAuthSecret } from '@letbuyy/auth-core';
const DEFAULT_API_BASE_URL = 'https://api.staging.letbuyy.store';
```
```ts
// platform-operations-portal/src/lib/api/client.ts:1-13  — same imports, same DEFAULT_API_BASE_URL
```
Evidence: `grep -rln "createLetbuyyApiClient" apps` → 6 client files + console; `grep "function getApiBaseUrl" apps` → 6 copies (next section).

---

## 2. Duplicate `getApiBaseUrl()` — **copy-paste, 6×**

The same env-fallback resolver is redefined in each app client:
```ts
function getApiBaseUrl(): string {
  return (process.env.LETBUYY_API_URL || process.env.NEXT_PUBLIC_API_URL ||
          process.env.API_URL || DEFAULT_API_BASE_URL).replace(/\/v1\/?$/, '').replace(/\/$/, '');
}
```
Identical (modulo trailing-slash variant) in:
```
apps/app-marketplace/src/lib/api/client.ts:22-29
apps/platform-operations-portal/src/lib/api/client.ts:19-26
apps/theme-marketplace/src/lib/api/client.ts:16-23
apps/merchant-control-plane/src/lib/api/client.ts
apps/identity-platform/src/lib/api/client.ts
apps/storefront-runtime/src/lib/api/client.ts:31-…  (variant: LETBUYY_API_BASE_URL / NEXT_PUBLIC_API_BASE_URL)
```
Evidence: `grep -rln "function getApiBaseUrl" apps` → 6 files.

---

## 3. Duplicate cryptographic utilities — **copy-paste, 4–5× each**

### 3a. `hmacSha256Hex` — 4 independent implementations
The same HMAC-SHA256→hex helper (Web Crypto `subtle.importKey` + `subtle.sign`) appears in four places:
```
packages/auth-core/src/index.ts:587                 (the natural shared home; exported)
services/api-gateway/src/lib/crypto.ts:23           (exported)
services/api-gateway/src/routes/storefront.ts:1669  (re-declared locally, NOT importing crypto.ts)
packages/infrastructure/razorpay-adapter/index.ts:164 (exported)
```
`routes/storefront.ts:1669-1682` is **byte-identical** to `lib/crypto.ts:23-36` (both: `crypto.subtle.importKey('raw', …, {name:'HMAC',hash:'SHA-256'}, false, ['sign'])` → `Array.from(new Uint8Array(...)).map(b=>b.toString(16).padStart(2,'0')).join('')`) — a literal copy living in the same service.

### 3b. `timingSafeEqual*` — 5 implementations
Constant-time compare re-implemented as:
```
packages/auth-core/src/index.ts:576        timingSafeEqualHex
packages/auth-core/src/index.ts:1165       timingSafeEqualBase64Url
services/api-gateway/src/lib/crypto.ts:10   timingSafeEqualHex
services/api-gateway/src/routes/storefront.ts:1656  timingSafeEqualHex  (identical copy of crypto.ts:10)
services/api-gateway/src/middleware/security.ts:233 timingSafeEqualText
packages/infrastructure/razorpay-adapter/index.ts:179 timingSafeEqual
```
`storefront.ts:1656-1667` == `lib/crypto.ts:10-21` byte-for-byte.

### 3c. `sha256Hex` — 5 implementations
```
packages/auth-core/src/index.ts
services/api-gateway/src/routes/storefront.ts:1684
services/api-gateway/src/extensions/app-functions-runtime.ts
services/api-gateway/src/execution/theme-execution.adapter.ts
services/api-gateway/src/execution/idempotency-execution.adapter.ts
```
Evidence: `grep -rln "function sha256Hex" apps services packages` → 5 files.

**Cross-adapter coupling (related smell):** `packages/infrastructure/stripe-adapter/index.ts:13` imports `hmacSha256Hex, timingSafeEqual` *from* `../razorpay-adapter/index` rather than from a shared crypto module — so the Stripe adapter depends on the Razorpay adapter purely for crypto helpers, while Cashfree (`cashfree-adapter/index.ts:156`) rolls its own `hmacSha256Base64`. Three adapters → three different sharing strategies for the same primitive.

---

## 4. Duplicate formatting utilities in page components — **copy-paste, high volume**

### 4a. `formatDate()` — 27 copies
27 page/component files each define a local `function formatDate`. No shared exported `formatDate` exists in `@letbuyy/ui` or `@letbuyy/utils` (grep of `packages/typescript/ui/src` for `formatDate`/`formatCurrency` → none). Spread across:
- `apps/merchant-control-plane/src/app/[store]/**` — 19 files (orders, customers, coupons, leads, gallery, posts, pages, reviews, testimonials, contact, comments, inventory, ai, settings/{plan,users,billing,apps}, …)
- `apps/platform-console/src/app/(dashboard)/**` — 4 (+ `lib/console-api.ts`)
- `apps/platform-operations-portal/src/app/(dashboard)/**` — 3 (crm, support, operations/onboarding)
- `apps/app-marketplace/src/app/(store)/apps/[slug]/page.tsx`

Evidence: `grep -rl "function formatDate" apps` → 27.

### 4b. `formatCurrency()` — 6–7 copies (identical INR bodies)
```ts
// merchant-control-plane/.../customers/page.tsx:101-103
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
}
// merchant-control-plane/.../dashboard/page.tsx:302-307  &  products/gift-cards/page.tsx:64-69  — identical body
function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format(value)
}
```
Locations: `customers`, `dashboard/page.tsx`, `dashboard/DashboardClient.tsx`, `products/gift-cards`, `settings/shipping`, `analytics` (inline arrow), plus `app-marketplace/.../[slug]/page.tsx`. Evidence: `grep -rl "function formatCurrency" apps` → 6 (+1 arrow form).

### 4c. `slugify()` — 3 page copies + 1 canonical
Three merchant pages each define an identical (or near-identical) `slugify`:
```
apps/merchant-control-plane/src/app/[store]/posts/page.tsx:91
apps/merchant-control-plane/src/app/[store]/pages/page.tsx:67
apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:106  (adds .slice(0,100))
```
…while a canonical implementation already exists and is exported: `packages/cms-core/src/index.ts:239 slugifyCmsTitle` (same `.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,100)`). The page copies do not import it. Bodies at `posts/page.tsx:91-97` and `pages/page.tsx:67-73` are identical to each other.

---

## 5. Duplicate components (React)

### 5a. Marketing-site twin component set — **~9 duplicate pairs**
`apps/marketing-site/src/components/` contains two parallel families for the same sections — a **live** set imported by `page.tsx` and a **dead** twin set imported by nothing (see Phase 9 §2b):

| Concern | Live (imported by `page.tsx`) | Dead twin (0 refs) |
|---|---|---|
| Nav | `Header.tsx` (620) | `Navbar.tsx` (32) |
| Hero | `Hero.tsx` (40) | `HeroSection.tsx` (43) |
| Features | `Features.tsx` | `FeaturesSection.tsx` |
| Pricing | `Pricing.tsx` | `PricingSection.tsx` |
| Testimonials/social | (in other sections) | `Testimonials.tsx`, `TestimonialsSection.tsx`, `SocialProof.tsx` |
| CTA | `FinalCTA.tsx` | `CTASection.tsx` |
| Capabilities | (folded into Features) | `Capabilities.tsx` |

Both `Navbar.tsx` and `Header.tsx` are nav components importing `BrandLogo` + `next/link` for the same site; only `Header.tsx` is wired. This is a duplicate-implementation pair where one was superseded but not removed.

### 5b. Theme-editor: monolith vs unused modular set — **structural**
The merchant theme editor exists twice: as the **live monolith** `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` and as an **unused modular decomposition** under `src/components/theme-editor/` (`EditorHeader`, `LeftSidebar`, `CenterPanel`, `RightSidebar`, `ThemeSettingsPanel`, `AddSectionModal`, `IconRail` — all 0 inbound refs, Phase 9 §2c). The monolith re-implements the panels inline rather than importing the modular components → the same editor UI expressed twice.

### 5c. Flutter: standalone widget vs inline `_buildX` — **structural**
In `apps/mobile/merchant-app`, multiple screens re-implement a widget inline instead of importing the standalone version. Confirmed example: `screens/products/products_screen.dart:761 _buildProductCard()` vs the unused `widgets/products/product_card.dart` (Phase 9 §11). Same for dashboard cards (`bento_grid`, `glass_stat_card`, `insights_grid` unused while dashboard screens build inline).

---

## 6. Duplicate Supabase client helpers — **2×**

`getSupabaseAdmin()` (admin/service-role client) is defined independently in two places:
```
services/api-gateway/src/lib/supabase.ts        function getSupabaseAdmin
packages/typescript/utils/src/supabase.ts       function getSupabaseAdmin  (+ getSupabaseClient)
```
Both wrap `@letbuyy/infrastructure/supabase-adapter` (`createSupabaseServiceClient`/`createSupabaseAnonClient`). The `@letbuyy/utils` copy is dead (Phase 9 §3a — the package is imported nowhere), so in practice the gateway's `lib/supabase.ts` is the live one; the utils copy is a stale duplicate. Beyond these, the supabase-adapter exposes a family of single-purpose factories (`createSupabaseServer/Browser/User/Service/Anon Client`) that are *not* duplicates — they are distinct client modes from one source (`packages/infrastructure/supabase-adapter/index.ts`).

---

## 7. Duplicate APIs / overlapping endpoints

- **GraphQL + REST shim for the same operations:** `services/api-gateway/src/index.ts` mounts both `'/graphql/admin'`+`'/admin/graphql'` and `'/graphql/storefront'`+`'/storefront/graphql'` (lines 380-399) — the same router is registered under two path aliases each (intentional alias duplication, low risk), and a REST-shim bridges GraphQL to REST (`graphql/rest-shim.ts`, `isGraphQLRestShimSubrequest`). This is overlapping surface area (REST routes + GraphQL covering similar reads) by design, not accidental endpoint duplication.
- **No two route modules implement the same resource** — each `services/api-gateway/src/routes/*.ts` owns a distinct prefix (`/products`, `/orders`, `/stores`, …). No duplicate resource handlers found.

---

## 8. Duplicate services / packages — **none at responsibility level**

Searched for multiple implementations of the same domain (auth, billing, events, payments):
- **Auth:** one domain package `@letbuyy/auth-core` (11 dependents). Identity flows live in `apps/identity-platform` (HTTP), session crypto in `auth-core`. The duplication is at the *helper* level (§3), not a second auth system. (Legacy `legacy/firebase/functions/src/*Auth.ts` is a *historical* second implementation but is quarantined under `legacy/` and imported by nothing — see Phase 9 §9e.)
- **Billing:** single `@letbuyy/billing-core` (3 dependents). No competing billing package.
- **Events:** single `@letbuyy/event-core` (9 dependents). The reserved `services/event-bus` is an empty placeholder (no code), not a second event implementation.
- **Payments:** single `@letbuyy/payments` interface package; the 7 `packages/infrastructure/*-adapter` modules each `implements PaymentProvider` for a different gateway (razorpay/stripe/paypal/cashfree/phonepe/upi/cod) — **polymorphic, not duplicate**. The only payment-layer duplication is the HMAC helpers (§3c).

Conclusion: no duplicate packages/services with overlapping responsibilities. Package boundaries are single-source.

---

## 9. Conceptual / layered duplication (by design)

These are the same model expressed in multiple layers — flagged for completeness; they are architectural, not copy-paste:

### 9a. Type/schema in 3 layers
A domain model is defined in (1) its domain package, (2) re-exported through the `@letbuyy/api-types` barrel, and (3) re-validated as a Zod schema in the gateway:
- `packages/typescript/api-types/src/index.ts` re-exports from **13** domain packages (`@letbuyy/{shared-types,commerce-core,checkout-core,payments,auth-core,tenant-core,cms-core,theme-engine,app-engine,event-core,search-core,notification-core,billing-core}`) — a barrel, so single-source, not a copy.
- `services/api-gateway/src/schemas/*.schema.ts` (17 Zod schemas) restate request/response shapes for runtime validation. The *shape* overlaps the TS types but serves a different purpose (runtime validation vs compile-time types). This is intentional two-layer modeling; the only dead part is the 3 unused schema files (Phase 9 §2f).

### 9b. Theme definitions in 3 layers
Theme section/block definitions appear in `packages/theme-engine/src/{theme-bundle,index}.ts` (engine), `services/api-gateway/src/execution/{theme-execution,schema-registry-execution}.adapter.ts` (runtime adapter), and the merchant editor (`.../editor/page.tsx`, `api/themes/[themeId]/editor/route.ts`) plus the unused `theme-editor/*` components. The definition of "what a section is" is therefore expressed in engine + gateway + editor. Single conceptual model, three representations — by design, but a maintenance-coupling hotspot.

---

## 10. Duplicate database structures

**Confidence: certain for the verdicts below.**

- **No duplicate Supabase tables.** All 249 `CREATE TABLE` names are distinct. The `<table>` / `<table>_partitioned` / `<table>_partitioned_default` triples (`outbox_events`, `platform_queue_jobs`, `runtime_telemetry_metrics`, `webhook_deliveries`, `worker_request_logs`) are **declarative partitioning**, not duplication — migrations `079`–`083` convert each hot table into a partitioned parent + default partition. (Documented also in Phase 9 §6.)
- **Supabase vs Cloudflare D1 are disjoint, not duplicated.** D1 (`database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql`) defines only execution-evidence tables (`provider_execution_evidence`, `replay_restoration_lineage`, `rollback_lineage`) that do **not** exist in the Supabase schema — separate stores for separate concerns, no overlapping table definitions.
- No near-identical table pairs (e.g. two "orders" tables) were found.

---

## Evidence Index

| # | Claim | Evidence (path:line / count) |
|---|---|---|
| D1 | 6 per-app API client wrappers over one shared client | `grep -rln "createLetbuyyApiClient" apps` → 6 + `console-api.ts`; canonical = `packages/typescript/api-client/src/index.ts` (1698 lines) |
| D2 | `getApiBaseUrl()` copied 6× | `grep -rln "function getApiBaseUrl" apps` → 6; bodies `app-marketplace:22-29`, `platform-operations-portal:19-26`, `theme-marketplace:16-23` |
| D3 | `hmacSha256Hex` 4 impls; storefront copy == crypto.ts | `auth-core/src/index.ts:587`, `api-gateway/src/lib/crypto.ts:23`, `api-gateway/src/routes/storefront.ts:1669`, `razorpay-adapter/index.ts:164` (storefront:1669-1682 ≡ crypto.ts:23-36) |
| D4 | `timingSafeEqual*` 5 impls | `auth-core:576,1165`, `crypto.ts:10`, `storefront.ts:1656`, `security.ts:233`, `razorpay-adapter:179` (storefront:1656-1667 ≡ crypto.ts:10-21) |
| D5 | `sha256Hex` 5 impls | `grep -rln "function sha256Hex"` → auth-core, storefront.ts:1684, app-functions-runtime.ts, theme-execution.adapter.ts, idempotency-execution.adapter.ts |
| D6 | Stripe adapter imports crypto from Razorpay adapter | `stripe-adapter/index.ts:13` `import { hmacSha256Hex, timingSafeEqual } from '../razorpay-adapter/index'`; `cashfree-adapter/index.ts:156` own `hmacSha256Base64` |
| D7 | `formatDate()` 27 local copies | `grep -rl "function formatDate" apps` → 27; no shared `formatDate` in `@letbuyy/ui` |
| D8 | `formatCurrency()` 6–7 copies, identical INR body | `grep -rl "function formatCurrency" apps` → 6; `customers:101-103`, `dashboard/page.tsx:302-307`, `gift-cards:64-69` identical |
| D9 | `slugify()` 3 page copies + canonical in cms-core | `posts/page.tsx:91`, `pages/page.tsx:67`, `online-store/pages/page.tsx:106` vs `cms-core/src/index.ts:239 slugifyCmsTitle` |
| D10 | Marketing-site live vs dead twin components | `page.tsx` imports `Header/Hero/Features/Pricing/FinalCTA`; dead twins `Navbar/HeroSection/FeaturesSection/PricingSection/CTASection/Testimonials*/SocialProof/Capabilities` (0 refs) |
| D11 | Theme editor monolith vs unused modular set | live `…/themes/[themeId]/editor/page.tsx`; unused `components/theme-editor/{EditorHeader,LeftSidebar,CenterPanel,RightSidebar,ThemeSettingsPanel,AddSectionModal,IconRail}.tsx` |
| D12 | Flutter inline build vs standalone widget | `products_screen.dart:761 _buildProductCard` vs unused `widgets/products/product_card.dart` |
| D13 | `getSupabaseAdmin()` defined 2× | `api-gateway/src/lib/supabase.ts`, `packages/typescript/utils/src/supabase.ts` (utils copy dead) |
| D14 | 7 payment adapters = polymorphism, not dup | `grep -l "PaymentProvider" packages/infrastructure/*/index.ts` → 7 (`cashfree,cod,paypal,phonepe,razorpay,stripe,upi`) |
| D15 | Single auth/billing/event/payments package each | inbound graph: `auth-core`=11, `billing-core`=3, `event-core`=9, `payments`=2; no competing packages (legacy firebase quarantined) |
| D16 | GraphQL+REST alias duplication intentional | `api-gateway/src/index.ts:380-399` registers `'/graphql/admin'`+`'/admin/graphql'`, `'/graphql/storefront'`+`'/storefront/graphql'` |
| D17 | `api-types` barrel re-exports 13 domain pkgs (single-source) | `grep -oE "from '@letbuyy/[a-z-]+'" packages/typescript/api-types/src/index.ts \| sort -u` → 13 |
| D18 | No duplicate DB tables; partitions are not dup | 249 distinct `CREATE TABLE`; `_partitioned`/`_default` triples from migrations 079-083 |
| D19 | Supabase vs D1 disjoint | D1 `0001_provider_execution_foundation.sql` = provider_execution_evidence/replay_restoration_lineage/rollback_lineage only |
