'use client';

import {
    Badge,
    EmptyState,
    IndexTable,
    type IndexTableColumn,
} from '@letbuyy/ui';
import { formatIndiaDateTime as formatDateTime } from '@letbuyy/ui/formatting';

export type ConsoleStore = {
    id: string;
    user_id: string | null;
    name: string | null;
    store_name: string | null;
    site_type: string | null;
    subdomain: string | null;
    custom_domain: string | null;
    status: string | null;
    published_at: string | null;
    views_count: number | null;
    created_at: string | null;
    updated_at: string | null;
    plan?: string | null;
    plan_name?: string | null;
    subscription_plan?: string | null;
    subscription_status?: string | null;
    monthly_revenue_paise?: number | string | null;
    revenue_paise?: number | string | null;
    total_revenue_paise?: number | string | null;
    orders_revenue_paise?: number | string | null;
    currency?: string | null;
};

type StoreDirectoryIndexTableProps = {
    rows: ConsoleStore[];
    filterChipLabels: string[];
};

const columns: Array<IndexTableColumn<ConsoleStore>> = [
    {
        key: 'store',
        header: 'Store',
        sortable: true,
        render: (row) => (
            <div className="min-w-[14rem]">
                <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {storeDisplayName(row)}
                </p>
                <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {storeDomain(row)}
                </p>
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <Badge label={formatStatusLabel(row.status || 'draft')} variant={statusVariant(row.status)} />,
    },
    {
        key: 'plan',
        header: 'Plan',
        render: (row) => {
            const plan = storePlan(row);

            return plan ? (
                <div className="grid gap-[var(--lb-space-1)]">
                    <span className="font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">{plan}</span>
                    {row.subscription_status ? (
                        <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                            {formatStatusLabel(row.subscription_status)}
                        </span>
                    ) : null}
                </div>
            ) : (
                <Badge label="Needs backend" variant="warning" />
            );
        },
    },
    {
        key: 'revenue',
        header: 'Revenue',
        render: (row) => {
            const revenue = storeRevenuePaise(row);

            return revenue === null ? (
                <Badge label="Needs backend" variant="warning" />
            ) : (
                <span className="font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                    {formatMoneyFromPaise(revenue, row.currency || 'INR')}
                </span>
            );
        },
    },
    {
        key: 'type',
        header: 'Type',
        render: (row) => <span className="capitalize">{(row.site_type || 'ecommerce').replace(/_/g, ' ')}</span>,
    },
    {
        key: 'created',
        header: 'Created',
        sortable: true,
        render: (row) => (
            <div className="grid gap-[var(--lb-space-1)]">
                <span>{formatDateTime(row.created_at)}</span>
                <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Updated {formatDateTime(row.updated_at)}
                </span>
            </div>
        ),
    },
];

export function StoreDirectoryIndexTable({ rows, filterChipLabels }: StoreDirectoryIndexTableProps) {
    return (
        <IndexTable
            columns={columns}
            rows={rows}
            emptyState={(
                <EmptyState
                    title="No stores matched"
                    body="Clear filters or search for another merchant/store identifier."
                    kind="generic"
                />
            )}
            filterChips={filterChipLabels.map((label) => ({ label }))}
        />
    );
}

function storeDisplayName(row: ConsoleStore): string {
    return row.store_name || row.name || 'Untitled store';
}

function storeDomain(row: ConsoleStore): string {
    if (row.custom_domain) return row.custom_domain;
    if (row.subdomain) return `${row.subdomain}.letbuyy.store`;
    return row.id;
}

function storePlan(row: ConsoleStore): string | null {
    return firstNonEmpty(row.plan_name, row.subscription_plan, row.plan);
}

function storeRevenuePaise(row: ConsoleStore): number | string | null {
    return firstValue(row.monthly_revenue_paise, row.revenue_paise, row.total_revenue_paise, row.orders_revenue_paise);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        const trimmed = value?.trim();
        if (trimmed) return trimmed;
    }

    return null;
}

function firstValue(...values: Array<number | string | null | undefined>): number | string | null {
    for (const value of values) {
        if (value !== null && value !== undefined && value !== '') return value;
    }

    return null;
}

function statusVariant(status: string | null | undefined): 'default' | 'info' | 'success' | 'warning' | 'critical' {
    const normalized = (status || '').toLowerCase();

    if (['active', 'published', 'verified'].includes(normalized)) return 'success';
    if (['draft', 'pending', 'trialing'].includes(normalized)) return 'warning';
    if (['suspended', 'cancelled', 'inactive'].includes(normalized)) return 'critical';
    if (normalized) return 'info';
    return 'default';
}

function formatStatusLabel(status: string): string {
    return status
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoneyFromPaise(value: number | string | null | undefined, currency = 'INR'): string {
    const amount = Number(value || 0) / 100;

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}
