// T6/W3, widened T8/W1-W2 — checkout.<root> is branded from merchant DATA (StoreBrandingSchema,
// packages/checkout-core/src/index.ts), never from merchant CSS. Every value here is
// re-validated at the point of use even though the gateway's StoreBrandingSchema (.strict())
// and assertBrandingIsDataOnly already validated it on write — a stored row is not a promise
// that a FUTURE read-path change can't accidentally skip validation, and this file has no way
// to prove at compile time that the JSON it receives really came through that schema.
//
// T8 — this file used to emit exactly 2 CSS variables (--primary, --accent-color). checkout-
// client.tsx's own utility classes (.text-theme, .text-theme-secondary, .text-theme-muted,
// .bg-surface, .card-theme, .card-theme-secondary — apps/storefront-runtime/src/app/globals.css:
// 71-120) read TEN MORE (--text, --text-secondary, --text-muted, --text-hint, --text-inverse,
// --surface, --surface-hover, --border-color, --card-bg, --card-bg-secondary, --card-text,
// --card-text-muted, --card-border) that nothing on the checkout-origin tree ever set — every
// one resolved empty, and an unresolved var() on an inherited property (color) computes as the
// inherited value, which upstream of any color-setting ancestor is whatever the platform default
// happens to be. The fix is not "set --text too" — it is a COMPLETE, self-contained token layer,
// computed with the exact same isDark-branching formula
// apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx:177-211 already uses for the real
// storefront, so checkout looks visually consistent with the merchant's own theme rather than
// inventing a second design language. globals.css's `.text-theme-*`/`.bg-surface`/`.card-theme*`
// utility classes are KEPT (not replaced with checkout-owned classes): they are neutral,
// reusable, already-tested infrastructure — the bug was that nothing supplied their variables on
// this tree, not that the classes themselves were wrong.
import type { ThemeSettings } from '@letbuyy/theme-engine';
import type { StoreBrandingInput } from '@letbuyy/checkout-core';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
// Mirrors packages/checkout-core/src/index.ts's FONT_FAMILY_PATTERN exactly — this is a second,
// independent enforcement point (defense in depth), not a relaxation of the write-time schema.
const FONT_FAMILY_PATTERN = /^[a-zA-Z0-9\s,-]{1,80}$/;
const EXTENDED_BRANDING_TOKEN_PREFIX = 'theme_override__';

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

export function sanitizeBrandingHexColor(value: unknown, fallback: string | null): string | null {
    const color = typeof value === 'string' ? value.trim() : '';
    if (HEX_COLOR_PATTERN.test(color)) return color;
    return fallback;
}

export function sanitizeCheckoutTheme(value: unknown): 'system' | 'light' | 'dark' {
    return value === 'light' || value === 'dark' ? value : 'system';
}

// A font-family value that reaches a CSS context is a CSS injection vector even when the only
// current consumer is a React `style` prop (which cannot itself be broken out of statement-by-
// statement) — the value could later be copied into a raw <style> block by a caller that never
// re-reads this comment. Reject anything outside letters/digits/spaces/hyphens/commas.
export function sanitizeBrandingFontFamily(value: unknown, fallback: string): string {
    const font = typeof value === 'string' ? value.trim() : '';
    return font && FONT_FAMILY_PATTERN.test(font) ? font : fallback;
}

export function sanitizeBrandingBorderRadius(value: unknown, fallback: number): number {
    const radius = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(radius)) return fallback;
    return Math.max(0, Math.min(32, radius));
}

export function sanitizeBrandingBool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
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
        if (key.startsWith(EXTENDED_BRANDING_TOKEN_PREFIX)) continue; // consumed separately below
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

// T8/W2 — the 7 extended StoreBrandingSchema fields physically persist inside `tokens` under this
// reserved prefix (services/api-gateway/src/routes/checkout.ts's packExtendedBrandingIntoTokens)
// because store_branding has no matching columns and this phase adds no migration. Unpack them
// back into a typed, partial StoreBrandingInput-shaped object here — the boundary this file
// sanitizes at doesn't care how the gateway physically stored them.
type ExtendedBrandingOverrides = Pick<
    StoreBrandingInput,
    'secondary_color' | 'background_color' | 'text_color' | 'surface_color' |
    'heading_font_family' | 'body_font_family' | 'border_radius' | 'is_dark'
>;

function unpackExtendedBrandingFromTokens(tokens: Record<string, unknown> | undefined): Partial<ExtendedBrandingOverrides> {
    const overrides: Partial<ExtendedBrandingOverrides> = {};
    if (!tokens) return overrides;
    const read = (key: string) => tokens[`${EXTENDED_BRANDING_TOKEN_PREFIX}${key}`];
    if (typeof read('secondary_color') === 'string') overrides.secondary_color = read('secondary_color') as string;
    if (typeof read('background_color') === 'string') overrides.background_color = read('background_color') as string;
    if (typeof read('text_color') === 'string') overrides.text_color = read('text_color') as string;
    if (typeof read('surface_color') === 'string') overrides.surface_color = read('surface_color') as string;
    if (typeof read('heading_font_family') === 'string') overrides.heading_font_family = read('heading_font_family') as string;
    if (typeof read('body_font_family') === 'string') overrides.body_font_family = read('body_font_family') as string;
    if (typeof read('border_radius') === 'number') overrides.border_radius = read('border_radius') as number;
    if (typeof read('is_dark') === 'boolean') overrides.is_dark = read('is_dark') as boolean;
    return overrides;
}

// ===== WCAG contrast (W2 "contrast is a correctness property") =====
// Standard relative-luminance + contrast-ratio formulas (WCAG 2.x), implemented directly —
// no new runtime dependency. AA for normal-size text is 4.5:1.
function hexToRgb(hex: string): [number, number, number] {
    const value = hex.replace('#', '');
    return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16),
    ];
}

function relativeLuminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex).map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hexA: string, hexB: string): number {
    const lumA = relativeLuminance(hexA);
    const lumB = relativeLuminance(hexB);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
}

const AA_CONTRAST_MINIMUM = 4.5;

// If the merchant's chosen text/background pair fails AA, fall back to whichever of pure
// black/white has the better contrast against that background — never render an unreadable
// payment page because of a merchant's colour choice. Returns the resolved text colour and
// whether a fallback was applied (surfaced for the completion-standard evidence table).
export function resolveAccessibleTextColor(textHex: string, backgroundHex: string): { color: string; fellBackToAA: boolean } {
    if (contrastRatio(textHex, backgroundHex) >= AA_CONTRAST_MINIMUM) {
        return { color: textHex, fellBackToAA: false };
    }
    const blackContrast = contrastRatio('#000000', backgroundHex);
    const whiteContrast = contrastRatio('#FFFFFF', backgroundHex);
    return { color: blackContrast >= whiteContrast ? '#000000' : '#FFFFFF', fellBackToAA: true };
}

export interface SanitizedBranding {
    logoUrl: string | null;
    faviconUrl: string | null;
    checkoutTheme: 'system' | 'light' | 'dark';
    tokens: Record<string, string>;
    isDark: boolean;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    surfaceColor: string;
    headingFontFamily: string;
    bodyFontFamily: string;
    borderRadius: number;
    contrastFallbackApplied: boolean;
}

// Neutral LetBuyy defaults — recognisably LetBuyy's own palette (matches the platform :root
// defaults in globals.css: --primary rgb(99 102 241), --background white), never a guess at any
// particular merchant's brand. Used whenever a value is absent from BOTH the branding override
// and the store's own resolved theme settings.
const NEUTRAL = {
    primaryColor: '#6366F1',
    secondaryColor: '#8B5CF6',
    accentColor: '#F472B6',
    backgroundColor: '#FFFFFF',
    textColor: '#0F172A',
    surfaceColor: '#F9FAFB',
    headingFontFamily: 'Inter',
    bodyFontFamily: 'Inter',
    borderRadius: 12,
};

// A merchant with no branding row AND no resolved theme settings gets the neutral LetBuyy
// default — never a fabricated logo or an inferred colour. `theme` is the store's own already-
// resolved ThemeSettings (apps/storefront-runtime/src/lib/store-service.ts's mapSupabaseToStore
// — the SAME data the merchant's real storefront renders from, no second configuration step);
// `input` is the store_branding row, which layers a checkout-specific override on top where a
// merchant has explicitly set one via PUT /stores/:storeId/branding.
export function sanitizeBranding(
    input: Partial<StoreBrandingInput> | null | undefined,
    theme: Partial<ThemeSettings> | null | undefined,
): SanitizedBranding {
    const overrides = unpackExtendedBrandingFromTokens(input?.tokens as Record<string, unknown> | undefined);

    const primaryColor = sanitizeBrandingHexColor(input?.primary_color, null)
        ?? sanitizeBrandingHexColor(theme?.primaryColor, NEUTRAL.primaryColor)!;
    const secondaryColor = sanitizeBrandingHexColor(overrides.secondary_color, null)
        ?? sanitizeBrandingHexColor(theme?.secondaryColor, NEUTRAL.secondaryColor)!;
    const accentColor = sanitizeBrandingHexColor(input?.accent_color, null)
        ?? sanitizeBrandingHexColor(theme?.accentColor, NEUTRAL.accentColor)!;
    const backgroundColor = sanitizeBrandingHexColor(overrides.background_color, null)
        ?? sanitizeBrandingHexColor(theme?.backgroundColor, NEUTRAL.backgroundColor)!;
    const rawTextColor = sanitizeBrandingHexColor(overrides.text_color, null)
        ?? sanitizeBrandingHexColor(theme?.textColor, NEUTRAL.textColor)!;
    const surfaceColor = sanitizeBrandingHexColor(overrides.surface_color, null)
        ?? sanitizeBrandingHexColor(theme?.surfaceColor, NEUTRAL.surfaceColor)!;
    const headingFontFamily = sanitizeBrandingFontFamily(overrides.heading_font_family ?? theme?.headingFontFamily, NEUTRAL.headingFontFamily);
    const bodyFontFamily = sanitizeBrandingFontFamily(overrides.body_font_family ?? theme?.fontFamily, NEUTRAL.bodyFontFamily);
    const borderRadius = sanitizeBrandingBorderRadius(overrides.border_radius ?? theme?.borderRadius, NEUTRAL.borderRadius);
    const isDark = sanitizeBrandingBool(overrides.is_dark ?? theme?.isDark, false);

    const { color: textColor, fellBackToAA } = resolveAccessibleTextColor(rawTextColor, backgroundColor);

    return {
        logoUrl: sanitizeBrandingUrl(input?.logo_url),
        faviconUrl: sanitizeBrandingUrl(input?.favicon_url),
        checkoutTheme: sanitizeCheckoutTheme(input?.checkout_theme),
        tokens: sanitizeBrandingTokens(input?.tokens as Record<string, string | number | boolean> | undefined),
        isDark,
        primaryColor,
        secondaryColor,
        accentColor,
        backgroundColor,
        textColor,
        surfaceColor,
        headingFontFamily,
        bodyFontFamily,
        borderRadius,
        contrastFallbackApplied: fellBackToAA,
    };
}

// Renders the full derived token set as CSS custom properties via the `style` prop (a plain
// object React serializes itself — never a raw <style> block, and never string-concatenated
// into one), so a value that somehow survived sanitization still can't break out of a property
// value the way it could inside interpolated CSS text. The derivation formulas for the
// isDark-branched values are the SAME ones apps/storefront-runtime/src/app/store/[subdomain]/
// layout.tsx:190-201 uses for the real storefront (header/footer-specific and <input>-specific
// variables are intentionally omitted — checkout renders neither theme chrome nor uses those
// tokens, confirmed by grepping checkout-client.tsx's own var()/utility-class usage).
//
// T8/W1 — the custom properties alone are NOT enough. apps/checkout-origin/layout.tsx sits
// inside the root app/layout.tsx's <LetbuyyThemeProvider>, whose own wrapper sets a real `color`
// (measured live: rgb(255,255,255), white — it targets the platform's own dark chrome elsewhere,
// e.g. the marketing/console shell) that every checkout element inherits by default UNLESS it
// uses one of the .text-theme-*/.card-theme utility classes explicitly. Elements that use no
// such class (confirmed live: checkout-client.tsx's plain `<h3 className="font-semibold text-sm
// ...">Delivering to</h3>` has no colour class at all) fell through to that inherited white —
// invisible on the white --background, same defect, different code path than the .text-theme-*
// one. Setting REAL `color`/`backgroundColor` here (mirroring layout.tsx:213-218's
// `body{color:var(--text);background-color:var(--background)}`) fixes inheritance at its root
// for every element on this tree, styled or not, closing the "zero dependence" requirement
// completely rather than only for elements that happen to opt into a theme utility class.
export function brandingCssVariables(branding: SanitizedBranding): React.CSSProperties {
    const { isDark, textColor, backgroundColor, surfaceColor } = branding;
    const vars: Record<string, string> = {
        '--primary': branding.primaryColor,
        '--secondary': branding.secondaryColor,
        '--accent-color': branding.accentColor,
        '--background': backgroundColor,
        '--text': textColor,
        '--radius': `${branding.borderRadius}px`,
        '--font-main': `${branding.bodyFontFamily}, system-ui, sans-serif`,
        '--font-heading': `${branding.headingFontFamily}, system-ui, sans-serif`,
        '--text-secondary': isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
        '--text-muted': isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
        '--text-hint': isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        '--text-inverse': isDark ? 'rgb(0 0 0)' : 'rgb(255 255 255)',
        '--border-color': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        '--surface': isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
        '--surface-hover': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        '--card-bg': isDark ? surfaceColor : 'rgb(255 255 255)',
        '--card-bg-secondary': isDark ? 'rgba(255,255,255,0.08)' : surfaceColor,
        '--card-text': isDark ? 'rgb(248 250 252)' : 'rgb(17 24 39)',
        '--card-text-muted': isDark ? 'rgb(148 163 184)' : 'rgb(107 114 128)',
        '--card-border': isDark ? 'rgba(255,255,255,0.1)' : 'rgb(229 231 235)',
    };
    for (const [key, value] of Object.entries(branding.tokens)) {
        vars[`--lb-checkout-token-${key}`] = value;
    }
    return {
        ...(vars as React.CSSProperties),
        color: textColor,
        backgroundColor,
    };
}
