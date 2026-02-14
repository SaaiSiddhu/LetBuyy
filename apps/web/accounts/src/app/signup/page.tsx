'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { useSearchParams } from 'next/navigation'
import TurnstileWidget from '@/components/TurnstileWidget'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Start your free trial',
        subtitle: '14 days free, then ₹20/month',
        email: 'Email',
        emailPlaceholder: 'you@example.com',
        createAccount: 'Create account',
        or: 'or',
        apple: 'Apple',
        google: 'Google',
        alreadyHave: 'Already have an account?',
        logIn: 'Log in',
        terms: 'By proceeding, you agree to the',
        termsLink: 'Terms',
        and: 'and',
        privacyLink: 'Privacy Policy',
        emailExists: 'An account with this email already exists',
        rateLimited: 'Too many signup attempts. Please try again later.',
    },
    hi: {
        title: 'अपना मुफ़्त ट्रायल शुरू करें',
        subtitle: '14 दिन मुफ़्त, फिर ₹20/माह',
        email: 'ईमेल',
        emailPlaceholder: 'you@example.com',
        createAccount: 'अकाउंट बनाएं',
        or: 'या',
        apple: 'Apple',
        google: 'Google',
        alreadyHave: 'पहले से अकाउंट है?',
        logIn: 'लॉग इन',
        terms: 'आगे बढ़कर, आप सहमत हैं',
        termsLink: 'शर्तें',
        and: 'और',
        privacyLink: 'गोपनीयता नीति',
        emailExists: 'इस ईमेल से एक अकाउंट पहले से मौजूद है',
        rateLimited: 'बहुत सारे प्रयास। कृपया बाद में पुनः प्रयास करें।',
    },
    ta: {
        title: 'உங்கள் இலவச சோதனையைத் தொடங்குங்கள்',
        subtitle: '14 நாட்கள் இலவசம், பின்னர் ₹20/மாதம்',
        email: 'மின்னஞ்சல்',
        emailPlaceholder: 'you@example.com',
        createAccount: 'கணக்கை உருவாக்கவும்',
        or: 'அல்லது',
        apple: 'Apple',
        google: 'Google',
        alreadyHave: 'ஏற்கனவே கணக்கு உள்ளதா?',
        logIn: 'உள்நுழை',
        terms: 'தொடர்வதன் மூலம், நீங்கள் ஒப்புக்கொள்கிறீர்கள்',
        termsLink: 'விதிமுறைகள்',
        and: 'மற்றும்',
        privacyLink: 'தனியுரிமைக் கொள்கை',
        emailExists: 'இந்த மின்னஞ்சலில் ஏற்கனவே கணக்கு உள்ளது',
        rateLimited: 'பல முயற்சிகள். பிறகு மீண்டும் முயற்சிக்கவும்.',
    },
}

function SignupContent() {
    const searchParams = useSearchParams()
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

        // Pre-fill email from query params
        const emailParam = searchParams.get('email')
        if (emailParam) setEmail(emailParam)

        // Check for error in URL
        const urlError = searchParams.get('error')
        if (urlError === 'expired_link') setError('Verification link expired. Please sign up again.')
    }, [searchParams])

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    turnstileToken,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                if (res.status === 429) setError(t.rateLimited)
                else if (res.status === 409) {
                    window.location.href = `/lookup?email=${encodeURIComponent(email.trim())}&from=signup`
                    return
                }
                else if (res.status === 403) setError(data.error || 'Verification failed')
                else setError(data.error || 'Something went wrong')
                return
            }

            if (data.success) {
                window.location.href = `/check-email?email=${encodeURIComponent(email.trim())}&type=email_verify`
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleOAuth = useCallback((provider: 'google' | 'apple') => {
        console.log('OAuth:', provider)
    }, [])

    const handleTurnstileVerify = useCallback((token: string) => {
        setTurnstileToken(token)
    }, [])

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
                {/* Logo — YES on signup */}
                <div className="auth-logo">
                    <img src="/icons/app_icon.png" alt="LetBuyy" width={48} height={48} />
                </div>

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">{t.subtitle}</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="signupEmail">{t.email}</label>
                        <input
                            id="signupEmail"
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
                        {loading ? '...' : t.createAccount}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>{t.or}</span>
                </div>

                <div className="auth-oauth-row">
                    <button className="auth-btn-oauth" onClick={() => handleOAuth('apple')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                        </svg>
                        {t.apple}
                    </button>
                    <button className="auth-btn-oauth" onClick={() => handleOAuth('google')}>
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        {t.google}
                    </button>
                </div>

                <div className="auth-bottom-link">
                    <span>{t.alreadyHave}</span>{' '}
                    <a href="/lookup">{t.logIn}</a>
                </div>

                <p className="auth-terms">
                    {t.terms} <a href="#">{t.termsLink}</a> {t.and} <a href="#">{t.privacyLink}</a>
                </p>

                <TurnstileWidget onVerify={handleTurnstileVerify} />
            </div>
        </main>
    )
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-hint)' }}>Loading...</p></div></div>}>
            <SignupContent />
        </Suspense>
    )
}
