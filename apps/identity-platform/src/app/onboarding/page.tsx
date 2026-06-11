'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon, type AuthIconName } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { getAdminDashboardUrl } from '@/lib/config/urls'
import { Badge, Banner, Button, DescriptionList, Input } from '@letbuyy/ui'
import { useAuthTheme } from '@/lib/useAuthTheme'

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
        guidedSetup: 'Guided launch',
        stepType: 'Type',
        stepDetails: 'Details',
        stepReview: 'Review',
        availableNow: 'Available now',
        comingSoon: 'Not enabled',
        lockedType: 'This format is locked for launch.',
        onlineStoreOnly: 'Online Store is available today. Landing pages and blogs are not enabled for launch.',
        storeIncludes: 'Products, checkout, orders, themes',
        smartDefaults: 'India commerce defaults',
        smartDefaultsDesc: 'We will start your site with INR currency, GST-ready tax settings, and COD-friendly launch guidance.',
        currencyDefault: 'INR currency',
        gstDefault: 'GST-ready setup',
        codDefault: 'COD-ready guidance',
        displayName: 'Display Name',
        displayPlaceholder: 'My Awesome Store',
        subdomain: 'Subdomain',
        subdomainPlaceholder: 'mystore',
        back: 'Back',
        createSite: 'Create Site',
        creating: 'Creating...',
        allSet: "You're all set!",
        successBadge: 'Store live',
        successTitle: '🎉 Your store is ready!',
        successDesc: 'Your LetBuyy workspace is ready. Open the dashboard to add products, payments, shipping, and launch details.',
        successNext: 'Opening your dashboard',
        dashboardCta: 'Go to dashboard',
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
        guidedSetup: 'गाइडेड लॉन्च',
        stepType: 'प्रकार',
        stepDetails: 'विवरण',
        stepReview: 'समीक्षा',
        availableNow: 'अभी उपलब्ध',
        comingSoon: 'सक्षम नहीं है',
        lockedType: 'यह फॉर्मेट लॉन्च के लिए लॉक है।',
        onlineStoreOnly: 'आज Online Store उपलब्ध है। Landing pages और blogs launch के लिए सक्षम नहीं हैं।',
        storeIncludes: 'Products, checkout, orders, themes',
        smartDefaults: 'भारत कॉमर्स डिफॉल्ट',
        smartDefaultsDesc: 'हम INR मुद्रा, GST-ready टैक्स सेटिंग्स और COD-friendly लॉन्च मार्गदर्शन से शुरुआत करेंगे।',
        currencyDefault: 'INR मुद्रा',
        gstDefault: 'GST-ready सेटअप',
        codDefault: 'COD-ready मार्गदर्शन',
        displayName: 'प्रदर्शन नाम',
        displayPlaceholder: 'मेरा स्टोर',
        subdomain: 'सबडोमेन',
        subdomainPlaceholder: 'mystore',
        back: 'वापस',
        createSite: 'साइट बनाएं',
        creating: 'बना रहे हैं...',
        allSet: 'सब तैयार है!',
        successBadge: 'स्टोर लाइव',
        successTitle: '🎉 आपका स्टोर तैयार है!',
        successDesc: 'आपका LetBuyy वर्कस्पेस तैयार है। उत्पाद, भुगतान, शिपिंग और लॉन्च विवरण जोड़ने के लिए डैशबोर्ड खोलें।',
        successNext: 'आपका डैशबोर्ड खुल रहा है',
        dashboardCta: 'डैशबोर्ड पर जाएं',
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
        guidedSetup: 'வழிகாட்டப்பட்ட வெளியீடு',
        stepType: 'வகை',
        stepDetails: 'விவரம்',
        stepReview: 'சரிபார்',
        availableNow: 'இப்போது கிடைக்கிறது',
        comingSoon: 'இயக்கப்படவில்லை',
        lockedType: 'இந்த வடிவம் வெளியீட்டிற்கு பூட்டப்பட்டுள்ளது.',
        onlineStoreOnly: 'Online Store இன்று கிடைக்கிறது. Landing pages மற்றும் blogs launchக்கு இயக்கப்படவில்லை.',
        storeIncludes: 'Products, checkout, orders, themes',
        smartDefaults: 'இந்தியா வர்த்தக இயல்புகள்',
        smartDefaultsDesc: 'INR நாணயம், GST-ready வரி அமைப்புகள், COD-friendly வெளியீட்டு வழிகாட்டுதலுடன் தொடங்குவோம்.',
        currencyDefault: 'INR நாணயம்',
        gstDefault: 'GST-ready அமைப்பு',
        codDefault: 'COD-ready வழிகாட்டுதல்',
        displayName: 'காட்சி பெயர்',
        displayPlaceholder: 'என் கடை',
        subdomain: 'சப்டொமைன்',
        subdomainPlaceholder: 'mystore',
        back: 'திரும்ப',
        createSite: 'தளம் உருவாக்கு',
        creating: 'உருவாக்குகிறது...',
        allSet: 'எல்லாம் தயார்!',
        successBadge: 'கடை live',
        successTitle: '🎉 உங்கள் கடை தயார்!',
        successDesc: 'உங்கள் LetBuyy பணியிடம் தயார். தயாரிப்புகள், பணப்பரிவர்த்தனை, ஷிப்பிங், வெளியீட்டு விவரங்களைச் சேர்க்க டாஷ்போர்டைத் திறக்கவும்.',
        successNext: 'உங்கள் டாஷ்போர்டு திறக்கிறது',
        dashboardCta: 'டாஷ்போர்டுக்கு செல்லவும்',
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

type SiteTypeAvailability = 'available' | 'coming-soon' | 'locked'

type SiteTypeOption = {
    id: SiteType
    nameKey: string
    icon: AuthIconName
    descKey: string
    availability: SiteTypeAvailability
}

const SITE_TYPES: SiteTypeOption[] = [
    { id: 'store', nameKey: 'store', icon: 'shopping_cart', descKey: 'storeDesc', availability: 'available' },
    { id: 'landing', nameKey: 'landing', icon: 'rocket_launch', descKey: 'landingDesc', availability: 'coming-soon' },
    { id: 'blog', nameKey: 'blog', icon: 'edit_note', descKey: 'blogDesc', availability: 'coming-soon' },
]

const LEGACY_SITE_TYPES: SiteTypeOption[] = [
    { id: 'portfolio', nameKey: 'portfolio', icon: 'work', descKey: 'portfolioDesc', availability: 'locked' },
    { id: 'resume', nameKey: 'resume', icon: 'article', descKey: 'resumeDesc', availability: 'locked' },
]

const ACQUISITION_SITE_TYPES =
    process.env.NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES === 'true'
        ? [...SITE_TYPES, ...LEGACY_SITE_TYPES]
        : SITE_TYPES

type TemplateId = 'blank' | 'modern' | 'bold' | 'classic'

const TEMPLATES: { id: TemplateId; nameKey: string; descKey: string; icon: AuthIconName }[] = [
    { id: 'blank', nameKey: 'blankTemplate', icon: 'dashboard_customize', descKey: 'blankTemplateDesc' },
    { id: 'modern', nameKey: 'modernTemplate', icon: 'auto_awesome', descKey: 'modernTemplateDesc' },
    { id: 'bold', nameKey: 'boldTemplate', icon: 'flash_on', descKey: 'boldTemplateDesc' },
    { id: 'classic', nameKey: 'classicTemplate', icon: 'menu_book', descKey: 'classicTemplateDesc' },
]

const TOTAL_STEPS = 3
const SMART_DEFAULT_KEYS = ['currencyDefault', 'gstDefault', 'codDefault'] as const

function isSiteTypeAvailable(type: SiteTypeOption) {
    return type.availability === 'available'
}

function siteTypeStatusLabel(type: SiteTypeOption, t: Record<string, string>) {
    return type.availability === 'available' ? t.availableNow : t.comingSoon
}

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
    const { isDark, toggleTheme } = useAuthTheme()
    const [lang, setLang] = useState<Lang>('en')

    // User dropdown
    const [showUserMenu, setShowUserMenu] = useState(false)

    const t = translations[lang]

    /* ——— Initialize theme & language from localStorage ——— */
    useEffect(() => {

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
                    setUser(null)
                }
            })
            .catch(() => {
                setUser(null)
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
    if (authLoading) {
        return (
            <div className="auth-container">
                <div className="auth-card onboard-card">
                    <div className="auth-logo">
                        <BrandLogo />
                    </div>
                    <div className="onboard-spinner" />
                    <p className="auth-subtitle">Loading...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="auth-container">
                <div className="auth-card onboard-card">
                    <div className="auth-logo">
                        <BrandLogo />
                    </div>
                    <h1 className="auth-title">Sign in to continue</h1>
                    <p className="auth-subtitle">Your session expired. Log in again to create your site.</p>
                    <Button unstyled className="auth-btn-primary" onClick={() => { window.location.href = '/lookup' }}>
                        Log in
                    </Button>
                </div>
            </div>
        )
    }

    /* ——— Success state ——— */
    if (success) {
        const selectedSiteType = ACQUISITION_SITE_TYPES.find((st) => st.id === siteType)
        const selectedSiteTypeLabel = selectedSiteType ? t[selectedSiteType.nameKey] : 'site'
        const dashboardUrl = getAdminDashboardUrl(subdomain)

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

                <div className="auth-card onboard-card">
                    <div className="auth-logo">
                        <BrandLogo />
                    </div>
                    <div className="onboard-success">
                        <Badge label={t.successBadge} variant="success" />
                        <h1 className="auth-title">{t.successTitle}</h1>
                        <p className="auth-subtitle">{t.successDesc}</p>
                        <DescriptionList
                            className="mt-4 text-left"
                            items={[
                                { term: t.siteTypeLabel, description: <strong>{selectedSiteTypeLabel}</strong> },
                                { term: t.subdomainLabel, description: <strong className="break-all">{subdomain}.letbuyy.com</strong> },
                            ]}
                        />
                        <Banner title={t.successNext} variant="success" className="mt-4 text-left">
                            {t.redirecting}
                        </Banner>
                        <div className="onboard-btn-row">
                            <Button
                                type="button"
                                fullWidth
                                onClick={() => {
                                    window.location.href = dashboardUrl
                                }}
                            >
                                {t.dashboardCta}
                                <AuthIcon name="arrow_forward" size={18} />
                            </Button>
                        </div>
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

            <div className="auth-card onboard-card">
                {/* Logo */}
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                <div className="onboard-progress-card">
                    <div className="onboard-progress-row">
                        <span className="onboard-guided-pill">
                            <AuthIcon name="info" size={15} />
                            {t.guidedSetup}
                        </span>
                        <span className="onboard-step-count">Step {Math.min(step, TOTAL_STEPS)} of {TOTAL_STEPS}</span>
                    </div>
                    <div className="onboard-progress-track" aria-label={step === 1 ? t.stepType : step === 2 ? t.stepDetails : t.stepReview}>
                        <span className={`onboard-progress-fill step-${Math.min(step, TOTAL_STEPS)}`} />
                    </div>
                    <div className="onboard-progress-labels">
                        {[t.stepType, t.stepDetails, t.stepReview].map((label, index) => (
                            <span key={label} className={index + 1 === Math.min(step, TOTAL_STEPS) ? 'active' : undefined}>
                                {label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="auth-error" role="alert" aria-live="assertive">
                        <AuthIcon name="error" size={16} style={{ marginRight: 6 }} />
                        {error}
                    </div>
                )}

                {/* ——— STEP 1: Choose type ——— */}
                {step === 1 && (
                    <>
                        <h1 className="auth-title">{t.whatBuild}</h1>
                        <p className="auth-subtitle">{t.chooseSite}</p>

                        <div className="onboard-bento-grid">
                            {ACQUISITION_SITE_TYPES.map((type) => (
                                <Button unstyled
                                    key={type.id}
                                    type="button"
                                    className={[
                                        'onboard-bento-card',
                                        type.id === 'store' ? 'primary' : 'compact',
                                        siteType === type.id ? 'selected' : '',
                                        !isSiteTypeAvailable(type) ? 'locked' : '',
                                    ].filter(Boolean).join(' ')}
                                    aria-disabled={!isSiteTypeAvailable(type)}
                                    disabled={!isSiteTypeAvailable(type)}
                                    onClick={() => {
                                        if (!isSiteTypeAvailable(type)) {
                                            return
                                        }

                                        setError(null)
                                        setSiteType(type.id)
                                        setGoal('sell')
                                        setTeamSize('solo')
                                        setTemplate('modern')
                                        setStep(2)
                                    }}
                                >
                                    <span className="onboard-bento-topline">
                                        <span className="onboard-type-icon">
                                            <AuthIcon name={type.icon} size={type.id === 'store' ? 30 : 24} />
                                        </span>
                                        <span className={`onboard-type-status ${type.availability}`}>
                                            {type.availability !== 'available' && <AuthIcon name="lock" size={13} />}
                                            {siteTypeStatusLabel(type, t)}
                                        </span>
                                    </span>
                                    <span className="onboard-type-name">{t[type.nameKey]}</span>
                                    <span className="onboard-type-desc">
                                        {isSiteTypeAvailable(type) ? t[type.descKey] : t.lockedType}
                                    </span>
                                    {type.id === 'store' && (
                                        <span className="onboard-store-includes">
                                            {t.storeIncludes}
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>
                    </>
                )}

                {/* ——— STEP 2: Name & subdomain ——— */}
                {step === 2 && (
                    <>
                        <h1 className="auth-title">{t.nameSite}</h1>
                        <p className="auth-subtitle">{t.storeUrl}</p>

                        <Banner title={t.smartDefaults} variant="info" className="mb-[var(--lb-space-4)]">
                            {t.smartDefaultsDesc}
                        </Banner>

                        {/* Display name (optional) */}
                        <div className="mb-[var(--lb-space-4)] grid gap-[var(--lb-space-2)]">
                            <label
                                htmlFor="store-display-name"
                                className="block text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]"
                            >
                                {t.displayName}
                            </label>
                            <Input
                                id="store-display-name"
                                type="text"
                                placeholder={t.displayPlaceholder}
                                value={storeName}
                                onChange={(e) => setStoreName(e.target.value)}
                            />
                        </div>

                        {/* Subdomain */}
                        <div className="grid gap-[var(--lb-space-1)]">
                            <label className="text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]">
                                {t.subdomain}
                            </label>
                            <div
                                className={`onboard-subdomain-wrapper ${validation
                                    ? validation.valid
                                        ? 'valid'
                                        : 'invalid'
                                    : ''
                                    }`}
                            >
                                <Input unstyled
                                    type="text"
                                    className="onboard-subdomain-input"
                                    placeholder={t.subdomainPlaceholder}
                                    value={subdomain}
                                    onChange={(e) => onSubdomainChange(e.target.value)}
                                    maxLength={63}
                                    autoFocus
                                />
                                <span className="onboard-subdomain-suffix">.letbuyy.com</span>
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
                            <Button unstyled
                                className="auth-btn-secondary"
                                onClick={() => setStep(1)}
                            >
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </Button>
                            <Button unstyled
                                className="auth-btn"
                                onClick={() => validation?.valid && setStep(3)}
                                disabled={!validation?.valid}
                            >
                                {t.next}
                                <AuthIcon name="arrow_forward" size={18} style={{ marginLeft: 4 }} />
                            </Button>
                        </div>
                    </>
                )}

                {/* ——— STEP 3: Review & create ——— */}
                {step === 3 && (
                    <>
                        <h1 className="auth-title">{t.confirmTitle}</h1>
                        <p className="auth-subtitle">{t.confirmDesc}</p>

                        <div className="mb-[var(--lb-space-4)] grid gap-[var(--lb-space-2)]">
                            {SMART_DEFAULT_KEYS.map((key) => (
                                <Badge key={key} label={t[key]} variant="success" />
                            ))}
                        </div>

                        <DescriptionList
                            className="mb-6"
                            items={[
                                {
                                    term: t.siteTypeLabel,
                                    description: <strong>{siteType ? t[ACQUISITION_SITE_TYPES.find(s => s.id === siteType)?.nameKey || 'store'] : '—'}</strong>,
                                },
                                {
                                    term: t.displayName,
                                    description: <strong>{storeName.trim() || subdomain}</strong>,
                                },
                                {
                                    term: t.subdomainLabel,
                                    description: <strong className="break-all">{subdomain}.letbuyy.com</strong>,
                                },
                            ]}
                        />

                        <div className="onboard-btn-row">
                            <Button unstyled className="auth-btn-secondary" onClick={() => setStep(2)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </Button>
                            <Button
                                type="button"
                                loading={loading}
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {t.confirm}
                                {!loading && (
                                    <span className="ml-[var(--lb-space-1)] inline-flex">
                                        <AuthIcon name="rocket_launch" size={18} />
                                    </span>
                                )}
                            </Button>
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
                                    <Button unstyled
                                        key={g.id}
                                        className={`onboard-type-card ${goal === g.id ? 'selected' : ''}`}
                                        onClick={() => setGoal(g.id)}
                                        style={{ padding: '12px 16px', textAlign: 'left' }}
                                    >
                                        <AuthIcon name={g.icon} size={20} style={{ marginRight: 8 }} />
                                        <span style={{ fontSize: 13 }}>{g.label}</span>
                                    </Button>
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
                                    <Button unstyled
                                        key={ts.id}
                                        className={`onboard-type-card ${teamSize === ts.id ? 'selected' : ''}`}
                                        onClick={() => setTeamSize(ts.id)}
                                        style={{ padding: '10px 16px', fontSize: 13 }}
                                    >
                                        {ts.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="onboard-btn-row">
                            <Button unstyled className="auth-btn-secondary" onClick={() => setStep(3)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </Button>
                            <Button unstyled className="auth-btn" onClick={() => setStep(5)}>
                                {t.next}
                                <AuthIcon name="arrow_forward" size={18} style={{ marginLeft: 4 }} />
                            </Button>
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
                            <Button unstyled className="auth-btn-secondary" onClick={() => setStep(4)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </Button>
                            <Button unstyled className="auth-btn-secondary" onClick={() => setStep(6)}>
                                {t.aiSkip}
                            </Button>
                            <Button unstyled className="auth-btn" onClick={() => setStep(6)} disabled={!aiDescription.trim()}>
                                {t.aiGenerate}
                                <AuthIcon name="auto_awesome" size={18} style={{ marginLeft: 4 }} />
                            </Button>
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
                                    {siteType ? t[ACQUISITION_SITE_TYPES.find(s => s.id === siteType)?.nameKey || 'store'] : '—'}
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
                                    {subdomain}.letbuyy.com
                                </span>
                            </div>
                        </div>

                        <div className="onboard-btn-row">
                            <Button unstyled className="auth-btn-secondary" onClick={() => setStep(5)}>
                                <AuthIcon name="arrow_back" size={18} style={{ marginRight: 4 }} />
                                {t.back}
                            </Button>
                            <Button unstyled
                                className="auth-btn"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="onboard-spinner" style={{ borderTopColor: 'white' }} />
                                        {t.creating}
                                    </>
                                ) : (
                                    <>
                                        {t.confirm}
                                        <AuthIcon name="rocket_launch" size={18} style={{ marginLeft: 4 }} />
                                    </>
                                )}
                            </Button>
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
            <Button unstyled onClick={onCycleLang} className="auth-lang-btn">
                {lang.toUpperCase()}
            </Button>
            <Button unstyled onClick={onToggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
            </Button>
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
