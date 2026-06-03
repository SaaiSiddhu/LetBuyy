'use client';

import React from 'react';
import { Loader2 } from './icons';
import { cx } from './utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
    fullWidth?: boolean;
}

const variantStyles: Record<string, string> = {
    primary: 'border-[var(--lb-color-action-primary)] bg-[var(--lb-color-action-primary)] text-[color:var(--lb-color-action-primary-text)] hover:bg-[var(--lb-color-action-primary-hover)] shadow-[var(--lb-shadow-sm)]',
    secondary: 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
    outline: 'border-[var(--lb-color-border)] bg-transparent text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
    ghost: 'border-transparent bg-transparent text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
    destructive: 'border-[var(--lb-color-critical)] bg-[var(--lb-color-critical)] text-[color:var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-critical-hover)] shadow-[var(--lb-shadow-sm)]',
};

const sizeStyles: Record<string, string> = {
    sm: 'h-[var(--lb-size-control-sm)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] rounded-[var(--lb-radius-md)]',
    md: 'h-[var(--lb-size-control-md)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] rounded-[var(--lb-radius-lg)]',
    lg: 'h-[var(--lb-size-control-lg)] px-[var(--lb-space-5)] text-[length:var(--lb-font-size-body)] rounded-[var(--lb-radius-lg)]',
    icon: 'h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] rounded-[var(--lb-radius-lg)]',
};

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    className = '',
    disabled,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            className={cx(
                'inline-flex items-center justify-center gap-[var(--lb-space-2)] border font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lb-color-bg)]',
                'disabled:pointer-events-none disabled:opacity-50',
                variantStyles[variant],
                sizeStyles[size],
                fullWidth && 'w-full',
                className,
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin" aria-hidden="true" />
            )}
            {children}
        </button>
    );
}
