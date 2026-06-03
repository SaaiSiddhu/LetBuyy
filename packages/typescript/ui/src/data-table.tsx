'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Loader2 } from './icons';
import { cx } from './utils';

// ============= TYPES =============

export interface Column<T> {
    key: string;
    header: string;
    sortable?: boolean;
    width?: string;
    align?: 'start' | 'center' | 'end';
    className?: string;
    render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T extends Record<string, unknown>> {
    columns: Column<T>[];
    data: T[];
    caption?: string;
    ariaLabel?: string;
    loading?: boolean;
    loadingLabel?: string;
    emptyMessage?: string;
    emptyState?: React.ReactNode;
    onRowClick?: (row: T) => void;
    rowKey?: keyof T | ((row: T, index: number) => React.Key);
    rowActions?: (row: T, index: number) => React.ReactNode;
    rowClassName?: string | ((row: T, index: number) => string | undefined);
    isRowDisabled?: (row: T, index: number) => boolean;
    density?: 'compact' | 'comfortable';
    stickyHeader?: boolean;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    className?: string;
}

const dataTableCellDensity: Record<NonNullable<DataTableProps<Record<string, unknown>>['density']>, string> = {
    compact: 'px-[var(--lb-space-3)] py-[var(--lb-space-2)]',
    comfortable: 'px-[var(--lb-space-4)] py-[var(--lb-space-3)]',
};

const dataTableAlign: Record<NonNullable<Column<Record<string, unknown>>['align']>, string> = {
    start: 'text-left',
    center: 'text-center',
    end: 'text-right',
};

// ============= COMPONENT =============

export function DataTable<T extends Record<string, unknown>>({
    columns,
    data,
    caption,
    ariaLabel,
    loading = false,
    loadingLabel = 'Loading data',
    emptyMessage = 'No data found',
    emptyState,
    onRowClick,
    rowKey,
    rowActions,
    rowClassName,
    isRowDisabled,
    density = 'comfortable',
    stickyHeader = false,
    sortKey,
    sortDirection,
    onSort,
    className = '',
}: DataTableProps<T>) {
    const cellPadding = dataTableCellDensity[density];
    const columnCount = columns.length + (rowActions ? 1 : 0);
    const getRowKey = (row: T, index: number) => {
        if (typeof rowKey === 'function') return rowKey(row, index);
        if (rowKey) return row[rowKey] as React.Key;
        return (row.id as React.Key | undefined) ?? index;
    };
    const getRowClassName = (row: T, index: number) => {
        if (typeof rowClassName === 'function') return rowClassName(row, index);
        return rowClassName;
    };
    const activateRow = (row: T, index: number) => {
        if (isRowDisabled?.(row, index)) return;
        onRowClick?.(row);
    };
    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
        if (!onRowClick || isRowDisabled?.(row, index)) return;
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRowClick(row);
        }
    };

    return (
        <div className={cx('overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]', className)} aria-busy={loading}>
            <table className="w-full text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]" aria-label={ariaLabel}>
                {caption && (
                    <caption className="sr-only">
                        {caption}
                    </caption>
                )}
                <thead className={cx('bg-[var(--lb-color-surface-subdued)]', stickyHeader && 'sticky top-0 z-10')}>
                    <tr>
                        {columns.map((col) => {
                            const sorted = sortKey === col.key;
                            const align = dataTableAlign[col.align ?? 'start'];
                            return (
                                <th
                                    key={col.key}
                                    className={cx(cellPadding, align, 'font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]', col.className)}
                                    style={col.width ? { width: col.width } : undefined}
                                    aria-sort={sorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                                    scope="col"
                                >
                                    {col.sortable ? (
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-[var(--lb-space-1)] text-left hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                            onClick={() => onSort?.(col.key)}
                                        >
                                            {col.header}
                                            {sorted && (
                                                sortDirection === 'asc'
                                                    ? <ArrowUp className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    : <ArrowDown className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            )}
                                        </button>
                                    ) : (
                                        <span>{col.header}</span>
                                    )}
                                </th>
                            );
                        })}
                        {rowActions && (
                            <th className={cx(cellPadding, 'text-right font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text-subdued)]')} scope="col">
                                Actions
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lb-color-border)]">
                    {loading ? (
                        <tr>
                            <td colSpan={columnCount} className="px-[var(--lb-space-4)] py-[var(--lb-space-7)] text-center">
                                <div className="flex items-center justify-center gap-[var(--lb-space-2)] text-[color:var(--lb-color-text-subdued)]">
                                    <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin" aria-hidden="true" />
                                    {loadingLabel}
                                </div>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columnCount} className="px-[var(--lb-space-4)] py-[var(--lb-space-7)] text-center text-[color:var(--lb-color-text-subdued)]">
                                {emptyState ?? emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, i) => (
                            <tr
                                key={getRowKey(row, i)}
                                className={cx(
                                    'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface-subdued)]',
                                    onRowClick && !isRowDisabled?.(row, i) && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lb-color-focus-ring)]',
                                    isRowDisabled?.(row, i) && 'opacity-60',
                                    getRowClassName(row, i),
                                )}
                                tabIndex={onRowClick && !isRowDisabled?.(row, i) ? 0 : undefined}
                                onClick={() => activateRow(row, i)}
                                onKeyDown={(event) => handleRowKeyDown(event, row, i)}
                            >
                                {columns.map((col) => {
                                    const align = dataTableAlign[col.align ?? 'start'];
                                    return (
                                        <td key={col.key} className={cx(cellPadding, align, 'text-[color:var(--lb-color-text)]', col.className)}>
                                            {col.render
                                                ? col.render(row[col.key], row, i)
                                                : String(row[col.key] ?? '')}
                                        </td>
                                    );
                                })}
                                {rowActions && (
                                    <td className={cx(cellPadding, 'text-right text-[color:var(--lb-color-text)]')} onClick={(event) => event.stopPropagation()}>
                                        {rowActions(row, i)}
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export { Badge } from './feedback';
export type { BadgeProps } from './feedback';
