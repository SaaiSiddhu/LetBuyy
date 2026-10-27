'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    Button,
    Dropdown,
    type DropdownItem,
    EmptyState,
    LogOut,
    MaterialIcon,
    Plus,
    StatusPresentationBadge,
    Store,
    Tabs,
    type TabItem,
} from '@letbuyy/ui'
import { SITE_STATUS_PRESENTATION, presentStatus } from '@letbuyy/shared-types'
import { getAccountsUrl, getStorefrontRootDomain } from '@/lib/public-urls'

interface UserStore {
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
}

interface SessionUser {
    id: string
    email: string
    fullName?: string | null
}

interface AllStoresClientProps {
    user: SessionUser
    stores: UserStore[]
}

function getStoreInitials(name: string): string {
    const words = name.trim().split(/\s+/)
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
}

function getSiteTypeIcon(type: string): string {
    switch (type) {
        case 'store': return 'storefront'
        case 'portfolio': return 'palette'
        case 'resume': return 'description'
        case 'landing': return 'web'
        case 'blog': return 'article'
        default: return 'language'
    }
}

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

interface StoreListPanelProps {
    stores: UserStore[]
    emptyTitle: string
    emptyBody: string
    onOpen: (subdomain: string) => void
    onCreate?: () => void
}

function StoreListPanel({ stores, emptyTitle, emptyBody, onOpen, onCreate }: StoreListPanelProps) {
    if (stores.length === 0) {
        return (
            <EmptyState
                className="all-stores-empty-state"
                icon={<Store className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                title={emptyTitle}
                body={emptyBody}
                primaryAction={onCreate ? (
                    <Button type="button" variant="primary" onClick={onCreate}>
                        <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                        Create store
                    </Button>
                ) : undefined}
            />
        )
    }

    return (
        <div className="all-stores-list">
            {stores.map((store) => (
                <Button unstyled
                    key={store.id}
                    className="all-stores-card"
                    onClick={() => onOpen(store.subdomain)}
                >
                    <div className="all-stores-card-icon">
                        {getStoreInitials(store.name || store.store_name)}
                    </div>
                    <div className="all-stores-card-info">
                        <div className="all-stores-card-name">{store.name || store.store_name}</div>
                        <div className="all-stores-card-meta">
                            <span className="type-badge">
                                <MaterialIcon name={getSiteTypeIcon(store.site_type)} />
                                {getSiteTypeLabel(store.site_type)}
                            </span>
                            <span className="all-stores-card-domain">{store.subdomain}.{getStorefrontRootDomain()}</span>
                        </div>
                    </div>
                    <div className="all-stores-card-trailing">
                        <StatusPresentationBadge
                            className="all-stores-status-badge"
                            presentation={presentStatus(SITE_STATUS_PRESENTATION, store.status)}
                        />
                        <MaterialIcon name="chevron_right" className="all-stores-card-chevron" aria-hidden="true" />
                    </div>
                </Button>
            ))}
        </div>
    )
}

export default function AllStoresClient({ user, stores }: AllStoresClientProps) {
    const router = useRouter()
    const [isDark, setIsDark] = useState(false)

    const accountsUrl = getAccountsUrl()

    useEffect(() => {
        const theme = localStorage.getItem('letbuyy-theme')
        setIsDark(theme === 'dark')
    }, [])

    // `sites.status` is draft | published | unpublished | frozen | suspended —
    // there is no 'active' value, so a store only belongs on the Active tab
    // once it is actually live and visible to shoppers.
    const activeStores = stores.filter((s) => s.status === 'published')
    const inactiveStores = stores.filter((s) => s.status !== 'published')

    const userDisplayName = user.fullName?.trim() || user.email.split('@')[0] || 'Account'
    const userInitial = userDisplayName.charAt(0).toUpperCase()
    const firstName = user.fullName ? user.fullName.split(' ')[0] : 'there'

    const handleCreateStore = () => {
        window.location.assign(`${accountsUrl}/onboarding`)
    }

    const handleOpenStore = (subdomain: string) => {
        router.push(`/${subdomain}/dashboard`)
    }

    const handleSignOut = async () => {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' })
            const data = await res.json()
            window.location.assign(data.redirectTo || getAccountsUrl('/lookup'))
        } catch {
            window.location.assign(getAccountsUrl('/lookup'))
        }
    }

    const accountMenuItems: DropdownItem[] = [
        {
            id: 'account-info',
            label: userDisplayName,
            description: user.email,
        },
        {
            id: 'logout',
            label: 'Log out',
            icon: <LogOut className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            onSelect: handleSignOut,
        },
    ]

    const tabItems: TabItem[] = [
        {
            value: 'active',
            label: 'Active',
            badge: String(activeStores.length),
            content: (
                <StoreListPanel
                    stores={activeStores}
                    emptyTitle="No active stores yet"
                    emptyBody="Create a store to start managing products, storefront design, orders, and customers."
                    onOpen={handleOpenStore}
                    onCreate={handleCreateStore}
                />
            ),
        },
        {
            value: 'inactive',
            label: 'Inactive',
            badge: String(inactiveStores.length),
            content: (
                <StoreListPanel
                    stores={inactiveStores}
                    emptyTitle="No inactive stores"
                    emptyBody="Draft, unpublished, frozen, or suspended stores will appear here when they need your attention."
                    onOpen={handleOpenStore}
                />
            ),
        },
    ]

    return (
        <div className={`all-stores-shell ${isDark ? 'dark' : ''}`}>
            {/* Header bar — same dark chrome as the store dashboard header */}
            <header className="all-stores-header-bar">
                <div className="all-stores-header-logo" aria-label="LetBuyy">
                    <span className="all-stores-header-logo-frame" aria-hidden="true">
                        <Image
                            src="/icons/letbuyy-logo-dark.svg"
                            alt="LetBuyy"
                            fill
                            priority
                            sizes="148px"
                            className="all-stores-header-logo-image"
                        />
                    </span>
                </div>

                <Dropdown
                    align="end"
                    ariaLabel="Account menu"
                    items={accountMenuItems}
                    trigger={
                        <Button
                            unstyled
                            type="button"
                            className="all-stores-account-trigger"
                            aria-label={`Account menu for ${userDisplayName}`}
                        >
                            <span className="all-stores-account-avatar">{userInitial}</span>
                            <MaterialIcon name="expand_more" className="all-stores-account-chevron" aria-hidden="true" />
                        </Button>
                    }
                />
            </header>

            {/* Curved page sheet, flush under the header — matches the dashboard shell */}
            <div className="all-stores-frame">
                <div className="all-stores-sheet">
                    <div className="all-stores-body">
                        <div className="all-stores-header-row">
                            <div className="all-stores-heading">
                                <h1 className="all-stores-greeting">Welcome back, {firstName}</h1>
                                <p className="all-stores-subtitle">
                                    Manage your storefronts, products, and orders — all from one place.
                                </p>
                            </div>
                            <Button type="button" variant="primary" onClick={handleCreateStore}>
                                <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Create store
                            </Button>
                        </div>

                        <Tabs
                            ariaLabel="Your stores"
                            variant="underline"
                            items={tabItems}
                            className="all-stores-tabs"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
