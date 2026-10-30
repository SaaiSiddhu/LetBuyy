import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { z } from 'zod';
import { ConsoleApprovalForm } from '@/components/ConsoleApprovalForm';
import type {
    InternalMerchantImpersonationResult,
    InternalMerchantImpersonationSession,
    InternalMerchantOverview,
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
    readSearchParam,
    formatDateTime,
    formatMoneyFromPaise,
    type ConsoleDataResponse,
} from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function requireActorId(actorId: string | null | undefined): string {
    if (!actorId) {
        throw new Error('Console session is missing an actor id.');
    }

    return actorId;
}

async function startMerchantImpersonation(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const merchantId = String(formData.get('merchant_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();
    const ttlMinutes = Number(formData.get('ttl_minutes') || 30);

    if (!merchantId || reason.length < 8) {
        throw new Error('Read-only impersonation requires a merchant id and a clear reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<InternalMerchantImpersonationResult>>(
        `/internal/console/merchants/${merchantId}/impersonation`,
        {
            method: 'POST',
            body: {
                actor_id: requireActorId(session.userId),
                actor_email: session.email,
                operator_id: session.userId,
                operator_email: session.email,
                ttl_minutes: Number.isFinite(ttlMinutes) ? ttlMinutes : 30,
                reason,
            },
        }
    );

    if (result.error) {
        throw new Error(result.error);
    }

    revalidatePath(`/merchants/${merchantId}`);
}

async function endMerchantImpersonation(formData: FormData) {
    'use server';

    const session = await requireConsoleSession({ mfa: true });
    const merchantId = String(formData.get('merchant_id') || '').trim();
    const sessionId = String(formData.get('session_id') || '').trim();
    const reason = String(formData.get('reason') || '').trim();

    if (!merchantId || !sessionId || reason.length < 8) {
        throw new Error('Ending an impersonation session requires a session id and a clear reason.');
    }

    const result = await fetchConsoleApi<ConsoleDataResponse<{ session: InternalMerchantImpersonationSession }>>(
        `/internal/console/merchants/${merchantId}/impersonation/${sessionId}/end`,
        {
            method: 'POST',
            body: {
                actor_id: requireActorId(session.userId),
                actor_email: session.email,
                reason,
            },
        }
    );

    if (result.error) {
        throw new Error(result.error);
    }

    revalidatePath(`/merchants/${merchantId}`);
}

export default async function MerchantDetailPage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const query = await searchParams;
    const formError = readSearchParam(query, 'error').slice(0, 400);
    const retryKey = z.string().uuid().safeParse(readSearchParam(query, 'request_key'));
    const retryAction = readSearchParam(query, 'action');
    const session = await requireConsoleSession({ mfa: true });
    const result = await fetchConsoleApi<ConsoleDataResponse<InternalMerchantOverview>>(
        `/internal/console/merchants/${id}/overview`,
        {
            actor_id: session.userId || undefined,
            actor_email: session.email,
        }
    );
    const overview = result.data?.data || null;
    const site = overview?.site;
    const title = site?.store_name || site?.name || site?.subdomain || id;
    const riskScore = overview?.trust.risk_score;
    const riskBand = typeof riskScore?.band === 'string' ? riskScore.band : 'none';
    const openCases = overview?.trust.open_cases || [];

    return (
        <ConsoleWorkspace
            eyebrow="Merchant operations"
            title={title}
            description="Merchant 360 brings store, owner, billing, commerce, risk, Trust & Safety, support, app, theme, and audit context into one governed view."
        >
            {result.error ? (
                <ConsoleApiErrorPanel title="Merchant 360 API unavailable" message={result.error} />
            ) : null}

            {overview && site ? (
                <>
                    <MetricGrid>
                        <LeadershipMetric label="Store status" value={site.status || 'draft'} detail={site.subdomain || site.id} tone={site.status === 'suspended' ? 'critical' : 'success'} />
                        <LeadershipMetric label="Orders" value={String(overview.commerce.order_count)} detail={`${overview.commerce.paid_order_count} paid`} />
                        <LeadershipMetric label="Revenue" value={formatMoneyFromPaise(overview.commerce.revenue_paise, site.currency || 'INR')} detail="Paid order sample" />
                        <LeadershipMetric label="Risk band" value={riskBand} detail={riskScore ? `Score ${String(riskScore.score ?? '-')}` : 'No score recorded'} tone={riskBand === 'high' ? 'critical' : riskBand === 'medium' ? 'warning' : 'success'} />
                    </MetricGrid>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-[1.1fr_0.9fr]">
                        <Panel title="Identity" description="Site record and owner context.">
                            <dl className="grid gap-[var(--lb-space-3)] text-sm md:grid-cols-2">
                                <Field label="Site id" value={site.id} />
                                <Field label="Type" value={site.site_type || 'ecommerce'} />
                                <Field label="Subdomain" value={site.subdomain ? `${site.subdomain}.letbuyy.com` : '-'} />
                                <Field label="Custom domain" value={site.custom_domain || '-'} />
                                <Field label="Domain status" value={site.custom_domain_status || '-'} />
                                <Field label="Created" value={formatDateTime(site.created_at)} />
                            </dl>
                            <Link href={`/merchants/${encodeURIComponent(site.id)}/kyc`}
                                className="mt-[var(--lb-space-4)] inline-block text-sm font-medium text-[var(--lb-color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]">
                                Review KYC evidence
                            </Link>
                            <div className="mt-[var(--lb-space-5)] divide-y divide-[var(--lb-color-border)]">
                                {overview.owners.length === 0 ? (
                                    <EmptyDataState message="No owner record was returned for this merchant." />
                                ) : overview.owners.map((owner) => (
                                    <div key={owner.id} className="py-[var(--lb-space-3)]">
                                        <p className="m-0 text-sm font-medium text-[var(--lb-color-text)]">{owner.full_name || owner.email || owner.id}</p>
                                        <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">{owner.email || owner.id}</p>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        <Panel title="Subscription" description="Current billing and plan context returned by the control plane.">
                            {overview.subscription ? (
                                <dl className="grid gap-[var(--lb-space-3)] text-sm md:grid-cols-2">
                                    <Field label="Plan" value={labelFor(overview.subscription.plan)} />
                                    <Field label="Status" value={labelFor(overview.subscription.status)} />
                                    <Field label="Billing period" value={labelFor(overview.subscription.billing_period)} />
                                    <Field label="Current period end" value={formatDateTime(asNullableString(overview.subscription.current_period_end))} />
                                </dl>
                            ) : (
                                <EmptyDataState message="No active subscription was returned for this merchant." />
                            )}
                        </Panel>
                    </section>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                        <Panel title="Risk & Trust" description="Risk score and open Trust & Safety cases linked to this merchant.">
                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                <StatusPill value={`risk ${riskBand}`} tone={riskBand === 'high' ? 'critical' : riskBand === 'medium' ? 'warning' : 'info'} />
                                <StatusPill value={`${openCases.length} open cases`} tone={openCases.length > 0 ? 'warning' : 'success'} />
                                <Link href={`/trust-safety?site_id=${encodeURIComponent(site.id)}`} className="text-sm font-medium text-[var(--lb-color-primary)] underline-offset-4 hover:underline">
                                    Open Trust & Safety
                                </Link>
                            </div>
                            <div className="mt-[var(--lb-space-4)] divide-y divide-[var(--lb-color-border)]">
                                {openCases.length === 0 ? (
                                    <EmptyDataState message="No open Trust & Safety cases are linked to this merchant." />
                                ) : openCases.map((caseRow) => (
                                    <div key={String(caseRow.id)} className="grid gap-[var(--lb-space-2)] py-[var(--lb-space-3)] md:grid-cols-[1fr_auto] md:items-center">
                                        <div className="min-w-0">
                                            <p className="m-0 truncate text-sm font-medium text-[var(--lb-color-text)]">{labelFor(caseRow.title)}</p>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                                                {labelFor(caseRow.category)} · {formatDateTime(asNullableString(caseRow.created_at))}
                                            </p>
                                        </div>
                                        <StatusPill value={labelFor(caseRow.status)} />
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        <Panel title="Support" description="Support context linked to the merchant record.">
                            {overview.support.tickets.length === 0 ? (
                                <EmptyDataState message="No support tickets are linked to this merchant." />
                            ) : (
                                <div className="divide-y divide-[var(--lb-color-border)]">
                                    {overview.support.tickets.map((ticket) => (
                                        <div key={String(ticket.id)} className="py-[var(--lb-space-3)]">
                                            <p className="m-0 text-sm font-medium text-[var(--lb-color-text)]">{labelFor(ticket.subject)}</p>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">{labelFor(ticket.status)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </section>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                        <Panel title="Apps & Theme" description="Installed apps and active theme context.">
                            <dl className="grid gap-[var(--lb-space-3)] text-sm md:grid-cols-2">
                                <Field label="Installed apps" value={String(overview.ecosystem.installed_apps.length)} />
                                <Field label="Active theme" value={labelFor(overview.ecosystem.active_theme?.theme_slug || overview.ecosystem.active_theme?.id || '-')} />
                                <Field label="Theme instances" value={String(overview.ecosystem.theme_instances.length)} />
                                <Field label="Current release" value={site.current_theme_release_id || '-'} />
                            </dl>
                        </Panel>

                        <Panel title="Recent Audit" description="Latest audit rows for this merchant resource.">
                            {overview.recent_audit_events.length === 0 ? (
                                <EmptyDataState message="No audit rows are linked to this merchant yet." />
                            ) : (
                                <div className="divide-y divide-[var(--lb-color-border)]">
                                    {overview.recent_audit_events.map((event) => (
                                        <div key={String(event.id)} className="py-[var(--lb-space-3)]">
                                            <p className="m-0 text-sm font-medium text-[var(--lb-color-text)]">{labelFor(event.action)}</p>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                                                {labelFor(event.actor_email || event.actor_id || event.actor_type)} · {formatDateTime(asNullableString(event.created_at))}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </section>

                    <section className="grid gap-[var(--lb-space-5)] xl:grid-cols-2">
                        <Panel title="Read-only Impersonation" description="Create or end time-boxed read-only operator sessions.">
                            <form action={startMerchantImpersonation} className="grid gap-[var(--lb-space-3)]">
                                <Input unstyled type="hidden" name="merchant_id" value={site.id} />
                                <label className="grid gap-[var(--lb-space-1)] text-sm text-[var(--lb-color-text)]">
                                    Duration
                                    <select
                                        name="ttl_minutes"
                                        defaultValue="30"
                                        className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none focus:border-[var(--lb-color-primary)]"
                                    >
                                        <option value="15">15 minutes</option>
                                        <option value="30">30 minutes</option>
                                        <option value="60">60 minutes</option>
                                    </select>
                                </label>
                                <Textarea name="reason" label="Reason" minLength={8} required placeholder="Explain why this read-only session is needed." />
                                <Button type="submit">Start read-only session</Button>
                            </form>

                            <div className="mt-[var(--lb-space-5)] divide-y divide-[var(--lb-color-border)]">
                                {overview.impersonation_sessions.length === 0 ? (
                                    <EmptyDataState message="No impersonation sessions have been recorded for this merchant." />
                                ) : overview.impersonation_sessions.map((impersonation) => (
                                    <div key={impersonation.id} className="grid gap-[var(--lb-space-3)] py-[var(--lb-space-3)] md:grid-cols-[1fr_auto] md:items-start">
                                        <div className="min-w-0">
                                            <p className="m-0 text-sm font-medium text-[var(--lb-color-text)]">{impersonation.operator_email || impersonation.operator_id}</p>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-xs text-[var(--lb-color-text-subdued)]">
                                                Expires {formatDateTime(impersonation.expires_at)} · {impersonation.read_only ? 'read-only' : 'write-enabled'}
                                            </p>
                                        </div>
                                        {isActiveImpersonationSession(impersonation) ? (
                                            <form action={endMerchantImpersonation} className="grid gap-[var(--lb-space-2)]">
                                                <Input unstyled type="hidden" name="merchant_id" value={site.id} />
                                                <Input unstyled type="hidden" name="session_id" value={impersonation.id} />
                                                <Input unstyled name="reason" minLength={8} required placeholder="Reason to end" />
                                                <Button type="submit" variant="secondary">End session</Button>
                                            </form>
                                        ) : (
                                            <StatusPill value={impersonation.ended_at ? 'ended' : 'expired'} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        {formError && <p role="alert">{formError}</p>}
                        <Panel title="Merchant Moderation" description="Suspend or restore the merchant with dual-control approval.">
                            <ConsoleApprovalForm action="/api/approvals/request" className="grid gap-[var(--lb-space-3)]">
                                <Input unstyled type="hidden" name="merchant_id" value={site.id} />
                                <label className="grid gap-[var(--lb-space-1)] text-sm text-[var(--lb-color-text)]">
                                    Action
                                    <select
                                        name="action"
                                        defaultValue={retryKey.success && ['restore', 'suspend'].includes(retryAction) ? retryAction : site.status === 'suspended' ? 'restore' : 'suspend'}
                                        className="min-h-11 rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-sm text-[var(--lb-color-text)] outline-none focus:border-[var(--lb-color-primary)]"
                                    >
                                        <option value="suspend">Suspend merchant</option>
                                        <option value="restore">Restore merchant</option>
                                    </select>
                                </label>
                                <Input unstyled type="hidden" name="request_key" value={retryKey.success ? retryKey.data : crypto.randomUUID()} />
                                <p className="text-sm">A different active platform super admin must review and approve the exact request before you can execute it.</p>
                                <Textarea name="reason" label="Reason" minLength={8} required placeholder="Record the evidence and expected merchant impact." />
                                <Button type="submit">Request independent approval</Button>
                            </ConsoleApprovalForm>
                        </Panel>
                    </section>
                </>
            ) : !result.error ? (
                <EmptyDataState message="Merchant not found." />
            ) : null}

            <div>
                <Link href="/merchants" className="text-sm font-medium text-[var(--lb-color-primary)] underline-offset-4 hover:underline">
                    Back to merchant search
                </Link>
            </div>
        </ConsoleWorkspace>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-medium uppercase text-[var(--lb-color-text-subdued)]">{label}</dt>
            <dd className="m-0 mt-[var(--lb-space-1)] break-words text-sm text-[var(--lb-color-text)]">{value}</dd>
        </div>
    );
}

function labelFor(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value).replace(/_/g, ' ');
}

function asNullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function isActiveImpersonationSession(session: InternalMerchantImpersonationSession): boolean {
    if (session.ended_at) return false;
    return Date.parse(session.expires_at) > Date.now();
}
