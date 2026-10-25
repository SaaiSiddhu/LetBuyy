# 388 bounded independent follow-up — closed for reviewed scope

**Final evidence addendum:** isolated owner N7 run `68fc2c08fd36` now passes11/11, zero skips, with explicit prepared2 and complete cleanup. `review-388-final-closure.json` pins its native receipt, candidate parity and programme source-match records. Current UP/DOWN hashes below remain identical to the tested bytes. This reviewer verified every required candidate-parity file and rollback349's byte equality with HEAD/prior receipt; the349 expected-digest change is confined to its test pin. Existing stderr diagnostics only improve failure output; assertion conditions and ownership/catalog guards remain intact. No new execution or production edit was performed. F1–F4 and the requested delta remain closed; N7 is no longer pending. Keep the59 related passes and11 isolated N7 passes as separate cohorts.

23 October 2026. **No remaining actionable source finding in the requested delta. F1–F4 are closed for this bounded review.** Original findings and their manifest are preserved. This reviewer inspected sources, exact hashes and the owner's executed receipt; no production/SQL edit, DB rerun, snapshot-suite repeat or browser resource was performed.

Current UP SHA-256: `9de7c35b68684cd5d3c752166e5c6ae0b33c64c6b1ea8ac353a82bcac936d2c3`.
Current DOWN SHA-256: `12d10a0ef5043cfa330356dfae1b31b58df3c06f393c1d0db208ee4a9513ac5b`.
The capture remained unchanged through completion. `review-388-followup-manifest.json` pins all inspected sources and the final receipt; `review-388-followup-results.json` records checks and limitations.

| Boundary | Independent source disposition |
| --- | --- |
| Closed/converted cart | `services/api-gateway/src/routes/storefront/cart-routes.ts:586` loads the existing cart including closed rows; `:588` rejects non-active state and `:591` rejects origin changes **before hydration at :595**. The write still predicates active status at `:621`, so a conversion during hydration cannot overwrite the converted row. |
| Raw legacy bare variant | UP `:217`–`:228` permits a missing selected UUID only for a raw item without cart reference, with empty common facts and **no** variant metadata, option values or relational options anywhere on that product. Server cart acceptance still always requires its selected variant when variants exist; this compatibility branch does not create a second accepted-facts writer. |
| Facts/options/accepted cart | UP `:226` forces a selected UUID for every accepted-cart item when variants exist, and for any fact/option-bearing product. `:232`–`:258` retain active marker1/token/site/expiry, exact line count and identity, quantity/product/variant/listing/version, both fingerprints and locked raw facts/options/images. `:259` requires a cart reference for factful/configured items. Mixed raw/reference lists or multiple cart IDs are rejected at `:147`–`:152`. |
| F1 ACL/grantor | UP `:53`–`:77` now rejects unknown function overloads, unknown direct function/table/**column** grantees, non-owner grantors and unexpected backend-role membership before the marker is added. Named effective-right denial and explicit service-role writes remain at `:1708`–`:1765`. Because admitted grants must be owner-issued, DOWN can replay the journal without changing the grantor graph. The prepared/executed test at `cart-order-fact-snapshots.postgres.test.ts:71` captures pre-UP table/column/function ACLs, grant options, owners, memberships and effective access, asserts immediate post-DOWN equality, and exercises unknown/delegated catalog mutants plus a legitimate column-grant-option control. |
| F2 marketplace configurations | UP `:816`–`:826` distinguishes product/variant/**configuration/listing** at the duplicate gate. Equal canonical configurations still merge in the cart; distinct instructions retain separate immutable identities. Initial listing bind at `:984`–`:995` and receipt checks at `:1077`–`:1087` use captured cart/line/version/configuration/snapshot identities. Same-key historical recovery remains before mutable catalog consultation; buyer-bound replay still goes through the live buyer wrapper at `:846`. Fresh approval/site/listing checks remain in the ordinary path. |
| F3 DOWN inventory | DOWN `:55`–`:60` now covers common facts, variant metadata, variant option values, relational option rows and active accepted carts. Supported retirement then restores166/234/278/385 behavior while preserving historical snapshots. All four UP bodies match their paired DOWN guards, and all four DOWN bodies match UP predecessor guards:8 mechanical body-hash checks passed.386 dependency refusal remains present. |
| F4 lock order | UP marketplace `:859`–`:872` now acquires cart→inventory→variant→options→product before its product/site/listing checks, matching the lower writer `:153`–`:166` and product editor. Existing listing approval checks are retained. The owned cases at test `:342` and `:372` positively hold the inventory barrier, check product-lock availability, exercise two real marketplace calls and distinguish explicit stale rejection from partial effects/deadlock. |
| Atomic consumption/replay | UP `:485`–`:488` marks the accepted cart converted inside the order transaction. All referenced lines must describe the same complete cart, so one last-line variable cannot consume a different cart. Matching captured same-key receipts remain recoverable at `:1076`–`:1089`; changed captured intent conflicts. The owned different-key and injected-failure cases at test `:361` / `:403` cover one effect and transaction rollback. |

## Executed owner evidence, independently inspected

Use `docs/implementation/niche-themes-2026-10-23/madeyours/final-gate-results.json`, run `2250e55744bb`. Each result's applied migration388 digest matches the current UP hash above. The receipt records positive ownership before startup and complete cleanup with no remaining containers/networks/volumes.

| Suite | Recorded result |
| --- | --- |
| Snapshot/cart/security |23/23, exit0, no skips |
| Authenticated checkout |10/10, exit0, no skips |
| Hosted buyer ownership |15/15, exit0, no skips |
| Refund reconciliation |11/11, exit0, no skips |
| N7 ledger traversal, historical first attempt |0/1: ownership/environment guard refusal; subsequently resolved by isolated run68fc2c08fd36,11/11 |

The four named suites have **59 passes**. That historical five-suite receipt remains59/60 because it includes the earlier guard refusal; it has not been rewritten. The later isolated N7 receipt is11/11 and closes that acceptance gap. This reviewer did not execute those PG cases. Native migration receipts pin applied UP bytes; the candidate/parity and programme source-match receipts additionally identify the owner-reported tested DOWN bytes, which match current source. No complete Worker release-artifact identity is inferred.

Older `owned-db-results.json` / `checkout-ledger-regression-results.json` name the earlier `d0f237…` migration, while `evidence.json` still has older source hashes/queued-DB wording. These remain historical checkpoints; central promotion records should link the matching **final-gate-results.json** receipt and this current manifest. No extra rerun is requested merely to replace an evidence pointer.

This disposition closes the requested source/security review. It does not certify hosted deployment, provider behavior or the full installed storefront lifecycle. Kindred's accepted form/factory sources stayed frozen throughout.
