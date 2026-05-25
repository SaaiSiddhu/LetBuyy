'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon } from '@/components/AuthIcon'

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
        mismatch: 'Passwords do not match',
        expired: 'This reset link has expired.',
        requestNew: 'Request a new link →',
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
        mismatch: 'पासवर्ड मेल नहीं खाते',
        expired: 'यह रीसेट लिंक समाप्त हो गया है।',
        requestNew: 'नया लिंक अनुरोध करें →',
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
        mismatch: 'கடவுச்சொற்கள் பொருந்தவில்லை',
        expired: 'இந்த மீட்டமைப்பு இணைப்பு காலாவதியானது.',
        requestNew: 'புதிய இணைப்பை கோரவும் →',
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
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)
    }, [])

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
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // No token — show expired message
    if (!token) {
        return (
            <main className="auth-container">
                <div className="auth-top-bar">
                    <button onClick={cycleLang} className="auth-lang-btn">{lang.toUpperCase()}</button>
                    <button onClick={toggleTheme} className="auth-theme-btn" aria-label="Toggle theme">
                        <AuthIcon name={isDark ? 'light_mode' : 'dark_mode'} size={16} />
                    </button>
                </div>
                <div className="auth-card">
                    <div className="auth-icon"><AuthIcon name="warning" size={36} /></div>
                    <h1 className="auth-title">{t.expired}</h1>
                    <a href="/forgot-password" className="auth-btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                        {t.requestNew}
                    </a>
                </div>
            </main>
        )
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
                {/* No logo on reset-password */}

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">{t.subtitle}</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="newResetPassword">{t.newPassword}</label>
                        <div className="auth-password-wrapper">
                            <input
                                id="newResetPassword"
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
                                <AuthIcon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
                            </button>
                        </div>

                        <div className="auth-password-rules">
                            <div className={`auth-rule ${rules.minLength ? 'valid' : 'invalid'}`}>
                                <AuthIcon name={rules.minLength ? 'check_circle' : 'cancel'} size={14} style={{ marginRight: 4 }} /> {t.minLength}
                            </div>
                            <div className={`auth-rule ${rules.hasUppercase ? 'valid' : 'invalid'}`}>
                                <AuthIcon name={rules.hasUppercase ? 'check_circle' : 'cancel'} size={14} style={{ marginRight: 4 }} /> {t.hasUppercase}
                            </div>
                            <div className={`auth-rule ${rules.hasNumber ? 'valid' : 'invalid'}`}>
                                <AuthIcon name={rules.hasNumber ? 'check_circle' : 'cancel'} size={14} style={{ marginRight: 4 }} /> {t.hasNumber}
                            </div>
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="confirmResetPassword">{t.confirmPassword}</label>
                        <div className="auth-password-wrapper">
                            <input
                                id="confirmResetPassword"
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
                                <AuthIcon name={showConfirm ? 'visibility_off' : 'visibility'} size={18} />
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
                        {loading ? '...' : t.resetPassword}
                    </button>
                </form>
            </div>
        </main>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-hint)' }}>Loading...</p></div></div>}>
            <ResetPasswordContent />
        </Suspense>
    )
}
