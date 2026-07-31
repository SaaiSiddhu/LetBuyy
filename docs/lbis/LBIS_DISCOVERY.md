# LBIS Discovery — Business Intelligence System (Phase 16)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LBIS composes — never duplicates, never fabricates business numbers)

| Capability | Where (verified) | LBIS reuse |
|---|---|---|
| Merchant lifecycle | `lcis-operations` `MerchantOperationsService`: detectActivation / detectGrowth / detectChurn / detectDormancy / detectRetention / generateMerchantReport | Merchant + growth + retention intelligence |
| Commerce / order / refund / payment | `lcis-operations` `CommerceOperationsService`: detectGmvTrend / detectOrderTrend / detectRefundSpikes / detectPaymentFailures / detectCheckoutDegradation / generateCommerceReport | Revenue + order + refund intelligence |
| Customer funnel | `lcis-operations` `CustomerOperationsService`: detectConversionDrops / detectTrafficAnomalies + generateCustomerReport | Customer + retention analytics |
| Forecasting | `lcis-operations` `ForecastOperationsService` + `linearTrend`/`movingAverage` | Revenue/business forecasting |
| Domain topology | `lcis-twin` (merchant→orders→payments dependency chain) | Cross-domain business flow |
| Money-path status | `lcis-adapters` Stripe/Razorpay adapters (status NOT_CONNECTED without creds) | Settlement/payment posture |
| Change history | `lcis-tracking` timeline | Business event timeline |

**Critical honesty note (from ops):** every business VALUE (GMV, revenue, order counts, merchant counts, conversion %, retention %) is already NOT_CONNECTED in the ops services — they emit signals citing the exact live source (`SUPABASE_URL`/`SERVICE_ROLE_KEY`, Analytics Engine). LBIS **must never fabricate a business number**; it aggregates the ops signals and forecasting *models*, keeping every magnitude NOT_CONNECTED until a data source is wired.

**Net-new in LBIS (verified absent):** a unified business-intelligence report spanning merchant / revenue / order / customer / subscription / settlement / refund / coupon / growth / marketing / finance intelligence + executive KPIs + business forecasting + business/merchant health + revenue forecasts + customer-journey/retention analytics — in one composition. Ops has per-area services; nothing aggregates them into an executive business report. (Subscription intelligence is honestly NOT IMPLEMENTED — there is no subscriptions domain — surfaced as NOT_CONNECTED per the constitution's honesty rule.)

## 2. Phase 16 scope — new package `packages/lcis-business`

Foundation: `BusinessMetric` (value NOT_CONNECTED until sourced), `MerchantIntel`, `RevenueIntel`, `OrderIntel`, `CustomerIntel`, `SubscriptionIntel` (NOT_IMPLEMENTED-honest), `SettlementIntel`, `RefundIntel`, `CouponIntel`, `GrowthIntel`, `MarketingIntel`, `FinanceIntel`, `ExecutiveKpi`, `BusinessForecast`, `BusinessHealth`, `RetentionAnalytics`, flagship `BusinessReport`; rules BI01–BI08; `business()` envelope.

Services (6): MerchantIntelService (ops merchant), RevenueOrderService (ops commerce → revenue/order/settlement/refund), CustomerRetentionService (ops customer → customer/retention/journey), GrowthMarketingService (ops merchant growth + coupon/marketing structural), FinanceForecastService (forecasting delegation + finance KPIs), ExecutiveHealthService (composite exec KPIs + business/merchant health).

Facade: `BusinessIntelligenceEngine.generateBusinessReport()`.

Honesty: **every business magnitude NOT_CONNECTED + exact source**; structural relationships (which domains/tables back each metric) CONNECTED; advisory-only.

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-business`. Target ≥600 tests.
