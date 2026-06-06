'use client';

import {
    Badge,
    EmptyState,
    IndexTable,
    type IndexTableColumn,
} from '@letbuyy/ui';
import { formatIndiaDateTime as formatDateTime } from '@letbuyy/ui/formatting';

export type ConsoleSubscription = {
    id: string;
    user_id: string | null;
    store_id: string | null;
    plan: string | null;
    status: string | null;
    billing_period: string | null;
    payment_gateway: string | null;
    amount_paid: number | string | null;
    currency: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type SubscriptionManagementIndexTableProps = {
    rows: ConsoleSubscription[];
    filterChipLabels: string[];
};

const columns: Array<IndexTableColumn<ConsoleSubscription>> = [
    {
        key: 'plan',
        header: 'Plan',
        sortable: true,
        render: (row) => (
            <div className="min-w-[12rem]">
                <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {formatPlan(row)}
                </p>
                <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.store_id || row.user_id || row.id}
                </p>
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <Badge label={formatStatus(row.status || 'active')} variant={statusVariant(row.status)} />,
    },
    {
        key: 'amount',
        header: 'Amount',
        render: (row) => (
            <span className="font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                {formatMoneyFromPaise(row.amount_paid, row.currency || 'INR')}
            </span>
        ),
    },
    {
        key: 'gateway',
        header: 'Gateway',
        render: (row) => row.payment_gateway || '-',
    },
    {
        key: 'period',
        header: 'Current period',
        render: (row) => (
            <div className="grid gap-[var(--lb-space-1)]">
                <span>{formatDateTime(row.current_period_start)}</span>
                <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Ends {formatDateTime(row.current_period_end)}
                </span>
            </div>
        ),
    },
    {
        key: 'created',
        header: 'Created',
        sortable: true,
        render: (row) => formatDateTime(row.created_at),
    },
];

export function SubscriptionManagementIndexTable({ rows, filterChipLabels }: SubscriptionManagementIndexTableProps) {
    return (
        <IndexTable
            columns={columns}
            rows={rows}
            emptyState={(
                <EmptyState
                    title="No subscriptions matched"
                    body="Clear filters or search another plan, gateway, or provider subscription id."
                    kind="generic"
                />
            )}
            filterChips={filterChipLabels.map((label) => ({ label }))}
        />
    );
}

function formatPlan(row: ConsoleSubscription): string {
    const plan = row.plan?.trim() || 'free';
    const period = row.billing_period?.trim() || 'monthly';
    return `${formatStatus(plan)} / ${formatStatus(period)}`;
}

function statusVariant(status: string | null | undefined): 'default' | 'info' | 'success' | 'warning' | 'critical' {
    const normalized = (status || '').toLowerCase();

    if (['active', 'published', 'verified'].includes(normalized)) return 'success';
    if (['draft', 'pending', 'trialing', 'past_due'].includes(normalized)) return 'warning';
    if (['suspended', 'cancelled', 'canceled', 'inactive'].includes(normalized)) return 'critical';
    if (normalized) return 'info';
    return 'default';
}

function formatStatus(value: string): string {
    return value
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
