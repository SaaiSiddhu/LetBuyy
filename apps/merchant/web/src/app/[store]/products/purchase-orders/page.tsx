'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {useMerchantSecurityContext} from '@/components/security/MerchantSecurityContext'
import {useWarehouseCommands,WarehouseRequestStoppedError,WarehouseCommandValidationError,type WarehouseSubmit} from '@/lib/inventory/use-warehouse-commands'
import {WarehouseCommandRecovery} from '@/components/products/WarehouseCommandRecovery'
import { useReadRequest } from '@/lib/api/use-read-request'
import { useProductPicker } from '@/lib/api/use-product-picker'
import { useInventoryLocations } from '@/lib/api/use-inventory-locations'
import { formatIndiaDate as formatDate, formatInrCurrency } from '@letbuyy/ui/formatting'
import {
    Badge,
    Banner,
    Button,
    Card,
    EmptyState,
    Input,
    MaterialIcon,
    Modal,
    NumberField,
    Page,
    PageHeader,
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
import type {
    PurchaseOrder,
    Supplier,
    InventoryLocation,
    PurchaseOrderLineInput,
    ReceivePurchaseOrderLineInput,
} from '@letbuyy/api-client'

// ── local row types ──────────────────────────────────────────────────────────

type PurchaseOrderProductItem = {
    id: string
    name: string
    sku?: string | null
    variants?: Array<{ id: string; title: string; sku?: string | null }>
}

// ── helpers ──────────────────────────────────────────────────────────────────

function poStatusVariant(status: PurchaseOrder['status']): StatusVariant {
    switch (status) {
        case 'received': return 'success'
        case 'partially_received': return 'info'
        case 'ordered': return 'default'
        case 'cancelled': return 'critical'
        default: return 'default'
    }
}

function poStatusLabel(status: PurchaseOrder['status']): string {
    switch (status) {
        case 'draft': return 'Draft'
        case 'ordered': return 'Ordered'
        case 'partially_received': return 'Partially received'
        case 'received': return 'Received'
        case 'cancelled': return 'Cancelled'
        default: return status
    }
}

// ── CreatePOModal ─────────────────────────────────────────────────────────────

interface CreateLineRow {
    id: string
    product_id: string
    variant_id: string
    quantity: number
    unit_cost: number
}

interface CreatePOModalProps {
    submitCommand:WarehouseSubmit
    blocked:boolean
    open: boolean
    suppliers: Supplier[]
    locations: InventoryLocation[]
    products: PurchaseOrderProductItem[]
    hasMoreProducts: boolean
    loadingProducts: boolean
    loadMoreProducts: () => void
    productLoadError: boolean
    onClose: () => void
    onCreated: () => void
}

function CreatePOModal({ submitCommand, blocked, open, suppliers, locations, products, hasMoreProducts, loadingProducts, loadMoreProducts, productLoadError, onClose, onCreated }: CreatePOModalProps) {
    const { notify } = useToast()
    const [supplierId, setSupplierId] = useState('')
    const [locationId, setLocationId] = useState('')
    const [expectedAt, setExpectedAt] = useState('')
    const [notes, setNotes] = useState('')
    const [lines, setLines] = useState<CreateLineRow[]>([
        { id: '1', product_id: '', variant_id: '', quantity: 1, unit_cost: 0 },
    ])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Reset on open
    useEffect(() => {
        if (open) {
            setSupplierId('')
            setLocationId(locations[0]?.id ?? '')
            setExpectedAt('')
            setNotes('')
            setLines([{ id: '1', product_id: '', variant_id: '', quantity: 1, unit_cost: 0 }])
            setError(null)
        }
    }, [open, locations])

    const supplierOptions: SelectOption[] = [
        { value: '', label: 'No supplier' },
        ...suppliers.map((s) => ({ value: s.id, label: s.name })),
    ]

    const locationOptions: SelectOption[] = locations.map((l) => ({
        value: l.id,
        label: l.name + (l.is_default ? ' (default)' : ''),
    }))

    const productOptions = (lineIdx: number): SelectOption[] => [
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
        setLines((prev) =>
            prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        )
    }

    function addLine() {
        setLines((prev) => [
            ...prev,
            { id: String(Date.now()), product_id: '', variant_id: '', quantity: 1, unit_cost: 0 },
        ])
    }

    function removeLine(id: string) {
        setLines((prev) => prev.filter((l) => l.id !== id))
    }

    async function handleSubmit() {
        setError(null)
        if (!locationId) { setError('Select a destination location.'); return }
        const validLines = lines.filter((l) => l.product_id)
        if (!validLines.length) { setError('Add at least one product line.'); return }

        const payload: PurchaseOrderLineInput[] = validLines.map((l) => ({
            product_id: l.product_id,
            variant_id: l.variant_id || null,
            quantity: l.quantity,
            unit_cost: l.unit_cost,
        }))

        setSubmitting(true)
        try {
            await submitCommand('purchase_order.create',null,{supplier_id:supplierId||null,location_id:locationId,expected_at:expectedAt||undefined,notes:notes||undefined,lines:payload})
            notify({ title: 'Purchase order created', variant: 'success' })
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

    const lineTotal = lines
        .filter((l) => l.product_id)
        .reduce((sum, l) => sum + l.quantity * l.unit_cost, 0)

    return (
        <Modal
            open={open}
            title="Create purchase order"
            description="Order stock from a supplier and receive it into an inventory location."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || blocked}>
                        {submitting ? <Spinner size="sm" /> : null}
                        {submitting ? 'Creating…' : 'Create purchase order'}
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

                <div className="grid grid-cols-1 gap-[var(--lb-space-3)] sm:grid-cols-2">
                    <Select
                        label="Supplier (optional)"
                        value={supplierId}
                        options={supplierOptions}
                        onChange={(e) => setSupplierId(e.target.value)}
                    />
                    <Select
                        label="Destination location"
                        value={locationId}
                        options={locationOptions}
                        onChange={(e) => setLocationId(e.target.value)}
                        required
                    />
                </div>

                <div className="grid grid-cols-1 gap-[var(--lb-space-3)] sm:grid-cols-2">
                    <Input
                        label="Expected arrival (optional)"
                        type="date"
                        value={expectedAt}
                        onChange={(e) => setExpectedAt(e.target.value)}
                    />
                    <Input
                        label="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Internal notes about this order"
                    />
                </div>

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
                                        options={productOptions(idx)}
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
                                <div className="mt-[var(--lb-space-2)] grid grid-cols-2 gap-[var(--lb-space-2)]">
                                    <NumberField
                                        label="Quantity"
                                        value={line.quantity}
                                        min={1}
                                        onValueChange={(v) =>
                                            updateLine(line.id, { quantity: v ?? 1 })
                                        }
                                    />
                                    <NumberField
                                        label="Unit cost (₹)"
                                        value={line.unit_cost}
                                        min={0}
                                        step={0.01}
                                        onValueChange={(v) =>
                                            updateLine(line.id, { unit_cost: v ?? 0 })
                                        }
                                    />
                                </div>
                            </div>
                        )
                    })}

                    <Button variant="secondary" size="sm" onClick={addLine}>
                        + Add line
                    </Button>

                    {lineTotal > 0 && (
                        <p className="text-right text-[length:var(--lb-font-size-sm)] text-[var(--lb-color-text-secondary)]">
                            Estimated total:{' '}
                            <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                {formatInrCurrency(lineTotal) ?? `₹${lineTotal}`}
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    )
}

// ── ReceivePOModal ────────────────────────────────────────────────────────────

interface ReceivePOModalProps {
    submitCommand:WarehouseSubmit
    blocked:boolean
    open: boolean
    po: PurchaseOrder | null
    onClose: () => void
    onReceived: () => void
}

function ReceivePOModal({ submitCommand, blocked, open, po, onClose, onReceived }: ReceivePOModalProps) {
    const { notify } = useToast()
    const [lineQtys, setLineQtys] = useState<Record<string, number>>({})
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open && po) {
            const init: Record<string, number> = {}
            for (const l of po.lines) {
                const remaining = l.quantity_ordered - l.quantity_received
                init[l.id] = remaining > 0 ? remaining : 0
            }
            setLineQtys(init)
            setError(null)
        }
    }, [open, po])

    if (!po) return null

    const receivableLines = po.lines.filter(
        (l) => l.quantity_ordered - l.quantity_received > 0,
    )

    async function handleReceive() {
        if (!po) return
        setError(null)

        const receiveLines: ReceivePurchaseOrderLineInput[] = receivableLines
            .filter((l) => (lineQtys[l.id] ?? 0) > 0)
            .map((l) => ({
                purchase_order_line_id: l.id,
                quantity: lineQtys[l.id] ?? 0,
            }))

        if (!receiveLines.length) {
            setError('Enter a received quantity for at least one line.')
            return
        }

        setSubmitting(true)
        try {
            await submitCommand('purchase_order.receive',po.id,{lines:receiveLines})
            notify({ title: 'Stock received into inventory', variant: 'success' })
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
            title={`Receive stock — ${po.po_number ?? po.id.slice(0, 8).toUpperCase()}`}
            description="Enter the quantity received for each line. Received stock will be added to available inventory at the destination location."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleReceive} disabled={submitting || blocked}>
                        {submitting ? <Spinner size="sm" /> : null}
                        {submitting ? 'Receiving…' : 'Mark as received'}
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
                        Every line in this purchase order has been fully received.
                    </Banner>
                ) : (
                    <div className="flex flex-col gap-[var(--lb-space-3)]">
                        {receivableLines.map((line) => {
                            const remaining = line.quantity_ordered - line.quantity_received
                            return (
                                <div
                                    key={line.id}
                                    className="rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-subtle)] p-[var(--lb-space-3)]"
                                >
                                    <div className="mb-[var(--lb-space-2)] flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                        <span className="text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                            Product ID: {line.product_id.slice(0, 8)}…
                                        </span>
                                        <span className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                            Ordered: {line.quantity_ordered} · Already received: {line.quantity_received} · Remaining: {remaining}
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

export default function PurchaseOrdersPage() {
    const {store}=useParams<{store:string}>()
    const {actorId,siteId}=useMerchantSecurityContext(store)
    return <WarehouseWorkspace key={`${actorId}:${siteId??'unavailable'}:${store}`} store={store} />
}
function WarehouseWorkspace({store}:{store:string}) {
    const commands=useWarehouseCommands(store)
    const { notify } = useToast()

    const [pos, setPos] = useState<PurchaseOrder[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const locationRead = useInventoryLocations(store)
    const locations = locationRead.items
    const productPicker = useProductPicker<PurchaseOrderProductItem>(store)
    const [resourcesLoading, setResourcesLoading] = useState(false)
    const beginRead = useReadRequest(store)
    const beginCreateRead = useReadRequest(store)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [formError,setFormError]=useState<string|null>(null)

    const [showCreate, setShowCreate] = useState(false)
    const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null)

    const loadAll = useCallback(async () => {
        if (!store) return
        const request = beginRead()
        setLoading(true)
        setLoadError(null)
        setPos([])
        try {
            const poRes = await fetch(`/api/stores/${encodeURIComponent(store)}/purchase-orders`, { cache: 'no-store', signal: request.signal })
            const poBody = await poRes.json() as { data?: PurchaseOrder[]; error?: unknown }
            if (!request.isCurrent()) return

            if (!poRes.ok) {
                const msg = typeof poBody.error === 'string' ? poBody.error : 'Failed to load purchase orders'
                setLoadError(msg)
                return
            }

            setPos(poBody.data ?? [])
        } catch {
            if (request.isCurrent()) setLoadError('Unable to load purchase orders — check your connection.')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [store, beginRead])

    useEffect(() => { void loadAll() }, [loadAll])

    async function openCreate() {
        if(commands.blocked)return
        if (resourcesLoading) return
        const request = beginCreateRead()
        setResourcesLoading(true)
        setFormError(null)
        try {
            const [productsReady, response] = await Promise.all([
                productPicker.load(),
                fetch(`/api/stores/${encodeURIComponent(store)}/suppliers`, { cache: 'no-store', signal: request.signal }),
            ])
            const payload = await response.json()
            if (!request.isCurrent()) return
            if (!productsReady || !response.ok || !Array.isArray(payload.data)) throw new Error('Create form unavailable')
            setSuppliers(payload.data)
            setShowCreate(true)
        } catch {
            if (request.isCurrent()) setFormError('The purchase order form could not be loaded. Try opening it again.')
        } finally {
            if (request.isCurrent()) setResourcesLoading(false)
        }
    }

    function openReceive(po: PurchaseOrder) {
        if(commands.blocked)return
        if (po.status === 'received' || po.status === 'cancelled' || po.status === 'closed') {
            notify({ title: `Cannot receive a ${po.status} order`, variant: 'critical' })
            return
        }
        setReceivingPo(po)
    }

    // ── render ──────────────────────────────────────────────────────────────

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Purchase orders"
                description="Plan inbound stock from suppliers and receive it into inventory."
                breadcrumbs={[{ label: 'Purchasing' }, { label: 'Purchase orders' }]}
                primaryAction={{
                    label: resourcesLoading ? 'Loading purchase order form…' : 'Create purchase order',
                    icon: <MaterialIcon name="add" />,
                    onClick: () => void openCreate(),
                    disabled: commands.blocked || loading || resourcesLoading || locationRead.loading || locationRead.error || locations.length === 0,
                }}
            />

            {loadError && (
                <Banner variant="critical" title="Failed to load purchase orders">
                    {loadError}
                </Banner>
            )}
            {formError&&<Banner variant="critical" title="Purchase order form unavailable">{formError}</Banner>}

            {locations.length === 0 && !locationRead.loading && !locationRead.error && !loadError && (
                <Banner variant="warning" title="No inventory locations">
                    Set up at least one inventory location before creating purchase orders. Locations can be created from Inventory settings.
                </Banner>
            )}

            {locationRead.error && <Banner variant="warning" title="Inventory locations could not be loaded" action={<Button variant="secondary" onClick={() => { void locationRead.load() }}>Retry locations</Button>}>Existing records remain available. Reload locations before creating a new record.</Banner>}

            <WarehouseCommandRecovery commands={commands} onResolved={()=>void loadAll()} />

            <Card>
                <Section
                    title="Inbound inventory"
                    description="Track stock ordered from suppliers and receive it into inventory."
                >
                    {loading ? (
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : loadError ? <p>Purchase order records are unavailable. Reload the workspace to try again.</p> : pos.length === 0 ? (
                        <EmptyState
                            title="No purchase orders yet"
                            body="Create a purchase order to track supplier commitments, expected arrivals, and inventory receiving."
                            primaryAction={
                                <Button
                                    onClick={() => void openCreate()}
                                    disabled={resourcesLoading || locationRead.loading || locationRead.error || locations.length === 0}
                                >
                                    Create purchase order
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
                                            PO number
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Supplier
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Status
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Lines
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Total cost
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Expected
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
                                    {pos.map((po) => (
                                        <tr
                                            key={po.id}
                                            className="border-b border-[var(--lb-color-border-subtle)] last:border-0"
                                        >
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                {po.po_number ?? po.id.slice(0, 8).toUpperCase()}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                {po.supplier?.name ?? '—'}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)]">
                                                <Badge
                                                    label={poStatusLabel(po.status)}
                                                    variant={poStatusVariant(po.status)}
                                                />
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-right tabular-nums text-[var(--lb-color-text-secondary)]">
                                                {po.lines.length}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-right tabular-nums text-[var(--lb-color-text-primary)]">
                                                {formatInrCurrency(po.total) ?? '—'}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                {po.expected_at ? formatDate(po.expected_at) : '—'}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                {formatDate(po.created_at)}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] text-right">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => openReceive(po)}
                                                    disabled={commands.blocked || po.status === 'received' || po.status === 'cancelled' || po.status === 'closed'}
                                                >
                                                    <Truck
                                                        className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]"
                                                        aria-hidden="true"
                                                    />
                                                    Receive
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Section>
            </Card>

            <CreatePOModal
                submitCommand={commands.submit}
                blocked={commands.blocked}
                open={showCreate}
                suppliers={suppliers}
                locations={locations}
                products={productPicker.items}
                hasMoreProducts={productPicker.hasMore}
                loadingProducts={productPicker.loading}
                loadMoreProducts={() => { void productPicker.load(false) }}
                productLoadError={productPicker.error}
                onClose={() => setShowCreate(false)}
                onCreated={() => void loadAll()}
            />

            <ReceivePOModal
                submitCommand={commands.submit}
                blocked={commands.blocked}
                open={receivingPo !== null}
                po={receivingPo}
                onClose={() => setReceivingPo(null)}
                onReceived={() => void loadAll()}
            />
        </Page>
    )
}
