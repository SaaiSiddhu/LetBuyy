'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SidebarProps {
    store: string
}

const navItems = {
    store: [
        { href: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: 'products', label: 'Products', icon: 'inventory_2' },
        { href: 'orders', label: 'Orders', icon: 'shopping_cart' },
        { href: 'customers', label: 'Customers', icon: 'group' },
        { href: 'coupons', label: 'Coupons', icon: 'sell' },
        { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
        { href: 'pages', label: 'Pages', icon: 'article' },
        { href: 'appearance', label: 'Appearance', icon: 'palette' },
        { href: 'ai', label: 'AI Studio', icon: 'smart_toy' },
        { href: 'settings', label: 'Settings', icon: 'settings' },
    ],
    portfolio: [
        { href: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: 'projects', label: 'Projects', icon: 'work' },
        { href: 'gallery', label: 'Gallery', icon: 'image' },
        { href: 'skills', label: 'Skills', icon: 'star' },
        { href: 'education', label: 'Education', icon: 'school' },
        { href: 'testimonials', label: 'Testimonials', icon: 'chat' },
        { href: 'contact', label: 'Contact Form', icon: 'mail' },
        { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
        { href: 'pages', label: 'Pages', icon: 'article' },
        { href: 'appearance', label: 'Appearance', icon: 'palette' },
        { href: 'ai', label: 'AI Studio', icon: 'smart_toy' },
        { href: 'settings', label: 'Settings', icon: 'settings' },
    ],
    resume: [
        { href: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: 'experience', label: 'Experience', icon: 'work' },
        { href: 'education', label: 'Education', icon: 'school' },
        { href: 'skills', label: 'Skills', icon: 'star' },
        { href: 'certifications', label: 'Certifications', icon: 'verified' },
        { href: 'export', label: 'PDF Export', icon: 'picture_as_pdf' },
        { href: 'ats-score', label: 'ATS Score', icon: 'analytics' },
        { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
        { href: 'appearance', label: 'Appearance', icon: 'palette' },
        { href: 'settings', label: 'Settings', icon: 'settings' },
    ],
    landing: [
        { href: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: 'pages', label: 'Pages', icon: 'article' },
        { href: 'leads', label: 'Leads', icon: 'contact_page' },
        { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
        { href: 'appearance', label: 'Appearance', icon: 'palette' },
        { href: 'ai', label: 'AI Studio', icon: 'smart_toy' },
        { href: 'settings', label: 'Settings', icon: 'settings' },
    ],
    blog: [
        { href: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { href: 'posts', label: 'Posts', icon: 'edit_note' },
        { href: 'categories', label: 'Categories', icon: 'category' },
        { href: 'comments', label: 'Comments', icon: 'comment' },
        { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
        { href: 'pages', label: 'Pages', icon: 'article' },
        { href: 'appearance', label: 'Appearance', icon: 'palette' },
        { href: 'ai', label: 'AI Studio', icon: 'smart_toy' },
        { href: 'settings', label: 'Settings', icon: 'settings' },
    ],
}

export default function Sidebar({ store }: SidebarProps) {
    const pathname = usePathname()
    const [siteType, setSiteType] = useState<string>('store')
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

    const items = navItems[siteType as keyof typeof navItems] || navItems.store

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
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
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
