'use client'

import { useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getStorefrontRootDomain } from '@/lib/public-urls'
import { MerchantNavigationLink as Link } from '../MerchantNavigationLink'
import { ArrowLeft, Input, ScrollThumb, Search } from '@letbuyy/ui'
import {
    getSettingsNavigationGroups,
    getSettingsItemByPath,
} from './settings-navigation'

interface SettingsShellProps {
    store: string
    storeName: string
    subdomain: string
    userName: string
    userEmail: string
    appPlatformEnabled: boolean
    children: React.ReactNode
}

function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function normalizeSearch(value: string) {
    return value.trim().toLowerCase()
}

function itemMatches(query: string, groupTitle: string, itemText: string[]) {
    if (!query) return true
    const haystack = [groupTitle, ...itemText].join(' ').toLowerCase()
    return haystack.includes(query)
}

// The always-visible scroll thumb is the shared @letbuyy/ui ScrollThumb — the
// same one the main nav rail and the mobile drawer use — so all four rails
// behave identically. See packages/typescript/ui/src/app-shell.tsx.

export function SettingsShell({
    store,
    storeName,
    subdomain,
    userName,
    userEmail,
    appPlatformEnabled,
    children,
}: SettingsShellProps) {
    const pathname = usePathname()
    const [query, setQuery] = useState('')
    const normalizedQuery = normalizeSearch(query)
    const activeItem = getSettingsItemByPath(pathname, store)
    const desktopNavRef = useRef<HTMLElement>(null)

    const filteredGroups = useMemo(() => getSettingsNavigationGroups(appPlatformEnabled).map(group => ({
        ...group,
        items: group.items.filter(item => itemMatches(normalizedQuery, group.title, [
            item.label,
            item.description,
            ...item.keywords,
        ])),
    })), [appPlatformEnabled, normalizedQuery])
    const hasSearchResults = filteredGroups.some(group => group.items.length > 0)

    const storeInitials = getInitials(storeName || subdomain)
    const userInitials = getInitials(userName || userEmail)
    const settingsHomeHref = `/${store}/settings`

    function renderNav() {
        return (
            <>
                {filteredGroups.map(group => group.items.length > 0 && (
                    <div key={group.title} role="group" aria-label={group.title}>
                        {group.items.map(item => {
                            const href = `/${store}/settings/${item.href}`
                            const active = pathname === href || !!pathname?.startsWith(`${href}/`)
                            const ItemIcon = item.Icon
                            return (
                                <Link
                                    key={item.href}
                                    href={href}
                                    aria-current={active ? 'page' : undefined}
                                    className={`settings-nav-item${active ? ' active' : ''}`}
                                >
                                    <ItemIcon className="letbuyy-icon" aria-hidden="true" />
                                    <span className="settings-nav-label">{item.label}</span>
                                    {item.status === 'backend-needed' && (
                                        <span className="settings-nav-badge">
                                            <span className="settings-nav-badge-dot" />
                                            Needs backend
                                        </span>
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                ))}
            </>
        )
    }

    return (
        <>
            {/* Tablet and desktop keep settings navigation beside the content.
                Phones use the shared header drawer for settings navigation. */}
            <div className="settings-shell">
                <aside className="settings-sidebar">
                    <div className="settings-sidebar-heading">
                        <Link href={`/${store}/dashboard`} className="settings-sidebar-back" aria-label="Back to main navigation">
                            <ArrowLeft className="letbuyy-icon" aria-hidden="true" />
                        </Link>
                        <Link href={settingsHomeHref} className="settings-sidebar-title">Settings</Link>
                    </div>

                    {/* Search */}
                    <div className="settings-sidebar-search">
                        <Search className="letbuyy-icon" aria-hidden="true" />
                        <Input
                            unstyled
                            id="settings-search-desktop"
                            type="search"
                            placeholder="Search settings..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            aria-label="Search settings"
                        />
                    </div>

                    <div className="settings-sidebar-store">
                        <span className="settings-sidebar-store-info">
                            <span className="settings-sidebar-store-name">{storeName}</span>
                            <span className="settings-sidebar-store-domain">{subdomain}.{getStorefrontRootDomain()}</span>
                        </span>
                        <span className="settings-sidebar-store-icon" aria-hidden="true">{storeInitials}</span>
                    </div>

                    {/* Nav */}
                    <div className="settings-sidebar-nav-track">
                        <nav ref={desktopNavRef} className="settings-sidebar-nav" aria-label="Settings">
                            {hasSearchResults ? renderNav() : (
                                <p className="settings-sidebar-no-results" role="status">No settings match “{query.trim()}”.</p>
                            )}
                        </nav>
                        <ScrollThumb scrollRef={desktopNavRef} />
                    </div>

                    {/* User footer */}
                    <div className="settings-sidebar-user">
                        <span className="settings-sidebar-user-avatar" aria-hidden="true">
                            {userInitials}
                        </span>
                        <span className="settings-sidebar-user-info">
                            <span className="settings-sidebar-user-name">{userName || 'User'}</span>
                            <span className="settings-sidebar-user-email">{userEmail}</span>
                        </span>
                    </div>
                </aside>

                {/* Content */}
                <section className="settings-content" aria-label={activeItem?.label || 'Dashboard'}>
                    {children}
                </section>
            </div>

        </>
    )
}
