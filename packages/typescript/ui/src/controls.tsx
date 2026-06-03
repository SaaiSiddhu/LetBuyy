'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
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
    const tabsId = useId();
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const fallbackValue = defaultValue ?? items[0]?.value ?? '';
    const [internalValue, setInternalValue] = useState(fallbackValue);
    const activeValue = value ?? internalValue;
    const activeItem = items.find((item) => item.value === activeValue) ?? items[0];
    const activeIndex = Math.max(items.findIndex((item) => item.value === activeItem?.value), 0);

    const selectTab = (nextValue: string) => {
        setInternalValue(nextValue);
        onValueChange?.(nextValue);
    };

    const moveFocus = (nextIndex: number) => {
        const boundedIndex = (nextIndex + items.length) % items.length;
        const nextItem = items[boundedIndex];
        if (!nextItem) return;
        selectTab(nextItem.value);
        tabRefs.current[boundedIndex]?.focus();
    };

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (items.length === 0) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            moveFocus(index + 1);
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveFocus(index - 1);
        }
        if (event.key === 'Home') {
            event.preventDefault();
            moveFocus(0);
        }
        if (event.key === 'End') {
            event.preventDefault();
            moveFocus(items.length - 1);
        }
    };

    return (
        <div className={cx('space-y-[var(--lb-space-4)]', className)}>
            <div role="tablist" className="flex flex-wrap gap-[var(--lb-space-2)] border-b border-[var(--lb-color-border)]">
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
                            aria-controls={`${tabsId}-panel-${index}`}
                            tabIndex={active ? 0 : -1}
                            className={cx(
                                'inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] border-b-2 px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                active
                                    ? 'border-[var(--lb-color-primary)] text-[color:var(--lb-color-primary)]'
                                    : 'border-transparent text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]',
                            )}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                            onClick={() => selectTab(item.value)}
                        >
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
                <div id={`${tabsId}-panel-${activeIndex}`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${activeIndex}`} tabIndex={0} className="focus-visible:outline-none">
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
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText && !error ? `${selectId}-helper` : undefined;
    const describedBy = [errorId, helperId, props['aria-describedby']].filter(Boolean).join(' ') || undefined;

    return (
        <div className="flex flex-col gap-[var(--lb-space-2)]">
            {label && (
                <label htmlFor={selectId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    id={selectId}
                    className={cx(
                        'h-[var(--lb-size-control-md)] w-full appearance-none rounded-[var(--lb-radius-lg)] border bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] pr-[var(--lb-space-7)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',
                        error ? 'border-[var(--lb-color-critical)]' : 'border-[var(--lb-color-border)]',
                        className,
                    )}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    {...props}
                >
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
    const listboxId = `${generatedId}-listbox`;
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const selected = options.find((option) => option.value === value);
    const filteredOptions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return options;
        return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
    }, [options, query]);
    const activeOption = activeIndex >= 0 ? filteredOptions[activeIndex] : undefined;

    const selectOption = (option: SelectOption) => {
        if (option.disabled) return;
        onValueChange?.(option.value);
        setQuery(option.label);
        setOpen(false);
        setActiveIndex(-1);
    };

    const openWithFirstOption = () => {
        setOpen(true);
        setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
    };

    const moveActiveOption = (direction: 1 | -1) => {
        if (filteredOptions.length === 0) {
            setActiveIndex(-1);
            return;
        }

        setOpen(true);
        setActiveIndex((current) => {
            const nextIndex = current < 0 ? 0 : (current + direction + filteredOptions.length) % filteredOptions.length;
            return nextIndex;
        });
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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
                <label htmlFor={generatedId} className="text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                    {label}
                </label>
            )}
            <input
                id={generatedId}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-activedescendant={open && activeOption ? `${listboxId}-option-${activeIndex}` : undefined}
                aria-haspopup="listbox"
                autoComplete="off"
                className="h-[var(--lb-size-control-md)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] placeholder:text-[color:var(--lb-color-text-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                placeholder={placeholder}
                value={query || selected?.label || ''}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                    setActiveIndex(0);
                }}
                onFocus={openWithFirstOption}
                onKeyDown={handleKeyDown}
            />
            {open && (
                <div
                    id={listboxId}
                    role="listbox"
                    className="absolute top-[calc(100%+var(--lb-space-2))] z-40 max-h-[var(--lb-size-combobox-menu-max-height)] w-full overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-1)] shadow-[var(--lb-shadow-lg)]"
                >
                    {filteredOptions.length === 0 ? (
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
                                    'flex w-full items-center justify-between rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50',
                                    activeIndex === index && 'bg-[var(--lb-color-surface-subdued)]',
                                )}
                                disabled={option.disabled}
                                onMouseDown={(event) => event.preventDefault()}
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
