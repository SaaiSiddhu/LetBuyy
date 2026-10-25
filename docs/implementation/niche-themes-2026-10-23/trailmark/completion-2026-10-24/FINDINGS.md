# Trailmark completion findings — 24 October 2026

These are bounded evidence and source findings. No new installed execution or runtime failure was produced in this phase. The original independent result remains **3 PASS / 0 FAIL / 2 BLOCKED / 7 NOT_RUN** on run `936e5f577646`. Controller PARTIAL classifications and all initial receipts remain in the original audit.

## TM-G01 — Shared block controls do not fulfil the expanded lifecycle

Status: **OPEN — SOURCE_CONFIRMED, INSTALLED_NOT_RUN**. Owner: existing Theme Editor, through the current Themes allocation. No shared correction was made here.

Current source update: **SOURCE_REPAIR_ADMITTED_FOR_NEXT_COHERENT_CANDIDATE; INSTALLED_NOT_RUN**. Root has admitted the Editor's six-file repair. `shared-editor-source-admission-consumption.json` independently matches all six current source hashes, ten owner logs, the Root19 receipt and all11 Trailmark declared content block placements in the new source probe. Root19 overlap owner109; they are not added to it. The initial source finding below remains historical. Three supporting editor source pins in the initial snapshot now have explicitly authorized before/after deltas; frozen Trailmark package source has not been changed by this chat. No browser case or original lifecycle status is promoted by this source admission.

The pure Trailmark factory declares 13 inline block placements: 11 content placements and 2 protected `@app` seams. No default block instances or explicit allowed child types are declared. The reusable `badge` definition has a `label` field; the canonical adapter correctly inherits it for the empty `spotlight` badge reference.

At the source snapshot in `SOURCE_SNAPSHOT.json`, the editor page exposes top-level `addBlock`, `updateBlockSetting` and `removeBlock` (`editor/page.tsx:1320`, `:1398`, `:1410`). The `SectionTreePanel` call at `:1588` supplies section move/toggle/remove callbacks but no `onAddChildBlock`, `onMoveChildBlock` or `onRemoveChildBlock`. `BlockChildRow.tsx:183` offers reorder actions only for depth > 1 when a callback exists; its visibility is displayed through a class, with no block hide/show action. No top-level block move or visibility mutation is wired in the page. The component's add-child affordance also requires declared allowed child types (`BlockChildRow.tsx:140`).

Reproduction for the allocated controller: in a sacrificial Trailmark draft add a Banner Carousel; add two `slide` blocks; edit both; attempt native block reorder, hide/show and declared nested editing; save/full reload/preview/publication and compare exact block IDs/order/visibility. Keep absent controls open; do not manufacture a hidden field, child type or installed pass. Verify the current installed schema before reproducing, since source is not an installed contract. Covered by `TM-BLOCK:*`, `TM-BLOCK-FIELD:*` and `TM-NESTED-01`.

## TM-G02 — Approved technical measurement illustration is absent

Status: **OPEN — SOURCE_CONFIRMED, INSTALLED_NOT_RUN**. Owner: Trailmark leaf; any shared source change still requires a current writer grant.

The frozen design capability `Technical measurement presentation` requires written selected-variant units and an explicitly illustrative, not-to-scale diagram. The frozen `source/05-product-specs.html` contains a racket image, an overall-length line and the explicit not-to-scale note. Current `trailmark-theme.ts:19` renders tables and common/variant text, but no corresponding illustration or diagram control. `trailmark-styles.ts:6` styles the factual tables without a measurement visual. The existing selected-variant facts remain the canonical reference and must stay separate from common product facts.

A correction must restore the approved component, bind validated same-product facts/media, label common versus selected values, handle missing media/length and non-racket equipment, and never infer a measurement from an image or introduce another stock/price authority. The current phase records the gap and a private proposal; no released file or old capture is modified. Covered by `TM-PROMISE:05` and existing `P01`.

## TM-G03 — M01 needs a meaningful private-data positive control

Status: **RETAINED BLOCKED**. Owner: fixture/catalogue owner with allocator approval.

The historical normal merchant UI created the two supplementary products and five scoped collections and read back their actual UUIDs/facts/stock. It could not enter the private supplier field or independently choose the sealed plan's long variant titles. Actual S/M/L titles were retained and positively bound to their durable UUID/option tuples. Do not expose a private field as a public merchant setting merely to obtain a test witness. The owner must supply an approved private positive-control setup and explicitly reconcile the title requirement, retaining the original incomplete result. No DB setup is authorized by this file.

## TM-G04 — P02 private transport is still unexecuted

Status: **RETAINED BLOCKED**. Owner: existing signed-preview implementation and sole Editor controller.

The 17 recipes each passed public collection and search HTTP/UI observation on historical run936: 34 public pairs plus 12 native recovery observations. All 34 private preview-resource transports remain NOT_RUN. Execute the existing same-store signed preview resource with the same token, no-store semantics and explicit failure without public fallback. Preserve the public receipts/request IDs; do not substitute them for private proof.

## TM-G05 — Current shared/runtime dependencies have no grant

Status: **BLOCKED FOR DEPENDENT EXECUTION**. Existing Themes and Theme Editor chats are paused. `EXECUTION_STATE.json` records both helpers awaiting explicit message/resume authorization and null browser/writer leases. Queue position 6 is a reservation only. The previous run936 binding is historical and has not been adopted. Shared checkout correction belongs to MadeYours, discovery count correction to Circuit, preview/shared controls to Editor, and catalogue/migrations to the one allocated owner.

No checkout, order, stock, identity or provider operation was attempted here. No extra fixture, browser, server, build, migration, provider call or timer was started. Source-level proposals and prior native/static tests cannot close installed gates.

## TM-G06 — Preset and identity boundaries require explicit observation

Status: **SOURCE_OBSERVATION — NOT A RUNTIME DEFECT VERDICT**.

The factory's current Trailmark palette is green, but its inherited `Ride` settings preset is orange. The ten declared presets are inventoried and require sacrificial-draft apply/save/reload/restore coverage; they do not authorize replacing the approved Trailmark identity or a user draft. Also, the bundle retains `customers/login` and `customers/register` templates while canonical identity entry is owned by the buyer issuer. Verify actual route/redirect behavior and supported presentation settings; do not revive a second storefront authentication implementation to render every inherited template.

## TM-G07 — Inherited order-detail heading has no Liquid binding

Status: **OPEN — SOURCE_CONFIRMED, INSTALLED_NOT_RUN**. Owner: canonical Core/Liquid section owner, allocated once through Themes; no shared patch here.

`theme-bundle.ts:3082` declares a `customer-order-detail` editable text `heading` defaulting to Order. Its generated Liquid hardcodes `<h1>Order #{{ order.number }}</h1>` and never reads the declared setting. The source-derived Trailmark package inherits that section unchanged. Reproduction: change this field in an allocated sacrificial draft, reload, preview the owned order under the correct buyer identity and compare rendered heading. Reconcile the installed route/template before asserting an installed defect; do not modify canonical identity or order truth to force the setting to render. Covered by `TM-FIELD:customer-order-detail:heading` and `TM-INSTANCE-FIELD:customers/order:customer-order-detail-default:heading`.

The inventory's lexical `sourceMentionsSetting` flag is not itself a defect verdict. In particular, `featured-products` product1/2/3 and requireSelection plus `product-grid.collectionId` are consumed by the canonical `data-binding-engine.ts:51`, `:54`, `:180` and `:186`; they correctly need not appear directly in Liquid. The protected app slot remains a frozen seam. Only the independently traced heading is raised here.

## TM-G08 — Inherited native newsletter cannot pass the current contact intake

Status: **OPEN — SOURCE_CONFIRMED, INSTALLED_NOT_RUN**. Owner: existing canonical Core/Liquid and storefront form/intake owners through Themes, allocated once. No shared patch here.

The actual source-derived `newsletter-signup` Liquid declares a native `POST /contact` form with only an `email` input. The reached-store POST path in `apps/commerce/web/src/proxy.ts:528` calls `handleContactSubmit`; that function reads name/email/phone and at `:337` rejects when name is absent before calling the gateway. `services/api-gateway/src/routes/contacts.ts:61` independently requires name and email or phone. Thus the declared native newsletter form does not supply the minimum shape accepted by its actual intake. `SOURCE_WITNESSES.json` records exact source hashes, parsed form controls and the branch; no app request, DB mutation or HTTP response was executed or invented.

Reproduction for the admitted controller: add `newsletter-signup` to an owned Trailmark draft, publish, submit one synthetic email through the normal native form, capture the real redirect/error/request and durable absence/presence. A contact row or painted success alone is not subscription/consent proof. Do not fix this by inventing a buyer name, restoring the legacy React section's local-only success timer, or opening a second subscription system. Reconcile the intended canonical newsletter/consent command and owned input contract, implement once at that owner, and retest all dependent first-party themes. This source gap is covered by `TM-FORMS-02`; it is not added to the historical installed FAIL count.

## TM-G09 — Normal collection heading control needs an explicit override

Status: **PRIVATE SOURCE CORRECTION VERIFIED; NOT PROMOTED; INSTALLED_NOT_RUN**. Owner: Trailmark leaf under a future allocator writer/version grant.

`trailmark-theme.ts:33` labels `collection-product-list.title` as Heading but renders `collection.title | default: section.settings.title`. As with the expression identified in the programme's Threadline review, editing this field changes only the blank-collection-title fallback; the normal named collection stays unchanged.

`heading-override-proposal/` contains a minimal one-leaf private correction: a blank-by-default explicit `headingOverride` controls the normal collection/search H1, while the original field is relabelled Fallback heading and retains its saved behavior. Default visuals, existing merchant values and all other source-derived sections/templates/config/package metadata stay exact. No shared file was edited.

Actual canonical LiquidRenderer/schema adapter/document source tests show baseline 5 PASS/3 FAIL; an initial redundant-escape correction 7 PASS/1 FAIL; final 8 PASS/0 FAIL. Initial dependency-resolution and escaping failures remain in the evidence. These are source tests, not installed editor proof. `RESULT.json` pins the exact diff, base/candidate/helpers and receipts. The private evaluator's baseline metadata is not a new release; changed bytes must not be emitted as2.0.0. Current source ownership, compatible version/update/catalogue admission, merchant save/reload/preview/publication and independent installed acceptance remain pending.

The coordinator then assigned an explicitly private opt-in2.0.1 successor. `v201-successor-proposal/RESULT.json` records that completed source slice: new successor module, proposed Root-owned catalogue selector/dispatch, and order-heading consumption closing the private source portion of TM-G07 as well. It reuses the existing canonical niche-order presentation while its input is still2.0.0, retains saved fact text/authoritative order number and advances metadata afterward. RED8pass/8fail → GREEN16pass/0fail, with the initial harness error preserved. Main remains untouched; no original or expanded installed case is promoted to PASS. TM-G07/TM-G09 remain open for versioned integration and actual installed verification.

Exact source hashes, factory closure, field declarations, historical result/request references and new NOT_RUN cases are in `SOURCE_SNAPSHOT.json`, `CAPABILITY_INVENTORY.json`, `SOURCE_WITNESSES.json` and `COVERAGE.json`. Source findings carry no fabricated HTTP/request ID; actual reproduction is pending the current lease.

## Runtime07 disposition — 25 October IST

`RUNTIME07_SOURCE_DISPOSITIONS.json` reconciles only the retainedTrailmark gaps against the admitted210source andapprovedM1measurementcomponent. Shared child/editor repair is qualified and current headingrender consumes its setting; actualthemeUIoperations remainpending. The exact210descriptor adds15requiredcase groups, allNOT_RUN. No oldnative500/pause is a currentoriginalcaseblocker.

TM-G02remainsopen: approved05-product-specs uses theexistingracketPNG plusmeasurementline, notareplacementSVGsilhouette. Itneedscommon/simple andexistingselectedUUID projections together. Anyfutureversion mustretain exactchildeligibility; current211slot belongs to thefour-headingrepair andexcludesTrailmark. No Main/candidate/sourcepatch isapplied here. These dependencies donotdelay independentcurrent210sportsTest/COD/discovery/historycases. PrivateSupplier/titlepositivecontrol andprivateHTTPclauses remainexplicitlyopen.
