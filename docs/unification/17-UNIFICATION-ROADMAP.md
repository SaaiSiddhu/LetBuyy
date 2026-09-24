# 17 — Unification Roadmap

The brief's 16-phase skeleton is kept but re-sequenced where repository evidence demands: repairs on the existing money and access paths come before any new channel; identity precedes every account-scoped feature (as D-13 already found); channel architecture precedes inventory/fulfilment because node offers depend on listings; delivery follows Quick checkout; Firebase retirement is one cutover at the end (D-10). Each phase lands as vertical slices with executable Postgres suites as acceptance, never as a repository-wide merge. No calendar estimates: capacity is unmeasured.

## Decisions gate (before Phase 1)

| Decision | Status | Why it blocks |
|---|---|---|
| Fee model: per-channel fees and product-based commission (reverses D-1 0%) | FOUNDER-STATED 2026-09-19, not recorded. **Conflicts** with D-1 (0% on both channels, permanent — OWNER_DECISION 2026-09-04) and Constitution §6; `commission-bps-zero-validator` enforces 0. Audit FD-1. A fee needs the founder's explicit decision **and** a Constitution amendment; nothing below assumes one | ledger accounts, statements, entitlements, the economics worksheet below |
| Custody and merchant-of-record (D-2) | OPEN (counsel). Audit FD-2/FD-3. New input (2026-09-23): the storefront capture path reads platform-level `RAZORPAY_KEY_ID/SECRET` (`routes/storefront/checkout-payment-routes.ts:455-628`), while the merchant path requires merchant-owned credentials (`HR-MERCHANT-PSP-LIVE`) — so which account captures buyer money in live mode is itself the custody question | payouts, GST on partner fulfilment, refund liability, every Quick money flow |
| Cart model (separate baskets recommended) | recommendation; D-3 already builds parent purchase + child orders, single-merchant-per-checkout behind a flag. Audit FD-4 | Cart/Order design |
| POS inside merchant apps (supersedes native desktop) | FOUNDER-STATED | POS phase shape |
| Operator console placement (`admin_web` vs mode in `merchant_web`) | **ANSWERED 2026-09-24 — D-ONE-PRODUCT**: one internal console, the existing admin survivor (`admin_web`, moving to `apps/internal/console`). Audit FD-5 | operator login phase |
| Operator identity and cross-tenant operator reads (new, F-ADM4-1) | **Identity ANSWERED 2026-09-24 — D-ONE-IDENTITY**: operators sign in through `identity-platform`; the cross-tenant read path is technical design under ART-08/SEC-R9, not an owner decision. Originally OPEN. The moderation chain has five breaks (production login refused; console session has no operator id; `admin_web` authenticates with one shared bearer the operator routes never accept; the decision body lacked `idempotency_key` — fixed; the tenant guard refuses the operator's cross-site `channel_listings` reads). Options: an `identity-platform` operator realm (the Constitution's sole-issuer model) or a console-signed assertion over the shared internal secret (SEC-R7 concern); either way operator reads need a sanctioned cross-tenant path | Phase 1 "operator login works outside dev"; the marketplace feed stays empty until solved |
| Quick channel value: keep `instant` or rename `quick` | open (vocabulary) | one migration |
| Providers: SMS OTP, maps/routing | open | identity, serviceability |
| App rename scope (display name vs directory/governance) | **ANSWERED 2026-09-24 — D-APP-LAYOUT** (`decisions.md` §2g, Constitution Amendment 3): directories move to the grouped layout; published identities and package names are preserved | Phase 9 display name only |
| Constitution amendments: fee, channel vocabulary, new app roots (delivery app), reserved services if any | required | topology gate |

## Phases

| Phase | Goal | Current → Target | Apps | Schema | API | UI | Migration | Compat / rollback | Testing | Definition of Done |
|---|---|---|---|---|---|---|---|---|---|---|
| **0 Discovery** | this document set; decisions recorded | — | — | — | — | — | — | — | — | founder answers the gate; Constitution amendment drafts written; the 2.2 GB donor copy removed or reduced |
| **1 Canonical domain model + repairs** | freeze glossary and domain owners; repair the five money/access defects; boot the local stack once | S1 as is → S1 with fixes | gateway, webhook-service, admin_web | none structural | verify path reads capture; refund lifecycle; late-capture guard; webhook retry; operator login | none | none | flags off = old behaviour | new executable suites per defect; local e2e recorded | all suites green; `E2E_DEVELOP` reached; operator login works outside dev |
| **2 Unified identity** | phone OTP + Google on identity-platform; legacy link table; dual-accept exchange; HS256 collapse plan | 3 customer identities → 1 principal | identity-platform, gateway, customer_app | `identity_legacy_links`, credential tables | buyer phone OTP, Google, exchange endpoint | auth screens repointed | none yet | Firebase login untouched | login/exchange suites; forgery/replay tests | a Firebase user obtains a buyer session once and thereafter logs in canonically |
| **3 Merchant / tenant foundation** | org → site → node hierarchy; location memberships; staff RBAC enforce fail-closed; fulfilment nodes of four kinds; custody agreements; transfers with in-transit and partner acceptance | single-owner locations → nodes + custody | gateway, merchant apps | node columns, `custody_agreements`, `location_memberships`, transfer states | nodes CRUD, custody, membership | Locations → Nodes screens, Staff roles per node | none | additive columns; rollbacks paired | 20-shirts suite; membership red-team | custodian-only receipt proven; unset GUC → zero rows on new tables |
| **4 Unified catalog** | brands, SKU/barcode uniqueness policy, attribute completeness; parity with Firestore products | — | gateway, merchant apps | `brands`, unique indexes | catalogue routes | product form fields | Firestore product parity report | additive | catalogue suites | no duplicate master per channel |
| **5 Sales channel architecture** | `site_channel_enrolments`; channel step in onboarding; listing prices; node offers; price resolution; entitlements service; commission rules per decision | flags → domain | gateway, merchant apps, identity onboarding | enrolments, price columns, `node_offers`, `plan_features`, commission rule tables | channels API, publish panel API | Sales Channels page, Publish panel | existing listings get default enrolments | flags per channel | enrolment lifecycle suites; price resolution suites | Amul Milk example expressible end to end |
| **6 Inventory & fulfilment (Quick foundations)** | PostGIS; zones (circle/polygon); node ↔ zones; serviceability resolver with overlap + choice + explanation; node availability; quote object with expiry sweeper | none → serviceable | gateway, queue-workers, operator console | `service_zones`, `node_zones`, `quotes` | serviceability, quote | zone editor (operator), node coverage (merchant) | none | Quick behind `QUICK_CHANNEL` flag | boundary property tests; quote expiry once | ineligible node cannot be ordered from; quote holds and releases |
| **7 Order engine** | channel + fulfilment type columns with CHECKs; Quick state machine; `order_status_events`; Quick checkout via guarded RPC lineage; node acceptance timeout | one flow → two explicit flows | gateway, queue-workers | columns, status events | quick checkout, acceptance | merchant Quick queue | vocabulary migration (`instant` → `quick`) | mapping to `orders.status` keeps existing screens working | concurrency across storefront/Quick last unit; acceptance timeout release+refund | both state machines enforced in DB |
| **8 Marketplace backend migration** | remaining customer-facing backends complete (addresses book, notifications, returns, support, loyalty semantics) and approved listings flowing | partial → complete | gateway | `buyer_addresses` | buyer routes | — | Firestore shadow import rehearsal | flags per domain | suites per route | app can run every Ecommerce journey canonically in rehearsal |
| **9 Customer app integration** | repositories switched domain by domain; mode shell (Ecommerce/Quick); serviceability gate; rename display name | Firebase app → canonical app with Quick mode | customer_app | — | — | shell, tracking rebuild | dual-read per domain | per-domain flags | device tests; journey recordings | same buyer sees both order types; Quick hidden when unserviceable |
| **10 Quick commerce integration** | Quick basket, node choice, quote/pay/confirm, Store Ops mode transitions, dark-store and partner-node management | — | customer_app, merchant apps, store_ops_app (partner) | store-ops tasks | store-ops commands | Store Ops mode | none | flag | transactional transition suites | pick→pack→ready→handover proven; empty update never success |
| **11 Delivery platform integration** | rider profiles/shifts, presence ingestion, offers with expiry, atomic acceptance, re-offer sweeper, delivery task transitions, proof, earnings postings, realtime Worker, live map | none → live delivery | rider_app (promoted root), realtime Worker, customer_app | delivery tables | dispatch commands, realtime channels | rider app wired; tracking map | none | flag | offer race → one acceptance; participation-only subscription | first end-to-end Quick order with rider in rehearsal |
| **12 Merchant control plane integration** | IA regrouping, channel dashboards, per-channel analytics, statements by channel | — | merchant apps | analytics rollup columns | analytics | pages | none | additive | UI tests | founder's IA present with real data |
| **13 Payments / settlement consolidation** | ledger accounts for commission, custody fees, rider earnings per decisions; statements per party; payout execution stance | 0% + record-only → decided model | gateway, ledger | account codes, rules | statements | payouts pages | none | reversible postings | balance and reconciliation suites | reconciliation to zero across channels |
| **14 Analytics / notifications** | channel dimension everywhere; unified event → template → channel pipeline; FCM tokens on buyer principals | — | queue-workers, apps | — | — | — | notification history import | — | delivery logs | every event in [14 §5](./14-ORDER-FULFILMENT-ARCHITECTURE.md) delivered on at least one channel |
| **15 Firebase legacy retirement** | data migration per [15](./15-DATA-MIGRATION-PLAN.md); cutover release (D-10); media URL map; Firestore read-only; project deletion (owner) | live Firebase → canonical | customer_app | link tables populated | exchange endpoint sunset | — | full | previous app version + read-only Firestore | parity reports; login success; media 404 rate | Firebase serves nothing but FCM |
| **16 Hardening / security / cleanup** | red-team extension, load/spike/soak on checkout/inventory/dispatch, restore drill, alert routing, SLOs, POS phase kickoff | — | all | — | — | — | — | — | production-readiness dimensions measured | eleven dimensions measured; POS contract written |

POS (counter sale, terminals, shifts) starts after Phase 10 as its own work package inside the merchant apps; if the first Quick partner keeps external tills, POS or a proven till feed moves onto the pilot's dependency path (the independent review's point, accepted).

**Phase 1 status, measured 2026-09-23 against `develop` = `1e6cc4c3`** (branches below are committed, not merged or pushed):

| Repair | State | Evidence |
|---|---|---|
| Late capture after the unpaid sweep released stock (audit LB-PAY-004) | **Reproduced and fixed** on `letbuyy/pay4-late-capture-after-release` (migration 252 + gateway) | `tests/executable/late-capture-after-release-postgres.test.mjs`: 9 fail on 000..251, 12/12 with 252; CONTROL rolls 252 back inside the suite |
| The same payment posted to the ledger twice when the verify callback and the webhook both confirm it (LB-PAY-009, new) | **Reproduced and fixed** by the same migration | same suite (sequential and concurrent) |
| A webhook whose first processing failed is acknowledged as a duplicate on every retry (LB-PAY-008, new) | open — code reading only | `services/webhook-service/src/index.ts` `writeWebhookEvent` uses an ignore-duplicates upsert |
| Refund `created` read as `refunded` (LB-PAY-003) | open | audit §13.2 |
| Operator login and moderation (LB-SEC-002) | **one of five breaks**; the request-body break is fixed on `letbuyy/adm4-operator-moderation-chain`; the rest wait on the operator-identity decision above | `services/api-gateway/src/__tests__/operator-moderation-auth-chain.test.ts` |
| Fulfilment RPC (LB-FUL-001, new) | open — `create_order_fulfillment` raises `column "variant_id" is of type uuid but expression is of type text` on an ordinary order | reproduced by a direct SQL call against 000..252 |
| Boot the local stack once (`E2E_DEVELOP`) | not attempted | — |

## Checkpoint template (applies to every phase)

Goal · Current system · Target system · Affected applications · Schema impact (migration + paired rollback) · API impact (schemas in `services/api-gateway/src/schemas`, client types) · UI impact · Migration steps · Backward compatibility (flags, dual-read) · Rollback strategy · Testing (executable suites named; revert-and-watch) · Definition of Done (measured, not asserted).

## Failure drills

A phase that touches money, stock or fulfilment is not done until its drills pass **as executable suites** and, from Phase 16, on a real environment. The expected outcome is part of the design: it must hold under retries and concurrency, and it must not assume LetBuyy holds merchant money (D-2 open) or can execute payouts (it records them). "Evidence today" is measured, not planned.

| # | Drill | Order | Stock | Payment and ledger | Customer | Operator / merchant recovery | Evidence today |
|---|---|---|---|---|---|---|---|
| 1 | Duplicate or reordered payment notifications (verify callback + webhook + redelivery) | one transition; later notifications return `duplicate` | untouched by duplicates | one `payment_capture` posting per provider payment; one `order.paid` event (keyed per payment) | one confirmation (email keyed per order) | none; webhook row `processed` | **Proven** — late-capture suite (sequential, concurrent, redelivery); before 252 it double-posted (LB-PAY-009). Residual: LB-PAY-008 (a retried webhook after a failed attempt is swallowed) |
| 2 | Capture lands after the reservation expired and the stock was released (and the sibling: second attempt captured after `payment.failed` cancelled the order) | `cancelled`, `fulfillment_state = cancelled`; `create_order_fulfillment` refuses it | stays released; whoever bought the unit keeps it | capture recorded once and booked like any capture; refund owed (`compensation_actions`, `refund_captured_payment`); the provider's `refund.created` reverses it to zero | verify answers 409 `PAYMENT_CAPTURED_ORDER_UNFULFILLABLE` ("…your payment will be refunded…"); `order.cancelled` → `order_cancelled` email | refund executed by whoever operates the capturing account (D-2); no console lists `compensation_actions` yet | **Proven** on `letbuyy/pay4-late-capture-after-release` — suite 12/12, route tests 9/9, including a sweep-in-flight interleaving |
| 3 | Concurrent checkouts for the final unit | exactly one order; the other gets a typed refusal | never negative | none for the refused buyer | refused buyer told it is out of stock | none | **Proven at the RPC** — `checkout-order-concurrency` W1a (re-run 2026-09-23); route-level concurrency never exercised |
| 4 | POS sells the final shelf unit before sync | an online order for that unit is refused, or — if an unsynced till oversold it — cancelled with a full refund (drill 2's path) | one authority: a counter sale consumes through the same reservation RPCs | POS tender posts through the ledger; no second stock count | told before payment where possible, else cancellation + refund | stock variance recorded with a reason | **Not built** — no POS writes the `pos` channel; no external till feed (audit §10.2). Pilot rule: no shared-inventory promise with a partner whose tills are not captured |
| 5 | Item missing at picking; partial refund | line shorted or substituted **only with buyer approval**; order stays fulfillable for the rest | shortfall adjusted with a reason code; its reservation released | line-level refund via `create_order_return_and_refund(p_lines)` → `complete_order_refund` reversal | told the shortfall and the refund amount before handover | refund failures visible | **Partial** — line refunds exist; no pick/pack or substitution model; fulfilment itself fails today (LB-FUL-001); refund `created` ≠ `refunded` (LB-PAY-003) |
| 6 | Rider offline or failed pickup | stays in fulfilment; re-offered; escalates after a bounded number of timeouts | held by the order until it is cancelled | unchanged until cancellation; cancellation → full refund | honest revised ETA | re-dispatch queue with the attempt history | **Not built** (donor shape: Agrimore `000008_delivery_dispatch.sql` offers with expiry and versioned transitions) |
| 7 | Zone paused with orders in progress | new orders refused at the serviceability check with a reason; in-flight orders continue | untouched | none | new buyers see "not serviceable right now"; in-flight buyers unaffected | pause and resume audited | **Not built** — no zones exist |
| 8 | Stale marketplace or search availability | refused at checkout if stock is gone | checkout re-reads and locks `inventory_levels`; never oversold | none for the refused order | clear out-of-stock at checkout, not after payment | none | **Guard exists** — server-authoritative reservation under lock (drill 3's suites); search index not built |
| 9 | Refund after a payout statement was created | refunded | per the restock rule | reversal debits `merchant_payable`; the next statement carries it forward — statements are records, no money moves | refund confirmation | the statement shows the carry-forward | **Untested** — `payout_statements` and release claims exist; carry-forward never exercised by a suite |
| 10 | Wrong-tenant custom-domain or cache routing | no order ever created under the wrong site | none | none | unknown host → 404; never another store's catalogue or cart | domain verification states visible | **Partial** — RLS red-team RT-1…RT-9 proven (`tenant-redteam`, re-run 2026-09-23); host routing (`customer_web/src/proxy.ts`) never exercised end to end — nothing is deployed |
| 11 | Refund notification arrives before the capture | ignored until the capture lands, then reconciled | none | nothing posted against an unpaid order | none until resolved | logged `refund_webhook_skipped_order_not_captured` | **Guard exists** (`webhook-service` `markOrderRefunded` paid-guard); not exercised by a suite |

## Pilot acceptance scenario

**No pilot can run today.** Nothing is deployed: there is no Supabase project by owner decision (D-11), the deploy workflows are dispatch-only (D-DEPLOY), and live payment credentials, webhook URLs and carriers are human seams (`EXECUTABLE_HUMAN_REQUIRED.md`). The scenario below is the acceptance test for the first controlled pilot of what is **already built** — storefront plus marketplace, parcel or pickup fulfilment — followed by the criteria Quick must add later.

**Prerequisites — every one measured before step 1:**

- An environment exists with point-in-time recovery, a restore drill logged, and alerts reaching a named person (D-11 and D-DEPLOY-1 revisited by the owner).
- Operator login and the operator read path work in that environment (decision row above), so listings can be approved.
- The account that captures buyer money is the one FD-2 settles on, with its webhook URL registered.
- `letbuyy/pay4-late-capture-after-release` merged; LB-PAY-003, LB-PAY-008 and LB-FUL-001 fixed with suites.
- The local stack has reached `E2E_DEVELOP` once from `develop`.

**The ten steps (built capability):**

1. A merchant signs up through `identity-platform` (OTP, Turnstile), creates a store, and records GST and payout details — payout details are recorded, never used to move money.
2. The merchant creates the pilot catalogue — photos, price, HSN/GST, stock at the default location — and errors are reported per product.
3. The storefront is published; marketplace listings are submitted; an operator approves them and the approval is attributed to that operator in `audit_logs`.
4. A buyer sees server-computed price, GST and shipping on the storefront and the marketplace, and no ETA claim, because none is built.
5. The buyer pays. The verify callback and the webhook both arrive, and one is redelivered: exactly one order, one ledger capture, one confirmation (drill 1).
6. Stock is reserved and committed exactly once; the merchant fulfils the order (label and shipment; carriers stay sandbox until `HR-CARRIER-LIVE`).
7. The buyer receives status updates; delivery is recorded; the ledger capture matches the provider's settlement line; the payout statement (a record) balances.
8. A second order takes a partial refund of one line: ledger reversal posted, provider refund confirmed by webhook — `created` never reads as refunded.
9. On the pilot environment: a payment captured after its reservation expired ends cancelled with the refund owed and the buyer told (drill 2); the operator works the refund queue.
10. Reconciliation reports run to zero, support tickets are reviewed, and the economics worksheet below is filled with real numbers before another merchant or channel is added.

**Future physical-delivery acceptance (Quick; not before Phases 3, 5, 6, 7, 10 and 11):** an address geocoded and validated; a serviceability answer with reason codes; a zone pause (drill 7); stock reserved at the node that will pick it; pick/pack with a substitution the buyer approved (drill 5); a rider offer accepted exactly once and a failed pickup re-offered (drill 6); proof of delivery; a partner's custodial receipt of transferred stock (the audit's 20-shirts scenario, §10.2).

## Per-order economics worksheet

Built for the fee model **as recorded**: 0% of the order value, permanently (D-1, Constitution §6). LetBuyy's revenue categories are the ones D-1 names — plans, ad campaigns, credits, logistics. There is no commission, no take rate, no merchant payable owed by LetBuyy and no settlement it executes. If the founder changes the fee model (FD-1), this worksheet changes with it — not before.

| Line | Definition | Borne / received by | Source of truth | Status |
|---|---|---|---|---|
| Order value | paid item value net of discounts, by channel and zone | the merchant receives it | `orders`, `order_items` (`*_minor`) | built |
| GST on the order | tax computed server-side | the merchant collects; the invoicing party for marketplace and partner fulfilment is D-2 | `order_tax_lines`, `gst_invoices` | built — `issue_gst_invoice` (214) runs at order creation when the store has a GSTIN, which on the razorpay rail is **before payment**: an order the sweep or a late capture later cancels still carries an invoice, and no credit-note path is modelled |
| Subscription allocation | plan price ÷ the merchant's orders in the period | LetBuyy receives | `billing_history`, `subscriptions` | built (live AutoPay is `HR-AUTOPAY-LIVE`) |
| Ad and credit revenue attributed | prepaid campaign spend attributed to the order's listings | LetBuyy receives | ad-credit ledger (D-5), `record_ad_spend` | built |
| Logistics service charge | a delivery or fulfilment service fee, if one is offered | a D-1 category, but **who invoices it and whose account receives it is D-2** | — | not built; founder question |
| Payment gateway fee | the provider's MDR on the captured amount | whoever owns the capturing account: the merchant under merchant-owned credentials (`HR-MERCHANT-PSP-LIVE`), otherwise open (FD-2) | provider settlement report | not measured |
| Delivery cost | carrier label or rider cost | whoever contracts the carrier or rider | `shipments`; no rider model yet | parcel only |
| Pick/pack cost | labour and materials per order | the merchant, or the partner under a custody agreement | time study | not measured |
| Refunds, returns, support | refunded value, reverse logistics, support time | refunds reverse the merchant's sale; support time is LetBuyy's | `refunds`, `support_tickets` | built (refund fidelity: LB-PAY-003) |
| Promotions | discounts and loyalty | merchant-funded by default (loyalty is merchant-funded, D-17); any LetBuyy-funded promotion is a LetBuyy cost | `coupons`, loyalty ledger | built |
| Infrastructure variable cost | Workers requests, database, messaging, email per order | LetBuyy | provider usage reports | not measured |

**LetBuyy contribution per order** = subscription allocation + attributed ad and credit revenue + any permitted service charge − LetBuyy-borne costs (infrastructure, support, LetBuyy-funded promotions, and gateway fees only where LetBuyy owns the capturing account). The **merchant's** margin — order value less product cost, gateway fee, delivery, pick/pack and refunds — is tracked separately, because GMV is not LetBuyy revenue. Every line is measured from the source of truth above in the pilot; none is estimated here.

## The live app and the Firebase cutover (D-10)

The Play Store app `com.letbuyy.letbuyy` (`apps/customer_app`, version `1.0.10+4013`) still runs on Firebase project `letbuy-y`: no commit has touched `apps/customer_app` since 2026-09-07, and the app and its packages hold 387 Firestore `collection(...)` references. The catalogue reads were moved to the canonical API by FB-2. Everything else waits for the one cutover D-10 requires, after every D-9 area exists canonically. The strangler sequence and data plan are in [10](./10-FIREBASE-MIGRATION.md); this is the measured status.

| D-9 area | Canonical backend (`CAPABILITY_BACKLOG.md`) | App client |
|---|---|---|
| Notifications | closed (migration 224, buyer inbox, FCM dispatcher) | Firestore |
| Ads | closed (credit ledger, sponsored feed, metering) | Firestore reads |
| Reels | **blocked** — `services/media-service` is RESERVED; needs a named trigger + ARB | Firestore |
| Chat | closed for support; buyer↔seller withdrawn as a register error | Firestore |
| Social (follows) | closed (migration 229) | Firestore |
| Loyalty | closed (ledger + tender); merchant-funded per D-17 — a product change from today's cashback | Firestore |
| Personalization | closed (migration 230) | Firestore |
| Returns | closed | Firestore |
| Shipping per product | closed | Firestore |
| Banners | closed (migration 228); operator curation shares the operator-chain breaks | Firestore |
| App-update gating | closed (migration 227) | Firestore |

**Gates before the single cutover** (none may be skipped; nothing in this document triggers it): an environment exists (D-11 changes); operator login and reads work, or the cutover ships an empty marketplace; buyer phone OTP and Google sign-in on the buyer realm (`CAP-FB-OAUTH` open) with the legacy link table; a platform address book (absent — addresses are per-store today); the app's payment path on the canonical routes with drills 1 and 2 passing; a reels decision (ARB, or the feature disabled at cutover); every area's client repository behind a flag; a rehearsal on a copy with the previous app version kept installable.

## First engineering slice (after the decisions gate)

Phase 1 in full, then the vertical slice **Nodes + custody + 20-shirts transfer** (Phase 3) because it is small, purely S1, unblocks both Quick and POS, and proves the membership model — followed by **channel enrolment + listing prices + node offers** (Phase 5) which makes the founder's Amul Milk example real for the storefront and marketplace before Quick exists.

*Qualification (2026-09-23):* the **custody** half of that slice cannot start until FD-2 and counsel settle who owns stock at a partner and what the partner is paid; merchant-owned nodes can start now. A partner supermarket must never be modelled as another row of the merchant's own `inventory_locations` just to make a transfer pass — that encodes custody and tenancy by accident (audit §10.2).

**First physical-delivery slice, in dependency order.** Measured at `1e6cc4c3`: no `geography`, `latitude` or `longitude` in any of the 180 tracked migrations; addresses exist only per store (`customer_addresses`, no coordinates) — the D-8 buyer realm has no address book; `inventory_locations` carries one owner (`store_id`) and no operator, coordinates, hours or capacity; the in-repo donor entities (`packages/dart/quickcommerce_domain`) are 2–8-line stubs, so the usable donor shapes are Agrimore's migrations `000003`/`000008`/`000012` (audit §11.2), re-keyed to `site_id` and FORCE RLS before any reuse.

| Step | Scope | Can start now? | Depends on | Acceptance |
|---|---|---|---|---|
| Q1 Buyer address coordinates | a platform buyer address book on the D-8 realm, carrying coordinates and their provenance (pin-drop, geocoded, pincode centroid) and precision; a geocoding adapter seam with no vendor wired | **yes** — schema and seam are independent | the geocoding and maps provider (FD-9) before live traffic; address data counts as personal data (retention policy, LB-SEC-012) | a buyer-scoped suite under FORCE RLS; unset GUC → zero rows; buyer A never reads buyer B's addresses |
| Q2 Zones and serviceability | PostGIS (verify the Supabase plan exposes it); zones as circle or polygon on a node; a resolver returning every eligible node, a deterministic ranking and reason codes | **yes**, once PostGIS is confirmed | Q1 for real input; the `instant` vs `quick` vocabulary decision | boundary property tests; an ineligible node cannot be ordered from |
| Q3 Fulfilment node and stock source | nodes over `inventory_locations` with hours, an accepting flag and coordinates; checkout reserves at the node that will pick instead of `ORDER BY is_default` | **yes, for merchant-owned nodes** | Q2; the guarded `create_checkout_order` lineage (every redefinition since 206 is guarded) | concurrency suite: the last unit across storefront and node; the reservation's location is the node chosen |
| Q4 Partner custody | node operated by party X, stock owned by party Y, custody agreements, partner acceptance of transfers, in-transit state | **no** | FD-2, counsel on consignment vs sale, a tenancy decision in the shape of D-PURCHASE-TENANCY (who can read a partner node's stock), ARB | the 20-shirts scenario as an executable suite: receipt recorded by the custodian's membership only |
| Q5 Pick/pack and dispatch events | append-only order and fulfilment events; pick, short and substitute with buyer approval; dispatch offer, accept, expire | pick/pack **after LB-FUL-001 is fixed**; dispatch data model yes | LB-FUL-001; Q3. Store Ops as a mode of `merchant_app` needs no new app; a rider app is a new active surface, which needs a Constitution amendment (`apps/phase_2/*` authorizes no backend) | drills 5 and 6 as suites; an offer accepted exactly once under a race |
| Q6 ETA and capacity | promise = queue + pick + dispatch + travel + buffer, shown only where measured percentiles support it; per-node capacity throttle; zone pause | **no** | Q2, Q3, Q5 and measured timings from a pilot | drill 7; a promised ETA backed by measured p90 |
