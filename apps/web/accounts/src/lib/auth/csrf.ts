import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const CSRF_SECRET = process.env.CSRF_SECRET || ''

/**
 * Generate a CSRF token using HMAC.
 * The token is: random_nonce.hmac(nonce)
 * This allows server-side verification without database storage.
 */
export function generateCsrfToken(): string {
    const nonce = randomBytes(16).toString('hex')
    const hmac = createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex')
    return `${nonce}.${hmac}`
}

/**
 * Validate a CSRF token by re-computing the HMAC and comparing.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateCsrfToken(cookieToken: string, headerToken: string): boolean {
    if (!cookieToken || !headerToken) return false
    if (cookieToken !== headerToken) return false

    const parts = cookieToken.split('.')
    if (parts.length !== 2) return false

    const [nonce, providedHmac] = parts
    const expectedHmac = createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex')

    try {
        const a = Buffer.from(providedHmac, 'hex')
        const b = Buffer.from(expectedHmac, 'hex')
        return a.length === b.length && timingSafeEqual(a, b)
    } catch {
        return false
    }
}
