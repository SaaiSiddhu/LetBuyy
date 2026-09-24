// Phase Z — Theme Markets & Localization (LANE A)
// Translation resolution + market-aware display currency formatting.
//
// INDIA-FIRST: 'en-IN' is the default locale. The fallback chain always includes 'en-IN'
// before 'en' so that stores configured for Indian English resolve correctly.
// A theme bundle with only 'en-IN' locale keys and store locale 'en-IN' renders
// byte-identically before and after this module.
//
// MONEY SAFETY: formatThemeCurrencyDisplay is PRESENTATIONAL ONLY. It formats
// already-computed minor-unit amounts for display. It does NOT convert canonical ledger
// amounts. Live FX rates are NOT CONNECTED (see comment on formatThemeCurrencyDisplay).
// The canonical ledger (create_checkout_order etc.) is INR-only and is NEVER touched here.
//
// INJECTION SAFETY: tLocale returns raw locale string values. Translation output is
// escaped by the LiquidJS engine (outputEscape:'escape') or the JSON-contract HTML pipeline
// (sanitizeRenderedHtml). No new sanitizer bypass is introduced here.

import type { ThemeBundleLocaleMap } from './theme-bundle.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** India-first store default locale. Must match sites.locale DB column default ('en-IN'). */
export const THEME_DEFAULT_STORE_LOCALE = 'en-IN' as const;

/** Translation key prefix (same value as THEME_TRANSLATION_PREFIX in theme-bundle.ts). */
const T_PREFIX = 't:';

/**
 * Prototype-pollution guard applied during dot-path traversal.
 * Traversal is blocked for these property names so a crafted locale
 * dictionary cannot pollute Object.prototype or Function.prototype.
 */
const BLOCKED_PATH_SEGMENTS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

/**
 * Validate a translation key and strip the 't:' prefix if present.
 *
 * Valid key pattern: starts with a letter; subsequent characters are letters,
 * digits, underscores, hyphens, or dots (dots separate path segments).
 * Case-insensitive.
 *
 * Returns the stripped key path on success, or null for empty/invalid input
 * (the caller must return the raw input unchanged — never crash).
 */
function validateAndStripKey(raw: string): string | null {
  const withoutPrefix = raw.startsWith(T_PREFIX) ? raw.slice(T_PREFIX.length).trim() : raw.trim();
  if (!withoutPrefix) return null;
  // Safe key charset: start with letter; subsequent chars are letter/digit/underscore/hyphen/dot.
  // Dots are path separators (general.cart). Hyphens allowed in segment names.
  // Rejects colons (the t: prefix is already stripped), angle brackets, quotes, etc.
  if (!/^[a-z][a-z0-9_.-]*(?:\.[a-z][a-z0-9_.-]*)*$/i.test(withoutPrefix)) return null;
  return withoutPrefix;
}

// ---------------------------------------------------------------------------
// Locale normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a locale string to BCP-47 form:
 *   - underscores become hyphens ('en_IN' -> 'en-IN')
 *   - language tag lowercased; region tag uppercased
 *   - falls back to THEME_DEFAULT_STORE_LOCALE on empty/invalid input
 *
 * This function is intentionally independent of normalizeThemeLocale
 * (theme-bundle.ts) whose fallback is 'en'. The store-level default is 'en-IN'.
 */
export function normalizeLocale(locale: string | null | undefined): string {
  const raw = (locale ?? '').trim().replace(/_/g, '-');
  if (!raw) return THEME_DEFAULT_STORE_LOCALE;

  const parts = raw.split('-').filter(Boolean);
  const language = parts[0];
  if (!language) return THEME_DEFAULT_STORE_LOCALE;

  return [
    language.toLowerCase(),
    ...parts.slice(1).map((p) => (p.length === 2 ? p.toUpperCase() : p.toLowerCase())),
  ].join('-');
}

// ---------------------------------------------------------------------------
// Locale candidate chain
// ---------------------------------------------------------------------------

/**
 * Build the ordered candidate list for locale resolution.
 * Chain: [normalised locale, bare language tag, 'en-IN', 'en']
 * Deduplicated while preserving order.
 *
 * An EXPLICITLY requested locale always resolves first (standard i18n exact-match), then its
 * bare language tag, then the India-first default 'en-IN', then bare 'en'. en-IN is the DEFAULT
 * (used when nothing/invalid is requested — see normalizeLocale) and the universal fallback, but
 * it never overrides an explicit request.
 *
 * Example: buildCandidates('hi-IN') -> ['hi-IN', 'hi', 'en-IN', 'en']
 * Example: buildCandidates('en-IN') -> ['en-IN', 'en']
 * Example: buildCandidates('en')    -> ['en', 'en-IN']   (explicit 'en' wins; en-IN is the fallback)
 * Example: buildCandidates(null)    -> ['en-IN', 'en']   (no request -> India-first default)
 */
function buildCandidates(locale: string | null | undefined): string[] {
  const normalized = normalizeLocale(locale);
  const language = normalized.split('-')[0] ?? 'en';

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const c of [normalized, language, THEME_DEFAULT_STORE_LOCALE, 'en']) {
    if (c && !seen.has(c)) {
      seen.add(c);
      candidates.push(c);
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Prototype-safe dot-path lookup
// ---------------------------------------------------------------------------

/**
 * Resolve a dot-separated key path against a locale dictionary.
 * Skips any segment that matches BLOCKED_PATH_SEGMENTS (prototype-pollution guard).
 * Returns undefined if any segment is missing or blocked.
 */
function lookupPath(dict: Record<string, unknown>, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((current, segment) => {
    if (BLOCKED_PATH_SEGMENTS.has(segment)) return undefined;
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, dict);
}

/**
 * Find the locale dictionary for a given candidate string.
 * Tries exact match first, then case-insensitive match.
 */
function resolveDict(
  locales: ThemeBundleLocaleMap,
  candidate: string,
): Record<string, unknown> | undefined {
  const exact = locales[candidate];
  if (exact && typeof exact === 'object' && !Array.isArray(exact)) {
    return exact as Record<string, unknown>;
  }

  // Case-insensitive fallback (e.g. 'EN-IN' matches 'en-IN')
  const lc = candidate.toLowerCase();
  const matchKey = Object.keys(locales).find((k) => k.toLowerCase() === lc);
  if (matchKey) {
    const v = locales[matchKey];
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// tLocale — primary translation resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a translation key against a locale bundle.
 *
 * @param key         Translation key with or without 't:' prefix.
 *                    Valid examples: 'general.cart', 't:general.cart'.
 *                    Invalid / unsafe keys are returned unchanged (no crash).
 * @param locale      BCP-47 locale tag (e.g. 'en-IN', 'hi-IN', 'en').
 *                    Defaults to 'en-IN' when null/undefined/empty.
 * @param locales     Locale dictionary map from the theme bundle (bundle.locales).
 *                    A bundle with no locales (or only 'en-IN') returns the default behaviour
 *                    byte-identically — no crash, no regression.
 * @param replacements Optional map for `{{ varname }}` placeholder interpolation in the
 *                    translated string (same syntax as the Liquid t filter).
 * @returns Resolved translation string, or the key path (without prefix) as fallback.
 *          Never throws.
 *
 * Fallback chain: [locale, language-tag, 'en-IN', 'en']
 *
 * Security:
 *  - Returns the raw locale string value. HTML escaping is the responsibility of the
 *    render layer (LiquidJS outputEscape:'escape' / sanitizeRenderedHtml).
 *  - Prototype-safe dot-path traversal (BLOCKED_PATH_SEGMENTS).
 *  - Key charset validated — invalid keys returned unchanged.
 */
export function tLocale(
  key: string,
  locale: string | null | undefined,
  locales: ThemeBundleLocaleMap,
  replacements?: Record<string, string | number>,
): string {
  // Validate and strip prefix. Invalid → return raw key as-is (never crash).
  const stripped = validateAndStripKey(key);
  if (stripped === null) return key;

  // Attempt resolution through the fallback chain.
  const candidates = buildCandidates(locale);
  let template: string | undefined;

  for (const candidate of candidates) {
    const dict = resolveDict(locales, candidate);
    if (!dict) continue;

    const value = lookupPath(dict, stripped);
    if (typeof value === 'string') {
      template = value;
      break;
    }
  }

  // Missing key: return the key path without 't:' prefix (not the literal 't:key').
  if (template === undefined) return stripped;

  // Apply {{ varname }} interpolation (same pattern the Liquid t filter in theme-renderer.ts uses).
  if (!replacements || Object.keys(replacements).length === 0) return template;
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, name: string) => {
    const r = replacements[name];
    return r === undefined || r === null ? match : String(r);
  });
}

// ---------------------------------------------------------------------------
// formatThemeCurrencyDisplay — presentational market display currency
// ---------------------------------------------------------------------------

/**
 * NOT-CONNECTED: Live FX rates are not available in this codebase.
 *
 * No conversion of canonical ledger amounts is performed by this function.
 * For non-INR display currencies, the amount is formatted in the target currency's
 * notation but the numeric value is the original INR minor-unit amount ÷ 100.
 * This is a DISPLAY-ONLY field; it must never be used as an authoritative checkout price.
 *
 * The canonical ledger (create_checkout_order etc.) is fully INR and is unaffected.
 *
 * Exact missing piece for real multi-currency display:
 *  - A server-side presentational FX rate source (e.g. Razorpay FX API or an fx_rates table).
 *  - A safe display-conversion helper clearly labelled 'presentational' that maps
 *    INR minor units → display currency units at the market's published rate.
 *  - Checkout continues to charge the server-authoritative INR amount regardless.
 * Until that source is wired, the displayed non-INR amount equals the INR amount
 * (same number, different currency label). UIs must clearly mark non-INR prices
 * as indicative / not guaranteed.
 */
const FX_NOT_CONNECTED_REASON =
  'Live FX rate source not connected. '
  + 'Missing: server-side fx_rates table or Razorpay FX API endpoint. '
  + 'The displayed amount is (INR minor units / 100) formatted in the display currency label '
  + 'without conversion — the canonical checkout price remains the server-authoritative INR amount.';

/** Structured result from formatThemeCurrencyDisplay. */
export interface ThemeCurrencyDisplayResult {
  /** Formatted string for display (e.g. 'INR 7,499.00' or 'USD 7,499.00'). */
  formatted: string;
  /**
   * Whether a live FX conversion was applied.
   * Always false — NOT-CONNECTED — until an FX source is wired server-side.
   */
  fxConnected: false;
  /**
   * Human-readable description of what is missing for live FX.
   * Present whenever fxConnected is false.
   */
  fxNotConnectedReason: string;
}

/**
 * Format an amount (in minor units, e.g. paise) for DISPLAY in a given currency and locale.
 *
 * PRESENTATIONAL ONLY. Does not convert the canonical INR ledger amount.
 *
 * For INR + en-IN (the India-first default): output is byte-identical to formatLiquidMoney
 * in theme-renderer.ts, e.g. formatThemeCurrencyDisplay(749900, 'INR', 'en-IN') → 'INR 7,499.00'.
 *
 * @param amountMinorUnits  Minor-unit amount (e.g. 749900 = ₹7,499.00).
 *                          Always the INR server-authoritative amount.
 * @param currencyCode      ISO 4217 currency code for display (e.g. 'INR', 'USD', 'EUR').
 *                          Defaults to 'INR'. Invalid codes fall back to 'INR'.
 * @param locale            BCP-47 locale for number formatting (defaults to 'en-IN').
 *                          Only affects non-INR formatting; INR always uses 'en-IN' for
 *                          byte-identity with the existing formatLiquidMoney.
 */
export function formatThemeCurrencyDisplay(
  amountMinorUnits: number | unknown,
  currencyCode: string | unknown = 'INR',
  locale: string | null | undefined = THEME_DEFAULT_STORE_LOCALE,
): ThemeCurrencyDisplayResult {
  const numeric = Number(amountMinorUnits);
  // Non-finite input (NaN, Infinity) formats as 0.00 — same behaviour as formatLiquidMoney.
  const amount = Number.isFinite(numeric) ? numeric / 100 : 0;

  // Validate currency code: must be exactly 3 uppercase ASCII letters (ISO 4217).
  const safeCurrency =
    typeof currencyCode === 'string' && /^[A-Z]{3}$/.test(currencyCode)
      ? currencyCode
      : 'INR';

  let formatted: string;

  if (safeCurrency === 'INR') {
    // INR path: byte-identical to formatLiquidMoney in theme-renderer.ts.
    // formatLiquidMoney: amount.toLocaleString('en-IN', { min: 2, max: 2 }) prefixed with 'INR '.
    // We always use 'en-IN' for INR regardless of the locale argument.
    const numStr = amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatted = `INR ${numStr}`;
  } else {
    // Non-INR: display-only, NOT-CONNECTED (no FX conversion applied).
    // The amount is INR minor units / 100 formatted in the display locale.
    const safeLocale = normalizeLocale(locale);
    const numStr = amount.toLocaleString(safeLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatted = `${safeCurrency} ${numStr}`;
  }

  return {
    formatted,
    fxConnected: false,
    fxNotConnectedReason: FX_NOT_CONNECTED_REASON,
  };
}
