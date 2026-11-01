'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import type { Product as SharedProduct } from '@letbuyy/shared-types'
import { Badge, Button, Input, Table, Banner, Card, MaterialIcon, Page, PageHeader, Section, type TableColumn, type TableBulkAction } from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'

type ProductRow = Pick<
    SharedProduct,
    'version' | 'id' | 'name' | 'status' | 'stock' | 'price' | 'compare_price' | 'images' | 'category' | 'product_type' | 'vendor' | 'is_active' | 'created_at'
>

type TabFilter = 'all' | 'active' | 'draft' | 'archived'
type ProductStatus = 'active' | 'draft' | 'archived'
type ProductSortKey = 'name' | 'stock' | 'created_at'
type SortDirection = 'asc' | 'desc'

interface ProductsPayload {
    data?: ProductRow[]
    meta?: { total?: number; page?: number; per_page?: number; has_next?: boolean; total_is_exact?: boolean }
}

const productViews: Array<{ label: string; value: TabFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
    { label: 'Archived', value: 'archived' },
]

const productStatusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
    { label: 'Archived', value: 'archived' },
]

const productStatusBadge = {
    active:   'success'  as const,
    draft:    'warning'  as const,
    archived: 'critical' as const,
} as const

type StatusOutcome = 'not_sent' | 'uncertain' | 'confirmed' | 'conflict' | 'failed'
type StatusCommand = {
    id: string; name: string; target: ProductStatus; key: string; version: number; payload: string
    outcome: StatusOutcome; message?: string; reviewed?: ProductRow
}
type StatusJob = { actorId: string; store: string; items: StatusCommand[] }
const positiveVersion = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0
const statusLabel = (status: ProductStatus) => status.charAt(0).toUpperCase() + status.slice(1)
const pendingJob = (job: StatusJob | null) => !!job?.items.some(item => ['not_sent', 'uncertain', 'conflict'].includes(item.outcome))

function restoreStatusJob(raw: string, actorId: string, store: string): StatusJob {
    const job = JSON.parse(raw) as StatusJob
    if (!job || job.actorId !== actorId || job.store !== store || !Array.isArray(job.items) || !job.items.length || job.items.length > 100) throw new Error('Invalid saved status changes')
    const ids = new Set<string>()
    for (const item of job.items) {
        const body = JSON.parse(item.payload)
        if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string'
            || !['active', 'draft', 'archived'].includes(item.target) || !positiveVersion(item.version)
            || typeof item.key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.key)
            || !['not_sent', 'uncertain', 'confirmed', 'conflict', 'failed'].includes(item.outcome)
            || (item.message !== undefined && typeof item.message !== 'string')
            || !body || Object.keys(body).sort().join(',') !== 'idempotency_key,is_active,status,version'
            || body.version !== item.version || body.idempotency_key !== item.key || body.status !== item.target || body.is_active !== (item.target === 'active')) throw new Error('Invalid saved status changes')
        ids.add(item.id)
        // Reviewing a conflict is a new explicit read in this page, never a stored approval.
        delete item.reviewed
    }
    return job
}

function normalizeProductStatus(product: ProductRow): ProductStatus {
    const status = (product.status || (product.is_active ? 'active' : 'draft')).toLowerCase()
    return status === 'archived' ? 'archived' : status === 'active' ? 'active' : 'draft'
}

function productDescriptor(product: ProductRow) {
    return product.product_type || product.category || 'Not categorized'
}

function stopTableAction(event: SyntheticEvent) {
    event.stopPropagation()
}

export default function ProductsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()

    const { actorId } = useMerchantSecurityContext(store)
    const storageKey = `letbuyy.product-status.v1:${actorId}:${store}`
    const scope = useRef({ key: storageKey, epoch: 0 })
    if (scope.current.key !== storageKey) scope.current = { key: storageKey, epoch: scope.current.epoch + 1 }
    const mounted = useRef(true)
    const readSequence = useRef(0)
    const busy = useRef(false)
    const [working, setWorking] = useState(false)
    const [job, setJob] = useState<StatusJob | null>(null)
    const jobRef = useRef<StatusJob | null>(null)
    const [readyScope, setReadyScope] = useState<string | null>(null)
    const [storageError, setStorageError] = useState<string | null>(null)
    const [accessChanged, setAccessChanged] = useState(false)
    const [products, setProducts] = useState<ProductRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<TabFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [appliedSearch, setAppliedSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [total, setTotal] = useState<number | undefined>(undefined)
    const [hasNext, setHasNext] = useState(false)
    const [sortKey, setSortKey] = useState<ProductSortKey>('created_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    useEffect(() => {
        const timer = window.setTimeout(() => { setAppliedSearch(searchQuery.trim()); setPage(1) }, 250)
        return () => window.clearTimeout(timer)
    }, [searchQuery])

    useEffect(() => { mounted.current = true; return () => { mounted.current = false; readSequence.current++ } }, [])
    useEffect(() => {
        setReadyScope(null); setStorageError(null); setAccessChanged(false); setWorking(false); busy.current = false
        let restored: StatusJob | null = null
        try { const raw = window.sessionStorage.getItem(storageKey); if (raw) restored = restoreStatusJob(raw, actorId, store) }
        catch { setStorageError('Saved status changes could not be read. Reload this tab or recover the saved request before starting another change.') }
        jobRef.current = restored; setJob(restored); setProducts([]); setReadyScope(storageKey)
    }, [storageKey, actorId, store])
    const currentScope = useCallback((captured: { key: string; epoch: number }) => mounted.current && scope.current === captured, [])
    const retainJob = useCallback((next: StatusJob, captured: { key: string; epoch: number }) => {
        if (!currentScope(captured)) return false
        try {
            if (pendingJob(next)) window.sessionStorage.setItem(captured.key, JSON.stringify(next))
            else window.sessionStorage.removeItem(captured.key)
        } catch {
            setStorageError('Status changes could not be saved in this tab. Keep this page open and recover the pending request before continuing.')
            // Keep every command in memory even if storage becomes unavailable after a reply.
            jobRef.current = next; setJob(next); return false
        }
        jobRef.current = next; setJob(next); return true
    }, [currentScope])

    const loadProducts = useCallback(async () => {
        const captured = scope.current, sequence = ++readSequence.current
        setLoading(true); setError(null)
        const query = new URLSearchParams({ status: activeTab, page: String(page), limit: String(pageSize), sort: sortKey, order: sortDirection, view: 'summary', withCount: 'true' })
        if (appliedSearch) query.set('search', appliedSearch)
        if (categoryFilter.trim()) query.set('category', categoryFilter.trim())
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products?${query}`, {
                cache: 'no-store', headers: { 'X-LetBuyy-Merchant-Context': actorId },
            })
            if (!response.ok) throw new Error('Unable to load products')
            const payload = await response.json() as ProductsPayload
            if (currentScope(captured) && sequence === readSequence.current) {
                setProducts(Array.isArray(payload.data) ? payload.data : [])
                setTotal(payload.meta?.total_is_exact && typeof payload.meta.total === 'number' ? payload.meta.total : undefined)
                setHasNext(Boolean(payload.meta?.has_next))
                if (page > 1 && Array.isArray(payload.data) && payload.data.length === 0) setPage(1)
            }
        } catch {
            if (currentScope(captured) && sequence === readSequence.current) { setProducts([]); setTotal(undefined); setHasNext(false); setError('Products could not be loaded. Try again when the catalog service is reachable.') }
        } finally { if (currentScope(captured) && sequence === readSequence.current) setLoading(false) }
    }, [store, actorId, activeTab, page, pageSize, sortKey, sortDirection, appliedSearch, categoryFilter, currentScope])
    useEffect(() => { void loadProducts(); return () => { readSequence.current++ } }, [loadProducts])

    const makeCommand = (product: ProductRow, target: ProductStatus): StatusCommand => {
        if (!positiveVersion(product.version)) throw new Error(`Refresh ${product.name} to load its current version before changing status.`)
        const key = crypto.randomUUID()
        return { id: product.id, name: product.name, target, key, version: product.version,
            payload: JSON.stringify({ status: target, is_active: target === 'active', version: product.version, idempotency_key: key }), outcome: 'not_sent' }
    }
    const sendCommands = useCallback(async (initial: StatusJob, indexes: number[]) => {
        if (busy.current || storageError || accessChanged) return
        const captured = scope.current
        busy.current = true; setWorking(true); setError(null)
        let next = initial
        const update = (index: number, patch: Partial<StatusCommand>) => {
            next = { ...next, items: next.items.map((item, i) => i === index ? { ...item, ...patch } : item) }
            return retainJob(next, captured)
        }
        try {
            if (!retainJob(next, captured)) return
            for (const index of indexes) {
                if (!currentScope(captured)) return
                const command = next.items[index], wasUncertain = command.outcome === 'uncertain'
                // Persist the exact command before dispatch: an unload can lose any acknowledgement.
                if (!update(index, { outcome: 'uncertain', message: undefined })) return
                try {
                    const response = await fetch(`/api/stores/${encodeURIComponent(initial.store)}/products/${encodeURIComponent(command.id)}`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': command.key, 'X-LetBuyy-Merchant-Context': initial.actorId }, body: command.payload,
                    })
                    const payload = await response.json().catch(() => null)
                    if (!currentScope(captured)) return
                    const code = payload?.error?.code
                    if ([401, 403, 404].includes(response.status) || code === 'SESSION_CONTEXT_CHANGED') {
                        update(index, { outcome: wasUncertain ? 'uncertain' : 'failed', message: 'This change was refused. Reload the store with the intended account.' })
                        setAccessChanged(true); break
                    }
                    if (response.status === 409 && code === 'PRODUCT_VERSION_CONFLICT') {
                        if (!update(index, { outcome: 'conflict', message: 'Review the latest product before applying your requested status.' })) return
                    } else if (response.ok) {
                        const product = payload?.data as ProductRow | undefined
                        if (!product || product.id !== command.id || !positiveVersion(product.version) || product.status !== command.target || product.is_active !== (command.target === 'active')) {
                            if (!update(index, { outcome: 'uncertain', message: 'The response could not confirm this change. Retry the saved request.' })) return
                        } else {
                            readSequence.current++
                            setLoading(false)
                            setProducts(rows => rows.map(row => row.id === product.id && (!positiveVersion(row.version) || product.version >= row.version) ? { ...row, ...product } : row))
                            if (!update(index, { outcome: 'confirmed', reviewed: undefined })) return
                        }
                    } else if (response.status >= 500 || wasUncertain) {
                        if (!update(index, { outcome: 'uncertain', message: 'The outcome is unknown. Retry the saved request.' })) return
                    } else {
                        if (!update(index, { outcome: 'failed', message: payload?.error?.message || 'This change was refused.' })) return
                    }
                } catch {
                    if (!currentScope(captured)) return
                    if (!update(index, { outcome: 'uncertain', message: 'The reply was lost. Retry the saved request.' })) return
                }
            }
        } finally { if (currentScope(captured)) { busy.current = false; setWorking(false) } }
    }, [accessChanged, storageError, retainJob, currentScope])

    const startChanges = useCallback((rows: ProductRow[], target: ProductStatus) => {
        if (readyScope !== storageKey || busy.current || storageError || accessChanged || pendingJob(jobRef.current) || !rows.length) return
        try {
            // Capture every selected row before the first effect. A failed capture sends none.
            const next = { actorId, store, items: rows.map(row => makeCommand(row, target)) }
            void sendCommands(next, next.items.map((_, index) => index))
        } catch (err) { setError(err instanceof Error ? err.message : 'Refresh products before changing status.') }
    }, [readyScope, storageKey, storageError, accessChanged, actorId, store, sendCommands])
    const updateProductStatus = useCallback((product: ProductRow, target: ProductStatus) => {
        if (normalizeProductStatus(product) !== target) startChanges([product], target)
    }, [startChanges])
    const updateSelectedProducts = useCallback((rows: ProductRow[], target: ProductStatus) => startChanges(rows, target), [startChanges])
    const reviewLatest = async (index: number) => {
        if (busy.current || accessChanged || storageError) return
        const captured = scope.current, original = jobRef.current, command = original?.items[index]
        if (!original || command?.outcome !== 'conflict') return
        busy.current = true; setWorking(true)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/${encodeURIComponent(command.id)}`, {
                cache: 'no-store', headers: { 'X-LetBuyy-Merchant-Context': actorId },
            })
            const payload = await response.json().catch(() => null)
            if (!currentScope(captured)) return
            if ([401, 403, 404].includes(response.status) || payload?.error?.code === 'SESSION_CONTEXT_CHANGED') { setAccessChanged(true); return }
            const product = payload?.data as ProductRow | undefined
            if (!response.ok || !product || product.id !== command.id || !positiveVersion(product.version)) { setError('The latest product could not be read. Your requested status is kept.'); return }
            retainJob({ ...original, items: original.items.map((item, i) => i === index ? { ...item, reviewed: product } : item) }, captured)
        } catch { if (currentScope(captured)) setError('The latest product could not be read. Your requested status is kept.') }
        finally { if (currentScope(captured)) { busy.current = false; setWorking(false) } }
    }
    const applyReviewed = (index: number) => {
        if (busy.current || accessChanged || storageError) return
        const original = jobRef.current, command = original?.items[index]
        if (!original || command?.outcome !== 'conflict' || !command.reviewed) return
        const next = { ...original, items: original.items.map((item, i) => i === index ? makeCommand(command.reviewed!, command.target) : item) }
        void sendCommands(next, [index])
    }
    const statusActionsBlocked = readyScope !== storageKey || working || !!storageError || accessChanged || pendingJob(job)

    const activeFilters = [
        categoryFilter.trim() ? { label: `Category: ${categoryFilter.trim()}`, onRemove: () => { setCategoryFilter(''); setPage(1) } } : null,
    ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>

    const handleSort = useCallback((key: string) => {
        const nextKey = key as ProductSortKey
        if (!['name', 'stock', 'created_at'].includes(nextKey)) return
        if (nextKey === sortKey) setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
        else setSortDirection(nextKey === 'created_at' ? 'desc' : 'asc')
        setSortKey(nextKey)
        setPage(1)
    }, [sortKey])

    const bulkActions = useMemo<Array<TableBulkAction<ProductRow>>>(() => [
        {
            label: 'Publish',
            onAction: rows => { void updateSelectedProducts(rows, 'active') },
        },
        {
            label: 'Set as draft',
            onAction: rows => { void updateSelectedProducts(rows, 'draft') },
        },
    ], [updateSelectedProducts])

    const columns = useMemo<Array<TableColumn<ProductRow>>>(() => [
        {
            key: 'name',
            header: 'Product',
            sortable: true,
            truncate: true,
            render: (product) => (
                <Link
                    href={`/${store}/products/${product.id}`}
                    className="inline-flex min-w-0 items-center gap-[var(--lb-space-3)] text-[var(--lb-color-text)] no-underline hover:text-[var(--lb-color-primary)]"
                >
                    <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[var(--lb-color-text-subdued)]">
                        {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <MaterialIcon name="image" />
                        )}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-[var(--lb-font-weight-medium)]">{product.name}</span>
                        <span className="block truncate text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                            {productDescriptor(product)}
                        </span>
                    </span>
                </Link>
            ),
            cardRender: (product) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[var(--lb-color-text-subdued)]">
                        {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <MaterialIcon name="image" />
                        )}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-[var(--lb-font-weight-medium)]">{product.name}</span>
                        <span className="block truncate text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                            {productDescriptor(product)}
                        </span>
                    </span>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            shrink: true,
            render: (product) => {
                const status = normalizeProductStatus(product)
                return (
                    <div className="relative inline-flex items-center" onClick={stopTableAction}>
                        <Badge
                            label={status.charAt(0).toUpperCase() + status.slice(1)}
                            variant={productStatusBadge[status]}
                            className="pointer-events-none"
                        />
                        <select
                            aria-label={`Change status for ${product.name}`}
                            disabled={statusActionsBlocked}
                            value={status}
                            onChange={(e) => {
                                e.stopPropagation()
                                void updateProductStatus(product, e.target.value as ProductStatus)
                            }}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        >
                            {productStatusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                )
            },
            cardRender: (product) => {
                const status = normalizeProductStatus(product)
                return <Badge label={status.charAt(0).toUpperCase() + status.slice(1)} variant={productStatusBadge[status]} />
            },
        },
        {
            key: 'stock',
            header: 'Inventory',
            sortable: true,
            shrink: true,
            render: (product) => <span className="tabular-nums">{typeof product.stock === 'number' && Number.isFinite(product.stock) ? `${product.stock} in stock` : 'Stock unavailable'}{typeof product.stock === 'number' && product.stock <= 5 && <span className="ml-[var(--lb-space-2)] text-[color:var(--lb-color-warning)]">Low stock</span>}</span>,
        },
        {
            key: 'category',
            header: 'Category',
            render: (product) => product.category || 'Uncategorized',
        },
        {
            key: 'product_type',
            header: 'Product type',
            shrink: true,
            render: (product) => product.product_type || '—',
        },
        {
            key: 'vendor',
            header: 'Vendor',
            shrink: true,
            render: (product) => product.vendor || 'No vendor',
        },
        {
            key: 'created_at',
            header: 'Created',
            sortable: true,
            shrink: true,
            render: (product) => product.created_at ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(product.created_at)) : '—',
        },
    ], [store, updateProductStatus, statusActionsBlocked])

    const filteredView = Boolean(appliedSearch || categoryFilter.trim() || activeTab !== 'all')
    const emptyTitle = error ? 'Products unavailable' : filteredView ? 'No matching products' : 'Add your first product'
    const emptyBody = filteredView
        ? 'Clear the search or filters to find products in this catalog.'
        : 'Start your catalog with products, variants, inventory, and storefront-ready details.'

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                eyebrow="Catalog"
                title="Products"
                description="Manage products, inventory, publishing status, vendors, and storefront visibility."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Products' }]}
                primaryAction={{ label: 'Add product', href: `/${store}/products/new`, icon: <MaterialIcon name="add" /> }}
                secondaryActions={[{ label: 'Collections', href: `/${store}/products/collections` }]}
            />

            {accessChanged && <Banner title="Account or store access changed" variant="critical">Reload this store with the intended account before continuing.</Banner>}
            {storageError && <Banner title="Saved status changes need recovery" variant="critical">{storageError}</Banner>}
            {job && <Card><Section title="Status changes" description="Each product is saved separately. Confirmed changes will not be repeated.">
                <div aria-live="polite">
                    {(['confirmed', 'uncertain', 'conflict', 'not_sent', 'failed'] as StatusOutcome[]).map(outcome => <p key={outcome}>{job.items.filter(item => item.outcome === outcome).length} {outcome === 'conflict' ? 'needs review' : outcome === 'not_sent' ? 'not sent' : outcome}</p>)}
                </div>
                {job.items.some(item => item.outcome === 'uncertain') && <Button disabled={working || accessChanged || !!storageError} onClick={() => void sendCommands(jobRef.current!, jobRef.current!.items.flatMap((item, index) => item.outcome === 'uncertain' ? [index] : []))}>Retry uncertain changes</Button>}
                {job.items.some(item => item.outcome === 'not_sent') && <Button disabled={working || !!storageError} onClick={() => {
                    if (busy.current || !jobRef.current) return
                    retainJob({ ...jobRef.current, items: jobRef.current.items.filter(item => item.outcome !== 'not_sent') }, scope.current)
                }}>Discard changes not sent</Button>}
                {job.items.map((item, index) => item.outcome !== 'confirmed' && <div key={item.id}>
                    <p>Requested {statusLabel(item.target)} for {item.name}</p>
                    {item.message && <p>{item.message}</p>}
                    {item.outcome === 'conflict' && <>
                        <Button disabled={working || accessChanged || !!storageError} onClick={() => void reviewLatest(index)}>Review latest for {item.name}</Button>
                        {item.reviewed && <><p>Latest status: {statusLabel(normalizeProductStatus(item.reviewed))}. Applying your request will use the reviewed version.</p><Button disabled={working || accessChanged || !!storageError} onClick={() => applyReviewed(index)}>Apply requested status for {item.name}</Button></>}
                    </>}
                </div>)}
            </Section></Card>}

            <Card as="div" className="overflow-visible p-[var(--lb-density-card-padding)]">
                {error && <Banner title="Products unavailable" variant="critical">{error}</Banner>}
                <Table
                    rows={products}
                    columns={columns}
                    loading={loading}
                    appearance="flat"
                    hideHeaderWhenEmpty={false}
                    savedViews={productViews}
                    activeView={activeTab}
                    onViewChange={(value) => { setActiveTab(value as TabFilter); setPage(1) }}
                    search={{ label: 'Search products', placeholder: 'Search product names', value: searchQuery, onChange: setSearchQuery }}
                    filterContent={<div className="grid gap-[var(--lb-space-3)]">
                        <strong className="text-[length:var(--lb-font-size-body)]">Filter products</strong>
                        <Input label="Category" placeholder="Exact category name" value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1) }} />
                        <Button variant="secondary" size="sm" onClick={loadProducts}><MaterialIcon name="sync" />Refresh products</Button>
                    </div>}
                    filterChips={activeFilters}
                    bulkActions={statusActionsBlocked ? [] : bulkActions}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    preferencesKey={`letbuyy.table.products:${actorId}:${store}`}
                    selectionScopeKey={`${store}:${activeTab}:${appliedSearch}:${categoryFilter}:${page}:${pageSize}`}
                    pagination={{ page, pageSize, total, hasNext, itemLabel: 'products', onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1) } }}
                    emptyState={<EmptyState scene="products"
                        icon={filteredView || error ? <MaterialIcon name="products" /> : undefined}
                        title={emptyTitle}
                        body={error ? error : emptyBody}
                        primaryAction={error ? <Button onClick={loadProducts}>Retry</Button> : !filteredView ? <Button onClick={() => router.push(`/${store}/products/new`)}><MaterialIcon name="add" />Add product</Button> : undefined}
                        secondaryAction={!error && filteredView ? <Button variant="secondary" onClick={() => { setSearchQuery(''); setCategoryFilter(''); setActiveTab('all'); setPage(1) }}>Clear filters</Button> : undefined}
                    />}
                    onRowClick={(product) => router.push(`/${store}/products/${product.id}`)}
                />
            </Card>
        </Page>
    )
}
