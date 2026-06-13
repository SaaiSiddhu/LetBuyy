// POST /api/customer/register — Create a shopper account (LB-12). Mirrors /customer/login: calls the
// gateway's token-less first-password register, then re-mints the HS256 customer session locally
// (gateway IDs-only token fails isCustomerSessionPayload). No identity-platform / ES256 involvement.
import { NextRequest, NextResponse } from 'next/server';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createStorefrontApiClient } from '@/lib/api/client';
import { createSession } from '@/lib/session';

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export async function POST(request: NextRequest) {
    try {
        const { email, password, storeId, fullName, turnstileToken } = await request.json();

        if (!email || !password || !storeId) {
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        const { customer } = await createStorefrontApiClient()
            .storefront
            .registerCustomer({
                store_id: storeId,
                email,
                password,
                full_name: typeof fullName === 'string' ? fullName : null,
                turnstile_token: turnstileToken || null,
            });

        if (!customer) {
            return NextResponse.json({ error: 'Registration failed' }, { status: 502 });
        }

        const customerId = stringValue(customer.id);
        const customerStoreId = stringValue(customer.store_id || storeId);
        const customerEmail = stringValue(customer.email || email);
        const name = stringValue(customer.full_name) || null;

        if (!customerId || !customerStoreId || !customerEmail) {
            return NextResponse.json({ error: 'Invalid customer session response' }, { status: 502 });
        }

        await createSession({
            id: customerId,
            storeId: customerStoreId,
            email: customerEmail,
            fullName: name,
        });

        return NextResponse.json({
            success: true,
            customer: { id: customerId, email: customerEmail, fullName: name, storeId: customerStoreId },
        });
    } catch (error: unknown) {
        if (error instanceof LetbuyyApiError) {
            if (error.status === 409 || error.code === 'ACCOUNT_EXISTS') {
                return NextResponse.json(
                    { error: 'An account with this email already exists. Please sign in.', code: 'ACCOUNT_EXISTS' },
                    { status: 409 }
                );
            }
            if (error.status === 403 || error.status === 429 || error.status === 400) {
                const message = error.code === 'CUSTOMER_AUTH_RATE_LIMITED'
                    ? 'Too many attempts. Please try again later.'
                    : error.code === 'TURNSTILE_REQUIRED'
                        ? 'Bot verification failed'
                        : error.message || 'Registration temporarily unavailable';
                return NextResponse.json({ error: message, code: error.code }, { status: error.status });
            }
        }
        console.error('[API] /customer/register error:', error);
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }
}
