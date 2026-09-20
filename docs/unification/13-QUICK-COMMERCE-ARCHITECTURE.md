# 13 — Quick Commerce Architecture

Quick commerce is a **new bounded capability inside the S1 core**, designed from AgriMore's schema shapes and product records, gated by serviceability, and never sharing a global stock number with Ecommerce.

## 1. What AgriMore already implements (verified) versus what is new

| Capability | AgriMore state (`Agrimore_Supabase` @ `6a33bf8`) | Reuse |
|---|---|---|
| Dark store entity | `ops.dark_stores(code, location geography(point), service_radius_m, target_sla_seconds, is_active, accepts_orders, version)`; seeded via `seed.sql`; no management API/UI | adapt columns onto `inventory_locations` |
| Zones | `ops.service_zones(polygon geography(polygon,4326))` + GiST index; `store_service_zones(priority)`; no editor; polygons unused by the resolver | adapt schema; build editor |
| Serviceability | `ops.find_serviceable_store(p_location)` = nearest **one** store within its radius, ordered by distance then SLA; Edge `serviceability-check` returns `not_implemented`; checkout falls back to any active store | rewrite resolver |
| Customer address with geo | `app.addresses.location geography(point)` | adopt |
| Node inventory | `commerce.inventory_items` per store; availability = on_hand − reserved − safety | S1 `inventory_levels` already richer; adopt safety semantics |
| Quote | `create_checkout_quote` reserves stock, expiry column; expiry **not scheduled** | adopt as Quick quote; schedule sweeper |
| Quick order lifecycle | `commerce.order_status` enum (draft … picking, packing, ready_for_pickup, rider_assigned, picked_up, arriving, delivered …), `order_status_events`, versioned updates | adopt |
| Store ops | handlers pick / pack / item confirm / ready / queue / picklist; app skeleton | adopt transitions; UI donor |
| Dispatch | `assign-rider` Edge Function: candidate scoring, 45 s offer, `rider_assignments(offer_id UNIQUE, expires_at, score)`, accept path; `logistics.assign_rider`, `transition_delivery(expected_version)`; **no re-offer on expiry** | adopt tables and semantics; add sweeper |
| Rider presence / live location | realtime Worker: heartbeat → Redis `rider:presence`, `rider:geo:<city>`; `delivery:live` hash with TTL; Durable Object rooms; `rider.location_updated` broadcast; channel authorisation by role | adopt pattern in S1 realtime Worker |
| Proof of delivery | signed proof upload via media-gateway | adopt in S1 media |
| ETA | static `target_sla_seconds`; quote-time heuristic | replace with prep-time + routing adapter |
| Customer tracking UI | rebuilt app: status text + ETA (159 lines); archived Firebase app: Google Maps markers/polylines | rebuild map UI in the unified app |

## 2. Serviceability

```text
Customer delivery address (lat/lng; from platform address book)
   ↓ zones: circle (node point + radius, boundary inclusive, geographic distance) or polygon (PostGIS geography)
   ↓ node ↔ zone links (a node may serve several zones; a zone may be served by several nodes)
   ↓ filter: node.accepts_orders, within hours, capacity not exhausted, stock freshness within threshold
   ↓ rank deterministically: open & accepting → freshness → predicted prep + travel → distance → lowest id
   ↓ return EVERY eligible node with state and an explanation; recommend one; customer chooses
   ↓ persist chosen node on the Quick basket; re-validate at quote and at order commit
Not eligible ⇒ Quick tab hidden/disabled with a clear reason; discovery may still show nodes as "not available at your address".
```

Schema (new, all tenant/platform boundaries explicit): `service_zones(id, owner ∈ platform|site, kind ∈ circle|polygon, geom geography, radius_m, is_active, revision)`, `node_zones(node_id, zone_id, priority)`, node columns on `inventory_locations` (`kind`, `operator_party`, `geom`, `hours jsonb`, `capacity`, `accepts_orders`, `sla_seconds`). PostGIS enabled by migration. A zone editor lives in the operator console (draw/enter radius, preview neighbours, test addresses, activate with audit).

## 3. Fulfilment nodes and partner supermarkets

One entity, four kinds: `merchant_location` (own store), `dark_store` (LetBuyy-operated), `partner_store` (supermarket/grocery operated by a partner), `hub`. Custody: `custody_agreements(owner_site_id, node_id, terms jsonb, storage_eligibility, fee_terms, loss_policy, status)`; stock rows keep the owning `site_id`; operations at the node require a `location_membership`. Transfers to a partner node go through `reserved → in_transit → partially_received/received` with acceptance recorded by the custodian's membership, short and damaged quantities per line, quarantine as a distinct state. The customer sees "LetBuyy Quick · in partnership with ABC Supermarket"; the transaction is a LetBuyy purchase.

## 4. Node inventory and availability

Per node: `available_to_promise = available − active_reservations − safety_stock`. Quick reserves at **quote** (expiring), consumes at **confirm**; Ecommerce keeps its order-time reserve+commit. Caches (feed, search) never authorise; quote and commit re-read. External partner tills: if a partner also sells offline, either every till captures sales (POS mode) or a feed with source identity, observation time, dedupe and freshness bound exists — until then shared inventory at that partner is not promised (Agrimore ADR-0006 §6, adopted).

## 5. Quick order flow

```text
Quick basket (node-bound) → quote (server totals incl. node price, delivery fee, promotion, ETA; reservation held; expires)
 → payment (Razorpay / policy) → confirm (guarded create_checkout_order lineage, channel=quick, fulfilment_type=dark_store|partner_store)
 → node accept/decline within deadline (timeout ⇒ release + refund + notify)
 → picking → packing → ready_for_pickup
 → dispatch: candidates (presence + geo + shift) → offer (expires) → accept (atomic) | reject/expire ⇒ re-offer ⇒ escalate
 → rider arriving_at_store → picked_up (handover verification) → arriving_at_customer (live location) → delivered (proof) | failed → return to node
```

State machines in [14](./14-ORDER-FULFILMENT-ARCHITECTURE.md). Every transition: membership check, expected version, status history row, outbox event.

## 6. Dispatch and riders

Tables (adapted from S3 `logistics`): `rider_profiles(principal_id, city/zone scope, status ∈ offline/available/assigned/on_trip/paused/blocked, is_verified)`, `rider_shifts`, `delivery_tasks(order_id, node_id, rider_id, status, pickup_geom, drop_geom, version, timestamps)`, `delivery_offers(task_id, rider_id, offer_id UNIQUE, status ∈ offered/accepted/rejected/expired/cancelled, score, expires_at)`, `delivery_status_events`, `dispatch_attempts`. RPCs: `offer_delivery`, `accept_delivery_offer` (atomic; second acceptor gets a typed conflict), `transition_delivery(expected_version)`. Sweeper (queue-workers cron, minute-level for Quick): expire offers, re-offer, escalate; expire quotes. Earnings: posted to the ledger per completed task (account types per founder decisions), never a mutable wallet.

## 7. Realtime

A realtime Worker in S1 (new; pattern from S3): WebSocket rooms per delivery/order in a Durable Object; rider heartbeats (lat/lng, status) into KV/Redis with TTL and a geo index; `rider.location_updated`, `delivery.status_changed`, `order.status_changed` events fanned to authorised subscribers only (buyer of that order, assigned rider, node members, operators). Postgres remains the authority; ephemeral state is disposable. Merchant order queue and operator live-ops read the same rooms.

## 8. Search and discovery in Quick

Node-scoped queries join `node_offers` and `inventory_levels` so results respect local stock and price; ranking within a node by relevance then availability; the marketplace (Ecommerce) index stays merchant-scoped. FTS first; Typesense only on measured need.

## 9. What the merchant sees

Nodes enrolled in Quick, zones served, hours and capacity, SLA and fill-rate metrics, Quick order queue (Store Ops mode), stock by node, transfers to dark/partner stores with acceptance status.

## 10. What the operator sees

Zone editor, node registry (all kinds), partner agreements, rider roster and verification, live operations map, exceptions (no acceptance, no rider, stale feed), overrides with reason and audit.

## 11. Explicit non-goals for the first Quick release

Split-node Quick orders, substitutions and weighted goods, offline Quick ordering, cross-city dispatch, automated partner onboarding, surge pricing.
