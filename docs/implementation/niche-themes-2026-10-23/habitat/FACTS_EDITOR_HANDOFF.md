# Habitat merchant furniture facts editor

`apps/merchant/web/src/components/products/niche-facts/habitat-facts-editor.tsx` exports `HabitatFactsEditor`. It consumes the existing `NicheFactsEditorProps` from `../niche-facts-editor-types.ts`: `value: unknown`, `onChange(unknown | null)`, `disabled?`, optional product resources. It introduces no domain DTO, API, storage, network request, nested form or package export.

The component uses existing `@letbuyy/ui` Input/Select/Textarea/Button primitives, merchant semantic tokens, responsive two-column groups and `React.useId` labels. Every action button explicitly has `type="button"`. Empty inputs do not create facts or choose a unit. Photographs and variant option names never supply measurements.

Editable fields cover separate assembled/package dimensions and units; diameter; seat height and unit; product weight and unit; up to 20 materials; finish; assembly status, instructions and tools; care. A new incomplete group/material remains in the controlled draft, with canonical `FurnitureFactsSchema` errors shown beside the affected field/group. Zero/negative values, missing units, malformed historical groups and unknown keys remain invalid until corrected or deliberately cleared. Nothing reports a draft as saved.

The parent integration must:

1. Bind product `metadata.furniture` to `value` without inventing default measurements, materials or delivery claims. For a variant, bind its enclosing durable-ID DTO's `metadata.furniture`; the component has no variant identity/map authority.
2. Keep incomplete `unknown` draft values editable and validate through the canonical namespace/product schemas before a save command. Do not discard the whole furniture draft merely because one field is incomplete.
3. Treat `onChange(null)` as removal of the `furniture` key. Do not persist `furniture: null`. Clearing the last material omits `materials`; clearing a measurement group omits that group. Empty text removes that optional field.
4. Use the existing product version/conflict/idempotency/permission path and the same atomic variant transaction. Pass `disabled` during the parent operation. This component never sends a second fact-save request.
5. Verify save/readback, edit/conflict/recovery, public projection and the selected variant's immutable cart/order snapshot through the central integration. Mounted component tests establish controlled editing, not those durable outcomes.

`facts-editor-tests.tap` records six mounted interaction tests: complete edited payload with distinct cm/in groups; canonical error/correction; omission and clear; disabled plus external parent replacement; labels/button semantics and inert hostile text; malformed-group recovery preserving unrelated care. `facts-editor-typecheck.log` is the passing no-emit component/test check.

No extra CSS module is needed: the component uses the host UI primitives and existing semantic token classes. No shared product form, package manifest/index, other editor, migration or API file was changed by Habitat.
