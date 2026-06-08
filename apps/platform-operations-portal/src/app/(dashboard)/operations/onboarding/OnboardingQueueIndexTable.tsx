'use client';

import { Badge, EmptyState, Table, ProgressBar, type TableColumn } from '@letbuyy/ui';
import type { OnboardingQueueRow } from './page';

function bandVariant(band: OnboardingQueueRow['band']) {
    if (band === 'ready') return 'success' as const;
    if (band === 'needs_help') return 'warning' as const;
    return 'critical' as const;
}

const columns: TableColumn<OnboardingQueueRow>[] = [
    {
        key: 'merchant',
        header: 'Merchant',
        render: (row) => (
            <div className="min-w-0">
                <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {row.merchantName}
                </p>
                <p className="m-0 truncate text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.storeHandle} - {row.siteType}
                </p>
            </div>
        ),
    },
    {
        key: 'queue',
        header: 'Queue',
        render: (row) => <Badge label={row.bandLabel} variant={bandVariant(row.band)} />,
    },
    {
        key: 'checklist',
        header: 'Checklist',
        render: (row) => (
            <div className="grid min-w-[180px] gap-[var(--lb-space-2)]">
                <ProgressBar
                    aria-label={`${row.merchantName} onboarding checklist`}
                    value={row.progress}
                />
                <span className="text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.checklistCompleted} of {row.checklistTotal} signals ready
                </span>
            </div>
        ),
    },
    {
        key: 'step',
        header: 'Current step',
        render: (row) => (
            <div className="max-w-[220px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.currentStepLabel}
            </div>
        ),
    },
    {
        key: 'signals',
        header: 'Signals',
        render: (row) => (
            <div className="grid max-w-[260px] gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                <span>{row.productsLabel}</span>
                <span>{row.paymentLabel}</span>
                <span>{row.shippingLabel}</span>
            </div>
        ),
    },
    {
        key: 'action',
        header: 'Next action',
        render: (row) => (
            <div className="max-w-[280px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.nextAction}
            </div>
        ),
    },
];

export function OnboardingQueueIndexTable({ rows }: { rows: OnboardingQueueRow[] }) {
    return (
        <Table
            columns={columns}
            rows={rows}
            savedViews={[
                { label: 'All', value: 'all', count: rows.length },
                { label: 'Ready', value: 'ready', count: rows.filter((row) => row.band === 'ready').length },
                { label: 'Needs help', value: 'needs_help', count: rows.filter((row) => row.band === 'needs_help').length },
                { label: 'Blocked', value: 'blocked', count: rows.filter((row) => row.band === 'blocked').length },
            ]}
            activeView="all"
            emptyState={
                <EmptyState
                    kind="customers"
                    title="No onboarding rows"
                    body="The current session did not return merchant stores matching these filters."
                />
            }
        />
    );
}
