'use client'
import { ManualCollectionMetadataPanel } from '@/components/products/ManualCollectionMetadataPanel'
import { discoverMemberships, retainMembership, markMembershipMissing, forgetMembershipRecovery, type PendingMembership } from '@/lib/products/collection-membership-journal'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { CollectionMembershipSnapshotSchema, CollectionMembershipProductSchema, ReplaceCollectionMembershipSchema, CollectionSummarySchema, CollectionListPageSchema, type CollectionSummary } from '@letbuyy/shared-types'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { Button, ConfirmDialog, Input, Table, Avatar, Badge, Banner, Card, Checkbox, Package, Page, PageHeader, Plus, RefreshCw, Section, Skeleton, useToast } from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'

type CollectionRow = CollectionSummary

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

const isDenial = (response: Response, payload: { error?: { code?: string } } | null) =>
        response.status === 401 || response.status === 403 || response.status === 409 && payload?.error?.code === 'SESSION_CONTEXT_CHANGED'

export default function CollectionsPage() {
    const { store } = useParams<{ store: string }>(), scope = useMerchantSecurityContext(store)
    if (!scope.siteId) return <Page><Banner variant="critical">Reload the selected store before opening collections.</Banner></Page>
    return <CollectionsWorkspace key={`${scope.actorId}:${scope.siteId}`} store={store} actorId={scope.actorId} siteId={scope.siteId} />
}
function CollectionsWorkspace({ store, actorId, siteId }: { store: string; actorId: string; siteId: string }) {
    const context = `${actorId}:${siteId}:${store}`, currentContext = useRef(context), generation = useRef(0), listGeneration = useRef(0), inFlight = useRef<string | null>(null)
    const active = useRef(true)
    currentContext.current = context
    const { notify } = useToast()
    const [collections, setCollections] = useState<CollectionRow[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [listContext, setListContext] = useState<string | null>(null)
    const listPage = useRef(1)
    const [listMeta, setListMeta] = useState({page:1,total:0,has_next:false,has_prev:false})
    const [metadataId, setMetadataId] = useState<string | null>(null)
    const [manage, setManage] = useState<ManageProductsState>(emptyManageState)
    const [denied, setDenied] = useState(false)
    const [recoveries, setRecoveries] = useState<PendingMembership[]>([])
    const [recoveryError, setRecoveryError] = useState<string | null>(null)
    const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
    const [recoveryBusy, setRecoveryBusy] = useState(false)
    const [discardMissing, setDiscardMissing] = useState<PendingMembership | null>(null)
    const refreshRecoveries = useCallback(() => {
        if (!active.current) return
        try { setRecoveries(discoverMemberships(window.sessionStorage, actorId, siteId, store)); setRecoveryError(null) }
        catch { setRecoveries([]); setRecoveryError('Saved collection recovery could not be read. The original request is retained. Retry recovery before starting another save.') }
    }, [actorId, siteId, store])
    const retireAccess = useCallback(() => {
        active.current = false; generation.current++; listGeneration.current++; inFlight.current = null
        setDenied(true); setCollections([]); setMetadataId(null); setManage(emptyManageState)
        setRecoveries([]); setDiscardMissing(null); setRecoveryBusy(false); setLoading(false)
    }, [])
    useEffect(() => {
        active.current = true; setDenied(false); refreshRecoveries(); generation.current++; inFlight.current = null; setManage(emptyManageState); listPage.current=1; setListMeta({page:1,total:0,has_next:false,has_prev:false})
        return () => { active.current = false; generation.current++; listGeneration.current++; inFlight.current = null }
    }, [context, refreshRecoveries])

    const loadCollections = useCallback(async (requestedPage = listPage.current) => {
        if (!active.current) return
        const captured = context, epoch = ++listGeneration.current
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections?page=${requestedPage}&limit=20`, {
                cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: { 'X-LetBuyy-Merchant-Context': actorId },
            })
            const payload = await response.json().catch(() => null)

            if (captured !== currentContext.current || epoch !== listGeneration.current || !active.current) return
            if (isDenial(response, payload)) { retireAccess(); return }
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
    }, [context, notify, store, actorId, retireAccess])

    useEffect(() => {
        void loadCollections()
    }, [loadCollections])

    const requestHeaders = useCallback(() => ({ 'X-LetBuyy-Merchant-Context': actorId }), [actorId])
    const openManageProducts = useCallback(async (collection: Pick<CollectionSummary, 'id' | 'title'>, reviewing?: PendingMembership) => {
        if (!active.current || inFlight.current) return
        const epoch = ++generation.current, captured = context
        let pending: PendingMembership | null = null, corruptRecovery = false
        try {
            const saved = discoverMemberships(window.sessionStorage, actorId, siteId, store).filter(row => row.collectionId === collection.id)
            if (saved.length > 1) throw new Error('More than one original selection needs recovery.')
            pending = saved[0] ?? null
        } catch { corruptRecovery = true }
        setManage({ ...emptyManageState, collectionId: collection.id, collectionTitle: collection.title,
            open: true, loading: true, pending, corruptRecovery, saveError: pending ? 'This save could not be confirmed. Retry the same save before changing this selection.' : null, assignedIds: new Set(pending?.command.product_ids || []) })
        try {
            const [productsRes, assignedRes] = await Promise.all([
                fetch(`/api/stores/${encodeURIComponent(store)}/products?limit=100&page=1&view=summary`, { cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: requestHeaders() }),
                fetch(`/api/stores/${encodeURIComponent(store)}/collections/${encodeURIComponent(collection.id)}/products`, { cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: requestHeaders() }),
            ])
            const [productsPayload, assignedPayload] = await Promise.all([productsRes.json().catch(() => null), assignedRes.json().catch(() => null)])
            if (epoch !== generation.current || captured !== currentContext.current || !active.current) return
            if (isDenial(productsRes, productsPayload) || isDenial(assignedRes, assignedPayload)) { retireAccess(); return }
            if (!productsRes.ok || !assignedRes.ok) throw new Error('Collection products are unavailable. Retry the read before changing this collection.')
            const loaded = CollectionMembershipSnapshotSchema.parse(assignedPayload?.data)
            if (loaded.collection_id !== collection.id || loaded.store_id !== siteId || pending && pending.storeId !== loaded.store_id) throw new Error('The collection context changed. Reload this store.')
            const choices = CollectionMembershipProductSchema.array().max(100).parse(productsPayload?.data)
            const meta = productsPayload?.meta
            if (!meta || meta.page !== 1 || typeof meta.has_next !== 'boolean' || !Number.isInteger(meta.per_page) || meta.per_page > 100 || meta.per_page < 1) throw new Error('Product pagination could not be confirmed.')
            const byId = new Map([...choices, ...loaded.products].map(product => [product.id, normalizeProduct(product)]))
            // Assigned IDs absent from this choice page remain selected. An
            // unavailable assignment is visible and can be removed explicitly.
            for (const id of loaded.unavailable_product_ids) byId.set(id, { id, name: 'Unavailable assigned product' })
            if (epoch !== generation.current || captured !== currentContext.current) return
            if (reviewing) {
                if (!pending || JSON.stringify(pending.command) !== JSON.stringify(reviewing.command)) throw new Error('The original selection changed. Reload before reviewing it.')
                forgetMembershipRecovery(window.sessionStorage, reviewing); refreshRecoveries(); pending = null
            }
            setManage(prev => ({ ...prev, loading: false, storeId: loaded.store_id, version: loaded.membership_version, pending,
                allProducts: [...byId.values()], assignedIds: new Set(pending?.command.product_ids || loaded.product_ids), hasNext: meta.has_next,
                saveError: pending ? 'This save could not be confirmed. Retry the same save before changing this selection.' : null }))
        } catch (error) {
            if (epoch !== generation.current || captured !== currentContext.current) return
            setManage(prev => ({ ...prev, loading: false, loadError: error instanceof Error ? error.message : 'Unable to load collection products.' }))
        }
    }, [actorId, context, requestHeaders, store, siteId, retireAccess, refreshRecoveries])

    const loadMoreProducts = useCallback(async () => {
        if (!active.current || manage.loadingMore || !manage.hasNext) return
        const epoch = generation.current, captured = context, page = manage.page + 1
        setManage(prev => ({ ...prev, loadingMore: true }))
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products?limit=100&page=${page}&view=summary`, { cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: requestHeaders() })
            const payload = await response.json().catch(() => null)
            if (epoch !== generation.current || captured !== currentContext.current || !active.current) return
            if (isDenial(response, payload)) { retireAccess(); return }
            if (!response.ok) throw new Error('Unable to load more products. Retry this page.')
            const choices = CollectionMembershipProductSchema.array().max(100).parse(payload?.data), meta = payload?.meta
            if (!meta || meta.page !== page || typeof meta.has_next !== 'boolean' || !Number.isInteger(meta.per_page) || meta.per_page > 100 || meta.per_page < 1) throw new Error('Product pagination could not be confirmed.')
            if (epoch !== generation.current || captured !== currentContext.current) return
            setManage(prev => ({ ...prev, page, hasNext: meta.has_next, loadingMore: false, pageError: null,
                allProducts: [...new Map([...prev.allProducts, ...choices.map(normalizeProduct)].map(product => [product.id, product])).values()] }))
        } catch (error) {
            if (epoch === generation.current && captured === currentContext.current) setManage(prev => ({ ...prev, loadingMore: false, pageError: error instanceof Error ? error.message : 'Unable to load more products.' }))
        }
    }, [context, manage.hasNext, manage.loadingMore, manage.page, requestHeaders, store, retireAccess])
    const cancelManage = useCallback(() => { generation.current++; setManage(emptyManageState); refreshRecoveries() }, [refreshRecoveries])
    const toggleProductAssignment = useCallback((productId: string) => {
        setManage(prev => {
            if (prev.loading || prev.saving || prev.pending || prev.conflict || prev.loadError || prev.corruptRecovery) return prev
            const next = new Set(prev.assignedIds)
            if (next.has(productId)) next.delete(productId); else next.add(productId)
            return { ...prev, assignedIds: next }
        })
    }, [])
    const saveManageProducts = useCallback(async (retry = false) => {
        if (!active.current || inFlight.current || manage.saving || manage.loading || manage.corruptRecovery || manage.conflict || !retry && (manage.pending || manage.loadError || recoveryError || !manage.version)) return
        const captured = context, epoch = generation.current
        let intent = retry ? manage.pending : null
        try {
            if (!intent) {
                if (retry) return
                const command = ReplaceCollectionMembershipSchema.parse({ product_ids: [...manage.assignedIds], expected_version: manage.version, idempotency_key: crypto.randomUUID() })
                intent = { actorId, store, storeId: manage.storeId, collectionId: manage.collectionId, command }
                retainMembership(window.sessionStorage, intent)
                refreshRecoveries()
            }
        } catch (error) {
            setManage(prev => ({ ...prev, saveError: error instanceof Error ? error.message : 'Save recovery storage is unavailable.' })); return
        }
        const sending = intent, flightToken = `${captured}:${manage.collectionId}:${epoch}`
        inFlight.current = flightToken
        setManage(prev => ({ ...prev, saving: true, pending: sending, saveError: null }))
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections/${encodeURIComponent(sending.collectionId)}/products`, {
                method: 'PUT', headers: { ...requestHeaders(), 'Content-Type': 'application/json', 'X-Idempotency-Key': sending.command.idempotency_key }, body: JSON.stringify(sending.command), signal: AbortSignal.timeout(20000),
            })
            const payload = await response.json().catch(() => null)
            if (epoch !== generation.current || captured !== currentContext.current) return
            if (isDenial(response, payload)) { retireAccess(); return }
            if (response.status === 409 && payload?.error?.code === 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT') {
                setManage(prev => ({ ...prev, saving: false, conflict: true, saveError: getErrorMessage(payload, 'Collection membership changed. Reload the current collection.') })); return
            }
            if (response.status === 404 && payload?.error?.code === 'COLLECTION_MEMBERSHIP_NOT_FOUND') {
                markMembershipMissing(window.sessionStorage, sending); refreshRecoveries()
            }
            if (!response.ok) throw new Error('This save could not be confirmed. Retry the same save before changing this selection.')
            const saved = CollectionMembershipSnapshotSchema.parse(payload?.data)
            if (saved.membership_version <= sending.command.expected_version || saved.collection_id !== sending.collectionId || saved.store_id !== sending.storeId || JSON.stringify(saved.product_ids) !== JSON.stringify(sending.command.product_ids)) throw new Error('This save could not be confirmed. Retry the same save.')
            forgetMembershipRecovery(window.sessionStorage, sending); refreshRecoveries()
            setManage(prev => ({ ...prev, saving: false, pending: null, open: false }))
            notify({ title: 'Products updated', description: `${manage.collectionTitle} product list saved.`, variant: 'success' })
            await loadCollections()
        } catch {
            if (epoch === generation.current && captured === currentContext.current) setManage(prev => ({ ...prev, saving: false, saveError: 'This save could not be confirmed. Retry the same save before changing this selection.' }))
        } finally {
            if (inFlight.current === flightToken) inFlight.current = null
        }
    }, [actorId, context, loadCollections, manage, notify, requestHeaders, store, refreshRecoveries, retireAccess, recoveryError])
    const reloadCurrentProducts = useCallback(() => {
        if (!active.current || !manage.conflict || !manage.pending || inFlight.current) return
        // Only a fresh, current-owner snapshot may release the rejected
        // version. A denial/outage retains the original request unchanged.
        void openManageProducts({ id: manage.collectionId, title: manage.collectionTitle }, manage.pending)
    }, [manage, openManageProducts])

    const retryRecovery = useCallback(async (pending: PendingMembership, allowMissingDiscard = false) => {
        if (!active.current || inFlight.current) return
        const captured = context, epoch = generation.current, token = `${context}:recovery:${crypto.randomUUID()}`
        inFlight.current = token; setRecoveryBusy(true); setRecoveryNotice(null)
        try {
            const current = discoverMemberships(window.sessionStorage, actorId, siteId, store).find(row =>
                row.store === pending.store && row.collectionId === pending.collectionId && JSON.stringify(row.command) === JSON.stringify(pending.command))
            if (!current) throw new Error('The original selection changed. Reload collections before retrying.')
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/collections/${encodeURIComponent(pending.collectionId)}/products`, {
                method: 'PUT', headers: { ...requestHeaders(), 'Content-Type': 'application/json', 'X-Idempotency-Key': pending.command.idempotency_key },
                body: JSON.stringify(pending.command), signal: AbortSignal.timeout(20000),
            })
            const payload = await response.json().catch(() => null)
            if (!active.current || captured !== currentContext.current || epoch !== generation.current) return
            if (isDenial(response, payload)) { retireAccess(); return }
            if (response.status === 404 && payload?.error?.code === 'COLLECTION_MEMBERSHIP_NOT_FOUND') {
                if (allowMissingDiscard) {
                    forgetMembershipRecovery(window.sessionStorage, pending)
                    setRecoveryNotice('Rejected product selection discarded. The collection remains deleted.')
                    setManage(emptyManageState)
                } else {
                    markMembershipMissing(window.sessionStorage, pending)
                    setRecoveryNotice('The collection was removed before this selection was saved. The original request is retained for explicit review.')
                }
                return
            }
            if (response.status === 409 && payload?.error?.code === 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT') {
                // The original is still retained until a current owner read and
                // explicit review in the editor; unrelated409s never release it.
                inFlight.current = null
                const opening = openManageProducts({ id: pending.collectionId, title: 'Saved product selection' }), editEpoch = generation.current
                await opening
                if (active.current && captured === currentContext.current && editEpoch === generation.current) setManage(prev => ({ ...prev, conflict: true, saveError: 'Collection membership changed. Reload the current collection to review your selection.' }))
                return
            }
            if (!response.ok) throw new Error('The original save could not be confirmed. Keep the saved selection and retry.')
            const saved = CollectionMembershipSnapshotSchema.parse(payload?.data)
            if (saved.collection_id !== pending.collectionId || saved.store_id !== siteId || saved.membership_version <= pending.command.expected_version || JSON.stringify(saved.product_ids) !== JSON.stringify(pending.command.product_ids)) throw new Error('The original collection receipt could not be confirmed.')
            forgetMembershipRecovery(window.sessionStorage, pending); setManage(emptyManageState)
            setRecoveryNotice('Original product selection confirmed.'); await loadCollections()
        } catch (error) {
            if (active.current && captured === currentContext.current && epoch === generation.current) setRecoveryNotice(error instanceof Error && error.name !== 'ZodError' ? error.message : 'The original collection receipt could not be confirmed.')
        } finally {
            if (inFlight.current === token) inFlight.current = null
            if (active.current && captured === currentContext.current) { setRecoveryBusy(false); refreshRecoveries() }
        }
    }, [actorId, context, siteId, store, requestHeaders, retireAccess, refreshRecoveries, openManageProducts, loadCollections])

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
                <div className="flex gap-[var(--lb-space-2)]">
                    <Button variant="secondary" size="sm" disabled={metadataId !== null || recoveryBusy} onClick={() => setMetadataId(row.id)}>Edit details</Button>
                    <Button variant="secondary" size="sm" disabled={metadataId !== null || recoveryBusy} onClick={() => void openManageProducts(row)}>Manage products</Button>
                </div>
            ),
        },
    ], [openManageProducts, metadataId, recoveryBusy])

    if (denied) return <Page><Banner variant="critical" title="Store access changed">Reload this store before viewing collections. Original save requests are retained.</Banner></Page>
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
                    label: 'New collection',
                    onClick: () => setMetadataId('create'),
                    disabled: metadataId !== null || recoveryBusy,
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    { label: 'Smart collections', href: `/${store}/products/smart-collections` },
                    {
                        label: 'Refresh',
                        onClick: () => void loadCollections(),
                        disabled: metadataId !== null,
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

            {recoveryError && <Banner variant="critical" action={<Button onClick={refreshRecoveries}>Retry saved recovery read</Button>}>{recoveryError}</Banner>}
            {recoveryNotice && <Banner variant="info">{recoveryNotice}</Banner>}
            {recoveries.map(pending => <Banner key={pending.store + ':' + pending.collectionId} variant="warning" title="Saved product selection needs confirmation">
                <p>The original selection and save key are retained. Retry uses your current store access.</p>
                <Button disabled={recoveryBusy || manage.open} onClick={() => void retryRecovery(pending)}>Retry saved product selection</Button>
                {pending.outcome === 'missing' && <Button disabled={recoveryBusy || manage.open} onClick={() => setDiscardMissing(pending)}>Discard rejected product selection</Button>}
            </Banner>)}
            <ConfirmDialog open={discardMissing !== null} title="Discard rejected product selection?" description="We will check the original request again with your current store access before discarding it. Products remain in your catalog."
                confirmLabel="Discard selection" onClose={() => setDiscardMissing(null)} onConfirm={() => { const pending = discardMissing; setDiscardMissing(null); if (pending) void retryRecovery(pending, true) }} />

            <ManualCollectionMetadataPanel store={store} actorId={actorId} siteId={siteId} selected={metadataId}
                onClose={() => setMetadataId(null)} onSaved={() => void loadCollections()} />

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
                            primaryAction={metadataId === null && listMeta.total === 0 ? (
                                <Button type="button" onClick={() => setMetadataId('create')}>
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
                                    disabled={manage.saving || manage.loading || !!manage.loadError || !!manage.pending || manage.conflict || manage.corruptRecovery || !!recoveryError || !manage.version}
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
                            action={<Button variant="secondary" onClick={() => { refreshRecoveries(); void openManageProducts({ id: manage.collectionId, title: manage.collectionTitle }) }}>Retry saved recovery read</Button>}>The saved request could not be read. Its original details are retained; a new save is unavailable.</Banner>}
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
