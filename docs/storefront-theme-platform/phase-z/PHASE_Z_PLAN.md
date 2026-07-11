# Phase Z — Plan: Markets + Localization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Z — Markets + Localization
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** PLAN EXECUTED — COMPLETE

---

## 1. Objectives

1. **India-first locale helper** — export a `tLocale(key, locale, locales, replacements?)` function from `theme-engine` with an `en-IN`-first fallback chain, prototype-safe path traversal, key charset validation, and interpolation.
2. **Currency display helper** — export `formatThemeCurrencyDisplay(amountMinorUnits, currencyCode, locale)` that is byte-identical to `formatLiquidMoney` for INR+en-IN and explicitly NOT-CONNECTED for FX conversion of other currencies.
3. **Translation editor UI** — deliver a merchant-facing translation editor as a sibling route to `editor/page.tsx` without touching the foreign WIP editor page.
4. **Tenancy and RISK-DUAL-N01 compliance** — all write paths scope to `resource_type: 'theme' as const`; never write `section_definitions` or `block_definitions`.

---

## 2. Entry Gates (inherited from Phase Y exit)

| Package | Required gate |
|---------|---------------|
| theme-engine | 1469/1469 pass |
| merchant-control-plane (theme-editor suite) | 447/447 pass |
| api-gateway | 519 pass (522 total; 3 pre-existing fail) |
| storefront-runtime | 795/795 pass |
| All typechecks | clean |

---

## 3. Lane A — Engine (`packages/theme-engine/`)

### 3.1 New file: `theme-locale.ts`

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `THEME_DEFAULT_STORE_LOCALE` | `'en-IN'` | India-first default; replaces the pre-Phase-Z `DEFAULT_THEME_LOCALE = 'en'` in consumer code |
| `normalizeLocale(locale)` | `(string \| null \| undefined) → string` | Converts underscore to hyphen, uppercases region tag; returns `'en-IN'` for null/undefined/empty |
| `tLocale(key, locale, locales, replacements?)` | function | Resolves a `t:` key through a 4-level fallback chain with interpolation and prototype safety |
| `formatThemeCurrencyDisplay(amountMinorUnits, currencyCode?, locale?)` | function | Presentational only; INR+en-IN byte-identical to `formatLiquidMoney`; `fxConnected: false` always |
| `ThemeCurrencyDisplayResult` | interface | `{ formatted: string; fxConnected: false; fxNotConnectedReason: string }` |

**`tLocale` contract:**

1. Strip `t:` prefix if present.
2. Validate key charset: `/^[a-z][a-z0-9_.-]*/i` — invalid keys returned as-is (no crash).
3. Normalize locale via `normalizeLocale`.
4. Build candidate list via `buildCandidates(locale)`: dedup from `[normalized, language-tag, 'en-IN', 'en']`.
5. For each candidate: call `lookupPath(locales[candidate], segments)` — prototype-safe (blocks `__proto__`, `constructor`, `prototype` segments).
6. Apply `{{ varname }}` interpolation on the first match.
7. Missing key: return the key path without the `t:` prefix.
8. Deterministic: same inputs always produce same output.

**`formatThemeCurrencyDisplay` contract:**

1. `amountMinorUnits` divided by 100 to get major units.
2. Non-numeric / NaN / Infinity inputs: `0.00`.
3. Invalid or null `currencyCode`: fall back to `'INR'`.
4. `currencyCode = 'INR'` (after normalisation): use `toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })` — byte-identical to `formatLiquidMoney`.
5. Other currency codes: display presentationally with the currency code prefix; no FX conversion.
6. `fxConnected: false` always.
7. `fxNotConnectedReason`: non-empty string documenting the exact missing FX source.
8. Default arguments: `currencyCode = 'INR'`, `locale = 'en-IN'`.

**Security constraints (non-negotiable):**
- `BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])`.
- `lookupPath` checks each segment before accessing the object key.
- No DOMPurify config change.
- `tLocale` returns raw strings — escaping is the render layer's responsibility (LiquidJS `outputEscape: 'escape'`; React auto-escaping).

### 3.2 New tests

| File | Tests | Range |
|------|-------|-------|
| `test/theme-locale.test.ts` | 32 | Z-L01..Z-L32 |
| `test/theme-currency-display.test.ts` | 24 | Z-C01..Z-C24 |

**Critical tests to include:**
- Z-L09 / Z-L10: `null` / empty locale resolves via `'en-IN'` (India-first null-safety).
- Z-L11: `en-IN` takes precedence over bare `en` when bundle has both.
- Z-L32: `THEME_DEFAULT_STORE_LOCALE === 'en-IN'`.
- Z-C01..Z-C04: INR+en-IN output byte-identical to `formatLiquidMoney` reference.
- Z-C09: `fxConnected` is always `false`.
- Z-L29..Z-L30: prototype key path safety (no crash, key returned as-is).

### 3.3 `index.ts` modification

One additive line: `export * from './theme-locale'`.

### 3.4 Exit gate (Lane A)

`pnpm --filter=@letbuyy/theme-engine typecheck test` → **1525 pass** (1469 baseline + 56 new) · 0 errors · 0 fail.

---

## 4. Lane B — Editor (`apps/merchant-control-plane/`)

### 4.1 Directory: `src/components/theme-locale/`

Four new files in a dedicated `theme-locale/` subdirectory (parallel to `theme-editor/`):

#### `LocaleSwitcher.tsx`

- `@letbuyy/ui` components; `--lb-*` tokens only.
- Exports `DEFAULT_ADMIN_LOCALE = 'en-IN'` and `SUPPORTED_ADMIN_LOCALES`.
- `role="region"` + `aria-label` for a11y.
- `en-IN` default selected.
- Keyboard-accessible (role=combobox or listbox).
- Loading/empty/error states.
- Mobile-first (`~360px`).
- Guard: default locale (`en-IN`) cannot be selected for deletion.

#### `TranslationKeyList.tsx`

- Renders key+value pairs from `bundle.locales[selectedLocale]`.
- Missing-key indicator: key exists in `DEFAULT_ADMIN_LOCALE` (`en-IN`) but absent in `selectedLocale`.
- Missing-key badge has `aria-label` (a11y).
- `role="list"` + `aria-label` on the list.
- Edit/add button with `aria-label`.
- `buildLocaleMap` scopes to `resource_type = 'theme'`.
- `onEdit` callback always passes `resource_type: 'theme'` (RISK-DUAL-N01).
- Exports `DEFAULT_ADMIN_LOCALE` as default reference locale parameter.
- Loading/empty/error states.
- No `dangerouslySetInnerHTML`.
- Documents RISK-DUAL-N01 in JSDoc.

#### `TranslationValueEditor.tsx`

- Inline key/value editor.
- Writes to existing proxy route (`PATCH` / `POST` via `/api/stores/:id/localization/translations`).
- Validates `translated_text` non-empty.
- `resource_type: 'theme' as const` — never writes `section_definitions`.
- RISK-DUAL-N01 documented in JSDoc.
- Save button + cancel button with `aria-label`.
- Handles `Escape` key to cancel (a11y).
- No `dangerouslySetInnerHTML`.

#### `theme-locale.module.css`

- `--lb-*` design tokens only.
- No raw `rounded-[Npx]` values.
- Classes: `localeSwitcherRoot`, `translationKeyList`, `translationEditorRoot`, `translationValueEditorRoot`.

### 4.2 New route: `editor/translations/`

| File | Type | Notes |
|------|------|-------|
| `translations/page.tsx` | Server component | Sibling to `editor/page.tsx`; does NOT modify `editor/page.tsx` |
| `translations/TranslationEditorClient.tsx` | Client component | Orchestrates `LocaleSwitcher` + `TranslationKeyList` + `TranslationValueEditor` |

`translations/page.tsx`:
- Server component (no `'use client'`).
- Fetches localization summary from `/api/stores/:id/localization` (same-origin proxy, not gateway direct).
- Renders `TranslationEditorClient`.
- Does not touch money ledger.

`TranslationEditorClient.tsx`:
- `useState(DEFAULT_ADMIN_LOCALE)` — India-first initial state.
- `aria-label` on root container.
- Loading state (`aria-busy`).
- Error state (`role="alert"`).
- Passes `defaultLocale={DEFAULT_ADMIN_LOCALE}` to `TranslationKeyList`.
- Documents RISK-DUAL-N01.
- No `dangerouslySetInnerHTML`.

### 4.3 Proxy routes

#### `POST /api/stores/[store]/localization/translations/route.ts`

- `resolveOwnedStoreId` → `createMerchantApiClient` → `api.createTranslation`.
- Documents RISK-DUAL-N01.
- `resolved.storeId` used (not client-supplied storeId).
- Exports `POST` handler.
- Does not import Supabase directly.
- Does not import from `api-client/src/index` directly (uses `createMerchantApiClient`).
- Known gap: `body.resource_id` (themeId) not validated against `storeId` at proxy layer — RISK-Z05.

#### `PATCH + DELETE /api/stores/[store]/localization/translations/[translationId]/route.ts`

- `resolveOwnedStoreId` → `createMerchantApiClient` → `api.updateTranslation` / `api.deleteTranslation`.
- Documents RISK-DUAL-N01.
- Exports `PATCH` + `DELETE` handlers.
- Known gap: no server-side guard preventing deletion of `en-IN` default-locale rows — RISK-Z04.

### 4.4 Tests: `tests/theme-editor-z.test.mjs`

86 static-contract tests covering:
- File existence (all 9 new files).
- India-first proof (DEFAULT_ADMIN_LOCALE = 'en-IN'; useState initialiser; defaultLocale prop; buildLocaleMap reference locale).
- RISK-DUAL-N01 (resource_type: 'theme'; never section_definitions; onEdit always passes theme resource_type).
- Tenancy compliance (resolveOwnedStoreId imported; createMerchantApiClient used; no direct Supabase import; resolved.storeId used).
- A11y (role=region, role=list, aria-label, aria-busy, role=alert, Escape key, aria-label on save/cancel).
- Design ratchet (no rounded-[Npx]; --lb-* tokens; @letbuyy/ui imports).
- Foreign WIP isolation (editor/page.tsx NOT modified; no import from editor/page.tsx; no import from globals.css; no ExperiencePicker import; no @letbuyy/api-client direct import).
- Sandbox law (no dangerouslySetInnerHTML in any component).
- Money ledger isolation (no reference to canonical money ledger).
- Proxy handler exports (POST, PATCH, DELETE).

### 4.5 `package.json` modification

`theme-editor-z.test.mjs` appended to the test script (additive; foreign WIP `package.json`).

### 4.6 Exit gate (Lane B)

`pnpm --filter @letbuyy/merchant-control-plane typecheck test` → **533 pass** (447 baseline + 86 new) · 0 errors · 0 fail.

---

## 5. Hardening Policy

**Hardening: null** — no code changes applied after the security review. All 6 findings from the Phase Z security review are registered as open risks and deferred. The findings are low-severity and defence-in-depth gaps; no HIGH finding was identified. See `PHASE_Z_SECURITY_REVIEW.md` for full analysis.

---

## 6. Risks Introduced / Addressed

| Risk ID | Action | Severity |
|---------|--------|----------|
| RISK-Z01 | NEW: `buildCandidates('en')` India-first inversion for bare `'en'` locale | MEDIUM |
| RISK-Z02 | NEW: pre-existing `lookupTranslation` in `theme-renderer.ts` lacks BLOCKED_PATH_SEGMENTS guard | LOW |
| RISK-Z03 | NEW: translation POST proxy does not validate `resource_type` at proxy layer | LOW |
| RISK-Z04 | NEW: DELETE proxy has no server-side guard against deleting default-locale (en-IN) rows | LOW |
| RISK-Z05 | NEW: POST proxy does not verify `resource_id` belongs to `storeId` at proxy layer | LOW |
| RISK-Z06 | NEW: gateway `deleteTranslation` handler has no locale guard (backend perspective of RISK-Z04) | LOW |
| RISK-Y01 | CARRY: `MAX_APP_BLOCKS_PER_SLOT` not enforced in render loop | LOW → Phase AA |
| RISK-T04 | CARRY: `RENDERER_MAX_BLOCK_DEPTH` private | LOW → Phase AA |
| RISK-T05 | CARRY: `allowedChildTypes` not wired | MEDIUM → Phase AA |
| RISK-T06 | CARRY: `UnsupportedThemeDocumentFeatureError` dead export | LOW → Phase AA |
| RISK-W01 | CARRY: `BINDING_BLOCKED_KEYS` parity not enforced | MEDIUM → Phase AA |
| RISK-T03 | CARRY: non-app block settings bypass `filterBlockedSettingsKeys` | LOW → Phase AA |

---

## 7. Foreign WIP Isolation

The following files were confirmed unmodified by Phase Z:
- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`
- `apps/merchant-control-plane/src/app/globals.css`
- `packages/typescript/api-client/src/index.ts`
- `services/api-gateway/src/index.ts`
- `packages/theme-engine/src/theme-renderer.ts` (not touched by Phase Z)
- `packages/theme-engine/src/theme-bundle.ts` (not touched by Phase Z; `DEFAULT_THEME_LOCALE = 'en'` unchanged)

Work left uncommitted per Phase Z hard rules (applies to all phases in this program).
