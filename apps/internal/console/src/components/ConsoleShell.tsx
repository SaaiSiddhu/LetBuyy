'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Modal, AppNavigation, Navigation, isNavItemActive, ThemeToggleButton, type AppNavigationSection } from '@letbuyy/ui';
import {
    Activity, ArrowRight, ArrowUpRight, ChartNoAxesCombined, ChevronDown,
    ChevronRight, ClipboardCheck, Command, FileClock,
    LayoutDashboard, Menu, Search, Settings2, ShieldCheck,
    ShoppingBag, Store, Users, Wallet, MessageSquare,
} from 'lucide-react';
import { ConsoleRefresh } from './ConsoleRefresh';

const iconSize = 18;
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const allSections: AppNavigationSection[] = [
    { ariaLabel: 'Home', items: [{ id: 'overview', label: 'Overview', href: '/dashboard', icon: <LayoutDashboard size={iconSize} /> }] },
    { title: 'Business', items: [
        { id: 'merchants-group', label: 'Merchants', icon: <Store size={iconSize} />, children: [
            { id: 'stores', label: 'Store directory', href: '/stores' },
            { id: 'merchants', label: 'Merchant profiles', href: '/merchants' },
            { id: 'founding', label: 'Founding merchants', href: '/founding' },
        ] },
        { id: 'people-group', label: 'People & access', icon: <Users size={iconSize} />, children: [
            { id: 'users', label: 'Users', href: '/users' },
            { id: 'employees', label: 'Team & permissions', href: '/employees' },
        ] },
        { id: 'finance-group', label: 'Finance', icon: <Wallet size={iconSize} />, children: [
            { id: 'revenue', label: 'Revenue', href: '/revenue' },
            { id: 'subscriptions', label: 'Subscriptions', href: '/subscriptions' },
            { id: 'money', label: 'Reconciliation', href: '/money-reconciliation' },
        ] },
        { id: 'reviews-group', label: 'Reviews & safety', icon: <ShieldCheck size={iconSize} />, children: [
            { id: 'marketplace-listings', label: 'Marketplace listings', href: '/marketplace-listings' },
            { id: 'reels', label: 'Reel reviews', href: '/reels' },
            { id: 'trust', label: 'Trust & safety', href: '/trust-safety' },
            { id: 'marketplace', label: 'Ecosystem governance', href: '/marketplace-governance' },
        ] },
        { id: 'merchant-messages', label: 'Merchant messages', href: '/merchant-messages', icon: <MessageSquare size={iconSize} /> },
        { id: 'support', label: 'Support', href: '/support', icon: <MessageSquare size={iconSize} /> },
        { id: 'analytics', label: 'Analytics', href: '/analytics', icon: <ChartNoAxesCombined size={iconSize} /> },
    ] },
    { title: 'Platform', items: [
        { id: 'operations-group', label: 'Operations', icon: <Activity size={iconSize} />, children: [
            { id: 'operations', label: 'Platform health & jobs', href: '/operations' },
            { id: 'incidents', label: 'Incidents', href: '/incidents' },
            { id: 'risk', label: 'Risk detection', href: '/risk' },
            { id: 'compliance', label: 'Compliance', href: '/compliance' },
            { id: 'developers', label: 'Developer operations', href: '/developers' },
        ] },
        { id: 'approvals', label: 'Approvals', href: '/approvals', icon: <ClipboardCheck size={iconSize} /> },
        { id: 'audit', label: 'Audit log', href: '/audit-logs', icon: <FileClock size={iconSize} /> },
        { id: 'settings', label: 'Settings', href: '/settings', icon: <Settings2 size={iconSize} /> },
    ] },
];

export function ConsoleShell({ children, email, local, appPlatformEnabled }: { children: ReactNode; email: string; local: boolean; appPlatformEnabled: boolean }) {
    const sections = allSections.map(section => ({ ...section, items: section.items.map(item => ({ ...item, children: item.children?.filter(child => appPlatformEnabled || child.id !== 'marketplace' && child.id !== 'developers') })) }));
    const workspaces = sections.flatMap(section => section.items.flatMap(item =>
    item.children?.length ? item.children.map(child => ({ label: String(child.label), href: child.href!, group: String(item.label) }))
        : [{ label: String(item.label), href: item.href!, group: typeof section.title === 'string' ? section.title : 'Home' }]
));
    const pathname = usePathname();
    const [previousPathname, setPreviousPathname] = useState(pathname);
    const [mobileOpen, setMobileOpen] = useState(false);
    const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const search = useRef<HTMLInputElement>(null);
    const account = useRef<HTMLDetailsElement>(null);
    const finderReturn = useRef<HTMLElement | null>(null);
    const searchHeading = useId();
    if (previousPathname !== pathname) {
        setPreviousPathname(pathname);
        setSearchOpen(false);
        setMobileOpen(false);
    }
    const current = workspaces.filter(w => pathname === w.href || pathname.startsWith(w.href + '/')).sort((a, b) => b.href.length - a.href.length)[0];
    const filtered = workspaces.filter(w => `${w.label} ${w.group}`.toLowerCase().includes(query.toLowerCase().trim()));

    function openSearch() {
        const active = document.activeElement;
        finderReturn.current = active instanceof HTMLElement && active !== document.body && !active.closest('[role="dialog"]') ? active : document.getElementById('console-workspace-finder');
        if (account.current) account.current.open = false;
        setQuery('');
        setSearchOpen(true);
    }
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
            if (event.key === 'Escape' && account.current?.open) {
                account.current.open = false;
                account.current.querySelector('summary')?.focus();
            }
        };
        const onOutside = (event: PointerEvent) => {
            if (account.current?.open && event.target instanceof Node && !account.current.contains(event.target)) account.current.open = false;
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onOutside);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onOutside); };
    }, []);
    useEffect(() => { if (account.current) account.current.open = false; }, [pathname]);
    useEffect(() => { if (searchOpen) search.current?.focus(); }, [searchOpen]);

    const brand = <Link href="/dashboard" className="console-brand" aria-label="LetBuyy Console overview">
        <span className="console-brand-mark"><ShoppingBag size={22} strokeWidth={1.8} /></span>
        <span><strong>LetBuyy<span className="text-primary">.</span></strong><small>Internal operations</small></span>
    </Link>;
    const sidebarFooter = <div className="console-sidebar-footer"><ShieldCheck size={16} /><span>{local ? 'Local workspace' : 'Internal workspace'}<small>Access controlled · activity audited</small></span></div>;
    const topBar = <div className="console-topbar">
        <div className="flex min-w-0 items-center gap-3">
            <Button unstyled className="console-icon-button console-mobile-trigger" type="button" disabled={!ready} aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} /></Button>
            <nav aria-label="Breadcrumb" className="console-breadcrumb"><span>Console</span><ChevronRight size={14} /><span aria-current="page">{current?.label || 'Workspace'}</span></nav>
        </div>
        <div className="console-topbar-actions">
            <Button id="console-workspace-finder" unstyled type="button" className="console-search-trigger" disabled={!ready} aria-label="Find a workspace" onClick={openSearch}><Search size={16} /><span>Find a workspace…</span><kbd>⌘ K</kbd></Button>
            <ConsoleRefresh compact />
            <ThemeToggleButton unstyled className="console-icon-button" disabled={!ready} label="Change console theme" />
            <Link href="/approvals" className="console-icon-button" aria-label="Open approvals" title="Approvals"><ClipboardCheck size={18} /></Link>
            <details ref={account} className="console-account"><summary aria-label="Account menu"><span className="console-avatar">{email.slice(0, 2).toUpperCase()}</span><ChevronDown size={14} /></summary><div className="console-account-menu"><span>Signed in as<strong>{email}</strong></span><Link href="/settings">Workspace settings<Settings2 size={16} /></Link><form action="/api/console-auth/logout" method="post"><Button unstyled type="submit">Sign out<ArrowUpRight size={16} /></Button></form></div></details>
        </div>
    </div>;

    return <>
        <a className="console-skip-link" href="#console-main">Skip to workspace</a>
        <AppNavigation sections={sections} brand={brand} footer={sidebarFooter} topBar={topBar} fixedViewport
            className="console-shell" sidebarClassName="hidden lg:flex console-sidebar" mainClassName="console-content" mainProps={{ id: 'console-main', tabIndex: -1 }}>
            {children}
        </AppNavigation>
        <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation" className="console-mobile-modal">
            <div className="console-mobile-nav"><div className="flex items-center justify-between gap-4">{brand}</div>
                <Button unstyled className="console-search-trigger" onClick={() => { setMobileOpen(false); openSearch(); }}><Search size={16} />Find a workspace</Button>
                {sections.map((section, index) => <div key={index}><p className="console-mobile-group">{section.title || 'Home'}</p><Navigation ariaLabel={String(section.title || 'Home')} items={section.items.map(item => ({ ...item, active: isNavItemActive(pathname, item.href), children: item.children?.map(child => ({ ...child, active: isNavItemActive(pathname, child.href) })) }))} /></div>)}
            </div>
        </Modal>
        <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Find a workspace" className="console-command-modal" initialFocusRef={search} returnFocusRef={finderReturn}>
            <div className="console-command-header"><Search size={20} /><label id={searchHeading} className="sr-only" htmlFor="console-workspace-search">Find a workspace</label><Input unstyled id="console-workspace-search" ref={search} autoFocus type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search operations, people, finance…" /></div>
            <p className="console-command-caption">Workspaces <span role="status">{filtered.length} results</span></p>
            <div className="console-command-results">{filtered.length ? filtered.map(w => <Link key={w.href} href={w.href} onClick={() => setSearchOpen(false)}><span className="console-command-result-icon"><ArrowUpRight size={16} /></span><span><strong>{w.label}</strong><small>{w.group}</small></span><ArrowRight size={16} /></Link>) : <p className="console-command-empty">No workspaces match “{query}”. Try merchants, people or approvals.</p>}</div>
            <div className="console-command-footer"><Command size={14} /> K to open <span>Tab to move · Enter to open · Esc to close</span></div>
        </Modal>
    </>;
}
