'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    Section,
    Card,
    AlertCircle,
    AlertTriangle,
    Banner,
    Button,
    CheckCircle2,
    Circle,
    Clock,
    CreditCard,
    FileText,
    IndianRupee,
    Info,
    Input,
    Lock,
    MapPin,
    RefreshCw,
    Select,
    ShieldCheck,
    Skeleton,
    Tag,
    type LucideIcon,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { deriveGstStateCode, gstStateName, gstStateOptions } from '@/lib/india/gst-states'

// ── Types ─────────────────────────────────────────────────────────────────────

type KycDocumentType = 'business_pan' | 'gst_certificate' | 'bank_proof' | 'address_proof' | 'identity_proof'
type KycDocumentStatus = 'draft' | 'submitted' | 'needs_review' | 'verified' | 'rejected'
type KycOverallStatus = 'not_started' | 'in_progress' | 'needs_review' | 'verified' | 'rejected'

interface KycDocument {
    id: string
    document_type: KycDocumentType
    status: KycDocumentStatus
    document_number_last4: string | null
    rejection_reason: string | null
    submitted_at: string | null
    verified_at: string | null
    updated_at: string | null
}

interface KycRequirement {
    document_type: KycDocumentType
    title: string
    required: boolean
    status: KycDocumentStatus | null
}

interface KycOverview {
    overall_status: KycOverallStatus
    provider_mode: 'sandbox' | 'live'
    required_documents: KycRequirement[]
    documents: KycDocument[]
    next_action: string | null
}

interface CommissionOverview {
    currency: string
    schedule: { commission_bps: number; gst_bps: number }
    summary: {
        gross_amount_minor: number
        commission_amount_minor: number
        gst_amount_minor: number
        net_payable_minor: number
    }
}

interface BusinessForm {
    legal_name: string
    trade_name: string
    entity_type: string
    pan_last4: string
    gstin: string
    gst_state_code: string
    invoice_prefix: string
}

type SaveState = 'saved' | 'unsaved' | 'saving'
type ApiPayload = { data?: unknown; error?: string | { message?: string } }

// ── Constants ─────────────────────────────────────────────────────────────────

const ENTITY_TYPE_OPTIONS = [
    { value: '', label: 'Select business type…' },
    { value: 'proprietorship', label: 'Sole proprietorship' },
    { value: 'partnership', label: 'Partnership firm' },
    { value: 'llp', label: 'Limited liability partnership (LLP)' },
    { value: 'private_limited', label: 'Private limited company' },
    { value: 'public_limited', label: 'Public limited company' },
    { value: 'individual', label: 'Individual' },
    { value: 'other', label: 'Other' },
]

const BUSINESS_KEYS: ReadonlyArray<keyof BusinessForm> = [
    'legal_name', 'trade_name', 'entity_type', 'pan_last4', 'gstin', 'gst_state_code', 'invoice_prefix',
]

const EMPTY_BUSINESS: BusinessForm = {
    legal_name: '', trade_name: '', entity_type: '', pan_last4: '', gstin: '', gst_state_code: '', invoice_prefix: '',
}

const DOC_META: Record<KycDocumentType, { title: string; Icon: LucideIcon; hint: string; last4Label: string; last4Hint: string }> = {
    business_pan: {
        title: 'Business PAN',
        Icon: FileText,
        hint: 'Permanent Account Number of the business or proprietor. Required for tax compliance and settlements.',
        last4Label: 'Last 4 of PAN',
        last4Hint: 'e.g. the final 4 characters of ABCDE1234F',
    },
    bank_proof: {
        title: 'Settlement bank account',
        Icon: CreditCard,
        hint: 'The bank account that receives your payouts. We verify it before releasing settlements.',
        last4Label: 'Last 4 of account number',
        last4Hint: 'Only the last 4 digits are stored',
    },
    address_proof: {
        title: 'Business address proof',
        Icon: MapPin,
        hint: 'Utility bill, rent agreement, or registration document for your registered business address.',
        last4Label: 'Reference (last 4)',
        last4Hint: 'Last 4 of the document / bill number',
    },
    gst_certificate: {
        title: 'GST certificate',
        Icon: FileText,
        hint: 'Required only if your business is GST-registered. Enables GST tax invoices.',
        last4Label: 'Last 4 of GSTIN',
        last4Hint: 'Last 4 characters of your GSTIN',
    },
    identity_proof: {
        title: 'Identity proof',
        Icon: ShieldCheck,
        hint: 'Aadhaar or other government identity proof of the authorised signatory.',
        last4Label: 'Last 4 of ID',
        last4Hint: 'Last 4 digits only',
    },
}

const STATUS_META: Record<KycDocumentStatus, { label: string; Icon: LucideIcon; tone: string }> = {
    verified: { label: 'Verified', Icon: CheckCircle2, tone: 'verified' },
    submitted: { label: 'Under review', Icon: Clock, tone: 'submitted' },
    needs_review: { label: 'Needs review', Icon: AlertTriangle, tone: 'review' },
    rejected: { label: 'Rejected', Icon: AlertCircle, tone: 'rejected' },
    draft: { label: 'Not submitted', Icon: Circle, tone: 'draft' },
}

const OVERALL_META: Record<KycOverallStatus, { title: string; variant: 'info' | 'success' | 'warning' | 'critical' }> = {
    verified: { title: 'Business verified', variant: 'success' },
    in_progress: { title: 'Verification in progress', variant: 'info' },
    needs_review: { title: 'A document needs review', variant: 'warning' },
    rejected: { title: 'A document was rejected', variant: 'critical' },
    not_started: { title: 'Verify your business to receive payouts', variant: 'info' },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v && typeof v === 'object' && !Array.isArray(v))
}
function rs(record: Record<string, unknown>, key: string, fallback = '') {
    const v = record[key]
    return typeof v === 'string' ? v : fallback
}
function getPayloadError(payload: ApiPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}
function formatInr(minor: number, currency = 'INR') {
    const value = (Number.isFinite(minor) ? minor : 0) / 100
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
    } catch {
        return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BusinessSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')

    const [data, setData] = useState<BusinessForm>(EMPTY_BUSINESS)
    const [initialData, setInitialData] = useState<BusinessForm | null>(null)
    const [rawBP, setRawBP] = useState<Record<string, unknown>>({})

    const [kyc, setKyc] = useState<KycOverview | null>(null)
    const [commission, setCommission] = useState<CommissionOverview | null>(null)
    const [optionalLoading, setOptionalLoading] = useState(true)
    const [optionalError, setOptionalError] = useState<string | null>(null)

    // Per-document evidence inputs + in-flight flags
    const [docInputs, setDocInputs] = useState<Record<string, { last4: string; file_url: string }>>({})
    const [docBusy, setDocBusy] = useState<Record<string, boolean>>({})

    const gstStates = useMemo(() => gstStateOptions(), [])

    const hasUnsavedChanges = useMemo(() => {
        if (!initialData) return false
        return BUSINESS_KEYS.some((k) => data[k] !== initialData[k])
    }, [data, initialData])
    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    // Optional verification and fees settle independently of the editable identity.
    const beginBusiness = useReadRequest(store)
    const beginOptional = useReadRequest(store)
    const loadOptional = useCallback(async (signal?: AbortSignal) => {
        const request = beginOptional()
        const readSignal = signal ? AbortSignal.any([signal, request.signal]) : request.signal
        const current = () => !signal?.aborted && request.isCurrent()
        setOptionalLoading(true)
        setOptionalError(null)
        setKyc(null)
        setCommission(null)
        const failed: string[] = []
        await Promise.all([
            { endpoint: 'kyc', label: 'Verification status', apply: (data: Record<string, unknown>) => setKyc(data as unknown as KycOverview) },
            { endpoint: 'commission', label: 'Settlement fees', apply: (data: Record<string, unknown>) => setCommission(data as unknown as CommissionOverview) },
        ].map(async ({ endpoint, label, apply }) => {
            try {
                const res = await fetch(`/api/stores/${encodeURIComponent(store)}/${endpoint}`, { cache: 'no-store', signal: readSignal })
                const payload = await res.json().catch(() => null) as ApiPayload | null
                if (!current()) return
                if (!res.ok || !isRecord(payload?.data)) throw new Error(label)
                apply(payload.data)
            } catch {
                if (current()) failed.push(label)
            }
        }))
        if (!current()) return
        setOptionalError(failed.length ? `${failed.join(' and ')} could not load. Retry to check the current status.` : null)
        setOptionalLoading(false)
    }, [beginOptional, store])

    const loadAll = useCallback(async (signal?: AbortSignal) => {
        const request = beginBusiness()
        const readSignal = signal ? AbortSignal.any([signal, request.signal]) : request.signal
        void loadOptional(signal)
        setLoading(true)
        setLoadError(null)
        try {
            const storeRes = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, { cache: 'no-store', signal: readSignal })
            const storePayload = await storeRes.json().catch(() => null) as ApiPayload | null
            if (signal?.aborted || !request.isCurrent()) return
            if (!storeRes.ok) throw new Error(getPayloadError(storePayload, 'Unable to load business details'))
            const d = isRecord(storePayload?.data) ? storePayload.data : null
            if (!d) throw new Error('Business details were not returned')

            const bp = isRecord(d.business_profile) ? d.business_profile : {}
            setRawBP(bp)
            const next: BusinessForm = {
                legal_name: rs(d, 'legal_name') || rs(bp, 'legal_name'),
                trade_name: rs(bp, 'trade_name'),
                entity_type: rs(bp, 'entity_type'),
                pan_last4: rs(bp, 'pan_last4'),
                gstin: rs(d, 'gstin') || rs(bp, 'gstin'),
                gst_state_code: rs(d, 'gst_state_code') || rs(bp, 'gst_state_code'),
                invoice_prefix: rs(d, 'invoice_prefix', 'LBY'),
            }
            setData(next)
            setInitialData(next)
            setSaveState('saved')
        } catch (err) {
            if (signal?.aborted || !request.isCurrent()) return
            const msg = err instanceof Error ? err.message : 'Unable to load business details'
            setLoadError(msg)
            notify({ title: 'Could not load business details', description: msg, variant: 'critical' })
        } finally {
            if (!signal?.aborted && request.isCurrent()) setLoading(false)
        }
    }, [beginBusiness, loadOptional, notify, store])

    useEffect(() => {
        const ctrl = new AbortController()
        void loadAll(ctrl.signal)
        return () => ctrl.abort()
    }, [loadAll])

    // ── Field updates ─────────────────────────────────────────────────────────

    const set = useCallback(<K extends keyof BusinessForm>(key: K, value: BusinessForm[K]) => {
        setData((cur) => ({ ...cur, [key]: value }))
    }, [])

    const onGstinChange = useCallback((value: string) => {
        const gstin = value.toUpperCase()
        setData((cur) => {
            const derived = deriveGstStateCode(gstin)
            return { ...cur, gstin, gst_state_code: derived || cur.gst_state_code }
        })
    }, [])

    // ── Save business identity / GST ──────────────────────────────────────────

    const handleSave = useCallback(async () => {
        if (!hasUnsavedChanges || saveState === 'saving') return
        setSaveState('saving')
        try {
            const business_profile: Record<string, unknown> = { ...rawBP }
            business_profile.trade_name = data.trade_name || undefined
            business_profile.entity_type = data.entity_type || undefined
            business_profile.pan_last4 = data.pan_last4.length === 4 ? data.pan_last4 : undefined

            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    legal_name: data.legal_name || null,
                    gstin: data.gstin || null,
                    gst_state_code: data.gst_state_code || null,
                    invoice_prefix: data.invoice_prefix || null,
                    business_profile,
                }),
            })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to save business details'))

            setInitialData(data)
            setSaveState('saved')
            notify({ title: 'Business details saved', description: 'Legal identity and GST details updated.', variant: 'success' })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unable to save business details'
            setSaveState('unsaved')
            notify({ title: 'Could not save business details', description: msg, variant: 'critical' })
        }
    }, [data, hasUnsavedChanges, notify, rawBP, saveState, store])

    const handleDiscard = useCallback(() => {
        if (!initialData) return
        setData(initialData)
        setSaveState('saved')
    }, [initialData])

    // ── KYC submit / refresh ──────────────────────────────────────────────────

    const docInput = useCallback((type: KycDocumentType) => docInputs[type] || { last4: '', file_url: '' }, [docInputs])
    const setDocInput = useCallback((type: KycDocumentType, patch: Partial<{ last4: string; file_url: string }>) => {
        setDocInputs((cur) => ({ ...cur, [type]: { ...(cur[type] || { last4: '', file_url: '' }), ...patch } }))
    }, [])

    const submitDocument = useCallback(async (type: KycDocumentType) => {
        const input = docInputs[type] || { last4: '', file_url: '' }
        if (!input.last4.trim() && !input.file_url.trim()) {
            notify({ title: 'Add a reference', description: 'Enter the last 4 digits or a secure document link.', variant: 'warning' })
            return
        }
        setDocBusy((cur) => ({ ...cur, [type]: true }))
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/kyc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_type: type,
                    document_number_last4: input.last4.trim() || undefined,
                    file_url: input.file_url.trim() || undefined,
                }),
            })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to submit document'))
            if (isRecord(payload?.data) && isRecord((payload.data as Record<string, unknown>).overview)) {
                setKyc((payload.data as { overview: KycOverview }).overview)
            }
            setDocInputs((cur) => ({ ...cur, [type]: { last4: '', file_url: '' } }))
            notify({ title: 'Document submitted', description: `${DOC_META[type].title} sent for verification.`, variant: 'success' })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unable to submit document'
            notify({ title: 'Submission failed', description: msg, variant: 'critical' })
        } finally {
            setDocBusy((cur) => ({ ...cur, [type]: false }))
        }
    }, [docInputs, notify, store])

    const refreshDocument = useCallback(async (doc: KycDocument) => {
        setDocBusy((cur) => ({ ...cur, [doc.document_type]: true }))
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/kyc/documents/${doc.id}/refresh`, { method: 'POST' })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to refresh status'))
            if (isRecord(payload?.data) && isRecord((payload.data as Record<string, unknown>).overview)) {
                setKyc((payload.data as { overview: KycOverview }).overview)
            }
            notify({ title: 'Status refreshed', description: `${DOC_META[doc.document_type].title} status updated.`, variant: 'info' })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unable to refresh status'
            notify({ title: 'Refresh failed', description: msg, variant: 'critical' })
        } finally {
            setDocBusy((cur) => ({ ...cur, [doc.document_type]: false }))
        }
    }, [notify, store])

    // ── Loading ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <SettingsPane navigationKey="business" title="Business details" description="Legal identity, GST registration, verification, and settlement fees." store={store}>
                <div className="settings-general-stack">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <Section><Skeleton variant="text" lines={1} /></Section>
                            <div className="settings-form-body"><Skeleton variant="text" lines={3} /></div>
                        </Card>
                    ))}
                </div>
            </SettingsPane>
        )
    }

    const docByType = new Map((kyc?.documents || []).map((d) => [d.document_type, d]))
    const overall = kyc ? OVERALL_META[kyc.overall_status] : null
    const commissionBps = commission?.schedule?.commission_bps ?? 0
    const currency = commission?.currency || 'INR'

    const requiredDocs: KycRequirement[] = (kyc?.required_documents?.length
        ? kyc.required_documents
        : [
            { document_type: 'business_pan', title: 'Business PAN', required: true, status: null },
            { document_type: 'bank_proof', title: 'Bank proof', required: true, status: null },
            { document_type: 'address_proof', title: 'Business address proof', required: true, status: null },
            { document_type: 'gst_certificate', title: 'GST certificate', required: false, status: null },
        ])
    // Aadhaar / identity proof is an optional KYC step the gateway accepts but
    // does not list as required — surface it so merchants can complete it.
    const renderDocs: KycRequirement[] = requiredDocs.some((d) => d.document_type === 'identity_proof')
        ? requiredDocs
        : [...requiredDocs, { document_type: 'identity_proof', title: 'Identity proof', required: false, status: docByType.get('identity_proof')?.status ?? null }]

    return (
        <SettingsPane
                navigationKey="business"
            title="Business details"
            description="Legal identity, GST registration, verification, and settlement fees."
            store={store}
            saveBar={{ state: activeSaveState, onSave: () => void handleSave(), onDiscard: handleDiscard, saveLabel: 'Save' }}
        >
            {loadError && (
                <Banner variant="critical" title="Business details could not load" action={<Button variant="secondary" onClick={() => void loadAll()}>Retry</Button>}>
                    {loadError}
                </Banner>
            )}

            {optionalLoading && <Banner variant="info" title="Checking verification and settlement fees">Your business details are ready to edit.</Banner>}
            {optionalError && (
                <Banner variant="warning" title="Some business information is unavailable" action={<Button variant="secondary" onClick={() => void loadOptional()}>Retry status</Button>}>
                    {optionalError}
                </Banner>
            )}

            {/* ── Verification status ───────────────────────────────────────── */}
            {kyc && overall && (
                <Banner variant={overall.variant} title={overall.title}>
                    {kyc.next_action || 'Complete the required documents below to verify your business.'}
                    {kyc.provider_mode === 'sandbox' && (
                        <span className="settings-business-sandbox-note"> Verification is running in sandbox mode.</span>
                    )}
                </Banner>
            )}

            {/* ── Business identity (reference) ─────────────────────────────── */}
            <form className="settings-general-stack" onSubmit={(e) => { e.preventDefault(); void handleSave() }}>
                <Section variant="grouped" title="Business identity" >

                        <div className="settings-general-hint">
                            Used on GST invoices and shared with payment partners for settlements. Keep this exactly as on your registration documents.
                        </div>
                        <Input
                            label="Legal business name"
                            value={data.legal_name}
                            onChange={(e) => set('legal_name', e.target.value)}
                            placeholder="As registered with the government / GST"
                            autoComplete="organization"
                        />
                        <div className="settings-form-grid">
                            <Input
                                label="Trade name"
                                value={data.trade_name}
                                onChange={(e) => set('trade_name', e.target.value)}
                                placeholder="Brand / doing-business-as name"
                            />
                            <Select
                                label="Business type"
                                value={data.entity_type}
                                options={ENTITY_TYPE_OPTIONS}
                                onChange={(e) => set('entity_type', e.target.value)}
                            />
                        </div>
                        <Input
                            label="PAN (last 4)"
                            value={data.pan_last4}
                            onChange={(e) => set('pan_last4', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                            placeholder="1234F"
                            maxLength={4}
                            helperText="We only store the last 4 characters of your PAN. Upload the full PAN under verification below."
                        />

                </Section>

                {/* ── GST registration ─────────────────────────────────────── */}
                <Section variant="grouped" title="GST registration" >

                        <div className="settings-general-hint">
                            If your business is GST-registered, add your GSTIN to issue compliant GST tax invoices. The state code is derived from your GSTIN automatically.
                        </div>
                        <div className="settings-form-grid">
                            <Input
                                label="GSTIN"
                                value={data.gstin}
                                onChange={(e) => onGstinChange(e.target.value)}
                                placeholder="22ABCDE1234F1Z5"
                                maxLength={15}
                                helperText="15-character GST identification number."
                            />
                            <Select
                                label="GST state"
                                value={data.gst_state_code}
                                options={gstStates}
                                onChange={(e) => set('gst_state_code', e.target.value)}
                                helperText={data.gst_state_code ? gstStateName(data.gst_state_code) : 'Place of supply for tax'}
                            />
                        </div>
                        <Input
                            label="Invoice number prefix"
                            value={data.invoice_prefix}
                            onChange={(e) => set('invoice_prefix', e.target.value.slice(0, 20))}
                            placeholder="LBY"
                            maxLength={20}
                            helperText="Appears before invoice numbers, e.g. LBY-0001."
                        />

                </Section>
            </form>

            {/* ── KYC / verification documents ──────────────────────────────── */}
            <Section variant="grouped" title="Verification &amp; KYC" >

                    <div className="settings-general-hint">
                        Verified businesses can receive payouts. We store only the last 4 digits of each document number. Add a secure link only if your document is hosted privately (for example DigiLocker).
                    </div>

                    <div className="settings-business-kyc-list">
                        {renderDocs.map((req) => {
                            const meta = DOC_META[req.document_type]
                            const DocIcon = meta.Icon
                            const existing = docByType.get(req.document_type)
                            const status: KycDocumentStatus = existing?.status || 'draft'
                            const sMeta = STATUS_META[status]
                            const SIcon = sMeta.Icon
                            const input = docInput(req.document_type)
                            const busy = !!docBusy[req.document_type]
                            const isVerified = status === 'verified'

                            return (
                                <div key={req.document_type} className="settings-business-kyc-item">
                                    <div className="settings-business-kyc-head">
                                        <span className="settings-business-kyc-icon"><DocIcon className="letbuyy-icon" aria-hidden="true" /></span>
                                        <div className="settings-business-kyc-meta">
                                            <div className="settings-business-kyc-title-row">
                                                <span className="settings-business-kyc-title">{meta.title}</span>
                                                {req.required
                                                    ? <span className="settings-business-tag settings-business-tag--required">Required</span>
                                                    : <span className="settings-business-tag settings-business-tag--optional">Optional</span>}
                                            </div>
                                            <span className="settings-business-kyc-hint">{meta.hint}</span>
                                        </div>
                                        <span className={`settings-business-status settings-business-status--${sMeta.tone}`}>
                                            <SIcon className="letbuyy-icon" aria-hidden="true" />
                                            {sMeta.label}
                                        </span>
                                    </div>

                                    {status === 'rejected' && existing?.rejection_reason && (
                                        <div className="settings-business-kyc-reject">
                                            <AlertCircle className="letbuyy-icon" aria-hidden="true" />
                                            {existing.rejection_reason}
                                        </div>
                                    )}

                                    {!isVerified && (
                                        <div className="settings-business-kyc-form">
                                            <Input
                                                label={meta.last4Label}
                                                value={input.last4}
                                                onChange={(e) => setDocInput(req.document_type, { last4: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) })}
                                                placeholder="••••"
                                                maxLength={8}
                                                helperText={meta.last4Hint}
                                            />
                                            <Input
                                                label="Secure document link (optional)"
                                                value={input.file_url}
                                                onChange={(e) => setDocInput(req.document_type, { file_url: e.target.value })}
                                                placeholder="https://…"
                                                type="url"
                                            />
                                            <div className="settings-business-kyc-actions">
                                                <Button variant="primary" onClick={() => void submitDocument(req.document_type)} loading={busy}>
                                                    {existing ? 'Resubmit' : 'Submit for verification'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {existing && (status === 'submitted' || status === 'needs_review') && (
                                        <div className="settings-business-kyc-actions settings-business-kyc-actions--inline">
                                            <Button variant="secondary" onClick={() => void refreshDocument(existing)} loading={busy}>
                                                <RefreshCw className="letbuyy-icon" aria-hidden="true" />
                                                Refresh status
                                            </Button>
                                            {existing.document_number_last4 && (
                                                <span className="settings-business-kyc-stored">Stored: ••••{existing.document_number_last4}</span>
                                            )}
                                        </div>
                                    )}

                                    {isVerified && existing?.document_number_last4 && (
                                        <div className="settings-business-kyc-actions settings-business-kyc-actions--inline">
                                            <span className="settings-business-kyc-stored">Verified ending ••••{existing.document_number_last4}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

            </Section>

            {/* ── Fees & settlements ────────────────────────────────────────── */}
            <Section variant="grouped" title="Fees &amp; settlements" >

                    <div className="settings-business-fees">
                        <div className="settings-business-fee-row settings-business-fee-row--hero">
                            <span className="settings-business-fee-icon"><IndianRupee className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="settings-business-fee-body">
                                <span className="settings-business-fee-label">LetBuyy platform commission</span>
                                <span className="settings-business-fee-desc">We charge no commission on your sales — you keep 100% of your order value.</span>
                            </div>
                            <span className="settings-business-fee-value settings-business-fee-value--zero">
                                {(commissionBps / 100).toFixed(0)}%
                            </span>
                        </div>

                        <div className="settings-business-fee-row">
                            <span className="settings-business-fee-icon settings-business-fee-icon--muted"><Tag className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="settings-business-fee-body">
                                <span className="settings-business-fee-label">GST on platform commission</span>
                                <span className="settings-business-fee-desc">18% GST applies only to platform commission. Since commission is 0%, this is nil.</span>
                            </div>
                            <span className="settings-business-fee-value">{formatInr(0, currency)}</span>
                        </div>

                        <div className="settings-business-fee-row">
                            <span className="settings-business-fee-icon settings-business-fee-icon--muted"><CreditCard className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="settings-business-fee-body">
                                <span className="settings-business-fee-label">Payment gateway fees (Razorpay)</span>
                                <span className="settings-business-fee-desc">
                                    Your own Razorpay account&apos;s standard fees (plus 18% GST) are deducted by Razorpay at settlement. Configure keys in{' '}
                                    <Link href={`/${store}/settings/payments`} className="settings-business-link">Payments</Link>.
                                </span>
                            </div>
                            <span className="settings-business-fee-value settings-business-fee-value--muted">At cost</span>
                        </div>

                        <div className="settings-business-fee-row settings-business-fee-row--net">
                            <span className="settings-business-fee-icon"><CheckCircle2 className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="settings-business-fee-body">
                                <span className="settings-business-fee-label">You receive</span>
                                <span className="settings-business-fee-desc">Order value minus only your payment provider&apos;s fees. Settlements reach your verified bank account.</span>
                            </div>
                            <span className="settings-business-fee-value settings-business-fee-value--net">100%</span>
                        </div>
                    </div>

                    {commission && commission.summary.gross_amount_minor > 0 && (
                        <div className="settings-business-settlement">
                            <div className="settings-business-settlement-item">
                                <span className="settings-business-settlement-label">Gross sales</span>
                                <span className="settings-business-settlement-value">{formatInr(commission.summary.gross_amount_minor, currency)}</span>
                            </div>
                            <div className="settings-business-settlement-item">
                                <span className="settings-business-settlement-label">Platform commission</span>
                                <span className="settings-business-settlement-value">− {formatInr(commission.summary.commission_amount_minor, currency)}</span>
                            </div>
                            <div className="settings-business-settlement-item settings-business-settlement-item--total">
                                <span className="settings-business-settlement-label">Net payable to you</span>
                                <span className="settings-business-settlement-value">{formatInr(commission.summary.net_payable_minor, currency)}</span>
                            </div>
                        </div>
                    )}

                    <div className="settings-business-fee-foot">
                        <Lock className="letbuyy-icon" aria-hidden="true" />
                        <span>
                            Track every payout under{' '}
                            <Link href={`/${store}/settings/billing`} className="settings-business-link">Billing</Link>.
                            LetBuyy&apos;s 0% commission is permanent.
                        </span>
                    </div>

            </Section>

            {/* ── Site type / governance note ───────────────────────────────── */}
            <Section variant="grouped" title="Data &amp; privacy" >

                    <div className="settings-business-privacy">
                        <Info className="letbuyy-icon" aria-hidden="true" />
                        <span>
                            We follow data minimisation: only the last 4 digits of PAN, bank, and ID numbers are stored. Full documents are verified by our KYC partner and never kept in your store&apos;s media library.
                        </span>
                    </div>

            </Section>
        </SettingsPane>
    )
}
