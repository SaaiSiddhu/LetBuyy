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
