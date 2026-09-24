'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart } from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';

export function SavedAppsPanel() {
    const [apps, setApps] = useState<MarketplaceApp[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;
        fetch('/api/apps/search?kind=saved_apps')
            .then((response) => response.ok ? response.json() : null)
            .then((payload: { apps?: MarketplaceApp[] } | null) => {
                if (!mounted) return;
                setApps(payload?.apps || []);
                setLoaded(true);
            })
            .catch(() => {
                if (mounted) setLoaded(true);
            });
        return () => {
            mounted = false;
        };
    }, []);

    if (!loaded || apps.length === 0) return null;

    return (
        <section className="saved-apps-panel" aria-label="Saved apps">
            <div className="marketplace-section-header">
                <h2>Saved apps</h2>
                <p>Apps saved for the current store.</p>
            </div>
            <div className="saved-apps-panel__list">
                {apps.map((app) => (
                    <Link key={app.id} href={`/apps/${app.slug}`} className="saved-apps-panel__item">
                        <span className="saved-apps-panel__icon" aria-hidden="true">
                            {app.icon_url ? (
                                <Image src={app.icon_url} alt="" width={32} height={32} sizes="32px" />
                            ) : (
                                <Heart size={16} />
                            )}
                        </span>
                        <span>
                            <strong>{app.name}</strong>
                            <small>{app.tagline || 'Saved marketplace app'}</small>
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
