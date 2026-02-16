'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'

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
        mismatch: 'Passwords do not match',
        sessionExpired: 'Session expired. Please verify your email again.',
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
        mismatch: 'पासवर्ड मेल नहीं खाते',
        sessionExpired: 'सत्र समाप्त। कृपया अपना ईमेल पुनः सत्यापित करें।',
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
        mismatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',
        sessionExpired: 'அமர்வு காலாவதியானது. உங்கள் மின்னஞ்சலை மீண்டும் சரிபார்க்கவும்.',
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
            setError('Something went wrong. Please try again.')
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
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>{isDark ? 'light_mode' : 'dark_mode'}</span>
                </button>
            </div>

            <div className="auth-card">
                {/* No logo on set-password */}

                <div className="auth-success-badge"><span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>check_circle</span> {t.verified}</div>

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">
                    {t.subtitle} <strong>{userEmail}</strong>
                </p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="newPassword">{t.password}</label>
                        <div className="auth-password-wrapper">
                            <input
                                id="newPassword"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                autoFocus
                                required
                            />
                            <button
                                type="button"
                                className="auth-toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>

                        {/* Password strength indicators */}
                        <div className="auth-password-rules">
                            <div className={`auth-rule ${rules.minLength ? 'valid' : 'invalid'}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>{rules.minLength ? 'check_circle' : 'cancel'}</span> {t.minLength}
                            </div>
                            <div className={`auth-rule ${rules.hasUppercase ? 'valid' : 'invalid'}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>{rules.hasUppercase ? 'check_circle' : 'cancel'}</span> {t.hasUppercase}
                            </div>
                            <div className={`auth-rule ${rules.hasNumber ? 'valid' : 'invalid'}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>{rules.hasNumber ? 'check_circle' : 'cancel'}</span> {t.hasNumber}
                            </div>
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="confirmPassword">{t.confirmPassword}</label>
                        <div className="auth-password-wrapper">
                            <input
                                id="confirmPassword"
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="auth-toggle-password"
                                onClick={() => setShowConfirm(!showConfirm)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showConfirm ? 'visibility_off' : 'visibility'}</span>
                            </button>
                        </div>
                        {confirmPassword && !passwordsMatch && (
                            <div className="auth-rule invalid">{t.mismatch}</div>
                        )}
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <button
                        type="submit"
                        className="auth-btn-primary"
                        disabled={loading || !isValid || !passwordsMatch}
                    >
                        {loading ? '...' : t.create}
                    </button>
                </form>

                <button className="auth-link-btn" onClick={handleSkip}>
                    {t.skip}
                </button>
            </div>
        </main>
    )
}

export default function SetPasswordPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-hint)' }}>Loading...</p></div></div>}>
            <SetPasswordContent />
        </Suspense>
    )
}
