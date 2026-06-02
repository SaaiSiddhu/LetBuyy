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
                'rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-5)] shadow-[var(--lb-shadow-sm)]',
                className,
            )}
            {...props}
        >
            <div className="flex items-start justify-between gap-[var(--lb-space-4)]">
                <div className="space-y-[var(--lb-space-2)]">
                    <p className="m-0 text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {label}
                    </p>
                    <p className="m-0 text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                        {value}
                    </p>
                    {delta && (
                        <p
                            className={cx(
                                'm-0 text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)]',
                                deltaTone === 'positive' && 'text-[var(--lb-color-success)]',
                                deltaTone === 'negative' && 'text-[var(--lb-color-critical)]',
                                deltaTone === 'neutral' && 'text-[var(--lb-color-text-subdued)]',
                            )}
                        >
                            {delta}
                        </p>
                    )}
                </div>
                {points && (
                    <svg viewBox="0 0 100 48" className="h-[48px] w-[120px] text-[var(--lb-color-primary)]" aria-hidden="true">
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
    sm: 'h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] text-[var(--lb-font-size-caption)]',
    md: 'h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] text-[var(--lb-font-size-body)]',
    lg: 'h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] text-[var(--lb-font-size-heading)]',
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
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-primary)]',
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
        <nav className={cx('flex items-center justify-between gap-[var(--lb-space-3)]', className)} aria-label="Pagination">
            <button
                type="button"
                className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[var(--lb-font-size-body)] text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50"
                onClick={() => onPageChange(Math.max(page - 1, 1))}
                disabled={page <= 1}
            >
                <ChevronLeft className="h-[1em] w-[1em]" aria-hidden="true" />
                Previous
            </button>
            <span className="text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                Page {page} of {totalPages}
            </span>
            <button
                type="button"
                className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[var(--lb-font-size-body)] text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] disabled:opacity-50"
                onClick={() => onPageChange(Math.min(page + 1, totalPages))}
                disabled={page >= totalPages}
            >
                Next
                <ChevronRight className="h-[1em] w-[1em]" aria-hidden="true" />
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
                                            'inline-flex h-[var(--lb-size-control-sm)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)]',
                                            active
                                                ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]'
                                                : 'border-[var(--lb-color-border)] text-[var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)]',
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
                    <span className="text-[var(--lb-font-size-body)] text-[var(--lb-color-text)]">{selectedRows.length} selected</span>
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        {bulkActions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                className={cx(
                                    'h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border px-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)]',
                                    action.destructive
                                        ? 'border-[var(--lb-color-critical)] text-[var(--lb-color-critical)] hover:bg-[var(--lb-color-critical-soft)]'
                                        : 'border-[var(--lb-color-border)] text-[var(--lb-color-text)] hover:bg-[var(--lb-color-surface)]',
                                )}
                                onClick={() => action.onAction(selectedRows)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="overflow-auto">
                <table className="w-full border-collapse text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                    <thead className="bg-[var(--lb-color-surface-subdued)] text-[var(--lb-color-text-subdued)]">
                        <tr>
                            <th className="w-[var(--lb-size-control-lg)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-left">
                                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                            </th>
                            {columns.map((column) => (
                                <th key={column.key} className="px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)]">
                                    <button
                                        type="button"
                                        className={cx(
                                            'inline-flex items-center gap-[var(--lb-space-1)] text-left',
                                            column.sortable ? 'hover:text-[var(--lb-color-text)]' : 'pointer-events-none',
                                        )}
                                        onClick={() => column.sortable && onSort?.(column.key)}
                                    >
                                        {column.header}
                                        {column.sortable && sortKey === column.key && (
                                            sortDirection === 'asc'
                                                ? <ArrowUp className="h-[1em] w-[1em]" aria-hidden="true" />
                                                : <ArrowDown className="h-[1em] w-[1em]" aria-hidden="true" />
                                        )}
                                    </button>
                                </th>
                            ))}
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
                                            className={cx('px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]', onRowClick && 'cursor-pointer')}
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
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--lb-color-overlay)] px-[var(--lb-space-4)] pt-[12vh]">
            <div role="dialog" aria-modal="true" aria-label="Command palette" className="w-[min(720px,100%)] overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)]">
                <div className="flex items-center gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] px-[var(--lb-space-4)]">
                    <Search className="h-[1em] w-[1em] text-[var(--lb-color-text-subdued)]" aria-hidden="true" />
                    <input
                        className="h-[var(--lb-size-control-lg)] flex-1 bg-transparent text-[var(--lb-font-size-body)] text-[var(--lb-color-text)] outline-none placeholder:text-[var(--lb-color-text-subdued)]"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={placeholder}
                        autoFocus
                    />
                    <Command className="h-[1em] w-[1em] text-[var(--lb-color-text-subdued)]" aria-hidden="true" />
                </div>
                <div className="max-h-[420px] overflow-auto p-[var(--lb-space-2)]">
                    {filteredActions.length === 0 ? (
                        <p className="m-0 px-[var(--lb-space-3)] py-[var(--lb-space-5)] text-center text-[var(--lb-font-size-body)] text-[var(--lb-color-text-subdued)]">
                            No commands found
                        </p>
                    ) : (
                        filteredActions.map((action) => (
                            <button
                                key={action.id}
                                type="button"
                                className="flex w-full items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-left hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                onClick={() => {
                                    action.onSelect();
                                    onClose();
                                }}
                            >
                                {action.icon && <span className="text-[var(--lb-color-text-subdued)]">{action.icon}</span>}
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">{action.label}</span>
                                    {action.description && <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{action.description}</span>}
                                </span>
                                {action.shortcut && <kbd className="rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{action.shortcut}</kbd>}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

