import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';
import { isAllowedCustomerLogoutOrigin } from '@/lib/customer-logout-origin';

export async function customerLogoutResponse(req: NextRequest, clear: typeof clearSession = clearSession) {
    // CSRF guard: reject cross-origin logout attempts.
    if (!isAllowedCustomerLogoutOrigin(req)) {
        return NextResponse.json({ error: 'CSRF_REJECTED' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    try {
        await clear();
        return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}
