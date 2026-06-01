import { notFound } from 'next/navigation'
import EmbeddedAppBridgeClient from '@/components/apps/EmbeddedAppBridgeClient'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'

interface EmbeddedAppPageProps {
    params: Promise<{
        store: string
        installationId: string
    }>
}

export default async function EmbeddedAppPage({ params }: EmbeddedAppPageProps) {
    const { store, installationId } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const session = await createMerchantApiClient().appStore.embedSession(installationId, { store_id: storeData.id })

    return <EmbeddedAppBridgeClient session={session} store={store} />
}
