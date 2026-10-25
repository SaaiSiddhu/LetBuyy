# Data API and shared cloud architecture

## Canonical deployment boundaries

Keep commerce behavior in services/api-gateway with the existing queue-workers, mobile-bff, identity issuer and webhook satellite roles. Web apps remain thin presentation/composition surfaces. The new proposed Marketplace web and Store Ops web need two additional admitted frontend/hosting targets on the existing hosting direction, not new commerce services. Dedicated Flutter clients do not create backend services. Keep checkout, payments, inventory, catalog, tax and ledger ownership canonical; reserved services stay empty.

Use one RLS/GUC PostgreSQL commerce authority and one region under the current envelope. The shared database can contain separately protected buyer, workforce, seller, inventory and ledger records. “Shared” does not mean each app holds an unrestricted database credential. All business commands go through authenticated, permissioned canonical owners.

## Entity mapping before schema changes

| Concept | Reuse or extension direction | Essential invariant |
| --- | --- | --- |
| Business/site | Existing sites and canonical organisation/membership owners | No rival stores tenant table |
| Person/realm links | Existing issuer and identity foundation | Verified links, separate audiences and privileges |
| Buyer profile/store relationship | Existing buyer_accounts and protected linking owners | No tenant-visible global buyer graph |
| Product/variant | Existing catalog | One identity per owning business/sellable unit |
| Selected channel publication | Existing channel_listings and transition writer | Approval tied to revision and owner |
| Channel offer price | Existing pricing policy/offer owner, extended as needed | Effective version and independent channel override |
| Inventory node | Existing location owner for same-business goods | Exact physical location and current grants |
| Stock/hold/movement | Existing inventory kernel | One allocation authority and reconciled quantities |
| Quick node policy | Scoped location/serviceability extension | Coverage/hours/pauses and revision |
| Assortment | Approved link to canonical seller variants | No parallel Quick product database |
| Fulfillment task/package | Bounded Quick module attached to canonical order | Versioned task and custody transitions |
| Rider offers/assignment | Bounded local-delivery module | Atomic accept, occupancy and current assignment |
| Franchise agreement | Canonical business/contract ownership with scoped node participation | Explicit actual parties, term, version and charges |
| Third-party custody | Additional agreement relationship only if admitted | Owner distinct from operator; no blanket tenant widening |
| Orders/line facts | Existing order writer | Trusted origin, seller, exact allocation and financial snapshot |
| Commercial schedules | Existing commercial/billing/domain owners, completed | Effective rules and immutable accepted order facts |
| COD/payment/refund/settlement | Existing canonical writers | No independent side wallet or cash ledger |
| Advertising/subscription | Existing platform-charge and billing owners | Separate funding and service scope |
| Audit/outbox/receipts | Existing durable conventions | Same-transaction events and payload-bound idempotency |

This is a mapping and contract plan, not permission to create every noun as a new table. Inspect current migrations at implementation time, map existing columns/writers first, and add only the missing owned shape with paired forward/rollback migrations and real RLS. Current numbering must be discovered; the old governance maximum 161 is historical and cannot determine a new filename.

## Command and query contracts

The path names below describe proposed capability boundaries to fit the existing versioned router. They are not claims that those exact endpoints already exist. Reuse existing listing, product, inventory, order, KYC, billing, support and money routes wherever they already supply the behavior.

| Capability | Proposed request essentials | Server result and safety |
| --- | --- | --- |
| List reusable catalog | Authorized business, cursor, channel filters | Paginated canonical products and readiness, no private cross-tenant data |
| Enable selected products on channel | Product/variant IDs, target channel, expected versions, stable key | Per-item durable listing outcomes; import is not approval |
| Update shared product | Canonical schema and expected revision | Conflict-safe edit, applicable review invalidation |
| Update channel offer | Listing revision, effective price/policy | Approved scoped override and audit |
| Resolve Quick address | Validated coordinates/address reference | One trusted node, policy revision and expiry or typed refusal |
| Quote/submit | Basket revision, assignment context, accepted quote, stable intent | Server totals, exact stock binding and recoverable order/payment |
| Ops claim/pick/pack/handover | Order/task/package, expected version, current proof | Legal transition receipt and atomic custody/stock facts |
| Delivery accept/proof/return | Current offer/assignment, bounded evidence, expected version | Current rider authorization and one effect |
| COD report/remit | Canonical collection/remittance request binding | Exact seller/collector amount and checked outcome |
| Fee preview | Trusted product/category/price and current policy | Explainable estimate with schedule version; not a client rate override |
| Operation status | Authorized receipt/intent reference | Durable result recovery without repeating mutation |

List queries paginate and bound filtering. Commands validate through shared schemas and return typed AppError responses. Unexpected failures are logged with redaction and sanitized to clients. No app-local DTO can become an alternative Product, Order or Payment contract. Keep gateway /v1 and existing app proxy conventions aligned.

## Transaction examples

Product channel enablement: resolve live membership → lock/read applicable product/listing versions → validate ownership and selected variants → insert/update listing once → append audit and outbox → commit → return durable receipt. Approval is a separate privileged command.

Quick order creation: validate buyer/context/quote → recheck active node and assortment → lock exact eligible stock in deterministic order → create canonical order/line snapshots/allocations → persist payment intent/receipt/audit/outbox atomically → commit → interact with provider outside database locks. Duplicate outcomes converge on existing capture/refund writers.

Partner receipt: authorize actual custodian/location → bind owner and agreed goods → record accepted/short/damaged quantities → create eligible stock only for accepted saleable goods → audit/event/receipt in the same transaction. A receipt is not payment and a transfer is not automatically a sale.

## Queues caching files and tracking

Outbox delivery can repeat. Deduplicate effects durably, configure bounded retry/dead-letter handling, and alert on age and exhausted work. Cloudflare documents at-least-once delivery semantics; an event catalog is not an event-sourcing platform. [Delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).

Availability and public discovery caches are advisory. Cache keys include the relevant public channel/seller/location/revision. Private customer, KYC, delivery-proof and financial responses require correct authorization and must not enter shared public caches. Use private object storage with short-lived access, actual lifecycle rules and a tested object/key recovery plan.

Begin operational freshness with bounded polling or suitable existing capabilities. If tracking requires an approved transport extension, keep it within existing adapters/runtime admission. Do not assume a new realtime Worker, event bus or geographic infrastructure fleet is required. GPS is ephemeral evidence; PostgreSQL owns assignments, custody and final state.

## Public pricing and actual cloud readiness

At research time the Workers paid account minimum is $5/month, and Supabase Pro advertises a starting price of $25/month. These are public plan entry points, not a combined production quote. Additional environments/projects/compute, Vercel, egress, storage, video, maps, messaging, support, taxes and currency conversion must be budgeted from actual selected resources. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Supabase pricing](https://supabase.com/pricing).

Queues billing uses operations; normal delivery commonly includes write/read/delete, with retry reads adding cost. R2 charges vary with storage class and operations. Video minutes and egress/access pattern can dominate a reel-led app more than order API calls. Build a usage sheet rather than multiplying order count by a guessed cloud cost. [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

| Cost driver | Measure before sizing | Guard |
| --- | --- | --- |
| Gateway/issuer/BFF | Request count, CPU time, bursts, dependencies | Timeouts, limits, abuse controls |
| Database | Connection concurrency, query plans, locks, storage and backups | Pooling, RLS, bounded queries, real restore |
| Queues/jobs | Events/order, retries, backlog age and retention | Durable dedupe, dead letters, alerts |
| Media | Upload/storage/transcode/playback minutes | Quotas, review, retention, signed playback |
| Maps | Address lookup, route and matrix calls | Backend authorization, cache-policy compliance and budget alerts |
| Notifications | Actual provider messages and token lifecycle | Consent, retry limits and delivery evidence |
| Hosting | Actual projects/seats/functions/egress | Environment separation, secret custody and tested promotion |
| Operations | Support hours, moderation, stock/cash exceptions | Human capacity and visible workload |

Read-only owned-cloud inventory remains an implementation prerequisite: exact project/account/environment, domain ownership, deployed SHA/build/schema, queue/storage resources, provider mode and eligibility, backup/restore and secret custody references. No matching private account connector was available in this research. Repository mappings contain both populated IDs and placeholders; neither proves live configuration. Do not expose raw environment values in evidence.

## Schema rollout and recovery

Use expand → backfill → parity verification → contract for real data changes. Preserve financial snapshots and append-only records. Source promotion can be reverted independently of accepted financial facts; after real orders exist, recovery uses forward fixes and compensating entries rather than dropping new order/ledger tables. Keep intake-disable flags separate from existing-order completion, cash close and refunds.
