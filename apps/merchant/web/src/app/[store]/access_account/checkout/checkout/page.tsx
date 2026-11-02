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
    const { plan: planSlug, bp } = await searchParams

    // Auth
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const siteType = storeData.site_type
    const billingPeriod = bp === 'YEARLY' ? 'yearly' : 'monthly'

    let plan: SubscriptionPlan | null = null
    if (planSlug) {
        const plans = await createMerchantApiClient().payments.plans({ site_type: siteType, slug: planSlug, store_id: storeData.id })
        plan = plans.find((candidate) => candidate.slug === planSlug && candidate.site_type === siteType) || null
    }

    // No valid plan in the catalog — send the merchant back to plan selection.
    if (!plan) {
        redirect(`/${store}/access_account/checkout/select-plan`)
    }

    return (
        <CheckoutClient
            key={`${user.id}:${storeData.id}:${plan.slug}:${billingPeriod}`}
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
