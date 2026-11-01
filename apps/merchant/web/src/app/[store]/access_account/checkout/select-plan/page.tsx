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

    // The authorized site record determines which plan catalog applies.
    const siteType = storeData.site_type || 'store'

    const apiClient = createMerchantApiClient()
    const [plans, subscriptionPayload, foundingRemaining] = await Promise.all([
        apiClient.payments.plans({ site_type: siteType, store_id: storeData.id }),
        apiClient.payments.subscription.get({ store_id: storeData.id }),
        apiClient.foundingProgram.remaining().catch(() => null),
    ])
    const currentSub = subscriptionPayload.subscription || null
    const foundingAvailable = Boolean(
        foundingRemaining?.active && !foundingRemaining?.paused && (foundingRemaining?.remaining_slots ?? 0) > 0,
    )

    return (
        <SelectPlanClient
            plans={plans.map(toSubscriptionPlanView)}
            currentPlan={currentSub && ['active', 'trialing'].includes(currentSub.status) ? currentSub.plan : null}
            storeName={storeData.name || storeData.store_name || store}
            storeSlug={store}
            storeId={storeData.id}
            siteType={siteType}
            trialStatus={storeData.trial_status || null}
            trialEndsAt={storeData.trial_ends_at || null}
            foundingAvailable={foundingAvailable}
            foundingRemaining={foundingRemaining?.remaining_slots ?? null}
        />
    )
}
