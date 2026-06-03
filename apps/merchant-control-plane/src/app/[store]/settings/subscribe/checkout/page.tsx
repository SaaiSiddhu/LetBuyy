import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createMerchantApiClient } from '@/lib/api/client'
import { toSubscriptionPlanView } from '@/lib/billing/plan-ui'
import SubscribeCheckoutClient from './SubscribeCheckoutClient'

/*
   Subscribe Checkout Page (Server Component)
   Reads plan from query params, fetches from DB
   URL: /{store}/settings/subscribe/checkout?plan=starter&bp=MONTHLY&site_type=store
*/

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

    const plans = await createMerchantApiClient().payments.plans({ site_type: siteType, slug: planSlug })
    const plan = plans[0]

    if (!plan) return notFound()

    return (
        <SubscribeCheckoutClient
            plan={toSubscriptionPlanView(plan)}
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
