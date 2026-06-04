'use client'

import { useState, useEffect } from 'react'
import { AuthIcon, type AuthIconName } from '@/components/AuthIcon'
import { getAdminDashboardUrl } from '@/lib/config/urls'
import { Badge, Banner, Button } from '@letbuyy/ui'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Choose a store',
        subtitle: 'Pick the workspace you want to manage.',
        selectorHint: 'Multiple stores found',
        selectorHintDesc: 'Each store opens in its own merchant dashboard with the right site type and status context.',
        createNew: 'Create a new site',
        opening: 'Opening...',
        storeType: 'Type',
        statusLabel: 'Status',
        onlineStore: 'Online Store',
        useDifferent: 'Use a different account',
        removeAccount: 'Remove',
        lastLogin: 'Last login:',
    },
    hi: {
        title: 'एक स्टोर चुनें',
        subtitle: 'जिस वर्कस्पेस को मैनेज करना है उसे चुनें।',
        selectorHint: 'कई स्टोर मिले',
        selectorHintDesc: 'हर स्टोर सही साइट प्रकार और स्थिति संदर्भ के साथ अपने merchant dashboard में खुलता है।',
        createNew: 'नई साइट बनाएं',
        opening: 'खुल रहा है...',
        storeType: 'प्रकार',
        statusLabel: 'स्थिति',
        onlineStore: 'ऑनलाइन स्टोर',
        useDifferent: 'दूसरे अकाउंट का उपयोग करें',
        removeAccount: 'हटाएं',
        lastLogin: 'अंतिम लॉगिन:',
    },
    ta: {
        title: 'ஒரு கடையைத் தேர்ந்தெடுக்கவும்',
        subtitle: 'நீங்கள் நிர்வகிக்க வேண்டிய பணியிடத்தைத் தேர்ந்தெடுக்கவும்.',
        selectorHint: 'பல கடைகள் கிடைத்தன',
        selectorHintDesc: 'ஒவ்வொரு கடையும் சரியான தள வகை மற்றும் நிலை விவரங்களுடன் தனி merchant dashboard-ல் திறக்கும்.',
        createNew: 'புதிய தளம் உருவாக்கு',
        opening: 'திறக்கிறது...',
        storeType: 'வகை',
        statusLabel: 'நிலை',
        onlineStore: 'ஆன்லைன் கடை',
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
    const [sessionExpired, setSessionExpired] = useState(false)
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

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
                    setSessionExpired(true)
                    setInitialLoading(false)
                    return
                }

                const userStores: UserStore[] = data.stores || []

                if (userStores.length === 0) {
                    // No stores — redirect to onboarding
                    redirecting = true
                    window.location.replace('/onboarding')
                } else if (userStores.length === 1) {
                    // Single store — go directly to admin
                    redirecting = true
                    window.location.replace(getAdminDashboardUrl(userStores[0].subdomain))
                } else {
                    // Multiple stores — show picker
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
                <button onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </button>
                <button onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
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
                ) : sessionExpired ? (
                    <>
                        <h1 className="auth-title">Sign in to continue</h1>
                        <p className="auth-subtitle">Your session expired. Log in again to choose a site.</p>
                        <button className="auth-btn-primary" onClick={() => { window.location.href = '/lookup' }}>
                            Log in
                        </button>
                    </>
                ) : (
                    <>
                        <h1 className="auth-title">{t.title}</h1>
                        <p className="auth-subtitle">{t.subtitle}</p>

                        <Banner title={t.selectorHint} variant="info" className="text-left">
                            {t.selectorHintDesc}
                        </Banner>

                        <div className="auth-accounts-list">
                            {stores.map((store) => (
                                <button
                                    key={store.id}
                                    className="auth-account-item"
                                    onClick={() => handleSelectStore(store)}
                                    disabled={loading === store.id}
                                >
                                    <div className="auth-account-avatar">
                                        <AuthIcon name={getSiteTypeIcon(store.site_type)} size={22} />
                                    </div>
                                    <div className="auth-account-info">
                                        <span className="auth-account-name">{store.store_name || store.name}</span>
                                        <span className="auth-account-email">{store.subdomain}.letbuyy.store</span>
                                        <span className="auth-account-meta flex flex-wrap gap-[var(--lb-space-1)]">
                                            <Badge label={`${t.storeType}: ${getSiteTypeLabel(store.site_type)}`} variant="info" />
                                            <Badge label={`${t.statusLabel}: ${formatLabel(store.status)}`} variant={getStatusVariant(store.status)} />
                                        </span>
                                    </div>
                                    <span className="auth-account-arrow">
                                        {loading === store.id ? t.opening : <AuthIcon name="arrow_forward" size={18} />}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            fullWidth
                            onClick={() => {
                                window.location.href = '/onboarding'
                            }}
                        >
                            {t.createNew}
                        </Button>
                    </>
                )}
            </div>
        </main>
    )
}
