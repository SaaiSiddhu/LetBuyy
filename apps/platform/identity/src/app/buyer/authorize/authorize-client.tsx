'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@letbuyy/ui'
import TurnstileWidget, { type TurnstileHandle } from '@/components/TurnstileWidget'
import { BrandLogo } from '@/components/BrandLogo'
import { getAuthHeaders } from '@/lib/csrf-client'
import type { BuyerAuthorizationRequest } from '@/lib/auth/buyer-authorization'

type Mode = 'sign-in' | 'register'

/// Where the buyer goes after continuing: a store (named), or the marketplace app.
export type AuthorizeDestination = { kind: 'store' | 'app'; name: string }

const GENERIC = 'Something went wrong. Try again in a moment.'

async function errorFrom(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null) as { error?: unknown } | null
    return typeof body?.error === 'string' && body.error ? body.error : fallback
}

/**
 * The buyer either continues to the store (or the app) as the account they are signed in as, switches
 * account, or signs in or creates an account first. Signing in only re-renders this page: going on is
 * always the buyer's own click on Continue, which is the only thing that asks for a code.
 */
export function BuyerAuthorize({
    request,
    destination,
    buyerEmail,
    initialMode,
}: {
    request: BuyerAuthorizationRequest
    destination: AuthorizeDestination
    buyerEmail: string | null
    initialMode: Mode
}) {
    const storeName = destination.name
    const router = useRouter()
    const mode = initialMode
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const turnstileRef = useRef<TurnstileHandle>(null)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
    const onVerify = useCallback((token: string) => setTurnstileToken(token), [])

    const thisPage = `/buyer/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: request.clientId,
        redirect_uri: request.redirectUri,
        state: request.state,
        code_challenge: request.codeChallenge,
        code_challenge_method: request.codeChallengeMethod,
    }).toString()}`

    async function continueToStore() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/buyer/oauth/authorize', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    response_type: 'code',
                    client_id: request.clientId,
                    redirect_uri: request.redirectUri,
                    state: request.state,
                    code_challenge: request.codeChallenge,
                    code_challenge_method: request.codeChallengeMethod,
                }),
            })
            if (!res.ok) {
                setError(await errorFrom(res, GENERIC))
                if (res.status === 401) router.refresh()
                setLoading(false)
                return
            }
            const { redirect } = await res.json() as { redirect: string }
            window.location.assign(redirect)
        } catch {
            setError(GENERIC)
            setLoading(false)
        }
    }

    async function useAnotherAccount() {
        setLoading(true)
        await fetch('/api/buyer/logout', { method: 'POST', headers: getAuthHeaders() }).catch(() => undefined)
        setLoading(false)
        router.refresh()
    }

    async function submitCredentials(event: React.FormEvent) {
        event.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(mode === 'sign-in' ? '/api/buyer/login' : '/api/buyer/register', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email: email.trim(), password, turnstileToken: turnstileToken || undefined }),
            })
            if (!res.ok) {
                if (mode === 'register' && res.status === 409) {
                    setError('An account with this email already exists. Sign in instead, or reset your password.')
                } else {
                    setError(await errorFrom(res, mode === 'sign-in' ? 'Invalid email or password.' : 'Could not create the account.'))
                }
                turnstileRef.current?.reset()
                setTurnstileToken(null)
                return
            }
            setPassword('')
            router.refresh()
        } catch {
            setError(GENERIC)
        } finally {
            setLoading(false)
        }
    }

    if (buyerEmail) {
        return (
            <main className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <BrandLogo />
                    </div>
                    <h1 className="auth-title">Continue to {storeName}</h1>
                    <p className="auth-subtitle">
                        You’re signed in to LetBuyy as <strong>{buyerEmail}</strong>.{' '}
                        {destination.kind === 'app'
                            ? 'The app will be signed in to this account.'
                            : `${storeName} will receive your email address.`}
                    </p>

                    {error && <div className="auth-error" role="alert" aria-live="assertive">{error}</div>}

                    <Button unstyled className="auth-btn-primary" onClick={continueToStore} disabled={loading}>
                        {loading ? '...' : `Continue to ${storeName}`}
                    </Button>
                    <Button unstyled className="auth-btn-secondary" onClick={useAnotherAccount} disabled={loading}>
                        Use a different account
                    </Button>
                </div>
            </main>
        )
    }

    return (
        <main className="auth-container">
            <div className="auth-card">
                <div className="auth-logo">
                    <BrandLogo />
                </div>
                <h1 className="auth-title">{mode === 'sign-in' ? 'Sign in' : 'Create your LetBuyy account'}</h1>
                <p className="auth-subtitle">
                    {mode === 'sign-in'
                        ? `Use your LetBuyy account to continue to ${storeName}.`
                        : destination.kind === 'app'
                            ? 'One account for the LetBuyy app and every LetBuyy store.'
                            : `One account for ${storeName} and every other LetBuyy store.`}
                </p>

                <form onSubmit={submitCredentials} className="auth-form">
                    <Input
                        id="buyerEmail"
                        type="email"
                        label="Email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        autoFocus
                        required
                    />
                    <Input
                        id="buyerPassword"
                        type="password"
                        label="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        helperText={mode === 'register' ? 'At least 8 characters.' : undefined}
                        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                        minLength={mode === 'register' ? 8 : undefined}
                        required
                    />

                    {error && <div className="auth-error" role="alert" aria-live="assertive">{error}</div>}

                    <Button
                        unstyled
                        type="submit"
                        className="auth-btn-primary"
                        disabled={loading || !email.trim() || !password || (turnstileEnabled && !turnstileToken)}
                    >
                        {loading ? '...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
                    </Button>
                </form>

                <TurnstileWidget ref={turnstileRef} onVerify={onVerify} />

                <div className="auth-bottom-link">
                    {mode === 'sign-in' ? (
                        <>
                            <span>New to LetBuyy?</span>{' '}
                            <a href={`${thisPage}&screen=register`}>Create an account</a>
                            {' · '}
                            <a href={`/buyer/recover?continue=${encodeURIComponent(thisPage)}`}>Forgot password?</a>
                        </>
                    ) : (
                        <>
                            <span>Already have an account?</span>{' '}
                            <a href={thisPage}>Sign in</a>
                        </>
                    )}
                </div>
            </div>
        </main>
    )
}
