'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useDebouncedValue, useReadRequest } from '@/lib/api/use-read-request'
import { mapCustomer, type CustomerRow } from '@/lib/customers/list-row'
import { formatIndiaDate as formatDate, formatInrCurrency } from '@letbuyy/ui/formatting'
import { Button, Input, Table, Avatar, Badge, Banner, Card, EmptyState, MaterialIcon, Page, PageHeader, Search, Section, Skeleton, useToast, type TableColumn, type TableBulkAction } from '@letbuyy/ui'

type CustomerView = 'all' | 'active' | 'has-orders' | 'high-value' | 'new'
type CustomerSortKey = 'name' | 'email' | 'phone' | 'total_orders' | 'total_spent' | 'last_order_at' | 'status'
type SortDirection = 'asc' | 'desc'

interface CustomersPayload {
    data?: Array<Record<string, unknown>>
    meta?: {
        total?: number
    }
    error?: unknown
    message?: unknown
}

const customerViews: Array<{ label: string; value: CustomerView }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Has orders', value: 'has-orders' },
    { label: 'High value', value: 'high-value' },
    { label: 'New', value: 'new' },
]

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

function titleize(value: string | null | undefined) {
    const normalized = (value || 'active').replace(/[_-]+/g, ' ').trim().toLowerCase()
    return normalized
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function isNewCustomer(customer: CustomerRow) {
    if (!customer.created_at) return false
    const createdAt = new Date(customer.created_at).getTime()
    if (!createdAt) return false
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    return Date.now() - createdAt <= thirtyDays
}

function matchesCustomerView(customer: CustomerRow, view: CustomerView) {
    switch (view) {
        case 'active':
            return ['active', 'enabled'].includes(customer.status.toLowerCase())
        case 'has-orders':
            return Number(customer.total_orders || 0) > 0
        case 'high-value':
            return Number(customer.total_spent || 0) >= 5000
        case 'new':
            return isNewCustomer(customer)
        case 'all':
        default:
            return true
    }
}

function customerSortValue(customer: CustomerRow, key: CustomerSortKey): string | number {
    switch (key) {
        case 'name':
            return customer.full_name || customer.email || ''
        case 'email':
            return customer.email || ''
        case 'phone':
            return customer.phone || ''
        case 'total_orders':
            return Number(customer.total_orders || 0)
        case 'total_spent':
            return Number(customer.total_spent || 0)
        case 'last_order_at':
            return new Date(customer.last_order_at || '').getTime() || 0
        case 'status':
            return customer.status || ''
        default:
            return ''
    }
}

function compareCustomerRows(a: CustomerRow, b: CustomerRow, key: CustomerSortKey, direction: SortDirection) {
    const aValue = customerSortValue(a, key)
    const bValue = customerSortValue(b, key)
    const result = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
    return direction === 'asc' ? result : -result
}

function customerStatusVariant(status: string) {
    const normalized = status.toLowerCase()
    if (['active', 'enabled'].includes(normalized)) return 'success'
    if (['blocked', 'disabled', 'suspended'].includes(normalized)) return 'critical'
    return 'info'
}

export default function CustomersPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()

    const [customers, setCustomers] = useState<CustomerRow[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const appliedSearch = useDebouncedValue(searchQuery.trim())
    const beginRead = useReadRequest(JSON.stringify([store, appliedSearch]))
    const [error, setError] = useState<string | null>(null)
    const [activeView, setActiveView] = useState<CustomerView>('all')
    const [sortKey, setSortKey] = useState<CustomerSortKey>('last_order_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    const loadCustomers = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setError(null)

        try {
            const query = new URLSearchParams({ limit: '100' })
            if (appliedSearch) query.set('search', appliedSearch)

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/customers?${query.toString()}`, {
                cache: 'no-store',
                signal: request.signal,
            })
            const payload = await response.json().catch(() => null) as CustomersPayload | null
            if (!request.isCurrent()) return

            if (!response.ok) {
                setCustomers([])
                setError(getErrorMessage(payload, 'Unable to load customers'))
                return
            }

            const rows = (Array.isArray(payload?.data) ? payload.data : []).map(mapCustomer)
            setCustomers(rows)
        } catch {
            if (!request.isCurrent()) return
            setCustomers([])
            setError('Unable to load customers')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [store, appliedSearch, beginRead])

    useEffect(() => { loadCustomers() }, [loadCustomers])

    const visibleCustomers = useMemo(() => {
        return customers.filter(customer => matchesCustomerView(customer, activeView))
    }, [activeView, customers])

    const sortedCustomers = useMemo(() => {
        return [...visibleCustomers].sort((a, b) => compareCustomerRows(a, b, sortKey, sortDirection))
    }, [sortDirection, sortKey, visibleCustomers])

    const activeFilters = [
        activeView !== 'all' ? { label: `View: ${customerViews.find(view => view.value === activeView)?.label || activeView}`, onRemove: () => setActiveView('all') } : null,
        appliedSearch ? { label: `Search: ${appliedSearch}`, onRemove: () => setSearchQuery('') } : null,
    ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>

    const handleSort = useCallback((key: string) => {
        const nextKey = key as CustomerSortKey
        if (nextKey === sortKey) {
            setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
            return
        }
        setSortKey(nextKey)
        setSortDirection(nextKey === 'last_order_at' || nextKey === 'total_spent' || nextKey === 'total_orders' ? 'desc' : 'asc')
    }, [sortKey])

    const bulkActions = useMemo<Array<TableBulkAction<CustomerRow>>>(() => [
        {
            label: 'Copy emails',
            onAction: rows => {
                const emails = rows.map(row => row.email).filter(Boolean)
                if (emails.length === 0) {
                    notify({
                        title: 'No email addresses',
                        description: 'The selected customers do not have email addresses to copy.',
                        variant: 'warning',
                    })
                    return
                }
                void navigator.clipboard.writeText(emails.join(', ')).then(() => {
                    notify({
                        title: 'Email addresses copied',
                        description: `${emails.length} ${emails.length === 1 ? 'address' : 'addresses'} copied to clipboard.`,
                        variant: 'success',
                    })
                }).catch(() => {
                    notify({
                        title: 'Copy failed',
                        description: 'Select and copy the email addresses manually.',
                        variant: 'critical',
                    })
                })
            },
        },
    ], [notify])

    const columns: Array<TableColumn<CustomerRow>> = [
        {
            key: 'name',
            header: 'Name',
            sortable: true,
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
            sortable: true,
            render: (customer) => customer.email || '-',
        },
        {
            key: 'phone',
            header: 'Phone',
            sortable: true,
            render: (customer) => customer.phone || '-',
        },
        {
            key: 'total_orders',
            header: 'Orders',
            sortable: true,
            render: (customer) => String(customer.total_orders || 0),
        },
        {
            key: 'total_spent',
            header: 'Spent',
            sortable: true,
            render: (customer) => formatInrCurrency(Number(customer.total_spent || 0)) || '-',
        },
        {
            key: 'last_order_at',
            header: 'Last order',
            sortable: true,
            render: (customer) => formatDate(customer.last_order_at),
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (customer) => (
                <Badge
                    label={titleize(customer.status)}
                    variant={customerStatusVariant(customer.status)}
                />
            ),
        },
    ]

    const isMainEmpty = !error && !searchQuery.trim() && activeView === 'all'
    const emptyState = (
        <EmptyState
            illustration={isMainEmpty ? (
                <Image
                    src="/Emptystate Illustration/Customers.png"
                    alt=""
                    width={200}
                    height={200}
                    aria-hidden="true"
                />
            ) : undefined}
            icon={!isMainEmpty ? <MaterialIcon name={error ? 'error' : 'group'} /> : undefined}
            title={error ? 'Unable to load customers' : searchQuery.trim() || activeView !== 'all' ? 'No matching customers' : 'No customers yet'}
            body={error || (searchQuery.trim()
                ? 'Clear the search to return to the full customer list.'
                : activeView !== 'all'
                    ? 'Clear the current saved view to return to the full customer list.'
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
                <Button variant="secondary" onClick={() => activeView !== 'all' ? setActiveView('all') : router.push(`/${store}/orders`)}>
                    {activeView !== 'all' ? 'Clear view' : 'View orders'}
                </Button>
            ) : undefined}
        />
    )

    return (
        <Page>
            <PageHeader identity="customers"
                recipe="index"
                eyebrow="Relationships"
                title="Customers"
                description="Understand customer history, order value, contact details, and account status."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Customers' }]}
                secondaryActions={[{ label: 'Orders', href: `/${store}/orders` }]}
            />

            <Card>
                <Section
                    title="Customer list"
                    description={`${sortedCustomers.length} ${sortedCustomers.length === 1 ? 'customer' : 'customers'} shown in the current view.`}
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
                            <Table
                                rows={sortedCustomers}
                                columns={columns}
                                emptyState={emptyState}
                                savedViews={customerViews}
                                activeView={activeView}
                                onViewChange={(value) => setActiveView(value as CustomerView)}
                                filterChips={activeFilters}
                                bulkActions={bulkActions}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                                onRowClick={(customer) => router.push(`/${store}/customers/${encodeURIComponent(customer.email)}`)}
                            />
                        )}
                    </div>
                </Section>
            </Card>
        </Page>
    )
}
