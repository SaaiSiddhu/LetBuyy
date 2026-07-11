# Phase Z — Report: Markets + Localization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Z — Markets + Localization
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** COMPLETE (work uncommitted per Phase Z hard rules)

---

## 1. Summary

Phase Z delivers the locale/translation layer for the theme engine and a merchant-facing translation editor UI in the merchant control plane. It establishes `en-IN` as the explicit India-first constant, adds a prototype-safe `tLocale` helper with a documented fallback chain, and provides a `formatThemeCurrencyDisplay` helper with an honest NOT-CONNECTED declaration for multi-currency display. The translation editor is a sibling route to the foreign WIP `editor/page.tsx` — it does not touch that file.

Multi-currency FX conversion remains NOT-CONNECTED: the `store_markets` table models `currency`, `price_adjustment_bps`, and `rounding_mode` fields but these are not wired to the render path. No live FX rate feed exists in the codebase. `formatThemeCurrencyDisplay.fxConnected` is always `false`; callers receive the honest `fxNotConnectedReason` string.

**Test gate:** 1525/1525 theme-engine · 533/533 merchant theme-editor suite · api-gateway/storefront-runtime/typechecks unchanged and clean.

---

## 2. Deliverables

### Lane A — Engine (`packages/theme-engine/`)

#### `packages/theme-engine/src/theme-locale.ts` — NEW

India-first locale and currency display helpers. Exports:

| Export | Description |
|--------|-------------|
| `THEME_DEFAULT_STORE_LOCALE` | `'en-IN'` — the India-first default constant; use instead of bare `'en'` |
| `normalizeLocale(locale)` | Converts underscore to hyphen, uppercases region; returns `'en-IN'` for null/undefined/empty |
| `tLocale(key, locale, locales, replacements?)` | Key resolver with 4-level fallback chain, prototype safety, key charset validation, and `{{ varname }}` interpolation |
| `formatThemeCurrencyDisplay(amountMinorUnits, currencyCode?, locale?)` | Presentational-only display helper; INR+en-IN byte-identical to `formatLiquidMoney`; `fxConnected: false` always |
| `ThemeCurrencyDisplayResult` | Interface: `{ formatted: string; fxConnected: false; fxNotConnectedReason: string }` |

**`tLocale` fallback chain:** `[normalizedLocale, language-tag, 'en-IN', 'en']` — `en-IN` is always tried as a near-fallback before bare `en`. Missing keys return the key path without the `t:` prefix (not `undefined`, not the literal `'t:key'`).

**Prototype safety:** `BLOCKED_PATH_SEGMENTS = { '__proto__', 'constructor', 'prototype' }` checked on every path segment in `lookupPath`. Any key containing these segments returns the key path as-is without traversal. Tests Z-L29 and Z-L30 confirm.

**Key charset guard:** Keys are validated against a charset pattern after stripping the `t:` prefix. Invalid keys (empty, starts with non-alpha, contains illegal characters) are returned as-is without lookup. Never crashes.

**`formatThemeCurrencyDisplay` correctness:**
- `amountMinorUnits / 100` → major units.
- Non-numeric / NaN / Infinity inputs → `0.00` (same as `formatLiquidMoney`).
- Invalid or null `currencyCode` → falls back to `'INR'`.
- INR + en-IN: output is byte-identical to the existing `formatLiquidMoney` reference (Z-C01..Z-C04).
- Other currencies: display presentationally using the supplied currency code as prefix; no conversion.
- `fxConnected: false` is a literal type, not `boolean` — any `if (result.fxConnected)` branch is always dead.

#### `packages/theme-engine/test/theme-locale.test.ts` — NEW (32 tests, Z-L01..Z-L32)

Covers the complete `tLocale` and `normalizeLocale` contract: fallback chain, India-first precedence, prefix stripping, interpolation, prototype safety, invalid key handling, and determinism. See `PHASE_Z_TEST_REPORT.md` §1.1 for the full matrix.

#### `packages/theme-engine/test/theme-currency-display.test.ts` — NEW (24 tests, Z-C01..Z-C24)

Covers the complete `formatThemeCurrencyDisplay` contract: INR+en-IN byte-identity, non-INR display-only, NOT-CONNECTED honesty, minor-unit conversion, edge inputs, default arguments, and determinism. See `PHASE_Z_TEST_REPORT.md` §1.2 for the full matrix.

#### `packages/theme-engine/src/index.ts` — MODIFIED (1 line)

`export * from './theme-locale'` added. All five exports are now available from `@letbuyy/theme-engine`.

---

### Lane B — Editor (`apps/merchant-control-plane/`)

#### `apps/merchant-control-plane/src/components/theme-locale/LocaleSwitcher.tsx` — NEW

Locale selector component for the translation editor.

- Exports `DEFAULT_ADMIN_LOCALE = 'en-IN'` and `SUPPORTED_ADMIN_LOCALES`.
- `@letbuyy/ui` imports; `--lb-*` tokens only; no raw `rounded-[Npx]`.
- `role="region"` + `aria-label` for landmark a11y.
- `en-IN` selected by default (India-first).
- Keyboard-accessible (combobox or listbox pattern).
- Loading/empty/error states.
- Mobile-first (`~360px`).
- Guard: default locale cannot be deleted (UI-layer guard; RISK-Z04 for API-layer).

#### `apps/merchant-control-plane/src/components/theme-locale/TranslationKeyList.tsx` — NEW

Key+value listing with missing-key detection.

- Renders `(key, defaultValue, currentValue)` rows from `storefront_translations` scoped to `resource_type = 'theme'` and `selectedLocale`.
- Missing-key indicator: key present in `DEFAULT_ADMIN_LOCALE` (`en-IN`) but absent in `selectedLocale`. Badge with `aria-label` for a11y.
- `role="list"` + `aria-label` on the list container.
- `onEdit` callback always passes `resource_type: 'theme' as const` (RISK-DUAL-N01 enforced).
- `buildLocaleMap` scopes to `resource_type = 'theme'`.
- Loading (`aria-busy`) / empty / error (`role="alert"`) states.
- No `dangerouslySetInnerHTML`.
- RISK-DUAL-N01 documented in JSDoc.

#### `apps/merchant-control-plane/src/components/theme-locale/TranslationValueEditor.tsx` — NEW

Inline key/value editor.

- Writes to proxy route via `PATCH` (update) or `POST` (create) with `resource_type: 'theme' as const`.
- Validates `translated_text` non-empty before submit.
- Never writes to `section_definitions` (RISK-DUAL-N01).
- Save button + cancel button each with `aria-label`.
- `Escape` key handler cancels editing.
- No `dangerouslySetInnerHTML`.
- RISK-DUAL-N01 documented in JSDoc.

#### `apps/merchant-control-plane/src/components/theme-locale/theme-locale.module.css` — NEW

Supplemental CSS module for the translation editor components.

- `--lb-*` design tokens only.
- No raw `rounded-[Npx]` values.
- Classes: `localeSwitcherRoot`, `translationKeyList`, `translationEditorRoot`, `translationValueEditorRoot`.

#### `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/translations/page.tsx` — NEW

Server component wrapper. Sibling to `editor/page.tsx`; does NOT modify `editor/page.tsx`.

- No `'use client'` directive.
- Fetches localization summary from `/api/stores/:id/localization` (same-origin proxy; not gateway direct).
- Renders `<TranslationEditorClient>`.
- Does not reference the canonical money ledger.

#### `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/translations/TranslationEditorClient.tsx` — NEW

Client component orchestrator.

- `'use client'` directive.
- `useState(DEFAULT_ADMIN_LOCALE)` — India-first initial selection.
- `aria-label` on root container.
- Loading state (`aria-busy`).
- Error state (`role="alert"`).
- Passes `defaultLocale={DEFAULT_ADMIN_LOCALE}` to `TranslationKeyList`.
- RISK-DUAL-N01 documented.
- No `dangerouslySetInnerHTML`.

#### `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/route.ts` — NEW

POST proxy for creating translation entries.

- `resolveOwnedStoreId` → `createMerchantApiClient` → `api.createTranslation`.
- `resolved.storeId` used; not client-supplied.
- Exports `POST` handler.
- No direct Supabase import.
- RISK-DUAL-N01 documented.
- Known gaps: no proxy-layer `resource_type` validation (RISK-Z03); no proxy-layer `resource_id` ownership check (RISK-Z05).

#### `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/[translationId]/route.ts` — NEW

PATCH + DELETE proxy for updating and deleting translation entries.

- `resolveOwnedStoreId` → `createMerchantApiClient` → `api.updateTranslation` / `api.deleteTranslation`.
- `resolved.storeId` used.
- Exports `PATCH` + `DELETE` handlers.
- No direct Supabase import.
- RISK-DUAL-N01 documented.
- Known gap: no server-side guard preventing deletion of `en-IN` default-locale rows (RISK-Z04).

#### `apps/merchant-control-plane/tests/theme-editor-z.test.mjs` — NEW (86 tests)

Static-contract tests. See `PHASE_Z_TEST_REPORT.md` §2 for the full matrix.

#### `apps/merchant-control-plane/package.json` — MODIFIED (additive, foreign WIP)

`theme-editor-z.test.mjs` appended to the test script.

---

## 3. Locale Model — Authoritative Description

### 3.1 JSON-contract path (React components)

`localizeThemeTemplateConfig(resolvedTemplateConfig, storeLocale)` walks the template config tree and replaces any string value prefixed with `t:` using:

1. `resolveThemeLocaleDictionary(locales, storeLocale)` — selects the matching locale dictionary using `getThemeLocaleCandidates([normalizedLocale, normalizedLower, language, 'en'])`. Note: this pre-Phase-Z helper terminates at bare `'en'` and is in `theme-bundle.ts`, distinct from Phase Z's `tLocale`.
2. `resolveThemeTranslation(dictionary, key)` — dot-path lookup.
3. Missing key returns the original `t:key.path` literal unchanged.

The call at `apps/storefront-runtime/src/lib/store-service.ts:574` runs this before section components receive their props. Strings arrive at React components already-resolved.

### 3.2 Liquid path (`t` filter)

`translateLiquidKey` is registered via `registerLetbuyyLiquidFilters`. It calls `resolveLiquidLocaleDictionary(bundle.locales, locale)` (fallback chain `[locale, locale.split('-')[0], 'en']`) and `lookupTranslation(dictionary, key)` (dot-path reduction, `{{ varname }}` interpolation). Missing keys return the key string itself. All filter output auto-escaped by LiquidJS `outputEscape: 'escape'`.

### 3.3 Phase Z `tLocale` path (new, additive)

`tLocale` is exported from `@letbuyy/theme-engine` and is available for use outside the bundle parser and renderer. It is not currently wired into the JSON-contract or Liquid render paths (both remain on their existing pre-Phase-Z implementations). Phase Z's `tLocale` is intended for:
- Direct callers in the merchant control plane (e.g., the translation editor, future locale-aware settings).
- Test suites that need to assert locale resolution behaviour against a documented contract.
- Future phases that add new locale-sensitive surfaces outside the renderer.

The pre-Phase-Z `resolveThemeTranslation` (in `theme-bundle.ts`) and `lookupTranslation` (in `theme-renderer.ts`) continue to serve the bundle and Liquid render paths unchanged.

### 3.4 Locale selection (storefront)

`sites.locale` is the canonical locale column. Default on store creation: `'en-IN'` (`stores.ts:686`). `storeLocale` in `store-service.ts` defaults to `'en-IN'` via `|| 'en-IN'`. No per-request locale override (Accept-Language) exists today. A store with `sites.locale = 'en'` (bare) will encounter RISK-Z01 in the Phase Z `tLocale` path.

---

## 4. Multi-Currency Display — Honesty Record

### 4.1 What is CONNECTED

- `formatInrCurrency` (`packages/typescript/ui/src/formatting.ts`) — INR display using `Intl.NumberFormat('en-IN', …)`.
- `formatLiquidMoney` (`packages/theme-engine/src/theme-renderer.ts`) — minor-unit division + `toLocaleString('en-IN')`, default currency `'INR'`.
- `money` and `money_with_currency` Liquid filters — format only, INR+en-IN.
- `formatThemeCurrencyDisplay` for INR+en-IN — byte-identical to `formatLiquidMoney` (Phase Z adds this, CONNECTED for INR+en-IN only).
- Cart drop `currency: 'INR'` (`buildLiquidCommerceDrops`).

### 4.2 What is NOT-CONNECTED

- Live FX rate feed — zero occurrences of `exchangeRate`, `exchange_rate`, `convertCurrency` in non-LCIS source code.
- `store_markets.currency / price_adjustment_bps / rounding_mode` — modelled in the DB, not wired to any render path.
- Cross-currency checkout — the canonical ledger (`create_checkout_order` and siblings) is fully INR. No cross-currency charging RPC.
- `formatThemeCurrencyDisplay` for non-INR currencies — presentational display only, no conversion. `fxConnected: false` always.
- The exact missing piece for multi-currency display: a server-side presentational FX rate source (e.g., `sites.currency` + a rate table or Razorpay FX endpoint) and a safe display-conversion helper clearly labelled presentational and never touching the canonical ledger.

---

## 5. Rollback

**Rollback = `git revert` of the Phase Z commit(s).** No schema migration was added by Phase Z. No `storefront_translations` rows are created by Phase Z source (only by merchant interaction with the deployed UI). No `package.json` dependency was added. Reverting the commits removes all Phase Z source files; the merchant control plane reverts to the Phase Y test count (447) and the theme-engine reverts to the Phase Y test count (1469). No data cleanup is required.

---

## 6. Security and Risks

### Findings summary

Six findings from the Phase Z security review. No hardening pass was performed (Hardening: null). All findings registered as RISK-Z01..RISK-Z06. No HIGH finding. See `PHASE_Z_SECURITY_REVIEW.md` for the full analysis.

| Risk ID | Severity | Summary |
|---------|----------|---------|
| RISK-Z01 | MEDIUM | `buildCandidates('en')` puts bare `'en'` before `'en-IN'` — India-first inverted for stores with `locale='en'` |
| RISK-Z02 | LOW | Pre-existing `lookupTranslation` in `theme-renderer.ts` lacks BLOCKED_PATH_SEGMENTS guard |
| RISK-Z03 | LOW | Translation POST proxy does not validate `resource_type` at proxy layer |
| RISK-Z04 | LOW | DELETE proxy has no server-side guard against deleting default-locale (en-IN) rows |
| RISK-Z05 | LOW | POST proxy does not verify `resource_id` (themeId) belongs to resolved `storeId` |
| RISK-Z06 | LOW | Gateway `deleteTranslation` handler has no locale guard (backend view of RISK-Z04) |

### Carry-over risks (from earlier phases, not addressed in Phase Z)

Phase Z touched `packages/theme-engine/src/theme-locale.ts` (new) and `packages/theme-engine/src/index.ts` (additive). It did NOT touch `theme-renderer.ts`, `theme-bundle.ts`, `theme-document.ts`, `schema-field-extensions.ts`, `dynamic-source-binding.ts`, `SectionTreePanel.tsx`, `SchemaFormRenderer.tsx`, `ResourcePickerControl.tsx`, `LiquidControl.tsx`, `controls.module.css`, or `CheckboxControl.tsx`/`FontPickerControl.tsx`/`ColorSchemeControl.tsx`.

Therefore: RISK-Y01, RISK-T01, RISK-T02, RISK-T03, RISK-T04, RISK-T05, RISK-T06, RISK-W01, RISK-W02, RISK-W03, RISK-W04, RISK-W05, RISK-W06, RISK-SEC-U01, RISK-SEC-U02, RISK-SEC-U03, RISK-A11Y-U01, RISK-A11Y-U02, RISK-STYLE-U01, RISK-STYLE-U02 all carry to Phase AA unchanged.

---

## 7. Foreign WIP

Phase Z confirmed the following files were not modified (pre-session git status shows them as modified by earlier foreign work; Phase Z did not add to their modifications):

- `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` — CONFIRMED UNMODIFIED by Phase Z
- `apps/merchant-control-plane/src/app/globals.css` — CONFIRMED UNMODIFIED by Phase Z
- `packages/typescript/api-client/src/index.ts` — CONFIRMED UNMODIFIED by Phase Z (api-client already had `createTranslation`/`updateTranslation`/`deleteTranslation` methods)
- `services/api-gateway/src/index.ts` — CONFIRMED UNMODIFIED by Phase Z
- `packages/theme-engine/src/theme-renderer.ts` — CONFIRMED UNMODIFIED by Phase Z
- `packages/theme-engine/src/theme-bundle.ts` — CONFIRMED UNMODIFIED by Phase Z; `DEFAULT_THEME_LOCALE = 'en'` (line 652) is unchanged

---

## 8. Next Phase

**Phase AA: Custom CSS + Code Workspace**

Entering gate: api-gateway **519 pass** (unchanged) · theme-engine **1525/1525** · merchant theme-editor **533/533** · storefront-runtime **795/795** · all typechecks clean.

Phase AA must:
- Address RISK-Z01 (India-first inversion for `locale='en'`) if touching `theme-locale.ts`.
- Address RISK-T04 (`RENDERER_MAX_BLOCK_DEPTH` private) if touching `theme-renderer.ts`.
- Address RISK-T05 (`allowedChildTypes` not wired) if touching `SectionTreePanel.tsx`.
- Address RISK-T06 (`UnsupportedThemeDocumentFeatureError` dead export) if touching `theme-document.ts`.
- Address RISK-W01 (`BINDING_BLOCKED_KEYS` parity) if touching `dynamic-source-binding.ts`.
- Continue using `--lb-*` design tokens.
- Not add realtime subscriptions until RISK-SEC-P01 resolved.
- Not add a route over `theme_purchases` until RISK-SEC-001 (wide-open RLS) resolved.
- Bump `THEME_DOCUMENT_VERSION` and `KNOWN_THEME_DOCUMENT_VERSIONS` if adding fields to `ThemeDocumentSchema` (RISK-ARCH-N01).
