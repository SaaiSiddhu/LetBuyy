# Letbuyy unified commerce — independent codebase review

Date: 19 September 2026  
Author: Codex  
Purpose: independent assessment and recommended direction, not a replacement product decision record.

## 1. My conclusion

**Use Letbuyy as the foundation for the combined platform. Preserve its store-builder and commerce core, repair the identified trust/payment boundaries, and extend it with location-aware physical commerce. Do not merge two authoritative order, inventory, identity or money backends.**

The founder's description of a substantial foundation is supported by source and by fresh local tests. Letbuyy contains meaningful implementations of storefront publishing, merchant management, channel listings, inventory transactions, checkout idempotency and ledger accounting. It is substantially more than a collection of screens.

That does not establish that the complete proposed platform works today. Quick-commerce eligibility, partner custody, location/channel pricing, local delivery orchestration and adaptive native POS remain significant new work. Customer identity and application migration also remain unfinished.

The supplied Claude reports are useful component inventories. I agree with their broad reuse recommendation, but would not adopt their deployment verdict or several security/payment conclusions unchanged. This review found additional failure paths and reproduced some directly.

The correct current position is:

- **Founder-confirmed:** Cloudflare backend and Supabase database deployments exist in staging and production; the founder identifies `staging` and `main` as their respective deployment branches.
- **Inspected source:** the locally available `staging` and `main` refs point to an older snapshot than `develop`.
- **Reproduced locally:** selected tests pass on `develop`; several adverse behaviours also reproduce in isolated fixtures.
- **Unknown:** the exact remotely deployed revisions, applied migrations, environment bindings, current operational health and real-user journey coverage. No cloud account inspection was completed.

Do not flatten these four statements into either “nothing exists” or “everything is production-ready.”

## 2. Scope, snapshots and limitations

### Repositories and evidence

| Input | Snapshot / treatment |
|---|---|
| Letbuyy workspace | `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, HEAD `823aa5ee1aa0d8acf35d711b7f24b49a0b332761`, with substantial pre-existing changes. Read-only. |
| Letbuyy integration worktree | `/Users/saai_siddharth/Projects/Start_Up/LetBuyy-develop`, `develop` at `bda7f7f846f786bf2a99ecdd6623ada807befc32`. Primary implementation snapshot; clean before and after checks. |
| Local deployment branch refs | `staging` and `main` both at `823aa5ee`; `git rev-list --left-right --count main...develop` returned `0 611`. These are local refs, not independently refreshed remote refs. |
| Supplied reports | Both documents under `LetBuyy/docs/evidence/audits/2026-09-19-unified-commerce/` were read in full. Their runtime results were treated as historical evidence until independently rerun. |
| Agrimore | Current product records and the previously inspected implementation supplied physical-commerce requirements and comparison context. This turn did not independently re-audit every Agrimore component. |

This was a **whole-repository inventory plus risk-driven source review**, not an assertion that every line in every application was manually inspected. Active apps, services, packages, migration history, contracts, provider adapters, key UI integrations and deployment descriptors were inventoried. Critical paths were traced into their callers and SQL functions.

Fresh tests ran only locally. Three uniquely named disposable Postgres containers were created and removed by the repository's existing runner. Existing local databases, staging and production were not touched. No real provider payments, refunds, messages or payouts were sent.

No application source, migration, dependency, environment variable, workflow or decision record was changed. This report is saved in the shared Agrimore workspace; both Letbuyy checkouts remain unmodified by this review.

### What the branch difference means

The `main` tree contains 142 migration files; `develop` contains 175. There are 33 migration-file differences between those refs. Do not assume the deployed databases contain the newer schema because tests on `develop` passed.

Conversely, several important inspected files are identical on local `main` and `develop`: the staff-permission guard, Admin login route, Razorpay adapter, webhook service entry point and gateway Wrangler configuration. Their defects are not confined to newly added integration code. Deployment exposure still depends on the actual deployed revision and enabled paths.

The `develop` deployment workflows are manually dispatched. Manual dispatch and placeholder configuration in a repository are not proof that an environment does not exist: deployments can predate the file, use secrets or be performed through another configured path.

## 3. Corrections to the supplied reports

| Supplied conclusion | My assessment |
|---|---|
| “Nothing is deployed,” “no database exists,” therefore no canonical live data | Unsupported and contradicted by the founder's current statement. A historical D-11 note plus absent cloud access cannot establish absence. Treat live data as unknown and preserve it until inspected. |
| Newer `develop` evidence describes Letbuyy generally | Pin it to `develop`. Establish deployed SHAs and applied migration versions before extending the claim to staging/production. |
| “0 service-role bypasses” demonstrates a database-backed request boundary everywhere | The validator measures use of an application query guard. The guarded client still uses `SUPABASE_SERVICE_ROLE_KEY`; many routes do not use the pooled `SET LOCAL ROLE app_tenant` path. These are different controls. |
| Staff permissions become safe by setting `enforce` | Incomplete. Missing context and caught setup/lookup exceptions return `block:false` even in enforce mode. Reproduced locally. |
| Payment verification chain is complete | Authenticity checks exist, but the checkout adapter equates a valid signature with `paid` without reading provider capture state. The route then posts payment confirmation. |
| Refund completion defect exists only in the provider adapter | It exists in both the adapter and the `refund.created` webhook route. Both need a coherent lifecycle fix. |
| Webhook uniqueness establishes reliable processing | It prevents some repeat inserts, but a failed first processing attempt is skipped on retry. Refund fallback event IDs are also unstable for payloads without a top-level ID. |
| Payment confirmation has no cancelled/refunded guard | The wrapper calls `confirm_order_payment`, which does reject cancelled/refunded orders. The narrower late-payment concern remains: released inventory is not covered by that status guard. |
| No maps/geocoding anywhere in Letbuyy | Too broad. The legacy customer Flutter app contains Google Maps, geolocation and address-map code. The canonical SQL/gateway lacks the required serviceability model. |
| Production Admin login failure guarantees an empty marketplace | The normal login route is blocked, but approved migration/import paths exist. New moderation operations are blocked; feed emptiness cannot be inferred universally. |
| Alternative frontends sharing commerce APIs necessarily create two authorities | Incorrect as a general claim. Several frontends can use one canonical API and database. The unsafe pattern is duplicate writers/truth, not multiple clients. |
| Physical custody requires the platform to custody money | Those are separate design questions. Merchandise can be held by a partner while money movement follows an agreed provider arrangement. The actual funds flow still needs explicit commercial/professional review. |
| Native Admin should default back to web until re-decided | Your latest direction already asks for native Windows/macOS Admin and POS. Older Letbuyy documents need reconciliation; they should not silently cancel that direction. Existing web Admin can remain transitional. |
| POS is later expansion after the combined pilot | That sequence cannot support a shared-stock pilot unless all counter sales are captured through another verified integration. POS or a proven external-till feed belongs on that pilot's dependency path. |

The report's recommendation to use clothing first is an option, not an evidence-backed universal winner. Clothing adds variant/exchange complexity; packaged supermarket goods may better match the first partner. Choose the first complete domain from the real pilot operation.

## 4. What is worth preserving

| Capability | Evidence and assessment | Reuse decision |
|---|---|---|
| Store builder | Theme editor/publish/preview/release rollback routes; Liquid renderer with sanitisation; custom-domain verification and host routing. Inspected source, no fresh browser journey. | Preserve. Verify end-to-end publishing before large changes. |
| Merchant web/mobile | Broad product, inventory, location, order, shipping, staff and theme functionality. Merchant Flutter uses the canonical API client. | Preserve the application investment; extend its location/channel controls. |
| Catalogue | Products, variants, SKU/barcode fields, collections, tax metadata and product snapshots. | Preserve; add unambiguous scan mapping and location/channel offer rules. |
| Inventory | Reservation/commit/release, same-tenant transfers and receipts, adjustments and order allocation. Fresh concurrent checkout tests passed. | Preserve the transaction core; extend custody, allocation and operational states. |
| Checkout | Server-side item pricing, advisory locking, parent-purchase/child-order schema and idempotent paths. | Preserve, while fixing payment lifecycle gaps and adding rapid-delivery quotes. |
| Ledger | Balance enforcement and immutable-entry triggers; fresh composite ledger test passed. | Preserve. Expand account/event rules rather than introducing another ledger. |
| Tenant isolation | Explicit `app_tenant` transaction path and FORCE RLS model; fresh tenant red-team suite passed. | Preserve and complete actual request-path coverage. |
| Identity issuer | Merchant and buyer asymmetric token issuance with distinct audiences. | Preserve as the convergence target; finish customer migration and scoped workforce access. |
| Marketplace listings | Channel listings, moderation transition RPC and feed model. | Preserve; distinguish listing publication from eligible local fulfilment. |
| Provider/media/notifications | Existing Razorpay, R2, email, messaging and push adapters. | Reuse interfaces selectively; validate each real mode and failure path. |

Useful source anchors: `services/api-gateway/src/routes/themes.ts:630`, `packages/theme-engine/src/theme-renderer.ts:301`, `services/api-gateway/src/routes/channel-listings.ts:106`, `database/supabase/migrations/217_marketplace_channel_listings.sql:425`, and migrations 139, 141, 166, 168, 216, 219, 223, 234 and 246 in the integration worktree.

“Preserve” does not mean “reuse without testing.” It means there is evidence for completing the current implementation instead of starting over.

## 5. Priority findings: existing commerce correctness

### LB-CX-01 — Staff permission enforcement fails open

**Priority:** high; close before relying on staff/cashier/picker restrictions.  
**Evidence:** inspected source and reproduced locally in a fixture; not a demonstrated deployed exploit.

`services/api-gateway/src/middleware/staff-permission.ts:46` defaults to `dryrun`. More significantly, `evaluateStaffRequest` returns `block:false` when site/user context is missing and from its catch block.

Fresh probe with `MERCHANT_STAFF_RBAC_MODE=enforce` returned:

```text
missing_context    { block: false }
lookup_setup_error { block: false }
```

A database/credential/setup error is not authorisation. Existing outer ownership checks can limit exposure on specific routes, so this is not proof that any anonymous caller can change anything. It is proof that the staff capability layer cannot be trusted as an enforce-mode boundary.

**Required outcome:** verified owners bypass appropriately; non-owners require explicit active permissions; missing identity and lookup failures deny protected mutations. Test actual routes with read-only staff, suspended staff, foreign stores and failed lookups.

### LB-CX-02 — Application query guard is not equivalent to RLS enforcement

**Priority:** high architectural/security verification gap.  
**Evidence:** inspected source; separate database-role tests passed.

The chain is explicit:

```text
getSupabaseAdmin
  → createTenantGuardedSupabaseClient
  → createSupabaseServiceClient
  → SUPABASE_SERVICE_ROLE_KEY
```

See `services/api-gateway/src/lib/supabase.ts:14`, `packages/infrastructure/supabase-adapter/index.ts:34` and `services/api-gateway/src/tenant/tenant-scoped.ts:113`.

The query wrapper checks that certain scope-column names occur in query-builder calls. It does not establish database session identity, prove the column value belongs to the actor, or wrap RPC execution in the pooled tenant transaction. Its `.rpc` access passes through.

By contrast, `services/api-gateway/src/lib/tenant-transaction.ts:16` starts a pooled transaction, sets the `app_tenant` role and sets tenant context. Channel-listing handlers use this path. Numerous other handlers use the guarded service client.

The validator explicitly expects that service-client wrapper. A green result therefore means the wrapper conventions passed, not that privileged database credentials disappeared. PostgreSQL documents that superusers and `BYPASSRLS` roles bypass row security even when table-owner forcing is used: [PostgreSQL row-security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

**Required outcome:** a route-to-database execution matrix identifying actual DB role, tenant context, ownership checks and function privileges. Prove critical HTTP paths under the intended role. Retain narrow privileged cross-tenant operations where justified; do not mechanically remove every service operation.

### LB-CX-03 — Signature authenticity is being treated as captured payment

**Priority:** high money-state defect candidate; provider sandbox scenario required.  
**Evidence:** inspected source and adapter fixture reproduction.

`packages/infrastructure/razorpay-adapter/index.ts:323` verifies a signature and returns `status:'paid'`. It does not fetch payment status. The storefront verification route then calls `confirmPayment`, ultimately recording a captured transaction and ledger posting.

Fresh probe using synthetic signing material returned:

```json
{"case":"signature_only","verified":true,"status":"paid","providerReads":0}
```

This proves the adapter decision, not that a real uncaptured payment has been accepted in production. The live impact depends on provider capture configuration and timing. A signature proves authenticity of the callback references; authorisation/capture state must remain explicit. Razorpay distinguishes authorisation and capture in its [payment integration documentation](https://razorpay.com/docs/payments/server-integration/dot-net/integration-steps/).

**Required outcome:** mark orders paid from verified capture evidence with the expected provider account, order, amount and currency. Test delayed capture and authorisation-only callbacks. Keep the customer-facing pending state honest.

### LB-CX-04 — Refund initiation is treated as completion in two places

**Priority:** high; repair before trusting financial reconciliation.  
**Evidence:** inspected source and adapter fixture reproduction.

`packages/infrastructure/razorpay-adapter/index.ts:413` considers both `created` and `processed` refunded. A synthetic provider response with `status:'created'` produced local `status:'refunded'`.

The webhook handler at `services/webhook-service/src/index.ts:813` also handles `refund.created` by calling `markOrderRefunded` for a full amount, which records refunded order/payment state and may restore stock. A missing/zero amount falls through its full-refund branch as well; malformed amounts should not be interpreted as full completion.

**Required outcome:** separate requested/pending/processed/failed refunds, preserve provider references, and decide stock disposition independently of cash-return timing. A financial refund does not by itself prove goods have physically returned in sellable condition. Test full/partial refunds, failures, duplicate events and returned damaged/perishable stock.

### LB-CX-05 — A failed webhook attempt is acknowledged as a duplicate on retry

**Priority:** high payment reliability defect.  
**Evidence:** reproduced locally through the real Hono handler with stubbed I/O; not a deployed/provider integration test.

`writeWebhookEvent` inserts with ignore-duplicates semantics. If later processing fails, the row is marked failed. The retry inserts nothing, then returns HTTP 200 as a duplicate without examining processing state.

Fresh fixture result:

```text
Delivery 1: HTTP 500, simulated transient gateway outage, mutation attempts = 1
Delivery 2: HTTP 200, duplicate:true, mutation attempts = 1
```

The second delivery never retried the business operation. A durable replay/reconciliation path might eventually repair it, but that recovery is not established by this handler. No matching automatic failed-payment-event consumer was established in the inspected queue-worker paths.

**Required outcome:** distinguish received, processing, failed and processed; acknowledge a successfully completed duplicate, but retry/requeue unfinished work with an atomic claim and idempotent downstream mutations. Prove crash-after-insert and crash-after-business-commit recovery.

### LB-CX-06 — Refund webhook fallback identity is unstable

**Priority:** high reliability/idempotency gap.  
**Evidence:** reproduced locally in the real adapter with signed fixture bodies.

`webhookVerify` derives event identity from top-level ID, payment/order entity IDs, or receipt time. It does not use the supplied `x-razorpay-event-id` header, and it does not include the refund entity ID in the fallback.

For the same refund payload and event header, two receipt times generated:

```text
refund.created:2026-09-19T00:00:00Z
refund.created:2026-09-19T00:01:00Z
```

The service prefers that adapter ID, so its separate refund-ID fallback does not repair this case.

**Required outcome:** a stable provider-event identity plus business-operation uniqueness on provider refund/payment references. Validate header handling against the provider contract; never make successful processing depend only on an attacker-controlled identifier.

### LB-CX-07 — Late capture can follow inventory release

**Priority:** high; exact scenario needs a dedicated database/integration regression test.  
**Evidence:** inspected complete relevant call chain, not reproduced in this audit.

Migration 211 releases committed stock on unpaid orders after the configured grace period. Migration 246 sets `inventory_released_at` but does not cancel the order as part of that release. The payment-confirmation wrapper calls the baseline `confirm_order_payment` function, whose status guard rejects cancelled/refunded orders but does not check `inventory_released_at`.

Thus the supplied report was wrong to omit the existing cancelled/refunded guard, but right to identify the released-stock race as a concern.

**Required outcome:** serialise payment/expiry decisions around the order/allocation. Late genuine money must be recorded truthfully and either reallocated safely or moved into an explicit compensation/refund exception. Merely rejecting the callback without recording the provider capture is insufficient.

### LB-CX-08 — Reservation cleanup cadence is unsuitable for a rapid-delivery promise

**Priority:** launch blocker for quick-commerce availability; operational tuning for existing commerce.  
**Evidence:** inspected configuration and worker handler.

The worker's default unpaid grace is 1,800 seconds, but the declared cron is `17 */6 * * *`. The scheduled handler runs the inventory sweeper once per invocation with a bounded batch; this is not a 30-minute release guarantee. Backlogs can increase delay further.

**Required outcome:** cadence, batch draining, lag metrics and alerts tied to the actual promise; distinct jobs if needed. Do not simply schedule every unrelated six-hour job every minute. Verify deployed triggers before attributing this local configuration to production.

### LB-CX-09 — Production-mode operator login deliberately refuses access

**Priority:** high operational blocker for the normal console login path.  
**Evidence:** inspected source, identical in local `main` and `develop`.

`apps/admin_web/src/app/api/console-auth/login/route.ts:35` returns `magic_link_delivery_not_configured` whenever `NODE_ENV === 'production'`.

**Required outcome:** a real operator identity flow with the right capabilities, session controls and high-risk-action checks. Preserve existing web operations as a transition surface while native Admin is built. Do not infer that previously approved catalog rows cannot exist.

## 6. Domain readiness for the combined product

### Store builder

This is the strongest reason not to rebuild Letbuyy. Publishing, theme releases, previews, rollback, merchant storefront routing and custom-domain code are substantive. Preserve the builder as a product capability inside the larger platform.

The Liquid rollout is environment-specific: gateway configuration sets `FEATURE_LIQUID=true` for default/staging and `false` for production. The supplied blanket “default off” description loses this distinction. Runtime activation also depends on renderer selection and deployed configuration, so source flags do not establish what customers see.

Next proof: merchant creates a product, edits/publishes a store, buys it through the resolved hostname and rolls back a theme release without cross-tenant leakage.

### Marketplace and unified buyer identity

The marketplace is not absent: channel listings, moderation, categories, feed routes and buyer-account linkage exist. But one shared customer experience is not finished merely because those tables exist.

There are platform buyer sessions, legacy store-customer sessions and Firebase-backed mobile flows. The customer Flutter app still imports Firebase Auth/Firestore in numerous files while its marketplace reads begin using the canonical API. This is a transition, not completed identity convergence.

Preserve account links and merchant isolation. Do not merge accounts by matching an unverified email alone. Inventory carts, orders, addresses, consent and recovery requirements before retiring a legacy identity. The report's “no canonical live data” assumption is not safe enough to justify deletion.

### Merchant organisation and branches

Letbuyy already supports multiple inventory locations within a merchant site. Therefore “multi-location equals multi-site” is too broad. The actual gap is a completed organisation/branch model and explicit access across independently operated fulfilment locations.

The organisation tables in migration 159 are a starting point, not proof that the operating workflows use them. Define the relationship between a business organisation, storefront/site, branch, inventory location and user membership before building new roles.

### Products, offers and prices

Preserve merchant product and variant records. Add the missing offer dimension rather than forcing every channel to use `products.price`.

Recommended conceptual split:

```text
Product/variant identity
  → merchant's listing
  → channel/location offer and effective price
  → stock allocation at a physical location
  → immutable order-line/receipt snapshot
```

This is a recommendation, not a prescribed migration schema. A platform-wide product identity can be introduced only where it helps deduplication and merchandising; it should not require an enormous catalogue merge before merchants can operate.

`pricing_policy` is stored on channel listings but was not found applied to the current feed/checkout price. Barcode/variant uniqueness needs an explicit business scope and database enforcement before POS; do not require globally unique merchant SKUs across unrelated businesses.

Tax already computed in a trusted server layer is not automatically a client-tampering vulnerability. The RPC accepts server-provided tax inputs, so the next step is to validate caller privileges and a consistent tax contract for all channels, rather than blindly duplicating calculation in SQL.

### Physical custody and transfers

Same-site inventory transfers and partial receiving exist. The missing capability is representing another organisation operating a location while the original merchant retains stock ownership.

For 20 shirts with five moved to a partner:

1. Source initially has 20 sellable units.
2. Five allocated to transfer become unavailable to new source sales.
3. Dispatch records five in transit; they are not sellable at the destination yet.
4. Partner staff receive and accept actual quantities, including shortage/damage.
5. Source has 15; partner holds five on behalf of that merchant.
6. Quick-commerce and counter sales allocate from the correct owner/product/location stock record.
7. Returns, loss and reconciliation follow the custody agreement.

At a shared fulfilment location, stock must be partitioned by owner/product/variant and relevant lot/condition—not just one quantity per location. Custodian access must not expose the merchant's entire customer list or financial history.

### Serviceability and quick commerce

The canonical migration set lacks the geographic serviceability required for circles, polygons and overlaps. The legacy app's map picker is useful UI work but does not authorise rapid-delivery orders.

Add location coordinates, coverage versions, hours, accepting/capacity state, address validation, offer eligibility and checkout-time revalidation. Return all eligible stores and deterministic explanations; keep unavailable discovery separate from order eligibility.

Use Agrimore's geographic and dispatch designs as inputs. Re-express them under Letbuyy's identity, tenancy and transactions. Do not deploy an additional Agrimore gateway as another commerce authority.

### Store Ops, riders and Sales Associate

Existing parcel fulfilment is not equivalent to local pick/pack/handover and rider offers. The donor Store Ops/Rider code has useful screens and domain concepts, but its API contracts do not establish a working Letbuyy backend.

Keep one merchant product with capability-based modules. Focused Store Ops and Rider experiences may still be separate clients on the same backend. Decide packaging from device/workflow needs rather than whether a user belongs to a merchant or partner; a separate app is not itself an authorisation boundary.

Sales Associate remains new work: leads, visits, onboarding assistance, verified activation, tasks and incentive events. Backup delivery must reuse the canonical rider assignment and payment rules after primary delivery stabilises.

### Adaptive native POS

POS is new development. Existing merchant barcode-scanning widgets and stock/return primitives are reusable, but there is no complete counter-sale, terminal, shift, cash, receipt/peripheral and native distribution product.

Build a common sales/stock/payment/receipt core with explicit domain capabilities:

| Domain | Additional rules |
|---|---|
| Clothing | Variant-level scanning, size/colour, exchange and price-difference tender |
| Supermarket | High-throughput scanning, batch/expiry where needed, promotion rules; weights later only with complete handling |
| Bakery | Production/receiving batches, freshness, wastage and preorder/pickup timing |

Keep native Windows/macOS POS and Admin as the founder's target. Start generated contracts and native build shells early. Choose actual peripheral candidates early, validate on hardware later. Recommend online finalisation and offline drafts initially; offline completed sales require a separate allocation and reconciliation design.

## 7. Proposed architecture

```text
Storefronts / Marketplace / Quick-commerce customer experience
Merchant web/mobile / Native POS / Store Ops / Rider / Native Admin / Sales Associate
                               │
                  One identity and contract boundary
                               │
                Letbuyy modular commerce API
       catalog · offers · stock · checkout · money · fulfilment
             serviceability · custody · dispatch · POS
                               │
                One authoritative Postgres model
                     transactional outbox
                               │
           Existing worker jobs / provider adapters / media
```

“One backend” means one authority for each domain. It does not require one UI, one customer basket for every mode, or one credential usable for all roles.

Keep Letbuyy's ledger, checkout and inventory implementations as the base. Use Agrimore to accelerate requirements, state-machine design and suitable client workflows. Preserve data and test invariants during integration; copying SQL between schemas is not integration.

Separate baskets by fulfilment mode is my recommended first delivery model: standard commerce can retain the parent/child model, and rapid delivery uses a selected location. Do not introduce automatic mixed-cart splitting as a hidden implementation choice. A parent table alone does not prove multi-merchant capture/refund allocation works.

## 8. Decisions that need reconciliation

| Topic | My recommendation / unresolved point |
|---|---|
| Letbuyy as base | Strongly supported. Preserve a single authoritative commerce backend. |
| Native Admin/POS | Retain latest founder direction; reconcile older web-only Admin documentation. Web Admin is a transition option, not an automatic permanent replacement. |
| Zero transaction fees versus Agrimore commission proposals | Keep the existing zero-fee implementation unchanged until a unified commercial decision is made. Prior illustrative commission rates are not approval. Distinguish subscriptions, delivery/fulfilment service charges and transaction commissions explicitly. |
| Physical versus financial custody | Model physical custody now; resolve who sells, invoices and receives payment before finalising money movement. Do not conflate the two kinds of custody. |
| Customer carts | Recommend explicit mode/location baskets initially; confirm product behaviour before mixed-checkout implementation. |
| First POS domain | Select from the actual pilot merchant and assortment; clothing and fixed-unit grocery each have tradeoffs. |
| All tills versus external POS | A prerequisite to a shared-stock guarantee. If Agrimore/Letbuyy POS is not used at every relevant till, a proven external feed/allocation policy is required. |
| Deployment source | Founder says staging/main. Confirm remote refs, deployment revisions and database migration versions read-only before promotion or migration work. |
| Legacy data | Assume valuable data may exist until inventoried. Rehearse migration and recovery; do not infer zero users from old documents. |

These decisions do not block repairing webhook retries, refund semantics, staff enforcement or documenting actual deployment versions. Do not require every business question to be answered before independent correctness work starts.

## 9. Recommended implementation sequence

### A. Establish the real baseline and preserve existing value

- Read-only inventory of Cloudflare/Supabase staging and production: deployed commit/build, project/database, applied migration versions, binding separation and active scheduled jobs.
- Reconcile local `develop`, local deployment refs and remote history. Record a promotion path; do not automatically push or merge 611 commits.
- Verify backup availability and a restoration rehearsal before schema/data migration.
- Run one actual staging store-builder purchase journey with appropriate test users and provider sandbox settings.
- Correct outdated deployment/data assumptions in active records after evidence is obtained.

**Acceptance:** every test result is attached to the correct code/database/environment; no claims that integration-branch behaviour is already deployed.

### B. Close existing commerce correctness gaps

- Staff fail-closed semantics and route-level capability tests.
- Database access-path inventory and critical HTTP tenant isolation tests.
- Production operator login and appropriate privileged action controls.
- Capture-aware verification, refund lifecycle, stable webhook identity and failed-event retry.
- Atomic late-payment versus stock-release handling and tested reconciliation.
- Appropriate inventory expiry cadence and monitored backlog.

**Acceptance:** adverse payment/permission scenarios reproduce first, then pass regression tests through actual boundaries; retries never lose or duplicate money/stock effects.

### C. Define shared physical-commerce contracts

- Organisation/site/branch/location relationships and location capabilities.
- Product ownership, custody, transfers and receiving.
- Location/channel offers and price snapshots.
- Generated API contracts for Dart, TypeScript, C# and Swift.
- Native Admin/POS build shells and per-app design reference screens.

**Acceptance:** one merchant and one independent custodian can perform the 20-shirts scenario with correct visibility and immutable movement history.

### D. Prove shared counter and online inventory

- A minimal but complete POS domain: terminals, cashier, sale, tender, receipt/reprint, shift and return.
- One selected retail-domain module with actual barcode and hardware validation.
- Concurrent storefront/POS/rapid-delivery allocations against the same stock records.
- If using external tills temporarily, demonstrate equivalent captured sale/return feeds and their freshness policy.

**Acceptance:** last-unit races, lost responses, duplicate tender callbacks, receipt failures and returns reconcile once. Both native platform tracks remain in scope even if one is used for the first internal device proof.

### E. Add rapid-delivery operations

- Geographic coverage/overlap selection and eligible offers.
- Expiring location-bound quote and reservation.
- Partner acceptance, picking, packing and verified handover.
- Rider offers, expiry/re-offer, delivery proof and participant-only tracking.
- Fulfilment charges/earnings and partner statement rules once approved.

**Acceptance:** an order completes from an eligible address through correct stock, money, fulfilment and exception outcomes; the storefront/POS paths remain correct.

### F. Complete customer convergence and operating surfaces

- Identity/account migration, addresses, cart/order history and customer app cutover.
- Merchant portal and focused Store Ops workflows.
- Native Admin on both desktop platforms, with transitional web retirement based on feature coverage.
- Sales Associate core workflows and conditional backup delivery.
- Per-app accessibility, localisation, states and device/distribution validation.

### G. Controlled commercial pilot

- Named partner and staff; captured counter sales; agreed assortment/hours/capacity.
- Provider-confirmed payment/refund/reconciliation, no unexplained stock/ledger differences.
- Alert receipt, restore and rollback evidence; support ownership.
- Realistic pilot-load and contention tests before increasing traffic.

Do not put all performance verification after a money-bearing pilot. Early tests should reflect the expected initial workload; larger-scale tests follow measured demand.

## 10. Fresh verification performed

All successful implementation checks below used the clean `develop` snapshot specified above.

| Check | Fresh result | What it establishes / does not establish |
|---|---|---|
| `pnpm test:contracts` | Exit 0; 277 passed, 0 failed | Repository contracts. Not a running customer journey. |
| `node --import tsx --test services/api-gateway/src/__tests__/*.test.ts` | Exit 0; 962 total, 953 passed, 9 skipped, 0 failed | Gateway test lane; mocked/in-process boundaries remain mocked. |
| `pnpm --filter @letbuyy/api-gateway typecheck` | Exit 0 | Gateway type consistency only. |
| Executable `checkout-order-concurrency` | Exit 0; 5 assertions passed | Real concurrent Postgres operations in a disposable container. The test file explicitly uses a superuser for this suite; it does not prove request-role RLS. |
| Executable `tenant-redteam` | Exit 0; 2 composite assertions passed | Real database role/isolation tests, separately from checkout concurrency. Not all HTTP routes. |
| Executable `money-ledger` | Exit 0; 1 composite assertion passed | Selected ledger invariants on real disposable Postgres. Not provider reconciliation. |
| Staff guard failure fixtures | `enforce` still returned `block:false` | Local guard behaviour, no live attack. |
| Signature-only fixture | `verified:true`, `status:paid`, 0 provider reads | Adapter state decision with synthetic signature; no provider payment made. |
| Refund-created fixture | Local status `refunded` | Adapter mapping with stubbed provider response. |
| Failed webhook redelivery fixture | First 500; second 200 duplicate; only one mutation attempt | Actual handler with fake database/network responses. Shows handler retry logic, not deployed integration. |
| Refund identity fixture | Same body/header gave different IDs at two receipt times | Adapter fallback identity behaviour. |
| Public health URL attempt | Web tool could not access staging/production health URLs | No conclusion about service uptime. |

The ordinary `tsx` launcher initially hit a sandbox IPC restriction. The gateway lane ran through Node's TS loader. A direct-loader contract attempt produced four module-resolution failures and 263 passes; the exact repository `pnpm test:contracts` command was then rerun with the IPC permission and passed all 277. This was a harness/environment distinction, not a code fix.

Docker socket access initially required permission. The successful SQL tests used the inspected repository runner with fresh uniquely named containers and automatic cleanup. No existing database was reset.

SQL commands:

```sh
node scripts/governance/run-executable-suites.mjs --filter checkout-order-concurrency --timeout 180
node scripts/governance/run-executable-suites.mjs --filter tenant-redteam --timeout 180
node scripts/governance/run-executable-suites.mjs --filter money-ledger --timeout 180
```

Not rerun: full migration-suite battery, Flutter builds/tests, Next production builds, browser E2E, installed native applications, provider sandbox/live calls, deployment, load tests or recovery drills. Do not turn the supplied report's historical passes into fresh results.

## 11. Evidence locations

Unless stated otherwise, paths below are relative to `/Users/saai_siddharth/Projects/Start_Up/LetBuyy-develop` at the audited commit.

| Finding / topic | Primary source |
|---|---|
| Staff fail-open | `services/api-gateway/src/middleware/staff-permission.ts:46`, `:135` |
| Privileged client and wrapper | `services/api-gateway/src/lib/supabase.ts:14`; `packages/infrastructure/supabase-adapter/index.ts:34`; `services/api-gateway/src/tenant/tenant-scoped.ts:113` |
| Actual pooled tenant role | `services/api-gateway/src/lib/tenant-transaction.ts:16` |
| Validator's actual scope | `scripts/validators/tenant-isolation-validator.mjs:51`, `:162` |
| Signature-only paid mapping | `packages/infrastructure/razorpay-adapter/index.ts:323`; `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts:560` |
| Refund state mapping | `packages/infrastructure/razorpay-adapter/index.ts:413`; `services/webhook-service/src/index.ts:813` |
| Webhook received/duplicate handling | `services/webhook-service/src/index.ts:57`, `:735`, `:860`; `packages/infrastructure/supabase-adapter/index.ts:138` |
| Webhook event ID fallback | `packages/infrastructure/razorpay-adapter/index.ts:446` |
| Internal hop credential | `services/webhook-service/src/gateway-order-transitions.ts:30` uses a service binding and shared-secret header; the supplied claim of a body-HMAC hop does not describe this helper. |
| Payment confirmation guard | `database/supabase/migrations/000_baseline.sql:1439`; wrapper in `168_b1_b2_capture_refund_ledgering.sql:133` |
| Stock expiry/release | `211_expire_unpaid_committed_reservations.sql:62`; `246_release_decrements_committed_quantity.sql:163`; `services/queue-workers/src/inventory-reservations.ts:24` |
| Sweeper scheduling | `services/queue-workers/wrangler.toml:17`, `:123`, `:237`; `services/queue-workers/src/index.ts:633` |
| Operator login | `apps/admin_web/src/app/api/console-auth/login/route.ts:35` |
| Inventory allocation | `database/supabase/migrations/166_d6_checkout_handoff_inventory.sql`: `create_order_with_inventory_reservations`, which orders default locations first. |
| Existing location transfers | `database/supabase/migrations/216_sync_products_stock_on_checkout_paths.sql:886` |
| Buyer identity linkage | `database/supabase/migrations/223_platform_buyer_identity.sql:57`; `apps/identity-platform/src/lib/auth/identity-issued-session.ts:90` |
| Legacy mobile maps | `apps/customer_app/lib/screens/checkout/add_address_screen.dart:919`; `apps/customer_app/pubspec.yaml` |
| Existing barcode UI, not POS | `apps/merchant_app/lib/widgets/shared/barcode_scanner_sheet.dart`; inventory/product screens importing it |
| Environment-specific Liquid | `services/api-gateway/wrangler.toml:132`, `:248` |
| Tests and cleanup | `scripts/governance/run-executable-suites.mjs`; `tests/executable/checkout-order-concurrency-postgres.test.mjs` |

Temporary test logs are under `/tmp/letbuyy-codex-*.log`. They contain test output, not live credentials. This report records the durable conclusions; temporary logs should not be treated as permanent deployment evidence.

## 12. Practical recommendation to the founder

Your proposed combination is technically coherent. Letbuyy already contains enough meaningful commerce machinery that rebuilding the platform would discard value. Agrimore contributes a clearer physical-commerce product model and useful zone/delivery designs.

The next step is not another broad declaration that the architecture is frozen. It is to establish what is deployed, close the specific correctness gaps, and build one observable shared-stock loop spanning counter and online demand. In parallel, define custody/location contracts and prepare the native clients.

Keep the final product vision broad but the first proven operating loop small. Measure progress through completed journeys and reconciled stock/money, not document count, migration numbering or percentages.
