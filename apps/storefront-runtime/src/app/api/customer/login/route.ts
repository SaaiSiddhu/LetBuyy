// POST /api/customer/login — Authenticate with email/password
import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerPassword } from '@/lib/customer-service';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
    try {
        const { email, password, storeId, turnstileToken } = await request.json();

        if (!email || !password || !storeId) {
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        const customer = await verifyCustomerPassword(storeId, email, password, turnstileToken);

        if (!customer) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        await createSession({
            id: customer.id,
            storeId: customer.storeId,
            email: customer.email,
            fullName: customer.fullName,
        });

        return NextResponse.json({
            success: true,
            customer: {
                id: customer.id,
                email: customer.email,
                fullName: customer.fullName,
                storeId: customer.storeId,
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
