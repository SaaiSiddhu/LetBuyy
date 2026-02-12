import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
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

        const supabase = await createServerClient()
        const { data: user } = await supabase
            .from('users_custom')
            .select('id, password_hash, email_verified')
            .eq('email', normalizedEmail)
            .single()

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
