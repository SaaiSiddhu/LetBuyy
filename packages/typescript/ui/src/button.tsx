'use client';

import React from 'react';
import { Loader2 } from './icons';
import { cx } from './utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
    loadingLabel?: string;
    loadingPosition?: 'leading' | 'trailing';
    fullWidth?: boolean;
    icon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
    pressed?: boolean;
    justify?: 'center' | 'start' | 'between';
    wrap?: boolean;
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

const justifyStyles: Record<NonNullable<ButtonProps['justify']>, string> = {
    center: 'justify-center',
    start: 'justify-start text-left',
    between: 'justify-between text-left',
};

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingLabel = 'Loading',
    loadingPosition = 'leading',
    fullWidth = false,
    icon,
    trailingIcon,
    pressed,
    justify = 'center',
    wrap = false,
    className = '',
    disabled,
    children,
    ...props
}: ButtonProps) {
    const { 'aria-pressed': ariaPressed, ...buttonProps } = props;
    const loadingIndicator = (
        <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 animate-spin" aria-hidden="true" />
    );

    return (
        <button
            className={cx(
                'inline-flex items-center gap-[var(--lb-space-2)] border font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lb-color-bg)]',
                'disabled:pointer-events-none disabled:opacity-50',
                variantStyles[variant],
                sizeStyles[size],
                justifyStyles[justify],
                wrap && 'h-auto min-h-[var(--lb-size-control-md)] flex-wrap py-[var(--lb-space-2)]',
                fullWidth && 'w-full',
                className,
            )}
            disabled={disabled || loading}
            aria-pressed={pressed ?? ariaPressed}
            aria-busy={loading || undefined}
            {...buttonProps}
        >
            {loading && loadingPosition === 'leading' && loadingIndicator}
            {loading && !children && <span className="sr-only">{loadingLabel}</span>}
            {!loading && icon && <span className="inline-flex shrink-0" aria-hidden="true">{icon}</span>}
            {children}
            {!loading && trailingIcon && <span className="inline-flex shrink-0" aria-hidden="true">{trailingIcon}</span>}
            {loading && loadingPosition === 'trailing' && loadingIndicator}
        </button>
    );
}
