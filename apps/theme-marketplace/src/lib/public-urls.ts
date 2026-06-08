function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

function localBrowserPublicUrl(envName: string): string {
    if (typeof window === 'undefined') return ''

    const hostname = window.location.hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') return ''

    const localUrls: Record<string, string> = {
        NEXT_PUBLIC_ACCOUNTS_URL: 'http://127.0.0.1:9001',
        NEXT_PUBLIC_ADMIN_URL: 'http://127.0.0.1:9002',
        NEXT_PUBLIC_STOREFRONT_URL: 'http://127.0.0.1:9007',
    }

    return localUrls[envName] || ''
}

function readRequiredPublicUrl(envName: string, label: string): string {
    const configured = process.env[envName]?.trim() || localBrowserPublicUrl(envName)
    if (!configured) {
        throw new Error(`${envName} is not configured; refusing to use a hardcoded ${label} host`)
    }
    return trimTrailingSlash(configured)
}

export function getAccountsUrl(path = ''): string {
    const baseUrl = readRequiredPublicUrl('NEXT_PUBLIC_ACCOUNTS_URL', 'accounts')
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getAdminUrl(path = ''): string {
    const baseUrl = readRequiredPublicUrl('NEXT_PUBLIC_ADMIN_URL', 'admin')
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getStorefrontUrl(path = ''): string {
    const baseUrl = readRequiredPublicUrl('NEXT_PUBLIC_STOREFRONT_URL', 'storefront')
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildStorefrontPreviewUrl(themePreviewToken: string): string {
    const url = new URL(getStorefrontUrl('/preview'))
    url.searchParams.set('theme_preview_token', themePreviewToken)
    return url.toString()
}
