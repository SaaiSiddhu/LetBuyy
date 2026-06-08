'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { useSearchParams } from 'next/navigation'
import TurnstileWidget, { type TurnstileHandle } from '@/components/TurnstileWidget'
import { features } from '@/lib/config/features'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { OAuthBrandIcon } from '@/components/OAuthBrandIcon'
import { Button, Input } from '@letbuyy/ui'

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
        comingSoon: 'Soon',
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
        comingSoon: 'जल्द',
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
        comingSoon: 'விரைவில்',
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
        const savedTheme = localStorage.getItem('letbuyy-theme')
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
            localStorage.setItem('letbuyy-theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            document.documentElement.style.colorScheme = 'light'
            localStorage.setItem('letbuyy-theme', 'light')
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
        setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured. Use email sign-in.`)
    }, [])

    const handleTurnstileVerify = useCallback((token: string) => {
        setTurnstileToken(token)
        turnstileTokenRef.current = token
    }, [])

    return (
        <main className="auth-container">
            {/* Top bar: Language + Theme — matches lookup page exactly */}
            <div className="auth-top-bar">
                <Button unstyled onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </Button>
                <Button unstyled onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
                </Button>
            </div>

            <div className="auth-card">
                {/* Logo — matches lookup page */}
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                {/* === EMAIL INPUT VIEW === */}
                {!showPasswordField && (
                    <>
                        <h1 className="auth-title">{t.logIn}</h1>
                        <p className="auth-subtitle">{t.continueToLetBuyy}</p>

                        <form onSubmit={handleEmailContinue} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="email">{t.email}</label>
                                <Input unstyled
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

                            {error && <div className="auth-error"><AuthIcon name="error" />{error}</div>}

                            <Button unstyled
                                type="submit"
                                className="auth-btn-primary"
                                disabled={loading || !email.trim()}
                            >
                                {loading ? '...' : t.continueWithEmail}
                            </Button>
                        </form>

                        <div className="auth-divider">
                            <span>{t.or}</span>
                        </div>

                        {features.passkey && (
                            <Button unstyled className="auth-btn-secondary" disabled>
                                <AuthIcon name="passkey" size={18} style={{ marginRight: 6 }} /> {t.signInWithPasskey}
                            </Button>
                        )}

                        <div className="auth-oauth-row">
                            <Button unstyled className="auth-btn-oauth coming-soon" onClick={(e) => e.preventDefault()} aria-disabled="true">
                                <OAuthBrandIcon provider="apple" className="auth-oauth-brand-icon" />
                                {t.apple}
                                <span className="auth-coming-soon-badge">{t.comingSoon}</span>
                            </Button>
                            <Button unstyled className="auth-btn-oauth" onClick={() => handleOAuth('google')}>
                                <OAuthBrandIcon provider="google" className="auth-oauth-brand-icon" />
                                {t.google}
                            </Button>
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
                                    <Button unstyled
                                        type="button"
                                        className="auth-edit-btn"
                                        onClick={() => {
                                            setShowPasswordField(false)
                                            setPassword('')
                                            setError(null)
                                        }}
                                    >
                                        <AuthIcon name="edit" size={16} />
                                    </Button>
                                </div>
                            </div>

                            <div className="auth-field">
                                <label htmlFor="password">{t.password}</label>
                                <div className="auth-password-wrapper">
                                    <Input unstyled
                                        id="password"
                                        type={showPasswordVisible ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        autoFocus
                                        required
                                    />
                                    <Button unstyled
                                        type="button"
                                        className="auth-toggle-password"
                                        onClick={() => setShowPasswordVisible(!showPasswordVisible)}
                                    >
                                        <AuthIcon name={showPasswordVisible ? 'visibility_off' : 'visibility'} size={18} />
                                    </Button>
                                </div>
                            </div>

                            {error && <div className="auth-error"><AuthIcon name="error" />{error}</div>}

                            <Button unstyled
                                type="submit"
                                className="auth-btn-primary"
                                disabled={loading || !password}
                            >
                                {loading ? '...' : t.logInBtn}
                            </Button>
                        </form>

                        <div className="auth-divider">
                            <span>{t.or}</span>
                        </div>

                        {features.magicLink && (
                            <Button unstyled
                                className="auth-btn-secondary"
                                disabled={loading}
                            >
                                <AuthIcon name="mail" size={18} style={{ marginRight: 6 }} /> {t.emailMeLink}
                            </Button>
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
