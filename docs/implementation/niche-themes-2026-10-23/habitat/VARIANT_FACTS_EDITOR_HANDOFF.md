# Habitat variant furniture overrides

`apps/merchant/web/src/components/products/niche-facts/habitat-variant-facts-editor.tsx` exports `HabitatVariantFactsEditor`. It consumes `NicheVariantFactsEditorProps`: controlled `value`, `onChange`, `disabled`, optional `commonFacts` and resources. Validation of the override uses **FurnitureVariantFactsSchema**. Canonical product facts are only read-only reference context, formatted through the existing public facts presentation helper.

The existing merchant UI primitives, semantic tokens and `React.useId` labels are retained. No local domain DTO, variant ID/map, API call, storage, submit form or package export was added. `resources` never supplies inferred measurements. All action buttons have `type="button"`.

Stored overrides and inherited product facts are deliberately distinct:

- Common measurements/materials/assembly/care appear as read-only reference text. They never prefill or emit an override.
- A supplied assembled/package/seat-height/weight group replaces that entire common group, including its unit. Incomplete groups remain editable with canonical errors; absent dimensions within a supplied group do not inherit measurements from another unit.
- Materials replace the whole list. Removing the last override material omits the group and restores product materials.
- An assembly group replaces status, instructions and tools together. Optional field omission and the “Use product…” actions restore canonical inheritance; no unsupported null/empty-list suppression shape is emitted.
- Clearing all overrides emits `null` to the parent. The parent removes `metadata.furniture`; it must not persist a namespace null.

The parent must bind this component to the actual enclosing variant DTO, show that variant's identity outside the facts, keep its durable ID authoritative and use the same atomic product/variant create/edit command. Invalid drafts must be retained for correction and block the canonical save. Existing version/conflict/idempotency/permission/recovery handling remains in that parent. This component does not implement a second save or create IDs.

Eight mounted React interaction tests pass in `variant-facts-editor-tests.tap`: full edited payload with distinct units; invalid correction retaining other text; omission/return-to-product actions; disabled and external replacement; labels/buttons and inert hostile text; malformed-group recovery; actual resolver inheritance/atomic group replacement; rejection of inline identity and null clear shapes. The component and test no-emit check passes in `variant-facts-editor-typecheck.log`.

Shared parent integration, durable save/readback, selected variant hydration and immutable cart/order snapshot verification remain central acceptance work. Root reported that the product-level editors are connected with 21 parent tests passing; that report is distinct from the observed component tests here. No merchant browser or database write was run for this allocation.

## Retained section editor correction

The factory now preserves addable Core `faq-accordion` with its `faq-item` blocks. Habitat's unchanged measurement-guide markup/settings use `habitat-measurement-guide`, keeping the existing home instance ID and composition. Retained inline Core block roots use `{{ block.editor_attributes | raw }}` on their native element. The retained standalone badge replaces its old public `data-block-id` with the same conditional renderer fragment.

An actual renderer/DOM test verifies two identical-text FAQ items and badges retain their exact IDs on native `details`/`span` roots in preview, and have no `data-block-id` publicly. There are no new block wrappers or changes to renderer sanitization/depth. The domain/theme suite now passes 16 tests.

The coordinator's conditional acceptance of the separate guide is now backed by three passing tests in `section-acceptance.test.ts`. The strict full bundle survives ThemeDocument parsing/roundtrip; the real persistence builder emits the guide's settings schema, source path and approved Liquid renderer key. Canonical draft validation accepts all Habitat templates plus the full bundle using its actual package settings and section schemas (about 158,000 serialized characters, below the unchanged 256,000-character limit). Removing the actual section file is rejected. The global registry lacks the guide and validation without the package-provided schema fails closed.

The actual storefront resolver keeps the guide with its `liquid.section.habitat-measurement-guide` key. The actual data planner makes no product service call for this text-only section; a product-section positive control reaches the guarded service, proving the planner remains live. Actual Liquid output includes the edited guide title after document roundtrip, without warnings or fallback. Theme governance and the no-new-React-sections validators both pass. These are local contract/runtime checks, not a database write or global registration.

Seven actual app-mapper/Liquid fixtures were refreshed successfully. Home, collection and missing-product fixture HTML stays byte-identical to the earlier browser capture; four PDP fixture hashes changed, recorded in `rendered-refresh-check.json`. The earlier 22 screenshots remain earlier-source presentation evidence. Final-source PDP and composed merchant/variant browser verification remains pending; no new browser slot was acquired.

## Catalog demo membership

`HABITAT_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]>` is exported from the existing `habitat-demo.ts`. Living room contains chair then table (count 2); reading corner contains chair (count 1). Keys are the actual collection IDs; values are existing sample product IDs. Unknown keys have no membership and must never fall back to all products.

Two tests in `demo-membership.test.ts` verify the actual catalog IDs, unique handles, counts/order, an explicit empty fixture and rejection of foreign or missing membership. These test fixture integrity; the marketplace owner retains routing/common dispatcher integration and its unknown-route behavior. No install seed, new product, API or shared dispatcher was changed.
