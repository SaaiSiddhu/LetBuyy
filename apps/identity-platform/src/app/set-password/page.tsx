'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon } from '@/components/AuthIcon'
import { Badge, Banner, Button, Input, ProgressBar } from '@letbuyy/ui'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        verified: 'Email verified!',
        title: 'Create your password',
        subtitle: 'Choose a strong password for',
        password: 'Password',
        confirmPassword: 'Confirm password',
        create: 'Create password',
        skip: 'Or skip and use magic links →',
        minLength: 'At least 8 characters',
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
        skip: 'या मैजिक लिंक का उपयोग करें →',
        minLength: 'कम से कम 8 अक्षर',
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
        skip: 'அல்லது மேஜிக் இணைப்புகளைப் பயன்படுத்தவும் →',
        minLength: 'குறைந்தது 8 எழுத்துகள்',
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
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState('')
    const [userId, setUserId] = useState('')
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        // Read userId and email from URL search params (passed from signup OTP step)
        const paramUserId = searchParams.get('userId')
        const paramEmail = searchParams.get('email')

        if (paramUserId && paramEmail) {
            setUserId(paramUserId)
            setUserEmail(paramEmail)
        } else {
            // Fallback: try session (for edge cases like direct navigation)
            fetch('/api/auth/session')
                .then((res) => res.json())
                .then((data) => {
                    if (data.authenticated) {
                        setUserEmail(data.user.email)
                        setUserId(data.user.id)
                    } else {
                        window.location.href = '/lookup'
                    }
                })
                .catch(() => {
                    window.location.href = '/lookup'
                })
        }
    }, [searchParams])

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
        if (!isValid || !passwordsMatch) return

        setLoading(true)
        setError(null)

        try {
            if (!userId || !userEmail) {
                setError(t.sessionExpired)
                return
            }

            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ password, userId, email: userEmail }),
            })

            const data = await res.json()

            if (!res.ok) {
                if (res.status === 401) setError(t.sessionExpired)
                else setError(data.error || 'Failed to set password')
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

    const handleSkip = () => {
        window.location.href = '/onboarding'
    }

    return (
        <main className="auth-container">
            <div className="auth-top-bar">
                <button onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </button>
                <button onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
                </button>
            </div>

            <div className="auth-card">
                {/* No logo on set-password */}

                <div className="flex justify-center">
                    <Badge label={t.verified} variant="success" />
                </div>

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">
                    {t.subtitle} <strong>{userEmail}</strong>
                </p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <Input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        label={t.password}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        helperText={t.secureHint}
                        autoComplete="new-password"
                        autoFocus
                        required
                        rightIcon={
                            <button
                                type="button"
                                className={visibilityButtonClass}
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? t.hidePassword : t.showPassword}
                            >
                                <AuthIcon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
                            </button>
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
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        label={t.confirmPassword}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        error={confirmPassword && !passwordsMatch ? t.mismatch : undefined}
                        required
                        rightIcon={
                            <button
                                type="button"
                                className={visibilityButtonClass}
                                onClick={() => setShowConfirm(!showConfirm)}
                                aria-label={showConfirm ? t.hidePassword : t.showPassword}
                            >
                                <AuthIcon name={showConfirm ? 'visibility_off' : 'visibility'} size={18} />
                            </button>
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
