import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'no-store' };
type SessionReader = typeof getSession;

export async function customerSessionResponse(readSession: SessionReader = getSession) {
    try {
        const session = await readSession();

        if (!session) {
            return NextResponse.json({
                authenticated: false,
                customer: null,
            }, { headers: NO_STORE });
        }

        return NextResponse.json({
            authenticated: true,
            customer: {
                id: session.sub,
                storeId: session.storeId,
                email: session.email,
                fullName: session.name,
            },
        }, { headers: NO_STORE });
    } catch {
        return NextResponse.json({
            authenticated: false,
            customer: null,
        }, { headers: NO_STORE });
    }
}
