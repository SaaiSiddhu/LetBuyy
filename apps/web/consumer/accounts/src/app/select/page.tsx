'use client'

import { useState, useEffect } from 'react'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Choose an account',
        subtitle: 'to continue to LetBuyy',
        useDifferent: 'Use a different account',
        removeAccount: 'Remove',
        lastLogin: 'Last login:',
    },
    hi: {
        title: 'एक अकाउंट चुनें',
        subtitle: 'LetBuyy पर जारी रखें',
        useDifferent: 'दूसरे अकाउंट का उपयोग करें',
        removeAccount: 'हटाएं',
        lastLogin: 'अंतिम लॉगिन:',
    },
    ta: {
        title: 'ஒரு கணக்கைத் தேர்ந்தெடுக்கவும்',
        subtitle: 'LetBuyy தொடரவும்',
        useDifferent: 'வேறு கணக்கைப் பயன்படுத்தவும்',
        removeAccount: 'அகற்று',
        lastLogin: 'கடைசி உள்நுழைவு:',
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
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000'

    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        let redirecting = false

        // Fetch user's stores
        fetch('/api/auth/stores')
            .then((res) => res.json())
            .then((data) => {
                if (redirecting) return

                if (!data.authenticated) {
                    redirecting = true
                    window.location.href = '/lookup'
                    return
                }

                const userStores: UserStore[] = data.stores || []

                if (userStores.length === 0) {
                    // No stores — redirect to onboarding
                    redirecting = true
                    window.location.href = '/onboarding'
                } else if (userStores.length === 1) {
                    // Single store — go directly to admin
                    redirecting = true
                    window.location.href = `${adminUrl}/${userStores[0].subdomain}/dashboard`
                } else {
                    // Multiple stores — show picker
                    setStores(userStores)
                    setInitialLoading(false)
                }
            })
            .catch(() => {
                if (!redirecting) {
                    redirecting = true
                    window.location.href = '/lookup'
                }
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const toggleTheme = () => {
        const newTheme = !isDark
        setIsDark(newTheme)
        localStorage.setItem('letbuyy_theme', newTheme ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', newTheme)
        document.documentElement.style.colorScheme = newTheme ? 'dark' : 'light'
    }

    const cycleLang = () => {
        const langs: Lang[] = ['en', 'hi', 'ta']
        const next = langs[(langs.indexOf(lang) + 1) % langs.length]
        setLang(next)
        localStorage.setItem('letbuyy_lang', next)
    }

    const handleSelectStore = (store: UserStore) => {
        setLoading(store.id)
        window.location.href = `${adminUrl}/${store.subdomain}/dashboard`
    }

    const getSiteTypeIcon = (type: string) => {
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
                <button onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </button>
                <button onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
                </button>
            </div>

            <div className="auth-card">
                {/* Logo */}
                <div className="auth-logo">
                    <img src="/icons/app_icon.png" alt="LetBuyy" width={48} height={48} />
                </div>

                {initialLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <p style={{ color: 'var(--text-hint)' }}>Loading your sites...</p>
                    </div>
                ) : (
                    <>
                        <h1 className="auth-title">{t.title}</h1>
                        <p className="auth-subtitle">{t.subtitle}</p>

                        <div className="auth-accounts-list">
                            {stores.map((store) => (
                                <button
                                    key={store.id}
                                    className="auth-account-item"
                                    onClick={() => handleSelectStore(store)}
                                    disabled={loading === store.id}
                                >
                                    <div className="auth-account-avatar">
                                        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                                            {getSiteTypeIcon(store.site_type)}
                                        </span>
                                    </div>
                                    <div className="auth-account-info">
                                        <span className="auth-account-name">{store.name}</span>
                                        <span className="auth-account-email">{store.subdomain}.letbuyy.store</span>
                                        <span className="auth-account-meta">
                                            {store.site_type} · {store.status}
                                        </span>
                                    </div>
                                    <span className="auth-account-arrow">
                                        {loading === store.id ? '...' : '→'}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <a href="/onboarding" className="auth-link-btn">
                            + Create a new site
                        </a>
                    </>
                )}
            </div>
        </main>
    )
}
