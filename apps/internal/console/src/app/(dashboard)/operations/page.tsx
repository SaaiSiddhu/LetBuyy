import { ConsoleActionForm } from '@/components/ConsoleActionForm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type {
    InternalIncidentPostmortem,
    InternalOncallSchedule,
    InternalProductionIncident,
} from '@letbuyy/api-client';
import { Button, Input, Textarea } from '@letbuyy/ui';
import {
    ConsoleWorkspace,
    EmptyDataState,
    LeadershipMetric,
    MetricGrid,
    Panel,
    StatusPill,
} from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import {
    fetchConsoleApi,
    formatDateTime,
    type ConsoleDataResponse,
    type ConsolePaginatedResponse,
} from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';
import { InternalPlatformJobSchema, InternalPlatformJobQuerySchema } from '@letbuyy/shared-types';
import { PlatformJobRecovery } from '@/components/operations/PlatformJobRecovery';

const OPERATIONS_AUTH_CONTRACT = 'PLATFORM_CONSOLE_API_TOKEN';
const OPERATIONS_OVERVIEW_CONTRACT = '/v1/operations/runtime/overview?limit=30';
const OPERATIONS_CACHE_CONTRACT = "cache: 'no-store'";

const inputClassName = 'rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]';

type OperationsOverview = {
    health?: Array<{ runtime_name: string; status: string; region?: string | null; checked_at?: string | null }>;
    queues?: Array<{ queue_name: string; depth?: number | null; leased?: number | null; retrying?: number | null; dead_lettered?: number | null; sampled_at?: string | null }>;
    alerts?: Array<{ alert_name: string; runtime_name: string; severity: string; firing: boolean; evaluated_at?: string | null }>;
    incidents?: InternalProductionIncident[];
    deployments?: Array<{ promotion_id: string; runtime_name: string; environment: string; strategy: string; status: string; version: string; created_at?: string | null }>;
    deployment_health_gates?: Array<{ gate_id: string; runtime_root: string; environment: string; gate_name: string; status: string; evaluated_at?: string | null }>;
    security_events?: Array<{ enforcement_id: string; control_name: string; runtime_root: string; status: string; severity: string; recorded_at?: string | null }>;
    certification_reports?: Array<{ certification_id: string; certification_mode: string; status: string; repository_maturity_score: number; live_maturity_score: number; generated_at?: string | null; expires_at?: string | null }>;
};

const CurrentOncallSchema = z.object({
    id: z.string().uuid(), team_name: z.string().min(2).max(120), rotation_name: z.string().min(2).max(160),
    primary_employee_id: z.string().uuid().nullable(), paging_adapter: z.enum(['dry_run', 'pagerduty', 'opsgenie']),
}).strict();
const CurrentOncallReplySchema = z.object({success:z.literal(true),data:z.object({schedule:CurrentOncallSchema.nullable()}).strict()}).strict();
type CurrentOncall = z.infer<typeof CurrentOncallSchema>;

const OncallScheduleSchema = z.object({
    id: z.string().uuid(), team_name: z.string().min(2).max(120), rotation_name: z.string().min(2).max(160),
    primary_employee_id: z.string().uuid().nullable(), starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).nullable(), active: z.boolean(),
}).strict();
const OncallSchedulesReplySchema = z.object({ success: z.literal(true), data: z.object({
    items: OncallScheduleSchema.array().max(15), total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    page: z.number().int().min(1).max(10000), limit: z.literal(15), has_next: z.boolean(),
}).strict().refine(data => data.items.length === Math.min(data.limit, Math.max(data.total - (data.page - 1) * data.limit, 0))
    && data.has_next === (data.page * data.limit < data.total)
    && new Set(data.items.map(item => item.id)).size === data.items.length) }).strict();
type OncallSchedule = z.infer<typeof OncallScheduleSchema>;

const RuntimeCommandRecordSchema=z.object({
    command_id:z.string(),operation:z.string(),target_type:z.string(),target_id:z.string(),
    status:z.enum(['accepted','running','completed','failed','cancelled']),
}).strict();
const RuntimeCommandHistoryReplySchema=z.object({success:z.literal(true),data:z.object({
    items:RuntimeCommandRecordSchema.array().max(15),total:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    page:z.number().int().min(1).max(10000),limit:z.literal(15),has_next:z.boolean(),
}).strict().refine(data=>data.items.length===Math.min(data.limit,Math.max(data.total-(data.page-1)*data.limit,0))
    &&data.has_next===(data.page*data.limit<data.total)&&new Set(data.items.map(item=>item.command_id)).size===data.items.length)}).strict();
type RuntimeCommandRecord=z.infer<typeof RuntimeCommandRecordSchema>;

type OperationsPageData = {
    overview: OperationsOverview;
    overviewError?: string;
    postmortemsError?: string;
    commands: RuntimeCommandRecord[];
    commandsError?: string;
    commandsHasNext: boolean;
    schedules: OncallSchedule[];
    schedulesError?: string;
    schedulesHasNext: boolean;
    currentOncall: CurrentOncall | null;
    currentOncallError?: string;
    postmortems: InternalIncidentPostmortem[];
    errors: string[];
};

type StatusListItem = {
    key: string;
    label: string;
    detail: string;
    status: string;
    timestamp?: string | null;
};

function csvValues(value: FormDataEntryValue | null): string[] {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function optionalString(value: FormDataEntryValue | null): string | null {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function createIncident(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });
    const incidentId = String(formData.get('incident_id') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const severity = String(formData.get('severity') || 'sev3');
    const customerImpact = String(formData.get('customer_impact') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!incidentId || !title || customerImpact.length < 8 || reason.length < 8) {
        throw new Error('Incident creation requires an id, title, impact, and reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ incident: InternalProductionIncident }>>('/operations/runtime/incidents', {
        method: 'POST',
        body: {
            incident_id: incidentId,
            title,
            severity,
            affected_runtimes: csvValues(formData.get('affected_runtimes')),
            affected_regions: csvValues(formData.get('affected_regions')),
            customer_impact: customerImpact,
            reason,
            metadata: { source: 'admin-web.incident-command' },
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/operations');
}

async function updateIncidentStatus(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });
    const incidentId = String(formData.get('incident_id') || '').trim();
    const status = String(formData.get('status') || '').trim();
    const summary = String(formData.get('summary') || '').trim();

    if (!incidentId || !['open', 'mitigating', 'resolved', 'closed'].includes(status) || summary.length < 8) {
        throw new Error('Incident status updates require an incident id, valid status, and reasoned summary.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ incident: InternalProductionIncident }>>(`/operations/runtime/incidents/${incidentId}/status`, {
        method: 'PATCH',
        body: {
            status,
            summary,
            details: { source: 'admin-web.incident-command' },
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/operations');
}

async function addIncidentEvent(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });
    const incidentId = String(formData.get('incident_id') || '').trim();
    const eventType = String(formData.get('event_type') || 'note').trim();
    const summary = String(formData.get('summary') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!incidentId || !['note', 'mitigation', 'escalation', 'recovery'].includes(eventType) || summary.length < 8 || reason.length < 8) {
        throw new Error('Incident timeline entries require an incident id, event type, summary, and reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<unknown>>(`/operations/runtime/incidents/${incidentId}/events`, {
        method: 'POST',
        body: {
            event_type: eventType,
            summary,
            reason,
            details: { source: 'admin-web.incident-command' },
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/operations');
}

async function pageIncident(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });
    const incidentId = String(formData.get('incident_id') || '').trim();
    const summary = String(formData.get('summary') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!incidentId || summary.length < 8 || reason.length < 8) {
        throw new Error('Incident paging requires an incident id, summary, and reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<unknown>>(`/operations/runtime/incidents/${incidentId}/page`, {
        method: 'POST',
        body: {
            target_team: optionalString(formData.get('target_team')),
            summary,
            escalation_level: Number(formData.get('escalation_level') || 1),
            reason,
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/operations');
}

async function createOncallSchedule(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });
    const teamName = String(formData.get('team_name') || '').trim();
    const rotationName = String(formData.get('rotation_name') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!teamName || !rotationName || reason.length < 8) {
        throw new Error('On-call schedules require a team, rotation, and reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ schedule: InternalOncallSchedule }>>('/operations/oncall/schedules', {
        method: 'POST',
        body: {
            team_name: teamName,
            rotation_name: rotationName,
            primary_employee_id: optionalString(formData.get('primary_employee_id')),
            backup_employee_ids: csvValues(formData.get('backup_employee_ids')),
            timezone: String(formData.get('timezone') || 'Asia/Kolkata'),
            starts_at: optionalString(formData.get('starts_at')) || undefined,
            ends_at: optionalString(formData.get('ends_at')),
            active: formData.get('active') !== 'false',
            paging_adapter: 'dry_run',
            escalation_tiers: [],
            metadata: { source: 'admin-web.incident-command' },
            reason,
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/operations');
}

async function createPostmortem(formData: FormData) {
    'use server';

    await requireConsoleSession({ mfa: true });
    const incidentId = String(formData.get('incident_id') || '').trim();
    const summary = String(formData.get('summary') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!incidentId || reason.length < 8) {
        throw new Error('Postmortem updates require an incident id and reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ postmortem: InternalIncidentPostmortem }>>('/operations/postmortems', {
        method: 'POST',
        body: {
            incident_id: incidentId,
            owner_id: optionalString(formData.get('owner_id')),
            status: String(formData.get('status') || 'draft'),
            summary,
            due_at: optionalString(formData.get('due_at')),
            timeline: [],
            contributing_factors: [],
            action_items: csvValues(formData.get('action_items')).map((item) => ({ item, status: 'open' })),
            metadata: { source: 'admin-web.incident-command' },
            reason,
        },
    });

    if (result.error) throw new Error(result.error);
    revalidatePath('/operations');
}

async function loadOperationsData(oncallPage: number | undefined, commandsPage: number | undefined): Promise<OperationsPageData> {
    const [overviewResult, commandsResult, schedulesResult, currentOncallResult, postmortemsResult] = await Promise.all([
        fetchConsoleApi<ConsoleDataResponse<OperationsOverview>>('/operations/runtime/overview', { limit: 30 }),
        commandsPage === undefined ? Promise.resolve({error:'Invalid runtime command history page.',data:undefined})
            : fetchConsoleApi<unknown>('/internal/console/operations/runtime/control-commands', {page:commandsPage,limit:15}),
        oncallPage === undefined ? Promise.resolve({ error: 'Invalid on-call schedule page.', data: undefined })
            : fetchConsoleApi<unknown>('/internal/console/operations/oncall/schedules', { page: oncallPage, limit: 15, active: 'all' }),
        fetchConsoleApi<unknown>('/internal/console/operations/oncall/current'),
        fetchConsoleApi<ConsolePaginatedResponse<InternalIncidentPostmortem>>('/operations/postmortems', { limit: 20 }),
    ]);

    const currentOncall = CurrentOncallReplySchema.safeParse(currentOncallResult.data);
    const currentOncallError = currentOncallResult.error || (!currentOncall.success ? 'Current rotation response is unavailable.' : undefined);
    const schedules = OncallSchedulesReplySchema.safeParse(schedulesResult.data);
    const schedulesError = schedulesResult.error || (!schedules.success || schedules.data.data.page !== oncallPage ? 'On-call schedules response is unavailable.' : undefined);
    const commands=RuntimeCommandHistoryReplySchema.safeParse(commandsResult.data);
    const commandsError=commandsResult.error||(!commands.success||commands.data.data.page!==commandsPage?'Runtime command history response is unavailable.':undefined);
    const errors = [overviewResult.error, postmortemsResult.error]
        .filter((error): error is string => Boolean(error));

    return {
        overview: overviewResult.data?.data || {},
        overviewError: overviewResult.error, postmortemsError: postmortemsResult.error,
        commands: !commandsError&&commands.success?commands.data.data.items:[],
        commandsError,
        commandsHasNext:!commandsError&&commands.success&&commands.data.data.has_next,
        schedules: !schedulesError && schedules.success ? schedules.data.data.items : [],
        schedulesError,
        schedulesHasNext: !schedulesError && schedules.success && schedules.data.data.has_next,
        currentOncall: currentOncall.success ? currentOncall.data.data.schedule : null,
        currentOncallError,
        postmortems: postmortemsResult.data?.data || [],
        errors,
    };
}

export default async function OperationsDashboardPage({ searchParams }: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
    const session = await requireConsoleSession({mfa:true});
    const params = await searchParams;
    const first = (name:string) => { const value=params[name];return Array.isArray(value)?value[0]:value; };
    const query = InternalPlatformJobQuerySchema.safeParse({page:first('page'),limit:25,site_id:first('site_id'),job_id:first('job_id')});
    const recovery = query.success ? await fetchConsoleApi<ConsoleDataResponse<{items:unknown;has_next:boolean}>>('/internal/console/platform-jobs',query.data)
        : {error:'Invalid recovery inspection query.',data:undefined};
    const recoveryItems = InternalPlatformJobSchema.array().safeParse(recovery.data?.data.items);
    const recoveryError = recovery.error || (!recoveryItems.success?'Recovery response is unavailable.':undefined);
    const oncallPage = z.coerce.number().int().min(1).max(10000).default(1).safeParse(first('oncall_page'));
    const commandsPage=z.coerce.number().int().min(1).max(10000).default(1).safeParse(first('commands_page'));
    const data = await loadOperationsData(oncallPage.success ? oncallPage.data : undefined,commandsPage.success?commandsPage.data:undefined);
    const reloadQuery = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
        for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) reloadQuery.append(name, item);
    }
    const currentOncallReloadHref = '/operations' + (reloadQuery.size ? '?' + reloadQuery.toString() : '');
    const oncallPageHref = (page: number) => { const next = new URLSearchParams(reloadQuery); next.set('oncall_page', String(page)); return '/operations?' + next.toString(); };
    const commandsPageHref=(page:number)=>{const next=new URLSearchParams(reloadQuery);next.set('commands_page',String(page));return '/operations?'+next.toString();};
    const consoleApiTokenConfigured = Boolean(process.env.PLATFORM_CONSOLE_API_TOKEN);
    const health = data.overview.health || [];
    const queues = data.overview.queues || [];
    const alerts = data.overview.alerts || [];
    const incidents = data.overview.incidents || [];
    const deployments = data.overview.deployments || [];
    const deploymentHealth = data.overview.deployment_health_gates || [];
    const security = data.overview.security_events || [];
    const certifications = data.overview.certification_reports || [];
    const activeIncidents = incidents.filter((item) => item.status !== 'closed');
    const sev12WithoutPostmortem = activeIncidents.filter((incident) => (
        (incident.severity === 'sev1' || incident.severity === 'sev2')
        && !data.postmortems.some((postmortem) => postmortem.incident_id === incident.incident_id && ['accepted', 'closed'].includes(postmortem.status))
    )).length;
    const latestCertification = certifications[0];
    const dlqMessages = queues.reduce((total, item) => total + Number(item.dead_lettered || 0), 0);
    const firingAlerts = alerts.filter((item) => item.firing).length;

    return (
        <ConsoleWorkspace
            eyebrow="Incident command"
            title="Platform Ops"
            description="Monitor platform health, coordinate incidents, and manage on-call coverage and postmortems."
        >
            <p className="sr-only">
                Operations live data contract: {OPERATIONS_AUTH_CONTRACT}; {OPERATIONS_OVERVIEW_CONTRACT}; {OPERATIONS_CACHE_CONTRACT};
                console API token configured: {consoleApiTokenConfigured ? 'yes' : 'no'}.
            </p>

            {data.errors.map((error) => (
                <ConsoleApiErrorPanel key={error} title="Operations API unavailable" message={error} />
            ))}

            <PlatformJobRecovery actorId={session.userId} sessionId={session.sessionId}
                jobs={recoveryItems.success?recoveryItems.data.map(job=>({...job,request_key:crypto.randomUUID()})):[]}
                error={recoveryError} page={query.success?query.data.page:1} hasNext={recovery.data?.data.has_next===true}/>

            <MetricGrid>
                <LeadershipMetric label="Healthy runtimes" value={data.overviewError ? 'Unavailable' : `${health.filter((item) => item.status === 'healthy').length}/${health.length}`} />
                <LeadershipMetric label="Open incidents" value={data.overviewError ? 'Unavailable' : String(activeIncidents.length) } tone={activeIncidents.length > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="SEV close gates" value={data.overviewError || data.postmortemsError ? 'Unavailable' : String(sev12WithoutPostmortem)} detail="SEV-1/2 requiring accepted postmortem" tone={sev12WithoutPostmortem > 0 ? 'warning' : 'success'} />
                <LeadershipMetric label="DLQ messages" value={data.overviewError ? 'Unavailable' : String(dlqMessages) } tone={dlqMessages > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="Firing alerts" value={data.overviewError ? 'Unavailable' : String(firingAlerts) } tone={firingAlerts > 0 ? 'critical' : 'success'} />
                <LeadershipMetric label="Certification" value={latestCertification ? `${latestCertification.live_maturity_score}/10` : 'none'} detail={latestCertification?.status || 'No report returned'} />
            </MetricGrid>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                <IncidentCommandPanel incidents={incidents} postmortems={data.postmortems} />
                <RuntimeCommandPanel commands={data.commands} error={data.commandsError}
                    reloadHref={commandsPage.success?currentOncallReloadHref:commandsPageHref(1)}
                    page={commandsPage.success?commandsPage.data:1}
                    previousHref={commandsPage.success&&commandsPage.data>1?commandsPageHref(commandsPage.data-1):undefined}
                    nextHref={commandsPage.success&&data.commandsHasNext&&commandsPage.data<10000?commandsPageHref(commandsPage.data+1):undefined} />
            </section>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                <OncallPanel current={data.currentOncall} error={data.currentOncallError} reloadHref={currentOncallReloadHref} schedules={data.schedules}
                    schedulesError={data.schedulesError} schedulesReloadHref={currentOncallReloadHref}
                    schedulesPage={oncallPage.success ? oncallPage.data : 1}
                    schedulesPreviousHref={oncallPage.success && oncallPage.data > 1 ? oncallPageHref(oncallPage.data - 1) : undefined}
                    schedulesNextHref={oncallPage.success && data.schedulesHasNext && oncallPage.data < 10000 ? oncallPageHref(oncallPage.data + 1) : undefined} />
                <PostmortemPanel incidents={incidents} postmortems={data.postmortems} />
            </section>

            <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                <StatusPanel
                    title="Runtime Health"
                    description="Recent runtime health projections."
                    items={health.map((item) => ({
                        key: `${item.runtime_name}-${item.checked_at || item.region || 'global'}`,
                        label: item.runtime_name,
                        detail: item.region || 'global',
                        status: item.status,
                        timestamp: item.checked_at,
                    }))}
                />

                <StatusPanel
                    title="Queue Diagnostics"
                    description="Distributed queue pressure and dead-letter signals."
                    items={queues.map((item) => ({
                        key: `${item.queue_name}-${item.sampled_at || 'latest'}`,
                        label: item.queue_name,
                        detail: `depth ${item.depth ?? 0} | leased ${item.leased ?? 0} | retrying ${item.retrying ?? 0} | dlq ${item.dead_lettered ?? 0}`,
                        status: (item.dead_lettered || 0) > 0 ? 'degraded' : 'healthy',
                        timestamp: item.sampled_at,
                    }))}
                />

                <StatusPanel
                    title="Deployment Gates"
                    description="Latest promotions and health-gate results."
                    items={[
                        ...deployments.map((item) => ({
                            key: item.promotion_id,
                            label: item.runtime_name,
                            detail: `${item.environment} | ${item.strategy} | ${item.version}`,
                            status: item.status,
                            timestamp: item.created_at,
                        })),
                        ...deploymentHealth.map((item) => ({
                            key: item.gate_id,
                            label: item.runtime_root,
                            detail: `${item.environment} | ${item.gate_name}`,
                            status: item.status,
                            timestamp: item.evaluated_at,
                        })),
                    ]}
                />

                <StatusPanel
                    title="Security Enforcement"
                    description="Security controls recorded by the operations runtime."
                    items={security.map((item) => ({
                        key: item.enforcement_id,
                        label: item.control_name,
                        detail: `${item.runtime_root} | ${item.severity}`,
                        status: item.status,
                        timestamp: item.recorded_at,
                    }))}
                />

                <StatusPanel
                    title="Operational Certification"
                    description="Certification score evidence for leadership review."
                    items={certifications.map((item) => ({
                        key: item.certification_id,
                        label: item.certification_id,
                        detail: `${item.certification_mode} | repo ${item.repository_maturity_score}/10 | live ${item.live_maturity_score}/10`,
                        status: item.status,
                        timestamp: item.generated_at,
                    }))}
                />
            </section>
        </ConsoleWorkspace>
    );
}

function IncidentCommandPanel({
    incidents,
    postmortems,
}: {
    incidents: InternalProductionIncident[];
    postmortems: InternalIncidentPostmortem[];
}) {
    return (
        <Panel title="Incident Command" description="Open, mitigate, page, resolve, and close incidents with reason-captured actions. SEV-1/2 closure is blocked until the postmortem is accepted.">
            <div className="grid gap-[var(--lb-space-5)]">
                <ConsoleActionForm action={createIncident} className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)] lg:grid-cols-2">
                    <Input name="incident_id" label="Incident ID" placeholder="INC-2026-0001" required />
                    <Input name="title" label="Title" placeholder="Checkout payment latency" required />
                    <label className="flex flex-col gap-[var(--lb-space-1)] text-sm font-medium">
                        Severity
                        <select aria-label="Severity" name="severity" defaultValue="sev3" className={inputClassName}>
                            <option value="sev1">SEV-1</option>
                            <option value="sev2">SEV-2</option>
                            <option value="sev3">SEV-3</option>
                            <option value="sev4">SEV-4</option>
                        </select>
                    </label>
                    <Input name="affected_regions" label="Regions" placeholder="bom, del" />
                    <Input name="affected_runtimes" label="Runtimes" placeholder="api-gateway, checkout" />
                    <Input name="reason" label="Open reason" placeholder="Alert confirmed by on-call" required />
                    <div className="lg:col-span-2">
                        <Textarea name="customer_impact" label="Customer impact" placeholder="Merchant checkout attempts are intermittently failing." required />
                    </div>
                    <div className="lg:col-span-2">
                        <Button type="submit">Open incident</Button>
                    </div>
                </ConsoleActionForm>

                {incidents.length === 0 ? (
                    <EmptyDataState message="No incidents returned." />
                ) : (
                    <div className="grid gap-[var(--lb-space-3)]">
                        {incidents.map((incident) => {
                            const postmortem = postmortems.find((item) => item.incident_id === incident.incident_id);
                            const needsCloseGate = (incident.severity === 'sev1' || incident.severity === 'sev2') && !postmortem;

                            return (
                                <article key={incident.incident_id} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                                    <div className="flex flex-col gap-[var(--lb-space-3)] md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <h3 className="m-0 text-base font-semibold">{incident.title}</h3>
                                                <StatusPill value={incident.severity} tone={incident.severity === 'sev1' || incident.severity === 'sev2' ? 'critical' : 'warning'} />
                                                <StatusPill value={incident.status} />
                                            </div>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                                                {incident.incident_id} | started {formatDateTime(incident.started_at)}
                                            </p>
                                            {needsCloseGate ? (
                                                <p className="m-0 mt-[var(--lb-space-2)] text-xs text-[var(--lb-color-warning)]">
                                                    SEV-1/2 close requires an accepted postmortem.
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="mt-[var(--lb-space-4)] grid gap-[var(--lb-space-3)] lg:grid-cols-3">
                                        <ConsoleActionForm action={updateIncidentStatus} className="grid gap-[var(--lb-space-2)]">
                                            <Input unstyled type="hidden" name="incident_id" value={incident.incident_id} />
                                            <select aria-label="Status" name="status" defaultValue={incident.status} className={inputClassName}>
                                                <option value="open">Open</option>
                                                <option value="mitigating">Mitigating</option>
                                                <option value="resolved">Resolved</option>
                                                <option value="closed">Closed</option>
                                            </select>
                                            <Input name="summary" placeholder="Reasoned status summary" required />
                                            <Button type="submit" variant="secondary">Update status</Button>
                                        </ConsoleActionForm>

                                        <ConsoleActionForm action={addIncidentEvent} className="grid gap-[var(--lb-space-2)]">
                                            <Input unstyled type="hidden" name="incident_id" value={incident.incident_id} />
                                            <select aria-label="Event type" name="event_type" defaultValue="note" className={inputClassName}>
                                                <option value="note">Note</option>
                                                <option value="mitigation">Mitigation</option>
                                                <option value="escalation">Escalation</option>
                                                <option value="recovery">Recovery</option>
                                            </select>
                                            <Input name="summary" placeholder="Timeline summary" required />
                                            <Input name="reason" placeholder="Reason" required />
                                            <Button type="submit" variant="outline">Add event</Button>
                                        </ConsoleActionForm>

                                        <ConsoleActionForm action={pageIncident} className="grid gap-[var(--lb-space-2)]">
                                            <Input unstyled type="hidden" name="incident_id" value={incident.incident_id} />
                                            <Input name="target_team" placeholder="Target team" />
                                            <Input name="escalation_level" type="number" min={1} max={5} defaultValue={1} />
                                            <Input name="summary" placeholder="Page summary" required />
                                            <Input name="reason" placeholder="Reason" required />
                                            <Button type="submit" variant="destructive">Dry-run page</Button>
                                        </ConsoleActionForm>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </Panel>
    );
}

function RuntimeCommandPanel({commands,error,reloadHref,page,previousHref,nextHref}: {
    commands:RuntimeCommandRecord[];error?:string;reloadHref:string;page:number;previousHref?:string;nextHref?:string;
}) {
    return (
        <Panel title="Runtime Controls" description="Generic runtime commands are unavailable while independent consent and their canonical execution owner remain unintegrated.">
            <p role="status">No runtime command can be submitted here. Use the documented recovery procedure for the affected queue, outbox or provider.</p>
            <p>Historical records below are retained evidence. Their stored status does not establish independent approval or a completed operational effect.</p>

            <div className="mt-[var(--lb-space-5)] divide-y divide-[var(--lb-color-border)]">
                {error ? <div role="alert"><p>Runtime command history unavailable.</p>
                    <a href={reloadHref}>Reload command history</a></div> : commands.length === 0 ? (
                    <EmptyDataState message="No runtime commands returned." />
                ) : commands.map((command) => (
                    <div key={command.command_id} className="py-[var(--lb-space-3)]">
                        <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                            <div className="min-w-0">
                                <p className="m-0 truncate text-sm font-medium">{command.operation}</p>
                                <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                    {command.command_id} | {command.target_type}:{command.target_id}
                                </p>
                            </div>
                            <StatusPill value={command.status} />
                        </div>
                    </div>
                ))}
            </div>
            {!error&&<nav aria-label="Runtime command history pages" className="flex gap-[var(--lb-space-3)]">
                {previousHref&&<a href={previousHref}>Previous command records</a>}
                <span>Command history page {page}</span>
                {nextHref&&<a href={nextHref}>Next command records</a>}
            </nav>}
        </Panel>
    );
}

function OncallPanel({
    current,
    error,
    reloadHref,
    schedules, schedulesError, schedulesReloadHref, schedulesPage, schedulesPreviousHref, schedulesNextHref,
}: {
    current: CurrentOncall | null;
    error?: string;
    reloadHref: string;
    schedules: OncallSchedule[];
    schedulesError?: string; schedulesReloadHref: string; schedulesPage: number;
    schedulesPreviousHref?: string; schedulesNextHref?: string;
}) {
    return (
        <Panel title="On-Call" description="Current rotation resolution and dry-run paging setup. Vendor paging remains on the adapter boundary until production keys are supplied.">
            {error ? <div role="alert" className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                <p>Current rotation unavailable.</p>
                <a href={reloadHref}>Reload current rotation</a>
            </div> : <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                <p className="m-0 text-sm font-medium">{current ? `${current.team_name} | ${current.rotation_name}` : 'No active on-call schedule'}</p>
                <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                    {current ? `Primary ${current.primary_employee_id || 'unassigned'} | ${current.paging_adapter}` : 'Create a rotation to resolve the current on-call.'}
                </p>
            </div>}

            <ConsoleActionForm action={createOncallSchedule} className="mt-[var(--lb-space-4)] grid gap-[var(--lb-space-3)] md:grid-cols-2">
                <Input name="team_name" label="Team" placeholder="platform" required />
                <Input name="rotation_name" label="Rotation" placeholder="primary-weekday" required />
                <Input name="primary_employee_id" label="Primary employee ID" />
                <Input name="backup_employee_ids" label="Backup IDs" placeholder="uuid, uuid" />
                <Input name="timezone" label="Timezone" defaultValue="Asia/Kolkata" />
                <Input name="starts_at" label="Starts at" placeholder="2026-06-08T09:00:00.000Z" />
                <Input name="ends_at" label="Ends at" placeholder="2026-06-15T09:00:00.000Z" />
                <Input name="reason" label="Reason" placeholder="Weekly on-call rotation update" required />
                <div className="md:col-span-2">
                    <Button type="submit" variant="secondary">Create schedule</Button>
                </div>
            </ConsoleActionForm>

            <div className="mt-[var(--lb-space-5)] divide-y divide-[var(--lb-color-border)]">
                {schedulesError ? <div role="alert"><p>On-call schedules unavailable.</p>
                    <a href={schedulesReloadHref}>Reload schedules</a></div> : schedules.length === 0 ? (
                    <EmptyDataState message="No on-call schedules returned." />
                ) : schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-start justify-between gap-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                        <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium">{schedule.rotation_name}</p>
                            <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                {schedule.team_name} | {formatDateTime(schedule.starts_at)} to {schedule.ends_at ? formatDateTime(schedule.ends_at) : 'open'} | {schedule.primary_employee_id || 'unassigned'}
                            </p>
                        </div>
                        <StatusPill value={schedule.active ? 'active' : 'inactive'} />
                    </div>
                ))}
            </div>
            {!schedulesError && <nav aria-label="On-call schedule pages" className="flex gap-[var(--lb-space-3)]">
                {schedulesPreviousHref && <a href={schedulesPreviousHref}>Previous schedules</a>}
                <span>Schedule page {schedulesPage}</span>
                {schedulesNextHref && <a href={schedulesNextHref}>Next schedules</a>}
            </nav>}
        </Panel>
    );
}

function PostmortemPanel({
    incidents,
    postmortems,
}: {
    incidents: InternalProductionIncident[];
    postmortems: InternalIncidentPostmortem[];
}) {
    return (
        <Panel title="Postmortems" description="Blameless postmortem tracker with close-gate support for SEV-1 and SEV-2 incidents.">
            <ConsoleActionForm action={createPostmortem} className="grid gap-[var(--lb-space-3)]">
                <label className="flex flex-col gap-[var(--lb-space-1)] text-sm font-medium">
                    Incident
                    <select aria-label="Incident id" name="incident_id" className={inputClassName} required>
                        <option value="">Select incident</option>
                        {incidents.map((incident) => (
                            <option key={incident.incident_id} value={incident.incident_id}>{incident.incident_id} | {incident.title}</option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-[var(--lb-space-1)] text-sm font-medium">
                    Status
                    <select aria-label="Status" name="status" defaultValue="draft" className={inputClassName}>
                        <option value="draft">Draft</option>
                        <option value="review">Review</option>
                        <option value="accepted">Accepted</option>
                        <option value="closed">Closed</option>
                    </select>
                </label>
                <Input name="owner_id" label="Owner employee ID" />
                <Input name="due_at" label="Due at" placeholder="2026-06-15T09:00:00.000Z" />
                <Textarea name="summary" label="Summary" placeholder="What happened, impact, recovery, and follow-up." />
                <Input name="action_items" label="Action items" placeholder="Add synthetic checkout monitor, tighten cache circuit breaker" />
                <Input name="reason" label="Reason" placeholder="Postmortem created for SEV close gate" required />
                <Button type="submit" variant="secondary">Save postmortem</Button>
            </ConsoleActionForm>

            <div className="mt-[var(--lb-space-5)] divide-y divide-[var(--lb-color-border)]">
                {postmortems.length === 0 ? (
                    <EmptyDataState message="No postmortems returned." />
                ) : postmortems.map((postmortem) => (
                    <div key={postmortem.id} className="flex items-start justify-between gap-[var(--lb-space-3)] py-[var(--lb-space-3)]">
                        <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium">{postmortem.incident_id}</p>
                            <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">
                                due {postmortem.due_at ? formatDateTime(postmortem.due_at) : 'not set'} | owner {postmortem.owner_id || 'unassigned'}
                            </p>
                        </div>
                        <StatusPill value={postmortem.status} />
                    </div>
                ))}
            </div>
        </Panel>
    );
}

function StatusPanel({
    title,
    description,
    items,
}: {
    title: string;
    description: string;
    items: StatusListItem[];
}) {
    return (
        <Panel title={title} description={description}>
            {items.length === 0 ? (
                <EmptyDataState message="No live records returned." />
            ) : (
                <div className="divide-y divide-[var(--lb-color-border)]">
                    {items.map((item) => (
                        <div key={item.key} className="flex items-start justify-between gap-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                            <div className="min-w-0">
                                <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{item.label}</p>
                                <p className="m-0 mt-[var(--lb-space-1)] truncate text-xs text-[var(--lb-color-text-subdued)]">{item.detail}</p>
                                {item.timestamp ? (
                                    <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                                        {formatDateTime(item.timestamp)}
                                    </p>
                                ) : null}
                            </div>
                            <StatusPill value={item.status} />
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}
