'use client'

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Badge,
    Banner,
    Card,
    CreditCard,
    IndianRupee,
    Key,
    Section,
    ShieldCheck,
    Skeleton,
    Truck,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { ProviderModeBadge, normalizeProviderMode } from '@/components/ProviderModeBadge'

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
    provider_mode: 'mock' | 'sandbox' | 'live'
    payment_settings: SanitizedPaymentSettings
}

type PaymentConfigPayload = {
    data?: unknown
    error?: string | { message?: string }
}

type SaveState = 'saved' | 'unsaved' | 'saving'

function getPayloadError(payload: PaymentConfigPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function normalizePaymentConfig(value: unknown): PaymentConfig {
    const data = isRecord(value) ? value : {}
    const settings = isRecord(data.payment_settings) ? data.payment_settings : {}
    const razorpayData = isRecord(settings.razorpay) ? settings.razorpay : null

    return {
        store_id: readString(data.store_id),
        online_payment_enabled: data.online_payment_enabled === true,
        cod_enabled: data.cod_enabled === true,
        provider_mode: normalizeProviderMode(data.provider_mode) || 'mock',
        payment_settings: {
            mode: settings.mode === 'ownAccount' ? 'ownAccount' : 'shared',
            gateways: Array.isArray(settings.gateways) ? settings.gateways.filter((gateway): gateway is string => typeof gateway === 'string') : [],
            razorpay: razorpayData ? {
                key_id: typeof razorpayData.key_id === 'string' ? razorpayData.key_id : null,
                test_mode: typeof razorpayData.test_mode === 'boolean' ? razorpayData.test_mode : true,
                verified: razorpayData.verified === true,
                connected_at: typeof razorpayData.connected_at === 'string' ? razorpayData.connected_at : null,
                updated_at: typeof razorpayData.updated_at === 'string' ? razorpayData.updated_at : null,
                secret_configured: razorpayData.secret_configured === true,
            } : null,
        },
    }
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

            const nextConfig = normalizePaymentConfig(payload.data)
            const nextTestMode = nextConfig.payment_settings.razorpay?.test_mode ?? true
            setConfig(nextConfig)
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

            const nextConfig = normalizePaymentConfig(payload.data)
            const nextRazorpay = nextConfig.payment_settings.razorpay
            const nextTestMode = nextRazorpay?.test_mode ?? testMode
            setConfig(nextConfig)
            setKeyId('')
            setKeySecret('')
            setTestMode(nextTestMode)
            setInitialTestMode(nextTestMode)
            setSaveState('saved')
            notify({
                title: nextRazorpay?.verified ? 'Razorpay connected' : 'Razorpay credentials saved',
                description: nextRazorpay?.verified
                    ? 'The seller Razorpay account is connected and verified.'
                    : 'Verification did not complete. Re-check the credentials before going live.',
                variant: nextRazorpay?.verified ? 'success' : 'warning',
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
                title="Payments"
                description="Connect provider credentials and review storefront payment availability."
                store={store}
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
    const providerMode = normalizeProviderMode(config?.provider_mode)
    const status = razorpay?.verified
        ? { label: 'Verified', variant: 'success' as const }
        : razorpay?.secret_configured
            ? { label: 'Saved', variant: 'warning' as const }
            : { label: 'Not connected', variant: 'default' as const }

    return (
        <SettingsPane
            title="Payments"
            description="Connect provider credentials and review storefront payment availability."
            store={store}
            guidance={{
                title: 'Secret handling',
                body: 'Secrets are sent to the LetBuyy API worker and stored encrypted. The admin UI only receives masked payment settings.',
            }}
            saveBar={{
                state: activeSaveState,
                onSave: () => void handleSave(),
                onDiscard: handleDiscard,
                saveLabel: 'Save payments',
            }}
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
                    action={(
                        <div className="flex flex-wrap items-center justify-end gap-[var(--lb-space-2)]">
                            <ProviderModeBadge mode={providerMode} />
                            <Badge label={status.label} variant={status.variant} />
                        </div>
                    )}
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
                            <Input unstyled
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

            <Banner variant="warning" title="Before going live">
                Test payments should be verified end to end before switching a store to live Razorpay credentials.
            </Banner>

            <Card>
                <Section
                    title="Accepted methods"
                    description="These options reflect the current masked provider configuration returned by the platform."
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                        <PaymentSummary
                            icon={<IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Account mode"
                            value={config?.payment_settings.mode === 'ownAccount' ? 'Seller Razorpay account' : 'Shared LetBuyy account'}
                        />
                        <PaymentSummary
                            icon={<CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Gateways"
                            value={config?.payment_settings.gateways.length ? config.payment_settings.gateways.join(', ') : 'No gateways configured'}
                        />
                    </div>
                </Section>
            </Card>
        </SettingsPane>
    )
}
