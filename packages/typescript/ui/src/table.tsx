'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Columns3, Eye, EyeOff, GripVertical, Search, X } from 'lucide-react';
import { ArrowDown, ArrowUp } from './icons';
import { Skeleton } from './feedback';
import { Button } from './button';
import { Checkbox } from './controls';
import { cx } from './utils';

export interface TableColumn<T> {
    key: string;
    header: React.ReactNode;
    settingsLabel?: string;
    hideable?: boolean;
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
    appearance?: 'surface' | 'flat';
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
    appearance?: 'surface' | 'flat';
    search?: {
        value: string;
        onChange: (value: string) => void;
        label: string;
        placeholder?: string;
    };
    filterContent?: React.ReactNode;
    preferencesKey?: string;
    selectionScopeKey?: string;
    pagination?: {
        page: number;
        pageSize: number;
        total?: number;
        hasNext?: boolean;
        onPageChange: (page: number) => void;
        onPageSizeChange?: (size: number) => void;
        pageSizeOptions?: number[];
        itemLabel?: string;
    };
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
            appearance = 'flat',
            ...staticProps
        } = props;

        return (
            <div className={cx('bg-[var(--lb-component-table-bg)]', appearance === 'surface' && 'border border-[var(--lb-component-table-border)] shadow-[var(--lb-component-card-shadow)]', className)} {...staticProps}>
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
        appearance = 'flat',
        search,
        filterContent,
        preferencesKey,
        selectionScopeKey,
        pagination,
        className = '',
    } = props;
    const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [density, setDensity] = useState<'comfortable' | 'compact'>('compact');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [showSelectedOnly, setShowSelectedOnly] = useState(false);
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const filtersRef = useRef<HTMLDivElement>(null);
    const selectedIds = selectedRowIds ?? internalSelectedIds;
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const rowIds = useMemo(() => rows.map((row, index) => getRowId(row, index)), [getRowId, rows]);
    const selectedRows = rows.filter((row, index) => selectedSet.has(rowIds[index] ?? getRowId(row, index)));
    const hasSelection = selectable ?? (bulkActions.length > 0 || Boolean(onSelectionChange) || selectedRowIds !== undefined);
    const allSelected = rows.length > 0 && rowIds.every((id) => selectedSet.has(id));
    const sortableColumns = columns.filter((column) => column.sortable);
    const orderedColumns = useMemo(() => {
        const byKey = new Map(columns.map(column => [column.key, column]));
        const first = columns[0];
        const rest = columnOrder.map(key => byKey.get(key))
            .filter((column): column is TableColumn<T> => Boolean(column) && column !== first);
        return [...(first ? [first] : []), ...rest,
            ...columns.filter(column => column !== first && !columnOrder.includes(column.key))];
    }, [columns, columnOrder]);
    const visibleColumns = orderedColumns.filter(column => column === columns[0] || column.hideable === false || !hiddenColumns.includes(column.key));
    const displayedRows = rows.map((row, index) => ({ row, index, id: rowIds[index] ?? getRowId(row, index) }))
        .filter(item => !showSelectedOnly || selectedSet.has(item.id));

    useEffect(() => {
        if (!preferencesKey) return;
        try {
            const saved = JSON.parse(window.localStorage.getItem(preferencesKey) || '{}') as { hidden?: unknown; order?: unknown; density?: unknown };
            setHiddenColumns(Array.isArray(saved.hidden) ? saved.hidden.filter((key): key is string => typeof key === 'string') : []);
            setColumnOrder(Array.isArray(saved.order) ? saved.order.filter((key): key is string => typeof key === 'string') : []);
            setDensity(saved.density === 'comfortable' ? 'comfortable' : 'compact');
        } catch {
            setHiddenColumns([]);
            setColumnOrder([]);
            setDensity('compact');
        }
    }, [preferencesKey]);

    useEffect(() => {
        if (selectedRowIds === undefined) setInternalSelectedIds([]);
        setShowSelectedOnly(false);
    }, [selectionScopeKey, selectedRowIds === undefined]);

    useEffect(() => {
        if (selectedRows.length === 0) setShowSelectedOnly(false);
    }, [selectedRows.length]);

    useEffect(() => {
        if (!settingsOpen && !filtersOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !settingsRef.current?.contains(event.target)) setSettingsOpen(false);
            if (event.target instanceof Node && !filtersRef.current?.contains(event.target)) setFiltersOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setSettingsOpen(false); setFiltersOpen(false); }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
    }, [settingsOpen, filtersOpen]);

    const savePreferences = (hidden: string[], order: string[], nextDensity: 'comfortable' | 'compact') => {
        if (!preferencesKey) return;
        try { window.localStorage.setItem(preferencesKey, JSON.stringify({ hidden, order, density: nextDensity })); }
        catch { /* Preferences remain usable for this session when storage is unavailable. */ }
    };

    const toggleColumn = (key: string) => {
        const next = hiddenColumns.includes(key) ? hiddenColumns.filter(item => item !== key) : [...hiddenColumns, key];
        setHiddenColumns(next);
        savePreferences(next, columnOrder, density);
    };

    const moveColumn = (key: string, step: -1 | 1) => {
        const keys = orderedColumns.map(column => column.key);
        const index = keys.indexOf(key);
        const target = index + step;
        if (index < 1 || target < 1 || target >= keys.length) return;
        [keys[index], keys[target]] = [keys[target]!, keys[index]!];
        setColumnOrder(keys);
        savePreferences(hiddenColumns, keys, density);
    };

    const reorderColumn = (source: string, target: string) => {
        if (source === target || source === columns[0]?.key || target === columns[0]?.key) return;
        const keys = orderedColumns.map(column => column.key);
        const from = keys.indexOf(source);
        const to = keys.indexOf(target);
        if (from < 1 || to < 1) return;
        keys.splice(from, 1);
        keys.splice(to, 0, source);
        setColumnOrder(keys);
        savePreferences(hiddenColumns, keys, density);
    };

    const commitSelection = (nextIds: string[]) => {
        if (selectedRowIds === undefined) setInternalSelectedIds(nextIds);
        const nextSet = new Set(nextIds);
        onSelectionChange?.(nextIds, rows.filter((row, index) => nextSet.has(rowIds[index] ?? getRowId(row, index))));
    };

    const toggleAll = () => {
        const next = new Set(selectedIds);
        rowIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
        commitSelection(Array.from(next));
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
    const showSortBar = !(hideHeaderWhenEmpty && !loading && rows.length === 0);
    const renderCardCell = (column: TableColumn<T>, row: T, index: number) =>
        column.cardRender ? column.cardRender(row, index) : renderCell(column, row, index);
    const totalPages = pagination?.total === undefined ? undefined : Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
    const pageStart = pagination && rows.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
    const pageEnd = pagination ? pageStart + rows.length - (rows.length > 0 ? 1 : 0) : 0;
    const canGoNext = pagination && (totalPages !== undefined ? pagination.page < totalPages : Boolean(pagination.hasNext));
    const rowHeight = density === 'compact' ? 'h-[var(--lb-density-table-row-height)]' : 'h-[var(--lb-density-table-row-height)] py-[var(--lb-space-2)]';

    return (
        <div className={cx('relative bg-[var(--lb-component-table-bg)]', appearance === 'surface' && 'border border-[var(--lb-component-table-border)] shadow-[var(--lb-component-card-shadow)]', className)}>
            {(savedViews.length > 0 || filterChips.length > 0 || search || filterContent || columns.length > 1) && (
                <div className="relative z-10 flex flex-col gap-[var(--lb-space-2)] py-[var(--lb-space-3)]">
                    <div className="flex min-h-[var(--lb-size-control-md)] items-stretch gap-[var(--lb-space-1)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] shadow-[var(--lb-shadow-sm)]">
                        {savedViews.length > 0 && (
                            <select
                                aria-label="Table view"
                                value={activeView ?? savedViews[0]?.value}
                                onChange={event => onViewChange?.(event.target.value)}
                                className="w-auto rounded-[var(--lb-radius-md)] border-0 bg-transparent px-[var(--lb-space-1)] text-[length:var(--lb-font-size-secondary)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:bg-[var(--lb-color-surface-subdued)]"
                            >
                                {savedViews.map(view => <option key={view.value} value={view.value}>{view.label}{typeof view.count === 'number' ? ` (${view.count})` : ''}</option>)}
                            </select>
                        )}
                        {search ? (
                            <div ref={filtersRef} className="relative flex min-w-0 flex-1 items-stretch border-l border-[var(--lb-color-border)]">
                                <label className="flex min-w-0 flex-1 items-center gap-[var(--lb-space-2)] px-[var(--lb-space-2)]">
                                    <Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[color:var(--lb-color-text-subdued)]" aria-hidden="true" />
                                    <span className="sr-only">{search.label}</span>
                                    <input type="search" value={search.value} onFocus={() => { if (filterContent) { setFiltersOpen(true); setSettingsOpen(false); } }} onClick={() => { if (filterContent) setFiltersOpen(true); }} onChange={event => search.onChange(event.target.value)} placeholder={search.placeholder ?? search.label} className="min-w-0 flex-1 border-0 bg-transparent py-[var(--lb-space-2)] text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-text)] outline-none placeholder:text-[color:var(--lb-color-text-subdued)]" />
                                </label>
                                {filterContent && filtersOpen && <div role="dialog" aria-label="Search filters" className="absolute left-0 top-full z-30 mt-[var(--lb-space-2)] w-[min(20rem,calc(100vw-2rem))] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)] shadow-[var(--lb-shadow-lg)]">{filterContent}</div>}
                            </div>
                        ) : <span className="min-w-0 flex-1" />}
                        {columns.length > 1 && (
                            <div ref={settingsRef} className="relative flex items-center">
                                <button type="button" aria-label="Sort and columns" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(!settingsOpen); setFiltersOpen(false); }} className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:bg-[var(--lb-color-surface-subdued)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                                    <Columns3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                </button>
                                {settingsOpen && (
                                    <div role="dialog" aria-label="Sort and columns" className="absolute right-0 top-full z-30 mt-[var(--lb-space-2)] w-[min(19rem,calc(100vw-2rem))] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)] shadow-[var(--lb-shadow-lg)]">
                                        <div className="flex items-center justify-between"><strong className="text-[length:var(--lb-font-size-secondary)]">Customize table</strong><button type="button" aria-label="Close table settings" onClick={() => setSettingsOpen(false)}><X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" /></button></div>
                                        {sortableColumns.length > 0 && onSort && <label className="mt-[var(--lb-space-3)] grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-secondary)]">Sort by<select aria-label="Sort by" value={sortKey ?? sortableColumns[0]?.key} onChange={event => onSort(event.target.value)} className="w-full rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-2)] text-[color:var(--lb-color-text)]">{sortableColumns.map(column => <option key={column.key} value={column.key}>{column.settingsLabel ?? (typeof column.header === 'string' ? column.header : column.key)}</option>)}</select></label>}
                                        {sortableColumns.length > 0 && onSort && sortKey && <button type="button" onClick={() => onSort(sortKey)} className="mt-[var(--lb-space-2)] inline-flex items-center gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-primary)]">{sortDirection === 'asc' ? 'Ascending' : 'Descending'} <SortIcon active direction={sortDirection} /></button>}
                                        <div className="mt-[var(--lb-space-3)] flex items-center justify-between gap-[var(--lb-space-2)]"><span className="text-[length:var(--lb-font-size-secondary)]">Density</span><div className="flex rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)]"><button type="button" aria-pressed={density === 'comfortable'} onClick={() => { setDensity('comfortable'); savePreferences(hiddenColumns, columnOrder, 'comfortable'); }} className={cx('px-[var(--lb-space-2)] py-[var(--lb-space-1)]', density === 'comfortable' && 'bg-[var(--lb-color-primary-soft)]')}>Comfortable</button><button type="button" aria-pressed={density === 'compact'} onClick={() => { setDensity('compact'); savePreferences(hiddenColumns, columnOrder, 'compact'); }} className={cx('px-[var(--lb-space-2)] py-[var(--lb-space-1)]', density === 'compact' && 'bg-[var(--lb-color-primary-soft)]')}>Compact</button></div></div>
                                        <div className="mt-[var(--lb-space-3)] border-t border-[var(--lb-color-border)] pt-[var(--lb-space-2)]"><strong className="text-[length:var(--lb-font-size-secondary)]">Columns</strong><div className="mt-[var(--lb-space-1)] max-h-[var(--lb-size-combobox-menu-max-height)] overflow-y-auto">{orderedColumns.map((column, index) => { const fixed = column === columns[0] || column.hideable === false; const visible = fixed || !hiddenColumns.includes(column.key); const name = column.settingsLabel ?? (typeof column.header === 'string' ? column.header : column.key); return <div key={column.key} onDragOver={event => { if (draggedColumn && !fixed) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (draggedColumn) reorderColumn(draggedColumn, column.key); setDraggedColumn(null); }} className={cx('flex items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] px-[var(--lb-space-1)] py-[var(--lb-space-1)]', draggedColumn === column.key && 'bg-[var(--lb-color-surface-subdued)]')}><span role={fixed ? undefined : 'button'} draggable={!fixed} aria-label={fixed ? undefined : `Drag ${name} column to reorder; use arrow keys to move`} tabIndex={fixed ? -1 : 0} onDragStart={event => { setDraggedColumn(column.key); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', column.key); }} onDragEnd={() => setDraggedColumn(null)} onKeyDown={event => { if (event.key === 'ArrowUp' && index > 1) { event.preventDefault(); moveColumn(column.key, -1); } if (event.key === 'ArrowDown' && index < orderedColumns.length - 1) { event.preventDefault(); moveColumn(column.key, 1); } }} className={cx('inline-flex text-[color:var(--lb-color-text-subdued)]', fixed ? 'opacity-30' : 'cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] active:cursor-grabbing')}><GripVertical className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate text-[length:var(--lb-font-size-secondary)]">{name}</span><button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${name} column`} aria-pressed={visible} disabled={fixed} onClick={() => toggleColumn(column.key)} className="rounded-[var(--lb-radius-sm)] p-[var(--lb-space-1)] text-[color:var(--lb-color-text-subdued)] disabled:opacity-40">{visible ? <Eye className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" /> : <EyeOff className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />}</button></div>; })}</div></div>
                                        <button type="button" className="mt-[var(--lb-space-3)] text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-primary)]" onClick={() => { setHiddenColumns([]); setColumnOrder([]); setDensity('compact'); savePreferences([], [], 'compact'); }}>Reset columns</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {filterChips.length > 0 && <div className="flex flex-wrap gap-[var(--lb-space-1)]">{filterChips.map(chip => chip.onRemove ? <button key={chip.label} type="button" onClick={chip.onRemove} aria-label={`Remove ${chip.label} filter`} className="inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-0)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">{chip.label}<X className="h-[var(--lb-density-table-icon-size)] w-[var(--lb-density-table-icon-size)]" aria-hidden="true" /></button> : <span key={chip.label} className="rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-2)] py-[var(--lb-space-0)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">{chip.label}</span>)}</div>}
                </div>
            )}
            {selectedRows.length > 0 && bulkActions.length > 0 && (
                <div className="flex min-h-[var(--lb-density-action-bar-height)] flex-wrap items-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
                    <strong className="text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-text)]">{selectedRows.length} selected</strong>
                    <button type="button" className="text-[length:var(--lb-font-size-secondary)] text-[color:var(--lb-color-primary)]" onClick={() => commitSelection(selectedIds.filter(id => !rowIds.includes(id)))}>Clear</button>
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
                    <label className="ml-auto inline-flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-secondary)]"><input type="checkbox" checked={showSelectedOnly} onChange={event => setShowSelectedOnly(event.target.checked)} />Show selected only</label>
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
                ) : displayedRows.length === 0 ? (
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
                        {displayedRows.map(({ row, index: rowIndex, id: rowId }) => {
                            const selected = selectedSet.has(rowId);
                            return (
                                <article
                                    key={rowId}
                                    data-selected={hasSelection ? selected : undefined}
                                    className={cx(
                                        'grid gap-[var(--lb-space-3)] px-[var(--lb-space-4)] py-[var(--lb-space-4)]',
                                        selected && 'bg-[var(--lb-color-primary-soft)]',
                                        onRowClick && 'cursor-pointer transition-colors hover:bg-[var(--lb-component-table-row-hover-bg)] active:bg-[var(--lb-component-table-row-hover-bg)]',
                                    )}
                                    onClick={(event) => {
                                        if (event.target instanceof Element && event.target.closest('a,button,input,select,textarea')) return;
                                        onRowClick?.(row);
                                    }}
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
                                            {visibleColumns[0] ? renderCardCell(visibleColumns[0], row, rowIndex) : null}
                                        </div>
                                    </div>
                                    {visibleColumns.length > 1 && (
                                        <dl className="m-0 grid grid-cols-2 gap-x-[var(--lb-space-4)] gap-y-[var(--lb-space-3)]">
                                            {visibleColumns.slice(1).map((column) => (
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
                <table className="w-full border-separate border-spacing-0 text-[length:var(--lb-font-size-table)] leading-[var(--lb-line-height-table)]">
                    {showHeader && (
                        <thead className="bg-[var(--lb-color-surface-subdued)] text-[color:var(--lb-component-table-text-secondary)]">
                            <tr>
                                {hasSelection && (
                                    <th className="h-[var(--lb-density-table-header-height)] w-[var(--lb-density-button-height-large)] rounded-l-[var(--lb-radius-md)] px-[var(--lb-space-3)] py-0 text-left">
                                        <Checkbox label="Select all rows" labelTextClassName="sr-only" checked={allSelected} onChange={toggleAll} />
                                    </th>
                                )}
                                {visibleColumns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={cx(
                                            'h-[var(--lb-density-table-header-height)] whitespace-nowrap px-[var(--lb-space-3)] py-0 text-left font-[var(--lb-font-weight-medium)] first:rounded-l-[var(--lb-radius-md)] last:rounded-r-[var(--lb-radius-md)]',
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
                    <tbody className="[&_tr:not(:last-child)_td]:border-b [&_tr:not(:last-child)_td]:border-[var(--lb-component-table-border)]">
                        {loading ? (
                            <tr>
                                <td colSpan={visibleColumns.length + (hasSelection ? 1 : 0)} className="p-[var(--lb-space-4)]">
                                    <Skeleton variant="table" lines={4} />
                                </td>
                            </tr>
                        ) : displayedRows.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + (hasSelection ? 1 : 0)} className="p-[var(--lb-space-4)] text-[color:var(--lb-component-table-text-secondary)]">
                                    {emptyState ?? emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            displayedRows.map(({ row, index, id: rowId }) => {
                                const selected = selectedSet.has(rowId);
                                return (
                                    <tr key={rowId} aria-selected={hasSelection ? selected : undefined} className={cx('hover:bg-[var(--lb-component-table-row-hover-bg)]', selected && 'bg-[var(--lb-color-primary-soft)]')}>
                                        {hasSelection && (
                                            <td className={cx(rowHeight, 'px-[var(--lb-space-3)]')}>
                                                <Checkbox
                                                    label={`Select row ${index + 1}`}
                                                    labelTextClassName="sr-only"
                                                    checked={selected}
                                                    onChange={() => toggleRow(rowId)}
                                                />
                                            </td>
                                        )}
                                        {visibleColumns.map((column) => (
                                            <td
                                                key={column.key}
                                                className={cx(
                                                    rowHeight, 'px-[var(--lb-space-3)] text-[color:var(--lb-component-table-text)]',
                                                    column.truncate && 'max-w-0 overflow-hidden',
                                                    column.shrink && 'w-px whitespace-nowrap',
                                                    column.className,
                                                    column.cellClassName,
                                                    onRowClick && 'cursor-pointer',
                                                )}
                                                onClick={(event) => {
                                                    if (event.target instanceof Element && event.target.closest('a,button,input,select,textarea')) return;
                                                    onRowClick?.(row);
                                                }}
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
            {pagination && <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-2)] border-t border-[var(--lb-color-border)] px-[var(--lb-space-1)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                <span>{pagination.total === undefined ? `Page ${pagination.page}` : `${pageStart}–${pageEnd} of ${pagination.total} ${pagination.itemLabel ?? 'items'}`}</span>
                <div className="flex items-center gap-[var(--lb-space-1)]">
                    {pagination.onPageSizeChange && <select aria-label="Rows per page" value={pagination.pageSize} onChange={event => pagination.onPageSizeChange?.(Number(event.target.value))} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[color:var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">{(pagination.pageSizeOptions ?? [25, 50, 100]).map(size => <option key={size} value={size}>{size} per page</option>)}</select>}
                    <Button size="sm" variant="ghost" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)}>Previous</Button>
                    <span aria-live="polite" className="min-w-[var(--lb-size-control-md)] text-center text-[color:var(--lb-color-text)]">{pagination.page}{totalPages !== undefined ? ` / ${totalPages}` : ''}</span>
                    <Button size="sm" variant="ghost" disabled={!canGoNext} onClick={() => pagination.onPageChange(pagination.page + 1)}>Next</Button>
                </div>
            </div>}
        </div>
    );
}
