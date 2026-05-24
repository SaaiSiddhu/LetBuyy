const LOCAL_ADMIN_URL = 'http://localhost:3002'
const PRODUCTION_ADMIN_URL = 'https://admin.letbuyy.store'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

export function getAdminUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_ADMIN_URL?.replace(/\/$/, '')

    if (!configuredUrl) {
        return process.env.NODE_ENV === 'production' ? PRODUCTION_ADMIN_URL : LOCAL_ADMIN_URL
    }

    if (process.env.NODE_ENV !== 'production') {
        try {
            const url = new URL(configuredUrl)
            if (LOCAL_HOSTNAMES.has(url.hostname)) {
                return LOCAL_ADMIN_URL
            }
        } catch {
            return LOCAL_ADMIN_URL
        }
    }

    return configuredUrl
}

export function getAdminDashboardUrl(subdomain: string) {
    return `${getAdminUrl()}/${subdomain}/dashboard`
}
