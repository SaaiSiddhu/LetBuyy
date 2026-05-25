import { NextRequest, NextResponse } from 'next/server';
import { getOrderContactSummary } from '@/lib/order-service';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const contact = searchParams.get('contact');
    const subdomain = searchParams.get('subdomain');

    if (!contact || !subdomain) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        const summary = await getOrderContactSummary(subdomain, contact);

        return NextResponse.json({
            hasOrders: summary.hasOrders,
            hasPassword: summary.hasPassword,
        });
    } catch (error) {
        console.error('Error checking orders:', error);
        return NextResponse.json({ error: 'Failed to check orders' }, { status: 500 });
    }
}
