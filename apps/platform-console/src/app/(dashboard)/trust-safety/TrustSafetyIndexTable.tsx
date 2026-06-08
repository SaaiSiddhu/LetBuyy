'use client';

import { Badge, EmptyState, Table, type TableColumn } from '@letbuyy/ui';
import { formatIndiaDateTime as formatDateTime } from '@letbuyy/ui/formatting';

export type TrustSafetyStoreRisk = {
    id: string;
    name: string | null;
    store_name: string | null;
    site_type: string | null;
    subdomain: string | null;
    custom_domain: string | null;
    status: string | null;
    views_count: number | string | null;
    created_at: string | null;
    risk_level: 'warning' | 'critical';
    risk_reason: string;
    recommended_action: string;
};

type TrustSafetyIndexTableProps = {
    rows: TrustSafetyStoreRisk[];
    filterChipLabels: string[];
};

const columns: Array<TableColumn<TrustSafetyStoreRisk>> = [
    {
        key: 'merchant',
        header: 'Merchant',
        sortable: true,
        render: (row) => (
            <div className="min-w-[13rem]">
                <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {row.store_name || row.name || row.subdomain || row.id}
                </p>
                <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.custom_domain || (row.subdomain ? `${row.subdomain}.letbuyy.store` : row.id)}
                </p>
            </div>
        ),
    },
    {
        key: 'risk',
        header: 'Risk',
        sortable: true,
        render: (row) => <Badge label={formatLabel(row.risk_level)} variant={row.risk_level === 'critical' ? 'critical' : 'warning'} />,
    },
    {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <Badge label={formatLabel(row.status || 'unknown')} variant={statusVariant(row.status)} />,
    },
    {
        key: 'reason',
        header: 'Reason',
        render: (row) => (
            <div className="grid min-w-[16rem] gap-[var(--lb-space-1)]">
                <span className="font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">{row.risk_reason}</span>
                <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.recommended_action}
                </span>
            </div>
        ),
    },
    {
        key: 'views',
        header: 'Views',
        render: (row) => formatCount(Number(row.views_count || 0)),
    },
    {
        key: 'created',
        header: 'Created',
        sortable: true,
        render: (row) => formatDateTime(row.created_at),
    },
];

export function TrustSafetyIndexTable({ rows, filterChipLabels }: TrustSafetyIndexTableProps) {
    return (
        <Table
            columns={columns}
            rows={rows}
            emptyState={(
                <EmptyState
                    title="No derived merchant risks"
                    body="The current store sample did not include suspended, inactive, aged draft, or high-traffic merchant signals."
                    kind="generic"
                />
            )}
            filterChips={filterChipLabels.map((label) => ({ label }))}
        />
    );
}

function statusVariant(status: string | null | undefined): 'default' | 'info' | 'success' | 'warning' | 'critical' {
    const normalized = (status || '').toLowerCase();

    if (['published', 'active', 'verified'].includes(normalized)) return 'success';
    if (['draft', 'pending'].includes(normalized)) return 'warning';
    if (['suspended', 'frozen', 'inactive'].includes(normalized)) return 'critical';
    if (normalized) return 'info';
    return 'default';
}

function formatLabel(value: string): string {
    return value
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCount(value: number): string {
    return value.toLocaleString('en-IN');
}
