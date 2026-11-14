import { Hono } from 'hono';
import { z } from 'zod';
import { ConsoleBillingQuerySchema, ConsoleBillingRecordSchema, ConsoleBillingWorkspaceSchema } from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { bindConsoleOperatorIdentity } from '../../identity-foundation/console-session-repository';
import { consolePermission } from '../../identity-foundation/console-approval-repository';
import { getSupabaseAdmin, paginated, success } from '../../lib/supabase';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { logSensitiveRead } from '../../middleware/rbac';
import { SaasExecutionAdapter } from '../../execution/saas-execution.adapter';
const router=new Hono<{Bindings:Env}>();
const unavailable=()=>new AppError('Billing investigation is temporarily unavailable.',503,'CONSOLE_BILLING_UNAVAILABLE');
type Row=Record<string,unknown>;
const text=(value:unknown)=>typeof value==='string'?value:null;
router.get('/:id/billing',bindConsoleOperatorIdentity,consolePermission('exec:view'),async c=>{
    c.header('Cache-Control','no-store');
    const id=z.string().uuid().safeParse(c.req.param('id')),query=ConsoleBillingQuerySchema.safeParse(c.req.query());
    if(!id.success||!query.success)throw new ValidationError('Invalid merchant billing query.');
    const db=getSupabaseAdmin(c),q=query.data;
    const site=await db.from('sites').select('id,name,store_name').eq('id',id.data).is('deleted_at',null).maybeSingle();
    if(site.error)throw unavailable();if(!site.data)throw new NotFoundError('Merchant not found.');
    const tables={invoices:'merchant_billing_invoices',payments:'billing_history',renewals:'billing_dunning_events',mandates:'billing_mandates'} as const;
    const fields={invoices:'id,site_id,billing_history_id,invoice_number,status,currency,total_minor,period_start,period_end,created_at,billing_history(id,site_id,payment_status,payment_id,payment_gateway)',
        payments:'id,invoice_number,payment_status,total_amount,currency,payment_gateway,payment_id,subscription_id,period_start,period_end,created_at',
        renewals:'id,status,attempt_number,next_attempt_at,billing_history_id,created_at',
        mandates:'id,provider,provider_mode,status,amount_minor,currency,external_mandate_id,created_at'} as const;
    let records=db.from(tables[q.section]).select(fields[q.section],{count:'exact'}).eq('site_id',id.data)
        .order('created_at',{ascending:false}).order('id',{ascending:false}).range((q.page-1)*q.limit,q.page*q.limit-1);
    if(q.section!=='payments')records=records.is('deleted_at',null);
    if(q.status)records=records.eq(q.section==='payments'?'payment_status':'status',q.status);
    if(q.invoice_id)records=records.eq('id',q.invoice_id);
    const [rows,subscription,entitlements]=await Promise.all([
        records,
        db.from('subscriptions').select('id,plan,status,billing_period,current_period_end').eq('site_id',id.data).is('deleted_at',null).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1),
        new SaasExecutionAdapter(db).resolveEntitlements(id.data).catch(()=>null),
    ]);
    if(rows.error)throw unavailable();
    const projected=(rows.data as unknown as Row[]||[]).map(source=>{
        const history=source.billing_history&&typeof source.billing_history==='object'&&!Array.isArray(source.billing_history)?source.billing_history as Row:null;
        if(history&&history.site_id!==id.data)throw unavailable();
        return {id:source.id,kind:q.section,reference:text(source.invoice_number)||String(source.id),status:text(source.status)||text(source.payment_status)||'unknown',
            payment_status:q.section==='invoices'?text(history?.payment_status):q.section==='payments'?text(source.payment_status):null,
            amount_minor:q.section==='invoices'?source.total_minor:q.section==='payments'?source.total_amount:q.section==='mandates'?source.amount_minor:null,
            currency:text(source.currency),provider:text(source.provider)||text(source.payment_gateway)||text(history?.payment_gateway),
            provider_reference:text(source.external_mandate_id)||text(source.payment_id)||text(history?.payment_id),
            related_id:text(source.billing_history_id)||text(source.subscription_id)||null,period_start:text(source.period_start),period_end:text(source.period_end),
            created_at:source.created_at,next_attempt_at:text(source.next_attempt_at)};
    });
    const parsed=ConsoleBillingRecordSchema.array().safeParse(projected);if(!parsed.success)throw unavailable();
    const current=subscription.error?null:subscription.data?.[0]||null;
    const payload=ConsoleBillingWorkspaceSchema.safeParse({observed_at:new Date().toISOString(),site:site.data,subscription:current,
        entitlements:entitlements?.authority==='persisted'?{plan:entitlements.plan,features:entitlements.features,limits:entitlements.limits}:null,
        unavailable:[...(subscription.error?['subscription']:[]),...(entitlements?.authority==='persisted'?[]:['entitlements'])],section:q.section,records:parsed.data,
        meta:paginated([],rows.count||0,q.page,q.limit).meta});
    if(!payload.success)throw unavailable();
    await logSensitiveRead(c,{action:q.format==='csv'?'merchant.billing.export':'merchant.billing.read',resourceType:'site',resourceId:id.data,
        reason:q.format==='csv'?'Operator downloaded an immutable invoice record summary.':'Operator investigated merchant SaaS billing.',metadata:{section:q.section,page:q.page,invoice_id:q.invoice_id||null}});
    return c.json(success(payload.data));
});
export default router;
