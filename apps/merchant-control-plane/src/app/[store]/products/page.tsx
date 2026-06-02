'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { Product as SharedProduct } from '@letbuyy/shared-types'
import {
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
    Tabs,
    type IndexTableColumn,
} from '@letbuyy/ui'

type ProductRow = Pick<
    SharedProduct,
    'id' | 'name' | 'status' | 'stock' | 'price' | 'compare_price' | 'images' | 'category' | 'product_type' | 'vendor' | 'is_active' | 'created_at'
>

type TabFilter = 'all' | 'active' | 'draft' | 'archived'

interface ProductsPayload {
    data?: ProductRow[]
}

const productViews: Array<{ label: string; value: TabFilter; content: null }> = [
    { label: 'All', value: 'all', content: null },
    { label: 'Active', value: 'active', content: null },
    { label: 'Draft', value: 'draft', content: null },
    { label: 'Archived', value: 'archived', content: null },
]

function statusBadge(product: ProductRow) {
    const status = (product.status || (product.is_active ? 'active' : 'draft')).toLowerCase()
    const label = status.charAt(0).toUpperCase() + status.slice(1)
    const variant = status === 'active' ? 'success' : status === 'archived' ? 'critical' : 'warning'
    return <Badge label={label} variant={variant} />
}

function productDescriptor(product: ProductRow) {
    return product.product_type || product.category || 'Not categorized'
}

export default function ProductsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()

    const [products, setProducts] = useState<ProductRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<TabFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')

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

    const columns = useMemo<Array<IndexTableColumn<ProductRow>>>(() => [
        {
            key: 'name',
            header: 'Product',
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
            render: statusBadge,
        },
        {
            key: 'stock',
            header: 'Inventory',
            render: (product) => `${product.stock ?? 0} in stock`,
        },
        {
            key: 'product_type',
            header: 'Type',
            render: productDescriptor,
        },
        {
            key: 'vendor',
            header: 'Vendor',
            render: (product) => product.vendor || 'No vendor',
        },
    ], [store])

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
                        description={`${products.length} ${products.length === 1 ? 'product' : 'products'} in this view.`}
                    >
                        <div className="flex flex-col gap-[var(--lb-space-4)]">
                            <Tabs
                                items={productViews}
                                value={activeTab}
                                onValueChange={(value) => setActiveTab(value as TabFilter)}
                            />

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

                            <IndexTable
                                rows={filteredProducts}
                                columns={columns}
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
