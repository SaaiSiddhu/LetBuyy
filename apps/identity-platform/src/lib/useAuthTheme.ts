'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@letbuyy/ui';

/**
 * Auth-surface theme toggle, backed by the canonical LetbuyyThemeProvider.
 *
 * The auth pages previously toggled the `.dark` class on <html> directly, which
 * left the design-system root (and therefore @letbuyy/ui components like Banner)
 * on a stale theme — see docs/governance/skipped-human-decisions.md D4. Routing
 * the toggle through `useTheme().setTheme` keeps the provider, the <html> signal,
 * and every design-system component in sync.
 *
 * Hydration: the provider hydrates `resolvedTheme` to the user's *real* theme on
 * the first client render (ThemeScript caches it pre-paint on
 * window.__letbuyyResolvedTheme), while the server always renders the provider's
 * SSR assumption ("system" → "light", i.e. not dark). Markup that branches on the
 * theme — e.g. swapping the Sun/Moon toggle icon, which changes the SVG element
 * tree — therefore mismatched during hydration. We gate `isDark` behind a mount
 * flag so the first client render matches the server (isDark=false), then flip to
 * the real value in an effect. Colours are unaffected: they come from the <html>
 * data-theme/class the ThemeScript sets pre-paint, not from this value.
 */
export function useAuthTheme(): { isDark: boolean; toggleTheme: () => void } {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    const isDark = mounted && resolvedTheme === 'dark';
    return {
        isDark,
        toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    };
}
