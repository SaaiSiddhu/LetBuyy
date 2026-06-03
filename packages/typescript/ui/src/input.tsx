'use client';

import React from 'react';
import { useId } from 'react';
import { cx } from './utils';

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
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

    return (
        <div className="flex flex-col gap-[var(--lb-space-2)]">
            {label && (
                <label htmlFor={inputId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-[var(--lb-space-3)] top-1/2 -translate-y-1/2 text-[color:var(--lb-color-text-subdued)]">
                        {leftIcon}
                    </div>
                )}
                <input
                    id={inputId}
                    className={cx(
                        'flex h-[var(--lb-size-control-md)] w-full rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]',
                        'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] file:border-0 file:bg-transparent file:text-[length:var(--lb-font-size-body)] file:font-[var(--lb-font-weight-medium)]',
                        'placeholder:text-[color:var(--lb-color-text-subdued)]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-[var(--lb-color-critical)] focus-visible:ring-[var(--lb-color-critical)]' : 'border-[var(--lb-color-border)]',
                        leftIcon ? 'pl-[var(--lb-space-7)]' : undefined,
                        rightIcon ? 'pr-[var(--lb-space-7)]' : undefined,
                        className,
                    )}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : props['aria-invalid']}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-[var(--lb-space-3)] top-1/2 -translate-y-1/2 text-[color:var(--lb-color-text-subdued)]">
                        {rightIcon}
                    </div>
                )}
            </div>
            {error && <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>}
            {helperText && !error && <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>}
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
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

    return (
        <div className="flex flex-col gap-[var(--lb-space-2)]">
            {label && (
                <label htmlFor={inputId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <textarea
                id={inputId}
                className={cx(
                    'flex min-h-[calc(var(--lb-size-control-lg)*2)] w-full rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]',
                    'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] placeholder:text-[color:var(--lb-color-text-subdued)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    error ? 'border-[var(--lb-color-critical)] focus-visible:ring-[var(--lb-color-critical)]' : 'border-[var(--lb-color-border)]',
                    className,
                )}
                aria-describedby={describedBy}
                aria-invalid={error ? true : props['aria-invalid']}
                {...props}
            />
            {error && <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>}
            {helperText && !error && <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>}
        </div>
    );
}
