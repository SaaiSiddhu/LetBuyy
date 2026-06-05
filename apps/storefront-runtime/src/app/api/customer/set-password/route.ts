// POST /api/customer/set-password — Set first password (guest → registered)
import { NextRequest, NextResponse } from 'next/server';
import { confirmCustomerPasswordReset, requestCustomerPasswordReset } from '@/lib/customer-service';
import { createSession } from '@/lib/session';

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

            await requestCustomerPasswordReset(storeId, email, resetUrl);
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

        const customer = await confirmCustomerPasswordReset(storeId, email, resetToken, password);
        if (!customer) {
            return NextResponse.json(
                { error: 'Reset token is invalid or expired' },
                { status: 400 }
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
