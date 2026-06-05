// POST /api/customer/set-password — Set first password (guest → registered)
import { NextRequest, NextResponse } from 'next/server';
import { createStorefrontApiClient } from '@/lib/api/client';
import { createSession } from '@/lib/session';

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export async function POST(request: NextRequest) {
    try {
        const { action, email, password, storeId, resetToken, resetUrl } = await request.json();

        if (action === 'request_reset') {
            if (!email || !storeId) {
                return NextResponse.json(
                    { error: 'Email and storeId are required' },
                    { status: 400 }
                );
            }

            await createStorefrontApiClient()
                .storefront
                .requestCustomerPasswordReset({
                    store_id: storeId,
                    email,
                    reset_url: resetUrl || null,
                });
            return NextResponse.json({
                success: true,
                accepted: true,
            });
        }

        if (!email || !password || !storeId || !resetToken) {
            return NextResponse.json(
                { error: 'Email, password, storeId, and resetToken are required' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        const { customer } = await createStorefrontApiClient()
            .storefront
            .confirmCustomerPasswordReset({
                store_id: storeId,
                email,
                token: resetToken,
                password,
            });
        if (!customer) {
            return NextResponse.json(
                { error: 'Reset token is invalid or expired' },
                { status: 400 }
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
    } catch (error) {
        console.error('[API] /customer/set-password error:', error);
        return NextResponse.json(
            { error: 'Failed to set password' },
            { status: 500 }
        );
    }
}
