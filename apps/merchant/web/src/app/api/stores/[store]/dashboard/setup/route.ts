import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStore } from '@/lib/stores/resolve-owned-store'
import { isPaymentConfigured, resolveDashboardDomain } from '@/app/[store]/dashboard/dashboard-setup-status'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStore(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const apiClient = createMerchantApiClient()
        const site = resolved.store
        const themeSettings = site && 'theme_settings' in site ? site.theme_settings : null
        const isStore = !site || site.site_type === 'store'
        const [productsPayload, shippingPayload, pagesPayload, paymentConfig] = await Promise.all([
            isStore ? apiClient.products.listSummary({ store_id: resolved.storeId, limit: 1 }).catch(() => null) : null,
            isStore ? apiClient.shipping.zones.list({ store_id: resolved.storeId, limit: 1 }).catch(() => null) : null,
            !isStore ? apiClient.pages.list({ store_id: resolved.storeId, limit: 1 }).catch(() => null) : null,
            isStore ? apiClient.stores.paymentConfig.get(resolved.storeId).catch(() => null) : null,
        ])

        return NextResponse.json({
            data: {
                productsCount: productsPayload?.total ?? null,
                shippingZonesCount: shippingPayload?.length ?? null,
                pagesCount: pagesPayload?.total ?? null,
                paymentConfigured: paymentConfig ? isPaymentConfigured(paymentConfig) : null,
                themeCustomized: site ? Boolean((site.theme_id && site.theme_id !== 'modern') || (themeSettings && typeof themeSettings === 'object' && Object.keys(themeSettings).length > 0)) : null,
                domainConfigured: site ? resolveDashboardDomain({ subdomain: site.subdomain, customDomain: site.custom_domain, customDomainStatus: site.custom_domain_status }).configured : null,
                published: site ? site.status === 'published' : null,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load dashboard setup data')
    }
}
