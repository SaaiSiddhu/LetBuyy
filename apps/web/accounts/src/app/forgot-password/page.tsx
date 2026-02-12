'use client'

import { useState, useEffect, useCallback } from 'react'
import TurnstileWidget from '@/components/TurnstileWidget'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Forgot password?',
        subtitle: "Enter your email and we'll send you a reset link.",
        email: 'Email',
        emailPlaceholder: 'you@example.com',
        sendResetLink: 'Send reset link',
        backToLogin: 'Back to login',
        rateLimited: 'Too many requests. Please try again later.',
    },
    hi: {
        title: 'पासवर्ड भूल गए?',
        subtitle: 'अपना ईमेल दर्ज करें और हम आपको एक रीसेट लिंक भेजेंगे।',
        email: 'ईमेल',
        emailPlaceholder: 'you@example.com',
        sendResetLink: 'रीसेट लिंक भेजें',
        backToLogin: 'लॉगिन पर वापस',
        rateLimited: 'बहुत सारे प्रयास। कृपया बाद में पुनः प्रयास करें।',
    },
    ta: {
        title: 'கடவுச்சொல் மறந்துவிட்டதா?',
        subtitle: 'உங்கள் மின்னஞ்சலை உள்ளிடவும், மீட்டமைப்பு இணைப்பை அனுப்புவோம்.',
        email: 'மின்னஞ்சல்',
        emailPlaceholder: 'you@example.com',
        sendResetLink: 'மீட்டமைப்பு இணைப்பை அனுப்பவும்',
        backToLogin: 'உள்நுழைவுக்குத் திரும்பவும்',
        rateLimited: 'பல முயற்சிகள். பிறகு மீண்டும் முயற்சிக்கவும்.',
    },
}

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

    const t = translations[lang]

    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)
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

    const handleTurnstileVerify = useCallback((token: string) => {
        setTurnstileToken(token)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/send-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    turnstileToken,
                }),
            })

            if (res.status === 429) {
                setError(t.rateLimited)
                return
            }

            // Always redirect to check-email (don't reveal if email exists)
            window.location.href = `/check-email?email=${encodeURIComponent(email.trim())}&type=password_reset`
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
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
                {/* No logo on forgot-password */}

                <div className="auth-icon">🔒</div>

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">{t.subtitle}</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="resetEmail">{t.email}</label>
                        <input
                            id="resetEmail"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t.emailPlaceholder}
                            autoComplete="email"
                            autoFocus
                            required
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <button
                        type="submit"
                        className="auth-btn-primary"
                        disabled={loading || !email.trim()}
                    >
                        {loading ? '...' : t.sendResetLink}
                    </button>
                </form>

                <a href="/lookup" className="auth-link-btn">
                    ← {t.backToLogin}
                </a>

                <TurnstileWidget onVerify={handleTurnstileVerify} />
            </div>
        </main>
    )
}
