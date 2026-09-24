import { NextResponse } from 'next/server'

// Phase N3: the gateway endpoint this proxy forwarded to
// (POST /v1/employees/auth/accept-invite) is removed -- it never had a
// working completion path (see the Phase N3 report). Fails closed with an
// explicit, honest response rather than proxying to a route that no longer
// exists (ANTI-R9: a stub must never read as success).
export async function POST() {
    return NextResponse.json(
        {
            error: {
                code: 'STAFF_INVITE_UNAVAILABLE',
                message: 'Staff self-service invite activation is not available.',
            },
        },
        { status: 503 },
    )
}
