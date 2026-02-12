'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    helperText?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function Input({
    label,
    helperText,
    error,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
}: InputProps) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium text-foreground">
                    {label}
                </label>
            )}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {leftIcon}
                    </div>
                )}
                <input
                    id={inputId}
                    className={[
                        'flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm',
                        'transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium',
                        'placeholder:text-muted-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-red-500 focus-visible:ring-red-500' : 'border-input',
                        leftIcon ? 'pl-10' : '',
                        rightIcon ? 'pr-10' : '',
                        className,
                    ].filter(Boolean).join(' ')}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {rightIcon}
                    </div>
                )}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {helperText && !error && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
    );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    helperText?: string;
    error?: string;
}

export function Textarea({
    label,
    helperText,
    error,
    className = '',
    id,
    ...props
}: TextareaProps) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium text-foreground">
                    {label}
                </label>
            )}
            <textarea
                id={inputId}
                className={[
                    'flex min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-sm',
                    'transition-colors placeholder:text-muted-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    error ? 'border-red-500 focus-visible:ring-red-500' : 'border-input',
                    className,
                ].filter(Boolean).join(' ')}
                {...props}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            {helperText && !error && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
    );
}
