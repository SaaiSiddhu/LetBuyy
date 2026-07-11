# Phase Z — Security Review: Translation Sanitisation, Money Safety, and India-First Proof

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Z — Markets + Localization
**Date:** 2026-07-11
**Reviewer:** Phase Z documentation pass (ground-truth verified)
**Status:** REVIEW COMPLETE — 1 MEDIUM + 5 LOW findings open; Hardening: null

---

## 1. Escaping and Sanitisation Contract

### 1.1 Liquid path

All `t` filter output passes through LiquidJS `outputEscape: 'escape'` at the engine level. This is enforced by the engine configuration in `createLiquidEngine` (`packages/theme-engine/src/theme-renderer.ts`). **Phase Z does not modify this configuration.**

`tLocale(key, locale, locales)` returns raw strings. It does not apply HTML encoding. The Liquid engine escapes the returned string before it reaches the rendered HTML. An adversarial locale value containing `<script>` would be emitted as `&lt;script&gt;`. No test vector can inject executable HTML through the `t` filter.

### 1.2 JSON-contract path

`localizeThemeTemplateConfig` replaces `t:key.path` strings in the JSON-contract template config tree before the config reaches React section components. React JSX auto-escapes text content when interpolated inside elements. `tLocale` values injected via `{value}` in JSX are safe.

If a React component unsafely uses `dangerouslySetInnerHTML` with a locale value, that is a separate component-level concern. Phase Z introduces no new `dangerouslySetInnerHTML` usage in any component.

### 1.3 Translation editor path

The merchant-facing translation editor (`TranslationKeyList`, `TranslationValueEditor`, `TranslationEditorClient`) displays locale key-value pairs in `<textarea>` and `<input type="text">` elements. No `dangerouslySetInnerHTML` or `innerHTML` is used in any Phase Z component. Static-contract test: `phase-z: TranslationValueEditor has no dangerouslySetInnerHTML (SANDBOX LAW)` confirms this at the code level.

---

## 2. Prototype Safety in `tLocale`

### 2.1 Design

`packages/theme-engine/src/theme-locale.ts` defines:

```typescript
const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function lookupPath(obj: unknown, segments: string[]): string | undefined {
    let current: unknown = obj;
    for (const segment of segments) {
        if (BLOCKED_PATH_SEGMENTS.has(segment)) return undefined;
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === 'string' ? current : undefined;
}
```

A key `'__proto__.polluted'` would have segments `['__proto__', 'polluted']`. The guard fires on `'__proto__'` and returns `undefined`, causing `tLocale` to fall back to the next candidate locale or, ultimately, return the key path string. No prototype mutation occurs. Tests Z-L29 and Z-L30 assert this behaviour.

### 2.2 Scope of protection

This guard applies to the `tLocale` / `lookupPath` path introduced in Phase Z. The pre-existing `lookupTranslation` in `packages/theme-engine/src/theme-renderer.ts` (lines 1118–1136) was NOT modified by Phase Z. It traverses dot-path segments without a `BLOCKED_PATH_SEGMENTS` check. This is a pre-existing gap registered as RISK-Z02. Impact is bounded: read-only access on first-party bundles where keys arrive from `LiquidThemePackageBundleSchema.parse`; no write path. Defence-in-depth improvement deferred to earliest phase touching `theme-renderer.ts`.

### 2.3 Key charset validation

Phase Z's `tLocale` validates the key (after stripping the `t:` prefix) against a charset guard. Keys containing characters that cannot form valid JSON path segments (e.g., keys with a leading digit after a dot, keys with only the `t:` prefix, empty keys) are returned as-is without lookup. This prevents unexpected traversal of numeric-index arrays or other non-string-keyed structures. Tests Z-L22..Z-L25 cover the edge cases.

---

## 3. Money Safety

### 3.1 Canonical ledger isolation

Phase Z introduces `formatThemeCurrencyDisplay` as a **presentational-only** helper. It:

1. Divides `amountMinorUnits` by 100 to obtain major units.
2. Formats the result using `Intl.NumberFormat` (or `toLocaleString` for the INR path).
3. Returns `{ formatted, fxConnected: false, fxNotConnectedReason }`.

**It does not:**
- Call any RPC or DB function.
- Modify `payment_transactions`, `orders`, `order_items`, `gift_card_accounts`, `gift_card_ledger_entries`, or any other money table.
- Import from any money-domain package or service.
- Apply any FX conversion.

The `canonical-ledger-only-validator` forbids `.from(money_table).insert/update` in TypeScript. Phase Z does not add any such call. Static-contract tests assert: `phase-z: TranslationValueEditor does not reference the canonical money ledger` and `phase-z: translations/page.tsx does not touch money ledger`.

### 3.2 `fxConnected: false` honesty

`ThemeCurrencyDisplayResult.fxConnected` is typed as `false` (a literal type, not `boolean`). Any caller that checks `if (result.fxConnected)` will always take the false branch. `fxNotConnectedReason` is a non-empty string documenting the exact missing source (no live FX rate feed; `store_markets.currency` modelled but not wired to render path; `create_checkout_order` is fully INR). Tests Z-C09..Z-C11 assert this.

### 3.3 INR+en-IN byte-identity with `formatLiquidMoney`

The INR+en-IN output path of `formatThemeCurrencyDisplay` uses the same `toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })` chain as `formatLiquidMoney`. Tests Z-C01..Z-C04 assert byte-identical output for a range of representative amounts: `749900` (₹7,499.00), `0`, `9999999`, and `100` (₹1.00). This ensures the Phase Z helper is a safe drop-in for any caller already using `formatLiquidMoney`.

---

## 4. India-First Proof

### 4.1 `THEME_DEFAULT_STORE_LOCALE = 'en-IN'`

Test Z-L32 asserts `THEME_DEFAULT_STORE_LOCALE === 'en-IN'` by importing the constant from `theme-locale.ts`. This is the exported constant; callers should use it instead of hard-coding `'en-IN'`.

### 4.2 Null/empty locale resolves via `en-IN`

Tests Z-L09 and Z-L10 assert that `tLocale(key, null, bundle)` and `tLocale(key, '', bundle)` both produce the same result as `tLocale(key, 'en-IN', bundle)` when the bundle has an `en-IN` locale dictionary. The `normalizeLocale` function converts null/undefined/empty to `'en-IN'`.

### 4.3 `en-IN` beats bare `en` in bundles with both

Test Z-L11 asserts that when a bundle has both `'en'` and `'en-IN'` locale dictionaries, `tLocale(key, 'en-IN', bundle)` returns the `en-IN` value, not the `en` value. For the dominant real-world case where `storeLocale = 'en-IN'` (the DB default), the `en-IN` locale is tried first and wins.

### 4.4 Merchant editor default locale

- `apps/merchant-control-plane/src/components/theme-locale/LocaleSwitcher.tsx` exports `DEFAULT_ADMIN_LOCALE = 'en-IN'`.
- `TranslationEditorClient` initialises `selectedLocale` state to `DEFAULT_ADMIN_LOCALE`.
- `TranslationKeyList` uses `DEFAULT_ADMIN_LOCALE` as the reference locale for missing-key detection.
- `TranslationEditorClient` passes `defaultLocale={DEFAULT_ADMIN_LOCALE}` to `TranslationKeyList`.
- Static-contract tests: `phase-z: admin-locales.ts defines DEFAULT_ADMIN_LOCALE as en-IN`, `phase-z: TranslationEditorClient initialises selectedLocale to DEFAULT_ADMIN_LOCALE (India-first)`.

### 4.5 Currency defaults

- `formatThemeCurrencyDisplay` default argument `currencyCode = 'INR'`.
- `formatThemeCurrencyDisplay` default argument `locale = 'en-IN'`.
- Tests Z-C23 and Z-C24 assert these defaults.
- Test Z-C05 asserts: INR always uses `en-IN` number formatting regardless of the `locale` argument.

---

## 5. Findings

### Finding 1 — MEDIUM — `buildCandidates('en')` India-first inversion

**File:** `packages/theme-engine/src/theme-locale.ts`
**Severity:** MEDIUM
**Status:** OPEN · Hardening: null · Registered as RISK-Z01

`buildCandidates('en')` produces `['en', 'en-IN']` because the dedup loop starts with `normalized = 'en'`, then `language = 'en'` (deduplicated), then `THEME_DEFAULT_STORE_LOCALE = 'en-IN'`. So bare `'en'` occupies index 0, and `'en-IN'` falls to index 1.

**Failure scenario:** A store whose `sites.locale` column contains `'en'` (bare, not `'en-IN'`) calls `tLocale('general.title', 'en', bundle)` where the bundle has both `'en.general.title' = 'Sale'` and `'en-IN.general.title' = 'Sale – India'`. The resolver returns `'Sale'` (bare `'en'` wins at index 0). The documented/intended behaviour is to return `'Sale – India'` because `en-IN` should take precedence over bare `en`. The India-first override is silently inverted for any store with `locale = 'en'`.

**Affected path:** Only stores whose `sites.locale` column is exactly `'en'`. The DB default on store creation is `'en-IN'` (`stores.ts:686`). Stores migrated from older schemas or created via direct DB insert without the default may carry bare `'en'`. The risk is latent for the current population but is a correctness bug against the documented fallback contract.

**Suggested fix:** In `buildCandidates`, special-case bare `'en'`: if `normalized === 'en'`, build the list as `[THEME_DEFAULT_STORE_LOCALE, 'en']` instead of `['en', THEME_DEFAULT_STORE_LOCALE]`. Add test: `tLocale('general.cart', 'en', MINIMAL_LOCALES)` must return the `en-IN` value, not the bare `en` value.

**Target:** Phase AA or earliest phase touching `theme-locale.ts`.

---

### Finding 2 — LOW — Pre-existing `lookupTranslation` in `theme-renderer.ts` lacks BLOCKED_PATH_SEGMENTS guard

**File:** `packages/theme-engine/src/theme-renderer.ts`
**Severity:** LOW
**Status:** OPEN · Registered as RISK-Z02

The pre-existing `lookupTranslation` at lines 1118–1136 in `theme-renderer.ts` traverses dot-path segments with `(current as Record<string, unknown>)[segment]` without checking `BLOCKED_PATH_SEGMENTS`. A `__proto__`, `constructor`, or `prototype` key in a locale dictionary could invoke the prototype setter. Phase Z's new `lookupPath` has the correct guard; the pre-existing Liquid path does not.

**Impact:** Bounded — read-only access on first-party bundles validated by `LiquidThemePackageBundleSchema.parse`. No write path. Defence-in-depth gap, not a directly exploitable vector.

**Suggested fix:** Add `if (BLOCKED_PATH_SEGMENTS.has(segment)) return undefined;` (export the set from `theme-locale.ts` and import it in `theme-renderer.ts`) at the top of the reduce callback in `lookupTranslation`.

**Target:** Earliest phase touching `theme-renderer.ts`. NOT introduced by Phase Z.

---

### Finding 3 — LOW — Translation POST proxy accepts any `resource_type` without proxy-layer validation

**File:** `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/route.ts`
**Severity:** LOW
**Status:** OPEN · Registered as RISK-Z03

The POST handler casts the request body with `as CreateStorefrontTranslationInput` without runtime validation at the proxy layer. A merchant calling the endpoint directly can send `resource_type: 'product'` instead of `'theme'`. The gateway's `CreateStorefrontTranslationSchema` validates the enum, so RISK-DUAL-N01 is not broken at the persistence layer. However, the proxy does not enforce the intent boundary.

**Suggested fix:** Add a Zod parse or literal check at the proxy: reject requests where `resource_type !== 'theme'` before forwarding to the gateway. Return 400 with `{ error: 'resource_type must be theme' }`.

**Target:** Phase AA or first touch of this proxy route.

---

### Finding 4 — LOW — DELETE proxy has no server-side guard against deleting default-locale (en-IN) translations

**File:** `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/[translationId]/route.ts`
**Severity:** LOW
**Status:** OPEN · Registered as RISK-Z04

The DELETE proxy calls `deleteTranslation` without a guard preventing deletion of the default locale (`en-IN`) translation rows. The UI omits a delete button for the default locale (documented in `TranslationEditorClient` and `LocaleSwitcher`), but a direct API call bypasses the UI guard.

**Failure scenario:** Merchant sends `DELETE /api/stores/mystore/localization/translations/<uuid-of-en-IN-key>` via cURL. `resolveOwnedStoreId` passes (they own the store). The gateway deletes the row. `tLocale('general.cart', 'hi-IN', bundle)` then falls through `en-IN` (deleted), then `en` (absent), and returns `'general.cart'` as the raw key path — displayed to customers.

**Suggested fix:** In the DELETE handler or the gateway's `deleteTranslation` RPC, fetch the translation row, resolve its locale, and reject with 400 if that locale is the store's default (`en-IN`). The merchant-control-plane proxy already forwards the `storeId`-scoped call; enforcement belongs at the gateway for single-source enforcement.

**Target:** Phase AA or earliest security migration.

---

### Finding 5 — LOW — POST proxy does not verify `resource_id` (themeId) belongs to `storeId`

**File:** `apps/merchant-control-plane/src/app/api/stores/[store]/localization/translations/route.ts`
**Severity:** LOW
**Status:** OPEN · Registered as RISK-Z05

The POST proxy forwards the client-supplied `resource_id` (themeId) from the request body to the gateway without verifying it belongs to `resolved.storeId`. A merchant who knows another tenant's `themeId` could POST translations scoped to that theme.

**Failure scenario:** Merchant A knows Merchant B's `themeId`. Merchant A sends POST to `/api/stores/merchantA/localization/translations` with `resource_id = merchantB-themeId`, `resource_type = 'theme'`. `resolveOwnedStoreId` validates Merchant A's store ownership, but the `themeId` cross-check is absent. Whether the write succeeds depends on gateway/RLS; if any gap exists there, cross-tenant translation injection is possible.

**Suggested fix:** After resolving `storeId`, verify that `body.resource_id` belongs to `resolved.storeId` — call `api.themes.getById(body.resource_id)` and confirm `theme.store_id === resolved.storeId`. Return 403 on mismatch.

**Target:** Phase AA or first touch of this proxy route.

---

### Finding 6 — LOW — Gateway `deleteTranslation` handler has no locale guard (backend view of Finding 4)

**File:** `services/api-gateway/src/routes/stores-localization.ts`
**Severity:** LOW
**Status:** OPEN · Registered as RISK-Z06

The gateway DELETE handler at `/v1/stores/:id/localization/translations/:translationId` soft-deletes any row matching `id + storeId` with no `is_default_locale` check. Phase Z does not modify this file. The proxy-layer finding (RISK-Z04) and the gateway-layer finding (RISK-Z06) are complementary: full closure requires a guard at the gateway level to be robust regardless of the proxy used.

**Suggested fix:** In the gateway DELETE handler: fetch the translation row first, resolve its locale against `storefront_locales.is_default`, and reject with 400 if `is_default = true`.

**Target:** Same as RISK-Z04: Phase AA or earliest security migration.

---

## 6. RISK-DUAL-N01 Status

Phase Z adds two new write surfaces:
1. `TranslationValueEditor` writes to `storefront_translations` via the proxy route.
2. The POST proxy passes `resource_type: 'theme' as const` and writes to `storefront_translations`.

Neither surface reads or writes `section_definitions` or `block_definitions`. The `buildDraftConfig` mechanical backstop in `editor/page.tsx` is unaffected (Phase Z does not touch that file). RISK-DUAL-N01 remains OPEN (ongoing process requirement) but is mechanically guarded for the Phase Z write path.

---

## 7. Summary Table

| Finding | Severity | File | Status |
|---------|----------|------|--------|
| 1 — `buildCandidates('en')` India-first inversion | MEDIUM | `theme-locale.ts` | OPEN (RISK-Z01) |
| 2 — `lookupTranslation` lacks prototype segment guard | LOW | `theme-renderer.ts` (pre-existing) | OPEN (RISK-Z02) |
| 3 — POST proxy accepts any `resource_type` | LOW | `translations/route.ts` | OPEN (RISK-Z03) |
| 4 — DELETE proxy no default-locale guard (proxy layer) | LOW | `[translationId]/route.ts` | OPEN (RISK-Z04) |
| 5 — POST proxy no `resource_id` ownership check | LOW | `translations/route.ts` | OPEN (RISK-Z05) |
| 6 — Gateway DELETE no locale guard (gateway layer) | LOW | `stores-localization.ts` | OPEN (RISK-Z06) |
