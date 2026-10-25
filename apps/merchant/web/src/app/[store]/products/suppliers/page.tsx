'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'
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
    Table,
    useToast,
    type StatusVariant,
} from '@letbuyy/ui'
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
    store: string
    onClose: () => void
    onCreated: () => void
}

function CreateSupplierModal({ open, store, onClose, onCreated }: CreateSupplierModalProps) {
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
        setError(null)
        if (!name.trim()) {
            setError('Supplier name is required.')
            return
        }

        const address: Record<string, unknown> = {}
        if (addressLine.trim()) address.line1 = addressLine.trim()
        if (addressCity.trim()) address.city = addressCity.trim()
        if (addressState.trim()) address.state = addressState.trim()
        if (addressPincode.trim()) address.pincode = addressPincode.trim()

        setSubmitting(true)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/suppliers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    contact_name: contactName.trim() || undefined,
                    email: email.trim() || undefined,
                    phone: phone.trim() || undefined,
                    address: Object.keys(address).length > 0 ? address : undefined,
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { error?: unknown }
                const msg = typeof body.error === 'string' ? body.error : 'Failed to create supplier'
                setError(msg)
                return
            }
            notify({ title: 'Supplier created', variant: 'success' })
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
            title="Add supplier"
            description="Add a vendor or supplier to use in purchase orders."
            onClose={onClose}
            footer={
                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
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
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/suppliers`, { cache: 'no-store', signal: request.signal })
            const body = await res.json() as { data?: Supplier[]; error?: unknown }
            if (!request.isCurrent()) return
            if (!res.ok) {
                const msg = typeof body.error === 'string' ? body.error : 'Failed to load suppliers'
                setLoadError(msg)
                return
            }
            setSuppliers(body.data ?? [])
        } catch {
            if (!request.isCurrent()) return
            setLoadError('Unable to load suppliers — check your connection.')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginLoadSuppliers, store])

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
                    disabled: loading,
                }}
            />

            {loadError && (
                <Banner variant="critical" title="Failed to load suppliers">
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Vendor list"
                    description="All suppliers associated with this store."
                >
                    {loading ? (
                        <div className="flex flex-col gap-[var(--lb-space-3)]">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : suppliers.length === 0 ? (
                        <EmptyState
                            title="No suppliers yet"
                            body="Add a supplier to link vendors to purchase orders and track inbound inventory."
                            primaryAction={
                                <Button onClick={() => setShowCreate(true)}>
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
                store={store}
                onClose={() => setShowCreate(false)}
                onCreated={() => void loadSuppliers()}
            />
        </Page>
    )
}
