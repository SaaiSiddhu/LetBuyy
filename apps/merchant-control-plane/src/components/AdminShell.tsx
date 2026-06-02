'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import HeaderBar from './HeaderBar'
import TrialBanner from './TrialBanner'
import CommandPalette from './CommandPalette'
import AISidebar from './AISidebar'
import type { SessionUser } from '@/lib/auth/session'
import { MaterialIcon, ToastProvider } from '@letbuyy/ui'

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

export default function AdminShell({ store, storeData, user, userStores, children }: AdminShellProps) {
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

    return (
        <ToastProvider>
            <div className="admin-shell">
                {/* Full-width header — fixed at top, above everything */}
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

                {/* Body: sidebar + main content + AI panel — all inline */}
                <div className={`admin-body ${aiPanelOpen ? 'ai-open' : ''}`}>
                    {/* Sidebar overlay for mobile */}
                    <div
                        className={`admin-sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                    />

                    {/* Sidebar — hidden on settings pages */}
                    {!isSettingsPage && (
                        <Sidebar
                            store={store}
                            storeData={storeData}
                            user={user}
                            userStores={userStores}
                            isOpen={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* Main content area */}
                    <main className={`admin-main ${isSettingsPage ? 'settings-active' : ''}`}>
                        {/* Draft banner */}
                        {isDraft && (
                            <div className="admin-draft-banner">
                                <MaterialIcon name="warning" size={16} />
                                Your site is in <strong>draft</strong> mode. It is not visible to visitors yet.
                            </div>
                        )}

                        {/* Page content */}
                        {children}

                        {/* Trial toast — only on dashboard */}
                        {pathname?.endsWith('/dashboard') && (
                            <TrialBanner
                                trialEndsAt={storeData.trial_ends_at}
                                trialStatus={storeData.trial_status}
                            />
                        )}
                    </main>

                    {/* AI sidebar panel — inline, pushes main content */}
                    {aiPanelOpen && (
                        <AISidebar
                            store={store}
                            storeData={storeData}
                            onClose={() => setAiPanelOpen(false)}
                        />
                    )}
                </div>

                {/* Command palette */}
                {cmdPaletteOpen && (
                    <CommandPalette
                        store={store}
                        siteType={storeData.site_type}
                        onClose={() => setCmdPaletteOpen(false)}
                    />
                )}
            </div>
        </ToastProvider>
    )
}
