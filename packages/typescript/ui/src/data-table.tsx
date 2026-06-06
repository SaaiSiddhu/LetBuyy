'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Loader2 } from './icons';
import { warnDeprecated } from './deprecations';
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

/**
 * @deprecated since 0.0.2. Use `Table` from `@letbuyy/ui` instead. This component remains for backward compatibility.
 */
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
    warnDeprecated('DataTable', 'Table');

    return (
        <div className={cx('overflow-auto rounded-[var(--lb-component-card-radius)] border border-[var(--lb-component-table-border)] bg-[var(--lb-component-table-bg)] shadow-[var(--lb-component-card-shadow)]', className)}>
            <table className="w-full text-[length:var(--lb-font-size-table)] leading-[var(--lb-line-height-table)]">
                <thead className="bg-[var(--lb-component-table-header-bg)]">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={cx(
                                    'h-[var(--lb-density-table-header-height)] px-[var(--lb-space-3)] py-0 text-left font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-table-text-secondary)]',
                                    col.sortable && 'cursor-pointer select-none hover:text-[color:var(--lb-component-table-text)]',
                                )}
                                style={col.width ? { width: col.width } : undefined}
                                onClick={() => col.sortable && onSort?.(col.key)}
                            >
                                <div className="flex items-center gap-[var(--lb-space-1)]">
                                    {col.header}
                                    {col.sortable && sortKey === col.key && (
                                        sortDirection === 'asc'
                                            ? <ArrowUp className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                                            : <ArrowDown className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lb-component-table-border)]">
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="px-[var(--lb-space-3)] py-[var(--lb-space-4)] text-center">
                                <div className="flex items-center justify-center gap-[var(--lb-space-2)] text-[color:var(--lb-component-table-text-secondary)]">
                                    <Loader2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] animate-spin" aria-hidden="true" />
                                    Loading...
                                </div>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-[var(--lb-space-3)] py-[var(--lb-space-4)] text-center text-[color:var(--lb-component-table-text-secondary)]">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, i) => (
                            <tr
                                key={(row.id as string) || i}
                                className={cx(
                                    'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-component-table-row-hover-bg)]',
                                    onRowClick && 'cursor-pointer',
                                )}
                                onClick={() => onRowClick?.(row)}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} className="h-[var(--lb-density-table-row-height)] px-[var(--lb-space-3)] py-0 text-[color:var(--lb-component-table-text)]">
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
