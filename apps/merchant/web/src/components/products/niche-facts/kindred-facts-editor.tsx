'use client'

import React from 'react'
import { GiftFactsSchema, validateGiftMediaRoles } from '@letbuyy/commerce-core'
import { Button, Input, Select, Textarea } from '@letbuyy/ui'
import type { NicheFactsEditorProps } from '../niche-facts-editor-types'

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown): string => typeof value === 'string' ? value : ''
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const groupClass = 'space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]'
const columnsClass = 'grid gap-[var(--lb-space-3)] sm:grid-cols-2'
const helpClass = 'text-[length:var(--lb-font-size-small)] text-[var(--lb-color-text-secondary)]'

/** Controlled product-form draft. Canonical validation and persistence belong to the parent save. */
export function KindredFactsEditor({ value, onChange, disabled = false, resources }: NicheFactsEditorProps) {
    const id = React.useId()
    const draft = object(value)
    const result = value == null ? null : GiftFactsSchema.safeParse(value)
    const issues = result && !result.success ? result.error.issues : []
    const error = (path: string) => issues.filter(issue => issue.path.join('.') === path).map(issue => issue.message).join(' ') || undefined
    const mediaError = result?.success && resources && !validateGiftMediaRoles(result.data, resources.images)
        ? 'Image roles must refer to supplied product images.' : undefined

    const emit = (next: Record<string, unknown>) => {
        if (disabled) return
        onChange(Object.keys(next).some(key => key !== 'schemaVersion') ? next : null)
    }
    const setField = (name: string, nextValue: unknown) => {
        const next = { ...draft }
        if (nextValue === undefined) delete next[name]
        else next[name] = nextValue
        emit(next)
    }
    const setOptionalText = (name: string, nextValue: string) => setField(name, nextValue === '' ? undefined : nextValue)
    const setArray = (name: string, rows: unknown[]) => setField(name, rows.length ? rows : undefined)
    const changeContent = (index: number, name: string, nextValue: unknown) => setArray('contents', list(draft.contents).map((row, rowIndex) => {
        if (rowIndex !== index) return row
        const next = { ...object(row) }
        if (nextValue === undefined) delete next[name]
        else next[name] = nextValue
        return next
    }))
    const setRole = (role: 'openBox' | 'closedBox', nextValue: string) => {
        const roles = { ...object(draft.mediaRoles) }
        if (nextValue === '') delete roles[role]
        else roles[role] = Number(nextValue)
        setField('mediaRoles', Object.keys(roles).length ? roles : undefined)
    }
    const renderKeys = (name: 'occasions' | 'recipients', singular: string, title: string) => {
        const rows = list(draft[name])
        return <fieldset className={groupClass} aria-describedby={`${id}-${name}-help`}>
            <legend className="font-medium">{title} (optional)</legend>
            <p id={`${id}-${name}-help`} className={helpClass}>Use short lowercase keys such as {name === 'occasions' ? 'birthday or thank-you' : 'friend or colleague'}. Add only the categories that apply.</p>
            {error(name) && <p className="text-[var(--lb-color-critical)]">{error(name)}</p>}
            {rows.length === 0 && <p className={helpClass}>No {name === 'occasions' ? 'occasion' : 'recipient'} keys supplied.</p>}
            {rows.slice(0, 13).map((row, index) => <div key={index} className="flex flex-wrap items-end gap-[var(--lb-space-3)]">
                <div className="min-w-0 flex-1"><Input id={`${id}-${name}-${index}`} label={`${singular} key ${index + 1}`} value={text(row)} maxLength={40} disabled={disabled} error={error(`${name}.${index}`)} onChange={event => setArray(name, rows.map((item, rowIndex) => rowIndex === index ? event.target.value : item))} /></div>
                <Button type="button" variant="secondary" disabled={disabled} onClick={() => setArray(name, rows.filter((_, rowIndex) => rowIndex !== index))}>Remove {singular.toLowerCase()} key {index + 1}</Button>
            </div>)}
            <div className="flex flex-wrap gap-[var(--lb-space-3)]">
                <Button type="button" variant="secondary" disabled={disabled || rows.length >= 12} onClick={() => setArray(name, [...rows, ''])}>Add {singular.toLowerCase()} key</Button>
                {rows.length > 0 && <Button type="button" variant="ghost" disabled={disabled} onClick={() => setField(name, undefined)}>Clear {name === 'occasions' ? 'occasion' : 'recipient'} keys</Button>}
            </div>
        </fieldset>
    }
    const contents = list(draft.contents)
    const imageOptions = (current: unknown) => {
        const options = [{ value: '', label: 'Not supplied' }, ...(resources?.images ?? []).slice(0, 20).map((_, index) => ({ value: String(index), label: `Product image ${index + 1}` }))]
        if (typeof current === 'number' && !options.some(option => option.value === String(current))) options.push({ value: String(current), label: `Missing product image (${current + 1})` })
        return options
    }

    return <details className="rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
        <summary className="cursor-pointer font-medium">Gift contents and occasions (optional)</summary>
        <fieldset disabled={disabled} className="mt-[var(--lb-space-4)] min-w-0 space-y-[var(--lb-space-4)]" aria-describedby={`${id}-help`}>
            <legend className="sr-only">Gift product facts</legend>
            <p id={`${id}-help`} className={helpClass}>Supply facts for this ready-made product. Unknown contents stay absent. Packaging price and stock are managed in the product variants.</p>
            {(issues.length > 0 || mediaError) && <div className={groupClass} id={`${id}-errors`}>
                <p className="font-medium">Check gift facts before saving.</p>
                <ul className="list-inside list-disc text-[var(--lb-color-critical)]">
                    {issues.map((issue, index) => <li key={index}>{issue.path.length ? `${issue.path.map(part => typeof part === 'number' ? part + 1 : String(part)).join(' / ')}: ` : ''}{issue.message}</li>)}
                    {mediaError && <li>{mediaError}</li>}
                </ul>
            </div>}
            {renderKeys('occasions', 'Occasion', 'Occasion keys')}
            {renderKeys('recipients', 'Recipient', 'Recipient keys')}
            <Textarea id={`${id}-suitability`} label="Suitability note (optional)" value={text(draft.suitabilityNote)} maxLength={500} disabled={disabled} error={error('suitabilityNote')} helperText="Explain who this set may suit, using information you can support." onChange={event => setOptionalText('suitabilityNote', event.target.value)} />
            <fieldset className={groupClass}>
                <legend className="font-medium">Fixed included contents (optional)</legend>
                <p className={helpClass}>List the exact items included in one ready-made product.</p>
                {error('contents') && <p className="text-[var(--lb-color-critical)]">{error('contents')}</p>}
                {contents.length === 0 && <p className={helpClass}>No contents list supplied.</p>}
                {contents.slice(0, 31).map((item, index) => {
                    const row = object(item)
                    return <fieldset key={index} className={groupClass}>
                        <legend className="font-medium">Included item {index + 1}</legend>
                        <div className={columnsClass}>
                            <Input id={`${id}-contents-${index}-label`} label={`Item ${index + 1} name`} value={text(row.label)} maxLength={160} disabled={disabled} error={error(`contents.${index}.label`)} onChange={event => changeContent(index, 'label', event.target.value)} />
                            <Input id={`${id}-contents-${index}-quantity`} label={`Item ${index + 1} quantity`} type="number" min={1} max={100} step={1} value={typeof row.quantity === 'number' || typeof row.quantity === 'string' ? row.quantity : ''} disabled={disabled} error={error(`contents.${index}.quantity`)} onChange={event => changeContent(index, 'quantity', event.target.value === '' ? '' : Number(event.target.value))} />
                        </div>
                        <Textarea id={`${id}-contents-${index}-detail`} label={`Item ${index + 1} details (optional)`} value={text(row.detail)} maxLength={1000} disabled={disabled} error={error(`contents.${index}.detail`)} onChange={event => changeContent(index, 'detail', event.target.value === '' ? undefined : event.target.value)} />
                        <Textarea id={`${id}-contents-${index}-care`} label={`Item ${index + 1} care (optional)`} value={text(row.care)} maxLength={1000} disabled={disabled} error={error(`contents.${index}.care`)} onChange={event => changeContent(index, 'care', event.target.value === '' ? undefined : event.target.value)} />
                        <Button type="button" variant="secondary" disabled={disabled} onClick={() => setArray('contents', contents.filter((_, rowIndex) => rowIndex !== index))}>Remove included item {index + 1}</Button>
                    </fieldset>
                })}
                <div className="flex flex-wrap gap-[var(--lb-space-3)]">
                    <Button type="button" variant="secondary" disabled={disabled || contents.length >= 30} onClick={() => setArray('contents', [...contents, { label: '', quantity: '' }])}>Add included item</Button>
                    {contents.length > 0 && <Button type="button" variant="ghost" disabled={disabled} onClick={() => setField('contents', undefined)}>Clear contents list</Button>}
                </div>
            </fieldset>
            <fieldset className={groupClass} aria-describedby={`${id}-media-help${mediaError ? ` ${id}-media-error` : ''}`}>
                <legend className="font-medium">Packaging image roles (optional)</legend>
                <p id={`${id}-media-help`} className={helpClass}>Image numbers follow the product image order. Choose only photographs that show the stated view. {resources?.images.length ? '' : 'Add product images before assigning a view.'}</p>
                {mediaError && <p id={`${id}-media-error`} className="text-[var(--lb-color-critical)]">{mediaError}</p>}
                <div className={columnsClass}>
                    {(['openBox', 'closedBox'] as const).map(role => {
                        const current = object(draft.mediaRoles)[role]
                        return <Select key={role} id={`${id}-${role}`} label={role === 'openBox' ? 'Open-box product image' : 'Closed-box product image'} value={typeof current === 'number' ? String(current) : ''} options={imageOptions(current)} disabled={disabled} error={error(`mediaRoles.${role}`) || error('mediaRoles')} aria-invalid={mediaError ? true : undefined} aria-describedby={mediaError ? `${id}-media-error` : undefined} onChange={event => setRole(role, event.target.value)} />
                    })}
                </div>
            </fieldset>
            <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => { if (!disabled) onChange(null) }}>Clear all gift facts</Button>
        </fieldset>
    </details>
}
