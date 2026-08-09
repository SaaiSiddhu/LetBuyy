# AGENT D — Inventory, Suppliers, Purchase Orders, Input-GST — Discovery Notes

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-ee371182`
Branch `stepup/main` @ `ee371182`. Phase 1 = discovery only. Nothing in this repo was modified except this file.

Authority chain read before inspection: `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` (ART-14, ART-15, ART-08),
root `AGENTS.md`, `CLAUDE.md`, `apps/merchant-control-plane/AGENTS.md`, `services/api-gateway/AGENTS.md`,
`services/queue-workers/AGENTS.md`. No local `AGENTS.md` exists under `database/`.

Excluded from all searches: `.claude/worktrees/**`, `node_modules/**`, `.next/**`, `.wrangler/**`, `dist/**`,
`build/**`, `graphify-out/**`, `docs/archive/**` (cited only to prove staleness), `legacy/**`.

---

## 0. Headline

The inventory **schema** is genuinely rich (11 tables, 18+ RPCs, a typed event journal, TTL reservations, an optimistic
`version` column). The **runtime behaviour built on top of it is not one lifecycle** — it is **eight independent stock
mutators**, two of which are semantically incompatible with the reservation kernel, plus a **stale denormalised mirror
(`products.stock`) that the storefront reads**. Checkout does **reserve + commit in one transaction** = pre-payment hard
decrement, which ART-14/R-11 explicitly forbids, and the payment-failure webhook is hard-coded **not** to give the stock
back. Procurement (suppliers + POs + receiving) is genuinely end-to-end wired UI→proxy→client→gateway→RPC→DB, but the
lifecycle is truncated (no draft, no send, no cancel, no close, no supplier bill) and the UI reads field names the API
never returns. **Input GST is not implemented at any layer** — there is no supplier GSTIN column anywhere in 187
migrations, no purchase-tax fields, no ITC flag, no purchase credit/debit note. Input-tax-credit reporting is
**NOT_IMPLEMENTED**, not partial.

---

## 1. Canonical inventory model — what the schema actually is

All from `database/supabase/migrations/`.

| Table | Defined at | Tenant column | Purpose (as written) |
|---|---|---|---|
| `inventory_levels` | `000_baseline.sql:9561` (+ `141_executable_inventory_reservations.sql:5-9` adds `store_id`, `created_at`, `deleted_at`, `version`) | `store_id` (added 141) | the balance row |
| `inventory_locations` | `000_baseline.sql:9584` | `store_id` | warehouse/location |
| `inventory_reservations` | `000_baseline.sql:9603` | `store_id` | TTL reservation, 7 statuses |
| `inventory_adjustments` | `000_baseline.sql:9491` | **NONE** | manual adjustment audit, 8 reason codes |
| `inventory_events` | `000_baseline.sql:9510` | `site_id` | the typed journal, 11 event types |
| `inventory_level_duplicate_snapshots` | `000_baseline.sql:9546` | none | reconciliation snapshot |
| `inventory_transfers` / `_lines` / `_receipts` | `000_baseline.sql:4918` / `:4891` / `:9630` | `site_id` | location→location transfer |
| `purchase_orders` / `_lines` / `_receipts` | `000_baseline.sql:5128` / `:5100` / `:10949` | `site_id` | procurement |
| `suppliers` | `000_baseline.sql:12460` | `site_id` | vendor master |
| `restock_events` | `000_baseline.sql:11244` | `site_id` | return→stock restock |

Evidence type: DB_SCHEMA.

### 1.1 The balance columns are two competing sets

`inventory_levels` carries BOTH a legacy triple and a "V1" quintet (`000_baseline.sql:9561-9583`):

```
available integer NOT NULL DEFAULT 0,   reserved integer NOT NULL DEFAULT 0,   incoming integer NOT NULL DEFAULT 0,
on_hand_quantity integer,  available_quantity integer,  committed_quantity integer NOT NULL DEFAULT 0,
unavailable_quantity integer NOT NULL DEFAULT 0,  incoming_quantity integer,  reserved_quantity integer,
safety_stock_quantity integer NOT NULL DEFAULT 0
```

**Only the legacy triple is read.** The gateway's single read path selects exactly
`available, reserved, incoming` — `services/api-gateway/src/routes/inventory.ts:784-796`. The `*_quantity` columns are
written inconsistently by different RPCs and are never surfaced. Specifically:

- `commit_inventory_reservation` decrements `available/reserved/available_quantity/reserved_quantity` and increments
  `committed_quantity`, but **never touches `on_hand_quantity`** (`141:211-221`) → `on_hand_quantity` never decreases
  on a sale.
- `receive_purchase_order_line` **does** increment `on_hand_quantity` (`000_baseline.sql:5175-5182`).
- `release_order_inventory` increments only `available` and touches none of the `*_quantity` columns
  (`000_baseline.sql:7046-7050`) → after a cancel, `committed_quantity` stays inflated forever.
- `safety_stock_quantity` and `unavailable_quantity` are **never written by any RPC** (grep over all 187 migrations
  returns only the column definition and read-through `COALESCE(...,0)` in event inserts).

**Status: PARTIAL.** Evidence: DB_SCHEMA + RPC_FUNCTION + GATEWAY_CODE.

### 1.2 The read model double-counts reserved stock

The reservation kernel treats `available` as **on-hand inclusive of reserved**:
`reserve_inventory` gates on `(available - reserved) < quantity` (`141:127`) then increments only `reserved` (`141:134`);
`commit_inventory_reservation` decrements **both** (`141:212-213`). The postgres test confirms the arithmetic:
after reserving the last unit the row is `available:reserved:version = 1:1:2`, after commit `0:0:1`
(`tests/executable/inventory-postgres.test.mjs:214-236`).

But the API mapper computes:

```ts
on_hand: available + reserved,
sellable: Math.max(0, available - reserved),
```
`packages/commerce-core/src/index.ts:1125-1126`

`sellable` is right; **`on_hand` is wrong** — it adds `reserved` to a number that already contains it. The merchant
"On hand" column (`apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:246-249`) therefore
overstates physical stock by exactly the reserved quantity. Evidence: SERVICE_CODE + RPC_FUNCTION + INTEGRATION_TEST + UI_CODE.

---

## 2. The stock-mutation census — every path that changes stock

ART-15 (`LETBUYY_CONSTITUTION.md:239-242`) states: *"One **reserve→commit** inventory lifecycle (optimistic
concurrency) with the stale-reservation sweeper **wired** in `queue-workers`; the direct-decrement side doors unify onto
it."* and **"Forbids. Multiple inventory decrement paths."**

I found **eight** distinct writers of `inventory_levels`. They do **not** converge.

| # | Mutator | Location | Locks? | Writes | Goes through reserve→commit? | Mirrors `products.stock`? |
|---|---|---|---|---|---|---|
| 1 | `reserve_inventory` | `141:65-173` | `SELECT … FOR UPDATE` (`141:121`) | `reserved +` | **is** the kernel | no |
| 2 | `commit_inventory_reservation` | `141:175-238` | `SELECT … FOR UPDATE` (`141:197`) | `available −`, `reserved −`, `committed +` | **is** the kernel | **no** |
| 3 | `release_inventory_reservation` | `141:240-302` | `SELECT … FOR UPDATE` (`141:263`) | `reserved −` | **is** the kernel | no |
| 4 | `expire_inventory_reservations` (sweeper) | `141:304-348` | `FOR UPDATE SKIP LOCKED` (`141:325`) | `reserved −` | **is** the kernel | no |
| 5 | `adjust_inventory_level` | `000_baseline.sql:38-175` | `SELECT … FOR UPDATE` (`:82`) | `available = available + Δ` | **NO — side door** | **yes** (`:152-161`) |
| 6 | `set_inventory_level_available` (+ `set_inventory_levels_available_batch`, `088:4`) | `000_baseline.sql:7484-7650` | `SELECT … FOR UPDATE` (`:7541`) | `available = <absolute>` | **NO — side door, absolute overwrite** | **yes** (`:7605-7615`) |
| 7 | `receive_purchase_order_line` | `000_baseline.sql:5159-5215` | bare `UPDATE` | `available +`, `incoming −`, `on_hand_quantity +` | **NO — side door** | **no** |
| 8a | `create_inventory_transfer_with_lines` | `000_baseline.sql:2214-2325` | `EXISTS(… FOR UPDATE)` (`:2281-2285`) | `available −`, `reserved +` **without any `inventory_reservations` row** | **NO — parallel reservation concept** | no |
| 8b | `receive_inventory_transfer_line` | `000_baseline.sql:4945-5008` | bare `UPDATE` | source `reserved −`, dest `available +` | **NO** | no |
| 9 | `release_order_inventory` (+ `_with_ledger`) | `000_baseline.sql:6995-7108` / `:7120` | `FOR UPDATE OF il` (`:7043`) | `available +`, and forces `inventory_reservations.status='released'` **from `committed`** | **NO — bypasses the state machine** | **no** |
| 10 | `create_order_return_and_refund` (restock branch) | `000_baseline.sql:2678`, restock at `:+188` (abs `~2865`) | none shown | `available +`, `available_quantity +`, `on_hand_quantity +` | **NO — side door** | **no** |

Also `create_purchase_order_with_lines` writes `incoming +` (`000_baseline.sql:3697-3701`).

### 2.1 Concrete constitutional breaks in that table

**(a) `release_order_inventory` violates the reservation state machine.** `release_inventory_reservation` explicitly
refuses a non-`active`/`hold` reservation:
`RAISE EXCEPTION 'inventory reservation cannot be released from status %'` (`141:273-275`). Because checkout commits
immediately (§3), the order's reservations are `committed`. `release_order_inventory` sidesteps this with a blanket
`UPDATE inventory_reservations SET status='released' … WHERE order_id = p_order_id` (`000_baseline.sql:7075-7081`) and a
direct `available = available + qty` (`:7046-7050`). Result: `committed_quantity` is **never** decremented on a cancel,
so it grows monotonically per SKU.

**(b) `create_inventory_transfer_with_lines` invents a second reservation concept.** It moves
`available → reserved` **directly on `inventory_levels`** with **no `inventory_reservations` row**
(`000_baseline.sql:2288-2295`). Consequences, all provable:
- `expire_inventory_reservations` sweeps `FROM public.inventory_reservations` only (`141:319`) → transfer-held stock has
  **no TTL and no sweeper**.
- `GET /inventory/reservations` reads `inventory_reservations` (`services/api-gateway/src/routes/inventory.ts:979`) →
  the merchant Reservations page can never show transfer holds.
- There is **no cancel-transfer RPC** (grep for `cancel_inventory_transfer` / any `inventory_transfers … 'cancelled'`
  writer returns nothing; the only status writers are `ship_inventory_transfer` `000_baseline.sql:7658` and
  `receive_inventory_transfer` `:4800`). An abandoned transfer pins source stock **permanently**.

**(c) `set_inventory_level_available` is an absolute-value overwrite reachable from the product form.**
`services/api-gateway/src/execution/product-execution.adapter.ts:203-204` — editing a product and typing a stock number
calls `setInventoryAvailable(productId, null, updates.stock, …)`, which sets `available` to that absolute number
(`000_baseline.sql:7570-7574`). The only guard is `p_available < reserved` (`:7566-7568`). There is **no optimistic
version check** despite `inventory_levels.version` existing (`141:9`, trigger `141:48-51`). A sale that lands between
the merchant loading the product form and saving it is silently erased.

**Status: CONTRADICTORY_EVIDENCE vs governance → treat as CONSTITUTIONAL VIOLATION of ART-15 "Forbids: Multiple
inventory decrement paths".** Evidence: RPC_FUNCTION + SERVICE_CODE + DB_SCHEMA.

### 2.2 `products.stock` is a second, stale stock authority the storefront reads

`products.stock integer DEFAULT 0` and `products.track_inventory boolean DEFAULT true`
(`000_baseline.sql:10596-10597`); `product_variants.inventory_qty` likewise.

Only mutators 5 and 6 mirror to `products.stock` (`000_baseline.sql:152-161`, `:7605-7615`). The **canonical sale path
does not** — `commit_inventory_reservation` (`141:175-238`) never touches `products`. Neither does PO receive, transfer
receive, release, restock, or the sweeper.

And the storefront reads `products.stock`:
- `services/api-gateway/src/routes/storefront/public-routes.ts:834` selects `'*'` (or `PRODUCT_SELECT_FULL_RELATIONAL`,
  `:31-33`) from `products` for the public product-detail route.
- `apps/storefront-runtime/src/lib/product-service.ts:112,126` — `const stockValue = data.stock ?? data.stock_quantity ?? data.quantity;`
  and `stock: stockValue === undefined || stockValue === null ? 999 : Number(stockValue)`.
- `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:254` — `available: product.stock > 0 && …`.
- `apps/storefront-runtime/src/app/store/[subdomain]/collections/[slug]/page.tsx:84` — `stock: … : 999`.

So: sell 10 units through checkout → `inventory_levels.available` drops 10, `products.stock` does not move → the
storefront keeps advertising the old quantity; a product with `stock IS NULL` advertises **999**. The shopper only
discovers the truth when `reserve_inventory` raises `INSUFFICIENT_INVENTORY` at order creation.

The gateway also **falls back** to `products.stock` for the merchant view when `inventory_levels` returns zero rows or
is missing (`services/api-gateway/src/routes/inventory.ts:814-836` → `listProductStockInventoryRows` `:94-145` →
`mapProductStockInventoryRecord` `packages/commerce-core/src/index.ts:1084-1105`, which hard-codes `reserved: 0`,
`incoming: 0`). A store in that state shows a fabricated-looking, always-zero reserved column.

**Status: BROKEN (duplicate authority).** Evidence: DB_SCHEMA + RPC_FUNCTION + GATEWAY_CODE + UI_CODE.

---

## 3. Reserve-with-TTL: exists in SQL, is short-circuited at checkout

### 3.1 TTL mechanics — PRESENT

`inventory_reservations.expires_at timestamptz NOT NULL DEFAULT (now() + '00:20:00'::interval)`
(`000_baseline.sql:9615`). `reserve_inventory` clamps caller TTL to 60s…86400s:
`make_interval(secs => LEAST(GREATEST(COALESCE(p_ttl_seconds,1200),60),86400))` (`141:131`). Sweeper index
`idx_inventory_reservations_expiry_sweeper` (`141:25-27`). Idempotency key required, min length 8 (`141:93-95`), replay
returns the existing reservation (`141:97-112`). **IMPLEMENTED_NOT_RUNTIME_VERIFIED** (proved behaviourally only in the
docker-postgres test, §5).

### 3.2 Checkout does NOT use the TTL — it reserves and commits in one transaction

`create_checkout_order` (latest definition `170_v1_shipping_rates_gst.sql:31`) delegates order creation to
`create_order_with_inventory_reservations` (`170:161`). That function (latest definition
`166_d6_checkout_handoff_inventory.sql:8`):

1. `PERFORM public.reserve_inventory(…, 1200, 'checkout.reserve:…')` per line — `166:134-146`
2. inserts the order — `166:165-205`
3. **immediately** `PERFORM public.commit_inventory_reservation(…)` per line — `166:221-227`

all inside one transaction, **before any payment is captured**. The order is inserted with
`payment_status = 'pending'` and `status = CASE WHEN p_payment_method='cod' THEN 'confirmed' ELSE 'pending' END`
(`166:199-200`).

ART-14 / R-11 (`LETBUYY_CONSTITUTION.md:234-235`, `:406`): *"Inventory uses **reserve-with-TTL, not pre-payment
hard-decrement**"* … *"pre-payment hard-decrement is a denial-of-inventory vector."*

This is a **direct violation**. The reservation row exists for microseconds and is `committed` before the shopper is
redirected to Razorpay. Evidence: RPC_FUNCTION (`166:134-227`) + governance DOC (Constitution `:234-235`, `:406`).

### 3.3 …and the payment-failure webhook is hard-coded not to give the stock back

`services/webhook-service/src/index.ts:389-410`, `markOrderFailed`:

```ts
await recordGatewayOrderPaymentFailure(env, {
    orderId: order.id,
    …
    paymentStatus: "failed",
    orderStatus: "cancelled",
    releaseInventory: false,
```

`record_order_payment_failure_with_ledger` only releases when that flag is true
(`168_b1_b2_capture_refund_ledgering.sql:594` → `000_baseline.sql:5881-5882`:
`IF p_release_inventory THEN PERFORM release_order_inventory(…)`).

The refund path **does** pass it (`services/webhook-service/src/index.ts:459`), and the merchant-driven cancel path does
(`services/api-gateway/src/execution/order-execution.adapter.ts:449-451` → `returnInventory` `:529-541`). The
**failed-payment** path does not.

Net effect on a live store: every abandoned/failed Razorpay payment permanently destroys the committed stock. The
sweeper cannot recover it because it only sweeps `status IN ('active','hold')` (`141:320`) and these reservations are
`committed`. **P0.** Evidence: SERVICE_CODE + RPC_FUNCTION.

### 3.4 The sweeper IS scheduled — but at 1/18th of the TTL cadence, and every archived doc says otherwise

Wiring chain (all verified):
- RPC: `expire_inventory_reservations(p_limit, p_request_id)` — `141:304-348`
- Worker: `services/queue-workers/src/inventory-reservations.ts:21-40` calls `db.rpc('expire_inventory_reservations')`
- Scheduled handler: `services/queue-workers/src/index.ts:620-635`, inside `async scheduled(controller, env, ctx)`
- Cron: `services/queue-workers/wrangler.toml` `[triggers] crons = ["17 */6 * * *"]` (and identically for
  `[env.staging.triggers]` and `[env.production.triggers]`)
- Limit var: `INVENTORY_RESERVATION_SWEEPER_LIMIT = "250"` (`wrangler.toml`, all three envs)

So the ART-15 "unscheduled sweeper" finding is **stale**. But the cadence is **every 6 hours** against a **20-minute**
default TTL and a hard cap of **250 rows per run**. Worst-case a stale reservation pins stock for ~6h20m, and the sweep
capacity is 1,000 reservations/day per environment.

**Documentation drift to report:** these still assert the sweeper is dead —
- `docs/archive/root-governance-2026-06-10/directories/FOUNDATION_AUTOPSY/CHECKOUT_AUTOPSY_REPORT.md:30` ("ORPHANED … zero callers; no inventory worker in queue-workers")
- `docs/archive/…/FORENSIC_MASTER_2026_06_10/ARCHITECTURE_COMPLIANCE_AUDIT.md:134` ("DEAD")
- `docs/archive/…/PERFORMANCE_AUDIT.md:115,259` ("no cron, no queue job, and no route invokes it")
- **and a NON-archive doc:** `STRATEGIC_CANONICALIZATION_2026_06_10/PRODUCTION_READINESS_GAP_REPORT.md:233`
  ("DDL-real, wiring-dead (zero callers)")
- **and a NON-archive roadmap item:** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md:488` still lists
  "schedule `expire_inventory_reservations`" as outstanding.

**Status: IMPLEMENTED_NOT_RUNTIME_VERIFIED (wired, cadence inadequate).** Evidence: WEBHOOK_OR_JOB + PROVIDER_OR_CONFIG_EVIDENCE + DOC_CLAIM.

### 3.5 The public reserve/commit/release API surface appears to be dead on arrival

`reserve_inventory`, `commit_inventory_reservation`, `release_inventory_reservation` all begin with
`PERFORM public.require_inventory_site_guc(p_store_id)` (`141:87`, `:190`, `:256`), which raises unless
`current_site_id() = p_store_id` (`141:53-63`).

`current_site_id()` reads a transaction GUC and nothing else:
```sql
SELECT NULLIF(current_setting('app.site_id', true), '')::uuid;
```
`139_executable_foundation_ledger_core.sql:8-14`

The gateway routes `POST /inventory/reserve|commit|release`
(`services/api-gateway/src/routes/inventory.ts:627`, `:677`, `:715`) call these RPCs through
`getSupabaseAdmin(c)` — a PostgREST/service-role client. **Nothing sets `app.site_id` on that connection.** The only
helper that would is `withTenantTx` (`services/api-gateway/src/lib/tenant-transaction.ts:15-35`, which does
`SET LOCAL ROLE app_tenant` + the GUC statement), exposed as `withResolvedTenantTx`
(`services/api-gateway/src/lib/tenant-context.ts:67-73`) — and a repo-wide grep finds **zero callers** of either outside
their own definitions. There is no `db_pre_request` hook in `database/` either (grep: no matches).

Therefore these three routes should always fail with
`'tenant GUC site_id is required for inventory mutation'`, which the route maps to a generic 400
(`inventory.ts:699`, `:738`) or `INVENTORY_MUTATION_FAILED` (`:169-173`, `:653-656`).

**The checkout path works only because it sets the GUC itself:**
```sql
IF public.current_site_id() IS NULL THEN
  PERFORM set_config('app.site_id', p_store_id::text, true);
END IF;
PERFORM public.require_inventory_site_guc(p_store_id);
```
`166_d6_checkout_handoff_inventory.sql:63-66`

Two consequences: (a) the standalone reserve/commit/release API is **BROKEN**; (b) inside
`create_order_with_inventory_reservations` the tenant guard is a **no-op** — it sets the value it then checks, so it
provides **zero** tenant protection for the whole checkout inventory path.

**Status: BROKEN (high confidence, static).** Caveat recorded as an unknown in §12: a Supabase-side
`pgrst.db_pre_request` function or an `ALTER ROLE … SET app.site_id` configured outside the repo would change this. That
is deploy-time state I cannot read → **BLOCKED_EXTERNAL** for final confirmation.
Evidence: RPC_FUNCTION + GATEWAY_CODE + SERVICE_CODE.

---

## 4. Concurrency — can two orders oversell?

### 4.1 The reservation kernel: correct, and proven

`reserve_inventory` does `SELECT * INTO v_level … FOR UPDATE` (`141:114-121`) **before** the availability check
(`141:127`) and the `reserved` increment (`141:133-139`). Under READ COMMITTED this serialises correctly.

`tests/executable/inventory-postgres.test.mjs:203-212` fires two concurrent `psql` reserves for the last unit and
asserts exactly one fulfilled, one rejected with `INSUFFICIENT_INVENTORY`; `:214-217` asserts the row lands at
`1:1:2` (available:reserved:version). This is a real **INTEGRATION_TEST** against a docker postgres
(`tests/executable/inventory-postgres.test.mjs:28-33` — `docker exec … psql -U postgres`), not a source-regex test.

**Status: IMPLEMENTED_NOT_RUNTIME_VERIFIED in production; VERIFIED by integration test in the docker harness.**
I did not run it (would require starting a container — out of the read-only mandate), so I do not claim VERIFIED_E2E.

### 4.2 Everything else: weaker or unguarded

- **No `CHECK (available >= 0)` on `inventory_levels`.** The table definition (`000_baseline.sql:9561-9583`) carries no
  CHECK constraints at all. Nothing at the storage layer prevents negative stock.
- `commit_inventory_reservation` clamps with `GREATEST(available - qty, 0)` (`141:212`) — an oversell is silently
  absorbed to zero rather than raised.
- **Transfers use a materially weaker idiom**: `IF NOT EXISTS (SELECT 1 FROM inventory_levels WHERE id=… AND available >= qty FOR UPDATE)`
  (`000_baseline.sql:2281-2285`) followed by a separate `UPDATE … SET available = available - qty` (`:2288-2295`). This
  is not the `SELECT … INTO … FOR UPDATE` pattern the kernel uses, there is no concurrency test for transfers anywhere
  in `tests/`, and with no `available >= 0` CHECK a lost race drives the row negative.
  **Status: UNVERIFIED_RUNTIME** — I will not claim it is broken without a proof test, but it is unproven.
- `receive_purchase_order_line` and `receive_inventory_transfer_line` use bare single-statement `UPDATE … SET x = x + n`
  (`000_baseline.sql:5175-5182`, `:4964-4976`). That is atomic per statement and safe for increments.
- **`inventory_levels.version` is decorative.** The column and the auto-increment trigger exist
  (`141:9`, `141:48-51`) and the test asserts it ticks (`inventory-postgres.test.mjs:216`), but **no RPC and no route
  ever reads it or passes an expected version**. Grep across `services/`, `apps/`, `packages/` for a version/`If-Match`
  precondition on inventory returns nothing. So "optimistic concurrency" (ART-15's wording) is **NOT_IMPLEMENTED** —
  what exists is pessimistic row locking in one RPC and nothing anywhere else.

### 4.3 PO partial-receive is not idempotent inside the RPC

`receive_purchase_order` guards only against terminal statuses (`000_baseline.sql:5036-5038`:
`IF v_po.status IN ('received','cancelled','closed') THEN RAISE`). A **partial** receive replay is therefore allowed:
`purchase_order_lines.quantity_received` increments again and `inventory_levels.available` increments again
(`:5165-5182`), while the receipt row and the `inventory_events` row are silently dropped by
`ON CONFLICT (site_id, idempotency_key) DO NOTHING` (`:5190`, `:5214`) because the key is
`p_idempotency_key || ':line:' || line_id`. Over-receipt beyond `quantity_ordered` is blocked by
`v_receive_qty > (quantity_ordered - quantity_received)` (`:5057-5059`), so the damage is bounded — but stock can be
inflated up to the ordered quantity with **no matching receipt row**, permanently desynchronising `inventory_levels`
from `purchase_order_receipts`.

The only thing protecting this today is the gateway's `IdempotencyExecutionAdapter` claim
(`services/api-gateway/src/routes/inventory.ts:457-465`), i.e. idempotency lives in the app tier, not in the money/stock
RPC — the inverse of the pattern the Constitution requires for money RPCs.

---

## 5. Procurement — suppliers, POs, receiving: end-to-end traces

### 5.1 Supplier create — trace

| Link | Evidence | Status |
|---|---|---|
| Merchant entry | nav "Purchasing → Vendors" → `products/suppliers`, `apps/merchant-control-plane/src/components/merchantNavigation.ts:108` | present |
| Page | `apps/merchant-control-plane/src/app/[store]/products/suppliers/page.tsx` (fields at `:147,157,163,172,184,191,197,203` = name, contact, email, phone, street, city, state, pincode) | present |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/suppliers/route.ts` (GET + POST) | present |
| Typed client | `packages/typescript/api-client/src/index.ts:2279-2297` (`CreateSupplierInput`, `Supplier`) | present |
| Gateway | `GET /v1/inventory/suppliers` `services/api-gateway/src/routes/inventory.ts:300`; `POST` `:334` | present |
| AuthZ | `resolveCustomUser` + `verifySiteOwnership` + `assertStaffPermission(…,'products:write')` — `inventory.ts:340-345` | present |
| Persistence | direct `db.from('suppliers').insert({…})` — `inventory.ts:347-359` (not an RPC; acceptable, suppliers are not a money table) | present |
| Update / delete / archive | **MISSING** — no PATCH/DELETE route in the gateway (`inventory.ts` has only `/suppliers` GET+POST); no `[id]` proxy dir under `api/stores/[store]/suppliers/` | **MISSING** |
| Tests | none found for suppliers | **MISSING** |
| Runtime observation | none | **MISSING** |

**Status: PARTIAL** (create + list only; a supplier can never be corrected or deactivated through any UI).

### 5.2 Purchase-order create — trace

| Link | Evidence | Status |
|---|---|---|
| Merchant entry | nav "Purchasing" → `products/purchase-orders`, `merchantNavigation.ts:100-109` | present |
| Page + modal | `apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx:96-352` (`CreatePOModal`: supplier, destination location, expected date, notes, N lines of product/variant/qty/unit-cost) | present |
| Idempotency key | generated client-side `po-${Date.now()}-${random}` — `page.tsx:72-74`, sent at `:185` | present |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/purchase-orders/route.ts` (GET + POST) | present |
| Typed client | `packages/typescript/api-client/src/index.ts:2228-2236` + `:4857` | present |
| Gateway | `POST /v1/inventory/purchase-orders` — `services/api-gateway/src/routes/inventory.ts:396` | present |
| AuthZ | `verifySiteOwnership` + `assertStaffPermission('products:write')` — `inventory.ts:403-407` | present |
| Idempotency | `IdempotencyExecutionAdapter.begin({scope:'inventory.purchase_orders.create'})` — `inventory.ts:409-417`; **and** in-RPC replay on `(site_id, idempotency_key)` — `000_baseline.sql:3637-3645` | present |
| RPC | `create_purchase_order_with_lines` — `000_baseline.sql:3616` | present |
| Server-authoritative totals | `v_subtotal := Σ(unit_cost × quantity)` computed in-RPC — `000_baseline.sql:3720`, written at `:3724-3726` | present |
| Side effects | `inventory_levels.incoming +` (`:3697-3701`), `inventory_events` `'po_ordered'` (`:3703-3718`), `outbox_events` `'purchase_order.ordered'` (`:3728-3739`) | present |
| **Draft state** | `purchase_orders.status` CHECK allows `'draft'` and the column defaults to `'draft'` (`000_baseline.sql:5133`), but the RPC hard-codes `'ordered'` on insert (`:3662-3667`). **No code path ever creates a draft.** | **MISSING** |
| **Send-to-supplier** | no route, no RPC, no email template, no UI action. `outbox_events 'purchase_order.ordered'` has no consumer I could find. | **MISSING** |
| **Cancel / close** | CHECK allows `'cancelled'` and `'closed'`, and columns `cancelled_at` exist (`000_baseline.sql:5137`), but **no writer exists** for either state. No PATCH/DELETE route; the `api/stores/[store]/purchase-orders/[id]/` directory contains **only** `receive/route.ts` — there is no `[id]/route.ts`. | **MISSING** |
| Tests | none | **MISSING** |

**Status: PARTIAL.** The lifecycle the assignment asked about — *draft → sent → partially received → received →
closed/cancelled* — is implemented as **ordered → partially_received → received** only. Three of six states are
unreachable.

### 5.3 Purchase-order receive (full AND partial) — trace

| Link | Evidence | Status |
|---|---|---|
| UI | `ReceivePOModal` — `page.tsx:364-499`; per-line quantity input clamped to remaining (`:479-490`) → **partial receive IS supported on web** | present |
| Proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/purchase-orders/[id]/receive/route.ts` | present |
| Gateway | `POST /v1/inventory/purchase-orders/:id/receive` — `inventory.ts:442` | present |
| AuthZ | `loadPurchaseOrderSiteId` → `verifySiteOwnership` → `assertStaffPermission` — `inventory.ts:450-455` | present |
| RPC | `receive_purchase_order` — `000_baseline.sql:5012`; per-line worker `receive_purchase_order_line` `:5159` | present |
| Stock effect | `available +`, `incoming −`, `on_hand_quantity +` — `000_baseline.sql:5175-5182` | present |
| Receipt ledger | `purchase_order_receipts` insert — `:5184-5192` | present |
| Journal | `inventory_events 'po_received'` — `:5194-5214` | present |
| Line + header status roll-up | `:5165-5171` and `:5077-5087` | present |
| **`products.stock` mirror** | **MISSING** — receive never updates it (§2.2) | **MISSING** |
| **Cost capture on receipt** | **MISSING** — `unit_cost` is frozen at order time; there is no received-cost, no price variance, no `products.cost_per_item` update | **MISSING** |
| **Supplier bill / invoice** | **MISSING** — no table, no column, no route (§7) | **MISSING** |
| Mobile parity | Flutter `_receive` sends no `lines` (`apps/mobile/merchant-app/lib/screens/inventory/purchase_orders_screen.dart:281-289`) → **full receive only on mobile** | **PARTIAL** |
| Tests | none | **MISSING** |

**Status: PARTIAL.**

### 5.4 The PO UI reads field names the API never returns

The gateway list route returns rows **unshaped**:
```ts
.from('purchase_orders')
.select('*, supplier:suppliers(name), lines:purchase_order_lines(*)')
```
`services/api-gateway/src/routes/inventory.ts:382-387`

So the wire shape is the DB shape: `purchase_order_lines.quantity_ordered`, `.quantity_received`;
`purchase_orders.subtotal`, `.total`; `status` ∈ `draft|ordered|partially_received|received|cancelled|closed`.

The typed contract and the UI expect different names:
- `PurchaseOrderLine { quantity: number; received_quantity: number }` — `packages/typescript/api-client/src/index.ts:2253-2255`
- `PurchaseOrder { status: 'draft'|'ordered'|'partial'|'received'|'cancelled'; total_cost: number }` — `:2265,2269`

Concrete consequences in `apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx`:
- `totalPoLines()` = `Σ l.quantity * l.unit_cost` (`:68-70`) → `l.quantity` is `undefined` → `NaN` → the "Total cost"
  column renders `formatInrCurrency(NaN)` (`:673`).
- `ReceivePOModal` initialises `remaining = l.quantity - (l.received_quantity ?? 0)` (`:374`) → `NaN`, and
  `receivableLines` filters on `l.quantity - … > 0` (`:384-386`) → `NaN > 0` is false → **the receive modal shows
  "All lines received" for every PO** and the merchant cannot receive anything.
- `poStatusVariant`/`poStatusLabel` (`:47-66`) never match `'partially_received'` or `'closed'`; the badge falls through
  to `'default'` and prints the raw DB string.

`total_cost` is likewise absent from the wire (the DB has `subtotal`/`total`), so any consumer of that field gets
`undefined`.

**Status: BROKEN.** This is a contract break, not a style issue — the primary receive action is unreachable from the web
UI as written. I did not run the app, so this is proved statically from the three files above and is marked
IMPLEMENTED_NOT_RUNTIME_VERIFIED at worst / BROKEN at best-read; recorded as **BROKEN** with a required runtime check.
Evidence: GATEWAY_CODE + API_CLIENT_CODE + UI_CODE.

### 5.5 Transfers — trace summary

Pages `products/transfers` (`page.tsx:192,606-608`), proxies `api/stores/[store]/transfers/route.ts`,
`…/[id]/ship/route.ts`, `…/[id]/receive/route.ts`; gateway `inventory.ts:486,514,558,583`; RPCs
`create_inventory_transfer_with_lines` / `ship_inventory_transfer` / `receive_inventory_transfer`. As with POs there is
**no `[id]/route.ts`** → no detail, no cancel.

`ship_inventory_transfer` (`000_baseline.sql:7658-7695`) changes **no stock at all** — it only flips
`inventory_transfer_lines.status='shipped'` and `inventory_transfers.status='shipped'`. In-transit stock is therefore
invisible: it is neither in source `available` nor in destination `available`; it sits in source `reserved` with no
reservation row (§2.1b). **Status: PARTIAL.**

### 5.6 Merchant procurement surfaces that exist and are wired

| Page | File | Backing endpoint |
|---|---|---|
| Inventory (levels + adjust) | `[store]/products/inventory/page.tsx` | `/inventory/levels`, `/inventory/adjust` |
| Inventory history | `[store]/products/inventory-history/page.tsx:150,170` | `/inventory/analytics`, `/inventory/history` |
| Reservations | `[store]/products/reservations/page.tsx:124` | `/inventory/reservations` |
| Receipts | `[store]/products/receipts/page.tsx:89` | `/inventory/receipts` |
| Locations | `[store]/products/locations/page.tsx:92,232` | `/inventory-locations` |
| Transfers | `[store]/products/transfers/page.tsx:192,606` | `/transfers` |
| Purchase orders | `[store]/products/purchase-orders/page.tsx:523` | `/purchase-orders` |
| Suppliers (labelled "Vendors") | `[store]/products/suppliers/page.tsx:94,230` | `/suppliers` |
| Operations dashboard | `[store]/products/operations-dashboard/page.tsx:118` | `/commerce-analytics/*` |

All nine nav targets resolve to real files (`ls apps/merchant-control-plane/src/app/[store]/products/`). No dead links.
**Status: IMPLEMENTED_NOT_RUNTIME_VERIFIED.**

---

## 6. Adjustments and reason codes

Schema supports 8 reason codes:
`CHECK (reason IN ('sale','return','adjustment','recount','transfer','damaged','reserved','unreserved'))`
— `000_baseline.sql:9505`.

API accepts 10 (a superset with aliases): `AdjustInventorySchema.reason` ∈
`received|sold|returned|damaged|correction|transfer|sale|return|adjustment|recount`
— `packages/commerce-core/src/index.ts:291-302`, normalised by `mapInventoryAdjustmentReason`
(`:1070-1082`), which **collapses `received` and `correction` into `adjustment`** — so a manual receipt is
indistinguishable from a correction in the audit trail.

**The web merchant UI hard-codes both reason and note:**
```ts
reason: 'correction',
notes: 'Adjusted from admin inventory screen',
```
`apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:164-165`

There is no reason-code selector and no free-text note field on the adjust modal. Shrinkage, damage, theft and recount
are all recorded as `'adjustment'`. **The Flutter merchant app does better** — it passes a caller-supplied `reason`
(`apps/mobile/merchant-app/lib/services/inventory_service.dart:569-586` and the barcode variant `:598-620`). Web and
mobile therefore produce structurally different audit data for the same action.

**Status: PARTIAL / UI_ONLY gap.** Evidence: DB_SCHEMA + SERVICE_CODE + UI_CODE.

### 6.1 Low stock / reorder points / safety stock

- Threshold is **hard-coded to 10** in three places: gateway `/inventory/levels` `?low_stock=true` →
  `query.lte('available', 10)` (`services/api-gateway/src/routes/inventory.ts:801`, and the products fallback `:118`);
  gateway `/inventory/analytics` → `.lte('available', 10)` (`:1132-1135`); UI badge
  (`inventory/page.tsx:255-256`).
- `inventory_levels.safety_stock_quantity` exists (`000_baseline.sql:9583`) and is **never written**.
- There is **no reorder point, no reorder quantity, no lead-time, no supplier-per-product** column anywhere in the
  schema (grep for `reorder` across all migrations: zero hits).
- `/inventory/analytics` `low_stock_count` reads `(levelData || []).length` after requesting `{count:'exact'}`
  (`inventory.ts:1131-1139`) — it returns the *page* length, not the count, so the number is capped by PostgREST's row
  limit.

**Reorder points / safety stock: NOT_IMPLEMENTED. Low-stock: PARTIAL (fixed global threshold).**

### 6.2 A stock-count / cycle-count engine exists as dead code

`services/api-gateway/src/lib/inventory-audit-variance.ts` exports `computeVariance`, `reconcileSessionLines`,
`summarizeSession` and is exercised by a 20-case unit test
(`services/api-gateway/src/__tests__/inventory-audit-variance.test.ts`). It has **no route, no table, no UI**: a
repo-wide grep for those symbols outside the lib and its own test returns nothing, and there is no
`inventory_audit`/`stock_count`/`cycle_count` table in any of the 187 migrations.

**Status: DORMANT_FLAGGED** (library + tests only). Evidence: SERVICE_CODE + UNIT_TEST + DB_SCHEMA(absence).

---

## 7. INPUT GST — field-by-field evidence model

Scope of the question: can the purchase side support Input Tax Credit?

I searched all 187 migrations for `gstin`, `reverse_charge`, `input_tax`, `itc`, `input_credit`, `credit_note`,
`debit_note`, `supplier_invoice`, `vendor_bill`, `bill_number`, `place_of_supply` on the purchase side.

### 7.1 The purchase-side tables in full

`suppliers` (`000_baseline.sql:12460-12476`) columns: `id, site_id, name, contact_name, email, phone,
address jsonb, status, metadata jsonb, created_by, updated_by, created_at, updated_at, deleted_at`.

`purchase_orders` (`000_baseline.sql:5128-5155`) columns: `id, site_id, supplier_id, location_id, po_number, status,
ordered_at, expected_at, received_at, cancelled_at, currency, subtotal numeric(12,2), total numeric(12,2), notes,
idempotency_key, request_id, metadata jsonb, created_by, updated_by, created_at, updated_at, deleted_at`.

`purchase_order_lines` (`000_baseline.sql:5100-5122`) columns: `id, site_id, purchase_order_id, product_id, variant_id,
location_id, quantity_ordered, quantity_received, unit_cost numeric(12,2), total_cost numeric(12,2), status,
metadata jsonb, created_by, updated_by, created_at, updated_at, deleted_at`.

`purchase_order_receipts` (`000_baseline.sql:10949-10968`): `id, site_id, purchase_order_id, purchase_order_line_id,
product_id, variant_id, location_id, quantity_received, idempotency_key, request_id, metadata jsonb, …`.

### 7.2 Required ITC evidence fields — PRESENT / ABSENT

| # | Field required for input GST | Verdict | Evidence |
|---|---|---|---|
| 1 | **Supplier GSTIN** | **ABSENT** | `suppliers` has no `gstin` column (`000_baseline.sql:12460-12476`). The only `gstin` columns in the whole schema are `sites.gstin` (`:12017`), `orders.customer_gstin` (`:10163`), `customer_addresses.gstin` (`:8886`), `tax_registrations.gstin` (`144:10`), `draft_orders.customer_gstin` (`116:10`), `checkout_sessions.buyer_gstin` (`146:14`), `theme_purchase_receipts.buyer/seller_gstin` (`091:131-132`), `contact_requests.gstin` (`195:59`). **All output-side or CRM.** No GSTIN format CHECK exists for a supplier. |
| 2 | **Supplier legal name** | **ABSENT** as a distinct field. `suppliers.name` is a trade name with no legal-name field and no registration-type (regular/composition/unregistered), unlike `tax_registrations.legal_name`/`registration_type` (`144:9,15`) on the seller side. |
| 3 | **Supplier address (structured, with state code)** | **PARTIAL/ABSENT.** `suppliers.address jsonb` free-form; the UI captures street/city/state/pincode as free text (`suppliers/page.tsx:184-203`). There is **no 2-digit state_code** (contrast `tax_registrations.state_code text CHECK (state_code ~ '^[0-9]{2}$')`, `144:12`). Place of supply is therefore not derivable. |
| 4 | **Supplier invoice number** | **ABSENT** — no column on `purchase_orders`, `purchase_order_lines`, or `purchase_order_receipts`; no supplier-bill table exists. |
| 5 | **Supplier invoice date** | **ABSENT** — `ordered_at`/`expected_at`/`received_at` are PO milestones, not the supplier's invoice date. |
| 6 | **Place of supply** | **ABSENT** on the purchase side. Present only on `gst_invoices.place_of_supply_state_code` (`144:86`), which is the **sales** invoice. |
| 7 | **HSN/SAC per purchase line** | **ABSENT** on `purchase_order_lines`. `products.hsn_code` exists with a format CHECK (`000_baseline.sql:10627`+, constraint `products_hsn_code_format_check`), so it could be *joined*, but it is never snapshotted onto the purchase line — a later HSN edit silently rewrites history. |
| 8 | **Taxable value per line** | **ABSENT.** `unit_cost`/`total_cost` are undifferentiated cost with no statement of whether tax is included. |
| 9 | **CGST / SGST / IGST split + rates** | **ABSENT.** Zero tax columns on any purchase table. Contrast the sales side, which has all of them: `gst_invoices.cgst_amount_minor/sgst_amount_minor/igst_amount_minor` + the `gst_invoices_tax_split_check` CHECK (`144:88-91,110-111`). |
| 10 | **Cess** | **ABSENT** everywhere in the repo (grep `cess`: no schema hits). |
| 11 | **Reverse-charge flag** | **ABSENT** everywhere (grep `reverse_charge`: no hits). |
| 12 | **ITC eligibility flag / ITC category** | **ABSENT** everywhere (grep `itc`, `input_tax`, `input_credit`: no hits). |
| 13 | **Purchase credit note / debit note** | **ABSENT.** No `purchase_credit_note`/`debit_note` table; there is no cancel path on a PO at all (§5.2). |
| 14 | **Payment status of the supplier bill** | **ABSENT.** No AP ledger, no supplier payment, no `paid_at` on any purchase table. `purchase_orders.currency` defaults `'INR'` and is the only financial metadata. |
| 15 | Supplier PAN / MSME / TDS section | **ABSENT** (not asked, recorded for completeness). |

### 7.3 What input-GST reporting is possible today

Labelled per the required taxonomy.

**CODE_IMPLEMENTED (the code actually does it):**
- Nothing on the input side. There is **no input-GST computation, storage, aggregation, report, or export** anywhere in
  the repository. `services/api-gateway/src/routes/tax.ts` + `144_executable_tax_gst_invoices.sql` are entirely
  output-side (sales invoices, IRN/QR, TCS). The only GST tests are `tests/gst/gst-invoice.test.mjs` and
  `tests/executable/tax-postgres.test.mjs` — both output-side.
- What *is* CODE_IMPLEMENTED on purchases: quantity received, per-line ordered cost, receipt evidence rows, PO status,
  supplier name/contact, per-supplier PO count / on-time rate / avg lead time
  (`services/api-gateway/src/routes/commerce-analytics.ts:48-172`). That is **operational procurement reporting, not tax
  reporting**.
- Therefore, from repository data alone a merchant can produce: *what did I order, from whom, when did it arrive, how
  late, at what stated unit cost*. They **cannot** produce anything that references a supplier's GSTIN, an invoice
  number, a tax amount, or an ITC claim.

**ACCOUNTING_POLICY_DEFINED (a documented policy exists):**
- **None found for input GST.** `docs/` (excluding `docs/archive/`) contains no purchasing-tax or ITC policy document.
  The only files matching "input GST"/"ITC" are Shopify-research notes
  (`docs/research/shopify-product-intelligence/pages/purchase-orders.md`,
  `…/pages/create-purchase-order.md`) — competitor research, **not LetBuyy policy**. ART-15 mentions GST only for
  output invoicing (`LETBUYY_CONSTITUTION.md:240`).

**LEGALLY_VALIDATED (a CA/tax professional signed off):**
- **None. No evidence of any CA or tax-professional review exists anywhere in the repository**, for either the output or
  the input side. I assert nothing about legal or tax compliance.

**Statements I am making from general Indian GST practice rather than repository evidence — each labelled
`INFERRED-FROM-PRACTICE-NOT-REPO` and routed to a CA/tax reviewer, not acted on:**
- `INFERRED-FROM-PRACTICE-NOT-REPO`: input-tax-credit claims are typically substantiated by supplier GSTIN, tax-invoice
  number and date, place of supply, per-line HSN and taxable value, and the CGST/SGST/IGST split — which is why I chose
  fields 1–14 as the checklist. **A CA/tax professional must confirm the actual required field set and retention rules
  for LetBuyy's merchant profile before anything is built.**
- `INFERRED-FROM-PRACTICE-NOT-REPO`: reconciliation against supplier-filed returns is normally required before an ITC
  claim. Nothing in this repo models that, and I take no position on whether LetBuyy must provide it.

**Net verdict for Scope C: INPUT GST = NOT_IMPLEMENTED at schema, service, and UI layers.**
Evidence: DB_SCHEMA (absence, verified by exhaustive grep across all 187 migrations) + SERVICE_CODE + DOC_CLAIM(absence).

---

## 8. Landed cost and inventory valuation

| Capability | Verdict | Evidence |
|---|---|---|
| Per-line purchase unit cost | PRESENT | `purchase_order_lines.unit_cost numeric(12,2)`, `total_cost numeric(12,2)` — `000_baseline.sql:5109-5110`; computed in-RPC `:3693` |
| Freight / duty / insurance / other landed-cost components | **ABSENT** | no columns anywhere; grep `landed_cost`: zero hits |
| Landed-cost allocation across lines | **NOT_IMPLEMENTED** | no code |
| Valuation method (FIFO / weighted average / standard) | **NOT_IMPLEMENTED** | no cost layers, no `inventory_valuation`/`cost_layer` table; grep `fifo`, `weighted_average`, `valuation`: zero hits |
| Cost update on receipt | **MISSING** | `receive_purchase_order_line` (`000_baseline.sql:5159-5215`) writes quantity only; it never touches `products.cost_per_item` / `products.cost_price` |
| Product cost fields | PRESENT but manual-only | `products.cost_price numeric(10,2)` (`000_baseline.sql:10604`) and `products.cost_per_item numeric(10,2)` (`:10617`) — **two competing cost columns**; only `cost_per_item` is set, from the product form (`apps/merchant-control-plane/src/app/[store]/products/new/page.tsx:602`, read at `:234` with a `?? cost_price` fallback) |
| COGS / margin reporting | **NOT_IMPLEMENTED** | grep `cogs`/`margin` across `services/api-gateway/src` and `apps/merchant-control-plane/src`: zero hits; `commerce-analytics.ts` contains no cost aggregation |
| Inventory value on hand | **NOT_IMPLEMENTED** | `/inventory/analytics` returns only `low_stock_count`, `total_skus`, `po_by_status`, `transfer_by_status` (`inventory.ts:1121-1126`) |

**Supporting finding (cross-domain):** the public storefront product-detail route selects `'*'` from `products`
(`services/api-gateway/src/routes/storefront/public-routes.ts:834`), and the alternate select list
`PRODUCT_SELECT_FULL` explicitly names `cost_price` (`:31-32`). Either way the merchant's **purchase cost is served to
unauthenticated shoppers**. This is procurement-cost exposure; the products domain owner (Agent B) may also carry it.

**Status: valuation NOT_IMPLEMENTED; landed cost NOT_IMPLEMENTED; per-line ordered cost only.**

---

## 9. Tenancy and RLS on inventory + procurement tables

| Table | RLS ENABLE | RLS FORCE | Tenant GUC policy | Notes |
|---|---|---|---|---|
| `inventory_levels` | yes (`141:356`) | **yes** (`141:357`) | `store_id = current_site_id()` (`141:362-367`) | also picked up by the 164 sweep (`store_id`) |
| `inventory_locations` | yes | **yes** (`141:357`) | `141:369-374` | |
| `inventory_reservations` | yes | **yes** (`141:357`) | `141:376-381` | |
| `purchase_orders` / `_lines` / `_receipts` | yes (`000_baseline.sql:25949,25971,25993`) | **yes via 164** (has `site_id`) | `app_tenant_guc_*` from `164:63-73` | baseline also has `*_owner_read` (SELECT via `sites` subquery) + `*_service_all` (`auth.role()='service_role'`) |
| `suppliers` | yes (`:27499`) | **yes via 164** | `164` sweep | |
| `inventory_events`, `inventory_transfers*`, `restock_events` | yes | **yes via 164** | `164` sweep | |
| **`inventory_adjustments`** | yes (`:24896`) | **NO** | **NONE** | **has neither `site_id` nor `store_id`** (`000_baseline.sql:9491-9508`) so `164_d4_tenant_role_guc.sql:39-51` — which selects tables `WHERE columns.column_name IN ('site_id','store_id')` — **skips it entirely**. Its only guards are `store_owners_view_adjustments` (SELECT, `authenticated`, via a `products` subquery — `:27296`) and `service_all_inventory_adjustments … USING (true) WITH CHECK (true)` **TO service_role** (`:26547`). |

ART-08 / R-1..R-4 require tenant tables to carry RLS **ENABLE + FORCE** with a per-transaction tenant GUC.
`inventory_adjustments` — the merchant's stock-audit ledger — satisfies neither. **Status: constitutional deviation.**

**Two compounding facts already established in §3.5:**
1. The gateway never sets `app.site_id` (`withResolvedTenantTx` has zero callers), so **every** `app_tenant` GUC policy
   written by `164` is dormant for gateway traffic — the gateway reaches these tables as `service_role` through the
   `*_service_all` / `USING(true)` policies, with `verifySiteOwnership` in TypeScript as the only real tenant boundary.
   Every inventory/procurement route does call `verifySiteOwnership` (`inventory.ts:314, 341, 377, 403, 451, 635, 685,
   723, 773, 855, 906` …), so the boundary holds — but it holds in the app tier, not the database, which is the inverse
   of ART-08's intent. Flagging for the tenancy agent; not re-deriving it here.
2. **No `REVOKE`/`GRANT EXECUTE` exists on any inventory or procurement RPC.** Across all 187 migrations the only
   function-level grants are `195_contact_requests.sql:327-328`
   (`REVOKE ALL ON FUNCTION … FROM PUBLIC; GRANT EXECUTE … TO service_role`). PostgreSQL grants `EXECUTE` to `PUBLIC`
   by default, so `adjust_inventory_level`, `set_inventory_level_available`,
   `set_inventory_levels_available_batch`, `receive_purchase_order`, `create_purchase_order_with_lines`,
   `release_order_inventory` — all `SECURITY DEFINER`, several taking **no tenant proof at all** (`receive_purchase_order`
   takes only a PO id) — are callable by `anon`/`authenticated` if either PostgREST role key is ever obtainable.
   Mitigating fact: I found **no browser-side Supabase client**; `SUPABASE_ANON_KEY` appears only as a Worker env
   binding (`services/api-gateway/src/index.ts:103`), so this is a defence-in-depth gap, not an open door today.

---

## 10. Tests — what actually covers this domain

| Test | Kind | What it proves |
|---|---|---|
| `tests/executable/inventory-postgres.test.mjs` | **INTEGRATION_TEST** (docker postgres, `:28-33`) | reserve concurrency last-unit exactly-one-winner (`:203-212`), idempotent replay (`:224-226`), commit arithmetic (`:227-236`), release (`:238-252`), sweeper expires a past-TTL reservation (`:254-259`), rollback drops the RPCs (`:261-264`). **The only real behavioural coverage in this domain.** Applies migrations 139+141 **only** — it does not exercise checkout, POs, transfers, or the `products.stock` mirror. |
| `services/api-gateway/src/__tests__/inventory-reservations.test.ts` | **source-regex only** | `assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.reserve_inventory/)` etc. (`:12-42`). Proves text exists in files. Proves **no behaviour**. |
| `services/api-gateway/src/__tests__/checkout-d6.test.ts:90` | source-regex | asserts the string `expire_inventory_reservations` appears |
| `services/api-gateway/src/__tests__/inventory-audit-variance.test.ts` | UNIT_TEST | pure functions with no production caller (§6.2) |
| Purchase orders | **NONE** | no test anywhere references `create_purchase_order_with_lines` or `receive_purchase_order` |
| Suppliers | **NONE** | |
| Transfers | **NONE** | |
| Oversell across the *non-kernel* side doors | **NONE** | |
| `products.stock` ↔ `inventory_levels` divergence | **NONE** | |

**No E2E_TEST, no BUILD_RESULT, no RUNTIME_OBSERVATION** for any capability in this domain. Nothing here can be marked
VERIFIED_E2E.

---

## 11. Constitutional / governance compliance summary for this domain

| Rule | Verdict | Evidence |
|---|---|---|
| ART-15 "One reserve→commit inventory lifecycle" | **VIOLATED** | 8 independent `inventory_levels` writers (§2); transfers run a second, reservation-row-less hold concept (§2.1b) |
| ART-15 "Forbids. Multiple inventory decrement paths." | **VIOLATED** | mutators 5, 6, 8a, 9, 10 all decrement or absolutely overwrite outside the kernel |
| ART-15 "stale-reservation sweeper **wired** in queue-workers" | **SATISFIED** (cadence inadequate) | `queue-workers/src/index.ts:620-635` + `wrangler.toml [triggers] crons = ["17 */6 * * *"]` — 6h cron vs 20min TTL |
| ART-15 "optimistic concurrency" | **NOT_IMPLEMENTED** | `inventory_levels.version` exists (`141:9`) and is read by nothing |
| ART-14 / R-11 "reserve-with-TTL, not pre-payment hard-decrement" | **VIOLATED** | `166:134-227` reserves and commits in the same transaction at order creation, before payment |
| ART-08 / R-1..R-4 "tenant tables RLS ENABLE + FORCE + GUC" | **DEVIATION** | `inventory_adjustments` has no tenant column, no FORCE, no GUC policy (§9) |
| ART-08 "unset GUC ⇒ ZERO rows" | **not exercised** | gateway never sets the GUC (`withResolvedTenantTx` zero callers); tenant boundary is TS-tier `verifySiteOwnership` |
| "Apps MUST NOT write the DB directly; app routes are gateway proxies" | **SATISFIED** | every `apps/merchant-control-plane/src/app/api/stores/[store]/{inventory,purchase-orders,suppliers,transfers,inventory-locations}` route uses `createMerchantApiClient()`; no Supabase import found in any of them |
| Six reserved services stay empty (ARCH-R4/R5) | **SATISFIED** | `services/{checkout-runtime,event-bus,notification-service,analytics-pipeline,media-service,search-service}` each contain exactly `AGENTS.md` + `runtime.manifest.json`; same for `apps/mobile/{shopper-app,operator-app}` |
| Money as `bigint` minor units (R-5) | **DEVIATION (procurement scope)** | `purchase_orders.subtotal/total` and `purchase_order_lines.unit_cost/total_cost` are `numeric(12,2)` rupees (`000_baseline.sql:5108-5110`, `:5140-5141`), not paise `bigint`. Note the sales side **does** use minor units (`gst_invoices.*_minor bigint`, `144:87-93`). Procurement cost is merchant-internal, not platform ledger money, so this is a consistency deviation, not a canonical-ledger breach. |
| No direct TS `.insert/.update/.delete` on money tables | **SATISFIED for money** | the only `.insert()` calls in `inventory.ts` are `/locations` (`:278`) and `/suppliers` (`:349`) — neither is a money or stock-balance table |

---

## 12. Gap list

Each gap uses my agent letter D. Severity, likelihood and confidence are mine; the commander renumbers.

---

### G-D-01 — Failed payments permanently destroy stock (webhook hard-codes `releaseInventory: false`)
- **Domain:** inventory ↔ payments
- **Status:** BROKEN
- **Impact:** every failed/abandoned Razorpay payment silently and permanently decrements sellable stock. The merchant's
  catalogue drifts down with no signal and no recovery path; goods that were never sold become unsellable.
- **Evidence:** `services/webhook-service/src/index.ts:410` (`releaseInventory: false` inside `markOrderFailed`);
  release is conditional on that flag at `database/supabase/migrations/000_baseline.sql:5881-5882`; the stock was
  already committed at order create by `166_d6_checkout_handoff_inventory.sql:221-227`; the sweeper cannot recover it
  because it only sweeps `status IN ('active','hold')` (`141:320`). Contrast the refund path which **does** pass the
  flag: `services/webhook-service/src/index.ts:459`.
- **Expected:** a payment-failed webhook on an order whose inventory was committed must return that inventory.
- **Root cause:** a literal `false` where the refund sibling computes
  `Boolean(order.inventory_reserved_at && !order.inventory_released_at)`.
- **Blast radius:** every store, every non-COD order that does not complete payment.
- **Invariant:** [HIGH-STAKES] [IRREVERSIBLE] (stock cannot be reconstructed once orders are purged)
- **Severity:** P0 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Dependencies:** interacts with G-D-02 (if checkout stopped committing pre-payment, this leak mostly disappears).
- **Remediation approach:** make the payment-failed transition compute the release condition the same way the refund
  transition already does, and add a reconciliation sweep for orders that are `cancelled` + `inventory_reserved_at IS NOT NULL`
  + `inventory_released_at IS NULL`. Do not write `inventory_levels` from TypeScript — route through the existing
  release RPC.
- **Acceptance:** a payment.failed webhook on a committed order restores `inventory_levels.available` to its
  pre-checkout value and sets `orders.inventory_released_at`; replaying the webhook is a no-op.
- **Tests required:** INTEGRATION_TEST (checkout → commit → payment.failed webhook → assert stock restored, assert
  idempotent on replay); a reconciliation test for the historical-leak sweep.
- **Owner:** lead engineer + payments-provider reviewer
- **Reversibility:** reversible (code change); the *data* damage already done is not.

---

### G-D-02 — Checkout does pre-payment hard-decrement (ART-14/R-11 violation)
- **Domain:** inventory ↔ checkout
- **Status:** IMPLEMENTED_NOT_RUNTIME_VERIFIED (implemented, but implemented against the Constitution)
- **Impact:** the reserve-with-TTL design is bypassed. Stock is destroyed at order creation, before any money is
  captured, which is exactly the denial-of-inventory vector ART-14 names.
- **Evidence:** `database/supabase/migrations/166_d6_checkout_handoff_inventory.sql:134-146` (reserve) and `:221-227`
  (commit) in the same transaction; order written with `payment_status='pending'` at `:200`;
  `170_v1_shipping_rates_gst.sql:161` shows `create_checkout_order` delegating here. Governance:
  `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:234-235` and `:406`.
- **Expected:** reserve with TTL at order creation; commit only on payment capture (or immediately for COD).
- **Missing link:** no commit-on-capture step exists. `confirm_order_payment_with_ledger` was not found to call
  `commit_inventory_reservation` (grep across migrations returns no such call).
- **Blast radius:** every non-COD order on every store.
- **Invariant:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Dependencies:** G-D-01, G-D-03 (fixing this needs the sweeper cadence tightened first, or abandoned checkouts pin
  stock for 6h).
- **Remediation approach:** move the commit out of order creation and into the payment-capture path, keyed on the
  reservation ids already stored on the checkout session
  (`checkout_sessions.inventory_reservation_ids`, read at `services/api-gateway/src/routes/checkout.ts:393-403`).
  Keep COD committing at creation. Requires ARB sign-off because it changes the order/payment state machine.
- **Acceptance:** a Razorpay order created but never paid holds `status='active'` reservations that the sweeper expires;
  `inventory_levels.available` is unchanged until capture.
- **Tests required:** INTEGRATION_TEST for reserve→expire (no capture) and reserve→capture→commit; an oversell test
  proving TTL reservations still block concurrent buyers.
- **Owner:** ARB + lead engineer
- **Reversibility:** reversible with care.

---

### G-D-03 — Stale-reservation sweeper runs every 6 hours against a 20-minute TTL, capped at 250 rows
- **Domain:** inventory
- **Status:** IMPLEMENTED_NOT_RUNTIME_VERIFIED
- **Impact:** an expired reservation can pin sellable stock for up to ~6h20m; sweep throughput is 250×4 = 1,000
  reservations/day, so a busy store's expiry backlog grows without bound.
- **Evidence:** TTL default `now() + '00:20:00'` (`000_baseline.sql:9615`), clamp `141:131`; sweeper wired at
  `services/queue-workers/src/index.ts:620-635`; cron `crons = ["17 */6 * * *"]` in
  `services/queue-workers/wrangler.toml` (`[triggers]`, `[env.staging.triggers]`, `[env.production.triggers]`); limit
  `INVENTORY_RESERVATION_SWEEPER_LIMIT = "250"` in all three env blocks; RPC clamps the limit to ≤1000 (`141:324`).
- **Expected:** sweep cadence ≤ the TTL, with capacity proportional to reservation volume.
- **Invariant:** none directly, but it gates G-D-02's fix.
- **Severity:** P2 today, **P1 the moment G-D-02 is fixed** · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** add a dedicated short-interval trigger for the sweeper (separate from the 6-hourly
  maintenance cron), and loop-until-drained within the invocation budget.
- **Acceptance:** a reservation that expires at T is released by T+cadence; a 10k-reservation backlog drains.
- **Tests required:** INTEGRATION_TEST asserting drain-to-zero; PROVIDER_OR_CONFIG_EVIDENCE for the new trigger.
- **Owner:** lead engineer
- **Reversibility:** fully reversible.

---

### G-D-04 — Eight independent stock mutators; the kernel is not the single path (ART-15 violation)
- **Domain:** inventory
- **Status:** CONTRADICTORY_EVIDENCE (schema declares one lifecycle; code runs eight)
- **Impact:** oversell and phantom stock are reachable by design; no single place enforces the invariant; every future
  feature must remember all eight.
- **Evidence:** the census table in §2 — `141:65/175/240/304`; `000_baseline.sql:38` (`adjust_inventory_level`),
  `:7484` (`set_inventory_level_available`), `088:4` (batch), `:5159` (`receive_purchase_order_line`), `:2288-2295`
  (transfer reserve), `:4964-4976` (transfer receive), `:7046-7050` (`release_order_inventory`),
  `create_order_return_and_refund` restock. Governance: `LETBUYY_CONSTITUTION.md:239-242`.
- **Specific breakages:** `release_order_inventory` forces `inventory_reservations.status` from `committed` to
  `released`, a transition `release_inventory_reservation` explicitly refuses (`141:273-275`), and never decrements
  `committed_quantity`.
- **Blast radius:** all stock correctness.
- **Invariant:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** designate the kernel as the sole writer; re-express receive / transfer / restock / adjust as
  kernel operations (or as explicitly-typed, audited, non-sale movements that still go through one funnel); add a
  validator in the existing gate that fails any new `UPDATE public.inventory_levels` outside the approved function set.
  Requires ARB.
- **Acceptance:** exactly one SQL location mutates `inventory_levels` balances; a repo validator enforces it.
- **Tests required:** INTEGRATION_TEST oversell suite across every entry point; a governance validator.
- **Owner:** ARB + lead engineer
- **Reversibility:** reversible but large.

---

### G-D-05 — `products.stock` is a stale second stock authority that the public storefront reads
- **Domain:** inventory ↔ storefront
- **Status:** BROKEN
- **Impact:** shoppers are shown stock levels that do not decrease when items sell. Products with `stock IS NULL` are
  advertised as **999** available. Merchants see one number in admin and shoppers see another.
- **Evidence:** mirror written only by `adjust_inventory_level` (`000_baseline.sql:152-161`) and
  `set_inventory_level_available` (`:7605-7615`); **not** by `commit_inventory_reservation` (`141:211-238`), PO receive,
  transfer receive, release, or restock. Storefront reads: `services/api-gateway/src/routes/storefront/public-routes.ts:834`
  (`select('*')`); `apps/storefront-runtime/src/lib/product-service.ts:112,126` (`: 999` default);
  `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:254`;
  `apps/storefront-runtime/src/app/store/[subdomain]/collections/[slug]/page.tsx:84`. Merchant-side fallback to the same
  stale column: `services/api-gateway/src/routes/inventory.ts:814-836` → `packages/commerce-core/src/index.ts:1084-1105`.
- **Expected:** one stock authority; the storefront reads sellable stock derived from `inventory_levels`.
- **Blast radius:** every storefront product page and collection grid.
- **Invariant:** [HIGH-STAKES] (drives oversell)
- **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Dependencies:** G-D-04.
- **Remediation approach:** make the storefront read a derived sellable quantity from the ledger (view or projection),
  and either retire `products.stock` or demote it to a maintained projection updated by the single stock funnel. Also
  remove the merchant-side silent fallback so a store with no `inventory_levels` rows shows an explicit
  "inventory not initialised" state rather than a different number.
- **Acceptance:** selling the last unit makes the storefront show out-of-stock on the next cached-page refresh; a
  product with no ledger row does not advertise 999.
- **Tests required:** INTEGRATION_TEST (sell → assert storefront payload); a validator forbidding new reads of
  `products.stock` for availability.
- **Owner:** lead engineer + ARB (touches storefront read path)
- **Reversibility:** reversible.

---

### G-D-06 — Purchase-order UI/API contract mismatch makes "Receive" unusable and totals `NaN`
- **Domain:** procurement
- **Status:** BROKEN
- **Impact:** the merchant cannot receive stock from a purchase order through the web admin, and the PO list shows a
  broken total.
- **Evidence:** gateway returns raw DB rows — `services/api-gateway/src/routes/inventory.ts:382-387`
  (`select('*, supplier:suppliers(name), lines:purchase_order_lines(*)')`), so the wire carries `quantity_ordered` /
  `quantity_received` / `subtotal` / `total` and `status ∈ {…,'partially_received','closed'}`
  (`database/supabase/migrations/000_baseline.sql:5104-5105, 5140-5141, 5154`). The contract declares
  `quantity` / `received_quantity` / `total_cost` and `status:'partial'`
  (`packages/typescript/api-client/src/index.ts:2253-2255, 2265, 2269`). The UI consumes the contract names:
  `totalPoLines` `apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx:68-70`;
  `remaining` `:374`; `receivableLines` filter `:384-386`; status helpers `:47-66`.
  `NaN > 0` is false ⇒ `receivableLines` is always empty ⇒ the modal always renders "All lines received" (`:458-461`).
- **Expected:** one agreed wire shape, enforced by types on both sides.
- **Missing link:** no response mapper between the DB row and the typed contract (contrast `mapInventoryLevelRecord`,
  which exists for levels).
- **Blast radius:** every merchant using purchase orders on web.
- **Invariant:** none
- **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH (static; a runtime click-through would make it
  VERIFIED — recorded as a required check)
- **Remediation approach:** add an explicit PO/PO-line mapper in the gateway (or in `commerce-core` alongside the
  existing inventory mappers) and align the status union with the DB CHECK, including `partially_received` and `closed`.
- **Acceptance:** the receive modal lists open lines and a partial receive succeeds; the total column renders rupees.
- **Tests required:** CONTRACT test asserting the gateway response satisfies `PurchaseOrder`; E2E_TEST for create →
  partial receive → receive.
- **Owner:** lead engineer
- **Reversibility:** fully reversible.

---

### G-D-07 — INPUT GST is not implemented: no supplier GSTIN, no purchase-tax fields, no ITC evidence
- **Domain:** procurement ↔ tax
- **Status:** NOT_IMPLEMENTED
- **Impact:** no input-tax-credit reporting of any kind is possible from repository data. A merchant cannot record who
  they bought from in a tax-identifiable way, what tax they paid, or whether it is creditable.
- **Evidence:** field-by-field table in §7.2. `suppliers` has no `gstin` (`000_baseline.sql:12460-12476`);
  `purchase_orders` / `purchase_order_lines` / `purchase_order_receipts` carry **zero** tax columns
  (`:5100-5155`, `:10949-10968`); exhaustive grep across all 187 migrations for `reverse_charge`, `input_tax`, `itc`,
  `input_credit`, `credit_note`, `debit_note`, `supplier_invoice`, `vendor_bill` returns no schema hits; all GST
  machinery is output-side (`144_executable_tax_gst_invoices.sql` — `tax_registrations`, `hsn_rates`, `tax_overrides`,
  `gst_invoices`).
- **Expected:** UNKNOWN until a CA/tax professional defines the required evidence set. Do not build to my inference.
- **Blast radius:** every GST-registered merchant.
- **Invariant:** [HIGH-STAKES] (tax)
- **Severity:** P1 (business-blocking for registered merchants) · **Likelihood:** HIGH · **Confidence:** HIGH
- **Dependencies:** requires a written accounting policy before any schema work; requires G-D-08 (supplier bill entity).
- **Remediation approach:** **first** obtain a CA/tax-professional specification of the required field set, retention,
  and reconciliation expectations; **then** design a supplier-bill entity and a purchase-tax line model. Nothing should
  be built from general practice. **No claim of tax compliance may be made by engineering.**
- **Acceptance:** defined by the CA specification, not by engineering.
- **Tests required:** to be defined with the CA specification.
- **Owner:** **CA/tax reviewer first**, then founder (scope decision), then lead engineer
- **Reversibility:** additive, reversible.

---

### G-D-08 — Purchase-order lifecycle is truncated: no draft, no send, no cancel, no close, no supplier bill
- **Domain:** procurement
- **Status:** PARTIAL
- **Impact:** a PO can never be drafted, never be sent to the supplier, and never be cancelled or closed. A mistaken PO
  pins `inventory_levels.incoming` forever. There is no supplier bill, so accounts payable is invisible.
- **Evidence:** RPC hard-codes `'ordered'` on insert (`000_baseline.sql:3662-3667`) although the column defaults to
  `'draft'` (`:5133`); CHECK permits `draft|ordered|partially_received|received|cancelled|closed` (`:5154`) but no
  writer exists for `draft`, `cancelled`, or `closed`; `cancelled_at` column unused (`:5137`); no `[id]/route.ts` under
  `apps/merchant-control-plane/src/app/api/stores/[store]/purchase-orders/` (only `route.ts` and `[id]/receive/route.ts`);
  no PATCH/DELETE in `services/api-gateway/src/routes/inventory.ts`; no supplier-bill table anywhere;
  `outbox_events 'purchase_order.ordered'` (`:3728-3739`) has no consumer.
- **Expected:** the full lifecycle named in the assignment.
- **Blast radius:** every merchant using procurement.
- **Invariant:** none (but `incoming` drift is a stock-accuracy issue)
- **Severity:** P2 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** add draft creation + a send transition (with the supplier-email side effect, gated on
  supplier email consent) + cancel/close transitions that unwind `incoming`, all as RPC state transitions with the same
  idempotency discipline as receive.
- **Acceptance:** a cancelled PO returns `inventory_levels.incoming` to its prior value and cannot be received.
- **Tests required:** INTEGRATION_TEST per transition; a state-machine test for illegal transitions.
- **Owner:** founder (scope) + lead engineer
- **Reversibility:** additive.

---

### G-D-09 — Transfers hold stock with no reservation row, no TTL, no sweeper, and no cancel
- **Domain:** inventory
- **Status:** PARTIAL / BROKEN on abandonment
- **Impact:** an abandoned or mistaken transfer pins source stock permanently with no automatic or manual recovery.
  In-transit stock is invisible at both locations and never appears on the Reservations page.
- **Evidence:** `create_inventory_transfer_with_lines` moves `available → reserved` directly on `inventory_levels`
  (`000_baseline.sql:2288-2295`) with **no** `inventory_reservations` insert; the sweeper reads only
  `inventory_reservations` (`141:319`); `GET /inventory/reservations` reads only `inventory_reservations`
  (`services/api-gateway/src/routes/inventory.ts:979`); `ship_inventory_transfer` (`000_baseline.sql:7658-7695`) changes
  no stock; no cancel RPC and no `[id]/route.ts` proxy exist.
- **Expected:** transfers use the same reservation entity, TTL, and sweeper as sales, or have an explicit cancel path.
- **Blast radius:** any multi-location merchant.
- **Invariant:** [HIGH-STAKES] (stuck stock)
- **Severity:** P2 · **Likelihood:** MEDIUM (multi-location adoption unknown) · **Confidence:** HIGH
- **Dependencies:** G-D-04.
- **Remediation approach:** express the transfer hold as an `inventory_reservations` row with a transfer-scoped reason,
  and add a cancel transition that releases through the kernel.
- **Acceptance:** cancelling a transfer restores source `available`; an abandoned transfer is visible on the
  Reservations page.
- **Tests required:** INTEGRATION_TEST for create → cancel → stock restored; concurrency test for the source decrement.
- **Owner:** lead engineer
- **Reversibility:** reversible.

---

### G-D-10 — Merchant web adjustments carry no reason code (hard-coded `'correction'`)
- **Domain:** inventory
- **Status:** PARTIAL
- **Impact:** shrinkage, damage, theft, and recount are indistinguishable in the audit ledger. Web and mobile produce
  structurally different audit data for the same action.
- **Evidence:** UI hard-codes `reason: 'correction'` and a fixed note
  (`apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:164-165`);
  `mapInventoryAdjustmentReason` collapses `received` and `correction` into `adjustment`
  (`packages/commerce-core/src/index.ts:1070-1082`); the DB supports 8 reason codes
  (`database/supabase/migrations/000_baseline.sql:9505`); the Flutter app **does** pass a real reason
  (`apps/mobile/merchant-app/lib/services/inventory_service.dart:569-586`).
- **Expected:** the web adjust modal offers the supported reason codes and a note field.
- **Blast radius:** all merchants using the web admin.
- **Invariant:** none
- **Severity:** P2 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** surface a reason select + note input on the adjust modal; stop collapsing `received` into
  `adjustment`.
- **Acceptance:** an adjustment made as "damaged" is stored with `reason='damaged'` and shows as such in Inventory
  history.
- **Tests required:** UI test + a history contract test.
- **Owner:** lead engineer
- **Reversibility:** fully reversible.

---

### G-D-11 — `POST /v1/inventory/reserve|commit|release` appear to be dead: the tenant GUC they require is never set
- **Domain:** inventory ↔ tenancy
- **Status:** BROKEN (static proof) / BLOCKED_EXTERNAL for final confirmation
- **Impact:** the only governance-blessed reservation API is unusable; and the guard is a no-op on the one path that
  does work.
- **Evidence:** `require_inventory_site_guc` raises unless `current_site_id() = p_store_id` (`141:53-63`), called first
  in all three RPCs (`141:87`, `:190`, `:256`); `current_site_id()` reads only `current_setting('app.site_id', true)`
  (`139_executable_foundation_ledger_core.sql:8-14`); the routes call the RPCs via the PostgREST service-role client
  (`services/api-gateway/src/routes/inventory.ts:630,641` / `:680,691` / `:718,729`); the only GUC-setting helper
  `withTenantTx` / `withResolvedTenantTx` (`services/api-gateway/src/lib/tenant-transaction.ts:15-35`,
  `services/api-gateway/src/lib/tenant-context.ts:67-73`) has **zero callers**; no `db_pre_request` hook exists in
  `database/`. Checkout works only because it sets the GUC itself
  (`166_d6_checkout_handoff_inventory.sql:63-66`) — which also makes the guard tautological there.
- **Expected:** either the gateway sets the tenant GUC per request, or the RPCs accept a proven tenant argument instead
  of a GUC.
- **Blast radius:** the reservation API surface; the credibility of the tenant guard on the checkout path.
- **Invariant:** [HIGH-STAKES] (tenancy)
- **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** MEDIUM-HIGH (see unknown U-2)
- **Remediation approach:** decide the tenancy mechanism for RPC traffic (pooled SQL + `SET LOCAL`, or a
  `db_pre_request` hook, or drop the GUC guard in favour of an explicit verified-tenant argument) and apply it
  consistently. Do not leave a guard that the only live caller satisfies by setting the value itself. Requires
  ARB/security.
- **Acceptance:** `POST /inventory/reserve` on an owned store returns 201; on a non-owned store returns 403; and the
  guard is not self-satisfied anywhere.
- **Tests required:** INTEGRATION_TEST through the real gateway against a real database; a cross-tenant negative test.
- **Owner:** security + ARB + lead engineer
- **Reversibility:** reversible.

---

### G-D-12 — `inventory_adjustments` has no tenant column, no FORCE RLS, and no tenant-GUC policy
- **Domain:** tenancy
- **Status:** PARTIAL (ART-08 deviation)
- **Impact:** the stock-audit ledger is outside the repository's own tenant-RLS sweep.
- **Evidence:** table definition has neither `site_id` nor `store_id`
  (`database/supabase/migrations/000_baseline.sql:9491-9508`); `164_d4_tenant_role_guc.sql:39-51` only enrols tables
  `WHERE columns.column_name IN ('site_id','store_id')`, so it is skipped; baseline gives it `ENABLE ROW LEVEL SECURITY`
  only (`:24896`), a SELECT policy via a `products` subquery (`:27296`), and
  `service_all_inventory_adjustments … USING (true) WITH CHECK (true)` (`:26547`). Contrast `inventory_levels`, which
  gets explicit FORCE + GUC at `141:356-367`. The docs claim otherwise: `docs/v1-execution/phase-5/02-inventory-ledger.md:6`
  says "all RLS/FORCE-RLS".
- **Expected:** ART-08 / R-1..R-4 — tenant tables ENABLE + FORCE + per-transaction GUC.
- **Invariant:** [HIGH-STAKES] (tenancy)
- **Severity:** P2 · **Likelihood:** MEDIUM · **Confidence:** HIGH
- **Remediation approach:** add a tenant column to `inventory_adjustments`, backfill from `products`, then let the
  standard enrolment apply FORCE + the GUC policy. Coordinate with G-D-11 (a GUC policy is inert until the GUC is set).
- **Acceptance:** the table appears in the tenant-RLS enrolment with FORCE on; an unset GUC yields zero rows.
- **Tests required:** RLS_POLICY test (unset GUC ⇒ 0 rows; wrong tenant ⇒ 0 rows).
- **Owner:** security + lead engineer
- **Reversibility:** additive migration.

---

### G-D-13 — No inventory valuation, no landed cost, no COGS; PO receipt never updates product cost
- **Domain:** procurement ↔ finance
- **Status:** NOT_IMPLEMENTED
- **Impact:** a merchant cannot answer "what is my stock worth" or "what did this sale cost me". Purchase cost captured
  on a PO never reaches the product record.
- **Evidence:** `purchase_order_lines` carries only `unit_cost`/`total_cost` (`000_baseline.sql:5109-5110`); no freight
  / duty / landed-cost columns and no cost-layer table anywhere (grep `landed_cost`, `fifo`, `weighted_average`,
  `valuation`, `cogs`: zero hits across all migrations and `services/`/`apps/` source);
  `receive_purchase_order_line` (`:5159-5215`) never touches `products.cost_per_item` / `cost_price`;
  two competing product cost columns exist (`products.cost_price` `:10604`, `products.cost_per_item` `:10617`) and only
  `cost_per_item` is written, manually, from the product form
  (`apps/merchant-control-plane/src/app/[store]/products/new/page.tsx:602`); `/inventory/analytics` returns no value
  (`services/api-gateway/src/routes/inventory.ts:1121-1126`).
- **Expected:** UNKNOWN — a valuation policy must be chosen (and, if it is to appear in books, reviewed by a CA).
- **Invariant:** none technically; touches financial reporting.
- **Severity:** P2 · **Likelihood:** MEDIUM · **Confidence:** HIGH
- **Dependencies:** G-D-07 (input GST and landed cost share the supplier-bill entity).
- **Remediation approach:** decide the valuation method with the founder and a CA before any schema work; then make PO
  receipt the cost-of-record event and retire one of the two product cost columns.
- **Acceptance:** defined once the policy exists.
- **Tests required:** to be defined with the policy.
- **Owner:** founder + CA/tax reviewer, then lead engineer
- **Reversibility:** additive.

---

### G-D-14 — Merchant "On hand" double-counts reserved stock
- **Domain:** inventory
- **Status:** BROKEN
- **Impact:** the merchant's On-hand figure is overstated by exactly the reserved quantity, so every count/audit
  disagrees with the screen.
- **Evidence:** `on_hand: available + reserved` (`packages/commerce-core/src/index.ts:1125`) vs the kernel semantics
  where `available` already includes reserved — `reserve_inventory` gates on `available - reserved` (`141:127`) and
  `commit_inventory_reservation` decrements both (`141:212-213`); the integration test pins the arithmetic
  (`tests/executable/inventory-postgres.test.mjs:214-217, 227-236`). Rendered at
  `apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:246-249`.
- **Expected:** `on_hand === available`; `sellable === available - reserved`.
- **Severity:** P2 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** fix the mapper and add a unit test pinning the three-way relationship; consider renaming the
  ledger column so the semantics are self-evident.
- **Acceptance:** reserving 1 of 5 shows On hand 5, Reserved 1, Sellable 4.
- **Tests required:** UNIT_TEST on the mapper; an INTEGRATION_TEST asserting screen values match SQL.
- **Owner:** lead engineer · **Reversibility:** fully reversible.

---

### G-D-15 — PO partial-receive is not idempotent inside the RPC; over-receipt silently loses the receipt row
- **Domain:** procurement
- **Status:** PARTIAL
- **Impact:** a retried partial receive inflates stock and the `purchase_order_receipts` ledger under-reports it.
- **Evidence:** terminal-status guard only (`000_baseline.sql:5036-5038`); the per-line worker increments
  `quantity_received` and `inventory_levels.available` unconditionally (`:5165-5182`) while the receipt and event
  inserts are dropped by `ON CONFLICT (site_id, idempotency_key) DO NOTHING` (`:5190`, `:5214`) keyed on
  `p_idempotency_key || ':line:' || line_id`; over-receipt beyond ordered is blocked by `:5057-5059`. Protection today
  lives in the app tier: `services/api-gateway/src/routes/inventory.ts:457-465`.
- **Expected:** the RPC is idempotent on `(purchase_order_id, idempotency_key)` the way the money RPCs are.
- **Invariant:** none (stock, not money) but the same discipline applies
- **Severity:** P2 · **Likelihood:** MEDIUM · **Confidence:** HIGH
- **Remediation approach:** claim the idempotency key inside the RPC before any mutation and short-circuit on replay.
- **Acceptance:** calling receive twice with the same key produces one receipt row and one stock increment.
- **Tests required:** INTEGRATION_TEST for replay of a partial receive.
- **Owner:** lead engineer · **Reversibility:** fully reversible.

---

### G-D-16 — No reorder points, no safety stock, low-stock threshold hard-coded to 10 in three places
- **Domain:** inventory
- **Status:** PARTIAL (low stock) / NOT_IMPLEMENTED (reorder points, safety stock)
- **Evidence:** `.lte('available', 10)` at `services/api-gateway/src/routes/inventory.ts:801` and `:118`;
  `.lte('available', 10)` at `:1132-1135`; UI badge thresholds
  `apps/merchant-control-plane/src/app/[store]/products/inventory/page.tsx:255-256`;
  `inventory_levels.safety_stock_quantity` defined (`000_baseline.sql:9583`) and never written; no `reorder*` column in
  any migration. Also `/inventory/analytics` returns `(levelData||[]).length` instead of the exact count it requested
  (`inventory.ts:1131-1139`), so `low_stock_count` is capped by the row limit.
- **Severity:** P3 (threshold + count bug) / P2 (reorder points as a product gap) · **Likelihood:** HIGH ·
  **Confidence:** HIGH
- **Remediation approach:** per-product (or per-level) reorder point + safety stock, with the global 10 as a default;
  use the returned `count` for `low_stock_count`.
- **Owner:** founder (product scope) + lead engineer · **Reversibility:** fully reversible.

---

### G-D-17 — Stock-count / cycle-count engine is dead code
- **Domain:** inventory
- **Status:** DORMANT_FLAGGED
- **Evidence:** `services/api-gateway/src/lib/inventory-audit-variance.ts` exports `computeVariance`,
  `reconcileSessionLines`, `summarizeSession`, exercised only by
  `services/api-gateway/src/__tests__/inventory-audit-variance.test.ts`; a repo-wide grep finds no other importer; no
  `inventory_audit` / `stock_count` / `cycle_count` table exists in any migration; no route, no UI.
- **Impact:** a physical-count workflow appears to exist to anyone reading the codebase but delivers nothing.
- **Severity:** P3 · **Likelihood:** LOW · **Confidence:** HIGH
- **Remediation approach:** either finish it (table + route + UI) or delete it and its test under the normal deletion
  law. Do not leave it as ambiguous half-evidence.
- **Owner:** lead engineer · **Reversibility:** fully reversible.

---

### G-D-18 — Suppliers cannot be edited, deactivated, or deleted
- **Domain:** procurement
- **Status:** PARTIAL
- **Evidence:** gateway exposes only `GET /inventory/suppliers` (`services/api-gateway/src/routes/inventory.ts:300`)
  and `POST` (`:334`); there is no `[id]` proxy directory under
  `apps/merchant-control-plane/src/app/api/stores/[store]/suppliers/`; `suppliers.status` supports
  `active|inactive` (`000_baseline.sql:12475`) and `deleted_at` exists (`:12474`) but nothing writes either.
- **Impact:** a typo in a supplier name or a dead vendor is permanent and permanently listed in the PO dropdown.
- **Severity:** P3 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** add PATCH (edit + status) and a soft-delete, both behind `products:write`.
- **Owner:** lead engineer · **Reversibility:** additive.

---

### G-D-19 — No REVOKE on any inventory/procurement `SECURITY DEFINER` RPC (default PUBLIC EXECUTE)
- **Domain:** security (defence in depth)
- **Status:** PARTIAL
- **Evidence:** across all 187 migrations the only function-level grant statements are
  `195_contact_requests.sql:327-328`. No `REVOKE`/`GRANT EXECUTE` appears in `141`, `088`, `166`, or `000_baseline.sql`
  for any inventory RPC. Several take no tenant proof at all — e.g. `receive_purchase_order(p_purchase_order_id, …)`
  (`000_baseline.sql:5012`) and `release_order_inventory(p_order_id, …)` (`:6995`) accept only an entity id.
  Mitigating: no browser-side Supabase client was found; `SUPABASE_ANON_KEY` appears only as a Worker binding
  (`services/api-gateway/src/index.ts:103`).
- **Impact:** if either PostgREST role key is ever exposed, arbitrary cross-tenant stock manipulation is one HTTP call
  away.
- **Invariant:** [HIGH-STAKES]
- **Severity:** P2 · **Likelihood:** LOW (given no client-side key today) · **Confidence:** HIGH
- **Remediation approach:** follow the `195_contact_requests.sql` precedent — `REVOKE ALL … FROM PUBLIC` and
  `GRANT EXECUTE … TO service_role` for every money/stock RPC.
- **Owner:** security · **Reversibility:** fully reversible.

---

### G-D-20 — Merchant purchase cost is served to unauthenticated storefront visitors
- **Domain:** procurement ↔ storefront (cross-domain; products owner may co-own)
- **Status:** BROKEN
- **Evidence:** `services/api-gateway/src/routes/storefront/public-routes.ts:834` selects `'*'` from `products` for the
  public product-detail route; the alternate select `PRODUCT_SELECT_FULL` explicitly names `cost_price` (`:31-32`).
  `products` carries `cost_price` (`000_baseline.sql:10604`) and `cost_per_item` (`:10617`).
- **Impact:** competitors and shoppers can read the merchant's buying price and margin.
- **Invariant:** none constitutional, but a merchant-confidentiality breach.
- **Severity:** P1 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** an explicit public projection with an allow-list of columns; never `select('*')` on a public
  route.
- **Acceptance:** the public product payload contains no cost field.
- **Tests required:** CONTRACT test asserting the public product response has no cost/internal fields.
- **Owner:** security + lead engineer · **Reversibility:** fully reversible.

---

### G-D-21 — Documentation asserts the sweeper is dead and the ledger fully FORCE-RLS'd; both are wrong
- **Domain:** governance / documentation drift
- **Status:** CONTRADICTORY_EVIDENCE
- **Evidence:** sweeper claimed DEAD in `STRATEGIC_CANONICALIZATION_2026_06_10/PRODUCTION_READINESS_GAP_REPORT.md:233`
  and still listed as an open roadmap item in `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FOUNDATION_ROADMAP.md:488`, while
  it is wired at `services/queue-workers/src/index.ts:620-635` + `services/queue-workers/wrangler.toml [triggers]`.
  `docs/v1-execution/phase-5/02-inventory-ledger.md:6` claims the inventory tables are "all RLS/FORCE-RLS" —
  `inventory_adjustments` is not (G-D-12). Same doc's verdict line calls the ledger "built and canonical" with
  "No new schema" needed, which §2 contradicts. Separately, root `AGENTS.md` still claims max migration 161 while
  `database/supabase/migrations/` holds 187 files up to `195` (independently noted by the commander).
- **Impact:** planning documents send engineers to fix an already-fixed thing and to trust a tenancy guarantee that does
  not hold.
- **Severity:** P3 · **Likelihood:** HIGH · **Confidence:** HIGH
- **Remediation approach:** correct the non-archive documents; leave `docs/archive/**` as the historical record.
- **Owner:** lead engineer / doc owner · **Reversibility:** fully reversible.

---

## 13. Contradictions I could not fully resolve

- **C-1 — "Optimistic concurrency" (ART-15) vs the implementation.** `inventory_levels.version` + its auto-increment
  trigger exist (`141:9`, `:48-51`) and the integration test asserts the counter ticks
  (`tests/executable/inventory-postgres.test.mjs:216`), but no RPC parameter, no route, and no client ever supplies an
  expected version. What ships is pessimistic locking in one RPC. Whether the Constitution's "optimistic concurrency"
  is satisfied by row locking is a governance reading I do not own. → **CONTRADICTORY_EVIDENCE**, routed to ARB.
- **C-2 — The `*_quantity` column family.** `on_hand_quantity`, `available_quantity`, `committed_quantity`,
  `unavailable_quantity`, `incoming_quantity`, `reserved_quantity`, `safety_stock_quantity` are written by some RPCs and
  not others, and read by none. I cannot tell whether they are an abandoned migration target or an in-progress cutover.
  → **UNKNOWN**, needs an owner statement.
- **C-3 — `products.cost_price` vs `products.cost_per_item`.** Both exist (`000_baseline.sql:10604`, `:10617`); the
  product form writes `cost_per_item` and reads it with a `?? cost_price` fallback
  (`apps/merchant-control-plane/src/app/[store]/products/new/page.tsx:234,602`). Which is canonical is undocumented.
- **C-4 — `receive_purchase_order` tenancy.** The RPC takes only a PO id and performs no tenant check; the gateway
  supplies the check in TypeScript (`services/api-gateway/src/routes/inventory.ts:450-455`). Whether SECURITY DEFINER
  RPCs are permitted to rely on caller-side ownership is exactly the ART-08 question G-D-11/G-D-19 raise. → routed to
  security/ARB.

---

## 14. Unknowns (honest)

- **U-1 — No runtime observation.** I ran no server, no migration, no test, and touched no database. Every status in
  this file is capped at IMPLEMENTED_NOT_RUNTIME_VERIFIED unless it is an explicit absence. In particular G-D-06
  (PO receive unusable) and G-D-11 (reserve/commit/release dead) are *statically airtight but runtime-unconfirmed*.
- **U-2 — Whether `app.site_id` is set outside the repository.** A Supabase `pgrst.db_pre_request` function, an
  `ALTER ROLE … SET app.site_id`, or a connection-level setting configured in the Supabase dashboard would invalidate
  G-D-11. None exists in `database/`, but dashboard state is not in the repo. → **BLOCKED_EXTERNAL**.
- **U-3 — Whether `SECURITY DEFINER` inventory RPCs bypass FORCE RLS in the deployed database.** FORCE RLS applies to
  the table owner but not to roles with `BYPASSRLS`. Which attributes the migration-owner role carries in the deployed
  Supabase project is not in the repo. This matters for `expire_inventory_reservations`, which runs with no tenant GUC
  and must update FORCE-RLS'd `inventory_levels`/`inventory_reservations` rows across all tenants (`141:327-341`).
  The docker test passes as `-U postgres` (`tests/executable/inventory-postgres.test.mjs:29-31`), which does not settle
  it. → **BLOCKED_EXTERNAL**.
- **U-4 — Adoption.** I have no data on how many merchants use POs, transfers, or multiple locations, so likelihoods for
  G-D-09 and G-D-16 are judgement calls, not measurements.
- **U-5 — Whether any accounting/tax policy exists outside the repository.** I searched `docs/` (excluding archive) and
  found none for input GST. A policy may exist in a founder's notes or with an accountant. → route to founder + CA.
- **U-6 — `create_order_return_and_refund` restock detail.** I read the restock branch structurally
  (`000_baseline.sql:2678` + offsets ~`:2850-2955`) and confirmed it writes `inventory_levels` directly and inserts
  `restock_events`, but I did not line-by-line audit its locking or idempotency. Flagged as a residual read for
  whoever owns returns.
- **U-7 — Flutter merchant-app parity.** I confirmed the screens and service calls exist and that PO receive is
  full-only (`apps/mobile/merchant-app/lib/screens/inventory/purchase_orders_screen.dart:281-289`), but I did not audit
  the Dart API-client layer end to end.

---

## 15. Blockers

- **B-1 — CA / tax professional required before any input-GST work.** G-D-07 and G-D-13 cannot be specified, let alone
  built, from engineering judgement. I make no assertion of tax or legal compliance anywhere in this file.
- **B-2 — ARB required** for G-D-02 (moving the inventory commit to payment capture — changes the order/payment state
  machine), G-D-04 (single-writer consolidation), G-D-05 (storefront read-path change), and G-D-11 (tenancy mechanism).
- **B-3 — Deploy-time facts unreadable from the repository:** U-2 and U-3. Needs an operator with database access to
  answer, read-only.
- **B-4 — Founder scope decision** for G-D-08 (PO lifecycle + supplier bills), G-D-13 (valuation method), G-D-16
  (reorder points) — these are product scope, not defects.

---

## 16. Method note

Everything above was derived by reading source. Commands used were `ls`, `grep`, `sed -n`, `awk`, `wc -l`, and file
reads. No git state was changed, no service was started, no database was contacted, no test was executed, no package was
installed. No secret value, token, connection string, `.env` content, or personal datum appears in this file — only
environment-variable **names** (`INVENTORY_RESERVATION_SWEEPER_LIMIT`, `SUPABASE_ANON_KEY`, `CUSTOMER_SESSION_SECRET`)
and whether they are present in configuration.
