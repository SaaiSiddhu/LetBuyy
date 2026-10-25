'use client'

import React from 'react'
import { BooksVariantFactsSchema, mergeBooksVariantFacts, readBooksFacts } from '@letbuyy/commerce-core'
import { Button, InlineError, Input, Select, Textarea } from '@letbuyy/ui'
import { Plus, Trash2 } from 'lucide-react'
import type { NicheVariantFactsEditorProps } from '../niche-facts-editor-types'

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

/** Controlled override for one enclosing canonical variant. No variant identity is stored in facts. */
export function MarginaliaVariantFactsEditor({ value, onChange, disabled = false, commonFacts }: NicheVariantFactsEditorProps) {
    const id = React.useId()
    const draft = record(value)
    const present = value !== null && value !== undefined
    const kind = draft.kind === 'book' || draft.kind === 'stationery' ? draft.kind : ''
    const validation = present ? BooksVariantFactsSchema.safeParse(value) : null
    const issues = validation && !validation.success ? validation.error.issues : []
    const commonDraft = record(commonFacts)
    const commonKind = commonDraft.kind === 'book' || commonDraft.kind === 'stationery' ? commonDraft.kind : null
    const common = readBooksFacts({ books: commonFacts })
    const mismatch = Boolean(present && kind && commonKind && kind !== commonKind)
    const combinedInvalid = Boolean(validation?.success && common && !mergeBooksVariantFacts(common, validation.data))
    const kindError = mismatch ? `This variant must match the product’s ${commonKind === 'book' ? 'printed book' : 'paper and stationery'} facts type.` : undefined
    const error = (key: string) => [...issues.filter(issue => issue.path.join('.') === key).map(issue => issue.message), ...(key === 'kind' && kindError ? [kindError] : [])].join(' · ') || undefined
    const emit = (next: Draft | null) => { if (!disabled) onChange(next) }
    const update = (key: string, next: unknown) => {
        const result = { ...draft }
        if (next === undefined || next === '') delete result[key]
        else result[key] = next
        emit(result)
    }
    const updateDimension = (key: 'width' | 'height', next: unknown) => {
        const result = { ...record(draft.dimensions_mm) }
        if (next === undefined || next === '') delete result[key]
        else result[key] = next
        update('dimensions_mm', Object.keys(result).length ? result : undefined)
    }
    const focus = (target: string) => queueMicrotask(() => document.getElementById(target)?.focus())
    const textField = (key: string, label: string, maxLength: number, helperText?: string) => <Input
        id={`${id}-${key}`} label={label} value={string(draft[key])} maxLength={maxLength} disabled={disabled}
        required={key === 'language'} error={error(key)} helperText={helperText} onChange={event => update(key, event.target.value)} />
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
    return <details className="rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]" open={present}>
        <summary id={`${id}-summary`} className="cursor-pointer font-medium">Variant book and paper facts (optional)</summary>
        <fieldset disabled={disabled} className={`mt-[var(--lb-space-4)] ${stack}`} aria-describedby={`${id}-help`}>
            <legend className="sr-only">Variant book and paper facts</legend>
            <p id={`${id}-help`} className={muted}>Add only facts you know for this variant. Blank optional fields omit an override, so common product facts can still apply. Removing an override does not erase the common facts.</p>
            {error('') && <InlineError>{error('')}</InlineError>}
            <aside className={`rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)] ${stack}`} aria-labelledby={`${id}-common-title`}>
                <h4 id={`${id}-common-title`} className="font-medium">Common product facts (read only)</h4>
                {common ? <dl className={muted}>
                    <div><dt>Facts type</dt><dd>{common.kind === 'book' ? 'Printed book' : 'Paper and stationery'}</dd></div>
                    {common.kind === 'book' && <>
                        {common.authors && <div><dt>Authors</dt><dd>{common.authors.join(', ')}</dd></div>}
                        {common.language && <div><dt>Language</dt><dd>{common.language}</dd></div>}
                        {common.format && <div><dt>Print format</dt><dd>{common.format.replaceAll('-', ' ')}</dd></div>}
                        {common.pages !== undefined && <div><dt>Printed pages</dt><dd>{common.pages}</dd></div>}
                    </>}
                    {common.kind === 'stationery' && <>
                        {common.paper_gsm !== undefined && <div><dt>Paper weight</dt><dd>{common.paper_gsm} gsm</dd></div>}
                        {common.page_count !== undefined && <div><dt>Pages</dt><dd>{common.page_count}</dd></div>}
                        {common.sheet_count !== undefined && <div><dt>Sheets</dt><dd>{common.sheet_count}</dd></div>}
                    </>}
                    {common.dimensions_mm && <div><dt>Dimensions</dt><dd>{common.dimensions_mm.width} × {common.dimensions_mm.height} mm</dd></div>}
                </dl> : <p className={muted}>{commonFacts == null ? 'No common product facts supplied.' : 'Common product facts are incomplete or invalid. Check them in the product facts editor.'}</p>}
            </aside>
            <Select id={`${id}-kind`} label="Variant facts type" value={kind} disabled={disabled} error={error('kind')} helperText="Changing type clears the previous type’s facts." options={[{ value: '', label: 'No variant override' }, { value: 'book', label: 'Printed book', disabled: commonKind === 'stationery' }, { value: 'stationery', label: 'Paper and stationery', disabled: commonKind === 'book' }]} onChange={event => { const next = event.target.value; if (!next) { emit(null); focus(`${id}-summary`) } else if ((next === 'book' || next === 'stationery') && (!commonKind || next === commonKind)) emit({ kind: next }) }} />
            {combinedInvalid && !mismatch && <InlineError>Variant overrides do not form valid combined facts with the product. Check the page and sheet counts.</InlineError>}
            {kind === 'book' && <>
                {arrayField('authors', 'Authors', 'Author', 8, 200)}
                {arrayField('subjects', 'Subjects', 'Subject', 16, 100)}
                <div className={grid}>
                    {textField('language', 'Variant language (required)', 80, 'Required for this variant, even when a common language is supplied.')}
                    <Select id={`${id}-format`} label="Variant print format (required)" required value={string(draft.format)} disabled={disabled} error={error('format')} options={[{ value: '', label: 'Choose the variant format' }, { value: 'paperback', label: 'Paperback' }, { value: 'hardback', label: 'Hardback' }, { value: 'board-book', label: 'Board book' }, { value: 'spiral-bound', label: 'Spiral bound' }, { value: 'other', label: 'Other' }]} onChange={event => update('format', event.target.value)} />
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
                <div className={grid}>{(['width', 'height'] as const).map(key => <Input key={key} id={`${id}-dimensions-${key}`} label={`${key === 'width' ? 'Width' : 'Height'} (mm, optional)`} value={string(dimensions[key])} inputMode="decimal" maxLength={16} disabled={disabled} error={error(`dimensions_mm.${key}`)} onChange={event => updateDimension(key, event.target.value === '' ? undefined : numberDraft(event.target.value))} />)}</div>
                <p className={muted}>Supply both width and height in millimetres, or leave both blank.</p>
            </fieldset>}
            {(issues.length > 0 || mismatch || combinedInvalid) && <p role="status" className={muted}>Correct the marked facts before saving. Your draft is kept.</p>}
            <Button type="button" variant="secondary" disabled={disabled || !present} onClick={() => { emit(null); focus(`${id}-summary`) }}>Remove variant facts override</Button>
        </fieldset>
    </details>
}
