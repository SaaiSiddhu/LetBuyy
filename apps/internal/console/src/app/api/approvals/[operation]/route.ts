import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { InternalApprovalDecisionSchema, InternalMerchantApprovalRequestSchema, InternalMoneyApprovalRequestSchema, InternalMoneyResolutionDetailsSchema, InternalSensitiveApprovalSchema, InternalTrustReinstatementRequestSchema, InternalTrustSafetyNoteMetadataSchema, InternalTrustSiteEnforcementSchema } from '@letbuyy/shared-types';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';
import { requireConsoleApiSession } from '@/lib/console-api-auth';
import { CONSOLE_SESSION_COOKIE } from '@/lib/console-session';
import { consoleStepUpReturnPath } from '@/lib/console-step-up';
import {requestConsoleIdentity} from '@/lib/console-identity-client';
import {getConsoleSessionFromCookies,clearConsoleSessionCookie} from '@/lib/console-auth-server';
import { InternalPlatformJobSchema, InternalPlatformJobRecoveryRequestSchema, InternalPlatformJobRecoveryExecuteSchema, InternalPlatformJobRecoveryResultSchema } from '@letbuyy/shared-types';

function wantsJson(request: NextRequest) { return request.headers.get('accept')?.includes('application/json') === true; }
function go(request: NextRequest, path: string) {
    return wantsJson(request) ? NextResponse.json({ redirect_to: path }) : NextResponse.redirect(new URL(path, request.url), 303);
}
function fail(request: NextRequest, path: string, message: string, code?: string, status = 400) {
    if (code === 'STEP_UP_REQUIRED') return go(request, '/mfa?step_up=1&return_to=' + encodeURIComponent(consoleStepUpReturnPath(path.split('?')[0])));
    if (wantsJson(request)) return NextResponse.json({ error: message, code }, { status: status >= 400 && status <= 599 ? status : 503 });
    const target = new URL(path, request.url); target.searchParams.set('error', message);
    return NextResponse.redirect(target, 303);
}
export async function POST(request: NextRequest, context: { params: Promise<{ operation: string }> }) {
    // SameSite cookies do not distinguish a malicious sibling store origin.
    // A normal browser form supplies Origin; missing/cross-origin posts fail
    // before the service credential or any protected action can be reached.
    if (request.headers.get('origin') !== request.nextUrl.origin) {
        return NextResponse.json({ error: 'A same-origin approval form is required.' }, { status: 403 });
    }
    const denied = await requireConsoleApiSession(request, { mfa: true });
    if (denied) return denied;
    const sessionToken = request.cookies.get(CONSOLE_SESSION_COOKIE)?.value;
    const form = await request.formData().catch(() => null), operation = (await context.params).operation;
    if (!form) return NextResponse.json({ error: 'Invalid approval form.' }, { status: 400 });
    if (operation === 'request-job-recovery') {
        const job = z.string().uuid().safeParse(form.get('job_id'));
        const parsed = InternalPlatformJobRecoveryRequestSchema.safeParse({site_id:form.get('site_id'),
            source_fingerprint:form.get('source_fingerprint'),reason:form.get('reason'),request_key:form.get('request_key'),
            expected_session_id:form.get('expected_session_id')});
        if (!job.success || !parsed.success) return fail(request,'/operations','Review the job and provide a clear recovery reason.');
        const result = await fetchConsoleApi<ConsoleDataResponse<{approval:unknown}>>('/internal/console/platform-jobs/'+job.data+'/approvals',
            {method:'POST',body:parsed.data,sessionToken});
        const approval = InternalSensitiveApprovalSchema.safeParse(result.data?.data.approval);
        if (result.error || !approval.success || approval.data.action !== 'platform.job.redrive' || approval.data.resource_id !== job.data) {
            return fail(request,'/operations',result.error || 'The review could not be confirmed. Retry the same form.',result.code,result.status);
        }
        return go(request,'/approvals/'+approval.data.id);
    }
    if(operation==='request-mfa-reset'){
        const target=z.string().uuid().safeParse(form.get('operator_id')),key=z.string().uuid().safeParse(form.get('request_key'));
        if(!target.success||!key.success)return fail(request,'/approvals','Choose an active operator and provide a valid recovery request.');
        const path='/approvals?mfa_target='+target.data+'&mfa_key='+key.data;
        const reason=z.string().trim().min(8).max(1000).safeParse(form.get('reason'));
        if(!reason.success)return fail(request,path,'Provide a clear recovery reason between 8 and 1,000 characters.');
        const result=await requestConsoleIdentity({operation:'request_mfa_reset',current_token:sessionToken,actor_id:target.data,reason:reason.data,request_key:key.data});
        const approval=InternalSensitiveApprovalSchema.safeParse(result.result?.approval);
        if(!result.ok||!approval.success)return fail(request,path,result.error?.message||'The recovery request could not be saved. Retry the same form.',result.error?.code,result.status);
        return go(request,'/approvals/'+approval.data.id);
    }
    if (operation === 'request-trust' || operation === 'enforce-trust') {
        const caseId = z.string().uuid().safeParse(form.get('case_id'));
        if (!caseId.success) return fail(request, '/trust-safety', 'Invalid case identifier.');
        const path = '/trust-safety/' + caseId.data;
        const notes = { operator_note: String(form.get('operator_note') || '').trim() };
        if (operation === 'request-trust') {
            const parsed = InternalTrustReinstatementRequestSchema.safeParse({ action: 'ts.reinstate', resource_id: caseId.data,
                reason: form.get('reason'), request_key: form.get('request_key'), metadata: notes });
            if (!parsed.success) return fail(request, path, 'Provide a clear reason and keep additional notes within 4 KB.');
            const result = await fetchConsoleApi<ConsoleDataResponse<{ approval: unknown }>>('/internal/console/approvals', {
                method: 'POST', body: parsed.data, sessionToken });
            const approval = InternalSensitiveApprovalSchema.safeParse(result.data?.data.approval);
            if (result.error || !approval.success) return fail(request, path + '?request_key=' + parsed.data.request_key,
                result.error || 'The request could not be saved. Retry the same form.', result.code, result.status);
            return go(request, '/approvals/' + approval.data.id);
        }
        const parsed = InternalTrustSiteEnforcementSchema.safeParse({ action: 'suspend_site', reason: form.get('reason'),
            idempotency_key: form.get('enforcement_key'), notify_subject: false, metadata: notes });
        if (!parsed.success || !parsed.data.idempotency_key) return fail(request, path, 'Provide a clear suspension reason and a valid request key.');
        const result = await fetchConsoleApi('/internal/console/trust-safety/cases/' + caseId.data + '/enforce', {
            method: 'POST', body: parsed.data, sessionToken });
        return result.error ? fail(request, path + '?enforcement_key=' + parsed.data.idempotency_key,
            result.error, result.code, result.status) : go(request, path);
    }
    if (operation === 'request') {
        const parsed = InternalMerchantApprovalRequestSchema.safeParse({ action: 'merchant.' + String(form.get('action') || ''),
            resource_id: form.get('merchant_id'), reason: form.get('reason'), request_key: form.get('request_key') });
        if (!parsed.success) return fail(request, '/approvals', 'Choose a merchant action and provide a clear reason.');
        const result = await fetchConsoleApi<ConsoleDataResponse<{ approval: unknown }>>('/internal/console/approvals', {
            method: 'POST', body: parsed.data, sessionToken });
        const approval = InternalSensitiveApprovalSchema.safeParse(result.data?.data.approval);
        if (result.error || !approval.success) return fail(request, '/merchants/' + parsed.data.resource_id + '?request_key=' + parsed.data.request_key + '&action=' + parsed.data.action.split('.')[1],
            result.error || 'The request could not be saved. Retry the same form.', result.code, result.status);
        return go(request, '/approvals/' + approval.data.id);
    }
    if (operation === 'request-money') {
        const parsed = InternalMoneyApprovalRequestSchema.safeParse({ action: 'money.reconciliation.resolve', resource_id: form.get('site_id'),
            reason: form.get('reason'), request_key: form.get('request_key'), payload: { resolution: form.get('resolution'),
                provider_reference: String(form.get('provider_reference') || '').trim() || null,
                suspense_ledger_transaction_id: String(form.get('suspense_ledger_transaction_id') || '').trim() || null } });
        if (!parsed.success) return fail(request, '/money-reconciliation', 'Choose a money resolution and provide a clear reason with valid evidence references.');
        const result = await fetchConsoleApi<ConsoleDataResponse<{ approval: unknown }>>('/internal/console/approvals', {
            method: 'POST', body: parsed.data, sessionToken });
        const approval = InternalSensitiveApprovalSchema.safeParse(result.data?.data.approval);
        if (result.error || !approval.success) return fail(request, '/money-reconciliation?site_id=' + parsed.data.resource_id + '&request_key=' + parsed.data.request_key,
            result.error || 'The request could not be saved. Retry the same form.', result.code, result.status);
        return go(request, '/approvals/' + approval.data.id);
    }
    const id = z.string().uuid().safeParse(form.get('approval_id'));
    if (!id.success) return fail(request, '/approvals', 'Invalid approval identifier.');
    const path = '/approvals/' + id.data;
    if (operation === 'decision') {
        const parsed = InternalApprovalDecisionSchema.safeParse({ decision: form.get('decision'), payload_hash: form.get('payload_hash') });
        if (!parsed.success || (parsed.data.decision !== 'cancel' && form.get('reviewed') !== 'yes')) {
            return fail(request, path, 'Review the resource, action and reason before deciding.');
        }
        const result = await fetchConsoleApi('/internal/console/approvals/' + id.data + '/decision', {
            method: 'POST', body: parsed.data, sessionToken });
        return result.error ? fail(request, path, result.error, result.code, result.status) : go(request, path);
    }
    if (operation === 'execute') {
        const read = await fetchConsoleApi<ConsoleDataResponse<{ approval: unknown }>>('/internal/console/approvals/' + id.data, { sessionToken });
        const approval = InternalSensitiveApprovalSchema.safeParse(read.data?.data.approval);
        if (read.error || !approval.success) return fail(request, path, read.error || 'Approval unavailable.');
        if (approval.data.action === 'platform.job.redrive') {
            const job = InternalPlatformJobSchema.safeParse(approval.data.payload.job);
            const body = InternalPlatformJobRecoveryExecuteSchema.safeParse({approval_id:id.data,site_id:approval.data.site_id,
                reason:approval.data.reason,request_key:approval.data.request_key});
            if (!job.success || !body.success || approval.data.resource_type !== 'platform_queue_job' ||
                job.data.id !== approval.data.resource_id || job.data.site_id !== approval.data.site_id ||
                approval.data.payload.operation !== 'platform.job.redrive' || approval.data.payload.retry_budget !== 1) {
                return fail(request,path,'The reviewed recovery is unavailable.');
            }
            const result = await fetchConsoleApi<ConsoleDataResponse<unknown>>('/internal/console/platform-jobs/'+job.data.id+'/redrive',
                {method:'POST',body:body.data,sessionToken});
            const receipt = InternalPlatformJobRecoveryResultSchema.safeParse(result.data?.data);
            if (result.error || !receipt.success || receipt.data.operation_id !== id.data || receipt.data.job_id !== job.data.id || receipt.data.site_id !== body.data.site_id) {
                return fail(request,path,result.error || 'The recovery receipt could not be confirmed. Retry the same action.',result.code,result.status);
            }
            return go(request,path);
        }
        if(approval.data.action==='operator.mfa.reset'){
            const target=z.string().uuid().safeParse(approval.data.resource_id);
            if(!target.success||approval.data.resource_type!=='platform_operator'||approval.data.site_id!==null)return fail(request,path,'The reviewed operator reset is unavailable.');
            const ownSession=await getConsoleSessionFromCookies(),self=ownSession?.userId===target.data;
            const result=await fetchConsoleApi('/internal/console/sessions/mfa-reset/'+target.data,{method:'POST',body:{approval_id:id.data,reason:approval.data.reason},sessionToken});
            if(result.error)return fail(request,path,result.error,result.code,result.status);
            if(self){await clearConsoleSessionCookie();return go(request,'/login?notice=operator_mfa_reset');}
            return go(request,path);
        }
        if (approval.data.action === 'ts.reinstate') {
            const notes = InternalTrustSafetyNoteMetadataSchema.safeParse(approval.data.payload.note_metadata);
            const caseId = z.string().uuid().safeParse(approval.data.resource_id);
            if (!notes.success || !caseId.success || approval.data.resource_type !== 'ts_case') return fail(request, path, 'The reviewed case is unavailable.');
            const result = await fetchConsoleApi('/internal/console/trust-safety/cases/' + caseId.data + '/reinstate', {
                method: 'POST', body: { approval_id: id.data, reason: approval.data.reason, metadata: notes.data }, sessionToken });
            return result.error ? fail(request, path, result.error, result.code, result.status) : go(request, path);
        }
        if (approval.data.action === 'money.reconciliation.resolve') {
            const details = InternalMoneyResolutionDetailsSchema.safeParse(approval.data.payload.details);
            if (!details.success) return fail(request, path, 'The reviewed money resolution is unavailable.');
            const result = await fetchConsoleApi('/internal/console/money/reconciliation/' + approval.data.site_id + '/resolve', {
                method: 'POST', body: { approval_id: id.data, reason: approval.data.reason, ...details.data }, sessionToken });
            return result.error ? fail(request, path, result.error, result.code, result.status) : go(request, path);
        }
        if (!['merchant.suspend', 'merchant.restore'].includes(approval.data.action)) return fail(request, path, 'Use the original action workflow for this request.');
        const result = await fetchConsoleApi('/internal/console/merchants/' + approval.data.site_id + '/moderation', {
            method: 'POST', body: { approval_id: id.data, action: approval.data.payload.action, reason: approval.data.reason }, sessionToken });
        return result.error ? fail(request, path, result.error, result.code, result.status) : go(request, path);
    }
    return NextResponse.json({ error: 'Unknown approval operation.' }, { status: 404 });
}
