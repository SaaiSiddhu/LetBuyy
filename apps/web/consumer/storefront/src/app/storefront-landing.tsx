'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import './storefront-landing.css';

// ─── Types ─────────────────────────────────────────────────────
interface StoreShowcase {
    storeName: string;
    displayName: string;
    subdomain: string;
    logoUrl: string | null;
    themeId: string | null;
    status: 'draft' | 'published';
    siteType: string;
    createdAt: string;
    ownerName: string | null;
    maskedEmail: string;
}

interface PlatformStats {
    totalStores: number;
    totalThemes: number;
    totalProducts: number;
    totalOrders: number;
}

interface StorefrontLandingProps {
    stores: StoreShowcase[];
    stats: PlatformStats;
}

type FinderStatus = 'idle' | 'checking' | 'found' | 'not_found' | 'invalid' | 'draft';

interface FinderResult {
    name: string;
    subdomain: string;
    status: 'published' | 'draft';
    siteType: string;
}

// ─── Site Type Registry ────────────────────────────────────────
const SITE_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
    store: { label: 'Store', icon: '🛍️', color: '#6366f1' },
    blog: { label: 'Blog', icon: '📝', color: '#f97316' },
    portfolio: { label: 'Portfolio', icon: '🎨', color: '#ec4899' },
    resume: { label: 'Resume', icon: '📄', color: '#14b8a6' },
    landing: { label: 'Landing', icon: '🚀', color: '#eab308' },
};

function getSiteTypeLabel(siteType: string): string {
    return SITE_TYPE_META[siteType]?.label || 'Site';
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

function getThemeMeta(themeId: string | null) {
    const fallback = { label: 'Theme', color: '#6366f1' };
    if (!themeId) return fallback;

    const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const hash = [...themeId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return {
        label: themeId
            .split(/[-_\s]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || fallback.label,
        color: palette[hash % palette.length],
    };
}

// ─── Hook: Count-Up Animation ──────────────────────────────────
function useCountUp(target: number, duration = 1500) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const animated = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || animated.current) return;

        // Check for reduced motion
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            setCount(target);
            animated.current = true;
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !animated.current) {
                    animated.current = true;
                    const startTime = performance.now();
                    const tick = (now: number) => {
                        const progress = Math.min((now - startTime) / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                        setCount(Math.floor(eased * target));
                        if (progress < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                    observer.unobserve(el);
                }
            },
            { threshold: 0.3 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [target, duration]);

    return { ref, displayValue: formatStat(count) };
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

        if (!query.trim()) {
            setStatus('idle');
            setStore(null);
            return;
        }

        if (query.trim().length < 3) {
            setStatus('invalid');
            setStore(null);
            return;
        }

        if (!/^[a-zA-Z0-9-]+$/.test(query.trim())) {
            setStatus('invalid');
            setStore(null);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setStatus('checking');
            try {
                const res = await fetch(`/api/store-lookup?q=${encodeURIComponent(query.trim())}`);
                const data = await res.json();

                if (data.status === 'found') {
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
                setStatus('not_found');
                setStore(null);
            }
        }, 400);
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
        const isDev = typeof window !== 'undefined' && window.location.hostname.includes('localhost');
        const url = isDev
            ? `/store/${subdomain}`
            : `https://${subdomain}.letbuyy.store`;
        window.location.href = url;
    }

    function handleVisitClick() {
        if (store) navigateToStore(store.subdomain);
    }

    return (
        <div className="store-finder">
            <div className="store-finder-input-row">
                <span className="store-finder-icon">🔍</span>
                <input
                    className="store-finder-input"
                    type="search"
                    placeholder="Enter a site name or subdomain..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search for a site"
                />
                <button
                    className="store-finder-btn"
                    onClick={handleVisitClick}
                    disabled={status !== 'found' && status !== 'draft'}
                >
                    Visit Site →
                </button>
            </div>

            {/* Status Indicator */}
            {status === 'checking' && (
                <div className="finder-status status-checking">
                    <div className="finder-spinner" />
                    <span className="finder-status-text">Checking availability...</span>
                </div>
            )}

            {status === 'found' && store && (
                <div className="finder-status status-found">
                    <span>✅</span>
                    <span className="finder-status-text">
                        <strong>&quot;{store.name}&quot;</strong>
                        <span className="finder-type-badge" style={{ backgroundColor: SITE_TYPE_META[store.siteType]?.color + '25', color: SITE_TYPE_META[store.siteType]?.color }}>
                            {SITE_TYPE_META[store.siteType]?.icon} {getSiteTypeLabel(store.siteType)}
                        </span>
                        is live! Redirecting in {countdown}s...
                    </span>
                    <a className="finder-status-link" onClick={handleVisitClick}>
                        Visit Now →
                    </a>
                </div>
            )}

            {status === 'draft' && store && (
                <div className="finder-status status-draft">
                    <span>🚧</span>
                    <span className="finder-status-text">
                        <strong>&quot;{store.name}&quot;</strong>
                        <span className="finder-type-badge" style={{ backgroundColor: SITE_TYPE_META[store.siteType]?.color + '25', color: SITE_TYPE_META[store.siteType]?.color }}>
                            {SITE_TYPE_META[store.siteType]?.icon} {getSiteTypeLabel(store.siteType)}
                        </span>
                        is coming soon! Still being set up.
                    </span>
                    <a className="finder-status-link" onClick={handleVisitClick}>
                        Preview →
                    </a>
                </div>
            )}

            {status === 'not_found' && (
                <div className="finder-status status-not-found">
                    <span>❌</span>
                    <span className="finder-status-text">
                        <strong>&quot;{query}&quot;</strong> was not found.
                    </span>
                    <a
                        href="https://accounts.letbuyy.store"
                        className="finder-status-link"
                    >
                        Create yours →
                    </a>
                </div>
            )}

            {status === 'invalid' && query.trim().length > 0 && (
                <div className="finder-status status-invalid">
                    <span>⚠️</span>
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
    const theme = getThemeMeta(store.themeId);
    const isLive = store.status === 'published';
    const isDev = typeof window !== 'undefined' && window.location.hostname.includes('localhost');
    const storeUrl = isDev
        ? `/store/${store.subdomain}`
        : `https://${store.subdomain}.letbuyy.store`;

    return (
        <article
            className="store-card"
            style={{ '--theme-accent': theme.color } as React.CSSProperties}
        >
            {/* Logo / Initial Avatar */}
            <div className="store-card-logo">
                {store.logoUrl ? (
                    <img
                        src={store.logoUrl}
                        alt={store.displayName}
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
                        {store.displayName.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>

            {/* Mobile: wrap rest in body div */}
            <div className="store-card-body">
                {/* Store Info */}
                <div className="store-card-info">
                    <h3 className="store-card-name">{store.displayName}</h3>
                    <p className="store-card-subdomain">{store.subdomain}.letbuyy.store</p>
                    <p className="store-card-owner">by {store.maskedEmail}</p>
                </div>

                {/* Badges */}
                <div className="store-card-badges">
                    {/* Site Type Badge */}
                    {(() => {
                        const siteTypeMeta = SITE_TYPE_META[store.siteType] || SITE_TYPE_META['store'];
                        return (
                            <span
                                className="store-card-type-badge"
                                style={{
                                    backgroundColor: siteTypeMeta.color + '18',
                                    color: siteTypeMeta.color,
                                    borderColor: siteTypeMeta.color + '30',
                                }}
                            >
                                {siteTypeMeta.icon} {siteTypeMeta.label}
                            </span>
                        );
                    })()}
                    {/* Theme Badge (only for stores/themes) */}
                    {store.themeId && (
                        <span
                            className="store-card-theme-badge"
                            style={{
                                backgroundColor: theme.color + '15',
                                color: theme.color,
                                borderColor: theme.color + '30',
                            }}
                        >
                            🎨 {theme.label}
                        </span>
                    )}
                    <span className={`store-card-status-badge ${isLive ? 'status-live' : 'status-draft'}`}>
                        {isLive ? '● LIVE' : '○ DRAFT'}
                    </span>
                </div>

                {/* Footer */}
                <div className="store-card-footer">
                    <span className="store-card-time">{timeAgo(store.createdAt)}</span>
                    <a href={storeUrl} className="store-card-visit">
                        {isLive ? `Visit ${getSiteTypeLabel(store.siteType)} →` : 'Preview →'}
                    </a>
                </div>
            </div>
        </article>
    );
}

// ─── Stat Card Component ───────────────────────────────────────
function StatCard({ value, label }: { value: number; label: string }) {
    const { ref, displayValue } = useCountUp(value);
    return (
        <div className="stat-card" ref={ref}>
            <p className="stat-value">{displayValue}</p>
            <p className="stat-label">{label}</p>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────
export default function StorefrontLanding({ stores, stats }: StorefrontLandingProps) {
    return (
        <div className="landing">
            {/* ── Navbar ── */}
            <nav className="landing-nav" aria-label="Main navigation">
                <div className="landing-nav-inner">
                    <Link href="/" className="landing-nav-logo">
                        <span className="logo-icon">L</span>
                        LetBuyy
                    </Link>
                    <a href="https://accounts.letbuyy.store" className="landing-nav-cta">
                        Create Site →
                    </a>
                </div>
            </nav>

            <main>
                {/* ── Hero + Store Finder ── */}
                <section className="landing-hero" aria-label="Site finder">
                    <div className="landing-hero-content">
                        <h1>
                            Discover Sites on{' '}
                            <span className="accent">LetBuyy</span>
                        </h1>
                        <p className="landing-hero-subtitle">
                            Find stores, blogs, portfolios, resumes &amp; landing pages built by the community.
                            Type a site name below to get started.
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
                        {stores.length > 0 ? (
                            stores.map((store) => (
                                <StoreCard key={store.subdomain} store={store} />
                            ))
                        ) : (
                            <div className="landing-empty">
                                <div className="landing-empty-icon">🚀</div>
                                <p>No sites launched yet. Be the first to create one!</p>
                                <a href="https://accounts.letbuyy.store" className="landing-empty-cta">
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
                    </div>
                    <div className="landing-stats-grid">
                        <StatCard value={stats.totalStores} label="Sites Created" />
                        <StatCard value={stats.totalThemes} label="Themes Available" />
                        <StatCard value={stats.totalProducts} label="Products Listed" />
                        <StatCard value={stats.totalOrders} label="Orders Fulfilled" />
                    </div>
                </section>

                {/* ── Footer CTA ── */}
                <section className="landing-footer-cta">
                    <h2>Ready to build your site?</h2>
                    <div className="landing-footer-buttons">
                        <a href="https://accounts.letbuyy.store" className="btn-primary">
                            Create Your Site →
                        </a>
                        <a href="https://accounts.letbuyy.store" className="btn-secondary">
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
                    <span>storefront.letbuyy.store</span>
                </div>
            </footer>
        </div>
    );
}
