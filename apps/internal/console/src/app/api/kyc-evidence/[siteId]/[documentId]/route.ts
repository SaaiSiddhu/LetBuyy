import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consoleApiBaseUrl } from '@/lib/console-api';
import { requireConsoleApiSession } from '@/lib/console-api-auth';
import { CONSOLE_SESSION_COOKIE } from '@/lib/console-session';

const RequestSchema = z.object({
    siteId: z.string().uuid(),
    documentId: z.string().uuid(),
    reason: z.string().trim().min(8).max(1000),
});

export async function GET(request: NextRequest, context: {
    params: Promise<{ siteId: string; documentId: string }>;
}) {
    const unauthorized = await requireConsoleApiSession(request, { mfa: true });
    if (unauthorized) return unauthorized;
    const params = await context.params;
    const parsed = RequestSchema.safeParse({ ...params, reason: request.nextUrl.searchParams.get('reason') });
    if (!parsed.success) return NextResponse.json({ error: 'A valid review reason is required.' }, { status: 400 });
    const bridgeToken = process.env.PLATFORM_CONSOLE_API_TOKEN;
    const sessionToken = request.cookies.get(CONSOLE_SESSION_COOKIE)?.value;
    if (!bridgeToken || !sessionToken)
        return NextResponse.json({ error: 'Console evidence access is unavailable.' }, { status: 503 });
    const { siteId, documentId, reason } = parsed.data;
    const url = `${consoleApiBaseUrl()}/internal/console/kyc/sites/${siteId}/documents/${documentId}/file?reason=${encodeURIComponent(reason)}`;
    let upstream: Response;
    try {
        upstream = await fetch(url, {
            headers: { Authorization: `Bearer ${bridgeToken}`, 'X-Platform-Console-Session': sessionToken },
            cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15_000),
        });
    } catch {
        return NextResponse.json({ error: 'Private evidence is temporarily unavailable.' }, { status: 503 });
    }
    if (!upstream.ok || !upstream.body)
        return NextResponse.json({ error: 'Private evidence cannot be downloaded.' },
            { status: [400, 401, 403, 404, 409, 503].includes(upstream.status) ? upstream.status : 503 });
    const contentType = upstream.headers.get('content-type');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(contentType || ''))
        return NextResponse.json({ error: 'Private evidence has an unsupported type.' }, { status: 503 });
    const extension = contentType === 'application/pdf' ? 'pdf' : contentType === 'image/jpeg' ? 'jpg' : 'png';
    return new Response(upstream.body, { headers: {
        'Content-Type': contentType!,
        'Content-Disposition': `attachment; filename="kyc-evidence.${extension}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': 'sandbox',
    } });
}
