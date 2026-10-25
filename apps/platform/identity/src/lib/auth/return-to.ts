import { getAdminUrl } from '../config/urls'

/** Preserve approved platform navigation through login/signup/password steps. */
export function safePlatformReturnTo(value: string | null | undefined): string | null {
    if (!value) return null
    try {
        const url = new URL(value)
        if (url.username || url.password) return null
        const configuredOrigin = [getAdminUrl(), process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL].some(value => {
            if (!value) return false
            try {
                const configured = new URL(value)
                if (configured.username || configured.password) return false
                const configuredLocal = ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname)
                    || configured.hostname.endsWith('.localhost')
                return url.origin === configured.origin && (url.protocol === 'https:' || (configuredLocal && url.protocol === 'http:'))
            } catch { return false }
        })
        const platform = url.protocol === 'https:' && (url.hostname === 'letbuyy.com' || url.hostname.endsWith('.letbuyy.com'))
        return configuredOrigin || platform ? url.toString() : null
    } catch { return null }
}
export function authPathWithReturnTo(path: string, returnTo: string | null | undefined): string {
    const safe = safePlatformReturnTo(returnTo)
    if (!safe) return path
    const url = new URL(path, 'https://accounts.letbuyy.com')
    url.searchParams.set('return_to', safe)
    return url.pathname + url.search + url.hash
}
