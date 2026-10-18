'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    CheckCircle2,
    IndianRupee,
    Info,
    Input,
    ShieldCheck,
    Skeleton,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { BillingPaymentMethods, type BillingMandateView } from '@/components/billing/BillingPaymentMethods'
import { deriveGstStateCode, gstStateName } from '@/lib/india/gst-states'

interface ProfileData {
    gstin: string | null
    gst_state_code: string | null
    legal_name: string | null
    currency: string
}

type BillingPayload = { data?: unknown; error?: string | { message?: string } }

function getPayloadError(payload: BillingPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback
}

function normalizeMandates(value: unknown): BillingMandateView[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((m) => {
        if (!isRecord(m) || typeof m.id !== 'string') return []
        const mode = m.provider_mode === 'live' ? 'live' : m.provider_mode === 'sandbox' ? 'sandbox' : null
        const amount = typeof m.amount_minor === 'number' ? m.amount_minor : Number(m.amount_minor) || 0
        return [{
            id: m.id,
            provider: readString(m.provider, 'upi_autopay'),
            provider_mode: mode,
            status: readString(m.status, 'pending_provider'),
            plan_slug: readString(m.plan_slug, 'starter'),
            billing_period: readString(m.billing_period, 'monthly'),
            amount_minor: amount,
            currency: readString(m.currency, 'INR'),
        }]
    })
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export default function BillingProfilePage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [profile, setProfile] = useState<ProfileData>({ gstin: null, gst_state_code: null, legal_name: null, currency: 'INR' })
    const [mandates, setMandates] = useState<BillingMandateView[]>([])

    const [gstinInput, setGstinInput] = useState('')
    const [editingGstin, setEditingGstin] = useState(false)
    const [savingGstin, setSavingGstin] = useState(false)

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, { cache: 'no-store' })
            const payload = (await response.json().catch(() => null)) as BillingPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load billing profile'))

            const data = isRecord(payload?.data) ? payload.data : {}
            const p = isRecord(data.profile) ? data.profile : {}
            const next: ProfileData = {
                gstin: typeof p.gstin === 'string' ? p.gstin : null,
                gst_state_code: typeof p.gst_state_code === 'string' ? p.gst_state_code : null,
                legal_name: typeof p.legal_name === 'string' ? p.legal_name : null,
                currency: readString(p.currency, 'INR'),
            }
            setProfile(next)
            setGstinInput(next.gstin || '')
            setMandates(normalizeMandates(data.mandates))
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load billing profile'
            setLoadError(message)
            notify({ title: 'Billing profile could not load', description: message, variant: 'critical' })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => { void loadData() }, [loadData])

    const handleSaveGstin = useCallback(async () => {
        if (savingGstin) return
        const gstin = gstinInput.trim().toUpperCase()
        if (gstin && !GSTIN_RE.test(gstin)) {
            notify({ title: 'Invalid GSTIN', description: 'Enter a valid 15-character GSTIN (e.g. 22ABCDE1234F1Z5).', variant: 'warning' })
            return
        }
        setSavingGstin(true)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gstin: gstin || null,
                    gst_state_code: gstin ? deriveGstStateCode(gstin) || null : null,
                }),
            })
            const payload = (await response.json().catch(() => null)) as BillingPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to save GSTIN'))
            setEditingGstin(false)
            notify({
                title: gstin ? 'GSTIN saved' : 'GSTIN removed',
                description: gstin ? 'Your GST registration is on file for billing.' : 'GST registration cleared.',
                variant: 'success',
            })
            await loadData({ quiet: true })
        } catch (error) {
            notify({ title: 'Could not save GSTIN', description: error instanceof Error ? error.message : 'Unable to save GSTIN', variant: 'critical' })
        } finally {
            setSavingGstin(false)
        }
    }, [gstinInput, loadData, notify, savingGstin, store])

    if (loading) {
        return (
            <SettingsPane title="Billing profile" description="Your payment methods, tax ID, and billing currency." store={store}>
                <div className="settings-general-stack">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="settings-home-card">
                            <div className="settings-home-section-label"><Skeleton variant="text" lines={1} /></div>
                            <div className="settings-form-body"><Skeleton variant="text" lines={2} /></div>
                        </div>
                    ))}
                </div>
            </SettingsPane>
        )
    }

    const hasGstin = Boolean(profile.gstin)

    return (
        <SettingsPane
            title="Billing profile"
            description="Your payment methods, tax ID, and billing currency."
            store={store}
            secondaryActions={[{ label: 'Back to billing', onClick: () => router.push(`/${store}/settings/billing`) }]}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Billing profile could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            {/* ── Payment methods ───────────────────────────────────────────── */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Payment methods</div>
                <div className="settings-form-body">
                    <div className="settings-general-hint">For purchases and subscription bills in LetBuyy.</div>
                    <BillingPaymentMethods
                        store={store}
                        mandates={mandates}
                        onChanged={() => void loadData({ quiet: true })}
                    />
                </div>
            </div>

            {/* ── Tax ID (GSTIN) ────────────────────────────────────────────── */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Tax ID</div>
                <div className="settings-form-body">
                    <div className="settings-general-hint">
                        LetBuyy is required to charge GST in India. Your subscription bills may be exempt from
                        Indian GST if you are GST-registered and enter a valid GSTIN.
                    </div>

                    {hasGstin && !editingGstin ? (
                        <div className="billing-taxid-row">
                            <span className="billing-taxid-icon"><ShieldCheck className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="billing-taxid-meta">
                                <div className="billing-taxid-title-row">
                                    <span className="billing-taxid-value">{profile.gstin}</span>
                                    <Badge label="On file" variant="success" />
                                </div>
                                <span className="billing-taxid-sub">
                                    {profile.gst_state_code ? gstStateName(profile.gst_state_code) : 'Registered for GST'}
                                </span>
                            </div>
                            <Button variant="secondary" onClick={() => { setGstinInput(profile.gstin || ''); setEditingGstin(true) }}>
                                Edit
                            </Button>
                        </div>
                    ) : (
                        <div className="billing-taxid-form">
                            <Input
                                label="GSTIN"
                                value={gstinInput}
                                onChange={(e) => setGstinInput(e.target.value.toUpperCase().slice(0, 15))}
                                placeholder="22ABCDE1234F1Z5"
                                maxLength={15}
                                helperText={gstinInput && deriveGstStateCode(gstinInput)
                                    ? `State: ${gstStateName(deriveGstStateCode(gstinInput))}`
                                    : '15-character GST identification number.'}
                            />
                            <div className="billing-taxid-actions">
                                {(hasGstin || editingGstin) && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => { setGstinInput(profile.gstin || ''); setEditingGstin(false) }}
                                        disabled={savingGstin}
                                    >
                                        Cancel
                                    </Button>
                                )}
                                <Button onClick={() => void handleSaveGstin()} loading={savingGstin}>
                                    {hasGstin ? 'Save GSTIN' : 'Add GSTIN'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Currency ──────────────────────────────────────────────────── */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Currency</div>
                <div className="settings-form-body">
                    <div className="settings-general-hint">
                        Your billing currency is determined by your business country (India).
                    </div>
                    <div className="billing-currency-row">
                        <span className="billing-currency-icon"><IndianRupee className="letbuyy-icon" aria-hidden="true" /></span>
                        <div className="billing-currency-meta">
                            <span className="billing-currency-value">INR — Indian Rupee</span>
                            <span className="billing-currency-sub">Fixed for India-based stores.</span>
                        </div>
                        <Badge label="Default" variant="info" />
                    </div>
                    <div className="billing-modal-note billing-modal-note--ok">
                        <CheckCircle2 className="letbuyy-icon" aria-hidden="true" />
                        <span>All LetBuyy subscription charges and invoices are issued in INR.</span>
                    </div>
                </div>
            </div>

            <div className="billing-profile-foot">
                <Info className="letbuyy-icon" aria-hidden="true" />
                <span>Need to update your legal name or registered address? Edit them in Business details.</span>
            </div>
        </SettingsPane>
    )
}
