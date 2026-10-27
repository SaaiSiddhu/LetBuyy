'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { buildTenantStorefrontUrl } from '@letbuyy/tenant-core';
import type { StorefrontDirectoryEntry, StorefrontDirectoryPayload } from '@letbuyy/shared-types';
import { Button, Input, MaterialIcon, ThemeToggleButton } from '@letbuyy/ui';
import './storefront-landing.css';

const accountsOrigin = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.com';

// ─── Types ─────────────────────────────────────────────────────
type StoreShowcase = StorefrontDirectoryEntry;
type PlatformStats = StorefrontDirectoryPayload['stats'];
interface StorefrontLandingProps {
    stores: StoreShowcase[];
    stats: PlatformStats | null;
    directoryAvailable: boolean;
}

type FinderStatus = 'idle' | 'checking' | 'found' | 'not_found' | 'invalid' | 'draft' | 'unavailable';

interface FinderResult {
    name: string;
    subdomain: string;
    status: 'published' | 'draft';
    siteType: string;
}

// ─── Site Type Registry ────────────────────────────────────────
const SITE_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
    store: { label: 'Store', icon: 'shopping_bag', color: 'rgb(99 102 241)' },
    blog: { label: 'Blog', icon: 'article', color: 'rgb(249 115 22)' },
    portfolio: { label: 'Portfolio', icon: 'palette', color: 'rgb(236 72 153)' },
    resume: { label: 'Resume', icon: 'description', color: 'rgb(20 184 166)' },
    landing: { label: 'Landing', icon: 'rocket_launch', color: 'rgb(234 179 8)' },
};

function getSiteTypeLabel(siteType: string): string {
    return SITE_TYPE_META[siteType]?.label || 'Site';
}

function getStorefrontUrl(subdomain: string): string {
    return buildTenantStorefrontUrl(subdomain, {
        rootDomain: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
        baseUrl: process.env.NEXT_PUBLIC_STOREFRONT_URL,
        rootDomainAliases: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES,
    });
}

// ─── Utilities ─────────────────────────────────────────────────
function timeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function formatStat(n: number): string {
    if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
    if (n >= 1000) return n.toLocaleString('en-IN');
    return n.toString();
}

function getThemeMeta(themeId: string | null, themeName: string | null) {
    const fallback = { label: 'Theme', color: 'rgb(99 102 241)' };
    if (!themeId) return fallback;

    const palette = ['rgb(99 102 241)', 'rgb(14 165 233)', 'rgb(16 185 129)', 'rgb(245 158 11)', 'rgb(239 68 68)', 'rgb(139 92 246)'];
    const hash = [...themeId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return {
        label: themeName || fallback.label,
        color: palette[hash % palette.length],
    };
}

// ─── Store Finder Component ────────────────────────────────────
function StoreFinder() {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<FinderStatus>('idle');
    const [store, setStore] = useState<FinderResult | null>(null);
    const [countdown, setCountdown] = useState(3);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const redirectRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (redirectRef.current) clearTimeout(redirectRef.current);
        };
    }, []);

    // Handle search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (redirectRef.current) clearTimeout(redirectRef.current);
        let current = true;
        const controller = new AbortController();
        const retire = () => {
            current = false;
            controller.abort();
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (redirectRef.current) clearTimeout(redirectRef.current);
        };
        setStore(null);

        if (!query.trim()) {
            setStatus('idle');
            setStore(null);
            return retire;
        }

        if (query.trim().length < 3) {
            setStatus('invalid');
            setStore(null);
            return retire;
        }

        if (!/^[a-zA-Z0-9-]+$/.test(query.trim())) {
            setStatus('invalid');
            setStore(null);
            return retire;
        }

        debounceRef.current = setTimeout(async () => {
            setStatus('checking');
            try {
                const res = await fetch(`/api/store-lookup?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: 'no-store' });
                if (!res.ok) throw new Error('Lookup unavailable');
                const data = await res.json();
                if (!current) return;

                if (data.status === 'found' && data.store?.status === 'published'
                    && typeof data.store.name === 'string' && typeof data.store.subdomain === 'string') {
                    setStore(data.store);
                    if (data.store.status === 'draft') {
                        setStatus('draft');
                    } else {
                        setStatus('found');
                        setCountdown(3);
                    }
                } else if (data.status === 'invalid') {
                    setStatus('invalid');
                    setStore(null);
                } else {
                    setStatus('not_found');
                    setStore(null);
                }
            } catch {
                if (!current) return;
                setStatus('unavailable');
                setStore(null);
            }
        }, 400);
        return retire;
    }, [query]);

    // Auto-redirect countdown
    useEffect(() => {
        if (status === 'found' && store && countdown > 0) {
            redirectRef.current = setTimeout(() => {
                setCountdown(prev => prev - 1);
            }, 1000);
        }
        if (status === 'found' && store && countdown === 0) {
            navigateToStore(store.subdomain);
        }
    }, [status, store, countdown]);

    function navigateToStore(subdomain: string) {
        window.location.href = getStorefrontUrl(subdomain);
    }

    function handleVisitClick() {
        if (store) navigateToStore(store.subdomain);
    }

    return (
        <div className="store-finder">
            <div className="store-finder-input-row">
                <MaterialIcon className="store-finder-icon" name="search" />
                <Input unstyled
                    className="store-finder-input"
                    type="search"
                    placeholder="Enter a store name or subdomain..."
                    value={query}
                    onChange={(e) => { setStore(null); setStatus('idle'); setQuery(e.target.value); }}
                    aria-label="Search for a store"
                />
                <Button unstyled
                    className="store-finder-btn"
                    onClick={handleVisitClick}
                    disabled={status !== 'found' && status !== 'draft'}
                >
                    Visit Store →
                </Button>
            </div>

            {/* Status Indicator */}
            {status === 'unavailable' && (
                <div className="finder-status status-invalid" role="alert">
                    <span className="finder-status-text">Store lookup is temporarily unavailable. Please try again.</span>
                </div>
            )}
            {status === 'checking' && (
                <div className="finder-status status-checking">
                    <div className="finder-spinner" />
                    <span className="finder-status-text">Checking availability...</span>
                </div>
            )}

            {status === 'found' && store && (
                <div className="finder-status status-found">
                    <MaterialIcon name="check_circle" />
                    <span className="finder-status-text">
                        <strong>&quot;{store.name}&quot;</strong>
                        <span className="finder-type-badge" style={{ backgroundColor: SITE_TYPE_META[store.siteType]?.color + '25', color: SITE_TYPE_META[store.siteType]?.color }}>
                            <MaterialIcon name={SITE_TYPE_META[store.siteType]?.icon || 'web'} />
                            {getSiteTypeLabel(store.siteType)}
                        </span>
                        is online. Redirecting in {countdown}s...
                    </span>
                    <a className="finder-status-link" onClick={handleVisitClick}>
                        Visit Now →
                    </a>
                </div>
            )}

            {status === 'draft' && store && (
                <div className="finder-status status-draft">
                    <MaterialIcon name="progress_activity" />
                    <span className="finder-status-text">
                        <strong>&quot;{store.name}&quot;</strong>
                        <span className="finder-type-badge" style={{ backgroundColor: SITE_TYPE_META[store.siteType]?.color + '25', color: SITE_TYPE_META[store.siteType]?.color }}>
                            <MaterialIcon name={SITE_TYPE_META[store.siteType]?.icon || 'web'} />
                            {getSiteTypeLabel(store.siteType)}
                        </span>
                        is not open yet. Still being set up.
                    </span>
                    <a className="finder-status-link" onClick={handleVisitClick}>
                        Preview →
                    </a>
                </div>
            )}

            {status === 'not_found' && (
                <div className="finder-status status-not-found">
                    <MaterialIcon name="error" />
                    <span className="finder-status-text">
                        <strong>&quot;{query}&quot;</strong> was not found.
                    </span>
                    <a
                        href={accountsOrigin}
                        className="finder-status-link"
                    >
                        Create yours →
                    </a>
                </div>
            )}

            {status === 'invalid' && query.trim().length > 0 && (
                <div className="finder-status status-invalid">
                    <MaterialIcon name="warning" />
                    <span className="finder-status-text">
                        {query.trim().length < 3
                            ? 'Enter at least 3 characters'
                            : 'Only letters, numbers, and hyphens allowed'}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Store Card Component ──────────────────────────────────────
function StoreCard({ store }: { store: StoreShowcase }) {
    const theme = getThemeMeta(store.theme_id, store.theme_name);
    const isLive = store.status === 'published';
    const storeUrl = getStorefrontUrl(store.subdomain);

    return (
        <article
            className="store-card"
            style={{ '--theme-accent': theme.color } as React.CSSProperties}
        >
            {/* Logo / Initial Avatar */}
            <div className="store-card-logo">
                {store.logo_url ? (
                    <img
                        src={store.logo_url}
                        alt={store.name}
                        className="store-card-logo-img"
                        loading="lazy"
                    />
                ) : (
                    <div
                        className="store-card-initial"
                        style={{
                            backgroundColor: theme.color + '18',
                            color: theme.color,
                        }}
                    >
                        {store.name.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Mobile: wrap rest in body div */}
            <div className="store-card-body">
                {/* Store Info */}
                <div className="store-card-info">
                    <h3 className="store-card-name">{store.name}</h3>
                    <p className="store-card-subdomain">{new URL(storeUrl).host}</p>
                </div>

                {/* Badges */}
                <div className="store-card-badges">
                    {/* Site Type Badge */}
                    {(() => {
                        const siteTypeMeta = SITE_TYPE_META[store.site_type] || SITE_TYPE_META['store'];
                        return (
                            <span
                                className="store-card-type-badge"
                                style={{
                                    backgroundColor: siteTypeMeta.color + '18',
                                    color: siteTypeMeta.color,
                                    borderColor: siteTypeMeta.color + '30',
                            }}
                        >
                                <MaterialIcon name={siteTypeMeta.icon} />
                                {siteTypeMeta.label}
                            </span>
                        );
                    })()}
                    {/* Theme Badge (only for stores/themes) */}
                    {store.theme_id && (
                        <span
                            className="store-card-theme-badge"
                            style={{
                                backgroundColor: theme.color + '15',
                                color: theme.color,
                                borderColor: theme.color + '30',
                            }}
                        >
                            <MaterialIcon name="palette" />
                            {theme.label}
                        </span>
                    )}
                    <span className={`store-card-status-badge ${isLive ? 'status-live' : 'status-draft'}`}>
                        <MaterialIcon name={isLive ? 'check_circle' : 'schedule'} />
                        {isLive ? 'LIVE' : 'DRAFT'}
                    </span>
                </div>

                {/* Footer */}
                <div className="store-card-footer">
                    <span className="store-card-time">{timeAgo(store.published_at)}</span>
                    <a href={storeUrl} className="store-card-visit">
                        {isLive ? `Visit ${getSiteTypeLabel(store.site_type)} →` : 'Preview →'}
                    </a>
                </div>
            </div>
        </article>
    );
}

// ─── Stat Card Component ───────────────────────────────────────
function StatCard({ value, label }: { value: number | null; label: string }) {
    return (
        <div className="stat-card">
            <p className="stat-value">{value === null ? '—' : formatStat(value)}</p>
            <p className="stat-label">{label}</p>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────
export default function StorefrontLanding({ stores, stats, directoryAvailable }: StorefrontLandingProps) {
    return (
        <div className="landing">
            {/* ── Navbar ── */}
            <nav className="landing-nav" aria-label="Main navigation">
                <div className="landing-nav-inner">
                    <Link href="/" className="landing-nav-logo">
                        <span className="logo-icon">L</span>
                        LetBuyy
                    </Link>
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <ThemeToggleButton label="Toggle storefront theme" />
                        <a href={accountsOrigin} className="landing-nav-cta">
                            Create Store →
                        </a>
                    </div>
                </div>
            </nav>

            <main>
                {/* ── Hero + Store Finder ── */}
                <section className="landing-hero" aria-label="Store finder">
                    <div className="landing-hero-content">
                        <h1>
                            Discover Stores on{' '}
                            <span className="accent">LetBuyy</span>
                        </h1>
                        <p className="landing-hero-subtitle">
                            Explore public stores built by the LetBuyy community.
                            Enter a store name or subdomain to visit.
                        </p>
                        <StoreFinder />
                        <div className="landing-divider">or explore the community</div>
                    </div>
                </section>

                {/* ── Community Showcase ── */}
                <section className="landing-community" aria-label="Recently launched stores">
                    <div className="landing-community-header">
                        <div>
                            <h2>Recently Launched</h2>
                            <span className="landing-community-subtitle">
                                See what the community is building
                            </span>
                        </div>
                    </div>

                    <div className="landing-community-grid">
                        {!directoryAvailable ? (
                            <div className="landing-empty" role="alert">
                                <p>Store discovery is temporarily unavailable. Please try again.</p>
                                <Button unstyled type="button" className="landing-empty-cta" onClick={() => window.location.reload()}>Try again</Button>
                            </div>
                        ) : stores.length > 0 ? (
                            stores.map((store) => (
                                <StoreCard key={store.subdomain} store={store} />
                            ))
                        ) : (
                            <div className="landing-empty">
                                <div className="landing-empty-icon">
                                    <MaterialIcon name="rocket_launch" />
                                </div>
                                <p>No sites launched yet. Be the first to create one!</p>
                                <a href={accountsOrigin} className="landing-empty-cta">
                                    Create Your Site →
                                </a>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Platform Stats ── */}
                <section className="landing-stats" aria-label="Platform statistics">
                    <div className="landing-stats-header">
                        <h2>Platform in Numbers</h2>
                        <p>Public stores and their published catalog.</p>
                    </div>
                    <div className="landing-stats-grid">
                        <StatCard value={stats?.totalStores ?? null} label="Public Stores" />
                        <StatCard value={stats?.totalThemes ?? null} label="Themes Available" />
                        <StatCard value={stats?.totalProducts ?? null} label="Public Products" />
                        <StatCard value={stats?.totalOrders ?? null} label="Delivered Orders" />
                    </div>
                </section>

                {/* ── Footer CTA ── */}
                <section className="landing-footer-cta">
                    <h2>Ready to build your site?</h2>
                    <div className="landing-footer-buttons">
                        <a href={accountsOrigin} className="btn-primary">
                            Create Your Site →
                        </a>
                        <a href={accountsOrigin} className="btn-secondary">
                            Browse Themes →
                        </a>
                    </div>
                </section>
            </main>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <div className="landing-footer-inner">
                    <span>© 2026 LetBuyy</span>
                    <span className="landing-footer-sep">·</span>
                    <a href="/terms">Terms</a>
                    <span className="landing-footer-sep">·</span>
                    <a href="/privacy">Privacy</a>
                    <span className="landing-footer-sep">·</span>
                    <span>storefront.letbuyy.com</span>
                </div>
            </footer>
        </div>
    );
}
