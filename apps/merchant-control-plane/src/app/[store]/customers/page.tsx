'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Customer as SharedCustomer } from '@letbuyy/shared-types'
import {
    Avatar,
    Badge,
    Banner,
    Button,
    Card,
    EmptyState,
    IndexTable,
    Input,
    MaterialIcon,
    Page,
    PageHeader,
    Search,
    Section,
    Skeleton,
    type IndexTableColumn,
} from '@letbuyy/ui'

type CustomerRow = Omit<Pick<SharedCustomer, 'id' | 'email' | 'phone' | 'status' | 'created_at' | 'total_spent' | 'last_order_at'>, 'email' | 'phone' | 'last_order_at'> & {
    full_name: string
    email: string
    phone: string | null
    total_orders: SharedCustomer['order_count']
    first_order_at: string | null
    last_order_at: string | null
    last_order_id: string | null
}

interface CustomersPayload {
    data?: Array<Record<string, unknown>>
    meta?: {
        total?: number
    }
    error?: unknown
    message?: unknown
}

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string') return message
    }

    return fallback
}

function readString(row: Record<string, unknown>, key: string) {
    const value = row[key]
    return typeof value === 'string' ? value : ''
}

function readNullableString(row: Record<string, unknown>, key: string) {
    const value = row[key]
    return typeof value === 'string' && value.trim() ? value : null
}

function titleize(value: string | null | undefined) {
    const normalized = (value || 'active').replace(/[_-]+/g, ' ').trim().toLowerCase()
    return normalized
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function formatDate(value: string | null) {
    if (!value) return '-'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
}

function customerStatusVariant(status: string) {
    const normalized = status.toLowerCase()
    if (['active', 'enabled'].includes(normalized)) return 'success'
    if (['blocked', 'disabled', 'suspended'].includes(normalized)) return 'critical'
    return 'info'
}

function normalizeCustomerStatus(value: string): CustomerRow['status'] {
    const normalized = value.toLowerCase()
    if (normalized === 'disabled' || normalized === 'invited') return normalized
    return 'active'
}

function mapCustomer(row: Record<string, unknown>): CustomerRow {
    const email = readString(row, 'email') || readString(row, 'customer_email')

    return {
        id: readString(row, 'id') || email,
        full_name: readString(row, 'full_name') || readString(row, 'customer_name'),
        email,
        phone: readNullableString(row, 'phone') || readNullableString(row, 'customer_phone'),
        total_orders: Number(row.total_orders || 0),
        total_spent: Number(row.total_spent || 0),
        status: normalizeCustomerStatus(readString(row, 'status')),
        created_at: readString(row, 'created_at'),
        first_order_at: readNullableString(row, 'first_order_at'),
        last_order_at: readNullableString(row, 'last_order_at'),
        last_order_id: readNullableString(row, 'last_order_id'),
    }
}

export default function CustomersPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()

    const [customers, setCustomers] = useState<CustomerRow[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [error, setError] = useState<string | null>(null)

    const loadCustomers = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const query = new URLSearchParams({ limit: '100' })
            if (searchQuery.trim()) query.set('search', searchQuery.trim())

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/customers?${query.toString()}`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null) as CustomersPayload | null

            if (!response.ok) {
                setCustomers([])
                setTotalCount(0)
                setError(getErrorMessage(payload, 'Unable to load customers'))
                return
            }

            const rows = (Array.isArray(payload?.data) ? payload.data : []).map(mapCustomer)
            setCustomers(rows)
            setTotalCount(Number(payload?.meta?.total || rows.length || 0))
        } catch {
            setCustomers([])
            setTotalCount(0)
            setError('Unable to load customers')
        } finally {
            setLoading(false)
        }
    }, [store, searchQuery])

    useEffect(() => { loadCustomers() }, [loadCustomers])

    const activeFilters = searchQuery.trim()
        ? [{ label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery('') }]
        : []

    const columns: Array<IndexTableColumn<CustomerRow>> = [
        {
            key: 'name',
            header: 'Name',
            render: (customer) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <Avatar name={customer.full_name || customer.email || 'Customer'} size="sm" />
                    <span className="min-w-0 truncate font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                        {customer.full_name || 'Anonymous'}
                    </span>
                </div>
            ),
        },
        {
            key: 'email',
            header: 'Email',
            render: (customer) => customer.email || '-',
        },
        {
            key: 'phone',
            header: 'Phone',
            render: (customer) => customer.phone || '-',
        },
        {
            key: 'total_orders',
            header: 'Orders',
            render: (customer) => String(customer.total_orders || 0),
        },
        {
            key: 'total_spent',
            header: 'Spent',
            render: (customer) => formatCurrency(Number(customer.total_spent || 0)),
        },
        {
            key: 'last_order_at',
            header: 'Last order',
            render: (customer) => formatDate(customer.last_order_at),
        },
        {
            key: 'status',
            header: 'Status',
            render: (customer) => (
                <Badge
                    label={titleize(customer.status)}
                    variant={customerStatusVariant(customer.status)}
                />
            ),
        },
    ]

    const emptyState = (
        <EmptyState
            icon={<MaterialIcon name={error ? 'error' : 'group'} />}
            title={error ? 'Unable to load customers' : searchQuery.trim() ? 'No matching customers' : 'No customers yet'}
            body={error || (searchQuery.trim()
                ? 'Clear the search to return to the full customer list.'
                : 'When customers place orders or create accounts in your store, they will appear here.')}
            primaryAction={error ? (
                <Button onClick={loadCustomers}>
                    <MaterialIcon name="refresh" />
                    Retry
                </Button>
            ) : undefined}
            secondaryAction={!error && searchQuery.trim() ? (
                <Button variant="secondary" onClick={() => setSearchQuery('')}>
                    Clear search
                </Button>
            ) : !error ? (
                <Button variant="secondary" onClick={() => router.push(`/${store}/orders`)}>
                    View orders
                </Button>
            ) : undefined}
        />
    )

    return (
        <Page>
            <PageHeader
                eyebrow="Relationships"
                title="Customers"
                description="Understand customer history, order value, contact details, and account status."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Customers' }]}
                secondaryActions={[{ label: 'Orders', href: `/${store}/orders` }]}
            />

            <Card>
                <Section
                    title="Customer list"
                    description={`${totalCount} ${totalCount === 1 ? 'customer' : 'customers'} in the current view.`}
                >
                    <div className="flex flex-col gap-[var(--lb-space-4)]">
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                            <Input
                                label="Search customers"
                                placeholder="Search by name, email, or phone"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                leftIcon={<Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            />
                            <Button variant="secondary" onClick={loadCustomers}>
                                <MaterialIcon name="sync" />
                                Refresh
                            </Button>
                        </div>

                        {error && customers.length > 0 && (
                            <Banner title="Customer refresh failed" variant="critical">
                                {error}
                            </Banner>
                        )}

                        {loading ? (
                            <Skeleton variant="table" lines={6} />
                        ) : (
                            <IndexTable
                                rows={customers}
                                columns={columns}
                                emptyState={emptyState}
                                filterChips={activeFilters}
                            />
                        )}
                    </div>
                </Section>
            </Card>
        </Page>
    )
}
