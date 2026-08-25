// T6/W3 — checkout.<root> is branded from merchant DATA (StoreBrandingSchema,
// packages/checkout-core/src/index.ts), never from merchant CSS. Every value here is
// re-validated at the point of use even though the gateway's StoreBrandingSchema (.strict())
// and assertBrandingIsDataOnly already validated it on write — a stored row is not a promise
// that a FUTURE read-path change can't accidentally skip validation, and this file has no way
// to prove at compile time that the JSON it receives really came through that schema.
import type { StoreBrandingInput } from '@letbuyy/checkout-core';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

// Mirrors the scheme allowlist packages/theme-engine/src/theme-renderer.ts's safeLiquidUrl
// enforces for Liquid-rendered image URLs (that function is package-private and not exported,
// so this is a small, deliberately narrow re-implementation, not a relaxed one): only an
// absolute http(s) URL, a protocol-relative URL, or a root-relative path may reach a rendered
// `src`/`href`. Anything else (javascript:, data:, vbscript:, a bare relative segment that could
// resolve unexpectedly) is rejected outright rather than "cleaned".
export function sanitizeBrandingUrl(value: unknown): string | null {
    const url = typeof value === 'string' ? value.trim() : '';
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return url;
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    return null;
}

export function sanitizeBrandingHexColor(value: unknown, fallback: string): string {
    const color = typeof value === 'string' ? value.trim() : '';
    return HEX_COLOR_PATTERN.test(color) ? color : fallback;
}

export function sanitizeCheckoutTheme(value: unknown): 'system' | 'light' | 'dark' {
    return value === 'light' || value === 'dark' ? value : 'system';
}

// Every string value in `tokens` is re-validated the same way logo/colour values are — nothing
// here is a free-form CSS or attribute injection point. A key or value that fails this check is
// dropped, not "escaped" — a dropped token degrades to the platform default for that one value,
// which is always safe; an escaped-but-attacker-chosen value is not a risk worth taking for a
// cosmetic token.
const SAFE_TOKEN_KEY = /^[a-z][a-z0-9-]{0,60}$/i;
const SAFE_TOKEN_STRING_VALUE = /^[a-zA-Z0-9#%.,\s()/_-]{0,120}$/;

export function sanitizeBrandingTokens(tokens: Record<string, string | number | boolean> | undefined): Record<string, string> {
    const safe: Record<string, string> = {};
    if (!tokens) return safe;
    for (const [key, value] of Object.entries(tokens)) {
        if (!SAFE_TOKEN_KEY.test(key)) continue;
        if (typeof value === 'number' || typeof value === 'boolean') {
            safe[key] = String(value);
            continue;
        }
        if (typeof value === 'string' && SAFE_TOKEN_STRING_VALUE.test(value)) {
            safe[key] = value;
        }
    }
    return safe;
}

export interface SanitizedBranding {
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    accentColor: string;
    checkoutTheme: 'system' | 'light' | 'dark';
    tokens: Record<string, string>;
}

const NEUTRAL_LETBUYY_PRIMARY = '#111827';
const NEUTRAL_LETBUYY_ACCENT = '#2563EB';

// A merchant with no branding row gets the neutral LetBuyy default — never a fabricated logo or
// an inferred colour. `store_branding` rows are created explicitly via PUT; an absent row is a
// real, valid "this merchant has not branded checkout yet" state, not an error.
export function sanitizeBranding(input: Partial<StoreBrandingInput> | null | undefined): SanitizedBranding {
    return {
        logoUrl: sanitizeBrandingUrl(input?.logo_url),
        faviconUrl: sanitizeBrandingUrl(input?.favicon_url),
        primaryColor: sanitizeBrandingHexColor(input?.primary_color, NEUTRAL_LETBUYY_PRIMARY),
        accentColor: sanitizeBrandingHexColor(input?.accent_color, NEUTRAL_LETBUYY_ACCENT),
        checkoutTheme: sanitizeCheckoutTheme(input?.checkout_theme),
        tokens: sanitizeBrandingTokens(input?.tokens),
    };
}

// Renders the branding as CSS custom properties via the `style` prop (a plain object React
// serializes itself — never a raw <style> block, and never string-concatenated into one), so a
// value that somehow survived sanitization still can't break out of a property value the way it
// could inside interpolated CSS text.
export function brandingCssVariables(branding: SanitizedBranding): React.CSSProperties {
    const vars: Record<string, string> = {
        '--primary': branding.primaryColor,
        '--accent-color': branding.accentColor,
    };
    for (const [key, value] of Object.entries(branding.tokens)) {
        vars[`--lb-checkout-token-${key}`] = value;
    }
    return vars as React.CSSProperties;
}
