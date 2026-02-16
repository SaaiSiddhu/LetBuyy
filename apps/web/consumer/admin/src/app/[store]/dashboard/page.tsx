import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

export interface SetupStatus {
    primaryComplete: boolean
    secondaryComplete: boolean
    themeCustomized: boolean
    domainConfigured: boolean
    paymentConfigured?: boolean
    hasShipping?: boolean
}

export interface StoreInfo {
    id: string
    name: string
    site_type: SiteType
    theme_id: string
    theme_settings: Record<string, unknown> | null
    custom_domain: string | null
    subdomain: string
    trial_ends_at: string | null
    trial_status: string | null
    status: string
}

/* ——————————————————————————————————————
   Server Component — Data Fetching
   —————————————————————————————————————— */

interface DashboardPageProps {
    params: Promise<{ store: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
    const { store } = await params

    // Auth check (layout already does this, but double-check)
    const user = await getSessionUser()
    if (!user) return notFound()

    // Get store info (layout already fetched this, but we need full data)
    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const supabase = await createClient()

    // Build StoreInfo for the client
    const storeInfo: StoreInfo = {
        id: storeData.id,
        name: storeData.name,
        site_type: storeData.site_type as SiteType,
        theme_id: storeData.theme_id,
        theme_settings: storeData.theme_settings,
        custom_domain: storeData.custom_domain,
        subdomain: storeData.subdomain,
        trial_ends_at: storeData.trial_ends_at,
        trial_status: storeData.trial_status,
        status: storeData.status,
    }

    // Compute setup status server-side
    const themeCustomized =
        (storeData.theme_id && storeData.theme_id !== 'modern') ||
        (storeData.theme_settings && JSON.stringify(storeData.theme_settings) !== '{}')
    const domainConfigured = !!storeData.custom_domain

    let setupStatus: SetupStatus

    if (storeData.site_type === 'store') {
        const [productsResult, shippingResult] = await Promise.all([
            supabase
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('store_id', storeData.id),
            supabase
                .from('shipping_zones')
                .select('id', { count: 'exact', head: true })
                .eq('store_id', storeData.id),
        ])

        setupStatus = {
            primaryComplete: (productsResult.count || 0) > 0,
            secondaryComplete: (shippingResult.count || 0) > 0,
            themeCustomized: !!themeCustomized,
            domainConfigured,
            paymentConfigured: false,
            hasShipping: (shippingResult.count || 0) > 0,
        }
    } else {
        const { count: pagesCount } = await supabase
            .from('pages')
            .select('id', { count: 'exact', head: true })
            .eq('site_id', storeData.id)

        setupStatus = {
            primaryComplete: (pagesCount || 0) > 0,
            secondaryComplete: !!themeCustomized,
            themeCustomized: !!themeCustomized,
            domainConfigured,
        }
    }

    return (
        <DashboardClient
            store={store}
            storeInfo={storeInfo}
            setupStatus={setupStatus}
        />
    )
}
