// POST /api/customer/auto-create — Add the server-recorded order contact to store CRM.
// Called by checkout-client.tsx after successful order placement
import { NextRequest, NextResponse } from 'next/server';
import { handleAutoCreateCustomer } from './handler';

export async function POST(request: NextRequest) {
    return handleAutoCreateCustomer(request);
}
