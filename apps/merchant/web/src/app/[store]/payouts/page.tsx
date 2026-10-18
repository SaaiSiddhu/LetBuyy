'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { MERCHANT_PAYOUT_STATUS_PRESENTATION, MerchantPayoutStatementSchema, presentStatus, type MerchantPayoutStatement } from '@letbuyy/shared-types'
import { Banner, Button, Card, EmptyState, MaterialIcon, Page, PageHeader, ProviderModeBadge, Section, Skeleton, StatusPresentationBadge, useToast } from '@letbuyy/ui'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'
import { StepUpDialog, type StepUpResult } from '@/components/security/StepUpDialog'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'

class PayoutReadbackError extends Error {}

function releaseClaimKey(payout: MerchantPayoutStatement, actorId: string): string | null {
    const key = payout.metadata.release_idempotency_key
    // Match the existing settle route's key length and 342's trim/control
    // checks. This is recovery evidence, never approval or session authority.
    return payout.metadata.release_claimed_by === actorId
        && typeof key === 'string' && key.length >= 8 && key.length <= 160
        && key === key.trim() && !/[\u0000-\u001f\u007f]/.test(key)
        ? key : null
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

export default function PayoutsPage() {
    const { store } = useParams<{ store: string }>()
    const { actorId } = useMerchantSecurityContext(store)
    return <PayoutStatements key={`${actorId}:${store}`} store={store} actorId={actorId} />
}

function PayoutStatements({ store, actorId }: { store: string; actorId: string }) {
    const { notify } = useToast()
    const [payouts, setPayouts] = useState<MerchantPayoutStatement[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [releasingId, setReleasingId] = useState<string | null>(null)
    /**
     * The payout currently in flight.
     *
     * Distinct from `releasingId`, which only records WHICH payout the step-up
     * dialog is for. Between the step-up closing and the toast arriving, this
     * screen previously showed no indication at all that money was moving, and
     * the Release button stayed enabled the whole time.
     */
    const [settlingId, setSettlingId] = useState<string | null>(null)
    /** Stable across retries of one release attempt — see orders/page.tsx. */
    const settleKeys = useRef(new Map<string, string>())
    const currentPayouts = useRef<MerchantPayoutStatement[]>([])
    const releaseTarget = useRef<{ id: string; siteId: string } | null>(null)
    const active = useRef(true)
    const loadVersion = useRef(0)
    const settling = useRef(false)
    const [stepUpOpen, setStepUpOpen] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const loadPayouts = useCallback(async () => {
        const version = ++loadVersion.current
        const current = () => active.current && loadVersion.current === version
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payouts`, { cache: 'no-store' })
            const payload = await response.json().catch(() => null) as {
                data?: { payouts?: unknown }
                payouts?: unknown
            } | null
            if (!current()) return
            if (!response.ok) {
                currentPayouts.current = []
                setPayouts([])
                setError(getErrorMsg(payload, 'Unable to load payouts'))
                return
            }
            const parsed = MerchantPayoutStatementSchema.array().safeParse(payload?.data?.payouts ?? payload?.payouts)
            if (!parsed.success) throw new PayoutReadbackError('Payout statements returned incomplete data. Refresh and retry.')
            currentPayouts.current = parsed.data
            setPayouts(parsed.data)
        } catch (cause) {
            if (!current()) return
            currentPayouts.current = []
            setPayouts([])
            setError(cause instanceof PayoutReadbackError ? cause.message : 'Unable to load payouts')
        } finally {
            if (current()) setLoading(false)
        }
    }, [store])

    useEffect(() => {
        active.current = true
        void loadPayouts()
        return () => { active.current = false; loadVersion.current += 1 }
    }, [loadPayouts])

    const handleReleaseStepUpSuccess = useCallback(async (result: StepUpResult) => {
        if (!active.current || !releasingId || settling.current) return
        if (result.actorId !== actorId) {
            setStepUpOpen(false)
            setActionError('The signed-in account changed. Reload this page before releasing a payout.')
            return
        }
        const matches = currentPayouts.current.filter(payout => payout.id === releasingId)
        const requestedStatement = matches[0]
        const target = releaseTarget.current
        if (matches.length !== 1 || !target || target.id !== releasingId || target.siteId !== requestedStatement.site_id
            || (requestedStatement.status !== 'pending' && requestedStatement.status !== 'processing')) {
            setStepUpOpen(false)
            setActionError('The payout statement changed. Refresh it before releasing a payout.')
            return
        }
        const command = `payout-settle-${requestedStatement.id}`
        const identity = `${requestedStatement.site_id}:${command}`
        // A processing statement has already claimed its command in SQL. Its
        // current owned readback wins over a stale component Map after reload.
        const claimedKey = releaseClaimKey(requestedStatement, actorId)
        if (requestedStatement.status === 'processing' && !claimedKey) {
            setStepUpOpen(false)
            setActionError('This payout release cannot be safely resumed. Refresh the statement and contact support if it remains unresolved.')
            return
        }
        const idempotencyKey = requestedStatement.status === 'processing' ? claimedKey!
            : settleKeys.current.get(identity) ?? `${command}-${crypto.randomUUID()}`
        settling.current = true
        setStepUpOpen(false)
        setActionError(null)
        setSettlingId(releasingId)
        settleKeys.current.set(identity, idempotencyKey)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/payouts/${encodeURIComponent(releasingId)}/settle`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Merchant-Context': result.actorId, 'X-Idempotency-Key': idempotencyKey },
                    body: JSON.stringify({
                        idempotency_key: idempotencyKey,
                        step_up_token: result.token,
                        step_up_verified_at: result.verifiedAt,
                    }),
                }
            )
            const payload = await response.json().catch(() => null)
            if (!active.current) return
            if (!response.ok) {
                const message = getErrorMsg(payload, 'Unable to release payout')
                setActionError(message)
                notify({ title: 'Release failed', description: message, variant: 'critical' })
                return
            }
            const parsed = MerchantPayoutStatementSchema.safeParse(payload?.data)
            if (!parsed.success || parsed.data.id !== requestedStatement.id || parsed.data.site_id !== requestedStatement.site_id) {
                throw new PayoutReadbackError('Payout release returned incomplete or conflicting statement data. Refresh and retry the same request.')
            }
            const payout = parsed.data
            const current = currentPayouts.current.filter(row => row.id === requestedStatement.id)
            if (releaseTarget.current?.id !== requestedStatement.id || releaseTarget.current.siteId !== requestedStatement.site_id
                || current.length !== 1 || current[0].site_id !== requestedStatement.site_id
                || settleKeys.current.get(identity) !== idempotencyKey
                || (['processing', 'released'].includes(current[0].status) && releaseClaimKey(current[0], actorId) !== idempotencyKey)
                || (['released', 'failed'].includes(current[0].status) && current[0].status !== payout.status)
                || (['processing', 'released'].includes(payout.status) && releaseClaimKey(payout, actorId) !== idempotencyKey)) {
                throw new PayoutReadbackError('Payout release returned incomplete or conflicting statement data. Refresh and retry the same request.')
            }
            if (payout.status === 'released') {
                settleKeys.current.delete(identity)
                notify({ title: 'Release recorded', description: 'The statement records this payout as released.', variant: 'success' })
            } else if (payout.status === 'processing') {
                // Keep the original command key: processing is an uncertain result.
                notify({ title: 'Payout processing', description: 'Release remains unconfirmed. Retry uses the same request.', variant: 'info' })
            } else {
                const message = payout.status === 'failed'
                    ? payout.failure_reason || 'The statement records a failed release. Review the statement before trying again.'
                    : 'Release is not confirmed. Refresh and retry the same request.'
                setActionError(message)
                notify({ title: 'Release needs attention', description: message, variant: payout.status === 'failed' ? 'critical' : 'warning' })
            }
            releaseTarget.current = null
            setReleasingId(null)
            await loadPayouts()
        } catch (cause) {
            if (!active.current) return
            const message = cause instanceof PayoutReadbackError
                ? cause.message
                : 'Unable to release payout'
            setActionError(message)
            notify({ title: 'Release failed', description: message, variant: 'critical' })
        } finally {
            settling.current = false
            if (active.current) setSettlingId(null)
        }
    }, [store, actorId, releasingId, loadPayouts, notify])

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

                                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                        <StatusPresentationBadge presentation={presentStatus(MERCHANT_PAYOUT_STATUS_PRESENTATION, payout.status)} />
                                        <ProviderModeBadge mode={payout.provider_mode} />
                                    </div>

                                    <div>
                                        {(payout.status === 'pending' || payout.status === 'processing') && (
                                            <Button
                                                size="sm"
                                                // Money is moving: show it, and stop a second
                                                // release being started while the first is open.
                                                loading={settlingId === payout.id}
                                                disabled={settlingId !== null}
                                                onClick={() => {
                                                    releaseTarget.current = { id: payout.id, siteId: payout.site_id }
                                                    setReleasingId(payout.id)
                                                    setStepUpOpen(true)
                                                    setActionError(null)
                                                }}
                                            >
                                                {payout.status === 'processing' ? 'Retry release' : 'Release'}
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
                    releaseTarget.current = null
                    setStepUpOpen(false)
                    setReleasingId(null)
                }}
            />
        </Page>
    )
}
