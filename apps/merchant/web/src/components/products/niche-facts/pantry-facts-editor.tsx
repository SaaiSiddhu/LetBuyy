'use client'

import React from 'react'
import { FoodFactsSchema } from '@letbuyy/commerce-core'
import { Button, Input, Select, Textarea } from '@letbuyy/ui'
import type { NicheFactsEditorProps } from '../niche-facts-editor-types'

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown): string => typeof value === 'string' ? value : ''
const helpClass = 'text-[length:var(--lb-font-size-small)] text-[var(--lb-color-text-secondary)]'
const groupClass = 'min-w-0 space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]'

/** Controlled food namespace. The parent validates and saves it with the whole product intent. */
export function PantryFactsEditor({ value, onChange, disabled = false, resources }: NicheFactsEditorProps) {
    const id = React.useId()
    const draft = object(value)
    const allergens = object(draft.allergens)
    const quantity = object(draft.netQuantity)
    const hasOptions = Boolean(resources?.variantOptions?.some(option => option.values.length))
    const result = value == null ? null : FoodFactsSchema.safeParse(value)
    const issues = result && !result.success ? result.error.issues : []
    const error = (path: string) => issues.filter(issue => issue.path.join('.') === path).map(issue => issue.message).join(' ') || undefined
    const emit = (next: Record<string, unknown>) => {
        if (!disabled) onChange(Object.keys(next).length ? next : null)
    }
    const setField = (key: string, nextValue: unknown) => {
        const next = { ...draft }
        if (nextValue === undefined) delete next[key]
        else next[key] = nextValue
        emit(next)
    }
    const setText = (key: string, nextValue: string) => setField(key, nextValue === '' ? undefined : nextValue)
    const setQuantity = (key: 'value' | 'unit', nextValue: unknown) => {
        if (hasOptions) return
        const next = { ...quantity }
        if (nextValue === undefined) delete next[key]
        else next[key] = nextValue
        setField('netQuantity', Object.keys(next).length ? next : undefined)
    }
    const supplied = allergens.status === 'supplied'

    return <details className="rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
        <summary className="cursor-pointer font-medium">Food ingredients, allergens and pack facts (optional)</summary>
        <fieldset disabled={disabled} className="mt-[var(--lb-space-4)] min-w-0 space-y-[var(--lb-space-4)]" aria-describedby={`${id}-help`}>
            <legend className="sr-only">Food product facts</legend>
            <p id={`${id}-help`} className={helpClass}>Copy information you can support from the product label. Missing allergen information stays unknown; it does not mean allergen-free.</p>
            {issues.length > 0 && <div className={groupClass}>
                <p className="font-medium">Check food facts before saving.</p>
                <ul className="list-inside list-disc text-[var(--lb-color-critical)]">
                    {issues.map((issue, index) => <li key={index}>{issue.path.length ? `${issue.path.join(' / ')}: ` : ''}{issue.message}</li>)}
                </ul>
            </div>}
            <Textarea id={`${id}-ingredients`} label="Ingredients (optional)" value={text(draft.ingredients)} maxLength={6000} disabled={disabled} error={error('ingredients')} helperText="Supply the ingredient statement for this product." onChange={event => setText('ingredients', event.target.value)} />
            <fieldset className={groupClass}>
                <legend className="font-medium">Allergen information</legend>
                <Select id={`${id}-allergen-status`} label="Allergen information status" value={supplied ? 'supplied' : 'not_supplied'} disabled={disabled} error={error('allergens.status') || error('allergens')} options={[
                    { value: 'not_supplied', label: 'Not supplied — unknown' }, { value: 'supplied', label: 'Merchant-supplied statement' },
                ]} onChange={event => setField('allergens', event.target.value === 'supplied' ? { status: 'supplied', statement: '', source: '' } : undefined)} />
                {supplied && <>
                    <Textarea id={`${id}-allergen-statement`} label="Allergen statement" value={text(allergens.statement)} maxLength={4000} disabled={disabled} error={error('allergens.statement')} onChange={event => setField('allergens', { ...allergens, statement: event.target.value })} />
                    <Input id={`${id}-allergen-source`} label="Allergen statement source" value={text(allergens.source)} maxLength={1000} disabled={disabled} error={error('allergens.source')} helperText="Identify the package label or other merchant source for this statement." onChange={event => setField('allergens', { ...allergens, source: event.target.value })} />
                </>}
            </fieldset>
            <fieldset className={groupClass} aria-describedby={`${id}-quantity-help`}>
                <legend className="font-medium">Net contents per sellable pack (optional)</legend>
                <p id={`${id}-quantity-help`} className={helpClass}>{hasOptions ? 'This product has options. Enter net contents on each sellable variant using the product variant editor.' : 'Use the labelled net mass in grams or volume in millilitres. Shipping weight and number of packs are separate.'}</p>
                {!hasOptions && <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2">
                    <Input id={`${id}-net-value`} label="Net quantity" type="number" min={1} max={1000000000} step={1} value={typeof quantity.value === 'number' || typeof quantity.value === 'string' ? quantity.value : ''} disabled={disabled} error={error('netQuantity.value') || error('netQuantity')} onChange={event => setQuantity('value', event.target.value === '' ? '' : Number(event.target.value))} />
                    <Select id={`${id}-net-unit`} label="Net quantity unit" value={text(quantity.unit)} disabled={disabled} error={error('netQuantity.unit')} options={[
                        { value: '', label: 'Select a unit' }, { value: 'g', label: 'Grams (g)' }, { value: 'ml', label: 'Millilitres (ml)' },
                    ]} onChange={event => setQuantity('unit', event.target.value === '' ? undefined : event.target.value)} />
                </div>}
                {draft.netQuantity != null && <Button type="button" variant="secondary" disabled={disabled} onClick={() => setField('netQuantity', undefined)}>Clear net quantity</Button>}
            </fieldset>
            <Textarea id={`${id}-storage`} label="Storage instructions (optional)" value={text(draft.storage)} maxLength={2000} disabled={disabled} error={error('storage')} onChange={event => setText('storage', event.target.value)} />
            <Textarea id={`${id}-preparation`} label="Preparation instructions (optional)" value={text(draft.preparation)} maxLength={4000} disabled={disabled} error={error('preparation')} onChange={event => setText('preparation', event.target.value)} />
            <Textarea id={`${id}-nutrition`} label="Nutrition statement (optional)" value={text(draft.nutritionText)} maxLength={4000} disabled={disabled} error={error('nutritionText')} helperText="Supply label text without adding health or nutrition claims." onChange={event => setText('nutritionText', event.target.value)} />
            <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => { if (!disabled) onChange(null) }}>Clear all food facts</Button>
        </fieldset>
    </details>
}
