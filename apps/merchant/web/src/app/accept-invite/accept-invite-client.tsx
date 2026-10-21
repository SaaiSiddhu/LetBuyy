'use client'

import { useEffect, useState } from 'react'
import { Banner, Button, Card, Section } from '@letbuyy/ui'
import type { StaffInvitationPreview } from '@letbuyy/api-client'
import { permissionLabel } from '@/lib/staff/roles'
import { staffMutationKey } from '@/lib/staff/mutation-key'

export function AcceptStaffInvitation({ token, email, accountsUrl }: { token: string; email: string | null; accountsUrl: string }) {
    const [preview, setPreview] = useState<StaffInvitationPreview | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [loading, setLoading] = useState(Boolean(email && token))
    useEffect(() => {
        if (!email || !token) return
        let active = true
        fetch('/api/employees/accept-invite', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'preview', token }) }).then(async response => {
            const body = await response.json()
            if (!response.ok) throw new Error(body.error?.message || 'This invitation is unavailable for this account.')
            if (active) setPreview(body.data)
        }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Invitation unavailable') })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [email, token])
    const signIn = () => {
        const login = new URL(accountsUrl)
        login.searchParams.set('return_to', window.location.href)
        window.location.assign(login.toString())
    }
    const switchAccount = async () => {
        setBusy(true); setError(null)
        try {
            const logout = new URL('/api/auth/logout', accountsUrl)
            const response = await fetch(logout, { method: 'POST', credentials: 'include' })
            if (!response.ok) throw new Error('Unable to switch accounts. Retry this action.')
            signIn()
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to switch accounts'); setBusy(false) }
    }
    const grants = preview && Array.isArray(preview.permissions.granted)
        ? preview.permissions.granted.filter((key): key is string => typeof key === 'string') : []
    const accept = async () => {
        if (!preview || busy) return
        setBusy(true); setError(null)
        try {
            const retry = await staffMutationKey(preview.store_id, 'accept:' + preview.id, { token })
            const response = await fetch('/api/employees/accept-invite', { method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': retry.key }, body: JSON.stringify({ action: 'accept', token }) })
            const body = await response.json()
            if (!response.ok) throw new Error(body.error?.message || 'Unable to accept invitation')
            retry.complete()
            window.location.assign('/' + encodeURIComponent(body.data.store_handle) + '/dashboard')
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to accept invitation'); setBusy(false) }
    }
    return <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-[var(--lb-space-5)] p-[var(--lb-space-5)]">
        <h1>Staff invitation</h1>
        <Card><Section title={preview?.store_name || 'Join a store team'}>
            {!token ? <Banner variant="critical" title="Invitation link is missing">Open the complete invitation link from your store owner.</Banner>
                : !email ? <><p>Sign in or create and verify your account to review this invitation.</p><Button onClick={signIn}>Sign in to review invitation</Button></>
                    : <><p>Signed in as {email}</p><Button variant="secondary" onClick={() => void switchAccount()} disabled={busy}>Use a different account</Button>{loading && <p>Loading invitation…</p>}
                        {preview && <><p>You are invited to {preview.store_name} as {preview.role}.</p><p>Access starts after you accept with the invited verified account.</p><p>Requested access:</p><ul>{grants.map(key => <li key={key}>{permissionLabel(key)}</li>)}</ul>
                            <Button onClick={() => void accept()} loading={busy}>{preview.status === 'accepted' ? 'Continue to store' : 'Accept staff invitation'}</Button></>}
                        {error && <Banner variant="critical" title="Invitation unavailable">{error}</Banner>}
                    </>}
        </Section></Card>
    </main>
}
