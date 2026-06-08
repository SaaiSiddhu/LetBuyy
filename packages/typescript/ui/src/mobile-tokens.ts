// Canonical source for the LetBuyy mobile (Flutter) token set.
//
// Brand and status colours REFERENCE the shared web primitives, so they can
// never drift from the web design system. Mobile-specific values (accent pink,
// the Material-style slate surface ramp, the mobile spacing grid) are declared
// explicitly here in ONE place. The Dart file
// `apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart` is GENERATED
// from this module by `scripts/generators/generate-mobile-tokens.mjs` — do not hand-edit it.

import { letbuyyPrimitiveTokens } from './tokens';

const c = letbuyyPrimitiveTokens.color;

export const letbuyyMobileColorTokens = {
    // Brand — shared with web (primitive purple ramp)
    brandPrimary: c.purple[500],
    brandPrimaryLight: c.purple[400],
    brandPrimaryLighter: c.purple[300],
    brandPrimaryDark: c.purple[600],
    brandPrimaryDarker: c.purple[700],

    // Accent (mobile-specific)
    accentPink: '#EC4899',
    accentPinkLight: '#F472B6',
    accentPinkLighter: '#F9A8D4',
    accentPinkDark: '#DB2777',
    accentPinkDarker: '#BE185D',

    // Status — shared with web where defined
    success: c.green[500],
    successStrong: '#10B981',
    warning: c.amber[500],
    error: c.red[500],
    info: c.blue[500],
    cyan: '#06B6D4',
    teal: '#14B8A6',

    // Slate surface ramp (Material-style; mobile surfaces)
    slate950: '#020617',
    slate900: c.slate[900],
    slate800: c.slate[800],
    slate700: c.slate[700],
    slate600: c.slate[600],
    slate500: '#64748B',
    slate400: c.slate[400],
    slate300: c.slate[300],
    slate200: c.slate[200],
    slate100: '#F1F5F9',
    slate50: '#F8FAFC',

    white: c.white,
} as const;

export const letbuyyMobileSpacingTokens = {
    space0: 0,
    space2: 2,
    space4: 4,
    space6: 6,
    space8: 8,
    space12: 12,
    space16: 16,
    space20: 20,
    space24: 24,
    space32: 32,
    space40: 40,
    space48: 48,
    space64: 64,
} as const;
