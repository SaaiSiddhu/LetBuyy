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
    primary: 'border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] text-[color:var(--lb-component-button-primary-text)] hover:bg-[var(--lb-component-button-primary-hover)] active:bg-[var(--lb-component-button-primary-active)]',
    secondary: 'border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] text-[color:var(--lb-component-button-secondary-text)] hover:bg-[var(--lb-component-button-secondary-hover)]',
    outline: 'border-[var(--lb-color-border)] bg-transparent text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
    ghost: 'border-transparent bg-transparent text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
    destructive: 'border-[var(--lb-color-critical)] bg-[var(--lb-color-critical)] text-[color:var(--lb-color-text-inverse)] hover:bg-[var(--lb-color-critical-hover)]',
};

const sizeStyles: Record<string, string> = {
    sm: 'h-[var(--lb-density-icon-button-height)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] rounded-[var(--lb-radius-md)]',
    md: 'h-[var(--lb-density-button-height)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] rounded-[var(--lb-radius-md)]',
    lg: 'h-[var(--lb-density-button-height-large)] px-[var(--lb-space-4)] text-[length:var(--lb-font-size-body)] rounded-[var(--lb-radius-md)]',
    icon: 'h-[var(--lb-density-icon-button-height)] w-[var(--lb-density-icon-button-height)] rounded-[var(--lb-radius-md)]',
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
                'inline-flex items-center justify-center gap-[var(--lb-space-2)] border font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-out)] [&_.letbuyy-icon]:h-[var(--lb-density-button-icon-size)] [&_.letbuyy-icon]:w-[var(--lb-density-button-icon-size)]',
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
