// ============================================================
// CUSTOMER ADDRESSES API — CRUD for saved addresses
// GET    → list addresses
// POST   → add address
// PUT    → update address (pass id in body)
// DELETE → delete address (pass id in body)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createStorefrontApiClient } from '@/lib/api/client';
import { isSameOriginRequest } from '@/lib/buyer-auth/flow';

// ── GET — List all addresses for current customer ──────────
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const query = {
            customer_id: session.sub!,
            store_id: session.storeId,
            customer_email: session.email,
        };
        const payload = await createStorefrontApiClient().storefront.customerAddresses(query);

        return NextResponse.json(payload || { addresses: [] });
    } catch (error) {
        console.error('[API] GET /customer/addresses error:', error);
        return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
    }
}

// ── POST — Add a new address ───────────────────────────────
export async function POST(request: NextRequest) {
    try {
        if (!isSameOriginRequest(request.headers, request.url)) {
            return NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
        }
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            label, full_name, address_line1, address_line2,
            city, state, postal_code, country, landmark, is_default,
        } = body;

        if (!full_name || !address_line1 || !city || !state || !postal_code) {
            return NextResponse.json(
                { error: 'Full name, address, city, state, and postal code are required' },
                { status: 400 }
            );
        }

        const payload = await createStorefrontApiClient().storefront.createCustomerAddress({
            customer_id: session.sub,
            store_id: session.storeId,
            customer_email: session.email,
            customer_phone: body.phone || null,
            label: label || 'home',
            full_name,
            address_line1,
            address_line2: address_line2 || null,
            city,
            state,
            postal_code,
            country: country || 'IN',
            landmark: landmark || null,
            is_default: is_default || false,
        });

        return NextResponse.json(payload, { status: 201 });
    } catch (error) {
        console.error('[API] POST /customer/addresses error:', error);
        return NextResponse.json({ error: 'Failed to add address' }, { status: 500 });
    }
}

// ── PUT — Update an existing address ───────────────────────
export async function PUT(request: NextRequest) {
    try {
        if (!isSameOriginRequest(request.headers, request.url)) {
            return NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
        }
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Address ID is required' }, { status: 400 });
        }

        const payload = await createStorefrontApiClient().storefront.updateCustomerAddress(id, {
            ...updateData,
            customer_id: session.sub,
            store_id: session.storeId,
            customer_email: session.email,
        });

        return NextResponse.json(payload);
    } catch (error) {
        console.error('[API] PUT /customer/addresses error:', error);
        return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
    }
}

// ── DELETE — Remove an address ─────────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        if (!isSameOriginRequest(request.headers, request.url)) {
            return NextResponse.json({ error: 'A same-origin request is required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
        }
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Address ID is required' }, { status: 400 });
        }

        await createStorefrontApiClient().storefront.removeCustomerAddress(id, {
            customer_id: session.sub,
            store_id: session.storeId,
            customer_email: session.email,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] DELETE /customer/addresses error:', error);
        return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
    }
}
