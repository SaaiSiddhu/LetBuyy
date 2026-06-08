'use strict';

/**
 * LetBuyy Stylelint config — fences the CSS layer that ESLint cannot see.
 *
 * The ESLint plugin (@letbuyy/ui) governs colours in .ts/.tsx. This config
 * governs the remaining channel: hand-authored .css (notably each app's
 * globals.css), where raw rgb()/hex parallel "token" systems have historically
 * drifted from the canonical --lb-* tokens.
 *
 * Intent: raw colour values may only appear in the generated token stylesheet.
 * Everywhere else, reference a --lb-* custom property.
 *
 * To activate: `npm i -D stylelint` (workspace root) and add
 *   "lint:css": "stylelint \"apps/**/src/**/*.css\""
 * Generated token CSS and vendor files are ignored below.
 */
module.exports = {
    rules: {
        // Disallow raw hex colours — use var(--lb-color-*) instead.
        'color-no-hex': true,
        // Disallow named colours (white/black/red…) — use tokens.
        'color-named': 'never',
        // Disallow raw colour functions in declarations; the generated token
        // CSS is the only place raw rgb()/hsl() values are allowed.
        'declaration-property-value-disallowed-list': {
            '/.*/': [/(?<!var\([^)]*)\b(?:rgba?|hsla?)\(/],
        },
    },
    // Custom property *definitions* of the LetBuyy token set are exempt: the
    // generated token CSS is the single source of raw values.
    ignoreFiles: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/*token*.css',
        '**/letbuyy-tokens*.css',
    ],
    overrides: [
        {
            // The shared token/preset CSS is allowed to declare raw values once.
            files: ['packages/typescript/ui/**/*.css', 'config/tailwind/**/*.css'],
            rules: {
                'color-no-hex': null,
                'color-named': null,
                'declaration-property-value-disallowed-list': null,
            },
        },
    ],
};
