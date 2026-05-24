'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============= COMPONENT =============
export function DataTable({ columns, data, loading = false, emptyMessage = 'No data found', onRowClick, sortKey, sortDirection, onSort, className = '', }) {
    return (_jsx("div", { className: `overflow-auto rounded-lg border border-border ${className}`, children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-muted/50", children: _jsx("tr", { children: columns.map((col) => (_jsx("th", { className: [
                                'px-4 py-3 text-left font-medium text-muted-foreground',
                                col.sortable ? 'cursor-pointer select-none hover:text-foreground' : '',
                            ].join(' '), style: col.width ? { width: col.width } : undefined, onClick: () => col.sortable && onSort?.(col.key), children: _jsxs("div", { className: "flex items-center gap-1", children: [col.header, col.sortable && sortKey === col.key && (_jsx("span", { className: "text-xs", children: sortDirection === 'asc' ? '↑' : '↓' }))] }) }, col.key))) }) }), _jsx("tbody", { className: "divide-y divide-border", children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, className: "px-4 py-12 text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-2 text-muted-foreground", children: [_jsxs("svg", { className: "h-5 w-5 animate-spin", viewBox: "0 0 24 24", fill: "none", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] }), "Loading..."] }) }) })) : data.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, className: "px-4 py-12 text-center text-muted-foreground", children: emptyMessage }) })) : (data.map((row, i) => (_jsx("tr", { className: [
                            'transition-colors hover:bg-muted/50',
                            onRowClick ? 'cursor-pointer' : '',
                        ].join(' '), onClick: () => onRowClick?.(row), children: columns.map((col) => (_jsx("td", { className: "px-4 py-3", children: col.render
                                ? col.render(row[col.key], row, i)
                                : String(row[col.key] ?? '') }, col.key))) }, row.id || i)))) })] }) }));
}
const badgeVariants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};
export function Badge({ label, variant = 'default', className = '' }) {
    return (_jsx("span", { className: [
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            badgeVariants[variant],
            className,
        ].join(' '), children: label }));
}
//# sourceMappingURL=data-table.js.map