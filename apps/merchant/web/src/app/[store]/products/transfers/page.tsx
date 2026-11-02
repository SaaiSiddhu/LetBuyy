'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {useMerchantSecurityContext} from '@/components/security/MerchantSecurityContext'
import {useWarehouseCommands,WarehouseRequestStoppedError,WarehouseCommandValidationError,type WarehouseSubmit} from '@/lib/inventory/use-warehouse-commands'
import {WarehouseCommandRecovery} from '@/components/products/WarehouseCommandRecovery'
import { useReadRequest } from '@/lib/api/use-read-request'
import {WarehouseDocumentPageMetaSchema,WarehouseTransferSchema} from '@letbuyy/shared-types'
import {useWarehouseDocument} from '@/lib/inventory/use-warehouse-document'
import { useProductPicker } from '@/lib/api/use-product-picker'
import { useInventoryLocations } from '@/lib/api/use-inventory-locations'
import type { WarehouseOptionControls } from '@/lib/api/use-warehouse-options'
import { WarehouseDocumentFilters } from '@/components/products/WarehouseDocumentFilters'
import { WarehouseOptionSearch } from '@/components/products/WarehouseOptionSearch'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'
import {
    Badge,
    Banner,
    Button,
    Card,
    Input,
    MaterialIcon,
    Modal,
    NumberField,
    Page,
    PageHeader,
    RefreshCw,
    Section,
    Select,
    Skeleton,
    Spinner,
    Table,
    Truck,
    useToast,
    type SelectOption,
    type StatusVariant,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import type {
    InventoryTransfer,
    InventoryLocation,
    InventoryTransferLineInput,
    ReceiveInventoryTransferLineInput,
} from '@letbuyy/api-client'

type TransferWithLines = InventoryTransfer;

type TransferProductItem = {
    id: string
    name: string
    sku?: string | null
    variants?: Array<{ id: string; title: string; sku?: string | null }>
}

// ── helpers ───────────────────────────────────────────────────────────────────

function transferStatusVariant(status: string): StatusVariant {
    switch (status) {
        case 'received': return 'success'
        case 'partially_received': return 'info'
        case 'shipped': return 'warning'
        case 'reserved': return 'default'
        case 'cancelled': return 'critical'
        default: return 'default'
    }
}

function transferStatusLabel(status: string): string {
    switch (status) {
        case 'reserved': return 'Reserved'
        case 'shipped': return 'Shipped'
        case 'partially_received': return 'Partially received'
        case 'received': return 'Received'
        case 'cancelled': return 'Cancelled'
        default: return status
    }
}

// ── CreateTransferModal ───────────────────────────────────────────────────────

interface CreateLineRow {
    id: string
    product_id: string
    variant_id: string
    quantity: number
}

interface CreateTransferModalProps {
    submitCommand:WarehouseSubmit
    blocked:boolean
    open: boolean
    locations: InventoryLocation[]
    locationRead: WarehouseOptionControls
    products: TransferProductItem[]
    hasMoreProducts: boolean
    loadingProducts: boolean
    loadMoreProducts: () => void
    productLoadError: boolean
    onClose: () => void
    onCreated: () => void
}

function CreateTransferModal({ submitCommand, blocked,
    open,
    locations,
    locationRead,
    products,
    hasMoreProducts,
    loadingProducts,
    loadMoreProducts,
    productLoadError,
    onClose,
    onCreated,
}: CreateTransferModalProps) {
    const { notify } = useToast()
    const [sourceLocationId, setSourceLocationId] = useState('')
    const [destLocationId, setDestLocationId] = useState('')
    const [notes, setNotes] = useState('')
    const [lines, setLines] = useState<CreateLineRow[]>([
        { id: '1', product_id: '', variant_id: '', quantity: 1 },
    ])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            setSourceLocationId('')
            setDestLocationId('')
            setNotes('')
            setLines([{ id: '1', product_id: '', variant_id: '', quantity: 1 }])
            setError(null)
        }
    }, [open])

    const locationOptions: SelectOption[] = [{ value: '', label: 'Select location…' }, ...locations.map((l) => ({
        value: l.id,
        label: l.name + (l.is_default ? ' (default)' : ''),
    }))]

    const productOptions = (): SelectOption[] => [
        { value: '', label: 'Select product…' },
        ...products.map((p) => ({ value: p.id, label: p.name })),
    ]

    function variantOptionsFor(productId: string): SelectOption[] {
        const product = products.find((p) => p.id === productId)
        if (!product?.variants?.length) return []
        return [
            { value: '', label: 'No variant' },
            ...product.variants.map((v) => ({ value: v.id, label: v.title })),
        ]
    }

    function updateLine(id: string, patch: Partial<CreateLineRow>) {
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    }

    function addLine() {
        setLines((prev) => [
            ...prev,
            { id: String(Date.now()), product_id: '', variant_id: '', quantity: 1 },
        ])
    }

    function removeLine(id: string) {
        setLines((prev) => prev.filter((l) => l.id !== id))
    }

    async function handleSubmit() {
        setError(null)
        if (locationRead.loading || locationRead.error || !locations.some(row => row.id === sourceLocationId) || !locations.some(row => row.id === destLocationId)) { setError('Select both locations from the current verified choices.'); return }
        if (!sourceLocationId) { setError('Select a source location.'); return }
        if (!destLocationId) { setError('Select a destination location.'); return }
        if (sourceLocationId === destLocationId) {
            setError('Source and destination must be different locations.')
            return
        }
        const validLines = lines.filter((l) => l.product_id)
        if (!validLines.length) { setError('Add at least one product line.'); return }

        const payload: InventoryTransferLineInput[] = validLines.map((l) => ({
            product_id: l.product_id,
            variant_id: l.variant_id || null,
            quantity: l.quantity,
        }))

        setSubmitting(true)
        try {
            await submitCommand('transfer.create',null,{source_location_id:sourceLocationId,destination_location_id:destLocationId,notes:notes||undefined,lines:payload})
            notify({ title: 'Transfer created', variant: 'success' })
            onCreated()
            onClose()
        } catch (error) {
            setError(error instanceof WarehouseCommandValidationError ? error.message : error instanceof WarehouseRequestStoppedError
                ? 'The original request was stopped before it applied. Close this form to start a new request.'
                : 'The outcome could not be confirmed. Close this form and use Retry original or Stop original in the workspace.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            open={open}
            title="Create transfer"
            description="Reserve and move stock between inventory locations."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || blocked || locationRead.loading || locationRead.error}>
                        {submitting ? <Spinner size="sm" /> : null}
                        {submitting ? 'Creating…' : 'Create transfer'}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-[var(--lb-space-4)]">
                {error && (
                    <Banner variant="critical" title="Error">
                        {error}
                    </Banner>
                )}

                {productLoadError && <Banner variant="warning" title="More products could not be loaded">Try loading the next products again.</Banner>}
                {hasMoreProducts && <Button variant="secondary" onClick={loadMoreProducts} disabled={loadingProducts}>{loadingProducts ? 'Loading products…' : 'Load more products'}</Button>}

                <WarehouseOptionSearch label="locations" read={locationRead} />
                <div className="grid grid-cols-1 gap-[var(--lb-space-3)] sm:grid-cols-2">
                    <Select
                        label="Source location"
                        value={sourceLocationId}
                        options={locationOptions}
                        onChange={(e) => setSourceLocationId(e.target.value)}
                        required
                    />
                    <Select
                        label="Destination location"
                        value={destLocationId}
                        options={locationOptions}
                        onChange={(e) => setDestLocationId(e.target.value)}
                        required
                    />
                </div>

                <Input
                    label="Notes (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Internal notes about this transfer"
                />

                <div className="flex flex-col gap-[var(--lb-space-2)]">
                    <p className="text-[length:var(--lb-font-size-label)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                        Line items
                    </p>

                    {lines.map((line, idx) => {
                        const variantOpts = variantOptionsFor(line.product_id)
                        return (
                            <div
                                key={line.id}
                                className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-subtle)] p-[var(--lb-space-3)]"
                            >
                                <div className="mb-[var(--lb-space-2)] flex items-center justify-between">
                                    <span className="text-[length:var(--lb-font-size-sm)] text-[var(--lb-color-text-secondary)]">
                                        Line {idx + 1}
                                    </span>
                                    {lines.length > 1 && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => removeLine(line.id)}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-[var(--lb-space-2)] sm:grid-cols-2">
                                    <Select
                                        label="Product"
                                        value={line.product_id}
                                        options={productOptions()}
                                        onChange={(e) =>
                                            updateLine(line.id, {
                                                product_id: e.target.value,
                                                variant_id: '',
                                            })
                                        }
                                    />
                                    {variantOpts.length > 0 && (
                                        <Select
                                            label="Variant"
                                            value={line.variant_id}
                                            options={variantOpts}
                                            onChange={(e) =>
                                                updateLine(line.id, { variant_id: e.target.value })
                                            }
                                        />
                                    )}
                                </div>
                                <div className="mt-[var(--lb-space-2)]">
                                    <NumberField
                                        label="Quantity"
                                        value={line.quantity}
                                        min={1}
                                        onValueChange={(v) =>
                                            updateLine(line.id, { quantity: v ?? 1 })
                                        }
                                    />
                                </div>
                            </div>
                        )
                    })}

                    <Button variant="secondary" size="sm" onClick={addLine}>
                        + Add line
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

// ── ShipConfirmModal ──────────────────────────────────────────────────────────

interface ShipConfirmModalProps {
    submitCommand:WarehouseSubmit
    blocked:boolean
    open: boolean
    transfer: TransferWithLines | null
    onClose: () => void
    onShipped: () => void
}

function ShipConfirmModal({ submitCommand, blocked, open, transfer, onClose, onShipped }: ShipConfirmModalProps) {
    const { notify } = useToast()
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) setError(null)
    }, [open])

    if (!transfer) return null

    async function handleShip() {
        if (!transfer) return
        setError(null)
        setSubmitting(true)
        try {
            await submitCommand('transfer.ship',transfer.id,{})
            notify({ title: 'Transfer marked as shipped', variant: 'success' })
            onShipped()
            onClose()
        } catch (error) {
            setError(error instanceof WarehouseCommandValidationError ? error.message : error instanceof WarehouseRequestStoppedError
                ? 'The original request was stopped before it applied. Close this form to start a new request.'
                : 'The outcome could not be confirmed. Close this form and use Retry original or Stop original in the workspace.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            open={open}
            title={`Ship transfer — ${transfer.transfer_number}`}
            description="Confirm that stock has been dispatched from the source location. The transfer will be marked as shipped and stock will be deducted at the source."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleShip} disabled={submitting || blocked}>
                        {submitting ? <Spinner size="sm" /> : null}
                        {submitting ? 'Shipping…' : 'Mark as shipped'}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-[var(--lb-space-3)]">
                {error && (
                    <Banner variant="critical" title="Error">
                        {error}
                    </Banner>
                )}
                <p className="text-[length:var(--lb-font-size-body)] text-[var(--lb-color-text-secondary)]">
                    This will mark{' '}
                    <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                        {transfer.lines.length} line{transfer.lines.length !== 1 ? 's' : ''}
                    </span>{' '}
                    as in-transit.
                </p>
            </div>
        </Modal>
    )
}

// ── ReceiveTransferModal ──────────────────────────────────────────────────────

interface ReceiveTransferModalProps {
    submitCommand:WarehouseSubmit
    blocked:boolean
    open: boolean
    transfer: TransferWithLines | null
    onClose: () => void
    onReceived: () => void
}

function ReceiveTransferModal({ submitCommand, blocked,
    open,
    transfer,
    onClose,
    onReceived,
}: ReceiveTransferModalProps) {
    const { notify } = useToast()
    const [lineQtys, setLineQtys] = useState<Record<string, number>>({})
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open && transfer) {
            const init: Record<string, number> = {}
            for (const l of transfer.lines) {
                const remaining = l.quantity_shipped - l.quantity_received
                init[l.id] = remaining > 0 ? remaining : 0
            }
            setLineQtys(init)
            setError(null)
        }
    }, [open, transfer])

    if (!transfer) return null

    const receivableLines = transfer.lines.filter(
        (l) => l.quantity_shipped - l.quantity_received > 0,
    )

    async function handleReceive() {
        if (!transfer) return
        setError(null)

        if(receivableLines.some(line=>{const quantity=lineQtys[line.id]??0;return !Number.isInteger(quantity)||quantity<0||quantity>line.quantity_shipped-line.quantity_received})){
            setError('Enter whole receiving quantities within the remaining stock for each line.')
            return
        }

        const receiveLines: ReceiveInventoryTransferLineInput[] = receivableLines
            .filter((l) => (lineQtys[l.id] ?? 0) > 0)
            .map((l) => ({
                transfer_line_id: l.id,
                quantity: lineQtys[l.id] ?? 0,
            }))

        if (!receiveLines.length) {
            setError('Enter a received quantity for at least one line.')
            return
        }

        setSubmitting(true)
        try {
            await submitCommand('transfer.receive',transfer.id,{lines:receiveLines})
            notify({ title: 'Stock received into destination location', variant: 'success' })
            onReceived()
            onClose()
        } catch (error) {
            setError(error instanceof WarehouseCommandValidationError ? error.message : error instanceof WarehouseRequestStoppedError
                ? 'The original request was stopped before it applied. Close this form to start a new request.'
                : 'The outcome could not be confirmed. Close this form and use Retry original or Stop original in the workspace.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            open={open}
            title={`Receive transfer — ${transfer.transfer_number}`}
            description="Enter the quantity received for each line. Stock will be added to available inventory at the destination location."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleReceive} disabled={submitting || blocked}>
                        {submitting ? <Spinner size="sm" /> : null}
                        {submitting ? 'Receiving…' : 'Confirm receipt'}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-[var(--lb-space-4)]">
                {error && (
                    <Banner variant="critical" title="Error">
                        {error}
                    </Banner>
                )}

                {receivableLines.length === 0 ? (
                    <Banner variant="info" title="All lines received">
                        Every line in this transfer has already been fully received.
                    </Banner>
                ) : (
                    <div className="flex flex-col gap-[var(--lb-space-3)]">
                        {receivableLines.map((line) => {
                            const remaining = line.quantity_shipped - line.quantity_received
                            return (
                                <div
                                    key={line.id}
                                    className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-subtle)] p-[var(--lb-space-3)]"
                                >
                                    <div className="mb-[var(--lb-space-2)] flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                        <span className="text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                            Product ID: {line.product_id.slice(0, 8)}…
                                        </span>
                                        {line.variant_id && (
                                            <span className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-tertiary)]">
                                                Variant: {line.variant_id.slice(0, 8)}…
                                            </span>
                                        )}
                                        <span className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                            Requested: {line.quantity_requested} · Shipped: {line.quantity_shipped} · Received: {line.quantity_received} · Remaining: {remaining}
                                        </span>
                                    </div>
                                    <NumberField
                                        label="Receive quantity"
                                        value={lineQtys[line.id] ?? remaining}
                                        min={0}
                                        max={remaining}
                                        onValueChange={(v) =>
                                            setLineQtys((prev) => ({
                                                ...prev,
                                                [line.id]: Math.min(v ?? 0, remaining),
                                            }))
                                        }
                                    />
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </Modal>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransfersPage() {
    const {store}=useParams<{store:string}>()
    const {actorId,siteId}=useMerchantSecurityContext(store)
    return <WarehouseWorkspace key={`${actorId}:${siteId??'unavailable'}:${store}`} store={store} />
}
function WarehouseWorkspace({store}:{store:string}) {
    const commands=useWarehouseCommands(store)
    const detail=useWarehouseDocument(store)
    const { notify } = useToast()

    const [transfers, setTransfers] = useState<TransferWithLines[]>([])
    const locationRead = useInventoryLocations(store)
    const locations = locationRead.items
    const productPicker = useProductPicker<TransferProductItem>(store)
    const beginRead = useReadRequest(store)
    const {actorId:warehouseActor,siteId:warehouseSite}=useMerchantSecurityContext(store)
    const [page,setPage]=useState(1)
    const [filters,setFilters]=useState<{search:string;status:string;sort:'newest'|'oldest'}>({search:'',status:'',sort:'newest'})
    const [population,setPopulation]=useState<{total:number;more:boolean}|null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)

    const [showCreate, setShowCreate] = useState(false)
    const [shippingTransfer, setShippingTransfer] = useState<TransferWithLines | null>(null)
    const [receivingTransfer, setReceivingTransfer] = useState<TransferWithLines | null>(null)

    const loadAll = useCallback(async () => {
        if (!store) return
        const request = beginRead()
        setLoading(true)
        setLoadError(null)
        setTransfers([])
        setPopulation(null)
        try {
            const transferRes = await fetch(`/api/stores/${encodeURIComponent(store)}/transfers?${new URLSearchParams({page:String(page),limit:'20',sort:filters.sort,...(filters.search?{search:filters.search}:{}),...(filters.status?{status:filters.status}:{})})}`, { headers:{'X-LetBuyy-Merchant-Context':warehouseActor}, cache: 'no-store', signal: request.signal })
            const transferBody = await transferRes.json() as { data?: TransferWithLines[]; meta?:unknown; error?: unknown }
            if (!request.isCurrent()) return

            if (!transferRes.ok) {
                const msg =
                    typeof transferBody.error === 'string'
                        ? transferBody.error
                        : 'Failed to load transfers'
                setLoadError(msg)
                return
            }

            const metadata=WarehouseDocumentPageMetaSchema.safeParse(transferBody.meta)
            if(!metadata.success||metadata.data.store_id!==warehouseSite||metadata.data.page!==page||metadata.data.per_page!==20||
                !Array.isArray(transferBody.data)||transferBody.data.length!==Math.min(20,Math.max(0,metadata.data.total-(page-1)*20))||
                metadata.data.has_next!==(page*20<metadata.data.total))throw new Error('Warehouse page could not be confirmed')
            setTransfers(transferBody.data)
            setPopulation({total:metadata.data.total,more:metadata.data.has_next})
        } catch {
            if (request.isCurrent()) setLoadError('Unable to load transfers — check your connection.')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [store, beginRead, page, warehouseSite, warehouseActor, filters])

    useEffect(() => { void loadAll() }, [loadAll])

    async function openCreate() {
        if(commands.blocked)return
        if (productPicker.loading) return
        if (await productPicker.load()) setShowCreate(true)
    }

    async function openShip(transfer: TransferWithLines) {
        if(commands.blocked||detail.loading)return
        try {
            transfer=await detail.load('transfers',transfer.id,WarehouseTransferSchema)
        }catch{notify({title:'The current warehouse record could not be loaded. Refresh and check your access.',variant:'critical'});return}
        if (transfer.status !== 'reserved') {
            notify({
                title: `Cannot ship a transfer with status "${transferStatusLabel(transfer.status)}"`,
                variant: 'critical',
            })
            return
        }
        setShippingTransfer(transfer)
    }

    async function openReceive(transfer: TransferWithLines) {
        if(commands.blocked||detail.loading)return
        try {
            transfer=await detail.load('transfers',transfer.id,WarehouseTransferSchema)
        }catch{notify({title:'The current warehouse record could not be loaded. Refresh and check your access.',variant:'critical'});return}
        if (transfer.status === 'received' || transfer.status === 'cancelled') {
            notify({
                title: `Cannot receive a ${transferStatusLabel(transfer.status).toLowerCase()} transfer`,
                variant: 'critical',
            })
            return
        }
        if (transfer.status === 'reserved') {
            notify({
                title: 'Transfer must be shipped before it can be received',
                variant: 'warning',
            })
            return
        }
        setReceivingTransfer(transfer)
    }

    function locationName(id: string): string {
        return locations.find((l) => l.id === id)?.name ?? id.slice(0, 8) + '…'
    }

    // ── render ──────────────────────────────────────────────────────────────

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Transfers"
                description="Move stock between inventory locations — reserve, ship, and receive."
                breadcrumbs={[{ label: 'Purchasing' }, { label: 'Transfers' }]}
                primaryAction={{
                    label: productPicker.loading && !showCreate ? 'Loading transfer form…' : 'Create transfer',
                    icon: <MaterialIcon name="add" />,
                    onClick: () => void openCreate(),
                    disabled: commands.blocked || loading || productPicker.loading || locationRead.loading || locationRead.error || locations.length < 2,
                }}
            />

            {loadError && (
                <Banner variant="critical" title="Failed to load transfers">
                    {loadError}
                </Banner>
            )}

            {productPicker.error && !showCreate && <Banner variant="warning" title="The transfer form could not be loaded">Try opening the transfer form again.</Banner>}

            {!locationRead.loading && !locationRead.error && !loadError && locations.length < 2 && (
                <Banner variant="warning" title="Not enough inventory locations">
                    You need at least two inventory locations to create a transfer. Locations can be
                    added from Inventory settings.
                </Banner>
            )}

            {locationRead.error && <Banner variant="warning" title="Inventory locations could not be loaded" action={<Button variant="secondary" onClick={() => { void locationRead.load() }}>Retry locations</Button>}>Existing records remain available. Reload locations before creating a new record.</Banner>}

            <div className="flex flex-wrap items-center gap-[var(--lb-space-3)]" aria-label="Warehouse pages">
                <Button variant="secondary" disabled={loading||page===1} onClick={()=>setPage(value=>value-1)}>Previous</Button>
                <span>{population?`${population.total} matching records · Page ${page}`:`Page ${page} · Count unavailable`}</span>
                <Button variant="secondary" disabled={loading||!population?.more} onClick={()=>setPage(value=>value+1)}>Next</Button>
            </div>

            <WarehouseCommandRecovery commands={commands} onResolved={()=>void loadAll()} />

            <WarehouseDocumentFilters kind="transfers" disabled={loading} onApply={(search,status,sort)=>{ setTransfers([]); setPopulation(null); setLoading(true); setPage(1); setFilters({search,status,sort}); }} />

            <Card>
                <Section
                    title="Location transfers"
                    description="Reserve, ship, and receive stock between locations."
                >
                    {loading ? (
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {[1, 2, 3].map((i) => (
                                <Skeleton
                                    key={i}
                                    className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]"
                                />
                            ))}
                        </div>
                    ) : loadError ? <p>Transfer records are unavailable. Reload the workspace to try again.</p> : transfers.length === 0 ? (
                        <EmptyState scene="transfers"
                            icon={
                                <RefreshCw
                                    className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]"
                                    aria-hidden="true"
                                />
                            }
                            title={filters.search||filters.status?"No matching transfers":page===1?"No transfers yet":"No records on this page"}
                            body="Create a transfer to move stock between locations. Transferred inventory is reserved at the source until received at the destination."
                            primaryAction={
                                <Button
                                    onClick={() => void openCreate()}
                                    disabled={productPicker.loading || locationRead.loading || locationRead.error || locations.length < 2}
                                >
                                    Create transfer
                                </Button>
                            }
                            secondaryAction={
                                <Button variant="secondary" onClick={() => void loadAll()}>
                                    Refresh
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full border-collapse text-[length:var(--lb-font-size-sm)]">
                                <thead>
                                    <tr className="border-b border-[var(--lb-color-border-subtle)] text-left">
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Transfer #
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Route
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Status
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Lines
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Created
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transfers.map((transfer) => (
                                        <tr
                                            key={transfer.id}
                                            className="border-b border-[var(--lb-color-border-subtle)] last:border-0"
                                        >
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                {transfer.transfer_number}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                <span className="inline-flex items-center gap-[var(--lb-space-1)]">
                                                    {locationName(transfer.source_location_id)}
                                                    <MaterialIcon
                                                        name="arrow_forward"
                                                        className="text-[length:var(--lb-font-size-sm)] text-[var(--lb-color-text-tertiary)]"
                                                        aria-hidden="true"
                                                    />
                                                    {locationName(transfer.destination_location_id)}
                                                </span>
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)]">
                                                <Badge
                                                    label={transferStatusLabel(transfer.status)}
                                                    variant={transferStatusVariant(transfer.status)}
                                                />
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-right tabular-nums text-[var(--lb-color-text-secondary)]">
                                                {transfer.lines.length}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                {formatDate(transfer.created_at)}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] text-right">
                                                <div className="inline-flex gap-[var(--lb-space-2)]">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => void openShip(transfer)}
                                                        disabled={commands.blocked || transfer.status !== 'reserved'}
                                                    >
                                                        <Truck
                                                            className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                                                            aria-hidden="true"
                                                        />
                                                        Ship
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => void openReceive(transfer)}
                                                        disabled={
                                                            commands.blocked || transfer.status === 'received' ||
                                                            transfer.status === 'cancelled' ||
                                                            transfer.status === 'reserved'
                                                        }
                                                    >
                                                        Receive
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Section>
            </Card>

            <CreateTransferModal
                submitCommand={commands.submit}
                blocked={commands.blocked}
                open={showCreate}
                locations={locations}
                locationRead={locationRead}
                products={productPicker.items}
                hasMoreProducts={productPicker.hasMore}
                loadingProducts={productPicker.loading}
                loadMoreProducts={() => { void productPicker.load(false) }}
                productLoadError={productPicker.error}
                onClose={() => setShowCreate(false)}
                onCreated={() => void loadAll()}
            />

            <ShipConfirmModal
                submitCommand={commands.submit}
                blocked={commands.blocked}
                open={shippingTransfer !== null}
                transfer={shippingTransfer}
                onClose={() => setShippingTransfer(null)}
                onShipped={() => void loadAll()}
            />

            <ReceiveTransferModal
                submitCommand={commands.submit}
                blocked={commands.blocked}
                open={receivingTransfer !== null}
                transfer={receivingTransfer}
                onClose={() => setReceivingTransfer(null)}
                onReceived={() => void loadAll()}
            />
        </Page>
    )
}
