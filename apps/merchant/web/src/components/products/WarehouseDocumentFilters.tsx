'use client'

import { useState } from 'react'
import { WarehousePurchaseOrderSchema, WarehouseTransferSchema } from '@letbuyy/shared-types'
import { Button, Input, Select } from '@letbuyy/ui'

type Sort = 'newest' | 'oldest'
export function WarehouseDocumentFilters({ kind, disabled, onApply }: {
    kind: 'purchase-orders' | 'transfers'; disabled: boolean;
    onApply: (search: string, status: string, sort: Sort) => void;
}) {
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [sort, setSort] = useState<Sort>('newest')
    const statuses = kind === 'purchase-orders' ? WarehousePurchaseOrderSchema.shape.status.options : WarehouseTransferSchema.shape.status.options
    return <form aria-label="Warehouse filters" className="flex flex-wrap items-end gap-[var(--lb-space-3)]" onSubmit={event => { event.preventDefault(); if (!disabled) onApply(search.trim(), status, sort) }}>
        <Input label="Document number" value={search} maxLength={80} onChange={event => setSearch(event.target.value)} />
        <Select name="warehouse-status" label="Status" value={status} onChange={event => setStatus(event.target.value)} options={[
            { value: '', label: 'All statuses' }, ...statuses.map(value => ({ value, label: value.replaceAll('_', ' ').replace(/^./, first => first.toUpperCase()) })),
        ]} />
        <Select name="warehouse-sort" label="Sort" value={sort} onChange={event => setSort(event.target.value === 'oldest' ? 'oldest' : 'newest')} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} />
        <Button type="submit" disabled={disabled}>Apply filters</Button>
        <Button type="button" variant="secondary" disabled={disabled} onClick={() => { setSearch(''); setStatus(''); setSort('newest'); onApply('', '', 'newest') }}>Clear filters</Button>
    </form>
}
