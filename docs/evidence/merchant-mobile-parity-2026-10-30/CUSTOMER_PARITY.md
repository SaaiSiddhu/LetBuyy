# Customer workspace parity — rows 105 and 106

Source checkpoint: `ff5eada8c409ed7350bec1e872a01a9b669dc32c`, branch `codex/merchant-mobile-parity`, 30 October 2026. Disposition **A + E**: native Merchant tasks with repaired defects. Highest proved scope: local Flutter/service behavior and the real Gateway over owned disposable PostgreSQL/PostgREST. This document does not accept the entire customer area or the 122-item programme.

## Authority and call trace

| Surface | Row 105: list/detail | Row 106: segments |
|---|---|---|
| Actor | Authenticated Merchant with current accessible site; owner path exercised | Same; owner path exercised. Staff permissions remain an acceptance gate |
| Merchant web | `apps/merchant/web/src/app/[store]/customers/page.tsx`, `[email]/page.tsx`; `/api/stores/[store]/customers` and `[email]` BFFs | `[store]/customers/segments/page.tsx`; `/api/stores/[store]/customers/segments`, `/preview`, `/[id]` BFFs |
| Native navigation | `AppRoutes.customers` `/customers`; `AppRoutes.customerDetail` `/customers/detail` | Customers → Segment; select segment → Edit selected segment |
| Native owner | `CustomersScreen`, `CustomerDetailScreen`, `CustomerService` | `CustomerSegmentSheet`, `CustomerService.createSegment/updateSegment/previewSegment/fetchSegments/fetchSegmentCustomers` |
| Shared client/contract | Dart `CustomersApi`, `CustomerContract`; canonical `CustomerSchema`, `ListCustomersQuery` | Dart `CustomerSegmentsApi`, `CustomerSegmentContract`; TS `CustomerSegment`, `CustomerSegmentRulesSchema`, create/update/preview Zod schemas in commerce-core |
| Mounted Gateway | `services/api-gateway/src/index.ts` → `customersRouter`, `/v1/customers`, `/v1/customers/:email`; notes/addresses/orders follow current explicit site | GET/POST `/v1/customers/segments`, PATCH `/segments/:id`, POST `/segments/preview`, GET `/segments/:id/customers` |
| Authorization | Global Merchant authentication; `resolveOwnedStoreScope` / live site ownership; global protected-mutation idempotency. This is not a new identity authority | Same. ID-addressed edits use `resolveMerchantResourceStoreIds`; web now passes the resolved route store through `createMerchantApiClient(resolved.storeId)` |
| Data/effects | `sites`, `users_custom`, `store_customers`, `orders`, addresses, notes/tags; tenant guard plus PostgreSQL policies | `customer_segments` and customer summaries from the same site; real positive-control tenant RLS demonstrated. No new schema, runtime or provider |

## Repaired behavior

- A failed list no longer returns another store's or query's global in-memory customers. Offline fallback is keyed to actor, site, search, cursor, page and limit. Explicit access denials suppress other cached queries for that site until a successful authorized read. The list labels an offline snapshot.
- Detail authorization errors no longer fall back to a cached profile. Opening detail performs an authorized read rather than treating a route's initial customer object as authority. Failure clears private detail sections and available customer commands.
- List, detail, segment reads, dialogs, creation forms, export polling and late results are fenced by account/store context. A retired A→B→A response cannot repopulate customer state/cache. A changed form disappears and cannot dispatch its former-store action.
- Customer browsing now exposes next/previous cursor-backed pages and debounced server search. Segment member pages use the existing page endpoint; its local search is explicitly labeled “Filter this segment page”. Page metrics describe the loaded page, not all customers.
- Segment read failure has its own warning; it cannot hide a successful primary customer list. Post-create customer lists reload from the server.
- Native segment creation/editing supports name, description, canonical status, all/yes/no marketing consent, tags, minimum orders, minimum spend, and inclusive UTC date ranges. Validation rejects negative thresholds, malformed dates, reversed date ranges and oversized inputs. Preview counts retire when rules change.
- Save confirmation reads the segment registry and checks the returned name/description/rules. A lost mutation acknowledgement retains the same logical key/payload in the open editor; a failed readback retries confirmation without another creation. This is not app-restart persistence or proof that every server failure window is atomic.
- Web and mobile use the canonical status values `active`, `disabled`, `invited`. The web form formerly offered `blocked`, which the actual Zod schema rejects.
- Customer summaries sum rupee-valued commerce order totals. The web segment form previously multiplied input by 100 and divided it on edit/display; that mismatch is removed. No existing stored threshold was rewritten because its intended value cannot be inferred safely from a number alone.

## Evidence

| Check | Result / boundary |
|---|---|
| Full Merchant Flutter suite | **433/433 pass**, `/private/tmp/letbuyy-mobile-customer-full-tests.log`; Flutter analysis clean |
| Customer scope/service/widget regressions | **16/16**, `customer_scope_boundary_test.dart`; authorization/cache denial, exact offline scope, foreign rows, query/result races, A→B→A, open form/detail retirement, segment outage isolation, cursor paging and server search |
| Native segment editor | **6/6**, `customer_segment_editor_test.dart`; full rule preservation, validation, stable retry identity, confirmation-only retry, changed-store retirement and stale preview |
| Web form / actual BFF + shared SDK | **3/3**, `tests/customer-segment-units.test.ts`; rupee roundtrip vs commerce summaries, zero/fraction/consent/date rules, selected-store header on actual PATCH handler. Merchant web typecheck clean |
| Gateway focused customer unit/contract suites | **11/11**, customer pagination and activity bounds. Gateway typecheck clean |
| Actual worker + owned PostgreSQL/PostgREST | **4/4**, `merchant-customer-segments.postgres.test.ts`, run **b545a4e97bf4**. Real owner authentication, list cursor/search, preview, create/replay/edit/readback/member filtering, foreign denial, injected read failure, invalid-status denial, same-owner two-store refusal and positive-control RLS. Cleanup verified: no remaining owned containers/networks/volumes. Receipt `/private/tmp/letbuyy-mobile-customer-db-final.json` |
| Behavioral negative control | Temporarily allowing unsafe cache fallback makes the 403 privacy test fail. Original service restored byte-for-byte (SHA-256 `8331a55932bbca8dcf8f950fcb3294b153f5fee57037be9842d55b4ebf3aa657`); restored regression passes. `/private/tmp/letbuyy-customer-cache-mutant.log` |
| Full governance gate | **114 PASS, 0 FAIL/BLOCKED/SKIP**, one report-only N/A. Run in exact disposable clone; `/private/tmp/letbuyy-customer-governance.json` |

## Open acceptance

Authenticated web/native two-direction edits, revoked staff/membership, concurrent web/native changes, export privacy/receipt behavior, customer merge/delete/address transaction acceptance, restart/lost-response command recovery, accessibility/performance and hosted/device/release acceptance are not closed by these tests. The global idempotency middleware's separate claim/operation/receipt failure windows are not certified atomic by a normal successful replay test. The complete RT-1…RT-9 programme is also not replaced by this scoped RLS test.

The primary checkout still has its separate uncommitted Merchant web patch, including two changed lines in the segment page. Its old spend conversion/status options remain present in that checkout. Nothing was overwritten or copied from it. Reconciliation must preserve that patch when accepting these branch changes. Both current web customer list pagination and the segment page's “View customers” query binding still need a complete browser trace; file presence is insufficient acceptance.

## Authenticated Android continuation

Checkpoint `66543f2b69d52cc32906f874bfb0b5fe5a22d789` built and installed with SHA-256 `273068fcb7c59ddcf901b3f33eb7ec4fa1a292442248b1179e275695539d0300` on the task-owned Android 15/API 35 emulator. The authorized production owner reached the customer list and a fresh detail page. A server search for `zz-parity-no-match` showed **No matching customers** in the rebuilt app; see `android-customer-search-66543.png` (contains no customer records). This adds a seventeenth customer scope regression to the 438-test suite. No customer create/edit, segment save, staff/revocation or web/mobile write parity is accepted by these read-only observations.
