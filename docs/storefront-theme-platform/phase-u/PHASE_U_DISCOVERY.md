# Phase U Discovery — Settings Control Renderer

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** U — Settings Control Renderer
**Date:** 2026-07-11
**Scope:** Right-panel settings form: control type inventory, parity gaps, validation gaps, a11y gaps, field-type model constraints.

---

## 1. Existing Control Inventory (pre-Phase-U)

`SchemaFormRenderer.tsx` rendered 11 frozen field types via inline components. Each type maps to a dedicated sub-component within the renderer file.

| Type | Control | Notes |
|------|---------|-------|
| `text` | `TextInput` | `Input type=text`, `maxLength` |
| `textarea` | `TextareaInput` | `<textarea rows=3>`, `maxLength` |
| `richtext` | `TextareaInput` | Same component as `textarea`; no rich editing; no ARIA distinction |
| `radio` | `RadioInput` | Button-group pills; `aria-checked` absent on individual options |
| `color` | `ColorInput` | Color-picker + hex text; no gradient support |
| `image` | `ImageInput` | URL text + file upload to `/api/stores/[store]/upload`; `storeName`-gated |
| `select` | `SelectInput` | Native `<select>` |
| `toggle` | `ToggleInput` | Custom slide switch; `role=switch aria-checked` |
| `range` | `RangeInput` | `input type=range`; reads min/max/step/unit from schema |
| `url` | `UrlInput` | `Input type=url`; NO `isUnsafeThemeUrl` check |
| `number` | `NumberInput` | `Input type=number`; min/max/step from `SchemaField` **ignored** in rendered control |
| unknown | `TextInput` | Fallback for unrecognised types |

---

## 2. Field Type Model

**Source of truth:** `packages/theme-engine/src/theme-registry.ts:12` (FROZEN).

```typescript
// Frozen union (must never be modified):
type SchemaFieldType =
    'text' | 'textarea' | 'richtext' | 'color' | 'image' | 'select'
  | 'toggle' | 'range' | 'number' | 'url' | 'radio'
```

`SchemaField` properties: `label`, `default`, `maxLength`, `options`, `min`, `max`, `step`, `unit`, `info`, `description`. No `required`, no `visible_if`, no `resource_type`.

**Safe extension point:** a new non-frozen file `packages/theme-engine/src/schema-field-extensions.ts` exporting `ExtendedSchemaField` as a widened superset union. The frozen `theme-registry.ts` is never modified. New types live in the extension file only.

---

## 3. Parity Gaps Discovered

### 3.1 Missing control types (15)

| Type | Shopify parity | Disposition |
|------|---------------|-------------|
| `color_background` | Solid colour OR CSS gradient string | Phase U: implement |
| `color_scheme` | Named experience colour scheme selector | Phase U: implement |
| `font_picker` | Select from `EXPERIENCE_FONT_REGISTRY` (6 families only; no arbitrary injection) | Phase U: implement |
| `html` | Sanitised HTML textarea (no DOM injection in editor) | Phase U: implement |
| `liquid` | Liquid code textarea (canary-OFF badge; renders as static HTML) | Phase U: implement |
| `checkbox` | Native `input[type=checkbox]` distinct from `toggle` slide switch | Phase U: implement |
| `video` | Video file URL entry + upload (`video/*`) | Phase U: implement |
| `video_url` | YouTube / Vimeo URL with protocol + domain validation | Phase U: implement |
| `header` | Sidebar info-only section heading (display-only; no value) | Phase U: implement |
| `paragraph` | Sidebar info-only descriptive text (display-only; no value) | Phase U: implement |
| `product` | Resource picker — Phase U: id text entry; live search Phase W (NOT-CONNECTED badge) | Phase U: partial |
| `collection` | Same as product pattern | Phase U: partial |
| `blog` | Same as product pattern | Phase U: partial |
| `page` | Same as product pattern | Phase U: partial |
| `menu` | Navigation menu picker | Phase U: partial |

**`font_picker` risk:** `editor/page.tsx` normalises `'font'` → `'select'` as a workaround. Phase U must not touch `page.tsx` (foreign WIP). The normalization remains; the new `font_picker` type activates when the schema emits it natively.

**`checkbox` risk:** `editor/page.tsx` normalises `'checkbox'` → `'toggle'` at line 256 (foreign WIP). Phase U must not touch `page.tsx`. The normalization remains; the new `checkbox` type activates only when the schema natively emits it.

### 3.2 Validation gaps (pre-Phase-U)

| Gap | Location | Impact |
|-----|---------|--------|
| `number` min/max/step ignored | `SchemaFormRenderer.tsx:NumberInput` | No bounds enforcement on numeric inputs |
| `url` no unsafe-URL check | `SchemaFormRenderer.tsx:UrlInput` | `javascript:` / `vbscript:` URLs accepted |
| No `required` property on `SchemaField` | `theme-registry.ts` (FROZEN) | No required indicator, no required-check validation |
| No `visible_if` property on `SchemaField` | `theme-registry.ts` (FROZEN) | All fields rendered unconditionally |
| Default fallback `?? ''` type-unsafe | `SchemaFormRenderer.tsx:22` | Empty-string coercion for boolean/number fields |

### 3.3 Accessibility gaps (pre-Phase-U)

| Gap | Control | Finding |
|-----|---------|---------|
| `richtext` maps to `TextareaInput` | No ARIA distinction from `textarea`; `htmlFor` not always linked | MEDIUM |
| `RadioInput` | `role=group` missing; no `aria-checked` on individual options | MEDIUM |
| `TextInput` / `TextareaInput` | No `aria-required`, no `aria-invalid` linkage to error message via `aria-describedby` | MEDIUM |
| All controls | No `aria-required`, no `aria-invalid`/`aria-describedby` for validation errors | MEDIUM |

---

## 4. Foreign WIP in Scope

Files modified by prior user work that Phase U must treat as FOREIGN WIP (never stage):

| File | Reason |
|------|--------|
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` | Contains field-type normalisation (`checkbox→toggle`, `font→select`); 1810+ lines of prior user modifications |
| `apps/merchant-control-plane/src/app/globals.css` | Carries R/S/T phase CSS additions; Phase U must use CSS modules only |
| `apps/merchant-control-plane/src/components/ExperiencePicker.tsx` | Untracked WIP |
| `packages/theme-engine/src/theme-registry.ts` | FROZEN — `SchemaField` union must never be modified |
| `packages/theme-engine/src/theme-renderer.ts` | Sanitiser locked; `RENDERER_MAX_BLOCK_DEPTH` private constant; must not be touched in Phase U |
| All `apps/merchant-control-plane/src/app/[store]/*` page files | All modified in working tree |
| All `apps/merchant-control-plane/src/components/settings/*` | Modified in working tree |

---

## 5. Design Decisions

### 5.1 Two-lane architecture

Phase U follows the established two-lane pattern:
- **Lane A (`theme-engine`):** `schema-field-extensions.ts` — extension types, helpers, validation, visibility, default resolution.
- **Lane B (merchant):** `controls/` directory — one file per control type; `SchemaFormRenderer.tsx` — upgraded to `ExtendedSchemaField`; `theme-schemas.ts` — re-export barrel.

### 5.2 RISK-DUAL-N01 preservation

Controls receive `(value, onChange)` only. The schema/definition object (`ExtendedSchemaField`) is never mutated by a control. `onChange` writes to the instance settings value, never to the schema.

### 5.3 Resource pickers: NOT-CONNECTED at Phase U

Live resource search requires dynamic sources (Phase W). Phase U resource pickers (product / collection / blog / page / menu) use a plain text ID/handle input with a NOT-CONNECTED badge. No API call is made; no fake data is shown. Phase W replaces this component at the call site.

### 5.4 Sanitize law (html / liquid controls)

`HtmlControl` and `LiquidControl` render the raw value in a `<textarea>`. No `dangerouslySetInnerHTML` path is introduced. Liquid → HTML compilation and DOMPurify sanitisation remain the renderer's responsibility (`theme-renderer.ts`).

### 5.5 Font injection guard

`FontPickerControl` constrains its select options to `EXPERIENCE_FONT_REGISTRY` (6 known families). `validateFieldValue` for `font_picker` rejects values not in the registry. No arbitrary web-font URLs are accepted.

---

## 6. Entering Phase U Gate

- merchant-control-plane: **120/120**
- theme-engine: **1063/1063**
- api-gateway: **479/479**
- storefront-runtime: **795/795**
- All typechecks: clean
- `validate-governance.mjs`: EXIT=1 (pre-existing tenant-registry drift; anti-fabrication PASS — unchanged)
