'use client';

import { Badge, EmptyState, Table, type TableColumn } from '@letbuyy/ui';
import type { CommunicationTemplateRow } from './page';

function categoryVariant(category: CommunicationTemplateRow['category']) {
    if (category === 'onboarding') return 'info' as const;
    if (category === 'payments') return 'success' as const;
    if (category === 'shipping') return 'warning' as const;
    return 'default' as const;
}

const columns: TableColumn<CommunicationTemplateRow>[] = [
    {
        key: 'template',
        header: 'Template',
        render: (row) => (
            <div className="min-w-0">
                <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {row.name}
                </p>
                <p className="m-0 truncate text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.channel} - {row.audience}
                </p>
            </div>
        ),
    },
    {
        key: 'category',
        header: 'Category',
        render: (row) => <Badge label={row.categoryLabel} variant={categoryVariant(row.category)} />,
    },
    {
        key: 'trigger',
        header: 'Trigger',
        render: (row) => (
            <div className="max-w-[240px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.trigger}
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        render: (row) => <Badge label={row.statusLabel} variant={row.backendNeeded ? 'warning' : 'success'} />,
    },
    {
        key: 'preview',
        header: 'Preview',
        render: (row) => (
            <div className="max-w-[320px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.preview}
            </div>
        ),
    },
];

export function CommunicationTemplateIndexTable({ rows }: { rows: CommunicationTemplateRow[] }) {
    return (
        <Table
            columns={columns}
            rows={rows}
            savedViews={[
                { label: 'All', value: 'all', count: rows.length },
                { label: 'Onboarding', value: 'onboarding', count: rows.filter((row) => row.category === 'onboarding').length },
                { label: 'Payments', value: 'payments', count: rows.filter((row) => row.category === 'payments').length },
                { label: 'Shipping', value: 'shipping', count: rows.filter((row) => row.category === 'shipping').length },
            ]}
            activeView="all"
            emptyState={
                <EmptyState
                    kind="marketing"
                    title="No communication templates"
                    body="The current filters did not match the local communications scaffold."
                />
            }
        />
    );
}
