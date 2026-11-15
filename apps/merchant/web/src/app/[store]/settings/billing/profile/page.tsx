'use client'

import { useReadRequest } from '@/lib/api/use-read-request'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Section,
    Card,
    Badge,
    Banner,
    Button,
    CheckCircle2,
    ConfirmDialog,
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
    version: number | null
    storeId: string | null
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
    if (!Array.isArray(value)) throw new Error('Billing mandate list response is incomplete.')
    return value.map((m) => {
        if (!isRecord(m) || typeof m.id !== 'string' || !m.id ||
            typeof m.provider !== 'string' || typeof m.status !== 'string' ||
            typeof m.plan_slug !== 'string' || typeof m.billing_period !== 'string') {
            throw new Error('Billing mandate data is incomplete.')
        }
        const mode = m.provider_mode === 'live' ? 'live' : m.provider_mode === 'sandbox' ? 'sandbox' : null
        const amount = m.amount_minor === null || m.amount_minor === undefined || m.amount_minor === ''
            ? Number.NaN : Number(m.amount_minor)
        return {
            id: m.id,
            provider: m.provider,
            provider_mode: mode,
            status: m.status,
            plan_slug: m.plan_slug,
            billing_period: m.billing_period,
            amount_minor: Number.isFinite(amount) ? amount : Number.NaN,
            currency: readString(m.currency, 'INR'),
        }
    })
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export default function BillingProfilePage() {
    const { store } = useParams<{ store: string }>()
    const { actorId, siteId } = useMerchantSecurityContext(store)
    return <BillingProfileWorkspace key={JSON.stringify([actorId, siteId, store])} store={store} actorId={actorId} />
}
function BillingProfileWorkspace({ store, actorId }: { store: string; actorId: string }) {
    const active = useRef(true)
    useLayoutEffect(() => { active.current = true; return () => { active.current = false } }, [])
    const [saveNeedsReload, setSaveNeedsReload] = useState(false)
    const [reloadDialogOpen, setReloadDialogOpen] = useState(false)
    const router = useRouter()
    const { notify } = useToast()

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [profile, setProfile] = useState<ProfileData>({ version: null, storeId: null, gstin: null, gst_state_code: null, legal_name: null, currency: 'INR' })
    const [mandates, setMandates] = useState<BillingMandateView[]>([])

    const [gstinInput, setGstinInput] = useState('')
    const [editingGstin, setEditingGstin] = useState(false)
    const editing = useRef(false)
    const [editBase, setEditBase] = useState<ProfileData | null>(null)
    const [savingGstin, setSavingGstin] = useState(false)
    const changeEditing = (open: boolean) => {
        editing.current = open
        setEditBase(open ? profile : null)
        setEditingGstin(open)
    }

    const beginRead = useReadRequest(store)
    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, { cache: 'no-store', signal: request.signal })
            const payload = (await response.json().catch(() => null)) as BillingPayload | null
            if (!request.isCurrent()) return
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load billing profile'))

            if (!isRecord(payload?.data) || !isRecord(payload.data.profile) || !Array.isArray(payload.data.mandates)) {
                throw new Error('Billing profile response is incomplete.')
            }
            const data = payload.data
            const p = data.profile as Record<string, unknown>
            const next: ProfileData = {
                version: Number.isSafeInteger(p.version) && (p.version as number) > 0 ? p.version as number : null,
                storeId: typeof p.store_id === 'string' ? p.store_id : null,
                gstin: typeof p.gstin === 'string' ? p.gstin : null,
                gst_state_code: typeof p.gst_state_code === 'string' ? p.gst_state_code : null,
                legal_name: typeof p.legal_name === 'string' ? p.legal_name : null,
                currency: readString(p.currency, 'INR'),
            }
            setProfile(next)
            setSaveNeedsReload(false)
            if (!editing.current) {
                setGstinInput(next.gstin || '')
                if (!next.gstin) {
                    editing.current = true
                    setEditBase(next)
                    setEditingGstin(true)
                }
            }
            setMandates(normalizeMandates(data.mandates))
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load billing profile'
            setLoadError(message)
            notify({ title: 'Billing profile could not load', description: message, variant: 'critical' })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => { void loadData() }, [loadData])

    const handleSaveGstin = useCallback(async () => {
        const base = editBase
        if (!active.current || savingGstin || saveNeedsReload || base?.version == null || base.storeId === null) return
        const gstin = gstinInput.trim().toUpperCase()
        if (gstin && !GSTIN_RE.test(gstin)) {
            notify({ title: 'Invalid GSTIN', description: 'Enter a valid 15-character GSTIN (e.g. 22ABCDE1234F1Z5).', variant: 'warning' })
            return
        }
        setSavingGstin(true)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Merchant-Context': actorId, 'X-Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify({
                    version: base.version,
                    gstin: gstin || null,
                    gst_state_code: gstin ? deriveGstStateCode(gstin) || null : null,
                }),
            })
            const payload = (await response.json().catch(() => null)) as BillingPayload | null
            if (!active.current) return
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to save GSTIN'))
            if (!isRecord(payload?.data) || payload.data.id !== base.storeId || payload.data.version !== base.version + 1) throw new Error('The GSTIN save acknowledgement could not be confirmed. Reload the current profile.')
            editing.current = false
            setEditBase(null)
            setEditingGstin(false)
            notify({
                title: gstin ? 'GSTIN saved' : 'GSTIN removed',
                description: gstin ? 'Your GST registration is on file for billing.' : 'GST registration cleared.',
                variant: 'success',
            })
            await loadData({ quiet: true })
        } catch (error) {
            if (!active.current) return
            setSaveNeedsReload(true)
            notify({ title: 'Could not save GSTIN', description: error instanceof Error ? error.message : 'Unable to save GSTIN', variant: 'critical' })
        } finally {
            if (active.current) setSavingGstin(false)
        }
    }, [actorId, editBase, gstinInput, loadData, notify, saveNeedsReload, savingGstin, store])

    if (loading) {
        return (
            <SettingsPane navigationKey="billing" title="Billing profile" description="Your payment methods, tax ID, and billing currency." store={store}>
                <div className="settings-general-stack">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <Section><Skeleton variant="text" lines={1} /></Section>
                            <div className="settings-form-body"><Skeleton variant="text" lines={2} /></div>
                        </Card>
                    ))}
                </div>
            </SettingsPane>
        )
    }

    const hasGstin = Boolean(profile.gstin)

    return (
        <>
        <SettingsPane
                navigationKey="billing"
            title="Billing profile"
            description="Your payment methods, tax ID, and billing currency."
            store={store}
            secondaryActions={[
                { label: 'Refresh billing profile', onClick: () => void loadData({ quiet: true }), disabled: savingGstin },
                { label: 'Back to billing', onClick: () => router.push(`/${store}/settings/billing`) },
            ]}
        >
            {saveNeedsReload && <Banner variant="warning" title="Reload current billing profile before another GSTIN change"
                action={<Button variant="secondary" onClick={() => setReloadDialogOpen(true)}>Reload billing profile</Button>}>The save was refused or could not be confirmed. Your draft is retained until you reload.</Banner>}
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
            <Section variant="grouped" title="Payment methods" >

                    <div className="settings-general-hint">For purchases and subscription bills in LetBuyy.</div>
                    <BillingPaymentMethods
                        store={store}
                        mandates={mandates}
                        onChanged={() => void loadData({ quiet: true })}
                    />

            </Section>

            {/* ── Tax ID (GSTIN) ────────────────────────────────────────────── */}
            <Section variant="grouped" title="Tax ID" >

                    <div className="settings-general-hint">
                        Subscription prices include applicable taxes. Your billing details appear on the invoice;
                        entering a GSTIN does not by itself make a subscription exempt from GST.
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
                        <Button variant="secondary" disabled={profile.version === null || profile.storeId === null || saveNeedsReload} onClick={() => { setGstinInput(profile.gstin || ''); changeEditing(true) }}>
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
                                        onClick={() => { setGstinInput(profile.gstin || ''); changeEditing(false) }}
                                        disabled={savingGstin}
                                    >
                                        Cancel
                                    </Button>
                                )}
                                <Button onClick={() => void handleSaveGstin()} loading={savingGstin} disabled={saveNeedsReload || profile.version === null || profile.storeId === null || (!gstinInput.trim() && !editBase?.gstin)}>
                                    {hasGstin ? 'Save GSTIN' : 'Add GSTIN'}
                                </Button>
                            </div>
                        </div>
                    )}

            </Section>

            {/* ── Currency ──────────────────────────────────────────────────── */}
            <Section variant="grouped" title="Currency" >

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

            </Section>

            <div className="billing-profile-foot">
                <Info className="letbuyy-icon" aria-hidden="true" />
                <span>Need to update your legal name or registered address? Edit them in Business details.</span>
            </div>
        </SettingsPane>
        <ConfirmDialog open={reloadDialogOpen} title="Reload current billing profile?"
            description="Discard this GSTIN draft and load the current store revision."
            confirmLabel="Reload profile" onClose={() => setReloadDialogOpen(false)}
            onConfirm={() => {
                editing.current = false
                setEditBase(null)
                setEditingGstin(false)
                setReloadDialogOpen(false)
                void loadData()
            }} />
        </>
    )
}
