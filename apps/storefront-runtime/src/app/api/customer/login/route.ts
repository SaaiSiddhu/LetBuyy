// POST /api/customer/login — Authenticate with email/password
import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/api/client';
import { createSession } from '@/lib/session';

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export async function POST(request: NextRequest) {
    try {
        const { email, password, storeId, turnstileToken } = await request.json();

        if (!email || !password || !storeId) {
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        const { customer } = await createStorefrontApiClient()
            .storefront
            .verifyCustomerPassword({
                store_id: storeId,
                email,
                password,
                turnstile_token: turnstileToken || null,
            });

        if (!customer) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        const customerId = stringValue(customer.id);
        const customerStoreId = stringValue(customer.store_id || storeId);
        const customerEmail = stringValue(customer.email || email);
        const fullName = stringValue(customer.full_name) || null;

        if (!customerId || !customerStoreId || !customerEmail) {
            return NextResponse.json({ error: 'Invalid customer session response' }, { status: 502 });
        }

        await createSession({
            id: customerId,
            storeId: customerStoreId,
            email: customerEmail,
            fullName,
        });

        return NextResponse.json({
            success: true,
            customer: {
                id: customerId,
                email: customerEmail,
                fullName,
                storeId: customerStoreId,
            },
        });
    } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('disabled')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        console.error('[API] /customer/login error:', error);
        return NextResponse.json(
            { error: 'Login failed' },
            { status: 500 }
        );
    }
}
