const STAGING_ADMIN_URL = 'https://merchant.staging.letbuyy.store'
const PRODUCTION_ADMIN_URL = 'https://admin.letbuyy.store'

export function getAdminUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, '')

    if (!configuredUrl) {
        return process.env.NODE_ENV === 'production' ? PRODUCTION_ADMIN_URL : STAGING_ADMIN_URL
    }

    return configuredUrl
}

export function getAdminDashboardUrl(subdomain: string) {
    return `${getAdminUrl()}/${subdomain}/dashboard`
}
