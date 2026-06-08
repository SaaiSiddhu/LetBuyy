'use client'

import { useState, useEffect, useCallback, useMemo, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { Product as SharedProduct } from '@letbuyy/shared-types'
import { Button, Input, Table, Badge, Banner, Card, EmptyState, MaterialIcon, Page, PageHeader, Search, Section, Select, Skeleton, useToast, type TableColumn, type TableBulkAction } from '@letbuyy/ui'

type ProductRow = Pick<
    SharedProduct,
    'id' | 'name' | 'status' | 'stock' | 'price' | 'compare_price' | 'images' | 'category' | 'product_type' | 'vendor' | 'is_active' | 'created_at'
>

type TabFilter = 'all' | 'active' | 'draft' | 'archived'
type ProductStatus = 'active' | 'draft' | 'archived'
type ProductSortKey = 'name' | 'status' | 'stock' | 'product_type' | 'vendor' | 'created_at'
type SortDirection = 'asc' | 'desc'

interface ProductsPayload {
    data?: ProductRow[]
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

function statusBadge(product: ProductRow) {
    const status = normalizeProductStatus(product)
    const label = status.charAt(0).toUpperCase() + status.slice(1)
    const variant = status === 'active' ? 'success' : status === 'archived' ? 'critical' : 'warning'
    return <Badge label={label} variant={variant} />
}

function normalizeProductStatus(product: ProductRow): ProductStatus {
    const status = (product.status || (product.is_active ? 'active' : 'draft')).toLowerCase()
    return status === 'archived' ? 'archived' : status === 'active' ? 'active' : 'draft'
}

function productDescriptor(product: ProductRow) {
    return product.product_type || product.category || 'Not categorized'
}

function productSortValue(product: ProductRow, key: ProductSortKey): string | number {
    switch (key) {
        case 'status':
            return normalizeProductStatus(product)
        case 'stock':
            return Number(product.stock || 0)
        case 'product_type':
            return productDescriptor(product)
        case 'vendor':
            return product.vendor || ''
        case 'created_at':
            return new Date(product.created_at || '').getTime() || 0
        case 'name':
        default:
            return product.name || ''
    }
}

function compareProductRows(a: ProductRow, b: ProductRow, key: ProductSortKey, direction: SortDirection) {
    const aValue = productSortValue(a, key)
    const bValue = productSortValue(b, key)
    const result = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
    return direction === 'asc' ? result : -result
}

function stopTableAction(event: SyntheticEvent) {
    event.stopPropagation()
}

export default function ProductsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()

    const [products, setProducts] = useState<ProductRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<TabFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortKey, setSortKey] = useState<ProductSortKey>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
    const [bulkActionKey, setBulkActionKey] = useState<ProductStatus | null>(null)

    const loadProducts = useCallback(async () => {
        setLoading(true)
        setError(null)
        const query = new URLSearchParams({
            status: activeTab,
            limit: '100',
            sort: 'created_at',
            order: 'desc',
        })

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products?${query.toString()}`)
            if (!response.ok) {
                throw new Error('Unable to load products')
            }
            const payload = await response.json() as ProductsPayload
            setProducts(Array.isArray(payload.data) ? payload.data : [])
        } catch {
            setProducts([])
            setError('Products could not be loaded. Try again when the catalog service is reachable.')
        } finally {
            setLoading(false)
        }
    }, [store, activeTab])

    useEffect(() => {
        loadProducts()
    }, [loadProducts])

    const patchProductStatus = useCallback(async (productId: string, status: ProductStatus) => {
        const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/${encodeURIComponent(productId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                is_active: status === 'active',
            }),
        })
        if (!response.ok) throw new Error('Unable to update product status')
    }, [store])

    const updateProductStatus = useCallback(async (product: ProductRow, status: ProductStatus) => {
        if (normalizeProductStatus(product) === status) return
        setUpdatingStatusId(product.id)
        setError(null)
        try {
            await patchProductStatus(product.id, status)
            await loadProducts()
            notify({
                title: 'Product status updated',
                description: `${product.name} is now ${status}.`,
                variant: 'success',
            })
        } catch {
            notify({
                title: 'Product update failed',
                description: `Unable to set ${product.name} to ${status}.`,
                variant: 'critical',
            })
        } finally {
            setUpdatingStatusId(null)
        }
    }, [loadProducts, notify, patchProductStatus])

    const updateSelectedProducts = useCallback(async (rows: ProductRow[], status: ProductStatus) => {
        if (rows.length === 0) return
        setBulkActionKey(status)
        setError(null)
        let failures = 0

        for (const product of rows) {
            try {
                await patchProductStatus(product.id, status)
            } catch {
                failures += 1
            }
        }

        await loadProducts()
        setBulkActionKey(null)

        if (failures > 0) {
            notify({
                title: 'Some products were not updated',
                description: `${rows.length - failures} of ${rows.length} products were set to ${status}.`,
                variant: 'warning',
            })
            return
        }

        notify({
            title: 'Products updated',
            description: `${rows.length} ${rows.length === 1 ? 'product' : 'products'} set to ${status}.`,
            variant: 'success',
        })
    }, [loadProducts, notify, patchProductStatus])

    const filteredProducts = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase()
        if (!normalizedQuery) return products
        return products.filter((product) => {
            const haystack = [
                product.name,
                product.vendor,
                product.product_type,
                product.category,
                product.status,
            ].filter(Boolean).join(' ').toLowerCase()
            return haystack.includes(normalizedQuery)
        })
    }, [products, searchQuery])

    const sortedProducts = useMemo(() => {
        return [...filteredProducts].sort((a, b) => compareProductRows(a, b, sortKey, sortDirection))
    }, [filteredProducts, sortDirection, sortKey])

    const activeFilters = [
        activeTab !== 'all' ? { label: `View: ${activeTab.charAt(0).toUpperCase()}${activeTab.slice(1)}`, onRemove: () => setActiveTab('all') } : null,
        searchQuery.trim() ? { label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery('') } : null,
    ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>

    const handleSort = useCallback((key: string) => {
        const nextKey = key as ProductSortKey
        if (nextKey === sortKey) {
            setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
            return
        }
        setSortKey(nextKey)
        setSortDirection(nextKey === 'created_at' ? 'desc' : 'asc')
    }, [sortKey])

    const bulkActions = useMemo<Array<TableBulkAction<ProductRow>>>(() => [
        {
            label: bulkActionKey === 'active' ? 'Publishing...' : 'Publish selected',
            onAction: rows => { void updateSelectedProducts(rows, 'active') },
        },
        {
            label: bulkActionKey === 'draft' ? 'Drafting...' : 'Set as draft',
            onAction: rows => { void updateSelectedProducts(rows, 'draft') },
        },
    ], [bulkActionKey, updateSelectedProducts])

    const columns = useMemo<Array<TableColumn<ProductRow>>>(() => [
        {
            key: 'name',
            header: 'Product',
            sortable: true,
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
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (product) => (
                <div className="flex flex-col gap-[var(--lb-space-2)]" onClick={stopTableAction}>
                    {statusBadge(product)}
                    <Select
                        aria-label={`Change status for ${product.name}`}
                        className="min-w-[8rem]"
                        disabled={updatingStatusId === product.id}
                        options={productStatusOptions}
                        value={normalizeProductStatus(product)}
                        onChange={(event) => {
                            event.stopPropagation()
                            void updateProductStatus(product, event.target.value as ProductStatus)
                        }}
                    />
                </div>
            ),
        },
        {
            key: 'stock',
            header: 'Inventory',
            sortable: true,
            render: (product) => `${product.stock ?? 0} in stock`,
        },
        {
            key: 'product_type',
            header: 'Type',
            sortable: true,
            render: productDescriptor,
        },
        {
            key: 'vendor',
            header: 'Vendor',
            sortable: true,
            render: (product) => product.vendor || 'No vendor',
        },
    ], [store, updateProductStatus, updatingStatusId])

    const emptyTitle = searchQuery.trim() ? 'No matching products' : 'Add your first product'
    const emptyBody = searchQuery.trim()
        ? 'Clear the search or adjust the current view to find products in this catalog.'
        : 'Start your catalog with products, variants, inventory, and storefront-ready details.'

    return (
        <Page>
            <PageHeader
                eyebrow="Catalog"
                title="Products"
                description="Manage products, inventory, publishing status, vendors, and storefront visibility."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Products' }]}
                primaryAction={{ label: 'Add product', href: `/${store}/products/new`, icon: <MaterialIcon name="add" /> }}
                secondaryActions={[{ label: 'Collections', href: `/${store}/products/collections` }]}
            />

            {loading ? (
                <Card>
                    <Section title="Catalog" description="Loading products and inventory state.">
                        <Skeleton variant="table" lines={6} />
                    </Section>
                </Card>
            ) : (
                <Card>
                    <Section
                        title="Catalog"
                        description={`${sortedProducts.length} ${sortedProducts.length === 1 ? 'product' : 'products'} shown in this view.`}
                    >
                        <div className="flex flex-col gap-[var(--lb-space-4)]">
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                <Input
                                    label="Search products"
                                    placeholder="Search by name, vendor, type, or status"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    leftIcon={<Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                />
                                <Button variant="secondary" onClick={loadProducts}>
                                    <MaterialIcon name="sync" />
                                    Refresh
                                </Button>
                            </div>

                            {error && (
                                <Banner title="Products unavailable" variant="critical">
                                    {error}
                                </Banner>
                            )}

                            <Table
                                rows={sortedProducts}
                                columns={columns}
                                savedViews={productViews}
                                activeView={activeTab}
                                onViewChange={(value) => setActiveTab(value as TabFilter)}
                                filterChips={activeFilters}
                                bulkActions={bulkActions}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                                emptyState={(
                                    <EmptyState
                                        icon={<MaterialIcon name="products" />}
                                        title={emptyTitle}
                                        body={emptyBody}
                                        primaryAction={(
                                            <Button onClick={() => router.push(`/${store}/products/new`)}>
                                                <MaterialIcon name="add" />
                                                Add product
                                            </Button>
                                        )}
                                        secondaryAction={searchQuery.trim() ? (
                                            <Button variant="secondary" onClick={() => setSearchQuery('')}>
                                                Clear search
                                            </Button>
                                        ) : (
                                            <Button variant="secondary" onClick={() => router.push(`/${store}/apps`)}>
                                                Browse sourcing apps
                                            </Button>
                                        )}
                                    />
                                )}
                                onRowClick={(product) => router.push(`/${store}/products/${product.id}`)}
                            />
                        </div>
                    </Section>
                </Card>
            )}
        </Page>
    )
}
