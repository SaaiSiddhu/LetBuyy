'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
    theme: Theme
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('system')
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
    const [mounted, setMounted] = useState(false)

    // Get system preference
    const getSystemTheme = (): 'light' | 'dark' => {
        if (typeof window === 'undefined') return 'light'
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    // Initialize on mount
    useEffect(() => {
        setMounted(true)
        const stored = localStorage.getItem('theme') as Theme | null
        const initialTheme = stored || 'system'
        setThemeState(initialTheme)

        const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme
        setResolvedTheme(resolved)
        document.documentElement.setAttribute('data-theme', resolved)
    }, [])

    // Listen for system preference changes
    useEffect(() => {
        if (theme !== 'system') return

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = (e: MediaQueryListEvent) => {
            const newTheme = e.matches ? 'dark' : 'light'
            setResolvedTheme(newTheme)
            document.documentElement.setAttribute('data-theme', newTheme)
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [theme])

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        localStorage.setItem('theme', newTheme)

        const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
        setResolvedTheme(resolved)
        document.documentElement.setAttribute('data-theme', resolved)
    }

    // Prevent flash of wrong theme
    if (!mounted) {
        return (
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                        (function() {
                            const stored = localStorage.getItem('theme');
                            const theme = stored || 'system';
                            const resolved = theme === 'system' 
                                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                                : theme;
                            document.documentElement.setAttribute('data-theme', resolved);
                        })();
                    `,
                }}
            />
        )
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
