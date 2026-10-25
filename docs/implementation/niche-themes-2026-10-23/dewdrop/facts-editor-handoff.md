# Dewdrop merchant facts editor

Implemented named export `DewdropFactsEditor` at `apps/merchant/web/src/components/products/niche-facts/dewdrop-facts-editor.tsx`, with eight real ReactDOM/JSDOM interaction tests in the matching `.test.tsx`. It uses the shared `NicheFactsEditorProps` from the parent products directory. The host's `@letbuyy/ui` Input, Select, Textarea and Button, semantic token classes, spacing, native fieldsets and Lucide icons are reused. No CSS module is needed; no storefront palette/font is applied to the merchant surface.

The controlled draft remains editable when incomplete. Canonical `BeautyFactsSchema` errors appear with associated controls, a review summary and an issue count visible when the details panel is collapsed. There are no defaults for factual quantity, product format, ingredients, directions, warnings or colour references. Empty optional fields are deliberately omitted. Clearing all returns `null` to request namespace removal. Nothing is written or submitted by the component itself.

Shade option and value controls use only the supplied product's canonical option strings. Existing unavailable names remain visible with an error; resource changes never erase or rewrite the existing facts. Named rows remain distinct when RGB values match. Codes and optional hex references are presentation data, never SKU or purchase identity. Incomplete/duplicate names, invalid RGB and non-positive quantities remain visible for correction. Row removal restores focus to another shade or its add action.

## Parent integration

The parent must perform these steps inside its existing product editor and save/conflict/version/recovery flow:

1. Pass the current unnormalized `beauty` draft as `value`, current `images` and `variantOptions` as `resources`, and its actual disabled state. Product options must use canonical `{ name, values: string[] }` values, including options not yet assigned server UUIDs.
2. On change, preserve the other metadata namespaces and raw incomplete draft. For `null`, remove the `beauty` key from the metadata object; never persist `beauty: null`. Do not replace incomplete input with schema defaults or the previous valid value after each keystroke.
3. Before save, validate the complete product/metadata command through canonical schemas and validate that each beauty shade option/value belongs to the actual product options. Keep errors and the attempted draft visible when validation, session, version or conflict handling refuses the save. Parent permission/version/idempotency behavior stays authoritative.
4. Store and restore beauty draft data in the same existing snapshot/recovery path as the rest of the product. An uncertain mutation retries its original command; the component does not dispatch a fresh save, fetch, local storage or API operation.
5. Treat option changes as changes requiring review. The component flags stale associations and preserves supplied codes/ingredients, allowing the merchant to select a new option/value or remove a row deliberately. It never merges by colour or silently reassigns variant identity.

No shared product form, package export, manifest, API or domain DTO was changed in this allocation. Integration and durable acceptance remain coordinator-owned.

## Verification

Final combined Dewdrop verification: 34 tests pass, zero fail/skip, four no-emit type checks pass and focused merchant ESLint passes. Exact commands, exit codes and source hashes are in `verification.json`.

The eight component tests exercise absent facts/no initial emissions, actual edited payload, canonical valid and invalid drafts, same-RGB identity, optional omission and full namespace removal, product option renames without data loss, disabled controls and guarded emission, unique labels across two mounted instances, hostile values as inert text, and focus after row removal. The only local lint exception is one documented synthetic RGB data constant required for the same-colour identity test; it is not a UI colour or shared validator change.

The additional actual Liquid test checks two identically titled service blocks: preview DOM IDs are exactly their distinct canonical block IDs, and public DOM contains no editor block IDs. The inline root uses only the server-generated `{{ block.editor_attributes | raw }}` fragment. Merchant facts never use raw HTML output.

The previous 18 renderer captures remain valid: all four rendered HTML files are byte-identical after the preview metadata correction, recorded in `capture-renderer-hashes.json`. Those storefront captures do not test this new merchant editor.

## Pending composed acceptance

Mount the component in the real parent, verify 320 px/expanded-text and keyboard behavior with the actual merchant CSS, then create/edit/save/reload the facts through the canonical API. Verify stale version/session/recovery behavior, option membership, explicit removal and correct public projection. Finally prove that the two same-colour named options select different server variant UUIDs in the actual storefront cart/order flow, with unavailable stock rejected. Component tests do not establish those durable effects.
