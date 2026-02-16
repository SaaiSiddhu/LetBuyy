'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { useSearchParams } from 'next/navigation'
import TurnstileWidget, { type TurnstileHandle } from '@/components/TurnstileWidget'
import { features } from '@/lib/config/features'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        logIn: 'Log in',
        continueToLetBuyy: 'Continue to LetBuyy',
        email: 'Email',
        emailPlaceholder: 'you@example.com',
        continueWithEmail: 'Continue with email',
        or: 'or',
        signInWithPasskey: 'Sign in with passkey',
        apple: 'Apple',
        google: 'Google',
        newToLetBuyy: 'New to LetBuyy?',
        getStarted: 'Get started',
        password: 'Password',
        logInBtn: 'Log in',
        emailMeLink: 'Email me a login link',
        forgotPassword: 'Forgot password?',
        invalidCredentials: 'Invalid email or password',
    },
    hi: {
        logIn: 'लॉग इन करें',
        continueToLetBuyy: 'LetBuyy पर जारी रखें',
        email: 'ईमेल',
        emailPlaceholder: 'you@example.com',
        continueWithEmail: 'ईमेल से जारी रखें',
        or: 'या',
        signInWithPasskey: 'पासकी से साइन इन करें',
        apple: 'Apple',
        google: 'Google',
        newToLetBuyy: 'LetBuyy पर नए हैं?',
        getStarted: 'शुरू करें',
        password: 'पासवर्ड',
        logInBtn: 'लॉग इन करें',
        emailMeLink: 'मुझे एक लॉगिन लिंक ईमेल करें',
        forgotPassword: 'पासवर्ड भूल गए?',
        invalidCredentials: 'अमान्य ईमेल या पासवर्ड',
    },
    ta: {
        logIn: 'உள்நுழை',
        continueToLetBuyy: 'LetBuyy-க்கு தொடரவும்',
        email: 'மின்னஞ்சல்',
        emailPlaceholder: 'you@example.com',
        continueWithEmail: 'மின்னஞ்சல் மூலம் தொடரவும்',
        or: 'அல்லது',
        signInWithPasskey: 'பாஸ்கீ மூலம் உள்நுழையவும்',
        apple: 'Apple',
        google: 'Google',
        newToLetBuyy: 'LetBuyy-ல் புதியவரா?',
        getStarted: 'தொடங்கவும்',
        password: 'கடவுச்சொல்',
        logInBtn: 'உள்நுழை',
        emailMeLink: 'எனக்கு உள்நுழைவு இணைப்பை அனுப்பவும்',
        forgotPassword: 'கடவுச்சொல்லை மறந்துவிட்டீர்களா?',
        invalidCredentials: 'தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்',
    },
}

function LoginContent() {
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get('redirect') || searchParams.get('return_to') || ''

    const [lang, setLang] = useState<Lang>('en')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPasswordField, setShowPasswordField] = useState(false)
    const [showPasswordVisible, setShowPasswordVisible] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [isDark, setIsDark] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const turnstileTokenRef = useRef<string | null>(null)
    const turnstileRef = useRef<TurnstileHandle>(null)
    const t = translations[lang]

    // Initialize theme and language
    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')

        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        // Check if already authenticated → redirect
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session')
                const data = await res.json()
                if (data.authenticated) {
                    window.location.href = '/select'
                }
            } catch {
                // Not authenticated — stay on login page
            }
        }
        checkSession()
    }, [])

    const cycleLang = () => {
        const langs: Lang[] = ['en', 'hi', 'ta']
        const next = langs[(langs.indexOf(lang) + 1) % langs.length]
        setLang(next)
        localStorage.setItem('letbuyy_lang', next)
    }

    const toggleTheme = () => {
        const newDark = !isDark
        setIsDark(newDark)
        if (newDark) {
            document.documentElement.classList.add('dark')
            document.documentElement.style.colorScheme = 'dark'
            localStorage.setItem('letbuyy_theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            document.documentElement.style.colorScheme = 'light'
            localStorage.setItem('letbuyy_theme', 'light')
        }
    }

    const handleEmailContinue = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            })
            const data = await res.json()

            if (data.exists && data.hasPassword) {
                setShowPasswordField(true)
            } else if (data.exists && !data.hasPassword) {
                window.location.href = `/set-password?email=${encodeURIComponent(email.trim())}`
            } else {
                window.location.href = `/signup?email=${encodeURIComponent(email.trim())}`
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [email])

    const handleLogin = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()
        if (!password) return

        if (features.turnstile && !turnstileTokenRef.current) {
            setError('Please complete the verification')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                    turnstileToken: features.turnstile ? turnstileTokenRef.current : undefined,
                    redirect: redirectTo || undefined,
                }),
            })

            const data = await res.json()

            if (data.success) {
                window.location.href = data.redirectTo || '/select'
            } else {
                setError(data.error || t.invalidCredentials)
                turnstileRef.current?.reset()
                setTurnstileToken(null)
                turnstileTokenRef.current = null
            }
        } catch {
            setError('Something went wrong. Please try again.')
            turnstileRef.current?.reset()
            setTurnstileToken(null)
            turnstileTokenRef.current = null
        } finally {
            setLoading(false)
        }
    }, [email, password, redirectTo, t.invalidCredentials])

    const handleOAuth = useCallback(async (provider: 'google' | 'apple') => {
        try {
            const res = await fetch(`/api/auth/oauth/${provider}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ redirect: redirectTo || undefined }),
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch {
            setError('Failed to start sign in')
        }
    }, [redirectTo])

    const handleTurnstileVerify = useCallback((token: string) => {
        setTurnstileToken(token)
        turnstileTokenRef.current = token
    }, [])

    return (
        <main className="auth-container">
            {/* Top bar: Language + Theme — matches lookup page exactly */}
            <div className="auth-top-bar">
                <button onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </button>
                <button onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
                </button>
            </div>

            <div className="auth-card">
                {/* Logo — matches lookup page */}
                <div className="auth-logo">
                    <img src="/icons/app_icon.png" alt="LetBuyy" width={48} height={48} />
                </div>

                {/* === EMAIL INPUT VIEW === */}
                {!showPasswordField && (
                    <>
                        <h1 className="auth-title">{t.logIn}</h1>
                        <p className="auth-subtitle">{t.continueToLetBuyy}</p>

                        <form onSubmit={handleEmailContinue} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="email">{t.email}</label>
                                <input
                                    id="email"
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
                                {loading ? '...' : t.continueWithEmail}
                            </button>
                        </form>

                        <div className="auth-divider">
                            <span>{t.or}</span>
                        </div>

                        {features.passkey && (
                            <button className="auth-btn-secondary" disabled>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>passkey</span> {t.signInWithPasskey}
                            </button>
                        )}

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
                            <span>{t.newToLetBuyy}</span>{' '}
                            <a href="/signup">{t.getStarted} →</a>
                        </div>
                    </>
                )}

                {/* === PASSWORD VIEW === */}
                {showPasswordField && (
                    <>
                        <h1 className="auth-title">{t.logIn}</h1>
                        <p className="auth-subtitle">{t.continueToLetBuyy}</p>

                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="loginEmail">{t.email}</label>
                                <div className="auth-email-display">
                                    <span>{email}</span>
                                    <button
                                        type="button"
                                        className="auth-edit-btn"
                                        onClick={() => {
                                            setShowPasswordField(false)
                                            setPassword('')
                                            setError(null)
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                    </button>
                                </div>
                            </div>

                            <div className="auth-field">
                                <label htmlFor="password">{t.password}</label>
                                <div className="auth-password-wrapper">
                                    <input
                                        id="password"
                                        type={showPasswordVisible ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        autoFocus
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="auth-toggle-password"
                                        onClick={() => setShowPasswordVisible(!showPasswordVisible)}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showPasswordVisible ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>

                            {error && <div className="auth-error">{error}</div>}

                            <button
                                type="submit"
                                className="auth-btn-primary"
                                disabled={loading || !password}
                            >
                                {loading ? '...' : t.logInBtn}
                            </button>
                        </form>

                        <div className="auth-divider">
                            <span>{t.or}</span>
                        </div>

                        {features.magicLink && (
                            <button
                                className="auth-btn-secondary"
                                disabled={loading}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>mail</span> {t.emailMeLink}
                            </button>
                        )}

                        <a href="/forgot-password" className="auth-forgot-link">
                            {t.forgotPassword}
                        </a>
                    </>
                )}

                {/* Invisible Turnstile widget */}
                <TurnstileWidget ref={turnstileRef} onVerify={handleTurnstileVerify} />
            </div>
        </main>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-hint)' }}>Loading...</p></div></div>}>
            <LoginContent />
        </Suspense>
    )
}
