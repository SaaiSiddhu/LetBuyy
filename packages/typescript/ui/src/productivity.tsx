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
    X,
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
    sparklineTone?: 'primary' | 'positive' | 'negative' | 'neutral';
    sparklineLabel?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    footer?: React.ReactNode;
    tone?: 'default' | 'subdued' | 'info' | 'success' | 'warning' | 'critical';
    size?: 'sm' | 'md';
    loading?: boolean;
    loadingLabel?: string;
}

const metricCardToneStyles: Record<NonNullable<MetricCardProps['tone']>, string> = {
    default: '',
    subdued: 'bg-[var(--lb-color-surface-subdued)]',
    info: 'border-[var(--lb-color-info)] bg-[var(--lb-color-info-soft)]',
    success: 'border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)]',
    warning: 'border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)]',
    critical: 'border-[var(--lb-color-critical)] bg-[var(--lb-color-critical-soft)]',
};

const metricCardSizeStyles: Record<NonNullable<MetricCardProps['size']>, { container: string; value: string }> = {
    sm: {
        container: 'p-[var(--lb-space-4)]',
        value: 'text-[length:var(--lb-font-size-heading)] leading-[var(--lb-line-height-heading)]',
    },
    md: {
        container: 'p-[var(--lb-space-5)]',
        value: 'text-[length:var(--lb-font-size-display)] leading-[var(--lb-line-height-display)]',
    },
};

const metricCardSparklineToneStyles: Record<NonNullable<MetricCardProps['sparklineTone']>, string> = {
    primary: 'text-[color:var(--lb-color-primary)]',
    positive: 'text-[color:var(--lb-color-success)]',
    negative: 'text-[color:var(--lb-color-critical)]',
    neutral: 'text-[color:var(--lb-color-text-subdued)]',
};

export function MetricCard({
    label,
    value,
    secondaryValue,
    delta,
    deltaTone = 'neutral',
    sparkline,
    sparklineTone = 'primary',
    sparklineLabel,
    icon,
    action,
    footer,
    tone = 'default',
    size = 'md',
    loading = false,
    loadingLabel = 'Loading metric',
    className = '',
    ...props
}: MetricCardProps) {
    const sizeStyles = metricCardSizeStyles[size];
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
                'rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-sm)]',
                sizeStyles.container,
                metricCardToneStyles[tone],
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
                            <div className="h-[var(--lb-space-6)] w-28 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-border)]" />
                            <div className="h-[var(--lb-space-3)] w-20 rounded-[var(--lb-radius-full)] bg-[var(--lb-color-border)]" />
                        </div>
                    ) : (
                        <>
                            <p className={cx('m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]', sizeStyles.value)}>
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
                {(action || points) && (
                    <div className="flex shrink-0 flex-col items-end gap-[var(--lb-space-3)]">
                        {action && <div className="shrink-0">{action}</div>}
                        {points && (
                            <svg
                                viewBox="0 0 100 48"
                                className={cx('h-[var(--lb-size-metric-sparkline-height)] w-[var(--lb-size-metric-sparkline-width)]', metricCardSparklineToneStyles[sparklineTone])}
                                role={sparklineLabel ? 'img' : undefined}
                                aria-label={sparklineLabel}
                                aria-hidden={sparklineLabel ? undefined : true}
                            >
                                <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </div>
                )}
            </div>
            {footer && (
                <div className="mt-[var(--lb-space-4)] border-t border-[var(--lb-color-border)] pt-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {footer}
                </div>
            )}
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
    shape?: 'circle' | 'rounded';
    fallbackTone?: 'primary' | 'secondary' | 'success' | 'warning' | 'critical' | 'neutral';
    label?: React.ReactNode;
    description?: React.ReactNode;
    labelPosition?: 'right' | 'bottom';
    badge?: React.ReactNode;
    containerClassName?: string;
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

const avatarShapeStyles: Record<NonNullable<AvatarProps['shape']>, string> = {
    circle: 'rounded-[var(--lb-radius-full)]',
    rounded: 'rounded-[var(--lb-radius-lg)]',
};

const avatarFallbackToneStyles: Record<NonNullable<AvatarProps['fallbackTone']>, string> = {
    primary: 'bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]',
    secondary: 'bg-[var(--lb-color-secondary-soft)] text-[color:var(--lb-color-secondary)]',
    success: 'bg-[var(--lb-color-success-soft)] text-[color:var(--lb-color-success)]',
    warning: 'bg-[var(--lb-color-warning-soft)] text-[color:var(--lb-color-warning)]',
    critical: 'bg-[var(--lb-color-critical-soft)] text-[color:var(--lb-color-critical)]',
    neutral: 'bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-color-text-subdued)]',
};

export function Avatar({
    name,
    imageUrl,
    imageAlt = '',
    size = 'md',
    status,
    statusLabel,
    shape = 'circle',
    fallbackTone = 'primary',
    label,
    description,
    labelPosition = 'right',
    badge,
    containerClassName = '',
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
            className={cx(
                'inline-flex shrink-0 gap-[var(--lb-space-2)]',
                labelPosition === 'right' ? 'items-center' : 'flex-col items-start',
                containerClassName,
            )}
            role={role ?? 'img'}
            aria-label={ariaLabel ?? (statusLabel ? `${name}, ${statusLabel}` : name)}
            {...avatarProps}
        >
            <span className="relative inline-flex shrink-0">
                <span
                    className={cx(
                        'inline-flex shrink-0 items-center justify-center overflow-hidden font-[var(--lb-font-weight-semibold)]',
                        avatarSizeClasses[size],
                        avatarShapeStyles[shape],
                        avatarFallbackToneStyles[fallbackTone],
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
                {badge && (
                    <span className="absolute -right-[var(--lb-space-1)] -top-[var(--lb-space-1)]">
                        {badge}
                    </span>
                )}
            </span>
            {(label || description) && (
                <span className="min-w-0">
                    {label && <span className="block truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">{label}</span>}
                    {description && <span className="block truncate text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{description}</span>}
                </span>
            )}
        </div>
    );
}

export interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    ariaLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
    firstLabel?: string;
    lastLabel?: string;
    pageLabel?: (page: number, totalPages: number) => string;
    showPageNumbers?: boolean;
    showBoundaryControls?: boolean;
    siblingCount?: number;
    compact?: boolean;
    disabled?: boolean;
    summary?: React.ReactNode;
    pageSize?: number;
    pageSizeOptions?: number[];
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeLabel?: string;
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
    ariaLabel = 'Pagination',
    previousLabel = 'Previous',
    nextLabel = 'Next',
    firstLabel = 'First page',
    lastLabel = 'Last page',
    pageLabel = (currentPage, pageCount) => `Page ${currentPage} of ${pageCount}`,
    showPageNumbers = false,
    showBoundaryControls = false,
    siblingCount = 1,
    compact = false,
    disabled = false,
    summary,
    pageSize,
    pageSizeOptions = [],
    onPageSizeChange,
    pageSizeLabel = 'Rows per page',
    className = '',
}: PaginationProps) {
    const pages = paginationRange(page, totalPages, siblingCount);
    const canGoPrevious = page > 1 && !disabled;
    const canGoNext = page < totalPages && !disabled;

    return (
        <nav className={cx('flex flex-wrap items-center justify-between gap-[var(--lb-space-3)]', className)} aria-label={ariaLabel} aria-disabled={disabled || undefined}>
            {summary && (
                <div className="min-w-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {summary}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                {showBoundaryControls && (
                    <button
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                        onClick={() => onPageChange(1)}
                        disabled={!canGoPrevious}
                        aria-label={firstLabel}
                    >
                        <ChevronLeft className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        <ChevronLeft className="-ml-[var(--lb-space-2)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        {!compact && firstLabel}
                    </button>
                )}
                <button
                    type="button"
                    className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                    onClick={() => onPageChange(Math.max(page - 1, 1))}
                    disabled={!canGoPrevious}
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
                                    'inline-flex h-[var(--lb-size-control-md)] min-w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] border px-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50',
                                    item === page
                                        ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)] text-[color:var(--lb-color-primary)]'
                                        : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)]',
                                )}
                                aria-current={item === page ? 'page' : undefined}
                                disabled={disabled}
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
                    disabled={!canGoNext}
                    aria-label={nextLabel}
                >
                    {!compact && nextLabel}
                    <ChevronRight className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                </button>
                {showBoundaryControls && (
                    <button
                        type="button"
                        className="inline-flex h-[var(--lb-size-control-md)] items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                        onClick={() => onPageChange(totalPages)}
                        disabled={!canGoNext}
                        aria-label={lastLabel}
                    >
                        {!compact && lastLabel}
                        <ChevronRight className="-mr-[var(--lb-space-2)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        <ChevronRight className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    </button>
                )}
                {pageSizeOptions.length > 0 && onPageSizeChange && (
                    <label className="inline-flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        {!compact && <span>{pageSizeLabel}</span>}
                        <select
                            className="h-[var(--lb-size-control-md)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:opacity-50"
                            value={pageSize}
                            onChange={(event) => onPageSizeChange(Number(event.target.value))}
                            disabled={disabled}
                        >
                            {pageSizeOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
        </nav>
    );
}

export interface IndexTableColumn<T> {
    key: string;
    header: string;
    sortable?: boolean;
    align?: 'start' | 'center' | 'end';
    className?: string;
    width?: string;
    render?: (row: T, index: number) => React.ReactNode;
}

export interface IndexTableBulkAction<T> {
    label: string;
    onAction: (rows: T[]) => void;
    destructive?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
}

export interface IndexTableProps<T extends { id: string }> {
    columns: IndexTableColumn<T>[];
    rows: T[];
    loading?: boolean;
    loadingLabel?: string;
    emptyState?: React.ReactNode;
    caption?: string;
    ariaLabel?: string;
    savedViews?: Array<{ label: string; value: string; count?: number }>;
    activeView?: string;
    onViewChange?: (value: string) => void;
    filterChips?: Array<{ label: string; onRemove?: () => void }>;
    bulkActions?: Array<IndexTableBulkAction<T>>;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    onRowClick?: (row: T) => void;
    rowActions?: (row: T, index: number) => React.ReactNode;
    selectable?: boolean;
    selectedRowIds?: string[];
    defaultSelectedRowIds?: string[];
    onSelectionChange?: (selectedRowIds: string[], selectedRows: T[]) => void;
    isRowDisabled?: (row: T, index: number) => boolean;
    selectedLabel?: (count: number) => React.ReactNode;
    selectAllLabel?: string;
    selectRowLabel?: (row: T, index: number) => string;
    density?: 'compact' | 'comfortable';
    stickyHeader?: boolean;
    className?: string;
}

const indexTableCellDensity: Record<NonNullable<IndexTableProps<{ id: string }>['density']>, string> = {
    compact: 'px-[var(--lb-space-3)] py-[var(--lb-space-2)]',
    comfortable: 'px-[var(--lb-space-3)] py-[var(--lb-space-3)]',
};

const indexTableAlign: Record<NonNullable<IndexTableColumn<{ id: string }>['align']>, string> = {
    start: 'text-left',
    center: 'text-center',
    end: 'text-right',
};

const indexTableCheckboxClassName = 'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] rounded-[var(--lb-radius-sm)] border-[var(--lb-color-border)] accent-[var(--lb-color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';

export function IndexTable<T extends { id: string }>({
    columns,
    rows,
    loading = false,
    loadingLabel = 'Loading rows',
    emptyState,
    caption,
    ariaLabel,
    savedViews = [],
    activeView,
    onViewChange,
    filterChips = [],
    bulkActions = [],
    sortKey,
    sortDirection,
    onSort,
    onRowClick,
    rowActions,
    selectable = true,
    selectedRowIds,
    defaultSelectedRowIds = [],
    onSelectionChange,
    isRowDisabled,
    selectedLabel = (count) => `${count} selected`,
    selectAllLabel = 'Select all rows',
    selectRowLabel = (_row, index) => `Select row ${index + 1}`,
    density = 'comfortable',
    stickyHeader = false,
    className = '',
}: IndexTableProps<T>) {
    const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(() => new Set(defaultSelectedRowIds));
    const controlledSelection = selectedRowIds !== undefined;
    const selectedIds = controlledSelection ? new Set(selectedRowIds) : internalSelectedIds;
    const rowEntries = rows.map((row, index) => ({
        row,
        index,
        disabled: isRowDisabled?.(row, index) ?? false,
    }));
    const selectableRows = rowEntries.filter((entry) => !entry.disabled);
    const selectedRows = rowEntries.filter((entry) => selectedIds.has(entry.row.id)).map((entry) => entry.row);
    const allSelected = selectableRows.length > 0 && selectableRows.every((entry) => selectedIds.has(entry.row.id));
    const someSelected = selectableRows.some((entry) => selectedIds.has(entry.row.id));
    const sortableColumns = columns.filter((column) => column.sortable);
    const cellPadding = indexTableCellDensity[density];
    const colSpan = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

    const commitSelection = (nextIds: Set<string>) => {
        if (!controlledSelection) setInternalSelectedIds(nextIds);
        const nextIdList = Array.from(nextIds);
        onSelectionChange?.(nextIdList, rows.filter((row) => nextIds.has(row.id)));
    };

    const toggleAll = () => {
        if (allSelected) {
            const selectableIdSet = new Set(selectableRows.map((entry) => entry.row.id));
            commitSelection(new Set(Array.from(selectedIds).filter((id) => !selectableIdSet.has(id))));
            return;
        }
        commitSelection(new Set([...Array.from(selectedIds), ...selectableRows.map((entry) => entry.row.id)]));
    };

    const toggleRow = (row: T, index: number) => {
        if (isRowDisabled?.(row, index)) return;
        const next = new Set(selectedIds);
        if (next.has(row.id)) next.delete(row.id);
        else next.add(row.id);
        commitSelection(next);
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
                    <span className="text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">{selectedLabel(selectedRows.length)}</span>
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        {bulkActions.map((action) => (
                            <button
                                key={action.label}
                                type="button"
                                className={cx(
                                    'h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] disabled:cursor-not-allowed disabled:opacity-50',
                                    action.destructive
                                        ? 'border-[var(--lb-color-critical)] text-[color:var(--lb-color-critical)] hover:bg-[var(--lb-color-critical-soft)]'
                                        : 'border-[var(--lb-color-border)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface)]',
                                )}
                                disabled={action.disabled}
                                aria-label={action.ariaLabel}
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
                        {selectable && (
                            <label className="flex items-center gap-[var(--lb-space-2)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]">
                                <input type="checkbox" className={indexTableCheckboxClassName} checked={allSelected} aria-checked={someSelected && !allSelected ? 'mixed' : allSelected} onChange={toggleAll} aria-label={selectAllLabel} />
                                Select all visible rows
                            </label>
                        )}
                        {rowEntries.map(({ row, index: rowIndex, disabled: rowDisabled }) => (
                            <article key={row.id} className={cx('grid gap-[var(--lb-space-3)] p-[var(--lb-space-3)]', rowDisabled && 'opacity-60', selectedIds.has(row.id) && 'bg-[var(--lb-color-primary-soft)]')}>
                                <div className="flex items-start gap-[var(--lb-space-3)]">
                                    {selectable && (
                                        <input
                                            type="checkbox"
                                            className={cx(indexTableCheckboxClassName, 'mt-[var(--lb-space-1)]')}
                                            checked={selectedIds.has(row.id)}
                                            disabled={rowDisabled}
                                            onChange={() => toggleRow(row, rowIndex)}
                                            aria-label={selectRowLabel(row, rowIndex)}
                                        />
                                    )}
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

                                {(onRowClick || rowActions) && (
                                    <div className="flex justify-end">
                                        {rowActions ? rowActions(row, rowIndex) : (
                                            <button
                                                type="button"
                                                className="h-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                disabled={rowDisabled}
                                                onClick={() => onRowClick?.(row)}
                                            >
                                                Open
                                            </button>
                                        )}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </div>
            <div className="hidden overflow-auto md:block">
                <table className="w-full border-collapse text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]" aria-label={ariaLabel}>
                    {caption && <caption className="sr-only">{caption}</caption>}
                    <thead className={cx('bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-color-text-subdued)]', stickyHeader && 'sticky top-0 z-10')}>
                        <tr>
                            {selectable && (
                                <th className={cx(cellPadding, 'w-[var(--lb-size-control-lg)] text-left')}>
                                    <input type="checkbox" className={indexTableCheckboxClassName} checked={allSelected} aria-checked={someSelected && !allSelected ? 'mixed' : allSelected} onChange={toggleAll} aria-label={selectAllLabel} />
                                </th>
                            )}
                            {columns.map((column) => {
                                const sorted = sortKey === column.key;
                                const align = indexTableAlign[column.align ?? 'start'];
                                return (
                                    <th
                                        key={column.key}
                                        className={cx(cellPadding, align, 'font-[var(--lb-font-weight-medium)]', column.className)}
                                        style={column.width ? { width: column.width } : undefined}
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
                            {rowActions && (
                                <th className={cx(cellPadding, 'text-right font-[var(--lb-font-weight-medium)]')} scope="col">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--lb-color-border)]">
                        {loading ? (
                            <tr>
                                <td colSpan={colSpan} className="p-[var(--lb-space-5)]" aria-label={loadingLabel}>
                                    <Skeleton variant="table" lines={4} label={loadingLabel} />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={colSpan} className="p-[var(--lb-space-5)]">
                                    {emptyState}
                                </td>
                            </tr>
                        ) : (
                            rowEntries.map(({ row, index, disabled: rowDisabled }) => (
                                <tr key={row.id} className={cx('hover:bg-[var(--lb-color-surface-subdued)]', selectedIds.has(row.id) && 'bg-[var(--lb-color-primary-soft)]', rowDisabled && 'opacity-60')} aria-selected={selectable ? selectedIds.has(row.id) : undefined}>
                                    {selectable && (
                                        <td className={cellPadding}>
                                            <input
                                                type="checkbox"
                                                className={indexTableCheckboxClassName}
                                                checked={selectedIds.has(row.id)}
                                                disabled={rowDisabled}
                                                onChange={() => toggleRow(row, index)}
                                                aria-label={selectRowLabel(row, index)}
                                            />
                                        </td>
                                    )}
                                    {columns.map((column) => {
                                        const align = indexTableAlign[column.align ?? 'start'];
                                        return (
                                            <td
                                                key={column.key}
                                                className={cx(cellPadding, align, 'text-[color:var(--lb-color-text)]', onRowClick && !rowDisabled && 'cursor-pointer', column.className)}
                                                onClick={() => {
                                                    if (!rowDisabled) onRowClick?.(row);
                                                }}
                                            >
                                                {column.render ? column.render(row, index) : String(row[column.key as keyof T] ?? '')}
                                            </td>
                                        );
                                    })}
                                    {rowActions && (
                                        <td className={cx(cellPadding, 'text-right text-[color:var(--lb-color-text)]')} onClick={(event) => event.stopPropagation()}>
                                            {rowActions(row, index)}
                                        </td>
                                    )}
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
    badge?: React.ReactNode;
    meta?: React.ReactNode;
    ariaLabel?: string;
    icon?: React.ReactNode;
    onSelect: () => void;
}

export interface CommandPaletteProps {
    open: boolean;
    actions: CommandPaletteAction[];
    onClose: () => void;
    title?: string;
    description?: string;
    showHeader?: boolean;
    showCloseButton?: boolean;
    dismissLabel?: string;
    placeholder?: string;
    inputLabel?: string;
    emptyMessage?: string;
    emptyState?: React.ReactNode;
    loading?: boolean;
    loadingLabel?: string;
    query?: string;
    defaultQuery?: string;
    onQueryChange?: (query: string) => void;
    closeOnSelect?: boolean;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    listClassName?: string;
    actionClassName?: string;
}

const commandPaletteSizeStyles: Record<NonNullable<CommandPaletteProps['size']>, string> = {
    sm: 'w-[min(560px,100%)]',
    md: 'w-[min(var(--lb-size-command-palette-width),100%)]',
    lg: 'w-[min(920px,100%)]',
};

export function CommandPalette({
    open,
    actions,
    onClose,
    title = 'Command palette',
    description,
    showHeader = false,
    showCloseButton = false,
    dismissLabel = 'Close command palette',
    placeholder = 'Search commands',
    inputLabel = 'Search commands',
    emptyMessage = 'No commands found',
    emptyState,
    loading = false,
    loadingLabel = 'Loading commands',
    query,
    defaultQuery = '',
    onQueryChange,
    closeOnSelect = true,
    footer,
    size = 'md',
    className = '',
    listClassName = '',
    actionClassName = '',
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
    const descriptionId = description ? `${paletteId}-description` : undefined;

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
        if (closeOnSelect) onClose();
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
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${paletteId}-title`}
                aria-describedby={descriptionId}
                className={cx(commandPaletteSizeStyles[size], 'overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] shadow-[var(--lb-shadow-lg)]', className)}
            >
                {(showHeader || showCloseButton) ? (
                    <div className="flex items-start justify-between gap-[var(--lb-space-4)] border-b border-[var(--lb-color-border)] px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                        <div className="min-w-0">
                            <h2 id={`${paletteId}-title`} className={cx('m-0 text-[length:var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[color:var(--lb-color-text)]', !showHeader && 'sr-only')}>
                                {title}
                            </h2>
                            {description && (
                                <p id={descriptionId} className={cx('m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]', !showHeader && 'sr-only')}>
                                    {description}
                                </p>
                            )}
                        </div>
                        {showCloseButton && (
                            <button
                                type="button"
                                className="inline-flex h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] shrink-0 items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                onClick={onClose}
                                aria-label={dismissLabel}
                            >
                                <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <h2 id={`${paletteId}-title`} className="sr-only">{title}</h2>
                        {description && <p id={descriptionId} className="sr-only">{description}</p>}
                    </>
                )}
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
                        aria-label={inputLabel}
                        autoFocus
                    />
                    <Command className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                </div>
                <div id={listboxId} role="listbox" className={cx('max-h-[var(--lb-size-command-palette-list-max-height)] overflow-auto p-[var(--lb-space-2)]', listClassName)}>
                    {loading ? (
                        <div className="px-[var(--lb-space-3)] py-[var(--lb-space-5)]" aria-label={loadingLabel}>
                            <Skeleton lines={3} />
                        </div>
                    ) : filteredActions.length === 0 ? (
                        emptyState ?? (
                            <p className="m-0 px-[var(--lb-space-3)] py-[var(--lb-space-5)] text-center text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text-subdued)]">
                                {emptyMessage}
                            </p>
                        )
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
                                            aria-label={action.ariaLabel}
                                            className={cx(
                                                'flex w-full items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] text-left hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                                index === activeIndex && 'bg-[var(--lb-color-surface-subdued)]',
                                                action.disabled && 'cursor-not-allowed opacity-50',
                                                actionClassName,
                                            )}
                                            onClick={() => selectAction(action)}
                                        >
                                            {action.icon && <span className="text-[color:var(--lb-color-text-subdued)]">{action.icon}</span>}
                                            <span className="min-w-0 flex-1">
                                                <span className="flex min-w-0 flex-wrap items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                                    <span className="truncate">{action.label}</span>
                                                    {action.badge}
                                                </span>
                                                {action.description && <span className="block text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">{action.description}</span>}
                                            </span>
                                            <span className="flex shrink-0 items-center gap-[var(--lb-space-2)]">
                                                {action.meta && <span className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{action.meta}</span>}
                                                {action.shortcut && <kbd className="rounded-[var(--lb-radius-sm)] border border-[var(--lb-color-border)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{action.shortcut}</kbd>}
                                            </span>
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
