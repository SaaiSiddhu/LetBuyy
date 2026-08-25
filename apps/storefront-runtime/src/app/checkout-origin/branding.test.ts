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
// Run: npx tsx --tsconfig apps/storefront-runtime/tsconfig.json --test src/app/checkout-origin/branding.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
    sanitizeBranding,
    brandingCssVariables,
    contrastRatio,
    resolveAccessibleTextColor,
    sanitizeBrandingFontFamily,
    sanitizeBrandingHexColor,
} from './branding';

// Every custom property checkout-client.tsx's .text-theme-*/.bg-surface/.card-theme* utility
// classes read (apps/storefront-runtime/src/app/globals.css:71-120), plus the two the button/
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
    const theme = {
        isDark: false,
        textColor: '#1A202C',
        fontFamily: 'Inter',
        accentColor: '#00B4D8',
        borderRadius: 8,
        primaryColor: '#1E3A5F',
        surfaceColor: '#F0F4F8',
        bodyFontFamily: 'Inter',
        secondaryColor: '#1E40AF',
        backgroundColor: '#FFFFFF',
        headingFontFamily: 'Inter',
    };
    const branding = sanitizeBranding(null, theme);
    assert.equal(branding.textColor, '#1A202C');
    assert.equal(branding.backgroundColor, '#FFFFFF');
    assert.equal(branding.primaryColor, '#1E3A5F');
    assert.equal(branding.contrastFallbackApplied, false);
    const ratio = contrastRatio(branding.textColor, branding.backgroundColor);
    assert.ok(ratio >= 4.5, `resolved merchant text/background pair only reaches ${ratio.toFixed(2)}:1, below WCAG AA`);
});

test('W3: an unreadable merchant colour pair triggers the AA fallback and the resolved pair passes AA', () => {
    // Deliberately hostile: a merchant setting near-white text on a near-white background, the
    // exact class of misconfiguration W2 requires checkout to survive without ARB/human review.
    const hostileTheme = { textColor: '#FEFEFE', backgroundColor: '#FFFFFF' };
    const branding = sanitizeBranding(null, hostileTheme);
    assert.equal(branding.contrastFallbackApplied, true, 'a near-white-on-white pair must trigger the AA fallback');
    const ratio = contrastRatio(branding.textColor, branding.backgroundColor);
    assert.ok(ratio >= 4.5, `fallback pair only reaches ${ratio.toFixed(2)}:1, below WCAG AA — the fallback itself must be legible`);
    assert.ok(branding.textColor === '#000000' || branding.textColor === '#FFFFFF', 'fallback must resolve to pure black or white');
});

test('resolveAccessibleTextColor: picks whichever of black/white has better contrast, and only flags a fallback when needed', () => {
    const passing = resolveAccessibleTextColor('#000000', '#FFFFFF');
    assert.equal(passing.fellBackToAA, false);
    assert.equal(passing.color, '#000000');

    const failing = resolveAccessibleTextColor('#CCCCCC', '#FFFFFF');
    assert.equal(failing.fellBackToAA, true);
    assert.equal(failing.color, '#000000', 'black has better contrast than white against a light background');
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

test('a malformed hex colour is rejected and falls back, never reaching the rendered style', () => {
    assert.equal(sanitizeBrandingHexColor('not-a-color', '#FFFFFF'), '#FFFFFF');
    assert.equal(sanitizeBrandingHexColor('#12345', '#FFFFFF'), '#FFFFFF', 'a short hex must be rejected');
    assert.equal(sanitizeBrandingHexColor('#1a2b3c', '#FFFFFF'), '#1a2b3c', 'a valid lowercase hex must pass through');
});
