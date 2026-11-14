import { NextRequest, NextResponse } from 'next/server';
import { requireConsoleApiSession } from '@/lib/console-api-auth';
import { fetchConsoleApi } from '@/lib/console-api';
import { ConsoleSupportOwnershipSchema } from '@letbuyy/shared-types';
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ segments?: string[] }> },
) {
    const denied = await requireConsoleApiSession(request, { mfa: true });
    if (denied) return denied;
    const { segments = [] } = await params,
        path = segments.join('/');
    if (!/^(?:tickets(?:\/[0-9a-f-]{36})?|assignees)$/i.test(path))
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const result = await fetchConsoleApi('/operations/support/' + path, {
        query: Object.fromEntries(request.nextUrl.searchParams),
    });
    return NextResponse.json(result.data ?? { error: result.error }, {
        status: result.error ? result.status || 503 : 200,
        headers: { 'Cache-Control': 'no-store' },
    });
}
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ segments?: string[] }> },
) {
    const denied = await requireConsoleApiSession(request, { mfa: true });
    if (denied) return denied;
    if (request.headers.get('origin') !== request.nextUrl.origin)
        return NextResponse.json(
            { error: 'Forbidden origin' },
            { status: 403 },
        );
    const { segments = [] } = await params,
        path = segments.join('/');
    if (
        !/^(?:tickets\/[0-9a-f-]{36}\/(?:messages|resolve|escalate)|recovery)$/i.test(
            path,
        )
    )
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const key = request.headers.get('X-Idempotency-Key') || '';
    if (
        key.length < 8 ||
        key.length > 200 ||
        key.trim() !== key ||
        /[\u0000-\u001f\u007f]/.test(key)
    )
        return NextResponse.json(
            { error: 'A stable request key is required.' },
            { status: 400 },
        );
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const result = await fetchConsoleApi('/operations/support/' + path, {
        method: 'POST',
        body,
        idempotencyKey: key,
    });
    return NextResponse.json(result.data ?? { error: result.error }, {
        status: result.error ? result.status || 503 : 200,
        headers: { 'Cache-Control': 'no-store' },
    });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ segments?: string[] }> }) {
    const denied = await requireConsoleApiSession(request, { mfa: true });
    if (denied) return denied;
    if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({error:'Forbidden origin'}, {status:403});
    const path = (await params).segments?.join('/') || '';
    if (!/^tickets\/[0-9a-f-]{36}\/assign$/i.test(path)) return NextResponse.json({error:'Not found'}, {status:404});
    const key=request.headers.get('X-Idempotency-Key') || '';
    if(key.length<8 || key.length>200 || key.trim()!==key || /[\u0000-\u001f\u007f]/.test(key)) return NextResponse.json({error:'A stable request key is required.'},{status:400});
    const body=ConsoleSupportOwnershipSchema.safeParse(await request.json().catch(()=>null));
    if(!body.success)return NextResponse.json({error:'Invalid ticket ownership request.'},{status:400});
    const result=await fetchConsoleApi('/operations/support/'+path,{method:'PATCH',body:body.data,idempotencyKey:key});
    return NextResponse.json(result.data??{error:result.error},{status:result.error?result.status||503:200,headers:{'Cache-Control':'no-store'}});
}
