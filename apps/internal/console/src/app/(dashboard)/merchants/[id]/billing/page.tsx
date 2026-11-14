import Link from 'next/link';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { ConsoleBillingQuerySchema, ConsoleBillingWorkspaceSchema } from '@letbuyy/shared-types';
import { Button, Input, Select } from '@letbuyy/ui';
import { ConsoleWorkspace, Panel, MetricGrid, LeadershipMetric, StatusPill } from '@/components/_local-ui/console-workspace';
import { ConsoleApiErrorPanel, ConsoleDataTable, type ConsoleDataColumn } from '@/components/ConsoleDataTable';
import { fetchConsoleApi, formatDateTime, type ConsoleDataResponse } from '@/lib/console-api';
import { formatRecordedMinor } from '@/lib/console-minor';
import type { ConsoleBillingRecord } from '@letbuyy/shared-types';
const sections=[{value:'invoices',label:'Invoice records'},{value:'payments',label:'Payment history'},{value:'renewals',label:'Renewal follow-up'},{value:'mandates',label:'Payment mandates'}];
export default async function MerchantBillingPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
    const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();
    const raw=await searchParams;const first=(key:string)=>Array.isArray(raw[key])?raw[key][0]:raw[key];
    const query=ConsoleBillingQuerySchema.safeParse({page:first('page'),section:first('section'),status:first('status'),invoice_id:first('invoice_id')});
    const result=query.success?await fetchConsoleApi<ConsoleDataResponse<unknown>>('/internal/console/merchants/'+id+'/billing',query.data):{error:'Invalid billing filters.',data:undefined};
    const parsed=ConsoleBillingWorkspaceSchema.safeParse(result.data?.data),data=parsed.success?parsed.data:null;
    const base='/merchants/'+id+'/billing';
    const columns:ConsoleDataColumn<ConsoleBillingRecord>[]=[
        {key:'reference',header:'Record',cell:row=><div><strong>{row.reference}</strong><p className="text-xs text-subdued">{row.provider||'Provider not recorded'}</p></div>},
        {key:'status',header:'Record status',cell:row=><StatusPill value={row.status} />},
        {key:'payment',header:'Payment status',cell:row=><StatusPill value={row.payment_status||'unknown'} />},
        {key:'amount',header:'Recorded amount',cell:row=>formatRecordedMinor(row.amount_minor,row.currency)},
        {key:'period',header:'Dates',cell:row=><div><p>Created {formatDateTime(row.created_at)}</p>{row.period_end&&<p>Period ends {formatDateTime(row.period_end)}</p>}{row.next_attempt_at&&<p>Next attempt {formatDateTime(row.next_attempt_at)}</p>}</div>},
        {key:'evidence',header:'Evidence',cell:row=><div><p className="break-all">{row.provider_reference||'No provider reference recorded'}</p>{row.kind==='invoices'&&<a className="underline" href={'/api/v1/billing/'+id+'/'+row.id}>Download record summary</a>}</div>},
    ];
    return <ConsoleWorkspace eyebrow="Merchant SaaS billing" title={data?(data.site.store_name||data.site.name||'Merchant')+' · Billing':'Merchant billing'} description="Investigate recorded invoices, payments and renewal follow-up alongside the effective SaaS access.">
        <nav aria-label="Merchant billing context" className="flex flex-wrap gap-3"><Link className="console-secondary-button" href={'/merchants/'+id}>Merchant profile</Link><Link className="console-secondary-button" href={'/merchants/'+id+'/operations'}>Store health and access</Link><Link className="console-secondary-button" href={'/support?site_id='+id}>Merchant support</Link><Link className="console-secondary-button" href={'/money-reconciliation?site_id='+id}>Ledger reconciliation</Link></nav>
        {result.error||!data?<ConsoleApiErrorPanel title="Billing evidence unavailable" message={result.error||'Billing evidence could not be verified. Reload to retry.'}/>:<>
            <MetricGrid><LeadershipMetric label="Subscription plan" value={data.subscription?.plan|| (data.unavailable.includes('subscription')?'Unavailable':'No subscription')}/><LeadershipMetric label="Subscription status" value={data.subscription?.status||'Unknown'} /><LeadershipMetric label="Next recorded period end" value={data.subscription?.current_period_end?formatDateTime(data.subscription.current_period_end):'Not recorded'} /><LeadershipMetric label="Effective access plan" value={data.entitlements?.plan||'Unavailable'} /></MetricGrid>
            {data.unavailable.length>0&&<p role="status">Some evidence is unavailable: {data.unavailable.join(', ')}. Payment records do not grant access.</p>}
            <Panel title="Billing records" description={'Observed '+formatDateTime(data.observed_at)+'. Issued invoices, successful payments and effective access are separate facts.'}>
                <form action={base} className="console-filterbar"><Select label="Record type" name="section" defaultValue={data.section} options={sections}/><Input label="Record status" name="status" defaultValue={first('status')||''} placeholder="All statuses" pattern="[a-z_]{1,40}"/><Button type="submit">Apply filters</Button><Link href={base}>Clear filters</Link></form>
                <ConsoleDataTable columns={columns} rows={data.records} getRowKey={row=>row.id} meta={{...data.meta,total_pages:Math.max(1,Math.ceil(data.meta.total/data.meta.per_page))}} basePath={base} query={{section:data.section,status:first('status')}} emptyLabel="No records matched this store and the current filters."/>
            </Panel>
            <Panel title="Help the merchant recover" description="Use the recorded provider reference and renewal evidence when investigating a failed or pending payment."><p>Ask the merchant to open Settings → Billing in their merchant app for the supported checkout, payment recovery or cancellation flow. The merchant confirms any charge through that flow.</p><p>Downloads here are financial record summaries. An issued invoice does not establish a successful payment. Plan changes and billing exceptions require their existing canonical workflow and policy.</p></Panel>
        </>}
    </ConsoleWorkspace>;
}
