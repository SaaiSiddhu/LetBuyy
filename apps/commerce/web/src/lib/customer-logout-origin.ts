import type { NextRequest } from 'next/server';

/** Allow only the exact resolved storefront origin to trigger the legacy logout POST. */
export function isAllowedCustomerLogoutOrigin(req: Pick<NextRequest, 'headers' | 'url'>): boolean {
    const origin = req.headers.get('origin');
    // No Origin header: same-origin fetch/form in older browsers — allow.
    // (Browsers omit Origin on same-origin navigations; an attacker cannot suppress it on
    // a cross-origin POST without CORS cooperation, which we do not grant.)
    if (!origin) return true;

    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
    const protocol = (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(/:$/, ''))
        .split(',')[0]
        .trim()
        .toLowerCase();
    if (!host || (protocol !== 'http' && protocol !== 'https')) return false;
    try {
        return new URL(origin).origin === `${protocol}://${host}`;
    } catch {
        // Malformed Origin — deny.
    }
    return false;
}
