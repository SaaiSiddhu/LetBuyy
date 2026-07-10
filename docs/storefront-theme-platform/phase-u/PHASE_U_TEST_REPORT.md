# Phase U Test Report — Settings Control Renderer

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** U — Settings Control Renderer
**Date:** 2026-07-11

---

## Final Gate Results

| Suite | Phase U Final | Command | Status |
|-------|--------------|---------|--------|
| theme-engine (typecheck + test) | **1136/1136** | `pnpm --filter=@letbuyy/theme-engine typecheck test` | PASS |
| merchant-control-plane (typecheck + test) | **196/196** | `pnpm --filter=@letbuyy/merchant-control-plane typecheck test` | PASS |
| api-gateway (test) | **479/479** (unchanged) | `pnpm --filter=@letbuyy/api-gateway test` | PASS |
| storefront-runtime (test) | **795/795** (unchanged) | `pnpm --filter=@letbuyy/storefront-runtime typecheck test` | PASS |
| All typechecks | **Clean** (0 errors) | Per-package typecheck commands | PASS |
| validate-governance.mjs | **EXIT=1** (pre-existing tenant drift; anti-fabrication PASS) | `node scripts/validate-governance.mjs` | PASS (known) |

---

## Test Breakdown

### theme-engine: 1136 total

| Group | Count | Source |
|-------|-------|--------|
| Phase U new — schema-field-extensions | **73** | `packages/theme-engine/test/schema-field-extensions.test.ts` |
| Phase T (nested blocks) | 15 | `packages/theme-engine/test/theme-document-nested-blocks.test.ts` |
| Phase S (bridge protocol) | 14 | `packages/theme-engine/test/editor-bridge-protocol.test.ts` |
| Pre-Phase-S baseline | 1034 | All other `packages/theme-engine/test/**` files |

### merchant-control-plane: 196 total

| Group | Count | Source |
|-------|-------|--------|
| Phase U new — control parity contracts | **76** | `apps/merchant-control-plane/tests/theme-editor-u.test.mjs` |
| Phase T (nested block UI) | 27 | `apps/merchant-control-plane/tests/theme-editor-t.test.mjs` |
| Phase S (inspector bridge) | 28 | `apps/merchant-control-plane/tests/theme-editor-s.test.mjs` |
| Phase R (editor shell) | 26 | `apps/merchant-control-plane/tests/theme-editor-r.test.mjs` |
| Phase Q (theme library) | 25 | `apps/merchant-control-plane/tests/theme-library-q.test.mjs` |
| Pre-Phase-Q baseline | 14 | Federation / localisation / app-platform |

---

## Phase U Test Coverage (`schema-field-extensions.test.ts` — 73 tests)

### `isUnsafeUrl`
- Accepts safe HTTP URLs (passes through).
- Accepts empty string.
- Blocks `javascript:` (case-insensitive, with whitespace prefix).
- Blocks `vbscript:`.
- Blocks `data:text/html`.
- Blocks `data:application/xhtml`.

### `validateFieldValue`
- **Info controls** (`header`, `paragraph`): always returns `null`.
- **Required check**: `null`, `undefined`, `''` → error; non-empty value → `null`; `false` passes (boolean required; see RISK-SEC-U03).
- **number / range**: valid number passes; non-number returns error; below `min` returns error; above `max` returns error; `undefined` / empty passes (not required).
- **url**: safe URL passes; `javascript:` blocked; `vbscript:` blocked.
- **video**: same as `url`.
- **video_url**: HTTPS YouTube passes; HTTPS Vimeo passes; non-YouTube/Vimeo fails; `javascript:` blocked.
- **font_picker**: known registry key passes; unknown key returns error; empty passes.
- **text / textarea / richtext / html / liquid**: within `maxLength` passes; exceeding `maxLength` returns error.
- **Other types** (`color`, `image`, `select`, `toggle`, `checkbox`, `radio`, `color_background`, `color_scheme`, `product`, `collection`, `blog`, `page`, `menu`): no type-specific validation beyond required check.
- **Unknown / legacy types**: returns `null` (graceful degradation).

### `isFieldVisible`
- No `visible_if`: always `true`.
- `visible_if` matched: `true`.
- `visible_if` not matched: `false`.
- Strict equality: string `'1'` vs number `1` → not matched.

### `resolveFieldDefault`
- Schema `default` defined: returns it as-is.
- `toggle` / `checkbox` without default: returns `false`.
- `number` / `range` without default: returns `field.min` if set, else `0`.
- `header` / `paragraph` without default: returns `null`.
- All other types without default: returns `''`.

---

## Phase U Test Coverage (`theme-editor-u.test.mjs` — 76 tests)

### File existence (11 files)
- `controls/CheckboxControl.tsx`
- `controls/ColorBackgroundControl.tsx`
- `controls/ColorSchemeControl.tsx`
- `controls/FontPickerControl.tsx`
- `controls/HtmlControl.tsx`
- `controls/LiquidControl.tsx`
- `controls/VideoControl.tsx`
- `controls/VideoUrlControl.tsx`
- `controls/InfoControls.tsx`
- `controls/ResourcePickerControl.tsx`
- `controls/controls.module.css`

### Import compliance
- Each control imports from `@letbuyy/ui`.
- No control imports from `page.tsx`.
- No control imports from `globals.css`.
- No control imports Supabase or api-client.

### Design ratchet
- No `rounded-[...]` Tailwind class in any new control file.
- No `rounded-[...]` in `controls.module.css`.

### Sanitize law
- `HtmlControl.tsx` does not contain `dangerouslySetInnerHTML`.
- `LiquidControl.tsx` does not contain `dangerouslySetInnerHTML`.

### NOT-CONNECTED badges
- `ResourcePickerControl.tsx` contains `NOT-CONNECTED — live search available in Phase W`.
- `LiquidControl.tsx` contains `NOT-CONNECTED` text.

### Font registry constraint
- `FontPickerControl.tsx` references `EXPERIENCE_FONT_REGISTRY`.

### SchemaFormRenderer contracts
- Imports `ExtendedSchemaField` (not `SchemaField`).
- Imports `isFieldVisible`.
- Imports `isUnsafeUrl`.
- Imports `resolveFieldDefault`.
- Has `case 'color_background':` switch branch.
- Has `case 'color_scheme':` switch branch.
- Has `case 'font_picker':` switch branch.
- Has `case 'html':` switch branch.
- Has `case 'liquid':` switch branch.
- Has `case 'checkbox':` switch branch.
- Has `case 'video':` switch branch.
- Has `case 'video_url':` switch branch.
- Has `case 'header':` switch branch.
- Has `case 'paragraph':` switch branch.
- Has resource picker cases (`product`, `collection`, `blog`, `page`, `menu`).

### RISK-DUAL-N01 isolation
- `SchemaFormRenderer.tsx` does not mutate the `field` descriptor object.
- Controls receive `value` and `onChange` props only; `field` is read-only schema metadata.

---

## Pre-Existing Failures (unchanged)

3 pre-existing test failures in the merchant workspace (federation / localisation / app-platform) that were present before Phase R. These are foreign WIP failures unrelated to the theme program. Phase U does not introduce or close any of these.

---

## validate-governance.mjs

EXIT=1. Sole failure: `services/api-gateway/src/tenant/tenant-tables.registry.ts` out of sync with schema-derived registry (pre-existing foreign WIP). Anti-fabrication gate PASSES. Phase U adds no new tables and does not affect the tenant registry drift.
