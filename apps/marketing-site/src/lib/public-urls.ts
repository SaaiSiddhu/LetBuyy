function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

type RequiredPublicUrlName = 'NEXT_PUBLIC_ACCOUNTS_URL' | 'NEXT_PUBLIC_MARKETING_URL'
type PublicUrlTarget = 'accounts' | 'marketing'

const PLATFORM_ROOT_DOMAINS = ['letbuyy.com', 'letbuyy.store'] as const
const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com'

const LOCAL_BROWSER_URLS: Record<PublicUrlTarget, string> = {
    accounts: 'http://127.0.0.1:9001',
    marketing: 'http://127.0.0.1:9006',
}

const PUBLIC_URL_ENV_NAMES: Record<PublicUrlTarget, RequiredPublicUrlName> = {
    accounts: 'NEXT_PUBLIC_ACCOUNTS_URL',
    marketing: 'NEXT_PUBLIC_MARKETING_URL',
}

function normalizeOrigin(rawValue: string | undefined): string | null {
    const value = rawValue?.trim()
    if (!value) return null

    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
    try {
        return new URL(withProtocol).origin
    } catch {
        return null
    }
}

function getVercelDeploymentOrigin(): string | null {
    const vercelEnv = process.env.VERCEL_ENV?.trim()
    const productionOrigin = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    const branchOrigin = normalizeOrigin(process.env.VERCEL_BRANCH_URL)
    const deploymentOrigin = normalizeOrigin(process.env.VERCEL_URL)

    if (vercelEnv === 'production') {
        return productionOrigin ?? deploymentOrigin ?? branchOrigin
    }

    return branchOrigin ?? deploymentOrigin ?? productionOrigin
}

function getKnownPlatformRoot(hostname: string): string | null {
    const normalized = hostname.toLowerCase().replace(/^www\./, '')
    return PLATFORM_ROOT_DOMAINS.find((root) => normalized === root || normalized.endsWith(`.${root}`)) ?? null
}

function getBrowserPublicOrigin(target: PublicUrlTarget): string | null {
    if (typeof window === 'undefined') return null

    const { hostname, protocol, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return LOCAL_BROWSER_URLS[target]
    }

    const platformRoot = getKnownPlatformRoot(hostname)
    if (!platformRoot) return target === 'marketing' ? origin : null

    if (target === 'marketing') {
        return `${protocol}//${platformRoot}`
    }

    return `${protocol}//accounts.${platformRoot}`
}

function getConfiguredPlatformRootDomain(): string {
    return (
        process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
        || process.env.PLATFORM_ROOT_DOMAIN?.trim()
        || DEFAULT_PLATFORM_ROOT_DOMAIN
    )
}

function getServerPlatformOrigin(target: PublicUrlTarget): string | null {
    const platformRoot = getConfiguredPlatformRootDomain()
    if (target === 'marketing') return `https://${platformRoot}`
    return `https://accounts.${platformRoot}`
}

function requiredPublicUrl(target: PublicUrlTarget, rawValue: string | undefined): string {
    const value = rawValue?.trim()
    if (value) return value

    const browserOrigin = getBrowserPublicOrigin(target)
    if (browserOrigin) return browserOrigin

    if (target === 'marketing') {
        const vercelOrigin = getVercelDeploymentOrigin()
        if (vercelOrigin) return vercelOrigin
    }

    const serverPlatformOrigin = getServerPlatformOrigin(target)
    if (serverPlatformOrigin) return serverPlatformOrigin

    const name = PUBLIC_URL_ENV_NAMES[target]
    throw new Error(`${name} is not configured; refusing to use a hardcoded platform host`)
}

function optionalPublicUrl(rawValue: string | undefined): string | null {
    const value = rawValue?.trim()
    return value ? trimTrailingSlash(value) : null
}

export function getAccountsUrl(path = ''): string {
    const baseUrl = trimTrailingSlash(requiredPublicUrl('accounts', process.env.NEXT_PUBLIC_ACCOUNTS_URL))
    if (!path) return baseUrl

    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getMarketingSiteUrl(path = ''): string {
    const baseUrl = trimTrailingSlash(requiredPublicUrl('marketing', process.env.NEXT_PUBLIC_MARKETING_URL))
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
