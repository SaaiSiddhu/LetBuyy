// GET/POST/DELETE /api/customer/wishlist — Wishlist CRUD (protected)
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { createStorefrontApiClient } from '@/lib/api/client';

// GET — Fetch wishlist
export async function GET() {
    try {
        const session = await requireSession();
        const payload = await createStorefrontApiClient()
            .storefront
            .customerWishlist({
                customer_id: session.sub!,
                store_id: session.storeId,
            });
        const items = Array.isArray(payload.product_ids) ? payload.product_ids : [];
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

        await createStorefrontApiClient()
            .storefront
            .addCustomerWishlistItem({
                customer_id: session.sub!,
                store_id: session.storeId,
                product_id: productId,
                variant_id: variantId || null,
            });
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

        await createStorefrontApiClient()
            .storefront
            .removeCustomerWishlistItem({
                customer_id: session.sub!,
                store_id: session.storeId,
                product_id: productId,
            });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
    }
}
