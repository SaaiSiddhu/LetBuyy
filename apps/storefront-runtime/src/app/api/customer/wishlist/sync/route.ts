// POST /api/customer/wishlist/sync — Sync localStorage wishlist to server on login
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { syncWishlistFromLocal } from '@/lib/customer-service';

export async function POST(request: NextRequest) {
    try {
        const session = await requireSession();
        const { productIds } = await request.json();

        if (!Array.isArray(productIds)) {
            return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 });
        }

        await syncWishlistFromLocal(session.sub!, session.storeId, productIds);
        return NextResponse.json({ success: true, synced: productIds.length });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
