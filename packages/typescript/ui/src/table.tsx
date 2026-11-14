'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from './icons';
import { Badge, Skeleton } from './feedback';
import { Button } from './button';
import { Checkbox } from './controls';
import { cx } from './utils';

export interface TableColumn<T> {
    key: string;
    header: React.ReactNode;
    sortable?: boolean;
    truncate?: boolean;
    shrink?: boolean;
    width?: string;
    className?: string;
    headerClassName?: string;
    cellClassName?: string;
    render?: (row: T, index: number) => React.ReactNode;
    cardLabel?: React.ReactNode;
    cardRender?: (row: T, index: number) => React.ReactNode;
}

export interface TableBulkAction<T> {
    label: string;
    onAction: (rows: T[]) => void;
    destructive?: boolean;
}

export interface TableSavedView {
    label: string;
    value: string;
    count?: number;
}

export interface TableFilterChip {
    label: string;
    onRemove?: () => void;
}

export interface StaticTableProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    tableClassName?: string;
    containerClassName?: string;
}

export interface TableDataProps<T extends object> {
    columns: TableColumn<T>[];
    rows: T[];
    loading?: boolean;
    emptyState?: React.ReactNode;
    emptyMessage?: string;
    savedViews?: TableSavedView[];
    activeView?: string;
    onViewChange?: (value: string) => void;
    filterChips?: TableFilterChip[];
    bulkActions?: Array<TableBulkAction<T>>;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (key: string) => void;
    onRowClick?: (row: T) => void;
    getRowId?: (row: T, index: number) => string;
    selectedRowIds?: string[];
    onSelectionChange?: (ids: string[], rows: T[]) => void;
    selectable?: boolean;
    hideHeaderWhenEmpty?: boolean;
    className?: string;
}

export type TableProps<T extends object> = StaticTableProps | TableDataProps<T>;

function defaultRowId<T extends object>(row: T, index: number) {
    const id = (row as { id?: unknown }).id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : String(index);
}

function cellValue<T extends object>(row: T, key: string) {
    const value = (row as Record<string, unknown>)[key];
    if (value == null) return '';
    return String(value);
}

function SortIcon({ active, direction }: { active: boolean; direction?: 'asc' | 'desc' }) {
    if (!active) return null;
    return direction === 'asc'
        ? <ArrowUp className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />
        : <ArrowDown className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" />;
}

export function Table<T extends object>(props: TableProps<T>) {
    if ('children' in props) {
        const {
            children,
            className = '',
            tableClassName = '',
            containerClassName = '',
            ...staticProps
        } = props;

        return (
            <div className={cx('overflow-hidden border border-[var(--lb-component-table-border)] bg-[var(--lb-component-table-bg)] shadow-[var(--lb-component-card-shadow)]', className)} {...staticProps}>
                <div className={cx('overflow-auto', containerClassName)}>
                    <table className={cx('w-full border-collapse text-[length:var(--lb-font-size-table)] leading-[var(--lb-line-height-table)]', tableClassName)}>
                        {children}
                    </table>
                </div>
            </div>
        );
    }

    const {
        columns,
        rows,
        loading = false,
        emptyState,
        emptyMessage = 'No data found',
        savedViews = [],
        activeView,
        onViewChange,
        filterChips = [],
        bulkActions = [],
        sortKey,
        sortDirection,
        onSort,
        onRowClick,
        getRowId = defaultRowId,
        selectedRowIds,
        onSelectionChange,
        selectable,
        hideHeaderWhenEmpty = true,
        className = '',
    } = props;
    const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
    const selectedIds = selectedRowIds ?? internalSelectedIds;
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const rowIds = useMemo(() => rows.map((row, index) => getRowId(row, index)), [getRowId, rows]);
    const selectedRows = rows.filter((row, index) => selectedSet.has(rowIds[index] ?? getRowId(row, index)));
    const hasSelection = selectable ?? (bulkActions.length > 0 || Boolean(onSelectionChange) || selectedRowIds !== undefined);
    const allSelected = rows.length > 0 && rowIds.every((id) => selectedSet.has(id));
    const sortableColumns = columns.filter((column) => column.sortable);

    const commitSelection = (nextIds: string[]) => {
        if (selectedRowIds === undefined) setInternalSelectedIds(nextIds);
        const nextSet = new Set(nextIds);
        onSelectionChange?.(nextIds, rows.filter((row, index) => nextSet.has(rowIds[index] ?? getRowId(row, index))));
    };

    const toggleAll = () => {
        commitSelection(allSelected ? [] : rowIds);
    };

    const toggleRow = (id: string) => {
        const nextSet = new Set(selectedIds);
        if (nextSet.has(id)) nextSet.delete(id);
        else nextSet.add(id);
        commitSelection(Array.from(nextSet));
    };

    const renderCell = (column: TableColumn<T>, row: T, index: number) => (
        column.render ? column.render(row, index) : cellValue(row, column.key)
    );

    const showHeader = !(hideHeaderWhenEmpty && !loading && rows.length === 0);
    const showToolbar = !(hideHeaderWhenEmpty && !loading && rows.length === 0);
    const showSortBar = !(hideHeaderWhenEmpty && !loading && rows.length === 0);
    const renderCardCell = (column: TableColumn<T>, row: T, index: number) =>
        column.cardRender ? column.cardRender(row, index) : renderCell(column, row, index);

    return (
        <div className={cx('overflow-hidden border border-[var(--lb-component-table-border)] bg-[var(--lb-component-table-bg)] shadow-[var(--lb-component-card-shadow)]', className)}>
            {showToolbar && (savedViews.length > 0 || filterChips.length > 0) && (
                <div className="flex min-h-[var(--lb-density-action-bar-height)] flex-col gap-[var(--lb-space-2)] border-b border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
                    {savedViews.length > 0 && (
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            {savedViews.map((view) => {
                                const active = view.value === activeView;
                                return (
                                    <Button
                                        key={view.value}
                                        size="sm"
                                        variant={active ? 'primary' : 'secondary'}
                                        onClick={() => onViewChange?.(view.value)}
                                        aria-pressed={active}
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
                                key={action.label}
                                size="sm"
                                variant={action.destructive ? 'destructive' : 'secondary'}
                                onClick={() => action.onAction(selectedRows)}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            {showSortBar && sortableColumns.length > 0 && onSort && (
                <div className="flex gap-[var(--lb-space-2)] overflow-x-auto border-b border-[var(--lb-color-border)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] md:hidden">
                    {sortableColumns.map((column) => {
                        const active = sortKey === column.key;
                        return (
                            <Button
                                key={column.key}
                                size="sm"
                                variant={active ? 'primary' : 'secondary'}
                                aria-pressed={active}
                                onClick={() => onSort(column.key)}
                            >
                                {column.header}
                                <SortIcon active={active} direction={sortDirection} />
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
                    <div className="p-[var(--lb-space-3)] text-[color:var(--lb-component-table-text-secondary)]">
                        {emptyState ?? emptyMessage}
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--lb-color-border)]">
                        {hasSelection && (
                            <div className="bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                <Checkbox label="Select all visible rows" labelTextClassName="sr-only" checked={allSelected} onChange={toggleAll} />
                            </div>
                        )}
                        {rows.map((row, rowIndex) => {
                            const rowId = rowIds[rowIndex] ?? getRowId(row, rowIndex);
                            const selected = selectedSet.has(rowId);
                            return (
                                <article
                                    key={rowId}
                                    data-selected={hasSelection ? selected : undefined}
                                    className={cx(
                                        'grid gap-[var(--lb-space-3)] px-[var(--lb-space-4)] py-[var(--lb-space-4)]',
                                        onRowClick && 'cursor-pointer transition-colors hover:bg-[var(--lb-component-table-row-hover-bg)] active:bg-[var(--lb-component-table-row-hover-bg)]',
                                    )}
                                    onClick={() => onRowClick?.(row)}
                                >
                                    <div className="flex items-start gap-[var(--lb-space-3)]">
                                        {hasSelection && (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    className="mt-[var(--lb-space-1)]"
                                                    label={`Select row ${rowIndex + 1}`}
                                                    labelTextClassName="sr-only"
                                                    checked={selected}
                                                    onChange={() => toggleRow(rowId)}
                                                />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            {columns[0] ? renderCardCell(columns[0], row, rowIndex) : null}
                                        </div>
                                    </div>
                                    {columns.length > 1 && (
                                        <dl className="m-0 grid grid-cols-2 gap-x-[var(--lb-space-4)] gap-y-[var(--lb-space-3)]">
                                            {columns.slice(1).map((column) => (
                                                <div key={column.key} className="grid gap-[var(--lb-space-1)]">
                                                    <dt className="text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                        {column.cardLabel ?? column.header}
                                                    </dt>
                                                    <dd className="m-0 min-w-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                                        {renderCardCell(column, row, rowIndex)}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="hidden overflow-auto md:block">
                <table className="w-full border-collapse text-[length:var(--lb-font-size-table)] leading-[var(--lb-line-height-table)]">
                    {showHeader && (
                        <thead className="bg-[var(--lb-component-table-header-bg)] text-[color:var(--lb-component-table-text-secondary)]">
                            <tr>
                                {hasSelection && (
                                    <th className="h-[var(--lb-density-table-header-height)] w-[var(--lb-density-button-height-large)] px-[var(--lb-space-3)] py-0 text-left">
                                        <Checkbox label="Select all rows" labelTextClassName="sr-only" checked={allSelected} onChange={toggleAll} />
                                    </th>
                                )}
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={cx(
                                            'h-[var(--lb-density-table-header-height)] whitespace-nowrap px-[var(--lb-space-3)] py-0 text-left font-[var(--lb-font-weight-medium)]',
                                            column.shrink && 'w-px',
                                            column.className,
                                            column.headerClassName,
                                        )}
                                        style={column.width ? { width: column.width } : undefined}
                                    >
                                        {column.sortable ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onSort?.(column.key)}
                                            >
                                                {column.header}
                                                <SortIcon active={sortKey === column.key} direction={sortDirection} />
                                            </Button>
                                        ) : (
                                            column.header
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                    )}
                    <tbody className="divide-y divide-[var(--lb-component-table-border)]">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + (hasSelection ? 1 : 0)} className="p-[var(--lb-space-4)]">
                                    <Skeleton variant="table" lines={4} />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (hasSelection ? 1 : 0)} className="p-[var(--lb-space-4)] text-[color:var(--lb-component-table-text-secondary)]">
                                    {emptyState ?? emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => {
                                const rowId = rowIds[index] ?? getRowId(row, index);
                                const selected = selectedSet.has(rowId);
                                return (
                                    <tr key={rowId} aria-selected={hasSelection ? selected : undefined} className="hover:bg-[var(--lb-component-table-row-hover-bg)]">
                                        {hasSelection && (
                                            <td className="h-[var(--lb-density-table-row-height)] px-[var(--lb-space-3)] py-0">
                                                <Checkbox
                                                    label={`Select row ${index + 1}`}
                                                    labelTextClassName="sr-only"
                                                    checked={selected}
                                                    onChange={() => toggleRow(rowId)}
                                                />
                                            </td>
                                        )}
                                        {columns.map((column) => (
                                            <td
                                                key={column.key}
                                                className={cx(
                                                    'h-[var(--lb-density-table-row-height)] px-[var(--lb-space-3)] py-0 text-[color:var(--lb-component-table-text)]',
                                                    column.truncate && 'max-w-0 overflow-hidden',
                                                    column.shrink && 'w-px whitespace-nowrap',
                                                    column.className,
                                                    column.cellClassName,
                                                    onRowClick && 'cursor-pointer',
                                                )}
                                                onClick={() => onRowClick?.(row)}
                                            >
                                                {column.truncate ? (
                                                    <div className="truncate">{renderCell(column, row, index)}</div>
                                                ) : renderCell(column, row, index)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
