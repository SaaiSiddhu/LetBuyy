'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Section,
    Card,
    Badge,
    Banner,
    Button,
    CreditCard,
    FileText,
    Info,
    Plus,
    Skeleton,
    Table,
    type TableColumn,
    type TableSavedView,
    useToast,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
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
    amount_minor: number | null
    due_date: string | null
    currency: string
    billing_period: string | null
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

const PAID_STATUSES = new Set(['paid', 'succeeded'])

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
    const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    return Number.isFinite(amount) ? amount : Number.NaN
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
        return {
            id: m.id,
            provider: m.provider,
            provider_mode: mode,
            status: m.status,
            plan_slug: m.plan_slug,
            billing_period: m.billing_period,
            amount_minor: coerceNumber(m.amount_minor),
            currency: readString(m.currency, 'INR'),
        }
    })
}

function normalizeInvoices(value: unknown): InvoiceRow[] {
    if (!Array.isArray(value)) throw new Error('Invoice history response is incomplete.')
    return value.map((inv) => {
        if (!isRecord(inv) || typeof inv.id !== 'string' || !inv.id) throw new Error('Invoice data is incomplete.')
        const total = inv.total_amount ?? inv.amount
        if (!Number.isFinite(coerceNumber(total)) || typeof inv.payment_status !== 'string') throw new Error('Invoice amount or status is unavailable.')
        return {
            id: inv.id,
            invoice_number: typeof inv.invoice_number === 'string' ? inv.invoice_number : null,
            amount: coerceNumber(total),
            status: inv.payment_status,
            billing_period: typeof inv.billing_period === 'string' ? inv.billing_period : null,
            created_at: typeof inv.created_at === 'string' ? inv.created_at : null,
        }
    })
}

function normalizeBilling(value: unknown): BillingData {
    if (!isRecord(value) || !isRecord(value.trial) || !isRecord(value.upcoming) || !isRecord(value.profile)) {
        throw new Error('Billing response is incomplete.')
    }
    const data = value
    const sub = isRecord(data.subscription) ? data.subscription : null
    const trial = isRecord(data.trial) ? data.trial : {}
    const upcoming = data.upcoming as Record<string, unknown>
    const profile = data.profile as Record<string, unknown>

    return {
        subscription: sub
            ? {
                plan: readString(sub.plan),
                status: readString(sub.status, 'unknown'),
                billing_period: readString(sub.billing_period),
                current_period_end: readString(sub.current_period_end),
            }
            : null,
        trial: {
            status: typeof trial.status === 'string' ? trial.status : null,
            ends_at: typeof trial.ends_at === 'string' ? trial.ends_at : null,
        },
        upcoming: {
            amount_minor: Number.isFinite(coerceNumber(upcoming.amount_minor)) ? coerceNumber(upcoming.amount_minor) : null,
            due_date: typeof upcoming.due_date === 'string' ? upcoming.due_date : null,
            currency: readString(upcoming.currency, 'INR'),
            billing_period: typeof upcoming.billing_period === 'string' ? upcoming.billing_period : null,
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
    if (PAID_STATUSES.has(status)) return 'success'
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

    const beginRead = useReadRequest(store)
    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, { cache: 'no-store', signal: request.signal })
            const payload = (await response.json().catch(() => null)) as BillingPayload | null
            if (!request.isCurrent()) return
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load billing settings'))
            setData(normalizeBilling(payload?.data))
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load billing settings'
            setLoadError(message)
            notify({ title: 'Billing could not load', description: message, variant: 'critical' })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => { void loadData() }, [loadData])

    const invoiceColumns = useMemo<TableColumn<InvoiceRow>[]>(() => [
        { key: 'created_at', header: 'Date', render: (inv) => formatUsShortDate(inv.created_at, { emptyValue: '—' }) },
        {
            key: 'invoice_number',
            header: 'Invoice',
            render: (inv) => <span className="billing-bill-invoice">{inv.invoice_number || '—'}</span>,
        },
        {
            key: 'billing_period',
            header: 'Period',
            render: (inv) => <span className="billing-bill-period">{inv.billing_period || '—'}</span>,
        },
        {
            key: 'amount',
            header: 'Amount',
            render: (inv) => <span className="billing-bill-amount">{formatInrCurrency(inv.amount / 100, { minimumFractionDigits: 2 }) ?? '—'}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (inv) => <Badge label={formatStatusLabel(inv.status)} variant={statusVariant(inv.status)} />,
        },
    ], [])

    const totalPaid = useMemo(
        () => (data?.invoices || []).filter((i) => PAID_STATUSES.has(i.status)).reduce((sum, i) => sum + i.amount, 0),
        [data],
    )

    const filteredInvoices = useMemo(() => {
        const invoices = data?.invoices || []
        if (billFilter === 'paid') return invoices.filter((i) => PAID_STATUSES.has(i.status))
        if (billFilter === 'unpaid') return invoices.filter((i) => !PAID_STATUSES.has(i.status))
        return invoices
    }, [billFilter, data])

    if (loading) {
        return (
            <SettingsPane navigationKey="billing" title="Billing" description="Your LetBuyy subscription bills, payment method, and invoice history." store={store}>
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

    if (!data) {
        return (
            <SettingsPane navigationKey="billing" title="Billing" description="Your subscription and invoice history." store={store}>
                <Banner variant="critical" title="Billing could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}>
                    {loadError || 'Billing data is unavailable.'}
                </Banner>
            </SettingsPane>
        )
    }

    const billing = data
    const hasActiveMandate = billing.mandates.some((m) => m.status === 'active')
    const isTrial = billing.trial.status === 'active' || billing.trial.status === 'trialing'
    const upcomingAmount = billing.upcoming.amount_minor === null ? 'Amount not quoted' : formatInrCurrency(billing.upcoming.amount_minor / 100, { minimumFractionDigits: 2 }) ?? 'Amount unavailable'
    const upcomingDate = formatUsLongDate(billing.upcoming.due_date, { emptyValue: 'Not scheduled' })

    return (
        <SettingsPane
                navigationKey="billing"
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
                <Card className="billing-stat-card">
                    <span className="billing-stat-icon billing-stat-icon--rupee">₹</span>
                    <div className="billing-stat-body">
                        <span className="billing-stat-label">Paid to date</span>
                        <span className="billing-stat-value">{formatInrCurrency(totalPaid / 100, { minimumFractionDigits: 2 }) ?? '—'}</span>
                    </div>
                </Card>
                <Card className="billing-stat-card">
                    <span className="billing-stat-icon billing-stat-icon--info"><FileText className="letbuyy-icon" aria-hidden="true" /></span>
                    <div className="billing-stat-body">
                        <span className="billing-stat-label">Invoices</span>
                        <span className="billing-stat-value">{billing.invoices.length}</span>
                    </div>
                </Card>
                <Card className="billing-stat-card">
                    <span className="billing-stat-icon billing-stat-icon--ok"><CreditCard className="letbuyy-icon" aria-hidden="true" /></span>
                    <div className="billing-stat-body">
                        <span className="billing-stat-label">Billing mandates</span>
                        <span className="billing-stat-value">{billing.mandates.length}</span>
                    </div>
                </Card>
            </div>

            {/* ── Billing period ────────────────────────────────────────────── */}
            <Section variant="grouped" title="Current billing period" >
                <div className="billing-upcoming">
                    <div className="billing-upcoming-main">
                        <span className="billing-upcoming-amount">{upcomingAmount}</span>
                        <span className="billing-upcoming-meta">
                            {isTrial
                                ? `Trial ends ${formatUsLongDate(billing.trial.ends_at, { emptyValue: 'on a date not available here' })}. Any next charge needs a confirmed quote.`
                                : billing.subscription
                                    ? `Current period ends ${upcomingDate}. The next charge has not been quoted.`
                                    : 'No active subscription or scheduled charge is confirmed.'}
                        </span>
                    </div>
                    <div className="billing-upcoming-actions">
                        {!hasActiveMandate && billing.subscription && (
                            <Button onClick={() => setAddOpen(true)}>
                                <Plus className="letbuyy-icon" aria-hidden="true" />
                                Create test mandate
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => router.push(`/${store}/settings/plan`)}>
                            {isTrial ? 'Choose plan' : 'Change plan'}
                        </Button>
                    </div>
                </div>
                {!hasActiveMandate && billing.subscription && (
                    <div className="billing-upcoming-warn">
                        <Info className="letbuyy-icon" aria-hidden="true" />
                        <span>No active billing mandate is shown. Live AutoPay requires provider activation and verification.</span>
                    </div>
                )}
                <div className="billing-upcoming-foot">
                    To change what you&apos;re billed for, <Link href={`/${store}/settings/plan`} className="settings-business-link">visit plan settings</Link>.
                </div>
            </Section>

            {/* ── Payment method ────────────────────────────────────────────── */}
            <Section variant="grouped" title="Billing mandates" >

                    <div className="settings-general-hint">
                        This section currently supports sandbox mandate records. Storefront payment methods (how you collect from
                        customers) are managed in <Link href={`/${store}/settings/payments`} className="settings-business-link">Payments</Link>.
                    </div>
                    <BillingPaymentMethods
                        store={store}
                        mandates={billing.mandates}
                        currentPlanSlug={billing.upcoming.plan || billing.subscription?.plan || null}
                        currentBillingPeriod={billing.upcoming.billing_period}
                        onChanged={() => void loadData({ quiet: true })}
                        addOpen={addOpen}
                        onAddOpenChange={setAddOpen}
                    />

            </Section>

            {/* ── Past bills ────────────────────────────────────────────────── */}
            <Section variant="grouped" title="Past bills" >
                <Table
                    columns={invoiceColumns}
                    rows={filteredInvoices}
                    savedViews={billViews}
                    activeView={billFilter}
                    onViewChange={(v) => setBillFilter(v as BillFilter)}
                    emptyState={
                        <EmptyState scene="billing"
                            title="Your past bills will appear here"
                            body="Invoices show up after your first paid subscription cycle."
                            icon={billFilter !== 'all' ? <FileText className="letbuyy-icon" aria-hidden="true" /> : undefined}
                        />
                    }
                />
            </Section>
        </SettingsPane>
    )
}
