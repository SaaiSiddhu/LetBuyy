'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { LucideIcon } from '@letbuyy/ui';
import {
    ArrowLeft,
    BookOpen,
    Button,
    ChevronDown,
    ChevronRight,
    Code2,
    CreditCard,
    Download,
    Eye,
    FileText,
    Gauge,
    Input,
    LayoutDashboard,
    LayoutGrid,
    LogOut,
    MessageCircle,
    Monitor,
    Package,
    Palette,
    RefreshCw,
    Rocket,
    Search,
    Settings,
    ShieldCheck,
    Sparkles,
    Store,
    ThemeToggleButton,
    Upload,
    X,
} from '@letbuyy/ui';
import BrandLogo from '@/components/brand-logo';
import { useAuth } from '@/hooks/useAuth';
import { cn, isCommandSearchShortcut } from '@/lib/utils';
import { getAccountsUrl } from '@/lib/public-urls';

/* ═══════════════════════════════════════════════════════════════
   The platform header, sharing its structure with the marketing site: same
   wordmark, same hover-driven mega menus, same mobile drawer, same styles
   (ported into src/app/header.css).

   What differs is the domain. Panels are built from the marketplace's real
   categories and routes, and three controls exist only here — search, the
   theme toggle, and the signed-in workspace menu.
   ═══════════════════════════════════════════════════════════════ */

type DropdownKey = 'browse' | 'build';

type NavLink =
    | { label: string; menu: DropdownKey }
    | { href: string; label: string };

type MenuItem = {
    description?: string;
    href: string;
    icon: LucideIcon;
    label: string;
};

type MenuSection = {
    eyebrow: string;
    items: MenuItem[];
};

const ACCOUNTS_URL = getAccountsUrl();
const PLATFORM_URL = process.env.NEXT_PUBLIC_MARKETING_URL?.trim() || 'https://letbuyy.com';

/* Hover timings, matching the marketing header: 90ms of intent stops the panel
   flashing open as the cursor crosses a trigger on its way elsewhere; 180ms of
   grace covers the diagonal from trigger to panel. */
const OPEN_DELAY_MS = 90;
const CLOSE_DELAY_MS = 180;
const MENU_WIDTH: Record<DropdownKey, number> = { browse: 880, build: 720 };
const MENU_MARGIN = 20;
const MENU_TEXT_INSET = 12;

const navLinks: NavLink[] = [
    { label: 'Browse', menu: 'browse' },
    { label: 'Build', menu: 'build' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/support', label: 'Support' },
];

const browseIntro =
    'Every theme is reviewed, previewable with your own products before you install, and switchable later without rebuilding your store.';

/* The five categories the catalogue actually ships — see ThemeCategory in
   @letbuyy/theme-engine. Adding one here without adding it there yields a
   dead route. */
const categorySection: MenuSection = {
    eyebrow: 'By what you are building',
    items: [
        { href: '/themes/category/store', icon: Store, label: 'Online store', description: 'Sell products with cart and checkout.' },
        { href: '/themes/category/portfolio', icon: Palette, label: 'Portfolio', description: 'Show work, projects and case studies.' },
        { href: '/themes/category/resume', icon: FileText, label: 'Resume', description: 'A single professional profile page.' },
        { href: '/themes/category/landing', icon: Rocket, label: 'Landing page', description: 'One page built to convert.' },
        { href: '/themes/category/saas', icon: LayoutDashboard, label: 'SaaS console', description: 'App-style dashboards and panels.' },
    ],
};

const priceSection: MenuSection = {
    eyebrow: 'By price',
    items: [
        { href: '/themes?pricing=free', icon: Sparkles, label: 'Free themes' },
        { href: '/themes?pricing=one_time', icon: CreditCard, label: 'One-time purchase' },
        { href: '/themes?pricing=subscription', icon: RefreshCw, label: 'Subscription' },
        { href: '/themes/compare', icon: LayoutGrid, label: 'Compare themes' },
    ],
};

const platformSection: MenuSection = {
    eyebrow: 'Elsewhere on LetBuyy',
    items: [
        { href: PLATFORM_URL, icon: Sparkles, label: 'LetBuyy platform' },
        { href: `${PLATFORM_URL}/pricing`, icon: CreditCard, label: 'Platform pricing' },
        { href: '/about', icon: Palette, label: 'About Themes' },
    ],
};

const browseHighlights: MenuItem[] = [
    {
        href: '/themes?sort=popular',
        icon: Eye,
        label: 'Preview in your own store',
        description: 'See a theme with your real products before you install it.',
    },
    {
        href: '/themes',
        icon: Monitor,
        label: 'Built for Indian screens',
        description: 'Mobile-first layouts that hold up on a 360px phone.',
    },
    {
        href: '/docs',
        icon: RefreshCw,
        label: 'Switch without rebuilding',
        description: 'Products and orders stay put when the design changes.',
    },
];

const browseProof = [
    { value: '5', label: 'categories' },
    { value: 'Free + paid', label: 'on every plan' },
    { value: 'Live', label: 'store preview' },
];

const buildIntro =
    'Themes are Liquid and JSON, rendered through a locked-down sanitiser. Build one, preview it, then submit it for review.';

const buildSections: MenuSection[] = [
    {
        eyebrow: 'Documentation',
        items: [
            { href: '/docs', icon: BookOpen, label: 'Theme docs' },
            { href: '/docs/api', icon: Code2, label: 'API reference' },
            { href: '/legal/license', icon: FileText, label: 'Theme licence' },
        ],
    },
    {
        eyebrow: 'Publish',
        items: [
            { href: '/developer', icon: LayoutGrid, label: 'Developer console' },
            { href: '/developer/listings/new', icon: Upload, label: 'Submit a theme' },
            { href: '/support', icon: MessageCircle, label: 'Get help' },
        ],
    },
];

const buildHighlights: MenuItem[] = [
    {
        href: '/docs',
        icon: ShieldCheck,
        label: 'Safe by default',
        description: 'Output is escaped and dangerous constructs are blocked at render.',
    },
    {
        href: '/docs',
        icon: Gauge,
        label: 'Fast to ship',
        description: 'JSON sections and presets, so a layout change is not a rewrite.',
    },
];

function MenuIcon({ icon: Icon }: { icon: LucideIcon }) {
    return <Icon width={17} height={17} aria-hidden="true" />;
}

/* ═══════════════════════════════════════════════
   DESKTOP MEGA PANELS
   ═══════════════════════════════════════════════ */

function DesktopBrowseMenu({ closeMenu }: { closeMenu: () => void }) {
    return (
        <>
            <div className="mega-lead">
                <p className="mega-eyebrow">Browse themes</p>
                <p className="mega-lead-text">{browseIntro}</p>
            </div>

            <div className="mega-body mega-body-products">
                <div className="mega-cols mega-cols-2">
                    <div className="mega-col">
                        <p className="mega-eyebrow">{categorySection.eyebrow}</p>
                        <div className="mega-stack">
                            {categorySection.items.map(item => (
                                <Link key={item.href} href={item.href} className="mega-item" onClick={closeMenu}>
                                    <span className="mega-item-icon">
                                        <MenuIcon icon={item.icon} />
                                    </span>
                                    <span className="mega-item-text">
                                        <strong>{item.label}</strong>
                                        <small>{item.description}</small>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="mega-col">
                        {[priceSection, platformSection].map(section => (
                            <section key={section.eyebrow} className="mega-col-section">
                                <p className="mega-eyebrow">{section.eyebrow}</p>
                                <div className="mega-stack-tight">
                                    {section.items.map(item => (
                                        <Link key={item.label} href={item.href} className="mega-compact" onClick={closeMenu}>
                                            <span className="mega-item-icon">
                                                <MenuIcon icon={item.icon} />
                                            </span>
                                            <span>{item.label}</span>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>

                <aside className="mega-rail">
                    <p className="mega-eyebrow">Why switching is safe</p>
                    <div className="mega-stack">
                        {browseHighlights.map(item => (
                            <Link key={item.label} href={item.href} className="mega-item" onClick={closeMenu}>
                                <span className="mega-item-icon">
                                    <MenuIcon icon={item.icon} />
                                </span>
                                <span className="mega-item-text">
                                    <strong>{item.label}</strong>
                                    <small>{item.description}</small>
                                </span>
                            </Link>
                        ))}
                    </div>
                </aside>
            </div>

            <div className="mega-foot">
                <div className="mega-facts">
                    {browseProof.map(fact => (
                        <span key={fact.value} className="mega-fact">
                            <strong>{fact.value}</strong>
                            <small>{fact.label}</small>
                        </span>
                    ))}
                </div>
                <Link href="/themes" className="mega-foot-cta" onClick={closeMenu}>
                    Browse all themes
                    <ChevronRight width={14} height={14} aria-hidden="true" />
                </Link>
            </div>
        </>
    );
}

function DesktopBuildMenu({ closeMenu }: { closeMenu: () => void }) {
    return (
        <>
            <div className="mega-lead">
                <p className="mega-eyebrow">Build themes</p>
                <p className="mega-lead-text">{buildIntro}</p>
            </div>

            <div className="mega-body mega-body-why">
                <div className="mega-col">
                    {buildSections.map(section => (
                        <section key={section.eyebrow} className="mega-col-section">
                            <p className="mega-eyebrow">{section.eyebrow}</p>
                            <div className="mega-stack-tight">
                                {section.items.map(item => (
                                    <Link key={item.href} href={item.href} className="mega-compact" onClick={closeMenu}>
                                        <span className="mega-item-icon">
                                            <MenuIcon icon={item.icon} />
                                        </span>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="mega-col">
                    <p className="mega-eyebrow">How the engine works</p>
                    <div className="mega-stack">
                        {buildHighlights.map(item => (
                            <Link key={item.label} href={item.href} className="mega-item" onClick={closeMenu}>
                                <span className="mega-item-icon">
                                    <MenuIcon icon={item.icon} />
                                </span>
                                <span className="mega-item-text">
                                    <strong>{item.label}</strong>
                                    <small>{item.description}</small>
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mega-foot">
                <p className="mega-eyebrow mega-foot-eyebrow">Before you submit</p>
                <div className="mega-foot-links">
                    <Link href="/legal/terms" className="mega-foot-link" onClick={closeMenu}>
                        <strong>Marketplace terms</strong>
                        <small>What publishing commits you to.</small>
                    </Link>
                    <Link href="/legal/license" className="mega-foot-link" onClick={closeMenu}>
                        <strong>Theme licence</strong>
                        <small>How merchants may use your work.</small>
                    </Link>
                    <Link href="/legal/refund" className="mega-foot-link" onClick={closeMenu}>
                        <strong>Refund policy</strong>
                        <small>When a purchase can be reversed.</small>
                    </Link>
                </div>
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════
   MOBILE DRAWER PANELS
   ═══════════════════════════════════════════════ */

function MobilePanel({
    intro,
    cards,
    sections,
    closeMenu,
    goBack,
}: {
    intro: string;
    cards: MenuItem[];
    sections: MenuSection[];
    closeMenu: () => void;
    goBack: () => void;
}) {
    return (
        <div className="mobile-drawer-panel">
            <Button unstyled type="button" className="mobile-panel-back" onClick={goBack}>
                <ArrowLeft width={24} height={24} aria-hidden="true" />
                <span>Back</span>
            </Button>

            <p className="mobile-panel-intro">{intro}</p>

            <div className="mobile-card-stack">
                {cards.map(item => (
                    <Link key={item.label} href={item.href} className="mobile-feature-card" onClick={closeMenu}>
                        <span className="mobile-link-icon">
                            <MenuIcon icon={item.icon} />
                        </span>
                        <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                        </span>
                    </Link>
                ))}
            </div>

            <div className="mobile-section-stack">
                {sections.map(section => (
                    <section key={section.eyebrow} className="mobile-menu-section">
                        <p className="mobile-panel-eyebrow">{section.eyebrow}</p>
                        <div className="mobile-panel-link-list">
                            {section.items.map(item => (
                                <Link key={item.label} href={item.href} className="mobile-panel-link" onClick={closeMenu}>
                                    <span className="mobile-link-icon">
                                        <MenuIcon icon={item.icon} />
                                    </span>
                                    <span>
                                        <strong>{item.label}</strong>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   MARKETPLACE-ONLY CONTROLS
   ═══════════════════════════════════════════════ */

function SearchTrigger({ onClick }: { onClick: () => void }) {
    return (
        <Button unstyled type="button" className="tm-search-trigger" onClick={onClick} aria-label="Search themes">
            <Search width={16} height={16} aria-hidden="true" />
            <span className="tm-search-label">Search themes</span>
            <kbd className="tm-kbd" aria-hidden="true">⌘K</kbd>
        </Button>
    );
}

function SearchModal({ onClose }: { onClose: () => void }) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const quickActions: MenuItem[] = [
        { label: 'Browse all themes', href: '/themes', icon: Sparkles },
        { label: 'View pricing', href: '/pricing', icon: CreditCard },
        { label: 'Go to dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Documentation', href: '/docs', icon: BookOpen },
    ];

    const submitSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = query.trim();
        window.location.href = trimmed ? `/themes?q=${encodeURIComponent(trimmed)}` : '/themes';
        onClose();
    };

    return (
        <div className="tm-search-overlay" role="dialog" aria-modal="true" aria-label="Search themes">
            <Button unstyled type="button" className="tm-search-scrim" onClick={onClose} aria-label="Close search" />

            <div className="tm-search-panel">
                <form onSubmit={submitSearch} className="tm-search-form">
                    <Search width={18} height={18} aria-hidden="true" />
                    <Input
                        unstyled
                        ref={inputRef}
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search themes and categories"
                        className="tm-search-input"
                    />
                    <kbd className="tm-kbd" aria-hidden="true">ESC</kbd>
                </form>

                <div className="tm-search-actions">
                    <p className="mega-eyebrow">Quick actions</p>
                    {quickActions.map(action => (
                        <Link key={action.href} href={action.href} onClick={onClose} className="mega-compact">
                            <span className="mega-item-icon">
                                <MenuIcon icon={action.icon} />
                            </span>
                            <span>{action.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

function UserMenu() {
    const { user, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const displayName = user?.fullName || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';
    const avatarUrl = user?.avatarUrl;
    const initials = displayName.charAt(0).toUpperCase();

    const menuItems: MenuItem[] = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'My themes', href: '/dashboard/purchases', icon: Package },
        { label: 'Downloads', href: '/dashboard/downloads', icon: Download },
        { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    return (
        <div ref={ref} className="tm-user">
            <Button
                unstyled
                type="button"
                className={cn('tm-user-trigger', open && 'is-open')}
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label="Account menu"
            >
                {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={30} height={30} unoptimized className="tm-user-avatar" />
                ) : (
                    <span className="tm-user-initials" aria-hidden="true">{initials}</span>
                )}
                <ChevronDown width={14} height={14} aria-hidden="true" />
            </Button>

            {open && (
                <div className="tm-user-panel">
                    <div className="tm-user-identity">
                        <strong>{displayName}</strong>
                        <small>{displayEmail}</small>
                    </div>
                    <div className="tm-user-links">
                        {menuItems.map(item => (
                            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="mega-compact">
                                <span className="mega-item-icon">
                                    <MenuIcon icon={item.icon} />
                                </span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </div>
                    <Button
                        unstyled
                        type="button"
                        className="tm-user-signout"
                        onClick={() => {
                            signOut();
                            setOpen(false);
                        }}
                    >
                        <LogOut width={16} height={16} aria-hidden="true" />
                        <span>Sign out</span>
                    </Button>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════ */

export default function Navbar() {
    const { isAuthenticated } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeDesktopMenu, setActiveDesktopMenu] = useState<DropdownKey | null>(null);
    const [mobilePanel, setMobilePanel] = useState<DropdownKey | null>(null);
    const [megaBox, setMegaBox] = useState<{ left: number; width: number } | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);

    const hoverTimer = useRef<number | null>(null);
    const navRef = useRef<HTMLElement | null>(null);
    /* Hover only drives the menu where a real pointer exists. On touch the
       trigger stays a plain toggle, or the first tap would be swallowed. */
    const pointerIsFine = useRef(false);

    useEffect(() => {
        const query = window.matchMedia('(hover: hover) and (pointer: fine)');
        const sync = () => {
            pointerIsFine.current = query.matches;
        };
        sync();
        query.addEventListener('change', sync);
        return () => query.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isCommandSearchShortcut(e)) {
                e.preventDefault();
                setSearchOpen(prev => !prev);
                return;
            }
            if (e.key === 'Escape') {
                setActiveDesktopMenu(null);
                setMobileMenuOpen(false);
                setMobilePanel(null);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const clearHoverTimer = useCallback(() => {
        if (hoverTimer.current !== null) {
            window.clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
    }, []);

    useEffect(() => clearHoverTimer, [clearHoverTimer]);

    /* Hang the panel under its trigger's left edge, inset so the first column
       of text lines up with the trigger label, then clamp to the viewport. */
    const measureMenu = useCallback((menu: DropdownKey) => {
        const trigger = navRef.current?.querySelector<HTMLElement>(`[data-menu="${menu}"]`);
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const width = Math.min(MENU_WIDTH[menu], window.innerWidth - MENU_MARGIN * 2);
        const preferred = rect.left - MENU_TEXT_INSET;
        const left = Math.max(MENU_MARGIN, Math.min(preferred, window.innerWidth - width - MENU_MARGIN));

        setMegaBox({ left, width });
    }, []);

    const openDesktopMenu = useCallback(
        (menu: DropdownKey) => {
            clearHoverTimer();
            measureMenu(menu);
            setMobileMenuOpen(false);
            setMobilePanel(null);
            setActiveDesktopMenu(menu);
        },
        [clearHoverTimer, measureMenu],
    );

    const scheduleClose = useCallback(() => {
        clearHoverTimer();
        hoverTimer.current = window.setTimeout(() => setActiveDesktopMenu(null), CLOSE_DELAY_MS);
    }, [clearHoverTimer]);

    const handleTriggerEnter = useCallback(
        (menu: DropdownKey) => {
            if (!pointerIsFine.current) return;
            clearHoverTimer();

            /* Switching between triggers is instant — intent is established. */
            if (activeDesktopMenu) {
                openDesktopMenu(menu);
                return;
            }
            hoverTimer.current = window.setTimeout(() => openDesktopMenu(menu), OPEN_DELAY_MS);
        },
        [activeDesktopMenu, clearHoverTimer, openDesktopMenu],
    );

    const handlePointerLeave = useCallback(() => {
        if (!pointerIsFine.current) return;
        scheduleClose();
    }, [scheduleClose]);

    useEffect(() => {
        if (!activeDesktopMenu) return;
        const remeasure = () => measureMenu(activeDesktopMenu);
        window.addEventListener('resize', remeasure);
        return () => window.removeEventListener('resize', remeasure);
    }, [activeDesktopMenu, measureMenu]);

    /* Authoritative close. React derives pointer-leave from pointerout's
       relatedTarget, and Next renders <body> as a React element, so moving onto
       empty page background does not reliably produce one. */
    useEffect(() => {
        if (!activeDesktopMenu) return;

        const handlePointerOver = (event: PointerEvent) => {
            if (!pointerIsFine.current) return;
            const target = event.target as Element | null;
            if (target?.closest('.desktop-mega') || target?.closest('[data-menu]')) {
                clearHoverTimer();
                return;
            }
            scheduleClose();
        };

        document.addEventListener('pointerover', handlePointerOver);
        return () => document.removeEventListener('pointerover', handlePointerOver);
    }, [activeDesktopMenu, clearHoverTimer, scheduleClose]);

    useEffect(() => {
        const desktopQuery = window.matchMedia('(min-width: 1024px)');
        const handleModeChange = (event: MediaQueryListEvent) => {
            if (event.matches) {
                setMobileMenuOpen(false);
                setMobilePanel(null);
                return;
            }
            setActiveDesktopMenu(null);
        };
        desktopQuery.addEventListener('change', handleModeChange);
        return () => desktopQuery.removeEventListener('change', handleModeChange);
    }, []);

    const closeAllMenus = () => {
        clearHoverTimer();
        setActiveDesktopMenu(null);
        setMobileMenuOpen(false);
        setMobilePanel(null);
    };

    /* Still a real toggle: the path for touch, Enter and Space. */
    const toggleDesktopMenu = (menu: DropdownKey) => {
        clearHoverTimer();
        if (activeDesktopMenu === menu) {
            setActiveDesktopMenu(null);
            return;
        }
        openDesktopMenu(menu);
    };

    /* The href is the plain accounts URL so it is identical on server and
       client, and so middle-click / open-in-new-tab still work. `return_to` is
       appended at click time from the live location — previously this was held
       in state and populated from an effect, which is a cascading render for a
       value only ever needed at the moment of navigation. */
    const loginUrl = `${ACCOUNTS_URL}/lookup`;
    const signupUrl = `${ACCOUNTS_URL}/signup`;

    const goToAccounts = (destination: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
        // Let the browser handle modified clicks so new-tab behaviour survives.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        closeAllMenus();
        window.location.href = `${destination}?return_to=${encodeURIComponent(window.location.href)}`;
    };

    const menuOpen = Boolean(activeDesktopMenu) || mobileMenuOpen;

    return (
        <>
            <header className={`header ${scrolled ? 'scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}>
                <div className="container header-content">
                    <Link href="/" className="header-logo" aria-label="LetBuyy Themes home" onClick={closeAllMenus}>
                        <BrandLogo className="header-logo-image" width={152} height={49} priority />
                        {/* The one mark saying which property this is. A typographic
                            lockup rather than a second logo, so the platform wordmark
                            stays identical across every app. */}
                        <span className="header-property">Themes</span>
                    </Link>

                    <nav className="header-nav" aria-label="Main navigation" ref={navRef}>
                        {navLinks.map(link => {
                            if ('menu' in link) {
                                const expanded = activeDesktopMenu === link.menu;
                                return (
                                    <Button
                                        unstyled
                                        key={link.label}
                                        data-menu={link.menu}
                                        type="button"
                                        className={`header-nav-link ${expanded ? 'active' : ''}`}
                                        aria-expanded={expanded}
                                        aria-controls={`desktop-mega-${link.menu}`}
                                        onClick={() => toggleDesktopMenu(link.menu)}
                                        onPointerEnter={() => handleTriggerEnter(link.menu)}
                                        onPointerLeave={handlePointerLeave}
                                    >
                                        <span>{link.label}</span>
                                        <ChevronDown className="header-nav-chevron" width={15} height={15} aria-hidden="true" />
                                    </Button>
                                );
                            }

                            return (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="header-nav-link"
                                    onClick={closeAllMenus}
                                    onPointerEnter={handlePointerLeave}
                                >
                                    <span>{link.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="header-actions">
                        <SearchTrigger onClick={() => setSearchOpen(true)} />
                        <ThemeToggleButton unstyled className="tm-icon-button" label="Toggle color theme" />
                        {isAuthenticated ? (
                            <UserMenu />
                        ) : (
                            <>
                                <Link href={loginUrl} className="btn btn-ghost" onClick={goToAccounts(loginUrl)}>
                                    Log in
                                </Link>
                                <Link href={signupUrl} className="btn btn-primary" onClick={goToAccounts(signupUrl)}>
                                    Start for free
                                </Link>
                            </>
                        )}
                    </div>

                    <Button
                        unstyled
                        type="button"
                        className="tm-icon-button tm-mobile-search"
                        onClick={() => setSearchOpen(true)}
                        aria-label="Search themes"
                    >
                        <Search width={18} height={18} aria-hidden="true" />
                    </Button>

                    <Button
                        unstyled
                        className="mobile-menu-btn"
                        onClick={mobileMenuOpen ? closeAllMenus : () => setMobileMenuOpen(true)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`} />
                    </Button>
                </div>
            </header>

            {activeDesktopMenu && (
                <div
                    id={`desktop-mega-${activeDesktopMenu}`}
                    className="desktop-mega"
                    data-menu={activeDesktopMenu}
                    style={megaBox ? { left: `${megaBox.left}px`, width: `${megaBox.width}px` } : undefined}
                    onPointerEnter={clearHoverTimer}
                    onPointerLeave={handlePointerLeave}
                    onFocusCapture={clearHoverTimer}
                >
                    <div className="desktop-mega-card">
                        {activeDesktopMenu === 'browse' ? (
                            <DesktopBrowseMenu closeMenu={closeAllMenus} />
                        ) : (
                            <DesktopBuildMenu closeMenu={closeAllMenus} />
                        )}
                    </div>
                </div>
            )}

            {mobileMenuOpen && (
                <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile navigation">
                    <div className="mobile-drawer-header">
                        <Link href="/" className="mobile-drawer-logo" onClick={closeAllMenus}>
                            <BrandLogo className="mobile-drawer-logo-image" width={152} height={49} />
                        </Link>
                        <Link href={signupUrl} className="mobile-drawer-start" onClick={goToAccounts(signupUrl)}>
                            Start for free
                        </Link>
                        <Button unstyled className="mobile-drawer-close" onClick={closeAllMenus} aria-label="Close menu">
                            <X width={24} height={24} aria-hidden="true" />
                        </Button>
                    </div>

                    <div className="mobile-drawer-content">
                        {mobilePanel === 'browse' ? (
                            <MobilePanel
                                intro={browseIntro}
                                cards={categorySection.items}
                                sections={[priceSection, platformSection]}
                                closeMenu={closeAllMenus}
                                goBack={() => setMobilePanel(null)}
                            />
                        ) : mobilePanel === 'build' ? (
                            <MobilePanel
                                intro={buildIntro}
                                cards={buildHighlights}
                                sections={buildSections}
                                closeMenu={closeAllMenus}
                                goBack={() => setMobilePanel(null)}
                            />
                        ) : (
                            <div className="mobile-drawer-body">
                                <nav className="mobile-drawer-nav" aria-label="Mobile navigation">
                                    {navLinks.map(link => {
                                        if ('menu' in link) {
                                            return (
                                                <Button
                                                    unstyled
                                                    key={link.label}
                                                    type="button"
                                                    className="mobile-drawer-link"
                                                    onClick={() => setMobilePanel(link.menu)}
                                                >
                                                    <span>{link.label}</span>
                                                    <ChevronRight width={34} height={34} aria-hidden="true" />
                                                </Button>
                                            );
                                        }
                                        return (
                                            <Link
                                                key={link.label}
                                                href={link.href}
                                                className="mobile-drawer-link"
                                                onClick={closeAllMenus}
                                            >
                                                <span>{link.label}</span>
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </div>
                        )}
                    </div>

                    <div className="mobile-drawer-actions">
                        {isAuthenticated ? (
                            <Link href="/dashboard" className="btn btn-primary btn-block" onClick={closeAllMenus}>
                                Go to dashboard
                            </Link>
                        ) : (
                            <>
                                <Link href={loginUrl} className="btn btn-ghost btn-block" onClick={goToAccounts(loginUrl)}>
                                    Log in
                                </Link>
                                <Link href={signupUrl} className="btn btn-primary btn-block" onClick={goToAccounts(signupUrl)}>
                                    Start for free
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}

            {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
        </>
    );
}
