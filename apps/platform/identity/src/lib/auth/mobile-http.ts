import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { MerchantNativeRequestSchema, MerchantNativeExchangeSchema, MerchantNativeCancelSchema, MerchantNativeSecretSchema, merchantNativeCallback, merchantNativeHash } from '@letbuyy/auth-core'
import { getAccountsUrl } from '@/lib/config/urls'
import { checkRateLimit } from '@/lib/rate-limit'
import { getSessionCookie } from './cookies'
import { createIdentityIssuedMerchantSessionToken, prepareIdentitySigningKey } from './identity-issued-session'
import { mobileEnvironment, mobileEnabled, mobilePersistence, mobileRandomSecret, nativeBearer, sameAccountsOrigin, requireMobileBrowser, readMobileFlow, writeMobileFlow, approveMobileFlow, MobileAuthError, mobileFailure } from './mobile'

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
async function input<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.infer<T>> {
    const raw = await request.text()
    if (raw.length > 16384) throw new MobileAuthError(413, 'INVALID_INPUT')
    let value: unknown
    try { value = JSON.parse(raw) } catch { throw new MobileAuthError(400, 'INVALID_INPUT') }
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw new MobileAuthError(400, 'INVALID_INPUT')
    return parsed.data
}
export async function merchantMobileHttp(action: 'requests' | 'bind' | 'approve' | 'complete' | 'exchange' | 'cancel' | 'abandon', request: NextRequest) {
    try {
        if (!sameAccountsOrigin(request)) throw new MobileAuthError(403, 'REQUEST_DENIED')
        // Existing requests can finish while creation is disabled for a drain/rollback.
        if (action === 'requests' && !mobileEnabled()) throw new MobileAuthError(503, 'MOBILE_AUTH_DISABLED')
        if (['requests', 'exchange'].includes(action)) {
            const rate = await checkRateLimit('merchant-mobile', request.headers.get('x-forwarded-for') || 'unknown')
            if (!rate.allowed) return json({ error: 'Too many sign-in attempts. Please try again later.', code: 'RATE_LIMITED', retryAfter: rate.retryAfter }, 429)
        }
        if (action === 'requests') {
            const data = await input(request, MerchantNativeRequestSchema)
            if (data.environment !== mobileEnvironment() || !merchantNativeCallback(data.clientId, data.callbackId, data.environment)) throw new MobileAuthError(400, 'MOBILE_CLIENT_INVALID')
            const requestId = crypto.randomUUID(), launchProof = mobileRandomSecret(), managementProof = mobileRandomSecret()
            const result = await mobilePersistence<{ expiresAt: string }>('requests', { ...data, id: requestId, launchHash: await merchantNativeHash(launchProof), managementHash: await merchantNativeHash(managementProof), sessionToken: nativeBearer(request) })
            const url = new URL('/mobile/authorize', getAccountsUrl())
            // Fragment never reaches access logs, referrers or a server GET.
            url.hash = new URLSearchParams({ request: requestId, launch: launchProof }).toString()
            return json({ requestId, authorizationUrl: url.toString(), managementProof, expiresAt: result.expiresAt }, 201)
        }
        if (action === 'exchange') {
            const data = await input(request, MerchantNativeExchangeSchema)
            if (data.environment !== mobileEnvironment() || !merchantNativeCallback(data.clientId, data.callbackId, data.environment)) throw new MobileAuthError(400, 'MOBILE_CLIENT_INVALID')
            await prepareIdentitySigningKey() // Before any consumption or session registration.
            const context = await mobilePersistence<{ userId: string }>('exchange', data)
            const token = await createIdentityIssuedMerchantSessionToken({ userId: context.userId })
            if (!token) throw new MobileAuthError(503, 'IDENTITY_ISSUER_REQUIRED')
            const result = await mobilePersistence<{ sessionId: string; userId: string; expiresAt: string; siteId: string | null }>('exchange', { ...data, token })
            return json({ token, ...result }) // HTTPS body only; never a redirect or a cookie copy.
        }
        if (action === 'cancel') {
            const data = await input(request, MerchantNativeCancelSchema)
            return json(await mobilePersistence('cancel', data))
        }
        requireMobileBrowser(request)
        if (action === 'abandon') {
            await writeMobileFlow(null)
            return json({ redirectTo: '/lookup' })
        }
        if (action === 'bind') {
            const data = await input(request, z.object({ requestId: z.uuid(), launchProof: MerchantNativeSecretSchema }).strict())
            const existing = await readMobileFlow()
            const browserProof = existing?.requestId === data.requestId ? existing.browserProof : mobileRandomSecret()
            const result = await mobilePersistence<{ purpose: 'login' | 'signup' | 'create_store' | 'switch_account' | 'manage_security' }>('bind', { ...data, browserProof })
            await writeMobileFlow({ requestId: data.requestId, browserProof, purpose: result.purpose })
            return json({ redirectTo: '/mobile' })
        }
        const sessionToken = await getSessionCookie()
        if (!sessionToken) throw new MobileAuthError(401, 'SESSION_INVALID')
        if (action === 'approve') return json(await approveMobileFlow(sessionToken))
        const data = await input(request, z.object({ siteId: z.uuid().optional() }).strict())
        const flow = await readMobileFlow()
        if (!flow) throw new MobileAuthError(400, 'MOBILE_AUTH_INVALID')
        const code = mobileRandomSecret()
        const result = await mobilePersistence<{ redirectUri: string; state: string; requestId: string; environment: 'development' | 'staging' | 'production'; clientId: string; callbackId: string }>('complete', { requestId: flow.requestId, browserProof: flow.browserProof, sessionToken, codeHash: await merchantNativeHash(code), siteId: data.siteId })
        if (result.redirectUri !== merchantNativeCallback(result.clientId, result.callbackId, result.environment)) throw new MobileAuthError(400, 'MOBILE_CLIENT_INVALID')
        const callback = new URL(result.redirectUri)
        callback.search = new URLSearchParams({ request: result.requestId, state: result.state, code }).toString()
        await writeMobileFlow(null)
        return json({ callback: callback.toString() })
    } catch (error) { return mobileFailure(error) }
}
