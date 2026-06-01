'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon, type AuthIconName } from '@/components/AuthIcon'
import { getAdminDashboardUrl } from '@/lib/config/urls'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

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
        store: 'Online Store',
        storeDesc: 'Sell products online',
        portfolio: 'Portfolio',
        portfolioDesc: 'Showcase your work',
        resume: 'Resume / CV',
        resumeDesc: 'Professional profile',
        landing: 'Landing Page',
        landingDesc: 'Marketing & leads',
        blog: 'Blog',
        blogDesc: 'Publish articles & stories',
        // Step 3: Template
        pickTemplate: 'Choose a template',
        pickTemplateDesc: 'Start with a professional design you can customize later',
        blankTemplate: 'Blank Canvas',
        blankTemplateDesc: 'Start from scratch',
        modernTemplate: 'Modern',
        modernTemplateDesc: 'Clean & minimal',
        boldTemplate: 'Bold',
        boldTemplateDesc: 'Strong & vibrant',
        classicTemplate: 'Classic',
        classicTemplateDesc: 'Timeless & elegant',
        skip: 'Skip for now',
        next: 'Next',
        // Step 4: Survey
        tellUsMore: 'Tell us about your business',
        surveyDesc: 'Help us tailor your experience',
        businessGoal: 'What is your primary goal?',
        goalSell: 'Sell products or services',
        goalShowcase: 'Showcase my work',
        goalGenerate: 'Generate leads',
        goalBlog: 'Publish content',
        teamSize: 'Team size',
        teamSolo: 'Just me',
        teamSmall: '2–10 people',
        teamMedium: '11–50 people',
        teamLarge: '50+ people',
        // Step 5: AI Setup
        aiSetup: 'AI-Powered Setup',
        aiSetupDesc: 'Let AI help generate your initial content',
        aiDescription: 'Describe your business in a few words',
        aiPlaceholder: 'e.g. A boutique coffee roaster in Chennai',
        aiGenerate: 'Generate with AI',
        aiSkip: 'Skip AI setup',
        // Step 6: Confirmation
        confirmTitle: 'Review & Create',
        confirmDesc: 'Everything looks good? Let\'s launch!',
        siteTypeLabel: 'Site Type',
        templateLabel: 'Template',
        subdomainLabel: 'URL',
        confirm: 'Create My Site',
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
        store: 'ऑनलाइन स्टोर',
        storeDesc: 'ऑनलाइन उत्पाद बेचें',
        portfolio: 'पोर्टफोलियो',
        portfolioDesc: 'अपना काम दिखाएं',
        resume: 'रिज्यूमे / CV',
        resumeDesc: 'पेशेवर प्रोफाइल',
        landing: 'लैंडिंग पेज',
        landingDesc: 'मार्केटिंग और लीड्स',
        blog: 'ब्लॉग',
        blogDesc: 'लेख और कहानियाँ प्रकाशित करें',
        pickTemplate: 'टेम्पलेट चुनें',
        pickTemplateDesc: 'एक पेशेवर डिज़ाइन से शुरू करें',
        blankTemplate: 'खाली कैनवस',
        blankTemplateDesc: 'शून्य से शुरू करें',
        modernTemplate: 'आधुनिक',
        modernTemplateDesc: 'साफ़ और न्यूनतम',
        boldTemplate: 'बोल्ड',
        boldTemplateDesc: 'मज़बूत और जीवंत',
        classicTemplate: 'क्लासिक',
        classicTemplateDesc: 'शाश्वत और सुंदर',
        skip: 'अभी छोड़ें',
        next: 'अगला',
        tellUsMore: 'अपने व्यवसाय के बारे में बताएं',
        surveyDesc: 'हमें आपका अनुभव तैयार करने में मदद करें',
        businessGoal: 'आपका मुख्य लक्ष्य क्या है?',
        goalSell: 'उत्पाद या सेवाएं बेचें',
        goalShowcase: 'अपना काम दिखाएं',
        goalGenerate: 'लीड्स उत्पन्न करें',
        goalBlog: 'सामग्री प्रकाशित करें',
        teamSize: 'टीम का आकार',
        teamSolo: 'सिर्फ़ मैं',
        teamSmall: '2–10 लोग',
        teamMedium: '11–50 लोग',
        teamLarge: '50+ लोग',
        aiSetup: 'AI-संचालित सेटअप',
        aiSetupDesc: 'AI को आपकी प्रारंभिक सामग्री बनाने दें',
        aiDescription: 'अपने व्यवसाय का वर्णन करें',
        aiPlaceholder: 'जैसे: चेन्नई में एक कॉफी रोस्टर',
        aiGenerate: 'AI से बनाएं',
        aiSkip: 'AI सेटअप छोड़ें',
        confirmTitle: 'समीक्षा करें और बनाएं',
        confirmDesc: 'सब ठीक लग रहा है? चलिए शुरू करते हैं!',
        siteTypeLabel: 'साइट प्रकार',
        templateLabel: 'टेम्पलेट',
        subdomainLabel: 'URL',
        confirm: 'मेरी साइट बनाएं',
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
        store: 'ஆன்லைன் கடை',
        storeDesc: 'ஆன்லைனில் பொருட்கள் விற்கவும்',
        portfolio: 'போர்ட்ஃபோலியோ',
        portfolioDesc: 'உங்கள் வேலையை காட்டுங்கள்',
        resume: 'ரெஸ்யூம் / CV',
        resumeDesc: 'தொழில்முறை சுயவிவரம்',
        landing: 'லேண்டிங் பேஜ்',
        landingDesc: 'மார்க்கெட்டிங் & லீட்ஸ்',
        blog: 'வலைப்பதிவு',
        blogDesc: 'கட்டுரைகள் மற்றும் கதைகளை வெளியிடுங்கள்',
        pickTemplate: 'டெம்ப்ளேட்டை தேர்ந்தெடுக்கவும்',
        pickTemplateDesc: 'தொழில்முறை வடிவமைப்புடன் தொடங்குங்கள்',
        blankTemplate: 'காலி கேன்வாஸ்',
        blankTemplateDesc: 'முதலில் இருந்து தொடங்குங்கள்',
        modernTemplate: 'நவீனம்',
        modernTemplateDesc: 'சுத்தமான & குறைந்த',
        boldTemplate: 'தைரியமான',
        boldTemplateDesc: 'வலுவான & உயிர்ப்பான',
        classicTemplate: 'க்ளாசிக்',
        classicTemplateDesc: 'காலம் கடந்த & அழகான',
        skip: 'இப்போது விடுங்கள்',
        next: 'அடுத்தது',
        tellUsMore: 'உங்கள் வணிகத்தைப் பற்றி சொல்லுங்கள்',
        surveyDesc: 'உங்கள் அனுபவத்தை தனிப்பயானதாக உதவுங்கள்',
        businessGoal: 'உங்கள் முதன்மை இலக்கு என்ன?',
        goalSell: 'பொருட்கள் அல்லது சேவைகளை விற்க',
        goalShowcase: 'என் வேலையை காட்ட',
        goalGenerate: 'லீட்களை உருவாக்க',
        goalBlog: 'உள்ளடக்கத்தை வெளியிட',
        teamSize: 'குழு அளவு',
        teamSolo: 'நான் மட்டும்',
        teamSmall: '2–10 பேர்',
        teamMedium: '11–50 பேர்',
        teamLarge: '50+ பேர்',
        aiSetup: 'AI-செயற்கை அமைப்பு',
        aiSetupDesc: 'தொடக்க உள்ளடக்கத்தை AI உருவாக்கட்டும்',
        aiDescription: 'உங்கள் வணிகத்தை விவரிக்கவும்',
        aiPlaceholder: 'உதா: சென்னையில் ஒரு காபி ரோஸ்டர்',
        aiGenerate: 'AI மூலம் உருவாக்கு',
        aiSkip: 'AI அமைப்பை விடு',
        confirmTitle: 'சரிபார்க்கவும் மற்றும் உருவாக்கவும்',
        confirmDesc: 'எல்லாம் சரியாக உள்ளதா? தொடங்குவோம்!',
        siteTypeLabel: 'தள வகை',
        templateLabel: 'டெம்ப்ளேட்',
        subdomainLabel: 'URL',
        confirm: 'என் தளத்தை உருவாக்கு',
    },
}

/* ——————————————————————————————————————
   Constants
   —————————————————————————————————————— */

const SITE_TYPES: { id: SiteType; nameKey: string; icon: AuthIconName; descKey: string }[] = [
    { id: 'store', nameKey: 'store', icon: 'shopping_cart', descKey: 'storeDesc' },
    { id: 'portfolio', nameKey: 'portfolio', icon: 'work', descKey: 'portfolioDesc' },
    { id: 'resume', nameKey: 'resume', icon: 'article', descKey: 'resumeDesc' },
    { id: 'landing', nameKey: 'landing', icon: 'rocket_launch', descKey: 'landingDesc' },
    { id: 'blog', nameKey: 'blog', icon: 'edit_note', descKey: 'blogDesc' },
]

type TemplateId = 'blank' | 'modern' | 'bold' | 'classic'

const TEMPLATES: { id: TemplateId; nameKey: string; descKey: string; icon: AuthIconName }[] = [
    { id: 'blank', nameKey: 'blankTemplate', icon: 'dashboard_customize', descKey: 'blankTemplateDesc' },
    { id: 'modern', nameKey: 'modernTemplate', icon: 'auto_awesome', descKey: 'modernTemplateDesc' },
    { id: 'bold', nameKey: 'boldTemplate', icon: 'flash_on', descKey: 'boldTemplateDesc' },
    { id: 'classic', nameKey: 'classicTemplate', icon: 'menu_book', descKey: 'classicTemplateDesc' },
]

const TOTAL_STEPS = 6

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function OnboardingPage() {
    const [step, setStep] = useState(1)
    const [siteType, setSiteType] = useState<SiteType | null>(null)
    const [subdomain, setSubdomain] = useState('')
    const [storeName, setStoreName] = useState('')

    // Step 3
    const [template, setTemplate] = useState<TemplateId>('blank')
    // Step 4
    const [goal, setGoal] = useState<string>('')
    const [teamSize, setTeamSize] = useState<string>('')
    // Step 5
    const [aiDescription, setAiDescription] = useState('')

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

    /* ——— Multi-store: users can now create additional sites ——— */

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

            // Create store via API (server-side, uses service role for DB access)
            const res = await fetch('/api/auth/create-store', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    siteType,
                    storeName: name,
                    subdomain,
                    templateId: template !== 'blank' ? template : null,
                    survey: {
                        goal,
                        teamSize,
                    },
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Failed to create store')
                setLoading(false)

                // Log failure
                await fetch('/api/email/store-creation-failure', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        email: user.email,
                        storeName: name,
                        storeType: siteType,
                        reason: res.status === 409 ? 'subdomain_taken' : 'api_error',
                        errorDetails: data.error,
                    }),
                }).catch(() => { })

                return
            }

            setSuccess(true)

            // Redirect after a brief pause
            setTimeout(() => {
                window.location.href = getAdminDashboardUrl(subdomain)
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
                            <AuthIcon name="check_circle" size={48} style={{ color: 'var(--success, #22C55E)' }} />
                        </div>
                        <h1 className="auth-title">{t.allSet}</h1>
                        <p className="auth-subtitle">
                            Your {SITE_TYPES.find((st) => st.id === siteType)?.nameKey
                                ? t[SITE_TYPES.find((st) => st.id === siteType)!.nameKey]
                                : 'site'} has been created.
                        </p>
                        <div className="onboard-success-url">
                            <AuthIcon name="link" size={16} style={{ marginRight: 6 }} />
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
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                        <div key={i} className={`onboard-progress-step ${step >= i + 1 ? 'active' : ''}`} />
                    ))}
                </div>

                {/* Error banner */}
                {error && (
                    <div className="auth-error">
                        <AuthIcon name="error" size={16} style={{ marginRight: 6 }} />
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
                                        <AuthIcon name={type.icon} size={28} />
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
                                        <AuthIcon name={validation.valid ? 'check_circle' : 'cancel'} size={16} style={{ marginRight: 4 }} />
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
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </button>
                            <button
                                className="auth-btn"
                                onClick={() => validation?.valid && setStep(3)}
                                disabled={!validation?.valid}
                            >
                                {t.next}
                                <AuthIcon name="arrow_forward" size={18} style={{ marginLeft: 4 }} />
                            </button>
                        </div>
                    </>
                )}

                {/* ——— STEP 3: Template picker ——— */}
                {step === 3 && (
                    <>
                        <h1 className="auth-title">{t.pickTemplate}</h1>
                        <p className="auth-subtitle">{t.pickTemplateDesc}</p>

                        <div className="onboard-type-grid">
                            {TEMPLATES.map((tmpl) => (
                                <button
                                    key={tmpl.id}
                                    className={`onboard-type-card ${template === tmpl.id ? 'selected' : ''}`}
                                    onClick={() => setTemplate(tmpl.id)}
                                >
                                    <span className="onboard-type-icon">
                                        <AuthIcon name={tmpl.icon} size={28} />
                                    </span>
                                    <span className="onboard-type-name">{t[tmpl.nameKey]}</span>
                                    <span className="onboard-type-desc">{t[tmpl.descKey]}</span>
                                </button>
                            ))}
                        </div>

                        <div className="onboard-btn-row">
                            <button className="auth-btn-secondary" onClick={() => setStep(2)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </button>
                            <button className="auth-btn" onClick={() => setStep(4)}>
                                {t.next}
                                <AuthIcon name="arrow_forward" size={18} style={{ marginLeft: 4 }} />
                            </button>
                        </div>
                    </>
                )}

                {/* ——— STEP 4: Business survey ——— */}
                {step === 4 && (
                    <>
                        <h1 className="auth-title">{t.tellUsMore}</h1>
                        <p className="auth-subtitle">{t.surveyDesc}</p>

                        {/* Goal */}
                        <div style={{ marginBottom: 20 }}>
                            <label className="auth-label">{t.businessGoal}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {([
                                    { id: 'sell', label: t.goalSell, icon: 'shopping_cart' },
                                    { id: 'showcase', label: t.goalShowcase, icon: 'visibility' },
                                    { id: 'leads', label: t.goalGenerate, icon: 'contact_page' },
                                    { id: 'blog', label: t.goalBlog, icon: 'edit_note' },
                                ] as { id: string; label: string; icon: AuthIconName }[]).map((g) => (
                                    <button
                                        key={g.id}
                                        className={`onboard-type-card ${goal === g.id ? 'selected' : ''}`}
                                        onClick={() => setGoal(g.id)}
                                        style={{ padding: '12px 16px', textAlign: 'left' }}
                                    >
                                        <AuthIcon name={g.icon} size={20} style={{ marginRight: 8 }} />
                                        <span style={{ fontSize: 13 }}>{g.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Team size */}
                        <div style={{ marginBottom: 20 }}>
                            <label className="auth-label">{t.teamSize}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                    { id: 'solo', label: t.teamSolo },
                                    { id: 'small', label: t.teamSmall },
                                    { id: 'medium', label: t.teamMedium },
                                    { id: 'large', label: t.teamLarge },
                                ].map((ts) => (
                                    <button
                                        key={ts.id}
                                        className={`onboard-type-card ${teamSize === ts.id ? 'selected' : ''}`}
                                        onClick={() => setTeamSize(ts.id)}
                                        style={{ padding: '10px 16px', fontSize: 13 }}
                                    >
                                        {ts.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="onboard-btn-row">
                            <button className="auth-btn-secondary" onClick={() => setStep(3)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </button>
                            <button className="auth-btn" onClick={() => setStep(5)}>
                                {t.next}
                                <AuthIcon name="arrow_forward" size={18} style={{ marginLeft: 4 }} />
                            </button>
                        </div>
                    </>
                )}

                {/* ——— STEP 5: AI Setup ——— */}
                {step === 5 && (
                    <>
                        <h1 className="auth-title">{t.aiSetup}</h1>
                        <p className="auth-subtitle">{t.aiSetupDesc}</p>

                        <div style={{ marginBottom: 20 }}>
                            <label className="auth-label">{t.aiDescription}</label>
                            <textarea
                                className="auth-input"
                                placeholder={t.aiPlaceholder}
                                value={aiDescription}
                                onChange={(e) => setAiDescription(e.target.value)}
                                rows={3}
                                style={{ resize: 'none', minHeight: 80 }}
                            />
                        </div>

                        <div className="onboard-btn-row">
                            <button className="auth-btn-secondary" onClick={() => setStep(4)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </button>
                            <button className="auth-btn-secondary" onClick={() => setStep(6)}>
                                {t.aiSkip}
                            </button>
                            <button className="auth-btn" onClick={() => setStep(6)} disabled={!aiDescription.trim()}>
                                {t.aiGenerate}
                                <AuthIcon name="auto_awesome" size={18} style={{ marginLeft: 4 }} />
                            </button>
                        </div>
                    </>
                )}

                {/* ——— STEP 6: Review & Confirm ——— */}
                {step === 6 && (
                    <>
                        <h1 className="auth-title">{t.confirmTitle}</h1>
                        <p className="auth-subtitle">{t.confirmDesc}</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                            {/* Site Type */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.siteTypeLabel}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {siteType ? t[SITE_TYPES.find(s => s.id === siteType)?.nameKey || 'store'] : '—'}
                                </span>
                            </div>
                            {/* Template */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.templateLabel}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {t[TEMPLATES.find(tp => tp.id === template)?.nameKey || 'blankTemplate']}
                                </span>
                            </div>
                            {/* URL */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t.subdomainLabel}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                                    {subdomain}.letbuyy.store
                                </span>
                            </div>
                        </div>

                        <div className="onboard-btn-row">
                            <button className="auth-btn-secondary" onClick={() => setStep(5)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </button>
                            <button
                                className="auth-btn"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="onboard-spinner" style={{ borderTopColor: '#fff' }} />
                                        {t.creating}
                                    </>
                                ) : (
                                    <>
                                        {t.confirm}
                                        <AuthIcon name="rocket_launch" size={18} style={{ marginLeft: 4 }} />
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
                <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
            </button>
            <div className="auth-user-container">
                <button onClick={onToggleUserMenu} className="auth-user-btn" aria-label="User menu">
                    <AuthIcon name="account_circle" size={20} />
                </button>
                {showUserMenu && (
                    <div className="auth-user-dropdown">
                        <div className="auth-user-dropdown-email">
                            <AuthIcon name="mail" size={20} />
                            <span>{user.email}</span>
                        </div>
                        <button className="auth-user-dropdown-logout" onClick={onLogout}>
                            <AuthIcon name="logout" size={18} />
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
