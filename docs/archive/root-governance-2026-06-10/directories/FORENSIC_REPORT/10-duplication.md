# Phase 10 — Duplication Investigation

Investigation date: 2026-06-05 (second pass, post-remediation)

> Forensic, documentation-only pass. Nothing was modified, deleted, moved, or renamed. Each finding cites side-by-side paths with line references and quantifies copy counts. "Duplication" is reported at three levels: **copy-paste** (byte/near-identical bodies), **structural** (same shape re-implemented per workspace), and **conceptual/layered** (the same model expressed in several layers by design).
>
> **Second pass:** re-verified against the post-remediation tree (~68 commits, `63053d18..HEAD`). The original body is preserved with line numbers corrected where files moved; new duplication introduced by the remediation streams is documented in §11 and summarised in **"Changes since first pass"**.

---

## Changes since first pass

| Cluster (first-pass claim) | Second-pass status | Evidence |
|---|---|---|
| `hmacSha256Hex`/`timingSafeEqual*`/`sha256Hex` copies (incl. re-declared copies inside `routes/storefront.ts`) | **STILL-OPEN, unmoved** — the storefront split (commit `86e65460` "split internal payment routes") extracted `routes/storefront/internal-payment-routes.ts` (233 lines) but did **not** touch the crypto copies: `storefront.ts` (now 4,833 lines) still re-declares `timingSafeEqualHex` (line 1791), `hmacSha256Hex` (1804), `sha256Hex` (1819) — the first two remain **byte-identical** to `lib/crypto.ts:10-21,23-36`. The new `internal-payment-routes.ts` contains **no** crypto helpers (0 grep hits) and did not duplicate further. Totals unchanged: `hmacSha256Hex` 4 impls, `timingSafeEqual*` 6 declarations across 5 files, `sha256Hex` 5 impls. | grep counts §3; `sed -n '1791,1830p' storefront.ts` vs `lib/crypto.ts` |
| 6 per-app API client wrappers | **STILL-OPEN** — same 6 `lib/api/client.ts` factories + `platform-console/src/lib/console-api.ts`; the new `apps/developer-portal` did *not* add a 7th wrapper (its `lib/` has `developer-surface.ts`/`reference.ts`, no api client). | `grep -rln createLetbuyyApiClient apps` → 6 clients + console (+1 new test file) |
| `getApiBaseUrl()` 6 copies | **STILL-OPEN, count corrected to 7** — a 7th copy at `apps/marketing-site/src/app/create/page.tsx:14` (variant) was present at first pass but under-counted; no new copies were added since 63053d18 (`git diff` on that file is empty). | `grep -rln "function getApiBaseUrl" apps` → 7 |
| `formatDate()` 27 copies | **STILL-OPEN, now 26** — WS5 consolidated platform-operations-portal from 3 copies to 1; WS9/console work *moved* copies into new files rather than removing them: merchant settings now carries 5 copies (incl. the `AppsSettingsClient.tsx`/dead `AppsSettingsContent.tsx` pair, one each), platform-console moved copies into 4 new `*IndexTable.tsx` components + `console-api.ts`. Still no shared TS `formatDate` anywhere (`packages/` grep → Dart only). Net 26 = 19 merchant + 5 console + 1 ops + 1 app-marketplace. | `grep -rl "function formatDate" apps` → 26 |
| `formatCurrency()` 6–7 copies | **STILL-OPEN, now 5** — `settings/shipping/page.tsx` and the analytics inline-arrow copy were rewritten without it; remaining: customers, dashboard/page, dashboard/DashboardClient, gift-cards, app-marketplace `[slug]`. Still no shared helper. | `grep -rl "function formatCurrency" apps` → 5 |
| `slugify()` 3 copies + 1 canonical | **STILL-OPEN, unchanged** — same 3 page copies at the same lines (`posts:91`, `pages:67`, `online-store/pages:106`) vs `cms-core/src/index.ts:239 slugifyCmsTitle`. WS9 added no copies and consolidated none. | grep §4c |
| Marketing-site dead twin set (~9 pairs) | **STILL-OPEN, unchanged** — all twins present, `page.tsx` imports the same live family. | §5a |
| Theme-editor monolith vs modular set | **STILL-OPEN, partially bridged** — NEW `SchemaFormRenderer.tsx` is now shared by *both* the live monolith (`editor/page.tsx:45,1784,1796,1822`) and the dead modular set (`ThemeSettingsPanel`, `RightSidebar`), so one panel-renderer is single-source; the other 7 components + `SectionItem` + 2 hooks remain a parallel dead implementation. | §5b updated |
| `getSupabaseAdmin()` 2× | **STILL-OPEN, unchanged** — `api-gateway/src/lib/supabase.ts` (live, now also `getSupabaseAdminFromEnv`) vs dead `packages/typescript/utils/src/supabase.ts` (package untouched). | §6 |
| Gateway-events clients (NEW since first pass) | **NEW duplication** — `services/webhook-service/src/gateway-events.ts` and `services/queue-workers/src/gateway-events.ts` are functionally identical `emitGatewayDomainEvent` implementations (same types, same URL, same guards, same error strings; differ only in formatting and where `GatewayServiceBinding` is declared), both created in the *same commit* `10d47da3`. The same fetch-the-gateway-with-internal-secret boilerplate also appears in webhook-service `gateway-order-transitions.ts` (`gatewayOrderMutation`) and `gateway-billing-transitions.ts` → **4 copies** of the pattern across 2 services. See §11. | §11 |
| Marketplace logger + unavailable component (NEW) | **NEW duplication** — `apps/app-marketplace/src/lib/logger.ts` ≡ `apps/theme-marketplace/src/lib/logger.ts` (byte-identical except the `app:` name string and one docstring word); `MarketplaceUnavailable.tsx` (app-marketplace, 44 lines) vs `marketplace-unavailable.tsx` (theme-marketplace, 27 lines) are the same component re-implemented per marketplace. See §11. | §11 |
| Root ledger root↔archive duplicates (NEW) | **NEW duplication (docs)** — `CODEX_MASTER_EXECUTION_LEDGER.md` (269,700 B) and `CODEX_WS12_LEDGER.md` byte-identical at root *and* in `docs/archive/root-residue/2026-06-05-foundation-hardening/`; `CODEX_WS7_LEDGER.md` in both, diverged (54 vs 51 lines); two parallel root mission docs (`CODEX_FOUNDATION_HARDENING_MISSION.md` 268 lines vs `CODEX_FOUNDATION_REMEDIATION_MISSION.md` 237 lines) describe the same forensic remediation. | Phase 9 §9a; `diff -q` |

---

## Method

- **Distinctive-string + function-name greps** across `apps/`, `apps/mobile/`, `packages/`, `packages/typescript/`, `packages/dart/`, `services/`, `database/` (excluding `node_modules`, `.git`, `.next`, `dist`, `build`, `.dart_tool`, `coverage`).
- For each suspected duplicate, the implementation bodies were opened side-by-side (`Read`) to confirm identical vs merely similar, and copy counts were tallied with `grep -rln "<signature>"`.
- DB duplication assessed from `CREATE TABLE` extraction over `database/supabase/migrations/*.sql` (249 tables) and `database/cloudflare/d1/migrations/*.sql`.

---

## Headline numbers (second pass, 2026-06-05 post-remediation)

| Duplicate cluster | Copies | Level | vs first pass |
|---|---|---|---|
| Per-app API client wrappers over `@letbuyy/api-client` | **6 apps** (+1 console variant) | structural | STILL-OPEN |
| `getApiBaseUrl()` env-fallback helper | **7** copies (6 client files + `marketing-site/.../create/page.tsx:14`) | copy-paste | STILL-OPEN (count corrected, was under-counted at 6) |
| `hmacSha256Hex` (HMAC-SHA256 → hex) | **4** independent impls | copy-paste | STILL-OPEN, unmoved by storefront split |
| `timingSafeEqual*` constant-time compare | **6** declarations / 5 files | copy-paste | STILL-OPEN |
| `sha256Hex` | **5** impls | copy-paste | STILL-OPEN |
| Gateway internal-mutation fetch client (`emitGatewayDomainEvent` + `gateway*Mutation`) | **4** copies across webhook-service + queue-workers, incl. 2 functionally-identical `gateway-events.ts` twins | copy-paste | **NEW** (all 4 files added post-first-pass) |
| Local `formatDate()` in page components | **26** | copy-paste | STILL-OPEN (27 → 26; copies migrated into new WS5/WS9/console files) |
| Local `formatCurrency()` (en-IN/INR) | **5** | copy-paste | STILL-OPEN (6–7 → 5) |
| Local `slugify()` | **3** (+1 canonical in `cms-core`) | copy-paste | STILL-OPEN, unchanged |
| Marketing-site nav/hero/section components (live vs dead twin set) | **~9 pairs** | duplicate components | STILL-OPEN, unchanged |
| Settings-apps pane (live `AppsSettingsClient` vs orphaned `AppsSettingsContent`) | **1 pair** (285 vs 311 lines) | duplicate components | **NEW** (orphaned by WS9) |
| Marketplace structured logger (`lib/logger.ts`) | **2** byte-identical-modulo-name copies | copy-paste | **NEW** |
| Marketplace "catalog unavailable" component | **2** parallel implementations | structural | **NEW** |
| `getSupabaseAdmin()` admin-client helper | **2** | copy-paste | STILL-OPEN |
| Payment provider HMAC helpers across adapters | **3** distinct + 1 cross-adapter import | copy-paste / coupling | STILL-OPEN, unchanged |
| Root ledger files duplicated root↔archive | **2 identical + 1 diverged** (+2 parallel mission docs) | docs duplication | **NEW** (side-effect of archive move) |
| Schema/type definition layering (domain pkg → api-types barrel → gateway Zod) | **3 layers** | conceptual (by design) | unchanged |
| Theme definition layering (theme-engine ↔ gateway adapter ↔ editor) | **3 layers** | conceptual | unchanged (SchemaFormRenderer now shared between monolith + modular set) |

Overall: the **package-level** architecture is mostly single-source (one `@letbuyy/api-client`, one `@letbuyy/shared-types`, one `@letbuyy/ui`), so cross-package responsibility duplication is low. The real duplication is (a) **per-app boilerplate** re-implemented N times instead of shared, and (b) **small utility functions** copy-pasted into page components and a few into `routes/storefront.ts`. **Second pass:** none of the pre-existing copy clusters was consolidated by remediation, and three new clusters were introduced (gateway-events twins, marketplace logger/unavailable pairs, root↔archive ledger duplicates).

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

*(Second pass: STILL-OPEN, unchanged — same 6 factories + console variant at HEAD; `grep -rln "createLetbuyyApiClient" apps` → the same 6 client files + `console-api.ts` (+1 new test consumer `identity-platform/src/__tests__/auth-flow.test.ts`). The new `apps/developer-portal` did not add an 8th wrapper — its `src/lib/` contains only `developer-surface.ts` and `reference.ts`.)*

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

## 2. Duplicate `getApiBaseUrl()` — **copy-paste, 7×** *(second pass: count corrected)*

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
apps/marketing-site/src/app/create/page.tsx:14-…   (7th — URL-parsing variant, defaults to https://api.letbuyy.store/v1)
```
Evidence: `grep -rln "function getApiBaseUrl" apps` → **7** files. Second pass: the `create/page.tsx` copy existed at the first-pass commit (added in `ba5fada9`, before 63053d18) and was under-counted in the first pass; the post-remediation diff touched none of the 7 (`git diff 63053d18..HEAD -- apps/marketing-site/src/app/create/page.tsx` → empty). STILL-OPEN.

---

## 3. Duplicate cryptographic utilities — **copy-paste, 4–6× each** *(second pass: re-verified, unmoved by the storefront split)*

**Second-pass context:** commit `86e65460` ("refactor(storefront): split internal payment routes") extracted `services/api-gateway/src/routes/storefront/internal-payment-routes.ts` (233 lines; imported and registered at `storefront.ts:33,1826`). The split moved the internal payment handlers out but **left every local crypto copy in `storefront.ts`** (now 4,833 lines) — the copies only shifted line numbers (1656→1791, 1669→1804, 1684→1819). The new `internal-payment-routes.ts` contains **zero** crypto declarations (grep for `hmacSha256|sha256Hex|timingSafe` → 0), so the split neither consolidated nor further duplicated the helpers. All counts below re-verified at HEAD.

### 3a. `hmacSha256Hex` — 4 independent implementations (STILL-OPEN)
The same HMAC-SHA256→hex helper (Web Crypto `subtle.importKey` + `subtle.sign`) appears in four places:
```
packages/auth-core/src/index.ts:587                 (the natural shared home; exported)
services/api-gateway/src/lib/crypto.ts:23           (exported)
services/api-gateway/src/routes/storefront.ts:1804  (re-declared locally, NOT importing crypto.ts; was :1669 first pass)
packages/infrastructure/razorpay-adapter/index.ts:164 (exported)
```
`routes/storefront.ts:1804-1817` is **byte-identical** to `lib/crypto.ts:23-36` (both: `crypto.subtle.importKey('raw', …, {name:'HMAC',hash:'SHA-256'}, false, ['sign'])` → `Array.from(new Uint8Array(...)).map(b=>b.toString(16).padStart(2,'0')).join('')`) — a literal copy living in the same service.

### 3b. `timingSafeEqual*` — 6 declarations / 5 files (STILL-OPEN)
Constant-time compare re-implemented as:
```
packages/auth-core/src/index.ts:576        timingSafeEqualHex
packages/auth-core/src/index.ts:1165       timingSafeEqualBase64Url
services/api-gateway/src/lib/crypto.ts:10   timingSafeEqualHex
services/api-gateway/src/routes/storefront.ts:1791  timingSafeEqualHex  (identical copy of crypto.ts:10; was :1656 first pass)
services/api-gateway/src/middleware/security.ts:233 timingSafeEqualText
packages/infrastructure/razorpay-adapter/index.ts:179 timingSafeEqual
```
`storefront.ts:1791-1803` == `lib/crypto.ts:10-21` byte-for-byte (re-confirmed second pass).

### 3c. `sha256Hex` — 5 implementations (STILL-OPEN)
```
packages/auth-core/src/index.ts:1060
services/api-gateway/src/routes/storefront.ts:1819   (was :1684 first pass)
services/api-gateway/src/extensions/app-functions-runtime.ts:132
services/api-gateway/src/execution/theme-execution.adapter.ts:171
services/api-gateway/src/execution/idempotency-execution.adapter.ts:25
```
Evidence: `grep -rln "function sha256Hex" apps services packages` → 5 files. The new execution modules added by remediation (`subscription-execution.adapter.ts`, `cloudflare-queue-triggers.ts`) and the new routes (`internal-billing.ts`, `internal-events.ts`) introduced **no** additional crypto copies (grep → 0 in each).

**Cross-adapter coupling (related smell):** `packages/infrastructure/stripe-adapter/index.ts:13` imports `hmacSha256Hex, timingSafeEqual` *from* `../razorpay-adapter/index` rather than from a shared crypto module — so the Stripe adapter depends on the Razorpay adapter purely for crypto helpers, while Cashfree (`cashfree-adapter/index.ts:156`) rolls its own `hmacSha256Base64`. Three adapters → three different sharing strategies for the same primitive.

---

## 4. Duplicate formatting utilities in page components — **copy-paste, high volume**

### 4a. `formatDate()` — 26 copies *(second pass: 27 → 26, copies migrated rather than consolidated)*
26 page/component files each define a local `function formatDate`. Still no shared exported TS `formatDate` anywhere in `packages/` (second-pass grep → only Dart `packages/dart/core/lib/src/utils/date_formatter.dart`). Spread across:
- `apps/merchant-control-plane/src/app/[store]/**` — **19** files (orders, customers, coupons, leads, gallery, posts, pages, online-store/pages, reviews, testimonials, contact, comments, products/inventory, ai, settings/{plan,users,billing} + **both halves of the WS9 apps-settings pair**: live `settings/apps/AppsSettingsClient.tsx` *and* orphaned `settings/apps/AppsSettingsContent.tsx`)
- `apps/platform-console/**` — **5**: the WS-stream rework moved copies out of pages into 4 new components (`trust-safety/TrustSafetyIndexTable.tsx`, `audit-logs/AuditLogIndexTable.tsx`, `subscriptions/SubscriptionManagementIndexTable.tsx`, `stores/StoreDirectoryIndexTable.tsx`) + `lib/console-api.ts`
- `apps/platform-operations-portal/src/app/(dashboard)/**` — **1** (`operations/onboarding/page.tsx`; WS5 removed the crm/support copies — the only net consolidation observed)
- `apps/app-marketplace/src/app/(store)/apps/[slug]/page.tsx` — 1

Evidence: `grep -rl "function formatDate" apps` → 26 (second pass). Pattern: remediation streams *relocated* copies into new components instead of extracting a shared helper, and even duplicated one into a now-dead file (`AppsSettingsContent.tsx`).

### 4b. `formatCurrency()` — 5 copies (identical INR bodies) *(second pass: was 6–7)*
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
Locations *(second pass: 6–7 → 5)*: `customers/page.tsx`, `dashboard/page.tsx`, `dashboard/DashboardClient.tsx`, `products/gift-cards/page.tsx`, plus `app-marketplace/.../[slug]/page.tsx`. The `settings/shipping/page.tsx` copy and the analytics inline-arrow form were dropped in the WS9/console rewrites (the rewritten `settings/shipping/page.tsx` no longer contains `formatCurrency` or `Intl.NumberFormat`). Still no shared helper. Evidence: `grep -rl "function formatCurrency" apps` → 5 (second pass).

### 4c. `slugify()` — 3 page copies + 1 canonical
Three merchant pages each define an identical (or near-identical) `slugify`:
```
apps/merchant-control-plane/src/app/[store]/posts/page.tsx:91
apps/merchant-control-plane/src/app/[store]/pages/page.tsx:67
apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:106  (adds .slice(0,100))
```
…while a canonical implementation already exists and is exported: `packages/cms-core/src/index.ts:239 slugifyCmsTitle` (same `.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,100)`). The page copies do not import it. Bodies at `posts/page.tsx:91-97` and `pages/page.tsx:67-73` are identical to each other.

*(Second pass: unchanged — all 3 page copies remain at the same lines; the WS9 settings hub added no slugify copies and consolidated none.)*

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

### 5b. Theme-editor: monolith vs unused modular set — **structural** *(second pass: still dual, one shared renderer)*
The merchant theme editor exists twice: as the **live monolith** `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` and as an **unused modular decomposition** under `src/components/theme-editor/` (`EditorHeader`, `LeftSidebar`, `CenterPanel`, `RightSidebar`, `ThemeSettingsPanel`, `AddSectionModal`, `IconRail`, + new dead `SectionItem` — all 0 external refs, Phase 9 §2c). The monolith re-implements the panels inline rather than importing the modular components → the same editor UI expressed twice.

Second pass: commit `280f6e83` added `SchemaFormRenderer.tsx` to the same directory and it is the one piece **shared by both implementations** — the live monolith imports it (`editor/page.tsx:45`, used 3×) and the dead modular `ThemeSettingsPanel.tsx`/`RightSidebar.tsx` import it too. So one settings-form renderer is now single-source while the surrounding editor shell remains duplicated (and the dead shell was icon-polished in the same commit without being wired). The first-pass "useEditorHistory in use" note is corrected in Phase 9 §2c: the hook is reachable only from the dead set.

### 5c. Flutter: standalone widget vs inline `_buildX` — **structural**
In `apps/mobile/merchant-app`, multiple screens re-implement a widget inline instead of importing the standalone version. Confirmed example: `screens/products/products_screen.dart:761 _buildProductCard()` vs the unused `widgets/products/product_card.dart` (Phase 9 §11). Same for dashboard cards (`bento_grid`, `glass_stat_card`, `insights_grid` unused while dashboard screens build inline). *(Second pass: unchanged — same inline builds, same unused widgets.)*

### 5d. Settings-apps pane: live client vs orphaned predecessor — **NEW duplicate pair (second pass)**
`apps/merchant-control-plane/src/app/[store]/settings/apps/` now contains two implementations of the same apps-settings pane: the **live** `AppsSettingsClient.tsx` (285 lines, imported by `page.tsx:4`) and the **orphaned** `AppsSettingsContent.tsx` (311 lines, 0 inbound refs). At first-pass commit 63053d18 `page.tsx` imported `AppsSettingsContent`; the WS9 rework swapped the import to `AppsSettingsClient` without removing the old file. Both define their own `formatDate` (counted in §4a). Same supersede-without-delete pattern as the marketing-site twins (§5a).

---

## 6. Duplicate Supabase client helpers — **2×**

`getSupabaseAdmin()` (admin/service-role client) is defined independently in two places:
```
services/api-gateway/src/lib/supabase.ts        function getSupabaseAdmin (:16; + getSupabaseAdminFromEnv :12)
packages/typescript/utils/src/supabase.ts       function getSupabaseAdmin (:34; + getSupabaseClient)
```
Both wrap `@letbuyy/infrastructure/supabase-adapter` (`createSupabaseServiceClient`/`createSupabaseAnonClient`). The `@letbuyy/utils` copy is dead (Phase 9 §3a — the package is imported nowhere; untouched since first pass), so in practice the gateway's `lib/supabase.ts` is the live one; the utils copy is a stale duplicate. Beyond these, the supabase-adapter exposes a family of single-purpose factories (`createSupabaseServer/Browser/User/Service/Anon Client`) that are *not* duplicates — they are distinct client modes from one source (`packages/infrastructure/supabase-adapter/index.ts`). *(Second pass: STILL-OPEN, unchanged.)*

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

- **No duplicate Supabase tables.** All 250 `CREATE TABLE` names are distinct (second-pass extraction; was reported 249 — counting-method delta, no new table: post-first-pass migrations `087`–`089` are ALTER + `CREATE OR REPLACE FUNCTION` only). The `<table>` / `<table>_partitioned` / `<table>_partitioned_default` triples (`outbox_events`, `platform_queue_jobs`, `runtime_telemetry_metrics`, `webhook_deliveries`, `worker_request_logs`) are **declarative partitioning**, not duplication — migrations `079`–`083` convert each hot table into a partitioned parent + default partition. (Documented also in Phase 9 §6.)
- **Supabase vs Cloudflare D1 are disjoint, not duplicated.** D1 (`database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql`) defines only execution-evidence tables (`provider_execution_evidence`, `replay_restoration_lineage`, `rollback_lineage`) that do **not** exist in the Supabase schema — separate stores for separate concerns, no overlapping table definitions.
- No near-identical table pairs (e.g. two "orders" tables) were found. *(Second pass: verdicts unchanged.)*

---

## 11. NEW duplication introduced post-first-pass (second pass, `63053d18..HEAD`)

### 11a. `gateway-events.ts` twins + the internal-mutation fetch boilerplate — **copy-paste, 4 copies across 2 services**

The events-centralization commit `10d47da3` ("fix(events): centralize outbox event writes") created **two functionally identical clients in the same commit**:

```
services/webhook-service/src/gateway-events.ts   (51 lines, 4-space indent, double quotes;
                                                  imports GatewayServiceBinding from ./gateway-order-transitions)
services/queue-workers/src/gateway-events.ts     (53 lines, 2-space indent, single quotes;
                                                  declares GatewayServiceBinding inline)
```
Both export the same `GatewayEventEnv` / `GatewayDomainEventInput` interfaces and the same `emitGatewayDomainEvent()` — identical guard clauses (`"API_GATEWAY_SERVICE binding is required for gateway-owned event mutations"`, `"INTERNAL_API_SECRET is required …"`), identical target URL (`https://api-gateway/v1/internal/events/domain`), identical headers (`X-Internal-API-Secret`), identical error-payload fallback (`response.json().catch(…text…)`) and identical failure message (`API gateway event mutation failed: …`). They differ only in formatting and the `GatewayServiceBinding` source. Each ships its own near-identical test (`services/{webhook-service,queue-workers}/test/gateway-events.test.mjs`).

The same fetch-the-gateway-with-internal-secret skeleton (binding guard → secret guard → `env.API_GATEWAY_SERVICE.fetch('https://api-gateway' + path, POST + X-Internal-API-Secret)` → json/text fallback → throw on !ok) is additionally re-implemented in two more webhook-service modules added in the same window:
```
services/webhook-service/src/gateway-order-transitions.ts:14-…    gatewayOrderMutation()   (commit 9b5e0604)
services/webhook-service/src/gateway-billing-transitions.ts:14-…  (billing variant)         (commit 964c46d1)
```
→ **4 copies** of the pattern (grep `"API_GATEWAY_SERVICE binding is required"` → 4 source files + 4 test files). All four files are new since the first pass (`git ls-tree 63053d18 services/*/src` shows neither service had them). Classification: **NEW copy-paste duplication** — the consolidation of outbox writes behind the gateway de-duplicated the *write path* but duplicated the *client*.

### 11b. Marketplace `lib/logger.ts` pair — **copy-paste, 2 byte-identical-modulo-name copies**

```
apps/app-marketplace/src/lib/logger.ts     (34 lines)
apps/theme-marketplace/src/lib/logger.ts   (34 lines)
```
Identical structured-JSON loggers (same `LogLevel` type, same `emit()`, same exported `logger` object, same "This is the ONLY module permitted to call `console.*`" doc) differing only in the hardcoded `app:` field (`'app-marketplace'` vs `'theme-marketplace'`) and one docstring word. Both added post-first-pass; only these 2 apps carry the pattern (`grep -rln "Minimal structured logger" apps services packages` → 2). A third structural duplicate at line of sight: nothing in `@letbuyy/*` exports a shared logger.

### 11c. Marketplace "catalog unavailable" component pair — **structural, 2 implementations**

```
apps/app-marketplace/src/components/MarketplaceUnavailable.tsx      (44 lines, named export, optional onRetry prop)
apps/theme-marketplace/src/components/marketplace-unavailable.tsx   (27 lines, default export, router.refresh only)
```
Same purpose (explicit retryable error state so a backend outage is "never presented as 'no apps' / 'no themes'"), same JSX skeleton (`role="alert"` + title + body + retry button using the same CSS variables), copy strings and minor API differing. Both are live (imported by each marketplace's pages/services). Classification: **NEW per-app re-implementation** of one concept.

### 11d. Root↔archive ledger duplicates — **docs duplication (side-effect of the archive move)**

The root-residue archive (Phase 9 §9a) left/created exact duplicates:
- `CODEX_MASTER_EXECUTION_LEDGER.md` — byte-identical (269,700 B) at repo root **and** `docs/archive/root-residue/2026-06-05-foundation-hardening/` (`diff -q` → identical).
- `CODEX_WS12_LEDGER.md` — byte-identical in both locations.
- `CODEX_WS7_LEDGER.md` — present in both and **diverged** (root 54 lines vs archive 51) — two competing copies of one ledger.
- Two parallel root mission documents for the same remediation effort: `CODEX_FOUNDATION_HARDENING_MISSION.md` (268 lines) and `CODEX_FOUNDATION_REMEDIATION_MISSION.md` (237 lines) — both cite `FORENSIC_REPORT/16` as canonical issue source, list the same predecessors, and carry the same governance posture; only the HARDENING one has a matching active LEDGER/STATUS pair at root.

### 11e. New modules checked and found NOT duplicative (for completeness)

- `routes/internal-billing.ts` / `routes/internal-events.ts` / `execution/subscription-execution.adapter.ts` / `execution/cloudflare-queue-triggers.ts` / `routes/storefront/internal-payment-routes.ts` — each owns a distinct concern, imports shared `lib/supabase.ts` + execution adapters, and re-declares no crypto/format helpers (grep → 0).
- Merchant settings hub (`components/settings/{SettingsShell,SettingsPane,SettingsIndex,SettingsSearch,BackendNeededPane}` + `settings-navigation.ts`) — single new navigation module replacing per-page chrome; it did not import the old dead `SettingsSidebar.tsx`, which remains a stale parallel (Phase 9 §2d), but the hub itself is single-source.
- `@letbuyy/ui` WS1 additions (`layout.tsx` new, `controls.tsx` extended; `data-table/feedback/overlays/productivity/visual/primitives` barrel-exported from `src/index.ts`) — shared-package consolidation, the opposite of duplication. Note `@letbuyy/ui` now exports a `Badge` (`src/index.ts:10` from `./data-table`) while storefront-runtime still carries its own dead `components/ui/badge.tsx` (Phase 9 §2a) — a latent dead-twin, not active duplication.

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
| D18 | No duplicate DB tables; partitions are not dup | 249 distinct `CREATE TABLE` (250 at second pass); `_partitioned`/`_default` triples from migrations 079-083 |
| D19 | Supabase vs D1 disjoint | D1 `0001_provider_execution_foundation.sql` = provider_execution_evidence/replay_restoration_lineage/rollback_lineage only |

### Second-pass evidence (2026-06-05, post-remediation, `63053d18..HEAD` = 68 commits)

| # | Claim | Evidence (path:line / count) |
|---|---|---|
| D20 | Storefront split did not move/consolidate crypto copies | `routes/storefront/internal-payment-routes.ts` (233 lines, commit 86e65460) — grep `hmacSha256\|sha256Hex\|timingSafe` → 0; `storefront.ts` (4,833 lines) local copies at :1791/:1804/:1819; `sed -n '1791,1830p'` ≡ `lib/crypto.ts:10-36` |
| D21 | `getApiBaseUrl` = 7 copies; none added/removed post-pass | `grep -rln "function getApiBaseUrl" apps` → 7 (6 clients + `marketing-site/src/app/create/page.tsx:14`); the 7th added pre-63053d18 (commit ba5fada9); `git diff 63053d18..HEAD` on it → empty |
| D22 | `formatDate` 26 / `formatCurrency` 5 / `slugify` 3+1 | greps at HEAD; merchant 19 + console 5 (4 new `*IndexTable.tsx` + console-api) + ops 1 + app-marketplace 1; shipping/analytics currency copies dropped; slugify lines unchanged (`posts:91`, `pages:67`, `online-store/pages:106`, `cms-core:239`) |
| D23 | Gateway-events twins functionally identical, same commit | `services/webhook-service/src/gateway-events.ts` vs `services/queue-workers/src/gateway-events.ts` — same interfaces/URL/guards/error strings, formatting-only diff; both `git log --diff-filter=A` → 10d47da3 |
| D24 | Internal-mutation fetch boilerplate ×4 | grep `"API_GATEWAY_SERVICE binding is required"` → 4 src files (`gateway-events.ts` ×2, `gateway-order-transitions.ts` [9b5e0604], `gateway-billing-transitions.ts` [964c46d1]) + 4 tests; `git ls-tree 63053d18 services/{webhook-service,queue-workers}/src` lacks all 4 |
| D25 | Marketplace logger pair byte-identical-modulo-name | `apps/{app,theme}-marketplace/src/lib/logger.ts` (34 lines each); diff = `app:` string + 1 docstring word; `grep -rln "Minimal structured logger"` → 2 |
| D26 | Marketplace unavailable component pair | `app-marketplace/src/components/MarketplaceUnavailable.tsx` (44) vs `theme-marketplace/src/components/marketplace-unavailable.tsx` (27); diff shows same skeleton, different copy/export style; both imported by pages/services |
| D27 | AppsSettings live/orphaned pair | `settings/apps/AppsSettingsClient.tsx` (285, imported `page.tsx:4`) vs `AppsSettingsContent.tsx` (311, 0 refs; was imported at `git show 63053d18:…/apps/page.tsx`) |
| D28 | SchemaFormRenderer shared by monolith + dead modular set | `editor/page.tsx:45,1784,1796,1822`; `theme-editor/{ThemeSettingsPanel,RightSidebar}.tsx` import `./SchemaFormRenderer`; all added in 280f6e83 |
| D29 | Root↔archive ledger duplicates | `diff -q` → `CODEX_MASTER_EXECUTION_LEDGER.md` (269,700 B) + `CODEX_WS12_LEDGER.md` identical root vs `docs/archive/root-residue/2026-06-05-foundation-hardening/`; `CODEX_WS7_LEDGER.md` 54 vs 51 lines; missions 268 vs 237 lines both citing `FORENSIC_REPORT/16` |
| D30 | New gateway modules non-duplicative; ui Badge vs dead storefront badge | internal-billing/events/subscription-adapter/queue-triggers/internal-payment-routes greps → 0 helper re-declarations; `@letbuyy/ui/src/index.ts:10` exports `Badge` while `storefront-runtime/src/components/ui/badge.tsx` stays dead (Phase 9 §2a) |
