const DEFAULT_ACCOUNTS_URL = 'https://accounts.letbuyy.store'

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

export function getAccountsUrl(path = ''): string {
    const baseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_ACCOUNTS_URL || DEFAULT_ACCOUNTS_URL)
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
