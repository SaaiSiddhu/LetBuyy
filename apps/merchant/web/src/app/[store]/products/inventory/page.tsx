'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { Button, Input, Table, Avatar, Badge, Banner, Card, EmptyState, Page, PageHeader, Pencil, RefreshCw, SaveBar, Search, Section, Skeleton, useToast } from '@letbuyy/ui'
import { formatDisplayDate } from '@letbuyy/ui/formatting'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import type { InventoryLevel } from '@letbuyy/shared-types'

type InventoryItem = InventoryLevel

type InventoryIntent = {
    actorId: string; store: string; levelId: string; productId: string; variantId: string | null; locationId: string
    name: string; from: number; target: number; delta: number; key: string; payload: string
    phase: 'uncertain' | 'refused' | 'review' | 'confirmed'; message?: string
}
const inventoryUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
function restoreInventoryIntent(raw: string, actorId: string, store: string): InventoryIntent {
    const intent = JSON.parse(raw) as InventoryIntent
    if (!intent || intent.actorId !== actorId || intent.store !== store || !inventoryUuid(intent.levelId) || !inventoryUuid(intent.productId)
        || !inventoryUuid(intent.locationId) || (intent.variantId !== null && !inventoryUuid(intent.variantId))
        || typeof intent.name !== 'string' || !Number.isSafeInteger(intent.from) || !Number.isSafeInteger(intent.target) || intent.target < 0
        || !Number.isSafeInteger(intent.delta) || intent.delta === 0 || Math.abs(intent.delta) > 99999 || intent.target - intent.from !== intent.delta
        || typeof intent.key !== 'string' || intent.key.trim() !== intent.key || intent.key.length < 8 || intent.key.length > 200
        || typeof intent.payload !== 'string' || !['uncertain', 'refused', 'review', 'confirmed'].includes(intent.phase)
        || (intent.message !== undefined && typeof intent.message !== 'string')) throw new Error('Unreadable saved adjustment')
    const body = JSON.parse(intent.payload)
    if (!body || Object.keys(body).sort().join(',') !== 'adjustment,location_id,notes,product_id,reason,variant_id'
        || body.product_id !== intent.productId || body.variant_id !== intent.variantId || body.location_id !== intent.locationId
        || body.adjustment !== intent.delta || body.reason !== 'correction' || body.notes !== 'Adjusted from admin inventory screen') throw new Error('Changed saved adjustment')
    return intent
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

function normalizeInventoryItem(row: Record<string, unknown>): InventoryItem {
    return {
        id: String(row.id || ''),
        product_id: String(row.product_id || ''),
        product_name: String(row.product_name || 'Untitled product'),
        variant_id: typeof row.variant_id === 'string' ? row.variant_id : null,
        variant_title: typeof row.variant_title === 'string' ? row.variant_title : null,
        location_id: typeof row.location_id === 'string' ? row.location_id : null,
        location_name: typeof row.location_name === 'string' ? row.location_name : 'Default location',
        sku: typeof row.sku === 'string' ? row.sku : null,
        images: Array.isArray(row.images) ? row.images.filter((image): image is string => typeof image === 'string') : [],
        available: typeof row.available === 'number' ? row.available : typeof row.available === 'string' && /^-?[0-9]+$/.test(row.available) ? Number(row.available) : Number.NaN,
        reserved: Number(row.reserved || 0),
        incoming: Number(row.incoming || 0),
        on_hand: Number(row.on_hand || 0),
        sellable: Number(row.sellable || row.available || 0),
        track_inventory: row.track_inventory !== false,
        updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    }
}

export default function InventoryPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    const { actorId } = useMerchantSecurityContext(store)
    const storageKey = `letbuyy.inventory-adjustment.v1:${actorId}:${store}`
    const scope = useRef({ key: storageKey })
    if (scope.current.key !== storageKey) scope.current = { key: storageKey }
    const mounted = useRef(true), readSequence = useRef(0), busy = useRef(false)
    const pendingRef = useRef<InventoryIntent | null>(null)
    const [pending, setPending] = useState<InventoryIntent | null>(null)
    const [readyScope, setReadyScope] = useState<string | null>(null)
    const [storageError, setStorageError] = useState<string | null>(null)
    const [accessChanged, setAccessChanged] = useState(false)
    const [products, setProducts] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [pageScope, setPageScope] = useState({ key: storageKey, page: 1 })
    const page = pageScope.key === storageKey ? pageScope.page : 1
    const [pageMeta, setPageMeta] = useState<{ total: number | null; hasNext: boolean }>({ total: null, hasNext: false })
    const beginInventory = useReadRequest(`${storageKey}:${page}`)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [quantity, setQuantity] = useState('')
    const [savingId, setSavingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const currentScope = useCallback((captured: { key: string }) => mounted.current && captured === scope.current, [])
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; readSequence.current++ } }, [])
    useEffect(() => {
        setReadyScope(null); setStorageError(null); setAccessChanged(false); setProducts([]); setEditingId(null); setQuantity(''); setSavingId(null); busy.current = false
        let restored: InventoryIntent | null = null
        try {
            const raw = window.sessionStorage.getItem(storageKey)
            if (raw) restored = restoreInventoryIntent(raw, actorId, store)
            if (restored?.phase === 'confirmed') { window.sessionStorage.removeItem(storageKey); restored = null }
        } catch { setStorageError('The saved stock adjustment could not be verified. Keep this tab open and recover the original request before starting another adjustment.') }
        pendingRef.current = restored; setPending(restored); setReadyScope(storageKey)
    }, [actorId, store, storageKey])

    const loadInventory = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginInventory()
        const captured = scope.current, sequence = ++readSequence.current
        if (!options?.quiet) setLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory/levels?limit=100&page=${page}`, {
                cache: 'no-store', signal: request.signal, headers: { 'X-LetBuyy-Merchant-Context': actorId },
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getErrorMessage(payload, 'Unable to load inventory'))
            const rows = Array.isArray(payload?.data) ? payload.data.map((row: Record<string, unknown>) => normalizeInventoryItem(row)) as InventoryItem[] : []
            if (!request.isCurrent() || !currentScope(captured) || sequence !== readSequence.current) return
            setPageMeta({ total: Number.isSafeInteger(payload?.meta?.total) ? payload.meta.total : null, hasNext: payload?.meta?.has_next === true })
            setProducts(rows.filter(row => row.id && Number.isSafeInteger(row.available)))
            if (rows.some(row => !Number.isSafeInteger(row.available))) setError('Some stock quantities could not be verified. Refresh before adjusting those records.')
        } catch (inventoryError) {
            if (!request.isCurrent() || !currentScope(captured) || sequence !== readSequence.current) return
            setProducts([]); setError(inventoryError instanceof Error ? inventoryError.message : 'Unable to load inventory')
        } finally { if (request.isCurrent() && currentScope(captured) && sequence === readSequence.current) setLoading(false) }
    }, [actorId, beginInventory, currentScope, page, store])
    useEffect(() => { void loadInventory(); return () => { readSequence.current++ } }, [loadInventory])

    const filtered = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        return query ? products.filter(product => product.product_name.toLowerCase().includes(query) || product.location_name.toLowerCase().includes(query) || product.sku?.toLowerCase().includes(query)) : products
    }, [products, searchQuery])
    const editingItem = products.find(product => product.id === editingId) || null
    const parsedQuantity = Number(quantity)
    const hasValidQuantity = Number.isSafeInteger(parsedQuantity) && parsedQuantity >= 0
    const hasUnsavedQuantity = !!editingItem && quantity.trim() !== '' && parsedQuantity !== editingItem.available
    const saveState = savingId ? 'saving' : hasUnsavedQuantity ? 'unsaved' : 'saved'
    const actionsBlocked = readyScope !== storageKey || !!storageError || accessChanged || !!pending || !!savingId
    const startEdit = useCallback((item: InventoryItem) => {
        if (busy.current || pendingRef.current || readyScope !== storageKey || storageError || accessChanged) return
        setEditingId(item.id); setQuantity(String(item.available)); setError(null)
    }, [readyScope, storageKey, storageError, accessChanged])
    const cancelEdit = useCallback(() => { setEditingId(null); setQuantity(''); setError(null) }, [])
    const retainIntent = useCallback((intent: InventoryIntent, captured: { key: string }) => {
        if (!currentScope(captured)) return false
        pendingRef.current = intent; setPending(intent)
        try { window.sessionStorage.setItem(captured.key, JSON.stringify(intent)); return true }
        catch { setStorageError('This tab could not retain the pending stock request. Keep it open and recover the saved adjustment before continuing.'); return false }
    }, [currentScope])
    const sendIntent = useCallback(async (intent: InventoryIntent) => {
        if (busy.current || readyScope !== storageKey || storageError || accessChanged || intent.phase === 'confirmed') return
        const captured = scope.current
        busy.current = true; setSavingId(intent.levelId); setError(null)
        try {
            if (!retainIntent({ ...intent, phase: 'uncertain', message: undefined }, captured)) return
            const response = await fetch(`/api/stores/${encodeURIComponent(intent.store)}/inventory/adjust`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': intent.key, 'X-LetBuyy-Merchant-Context': intent.actorId }, body: intent.payload,
            })
            const payload = await response.json().catch(() => null)
            if (!currentScope(captured)) return
            const code = payload?.error?.code
            if (!response.ok) {
                const message = getErrorMessage(payload, 'The adjustment outcome could not be confirmed. Retry the saved request.')
                const definiteRefusal = response.status === 400 && ['INVENTORY_ADJUSTMENT_FAILED', 'VALIDATION_ERROR', 'INVALID_INPUT'].includes(code)
                const phase = definiteRefusal ? 'refused' : ['INVENTORY_ADJUST_KEY_CONFLICT', 'INVENTORY_ADJUST_LEGACY_KEY'].includes(code) ? 'review' : 'uncertain'
                retainIntent({ ...intent, phase, message }, captured)
                if ([401, 403, 404].includes(response.status) || code === 'SESSION_CONTEXT_CHANGED') setAccessChanged(true)
                return
            }
            const level = payload?.data
            if (!level || level.id !== intent.levelId || level.product_id !== intent.productId || (level.variant_id ?? null) !== intent.variantId
                || level.location_id !== intent.locationId || !Number.isSafeInteger(level.available)) {
                retainIntent({ ...intent, phase: 'uncertain', message: 'The reply did not confirm this stock command. Retry the saved request.' }, captured); return
            }
            readSequence.current++
            try { window.sessionStorage.removeItem(captured.key) }
            catch { pendingRef.current = { ...intent, phase: 'confirmed' }; setPending(pendingRef.current); setStorageError('The adjustment is confirmed, but this tab could not clear its saved request. Reload when tab storage is available.'); return }
            pendingRef.current = null; setPending(null); cancelEdit()
            notify({ title: 'Adjustment confirmed', description: `${intent.name}: stock change ${intent.delta > 0 ? '+' : ''}${intent.delta} confirmed.`, variant: 'success' })
            await loadInventory({ quiet: true })
        } catch {
            if (currentScope(captured)) retainIntent({ ...intent, phase: 'uncertain', message: 'The reply was lost. Retry the same pending adjustment.' }, captured)
        } finally { if (currentScope(captured)) { busy.current = false; setSavingId(null) } }
    }, [readyScope, storageKey, storageError, accessChanged, currentScope, retainIntent, cancelEdit, notify, loadInventory])
    const saveStock = useCallback(async (item?: InventoryItem | null) => {
        if (busy.current || pendingRef.current || readyScope !== storageKey || storageError || accessChanged) return
        const row = item || editingItem, target = Number(quantity)
        if (!row || !Number.isSafeInteger(target) || target < 0 || quantity.trim() === '') { setError('Stock must be a non-negative whole number.'); return }
        if (!inventoryUuid(row.id) || !inventoryUuid(row.product_id) || !inventoryUuid(row.location_id) || (row.variant_id !== null && row.variant_id !== undefined && !inventoryUuid(row.variant_id)) || !Number.isSafeInteger(row.available)) {
            setError('Refresh a verified stock level and location before adjusting inventory.'); return
        }
        const delta = target - row.available
        if (delta === 0) { cancelEdit(); return }
        if (Math.abs(delta) > 99999) { setError('The stock change must be between -99999 and 99999 units.'); return }
        const intent: InventoryIntent = { actorId, store, levelId: row.id, productId: row.product_id, variantId: row.variant_id || null,
            locationId: row.location_id, name: row.product_name, from: row.available, target, delta,
            key: `inventory-adjust-${crypto.randomUUID()}`, phase: 'uncertain',
            payload: JSON.stringify({ product_id: row.product_id, variant_id: row.variant_id || null, location_id: row.location_id,
                adjustment: delta, reason: 'correction', notes: 'Adjusted from admin inventory screen' }) }
        await sendIntent(intent)
    }, [editingItem, quantity, readyScope, storageKey, storageError, accessChanged, actorId, store, cancelEdit, sendIntent])

    const columns = useMemo(() => [
        {
            key: 'product',
            header: 'Product',
            render: (row: InventoryItem) => (
                <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                    <Avatar name={row.product_name} imageUrl={row.images[0]} />
                    <div className="min-w-0">
                        <p className="m-0 truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                            {row.product_name}
                        </p>
                        <p className="m-0 truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            {row.variant_title ? `${row.variant_title} - ` : ''}{row.location_name}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            key: 'sku',
            header: 'SKU',
            render: (row: InventoryItem) => (
                <span className={row.sku ? 'text-[var(--lb-color-text)]' : 'text-[var(--lb-color-text-subdued)]'}>
                    {row.sku || 'No SKU'}
                </span>
            ),
        },
        {
            key: 'available',
            header: 'Available',
            render: (row: InventoryItem) => editingId === row.id ? (
                <Input
                    aria-label="Available quantity"
                    type="number"
                    min={0}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    disabled={savingId === row.id || !!pending}
                    aria-invalid={!hasValidQuantity}
                    className="min-w-[112px]"
                />
            ) : (
                <span className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{row.available}</span>
            ),
        },
        {
            key: 'reserved',
            header: 'Reserved',
            render: (row: InventoryItem) => row.reserved,
        },
        {
            key: 'on_hand',
            header: 'On hand',
            render: (row: InventoryItem) => row.on_hand,
        },
        {
            key: 'status',
            header: 'Status',
            render: (row: InventoryItem) => (
                <Badge
                    label={row.available <= 0 ? 'Out of stock' : row.available <= 10 ? 'Low stock' : 'In stock'}
                    variant={row.available <= 0 ? 'critical' : row.available <= 10 ? 'warning' : 'success'}
                    className="whitespace-nowrap"
                />
            ),
        },
        {
            key: 'updated_at',
            header: 'Updated',
            render: (row: InventoryItem) => formatDisplayDate(row.updated_at, { emptyValue: 'Not synced', options: {} }),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (row: InventoryItem) => editingId === row.id ? (
                <div className="flex min-w-[136px] flex-wrap gap-[var(--lb-space-2)]">
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveStock(row)}
                        disabled={!!pending || !!storageError || accessChanged || savingId === row.id || !hasValidQuantity || !hasUnsavedQuantity}
                        loading={savingId === row.id}
                    >
                        Save
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={cancelEdit} disabled={savingId === row.id}>
                        Cancel
                    </Button>
                </div>
            ) : (
                <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)} disabled={actionsBlocked}>
                    <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    Adjust
                </Button>
            ),
        },
    ], [cancelEdit, editingId, hasUnsavedQuantity, hasValidQuantity, quantity, saveStock, savingId, startEdit, pending, storageError, accessChanged, actionsBlocked])

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Inventory"
                description="Review stock availability and adjust tracked inventory quantities."
                breadcrumbs={[{ label: 'Inventory' }]}
                primaryAction={{
                    label: 'Refresh',
                    onClick: () => void loadInventory(),
                    disabled: loading || Boolean(savingId),
                    icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
            />

            {accessChanged && <Banner title="Account or store access changed" variant="critical">Reload with the intended account before recovering the saved adjustment.</Banner>}
            {storageError && <Banner title="Saved adjustment needs recovery" variant="critical">{storageError}</Banner>}
            {pending && <Banner title={pending.phase === 'confirmed' ? 'Adjustment confirmed' : 'Saved stock adjustment'} variant={pending.phase === 'uncertain' ? 'warning' : 'critical'}>
                <p>{pending.name}: change {pending.delta > 0 ? '+' : ''}{pending.delta} from the recorded {pending.from} available.</p>
                <p>Other stock changes may also apply. The original adjustment will be recovered with the same request.</p>
                {pending.message && <p>{pending.message}</p>}
                {pending.phase === 'uncertain' && <Button disabled={!!savingId || !!storageError || accessChanged} onClick={() => void sendIntent(pendingRef.current!)}>Retry pending adjustment</Button>}
                {pending.phase === 'refused' && <Button disabled={!!savingId || !!storageError} onClick={() => {
                    if (busy.current || pendingRef.current?.phase !== 'refused') return
                    try { window.sessionStorage.removeItem(storageKey) } catch { setStorageError('The refused request could not be cleared from this tab.'); return }
                    pendingRef.current = null; setPending(null); cancelEdit(); void loadInventory({ quiet: true })
                }}>Discard refused adjustment</Button>}
            </Banner>}

            {error && (
                <Banner
                    variant="critical"
                    title="Inventory needs attention"
                    action={<Button variant="secondary" onClick={() => void loadInventory()}>Retry</Button>}
                >
                    {error}
                </Banner>
            )}

            <Card>
                <Section
                    title="Stock levels"
                    description="Adjust available stock without changing product details."
                    action={<Badge label={`${pageMeta.total ?? products.length} tracked`} variant="info" />}
                >
                    {loading ? (
                        <Skeleton variant="table" lines={6} />
                    ) : products.length === 0 ? (
                        <EmptyState
                            illustration={
                                <Image
                                    src="/Emptystate Illustration/Inventory_Emptystate.png"
                                    alt=""
                                    width={200}
                                    height={200}
                                    aria-hidden="true"
                                />
                            }
                            title={error ? 'Unable to load inventory' : page > 1 ? 'No stock levels on this page' : 'No inventory to track'}
                            body={error || (page > 1 ? 'Return to the previous page or refresh to check current stock levels.' : 'Add products to your store to start tracking inventory levels.')}
                            primaryAction={error ? (
                                <Button type="button" onClick={() => void loadInventory()}>
                                    <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Retry
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        <div className="space-y-[var(--lb-space-4)]">
                            <Input
                                aria-label="Search inventory"
                                placeholder="Search this page by product, SKU, or location..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                leftIcon={<Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            />

                            <Table
                                rows={filtered}
                                columns={columns}
                                filterChips={searchQuery ? [{ label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery('') }] : []}
                                emptyState={(
                                    <EmptyState
                                        icon={<Search className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />}
                                        title="No inventory matches your search"
                                        body="Clear the search query to see all tracked inventory."
                                        secondaryAction={<Button type="button" variant="secondary" onClick={() => setSearchQuery('')}>Clear search</Button>}
                                    />
                                )}
                            />
                        </div>
                    )}
                    {(page > 1 || pageMeta.hasNext) && <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                        <Button variant="secondary" disabled={page <= 1 || loading || actionsBlocked || Boolean(editingId)} onClick={() => { setSearchQuery(''); setPageScope({ key: storageKey, page: page - 1 }) }}>Previous page</Button>
                        <span>Page {page}</span>
                        <Button variant="secondary" disabled={!pageMeta.hasNext || loading || actionsBlocked || Boolean(editingId)} onClick={() => { setSearchQuery(''); setPageScope({ key: storageKey, page: page + 1 }) }}>Next page</Button>
                    </div>}
                </Section>
            </Card>

            {!pending && !storageError && !accessChanged && <SaveBar
                state={saveState}
                onSave={() => void saveStock()}
                onDiscard={cancelEdit}
                saveLabel="Save adjustment"
            />}
        </Page>
    )
}
