'use client'

import { Suspense, useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Input } from '@letbuyy/ui'
import TurnstileWidget, { type TurnstileHandle } from '@/components/TurnstileWidget'
import { BrandLogo } from '@/components/BrandLogo'
import { getAuthHeaders } from '@/lib/csrf-client'
import { safeContinuePath } from '@/lib/auth/buyer-authorization'

const GENERIC = 'Something went wrong. Try again in a moment.'

async function errorFrom(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null) as { error?: unknown } | null
    return typeof body?.error === 'string' && body.error ? body.error : fallback
}

/**
 * /buyer/recover — reset a LetBuyy buyer password with an emailed code (APPID-P4a's API).
 *
 * Every address gets the same answer to the first step. Resetting ends every existing session, then
 * signs this browser in; if the buyer came from a store's sign-in, they go back to that page, and only
 * ever there (safeContinuePath), so the form cannot be used to send anyone elsewhere.
 */
function RecoverForm() {
    const continuePath = safeContinuePath(useSearchParams().get('continue'))
    const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const turnstileRef = useRef<TurnstileHandle>(null)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
    const onVerify = useCallback((token: string) => setTurnstileToken(token), [])

    async function sendCode(event: React.FormEvent) {
        event.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/buyer/recover/send', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email: email.trim(), turnstileToken: turnstileToken || undefined }),
            })
            if (!res.ok) {
                setError(await errorFrom(res, GENERIC))
                turnstileRef.current?.reset()
                setTurnstileToken(null)
                return
            }
            setStep('code')
        } catch {
            setError(GENERIC)
        } finally {
            setLoading(false)
        }
    }

    async function resetPassword(event: React.FormEvent) {
        event.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/buyer/recover/confirm', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
            })
            if (!res.ok) {
                setError(await errorFrom(res, GENERIC))
                return
            }
            if (continuePath) {
                window.location.assign(continuePath)
                return
            }
            setStep('done')
        } catch {
            setError(GENERIC)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="auth-container">
            <div className="auth-card">
                <p className="auth-subtitle">This recovers your shopping profile. If you use LetBuyy for work, <a href="/forgot-password">recover that account</a>, then return and choose Use an existing LetBuyy account.</p>
                <div className="auth-logo">
                    <BrandLogo />
                </div>

                {step === 'email' && (
                    <>
                        <h1 className="auth-title">Reset your password</h1>
                        <p className="auth-subtitle">Enter your email and we’ll send you a 6-digit code.</p>
                        <form onSubmit={sendCode} className="auth-form">
                            <Input
                                id="recoverEmail"
                                type="email"
                                label="Email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                autoFocus
                                required
                            />
                            {error && <div className="auth-error" role="alert" aria-live="assertive">{error}</div>}
                            <Button
                                unstyled
                                type="submit"
                                className="auth-btn-primary"
                                disabled={loading || !email.trim() || (turnstileEnabled && !turnstileToken)}
                            >
                                {loading ? '...' : 'Send code'}
                            </Button>
                        </form>
                        <TurnstileWidget ref={turnstileRef} onVerify={onVerify} />
                    </>
                )}

                {step === 'code' && (
                    <>
                        <h1 className="auth-title">Check your email</h1>
                        <p className="auth-subtitle">
                            If there’s a LetBuyy account for {email.trim()}, we’ve sent it a 6-digit code. It expires in 10
                            minutes. Resetting your password signs you out on every device.
                        </p>
                        <form onSubmit={resetPassword} className="auth-form">
                            <Input
                                id="recoverCode"
                                inputMode="numeric"
                                label="Code"
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                autoComplete="one-time-code"
                                maxLength={6}
                                autoFocus
                                required
                            />
                            <Input
                                id="recoverPassword"
                                type="password"
                                label="New password"
                                helperText="At least 8 characters."
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                required
                            />
                            {error && <div className="auth-error" role="alert" aria-live="assertive">{error}</div>}
                            <Button unstyled type="submit" className="auth-btn-primary" disabled={loading || code.trim().length !== 6 || password.length < 8}>
                                {loading ? '...' : 'Reset password'}
                            </Button>
                        </form>
                        <div className="auth-bottom-link">
                            <Button unstyled onClick={() => { setStep('email'); setCode(''); setError(null) }}>Send a new code</Button>
                        </div>
                    </>
                )}

                {step === 'done' && (
                    <>
                        <h1 className="auth-title">Password reset</h1>
                        <p className="auth-subtitle">You’re signed in with your new password. Every other session has been signed out.</p>
                    </>
                )}
            </div>
        </main>
    )
}

export default function BuyerRecoverPage() {
    return (
        <Suspense>
            <RecoverForm />
        </Suspense>
    )
}
