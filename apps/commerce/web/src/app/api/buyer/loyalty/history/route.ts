// Recent store-funded loyalty ledger entries for the buyer's signed current storefront session.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const unavailable = (status = 503) => NextResponse.json({ error: 'Rewards activity is unavailable right now.' }, { status, headers: NO_STORE });
const ENTRY_TYPES = new Set(['earned', 'redeemed', 'refund_credit', 'expired', 'adjustment_credit', 'adjustment_debit']);

function exactPoints(value: unknown): string | null {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
    return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? value : null;
}

export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/storefront-loyalty/history?store_id=${encodeURIComponent(session.siteId)}&limit=50`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
    } catch {
        return unavailable();
    }
    if (response.status === 401 || response.status === 403) return unavailable(401);
    if (!response.ok) return unavailable();

    const payload = await response.json().catch(() => null) as { data?: unknown } | null;
    if (!Array.isArray(payload?.data)) return unavailable();
    const entries: Array<{ id: string; entryType: string; points: string; balanceAfter: string; createdAt: string }> = [];
    for (const item of payload.data) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return unavailable();
        const row = item as Record<string, unknown>;
        const points = exactPoints(row.points);
        const balanceAfter = exactPoints(row.balance_after);
        if (typeof row.id !== 'string' || !ENTRY_TYPES.has(String(row.entry_type)) || points === null || balanceAfter === null || typeof row.created_at !== 'string') return unavailable();
        entries.push({ id: row.id, entryType: String(row.entry_type), points, balanceAfter, createdAt: row.created_at });
    }
    return NextResponse.json({ entries }, { headers: NO_STORE });
}
