'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

interface SessionUser {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
}

type SiteType = 'ecommerce' | 'portfolio' | 'resume' | 'landing_page'
type Lang = 'en' | 'hi' | 'ta'

interface ValidationResult {
    valid: boolean
    reason: string
    message: string
}

/* ——————————————————————————————————————
   Translations
   —————————————————————————————————————— */

const translations: Record<Lang, Record<string, string>> = {
    en: {
        whatBuild: 'What do you want to build?',
        chooseSite: 'Choose the type of site for your business',
        nameSite: 'Name your site',
        storeUrl: 'This will be your store URL',
        displayName: 'Display Name',
        displayPlaceholder: 'My Awesome Store',
        subdomain: 'Subdomain',
        subdomainPlaceholder: 'mystore',
        back: 'Back',
        createSite: 'Create Site',
        creating: 'Creating...',
        allSet: "You're all set!",
        redirecting: 'Redirecting to your dashboard...',
        logOut: 'Log out',
        ecommerce: 'Online Store',
        ecommerceDesc: 'Sell products online',
        portfolio: 'Portfolio',
        portfolioDesc: 'Showcase your work',
        resume: 'Resume / CV',
        resumeDesc: 'Professional profile',
        landingPage: 'Landing Page',
        landingPageDesc: 'Marketing & leads',
    },
    hi: {
        whatBuild: 'आप क्या बनाना चाहते हैं?',
        chooseSite: 'अपने व्यापार के लिए साइट का प्रकार चुनें',
        nameSite: 'अपनी साइट का नाम दें',
        storeUrl: 'यह आपका स्टोर URL होगा',
        displayName: 'प्रदर्शन नाम',
        displayPlaceholder: 'मेरा स्टोर',
        subdomain: 'सबडोमेन',
        subdomainPlaceholder: 'mystore',
        back: 'वापस',
        createSite: 'साइट बनाएं',
        creating: 'बना रहे हैं...',
        allSet: 'सब तैयार है!',
        redirecting: 'आपके डैशबोर्ड पर जा रहे हैं...',
        logOut: 'लॉग आउट',
        ecommerce: 'ऑनलाइन स्टोर',
        ecommerceDesc: 'ऑनलाइन उत्पाद बेचें',
        portfolio: 'पोर्टफोलियो',
        portfolioDesc: 'अपना काम दिखाएं',
        resume: 'रिज्यूमे / CV',
        resumeDesc: 'पेशेवर प्रोफाइल',
        landingPage: 'लैंडिंग पेज',
        landingPageDesc: 'मार्केटिंग और लीड्स',
    },
    ta: {
        whatBuild: 'நீங்கள் என்ன உருவாக்க விரும்புகிறீர்கள்?',
        chooseSite: 'உங்கள் வணிகத்திற்கான தளத்தின் வகையைத் தேர்ந்தெடுக்கவும்',
        nameSite: 'உங்கள் தளத்திற்கு பெயரிடுங்கள்',
        storeUrl: 'இது உங்கள் கடை URL ஆக இருக்கும்',
        displayName: 'காட்சி பெயர்',
        displayPlaceholder: 'என் கடை',
        subdomain: 'சப்டொமைன்',
        subdomainPlaceholder: 'mystore',
        back: 'திரும்ப',
        createSite: 'தளம் உருவாக்கு',
        creating: 'உருவாக்குகிறது...',
        allSet: 'எல்லாம் தயார்!',
        redirecting: 'உங்கள் டாஷ்போர்டுக்கு செல்கிறது...',
        logOut: 'வெளியேறு',
        ecommerce: 'ஆன்லைன் கடை',
        ecommerceDesc: 'ஆன்லைனில் பொருட்கள் விற்கவும்',
        portfolio: 'போர்ட்ஃபோலியோ',
        portfolioDesc: 'உங்கள் வேலையை காட்டுங்கள்',
        resume: 'ரெஸ்யூம் / CV',
        resumeDesc: 'தொழில்முறை சுயவிவரம்',
        landingPage: 'லேண்டிங் பேஜ்',
        landingPageDesc: 'மார்க்கெட்டிங் & லீட்ஸ்',
    },
}

/* ——————————————————————————————————————
   Constants
   —————————————————————————————————————— */

const SITE_TYPES: { id: SiteType; nameKey: string; icon: string; descKey: string }[] = [
    { id: 'ecommerce', nameKey: 'ecommerce', icon: 'shopping_cart', descKey: 'ecommerceDesc' },
    { id: 'portfolio', nameKey: 'portfolio', icon: 'work', descKey: 'portfolioDesc' },
    { id: 'resume', nameKey: 'resume', icon: 'article', descKey: 'resumeDesc' },
    { id: 'landing_page', nameKey: 'landingPage', icon: 'rocket_launch', descKey: 'landingPageDesc' },
]

const ADMIN_URL =
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://admin.letbuyy.store')

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [siteType, setSiteType] = useState<SiteType | null>(null)
    const [subdomain, setSubdomain] = useState('')
    const [storeName, setStoreName] = useState('')

    const [validation, setValidation] = useState<ValidationResult | null>(null)
    const [validating, setValidating] = useState(false)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const [user, setUser] = useState<SessionUser | null>(null)
    const [authLoading, setAuthLoading] = useState(true)

    // Theme & Language
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    // User dropdown
    const [showUserMenu, setShowUserMenu] = useState(false)

    const supabase = createClient()
    const t = translations[lang]

    /* ——— Initialize theme & language from localStorage ——— */
    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')

        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)
    }, [])

    /* ——— Auth check ——— */
    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                if (data.authenticated && data.user) {
                    setUser(data.user)
                } else {
                    window.location.href = '/lookup'
                }
            })
            .catch(() => {
                window.location.href = '/lookup'
            })
            .finally(() => setAuthLoading(false))
    }, [])

    /* ——— Check if user already has a store ——— */
    useEffect(() => {
        if (!user) return
        supabase
            .from('stores')
            .select('subdomain')
            .eq('custom_user_id', user.id)
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
                if (data?.subdomain) {
                    window.location.href = `${ADMIN_URL}/${data.subdomain}/dashboard`
                }
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    /* ——— Close user dropdown on outside click ——— */
    useEffect(() => {
        if (!showUserMenu) return
        const close = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('.auth-user-container')) {
                setShowUserMenu(false)
            }
        }
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [showUserMenu])

    /* ——— Theme toggle ——— */
    const toggleTheme = () => {
        const newTheme = !isDark
        setIsDark(newTheme)
        localStorage.setItem('letbuyy_theme', newTheme ? 'dark' : 'light')
        document.documentElement.classList.toggle('dark', newTheme)
        document.documentElement.style.colorScheme = newTheme ? 'dark' : 'light'
    }

    /* ——— Language cycle ——— */
    const cycleLang = () => {
        const langs: Lang[] = ['en', 'hi', 'ta']
        const next = langs[(langs.indexOf(lang) + 1) % langs.length]
        setLang(next)
        localStorage.setItem('letbuyy_lang', next)
    }

    /* ——— Logout ——— */
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
        } catch {
            // ignore errors
        }
        window.location.href = '/lookup'
    }

    /* ——— Debounced subdomain validation ——— */
    const validateSubdomain = useCallback(
        debounce(async (value: string) => {
            if (value.length < 4) {
                setValidation({ valid: false, reason: 'too_short', message: 'At least 4 characters' })
                setValidating(false)
                return
            }

            try {
                const res = await fetch(`/api/auth/validate-subdomain?subdomain=${value}`)
                const data: ValidationResult = await res.json()
                setValidation(data)
            } catch {
                setValidation({ valid: false, reason: 'error', message: 'Unable to check' })
            } finally {
                setValidating(false)
            }
        }, 400),
        []
    )

    const onSubdomainChange = (raw: string) => {
        const clean = raw.toLowerCase().replace(/[^a-z0-9-]/g, '')
        setSubdomain(clean)
        setError(null)

        if (!clean) {
            setValidation(null)
            setValidating(false)
            return
        }

        setValidating(true)
        validateSubdomain(clean)
    }

    /* ——— Handle store creation ——— */
    const handleSubmit = async () => {
        if (!siteType || !subdomain || !user || !validation?.valid) return

        setLoading(true)
        setError(null)

        try {
            const name = storeName.trim() || subdomain

            // Insert into stores (view → sites table)
            const { error: insertError } = await supabase.from('stores').insert({
                custom_user_id: user.id,
                name,
                store_name: subdomain,
                subdomain,
                site_type: siteType,
                status: 'draft',
            })

            if (insertError) {
                setError(insertError.message)
                setLoading(false)

                // Log failure
                await fetch('/api/email/store-creation-failure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        storeName: name,
                        storeType: siteType,
                        reason: 'database_error',
                        errorDetails: insertError.message,
                    }),
                }).catch(() => { })

                return
            }

            // Send success email
            await fetch('/api/email/store-creation-success', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    storeName: name,
                    storeType: siteType,
                    storeUrl: `https://${subdomain}.letbuyy.store`,
                    adminUrl: `${ADMIN_URL}/${subdomain}/dashboard`,
                }),
            }).catch(() => { })

            setSuccess(true)

            // Redirect after a brief pause
            setTimeout(() => {
                window.location.href = `${ADMIN_URL}/${subdomain}/dashboard`
            }, 2500)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong'
            setError(msg)
            setLoading(false)
        }
    }

    /* ——— Loading state ——— */
    if (authLoading || !user) {
        return (
            <div className="auth-container">
                <div className="auth-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
                    <div className="onboard-spinner" style={{ margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--text-hint)', fontSize: 14 }}>Loading...</p>
                </div>
            </div>
        )
    }

    /* ——— Success state ——— */
    if (success) {
        return (
            <div className="auth-container">
                {/* Top bar */}
                <TopBar
                    lang={lang}
                    isDark={isDark}
                    user={user}
                    showUserMenu={showUserMenu}
                    onCycleLang={cycleLang}
                    onToggleTheme={toggleTheme}
                    onToggleUserMenu={() => setShowUserMenu(!showUserMenu)}
                    onLogout={handleLogout}
                />

                <div className="auth-card">
                    <div className="auth-logo">
                        <img src="/icons/app_icon.png" alt="LetBuyy" width={48} height={48} />
                    </div>
                    <div className="onboard-success">
                        <div className="onboard-success-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--success, #22C55E)' }}>
                                check_circle
                            </span>
                        </div>
                        <h1 className="auth-title">{t.allSet}</h1>
                        <p className="auth-subtitle">
                            Your {SITE_TYPES.find((st) => st.id === siteType)?.nameKey
                                ? t[SITE_TYPES.find((st) => st.id === siteType)!.nameKey]
                                : 'site'} has been created.
                        </p>
                        <div className="onboard-success-url">
                            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>
                                link
                            </span>
                            {subdomain}.letbuyy.store
                        </div>
                        <p style={{ color: 'var(--text-hint)', fontSize: 13, marginTop: 16 }}>
                            {t.redirecting}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    /* ——— Main onboarding form ——— */
    return (
        <div className="auth-container">
            {/* Top bar */}
            <TopBar
                lang={lang}
                isDark={isDark}
                user={user}
                showUserMenu={showUserMenu}
                onCycleLang={cycleLang}
                onToggleTheme={toggleTheme}
                onToggleUserMenu={() => setShowUserMenu(!showUserMenu)}
                onLogout={handleLogout}
            />

            <div className="auth-card">
                {/* Logo */}
                <div className="auth-logo">
                    <img src="/icons/app_icon.png" alt="LetBuyy" width={48} height={48} />
                </div>

                {/* Progress bar */}
                <div className="onboard-progress">
                    <div className={`onboard-progress-step ${step >= 1 ? 'active' : ''}`} />
                    <div className={`onboard-progress-step ${step >= 2 ? 'active' : ''}`} />
                </div>

                {/* Error banner */}
                {error && (
                    <div className="auth-error">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>
                            error
                        </span>
                        {error}
                    </div>
                )}

                {/* ——— STEP 1: Choose type ——— */}
                {step === 1 && (
                    <>
                        <h1 className="auth-title">{t.whatBuild}</h1>
                        <p className="auth-subtitle">{t.chooseSite}</p>

                        <div className="onboard-type-grid">
                            {SITE_TYPES.map((type) => (
                                <button
                                    key={type.id}
                                    className={`onboard-type-card ${siteType === type.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        setSiteType(type.id)
                                        setStep(2)
                                    }}
                                >
                                    <span className="onboard-type-icon">
                                        <span className="material-symbols-outlined">{type.icon}</span>
                                    </span>
                                    <span className="onboard-type-name">{t[type.nameKey]}</span>
                                    <span className="onboard-type-desc">{t[type.descKey]}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* ——— STEP 2: Name & subdomain ——— */}
                {step === 2 && (
                    <>
                        <h1 className="auth-title">{t.nameSite}</h1>
                        <p className="auth-subtitle">{t.storeUrl}</p>

                        {/* Display name (optional) */}
                        <div style={{ marginBottom: 16 }}>
                            <label className="auth-label">{t.displayName}</label>
                            <input
                                type="text"
                                className="auth-input"
                                placeholder={t.displayPlaceholder}
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                            />
                        </div>

                        {/* Subdomain */}
                        <div>
                            <label className="auth-label">{t.subdomain}</label>
                            <div
                                className={`onboard-subdomain-wrapper ${validation
                                    ? validation.valid
                                        ? 'valid'
                                        : 'invalid'
                                    : ''
                                    }`}
                            >
                                <input
                                    type="text"
                                    className="onboard-subdomain-input"
                                    placeholder={t.subdomainPlaceholder}
                                    value={subdomain}
                                    onChange={(e) => onSubdomainChange(e.target.value)}
                                    maxLength={63}
                                    autoFocus
                                />
                                <span className="onboard-subdomain-suffix">.letbuyy.store</span>
                            </div>

                            {/* Validation message */}
                            <div
                                className={`onboard-validation ${validating
                                    ? 'checking'
                                    : validation
                                        ? validation.valid
                                            ? 'valid'
                                            : validation.reason === 'reserved'
                                                ? 'reserved'
                                                : 'invalid'
                                        : ''
                                    }`}
                            >
                                {validating && (
                                    <>
                                        <span className="onboard-spinner" />
                                        Checking availability...
                                    </>
                                )}
                                {!validating && validation && (
                                    <>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>
                                            {validation.valid ? 'check_circle' : 'cancel'}
                                        </span>
                                        {validation.message}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="onboard-btn-row">
                            <button
                                className="auth-btn-secondary"
                                onClick={() => setStep(1)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 4 }}>
                                    arrow_back
                                </span>
                                {t.back}
                            </button>
                            <button
                                className="auth-btn"
                                onClick={handleSubmit}
                                disabled={!validation?.valid || loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="onboard-spinner" style={{ borderTopColor: '#fff' }} />
                                        {t.creating}
                                    </>
                                ) : (
                                    <>
                                        {t.createSite}
                                        <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginLeft: 4 }}>
                                            arrow_forward
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

/* ——————————————————————————————————————
   Top Bar Component
   —————————————————————————————————————— */

interface TopBarProps {
    lang: Lang
    isDark: boolean
    user: SessionUser
    showUserMenu: boolean
    onCycleLang: () => void
    onToggleTheme: () => void
    onToggleUserMenu: () => void
    onLogout: () => void
}

function TopBar({ lang, isDark, user, showUserMenu, onCycleLang, onToggleTheme, onToggleUserMenu, onLogout }: TopBarProps) {
    return (
        <div className="auth-top-bar">
            <button onClick={onCycleLang} className="auth-lang-btn">
                {lang.toUpperCase()}
            </button>
            <button onClick={onToggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>
                    {isDark ? 'light_mode' : 'dark_mode'}
                </span>
            </button>
            <div className="auth-user-container">
                <button onClick={onToggleUserMenu} className="auth-user-btn" aria-label="User menu">
                    <span className="material-symbols-outlined">
                        account_circle
                    </span>
                </button>
                {showUserMenu && (
                    <div className="auth-user-dropdown">
                        <div className="auth-user-dropdown-email">
                            <span className="material-symbols-outlined">mail</span>
                            <span>{user.email}</span>
                        </div>
                        <button className="auth-user-dropdown-logout" onClick={onLogout}>
                            <span className="material-symbols-outlined">logout</span>
                            Log out
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ——————————————————————————————————————
   Utilities
   —————————————————————————————————————— */

function debounce<T extends (...args: string[]) => void>(fn: T, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: Parameters<T>) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), ms)
    }
}
