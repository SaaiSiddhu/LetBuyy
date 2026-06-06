import { redirect } from 'next/navigation'
import { getSessionUser, getUserStores } from '@/lib/auth/session'
import AllStoresClient from './AllStoresClient'
import { getAccountsUrl } from '@/lib/public-urls'

/**
 * /stores — "All Stores" page (Shopify-style).
 * Standalone page, no AdminShell / sidebar.
 * Shows all stores the user owns.
 */
export default async function AllStoresPage() {
    const user = await getSessionUser()

    if (!user) {
        redirect(getAccountsUrl('/lookup'))
    }

    const stores = await getUserStores(user.id)

    return <AllStoresClient user={user} stores={stores} />
}
