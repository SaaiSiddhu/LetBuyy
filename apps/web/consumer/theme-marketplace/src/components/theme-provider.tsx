'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const ctx = useContext(ThemeCtx);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}

function getSystemPref(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

    // Read persisted preference on mount
    useEffect(() => {
        const stored = localStorage.getItem('theme-marketplace-theme') as Theme | null;
        if (stored && ['light', 'dark', 'system'].includes(stored)) {
            setThemeState(stored);
        }
    }, []);

    // Apply class + listen for system changes
    useEffect(() => {
        const apply = () => {
            const resolved = theme === 'system' ? getSystemPref() : theme;
            setResolvedTheme(resolved);
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(resolved);
        };

        apply();

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => { if (theme === 'system') apply(); };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('theme-marketplace-theme', t);
    };

    return (
        <ThemeCtx.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeCtx.Provider>
    );
}
