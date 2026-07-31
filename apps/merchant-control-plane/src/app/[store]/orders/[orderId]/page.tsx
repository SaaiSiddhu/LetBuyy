'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    EmptyState,
    MaterialIcon,
    Page,
    PageHeader,
    Section,
    Skeleton,
} from '@letbuyy/ui'
import {
    formatInrCurrency,
    formatIndiaDate,
    formatIndiaDateWithTime,
} from '@letbuyy/ui/formatting'

// ---------------------------------------------------------------------------
// Local types (gateway response shapes from GET /orders/:id)
// The gateway returns a normalizeOrderRecord() result which has these fields.
// ---------------------------------------------------------------------------

interface OrderLineItem {
    product_id: string | null
    variant_id: string | null
    title: string | null
    name: string | null
    sku: string | null
    quantity: number
    unit_price: number
    total: number
    variant_title: string | null
    image_url: string | null
}

interface OrderAddress {
    full_name?: string
    name?: string
    address_line1?: string
    line1?: string
    address?: string
    address_line2?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    pincode?: string
    zip?: string
    landmark?: string
    phone?: string
    country?: string
}

interface OrderDetail {
    id: string
    store_id: string
    order_number: string
    status: string
    payment_status: string
    fulfillment_status: string | null
    payment_method: string
    payment_gateway: string | null
    payment_id: string | null
    payment_processed_at: string | null
    customer_name: string
    customer_email: string
    customer_phone: string | null
    customer_gstin: string | null
    shipping_address: OrderAddress | null
    billing_address: OrderAddress | null
    items: OrderLineItem[]
    subtotal: number
    shipping_cost: number
    tax: number
    discount: number
    coupon_code: string | null
    coupon_discount: number
    total: number
    currency: string
    shipping_method: string | null
    tracking_number: string | null
    carrier: string | null
    refund_status: string | null
    return_status: string | null
    notes: string | null
    gst_invoice_number: string | null
    risk_level: string | null
    created_at: string
    updated_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readString(row: Record<string, unknown>, key: string): string {
    const v = row[key]
    return typeof v === 'string' ? v : ''
}

function readNullableString(row: Record<string, unknown>, key: string): string | null {
    const v = row[key]
    return typeof v === 'string' && v.trim() ? v : null
}

function readNumber(row: Record<string, unknown>, key: string): number {
    return Number(row[key] ?? 0)
}

function readAddress(raw: unknown): OrderAddress | null {
    if (!raw || typeof raw !== 'object') return null
    return raw as OrderAddress
}

function readLineItems(raw: unknown): OrderLineItem[] {
    if (!Array.isArray(raw)) return []
    return raw.map((item: unknown): OrderLineItem => {
        const r = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
        return {
            product_id: readNullableString(r, 'product_id'),
            variant_id: readNullableString(r, 'variant_id'),
            title: readNullableString(r, 'title') ?? readNullableString(r, 'name'),
            name: readNullableString(r, 'name'),
            sku: readNullableString(r, 'sku'),
            quantity: readNumber(r, 'quantity') || 1,
            unit_price: readNumber(r, 'unit_price') || readNumber(r, 'price'),
            total: readNumber(r, 'total'),
            variant_title: readNullableString(r, 'variant_title'),
            image_url: readNullableString(r, 'image_url') ?? readNullableString(r, 'image'),
        }
    })
}

function mapOrderDetail(raw: Record<string, unknown>): OrderDetail {
    // The gateway normalizeOrderRecord() puts items at both raw.items and raw.order_items
    const items = readLineItems(raw.items ?? raw.order_items)

    return {
        id: readString(raw, 'id'),
        store_id: readString(raw, 'store_id'),
        order_number: readString(raw, 'order_number'),
        status: readString(raw, 'status') || 'pending',
        payment_status: readString(raw, 'payment_status') || 'pending',
        fulfillment_status: readNullableString(raw, 'fulfillment_status'),
        payment_method: readString(raw, 'payment_method') || 'cod',
        payment_gateway: readNullableString(raw, 'payment_gateway'),
        payment_id: readNullableString(raw, 'payment_id'),
        payment_processed_at: readNullableString(raw, 'payment_processed_at'),
        customer_name: readString(raw, 'customer_name'),
        customer_email: readString(raw, 'customer_email'),
        customer_phone: readNullableString(raw, 'customer_phone'),
        customer_gstin: readNullableString(raw, 'customer_gstin'),
        shipping_address: readAddress(raw.shipping_address),
        billing_address: readAddress(raw.billing_address),
        items,
        subtotal: readNumber(raw, 'subtotal'),
        shipping_cost: readNumber(raw, 'shipping_cost'),
        tax: readNumber(raw, 'tax'),
        discount: readNumber(raw, 'discount'),
        coupon_code: readNullableString(raw, 'coupon_code'),
        coupon_discount: readNumber(raw, 'coupon_discount'),
        total: readNumber(raw, 'total'),
        currency: readString(raw, 'currency') || 'INR',
        shipping_method: readNullableString(raw, 'shipping_method'),
        tracking_number: readNullableString(raw, 'tracking_number'),
        carrier: readNullableString(raw, 'carrier'),
        refund_status: readNullableString(raw, 'refund_status'),
        return_status: readNullableString(raw, 'return_status'),
        notes: readNullableString(raw, 'notes'),
        gst_invoice_number: readNullableString(raw, 'gst_invoice_number'),
        risk_level: readNullableString(raw, 'risk_level'),
        created_at: readString(raw, 'created_at'),
        updated_at: readString(raw, 'updated_at'),
    }
}

function titleize(value: string): string {
    return (value || '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ') || '—'
}

function orderStatusVariant(status: string): 'success' | 'critical' | 'warning' | 'info' {
    const n = status.toLowerCase()
    if (['delivered', 'fulfilled'].includes(n)) return 'success'
    if (['cancelled', 'refunded', 'returned'].includes(n)) return 'critical'
    if (['shipped', 'processing', 'confirmed'].includes(n)) return 'info'
    return 'warning'
}

function paymentStatusVariant(status: string): 'success' | 'critical' | 'warning' | 'info' {
    const n = status.toLowerCase()
    if (['paid'].includes(n)) return 'success'
    if (['failed', 'refunded'].includes(n)) return 'critical'
    if (['pending'].includes(n)) return 'warning'
    return 'info'
}

function formatAddress(address: OrderAddress | null): string | null {
    if (!address) return null
    const parts = [
        address.full_name ?? address.name,
        address.address_line1 ?? address.line1 ?? address.address,
        address.address_line2 ?? address.line2,
        address.landmark,
        [address.city, address.state].filter(Boolean).join(', '),
        address.postal_code ?? address.pincode ?? address.zip,
        address.country,
    ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    return parts.length > 0 ? parts.join(', ') : null
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-[var(--lb-space-1)] py-[var(--lb-space-2)] border-b border-[var(--lb-color-border)] last:border-b-0">
            <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">{label}</span>
            <span className="text-[var(--lb-color-text)] text-[var(--lb-font-size-base)]">{value || '—'}</span>
        </div>
    )
}

function SummaryCard({ order }: { order: OrderDetail }) {
    return (
        <Card>
            <Section title="Order summary">
                <div className="flex flex-wrap gap-[var(--lb-space-2)] mb-[var(--lb-space-4)]">
                    <Badge label={titleize(order.status)} variant={orderStatusVariant(order.status)} />
                    <Badge label={`Payment: ${titleize(order.payment_status)}`} variant={paymentStatusVariant(order.payment_status)} />
                    {order.fulfillment_status && (
                        <Badge label={`Fulfillment: ${titleize(order.fulfillment_status)}`} variant="info" />
                    )}
                    {order.refund_status && (
                        <Badge label={`Refund: ${titleize(order.refund_status)}`} variant="warning" />
                    )}
                    {order.risk_level && order.risk_level !== 'low' && (
                        <Badge label={`Risk: ${titleize(order.risk_level)}`} variant={order.risk_level === 'high' ? 'critical' : 'warning'} />
                    )}
                </div>
                <div className="grid gap-0">
                    <DetailRow label="Order number" value={`#${order.order_number}`} />
                    <DetailRow
                        label="Placed"
                        value={formatIndiaDateWithTime(order.created_at, { emptyValue: '—' })}
                    />
                    <DetailRow
                        label="Last updated"
                        value={formatIndiaDate(order.updated_at, { emptyValue: '—' })}
                    />
                    <DetailRow label="Payment method" value={order.payment_method.toUpperCase()} />
                    {order.payment_gateway && (
                        <DetailRow label="Payment gateway" value={order.payment_gateway} />
                    )}
                    {order.payment_id && (
                        <DetailRow label="Payment ID" value={order.payment_id} />
                    )}
                    {order.payment_processed_at && (
                        <DetailRow
                            label="Payment processed"
                            value={formatIndiaDateWithTime(order.payment_processed_at, { emptyValue: '—' })}
                        />
                    )}
                    {order.gst_invoice_number && (
                        <DetailRow label="GST invoice number" value={order.gst_invoice_number} />
                    )}
                    {order.notes && (
                        <DetailRow label="Notes" value={order.notes} />
                    )}
                </div>
            </Section>
        </Card>
    )
}

function CustomerCard({
    order,
    store,
    router,
}: {
    order: OrderDetail
    store: string
    router: ReturnType<typeof useRouter>
}) {
    const hasEmail = Boolean(order.customer_email)
    return (
        <Card>
            <Section title="Customer">
                <div className="grid gap-0">
                    <DetailRow label="Name" value={order.customer_name || '—'} />
                    <DetailRow
                        label="Email"
                        value={
                            hasEmail ? (
                                <button
                                    type="button"
                                    className="text-[var(--lb-color-primary)] hover:underline text-left"
                                    onClick={() =>
                                        router.push(
                                            `/${store}/customers/${encodeURIComponent(order.customer_email)}`
                                        )
                                    }
                                >
                                    {order.customer_email}
                                </button>
                            ) : '—'
                        }
                    />
                    <DetailRow label="Phone" value={order.customer_phone} />
                    {order.customer_gstin && (
                        <DetailRow label="GSTIN" value={order.customer_gstin} />
                    )}
                </div>
                {hasEmail && (
                    <div className="mt-[var(--lb-space-3)]">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                                router.push(
                                    `/${store}/customers/${encodeURIComponent(order.customer_email)}`
                                )
                            }
                        >
                            <MaterialIcon name="person" />
                            View customer profile
                        </Button>
                    </div>
                )}
            </Section>
        </Card>
    )
}

function AddressesCard({ order }: { order: OrderDetail }) {
    const shipping = formatAddress(order.shipping_address)
    const billing = formatAddress(order.billing_address)
    const hasBilling = Boolean(billing)
    const hasShipping = Boolean(shipping)

    if (!hasShipping && !hasBilling) {
        return (
            <Card>
                <Section title="Addresses">
                    <EmptyState
                        icon={<MaterialIcon name="location_on" />}
                        title="No addresses on this order"
                        body="Shipping and billing addresses will appear here when available."
                    />
                </Section>
            </Card>
        )
    }

    return (
        <Card>
            <Section title="Addresses">
                <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                    <div className="flex flex-col gap-[var(--lb-space-1)]">
                        <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)] font-[var(--lb-font-weight-semibold)] uppercase">
                            Ship to
                        </span>
                        {hasShipping ? (
                            <div className="text-[var(--lb-color-text)] text-[var(--lb-font-size-base)]">
                                {order.shipping_address?.full_name && (
                                    <p className="font-[var(--lb-font-weight-medium)]">{order.shipping_address.full_name}</p>
                                )}
                                <p>{order.shipping_address?.address_line1 ?? order.shipping_address?.line1 ?? order.shipping_address?.address}</p>
                                {(order.shipping_address?.address_line2 ?? order.shipping_address?.line2) && (
                                    <p>{order.shipping_address.address_line2 ?? order.shipping_address.line2}</p>
                                )}
                                {order.shipping_address?.landmark && (
                                    <p>{order.shipping_address.landmark}</p>
                                )}
                                <p>
                                    {[order.shipping_address?.city, order.shipping_address?.state].filter(Boolean).join(', ')}
                                    {' '}
                                    {order.shipping_address?.postal_code ?? order.shipping_address?.pincode ?? order.shipping_address?.zip}
                                </p>
                                {order.shipping_address?.phone && (
                                    <p>{order.shipping_address.phone}</p>
                                )}
                            </div>
                        ) : (
                            <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">—</span>
                        )}
                    </div>

                    <div className="flex flex-col gap-[var(--lb-space-1)]">
                        <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)] font-[var(--lb-font-weight-semibold)] uppercase">
                            Bill to
                        </span>
                        {hasBilling ? (
                            <div className="text-[var(--lb-color-text)] text-[var(--lb-font-size-base)]">
                                {order.billing_address?.full_name && (
                                    <p className="font-[var(--lb-font-weight-medium)]">{order.billing_address.full_name}</p>
                                )}
                                <p>{order.billing_address?.address_line1 ?? order.billing_address?.line1 ?? order.billing_address?.address}</p>
                                {(order.billing_address?.address_line2 ?? order.billing_address?.line2) && (
                                    <p>{order.billing_address.address_line2 ?? order.billing_address.line2}</p>
                                )}
                                {order.billing_address?.landmark && (
                                    <p>{order.billing_address.landmark}</p>
                                )}
                                <p>
                                    {[order.billing_address?.city, order.billing_address?.state].filter(Boolean).join(', ')}
                                    {' '}
                                    {order.billing_address?.postal_code ?? order.billing_address?.pincode ?? order.billing_address?.zip}
                                </p>
                                {order.billing_address?.phone && (
                                    <p>{order.billing_address.phone}</p>
                                )}
                            </div>
                        ) : (
                            <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">Same as shipping</span>
                        )}
                    </div>
                </div>

                {(order.shipping_method || order.tracking_number) && (
                    <div className="mt-[var(--lb-space-4)] pt-[var(--lb-space-4)] border-t border-[var(--lb-color-border)] grid gap-0">
                        {order.shipping_method && (
                            <DetailRow label="Shipping method" value={order.shipping_method} />
                        )}
                        {order.carrier && (
                            <DetailRow label="Carrier" value={order.carrier} />
                        )}
                        {order.tracking_number && (
                            <DetailRow label="Tracking number" value={order.tracking_number} />
                        )}
                    </div>
                )}
            </Section>
        </Card>
    )
}

function LineItemsCard({ items }: { items: OrderLineItem[] }) {
    if (items.length === 0) {
        return (
            <Card>
                <Section title="Line items">
                    <EmptyState
                        icon={<MaterialIcon name="inventory_2" />}
                        title="No line items available"
                        body="Line items for this order are not available from the gateway response."
                    />
                </Section>
            </Card>
        )
    }

    return (
        <Card>
            <Section
                title="Line items"
                description={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
            >
                <div className="flex flex-col gap-[var(--lb-space-3)]">
                    {items.map((item, index) => (
                        <div
                            key={`${item.product_id ?? 'item'}-${index}`}
                            className="lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-3)]"
                        >
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                                <div className="flex items-center gap-[var(--lb-space-3)] min-w-0">
                                    {item.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={item.image_url}
                                            alt={item.title ?? ''}
                                            className="lb-rounded-sm w-[var(--lb-size-avatar-md)] h-[var(--lb-size-avatar-md)] object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-[var(--lb-size-avatar-md)] h-[var(--lb-size-avatar-md)] lb-rounded-sm bg-[var(--lb-color-surface-subdued)] flex items-center justify-center flex-shrink-0">
                                            <MaterialIcon name="image" className="text-[var(--lb-color-text-disabled)]" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)] truncate">
                                            {item.title || '—'}
                                        </p>
                                        <p className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                                            {[item.variant_title, item.sku].filter(Boolean).join(' / ') || '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-base)]">
                                    {item.quantity} &times; {formatInrCurrency(item.unit_price) ?? '—'}
                                </div>
                                <div className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                    {formatInrCurrency(item.total) ?? '—'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </Card>
    )
}

function PaymentSummaryCard({ order }: { order: OrderDetail }) {
    const showRefundSection = Boolean(order.refund_status || order.return_status)

    return (
        <Card>
            <Section title="Payment summary">
                <div className="flex justify-end">
                    <div className="w-full md:max-w-sm flex flex-col gap-[var(--lb-space-2)] text-[var(--lb-font-size-base)]">
                        <AmountLine label="Subtotal" value={formatInrCurrency(order.subtotal) ?? '—'} />
                        <AmountLine label="Shipping" value={formatInrCurrency(order.shipping_cost) ?? '—'} />
                        {order.discount > 0 && (
                            <AmountLine
                                label={order.coupon_code ? `Discount (${order.coupon_code})` : 'Discount'}
                                value={`-${formatInrCurrency(order.discount) ?? '—'}`}
                            />
                        )}
                        <AmountLine label="Tax (GST)" value={formatInrCurrency(order.tax) ?? '—'} />
                        <div className="flex justify-between border-t border-[var(--lb-color-border)] pt-[var(--lb-space-2)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                            <span>Total</span>
                            <span>{formatInrCurrency(order.total) ?? '—'}</span>
                        </div>
                    </div>
                </div>

                {showRefundSection && (
                    <div className="mt-[var(--lb-space-4)] pt-[var(--lb-space-4)] border-t border-[var(--lb-color-border)] flex flex-wrap gap-[var(--lb-space-2)]">
                        {order.refund_status && (
                            <DetailRow label="Refund status" value={titleize(order.refund_status)} />
                        )}
                        {order.return_status && (
                            <DetailRow label="Return status" value={titleize(order.return_status)} />
                        )}
                    </div>
                )}
            </Section>
        </Card>
    )
}

function AmountLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-[var(--lb-color-text-subdued)]">
            <span>{label}</span>
            <span>{value}</span>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrderDetailPage() {
    const { store, orderId } = useParams<{ store: string; orderId: string }>()
    const router = useRouter()

    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadOrder = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/orders/${encodeURIComponent(orderId)}`,
                { cache: 'no-store' },
            )
            const payload = await response.json().catch(() => null) as {
                data?: Record<string, unknown>
                error?: unknown
            } | null

            if (!response.ok) {
                if (response.status === 404) {
                    setError('Order not found.')
                } else {
                    const msg = payload?.error
                        ? (typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error))
                        : 'Unable to load order.'
                    setError(msg)
                }
                return
            }

            if (payload?.data && typeof payload.data === 'object') {
                setOrder(mapOrderDetail(payload.data as Record<string, unknown>))
            } else {
                setError('Unexpected response from server.')
            }
        } catch {
            setError('Unable to load order.')
        } finally {
            setLoading(false)
        }
    }, [orderId, store])

    useEffect(() => {
        void loadOrder()
    }, [loadOrder])

    const breadcrumbs = [
        { label: 'Home', href: `/${store}/dashboard` },
        { label: 'Orders', href: `/${store}/orders` },
        { label: order ? `#${order.order_number}` : orderId },
    ]

    if (loading) {
        return (
            <Page>
                <PageHeader
                    eyebrow="Operations"
                    title="Order"
                    breadcrumbs={breadcrumbs}
                />
                <div className="flex flex-col gap-[var(--lb-space-5)]">
                    <Card>
                        <Section title="Order summary">
                            <Skeleton variant="text" lines={6} />
                        </Section>
                    </Card>
                    <Card>
                        <Section title="Line items">
                            <Skeleton variant="table" lines={3} />
                        </Section>
                    </Card>
                </div>
            </Page>
        )
    }

    if (error || !order) {
        return (
            <Page>
                <PageHeader
                    eyebrow="Operations"
                    title="Order"
                    breadcrumbs={breadcrumbs}
                />
                <Card>
                    <Section>
                        <EmptyState
                            icon={<MaterialIcon name="error" />}
                            title="Unable to load order"
                            body={error ?? 'An unexpected error occurred.'}
                            primaryAction={
                                <Button onClick={loadOrder}>
                                    <MaterialIcon name="refresh" />
                                    Retry
                                </Button>
                            }
                            secondaryAction={
                                <Button variant="secondary" onClick={() => router.push(`/${store}/orders`)}>
                                    Back to orders
                                </Button>
                            }
                        />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                eyebrow="Operations"
                title={`Order #${order.order_number}`}
                description={`Placed ${formatIndiaDateWithTime(order.created_at, { emptyValue: '' })}`}
                breadcrumbs={breadcrumbs}
                secondaryActions={[
                    { label: 'All orders', href: `/${store}/orders` },
                ]}
            />

            <div className="flex flex-col gap-[var(--lb-space-5)]">
                <SummaryCard order={order} />
                <CustomerCard order={order} store={store} router={router} />
                <LineItemsCard items={order.items} />
                <AddressesCard order={order} />
                <PaymentSummaryCard order={order} />
            </div>
        </Page>
    )
}
