import { notFound } from 'next/navigation'
import type { SubscriptionPlan } from '@letbuyy/shared-types'
import { EmptyState } from '@letbuyy/ui'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createMerchantApiClient } from '@/lib/api/client'
import { toSubscriptionPlanView } from '@/lib/billing/plan-ui'
import { SettingsPane } from '@/components/settings'
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
            const plans = await createMerchantApiClient().payments.plans({ site_type: siteType, slug: planSlug })
            plan = plans[0] || null
        } catch {
            plan = null
        }
    }

    if (!plan) {
        return (
            <SettingsPane
                store={store}
                title="Subscribe checkout"
                description="Review a plan, billing period, and payment method before activating a subscription."
                iconName="billing"
                primaryAction={{
                    label: 'View plans',
                    href: `/${store}/access_account/checkout/select-plan`,
                }}
            >
                <EmptyState
                    kind="payments"
                    title="Plan checkout is not available"
                    body="The selected plan was not returned by the billing catalog. Choose another plan or try again after the plan catalog is configured."
                />
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            store={store}
            title="Subscribe checkout"
            description="Review billing details, payment method, and plan renewal before activating a subscription."
            iconName="billing"
            secondaryActions={[
                {
                    label: 'Change plan',
                    href: `/${store}/access_account/checkout/select-plan`,
                },
            ]}
        >
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
        </SettingsPane>
    )
}
