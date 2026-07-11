// Phase Z — Theme Markets & Localization (LANE A): tLocale tests.
//
// These tests verify:
//   1. Key resolves in requested locale.
//   2. Missing key falls back to default locale (en-IN), then the key path itself.
//   3. en-IN default is byte-identical (no regression to existing bundle rendering).
//   4. Translation strings with HTML content (<script>) are returned raw — escaping is
//      handled by the render layer (LiquidJS outputEscape:'escape'); no bypass here.
//   5. t: prefix is stripped before lookup.
//   6. Locale normalisation (hi_IN -> hi-IN, underscore to hyphen).
//   7. Fallback order is locale -> language-tag -> en-IN -> en.
//   8. Invalid / unsafe key charset is rejected gracefully (returns raw key, never crashes).
//   9. Placeholder ({{ varname }}) interpolation.
//  10. Prototype-pollution guard (BLOCKED_PATH_SEGMENTS).
//
// INDIA-FIRST: en-IN is the default locale. A bundle with only an 'en-IN' key produces
// the same output as before Phase Z.
//
// INJECTION SAFETY: tLocale returns raw strings. The render pipeline (LiquidJS or
// sanitizeRenderedHtml) is responsible for HTML escaping — this is confirmed by the
// <script>-in-value tests below.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  tLocale,
  normalizeLocale,
  THEME_DEFAULT_STORE_LOCALE,
} from '../src/theme-locale.ts';
import type { ThemeBundleLocaleMap } from '../src/theme-bundle.ts';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MINIMAL_LOCALES: ThemeBundleLocaleMap = {
  'en-IN': {
    general: {
      cart: 'Cart',
      search: 'Search',
      greeting: 'Hello, {{ name }}!',
    },
    checkout: {
      button: 'Proceed to Checkout',
    },
  },
  'en': {
    general: {
      cart: 'Cart (en)',
      search: 'Search (en)',
    },
  },
};

const HINDI_LOCALES: ThemeBundleLocaleMap = {
  'hi-IN': {
    general: {
      cart: 'कार्ट',
      search: 'खोज',
    },
  },
  'en-IN': {
    general: {
      cart: 'Cart',
      search: 'Search',
    },
  },
};

const EMPTY_LOCALES: ThemeBundleLocaleMap = {};

const SCRIPT_LOCALES: ThemeBundleLocaleMap = {
  'en-IN': {
    xss: {
      value: '<script>alert(1)</script>',
      imgTag: '<img src=x onerror=alert(2)>',
    },
  },
};

const DEEP_LOCALES: ThemeBundleLocaleMap = {
  'en': {
    general: {
      cart: 'Cart (en fallback)',
    },
  },
};

// ---------------------------------------------------------------------------
// 1. Key resolves in requested locale
// ---------------------------------------------------------------------------

test('Z-L01 tLocale resolves key in exact requested locale', () => {
  const result = tLocale('general.cart', 'hi-IN', HINDI_LOCALES);
  assert.equal(result, 'कार्ट');
});

test('Z-L02 tLocale resolves key in en-IN when locale is en-IN', () => {
  const result = tLocale('general.cart', 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, 'Cart');
});

test('Z-L03 tLocale resolves nested key (checkout.button)', () => {
  const result = tLocale('checkout.button', 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, 'Proceed to Checkout');
});

// ---------------------------------------------------------------------------
// 2. Missing key fallback chain: locale -> language-tag -> en-IN -> en -> key path
// ---------------------------------------------------------------------------

test('Z-L04 tLocale falls back to en-IN when locale key is absent', () => {
  // hi-IN locale lacks 'checkout.button'; should resolve from en-IN fallback.
  const result = tLocale('checkout.button', 'hi-IN', MINIMAL_LOCALES);
  assert.equal(result, 'Proceed to Checkout');
});

test('Z-L05 tLocale falls back to en when en-IN also missing', () => {
  // Bundle only has 'en' locale; store locale is 'en-IN' but exact+language fallback
  // lands on 'en'.
  const result = tLocale('general.cart', 'en-IN', DEEP_LOCALES);
  assert.equal(result, 'Cart (en fallback)');
});

test('Z-L06 tLocale returns key path (no t: prefix) when key not found anywhere', () => {
  const result = tLocale('general.missing_key', 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, 'general.missing_key');
});

test('Z-L07 tLocale returns key path when bundle has no locales', () => {
  const result = tLocale('general.cart', 'en-IN', EMPTY_LOCALES);
  assert.equal(result, 'general.cart');
});

test('Z-L08 tLocale returns key path when locale is null and bundle empty', () => {
  const result = tLocale('some.key', null, EMPTY_LOCALES);
  assert.equal(result, 'some.key');
});

// ---------------------------------------------------------------------------
// 3. en-IN default byte-identical (India-first, no regression)
// ---------------------------------------------------------------------------

test('Z-L09 en-IN default: tLocale with null locale resolves via en-IN fallback', () => {
  // null locale -> normalises to en-IN -> resolves from MINIMAL_LOCALES['en-IN']
  const resultNull = tLocale('general.cart', null, MINIMAL_LOCALES);
  const resultEnIN = tLocale('general.cart', 'en-IN', MINIMAL_LOCALES);
  assert.equal(resultNull, resultEnIN, 'null locale must resolve identically to en-IN');
  assert.equal(resultNull, 'Cart');
});

test('Z-L10 en-IN default: empty string locale resolves via en-IN', () => {
  const result = tLocale('general.search', '', MINIMAL_LOCALES);
  assert.equal(result, 'Search');
});

test('Z-L11 en-IN takes precedence over bare en when bundle has both', () => {
  // MINIMAL_LOCALES has both 'en-IN' (cart: 'Cart') and 'en' (cart: 'Cart (en)').
  // Requesting 'en-IN' must resolve 'en-IN', not 'en'.
  const result = tLocale('general.cart', 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, 'Cart', 'en-IN locale must take precedence over bare en');
  assert.notEqual(result, 'Cart (en)');
});

// ---------------------------------------------------------------------------
// 4. Translation strings with HTML content are returned raw (no bypass)
// ---------------------------------------------------------------------------

test('Z-L12 tLocale returns raw string including HTML tags (escaping is render-layer responsibility)', () => {
  // tLocale must NOT pre-escape or strip the string.
  // LiquidJS outputEscape:'escape' or sanitizeRenderedHtml handles escaping at render time.
  const result = tLocale('xss.value', 'en-IN', SCRIPT_LOCALES);
  // Returned exactly as stored in locale file — the render pipeline escapes it.
  assert.equal(result, '<script>alert(1)</script>');
});

test('Z-L13 img-onerror locale value returned raw (render layer escapes)', () => {
  const result = tLocale('xss.imgTag', 'en-IN', SCRIPT_LOCALES);
  assert.equal(result, '<img src=x onerror=alert(2)>');
});

// ---------------------------------------------------------------------------
// 5. t: prefix stripped correctly
// ---------------------------------------------------------------------------

test('Z-L14 tLocale with t: prefix produces same result as without prefix', () => {
  const withPrefix = tLocale('t:general.cart', 'en-IN', MINIMAL_LOCALES);
  const withoutPrefix = tLocale('general.cart', 'en-IN', MINIMAL_LOCALES);
  assert.equal(withPrefix, withoutPrefix);
  assert.equal(withPrefix, 'Cart');
});

test('Z-L15 t: prefix stripped in missing-key fallback too', () => {
  const result = tLocale('t:missing.key', 'en-IN', EMPTY_LOCALES);
  // Must return 'missing.key' (stripped), not 't:missing.key' (with prefix).
  assert.equal(result, 'missing.key');
});

// ---------------------------------------------------------------------------
// 6. Locale normalisation (hi_IN -> hi-IN)
// ---------------------------------------------------------------------------

test('Z-L16 normalizeLocale converts underscore to hyphen', () => {
  assert.equal(normalizeLocale('hi_IN'), 'hi-IN');
  assert.equal(normalizeLocale('en_IN'), 'en-IN');
});

test('Z-L17 normalizeLocale uppercases region tag', () => {
  assert.equal(normalizeLocale('en-in'), 'en-IN');
  assert.equal(normalizeLocale('hi-in'), 'hi-IN');
});

test('Z-L18 normalizeLocale returns en-IN for null/undefined/empty', () => {
  assert.equal(normalizeLocale(null), THEME_DEFAULT_STORE_LOCALE);
  assert.equal(normalizeLocale(undefined), THEME_DEFAULT_STORE_LOCALE);
  assert.equal(normalizeLocale(''), THEME_DEFAULT_STORE_LOCALE);
});

test('Z-L19 tLocale accepts underscore locale (hi_IN) and resolves correctly', () => {
  // hi_IN should normalise to hi-IN and resolve from HINDI_LOCALES.
  const result = tLocale('general.cart', 'hi_IN', HINDI_LOCALES);
  assert.equal(result, 'कार्ट');
});

// ---------------------------------------------------------------------------
// 7. Fallback order: locale -> language-tag -> en-IN -> en
// ---------------------------------------------------------------------------

test('Z-L20 fallback order: language-tag tried before en-IN', () => {
  // Bundle has 'hi' (no hyphen) but not 'hi-IN'.
  const localesWithBareHi: ThemeBundleLocaleMap = {
    'hi': { general: { cart: 'हिंदी कार्ट' } },
    'en-IN': { general: { cart: 'Cart' } },
  };
  const result = tLocale('general.cart', 'hi-IN', localesWithBareHi);
  assert.equal(result, 'हिंदी कार्ट', 'bare hi should be tried before en-IN');
});

test('Z-L21 fallback order: en-IN tried before bare en', () => {
  const result = tLocale('general.cart', 'fr-FR', MINIMAL_LOCALES);
  // fr-FR not found, fr not found, en-IN found -> 'Cart' (not 'Cart (en)').
  assert.equal(result, 'Cart', 'en-IN should be tried before bare en in fallback chain');
});

// ---------------------------------------------------------------------------
// 8. Invalid / unsafe key charset
// ---------------------------------------------------------------------------

test('Z-L22 invalid key with angle bracket is returned as-is (never crash)', () => {
  const raw = '<script>alert(1)</script>';
  const result = tLocale(raw, 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, raw, 'invalid key must be returned unchanged');
});

test('Z-L23 key with colon (other than t:) is returned as-is', () => {
  const raw = 'some:key';
  const result = tLocale(raw, 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, raw);
});

test('Z-L24 empty key is returned as-is', () => {
  const result = tLocale('', 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, '');
});

test('Z-L25 key with only t: prefix (empty after strip) is returned as-is', () => {
  const result = tLocale('t:', 'en-IN', MINIMAL_LOCALES);
  assert.equal(result, 't:');
});

// ---------------------------------------------------------------------------
// 9. Placeholder interpolation ({{ varname }})
// ---------------------------------------------------------------------------

test('Z-L26 tLocale interpolates {{ varname }} placeholders', () => {
  const result = tLocale('general.greeting', 'en-IN', MINIMAL_LOCALES, { name: 'Riya' });
  assert.equal(result, 'Hello, Riya!');
});

test('Z-L27 tLocale leaves unmatched placeholders unchanged', () => {
  // 'name' not in replacements -> {{ name }} stays.
  const result = tLocale('general.greeting', 'en-IN', MINIMAL_LOCALES, {});
  assert.equal(result, 'Hello, {{ name }}!');
});

test('Z-L28 tLocale with numeric replacement coerced to string', () => {
  const localesWithNum: ThemeBundleLocaleMap = {
    'en-IN': { cart: { count: '{{ count }} items' } },
  };
  const result = tLocale('cart.count', 'en-IN', localesWithNum, { count: 3 });
  assert.equal(result, '3 items');
});

// ---------------------------------------------------------------------------
// 10. Prototype-pollution guard
// ---------------------------------------------------------------------------

test('Z-L29 key with __proto__ segment returns key path safely (no crash)', () => {
  // The __proto__ segment is blocked during dot-path traversal.
  const result = tLocale('__proto__.cart', 'en-IN', MINIMAL_LOCALES);
  // validateAndStripKey rejects keys starting with non-letter (__) so returns raw key.
  assert.equal(result, '__proto__.cart');
});

test('Z-L30 key segment equal to constructor returns key path (blocked segment)', () => {
  // 'a.constructor.b' would be a valid charset key but 'constructor' segment is blocked.
  const localesWithConstructor: ThemeBundleLocaleMap = {
    'en-IN': { a: { constructor: { b: 'BLOCKED' } } },
  };
  const result = tLocale('a.constructor.b', 'en-IN', localesWithConstructor);
  // Path traversal is blocked at 'constructor'; key path returned as fallback.
  assert.equal(result, 'a.constructor.b');
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test('Z-L31 tLocale is deterministic (same inputs always same output)', () => {
  const run1 = tLocale('general.cart', 'hi-IN', HINDI_LOCALES);
  const run2 = tLocale('general.cart', 'hi-IN', HINDI_LOCALES);
  const run3 = tLocale('general.cart', 'hi-IN', HINDI_LOCALES);
  assert.equal(run1, run2);
  assert.equal(run2, run3);
  assert.equal(run1, 'कार्ट');
});

test('Z-L32 THEME_DEFAULT_STORE_LOCALE constant is en-IN', () => {
  assert.equal(THEME_DEFAULT_STORE_LOCALE, 'en-IN');
});
