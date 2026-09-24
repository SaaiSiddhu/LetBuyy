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
    return match ? decodeURIComponent(match[1]) : ''
}

/**
 * Get headers for a fetch request, including CSRF token.
 */
export function getAuthHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken(),
    }
}
