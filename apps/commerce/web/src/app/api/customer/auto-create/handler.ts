import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/api/client';

type CustomerFromOrderInput = { store_id: string; order_id: string };
type CreateCustomerFromOrder = (input: CustomerFromOrderInput) => Promise<unknown>;

export async function handleAutoCreateCustomer(
    request: NextRequest,
    createCustomer: CreateCustomerFromOrder = (input) => createStorefrontApiClient().storefront.createCustomerFromOrder(input),
) {
    try {
        const { orderId, storeId } = await request.json();

        if (typeof orderId !== 'string' || !orderId.trim() || orderId.length > 100
            || typeof storeId !== 'string' || !storeId.trim() || storeId.length > 100) {
            return NextResponse.json(
                { error: 'orderId and storeId are required' },
                { status: 400 }
            );
        }

        await createCustomer({
            store_id: storeId.trim(),
            order_id: orderId.trim(),
        });

        return NextResponse.json({ success: true });
    } catch {
        // Don't fail — this is a best-effort operation
        return NextResponse.json({ success: false });
    }
}
