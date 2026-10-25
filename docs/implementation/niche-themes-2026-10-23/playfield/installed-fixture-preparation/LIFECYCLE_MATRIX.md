# Playfield installed fixture and lifecycle matrix

Prepared 2026-10-23. **Every runtime row below is NOT_RUN, pending allocation of the single shared fixture.** This document starts no runtime, creates no identities or orders, installs/publishes no theme, and sends no mutation. The isolated static discovery browser review is separate evidence and does not satisfy these cases.

Use the existing `toys` entry from Editor's 14-product plan, byte-equivalent in `toys-fixture-proposal.json`. Do not add a second fixture product, change Editor's plan, or start another database/app stack. Source validation is in `schema-preparation-receipt.json`; exact `CreateProductSchema` validation reports only missing `store_id`. The full create command and later versioned updates must validate again after canonical readbacks supply real bindings.

## Bindings and acceptance record

Record the allocated origin, site UUID, installed theme UUID/version, product UUID/version, each Edition's durable variant UUID, collection UUID, shipping rate UUID, cart UUID/version and order UUID from actual canonical responses. Until then, all binding values in the proposal remain null. Titles and Edition labels identify matrix rows only. Never correlate identity through SKU, guess a UUID, or call a second writer.

Before each mutation record the exact accepted cart/product version, selected variant ID, options, resolved facts, media and server totals. Retain request idempotency key and canonical response/readback, excluding credentials. A lost reply must replay the same command/key; a changed draft needs a new command after explicit reread/review. Preserve sibling variants, existing metadata namespaces, stock and options when applying an edition fragment.

## Supplied product facts

Price: 480 INR, India origin, tax disabled, inventory tracking on, selling out of stock off. There is no supplied media path. Verify an honest empty-media state; do not invent a product photo. Product stock is 8 and edition stocks are 4/2/3 (sum 9) in the existing plan. Keep this distinction visible and observe canonical per-variant stock authority; do not silently rewrite the plan.

| Edition | Expected resolved facts | Stock baseline |
| --- | --- | --- |
| Inherited | Age 6–8 and supplied age prose; art; 12 tiles + 2 idea cards + 1 tray (15 complete items); tray 24×19×1.5 cm; each tile 5×5×0.6 cm; Wood; Sample blue finish; one explicitly fictional, attributed warning | 4, subject to real readback |
| Unknown facts | No age band/prose; art still inherited; empty contents with completeness false; dimensions null; no additional dimensions or warnings; **Wood still inherited**, because materials is omitted | 2, subject to real readback |
| Paper | Age 9–12 with no inherited age prose; art; 36 paper sheets, complete; A5 sheet 21×14.8 cm with no inherited height; no tile measurements; Paper; no inherited warning | 3, subject to real readback |

An empty warning list means no warning statement was supplied for that edition. It must never become a claim of certification, safety, absence of hazards, or suitability for every child. Adult shoppers use merchant age/interest recommendations; no child profile, name, age, birthday or other child data is collected.

## Runtime cases

| ID | Journey and evidence required | Expected outcome | Status |
| --- | --- | --- | --- |
| PF-I01 | Fixture owner supplies fresh canonical product, all three variants, collection, theme and shipping readbacks; validate bound create with `CreateProductSchema` | IDs are durable and owned by the allocated site; facts/options/stocks match plan; no fabricated binding | NOT_RUN |
| PF-I02 | Install current canonical Playfield v2 into that store, open editor, save a visible setting, reload/reopen, preview, local publish and buyer reload; then exercise previous saved version/rollback through existing owner flow | Setting and chosen version persist; published buyer sees accepted version; rollback restores accepted prior document | NOT_RUN |
| PF-I03 | Adult collection and search choose age 6–8 and art, Apply, pagination, reload, clear age only and interest only | Canonical backend results and query state agree; unrelated values/repeated parameters remain; page resets; no inferred child data | NOT_RUN |
| PF-I04 | Query a confirmed empty age/interest intersection in the allocated data; use independent clear and clear all | Honest empty state; no fabricated facet option; controls/clear links remain usable and actual server results recover | NOT_RUN |
| PF-I05 | PDP choose Inherited → Unknown facts → Paper → Inherited; record durable variant ID/options and visible facts each time, then reload exact selected edition | Only selected edition facts appear; contents, age prose, dimensions, materials and warnings follow table above; no prior-selection leakage; server price shown | NOT_RUN |
| PF-I06 | Through canonical merchant editor, explicitly clear Unknown facts materials with `{materials:""}` while retaining its other overrides; save/readback/reopen and refresh buyer | Empty material statement persists, does not resurrect Wood; no warning/safety assertion is invented; version changes once | NOT_RUN |
| PF-I07 | Add quantity 1 of Inherited and quantity 1 of Paper to the same cart, reload; inspect canonical line readback | Two distinct durable variant lines; exact options/facts and server prices survive reload; no merge by product/SKU or leakage between lines | NOT_RUN |
| PF-I08 | With actual readback stock known, attempt quantity above selected variant stock; later set Paper stock to 0 through the existing versioned merchant mutation and refresh PDP/cart; restore via owner flow | OOS/add/checkout enforcement comes from server; failure changes no stock/order/payment; other editions remain available; no initial fourth OOS edition is created | NOT_RUN |
| PF-I09 | Existing local Karnataka 560001 COD shipping rate must first be seeded and read back by fixture owner. Select it in the canonical checkout and submit quantity 1, no discount | Only if server confirms 480 item + 20 shipping + 0 tax/other fees, expected total is 500 INR (quantity 2 would be 980). Record actual amounts; one COD order, no PA charge or custody rail | NOT_RUN |
| PF-I10 | Replay identical COD submission with same idempotency key, including lost-reply recovery; inspect canonical order/effect counts | Same durable order/result; exactly one order, stock effect, canonical ledger/outbox effect where applicable. A UI success alone is insufficient | NOT_RUN |
| PF-I11 | Before fact editing, create and capture an accepted old order and separately prepare an **active cart** with Inherited's blue finish; retain both canonical readbacks | Immutable old order and a separately accepted, genuinely stale-able cart exist before editing | NOT_RUN |
| PF-I12 | Change Inherited finish blue → green through existing versioned merchant editor, preserving facts/options/stock; submit the previously accepted active cart without reacceptance | Canonical order commit rejects `CART_FACTS_CHANGED`; order/stock/payment/ledger/outbox effect counts do not advance. Product version and changed fact are recorded | NOT_RUN |
| PF-I13 | Explicitly reread/reaccept updated selected facts, then create a new cart/order; reload old and new buyer order detail | New order captures green finish and accepted current facts; old order retains blue finish, old accepted options/facts/media/amounts; historical order never follows live catalog edits | NOT_RUN |
| PF-I14 | Exercise canonical version conflict, invalid fact payload, no-session/foreign-site denial and one lost-save reply within the same fixture owner lease | No partial product/variant/outbox write; draft recoverable; durable UUID retained; exact conflict/replay evidence. No guessed cross-tenant ID or alternate auth path | NOT_RUN |

## Source anchors and limits

Canonical facts/merge: `packages/commerce-core/src/playfield-facts.ts`; create/edit schemas: `packages/commerce-core/src/index.ts`; metadata envelopes: `packages/commerce-core/src/niche-product-facts.ts`. The stale-order expectation is grounded in `services/api-gateway/src/__tests__/owned-db/cart-order-fact-snapshots.postgres.test.ts` and cart acceptance in `services/api-gateway/src/routes/storefront/cart-routes.ts`. Source hashes are pinned in the receipt. These are contracts for future execution, not a claim that their database suites or this lifecycle ran here.

The shared fixture owner controls stock/order cleanup and resource release. Capture screenshots, canonical responses, versions and effect-count evidence per row, then change NOT_RUN only for the cases actually observed. No live SQL, hosted checkout, ledger correctness, installed theme, screen-reader speech or production readiness claim follows from static HTML or schema preparation.
