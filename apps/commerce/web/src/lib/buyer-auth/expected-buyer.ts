import { NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';

type BuyerDataSession = { siteId: string; headers: Record<string, string> };

/**
 * Compare a caller's loaded buyer ID with the principal authenticated by the
 * captured storefront token. The value is only a stale-form guard; Gateway
 * authorization continues to come from the signed token and resolved site.
 */
export async function verifyExpectedBuyerIdentity(
    session: BuyerDataSession,
    expectedBuyerId: unknown,
    messages: { missing: string; unavailable: string; changed?: string },
): Promise<NextResponse | null> {
    const noStore = { 'Cache-Control': 'no-store' };
    if (typeof expectedBuyerId !== 'string' || !expectedBuyerId.trim()) {
        return NextResponse.json({ error: messages.missing }, { status: 400, headers: noStore });
    }

    let current: Response;
    try {
        current = await storefrontApiFetch(`/storefront/buyer/profile?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'GET',
            headers: session.headers,
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: messages.unavailable }, { status: 503, headers: noStore });
    }
    if (current.status === 401) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: noStore });
    }
    if (!current.ok) return NextResponse.json({ error: messages.unavailable }, { status: 503, headers: noStore });

    const payload = await current.json().catch(() => null) as { data?: { buyer?: { id?: unknown } } } | null;
    const currentBuyerId = payload?.data?.buyer?.id;
    if (typeof currentBuyerId !== 'string') {
        return NextResponse.json({ error: messages.unavailable }, { status: 503, headers: noStore });
    }
    if (currentBuyerId !== expectedBuyerId) {
        return NextResponse.json({ error: messages.changed ?? 'Your account changed. Reload before saving.' }, { status: 409, headers: noStore });
    }
    return null;
}
