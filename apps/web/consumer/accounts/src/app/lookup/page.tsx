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
        welcome: 'Welcome back!',
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
        useDifferentAccount: 'Use a different account',
        invalidCredentials: 'Invalid email or password',
        rateLimited: 'Too many attempts. Please try again later.',
        botFailed: 'Verification failed. Please try again.',
        verifyEmail: 'Please verify your email first',
        accountFound: 'Account found! Please log in.',
    },
    hi: {
        logIn: 'लॉग इन',
        welcome: 'वापस स्वागत है!',
        continueToLetBuyy: 'LetBuyy पर जारी रखें',
        email: 'ईमेल',
        emailPlaceholder: 'you@example.com',
        continueWithEmail: 'ईमेल से जारी रखें',
        or: 'या',
        signInWithPasskey: 'पासकी से साइन इन',
        apple: 'Apple',
        google: 'Google',
        newToLetBuyy: 'LetBuyy पर नए हैं?',
        getStarted: 'शुरू करें',
        password: 'पासवर्ड',
        logInBtn: 'लॉग इन',
        emailMeLink: 'मुझे लॉगिन लिंक भेजें',
        forgotPassword: 'पासवर्ड भूल गए?',
        useDifferentAccount: 'दूसरे अकाउंट का उपयोग करें',
        invalidCredentials: 'अमान्य ईमेल या पासवर्ड',
        rateLimited: 'बहुत सारे प्रयास। कृपया बाद में पुनः प्रयास करें।',
        botFailed: 'सत्यापन विफल। कृपया पुनः प्रयास करें।',
        verifyEmail: 'कृपया पहले अपना ईमेल सत्यापित करें',
        accountFound: 'अकाउंट मिला! कृपया लॉग इन करें।',
    },
    ta: {
        logIn: 'உள்நுழை',
        welcome: 'மீண்டும் வரவேற்கிறோம்!',
        continueToLetBuyy: 'LetBuyy தொடரவும்',
        email: 'மின்னஞ்சல்',
        emailPlaceholder: 'you@example.com',
        continueWithEmail: 'மின்னஞ்சலுடன் தொடரவும்',
        or: 'அல்லது',
        signInWithPasskey: 'பாஸ்கீ மூலம் உள்நுழையவும்',
        apple: 'Apple',
        google: 'Google',
        newToLetBuyy: 'LetBuyy புதிதா?',
        getStarted: 'தொடங்குங்கள்',
        password: 'கடவுச்சொல்',
        logInBtn: 'உள்நுழை',
        emailMeLink: 'எனக்கு உள்நுழைவு இணைப்பை அனுப்பவும்',
        forgotPassword: 'கடவுச்சொல் மறந்துவிட்டதா?',
        useDifferentAccount: 'வேறு கணக்கைப் பயன்படுத்தவும்',
        invalidCredentials: 'தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்',
        rateLimited: 'பல முயற்சிகள். பிறகு மீண்டும் முயற்சிக்கவும்.',
        botFailed: 'சரிபார்ப்பு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
        verifyEmail: 'முதலில் உங்கள் மின்னஞ்சலைச் சரிபார்க்கவும்',
        accountFound: 'கணக்கு கிடைத்தது! உள்நுழையவும்.',
    },
}

interface SavedAccount {
    email: string
    name: string | null
    avatar: string | null
    lastLogin: string
}

type ViewState = 'email' | 'password' | 'accounts'

/**
 * Validate that a return_to URL is safe (must be on letbuyy.store or localhost).
 */
function isValidReturnTo(url: string): boolean {
    try {
        const parsed = new URL(url)
        return (
            parsed.hostname.endsWith('.letbuyy.store') ||
            parsed.hostname === 'letbuyy.store' ||
            parsed.hostname === 'localhost'
        )
    } catch {
        return false
    }
}

function LookupContent() {
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPasswordField, setShowPasswordField] = useState(false)
    const [viewState, setViewState] = useState<ViewState>('email')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const turnstileTokenRef = useRef<string | null>(null)
    const turnstileRef = useRef<TurnstileHandle>(null)
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
    const [showPasswordVisible, setShowPasswordVisible] = useState(false)
    const [isFromSignup, setIsFromSignup] = useState(false)
    const [returnTo, setReturnTo] = useState<string | null>(null)

    const t = translations[lang]

    // Initialize theme and language
    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')

        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        // Read and validate return_to from URL (sent by admin login page)
        const returnToParam = searchParams.get('return_to')
        if (returnToParam && isValidReturnTo(returnToParam)) {
            setReturnTo(returnToParam)
        }

        // Fetch saved accounts
        fetchSavedAccounts()

        // Check for error in URL params
        const urlError = searchParams.get('error')
        if (urlError === 'expired_link') setError('Link has expired. Please try again.')
        if (urlError === 'invalid_link') setError('Invalid link. Please try again.')
        if (urlError === 'rate_limit') setError('Too many requests. Please try later.')

        // Auto-advance from signup redirect
        const fromSignup = searchParams.get('from') === 'signup'
        const prefillEmail = searchParams.get('email')
        if (fromSignup && prefillEmail) {
            setEmail(prefillEmail)
            setViewState('password')
            setShowPasswordField(true)
            setIsFromSignup(true)
        }
    }, [searchParams])

    const fetchSavedAccounts = async () => {
        try {
            const [sessionRes, accountsRes] = await Promise.all([
                fetch('/api/auth/session'),
                fetch('/api/auth/accounts'),
            ])
            const sessionData = await sessionRes.json()
            const accountsData = await accountsRes.json()

            // If user has an active session, redirect to store selector
            if (sessionData.authenticated) {
                window.location.href = '/select'
                return
            }

            // If there are saved accounts from previous logins, show the account picker
            if (accountsData.accounts && accountsData.accounts.length > 0) {
                setSavedAccounts(accountsData.accounts)
                setViewState('accounts')
            }
        } catch {
            // No saved accounts — show email form
        }
    }

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

    const handleEmailContinue = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/lookup', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email: email.trim() }),
            })

            const data = await res.json()

            if (res.status === 429) {
                setError(t.rateLimited)
                return
            }

            if (!data.exists) {
                // User doesn't exist — redirect to signup
                window.location.href = `/signup?email=${encodeURIComponent(email.trim())}`
                return
            }

            if (data.hasPassword) {
                setShowPasswordField(true)
                setViewState('password')
            } else {
                // User exists but no password — send magic link
                handleSendMagicLink()
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Use the ref value to get the latest token (avoids stale closures)
            const currentToken = turnstileTokenRef.current || turnstileToken

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                    turnstileToken: currentToken,
                    returnTo: returnTo || undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                // Reset Turnstile widget to get a fresh token for retry
                turnstileRef.current?.reset()

                if (res.status === 429) setError(t.rateLimited)
                else if (res.status === 403 && data.error?.includes('Bot')) setError(t.botFailed)
                else if (res.status === 403 && data.error?.toLowerCase().includes('verify')) setError(t.verifyEmail)
                else if (res.status === 403) setError(data.error || 'Request failed. Please refresh the page.')
                else setError(t.invalidCredentials)
                return
            }

            if (data.success) {
                // Use return_to if available and login API didn't override
                window.location.href = returnTo || data.redirectTo
            }
        } catch {
            setError('Something went wrong. Please try again.')
            // Reset Turnstile on any error
            turnstileRef.current?.reset()
        } finally {
            setLoading(false)
        }
    }

    const handleSendMagicLink = async () => {
        setLoading(true)
        setError(null)

        try {
            await fetch('/api/auth/send-magic', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    turnstileToken,
                }),
            })

            window.location.href = `/check-email?email=${encodeURIComponent(email.trim())}&type=magic_link`
        } catch {
            setError('Failed to send link. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleAccountSelect = async (account: SavedAccount) => {
        // Pre-fill email and advance to password view
        // (the user is logged out, so we can't switch sessions — just pre-fill)
        setEmail(account.email)
        setViewState('password')
        setShowPasswordField(true)
    }

    const handleOAuth = useCallback(async (provider: 'google' | 'apple') => {
        try {
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()

            const redirectTo = `${window.location.origin}/auth/callback`

            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    queryParams: provider === 'google' ? {
                        access_type: 'offline',
                        prompt: 'consent',
                    } : undefined,
                },
            })

            if (error) {
                console.error('OAuth error:', error.message)
            }
        } catch (err) {
            console.error('OAuth initiation failed:', err)
        }
    }, [])

    const handleTurnstileVerify = useCallback((token: string) => {
        setTurnstileToken(token)
        turnstileTokenRef.current = token
    }, [])

    const formatLastLogin = (date: string) => {
        const diff = Date.now() - new Date(date).getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        if (hours < 1) return 'Just now'
        if (hours < 24) return `${hours} hours ago`
        const days = Math.floor(hours / 24)
        return `${days} days ago`
    }

    return (
        <main className="auth-container">
            {/* Top bar: Language + Theme */}
            <div className="auth-top-bar">
                <button onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </button>
                <button onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
                </button>
            </div>

            <div className="auth-card">
                {/* Logo — only on login screen */}
                <div className="auth-logo">
                    <img src="/icons/app_icon.png" alt="LetBuyy" width={48} height={48} />
                </div>

                {/* === ACCOUNTS VIEW (returning user with saved accounts) === */}
                {viewState === 'accounts' && savedAccounts.length > 0 && (
                    <>
                        <h1 className="auth-title">{t.welcome}</h1>

                        <div className="auth-accounts-list">
                            {savedAccounts.map((account) => (
                                <button
                                    key={account.email}
                                    className="auth-account-item"
                                    onClick={() => handleAccountSelect(account)}
                                    disabled={loading}
                                >
                                    <div className="auth-account-avatar">
                                        {account.avatar ? (
                                            <img src={account.avatar} alt="" width={40} height={40} />
                                        ) : (
                                            <span>{(account.name || account.email)[0].toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div className="auth-account-info">
                                        <span className="auth-account-email">{account.email}</span>
                                        <span className="auth-account-meta">
                                            Last login: {formatLastLogin(account.lastLogin)}
                                        </span>
                                    </div>
                                    <span className="auth-account-arrow">→</span>
                                </button>
                            ))}
                        </div>

                        <a
                            className="auth-link-btn"
                            href="/login"
                        >
                            {t.useDifferentAccount}
                        </a>

                        <div className="auth-bottom-link">
                            <span>{t.newToLetBuyy}</span>{' '}
                            <a href="/signup">{t.getStarted} →</a>
                        </div>
                    </>
                )}

                {/* === EMAIL INPUT VIEW === */}
                {viewState === 'email' && (
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
                {viewState === 'password' && showPasswordField && (
                    <>
                        <h1 className="auth-title">{t.logIn}</h1>
                        <p className="auth-subtitle">{t.continueToLetBuyy}</p>

                        {isFromSignup && (
                            <div className="auth-info">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                                {t.accountFound}
                            </div>
                        )}
                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="loginEmail">{t.email}</label>
                                <div className="auth-email-display">
                                    <span>{email}</span>
                                    <button
                                        type="button"
                                        className="auth-edit-btn"
                                        onClick={() => {
                                            setViewState('email')
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
                                onClick={handleSendMagicLink}
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

export default function LookupPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-hint)' }}>Loading...</p></div></div>}>
            <LookupContent />
        </Suspense>
    )
}
