'use client';

import React from 'react';
import { Loader2 } from './icons';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
    fullWidth?: boolean;
}

const variantStyles: Record<string, string> = {
    primary: 'bg-primary text-white hover:bg-primary/90 shadow-sm',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

const sizeStyles: Record<string, string> = {
    sm: 'h-8 px-3 text-xs rounded-md',
    md: 'h-10 px-4 text-sm rounded-lg',
    lg: 'h-12 px-6 text-base rounded-lg',
    icon: 'h-10 w-10 rounded-lg',
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
            className={[
                'inline-flex items-center justify-center font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-50',
                variantStyles[variant],
                sizeStyles[size],
                fullWidth ? 'w-full' : '',
                className,
            ].filter(Boolean).join(' ')}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {children}
        </button>
    );
}
