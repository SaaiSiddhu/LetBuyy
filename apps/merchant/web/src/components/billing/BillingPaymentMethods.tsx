'use client'

import { useCallback, useRef, useState } from 'react'
import { Badge, Button, Info, Modal, normalizeProviderMode, Plus, ProviderModeBadge, Select, ShieldCheck, Smartphone, useToast } from '@letbuyy/ui'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import { MerchantEmptyArtwork } from '@/components/empty-states/MerchantEmptyState'

export interface BillingMandateView {
    id: string
    provider: string
    provider_mode: 'sandbox' | 'live' | null
    status: string
    plan_slug: string
    billing_period: string
    amount_minor: number
    currency: string
}

interface BillingPaymentMethodsProps {
    store: string
    mandates: BillingMandateView[]
    currentPlanSlug?: string | null
    currentBillingPeriod?: string | null
    onChanged: () => void
    /** Controlled modal state — lets a parent (e.g. the Upcoming bill card) open it too. */
    addOpen?: boolean
    onAddOpenChange?: (open: boolean) => void
    /** Hide the inline "Add payment method" button when the parent owns the trigger. */
    hideAddButton?: boolean
}

const STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'critical' | 'info' }> = {
    active: { label: 'Active', variant: 'success' },
    pending_provider: { label: 'Pending authorisation', variant: 'warning' },
    revoked: { label: 'Revoked', variant: 'critical' },
    failed: { label: 'Failed', variant: 'critical' },
}

function statusMeta(status: string) {
    return STATUS_LABEL[status] || { label: status || 'Unknown', variant: 'info' as const }
}

function formatPlanPeriod(planSlug: string, period: string) {
    const plan = planSlug ? planSlug.charAt(0).toUpperCase() + planSlug.slice(1) : 'Plan'
    const cadence = period === 'yearly' ? 'yearly' : period === 'monthly' ? 'monthly' : 'cycle unavailable'
    return `${plan} · ${cadence}`
}

export function BillingPaymentMethods({
    store,
    mandates,
    currentPlanSlug,
    currentBillingPeriod,
    onChanged,
    addOpen,
    onAddOpenChange,
    hideAddButton = false,
}: BillingPaymentMethodsProps) {
    const { notify } = useToast()
    const [internalOpen, setInternalOpen] = useState(false)
    const modalOpen = addOpen ?? internalOpen
    const setModalOpen = onAddOpenChange ?? setInternalOpen
    const [submitting, setSubmitting] = useState(false)
    const pendingIntent = useRef<{ scope: string; id: string } | null>(null)
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(
        currentBillingPeriod === 'yearly' ? 'yearly' : 'monthly',
    )
    const planSlug = currentPlanSlug && ['launch', 'growth', 'scale', 'commerce_os'].includes(currentPlanSlug)
        ? currentPlanSlug : null

    const handleAdd = useCallback(async () => {
        if (submitting || !planSlug) return
        const scope = `${store}:${planSlug}:${billingPeriod}`
        const storageKey = `letbuyy:billing-mandate-intent:${scope}`
        if (pendingIntent.current?.scope !== scope) {
            let savedId: string | null = null
            try { savedId = sessionStorage.getItem(storageKey) } catch { /* Private browsing may deny storage. */ }
            const id = savedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedId)
                ? savedId : crypto.randomUUID()
            pendingIntent.current = { scope, id }
            try { sessionStorage.setItem(storageKey, id) } catch { /* In-page retries still reuse the ref. */ }
        }
        const intentId = pendingIntent.current.id
        setSubmitting(true)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_slug: planSlug,
                    billing_period: billingPeriod,
                    intent_id: intentId,
                }),
            })
            const payload = (await response.json().catch(() => null)) as {
                data?: { mandate?: { id?: string; plan_slug?: string; billing_period?: string } }
                error?: string | { message?: string }
            } | null
            if (!response.ok) {
                const message = typeof payload?.error === 'string'
                    ? payload.error
                    : payload?.error?.message || 'Unable to add payment method'
                throw new Error(message)
            }
            if (!payload?.data?.mandate?.id || payload.data.mandate.plan_slug !== planSlug || payload.data.mandate.billing_period !== billingPeriod) {
                throw new Error('The mandate response was incomplete. Refresh billing to check whether it was saved before trying again.')
            }
            pendingIntent.current = null
            try { sessionStorage.removeItem(storageKey) } catch { /* The server already confirmed the intent. */ }
            setModalOpen(false)
            notify({
                title: 'Sandbox mandate created',
                description: 'Review its persisted status before relying on it for billing. Live AutoPay is not enabled here.',
                variant: 'success',
            })
            onChanged()
        } catch (error) {
            notify({
                title: 'Mandate status needs checking',
                description: `${error instanceof Error ? error.message : 'The request could not be confirmed.'} Refresh billing before retrying. This request will reuse the same operation key.`,
                variant: 'critical',
            })
        } finally {
            setSubmitting(false)
        }
    }, [billingPeriod, notify, onChanged, planSlug, setModalOpen, store, submitting])

    return (
        <>
            {mandates.length === 0 ? (
                <div className="billing-method-empty">
                    <MerchantEmptyArtwork scene="payment-methods" compact />
                    <div className="billing-method-empty-copy">
                        <span className="billing-method-empty-title">No billing mandates yet</span>
                        <span className="billing-method-empty-desc">
                            {planSlug ? 'Create a sandbox mandate for this plan. Live AutoPay needs separate provider activation.' : 'Select a subscription plan before creating a billing mandate.'}
                        </span>
                    </div>
                    <Button onClick={() => setModalOpen(true)} disabled={!planSlug}>
                        <Plus className="letbuyy-icon" aria-hidden="true" />
                        Create test mandate
                    </Button>
                </div>
            ) : (
                <div className="billing-method-list">
                    {mandates.map((mandate) => {
                        const meta = statusMeta(mandate.status)
                        return (
                            <div key={mandate.id} className="billing-method-item">
                                <span className="billing-method-icon">
                                    <Smartphone className="letbuyy-icon" aria-hidden="true" />
                                </span>
                                <div className="billing-method-meta">
                                    <div className="billing-method-title-row">
                                        <span className="billing-method-title">{mandate.provider === 'upi_autopay' ? 'UPI AutoPay mandate' : 'Billing mandate'}</span>
                                    </div>
                                    <span className="billing-method-sub">
                                        {formatPlanPeriod(mandate.plan_slug, mandate.billing_period)}
                                        {mandate.amount_minor > 0
                                            ? ` · up to ${formatInrCurrency(mandate.amount_minor / 100, { maximumFractionDigits: 0 })}`
                                            : ''}
                                    </span>
                                </div>
                                <div className="billing-method-status">
                                    <ProviderModeBadge mode={normalizeProviderMode(mandate.provider_mode)} />
                                    <Badge label={meta.label} variant={meta.variant} />
                                </div>
                            </div>
                        )
                    })}
                    {!hideAddButton && (
                        <div className="billing-method-add-row">
                            <Button variant="secondary" onClick={() => setModalOpen(true)} disabled={!planSlug}>
                                <Plus className="letbuyy-icon" aria-hidden="true" />
                                Create test mandate
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <Modal
                open={modalOpen}
                title="Create test mandate"
                description="Create a sandbox mandate for this subscription plan. It does not activate live recurring debits."
                onClose={() => { if (!submitting) setModalOpen(false) }}
                footer={(
                    <div className="billing-modal-footer">
                        <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button onClick={() => void handleAdd()} loading={submitting} disabled={!planSlug}>
                            <ShieldCheck className="letbuyy-icon" aria-hidden="true" />
                            Create sandbox mandate
                        </Button>
                    </div>
                )}
            >
                <div className="billing-modal-body">
                    <div className="billing-modal-provider">
                        <span className="billing-modal-provider-icon">
                            <Smartphone className="letbuyy-icon" aria-hidden="true" />
                        </span>
                        <div className="billing-modal-provider-copy">
                            <span className="billing-modal-provider-title">UPI AutoPay sandbox</span>
                            <span className="billing-modal-provider-desc">
                                Test-only mandate record. No live UPI debit is initiated.
                            </span>
                        </div>
                        <ProviderModeBadge mode="sandbox" />
                    </div>

                    <Select
                        label="Billing cycle"
                        value={billingPeriod}
                        options={[
                            { value: 'monthly', label: 'Monthly' },
                            { value: 'yearly', label: 'Yearly' },
                        ]}
                        onChange={(e) => setBillingPeriod(e.target.value === 'yearly' ? 'yearly' : 'monthly')}
                    />

                    <div className="billing-modal-note">
                        <Info className="letbuyy-icon" aria-hidden="true" />
                        <span>
                            This environment creates test mandate records only. Live AutoPay requires provider activation
                            and a separate verified checkout flow.
                        </span>
                    </div>
                </div>
            </Modal>
        </>
    )
}
