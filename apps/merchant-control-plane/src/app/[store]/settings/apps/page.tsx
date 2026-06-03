import { notFound } from 'next/navigation'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { AppsSettingsClient } from './AppsSettingsClient'

interface AppsSettingsPageProps {
    params: Promise<{ store: string }>
}

export default async function AppsSettingsPage({ params }: AppsSettingsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    const apiClient = createMerchantApiClient()
    const installedApps = await apiClient.appStore.installations({ store_id: storeData.id }).catch(() => [])

    async function uninstallApp(appId: string) {
        'use server'

        try {
            const actingUser = await getSessionUser()
            if (!actingUser) return { ok: false, message: 'Authentication required' }

            const ownedStore = await getStoreForUser(store, actingUser.id)
            if (!ownedStore) return { ok: false, message: 'Store access could not be verified' }

            await createMerchantApiClient().appStore.uninstall(appId, { store_id: ownedStore.id })
            return { ok: true, message: 'App uninstalled' }
        } catch (error) {
            return {
                ok: false,
                message: error instanceof Error ? error.message : 'Unable to uninstall app',
            }
        }
    }

    return (
        <AppsSettingsClient
            store={store}
            installedApps={installedApps}
            onUninstall={uninstallApp}
        />
    )
}
