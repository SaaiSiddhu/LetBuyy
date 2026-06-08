function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

function requiredPublicUrl(name: 'NEXT_PUBLIC_ACCOUNTS_URL' | 'NEXT_PUBLIC_MARKETING_URL', rawValue: string | undefined): string {
    const value = rawValue?.trim()
    if (!value) {
        throw new Error(`${name} is not configured; refusing to use a hardcoded platform host`)
    }
    return value
}

function optionalPublicUrl(rawValue: string | undefined): string | null {
    const value = rawValue?.trim()
    return value ? trimTrailingSlash(value) : null
}

export function getAccountsUrl(path = ''): string {
    const baseUrl = trimTrailingSlash(requiredPublicUrl('NEXT_PUBLIC_ACCOUNTS_URL', process.env.NEXT_PUBLIC_ACCOUNTS_URL))
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getMarketingSiteUrl(path = ''): string {
    const baseUrl = trimTrailingSlash(requiredPublicUrl('NEXT_PUBLIC_MARKETING_URL', process.env.NEXT_PUBLIC_MARKETING_URL))
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getAssetPublicUrl(path = ''): string {
    const baseUrl = optionalPublicUrl(process.env.NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL)
    if (!baseUrl) return path.startsWith('/') ? path : `/${path}`
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getSupportEmail(): string {
    return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@letbuyy.store'
}
