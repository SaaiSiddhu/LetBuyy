import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { storefrontApiFetch } from '@/lib/api/client';

const NO_STORE = { 'Cache-Control': 'no-store' };
type SessionReader = typeof getSession;
type ProfileReader = typeof storefrontApiFetch;

/** Read the existing store-customer profile without trusting IDs supplied by the browser. */
export async function customerProfileResponse(
    readSession: SessionReader = getSession,
    readProfile: ProfileReader = storefrontApiFetch,
) {
    try {
        const session = await readSession();
        if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });

        const upstream = await readProfile('/storefront/customer/profile', { cache: 'no-store' });
        if (!upstream.ok) {
            const status = upstream.status === 401 || upstream.status === 403 ? 401
                : upstream.status === 404 ? 404 : 503;
            return NextResponse.json({ error: status === 404 ? 'Customer profile is unavailable' : 'Not authenticated' }, {
                status,
                headers: NO_STORE,
            });
        }

        const payload = await upstream.json() as {
            data?: { customer?: { email?: unknown; full_name?: unknown; phone?: unknown; accepts_marketing?: unknown } };
        };
        const customer = payload.data?.customer;
        if (!customer || typeof customer.email !== 'string') {
            return NextResponse.json({ error: 'Customer profile is unavailable' }, { status: 503, headers: NO_STORE });
        }

        return NextResponse.json({
            customer: {
                email: customer.email,
                full_name: typeof customer.full_name === 'string' ? customer.full_name : null,
                phone: typeof customer.phone === 'string' ? customer.phone : null,
                accepts_marketing: customer.accepts_marketing === true,
            },
        }, { headers: NO_STORE });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
        }
        return NextResponse.json({ error: 'Customer profile is temporarily unavailable' }, { status: 503, headers: NO_STORE });
    }
}
