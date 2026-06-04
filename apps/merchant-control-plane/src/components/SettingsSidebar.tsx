'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useState } from 'react'
import { MaterialIcon } from '@letbuyy/ui'

/* ——————————————————————————————————————
   Settings Navigation Config
   —————————————————————————————————————— */

interface SettingsNavItem {
    href: string
    label: string
    icon: string
    badge?: string
}

const settingsNav: SettingsNavItem[] = [
    { href: 'general', label: 'General', icon: 'storefront' },
    { href: 'plan', label: 'Plan', icon: 'plan', badge: 'Ends in 14 days' },
    { href: 'billing', label: 'Billing', icon: 'receipt_long' },
    { href: 'users', label: 'Users', icon: 'manage_accounts' },
    { href: 'payments', label: 'Payments', icon: 'payments' },
    { href: 'checkout', label: 'Checkout', icon: 'shopping_cart' },
    { href: 'shipping', label: 'Shipping and delivery', icon: 'local_shipping' },
    { href: 'taxes', label: 'Taxes and duties', icon: 'request_quote' },
    { href: 'domains', label: 'Domains', icon: 'domains' },
    { href: 'notifications', label: 'Notifications', icon: 'notifications' },
    { href: 'policies', label: 'Policies', icon: 'policy' },
]

/* ——————————————————————————————————————
   Props
   —————————————————————————————————————— */

interface SettingsSidebarProps {
    storeName: string
    subdomain: string
    userName: string
    userEmail: string
}

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function SettingsSidebar({ storeName, subdomain, userName, userEmail }: SettingsSidebarProps) {
    const pathname = usePathname()
    const { store } = useParams<{ store: string }>()
    const [searchQuery, setSearchQuery] = useState('')

    const filteredNav = settingsNav.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const userInitial = (userName || userEmail || 'U').charAt(0).toUpperCase()

    return (
        <aside className="settings-sidebar">
            {/* Store identity */}
            <div className="settings-sidebar-store">
                <div className="settings-sidebar-store-icon">
                    {(storeName || 'S').charAt(0).toUpperCase()}
                </div>
                <div className="settings-sidebar-store-info">
                    <span className="settings-sidebar-store-name">{storeName}</span>
                    <span className="settings-sidebar-store-domain">{subdomain}.letbuyy.store</span>
                </div>
            </div>

            {/* Search */}
            <div className="settings-sidebar-search">
                <MaterialIcon name="search" />
                <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Navigation */}
            <nav className="settings-sidebar-nav">
                {filteredNav.map((item) => {
                    const href = `/${store}/settings/${item.href}`
                    const isSettingsHome = pathname === `/${store}/settings`
                    const isActive = pathname === href || pathname?.startsWith(`${href}/`) || (isSettingsHome && item.href === 'general')
                    return (
                        <Link
                            key={item.href}
                            href={href}
                            className={`settings-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <MaterialIcon name={item.icon} />
                            <span className="settings-nav-label">{item.label}</span>
                            {item.badge && (
                                <span className="settings-nav-badge">
                                    <span className="settings-nav-badge-dot" aria-hidden="true" />
                                    {item.badge}
                                </span>
                            )}
                            <MaterialIcon name="chevron_right" className="settings-nav-chevron" aria-hidden="true" />
                        </Link>
                    )
                })}
            </nav>

            {/* User footer */}
            <div className="settings-sidebar-user">
                <div className="settings-sidebar-user-avatar">{userInitial}</div>
                <div className="settings-sidebar-user-info">
                    <span className="settings-sidebar-user-name">{userName || 'User'}</span>
                    <span className="settings-sidebar-user-email">{userEmail}</span>
                </div>
            </div>
        </aside>
    )
}
