'use client'

import { useState, useEffect } from 'react'
import { AuthIcon, type AuthIconName } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { getAdminDashboardUrl, getStorefrontRootDomain } from '@/lib/config/urls'
import { Button } from '@letbuyy/ui'
import { useAuthTheme } from '@/lib/useAuthTheme'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Choose a store',
        subtitle: 'Pick the workspace you want to manage.',
        createNew: 'Create a new site',
        opening: 'Opening...',
        storeType: 'Type',
        statusLabel: 'Status',
        onlineStore: 'Online Store',
    },
    hi: {
        title: 'एक स्टोर चुनें',
        subtitle: 'जिस वर्कस्पेस को मैनेज करना है उसे चुनें।',
        createNew: 'नई साइट बनाएं',
        opening: 'खुल रहा है...',
        storeType: 'प्रकार',
        statusLabel: 'स्थिति',
        onlineStore: 'ऑनलाइन स्टोर',
    },
    ta: {
        title: 'ஒரு கடையைத் தேர்ந்தெடுக்கவும்',
        subtitle: 'நீங்கள் நிர்வகிக்க வேண்டிய பணியிடத்தைத் தேர்ந்தெடுக்கவும்.',
        createNew: 'புதிய தளம் உருவாக்கு',
        opening: 'திறக்கிறது...',
        storeType: 'வகை',
        statusLabel: 'நிலை',
        onlineStore: 'ஆன்லைன் கடை',
    },
}

interface UserStore {
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
}

export default function SelectPage() {
    const [stores, setStores] = useState<UserStore[]>([])
    const [loading, setLoading] = useState<string | null>(null)
    const [initialLoading, setInitialLoading] = useState(true)
    const [sessionExpired, setSessionExpired] = useState(false)
    const { isDark, toggleTheme } = useAuthTheme()
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    useEffect(() => {
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        let redirecting = false

        fetch('/api/auth/stores')
            .then((res) => res.json())
            .then((data) => {
                if (redirecting) return

                if (!data.authenticated) {
                    setSessionExpired(true)
                    setInitialLoading(false)
                    return
                }

                const userStores: UserStore[] = data.stores || []

                if (userStores.length === 0) {
                    redirecting = true
                    window.location.replace('/onboarding')
                } else if (userStores.length === 1) {
                    redirecting = true
                    window.location.replace(getAdminDashboardUrl(userStores[0].subdomain))
                } else {
                    setStores(userStores)
                    setInitialLoading(false)
                }
            })
            .catch(() => {
                if (!redirecting) {
                    setSessionExpired(true)
                    setInitialLoading(false)
                }
            })
    }, [])

    const cycleLang = () => {
        const langs: Lang[] = ['en', 'hi', 'ta']
        const next = langs[(langs.indexOf(lang) + 1) % langs.length]
        setLang(next)
        localStorage.setItem('letbuyy_lang', next)
    }

    const handleSelectStore = (store: UserStore) => {
        setLoading(store.id)
        window.location.href = getAdminDashboardUrl(store.subdomain)
    }

    const formatLabel = (value: string) => (
        value
            .split(/[-_\s]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'Unknown'
    )

    const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'critical' => {
        const normalized = status.toLowerCase()
        if (['active', 'published', 'live'].includes(normalized)) return 'success'
        if (['draft', 'pending', 'review'].includes(normalized)) return 'warning'
        if (['suspended', 'disabled', 'archived'].includes(normalized)) return 'critical'
        return 'info'
    }

    const getSiteTypeLabel = (type: string) => {
        switch (type) {
            case 'store': return t.onlineStore
            case 'portfolio': return 'Portfolio'
            case 'resume': return 'Resume / CV'
            case 'landing': return 'Landing Page'
            case 'blog': return 'Blog'
            default: return formatLabel(type)
        }
    }

    const getSiteTypeIcon = (type: string): AuthIconName => {
        switch (type) {
            case 'store': return 'storefront'
            case 'portfolio': return 'palette'
            case 'resume': return 'description'
            case 'landing': return 'web'
            case 'blog': return 'article'
            default: return 'language'
        }
    }

    return (
        <main className="auth-container">
            <div className="auth-top-bar">
                <Button unstyled onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </Button>
                <Button unstyled onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
                </Button>
            </div>

            <div className="auth-card">
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                {initialLoading ? (
                    <div className="select-loading">
                        <div className="select-loading-spinner" />
                        <p>Loading your sites…</p>
                    </div>
                ) : sessionExpired ? (
                    <>
                        <h1 className="auth-title">Sign in to continue</h1>
                        <p className="auth-subtitle">Your session expired. Log in again to choose a site.</p>
                        <Button unstyled className="auth-btn-primary" onClick={() => { window.location.href = '/lookup' }}>
                            Log in
                        </Button>
                    </>
                ) : (
                    <>
                        <h1 className="auth-title">{t.title}</h1>
                        <p className="auth-subtitle">{t.subtitle}</p>

                        <div className="select-store-list">
                            {stores.map((store) => (
                                <Button
                                    key={store.id}
                                    unstyled
                                    className={`select-store-item${loading === store.id ? ' loading' : ''}`}
                                    onClick={() => handleSelectStore(store)}
                                    disabled={loading === store.id}
                                >
                                    <div className="select-store-avatar">
                                        <AuthIcon name={getSiteTypeIcon(store.site_type)} size={20} />
                                    </div>
                                    <div className="select-store-info">
                                        <span className="select-store-name">{store.store_name || store.name}</span>
                                        <span className="select-store-url">{store.subdomain}.{getStorefrontRootDomain()}</span>
                                        <span className="select-store-meta">
                                            <span className="select-meta-type">
                                                <AuthIcon name={getSiteTypeIcon(store.site_type)} size={11} />
                                                {getSiteTypeLabel(store.site_type)}
                                            </span>
                                            <span className="select-meta-sep" />
                                            <span className={`select-meta-status select-meta-status--${getStatusVariant(store.status)}`}>
                                                <span className="select-meta-dot" />
                                                {formatLabel(store.status)}
                                            </span>
                                        </span>
                                    </div>
                                    <span className="select-store-arrow">
                                        {loading === store.id
                                            ? <div className="select-loading-spinner small" />
                                            : <AuthIcon name="arrow_forward" size={16} />
                                        }
                                    </span>
                                </Button>
                            ))}
                        </div>

                        <button
                            type="button"
                            className="select-create-btn"
                            onClick={() => { window.location.href = '/onboarding' }}
                        >
                            <AuthIcon name="add" size={16} />
                            {t.createNew}
                        </button>
                    </>
                )}
            </div>
        </main>
    )
}
