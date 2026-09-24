'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock } from '@letbuyy/ui';
import type { MarketplaceApp } from '@letbuyy/shared-types';

const STORAGE_KEY = 'letbuyy_marketplace_recent_apps';
const MAX_RECENT = 6;

type RecentApp = Pick<MarketplaceApp, 'id' | 'slug' | 'name' | 'tagline' | 'icon_url'> & {
    viewed_at: string;
};

interface RecentlyViewedAppsProps {
    currentApp?: MarketplaceApp;
}

function compactApp(app: MarketplaceApp): RecentApp {
    return {
        id: app.id,
        slug: app.slug,
        name: app.name,
        tagline: app.tagline || null,
        icon_url: app.icon_url || null,
        viewed_at: new Date().toISOString(),
    };
}

function readRecentApps(): RecentApp[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as RecentApp[];
        return Array.isArray(parsed)
            ? parsed.filter((item) => item?.id && item?.slug && item?.name).slice(0, MAX_RECENT)
            : [];
    } catch {
        return [];
    }
}

export function RecentlyViewedApps({ currentApp }: RecentlyViewedAppsProps) {
    const [recentApps, setRecentApps] = useState<RecentApp[]>([]);

    useEffect(() => {
        const existing = readRecentApps();
        const next = currentApp
            ? [compactApp(currentApp), ...existing.filter((item) => item.id !== currentApp.id)].slice(0, MAX_RECENT)
            : existing;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        const frame = window.requestAnimationFrame(() => {
            setRecentApps(currentApp ? next.filter((item) => item.id !== currentApp.id) : next);
        });
        return () => window.cancelAnimationFrame(frame);
    }, [currentApp]);

    if (recentApps.length === 0) return null;

    return (
        <section className="recently-viewed-apps" aria-label="Recently viewed apps">
            <div className="marketplace-section-header">
                <h2>Recently viewed</h2>
                <p>Apps viewed in this browser.</p>
            </div>
            <div className="recently-viewed-apps__grid">
                {recentApps.map((app) => (
                    <Link key={app.id} href={`/apps/${app.slug}`} className="recently-viewed-apps__item">
                        <span className="recently-viewed-apps__icon" aria-hidden="true">
                            {app.icon_url ? (
                                <Image src={app.icon_url} alt="" width={28} height={28} sizes="28px" />
                            ) : (
                                <Clock size={16} />
                            )}
                        </span>
                        <span>
                            <strong>{app.name}</strong>
                            {app.tagline && <small>{app.tagline}</small>}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
