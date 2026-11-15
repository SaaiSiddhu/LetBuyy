import { normalizeStoreRootDomain, buildTenantStorefrontUrl } from '@letbuyy/tenant-core'

const PRODUCTION_ADMIN_URL = 'https://admin.letbuyy.com'
const PRODUCTION_ACCOUNTS_URL = 'https://accounts.letbuyy.com'

// Platform account/admin origins stay distinct from the configured tenant storefront root.
const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com'

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

function appendPath(baseUrl: string, path = ''): string {
    if (!path) return baseUrl
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getAdminUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, '')

    if (!configuredUrl) {
        return PRODUCTION_ADMIN_URL
    }

    return configuredUrl
}

export function getAdminDashboardUrl(subdomain: string) {
    return `${getAdminUrl()}/${subdomain}/dashboard`
}

export function getAdminSelectPlanUrl(subdomain: string) {
    return `${getAdminUrl()}/${subdomain}/access_account/checkout/select-plan`
}

export function getAccountsUrl(path = '') {
    const baseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_ACCOUNTS_URL || PRODUCTION_ACCOUNTS_URL)
    return appendPath(baseUrl, path)
}

/** HTTP cookies are allowed only for the explicitly configured local Accounts origin. */
export function isConfiguredLocalAccountsOrigin(origin: string): boolean {
    if (process.env.NEXT_PUBLIC_ENV !== 'development') return false
    try {
        const configured = new URL(getAccountsUrl()), requested = new URL(origin)
        return configured.protocol === 'http:'
            && ['localhost', '127.0.0.1', '[::1]'].includes(configured.hostname)
            && Number(configured.port) >= 1024 && Number(configured.port) <= 65535
            && !configured.username && !configured.password && !configured.search && !configured.hash
            && ['', '/'].includes(configured.pathname)
            // NextURL normalizes loopback IP hosts to localhost. Match that
            // routing normalization only within the configured local port.
            && requested.protocol === 'http:'
            && ['localhost', '127.0.0.1', '[::1]'].includes(requested.hostname)
            && requested.port === configured.port
            && !requested.username && !requested.password && !requested.search && !requested.hash
            && ['', '/'].includes(requested.pathname)
    } catch { return false }
}

/** The configured platform root domain (`letbuyy.com` unless overridden). */
export function getPlatformRootDomain(): string {
    return (
        process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
        || process.env.PLATFORM_ROOT_DOMAIN?.trim()
        || DEFAULT_PLATFORM_ROOT_DOMAIN
    )
}

export function getStorefrontRootDomain(): string {
    return normalizeStoreRootDomain(process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN || process.env.STOREFRONT_ROOT_DOMAIN)
}

/** The public storefront host, distinct from the platform account/admin root. */
export function getStorefrontHost(subdomain: string): string {
    return `${subdomain}.${getStorefrontRootDomain()}`
}

/** The public storefront URL for a store subdomain. */
export function getStorefrontUrl(subdomain: string, path = ''): string {
    return appendPath(buildTenantStorefrontUrl(subdomain, {
        rootDomain: getStorefrontRootDomain(),
        rootDomainAliases: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES,
        baseUrl: process.env.NEXT_PUBLIC_STOREFRONT_URL,
    }), path)
}
