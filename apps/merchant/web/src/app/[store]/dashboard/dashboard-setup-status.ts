import { getStorefrontRootDomain } from '@/lib/public-urls'
import type { StoreHealth } from '@letbuyy/shared-types'

export interface SetupStatus {
    primaryComplete: boolean
    secondaryComplete: boolean
    themeCustomized: boolean
    domainConfigured: boolean
    paymentConfigured?: boolean
    hasShipping?: boolean
    primaryAvailable: boolean
    shippingAvailable?: boolean
    paymentAvailable?: boolean
}

export function resolveDashboardDomain({
    subdomain,
    customDomain,
    customDomainStatus,
}: {
    subdomain: string | null | undefined
    customDomain: string | null | undefined
    customDomainStatus: string | null | undefined
}): { domain: string | null; configured: boolean } {
    const activeCustomDomain = customDomainStatus === 'active' ? customDomain?.trim() : ''
    const normalizedSubdomain = subdomain?.trim()
    const defaultDomain = normalizedSubdomain ? `${normalizedSubdomain}.${getStorefrontRootDomain()}` : ''
    const domain = activeCustomDomain || defaultDomain || null

    return { domain, configured: domain !== null }
}

export function buildStoreSetupStatus(health: StoreHealth | null): SetupStatus {
    const check = (id: string) => health?.readiness.checks.find(c => c.id === id)
    return {
        primaryComplete: check('catalog')?.status === 'ready',
        primaryAvailable: Boolean(check('catalog') && check('catalog')?.status !== 'unknown'),
        secondaryComplete: check('shipping')?.status === 'ready',
        themeCustomized: check('theme')?.status === 'ready',
        domainConfigured: check('domain')?.status === 'ready',
        paymentConfigured: check('payments')?.status === 'ready',
        paymentAvailable: Boolean(check('payments') && check('payments')?.status !== 'unknown'),
        shippingAvailable: Boolean(check('shipping') && check('shipping')?.status !== 'unknown'),
        hasShipping: check('shipping')?.status === 'ready',
    }
}

export function buildPageSetupStatus({
    pagesTotal,
    themeCustomized,
    domainConfigured,
}: {
    pagesTotal: number | null
    themeCustomized: boolean
    domainConfigured: boolean
}): SetupStatus {
    return {
        primaryComplete: (pagesTotal ?? 0) > 0,
        secondaryComplete: themeCustomized,
        themeCustomized,
        domainConfigured,
        primaryAvailable: pagesTotal !== null,
    }
}
