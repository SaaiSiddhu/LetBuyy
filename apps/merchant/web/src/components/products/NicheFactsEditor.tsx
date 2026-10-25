'use client'

import { useState } from 'react'
import { Banner, Button, Select } from '@letbuyy/ui'
import type { NicheFactsEditorProps } from './niche-facts-editor-types'
import { readProductFactsDraft, updateProductFactsDraft } from '@/lib/product-facts-draft'
import { PlayfieldFactsEditor } from './niche-facts/playfield-facts-editor'
import { CircuitFactsEditor } from './niche-facts/circuit-facts-editor'
import { PantryFactsEditor } from './niche-facts/pantry-facts-editor'
import { HabitatFactsEditor } from './niche-facts/habitat-facts-editor'
import { KindredFactsEditor } from './niche-facts/kindred-facts-editor'
import { MadeYoursFactsEditor } from './niche-facts/madeyours-facts-editor'
import { DewdropFactsEditor } from './niche-facts/dewdrop-facts-editor'
import { TrailmarkFactsEditor } from './niche-facts/trailmark-facts-editor'
import { MarginaliaFactsEditor } from './niche-facts/marginalia-facts-editor'

const editors = {
    toys: { label: 'Toys and activities', Component: PlayfieldFactsEditor },
    electronics: { label: 'Electronics', Component: CircuitFactsEditor },
    food: { label: 'Food and pantry', Component: PantryFactsEditor },
    furniture: { label: 'Furniture', Component: HabitatFactsEditor },
    gifts: { label: 'Ready-made gifts', Component: KindredFactsEditor },
    personalization: { label: 'Text personalization', Component: MadeYoursFactsEditor },
    beauty: { label: 'Beauty and care', Component: DewdropFactsEditor },
    sports: { label: 'Sports equipment', Component: TrailmarkFactsEditor },
    books: { label: 'Books and stationery', Component: MarginaliaFactsEditor },
} as const
type Namespace = keyof typeof editors

export function NicheFactsEditor({ value, metadata, onChange, resources, disabled = false, giftMediaIssue, onConfirmGiftMedia }: {
    value: string; metadata: unknown; onChange: (value: string) => void;
    resources: NicheFactsEditorProps['resources']; disabled?: boolean;
    giftMediaIssue?: string; onConfirmGiftMedia?: () => void;
}) {
    let draft: Record<string, unknown> = {}
    let unreadable = false
    try { draft = readProductFactsDraft(value, metadata) } catch { unreadable = true }
    const firstKnownNamespace = Object.keys(editors).find(key => Object.hasOwn(draft, key)) as Namespace | undefined
    const [explicitSelection, setSelected] = useState<Namespace | ''>('')
    const selected = explicitSelection || firstKnownNamespace || ''
    if (unreadable) return <Banner variant="critical" title="Product facts could not be read">
        <p>Other product details are kept. Reload the saved facts before continuing.</p>
        <Button type="button" disabled={disabled} onClick={() => onChange('')}>Reload saved product facts</Button>
    </Banner>
    const active = selected ? editors[selected] : null
    const Component = active?.Component
    return <section className="space-y-[var(--lb-space-4)]" aria-label="Product-specific facts">
        <p className="text-[var(--lb-color-text-secondary)]">Supply facts shoppers need to choose this product. Unsupplied information stays unknown. These facts are saved with the product.</p>
        {giftMediaIssue && <Banner variant="warning" title="Review gift image views"><p>{giftMediaIssue}</p><Button type="button" disabled={disabled} onClick={onConfirmGiftMedia}>Use the displayed gift image choices</Button></Banner>}
        <Select label="Product facts category" value={selected} disabled={disabled} placeholder="Choose product information to edit" options={Object.entries(editors).map(([value, editor]) => ({ value, label: editor.label }))} onChange={event => setSelected(event.target.value as Namespace)} />
        {Component && selected && <Component value={draft[selected]} resources={resources} disabled={disabled} onChange={next => onChange(updateProductFactsDraft(value, metadata, selected, next))} />}
    </section>
}
