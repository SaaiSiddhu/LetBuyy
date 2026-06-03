'use client';

import React from 'react';
import { useId } from 'react';
import { X } from './icons';
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
    trailingAction?: React.ReactNode;
    clearable?: boolean;
    clearLabel?: string;
    onClear?: () => void;
    showCharacterCount?: boolean;
    characterCountLabel?: (current: number, maxLength?: number) => string;
}

const inputSizeStyles: Record<NonNullable<InputProps['controlSize']>, string> = {
    sm: 'h-[var(--lb-size-control-sm)] text-[length:var(--lb-font-size-caption)]',
    md: 'h-[var(--lb-size-control-md)] text-[length:var(--lb-font-size-body)]',
    lg: 'h-[var(--lb-size-control-lg)] text-[length:var(--lb-font-size-body)]',
};

const textareaResizeStyles: Record<NonNullable<TextareaProps['resize']>, string> = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize',
};

function getFieldValueLength(value: unknown) {
    if (value === undefined || value === null) return 0;
    if (Array.isArray(value)) return value.join(', ').length;
    return String(value).length;
}

function formatCharacterCount(current: number, maxLength?: number) {
    return maxLength ? `${current}/${maxLength}` : String(current);
}

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
    trailingAction,
    clearable = false,
    clearLabel = 'Clear field',
    onClear,
    showCharacterCount = false,
    characterCountLabel,
    className = '',
    id,
    ...props
}: InputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const countId = showCharacterCount ? `${inputId}-count` : undefined;
    const describedBy = [errorId, helperId, countId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
    const hasLeadingContent = Boolean(leftIcon || prefixContent);
    const hasClearAction = Boolean(clearable && onClear);
    const hasTrailingContent = Boolean(rightIcon || suffixContent || trailingAction || hasClearAction);
    const hasComplexTrailingContent = Boolean(trailingAction || hasClearAction || (rightIcon && suffixContent));
    const characterCount = getFieldValueLength(props.value ?? props.defaultValue);
    const characterCountText = characterCountLabel
        ? characterCountLabel(characterCount, props.maxLength)
        : formatCharacterCount(characterCount, props.maxLength);

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
                        hasLeadingContent ? 'pl-[var(--lb-space-7)]' : undefined,
                        prefixContent && leftIcon ? 'pl-[calc(var(--lb-space-7)+var(--lb-space-4))]' : undefined,
                        hasTrailingContent ? 'pr-[var(--lb-space-7)]' : undefined,
                        hasComplexTrailingContent ? 'pr-[calc(var(--lb-space-7)+var(--lb-space-6))]' : undefined,
                        className,
                    )}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : props['aria-invalid']}
                    aria-required={requiredIndicator ? true : props['aria-required']}
                    {...props}
                />
                {hasTrailingContent && (
                    <div className="absolute right-[var(--lb-space-3)] top-1/2 flex -translate-y-1/2 items-center gap-[var(--lb-space-2)] text-[color:var(--lb-color-text-subdued)]">
                        {suffixContent && <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]">{suffixContent}</span>}
                        {rightIcon && <span className="inline-flex shrink-0" aria-hidden="true">{rightIcon}</span>}
                        {trailingAction && <div className="shrink-0">{trailingAction}</div>}
                        {hasClearAction && (
                            <button
                                type="button"
                                className="inline-flex h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] items-center justify-center rounded-[var(--lb-radius-sm)] text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={onClear}
                                disabled={props.disabled || props.readOnly}
                                aria-label={clearLabel}
                            >
                                <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                )}
            </div>
            {(error || helperText || showCharacterCount) && (
                <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                    {error ? (
                        <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>
                    ) : helperText ? (
                        <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>
                    ) : (
                        <span aria-hidden="true" />
                    )}
                    {showCharacterCount && (
                        <p id={countId} className="m-0 shrink-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{characterCountText}</p>
                    )}
                </div>
            )}
        </div>
    );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    helperText?: string;
    error?: string;
    labelAction?: React.ReactNode;
    requiredIndicator?: boolean;
    showCharacterCount?: boolean;
    characterCountLabel?: (current: number, maxLength?: number) => string;
    resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export function Textarea({
    label,
    helperText,
    error,
    labelAction,
    requiredIndicator = false,
    showCharacterCount = false,
    characterCountLabel,
    resize = 'vertical',
    className = '',
    id,
    ...props
}: TextareaProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const countId = showCharacterCount ? `${inputId}-count` : undefined;
    const describedBy = [errorId, helperId, countId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
    const characterCount = getFieldValueLength(props.value ?? props.defaultValue);
    const characterCountText = characterCountLabel
        ? characterCountLabel(characterCount, props.maxLength)
        : formatCharacterCount(characterCount, props.maxLength);

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
                    textareaResizeStyles[resize],
                    className,
                )}
                aria-describedby={describedBy}
                aria-invalid={error ? true : props['aria-invalid']}
                aria-required={requiredIndicator ? true : props['aria-required']}
                {...props}
            />
            {(error || helperText || showCharacterCount) && (
                <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                    {error ? (
                        <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>
                    ) : helperText ? (
                        <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>
                    ) : (
                        <span aria-hidden="true" />
                    )}
                    {showCharacterCount && (
                        <p id={countId} className="m-0 shrink-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{characterCountText}</p>
                    )}
                </div>
            )}
        </div>
    );
}
