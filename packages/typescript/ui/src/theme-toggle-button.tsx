'use client';

import React from 'react';
import { Button, type ButtonProps } from './button';
import { Monitor, Moon, Sun } from './icons';
import { useTheme } from './theme-provider';
import { cx } from './utils';

export interface ThemeToggleButtonProps extends Omit<ButtonProps, 'aria-label' | 'children' | 'onClick' | 'size' | 'type'> {
    label?: string;
}

export function ThemeToggleButton({
    className,
    label = 'Toggle theme',
    variant = 'outline',
    ...props
}: ThemeToggleButtonProps) {
    const { resolvedTheme, setTheme, theme } = useTheme();
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

    /*
     * The icon cannot be derived from the theme until after hydration.
     *
     * On the server `readStoredChoice` has no `window`, so the provider falls
     * back to `defaultTheme` ("system") and this renders <Monitor>. The client's
     * useState initializer then re-runs, reads localStorage, and gets "dark" —
     * so the first client render wants <Moon>. Those are different SVG children,
     * not just different attributes, so React cannot patch them and throws away
     * the whole tree with a hydration mismatch.
     *
     * Gating on a mount flag makes the server render and the first client render
     * agree (both <Monitor>); the real icon is swapped in one frame later. The
     * click handler is unaffected, because `resolvedTheme` is already correct on
     * the client even before this flips.
     */
    const [hydrated, setHydrated] = React.useState(false);
    React.useEffect(() => {
        setHydrated(true);
    }, []);

    const Icon = !hydrated ? Monitor : theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

    return (
        <Button
            {...props}
            type="button"
            size="icon"
            variant={variant}
            aria-label={label}
            title={label}
            className={cx('min-h-11 min-w-11 shrink-0', className)}
            onClick={() => setTheme(nextTheme)}
        >
            <Icon size={18} aria-hidden="true" />
        </Button>
    );
}
