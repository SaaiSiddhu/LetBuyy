import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import SettingsSidebar from '@/components/SettingsSidebar'

interface SettingsLayoutProps {
    children: React.ReactNode
    params: Promise<{ store: string }>
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
    const { store } = await params

    // Session + store ownership already validated by parent [store]/layout.tsx
    // but we need the data for the settings sidebar
    const user = await getSessionUser()
    if (!user) return notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    return (
        <div className="settings-shell">
            <SettingsSidebar
                storeName={storeData.name || storeData.store_name || store}
                subdomain={storeData.subdomain || storeData.store_name || store}
                userName={user.fullName || ''}
                userEmail={user.email}
            />
            <div className="settings-content">
                {children}
            </div>
        </div>
    )
}
