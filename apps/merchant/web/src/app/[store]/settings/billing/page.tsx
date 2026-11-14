'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { isBillingPaymentPaid } from '@letbuyy/shared-types'
import Image from 'next/image'
import {
    Badge,
    Banner,
    Button,
    CreditCard,
    EmptyState,
    FileText,
    Info,
    Plus,
    Skeleton,
    Table,
    type TableColumn,
    type TableSavedView,
    useToast,
} from '@letbuyy/ui'
import { formatInrCurrency, formatUsLongDate, formatUsShortDate } from '@letbuyy/ui/formatting'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { FoundingMerchantCard } from '@/components/founding/FoundingMerchantCard'
import { BillingPaymentMethods, type BillingMandateView } from '@/components/billing/BillingPaymentMethods'

// ── Types ───────────────────────────────────────────────────────────────────

interface InvoiceRow {
    id: string
    invoice_number: string | null
    amount: number
    status: string
    billing_period: string | null
    created_at: string | null
}

interface UpcomingBill {
    amount_minor: number
    due_date: string | null
    currency: string
    billing_period: string
    plan: string | null
}

interface BillingData {
    subscription: { plan: string; status: string; billing_period: string; current_period_end: string } | null
    trial: { status: string | null; ends_at: string | null }
    upcoming: UpcomingBill
    mandates: BillingMandateView[]
    invoices: InvoiceRow[]
    profile: { gstin: string | null; gst_state_code: string | null; legal_name: string | null; currency: string }
}

type BillingPayload = { data?: unknown; error?: string | { message?: string } }
type BillFilter = 'all' | 'paid' | 'unpaid'

const billViews: TableSavedView[] = [
    { label: 'All', value: 'all' },
    { label: 'Paid', value: 'paid' },
    { label: 'Unpaid', value: 'unpaid' },
]


// ── Helpers ─────────────────────────────────────────────────────────────────

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

function coerceNumber(value: unknown) {
    const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
    return Number.isFinite(amount) ? amount : 0
}

function normalizeMandates(value: unknown): BillingMandateView[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((m) => {
        if (!isRecord(m) || typeof m.id !== 'string') return []
        const mode = m.provider_mode === 'live' ? 'live' : m.provider_mode === 'sandbox' ? 'sandbox' : null
        return [{
            id: m.id,
            provider: readString(m.provider, 'upi_autopay'),
            provider_mode: mode,
            status: readString(m.status, 'pending_provider'),
            plan_slug: readString(m.plan_slug),
            billing_period: readString(m.billing_period, 'monthly'),
            amount_minor: coerceNumber(m.amount_minor),
            currency: readString(m.currency, 'INR'),
        }]
    })
}

function normalizeInvoices(value: unknown): InvoiceRow[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((inv) => {
        if (!isRecord(inv) || typeof inv.id !== 'string') return []
        const total = inv.total_amount ?? inv.amount
        return [{
            id: inv.id,
            invoice_number: typeof inv.invoice_number === 'string' ? inv.invoice_number : null,
            amount: coerceNumber(total),
            status: readString(inv.payment_status, 'pending'),
            billing_period: typeof inv.billing_period === 'string' ? inv.billing_period : null,
            created_at: typeof inv.created_at === 'string' ? inv.created_at : null,
        }]
    })
}

function normalizeBilling(value: unknown): BillingData {
    const data = isRecord(value) ? value : {}
    const sub = isRecord(data.subscription) ? data.subscription : null
    const trial = isRecord(data.trial) ? data.trial : {}
    const upcoming = isRecord(data.upcoming) ? data.upcoming : {}
    const profile = isRecord(data.profile) ? data.profile : {}

    return {
        subscription: sub
            ? {
                plan: readString(sub.plan, 'current'),
                status: readString(sub.status, 'active'),
                billing_period: readString(sub.billing_period, 'monthly'),
                current_period_end: readString(sub.current_period_end),
            }
            : null,
        trial: {
            status: typeof trial.status === 'string' ? trial.status : null,
            ends_at: typeof trial.ends_at === 'string' ? trial.ends_at : null,
        },
        upcoming: {
            amount_minor: coerceNumber(upcoming.amount_minor),
            due_date: typeof upcoming.due_date === 'string' ? upcoming.due_date : null,
            currency: readString(upcoming.currency, 'INR'),
            billing_period: readString(upcoming.billing_period, 'monthly'),
            plan: typeof upcoming.plan === 'string' ? upcoming.plan : null,
        },
        mandates: normalizeMandates(data.mandates),
        invoices: normalizeInvoices(data.invoices),
        profile: {
            gstin: typeof profile.gstin === 'string' ? profile.gstin : null,
            gst_state_code: typeof profile.gst_state_code === 'string' ? profile.gst_state_code : null,
            legal_name: typeof profile.legal_name === 'string' ? profile.legal_name : null,
            currency: readString(profile.currency, 'INR'),
        },
    }
}

function statusVariant(status: string): 'success' | 'warning' | 'critical' {
    if (isBillingPaymentPaid(status)) return 'success'
    if (status === 'failed' || status === 'payment_failed') return 'critical'
    return 'warning'
}

function formatStatusLabel(status: string) {
    return status.split('_').filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'Pending'
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BillingSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [data, setData] = useState<BillingData | null>(null)
    const [billFilter, setBillFilter] = useState<BillFilter>('all')
    const [addOpen, setAddOpen] = useState(false)

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, { cache: 'no-store' })
            const payload = (await response.json().catch(() => null)) as BillingPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load billing settings'))
            setData(normalizeBilling(payload?.data))
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load billing settings'
            setLoadError(message)
            notify({ title: 'Billing could not load', description: message, variant: 'critical' })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => { void loadData() }, [loadData])

    const invoiceColumns = useMemo<TableColumn<InvoiceRow>[]>(() => [
        { key: 'created_at', header: 'Date', render: (inv) => formatUsShortDate(inv.created_at, { emptyValue: 'Recently' }) },
        {
            key: 'invoice_number',
            header: 'Invoice',
            render: (inv) => <span className="billing-bill-invoice">{inv.invoice_number || '—'}</span>,
        },
        {
            key: 'billing_period',
            header: 'Period',
            render: (inv) => <span className="billing-bill-period">{inv.billing_period || 'One-time'}</span>,
        },
        {
            key: 'amount',
            header: 'Amount',
            render: (inv) => <span className="billing-bill-amount">{formatInrCurrency(inv.amount / 100, { minimumFractionDigits: 2 })}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (inv) => <Badge label={formatStatusLabel(inv.status)} variant={statusVariant(inv.status)} />,
        },
    ], [])

    const totalPaid = useMemo(
        () => (data?.invoices || []).filter((i) => isBillingPaymentPaid(i.status)).reduce((sum, i) => sum + i.amount, 0),
        [data],
    )

    const filteredInvoices = useMemo(() => {
        const invoices = data?.invoices || []
        if (billFilter === 'paid') return invoices.filter((i) => isBillingPaymentPaid(i.status))
        if (billFilter === 'unpaid') return invoices.filter((i) => !isBillingPaymentPaid(i.status))
        return invoices
    }, [billFilter, data])

    if (loading) {
        return (
            <SettingsPane title="Billing" description="Your LetBuyy subscription bills, payment method, and invoice history." store={store}>
                <div className="settings-general-stack">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="settings-home-card">
                            <div className="settings-home-section-label"><Skeleton variant="text" lines={1} /></div>
                            <div className="settings-form-body"><Skeleton variant="text" lines={3} /></div>
                        </div>
                    ))}
                </div>
            </SettingsPane>
        )
    }

    const billing = data || normalizeBilling(null)
    const renewable = Boolean(billing.subscription && ['active', 'trialing'].includes(billing.subscription.status))
    const hasActiveMandate = renewable && billing.mandates.some((m) => m.status === 'active'
        && m.provider_mode === 'live' && m.plan_slug === billing.upcoming.plan
        && m.billing_period === billing.upcoming.billing_period)
    const isTrial = !billing.subscription && billing.trial.status === 'active'
        && Boolean(billing.trial.ends_at && new Date(billing.trial.ends_at).getTime() > Date.now())
    const upcomingAmount = formatInrCurrency(billing.upcoming.amount_minor / 100, { minimumFractionDigits: 2 }) || '₹0.00'
    const upcomingDate = formatUsLongDate(billing.upcoming.due_date, { emptyValue: 'Not scheduled' })

    return (
        <SettingsPane
            title="Billing"
            description="Your LetBuyy subscription bills, payment method, and invoice history."
            store={store}
            primaryAction={{
                label: 'Billing profile',
                onClick: () => router.push(`/${store}/settings/billing/profile`),
            }}
            secondaryActions={[{
                label: 'Manage plan',
                onClick: () => router.push(`/${store}/settings/plan`),
            }]}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Billing could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            {/* India billing-address compliance note */}
            <Banner variant="info" title="Keep your billing address India-ready">
                Indian payment rules require a complete billing address on file. Review it in{' '}
                <Link href={`/${store}/settings/general`} className="settings-business-link">store address</Link>{' '}
                and your GSTIN in <Link href={`/${store}/settings/billing/profile`} className="settings-business-link">billing profile</Link>.
            </Banner>

            <FoundingMerchantCard />

            {/* ── Stats ─────────────────────────────────────────────────────── */}
            <div className="billing-stat-grid">
                <div className="billing-stat-card">
                    <span className="billing-stat-icon billing-stat-icon--rupee">₹</span>
                    <div className="billing-stat-body">
                        <span className="billing-stat-label">Paid to date</span>
                        <span className="billing-stat-value">{formatInrCurrency(totalPaid / 100, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className="billing-stat-card">
                    <span className="billing-stat-icon billing-stat-icon--info"><FileText className="letbuyy-icon" aria-hidden="true" /></span>
                    <div className="billing-stat-body">
                        <span className="billing-stat-label">Invoices</span>
                        <span className="billing-stat-value">{billing.invoices.length}</span>
                    </div>
                </div>
                <div className="billing-stat-card">
                    <span className="billing-stat-icon billing-stat-icon--ok"><CreditCard className="letbuyy-icon" aria-hidden="true" /></span>
                    <div className="billing-stat-body">
                        <span className="billing-stat-label">Payment methods</span>
                        <span className="billing-stat-value">{billing.mandates.length}</span>
                    </div>
                </div>
            </div>

            {/* ── Upcoming bill ─────────────────────────────────────────────── */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Upcoming bill</div>
                <div className="billing-upcoming">
                    <div className="billing-upcoming-main">
                        <span className="billing-upcoming-amount">{upcomingAmount} <small>INR</small></span>
                        <span className="billing-upcoming-meta">
                            {isTrial
                                ? `Free trial — no charge. Trial ends ${formatUsLongDate(billing.trial.ends_at, { emptyValue: 'soon' })}.`
                                : renewable
                                    ? `Renewal on ${upcomingDate} · ${billing.upcoming.plan || 'plan'} (${billing.upcoming.billing_period}).`
                                    : billing.subscription?.status === 'cancelled'
                                        ? 'Plan cancelled. No renewal is scheduled. Previous invoices remain available.'
                                        : 'No renewal is scheduled. Choose a plan to continue.'}
                        </span>
                    </div>
                    <div className="billing-upcoming-actions">
                        {renewable && !hasActiveMandate && (
                            <Button onClick={() => setAddOpen(true)}>
                                <Plus className="letbuyy-icon" aria-hidden="true" />
                                Add payment method
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => router.push(`/${store}/settings/plan`)}>
                            {renewable ? 'Change plan' : 'Choose plan'}
                        </Button>
                    </div>
                </div>
                {renewable && !hasActiveMandate && (
                    <div className="billing-upcoming-warn">
                        <Info className="letbuyy-icon" aria-hidden="true" />
                        <span>No live payment method is active for this plan and billing cycle. Sandbox methods do not authorise automatic renewal.</span>
                    </div>
                )}
                <div className="billing-upcoming-foot">
                    To change what you&apos;re billed for, <Link href={`/${store}/settings/plan`} className="settings-business-link">visit plan settings</Link>.
                </div>
            </div>

            {/* ── Payment method ────────────────────────────────────────────── */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Payment method</div>
                <div className="settings-form-body">
                    <div className="settings-general-hint">
                        How you pay for your LetBuyy subscription. Storefront payment methods (how you collect from
                        customers) are managed in <Link href={`/${store}/settings/payments`} className="settings-business-link">Payments</Link>.
                    </div>
                    <BillingPaymentMethods
                        store={store}
                        mandates={billing.mandates}
                        currentPlanSlug={renewable ? billing.upcoming.plan || billing.subscription?.plan || null : null}
                        currentBillingPeriod={billing.upcoming.billing_period}
                        onChanged={() => void loadData({ quiet: true })}
                        addOpen={addOpen}
                        onAddOpenChange={setAddOpen}
                    />
                </div>
            </div>

            {/* ── Past bills ────────────────────────────────────────────────── */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Past bills</div>
                <Table
                    columns={invoiceColumns}
                    rows={filteredInvoices}
                    savedViews={billViews}
                    activeView={billFilter}
                    onViewChange={(v) => setBillFilter(v as BillFilter)}
                    emptyState={
                        <EmptyState
                            title="Your past bills will appear here"
                            body="Invoices show up after your first paid subscription cycle."
                            illustration={
                                billFilter === 'all' ? (
                                    <Image
                                        src="/Emptystate Illustration/Pastbill.png"
                                        alt=""
                                        width={200}
                                        height={200}
                                        aria-hidden="true"
                                    />
                                ) : undefined
                            }
                            icon={billFilter !== 'all' ? <FileText className="letbuyy-icon" aria-hidden="true" /> : undefined}
                        />
                    }
                />
            </div>
        </SettingsPane>
    )
}
