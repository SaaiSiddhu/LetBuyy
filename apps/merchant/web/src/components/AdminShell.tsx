'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import HeaderBar from './HeaderBar'
import TrialBanner from './TrialBanner'
import CommandPalette from './CommandPalette'
import AISidebar from './AISidebar'
import { MerchantSecurityContext } from './security/MerchantSecurityContext'
import type { SessionUser } from '@/lib/auth/session'
import { AppNavigation, Button, LayoutDashboard, MaterialIcon, Navigation, ToastProvider, acquireScrollLock, isNavItemActive, type AppNavigationSection, type NavigationItem } from '@letbuyy/ui'
import { getMerchantNavigation, type MerchantNavItem } from './merchantNavigation'
import { SETTINGS_NAV_GROUPS } from './settings/settings-navigation'

/** The one nav drawer, shared by the main nav and the settings nav. */
const DRAWER_ID = 'admin-nav-drawer'

/**
 * The page scroll container. The shell fills the viewport and does not scroll;
 * this element does — which is what keeps the header, the rail and the page's
 * curved top pinned while the page moves under them.
 */
const PAGE_SCROLL_ID = 'admin-page-scroll'

/**
 * Settings runs a second scrollport at >=1024px: the panel is a fixed-height
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

interface AdminShellProps {
    store: string
    storeData: StoreData
    user: SessionUser
    userStores: UserStore[]
    children: React.ReactNode
}

export default function MerchantControlPlaneShell({ store, storeData, user, userStores, children }: AdminShellProps) {
    const pathname = usePathname()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [aiPanelOpen, setAiPanelOpen] = useState(false)
    const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)

    // Close on route change. AppNavigation renders plain <a href>, so today the
    // drawer only *appears* to close because a full document load remounts the
    // tree — the back-arrow is a real next/link and would otherwise leave it open.
    useEffect(() => { setSidebarOpen(false) }, [pathname])

    // The router restores scroll on the DOCUMENT, which no longer scrolls, so a
    // client-side navigation out of a scrolled list would land halfway down the
    // next page. Nothing in this app touches scroll imperatively otherwise.
    // Both scrollports, because settings/layout.tsx persists across settings
    // routes: without the second selector, moving between two settings panes
    // opens the new one at the previous one's scroll offset.
    useEffect(() => {
        document.querySelectorAll(SCROLLPORT_SELECTOR).forEach(el => el.scrollTo(0, 0))
    }, [pathname])

    // The drawer only exists below lg. Without this, opening at 900px and then
    // widening leaves the z-39 scrim painted over the whole app (its .active
    // display:block rule is not media-gated) and role="dialog" on the desktop rail.
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)')
        const sync = () => { if (mq.matches) setSidebarOpen(false) }
        sync()
        mq.addEventListener('change', sync)
        return () => mq.removeEventListener('change', sync)
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
            if (active === drawer) { e.preventDefault(); e.shiftKey ? last.focus() : first.focus(); return }
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

    const isDraft = storeData.status === 'draft'
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
        return <ToastProvider><MerchantSecurityContext.Provider key={`${user.id}:${store}`} value={{ actorId: user.id, store }}>
                                    {children}
                                </MerchantSecurityContext.Provider></ToastProvider>
    }

    // Settings routes reuse the SAME shell and the SAME drawer — only the nav
    // data, the brand slot and the sidebar's desktop visibility differ. That is
    // what makes the mobile settings drawer identical to the main one by
    // construction rather than by two stylesheets kept in sync by hand.
    const navigationSections = isSettingsPage
        ? buildSettingsNavigationSections(store)
        : buildNavigationSections(store, storeData.site_type)

    // Below lg the rail is an overlay drawer, pinned to the page plane's top edge
    // so its curve lines up with the sheet's exactly. z-40 keeps it over the
    // scrim (39) and under the header (50), whose popovers hang below the bar.
    const drawerClass = 'admin-panel-sidebar admin-panel-drawer fixed left-0 top-[var(--admin-header-height)] z-40 flex h-[calc(100dvh_-_var(--admin-header-height))]'

    // At lg+ the rail is a plain flex child of a frame that already has a
    // definite height, so it stretches on its own: no sticky, no viewport math,
    // and explicitly not self-start (which would stop it stretching).
    const railClass = 'lg:static lg:z-auto lg:h-full lg:min-h-0'

    // On settings the drawer is mobile-only: the desktop settings panel brings
    // its own rail, so >=1024px must never see this one.
    const sidebarOpenClass = isSettingsPage
        ? `${drawerClass} lg:hidden`
        : `${drawerClass} ${railClass}`

    const sidebarClosedClass = isSettingsPage
        ? 'admin-panel-sidebar hidden'
        : `admin-panel-sidebar hidden lg:flex ${railClass}`

    return (
        <ToastProvider>
            <div className="admin-shell">
                <HeaderBar
                    store={store}
                    storeData={storeData}
                    user={user}
                    userStores={userStores}
                    onMenuToggle={() => setSidebarOpen(o => !o)}
                    onSearchOpen={() => setCmdPaletteOpen(true)}
                    onAISidebarToggle={isSettingsPage ? () => {} : () => setAiPanelOpen(!aiPanelOpen)}
                    isSettingsPage={!!isSettingsPage}
                    isMenuOpen={sidebarOpen}
                    menuDrawerId={DRAWER_ID}
                />

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
                    sections={navigationSections}
                    width="sm"
                    // One frame for every route, settings included: it reserves the
                    // header, paints the dark backing the curve resolves against,
                    // and — with fixedViewport — makes .admin-page-scroll the app's
                    // single scroll container, which is what pins the curve.
                    fixedViewport
                    className="admin-panel-frame"
                    // --flush: the sheet takes its OWN leading corner because no
                    // rail sits in it. On settings the shared rail is hidden at
                    // every width (the panel brings its own), so without this the
                    // page would be curved top-right and square top-left at
                    // >=1024px. Below lg the CSS handles the same thing by
                    // breakpoint, since there the rail is an overlay on every route.
                    mainClassName={isSettingsPage ? 'admin-page-scroll admin-page-scroll--flush' : 'admin-page-scroll'}
                    mainProps={{ id: PAGE_SCROLL_ID }}
                    sidebarClassName={sidebarOpen ? sidebarOpenClass : sidebarClosedClass}
                    sidebarProps={{
                        id: DRAWER_ID,
                        tabIndex: -1,
                        ...(sidebarOpen ? {
                            role: 'dialog',
                            'aria-modal': true,
                            'aria-label': isSettingsPage ? 'Settings navigation' : 'Main navigation',
                        } : {}),
                    }}
                    brand={isSettingsPage ? (
                        <Link href={`/${store}/dashboard`} className="admin-drawer-back">
                            <MaterialIcon name="arrow_back" size={16} />
                            <span>Back to home</span>
                        </Link>
                    ) : undefined}
                    footer={isSettingsPage ? undefined : (
                        <Navigation
                            ariaLabel="Settings navigation"
                            items={buildFooterItems(store, storeData.site_type, pathname ?? '/')}
                        />
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
                                    <MaterialIcon name="warning" size={16} />
                                    <span className="admin-draft-banner-message">
                                        Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                                    </span>
                                </div>
                            )}

                            <MerchantSecurityContext.Provider key={`${user.id}:${store}`} value={{ actorId: user.id, store }}>
                                    {children}
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
                                {isDraft && (
                                    <div className="admin-draft-banner">
                                        <MaterialIcon name="warning" size={16} />
                                        <span className="admin-draft-banner-message">
                                            Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                                        </span>
                                    </div>
                                )}

                                <MerchantSecurityContext.Provider key={`${user.id}:${store}`} value={{ actorId: user.id, store }}>
                                    {children}
                                </MerchantSecurityContext.Provider>

                                {pathname?.endsWith('/dashboard') && (
                                    <TrialBanner
                                        storeSlug={store}
                                        trialEndsAt={storeData.trial_ends_at}
                                        trialStatus={storeData.trial_status}
                                    />
                                )}
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

                {/* Command palette */}
                {cmdPaletteOpen && (
                    <CommandPalette
                        store={store}
                        storeName={storeData.name || storeData.store_name || store}
                        siteType={storeData.site_type}
                        onClose={() => setCmdPaletteOpen(false)}
                    />
                )}
            </div>
        </ToastProvider>
    )
}

/** True when `run` appears as consecutive path segments — `/a/b` as a unit, not as a substring. */
function hasSegmentRun(segments: string[], run: string[]): boolean {
    return segments.some((_, i) => run.every((part, offset) => segments[i + offset] === part))
}

function buildNavigationSections(store: string, siteType: string | null | undefined): AppNavigationSection[] {
    const groups = getMerchantNavigation(siteType)
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
function buildSettingsNavigationSections(store: string): AppNavigationSection[] {
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
        ...SETTINGS_NAV_GROUPS.map((group) => ({
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

function buildFooterItems(store: string, siteType: string | null | undefined, pathname: string): NavigationItem[] {
    const groups = getMerchantNavigation(siteType)
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
                icon: <MaterialIcon name={item.icon} size={16} aria-hidden="true" />,
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
        icon: <MaterialIcon name={item.icon} size={16} aria-hidden="true" />,
        children: children.length > 0 ? children : undefined,
    }]
}
