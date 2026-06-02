'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { SessionUser } from '@/lib/auth/session'
import type { StoreData, UserStore } from './AdminShell'
import { MaterialIcon } from '@letbuyy/ui'
import { getMerchantNavigation } from './merchantNavigation'

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

    const groups = useMemo(() => getMerchantNavigation(storeData.site_type), [storeData.site_type])
    const activeParentPaths = useMemo(() => {
        const activePaths = new Set<string>()

        for (const item of groups) {
            const parentHref = `/${store}/${item.path}`
            const isChildActive = item.children?.some((child) => {
                const childHref = `/${store}/${child.path}`
                return pathname === childHref || pathname?.startsWith(`${childHref}/`)
            }) ?? false
            const isParentActive = pathname === parentHref || pathname?.startsWith(`${parentHref}/`)

            if (isChildActive || isParentActive) {
                activePaths.add(item.path)
            }
        }

        return activePaths
    }, [groups, pathname, store])

    // Track which parent nav items are expanded
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})

    const toggleExpand = (key: string) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
    }

    return (
        <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
            {/* Navigation */}
            <nav className="admin-sidebar-nav" aria-label="Admin navigation">
                {groups.map((item) => {
                    const href = `/${store}/${item.path}`
                    const hasChildren = item.children && item.children.length > 0
                    const isChildActive = item.children?.some((child) => {
                        const childHref = `/${store}/${child.path}`
                        return pathname === childHref || pathname?.startsWith(`${childHref}/`)
                    }) ?? false
                    const isActive = pathname === href || pathname?.startsWith(`${href}/`) || isChildActive
                    const isExpanded = expanded[item.path] ?? activeParentPaths.has(item.path)
                    const childListId = `admin-nav-children-${item.path.replace(/[^a-z0-9]+/gi, '-')}`

                    return (
                        <div key={item.path} className="admin-nav-group">
                            <div className="admin-nav-item-wrapper">
                                <Link
                                    href={href}
                                    className={`admin-nav-item ${isActive ? 'active' : ''} ${hasChildren ? 'has-children' : ''}`}
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
                                        <MaterialIcon name="expand_more" className={`${isExpanded ? 'expanded' : ''}`} />
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
                                        const childActive = pathname === childHref || pathname?.startsWith(`${childHref}/`)
                                        return (
                                            <Link
                                                key={child.path}
                                                href={childHref}
                                                className={`admin-nav-child ${childActive ? 'active' : ''}`}
                                                onClick={onClose}
                                            >
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
                })}
            </nav>
        </aside>
    )
}
