'use client'

import { useReadRequest } from '@/lib/api/use-read-request'
import {useMerchantSecurityContext} from '@/components/security/MerchantSecurityContext'
import {useWarehouseCommands,WarehouseCommandValidationError,type WarehouseSubmit} from '@/lib/inventory/use-warehouse-commands'
import {WarehouseCommandRecovery} from '@/components/products/WarehouseCommandRecovery'
import {WarehouseSupplierPageSchema} from '@letbuyy/shared-types'

import { useState, useEffect, useCallback } from 'react'
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
    Table,
    useToast,
    type StatusVariant,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import type { Supplier } from '@letbuyy/api-client'

// ── helpers ──────────────────────────────────────────────────────────────────

function supplierStatusVariant(status?: string | null): StatusVariant {
    switch (status) {
        case 'active': return 'success'
        case 'inactive': return 'default'
        default: return 'default'
    }
}

function supplierStatusLabel(status?: string | null): string {
    switch (status) {
        case 'active': return 'Active'
        case 'inactive': return 'Inactive'
        default: return 'Active'
    }
}

// ── CreateSupplierModal ───────────────────────────────────────────────────────

interface CreateSupplierModalProps {
    open: boolean
    submit: WarehouseSubmit
    blocked: boolean
    scope: {active:boolean}|null
    onClose: () => void
    onCreated: () => void
}

function CreateSupplierModal({ open, submit, blocked, scope, onClose, onCreated }: CreateSupplierModalProps) {
    const { notify } = useToast()
    const [name, setName] = useState('')
    const [contactName, setContactName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [addressLine, setAddressLine] = useState('')
    const [addressCity, setAddressCity] = useState('')
    const [addressState, setAddressState] = useState('')
    const [addressPincode, setAddressPincode] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            setName('')
            setContactName('')
            setEmail('')
            setPhone('')
            setAddressLine('')
            setAddressCity('')
            setAddressState('')
            setAddressPincode('')
            setError(null)
        }
    }, [open])

    async function handleSubmit() {
        if(submitting||blocked||!scope?.active)return
        setError(null)
        setSubmitting(true)
        try {
            await submit('supplier.create',null,{name:name.trim(),contact_name:contactName.trim()||undefined,email:email.trim()||undefined,phone:phone.trim()||undefined,address:{...(addressLine.trim()?{line1:addressLine.trim()}:{}),...(addressCity.trim()?{city:addressCity.trim()}:{}),...(addressState.trim()?{state:addressState.trim()}:{}),...(addressPincode.trim()?{pincode:addressPincode.trim()}:{})}})
            if(!scope.active)return
            notify({title:'Supplier created',variant:'success'})
            onCreated()
            onClose()
        }catch(error){
            if(scope.active)setError(error instanceof WarehouseCommandValidationError?error.message:'Creation could not be confirmed. Close this form and resolve the saved original request before trying again.')
        }finally{if(scope.active)setSubmitting(false)}
    }

    return (
        <Modal
            open={open}
            title="Add supplier"
            description="Add a vendor or supplier to use in purchase orders."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting||blocked}>
                        {submitting ? <Spinner size="sm" /> : null}
                        {submitting ? 'Adding…' : 'Add supplier'}
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
                    label="Supplier name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Traders"
                    required
                    autoFocus
                />

                <div className="grid grid-cols-1 gap-[var(--lb-space-3)] sm:grid-cols-2">
                    <Input
                        label="Contact name (optional)"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g. Rajesh Kumar"
                    />
                    <Input
                        label="Email (optional)"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="supplier@example.com"
                    />
                </div>

                <Input
                    label="Phone (optional)"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                />

                <div className="flex flex-col gap-[var(--lb-space-2)]">
                    <p className="text-[length:var(--lb-font-size-label)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                        Address (optional)
                    </p>
                    <Input
                        label="Street / area"
                        value={addressLine}
                        onChange={(e) => setAddressLine(e.target.value)}
                        placeholder="123, MG Road"
                    />
                    <div className="grid grid-cols-1 gap-[var(--lb-space-3)] sm:grid-cols-3">
                        <Input
                            label="City"
                            value={addressCity}
                            onChange={(e) => setAddressCity(e.target.value)}
                            placeholder="Mumbai"
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
                            placeholder="400001"
                        />
                    </div>
                </div>
            </div>
        </Modal>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
    const { store } = useParams<{ store: string }>()
    const {actorId,siteId}=useMerchantSecurityContext(store)
    return <MetadataWorkspace key={`${actorId}:${siteId??'unavailable'}:${store}`} store={store} />
}
function MetadataWorkspace({store}:{store:string}){
    const {actorId,siteId}=useMerchantSecurityContext(store)
    const commands=useWarehouseCommands(store)
    const [page,setPage]=useState(1)
    const [population,setPopulation]=useState<{total:number;more:boolean}|null>(null)

    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)

    const beginLoadSuppliers = useReadRequest(store)
    const loadSuppliers = useCallback(async () => {
        const request = beginLoadSuppliers()
        if (!store) return
        setLoading(true)
        setLoadError(null)
        setSuppliers([])
        setPopulation(null)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/suppliers?${new URLSearchParams({page:String(page),limit:'20',status:'all',sort:'name_asc'})}`, { headers:{'X-LetBuyy-Merchant-Context':actorId},cache: 'no-store', signal: request.signal })
            const body:unknown=await res.json()
            if (!request.isCurrent()) return
            if (!res.ok) {
                const msg = 'Failed to load suppliers'
                setLoadError(msg)
                return
            }
            const parsed=WarehouseSupplierPageSchema.parse(body)
            if(parsed.meta.store_id!==siteId||parsed.meta.page!==page||parsed.meta.per_page!==20)throw new Error('Metadata page could not be confirmed')
            setSuppliers(parsed.data)
            setPopulation({total:parsed.meta.total,more:parsed.meta.has_next})
        } catch {
            if (!request.isCurrent()) return
            setLoadError('Unable to load suppliers — check your connection.')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginLoadSuppliers, store,actorId,siteId,page])

    useEffect(() => { void loadSuppliers() }, [loadSuppliers])

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Suppliers"
                description="Manage your vendors and suppliers. Suppliers are linked to purchase orders for inbound inventory."
                breadcrumbs={[{ label: 'Purchasing' }, { label: 'Suppliers' }]}
                primaryAction={{
                    label: 'Add supplier',
                    icon: <MaterialIcon name="add" />,
                    onClick: () => setShowCreate(true),
                    disabled: loading||!!loadError||commands.blocked,
                }}
            />

            {loadError && (
                <Banner variant="critical" title="Failed to load suppliers">
                    {loadError}
                </Banner>
            )}

            <WarehouseCommandRecovery commands={commands} onResolved={()=>void loadSuppliers()} />
            <div className="flex items-center gap-[var(--lb-space-3)]" aria-label="Warehouse pages">
                <Button variant="secondary" disabled={loading||page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button>
                <span>{population?`${population.total} matching records · Page ${page}`:`Page ${page} · Count unavailable`}</span>
                <Button variant="secondary" disabled={loading||!population?.more} onClick={()=>setPage(p=>p+1)}>Next</Button>
            </div>
            <Card>
                <Section
                    title="Vendor list"
                    description="Suppliers linked to this store."
                >
                    {loading ? (
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : loadError ? <p>Records are unavailable. Refresh and check your access.</p> : suppliers.length === 0 ? (
                        <EmptyState scene="suppliers"
                            title="No suppliers yet"
                            body="Add a supplier to link vendors to purchase orders and track inbound inventory."
                            primaryAction={
                                <Button disabled={commands.blocked||loading||!!loadError} onClick={() => setShowCreate(true)}>
                                    Add supplier
                                </Button>
                            }
                            secondaryAction={
                                <Button variant="secondary" onClick={() => void loadSuppliers()}>
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
                                            Contact
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Email
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Phone
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((supplier) => (
                                        <tr
                                            key={supplier.id}
                                            className="border-b border-[var(--lb-color-border-subtle)] last:border-0"
                                        >
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)]">
                                                <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                    {supplier.name}
                                                </span>
                                                {supplier.address && typeof supplier.address.city === 'string' && (
                                                    <p className="mt-[var(--lb-space-0-5)] text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                        {[supplier.address.city as string, supplier.address.state as string]
                                                            .filter(Boolean)
                                                            .join(', ')}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                {supplier.contact_name ?? '—'}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                {supplier.email ? (
                                                    <a
                                                        href={`mailto:${supplier.email}`}
                                                        className="text-[var(--lb-color-interactive-primary)] underline-offset-2 hover:underline"
                                                    >
                                                        {supplier.email}
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-[var(--lb-color-text-secondary)]">
                                                {supplier.phone ?? '—'}
                                            </td>
                                            <td className="py-[var(--lb-space-3)]">
                                                <Badge
                                                    label={supplierStatusLabel(supplier.status as string | null | undefined)}
                                                    variant={supplierStatusVariant(supplier.status as string | null | undefined)}
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

            <CreateSupplierModal
                open={showCreate}
                submit={commands.submit}
                blocked={commands.blocked}
                scope={commands.scopeToken}
                onClose={() => setShowCreate(false)}
                onCreated={() => void loadSuppliers()}
            />
        </Page>
    )
}
