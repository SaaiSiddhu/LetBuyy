'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { CollectionMembershipSnapshotSchema, CollectionMembershipProductSchema, ReplaceCollectionMembershipSchema, type ReplaceCollectionMembershipInput, CollectionSummarySchema, CollectionListPageSchema, type CollectionSummary } from '@letbuyy/shared-types'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { Button, Input, Table, Avatar, Badge, Banner, Card, Checkbox, Package, Page, PageHeader, Plus, RefreshCw, SaveBar, Section, Skeleton, Textarea, useToast } from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'

type CollectionRow = CollectionSummary

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

type PendingMembership = { actorId: string; store: string; storeId: string; collectionId: string; command: ReplaceCollectionMembershipInput }
interface ManageProductsState {
    collectionId: string
    collectionTitle: string
    open: boolean
    loading: boolean
    saving: boolean
    allProducts: ProductRow[]
    assignedIds: Set<string>
    searchQuery: string
    storeId: string
    version: number | null
    loadError: string | null
    saveError: string | null
    pending: PendingMembership | null
    conflict: boolean
    corruptRecovery: boolean
    page: number
    hasNext: boolean
    loadingMore: boolean
    pageError: string | null
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

function normalizeCollection(row: Record<string, unknown>): CollectionRow { return CollectionSummarySchema.parse(row) }

const emptyManageState: ManageProductsState = {
    collectionId: '',
    collectionTitle: '',
    open: false,
    loading: false,
    saving: false,
    allProducts: [],
    assignedIds: new Set(),
    searchQuery: '', storeId: '', version: null, loadError: null, saveError: null, pending: null, conflict: false, corruptRecovery: false, page: 1, hasNext: false, loadingMore: false, pageError: null,
}

function normalizeProduct(row: Record<string, unknown>): ProductRow {
    return {
        id: String(row.id || ''),
        name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Product name unavailable',
        thumbnail_url: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : null,
        price: typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : undefined,
        is_active: typeof row.is_active === 'boolean' ? row.is_active : undefined,
    }
}

function recoveryKey(actorId: string, store: string, collectionId: string) {
    return `letbuyy.collection-membership.v1:${actorId}:${store}:${collectionId}`
}
function restoreMembership(raw: string, actorId: string, store: string, collectionId: string): PendingMembership {
    const saved = JSON.parse(raw)
    if (!saved || saved.actorId !== actorId || saved.store !== store || saved.collectionId !== collectionId ||
        typeof saved.storeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(saved.storeId)) throw new Error('Saved collection context changed')
    return { actorId, store, collectionId, storeId: saved.storeId, command: ReplaceCollectionMembershipSchema.parse(saved.command) }
}


function forgetMembershipRecovery(pending: PendingMembership) {
    const key = recoveryKey(pending.actorId, pending.store, pending.collectionId), raw = window.sessionStorage.getItem(key)
    if (raw !== null) {
        const stored = restoreMembership(raw, pending.actorId, pending.store, pending.collectionId)
        if (stored.storeId !== pending.storeId || stored.command.idempotency_key !== pending.command.idempotency_key
            || stored.command.expected_version !== pending.command.expected_version
            || JSON.stringify(stored.command.product_ids) !== JSON.stringify(pending.command.product_ids)) {
            throw new Error('Another pending collection save is retained. Reload and review it before clearing this request.')
        }
    }
    window.sessionStorage.removeItem(key)
}

export default function CollectionsPage() {
    const { store } = useParams<{ store: string }>()
    const { actorId } = useMerchantSecurityContext(store)
    const context = `${actorId}:${store}`, currentContext = useRef(context), generation = useRef(0), listGeneration = useRef(0), inFlight = useRef<string | null>(null)
    currentContext.current = context
    const { notify } = useToast()
    const [collections, setCollections] = useState<CollectionRow[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [listContext, setListContext] = useState<string | null>(null)
    const listPage = useRef(1)
    const [listMeta, setListMeta] = useState({page:1,total:0,has_next:false,has_prev:false})
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState<CollectionFormState>(emptyForm)
    const [creating, setCreating] = useState(false)
    const [manage, setManage] = useState<ManageProductsState>(emptyManageState)
    useEffect(() => {
        generation.current++; inFlight.current = null; setManage(emptyManageState); listPage.current=1; setListMeta({page:1,total:0,has_next:false,has_prev:false})
        return () => { generation.current++; listGeneration.current++; inFlight.current = null }
    }, [context])

    const loadCollections = useCallback(async (requestedPage = listPage.current) => {
        const captured = context, epoch = ++listGeneration.current
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections?page=${requestedPage}&limit=20`, {
                cache: 'no-store', signal: AbortSignal.timeout(15_000),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load collections'))
            }

            if (captured !== currentContext.current || epoch !== listGeneration.current) return
            const confirmed = CollectionListPageSchema.parse(payload)
            if(confirmed.meta.page !== requestedPage || confirmed.meta.per_page !== 20) throw new Error('Collection page could not be confirmed.')
            listPage.current = confirmed.meta.page
            setListMeta(confirmed.meta)
            setCollections(confirmed.data.map(normalizeCollection))
            setListContext(captured)
        } catch (error) {
            if (captured !== currentContext.current || epoch !== listGeneration.current) return
            const message = error instanceof Error ? error.message : 'Unable to load collections'
            setCollections([])
            setListContext(captured)
            setLoadError(message)
            notify({
                title: 'Collections could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (captured === currentContext.current && epoch === listGeneration.current) setLoading(false)
        }
    }, [context, notify, store])

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

    const requestHeaders = useCallback(() => ({ 'X-LetBuyy-Merchant-Context': actorId }), [actorId])
    const openManageProducts = useCallback(async (collection: Pick<CollectionSummary, 'id' | 'title'>) => {
        const epoch = ++generation.current, captured = context
        let pending: PendingMembership | null = null, corruptRecovery = false
        try {
            const raw = window.sessionStorage.getItem(recoveryKey(actorId, store, collection.id))
            if (raw) pending = restoreMembership(raw, actorId, store, collection.id)
        } catch { corruptRecovery = true }
        setManage({ ...emptyManageState, collectionId: collection.id, collectionTitle: collection.title,
            open: true, loading: true, pending, corruptRecovery, saveError: pending ? 'This save could not be confirmed. Retry the same save before changing this selection.' : null, assignedIds: new Set(pending?.command.product_ids || []) })
        try {
            const [productsRes, assignedRes] = await Promise.all([
                fetch(`/api/stores/${encodeURIComponent(store)}/products?limit=100&page=1&view=summary`, { cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: requestHeaders() }),
                fetch(`/api/stores/${encodeURIComponent(store)}/collections/${encodeURIComponent(collection.id)}/products`, { cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: requestHeaders() }),
            ])
            const [productsPayload, assignedPayload] = await Promise.all([productsRes.json().catch(() => null), assignedRes.json().catch(() => null)])
            if (!productsRes.ok || !assignedRes.ok) throw new Error('Collection products are unavailable. Retry the read before changing this collection.')
            const loaded = CollectionMembershipSnapshotSchema.parse(assignedPayload?.data)
            if (loaded.collection_id !== collection.id || pending && pending.storeId !== loaded.store_id) throw new Error('The collection context changed. Reload this store.')
            const choices = CollectionMembershipProductSchema.array().max(100).parse(productsPayload?.data)
            const meta = productsPayload?.meta
            if (!meta || meta.page !== 1 || typeof meta.has_next !== 'boolean' || !Number.isInteger(meta.per_page) || meta.per_page > 100 || meta.per_page < 1) throw new Error('Product pagination could not be confirmed.')
            const byId = new Map([...choices, ...loaded.products].map(product => [product.id, normalizeProduct(product)]))
            // Assigned IDs absent from this choice page remain selected. An
            // unavailable assignment is visible and can be removed explicitly.
            for (const id of loaded.unavailable_product_ids) byId.set(id, { id, name: 'Unavailable assigned product' })
            if (epoch !== generation.current || captured !== currentContext.current) return
            setManage(prev => ({ ...prev, loading: false, storeId: loaded.store_id, version: loaded.membership_version,
                allProducts: [...byId.values()], assignedIds: new Set(pending?.command.product_ids || loaded.product_ids), hasNext: meta.has_next,
                saveError: pending ? 'This save could not be confirmed. Retry the same save before changing this selection.' : null }))
        } catch (error) {
            if (epoch !== generation.current || captured !== currentContext.current) return
            setManage(prev => ({ ...prev, loading: false, loadError: error instanceof Error ? error.message : 'Unable to load collection products.' }))
        }
    }, [actorId, context, requestHeaders, store])

    const loadMoreProducts = useCallback(async () => {
        if (manage.loadingMore || !manage.hasNext) return
        const epoch = generation.current, captured = context, page = manage.page + 1
        setManage(prev => ({ ...prev, loadingMore: true }))
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products?limit=100&page=${page}&view=summary`, { cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: requestHeaders() })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error('Unable to load more products. Retry this page.')
            const choices = CollectionMembershipProductSchema.array().max(100).parse(payload?.data), meta = payload?.meta
            if (!meta || meta.page !== page || typeof meta.has_next !== 'boolean' || !Number.isInteger(meta.per_page) || meta.per_page > 100 || meta.per_page < 1) throw new Error('Product pagination could not be confirmed.')
            if (epoch !== generation.current || captured !== currentContext.current) return
            setManage(prev => ({ ...prev, page, hasNext: meta.has_next, loadingMore: false, pageError: null,
                allProducts: [...new Map([...prev.allProducts, ...choices.map(normalizeProduct)].map(product => [product.id, product])).values()] }))
        } catch (error) {
            if (epoch === generation.current && captured === currentContext.current) setManage(prev => ({ ...prev, loadingMore: false, pageError: error instanceof Error ? error.message : 'Unable to load more products.' }))
        }
    }, [context, manage.hasNext, manage.loadingMore, manage.page, requestHeaders, store])
    const cancelManage = useCallback(() => { generation.current++; setManage(prev => ({ ...prev, open: false })) }, [])
    const toggleProductAssignment = useCallback((productId: string) => {
        setManage(prev => {
            if (prev.loading || prev.saving || prev.pending || prev.conflict || prev.loadError || prev.corruptRecovery) return prev
            const next = new Set(prev.assignedIds)
            if (next.has(productId)) next.delete(productId); else next.add(productId)
            return { ...prev, assignedIds: next }
        })
    }, [])
    const saveManageProducts = useCallback(async (retry = false) => {
        if (inFlight.current || manage.saving || manage.loading || manage.corruptRecovery || manage.conflict || !retry && (manage.pending || manage.loadError || !manage.version)) return
        const captured = context, epoch = generation.current, key = recoveryKey(actorId, store, manage.collectionId)
        let intent = retry ? manage.pending : null
        try {
            if (!intent) {
                if (retry) return
                const command = ReplaceCollectionMembershipSchema.parse({ product_ids: [...manage.assignedIds], expected_version: manage.version, idempotency_key: crypto.randomUUID() })
                intent = { actorId, store, storeId: manage.storeId, collectionId: manage.collectionId, command }
                window.sessionStorage.setItem(key, JSON.stringify(intent))
                // A failed readback of the durable client intent must not send
                // an action whose exact retry cannot survive this page.
                if (window.sessionStorage.getItem(key) !== JSON.stringify(intent)) throw new Error('Save recovery storage is unavailable. Keep this selection and retry.')
            }
        } catch (error) {
            setManage(prev => ({ ...prev, saveError: error instanceof Error ? error.message : 'Save recovery storage is unavailable.' })); return
        }
        const sending = intent, flightToken = `${captured}:${manage.collectionId}:${epoch}`
        inFlight.current = flightToken
        setManage(prev => ({ ...prev, saving: true, pending: sending, saveError: null }))
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections/${encodeURIComponent(sending.collectionId)}/products`, {
                method: 'PUT', headers: { ...requestHeaders(), 'Content-Type': 'application/json', 'X-Idempotency-Key': sending.command.idempotency_key }, body: JSON.stringify(sending.command),
            })
            const payload = await response.json().catch(() => null)
            if (epoch !== generation.current || captured !== currentContext.current) return
            if (response.status === 409) {
                setManage(prev => ({ ...prev, saving: false, conflict: true, saveError: getErrorMessage(payload, 'Collection membership changed. Reload the current collection.') })); return
            }
            if (!response.ok) throw new Error('This save could not be confirmed. Retry the same save before changing this selection.')
            const saved = CollectionMembershipSnapshotSchema.parse(payload?.data)
            if (saved.collection_id !== sending.collectionId || saved.store_id !== sending.storeId || JSON.stringify(saved.product_ids) !== JSON.stringify(sending.command.product_ids)) throw new Error('This save could not be confirmed. Retry the same save.')
            forgetMembershipRecovery(sending)
            setManage(prev => ({ ...prev, saving: false, pending: null, open: false }))
            notify({ title: 'Products updated', description: `${manage.collectionTitle} product list saved.`, variant: 'success' })
            await loadCollections()
        } catch {
            if (epoch === generation.current && captured === currentContext.current) setManage(prev => ({ ...prev, saving: false, saveError: 'This save could not be confirmed. Retry the same save before changing this selection.' }))
        } finally {
            if (inFlight.current === flightToken) inFlight.current = null
        }
    }, [actorId, context, loadCollections, manage, notify, requestHeaders, store])
    const reloadCurrentProducts = useCallback(() => {
        // Explicit actor action discards this failed/conflicting intent, then
        // loads the server version. A new key is never manufactured by a retry.
        try { if (manage.pending) forgetMembershipRecovery(manage.pending); else window.sessionStorage.removeItem(recoveryKey(actorId, store, manage.collectionId)) }
        catch { setManage(prev => ({ ...prev, corruptRecovery: true })); return }
        void openManageProducts({ id: manage.collectionId, title: manage.collectionTitle })
    }, [actorId, manage.collectionId, manage.collectionTitle, manage.pending, openManageProducts, store])

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
            render: (row: CollectionRow) => `${row.product_count} ${row.product_count === 1 ? 'product' : 'products'}`,
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

    if (loading || listContext !== context) {
        return (
            <Page>
                <PageHeader identity="products"
                    recipe="index"
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
            <PageHeader identity="products"
                recipe="index"
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
                    action={<Badge label={loadError ? 'Count unavailable' : `${listMeta.total} total`} variant="info" />}
                >
                    <nav className="mb-[var(--lb-space-3)] flex items-center gap-[var(--lb-space-2)]" aria-label="Collection pagination">
                        <Button variant="secondary" disabled={loading || Boolean(loadError) || !listMeta.has_prev} onClick={() => void loadCollections(listMeta.page-1)}>Previous collections</Button>
                        <span>Page {listMeta.page} · {listMeta.total} collections</span>
                        <Button variant="secondary" disabled={loading || Boolean(loadError) || !listMeta.has_next} onClick={() => void loadCollections(listMeta.page+1)}>Next collections</Button>
                    </nav>
                    {loadError ? <p role="status">Collection counts are unavailable. Retry the read before changing this collection.</p> : collections.length === 0 ? (
                        <EmptyState scene="collections"
                            title={listMeta.total === 0 ? "No collections yet" : "No collections on this page"}
                            body={listMeta.total === 0 ? "Organize products into collections so shoppers can browse by theme, season, category, or campaign." : "Use the previous-page control to return to your collections."}
                            primaryAction={!showCreate && listMeta.total === 0 ? (
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
                                <EmptyState scene="collections"
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
                                    disabled={manage.saving || manage.loading || !!manage.loadError || !!manage.pending || manage.conflict || manage.corruptRecovery || !manage.version}
                                >
                                    Save products
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={cancelManage}
                                    disabled={manage.saving}
                                >
                                    Cancel
                                </Button>
                            </div>
                        }
                    >
                        {manage.loadError && <Banner variant="critical" title="Could not load collection products"
                            action={<Button variant="secondary" onClick={() => void openManageProducts({ id: manage.collectionId, title: manage.collectionTitle })}>Retry products</Button>}>{manage.loadError}</Banner>}
                        {manage.corruptRecovery && <Banner variant="critical" title="Could not recover collection save"
                            action={<Button variant="secondary" onClick={reloadCurrentProducts}>Discard saved recovery</Button>}>The saved request could not be read. Check the current collection before starting another save.</Banner>}
                        {manage.saveError && <Banner variant="critical" title={manage.conflict ? 'Collection membership changed' : 'Collection save could not be confirmed'}
                            action={manage.conflict ? <Button variant="secondary" onClick={reloadCurrentProducts}>Reload current products</Button> : manage.pending ? <Button variant="secondary" onClick={() => void saveManageProducts(true)} disabled={manage.saving || manage.loading}>Retry same save</Button> : undefined}>{manage.saveError}</Banner>}
                        <p>{manage.assignedIds.size} products selected</p>
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
                                {manage.pageError && <Banner variant="critical" title="More products could not load">{manage.pageError}</Banner>}
                                {manage.hasNext && <Button variant="secondary" onClick={() => void loadMoreProducts()} disabled={manage.loadingMore}>Load more products</Button>}
                                {filteredManageProducts.length === 0 ? (
                                    <EmptyState scene="collections"
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
                                                    disabled={manage.saving || !!manage.pending || manage.conflict || !!manage.loadError || manage.corruptRecovery}
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
