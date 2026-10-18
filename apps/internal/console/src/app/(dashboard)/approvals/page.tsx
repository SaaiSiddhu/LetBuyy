import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {ConsoleApprovalForm} from '@/components/ConsoleApprovalForm';
import {Button,Input,Textarea} from '@letbuyy/ui';
import type { InternalSensitiveApproval } from '@letbuyy/shared-types';
import { ConsoleWorkspace, Panel } from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatDateTime, readPageParam, readSearchParam, type ConsoleDataResponse } from '@/lib/console-api';
import { requireConsoleSession } from '@/lib/console-auth-server';

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const session=await requireConsoleSession({ mfa: true });
    const params = await searchParams, page = readPageParam(params), error = readSearchParam(params, 'error').slice(0, 400);
    const result = await fetchConsoleApi<ConsoleDataResponse<{ approvals: InternalSensitiveApproval[]; total: number; has_next: boolean }>>(
        '/internal/console/approvals', { query: { page, limit: 25 } });
    const operatorQuery=readSearchParam(params,'operator_q').slice(0,160),selectedOperator=readSearchParam(params,'mfa_target');
    const targets=await fetchConsoleApi<ConsoleDataResponse<{items:{actor_id:string;email:string;name:string|null;reset_required:boolean}[]}>>('/internal/console/sessions/mfa-reset/targets',{query:{q:operatorQuery}});
    const suppliedKey=readSearchParam(params,'mfa_key'),requestKey=/^[0-9a-f-]{36}$/i.test(suppliedKey)?suppliedKey:randomUUID();
    return <ConsoleWorkspace eyebrow="Protected actions" title="Independent approvals"
        description="Review the exact action, resource, evidence and reason. Requesters cannot approve their own requests.">
        {error && <p role="alert">{error}</p>}
        {targets.error && targets.status !== 403 && <ConsoleApiErrorPanel title="Operator recovery unavailable" message={targets.error} />}
        {!targets.error && <Panel title="Operator authenticator recovery">
            <p>Use an administrator reset for a lost or compromised authenticator. A distinct active platform super admin must independently review it. The affected operator cannot approve their own recovery. Executing recovery for your own account signs you out.</p>
            <form method="get" className="my-4 flex gap-3"><label htmlFor="operator-query">Find operator<Input id="operator-query" name="operator_q" defaultValue={operatorQuery} maxLength={160}/></label><Button type="submit">Find operator</Button></form>
            <ConsoleApprovalForm action="/api/approvals/request-mfa-reset" className="space-y-4">
                <Input unstyled type="hidden" name="request_key" value={requestKey}/>
                <div><label htmlFor="recovery-operator" className="block">Operator</label><select id="recovery-operator" name="operator_id" required defaultValue={selectedOperator} className="block w-full rounded border bg-background p-2">
                    <option value="">Choose an active operator</option>
                    {targets.data?.data.items.map(actor=><option key={actor.actor_id} value={actor.actor_id} disabled={actor.reset_required}>{actor.name?actor.name+' · ':''}{actor.email}{actor.actor_id===session.userId?' · your account':''}{actor.reset_required?' · replacement required':''}</option>)}
                </select></div>
                <div><label htmlFor="recovery-reason" className="block">Recovery reason</label><Textarea id="recovery-reason" name="reason" required minLength={8} maxLength={1000}/></div>
                <Button type="submit">Request operator MFA reset</Button>
            </ConsoleApprovalForm>
        </Panel>}

        {result.error ? <ConsoleApiErrorPanel title="Approvals unavailable" message={result.error} /> : <Panel title="Approval requests">
            {!result.data?.data.approvals.length && <p>No visible approval requests.</p>}
            <ul className="space-y-4">{result.data?.data.approvals.map(approval => <li key={approval.id} className="rounded-lg border p-4">
                <Link href={'/approvals/' + approval.id} className="font-semibold underline">{approval.action} — {approval.resource_id}</Link>
                <p>{approval.reason}</p>
                <p>{approval.consumed_at ? 'Executed' : Date.parse(approval.expires_at) <= Date.now() ? 'Expired' : approval.status}
                    {' · Expires '}{formatDateTime(approval.expires_at)}</p>
            </li>)}</ul>
            <nav aria-label="Approval pages" className="mt-4 flex gap-4">
                {page > 1 && <Link href={'/approvals?page=' + (page - 1)}>Previous</Link>}
                {result.data?.data.has_next && <Link href={'/approvals?page=' + (page + 1)}>Next</Link>}
            </nav>
        </Panel>}
    </ConsoleWorkspace>;
}
