import { LetbuyyApiError } from '@letbuyy/api-client';
import {
    Badge,
    Banner,
    Button,
    Card,
    Chart,
    DescriptionList,
    FilterBar,
    Input,
    MetricCard,
    Page,
    PageContent,
    PageHeader,
    Section,
    Select,
} from '@letbuyy/ui';
import { createPlatformOperationsApiClient } from '../../../lib/api/client';
import { TicketIndexTable } from './TicketIndexTable';

type SearchParamValue = string | string[] | undefined;
type TicketStatus = 'open' | 'pending' | 'resolved' | 'backend_needed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

interface SupportPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

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

interface TicketLoadResult {
    rows: TicketRow[];
    sourceStatus: 'available' | 'backend_needed' | 'unavailable';
    backendMessage: string | null;
    loadError: string | null;
}

const STATUS_FILTER_OPTIONS = [
    { label: 'All status', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'Pending', value: 'pending' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Backend needed', value: 'backend_needed' },
];

const PRIORITY_FILTER_OPTIONS = [
    { label: 'All priority', value: 'all' },
    { label: 'Urgent', value: 'urgent' },
    { label: 'High', value: 'high' },
    { label: 'Normal', value: 'normal' },
    { label: 'Low', value: 'low' },
];

export default async function SupportPage({ searchParams }: SupportPageProps) {
    const params = searchParams ? await searchParams : {};
    const query = firstParam(params.q).trim();
    const statusFilter = normalizeStatusFilter(firstParam(params.status));
    const priorityFilter = normalizePriorityFilter(firstParam(params.priority));
    const result = await loadTicketQueue();
    const visibleRows = applyFilters(result.rows, query, statusFilter, priorityFilter);
    const summary = summarizeTickets(result.rows);
    const backendNeeded = result.sourceStatus === 'backend_needed';

    return (
        <Page>
            <PageHeader
                title="Support Tickets"
                description="Employee ticket queue scaffold for status, priority, and assignment workflows."
                iconName="support"
                showDescription
                secondaryActions={[
                    { label: 'Merchant Health', href: '/merchant-health' },
                    { label: 'CRM', href: '/crm' },
                ]}
            />

            <PageContent>
                <div className="grid gap-[var(--lb-density-card-gap)] md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Open tickets"
                        value={summary.open.toLocaleString('en-IN')}
                        delta={`${summary.total.toLocaleString('en-IN')} total tickets`}
                        deltaTone={summary.open > 0 ? 'negative' : 'neutral'}
                    />
                    <MetricCard
                        label="Urgent priority"
                        value={summary.urgent.toLocaleString('en-IN')}
                        delta="Needs immediate operator review"
                        deltaTone={summary.urgent > 0 ? 'negative' : 'neutral'}
                    />
                    <MetricCard
                        label="Assigned tickets"
                        value={summary.assigned.toLocaleString('en-IN')}
                        delta="Assignee field available"
                        deltaTone={summary.assigned > 0 ? 'positive' : 'neutral'}
                    />
                    <MetricCard
                        label="Ticket backend"
                        value={backendNeeded ? 'Needed' : result.sourceStatus === 'available' ? 'Live' : 'Error'}
                        delta={backendNeeded ? 'Employee ticket API returns a setup gap' : 'Using employee ticket API'}
                        deltaTone={result.sourceStatus === 'available' ? 'positive' : backendNeeded ? 'negative' : 'negative'}
                    />
                </div>

                {backendNeeded ? (
                    <Banner title="Ticket backend required" variant="warning">
                        {result.backendMessage ||
                            'Support ticket infrastructure is not configured. This scaffold keeps the queue, status badges, priority filters, and assignment controls ready while the employee ticket backend is added.'}
                    </Banner>
                ) : null}

                {result.loadError ? (
                    <Banner title="Unable to load ticket queue" variant="critical">
                        {result.loadError}
                    </Banner>
                ) : null}

                <div className="grid gap-[var(--lb-density-card-gap)] xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                    <Card>
                        <Section title="Ticket queue" description="Current status distribution from the employee ticket API.">
                            <Chart
                                ariaLabel="Support ticket status distribution"
                                data={[
                                    { label: 'Open', value: summary.open },
                                    { label: 'Pending', value: summary.pending },
                                    { label: 'Resolved', value: summary.resolved },
                                ]}
                                type="bar"
                                height="md"
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Status and priority model"
                            description="Visible ticket workflow states used by the operations queue."
                        >
                            <DescriptionList
                                columns={1}
                                items={[
                                    {
                                        term: 'Status badges',
                                        description: (
                                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                                <Badge label="Open" variant="critical" />
                                                <Badge label="Pending" variant="warning" />
                                                <Badge label="Resolved" variant="success" />
                                            </div>
                                        ),
                                    },
                                    {
                                        term: 'Priority badges',
                                        description: (
                                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                                <Badge label="Urgent" variant="critical" />
                                                <Badge label="High" variant="warning" />
                                                <Badge label="Normal" variant="info" />
                                                <Badge label="Low" variant="default" />
                                            </div>
                                        ),
                                    },
                                    { term: 'Assignment', description: backendNeeded ? 'Assignee, team queue, and SLA fields need the ticket backend.' : 'Assignee field exposed by the ticket API.' },
                                    { term: 'Queue source', description: backendNeeded ? <Badge label="Backend needed" variant="warning" /> : <Badge label="Employee API" variant="success" /> },
                                ]}
                            />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Ticket filters" description="Filter tickets by subject, requester, status, and priority.">
                        <form action="/support" method="get">
                            <FilterBar
                                search={
                                    <Input
                                        label="Search"
                                        name="q"
                                        type="search"
                                        defaultValue={query}
                                        placeholder="Subject, requester, or store"
                                    />
                                }
                                filters={
                                    <>
                                        <Select
                                            label="Status"
                                            name="status"
                                            defaultValue={statusFilter}
                                            options={STATUS_FILTER_OPTIONS}
                                        />
                                        <Select
                                            label="Priority"
                                            name="priority"
                                            defaultValue={priorityFilter}
                                            options={PRIORITY_FILTER_OPTIONS}
                                        />
                                    </>
                                }
                                actions={<Button type="submit">Search</Button>}
                            />
                        </form>
                    </Section>
                </Card>

                <TicketIndexTable rows={visibleRows} backendNeeded={backendNeeded} />

                <div className="grid gap-[var(--lb-density-card-gap)] lg:grid-cols-3">
                    <Button type="button" variant="outline" disabled>
                        Assign ticket
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Change priority
                    </Button>
                    <Button type="button" variant="outline" disabled>
                        Reply
                    </Button>
                </div>

                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Showing {visibleRows.length.toLocaleString('en-IN')} of {result.rows.length.toLocaleString('en-IN')} ticket rows from the employee support queue.
                </p>
            </PageContent>
        </Page>
    );
}

async function loadTicketQueue(): Promise<TicketLoadResult> {
    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const payload = await api.requestData<unknown>('/employees/tickets');
        const rows = extractTicketRecords(payload).map(mapTicketRecord);

        return {
            rows,
            sourceStatus: 'available',
            backendMessage: null,
            loadError: null,
        };
    } catch (error) {
        if (error instanceof LetbuyyApiError && error.code === 'SUPPORT_TICKETS_UNAVAILABLE') {
            return {
                rows: [],
                sourceStatus: 'backend_needed',
                backendMessage: error.message,
                loadError: null,
            };
        }

        return {
            rows: [],
            sourceStatus: 'unavailable',
            backendMessage: null,
            loadError: error instanceof Error ? error.message : 'Unable to load support ticket queue',
        };
    }
}

function extractTicketRecords(payload: unknown): Record<string, unknown>[] {
    if (Array.isArray(payload)) return payload.filter(isRecord);
    if (!isRecord(payload)) return [];

    const candidates = [payload.tickets, payload.items, payload.results, payload.data];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate.filter(isRecord);
    }

    return [];
}

function mapTicketRecord(record: Record<string, unknown>, index: number): TicketRow {
    const status = normalizeTicketStatus(readString(record, ['status', 'state', 'workflow_status']));
    const priority = normalizeTicketPriority(readString(record, ['priority', 'severity']));
    const subject = readString(record, ['subject', 'title', 'summary']) || `Support ticket ${index + 1}`;
    const requester = readString(record, ['requester_name', 'customer_name', 'merchant_name', 'email']) || 'Requester unavailable';
    const storeLabel = readString(record, ['store_name', 'site_name', 'store_handle', 'subdomain']) || 'Store unavailable';
    const assignee = readString(record, ['assignee_name', 'assigned_to', 'owner_name', 'team']) || 'Unassigned';
    const updatedAt = readString(record, ['updated_at', 'last_activity_at', 'created_at']);

    return {
        id: readString(record, ['id', 'ticket_id', 'reference']) || `ticket-${index + 1}`,
        subject,
        requester,
        storeLabel,
        status,
        statusLabel: status === 'backend_needed' ? 'Backend needed' : formatLabel(status),
        priority,
        priorityLabel: formatLabel(priority),
        assignee,
        updatedLabel: updatedAt ? formatDateTime(updatedAt) : 'No activity timestamp',
        nextAction: getNextAction(status, priority, assignee),
        backendNeeded: false,
    };
}

function summarizeTickets(rows: TicketRow[]) {
    return {
        total: rows.length,
        open: rows.filter((row) => row.status === 'open').length,
        pending: rows.filter((row) => row.status === 'pending').length,
        resolved: rows.filter((row) => row.status === 'resolved').length,
        urgent: rows.filter((row) => row.priority === 'urgent').length,
        assigned: rows.filter((row) => row.assignee !== 'Unassigned').length,
    };
}

function applyFilters(rows: TicketRow[], query: string, statusFilter: string, priorityFilter: string): TicketRow[] {
    const normalizedQuery = query.toLowerCase();

    return rows.filter((row) => {
        const matchesQuery = !normalizedQuery || `${row.subject} ${row.requester} ${row.storeLabel}`.toLowerCase().includes(normalizedQuery);
        const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || row.priority === priorityFilter;
        return matchesQuery && matchesStatus && matchesPriority;
    });
}

function getNextAction(status: TicketStatus, priority: TicketPriority, assignee: string): string {
    if (assignee === 'Unassigned') return 'Assign an operator when ticket mutations are available';
    if (status === 'resolved') return 'Confirm resolution audit trail';
    if (priority === 'urgent') return 'Escalate within the urgent SLA window';
    if (status === 'pending') return 'Review requester follow-up state';
    return 'Respond from the ticket thread when reply backend is available';
}

function normalizeTicketStatus(value: string | null): TicketStatus {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'resolved' || normalized === 'closed' || normalized === 'done') return 'resolved';
    if (normalized === 'pending' || normalized === 'waiting' || normalized === 'on_hold') return 'pending';
    if (normalized === 'backend_needed') return 'backend_needed';
    return 'open';
}

function normalizeTicketPriority(value: string | null): TicketPriority {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'urgent' || normalized === 'critical') return 'urgent';
    if (normalized === 'high') return 'high';
    if (normalized === 'low') return 'low';
    return 'normal';
}

function normalizeStatusFilter(value: string): string {
    return STATUS_FILTER_OPTIONS.some((option) => option.value === value) ? value : 'all';
}

function normalizePriorityFilter(value: string): string {
    return PRIORITY_FILTER_OPTIONS.some((option) => option.value === value) ? value : 'all';
}

function firstParam(value: SearchParamValue): string {
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
}

function formatLabel(value: string): string {
    return value
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'at an unavailable time';

    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function readString(source: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
