'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import HeaderBar from './HeaderBar'
import TrialBanner from './TrialBanner'
import CommandPalette from './CommandPalette'
import AISidebar from './AISidebar'
import type { SessionUser } from '@/lib/auth/session'
import { AppNavigation, Button, MaterialIcon, Navigation, ToastProvider, isNavItemActive, type AppNavigationSection, type NavigationItem } from '@letbuyy/ui'
import { getMerchantNavigation, type MerchantNavItem } from './merchantNavigation'

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

    const isDraft = storeData.status === 'draft'
    const isSettingsPage = pathname?.includes('/settings')
    const isFullScreenFlow = pathname?.includes('/access_account/checkout') || pathname?.includes('/subscribe/checkout') || pathname?.includes('/editor')

    // Full-screen flows bypass the admin shell entirely
    if (isFullScreenFlow) {
        return <ToastProvider>{children}</ToastProvider>
    }

    // Settings pages use their own floating sidebar — skip the main nav
    if (isSettingsPage) {
        return (
            <ToastProvider>
                <div className="admin-shell">
                    <HeaderBar
                        store={store}
                        storeData={storeData}
                        user={user}
                        userStores={userStores}
                        onMenuToggle={() => {}}
                        onSearchOpen={() => setCmdPaletteOpen(true)}
                        onAISidebarToggle={() => {}}
                        isSettingsPage={true}
                    />
                    <div className="admin-settings-wrapper" style={{ paddingTop: 'var(--admin-header-height)', minHeight: '100vh', background: 'var(--lb-color-bg)' }}>
                        {isDraft && (
                            <div className="admin-draft-banner">
                                <MaterialIcon name="warning" size={16} />
                                <span className="admin-draft-banner-message">
                                    Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                                </span>
                            </div>
                        )}
                        {children}
                    </div>
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

    const navigationSections = buildNavigationSections(store, storeData.site_type)

    return (
        <ToastProvider>
            <div className="admin-shell">
                <HeaderBar
                    store={store}
                    storeData={storeData}
                    user={user}
                    userStores={userStores}
                    onMenuToggle={() => setSidebarOpen(true)}
                    onSearchOpen={() => setCmdPaletteOpen(true)}
                    onAISidebarToggle={() => setAiPanelOpen(!aiPanelOpen)}
                    isSettingsPage={!!isSettingsPage}
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
                    className="admin-panel-frame pt-[var(--admin-header-height)]"
                    sidebarClassName={sidebarOpen
                        ? 'admin-panel-sidebar fixed left-0 top-[var(--admin-header-height)] z-50 flex h-[calc(100vh_-_var(--admin-header-height))] lg:sticky lg:top-[var(--admin-header-height)] lg:h-[calc(100vh_-_var(--admin-header-height))] lg:self-start'
                        : 'admin-panel-sidebar hidden lg:flex lg:sticky lg:top-[var(--admin-header-height)] lg:h-[calc(100vh_-_var(--admin-header-height))] lg:self-start'}
                    footer={
                        <Navigation
                            ariaLabel="Settings navigation"
                            items={buildFooterItems(store, storeData.site_type, pathname ?? '/')}
                        />
                    }
                >
                    <div className={`flex min-h-full min-w-0 ${aiPanelOpen ? 'ai-open' : ''}`}>
                        <div className={`admin-panel-content min-w-0 flex-1 bg-[var(--lb-color-bg)] ${isSettingsPage ? 'settings-active' : ''}`}>
                            {isDraft && (
                                <div className="admin-draft-banner">
                                    <MaterialIcon name="warning" size={16} />
                                    <span className="admin-draft-banner-message">
                                        Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                                    </span>
                                </div>
                            )}

                            {children}

                            {pathname?.endsWith('/dashboard') && (
                                <TrialBanner
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
