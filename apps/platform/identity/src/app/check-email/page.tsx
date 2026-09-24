'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import { Banner, Button, ProgressBar } from '@letbuyy/ui'

type Lang = 'en' | 'hi' | 'ta'

const translations: Record<Lang, Record<string, string>> = {
    en: {
        title: 'Check your email',
        verifyMsg: 'We sent a verification link to',
        magicMsg: 'We sent a login link to',
        resetMsg: 'We sent a password reset link to',
        instruction: 'Click the link in the email to continue.',
        openEmail: 'Open email app',
        didntReceive: "Didn't receive the email?",
        resend: 'Resend email',
        tryDifferent: 'Try a different email',
        expires: 'The link will expire in',
        oneHour: '1 hour',
        fifteenMin: '15 minutes',
        statusVerify: 'Email verification',
        statusMagic: 'Magic link',
        statusReset: 'Password reset',
        resendReady: 'Ready to resend',
        resendWait: 'Resend cooldown',
    },
    hi: {
        title: 'अपना ईमेल जांचें',
        verifyMsg: 'हमने एक सत्यापन लिंक भेजा है',
        magicMsg: 'हमने एक लॉगिन लिंक भेजा है',
        resetMsg: 'हमने पासवर्ड रीसेट लिंक भेजा है',
        instruction: 'जारी रखने के लिए ईमेल में लिंक पर क्लिक करें।',
        openEmail: 'ईमेल ऐप खोलें',
        didntReceive: 'ईमेल नहीं मिला?',
        resend: 'ईमेल पुनः भेजें',
        tryDifferent: 'दूसरा ईमेल आज़माएं',
        expires: 'लिंक समाप्त हो जाएगा',
        oneHour: '1 घंटे में',
        fifteenMin: '15 मिनट में',
        statusVerify: 'ईमेल सत्यापन',
        statusMagic: 'मैजिक लिंक',
        statusReset: 'पासवर्ड रीसेट',
        resendReady: 'फिर से भेजने के लिए तैयार',
        resendWait: 'रीसेंड cooldown',
    },
    ta: {
        title: 'உங்கள் மின்னஞ்சலைச் சரிபார்க்கவும்',
        verifyMsg: 'சரிபார்ப்பு இணைப்பை அனுப்பியுள்ளோம்',
        magicMsg: 'உள்நுழைவு இணைப்பை அனுப்பியுள்ளோம்',
        resetMsg: 'கடவுச்சொல் மீட்டமைப்பு இணைப்பை அனுப்பியுள்ளோம்',
        instruction: 'தொடர மின்னஞ்சலில் உள்ள இணைப்பைக் கிளிக் செய்யவும்.',
        openEmail: 'மின்னஞ்சல் ஆப்பைத் திறக்கவும்',
        didntReceive: 'மின்னஞ்சல் வரவில்லையா?',
        resend: 'மின்னஞ்சலை மீண்டும் அனுப்பவும்',
        tryDifferent: 'வேறு மின்னஞ்சலை முயற்சிக்கவும்',
        expires: 'இணைப்பு காலாவதியாகும்',
        oneHour: '1 மணி நேரத்தில்',
        fifteenMin: '15 நிமிடங்களில்',
        statusVerify: 'மின்னஞ்சல் சரிபார்ப்பு',
        statusMagic: 'மேஜிக் இணைப்பு',
        statusReset: 'கடவுச்சொல் மீட்டமைப்பு',
        resendReady: 'மீண்டும் அனுப்ப தயாராக உள்ளது',
        resendWait: 'மீண்டும் அனுப்பும் இடைவேளை',
    },
}

function CheckEmailContent() {
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''
    const type = searchParams.get('type') || 'email_verify'

    const [countdown, setCountdown] = useState(60)
    const [canResend, setCanResend] = useState(false)
    const [resending, setResending] = useState(false)
    const [lang, setLang] = useState<Lang>('en')

    const t = translations[lang]
    const flowLabel = type === 'magic_link' ? t.statusMagic : type === 'password_reset' ? t.statusReset : t.statusVerify
    const message = type === 'magic_link' ? t.magicMsg : type === 'password_reset' ? t.resetMsg : t.verifyMsg
    const expiry = type === 'magic_link' ? t.fifteenMin : t.oneHour
    const resendProgress = Math.max(0, Math.min(60, 60 - countdown))

    useEffect(() => {
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
                <Button unstyled onClick={cycleLang} className="auth-lang-btn">
                    {lang.toUpperCase()}
                </Button>
            </div>

            <div className="auth-card">
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                <div className="auth-icon"><AuthIcon name="mail" size={36} /></div>

                <h1 className="auth-title">{t.title}</h1>

                <div className="grid gap-[var(--lb-space-3)]">
                    <p className="auth-flow-label">{flowLabel}</p>

                    <Banner title={message} variant="info" className="text-left">
                        <strong>{email}</strong>
                        <br />
                        {t.instruction} {t.expires} {expiry}.
                    </Banner>

                    <Button
                        type="button"
                        fullWidth
                        onClick={() => {
                            window.location.href = `mailto:${email}`
                        }}
                    >
                        <AuthIcon name="mail" size={16} />
                        {t.openEmail}
                    </Button>
                </div>

                <div className="auth-resend-section">
                    <p className="auth-hint">{t.didntReceive}</p>

                    <ProgressBar
                        value={resendProgress}
                        max={60}
                        label={canResend ? t.resendReady : t.resendWait}
                    />

                    <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        loading={resending}
                        onClick={handleResend}
                        disabled={!canResend || resending}
                    >
                        {canResend
                            ? t.resend
                            : `${t.resend} (${countdown}s)`
                        }
                    </Button>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                        window.location.href = type === 'magic_link' ? '/lookup' : '/signup'
                    }}
                >
                    {t.tryDifferent}
                </Button>
            </div>
        </main>
    )
}

export default function CheckEmailPage() {
    return (
        <Suspense fallback={<div className="auth-container"><div className="auth-card"><p className="text-center text-[color:var(--text-hint)]">Loading...</p></div></div>}>
            <CheckEmailContent />
        </Suspense>
    )
}
