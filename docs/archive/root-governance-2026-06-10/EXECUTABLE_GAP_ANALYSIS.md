# Executable Gap Analysis

Generated: 2026-06-08T08:27:10Z

| task | classification | evidence | delta to V1 |
|---|---|---|---|
| 001 Foundation | PARTIAL | Tenant context, crypto, redaction, baseline outbox/audit/idempotency tables, event catalog, and static tests exist. | Add GUC fail-closed RLS helper, query guard, write-with-outbox, expanded event catalog, scoped compensation, generalized idempotency, canonical double-entry ledger, Postgres proof suites, mock KMS, observability kernel, and real vertical-slice tests. |
| 002 Cart | PARTIAL | `000_baseline.sql` has `carts`; storefront `cart-routes.ts` exists. | Replace client-only/runtime cart with server-authoritative V1 cart APIs and signed checkout handoff where incomplete. |
| 003 Checkout | PARTIAL | `checkout_sessions` exists; storefront checkout payment routes exist. | Build in-monolith state machine, signed handoff verification, branding data, idempotent confirm, and scoped compensation. |
| 004 Payment | PARTIAL | `payments.ts`, `packages/payments`, payment tables, provider uniqueness migration, Cashfree adapter exist. | Normalize to merchant-owned PSP session machine, mock/live adapters, replay-safe webhooks, and F10 binding across all confirm paths. |
| 005 Order | PARTIAL | `orders.ts` exists and is under 1500 lines; order hardening migrations exist. | Make order creation checkout-only, immutable state machines, FulfillmentOrder per location, heuristic risk/COD confirm integration. |
| 006 Inventory | PARTIAL | `inventory.ts`, baseline inventory levels/reservations, migration `088` exist. | Add V1 available/committed/reserved/consumed semantics, TTL sweeper, and concurrency proof. |
| 007 Discount | PARTIAL | `coupons.ts` exists. | Add V1 3-class combine rules, deterministic stacking, allocation evidence, and order subscription. |
| 008 Tax | PARTIAL | `shipping-tax.ts`, tax parity migration `123` exist. | Add GST place-of-supply, HSN rates, immutable invoice, TCS, and mock IRP. |
| 009 Shipping | PARTIAL | `shipping-labels.ts`, migration `118`, logistics adapter exist. | Add pincode/COD serviceability, zones/profiles/rates completion, tracking ingest, and Shiprocket-shaped live adapter guard. |
| 010 Notifications | PARTIAL | `notifications.ts`, device-token migration, operations webhooks exist. | Add notification router module, preferences/suppression/consent, webhook delivery DLQ and replay proofs without activating reserved service. |
| 011 Email | PARTIAL | `marketing.ts` and email logs exist; identity email exists. | Generalize to `notification-core`, MJML/Liquid renderer, multi-ESP failover, sender-domain controls, suppression. |
| 012 WhatsApp | PARTIAL | `whatsapp.ts`, migration `132`, adapter package exists. | Scope down to lifecycle + COD confirm + opt-in only; remove/avoid full WhatsApp commerce/AI/NLU expansion. |
| 013 Settlement | MISSING/PARTIAL | Mobile payout/wallet/commission scaffold exists in `119` and routes. | Build canonical F6 ledger-backed settlement, PA statement ingest, COD remittance, recon breaks, suspense, reserves, and wallet/payout reads from ledger. |
| 014 Billing | PARTIAL | `internal-billing.ts`, plans/subscriptions baseline and app billing migrations exist; `gmv_percentage` still appears in UI code. | Kill 2.5% rake in persisted plans/UI, add AutoPay mock mandates, dunning, merchant GST invoices. |
| 015 Security | PARTIAL | RLS hardening migration, 2FA, auth, tenant tests, date helper fix present. | Add claims->GUC, DPDP consent/DSR coverage, mock KMS field encryption, maker-checker/step-up enforcement. |
| 016 Observability | PARTIAL | Audit logs, operations runtime routes, analytics live route, media route exist. | Right-size structured logs/tracing/metrics, analytics MVs/rollups, media signed upload, AI seam only; do not build analytics/media services. |

## V1-Rejected Systems Not To Build

- Do not activate `services/checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, or `search-service`.
- Do not add a standalone event bus, schema registry, general saga engine, event sourcing/CQRS, fraud ML, full WhatsApp commerce, analytics pipeline service, media service, notification service, AI model wiring, reseller network, multi-region/sharding/read-replica, or new partitioning.
- Existing partition shadow migrations (`079`-`083`, `131`) predate V1 and should remain dormant/no-new-investment; do not extend them.

## Duplicates/Remove Candidates

- Existing `wallet_ledger_entries` and `commission_reconciliation_entries` are mobile V2 money scaffolds. They should become read/projection/compatibility surfaces over canonical `ledger_entries`, not separate truth.
- `gmv_percentage` appears in `apps/merchant-control-plane/src/lib/billing/plan-ui.ts`; V1 requires removing the 2.5% rake from billing contracts and UI.
