import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ConsoleBillingWorkspaceSchema } from '@letbuyy/shared-types';
import { requireConsoleApiSession } from '@/lib/console-api-auth';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';
import { consoleCsvCell } from '@/lib/console-csv';
export async function GET(request:NextRequest,{params}:{params:Promise<{siteId:string;invoiceId:string}>}) {
    const denied=await requireConsoleApiSession(request,{mfa:true});if(denied)return denied;
    const scope=z.object({siteId:z.string().uuid(),invoiceId:z.string().uuid()}).safeParse(await params);
    if(!scope.success)return NextResponse.json({error:'Invalid invoice record.'},{status:400});
    const {siteId,invoiceId}=scope.data;
    const result=await fetchConsoleApi<ConsoleDataResponse<unknown>>('/internal/console/merchants/'+siteId+'/billing',{section:'invoices',invoice_id:invoiceId,format:'csv',page:1,limit:1});
    if(result.error)return NextResponse.json({error:result.error},{status:result.status||503,headers:{'Cache-Control':'no-store'}});
    const parsed=ConsoleBillingWorkspaceSchema.safeParse(result.data?.data);
    if(!parsed.success||parsed.data.site.id!==siteId)return NextResponse.json({error:'Invoice record unavailable.'},{status:503});
    const invoice=parsed.data.records[0];if(!invoice||invoice.id!==invoiceId)return NextResponse.json({error:'Invoice record not found.'},{status:404});
    const rows=[['site_id','invoice_id','invoice_number','invoice_status','payment_status','currency','total_minor','period_start','period_end','provider_reference'],[siteId,invoice.id,invoice.reference,invoice.status,invoice.payment_status,invoice.currency,invoice.amount_minor,invoice.period_start,invoice.period_end,invoice.provider_reference]];
    return new NextResponse('\uFEFF'+rows.map(row=>row.map(consoleCsvCell).join(',')).join('\r\n')+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="invoice-record-'+invoiceId+'.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
