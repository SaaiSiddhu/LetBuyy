'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { safePlatformReturnTo, authPathWithReturnTo, accountResultPath } from '@/lib/auth/return-to'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { validatePasswordStrength } from '@/lib/auth/password'
import { Badge, Banner, Button, Input, ProgressBar } from '@letbuyy/ui'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        verified: 'Email verified!',
        title: 'Create your password',
        subtitle: 'Choose a strong password for your LetBuyy account.',
        password: 'Password',
        confirmPassword: 'Confirm password',
        create: 'Create password',
        skip: 'Back to login',
        retryContext: 'Try again',
        contextFailed: 'Unable to check your email verification. Please try again.',
        rateLimited: 'Too many attempts. Please wait before trying again.',
        minLength: 'At least 8 characters',
        maxLength: 'At most 128 characters',
        hasLowercase: 'One lowercase letter',
        hasSpecial: 'One symbol',
        hasUppercase: 'One uppercase letter',
        hasNumber: 'One number',
        strength: 'Password strength',
        secureHint: 'This password protects your merchant workspace.',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
        mismatch: 'Passwords do not match',
        sessionExpired: 'Session expired. Please verify your email again.',
        genericError: 'Something went wrong. Please try again.',
    },
    hi: {
        verified: 'ईमेल सत्यापित!',
        title: 'अपना पासवर्ड बनाएं',
        subtitle: 'के लिए एक मजबूत पासवर्ड चुनें',
        password: 'पासवर्ड',
        confirmPassword: 'पासवर्ड की पुष्टि करें',
        create: 'पासवर्ड बनाएं',
        skip: 'लॉगिन पर वापस जाएं',
        retryContext: 'फिर कोशिश करें',
        contextFailed: 'ईमेल सत्यापन की जाँच नहीं हो सकी। फिर कोशिश करें।',
        rateLimited: 'बहुत अधिक प्रयास। थोड़ी देर बाद फिर कोशिश करें।',
        minLength: 'कम से कम 8 अक्षर',
        maxLength: 'अधिकतम 128 अक्षर',
        hasLowercase: 'एक छोटा अक्षर',
        hasSpecial: 'एक विशेष चिह्न',
        hasUppercase: 'एक बड़ा अक्षर',
        hasNumber: 'एक संख्या',
        strength: 'पासवर्ड मजबूती',
        secureHint: 'यह पासवर्ड आपके merchant workspace को सुरक्षित रखता है।',
        showPassword: 'पासवर्ड दिखाएं',
        hidePassword: 'पासवर्ड छिपाएं',
        mismatch: 'पासवर्ड मेल नहीं खाते',
        sessionExpired: 'सत्र समाप्त। कृपया अपना ईमेल पुनः सत्यापित करें।',
        genericError: 'कुछ गलत हुआ। कृपया दोबारा प्रयास करें।',
    },
    ta: {
        verified: 'மின்னஞ்சல் சரிபார்க்கப்பட்டது!',
        title: 'உங்கள் கடவுச்சொல்லை உருவாக்கவும்',
        subtitle: 'ற்கு வலுவான கடவுச்சொல்லைத் தேர்ந்தெடுக்கவும்',
        password: 'கடவுச்சொல்',
        confirmPassword: 'கடவுச்சொல்லை உறுதிப்படுத்தவும்',
        create: 'கடவுச்சொல்லை உருவாக்கவும்',
        skip: 'உள்நுழைவுக்குத் திரும்பு',
        retryContext: 'மீண்டும் முயற்சி',
        contextFailed: 'மின்னஞ்சல் சரிபார்ப்பைச் சரிபார்க்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
        rateLimited: 'மிக அதிக முயற்சிகள். சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
        minLength: 'குறைந்தது 8 எழுத்துகள்',
        maxLength: 'அதிகபட்சம் 128 எழுத்துகள்',
        hasLowercase: 'ஒரு சிறிய எழுத்து',
        hasSpecial: 'ஒரு குறியீடு',
        hasUppercase: 'ஒரு பெரிய எழுத்து',
        hasNumber: 'ஒரு எண்',
        strength: 'கடவுச்சொல் வலிமை',
        secureHint: 'இந்த கடவுச்சொல் உங்கள் merchant workspace-ஐ பாதுகாக்கிறது.',
        showPassword: 'கடவுச்சொல்லைக் காட்டு',
        hidePassword: 'கடவுச்சொல்லை மறை',
        mismatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',
        sessionExpired: 'அமர்வு காலாவதியானது. உங்கள் மின்னஞ்சலை மீண்டும் சரிபார்க்கவும்.',
        genericError: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.',
    },
}

function SetPasswordContent() {
    const searchParams = useSearchParams()
    const returnTo = safePlatformReturnTo(searchParams.get('return_to'))
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [contextReady, setContextReady] = useState(false)
    const [checkingContext, setCheckingContext] = useState(true)
    const [contextError, setContextError] = useState<'expired' | 'unavailable' | null>(null)
    const [contextAttempt, setContextAttempt] = useState(0)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    useEffect(() => {
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(['en', 'hi', 'ta'].includes(savedLang) ? savedLang : 'en')
        let retired = false
        setCheckingContext(true)
        setContextReady(false)
        setContextError(null)

        // This is an advisory check of the HTTP-only verified intent cookie.
        // The POST still atomically consumes the database intent as authority.
        fetch('/api/auth/set-password', { cache: 'no-store' })
            .then(async (res) => {
                const data = await res.json()
                if (retired) return
                if (res.ok && data.canSetPassword === true) {
                    setContextReady(true)
                } else {
                    setContextError(res.status === 403 ? 'expired' : 'unavailable')
                }
            })
            .catch(() => {
                if (!retired) setContextError('unavailable')
            })
            .finally(() => {
                if (!retired) setCheckingContext(false)
            })
        return () => { retired = true }
    }, [contextAttempt])


    const cycleLang = () => {
        const langs: Lang[] = ['en', 'hi', 'ta']
        const next = langs[(langs.indexOf(lang) + 1) % langs.length]
        setLang(next)
        localStorage.setItem('letbuyy_lang', next)
    }

    const { rules, isValid } = useMemo(() => validatePasswordStrength(password), [password])
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
    const ruleCount = Object.values(rules).filter(Boolean).length
    const visibilityButtonClass = 'inline-flex h-[var(--lb-density-icon-button-height)] w-[var(--lb-density-icon-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!contextReady || !isValid || !passwordsMatch || loading) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                signal: AbortSignal.timeout(20000),
                headers: (await getAuthHeaders()),
                body: JSON.stringify({ password }),
            })

            const data = await res.json()

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    setContextReady(false)
                    setContextError('expired')
                } else if (res.status === 429) setError(t.rateLimited)
                else setError(t.genericError)
                return
            }

            if (data.success) {
                window.location.href = accountResultPath(data, returnTo)
            } else {
                setError(t.genericError)
            }
        } catch {
            setError(t.genericError)
        } finally {
            setLoading(false)
        }
    }

    const handleSkip = () => {
        window.location.href = authPathWithReturnTo('/lookup', returnTo)
    }

    return (
        <main className="auth-container">
            <div className="auth-top-bar">
                <Button unstyled onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </Button>
            </div>

            <div className="auth-card">
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                {contextReady && <div className="flex justify-center">
                    <Badge label={t.verified} variant="success" />
                </div>}

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">
                    {t.secureHint}
                </p>

                {contextError && <Banner variant="critical">
                    {contextError === 'expired' ? t.sessionExpired : t.contextFailed}
                </Banner>}
                {contextError === 'unavailable' && <Button type="button" fullWidth
                    onClick={() => setContextAttempt(value => value + 1)}>{t.retryContext}</Button>}

                <form onSubmit={handleSubmit} className="auth-form" aria-busy={checkingContext}>
                    <Input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        label={t.password}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        helperText={t.secureHint}
                        autoComplete="new-password"
                        autoFocus
                        disabled={!contextReady || checkingContext}
                        required
                        rightIcon={
                            <Button unstyled
                                type="button"
                                className={visibilityButtonClass}
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? t.hidePassword : t.showPassword}
                            >
                                <AuthIcon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
                            </Button>
                        }
                    />

                    <div className="grid gap-[var(--lb-space-2)]">
                        <ProgressBar value={ruleCount} max={Object.keys(rules).length} label={t.strength} />
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Badge label={t.minLength} variant={rules.minLength ? 'success' : 'warning'} />
                            <Badge label={t.hasUppercase} variant={rules.hasUppercase ? 'success' : 'warning'} />
                            <Badge label={t.hasNumber} variant={rules.hasNumber ? 'success' : 'warning'} />
                            <Badge label={t.hasLowercase} variant={rules.hasLowercase ? 'success' : 'warning'} />
                            <Badge label={t.hasSpecial} variant={rules.hasSpecial ? 'success' : 'warning'} />
                            <Badge label={t.maxLength} variant={rules.maxLength ? 'success' : 'warning'} />
                        </div>
                    </div>

                    <Input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        label={t.confirmPassword}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        error={confirmPassword && !passwordsMatch ? t.mismatch : undefined}
                        disabled={!contextReady || checkingContext}
                        required
                        rightIcon={
                            <Button unstyled
                                type="button"
                                className={visibilityButtonClass}
                                onClick={() => setShowConfirm(!showConfirm)}
                                aria-label={showConfirm ? t.hidePassword : t.showPassword}
                            >
                                <AuthIcon name={showConfirm ? 'visibility_off' : 'visibility'} size={18} />
                            </Button>
                        }
                    />

                    {error && (
                        <Banner variant="critical" className="text-left">
                            {error}
                        </Banner>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        loading={loading}
                        disabled={checkingContext || !contextReady || loading || !isValid || !passwordsMatch}
                    >
                        {t.create}
                    </Button>
                </form>

                <Button type="button" variant="ghost" fullWidth onClick={handleSkip}>
                    {t.skip}
                </Button>
            </div>
        </main>
    )
}

export default function SetPasswordPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card"><p className="text-center text-[color:var(--text-hint)]">Loading...</p></div></div>}>
            <SetPasswordContent />
        </Suspense>
    )
}
