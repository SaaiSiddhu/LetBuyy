# Theme Marketplace Deep Analysis

## Deployment Status

The theme marketplace is **frozen and not deployed to production**. Evidence:

- `runtime.manifest.json` sets `"runtimeCategory": "frozen-next-app"` and `"deploymentAuthority": { "platform": "frozen-not-deployed" }`.
- The manifest states explicitly: "Frozen app is not a production runtime; production topology must keep it frozen/not-deployed" and "No Vercel deployment participation is allowed until an ARB-approved reopen trigger changes this manifest."
- `AGENTS.md` states: "Frozen roots are source-kept and de-deployed unless the Constitution and ARB explicitly activate them; do not add production deploy targets, public launch copy, or live marketplace/portal operation by default."
- The `root CLAUDE.md` lists `apps/theme-marketplace` among the frozen/pending-consolidation apps: "not production deploy targets."
- The `environmentAuthority.secretStore` field reads `"none - frozen app is not deployed"`.

Despite being frozen for deployment, the source code is fully implemented with real UI, API routes, and gateway integration. The app runs locally on port 9005 (`"dev": "next dev -p 9005"`).

---

## Architecture Overview

The theme marketplace is a standalone Next.js 16 application (`@letbuyy/theme-marketplace`) that implements a Shopify-style theme store for LetBuyy merchants and third-party theme developers. It is **separate from all other apps** — it has no cross-app runtime imports and communicates exclusively with the platform API gateway (`services/api-gateway`) via the `@letbuyy/api-client` package.

**Framework:** Next.js 16.1.6 with App Router and React 19.  
**Port (local):** 9005.  
**Auth:** Merchant ES256 session cookie (`LETBUYY_MERCHANT_SESSION_COOKIE`) verified server-side using `@letbuyy/auth-core`. The `proxy.ts` middleware gate protects `/checkout/*`, `/dashboard/*`, and `/install/*`. Public browsing (discovery, catalog, theme detail, category pages, preview shell) is unauthenticated.  
**API transport:** `createThemeMarketplaceApiClient` in `src/lib/api/client.ts` calls `resolveLetbuyyApiBaseUrl` using `LETBUYY_API_URL` / `NEXT_PUBLIC_API_URL` / `API_URL`. If none are configured the function throws — there is no hardcoded staging fallback.  
**Session forwarding:** When a session cookie is present the client creates internal session headers via `createLetbuyyInternalSessionHeaders` using `INTERNAL_API_SECRET` / `LETBUYY_INTERNAL_API_SECRET`. These headers are forwarded to the API gateway on every authenticated request.

---

## Page-by-Page Map

| Page | Route | Purpose | Data Source | Auth Required |
|------|-------|---------|-------------|---------------|
| Homepage | `/` | Hero, featured themes, collections, categories, value props | `ThemeService.listThemes` (sort: rating), `ThemeService.getCollections` | No |
| Theme gallery | `/themes` | Full-catalog browse with sidebar filters (category, pricing, industry, layout, tag, feature, price range, sort), pagination, saved search | `ThemeService.listThemes` with all filter params, `ThemeService.getIndustries`, `ThemeService.getThemeSuggestions` | No |
| Theme detail | `/themes/[slug]` | Single theme page: gallery, live demo embed, features, reviews, changelog, quality facts, color presets, actions sidebar, similar themes | `ThemeService.getThemeBySlug`, `ThemeService.listThemes` (similar), `ThemeService.getUserStores`, `ThemeService.getThemeReviews` | No (stores require auth) |
| Category landing | `/themes/category/[category]` | Category-scoped browse (store, portfolio, resume, landing, saas) | `ThemeService.listThemes` filtered by category | No |
| Install | `/install` | Guided install: select store + preset, confirm, call gateway install API | `ThemeService.getThemeBySlug`, `ThemeService.getUserStores`, `ThemeService.installTheme` | Yes |
| Checkout | `/checkout` | Client-component Razorpay INR checkout: load theme, create purchase order, open Razorpay, verify payment | `/api/themes/[slug]` POST (purchase / verify_purchase) | Yes |
| Checkout success | `/checkout/success` | Post-payment confirmation, receipt, license key, next-steps guide | `ThemeService.getThemeReceipt` | Yes |
| Dashboard overview | `/dashboard` | Summary stats: installed themes count, purchases count, premium licenses | `ThemeService.getUserPurchases`, `ThemeService.getUserInstallations` | Yes |
| Dashboard downloads | `/dashboard/downloads` | Per-purchase download artifacts with signed URLs (or local dev data URIs) | `ThemeService.getThemeDownloads` | Yes |
| Dashboard installations | `/dashboard/installations` | Per-store installation list with version, status, update/rollback actions, editor link | `ThemeService.getUserInstallations`, `ThemeService.getThemeReleases` per install | Yes |
| Dashboard purchases | `/dashboard/purchases` | Purchase history with receipt, license key, refund request form | `ThemeService.getUserPurchases` | Yes |
| Preview token | `/preview/[token]` | Anonymous sandbox preview shell (unauthenticated) | `ThemeService.getThemeBySlug` (optional) | No |
| Developer console | `/developer` | Listing builder form, existing listings, payout program status | `ThemeService.getDeveloperDashboard` | Yes |
| New listing | `/developer/listings/new` | Full listing-builder form: metadata, pricing, license tiers, bundle manifest, review submission | `ThemeService.createDeveloperListing` | Yes |

---

## Theme Lifecycle

### Discovery

Themes are browsed on `/themes` with a full left-rail filter sidebar. Filtering parameters are all URL-backed (query string) so filter states are shareable and reproducible for QA. Available filters:

- **Category:** store, portfolio, resume, landing, saas
- **Pricing:** all, free, paid (maps to `one_time` on the service)
- **Industry:** dynamic from `ThemeService.getIndustries()` (gateway → `themes` table `industry` column)
- **Layout:** 11 static options (standard, grid, compact, editorial, gallery, document, single-page, campaign, splash, product, startup)
- **Tag, Feature:** free-text facet filters
- **Price range:** INR min/max
- **Sort:** popular, trending, rating, recent, name, price_low, price_high

Autocomplete suggestions are built from the current page's theme names, tags, industries, and features, or from `ThemeService.getThemeSuggestions(query)` which calls the gateway's `/suggest` endpoint querying the `themes` table for `name.ilike` or `description.ilike` matches.

The homepage displays up to 4 featured themes (sorted by rating), a collections grid (from `theme_collections` table), and a category showcase.

### Preview

Two preview paths exist:

1. **Store-scoped preview** (from the detail page sidebar when user has stores): calls `ThemeService.createThemePreviewSession(slug, storeId)` which POSTs to the gateway. Returns a `preview_token`. The marketplace then redirects to the storefront-runtime preview URL via `buildStorefrontPreviewUrl(preview_token)` — this renders the theme in the actual storefront runtime for the selected store.

2. **Anonymous sandbox preview** (`/preview/[token]` and `themeSandboxPreviewHref`): renders `AnonymousPreviewShell` — a lightweight iframe wrapper that does not require store selection. Used for quick previews from theme cards and the detail page "Sandbox preview" action.

The detail page also includes a `ThemeLiveDemoEmbed` which iframe-embeds the theme's `demo_url` or the sandbox preview URL directly on the detail page (sandboxed: `allow-same-origin allow-scripts allow-forms allow-popups`).

### Purchase / Checkout

The checkout page (`/checkout`) is a `'use client'` component using `useSearchParams` to read `?theme=`. Flow:

1. Fetches theme details from `/api/themes/[slug]` (GET).
2. User enters billing name + email.
3. On submit: POSTs to `/api/themes/[slug]` with `{ action: 'purchase', currency: 'INR', idempotency_key: 'theme_<slug>_<uuid>' }`.
4. Gateway creates a `theme_purchases` row, creates a Razorpay order, and returns `{ razorpay_order_id, amount, currency, key_id }`.
5. Razorpay JS SDK is loaded dynamically; `new Razorpay(options).open()` is called.
6. On payment success the handler POSTs `{ action: 'verify_purchase', provider: 'razorpay', provider_proof: { razorpay_order_id, razorpay_payment_id, razorpay_signature } }` to `/api/themes/[slug]`.
7. Gateway verifies the Razorpay HMAC signature server-side, updates the purchase status to `completed`, and returns `{ purchase_id, status }`.
8. Checkout redirects to `/checkout/success?theme=<slug>&purchase=<purchase_id>`.

If `already_purchased` or `payment_required === false` comes back in step 4, checkout skips directly to success.

GST (18%) is computed client-side for display only: `Math.round(letbuyy_price_inr * 18 / 118)`. Server-side GST computation is done in the gateway receipt generation using the same formula. In dev, `THEME_MARKETPLACE_DEV_GSTIN = '27ABCDE1234F1Z5'`; in production `THEME_MARKETPLACE_GSTIN` env var is required.

### Installation

The install page (`/install?theme=<slug>`) collects:
- Store selection (from user's stores via `ThemeService.getUserStores`)
- Preset selection (default / conversion / editorial)
- Explicit confirmation checkbox

On form submit: calls `ThemeService.installTheme(slug, storeId, { preset, marketplace_install: true })` which calls `api.themes.install(slug, { store_id: storeId, config_overrides })` on the gateway. The gateway upserts a `store_themes` row and emits a domain event. On success the marketplace redirects to `/dashboard/installations?installed=<slug>`.

For **paid themes**, the detail page sidebar routes to `/checkout?theme=<slug>` first; on checkout success the user is directed back to `/install?theme=<slug>`.

The merchant-control-plane also has a parallel install path at `POST /api/themes/install` that accepts either a `themeSlug` (from marketplace) or a raw `bundle` (upload). This path calls the same gateway `api.themes.install` method.

### Activation

After install, the user is linked to the merchant theme editor via `getAdminUrl('/<store_slug>/online-store/themes/<themeId>/editor')`. This is a deep link into the merchant-control-plane, which owns the theme editor and the `sites.theme_id` / `sites.template_config.themeSettings` fields. The marketplace install step only records the `store_themes` row and propagates a domain event; theme activation (making the theme live for storefront rendering) is the merchant editor's responsibility through `POST /api/themes/publish`.

### Updates

The installations page (`/dashboard/installations`) detects update availability by comparing `version_installed` against the theme's current `version` field. If they differ, it shows an "Update pending" badge. Clicking "Apply update" calls `ThemeService.installTheme(slug, storeId, { marketplace_update: true })` which creates a new release via the gateway. The page also shows rollback options: `ThemeService.rollbackThemeRelease(slug, storeId, releaseId)` with `make_store_live: true`.

### Developer Publishing

The developer console (`/developer`) and the new listing page (`/developer/listings/new`) provide a listing builder form. Developers fill in:
- Theme metadata (name, slug, category, descriptions, industries, tags, supported platforms, screenshots)
- Pricing (free or one_time INR amount; revenue share fixed at 15%)
- License tiers (Standard and Extended with `local_terms_accepted` status)
- Bundle manifest (source, bundle_upload_status, zip_url, asset_urls)
- Agreement checkbox and optional immediate submission flag

On submit, `ThemeService.createDeveloperListing(input)` calls the gateway's `POST /v1/themes/developer/listings`. The gateway runs a local asset scan (`localThemeAssetScan` — checks for suspicious keywords in serialized metadata), upserts a `theme_developer_listings` row, and if `submit: true` emits a `theme.developer_listing.submitted` domain event.

Separate from the listing builder, `ThemeUploadPanel` provides a direct JSON bundle upload via `POST /api/themes` (max 512 KB). This path is rate-limited (5 uploads/minute per IP) and requires session auth. Bundles go to `ThemeService.uploadThemePackage` → `api.themes.uploadPackage`.

---

## Data Layer

### Tables Used (via gateway)

| Table | Purpose |
|-------|---------|
| `themes` | Theme catalog: slug, name, description, category, pricing, tags, features, industry, version, is_active, author fields, install/review/download counts, rating_avg |
| `store_themes` | Per-store theme installation records: store_id, theme_id, version_installed, is_active, installed_at |
| `theme_purchases` | Purchase records: user_id, theme_id, price_paid_inr, currency, status, payment_provider, provider_payment_id, license_key |
| `theme_purchase_receipts` | Receipts generated on first fetch: receipt_number, invoice_number, license_key, amount_inr, gst_amount_inr, seller_gstin, invoice_json |
| `theme_download_artifacts` | Per-theme download artifacts: platform, artifact_key, checksum_sha256, size_bytes, delivery_status, storage_provider |
| `theme_collections` | Named collections: slug, title, description, collection_type (manual/dynamic), rule JSON, sort_order, is_published |
| `theme_collection_items` | Items in manual collections: collection_id, theme_id, sort_order |
| `theme_developer_listings` | Third-party developer submissions: developer_user_id, slug, pricing, license_tiers, bundle_manifest, asset_scan_status, submission_status, agreement_accepted_at |
| `theme_developer_payout_accounts` | Developer payout configuration: developer_user_id, revenue_share_rate, payout_schedule, payout_provider, onboarding_status |
| `theme_saved_searches` | User-saved filter sets: user_id, name, query JSON, alerts_enabled |
| `theme_marketplace_settings` | Per-user marketplace preferences: display_name, support_email, notification_preferences, saved_filters |
| `developer_profiles` | Public developer profiles: handle, bio, avatar (for author pages) |
| `sites` | Used to enumerate user's stores for install and preview |

### API Endpoints Called

From marketplace to gateway (`/v1/themes/...`):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/themes` (listCatalog) | GET | Paginated catalog with all filter params |
| `/v1/themes/:slug` | GET | Single theme detail |
| `/v1/themes/suggest` | GET | Search autocomplete suggestions |
| `/v1/themes/collections` | GET | All published collections |
| `/v1/themes/collections/:slug` | GET | Single collection with themes |
| `/v1/themes/authors/:handle` | GET | Developer profile + their themes |
| `/v1/themes/:slug/purchase` | POST | Create Razorpay purchase order |
| `/v1/themes/:slug/verify-purchase` | POST | Verify Razorpay HMAC, complete purchase |
| `/v1/themes/:slug/preview-session` | POST | Create store-scoped preview token (TTL 900s) |
| `/v1/themes/:slug/install` | POST | Install to a store, create store_themes row |
| `/v1/themes/:slug/releases` | GET | Release history for a store |
| `/v1/themes/:slug/rollback` | POST | Roll back to a prior release |
| `/v1/themes/:slug/reviews` | GET | Published reviews + summary |
| `/v1/themes/:slug/reviews` | POST | Submit verified-purchase review |
| `/v1/themes/:slug/report` | POST | Report a listing |
| `/v1/themes/:slug/refund` | POST | Request refund review |
| `/v1/themes/purchases/list` | GET | User's purchase history |
| `/v1/themes/purchases/:id/receipt` | GET | Receipt (generated on demand) |
| `/v1/themes/installations/list` | GET | User's active store installations |
| `/v1/themes/downloads/list` | GET | Download artifacts for completed purchases |
| `/v1/themes/settings` | GET / PUT | User marketplace settings |
| `/v1/themes/saved-searches` | GET / POST | Saved filter sets |
| `/v1/themes/developer/dashboard` | GET | Developer listings + payout account |
| `/v1/themes/developer/listings` | POST | Create/update developer listing |
| `/v1/themes/upload-package` | POST | Upload a JSON theme bundle |
| `/v1/stores` | GET | List user's stores (for install + preview) |

### Auth Mechanism

- Public routes (catalog, detail, category, preview shell): no session required. `getThemeApi(requireSession: false)` returns null gracefully if API URL is not configured; the marketplace shows a `MarketplaceUnavailable` component rather than crashing.
- Protected routes (install, checkout, dashboard, developer): `proxy.ts` middleware verifies the `LETBUYY_MERCHANT_SESSION_COOKIE` (ES256 merchant JWT from identity-platform) before rendering. If missing, redirects to `{ACCOUNTS_URL}/lookup?return_to=<current_url>`.
- API route `POST /api/themes` (bundle upload): uses `verifyLetbuyySessionCookieValue('merchant', ...)` server-side.
- All authenticated ThemeService calls forward internal session headers using `createLetbuyyInternalSessionHeaders` which uses `INTERNAL_API_SECRET` / `LETBUYY_INTERNAL_API_SECRET` to sign the session for the gateway.

---

## Integration with Merchant Control Plane

The theme marketplace and merchant control plane are separate Next.js apps but share the same gateway backend. The integration points are:

1. **`POST /api/themes/install` (merchant-control-plane):** Accepts `{ storeId, themeSlug?, bundle? }`. If `bundle` is provided, first calls `api.themes.uploadPackage` then installs. If only `themeSlug`, calls `api.themes.install` directly. Returns theme name/slug on success. This is used by the merchant editor UI when a merchant applies a theme from within their store context.

2. **`POST /api/themes/publish` (merchant-control-plane):** Controls store publish/unpublish status. Technically toggles `sites.status` between `published` and `draft` via `api.stores.publish` or `api.stores.update`. Used after theme activation to make the storefront live.

3. **Editor deep link:** The marketplace installations page builds the editor link as `getAdminUrl('/{store_slug}/online-store/themes/{themeId}/editor')` which opens the merchant-control-plane theme editor for the installed theme.

4. **Shared session:** Both apps use the same `LETBUYY_MERCHANT_SESSION_COOKIE`. A merchant logged into either app is authenticated in both.

---

## Integration with Theme Engine

The marketplace imports types from `@letbuyy/theme-engine` (`Theme`, `ThemeCategory`, `ThemePricingType`, `ThemeSearchFilters`, `ThemeSearchResult`). The `Theme` type governs all data normalization via the `normalizeThemeRecord` functions in `src/lib/theme-catalog.ts` and the page-level files.

The `Theme` type includes:
- `theme_preset_id` — links to a preset in the theme engine's preset registry
- `customizable_sections` — record of customizable section definitions
- `color_presets` — named color palette options
- `font_options` — available fonts
- `performance_report` / `accessibility_report` — Lighthouse score containers (populated by an external measurement job)
- `compatibility` — browser/locale/platform/viewport metadata
- `changelog` — version history entries

Marketplace themes are **not** restricted to Liquid format. The `supported_platforms` field can include `letbuyy`, `wordpress`, `html`, `react`. The Liquid canary flag (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`) is a storefront-runtime concern, not a marketplace concern. The marketplace handles theme discovery, purchase, and installation; the storefront-runtime decides how to render based on the installed theme's format.

There is no `ThemeBundleSchema` import in the marketplace. Bundle validation happens in the gateway's theme upload handler via the gateway's internal schema. The marketplace upload panel simply sends a raw JSON object under a `bundle` key.

---

## Current State Assessment

### What works end-to-end (structural / code complete)

- Full theme catalog browsing with all filters, pagination, and saved searches (pending live gateway data)
- Theme detail pages with gallery, features, reviews, changelog, quality facts, color presets, pricing actions
- Free theme install flow (store selection → gateway install → dashboard redirect)
- Paid theme checkout via Razorpay (client-side SDK, server-side HMAC verify, INR pricing with GST display)
- Developer listing builder and bundle upload pipeline
- Dashboard overview, installations page (with update detection and rollback), purchases page, downloads page
- Anonymous sandbox preview shell
- Store-scoped preview session creation (redirects to storefront-runtime)
- Merchant control plane install and publish integration
- Auth middleware protecting all transactional routes

### What is stubbed or has data dependencies

- **Ratings and review counts:** Display correctly from the `Theme` type but are zero until real purchases are made and reviews are submitted.
- **Download artifacts:** `theme_download_artifacts` table rows with signed URLs. In local dev the gateway generates data-URI pseudo-downloads via `localThemeArtifactSignedUrl`. Production requires a real object-store provider populating `signed_url` and `delivery_status`.
- **Quality scores:** `performance_report.lighthouse_performance` and `accessibility_report.lighthouse_accessibility` show "No recorded score" until an external measurement job runs against each theme.
- **Changelog:** Renders "Changelog entries are not published for this theme yet" if the `changelog` array is empty — requires theme authors to populate this field on their listings.
- **Payout accounts:** Developer payout defaults to `{ payout_provider: 'manual', payout_schedule: 'monthly', revenue_share_rate: 15 }` with a dev-default note. No production Razorpay Route or UPI payout provider is wired.
- **GST invoice GSTIN:** Uses `THEME_MARKETPLACE_DEV_GSTIN = '27ABCDE1234F1Z5'` if `THEME_MARKETPLACE_GSTIN` / `GSTIN` env vars are absent. Production receipts require the real seller GSTIN.
- **Theme collections:** Rendered on the homepage but only if `theme_collections` rows exist in the database; otherwise the section is hidden.
- **`theme_developer_listings` to `themes` promotion:** The gateway records developer listing submissions and emits an event, but there is no automated promotion pipeline from `theme_developer_listings` to the live `themes` table. Review, approval, and publication are manual operations not implemented in the codebase.

### What is frozen/blocked

- **No production deployment:** `deploymentAuthority.platform = "frozen-not-deployed"`. No Vercel project, no CI deployment step, no `vercel.json`.
- **No deployment secrets configured:** `environmentAuthority.secretStore = "none"`. Env vars like `LETBUYY_API_URL`, `INTERNAL_API_SECRET`, `THEME_MARKETPLACE_GSTIN`, and Razorpay keys are not wired to any deploy target.
- **Reopen requires ARB approval:** Per `AGENTS.md` and the manifest's `deploymentOwnership`, no production deploy target may be added without explicit ARB decision.

---

## Gap Analysis

For the marketplace to become production-ready, the following work is required:

1. **ARB reopen decision:** The frozen classification must be formally lifted and a new deploy target (Vercel project + subdomain) provisioned.

2. **Environment configuration:** `LETBUYY_API_URL`, `INTERNAL_API_SECRET`, `LETBUYY_MERCHANT_SESSION_COOKIE` secret, Razorpay live keys (`key_id` in gateway env), `THEME_MARKETPLACE_GSTIN` (live seller GSTIN), and Cloudflare Turnstile keys must be configured for the deployment target.

3. **Theme catalog seeding:** The `themes` table needs real theme records before browsing pages show anything. The `MarketplaceUnavailable` fallback triggers if the API is unreachable; but with an empty `themes` table the catalog simply returns zero results.

4. **Storage provider for download artifacts:** `theme_download_artifacts` rows need real `signed_url` values backed by R2 / S3. The local-dev data-URI pattern is not suitable for production.

5. **Developer listing → theme promotion pipeline:** A review workflow (moderation queue, approval action, automatic promotion of `theme_developer_listings` records to `themes`) is entirely absent. Without this, the developer console is a data entry form with no path to publication.

6. **Lighthouse measurement job:** Performance and accessibility scores require an external job (Puppeteer/Playwright Lighthouse runner) that writes to `performance_report` and `accessibility_report` columns on theme rows.

7. **Razorpay payout for developers:** The 15% revenue share is recorded in metadata but no payout disbursement mechanism exists. The `payout_provider` defaults to `manual` with a comment indicating Razorpay Route or UPI is required.

8. **Live GSTIN for production receipts:** The gateway blocks receipt generation in production if `THEME_MARKETPLACE_GSTIN` is absent. This must be configured before any paid theme can complete checkout.

9. **Email notifications:** The `alerts_enabled` field on saved searches and `notification_preferences` on marketplace settings have no email delivery backend wired.

10. **Route ownership lockstep:** Per `CLAUDE.md`, new API routes in app runtimes must be gateway proxies and match route-ownership lockstep. Any new marketplace API routes need corresponding gateway route registration.

---

## Theme Versioning

Version numbers in the marketplace follow the semantic versioning pattern (`major.minor.patch`). The `version` field on the `Theme` type defaults to `'1.0.0'` via `normalizeThemeRecord`.

Version tracking in the lifecycle:

- **Listing version:** Stored on the `themes` row as `version`. Theme authors update this when publishing new releases via the developer console.
- **Installation version:** Stored as `version_installed` on `store_themes`. Set at install time to the theme's current `version`.
- **Update detection:** The installations page compares `version_installed !== theme.version`. If they differ, status becomes `update_available`.
- **Releases:** The gateway maintains a release history (accessible via `api.themes.releases(slug, storeId)`). Each call to `installTheme(..., { marketplace_update: true })` creates a new release. Rollback targets a specific `release_id`.

The changelog UI (`ThemeChangelog`) renders structured entries from the `changelog` field on the `Theme` type — an array of `{ version, released_at?, changes[] }` objects. These are populated by theme authors when they update their listing.

There is no semantic version enforcement or version constraint system. Versions are string labels. The install/update cycle is append-only at the release level; rollback via `rollbackRelease` is the only backward path.
