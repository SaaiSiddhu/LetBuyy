'use client';

import {
    Badge,
    EmptyState,
    IndexTable,
    type IndexTableColumn,
} from '@letbuyy/ui';

type CrmStage = 'contact_ready' | 'needs_profile' | 'needs_backend';

export interface CrmContactRow {
    id: string;
    merchantName: string;
    storeHandle: string;
    siteType: string;
    contactName: string;
    contactDetail: string;
    stage: CrmStage;
    stageLabel: string;
    lastInteraction: string;
    notesPreview: string;
    nextAction: string;
    hasContact: boolean;
    hasNotes: boolean;
    interactionSource: 'store_updated' | 'store_published' | 'store_created' | 'unavailable';
}

function stageVariant(stage: CrmContactRow['stage']) {
    if (stage === 'contact_ready') return 'success' as const;
    if (stage === 'needs_profile') return 'warning' as const;
    return 'critical' as const;
}

const columns: IndexTableColumn<CrmContactRow>[] = [
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
        key: 'contact',
        header: 'Contact',
        render: (row) => (
            <div className="grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)]">
                <span className="font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">{row.contactName}</span>
                <span className="text-[color:var(--lb-color-text-subdued)]">{row.contactDetail}</span>
            </div>
        ),
    },
    {
        key: 'stage',
        header: 'Stage',
        render: (row) => <Badge label={row.stageLabel} variant={stageVariant(row.stage)} />,
    },
    {
        key: 'interaction',
        header: 'Last interaction',
        render: (row) => (
            <div className="max-w-[240px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.lastInteraction}
            </div>
        ),
    },
    {
        key: 'notes',
        header: 'Notes',
        render: (row) => (
            <div className="max-w-[280px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.notesPreview}
            </div>
        ),
    },
    {
        key: 'action',
        header: 'Next action',
        render: (row) => (
            <div className="max-w-[240px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.nextAction}
            </div>
        ),
    },
];

export function CrmContactIndexTable({ rows }: { rows: CrmContactRow[] }) {
    return (
        <IndexTable
            columns={columns}
            rows={rows}
            savedViews={[
                { label: 'All', value: 'all', count: rows.length },
                { label: 'Contact ready', value: 'ready', count: rows.filter((row) => row.stage === 'contact_ready').length },
                { label: 'Needs profile', value: 'needs_profile', count: rows.filter((row) => row.stage === 'needs_profile').length },
            ]}
            activeView="all"
            emptyState={
                <EmptyState
                    kind="customers"
                    title="No CRM contacts"
                    body="The current session did not return merchant stores matching these filters."
                />
            }
        />
    );
}
