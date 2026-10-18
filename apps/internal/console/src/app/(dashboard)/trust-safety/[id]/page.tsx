import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import type { InternalTrustSafetyCaseResult } from '@letbuyy/api-client';
import { Input, Button, Textarea } from '@letbuyy/ui';
import { ConsoleApprovalForm } from '@/components/ConsoleApprovalForm';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { ConsoleWorkspace, Panel, StatusPill } from '@/components/_local-ui/console-workspace';
import { fetchConsoleApi, formatDateTime, readSearchParam, type ConsoleDataResponse } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

export default async function TrustSafetyCasePage({ params, searchParams }: {
    params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await requireConsoleSession({ mfa: true });
    const parsedId = z.string().uuid().safeParse((await params).id);
    if (!parsedId.success) notFound();
    const id = parsedId.data, query = await searchParams;
    const result = await fetchConsoleApi<ConsoleDataResponse<InternalTrustSafetyCaseResult>>('/internal/console/trust-safety/cases/' + id);
    const data = result.data?.data;
    if (result.error || !data?.case) return <ConsoleWorkspace eyebrow="Trust & Safety" title="Case unavailable" description="Retry the case review before taking action.">
        <ConsoleApiErrorPanel title="Unable to read this case" message={result.error || 'Case unavailable.'} /><Link href="/trust-safety">Back to cases</Link>
    </ConsoleWorkspace>;
    const row = data.case, active = (data.takedowns || []).filter(takedown => takedown.status === 'active');
    const requestKey = z.string().uuid().safeParse(readSearchParam(query, 'request_key'));
    const enforcementKey = z.string().uuid().safeParse(readSearchParam(query, 'enforcement_key'));
    const canSuspend = row.subject_type === 'site' && row.site_id === row.subject_id && ['open', 'under_review'].includes(row.status);
    const canRequest = ['actioned', 'appealed'].includes(row.status) && active.length > 0;
    const error = readSearchParam(query, 'error').slice(0, 400);
    return <ConsoleWorkspace eyebrow="Trust & Safety" title={row.title} description="Review the retained case, evidence and enforcement before requesting an independent decision.">
        {error && <p role="alert">{error}</p>}
        <Panel title="Case review">
            <dl className="space-y-3">
                <div><dt>Case</dt><dd>{id}</dd></div>
                <div><dt>Subject</dt><dd>{row.subject_type}: {row.subject_id}</dd></div>
                <div><dt>Status</dt><dd><StatusPill value={row.status} /></dd></div>
                <div><dt>Summary</dt><dd>{row.summary || 'No summary recorded.'}</dd></div>
            </dl>
        </Panel>
        <Panel title="Evidence" description="Up to 100 current evidence records; the approval binds a digest of all current case evidence, appeals, events and policy.">
            {(data.evidence || []).length ? data.evidence!.map(item => <div key={item.id} className="my-3"><p>{item.title}</p><p>{item.description}</p></div>) : <p>No evidence returned.</p>}
        </Panel>
        <Panel title="Enforcement records" description="Up to 25 current records. Reinstatement reverses only this case’s reviewed restrictions; another hold can keep the site suspended.">
            {(data.takedowns || []).map(item => <p key={item.id}>{item.action_type} · {item.status} · {item.id}</p>)}
            {!data.takedowns?.length && <p>No enforcement records returned.</p>}
        </Panel>
        <Panel title="Appeals and case history" description="Up to 25 appeals and 100 case events. Delivery status is independent of the case decision.">
            {(data.appeals || []).map(item => <p key={item.id}>Appeal {item.status} · {item.reason}</p>)}
            {(data.events || []).map(item => <p key={item.id}>{formatDateTime(item.created_at)} · {item.event_type} · {item.reason}</p>)}
        </Panel>
        {canSuspend && <Panel title="Suspend this site" description="This action records the restriction and audit atomically. Subject email delivery remains pending an approved environment.">
            <ConsoleApprovalForm action="/api/approvals/enforce-trust" className="space-y-4">
                <Input unstyled type="hidden" name="case_id" value={id} /><Input unstyled type="hidden" name="enforcement_key" value={enforcementKey.success ? enforcementKey.data : crypto.randomUUID()} />
                <label className="block">Suspension reason<Textarea name="reason" minLength={8} maxLength={1000} required /></label>
                <label className="block">Additional enforcement notes<Textarea name="operator_note" maxLength={2000} /></label>
                <Button type="submit">Suspend site for this case</Button>
            </ConsoleApprovalForm>
        </Panel>}
        {canRequest && <Panel title="Request reinstatement" description="An active platform super admin must independently review this exact case, reason, notes and site restrictions. Approval expires after ten minutes or when the bound session or evidence changes.">
            <ConsoleApprovalForm action="/api/approvals/request-trust" className="space-y-4">
                <Input unstyled type="hidden" name="case_id" value={id} /><Input unstyled type="hidden" name="request_key" value={requestKey.success ? requestKey.data : crypto.randomUUID()} />
                <label className="block">Reinstatement reason<Textarea name="reason" minLength={8} maxLength={1000} required /></label>
                <label className="block">Additional reinstatement notes<Textarea name="operator_note" maxLength={2000} /></label>
                <Button type="submit">Request independent reinstatement</Button>
            </ConsoleApprovalForm>
        </Panel>}
        <Link href="/trust-safety">Back to cases</Link>
    </ConsoleWorkspace>;
}
