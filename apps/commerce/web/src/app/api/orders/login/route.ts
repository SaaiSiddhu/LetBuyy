import { NextResponse } from 'next/server';

const RETIRED_RESPONSE = {
    error: 'Order history now requires your LetBuyy buyer account.',
};

export function POST() {
    return NextResponse.json(RETIRED_RESPONSE, {
        status: 410,
        headers: { 'Cache-Control': 'no-store' },
    });
}
