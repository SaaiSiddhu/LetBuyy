'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Loader2 } from './icons';

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
        <div className={`overflow-auto rounded-lg border border-border ${className}`}>
            <table className="w-full text-sm">
                <thead className="bg-muted/50">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={[
                                    'px-4 py-3 text-left font-medium text-muted-foreground',
                                    col.sortable ? 'cursor-pointer select-none hover:text-foreground' : '',
                                ].join(' ')}
                                style={col.width ? { width: col.width } : undefined}
                                onClick={() => col.sortable && onSort?.(col.key)}
                            >
                                <div className="flex items-center gap-1">
                                    {col.header}
                                    {col.sortable && sortKey === col.key && (
                                        sortDirection === 'asc'
                                            ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
                                            : <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-12 text-center">
                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                                    Loading...
                                </div>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, i) => (
                            <tr
                                key={(row.id as string) || i}
                                className={[
                                    'transition-colors hover:bg-muted/50',
                                    onRowClick ? 'cursor-pointer' : '',
                                ].join(' ')}
                                onClick={() => onRowClick?.(row)}
                            >
                                {columns.map((col) => (
                                    <td key={col.key} className="px-4 py-3">
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

// ============= STATUS BADGE =============

export interface BadgeProps {
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    className?: string;
}

const badgeVariants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

export function Badge({ label, variant = 'default', className = '' }: BadgeProps) {
    return (
        <span
            className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                badgeVariants[variant],
                className,
            ].join(' ')}
        >
            {label}
        </span>
    );
}
