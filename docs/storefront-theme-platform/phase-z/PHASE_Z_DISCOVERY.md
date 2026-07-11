# Phase Z — Discovery: Markets + Localization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Z — Markets + Localization
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** DISCOVERY COMPLETE

---

## 1. Scope

Phase Z delivers the locale/translation layer for the theme engine and a merchant-facing translation editor in the control plane. Two lanes:

| Lane | Owner | Files |
|------|-------|-------|
| A — Engine (Lane A) | packages/theme-engine | `theme-locale.ts` (NEW), `test/theme-locale.test.ts` (NEW), `test/theme-currency-display.test.ts` (NEW), `index.ts` (MODIFIED) |
| B — Editor (Lane B) | apps/merchant-control-plane | `LocaleSwitcher.tsx`, `TranslationKeyList.tsx`, `TranslationValueEditor.tsx`, `theme-locale.module.css`, `translations/page.tsx`, `TranslationEditorClient.tsx`, two proxy routes, `theme-editor-z.test.mjs`, `package.json` (all NEW/MODIFIED) |

---

## 2. Existing Locale Infrastructure (Pre-Phase Z)

### 2.1 JSON-contract path (`theme-bundle.ts` + `store-service.ts`)

The pre-Phase-Z locale model in `packages/theme-engine/src/theme-bundle.ts` defines:

- `ThemeBundleLocaleSchema = z.record(z.string(), ThemeBundleJsonSchema)` — arbitrary nested JSON keyed by locale string.
- `locales: Record<string, ThemeBundleLocale>` present in both `ThemePackageBundleSchema` and `LiquidThemePackageBundleSchema`.
- `DEFAULT_THEME_LOCALE = 'en'` (line 652) — the pre-Phase-Z fallback. Notably bare `'en'`, not `'en-IN'`.
- `THEME_TRANSLATION_PREFIX = 't:'` (line 653).
- Helper chain: `normalizeThemeLocale` → `getThemeLocaleCandidates([normalized, normalizedLower, language, 'en'])` → `resolveThemeLocaleDictionary` → `resolveThemeTranslation` (dot-path lookup) → `localizeThemeTemplateConfig` (walks the entire JSON-contract template config tree pre-render, replacing `t:key.path` strings in-place).

JSON-contract strings reach React section components already-resolved: `localizeThemeTemplateConfig(resolvedTemplateConfig, storeLocale)` is called at `apps/storefront-runtime/src/lib/store-service.ts` line 574.

**India-first gap discovered:** `DEFAULT_THEME_LOCALE = 'en'` (bare) fails the India-first invariant. The platform should prefer `'en-IN'` wherever English is the chosen fallback, since stores are India-first and `en-IN` formatting differs from generic `en` (number grouping, date formatting, currency presentation).

### 2.2 Liquid path (`theme-renderer.ts`)

- `t` filter registered by `registerLetbuyyLiquidFilters` (line 1089–1096) as `translateLiquidKey`.
- Fallback chain in `resolveLiquidLocaleDictionary` (lines 1118–1136): `[locale, locale.split('-')[0], 'en']`.
- `lookupTranslation` does dot-path reduction.
- `{{ varname }}` interpolation applied post-lookup.
- Missing key returns the key string itself.
- `outputEscape:'escape'` — all `t` filter output is auto-escaped by LiquidJS at the render layer. Phase Z's JSON-contract path returns raw strings; escaping is the caller's responsibility.

**Security gap discovered (pre-existing):** `lookupTranslation` at lines 1118–1136 traverses dot-path segments without the `BLOCKED_PATH_SEGMENTS` guard that Phase Z's new `lookupPath` / `tLocale` correctly adds. Segment values `__proto__`, `constructor`, `prototype` reach `(current as Record<string, unknown>)[segment]` unguarded. Impact is bounded: read-only access on first-party bundles; no write. Registered as RISK-Z02.

### 2.3 Locale selection (`sites.locale` → storefront)

- `services/api-gateway/src/routes/stores.ts` line 686 defaults `locale` to `'en-IN'` on store creation.
- `services/api-gateway/src/routes/stores-localization.ts` `normalizeLocale()` (line 114–117) normalises to `'en-IN'` as fallback.
- `apps/storefront-runtime/src/lib/store-service.ts`: `storeLocale = (data.locale as string) || 'en-IN'` (lines 504 and 558).
- `storeLocale` flows to JSON-contract path via `localizeThemeTemplateConfig(resolvedTemplateConfig, storeLocale)` (line 574) and to Liquid path via `createLiquidEngine(bundle, { locale: input.context.locale || 'en' })` (lines 563 and 687).
- No per-request locale override (e.g., `Accept-Language` header) exists today.

### 2.4 Currency helpers (pre-Phase Z)

- `formatInrCurrency` in `packages/typescript/ui/src/formatting.ts` (line 9) — CONNECTED, uses `Intl.NumberFormat('en-IN', { currency: 'INR', style: 'currency' })`.
- `formatLiquidMoney` in `packages/theme-engine/src/theme-renderer.ts` (line 1146) — CONNECTED, minor-unit ÷ 100, `toLocaleString('en-IN')`, `currency` param defaults to `'INR'`.
- `cart` drop default `currency: 'INR'` in `buildLiquidCommerceDrops` (line 1034).
- `money` and `money_with_currency` Liquid filters both registered (line 1090–1091) — format-only, no conversion.

**Multi-currency reality:** `store_markets` table (stores-localization.ts) carries `currency`, `price_adjustment_bps`, `rounding_mode` fields — modeled but NOT wired to the render path. No live FX rate feed exists anywhere in the non-LCIS codebase (zero occurrences of `exchangeRate`, `exchange_rate`, `convertCurrency`). The canonical ledger (`create_checkout_order` and siblings) is fully INR; no cross-currency charging RPC exists. Phase Z's `formatThemeCurrencyDisplay` is presentational only and makes `fxConnected: false` explicit with a documented `fxNotConnectedReason`.

### 2.5 Translation persistence (`storefront_translations` table)

The existing `services/api-gateway/src/routes/stores-localization.ts` already defines `createTranslation`, `updateTranslation`, `deleteTranslation` operations that CRUD rows in the `storefront_translations` table. The `packages/typescript/api-client/src/index.ts` already exposes these methods. Phase Z's proxy routes call these via `createMerchantApiClient()` — no api-client source edit required.

---

## 3. Gaps Found in Discovery

### GAP-Z-01 — `DEFAULT_THEME_LOCALE` is bare `'en'`, not India-first `'en-IN'`

The pre-Phase-Z constant `DEFAULT_THEME_LOCALE = 'en'` at `theme-bundle.ts:652` does not reflect the platform's India-first mandate. Stores with `sites.locale = 'en-IN'` work correctly because the DB default and storefront assignment both use `'en-IN'`. But the constant itself is misleading and the fallback chain in `getThemeLocaleCandidates` terminates at bare `'en'` — skipping `'en-IN'` as a middle fallback when a locale-specific key is absent.

**Resolution in Phase Z (Lane A):** `packages/theme-engine/src/theme-locale.ts` introduces `THEME_DEFAULT_STORE_LOCALE = 'en-IN'` and a fallback chain `[locale, language-tag, 'en-IN', 'en']` so `en-IN` is always tried before bare `en`. The pre-Phase-Z `DEFAULT_THEME_LOCALE` constant in `theme-bundle.ts` is NOT modified (that constant is used internally by the bundle path; the new `tLocale` is additive). The existing `DEFAULT_THEME_LOCALE = 'en'` remains as-is in `theme-bundle.ts` for backward compatibility.

### GAP-Z-02 — No `tLocale` helper with India-first fallback chain, prototype safety, and explicit key validation

The pre-Phase-Z `resolveThemeTranslation` is internal to `theme-bundle.ts` (not exported) and the `translateLiquidKey` / `lookupTranslation` in `theme-renderer.ts` is private. Neither is available for external callers (e.g., the merchant editor, test suites). Phase Z adds `tLocale(key, locale, locales, replacements?)` as a standalone exported function with documented, tested semantics.

### GAP-Z-03 — No presentational multi-currency display helper with honest NOT-CONNECTED declaration

No single reusable function documents the `fxConnected: false` boundary while providing currency display. Phase Z adds `formatThemeCurrencyDisplay(amountMinorUnits, currencyCode, locale)` which is INR+en-IN-first (byte-identical to `formatLiquidMoney` on that path) and explicitly non-converting for other currencies.

### GAP-Z-04 — No merchant-facing translation editor in the control plane

Merchants have no UI to view or edit translation strings. The `storefront_translations` table and gateway endpoints exist but are unexposed. Phase Z adds a sibling route (`editor/translations/`) and five components to the merchant-control-plane theme editor.

### GAP-Z-05 — RISK-DUAL-N01 boundary must be maintained in translation editor

The translation editor must write to `storefront_translations` rows (`resource_type = 'theme'`) and MUST NOT write to `section_definitions` (RISK-DUAL-N01). The proxy routes enforce `resource_type: 'theme' as const`; the components carry RISK-DUAL-N01 JSDoc. Registered as guarded boundary, not an open risk.

---

## 4. Design Decisions

### 4.1 Fallback chain order

`buildCandidates(locale)` in `theme-locale.ts` deduplicates from `[normalized, language-tag, THEME_DEFAULT_STORE_LOCALE ('en-IN'), 'en']`. For most locales (e.g., `'hi-IN'` → `['hi-IN', 'hi', 'en-IN', 'en']`) this is correct. A known edge case exists for bare `'en'` input: `buildCandidates('en')` produces `['en', 'en-IN']` because `'en'` occupies the normalized position before `'en-IN'` in the dedup loop. This inverts India-first for stores whose `sites.locale` is bare `'en'`. Registered as RISK-Z01 (MEDIUM). See `PHASE_Z_SECURITY_REVIEW.md` §4 and `PHASE_Z_REPORT.md` §4.

### 4.2 Escaping responsibility split

- `tLocale` returns raw strings. No HTML encoding is applied.
- Liquid path: LiquidJS `outputEscape: 'escape'` auto-escapes `t` filter output at render. Safe.
- JSON-contract path: strings reach React components via `localizeThemeTemplateConfig`. React escapes text content automatically in JSX. The editor displays resolved strings as text. Safe.
- The translation editor displays locale values as `<textarea>` or `<input type="text">` — no `dangerouslySetInnerHTML`.

### 4.3 Proxy-layer tenancy

Both proxy routes (`/api/stores/[store]/localization/translations/`) call `resolveOwnedStoreId` before forwarding to the gateway via `createMerchantApiClient`. The pattern mirrors the Phase X and Phase Y proxy routes. The POST route does not validate that `body.resource_id` (themeId) belongs to the resolved `storeId` at the proxy layer — RISK-Z05 (LOW).

### 4.4 Default locale deletion guard

The DELETE proxy has no server-side guard preventing deletion of `en-IN` translation rows. The UI omits a delete button for the default locale (guard documented in `TranslationEditorClient` and `LocaleSwitcher`), but a direct `DELETE` call bypasses this. Registered as RISK-Z04 (LOW).

---

## 5. Files Changed Summary

| File | Action | Notes |
|------|--------|-------|
| `packages/theme-engine/src/theme-locale.ts` | NEW | Core locale/currency helpers |
| `packages/theme-engine/test/theme-locale.test.ts` | NEW | 32 locale tests (Z-L01..Z-L32) |
| `packages/theme-engine/test/theme-currency-display.test.ts` | NEW | 24 currency tests (Z-C01..Z-C24) |
| `packages/theme-engine/src/index.ts` | MODIFIED | 1 `export *` line |
| `apps/merchant-control-plane/src/components/theme-locale/LocaleSwitcher.tsx` | NEW | Locale dropdown |
| `apps/merchant-control-plane/src/components/theme-locale/TranslationKeyList.tsx` | NEW | Key-value list with missing-key detection |
| `apps/merchant-control-plane/src/components/theme-locale/TranslationValueEditor.tsx` | NEW | Inline key/value editor |
| `apps/merchant-control-plane/src/components/theme-locale/theme-locale.module.css` | NEW | CSS module, `--lb-*` tokens |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/translations/page.tsx` | NEW | Server component wrapper |
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/translations/TranslationEditorClient.tsx` | NEW | Client component orchestrator |
| `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/route.ts` | NEW | POST proxy |
| `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/[translationId]/route.ts` | NEW | PATCH + DELETE proxy |
| `apps/merchant-control-plane/tests/theme-editor-z.test.mjs` | NEW | 86 static-contract tests |
| `apps/merchant-control-plane/package.json` | MODIFIED | `theme-editor-z.test.mjs` appended to test script |
