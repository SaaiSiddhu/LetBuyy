# Marginalia canonical variant facts editor

`apps/merchant/web/src/components/products/niche-facts/marginalia-variant-facts-editor.tsx` exports **`MarginaliaVariantFactsEditor`** with the root-owned `NicheVariantFactsEditorProps`. `value` is the unwrapped raw draft for one enclosing canonical variant's `metadata.books`; `commonFacts` is the unwrapped product-level books namespace, supplied as read-only context. Neither prop introduces a variant identity. No IDs, SKU identity, price, stock, permission guess, second save or new API exists in this component.

The variant draft uses **`BooksVariantFactsSchema`** for its field errors. A selected book override requires its own language and format; common values are displayed separately and are never silently copied into those required fields. Optional bibliography, edition, checked ISBN, dimensions/pages and stationery paper/ruling/binding/count/material/content overrides stay absent when unknown. Book-only controls and reading-excerpt permissions never appear for stationery; the variant schema does not support an excerpt override.

Partial numbers, invalid checksums, incomplete dimensions and existing malformed drafts remain editable. Clearing optional fields **omits that override**; it cannot force an inherited common value to disappear with an unsupported null/empty sentinel. The public canonical `mergeBooksVariantFacts` helper checks combined facts without rewriting the draft, including a page-count override incompatible with an inherited sheet count. A supplied common kind constrains the selector. Existing mismatches remain visible and correctable, with a kind error; invalid common facts are identified without displaying unvalidated values as facts.

The host controls/tokens, Lucide icons, `React.useId`, labelled fields, `type="button"`, disabled guards, bounded arrays and focus recovery follow the already-delivered product editor. The component has no nested form, network call or storage operation. No shared parent, form state, metadata helper, manifest or package export was changed.

## Parent integration requirements

1. Mount this leaf inside the **existing canonical variant row**, keyed by that row's existing identity. Pass its raw `metadata.books` value and the current unwrapped common books draft. Keep the persisted UUID solely on the enclosing canonical variant DTO; never derive identity from SKU, option labels or array position.
2. Retain every raw callback, including incomplete values, in the existing product/variant dirty/conflict/version/recovery state. `onChange(null)` requests removal of **only this variant's books namespace**. Preserve other variant metadata and the product/common facts; do not persist a new `books:null` sentinel from this component.
3. Validate an override with `BooksVariantFactsSchema`, match the common kind when supplied, and validate its accepted combined facts through the canonical merger before save. Product/common validation remains its own gate. The leaf union alone accepts both kinds; it cannot enforce cross-record kind matching without parent/common context.
4. On accepted serialization use the parsed canonical result (including ISBN normalization). Save with the enclosing variant in the **same canonical create/edit transaction**, under the existing scope/version/idempotency path. No two-save correlation map or client-fabricated persisted UUID is introduced here.
5. Verify acknowledged readback retains the exact enclosing UUID and namespace, removal restores the existing canonical inheritance semantics, a later common edit resolves consistently, and public `variant.books`/`books_display` plus immutable accepted order facts correspond to the selected variant. These persistence/snapshot claims remain coordinator-owned and unproven by the UI tests.

## Evidence

```sh
node --import tsx --test apps/merchant/web/src/components/products/niche-facts/marginalia-variant-facts-editor.test.tsx
node node_modules/typescript/bin/tsc -p docs/implementation/niche-themes-2026-10-23/marginalia/variant-editor-typecheck.json
```

Nine mounted React/shared-UI tests pass: actual edited payload and required language/format; omitted optional override inheritance and namespace clear; retained partial input/ISBN errors; stationery units and contents; incompatible inherited page/sheet counts; common-kind mismatch and invalid context; disabled/external controlled updates; unique labels/inert hostile text/no unintended submission; and unsupported nested IDs/SKU/excerpt rejection. Focused no-emit checking also passes. Browser styling, parent save/conflict/version/readback and atomic database acceptance remain separate gates.
