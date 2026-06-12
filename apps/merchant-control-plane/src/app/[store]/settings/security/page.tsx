'use client'

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { Badge, Banner, Button, Card, EmptyState, Input, MaterialIcon, Section, Skeleton, useToast } from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface TotpFactor {
    id: string
    status: 'pending' | 'active' | 'disabled'
    factor_type: string
    enrolled_at?: string | null
    last_verified_at?: string | null
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

export default function SecuritySettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeFactor, setActiveFactor] = useState<TotpFactor | null>(null)
    const [enrollState, setEnrollState] = useState<{
        factorId: string
        secret: string
        otpauthUri: string
    } | null>(null)
    const [enrollCode, setEnrollCode] = useState('')
    const [disableCode, setDisableCode] = useState('')
    const [enrollLoading, setEnrollLoading] = useState(false)
    const [disableLoading, setDisableLoading] = useState(false)
    const [showDisable, setShowDisable] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const load2faStatus = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/two-factor`)
            const payload = await resp.json().catch(() => null) as {
                data?: { factors?: TotpFactor[] }
            } | null
            if (!resp.ok) {
                setError(getErrorMsg(payload, 'Unable to load security status.'))
                return
            }
            const factors = payload?.data?.factors ?? []
            const active = factors.find((f) => f.factor_type === 'totp' && f.status === 'active') ?? null
            setActiveFactor(active)
        } catch {
            setError('Unable to load security status.')
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => { void load2faStatus() }, [load2faStatus])

    const startEnroll = useCallback(async () => {
        setEnrollLoading(true)
        setActionError(null)
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/two-factor/enroll`, {
                method: 'POST',
            })
            const payload = await resp.json().catch(() => null) as {
                data?: { factor?: { id: string }; secret?: string; otpauth_uri?: string }
            } | null
            if (!resp.ok || !payload?.data?.factor?.id) {
                setActionError(getErrorMsg(payload, 'Unable to start 2FA enrollment.'))
                return
            }
            setEnrollState({
                factorId: payload.data.factor.id,
                secret: payload.data.secret ?? '',
                otpauthUri: payload.data.otpauth_uri ?? '',
            })
        } catch {
            setActionError('Unable to start enrollment.')
        } finally {
            setEnrollLoading(false)
        }
    }, [store])

    const handleEnrollVerify = useCallback(async (event: FormEvent) => {
        event.preventDefault()
        if (!enrollState) return
        setEnrollLoading(true)
        setActionError(null)
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/two-factor/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ factor_id: enrollState.factorId, code: enrollCode.trim() }),
            })
            const payload = await resp.json().catch(() => null) as {
                data?: { factor?: TotpFactor; recovery_codes?: string[] }
            } | null
            if (!resp.ok || payload?.data?.factor?.status !== 'active') {
                setActionError(getErrorMsg(payload, 'Verification code is invalid.'))
                setEnrollCode('')
                return
            }
            notify({ title: '2FA enabled', description: 'Your authenticator app is now active.', variant: 'success' })
            setEnrollState(null)
            setEnrollCode('')
            await load2faStatus()
        } catch {
            setActionError('Enrollment verification failed.')
        } finally {
            setEnrollLoading(false)
        }
    }, [store, enrollState, enrollCode, load2faStatus, notify])

    const handleDisable = useCallback(async (event: FormEvent) => {
        event.preventDefault()
        if (!activeFactor) return
        setDisableLoading(true)
        setActionError(null)
        try {
            const resp = await fetch(`/api/stores/${encodeURIComponent(store)}/security/two-factor/disable`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ factor_id: activeFactor.id, code: disableCode.trim() }),
            })
            const payload = await resp.json().catch(() => null)
            if (!resp.ok) {
                setActionError(getErrorMsg(payload, 'Unable to disable 2FA.'))
                setDisableCode('')
                return
            }
            notify({ title: '2FA disabled', description: 'Two-factor authentication has been removed.', variant: 'success' })
            setShowDisable(false)
            setDisableCode('')
            setActiveFactor(null)
            await load2faStatus()
        } catch {
            setActionError('Unable to disable 2FA.')
        } finally {
            setDisableLoading(false)
        }
    }, [store, activeFactor, disableCode, load2faStatus, notify])

    return (
        <SettingsPane
            store={store}
            title="Security"
            description="Set up two-factor authentication so you can approve refunds and release payouts."
        >
            {actionError && (
                <Banner title="Security action failed" variant="critical">
                    {actionError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Two-factor authentication"
                    description="Protecting sensitive actions (refunds, payout releases) requires an active TOTP factor."
                >
                    {loading ? (
                        <Skeleton variant="card" lines={3} />
                    ) : error ? (
                        <EmptyState
                            icon={<MaterialIcon name="error" />}
                            title="Unable to load security status"
                            body={error}
                            primaryAction={<Button onClick={load2faStatus}>Retry</Button>}
                        />
                    ) : activeFactor ? (
                        <div className="grid gap-[var(--lb-space-4)]">
                            <div className="flex items-center gap-[var(--lb-space-3)]">
                                <MaterialIcon name="verified_user" className="text-[var(--lb-color-success)]" />
                                <div>
                                    <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                        Authenticator app active
                                    </p>
                                    {activeFactor.enrolled_at && (
                                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            Enrolled {new Date(activeFactor.enrolled_at).toLocaleDateString('en-IN')}
                                        </p>
                                    )}
                                </div>
                                <Badge label="Active" variant="success" />
                            </div>

                            {!showDisable ? (
                                <div>
                                    <Button variant="destructive" size="sm" onClick={() => { setShowDisable(true); setActionError(null) }}>
                                        Disable 2FA
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleDisable} className="grid gap-[var(--lb-space-3)] lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                                    <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                        Enter your current authenticator code to confirm.
                                    </p>
                                    <Input
                                        label="Authenticator code"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        pattern="[0-9]{6}"
                                        placeholder="000000"
                                        value={disableCode}
                                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        autoComplete="one-time-code"
                                    />
                                    <div className="flex gap-[var(--lb-space-2)]">
                                        <Button type="submit" variant="destructive" loading={disableLoading} disabled={disableCode.length !== 6}>
                                            Confirm disable
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={() => { setShowDisable(false); setDisableCode(''); setActionError(null) }}>
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    ) : enrollState ? (
                        <form onSubmit={handleEnrollVerify} className="grid gap-[var(--lb-space-4)]">
                            <div className="lb-rounded-lg border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <p className="m-0 mb-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    Secret key
                                </p>
                                <p className="m-0 break-all font-mono text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                    {enrollState.secret}
                                </p>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    Enter this key in Google Authenticator, Authy, or any TOTP app. Then enter the 6-digit code below to confirm.
                                </p>
                            </div>
                            <Input
                                label="Confirm authenticator code"
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                pattern="[0-9]{6}"
                                placeholder="000000"
                                value={enrollCode}
                                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                autoComplete="one-time-code"
                            />
                            <div className="flex gap-[var(--lb-space-2)]">
                                <Button type="submit" loading={enrollLoading} disabled={enrollCode.length !== 6}>
                                    Activate 2FA
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => { setEnrollState(null); setEnrollCode('') }}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="grid gap-[var(--lb-space-4)]">
                            <EmptyState
                                icon={<MaterialIcon name="lock" />}
                                title="2FA not configured"
                                body="Add an authenticator app to your account. You will need it to approve refunds and release payouts."
                            />
                            <div>
                                <Button loading={enrollLoading} onClick={startEnroll}>
                                    Set up authenticator app
                                </Button>
                            </div>
                        </div>
                    )}
                </Section>
            </Card>
        </SettingsPane>
    )
}
