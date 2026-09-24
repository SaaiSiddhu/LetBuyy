'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon, type AuthIconName } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { getAdminSelectPlanUrl, getPlatformRootDomain, getStorefrontHost } from '@/lib/config/urls'
import { Button, Input, Select } from '@letbuyy/ui'

interface SessionUser {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
}

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'
type Lang = 'en' | 'hi' | 'ta'

interface ValidationResult {
    valid: boolean
    reason: string
    message: string
}

const translations: Record<Lang, Record<string, string>> = {
    en: {
        whatBuild: 'What do you want to build?',
        chooseSite: 'Choose the type of site for your business',
        nameSite: 'Name your site',
        storeUrl: 'This will be your store URL',
        guidedSetup: 'Guided opening',
        stepType: 'Type',
        stepDetails: 'Details',
        stepReview: 'Review',
        availableNow: 'Available now',
        comingSoon: 'Not enabled',
        lockedType: 'This format is not enabled for publication.',
        storeIncludes: 'Products, checkout, orders, themes',
        displayName: 'Display Name',
        displayPlaceholder: 'My Awesome Store',
        subdomain: 'Subdomain',
        subdomainPlaceholder: 'mystore',
        back: 'Back',
        next: 'Next',
        createSite: 'Create Site',
        creating: 'Creating...',
        successTitle: "Workspace created!",
        successDesc: 'Your LetBuyy workspace is ready. Choose a plan to start selling — Launch starts at ₹199/month during the Founding Program.',
        dashboardCta: 'Choose your plan',
        redirecting: 'Taking you to plan selection…',
        store: 'Online Store',
        storeDesc: 'Sell products online',
        landing: 'Landing Page',
        landingDesc: 'Marketing & leads',
        blog: 'Blog',
        blogDesc: 'Publish articles & stories',
        portfolio: 'Portfolio',
        portfolioDesc: 'Showcase your work',
        resume: 'Resume / CV',
        resumeDesc: 'Professional profile',
        confirmTitle: 'Review & Create',
        confirmDesc: 'Everything looks good? Create the site.',
        siteTypeLabel: 'Site Type',
        subdomainLabel: 'URL',
        confirm: 'Create My Site',
        whatsIncluded: "What's included",
        feat1: 'Products & Inventory',
        feat2: 'Orders + COD',
        feat3: 'Razorpay Payments',
        feat4: 'GST Invoicing',
        feat5: 'Custom Domain',
    },
    hi: {
        whatBuild: 'आप क्या बनाना चाहते हैं?',
        chooseSite: 'अपने व्यापार के लिए साइट का प्रकार चुनें',
        nameSite: 'अपनी साइट का नाम दें',
        storeUrl: 'यह आपका स्टोर URL होगा',
        guidedSetup: 'गाइडेड सेटअप',
        stepType: 'प्रकार',
        stepDetails: 'विवरण',
        stepReview: 'समीक्षा',
        availableNow: 'अभी उपलब्ध',
        comingSoon: 'सक्षम नहीं है',
        lockedType: 'यह फॉर्मेट प्रकाशन के लिए सक्षम नहीं है।',
        storeIncludes: 'Products, checkout, orders, themes',
        displayName: 'प्रदर्शन नाम',
        displayPlaceholder: 'मेरा स्टोर',
        subdomain: 'सबडोमेन',
        subdomainPlaceholder: 'mystore',
        back: 'वापस',
        next: 'अगला',
        createSite: 'साइट बनाएं',
        creating: 'बना रहे हैं...',
        successTitle: 'वर्कस्पेस तैयार है!',
        successDesc: 'आपका LetBuyy वर्कस्पेस बन गया है। अभी एक प्लान चुनें।',
        dashboardCta: 'प्लान चुनें',
        redirecting: 'प्लान चयन पर जा रहे हैं...',
        store: 'ऑनलाइन स्टोर',
        storeDesc: 'ऑनलाइन उत्पाद बेचें',
        landing: 'लैंडिंग पेज',
        landingDesc: 'मार्केटिंग और लीड्स',
        blog: 'ब्लॉग',
        blogDesc: 'लेख प्रकाशित करें',
        portfolio: 'पोर्टफोलियो',
        portfolioDesc: 'अपना काम दिखाएं',
        resume: 'रिज्यूमे / CV',
        resumeDesc: 'पेशेवर प्रोफाइल',
        confirmTitle: 'समीक्षा करें और बनाएं',
        confirmDesc: 'सब ठीक लग रहा है?',
        siteTypeLabel: 'साइट प्रकार',
        subdomainLabel: 'URL',
        confirm: 'मेरी साइट बनाएं',
        whatsIncluded: 'क्या शामिल है',
        feat1: 'प्रोडक्ट्स & इन्वेंटरी',
        feat2: 'ऑर्डर + COD',
        feat3: 'Razorpay पेमेंट',
        feat4: 'GST इनवॉइसिंग',
        feat5: 'कस्टम डोमेन',
    },
    ta: {
        whatBuild: 'நீங்கள் என்ன உருவாக்க விரும்புகிறீர்கள்?',
        chooseSite: 'உங்கள் வணிகத்திற்கான தளத்தின் வகையைத் தேர்ந்தெடுக்கவும்',
        nameSite: 'உங்கள் தளத்திற்கு பெயரிடுங்கள்',
        storeUrl: 'இது உங்கள் கடை URL ஆக இருக்கும்',
        guidedSetup: 'வழிகாட்டப்பட்ட அமைப்பு',
        stepType: 'வகை',
        stepDetails: 'விவரம்',
        stepReview: 'சரிபார்',
        availableNow: 'இப்போது கிடைக்கிறது',
        comingSoon: 'இயக்கப்படவில்லை',
        lockedType: 'இந்த வடிவம் வெளியீட்டிற்கு இயக்கப்படவில்லை.',
        storeIncludes: 'Products, checkout, orders, themes',
        displayName: 'காட்சி பெயர்',
        displayPlaceholder: 'என் கடை',
        subdomain: 'சப்டொமைன்',
        subdomainPlaceholder: 'mystore',
        back: 'திரும்ப',
        next: 'அடுத்தது',
        createSite: 'தளம் உருவாக்கு',
        creating: 'உருவாக்குகிறது...',
        successTitle: 'பணியிடம் தயார்!',
        successDesc: 'உங்கள் LetBuyy பணியிடம் உருவாக்கப்பட்டது. திட்டம் தேர்ந்தெடுக்கவும்.',
        dashboardCta: 'திட்டம் தேர்ந்தெடுக்கவும்',
        redirecting: 'திட்ட தேர்வுக்கு செல்கிறது...',
        store: 'ஆன்லைன் கடை',
        storeDesc: 'ஆன்லைனில் பொருட்கள் விற்கவும்',
        landing: 'லேண்டிங் பேஜ்',
        landingDesc: 'மார்க்கெட்டிங் & லீட்ஸ்',
        blog: 'வலைப்பதிவு',
        blogDesc: 'கட்டுரைகளை வெளியிடுங்கள்',
        portfolio: 'போர்ட்ஃபோலியோ',
        portfolioDesc: 'உங்கள் வேலையை காட்டுங்கள்',
        resume: 'ரெஸ்யூம் / CV',
        resumeDesc: 'தொழில்முறை சுயவிவரம்',
        confirmTitle: 'சரிபார்க்கவும் மற்றும் உருவாக்கவும்',
        confirmDesc: 'எல்லாம் சரியாக உள்ளதா?',
        siteTypeLabel: 'தள வகை',
        subdomainLabel: 'URL',
        confirm: 'என் தளத்தை உருவாக்கு',
        whatsIncluded: 'என்ன சேர்க்கப்பட்டுள்ளது',
        feat1: 'பொருட்கள் & சரக்கு',
        feat2: 'ஆர்டர்கள் + COD',
        feat3: 'Razorpay பேமெண்ட்',
        feat4: 'GST இன்வாய்ஸ்',
        feat5: 'தனிப்பயன் டொமைன்',
    },
}

type SiteTypeAvailability = 'available' | 'launch-disabled' | 'locked'

type SiteTypeOption = {
    id: SiteType
    nameKey: string
    icon: AuthIconName
    descKey: string
    availability: SiteTypeAvailability
}

const SITE_TYPES: SiteTypeOption[] = [
    { id: 'store', nameKey: 'store', icon: 'shopping_cart', descKey: 'storeDesc', availability: 'available' },
    { id: 'landing', nameKey: 'landing', icon: 'rocket_launch', descKey: 'landingDesc', availability: 'launch-disabled' },
    { id: 'blog', nameKey: 'blog', icon: 'edit_note', descKey: 'blogDesc', availability: 'launch-disabled' },
]

const LEGACY_SITE_TYPES: SiteTypeOption[] = [
    { id: 'portfolio', nameKey: 'portfolio', icon: 'work', descKey: 'portfolioDesc', availability: 'locked' },
    { id: 'resume', nameKey: 'resume', icon: 'article', descKey: 'resumeDesc', availability: 'locked' },
]

const ACQUISITION_SITE_TYPES =
    process.env.NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES === 'true'
        ? [...SITE_TYPES, ...LEGACY_SITE_TYPES]
        : SITE_TYPES

// Phase-2.5 Stream C — industry picker options (UI labels + recommended Experience name for display).
// The CANONICAL industry→experience mapping + token application lives server-side in
// @letbuyy/theme-engine (resolveExperienceForIndustry, applied in the gateway POST /stores handler);
// this client list only drives the selector and the "recommended" hint.
const ONBOARDING_INDUSTRIES = [
    { id: 'electronics', label: 'Electronics & Tech', experience: 'Forge' },
    { id: 'fashion', label: 'Fashion & Apparel', experience: 'Sense' },
    { id: 'beauty', label: 'Beauty & Cosmetics', experience: 'Aura' },
    { id: 'furniture', label: 'Furniture & Home', experience: 'Craft' },
    { id: 'food', label: 'Food & Grocery', experience: 'Refresh' },
    { id: 'sports', label: 'Sports & Fitness', experience: 'Ride' },
    { id: 'books', label: 'Books & Stationery', experience: 'Dawn' },
    { id: 'pet', label: 'Pet & Animals', experience: 'Bloom' },
    { id: 'general', label: 'General / Multi-category', experience: 'Summit' },
] as const

function isSiteTypeAvailable(type: SiteTypeOption) {
    return type.availability === 'available'
}

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [siteType, setSiteType] = useState<SiteType | null>(null)
    const [subdomain, setSubdomain] = useState('')
    const [storeName, setStoreName] = useState('')
    const [industry, setIndustry] = useState<string>('general')
    const [validation, setValidation] = useState<ValidationResult | null>(null)
    const [validating, setValidating] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [user, setUser] = useState<SessionUser | null>(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [lang, setLang] = useState<Lang>('en')
    const [showUserMenu, setShowUserMenu] = useState(false)

    const t = translations[lang]

    useEffect(() => {
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)
    }, [])

    useEffect(() => {
        fetch('/api/auth/session')
            .then((r) => r.json())
            .then((data) => {
                setUser(data.authenticated && data.user ? data.user : null)
            })
            .catch(() => setUser(null))
            .finally(() => setAuthLoading(false))
    }, [])

    useEffect(() => {
        if (!showUserMenu) return
        const close = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.auth-user-container')) setShowUserMenu(false)
        }
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [showUserMenu])

    const cycleLang = () => {
        const langs: Lang[] = ['en', 'hi', 'ta']
        const next = langs[(langs.indexOf(lang) + 1) % langs.length]
        setLang(next)
        localStorage.setItem('letbuyy_lang', next)
    }

    const handleLogout = async () => {
        try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { }
        window.location.href = '/lookup'
    }

    const validateSubdomain = useMemo(
        () =>
            debounce(async (value: string) => {
                if (value.length < 4) {
                    setValidation({ valid: false, reason: 'too_short', message: 'At least 4 characters' })
                    setValidating(false)
                    return
                }
                try {
                    const res = await fetch(`/api/auth/validate-subdomain?subdomain=${value}`)
                    setValidation(await res.json())
                } catch {
                    setValidation({ valid: false, reason: 'error', message: 'Unable to check' })
                } finally {
                    setValidating(false)
                }
            }, 300),
        []
    )

    const onSubdomainChange = (raw: string) => {
        const clean = raw.toLowerCase().replace(/[^a-z0-9-]/g, '')
        setSubdomain(clean)
        setError(null)
        if (!clean) { setValidation(null); setValidating(false); return }
        setValidating(true)
        validateSubdomain(clean)
    }

    const handleSubmit = async () => {
        if (!siteType || !subdomain || !user || !validation?.valid) return
        setLoading(true)
        setError(null)
        try {
            const name = storeName.trim() || subdomain
            const res = await fetch('/api/auth/create-store', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ siteType, storeName: name, subdomain, templateId: 'modern', survey: { industry } }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Failed to create store')
                setLoading(false)
                return
            }
            setSuccess(true)
            setTimeout(() => { window.location.href = getAdminSelectPlanUrl(subdomain) }, 1500)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
            setLoading(false)
        }
    }

    if (authLoading) {
        return (
            <div className="auth-container">
                <div className="auth-card onboard-card">
                    <div className="auth-logo"><BrandLogo /></div>
                    <div className="select-loading">
                        <div className="select-loading-spinner" />
                        <p>Loading…</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="auth-container">
                <div className="auth-card onboard-card">
                    <div className="auth-logo"><BrandLogo /></div>
                    <h1 className="auth-title">Sign in to continue</h1>
                    <p className="auth-subtitle">Your session expired. Log in again to create your site.</p>
                    <Button unstyled className="auth-btn-primary" onClick={() => { window.location.href = '/lookup' }}>Log in</Button>
                </div>
            </div>
        )
    }

    if (success) {
        const selectedSiteType = ACQUISITION_SITE_TYPES.find((st) => st.id === siteType)
        return (
            <div className="auth-container">
                <TopBar lang={lang} user={user} showUserMenu={showUserMenu}
                    onCycleLang={cycleLang}
                    onToggleUserMenu={() => setShowUserMenu(!showUserMenu)} onLogout={handleLogout} />
                <div className="auth-card onboard-card">
                    <div className="auth-logo"><BrandLogo /></div>
                    <div className="onboard-success">
                        <div className="onboard-success-icon">
                            <AuthIcon name="check_circle" size={28} style={{ color: 'var(--lb-color-success)' }} />
                        </div>
                        <h1 className="auth-title">{t.successTitle}</h1>
                        <p className="auth-subtitle">{t.successDesc}</p>
                        <div className="onboard-review-rows">
                            <div className="onboard-review-row">
                                <span>{t.siteTypeLabel}</span>
                                <strong>{selectedSiteType ? t[selectedSiteType.nameKey] : '—'}</strong>
                            </div>
                            <div className="onboard-review-row">
                                <span>{t.subdomainLabel}</span>
                                <strong className="text-[color:var(--primary)]">{getStorefrontHost(subdomain)}</strong>
                            </div>
                        </div>
                        <div className="onboard-redirect-hint">
                            <div className="select-loading-spinner small" />
                            {t.redirecting}
                        </div>
                        <div className="onboard-btn-row" style={{ marginTop: 16 }}>
                            <Button type="button" fullWidth onClick={() => { window.location.href = getAdminSelectPlanUrl(subdomain) }}>
                                {t.dashboardCta}
                                <AuthIcon name="arrow_forward" size={18} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <TopBar lang={lang} user={user} showUserMenu={showUserMenu}
                onCycleLang={cycleLang}
                onToggleUserMenu={() => setShowUserMenu(!showUserMenu)} onLogout={handleLogout} />

            <div className="auth-card onboard-card">
                <div className="auth-logo"><BrandLogo /></div>


                {error && (
                    <div className="auth-error" role="alert">
                        <AuthIcon name="error" size={16} />
                        {error}
                    </div>
                )}

                {/* STEP 1: Choose type */}
                {step === 1 && (
                    <>
                        <h1 className="auth-title">{t.whatBuild}</h1>
                        <p className="auth-subtitle">{t.chooseSite}</p>
                        <div className="onboard-bento-grid">
                            {ACQUISITION_SITE_TYPES.map((type) => (
                                <Button unstyled
                                    key={type.id}
                                    className={[
                                        'onboard-bento-card',
                                        type.id === 'store' ? 'primary' : 'compact',
                                        siteType === type.id ? 'selected' : '',
                                        !isSiteTypeAvailable(type) ? 'locked' : '',
                                    ].filter(Boolean).join(' ')}
                                    disabled={!isSiteTypeAvailable(type)}
                                    onClick={() => {
                                        if (!isSiteTypeAvailable(type)) return
                                        setError(null)
                                        setSiteType(type.id)
                                        setStep(2)
                                    }}
                                >
                                    <span className="onboard-bento-topline">
                                        <span className="onboard-type-icon">
                                            <AuthIcon name={type.icon} size={type.id === 'store' ? 28 : 22} />
                                        </span>
                                        <span className={`onboard-type-status ${type.availability}`}>
                                            {type.availability === 'available' ? t.availableNow : t.comingSoon}
                                        </span>
                                    </span>
                                    <span className="onboard-type-name">{t[type.nameKey]}</span>
                                    <span className="onboard-type-desc">
                                        {isSiteTypeAvailable(type) ? t[type.descKey] : t.lockedType}
                                    </span>
                                    {type.id === 'store' && (
                                        <span className="onboard-store-includes">{t.storeIncludes}</span>
                                    )}
                                </Button>
                            ))}
                        </div>
                    </>
                )}

                {/* STEP 2: Name & subdomain */}
                {step === 2 && (
                    <>
                        <h1 className="auth-title">{t.nameSite}</h1>
                        <p className="auth-subtitle">{t.storeUrl}</p>


                        <div className="auth-form" style={{ gap: 16 }}>
                            <div className="auth-field">
                                <label htmlFor="store-display-name" className="auth-field label">{t.displayName}</label>
                                <Input
                                    id="store-display-name"
                                    type="text"
                                    placeholder={t.displayPlaceholder}
                                    value={storeName}
                                    onChange={(e) => setStoreName(e.target.value)}
                                />
                            </div>

                            <div className="auth-field">
                                <label className="auth-field label">{t.subdomain}</label>
                                <div className={`onboard-subdomain-wrapper${validation ? (validation.valid ? ' valid' : ' invalid') : ''}`}>
                                    <Input unstyled
                                        type="text"
                                        className="onboard-subdomain-input"
                                        placeholder={t.subdomainPlaceholder}
                                        value={subdomain}
                                        onChange={(e) => onSubdomainChange(e.target.value)}
                                        maxLength={63}
                                        autoFocus
                                    />
                                    <span className="onboard-subdomain-suffix">.{getPlatformRootDomain()}</span>
                                </div>
                                <div className={`onboard-validation${validating ? ' checking' : validation ? (validation.valid ? ' valid' : (validation.reason === 'reserved' ? ' reserved' : ' invalid')) : ''}`}>
                                    {validating ? (
                                        <><span className="onboard-spinner" />Checking availability…</>
                                    ) : validation ? (
                                        <><AuthIcon name={validation.valid ? 'check_circle' : 'cancel'} size={14} />{validation.message}</>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div className="onboard-btn-row">
                            <Button unstyled className="auth-btn-secondary" onClick={() => setStep(1)}>
                                <AuthIcon name="arrow_back" size={16} />
                                {t.back}
                            </Button>
                            <Button unstyled className="auth-btn" onClick={() => validation?.valid && setStep(3)} disabled={!validation?.valid}>
                                {t.next}
                                <AuthIcon name="arrow_forward" size={16} />
                            </Button>
                        </div>
                    </>
                )}

                {/* STEP 3: Review & create */}
                {step === 3 && (
                    <>
                        <h1 className="auth-title">{t.confirmTitle}</h1>
                        <p className="auth-subtitle">{t.confirmDesc}</p>

                        <div className="onboard-review-rows">
                            <div className="onboard-review-row">
                                <span>{t.siteTypeLabel}</span>
                                <strong>{siteType ? t[ACQUISITION_SITE_TYPES.find(s => s.id === siteType)?.nameKey || 'store'] : '—'}</strong>
                            </div>
                            <div className="onboard-review-row">
                                <span>{t.displayName}</span>
                                <strong>{storeName.trim() || subdomain}</strong>
                            </div>
                            <div className="onboard-review-row">
                                <span>{t.subdomainLabel}</span>
                                <strong style={{ color: 'var(--primary)' }}>{getStorefrontHost(subdomain)}</strong>
                            </div>
                            <div className="onboard-review-row">
                                <span>Industry</span>
                                <Select
                                    unstyled
                                    className="onboard-industry-select"
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    aria-label="Industry"
                                    options={ONBOARDING_INDUSTRIES.map((opt) => ({ value: opt.id, label: opt.label }))}
                                />
                            </div>
                            <div className="onboard-review-row">
                                <span>Recommended experience</span>
                                <strong>{ONBOARDING_INDUSTRIES.find((o) => o.id === industry)?.experience ?? 'Summit'}</strong>
                            </div>
                        </div>

                        <div className="onboard-btn-row">
                            <Button unstyled className="auth-btn-secondary" onClick={() => setStep(2)}>
                                <AuthIcon name="arrow_back" size={16} />
                                {t.back}
                            </Button>
                            <Button unstyled className="auth-btn" type="button" loading={loading} onClick={handleSubmit} disabled={loading}>
                                {loading ? t.creating : t.confirm}
                                {!loading && <AuthIcon name="rocket_launch" size={16} />}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

interface TopBarProps {
    lang: Lang; user: SessionUser; showUserMenu: boolean
    onCycleLang: () => void
    onToggleUserMenu: () => void; onLogout: () => void
}

function TopBar({ lang, user, showUserMenu, onCycleLang, onToggleUserMenu, onLogout }: TopBarProps) {
    return (
        <div className="auth-top-bar">
            <Button unstyled onClick={onCycleLang} className="auth-lang-btn">{lang.toUpperCase()}</Button>
            <div className="auth-user-container">
                <Button unstyled onClick={onToggleUserMenu} className="auth-user-btn" aria-label="User menu">
                    <AuthIcon name="account_circle" size={20} />
                </Button>
                {showUserMenu && (
                    <div className="auth-user-dropdown">
                        <div className="auth-user-dropdown-email">
                            <AuthIcon name="mail" size={20} />
                            <span>{user.email}</span>
                        </div>
                        <Button unstyled className="auth-user-dropdown-logout" onClick={onLogout}>
                            <AuthIcon name="logout" size={18} />
                            Log out
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

function debounce<T extends (...args: string[]) => void>(fn: T, ms: number) {
    let timer: ReturnType<typeof setTimeout>
    return (...args: Parameters<T>) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), ms)
    }
}
