// POST /api/customer/auto-create — Auto-create customer record after checkout
// Called by checkout-client.tsx after successful order placement
import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateCustomer, updateCustomerStats } from '@/lib/customer-service';

export async function POST(request: NextRequest) {
    try {
        const { storeId, email, fullName, phone, orderTotal, orderId } = await request.json();

        if (!storeId || !email) {
            return NextResponse.json(
                { error: 'storeId and email are required' },
                { status: 400 }
            );
        }

        // Find or create the customer
        await findOrCreateCustomer(storeId, email, fullName, phone);

        // Update stats if order info is provided
        if (orderTotal !== undefined && orderTotal !== null && orderId) {
            await updateCustomerStats(storeId, email, Number(orderTotal), orderId);
        }

        return NextResponse.json({ success: true });
    } catch {
        // Don't fail — this is a best-effort operation
        return NextResponse.json({ success: false });
    }
}
