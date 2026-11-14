'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    Command,
    Loader2,
    Search,
} from './icons';
import { Badge, Skeleton } from './feedback';
import { Button } from './button';
import { Checkbox, Select } from './controls';
import { cx } from './utils';
import { useDismiss, useFocusTrap } from './overlay-hooks';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
    value: string;
    delta?: string;
    deltaTone?: 'positive' | 'negative' | 'neutral';
    sparkline?: number[];
}

export function MetricCard({ label, value, delta, deltaTone = 'neutral', sparkline, className = '', ...props }: MetricCardProps) {
    const points = useMemo(() => {
        if (!sparkline || sparkline.length === 0) return '';
        const max = Math.max(...sparkline);
        const min = Math.min(...sparkline);
        const range = max - min || 1;
        return sparkline
            .map((point, index) => {
                const x = (index / Math.max(sparkline.length - 1, 1)) * 100;
                const y = 42 - ((point - min) / range) * 34;
                return `${x},${y}`;
            })
            .join(' ');
    }, [sparkline]);

    return (
        <div
            className={cx(
                'rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-card-border)] bg-[var(--lb-component-card-bg)] p-[var(--lb-density-card-padding)] text-[color:var(--lb-component-card-text)] shadow-[var(--lb-component-card-shadow)]',
                className,
            )}
            {...props}
        >
            <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                <div className="space-y-[var(--lb-space-1)]">
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {label}
                    </p>
                    <p className="m-0 text-[length:var(--lb-font-size-h2)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-h2)] text-[color:var(--lb-color-text)]">
                        {value}
                    </p>
                    {delta && (
                        <p
                            className={cx(
                                'm-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)]',
                                deltaTone === 'positive' && 'text-[color:var(--lb-color-success)]',
                                deltaTone === 'negative' && 'text-[color:var(--lb-color-critical)]',
                                deltaTone === 'neutral' && 'text-[color:var(--lb-color-text-subdued)]',
                            )}
                        >
                            {delta}
                        </p>
                    )}
                </div>
                {points && (
                    <svg viewBox="0 0 100 48" className="h-[var(--lb-size-metric-sparkline-height)] w-[var(--lb-size-metric-sparkline-width)] text-[color:var(--lb-color-primary)]" aria-hidden="true">
                        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>
        </div>
    );
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    name: string;
    imageUrl?: string;
    alt?: string;
    size?: 'sm' | 'md' | 'lg';
}

const avatarSizeClasses = {
    sm: 'h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] text-[length:var(--lb-font-size-caption)]',
    md: 'h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] text-[length:var(--lb-font-size-body)]',
    lg: 'h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] text-[length:var(--lb-font-size-heading)]',
} as const;

export function Avatar({ name, imageUrl, alt, size = 'md', className = '', ...props }: AvatarProps) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    return (
        <div
            className={cx(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-primary-text)]',
                avatarSizeClasses[size],
                className,
            )}
            aria-label={name}
            {...props}
        >
            {imageUrl ? <img src={imageUrl} alt={alt ?? ''} className="h-full w-full object-cover" /> : initials}
        </div>
    );
}

export interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    showPageNumbers?: boolean;
    maxPageButtons?: number;
    pageSize?: number;
    pageSizeOptions?: number[];
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeLabel?: string;
    className?: string;
}

function getPaginationPages(page: number, totalPages: number, maxPageButtons: number) {
    const safeTotal = Math.max(totalPages, 1);
    const safeMax = Math.max(maxPageButtons, 1);
    const half = Math.floor(safeMax / 2);
    const start = Math.max(Math.min(page - half, safeTotal - safeMax + 1), 1);
    const end = Math.min(start + safeMax - 1, safeTotal);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function Pagination({
    page,
    totalPages,
    onPageChange,
    showPageNumbers = false,
    maxPageButtons = 5,
    pageSize,
    pageSizeOptions = [],
    onPageSizeChange,
    pageSizeLabel = 'Rows per page',
    className = '',
}: PaginationProps) {
    const pages = showPageNumbers ? getPaginationPages(page, totalPages, maxPageButtons) : [];
    const showPageSize = typeof pageSize === 'number' && pageSizeOptions.length > 0 && Boolean(onPageSizeChange);

    return (
        <nav className={cx('flex flex-wrap items-center justify-between gap-[var(--lb-space-2)]', className)} aria-label="Pagination">
            <Button
                unstyled
                type="button"
                className="inline-flex h-[var(--lb-density-button-height)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50"
                onClick={() => onPageChange(Math.max(page - 1, 1))}
                disabled={page <= 1}
            >
                <ChevronLeft className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                Previous
            </Button>
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-[var(--lb-space-2)]">
                {showPageSize && (
                    <div className="w-[var(--lb-size-pagination-page-size-width,8rem)]">
                        <Select
                            hideLabel
                            label={pageSizeLabel}
                            controlSize="sm"
                            value={String(pageSize)}
                            options={pageSizeOptions.map((option) => ({ label: String(option), value: String(option) }))}
                            onChange={(event) => onPageSizeChange?.(Number(event.currentTarget.value))}
                        />
                    </div>
                )}
                {pages.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-[var(--lb-space-1)]" aria-label="Page numbers">
                        {pages.map((pageNumber) => {
                            const active = pageNumber === page;
                            return (
                                <Button
                                    unstyled
                                    key={pageNumber}
                                    type="button"
                                    className={cx(
                                        'inline-flex h-[var(--lb-size-control-sm)] min-w-[var(--lb-size-control-sm)] items-center justify-center rounded-[var(--lb-radius-md)] border px-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                        active
                                            ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary-text)]'
                                            : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)]',
                                    )}
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() => onPageChange(pageNumber)}
                                >
                                    {pageNumber}
                                </Button>
                            );
                        })}
                    </div>
                ) : (
                    <span className="text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                        Page {page} of {totalPages}
                    </span>
                )}
            </div>
            <Button
                unstyled
                type="button"
                className="inline-flex h-[var(--lb-density-button-height)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50"
                onClick={() => onPageChange(Math.min(page + 1, totalPages))}
                disabled={page >= totalPages}
            >
                Next
                <ChevronRight className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
            </Button>
        </nav>
    );
}

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
    search?: React.ReactNode;
    filters?: React.ReactNode;
    chips?: React.ReactNode;
    actions?: React.ReactNode;
    bulkActions?: React.ReactNode;
}

export function FilterBar({
    search,
    filters,
    chips,
    actions,
    bulkActions,
    className = '',
    ...props
}: FilterBarProps) {
    return (
        <div
            className={cx(
                'flex min-h-[var(--lb-density-action-bar-height)] flex-col gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-component-card-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] shadow-[var(--lb-shadow-sm)]',
                className,
            )}
            {...props}
        >
            <div className="grid gap-[var(--lb-space-2)] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                {search && <div className="min-w-0">{search}</div>}
                {filters && <div className="flex flex-wrap items-end gap-[var(--lb-space-2)]">{filters}</div>}
                {actions && <div className="flex flex-wrap items-end justify-end gap-[var(--lb-space-2)]">{actions}</div>}
            </div>
            {(chips || bulkActions) && (
                <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-2)]">
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">{chips}</div>
                    {bulkActions && <div className="flex flex-wrap justify-end gap-[var(--lb-space-2)]">{bulkActions}</div>}
                </div>
            )}
        </div>
    );
}

export interface CommandPaletteAction {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;
    icon?: React.ReactNode;
    onSelect: () => void;
}

export interface CommandPaletteProps {
    open: boolean;
    actions: CommandPaletteAction[];
    onClose: () => void;
    placeholder?: string;
}

export function CommandPalette({ open, actions, onClose, placeholder = 'Search commands' }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const overlayRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const actionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const inputId = useId();
    const listboxId = `${inputId}-listbox`;
    const filteredActions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return actions;
        return actions.filter((action) => `${action.label} ${action.description ?? ''}`.toLowerCase().includes(normalizedQuery));
    }, [actions, query]);

    useFocusTrap(overlayRef, { active: open, initialFocusRef: inputRef });
    useDismiss(dialogRef, { active: open, onDismiss: onClose });

    useEffect(() => {
        setActiveIndex(filteredActions.length > 0 ? 0 : -1);
    }, [filteredActions.length]);

    const focusAction = (index: number) => {
        if (filteredActions.length === 0) return;
        const nextIndex = (index + filteredActions.length) % filteredActions.length;
        setActiveIndex(nextIndex);
        actionRefs.current[nextIndex]?.focus();
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusAction(activeIndex >= 0 ? activeIndex : 0);
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusAction(activeIndex >= 0 ? activeIndex : filteredActions.length - 1);
        }
    };

    const handleActionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusAction(index + 1);
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusAction(index - 1);
        }
        if (event.key === 'Home') {
            event.preventDefault();
            focusAction(0);
        }
        if (event.key === 'End') {
            event.preventDefault();
            focusAction(filteredActions.length - 1);
        }
    };

    if (!open) return null;

    return (
        <div ref={overlayRef} className="fixed inset-0 z-[var(--lb-z-modal)] flex items-stretch justify-center bg-[var(--lb-color-overlay)] px-[var(--lb-space-0)] pt-[var(--lb-space-0)] sm:items-start sm:px-[var(--lb-space-4)] sm:pt-[var(--lb-size-command-palette-offset)]">
            <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Command palette" className="flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-[var(--lb-component-card-bg)] shadow-[var(--lb-shadow-lg)] sm:h-auto sm:max-h-[calc(100vh-var(--lb-space-7))] sm:w-[min(var(--lb-size-command-palette-width),100%)] sm:rounded-[var(--lb-radius-lg)] sm:border sm:border-[var(--lb-component-card-border)]">
                <div className="flex items-center gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] px-[var(--lb-space-4)]">
                    <Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                    <input
                        ref={inputRef}
                        id={inputId}
                        className="h-[var(--lb-density-button-height-large)] flex-1 bg-transparent text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] outline-none placeholder:text-[color:var(--lb-color-text-subdued)]"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder={placeholder}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls={listboxId}
                        aria-expanded="true"
                        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-action-${activeIndex}` : undefined}
                        aria-label={placeholder}
                    />
                    <Command className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                </div>
                <div id={listboxId} role="listbox" className="max-h-none flex-1 overflow-auto p-[var(--lb-space-2)] sm:max-h-[var(--lb-size-command-palette-list-max-height)]">
                    {filteredActions.length === 0 ? (
                        <p className="m-0 px-[var(--lb-space-3)] py-[var(--lb-space-4)] text-center text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                            No commands found
                        </p>
                    ) : (
                        filteredActions.map((action, index) => (
                            <button
                                key={action.id}
                                ref={(node) => {
                                    actionRefs.current[index] = node;
                                }}
                                id={`${listboxId}-action-${index}`}
                                type="button"
                                role="option"
                                tabIndex={index === activeIndex ? 0 : -1}
                                aria-selected={index === activeIndex}
                                className="flex w-full items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                onFocus={() => setActiveIndex(index)}
                                onKeyDown={(event) => handleActionKeyDown(event, index)}
                                onClick={() => {
                                    action.onSelect();
                                    onClose();
                                }}
                            >
                                {action.icon && <span className="text-[color:var(--lb-color-text-subdued)]">{action.icon}</span>}
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">{action.label}</span>
                                    {action.description && <span className="block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{action.description}</span>}
                                </span>
                                {action.shortcut && <kbd className="rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{action.shortcut}</kbd>}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
