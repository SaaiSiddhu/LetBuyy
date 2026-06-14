# Domain Intelligence Report (generated)

22 business domains discovered by joining db-intel + infra-intel + the gateway route inventory. Coverage: routes 83/87, tables 328/414, rpcs 129/156; 49 cross-domain edges.

## Domains
| Domain | routes | rpcs | tables | policies | money/tenant | depends on |
|--------|------:|----:|------:|--------:|:----:|-----------|
| Themes | 1 | 4 | 32 | 28 |  T | analytics, merchant, storefront |
| Marketplace | 14 | 4 | 46 | 112 |  T | merchant |
| Developer Platform | 3 | 0 | 4 | 6 |  T | — |
| Gift Cards | 2 | 7 | 5 | 7 | ✓ T | — |
| Refunds | 1 | 2 | 7 | 11 | ✓ T | orders, analytics, inventory, payments |
| Payouts | 4 | 5 | 10 | 16 | ✓ T | operations |
| Payments | 3 | 18 | 11 | 12 | ✓ T | orders, analytics, payouts, gift-cards |
| GST & Tax | 1 | 1 | 6 | 3 |  T | — |
| Discounts | 2 | 2 | 11 | 20 |  T | — |
| Shipping | 3 | 1 | 10 | 20 | ✓ T | orders, inventory, analytics |
| Inventory | 1 | 18 | 9 | 20 | ✓ T | products, orders, analytics, merchant |
| Collections | 1 | 0 | 4 | 4 |  T | — |
| Products | 2 | 5 | 10 | 24 |  T | — |
| Orders | 3 | 12 | 10 | 27 | ✓ T | inventory, gift-cards, discounts, shipping |
| Storefront | 14 | 4 | 21 | 31 |  T | analytics |
| Authorization | 2 | 2 | 9 | 14 |  T | merchant |
| Authentication | 1 | 2 | 10 | 9 |  T | operations |
| Identity | 2 | 1 | 8 | 15 |  T | — |
| Merchant | 5 | 4 | 20 | 31 |  T | — |
| Notifications | 3 | 6 | 15 | 21 |  T | operations |
| Analytics | 4 | 13 | 36 | 54 |  T | operations, merchant |
| Internal Operations | 11 | 18 | 34 | 45 | ✓ T | products, notifications, orders, analytics |

## Strongest cross-domain couplings (RPC in A touches table in B)
| Edge | strength | example |
|------|--------:|---------|
| inventory → products | 8 | `adjust_inventory_level→products` |
| orders → inventory | 8 | `create_checkout_order→inventory_events` |
| inventory → orders | 8 | `create_order_with_inventory_reservations→orders` |
| payments → orders | 6 | `attach_order_payment_reference→orders` |
| inventory → analytics | 5 | `adjust_inventory_level→outbox_events` |
| payments → analytics | 5 | `attach_order_payment_reference→outbox_events` |
| operations → products | 5 | `record_production_incident→production_incidents` |
| payments → payouts | 5 | `resolve_money_ledger_source_site_id→payout_statements` |
| orders → gift-cards | 4 | `create_checkout_order→gift_card_accounts` |
| orders → discounts | 4 | `create_checkout_order→promotion_redemptions` |
| refunds → orders | 3 | `complete_order_refund→orders` |
| refunds → analytics | 3 | `complete_order_refund→outbox_events` |
| orders → shipping | 3 | `create_checkout_order→shipping_rates` |
| refunds → inventory | 3 | `create_order_return_and_refund→inventory_levels` |
| operations → notifications | 3 | `inspect_distributed_queue→distributed_queue_messages` |
| operations → orders | 3 | `report_orders_items_reconciliation→orders` |
| payments → gift-cards | 3 | `refresh_money_ledger_site_reconciliation→wallet_ledger_entries` |
| operations → analytics | 3 | `operations→replay_outbox_dead_letter()` |
| operations → inventory | 3 | `services/api-gateway/src/execution/order-execution.adapter→release_order_inventory_with_ledger()` |
| operations → storefront | 3 | `services/api-gateway/src/execution/queue-execution.adapter→claim_platform_queue_jobs()` |

## Classification rules (deterministic, ordered specific→general)
- **Themes** — `/^theme|store_themes|liquid/`
- **Marketplace** — `/^app_|marketplace|extension|^app-store/`
- **Developer Platform** — `/developer|oauth|api_client|api_key|_api_clients|^app-api/`
- **Gift Cards** — `/gift_card|gift-card|^wallet/`
- **Refunds** — `/refund|return/`
- **Payouts** — `/payout|settlement|commission|cod_recon|cod-recon|partner_payout/`
- **Payments** — `/payment|razorpay|^ledger|ledger_/`
- **GST & Tax** — `/^gst|_gst|^tax|_tax_|tax_|invoice/`
- **Discounts** — `/coupon|promotion|discount|marketing|campaign/`
- **Shipping** — `/shipping|shipment|fulfillment|^fulfil/`
- **Inventory** — `/inventory|^stock/`
- **Collections** — `/collection|categor/`
- **Products** — `/^product|metafield|variant|product_/`
- **Orders** — `/^order|order_|^cart|checkout|purchase_order/`
- **Storefront** — `/storefront|^blog|^page|custom_domain|custom-domain|^domains|contact|wishlist|^review|stores-localization|form/`
- **Authorization** — `/rbac|permission|^role|step_up|step-up|entitlement|membership|two_factor|two-factor/`
- **Authentication** — `/session|credential|^otp|^login|^token|turnstile|^auth/`
- **Identity** — `/customer|^kyc|store_customers/`
- **Merchant** — `/^store|^site|merchant|employee|onboard|billing/`
- **Notifications** — `/notification|email|whatsapp|^wa_|ticket|message|contact/`
- **Analytics** — `/analytics|event|metric|rollup|projection|outbox|portfolio|^export/`
- **Internal Operations** — `/incident|operational|operation|internal|console|production_|risk|trust|security|feature_flag|runtime|distributed|execution|audit|admin|reconcil|support/`


> Auto-generated by `pnpm graph:v3` on 2026-06-14T05:30:44Z from repository truth. Heuristic classifications are candidates; the 107 deterministic validators stay authoritative.
