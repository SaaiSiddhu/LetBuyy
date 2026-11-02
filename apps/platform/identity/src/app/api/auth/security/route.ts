import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { identityApiRequest } from '@/lib/api/client'
import { getSessionCookie, clearSessionCookie } from '@/lib/auth/cookies'
import { validateSession, destroyAllUserSessions } from '@/lib/auth/session'
import { requireMobileBrowser, readMobileFlow, MobileAuthError } from '@/lib/auth/mobile'
import { checkRateLimit } from '@/lib/rate-limit'

const schema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('enroll'), key: z.uuid() }).strict(),
    z.object({ action: z.literal('verify'), key: z.uuid(), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).strict(),
    z.object({ action: z.literal('disable'), key: z.uuid(), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/).optional(), recoveryCode: z.string().trim().min(11).max(40).optional() }).strict(),
    z.object({ action: z.literal('revoke_all'), password: z.string().min(1).max(128), code: z.string().max(16).optional(), recoveryCode: z.string().max(40).optional() }).strict(),
])
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })

export async function GET() {
    try {
        const response = await identityApiRequest('/2fa', { requireSession: true })
        if (!response.ok) return json({ error: 'Account security could not be loaded. Retry.' }, response.status === 401 ? 401 : 503)
        return json({ ...(await response.json() as Record<string, unknown>), nativeFlow: Boolean(await readMobileFlow()) })
    } catch { return json({ error: 'Account security could not be loaded. Retry.' }, 503) }
}

export async function POST(request: NextRequest) {
    try {
        requireMobileBrowser(request)
        const parsed = schema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return json({ error: 'Check your security request and try again.' }, 400)
        const token = await getSessionCookie()
        const session = token ? await validateSession(token) : null
        if (!session) return json({ error: 'Sign in again to manage security.' }, 401)
        const action = parsed.data
        if (action.action === 'revoke_all') {
            const rate = await checkRateLimit('login', request.headers.get('x-forwarded-for') || 'unknown')
            if (!rate.allowed) return json({ error: 'Too many attempts. Please try again later.' }, 429)
            const proof = await identityApiRequest('/auth/custom/users/authenticate', { method: 'POST', body: JSON.stringify({ email: session.email, password: action.password, mfa_code: action.code, recovery_code: action.recoveryCode }) })
            const payload = await proof.json() as { data?: { id: string }; mfa_required?: boolean }
            if (!proof.ok || payload?.data?.id !== session.userId) return json({ error: 'Enter your current password and any required authenticator or recovery code.', mfaRequired: payload?.mfa_required === true }, proof.status >= 500 ? 503 : 403)
            await destroyAllUserSessions(session.userId)
            await clearSessionCookie()
            return json({ success: true, signedOutEverywhere: true })
        }
        const path = action.action === 'enroll' ? '/2fa/totp/enroll' : action.action === 'verify' ? '/2fa/totp/verify' : '/2fa/disable'
        const body = action.action === 'enroll' ? {} : { factor_id: action.factorId, code: action.code, ...(action.action === 'disable' ? { recovery_code: action.recoveryCode } : {}) }
        const response = await identityApiRequest(path, { method: 'POST', requireSession: true, sessionToken: token, headers: { 'X-Idempotency-Key': action.key }, body: JSON.stringify(body) })
        if (!response.ok) return json({ error: 'Security could not be updated. Retry the same action or reload its current state.' }, response.status >= 500 ? 503 : response.status)
        return json(await response.json())
    } catch (error) {
        return json({ error: 'Account security could not be updated. Refresh and retry.' }, error instanceof MobileAuthError ? error.status : 503)
    }
}
