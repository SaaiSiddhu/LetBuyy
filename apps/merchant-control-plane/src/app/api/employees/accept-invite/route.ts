import { NextRequest, NextResponse } from 'next/server'
import { merchantApiFetch } from '@/lib/api/client'

// Phase-5: staff invite acceptance — PUBLIC (pre-auth). The invitee has no merchant
// session yet, so this proxy does NOT resolve store ownership; it forwards the token +
// password straight to the existing gateway endpoint `POST /v1/employees/auth/accept-invite`
// (which validates the invite, creates the Supabase auth user, and inserts the employee row).
export async function POST(request: NextRequest) {
    try {
        const body = (await request.json().catch(() => ({}))) as { token?: unknown; password?: unknown }
        const token = typeof body.token === 'string' ? body.token : ''
        const password = typeof body.password === 'string' ? body.password : ''

        if (!token || !password) {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'token and password are required' } },
                { status: 400 },
            )
        }

        const res = await merchantApiFetch('/employees/auth/accept-invite', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
        })
        const data = await res.json().catch(() => null)
        return NextResponse.json(data ?? { error: { code: 'UNKNOWN', message: 'No response from server' } }, {
            status: res.status,
        })
    } catch {
        return NextResponse.json(
            { error: { code: 'INTERNAL', message: 'Unable to accept the invite. Please try again.' } },
            { status: 500 },
        )
    }
}
