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
    render?: (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T extends Record<string, unknown>> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    className?: string;
}

// ============= COMPONENT =============

export function DataTable<T extends Record<string, unknown>>({
    columns,
    data,
    loading = false,
    emptyMessage = 'No data found',
    onRowClick,
    sortKey,
    sortDirection,
    onSort,
    className = '',
}: DataTableProps<T>) {
    return (
        <div className={cx('overflow-auto rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]', className)}>
            <table className="w-full text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                <thead className="bg-[var(--lb-color-surface-subdued)]">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={cx(
                                    'px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]',
                                    col.sortable && 'cursor-pointer select-none hover:text-[var(--lb-color-text)]',
                                )}
                                style={col.width ? { width: col.width } : undefined}
                                onClick={() => col.sortable && onSort?.(col.key)}
                            >
                                <div className="flex items-center gap-[var(--lb-space-1)]">
                                    {col.header}
                                    {col.sortable && sortKey === col.key && (
                                        sortDirection === 'asc'
                                            ? <ArrowUp className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            : <ArrowDown className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lb-color-border)]">
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="px-[var(--lb-space-4)] py-[var(--lb-space-7)] text-center">
                                <div className="flex items-center justify-center gap-[var(--lb-space-2)] text-[var(--lb-color-text-subdued)]">
                                    <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin" aria-hidden="true" />
                                    Loading...
                                </div>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-[var(--lb-space-4)] py-[var(--lb-space-7)] text-center text-[var(--lb-color-text-subdued)]">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, i) => (
                            <tr
                                key={(row.id as string) || i}
                                className={cx(
                                    'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface-subdued)]',
                                    onRowClick && 'cursor-pointer',
                                )}
                                onClick={() => onRowClick?.(row)}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text)]">
                                        {col.render
                                            ? col.render(row[col.key], row, i)
                                            : String(row[col.key] ?? '')}
                                    </td>
                                ))}
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
