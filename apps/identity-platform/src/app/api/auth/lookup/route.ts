import { NextRequest, NextResponse } from 'next/server'
import { accountWorkerFetch, getAccountWorkerFailureMessage } from '@/lib/api/worker-client'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/auth/lookup
 * Check if an email exists in the system.
 * Returns: { exists: boolean, hasPassword: boolean }
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit
        const rl = await checkRateLimit('lookup', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        const { email } = await request.json()
        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        const response = await accountWorkerFetch('/auth/custom/users/by-email', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
        })
        const payload = await response.json().catch(() => null) as {
            data?: {
                password_hash?: string | null
                email_verified?: boolean | null
            } | null
            error?: {
                code?: string
                message?: string
            }
        } | null

        if (!response.ok) {
            const message = getAccountWorkerFailureMessage(payload, 'Unable to look up account')
            return NextResponse.json({ error: message }, { status: response.status })
        }

        const user = payload?.data

        if (!user) {
            return NextResponse.json({ exists: false, hasPassword: false })
        }

        return NextResponse.json({
            exists: true,
            hasPassword: !!user.password_hash,
            emailVerified: user.email_verified,
        })
    } catch (error) {
        console.error('Lookup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
