import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { MerchantNativeSecretSchema, MerchantNativePurposeSchema, MerchantNativeEnvironmentSchema, merchantNativeCallback } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { getAccountsUrl } from '@/lib/config/urls'
import { validateCsrf } from './csrf'

export const MOBILE_FLOW_COOKIE = new URL(getAccountsUrl()).protocol === 'https:' ? '__Host-lb_merchant_mobile_flow' : 'lb_merchant_mobile_flow'
const FlowSchema = z.object({ requestId: z.uuid(), browserProof: MerchantNativeSecretSchema, purpose: MerchantNativePurposeSchema })
export type MobileFlow = z.infer<typeof FlowSchema>

export class MobileAuthError extends Error {
    constructor(readonly status: number, readonly code: string) { super('Account sign-in could not be completed') }
}
export function mobileEnvironment() {
    const raw = process.env.APP_ENV || process.env.NEXT_PUBLIC_ENV || (process.env.VERCEL_ENV === 'preview' ? 'staging' : process.env.NODE_ENV === 'production' ? 'production' : 'development')
    const environment = MerchantNativeEnvironmentSchema.parse(raw === 'local' || raw === 'test' ? 'development' : raw)
    const origin = new URL(getAccountsUrl())
    if ((process.env.VERCEL_ENV === 'production' && environment !== 'production')
        || (environment !== 'development' && origin.origin !== new URL(merchantNativeCallback('merchant_android', 'android_https', environment)!).origin)
        || (environment === 'development' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) throw new MobileAuthError(503, 'MOBILE_CLIENT_CONFIGURATION_INVALID')
    return environment
}
export function mobileEnabled() {
    return process.env.LETBUYY_MERCHANT_MOBILE_AUTH_ENABLED === 'true'
        || (mobileEnvironment() === 'development' && process.env.LETBUYY_MERCHANT_MOBILE_AUTH_ENABLED !== 'false')
}
export function mobileRandomSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return Buffer.from(bytes).toString('base64url')
}
export function nativeBearer(request: NextRequest): string | undefined {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return undefined
    if (!/^Bearer [A-Za-z0-9._~-]{32,8192}$/.test(authorization)) throw new MobileAuthError(401, 'SESSION_INVALID')
    return authorization.slice(7)
}
export function sameAccountsOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('Origin')
    return !origin || origin === new URL(getAccountsUrl()).origin
}
export function requireMobileBrowser(request: NextRequest) {
    if (!request.headers.get('Origin') || !sameAccountsOrigin(request) || !validateCsrf(request)) throw new MobileAuthError(403, 'REQUEST_DENIED')
}
export async function readMobileFlow(): Promise<MobileFlow | null> {
    const raw = (await cookies()).get(MOBILE_FLOW_COOKIE)?.value
    if (!raw) return null
    try { const parsed = FlowSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : null } catch { return null }
}
export async function writeMobileFlow(flow: MobileFlow | null) {
    ;(await cookies()).set(MOBILE_FLOW_COOKIE, flow ? JSON.stringify(flow) : '', {
        httpOnly: true, secure: new URL(getAccountsUrl()).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: flow ? 900 : 0,
    }) // Intentionally host-only. A browser cookie is never sent to native.
}
export async function mobilePersistence<T>(action: string, body: unknown): Promise<T> {
    const response = await identityApiRequest(`/auth/custom/mobile/${action}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(15000) })
    const payload = await response.json().catch(() => null) as { data?: T; error?: { code?: string } } | null
    if (!response.ok || !payload?.data) throw new MobileAuthError(response.status >= 500 ? 503 : response.status, payload?.error?.code || 'MOBILE_AUTH_INVALID')
    return payload.data
}
/** Called only after fresh credential proof, or the explicit SSO confirmation POST. */
export async function approveMobileFlow(sessionToken: string) {
    const flow = await readMobileFlow()
    if (!flow) return null
    const approved = await mobilePersistence<{ purpose: MobileFlow['purpose'] }>('approve', { requestId: flow.requestId, browserProof: flow.browserProof, sessionToken })
    return { continuation: 'native' as const, redirectTo: approved.purpose === 'create_store' ? '/onboarding' : approved.purpose === 'manage_security' ? '/security' : '/mobile/return' }
}
export function mobileFailure(error: unknown) {
    const failure = error instanceof MobileAuthError ? error : new MobileAuthError(503, 'MOBILE_AUTH_UNAVAILABLE')
    if (!(error instanceof MobileAuthError)) console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'mobile_auth_unavailable' }))
    return NextResponse.json({ error: failure.status >= 500 ? 'Sign-in is temporarily unavailable. Please retry.' : 'This sign-in request is no longer valid. Start again from the LetBuyy app.', code: failure.code }, { status: failure.status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
}
