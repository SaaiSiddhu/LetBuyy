# Phase U Plan — Settings Control Renderer

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** U — Settings Control Renderer
**Date:** 2026-07-11

---

## Objective

Extend `SchemaFormRenderer` to cover the full Shopify-parity field type set (26 types total: 11 frozen + 15 new). Add conditional visibility, type-safe default resolution, and required validation. Fix the pre-Phase-U `number` min/max/step gap and `url` safety gap. Add `isUnsafeUrl` as a public helper. Document the resource-picker NOT-CONNECTED contract for Phase W.

---

## Constraints

1. **`theme-registry.ts` is FROZEN.** `SchemaField` union must not be modified. All extensions go in a separate file.
2. **`theme-renderer.ts` sanitiser is locked.** Phase U must not touch it.
3. **`editor/page.tsx` is FOREIGN WIP.** Phase U must not touch it.
4. **`apps/merchant-control-plane/src/app/globals.css` is FOREIGN WIP.** All new CSS goes in `controls/controls.module.css` (CSS Modules, `--lb-*` tokens only).
5. **No `dangerouslySetInnerHTML` in any new control.** Raw HTML/Liquid must stay in `<textarea>` only.
6. **No API calls in new controls** (except `VideoControl` which follows the existing `ImageInput` upload pattern).
7. **`--lb-*` tokens only** in CSS. No `rounded-[Npx]` Tailwind classes. No raw hex values in new files.
8. **RISK-DUAL-N01 preserved.** Controls receive `(value, onChange)` only; the schema descriptor object is never mutated.
9. **No realtime subscriptions** until RISK-SEC-P01 is resolved.
10. **Resource pickers must display NOT-CONNECTED badge.** Live search is deferred to Phase W. No fake data.

---

## RISK-T03 status at Phase U entry

RISK-T03 (`block.settings` bypass `filterBlockedSettingsKeys` in theme-renderer.ts) was targeted at Phase U in the risk register. Phase U does NOT address it because:
- The fix requires touching `theme-renderer.ts` (which also carries RISK-T01/T02 deferred fixes).
- Phase U's lane A focuses on `schema-field-extensions.ts` only; lane B focuses on the merchant UI controls.
- The defence-in-depth bound (authenticated-only editor, DOMPurify at render time, no attacker-controlled block definitions in production) continues to apply.
- RISK-T03 target is updated to Phase V.

---

## Lane A — `packages/theme-engine`

### New file: `schema-field-extensions.ts`

Exports:
- `ExtendedFieldType`: 15 new type literals.
- `AllFieldType = SchemaField['type'] | ExtendedFieldType`: all 26 types.
- `ExtendedSchemaField`: extends `Omit<SchemaField, 'type'>`, adds `required?`, `visible_if?`, `resource_type?`.
- `isUnsafeUrl(value: string): boolean`: re-implements the private `isUnsafeThemeUrl` from `index.ts:320` (same 4-check blocklist: `javascript:`, `vbscript:`, `data:text/html`, `data:application/xhtml`). Cannot import the private function; re-expressed as a public export.
- `validateFieldValue(field, value): string | null`: bounds checks (number/range), URL safety (url/video/video_url), YouTube/Vimeo pattern (video_url), font registry constraint (font_picker), maxLength (text variants), required check, info-control short-circuit. Unknown types return `null` (never crash).
- `isFieldVisible(field, values): boolean`: strict-equality `visible_if` guard; `true` when absent.
- `resolveFieldDefault(field): unknown`: boolean → `false`, numeric → `min ?? 0`, info → `null`, others → `''`. Fixes the type-unsafe `?? ''` coercion in `SchemaFormRenderer`.

### Modified file: `index.ts`

Add `export * from './schema-field-extensions'` with a Phase U comment block. No other lines changed.

### New file: `test/schema-field-extensions.test.ts`

73 tests covering all 4 helpers across all 26 types.

---

## Lane B — `apps/merchant-control-plane`

### Modified: `src/lib/theme-schemas.ts`

Re-export `ExtendedSchemaField`, `ExtendedFieldType`, `AllFieldType`, `isUnsafeUrl`, `validateFieldValue`, `isFieldVisible`, `resolveFieldDefault` from `@letbuyy/theme-engine`.

### Modified: `src/components/theme-editor/SchemaFormRenderer.tsx`

- Upgrade `schema` prop type to `Record<string, ExtendedSchemaField>`.
- Add `isFieldVisible` loop: skip fields whose `visible_if` constraint is not met.
- Use `resolveFieldDefault` for type-safe defaults (replaces `?? ''` coercion).
- Add 15 new switch cases; delegate to new control components.
- Fix `number`: pass `min`, `max`, `step` from schema (pre-Phase-U: ignored).
- Fix `url`: call `isUnsafeUrl` before accepting the value.
- Backward compat: unknown types fall through to `TextInput`.

### New directory: `src/components/theme-editor/controls/`

One file per new control:

| File | Control type(s) | Key properties |
|------|----------------|---------------|
| `CheckboxControl.tsx` | `checkbox` | Native `input[type=checkbox]`; `aria-required`, `aria-invalid`, `aria-describedby` |
| `ColorBackgroundControl.tsx` | `color_background` | Solid-colour picker OR gradient CSS string toggle |
| `ColorSchemeControl.tsx` | `color_scheme` | `<select>` from named scheme options |
| `FontPickerControl.tsx` | `font_picker` | `<select>` constrained to `EXPERIENCE_FONT_REGISTRY`; live font preview |
| `HtmlControl.tsx` | `html` | `<textarea>`; no DOM injection; sanitise disclaimer |
| `LiquidControl.tsx` | `liquid` | `<textarea>`; NOT-CONNECTED badge; canary-OFF note |
| `VideoControl.tsx` | `video` | URL + `video/*` file upload; `isUnsafeUrl` guard |
| `VideoUrlControl.tsx` | `video_url` | YouTube/Vimeo URL; `isUnsafeUrl` guard; `VIDEO_URL_PATTERN` test |
| `InfoControls.tsx` | `header`, `paragraph` | Display-only; `role=heading` / description text; no `onChange` |
| `ResourcePickerControl.tsx` | `product`, `collection`, `blog`, `page`, `menu` | ID text entry + NOT-CONNECTED badge; no API call |
| `controls.module.css` | All of the above | `--lb-*` tokens only; no `rounded-[Npx]`; no modification to `globals.css` |

### Modified: `package.json`

Append `theme-editor-u.test.mjs` to test script.

### New file: `tests/theme-editor-u.test.mjs`

76 static-contract tests (node:test; no DOM; no network):
- File existence for all 11 new files.
- `@letbuyy/ui` import in every control.
- No `rounded-[Npx]` in any new file (design ratchet).
- NOT-CONNECTED badge text in `ResourcePickerControl` and `LiquidControl`.
- `EXPERIENCE_FONT_REGISTRY` reference in `FontPickerControl`.
- No `dangerouslySetInnerHTML` in `HtmlControl` / `LiquidControl`.
- `SchemaFormRenderer` imports `ExtendedSchemaField`, `isFieldVisible`, `isUnsafeUrl`, `resolveFieldDefault`.
- `SchemaFormRenderer` has all 15 Phase U type cases.
- `SchemaFormRenderer` never imports from `page.tsx`.
- RISK-DUAL-N01: controls receive `value + onChange` only.
- No `globals.css` import in new controls.
- No Supabase / gateway import in new controls.

---

## Rollback Plan

Rollback is `git revert` of Phase U commits (or `git checkout --` per file if not yet committed). Because:
- Lane A adds a new file and one export line to `index.ts` — reverting removes both with no side effects.
- Lane B adds a new directory and modifies `SchemaFormRenderer.tsx` and `theme-schemas.ts` — reverting restores the pre-Phase-U 11-type renderer.
- `package.json` change is a single-line test script append.

```bash
# Lane A rollback
git checkout -- packages/theme-engine/src/index.ts
git rm packages/theme-engine/src/schema-field-extensions.ts
git rm packages/theme-engine/test/schema-field-extensions.test.ts

# Lane B rollback
git checkout -- apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx
git checkout -- apps/merchant-control-plane/src/lib/theme-schemas.ts
git checkout -- apps/merchant-control-plane/package.json
git rm -r apps/merchant-control-plane/src/components/theme-editor/controls/
git rm apps/merchant-control-plane/tests/theme-editor-u.test.mjs
```

Rollback restores Phase T state: 11-type renderer, no conditional visibility, no `isUnsafeUrl` public export. No database changes. No gateway changes.

---

## Exit Gate

| Suite | Required |
|-------|---------|
| theme-engine typecheck + test | 1136/1136 (+73 over Phase T baseline of 1063) |
| merchant typecheck + test | 196/196 (+76 over Phase T baseline of 120) |
| api-gateway test | 479/479 (unchanged) |
| storefront-runtime test | 795/795 (unchanged) |
| validate-governance.mjs | Anti-fabrication PASS (pre-existing tenant drift unchanged) |
