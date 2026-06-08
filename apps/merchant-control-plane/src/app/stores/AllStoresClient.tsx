'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, EmptyState, MaterialIcon, Plus, Store } from '@letbuyy/ui'
import { getAccountsUrl } from '@/lib/public-urls'

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

export default function AllStoresClient({ user, stores }: AllStoresClientProps) {
    const router = useRouter()
    const [tab, setTab] = useState<'active' | 'inactive'>('active')
    const [isDark, setIsDark] = useState(false)

    const accountsUrl = getAccountsUrl()

    useEffect(() => {
        const theme = localStorage.getItem('letbuyy_theme')
        setIsDark(theme === 'dark')
    }, [])

    const activeStores = stores.filter((s) => s.status === 'active')
    const inactiveStores = stores.filter((s) => s.status !== 'active')
    const filtered = tab === 'active' ? activeStores : inactiveStores
    const emptyTitle = tab === 'active' ? 'No active stores yet' : 'No inactive stores'
    const emptyBody = tab === 'active'
        ? 'Create a store to start managing products, storefront design, orders, and customers.'
        : 'Paused, archived, or pending stores will appear here when they need your attention.'

    const userInitial = (user.fullName || user.email).charAt(0).toUpperCase()
    const firstName = user.fullName ? user.fullName.split(' ')[0] : 'there'

    const handleCreateStore = () => {
        window.location.assign(`${accountsUrl}/onboarding`)
    }

    const handleOpenStore = (subdomain: string) => {
        router.push(`/${subdomain}/dashboard`)
    }

    return (
        <div className={`all-stores-bg ${isDark ? 'dark' : ''}`}>
            {/* Top bar: Logo + Avatar */}
            <div className="all-stores-topbar">
                <div className="all-stores-topbar-logo">
                    <span className="all-stores-topbar-logo-icon" aria-hidden="true">L</span>
                    <span className="all-stores-topbar-logo-text">LetBuyy</span>
                </div>

                <div className="all-stores-topbar-avatar">
                    {userInitial}
                </div>
            </div>

            {/* Body */}
            <div className="all-stores-body">
                {/* Greeting + Create */}
                <div className="all-stores-header">
                    <h1 className="all-stores-greeting">Welcome back, {firstName}</h1>
                    <Button unstyled className="all-stores-create-btn" onClick={handleCreateStore}>
                        <MaterialIcon name="add" size={18} />
                        Create store
                    </Button>
                </div>

                {/* Tabs */}
                <div className="all-stores-tabs">
                    <Button unstyled
                        className={`all-stores-tab ${tab === 'active' ? 'active' : ''}`}
                        onClick={() => setTab('active')}
                    >
                        Active ({activeStores.length})
                    </Button>
                    <Button unstyled
                        className={`all-stores-tab ${tab === 'inactive' ? 'active' : ''}`}
                        onClick={() => setTab('inactive')}
                    >
                        Inactive ({inactiveStores.length})
                    </Button>
                </div>

                {/* Store list */}
                <div className="all-stores-list">
                    {filtered.length === 0 ? (
                        <EmptyState
                            className="all-stores-empty-state"
                            icon={<Store className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title={emptyTitle}
                            body={emptyBody}
                            primaryAction={tab === 'active' ? (
                                <Button type="button" variant="primary" onClick={handleCreateStore}>
                                    <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Create store
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        filtered.map((store) => (
                            <Button unstyled
                                key={store.id}
                                className="all-stores-card"
                                onClick={() => handleOpenStore(store.subdomain)}
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
                                        {store.subdomain}.letbuyy.store
                                    </div>
                                </div>
                                <span className={`all-stores-card-status ${store.status === 'active' ? 'active' : 'inactive'}`}>
                                    {store.status}
                                </span>
                            </Button>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
