function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}

type RequiredPublicUrlName = 'NEXT_PUBLIC_ACCOUNTS_URL' | 'NEXT_PUBLIC_MARKETING_URL'

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

function requiredPublicUrl(name: RequiredPublicUrlName, rawValue: string | undefined): string {
    const value = rawValue?.trim()
    if (value) return value

    if (name === 'NEXT_PUBLIC_MARKETING_URL') {
        const vercelOrigin = getVercelDeploymentOrigin()
        if (vercelOrigin) return vercelOrigin
    }

    throw new Error(`${name} is not configured; refusing to use a hardcoded platform host`)
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
