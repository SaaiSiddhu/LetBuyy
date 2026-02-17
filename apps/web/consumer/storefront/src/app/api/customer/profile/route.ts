// PATCH /api/customer/profile — Update customer profile
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { db } from '@/lib/supabase';

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

        const { error } = await db
            .from('store_customers')
            .update(updates)
            .eq('id', session.sub)
            .eq('store_id', session.storeId);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('[API] /customer/profile error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
