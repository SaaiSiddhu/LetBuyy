import { normalizeStoreRootDomain, buildTenantStorefrontUrl } from '@letbuyy/tenant-core'

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

export function getStorefrontBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim()
    if (configured) return trimTrailingSlash(configured)
    if (process.env.NODE_ENV === 'production') return `https://${getStorefrontRootDomain()}`
    return DEFAULT_LOCAL_STOREFRONT_URL
}

export function getStorefrontStoreUrl(subdomain: string): string {
    const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.trim()
    return buildTenantStorefrontUrl(subdomain, {
        rootDomain: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
        baseUrl: configured || (process.env.NODE_ENV === 'production' ? undefined : DEFAULT_LOCAL_STOREFRONT_URL),
    })
}

export function getThemeMarketplaceUrl(path = '/themes'): string {
    const baseUrl = trimTrailingSlash(
        process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL || DEFAULT_THEME_MARKETPLACE_URL
    )
    return appendPath(baseUrl, path)
}
