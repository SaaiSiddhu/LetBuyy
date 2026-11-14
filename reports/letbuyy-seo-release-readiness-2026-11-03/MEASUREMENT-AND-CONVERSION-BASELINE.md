> **3 November follow-up:** [Latest verified repairs, source bundle and remaining work](FOLLOW-UP-FIXES-AND-REMAINING-WORK.md) supersede earlier same-day build/count/access statements below. No deployment occurred.

# Measurement and conversion baseline

## Actual first-party data

The downloaded Search Console Web export covers **1 August–31 October 2026**: 29 clicks and 384 impressions. The displayed CTR is 7.6% and average position 24.3. India accounts for 26 clicks/242 impressions. Devices: mobile 15/104, desktop 14/277, tablet 0/3. These are search outcomes, not signups or customers.

The 25 visible query rows contain zero clicks and 52 impressions. The hidden remainder does not establish branded CTR or a brand/non-brand split. Page rows sum 34 clicks/701 impressions; do not substitute those page aggregations for the property totals of 29/384. Keep scope, dates and dimensions attached to every claim.

The Google Generative AI Beta export has 51 impressions in the same interval, fifteen page rows, seven countries and three device groups. India has 45 impressions; desktop 29, mobile 21 and tablet one. Page rows sum 65 impressions, not the property total of 51. These numbers are not citation counts, clicks, conversions or visibility across other assistants.

GSC CWV, last updated 1 November, reports insufficient usage data for mobile and desktop in the last 90 days. One unauthenticated PSI call returned 429 RESOURCE_EXHAUSTED; it was not repeatedly retried. Field LCP/INP/CLS remain unmeasured.

## Existing implementation inspection

The bounded scan examined 153 marketing, 94 identity and 334 merchant TS/JS files for common analytics/RUM calls. Its sole marketing hit was an editorial web-vitals reference in `articles.ts`, not an executing collector. No functioning marketing GA4/Matomo/RUM sink or approved property was established by that scan. It does not rule out every uninspected injected tag or other repository. Firebase app DAU is not marketing organic-conversion evidence.

No unconfigured tracking wrapper was added merely to claim implementation. A property and consent contract are needed before connecting a collector; essential sign-in consent cannot silently become marketing consent. No analytics setting or tracking code was deployed.

## Concrete event contract for the existing approved stack

| Event | Required trigger | Safe dimensions | Does not prove |
|---|---|---|---|
| landing_view | Approved consented route view, once per actual navigation | Normalized path, locale, template, environment | Identity or conversion. |
| pricing_view | Actual pricing-route view | Locale and availability state | Purchase. |
| plan_cta | User activates an available plan CTA | Canonical plan slug, source path, locale | Signup or payment. |
| signup_started | Actual Accounts form start | Approved anonymous journey key and entry context | Completed account. |
| signup_completed | Canonical Identity completion record | Approved aggregates without email/password/OTP | Store publication or paid plan. |
| store_setup_completed | Persisted canonical setup transition | Aggregated site type/environment | A successful live business. |
| billing_started | Canonical checkout initiation | Plan slug, provider mode, environment | Captured payment. |
| plan_activated | Verified server activation joined to one canonical payment/invoice | Approved aggregate plan/mode | Browser callback, mock response or fixture as real revenue. |

Never send emails, tokens, full sensitive query strings, addresses, card data or unnecessary private IDs to analytics. Preserve withdrawal, SPA semantics, duplicate protection, environment separation and cross-domain referral handling. Reuse Identity and billing authority; do not create a second completion system.

Next: identify the approved property/consent mechanism, trace its actual pipeline, implement only the necessary integration with consent-negative/deduplication/payload tests, then separately authorize configuration/publication. Verify received events and aggregate funnel joins after release. Razorpay sandbox acceptance remains a separate prerequisite for real paid-activation evidence.

## Later GA4 discovery

Two existing LetBuyy Web streams are accessible but inactive and have no website URL shown. This corrects the earlier access uncertainty; it does not establish an approved functioning marketing sink or zero marketing demand/conversions. The owner destination choice and consent/event contract remain pending. No duplicate property, secret, tag or fabricated event was created.
