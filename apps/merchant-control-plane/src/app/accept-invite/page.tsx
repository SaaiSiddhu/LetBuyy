'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Banner, Button, Card, Input, Section, Skeleton } from '@letbuyy/ui'

function getErrorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            const code = (error as { code?: unknown }).code
            if (code === 'EXPIRED') return 'This invite has expired. Ask the store owner to send a new one.'
            if (code === 'NOT_FOUND') return 'This invite is invalid or has already been used.'
            if (typeof message === 'string') return message
        }
    }
    return fallback
}

function AcceptInviteForm() {
    const params = useSearchParams()
    const token = params.get('token') ?? ''

    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    const passwordTooShort = password.length > 0 && password.length < 8
    const mismatch = confirm.length > 0 && password !== confirm
    const canSubmit = Boolean(token) && password.length >= 8 && password === confirm && !submitting

    async function handleSubmit() {
        if (!canSubmit) return
        setSubmitting(true)
        setError(null)
        try {
            const res = await fetch('/api/employees/accept-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            })
            const payload = await res.json().catch(() => null)
            if (!res.ok) {
                setError(getErrorMessage(payload, 'Unable to accept the invite. Please try again.'))
                return
            }
            setDone(true)
        } catch {
            setError('A network error occurred. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!token) {
        return (
            <Banner title="Invite link incomplete" variant="critical">
                This invite link is missing its token. Please open the exact link from your invitation email.
            </Banner>
        )
    }

    if (done) {
        return (
            <Banner title="Account activated" variant="success">
                Your staff account is ready. Sign in with your email and the password you just set to access your store.
            </Banner>
        )
    }

    return (
        <div className="flex flex-col gap-[var(--lb-space-4)]">
            {error && <Banner title="Could not accept invite" variant="critical">{error}</Banner>}
            <Input
                label="Create a password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText={passwordTooShort ? 'Use at least 8 characters.' : 'At least 8 characters.'}
                aria-invalid={passwordTooShort || undefined}
            />
            <Input
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                helperText={mismatch ? 'Passwords do not match.' : undefined}
                aria-invalid={mismatch || undefined}
            />
            <Button onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? 'Activating…' : 'Accept invite & activate'}
            </Button>
        </div>
    )
}

export default function AcceptInvitePage() {
    return (
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-[var(--lb-space-5)] p-[var(--lb-space-5)]">
            <div className="flex flex-col gap-[var(--lb-space-2)] text-center">
                <span className="text-[var(--lb-font-size-lg)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                    Accept your staff invite
                </span>
                <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                    Set a password to activate your LetBuyy staff account.
                </span>
            </div>
            <Card>
                <Section title="Activate account">
                    <Suspense fallback={<Skeleton variant="text" lines={4} />}>
                        <AcceptInviteForm />
                    </Suspense>
                </Section>
            </Card>
        </div>
    )
}
