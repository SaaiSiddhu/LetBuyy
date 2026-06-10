function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

type PublicUrlTarget = 'accounts' | 'admin' | 'storefront' | 'themeMarketplace'

const PLATFORM_ROOT_DOMAINS = ['letbuyy.com'] as const
const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com'
const DEFAULT_STOREFRONT_ROOT_DOMAIN = 'letbuyy.com'

const PUBLIC_URL_ENV_NAMES: Record<PublicUrlTarget, string> = {
    accounts: 'NEXT_PUBLIC_ACCOUNTS_URL',
    admin: 'NEXT_PUBLIC_ADMIN_URL',
    storefront: 'NEXT_PUBLIC_STOREFRONT_URL',
    themeMarketplace: 'NEXT_PUBLIC_THEME_MARKETPLACE_URL',
}

const LOCAL_BROWSER_URLS: Record<PublicUrlTarget, string> = {
    accounts: 'http://127.0.0.1:9001',
    admin: 'http://127.0.0.1:9002',
    storefront: 'http://127.0.0.1:9007',
    themeMarketplace: 'http://127.0.0.1:9005',
}

const PLATFORM_SUBDOMAINS: Record<Exclude<PublicUrlTarget, 'storefront'>, string> = {
    accounts: 'accounts',
    admin: 'admin',
    themeMarketplace: 'themes',
}

function getKnownPlatformRoot(hostname: string): string | null {
    const normalized = hostname.toLowerCase().replace(/^www\./, '')
    return PLATFORM_ROOT_DOMAINS.find((root) => normalized === root || normalized.endsWith(`.${root}`)) ?? null
}

function localBrowserPublicUrl(target: PublicUrlTarget): string {
    if (typeof window === 'undefined') return ''

    const hostname = window.location.hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') return ''

    return LOCAL_BROWSER_URLS[target]
}

function getConfiguredPlatformRootDomain(): string {
    return (
        process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
        || process.env.PLATFORM_ROOT_DOMAIN?.trim()
        || DEFAULT_PLATFORM_ROOT_DOMAIN
    )
}

function getConfiguredStorefrontRootDomain(): string {
    return (
        process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN?.trim()
        || process.env.STOREFRONT_ROOT_DOMAIN?.trim()
        || DEFAULT_STOREFRONT_ROOT_DOMAIN
    )
}

function getBrowserPublicOrigin(target: PublicUrlTarget): string {
    if (typeof window === 'undefined') return ''

    const localUrl = localBrowserPublicUrl(target)
    if (localUrl) return localUrl

    const { hostname, protocol } = window.location
    const platformRoot = getKnownPlatformRoot(hostname)
    if (!platformRoot) return ''

    if (target === 'storefront') {
        return `${protocol}//store.${getConfiguredStorefrontRootDomain()}`
    }

    return `${protocol}//${PLATFORM_SUBDOMAINS[target]}.${platformRoot}`
}

function getServerPublicOrigin(target: PublicUrlTarget): string {
    if (target === 'storefront') {
        return `https://store.${getConfiguredStorefrontRootDomain()}`
    }

    return `https://${PLATFORM_SUBDOMAINS[target]}.${getConfiguredPlatformRootDomain()}`
}

function readRequiredPublicUrl(target: PublicUrlTarget, label: string): string {
    const envName = PUBLIC_URL_ENV_NAMES[target]
    const configured = process.env[envName]?.trim() || getBrowserPublicOrigin(target) || getServerPublicOrigin(target)
    if (!configured) {
        throw new Error(`${envName} is not configured; refusing to use a hardcoded ${label} host`)
    }
    return trimTrailingSlash(configured)
}

export function getAccountsUrl(path = ''): string {
    const baseUrl = readRequiredPublicUrl('accounts', 'accounts')
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getAdminUrl(path = ''): string {
    const baseUrl = readRequiredPublicUrl('admin', 'admin')
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getThemeMarketplaceUrl(path = ''): string {
    const baseUrl = readRequiredPublicUrl('themeMarketplace', 'theme marketplace')
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getStorefrontUrl(path = ''): string {
    const baseUrl = readRequiredPublicUrl('storefront', 'storefront')
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildStorefrontPreviewUrl(themePreviewToken: string): string {
    const url = new URL(getStorefrontUrl('/preview'))
    url.searchParams.set('theme_preview_token', themePreviewToken)
    return url.toString()
}
