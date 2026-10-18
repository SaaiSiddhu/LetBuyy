import { notFound, redirect } from 'next/navigation'
import type { SubscriptionPlan } from '@letbuyy/shared-types'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createMerchantApiClient } from '@/lib/api/client'
import { toSubscriptionPlanView } from '@/lib/billing/plan-ui'
import CheckoutClient from './CheckoutClient'

/* ——————————————————————————————————————
   Subscribe Checkout Page (Server Component)
   Full-screen checkout — matches the Select Plan shell.
   URL: /{store}/access_account/checkout/checkout?plan=growth&bp=MONTHLY&site_type=store
   —————————————————————————————————————— */

interface PageProps {
    params: Promise<{ store: string }>
    searchParams: Promise<{ plan?: string; bp?: string; site_type?: string }>
}

export default async function CheckoutPage({ params, searchParams }: PageProps) {
    const { store } = await params
    const { plan: planSlug, bp, site_type } = await searchParams

    // Auth
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const siteType = site_type || storeData.site_type || 'store'
    const billingPeriod = bp === 'YEARLY' ? 'yearly' : 'monthly'

    let plan: SubscriptionPlan | null = null
    if (planSlug) {
        try {
            const plans = await createMerchantApiClient().payments.plans({ site_type: siteType, slug: planSlug, store_id: storeData.id })
            plan = plans[0] || null
        } catch {
            plan = null
        }
    }

    // No valid plan in the catalog — send the merchant back to plan selection.
    if (!plan) {
        redirect(`/${store}/access_account/checkout/select-plan`)
    }

    return (
        <CheckoutClient
            plan={toSubscriptionPlanView(plan)}
            billingPeriod={billingPeriod}
            storeId={storeData.id}
            storeName={storeData.name || storeData.store_name || store}
            storeSlug={store}
            siteType={siteType}
            userId={user.id}
            userEmail={user.email}
            userName={user.fullName || ''}
        />
    )
}
