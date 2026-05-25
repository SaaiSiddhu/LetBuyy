// GET /api/customer/check — Check if customer exists and has a password
import { NextRequest, NextResponse } from 'next/server';
import { checkCustomerStatus } from '@/lib/customer-service';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const storeId = searchParams.get('storeId');

        if (!email || !storeId) {
            return NextResponse.json(
                { error: 'Email and storeId are required' },
                { status: 400 }
            );
        }

        const result = await checkCustomerStatus(storeId, email);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[API] /customer/check error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
