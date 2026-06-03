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
    prefixContent?: React.ReactNode;
    suffixContent?: React.ReactNode;
    labelAction?: React.ReactNode;
    requiredIndicator?: boolean;
    controlSize?: 'sm' | 'md' | 'lg';
}

const inputSizeStyles: Record<NonNullable<InputProps['controlSize']>, string> = {
    sm: 'h-[var(--lb-size-control-sm)] text-[length:var(--lb-font-size-caption)]',
    md: 'h-[var(--lb-size-control-md)] text-[length:var(--lb-font-size-body)]',
    lg: 'h-[var(--lb-size-control-lg)] text-[length:var(--lb-font-size-body)]',
};

export function Input({
    label,
    helperText,
    error,
    leftIcon,
    rightIcon,
    prefixContent,
    suffixContent,
    labelAction,
    requiredIndicator = false,
    controlSize = 'md',
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
            {(label || labelAction) && (
                <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                    {label ? (
                        <label htmlFor={inputId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                            {label}
                            {requiredIndicator && <span className="ml-[var(--lb-space-1)] text-[color:var(--lb-color-critical)]" aria-hidden="true">*</span>}
                        </label>
                    ) : <span />}
                    {labelAction && <div className="shrink-0">{labelAction}</div>}
                </div>
            )}
            <div className="relative">
                {(leftIcon || prefixContent) && (
                    <div className="absolute left-[var(--lb-space-3)] top-1/2 flex -translate-y-1/2 items-center gap-[var(--lb-space-2)] text-[color:var(--lb-color-text-subdued)]">
                        {leftIcon}
                        {prefixContent && <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]">{prefixContent}</span>}
                    </div>
                )}
                <input
                    id={inputId}
                    className={cx(
                        'flex w-full rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]',
                        inputSizeStyles[controlSize],
                        'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] file:border-0 file:bg-transparent file:text-[length:var(--lb-font-size-body)] file:font-[var(--lb-font-weight-medium)]',
                        'placeholder:text-[color:var(--lb-color-text-subdued)]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-[var(--lb-color-critical)] focus-visible:ring-[var(--lb-color-critical)]' : 'border-[var(--lb-color-border)]',
                        (leftIcon || prefixContent) ? 'pl-[var(--lb-space-7)]' : undefined,
                        prefixContent && leftIcon ? 'pl-[calc(var(--lb-space-7)+var(--lb-space-4))]' : undefined,
                        (rightIcon || suffixContent) ? 'pr-[var(--lb-space-7)]' : undefined,
                        suffixContent && rightIcon ? 'pr-[calc(var(--lb-space-7)+var(--lb-space-4))]' : undefined,
                        className,
                    )}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : props['aria-invalid']}
                    aria-required={requiredIndicator ? true : props['aria-required']}
                    {...props}
                />
                {(rightIcon || suffixContent) && (
                    <div className="absolute right-[var(--lb-space-3)] top-1/2 flex -translate-y-1/2 items-center gap-[var(--lb-space-2)] text-[color:var(--lb-color-text-subdued)]">
                        {suffixContent && <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]">{suffixContent}</span>}
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
    labelAction?: React.ReactNode;
    requiredIndicator?: boolean;
}

export function Textarea({
    label,
    helperText,
    error,
    labelAction,
    requiredIndicator = false,
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
            {(label || labelAction) && (
                <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                    {label ? (
                        <label htmlFor={inputId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                            {label}
                            {requiredIndicator && <span className="ml-[var(--lb-space-1)] text-[color:var(--lb-color-critical)]" aria-hidden="true">*</span>}
                        </label>
                    ) : <span />}
                    {labelAction && <div className="shrink-0">{labelAction}</div>}
                </div>
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
                aria-required={requiredIndicator ? true : props['aria-required']}
                {...props}
            />
            {error && <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>}
            {helperText && !error && <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>}
        </div>
    );
}
