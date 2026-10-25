import { NextRequest, NextResponse } from 'next/server'

function merchantRequestOrigin(request: NextRequest): string | null {
    const { origin, hostname, protocol, port } = request.nextUrl
    const host = request.headers.get('host')
    if (!host || (protocol !== 'http:' && protocol !== 'https:')) return null

    try {
        const actual = new URL(`${protocol}//${host}`)
        // Host is only a binding check, never an independent origin allowlist.
        if (actual.host !== host || actual.username || actual.password || actual.pathname !== '/' || actual.search || actual.hash) return null

        const configured = process.env.NEXT_PUBLIC_ADMIN_URL
        if (configured !== undefined) {
            const admin = new URL(configured)
            if (configured.trim() !== configured || (admin.protocol !== 'http:' && admin.protocol !== 'https:')
                || admin.username || admin.password || admin.pathname !== '/' || admin.search || admin.hash) return null
            if (actual.origin !== admin.origin || protocol !== admin.protocol || port !== admin.port) return null
            // Next's route URL may use localhost while Host retains the public
            // app hostname. Only the exact configured app can restore it.
            if (origin !== admin.origin && hostname !== 'localhost') return null
            return admin.origin
        }

        if (actual.origin === origin) return origin
        // Preserve the existing HTTP literal-loopback compatibility when no
        // configured origin is available. Aliases do not qualify for this path.
        if (protocol === 'http:' && hostname === 'localhost' && actual.port === port
            && (actual.hostname === '127.0.0.1' || actual.hostname === '[::1]')) return actual.origin
    } catch { return null }
    return null
}

/** Transport CSRF/retry guard; Gateway retains live ownership and mutation authority. */
export function validateMerchantMutationRequest(
    request: NextRequest,
    options: { requireKey?: boolean; originMessage?: string; keyMessage?: string } = {},
) {
    const expectedOrigin = merchantRequestOrigin(request)
    if (!request.headers.get('origin') || request.headers.get('origin') !== expectedOrigin) {
        return NextResponse.json({ error: { code: 'FORBIDDEN_ORIGIN', message: options.originMessage ?? 'This change must originate from this merchant app.' } }, { status: 403 })
    }
    const key = request.headers.get('X-Idempotency-Key') || ''
    if (options.requireKey !== false && (key.length < 8 || key.length > 200 || key.trim() !== key || /[\u0000-\u001f\u007f]/.test(key))) {
        return NextResponse.json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: options.keyMessage ?? 'A stable request key is required.' } }, { status: 400 })
    }
    return null
}
