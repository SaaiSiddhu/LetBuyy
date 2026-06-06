'use client';

import React, { useId } from 'react';
import { AlertCircle } from './icons';
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
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
}: InputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy = [ariaDescribedBy, errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
        <div className="flex flex-col gap-[var(--lb-space-1)]">
            {label && (
                <label htmlFor={inputId} className="text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-[var(--lb-space-3)] top-1/2 -translate-y-1/2 text-[length:var(--lb-density-button-icon-size)] text-[color:var(--lb-color-text-subdued)]">
                        {leftIcon}
                    </div>
                )}
                <input
                    id={inputId}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : ariaInvalid}
                    className={cx(
                        'flex h-[var(--lb-density-input-height)] w-full rounded-[var(--lb-radius-lg)] border bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-input-text)]',
                        'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] file:border-0 file:bg-transparent file:text-[length:var(--lb-font-size-body)] file:font-[var(--lb-font-weight-medium)]',
                        'placeholder:text-[color:var(--lb-component-input-placeholder)]',
                        'focus-visible:outline-none focus-visible:border-[var(--lb-component-input-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--lb-component-input-focus-ring)]',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-[var(--lb-color-critical)] focus-visible:ring-[var(--lb-color-critical)]' : 'border-[var(--lb-component-input-border)]',
                        leftIcon ? 'pl-[var(--lb-space-7)]' : undefined,
                        rightIcon ? 'pr-[var(--lb-space-7)]' : undefined,
                        className,
                    )}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-[var(--lb-space-3)] top-1/2 -translate-y-1/2 text-[length:var(--lb-density-button-icon-size)] text-[color:var(--lb-color-text-subdued)]">
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
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    ...props
}: TextareaProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy = [ariaDescribedBy, errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
        <div className="flex flex-col gap-[var(--lb-space-1)]">
            {label && (
                <label htmlFor={inputId} className="text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <textarea
                id={inputId}
                aria-describedby={describedBy}
                aria-invalid={error ? true : ariaInvalid}
                className={cx(
                    'flex min-h-[calc(var(--lb-density-input-height)*2)] w-full rounded-[var(--lb-radius-lg)] border bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-component-input-text)]',
                    'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] placeholder:text-[color:var(--lb-component-input-placeholder)]',
                    'focus-visible:outline-none focus-visible:border-[var(--lb-component-input-focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--lb-component-input-focus-ring)]',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    error ? 'border-[var(--lb-color-critical)] focus-visible:ring-[var(--lb-color-critical)]' : 'border-[var(--lb-component-input-border)]',
                    className,
                )}
                {...props}
            />
            {error && <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>}
            {helperText && !error && <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>}
        </div>
    );
}

export interface InlineErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode;
}

export function InlineError({ children, className = '', ...props }: InlineErrorProps) {
    return (
        <p
            className={cx('m-0 inline-flex items-start gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]', className)}
            role="alert"
            {...props}
        >
            <AlertCircle className="mt-[2px] h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)] shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}

export interface NumberFieldProps extends Omit<InputProps, 'type' | 'value' | 'defaultValue' | 'onChange'> {
    value?: number | string;
    defaultValue?: number | string;
    min?: number;
    max?: number;
    step?: number;
    onValueChange?: (value: number | null, rawValue: string) => void;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export function NumberField({ value, defaultValue, min, max, step = 1, onValueChange, onChange, inputMode = 'decimal', ...props }: NumberFieldProps) {
    return (
        <Input
            {...props}
            type="number"
            inputMode={inputMode}
            value={value}
            defaultValue={defaultValue}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
                onChange?.(event);
                const rawValue = event.currentTarget.value;
                onValueChange?.(rawValue === '' ? null : Number(rawValue), rawValue);
            }}
        />
    );
}
