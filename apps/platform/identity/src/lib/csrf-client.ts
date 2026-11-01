/**
 * Client-side utility to read the CSRF token from the letbuyy_csrf cookie.
 * Used by all client-side fetch() calls to include the X-CSRF-Token header.
 */

/**
 * Get the CSRF token from the letbuyy_csrf cookie.
 */
export function getCsrfToken(): string {
    if (typeof document === 'undefined') return ''
    const match = document.cookie.match(/(?:^|;\s*)letbuyy_csrf=([^;]*)/)
        || document.cookie.match(/(?:^|;\s*)lb_csrf=([^;]*)/)
    try {
        return match ? decodeURIComponent(match[1]) : ''
    } catch {
        return ''
    }
}

let renewal: Promise<void> | null = null

async function ensureCsrfCookie(): Promise<void> {
    if (typeof document === 'undefined' || getCsrfToken().length >= 16) return
    if (!renewal) {
        renewal = (async () => {
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 8_000)
            try {
                // Reuse the existing public-page proxy's host-only, one-hour cookie
                // issuance. A cached/open form can outlive that cookie. HEAD sends
                // no password, OTP or mutation body and never replays an auth action.
                const response = await fetch('/lookup', {
                    method: 'HEAD', cache: 'no-store', credentials: 'same-origin',
                    mode: 'same-origin', redirect: 'error', signal: controller.signal,
                })
                if (!response.ok || getCsrfToken().length < 16) {
                    throw new Error('Security verification expired. Refresh this page and try again.')
                }
            } finally {
                clearTimeout(timer)
            }
        })().finally(() => { renewal = null })
    }
    await renewal
}

/**
 * Get headers for a fetch request, including CSRF token.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
    await ensureCsrfCookie()
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken(),
    }
}
