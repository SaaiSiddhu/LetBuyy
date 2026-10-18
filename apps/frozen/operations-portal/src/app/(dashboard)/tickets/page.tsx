import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import type {
    InternalSupportMacro,
    InternalSupportOverview,
    InternalSupportTicket,
    InternalSupportTicketDetail,
} from '@letbuyy/api-client';
import type {
    SupportTicketChannel,
    SupportTicketEscalationTarget,
    SupportTicketMessageVisibility,
    SupportTicketPriority,
    SupportTicketStatus,
    SupportTicketTopic,
} from '@letbuyy/shared-types';
import { Button, Input } from '@letbuyy/ui';
import { formatIndiaDateTime as formatDateTime } from '@letbuyy/ui/formatting';
import {
    EmptyDataState,
    MetricGrid,
    OpsMetric,
    OpsWorkspace,
    Panel,
    StatusPill,
} from '@/components/_local-ui/ops-workspace';
import { createPlatformOperationsApiClient } from '@/lib/api/client';

type SearchParamValue = string | string[] | undefined;

interface TicketsPageProps {
    searchParams?: Promise<Record<string, SearchParamValue>>;
}

function paramValue(value: SearchParamValue): string {
    return Array.isArray(value) ? value[0] || '' : value || '';
}

// Each rendered form represents one logical action. Its hidden key survives repeat submission,
// while createPlatformOperationsApiClient obtains a fresh signed credential on every attempt.
function supportMutationOptions(formData: FormData) {
    const key = String(formData.get('idempotency_key') || '').trim();
    if (key.length < 8 || key.length > 200) throw new Error('Reload this support form before submitting.');
    return { idempotencyKey: key };
}

async function createSupportTicket(formData: FormData) {
    'use server';

    const subject = String(formData.get('subject') || '').trim();
    const body = String(formData.get('body') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (subject.length < 3 || body.length === 0 || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.createSupportTicket({
        site_id: String(formData.get('site_id') || '').trim() || null,
        requester_email: String(formData.get('requester_email') || '').trim() || null,
        subject,
        body,
        channel: String(formData.get('channel') || 'in_app') as SupportTicketChannel,
        topic: String(formData.get('topic') || 'general') as SupportTicketTopic,
        priority: String(formData.get('priority') || 'normal') as SupportTicketPriority,
        reason,
    }, supportMutationOptions(formData));

    revalidatePath('/tickets');
}

async function replySupportTicket(formData: FormData) {
    'use server';

    const ticketId = String(formData.get('ticket_id') || '').trim();
    const body = String(formData.get('body') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!ticketId || body.length === 0 || reason.length < 8) return;

    const macroId = String(formData.get('macro_id') || '').trim();
    const status = String(formData.get('status') || '').trim();
    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.replySupportTicket(ticketId, {
        body,
        visibility: String(formData.get('visibility') || 'public') as SupportTicketMessageVisibility,
        status: status ? status as SupportTicketStatus : undefined,
        macro_id: macroId || null,
        reason,
    }, supportMutationOptions(formData));

    revalidatePath('/tickets');
}

async function assignSupportTicket(formData: FormData) {
    'use server';

    const ticketId = String(formData.get('ticket_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!ticketId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.assignSupportTicket(ticketId, {
        assignee_id: String(formData.get('assignee_id') || '').trim() || null,
        reason,
    }, supportMutationOptions(formData));

    revalidatePath('/tickets');
}

async function escalateSupportTicket(formData: FormData) {
    'use server';

    const ticketId = String(formData.get('ticket_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!ticketId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.escalateSupportTicket(ticketId, {
        target: String(formData.get('target') || 'trust_safety') as SupportTicketEscalationTarget,
        linked_incident_id: String(formData.get('linked_incident_id') || '').trim() || null,
        reason,
    }, supportMutationOptions(formData));

    revalidatePath('/tickets');
}

async function resolveSupportTicket(formData: FormData) {
    'use server';

    const ticketId = String(formData.get('ticket_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (!ticketId || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.resolveSupportTicket(ticketId, {
        reason,
        resolution_note: String(formData.get('resolution_note') || '').trim() || undefined,
    }, supportMutationOptions(formData));

    revalidatePath('/tickets');
}

async function recordSupportCsat(formData: FormData) {
    'use server';

    const ticketId = String(formData.get('ticket_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    const score = Number(formData.get('score') || 0);
    if (!ticketId || reason.length < 8 || !Number.isInteger(score) || score < 1 || score > 5) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.recordSupportCsat(ticketId, {
        score,
        comment: String(formData.get('comment') || '').trim() || null,
        reason,
    }, supportMutationOptions(formData));

    revalidatePath('/tickets');
}

async function createSupportMacro(formData: FormData) {
    'use server';

    const name = String(formData.get('name') || '').trim();
    const body = String(formData.get('body') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    if (name.length < 3 || body.length === 0 || reason.length < 8) return;

    const api = await createPlatformOperationsApiClient({ requireSession: true });
    await api.operations.createSupportMacro({
        name,
        body,
        topic: String(formData.get('topic') || 'general') as SupportTicketTopic,
        description: String(formData.get('description') || '').trim(),
        reason,
    }, supportMutationOptions(formData));

    revalidatePath('/tickets');
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
    const params = searchParams ? await searchParams : {};
    const selectedTicketId = paramValue(params.ticket);

    let overview: InternalSupportOverview | null = null;
    let tickets: InternalSupportTicket[] = [];
    let macros: InternalSupportMacro[] = [];
    let detail: InternalSupportTicketDetail | null = null;
    let loadError: string | null = null;

    try {
        const api = await createPlatformOperationsApiClient({ requireSession: true });
        const [overviewResult, ticketsResult, macrosResult] = await Promise.all([
            api.operations.supportOverview(),
            api.operations.supportTickets({ limit: 25 }),
            api.operations.supportMacros(),
        ]);

        overview = overviewResult;
        tickets = ticketsResult.data;
        macros = macrosResult;

        const detailId = selectedTicketId || tickets[0]?.id;
        if (detailId) detail = await api.operations.supportTicket(detailId);
    } catch (error) {
        loadError = error instanceof Error ? error.message : 'Unable to load support workspace';
    }

    const activeTicketId = detail?.ticket.id || selectedTicketId || tickets[0]?.id || '';
    const openCount = overview?.open_count ?? tickets.filter((ticket) => ['open', 'pending_internal'].includes(ticket.status)).length;
    const pendingCustomerCount = overview?.pending_customer_count ?? tickets.filter((ticket) => ticket.status === 'pending_customer').length;
    const escalatedCount = overview?.escalated_count ?? tickets.filter((ticket) => ticket.status === 'escalated').length;
    const slaBreachCount = overview?.sla_breach_count ?? 0;

    return (
        <OpsWorkspace
            eyebrow="Support"
            title="Support Tickets"
            description="Agent workspace for ticket triage, replies, SLA tracking, merchant context, escalation, resolution, and CSAT."
        >
            <MetricGrid>
                <OpsMetric label="Open" value={String(openCount)} tone={openCount > 0 ? 'warning' : 'success'} detail="/v1/operations/support/tickets" />
                <OpsMetric label="Pending customer" value={String(pendingCustomerCount)} tone={pendingCustomerCount > 0 ? 'warning' : 'success'} />
                <OpsMetric label="Escalated" value={String(escalatedCount)} tone={escalatedCount > 0 ? 'critical' : 'success'} />
                <OpsMetric label="SLA breaches" value={String(slaBreachCount)} tone={slaBreachCount > 0 ? 'critical' : 'success'} detail={overview?.csat_average === null ? 'CSAT not recorded' : `CSAT ${overview?.csat_average}/5`} />
            </MetricGrid>

            {loadError ? (
                <Panel title="Support API unavailable" description={loadError}>
                    <EmptyDataState message="Support tickets could not be loaded with the current employee session." />
                </Panel>
            ) : (
                <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[0.9fr_1.5fr]">
                    <div className="grid content-start gap-[var(--lb-space-5)]">
                        <Panel title="Create Ticket" description="Open a support ticket with an initial customer-visible message.">
                            <form action={createSupportTicket} className="grid gap-[var(--lb-space-3)]">
                                <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <TextInput name="site_id" label="Site ID" placeholder="Optional site UUID" />
                                    <TextInput name="requester_email" label="Requester email" placeholder="merchant@example.com" />
                                </div>
                                <TextInput name="subject" label="Subject" required placeholder="Payment setup issue" />
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                                    <SelectField name="channel" label="Channel" values={['in_app', 'email', 'chat', 'phone', 'api']} />
                                    <SelectField name="topic" label="Topic" values={['general', 'billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps']} />
                                    <SelectField name="priority" label="Priority" values={['normal', 'high', 'urgent', 'low']} />
                                </div>
                                <TextAreaField name="body" label="Initial message" />
                                <TextAreaField name="reason" label="Create reason" />
                                <Button type="submit">Create ticket</Button>
                            </form>
                        </Panel>

                        <Panel title="Macros" description={`${macros.length} active macro${macros.length === 1 ? '' : 's'} loaded.`}>
                            <form action={createSupportMacro} className="grid gap-[var(--lb-space-3)]">
                                <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <TextInput name="name" label="Name" required placeholder="Payment verification reply" />
                                    <SelectField name="topic" label="Topic" values={['general', 'billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps']} />
                                </div>
                                <TextInput name="description" label="Description" placeholder="Optional" />
                                <TextAreaField name="body" label="Macro body" />
                                <TextAreaField name="reason" label="Macro reason" />
                                <Button type="submit">Save macro</Button>
                            </form>
                            {macros.length === 0 ? (
                                <div className="mt-[var(--lb-space-4)]">
                                    <EmptyDataState message="No macros are configured yet." />
                                </div>
                            ) : (
                                <div className="mt-[var(--lb-space-4)] grid gap-[var(--lb-space-2)]">
                                    {macros.slice(0, 6).map((macro) => (
                                        <div key={macro.id} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                                            <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{macro.name}</p>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{macro.topic}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </div>

                    <div className="grid content-start gap-[var(--lb-space-5)]">
                        <Panel title="Queue" description="Latest tickets ordered by creation time.">
                            {tickets.length === 0 ? (
                                <EmptyDataState message="No support tickets are currently in the queue." />
                            ) : (
                                <div className="grid gap-[var(--lb-space-3)]">
                                    {tickets.map((ticket) => <TicketQueueRow key={ticket.id} ticket={ticket} active={ticket.id === activeTicketId} />)}
                                </div>
                            )}
                        </Panel>

                        {detail ? <TicketDetail detail={detail} macros={macros} /> : null}
                    </div>
                </section>
            )}
        </OpsWorkspace>
    );
}

function TicketQueueRow({ ticket, active }: { ticket: InternalSupportTicket; active: boolean }) {
    return (
        <Link
            href={`/tickets?ticket=${ticket.id}`}
            className={`grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)] no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] ${active ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]' : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] hover:border-[var(--lb-color-primary)]'}`}
        >
            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                <StatusPill value={ticket.priority} />
                <StatusPill value={ticket.status} />
                <span className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{ticket.ticket_ref}</span>
            </div>
            <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{ticket.subject}</p>
            <p className="m-0 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                {ticket.requester_email || 'No requester email'} · Updated {formatDateTime(ticket.updated_at)}
            </p>
        </Link>
    );
}

function TicketDetail({ detail, macros }: { detail: InternalSupportTicketDetail; macros: InternalSupportMacro[] }) {
    const ticket = detail.ticket;
    const site = detail.merchant_context?.site as { store_name?: string; subdomain?: string; status?: string } | undefined;
    const riskScore = detail.merchant_context?.risk_score as { score?: number; band?: string; status?: string } | undefined;
    const cases = Array.isArray(detail.merchant_context?.open_trust_safety_cases)
        ? detail.merchant_context.open_trust_safety_cases as Array<{ id: string; title?: string; status?: string; severity?: string }>
        : [];

    return (
        <Panel title={ticket.subject} description={`${ticket.ticket_ref} · ${ticket.requester_email || 'Requester not recorded'}`}>
            <div className="grid gap-[var(--lb-space-5)]">
                <section className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                    <ContextTile label="Merchant" value={site?.store_name || ticket.site_id || 'Not linked'} detail={site?.subdomain || site?.status || ''} />
                    <ContextTile label="Risk" value={riskScore?.score === undefined ? 'No score' : `${riskScore.score}/100`} detail={riskScore?.band || riskScore?.status || ''} />
                    <ContextTile label="T&S cases" value={String(cases.length)} detail={cases[0]?.title || 'No open linked cases'} />
                </section>

                <section className="grid gap-[var(--lb-space-3)]">
                    <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">Thread</h3>
                    {detail.messages.length === 0 ? (
                        <EmptyDataState message="No messages are attached to this ticket." />
                    ) : (
                        <div className="grid gap-[var(--lb-space-3)]">
                            {detail.messages.map((message) => (
                                <article key={message.id} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                        <StatusPill value={message.author_type} />
                                        <StatusPill value={message.visibility} />
                                        <span className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{formatDateTime(message.created_at)}</span>
                                    </div>
                                    <p className="m-0 mt-[var(--lb-space-3)] whitespace-pre-wrap text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">{message.body}</p>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="grid gap-[var(--lb-space-4)] xl:grid-cols-2">
                    <form action={replySupportTicket} className="grid gap-[var(--lb-space-3)]">
                        <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                        <Input unstyled type="hidden" name="ticket_id" value={ticket.id} />
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                            <SelectField name="visibility" label="Visibility" values={['public', 'internal']} />
                            <SelectField name="status" label="Next status" values={['pending_customer', 'pending_internal', 'open', 'escalated']} />
                            <label className="grid gap-[var(--lb-space-2)]">
                                <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">Macro</span>
                                <select name="macro_id" className={selectClassName}>
                                    <option value="">None</option>
                                    {macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}
                                </select>
                            </label>
                        </div>
                        <TextAreaField name="body" label="Reply or note" />
                        <TextAreaField name="reason" label="Reply reason" />
                        <Button type="submit">Add message</Button>
                    </form>

                    <div className="grid gap-[var(--lb-space-4)]">
                        <form action={assignSupportTicket} className="grid gap-[var(--lb-space-3)]">
                            <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                            <Input unstyled type="hidden" name="ticket_id" value={ticket.id} />
                            <TextInput name="assignee_id" label="Assignee ID" placeholder="Employee UUID or blank" />
                            <TextAreaField name="reason" label="Assignment reason" />
                            <Button type="submit">Assign</Button>
                        </form>

                        <form action={escalateSupportTicket} className="grid gap-[var(--lb-space-3)]">
                            <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                            <Input unstyled type="hidden" name="ticket_id" value={ticket.id} />
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                <SelectField name="target" label="Target" values={['trust_safety', 'risk', 'incident', 'finance', 'engineering']} />
                                <TextInput name="linked_incident_id" label="Incident ID" placeholder="Optional incident UUID" />
                            </div>
                            <TextAreaField name="reason" label="Escalation reason" />
                            <Button type="submit">Escalate</Button>
                        </form>

                        <form action={resolveSupportTicket} className="grid gap-[var(--lb-space-3)]">
                            <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                            <Input unstyled type="hidden" name="ticket_id" value={ticket.id} />
                            <TextAreaField name="resolution_note" label="Resolution note" minLength={0} />
                            <TextAreaField name="reason" label="Resolution reason" />
                            <Button type="submit">Resolve</Button>
                        </form>

                        <form action={recordSupportCsat} className="grid gap-[var(--lb-space-3)]">
                            <input type="hidden" name="idempotency_key" value={crypto.randomUUID()} />
                            <Input unstyled type="hidden" name="ticket_id" value={ticket.id} />
                            <label className="grid gap-[var(--lb-space-2)]">
                                <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">CSAT score</span>
                                <Input name="score" type="number" min={1} max={5} required placeholder="1-5" />
                            </label>
                            <TextAreaField name="comment" label="CSAT comment" minLength={0} />
                            <TextAreaField name="reason" label="CSAT reason" />
                            <Button type="submit">Record CSAT</Button>
                        </form>
                    </div>
                </section>
            </div>
        </Panel>
    );
}

function ContextTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
            <p className="m-0 text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{label}</p>
            <p className="m-0 mt-[var(--lb-space-1)] truncate font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{value}</p>
            {detail ? <p className="m-0 mt-[var(--lb-space-1)] truncate text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{detail}</p> : null}
        </div>
    );
}

const selectClassName = 'min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]';

function SelectField({ name, label, values }: { name: string; label: string; values: string[] }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <select name={name} className={selectClassName}>
                {values.map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
            </select>
        </label>
    );
}

function TextInput({ name, label, placeholder, required = false }: { name: string; label: string; placeholder?: string; required?: boolean }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <Input name={name} required={required} placeholder={placeholder} />
        </label>
    );
}

function TextAreaField({ name, label, minLength = 8 }: { name: string; label: string; minLength?: number }) {
    return (
        <label className="grid gap-[var(--lb-space-2)]">
            <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-subdued)]">{label}</span>
            <textarea
                name={name}
                required={minLength > 0}
                minLength={minLength}
                rows={3}
                className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none transition-colors placeholder:text-[var(--lb-color-text-subdued)] focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
            />
        </label>
    );
}
