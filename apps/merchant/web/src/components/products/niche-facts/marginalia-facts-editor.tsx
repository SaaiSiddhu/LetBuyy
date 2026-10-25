'use client'

import React from 'react'
import { BooksFactsSchema } from '@letbuyy/commerce-core'
import { Button, InlineError, Input, Select, Textarea } from '@letbuyy/ui'
import { Plus, Trash2 } from 'lucide-react'
import type { NicheFactsEditorProps } from '../niche-facts-editor-types'

type Draft = Record<string, unknown>
const grid = 'grid gap-[var(--lb-space-3)] sm:grid-cols-2'
const stack = 'space-y-[var(--lb-space-3)]'
const muted = 'text-[var(--lb-color-text-subdued)] text-[length:var(--lb-font-size-small)]'
function record(value: unknown): Draft {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(value)).flatMap(([key, field]) =>
        'value' in field && !['__proto__', 'prototype', 'constructor'].includes(key) ? [[key, field.value]] : []))
}
const string = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
// A partial numeric edit remains a draft string until it is a complete finite number.
const numberDraft = (value: string): number | string => /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : value

/** Controlled metadata.books draft. Parent owns validation, product save, conflict and recovery. */
export function MarginaliaFactsEditor({ value, onChange, disabled = false }: NicheFactsEditorProps) {
    const id = React.useId()
    const draft = record(value)
    const present = value !== null && value !== undefined
    const kind = draft.kind === 'book' || draft.kind === 'stationery' ? draft.kind : ''
    const validation = present ? BooksFactsSchema.safeParse(value) : null
    const issues = validation && !validation.success ? validation.error.issues : []
    const error = (key: string) => issues.filter(issue => issue.path.join('.') === key).map(issue => issue.message).join(' · ') || undefined
    const emit = (next: Draft | null) => { if (!disabled) onChange(next) }
    const update = (key: string, next: unknown) => {
        const result = { ...draft }
        if (next === undefined || next === '') delete result[key]
        else result[key] = next
        emit(result)
    }
    const nested = (parent: 'dimensions_mm' | 'excerpt', key: string, next: unknown) => {
        const result = { ...record(draft[parent]) }
        if (next === undefined || next === '') delete result[key]
        else result[key] = next
        update(parent, parent === 'excerpt' || Object.keys(result).length ? result : undefined)
    }
    const focus = (target: string) => queueMicrotask(() => document.getElementById(target)?.focus())
    const textField = (key: string, label: string, maxLength: number, helperText?: string) => <Input
        id={`${id}-${key}`} label={label} value={string(draft[key])} maxLength={maxLength} disabled={disabled}
        error={error(key)} helperText={helperText} onChange={event => update(key, event.target.value)} />
    const numericField = (key: string, label: string, helperText?: string) => <Input
        id={`${id}-${key}`} label={label} value={string(draft[key])} inputMode="decimal" maxLength={16} disabled={disabled}
        error={error(key)} helperText={helperText} onChange={event => update(key, event.target.value === '' ? undefined : numberDraft(event.target.value))} />
    const arrayField = (key: 'authors' | 'subjects' | 'included', label: string, singular: string, limit: number, maxLength: number) => {
        const values = list(draft[key])
        const addId = `${id}-${key}-add`
        return <fieldset className={stack}>
            <legend className="font-medium">{label} (optional)</legend>
            {error(key) && <InlineError>{error(key)}</InlineError>}
            {values.slice(0, limit + 1).map((entry, index) => <div key={index} className="flex items-start gap-[var(--lb-space-2)]">
                <div className="min-w-0 flex-1"><Input id={`${id}-${key}-${index}`} label={`${singular} ${index + 1}`} value={string(entry)} maxLength={maxLength} disabled={disabled} error={error(`${key}.${index}`)} onChange={event => update(key, values.map((item, position) => position === index ? event.target.value : item))} /></div>
                <Button type="button" variant="ghost" disabled={disabled} aria-label={`Remove ${singular.toLowerCase()} ${index + 1}`} onClick={() => {
                    const next = values.filter((_, position) => position !== index)
                    update(key, next.length ? next : undefined)
                    focus(addId)
                }}><Trash2 size={16} aria-hidden="true" />Remove</Button>
            </div>)}
            <Button id={addId} type="button" variant="secondary" disabled={disabled || values.length >= limit} onClick={() => update(key, [...values, ''])}><Plus size={16} aria-hidden="true" />Add {singular.toLowerCase()}</Button>
        </fieldset>
    }
    const dimensions = record(draft.dimensions_mm)
    const excerpt = record(draft.excerpt)
    return <details className="rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]" open={present}>
        <summary id={`${id}-summary`} className="cursor-pointer font-medium">Books and paper facts (optional)</summary>
        <fieldset disabled={disabled} className={`mt-[var(--lb-space-4)] ${stack}`} aria-describedby={`${id}-help`}>
            <legend className="sr-only">Books and paper facts</legend>
            <p id={`${id}-help`} className={muted}>Add only facts you know. Blank optional fields stay unknown. These facts are public on the storefront.</p>
            {error('') && <InlineError>{error('')}</InlineError>}
            <Select id={`${id}-kind`} label="Product facts type" value={kind} disabled={disabled} error={error('kind')} helperText="Changing type clears the previous type’s facts." options={[{ value: '', label: 'No facts type selected' }, { value: 'book', label: 'Printed book' }, { value: 'stationery', label: 'Paper and stationery' }]} onChange={event => emit(event.target.value === 'book' || event.target.value === 'stationery' ? { kind: event.target.value } : null)} />
            {kind === 'book' && <>
                {arrayField('authors', 'Authors', 'Author', 8, 200)}
                {arrayField('subjects', 'Subjects', 'Subject', 16, 100)}
                <div className={grid}>
                    {textField('language', 'Language (optional)', 80)}
                    <Select id={`${id}-format`} label="Print format (optional)" value={string(draft.format)} disabled={disabled} error={error('format')} options={[{ value: '', label: 'Not supplied' }, { value: 'paperback', label: 'Paperback' }, { value: 'hardback', label: 'Hardback' }, { value: 'board-book', label: 'Board book' }, { value: 'spiral-bound', label: 'Spiral bound' }, { value: 'other', label: 'Other' }]} onChange={event => update('format', event.target.value)} />
                    {textField('edition', 'Edition (optional)', 200)}
                    {textField('publisher', 'Publisher (optional)', 200)}
                    {numericField('publication_year', 'Publication year (optional)')}
                    {numericField('pages', 'Printed pages (optional)')}
                </div>
                {textField('isbn', 'ISBN (optional)', 32, 'Supply a valid ISBN-10 or ISBN-13, or leave it blank.')}
            </>}
            {kind === 'stationery' && <>
                <div className={grid}>
                    {numericField('paper_gsm', 'Paper weight (gsm, optional)')}
                    <Select id={`${id}-ruling`} label="Ruling (optional)" value={string(draft.ruling)} disabled={disabled} error={error('ruling')} options={[{ value: '', label: 'Not supplied' }, { value: 'blank', label: 'Blank' }, { value: 'lined', label: 'Lined' }, { value: 'dotted', label: 'Dotted' }, { value: 'grid', label: 'Grid' }, { value: 'other', label: 'Other' }]} onChange={event => update('ruling', event.target.value)} />
                    {numericField('page_count', 'Page count (optional)', 'One sheet has two pages.')}
                    {numericField('sheet_count', 'Sheet count (optional)')}
                </div>
                {textField('binding', 'Binding (optional)', 200)}
                <Textarea id={`${id}-materials`} label="Materials (optional)" value={string(draft.materials)} maxLength={1000} disabled={disabled} error={error('materials')} onChange={event => update('materials', event.target.value)} />
                {arrayField('included', 'Included contents', 'Included item', 20, 300)}
            </>}
            {kind && <fieldset className={stack}>
                <legend className="font-medium">Print dimensions (optional)</legend>
                {error('dimensions_mm') && <InlineError>{error('dimensions_mm')}</InlineError>}
                <div className={grid}>{(['width', 'height'] as const).map(key => <Input key={key} id={`${id}-dimensions-${key}`} label={`${key === 'width' ? 'Width' : 'Height'} (mm, optional)`} value={string(dimensions[key])} inputMode="decimal" maxLength={16} disabled={disabled} error={error(`dimensions_mm.${key}`)} onChange={event => nested('dimensions_mm', key, event.target.value === '' ? undefined : numberDraft(event.target.value))} />)}</div>
                <p className={muted}>Supply both width and height in millimetres, or leave both blank.</p>
            </fieldset>}
            {kind === 'book' && <fieldset className={stack}>
                <legend className="font-medium">Reading excerpt (optional)</legend>
                {draft.excerpt !== undefined ? <>
                    {error('excerpt') && <InlineError>{error('excerpt')}</InlineError>}
                    <Textarea id={`${id}-excerpt-text`} label="Excerpt text" value={string(excerpt.text)} maxLength={12000} disabled={disabled} error={error('excerpt.text')} onChange={event => nested('excerpt', 'text', event.target.value)} />
                    <Select id={`${id}-excerpt-permission`} label="Excerpt permission" value={string(excerpt.permission)} disabled={disabled} error={error('excerpt.permission')} options={[{ value: '', label: 'Choose the permission you hold' }, { value: 'merchant_owned', label: 'Merchant owns the text' }, { value: 'licensed', label: 'Licensed for this use' }, { value: 'public_domain', label: 'Public domain' }]} onChange={event => nested('excerpt', 'permission', event.target.value)} />
                    <Input id={`${id}-excerpt-attribution`} label="Excerpt attribution" value={string(excerpt.attribution)} maxLength={500} disabled={disabled} error={error('excerpt.attribution')} onChange={event => nested('excerpt', 'attribution', event.target.value)} />
                    <Button type="button" variant="secondary" disabled={disabled} onClick={() => { update('excerpt', undefined); focus(`${id}-excerpt-add`) }}>Remove reading excerpt</Button>
                </> : <Button id={`${id}-excerpt-add`} type="button" variant="secondary" disabled={disabled} onClick={() => update('excerpt', {})}><Plus size={16} aria-hidden="true" />Add reading excerpt</Button>}
                <p className={muted}>Only add text you have permission to publish. Permission and attribution are required for an excerpt.</p>
            </fieldset>}
            {issues.length > 0 && <p role="status" className={muted}>Correct the marked facts before saving. Your draft is kept.</p>}
            <Button type="button" variant="secondary" disabled={disabled || !present} onClick={() => { emit(null); focus(`${id}-summary`) }}>Remove book and paper facts</Button>
        </fieldset>
    </details>
}
