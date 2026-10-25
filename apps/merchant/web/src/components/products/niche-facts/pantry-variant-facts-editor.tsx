'use client'

import React from 'react'
import { FoodVariantFactsSchema } from '@letbuyy/commerce-core'
import { Button, Input, Select } from '@letbuyy/ui'
import type { NicheVariantFactsEditorProps } from '../niche-facts-editor-types'

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** One controlled food namespace; identity and saving belong to the enclosing variant. */
export function PantryVariantFactsEditor({ value, onChange, disabled = false }: NicheVariantFactsEditorProps) {
    const id = React.useId()
    const draft = object(value)
    const quantity = object(draft.netQuantity)
    const result = value == null ? null : FoodVariantFactsSchema.safeParse(value)
    const issues = result && !result.success ? result.error.issues : []
    const error = (path: string) => issues.filter(issue => issue.path.join('.') === path).map(issue => issue.message).join(' ') || undefined
    const setQuantity = (key: 'value' | 'unit', nextValue: unknown) => {
        if (disabled) return
        const next = { ...quantity }
        if (nextValue === undefined) delete next[key]
        else next[key] = nextValue
        onChange({ ...draft, netQuantity: next })
    }

    return <fieldset disabled={disabled} className="min-w-0 space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]" aria-describedby={`${id}-help`}>
        <legend className="font-medium">Net contents for this variant (optional)</legend>
        <p id={`${id}-help`} className="text-[length:var(--lb-font-size-small)] text-[var(--lb-color-text-secondary)]">Supply the labelled net contents of one sellable pack. Missing contents stay unknown. Product-level net quantity does not apply to this variant; shipping weight and number of packs are separate.</p>
        {issues.length > 0 && <div>
            <p className="font-medium">Check variant net contents before saving.</p>
            <ul className="list-inside list-disc text-[var(--lb-color-critical)]">
                {issues.map((issue, index) => <li key={index}>{issue.path.length ? `${issue.path.join(' / ')}: ` : ''}{issue.message}</li>)}
            </ul>
        </div>}
        <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2">
            <Input id={`${id}-value`} label="Variant net quantity" type="number" min={1} max={1000000000} step={1} value={typeof quantity.value === 'number' || typeof quantity.value === 'string' ? quantity.value : ''} disabled={disabled} error={error('netQuantity.value') || error('netQuantity')} onChange={event => setQuantity('value', event.target.value === '' ? '' : Number(event.target.value))} />
            <Select id={`${id}-unit`} label="Variant net quantity unit" value={typeof quantity.unit === 'string' ? quantity.unit : ''} disabled={disabled} error={error('netQuantity.unit')} options={[
                { value: '', label: 'Select a unit' }, { value: 'g', label: 'Grams (g)' }, { value: 'ml', label: 'Millilitres (ml)' },
            ]} onChange={event => setQuantity('unit', event.target.value === '' ? undefined : event.target.value)} />
        </div>
        <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => { if (!disabled) onChange(null) }}>Clear variant net contents</Button>
    </fieldset>
}
