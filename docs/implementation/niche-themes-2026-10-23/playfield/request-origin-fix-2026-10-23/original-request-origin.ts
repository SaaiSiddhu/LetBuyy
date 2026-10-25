import { NextRequest, NextResponse } from 'next/server'

/** Transport CSRF/retry guard; Gateway retains live ownership and mutation authority. */
export function validateMerchantMutationRequest(
    request: NextRequest,
    options: { requireKey?: boolean; originMessage?: string; keyMessage?: string } = {},
) {
    let expectedOrigin: string | null = request.nextUrl.origin
    // NextURL normalizes literal loopback IPs to localhost. Preserve the actual
    // browser origin only for that narrow case, using Host (never Forwarded).
    if (request.nextUrl.protocol === 'http:' && request.nextUrl.hostname === 'localhost') {
        const host = request.headers.get('host')
        if (host) {
            try {
                const actual = new URL(`http://${host}`)
                if (actual.hostname === '127.0.0.1' || actual.hostname === '[::1]') {
                    expectedOrigin = actual.host === host && actual.port === request.nextUrl.port ? actual.origin : null
                }
            } catch { expectedOrigin = null }
        }
    }
    if (!request.headers.get('origin') || request.headers.get('origin') !== expectedOrigin) {
        return NextResponse.json({ error: { code: 'FORBIDDEN_ORIGIN', message: options.originMessage ?? 'This change must originate from this merchant app.' } }, { status: 403 })
    }
    const key = request.headers.get('X-Idempotency-Key') || ''
    if (options.requireKey !== false && (key.length < 8 || key.length > 200 || key.trim() !== key || /[\u0000-\u001f\u007f]/.test(key))) {
        return NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: options.keyMessage ?? 'A stable request key is required.' } }, { status: 400 })
    }
    return null
}
