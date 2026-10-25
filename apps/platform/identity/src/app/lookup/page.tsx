'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Image from 'next/image'
import { getAuthHeaders } from '@/lib/csrf-client'
import { useSearchParams } from 'next/navigation'
import TurnstileWidget, { type TurnstileHandle } from '@/components/TurnstileWidget'
import { features } from '@/lib/config/features'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { OAuthBrandIcon } from '@/components/OAuthBrandIcon'
import { Banner, Button, Input } from '@letbuyy/ui'
import { safePlatformReturnTo, authPathWithReturnTo } from '@/lib/auth/return-to'
import { getAdminDashboardUrl } from '@/lib/config/urls'

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
        unavailable: 'Unavailable',
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
        sendFailed: 'We could not send your login email. Please try again.',
        requestFailed: 'Please refresh this page and try again.',
        networkFailed: 'Could not connect. Check your connection and try again.',
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
        unavailable: 'उपलब्ध नहीं',
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
        sendFailed: 'लॉगिन ईमेल नहीं भेज सके। कृपया फिर कोशिश करें।',
        requestFailed: 'कृपया पेज रीफ्रेश करके फिर कोशिश करें।',
        networkFailed: 'कनेक्शन नहीं हो सका। अपना इंटरनेट जांचें और फिर कोशिश करें।',
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
        unavailable: 'கிடைக்கவில்லை',
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
        sendFailed: 'உள்நுழைவு மின்னஞ்சலை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
        requestFailed: 'இந்தப் பக்கத்தைப் புதுப்பித்து மீண்டும் முயற்சிக்கவும்.',
        networkFailed: 'இணைக்க முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
    },
}

interface SavedAccount {
    email: string
    name: string | null
    avatar: string | null
    lastLogin: string
}

interface UserStore {
    id: string
    subdomain: string
}

type ViewState = 'email' | 'password' | 'accounts'

function LookupContent() {
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPasswordField, setShowPasswordField] = useState(false)
    const [viewState, setViewState] = useState<ViewState>('email')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lang, setLang] = useState<Lang>('en')
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const turnstileTokenRef = useRef<string | null>(null)
    const turnstileRef = useRef<TurnstileHandle>(null)
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
    const [showPasswordVisible, setShowPasswordVisible] = useState(false)
    const [isFromSignup, setIsFromSignup] = useState(false)
    const [returnTo, setReturnTo] = useState<string | null>(null)
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
        || process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true'

    const t = translations[lang]

    // Initialize theme and language
    useEffect(() => {

        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        // Read and validate return_to from URL (sent by admin login page)
        const returnToParam = searchParams.get('return_to')
        if (returnToParam && safePlatformReturnTo(returnToParam)) {
            setReturnTo(returnToParam)
        }

        // Fetch saved accounts
        fetchSavedAccounts()

        // Check for error in URL params
        const urlError = searchParams.get('error')
        if (urlError === 'expired_link') setError('Link has expired. Please try again.')
        if (urlError === 'invalid_link') setError('Invalid link. Please try again.')
        if (urlError === 'rate_limit') setError('Too many requests. Please try later.')
        if (urlError === 'oauth_unavailable') setError('Social sign-in is not configured. Use email sign-in.')

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

            // If user has an active session, route from the same store verdict
            // used by /select so zero-store users land on onboarding directly.
            if (sessionData.authenticated) {
                const requestedReturn = safePlatformReturnTo(searchParams.get('return_to'))
                if (requestedReturn) { window.location.replace(requestedReturn); return }
                const storesRes = await fetch('/api/auth/stores')
                const storesData = await storesRes.json().catch(() => null) as {
                    authenticated?: boolean
                    stores?: UserStore[]
                } | null

                if (storesData?.authenticated) {
                    const stores = Array.isArray(storesData.stores) ? storesData.stores : []

                    if (stores.length === 0) {
                        window.location.replace('/onboarding')
                        return
                    }

                    if (stores.length === 1 && stores[0]?.subdomain) {
                        window.location.replace(getAdminDashboardUrl(stores[0].subdomain))
                        return
                    }
                }

                window.location.replace('/select')
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

            if (!res.ok) {
                setError(data?.error || 'Unable to look up account. Please try again.')
                return
            }

            if (!data.exists) {
                // User doesn't exist — redirect to signup
                window.location.href = authPathWithReturnTo(`/signup?email=${encodeURIComponent(email.trim())}`, returnTo)
                return
            }

            if (data.hasPassword) {
                setShowPasswordField(true)
                setViewState('password')
            } else {
                // User exists but no password — send magic link
                await handleSendMagicLink()
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        const currentToken = turnstileTokenRef.current || turnstileToken
        if (turnstileEnabled && !currentToken) {
            setError(t.botFailed)
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
        const currentToken = turnstileTokenRef.current || turnstileToken
        if (turnstileEnabled && !currentToken) {
            setError(t.botFailed)
            return
        }

        setLoading(true)
        setError(null)
        let sent = false

        try {
            const response = await fetch('/api/auth/send-magic', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    turnstileToken: currentToken,
                }),
            })
            const payload = await response.json().catch(() => null) as {
                success?: boolean
                error?: string
            } | null

            if (!response.ok || payload?.success !== true) {
                if (response.status === 429) setError(t.rateLimited)
                else if (response.status === 403 && typeof payload?.error === 'string' && payload.error.includes('Bot')) setError(t.botFailed)
                else if (response.status === 400 || response.status === 403) setError(t.requestFailed)
                else setError(t.sendFailed)
                return
            }

            sent = true
            window.location.href = `/check-email?email=${encodeURIComponent(email.trim())}&type=magic_link`
        } catch {
            setError(t.networkFailed)
        } finally {
            if (!sent) {
                turnstileTokenRef.current = null
                setTurnstileToken(null)
                turnstileRef.current?.reset()
            }
            setLoading(false)
        }
    }

    const handleAccountSelect = async (account: SavedAccount) => {
        const accountEmail = account.email.trim()
        setLoading(true)
        setError(null)
        setPassword('')
        setEmail(accountEmail)

        try {
            const res = await fetch('/api/auth/lookup', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email: accountEmail }),
            })
            const data = await res.json().catch(() => null) as {
                exists?: boolean
                hasPassword?: boolean
                error?: string
            } | null

            if (res.status === 429) {
                setError(t.rateLimited)
                return
            }

            if (!res.ok) {
                setError(data?.error || 'Unable to check this account. Please try again.')
                return
            }

            if (!data?.exists) {
                window.location.href = authPathWithReturnTo(`/signup?email=${encodeURIComponent(accountEmail)}`, returnTo)
                return
            }

            if (!data.hasPassword) {
                window.location.href = authPathWithReturnTo(`/set-password?email=${encodeURIComponent(accountEmail)}`, returnTo)
                return
            }

            setViewState('password')
            setShowPasswordField(true)
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleOAuth = useCallback(async (provider: 'google' | 'apple') => {
        setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured. Use email sign-in.`)
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
            {/* Top bar: Language */}
            <div className="auth-top-bar">
                <Button unstyled onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </Button>
            </div>

            <div className="auth-card">
                {/* Logo — only on login screen */}
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                {/* === ACCOUNTS VIEW (returning user with saved accounts) === */}
                {viewState === 'accounts' && savedAccounts.length > 0 && (
                    <>
                        <h1 className="auth-title">{t.welcome}</h1>

                        <div className="auth-accounts-list">
                            {savedAccounts.map((account) => (
                                <Button unstyled
                                    key={account.email}
                                    className="auth-account-item"
                                    onClick={() => handleAccountSelect(account)}
                                    disabled={loading}
                                >
                                    <div className="auth-account-avatar">
                                        {account.avatar ? (
                                            <Image src={account.avatar} alt="" width={40} height={40} unoptimized />
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
                                </Button>
                            ))}
                        </div>

                        <a
                            className="auth-link-btn"
                            href={authPathWithReturnTo('/login', returnTo)}
                        >
                            {t.useDifferentAccount}
                        </a>

                        <div className="auth-bottom-link">
                            <span>{t.newToLetBuyy}</span>{' '}
                            <a href={authPathWithReturnTo('/signup', returnTo)}>{t.getStarted} →</a>
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

                            {error && <Banner variant="critical">{error}</Banner>}

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
                            <Button unstyled className="auth-btn-oauth unavailable" onClick={(e) => e.preventDefault()} aria-disabled="true">
                                <OAuthBrandIcon provider="apple" className="auth-oauth-brand-icon" />
                                {t.apple}
                                <span className="auth-unavailable-badge">{t.unavailable}</span>
                            </Button>
                            <Button unstyled className="auth-btn-oauth" onClick={() => handleOAuth('google')}>
                                <OAuthBrandIcon provider="google" className="auth-oauth-brand-icon" />
                                {t.google}
                            </Button>
                        </div>

                        <div className="auth-bottom-link">
                            <span>{t.newToLetBuyy}</span>{' '}
                            <a href={authPathWithReturnTo('/signup', returnTo)}>{t.getStarted} →</a>
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
                                <AuthIcon name="info" size={16} />
                                {t.accountFound}
                            </div>
                        )}
                        <form onSubmit={handleLogin} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="loginEmail">{t.email}</label>
                                <div className="auth-email-display">
                                    <span>{email}</span>
                                    <Button unstyled
                                        type="button"
                                        className="auth-edit-btn"
                                        onClick={() => {
                                            setViewState('email')
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

                            {error && <Banner variant="critical">{error}</Banner>}

                            <Button unstyled
                                type="submit"
                                className="auth-btn-primary"
                                disabled={loading || !password || (turnstileEnabled && !turnstileToken)}
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
                                onClick={handleSendMagicLink}
                                disabled={loading || (turnstileEnabled && !turnstileToken)}
                            >
                                <AuthIcon name="mail" size={18} style={{ marginRight: 6 }} /> {t.emailMeLink}
                            </Button>
                        )}

                        <a href="/forgot-password" className="auth-forgot-link">
                            {t.forgotPassword}
                        </a>
                    </>
                )}

                {/* Visible Turnstile widget */}
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
