# Shopify App Store Comparison (Phase 2)

Benchmarks LetBuyy Apps Marketplace against the Shopify App Store as it exists in 2025–2026, with notes from Atlassian Marketplace, Stripe Apps, and Cloudflare where instructive. Shopify facts are web-researched (June 2026); LetBuyy facts are cited from code. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Scoring legend
✅ parity · ◐ partial · ❌ missing/broken · 🟢 LetBuyy advantage

## 1. Side-by-side

| Dimension | Shopify (2025–26) | LetBuyy | Gap |
|---|---|---|---|
| **Catalog content** | ~13k+ apps, curated | **0 apps seeded**; homepage admits empty | ❌ S0 |
| **Discovery** | Categories w/ counts, curated collections, recommendations, semantic search (mandatory since Mar 2025) | Hard-coded 29 categories, 3 fake collections, `ILIKE` name/tagline search, no recs | ❌ |
| **Search ranking** | Relevance + performance + Built-for-Shopify weighting | Single column sort (`install_count`/`rating_avg`/`created_at`/`name`) | ❌ |
| **App detail** | Screenshots/video, pricing plans table, reviews w/ histogram + replies, privacy/data, compatibility | Screenshots (placeholder), pricing rows, reviews list, scopes, dev card | ◐ |
| **Reviews** | Verified, helpfulness votes, developer replies, moderation | **Verified-install-only** (🟢 strict), no votes/replies/moderation, no write UI | ◐ |
| **Trust badges** | "Built for Shopify" **earned** (50+ paid installs, 5+ reviews, perf p95<500ms, design, latest API, annual re-review) | "Built for LetBuyy" **hard-coded on every app** | ❌ |
| **OAuth/permissions** | OAuth 2.0, scopes, optional/incremental scopes, re-consent on change | OAuth 2.0 authorize/token/refresh **real** but **UI bypasses it**; all-or-nothing scopes | ◐ |
| **Billing** | Shopify App Pricing: hosted plan page, recurring/annual/usage (fixed/graduated/volume), trials, proration, test charges; appears on Shopify bill | Charge + merchant-approve **API real**; **no billing UI**; trials/yearly/usage rendered but not capturable | ◐ |
| **Mandatory compliance** | `customers/data_request`, `customers/redact`, `shop/redact` required for every app | **All three implemented** (`compliance-routes.ts`) | ✅ 🟢 |
| **Extensions** | Theme app extensions, checkout UI, admin, functions | 8 extension types in schema + registry endpoints | ✅ (API) / ❌ (no UI) |
| **Embedded apps** | App Bridge, session tokens, embedded admin | `embed-session` + `bridge/fetch` endpoints; UI raw-iframes `app_url` | ◐ |
| **Developer dashboard** | Installs over time, funnels, revenue, BFS status, performance | Aggregate tiles only (installs, uninstalls, earnings, GST, rating) | ◐ |
| **App updates/versioning** | Versioned config, staged rollout, re-review on scope change | **None** — no update endpoint/UI | ❌ S0 |
| **App analytics for devs** | Rich (events, performance, install funnel) | None per-app | ❌ |
| **Review process** | Documented requirements, automated + human, GraphQL-only for new apps (Apr 2025), GDPR verified pre-review | Human decision in ops portal; automated checks are rubber stamps; no published rubric | ◐ |
| **Economics** | 0% on first **\$1M lifetime**, 15% above; \$19 one-time partner fee | UI says **15% commission**; backend default **20%** (`revenue_share_bps=8000`) | ❌ contradiction |
| **Payouts** | Multiple regions/rails | Partner payout ledger + **18% GST** modeling (🟢 India-native) | ✅ 🟢 (accounting) / ❌ (no statements) |
| **Localization** | Many locales/currencies | en + INR only | ❌ |
| **Mobile** | Responsive store + app | Nav disappears <768/<640px, no hamburger | ❌ |

## 2. Where LetBuyy genuinely matches or leads Shopify

These are real and worth protecting:

1. **Mandatory GDPR webhooks** are implemented exactly as Shopify mandates (`/compliance/customers/data-request`, `/customers/redact`, `/shop/redact`). Many platforms never get here.
2. **Verified-install-only reviews.** `POST /app-store/apps/:id/reviews` requires an *active* installation for the reviewing user/store. This is stricter than Shopify's historical model and kills drive-by ratings.
3. **Merchant-approval billing semantics.** Charges sit in `pending_merchant_approval` until `/charges/:id/approve` with `verifySiteOwnership` — the correct safety property.
4. **Idempotent installs.** `X-Idempotency-Key` → `IdempotencyExecutionAdapter` prevents double-install on retry.
5. **India-native economics.** GST (18% default) and payout rails are modeled in `partner_payout_ledger_entries`, which Shopify does not do natively for India.

## 3. Where the gap is structural (not cosmetic)

1. **No content.** Shopify's flywheel is apps→merchants→apps. With zero seeded apps and no seed pipeline (`000_baseline.sql` has 0 catalog INSERTs), there is no flywheel to start.
2. **Earned trust vs. asserted trust.** Shopify's "Built for Shopify" is a *gate* with quantitative criteria. LetBuyy asserts an equivalent badge unconditionally — which, once merchants notice, destroys the signal's value.
3. **Self-service developer lifecycle.** Shopify lets a developer create, configure, version, price, instrument, and support an app entirely self-serve. LetBuyy's API can do most of this, but the *product* can only register a developer and submit a draft once.
4. **Discovery as a product.** Shopify treats discovery (categories, collections, recommendations, ranking, search) as core surface area. LetBuyy treats it as static scaffolding.

## 4. Net assessment

LetBuyy is closer to Shopify on **platform plumbing** than most clones ever get, and **further** on **marketplace product**. The fastest path to credibility is not more backend — it's (1) content, (2) earned trust, (3) wiring the developer lifecycle to the API that already exists, and (4) truthful economics.

## Sources
- [Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements)
- [Revenue share for Shopify App Store developers](https://shopify.dev/docs/apps/launch/distribution/revenue-share)
- [Update to Shopify's app developer revenue share](https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share)
- [Privacy law compliance (mandatory webhooks)](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Shopify App Pricing / billing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing)
- [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
