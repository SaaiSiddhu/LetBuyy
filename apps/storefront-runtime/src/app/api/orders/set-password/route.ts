import { NextRequest, NextResponse } from 'next/server';
import { setCustomerPassword, getOrdersByContact } from '@/lib/order-service';

export async function POST(request: NextRequest) {
    try {
        const { emailOrPhone, password, subdomain } = await request.json();

        if (!emailOrPhone || !password || !subdomain) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        if (password.length < 4) {
            return NextResponse.json({ error: 'Password too short' }, { status: 400 });
        }

        // Set password
        await setCustomerPassword(emailOrPhone, password, undefined, subdomain);

        // Get orders
        const orders = await getOrdersByContact(subdomain, emailOrPhone);

        return NextResponse.json({
            success: true,
            orders,
        });
    } catch (error) {
        console.error('Error setting password:', error);
        return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
    }
}
