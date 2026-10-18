import { NextRequest, NextResponse } from 'next/server'

/** Transport CSRF/retry guard; Gateway retains live ownership and mutation authority. */
export function validateMerchantMutationRequest(
    request: NextRequest,
    options: { requireKey?: boolean; originMessage?: string; keyMessage?: string } = {},
) {
    if (!request.headers.get('origin') || request.headers.get('origin') !== request.nextUrl.origin) {
        return NextResponse.json({ error: { code: 'FORBIDDEN_ORIGIN', message: options.originMessage ?? 'This change must originate from this merchant app.' } }, { status: 403 })
    }
    const key = request.headers.get('X-Idempotency-Key') || ''
    if (options.requireKey !== false && (key.length < 8 || key.length > 200 || key.trim() !== key || /[\u0000-\u001f\u007f]/.test(key))) {
        return NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: options.keyMessage ?? 'A stable request key is required.' } }, { status: 400 })
    }
    return null
}
