'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    EmptyState,
    Input,
    MaterialIcon,
    Modal,
    Page,
    PageHeader,
    Section,
    Skeleton,
    Spinner,
    Switch,
    Table,
    useToast,
    type StatusVariant,
} from '@letbuyy/ui'
import type { InventoryLocation } from '@letbuyy/api-client'

// ── helpers ──────────────────────────────────────────────────────────────────

function locationStatusVariant(status: string): StatusVariant {
    switch (status) {
        case 'active': return 'success'
        case 'inactive': return 'default'
        default: return 'default'
    }
}

function locationStatusLabel(status: string): string {
    switch (status) {
        case 'active': return 'Active'
        case 'inactive': return 'Inactive'
        default: return status
    }
}

// ── CreateLocationModal ───────────────────────────────────────────────────────

interface CreateLocationModalProps {
    open: boolean
    store: string
    hasExistingLocations: boolean
    onClose: () => void
    onCreated: () => void
}

function CreateLocationModal({ open, store, hasExistingLocations, onClose, onCreated }: CreateLocationModalProps) {
    const { notify } = useToast()
    const [name, setName] = useState('')
    const [isDefault, setIsDefault] = useState(false)
    const [addressLine, setAddressLine] = useState('')
    const [addressCity, setAddressCity] = useState('')
    const [addressState, setAddressState] = useState('')
    const [addressPincode, setAddressPincode] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            setName('')
            // Auto-set default if there are no existing locations
            setIsDefault(!hasExistingLocations)
            setAddressLine('')
            setAddressCity('')
            setAddressState('')
            setAddressPincode('')
            setError(null)
        }
    }, [open, hasExistingLocations])

    async function handleSubmit() {
        setError(null)
        if (!name.trim()) {
            setError('Location name is required.')
            return
        }

        const address: Record<string, unknown> = {}
        if (addressLine.trim()) address.line1 = addressLine.trim()
        if (addressCity.trim()) address.city = addressCity.trim()
        if (addressState.trim()) address.state = addressState.trim()
        if (addressPincode.trim()) address.pincode = addressPincode.trim()

        setSubmitting(true)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory-locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    is_default: isDefault,
                    address: Object.keys(address).length > 0 ? address : undefined,
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { error?: unknown }
                const msg = typeof body.error === 'string' ? body.error : 'Failed to create location'
                setError(msg)
                return
            }
            notify({ title: 'Location created', variant: 'success' })
            onCreated()
            onClose()
        } catch {
            setError('Network error — please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal
            open={open}
            title="Add location"
            description="Add a warehouse, store, or fulfillment centre where inventory is held."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? <Spinner size="sm" /> : null}
                        {submitting ? 'Adding…' : 'Add location'}
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

                <Input
                    label="Location name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mumbai Warehouse"
                    required
                    autoFocus
                />

                <div className="flex items-center gap-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border-subtle)] p-[var(--lb-space-3)]">
                    <div className="flex-1">
                        <p className="text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                            Set as default location
                        </p>
                        <p className="mt-[var(--lb-space-0-5)] text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                            New products and purchase orders will use this location by default.
                        </p>
                    </div>
                    <Switch
                        checked={isDefault}
                        onCheckedChange={(checked) => setIsDefault(checked)}
                    />
                </div>

                <div className="flex flex-col gap-[var(--lb-space-2)]">
                    <p className="text-[length:var(--lb-font-size-label)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                        Address (optional)
                    </p>
                    <Input
                        label="Street / area"
                        value={addressLine}
                        onChange={(e) => setAddressLine(e.target.value)}
                        placeholder="Plot 5, MIDC Industrial Area"
                    />
                    <div className="grid grid-cols-1 gap-[var(--lb-space-3)] sm:grid-cols-3">
                        <Input
                            label="City"
                            value={addressCity}
                            onChange={(e) => setAddressCity(e.target.value)}
                            placeholder="Pune"
                        />
                        <Input
                            label="State"
                            value={addressState}
                            onChange={(e) => setAddressState(e.target.value)}
                            placeholder="Maharashtra"
                        />
                        <Input
                            label="Pincode"
                            value={addressPincode}
                            onChange={(e) => setAddressPincode(e.target.value)}
                            placeholder="411019"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    )
}

// ── render helpers ────────────────────────────────────────────────────────────

function locationAddressLine(location: InventoryLocation): React.ReactNode {
    const addr = location.address
    if (!addr || typeof addr !== 'object' || Array.isArray(addr)) return null
    const rec = addr as Record<string, unknown>
    const parts = [rec.city, rec.state].filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (parts.length === 0) return null
    return (
        <p className="mt-[var(--lb-space-0-5)] text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
            {parts.join(', ')}
        </p>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LocationsPage() {
    const { store } = useParams<{ store: string }>()

    const [locations, setLocations] = useState<InventoryLocation[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)

    const beginLoadLocations = useReadRequest(store)
    const loadLocations = useCallback(async () => {
        const request = beginLoadLocations()
        if (!store) return
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory-locations`, { cache: 'no-store', signal: request.signal })
            const body = await res.json() as { data?: InventoryLocation[]; error?: unknown }
            if (!request.isCurrent()) return
            if (!res.ok) {
                const msg = typeof body.error === 'string' ? body.error : 'Failed to load locations'
                setLoadError(msg)
                return
            }
            setLocations(body.data ?? [])
        } catch {
            if (!request.isCurrent()) return
            setLoadError('Unable to load locations — check your connection.')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginLoadLocations, store])

    useEffect(() => { void loadLocations() }, [loadLocations])

    return (
        <Page>
            <PageHeader
                title="Locations"
                description="Manage warehouses, stores, and fulfilment centres where inventory is held."
                breadcrumbs={[{ label: 'Inventory' }, { label: 'Locations' }]}
                primaryAction={{
                    label: 'Add location',
                    icon: <MaterialIcon name="add" />,
                    onClick: () => setShowCreate(true),
                    disabled: loading,
                }}
            />

            {loadError && (
                <Banner variant="critical" title="Failed to load locations">
                    {loadError}
                </Banner>
            )}

            {locations.length === 0 && !loading && !loadError && (
                <Banner variant="info" title="No locations yet">
                    Add your first inventory location to start tracking stock and receiving purchase orders.
                </Banner>
            )}

            <Card>
                <Section
                    title="Inventory locations"
                    description="All warehouses and fulfilment centres linked to this store."
                >
                    {loading ? (
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : locations.length === 0 ? (
                        <EmptyState
                            title="No locations yet"
                            body="Add a warehouse or store to track inventory levels and receive purchase orders."
                            primaryAction={
                                <Button onClick={() => setShowCreate(true)}>
                                    Add location
                                </Button>
                            }
                            secondaryAction={
                                <Button variant="secondary" onClick={() => void loadLocations()}>
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
                                            Name
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Default
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {locations.map((location) => (
                                        <tr
                                            key={location.id}
                                            className="border-b border-[var(--lb-color-border-subtle)] last:border-0"
                                        >
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)]">
                                                <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                    {location.name}
                                                </span>
                                                {locationAddressLine(location)}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)]">
                                                {location.is_default ? (
                                                    <Badge label="Default" variant="info" />
                                                ) : (
                                                    <span className="text-[var(--lb-color-text-secondary)]">—</span>
                                                )}
                                            </td>
                                            <td className="py-[var(--lb-space-3)]">
                                                <Badge
                                                    label={locationStatusLabel(location.status)}
                                                    variant={locationStatusVariant(location.status)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Section>
            </Card>

            <CreateLocationModal
                open={showCreate}
                store={store}
                hasExistingLocations={locations.length > 0}
                onClose={() => setShowCreate(false)}
                onCreated={() => void loadLocations()}
            />
        </Page>
    )
}
