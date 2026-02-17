// POST /api/customer/set-password — Set first password (guest → registered)
import { NextRequest, NextResponse } from 'next/server';
import { setCustomerPassword, getCustomerByEmail } from '@/lib/customer-service';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
    try {
        const { email, password, storeId } = await request.json();

        if (!email || !password || !storeId) {
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        await setCustomerPassword(storeId, email, password);

        // Fetch updated customer and auto-login
        const customer = await getCustomerByEmail(storeId, email);
        if (!customer) {
            return NextResponse.json(
                { error: 'Customer not found after password set' },
                { status: 500 }
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
    } catch (error) {
        console.error('[API] /customer/set-password error:', error);
        return NextResponse.json(
            { error: 'Failed to set password' },
            { status: 500 }
        );
    }
}
