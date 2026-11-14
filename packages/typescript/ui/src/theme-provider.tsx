'use client';

/**
 * LetbuyyThemeProvider — the single, canonical theme controller for every
 * LetBuyy web surface.
 *
 * It replaces the five hand-rolled, mutually-incompatible theme controllers the
 * apps previously shipped (see THEME_ARCHITECTURE_AUDIT.md THEME-2 and
 * LIGHT_DARK_MODE_AUDIT.md LDM-1/2/3). It owns:
 *
 *   • one persistence key:        localStorage["letbuyy-theme"]
 *   • one vocabulary:             "light" | "dark" | "system"
 *   • one set of DOM signals:     <html data-theme=…> + <html class="light|dark">
 *   • the resolved theme, which it feeds DIRECTLY into <DesignSystemRoot> so the
 *     design-system surface can never disagree with the page (fixes THEME-1 —
 *     the old `theme="auto"` default that overrode the html-level toggle).
 *
 * SSR/flash handling is centralised in <ThemeScript>, which every app renders
 * once in <head>. No app needs its own pre-paint script anymore.
 */

import React from 'react';
import { DesignSystemRoot } from './design-system-root';
import type { LetbuyyBrandInput, LetbuyyDensity, LetbuyySurface } from './tokens';

export type LetbuyyThemeChoice = 'light' | 'dark' | 'system';
export type LetbuyyResolvedTheme = 'light' | 'dark';

export const LETBUYY_THEME_STORAGE_KEY = 'letbuyy-theme';
export const LETBUYY_THEME_CHOICES: readonly LetbuyyThemeChoice[] = ['light', 'dark', 'system'] as const;

interface ThemeContextValue {
    /** The user's selected preference. */
    theme: LetbuyyThemeChoice;
    /** The concrete theme in effect right now ("system" resolved against the OS). */
    resolvedTheme: LetbuyyResolvedTheme;
    /** Persist + apply a new preference. */
    setTheme: (theme: LetbuyyThemeChoice) => void;
    /** The full set of selectable choices, for building toggles. */
    themes: readonly LetbuyyThemeChoice[];
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

interface GlobalWithResolvedTheme {
    __letbuyyResolvedTheme?: LetbuyyResolvedTheme;
}

function prefersDark(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveChoice(choice: LetbuyyThemeChoice): LetbuyyResolvedTheme {
    if (choice === 'system') return prefersDark() ? 'dark' : 'light';
    return choice;
}

function readStoredChoice(storageKey: string, fallback: LetbuyyThemeChoice): LetbuyyThemeChoice {
    if (typeof window === 'undefined') return fallback;
    try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
        /* localStorage can throw in private-mode / sandboxed iframes — fall through */
    }
    return fallback;
}

function applyDomSignals(resolved: LetbuyyResolvedTheme): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    // ThemeScript already applies these before first paint. Rewriting them on
    // hydration invalidates theme selectors across the whole document.
    if (root.getAttribute('data-theme') !== resolved) root.setAttribute('data-theme', resolved);
    const previous = resolved === 'dark' ? 'light' : 'dark';
    if (root.classList.contains(previous)) root.classList.remove(previous);
    if (!root.classList.contains(resolved)) root.classList.add(resolved);
    if (root.style.colorScheme !== resolved) root.style.colorScheme = resolved;
    (window as unknown as GlobalWithResolvedTheme).__letbuyyResolvedTheme = resolved;
}

export interface LetbuyyThemeProviderProps {
    children: React.ReactNode;
    /** Default preference when nothing is persisted. Defaults to "system". */
    defaultTheme?: LetbuyyThemeChoice;
    /** Forced theme override. When set, locks the theme to "light" or "dark" unconditionally, ignoring storage and OS preference. */
    forcedTheme?: LetbuyyResolvedTheme;
    /** Persistence key. Defaults to the canonical "letbuyy-theme". Do not override without reason. */
    storageKey?: string;
    /** Design-system surface forwarded to DesignSystemRoot. */
    surface?: LetbuyySurface;
    /** Density forwarded to DesignSystemRoot. */
    density?: LetbuyyDensity;
    /** Per-tenant brand forwarded to DesignSystemRoot. */
    brand?: LetbuyyBrandInput;
    /** Optional dir passthrough. */
    dir?: React.HTMLAttributes<HTMLDivElement>['dir'];
    /** className forwarded to the DesignSystemRoot wrapper. */
    className?: string;
}

/**
 * Wrap an app's body content in this once. It renders the design-system root
 * internally with the *resolved* theme, so callers never wire DesignSystemRoot
 * (or a theme prop) by hand again.
 */
export function LetbuyyThemeProvider({
    children,
    defaultTheme = 'system',
    forcedTheme,
    storageKey = LETBUYY_THEME_STORAGE_KEY,
    surface = 'admin',
    density = 'compact',
    brand,
    dir,
    className,
}: LetbuyyThemeProviderProps) {
    const [theme, setThemeState] = React.useState<LetbuyyThemeChoice>(() =>
        forcedTheme ?? readStoredChoice(storageKey, defaultTheme),
    );
    const [resolvedTheme, setResolvedTheme] = React.useState<LetbuyyResolvedTheme>(() => {
        if (forcedTheme) return forcedTheme;
        // Match the server on the first client render. The effect below then
        // applies the saved preference as a real React update. Reading storage
        // here left the root's server theme attribute unpatched on hydration,
        // mixing light status backgrounds with dark surface/text tokens.
        return defaultTheme === 'dark' ? 'dark' : 'light';
    });

    // Apply the resolved theme to the DOM whenever the preference changes.
    React.useEffect(() => {
        const resolved = forcedTheme ?? resolveChoice(theme);
        setResolvedTheme(resolved);
        applyDomSignals(resolved);
    }, [theme, forcedTheme]);

    // Track OS changes while on "system" (only when forcedTheme is not set).
    React.useEffect(() => {
        if (forcedTheme || theme !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
            const resolved = prefersDark() ? 'dark' : 'light';
            setResolvedTheme(resolved);
            applyDomSignals(resolved);
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [theme, forcedTheme]);

    const setTheme = React.useCallback(
        (next: LetbuyyThemeChoice) => {
            if (forcedTheme) return;
            try {
                window.localStorage.setItem(storageKey, next);
            } catch {
                /* ignore persistence failures (private mode) — in-memory state still updates */
            }
            setThemeState(next);
        },
        [storageKey, forcedTheme],
    );

    const effectiveThemes = React.useMemo<readonly LetbuyyThemeChoice[]>(
        () => (forcedTheme ? [forcedTheme] : LETBUYY_THEME_CHOICES),
        [forcedTheme],
    );

    const value = React.useMemo<ThemeContextValue>(
        () => ({ theme: forcedTheme ?? theme, resolvedTheme: forcedTheme ?? resolvedTheme, setTheme, themes: effectiveThemes }),
        [theme, resolvedTheme, setTheme, forcedTheme, effectiveThemes],
    );

    return (
        <ThemeContext.Provider value={value}>
            <DesignSystemRoot
                surface={surface}
                theme={forcedTheme ?? resolvedTheme}
                density={density}
                brand={brand}
                dir={dir}
                className={className}
            >
                {children}
            </DesignSystemRoot>
        </ThemeContext.Provider>
    );
}

/**
 * Read + control the current theme. Returns the user's choice, the resolved
 * concrete theme, a setter, and the list of choices for building toggles.
 */
export function useTheme(): ThemeContextValue {
    const ctx = React.useContext(ThemeContext);
    if (ctx === undefined) {
        throw new Error('useTheme must be used within a <LetbuyyThemeProvider>.');
    }
    return ctx;
}

export interface ThemeScriptProps {
    /** Must match the provider's storageKey. Defaults to the canonical key. */
    storageKey?: string;
    /** Default preference when nothing is persisted. Defaults to "system". */
    defaultTheme?: LetbuyyThemeChoice;
    /** Forced theme override. When set, unconditionally sets the DOM to "light" or "dark" during pre-paint. */
    forcedTheme?: LetbuyyResolvedTheme;
}

/**
 * Blocking, pre-paint script. Render once in <head>. It reads the persisted
 * choice, resolves it against the OS, sets <html data-theme> + class, and caches
 * the resolved value on window so the provider hydrates without a flash.
 *
 * This is the SINGLE flash-prevention implementation for the whole platform —
 * apps must not hand-roll their own (LIGHT_DARK_MODE_AUDIT.md THEME-4).
 */
export function ThemeScript({ storageKey = LETBUYY_THEME_STORAGE_KEY, defaultTheme = 'system', forcedTheme }: ThemeScriptProps) {
    const js = forcedTheme
        ? '(function(){try{' +
          'var r=' + JSON.stringify(forcedTheme) + ';' +
          'var e=document.documentElement;' +
          "e.setAttribute('data-theme',r);" +
          "e.classList.remove('light','dark');e.classList.add(r);" +
          'e.style.colorScheme=r;' +
          'window.__letbuyyResolvedTheme=r;' +
          '}catch(_){}})();'
        : '(function(){try{' +
          'var k=' + JSON.stringify(storageKey) + ';' +
          'var d=' + JSON.stringify(defaultTheme) + ';' +
          'var c=localStorage.getItem(k);' +
          "if(c!=='light'&&c!=='dark'&&c!=='system'){c=d;}" +
          "var r=c==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):c;" +
          'var e=document.documentElement;' +
          "e.setAttribute('data-theme',r);" +
          "e.classList.remove('light','dark');e.classList.add(r);" +
          'e.style.colorScheme=r;' +
          'window.__letbuyyResolvedTheme=r;' +
          '}catch(_){}})();';
    return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: js }} />;
}
