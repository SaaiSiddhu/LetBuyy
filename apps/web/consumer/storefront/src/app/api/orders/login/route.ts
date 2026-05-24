import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerPassword, getOrdersByContact } from '@/lib/order-service';

export async function POST(request: NextRequest) {
    try {
        const { emailOrPhone, password, subdomain } = await request.json();

        if (!emailOrPhone || !password || !subdomain) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Verify password
        const isValid = await verifyCustomerPassword(emailOrPhone, password, undefined, subdomain);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        // Get orders
        const orders = await getOrdersByContact(subdomain, emailOrPhone);

        return NextResponse.json({
            success: true,
            orders,
        });
    } catch (error) {
        console.error('Error logging in:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}
