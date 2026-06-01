import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createMerchantApiClient } from '@/lib/api/client'
import { toSubscriptionPlanView } from '@/lib/billing/plan-ui'
import SelectPlanClient from './SelectPlanClient'

/* ——————————————————————————————————————
   Plan Selection Page (Server Component)
   Fetches plans from DB, renders client
   URL: /{store}/access_account/checkout/select-plan
   —————————————————————————————————————— */

interface PageProps {
    params: Promise<{ store: string }>
}

export default async function SelectPlanPage({ params }: PageProps) {
    const { store } = await params

    // Auth
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    // Determine site type (stores table may have site_type)
    const siteType = storeData.site_type || 'store'

    const apiClient = createMerchantApiClient()
    const [plans, subscriptionPayload] = await Promise.all([
        apiClient.payments.plans({ site_type: siteType }),
        apiClient.payments.subscription.get({ store_id: storeData.id }),
    ])
    const currentSub = subscriptionPayload.subscription || null

    return (
        <SelectPlanClient
            plans={plans.map(toSubscriptionPlanView)}
            currentPlan={currentSub?.plan || null}
            storeName={storeData.name || storeData.store_name || store}
            storeSlug={store}
            storeId={storeData.id}
            siteType={siteType}
            trialStatus={storeData.trial_status || null}
            trialEndsAt={storeData.trial_ends_at || null}
        />
    )
}
