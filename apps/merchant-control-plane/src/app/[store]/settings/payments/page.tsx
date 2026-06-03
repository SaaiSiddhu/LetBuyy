'use client'

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    CreditCard,
    IndianRupee,
    Input,
    Key,
    SaveBar,
    Section,
    ShieldCheck,
    Skeleton,
    Truck,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings'

type SanitizedPaymentSettings = {
    mode: 'shared' | 'ownAccount'
    gateways: string[]
    razorpay: {
        key_id: string | null
        test_mode: boolean
        verified: boolean
        connected_at: string | null
        updated_at: string | null
        secret_configured: boolean
    } | null
}

type PaymentConfig = {
    store_id: string
    online_payment_enabled: boolean
    cod_enabled: boolean
    payment_settings: SanitizedPaymentSettings
}

type PaymentConfigPayload = {
    data?: PaymentConfig
    error?: string | { message?: string }
}

type SaveState = 'saved' | 'unsaved' | 'saving'

function getPayloadError(payload: PaymentConfigPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

interface PaymentSummaryProps {
    icon: ReactNode
    label: string
    value: string
}

function PaymentSummary({ icon, label, value }: PaymentSummaryProps) {
    return (
        <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                {icon}
            </span>
            <span className="min-w-0 space-y-[var(--lb-space-1)]">
                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {label}
                </span>
                <span className="block truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {value}
                </span>
            </span>
        </div>
    )
}

type ProviderStatusVariant = 'default' | 'info' | 'success' | 'warning' | 'critical'

interface ProviderCardProps {
    icon: ReactNode
    name: string
    description: string
    statusLabel: string
    statusVariant: ProviderStatusVariant
    helperText?: string
}

function ProviderCard({
    icon,
    name,
    description,
    statusLabel,
    statusVariant,
    helperText,
}: ProviderCardProps) {
    return (
        <article className="flex min-w-0 flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                <div className="flex min-w-0 items-start gap-[var(--lb-space-3)]">
                    <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                        {icon}
                    </span>
                    <div className="min-w-0 space-y-[var(--lb-space-1)]">
                        <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {name}
                        </h3>
                        <p className="m-0 text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                            {description}
                        </p>
                    </div>
                </div>
                <Badge label={statusLabel} variant={statusVariant} />
            </div>
            {helperText && (
                <p className="m-0 rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {helperText}
                </p>
            )}
        </article>
    )
}

export default function PaymentsSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [config, setConfig] = useState<PaymentConfig | null>(null)
    const [keyId, setKeyId] = useState('')
    const [keySecret, setKeySecret] = useState('')
    const [testMode, setTestMode] = useState(true)
    const [initialTestMode, setInitialTestMode] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [formError, setFormError] = useState<string | null>(null)

    const hasUnsavedChanges = useMemo(
        () => Boolean(keyId.trim() || keySecret.trim() || testMode !== initialTestMode),
        [initialTestMode, keyId, keySecret, testMode],
    )
    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    const loadData = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        setFormError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payment-config`, {
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as PaymentConfigPayload | null

            if (!response.ok || !payload?.data) {
                throw new Error(getPayloadError(payload, 'Unable to load payment settings'))
            }

            const nextTestMode = payload.data.payment_settings.razorpay?.test_mode ?? true
            setConfig(payload.data)
            setTestMode(nextTestMode)
            setInitialTestMode(nextTestMode)
            setKeyId('')
            setKeySecret('')
            setSaveState('saved')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load payment settings'
            setLoadError(message)
            notify({
                title: 'Payment settings could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const handleSave = useCallback(async () => {
        if (saveState === 'saving') return

        const trimmedKeyId = keyId.trim()
        const trimmedSecret = keySecret.trim()
        setFormError(null)

        if (!trimmedKeyId || !trimmedSecret) {
            const message = 'Enter both Razorpay key ID and key secret.'
            setFormError(message)
            notify({
                title: 'Razorpay credentials are incomplete',
                description: message,
                variant: 'warning',
            })
            return
        }

        setSaveState('saving')

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payment-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key_id: trimmedKeyId,
                    key_secret: trimmedSecret,
                    test_mode: testMode,
                }),
            })
            const payload = (await response.json().catch(() => null)) as PaymentConfigPayload | null

            if (!response.ok || !payload?.data) {
                throw new Error(getPayloadError(payload, 'Unable to save payment settings'))
            }

            const nextTestMode = payload.data.payment_settings.razorpay?.test_mode ?? testMode
            setConfig(payload.data)
            setKeyId('')
            setKeySecret('')
            setTestMode(nextTestMode)
            setInitialTestMode(nextTestMode)
            setSaveState('saved')
            notify({
                title: payload.data.payment_settings.razorpay?.verified ? 'Razorpay connected' : 'Razorpay credentials saved',
                description: payload.data.payment_settings.razorpay?.verified
                    ? 'The seller Razorpay account is connected and verified.'
                    : 'Verification did not complete. Re-check the credentials before going live.',
                variant: payload.data.payment_settings.razorpay?.verified ? 'success' : 'warning',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save payment settings'
            setFormError(message)
            setSaveState('unsaved')
            notify({
                title: 'Could not save payment settings',
                description: message,
                variant: 'critical',
            })
        }
    }, [keyId, keySecret, notify, saveState, store, testMode])

    const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void handleSave()
    }, [handleSave])

    const handleDiscard = useCallback(() => {
        setKeyId('')
        setKeySecret('')
        setTestMode(initialTestMode)
        setFormError(null)
        setSaveState('saved')
        notify({
            title: 'Changes discarded',
            description: 'Payment credentials were reset to the last saved state.',
            variant: 'info',
        })
    }, [initialTestMode, notify])

    if (loading) {
        return (
            <SettingsPane
                store={store}
                title="Payments"
                description="Connect provider credentials and review storefront payment availability."
                iconName="payments"
            >
                <Card>
                    <Section title="Razorpay account">
                        <Skeleton variant="text" lines={4} />
                    </Section>
                </Card>
                <Skeleton variant="card" />
            </SettingsPane>
        )
    }

    const razorpay = config?.payment_settings.razorpay
    const status = razorpay?.verified
        ? { label: 'Verified', variant: 'success' as const }
        : razorpay?.secret_configured
            ? { label: 'Saved', variant: 'warning' as const }
            : { label: 'Not connected', variant: 'default' as const }
    const gateways = config?.payment_settings.gateways ?? []
    const hasCashfree = gateways.includes('cashfree')
    const hasUpi = gateways.includes('upi')

    return (
        <SettingsPane
            store={store}
            title="Payments"
            description="Connect provider credentials and review storefront payment availability."
            iconName="payments"
            saveBar={(
                <SaveBar
                    state={activeSaveState}
                    onSave={() => void handleSave()}
                    onDiscard={handleDiscard}
                    saveLabel="Save payments"
                />
            )}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Payment settings could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            {formError && (
                <Banner variant="critical" title="Payment settings need attention">
                    {formError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Razorpay account"
                    description="Connect the seller Razorpay account used by storefront checkout and Flutter builder flows."
                    action={<Badge label={status.label} variant={status.variant} />}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <PaymentSummary
                            icon={<Key className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Key ID"
                            value={razorpay?.key_id || 'No key configured'}
                        />
                        <PaymentSummary
                            icon={<CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Online checkout"
                            value={config?.online_payment_enabled ? 'Online payments enabled' : 'Online payments disabled'}
                        />
                        <PaymentSummary
                            icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Cash on delivery"
                            value={config?.cod_enabled ? 'COD available' : 'COD disabled'}
                        />
                    </div>

                    <form onSubmit={handleSubmit} className="grid gap-[var(--lb-space-4)]">
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input
                                label="Razorpay key ID"
                                value={keyId}
                                onChange={(event) => setKeyId(event.target.value)}
                                placeholder={testMode ? 'rzp_test_...' : 'rzp_live_...'}
                                autoComplete="off"
                                helperText="Paste the key ID from the seller Razorpay dashboard."
                                leftIcon={<Key className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            />
                            <Input
                                label="Razorpay key secret"
                                value={keySecret}
                                onChange={(event) => setKeySecret(event.target.value)}
                                placeholder="Paste key secret"
                                type="password"
                                autoComplete="new-password"
                                helperText="The secret is submitted securely and never shown after saving."
                                leftIcon={<ShieldCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            />
                        </div>

                        <label
                            htmlFor="razorpay-test-mode"
                            className="flex cursor-pointer items-start justify-between gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] transition-colors hover:bg-[var(--lb-color-surface-subdued)]"
                        >
                            <span className="min-w-0 space-y-[var(--lb-space-1)]">
                                <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                    Use Razorpay test mode
                                </span>
                                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    Keep test mode on while validating credentials and payment flows.
                                </span>
                            </span>
                            <input
                                id="razorpay-test-mode"
                                checked={testMode}
                                onChange={(event) => setTestMode(event.target.checked)}
                                type="checkbox"
                                className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            />
                        </label>

                        <div>
                            <Button type="submit" loading={saveState === 'saving'}>
                                {razorpay?.secret_configured ? 'Update Razorpay keys' : 'Connect Razorpay'}
                            </Button>
                        </div>
                    </form>
                </Section>
            </Card>

            <Banner variant="info" title="Secret handling">
                Secrets are sent to the LetBuyy API worker and stored encrypted. The admin UI only receives masked payment settings.
            </Banner>

            <Banner variant="warning" title="Before going live">
                Test payments should be verified end to end before switching a store to live Razorpay credentials.
            </Banner>

            <Card>
                <Section
                    title="Payment providers"
                    description="Review checkout payment methods from the masked provider configuration returned by the platform."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        <ProviderCard
                            icon={<CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            name="Razorpay"
                            description="Online card, wallet, netbanking, and UPI payments through the seller account."
                            statusLabel={status.label}
                            statusVariant={status.variant}
                            helperText={razorpay?.secret_configured ? 'Credentials are saved in the worker and masked in the merchant UI.' : 'Add seller Razorpay credentials above to enable online checkout.'}
                        />
                        <ProviderCard
                            icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            name="Cash on delivery"
                            description="Allow shoppers to place orders with payment collected during fulfillment."
                            statusLabel={config?.cod_enabled ? 'Enabled' : 'Disabled'}
                            statusVariant={config?.cod_enabled ? 'success' : 'default'}
                            helperText="COD availability is returned by the payment configuration endpoint."
                        />
                        <ProviderCard
                            icon={<CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            name="Cashfree"
                            description="India payment gateway option for cards, netbanking, UPI, and wallets."
                            statusLabel={hasCashfree ? 'Available' : 'Needs backend'}
                            statusVariant={hasCashfree ? 'info' : 'warning'}
                            helperText={hasCashfree ? 'Cashfree appears in the configured gateway list.' : 'Payment settings do not yet expose Cashfree enable/configure controls for this pane.'}
                        />
                        <ProviderCard
                            icon={<IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            name="UPI"
                            description="UPI collection through the active online payment gateway."
                            statusLabel={hasUpi ? 'Enabled' : 'Needs backend'}
                            statusVariant={hasUpi ? 'success' : 'warning'}
                            helperText={hasUpi ? 'UPI is included in the configured gateway list.' : 'Payment settings do not yet expose standalone UPI enable/configure controls for this pane.'}
                        />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Accepted methods"
                    description="These values are derived from the current masked provider configuration."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        <PaymentSummary
                            icon={<IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Provider mode"
                            value={config?.payment_settings.mode === 'ownAccount' ? 'Seller Razorpay account' : 'Shared LetBuyy account'}
                        />
                        <PaymentSummary
                            icon={<CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Gateways"
                            value={gateways.length ? gateways.join(', ') : 'No gateways configured'}
                        />
                    </div>
                </Section>
            </Card>
        </SettingsPane>
    )
}
