'use client'

import { useReadRequest } from '@/lib/api/use-read-request'
import {useMerchantSecurityContext} from '@/components/security/MerchantSecurityContext'
import {useWarehouseCommands,WarehouseCommandValidationError,type WarehouseSubmit} from '@/lib/inventory/use-warehouse-commands'
import {WarehouseCommandRecovery} from '@/components/products/WarehouseCommandRecovery'
import {WarehouseLocationPageSchema} from '@letbuyy/shared-types'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
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
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
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
    submit: WarehouseSubmit
    blocked: boolean
    scope: {active:boolean}|null
    hasExistingLocations: boolean
    onClose: () => void
    onCreated: () => void
}

function CreateLocationModal({ open, submit, blocked, scope, hasExistingLocations, onClose, onCreated }: CreateLocationModalProps) {
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
        if(submitting||blocked||!scope?.active)return
        setError(null)
        setSubmitting(true)
        try {
            await submit('location.create',null,{name:name.trim(),is_default:isDefault,address:addressLine.trim(),city:addressCity.trim(),state:addressState.trim(),country:'IN',pincode:addressPincode.trim()})
            if(!scope.active)return
            notify({title:'Location created',variant:'success'})
            onCreated()
            onClose()
        }catch(error){
            if(scope.active)setError(error instanceof WarehouseCommandValidationError?error.message:'Creation could not be confirmed. Close this form and resolve the saved original request before trying again.')
        }finally{if(scope.active)setSubmitting(false)}
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
                    <Button onClick={handleSubmit} disabled={submitting||blocked}>
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
    const {actorId,siteId}=useMerchantSecurityContext(store)
    return <MetadataWorkspace key={`${actorId}:${siteId??'unavailable'}:${store}`} store={store} />
}
function MetadataWorkspace({store}:{store:string}){
    const {actorId,siteId}=useMerchantSecurityContext(store)
    const commands=useWarehouseCommands(store)
    const [page,setPage]=useState(1)
    const [population,setPopulation]=useState<{total:number;more:boolean}|null>(null)

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
        setLocations([])
        setPopulation(null)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory-locations?${new URLSearchParams({page:String(page),limit:'20',status:'all',sort:'name_asc'})}`, { headers:{'X-LetBuyy-Merchant-Context':actorId},cache: 'no-store', signal: request.signal })
            const body:unknown=await res.json()
            if (!request.isCurrent()) return
            if (!res.ok) {
                const msg = 'Failed to load locations'
                setLoadError(msg)
                return
            }
            const parsed=WarehouseLocationPageSchema.parse(body)
            if(parsed.meta.store_id!==siteId||parsed.meta.page!==page||parsed.meta.per_page!==20)throw new Error('Metadata page could not be confirmed')
            setLocations(parsed.data)
            setPopulation({total:parsed.meta.total,more:parsed.meta.has_next})
        } catch {
            if (!request.isCurrent()) return
            setLoadError('Unable to load locations — check your connection.')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginLoadLocations, store,actorId,siteId,page])

    useEffect(() => { void loadLocations() }, [loadLocations])

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Locations"
                description="Manage warehouses, stores, and fulfilment centres where inventory is held."
                breadcrumbs={[{ label: 'Inventory' }, { label: 'Locations' }]}
                primaryAction={{
                    label: 'Add location',
                    icon: <MaterialIcon name="add" />,
                    onClick: () => setShowCreate(true),
                    disabled: loading||!!loadError||commands.blocked,
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

            <WarehouseCommandRecovery commands={commands} onResolved={()=>void loadLocations()} />
            <div className="flex items-center gap-[var(--lb-space-3)]" aria-label="Warehouse pages">
                <Button variant="secondary" disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button>
                <span>{population?`${population.total} matching records · Page ${page}`:`Page ${page} · Count unavailable`}</span>
                <Button variant="secondary" disabled={loading||!population?.more} onClick={()=>setPage(p=>p+1)}>Next</Button>
            </div>
            <Card>
                <Section
                    title="Inventory locations"
                    description="Warehouses and fulfilment centres linked to this store."
                >
                    {loading ? (
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : loadError ? <p>Records are unavailable. Refresh and check your access.</p> : locations.length === 0 ? (
                        <EmptyState scene="locations"
                            title="No locations yet"
                            body="Add a warehouse or store to track inventory levels and receive purchase orders."
                            primaryAction={
                                <Button disabled={commands.blocked||loading||!!loadError} onClick={() => setShowCreate(true)}>
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
                submit={commands.submit}
                blocked={commands.blocked}
                scope={commands.scopeToken}
                hasExistingLocations={locations.length > 0}
                onClose={() => setShowCreate(false)}
                onCreated={() => void loadLocations()}
            />
        </Page>
    )
}
