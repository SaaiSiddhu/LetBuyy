import { notFound } from 'next/navigation'
import EmbeddedAppBridgeClient from '@/components/apps/EmbeddedAppBridgeClient'
import { createMerchantApiClient } from '@/lib/api/client'
import { isAppPlatformEnabled } from '@/lib/app-platform-flag'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'

interface EmbeddedAppPageProps {
    params: Promise<{
        store: string
        installationId: string
    }>
}

export default async function EmbeddedAppPage({ params }: EmbeddedAppPageProps) {
    // ART-22 frozen seam — fail-closed. Absent FEATURE_APP_PLATFORM => not found.
    if (!isAppPlatformEnabled()) notFound()

    const { store, installationId } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const apiClient = createMerchantApiClient()
    const [session, registry] = await Promise.all([
        apiClient.appStore.embedSession(installationId, { store_id: storeData.id }),
        apiClient.appStore.extensionRegistry(installationId, { store_id: storeData.id }).catch(() => null),
    ])

    return <EmbeddedAppBridgeClient session={session} store={store} adminExtensions={registry?.extensions || []} />
}
