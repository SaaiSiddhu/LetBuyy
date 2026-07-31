# LBIS Architecture — Business Intelligence System (Phase 16)

**Package:** `@letbuyy/lcis-business` · Read-only, deterministic, advisory-only. Composes the operations engine, the dependency twin, and db-intel into business intelligence. **Never fabricates a business number.**

## The no-fabrication law (the defining property)

Every business magnitude is a `BusinessMetric` constructed **only** through `notConnectedMetric()` (`src/shared/compose.ts`), which is structurally incapable of producing a numeric value:

```ts
notConnectedMetric(key, label, unit, liveSource, backedBy): BusinessMetric
// → { value: null, connection: 'NOT_CONNECTED', liveSource, backedBy, evidence: [notConnected(...), ...backing] }
```

Enforced two ways: a per-metric runtime assertion in every service test, and a static scan (`test/security.test.ts`) that fails the build on any `value: <number>` literal in `src/`. Structural relationships — which domains/tables/rpcs back a metric — are CONNECTED via `backedBy` + evidence.

## Composition (never re-derives)

| Service | Composes | Produces |
|---|---|---|
| MerchantIntelService | ops `merchantOps.detect{Activation,Growth,Churn,Dormancy,Retention}` | merchant magnitudes (NOT_CONNECTED) + mapped findings |
| RevenueOrderService | ops `commerceOps.detect{GmvTrend,OrderTrend,RefundSpikes,PaymentFailures,CheckoutDegradation}` | revenue/order/settlement/refund; BI04 money-path structural finding |
| CustomerRetentionService | ops `customerOps.detect{ConversionDrops,TrafficAnomalies}` | customer + retention (curve NOT_CONNECTED) + subscription NOT_IMPLEMENTED (BI05) |
| GrowthMarketingService | ops `merchantOps.detectGrowth` + db-intel | growth/marketing/coupon; coupon backing detected structurally from real tables |
| FinanceForecastService | lcis-operations `linearTrend` | finance magnitudes + OLS revenue forecast (only over a caller-provided real series) |
| ExecutiveHealthService | pure | KPIs, structural business/merchant health, advisory BI recommendations |

`mapFinding()` preserves each operations finding's honest `status` (CONNECTED vs everything-else → NOT_CONNECTED). `safeFindings()` degrades any detector throw to `[]` — never a crash, never a guess.

## Facade

`BusinessIntelligenceEngine.generateBusinessReport()` assembles all 11 area intels + executive KPIs + revenue forecast + retention + business/merchant health + advisory recommendations, and reports the `notConnectedMetrics` honesty ledger. Deterministic under an injected clock; `create/get/resetBusinessIntelligenceEngine`.

## Honesty contract

Structural relationships CONNECTED; every magnitude NOT_CONNECTED with its exact source; subscriptions NOT IMPLEMENTED; health = structural readiness, not performance; recommendations advisory-only; nothing mutates.
