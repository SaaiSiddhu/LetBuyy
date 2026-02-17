// POST /api/customer/logout — Clear session cookie
import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function POST() {
    try {
        await clearSession();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] /customer/logout error:', error);
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500 }
        );
    }
}
