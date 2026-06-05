// POST /api/customer/auto-create — Auto-create customer record after checkout
// Called by checkout-client.tsx after successful order placement
import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/api/client';

export async function POST(request: NextRequest) {
    try {
        const { storeId, email, fullName, phone } = await request.json();

        if (!storeId || !email) {
            return NextResponse.json(
                { error: 'storeId and email are required' },
                { status: 400 }
            );
        }

        await createStorefrontApiClient().storefront.findOrCreateCustomer({
            store_id: storeId,
            email,
            full_name: fullName || null,
            phone: phone || null,
        });

        return NextResponse.json({ success: true });
    } catch {
        // Don't fail — this is a best-effort operation
        return NextResponse.json({ success: false });
    }
}
