# 18 — Implementation Backlog

Complexity: S / M / L / XL (no hour estimates). Risk: L / M / H. "Files likely affected" are repo-relative to `develop`; new files are marked (new). Definition of Done always includes: paired migration rollback where schema changes, executable suite or unit test named, gate green on the phase branch, no `TARGET` reported as `CURRENT`.

## Phase 0 — Discovery and decisions

| ID | Domain | Task | Deps | Risk | Cx | Files likely affected | Definition of Done |
|---|---|---|---|---|---|---|---|
| U0-01 | Governance | Record the founder's stated decisions (per-channel fees/commission, POS in merchant apps, one merchant app, operator placement preference, app rename) and the open ones (D-2, cart model, providers) | — | L | S | `.claude/skills/letbuyy/references/decisions.md` | rows added with dates and costs |
| U0-02 | Governance | Draft Constitution amendments: fee model (D-1), channel vocabulary (`quick`, `pos`), delivery app as a governed root, POS/Store Ops as modes | U0-01 | M | M | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, `CLAUDE.md`, `scripts/validators/governance-common.mjs` | ARB review recorded |
| U0-03 | Hygiene | Remove `apps/phase_2/Agrimore_Supabase` (2.2 GB nested repo) or replace with a source-only donor snapshot at a committed SHA registered in `phase2AppRoots` | owner word | L | S | `apps/phase_2/*`, `scripts/validators/governance-common.mjs` | `runtime-validator` and `stale-artifact-validator` no longer mention it |
| U0-04 | Hygiene | Back up `develop` off this machine (owner act) | — | H | S | — | remote or bundle exists |

## Phase 1 — Repairs on the existing core

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U1-01 | Payment | Storefront and merchant verify paths read provider payment state and require `captured` with matching amount/currency/provider order before confirming | — | H | M | `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`, `routes/payments.ts`, `execution/payment-execution.adapter.ts`, `packages/infrastructure/razorpay-adapter/index.ts` | executable suite: signature-only → pending; captured → paid |
| U1-02 | Payment | Refund lifecycle: provider `created` → processing, `processed` → succeeded, failure state; align the `refund.created` webhook route | — | M | M | adapter, `services/webhook-service/src/index.ts`, `routes/orders.ts` | suite covers all three provider outcomes |
| U1-03 | Order/Inventory | Late capture after unpaid-stock release: re-reserve if available else hold + refund; guard in `confirm_order_payment_with_ledger` | — | M | M | new migration (`247_*`) + rollback, `211`, `168` lineage guard | suite: webhook after sweeper → correct state |
| U1-04 | Webhook | Reprocess after failed first attempt; stable fallback event ids | — | M | S | `services/webhook-service/src/index.ts` | handler test with failure then retry |
| U1-05 | Identity | Operator login usable outside dev (interim: real magic-link delivery via Resend + MFA; target: operator realm) | — | M | M | `apps/admin_web/src/app/api/console-auth/*`, `apps/identity-platform` | prod-mode login reproduced locally |
| U1-06 | Access | Staff RBAC `enforce` with fail-closed on missing context/lookup errors | — | M | S | `services/api-gateway/src/middleware/staff-permission.ts` | route probes: staff without key → 403; exception → 403 |
| U1-07 | Payment | Move GST computation into the checkout RPC or guard `p_tax_amount` against non-adapter callers | — | M | M | `234` lineage, `order-execution.adapter.ts` | suite: caller-supplied tax rejected |
| U1-08 | Ops | Boot the local stack from `develop` and record one browser journey | Docker pull path | M | M | `database/supabase/config.toml`, launch config | `E2E_DEVELOP` ledger row |
| U1-09 | Governance | Remove PayPal/Cashfree/Stripe env remnants from webhook-service types if dead (D-16 follow-up) | — | L | S | `services/webhook-service/src/index.ts` | typecheck green |

## Phase 2 — Unified identity

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U2-01 | Identity | Phone OTP credential on identity-platform (SMS provider adapter; Turnstile; rate limits) | provider decision | M | L | `apps/identity-platform/src/app/api/buyer/*`, `src/lib/auth/*`, new tables + rollback | register/login by phone reproduced |
| U2-02 | Identity | Google sign-in on the issuer (buyer realm) | — | M | M | identity-platform OAuth routes | link and login tests |
| U2-03 | Identity | `identity_legacy_links` table + Firebase-token exchange endpoint (dual-accept window) | U2-01 | H | M | migration + rollback, identity-platform, gateway buyer wiring | exchange creates link once; replay rejected |
| U2-04 | Identity | Plan and execute HS256 store-customer collapse onto buyer realm (link `store_customers` ↔ `buyer_accounts`, then retire `CUSTOMER_SESSION_SECRET` paths) | U2-03 | H | L | `middleware/customer-session.ts`, `routes/storefront/customer-registration.ts`, `apps/customer_web` account routes | storefront account works with buyer session; secret removed |
| U2-05 | Identity | Operator realm issued by identity-platform; `admin_web` (or operator mode) consumes it; MFA | U1-05 | M | M | identity-platform, admin_web | operator login with MFA in prod mode |
| U2-06 | Identity | Workforce memberships model (`location_memberships`, rider profiles principal link) | U3-02 | M | M | migrations | membership red-team |

## Phase 3 — Merchant / tenant foundation, nodes and custody

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U3-01 | Merchant | Wire `organizations`/`org_memberships`/`org_store_links` behind `FEATURE_ORG_MODEL` for multi-site merchants | — | M | L | `identity-foundation/*`, `routes/stores.ts` | org owner lists sites via membership |
| U3-02 | Merchant | `location_memberships` (cashier, picker, custodian) with server checks on node operations | U1-06 | M | M | migration, `middleware/staff-permission.ts` (extend), inventory routes | node op without membership → 403 |
| U3-03 | Inventory | Node kinds and attributes on `inventory_locations` (`kind`, `operator_party`, geo, hours, capacity, `accepts_orders`, `sla_seconds`); PostGIS enabled | — | M | M | migration + rollback, `routes/inventory.ts`, schemas, registry regen | validator green; nodes CRUD |
| U3-04 | Inventory | `custody_agreements` and cross-owner transfers: `in_transit` state, partner acceptance by custodian membership, short/damage lines, quarantine | U3-02, U3-03 | H | L | migrations (transfers), `216` lineage functions, `routes/inventory.ts` | **20-shirts suite**: 15/5 with in-transit, acceptance only by custodian |
| U3-05 | Inventory | `stock_movements` reason codes on `inventory_events` (opening, receipt, sale, online consumption, return, damage, adjustment, correction) | — | L | S | migration, RPCs | every RPC writes a reason |
| U3-06 | Merchant UI | Nodes and Staff-per-node screens in merchant_web/merchant_app | U3-02..04 | M | M | `apps/merchant_web/src/app/[store]/products/locations`, `apps/merchant_app/lib/screens/inventory/*`, settings/users | screens wired, nine states |

## Phase 4 — Unified catalog

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U4-01 | Catalog | `brands` table + product link; `unit_label`, `mrp` fields (from S3) | — | L | M | migration, `routes/products.ts`, schemas, forms | fields round-trip |
| U4-02 | Catalog | SKU uniqueness per site; barcode uniqueness policy per variant (POS prerequisite) | — | M | M | migration (unique indexes with backfill report) | duplicate rejected |
| U4-03 | Catalog | Firestore product parity report vs canonical (counts, prices, images) | cloud export | L | S | script under `scripts/` (new) | report in `docs/evidence` |

## Phase 5 — Sales channel architecture

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U5-01 | Channel | `site_channel_enrolments` with lifecycle + eligibility evaluator; channels API | U3-03 | M | L | migration, `routes/channels.ts` (new), schemas | lifecycle suite |
| U5-02 | Channel | Onboarding channel-selection step; plan selection ordering | U5-01 | L | M | `routes/onboarding.ts`, merchant_app wizard, identity onboarding page | flow reproduced |
| U5-03 | Listing | Channel prices and commission rule on `channel_listings`; `node_offers`; price resolution service used by feed and checkout; snapshot into `order_items` | U5-01 | H | L | `217` lineage, `234` lineage, `public-routes.ts`, `checkout-payment-routes.ts`, `routes/channel-listings.ts` | Amul Milk example suite |
| U5-04 | Entitlement | `plan_features` + `hasEntitlement(site, key)`; route guards for channels, domains, seats, locations | — | M | M | `packages/billing-core`, gateway middleware | no `plan === 'x'` in new code (lint rule) |
| U5-05 | Money | Commission/fee rules per channel (effective-dated) posting to the ledger per founder decision; statements per channel | U0-01 fee decision | H | L | migrations (account codes), `routes/commission.ts`, `routes/settlements.ts` | balanced postings; validator updated by amendment |
| U5-06 | Merchant UI | Sales Channels page; Publish panel per product | U5-01..03 | M | L | merchant_web pages (new), merchant_app screens | UI wired |
| U5-07 | Vocabulary | Migrate channel value `instant` → `quick` (or alias) across `channel_listings`, `purchases`, schemas | U0-02 | M | S | migration + rollback, schemas | suites green |

## Phase 6 — Inventory & fulfilment (Quick foundations)

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U6-01 | Fulfilment | `service_zones` (circle/polygon, PostGIS), `node_zones`; validation of geometry | U3-03 | M | M | migration | invalid polygon rejected |
| U6-02 | Fulfilment | Serviceability resolver: every eligible node with ranking + explanation; revalidation helpers | U6-01 | H | L | `routes/serviceability.ts` (new), RPC | boundary property tests; overlap returns both nodes |
| U6-03 | Customer | Platform address book with coordinates; geocoding adapter | provider decision | M | M | migration, buyer routes, maps adapter (new package) | address CRUD + geocode |
| U6-04 | Order | `quotes` with expiry holding reservations; quote sweeper on a minute-level cron | U5-03 | H | L | migration, RPC `create_quick_quote`/`expire_quotes`, `services/queue-workers/src/*`, wrangler cron | expiry releases exactly once under retry |
| U6-05 | Operator UI | Zone editor + node registry (operator console) | U6-01, U2-05 | M | L | admin_web pages (new) | zone activation with audit |

## Phase 7 — Order engine

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U7-01 | Order | `order_channel`, `fulfilment_type` columns with CHECKs; `order_status_events` | U5-07 | M | M | migration, schemas | backfill of existing orders |
| U7-02 | Order | Quick state machine in DB (transition RPC with expected version) and mapping to `orders.status` | U7-01 | H | L | migration, `routes/orders.ts` | illegal transitions rejected |
| U7-03 | Order | Quick checkout: basket → quote → pay → confirm via guarded `create_checkout_order` lineage (channel=quick, node-scoped allocation) | U6-04, U1-01 | H | XL | `234` lineage (new definition with lineage guard), `checkout-payment-routes.ts`, new quick routes | concurrency suite across storefront/Quick last unit |
| U7-04 | Order | Node acceptance deadline → release + refund + notify | U7-02 | M | M | sweeper, RPC | timeout suite |
| U7-05 | Merchant UI | Quick order queue in merchant apps | U7-02 | M | M | merchant_web orders pages, merchant_app orders | queue shows SLA timers |

## Phase 8 — Marketplace backend completion

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U8-01 | Customer | Buyer order reads covering both channels; tracking payloads | U7-01 | M | M | buyer routes | contract tests |
| U8-02 | Customer | Saved cards / VPA validation decision and, if kept, canonical implementation | founder | M | L | payments routes | tests |
| U8-03 | Migration | Firestore shadow import rehearsal + parity reports | cloud export | H | L | scripts (new), rehearsal DB | reports in evidence |
| U8-04 | Ops | Approved listings flowing in a real environment (operator login + moderation) | U1-05 | M | S | — | feed returns rows in staging |

## Phase 9 — Customer app integration

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U9-01 | App | Repository interfaces for every domain in `marketplace_services`; remove the 29 direct Firestore call sites from the app | — | M | L | `packages/dart/marketplace_services/lib/src/*`, `apps/customer_app/lib/**` | no `cloud_firestore` import outside repositories |
| U9-02 | App | Canonical implementations per domain behind flags (banners, personalization, wishlist, profile, addresses, cart, checkout, orders, returns, notifications, loyalty, support) | U8 | H | XL | same + `lib/data/*` | each domain switchable |
| U9-03 | App | Shell with Ecommerce/Quick mode switch and serviceability gate; rename display name (package id unchanged) | U6-02 | M | M | `lib/main.dart`, `lib/screens/main_screen.dart`, android/ios manifests | Quick hidden when unserviceable |
| U9-04 | App | FCM token registration against buyer principal; keep `firebase_messaging` | U2-03 | L | S | notification provider, gateway route | push received in test |
| U9-05 | App | Analytics sink decision and implementation | founder | L | S | — | events flow |

## Phase 10 — Quick commerce integration

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U10-01 | App | Quick basket (node-bound), node picker, requote on node change, quote/pay/confirm screens | U7-03 | H | L | customer_app checkout/cart screens | journey recorded |
| U10-02 | Fulfilment | Store-ops transitions (accept/decline, pick, pack, ready, handover) with membership checks and task queue | U7-02, U3-02 | H | L | `routes/store-ops.ts` (new), RPCs | transactional suites |
| U10-03 | Merchant UI | Store Ops mode in merchant_web/merchant_app; standalone app for partner staff from `apps/phase_2/store_ops_app` | U10-02 | M | L | merchant apps, `apps/phase_2/store_ops_app` | pick→handover reproduced |
| U10-04 | Merchant UI | Dark-store and partner-node management (custody status, transfers) | U3-04 | M | M | merchant apps | — |

## Phase 11 — Delivery platform

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U11-01 | Delivery | Rider profiles, shifts, presence ingestion (heartbeat) | U2-06 | M | M | migrations, `routes/dispatch.ts` (new) | heartbeat rate-limited, stored with TTL |
| U11-02 | Delivery | Offers with expiry, atomic acceptance RPC, re-offer sweeper, escalation | U11-01, U7-02 | H | L | migrations, RPCs, queue-workers | offer race → exactly one acceptance |
| U11-03 | Delivery | Delivery task transitions with expected version; proof upload participant-bound; earnings postings to ledger | U11-02, U5-05 | H | L | RPCs, media route, ledger accounts | balanced earnings postings |
| U11-04 | Realtime | Realtime Worker (Durable Object rooms, KV/Redis presence, participation-authorised subscriptions) | U11-01 | H | L | `services/realtime` (new root — Constitution amendment) | non-participant subscription rejected |
| U11-05 | App | Delivery partner app: wire `apps/phase_2/rider_app` to dispatch + realtime; promote to governed root | U11-02..04 | M | L | `apps/phase_2/rider_app/**`, governance arrays | first rehearsal delivery end to end |
| U11-06 | App | Live tracking map in the customer app (pattern from the archived Firebase-era screen; data from realtime) | U11-04 | M | M | customer_app orders/tracking | map shows assigned rider to the buyer only |
| U11-07 | Delivery | ETA service: prep time + routing adapter | maps decision | M | M | adapter, quote | ETA on quote and tracking |

## Phase 12 — Merchant control plane

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U12-01 | Merchant UI | IA regrouping per [12 §2](./12-MERCHANT-CONTROL-PLANE.md); channel dashboards | U5, U7 | L | M | merchant_web navigation, merchant_app main | founder IA present |
| U12-02 | Analytics | Channel dimension in analytics rollups and routes | U7-01 | M | M | `routes/analytics.ts`, `commerce-analytics.ts`, queue-workers | revenue split by channel |

## Phase 13 — Payments / settlement

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U13-01 | Ledger | Account types for commission, custody fees, rider earnings per decisions; statement generation per party | U0-01, D-2 | H | L | migrations, `routes/payouts.ts`, `settlements.ts` | reconciliation to zero |
| U13-02 | Payment | Payout execution stance (record-only vs provider rail) per custody decision | D-2 | H | XL | — | as decided |
| U13-03 | Security | Step-up re-verification on refunds, payouts, bank changes | — | M | M | `routes/security.ts`, `two-factor.ts` | probes |

## Phase 14 — Analytics / notifications

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U14-01 | Notification | Unified event → template → channel pipeline incl. delivery events | U7, U11 | M | M | queue-workers, `packages/notification-core` | every event delivered |
| U14-02 | Notification | Merchant and rider push tokens | U11-01 | L | S | — | — |

## Phase 15 — Firebase retirement

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U15-01 | Migration | Execute [15](./15-DATA-MIGRATION-PLAN.md): users + links, addresses, wishlists, reviews, open orders, notifications, ads, support; media copy + URL map | U8-03, U9-02 | H | XL | scripts, migrations | parity reports; rollback rehearsed |
| U15-02 | App | Cutover release (D-10); Firestore read-only; exchange endpoint sunset | U15-01 | H | M | customer_app release | login success rate, error budget |
| U15-03 | Owner | Delete Firebase project (FB-5) after the window | U15-02 | — | S | — | done by owner |

## Phase 16 — Hardening

| ID | Domain | Task | Deps | Risk | Cx | Files | DoD |
|---|---|---|---|---|---|---|---|
| U16-01 | Security | Red-team extension: nodes, custodians, riders, realtime, buyer data | U3, U11 | M | M | `tests/executable/*` | new suites green |
| U16-02 | Ops | Load/spike/soak on checkout, inventory, dispatch; queue lag measured; SLOs with budgets; alert route to a human; restore drill | cloud | H | L | infrastructure | eleven dimensions measured |
| U16-03 | POS | POS work package contract: terminal binding, cashier session, counter-sale RPC, suspended baskets, receipts, shifts; first domain per decision | U3, U4-02, U5-03 | H | XL | new module | contract written; first slice scheduled |

## Tests the consolidation must include (per brief §63)

tenant isolation (nodes, custodians, riders added) · channel publishing (Amul Milk example) · inventory reservation (Quick quote and Ecommerce order-time paths under concurrency) · zone serviceability (boundary, overlap, hours, capacity) · checkout (both flows) · order transitions (both state machines) · payment webhooks (capture, failure, retry, refund states) · refunds (lifecycle + stock compensation once) · merchant authorisation (staff enforce, memberships) · customer authorisation (buyer routes, participation) · rider assignment (offer race, expiry, re-offer).
