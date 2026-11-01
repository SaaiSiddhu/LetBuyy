'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { StorePaymentConfigSchema, type StorePaymentConfig, type StorePaymentSetup } from '@letbuyy/shared-types'
import { Banner, Button, Card, Input, Section, ShieldCheck, Skeleton, Switch, ThemeToggleButton, useToast } from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { useReadRequest } from '@/lib/api/use-read-request'
import { readRazorpayTestKeyCsv } from '@/lib/payments/razorpay-csv'
import { PaymentSetupOverview } from './payment-setup-overview'

type ReadyConfig = StorePaymentConfig & { setup: StorePaymentSetup }
type Payload = { data?: unknown; error?: string | { message?: string } }
type MutationScope = { store: string; active: boolean; busy: boolean }

function parseConfig(value: unknown): ReadyConfig {
    const config = StorePaymentConfigSchema.parse(value)
    if (!config.setup) throw new Error('Payment readiness could not be confirmed. Reload after the payment API is updated.')
    return { ...config, setup: config.setup }
}

function errorMessage(payload: Payload | null, fallback: string) {
    return typeof payload?.error === 'string' ? payload.error : payload?.error?.message || fallback
}

export default function PaymentsSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const beginRead = useReadRequest(store)
    const scopeRef = useRef<MutationScope>({ store, active: false, busy: false })
    const pendingRef = useRef<{ body: string; key: string } | null>(null)
    const [loadedStore, setLoadedStore] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [config, setConfig] = useState<ReadyConfig | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [formError, setFormError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [keyId, setKeyId] = useState('')
    const [keySecret, setKeySecret] = useState('')
    const [webhookSecret, setWebhookSecret] = useState('')
    const [attachedWebhookSecret, setAttachedWebhookSecret] = useState('')
    const hasUnsavedChanges = useMemo(() => Boolean(keyId || keySecret || webhookSecret || attachedWebhookSecret),
        [keyId, keySecret, webhookSecret, attachedWebhookSecret])

    useLayoutEffect(() => {
        const scope = { store, active: true, busy: false }
        scopeRef.current = scope
        pendingRef.current = null
        setKeyId(''); setKeySecret(''); setWebhookSecret(''); setAttachedWebhookSecret(''); setSaving(false); setFormError(null)
        return () => { scope.active = false }
    }, [store])

    const loadData = useCallback(async () => {
        const request = beginRead()
        setLoading(true); setLoadError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payment-config`, { cache: 'no-store', signal: request.signal })
            const payload = await response.json().catch(() => null) as Payload | null
            if (!request.isCurrent()) return
            if (!response.ok || !payload?.data) throw new Error(errorMessage(payload, 'Unable to load payment settings.'))
            setConfig(parseConfig(payload.data)); setLoadedStore(store); setFormError(null)
        } catch (error) {
            if (request.isCurrent()) setLoadError(error instanceof Error ? error.message : 'Unable to load payment settings.')
        } finally { if (request.isCurrent()) setLoading(false) }
    }, [beginRead, store])

    useEffect(() => { void loadData() }, [loadData])

    const mutate = useCallback(async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
        const scope = scopeRef.current
        if (!scope.active || scope.store !== store || scope.busy) return false
        scope.busy = true; setSaving(true); setFormError(null)
        const serialized = JSON.stringify(body)
        const fingerprint = `${store}:${method}:${serialized}`
        if (pendingRef.current?.body !== fingerprint) pendingRef.current = { body: fingerprint, key: crypto.randomUUID() }
        const idempotencyKey = pendingRef.current.key
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/payment-config`, {
                method, headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
                body: serialized, signal: AbortSignal.timeout(20_000),
            })
            const payload = await response.json().catch(() => null) as Payload | null
            if (!scope.active || scopeRef.current !== scope) return false
            if (!response.ok || !payload?.data) throw new Error(errorMessage(payload, 'Payment settings could not be confirmed. Reload before making another change.'))
            const next = parseConfig(payload.data)
            setConfig(next); pendingRef.current = null
            notify({ title: body.attach_to_existing === true ? 'Test webhook secret saved'
                : method === 'POST' ? 'Test credentials verified and saved' : 'Payment methods saved',
                description: method === 'POST' ? 'Online checkout remains off until you enable it explicitly.' : 'Checkout will apply the confirmed settings and store eligibility.', variant: 'success' })
            return true
        } catch (error) {
            if (scope.active && scopeRef.current === scope) setFormError(error instanceof Error ? error.message : 'Payment settings could not be confirmed. Reload to check the saved state.')
            return false
        } finally {
            if (scope.active && scopeRef.current === scope) { scope.busy = false; setSaving(false) }
        }
    }, [notify, store])

    const handleSave = useCallback(async () => {
        if (attachedWebhookSecret.trim()) { setFormError('Save one connection change at a time. Discard the separate webhook change first.'); return }
        if (!keyId.trim() || !keySecret.trim()) { setFormError('Enter both your Razorpay test key ID and key secret.'); return }
        const scope = scopeRef.current
        const saved = await mutate('POST', { key_id: keyId.trim(), key_secret: keySecret.trim(),
            ...(webhookSecret.trim() ? { webhook_secret: webhookSecret.trim() } : {}), test_mode: true,
            ...(config?.revision ? { expected_revision: config.revision } : {}) })
        if (saved && scope.active && scopeRef.current === scope) { setKeyId(''); setKeySecret(''); setWebhookSecret('') }
    }, [attachedWebhookSecret, config?.revision, keyId, keySecret, webhookSecret, mutate])

    const handleAttachWebhook = useCallback(async () => {
        if (keyId.trim() || keySecret.trim() || webhookSecret.trim()) {
            setFormError('Save one connection change at a time. Discard the replacement credentials first.')
            return
        }
        if (!attachedWebhookSecret.trim() || !config?.revision) {
            setFormError('Reload the saved connection and enter its separate Razorpay test webhook secret.')
            return
        }
        const scope = scopeRef.current
        const saved = await mutate('POST', { attach_to_existing: true,
            webhook_secret: attachedWebhookSecret.trim(), expected_revision: config.revision })
        if (saved && scope.active && scopeRef.current === scope) setAttachedWebhookSecret('')
    }, [attachedWebhookSecret, config?.revision, keyId, keySecret, webhookSecret, mutate])

    const handleToggle = useCallback((field: 'online_payment_enabled' | 'cod_enabled', value: boolean) => {
        void mutate('PATCH', { [field]: value, ...(config?.revision ? { expected_revision: config.revision } : {}) })
    }, [config?.revision, mutate])

    const discard = () => { if (saving) return; setKeyId(''); setKeySecret(''); setWebhookSecret(''); setAttachedWebhookSecret(''); setFormError(null); pendingRef.current = null }
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void handleSave() }
    const current = loadedStore === store ? config : null
    const controlsUnavailable = saving || loading || Boolean(loadError) || !current?.schema_ready

    return <SettingsPane navigationKey="payments" title="Payments" store={store}
        description="Choose how customers pay and review your connection and settlement readiness."
        secondaryActions={[{ label: 'View settlements', href: `/${encodeURIComponent(store)}/payouts` }]}
        header={{ titleAdornment: <ThemeToggleButton label="Toggle payment settings theme" /> }}
        saveBar={current && !loadError && !loading ? { state: saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved',
            onSave: () => void (attachedWebhookSecret.trim() ? handleAttachWebhook() : handleSave()), onDiscard: discard,
            saveLabel: attachedWebhookSecret.trim() ? 'Save test webhook' : 'Save test connection' } : undefined}>
        {loadError && <Banner variant="critical" title="Payment settings could not load" action={<Button variant="secondary" onClick={() => void loadData()} disabled={saving}>Retry</Button>}>{loadError}</Banner>}
        {formError && <Banner variant="critical" title="Payment settings need attention" action={<Button variant="secondary" onClick={() => void loadData()} disabled={saving}>Reload saved settings</Button>}>{formError}</Banner>}
        {loading || (!current && !loadError) ? <><Skeleton variant="card" /><Skeleton variant="card" /></> : current && <>
            <PaymentSetupOverview config={current} store={store} />
            <Card><Section title="Payment methods" description="Your connection and store eligibility determine what appears at checkout.">
                <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                    <Switch label="Online payments" checked={current.online_payment_enabled}
                        disabled={controlsUnavailable || (!current.setup.can_enable_online && !current.online_payment_enabled)}
                        description={current.setup.online_checkout_available ? 'Test checkout is available. No real money is collected.' : 'Online checkout is unavailable until the connection is ready and enabled.'}
                        onCheckedChange={value => handleToggle('online_payment_enabled', value)} />
                    <Switch label="Cash on delivery" checked={current.cod_enabled} disabled={controlsUnavailable}
                        description="COD is independent of Razorpay. Delivery and serviceability rules still apply."
                        onCheckedChange={value => handleToggle('cod_enabled', value)} />
                </div>
            </Section></Card>
            <Card><Section title="Test connection" description="Use sandbox credentials to validate your store before live onboarding.">
                <details open={!current.payment_settings.razorpay?.secret_configured}>
                    <summary className="cursor-pointer font-[var(--lb-font-weight-semibold)]">{current.payment_settings.razorpay?.secret_configured ? 'Replace test credentials' : 'Connect your Razorpay test account'}</summary>
                    <form onSubmit={handleSubmit} className="grid gap-[var(--lb-space-4)] pt-[var(--lb-space-4)]">
                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                            <Input label="Razorpay test key ID" value={keyId} onChange={event => setKeyId(event.target.value)} disabled={controlsUnavailable} placeholder="rzp_test_..." autoComplete="off" />
                            <Input label="Razorpay test key secret" value={keySecret} onChange={event => setKeySecret(event.target.value)} disabled={controlsUnavailable} type="password" autoComplete="new-password" helperText="Stored securely and never shown after saving." leftIcon={<ShieldCheck aria-hidden="true" className="letbuyy-icon" />} />
                        </div>
                        <Input label="Razorpay test webhook secret" value={webhookSecret} onChange={event => setWebhookSecret(event.target.value)}
                            disabled={controlsUnavailable} type="password" autoComplete="new-password"
                            helperText="Use the separate secret you set for this store's Razorpay test webhook. It is stored privately and never shown again." />
                        <Input label="Import Razorpay test-key CSV" type="file" accept=".csv,text/csv" disabled={controlsUnavailable} onChange={async event => {
                            const input = event.currentTarget; const scope = scopeRef.current; const file = input.files?.[0]
                            if (!file) return
                            try {
                                if (file.size > 4096) throw new Error('Choose a test-key CSV smaller than 4 KB.')
                                const keys = readRazorpayTestKeyCsv(await file.text())
                                if (!scope.active || scopeRef.current !== scope || scope.busy) return
                                setKeyId(keys.key_id); setKeySecret(keys.key_secret); setFormError(null)
                            } catch {
                                if (scope.active && scopeRef.current === scope) setFormError('Choose a one-row Razorpay test-key CSV. Live keys are not accepted.')
                            } finally { input.value = '' }
                        }} />
                        <p className="text-[var(--lb-color-text-subdued)]">Saving replacement credentials turns online checkout off. Enable it only after verification; COD remains unchanged.</p>
                        <div><Button type="submit" loading={saving} disabled={!hasUnsavedChanges || controlsUnavailable}>Verify and save test credentials</Button></div>
                    </form>
                </details>
                {current.payment_settings.razorpay?.secret_configured && <form onSubmit={event => { event.preventDefault(); void handleAttachWebhook() }}
                    className="grid gap-[var(--lb-space-3)] pt-[var(--lb-space-4)]">
                    <Input label="Separate Razorpay test webhook secret" value={attachedWebhookSecret}
                        onChange={event => setAttachedWebhookSecret(event.target.value)} disabled={controlsUnavailable}
                        type="password" autoComplete="new-password"
                        helperText="Add or rotate the callback secret without re-entering your saved API key. This creates a new connection version and turns online checkout off until you re-enable it." />
                    <div><Button type="submit" loading={saving} disabled={controlsUnavailable || !attachedWebhookSecret.trim() || !current.revision}>
                        {current.payment_settings.razorpay.webhook_secret_configured ? 'Replace test webhook secret' : 'Add test webhook secret'}
                    </Button></div>
                </form>}
                {current.webhook_callback_url && <div className="grid gap-[var(--lb-space-3)] pt-[var(--lb-space-4)]">
                    <Input label="This store's test webhook URL" value={current.webhook_callback_url} readOnly
                        helperText="Add this URL in your Razorpay test dashboard with the separate webhook secret you saved above. Select payment.captured, payment.failed, refund.created, refund.processed, and refund.failed. Delivery is unverified until a signed event arrives." />
                </div>}
                {current.payment_settings.razorpay?.webhook_secret_configured && !current.webhook_callback_url &&
                    <p className="pt-[var(--lb-space-4)] text-[var(--lb-color-text-subdued)]">The webhook URL is available after this connection is deployed to staging or production. Local test connections cannot receive Razorpay callbacks.</p>}
                {current.online_payment_enabled && <Banner variant="warning" title="Confirm signed callback delivery">
                    This page does not show webhook delivery status. Save the separate webhook secret, enable this store’s exact callback URL in Razorpay Test Mode, then confirm a signed event and reconciliation record before treating test checkout as verified.
                </Banner>}
            </Section></Card>
            <Banner variant="warning" title="Live payments require provider qualification">
                Business and bank approval are separate from API-key verification. Live collection and bank settlement remain unavailable until the provider integration is qualified.
            </Banner>
        </>}
    </SettingsPane>
}
