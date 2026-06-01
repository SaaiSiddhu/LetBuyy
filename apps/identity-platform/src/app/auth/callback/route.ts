import { NextResponse } from 'next/server'

/**
 * GET /auth/callback
 * OAuth callback handler placeholder while provider OAuth is owned by the gateway.
 */
export async function GET(request: Request) {
    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/lookup?error=oauth_unavailable`)
}
