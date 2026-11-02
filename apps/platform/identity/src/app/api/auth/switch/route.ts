import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie, getAccounts } from '@/lib/auth/cookies'
import { validateCsrf } from '@/lib/auth/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { readMobileFlow } from '@/lib/auth/mobile'

/** SEC-R10: current session + remembered account are necessary hints, not target
 * credential/MFA proof. Another actor must authenticate through shared Accounts.
 * Preserve the working session until the replacement completes. */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit (SEC-H7): /switch was previously unthrottled.
        const rl = await checkRateLimit('switch', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const parsed = z.object({ email: z.email() }).safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
        const { email } = parsed.data
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }
        const normalizedEmail = email.toLowerCase().trim()

        // SEC-C1 (1/2): require an authenticated current session. You can only
        // switch *away from* an account you are already signed into.
        const currentToken = await getSessionCookie()
        const currentSession = currentToken ? await validateSession(currentToken) : null
        if (!currentToken || !currentSession) {
            return NextResponse.json(
                { error: 'You must be signed in to switch accounts.', redirectTo: '/lookup' },
                { status: 401 }
            )
        }

        // SEC-C1 (2/2): the target must be an account already proven on THIS device,
        // i.e. present in the signed httpOnly lb_accounts cookie. This is the check the
        // prior comment described but never enforced — it is what stops a caller from
        // minting a session for an account they have never authenticated.
        const savedAccounts = await getAccounts()
        const isProvenAccount = savedAccounts.some(
            (a) => a.email.toLowerCase().trim() === normalizedEmail
        )
        if (!isProvenAccount) {
            return NextResponse.json(
                {
                    error: 'That account is not available for quick switch on this device. Please sign in.',
                    redirectTo: `/login?email=${encodeURIComponent(normalizedEmail)}`,
                },
                { status: 403 }
            )
        }

        if (currentSession.email.toLowerCase().trim() !== normalizedEmail) {
            return NextResponse.json({
                error: 'Sign in to this account to complete its current security checks.',
                reauthenticationRequired: true,
                redirectTo: `/login?choose_account=1&email=${encodeURIComponent(normalizedEmail)}`,
            }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } })
        }
        return NextResponse.json({ success: true, redirectTo: await readMobileFlow() ? '/mobile' : '/select' }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'account_switch_unavailable' }))
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
