'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Button, ChevronDown, ChevronRight, LogOut, Search, ThemeToggleButton, User, X } from '@letbuyy/ui';
import { getAccountsUrl } from '@/lib/site-url';

type AccountState = {
    email?: string;
    name?: string;
};

type CategoryMenuItem = {
    description: string;
    href: string;
    title: string;
};

type StoryCard = {
    eyebrow: string;
    href: string;
    title: string;
};

const ACCOUNT_STORAGE_KEY = 'letbuyy_marketplace_account';

const categoryMenu: CategoryMenuItem[] = [
    {
        title: 'Sales channels',
        description: 'Sync products with marketplaces, feeds, POS, retail and social commerce.',
        href: '/categories/social-media',
    },
    {
        title: 'Finding products',
        description: 'Source products with dropshipping, print on demand, wholesale and suppliers.',
        href: '/categories/sourcing',
    },
    {
        title: 'Selling products',
        description: 'Sell more with subscriptions, digital downloads, payments, COD and bundles.',
        href: '/categories/subscriptions',
    },
    {
        title: 'Orders and shipping',
        description: 'Handle fulfillment with tracking, invoices, order printers and shipping labels.',
        href: '/categories/shipping',
    },
    {
        title: 'Store design',
        description: 'Customize storefronts with SEO, translation, page builders and media tools.',
        href: '/categories/page-builders',
    },
    {
        title: 'Marketing and conversion',
        description: 'Get customers with reviews, upsells, checkout offers, email and SMS marketing.',
        href: '/categories/email-marketing',
    },
    {
        title: 'Store management',
        description: 'Scale operations with support, chat, FAQs, analytics and workflow automation.',
        href: '/categories/analytics',
    },
];

const storyCards: StoryCard[] = [
    {
        eyebrow: 'Stories',
        title: 'App stories',
        href: '/stories',
    },
    {
        eyebrow: 'Guide',
        title: 'App quality checklist',
        href: '/developers/review-requirements',
    },
];

function AppStoreBrandLogo({
    className = '',
    height = 42,
    width = 132,
}: {
    className?: string;
    height?: number;
    width?: number;
}) {
    const style = {
        '--appstore-brand-logo-width': `${width}px`,
        '--appstore-brand-logo-height': `${height}px`,
    } as CSSProperties;

    return (
        <span className={`appstore-brand-logo ${className}`.trim()} role="img" aria-label="LetBuyy" style={style}>
            <Image
                src="/icons/letbuyy-logo-light.svg"
                alt=""
                width={680}
                height={220}
                className="appstore-brand-logo-image appstore-brand-logo-light"
                priority
                unoptimized
                aria-hidden="true"
            />
            <Image
                src="/icons/letbuyy-logo-dark.svg"
                alt=""
                width={680}
                height={220}
                className="appstore-brand-logo-image appstore-brand-logo-dark"
                priority
                unoptimized
                aria-hidden="true"
            />
        </span>
    );
}

function readAccountState(): AccountState | null {
    try {
        const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as AccountState;
            if (parsed.email || parsed.name) return parsed;
        }

        const email = window.localStorage.getItem('letbuyy_account_email') || undefined;
        const name = window.localStorage.getItem('letbuyy_account_name') || undefined;
        return email || name ? { email, name } : null;
    } catch {
        return null;
    }
}

export function Header() {
    const [browseOpen, setBrowseOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [account, setAccount] = useState<AccountState | null>(null);

    const loginHref = getAccountsUrl('/lookup');
    const signupHref = getAccountsUrl('/signup');
    const accountName = account?.name || account?.email || 'Account';
    const isSignedIn = Boolean(account?.email || account?.name);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setAccount(readAccountState());
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setBrowseOpen(false);
            setMobileOpen(false);
            setAccountOpen(false);
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    useEffect(() => {
        if (!mobileOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileOpen]);

    const closeMenus = () => {
        setBrowseOpen(false);
        setMobileOpen(false);
        setAccountOpen(false);
    };

    const toggleBrowse = () => {
        setAccountOpen(false);
        setMobileOpen(false);
        setBrowseOpen((open) => !open);
    };

    const toggleAccount = () => {
        setBrowseOpen(false);
        setAccountOpen((open) => !open);
    };

    const openMobileMenu = () => {
        setBrowseOpen(false);
        setAccountOpen(false);
        setMobileOpen(true);
    };

    const handleLogout = () => {
        try {
            window.localStorage.removeItem(ACCOUNT_STORAGE_KEY);
            window.localStorage.removeItem('letbuyy_account_email');
            window.localStorage.removeItem('letbuyy_account_name');
        } catch {
            // Local account hints are non-secret and optional.
        }
        setAccount(null);
        setAccountOpen(false);
        window.location.assign(loginHref);
    };

    return (
        <>
            <header className="appstore-header">
                <div className="appstore-header-left">
                    <Link href="/" className="appstore-header-logo" aria-label="LetBuyy App Store" onClick={closeMenus}>
                        <AppStoreBrandLogo className="appstore-header-logo-image" />
                        <span className="appstore-header-product">Apps</span>
                    </Link>
                </div>

                <div className="appstore-header-center">
                    <Link href="/search" className="appstore-search" onClick={closeMenus}>
                        <Search size={21} aria-hidden="true" />
                        <span>Search apps, guides, and more</span>
                    </Link>
                </div>

                <nav className="appstore-header-nav" aria-label="Marketplace navigation">
                    <Button
                        unstyled
                        type="button"
                        className={`appstore-browse-trigger ${browseOpen ? 'active' : ''}`}
                        aria-expanded={browseOpen}
                        aria-controls="appstore-browse-menu"
                        onClick={toggleBrowse}
                    >
                        Browse apps
                        <ChevronDown size={18} aria-hidden="true" />
                    </Button>
                </nav>

                <div className="appstore-header-right">
                    <ThemeToggleButton label="Toggle marketplace theme" className="appstore-theme-toggle" />

                    <Link href="/search" className="appstore-mobile-search" aria-label="Search apps" onClick={closeMenus}>
                        <Search size={27} aria-hidden="true" />
                    </Link>

                    {isSignedIn ? (
                        <div className="appstore-account">
                            <Button
                                unstyled
                                type="button"
                                className={`appstore-account-trigger ${accountOpen ? 'active' : ''}`}
                                aria-label="Open account menu"
                                aria-expanded={accountOpen}
                                aria-controls="appstore-account-menu"
                                onClick={toggleAccount}
                            >
                                <User size={28} aria-hidden="true" />
                            </Button>

                            {accountOpen ? (
                                <div id="appstore-account-menu" className="appstore-account-menu" role="menu">
                                    <div className="appstore-account-summary">
                                        <strong>{accountName}</strong>
                                        {account?.email ? <span>{account.email}</span> : null}
                                    </div>
                                    <Link href="/my-apps" role="menuitem" onClick={closeMenus}>
                                        My Apps
                                    </Link>
                                    <Link href="/developers/dashboard" role="menuitem" onClick={closeMenus}>
                                        Partner Console
                                    </Link>
                                    <Button unstyled type="button" role="menuitem" onClick={handleLogout}>
                                        <LogOut size={16} aria-hidden="true" />
                                        Log out
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="appstore-auth-actions">
                            <Link href={loginHref} className="appstore-login-link" onClick={closeMenus}>
                                Log in
                            </Link>
                            <Link href={signupHref} className="appstore-start-link" onClick={closeMenus}>
                                Start for free
                            </Link>
                        </div>
                    )}

                    <Button
                        unstyled
                        className="appstore-mobile-toggle"
                        type="button"
                        aria-label="Open navigation"
                        aria-expanded={mobileOpen}
                        aria-controls="appstore-mobile-drawer"
                        onClick={openMobileMenu}
                    >
                        <span className="appstore-hamburger" aria-hidden="true" />
                    </Button>
                </div>
            </header>

            {browseOpen ? (
                <div id="appstore-browse-menu" className="appstore-mega" role="dialog" aria-label="Browse apps">
                    <div className="appstore-mega-inner">
                        <section className="appstore-mega-categories" aria-labelledby="appstore-mega-heading">
                            <p id="appstore-mega-heading" className="appstore-mega-eyebrow">
                                Apps by category
                            </p>
                            <div className="appstore-mega-category-grid">
                                {categoryMenu.map((item) => (
                                    <Link key={item.title} href={item.href} className="appstore-mega-category" onClick={closeMenus}>
                                        <strong>{item.title}</strong>
                                        <span>{item.description}</span>
                                    </Link>
                                ))}
                            </div>
                        </section>

                        <aside className="appstore-mega-stories" aria-label="App stories">
                            {storyCards.map((story, index) => (
                                <Link
                                    key={story.title}
                                    href={story.href}
                                    className={`appstore-story-card appstore-story-card--${index + 1}`}
                                    onClick={closeMenus}
                                >
                                    <span>{story.eyebrow}</span>
                                    <strong>{story.title}</strong>
                                </Link>
                            ))}
                            <Link href="/stories" className="appstore-more-stories" onClick={closeMenus}>
                                More stories
                                <ChevronRight size={20} aria-hidden="true" />
                            </Link>
                        </aside>
                    </div>
                </div>
            ) : null}

            {mobileOpen ? (
                <div className="appstore-mobile-layer">
                    <Button unstyled className="appstore-mobile-backdrop" aria-label="Close navigation" onClick={closeMenus} />
                    <aside id="appstore-mobile-drawer" className="appstore-mobile-drawer" role="dialog" aria-modal="true" aria-label="Browse apps">
                        <div className="appstore-mobile-drawer-header">
                            <Link href="/" className="appstore-mobile-drawer-brand" onClick={closeMenus}>
                                <AppStoreBrandLogo className="appstore-mobile-drawer-logo" width={118} height={38} />
                                <span className="appstore-header-product">Apps</span>
                            </Link>
                            <Button unstyled className="appstore-mobile-close" aria-label="Close navigation" onClick={closeMenus}>
                                <X size={32} aria-hidden="true" />
                            </Button>
                        </div>

                        <div className="appstore-mobile-drawer-content">
                            <p className="appstore-mobile-section-title">Apps by category</p>
                            <nav className="appstore-mobile-category-list" aria-label="App categories">
                                {categoryMenu.map((item) => (
                                    <Link key={item.title} href={item.href} onClick={closeMenus}>
                                        {item.title}
                                    </Link>
                                ))}
                            </nav>

                            <p className="appstore-mobile-section-title">App stories</p>
                            <div className="appstore-mobile-story-list">
                                {storyCards.map((story, index) => (
                                    <Link
                                        key={story.title}
                                        href={story.href}
                                        className={`appstore-mobile-story appstore-story-card--${index + 1}`}
                                        onClick={closeMenus}
                                    >
                                        <span>{story.eyebrow}</span>
                                        <strong>{story.title}</strong>
                                    </Link>
                                ))}
                            </div>

                            <Link href="/stories" className="appstore-mobile-more" onClick={closeMenus}>
                                More stories
                                <ChevronRight size={20} aria-hidden="true" />
                            </Link>
                        </div>

                        <div className="appstore-mobile-actions">
                            {isSignedIn ? (
                                <>
                                    <Link href="/my-apps" className="appstore-mobile-primary" onClick={closeMenus}>
                                        My Apps
                                    </Link>
                                    <Button unstyled type="button" className="appstore-mobile-secondary" onClick={handleLogout}>
                                        Log out
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Link href={signupHref} className="appstore-mobile-primary" onClick={closeMenus}>
                                        Start for free
                                    </Link>
                                    <Link href={loginHref} className="appstore-mobile-secondary" onClick={closeMenus}>
                                        Log in
                                    </Link>
                                </>
                            )}
                        </div>
                    </aside>
                </div>
            ) : null}
        </>
    );
}
