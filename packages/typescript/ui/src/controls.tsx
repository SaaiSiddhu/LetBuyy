'use client';

import React, { useId, useMemo, useState } from 'react';
import { Check, ChevronDown } from './icons';
import { cx } from './utils';

export interface TabItem {
    value: string;
    label: string;
    badge?: string;
    content: React.ReactNode;
}

export interface TabsProps {
    items: TabItem[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    className?: string;
}

export function Tabs({ items, value, defaultValue, onValueChange, className = '' }: TabsProps) {
    const fallbackValue = defaultValue ?? items[0]?.value ?? '';
    const [internalValue, setInternalValue] = useState(fallbackValue);
    const activeValue = value ?? internalValue;
    const activeItem = items.find((item) => item.value === activeValue) ?? items[0];

    const selectTab = (nextValue: string) => {
        setInternalValue(nextValue);
        onValueChange?.(nextValue);
    };

    return (
        <div className={cx('space-y-[var(--lb-space-4)]', className)}>
            <div role="tablist" className="flex flex-wrap gap-[var(--lb-space-2)] border-b border-[var(--lb-color-border)]">
                {items.map((item) => {
                    const active = item.value === activeItem?.value;
                    return (
                        <button
                            key={item.value}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={cx(
                                'inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] border-b-2 px-[var(--lb-space-3)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                active
                                    ? 'border-[var(--lb-color-primary)] text-[var(--lb-color-primary)]'
                                    : 'border-transparent text-[var(--lb-color-text-subdued)] hover:text-[var(--lb-color-text)]',
                            )}
                            onClick={() => selectTab(item.value)}
                        >
                            {item.label}
                            {item.badge && (
                                <span className="rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {activeItem && (
                <div role="tabpanel" className="focus-visible:outline-none">
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
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
    label?: string;
    helperText?: string;
    error?: string;
    options: SelectOption[];
}

export function Select({ label, helperText, error, options, className = '', id, ...props }: SelectProps) {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
        <div className="flex flex-col gap-[var(--lb-space-2)]">
            {label && (
                <label htmlFor={selectId} className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    id={selectId}
                    className={cx(
                        'h-[var(--lb-size-control-md)] w-full appearance-none rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] pr-[var(--lb-space-7)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-[var(--lb-color-critical)]' : 'border-[var(--lb-color-border)]',
                        className,
                    )}
                    aria-invalid={Boolean(error)}
                    {...props}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-[var(--lb-space-3)] top-1/2 h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] -translate-y-1/2 text-[var(--lb-color-text-subdued)]" aria-hidden="true" />
            </div>
            {error && <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-critical)]">{error}</p>}
            {helperText && !error && <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{helperText}</p>}
        </div>
    );
}

export interface ComboboxProps {
    label?: string;
    placeholder?: string;
    options: SelectOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    emptyMessage?: string;
    className?: string;
}

export function Combobox({
    label,
    placeholder = 'Search',
    options,
    value,
    onValueChange,
    emptyMessage = 'No results',
    className = '',
}: ComboboxProps) {
    const generatedId = useId();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value);
    const filteredOptions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return options;
        return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
    }, [options, query]);

    const selectOption = (option: SelectOption) => {
        if (option.disabled) return;
        onValueChange?.(option.value);
        setQuery(option.label);
        setOpen(false);
    };

    return (
        <div className={cx('relative flex flex-col gap-[var(--lb-space-2)]', className)}>
            {label && (
                <label htmlFor={generatedId} className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <input
                id={generatedId}
                role="combobox"
                aria-expanded={open}
                aria-controls={`${generatedId}-listbox`}
                className="h-[var(--lb-size-control-md)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)] placeholder:text-[var(--lb-color-text-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                placeholder={placeholder}
                value={query || selected?.label || ''}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
            />
            {open && (
                <div
                    id={`${generatedId}-listbox`}
                    role="listbox"
                    className="absolute top-[calc(100%+var(--lb-space-2))] z-40 max-h-[var(--lb-size-combobox-menu-max-height)] w-full overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-1)] shadow-[var(--lb-shadow-lg)]"
                >
                    {filteredOptions.length === 0 ? (
                        <div className="px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[var(--lb-font-size-body)] text-[var(--lb-color-text-subdued)]">
                            {emptyMessage}
                        </div>
                    ) : (
                        filteredOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                className="flex w-full items-center justify-between rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50"
                                disabled={option.disabled}
                                onClick={() => selectOption(option)}
                            >
                                {option.label}
                                {option.value === value && <Check className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
