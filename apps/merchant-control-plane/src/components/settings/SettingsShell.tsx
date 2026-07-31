'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Menu, Search, X } from '@letbuyy/ui'
import {
    SETTINGS_NAV_GROUPS,
    getSettingsItemByPath,
} from './settings-navigation'

interface SettingsShellProps {
    store: string
    storeName: string
    subdomain: string
    userName: string
    userEmail: string
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

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function SettingsShell({
    store,
    storeName,
    subdomain,
    userName,
    userEmail,
    children,
}: SettingsShellProps) {
    const pathname = usePathname()
    const [query, setQuery] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const normalizedQuery = normalizeSearch(query)
    const activeItem = getSettingsItemByPath(pathname, store)

    useEffect(() => {
        if (!drawerOpen) return
        const previousEl = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        document.getElementById('settings-mobile-drawer')?.focus()

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') { setDrawerOpen(false); return }
            if (e.key !== 'Tab') return
            const drawer = document.getElementById('settings-mobile-drawer')
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
            document.body.style.overflow = prevOverflow
            if (previousEl?.isConnected) previousEl.focus()
        }
    }, [drawerOpen])

    const filteredGroups = useMemo(() => SETTINGS_NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => itemMatches(normalizedQuery, group.title, [
            item.label,
            item.description,
            ...item.keywords,
        ])),
    })), [normalizedQuery])

    const storeInitials = getInitials(storeName || subdomain)
    const userInitials = getInitials(userName || userEmail)
    const settingsHomeHref = `/${store}/settings`
    const homeActive = pathname === settingsHomeHref

    function renderNav(instance: 'desktop' | 'mobile') {
        const onNavigate = instance === 'mobile' ? () => setDrawerOpen(false) : undefined
        return (
            <>
                <Link
                    href={settingsHomeHref}
                    onClick={onNavigate}
                    aria-current={homeActive ? 'page' : undefined}
                    className={`settings-nav-item${homeActive ? ' active' : ''}`}
                >
                    <LayoutDashboard className="letbuyy-icon" aria-hidden="true" />
                    <span className="settings-nav-label">Dashboard</span>
                </Link>

                {filteredGroups.map(group => group.items.length > 0 && (
                    <div key={group.title}>
                        <div className="settings-nav-group-label">{group.title}</div>
                        {group.items.map(item => {
                            const href = `/${store}/settings/${item.href}`
                            const active = pathname === href || !!pathname?.startsWith(`${href}/`)
                            const ItemIcon = item.Icon
                            return (
                                <Link
                                    key={item.href}
                                    href={href}
                                    onClick={onNavigate}
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
            {/* Mobile topbar — hidden on desktop */}
            <div className="settings-mobile-topbar">
                <div className="settings-mobile-topbar-content">
                    <span className="settings-mobile-topbar-info">
                        <span className="settings-mobile-topbar-label">Settings</span>
                        <span className="settings-mobile-topbar-page">{activeItem?.label || 'Dashboard'}</span>
                    </span>
                    <button
                        type="button"
                        className="settings-mobile-menu-btn"
                        onClick={() => setDrawerOpen(true)}
                        aria-expanded={drawerOpen}
                        aria-controls="settings-mobile-drawer"
                    >
                        <Menu className="letbuyy-icon" aria-hidden="true" />
                        Index
                    </button>
                </div>
            </div>

            {/* Desktop shell — sidebar + content grid */}
            <div className="settings-shell">
                <aside className="settings-sidebar">
                    {/* Store header */}
                    <div className="settings-sidebar-store">
                        <span className="settings-sidebar-store-icon" aria-hidden="true">
                            {storeInitials}
                        </span>
                        <span className="settings-sidebar-store-info">
                            <span className="settings-sidebar-store-name">{storeName}</span>
                            <span className="settings-sidebar-store-domain">{subdomain}.letbuyy.com</span>
                        </span>
                        <Link
                            href={`/${store}/dashboard`}
                            className="settings-sidebar-close"
                            aria-label="Close settings"
                        >
                            <X className="letbuyy-icon" aria-hidden="true" />
                        </Link>
                    </div>

                    {/* Search */}
                    <div className="settings-sidebar-search">
                        <Search className="letbuyy-icon" aria-hidden="true" />
                        <input
                            id="settings-search-desktop"
                            type="search"
                            placeholder="Search settings..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            aria-label="Search settings"
                        />
                    </div>

                    {/* Nav */}
                    <nav className="settings-sidebar-nav" aria-label="Settings">
                        {renderNav('desktop')}
                    </nav>

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

            {/* Mobile drawer */}
            {drawerOpen && (
                <div className="settings-mobile-drawer-overlay" role="presentation">
                    <button
                        type="button"
                        className="settings-mobile-drawer-backdrop"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close settings index"
                    />
                    <aside
                        id="settings-mobile-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="settings-mobile-drawer-title"
                        tabIndex={-1}
                        className="settings-mobile-drawer"
                    >
                        <div className="settings-mobile-drawer-header">
                            <h2 id="settings-mobile-drawer-title" className="settings-mobile-drawer-title">
                                Settings
                            </h2>
                            <button
                                type="button"
                                className="settings-mobile-drawer-close"
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close settings index"
                            >
                                <X className="letbuyy-icon" aria-hidden="true" />
                            </button>
                        </div>

                        <div className="settings-sidebar-store" style={{ borderRadius: 0 }}>
                            <span className="settings-sidebar-store-icon" aria-hidden="true">
                                {storeInitials}
                            </span>
                            <span className="settings-sidebar-store-info">
                                <span className="settings-sidebar-store-name">{storeName}</span>
                                <span className="settings-sidebar-store-domain">{subdomain}.letbuyy.com</span>
                            </span>
                        </div>

                        <div className="settings-sidebar-search" style={{ margin: '8px' }}>
                            <Search className="letbuyy-icon" aria-hidden="true" />
                            <input
                                id="settings-search-mobile"
                                type="search"
                                placeholder="Search settings..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                aria-label="Search settings"
                            />
                        </div>

                        <nav className="settings-sidebar-nav settings-mobile-nav" aria-label="Settings">
                            {renderNav('mobile')}
                        </nav>

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
                </div>
            )}
        </>
    )
}
