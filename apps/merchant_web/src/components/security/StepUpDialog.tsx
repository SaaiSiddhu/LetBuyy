'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { Button, Input, Banner } from '@letbuyy/ui'

export type StepUpAction = 'refund.approve' | 'payout.release'

export interface StepUpResult {
    token: string
    verifiedAt: string
}

interface Props {
    store: string
    action: StepUpAction
    open: boolean
    /** Called with the signed token + verifiedAt when verification succeeds. */
    onSuccess: (result: StepUpResult) => void
    /** Called when the user dismisses without completing. */
    onClose: () => void
}

type Phase = 'code' | 'enroll' | 'enrollVerify'

interface EnrollState {
    factorId: string
    secret: string
    otpauthUri: string
}

function getErrorMsg(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const err = (payload as { error?: unknown }).error
        if (err && typeof err === 'object') {
            const msg = (err as { message?: unknown }).message
            if (typeof msg === 'string') return msg
        }
    }
    return fallback
}

/**
 * StepUpDialog — reusable 2-phase dialog:
 *  1. If TOTP is already enrolled: prompt for 6-digit code → call step-up challenges endpoint → resolve token.
 *  2. If not enrolled (factor_id not available from GET /2fa): show enrollment (secret + confirm code) → verify → then prompt for step-up code.
 *
 * Rendered inline as an overlay panel (no extra dependencies). Mirrors MCP dialog patterns.
 */
export function StepUpDialog({ store, action, open, onSuccess, onClose }: Props) {
    const [phase, setPhase] = useState<Phase>('code')
    const [factorId, setFactorId] = useState<string>('')
    const [code, setCode] = useState('')
    const [enrollState, setEnrollState] = useState<EnrollState | null>(null)
    const [enrollCode, setEnrollCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const reset = useCallback(() => {
        setPhase('code')
        setFactorId('')
        setCode('')
        setEnrollState(null)
        setEnrollCode('')
        setError(null)
        setLoading(false)
    }, [])

    const handleClose = useCallback(() => {
        reset()
        onClose()
    }, [reset, onClose])

    // Load factor id from /2fa overview on first open
    const [initialized, setInitialized] = useState(false)
    const initialize = useCallback(async () => {
        if (initialized) return
        setInitialized(true)
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/two-factor`)
            const payload = await resp.json().catch(() => null) as {
                data?: { factors?: Array<{ id: string; status: string; factor_type: string }> }
            } | null
            const activeFactor = payload?.data?.factors?.find(
                (f) => f.factor_type === 'totp' && f.status === 'active'
            )
            if (activeFactor) {
                setFactorId(activeFactor.id)
            } else {
                // No active factor — start enrollment
                setPhase('enroll')
                await startEnroll()
            }
        } catch {
            setError('Unable to check 2FA status. Please try again.')
        }
    }, [initialized, store])

    const startEnroll = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/two-factor/enroll`, {
                method: 'POST',
            })
            const payload = await resp.json().catch(() => null) as {
                data?: { factor?: { id: string }; secret?: string; otpauth_uri?: string }
                error?: { message?: string }
            } | null
            if (!resp.ok || !payload?.data?.factor?.id) {
                setError(getErrorMsg(payload, 'Unable to start 2FA enrollment. Please try again.'))
                return
            }
            setEnrollState({
                factorId: payload.data.factor.id,
                secret: payload.data.secret ?? '',
                otpauthUri: payload.data.otpauth_uri ?? '',
            })
            setPhase('enroll')
        } catch {
            setError('Unable to start enrollment.')
        } finally {
            setLoading(false)
        }
    }, [store])

    const handleEnrollVerify = useCallback(async (event: FormEvent) => {
        event.preventDefault()
        if (!enrollState) return
        setLoading(true)
        setError(null)
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/two-factor/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ factor_id: enrollState.factorId, code: enrollCode.trim() }),
            })
            const payload = await resp.json().catch(() => null) as {
                data?: { factor?: { id: string; status: string } }
                error?: { message?: string }
            } | null
            if (!resp.ok || payload?.data?.factor?.status !== 'active') {
                setError(getErrorMsg(payload, 'Verification code is invalid. Please try again.'))
                setEnrollCode('')
                return
            }
            // Factor is now active — proceed to step-up challenge
            setFactorId(enrollState.factorId)
            setEnrollCode('')
            setPhase('code')
        } catch {
            setError('Enrollment verification failed.')
        } finally {
            setLoading(false)
        }
    }, [store, enrollState, enrollCode])

    const handleStepUp = useCallback(async (event: FormEvent) => {
        event.preventDefault()
        if (!factorId) {
            setError('No active 2FA factor found. Please enrol first.')
            return
        }
        setLoading(true)
        setError(null)
        const idempotencyKey = `stepup-${action}-${crypto.randomUUID()}`
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/step-up`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    idempotency_key: idempotencyKey,
                    factor_id: factorId,
                    code: code.trim(),
                }),
            })
            const payload = await resp.json().catch(() => null) as {
                data?: { step_up_token?: string; verified_at?: string }
                error?: { code?: string; message?: string }
            } | null

            if (!resp.ok) {
                const errCode = (payload as { error?: { code?: string } } | null)?.error?.code
                if (errCode === 'STEP_UP_FACTOR_REQUIRED' || errCode === 'TWO_FACTOR_UNAVAILABLE') {
                    setError('2FA is not enrolled. Please set up your authenticator first.')
                } else {
                    setError(getErrorMsg(payload, 'Verification code is invalid or expired.'))
                }
                setCode('')
                return
            }

            const token = payload?.data?.step_up_token
            const verifiedAt = payload?.data?.verified_at
            if (!token || !verifiedAt) {
                setError('Invalid response from server. Please try again.')
                return
            }
            reset()
            onSuccess({ token, verifiedAt })
        } catch {
            setError('Step-up verification failed.')
        } finally {
            setLoading(false)
        }
    }, [store, action, factorId, code, onSuccess, reset])

    // Initialize on open
    if (open && !initialized) {
        void initialize()
    }
    if (!open && initialized) {
        setInitialized(false)
        reset()
    }

    if (!open) return null

    const actionLabel = action === 'refund.approve' ? 'Approve Refund' : 'Release Payout'

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="step-up-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[var(--lb-space-4)]"
        >
            <div className="w-full max-w-[420px] lb-rounded-xl bg-[var(--lb-color-surface)] p-[var(--lb-space-6)] lb-shadow-overlay">
                <h2
                    id="step-up-title"
                    className="m-0 mb-[var(--lb-space-2)] text-[var(--lb-font-size-heading-sm)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading-sm)] text-[var(--lb-color-text)]"
                >
                    Verify identity
                </h2>
                <p className="m-0 mb-[var(--lb-space-4)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                    {phase === 'enroll'
                        ? 'Set up your authenticator app to continue.'
                        : `Enter your authenticator code to ${actionLabel.toLowerCase()}.`}
                </p>

                {error && (
                    <div className="mb-[var(--lb-space-4)]">
                        <Banner title="Verification failed" variant="critical">
                            {error}
                        </Banner>
                    </div>
                )}

                {phase === 'enroll' && enrollState && (
                    <form onSubmit={handleEnrollVerify} className="grid gap-[var(--lb-space-4)]">
                        <div className="lb-rounded-lg border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                            <p className="m-0 mb-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                Secret key
                            </p>
                            <p className="m-0 break-all font-mono text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                {enrollState.secret}
                            </p>
                            <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                Enter this key in Google Authenticator, Authy, or any TOTP app. Then enter the 6-digit code below.
                            </p>
                        </div>
                        <Input
                            label="Authenticator code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            placeholder="000000"
                            value={enrollCode}
                            onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            autoComplete="one-time-code"
                        />
                        <div className="flex justify-end gap-[var(--lb-space-2)]">
                            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={loading} disabled={enrollCode.length !== 6}>
                                Verify and continue
                            </Button>
                        </div>
                    </form>
                )}

                {phase === 'code' && (
                    <form onSubmit={handleStepUp} className="grid gap-[var(--lb-space-4)]">
                        <Input
                            label="Authenticator code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            placeholder="000000"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            autoComplete="one-time-code"
                            autoFocus
                        />
                        <div className="flex justify-end gap-[var(--lb-space-2)]">
                            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" loading={loading} disabled={code.length !== 6}>
                                {actionLabel}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
