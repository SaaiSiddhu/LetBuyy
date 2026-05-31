// PATCH /api/customer/profile — Update customer profile
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { createStorefrontApiClient } from '@/lib/worker-client';

export async function PATCH(request: NextRequest) {
    try {
        const session = await requireSession();
        const { fullName, phone, acceptsMarketing } = await request.json();

        const updates: Record<string, unknown> = {};
        if (fullName !== undefined) updates.full_name = fullName;
        if (phone !== undefined) updates.phone = phone;
        if (acceptsMarketing !== undefined) updates.accepts_marketing = acceptsMarketing;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        await createStorefrontApiClient().storefront.updateCustomerProfile({
            customer_id: session.sub,
            store_id: session.storeId,
            full_name: updates.full_name as string | null | undefined,
            phone: updates.phone as string | null | undefined,
            accepts_marketing: updates.accepts_marketing as boolean | undefined,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('[API] /customer/profile error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
