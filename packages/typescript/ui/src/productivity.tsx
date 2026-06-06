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
import { warnDeprecated } from './deprecations';
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

/**
 * @deprecated since 0.0.2. Use `FilterBar` instead. This alias remains for backward compatibility.
 */
export function TableFilterBar(props: FilterBarProps) {
    warnDeprecated('TableFilterBar', 'FilterBar');
    return <FilterBar {...props} />;
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

/**
 * @deprecated since 0.0.2. Use `Table` from `@letbuyy/ui` instead. This component remains for backward compatibility.
 */
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
    warnDeprecated('IndexTable', 'Table');

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
                                    <Button
                                        unstyled
                                        key={view.value}
                                        type="button"
                                        className={cx(
                                            'inline-flex h-[var(--lb-density-pill-height)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)]',
                                            active
                                                ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary-text)]'
                                                : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)]',
                                        )}
                                        onClick={() => onViewChange?.(view.value)}
                                    >
                                        {view.label}
                                        {typeof view.count === 'number' && <span>{view.count}</span>}
                                    </Button>
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
                            <Button
                                unstyled
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
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            {sortableColumns.length > 0 && onSort && (
                <div className="flex gap-[var(--lb-space-2)] overflow-x-auto border-b border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] md:hidden">
                    {sortableColumns.map((column) => {
                        const active = sortKey === column.key;
                        return (
                            <Button
                                unstyled
                                key={column.key}
                                type="button"
                                className={cx(
                                    'inline-flex h-[var(--lb-density-pill-height)] shrink-0 items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)]',
                                    active
                                        ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary-text)]'
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
                            </Button>
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
                            <Checkbox unstyled label="Select all rows" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                            Select all visible rows
                        </label>
                        {rows.map((row, rowIndex) => (
                            <article key={row.id} className="grid gap-[var(--lb-space-3)] p-[var(--lb-space-3)]">
                                <div className="flex items-start gap-[var(--lb-space-3)]">
                                    <Checkbox
                                        unstyled
                                        label={`Select row ${rowIndex + 1}`}
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
                                        <Button
                                            unstyled
                                            type="button"
                                            className="h-[var(--lb-density-icon-button-height)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-badge)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                            onClick={() => onRowClick(row)}
                                        >
                                            Open
                                        </Button>
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
                                <Checkbox unstyled label="Select all rows" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                            </th>
                            {columns.map((column) => (
                                <th key={column.key} className="h-[var(--lb-density-table-header-height)] px-[var(--lb-space-3)] py-0 text-left font-[var(--lb-font-weight-medium)]">
                                    <Button
                                        unstyled
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
                                    </Button>
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
                                <tr key={row.id} aria-selected={selectedIds.has(row.id)} className="hover:bg-[var(--lb-component-table-row-hover-bg)]">
                                    <td className="h-[var(--lb-density-table-row-height)] px-[var(--lb-space-3)] py-0">
                                        <Checkbox
                                            unstyled
                                            label={`Select row ${index + 1}`}
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
