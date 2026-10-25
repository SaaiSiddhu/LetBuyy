import { normalizeStoreRootDomain, buildTenantStorefrontUrl, resolveStorefrontHost } from '@letbuyy/tenant-core'

const DEFAULT_ACCOUNTS_URL = 'https://accounts.letbuyy.com'
const DEFAULT_ADMIN_URL = 'https://admin.letbuyy.com'
const DEFAULT_LOCAL_STOREFRONT_URL = 'http://localhost:3003'
const DEFAULT_THEME_MARKETPLACE_URL = 'https://themes.letbuyy.com'
export function getStorefrontRootDomain(): string {
    return normalizeStoreRootDomain(process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN)
}

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

function appendPath(baseUrl: string, path = ''): string {
    if (!path) return baseUrl
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getAccountsUrl(path = ''): string {
    const baseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_ACCOUNTS_URL || DEFAULT_ACCOUNTS_URL)
    return appendPath(baseUrl, path)
}

export function getAdminUrl(): string {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_ADMIN_URL || DEFAULT_ADMIN_URL)
}

export const MERCHANT_RETURN_PATH_HEADER = 'x-letbuyy-merchant-return-path'

/** Only the configured merchant origin may be resumed after authentication. */
export function getMerchantSignInUrl(requestPath: string | null, fallbackPath = '/stores'): string {
    const base = new URL(getAdminUrl())
    let destination = new URL(fallbackPath, base)
    if (requestPath?.startsWith('/') && !requestPath.startsWith('//')) {
        try {
            const requested = new URL(requestPath, base)
            if (requested.origin === base.origin && !requested.username && !requested.password) destination = requested
        } catch { /* Keep the scoped fallback. */ }
    }
    const login = new URL(getAccountsUrl('/lookup'))
    login.searchParams.set('return_to', destination.toString())
    return login.toString()
}

export function getStorefrontBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim()
    if (configured) return trimTrailingSlash(configured)
    if (process.env.NODE_ENV === 'production') return `https://${getStorefrontRootDomain()}`
    return DEFAULT_LOCAL_STOREFRONT_URL
}

/** Signed editor previews resolve their store from the token and query on the platform host. */
export function getEditorPreviewBaseUrl(): string {
    const base = new URL(getStorefrontBaseUrl())
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
        throw new Error('Invalid storefront preview URL')
    }
    // Keep a loopback listener's port/protocol. A configured buyer subdomain must
    // not make the commerce proxy resolve every editor preview as that buyer.
    if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
        && resolveStorefrontHost(base.hostname, getStorefrontRootDomain(), process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES).kind !== 'root') {
        base.hostname = getStorefrontRootDomain()
    }
    return base.origin
}

export function getStorefrontStoreUrl(subdomain: string): string {
    const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim()
    let baseUrl = configured || (process.env.NODE_ENV === 'production' ? undefined : DEFAULT_LOCAL_STOREFRONT_URL)
    if (configured) {
        const base = new URL(configured)
        if (resolveStorefrontHost(base.hostname, getStorefrontRootDomain()).kind === 'subdomain') {
            // A configured buyer origin belongs to that buyer. Build the requested
            // store against the platform root so the proxy gates the intended tenant.
            base.hostname = getStorefrontRootDomain()
            baseUrl = base.href
        }
    }
    return buildTenantStorefrontUrl(subdomain, {
        rootDomain: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
        rootDomainAliases: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES,
        baseUrl,
    })
}

export function getThemeMarketplaceUrl(path = '/themes'): string {
    const baseUrl = trimTrailingSlash(
        process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL || DEFAULT_THEME_MARKETPLACE_URL
    )
    return appendPath(baseUrl, path)
}
