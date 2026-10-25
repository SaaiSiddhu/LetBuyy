# Playfield product facts editor

The exclusive component exports `PlayfieldFactsEditor` from `apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.tsx` and consumes the root-owned `NicheFactsEditorProps`. The coordinator subsequently connected the product controls and reported 21 passing parent tests. This document retains the product leaf contract and its nine owned mounted tests. No shared form, manifest, API, storage, network or package export was changed by this chat.

It preserves the merchant UI with `@letbuyy/ui` Input/Select/Textarea/Checkbox/Button, semantic `--lb-*` tokens and Lucide icons. Fields cover supplied age bands/prose, interest/type codes, contents/quantities/completeness, primary and separately labelled part measurements, materials/finish/care, and warning/source/edition. New rows start empty; units, quantities, ages, warnings and material claims are never prefilled. Resources are not interpreted as evidence of dimensions or safety.

## Parent contract

- Pass only the product namespace as `value`: `metadata.toys` or an absent/null UI value. Pass `disabled` while the record cannot be edited or a canonical save is in flight. `resources` remains an optional standard prop; this component does not infer product facts from images/options.
- `onChange(next)` returns the current unparsed draft. Retain it even if `ToyFactsSchema.safeParse(next)` fails; incomplete rows and numeric corrections must not disappear. The component displays the canonical field messages and a summary but deliberately performs no save.
- For a non-null draft, **replace** the `metadata.toys` namespace in the parent draft, preserving sibling metadata. Do not shallow-merge its old fields: fields omitted after a clear must disappear.
- `onChange(null)` means **delete the `toys` key**. It is a UI removal instruction, never a persisted `metadata.toys:null`. Removing the last supplied field can emit null; the explicit “Remove all toy facts” button does the same.
- Block save while the non-null draft fails `ToyFactsSchema`. Use canonical parsed data only at the established validation boundary. Keep product version/conflict checks, actor/store/product context, idempotency, uncertain-reply recovery and accepted readback in the existing parent lifecycle.
- This is the **product** facts editor. The separate `PlayfieldVariantFactsEditor` now implements `ToyVariantFactsSchema` and explicit inheritance/[]/null clear controls. Omission of a product field is not automatically a variant clear. Use the variant-specific contract in `VARIANT_EDITOR_HANDOFF.md` for variant parent wiring.
- Controlled prop replacement is authoritative. The component keeps no private product draft, so a recovered or newly selected record is rendered from the supplied value. Parent recovery must never send one record's facts to another record/store/actor.

## Evidence

Nine mounted React/JSDOM tests pass using the actual component and shared UI. They exercise emitted payloads, invalid/incomplete drafts and corrections, canonical Zod acceptance/rejection, absent fields, deliberately cleared contents/measurements/namespace, sourced warning text, hostile text as inert data, disabled controls including programmatic events, unique `useId` label associations, and non-submitting actions within a parent form. See `editor-tests.tap` and the colocated test file.

Focused no-emit TypeScript checks for both component and test pass. The exclusive CSS module passes Stylelint. CSS is not rendered by these mounted tests: the host build, actual merchant visual/keyboard acceptance and integrated save/conflict/readback path remain coordinator-owned pending gates. The component alone does not establish server persistence or end-to-end completion.

```sh
node --import tsx --test apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.test.tsx
pnpm exec tsc --noEmit --incremental false --skipLibCheck --strict --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --rootDir . apps/merchant/web/next-env.d.ts apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.tsx apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.test.tsx
pnpm exec stylelint apps/merchant/web/src/components/products/niche-facts/playfield-facts-editor.module.css
```
