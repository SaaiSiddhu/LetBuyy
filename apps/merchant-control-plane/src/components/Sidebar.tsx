'use client'

import { useCallback, useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { SessionUser } from '@/lib/auth/session'
import type { StoreData, UserStore } from './AdminShell'
import { MaterialIcon } from '@letbuyy/ui'
import { getMerchantNavigation, type MerchantNavItem } from './merchantNavigation'

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

export default function Sidebar({ store, storeData, isOpen, onClose }: SidebarProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentSearch = searchParams.toString()

    const groups = useMemo(() => getMerchantNavigation(storeData.site_type), [storeData.site_type])
    const sections = useMemo(() => ({
        primary: groups.filter((item) => !item.section || item.section === 'primary'),
        sales: groups.filter((item) => item.section === 'sales'),
        apps: groups.filter((item) => item.section === 'apps'),
        bottom: groups.filter((item) => item.section === 'bottom'),
    }), [groups])

    const isNavPathActive = useCallback((navPath: string) => {
        const [routePath, queryString] = navPath.split('?')
        const href = `/${store}/${routePath}`
        const routeIsActive = pathname === href || pathname?.startsWith(`${href}/`)

        if (!routeIsActive) return false
        if (!queryString) return true

        const targetParams = new URLSearchParams(queryString)
        const activeParams = new URLSearchParams(currentSearch)

        for (const [key, value] of targetParams.entries()) {
            if (activeParams.get(key) !== value) return false
        }

        return true
    }, [currentSearch, pathname, store])

    const activeParentPaths = useMemo(() => {
        const activePaths = new Set<string>()

        for (const item of groups) {
            const isChildActive = item.children?.some((child) => isNavPathActive(child.path)) ?? false
            const isParentActive = isNavPathActive(item.path)

            if (isChildActive || isParentActive) {
                activePaths.add(item.path)
            }
        }

        return activePaths
    }, [groups, isNavPathActive])

    // Track which parent nav items are expanded
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})

    const toggleExpand = (key: string) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const renderNavItem = (item: MerchantNavItem) => {
        const href = `/${store}/${item.path}`
        const hasChildren = item.children && item.children.length > 0
        const isChildActive = item.children?.some((child) => isNavPathActive(child.path)) ?? false
        const isActive = isNavPathActive(item.path) || isChildActive
        const isExpanded = expanded[item.path] ?? activeParentPaths.has(item.path)
        const childListId = `admin-nav-children-${item.path.replace(/[^a-z0-9]+/gi, '-')}`

        return (
            <div
                key={item.path}
                className={`admin-nav-group ${hasChildren ? 'has-children' : ''} ${isExpanded ? 'expanded' : ''} ${isChildActive ? 'has-active-child' : ''}`}
            >
                <div className="admin-nav-item-wrapper">
                    <Link
                        href={href}
                        className={`admin-nav-item ${isActive ? 'active' : ''} ${hasChildren ? 'has-children' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={onClose}
                    >
                        <MaterialIcon name={item.icon} />
                        <span className="admin-nav-item-label">{item.label}</span>
                        {item.shortcut && <kbd className="admin-nav-shortcut">{item.shortcut}</kbd>}
                    </Link>
                    {hasChildren && (
                        <button
                            className="admin-nav-expand-btn"
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(item.path)
                            }}
                            aria-controls={childListId}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label} navigation`}
                        >
                            <MaterialIcon name="chevron_right" className={`${isExpanded ? 'expanded' : ''}`} />
                        </button>
                    )}
                </div>

                {hasChildren && (
                    <div
                        id={childListId}
                        className={`admin-nav-children ${isExpanded ? 'open' : ''}`}
                    >
                        {item.children!.map((child) => {
                            const childHref = `/${store}/${child.path}`
                            const childActive = isNavPathActive(child.path)
                            return (
                                <Link
                                    key={child.path}
                                    href={childHref}
                                    className={`admin-nav-child ${childActive ? 'active' : ''}`}
                                    aria-current={childActive ? 'page' : undefined}
                                    onClick={onClose}
                                >
                                    <span className="admin-nav-branch" aria-hidden="true" />
                                    {child.icon && <MaterialIcon name={child.icon} />}
                                    <span className="admin-nav-child-label">{child.label}</span>
                                    {child.shortcut && <kbd className="admin-nav-child-shortcut">{child.shortcut}</kbd>}
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    const renderNavSection = (label: string, items: MerchantNavItem[], className: string) => {
        if (items.length === 0) return null

        return (
            <div className={`admin-nav-section ${className}`}>
                <div className="admin-nav-section-title">
                    <span>{label}</span>
                    <MaterialIcon name="chevron_right" />
                </div>
                {items.map(renderNavItem)}
            </div>
        )
    }

    return (
        <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
            {/* Navigation */}
            <nav className="admin-sidebar-nav" aria-label="Admin navigation">
                <div className="admin-sidebar-primary">
                    {sections.primary.map(renderNavItem)}
                    {renderNavSection('Sales channels', sections.sales, 'admin-nav-section--sales')}
                    {renderNavSection('Apps', sections.apps, 'admin-nav-section--apps')}
                </div>

                <div className="admin-sidebar-bottom">
                    {renderNavSection('Settings', sections.bottom, 'admin-nav-section--settings')}
                </div>
            </nav>
        </aside>
    )
}
