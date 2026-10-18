import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getAccountsUrl } from '@/lib/public-urls'
import { LoyaltySettings } from '@/components/settings/LoyaltySettings'

export default async function LoyaltySettingsPage({ params }: { params: Promise<{ store: string }> }) {
    const [{ store }, user] = await Promise.all([params, getSessionUser()])
    if (!user) redirect(getAccountsUrl('/lookup'))
    return <LoyaltySettings key={`${user.id}:${store}`} store={store} actorId={user.id} />
}
