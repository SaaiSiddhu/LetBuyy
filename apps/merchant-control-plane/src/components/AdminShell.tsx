'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import HeaderBar from './HeaderBar'
import TrialBanner from './TrialBanner'
import CommandPalette from './CommandPalette'
import AISidebar from './AISidebar'
import type { SessionUser } from '@/lib/auth/session'
import { AppNavigation, MaterialIcon, ToastProvider, type AppNavigationSection } from '@letbuyy/ui'
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
                    <button
                        type="button"
                        className="admin-sidebar-overlay active"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close navigation"
                    />
                )}

                <AppNavigation
                    sections={navigationSections}
                    className="pt-[var(--admin-header-height)]"
                    sidebarClassName={sidebarOpen
                        ? 'fixed left-0 top-[var(--admin-header-height)] z-50 flex h-[calc(100vh_-_var(--admin-header-height))] lg:static lg:flex lg:h-auto'
                        : 'hidden lg:flex'}
                    brand={
                        <div className="flex min-w-0 items-center gap-[var(--lb-space-2)]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--lb-color-primary-soft)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-bold)] text-[color:var(--lb-color-primary)]">
                                {(storeData.name || storeData.store_name || store).slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <div className="truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]">
                                    {storeData.name || storeData.store_name || store}
                                </div>
                                <div className="truncate text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {storeData.site_type}
                                </div>
                            </div>
                        </div>
                    }
                >
                    <div className={`flex min-h-full min-w-0 ${aiPanelOpen ? 'ai-open' : ''}`}>
                        <div className={`min-w-0 flex-1 bg-[var(--lb-color-bg)] ${isSettingsPage ? 'settings-active' : ''}`}>
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
        { title: 'Settings', items: sectionItems.bottom.flatMap((item) => toNavigationItems(store, item)) },
    ].filter((section) => section.items.length > 0)
}

function toNavigationItems(store: string, item: MerchantNavItem): AppNavigationSection['items'] {
    const parent = {
        id: item.path,
        label: item.label,
        href: `/${store}/${item.path}`,
        icon: <MaterialIcon name={item.icon} size={16} aria-hidden="true" />,
        badge: item.shortcut,
    }

    const children = (item.children ?? []).map((child) => ({
        id: `${item.path}:${child.path}`,
        label: child.label,
        href: `/${store}/${child.path}`,
        icon: <MaterialIcon name={child.icon ?? 'arrow_forward'} size={16} aria-hidden="true" />,
        badge: child.shortcut,
    }))

    return [parent, ...children]
}
