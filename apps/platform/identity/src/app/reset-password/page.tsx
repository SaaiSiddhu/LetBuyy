'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { Badge, Banner, Button, Input, ProgressBar } from '@letbuyy/ui'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Reset your password',
        subtitle: 'Enter a new password for your account.',
        newPassword: 'New password',
        confirmPassword: 'Confirm password',
        resetPassword: 'Reset password',
        minLength: 'At least 8 characters',
        hasUppercase: 'One uppercase letter',
        hasNumber: 'One number',
        strength: 'Password strength',
        secureHint: 'Use a password you do not use on other services.',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
        mismatch: 'Passwords do not match',
        expired: 'This reset link has expired.',
        expiredHelp: 'Request a new password reset link to continue securely.',
        requestNew: 'Request a new link →',
        genericError: 'Something went wrong. Please try again.',
    },
    hi: {
        title: 'अपना पासवर्ड रीसेट करें',
        subtitle: 'अपने अकाउंट के लिए नया पासवर्ड दर्ज करें।',
        newPassword: 'नया पासवर्ड',
        confirmPassword: 'पासवर्ड की पुष्टि करें',
        resetPassword: 'पासवर्ड रीसेट करें',
        minLength: 'कम से कम 8 अक्षर',
        hasUppercase: 'एक बड़ा अक्षर',
        hasNumber: 'एक संख्या',
        strength: 'पासवर्ड मजबूती',
        secureHint: 'ऐसा पासवर्ड उपयोग करें जिसे आप दूसरी services पर उपयोग नहीं करते।',
        showPassword: 'पासवर्ड दिखाएं',
        hidePassword: 'पासवर्ड छिपाएं',
        mismatch: 'पासवर्ड मेल नहीं खाते',
        expired: 'यह रीसेट लिंक समाप्त हो गया है।',
        expiredHelp: 'सुरक्षित रूप से जारी रखने के लिए नया पासवर्ड रीसेट लिंक अनुरोध करें।',
        requestNew: 'नया लिंक अनुरोध करें →',
        genericError: 'कुछ गलत हुआ। कृपया दोबारा प्रयास करें।',
    },
    ta: {
        title: 'உங்கள் கடவுச்சொல்லை மீட்டமைக்கவும்',
        subtitle: 'உங்கள் கணக்கிற்கு புதிய கடவுச்சொல்லை உள்ளிடவும்.',
        newPassword: 'புதிய கடவுச்சொல்',
        confirmPassword: 'கடவுச்சொல்லை உறுதிப்படுத்தவும்',
        resetPassword: 'கடவுச்சொல்லை மீட்டமைக்கவும்',
        minLength: 'குறைந்தது 8 எழுத்துகள்',
        hasUppercase: 'ஒரு பெரிய எழுத்து',
        hasNumber: 'ஒரு எண்',
        strength: 'கடவுச்சொல் வலிமை',
        secureHint: 'மற்ற சேவைகளில் பயன்படுத்தாத கடவுச்சொல்லைப் பயன்படுத்தவும்.',
        showPassword: 'கடவுச்சொல்லைக் காட்டு',
        hidePassword: 'கடவுச்சொல்லை மறை',
        mismatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',
        expired: 'இந்த மீட்டமைப்பு இணைப்பு காலாவதியானது.',
        expiredHelp: 'பாதுகாப்பாக தொடர புதிய கடவுச்சொல் மீட்டமைப்பு இணைப்பைக் கோரவும்.',
        requestNew: 'புதிய இணைப்பை கோரவும் →',
        genericError: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.',
    },
}

function ResetPasswordContent() {
    const searchParams = useSearchParams()
    const token = searchParams.get('token')

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    useEffect(() => {
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)
    }, [])


    const cycleLang = () => {
        const langs: Lang[] = ['en', 'hi', 'ta']
        const next = langs[(langs.indexOf(lang) + 1) % langs.length]
        setLang(next)
        localStorage.setItem('letbuyy_lang', next)
    }

    const rules = useMemo(() => ({
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasNumber: /[0-9]/.test(password),
    }), [password])

    const isValid = rules.minLength && rules.hasUppercase && rules.hasNumber
    const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
    const ruleCount = Object.values(rules).filter(Boolean).length
    const visibilityButtonClass = 'inline-flex h-[var(--lb-density-icon-button-height)] w-[var(--lb-density-icon-button-height)] items-center justify-center rounded-[var(--lb-radius-md)] text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValid || !passwordsMatch || !token) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ token, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Failed to reset password')
                return
            }

            if (data.success) {
                window.location.href = data.redirectTo
            }
        } catch {
            setError(t.genericError)
        } finally {
            setLoading(false)
        }
    }

    // No token — show expired message
    if (!token) {
        return (
            <main className="auth-container">
                <div className="auth-top-bar">
                    <Button unstyled onClick={cycleLang} className="auth-lang-btn">{lang.toUpperCase()}</Button>
                </div>
                <div className="auth-card">
                    <div className="auth-logo">
                        <BrandLogo />
                    </div>
                    <div className="auth-icon"><AuthIcon name="warning" size={36} /></div>
                    <h1 className="auth-title">{t.expired}</h1>
                    <Banner title={t.expired} variant="warning" className="text-left">
                        {t.expiredHelp}
                    </Banner>
                    <Button
                        type="button"
                        fullWidth
                        onClick={() => {
                            window.location.href = '/forgot-password'
                        }}
                    >
                        {t.requestNew}
                    </Button>
                </div>
            </main>
        )
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

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">{t.subtitle}</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <Input
                        id="newResetPassword"
                        type={showPassword ? 'text' : 'password'}
                        label={t.newPassword}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        helperText={t.secureHint}
                        autoComplete="new-password"
                        autoFocus
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
                        <ProgressBar value={ruleCount} max={3} label={t.strength} />
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Badge label={t.minLength} variant={rules.minLength ? 'success' : 'warning'} />
                            <Badge label={t.hasUppercase} variant={rules.hasUppercase ? 'success' : 'warning'} />
                            <Badge label={t.hasNumber} variant={rules.hasNumber ? 'success' : 'warning'} />
                        </div>
                    </div>

                    <Input
                        id="confirmResetPassword"
                        type={showConfirm ? 'text' : 'password'}
                        label={t.confirmPassword}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        error={confirmPassword && !passwordsMatch ? t.mismatch : undefined}
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
                        disabled={loading || !isValid || !passwordsMatch}
                    >
                        {t.resetPassword}
                    </Button>
                </form>
            </div>
        </main>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card"><p className="text-center text-[color:var(--text-hint)]">Loading...</p></div></div>}>
            <ResetPasswordContent />
        </Suspense>
    )
}
