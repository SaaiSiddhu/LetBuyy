'use strict';

/**
 * tailwind-default-color-to-token
 *
 * Rewrites the most common Tailwind default-palette *neutral* utilities to the
 * token-backed utilities provided by config/tailwind/letbuyy-tokens.css, so they
 * become theme-aware (switch in dark mode) instead of bypassing --lb-* tokens.
 *
 * SCOPE IS DELIBERATELY CONSERVATIVE:
 *  - Only the gray neutral ramp + bg-white are mapped (the high-confidence cases).
 *  - text-white / bg-black are NOT mapped (often intentional inverse/overlay colour).
 *  - slate/zinc/coloured palettes are left for manual review.
 *  - Word boundaries (\b) prevent corrupting e.g. `bg-gray-500` when mapping `bg-gray-50`.
 *
 * Run AFTER the shared token preset is wired, and review visually (dark mode +
 * the surfaces touched) before committing — colour intent is occasionally
 * deliberate. Use the migrator: `node codemods/cli.mjs tailwind-default-color-to-token <path> --dry`.
 */
const replacements = [
    [/\bbg-white\b/g, 'bg-[var(--lb-color-surface)]'],
    [/\bbg-gray-50\b/g, 'bg-[var(--lb-color-surface-subdued)]'],
    [/\bbg-gray-100\b/g, 'bg-[var(--lb-color-surface-subdued)]'],
    [/\btext-gray-900\b/g, 'text-[color:var(--lb-color-text)]'],
    [/\btext-gray-800\b/g, 'text-[color:var(--lb-color-text)]'],
    [/\btext-gray-700\b/g, 'text-[color:var(--lb-color-text-subdued)]'],
    [/\btext-gray-600\b/g, 'text-[color:var(--lb-color-text-subdued)]'],
    [/\btext-gray-500\b/g, 'text-[color:var(--lb-color-text-subdued)]'],
    [/\btext-gray-400\b/g, 'text-[color:var(--lb-color-text-muted)]'],
    [/\bborder-gray-100\b/g, 'border-[var(--lb-color-border)]'],
    [/\bborder-gray-200\b/g, 'border-[var(--lb-color-border)]'],
    [/\bborder-gray-300\b/g, 'border-[var(--lb-color-border)]'],
];

module.exports = function transform(fileInfo) {
    let source = fileInfo.source;
    for (const [pattern, replacement] of replacements) {
        source = source.replace(pattern, replacement);
    }
    return source;
};

module.exports.replacements = replacements;
