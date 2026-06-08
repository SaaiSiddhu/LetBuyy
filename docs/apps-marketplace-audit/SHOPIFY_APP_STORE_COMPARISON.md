# Shopify App Store Comparison (Phase 2)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07
**Benchmark currency:** Shopify facts web-verified June 2026 (sources at end). LetBuyy claims cited to source files.

This report benchmarks the LetBuyy Apps Marketplace against the Shopify App Store, the category leader, with side glances at Atlassian Marketplace (Forge), Stripe Apps, and Cloudflare. The goal is to answer two questions: *why would a merchant install apps from LetBuyy?* and *why would a developer build for LetBuyy?* — measured against the bar developers and merchants already know.

## 1. Scale & liquidity

| | Shopify | LetBuyy |
|---|---|---|
| Apps listed | ~9,500–12,300 active | **0 (no seed catalog)** — home empty state: *"the app catalog API returned no rows"* (`page.tsx:274`) |
| Reviews on file | ~1.3M total | 0 (`app_reviews` empty) |
| Apps with no reviews | ~35% | n/a (no apps) |
| Two-sided liquidity | Mature | None — neither merchants nor developers present |

The single most important difference is liquidity. Shopify's value is the catalog; LetBuyy's catalog is empty, so every downstream feature (search, categories, collections, reviews) renders over nothing. **A merchant has no reason to visit twice; a developer has no audience to sell to.**

## 2. Discovery

| Capability | Shopify | LetBuyy | Verdict |
|---|---|---|---|
| Full-text search | Yes, ranked, server-side | Yes, server-side; query sanitized (`marketplace-display.ts:78`) | ⚠️ Works but empty |
| Category taxonomy | Curated, DB-backed, deep | 29 **hardcoded** ("Doc 15 §4", `constants/categories.ts:1`); 14 hidden from search (`search/page.tsx:154`) | ❌ |
| Collections / curation | Editorial staff picks, themes | 3 **fake** collections that re-sort the catalog and admit it (`collections/[slug]/page.tsx:13,19,25`) | ❌ |
| Featured / trending | Algorithmic + editorial | `featuredRails` flag (off) + needs `is_featured` data; no trending/recommended | ❌ |
| Recommendations | "Works with," "alternatives," personalized | Same-category 3 only (`apps/[slug]/page.tsx:183`) | ❌ |
| Rating/price filters | Server-side, indexed | Pricing server-side; **rating filter is client-only over ≤20 rows** (`search/page.tsx:83`) | ⚠️ |

## 3. App listing & detail page

| | Shopify | LetBuyy | Verdict |
|---|---|---|---|
| Media (screenshots/video) | Required, rich | Renders 3 **placeholders** when none ("Awaiting approved media", `apps/[slug]/page.tsx:319-323`); video supported | ⚠️ |
| Pricing display | Plans/tiers, trials | Flat price rows + "merchant approval required"; **no tiers, no trial** in app billing | ⚠️ |
| Permissions disclosure | Yes | **Strong** — full scope list + consent modal (`AppInstallConsentPanel.tsx`) | ✅ |
| Reviews + histogram | Yes | Yes, derived from real data; "No reviews yet" honest (`apps/[slug]/page.tsx:464-506`) | ✅ |
| Changelog / version | Yes | UI exists but **no data source** (no `app_versions` table) | ❌ |
| SEO (structured data) | Yes | `SoftwareApplication`+`AggregateRating` JSON-LD, sitemap, OG (`apps/[slug]/page.tsx:207`) | ✅ |
| Report abuse | Yes | Buttons **disabled** ("Report listing unavailable", `apps/[slug]/page.tsx:617`) | ❌ |

## 4. Pricing & developer economics

| | Shopify (June 2026) | LetBuyy | Verdict |
|---|---|---|---|
| Revenue share | **0% on first $1M lifetime** (since Jan 2025), **15%** above; large devs ($20M+ prior yr / $100M+ co.) pay 15% flat | **Contradictory:** code `DEFAULT_APP_REVENUE_SHARE_BPS=8000` → **20% platform** (`billing-core:269,577`); docs say 15%; UI says "pending business approval" (`apps/new/page.tsx:307`) | ❌ |
| Billing models | Subscriptions + usage + mixed via **Shopify App Pricing** (default since May 2026); App Events API metering | `recurring`/`usage` only; **no one-time, no trial**; **no usage metering endpoint**; **no charge UI at all** | ❌ |
| Payout settlement | Automated, scheduled | Ledger written `pending`; **never settled, no transfer** (`queue-execution.adapter.ts:474`) | ❌ |
| Tax handling | Per-region | India GST 18% on partner share (`billing-core:270`) | ✅ (India-scoped) |
| Registration fee | $19 one-time | None found (free) | ✅ |

## 5. Developer platform (OAuth, scopes, webhooks, extensions)

| | Shopify | LetBuyy | Verdict |
|---|---|---|---|
| OAuth 2.0 | Yes | Yes — **PKCE S256, single-use codes, refresh tokens** (`billing-oauth-routes.ts`); but **UI never calls it**, flag-on path throws | ⚠️ real backend, no UI |
| Scopes/permissions | Granular, enforced | Defined per app; **genuinely enforced** token-vs-grant + token-hash (`app-auth.ts:78-101`) | ✅ |
| App data API | GraphQL/REST | `/app/products`, `/app/orders`, metadata write (`app-api.ts`) | ✅ (narrow) |
| Webhooks | Rich topic catalog + dev-managed | **No developer webhook management**; `app_webhooks` read-only/no writer | ❌ |
| Mandatory GDPR webhooks | 3 required, rejection if absent | **All 3 present**, auto-subscribed at install (`app-engine:154,1438`) | ✅ |
| Extensions | Theme app blocks, checkout UI, admin, Functions (WASM) | 3 surfaces + 3 renderers + WASM functions (`app-engine:197,224`); **merchant config UI is a stub** | ⚠️ |
| Embedded apps | App Bridge | `embed-session` endpoint exists; **`embedUrl` hardcoded null in UI** (`AppInstallConsentPanel.tsx:67`) | ❌ |

## 6. App review & quality program

| | Shopify | LetBuyy | Verdict |
|---|---|---|---|
| Review process | Automated checks + human review | Human ops decision (`operations.ts:320`); **"automated checks" hardcoded to passed** (`developer-routes.ts:683`) | ❌ |
| Quality badge | **Built for Shopify** (perf p95<500ms, Lighthouse within 10%, design, integration; annual re-review) | "Built for LetBuyy" badge with **no program and no DB column** (`marketplace-display.ts:49`) | ❌ |
| Security scanning | Yes | None found | ❌ |
| Update review | Re-review on version | **No update path exists** | ❌ |

## 7. Other ecosystems (context)

- **Atlassian Marketplace (Forge):** from Jan 2026, **0% revenue share up to $1M lifetime Forge revenue**, then standard (~15% cloud). Mirrors Shopify's lifetime-cap model — the industry has converged on "free first $1M, then ~15%." LetBuyy's 20% code default is *above market*; its 15% docs are *at market*.
- **Stripe Apps:** partner tiers (Partner / Premier) with revenue share + co-sell, oriented around payments rather than a paid-app catalog. Relevant as a model for *developer enablement* (docs, sandboxes, partner support) — areas where LetBuyy is bare.
- **Cloudflare:** monetizes its own platform services (Workers/Pages) rather than a third-party paid-app marketplace; useful as a model for *usage-based developer billing* primitives, which LetBuyy has in schema (`usage` mode) but not in UI.

## 8. Net assessment

LetBuyy's **platform layer is genuinely Shopify-shaped** and, on a few axes (consent UX, mandatory GDPR webhooks, scope enforcement, fail-fast config, SEO), at or near parity. But on the axes that actually drive a two-sided market — **catalog liquidity, discovery substance, the developer money path (billing UI + payout settlement + a single revenue rate), the app update lifecycle, and a quality program** — LetBuyy is absent or contradictory. **A merchant would not install from LetBuyy today because there is nothing to install and paid apps can't be billed; a developer would not build for LetBuyy today because they can't get approved self-serve, can't ship v2, and can't get paid.**

## Sources

- [Revenue share for Shopify App Store developers](https://shopify.dev/docs/apps/launch/distribution/revenue-share)
- [Update to Shopify's app developer revenue share — changelog](https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share)
- [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements)
- [Shopify App Pricing — managed pricing / usage & subscription billing](https://shopify.dev/docs/apps/launch/billing/managed-pricing)
- [Shopify App Pricing changelog (May 2026)](https://shopify.dev/changelog/shopify-app-pricing-charge-for-usage-recurring-subscriptions-or-both)
- [Privacy law compliance — mandatory webhooks](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Shopify App Store statistics 2026 (Meetanshi)](https://meetanshi.com/blog/shopify-app-store-statistics/)
- [Atlassian Marketplace revenue share updates: 2026](https://www.atlassian.com/blog/developer/updates-to-marketplace-revenue-share-2026)
- [Stripe Partner Ecosystem](https://docs.stripe.com/partners)
- [Cloudflare Workers & Pages pricing](https://www.cloudflare.com/plans/developer-platform/)
