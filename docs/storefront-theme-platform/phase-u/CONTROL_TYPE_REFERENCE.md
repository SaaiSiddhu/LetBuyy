# Control Type Reference — Theme Settings Fields

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase introduced:** U (2026-07-11)
**Total types:** 26 (11 frozen, 15 Phase U)
**Source of truth:**
- Frozen type model: `packages/theme-engine/src/theme-registry.ts` (FROZEN — do not modify)
- Extension types: `packages/theme-engine/src/schema-field-extensions.ts` (safe extension point)
- Renderer: `apps/merchant-control-plane/src/components/theme-editor/SchemaFormRenderer.tsx`
- Controls: `apps/merchant-control-plane/src/components/theme-editor/controls/`

---

## Schema Field Shape

All field types share the base `ExtendedSchemaField` interface:

```typescript
interface ExtendedSchemaField {
    // From frozen SchemaField (theme-registry.ts)
    type: AllFieldType          // required; one of the 26 type literals below
    label: string               // required; display label in the editor sidebar
    default?: unknown           // optional; type-specific default value
    maxLength?: number          // optional; character cap (text/textarea/richtext/html/liquid)
    options?: string[]          // optional; choice list (select, radio, color_scheme)
    min?: number                // optional; lower bound (number, range)
    max?: number                // optional; upper bound (number, range)
    step?: number               // optional; increment (number, range)
    unit?: string               // optional; unit suffix displayed next to range value (e.g. 'px')
    info?: string               // optional; help text shown below the control
    description?: string        // optional; alternative help text (falls back after info)

    // Phase U extensions (schema-field-extensions.ts)
    required?: boolean          // optional; shows required indicator; validates non-empty
    visible_if?: {              // optional; hides field when condition is not met
        field: string           //   key of a sibling field in the same settings object
        value: unknown          //   exact value that makes this field visible (strict equality)
    }
    resource_type?: string      // optional; hint for resource picker controls (product/collection/etc.)
}
```

**Freezing rule:** `SchemaField` in `theme-registry.ts` must not be modified. New properties or types go in `schema-field-extensions.ts` only.

---

## Frozen Types (Phase M baseline)

### `text`

**Component:** `TextInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `default?:string`, `maxLength?`
**HTML:** `<input type="text" maxLength={field.maxLength}>`
**Validation:** required check (`required?`); maxLength enforced by browser.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`. Known gap: `aria-describedby` not linked to error element (RISK-A11Y-U01).
**Sanitize:** plain text value; no injection concern.
**Default:** `''`

---

### `textarea`

**Component:** `TextareaInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `default?:string`, `maxLength?`
**HTML:** `<textarea rows=3 maxLength={field.maxLength}>`
**Validation:** required check; maxLength enforced by browser.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`. Known gap: `aria-describedby` not linked (RISK-A11Y-U01).
**Sanitize:** plain text value.
**Default:** `''`
**Note:** `richtext` maps to the same `TextareaInput` with no ARIA distinction. See `richtext` entry.

---

### `richtext`

**Component:** `TextareaInput` (same as `textarea`; no rich-text editor widget)
**Schema:** `label`, `default?:string`, `maxLength?`
**HTML:** `<textarea rows=3 maxLength={field.maxLength}>`
**Validation:** same as `textarea`.
**A11y:** same as `textarea` (no ARIA distinction from `textarea`). Known gap.
**Sanitize:** value stored as plain text; HTML sanitisation is the renderer's responsibility (DOMPurify).
**Default:** `''`
**Known gap:** `richtext` and `textarea` render identically in the editor. A future phase should introduce a rich-text editor widget for `richtext` (e.g., a basic bold/italic toolbar) to provide the ARIA/UX distinction.

---

### `radio`

**Component:** `RadioInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `options:string[]`, `default?:string`
**HTML:** `<div role="group" aria-label={label}>` containing one `<Button role="radio" aria-checked>` per option.
**Validation:** required check.
**A11y:** `role="group"` on container with `aria-label`; each option button has `role="radio"` and `aria-checked`. Visual selection via `.te-field-radio--selected`.
**Sanitize:** option values are rendered as text content; no injection.
**Default:** `''`

---

### `color`

**Component:** `ColorInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `default?:string`
**HTML:** `<input type="color">` (colour picker) + `<input type="text">` (hex string). Both bound to the same value.
**Validation:** no type-specific validation. `maxLength=9` on the text input (handles `#rrggbbaa`).
**A11y:** `aria-label` on the colour picker input; `<label htmlFor>` on the text input.
**Sanitize:** hex colour string. No injection concern.
**Default:** `letbuyyPrimitiveTokens.color.black` (from `@letbuyy/ui`)

---

### `image`

**Component:** `ImageInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `default?:string`
**HTML:** URL text input + file upload button (`<input type="file" accept="image/*">`). Upload POSTs to `/api/stores/[store]/upload`.
**Validation:** no required check in `validateFieldValue` (upload sets the value directly). Upload error shown inline.
**A11y:** `<span class="te-field-label">` (not `<label htmlFor>`); upload button has icon + text.
**Sanitize:** uploaded URL comes from the server response; displayed in `<img src>` with empty `alt`.
**Default:** `''`
**storeName dependency:** when `storeName` prop is absent the upload button shows a warning toast. URL text entry is always available.

---

### `select`

**Component:** `SelectInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `options:string[]`, `default?:string`, `required?`
**HTML:** Native `<select>` with one `<option>` per entry. Option display: first letter capitalised + underscores → spaces.
**Validation:** `aria-required`; no required-empty check in `validateFieldValue` (native required behaviour).
**A11y:** `<label htmlFor>` wrapping the select. Required indicator (`RequiredMark`).
**Sanitize:** option values rendered as `<option>` text; no injection.
**Default:** `''`

---

### `toggle`

**Component:** `ToggleInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `default?:boolean`
**HTML:** Custom slide switch `<Button role="switch" aria-checked>` containing a `.te-toggle-thumb` span.
**Validation:** no validation in `validateFieldValue`. `required` is not enforced for toggle (see RISK-SEC-U03 note in `checkbox` entry).
**A11y:** `role="switch"`, `aria-checked`. Wrapped in a `<label>` element.
**Sanitize:** boolean value; no injection.
**Default:** `false`
**Distinction from `checkbox`:** `toggle` is a slide switch (visual design token); `checkbox` is a native `input[type=checkbox]`. Use `toggle` for on/off settings, `checkbox` for multi-value choice lists.

---

### `range`

**Component:** `RangeInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `min`, `max`, `step`, `unit?`, `default?:number`
**HTML:** `<input type="range" min max step>` + live value display `{value}{unit}`.
**Validation:** Phase U: `min`/`max`/`step` passed from schema (pre-Phase-U: ignored). `validateFieldValue` enforces bounds.
**A11y:** `<label htmlFor>`. Value display accessible as adjacent text.
**Sanitize:** numeric value; no injection.
**Default:** `field.min ?? 0`

---

### `url`

**Component:** `UrlInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `default?:string`, `required?`
**HTML:** `<input type="url">` with `placeholder="https://…"`.
**Validation:** Phase U fix: `isUnsafeUrl` check at change time (blocks `javascript:`, `vbscript:`, `data:text/html`, `data:application/xhtml`). Change handler rejects unsafe values before calling `onChange`. Required check.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`.
**Sanitize:** `isUnsafeUrl` guard at editor layer. Storefront renderer applies further sanitisation.
**Default:** `''`
**Known gap (RISK-SEC-U01):** `isUnsafeUrl` does not block `data:image/svg+xml`, `data:text/javascript`, or `blob:`.

---

### `number`

**Component:** `NumberInput` (inline in `SchemaFormRenderer.tsx`)
**Schema:** `label`, `min?`, `max?`, `step?`, `default?:number`, `required?`
**HTML:** `<input type="number" min max step>`.
**Validation:** Phase U fix: `min`/`max`/`step` now passed from schema to both the HTML input and the inline validator. Error shown when `value < min` or `value > max`.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`; `aria-describedby` linked to error element.
**Sanitize:** numeric value; no injection.
**Default:** `field.min ?? 0`

---

## Phase U Extensions

### `color_background`

**Component:** `ColorBackgroundControl` (`controls/ColorBackgroundControl.tsx`)
**Schema:** `label`, `default?:string`, `required?`
**HTML:**
- Mode toggle: `<input type="checkbox" id="${id}-gradient-mode">` + `<label>Gradient</label>`.
- Gradient mode: `<Input type="text">` for CSS gradient string.
- Solid mode: `<input type="color">` picker + `<Input type="text">` hex entry.
**Validation:** required check only. No CSS content check in gradient mode (RISK-SEC-U02: `url()` expressions accepted).
**A11y:** `<label htmlFor>` on the main input; `aria-invalid`; `aria-describedby` on gradient input (ternary; no `helpText` linkage when error present).
**Sanitize:** value stored as CSS string. No DOM injection in editor. Storefront renderer applies `background` CSS property directly — `url()` inside gradient strings passes through editor without a check.
**Default:** `''` (empty string; renders as no background override)
**Note:** `looksLikeGradient()` detects `linear-gradient`, `radial-gradient`, `conic-gradient` on mount to auto-select gradient mode for existing values.

---

### `color_scheme`

**Component:** `ColorSchemeControl` (`controls/ColorSchemeControl.tsx`)
**Schema:** `label`, `options:string[]` (named scheme keys), `default?:string`, `required?`
**HTML:** `<select>` with one `<option>` per scheme name from `field.options`.
**Validation:** required check only.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`; ternary `aria-describedby`. Known gap (RISK-A11Y-U02): helpText dropped when error present.
**Sanitize:** scheme name is a plain string used as a CSS class or token lookup; no injection.
**Default:** `''`

---

### `font_picker`

**Component:** `FontPickerControl` (`controls/FontPickerControl.tsx`)
**Schema:** `label`, `default?:string`, `required?`
**HTML:** `<select>` with one `<option>` per entry in `EXPERIENCE_FONT_REGISTRY`. Font preview row below: sample text rendered in the chosen family.
**Validation:** `validateFieldValue` rejects unknown font names. `onChange` guard: unknown values are not emitted. Unknown stored value: `displayValue` falls back to `FONT_FAMILIES[0]`.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`; ternary `aria-describedby`. Known gap (RISK-A11Y-U02).
**Sanitize:** font family name from closed registry only. No arbitrary URL injection. Preview uses inline `fontFamily` CSS with quoted name + system fallback.
**Default:** `''`
**Injection guard (RISK-5):** `handleChange` checks `FONT_FAMILIES.includes(newFamily)` before calling `onChange`. Values not in the registry are silently dropped.

---

### `html`

**Component:** `HtmlControl` (`controls/HtmlControl.tsx`)
**Schema:** `label`, `default?:string`, `maxLength?`, `required?`
**HTML:** `<textarea>` + sanitise disclaimer note below.
**Validation:** required check; maxLength enforcement.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`; array-join `aria-describedby`.
**Sanitize law:** value stored as plain text in `<textarea>`. No `dangerouslySetInnerHTML` in the editor. HTML → DOM sanitisation (DOMPurify) is the renderer's responsibility. The disclaimer note reminds the merchant that HTML is sanitised at render time.
**Default:** `''`
**Advanced use:** intended for section-level custom HTML injection. Merchants must understand that unsafe tags/attributes are stripped by DOMPurify before rendering.

---

### `liquid`

**Component:** `LiquidControl` (`controls/LiquidControl.tsx`)
**Schema:** `label`, `default?:string`, `maxLength?`, `required?`
**HTML:** `<textarea rows=6>` with monospace font hint (`Fira Code`, `Consolas`). NOT-CONNECTED badge below.
**Validation:** required check; maxLength enforcement.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`; array-join `aria-describedby` (links error, canary-note, and helpText ids).
**Sanitize law:** value stored as plain text in `<textarea>`. No `dangerouslySetInnerHTML`. Liquid → HTML compilation and DOMPurify sanitisation run in `theme-renderer.ts` only.
**NOT-CONNECTED badge:** "NOT-CONNECTED — Liquid rendering disabled (canary flag off)". `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` in production.
**Default:** `''`
**Known gap (RISK-STYLE-U01):** inline style uses `fontSize: 12` (raw number, resolves to 12px). Should use `var(--lb-font-size-caption, 12px)`.

---

### `checkbox`

**Component:** `CheckboxControl` (`controls/CheckboxControl.tsx`)
**Schema:** `label`, `default?:boolean`, `required?`
**HTML:** `<input type="checkbox" id>` inside a wrapper; `<label htmlFor>` for the label text.
**Validation:** required check (known gap: `false` passes — RISK-SEC-U03). Error shown via `role="alert"` paragraph.
**A11y:** `<label htmlFor>` ensures the entire label area is clickable/screenreader-accessible. `aria-required`; `aria-invalid`; ternary `aria-describedby` (RISK-A11Y-U02).
**Sanitize:** boolean value; no injection.
**Default:** `false`
**Distinction from `toggle`:** `checkbox` is a native browser checkbox with system styling (accented via `accent-color: var(--primary)`). Use `toggle` for binary on/off settings with slide-switch visual; use `checkbox` for explicit consent or multi-value opt-ins.
**Required gap (RISK-SEC-U03):** `required: true` on a checkbox means the merchant must explicitly interact with the field, but `false` (unchecked) passes the required check. See Phase U report §4.

---

### `video`

**Component:** `VideoControl` (`controls/VideoControl.tsx`)
**Schema:** `label`, `default?:string`, `required?`
**HTML:** URL text input + `<input type="file" accept="video/*">` upload button. Upload POSTs to `/api/stores/[store]/upload`.
**Validation:** `isUnsafeUrl` check on URL text entry; required check.
**A11y:** `<label htmlFor>` on URL input; `aria-required`; `aria-invalid`; `aria-describedby`.
**Sanitize:** URL guarded by `isUnsafeUrl`. Video served from upload endpoint; not injected into DOM in editor.
**Default:** `''`
**storeName dependency:** upload unavailable without `storeName`; shows warning. URL text entry always available.
**Known gap (RISK-SEC-U01):** `isUnsafeUrl` does not block `blob:` or `data:text/javascript`.

---

### `video_url`

**Component:** `VideoUrlControl` (`controls/VideoUrlControl.tsx`)
**Schema:** `label`, `default?:string`, `required?`
**HTML:** `<Input type="url">` with `placeholder="https://www.youtube.com/…"`.
**Validation:** `isUnsafeUrl` check; then `VIDEO_URL_PATTERN` (`/^https?:\/\/(www\.)?(youtube\.com\/|youtu\.be\/|vimeo\.com\/)/`). HTTP and non-YouTube/Vimeo URLs fail the pattern. Required check.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`; array-join `aria-describedby`.
**Sanitize:** HTTPS YouTube/Vimeo URL only. Validated at editor layer; iframe embed is the renderer's responsibility.
**Default:** `''`
**Known gap (RISK-SEC-U01):** `isUnsafeUrl` does not check `blob:`.

---

### `header`

**Component:** `FieldHeader` (`controls/InfoControls.tsx`)
**Schema:** `label` (used as heading text)
**HTML:** `<div role="heading" aria-level={3}>` containing `field.label`.
**Validation:** none. `validateFieldValue` returns `null` unconditionally.
**A11y:** `role="heading"` with `aria-level=3` for screen reader hierarchy.
**Sanitize:** `field.label` rendered as text content; no injection.
**Value:** none. No `onChange` prop. Does not contribute to the settings record.
**Default:** `resolveFieldDefault` returns `null`.
**Use:** groups related settings with a visual divider heading in the sidebar.

---

### `paragraph`

**Component:** `FieldParagraph` (`controls/InfoControls.tsx`)
**Schema:** `label`, `info?`, `description?`
**HTML:** `<p class={styles.infoParagraph}>` with `MaterialIcon name="info"` and text content from `field.info || field.description || field.label`.
**Validation:** none. `validateFieldValue` returns `null` unconditionally.
**A11y:** `<p>` element is implicit landmark; info icon is `aria-hidden`.
**Sanitize:** text content; no injection.
**Value:** none. No `onChange` prop.
**Default:** `resolveFieldDefault` returns `null`.
**Use:** adds explanatory text between settings controls in the sidebar.

---

### `product`

**Component:** `ResourcePickerControl` (`controls/ResourcePickerControl.tsx`)
**Schema:** `label`, `default?:string`, `required?`, `resource_type?`
**HTML:** `<Input type="text">` for product ID/handle + NOT-CONNECTED badge.
**Validation:** required check only.
**A11y:** `<label htmlFor>`; `aria-required`; `aria-invalid`; array-join `aria-describedby` (links error, NOT-CONNECTED badge, helpText).
**Sanitize:** ID/handle is plain text; no injection.
**Default:** `''`
**NOT-CONNECTED contract:** badge text "NOT-CONNECTED — live search available in Phase W". No API call. No fake data.
**Phase W:** live searchable picker replaces this component at the call site. Schema unchanged.

---

### `collection`

Same as `product`. `RESOURCE_LABELS['collection'] = 'Collection'`.

---

### `blog`

Same as `product`. `RESOURCE_LABELS['blog'] = 'Blog'`.

---

### `page`

Same as `product`. `RESOURCE_LABELS['page'] = 'Page'`.

---

### `menu`

Same as `product`. `RESOURCE_LABELS['menu'] = 'Navigation menu'`.

---

## Conditional Visibility

Any field with a `visible_if` property is hidden when the condition is not met.

```json
{
    "type": "color_background",
    "label": "Section background",
    "visible_if": { "field": "show_background", "value": true }
}
```

`isFieldVisible(field, values)` returns `true` only when `values['show_background'] === true`. Strict equality — no type coercion.

`SchemaFormRenderer` skips (`return null`) fields where `isFieldVisible` returns `false`. The hidden field's value is preserved in the settings record; only the UI is hidden.

---

## Required Validation

Any field with `required: true` shows a `*` required indicator and produces an error when the value is `null`, `undefined`, or `''`.

**Exception:** boolean controls (`checkbox`, `toggle`) with `required: true` do not produce a validation error when the value is `false`. See RISK-SEC-U03 in RISK_REGISTER.md. A future phase will either enforce `required → must be true` for boolean controls or document `required` as inapplicable to them.

---

## Default Resolution

`resolveFieldDefault(field)` is called when no stored value exists for a key.

| Type | Default (when `field.default` absent) |
|------|--------------------------------------|
| `toggle`, `checkbox` | `false` |
| `number`, `range` | `field.min ?? 0` |
| `header`, `paragraph` | `null` |
| All others | `''` |

If `field.default` is defined it is returned as-is regardless of type.

---

## Unknown / Legacy Types

Any type string not in the 26-entry union falls through to the `default:` case in `SchemaFormRenderer` and renders as `TextInput`. `validateFieldValue` returns `null`. `resolveFieldDefault` returns `''`. This ensures forward compatibility with future types and backward compatibility with legacy schema data.

---

## Adding a New Field Type

1. Add the new type literal to `ExtendedFieldType` in `packages/theme-engine/src/schema-field-extensions.ts`. **Do not modify `theme-registry.ts`.**
2. Add any new properties to `ExtendedSchemaField` as optional.
3. Add a `case` in `validateFieldValue` and `resolveFieldDefault` if the type needs type-specific validation or a non-empty default.
4. Create a control component in `apps/merchant-control-plane/src/components/theme-editor/controls/`.
5. Add a `case` in `SchemaFormRenderer`'s switch statement.
6. Export the component from `controls/`.
7. Add tests to `schema-field-extensions.test.ts` and `theme-editor-u.test.mjs`.
8. Update this reference document.

**Never:** add new types to `theme-registry.ts`, modify `theme-renderer.ts` sanitiser, use `dangerouslySetInnerHTML` in a control, import from `page.tsx`, modify `globals.css`.
