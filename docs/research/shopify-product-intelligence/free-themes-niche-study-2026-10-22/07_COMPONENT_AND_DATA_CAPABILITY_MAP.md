# Component and data capability map

Classes describe **current source support**, not a deployed end-to-end certification: **A** supported canonical primitive; **B** exists but not wired into this target path; **C** bounded extension; **D** material product/policy/provider decision; **E** deferred/outside initial scope. A composite label means the primitive and complete workflow have different status. Do not advertise the complete feature based on the primitive alone.

## Canonical source ownership

- [packages/shared-types/src/index.ts](../../../../packages/shared-types/src/index.ts)
- [packages/commerce-core/src/index.ts](../../../../packages/commerce-core/src/index.ts)
- [packages/checkout-core/src/index.ts](../../../../packages/checkout-core/src/index.ts)
- [packages/theme-engine/src/theme-bundle.ts](../../../../packages/theme-engine/src/theme-bundle.ts)
- [packages/theme-engine/src/built-in-section-schemas.ts](../../../../packages/theme-engine/src/built-in-section-schemas.ts)
- [packages/theme-engine/src/section-type-map.ts](../../../../packages/theme-engine/src/section-type-map.ts)
- [packages/theme-engine/src/dynamic-source-binding.ts](../../../../packages/theme-engine/src/dynamic-source-binding.ts)
- [apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts](../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts)
- [apps/commerce/web/src/lib/theme-engine/composition-engine.tsx](../../../../apps/commerce/web/src/lib/theme-engine/composition-engine.tsx)
- [services/api-gateway/src/routes/storefront/cart-routes.ts](../../../../services/api-gateway/src/routes/storefront/cart-routes.ts)

Key source facts: ProductSchema supports options, variants, prices, stock, media, tags and metadata. The Liquid product adapter explicitly copies selected fields and omits generic metadata. `StorefrontCartLineInputSchema` accepts `properties`; cart routes preserve them, but ordinary order-item input carries product/variant/quantity. That is insufficient proof of a personalized production contract. `collection-filter` gates sort/price/vendor UI on supplied data that current inspected hydration does not produce. A section registration or settings toggle does not complete the capability.

## Feature contracts

### CAP-01 · Versioned niche compositions — B

**Customer purpose:** Deliver chosen design at install. **Data:** experience-compositions / experience-apply. **Owner:** theme-engine + gateway theme execution.

**Missing contract / dependency:** Apply through canonical catalog document builder and versioned artifact; production wiring absent in searched roots. **Empty/error behavior:** Keep last valid document on failure.

**Security/authority:** Validate known section schema/settings; no arbitrary executable markup. **Acceptance evidence:** Prove two distinct catalog documents survive install/readback/render.

### CAP-02 · Section layout and card variants — C

**Customer purpose:** Support different evaluation patterns. **Data:** theme-bundle / built-in schemas / type map. **Owner:** theme-engine.

**Missing contract / dependency:** Bounded layout/card/facts settings consumed in Liquid and editor schema. **Empty/error behavior:** Default to known supported layout with clear missing-content state.

**Security/authority:** Schema validate enum; escape merchant text; preserve Liquid limits. **Acceptance evidence:** A setting changes the actual rendered DOM and survives editor save.

### CAP-03 · Product name/price/media/variants — A

**Customer purpose:** Select a real purchasable SKU. **Data:** ProductSchema, commerce-core, productToLiquidDrop. **Owner:** shared-types + commerce-core + storefront adapter.

**Missing contract / dependency:** No new DTO; verify each niche option through current path. **Empty/error behavior:** Missing media placeholder; unavailable option labelled.

**Security/authority:** Prices/stock resolved server-side; tenant context enforced. **Acceptance evidence:** Variant selection, stock race and cart amount agree with gateway.

### CAP-04 · Typed niche facts — C

**Customer purpose:** Show fit/specs/ingredients/dimensions/bibliography. **Data:** ProductSchema.metadata exists; productToLiquidDrop omits metadata. **Owner:** commerce-core + shared-types + data-binding adapter.

**Missing contract / dependency:** Define bounded namespaced validated schemas and deliberate safe Liquid hydration; generic metadata is insufficient. **Empty/error behavior:** Critical absence explicitly labelled; optional facts omitted.

**Security/authority:** No arbitrary HTML, source execution or cross-tenant lookups. **Acceptance evidence:** Save facts/read back and render exact units/value/absent state.

### CAP-05 · Metafield dynamic binding — B/C

**Customer purpose:** Bind merchant facts without duplicated content. **Data:** dynamic-source-binding.ts comments and missing hydration search. **Owner:** theme-engine + existing gateway metafield domain.

**Missing contract / dependency:** Wire existing owner through sanitized SiteDrops hydration; service file named in comments is absent. **Empty/error behavior:** Show declared fallback only; never silently invent data.

**Security/authority:** Authorize site/resource access, limit values and safe field types. **Acceptance evidence:** Wrong-site binding denied; missing binding does not leak another product.

### CAP-06 · Category navigation and basic search — A

**Customer purpose:** Reach products with available contracts. **Data:** navigation drops; search island; public product query. **Owner:** existing storefront/gateway product owner.

**Missing contract / dependency:** Use actual observed query fields and pagination. **Empty/error behavior:** No results preserves query and offers a broader category.

**Security/authority:** Bound query length/page; tenant-scope results. **Acceptance evidence:** Query and back navigation produce expected products without fake counts.

### CAP-07 · Niche facets and sorting — C

**Customer purpose:** Narrow catalog by real attributes. **Data:** collection-filter conditional sort_options/price_ranges/vendors; absent hydration. **Owner:** commerce-core query + gateway + storefront data binding.

**Missing contract / dependency:** Extend current paginated query contract with bounded typed filters/sort and supplied URLs/counts. **Empty/error behavior:** Hide unsupported facets; unknown values explicit; clear-one/all.

**Security/authority:** Allowlist sort/filter keys; indexed query budget; no raw SQL fragments. **Acceptance evidence:** Facet round-trip, pagination consistency, selected size means in-stock matching SKU.

### CAP-08 · Fit measurements — A/C

**Customer purpose:** Judge garment fit. **Data:** Variant options + merchant content; no size recommendation contract found. **Owner:** commerce-core content + productDetail.

**Missing contract / dependency:** A static supplied size guide can render; C per-product typed measurement and facet support. **Empty/error behavior:** Not supplied; no inferred best size.

**Security/authority:** Bound units/rows; avoid personal body profiling. **Acceptance evidence:** Measurement table remains readable at zoom and matches chosen product.

### CAP-09 · Compatibility and comparison — C/D

**Customer purpose:** Avoid wrong technical model. **Data:** Metadata/variant primitives; no normalized compare endpoint found. **Owner:** commerce-core + gateway product query.

**Missing contract / dependency:** C unit-aware typed facts and 2–3-product comparison; D merchant source/claim responsibility. **Empty/error behavior:** Unconfirmed/incomparable values visible; no empty compare tray.

**Security/authority:** Tenant/product visibility and query limits; truthful source dates. **Acceptance evidence:** Two products compare same named unit without fabricated compatibility.

### CAP-10 · Ingredient/allergen/use content — A/C

**Customer purpose:** Evaluate food/care facts. **Data:** Description/rich text exists; metadata not hydrated. **Owner:** commerce-core + canonical Liquid facts block.

**Missing contract / dependency:** Static merchant text A; structured product-specific ingredient/warning groups C. **Empty/error behavior:** Explicit missing critical facts; never infer allergen-free.

**Security/authority:** Sanitize content; no health diagnosis or generated safety claims. **Acceptance evidence:** Selected product shows correct ingredient/warning list before CTA.

### CAP-11 · Dimension/material diagrams — A/C

**Customer purpose:** Evaluate room fit. **Data:** Media/description A; normalized facts C. **Owner:** commerce-core + productDetail facts.

**Missing contract / dependency:** Typed unit conversion and text equivalent alongside merchant diagram. **Empty/error behavior:** No size badge if unknown; instructions remain text.

**Security/authority:** No fake measurement inferred from image; accessible alternate text. **Acceptance evidence:** Diagram agrees with text and chosen variant dimensions.

### CAP-12 · Quantity and stock feedback — A

**Customer purpose:** Submit valid purchase quantity. **Data:** StorefrontCartLineInputSchema and cart-routes; variant/cart islands. **Owner:** checkout-core + gateway cart + storefront islands.

**Missing contract / dependency:** Reuse quantity bound, pending and server result handling. **Empty/error behavior:** Retain selection on inventory/network errors.

**Security/authority:** Server reprices; no client total/provider authority; idempotency where required. **Acceptance evidence:** Duplicate click does not duplicate an unintended action; stock race explained.

### CAP-13 · Unit-price display — C

**Customer purpose:** Compare pantry pack value. **Data:** Price exists; net-quantity contract not established. **Owner:** commerce-core + server product presentation.

**Missing contract / dependency:** Normalized quantity/unit and server-derived unit price with rounding rule. **Empty/error behavior:** Hide unit price if quantity/unit missing; retain actual sale price.

**Security/authority:** Avoid currency-unit confusion and client-authoritative totals. **Acceptance evidence:** 2 × 250g price and displayed per-100g value match known fixture.

### CAP-14 · Gift messages — C/D

**Customer purpose:** Attach supported note to intended order. **Data:** Cart properties primitive and order notes exist separately. **Owner:** checkout-core + gateway cart/order + merchant order view.

**Missing contract / dependency:** Typed length/escaping, line-versus-order scope, retention/readback and fulfillment visibility; policy decision D. **Empty/error behavior:** No note field before full support; recover entered text after validation error.

**Security/authority:** Minimize personal text; tenant-isolated access, retention and output encoding. **Acceptance evidence:** Message survives cart update, order creation and merchant readback exactly once.

### CAP-15 · Text personalization — C/D

**Customer purpose:** Record exactly what will be produced. **Data:** Cart properties accept unknown values; order item input does not prove configuration propagation. **Owner:** checkout-core + commerce-core + gateway order + merchant fulfillment.

**Missing contract / dependency:** Product-defined allowlist/limits, normalized config/version, server price consequences, distinct line identity, order snapshot, policy. **Empty/error behavior:** Validate near field; reviewed summary; no silent loss at checkout.

**Security/authority:** Escape text, reject unsupported fields, bound payload; no trust in client price. **Acceptance evidence:** Two configurations stay separate and order/merchant view read back exact approved text.

### CAP-16 · Customization uploads / proof approval — E

**Customer purpose:** Accept customer artwork or approved proofs. **Data:** No complete approved workflow established in this research. **Owner:** Existing media/storage/order owners only if later approved.

**Missing contract / dependency:** Deferred initial scope; needs file validation, malware controls, access, retention, proof/version and operational policy. **Empty/error behavior:** No upload widget or approval promise.

**Security/authority:** Private assets, signed access, content validation and explicit upload authorization. **Acceptance evidence:** Not a first-release acceptance item; requires separate approved scope.

### CAP-17 · Shipping rates / delivery dates — A/D

**Customer purpose:** Know actual shipping constraints. **Data:** Shipping-profile field/checkout rate contracts exist; ETA evidence not established. **Owner:** existing gateway shipping / checkout-core.

**Missing contract / dependency:** A actual policy/rate links; D trustworthy delivery window/eligibility contract before promise. **Empty/error behavior:** Link real policy; say estimate unavailable; checkout recalculates.

**Security/authority:** Server validates eligible rates and site ownership; no fabricated date. **Acceptance evidence:** Invalid rate rejected and actual final quote differs only with explanation.

### CAP-18 · Reviews / ratings — B

**Customer purpose:** Use genuine customer feedback. **Data:** Product review domain schemas/API; Liquid drop carries rating/count but reviews empty. **Owner:** commerce-core reviews + gateway moderation + storefront binding.

**Missing contract / dependency:** Wire approved published reviews to Liquid and accessible summary; verify counts/moderation. **Empty/error behavior:** No reviews yet; no seeded ratings on real stores.

**Security/authority:** Output escaping, visibility/moderation, customer authority and privacy. **Acceptance evidence:** Only published site/product reviews render; absent feedback stays absent.

### CAP-19 · Stock urgency / back-in-stock — A/D

**Customer purpose:** Explain availability honestly. **Data:** productToLiquidDrop stock/available exists; notification workflow not proven. **Owner:** commerce-core inventory + queue owner if later scoped.

**Missing contract / dependency:** A factual stock/availability; D opt-in back-in-stock notification/consent work. **Empty/error behavior:** Unavailable text and other products; no fake countdown.

**Security/authority:** No invented scarcity or default notification signup. **Acceptance evidence:** Server stock change reflected; notification absent until consent and delivery verified.

### CAP-20 · Curated recommendations / outfits — A/C

**Customer purpose:** Support relevant additional products. **Data:** featured-products / collection bindings available. **Owner:** theme-engine + commerce-core.

**Missing contract / dependency:** A explicit curated product/collection list; C bounded outfit link group; no personalization engine needed. **Empty/error behavior:** Omit empty related list and retain product CTA.

**Security/authority:** Only public same-site products; no inferred sensitive profiling. **Acceptance evidence:** Related links are real products with independent price/stock.

### CAP-21 · Sold-as-one sets / configurable bundles — A/D

**Customer purpose:** Sell a listed set honestly. **Data:** Ordinary Product/Variant can represent a set; inventory coupling not proven. **Owner:** commerce-core inventory + checkout-core.

**Missing contract / dependency:** A single SKU with supplied contents; D component inventory/pricing/returns for configurable bundles. **Empty/error behavior:** Do not render build-a-box without support.

**Security/authority:** Recompute totals/stock server-side; no synthetic bundle discount. **Acceptance evidence:** Listed SKU sells as one; any later multi-item bundle has reconciliation/inventory tests.

### CAP-22 · Subscriptions / local instant delivery / AR — E

**Customer purpose:** Broaden operations. **Data:** No workflow established; outside bounded initial niche designs. **Owner:** Existing canonical domain owners only after product scope approval.

**Missing contract / dependency:** Deferred; never activate reserved services or new marketplace/runtime. **Empty/error behavior:** No decorative subscribe/date/AR controls.

**Security/authority:** New obligations require separate policy/provider/security review. **Acceptance evidence:** Excluded from initial definition of done.

### CAP-23 · Fonts and semantic storefront tokens — A/C

**Customer purpose:** Keep niche identity readable. **Data:** experience-fonts.ts and commerce layout; existing theme settings overlay. **Owner:** theme-engine storefront settings; platform DS remains canonical.

**Missing contract / dependency:** A registry/loading integration; C full semantic state pair settings where not currently modeled. **Empty/error behavior:** Test actual fallback fonts; reject unusable override contrast.

**Security/authority:** Allowlisted font sources; no arbitrary third-party tracking asset by preset. **Acceptance evidence:** Font requests/glyphs and state contrast verified with network denied and real language fixtures.

### CAP-24 · Artifact-derived gallery previews — C

**Customer purpose:** Make selection promise match install. **Data:** catalog thumbnail generator currently one SVG geometry. **Owner:** existing catalog tooling + merchant themes UI.

**Missing contract / dependency:** Capture actual versioned home/collection/PDP fixture; bind checksum/version to gallery. **Empty/error behavior:** Label unavailable preview and missing merchant content.

**Security/authority:** No private catalog/customer data in public samples. **Acceptance evidence:** Thumbnail artifact ID equals selected installation artifact ID.

### CAP-25 · Draft / preview / publish / recovery — A/B

**Customer purpose:** Preserve ownership and last good store. **Data:** theme routes/execution adapter, instances/releases, preview tokens. **Owner:** canonical gateway theme execution + merchant editor + storefront resolver.

**Missing contract / dependency:** A existing operations; B composition API wiring and version diff; add focused end-to-end assertions. **Empty/error behavior:** Conflict/error preserves draft; failed publish retains prior release.

**Security/authority:** Tenant/permission checks, scoped preview token, immutable release semantics. **Acceptance evidence:** Save/readback → preview → explicit publish → release readback → storefront DOM matches.

## Reuse versus extension rule

Composition metadata selects a canonical section's layout/card/fact schema. One shared facts table can support different typed groups for devices, room dimensions, toys and bibliography without becoming an unvalidated bag of HTML. Domain schemas own names/units; the renderer owns safe presentation. Reuse option, quantity and cart mechanics; change where factual context occurs. Add a new section only for a distinct reusable responsibility that existing primitives cannot express, and register its schema/type/Liquid implementation/editor control/parity fixtures together.

No app-block marketplace, extension executor, reserved search/media service or parallel React implementation is needed for these designs. A broader business feature cannot be smuggled into a theme setting. Required future schema changes must follow current authority, shared types, RLS/GUC, validation and migration governance; this task creates no database migration.
