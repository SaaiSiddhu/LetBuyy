'use client'

import { useState, useEffect } from 'react'

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
    const [tab, setTab] = useState<'active' | 'inactive'>('active')
    const [isDark, setIsDark] = useState(false)

    const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'

    useEffect(() => {
        const theme = localStorage.getItem('letbuyy_theme')
        setIsDark(theme === 'dark')
    }, [])

    const activeStores = stores.filter((s) => s.status === 'active')
    const inactiveStores = stores.filter((s) => s.status !== 'active')
    const filtered = tab === 'active' ? activeStores : inactiveStores

    const userInitial = (user.fullName || user.email).charAt(0).toUpperCase()
    const firstName = user.fullName ? user.fullName.split(' ')[0] : 'there'

    const handleCreateStore = () => {
        window.location.href = `${accountsUrl}/onboarding`
    }

    const handleOpenStore = (subdomain: string) => {
        window.location.href = `/${subdomain}/dashboard`
    }

    return (
        <div className={`all-stores-bg ${isDark ? 'dark' : ''}`}>
            {/* Top bar: Logo + Avatar */}
            <div className="all-stores-topbar">
                <div className="all-stores-topbar-logo">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 40 40"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <rect width="40" height="40" rx="10" fill="var(--primary)" />
                        <text
                            x="50%"
                            y="54%"
                            dominantBaseline="middle"
                            textAnchor="middle"
                            fill="white"
                            fontSize="20"
                            fontWeight="700"
                            fontFamily="Inter, sans-serif"
                        >
                            L
                        </text>
                    </svg>
                    <span>LetBuyy</span>
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
                    <button className="all-stores-create-btn" onClick={handleCreateStore}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                        Create store
                    </button>
                </div>

                {/* Tabs */}
                <div className="all-stores-tabs">
                    <button
                        className={`all-stores-tab ${tab === 'active' ? 'active' : ''}`}
                        onClick={() => setTab('active')}
                    >
                        Active ({activeStores.length})
                    </button>
                    <button
                        className={`all-stores-tab ${tab === 'inactive' ? 'active' : ''}`}
                        onClick={() => setTab('inactive')}
                    >
                        Inactive ({inactiveStores.length})
                    </button>
                </div>

                {/* Store list */}
                <div className="all-stores-list">
                    {filtered.length === 0 ? (
                        <div className="all-stores-empty">
                            {tab === 'active'
                                ? 'No active stores. Create your first one!'
                                : 'No inactive stores.'
                            }
                        </div>
                    ) : (
                        filtered.map((store) => (
                            <button
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
                                            <span className="material-symbols-outlined">{getSiteTypeIcon(store.site_type)}</span>
                                            {getSiteTypeLabel(store.site_type)}
                                        </span>
                                        {store.subdomain}.letbuyy.store
                                    </div>
                                </div>
                                <span className={`all-stores-card-status ${store.status === 'active' ? 'active' : 'inactive'}`}>
                                    {store.status}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
