'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Badge, Banner, Button, Card, EmptyState, MaterialIcon, Page, PageHeader, Section, Skeleton, useToast } from '@letbuyy/ui'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'
import { StepUpDialog, type StepUpResult } from '@/components/security/StepUpDialog'

interface PayoutRow {
    id: string
    statement_number: string
    status: 'pending' | 'processing' | 'released' | 'failed'
    currency: string
    gross_amount_minor: number
    net_amount_minor: number
    platform_fee_minor: number
    period_start?: string | null
    period_end?: string | null
    available_on?: string | null
    released_at?: string | null
    failed_at?: string | null
    utr?: string | null
    provider_reference?: string | null
    failure_reason?: string | null
    created_at?: string | null
}

function currency(minor: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100)
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

function statusVariant(status: string): 'success' | 'critical' | 'info' | 'warning' {
    if (status === 'released') return 'success'
    if (status === 'failed') return 'critical'
    if (status === 'processing') return 'info'
    return 'warning'
}

function titleize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function PayoutsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [payouts, setPayouts] = useState<PayoutRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [releasingId, setReleasingId] = useState<string | null>(null)
    const [stepUpOpen, setStepUpOpen] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const loadPayouts = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payouts`)
            const payload = await response.json().catch(() => null) as {
                data?: { payouts?: PayoutRow[] }
                payouts?: PayoutRow[]
            } | null
            if (!response.ok) {
                setPayouts([])
                setError(getErrorMsg(payload, 'Unable to load payouts'))
                return
            }
            const rows = payload?.data?.payouts ?? (payload as { payouts?: PayoutRow[] } | null)?.payouts ?? []
            setPayouts(rows)
        } catch {
            setPayouts([])
            setError('Unable to load payouts')
        } finally {
            setLoading(false)
        }
    }, [store])

    useEffect(() => { void loadPayouts() }, [loadPayouts])

    const handleReleaseStepUpSuccess = useCallback(async (result: StepUpResult) => {
        if (!releasingId) return
        setStepUpOpen(false)
        setActionError(null)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/payouts/${encodeURIComponent(releasingId)}/settle`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idempotency_key: `payout-settle-${releasingId}-${crypto.randomUUID()}`,
                        step_up_token: result.token,
                        step_up_verified_at: result.verifiedAt,
                    }),
                }
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                const message = getErrorMsg(payload, 'Unable to release payout')
                setActionError(message)
                notify({ title: 'Release failed', description: message, variant: 'critical' })
                return
            }
            notify({ title: 'Payout released', description: 'The payout has been submitted for settlement.', variant: 'success' })
            setReleasingId(null)
            await loadPayouts()
        } catch {
            const message = 'Unable to release payout'
            setActionError(message)
            notify({ title: 'Release failed', description: message, variant: 'critical' })
        }
    }, [store, releasingId, loadPayouts, notify])

    const emptyState = (
        <EmptyState
            icon={<MaterialIcon name={error ? 'error' : 'account_balance'} />}
            title={error ? 'Unable to load payouts' : 'No payout statements yet'}
            body={error || 'Payout statements will appear here once orders have been paid and processed.'}
            primaryAction={error ? (
                <Button onClick={loadPayouts}>
                    <MaterialIcon name="refresh" />
                    Retry
                </Button>
            ) : undefined}
        />
    )

    return (
        <Page>
            <PageHeader
                eyebrow="Finance"
                title="Payouts"
                description="View pending and released payout statements. Release pending payouts after 2FA verification."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Payouts' }]}
                secondaryActions={[{ label: 'Orders', href: `/${store}/orders` }]}
            />

            <Card>
                <Section
                    title="Payout statements"
                    description={`${payouts.length} statement${payouts.length === 1 ? '' : 's'} in the current view.`}
                    action={(
                        <Button variant="secondary" onClick={loadPayouts}>
                            <MaterialIcon name="sync" />
                            Refresh
                        </Button>
                    )}
                >
                    {actionError && (
                        <div className="mb-[var(--lb-space-4)]">
                            <Banner title="Action failed" variant="critical">{actionError}</Banner>
                        </div>
                    )}

                    {loading ? (
                        <Skeleton variant="table" lines={4} />
                    ) : payouts.length === 0 ? (
                        emptyState
                    ) : (
                        <div className="grid gap-[var(--lb-space-3)]">
                            {payouts.map((payout) => (
                                <div
                                    key={payout.id}
                                    className="grid gap-[var(--lb-space-3)] lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-4)] md:grid-cols-[minmax(0,1fr)_auto_auto_auto]  md:items-center"
                                >
                                    <div className="grid gap-[var(--lb-space-1)]">
                                        <p className="m-0 font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                            {payout.statement_number}
                                        </p>
                                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            {payout.period_start && payout.period_end
                                                ? `${payout.period_start} – ${payout.period_end}`
                                                : formatDate(payout.created_at)}
                                        </p>
                                        {payout.utr && (
                                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                UTR: {payout.utr}
                                            </p>
                                        )}
                                        {payout.failure_reason && (
                                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-critical)]">
                                                {payout.failure_reason}
                                            </p>
                                        )}
                                    </div>

                                    <div className="text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                        Net {currency(payout.net_amount_minor)}
                                    </div>

                                    <Badge label={titleize(payout.status)} variant={statusVariant(payout.status)} />

                                    <div>
                                        {(payout.status === 'pending' || payout.status === 'processing') && (
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setReleasingId(payout.id)
                                                    setStepUpOpen(true)
                                                    setActionError(null)
                                                }}
                                            >
                                                Release
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </Card>

            <StepUpDialog
                store={store}
                action="payout.release"
                open={stepUpOpen}
                onSuccess={(result) => { void handleReleaseStepUpSuccess(result) }}
                onClose={() => {
                    setStepUpOpen(false)
                    setReleasingId(null)
                }}
            />
        </Page>
    )
}
