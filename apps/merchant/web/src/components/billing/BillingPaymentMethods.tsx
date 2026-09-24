'use client'

import { useCallback, useState } from 'react'
import { Badge, Button, CheckCircle2, CreditCard, Info, Input, Modal, normalizeProviderMode, Plus, ProviderModeBadge, Select, ShieldCheck, Smartphone, useToast } from '@letbuyy/ui'
import { formatInrCurrency } from '@letbuyy/ui/formatting'

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
    const cadence = period === 'yearly' ? 'yearly' : 'monthly'
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
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(
        currentBillingPeriod === 'yearly' ? 'yearly' : 'monthly',
    )
    const [upiVpa, setUpiVpa] = useState('')

    const planSlug = currentPlanSlug && ['starter', 'business', 'enterprise'].includes(currentPlanSlug)
        ? currentPlanSlug
        : 'starter'

    const handleAdd = useCallback(async () => {
        if (submitting) return
        setSubmitting(true)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_slug: planSlug,
                    billing_period: billingPeriod,
                    upi_vpa: upiVpa.trim() || undefined,
                }),
            })
            const payload = (await response.json().catch(() => null)) as { error?: string | { message?: string } } | null
            if (!response.ok) {
                const message = typeof payload?.error === 'string'
                    ? payload.error
                    : payload?.error?.message || 'Unable to add payment method'
                throw new Error(message)
            }
            setModalOpen(false)
            setUpiVpa('')
            notify({
                title: 'Payment method added',
                description: 'Razorpay UPI AutoPay is set up for your subscription billing.',
                variant: 'success',
            })
            onChanged()
        } catch (error) {
            notify({
                title: 'Could not add payment method',
                description: error instanceof Error ? error.message : 'Unable to add payment method',
                variant: 'critical',
            })
        } finally {
            setSubmitting(false)
        }
    }, [billingPeriod, notify, onChanged, planSlug, store, submitting, upiVpa])

    return (
        <>
            {mandates.length === 0 ? (
                <div className="billing-method-empty">
                    <span className="billing-method-empty-icon">
                        <CreditCard className="letbuyy-icon" aria-hidden="true" />
                    </span>
                    <div className="billing-method-empty-copy">
                        <span className="billing-method-empty-title">No payment method yet</span>
                        <span className="billing-method-empty-desc">
                            Add a Razorpay UPI AutoPay method so your LetBuyy subscription renews automatically.
                        </span>
                    </div>
                    <Button onClick={() => setModalOpen(true)}>
                        <Plus className="letbuyy-icon" aria-hidden="true" />
                        Add payment method
                    </Button>
                </div>
            ) : (
                <div className="billing-method-list">
                    {mandates.map((mandate, index) => {
                        const meta = statusMeta(mandate.status)
                        const isDefault = index === 0 && mandate.status === 'active'
                        return (
                            <div key={mandate.id} className="billing-method-item">
                                <span className="billing-method-icon">
                                    <Smartphone className="letbuyy-icon" aria-hidden="true" />
                                </span>
                                <div className="billing-method-meta">
                                    <div className="billing-method-title-row">
                                        <span className="billing-method-title">Razorpay UPI AutoPay</span>
                                        {isDefault && <Badge label="Default" variant="success" />}
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
                            <Button variant="secondary" onClick={() => setModalOpen(true)}>
                                <Plus className="letbuyy-icon" aria-hidden="true" />
                                Add payment method
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <Modal
                open={modalOpen}
                title="Add payment method"
                description="Authorise a Razorpay UPI AutoPay mandate to pay for your LetBuyy subscription automatically."
                onClose={() => { if (!submitting) setModalOpen(false) }}
                footer={(
                    <div className="billing-modal-footer">
                        <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button onClick={() => void handleAdd()} loading={submitting}>
                            <ShieldCheck className="letbuyy-icon" aria-hidden="true" />
                            Set up with Razorpay
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
                            <span className="billing-modal-provider-title">Razorpay UPI AutoPay</span>
                            <span className="billing-modal-provider-desc">
                                Recurring subscription debits via UPI mandate (NPCI).
                            </span>
                        </div>
                        <Badge label="Recommended" variant="success" />
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

                    <Input
                        label="UPI ID (optional)"
                        value={upiVpa}
                        onChange={(e) => setUpiVpa(e.target.value)}
                        placeholder="yourname@upi"
                        helperText="Leave blank to choose your UPI app during Razorpay authorisation."
                        autoComplete="off"
                    />

                    <div className="billing-modal-note">
                        <Info className="letbuyy-icon" aria-hidden="true" />
                        <span>
                            LetBuyy is not an RBI-licensed payment aggregator, so we never store your card or UPI
                            credentials. Razorpay (an RBI-authorised PA) securely holds the mandate; we keep only a
                            reference to it.
                        </span>
                    </div>

                    <div className="billing-modal-note billing-modal-note--ok">
                        <CheckCircle2 className="letbuyy-icon" aria-hidden="true" />
                        <span>You can cancel the mandate anytime from your bank or UPI app.</span>
                    </div>
                </div>
            </Modal>
        </>
    )
}
