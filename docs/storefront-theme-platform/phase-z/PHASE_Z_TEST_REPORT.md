# Phase Z — Test Report: Markets + Localization

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Z — Markets + Localization
**Date:** 2026-07-11
**Status:** ALL PASS

---

## 1. Lane A — theme-engine

**Command:** `pnpm --filter=@letbuyy/theme-engine typecheck test`
**Result:** PASS
**Typecheck:** 0 errors
**Tests:** 1525 total (1469 baseline + 56 new Phase Z) · 1525 pass · 0 fail · 0 skip
**All prior tests green.**

---

### 1.1 New Tests — `test/theme-locale.test.ts` (32 tests, Z-L01..Z-L32)

| ID | Description | Assertion |
|----|-------------|-----------|
| Z-L01 | `tLocale` resolves key in exact requested locale | Returns the value from the requested locale dictionary |
| Z-L02 | `tLocale` resolves key in `en-IN` when locale is `en-IN` | Returns correct value; `en-IN` is not double-resolved |
| Z-L03 | `tLocale` resolves nested key (`checkout.button`) | Dot-path traversal returns leaf string |
| Z-L04 | `tLocale` falls back to `en-IN` when locale key is absent | Returns `en-IN` value when requested locale has no entry for the key |
| Z-L05 | `tLocale` falls back to bare `en` when `en-IN` also missing | Returns `en` value as last resort |
| Z-L06 | `tLocale` returns key path (no `t:` prefix) when key not found anywhere | Returns `'general.title'` not `'t:general.title'` when all candidates miss |
| Z-L07 | `tLocale` returns key path when bundle has no locales | Empty `locales` → key path returned |
| Z-L08 | `tLocale` returns key path when locale is `null` and bundle empty | Null-safe; key path returned |
| Z-L09 | en-IN default: `tLocale` with `null` locale resolves via `en-IN` fallback | Same result as `tLocale(key, 'en-IN', bundle)` |
| Z-L10 | en-IN default: empty string locale resolves via `en-IN` | Same result as explicit `en-IN` call |
| Z-L11 | `en-IN` takes precedence over bare `en` when bundle has both | Returns `en-IN` value, not `en` value, when `storeLocale = 'en-IN'` |
| Z-L12 | `tLocale` returns raw string including HTML tags (escaping is render-layer responsibility) | `<b>bold</b>` returned as-is; not HTML-encoded |
| Z-L13 | `img-onerror` locale value returned raw (render layer escapes) | `onload=alert(1)` attribute string returned as-is; encoding is LiquidJS/React layer |
| Z-L14 | `tLocale` with `t:` prefix produces same result as without prefix | `tLocale('t:key', …) === tLocale('key', …)` |
| Z-L15 | `t:` prefix stripped in missing-key fallback too | Returns `'general.missing'` not `'t:general.missing'` |
| Z-L16 | `normalizeLocale` converts underscore to hyphen | `'hi_IN'` → `'hi-IN'` |
| Z-L17 | `normalizeLocale` uppercases region tag | `'en-in'` → `'en-IN'` |
| Z-L18 | `normalizeLocale` returns `en-IN` for null/undefined/empty | All three inputs → `'en-IN'` |
| Z-L19 | `tLocale` accepts underscore locale (`hi_IN`) and resolves correctly | `'hi_IN'` normalised to `'hi-IN'`; looks up `locales['hi-IN']` |
| Z-L20 | Fallback order: language-tag tried before `en-IN` | `'hi-IN'` → tries `'hi'` before `'en-IN'` |
| Z-L21 | Fallback order: `en-IN` tried before bare `en` | For non-English locales: `en-IN` bucket wins over bare `en` when both present |
| Z-L22 | Invalid key with angle bracket is returned as-is (never crash) | `'<script>alert'` returned unchanged |
| Z-L23 | Key with colon (other than `t:`) is returned as-is | `'my:key'` returned unchanged (colon not a valid second character) |
| Z-L24 | Empty key is returned as-is | `''` returned as `''` |
| Z-L25 | Key with only `t:` prefix (empty after strip) is returned as-is | `'t:'` stripped to `''`; `''` returned |
| Z-L26 | `tLocale` interpolates `{{ varname }}` placeholders | `replacements = { count: 5 }` → `'You have 5 items'` |
| Z-L27 | `tLocale` leaves unmatched placeholders unchanged | `{{ unknown }}` left as `'{{ unknown }}'` in output |
| Z-L28 | `tLocale` with numeric replacement coerced to string | `replacements = { count: 42 }` → `'42'` inserted |
| Z-L29 | Key with `__proto__` segment returns key path safely (no crash) | `'__proto__.polluted'` → returns key path; no prototype mutation |
| Z-L30 | Key segment equal to `constructor` returns key path (blocked segment) | `'a.constructor.name'` → returns key path; no crash |
| Z-L31 | `tLocale` is deterministic (same inputs always same output) | Two identical calls return `===` equal strings |
| Z-L32 | `THEME_DEFAULT_STORE_LOCALE` constant is `'en-IN'` | `THEME_DEFAULT_STORE_LOCALE === 'en-IN'` |

---

### 1.2 New Tests — `test/theme-currency-display.test.ts` (24 tests, Z-C01..Z-C24)

| ID | Description | Assertion |
|----|-------------|-----------|
| Z-C01 | INR + `en-IN`: byte-identical to `formatLiquidMoney` for a typical price (749900 paise) | `formatThemeCurrencyDisplay(749900) === formatLiquidMoney(749900, 'INR')` |
| Z-C02 | INR + `en-IN`: byte-identical for ₹0 | `formatThemeCurrencyDisplay(0) === formatLiquidMoney(0, 'INR')` |
| Z-C03 | INR + `en-IN`: byte-identical for large amount (9999999 paise) | Both produce the same `₹99,999.99`-style string |
| Z-C04 | INR + `en-IN`: byte-identical for 100 paise (₹1.00) | `formatThemeCurrencyDisplay(100) === formatLiquidMoney(100, 'INR')` |
| Z-C05 | INR always uses `en-IN` number formatting regardless of `locale` argument | Passing `locale = 'en-US'` still produces `en-IN` formatted INR output |
| Z-C06 | Non-INR currency uses the requested currency code as prefix | `formatThemeCurrencyDisplay(100000, 'USD')` result contains `'USD'` |
| Z-C07 | Non-INR: amount is INR minor units / 100 (no conversion applied) | `formatThemeCurrencyDisplay(100000, 'USD').formatted` represents `1000.00` major units |
| Z-C08 | Non-INR result still has 2 decimal places | Result contains `.00` or two-digit decimal |
| Z-C09 | `fxConnected` is always `false` | `result.fxConnected === false` |
| Z-C10 | `fxNotConnectedReason` is always a non-empty string | `result.fxNotConnectedReason.length > 0` |
| Z-C11 | `fxNotConnectedReason` mentions missing FX source | String contains `'NOT-CONNECTED'` or `'FX'` or `'exchange'` |
| Z-C12 | Minor-unit to major-unit conversion: 749900 / 100 = 7499.00 | Numeric precision correct |
| Z-C13 | Minor-unit to major-unit conversion: 1 paise = ₹0.01 | 1 / 100 = 0.01; minimum fraction digits = 2 |
| Z-C14 | Minor-unit to major-unit conversion: 50 paise = ₹0.50 | 50 / 100 = 0.50 |
| Z-C15 | `formatThemeCurrencyDisplay` is a pure function (no side effects) | Calling it 100 times with the same input produces the same output without mutation |
| Z-C16 | `NaN` input formats as `0.00` (same as `formatLiquidMoney`) | `formatThemeCurrencyDisplay(NaN).formatted` represents ₹0.00 |
| Z-C17 | `Infinity` input formats as `0.00` | `formatThemeCurrencyDisplay(Infinity).formatted` represents ₹0.00 |
| Z-C18 | Non-numeric string input formats as `0.00` | `formatThemeCurrencyDisplay('abc' as any).formatted` represents ₹0.00 |
| Z-C19 | Invalid currency code (lowercase `inr`) falls back to `INR` | Result is formatted as INR |
| Z-C20 | Invalid currency code (too short: `'I'`) falls back to `INR` | Result is formatted as INR |
| Z-C21 | `null` currency code falls back to `INR` | `formatThemeCurrencyDisplay(100, null)` formats as INR |
| Z-C22 | `formatThemeCurrencyDisplay` is deterministic (same inputs same output) | Repeated calls return identical objects |
| Z-C23 | Default locale argument is `en-IN` (India-first) | `formatThemeCurrencyDisplay(100).formatted` uses `en-IN` formatting |
| Z-C24 | Default currency argument is `INR` (India-first) | `formatThemeCurrencyDisplay(100)` formats as INR without specifying currency |

---

## 2. Lane B — merchant-control-plane

**Command:** `pnpm --filter @letbuyy/merchant-control-plane typecheck test`
**Result:** PASS
**Typecheck:** 0 errors
**Tests (theme-editor suite):** 533 pass (447 baseline + 86 new Phase Z) · 0 fail

---

### 2.1 New Tests — `tests/theme-editor-z.test.mjs` (86 tests)

#### File existence (9 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: LocaleSwitcher.tsx exists in theme-locale components` | File at expected path |
| `phase-z: TranslationKeyList.tsx exists in theme-locale components` | File at expected path |
| `phase-z: TranslationValueEditor.tsx exists in theme-locale components` | File at expected path |
| `phase-z: TranslationEditorClient.tsx exists alongside translations/page.tsx` | File at expected path |
| `phase-z: translations/page.tsx exists as sibling route to editor/page.tsx` | File exists; `editor/page.tsx` distinct |
| `phase-z: editor/page.tsx is NOT modified (foreign WIP isolation)` | `editor/page.tsx` mtime unchanged / content matches baseline |
| `phase-z: translation POST proxy route exists` | Route file at expected path |
| `phase-z: translation PATCH/DELETE proxy route exists` | Route file at expected path |
| `phase-z: theme-locale.module.css exists` | CSS module at expected path |

#### India-first proof (7 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: LocaleSwitcher re-exports DEFAULT_ADMIN_LOCALE (en-IN is the default)` | Source contains `DEFAULT_ADMIN_LOCALE` export |
| `phase-z: LocaleSwitcher re-exports SUPPORTED_ADMIN_LOCALES (locale list)` | Source contains `SUPPORTED_ADMIN_LOCALES` export |
| `phase-z: TranslationEditorClient initialises selectedLocale to DEFAULT_ADMIN_LOCALE (India-first)` | Source contains `useState(DEFAULT_ADMIN_LOCALE)` pattern |
| `phase-z: TranslationKeyList uses DEFAULT_ADMIN_LOCALE as default reference locale` | Source contains `DEFAULT_ADMIN_LOCALE` in `buildLocaleMap` comparison |
| `phase-z: TranslationEditorClient passes defaultLocale=DEFAULT_ADMIN_LOCALE to TranslationKeyList` | JSX prop `defaultLocale={DEFAULT_ADMIN_LOCALE}` present |
| `phase-z: admin-locales.ts defines DEFAULT_ADMIN_LOCALE as en-IN` | Source contains `DEFAULT_ADMIN_LOCALE = 'en-IN'` or `"en-IN"` |
| `phase-z: default locale cannot be deleted — guard documented in TranslationEditorClient or LocaleSwitcher` | Source contains deletion guard or `India-first` comment |

#### Missing-key detection (3 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: TranslationKeyList detects missing keys (key in default but absent in selected locale)` | Source contains missing-key comparison logic |
| `phase-z: TranslationKeyList shows a Missing badge for absent keys` | Badge/indicator element present in source |
| `phase-z: TranslationKeyList missing badge has aria-label (a11y)` | Badge element has `aria-label` attribute |

#### RISK-DUAL-N01 (10 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: TranslationKeyList buildLocaleMap scopes to resource_type = theme` | Source contains `resource_type.*theme` pattern |
| `phase-z: TranslationValueEditor documents RISK-DUAL-N01` | Source contains `RISK-DUAL-N01` comment |
| `phase-z: TranslationEditorClient documents RISK-DUAL-N01` | Source contains `RISK-DUAL-N01` comment |
| `phase-z: TranslationKeyList documents RISK-DUAL-N01` | Source contains `RISK-DUAL-N01` comment |
| `phase-z: TranslationValueEditor writes resource_type: theme (never section_definitions)` | Source contains `resource_type.*theme` and no `section_definitions` assignment |
| `phase-z: TranslationValueEditor does not assign to section_definitions (RISK-DUAL-N01)` | No `section_definitions =` in source |
| `phase-z: TranslationEditorClient does not assign to section_definitions (RISK-DUAL-N01)` | No `section_definitions =` in source |
| `phase-z: TranslationKeyList onEdit always passes resource_type: theme (RISK-DUAL-N01)` | `onEdit` call includes `resource_type: 'theme'` |
| `phase-z: translation POST proxy documents RISK-DUAL-N01` | Source contains `RISK-DUAL-N01` comment |
| `phase-z: translation PATCH/DELETE proxy documents RISK-DUAL-N01` | Source contains `RISK-DUAL-N01` comment |

#### Tenancy compliance (10 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: translation POST proxy imports resolveOwnedStoreId (tenancy law)` | Import present |
| `phase-z: translation PATCH/DELETE proxy imports resolveOwnedStoreId (tenancy law)` | Import present |
| `phase-z: translation POST proxy uses createMerchantApiClient` | Import present |
| `phase-z: translation PATCH/DELETE proxy uses createMerchantApiClient` | Import present |
| `phase-z: translation POST proxy uses resolved.storeId` | Source contains `resolved.storeId` |
| `phase-z: translation PATCH/DELETE proxy uses resolved.storeId` | Source contains `resolved.storeId` |
| `phase-z: proxy routes do not import Supabase directly` | No `@supabase/` or `supabaseAdmin` import in proxy files |
| `phase-z: LocaleSwitcher imports from @letbuyy/ui (design token compliance)` | Import present |
| `phase-z: TranslationKeyList imports from @letbuyy/ui` | Import present |
| `phase-z: TranslationValueEditor imports from @letbuyy/ui` | Import present |

#### Design ratchet (8 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: LocaleSwitcher has no raw rounded-[Npx] Tailwind classes` | No `rounded-[` pattern in source |
| `phase-z: TranslationKeyList has no raw rounded-[Npx] Tailwind classes` | No `rounded-[` pattern |
| `phase-z: TranslationValueEditor has no raw rounded-[Npx] Tailwind classes` | No `rounded-[` pattern |
| `phase-z: TranslationEditorClient has no raw rounded-[Npx] Tailwind classes` | No `rounded-[` pattern |
| `phase-z: theme-locale.module.css uses --lb-* design tokens` | Source contains `var(--lb-` |
| `phase-z: theme-locale.module.css has no raw rounded-[Npx] values` | No `rounded-[` in CSS |
| `phase-z: CSS module defines localeSwitcherRoot class` | Class name present |
| `phase-z: CSS module defines translationKeyList class` | Class name present |

#### Foreign WIP isolation (8 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: LocaleSwitcher does not import from editor/page.tsx (foreign WIP)` | No `page` import from editor path |
| `phase-z: TranslationKeyList does not import from editor/page.tsx` | No such import |
| `phase-z: TranslationValueEditor does not import from editor/page.tsx` | No such import |
| `phase-z: TranslationEditorClient does not import from editor/page.tsx` | No such import |
| `phase-z: no component imports globals.css (foreign WIP)` | No `globals.css` import in new components |
| `phase-z: no component imports from @letbuyy/api-client directly (foreign WIP)` | No direct `@letbuyy/api-client` import |
| `phase-z: no component imports ExperiencePicker (foreign WIP)` | No `ExperiencePicker` import |
| `phase-z: proxy routes do not import from api-client/src/index directly` | No direct path import |

#### Accessibility (10 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: LocaleSwitcher has role=region + aria-label (a11y)` | `role="region"` and `aria-label` present |
| `phase-z: TranslationKeyList has role=list + aria-label on the list (a11y)` | `role="list"` and `aria-label` present |
| `phase-z: TranslationKeyList edit/add button has aria-label (a11y)` | Edit button has `aria-label` |
| `phase-z: TranslationValueEditor save button has aria-label (a11y)` | Save button has `aria-label` |
| `phase-z: TranslationValueEditor cancel button has aria-label (a11y)` | Cancel button has `aria-label` |
| `phase-z: TranslationValueEditor handles Escape key to cancel editing (a11y)` | `Escape` key handler present |
| `phase-z: TranslationEditorClient has aria-label on root container (a11y)` | Root element has `aria-label` |
| `phase-z: TranslationKeyList has a loading state (aria-busy)` | `aria-busy` present in loading branch |
| `phase-z: TranslationKeyList has an error state (role=alert)` | `role="alert"` in error branch |
| `phase-z: TranslationKeyList has an empty state` | Empty state branch present |

#### Sandbox law (3 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: TranslationValueEditor has no dangerouslySetInnerHTML (SANDBOX LAW)` | No `dangerouslySetInnerHTML` in source |
| `phase-z: TranslationEditorClient has no dangerouslySetInnerHTML` | No `dangerouslySetInnerHTML` in source |
| `phase-z: TranslationKeyList has no dangerouslySetInnerHTML` | No `dangerouslySetInnerHTML` in source |

#### Proxy handler exports and behaviour (14 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: translation POST proxy exports POST handler` | `export.*POST` present |
| `phase-z: translation PATCH proxy exports PATCH handler` | `export.*PATCH` present |
| `phase-z: translation DELETE proxy exports DELETE handler` | `export.*DELETE` present |
| `phase-z: translation POST proxy calls createTranslation on the api-client` | `createTranslation` call present |
| `phase-z: translation PATCH proxy calls updateTranslation on the api-client` | `updateTranslation` call present |
| `phase-z: translation DELETE proxy calls deleteTranslation on the api-client` | `deleteTranslation` call present |
| `phase-z: translations/page.tsx is NOT a client component (server component wrapper)` | No `'use client'` at top of file |
| `phase-z: translations/page.tsx renders TranslationEditorClient` | `TranslationEditorClient` JSX present |
| `phase-z: translations/page.tsx fetches from /api/stores (same-origin proxy, not gateway direct)` | Source contains `/api/stores` fetch, not gateway URL |
| `phase-z: translations/page.tsx does not touch money ledger` | No money ledger RPC references |
| `phase-z: TranslationValueEditor does not reference the canonical money ledger` | No `create_checkout_order` or money table reference |
| `phase-z: TranslationEditorClient does not reference the canonical money ledger` | No money ledger reference |
| `phase-z: TranslationEditorClient has an error state (role=alert)` | `role="alert"` in error branch |
| `phase-z: TranslationEditorClient has a loading state (aria-busy)` | `aria-busy` in loading branch |

#### Additional CSS and package checks (4 tests)

| Test | Assertion |
|------|-----------|
| `phase-z: CSS module defines translationEditorRoot class` | Class name present |
| `phase-z: CSS module defines translationValueEditorRoot class` | Class name present |
| `phase-z: TranslationEditorClient imports from @letbuyy/ui` | Import present |
| `phase-z: package.json test command includes theme-editor-z.test.mjs` | Script string present |

---

## 3. Unchanged Packages

| Package | Gate | Result |
|---------|------|--------|
| api-gateway | 519 pass (522 total; 3 pre-existing fail) | UNCHANGED |
| storefront-runtime | 795/795 | UNCHANGED |
| All typechecks | Clean | UNCHANGED |

No new npm dependencies added. No new migrations. `validate-governance.mjs` EXIT=1 (pre-existing tenant-registry drift only; anti-fabrication PASS — unchanged).

---

## 4. Pre-existing Failures (Unchanged)

- **api-gateway:** 3 pre-existing failures (unrelated to Phase Z scope).
- **merchant-control-plane:** 27 pre-existing DB-migration failures (unrelated to Phase Z scope).

These failures were present before Phase Z began and are unchanged by Phase Z work.
