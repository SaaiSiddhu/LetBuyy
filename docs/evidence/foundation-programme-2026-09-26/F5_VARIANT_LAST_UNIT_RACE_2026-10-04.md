# F5.5 variant last-unit checkout race — 4 October 2026

## Outcome

The canonical storefront checkout now translates the inventory RPC's
`INSUFFICIENT_INVENTORY` result into a sanitized HTTP 409 conflict. This gives a
buyer a recoverable response when another checkout consumes the requested stock
before their own order commits.

The owned database acceptance test creates a synthetic product variant with one
available unit and two active synthetic buyers. It holds both real Gateway
requests at `create_checkout_order_for_buyer` through the allowed Gateway to
PostgREST test seam, then releases them concurrently into the canonical RPCs.

## Verification

At source HEAD `0862687a5008d604d0df23357b2eb511293139fa`, branch
`letbuyy/phase2-shared-buyer-identity`:

| Check | Result |
| --- | --- |
| `node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/authenticated-checkout.postgres.test.ts --kind gateway-db --jobs 1 --log-dir /private/tmp/letbuyy-f5-inventory-race-20261004 --json-out /private/tmp/letbuyy-f5-inventory-race-20261004.json` | Pass, 6/6; 0 failed, 0 skipped; run `c2bc9001d0a7`; Postgres 16 + PostgREST + real Gateway worker |
| `pnpm --filter @letbuyy/api-gateway run typecheck` | Pass |
| `git diff --check` | Pass |

The simultaneous requests produce one 201 order and one 409 conflict with a
buyer-safe message. Database assertions confirm exactly one order item, buyer
ownership link, committed reservation and `sale` adjustment for that variant.
`available`, `available_quantity`, `reserved`, and `reserved_quantity` are zero;
`committed_quantity` and `on_hand_quantity` are one; `product_variants.inventory_qty`
is zero. The losing response does not expose the SQL error or inventory table.
Runner cleanup reports no retained containers, networks, volumes or database.

## Boundary and remaining work

This verifies one last-unit concurrent storefront checkout path locally. It does
not accept all of F5.5 or Phase 8. Timeout release and late capture after release,
merchant stock adjustment/audit journeys, client/browser/device checkout, and
hosted/provider verification remain open. No shared or hosted database was used.

## 7 October buyer-safe conflict projection revalidation

The last-unit race already returned HTTP 409, but its inventory-specific
condition used the generic `CONFLICT` code. The hosted checkout BFF therefore
replaced the Gateway's useful stale-stock explanation with the generic
“Checkout could not continue” message. The Gateway now identifies this
condition as `INSUFFICIENT_INVENTORY`; the BFF projects that code to a bounded
buyer message asking them to review their cart. The existing checkout handler
shows returned errors and only clears the cart after success.

| Check | Result |
|---|---|
| Owned `authenticated-checkout.postgres.test.ts` | **9/9 passed**, zero failures/skips/TODOs (`f5bafc2764a3`); two buyers racing for one unit produce one order, one buyer-safe 409, and exactly one set of inventory/order effects. Runner cleanup is clear. |
| Commerce checkout BFF `route.test.ts` | **9/9 passed**, including a specific confirmation that the 409 code/message are safely projected with `no-store`. |
| API Gateway typecheck | Passed. |
| `git diff --check` | Passed after implementation/evidence updates. |

The owned database suite first caught an obsolete assertion that rejected the
newly surfaced stable code; the assertion was corrected to permit that code
while continuing to reject SQL and table details, and the full suite then
passed. This verifies the real Gateway/Postgres race boundary and the BFF
projection separately. At the time of this projection-only revalidation,
Chromium had not yet exercised the conflict; the subsequent section records
that local browser journey. Provider, physical-device and hosted acceptance
remain outside this local evidence. The change does not alter stock
reservation behavior or permit a checkout retry to bypass inventory checks.
See the [sanitized owned-run record](F5_VARIANT_LAST_UNIT_RACE_OWNED_REVALIDATION_2026-10-07.json).

## 7 October real checkout browser failure and retry journey

The owned `checkout-browser.postgres.test.ts` suite now verifies the buyer
experience when stock changes after delivery selection and immediately before
confirmation. The synthetic fixture depletes the owned Postgres row at the
confirm boundary, and the normal Commerce storefront-to-checkout handoff,
Commerce BFF and real Gateway/PostgREST/Postgres path returns HTTP 409 with
`INSUFFICIENT_INVENTORY`. Chromium sees the safe review-cart message, retains
the local cart token, and verifies that no order for the buyer is created and
the checkout remains incomplete. No page error occurs. The fixture then makes
one unit available again and retries confirmation in the same browser checkout.
The test captures both confirmation request bodies and asserts that the
nonempty idempotency key is reused. The UI reaches `Order Confirmed!`, and database
assertions find exactly one order and one completed checkout. Thus recovery
after a stock conflict is exercised end to end without bypassing the Gateway's
inventory check.

The initial owned browser run passed **4/4** with zero failures, skips,
cancellations or TODOs (`780df4d7c6a7`). The retry-enabled rerun also passed
**4/4** (`2cda33e4da17`), with 742 proxy requests forwarded, none refused and
one upstream error; runner cleanup left no containers, networks, volumes or
database. The fixture simulates the competing stock change with an owned
database update rather than a second browser purchase; the separate
`authenticated-checkout.postgres` suite verifies the concurrent two-buyer race
through the actual Gateway. Together these provide owned local race, buyer-UI
failure and same-checkout recovery evidence, not hosted, provider or device
acceptance. See the [initial Chromium run](F5_VARIANT_LAST_UNIT_BROWSER_OWNED_RUN_2026-10-07.json)
and [retry-enabled Chromium run](F5_VARIANT_LAST_UNIT_BROWSER_RETRY_OWNED_RUN_2026-10-07.json).

## 7 October timeout-sweep replay regression added

The owned `inventory-reservation-lifecycle.postgres.test.ts` journey now
invokes the unpaid-reservation sweeper a second time with a distinct request
ID after the first release. It asserts the later sweep finds no eligible
reservation, available/committed inventory is unchanged, the reservation stays
released, and only one `sale_released` inventory event exists. This covers
idempotency across separate worker invocations, not only the state transition
made by one sweep.

The owned database runner was attempted once (`4ec13915e76b`) but refused to
start the suite because no real Docker daemon answers `docker info` (zero tests
executed). Gateway typecheck passes and the source-level inventory lifecycle
suite passes **3/3** through direct `node --import tsx --test`; the package
`tsx` launcher itself was blocked by sandbox `EPERM` creating its IPC pipe.
`git diff --check` passes. The new repeated-sweep database assertions therefore
remain unverified until the owned runner can provision Postgres. No production
or shared database was contacted.

### Correction — owned database replay verification

The earlier integration limitation was environmental, not a test failure. A
reviewed local escalation allowed the repository runner to provision its
disposable Postgres 16/PostgREST stack; the updated lifecycle suite passed
**1/1**, zero failures/skips/TODOs/cancellations (`53ec1183300e`). This
exercised the first expiration and later sweep with a distinct request ID,
confirmed stock stayed at `available=4` and `committed_quantity=1`, the
reservation remained `released`, and exactly one `sale_released` inventory
event existed. Ownership was verified before start; cleanup reported no
failures or remaining containers, networks, or volumes. The earlier Docker
preflight refusal is retained above as history and superseded for this suite.
The sanitized [run record](F5_INVENTORY_RELEASE_REPLAY_OWNED_RUN_2026-10-07.json)
contains the final runner verdict.

## 7 October late-capture-after-release revalidation

The existing hosted-checkout regression also covers the late-capture case
required by F5.5. The current owned suite was rerun against disposable
Postgres 16/PostgREST and the real Gateway worker: **8/8 passed**, including
the late-capture path. After the unpaid reservation is released, the captured
payment is recorded once, the cancelled order remains unfulfillable, one
refund obligation stays pending, no `order.paid` event is emitted, and a
confirmation retry replays without a provider lookup or duplicate money
effect. The runner verified fixture ownership before start and removed all
containers, networks and volumes; cleanup failures were zero. API Gateway
typecheck and scoped `git diff --check` pass. The first unprivileged invocation
was blocked at Docker preflight before tests ran; the reviewed rerun passed as
run `2af4352a4549`. See the sanitized [owned-run record](F5_LATE_CAPTURE_OWNED_RUN_2026-10-07.json).

This is a synthetic local provider adapter and owned-database result, not
provider sandbox, hosted, browser/device, or production-payment acceptance.
Physical-device acceptance and broader Phase 5 requirements remain open;
Phase 8 remains open for provider, refund, fulfillment, and channel acceptance.
