import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { InstalledAppsGrid } from '@/components/InstalledAppsGrid';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createAppMarketplaceApiClient } from '@/lib/api/client';
import { Button, KeyRound, Package, Select } from '@letbuyy/ui';
import Link from 'next/link';

export const metadata = {
    title: 'My Apps — LetBuyy App Store',
    description: 'Manage your installed apps.',
};

export default async function MyAppsPage({ searchParams }: { searchParams?: Promise<{ store_id?: string }> }) {
    const params = await searchParams;
    const result = await createAppMarketplaceApiClient({ requireSession: true })
        .then(async (api) => {
            const stores = (await api.stores.list({ limit: 50 })).data;
            const selectedStoreId = params?.store_id || stores[0]?.id;
            const installedApps = selectedStoreId ? await api.appStore.installations({ store_id: selectedStoreId }) : [];
            return { isAuthenticated: true, unavailable: false, installedApps, stores, selectedStoreId };
        })
        .catch((error) => {
            if (error instanceof LetbuyyApiError && error.status === 401) {
                return { isAuthenticated: false, unavailable: false, installedApps: [], stores: [], selectedStoreId: undefined };
            }
            return { isAuthenticated: true, unavailable: true, installedApps: [], stores: [], selectedStoreId: undefined };
        });

    const { isAuthenticated, unavailable, installedApps, stores, selectedStoreId } = result;

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    <div className="marketplace-page-header">
                        <h1 className="marketplace-page-title">My Apps</h1>
                        <p className="marketplace-page-subtitle">Manage the apps installed on your store.</p>
                        {stores.length > 0 && (
                            <form method="get" className="app-install-plan-option">
                                <label htmlFor="my-apps-store">Store</label>
                                <Select unstyled id="my-apps-store" name="store_id" defaultValue={selectedStoreId}
                                    options={stores.map(store => ({ value: store.id, label: store.store_name || store.name || store.subdomain }))} />
                                <Button unstyled type="submit" className="appstore-header-btn">Show apps</Button>
                            </form>
                        )}
                    </div>

                    {!isAuthenticated ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <KeyRound size={32} aria-hidden="true" />
                            </div>
                            <h3>Sign in required</h3>
                            <p>Please sign in to view your installed apps.</p>
                        </div>
                    ) : unavailable ? (
                        <div className="empty-state" role="alert">
                            <h3>Installed apps temporarily unavailable</h3>
                            <p>Reload this page to retry. Your installed apps have not been removed.</p>
                        </div>
                    ) : installedApps.length > 0 ? (
                        <InstalledAppsGrid installations={installedApps} />
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Package size={32} aria-hidden="true" />
                            </div>
                            <h3>No apps installed</h3>
                            <p>Browse our marketplace to find apps that can help grow your store.</p>
                            <Link href="/" className="dev-portal-cta empty-state-action">
                                Browse Apps
                            </Link>
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    );
}
