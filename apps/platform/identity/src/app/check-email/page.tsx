'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAuthHeaders } from '@/lib/csrf-client'
import { AuthIcon } from '@/components/AuthIcon'
import { BrandLogo } from '@/components/BrandLogo'
import TurnstileWidget, { type TurnstileHandle } from '@/components/TurnstileWidget'
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
        rateLimited: 'Too many requests. Please wait a few minutes and try again.',
        botFailed: 'Complete verification to resend your email.',
        sendFailed: 'We could not send your email. Please try again.',
        requestFailed: 'Please refresh this page and try again.',
        networkFailed: 'Could not connect. Check your connection and try again.',
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
        rateLimited: 'बहुत सारे अनुरोध। कुछ मिनट बाद फिर कोशिश करें।',
        botFailed: 'ईमेल फिर भेजने के लिए सत्यापन पूरा करें।',
        sendFailed: 'ईमेल नहीं भेज सके। कृपया फिर कोशिश करें।',
        requestFailed: 'कृपया पेज रीफ्रेश करके फिर कोशिश करें।',
        networkFailed: 'कनेक्शन नहीं हो सका। अपना इंटरनेट जांचें और फिर कोशिश करें।',
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
        rateLimited: 'பல கோரிக்கைகள் வந்துள்ளன. சில நிமிடங்கள் கழித்து மீண்டும் முயற்சிக்கவும்.',
        botFailed: 'மின்னஞ்சலை மீண்டும் அனுப்ப சரிபார்ப்பை முடிக்கவும்.',
        sendFailed: 'மின்னஞ்சலை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
        requestFailed: 'இந்தப் பக்கத்தைப் புதுப்பித்து மீண்டும் முயற்சிக்கவும்.',
        networkFailed: 'இணைக்க முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
    },
}

function CheckEmailContent() {
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''
    const type = searchParams.get('type') || 'email_verify'

    const [countdown, setCountdown] = useState(60)
    const [canResend, setCanResend] = useState(false)
    const [resending, setResending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const turnstileTokenRef = useRef<string | null>(null)
    const turnstileRef = useRef<TurnstileHandle>(null)
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
        || process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true'
    const handleTurnstileVerify = useCallback((token: string) => {
        turnstileTokenRef.current = token || null
        setTurnstileToken(token || null)
    }, [])
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
        const currentToken = turnstileTokenRef.current || turnstileToken
        if (turnstileEnabled && !currentToken) {
            setError(t.botFailed)
            turnstileRef.current?.reset()
            return
        }
        setResending(true)
        setError(null)

        try {
            const endpoint = type === 'magic_link' ? '/api/auth/send-magic'
                : type === 'password_reset' ? '/api/auth/send-reset' : '/api/auth/signup'
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: (await getAuthHeaders()),
                body: JSON.stringify({ email, turnstileToken: currentToken }),
            })
            const payload = await response.json().catch(() => null) as {
                success?: boolean
                error?: string
            } | null

            if (!response.ok || payload?.success !== true) {
                if (response.status === 429) setError(t.rateLimited)
                else if (response.status === 403 && typeof payload?.error === 'string' && payload.error.includes('Bot')) setError(t.botFailed)
                else if (response.status === 400 || response.status === 403) setError(t.requestFailed)
                else setError(t.sendFailed)
                return
            }

            setCountdown(60)
            setCanResend(false)
        } catch {
            setError(t.networkFailed)
        } finally {
            turnstileTokenRef.current = null
            setTurnstileToken(null)
            turnstileRef.current?.reset()
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

                    {canResend && <TurnstileWidget ref={turnstileRef} onVerify={handleTurnstileVerify} />}

                    {error && <Banner variant="critical">{error}</Banner>}

                    <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        loading={resending}
                        onClick={handleResend}
                        disabled={!canResend || resending || (turnstileEnabled && !turnstileToken)}
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
