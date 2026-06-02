'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SessionUser } from '@/lib/auth/session'
import type { StoreData, UserStore } from './AdminShell'
import NotificationsPanel from './NotificationsPanel'
import { MaterialIcon } from '@letbuyy/ui'

interface HeaderBarProps {
    store: string
    storeData: StoreData
    user: SessionUser
    userStores: UserStore[]
    onMenuToggle: () => void
    onSearchOpen: () => void
    onAISidebarToggle: () => void
    isSettingsPage?: boolean
}

/** Get 2-char initials from a store name. */
function getStoreInitials(name: string): string {
    const words = name.trim().split(/\s+/)
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
}

/** Return a human-readable label for a site type. */
function getSiteTypeLabel(type: string): string {
    switch (type) {
        case 'store': return 'Online store'
        case 'portfolio': return 'Portfolio'
        case 'resume': return 'Resume'
        case 'landing': return 'Landing page'
        case 'blog': return 'Blog'
        default: return type
    }
}

export default function HeaderBar({
    store,
    storeData,
    user,
    userStores,
    onMenuToggle,
    onSearchOpen,
    onAISidebarToggle,
    isSettingsPage = false,
}: HeaderBarProps) {
    const router = useRouter()
    const [switcherOpen, setSwitcherOpen] = useState(false)
    const [notificationsOpen, setNotificationsOpen] = useState(false)
    const [isDark, setIsDark] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const switcherRef = useRef<HTMLDivElement>(null)
    const notificationsRef = useRef<HTMLDivElement>(null)

    // Detect mobile viewport
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    // Read initial theme
    useEffect(() => {
        const theme = localStorage.getItem('letbuyy_theme')
        setIsDark(theme === 'dark')
    }, [])

    // Lock body scroll when bottom sheet is open on mobile
    useEffect(() => {
        if (isMobile && (switcherOpen || notificationsOpen)) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [isMobile, switcherOpen, notificationsOpen])

    // Close switcher on outside click (desktop only)
    useEffect(() => {
        if (isMobile) return
        function handleClick(e: MouseEvent) {
            if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
                setSwitcherOpen(false)
            }
        }
        if (switcherOpen) {
            document.addEventListener('mousedown', handleClick)
            return () => document.removeEventListener('mousedown', handleClick)
        }
    }, [switcherOpen, isMobile])

    // Close notifications on outside click (desktop only)
    useEffect(() => {
        if (isMobile) return
        function handleClick(e: MouseEvent) {
            if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
                setNotificationsOpen(false)
            }
        }
        if (notificationsOpen) {
            document.addEventListener('mousedown', handleClick)
            return () => document.removeEventListener('mousedown', handleClick)
        }
    }, [notificationsOpen, isMobile])

    // Global ⌘K handler
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                onSearchOpen()
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onSearchOpen])

    const toggleTheme = () => {
        const newDark = !isDark
        setIsDark(newDark)
        if (newDark) {
            document.documentElement.classList.add('dark')
            document.documentElement.style.colorScheme = 'dark'
            localStorage.setItem('letbuyy_theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            document.documentElement.style.colorScheme = 'light'
            localStorage.setItem('letbuyy_theme', 'light')
        }
    }

    const handleSignOut = async () => {
        try {
            const res = await fetch('/api/auth/logout', {
                method: 'POST',
            })
            const data = await res.json()
            window.location.assign(data.redirectTo || `${process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3001'}/lookup`)
        } catch {
            window.location.assign(`${process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3001'}/lookup`)
        }
    }

    const handleSwitchStore = (subdomain: string) => {
        setSwitcherOpen(false)
        router.push(`/${subdomain}/dashboard`)
    }

    const closeSwitcher = useCallback(() => setSwitcherOpen(false), [])
    const closeNotifications = useCallback(() => setNotificationsOpen(false), [])

    const userInitial = (user.fullName || user.email).charAt(0).toUpperCase()

    /* ——— Store switcher content (shared between dropdown & bottom sheet) ——— */
    const switcherContent = (
        <>
            {/* Drag handle for mobile bottom sheet */}
            {isMobile && <div className="bottom-sheet-handle" />}

            {/* Section 1: Store list */}
            <div className="store-switcher-section">
                {userStores.map((s) => {
                    const isCurrent = s.subdomain === store || s.store_name === store
                    return (
                        <button
                            key={s.id}
                            className={`store-switcher-item ${isCurrent ? 'active' : ''}`}
                            onClick={() => !isCurrent && handleSwitchStore(s.subdomain)}
                        >
                            <span className="store-switcher-item-icon">
                                {getStoreInitials(s.name || s.store_name)}
                            </span>
                            <div className="store-switcher-item-info">
                                <span className="store-switcher-item-name">{s.name || s.store_name}</span>
                                <span className="store-switcher-item-type">
                                    {getSiteTypeLabel(s.site_type)}
                                </span>
                            </div>
                            {isCurrent && (
                                <MaterialIcon name="check" className="store-switcher-check" />
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="store-switcher-divider" />

            {/* Section 2: All stores link */}
            <div className="store-switcher-section">
                <button
                    className="store-switcher-link"
                    onClick={() => {
                        setSwitcherOpen(false)
                        window.location.href = '/stores'
                    }}
                >
                    <MaterialIcon name="apps" />
                    All stores
                </button>
            </div>

            <div className="store-switcher-divider" />

            {/* Section 3: Theme toggle */}
            <div className="store-switcher-section">
                <div className="store-switcher-theme">
                    <div className="store-switcher-theme-label">
                        <MaterialIcon name={isDark ? 'dark_mode' : 'light_mode'} />
                        {isDark ? 'Dark mode' : 'Light mode'}
                    </div>
                    <button
                        className={`admin-theme-switch ${isDark ? 'active' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation()
                            toggleTheme()
                        }}
                        aria-label="Toggle theme"
                    />
                </div>
            </div>

            <div className="store-switcher-divider" />

            {/* Section 4: User info */}
            <div className="store-switcher-section">
                <div className="store-switcher-user">
                    <div className="store-switcher-user-avatar">{userInitial}</div>
                    <div className="store-switcher-user-info">
                        <span className="store-switcher-user-name">{user.fullName || 'User'}</span>
                        <span className="store-switcher-user-email">{user.email}</span>
                    </div>
                </div>
            </div>

            <div className="store-switcher-divider" />

            {/* Section 5: Log out */}
            <div className="store-switcher-section">
                <button
                    className="store-switcher-link logout"
                    onClick={handleSignOut}
                >
                    <MaterialIcon name="logout" />
                    Log out
                </button>
            </div>
        </>
    )

    return (
        <>
            <header className="admin-header">
                {/* Left: Logo + hamburger or ← Home */}
                <div className="admin-header-left">
                    {isSettingsPage ? (
                        <Link href={`/${store}/dashboard`} className="admin-header-back">
                            <MaterialIcon name="arrow_back" style={{ fontSize: '20px' }} />
                            <span>Home</span>
                        </Link>
                    ) : (
                        <>
                            <button
                                className="admin-header-hamburger"
                                onClick={onMenuToggle}
                                aria-label="Open menu"
                            >
                                <MaterialIcon name="menu" style={{ fontSize: '22px' }} />
                            </button>

                            <div className="admin-header-logo">
                                <span className="admin-header-logo-icon" aria-hidden="true">L</span>
                                <span className="admin-header-brand">LetBuyy</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Center: search bar (desktop) */}
                <div className="admin-header-center">
                    <button className="admin-header-search" onClick={onSearchOpen}>
                        <MaterialIcon name="search" />
                        <span className="search-text">Search...</span>
                        <kbd>⌘K</kbd>
                    </button>
                </div>

                {/* Right: actions */}
                <div className="admin-header-right">
                    {/* Mobile search icon */}
                    <button
                        className="admin-header-btn admin-header-search-mobile"
                        onClick={onSearchOpen}
                        title="Search"
                    >
                        <MaterialIcon name="search" style={{ fontSize: '20px' }} />
                    </button>

                    {/* AI button */}
                    <button
                        className="admin-header-btn"
                        onClick={onAISidebarToggle}
                        title="LetBuyy AI"
                    >
                        <MaterialIcon name="auto_awesome" style={{ fontSize: '20px' }} />
                    </button>

                    {/* Notifications */}
                    <div className="admin-notifications-container" ref={notificationsRef}>
                        <button
                            className="admin-header-btn"
                            title="Notifications"
                            onClick={() => {
                                setNotificationsOpen(!notificationsOpen)
                                setSwitcherOpen(false)
                            }}
                        >
                            <MaterialIcon name="notifications" style={{ fontSize: '20px' }} />
                        </button>

                        {/* Desktop: inline dropdown */}
                        {notificationsOpen && !isMobile && <NotificationsPanel />}
                    </div>

                    {/* ===== STORE SWITCHER PILL ===== */}
                    <div className="store-switcher-container" ref={switcherRef}>
                        <button
                            className={`store-switcher-pill ${switcherOpen ? 'open' : ''}`}
                            onClick={() => {
                                setSwitcherOpen(!switcherOpen)
                                setNotificationsOpen(false)
                            }}
                        >
                            <span className="store-switcher-pill-icon">
                                {getStoreInitials(storeData.name || storeData.store_name)}
                            </span>
                            <span className="store-switcher-pill-name">
                                {storeData.name || storeData.store_name}
                            </span>
                            <MaterialIcon name="expand_more" className="store-switcher-pill-chevron" />
                        </button>

                        {/* Desktop: inline dropdown */}
                        {switcherOpen && !isMobile && (
                            <div className="store-switcher-dropdown">
                                {switcherContent}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ===== MOBILE BOTTOM SHEET: Store Switcher ===== */}
            {switcherOpen && isMobile && (
                <div className="bottom-sheet-overlay" onClick={closeSwitcher}>
                    <div
                        className="bottom-sheet store-switcher-bottom-sheet"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {switcherContent}
                    </div>
                </div>
            )}

            {/* ===== MOBILE BOTTOM SHEET: Notifications ===== */}
            {notificationsOpen && isMobile && (
                <div className="bottom-sheet-overlay" onClick={closeNotifications}>
                    <div
                        className="bottom-sheet notifications-bottom-sheet"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bottom-sheet-handle" />
                        <NotificationsPanel />
                    </div>
                </div>
            )}
        </>
    )
}
