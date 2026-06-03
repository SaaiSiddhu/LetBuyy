'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
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
import { cx } from './utils';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
    label: string;
    value: string;
    secondaryValue?: string;
    delta?: string;
    deltaTone?: 'positive' | 'negative' | 'neutral';
    sparkline?: number[];
    icon?: React.ReactNode;
    loading?: boolean;
    loadingLabel?: string;
}

export function MetricCard({
    label,
    value,
    secondaryValue,
    delta,
    deltaTone = 'neutral',
    sparkline,
    icon,
    loading = false,
    loadingLabel = 'Loading metric',
    className = '',
    ...props
}: MetricCardProps) {
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
                'rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)] shadow-[var(--lb-shadow-sm)]',
                className,
            )}
            aria-busy={loading || undefined}
            {...props}
        >
            <div className="flex items-start justify-between gap-[var(--lb-space-4)]">
                <div className="space-y-[var(--lb-space-2)]">
                    <div className="flex items-center gap-[var(--lb-space-2)]">
                        {icon && <span className="text-[color:var(--lb-color-primary)]" aria-hidden="true">{icon}</span>}
                        <p className="m-0 text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                            {label}
                        </p>
                    </div>
                    {loading ? (
                        <div className="space-y-[var(--lb-space-2)]" aria-label={loadingLabel}>
                            <div className="h-[var(--lb-space-6)] w-28 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)]" />
                            <div className="h-[var(--lb-space-3)] w-20 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)]" />
                        </div>
                    ) : (
                        <>
                            <p className="m-0 text-[length:var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[color:var(--lb-color-text)]">
                                {value}
                            </p>
                            {secondaryValue && (
                                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {secondaryValue}
                                </p>
                            )}
                        </>
                    )}
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
    imageAlt?: string;
    size?: 'sm' | 'md' | 'lg';
    status?: 'online' | 'away' | 'offline';
    statusLabel?: string;
}

const avatarSizeClasses = {
    sm: 'h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] text-[length:var(--lb-font-size-caption)]',
    md: 'h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] text-[length:var(--lb-font-size-body)]',
    lg: 'h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] text-[length:var(--lb-font-size-heading)]',
} as const;

const avatarStatusStyles: Record<NonNullable<AvatarProps['status']>, string> = {
    online: 'bg-[var(--lb-color-success)]',
    away: 'bg-[var(--lb-color-warning)]',
    offline: 'bg-[var(--lb-color-border-strong)]',
};

export function Avatar({
    name,
    imageUrl,
    imageAlt = '',
    size = 'md',
    status,
    statusLabel,
    className = '',
    ...props
}: AvatarProps) {
    const { role, 'aria-label': ariaLabel, ...avatarProps } = props;
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    return (
        <div
            className="relative inline-flex shrink-0"
            role={role ?? 'img'}
            aria-label={ariaLabel ?? (statusLabel ? `${name}, ${statusLabel}` : name)}
            {...avatarProps}
        >
            <span
                className={cx(
                    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-primary)]',
                    avatarSizeClasses[size],
                    className,
                )}
                aria-hidden="true"
            >
                {imageUrl ? <img src={imageUrl} alt={imageAlt} className="h-full w-full object-cover" /> : initials}
            </span>
            {status && (
                <span
                    className={cx(
                        'absolute bottom-0 right-0 block h-[var(--lb-space-3)] w-[var(--lb-space-3)] rounded-[var(--lb-radius-full)] border-2 border-[var(--lb-color-surface)]',
                        avatarStatusStyles[status],
                    )}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}

export interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    previousLabel?: string;
    nextLabel?: string;
    pageLabel?: (page: number, totalPages: number) => string;
    showPageNumbers?: boolean;
    siblingCount?: number;
    compact?: boolean;
    className?: string;
}

function paginationRange(page: number, totalPages: number, siblingCount: number) {
    const start = Math.max(1, page - siblingCount);
    const end = Math.min(totalPages, page + siblingCount);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function firstEnabledActionIndex(actions: CommandPaletteAction[]) {
    return actions.findIndex((action) => !action.disabled);
}

export function Pagination({
    page,
    totalPages,
    onPageChange,
    previousLabel = 'Previous',
    nextLabel = 'Next',
    pageLabel = (currentPage, pageCount) => `Page ${currentPage} of ${pageCount}`,
    showPageNumbers = false,
    siblingCount = 1,
    compact = false,
    className = '',
}: PaginationProps) {
    const pages = paginationRange(page, totalPages, siblingCount);

    return (
        <nav className={cx('flex items-center justify-between gap-[var(--lb-space-3)]', className)} aria-label="Pagination">
            <button
                type="button"
                className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                onClick={() => onPageChange(Math.max(page - 1, 1))}
                disabled={page <= 1}
                aria-label={previousLabel}
            >
                <ChevronLeft className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                {!compact && previousLabel}
            </button>
            {showPageNumbers ? (
                <div className="flex items-center gap-[var(--lb-space-1)]">
                    {pages.map((item) => (
                        <button
                            key={item}
                            type="button"
                            className={cx(
                                'inline-flex h-[var(--lb-size-control-md)] min-w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] border px-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                item === page
                                    ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]'
                                    : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
                            )}
                            aria-current={item === page ? 'page' : undefined}
                            onClick={() => onPageChange(item)}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            ) : (
                <span className="text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text-subdued)]" aria-current="page">
                    {pageLabel(page, totalPages)}
                </span>
            )}
            <button
                type="button"
                className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                onClick={() => onPageChange(Math.min(page + 1, totalPages))}
                disabled={page >= totalPages}
                aria-label={nextLabel}
            >
                {!compact && nextLabel}
                <ChevronRight className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
            </button>
        </nav>
    );
}

export interface IndexTableColumn<T> {
    key: string;
    header: string;
    sortable?: boolean;
    render?: (row: T, index: number) => React.ReactNode;
}

export interface IndexTableBulkAction<T> {
    label: string;
    onAction: (rows: T[]) => void;
    destructive?: boolean;
}

export interface IndexTableProps<T extends { id: string }> {
    columns: IndexTableColumn<T>[];
    rows: T[];
    loading?: boolean;
    emptyState?: React.ReactNode;
    savedViews?: Array<{ label: string; value: string; count?: number }>;
    activeView?: string;
    onViewChange?: (value: string) => void;
    filterChips?: Array<{ label: string; onRemove?: () => void }>;
    bulkActions?: Array<IndexTableBulkAction<T>>;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    onRowClick?: (row: T) => void;
    className?: string;
}

export function IndexTable<T extends { id: string }>({
    columns,
    rows,
    loading = false,
    emptyState,
    savedViews = [],
    activeView,
    onViewChange,
    filterChips = [],
    bulkActions = [],
    sortKey,
    sortDirection,
    onSort,
    onRowClick,
    className = '',
}: IndexTableProps<T>) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const selectedRows = rows.filter((row) => selectedIds.has(row.id));
    const allSelected = rows.length > 0 && selectedIds.size === rows.length;
    const sortableColumns = columns.filter((column) => column.sortable);

    const toggleAll = () => {
        setSelectedIds(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
    };

    const toggleRow = (id: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className={cx('overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]', className)}>
            {(savedViews.length > 0 || filterChips.length > 0) && (
                <div className="flex flex-col gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                    {savedViews.length > 0 && (
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            {savedViews.map((view) => {
                                const active = view.value === activeView;
                                return (
                                    <button
                                        key={view.value}
                                        type="button"
                                        className={cx(
                                            'inline-flex h-[var(--lb-size-control-sm)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)]',
                                            active
                                                ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]'
                                                : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)]',
                                        )}
                                        onClick={() => onViewChange?.(view.value)}
                                    >
                                        {view.label}
                                        {typeof view.count === 'number' && <span>{view.count}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {filterChips.length > 0 && (
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            {filterChips.map((chip) => (
                                <Badge key={chip.label} label={chip.label} variant="info" onClick={chip.onRemove} />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {selectedRows.length > 0 && bulkActions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <span className="text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">{selectedRows.length} selected</span>
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        {bulkActions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                className={cx(
                                    'h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)]',
                                    action.destructive
                                        ? 'border-[var(--lb-color-critical)] text-[color:var(--lb-color-critical)] hover:bg-[var(--lb-color-critical-soft)]'
                                        : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface)]',
                                )}
                                onClick={() => action.onAction(selectedRows)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {sortableColumns.length > 0 && onSort && (
                <div className="flex gap-[var(--lb-space-2)] overflow-x-auto border-b border-[var(--lb-color-border)] p-[var(--lb-space-3)] md:hidden">
                    {sortableColumns.map((column) => {
                        const active = sortKey === column.key;
                        return (
                            <button
                                key={column.key}
                                type="button"
                                className={cx(
                                    'inline-flex h-[var(--lb-size-control-sm)] shrink-0 items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)]',
                                    active
                                        ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]'
                                        : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)]',
                                )}
                                aria-pressed={active}
                                onClick={() => onSort(column.key)}
                            >
                                Sort {column.header}
                                {active && (
                                    sortDirection === 'asc'
                                        ? <ArrowUp className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        : <ArrowDown className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
            <div className="md:hidden">
                {loading ? (
                    <div className="p-[var(--lb-space-4)]">
                        <Skeleton variant="card" lines={5} />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-[var(--lb-space-4)]">
                        {emptyState}
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--lb-color-border)]">
                        <label className="flex items-center gap-[var(--lb-space-2)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                            <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                            Select all visible rows
                        </label>
                        {rows.map((row, rowIndex) => (
                            <article key={row.id} className="grid gap-[var(--lb-space-3)] p-[var(--lb-space-3)]">
                                <div className="flex items-start gap-[var(--lb-space-3)]">
                                    <input
                                        type="checkbox"
                                        className="mt-[var(--lb-space-1)]"
                                        checked={selectedIds.has(row.id)}
                                        onChange={() => toggleRow(row.id)}
                                        aria-label={`Select row ${rowIndex + 1}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        {columns[0]?.render ? columns[0].render(row, rowIndex) : String(row[columns[0]?.key as keyof T] ?? '')}
                                    </div>
                                </div>

                                <dl className="m-0 grid gap-[var(--lb-space-3)]">
                                    {columns.slice(1).map((column) => (
                                        <div key={column.key} className="grid gap-[var(--lb-space-1)]">
                                            <dt className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                {column.header}
                                            </dt>
                                            <dd className="m-0 min-w-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                                {column.render ? column.render(row, rowIndex) : String(row[column.key as keyof T] ?? '')}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>

                                {onRowClick && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                            onClick={() => onRowClick(row)}
                                        >
                                            Open
                                        </button>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </div>
            <div className="hidden overflow-auto md:block">
                <table className="w-full border-collapse text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                    <thead className="bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-color-text-subdued)]">
                        <tr>
                            <th className="w-[var(--lb-size-control-lg)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-left">
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                            </th>
                            {columns.map((column) => {
                                const sorted = sortKey === column.key;
                                return (
                                    <th
                                        key={column.key}
                                        className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)]"
                                        aria-sort={sorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                                    >
                                        {column.sortable ? (
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-[var(--lb-space-1)] text-left hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                onClick={() => onSort?.(column.key)}
                                            >
                                                {column.header}
                                                {sorted && (
                                                    sortDirection === 'asc'
                                                        ? <ArrowUp className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                        : <ArrowDown className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                )}
                                            </button>
                                        ) : (
                                            <span>{column.header}</span>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--lb-color-border)]">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + 1} className="p-[var(--lb-space-5)]">
                                    <Skeleton variant="table" lines={4} />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 1} className="p-[var(--lb-space-5)]">
                                    {emptyState}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={row.id} className="hover:bg-[var(--lb-color-surface-subdued)]">
                                    <td className="px-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(row.id)}
                                            onChange={() => toggleRow(row.id)}
                                            aria-label={`Select row ${index + 1}`}
                                        />
                                    </td>
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={cx('px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[color:var(--lb-color-text)]', onRowClick && 'cursor-pointer')}
                                            onClick={() => onRowClick?.(row)}
                                        >
                                            {column.render ? column.render(row, index) : String(row[column.key as keyof T] ?? '')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export interface CommandPaletteAction {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;
    group?: string;
    keywords?: string[];
    disabled?: boolean;
    icon?: React.ReactNode;
    onSelect: () => void;
}

export interface CommandPaletteProps {
    open: boolean;
    actions: CommandPaletteAction[];
    onClose: () => void;
    title?: string;
    placeholder?: string;
    emptyMessage?: string;
    loading?: boolean;
    loadingLabel?: string;
    query?: string;
    defaultQuery?: string;
    onQueryChange?: (query: string) => void;
    footer?: React.ReactNode;
}

export function CommandPalette({
    open,
    actions,
    onClose,
    title = 'Command palette',
    placeholder = 'Search commands',
    emptyMessage = 'No commands found',
    loading = false,
    loadingLabel = 'Loading commands',
    query,
    defaultQuery = '',
    onQueryChange,
    footer,
}: CommandPaletteProps) {
    const paletteId = useId();
    const [internalQuery, setInternalQuery] = useState(defaultQuery);
    const [activeIndex, setActiveIndex] = useState(0);
    const currentQuery = query ?? internalQuery;
    const filteredActions = useMemo(() => {
        const normalizedQuery = currentQuery.trim().toLowerCase();
        if (!normalizedQuery) return actions;
        return actions.filter((action) => `${action.label} ${action.description ?? ''} ${(action.keywords ?? []).join(' ')}`.toLowerCase().includes(normalizedQuery));
    }, [actions, currentQuery]);
    const activeAction = filteredActions[activeIndex];
    const listboxId = `${paletteId}-listbox`;
    const groupedActions = useMemo(() => {
        return filteredActions.reduce<Array<{ group: string; actions: CommandPaletteAction[] }>>((groups, action) => {
            const groupName = action.group ?? 'Commands';
            const existing = groups.find((group) => group.group === groupName);
            if (existing) existing.actions.push(action);
            else groups.push({ group: groupName, actions: [action] });
            return groups;
        }, []);
    }, [filteredActions]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    useEffect(() => {
        if (!open) return;
        setActiveIndex(firstEnabledActionIndex(filteredActions));
    }, [filteredActions, open]);

    const moveActiveAction = (direction: 1 | -1) => {
        if (filteredActions.length === 0) {
            setActiveIndex(-1);
            return;
        }

        setActiveIndex((current) => {
            let nextIndex = current < 0 ? (direction > 0 ? -1 : 0) : current;
            for (let attempts = 0; attempts < filteredActions.length; attempts += 1) {
                nextIndex = (nextIndex + direction + filteredActions.length) % filteredActions.length;
                if (!filteredActions[nextIndex]?.disabled) return nextIndex;
            }
            return -1;
        });
    };

    const selectAction = (action: CommandPaletteAction) => {
        if (action.disabled) return;
        action.onSelect();
        onClose();
    };

    const updateQuery = (nextQuery: string) => {
        setInternalQuery(nextQuery);
        onQueryChange?.(nextQuery);
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveActiveAction(1);
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveActiveAction(-1);
        }
        if (event.key === 'Enter' && activeAction) {
            event.preventDefault();
            selectAction(activeAction);
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--lb-color-overlay)] px-[var(--lb-space-4)] pt-[var(--lb-size-command-palette-offset)]">
            <div role="dialog" aria-modal="true" aria-labelledby={`${paletteId}-title`} className="w-[min(var(--lb-size-command-palette-width),100%)] overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)]">
                <h2 id={`${paletteId}-title`} className="sr-only">{title}</h2>
                <div className="flex items-center gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] px-[var(--lb-space-4)]">
                    <Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                    <input
                        role="combobox"
                        aria-expanded="true"
                        aria-controls={listboxId}
                        aria-activedescendant={activeAction ? `${listboxId}-option-${activeIndex}` : undefined}
                        aria-autocomplete="list"
                        className="h-[var(--lb-size-control-lg)] flex-1 bg-transparent text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] outline-none placeholder:text-[color:var(--lb-color-text-subdued)]"
                        value={currentQuery}
                        onChange={(event) => updateQuery(event.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder={placeholder}
                        autoFocus
                    />
                    <Command className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                </div>
                <div id={listboxId} role="listbox" className="max-h-[var(--lb-size-command-palette-list-max-height)] overflow-auto p-[var(--lb-space-2)]">
                    {loading ? (
                        <div className="px-[var(--lb-space-3)] py-[var(--lb-space-5)]" aria-label={loadingLabel}>
                            <Skeleton lines={3} />
                        </div>
                    ) : filteredActions.length === 0 ? (
                        <p className="m-0 px-[var(--lb-space-3)] py-[var(--lb-space-5)] text-center text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                            {emptyMessage}
                        </p>
                    ) : (
                        groupedActions.map((group) => (
                            <div key={group.group} className="grid gap-[var(--lb-space-1)]">
                                <p className="m-0 px-[var(--lb-space-3)] pt-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {group.group}
                                </p>
                                {group.actions.map((action) => {
                                    const index = filteredActions.findIndex((filteredAction) => filteredAction.id === action.id);
                                    return (
                                        <button
                                            key={action.id}
                                            id={`${listboxId}-option-${index}`}
                                            type="button"
                                            role="option"
                                            aria-selected={index === activeIndex}
                                            aria-disabled={action.disabled || undefined}
                                            className={cx(
                                                'flex w-full items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-left hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                                index === activeIndex && 'bg-[var(--lb-color-surface-subdued)]',
                                                action.disabled && 'cursor-not-allowed opacity-50',
                                            )}
                                            onClick={() => selectAction(action)}
                                        >
                                            {action.icon && <span className="text-[color:var(--lb-color-text-subdued)]">{action.icon}</span>}
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">{action.label}</span>
                                                {action.description && <span className="block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{action.description}</span>}
                                            </span>
                                            {action.shortcut && <kbd className="rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{action.shortcut}</kbd>}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
                {footer && (
                    <div className="border-t border-[var(--lb-color-border)] px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
