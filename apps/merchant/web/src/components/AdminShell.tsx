'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { MerchantNavigationLink } from './MerchantNavigationLink'
import { MerchantNavigationProvider, MerchantNavigationFeedback } from './MerchantNavigationProvider'
import HeaderBar from './HeaderBar'
import { MerchantSecurityContext } from './security/MerchantSecurityContext'
import { MediaRecoveryProvider } from './media/MediaRecoveryProvider'
import type { SessionUser } from '@/lib/auth/session'
import { AlertTriangle, AppNavigation, ArrowLeft, Button, LayoutDashboard, Navigation, NavigationLinkProvider, ToastProvider, acquireScrollLock, isNavItemActive, type AppNavigationSection, type NavigationItem } from '@letbuyy/ui'
import { getMerchantNavigation, type MerchantNavItem } from './merchantNavigation'
import { MerchantSidebarIcon } from './MerchantSidebarIcon'
import { getSettingsNavigationGroups } from './settings/settings-navigation'
import { PanelLeft } from 'lucide-react'

const CommandPalette = dynamic(() => import('./CommandPalette'))
const AISidebar = dynamic(() => import('./AISidebar'))

/** The one nav drawer, shared by the main nav and the settings nav. */
const DRAWER_ID = 'admin-nav-drawer'

/**
 * The page scroll container. The shell fills the viewport and does not scroll;
 * this element does — which is what keeps the header, the rail and the page's
 * curved top pinned while the page moves under them.
 */
const PAGE_SCROLL_ID = 'admin-page-scroll'

interface RailMenuState {
    item: AppNavigationSection['items'][number]
    top: number
    left: number
}

/**
 * Settings runs a second scrollport at tablet width and above: the panel is a fixed-height
 * card, so its content column is what moves there while PAGE_SCROLL_ID sits
 * still. Below 1024px the panel flattens and the page scroller takes over
 * again. Anything that acts on "the thing that scrolls" has to cover both.
 */
const SCROLLPORT_SELECTOR = `#${PAGE_SCROLL_ID}, .settings-content`

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface StoreData {
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
    trial_ends_at: string | null
    trial_status: string | null
    theme_id: string
    theme_settings: Record<string, unknown> | null
    custom_domain: string | null
}

export interface UserStore {
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
}

export interface StoreSwitcherResult { stores: UserStore[]; unavailable: boolean }

interface AdminShellProps {
    store: string
    storeData: StoreData
    user: SessionUser
    userStores: UserStore[]
    userStoresPromise?: Promise<StoreSwitcherResult>
    appPlatformEnabled: boolean
    children: React.ReactNode
}

export default function MerchantControlPlaneShell({ store, storeData, user, userStores, userStoresPromise, appPlatformEnabled, children }: AdminShellProps) {
    const pathname = usePathname()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [tabletDocked, setTabletDocked] = useState(false)
    const [aiPanelOpen, setAiPanelOpen] = useState(false)
    const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
    const [railMenu, setRailMenu] = useState<RailMenuState | null>(null)
    const railMenuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        try {
            setSidebarCollapsed(window.localStorage.getItem('letbuyy:merchant-sidebar-collapsed') === 'true')
        } catch {
            // Navigation remains usable when storage is blocked or unavailable.
        }
    }, [])

    const toggleSidebarCollapsed = () => {
        const next = !sidebarCollapsed
        setSidebarCollapsed(next)
        try {
            window.localStorage.setItem('letbuyy:merchant-sidebar-collapsed', String(next))
        } catch {
            // The preference is optional; the current session still collapses.
        }
    }

    // Client navigation retains the shell; close its mobile drawer on arrival.
    useEffect(() => { setSidebarOpen(false); setRailMenu(null) }, [pathname])

    // The router restores scroll on the DOCUMENT, which no longer scrolls, so a
    // client-side navigation out of a scrolled list would land halfway down the
    // next page. Nothing in this app touches scroll imperatively otherwise.
    // Both scrollports, because settings/layout.tsx persists across settings
    // routes: without the second selector, moving between two settings panes
    // opens the new one at the previous one's scroll offset.
    useEffect(() => {
        document.querySelectorAll(SCROLLPORT_SELECTOR).forEach(el => el.scrollTo(0, 0))
    }, [pathname])

    // The drawer is mobile-only. Tablet and desktop dock the primary rail.
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 769px)')
        const tablet = window.matchMedia('(min-width: 769px) and (max-width: 1023.98px)')
        const sync = () => {
            if (mq.matches) setSidebarOpen(false)
            setTabletDocked(tablet.matches)
        }
        sync()
        mq.addEventListener('change', sync)
        tablet.addEventListener('change', sync)
        return () => {
            mq.removeEventListener('change', sync)
            tablet.removeEventListener('change', sync)
        }
    }, [])

    // Modal drawer contract, ported verbatim from the settings drawer this
    // replaces, so unifying levels a11y UP rather than down: body-scroll lock,
    // initial focus, Escape-to-close, Tab trap, focus return.
    useEffect(() => {
        if (!sidebarOpen) return
        const previousEl = document.activeElement instanceof HTMLElement ? document.activeElement : null
        // The shared, reference-counted lock — not a local body.style.overflow
        // write. It freezes the page scroller (which is no longer the document)
        // and composes with any overlay opened on top of the drawer.
        const releaseScrollLock = acquireScrollLock()
        document.getElementById(DRAWER_ID)?.focus()

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') { setSidebarOpen(false); return }
            if (e.key !== 'Tab') return
            const drawer = document.getElementById(DRAWER_ID)
            if (!drawer) return
            const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
                .filter(el => !el.closest('[hidden]'))
            if (!focusable.length) { e.preventDefault(); drawer.focus(); return }
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement
            if (active === drawer) {
                e.preventDefault()
                if (e.shiftKey) last.focus()
                else first.focus()
                return
            }
            if (!drawer.contains(active)) { e.preventDefault(); first.focus(); return }
            if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); return }
            if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            releaseScrollLock()
            if (previousEl?.isConnected) previousEl.focus()
        }
    }, [sidebarOpen])

    useEffect(() => {
        if (!railMenu) return
        function closeOnOutsidePointer(event: PointerEvent) {
            if (event.target instanceof Node && (railMenuRef.current?.contains(event.target) || document.getElementById(DRAWER_ID)?.contains(event.target))) return
            setRailMenu(null)
        }
        document.addEventListener('pointerdown', closeOnOutsidePointer)
        return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
    }, [railMenu])

    const isDraft = storeData.status === 'draft'
    const isDashboardPage = /\/dashboard\/?$/.test(pathname ?? '')
    // Segment-aware, not substring. `/{store}/…` puts the tenant's own subdomain
    // in the path, and neither `editor` nor `settings` is a reserved subdomain —
    // so a store called `editor-shop` would make `.includes('/editor')` true and
    // lose the entire shell on every one of its pages.
    const routeSegments = (pathname ?? '').split('/').filter(Boolean).slice(1)
    const isSettingsPage = routeSegments[0] === 'settings'
    // Evaluated BEFORE isSettingsPage so /{store}/settings/subscribe/checkout
    // goes full-screen rather than landing in the settings panel.
    const isFullScreenFlow = hasSegmentRun(routeSegments, ['access_account', 'checkout'])
        || hasSegmentRun(routeSegments, ['subscribe', 'checkout'])
        || routeSegments.includes('editor')

    // Full-screen flows bypass the admin shell entirely
    if (isFullScreenFlow) {
        return <NavigationLinkProvider linkComponent={MerchantNavigationLink}><ToastProvider><MerchantSecurityContext.Provider key={`${user.id}:${store}:${storeData.id}`} value={{ actorId: user.id, store, siteId:storeData.id }}>
                                    <MediaRecoveryProvider store={store}>{children}</MediaRecoveryProvider>
                                </MerchantSecurityContext.Provider></ToastProvider></NavigationLinkProvider>
    }

    // The desktop shell always owns the primary rail. Settings adds its own
    // adjacent navigation column; only the small-screen drawer swaps its rows.
    const navigationSections = isSettingsPage && sidebarOpen
        ? buildSettingsNavigationSections(store, appPlatformEnabled)
        : buildNavigationSections(store, storeData.site_type, appPlatformEnabled)
    const railCollapsed = isSettingsPage || sidebarCollapsed || tabletDocked

    function showRailMenu(target: EventTarget | null) {
        if (!railCollapsed || sidebarOpen || !(target instanceof Element)) return
        const row = target.closest<HTMLElement>('[data-navigation-item]')
        const sidebar = document.getElementById(DRAWER_ID)
        if (!row || !sidebar?.contains(row)) { setRailMenu(null); return }
        const item = navigationSections.flatMap(section => section.items).find(entry => entry.id === row.dataset.navigationItem)
        if (!item) { setRailMenu(null); return }
        const rect = row.getBoundingClientRect()
        setRailMenu({ item, top: Math.max(8, Math.min(rect.top, window.innerHeight - 280)), left: rect.right + 8 })
    }

    function closeRailMenu(relatedTarget: EventTarget | null) {
        if (relatedTarget instanceof Node && railMenuRef.current?.contains(relatedTarget)) return
        setRailMenu(null)
    }

    // Hover is unavailable on many tablets. A tap on a collapsed section
    // opens the same submenu; its parent destination remains in that menu.
    function openRailMenuOnTap(target: EventTarget | null, event: { preventDefault(): void; stopPropagation(): void }) {
        if (!railCollapsed || sidebarOpen || !window.matchMedia('(hover: none)').matches || !(target instanceof Element)) return
        const row = target.closest<HTMLElement>('[data-navigation-item]')
        const item = navigationSections.flatMap(section => section.items).find(entry => entry.id === row?.dataset.navigationItem)
        if (!row || !item?.children?.length) return
        event.preventDefault()
        event.stopPropagation()
        const rect = row.getBoundingClientRect()
        setRailMenu({ item, top: Math.max(8, Math.min(rect.top, window.innerHeight - 280)), left: rect.right + 8 })
    }

    // Phones use an overlay drawer pinned to the header. On tablet the closed
    // icon rail stays in flow so it never covers the content or settings nav.
    // z-40 keeps the phone drawer over the scrim and under the header.
    const drawerClass = 'admin-panel-sidebar admin-panel-drawer fixed left-0 top-[var(--admin-header-height)] z-40 flex h-[calc(100dvh_-_var(--admin-header-height))]'

    // At tablet+ the rail is a plain flex child of a frame that already has a
    // definite height, so it stretches on its own: no sticky, no viewport math,
    // and explicitly not self-start (which would stop it stretching).
    const railClass = 'lg:static lg:z-auto lg:h-full lg:min-h-0'

    // An open settings drawer is phone-only. The closed rail stays docked from
    // tablet upward beside the settings navigation column.
    const sidebarOpenClass = isSettingsPage
        ? `${drawerClass} lg:hidden`
        : `${drawerClass} ${railClass}`

    const sidebarClosedClass = `admin-panel-sidebar hidden lg:flex ${railClass}`

    return (
        <MerchantNavigationProvider><NavigationLinkProvider linkComponent={MerchantNavigationLink}><ToastProvider>
            <div className="admin-shell">
                <HeaderBar
                    store={store}
                    storeData={storeData}
                    user={user}
                    userStores={userStores}
                    userStoresPromise={userStoresPromise}
                    appPlatformEnabled={appPlatformEnabled}
                    onMenuToggle={() => setSidebarOpen(o => !o)}
                    onSearchOpen={() => setCmdPaletteOpen(true)}
                    onAISidebarToggle={() => setAiPanelOpen(!aiPanelOpen)}
                    showAssistant={!isSettingsPage}
                    isSettingsPage={!!isSettingsPage}
                    isMenuOpen={sidebarOpen}
                    menuDrawerId={DRAWER_ID}
                />
                <MerchantNavigationFeedback />

                {sidebarOpen && (
                    <Button
                        unstyled
                        type="button"
                        className="admin-sidebar-overlay active"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close navigation"
                    />
                )}

                <AppNavigation
                    linkComponent={MerchantNavigationLink}
                    sections={navigationSections}
                    width="sm"
                    // One frame for every route, settings included: it reserves the
                    // header, paints the dark backing the curve resolves against,
                    // and — with fixedViewport — makes .admin-page-scroll the app's
                    // single scroll container, which is what pins the curve.
                    fixedViewport
                    className="admin-panel-frame"
                    // Settings paints the dark backing for its second navigation
                    // column inside this same rounded page plane.
                    mainClassName={isSettingsPage ? 'admin-page-scroll admin-page-scroll--settings' : 'admin-page-scroll'}
                    mainProps={{ id: PAGE_SCROLL_ID }}
                    sidebarClassName={`${sidebarOpen ? sidebarOpenClass : sidebarClosedClass} ${railCollapsed && !sidebarOpen ? 'admin-panel-sidebar--collapsed' : ''}`}
                    sidebarProps={{
                        id: DRAWER_ID,
                        tabIndex: -1,
                        onMouseOver: (event) => showRailMenu(event.target),
                        onFocusCapture: (event) => showRailMenu(event.target),
                        onClickCapture: (event) => openRailMenuOnTap(event.target, event),
                        onMouseLeave: (event) => closeRailMenu(event.relatedTarget),
                        onScrollCapture: () => setRailMenu(null),
                        onKeyDown: (event) => { if (event.key === 'Escape') setRailMenu(null) },
                        ...(sidebarOpen ? {
                            role: 'dialog',
                            'aria-modal': true,
                            'aria-label': isSettingsPage ? 'Settings navigation' : 'Main navigation',
                        } : {}),
                    }}
                    brand={isSettingsPage && sidebarOpen ? (
                        <Link href={`/${store}/dashboard`} className="admin-drawer-back">
                            <ArrowLeft size={16} aria-hidden="true" />
                            <span>Back to home</span>
                        </Link>
                    ) : undefined}
                    footer={isSettingsPage && sidebarOpen ? undefined : (
                        <div className="admin-sidebar-footer-row">
                            <Navigation
                                linkComponent={MerchantNavigationLink}
                                ariaLabel="Settings navigation"
                                items={buildFooterItems(store, storeData.site_type, pathname ?? '/', appPlatformEnabled)}
                            />
                            {!isSettingsPage && <Button unstyled type="button" className="admin-sidebar-collapse-toggle"
                                onClick={toggleSidebarCollapsed}
                                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                aria-controls={DRAWER_ID}
                                aria-expanded={!sidebarCollapsed}
                                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                                <PanelLeft size={17} strokeWidth={1.8} aria-hidden="true" />
                            </Button>}
                        </div>
                    )}
                >
                    {isSettingsPage ? (
                        // Re-establishes a definite height inside the scrollport so
                        // the desktop settings panel — itself a fixed-height grid
                        // with its own inner scroller — has something to resolve its
                        // percentages against. The header offset it used to carry
                        // inline now belongs to .admin-panel-frame, once, for
                        // every route.
                        <div className="admin-settings-wrapper">
                            {isDraft && (
                                <div className="admin-draft-banner">
                                    <AlertTriangle size={16} aria-hidden="true" />
                                    <span className="admin-draft-banner-message">
                                        Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                                    </span>
                                </div>
                            )}

                            <MerchantSecurityContext.Provider key={`${user.id}:${store}:${storeData.id}`} value={{ actorId: user.id, store, siteId:storeData.id }}>
                                    <MediaRecoveryProvider store={store}>{children}</MediaRecoveryProvider>
                                </MerchantSecurityContext.Provider>
                        </div>
                    ) : (
                        // min-h-full, not h-full: the scrollport is definite now, so
                        // a *minimum* is exactly right — a short page still fills it,
                        // a long one grows past it and scrolls. No background here
                        // either: .admin-page-scroll paints it, and an opaque child
                        // would square off the corners it just rounded.
                        <div className={`flex min-h-full min-w-0 ${aiPanelOpen ? 'ai-open' : ''}`}>
                            <div className="min-w-0 flex-1">
                                {isDraft && !isDashboardPage && (
                                    <div className="admin-draft-banner">
                                        <AlertTriangle size={16} aria-hidden="true" />
                                        <span className="admin-draft-banner-message">
                                            Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                                        </span>
                                    </div>
                                )}

                                <MerchantSecurityContext.Provider key={`${user.id}:${store}:${storeData.id}`} value={{ actorId: user.id, store, siteId:storeData.id }}>
                                    <MediaRecoveryProvider store={store}>{children}</MediaRecoveryProvider>
                                </MerchantSecurityContext.Provider>

                            </div>

                            {/* AI sidebar panel — inline, pushes main content */}
                            {aiPanelOpen && (
                                <AISidebar
                                    store={store}
                                    storeData={storeData}
                                    onClose={() => setAiPanelOpen(false)}
                                />
                            )}
                        </div>
                    )}
                </AppNavigation>

                {railMenu && railCollapsed && !sidebarOpen && (
                    <nav ref={railMenuRef} className="admin-rail-popover" style={{ top: railMenu.top, left: railMenu.left }}
                        aria-label={`${railMenu.item.label} navigation`}
                        onMouseLeave={(event) => {
                            if (event.relatedTarget instanceof Node && document.getElementById(DRAWER_ID)?.contains(event.relatedTarget)) return
                            setRailMenu(null)
                        }}
                        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setRailMenu(null) }}
                        onKeyDown={(event) => { if (event.key === 'Escape') { setRailMenu(null); document.getElementById(DRAWER_ID)?.focus() } }}>
                        {railMenu.item.href && <MerchantNavigationLink href={railMenu.item.href} className="admin-rail-popover-title" onClick={() => setRailMenu(null)}>{railMenu.item.label}</MerchantNavigationLink>}
                        {!railMenu.item.href && <span className="admin-rail-popover-title">{railMenu.item.label}</span>}
                        {railMenu.item.children?.map(child => child.href && (
                            <MerchantNavigationLink key={child.id} href={child.href} className="admin-rail-popover-link"
                                aria-current={pathname && isNavItemActive(pathname, child.href) ? 'page' : undefined}
                                onClick={() => setRailMenu(null)}>{child.label}</MerchantNavigationLink>
                        ))}
                    </nav>
                )}

                {/* Command palette */}
                {cmdPaletteOpen && (
                    <CommandPalette
                        store={store}
                        storeName={storeData.name || storeData.store_name || store}
                        siteType={storeData.site_type}
                        appPlatformEnabled={appPlatformEnabled}
                        onClose={() => setCmdPaletteOpen(false)}
                    />
                )}
            </div>
        </ToastProvider></NavigationLinkProvider></MerchantNavigationProvider>
    )
}

/** True when `run` appears as consecutive path segments — `/a/b` as a unit, not as a substring. */
function hasSegmentRun(segments: string[], run: string[]): boolean {
    return segments.some((_, i) => run.every((part, offset) => segments[i + offset] === part))
}

function buildNavigationSections(store: string, siteType: string | null | undefined, appPlatformEnabled: boolean): AppNavigationSection[] {
    const groups = getMerchantNavigation(siteType, appPlatformEnabled)
    const sectionItems: Record<'primary' | 'sales' | 'apps' | 'bottom', MerchantNavItem[]> = {
        primary: [],
        sales: [],
        apps: [],
        bottom: [],
    }

    for (const item of groups) {
        sectionItems[item.section ?? 'primary'].push(item)
    }

    return [
        { items: sectionItems.primary.flatMap((item) => toNavigationItems(store, item)) },
        { title: 'Sales channels', items: sectionItems.sales.flatMap((item) => toNavigationItems(store, item)) },
        { title: 'Apps', items: sectionItems.apps.flatMap((item) => toNavigationItems(store, item)) },
    ].filter((section) => section.items.length > 0)
}

/**
 * The settings nav, shaped for the SAME AppNavigation the main nav uses — which
 * is what makes the mobile settings drawer identical to the main drawer rather
 * than a second look-alike. `active` is deliberately NOT set: AppNavigation
 * injects isNavItemActive() with the same predicate the settings rail uses.
 */
function buildSettingsNavigationSections(store: string, appPlatformEnabled: boolean): AppNavigationSection[] {
    return [
        {
            // No visible heading (parity with the main drawer's first section),
            // but the <nav> landmark still needs a truthful accessible name.
            ariaLabel: 'Settings',
            items: [{
                id: 'settings-home',
                label: 'Dashboard',
                // /{store}/settings is a prefix of every other settings href, so
                // without `exact` it would light up on all 16 child routes.
                exact: true,
                href: `/${store}/settings`,
                icon: <LayoutDashboard className="letbuyy-icon" aria-hidden="true" />,
            }],
        },
        ...getSettingsNavigationGroups(appPlatformEnabled).map((group) => ({
            title: group.title,
            items: group.items.map((item) => {
                const ItemIcon = item.Icon
                return {
                    id: `settings:${item.href}`,
                    label: item.label,
                    href: `/${store}/settings/${item.href}`,
                    icon: <ItemIcon className="letbuyy-icon" aria-hidden="true" />,
                }
            }),
        })),
    ]
}

function buildFooterItems(store: string, siteType: string | null | undefined, pathname: string, appPlatformEnabled: boolean): NavigationItem[] {
    const groups = getMerchantNavigation(siteType, appPlatformEnabled)
    return groups
        .filter((item) => item.section === 'bottom')
        .map((item) => {
            const children = (item.children ?? []).map((child) => ({
                id: `${item.path}:${child.path}`,
                label: child.label,
                href: `/${store}/${child.path}`,
                active: isNavItemActive(pathname, `/${store}/${child.path}`),
            }))
            return {
                id: item.path,
                label: item.label,
                href: children.length === 0 ? `/${store}/${item.path}` : undefined,
                icon: <MerchantSidebarIcon name={item.icon} label={item.label} />,
                active: isNavItemActive(pathname, `/${store}/${item.path}`),
                children: children.length > 0 ? children : undefined,
            }
        })
}

function toNavigationItems(store: string, item: MerchantNavItem): AppNavigationSection['items'] {
    const children = (item.children ?? []).map((child) => ({
        id: `${item.path}:${child.path}`,
        label: child.label,
        href: `/${store}/${child.path}`,
        exact: child.exact,
    }))

    // A parent links only when it is a destination its children do not already
    // own. Groups whose own path is literally one of their children (Money ->
    // Billing, Content -> Pages) would otherwise render the same href twice in
    // one nav, giving two rows the same accessible name.
    const duplicatesAChild = (item.children ?? []).some((child) => child.path === item.path)

    return [{
        id: item.path,
        label: item.label,
        href: duplicatesAChild ? undefined : `/${store}/${item.path}`,
        exact: item.exact,
        icon: <MerchantSidebarIcon name={item.icon} label={item.label} />,
        children: children.length > 0 ? children : undefined,
    }]
}
