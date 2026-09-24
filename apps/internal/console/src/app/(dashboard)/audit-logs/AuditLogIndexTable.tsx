'use client';

import { Badge, EmptyState, Table, type TableColumn } from '@letbuyy/ui';
import { formatIndiaDateTime as formatDateTime } from '@letbuyy/ui/formatting';

export type ConsoleAuditLog = {
    id: string;
    actor_id: string | null;
    actor_type: string | null;
    actor_email: string | null;
    action: string | null;
    resource_type: string | null;
    resource_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string | null;
};

type AuditLogIndexTableProps = {
    rows: ConsoleAuditLog[];
    filterChipLabels: string[];
};

const columns: Array<TableColumn<ConsoleAuditLog>> = [
    {
        key: 'actor',
        header: 'Actor',
        sortable: true,
        render: (row) => (
            <div className="min-w-[13rem]">
                <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {row.actor_email || row.actor_id || 'System actor'}
                </p>
                <p className="m-0 mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.actor_id || row.id}
                </p>
            </div>
        ),
    },
    {
        key: 'actor_type',
        header: 'Actor type',
        sortable: true,
        render: (row) => <Badge label={formatActorType(row.actor_type)} variant={actorVariant(row.actor_type)} />,
    },
    {
        key: 'action',
        header: 'Action',
        sortable: true,
        render: (row) => (
            <span className="font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                {formatAction(row.action)}
            </span>
        ),
    },
    {
        key: 'resource',
        header: 'Resource',
        render: (row) => (
            <div className="grid gap-[var(--lb-space-1)]">
                <span>{formatAction(row.resource_type || 'resource')}</span>
                <span className="text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.resource_id || '-'}
                </span>
            </div>
        ),
    },
    {
        key: 'source',
        header: 'Source',
        render: (row) => (
            <div className="grid min-w-[12rem] gap-[var(--lb-space-1)]">
                <span>{row.ip_address || '-'}</span>
                <span className="truncate text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.user_agent || 'No user agent'}
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

export function AuditLogIndexTable({ rows, filterChipLabels }: AuditLogIndexTableProps) {
    return (
        <Table
            columns={columns}
            rows={rows}
            emptyState={(
                <EmptyState
                    title="No audit logs matched"
                    body="Clear filters or search another actor, action, resource, or date."
                    kind="generic"
                />
            )}
            filterChips={filterChipLabels.map((label) => ({ label }))}
        />
    );
}

function actorVariant(actorType: string | null | undefined): 'default' | 'info' | 'success' | 'warning' | 'critical' {
    const normalized = (actorType || '').toLowerCase();

    if (normalized === 'super_admin') return 'critical';
    if (normalized === 'employee') return 'warning';
    if (normalized === 'user') return 'info';
    if (normalized === 'system') return 'success';
    return 'default';
}

function formatActorType(value: string | null | undefined): string {
    return formatAction(value || 'system');
}

function formatAction(value: string | null | undefined): string {
    return (value || 'unknown')
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
