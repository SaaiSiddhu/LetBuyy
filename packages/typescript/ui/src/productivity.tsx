'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
    size?: 'sm' | 'md' | 'lg';
}

const avatarSizeClasses = {
    sm: 'h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] text-[length:var(--lb-font-size-caption)]',
    md: 'h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] text-[length:var(--lb-font-size-body)]',
    lg: 'h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] text-[length:var(--lb-font-size-heading)]',
} as const;

export function Avatar({ name, imageUrl, size = 'md', className = '', ...props }: AvatarProps) {
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    return (
        <div
            className={cx(
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-primary)]',
                avatarSizeClasses[size],
                className,
            )}
            aria-label={name}
            {...props}
        >
            {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : initials}
        </div>
    );
}

export interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export function Pagination({ page, totalPages, onPageChange, className = '' }: PaginationProps) {
    return (
        <nav className={cx('flex items-center justify-between gap-[var(--lb-space-2)]', className)} aria-label="Pagination">
            <button
                type="button"
                className="inline-flex h-[var(--lb-density-button-height)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50"
                onClick={() => onPageChange(Math.max(page - 1, 1))}
                disabled={page <= 1}
            >
                <ChevronLeft className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                Previous
            </button>
            <span className="text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                Page {page} of {totalPages}
            </span>
            <button
                type="button"
                className="inline-flex h-[var(--lb-density-button-height)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50"
                onClick={() => onPageChange(Math.min(page + 1, totalPages))}
                disabled={page >= totalPages}
            >
                Next
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

export const TableFilterBar = FilterBar;

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
        <div className={cx('overflow-hidden rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-table-border)] bg-[var(--lb-component-table-bg)] shadow-[var(--lb-component-card-shadow)]', className)}>
            {(savedViews.length > 0 || filterChips.length > 0) && (
                <div className="flex min-h-[var(--lb-density-action-bar-height)] flex-col gap-[var(--lb-space-2)] border-b border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
                    {savedViews.length > 0 && (
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            {savedViews.map((view) => {
                                const active = view.value === activeView;
                                return (
                                    <button
                                        key={view.value}
                                        type="button"
                                        className={cx(
                                            'inline-flex h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)]',
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
                <div className="flex min-h-[var(--lb-density-action-bar-height)] flex-wrap items-center justify-between gap-[var(--lb-space-2)] border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
                    <span className="text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-text)]">{selectedRows.length} selected</span>
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        {bulkActions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                className={cx(
                                    'h-[var(--lb-density-icon-button-height)] rounded-[var(--lb-radius-md)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)]',
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
                <div className="flex gap-[var(--lb-space-2)] overflow-x-auto border-b border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] md:hidden">
                    {sortableColumns.map((column) => {
                        const active = sortKey === column.key;
                        return (
                            <button
                                key={column.key}
                                type="button"
                                className={cx(
                                    'inline-flex h-[var(--lb-density-pill-height)] shrink-0 items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)]',
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
                                        ? <ArrowUp className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                                        : <ArrowDown className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
            <div className="md:hidden">
                {loading ? (
                    <div className="p-[var(--lb-space-3)]">
                        <Skeleton variant="card" lines={5} />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-[var(--lb-space-3)]">
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
                                            className="h-[var(--lb-density-icon-button-height)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
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
                <table className="w-full border-collapse text-[length:var(--lb-font-size-table)] leading-[var(--lb-line-height-table)]">
                    <thead className="bg-[var(--lb-component-table-header-bg)] text-[color:var(--lb-component-table-text-secondary)]">
                        <tr>
                            <th className="h-[var(--lb-density-table-header-height)] w-[var(--lb-density-button-height-large)] px-[var(--lb-space-3)] py-0 text-left">
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                            </th>
                            {columns.map((column) => (
                                <th key={column.key} className="h-[var(--lb-density-table-header-height)] px-[var(--lb-space-3)] py-0 text-left font-[var(--lb-font-weight-medium)]">
                                    <button
                                        type="button"
                                        className={cx(
                                            'inline-flex items-center gap-[var(--lb-space-1)] text-left',
                                            column.sortable ? 'hover:text-[color:var(--lb-component-table-text)]' : 'pointer-events-none',
                                        )}
                                        onClick={() => column.sortable && onSort?.(column.key)}
                                    >
                                        {column.header}
                                        {column.sortable && sortKey === column.key && (
                                            sortDirection === 'asc'
                                                ? <ArrowUp className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                                                : <ArrowDown className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                                        )}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--lb-component-table-border)]">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + 1} className="p-[var(--lb-space-4)]">
                                    <Skeleton variant="table" lines={4} />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 1} className="p-[var(--lb-space-4)]">
                                    {emptyState}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={row.id} className="hover:bg-[var(--lb-component-table-row-hover-bg)]">
                                    <td className="h-[var(--lb-density-table-row-height)] px-[var(--lb-space-3)] py-0">
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
                                            className={cx('h-[var(--lb-density-table-row-height)] px-[var(--lb-space-3)] py-0 text-[color:var(--lb-component-table-text)]', onRowClick && 'cursor-pointer')}
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
    const filteredActions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return actions;
        return actions.filter((action) => `${action.label} ${action.description ?? ''}`.toLowerCase().includes(normalizedQuery));
    }, [actions, query]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--lb-color-overlay)] px-[var(--lb-space-0)] pt-[var(--lb-space-0)] sm:items-start sm:px-[var(--lb-space-4)] sm:pt-[var(--lb-size-command-palette-offset)]">
            <div role="dialog" aria-modal="true" aria-label="Command palette" className="flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-[var(--lb-component-card-bg)] shadow-[var(--lb-shadow-lg)] sm:h-auto sm:max-h-[calc(100vh-var(--lb-space-7))] sm:w-[min(var(--lb-size-command-palette-width),100%)] sm:rounded-[var(--lb-radius-lg)] sm:border sm:border-[var(--lb-component-card-border)]">
                <div className="flex items-center gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] px-[var(--lb-space-4)]">
                    <Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                    <input
                        className="h-[var(--lb-density-button-height-large)] flex-1 bg-transparent text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] outline-none placeholder:text-[color:var(--lb-color-text-subdued)]"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={placeholder}
                        autoFocus
                    />
                    <Command className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                </div>
                <div className="max-h-none flex-1 overflow-auto p-[var(--lb-space-2)] sm:max-h-[var(--lb-size-command-palette-list-max-height)]">
                    {filteredActions.length === 0 ? (
                        <p className="m-0 px-[var(--lb-space-3)] py-[var(--lb-space-4)] text-center text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                            No commands found
                        </p>
                    ) : (
                        filteredActions.map((action) => (
                            <button
                                key={action.id}
                                type="button"
                                className="flex w-full items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-left hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
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
