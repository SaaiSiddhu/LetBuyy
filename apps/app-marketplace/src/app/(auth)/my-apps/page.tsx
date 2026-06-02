import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { createAppMarketplaceApiClient } from '@/lib/api/client';
import { Package, Settings, Trash2 } from '@letbuyy/ui';
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
                        <div className="my-apps-grid">
                            {installedApps.map((installation) => {
                                const app = installation.marketplace_apps;
                                const appName = app?.name || 'Installed app';
                                return (
                                    <div key={installation.id} className="installed-app-card">
                                        <div className="installed-app-icon">
                                            {app?.icon_url ? (
                                                <img src={app.icon_url} alt={appName} style={{
                                                    width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover'
                                                }} />
                                            ) : (
                                                <div style={{
                                                    width: '100%', height: '100%',
                                                    background: 'linear-gradient(135deg, var(--primary), var(--accent-cyan))',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontSize: 20, fontWeight: 800, borderRadius: 12,
                                                }}>
                                                    {appName.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="installed-app-info">
                                            <div className="installed-app-name">{appName}</div>
                                            <div className="installed-app-status">
                                                {installation.status === 'active' ? '● Active' : `○ ${installation.status || 'Active'}`}
                                            </div>
                                        </div>
                                        <div className="installed-app-actions">
                                            <button className="installed-app-btn">
                                                <Settings size={14} />
                                            </button>
                                            <button className="installed-app-btn danger">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <Package size={32} aria-hidden="true" />
                            </div>
                            <h3>No apps installed</h3>
                            <p>Browse our marketplace to find apps that can help grow your store.</p>
                            <Link href="/" className="dev-portal-cta" style={{ display: 'inline-flex' }}>
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
