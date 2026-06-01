import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { InstalledApp } from '@letbuyy/shared-types'
import { createMerchantApiClient } from '@/lib/api/client'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'

interface AppsPageProps {
    params: Promise<{ store: string }>
}

function appName(installation: InstalledApp) {
    return installation.marketplace_apps?.name || 'Installed app'
}

function appTagline(installation: InstalledApp) {
    return installation.marketplace_apps?.tagline || 'Embedded admin app'
}

export default async function AppsPage({ params }: AppsPageProps) {
    const { store } = await params
    const user = await getSessionUser()
    if (!user) notFound()

    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) notFound()

    const installations = await createMerchantApiClient().appStore.installations({ store_id: storeData.id })

    return (
        <div className="admin-apps-page">
            <div className="admin-page-header">
                <div>
                    <p className="admin-page-eyebrow">Apps</p>
                    <h1>Installed apps</h1>
                    <p>Open embedded apps without leaving the LetBuyy admin.</p>
                </div>
                <Link href="https://apps.letbuyy.store" className="admin-secondary-button">
                    Browse marketplace
                </Link>
            </div>

            {installations.length > 0 ? (
                <div className="admin-apps-list">
                    {installations.map((installation) => (
                        <Link
                            key={installation.id}
                            href={`/${store}/apps/${installation.id}`}
                            className="admin-apps-list__item"
                        >
                            <div className="admin-apps-list__icon">
                                <span className="material-symbols-outlined">extension</span>
                            </div>
                            <div>
                                <h2>{appName(installation)}</h2>
                                <p>{appTagline(installation)}</p>
                            </div>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="admin-empty-state">
                    <span className="material-symbols-outlined">extension_off</span>
                    <h2>No apps installed</h2>
                    <p>Install apps from the marketplace to add embedded workflows to this admin.</p>
                    <Link href="https://apps.letbuyy.store" className="admin-primary-button">
                        Browse apps
                    </Link>
                </div>
            )}
        </div>
    )
}
