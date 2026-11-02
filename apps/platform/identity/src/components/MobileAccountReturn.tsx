'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@letbuyy/ui'
import { BrandLogo } from './BrandLogo'
import { getAuthHeaders } from '@/lib/csrf-client'

export function MobileAccountReturn({ siteId }: { siteId?: string }) {
    const started = useRef(false)
    const [callback, setCallback] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        if (started.current) return
        started.current = true
        void (async () => {
            try {
                const response = await fetch('/api/auth/mobile/complete', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ siteId }), signal: AbortSignal.timeout(20000) })
                const data = await response.json()
                if (!response.ok || typeof data.callback !== 'string') throw new Error('Return could not be completed. Start sign-in again from the app.')
                setCallback(data.callback)
                window.location.replace(data.callback)
            } catch {
                setError('Return could not be completed. Start sign-in again from the LetBuyy app. Your account and saved store are preserved.')
            }
        })()
    }, [siteId])
    return <main className="auth-container"><div className="auth-card">
        <BrandLogo /><h1 className="auth-title">Returning to LetBuyy…</h1>
        {error ? <p role="alert">{error}</p> : <p role="status">Finishing your secure sign-in. The app will open automatically.</p>}
        {callback && <a className="auth-btn-primary" href={callback}>Return to app</a>}
        <p>If the app does not open, return to it and restart sign-in. You never need to copy a code.</p>
        {error && <ContinueInBrowser />}
    </div></main>
}

export function MobileAccountApproval({ email }: { email: string }) {
    const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
    async function approve() {
        if (busy) return
        setBusy(true); setError(null)
        try {
            const response = await fetch('/api/auth/mobile/approve', { method: 'POST', headers: await getAuthHeaders(), body: '{}', signal: AbortSignal.timeout(20000) })
            const data = await response.json()
            if (!response.ok || !['/mobile/return', '/onboarding', '/security'].includes(data?.redirectTo)) throw new Error('Account confirmation failed')
            window.location.assign(data.redirectTo)
        } catch { setError('Unable to continue with this account. Try again or use the account signed in on your app.'); setBusy(false) }
    }
    return <><h1 className="auth-title">Continue to LetBuyy</h1><p>You’re signed in as <strong>{email}</strong>.</p>
        {error && <p role="alert">{error}</p>}
        <Button unstyled className="auth-btn-primary" disabled={busy} onClick={approve}>{busy ? 'Continuing…' : 'Continue with this account'}</Button>
        <p><a href="/login?choose_account=1">Use another account</a></p></>
}

export function ContinueInBrowser() {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(false)
    async function abandon() {
        setBusy(true); setError(false)
        try {
            const response = await fetch('/api/auth/mobile/abandon', { method: 'POST', headers: await getAuthHeaders(), body: '{}', signal: AbortSignal.timeout(15000) })
            if (!response.ok) throw new Error('Unable to continue')
            window.location.assign('/lookup')
        } catch { setError(true) } finally { setBusy(false) }
    }
    return <>{error && <p role="alert">Unable to continue right now. Please retry.</p>}<Button unstyled disabled={busy} onClick={abandon}>Continue in this browser instead</Button></>
}
