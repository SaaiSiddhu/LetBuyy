# Localization Reference

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase introduced:** Z — Markets + Localization
**Date:** 2026-07-11
**Status:** PRODUCTION (Phase Z COMPLETE)

---

## 1. Overview

The LetBuyy theme localization system has three parallel paths, each suited to a different rendering context. All three are India-first: the default locale is `'en-IN'`, not bare `'en'`.

| Path | Where | Entry point | Escaping |
|------|-------|-------------|---------|
| JSON-contract | React section components | `localizeThemeTemplateConfig` | React auto-escapes JSX text |
| Liquid filter | LiquidJS templates | `{{ 't:key' \| t }}` | LiquidJS `outputEscape:'escape'` |
| `tLocale` helper | External callers; editor; tests | `tLocale(key, locale, locales)` | Caller responsibility |

---

## 2. Locale Model

### 2.1 Bundle structure

Every theme bundle (`LiquidThemePackageBundleSchema`, `ThemePackageBundleSchema`) may carry a `locales` field:

```typescript
locales: Record<string, ThemeBundleLocale>
// ThemeBundleLocale = Record<string, ThemeBundleJson> (arbitrary nested JSON)
```

Keys are locale strings (e.g., `'en-IN'`, `'hi-IN'`, `'en'`). Values are nested JSON objects where leaf strings are translation values.

**Example:**
```json
{
  "en-IN": {
    "general": {
      "cart": "Cart",
      "checkout": "Checkout"
    },
    "product": {
      "add_to_cart": "Add to cart",
      "out_of_stock": "Out of stock"
    }
  },
  "hi-IN": {
    "general": {
      "cart": "कार्ट"
    }
  }
}
```

### 2.2 Translation key format

Translation keys use dot-path notation and may optionally be prefixed with `t:`:

```
checkout.button        → resolves to locales[locale].checkout.button
t:general.cart         → identical to general.cart (prefix stripped)
t:product.add_to_cart  → resolves to locales[locale].product.add_to_cart
```

### 2.3 Constants

| Constant | Value | Location | Notes |
|----------|-------|----------|-------|
| `THEME_DEFAULT_STORE_LOCALE` | `'en-IN'` | `packages/theme-engine/src/theme-locale.ts` | India-first; use in new code |
| `DEFAULT_THEME_LOCALE` | `'en'` | `packages/theme-engine/src/theme-bundle.ts:652` | Pre-Phase-Z; retained for backward compat |
| `THEME_TRANSLATION_PREFIX` | `'t:'` | `packages/theme-engine/src/theme-bundle.ts:653` | Prefix stripped before lookup |
| `DEFAULT_ADMIN_LOCALE` | `'en-IN'` | `apps/merchant-control-plane/src/components/theme-locale/LocaleSwitcher.tsx` | Editor default locale |

---

## 3. Locale Selection

`sites.locale` is the single source of truth for a store's locale. It flows into the render path as `storeLocale`.

| Step | Code location | Value |
|------|--------------|-------|
| Store creation | `services/api-gateway/src/routes/stores.ts:686` | Defaults to `'en-IN'` |
| Normalization | `services/api-gateway/src/routes/stores-localization.ts:114-117` | Fallback to `'en-IN'` |
| Storefront hydration | `apps/storefront-runtime/src/lib/store-service.ts:504,558` | `storeLocale = data.locale \|\| 'en-IN'` |
| JSON-contract | `store-service.ts:574` | `localizeThemeTemplateConfig(config, storeLocale)` |
| Liquid | `theme-renderer.ts:563,687` | `createLiquidEngine(bundle, { locale: input.context.locale \|\| 'en' })` |

**No per-request locale override exists today.** `Accept-Language` header is not read for storefront rendering. The locale is static per store, not dynamic per request.

---

## 4. `tLocale` Helper (Phase Z)

### 4.1 Signature

```typescript
function tLocale(
    key: string,
    locale: string | null | undefined,
    locales: Record<string, unknown> | null | undefined,
    replacements?: Record<string, string | number>
): string
```

### 4.2 Behaviour

1. Strip `t:` prefix from `key` if present.
2. Validate key charset. Invalid keys (empty, non-alpha start, illegal chars including angle brackets) are returned as-is. Never crashes.
3. Normalize `locale` via `normalizeLocale(locale)` → converts `null`/undefined/empty to `'en-IN'`; converts underscores to hyphens; uppercases region tag.
4. Build candidate list: `[normalizedLocale, languageTag, 'en-IN', 'en']` — deduplicated, preserving first-occurrence order.
5. For each candidate: look up `locales[candidate]` and traverse the dot-path segments via `lookupPath`.
6. `lookupPath` checks every segment against `BLOCKED_PATH_SEGMENTS = { '__proto__', 'constructor', 'prototype' }`. Blocked segments return `undefined`, causing fallback to the next candidate.
7. On first match: apply `{{ varname }}` interpolation from `replacements`.
8. On total miss: return the key path (without the `t:` prefix).

### 4.3 Fallback chain examples

| Input locale | Candidates tried (in order) |
|-------------|---------------------------|
| `'hi-IN'` | `hi-IN` → `hi` → `en-IN` → `en` |
| `'en-IN'` | `en-IN` → (dedup skips `en` language tag separately) → `en-IN` (already tried) → `en` |
| `'mr-IN'` | `mr-IN` → `mr` → `en-IN` → `en` |
| `null` | `en-IN` → `en` |
| `'en'` | `en` → `en-IN` → (bare `en` already at 0; `en-IN` at 1) — **RISK-Z01: bare `en` wins over `en-IN`** |

### 4.4 Known limitation — RISK-Z01

For `locale = 'en'` (bare), the dedup loop places `'en'` at index 0 and `'en-IN'` at index 1. A bundle with both `'en'` and `'en-IN'` dictionaries will have the bare `'en'` value returned when `locale='en'`. The intent is for `'en-IN'` to win. This affects stores whose `sites.locale = 'en'` (bare). The DB default on store creation is `'en-IN'`; most stores are unaffected. See RISK-Z01.

### 4.5 Interpolation

After a key is resolved, `{{ varname }}` placeholders are replaced with values from `replacements`:

```typescript
tLocale(
    'cart.items_count',
    'en-IN',
    { 'en-IN': { cart: { items_count: 'You have {{ count }} item(s)' } } },
    { count: 3 }
)
// → 'You have 3 item(s)'
```

Unmatched placeholders are left unchanged. Numeric `replacements` values are coerced to strings.

### 4.6 Escaping contract

`tLocale` returns raw strings. It does NOT apply HTML encoding. The caller is responsible for escaping:
- **Liquid path:** LiquidJS `outputEscape: 'escape'` auto-escapes `t` filter output at the engine level.
- **React path:** JSX text content is auto-escaped by React.
- **Custom callers:** must escape if injecting into HTML context.

---

## 5. JSON-Contract Path — `localizeThemeTemplateConfig`

**Source:** `packages/theme-engine/src/theme-bundle.ts`

`localizeThemeTemplateConfig(config, storeLocale)` walks the entire resolved template config tree (section settings, block settings, global settings) before it is passed to React section components. Any string value starting with `t:` is replaced in-place.

Missing keys: the `t:key.path` literal is preserved (the original string is returned unchanged).

This function is called once per storefront render at `store-service.ts:574`. It runs on the server (Next.js server component / getServerSideProps context) before hydration.

---

## 6. Liquid Path — `t` Filter

**Source:** `packages/theme-engine/src/theme-renderer.ts` (lines 1089–1096, 1118–1136)

Registration: `registerLetbuyyLiquidFilters` registers `translateLiquidKey` as the `t` filter.

**Usage in Liquid templates:**
```liquid
{{ 'general.cart' | t }}
{{ 't:product.add_to_cart' | t }}
{{ 'cart.items_count' | t: count: cart.item_count }}
```

**Fallback chain (Liquid path):** `[locale, locale.split('-')[0], 'en']` — note: terminates at bare `'en'`, not `'en-IN'`. This is the pre-Phase-Z behaviour, unchanged. For most stores (`locale = 'en-IN'`): tries `'en-IN'` first, then `'en'`.

**Missing key:** returns the key string itself (not `undefined`).

**Security:** all `t` filter output is auto-escaped by LiquidJS `outputEscape: 'escape'`. A locale value containing `<script>alert(1)</script>` is rendered as `&lt;script&gt;alert(1)&lt;/script&gt;`.

---

## 7. Currency Display

### 7.1 INR + en-IN (India-first, CONNECTED)

| Helper | Location | Description |
|--------|----------|-------------|
| `formatInrCurrency` | `packages/typescript/ui/src/formatting.ts` | `Intl.NumberFormat('en-IN', { currency: 'INR', style: 'currency' })` |
| `formatLiquidMoney` | `packages/theme-engine/src/theme-renderer.ts:1146` | `amountMinorUnits / 100`, `toLocaleString('en-IN')` |
| `formatThemeCurrencyDisplay` (INR) | `packages/theme-engine/src/theme-locale.ts` | Byte-identical to `formatLiquidMoney` for INR+en-IN; use for new code |
| `money` Liquid filter | registered in `theme-renderer.ts:1090` | Calls `formatLiquidMoney`; format-only, no conversion |
| `money_with_currency` Liquid filter | registered in `theme-renderer.ts:1091` | Calls `formatLiquidMoney`; includes currency label |
| Cart drop `currency: 'INR'` | `buildLiquidCommerceDrops:1034` | Passed to Liquid scope |

**Number formatting:** en-IN grouping uses South Asian style (e.g., `₹7,499.00` for 749900 paise; `₹1,00,000.00` for 10000000 paise).

### 7.2 Multi-currency display (presentational only, FX NOT-CONNECTED)

`formatThemeCurrencyDisplay(amountMinorUnits, currencyCode?, locale?)`:

```typescript
const result = formatThemeCurrencyDisplay(749900, 'USD', 'en-US');
// result.formatted   → '1000.00 USD' (display only; no FX applied)
// result.fxConnected → false (literal type, always false)
// result.fxNotConnectedReason → 'No live FX rate source: store_markets.currency is modelled but not wired to the render path; no exchange rate table exists; create_checkout_order is fully INR.'
```

**What NOT-CONNECTED means:**
- `store_markets.currency` / `price_adjustment_bps` / `rounding_mode` are database columns that exist but are not read by any render path.
- No live FX rate feed exists in the codebase (zero `exchangeRate`, `exchange_rate`, `convertCurrency` occurrences in non-LCIS source).
- The canonical ledger (`create_checkout_order` and all money RPCs) is fully INR. `formatThemeCurrencyDisplay` NEVER touches the ledger.

**Calling convention:**
```typescript
import { formatThemeCurrencyDisplay, THEME_DEFAULT_STORE_LOCALE } from '@letbuyy/theme-engine';

// INR display (default, India-first)
const { formatted } = formatThemeCurrencyDisplay(749900);
// → '₹7,499.00'

// Non-INR display-only (presentational label)
const { formatted, fxConnected } = formatThemeCurrencyDisplay(749900, 'USD');
// formatted → '1000.00 USD' (or similar; no guaranteed format for non-INR)
// fxConnected → false (always)
```

---

## 8. Translation Editor (Phase Z UI)

### 8.1 Route

`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/translations/`

This route is a sibling to `editor/page.tsx`. It does not modify `editor/page.tsx`.

### 8.2 Components

| Component | File | Description |
|-----------|------|-------------|
| `LocaleSwitcher` | `src/components/theme-locale/LocaleSwitcher.tsx` | Locale dropdown; `DEFAULT_ADMIN_LOCALE = 'en-IN'` |
| `TranslationKeyList` | `src/components/theme-locale/TranslationKeyList.tsx` | Key/value list with missing-key detection |
| `TranslationValueEditor` | `src/components/theme-locale/TranslationValueEditor.tsx` | Inline key/value editor |
| `TranslationEditorClient` | `editor/translations/TranslationEditorClient.tsx` | Client component orchestrator |
| `page.tsx` (server) | `editor/translations/page.tsx` | Server component wrapper |

### 8.3 Write boundary (RISK-DUAL-N01)

All writes via the translation editor set `resource_type: 'theme' as const`. The editor NEVER writes to `section_definitions` or `block_definitions`. This boundary is:
1. Enforced by the proxy route (`resource_type: 'theme'`).
2. Documented in JSDoc in every component.
3. Enforced at the data layer: `storefront_translations` rows carry `resource_type` and `section_definitions` is a `ThemeDocument` field, not a `storefront_translations` column.

### 8.4 Proxy routes

| Method | Path | Gateway call |
|--------|------|-------------|
| `POST` | `/api/stores/[store]/localization/translations` | `api.createTranslation` |
| `PATCH` | `/api/stores/[store]/localization/translations/[translationId]` | `api.updateTranslation` |
| `DELETE` | `/api/stores/[store]/localization/translations/[translationId]` | `api.deleteTranslation` |

All proxy routes use `resolveOwnedStoreId` → `createMerchantApiClient`. No direct Supabase access. No direct gateway URL access from the browser.

### 8.5 Missing-key detection

`TranslationKeyList` compares the set of keys in `DEFAULT_ADMIN_LOCALE` (`'en-IN'`) against the set of keys in `selectedLocale`. A key is "missing" if it exists in the `en-IN` reference dictionary but has no entry in the selected locale's `storefront_translations` rows. Missing keys are shown with a visible badge (with `aria-label`) so merchants can prioritise which keys to translate.

---

## 9. Open Risks

| Risk ID | Severity | Summary | Target |
|---------|----------|---------|--------|
| RISK-Z01 | MEDIUM | `buildCandidates('en')` puts bare `'en'` before `'en-IN'` — India-first inverted for stores with `sites.locale='en'` | Phase AA |
| RISK-Z02 | LOW | Pre-existing `lookupTranslation` in `theme-renderer.ts` lacks BLOCKED_PATH_SEGMENTS guard | Earliest phase touching `theme-renderer.ts` |
| RISK-Z03 | LOW | Translation POST proxy does not validate `resource_type` at proxy layer | Phase AA |
| RISK-Z04 | LOW | DELETE proxy has no server-side guard against deleting `en-IN` default-locale rows | Phase AA |
| RISK-Z05 | LOW | POST proxy does not verify `resource_id` (themeId) belongs to resolved `storeId` | Phase AA |
| RISK-Z06 | LOW | Gateway `deleteTranslation` handler has no locale guard | Phase AA |

---

## 10. Quick Reference

```
# Use in theme-engine consumers
import {
    THEME_DEFAULT_STORE_LOCALE,   // 'en-IN'
    normalizeLocale,
    tLocale,
    formatThemeCurrencyDisplay,
    ThemeCurrencyDisplayResult
} from '@letbuyy/theme-engine';

# Liquid template
{{ 'general.cart' | t }}
{{ 'product.price' | t }}  {# + Liquid money filter for the price value #}

# JSON-contract (pre-resolved; transparent to section components)
# Strings in template config beginning with 't:' are auto-resolved
# before reaching React section components.

# Currency display (INR, India-first)
const { formatted } = formatThemeCurrencyDisplay(amountMinorUnits);
// → '₹7,499.00' for 749900

# Currency display (non-INR, presentational only)
const { formatted, fxConnected } = formatThemeCurrencyDisplay(amountMinorUnits, 'USD');
// formatted: display string; fxConnected: false (always)
```
