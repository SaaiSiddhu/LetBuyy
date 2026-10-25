# Marginalia installed lifecycle fixture plan

Prepared data only. **All 16 installed lifecycle cases are NOT_RUN.** No products, variants, collections, carts or orders have been created by this handoff. Runtime UUID bindings and case evidence remain null in [the executable-owner matrix](./installed-book-stationery-lifecycle.matrix.json).

Current phased guidance: Themes requested the [fresh936 nonorder packet](./stable936-nonorder-editor-packet.md) for sole Editor after Trailmark and a named grant. It covers identity/setup, installed resources/full A/B recovery, selected editions, stationery and discovery only. It preserves Pantry6284/Lentils2/₹360/tab53 and excludes all cart/checkout/order/history/later-edit actions. The exact16-case matrix remains sealed; no preparation is an execution result or active lease.

Editor owns the programme's one fixture helper and publication workflow. Root routes these entries to that owner; this handoff adds no seed harness, API, browser session or database process. Existing source and frozen review captures remain unchanged.

## Current execution route

The coordinator froze the existing 14-product recipe after this initial handoff. Do not replace or expand that shared seed. Once the final fixture and lease are allocated, refine its existing book and stationery through normal merchant UI, keep both acknowledged book variant UUIDs, and add only the missing stock-zero English paperback. Remove sample ISBN/common bibliography and apply the exact facts below. The original before-creation instructions below remain historical setup context; the [current readiness handoff](./INSTALLED-LIFECYCLE-READINESS.md) governs execution. For later catalogue edits, preserve the actual post-order stock read back by the form; do not reset initial stock or bypass the normal UI to omit serialized fields.

The shared diagnostic buyer cart has an owner-reported two-Pink-Clay baseline. Before Marginalia starts, the serialized handoff must acknowledge its actual line identities and provide explicit preservation/restoration handling. The Marginalia COD order must consume only its book quantity 1 and notebook quantity 2; never consume another theme’s cart lines or stock. [The pending allocation request](./installed-lifecycle-readiness/cart-handoff-request.json) is coordination evidence, not a current runtime grant.

## Two canonical products

Replace the existing `key=books` entry with [the book edition payload](./book-editions-create-product.plan.json), rather than adding another book. Add [the separate stationery payload](./stationery-create-product.plan.json) once if it has not already been integrated. The original 13-product plan becomes 14 products; the additional apparel entries are unaffected. Replace the book entry completely so that old sample ISBN/common bibliography values cannot leak into the fictional editions.

| Binding key | Available stock | Unit price (INR) | Exact supplied facts |
| --- | ---: | ---: | --- |
| `books.en_hardback` | 4 | 590 | Mira Sen; English; hardback; Illustrated second printing; 192 pages; 156 × 234 mm |
| `books.hi_paperback` | 4 | 420 | सिंथेटिक लेखक; Hindi; paperback; First printing; 160 pages; 140 × 216 mm |
| `books.en_paperback_oos` | 0 | 450 | Dev Rao; English; paperback; Third printing; 176 pages; 148 × 210 mm |
| `product.stationery` | 6 | 320 | Lined; 100 gsm; 148 × 210 mm; 96 pages / 48 sheets; Thread sewn; one notebook |

The book's common `metadata.books` contains only `kind=book` and subject Essays. Each relational variant supplies its own author, language, format, edition, pages and dimensions in `variant.metadata.books`. No ISBN, publisher, year or excerpt is supplied. Stationery has `kind=stationery`, no book bibliography and no invented variant. Pages and sheets describe one notebook; they do not describe cart quantity.

The existing owner helper must inject the real fresh store UUID, substitute `runId`, resolve the existing asset paths against the actual local commerce origin, and revalidate the final command. Bind acknowledged product/variant UUIDs by canonical readback once. Subsequent selection, checkout and edits use those UUIDs, including after labels change.

## Acceptance sequence

The [JSON matrix](./installed-book-stationery-lifecycle.matrix.json) contains exact steps, expected values, existing selectors, saved-snapshot oracles and later edit data.

| Cases | Proof required from the future installed run |
| --- | --- |
| `MG-ID-01`, `MG-INSTALL-01` | Canonical creation/readback; installed Marginalia v2 receipt; saved product/collection links; local publish and reload through the existing Editor workflow |
| `MG-BK-EN-01`, `MG-BK-HI-01`, `MG-BK-OOS-01` | Real selected UUID, facts and price switch together; unavailable edition blocks both purchase actions and has no accepted cart effect |
| `MG-PAPER-01`, `MG-RULING-01` | Separate stationery PDP; exact gsm/mm/page/sheet facts; real supplied lined facet and product count |
| `MG-AUTHOR-01` | Available same-variant author/language/format positives and impossible conjunctions; no cross-variant matching or unavailable witness |
| `MG-QUERY-01`, `MG-CLEAR-01` | Real collection and search responses; sort and pagination; independent canonical clear URLs; unrelated and repeated query values survive |
| `MG-CART-01`, `MG-CART-RELOAD-01` | Book quantity 1 plus stationery quantity 2; correct durable identities and server acceptance survive reload |
| `MG-COD-01`, `MG-HIST-BASELINE-01` | One local COD order; server totals and immutable accepted facts/options read back in buyer and merchant views |
| `MG-LATE-EDIT-01`, `MG-HIST-AFTER-EDIT-01` | Existing merchant save changes the live catalogue while the accepted historical order retains its original facts, options and prices |

The two-product collection must contain only these acknowledged products for exact count/sort assertions. Search assertions must retain that canonical collection scope or otherwise establish the exact dataset; the shared store has additional products. The listing's persisted book price is ₹420; selecting the English hardback costs ₹590. Do not substitute a variant witness price into listing expectations.

The accepted cart oracle is ₹590 × 1 + ₹320 × 2 = **₹1,230 item subtotal**. Tax, shipping, discounts and the grand total come from actual server calculations. Snapshot examples are comparison data only and must never be submitted as accepted cart/order facts.

After COD acceptance, edit the same English hardback variant UUID to Marathi / spiral-bound / 224 pages / 170 × 240 mm / ₹690. Edit the separate notebook to dotted / 120 gsm / 120 pages / 60 sheets / 150 × 215 mm / ₹380. Preserve post-order stock by omitting stock updates and retain the other variant UUIDs. The saved order must still show the original English hardback and lined notebook facts, prices and options.

The selected-edition controller exposes author, language, format, edition and dimensions; verify page count in the matching `.mg-edition[data-variant-id]` comparison row. Historical formatting uses `Hardback`, `100 g/m²`, and `Width … mm · Height … mm`; assertions must scope these values to the accepted order line. Use the existing buyer and merchant order mappers rather than live catalogue fallback.

## Validation boundary

[Canonical schema evidence](./installed-fixture-schema-validation.json) records **7 passing schema checks**: both full create commands, all three book variants, the later existing-variant edit shape and the later stationery facts. Validation used an explicitly synthetic UUID and `example.invalid` media origin only; neither is a runtime fixture identity. Each actual bound command still requires validation at execution time.

Schema validity does not prove installed rendering, persistence, discovery SQL, stock rejection, checkout or historical immutability. Those 16 cases remain NOT_RUN until root allocates the single fresh fixture and admits the final source/release receipts.
