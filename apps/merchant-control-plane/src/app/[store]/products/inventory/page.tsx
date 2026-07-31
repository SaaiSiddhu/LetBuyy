'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { Button, Input, Table, Avatar, Badge, Banner, Card, EmptyState, Page, PageHeader, Pencil, RefreshCw, SaveBar, Search, Section, Skeleton, useToast } from '@letbuyy/ui'
import { formatDisplayDate } from '@letbuyy/ui/formatting'
import type { InventoryLevel } from '@letbuyy/shared-types'

type InventoryItem = InventoryLevel

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
        available: Number(row.available || 0),
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

    const [products, setProducts] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [quantity, setQuantity] = useState('')
    const [savingId, setSavingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const loadInventory = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory/levels?limit=100`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load inventory'))
            }

            const nextProducts = Array.isArray(payload?.data)
                ? payload.data.map((row: Record<string, unknown>) => normalizeInventoryItem(row)).filter((row: InventoryItem) => row.id)
                : []
            setProducts(nextProducts)
        } catch (inventoryError) {
            const message = inventoryError instanceof Error ? inventoryError.message : 'Unable to load inventory'
            setProducts([])
            setError(message)
            notify({
                title: 'Inventory could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadInventory()
    }, [loadInventory])

    const filtered = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return products

        return products.filter((product) =>
            product.product_name.toLowerCase().includes(query) ||
            product.location_name.toLowerCase().includes(query) ||
            (product.sku && product.sku.toLowerCase().includes(query))
        )
    }, [products, searchQuery])

    const editingItem = products.find((product) => product.id === editingId) || null
    const parsedQuantity = Number(quantity)
    const hasValidQuantity = Number.isInteger(parsedQuantity) && parsedQuantity >= 0
    const hasUnsavedQuantity = Boolean(editingItem) && quantity.trim() !== '' && parsedQuantity !== Number(editingItem?.available || 0)
    const saveState = savingId ? 'saving' : hasUnsavedQuantity ? 'unsaved' : 'saved'

    const startEdit = useCallback((item: InventoryItem) => {
        setEditingId(item.id)
        setQuantity(String(item.available))
        setError(null)
    }, [])

    const cancelEdit = useCallback(() => {
        setEditingId(null)
        setQuantity('')
        setError(null)
    }, [])

    const saveStock = useCallback(async (item?: InventoryItem | null) => {
        const activeItem = item || editingItem
        if (!activeItem || savingId) return

        const nextQuantity = Number(quantity)
        if (!Number.isFinite(nextQuantity) || nextQuantity < 0 || !Number.isInteger(nextQuantity)) {
            const message = 'Stock must be a non-negative whole number.'
            setError(message)
            notify({
                title: 'Inventory quantity is invalid',
                description: message,
                variant: 'warning',
            })
            return
        }

        const adjustment = Math.trunc(nextQuantity) - Number(activeItem.available || 0)
        if (adjustment === 0) {
            cancelEdit()
            notify({
                title: 'No inventory change',
                description: 'The available quantity already matches your entry.',
                variant: 'info',
            })
            return
        }

        setSavingId(activeItem.id)
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: activeItem.product_id,
                    variant_id: activeItem.variant_id || null,
                    location_id: activeItem.location_id || null,
                    adjustment,
                    reason: 'correction',
                    notes: 'Adjusted from admin inventory screen',
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to adjust inventory'))
            }

            notify({
                title: 'Inventory adjusted',
                description: `${activeItem.product_name} now has ${nextQuantity} available.`,
                variant: 'success',
            })
            cancelEdit()
            await loadInventory({ quiet: true })
        } catch (inventoryError) {
            const message = inventoryError instanceof Error ? inventoryError.message : 'Unable to adjust inventory'
            setError(message)
            notify({
                title: 'Could not adjust inventory',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSavingId(null)
        }
    }, [cancelEdit, editingItem, loadInventory, notify, quantity, savingId, store])

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
                    disabled={savingId === row.id}
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
                        disabled={savingId === row.id || !hasValidQuantity || !hasUnsavedQuantity}
                        loading={savingId === row.id}
                    >
                        Save
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={cancelEdit} disabled={savingId === row.id}>
                        Cancel
                    </Button>
                </div>
            ) : (
                <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)}>
                    <Pencil className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                    Adjust
                </Button>
            ),
        },
    ], [cancelEdit, editingId, hasUnsavedQuantity, hasValidQuantity, quantity, saveStock, savingId, startEdit])

    return (
        <Page>
            <PageHeader
                title="Inventory"
                description="Review stock availability and adjust tracked inventory quantities."
                breadcrumbs={[{ label: 'Products' }, { label: 'Inventory' }]}
                primaryAction={{
                    label: 'Refresh',
                    onClick: () => void loadInventory(),
                    disabled: loading || Boolean(savingId),
                    icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
            />

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
                    action={<Badge label={`${products.length} tracked`} variant="info" />}
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
                            title={error ? 'Unable to load inventory' : 'No inventory to track'}
                            body={error || 'Add products to your store to start tracking inventory levels.'}
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
                                placeholder="Search inventory by product, SKU, or location..."
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
                </Section>
            </Card>

            <SaveBar
                state={saveState}
                onSave={() => void saveStock()}
                onDiscard={cancelEdit}
                saveLabel="Save adjustment"
            />
        </Page>
    )
}
