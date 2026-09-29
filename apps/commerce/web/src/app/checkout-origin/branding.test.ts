// T8/W3 — a regression guard for the invisible-text defect this phase fixed, not just the
// session's ad hoc browser checks. Two independent bugs made checkout text unreadable:
//   1. checkout-client.tsx's .text-theme-*/.bg-surface/.card-theme* utility classes read CSS
//      custom properties (--text, --surface, --card-bg, ...) that nothing on checkout-origin ever
//      set, so they resolved empty.
//   2. Plain elements with no theme utility class at all (e.g. a bare <h3>) inherited a real
//      `color: white` from LetbuyyThemeProvider's own wrapper further up the tree, which is
//      invisible on the white --background — custom properties alone can't fix this because
//      nothing consumes them; only a real `color`/`backgroundColor` property on this subtree's own
//      root closes it.
// This file asserts both mechanisms directly against branding.tsx's exported functions, plus the
// WCAG AA contrast fallback and the font-family injection guard from the same phase, without a
// browser — cheap enough to run on every change instead of only once in a session transcript.
//
// Run: npx tsx --tsconfig apps/commerce/web/tsconfig.json --test src/app/checkout-origin/branding.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { letbuyyColorTokens, letbuyyPrimitiveTokens } from '@letbuyy/ui/tokens';
import {
    sanitizeBranding,
    brandingCssVariables,
    contrastRatio,
    resolveAccessibleTextColor,
    sanitizeBrandingFontFamily,
    sanitizeBrandingHexColor,
} from './branding';

// The literal colour data these tests need -- merchant-supplied inputs, deliberately invalid inputs and
// the exact expected outputs -- lives in branding.fixtures.json (see its `purpose`). They must stay real
// #RRGGBB strings: replacing them with design tokens would make several assertions compare the
// implementation with itself, and the case-preservation and invalid-input cases have no token form.
type ThemeInput = NonNullable<Parameters<typeof sanitizeBranding>[1]>;
interface BrandingFixtures {
    merchantTheme: { input: ThemeInput; expected: { textColor: string; backgroundColor: string; primaryColor: string } };
    hostileTheme: { input: ThemeInput };
    pureColors: { black: string; white: string };
    accessibleTextColor: Array<{ why: string; text: string; background: string; expected: { color: string; fellBackToAA: boolean } }>;
    hexColorSanitization: Array<{ why: string; input: string; fallback: string; expected: string }>;
    lightThemeOverWhite: { input: ThemeInput };
}
const fixtures = JSON.parse(readFileSync(new URL('./branding.fixtures.json', import.meta.url), 'utf8')) as BrandingFixtures;

// rgba(0,0,0,alpha) or rgba(255,255,255,alpha) composited over a solid background reduces to a
// flat grey/tint whose hex is `background * (1-alpha) + channel * alpha` per channel — exact for
// these tiers since they're always pure black or pure white with no other tint.
function compositeRgbaOverHex(rgba: string, backgroundHex: string): string {
    const m = rgba.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
    if (!m) throw new Error(`not an rgba() string: ${rgba}`);
    const [, r, g, b, a] = m;
    const alpha = Number(a);
    const bg = [0, 2, 4].map((i) => parseInt(backgroundHex.slice(1 + i, 3 + i), 16));
    const fg = [Number(r), Number(g), Number(b)];
    const mixed = fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
    return '#' + mixed.map((c) => c.toString(16).padStart(2, '0')).join('');
}

// Every custom property checkout-client.tsx's .text-theme-*/.bg-surface/.card-theme* utility
// classes read (apps/commerce/web/src/app/globals.css:71-120), plus the two the button/
// accent inline styles use directly. A var() that resolves empty computes as the inherited value
// on an inherited property (color) — the exact shape of bug #1 above.
const CONSUMED_CUSTOM_PROPERTIES = [
    '--primary', '--accent-color', '--background', '--text', '--text-secondary', '--text-muted',
    '--text-hint', '--text-inverse', '--border-color', '--surface', '--surface-hover', '--card-bg',
    '--card-bg-secondary', '--card-text', '--card-text-muted', '--card-border',
] as const;

test('W3: every consumed custom property resolves non-empty for a store with no branding and no theme settings', () => {
    const branding = sanitizeBranding(null, null);
    const vars = brandingCssVariables(branding) as Record<string, string>;
    for (const prop of CONSUMED_CUSTOM_PROPERTIES) {
        const value = vars[prop];
        assert.ok(typeof value === 'string' && value.trim().length > 0, `${prop} resolved empty/missing — this is exactly the bug that made checkout text invisible`);
    }
});

test('W3: brandingCssVariables sets real color/backgroundColor properties, not only custom-property strings', () => {
    // Regression guard for bug #2: a plain element with no .text-theme-* class inherits `color`
    // from the nearest ancestor that sets a real CSS `color` property — custom properties are
    // invisible to inheritance unless something reads them via var(). Confirmed live during this
    // phase that LetbuyyThemeProvider's own wrapper sets a real `color: white` further up the
    // tree; only a real `color` here, closer to the checkout content, overrides that inheritance.
    const branding = sanitizeBranding(null, null);
    const style = brandingCssVariables(branding);
    assert.equal(style.color, branding.textColor, 'color must be a real CSS property equal to the resolved text colour, not just present as --text');
    assert.equal(style.backgroundColor, branding.backgroundColor, 'backgroundColor must be a real CSS property equal to the resolved background colour, not just present as --background');
});

test('W3: a merchant with no branding row and no theme settings is fully legible (neutral LetBuyy palette passes AA)', () => {
    const branding = sanitizeBranding(null, null);
    const ratio = contrastRatio(branding.textColor, branding.backgroundColor);
    assert.ok(ratio >= 4.5, `neutral text/background pair only reaches ${ratio.toFixed(2)}:1, below WCAG AA`);
    assert.equal(branding.contrastFallbackApplied, false, 'the neutral default pair should never need an AA fallback');
});

test('W3: a real resolved merchant theme (snaz-shaped) is legible and its colours flow through unchanged', () => {
    const { input: theme, expected } = fixtures.merchantTheme;
    const branding = sanitizeBranding(null, theme);
    assert.equal(branding.textColor, expected.textColor);
    assert.equal(branding.backgroundColor, expected.backgroundColor);
    assert.equal(branding.primaryColor, expected.primaryColor);
    assert.equal(branding.contrastFallbackApplied, false);
    const ratio = contrastRatio(branding.textColor, branding.backgroundColor);
    assert.ok(ratio >= 4.5, `resolved merchant text/background pair only reaches ${ratio.toFixed(2)}:1, below WCAG AA`);
});

test('W3: an unreadable merchant colour pair triggers the AA fallback and the resolved pair passes AA', () => {
    // Deliberately hostile: a merchant setting near-white text on a near-white background, the
    // exact class of misconfiguration W2 requires checkout to survive without ARB/human review.
    const branding = sanitizeBranding(null, fixtures.hostileTheme.input);
    assert.equal(branding.contrastFallbackApplied, true, 'a near-white-on-white pair must trigger the AA fallback');
    const ratio = contrastRatio(branding.textColor, branding.backgroundColor);
    assert.ok(ratio >= 4.5, `fallback pair only reaches ${ratio.toFixed(2)}:1, below WCAG AA — the fallback itself must be legible`);
    const { black, white } = fixtures.pureColors;
    assert.ok(branding.textColor === black || branding.textColor === white, 'fallback must resolve to pure black or white');
});

test('resolveAccessibleTextColor: picks whichever of black/white has better contrast, and only flags a fallback when needed', () => {
    // One passing pair and one failing pair; an emptied fixture must not turn this into a vacuous pass.
    assert.ok(fixtures.accessibleTextColor.some((c) => c.expected.fellBackToAA === false), 'the fixture must include a pair that passes AA as chosen');
    assert.ok(fixtures.accessibleTextColor.some((c) => c.expected.fellBackToAA === true), 'the fixture must include a pair that needs the AA fallback');
    for (const { why, text, background, expected } of fixtures.accessibleTextColor) {
        const resolved = resolveAccessibleTextColor(text, background);
        assert.equal(resolved.fellBackToAA, expected.fellBackToAA, why);
        assert.equal(resolved.color, expected.color, why);
    }
});

test('W2: a hostile font-family value crafted to break out of a CSS declaration is rejected, not passed through', () => {
    // The canonical CSS-injection shape T8 named: close the property, open a new selector/block.
    const hostile = 'Inter; } body { display:none } .a{';
    const sanitized = sanitizeBrandingFontFamily(hostile, 'Inter');
    assert.equal(sanitized, 'Inter', 'a font-family value containing CSS-breakout characters must fall back, never pass through');
    assert.ok(!sanitized.includes(';') && !sanitized.includes('{') && !sanitized.includes('}'), 'sanitized font-family must never contain CSS statement/block delimiters');
});

test('W2: sanitizeBranding rejects a hostile font-family end to end and still resolves a safe value', () => {
    const branding = sanitizeBranding(
        { tokens: { theme_override__heading_font_family: 'Comic; } * { color:red !important' } },
        null,
    );
    assert.equal(branding.headingFontFamily, 'Inter', 'an injected heading_font_family override must fall back to the neutral default, not reach the rendered style');
});

test('T9/W2: the neutral fallback palette traces to @letbuyy/ui/tokens, not standalone hex literals', () => {
    const branding = sanitizeBranding(null, null);
    assert.equal(branding.primaryColor, letbuyyColorTokens.primary, 'primaryColor must equal the token package\'s primary brand hue');
    assert.equal(branding.secondaryColor, letbuyyColorTokens.primaryHover, 'secondaryColor must equal the token package\'s primaryHover shade');
    assert.equal(branding.accentColor, letbuyyPrimitiveTokens.color.pink[400]);
    assert.equal(branding.textColor, letbuyyPrimitiveTokens.color.slate[900]);
    assert.equal(branding.surfaceColor, letbuyyPrimitiveTokens.color.gray[50]);
    assert.equal(branding.backgroundColor, letbuyyPrimitiveTokens.color.white);
});

test('a malformed hex colour is rejected and falls back, never reaching the rendered style', () => {
    // Rejected inputs must return the fallback; the valid lowercase input must return itself, case preserved.
    assert.ok(fixtures.hexColorSanitization.some((c) => c.expected === c.fallback), 'the fixture must include an input that is rejected');
    assert.ok(fixtures.hexColorSanitization.some((c) => c.expected === c.input), 'the fixture must include an input that passes through');
    for (const { why, input, fallback, expected } of fixtures.hexColorSanitization) {
        assert.equal(sanitizeBrandingHexColor(input, fallback), expected, why);
    }
});

// T9/W3 — checkout-client.tsx's ONE genuinely informational use of the muted text tier is the
// payment-step "{phone} • {email}" contact-confirmation line (line ~989); the other six uses
// (step-badge, form-field icons) are decorative. The tier is shared by class, so it must pass AA
// as a whole rather than only for that one consumer — this is the regression guard for that fix.
test('W3: --text-muted (light) passes AA against a white background — it carries the buyer contact-confirmation line', () => {
    const branding = sanitizeBranding(null, fixtures.lightThemeOverWhite.input);
    const vars = brandingCssVariables(branding) as Record<string, string>;
    const effectiveHex = compositeRgbaOverHex(vars['--text-muted'], branding.backgroundColor);
    const ratio = contrastRatio(effectiveHex, branding.backgroundColor);
    assert.ok(ratio >= 4.5, `--text-muted only reaches ${ratio.toFixed(2)}:1 against white, below WCAG AA — checkout's contact-confirmation line uses this tier`);
});

test('W3: --text-muted (dark) is raised by the same margin under --text-secondary as the light-mode fix (no live dark merchant to verify exact photometrics)', () => {
    const branding = sanitizeBranding(null, { isDark: true });
    const vars = brandingCssVariables(branding) as Record<string, string>;
    const secondaryAlpha = Number(vars['--text-secondary'].match(/,([\d.]+)\)$/)?.[1]);
    const mutedAlpha = Number(vars['--text-muted'].match(/,([\d.]+)\)$/)?.[1]);
    assert.ok(mutedAlpha > 0.5, 'dark --text-muted must be raised above its old 0.5 baseline');
    assert.ok(secondaryAlpha - mutedAlpha <= 0.05, 'dark --text-muted should track close under --text-secondary, matching the light-mode fix\'s margin');
});

test('W3: --text-hint has zero consumers anywhere in the checkout tree — decorative-only, left unraised', () => {
    const checkoutClientPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'store', '[subdomain]', 'checkout', 'checkout-client.tsx');
    const checkoutOriginDir = dirname(fileURLToPath(import.meta.url));
    const sources = [
        readFileSync(checkoutClientPath, 'utf8'),
        readFileSync(join(checkoutOriginDir, 'checkout', 'page.tsx'), 'utf8'),
        readFileSync(join(checkoutOriginDir, 'checkout-logo.tsx'), 'utf8'),
    ].join('\n');
    assert.ok(!sources.includes('text-theme-hint'), 'a new .text-theme-hint consumer appeared on checkout — the W3 decision to leave --text-hint unraised must be re-examined (does the new use carry information a buyer needs?)');
    assert.ok(!sources.includes('text-card-muted'), 'a new .text-card-muted consumer appeared on checkout — --card-text-muted was also left unraised on the same "zero consumers" basis and must be re-examined');
});
