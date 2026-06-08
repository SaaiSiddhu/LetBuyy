'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { useSearchParams } from 'next/navigation'
import TurnstileWidget from '@/components/TurnstileWidget'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { OAuthBrandIcon } from '@/components/OAuthBrandIcon'
import { Button, Input } from '@letbuyy/ui'

type Lang = 'en' | 'hi' | 'ta'
type Step = 'email' | 'otp' | 'password'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Start your free trial',
        subtitle: '14 days free, then ₹20/month',
        email: 'Email',
        emailPlaceholder: 'you@example.com',
        continue: 'Continue',
        or: 'or',
        apple: 'Apple',
        google: 'Google',
        comingSoon: 'Soon',
        alreadyHave: 'Already have an account?',
        logIn: 'Log in',
        terms: 'By proceeding, you agree to the',
        termsLink: 'Terms',
        and: 'and',
        privacyLink: 'Privacy Policy',
        guidedBadge: 'Guided setup',
        stepAccount: 'Account',
        stepVerify: 'Verify',
        stepSecure: 'Secure',
        emailHelper: 'Use the email you will manage your store with.',
        emailValid: 'We will send a 6-digit verification code.',
        emailInvalid: 'Enter a valid email address.',
        actionNeeded: 'Action needed',
        rateLimited: 'Too many signup attempts. Please try again later.',
        // OTP step
        otpTitle: 'Check your email',
        otpSubtitle: 'We sent a 6-digit code to',
        otpResend: 'Resend code',
        otpResendIn: 'Resend in',
        otpVerify: 'Verify',
        otpInvalid: 'Invalid or expired code. Please try again.',
        otpBack: '← Change email',
        // Password step
        pwTitle: 'Create your password',
        pwSubtitle: 'Secure your LetBuyy account',
        pwLabel: 'Password',
        pwConfirmLabel: 'Confirm password',
        pwPlaceholder: 'Enter password',
        pwConfirmPlaceholder: 'Confirm password',
        pwCreate: 'Create account',
        pwRule8: 'At least 8 characters',
        pwRuleUpper: 'One uppercase letter',
        pwRuleLower: 'One lowercase letter',
        pwRuleNumber: 'One number',
        pwRuleSpecial: 'One special character',
        pwMismatch: 'Passwords do not match',
    },
    hi: {
        title: 'अपना मुफ़्त ट्रायल शुरू करें',
        subtitle: '14 दिन मुफ़्त, फिर ₹20/माह',
        email: 'ईमेल',
        emailPlaceholder: 'you@example.com',
        continue: 'जारी रखें',
        or: 'या',
        apple: 'Apple',
        google: 'Google',
        comingSoon: 'जल्द',
        alreadyHave: 'पहले से अकाउंट है?',
        logIn: 'लॉग इन',
        terms: 'आगे बढ़कर, आप सहमत हैं',
        termsLink: 'शर्तें',
        and: 'और',
        privacyLink: 'गोपनीयता नीति',
        guidedBadge: 'मार्गदर्शित सेटअप',
        stepAccount: 'अकाउंट',
        stepVerify: 'सत्यापित',
        stepSecure: 'सुरक्षित',
        emailHelper: 'वह ईमेल इस्तेमाल करें जिससे आप अपना स्टोर संभालेंगे।',
        emailValid: 'हम 6-अंकीय सत्यापन कोड भेजेंगे।',
        emailInvalid: 'सही ईमेल पता दर्ज करें।',
        actionNeeded: 'कार्रवाई चाहिए',
        rateLimited: 'बहुत सारे प्रयास। कृपया बाद में पुनः प्रयास करें।',
        otpTitle: 'अपना ईमेल जांचें',
        otpSubtitle: 'हमने 6-अंकीय कोड भेजा',
        otpResend: 'कोड पुनः भेजें',
        otpResendIn: 'पुनः भेजें',
        otpVerify: 'सत्यापित करें',
        otpInvalid: 'अमान्य या समाप्त कोड। पुनः प्रयास करें।',
        otpBack: '← ईमेल बदलें',
        pwTitle: 'अपना पासवर्ड बनाएं',
        pwSubtitle: 'अपने LetBuyy अकाउंट को सुरक्षित करें',
        pwLabel: 'पासवर्ड',
        pwConfirmLabel: 'पासवर्ड पुष्टि',
        pwPlaceholder: 'पासवर्ड दर्ज करें',
        pwConfirmPlaceholder: 'पासवर्ड पुष्टि करें',
        pwCreate: 'अकाउंट बनाएं',
        pwRule8: 'कम से कम 8 अक्षर',
        pwRuleUpper: 'एक अपरकेस अक्षर',
        pwRuleLower: 'एक लोअरकेस अक्षर',
        pwRuleNumber: 'एक संख्या',
        pwRuleSpecial: 'एक विशेष अक्षर',
        pwMismatch: 'पासवर्ड मेल नहीं खाते',
    },
    ta: {
        title: 'உங்கள் இலவச சோதனையைத் தொடங்குங்கள்',
        subtitle: '14 நாட்கள் இலவசம், பின்னர் ₹20/மாதம்',
        email: 'மின்னஞ்சல்',
        emailPlaceholder: 'you@example.com',
        continue: 'தொடரவும்',
        or: 'அல்லது',
        apple: 'Apple',
        google: 'Google',
        comingSoon: 'விரைவில்',
        alreadyHave: 'ஏற்கனவே கணக்கு உள்ளதா?',
        logIn: 'உள்நுழை',
        terms: 'தொடர்வதன் மூலம், நீங்கள் ஒப்புக்கொள்கிறீர்கள்',
        termsLink: 'விதிமுறைகள்',
        and: 'மற்றும்',
        privacyLink: 'தனியுரிமைக் கொள்கை',
        guidedBadge: 'வழிகாட்டப்பட்ட அமைப்பு',
        stepAccount: 'கணக்கு',
        stepVerify: 'சரிபார்',
        stepSecure: 'பாதுகாப்பு',
        emailHelper: 'உங்கள் கடையை நிர்வகிக்கும் மின்னஞ்சலை பயன்படுத்தவும்.',
        emailValid: '6-இலக்க சரிபார்ப்பு குறியீட்டை அனுப்புவோம்.',
        emailInvalid: 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.',
        actionNeeded: 'நடவடிக்கை தேவை',
        rateLimited: 'பல முயற்சிகள். பிறகு மீண்டும் முயற்சிக்கவும்.',
        otpTitle: 'உங்கள் மின்னஞ்சலைச் சரிபார்க்கவும்',
        otpSubtitle: '6-இலக்க குறியீட்டை அனுப்பினோம்',
        otpResend: 'குறியீட்டை மீண்டும் அனுப்பு',
        otpResendIn: 'மீண்டும் அனுப்பு',
        otpVerify: 'சரிபார்',
        otpInvalid: 'தவறான அல்லது காலாவதியான குறியீடு.',
        otpBack: '← மின்னஞ்சலை மாற்று',
        pwTitle: 'உங்கள் கடவுச்சொல்லை உருவாக்கவும்',
        pwSubtitle: 'உங்கள் LetBuyy கணக்கைப் பாதுகாக்கவும்',
        pwLabel: 'கடவுச்சொல்',
        pwConfirmLabel: 'கடவுச்சொல் உறுதிப்படுத்தல்',
        pwPlaceholder: 'கடவுச்சொல் உள்ளிடவும்',
        pwConfirmPlaceholder: 'கடவுச்சொல் உறுதிப்படுத்தவும்',
        pwCreate: 'கணக்கை உருவாக்கவும்',
        pwRule8: 'குறைந்தது 8 எழுத்துக்கள்',
        pwRuleUpper: 'ஒரு பெரிய எழுத்து',
        pwRuleLower: 'ஒரு சிறிய எழுத்து',
        pwRuleNumber: 'ஒரு எண்',
        pwRuleSpecial: 'ஒரு சிறப்பு எழுத்து',
        pwMismatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',
    },
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function extractLocalDevOtp(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null
    const otp = (payload as { devOtp?: unknown }).devOtp
    return typeof otp === 'string' && /^\d{6}$/.test(otp) ? otp : null
}

function SignupContent() {
    const searchParams = useSearchParams()
    const [step, setStep] = useState<Step>('email')
    const [email, setEmail] = useState('')
    const [emailTouched, setEmailTouched] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

    // OTP state
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [resendTimer, setResendTimer] = useState(60)
    const [canResend, setCanResend] = useState(false)
    const otpRefs = useRef<(HTMLInputElement | null)[]>([])

    // Password state
    const [userId, setUserId] = useState<string | null>(null)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const t = translations[lang]
    const trimmedEmail = email.trim()
    const emailFormatValid = isValidEmail(trimmedEmail)
    const emailError = emailTouched && trimmedEmail.length > 0 && !emailFormatValid ? t.emailInvalid : undefined
    const emailHelper = emailFormatValid ? t.emailValid : t.emailHelper

    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)

        const emailParam = searchParams.get('email')
        if (emailParam) setEmail(emailParam)

        const urlError = searchParams.get('error')
        if (urlError === 'expired_link') setError('Verification link expired. Please sign up again.')
    }, [searchParams])

    // Resend timer countdown
    useEffect(() => {
        if (step !== 'otp' || canResend) return
        const interval = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) {
                    setCanResend(true)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [step, canResend])

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

    // Password validation rules
    const pwRules = {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[^A-Za-z0-9]/.test(password),
    }
    const pwValid = Object.values(pwRules).every(Boolean)
    const pwMatch = password === confirmPassword && confirmPassword.length > 0

    // ——— Step 1: Email Submit ———
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setEmailTouched(true)
        if (!trimmedEmail || !emailFormatValid) return

        setLoading(true)
        setError(null)
        setOtp(['', '', '', '', '', ''])

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    turnstileToken,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                if (res.status === 429) setError(t.rateLimited)
                else if (res.status === 409) {
                    window.location.href = `/lookup?email=${encodeURIComponent(trimmedEmail)}&from=signup`
                    return
                }
                else if (res.status === 403) setError(data.error || 'Verification failed')
                else setError(data.error || 'Something went wrong')
                return
            }

            if (data.needsVerification) {
                const localDevOtp = extractLocalDevOtp(data)
                setStep('otp')
                setResendTimer(60)
                setCanResend(false)

                if (localDevOtp) {
                    setOtp(localDevOtp.split(''))
                    setTimeout(() => {
                        void handleOtpVerify(localDevOtp)
                    }, 300)
                } else {
                    // Focus first OTP input after animation
                    setTimeout(() => otpRefs.current[0]?.focus(), 300)
                }
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ——— Step 2: OTP Input Handlers ———
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return // Only digits

        const newOtp = [...otp]
        newOtp[index] = value.slice(-1) // Single digit
        setOtp(newOtp)

        // Auto-focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus()
        }

        // Auto-submit when all 6 digits entered
        if (value && index === 5) {
            const fullOtp = newOtp.join('')
            if (fullOtp.length === 6) {
                handleOtpVerify(fullOtp)
            }
        }
    }

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
    }

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (pastedData.length === 0) return

        const newOtp = [...otp]
        for (let i = 0; i < pastedData.length; i++) {
            newOtp[i] = pastedData[i]
        }
        setOtp(newOtp)

        // Focus appropriate input
        const nextIndex = Math.min(pastedData.length, 5)
        otpRefs.current[nextIndex]?.focus()

        // Auto-submit if full
        if (pastedData.length === 6) {
            handleOtpVerify(pastedData)
        }
    }

    const handleOtpVerify = async (code?: string) => {
        const otpCode = code || otp.join('')
        if (otpCode.length !== 6) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    otp: otpCode,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || t.otpInvalid)
                setOtp(['', '', '', '', '', ''])
                otpRefs.current[0]?.focus()
                return
            }

            if (data.verified) {
                setUserId(data.userId)
                setStep('password')
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleResendOtp = async () => {
        if (!canResend) return
        setCanResend(false)
        setResendTimer(60)
        setError(null)

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    turnstileToken,
                }),
            })

            const data = await res.json().catch(() => null)
            if (!res.ok) {
                setError(data?.error || 'Unable to resend verification code')
                return
            }

            const localDevOtp = extractLocalDevOtp(data)
            if (localDevOtp) {
                setOtp(localDevOtp.split(''))
                setTimeout(() => {
                    void handleOtpVerify(localDevOtp)
                }, 300)
            }
        } catch {
            // silent
        }
    }

    // ——— Step 3: Password Submit ———
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pwValid || !pwMatch || !userId) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/set-password', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    password,
                    userId,
                    email: email.trim(),
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Something went wrong')
                return
            }

            if (data.redirectTo) {
                window.location.href = data.redirectTo
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleOAuth = useCallback(async (provider: 'google' | 'apple') => {
        setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-up is not configured. Use email sign-up.`)
    }, [])

    const handleTurnstileVerify = useCallback((token: string) => {
        setTurnstileToken(token)
    }, [])

    // ——— Step indicator ———
    const stepNumber = step === 'email' ? 1 : step === 'otp' ? 2 : 3
    const stepLabel = step === 'email' ? t.stepAccount : step === 'otp' ? t.stepVerify : t.stepSecure

    return (
        <main className="auth-container">
            <div className="auth-top-bar">
                <Button unstyled onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </Button>
                <Button unstyled onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                    <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
                </Button>
            </div>

            <div className="auth-card">
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                {/* ——— STEP 1: EMAIL ——— */}
                {step === 'email' && (
                    <div className="auth-step-content" key="email">
                        <h1 className="auth-title">{t.title}</h1>
                        <p className="auth-subtitle">{t.subtitle}</p>

                        <form onSubmit={handleEmailSubmit} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="signupEmail">{t.email}</label>
                                <Input unstyled
                                    id="signupEmail"
                                    type="email"
                                    value={email}
                                    onBlur={() => setEmailTouched(true)}
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                        setError(null)
                                    }}
                                    placeholder={t.emailPlaceholder}
                                    autoComplete="email"
                                    autoFocus
                                    required
                                    aria-invalid={emailError ? true : undefined}
                                    aria-describedby="signupEmail-helper"
                                />
                                <p id="signupEmail-helper" className={emailError ? 'auth-field-error' : 'auth-helper'}>
                                    {emailError || emailHelper}
                                </p>
                            </div>

                            {error && <div className="auth-error"><AuthIcon name="error" />{error}</div>}

                            <Button unstyled
                                type="submit"
                                className="auth-btn-primary"
                                disabled={loading || !emailFormatValid}
                            >
                                {loading ? '...' : t.continue}
                            </Button>
                        </form>

                        <div className="auth-divider">
                            <span>{t.or}</span>
                        </div>

                        <div className="auth-oauth-row">
                            <Button unstyled type="button" className="auth-btn-oauth coming-soon" onClick={(e) => e.preventDefault()} aria-disabled="true">
                                <OAuthBrandIcon provider="apple" className="auth-oauth-brand-icon" />
                                {t.apple}
                                <span className="auth-coming-soon-badge">{t.comingSoon}</span>
                            </Button>
                            <Button unstyled type="button" className="auth-btn-oauth" onClick={() => handleOAuth('google')}>
                                <OAuthBrandIcon provider="google" className="auth-oauth-brand-icon" />
                                {t.google}
                            </Button>
                        </div>

                        <div className="auth-bottom-link">
                            <span>{t.alreadyHave}</span>{' '}
                            <a href="/lookup">{t.logIn}</a>
                        </div>

                        <p className="auth-terms">
                            {t.terms} <a href="#">{t.termsLink}</a> {t.and} <a href="#">{t.privacyLink}</a>
                        </p>

                        <TurnstileWidget onVerify={handleTurnstileVerify} />
                    </div>
                )}

                {/* ——— STEP 2: OTP ——— */}
                {step === 'otp' && (
                    <div className="auth-step-content" key="otp">
                        <div className="auth-step-kicker">Step {stepNumber} of 3 · {stepLabel}</div>

                        <div className="auth-otp-icon">
                            <AuthIcon name="mail" size={32} />
                        </div>

                        <h1 className="auth-title">{t.otpTitle}</h1>
                        <p className="auth-subtitle">
                            {t.otpSubtitle}{' '}
                            <strong>{email}</strong>
                        </p>

                        <div className="auth-otp-inputs" onPaste={handleOtpPaste}>
                            {otp.map((digit, i) => (
                                <Input unstyled
                                    key={i}
                                    ref={el => { otpRefs.current[i] = el }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    className="auth-otp-input"
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>

                        {error && <div className="auth-error"><AuthIcon name="error" />{error}</div>}

                        <Button unstyled
                            type="button"
                            className="auth-btn-primary"
                            disabled={loading || otp.join('').length !== 6}
                            onClick={() => handleOtpVerify()}
                        >
                            {loading ? '...' : t.otpVerify}
                        </Button>

                        <div className="auth-otp-actions">
                            <Button unstyled
                                className="auth-btn-text"
                                onClick={handleResendOtp}
                                disabled={!canResend}
                            >
                                {canResend
                                    ? t.otpResend
                                    : `${t.otpResendIn} ${resendTimer}s`
                                }
                            </Button>
                            <Button unstyled
                                className="auth-btn-text"
                                onClick={() => {
                                    setStep('email')
                                    setOtp(['', '', '', '', '', ''])
                                    setError(null)
                                }}
                            >
                                {t.otpBack}
                            </Button>
                        </div>
                    </div>
                )}

                {/* ——— STEP 3: PASSWORD ——— */}
                {step === 'password' && (
                    <div className="auth-step-content" key="password">
                        <div className="auth-step-kicker">Step {stepNumber} of 3 · {stepLabel}</div>

                        <div className="auth-otp-icon">
                            <AuthIcon name="lock" size={32} />
                        </div>

                        <h1 className="auth-title">{t.pwTitle}</h1>
                        <p className="auth-subtitle">{t.pwSubtitle}</p>

                        <form onSubmit={handlePasswordSubmit} className="auth-form">
                            <div className="auth-field">
                                <label htmlFor="signupPassword">{t.pwLabel}</label>
                                <div className="auth-password-wrapper">
                                    <Input unstyled
                                        id="signupPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder={t.pwPlaceholder}
                                        autoComplete="new-password"
                                        autoFocus
                                        required
                                    />
                                    <Button unstyled
                                        type="button"
                                        className="auth-password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        <AuthIcon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
                                    </Button>
                                </div>
                            </div>

                            <div className="auth-field">
                                <label htmlFor="signupConfirmPassword">{t.pwConfirmLabel}</label>
                                <Input unstyled
                                    id="signupConfirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder={t.pwConfirmPlaceholder}
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            {/* Password rules */}
                            <div className="auth-pw-rules">
                                <div className={`auth-pw-rule ${pwRules.minLength ? 'pass' : ''}`}>
                                    <AuthIcon name={pwRules.minLength ? 'check_circle' : 'radio_button_unchecked'} size={16} />
                                    {t.pwRule8}
                                </div>
                                <div className={`auth-pw-rule ${pwRules.hasUppercase ? 'pass' : ''}`}>
                                    <AuthIcon name={pwRules.hasUppercase ? 'check_circle' : 'radio_button_unchecked'} size={16} />
                                    {t.pwRuleUpper}
                                </div>
                                <div className={`auth-pw-rule ${pwRules.hasLowercase ? 'pass' : ''}`}>
                                    <AuthIcon name={pwRules.hasLowercase ? 'check_circle' : 'radio_button_unchecked'} size={16} />
                                    {t.pwRuleLower}
                                </div>
                                <div className={`auth-pw-rule ${pwRules.hasNumber ? 'pass' : ''}`}>
                                    <AuthIcon name={pwRules.hasNumber ? 'check_circle' : 'radio_button_unchecked'} size={16} />
                                    {t.pwRuleNumber}
                                </div>
                                <div className={`auth-pw-rule ${pwRules.hasSpecial ? 'pass' : ''}`}>
                                    <AuthIcon name={pwRules.hasSpecial ? 'check_circle' : 'radio_button_unchecked'} size={16} />
                                    {t.pwRuleSpecial}
                                </div>
                            </div>

                            {confirmPassword && !pwMatch && <div className="auth-error"><AuthIcon name="error" />{t.pwMismatch}</div>}

                            {error && <div className="auth-error"><AuthIcon name="error" />{error}</div>}

                            <Button unstyled
                                type="submit"
                                className="auth-btn-primary"
                                disabled={loading || !pwValid || !pwMatch}
                            >
                                {loading ? '...' : t.pwCreate}
                            </Button>
                        </form>
                    </div>
                )}
            </div>
        </main>
    )
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card"><p className="auth-loading">Loading...</p></div></div>}>
            <SignupContent />
        </Suspense>
    )
}
