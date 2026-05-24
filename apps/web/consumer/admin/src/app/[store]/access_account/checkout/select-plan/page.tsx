import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
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

    const [plansPayload, subscriptionPayload] = await Promise.all([
        workerFetch(`/payments/plans?site_type=${encodeURIComponent(siteType)}`).then(readWorkerJson),
        workerFetch(`/payments/subscription?store_id=${encodeURIComponent(storeData.id)}`).then(readWorkerJson),
    ])
    const plans = plansPayload?.data || []
    const currentSub = subscriptionPayload?.data?.subscription || null

    return (
        <SelectPlanClient
            plans={plans || []}
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
