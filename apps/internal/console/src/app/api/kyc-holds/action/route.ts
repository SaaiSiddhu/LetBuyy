import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';
import { requireConsoleApiSession } from '@/lib/console-api-auth';
import { CONSOLE_SESSION_COOKIE } from '@/lib/console-session';

const Base = z.object({
    siteId: z.string().uuid(), receiptId: z.string().uuid(), requestKey: z.string().uuid(),
});
const Command = z.discriminatedUnion('action', [
    Base.extend({
        action: z.literal('create'),
        authorityType: z.enum(['court_order', 'statutory', 'provider_contract']),
        authorityReference: z.string().trim().min(8).max(160),
        reason: z.string().trim().min(8).max(1000),
        reviewAt: z.string().datetime({ offset: true }),
        expiresAt: z.string().datetime({ offset: true }),
    }).strict(),
    Base.extend({
        action: z.literal('release'), holdId: z.string().uuid(),
        reason: z.string().trim().min(8).max(1000),
    }).strict(),
]);
const Result = z.object({ success: z.literal(true), data: z.object({
    accepted: z.literal(true), hold_id: z.string().uuid(),
    receipt_id: z.string().uuid(), replayed: z.boolean(),
}) });

export async function POST(request: NextRequest) {
    if (request.headers.get('origin') !== request.nextUrl.origin)
        return NextResponse.json({ error: 'A same-origin Console form is required.' }, { status: 403 });
    const denied = await requireConsoleApiSession(request, { mfa: true });
    if (denied) return denied;
    const parsed = Command.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Complete the exact hold details and try again.' }, { status: 400 });
    const input = parsed.data;
    const path = `/internal/console/kyc/sites/${input.siteId}/receipts/${input.receiptId}/holds`
        + (input.action === 'release' ? `/${input.holdId}/release` : '');
    const body = input.action === 'create'
        ? { authorityType: input.authorityType, authorityReference: input.authorityReference,
            reason: input.reason, reviewAt: input.reviewAt, expiresAt: input.expiresAt,
            requestKey: input.requestKey }
        : { reason: input.reason, requestKey: input.requestKey };
    const result = await fetchConsoleApi<ConsoleDataResponse<unknown>>(path, {
        method: 'POST', body, sessionToken: request.cookies.get(CONSOLE_SESSION_COOKIE)?.value,
    });
    if (result.error) return NextResponse.json({ error: result.error, code: result.code },
        { status: result.status && result.status >= 400 && result.status <= 599 ? result.status : 503 });
    const accepted = Result.safeParse(result.data);
    if (!accepted.success || accepted.data.data.receipt_id !== input.receiptId
        || (input.action === 'release' && accepted.data.data.hold_id !== input.holdId))
        return NextResponse.json({ error: 'The hold result could not be confirmed. Retry with the same request.' }, { status: 503 });
    return NextResponse.json(accepted.data, { headers: { 'Cache-Control': 'private, no-store' } });
}
