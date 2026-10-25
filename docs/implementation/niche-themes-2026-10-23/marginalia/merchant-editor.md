# Marginalia merchant facts editor

`apps/merchant/web/src/components/products/niche-facts/marginalia-facts-editor.tsx` exports **`MarginaliaFactsEditor`**, using the root-owned `NicheFactsEditorProps` contract. Only the owned component, matching mounted test and implementation evidence were changed. The component reuses `@letbuyy/ui` Input, Select, Textarea, Button and InlineError; canonical merchant token classes and Lucide icons match the existing apparel editor. No CSS module or shared style change was needed.

The editor supplies product-level `metadata.books` fields from `BooksFactsSchema`: print bibliography and optional checked ISBN, language/format/edition, dimensions/pages; stationery gsm/ruling/binding/page and sheet counts/materials/contents; and an optional reading excerpt with deliberately selected permission and attribution. Choosing a facts type adds only its discriminant. Switching types explicitly clears previous facts, with that effect explained beside the selector. Book-only controls never appear for stationery.

The controlled `value` is a raw form draft, not an assumed valid `BooksFacts`. All edits call `onChange` without silently discarding invalid input. Partial numbers such as `1.`, missing dimensions, blank array rows, invalid checksums and incomplete excerpts remain editable. Canonical Zod issues are associated with labelled fields through the shared UI error behavior. An excerpt remains visible even after its last entered character is cleared; only explicit removal removes that optional section. Optional blank scalar fields are omitted, array removal deletes the last empty collection, and clearing both dimensions removes the optional object. No factual defaults, inferred rights, network request, storage write, extra form or save button is introduced.

Every field has a `React.useId`-based identity. Actions have `type="button"`, respect `disabled`, and cannot dispatch a parent form submission. Removing an array row or excerpt returns focus to its add control. Removing all facts emits **`null`** and focuses the disclosure summary. Disabled/read-only updates are guarded even if a synthetic change event is dispatched directly.

## Exact parent integration requirement

The root-owned canonical product editor must:

1. Pass the current raw `metadata.books` draft (or `null` when absent), `onChange`, and the real saving/permission `disabled` state. `resources` may be passed through the shared contract; this editor does not need to inspect media or variant options.
2. Retain **every** raw callback value in the existing dirty/conflict/version/recovery snapshot, including incomplete or invalid drafts. Do not replace the controlled prop with `safeParse(...).data` while a merchant is typing, or ignore invalid callbacks.
3. Validate non-null values with the canonical `BooksFactsSchema` at the existing save boundary and block submission on failure. On success serialize the parsed result so canonical trimming and ISBN normalization apply to the write.
4. Interpret `onChange(null)` as **remove `metadata.books`**, preserving unrelated metadata. Do not persist `books:null`, invent a new endpoint, or treat clear as an already acknowledged save.
5. Save with the existing actor/site authority, optimistic version, idempotent command, conflict recovery and acknowledged readback. Verify reload and a second edit preserve the exact accepted namespace.
6. Keep edition-specific facts inside the canonical variant's `metadata.books`, with the enclosing persisted UUID as identity and `BooksVariantFactsSchema` as that command's validator. This product-level component does not claim to implement a variant editor or atomic variant persistence.

## Verification and limits

Run from the repository root:

```sh
node --import tsx --test apps/merchant/web/src/components/products/niche-facts/marginalia-facts-editor.test.tsx
node node_modules/typescript/bin/tsc -p docs/implementation/niche-themes-2026-10-23/marginalia/editor-typecheck.json
```

Eight tests mount the **actual** controlled component and shared UI in React/JSDOM. They verify edited payloads against canonical Zod, omitted facts, checksum correction, retained partial numbers/dimensions, separate page/sheet units, kind changes, unselected excerpt rights, deliberate clearing/focus, disabled and external replacement behavior, unique labels in two instances, hostile text and absence of nested forms or unintended submits. The focused no-emit configuration includes only the owned editor/test entrypoints and their actual imports; it is not a full merchant build or programme gate.

Parent save/conflict/version/reload integration, browser visual/keyboard acceptance and database persistence remain coordinator-owned and unclaimed. Evidence is in `merchant-editor-tests.tap`, `merchant-editor-validation.json` and the current status/report.
