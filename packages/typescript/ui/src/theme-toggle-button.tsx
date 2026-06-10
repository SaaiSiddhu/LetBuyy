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
    const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

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
