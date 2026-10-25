# Dewdrop implementation impact inventory

Read-only source snapshot, 23 October 2026. Workspace `/Volumes/Projects/LetBuyy`, branch `letbuyy/theme-release-performance-resume`, HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d`, with the existing dirty Threadline/merchant baseline preserved. This inventory is a proposal for file allocation, not implementation authorization, architecture law or a claim that the future contracts exist. The coordinator has accepted Dewdrop's individual mockup artifact/design review; the portfolio gate remains pending and has not passed.

No production source, migration, generator, package manifest, resource or approved mockup source/image changed during this inventory. [Freeze proof](implementation-freeze-proof.json) compares the existing source/asset hashes, all 45 export hashes and ZIP digest. [Machine-readable file inventory](implementation-impact.json) records exact candidate files, observed support and allocation boundaries. No browser slot or persistent process is needed.

## Stable identity and design version

Retain preset `aura`, slug `letbuyy-aura`, catalog UUID `7b669c70-0000-4000-8000-000000000003`, and the existing beauty positioning. Proposed package/design version **2.0.0**, display name **Dewdrop**. This is a versioned composition change within the same niche; it does not require Bloom's pet-to-toys or Summit's fallback transition. The mockup source's “design version 1” is an artifact revision, not the proposed package SemVer.

`first-party-theme-catalog.ts:10,43` currently knows Aura's stable identity but dispatches only Sense through a distinct builder. Aura receives Core's 1.0.0 bundle plus settings. `theme-presets.ts:203` still names Aura and carries the old rose palette/research note. `experience-compositions.ts:131` still contains sample/claim-oriented defaults, including free samples and testimonial regions. New Dewdrop defaults must follow the accepted factual routine/shade design, with no fabricated assurance, rating, newsletter capability or shipping promise. Existing installed documents, private drafts and immutable releases remain captured and recoverable; changing the catalog does not rewrite them.

Use the existing catalog/install/draft/release path. A new versioned artifact, actual artifact-derived preview and a paired reversible catalog promotion are required. Do not run the frozen migration-372 generator in write mode or modify Threadline's migration-382 generator. The coordinator owns the common catalog dispatch/generator and SQL allocation. Current migration filenames end at **383**, observed only; no next number is reserved here.

## Decisive current gaps

1. **Care metadata does not reach the buyer.** `ProductMetadataSchema` in `packages/commerce-core/src/apparel.ts:41` validates only the `apparel` namespace. The public projector in `services/api-gateway/src/lib/public-product-view.ts:130` publishes only that namespace. `apps/commerce/web/src/lib/product-service.ts:215` maps only apparel, and `composition-engine.tsx:303` emits only `product.apparel`. Merely saving a generic metadata object cannot satisfy Dewdrop's facts requirement.
2. **Discovery is apparel-specific.** The gateway, API-client type, data binder and route-query allowlist carry size/color/price/sort. `browse_storefront_apparel_v1` recognizes option names Size and Color/Colour, not Shade, and has no routine/format predicates. Client-side filtering of a loaded page would give wrong counts and pagination.
3. **Catalog preview has the wrong sample model for Aura.** `theme-preview/[slug]/page.tsx` routes through the shared sample preview; `preview-content.tsx:371` special-cases Threadline only and otherwise selects the Urban Kicks shoe fixture. Dewdrop needs care sample data through that same preview owner, never a second preview runtime or private merchant data.
4. **Selection primitives exist but the complete care presentation is absent.** The canonical variant island resolves actual variant IDs from named option values and stock. The current input path uses named buttons/hidden inputs; the accepted native-radio shade presentation, selected shade code/sample, selected-shade facts/media and keyboard announcements need deliberate integration with that owner. Do not use hex colour as identity or build another cart.
5. **Merchant entry is apparel-only.** The existing product create/edit page keeps apparel facts in its save/conflict/recovery snapshot. A care editor must use that same lifecycle, validate on the server and preserve unrelated metadata. A detached theme-settings ingredient field would duplicate product truth.

## Minimal bounded contracts — proposed C work

The shared domain owner should add a strict exported `PersonalCareFactsSchema` and reader in a proposed `packages/commerce-core/src/personal-care.ts`, then extend the **one** metadata validator and `ProductModel`. Reuse `ProductSchema.metadata` and ordinary product options/variants; no new Product DTO, table or inventory owner is required for these facts. Coordinate the metadata-validator integration once for all nine themes. Pantry can reuse safe plain-text fact presentation, while its food/allergen semantics remain separate.

| Field | Minimal proposal | Absence and authority |
|---|---|---|
| `schemaVersion` | Literal `1` | Explicit parser version, not a second catalog version |
| `routineStage` | Optional `cleanse`, `care`, `colour` | Unknown stays unclassified; never infer skin suitability |
| `format` | Optional trimmed merchant string, max 80 characters | Used as an exact bounded facet; no health taxonomy |
| `netQuantity` | Optional positive finite value + `g` or `ml` | No mass/volume comparison or invented unit price |
| `ingredientList` | Optional plain text, proposed max 6,000 characters | Empty/missing renders “not supplied”; never generated |
| `directions`, `warnings` | Optional plain text, proposed max 4,000 each | Preserve exact supplied text and explicit critical absence |
| `shadePresentation` | Optional option name + up to 100 entries: exact canonical option value, public shade code (max 40), optional six-digit hex sample; optional shade-specific ingredient override | Names and purchasable UUIDs come from canonical options/variants. Display sample/code is presentation, not SKU/stock/price truth. Validate values against the same product's options; reject duplicates and stale references. Unset override inherits supplied common facts; explicit absence must not silently claim inherited certainty. |

Limits and names above are implementation proposals to settle once with the shared writer before code, not existing API fields. Preserve Unicode and ingredient wording. No HTML, executable source, arbitrary URL, medical claim, certification, diagnosis, health profile or efficacy score is part of this schema. Escape all strings in Liquid. Invalid historical facts become unavailable and cannot expose the remaining private metadata.

For initial shade presentation, using the exact option value avoids minting client UUIDs before product creation. Product/variant update must validate and reconcile the mapping atomically when option names/values change. The purchase island still resolves the durable variant UUID from the complete option combination. If the shared owner chooses UUID-keyed facts instead, it must first solve create-time binding inside the canonical product mutation; the editor must not invent IDs or use array position. The fixture's `tint-rosewater` strings are artifact identifiers, not database UUIDs.

Extend the existing query contract with bounded `routine_stage`, `format` and `shade`, retaining search/category/collection/sort/page/limit and supported existing keys. Shade matches a real available variant's named option value, never a hex code. Routine and format predicates run before counting and paging. Clear-one links preserve other filters, search, sort and collection, reset page, and use server results. Missing facts do not match a known fact. No ingredient facet is advertised by the accepted scene 03, so a parsed ingredient inference/search engine is unnecessary.

The gateway/SQL owner should extend the canonical public discovery path and its preview equivalent once, preserving existing apparel behavior and tenant/publication checks. Do not create nine nearly identical search endpoints/RPCs. A forward and paired rollback may be required for the SQL filter function; no migration number or function rename is chosen here. Validate current role/GUC behavior with positive controls, including the existing RPC's internal service-role transport boundary, rather than treating its `SECURITY INVOKER` label as proof of tenant isolation.

## File allocation and existing-system reuse

The JSON inventory is the exact path list. Candidate theme-owned additions after dispatch are `packages/theme-engine/src/dewdrop-theme.ts`, `dewdrop-styles.ts`, `test/dewdrop.test.ts`, a care demo fixture and optimized original assets. These complete the canonical Liquid package, section settings and resource bindings; they do not introduce a renderer. The package builder should select reusable care card/routine shelf/fact layouts in existing section/schema mechanisms. Shared schema, exports, catalog, product query, variant island, product editor, preview selection and migration files require a named coordinator writer before editing.

Keep the current canonical account/checkout owners. Sign-in and registration retain admin/light brand-ink identity, Geist, email/password and explicit Continue to Dewdrop. There is no mandatory verification-link step or new required checkbox. Profile email remains read-only; storefront accounts show only server-resolved store orders. Checkout receives permitted data branding only. The full mobile quote must precede payment commitment, with actual eligible payment methods and truthful mock/live state. No theme-specific auth, address book, checkout logic or money source is needed.

Merchant theme editor fields should include routine collection/product bindings, original media/focal points, merchant editorial/policy links, allowed care card facts and bounded layout/palette settings. Product facts belong in the product editor. Save/readback, undo/recovery, stale conflicts and reviewed style/additive/full application use the existing owners. Asset URLs and thumbnails must be available on the resolved store hostname; Threadline's static routing regression is a relevant baseline to preserve.

## Required fixtures and acceptance

Use separate owned synthetic resources; never Threadline's store, cookies, database or temporary credentials. Create real UUIDs through the canonical fixture/product owner. Fixture catalog: Cloud Rinse ₹640/150 ml; Daily Veil ₹880/50 g; Soft Colour ₹520/6 ml; Palm Wash ₹460 with no image/ingredients. Rosewater/RW01 and Pink Clay/PC02 share sample `#A36A65`, retain different option values/UUIDs, and both have positive stock; Terracotta is unavailable. Add another merchant and buyer for denial controls. Bag/order fixture remains ₹1,160 + ₹60 shipping = ₹1,220 with tax included; server quote decides the actual test order amounts.

| Class | Concrete proof required after implementation |
|---|---|
| Unit / contract | Strict limits and unknown-key rejection; invalid/missing facts; option mapping after rename; correct public projection; filter round-trip/count/page; Liquid escaping; metadata preservation |
| Integration | Merchant create/edit/save/reload/conflict retains facts; all public list/detail/preview drops agree; filter predicate precedes pagination; same-variant stock match; unrelated private metadata never public |
| E2E | Discover → actual package preview → Add → configure/save/reload → signed preview → publish → anonymous release → select named shade → cart → shared checkout → owned order/account → recovery |
| Security | Positive own-tenant/buyer controls before cross-tenant denial; unpublished/foreign product and preview-token denial; malicious facts/options; XSS/sandbox limits; safe buyer return; server price/stock/idempotency |
| Accessibility / performance | Actual 1440/834/390 and 320 widths, native keyboard shade selection, focus/announcements, browser-native text zoom, Hindi/script fallback; 0/1/200-product content; controlled media/data/interaction measurements |
| Regression / rollback | Existing apparel and other themes unchanged; private drafts/releases preserved; failed save/publish keeps safe state; catalog DOWN restores previous artifact and reapply works; no deletion is planned |

Candidate focused new tests and existing reusable suites are listed in JSON. Current commands include theme-engine test/typecheck, gateway root-resolved unit/contract tests, touched merchant/commerce test/typecheck and the repository-owned database runner. `commerce-core` currently has no package test script; invoke its focused test files explicitly through the existing root `tsx` runner. No implementation suites were executed for this inventory. Run relevant full theme/security/tenant gates after integration, with governance in the established isolated snapshot because its cleanup must not touch the shared checkout. Test totals must not be added across overlapping commands.

## Dispatch readiness

No new material business-policy decision is needed for this bounded non-medical care design. Claim approval, health recommendations, subscriptions, uploads and new payment/provider obligations remain excluded. Needed assignments are: one shared product-facts/query writer, one shared catalog/preview/schema writer, the Dewdrop package/assets writer, and coordinated acceptance resources. All remain unallocated to this chat until explicit dispatch. Individual mockups are accepted; portfolio completion, implementation, integration, production behavior and hosted deployment are separate states.

Applicable local `AGENTS.md` files for commerce-core, theme-engine, gateway, commerce web and merchant web were read. The existing theme deployment-chain reference confirms that active stores render captured `theme_releases.template_snapshot.liquidBundle`; merely changing source/catalog defaults does not update a published store. Use the canonical explicit publication/recovery path during later acceptance.

The deployment-chain document contains historical app paths and manual snapshot/cache procedures. This inventory relies on its captured-release explanation only; those older procedures are not an implementation instruction. Current canonical publication and recovery APIs, ownership checks and immutable releases govern the later work. Shared candidate source-file SHA-256 values are recorded because HEAD alone omits the dirty working baseline.
