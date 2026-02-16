import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
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

    // Fetch plans from DB
    const supabase = await createClient()
    const { data: plans } = await supabase
        .from('plans')
        .select('*')
        .eq('site_type', siteType)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    // Fetch current subscription if any
    const { data: currentSub } = await supabase
        .from('subscriptions')
        .select('id, plan, status, billing_period, current_period_end')
        .eq('store_id', storeData.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
