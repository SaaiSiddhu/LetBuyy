'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Input } from '@letbuyy/ui'
import { BrandLogo } from '@/components/BrandLogo'
import { getAuthHeaders } from '@/lib/csrf-client'

type Factor = { id: string; status: string }
type Overview = { custom_user_id: string; email: string; mfa_enabled: boolean; factors: Factor[]; sessions: { id: string; created_at: string; last_active: string }[] }
export default function AccountSecurityPage() {
    const [overview, setOverview] = useState<Overview | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
    const [secret, setSecret] = useState<string | null>(null), [codes, setCodes] = useState<string[]>([]), [code, setCode] = useState(''), [recovery, setRecovery] = useState(''), [password, setPassword] = useState('')
    const [signedOut, setSignedOut] = useState(false), [changedFactor, setChangedFactor] = useState(false)
    const [commandKey, setCommandKey] = useState<string | null>(null)
    const [nativeFlow, setNativeFlow] = useState(false)
    const load = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/security', { cache: 'no-store', signal: AbortSignal.timeout(20000) })
            const payload = await response.json()
            if (!response.ok || !payload?.data?.custom_user_id) throw new Error('Unable to load account security. Retry or sign in again.')
            setOverview(payload.data); setNativeFlow(payload.nativeFlow === true); setError(null)
        } catch { setError('Unable to load account security. Retry or sign in again.') }
    }, [])
    useEffect(() => { void load() }, [load])
    const factor = overview?.factors.find(item => item.status === 'active') || overview?.factors.find(item => item.status === 'pending')
    async function command(action: 'enroll' | 'verify' | 'disable' | 'revoke_all') {
        if (busy) return
        const key = commandKey || crypto.randomUUID()
        setCommandKey(key); setBusy(true); setError(null)
        try {
            const response = await fetch('/api/auth/security', { method: 'POST', headers: await getAuthHeaders(), signal: AbortSignal.timeout(20000), body: JSON.stringify(action === 'revoke_all' ? { action, password, code: code || undefined, recoveryCode: recovery || undefined } : { action, key, ...(action === 'enroll' ? {} : { factorId: factor?.id, code: code || undefined, ...(action === 'disable' ? { recoveryCode: recovery || undefined } : {}) }) }) })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'Security could not be updated. Retry the same action.')
            if (action === 'revoke_all') { setSignedOut(true); setOverview(null); return }
            setSecret(payload.data?.secret || null); setCodes(payload.data?.recovery_codes || [])
            setCode(''); setRecovery(''); setPassword(''); setCommandKey(null)
            if (action !== 'enroll') setChangedFactor(true)
            await load()
        } catch { setError('Security could not be updated. Retry the same action. For sign-out, enter your current password and required verification code.') }
        finally { setBusy(false) }
    }
    return <main className="auth-container"><div className="auth-card"><BrandLogo /><h1 className="auth-title">Account security</h1>
        {error && <p role="alert">{error}</p>}
        {signedOut ? <><p role="status">All account sessions were signed out. Return to the app and sign in again.</p><a href="/login?choose_account=1">Sign in again</a></> : !overview ? <Button unstyled disabled={busy} onClick={load}>Retry loading security</Button> : <>
            <p>{overview.email}</p><p>{overview.mfa_enabled ? 'Authenticator app active' : 'Authenticator app not configured'}</p>
            {!overview.mfa_enabled && <Button unstyled disabled={busy} onClick={() => command('enroll')}>{factor?.status === 'pending' ? 'Resume authenticator setup' : 'Set up authenticator app'}</Button>}
            {secret && <><p>Add this secret to your authenticator app, then verify a current code.</p><output aria-label="Authenticator secret">{secret}</output></>}
            <label htmlFor="account-factor-code">Authenticator code</label><Input unstyled id="account-factor-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value)} />
            {factor?.status === 'pending' && <Button unstyled disabled={busy || code.length !== 6} onClick={() => command('verify')}>Activate authenticator</Button>}
            {overview.mfa_enabled && <><label htmlFor="account-recovery-code">Recovery code (if your authenticator is unavailable)</label><Input unstyled id="account-recovery-code" autoComplete="off" maxLength={40} value={recovery} onChange={event => setRecovery(event.target.value)} /><Button unstyled disabled={busy || (!code && !recovery)} onClick={() => command('disable')}>Disable authenticator</Button></>}
            {codes.length > 0 && <><h2>Save your recovery codes</h2><p>Each code works once. Keep them somewhere private.</p><div aria-label="Recovery codes">{codes.map(value => <p key={value}>{value}</p>)}</div><Button unstyled onClick={() => setCodes([])}>I saved my recovery codes</Button></>}
            <h2>Recent active sessions</h2><p>Showing up to 25 active sessions.</p><ul>{overview.sessions.map(session => <li key={session.id}>Last active: {new Date(session.last_active).toLocaleString()}</li>)}</ul>
            <h2>Sign out everywhere</h2><p>This also signs out this browser and the Merchant app. Enter your current password and, when enabled, an authenticator or recovery code above.</p>
            <label htmlFor="revoke-password">Current password</label><Input unstyled id="revoke-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /><Button unstyled disabled={busy || !password} onClick={() => command('revoke_all')}>Sign out all sessions</Button>
            {codes.length === 0 && <p><a href={changedFactor ? '/login?choose_account=1' : nativeFlow ? '/mobile/return' : '/select'}>{changedFactor ? 'Sign in again to finish security changes' : nativeFlow ? 'Done — return to app' : 'Back to your stores'}</a></p>}
        </>}
    </div></main>
}
