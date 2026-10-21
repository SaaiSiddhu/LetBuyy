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
    return appendPath(buildTenantStorefrontUrl(subdomain, {rootDomain: getStorefrontRootDomain(), baseUrl: process.env.NEXT_PUBLIC_STOREFRONT_URL}), path)
}
