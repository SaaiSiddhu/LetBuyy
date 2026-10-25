# Implementation plan — canonical Liquid portfolio

Status: **PROPOSED, production changes not implemented**. The research proves a bounded source cause and supplies designs; it does not authorize deployment, publication, account changes or migration execution. The intended implementation is completion of the existing winner, governed by AUTH-R1, WIN-R3/R4, ARCH-R11–18 and Theme-Liquid security/parity gates. Keep the approved runtime topology and India merchant envelope.

## Delivery model and dependency order

Product/content decisions → prove artifact/application path with two distinct designs → shared typed facts and discovery contracts → expand the ten versioned compositions → merchant switching/previews → security/accessibility/performance/release qualification. Personalization remains gated until its full order/fulfillment contract works. Do not make another nine themes before proving the first selected document reaches the buyer.

No calendar estimate is justified without inspecting implementation ownership and CI availability. Each phase below has an executable exit, dependencies and rollback. These are future checks, not tests claimed as run during research.

## Phase 0 — ratify scope, identity and contract inventory

**User-visible outcome:** merchants are promised exactly the capabilities that can ship, with honest niche/content fit.

**Source boundaries:** `theme-presets.ts`, `industry-experience-map.ts`, `first-party-theme-catalog.ts`, current canonical registry and gallery metadata. Review `experience-compositions.ts` sample claims before using any default text. Do not edit governance to convert a proposal into law.

**Work:** approve Bloom pet→toys and Summit generic→gifts transition semantics; decide stable-ID/version strategy and neutral unknown-industry fallback. Confirm Nova personalization launch gate. Define typed content field groups, required-versus-optional fields, units, claim ownership and original/licensed asset list. Names remain working labels pending clearance. Classify each CAP row as first-release, gated or excluded.

**Validation:** compare active registry/industry resolution and fixture merchant cases (known, unknown, empty catalog, existing pet store, existing generic store). Verify no accepted change creates an eleventh marketed preset or rewrites an existing instance.

**Security/accessibility/performance:** no new runtime/provider; preserve tenant boundaries; explicit Unicode/unit assumptions; budget fonts/media before collecting assets.

**Recovery / done:** reversible metadata/version plan documented, product decisions recorded, required content fixtures prepared. If a decision remains open, preserve existing mappings and continue independent shared-contract work; never silently repurpose existing merchants.

## Phase 1 — prove a representative vertical slice

**User-visible outcome:** selecting Threadline (fashion) versus Pantry produces visibly different home, collection and product structures after installation, editor save, preview and publication on an isolated test site. This slice is the central fix for the reported sameness.

**Exact source boundaries:**

- `packages/theme-engine/src/first-party-theme-catalog.ts`: build the selected versioned document from canonical Core plus actual composition, rather than a settings-only bundle overlay.
- `packages/theme-engine/src/experience-compositions.ts` and `experience-apply.ts`: use their schema-validated composition/diff semantics; ensure template sections and bundle templates agree.
- `packages/theme-engine/src/theme-document.ts`, `theme-bundle-core.ts`, `theme-bundle.ts`: preserve one portable document/package shape and registered Liquid source.
- `scripts/liquid-parity/build-first-party-catalog.mjs`: produce new artifact-aware catalog output; historical migration 372 is evidence, not the place to retroactively alter deployed rows.
- `services/api-gateway/src/execution/theme-execution.adapter.ts` install/draft/preview/publish/release artifact path, and `services/api-gateway/src/routes/themes.ts`: preserve actor/site checks, limits, version conflicts and explicit publish.
- `apps/merchant/web/src/components/theme-editor/ExperiencePicker.tsx` and existing editor owner of its apply callback: route deliberate design application through the existing document APIs; no parallel editor.
- `apps/commerce/web/src/lib/theme-engine/template-resolver.ts` and `composition-engine.tsx`: ensure draft/release bundle resolution consumes the exact chosen document.

**Reusable changes:** version metadata, canonical composition application, source-derived preview fixture, explicit apply mode and artifact identity assertions. Only the minimum schema-supported apparel and pantry layout variants are needed to prove hierarchy; unsupported facets remain absent. A static factual guide can be merchant content; do not pretend this proves fully structured product facts.

**Persisted test sequence:** select catalog version → install on owned test tenant → read back instance/document → edit a meaningful section → save/read back exact version → signed draft preview → publish through canonical service → read back release snapshot/manifest → render published route → compare home/collection/PDP and selected settings. Assert release/draft IDs rather than trusting success toast. Run second-tenant denial and stale-version conflict cases. Actual merchant data is unnecessary.

**Tests:** unit composition/document invariants; contract exact schema/settings round-trip; existing `theme-catalog-install.postgres.test.ts` extended with real structural assertions; ephemeral-PG integration for install/draft/release/readback; E2E browser screenshot/DOM at desktop/mobile. Add a regression that intentionally reduces a design to token-only changes and fails the differentiation assertion. Do not assert brittle whole-page hashes where merchant content legitimately differs: assert role/order/card/fact/purchase model invariants and representative screenshots.

**Security/accessibility/performance:** keep Liquid sandbox escape/XSS/limits hard gates, preview-token site scope and permissions; verify focus, option labels and no sticky occlusion; ensure no repeated catalog fetch or large hero asset on every render. Measure actual render/request/image/interaction stages rather than perceived speed.

**Rollback / done:** failed publication retains previous valid release; old package/instance remains selectable. No destructive rewriting of drafts. Done only when persisted readback and published browser output agree for both designs; updating a generator or producing two arrays is insufficient.

## Phase 2 — complete shared factual content and discovery

**User-visible outcome:** each niche can show trustworthy product-specific facts and functional retrieval; controls reflect real data.

**Sources:** `packages/shared-types/src/index.ts`, `packages/commerce-core/src/index.ts`, existing gateway product/create/update/query owners, `apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts`, `composition-engine.tsx` product/drop adapters, `packages/theme-engine/src/dynamic-source-binding.ts`, `theme-bundle.ts` collection/product sections, `built-in-section-schemas.ts`, `section-type-map.ts` and existing merchant product/editor forms.

**Work:** bounded typed namespaces for garment fit, toy contents/age, electronics units/compatibility, pantry ingredient/net quantity, furniture dimensions, gift contents, beauty use/ingredients, activity equipment and bibliography. Validate approved metadata at the domain boundary or use the existing canonical metafield owner where appropriate; do not create another product DTO. Add deliberately safe Liquid drop fields, with unknown/missing states. Normalize units explicitly. Query extensions add allowlisted typed filters/sort, pagination and supplied URLs/counts. Preserve meaningful query state. No reserved search-service activation.

**Assets/content:** synthetic positive/negative fixtures plus real merchant-supplied content requirements; no fabricated reviews, certification or promises. One full object/product image and appropriate alternate text per fixture; diagrams include text equivalents.

**Tests:** domain unit validation/conversions; contract create/update/read/hydrate; integration facets+pagination and variant availability; tenant/security denial; E2E no-results/clear filters/back navigation. Test missing facts, long names, mixed units, unavailable variants and unrecognized metadata. Avoid a green test that only sees an empty database; include positive controls.

**Accessibility/performance:** semantic tables/lists with labels and reading order; reflow at 320 CSS px and text zoom; bounded result sizes and query indexes, no N+1 facts requests; placeholder geometry for media. Prototype budgets are proposals, not measured current baselines: responsive hero ≤250KB where feasible, no autoplay video by default, at most two font families per experience with justified weights. Set and measure actual page/JS/image budgets against representative low-bandwidth/mobile hardware before acceptance.

**Rollback / done:** versioned optional fields tolerate absent content; unsupported UI stays hidden. If a schema migration is actually needed, allocate its number only after reconciling current authority/current max and paired DOWN requirements. Do not copy the historical “next 162” note over the current migration history or rewrite migration 372. Expand/backfill/verify/contract only when applicable, never drop a shape early. Done when supplied facts/filters survive persisted readback and actual Liquid render with correct missing states.

## Phase 3 — implement the portfolio in reusable patterns

**User-visible outcome:** all ten installed designs express their distinct missions on home/collection/product/mobile, with shared reliable purchase controls.

**Sources:** same engine composition/schema/Liquid files; `theme-presets.ts` settings and `experience-fonts.ts`; commerce storefront head/token integration; current approved UI token authority. Extend the existing approved island runtime only where a bounded interaction is necessary. New Liquid capabilities are not added to the legacy React section renderer.

**Implementation groups:**

1. Shared card/fact presentation: apparel, toy, technical, pantry, dimension, gift, care, equipment, book and customization-base variants. These are schema-selected patterns, not ten copied `ProductCard` files.
2. Shared layout responsibilities: editorial split, guided category bento, search/index rail, shelf list, room index, occasion finder, process steps, routine links and subject shelves.
3. Product layouts: fit, contents, technical, ingredient, spatial, configuration review and reading. Reuse option/quantity/cart mechanics and facts primitives.
4. Experience-level ordered templates, safe defaults, palette roles, width/density/image rules and original media brief. Remove universal free-shipping/spec-verified claim defaults from unsupplied content.

**Dependencies:** Phase 2 data gates; Phase 0 identity decisions. Defer comparison until typed data works. Gifts message field waits for persistence/fulfillment; MadeYours waits for its complete workflow. Ready-made sets remain ordinary stock SKUs.

**Tests:** each blueprint's niche scenario plus shared contract/unit/security/regression pack; same-catalog structural assertions; screenshot/DOM desktop/mobile comparisons; neutral review detects brand-only changes. Preserve per-section parity/security/performance gates required by TEST-R6. A new Liquid layout is judged against its accepted behavior/reference and the canonical shared section; do not create a new React fork merely to obtain a comparison target.

**Recovery / done:** introduce versioned package defaults, not in-place mutation of merchant releases. Prior version stays recoverable. Each design's required content, missing-content behavior and actual implementation status are visible. Done only when all six page/device combinations and actual interactions satisfy their blueprint; a gallery image alone cannot exit the phase.

## Phase 4 — explicit personalization and optional messaging slice

**User-visible outcome:** MadeYours can support the approved bounded text configuration, and Kindred can show an actual supported gift note if that scope is chosen.

**Sources:** `packages/checkout-core/src/index.ts` cart-line/order contracts, existing gateway storefront cart/order execution, `packages/commerce-core` product configuration schema, canonical cart islands/context, merchant order/fulfillment presentation. One cart/order system; no separate customization service.

**Work:** product-defined text/method limits, normalized Unicode/grapheme rules, escaping, configuration version/hash, server validation and price consequences, distinct line identity, immutable order snapshot and merchant fulfillment readback. Add review/edit at product/cart; invalid revalidation cannot silently discard data. Gift notes have explicit line/order scope and retention. File uploads/proof approval/subscriptions are excluded from this slice.

**Tests:** permitted/disallowed/overlong/Unicode input, two different configurations of the same SKU, edit/reprice, malicious markup, duplicate requests, concurrent stock changes, cart-to-checkout-to-order persistence, merchant readback and wrong-tenant denial. Money/order changes trigger applicable full domain suites, not a presentation-only test pack.

**Accessibility/security/performance:** errors near field plus announcement/summary; no color-only error; secure text handling at every output; no extra private file storage or external preview service. Preview is labelled illustrative unless exact production fidelity has been established.

**Recovery / done:** do not enable the public configurator until all order/readback gates pass. A failed configuration mutation retains recoverable text and prior valid cart; failed publish keeps prior release. If the product/policy decision is not approved, MadeYours remains a specified but unshipped design and must be labelled accordingly in the gallery.

## Phase 5 — merchant choice, safe switching and truthful previews

**User-visible outcome:** selection previews accurately represent installed artifacts, and existing merchant work is protected.

**Sources:** current merchant Themes gallery/editor, `ExperiencePicker.tsx`, `SchemaFormRenderer.tsx`, existing draft/session/publish routes, `theme-execution.adapter.ts`, catalog thumbnail/build tooling. Inspect current handler boundaries before editing; no replacement editor or alternate draft store.

**Work:** niche fit/content requirements; multi-page desktop/mobile previews from exact artifact; labelled sample versus merchant data; explainable industry recommendation with override; style/additive/full diff and explicit application; saved/readback/conflict status distinct from preview and published status. Preserve custom section IDs/content where the chosen mode promises preservation. Maintain theme library limits and ownership rules.

**Tests:** new merchant, empty catalog, existing custom sections, existing pet/general designs, unknown industry, stale draft, preview expiry, library full, save/network failure and failed publish. Thumbnail/version checksum equals selected install artifact. Verify controls work in actual mobile browser, not only editor device frame. Confirm preview origin cannot confer merchant/admin permissions.

**Recovery / done:** last good release and prior instance remain available; settings-only switch does not remove sections; full-design content risk is concrete and reviewable. Done when selection, install, preview and published store tell the same versioned design story and recovery does not lose edits.

## Phase 6 — release qualification and rollout readiness

**User-visible outcome:** a qualified, recoverable portfolio rather than ten polished screenshots.

**Required proof:** appropriate full 9-class Theme-Liquid coverage (unit, integration, contract, E2E, security, performance, regression, rollback and deletion validation where applicable). No deletions are proposed here; if implementation later deletes a loser, DEL-R1–6 gates apply. Keep sandbox-escape/stored-XSS/limits and section parity as hard gates; preserve cross-tenant positive-control denial, preview scope, server totals/idempotency and hosted checkout. Run touched package/app builds/typechecks and mandatory governance; a green structural lint is not behavioral proof.

**Browser acceptance:** all ten designs at 1440×1000 and 390×844; add 768/1024 and 320px reflow where appropriate; long translated names, missing media/facts, zero products, 1/200 product catalogs, unavailable variant, stock/price race, keyboard, focus return, validation errors, 200% text zoom, reduced motion and screen reader. Separate navigation shell, data, image, interactivity and cart acknowledgement timings. Use actual network/performance instrumentation; do not infer cache design.

**Package commands available today:** `pnpm --filter @letbuyy/theme-engine test`, `pnpm --filter @letbuyy/theme-engine typecheck`, gateway `test:unit`/isolated `test:db` through the repo harness, touched merchant/commerce checks, and `node scripts/validate-governance.mjs`. These are implementation checks to select based on touched boundaries. Do not run an owned-database suite against a real merchant database.

**Rollout/recovery:** only an approved implementation task may proceed to publication/deployment; this research performs neither. Use existing release/version mechanism and explicit test-site qualification; retain prior package/release. No manual publish SQL or cache-clearing procedure is a substitute for the canonical service path. Done requires traceable implementation, persisted readback, browser evidence, known limitations and release recovery proof.

## Handoff status vocabulary

| State | This research |
|---|---|
| Visually specified | Ten original blueprints; desktop/mobile home/collection/PDP schematics. |
| Technically supported | Mixed A–E; feature-level status in CAP ledger. |
| Implemented production portfolio | No. |
| Browser verified | Shopify observations and local research artifact rendering only. |
| Persisted and read back | No LetBuyy catalog/draft/release mutation or live readback. |
| Published | No. |
| Deployed | No. |

Do not collapse those states into “complete themes.” Research delivery is complete as documentation with explicit unverified branches; production delivery must satisfy the phase exits.
