'use client'

import React, { useId } from 'react'
import { PersonalizationFactsSchema } from '@letbuyy/commerce-core'
import { Button, Input, Select, Textarea } from '@letbuyy/ui'
import type { NicheFactsEditorProps } from '../niche-facts-editor-types'

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const stringValue = (value: unknown): string => typeof value === 'string' ? value : ''
const numberValue = (value: unknown): number | '' => typeof value === 'number' && Number.isFinite(value) ? value : ''
const enteredNumber = (value: string): number | '' => value === '' ? '' : Number(value)
const panel = 'space-y-[var(--lb-space-4)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]'
const grid = 'grid min-w-0 gap-[var(--lb-space-3)] sm:grid-cols-2'
const muted = 'text-[length:var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]'
const idHelp = 'Use a stable ID starting with a lower-case letter, then lower-case letters, numbers, hyphens or underscores.'
function fieldName(path: PropertyKey[]): string {
  const names: Record<string, string> = { version: 'Format version', revision: 'Personalization revision', methods: 'Methods', styles: 'Styles', placements: 'Placements', id: 'ID', label: 'Label', min_graphemes: 'Minimum characters', max_graphemes: 'Maximum characters', character_set: 'Allowed characters', production_note: 'Production note' }
  const parts: string[] = []
  for (const part of path) {
    if (typeof part === 'number') {
      const group = parts.pop() || 'Row'
      parts.push(`${group === 'Methods' ? 'Method' : group === 'Styles' ? 'Style' : group === 'Placements' ? 'Placement' : group} ${part + 1}`)
    } else parts.push(names[String(part)] || 'Additional fields')
  }
  return parts.join(', ') || 'Personalization facts'
}

/** Controlled, potentially incomplete UI draft. Canonical validation remains part of the parent product save. */
export function MadeYoursFactsEditor({ value, onChange, disabled = false }: NicheFactsEditorProps) {
  const uid = useId()
  const present = value !== null && value !== undefined
  const draft = record(value)
  const methods = rows(draft.methods)
  const parsed = present ? PersonalizationFactsSchema.safeParse(value) : null
  const issues = parsed && !parsed.success ? parsed.error.issues : []
  const error = (...path: (string | number)[]) => issues.filter(issue => issue.path.length === path.length && issue.path.every((item, index) => item === path[index])).map(issue => issue.message).join(' ') || undefined
  const commit = (next: unknown | null) => { if (!disabled) onChange(next) }
  const update = (patch: Record<string, unknown>) => commit({ ...draft, ...patch })
  const updateMethod = (index: number, patch: Record<string, unknown>) => update({ methods: methods.map((method, position) => position === index ? { ...record(method), ...patch } : method) })
  const updateChoices = (methodIndex: number, kind: 'styles' | 'placements', next: unknown[]) => updateMethod(methodIndex, { [kind]: next })
  const updateChoice = (methodIndex: number, kind: 'styles' | 'placements', choiceIndex: number, patch: Record<string, unknown>) => updateChoices(methodIndex, kind, rows(record(methods[methodIndex])[kind]).map((choice, position) => position === choiceIndex ? { ...record(choice), ...patch } : choice))
  const choices = (methodIndex: number, kind: 'styles' | 'placements') => {
    const items = rows(record(methods[methodIndex])[kind])
    const singular = kind === 'styles' ? 'style' : 'placement'
    const title = kind === 'styles' ? 'Styles' : 'Placements'
    const groupId = `${uid}-method-${methodIndex}-${kind}`
    return <fieldset className="space-y-[var(--lb-space-3)]" aria-describedby={error('methods', methodIndex, kind) ? `${groupId}-error` : undefined}>
      <legend className="font-medium">{title} for method {methodIndex + 1}</legend>
      {error('methods', methodIndex, kind) && <p id={`${groupId}-error`} className="text-[var(--lb-color-critical)]">{error('methods', methodIndex, kind)}</p>}
      {items.map((choice, choiceIndex) => {
        const item = record(choice)
        const prefix = `${groupId}-${choiceIndex}`
        return <fieldset key={choiceIndex} className={panel}>
          <legend>{singular === 'style' ? 'Style' : 'Placement'} {choiceIndex + 1}</legend>
          <div className={grid}>
            <Input id={`${prefix}-id`} label={`${singular === 'style' ? 'Style' : 'Placement'} ID`} value={stringValue(item.id)} maxLength={40} helperText={idHelp} error={error('methods', methodIndex, kind, choiceIndex, 'id')} disabled={disabled} onChange={event => updateChoice(methodIndex, kind, choiceIndex, { id: event.target.value })} />
            <Input id={`${prefix}-label`} label={`${singular === 'style' ? 'Style' : 'Placement'} label`} value={stringValue(item.label)} maxLength={100} error={error('methods', methodIndex, kind, choiceIndex, 'label')} disabled={disabled} onChange={event => updateChoice(methodIndex, kind, choiceIndex, { label: event.target.value })} />
          </div>
          {error('methods', methodIndex, kind, choiceIndex) && <p className="text-[var(--lb-color-critical)]">{error('methods', methodIndex, kind, choiceIndex)}</p>}
          <Button type="button" variant="secondary" disabled={disabled} onClick={() => updateChoices(methodIndex, kind, items.filter((_, index) => index !== choiceIndex))}>Remove {singular} {choiceIndex + 1} from method {methodIndex + 1}</Button>
        </fieldset>
      })}
      <Button type="button" variant="secondary" disabled={disabled || items.length >= 8} onClick={() => updateChoices(methodIndex, kind, [...items, { id: '', label: '' }])}>Add {singular} to method {methodIndex + 1}</Button>
    </fieldset>
  }

  return <details className={panel} open>
    <summary className="cursor-pointer font-medium">Text personalization (optional)</summary>
    <p className={muted}>Define the text methods this product actually supports. Supply character limits, styles and placements; no upload or proof approval is configured here.</p>
    {!present ? <div className="space-y-[var(--lb-space-3)]">
      <p>No personalization facts supplied.</p>
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => commit({ version: 1, revision: '', methods: [] })}>Add personalization facts</Button>
    </div> : <fieldset disabled={disabled} className="min-w-0 space-y-[var(--lb-space-4)]">
      <legend className="sr-only">Product text personalization facts</legend>
      <p className={muted}>Changing a capability or stable ID requires a new revision. Keep method and choice IDs consistent with their meaning.</p>
      <Input id={`${uid}-revision`} label="Personalization revision" type="number" min={1} max={2147483647} step={1} value={numberValue(draft.revision)} error={error('revision')} disabled={disabled} onChange={event => update({ revision: enteredNumber(event.target.value) })} />
      {issues.length > 0 && <div className="space-y-[var(--lb-space-2)] text-[var(--lb-color-critical)]" role="status">
        <p>Complete or correct the personalization facts before saving the product.</p>
        <ul className="list-disc space-y-[var(--lb-space-1)] pl-[var(--lb-space-5)]">{issues.map((issue, index) => <li key={index}>{fieldName(issue.path)}: {issue.message}</li>)}</ul>
      </div>}
      {methods.map((method, methodIndex) => {
        const item = record(method)
        const prefix = `${uid}-method-${methodIndex}`
        return <fieldset key={methodIndex} className={panel}>
          <legend className="font-medium">Method {methodIndex + 1}</legend>
          <div className={grid}>
            <Input id={`${prefix}-id`} label="Method ID" value={stringValue(item.id)} maxLength={40} helperText={idHelp} error={error('methods', methodIndex, 'id')} disabled={disabled} onChange={event => updateMethod(methodIndex, { id: event.target.value })} />
            <Input id={`${prefix}-label`} label="Method label" value={stringValue(item.label)} maxLength={100} error={error('methods', methodIndex, 'label')} disabled={disabled} onChange={event => updateMethod(methodIndex, { label: event.target.value })} />
            <Input id={`${prefix}-min`} label="Minimum characters" type="number" min={1} max={80} step={1} value={numberValue(item.min_graphemes)} error={error('methods', methodIndex, 'min_graphemes')} disabled={disabled} onChange={event => updateMethod(methodIndex, { min_graphemes: enteredNumber(event.target.value) })} />
            <Input id={`${prefix}-max`} label="Maximum characters" type="number" min={1} max={80} step={1} value={numberValue(item.max_graphemes)} error={error('methods', methodIndex, 'max_graphemes')} disabled={disabled} onChange={event => updateMethod(methodIndex, { max_graphemes: enteredNumber(event.target.value) })} />
          </div>
          <Select id={`${prefix}-characters`} label="Allowed characters" value={stringValue(item.character_set)} placeholder="Choose supported characters" options={[{ value: 'latin-name', label: 'A–Z letters, spaces, apostrophes and hyphens' }, { value: 'unicode-letters', label: 'Unicode letters, spaces, apostrophes and hyphens' }]} helperText="Character limits count graphemes, including combined letters. Choose only scripts your production method supports." error={error('methods', methodIndex, 'character_set')} disabled={disabled} onChange={event => updateMethod(methodIndex, { character_set: event.target.value })} />
          {choices(methodIndex, 'styles')}
          {choices(methodIndex, 'placements')}
          {error('methods', methodIndex) && <p className="text-[var(--lb-color-critical)]">{error('methods', methodIndex)}</p>}
          <Button type="button" variant="secondary" disabled={disabled} onClick={() => update({ methods: methods.filter((_, index) => index !== methodIndex) })}>Remove method {methodIndex + 1}</Button>
        </fieldset>
      })}
      <Button type="button" variant="secondary" disabled={disabled || methods.length >= 4} onClick={() => update({ methods: [...methods, { id: '', label: '', min_graphemes: '', max_graphemes: '', character_set: '', styles: [], placements: [] }] })}>Add personalization method</Button>
      <Textarea id={`${uid}-production-note`} label="Production note (optional)" maxLength={1000} value={stringValue(draft.production_note)} helperText="Use factual production information. Leave it blank when information has not been supplied." error={error('production_note')} disabled={disabled} onChange={event => {
        if (event.target.value !== '') update({ production_note: event.target.value })
        else { const next = { ...draft }; delete next.production_note; commit(next) }
      }} />
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => commit(null)}>Clear personalization facts</Button>
    </fieldset>}
  </details>
}
