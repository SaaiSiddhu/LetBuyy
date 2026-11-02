import { NextRequest } from 'next/server'
import { resolveLetbuyyPlatformCookieNames } from '@letbuyy/auth-core'

/**
 * Validate a CSRF token by comparing the cookie value with the header value.
 * 
 * Security model: The letbuyy_csrf cookie is set with SameSite=strict,
 * so it's only sent on same-origin requests. The client reads it via JS
 * and sends it in the X-CSRF-Token header. An attacker on a different
 * origin cannot read the cookie, so they can't forge the header.
 */
export function validateCsrfToken(cookieToken: string, headerToken: string): boolean {
    if (!cookieToken || !headerToken) return false
    if (cookieToken.length < 16) return false // sanity check
    return cookieToken === headerToken
}

/**
 * Convenience: validate CSRF from a NextRequest.
 * Reads the letbuyy_csrf cookie and the X-CSRF-Token header.
 */
export function validateCsrf(request: NextRequest): boolean {
    const names = resolveLetbuyyPlatformCookieNames(process.env.NEXT_PUBLIC_ENV)
    const cookieToken = request.cookies.get(names.csrf)?.value || request.cookies.get(names.legacyCsrf)?.value || ''
    const headerToken = request.headers.get('X-CSRF-Token') || ''
    return validateCsrfToken(cookieToken, headerToken)
}
