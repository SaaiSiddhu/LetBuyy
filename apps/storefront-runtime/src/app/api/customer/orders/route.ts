// GET /api/customer/orders — Customer's order history (protected)
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getCustomerOrders } from '@/lib/customer-service';

export async function GET() {
    try {
        const session = await requireSession();
        const orders = await getCustomerOrders(session.storeId, session.email);
        return NextResponse.json({ orders });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('[API] /customer/orders error:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}
