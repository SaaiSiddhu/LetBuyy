'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { SessionUser } from '@/lib/auth/session'
import type { StoreData, UserStore } from './AdminShell'

/* ——————————————————————————————————————
   Nav Config — dynamic by site type
   —————————————————————————————————————— */

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

interface NavChild {
    href: string
    label: string
}

interface NavItem {
    href: string
    label: string
    icon: string
    children?: NavChild[]
}

interface NavGroup {
    label?: string
    items: NavItem[]
}

const navConfig: Record<SiteType, NavGroup[]> = {
    store: [
        {
            items: [
                { href: 'dashboard', label: 'Home', icon: 'home' },
                { href: 'orders', label: 'Orders', icon: 'shopping_cart' },
                {
                    href: 'products', label: 'Products', icon: 'inventory_2',
                    children: [
                        { href: 'products/collections', label: 'Collections' },
                        { href: 'products/inventory', label: 'Inventory' },
                        { href: 'products/purchase-orders', label: 'Purchase orders' },
                        { href: 'products/transfers', label: 'Transfers' },
                        { href: 'products/gift-cards', label: 'Gift cards' },
                    ],
                },
                { href: 'customers', label: 'Customers', icon: 'group' },
                { href: 'reviews', label: 'Reviews', icon: 'rate_review' },
                { href: 'coupons', label: 'Discounts', icon: 'sell' },
                { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
                { href: 'apps', label: 'Apps', icon: 'extension' },
            ],
        },
        {
            label: 'Sales channels',
            items: [
                {
                    href: 'online-store', label: 'Online Store', icon: 'storefront',
                    children: [
                        { href: 'online-store/themes', label: 'Themes' },
                        { href: 'online-store/pages', label: 'Pages' },
                        { href: 'online-store/preferences', label: 'Preferences' },
                    ],
                },
            ],
        },
    ],
    portfolio: [
        {
            items: [
                { href: 'dashboard', label: 'Home', icon: 'home' },
                { href: 'projects', label: 'Projects', icon: 'work' },
                { href: 'gallery', label: 'Gallery', icon: 'image' },
                { href: 'skills', label: 'Skills', icon: 'star' },
                { href: 'education', label: 'Education', icon: 'school' },
                { href: 'testimonials', label: 'Testimonials', icon: 'chat' },
                { href: 'contact', label: 'Contact Form', icon: 'mail' },
                { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
                { href: 'apps', label: 'Apps', icon: 'extension' },
            ],
        },
        {
            label: 'Customize',
            items: [
                { href: 'pages', label: 'Pages', icon: 'article' },
                { href: 'appearance', label: 'Appearance', icon: 'palette' },
            ],
        },
    ],
    resume: [
        {
            items: [
                { href: 'dashboard', label: 'Home', icon: 'home' },
                { href: 'experience', label: 'Experience', icon: 'work' },
                { href: 'education', label: 'Education', icon: 'school' },
                { href: 'skills', label: 'Skills', icon: 'star' },
                { href: 'certifications', label: 'Certifications', icon: 'verified' },
                { href: 'export', label: 'PDF Export', icon: 'picture_as_pdf' },
                { href: 'ats-score', label: 'ATS Score', icon: 'analytics' },
                { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
                { href: 'apps', label: 'Apps', icon: 'extension' },
            ],
        },
    ],
    landing: [
        {
            items: [
                { href: 'dashboard', label: 'Home', icon: 'home' },
                { href: 'pages', label: 'Pages', icon: 'article' },
                { href: 'leads', label: 'Leads', icon: 'contact_page' },
                { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
                { href: 'apps', label: 'Apps', icon: 'extension' },
            ],
        },
        {
            label: 'Customize',
            items: [
                { href: 'appearance', label: 'Appearance', icon: 'palette' },
            ],
        },
    ],
    blog: [
        {
            items: [
                { href: 'dashboard', label: 'Home', icon: 'home' },
                { href: 'posts', label: 'Posts', icon: 'edit_note' },
                { href: 'categories', label: 'Categories', icon: 'category' },
                { href: 'comments', label: 'Comments', icon: 'comment' },
                { href: 'analytics', label: 'Analytics', icon: 'bar_chart' },
                { href: 'apps', label: 'Apps', icon: 'extension' },
            ],
        },
        {
            label: 'Customize',
            items: [
                { href: 'pages', label: 'Pages', icon: 'article' },
                { href: 'appearance', label: 'Appearance', icon: 'palette' },
            ],
        },
    ],
}

/* ——————————————————————————————————————
   Props
   —————————————————————————————————————— */

interface SidebarProps {
    store: string
    storeData: StoreData
    user: SessionUser
    userStores: UserStore[]
    isOpen: boolean
    onClose: () => void
}

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function Sidebar({ store, storeData, user, userStores, isOpen, onClose }: SidebarProps) {
    const pathname = usePathname()

    const siteType = (storeData.site_type as SiteType) || 'store'
    const groups = navConfig[siteType] || navConfig.store

    // Track which parent nav items are expanded
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})

    // Auto-expand parent items when a child route is active
    useEffect(() => {
        for (const group of groups) {
            for (const item of group.items) {
                if (item.children) {
                    const parentHref = `/${store}/${item.href}`
                    const isChildActive = pathname?.startsWith(parentHref + '/')
                    const isParentActive = pathname === parentHref
                    if (isChildActive || isParentActive) {
                        setExpanded(prev => ({ ...prev, [item.href]: true }))
                    }
                }
            }
        }
    }, [pathname, store, groups])

    const toggleExpand = (key: string) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
    }

    return (
        <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
            {/* Navigation */}
            <nav className="admin-sidebar-nav" aria-label="Admin navigation">
                {groups.map((group, gi) => (
                    <div key={gi}>
                        {group.label && (
                            <div className="admin-nav-section-label">
                                {group.label}
                                <span className="material-symbols-outlined">chevron_right</span>
                            </div>
                        )}
                        {group.items.map((item) => {
                            const href = `/${store}/${item.href}`
                            const isActive = pathname === href || pathname?.startsWith(`${href}/`)
                            const hasChildren = item.children && item.children.length > 0
                            const isExpanded = expanded[item.href] ?? false

                            return (
                                <div key={item.href}>
                                    {/* Parent nav item */}
                                    <div className="admin-nav-item-wrapper">
                                        <Link
                                            href={href}
                                            className={`admin-nav-item ${isActive ? 'active' : ''} ${hasChildren ? 'has-children' : ''}`}
                                            onClick={onClose}
                                        >
                                            <span className="material-symbols-outlined">{item.icon}</span>
                                            {item.label}
                                        </Link>
                                        {hasChildren && (
                                            <button
                                                className="admin-nav-expand-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleExpand(item.href)
                                                }}
                                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                <span className={`material-symbols-outlined ${isExpanded ? 'expanded' : ''}`}>
                                                    expand_more
                                                </span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Child nav items */}
                                    {hasChildren && (
                                        <div className={`admin-nav-children ${isExpanded ? 'open' : ''}`}>
                                            {item.children!.map((child) => {
                                                const childHref = `/${store}/${child.href}`
                                                const isChildActive = pathname === childHref
                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={childHref}
                                                        className={`admin-nav-child ${isChildActive ? 'active' : ''}`}
                                                        onClick={onClose}
                                                    >
                                                        {child.label}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer: AI + Settings */}
            <div className="admin-sidebar-footer">
                {/* AI Credits Widget — hidden until connected to real data
                <div className="admin-ai-credits">
                    <div className="admin-ai-credits-header">
                        <span className="material-symbols-outlined">auto_awesome</span>
                        AI Credits
                    </div>
                    <div className="admin-ai-credits-bar">
                        <div className="admin-ai-credits-fill" style={{ width: '75%' }} />
                    </div>
                    <div className="admin-ai-credits-label">750 / 1,000 credits remaining</div>
                </div>
                */}

                {/* Settings link */}
                <Link
                    href={`/${store}/settings`}
                    className={`admin-nav-item ${pathname?.startsWith(`/${store}/settings`) ? 'active' : ''}`}
                    onClick={onClose}
                >
                    <span className="material-symbols-outlined">settings</span>
                    Settings
                </Link>
            </div>
        </aside>
    )
}
