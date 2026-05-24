import React from 'react';
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
export declare function DataTable<T extends Record<string, unknown>>({ columns, data, loading, emptyMessage, onRowClick, sortKey, sortDirection, onSort, className, }: DataTableProps<T>): import("react/jsx-runtime").JSX.Element;
export interface BadgeProps {
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    className?: string;
}
export declare function Badge({ label, variant, className }: BadgeProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=data-table.d.ts.map