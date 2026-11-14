import type { ReactNode } from 'react';
import { Search, Inbox, ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { ConsoleRefresh } from './ConsoleRefresh';
import { Button, Input, Table } from '@letbuyy/ui';
import type { ConsolePagination } from '@/lib/console-api';
import { StatusPill } from './_local-ui/console-workspace';

export type ConsoleDataColumn<T> = {
    key: string;
    header: string;
    className?: string;
    cell: (row: T) => ReactNode;
};

type ConsoleDataTableProps<T> = {
    columns: Array<ConsoleDataColumn<T>>;
    rows: T[];
    meta?: ConsolePagination;
    basePath: string;
    query?: Record<string, string | undefined>;
    emptyLabel: string;
    getRowKey: (row: T) => string;
    caption?: string;
};

export function ConsoleDataTable<T>({
    columns,
    rows,
    meta,
    basePath,
    query = {},
    emptyLabel,
    getRowKey,
    caption,
}: ConsoleDataTableProps<T>) {
    return (
        <section className="console-data-table overflow-hidden border border-line bg-surface">
            <Table className="border-0 bg-surface shadow-none" containerClassName="overflow-x-auto" tableClassName="min-w-full divide-y divide-line text-sm">
                    <caption className="sr-only">{caption || `Records by ${columns.map(column => column.header).join(', ')}`}</caption>
                    <thead className="bg-page">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-subdued ${column.className || ''}`}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-subdued">
                                    <div className="mx-auto flex max-w-md flex-col items-center gap-3"><Inbox size={28} strokeWidth={1.5} aria-hidden="true" /><p className="font-medium text-default">No matching records</p><p>{emptyLabel}</p></div>
                                </td>
                            </tr>
                        ) : rows.map((row) => (
                            <tr key={getRowKey(row)} className="transition-colors hover:bg-surface-subdued">
                                {columns.map((column) => (
                                    <td key={column.key} className={`px-4 py-3 text-default ${column.className || ''}`}>
                                        {column.cell(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
            </Table>

            {meta ? (
                <div className="console-table-footer flex flex-col gap-3 border-t border-line px-4 py-3 text-sm text-subdued sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        {meta.total === 0 ? '0' : `${(meta.page - 1) * meta.per_page + 1}–${Math.min(meta.page * meta.per_page, meta.total)}`} of {meta.total.toLocaleString('en-IN')} records · Page {meta.page} of {Math.max(meta.total_pages, 1)}
                    </span>
                    <nav aria-label="Pagination" className="flex items-center gap-2">
                        <PaginationLink
                            href={pageHref(basePath, query, meta.page - 1)}
                            disabled={!meta.has_prev}
                            label="Previous"
                        />
                        <PaginationLink
                            href={pageHref(basePath, query, meta.page + 1)}
                            disabled={!meta.has_next}
                            label="Next"
                        />
                    </nav>
                </div>
            ) : null}
        </section>
    );
}

export function StatusBadge({ value, tone }: { value: string; tone?: 'green' | 'amber' | 'red' | 'zinc' }) {
    const resolvedTone = tone || (
        ['active', 'published', 'verified', 'trialing'].includes(value.toLowerCase())
            ? 'green'
            : ['draft', 'pending', 'past_due'].includes(value.toLowerCase())
                ? 'amber'
                : ['suspended', 'cancelled', 'inactive', 'false'].includes(value.toLowerCase())
                    ? 'red'
                    : 'zinc'
    );
    const semanticTone = { green: 'success', amber: 'warning', red: 'critical', zinc: 'neutral' } as const;
    return <StatusPill value={value} tone={semanticTone[resolvedTone]} />;
}

export function ConsoleSearchForm({
    placeholder,
    defaultValue,
    children,
}: {
    placeholder: string;
    defaultValue?: string;
    children?: ReactNode;
}) {
    return (
        <form role="search" aria-label={placeholder} className="console-filterbar flex flex-col gap-2 sm:flex-row sm:items-center" method="get">
            <Input
                unstyled
                type="search"
                name="q"
                defaultValue={defaultValue}
                placeholder={placeholder}
                aria-label={placeholder}
                className="min-h-11 rounded-[var(--lb-radius-md)] border border-line bg-surface px-4 py-2 text-sm text-default outline-none transition-colors placeholder:text-subdued focus:border-[var(--lb-color-primary)]"
            />
            {children}
            <Button
                unstyled
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-primary-cta)] px-4 py-2 text-sm font-semibold text-[var(--lb-color-primary-cta-text)] transition-colors hover:bg-[var(--lb-color-primary-hover)] active:bg-[var(--lb-color-primary-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lb-color-focus-ring)]"
            >
                <Search size={16} aria-hidden="true" />
                Search
            </Button>
        </form>
    );
}

export function ConsoleApiErrorPanel({ title, message }: { title: string; message: string }) {
    return (
        <section role="alert" className="console-error-panel rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-warning)] bg-[var(--lb-color-warning-soft)] p-[var(--lb-space-5)]">
            <h2 className="m-0 flex items-center gap-[var(--lb-space-2)] text-sm font-semibold text-[var(--lb-component-banner-warning-text)]"><TriangleAlert size={18} aria-hidden="true" />{title}</h2>
            <p className="m-0 mt-[var(--lb-space-1)] text-sm text-[var(--lb-color-text)]">{message}</p>
            <div className="mt-3"><ConsoleRefresh label="Retry loading" /></div>
        </section>
    );
}

function PaginationLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
    const content = <>{label === 'Previous' && <ChevronLeft size={16} aria-hidden="true" />}{label}{label === 'Next' && <ChevronRight size={16} aria-hidden="true" />}</>;
    if (disabled) {
        return (
            <span aria-disabled="true" className="console-pagination-link">
                {content}
            </span>
        );
    }

    return (
        <a
            href={href}
            className="console-pagination-link"
        >
            {content}
        </a>
    );
}

function pageHref(basePath: string, query: Record<string, string | undefined>, page: number): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        if (value) params.set(key, value);
    }

    params.set('page', String(Math.max(page, 1)));

    return `${basePath}?${params.toString()}`;
}
