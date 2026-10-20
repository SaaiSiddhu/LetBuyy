import { getStorefrontRootDomain } from '@/lib/public-urls'
import type { StorePaymentConfig } from '@letbuyy/api-client'

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

export function buildStoreSetupStatus({
    productsTotal,
    shippingZones,
    paymentConfig,
    themeCustomized,
    domainConfigured,
}: {
    productsTotal: number | null
    shippingZones: readonly unknown[] | null
    paymentConfig: StorePaymentConfig | null
    themeCustomized: boolean
    domainConfigured: boolean
}): SetupStatus {
    const shippingCount = shippingZones?.length ?? 0
    return {
        primaryComplete: (productsTotal ?? 0) > 0,
        secondaryComplete: shippingCount > 0,
        themeCustomized,
        domainConfigured,
        paymentConfigured: paymentConfig ? isPaymentConfigured(paymentConfig) : false,
        hasShipping: shippingCount > 0,
        primaryAvailable: productsTotal !== null,
        shippingAvailable: shippingZones !== null,
        paymentAvailable: paymentConfig !== null,
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

export function isPaymentConfigured(config: StorePaymentConfig): boolean {
    if (config.cod_enabled) return true
    if (!config.online_payment_enabled) return false

    const settings = config.payment_settings
    if (settings?.mode === 'shared') return true

    const razorpay = settings?.razorpay
    return Boolean(razorpay?.secret_configured && razorpay?.verified)
}
