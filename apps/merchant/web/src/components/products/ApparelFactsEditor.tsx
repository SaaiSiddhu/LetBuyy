'use client'
import { Button, Input, Select, Textarea } from '@letbuyy/ui'

type Row = { size: string; chest?: number; shoulder?: number; length?: number }
type Draft = { fit: string; fabric: string; care: string; unit: 'cm' | 'in'; measurements: Row[] }

function readDraft(value: string): Draft {
    const empty: Draft = { fit: '', fabric: '', care: '', unit: 'cm', measurements: [] }
    try {
        const data: unknown = JSON.parse(value)
        if (!data || typeof data !== 'object' || Array.isArray(data)) return empty
        const row = data as Record<string, unknown>
        return { fit: typeof row.fit === 'string' ? row.fit : '', fabric: typeof row.fabric === 'string' ? row.fabric : '', care: typeof row.care === 'string' ? row.care : '', unit: row.unit === 'in' ? 'in' : 'cm', measurements: Array.isArray(row.measurements) ? row.measurements.slice(0, 30).filter((r): r is Row => Boolean(r) && typeof r === 'object' && typeof r.size === 'string') : [] }
    } catch { return empty }
}

/** Merchant facts, kept in the existing product save/conflict/recovery lifecycle. */
export function ApparelFactsEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const draft = readDraft(value)
    const update = (patch: Partial<Draft>) => onChange(JSON.stringify({ ...draft, ...patch }))
    const changeRow = (index: number, patch: Partial<Row>) => update({ measurements: draft.measurements.map((row, i) => i === index ? { ...row, ...patch } : row) })
    return <details className="rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
        <summary className="cursor-pointer font-medium">Apparel fit, fabric and care (optional)</summary>
        <div className="mt-[var(--lb-space-4)] space-y-[var(--lb-space-4)]">
            <p className="text-[var(--lb-color-text-secondary)]">Supply garment facts for the storefront. Measurements describe the garment, not the shopper’s body.</p>
            <Textarea label="Fit description" value={draft.fit} maxLength={1000} onChange={e => update({ fit: e.target.value })} />
            <Textarea label="Fabric composition" value={draft.fabric} maxLength={2000} onChange={e => update({ fabric: e.target.value })} />
            <Textarea label="Care instructions" value={draft.care} maxLength={2000} onChange={e => update({ care: e.target.value })} />
            <Select label="Measurement unit" value={draft.unit} options={[{ label: 'Centimetres (cm)', value: 'cm' }, { label: 'Inches (in)', value: 'in' }]} onChange={e => update({ unit: e.target.value === 'in' ? 'in' : 'cm' })} />
            {draft.measurements.map((row, index) => <fieldset key={index} className="space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                <legend>Garment measurements {index + 1}</legend>
                <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2">
                    <Input label="Size label" value={row.size} maxLength={40} onChange={e => changeRow(index, { size: e.target.value })} />
                    {(['chest', 'shoulder', 'length'] as const).map(key => <Input key={key} label={`${key[0].toUpperCase() + key.slice(1)} (${draft.unit})`} type="number" min="0.01" max="1000" step="0.01" value={row[key] ?? ''} onChange={e => changeRow(index, { [key]: e.target.value === '' ? undefined : Number(e.target.value) })} />)}
                </div>
                <Button variant="secondary" onClick={() => update({ measurements: draft.measurements.filter((_, i) => i !== index) })}>Remove size {row.size || index + 1}</Button>
            </fieldset>)}
            <Button variant="secondary" disabled={draft.measurements.length >= 30} onClick={() => update({ measurements: [...draft.measurements, { size: '' }] })}>Add garment size</Button>
        </div>
    </details>
}
