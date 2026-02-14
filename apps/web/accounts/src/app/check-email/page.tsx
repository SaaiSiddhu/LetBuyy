'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Check your email',
        verifyMsg: 'We sent a verification link to',
        magicMsg: 'We sent a login link to',
        instruction: 'Click the link in the email to continue.',
        openEmail: 'Open email app',
        didntReceive: "Didn't receive the email?",
        resend: 'Resend email',
        tryDifferent: 'Try a different email',
        expires: 'The link will expire in',
        oneHour: '1 hour',
        fifteenMin: '15 minutes',
    },
    hi: {
        title: 'अपना ईमेल जांचें',
        verifyMsg: 'हमने एक सत्यापन लिंक भेजा है',
        magicMsg: 'हमने एक लॉगिन लिंक भेजा है',
        instruction: 'जारी रखने के लिए ईमेल में लिंक पर क्लिक करें।',
        openEmail: 'ईमेल ऐप खोलें',
        didntReceive: 'ईमेल नहीं मिला?',
        resend: 'ईमेल पुनः भेजें',
        tryDifferent: 'दूसरा ईमेल आज़माएं',
        expires: 'लिंक समाप्त हो जाएगा',
        oneHour: '1 घंटे में',
        fifteenMin: '15 मिनट में',
    },
    ta: {
        title: 'உங்கள் மின்னஞ்சலைச் சரிபார்க்கவும்',
        verifyMsg: 'சரிபார்ப்பு இணைப்பை அனுப்பியுள்ளோம்',
        magicMsg: 'உள்நுழைவு இணைப்பை அனுப்பியுள்ளோம்',
        instruction: 'தொடர மின்னஞ்சலில் உள்ள இணைப்பைக் கிளிக் செய்யவும்.',
        openEmail: 'மின்னஞ்சல் ஆப்பைத் திறக்கவும்',
        didntReceive: 'மின்னஞ்சல் வரவில்லையா?',
        resend: 'மின்னஞ்சலை மீண்டும் அனுப்பவும்',
        tryDifferent: 'வேறு மின்னஞ்சலை முயற்சிக்கவும்',
        expires: 'இணைப்பு காலாவதியாகும்',
        oneHour: '1 மணி நேரத்தில்',
        fifteenMin: '15 நிமிடங்களில்',
    },
}

function CheckEmailContent() {
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''
    const type = searchParams.get('type') || 'email_verify'

    const [countdown, setCountdown] = useState(60)
    const [canResend, setCanResend] = useState(false)
    const [resending, setResending] = useState(false)
    const [isDark, setIsDark] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]

    useEffect(() => {
        const savedTheme = localStorage.getItem('letbuyy_theme')
        setIsDark(savedTheme === 'dark')
        const savedLang = (localStorage.getItem('letbuyy_lang') as Lang) || 'en'
        setLang(savedLang)
    }, [])

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        } else {
            setCanResend(true)
        }
    }, [countdown])

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

    const handleResend = async () => {
        if (!canResend || resending) return
        setResending(true)

        try {
            const endpoint = type === 'magic_link' ? '/api/auth/send-magic' : '/api/auth/signup'
            await fetch(endpoint, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email, turnstileToken: 'resend-bypass' }),
            })

            // Reset countdown
            setCountdown(60)
            setCanResend(false)
        } catch {
            // Silently fail
        } finally {
            setResending(false)
        }
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
                {/* No logo on check-email */}

                <div className="auth-icon"><span className="material-symbols-outlined" style={{ fontSize: 36 }}>mail</span></div>

                <h1 className="auth-title">{t.title}</h1>

                <p className="auth-message">
                    {type === 'magic_link' ? t.magicMsg : t.verifyMsg}{' '}
                    <strong>{email}</strong>
                </p>

                <p className="auth-message-secondary">
                    {t.instruction}<br />
                    {t.expires} {type === 'magic_link' ? t.fifteenMin : t.oneHour}.
                </p>

                <a
                    href={`mailto:${email}`}
                    className="auth-btn-primary"
                    style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
                >
                    {t.openEmail} ↗
                </a>

                <div className="auth-resend-section">
                    <p className="auth-hint">{t.didntReceive}</p>

                    <button
                        className="auth-btn-secondary"
                        onClick={handleResend}
                        disabled={!canResend || resending}
                    >
                        {canResend
                            ? (resending ? '...' : t.resend)
                            : `${t.resend} (${countdown}s)`
                        }
                    </button>
                </div>

                <a href={type === 'magic_link' ? '/lookup' : '/signup'} className="auth-link-btn">
                    {t.tryDifferent}
                </a>
            </div>
        </main>
    )
}

export default function CheckEmailPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-hint)' }}>Loading...</p></div></div>}>
            <CheckEmailContent />
        </Suspense>
    )
}
