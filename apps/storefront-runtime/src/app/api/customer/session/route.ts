// GET /api/customer/session — Get current session info
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({
                authenticated: false,
                customer: null,
            });
        }

        return NextResponse.json({
            authenticated: true,
            customer: {
                id: session.sub,
                storeId: session.storeId,
                email: session.email,
                fullName: session.name,
            },
        });
    } catch (error) {
        console.error('[API] /customer/session error:', error);
        return NextResponse.json({
            authenticated: false,
            customer: null,
        });
    }
}
