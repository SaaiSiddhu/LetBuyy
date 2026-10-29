'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TurnstileWidget, { type TurnstileHandle } from '@/components/TurnstileWidget'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { Banner, Button, Input } from '@letbuyy/ui'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Forgot password?',
        subtitle: "Enter your email and we'll send you a reset link.",
        email: 'Email',
        emailPlaceholder: 'you@example.com',
        emailHelper: 'Use the email attached to your LetBuyy merchant account.',
        sendResetLink: 'Send reset link',
        backToLogin: 'Back to login',
        privacyNote: 'For your security, we will show the same confirmation even if the email is not registered.',
        rateLimited: 'Too many requests. Please try again later.',
        genericError: 'Something went wrong. Please try again.',
    },
    hi: {
        title: 'पासवर्ड भूल गए?',
        subtitle: 'अपना ईमेल दर्ज करें और हम आपको एक रीसेट लिंक भेजेंगे।',
        email: 'ईमेल',
        emailPlaceholder: 'you@example.com',
        emailHelper: 'अपने LetBuyy merchant account से जुड़ा ईमेल उपयोग करें।',
        sendResetLink: 'रीसेट लिंक भेजें',
        backToLogin: 'लॉगिन पर वापस',
        privacyNote: 'आपकी सुरक्षा के लिए, ईमेल registered न होने पर भी वही confirmation दिखेगा।',
        rateLimited: 'बहुत सारे प्रयास। कृपया बाद में पुनः प्रयास करें।',
        genericError: 'कुछ गलत हुआ। कृपया दोबारा प्रयास करें।',
    },
    ta: {
        title: 'கடவுச்சொல் மறந்துவிட்டதா?',
        subtitle: 'உங்கள் மின்னஞ்சலை உள்ளிடவும், மீட்டமைப்பு இணைப்பை அனுப்புவோம்.',
        email: 'மின்னஞ்சல்',
        emailPlaceholder: 'you@example.com',
        emailHelper: 'உங்கள் LetBuyy merchant account-இன் மின்னஞ்சலைப் பயன்படுத்தவும்.',
        sendResetLink: 'மீட்டமைப்பு இணைப்பை அனுப்பவும்',
        backToLogin: 'உள்நுழைவுக்குத் திரும்பவும்',
        privacyNote: 'பாதுகாப்புக்காக, மின்னஞ்சல் பதிவு செய்யப்படாவிட்டாலும் அதே உறுதிப்படுத்தலை காட்டுவோம்.',
        rateLimited: 'பல முயற்சிகள். பிறகு மீண்டும் முயற்சிக்கவும்.',
        genericError: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.',
    },
}

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lang, setLang] = useState<Lang>('en')
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

    const turnstileRef = useRef<TurnstileHandle>(null)
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
        || process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true'

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

    const handleTurnstileVerify = useCallback((token: string) => {
        setTurnstileToken(token)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim() || loading || (turnstileEnabled && !turnstileToken)) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/send-reset', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: email.trim(),
                    turnstileToken,
                }),
            })

            if (res.status === 429) {
                setError(t.rateLimited)
                return
            }

            if (!res.ok) {
                setError(t.genericError)
                return
            }

            // The server returns the same accepted response for unknown accounts.
            window.location.href = `/check-email?email=${encodeURIComponent(email.trim())}&type=password_reset`
        } catch {
            setError(t.genericError)
        } finally {
            turnstileRef.current?.reset()
            setLoading(false)
        }
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

                <div className="auth-icon"><AuthIcon name="lock" size={36} /></div>

                <h1 className="auth-title">{t.title}</h1>
                <p className="auth-subtitle">{t.subtitle}</p>

                <Banner title={t.email} variant="info" className="text-left">
                    {t.privacyNote}
                </Banner>

                <div className="h-[var(--lb-space-3)]" aria-hidden="true" />

                <form onSubmit={handleSubmit} className="auth-form">
                    <Input
                        id="resetEmail"
                        type="email"
                        label={t.email}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.emailPlaceholder}
                        helperText={t.emailHelper}
                        autoComplete="email"
                        autoFocus
                        required
                    />

                    {error && (
                        <Banner title={t.rateLimited === error ? t.rateLimited : undefined} variant="critical" className="text-left">
                            {error}
                        </Banner>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        loading={loading}
                        disabled={loading || !email.trim() || (turnstileEnabled && !turnstileToken)}
                    >
                        {t.sendResetLink}
                    </Button>
                </form>

                <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                        window.location.href = '/lookup'
                    }}
                >
                    <AuthIcon name="arrow_back" size={16} />
                    {t.backToLogin}
                </Button>

                <TurnstileWidget ref={turnstileRef} onVerify={handleTurnstileVerify} />
            </div>
        </main>
    )
}
