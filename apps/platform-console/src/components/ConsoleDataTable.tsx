import type { ReactNode } from 'react';
import type { ConsolePagination } from '@/lib/console-api';

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
};

export function ConsoleDataTable<T>({
    columns,
    rows,
    meta,
    basePath,
    query = {},
    emptyLabel,
    getRowKey,
}: ConsoleDataTableProps<T>) {
    return (
        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800 text-sm">
                    <thead className="bg-zinc-950/60">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 ${column.className || ''}`}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-zinc-500">
                                    {emptyLabel}
                                </td>
                            </tr>
                        ) : rows.map((row) => (
                            <tr key={getRowKey(row)} className="transition-colors hover:bg-zinc-800/40">
                                {columns.map((column) => (
                                    <td key={column.key} className={`px-4 py-3 text-zinc-300 ${column.className || ''}`}>
                                        {column.cell(row)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {meta ? (
                <div className="flex flex-col gap-3 border-t border-zinc-800 px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        Page {meta.page} of {Math.max(meta.total_pages, 1)} - {meta.total} records
                    </span>
                    <div className="flex items-center gap-2">
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
                    </div>
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
    const className = {
        green: 'bg-emerald-500/10 text-emerald-300',
        amber: 'bg-amber-500/10 text-amber-300',
        red: 'bg-red-500/10 text-red-300',
        zinc: 'bg-zinc-700/60 text-zinc-300',
    }[resolvedTone];

    return (
        <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${className}`}>
            {value}
        </span>
    );
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
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center" method="get">
            <input
                type="search"
                name="q"
                defaultValue={defaultValue}
                placeholder={placeholder}
                className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-sky-500"
            />
            {children}
            <button
                type="submit"
                className="min-h-11 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
                Search
            </button>
        </form>
    );
}

export function ConsoleApiErrorPanel({ title, message }: { title: string; message: string }) {
    return (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-amber-100/80">{message}</p>
        </section>
    );
}

function PaginationLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
    if (disabled) {
        return (
            <span className="rounded border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-600">
                {label}
            </span>
        );
    }

    return (
        <a
            href={href}
            className="rounded border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
            {label}
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
