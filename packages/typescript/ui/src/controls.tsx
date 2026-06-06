'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from './icons';
import { cx } from './utils';

export interface TabItem {
    value: string;
    label: string;
    badge?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    panelClassName?: string;
    content: React.ReactNode;
}

export interface TabsProps {
    items: TabItem[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    variant?: 'underline' | 'pills';
    ariaLabel?: string;
    panelClassName?: string;
    className?: string;
}

const tabVariantStyles: Record<NonNullable<TabsProps['variant']>, { list: string; tab: string; active: string; inactive: string }> = {
    underline: {
        list: 'gap-[var(--lb-space-2)] border-b border-[var(--lb-color-border)]',
        tab: 'border-b-2 px-[var(--lb-space-3)]',
        active: 'border-[var(--lb-color-primary)] text-[color:var(--lb-color-primary-text)]',
        inactive: 'border-transparent text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]',
    },
    pills: {
        list: 'gap-[var(--lb-space-2)]',
        tab: 'rounded-[var(--lb-radius-lg)] border px-[var(--lb-space-3)]',
        active: 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary-text)]',
        inactive: 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] hover:text-[color:var(--lb-color-text)]',
    },
};

function firstEnabledTabIndex(items: TabItem[]) {
    return items.findIndex((item) => !item.disabled);
}

function nextEnabledTabIndex(items: TabItem[], currentIndex: number, direction: 1 | -1) {
    if (items.length === 0) return -1;
    for (let attempts = 0; attempts < items.length; attempts += 1) {
        const nextIndex = (currentIndex + direction * (attempts + 1) + items.length) % items.length;
        if (!items[nextIndex]?.disabled) return nextIndex;
    }
    return -1;
}

export function Tabs({
    items,
    value,
    defaultValue,
    onValueChange,
    variant = 'underline',
    ariaLabel,
    panelClassName = '',
    className = '',
}: TabsProps) {
    const tabsId = useId();
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const fallbackItem = items.find((item) => item.value === defaultValue && !item.disabled)
        ?? items[firstEnabledTabIndex(items)]
        ?? items[0];
    const fallbackValue = fallbackItem?.value ?? '';
    const [internalValue, setInternalValue] = useState(fallbackValue);
    const activeValue = value ?? internalValue;
    const activeItem = items.find((item) => item.value === activeValue && !item.disabled) ?? fallbackItem;
    const activeIndex = items.findIndex((item) => item.value === activeItem?.value);
    const styles = tabVariantStyles[variant];

    const selectTab = (nextValue: string) => {
        const nextItem = items.find((item) => item.value === nextValue);
        if (!nextItem || nextItem.disabled) return;
        setInternalValue(nextItem.value);
        onValueChange?.(nextItem.value);
    };

    const moveFocus = (nextIndex: number) => {
        const boundedIndex = nextIndex;
        const nextItem = items[boundedIndex];
        if (!nextItem || nextItem.disabled) return;
        selectTab(nextItem.value);
        tabRefs.current[boundedIndex]?.focus();
    };

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (items.length === 0) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocus(nextEnabledTabIndex(items, index, 1));
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocus(nextEnabledTabIndex(items, index, -1));
        }
        if (event.key === 'Home') {
            event.preventDefault();
            moveFocus(firstEnabledTabIndex(items));
        }
        if (event.key === 'End') {
            event.preventDefault();
            const reversedIndex = [...items].reverse().findIndex((item) => !item.disabled);
            moveFocus(reversedIndex < 0 ? -1 : items.length - 1 - reversedIndex);
        }
    };

    return (
        <div className={cx('space-y-[var(--lb-space-4)]', className)}>
            <div role="tablist" aria-label={ariaLabel} className={cx('flex flex-wrap', styles.list)}>
                {items.map((item, index) => {
                    const active = item.value === activeItem?.value;
                    return (
                        <button
                            key={item.value}
                            ref={(node) => {
                                tabRefs.current[index] = node;
                            }}
                            id={`${tabsId}-tab-${index}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-disabled={item.disabled || undefined}
                            aria-controls={`${tabsId}-panel-${index}`}
                            tabIndex={active ? 0 : -1}
                            disabled={item.disabled}
                            className={cx(
                                'inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
                                styles.tab,
                                active ? styles.active : styles.inactive,
                            )}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                            onClick={() => selectTab(item.value)}
                        >
                            {item.icon && <span className="inline-flex shrink-0" aria-hidden="true">{item.icon}</span>}
                            {item.label}
                            {item.badge && (
                                <span className="rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {activeItem && (
                <div
                    id={`${tabsId}-panel-${activeIndex}`}
                    role="tabpanel"
                    aria-labelledby={`${tabsId}-tab-${activeIndex}`}
                    tabIndex={0}
                    className={cx('focus-visible:outline-none', panelClassName, activeItem.panelClassName)}
                >
                    {activeItem.content}
                </div>
            )}
        </div>
    );
}

export interface SelectOption {
    label: string;
    value: string;
    disabled?: boolean;
    description?: string;
    keywords?: string[];
    icon?: React.ReactNode;
}

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: React.ReactNode;
    description?: React.ReactNode;
    helperText?: React.ReactNode;
    error?: React.ReactNode;
    inputClassName?: string;
    labelClassName?: string;
    labelTextClassName?: string;
    wrapperClassName?: string;
    onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
    label,
    description,
    helperText,
    error,
    inputClassName = '',
    labelClassName = '',
    labelTextClassName = '',
    wrapperClassName = '',
    onCheckedChange,
    className = '',
    id,
    onChange,
    ...props
}: CheckboxProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [descriptionId, helperId, errorId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

    return (
        <div className={cx('flex flex-col gap-[var(--lb-space-1)]', className, wrapperClassName)}>
            <label className={cx('flex items-start gap-[var(--lb-space-3)]', props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', labelClassName)} htmlFor={inputId}>
                <input
                    id={inputId}
                    type="checkbox"
                    className={cx(
                        'mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 rounded-[var(--lb-radius-sm)] border-[var(--lb-color-border)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed',
                        inputClassName,
                    )}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : props['aria-invalid']}
                    onChange={(event) => {
                        onChange?.(event);
                        onCheckedChange?.(event.currentTarget.checked);
                    }}
                    {...props}
                />
                <span className="min-w-0">
                    <span className={cx('block text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]', labelTextClassName)}>
                        {label}
                    </span>
                    {description && (
                        <span id={descriptionId} className="block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                            {description}
                        </span>
                    )}
                </span>
            </label>
            {helperText && !error && (
                <p id={helperId} className="m-0 pl-[calc(var(--lb-size-icon-inline)+var(--lb-space-3))] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {helperText}
                </p>
            )}
            {error && (
                <p id={errorId} className="m-0 pl-[calc(var(--lb-size-icon-inline)+var(--lb-space-3))] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">
                    {error}
                </p>
            )}
        </div>
    );
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: React.ReactNode;
    description?: React.ReactNode;
    helperText?: React.ReactNode;
    error?: React.ReactNode;
    inputClassName?: string;
    labelClassName?: string;
    labelTextClassName?: string;
    wrapperClassName?: string;
    onCheckedChange?: (checked: boolean) => void;
}

export function Radio({
    label,
    description,
    helperText,
    error,
    inputClassName = '',
    labelClassName = '',
    labelTextClassName = '',
    wrapperClassName = '',
    onCheckedChange,
    className = '',
    id,
    onChange,
    ...props
}: RadioProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = description ? `${inputId}-description` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [descriptionId, helperId, errorId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

    return (
        <div className={cx('flex flex-col gap-[var(--lb-space-1)]', className, wrapperClassName)}>
            <label className={cx('flex items-start gap-[var(--lb-space-3)]', props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', labelClassName)} htmlFor={inputId}>
                <input
                    id={inputId}
                    type="radio"
                    className={cx(
                        'mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 border-[var(--lb-color-border)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed',
                        inputClassName,
                    )}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : props['aria-invalid']}
                    onChange={(event) => {
                        onChange?.(event);
                        onCheckedChange?.(event.currentTarget.checked);
                    }}
                    {...props}
                />
                <span className="min-w-0">
                    <span className={cx('block text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]', labelTextClassName)}>
                        {label}
                    </span>
                    {description && (
                        <span id={descriptionId} className="block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                            {description}
                        </span>
                    )}
                </span>
            </label>
            {helperText && !error && (
                <p id={helperId} className="m-0 pl-[calc(var(--lb-size-icon-inline)+var(--lb-space-3))] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {helperText}
                </p>
            )}
            {error && (
                <p id={errorId} className="m-0 pl-[calc(var(--lb-size-icon-inline)+var(--lb-space-3))] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">
                    {error}
                </p>
            )}
        </div>
    );
}

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    label?: React.ReactNode;
    description?: React.ReactNode;
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    wrapperClassName?: string;
    labelClassName?: string;
}

export function Switch({
    label,
    description,
    checked,
    defaultChecked = false,
    onCheckedChange,
    wrapperClassName = '',
    labelClassName = '',
    className = '',
    disabled,
    id,
    onClick,
    ...props
}: SwitchProps) {
    const generatedId = useId();
    const switchId = id ?? generatedId;
    const labelId = label ? `${switchId}-label` : undefined;
    const descriptionId = description ? `${switchId}-description` : undefined;
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const actualChecked = checked ?? internalChecked;

    const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        const nextChecked = !actualChecked;
        setInternalChecked(nextChecked);
        onCheckedChange?.(nextChecked);
    };

    return (
        <div className={cx('flex items-start gap-[var(--lb-space-3)]', disabled && 'opacity-60', wrapperClassName)}>
            <button
                id={switchId}
                type="button"
                role="switch"
                aria-checked={actualChecked}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                disabled={disabled}
                className={cx(
                    'relative mt-[2px] inline-flex h-[var(--lb-density-pill-height)] w-[calc(var(--lb-density-pill-height)*1.75)] shrink-0 rounded-[var(--lb-radius-full)] border border-transparent transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed',
                    actualChecked ? 'bg-[var(--lb-color-primary)]' : 'bg-[var(--lb-color-border)]',
                    className,
                )}
                onClick={toggle}
                {...props}
            >
                <span
                    className={cx(
                        'absolute top-1/2 h-[calc(var(--lb-density-pill-height)-6px)] w-[calc(var(--lb-density-pill-height)-6px)] -translate-y-1/2 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-sm)] transition-transform duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)]',
                        actualChecked ? 'translate-x-[calc(var(--lb-density-pill-height)*0.75)]' : 'translate-x-[3px]',
                    )}
                    aria-hidden="true"
                />
            </button>
            {(label || description) && (
                <label className={cx('grid min-w-0 gap-[var(--lb-space-1)]', disabled ? 'cursor-not-allowed' : 'cursor-pointer', labelClassName)} htmlFor={switchId}>
                    {label && (
                        <span id={labelId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                            {label}
                        </span>
                    )}
                    {description && (
                        <span id={descriptionId} className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                            {description}
                        </span>
                    )}
                </label>
            )}
        </div>
    );
}

export interface ChoiceListOption {
    label: React.ReactNode;
    value: string;
    description?: React.ReactNode;
    disabled?: boolean;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
}

export interface ChoiceListProps {
    options: ChoiceListOption[];
    title?: React.ReactNode;
    description?: React.ReactNode;
    helperText?: React.ReactNode;
    error?: React.ReactNode;
    name?: string;
    value?: string | string[];
    defaultValue?: string | string[];
    onChange?: (value: string | string[]) => void;
    multiple?: boolean;
    disabled?: boolean;
    requiredIndicator?: boolean;
    ariaLabel?: string;
    layout?: 'vertical' | 'horizontal';
    className?: string;
    optionClassName?: string;
    legendClassName?: string;
}

const choiceListLayoutStyles: Record<NonNullable<ChoiceListProps['layout']>, string> = {
    vertical: 'grid gap-[var(--lb-space-3)]',
    horizontal: 'flex flex-wrap gap-[var(--lb-space-3)]',
};

function normalizeChoiceListValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
}

export function ChoiceList({
    options,
    title,
    description,
    helperText,
    error,
    name,
    value,
    defaultValue,
    onChange,
    multiple = false,
    disabled = false,
    requiredIndicator = false,
    ariaLabel,
    layout = 'vertical',
    className = '',
    optionClassName = '',
    legendClassName = '',
}: ChoiceListProps) {
    const generatedId = useId();
    const [internalValue, setInternalValue] = useState<string[]>(normalizeChoiceListValue(defaultValue));
    const selectedValues = normalizeChoiceListValue(value ?? internalValue);
    const helperId = helperText && !error ? `${generatedId}-helper` : undefined;
    const errorId = error ? `${generatedId}-error` : undefined;
    const descriptionId = description ? `${generatedId}-description` : undefined;
    const describedBy = [descriptionId, helperId, errorId].filter(Boolean).join(' ') || undefined;
    const inputName = name ?? (multiple ? undefined : generatedId);

    const updateSelection = (optionValue: string, checked: boolean) => {
        const nextValue = multiple
            ? checked
                ? Array.from(new Set([...selectedValues, optionValue]))
                : selectedValues.filter((selectedValue) => selectedValue !== optionValue)
            : [optionValue];
        setInternalValue(nextValue);
        onChange?.(multiple ? nextValue : nextValue[0] ?? '');
    };

    return (
        <fieldset
            className={cx('min-w-0 border-0 p-0 m-0', className)}
            disabled={disabled}
            aria-label={!title ? ariaLabel : undefined}
            aria-describedby={describedBy}
        >
            {title && (
                <legend className={cx('mb-[var(--lb-space-1)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]', legendClassName)}>
                    {title}
                    {requiredIndicator && <span className="ml-[var(--lb-space-1)] text-[color:var(--lb-color-critical)]" aria-hidden="true">*</span>}
                </legend>
            )}
            {description && (
                <p id={descriptionId} className="m-0 mb-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {description}
                </p>
            )}
            <div className={choiceListLayoutStyles[layout]}>
                {options.map((option) => {
                    const checked = selectedValues.includes(option.value);
                    const optionDisabled = disabled || option.disabled;
                    return (
                        <label
                            key={option.value}
                            className={cx(
                                'flex min-w-[min(260px,100%)] items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)]',
                                checked && 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]',
                                optionDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[var(--lb-color-surface-subdued)]',
                                optionClassName,
                            )}
                        >
                            <input
                                type={multiple ? 'checkbox' : 'radio'}
                                name={inputName}
                                value={option.value}
                                checked={checked}
                                disabled={optionDisabled}
                                className={cx(
                                    'mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 border-[var(--lb-color-border)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed',
                                    multiple && 'rounded-[var(--lb-radius-sm)]',
                                )}
                                onChange={(event) => updateSelection(option.value, event.currentTarget.checked)}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 flex-wrap items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                    {option.icon && <span className="inline-flex shrink-0 text-[color:var(--lb-color-text-subdued)]" aria-hidden="true">{option.icon}</span>}
                                    <span>{option.label}</span>
                                    {option.badge}
                                </span>
                                {option.description && (
                                    <span className="mt-[var(--lb-space-1)] block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        {option.description}
                                    </span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>
            {helperText && !error && (
                <p id={helperId} className="m-0 mt-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {helperText}
                </p>
            )}
            {error && (
                <p id={errorId} className="m-0 mt-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">
                    {error}
                </p>
            )}
        </fieldset>
    );
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
    label?: string;
    helperText?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
    requiredIndicator?: boolean;
    labelAction?: React.ReactNode;
    prefixContent?: React.ReactNode;
    controlSize?: 'sm' | 'md' | 'lg';
    hideLabel?: boolean;
}

const selectControlSizeStyles: Record<NonNullable<SelectProps['controlSize']>, string> = {
    sm: 'h-[var(--lb-size-control-sm)] text-[length:var(--lb-font-size-caption)] rounded-[var(--lb-radius-md)]',
    md: 'h-[var(--lb-size-control-md)] text-[length:var(--lb-font-size-body)] rounded-[var(--lb-radius-lg)]',
    lg: 'h-[var(--lb-size-control-lg)] text-[length:var(--lb-font-size-body)] rounded-[var(--lb-radius-lg)]',
};

export function Select({
    label,
    helperText,
    error,
    options,
    placeholder,
    requiredIndicator = false,
    labelAction,
    prefixContent,
    controlSize = 'md',
    hideLabel = false,
    className = '',
    id,
    ...props
}: SelectProps) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText && !error ? `${selectId}-helper` : undefined;
    const describedBy = [errorId, helperId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
    const hasPrefixContent = Boolean(prefixContent);

    return (
        <div className="flex flex-col gap-[var(--lb-space-2)]">
            {label && (
                <div className={cx('flex items-center justify-between gap-[var(--lb-space-3)]', hideLabel && 'sr-only')}>
                    <label htmlFor={selectId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        {label}
                        {requiredIndicator && <span className="ml-[var(--lb-space-1)] text-[color:var(--lb-color-critical)]" aria-hidden="true">*</span>}
                    </label>
                    {labelAction}
                </div>
            )}
            <div className="relative">
                {prefixContent && (
                    <span className="pointer-events-none absolute left-[var(--lb-space-3)] top-1/2 z-[var(--lb-z-base)] -translate-y-1/2 text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                        {prefixContent}
                    </span>
                )}
                <select
                    id={selectId}
                    className={cx(
                        'w-full appearance-none border bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] pr-[var(--lb-space-7)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
                        selectControlSizeStyles[controlSize],
                        hasPrefixContent && 'pl-[var(--lb-space-7)]',
                        error ? 'border-[var(--lb-color-critical)]' : 'border-[var(--lb-color-border)]',
                        className,
                    )}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    aria-required={props.required || undefined}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-[var(--lb-space-3)] top-1/2 h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] -translate-y-1/2 text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
            </div>
            {error && <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>}
            {helperText && !error && <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>}
        </div>
    );
}

export interface ComboboxProps {
    id?: string;
    name?: string;
    label?: string;
    helperText?: string;
    error?: string;
    placeholder?: string;
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    emptyMessage?: string;
    loading?: boolean;
    loadingLabel?: string;
    disabled?: boolean;
    required?: boolean;
    requiredIndicator?: boolean;
    labelAction?: React.ReactNode;
    query?: string;
    defaultQuery?: string;
    onQueryChange?: (query: string) => void;
    className?: string;
    inputClassName?: string;
}

export function Combobox({
    id,
    name,
    label,
    helperText,
    error,
    placeholder = 'Search',
    options,
    value,
    onValueChange,
    emptyMessage = 'No results',
    loading = false,
    loadingLabel = 'Loading options',
    disabled = false,
    required = false,
    requiredIndicator = false,
    labelAction,
    query,
    defaultQuery = '',
    onQueryChange,
    className = '',
    inputClassName = '',
}: ComboboxProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const listboxId = `${inputId}-listbox`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
    const [internalQuery, setInternalQuery] = useState(defaultQuery);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const selected = options.find((option) => option.value === value);
    const currentQuery = query ?? internalQuery;
    const displayValue = currentQuery || selected?.label || '';
    const filteredOptions = useMemo(() => {
        const normalizedQuery = currentQuery.trim().toLowerCase();
        if (!normalizedQuery) return options;
        return options.filter((option) => `${option.label} ${option.description ?? ''} ${(option.keywords ?? []).join(' ')}`.toLowerCase().includes(normalizedQuery));
    }, [options, currentQuery]);
    const activeOption = activeIndex >= 0 ? filteredOptions[activeIndex] : undefined;

    const updateQuery = (nextQuery: string) => {
        setInternalQuery(nextQuery);
        onQueryChange?.(nextQuery);
    };

    const firstEnabledOptionIndex = () => filteredOptions.findIndex((option) => !option.disabled);

    const selectOption = (option: SelectOption) => {
        if (option.disabled) return;
        onValueChange?.(option.value);
        updateQuery(option.label);
        setOpen(false);
        setActiveIndex(-1);
    };

    const openWithFirstOption = () => {
        if (disabled) return;
        setOpen(true);
        setActiveIndex(firstEnabledOptionIndex());
    };

    const moveActiveOption = (direction: 1 | -1) => {
        if (filteredOptions.length === 0) {
            setActiveIndex(-1);
            return;
        }

        setOpen(true);
        setActiveIndex((current) => {
            let nextIndex = current < 0 ? (direction > 0 ? -1 : 0) : current;
            for (let attempts = 0; attempts < filteredOptions.length; attempts += 1) {
                nextIndex = (nextIndex + direction + filteredOptions.length) % filteredOptions.length;
                if (!filteredOptions[nextIndex]?.disabled) return nextIndex;
            }
            return -1;
        });
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActiveOption(1);
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActiveOption(-1);
        }
        if (event.key === 'Enter' && open && activeOption) {
            event.preventDefault();
            selectOption(activeOption);
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
        }
    };

    return (
        <div className={cx('relative flex flex-col gap-[var(--lb-space-2)]', className)}>
            {label && (
                <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                    <label htmlFor={inputId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        {label}
                        {requiredIndicator && <span className="ml-[var(--lb-space-1)] text-[color:var(--lb-color-critical)]" aria-hidden="true">*</span>}
                    </label>
                    {labelAction}
                </div>
            )}
            {name && <input type="hidden" name={name} value={value ?? ''} />}
            <input
                id={inputId}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-activedescendant={open && activeOption ? `${listboxId}-option-${activeIndex}` : undefined}
                aria-haspopup="listbox"
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                aria-required={required || undefined}
                autoComplete="off"
                disabled={disabled}
                className={cx(
                    'h-[var(--lb-size-control-md)] rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] placeholder:text-[color:var(--lb-color-text-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
                    error ? 'border-[var(--lb-color-critical)]' : 'border-[var(--lb-color-border)]',
                    inputClassName,
                )}
                placeholder={placeholder}
                value={displayValue}
                onChange={(event) => {
                    updateQuery(event.target.value);
                    setOpen(true);
                    setActiveIndex(firstEnabledOptionIndex());
                }}
                onFocus={openWithFirstOption}
                onKeyDown={handleKeyDown}
            />
            {open && (
                <div
                    id={listboxId}
                    role="listbox"
                    className="absolute top-[calc(100%+var(--lb-space-2))] z-[var(--lb-z-dropdown)] max-h-[var(--lb-size-combobox-menu-max-height)] w-full overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-1)] shadow-[var(--lb-shadow-lg)]"
                >
                    {loading ? (
                        <div className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                            {loadingLabel}
                        </div>
                    ) : filteredOptions.length === 0 ? (
                        <div className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                            {emptyMessage}
                        </div>
                    ) : (
                        filteredOptions.map((option, index) => (
                            <button
                                key={option.value}
                                id={`${listboxId}-option-${index}`}
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                className={cx(
                                    'flex w-full items-start justify-between gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:cursor-not-allowed disabled:opacity-50',
                                    activeIndex === index && 'bg-[var(--lb-color-surface-subdued)]',
                                )}
                                disabled={option.disabled}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectOption(option)}
                            >
                                <span className="flex min-w-0 items-start gap-[var(--lb-space-2)]">
                                    {option.icon && <span className="mt-[var(--lb-space-1)] shrink-0 text-[color:var(--lb-color-text-subdued)]" aria-hidden="true">{option.icon}</span>}
                                    <span className="min-w-0">
                                        <span className="block">{option.label}</span>
                                        {option.description && (
                                            <span className="block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                {option.description}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                {option.value === value && <Check className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0" aria-hidden="true" />}
                            </button>
                        ))
                    )}
                </div>
            )}
            {error && <p id={errorId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-critical)]">{error}</p>}
            {helperText && !error && <p id={helperId} className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{helperText}</p>}
        </div>
    );
}
