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

interface SavedAccount {
    email: string
    name: string | null
    avatar: string | null
    lastLogin: string
}

export default function SelectPage() {
    const [accounts, setAccounts] = useState<SavedAccount[]>([])
    const [loading, setLoading] = useState<string | null>(null)
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        // Check for authenticated session
        fetch('/api/auth/session')
            .then((res) => res.json())
            .then((data) => {
                if (data.authenticated) {
                    setAccounts([{
                        email: data.user.email,
                        name: data.user.fullName,
                        avatar: data.user.avatarUrl,
                        lastLogin: new Date().toISOString(),
                    }])
                } else {
                    // No session — redirect to login
                    window.location.href = '/lookup'
                }
            })
            .catch(() => {
                window.location.href = '/lookup'
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

    const handleSwitch = async (account: SavedAccount) => {
        setLoading(account.email)

        try {
            const res = await fetch('/api/auth/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: account.email }),
            })

            const data = await res.json()
            if (data.success) {
                window.location.href = data.redirectTo
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(null)
        }
    }

    const formatLastLogin = (date: string) => {
        const diff = Date.now() - new Date(date).getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        if (hours < 1) return 'Just now'
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
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
                {/* No logo on select */}

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">{t.subtitle}</p>

                <div className="auth-accounts-list">
                    {accounts.map((account) => (
                        <button
                            key={account.email}
                            className="auth-account-item"
                            onClick={() => handleSwitch(account)}
                            disabled={loading === account.email}
                        >
                            <div className="auth-account-avatar">
                                {account.avatar ? (
                                    <img src={account.avatar} alt="" width={40} height={40} />
                                ) : (
                                    <span>{(account.name || account.email)[0].toUpperCase()}</span>
                                )}
                            </div>
                            <div className="auth-account-info">
                                {account.name && <span className="auth-account-name">{account.name}</span>}
                                <span className="auth-account-email">{account.email}</span>
                                <span className="auth-account-meta">
                                    {t.lastLogin} {formatLastLogin(account.lastLogin)}
                                </span>
                            </div>
                            <span className="auth-account-arrow">
                                {loading === account.email ? '...' : '→'}
                            </span>
                        </button>
                    ))}
                </div>

                <a href="/lookup" className="auth-link-btn">
                    + {t.useDifferent}
                </a>
            </div>
        </main>
    )
}
