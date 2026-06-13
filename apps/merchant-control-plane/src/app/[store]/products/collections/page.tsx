'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Collection as SharedCollection } from '@letbuyy/shared-types'
import { Button, Input, Table, Avatar, Badge, Banner, Card, Checkbox, EmptyState, Package, Page, PageHeader, Plus, RefreshCw, SaveBar, Section, Skeleton, Textarea, useToast } from '@letbuyy/ui'

type CollectionRow = Pick<SharedCollection, 'id' | 'title' | 'description' | 'image_url' | 'created_at'> & {
    is_active: boolean
    product_count?: number
}

interface CollectionFormState {
    title: string
    description: string
}

interface ProductRow {
    id: string
    name: string
    thumbnail_url?: string | null
    price?: number
    is_active?: boolean
}

interface ManageProductsState {
    collectionId: string
    collectionTitle: string
    open: boolean
    loading: boolean
    saving: boolean
    allProducts: ProductRow[]
    assignedIds: Set<string>
    searchQuery: string
}

const emptyForm: CollectionFormState = {
    title: '',
    description: '',
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

function formsEqual(a: CollectionFormState, b: CollectionFormState) {
    return a.title === b.title && a.description === b.description
}

function normalizeCollection(row: Record<string, unknown>): CollectionRow {
    return {
        id: String(row.id || ''),
        title: String(row.title || 'Untitled collection'),
        description: typeof row.description === 'string' ? row.description : null,
        image_url: typeof row.image_url === 'string' ? row.image_url : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : '',
        is_active: row.is_active !== false,
        product_count: typeof row.product_count === 'number' ? row.product_count : 0,
    }
}

const emptyManageState: ManageProductsState = {
    collectionId: '',
    collectionTitle: '',
    open: false,
    loading: false,
    saving: false,
    allProducts: [],
    assignedIds: new Set(),
    searchQuery: '',
}

function normalizeProduct(row: Record<string, unknown>): ProductRow {
    return {
        id: String(row.id || ''),
        name: String(row.name || 'Unnamed product'),
        thumbnail_url: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : null,
        price: typeof row.price === 'number' ? row.price : Number(row.price) || 0,
        is_active: row.is_active !== false,
    }
}

export default function CollectionsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [collections, setCollections] = useState<CollectionRow[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState<CollectionFormState>(emptyForm)
    const [creating, setCreating] = useState(false)
    const [manage, setManage] = useState<ManageProductsState>(emptyManageState)

    const loadCollections = useCallback(async () => {
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load collections'))
            }

            const nextCollections = Array.isArray(payload?.data)
                ? payload.data.map((row: Record<string, unknown>) => normalizeCollection(row)).filter((row: CollectionRow) => row.id)
                : []
            setCollections(nextCollections)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load collections'
            setCollections([])
            setLoadError(message)
            notify({
                title: 'Collections could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadCollections()
    }, [loadCollections])

    const hasUnsavedCreate = showCreate && !formsEqual(form, emptyForm)
    const saveState = creating ? 'saving' : hasUnsavedCreate ? 'unsaved' : 'saved'

    const resetCreateForm = useCallback(() => {
        setShowCreate(false)
        setForm(emptyForm)
    }, [])

    const updateForm = useCallback(<Key extends keyof CollectionFormState>(key: Key, value: CollectionFormState[Key]) => {
        setForm((current) => ({ ...current, [key]: value }))
    }, [])

    const handleCreate = useCallback(async () => {
        if (creating) return
        const title = form.title.trim()
        if (!title) {
            notify({
                title: 'Collection title is required',
                description: 'Add a title before creating the collection.',
                variant: 'warning',
            })
            return
        }

        setCreating(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description: form.description.trim() || null,
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to create collection'))
            }

            setShowCreate(false)
            setForm(emptyForm)
            notify({
                title: 'Collection created',
                description: `${title} is ready for product organization.`,
                variant: 'success',
            })
            await loadCollections()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to create collection'
            notify({
                title: 'Could not create collection',
                description: message,
                variant: 'critical',
            })
        } finally {
            setCreating(false)
        }
    }, [creating, form.description, form.title, loadCollections, notify, store])

    const openManageProducts = useCallback(async (collection: CollectionRow) => {
        setManage((prev) => ({
            ...prev,
            collectionId: collection.id,
            collectionTitle: collection.title,
            open: true,
            loading: true,
            allProducts: [],
            assignedIds: new Set(),
            searchQuery: '',
        }))

        try {
            const [productsRes, assignedRes] = await Promise.all([
                fetch(`/api/stores/${encodeURIComponent(store)}/products?limit=200`, { cache: 'no-store' }),
                fetch(`/api/stores/${encodeURIComponent(store)}/collections/${encodeURIComponent(collection.id)}/products`, { cache: 'no-store' }),
            ])

            const [productsPayload, assignedPayload] = await Promise.all([
                productsRes.json().catch(() => null),
                assignedRes.json().catch(() => null),
            ])

            const allProducts = Array.isArray(productsPayload?.data)
                ? productsPayload.data.map((row: Record<string, unknown>) => normalizeProduct(row)).filter((p: ProductRow) => p.id)
                : []

            const assignedIds = new Set<string>(
                Array.isArray(assignedPayload?.data?.product_ids)
                    ? (assignedPayload.data.product_ids as string[])
                    : [],
            )

            setManage((prev) => ({ ...prev, loading: false, allProducts, assignedIds }))
        } catch {
            setManage((prev) => ({ ...prev, loading: false }))
            notify({ title: 'Could not load products', description: 'Unable to load product list.', variant: 'critical' })
        }
    }, [notify, store])

    const toggleProductAssignment = useCallback((productId: string) => {
        setManage((prev) => {
            const next = new Set(prev.assignedIds)
            if (next.has(productId)) {
                next.delete(productId)
            } else {
                next.add(productId)
            }
            return { ...prev, assignedIds: next }
        })
    }, [])

    const saveManageProducts = useCallback(async () => {
        if (manage.saving) return
        setManage((prev) => ({ ...prev, saving: true }))
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/collections/${encodeURIComponent(manage.collectionId)}/products`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_ids: Array.from(manage.assignedIds) }),
                },
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to save products'))
            }
            setManage((prev) => ({ ...prev, saving: false, open: false }))
            notify({ title: 'Products updated', description: `${manage.collectionTitle} product list saved.`, variant: 'success' })
            await loadCollections()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save products'
            setManage((prev) => ({ ...prev, saving: false }))
            notify({ title: 'Could not save products', description: message, variant: 'critical' })
        }
    }, [loadCollections, manage.assignedIds, manage.collectionId, manage.collectionTitle, manage.saving, notify, store])

    const filteredManageProducts = useMemo(() => {
        const q = manage.searchQuery.trim().toLowerCase()
        if (!q) return manage.allProducts
        return manage.allProducts.filter((p) => p.name.toLowerCase().includes(q))
    }, [manage.allProducts, manage.searchQuery])

    const columns = useMemo(() => [
        {
            key: 'title',
            header: 'Collection',
            render: (row: CollectionRow) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <Avatar name={row.title} imageUrl={row.image_url || undefined} />
                    <div className="min-w-0">
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {row.title}
                        </p>
                        {row.description && (
                            <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                {row.description}
                            </p>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'product_count',
            header: 'Products',
            render: (row: CollectionRow) => `${row.product_count ?? 0} products`,
        },
        {
            key: 'is_active',
            header: 'Status',
            render: (row: CollectionRow) => (
                <Badge
                    label={row.is_active ? 'Active' : 'Inactive'}
                    variant={row.is_active ? 'success' : 'default'}
                />
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (row: CollectionRow) => (
                <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => void openManageProducts(row)}
                >
                    Manage products
                </Button>
            ),
        },
    ], [openManageProducts])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Collections"
                    description="Group products into merchandising sets for storefront browsing."
                    breadcrumbs={[{ label: 'Products' }, { label: 'Collections' }]}
                />
                <Card>
                    <Section title="Collection list">
                        <Skeleton variant="table" lines={6} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Collections"
                description="Group products into merchandising sets for storefront browsing."
                breadcrumbs={[{ label: 'Products' }, { label: 'Collections' }]}
                primaryAction={{
                    label: showCreate ? 'Create collection' : 'New collection',
                    onClick: showCreate ? () => void handleCreate() : () => setShowCreate(true),
                    disabled: creating || (showCreate && !form.title.trim()),
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadCollections(),
                        disabled: creating,
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Collections could not load"
                    action={<Button variant="secondary" onClick={() => void loadCollections()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            {showCreate && (
                <Card>
                    <Section
                        title="New collection"
                        description="Create a product grouping that can be featured in storefront navigation and sections."
                    >
                        <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-2">
                            <Input
                                label="Title"
                                value={form.title}
                                onChange={(event) => updateForm('title', event.target.value)}
                                placeholder="Summer sale"
                                disabled={creating}
                            />
                            <Textarea
                                label="Description"
                                value={form.description}
                                onChange={(event) => updateForm('description', event.target.value)}
                                placeholder="Describe what belongs in this collection."
                                rows={3}
                                disabled={creating}
                            />
                        </div>
                        <div className="mt-[var(--lb-space-4)] flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button
                                type="button"
                                onClick={() => void handleCreate()}
                                loading={creating}
                                disabled={creating || !form.title.trim()}
                            >
                                <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Create collection
                            </Button>
                            <Button type="button" variant="secondary" onClick={resetCreateForm} disabled={creating}>
                                Cancel
                            </Button>
                        </div>
                    </Section>
                </Card>
            )}

            <Card>
                <Section
                    title="Collection list"
                    description="Review product groupings and their active storefront status."
                    action={<Badge label={`${collections.length} total`} variant="info" />}
                >
                    {collections.length === 0 ? (
                        <EmptyState
                            icon={<Package className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                            title="No collections yet"
                            body="Organize products into collections so shoppers can browse by theme, season, category, or campaign."
                            primaryAction={!showCreate ? (
                                <Button type="button" onClick={() => setShowCreate(true)}>
                                    <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Create collection
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        <Table
                            rows={collections}
                            columns={columns}
                            emptyState={(
                                <EmptyState
                                    icon={<Package className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                                    title="No collections found"
                                    body="Create a collection to organize products for storefront browsing."
                                />
                            )}
                        />
                    )}
                </Section>
            </Card>

            <SaveBar
                state={saveState}
                onSave={() => void handleCreate()}
                onDiscard={resetCreateForm}
                saveLabel="Create collection"
            />

            {manage.open && (
                <Card>
                    <Section
                        title={`Manage products — ${manage.collectionTitle}`}
                        description="Select which products belong to this collection. Changes take effect after saving."
                        action={
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Button
                                    type="button"
                                    onClick={() => void saveManageProducts()}
                                    loading={manage.saving}
                                    disabled={manage.saving || manage.loading}
                                >
                                    Save products
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setManage((prev) => ({ ...prev, open: false }))}
                                    disabled={manage.saving}
                                >
                                    Cancel
                                </Button>
                            </div>
                        }
                    >
                        {manage.loading ? (
                            <Skeleton variant="table" lines={4} />
                        ) : (
                            <>
                                <div className="mb-[var(--lb-space-3)]">
                                    <Input
                                        label="Filter products"
                                        value={manage.searchQuery}
                                        onChange={(e) => setManage((prev) => ({ ...prev, searchQuery: e.target.value }))}
                                        placeholder="Search by name…"
                                    />
                                </div>
                                {filteredManageProducts.length === 0 ? (
                                    <EmptyState
                                        icon={<Package className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                                        title="No products found"
                                        body="Add products to this store to assign them to collections."
                                    />
                                ) : (
                                    <div className="divide-y divide-[var(--lb-color-border-subdued)]">
                                        {filteredManageProducts.map((product) => (
                                            <label
                                                key={product.id}
                                                className="flex min-h-11 cursor-pointer items-center gap-[var(--lb-space-3)] py-[var(--lb-space-2)]"
                                            >
                                                <Checkbox
                                                    label={product.name}
                                                    unstyled
                                                    checked={manage.assignedIds.has(product.id)}
                                                    onChange={() => toggleProductAssignment(product.id)}
                                                    disabled={manage.saving}
                                                />
                                                <Avatar name={product.name} imageUrl={product.thumbnail_url || undefined} size="sm" />
                                                <span className="flex-1 text-[var(--lb-font-size-body)] text-[var(--lb-color-text)]">
                                                    {product.name}
                                                </span>
                                                {product.price !== undefined && (
                                                    <span className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                                        ₹{product.price.toLocaleString('en-IN')}
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </Section>
                </Card>
            )}
        </Page>
    )
}
