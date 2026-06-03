'use client';

import React, { useState } from 'react';
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
    selectable?: boolean;
    selectedRowKeys?: React.Key[];
    defaultSelectedRowKeys?: React.Key[];
    onSelectionChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
    bulkActions?: React.ReactNode;
    selectionLabel?: string;
    selectAllLabel?: string;
    selectRowLabel?: (row: T, index: number) => string;
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

const dataTableCheckboxClassName = 'h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] rounded-[var(--lb-radius-sm)] border-[var(--lb-color-border)] accent-[var(--lb-color-action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50';

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
    selectable = false,
    selectedRowKeys,
    defaultSelectedRowKeys = [],
    onSelectionChange,
    bulkActions,
    selectionLabel = 'Selected rows',
    selectAllLabel = 'Select all rows',
    selectRowLabel = (_row, index) => `Select row ${index + 1}`,
    className = '',
}: DataTableProps<T>) {
    const [uncontrolledSelectedRowKeys, setUncontrolledSelectedRowKeys] = useState<React.Key[]>(defaultSelectedRowKeys);
    const cellPadding = dataTableCellDensity[density];
    const columnCount = columns.length + (rowActions ? 1 : 0) + (selectable ? 1 : 0);
    const getRowKey = (row: T, index: number) => {
        if (typeof rowKey === 'function') return rowKey(row, index);
        if (rowKey) return row[rowKey] as React.Key;
        return (row.id as React.Key | undefined) ?? index;
    };
    const rowEntries = data.map((row, index) => ({
        row,
        index,
        key: getRowKey(row, index),
        disabled: isRowDisabled?.(row, index) ?? false,
    }));
    const controlledSelection = selectedRowKeys !== undefined;
    const activeSelectedRowKeys = controlledSelection ? selectedRowKeys : uncontrolledSelectedRowKeys;
    const selectedKeySet = new Set(activeSelectedRowKeys);
    const selectableRows = rowEntries.filter((entry) => !entry.disabled);
    const selectedRows = rowEntries.filter((entry) => selectedKeySet.has(entry.key));
    const selectedRowsForCallback = (keys: React.Key[]) => {
        const nextKeySet = new Set(keys);
        return rowEntries.filter((entry) => nextKeySet.has(entry.key)).map((entry) => entry.row);
    };
    const commitSelection = (keys: React.Key[]) => {
        if (!controlledSelection) setUncontrolledSelectedRowKeys(keys);
        onSelectionChange?.(keys, selectedRowsForCallback(keys));
    };
    const allSelectableRowsSelected = selectableRows.length > 0 && selectableRows.every((entry) => selectedKeySet.has(entry.key));
    const someSelectableRowsSelected = selectableRows.some((entry) => selectedKeySet.has(entry.key));
    const toggleAllRows = () => {
        if (allSelectableRowsSelected) {
            const selectableKeySet = new Set(selectableRows.map((entry) => entry.key));
            commitSelection(activeSelectedRowKeys.filter((key) => !selectableKeySet.has(key)));
            return;
        }
        commitSelection(Array.from(new Set([...activeSelectedRowKeys, ...selectableRows.map((entry) => entry.key)])));
    };
    const toggleRowSelection = (key: React.Key, row: T, index: number) => {
        if (isRowDisabled?.(row, index)) return;
        if (selectedKeySet.has(key)) {
            commitSelection(activeSelectedRowKeys.filter((selectedKey) => selectedKey !== key));
            return;
        }
        commitSelection([...activeSelectedRowKeys, key]);
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
        <div className={cx('overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]', className)} aria-busy={loading}>
            {selectable && bulkActions && selectedRows.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                    <span className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text)]">
                        {selectionLabel}: {selectedRows.length}
                    </span>
                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">{bulkActions}</div>
                </div>
            )}
            <div className="overflow-auto">
            <table className="w-full text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]" aria-label={ariaLabel}>
                {caption && (
                    <caption className="sr-only">
                        {caption}
                    </caption>
                )}
                <thead className={cx('bg-[var(--lb-color-surface-subdued)]', stickyHeader && 'sticky top-0 z-10')}>
                    <tr>
                        {selectable && (
                            <th className={cx(cellPadding, 'w-[var(--lb-size-control-md)] text-left')} scope="col">
                                <input
                                    type="checkbox"
                                    className={dataTableCheckboxClassName}
                                    checked={allSelectableRowsSelected}
                                    aria-checked={someSelectableRowsSelected && !allSelectableRowsSelected ? 'mixed' : allSelectableRowsSelected}
                                    aria-label={selectAllLabel}
                                    disabled={selectableRows.length === 0}
                                    onChange={toggleAllRows}
                                />
                            </th>
                        )}
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
                        rowEntries.map(({ row, index: i, key, disabled: rowDisabled }) => (
                            <tr
                                key={key}
                                className={cx(
                                    'transition-colors duration-[var(--lb-motion-fast)] ease-[var(--lb-ease-standard)] hover:bg-[var(--lb-color-surface-subdued)]',
                                    onRowClick && !rowDisabled && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lb-color-focus-ring)]',
                                    rowDisabled && 'opacity-60',
                                    selectable && selectedKeySet.has(key) && 'bg-[var(--lb-color-primary-soft)]',
                                    getRowClassName(row, i),
                                )}
                                tabIndex={onRowClick && !rowDisabled ? 0 : undefined}
                                aria-selected={selectable ? selectedKeySet.has(key) : undefined}
                                onClick={() => activateRow(row, i)}
                                onKeyDown={(event) => handleRowKeyDown(event, row, i)}
                            >
                                {selectable && (
                                    <td className={cx(cellPadding, 'w-[var(--lb-size-control-md)]')} onClick={(event) => event.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className={dataTableCheckboxClassName}
                                            checked={selectedKeySet.has(key)}
                                            disabled={rowDisabled}
                                            aria-label={selectRowLabel(row, i)}
                                            onChange={() => toggleRowSelection(key, row, i)}
                                        />
                                    </td>
                                )}
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
        </div>
    );
}

export { Badge } from './feedback';
export type { BadgeProps } from './feedback';
