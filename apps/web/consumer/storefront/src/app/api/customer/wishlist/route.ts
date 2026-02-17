// GET/POST/DELETE /api/customer/wishlist — Wishlist CRUD (protected)
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import {
    getCustomerWishlist,
    addToWishlist,
    removeFromWishlist,
} from '@/lib/customer-service';

// GET — Fetch wishlist
export async function GET() {
    try {
        const session = await requireSession();
        const items = await getCustomerWishlist(session.sub!, session.storeId);
        return NextResponse.json({ productIds: items });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ productIds: [] });
        }
        return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
    }
}

// POST — Add to wishlist
export async function POST(request: NextRequest) {
    try {
        const session = await requireSession();
        const { productId, variantId } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        await addToWishlist(session.sub!, session.storeId, productId, variantId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 });
    }
}

// DELETE — Remove from wishlist
export async function DELETE(request: NextRequest) {
    try {
        const session = await requireSession();
        const { productId } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        await removeFromWishlist(session.sub!, productId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
    }
}
