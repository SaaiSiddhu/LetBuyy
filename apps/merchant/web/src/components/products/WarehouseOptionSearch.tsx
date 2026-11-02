'use client'

import { useState } from 'react'
import { Banner, Button, Input } from '@letbuyy/ui'
import type { WarehouseOptionControls } from '@/lib/api/use-warehouse-options'

/** The selection remains explicit while a bounded, independently loaded list grows. */
export function WarehouseOptionSearch({ label, read }: { label: string; read: WarehouseOptionControls }) {
    const [search, setSearch] = useState('')
    return <div className="flex flex-col gap-[var(--lb-space-2)]">
        <Input label={`Search ${label}`} value={search} maxLength={80} onChange={event => setSearch(event.target.value)} />
        <div className="flex gap-[var(--lb-space-2)]">
            <Button variant="secondary" disabled={read.loading} onClick={() => { void read.load(true, search) }}>Search {label}</Button>
            {read.hasMore && <Button variant="secondary" disabled={read.loading} onClick={() => { void read.load(false) }}>Load more {label}</Button>}
        </div>
        {read.loading && <p role="status">Loading {label}…</p>}
        {read.error && <Banner variant="warning" title={`${label} could not be confirmed`}>Search again to reload the choices. Your form entries are retained.</Banner>}
        {!read.loading && !read.error && read.total !== null && <p>{read.total} matching {label}</p>}
    </div>
}
