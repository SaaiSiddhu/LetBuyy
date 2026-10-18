// GET /api/customer/check — retired because public account-existence checks leak customer data.
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(
        { error: 'Account lookup is unavailable. Continue with LetBuyy or choose existing store-account sign-in.' },
        { status: 410, headers: { 'Cache-Control': 'no-store' } },
    );
}
