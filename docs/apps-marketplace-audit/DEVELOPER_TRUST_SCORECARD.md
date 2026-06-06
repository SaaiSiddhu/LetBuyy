# Developer Trust Scorecard (Phase 14)

Would a professional SaaS company build for LetBuyy? Scored across what developers evaluate before committing engineering. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Score: 44 / 100

| Dimension | Weight | Score | Notes |
|---|---|---|---|
| Revenue opportunity | 16 | 5/16 | Empty marketplace = no merchants = no revenue today; India focus is a real wedge, but the flywheel hasn't started. |
| Economic terms (clear & fair?) | 12 | 4/12 | **Contradiction:** UI says 15% commission; backend default is 20% (`revenue_share_bps=8000`). No published terms doc, no \$1M-style exemption. |
| Platform APIs | 16 | 12/16 | Genuinely strong: OAuth+refresh, scopes, webhooks, 8 extension types, manifest validation, App-Bridge-style embed, scoped product/order APIs, idempotency. |
| Platform stability/maturity | 10 | 6/10 | Solid schema + event/idempotency machinery; but no versioning means apps can't evolve, which is disqualifying for serious vendors. |
| Documentation | 8 | 3/8 | Footer links to `docs.letbuyy.store/apps` and `/api` (existence unverified); no in-product rubric, no SDK/CLI references. |
| Billing & monetization tooling | 10 | 4/10 | Charge+approve API + payout ledger + GST exist; but no plan/trial/usage config UI, no statements/invoices, no refunds. |
| Analytics | 8 | 2/8 | Aggregate dashboard tiles only; no per-app installs-over-time, funnel, churn, or API-usage. |
| Developer self-service lifecycle | 12 | 3/12 | Register + submit-once only. **No edit, no versioning, no media upload, no scope/webhook config, no API-key UI** (despite API support). |
| Support & community | 4 | 2/4 | Support email field; no partner program, forums, or status page. |
| Marketplace visibility | 4 | 3/4 | Categories/collections/search exist (if shallow); developer can be listed once approved. |

## What attracts developers
- A **real, well-shaped API** (`@letbuyy/api-client.appStore`) covering OAuth, billing, webhooks, extensions, embedding, and scoped data.
- **India-native payout accounting** (GST, payout rails) that global platforms don't offer.
- Verified-install reviews and merchant-approval billing reduce abuse risk for honest developers.

## What repels developers
- **No way to ship version 2.** No update/versioning endpoint or UI — a non-starter for any product team.
- **Contradictory economics.** "15% commission" in the UI vs. a 20% backend default is an immediate red flag.
- **Thin self-service.** Most lifecycle actions (edit, configure scopes/webhooks/extensions, upload media, rotate keys, define plans) require API calls the product doesn't expose.
- **No analytics** to understand adoption or revenue beyond totals.
- **No content/merchants yet**, so the revenue case is speculative.

## To reach an attractive 75+
1. **Publish truthful, fair economics** (one commission rate; consider a first-revenue exemption like Shopify's \$1M).
2. Build the **developer lifecycle** in-product: edit, **version/update with re-review**, media upload, scopes/webhooks/extension config, API-key management.
3. Add **per-app analytics** (installs over time, funnel, churn, revenue, API usage).
4. Ship **billing tooling** (plans, trials, usage metering, statements, GST invoices, refunds).
5. Publish **docs, a review rubric/SLA, and SDK/CLI**; provide dev-store provisioning in-product.
6. Seed merchants/apps so the revenue opportunity is demonstrable.
