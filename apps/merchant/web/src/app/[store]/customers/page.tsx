'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDebouncedValue, useReadRequest } from '@/lib/api/use-read-request'
import { mapCustomer, type CustomerRow } from '@/lib/customers/list-row'
import { formatIndiaDate as formatDate, formatInrCurrency } from '@letbuyy/ui/formatting'
import { Button, Table, Avatar, Badge, Banner, Card, MaterialIcon, Page, PageHeader, useToast, type TableColumn, type TableBulkAction } from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'

type CustomerView = 'all' | 'active' | 'has-orders' | 'high-value' | 'new'
type CustomerSortKey = 'name' | 'email' | 'phone' | 'total_orders' | 'total_spent' | 'last_order_at' | 'status'
type SortDirection = 'asc' | 'desc'

interface CustomersPayload {
    data?: Array<Record<string, unknown>>
    meta?: {
        total?: number
        has_next?: boolean
        total_is_exact?: boolean
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
    const [totalCount, setTotalCount] = useState(0)
    const [totalExact, setTotalExact] = useState(false)
    const [hasNext, setHasNext] = useState(false)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const appliedSearch = useDebouncedValue(searchQuery.trim())
    const [error, setError] = useState<string | null>(null)
    const [activeView, setActiveView] = useState<CustomerView>('all')
    const [sortKey, setSortKey] = useState<CustomerSortKey>('last_order_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const beginRead = useReadRequest(JSON.stringify([store, appliedSearch, activeView, page, pageSize, sortKey, sortDirection]))

    useEffect(() => { setPage(1) }, [appliedSearch, activeView])

    const loadCustomers = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setError(null)

        try {
            const query = new URLSearchParams({
                page: String(page),
                limit: String(pageSize),
                view: activeView,
                sort: sortKey,
                order: sortDirection,
                withCount: 'true',
            })
            if (appliedSearch) query.set('search', appliedSearch)

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/customers?${query.toString()}`, {
                cache: 'no-store',
                signal: request.signal,
            })
            const payload = await response.json().catch(() => null) as CustomersPayload | null
            if (!request.isCurrent()) return

            if (!response.ok) {
                setCustomers([])
                setTotalCount(0)
                setHasNext(false)
                setError(getErrorMessage(payload, 'Unable to load customers'))
                return
            }

            if (!Array.isArray(payload?.data)) throw new Error('Customers response is incomplete')
            const rows = payload.data.map(mapCustomer)
            setCustomers(rows)
            setTotalCount(payload?.meta?.total ?? rows.length)
            setTotalExact(payload?.meta?.total_is_exact === true)
            setHasNext(payload?.meta?.has_next === true)
            if (page > 1 && rows.length === 0) setPage(1)
        } catch {
            if (!request.isCurrent()) return
            setCustomers([])
            setTotalCount(0)
            setHasNext(false)
            setError('Unable to load customers')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [store, appliedSearch, activeView, page, pageSize, sortKey, sortDirection, beginRead])

    useEffect(() => { loadCustomers() }, [loadCustomers])

    const handleSort = useCallback((key: string) => {
        const nextKey = key as CustomerSortKey
        if (nextKey === sortKey) {
            setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
            return
        }
        setSortKey(nextKey)
        setSortDirection(nextKey === 'last_order_at' || nextKey === 'total_spent' || nextKey === 'total_orders' ? 'desc' : 'asc')
        setPage(1)
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
            render: (customer) => Number.isSafeInteger(customer.total_orders) ? String(customer.total_orders) : '—',
        },
        {
            key: 'total_spent',
            header: 'Spent',
            sortable: true,
            render: (customer) => typeof customer.total_spent === 'number' && Number.isFinite(customer.total_spent) ? formatInrCurrency(customer.total_spent) : '—',
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
        <EmptyState scene="customers"
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

            <Card as="div" className="overflow-visible p-[var(--lb-density-card-padding)]">
                {error && <Banner title="Customers unavailable" variant="critical">{error}</Banner>}
                <Table
                    rows={customers}
                    columns={columns}
                    loading={loading}
                    appearance="flat"
                    hideHeaderWhenEmpty={false}
                    emptyState={emptyState}
                    savedViews={customerViews}
                    activeView={activeView}
                    onViewChange={(value) => setActiveView(value as CustomerView)}
                    search={{ label: 'Search customers', placeholder: 'Search by name, email, or phone', value: searchQuery, onChange: setSearchQuery }}
                    filterContent={<div className="grid gap-[var(--lb-space-3)]"><strong className="text-[length:var(--lb-font-size-body)]">Customer records</strong><p className="text-[var(--lb-color-text-muted)]">Use the views to narrow customers by activity and value.</p><Button variant="secondary" size="sm" onClick={loadCustomers}><MaterialIcon name="sync" />Refresh customers</Button></div>}
                    bulkActions={bulkActions}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    preferencesKey={`letbuyy.table.customers:${store}`}
                    selectionScopeKey={`${store}:${activeView}:${appliedSearch}:${page}:${pageSize}`}
                    pagination={{ page, pageSize, total: totalExact ? totalCount : undefined, hasNext, itemLabel: 'customers', onPageChange: setPage, onPageSizeChange: size => { setPageSize(size); setPage(1) } }}
                    onRowClick={(customer) => router.push(`/${store}/customers/${encodeURIComponent(customer.email)}`)}
                />
            </Card>
        </Page>
    )
}
