'use client';

import {
    Badge,
    EmptyState,
    IndexTable,
    ProgressBar,
    type IndexTableColumn,
} from '@letbuyy/ui';

type HealthBand = 'healthy' | 'watch' | 'at_risk';

export interface MerchantHealthRow {
    id: string;
    storeName: string;
    subdomain: string;
    siteType: string;
    statusLabel: string;
    score: number;
    band: HealthBand;
    bandLabel: string;
    productLabel: string;
    orderLabel: string;
    themeLabel: string;
    paymentLabel: string;
    shippingLabel: string;
    issues: string[];
}

function bandVariant(band: MerchantHealthRow['band']) {
    if (band === 'healthy') return 'success' as const;
    if (band === 'watch') return 'warning' as const;
    return 'critical' as const;
}

const columns: IndexTableColumn<MerchantHealthRow>[] = [
    {
        key: 'merchant',
        header: 'Merchant',
        render: (row) => (
            <div className="min-w-0">
                <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {row.storeName}
                </p>
                <p className="m-0 truncate text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.subdomain} - {row.siteType}
                </p>
            </div>
        ),
    },
    {
        key: 'score',
        header: 'Health',
        render: (row) => (
            <div className="min-w-[180px]">
                <ProgressBar value={row.score} label={row.bandLabel} showValue />
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        render: (row) => <Badge label={row.statusLabel} variant={bandVariant(row.band)} />,
    },
    {
        key: 'readiness',
        header: 'Readiness',
        render: (row) => (
            <div className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                <span>{row.productLabel}</span>
                <span>{row.orderLabel}</span>
                <span>{row.themeLabel}</span>
                <span>{row.paymentLabel}</span>
                <span>{row.shippingLabel}</span>
            </div>
        ),
    },
    {
        key: 'needs',
        header: 'Needs',
        render: (row) => (
            <div className="max-w-[280px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.issues.length > 0 ? row.issues.join(', ') : 'Ready'}
            </div>
        ),
    },
];

export function MerchantHealthIndexTable({ rows }: { rows: MerchantHealthRow[] }) {
    return (
        <IndexTable
            columns={columns}
            rows={rows}
            savedViews={[
                { label: 'All', value: 'all', count: rows.length },
                { label: 'Ready', value: 'ready', count: rows.filter((row) => row.band === 'healthy').length },
                { label: 'Review', value: 'review', count: rows.filter((row) => row.band !== 'healthy').length },
            ]}
            activeView="all"
            emptyState={
                <EmptyState
                    kind="analytics"
                    title="No merchant health rows"
                    body="The current session did not return stores matching these filters."
                />
            }
        />
    );
}
