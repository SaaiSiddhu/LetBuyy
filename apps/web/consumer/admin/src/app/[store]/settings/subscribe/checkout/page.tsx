import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import SubscribeCheckoutClient from './SubscribeCheckoutClient'

/* ——————————————————————————————————————
   Subscribe Checkout Page (Server Component)
   Reads plan from query params, fetches from DB
   URL: /{store}/settings/subscribe/checkout?plan=starter&bp=MONTHLY&site_type=store
   —————————————————————————————————————— */

interface PageProps {
    params: Promise<{ store: string }>
    searchParams: Promise<{ plan?: string; bp?: string; site_type?: string }>
}

export default async function SubscribeCheckoutPage({ params, searchParams }: PageProps) {
    const { store } = await params
    const { plan: planSlug, bp, site_type } = await searchParams

    if (!planSlug) return notFound()

    // Auth
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const siteType = site_type || storeData.site_type || 'store'
    const billingPeriod = bp === 'YEARLY' ? 'yearly' : 'monthly'

    // Fetch the selected plan
    const supabase = await createClient()
    const { data: plan } = await supabase
        .from('plans')
        .select('*')
        .eq('site_type', siteType)
        .eq('slug', planSlug)
        .eq('is_active', true)
        .single()

    if (!plan) return notFound()

    return (
        <SubscribeCheckoutClient
            plan={plan}
            billingPeriod={billingPeriod}
            storeId={storeData.id}
            storeName={storeData.name || storeData.store_name || store}
            storeSlug={store}
            siteType={siteType}
            userEmail={user.email}
            userName={user.fullName || ''}
        />
    )
}
