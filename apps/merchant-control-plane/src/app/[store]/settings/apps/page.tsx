import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { SettingsPane } from '@/components/settings'
import { MaterialIcon } from '@letbuyy/ui'
import AppsSettingsContent, { type AppUninstallResult } from './AppsSettingsContent'

interface AppsSettingsPageProps {
    params: Promise<{ store: string }>
}

async function uninstallAppAction(store: string, appId: string): Promise<AppUninstallResult> {
    'use server'

    const user = await getSessionUser()
    if (!user) {
        return { ok: false, message: 'Authentication required' }
    }

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) {
        return { ok: false, message: 'Store access is required to uninstall this app.' }
    }

    try {
        await createMerchantApiClient().appStore.uninstall(appId, { store_id: storeData.id })
        revalidatePath(`/${store}/settings/apps`)
        revalidatePath(`/${store}/apps`)
        return { ok: true, message: 'App uninstalled.' }
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Unable to uninstall app.',
        }
    }
}

function getLoadErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unable to load installed apps.'
}

export default async function AppsSettingsPage({ params }: AppsSettingsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const result = await createMerchantApiClient().appStore.installations({ store_id: storeData.id })
        .then((installations) => ({ installations, loadError: null }))
        .catch((error) => ({ installations: [], loadError: getLoadErrorMessage(error) }))

    return (
        <SettingsPane
            store={store}
            title="Apps and sales channels"
            description="Review installed apps, connected channels, app data access, and uninstall actions."
            iconName="extension"
            primaryAction={{
                label: 'Browse marketplace',
                href: 'https://apps.letbuyy.store',
                icon: <MaterialIcon name="open_in_new" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
            }}
        >
            <AppsSettingsContent
                store={store}
                installations={result.installations}
                loadError={result.loadError}
                uninstallAction={uninstallAppAction.bind(null, store)}
            />
        </SettingsPane>
    )
}
