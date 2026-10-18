import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ConsoleApprovalForm } from '@/components/ConsoleApprovalForm';
import { z } from 'zod';
import { InternalSensitiveApprovalSchema, InternalMoneyResolutionDetailsSchema, type InternalSensitiveApproval } from '@letbuyy/shared-types';
import { Input, Button } from '@letbuyy/ui';
import { ConsoleWorkspace, Panel } from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatDateTime, formatMoneyFromPaise, readSearchParam, type ConsoleDataResponse } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';
import { InternalPlatformJobSchema } from '@letbuyy/shared-types';

function approvalId(value: unknown): string {
    const parsed = z.string().uuid().safeParse(value);
    if (!parsed.success) redirect('/approvals?error=Invalid%20approval%20identifier.');
    return parsed.data;
}
// A presentation projection only. Gateway/PostgreSQL remain the sole owners of
// intent validity, source hashes, live permission and the committed receipt.
const trustReviewSchema = z.object({
    case: z.object({ id: z.string().uuid(), title: z.string(), status: z.string() }).passthrough(),
    site: z.object({ id: z.string().uuid(), status: z.string(), status_revision: z.union([z.number(), z.string()]), published: z.boolean() }).passthrough(),
    takedowns: z.array(z.object({ id: z.string().uuid(), action_type: z.string(), status: z.string() }).passthrough()),
    other_active_takedowns: z.array(z.object({ id: z.string().uuid(), case_id: z.string().uuid() }).passthrough()),
    review_sources: z.object({ evidence: z.object({ count: z.number(), sha256: z.string() }),
        appeals: z.object({ count: z.number(), sha256: z.string() }), events: z.object({ count: z.number(), sha256: z.string() }), policy: z.string().nullable() }).passthrough(),
}).passthrough();
export default async function ApprovalPage({ params, searchParams }: {
    params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const session = await requireConsoleSession({ mfa: true }), id = approvalId((await params).id);
    const response = await fetchConsoleApi<ConsoleDataResponse<{ approval: InternalSensitiveApproval }>>('/internal/console/approvals/' + id);
    const parsed = InternalSensitiveApprovalSchema.safeParse(response.data?.data.approval);
    const error = readSearchParam(await searchParams, 'error').slice(0, 400);
    if (response.error || !parsed.success) return <ConsoleWorkspace eyebrow="Protected actions" title="Approval unavailable" description="No protected action has been executed by this page.">
        <ConsoleApiErrorPanel title="Unable to read this approval" message={response.error || 'Approval unavailable.'} />
        <Link href="/approvals">Back to requests</Link>
    </ConsoleWorkspace>;
    const approval = parsed.data, mine = approval.maker_actor_id === session.userId;
    const jobRecovery = approval.action === 'platform.job.redrive';
    const reviewedJob = InternalPlatformJobSchema.safeParse(approval.payload.job);
    if (jobRecovery && (!reviewedJob.success || approval.resource_type !== 'platform_queue_job' || reviewedJob.data.id !== approval.resource_id || reviewedJob.data.site_id !== approval.site_id)) {
        return <ConsoleApiErrorPanel title="Approval unavailable" message="The reviewed recovery source is unavailable."/>;
    }
    const jobResponse = jobRecovery ? await fetchConsoleApi<ConsoleDataResponse<{items:unknown[]}>>('/internal/console/platform-jobs',{job_id:approval.resource_id}) : null;
    const currentJob = InternalPlatformJobSchema.safeParse(jobResponse?.data?.data.items[0]);
    const jobReviewEligible = reviewedJob.success && currentJob.success && currentJob.data.eligible &&
        currentJob.data.source_fingerprint === reviewedJob.data.source_fingerprint;
    const mfa=approval.action==='operator.mfa.reset';
    const mfaTarget=z.object({actor_id:z.string().uuid(),email:z.string().email(),name:z.string().nullable()}).passthrough().safeParse(approval.payload.target);
    if(mfa&&(!mfaTarget.success||approval.site_id!==null||approval.resource_type!=='platform_operator'))return <ConsoleApiErrorPanel title="Approval unavailable" message="The reviewed operator recovery is unavailable."/>;
    const affectedOperator=mfa&&approval.resource_id===session.userId;
    const money = approval.action === 'money.reconciliation.resolve';
    const trust = approval.action === 'ts.reinstate', trustReview = trustReviewSchema.safeParse(approval.payload.context);
    const details = InternalMoneyResolutionDetailsSchema.safeParse(approval.payload.details);
    const resourcePath = jobRecovery ? '/operations?job_id='+approval.resource_id : mfa ? '/approvals?mfa_target='+approval.resource_id : trust ? '/trust-safety/' + approval.resource_id : money ? '/money-reconciliation?site_id=' + approval.site_id : '/merchants/' + approval.site_id;
    if (money && !details.success) return <ConsoleApiErrorPanel title="Approval unavailable" message="The reviewed money resolution is unavailable." />;
    if (trust && !trustReview.success) return <ConsoleApiErrorPanel title="Approval unavailable" message="The reviewed case context is unavailable." />;
    const expired = Date.parse(approval.expires_at) <= Date.now(), executed = !!approval.consumed_at;
    return <ConsoleWorkspace eyebrow="Protected actions" title="Review protected action" description={jobRecovery ? "Consent applies only to this job, original order, recorded points, one additional attempt, reason and sign-in. Approval alone does not retry the job." : mfa ? "Review the operator, recovery reason and session/factor effects. Approval alone does not execute the reset." : trust ? "Consent applies only to this case, evidence, restrictions, reason, notes and sign-in. Approval alone does not execute it." : money ? "Consent applies only to this store’s money break, resolution, evidence and sign-in. Approval alone does not execute it." : "Consent applies only to this merchant, action, reason and sign-in. Approval alone does not execute it."}>
        {error && <p role="alert">{error}</p>}
        <Panel title={approval.action}>
            <dl className="space-y-3">
                <div><dt>{jobRecovery ? 'Job' : mfa ? 'Operator' : trust ? 'Case' : money ? 'Store' : 'Merchant'}</dt><dd><Link className="underline" href={resourcePath}>{approval.resource_id}</Link></dd></div>
                <div><dt>Requested by</dt><dd>{approval.maker_actor_id}{mine ? ' (you)' : ''}</dd></div>
                <div><dt>Reason</dt><dd>{approval.reason}</dd></div>
                {!mfa && <div><dt>State when requested</dt><dd>{String(approval.payload.expected_status || '')}</dd></div>}
                {jobRecovery && reviewedJob.success && <>
                    <div><dt>Reviewed store and order</dt><dd>{reviewedJob.data.site_id} · {reviewedJob.data.order_id}</dd></div>
                    <div><dt>Reviewed attempts</dt><dd>{reviewedJob.data.status} · {reviewedJob.data.attempts} used of {reviewedJob.data.max_attempts}</dd></div>
                    <div><dt>Original redeemed points</dt><dd>{reviewedJob.data.points}</dd></div>
                    <div><dt>Reviewed source fingerprint</dt><dd className="break-all">{reviewedJob.data.source_fingerprint}</dd></div>
                    <div><dt>Current job state</dt><dd>{currentJob.success ? `${currentJob.data.status} · ${currentJob.data.attempts} used of ${currentJob.data.max_attempts}` : 'Unavailable; reload before acting'}</dd></div>
                    <div><dt>Effect</dt><dd>Authorize one additional attempt of the original loyalty restoration. This operation does not post points; the existing worker verifies and performs any recovery.</dd></div>
                </>}
                {mfa && mfaTarget.success && <>
                    <div><dt>Operator account</dt><dd>{mfaTarget.data.name ? mfaTarget.data.name+' · ' : ''}{mfaTarget.data.email}</dd></div>
                    <div><dt>Effect</dt><dd>Revoke this operator’s current Console sessions and retire the configured authenticator. A configuration custodian must provide a replacement per-account factor before the operator can verify again. Other accounts and realms keep their existing authority.</dd></div>
                    <div><dt>Security notification</dt><dd>Execution queues an email to this verified operator address. Provider acceptance and inbox delivery require separate confirmation.</dd></div>
                </>}
                {trust && trustReview.success && <>
                    <div><dt>Case title and reviewed state</dt><dd>{trustReview.data.case.title} · {trustReview.data.case.status}</dd></div>
                    <div><dt>Reviewed site</dt><dd>{trustReview.data.site.id} · {trustReview.data.site.status} · revision {trustReview.data.site.status_revision} · published {String(trustReview.data.site.published)}</dd></div>
                    <div><dt>This case’s restrictions</dt><dd>{trustReview.data.takedowns.map(row => <p key={row.id}>{row.id} · {row.action_type} · {row.status}</p>)}</dd></div>
                    <div><dt>Other active restrictions</dt><dd>{trustReview.data.other_active_takedowns.length ? trustReview.data.other_active_takedowns.map(row => <p key={row.id}>Case {row.case_id} · restriction {row.id}</p>) : 'None at request time'}</dd></div>
                    <div><dt>Reviewed source digests</dt><dd>{(['evidence', 'appeals', 'events'] as const).map(kind => <p className="break-all" key={kind}>{kind}: {trustReview.data.review_sources[kind].count} · {trustReview.data.review_sources[kind].sha256}</p>)}</dd></div>
                    <div><dt>Reviewed policy digest</dt><dd className="break-all">{trustReview.data.review_sources.policy || 'No linked policy at request time'}</dd></div>
                    <div><dt>Additional reinstatement notes</dt><dd className="whitespace-pre-wrap">{JSON.stringify(approval.payload.note_metadata)}</dd></div>
                    <div><dt>Effect</dt><dd>Reverse this case’s reviewed restrictions. Restore the recorded site state only when no other safety hold or independent status change prevents it. Subject email delivery remains pending.</dd></div>
                </>}
                {money && details.success && <>
                    <div><dt>Resolution</dt><dd>{details.data.resolution}</dd></div>
                    <div><dt>Reviewed variance</dt><dd>{formatMoneyFromPaise(Number(approval.payload.variance_minor))}</dd></div>
                    <div><dt>Wallet projection</dt><dd>{formatMoneyFromPaise(Number(approval.payload.wallet_available_minor))}</dd></div>
                    <div><dt>Canonical merchant payable</dt><dd>{formatMoneyFromPaise(Number(approval.payload.ledger_merchant_payable_minor))}</dd></div>
                    <div><dt>Provider reference</dt><dd>{details.data.provider_reference || 'None supplied'}</dd></div>
                    <div><dt>Journal reference</dt><dd>{details.data.suspense_ledger_transaction_id || 'None supplied'}</dd></div>
                    <div><dt>Effect</dt><dd>An acknowledgement records review. It does not change the journal or clear the mismatch. A recheck uses the canonical reconciliation calculation.</dd></div>
                </>}
                <div><dt>Status</dt><dd>{executed ? 'Executed' : expired ? 'Expired' : approval.status}</dd></div>
                <div><dt>Expires</dt><dd>{formatDateTime(approval.expires_at)}</dd></div>
                {approval.checker_actor_id && <div><dt>Decision by</dt><dd>{approval.checker_actor_id}</dd></div>}
            </dl>
            {!expired && !executed && approval.status === 'pending' && <ConsoleApprovalForm action="/api/approvals/decision" className="mt-6 space-y-4">
                <Input unstyled type="hidden" name="approval_id" value={id} /><Input unstyled type="hidden" name="payload_hash" value={approval.payload_hash} />
                {mine||affectedOperator ? <><p>{affectedOperator?'The affected operator cannot decide this recovery.':'A different active platform super admin must decide this request.'}</p>{mine&&<Button type="submit" name="decision" value="cancel">Cancel request</Button>}</> : <>
                    <label className="flex gap-2"><Input unstyled type="checkbox" name="reviewed" value="yes" required />{jobRecovery ? 'I reviewed this job, original order, recorded points and one-attempt retry.' : mfa ? 'I independently verified this operator recovery request and reviewed the account, reason and reset effect.' : trust ? 'I reviewed this case, evidence, restrictions, reason and notes.' : money ? 'I reviewed this money break, resolution and reason.' : 'I reviewed this merchant, action and reason.'}</label>
                    <div className="flex gap-4"><Button type="submit" name="decision" value="approve">Approve this request</Button>
                        <Button type="submit" name="decision" value="reject">Reject this request</Button></div>
                </>}
            </ConsoleApprovalForm>}
            {!expired && !executed && mine && approval.status === 'approved' && (!jobRecovery || jobReviewEligible) && <ConsoleApprovalForm action="/api/approvals/execute" className="mt-6">
                <Input unstyled type="hidden" name="approval_id" value={id} /><Button type="submit">Execute approved action</Button>
            </ConsoleApprovalForm>}
            {executed && <p className="mt-4">Executed at {formatDateTime(approval.consumed_at)}. A retry cannot create a second effect.</p>}
            {jobRecovery && !executed && !jobReviewEligible && <p>The current job source or recovery state changed. Review it again before requesting a new action.</p>}
            {jobRecovery && executed && <p>One additional attempt was authorized. The current job state above reports worker progress; approval alone does not establish a point restoration.</p>}
            {executed&&mfa&&<p>Reset applied. Revoked Console sessions: {String(approval.result?.revoked_sessions??'Unavailable')}. Security notification was {String(approval.result?.notification_status??'unavailable')} at execution; this receipt does not certify inbox delivery.</p>}
            {executed&&mfa&&approval.notification_delivery&&<p>Security email: {approval.notification_delivery.status==='succeeded'?'accepted by the email provider; inbox delivery is unconfirmed':approval.notification_delivery.status==='dead'?'delivery needs attention':approval.notification_delivery.status==='failed'?'retry pending':approval.notification_delivery.status}. Attempts: {approval.notification_delivery.attempts}.</p>}
            {executed && trust && <p>Site restoration outcome: {String(approval.result?.site_restoration_outcome || 'Unavailable')}. Review the case and current site state before further action.</p>}
            <div className="mt-6 flex gap-4"><Link href="/approvals">All requests</Link><Link href={resourcePath}>{mfa ? 'Review operator recovery requests' : trust ? 'Review case or request a new action' : money ? 'Review money break or request a new action' : 'Review merchant or request a new action'}</Link></div>
        </Panel>
    </ConsoleWorkspace>;
}
