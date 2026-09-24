'use client';

import { Badge, EmptyState, Table, type TableColumn } from '@letbuyy/ui';

type TicketStatus = 'open' | 'pending' | 'resolved' | 'backend_needed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TicketRow {
    id: string;
    subject: string;
    requester: string;
    storeLabel: string;
    status: TicketStatus;
    statusLabel: string;
    priority: TicketPriority;
    priorityLabel: string;
    assignee: string;
    updatedLabel: string;
    nextAction: string;
    backendNeeded: boolean;
}

function statusVariant(status: TicketRow['status']) {
    if (status === 'resolved') return 'success' as const;
    if (status === 'pending' || status === 'backend_needed') return 'warning' as const;
    return 'critical' as const;
}

function priorityVariant(priority: TicketRow['priority']) {
    if (priority === 'urgent') return 'critical' as const;
    if (priority === 'high') return 'warning' as const;
    if (priority === 'normal') return 'info' as const;
    return 'default' as const;
}

const columns: TableColumn<TicketRow>[] = [
    {
        key: 'ticket',
        header: 'Ticket',
        render: (row) => (
            <div className="min-w-0">
                <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                    {row.subject}
                </p>
                <p className="m-0 truncate text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                    {row.requester} - {row.storeLabel}
                </p>
            </div>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        render: (row) => <Badge label={row.statusLabel} variant={statusVariant(row.status)} />,
    },
    {
        key: 'priority',
        header: 'Priority',
        render: (row) => <Badge label={row.priorityLabel} variant={priorityVariant(row.priority)} />,
    },
    {
        key: 'assignment',
        header: 'Assignment',
        render: (row) => (
            <div className="max-w-[220px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.assignee}
            </div>
        ),
    },
    {
        key: 'updated',
        header: 'Updated',
        render: (row) => (
            <div className="max-w-[220px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.updatedLabel}
            </div>
        ),
    },
    {
        key: 'nextAction',
        header: 'Next action',
        render: (row) => (
            <div className="max-w-[280px] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                {row.nextAction}
            </div>
        ),
    },
];

export function TicketIndexTable({ rows, backendNeeded }: { rows: TicketRow[]; backendNeeded: boolean }) {
    return (
        <Table
            columns={columns}
            rows={rows}
            savedViews={[
                { label: 'All', value: 'all', count: rows.length },
                { label: 'Open', value: 'open', count: rows.filter((row) => row.status === 'open').length },
                { label: 'Urgent', value: 'urgent', count: rows.filter((row) => row.priority === 'urgent').length },
                { label: 'Assigned', value: 'assigned', count: rows.filter((row) => row.assignee !== 'Unassigned').length },
            ]}
            activeView="all"
            emptyState={
                <EmptyState
                    kind="generic"
                    title={backendNeeded ? 'Ticket backend required' : 'No support tickets'}
                    body={
                        backendNeeded
                            ? 'The employee ticket API is reachable, but ticket infrastructure is not configured yet.'
                            : 'The current filters did not return support tickets.'
                    }
                />
            }
        />
    );
}
