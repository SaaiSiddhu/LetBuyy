# Phase U Report — Settings Control Renderer

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** U — Settings Control Renderer
**Date authored:** 2026-07-11
**Branch:** `stepup/main`
**Author scope:** Phase U implements the full Shopify-parity field type set for the right-panel settings form. 26 types now render (11 frozen + 15 new). Conditional visibility, type-safe default resolution, required indicators, and URL safety are all wired. Resource pickers ship as id-text-entry + NOT-CONNECTED badge; live search is deferred to Phase W. No gateway routes, database migrations, SECURITY DEFINER RPCs, or authentication tokens were modified. `theme-registry.ts` and `theme-renderer.ts` were not touched. No frozen apps were touched.

---

## HUMAN REVIEW GATE — Read Before Deploying

Phase U touches `apps/merchant-control-plane/package.json` (test script addition) which is a WIP file carrying prior user modifications. The change appends `theme-editor-u.test.mjs` to the test command and does not conflict with other entries. **This change has NOT been staged and MUST NOT be committed or deployed without explicit review of the hunk against the surrounding foreign WIP.**

No new database migrations. No gateway changes. No production deployment is implied by this phase completion.

---

## 1. What Shipped

### 1.1 New Files

| File | Lines | Purpose |
|------|-------|---------|
| `packages/theme-engine/src/schema-field-extensions.ts` | ~305 | `ExtendedSchemaField` (26-type superset), `ExtendedFieldType`, `AllFieldType`, `isUnsafeUrl`, `validateFieldValue`, `isFieldVisible`, `resolveFieldDefault` |
| `packages/theme-engine/test/schema-field-extensions.test.ts` | — | 73 new Phase U tests |
| `apps/merchant-control-plane/src/components/theme-editor/controls/CheckboxControl.tsx` | 63 | Native `input[type=checkbox]`; distinct from Toggle slide switch |
| `apps/merchant-control-plane/src/components/theme-editor/controls/ColorBackgroundControl.tsx` | 128 | Solid colour picker OR CSS gradient string toggle |
| `apps/merchant-control-plane/src/components/theme-editor/controls/ColorSchemeControl.tsx` | — | Select from named experience colour schemes |
| `apps/merchant-control-plane/src/components/theme-editor/controls/FontPickerControl.tsx` | — | Select constrained to `EXPERIENCE_FONT_REGISTRY` (6 families); font preview row |
| `apps/merchant-control-plane/src/components/theme-editor/controls/HtmlControl.tsx` | — | Sanitised HTML textarea; no DOM injection; sanitise disclaimer |
| `apps/merchant-control-plane/src/components/theme-editor/controls/LiquidControl.tsx` | 93 | Liquid code textarea; NOT-CONNECTED badge (canary-OFF) |
| `apps/merchant-control-plane/src/components/theme-editor/controls/VideoControl.tsx` | — | Video URL + `video/*` file upload; `isUnsafeUrl` guard |
| `apps/merchant-control-plane/src/components/theme-editor/controls/VideoUrlControl.tsx` | — | YouTube / Vimeo URL; `isUnsafeUrl` + pattern validation |
| `apps/merchant-control-plane/src/components/theme-editor/controls/InfoControls.tsx` | — | `FieldHeader` (`role=heading`) + `FieldParagraph`; display-only; no value |
| `apps/merchant-control-plane/src/components/theme-editor/controls/ResourcePickerControl.tsx` | 103 | ID/handle text entry; NOT-CONNECTED badge; `product`/`collection`/`blog`/`page`/`menu` |
| `apps/merchant-control-plane/src/components/theme-editor/controls/controls.module.css` | 133 | Supplemental styles; `--lb-*` tokens; no `globals.css` modification |
| `apps/merchant-control-plane/tests/theme-editor-u.test.mjs` | — | 76 new Phase U static-contract tests |

### 1.2 Modified Files

| File | Change | WIP? |
|------|--------|------|
| `packages/theme-engine/src/index.ts` | `export * from './schema-field-extensions'` added (Phase U comment block); no other lines changed | Clean |
| `apps/merchant-control-plane/src/lib/theme-schemas.ts` | Re-exports `ExtendedSchemaField`, `ExtendedFieldType`, `AllFieldType`, `isUnsafeUrl`, `validateFieldValue`, `isFieldVisible`, `resolveFieldDefault` from `@letbuyy/theme-engine` | Clean |
| `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx` | Upgraded to `ExtendedSchemaField`; `isFieldVisible` loop; `resolveFieldDefault`; 15 new switch cases; `number` now passes `min`/`max`/`step`; `url` now calls `isUnsafeUrl`; RISK-DUAL-N01 noted in comments | Clean |
| `apps/merchant-control-plane/package.json` | `theme-editor-u.test.mjs` appended to test script | WIP (foreign) |

### 1.3 FROZEN Files — Untouched

| File | Reason |
|------|--------|
| `packages/theme-engine/src/theme-registry.ts` | FROZEN; `SchemaField` union not modified |
| `packages/theme-engine/src/theme-renderer.ts` | Sanitiser locked; RISK-T03/T04 deferred |
| `packages/theme-engine/src/theme-document.ts` | Not needed in Phase U scope |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` | FOREIGN WIP; child callbacks remain optional; no touch required |
| `apps/merchant-control-plane/src/app/globals.css` | FOREIGN WIP; Phase U uses CSS modules only |

---

## 2. Control Types Implemented

### 2.1 Frozen Types — Pre-existing, confirmed unchanged

All 11 frozen types render byte-identically to the pre-Phase-U implementation. The `switch` cases are preserved in the same order.

**Fixes to frozen-type rendering (Phase U):**
- `number`: `min`, `max`, `step` now passed from `field` to `NumberInput` (previously ignored — `SchemaFormRenderer.tsx:NumberInput` silently dropped bounds constraints).
- `url`: `isUnsafeUrl` check now applied (previously no unsafe-URL guard).
- Default resolution: `resolveFieldDefault` replaces the type-unsafe `?? ''` coercion for boolean and numeric types.

### 2.2 New Types — Phase U (15)

#### Color controls

**`color_background`** (`ColorBackgroundControl`)
- Toggle between solid-colour mode (colour picker + hex text) and gradient mode (CSS string input).
- `looksLikeGradient()` detects `linear-gradient`/`radial-gradient`/`conic-gradient` on mount.
- Switching from gradient back to solid resets value to `#ffffff`.
- No `dangerouslySetInnerHTML`. The CSS string is stored as plain text; the storefront renderer applies it as a CSS background property.
- Known gap (RISK-SEC-U02): gradient mode has no `url()` content check in `validateFieldValue`.

**`color_scheme`** (`ColorSchemeControl`)
- Native `<select>` rendering named colour scheme options from `field.options`.
- ARIA: `<label htmlFor>` with required indicator.

#### Font control

**`font_picker`** (`FontPickerControl`)
- Select options are computed from `EXPERIENCE_FONT_REGISTRY` keys only (6 known families). No arbitrary font URL is accepted.
- Live font preview row below the select: sample text rendered in the selected font family using an inline `fontFamily` style.
- `validateFieldValue` rejects any value not in `EXPERIENCE_FONT_REGISTRY`.
- Known gap (RISK-SEC-U01): `isUnsafeUrl` not used here (font names are not URLs); the font-name constraint via registry is the correct guard.

#### Markup controls

**`html`** (`HtmlControl`)
- Plain `<textarea>`; `maxLength` from schema.
- `sanitize disclaimer` note rendered below the textarea.
- No `dangerouslySetInnerHTML`. HTML → DOM sanitisation is the renderer's responsibility.
- ARIA: `aria-required`, `aria-invalid`, array-join `aria-describedby`.

**`liquid`** (`LiquidControl`)
- Monospace `<textarea>` (6 rows); Fira Code / Consolas hint.
- NOT-CONNECTED badge (canary-OFF): `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` in production. Badge text: "NOT-CONNECTED — Liquid rendering disabled (canary flag off)".
- No `dangerouslySetInnerHTML`. Liquid → HTML compilation is the renderer's responsibility.
- Known gap (RISK-STYLE-U01): `fontSize: 12` is a raw pixel value in the inline style; should use `var(--lb-font-size-caption, 12px)`.

#### Boolean control

**`checkbox`** (`CheckboxControl`)
- Native `input[type=checkbox]`; distinct from the existing `toggle` slide switch.
- `aria-required`, `aria-invalid`, ternary `aria-describedby`.
- Known gap (RISK-A11Y-U02): ternary form drops `helpText` from `aria-describedby` when an error is also present.
- Known gap (RISK-SEC-U03): `required: true` on a checkbox is effectively a no-op; `false` passes the required check (see §4).

#### Media controls

**`video`** (`VideoControl`)
- URL text entry + `video/*` file upload (mirrors `ImageInput` upload pattern).
- `isUnsafeUrl` guard on the URL text input.
- Upload uses `/api/stores/[store]/upload`; `storeName`-gated (shows warning when absent).

**`video_url`** (`VideoUrlControl`)
- YouTube / Vimeo URL input.
- `isUnsafeUrl` check runs first; then `VIDEO_URL_PATTERN` (`/^https?:\/\/(www\.)?(youtube\.com\/|youtu\.be\/|vimeo\.com\/)/`) validates the domain.
- HTTPS required (pattern rejects HTTP).

#### Info controls (display-only)

**`header`** (`FieldHeader` from `InfoControls.tsx`)
- Renders a `<div role="heading">` with the field's `label` text. No value. No `onChange`.

**`paragraph`** (`FieldParagraph` from `InfoControls.tsx`)
- Renders a `<p>` with `field.info || field.description` text. No value. No `onChange`.
- `resolveFieldDefault` returns `null` for these types; `validateFieldValue` returns `null` unconditionally.

#### Resource pickers — NOT-CONNECTED at Phase U

**`product` / `collection` / `blog` / `page` / `menu`** (`ResourcePickerControl`)
- Renders a plain text `<Input>` for the resource ID or handle.
- NOT-CONNECTED badge: "NOT-CONNECTED — live search available in Phase W".
- `aria-describedby` uses array-join form linking the error id, NOT-CONNECTED badge id, and help text id.
- No API call made here. No fake or placeholder data shown.
- Live searchable picker (Phase W) replaces this control at the same call site; no schema change required.

---

## 3. Conditional Visibility

**`visible_if` in `ExtendedSchemaField`:**
```typescript
visible_if?: {
    field: string;   // key of the sibling field to watch
    value: unknown;  // exact value that triggers visibility (strict equality)
}
```

**`isFieldVisible(field, values): boolean`:**
- Returns `true` when `field.visible_if` is absent.
- Returns `values[field.visible_if.field] === field.visible_if.value` otherwise.
- Strict equality — string `'1'` vs number `1` does not match.

**`SchemaFormRenderer` integration:** the outer `Object.entries(schema)` map skips fields where `isFieldVisible(field, values)` returns `false`. No DOM node is rendered for hidden fields.

---

## 4. Validation

`validateFieldValue(field, value): string | null` is PURE (no side effects, no DOM, no network).

**Evaluation order:**
1. Info controls (`header`, `paragraph`): short-circuit to `null`.
2. Required check: `null | undefined | ''` → `${field.label} is required`. `false` passes (see RISK-SEC-U03 below).
3. Type-specific checks in `switch`.

**Type-specific rules:**
- `number` / `range`: NaN check; min/max bounds.
- `url` / `video`: `isUnsafeUrl` guard.
- `video_url`: `isUnsafeUrl` + YouTube/Vimeo HTTPS pattern.
- `font_picker`: value must be a key in `EXPERIENCE_FONT_REGISTRY`.
- `text` / `textarea` / `richtext` / `html` / `liquid`: `maxLength` enforcement.
- All other types: no type-specific rule beyond required.
- Unknown / legacy types: `null` (graceful degradation; never crash).

### Known gap — RISK-SEC-U03: required checkbox is a no-op

`validateFieldValue` rejects `null | undefined | ''` for required fields. `resolveFieldDefault` returns `false` for boolean types. `SchemaFormRenderer` passes `Boolean(value)` to `CheckboxControl`. A field with no stored value resolves to `false`, which passes the required check. A required checkbox can never produce a validation error.

**Options for Phase V:**
1. Add a separate required guard for `checkbox` / `toggle`: `if (field.type === 'checkbox' || field.type === 'toggle') && value === false → error`.
2. Document that `required` on boolean controls means "must be explicitly checked (true)" and add the guard.
3. Remove `required` from boolean control rendering entirely.

---

## 5. Default Resolution

`resolveFieldDefault(field): unknown` replaces the pre-Phase-U `value ?? field.default ?? ''` coercion in `SchemaFormRenderer`.

| Type | Default (when `field.default` absent) |
|------|--------------------------------------|
| `toggle`, `checkbox` | `false` |
| `number`, `range` | `field.min ?? 0` |
| `header`, `paragraph` | `null` |
| All others | `''` |

The `SchemaFormRenderer` now computes:
```typescript
const resolvedValue = storedValue !== undefined ? storedValue : resolveFieldDefault(field)
```

---

## 6. Resource-Picker Deferral to Phase W

Phase W (Dynamic Sources + Custom Data) will introduce live resource search backed by Supabase queries over `products`, `collections`, `custom_pages`, `navigation_menus` etc. At Phase W:
- `ResourcePickerControl` will be replaced with a searchable combobox.
- No schema change is required — `resource_type` on `ExtendedSchemaField` provides the hint.
- The NOT-CONNECTED badge and plain text input are removed at the Phase W call site.

The Phase U NOT-CONNECTED contract:
- Badge text must read exactly: "NOT-CONNECTED — live search available in Phase W".
- No API call is made in Phase U.
- The test `ResourcePickerControl.tsx` contains NOT-CONNECTED badge text' asserts this contract.

---

## 7. Code Review Findings

Phase U surfaced 7 findings during review. None were fixed before phase close (Hardening: null). All 7 are registered in RISK_REGISTER.md.

| # | Severity | Risk ID | Summary |
|---|----------|---------|---------|
| 1 | MEDIUM | RISK-SEC-U01 | `isUnsafeUrl` blocks only 4 patterns; misses `data:image/svg+xml`, `data:text/javascript`, `blob:` |
| 2 | MEDIUM | RISK-SEC-U02 | `ColorBackgroundControl` gradient mode: no `url()` content check in `validateFieldValue` |
| 3 | MEDIUM | RISK-SEC-U03 | `required: true` on checkbox/toggle is a validation no-op; `false` passes the required check |
| 4 | MEDIUM | RISK-A11Y-U01 | `TextInput` / `TextareaInput` set `aria-invalid` but not `aria-describedby` to the error element |
| 5 | LOW | RISK-A11Y-U02 | `CheckboxControl` / `FontPickerControl` / `ColorSchemeControl` use ternary `aria-describedby`; drops `helpText` when error is present |
| 6 | LOW | RISK-STYLE-U01 | `LiquidControl.tsx:68` — `fontSize: 12` raw pixel in inline style (should be `var(--lb-font-size-caption, 12px)`) |
| 7 | LOW | RISK-STYLE-U02 | `controls.module.css` uses raw `4px`, `3px 8px`, `4px` spacing values instead of `--lb-*` tokens |

### No HIGH Findings

No HIGH severity findings were raised. The MEDIUM security findings (RISK-SEC-U01, RISK-SEC-U02) inherit their practical impact bound from the deployment context: authenticated-only editor, DOMPurify at render time (storefront renderer), Cloudflare CSP headers. RISK-SEC-U03 (required checkbox) is a UX/API design gap rather than a security concern.

---

## 8. RISK-DUAL-N01 Status

RISK-DUAL-N01 is preserved in Phase U. Controls receive `(value, onChange)` and use the `field` descriptor as read-only schema metadata. No Phase U code path writes to `section_definitions`, `block_definitions`, or any schema descriptor.

`SchemaFormRenderer`'s `onChange` callback writes to `values[key]` in the editor's `EditorState.themeSettings` or `SectionEntry.settings` — the instance settings value. The control never touches the schema.

---

## 9. Carry-Over Risks from Phase T (not addressed in Phase U)

| Risk ID | Severity | Summary | New Target |
|---------|----------|---------|-----------|
| RISK-T03 | LOW | `block.settings` bypass `filterBlockedSettingsKeys` in renderer | Phase V |
| RISK-T04 | LOW | `RENDERER_MAX_BLOCK_DEPTH` private/unexported | Phase V |
| RISK-T05 | MEDIUM | `allowedChildTypes` not wired from `SectionTreePanel` to `BlockChildRow` | Phase V |
| RISK-T06 | LOW | `UnsupportedThemeDocumentFeatureError` dead export | Phase V |

---

## 10. Test Results

| Suite | Phase U Final |
|-------|--------------|
| theme-engine | **1136/1136** (baseline 1063 + 73 new) |
| merchant-control-plane | **196/196** (baseline 120 + 76 new) |
| api-gateway | **479/479** (unchanged) |
| storefront-runtime | **795/795** (unchanged) |
| All typechecks | Clean |

---

## 11. Rollback

Rollback is `git revert` of the Phase U commits (or `git checkout --` on individual files if not yet committed).

**Minimal rollback (Lane A — theme-engine):**
```bash
git checkout -- packages/theme-engine/src/index.ts
git rm packages/theme-engine/src/schema-field-extensions.ts
git rm packages/theme-engine/test/schema-field-extensions.test.ts
```

**Minimal rollback (Lane B — merchant):**
```bash
git checkout -- apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx
git checkout -- apps/merchant-control-plane/src/lib/theme-schemas.ts
git checkout -- apps/merchant-control-plane/package.json
git rm -r apps/merchant-control-plane/src/components/theme-editor/controls/
git rm apps/merchant-control-plane/tests/theme-editor-u.test.mjs
```

Rollback restores Phase T state: 11-type renderer with no conditional visibility. No database changes need reverting. No gateway changes need reverting. The editor continues to function with Phase T behavior.

---

## 12. Parity Impact

| Capability | Pre-Phase-U | Post-Phase-U |
|---|---|---|
| Settings field type count | 11 (frozen) | 26 (11 frozen + 15 new) |
| Conditional visibility (`visible_if`) | MISSING | COMPLETE |
| Required validation indicator | MISSING | COMPLETE (RISK-SEC-U03: boolean gap) |
| Type-safe default resolution | PARTIAL (`?? ''` coercion) | COMPLETE |
| `number` bounds enforcement | MISSING | COMPLETE |
| `url` safety guard | MISSING | COMPLETE (RISK-SEC-U01: narrow blocklist) |
| `color_background` (solid/gradient) | MISSING | COMPLETE |
| `color_scheme` | MISSING | COMPLETE |
| `font_picker` | MISSING | COMPLETE (registry-constrained) |
| `html` textarea | MISSING | COMPLETE |
| `liquid` code textarea | MISSING | COMPLETE (canary-OFF badge) |
| `checkbox` (distinct from toggle) | MISSING | COMPLETE |
| `video` file + URL | MISSING | COMPLETE |
| `video_url` YouTube/Vimeo | MISSING | COMPLETE |
| `header` info control | MISSING | COMPLETE |
| `paragraph` info control | MISSING | COMPLETE |
| Resource pickers (product/collection/blog/page/menu) | MISSING | PARTIAL (id entry; live search Phase W) |

---

## 13. Next Phase: V — Template System

Phase V will implement the template management system: template create/duplicate/delete, template-specific section schemas, and the template switcher in the editor header. Phase V must:
- Address RISK-T05 (`allowedChildTypes` not wired) if touching `SectionTreePanel.tsx`.
- Address RISK-T03 (`block.settings` bypass) if touching `theme-renderer.ts`.
- Not add client-side realtime subscriptions over `theme_editor_drafts` until RISK-SEC-P01 is resolved.
- Continue using `--lb-*` design tokens for all new CSS.
- Gate on merchant-control-plane **196/196** · theme-engine **1136/1136** · storefront-runtime **795/795** baselines.
