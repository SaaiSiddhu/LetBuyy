export const letbuyyFontCssVariables = {
    sans: '--font-letbuyy-sans',
    display: '--font-letbuyy-display',
    mono: '--font-letbuyy-mono',
} as const;

export const letbuyyFontStacks = {
    sans: 'var(--font-letbuyy-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: 'var(--font-letbuyy-display), var(--font-letbuyy-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'var(--font-letbuyy-mono), "SFMono-Regular", Consolas, "Liberation Mono", monospace',
} as const;

