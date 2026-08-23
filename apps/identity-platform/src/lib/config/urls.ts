import { normalizeStoreRootDomain } from '@letbuyy/tenant-core'

const PRODUCTION_ADMIN_URL = 'https://admin.letbuyy.com'
const PRODUCTION_ACCOUNTS_URL = 'https://accounts.letbuyy.com'

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

// DEPLOY-R3: letbuyy.com is the one canonical platform domain — no other
// apex is a valid functional literal here. Shares the same env-overridable
// resolver (NEXT_PUBLIC_STORE_ROOT_DOMAIN, defaulting to letbuyy.com)
// already used by api-gateway and storefront-runtime for the storefront
// root domain.
export function getStorefrontRootDomain() {
    return normalizeStoreRootDomain(process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN)
}

export function getStorefrontUrl(subdomain: string) {
    return `https://${subdomain}.${getStorefrontRootDomain()}`
}
