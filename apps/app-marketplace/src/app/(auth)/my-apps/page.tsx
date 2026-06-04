import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { InstalledAppsGrid } from '@/components/InstalledAppsGrid';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createAppMarketplaceApiClient } from '@/lib/api/client';
import { Package } from '@letbuyy/ui';
import Link from 'next/link';

export const metadata = {
    title: 'My Apps — LetBuyy App Store',
    description: 'Manage your installed apps.',
};

export default async function MyAppsPage() {
    const result = await createAppMarketplaceApiClient({ requireSession: true })
        .then((api) => api.appStore.installations())
        .then((installations) => ({ isAuthenticated: true, installedApps: installations }))
        .catch((error) => {
            if (error instanceof LetbuyyApiError && error.status === 401) {
                return { isAuthenticated: false, installedApps: [] };
            }
            return { isAuthenticated: true, installedApps: [] };
        });

    const { isAuthenticated, installedApps } = result;

    return (
        <>
            <Header />
            <main className="appstore-main">
                <section className="appstore-section">
                    <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>My Apps</h1>
                    <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 28 }}>
                        Manage the apps installed on your store.
                    </p>

                    {!isAuthenticated ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🔑</div>
                            <h3>Sign in required</h3>
                            <p>Please sign in to view your installed apps.</p>
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
