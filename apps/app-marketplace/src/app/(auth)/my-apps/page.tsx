import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { appStoreWorkerFetch } from '@/lib/api/worker-client';
import { Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
    title: 'My Apps — LetBuyy App Store',
    description: 'Manage your installed apps.',
};

interface InstalledApp {
    id: string;
    name?: string | null;
    slug?: string | null;
    icon_url?: string | null;
    tagline?: string | null;
    status?: string | null;
    marketplace_apps?: {
        id: string;
        name?: string | null;
        slug?: string | null;
        icon_url?: string | null;
        tagline?: string | null;
    } | null;
}

export default async function MyAppsPage() {
    const response = await appStoreWorkerFetch('/app-store/installations', {
        method: 'GET',
        requireSession: true,
    });

    const isAuthenticated = response.status !== 401;
    const payload = response.ok
        ? await response.json() as { data?: InstalledApp[] }
        : null;
    const installedApps = payload?.data || [];

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
                                const app = installation.marketplace_apps || installation;
                                return (
                                    <div key={installation.id || app.id} className="installed-app-card">
                                        <div className="installed-app-icon">
                                            {app.icon_url ? (
                                                <img src={app.icon_url} alt={app.name || 'Installed app'} style={{
                                                    width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover'
                                                }} />
                                            ) : (
                                                <div style={{
                                                    width: '100%', height: '100%',
                                                    background: 'linear-gradient(135deg, var(--primary), var(--accent-cyan))',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontSize: 20, fontWeight: 800, borderRadius: 12,
                                                }}>
                                                    {(app.name || 'A').charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="installed-app-info">
                                            <div className="installed-app-name">{app.name}</div>
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
                            <div className="empty-state-icon">📦</div>
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
