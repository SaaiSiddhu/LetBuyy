'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
    store: string
}

const navItems = {
    ecommerce: [
        { href: 'dashboard', label: 'Dashboard', icon: '📊' },
        { href: 'products', label: 'Products', icon: '📦' },
        { href: 'orders', label: 'Orders', icon: '🛒' },
        { href: 'customers', label: 'Customers', icon: '👥' },
        { href: 'coupons', label: 'Coupons', icon: '🏷️' },
        { href: 'analytics', label: 'Analytics', icon: '📈' },
        { href: 'pages', label: 'Pages', icon: '📄' },
        { href: 'settings', label: 'Settings', icon: '⚙️' },
    ],
    portfolio: [
        { href: 'dashboard', label: 'Dashboard', icon: '📊' },
        { href: 'projects', label: 'Projects', icon: '🎨' },
        { href: 'skills', label: 'Skills', icon: '⭐' },
        { href: 'analytics', label: 'Analytics', icon: '📈' },
        { href: 'pages', label: 'Pages', icon: '📄' },
        { href: 'settings', label: 'Settings', icon: '⚙️' },
    ],
    resume: [
        { href: 'dashboard', label: 'Dashboard', icon: '📊' },
        { href: 'editor', label: 'Editor', icon: '✏️' },
        { href: 'versions', label: 'Versions', icon: '📋' },
        { href: 'analytics', label: 'Analytics', icon: '📈' },
        { href: 'settings', label: 'Settings', icon: '⚙️' },
    ],
    landing_page: [
        { href: 'dashboard', label: 'Dashboard', icon: '📊' },
        { href: 'analytics', label: 'Analytics', icon: '📈' },
        { href: 'pages', label: 'Pages', icon: '📄' },
        { href: 'settings', label: 'Settings', icon: '⚙️' },
    ],
    // Legacy alias
    store: [
        { href: 'dashboard', label: 'Dashboard', icon: '📊' },
        { href: 'products', label: 'Products', icon: '📦' },
        { href: 'orders', label: 'Orders', icon: '🛒' },
        { href: 'analytics', label: 'Analytics', icon: '📈' },
        { href: 'settings', label: 'Settings', icon: '⚙️' },
    ],
    landing: [
        { href: 'dashboard', label: 'Dashboard', icon: '📊' },
        { href: 'analytics', label: 'Analytics', icon: '📈' },
        { href: 'pages', label: 'Pages', icon: '📄' },
        { href: 'settings', label: 'Settings', icon: '⚙️' },
    ],
}

export default function Sidebar({ store }: SidebarProps) {
    const pathname = usePathname()
    const [siteType, setSiteType] = useState<string>('ecommerce')
    const [userName, setUserName] = useState<string>('')
    const supabase = createClient()

    useEffect(() => {
        async function loadStoreInfo() {
            // Use session-based auth: fetch from /api/auth/session on accounts app
            // For now, load store info from the stores view using the store_name
            const { data } = await supabase
                .from('stores')
                .select('site_type, name, custom_user_id')
                .eq('store_name', store)
                .single()

            if (data?.site_type) setSiteType(data.site_type)

            // Get user email from the session cookie (via users_custom)
            if (data?.custom_user_id) {
                const { data: user } = await supabase
                    .from('users_custom')
                    .select('email')
                    .eq('id', data.custom_user_id)
                    .single()
                if (user?.email) setUserName(user.email)
            }
        }
        loadStoreInfo()
    }, [store, supabase])

    const items = navItems[siteType as keyof typeof navItems] || navItems.ecommerce

    const handleSignOut = async () => {
        // Sign out via the accounts app's logout endpoint
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'
        try {
            await fetch(`${accountsUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            })
        } catch {
            // If cross-origin fails, redirect anyway
        }
        window.location.href = `${accountsUrl}/lookup`
    }

    return (
        <aside className="admin-sidebar">
            {/* Header */}
            <div className="admin-sidebar-header">
                <span className="admin-sidebar-brand">LetBuyy</span>
                <span className="admin-sidebar-store-badge">{store}</span>
            </div>

            {/* Nav */}
            <nav className="admin-sidebar-nav">
                {items.map((item) => {
                    const href = `/${store}/${item.href}`
                    const isActive = pathname === href || pathname?.startsWith(`${href}/`)
                    return (
                        <Link
                            key={item.href}
                            href={href}
                            className={`admin-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="admin-sidebar-footer">
                <div className="admin-sidebar-user">{userName}</div>
                <button
                    onClick={handleSignOut}
                    className="admin-sidebar-signout"
                >
                    ← Sign out
                </button>
            </div>
        </aside>
    )
}
