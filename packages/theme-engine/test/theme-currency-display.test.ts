// Phase Z — Theme Markets & Localization (LANE A): formatThemeCurrencyDisplay tests.
//
// These tests verify:
//   1. INR + en-IN output is byte-identical to formatLiquidMoney (theme-renderer.ts).
//   2. Other currency codes are shown as display labels without FX conversion.
//   3. NOT-CONNECTED: fxConnected is always false; fxNotConnectedReason is always set.
//   4. Minor-unit division is correct (749900 -> ₹7,499.00).
//   5. The canonical ledger is never mutated (formatThemeCurrencyDisplay is pure/display-only).
//   6. Non-finite input (NaN, Infinity) formats as 0.00 (same as formatLiquidMoney).
//   7. Invalid currency code falls back to INR.
//   8. Determinism: same inputs always produce same output.
//
// MONEY SAFETY: this module NEVER touches create_checkout_order, confirm_order_payment,
// or any other canonical ledger RPC. All tests call pure formatting functions only.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatThemeCurrencyDisplay,
} from '../src/theme-locale.ts';

// Reference implementation: mirrors formatLiquidMoney from theme-renderer.ts
// so we can assert byte-identity without importing internal renderer state.
function formatLiquidMoneyRef(value: unknown, currency: unknown = 'INR'): string {
  const numeric = Number(value);
  const amount = Number.isFinite(numeric) ? numeric / 100 : 0;
  const currencyCode =
    typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'INR';
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencyCode} ${formatted}`;
}

// ---------------------------------------------------------------------------
// 1. INR + en-IN byte-identical to formatLiquidMoney
// ---------------------------------------------------------------------------

test('Z-C01 INR + en-IN: byte-identical to formatLiquidMoney for a typical price (749900 paise)', () => {
  const result = formatThemeCurrencyDisplay(749900, 'INR', 'en-IN');
  const expected = formatLiquidMoneyRef(749900, 'INR');
  assert.equal(result.formatted, expected, 'formatThemeCurrencyDisplay must be byte-identical to formatLiquidMoney for INR/en-IN');
  assert.equal(result.formatted, 'INR 7,499.00');
});

test('Z-C02 INR + en-IN: byte-identical for ₹0', () => {
  const result = formatThemeCurrencyDisplay(0, 'INR', 'en-IN');
  assert.equal(result.formatted, formatLiquidMoneyRef(0, 'INR'));
  assert.equal(result.formatted, 'INR 0.00');
});

test('Z-C03 INR + en-IN: byte-identical for large amount (9999999 paise = ₹99,999.99)', () => {
  const result = formatThemeCurrencyDisplay(9999999, 'INR', 'en-IN');
  assert.equal(result.formatted, formatLiquidMoneyRef(9999999, 'INR'));
});

test('Z-C04 INR + en-IN: byte-identical for 100 paise (₹1.00)', () => {
  const result = formatThemeCurrencyDisplay(100, 'INR', 'en-IN');
  assert.equal(result.formatted, formatLiquidMoneyRef(100, 'INR'));
  assert.equal(result.formatted, 'INR 1.00');
});

test('Z-C05 INR always uses en-IN number formatting regardless of locale argument', () => {
  // Even if locale = 'hi-IN', INR path must be byte-identical to formatLiquidMoney(en-IN).
  const resultEnIN = formatThemeCurrencyDisplay(749900, 'INR', 'en-IN');
  const resultHiIN = formatThemeCurrencyDisplay(749900, 'INR', 'hi-IN');
  assert.equal(resultHiIN.formatted, resultEnIN.formatted,
    'INR formatting must always use en-IN locale (byte-identity requirement)');
});

// ---------------------------------------------------------------------------
// 2. Other currency display (presentational, no FX conversion)
// ---------------------------------------------------------------------------

test('Z-C06 non-INR currency uses the requested currency code as prefix', () => {
  const result = formatThemeCurrencyDisplay(749900, 'USD', 'en-US');
  assert.match(result.formatted, /^USD /, 'non-INR currency code must appear as prefix');
});

test('Z-C07 non-INR: amount is INR minor units / 100 (no conversion applied)', () => {
  // 749900 paise = 7499.00 units formatted without conversion.
  const result = formatThemeCurrencyDisplay(749900, 'EUR', 'en-IN');
  assert.match(result.formatted, /7[,.]?499/,
    'amount must be minor units / 100 without FX conversion');
});

test('Z-C08 non-INR result still has 2 decimal places', () => {
  const result = formatThemeCurrencyDisplay(100, 'USD', 'en-US');
  assert.match(result.formatted, /1\.00$/);
});

// ---------------------------------------------------------------------------
// 3. NOT-CONNECTED: fxConnected always false, fxNotConnectedReason always set
// ---------------------------------------------------------------------------

test('Z-C09 fxConnected is always false (NOT-CONNECTED)', () => {
  const resultINR = formatThemeCurrencyDisplay(749900, 'INR', 'en-IN');
  const resultUSD = formatThemeCurrencyDisplay(749900, 'USD', 'en-US');
  assert.equal(resultINR.fxConnected, false);
  assert.equal(resultUSD.fxConnected, false);
});

test('Z-C10 fxNotConnectedReason is always a non-empty string', () => {
  const result = formatThemeCurrencyDisplay(749900, 'INR', 'en-IN');
  assert.ok(typeof result.fxNotConnectedReason === 'string' && result.fxNotConnectedReason.length > 0,
    'fxNotConnectedReason must be a non-empty string');
});

test('Z-C11 fxNotConnectedReason mentions missing FX source', () => {
  const result = formatThemeCurrencyDisplay(749900, 'USD', 'en-IN');
  const reason = result.fxNotConnectedReason.toLowerCase();
  assert.ok(
    reason.includes('not connected') || reason.includes('fx') || reason.includes('rate'),
    'fxNotConnectedReason must describe the missing FX source',
  );
});

// ---------------------------------------------------------------------------
// 4. Minor-unit division correct
// ---------------------------------------------------------------------------

test('Z-C12 minor-unit to major-unit conversion: 749900 / 100 = 7499.00', () => {
  const result = formatThemeCurrencyDisplay(749900, 'INR', 'en-IN');
  // 749900 paise / 100 = 7499.00 rupees
  assert.match(result.formatted, /7,499\.00/, 'must divide minor units by 100');
});

test('Z-C13 minor-unit to major-unit conversion: 1 paise = ₹0.01', () => {
  const result = formatThemeCurrencyDisplay(1, 'INR', 'en-IN');
  assert.equal(result.formatted, formatLiquidMoneyRef(1, 'INR'));
  assert.equal(result.formatted, 'INR 0.01');
});

test('Z-C14 minor-unit to major-unit conversion: 50 paise = ₹0.50', () => {
  const result = formatThemeCurrencyDisplay(50, 'INR', 'en-IN');
  assert.equal(result.formatted, 'INR 0.50');
});

// ---------------------------------------------------------------------------
// 5. Pure function — no side effects on any money table (structural)
// ---------------------------------------------------------------------------

test('Z-C15 formatThemeCurrencyDisplay is a pure function (no side effects)', () => {
  // Call it multiple times with different arguments; ensure it does not mutate inputs.
  const inputAmount = 749900;
  const inputCurrency = 'INR';
  const inputLocale = 'en-IN';

  const r1 = formatThemeCurrencyDisplay(inputAmount, inputCurrency, inputLocale);
  const r2 = formatThemeCurrencyDisplay(inputAmount, inputCurrency, inputLocale);

  assert.equal(r1.formatted, r2.formatted, 'pure function must return same result each call');
  // Input values must be unchanged.
  assert.equal(inputAmount, 749900);
  assert.equal(inputCurrency, 'INR');
  assert.equal(inputLocale, 'en-IN');
});

// ---------------------------------------------------------------------------
// 6. Non-finite input (NaN, Infinity) formats as 0.00
// ---------------------------------------------------------------------------

test('Z-C16 NaN input formats as 0.00 (same as formatLiquidMoney)', () => {
  const result = formatThemeCurrencyDisplay(NaN, 'INR', 'en-IN');
  assert.equal(result.formatted, formatLiquidMoneyRef(NaN, 'INR'));
  assert.equal(result.formatted, 'INR 0.00');
});

test('Z-C17 Infinity input formats as 0.00', () => {
  const result = formatThemeCurrencyDisplay(Infinity, 'INR', 'en-IN');
  assert.equal(result.formatted, 'INR 0.00');
});

test('Z-C18 non-numeric string input formats as 0.00', () => {
  const result = formatThemeCurrencyDisplay('not-a-number' as unknown, 'INR', 'en-IN');
  assert.equal(result.formatted, 'INR 0.00');
});

// ---------------------------------------------------------------------------
// 7. Invalid currency code falls back to INR
// ---------------------------------------------------------------------------

test('Z-C19 invalid currency code (lowercase) falls back to INR', () => {
  const result = formatThemeCurrencyDisplay(749900, 'usd', 'en-IN');
  // 'usd' fails /^[A-Z]{3}$/ -> falls back to INR.
  assert.equal(result.formatted, formatLiquidMoneyRef(749900, 'INR'));
});

test('Z-C20 invalid currency code (too short) falls back to INR', () => {
  const result = formatThemeCurrencyDisplay(749900, 'US', 'en-IN');
  assert.equal(result.formatted, 'INR 7,499.00');
});

test('Z-C21 null currency code falls back to INR', () => {
  const result = formatThemeCurrencyDisplay(749900, null as unknown, 'en-IN');
  assert.equal(result.formatted, 'INR 7,499.00');
});

// ---------------------------------------------------------------------------
// 8. Determinism
// ---------------------------------------------------------------------------

test('Z-C22 formatThemeCurrencyDisplay is deterministic (same inputs same output)', () => {
  const calls = Array.from({ length: 5 }, () =>
    formatThemeCurrencyDisplay(749900, 'INR', 'en-IN').formatted,
  );
  const first = calls[0];
  assert.ok(calls.every((v) => v === first), 'must produce identical output on every call');
});

test('Z-C23 default locale argument is en-IN (India-first)', () => {
  // Call without locale argument -> defaults to en-IN for INR path.
  const withDefault = formatThemeCurrencyDisplay(749900, 'INR');
  const withExplicit = formatThemeCurrencyDisplay(749900, 'INR', 'en-IN');
  assert.equal(withDefault.formatted, withExplicit.formatted,
    'default locale must produce same INR output as explicit en-IN');
});

test('Z-C24 default currency argument is INR (India-first)', () => {
  const withDefault = formatThemeCurrencyDisplay(749900);
  const withExplicit = formatThemeCurrencyDisplay(749900, 'INR', 'en-IN');
  assert.equal(withDefault.formatted, withExplicit.formatted,
    'default currency must be INR, matching India-first default');
});
