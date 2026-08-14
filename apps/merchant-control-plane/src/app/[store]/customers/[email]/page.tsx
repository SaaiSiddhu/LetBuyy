'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Avatar,
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
    useToast,
    Textarea,
} from '@letbuyy/ui'
import {
    formatInrCurrency,
    formatIndiaDate,
    formatIndiaDateWithTime,
} from '@letbuyy/ui/formatting'

// ---------------------------------------------------------------------------
// Local types (gateway response shapes — not typed in shared-types for the
// augmented detail endpoint which returns orders[] on Customer)
// ---------------------------------------------------------------------------

interface OrderRow {
    id: string
    order_number: string
    status: string
    payment_status: string
    fulfillment_status: string | null
    total: number
    created_at: string
    customer_name: string | null
}

interface AddressRow {
    id: string
    full_name: string
    address_line1: string
    address_line2: string | null
    city: string
    state: string
    postal_code: string
    country: string
    landmark: string | null
    label: string | null
    is_default: boolean
    phone: string | null
}

interface CustomerDetail {
    id: string
    store_id: string
    email: string
    display_name: string
    name: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
    status: string
    accepts_marketing: boolean
    tags: string[]
    notes: string | null
    order_count: number
    total_spent: number
    first_order: string | null
    last_order: string | null
    last_order_at: string | null
    created_at: string
    updated_at: string
    orders: OrderRow[]
    addresses: AddressRow[]
}

interface NoteRow {
    id: string
    note: string | null
    created_by: string | null
    created_at: string | null
    updated_at: string | null
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

function readBoolean(row: Record<string, unknown>, key: string): boolean {
    return row[key] === true
}

function readNumber(row: Record<string, unknown>, key: string): number {
    return Number(row[key] ?? 0)
}

function mapOrderRow(raw: Record<string, unknown>): OrderRow {
    return {
        id: readString(raw, 'id'),
        order_number: readString(raw, 'order_number'),
        status: readString(raw, 'status') || 'pending',
        payment_status: readString(raw, 'payment_status') || 'pending',
        fulfillment_status: readNullableString(raw, 'fulfillment_status'),
        total: readNumber(raw, 'total'),
        created_at: readString(raw, 'created_at'),
        customer_name: readNullableString(raw, 'customer_name'),
    }
}

function mapAddressRow(raw: Record<string, unknown>): AddressRow {
    return {
        id: readString(raw, 'id'),
        full_name: readString(raw, 'full_name'),
        address_line1: readString(raw, 'address_line1'),
        address_line2: readNullableString(raw, 'address_line2'),
        city: readString(raw, 'city'),
        state: readString(raw, 'state'),
        postal_code: readString(raw, 'postal_code'),
        country: readString(raw, 'country') || 'IN',
        landmark: readNullableString(raw, 'landmark'),
        label: readNullableString(raw, 'label'),
        is_default: readBoolean(raw, 'is_default'),
        phone: readNullableString(raw, 'phone'),
    }
}

function mapNoteRow(raw: Record<string, unknown>): NoteRow {
    return {
        id: readString(raw, 'id'),
        note: readNullableString(raw, 'note'),
        created_by: readNullableString(raw, 'created_by'),
        created_at: readNullableString(raw, 'created_at'),
        updated_at: readNullableString(raw, 'updated_at'),
    }
}

function mapCustomerDetail(raw: Record<string, unknown>): CustomerDetail {
    const orders = Array.isArray(raw.orders)
        ? (raw.orders as Array<Record<string, unknown>>).map(mapOrderRow)
        : []
    const addresses = Array.isArray(raw.addresses)
        ? (raw.addresses as Array<Record<string, unknown>>).map(mapAddressRow)
        : []

    return {
        id: readString(raw, 'id'),
        store_id: readString(raw, 'store_id'),
        email: readString(raw, 'email'),
        display_name: readString(raw, 'display_name') || readString(raw, 'email'),
        name: readNullableString(raw, 'name'),
        first_name: readNullableString(raw, 'first_name'),
        last_name: readNullableString(raw, 'last_name'),
        phone: readNullableString(raw, 'phone'),
        status: readString(raw, 'status') || 'active',
        accepts_marketing: readBoolean(raw, 'accepts_marketing'),
        tags: Array.isArray(raw.tags) ? (raw.tags as string[]).filter(t => typeof t === 'string') : [],
        notes: readNullableString(raw, 'notes'),
        order_count: readNumber(raw, 'order_count'),
        total_spent: readNumber(raw, 'total_spent'),
        first_order: readNullableString(raw, 'first_order'),
        last_order: readNullableString(raw, 'last_order'),
        last_order_at: readNullableString(raw, 'last_order_at'),
        created_at: readString(raw, 'created_at'),
        updated_at: readString(raw, 'updated_at'),
        orders,
        addresses,
    }
}

function customerStatusVariant(status: string): 'success' | 'critical' | 'info' {
    const n = status.toLowerCase()
    if (['active', 'enabled'].includes(n)) return 'success'
    if (['blocked', 'disabled', 'suspended'].includes(n)) return 'critical'
    return 'info'
}

function titleize(value: string): string {
    return (value || 'Active')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')
}

function orderStatusVariant(status: string): 'success' | 'critical' | 'warning' | 'info' {
    const n = status.toLowerCase()
    if (['delivered', 'fulfilled'].includes(n)) return 'success'
    if (['cancelled', 'refunded', 'returned'].includes(n)) return 'critical'
    if (['pending', 'on_hold'].includes(n)) return 'warning'
    return 'info'
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

function ProfileCard({ customer }: { customer: CustomerDetail }) {
    return (
        <Card>
            <Section title="Profile">
                <div className="flex flex-col gap-[var(--lb-space-4)]">
                    <div className="flex items-center gap-[var(--lb-space-4)]">
                        <Avatar name={customer.display_name || customer.email} size="lg" />
                        <div className="flex flex-col gap-[var(--lb-space-1)]">
                            <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)] text-[var(--lb-font-size-lg)]">
                                {customer.display_name || customer.email}
                            </span>
                            <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                                Customer since {formatIndiaDate(customer.created_at, { emptyValue: '—' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-[var(--lb-space-3)]">
                        <Badge label={titleize(customer.status)} variant={customerStatusVariant(customer.status)} />
                        {customer.accepts_marketing && (
                            <Badge label="Accepts marketing" variant="info" />
                        )}
                        {customer.tags.map(tag => (
                            <Badge key={tag} label={tag} variant="default" />
                        ))}
                    </div>

                    <div className="grid gap-0">
                        <DetailRow label="Email" value={customer.email} />
                        <DetailRow label="Phone" value={customer.phone} />
                        <DetailRow
                            label="Total spent"
                            value={formatInrCurrency(customer.total_spent) ?? '₹0'}
                        />
                        <DetailRow label="Total orders" value={String(customer.order_count)} />
                        <DetailRow
                            label="First order"
                            value={formatIndiaDate(customer.first_order, { emptyValue: '—' })}
                        />
                        <DetailRow
                            label="Last order"
                            value={formatIndiaDate(customer.last_order_at ?? customer.last_order, { emptyValue: '—' })}
                        />
                        <DetailRow
                            label="Customer since"
                            value={formatIndiaDate(customer.created_at, { emptyValue: '—' })}
                        />
                    </div>
                </div>
            </Section>
        </Card>
    )
}

function OrderHistoryCard({
    orders,
    store,
    router,
}: {
    orders: OrderRow[]
    store: string
    router: ReturnType<typeof useRouter>
}) {
    if (orders.length === 0) {
        return (
            <Card>
                <Section title="Order history">
                    <EmptyState
                        icon={<MaterialIcon name="shopping_bag" />}
                        title="No orders yet"
                        body="Orders placed by this customer will appear here."
                    />
                </Section>
            </Card>
        )
    }

    return (
        <Card>
            <Section
                title="Order history"
                description={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
            >
                <div className="flex flex-col gap-[var(--lb-space-2)]">
                    {orders.map(order => (
                        <Button
                            unstyled
                            key={order.id}
                            type="button"
                            className="w-full text-left lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-3)] cursor-pointer transition-colors hover:bg-[var(--lb-component-table-row-hover-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lb-color-focus-ring)]"
                            onClick={() => router.push(`/${store}/orders?id=${order.id}`)}
                        >
                            <div className="flex flex-col gap-[var(--lb-space-2)] md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-col gap-[var(--lb-space-1)]">
                                    <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                                        #{order.order_number}
                                    </span>
                                    <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                                        {formatIndiaDateWithTime(order.created_at, { emptyValue: '—' })}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                    <Badge label={titleize(order.status)} variant={orderStatusVariant(order.status)} />
                                    <Badge label={titleize(order.payment_status)} variant={order.payment_status === 'paid' ? 'success' : 'warning'} />
                                    <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                        {formatInrCurrency(order.total) ?? '—'}
                                    </span>
                                </div>
                            </div>
                        </Button>
                    ))}
                </div>
            </Section>
        </Card>
    )
}

function AddressesCard({ addresses }: { addresses: AddressRow[] }) {
    if (addresses.length === 0) {
        return (
            <Card>
                <Section title="Addresses">
                    <EmptyState
                        icon={<MaterialIcon name="location_on" />}
                        title="No addresses saved"
                        body="Addresses saved by this customer will appear here."
                    />
                </Section>
            </Card>
        )
    }

    return (
        <Card>
            <Section title="Addresses">
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                    {addresses.map(address => (
                        <div
                            key={address.id}
                            className="lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-3)] flex flex-col gap-[var(--lb-space-2)]"
                        >
                            <div className="flex items-center justify-between gap-[var(--lb-space-2)]">
                                <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                                    {address.full_name}
                                </span>
                                <div className="flex items-center gap-[var(--lb-space-1)]">
                                    {address.label && (
                                        <Badge label={address.label} variant="default" />
                                    )}
                                    {address.is_default && (
                                        <Badge label="Default" variant="info" />
                                    )}
                                </div>
                            </div>
                            <div className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                                <p>{address.address_line1}</p>
                                {address.address_line2 && <p>{address.address_line2}</p>}
                                {address.landmark && <p>{address.landmark}</p>}
                                <p>
                                    {address.city}, {address.state} {address.postal_code}
                                </p>
                                {address.phone && <p>{address.phone}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </Card>
    )
}

function NotesCard({
    notes,
    loadingNotes,
    notesError,
    store,
    email,
    onNoteAdded,
}: {
    notes: NoteRow[]
    loadingNotes: boolean
    notesError: string | null
    store: string
    email: string
    onNoteAdded: () => void
}) {
    const { notify } = useToast()
    const [newNote, setNewNote] = useState('')
    const [saving, setSaving] = useState(false)

    const handleAddNote = useCallback(async () => {
        const trimmed = newNote.trim()
        if (!trimmed) return

        setSaving(true)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/customers/${encodeURIComponent(email)}/notes`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ note: trimmed }),
                },
            )
            if (!response.ok) {
                notify({ title: 'Note not saved', description: 'Unable to save the note. Please try again.', variant: 'critical' })
                return
            }
            setNewNote('')
            notify({ title: 'Note saved', variant: 'success' })
            onNoteAdded()
        } catch {
            notify({ title: 'Note not saved', description: 'A network error occurred. Please try again.', variant: 'critical' })
        } finally {
            setSaving(false)
        }
    }, [email, newNote, notify, onNoteAdded, store])

    return (
        <Card>
            <Section title="Notes">
                <div className="flex flex-col gap-[var(--lb-space-4)]">
                    <div className="flex flex-col gap-[var(--lb-space-2)]">
                        <Textarea
                            label="Add a note"
                            placeholder="Write a note about this customer…"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            rows={3}
                        />
                        <div className="flex justify-end">
                            <Button
                                onClick={handleAddNote}
                                disabled={!newNote.trim() || saving}
                            >
                                {saving ? 'Saving…' : 'Save note'}
                            </Button>
                        </div>
                    </div>

                    {notesError && (
                        <Banner title="Unable to load notes" variant="critical">
                            {notesError}
                        </Banner>
                    )}

                    {loadingNotes ? (
                        <Skeleton variant="text" lines={3} />
                    ) : notes.length === 0 ? (
                        <EmptyState
                            icon={<MaterialIcon name="sticky_note_2" />}
                            title="No notes yet"
                            body="Notes you add will appear here."
                        />
                    ) : (
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {notes.map(note => (
                                <div
                                    key={note.id}
                                    className="lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-3)] flex flex-col gap-[var(--lb-space-1)]"
                                >
                                    <p className="text-[var(--lb-color-text)] text-[var(--lb-font-size-base)] whitespace-pre-wrap">
                                        {note.note}
                                    </p>
                                    <span className="text-[var(--lb-color-text-subdued)] text-[var(--lb-font-size-sm)]">
                                        {formatIndiaDateWithTime(note.created_at, { emptyValue: '' })}
                                        {note.created_by ? ` · ${note.created_by}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Section>
        </Card>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CustomerDetailPage() {
    const { store, email: encodedEmail } = useParams<{ store: string; email: string }>()
    const router = useRouter()
    const { notify } = useToast()

    const email = decodeURIComponent(encodedEmail)

    const [customer, setCustomer] = useState<CustomerDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [notes, setNotes] = useState<NoteRow[]>([])
    const [loadingNotes, setLoadingNotes] = useState(true)
    const [notesError, setNotesError] = useState<string | null>(null)

    const loadCustomer = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/customers/${encodeURIComponent(email)}`,
                { cache: 'no-store' },
            )
            const payload = await response.json().catch(() => null) as { data?: Record<string, unknown>; error?: unknown } | null

            if (!response.ok) {
                if (response.status === 404) {
                    setError('Customer not found.')
                } else {
                    const msg = payload?.error
                        ? (typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error))
                        : 'Unable to load customer.'
                    setError(msg)
                }
                return
            }

            if (payload?.data && typeof payload.data === 'object') {
                setCustomer(mapCustomerDetail(payload.data as Record<string, unknown>))
            } else {
                setError('Unexpected response from server.')
            }
        } catch {
            setError('Unable to load customer.')
        } finally {
            setLoading(false)
        }
    }, [email, store])

    const loadNotes = useCallback(async () => {
        setLoadingNotes(true)
        setNotesError(null)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/customers/${encodeURIComponent(email)}/notes`,
                { cache: 'no-store' },
            )
            const payload = await response.json().catch(() => null) as { data?: unknown[] } | null

            if (!response.ok) {
                setNotesError('Unable to load notes.')
                return
            }

            const rows = Array.isArray(payload?.data)
                ? (payload.data as Array<Record<string, unknown>>).map(mapNoteRow)
                : []
            setNotes(rows)
        } catch {
            setNotesError('Unable to load notes.')
        } finally {
            setLoadingNotes(false)
        }
    }, [email, store])

    useEffect(() => {
        void loadCustomer()
    }, [loadCustomer])

    useEffect(() => {
        void loadNotes()
    }, [loadNotes])

    const handleNoteAdded = useCallback(() => {
        void loadNotes()
    }, [loadNotes])

    const handleRefresh = useCallback(() => {
        void loadCustomer()
        void loadNotes()
        notify({ title: 'Refreshed', variant: 'success' })
    }, [loadCustomer, loadNotes, notify])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    eyebrow="Relationships"
                    title="Customer"
                    breadcrumbs={[
                        { label: 'Home', href: `/${store}/dashboard` },
                        { label: 'Customers', href: `/${store}/customers` },
                        { label: email },
                    ]}
                />
                <div className="flex flex-col gap-[var(--lb-space-5)]">
                    <Card>
                        <Section title="Profile">
                            <Skeleton variant="text" lines={6} />
                        </Section>
                    </Card>
                    <Card>
                        <Section title="Order history">
                            <Skeleton variant="table" lines={4} />
                        </Section>
                    </Card>
                </div>
            </Page>
        )
    }

    if (error || !customer) {
        return (
            <Page>
                <PageHeader
                    eyebrow="Relationships"
                    title="Customer"
                    breadcrumbs={[
                        { label: 'Home', href: `/${store}/dashboard` },
                        { label: 'Customers', href: `/${store}/customers` },
                        { label: email },
                    ]}
                />
                <Card>
                    <Section>
                        <EmptyState
                            icon={<MaterialIcon name="error" />}
                            title="Unable to load customer"
                            body={error ?? 'An unexpected error occurred.'}
                            primaryAction={
                                <Button onClick={loadCustomer}>
                                    <MaterialIcon name="refresh" />
                                    Retry
                                </Button>
                            }
                            secondaryAction={
                                <Button variant="secondary" onClick={() => router.push(`/${store}/customers`)}>
                                    Back to customers
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
                eyebrow="Relationships"
                title={customer.display_name || email}
                description={customer.display_name !== email ? email : undefined}
                breadcrumbs={[
                    { label: 'Home', href: `/${store}/dashboard` },
                    { label: 'Customers', href: `/${store}/customers` },
                    { label: customer.display_name || email },
                ]}
                secondaryActions={[
                    { label: 'Refresh', onClick: handleRefresh },
                    { label: 'All customers', href: `/${store}/customers` },
                ]}
            />

            <div className="flex flex-col gap-[var(--lb-space-5)]">
                <ProfileCard customer={customer} />
                <OrderHistoryCard orders={customer.orders} store={store} router={router} />
                <AddressesCard addresses={customer.addresses} />
                <NotesCard
                    notes={notes}
                    loadingNotes={loadingNotes}
                    notesError={notesError}
                    store={store}
                    email={email}
                    onNoteAdded={handleNoteAdded}
                />
            </div>
        </Page>
    )
}
