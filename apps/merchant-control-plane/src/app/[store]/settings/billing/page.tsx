'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge, Banner, Button, Card, CreditCard, EmptyState, FileText, IndianRupee, Table, Section, Skeleton, type TableColumn, useToast } from '@letbuyy/ui'
import { formatUsLongDate, formatUsShortDate } from '@letbuyy/ui/formatting'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface Invoice {
    id: string
    amount_paid: number
    currency: string
    status: string
    billing_period: string
    created_at: string
}

interface PaymentMethodInfo {
    id: string
    provider: string
    detail: string
    is_default: boolean
}

type BillingPayload = {
    data?: unknown
    error?: string | { message?: string }
}

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

function readBoolean(value: unknown) {
    return value === true
}

function coerceCents(value: unknown) {
    const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
    return Number.isFinite(amount) ? amount : 0
}

function normalizeSubscription(value: unknown) {
    if (!isRecord(value)) return null

    return {
        plan: readString(value.plan, 'free'),
        status: readString(value.status, 'trialing'),
        current_period_end: readString(value.current_period_end),
    }
}

function normalizeInvoices(value: unknown): Invoice[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((invoice) => {
        if (!isRecord(invoice) || typeof invoice.id !== 'string' || !invoice.id) return []

        return [{
            id: invoice.id,
            amount_paid: coerceCents(invoice.amount_paid),
            currency: readString(invoice.currency, 'INR'),
            status: readString(invoice.status, 'pending'),
            billing_period: readString(invoice.billing_period),
            created_at: readString(invoice.created_at),
        }]
    })
}

function normalizePaymentMethods(value: unknown): PaymentMethodInfo[] {
    if (!isRecord(value)) return []

    const paymentSettings = isRecord(value.payment_settings) ? value.payment_settings : null
    const razorpay = isRecord(paymentSettings?.razorpay) ? paymentSettings.razorpay : null
    const methods: PaymentMethodInfo[] = []

    if (readBoolean(razorpay?.secret_configured)) {
        methods.push({
            id: 'razorpay',
            provider: 'Razorpay',
            detail: readString(razorpay?.key_id, 'Configured'),
            is_default: readBoolean(razorpay?.verified),
        })
    }

    if (readBoolean(value.cod_enabled)) {
        methods.push({
            id: 'cod',
            provider: 'Cash on Delivery',
            detail: 'Available at checkout',
            is_default: !readBoolean(razorpay?.secret_configured),
        })
    }

    return methods
}

function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        minimumFractionDigits: 2,
    }).format(amount / 100)
}

function statusVariant(status: string) {
    return status === 'active' || status === 'paid' || status === 'succeeded' ? 'success' : 'warning'
}

export default function BillingSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>([])
    const [subscription, setSubscription] = useState<{ plan: string; status: string; current_period_end: string } | null>(null)

    const totalPaid = useMemo(() => invoices.reduce((total, invoice) => total + invoice.amount_paid, 0), [invoices])
    const invoiceColumns = useMemo<TableColumn<Invoice>[]>(() => [
        {
            key: 'created_at',
            header: 'Date',
            render: (invoice) => formatUsShortDate(invoice.created_at, { emptyValue: 'Recently' }),
        },
        {
            key: 'billing_period',
            header: 'Period',
            render: (invoice) => (
                <span className="capitalize text-[var(--lb-color-text-subdued)]">
                    {invoice.billing_period || 'Not set'}
                </span>
            ),
        },
        {
            key: 'amount_paid',
            header: 'Amount',
            render: (invoice) => (
                <span className="font-[var(--lb-font-weight-semibold)]">
                    {formatMoney(invoice.amount_paid, invoice.currency)}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (invoice) => (
                <Badge label={invoice.status || 'Pending'} variant={statusVariant(invoice.status)} />
            ),
        },
    ], [])

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/billing`, {
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as BillingPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to load billing settings'))
            }

            const data = isRecord(payload?.data) ? payload.data : null
            setSubscription(normalizeSubscription(data?.subscription))
            setInvoices(normalizeInvoices(data?.invoices))
            setPaymentMethods(normalizePaymentMethods(data?.payment))
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load billing settings'
            setLoadError(message)
            notify({
                title: 'Billing could not load',
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

    if (loading) {
        return (
            <SettingsPane
                title="Billing"
                description="Review subscription charges, payment methods, and invoice history."
                store={store}
            >
                <Card>
                    <Section title="Current subscription">
                        <Skeleton variant="card" />
                    </Section>
                </Card>
                <Card>
                    <Section title="Billing history">
                        <Skeleton variant="table" lines={4} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            title="Billing"
            description="Review subscription charges, payment methods, and invoice history."
            store={store}
            primaryAction={{
                label: 'Manage plan',
                onClick: () => router.push(`/${store}/settings/plan`),
            }}
            secondaryActions={[{
                label: 'Payment settings',
                onClick: () => router.push(`/${store}/settings/payments`),
            }]}
            guidance={{
                title: 'Billing source of truth',
                body: 'Use this pane for subscription charges and invoices. Plan changes stay in Plan, and storefront payment methods stay in Payments.',
            }}
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

            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                <Card className="p-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <IndianRupee className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                        <div>
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Paid invoices</p>
                            <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{formatMoney(totalPaid, 'INR')}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <FileText className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-info)]" aria-hidden="true" />
                        <div>
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Invoices</p>
                            <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{invoices.length}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-3)]">
                        <CreditCard className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-success)]" aria-hidden="true" />
                        <div>
                            <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">Payment methods</p>
                            <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">{paymentMethods.length}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {subscription ? (
                <Card>
                    <Section
                        title="Current subscription"
                        description="Subscription status and renewal information for this store."
                    >
                        <div className="flex flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0 space-y-[var(--lb-space-1)]">
                                <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                    {subscription.plan} plan
                                </h3>
                                <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                    Next billing: {formatUsLongDate(subscription.current_period_end, { emptyValue: 'Not scheduled' })}
                                </p>
                            </div>
                            <Badge label={subscription.status || 'Active'} variant={statusVariant(subscription.status)} />
                        </div>
                    </Section>
                </Card>
            ) : (
                <Banner variant="info" title="Trial billing">
                    Billing management will be available once you upgrade from the free trial.
                </Banner>
            )}

            <Card>
                <Section
                    title="Payment method"
                    description="Payment settings are managed from the Payments page so checkout configuration stays in one place."
                    action={<Button type="button" variant="secondary" onClick={() => router.push(`/${store}/settings/payments`)}>Open payment settings</Button>}
                >
                    {paymentMethods.length === 0 ? (
                        <EmptyState
                            icon={<CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No payment method on file"
                            body="Configure Razorpay credentials or Cash on Delivery from Payments settings to make checkout available."
                            primaryAction={<Button type="button" onClick={() => router.push(`/${store}/settings/payments`)}>Open payment settings</Button>}
                        />
                    ) : (
                        <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                            {paymentMethods.map((method) => (
                                <div key={method.id} className="flex flex-col gap-[var(--lb-space-3)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                                    <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                                        <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                            <CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">{method.provider}</p>
                                            <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">{method.detail}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                        {method.is_default && <Badge label="Default" variant="success" />}
                                        <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/${store}/settings/payments`)}>
                                            Manage
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>
            </Card>

            <Card>
                <Section
                    title="Billing history"
                    description="Invoices and subscription charge records for this store."
                >
                    <Table
                        columns={invoiceColumns}
                        rows={invoices}
                        emptyState={(
                            <EmptyState
                                icon={<FileText className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                title="No invoices yet"
                                body="Invoices will appear here after your first paid subscription cycle."
                            />
                        )}
                    />
                </Section>
            </Card>
        </SettingsPane>
    )
}
