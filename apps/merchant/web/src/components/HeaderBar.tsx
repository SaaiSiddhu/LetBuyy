'use client'

import { Suspense, use, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useMerchantRouter as useRouter, useMerchantDeparture } from './MerchantNavigationProvider'
import { MerchantNavigationLink as Link } from './MerchantNavigationLink'
import Image from 'next/image'
import type { SessionUser } from '@/lib/auth/session'
import type { StoreData, UserStore, StoreSwitcherResult } from './AdminShell'
import dynamic from 'next/dynamic'
import { Button, MaterialIcon, acquireScrollLock } from '@letbuyy/ui'
import { resolveKeyboardShortcut } from './merchantNavigation'
import { getAccountsUrl } from '@/lib/public-urls'

const NotificationsPanel = dynamic(() => import('./NotificationsPanel'))

interface HeaderBarProps {
    store: string
    storeData: StoreData
    user: SessionUser
    userStores: UserStore[]
    userStoresPromise?: Promise<StoreSwitcherResult>
    onMenuToggle: () => void
    onSearchOpen: () => void
    onAISidebarToggle: () => void
    isSettingsPage?: boolean
    /** Whether the shared nav drawer is open — drives the menu/close icon swap. */
    isMenuOpen?: boolean
    /** id of the drawer this button controls, for aria-controls. */
    menuDrawerId?: string
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

function DeferredStoreList({ promise, fallback, render, retry }: {
    promise: Promise<StoreSwitcherResult>
    fallback: UserStore[]
    render: (stores: UserStore[]) => ReactNode
    retry: () => void
}) {
    const result = use(promise)
    return <>
        {result.unavailable && <div role="alert" className="p-[var(--lb-space-3)]">
            Other stores could not load. <Button variant="ghost" onClick={retry}>Retry stores</Button>
        </div>}
        {render(result.stores.length ? result.stores : fallback)}
    </>
}

export default function MerchantHeaderBar({
    store,
    storeData,
    user,
    userStores,
    userStoresPromise,
    onMenuToggle,
    onSearchOpen,
    onAISidebarToggle,
    isSettingsPage = false,
    isMenuOpen = false,
    menuDrawerId,
}: HeaderBarProps) {
    const router = useRouter()
    const requestDeparture = useMerchantDeparture()
    const [switcherOpen, setSwitcherOpen] = useState(false)
    const [notificationsOpen, setNotificationsOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const switcherRef = useRef<HTMLDivElement>(null)
    const notificationsRef = useRef<HTMLDivElement>(null)
    const shortcutPrefixRef = useRef<string | null>(null)
    const shortcutTimerRef = useRef<number | null>(null)

    // Detect mobile viewport
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    // Freeze the page behind the mobile bottom sheets. The shared lock, not a
    // local body.style.overflow write: the page scroller is not the document,
    // and the old cleanup wrote '' rather than the previous value, which
    // released the nav drawer's lock if both were open.
    useEffect(() => {
        if (!isMobile || !(switcherOpen || notificationsOpen)) return
        return acquireScrollLock()
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

    const clearShortcutPrefix = useCallback(() => {
        shortcutPrefixRef.current = null
        if (shortcutTimerRef.current) {
            window.clearTimeout(shortcutTimerRef.current)
            shortcutTimerRef.current = null
        }
    }, [])

    // Global command palette and route shortcut handler
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                onSearchOpen()
                return
            }

            if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) {
                return
            }

            const key = e.key.toLowerCase()
            const currentPrefix = shortcutPrefixRef.current

            if (currentPrefix) {
                const destination = resolveKeyboardShortcut(storeData.site_type, `${currentPrefix} ${key}`)
                clearShortcutPrefix()

                if (destination) {
                    e.preventDefault()
                    router.push(`/${store}/${destination}`)
                }

                return
            }

            if (key === 'g' || key === 'n') {
                e.preventDefault()
                shortcutPrefixRef.current = key
                shortcutTimerRef.current = window.setTimeout(clearShortcutPrefix, 1200)
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('keydown', handleKey)
            clearShortcutPrefix()
        }
    }, [clearShortcutPrefix, onSearchOpen, router, store, storeData.site_type])

    const performSignOut = async () => {
        try {
            const res = await fetch('/api/auth/logout', {
                method: 'POST',
            })
            const data = await res.json()
            window.location.assign(data.redirectTo || getAccountsUrl('/lookup'))
        } catch {
            window.location.assign(getAccountsUrl('/lookup'))
        }
    }
    const handleSignOut = () => requestDeparture(() => { void performSignOut() })

    const handleSwitchStore = (subdomain: string) => {
        setSwitcherOpen(false)
        router.push(`/${subdomain}/dashboard`)
    }

    const closeSwitcher = useCallback(() => setSwitcherOpen(false), [])
    const closeNotifications = useCallback(() => setNotificationsOpen(false), [])

    const userDisplayName = user.fullName?.trim() || user.email.split('@')[0] || 'Account'
    const userInitial = userDisplayName.charAt(0).toUpperCase()

    const renderStores = (stores: UserStore[]) => stores.map((s) => {
        const isCurrent = s.subdomain === store || s.store_name === store
        return <Button unstyled key={s.id} className={`store-switcher-item ${isCurrent ? 'active' : ''}`}
            onClick={() => !isCurrent && handleSwitchStore(s.subdomain)}>
            <span className="store-switcher-item-icon">{getStoreInitials(s.name || s.store_name)}</span>
            <div className="store-switcher-item-info">
                <span className="store-switcher-item-name">{s.name || s.store_name}</span>
                <span className="store-switcher-item-type">{getSiteTypeLabel(s.site_type)}</span>
            </div>
            {isCurrent && <MaterialIcon name="check" className="store-switcher-check" />}
        </Button>
    })

    /* ——— Store switcher content (shared between dropdown & bottom sheet) ——— */
    const switcherContent = (
        <>
            {/* Drag handle for mobile bottom sheet */}
            {isMobile && <div className="bottom-sheet-handle" />}

            {/* Section 1: Store list */}
            <div className="store-switcher-section">
                {userStoresPromise ? <Suspense fallback={<>
                    {renderStores(userStores)}
                    <p role="status" className="p-[var(--lb-space-3)]">Loading stores…</p>
                </>}><DeferredStoreList promise={userStoresPromise} fallback={userStores} render={renderStores} retry={() => router.refresh()} /></Suspense> : renderStores(userStores)}
            </div>

            {/* Section 2: All stores link */}
            <div className="store-switcher-section">
                <Button unstyled
                    className="store-switcher-link"
                    onClick={() => {
                        setSwitcherOpen(false)
                        router.push('/stores')
                    }}
                >
                    <MaterialIcon name="apps" />
                    All stores
                </Button>
            </div>

            <div className="store-switcher-divider" />

            {/* Section 3: User info */}
            <div className="store-switcher-section">
                <div className="store-switcher-user">
                    <div className="store-switcher-user-avatar">{userInitial}</div>
                    <div className="store-switcher-user-info">
                        <span className="store-switcher-user-name">{userDisplayName}</span>
                        <span className="store-switcher-user-email">{user.email}</span>
                    </div>
                </div>
            </div>

            {/* Section 4: Log out */}
            <div className="store-switcher-section">
                <Button unstyled
                    className="store-switcher-link logout"
                    onClick={handleSignOut}
                >
                    <MaterialIcon name="logout" />
                    Log out
                </Button>
            </div>
        </>
    )

    return (
        <>
            <header className={`admin-header ${isSettingsPage ? 'settings-header' : ''}`}>
                {/* Left: Logo + hamburger or back affordance */}
                <div className="admin-header-left">
                    <Button unstyled
                        type="button"
                        className="admin-header-hamburger"
                        onClick={onMenuToggle}
                        // MaterialIcon is always aria-hidden, so this label is the
                        // button's only accessible name — it has to track the state.
                        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isMenuOpen}
                        aria-controls={menuDrawerId}
                    >
                        <MaterialIcon name={isMenuOpen ? 'close' : 'menu'} size={20} />
                    </Button>

                    <Link href={`/${store}/dashboard`} className="admin-header-logo" aria-label="LetBuyy dashboard">
                        <span className="admin-header-logo-frame" aria-hidden="true">
                            <Image
                                src="/icons/letbuyy-logo-dark.svg"
                                alt="LetBuyy"
                                fill
                                priority
                                sizes="144px"
                                className="admin-header-logo-image"
                            />
                        </span>
                    </Link>
                </div>

                {/* Center: search bar (desktop) */}
                <div className="admin-header-center">
                    <Button unstyled type="button" className="admin-header-search" onClick={onSearchOpen}>
                        <MaterialIcon name="search" />
                        <span className="search-text">Search</span>
                        <span className="admin-header-shortcut" aria-hidden="true">
                            <kbd>⌘</kbd>
                            <kbd>K</kbd>
                        </span>
                    </Button>
                </div>

                {/* Right: actions */}
                <div className="admin-header-right">
                    {/* Mobile search icon */}
                    <Button unstyled
                        type="button"
                        className="admin-header-btn admin-header-search-mobile"
                        onClick={onSearchOpen}
                        title="Search"
                        aria-label="Search"
                    >
                        <MaterialIcon name="search" size={18} />
                    </Button>

                    {/* Setup assistant button */}
                    <Button unstyled
                        type="button"
                        className="admin-header-btn"
                        onClick={onAISidebarToggle}
                        title="Setup assistant"
                        aria-label="Setup assistant"
                    >
                        <MaterialIcon name="assistant" size={16} />
                    </Button>

                    {/* Notifications */}
                    <div className="admin-notifications-container" ref={notificationsRef}>
                        <Button unstyled
                            type="button"
                            className="admin-header-btn"
                            title="Notifications"
                            aria-label="Notifications"
                            onClick={() => {
                                setNotificationsOpen(!notificationsOpen)
                                setSwitcherOpen(false)
                            }}
                        >
                            <MaterialIcon name="notifications" size={16} />
                        </Button>

                        {/* Desktop: inline dropdown */}
                        {notificationsOpen && !isMobile && <NotificationsPanel />}
                    </div>

                    {/* ===== STORE SWITCHER PILL ===== */}
                    <div className="store-switcher-container" ref={switcherRef}>
                        <Button unstyled
                            type="button"
                            className={`store-switcher-pill ${switcherOpen ? 'open' : ''}`}
                            onClick={() => {
                                setSwitcherOpen(!switcherOpen)
                                setNotificationsOpen(false)
                            }}
                            aria-expanded={switcherOpen}
                            aria-label={`Switch store, current store ${storeData.name || storeData.store_name}`}
                        >
                            <span className="store-switcher-pill-icon">
                                {getStoreInitials(storeData.name || storeData.store_name)}
                            </span>
                            <span className="store-switcher-pill-name">
                                {storeData.name || storeData.store_name}
                            </span>
                            <MaterialIcon name="expand_more" className="store-switcher-pill-chevron" />
                        </Button>

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

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false
    }

    const tagName = target.tagName.toLowerCase()
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
}
