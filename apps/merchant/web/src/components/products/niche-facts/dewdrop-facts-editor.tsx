'use client';

import React from 'react';
import { BeautyFactsSchema } from '@letbuyy/commerce-core';
import { Button, Input, Select, Textarea } from '@letbuyy/ui';
import { Plus, Trash2 } from 'lucide-react';
import type { NicheFactsEditorProps } from '../niche-facts-editor-types';

function record(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function choices(values: string[], selected: string, empty: string) {
    const distinct = [...new Set(values)];
    return [
        { value: '', label: empty },
        ...distinct.map(value => ({ value, label: value })),
        ...(selected && !distinct.includes(selected) ? [{ value: selected, label: `${selected} (not in current product options)`, disabled: true }] : []),
    ];
}

/** Controlled product-form draft. Validation never replaces incomplete merchant input. */
export function DewdropFactsEditor({ value, onChange, disabled = false, resources }: NicheFactsEditorProps) {
    const id = React.useId();
    const pendingShadeFocus = React.useRef<number | null>(null);
    const draft = record(value);
    const rows: unknown[] = Array.isArray(draft.shades) ? draft.shades : [];
    const quantity = record(draft.netQuantity);
    const optionName = text(draft.shadeOptionName) || (rows.length && draft.shadeOptionName === undefined ? 'Shade' : '');
    const options = resources?.variantOptions ?? [];
    const selectedOption = options.find(option => option.name === optionName);
    const validation = value == null ? null : BeautyFactsSchema.safeParse(value);
    const issues = validation && !validation.success
        ? validation.error.issues.map(issue => ({ path: issue.path.map(String).join('.'), message: issue.message })) : [];
    const associationIssues = resources && rows.length ? [
        ...(!selectedOption ? [{ path: 'shadeOptionName', message: 'Choose an existing product option for these shades, or remove the shade entries.' }] : []),
        ...rows.flatMap((entry, index) => selectedOption && !selectedOption.values.includes(text(record(entry).value))
            ? [{ path: `shades.${index}.value`, message: 'Choose a value from the current product option, or remove this shade.' }] : []),
    ] : [];
    const allIssues = [...issues, ...associationIssues];
    React.useEffect(() => {
        const removedIndex = pendingShadeFocus.current;
        if (removedIndex === null || disabled) return;
        pendingShadeFocus.current = null;
        const candidates = [
            ...(rows.length ? [`${id}-shade-${Math.min(removedIndex, rows.length - 1)}-value`] : []),
            `${id}-add-shade`, `${id}-shade-option`,
        ];
        const target = candidates.map(candidate => document.getElementById(candidate)).find(element => element && !element.matches(':disabled'));
        target?.focus();
    }, [rows.length, id, disabled]);
    const issueLabel = (path: string) => {
        const labels: Record<string, string> = { routineStage: 'Routine stage', format: 'Product format', netQuantity: 'Net quantity', 'netQuantity.value': 'Net quantity amount', 'netQuantity.unit': 'Net quantity unit', ingredients: 'Ingredients', directions: 'Directions', warnings: 'Warnings', shadeOptionName: 'Shade product option', shades: 'Named shades' };
        const shade = /^shades\.(\d+)(?:\.(value|code|color|ingredients))?$/.exec(path);
        return shade ? `Shade ${Number(shade[1]) + 1}${shade[2] ? ' ' + ({ value: 'name', code: 'code', color: 'RGB reference', ingredients: 'ingredients' }[shade[2] as 'value' | 'code' | 'color' | 'ingredients']) : ''}` : labels[path] ?? 'Care facts';
    };
    const error = (path: string) => allIssues.filter(issue => issue.path === path || (issue.path && path.startsWith(issue.path + '.'))).map(issue => issue.message).join(' ') || undefined;
    const emit = (next: Record<string, unknown>) => {
        if (!disabled) onChange(Object.keys(next).length ? next : null);
    };
    const update = (key: string, nextValue: unknown) => {
        const next = { ...draft };
        if (nextValue === undefined) delete next[key]; else next[key] = nextValue;
        emit(next);
    };
    const optionalText = (key: string, nextValue: string) => update(key, nextValue === '' ? undefined : nextValue);
    const updateQuantity = (key: string, nextValue: unknown) => {
        const next = { ...quantity };
        if (nextValue === undefined) delete next[key]; else next[key] = nextValue;
        update('netQuantity', Object.keys(next).length ? next : undefined);
    };
    const updateShade = (index: number, key: string, nextValue: unknown) => {
        const next = { ...record(rows[index]) };
        if (nextValue === undefined) delete next[key]; else next[key] = nextValue;
        update('shades', rows.map((row, i) => i === index ? next : row));
    };
    const removeShade = (index: number) => {
        if (disabled) return;
        pendingShadeFocus.current = index;
        const next = rows.filter((_, i) => i !== index);
        update('shades', next.length ? next : undefined);
    };
    const fieldId = (key: string) => `${id}-${key}`;

    return <details className="rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
        <summary id={fieldId('heading')} className="cursor-pointer font-medium">Care ingredients and named shades (optional){allIssues.length > 0 && <span className="text-[var(--lb-color-critical)]"> — Review {allIssues.length} {allIssues.length === 1 ? 'issue' : 'issues'}</span>}</summary>
        <fieldset disabled={disabled} aria-labelledby={fieldId('heading')} className="m-0 mt-[var(--lb-space-4)] min-w-0 space-y-[var(--lb-space-4)] border-0 p-0">
            <p id={fieldId('help')} className="text-[var(--lb-color-text-secondary)]">Add information supplied for this product. Missing ingredients, directions and warnings remain unknown.</p>
            {allIssues.length > 0 && <div id={fieldId('issues')} role="status" className="space-y-[var(--lb-space-2)] text-[var(--lb-color-critical)]">
                <p>Review the care facts before saving. Your draft is kept.</p>
                <ul className="list-disc space-y-[var(--lb-space-1)] pl-[var(--lb-space-5)]">{allIssues.map((issue, index) => <li key={`${issue.path}-${index}`}>{issueLabel(issue.path)}: {issue.message}</li>)}</ul>
            </div>}
            <div className="grid min-w-0 gap-[var(--lb-space-4)] sm:grid-cols-2">
                <Select id={fieldId('routine')} label="Routine stage" disabled={disabled} value={text(draft.routineStage)} error={error('routineStage')} options={[
                    { value: '', label: 'Not supplied' }, { value: 'cleanse', label: 'Cleanse' }, { value: 'care', label: 'Care' }, { value: 'colour', label: 'Colour' },
                    ...(!['', 'cleanse', 'care', 'colour'].includes(text(draft.routineStage)) ? [{ value: text(draft.routineStage), label: `${text(draft.routineStage)} (unsupported)`, disabled: true }] : []),
                ]} onChange={event => optionalText('routineStage', event.target.value)} />
                <Input id={fieldId('format')} label="Product format" disabled={disabled} value={text(draft.format)} maxLength={80} error={error('format')} helperText="Use the product’s format, such as gel cleanser. Leave blank if unknown." onChange={event => optionalText('format', event.target.value)} />
            </div>
            <fieldset className="min-w-0 space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                <legend className="font-medium">Net quantity (optional)</legend>
                <div className="grid min-w-0 gap-[var(--lb-space-3)] sm:grid-cols-2">
                    <Input id={fieldId('quantity')} label="Net quantity amount" type="number" inputMode="decimal" min="0" max="100000" step="any" disabled={disabled} value={typeof quantity.value === 'number' || typeof quantity.value === 'string' ? quantity.value : ''} error={error('netQuantity.value')} onChange={event => updateQuantity('value', event.target.value === '' ? undefined : Number(event.target.value))} />
                    <Select id={fieldId('unit')} label="Net quantity unit" disabled={disabled} value={text(quantity.unit)} error={error('netQuantity.unit')} options={[{ value: '', label: 'Not supplied' }, { value: 'g', label: 'Grams (g)' }, { value: 'ml', label: 'Millilitres (ml)' }, ...(!['', 'g', 'ml'].includes(text(quantity.unit)) ? [{ value: text(quantity.unit), label: `${text(quantity.unit)} (unsupported)`, disabled: true }] : [])]} onChange={event => updateQuantity('unit', event.target.value || undefined)} />
                </div>
                <Button type="button" variant="secondary" size="sm" disabled={disabled || draft.netQuantity === undefined} onClick={() => update('netQuantity', undefined)}>Clear net quantity</Button>
            </fieldset>
            <Textarea id={fieldId('ingredients')} label="Ingredients" disabled={disabled} value={text(draft.ingredients)} rows={4} maxLength={6000} error={error('ingredients')} onChange={event => optionalText('ingredients', event.target.value)} />
            <Textarea id={fieldId('directions')} label="Directions" disabled={disabled} value={text(draft.directions)} rows={3} maxLength={4000} error={error('directions')} onChange={event => optionalText('directions', event.target.value)} />
            <Textarea id={fieldId('warnings')} label="Warnings" disabled={disabled} value={text(draft.warnings)} rows={3} maxLength={4000} error={error('warnings')} onChange={event => optionalText('warnings', event.target.value)} />
            <fieldset className="min-w-0 space-y-[var(--lb-space-4)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                <legend className="font-medium">Named shade references (optional)</legend>
                <p className="text-[var(--lb-color-text-secondary)]">Choose an existing product option and its exact values. A colour reference never replaces a shade name or purchase variant. Two named shades may have the same RGB value.</p>
                <Select id={fieldId('shade-option')} label="Shade product option" disabled={disabled} value={optionName} error={error('shadeOptionName')} options={choices(options.map(option => option.name), optionName, 'Choose an existing product option')} onChange={event => update('shadeOptionName', event.target.value === '' && !rows.length ? undefined : event.target.value)} />
                {!options.length && <p className="text-[var(--lb-color-text-secondary)]">Add product variant options in the product form to choose named shades. Existing entries are kept until you change or remove them.</p>}
                {rows.map((entry, index) => {
                    const row = record(entry);
                    const name = text(row.value);
                    return <fieldset key={index} className="min-w-0 space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                        <legend className="font-medium">Shade {index + 1}{name ? ` · ${name}` : ''}</legend>
                        <Select id={fieldId(`shade-${index}-value`)} label={`Shade ${index + 1} name`} disabled={disabled || !selectedOption} value={name} error={error(`shades.${index}.value`)} options={choices(selectedOption?.values ?? [], name, 'Choose an existing shade value')} onChange={event => updateShade(index, 'value', event.target.value)} />
                        <div className="grid min-w-0 gap-[var(--lb-space-3)] sm:grid-cols-2">
                            <Input id={fieldId(`shade-${index}-code`)} label={`Shade ${index + 1} code`} disabled={disabled} value={text(row.code)} maxLength={40} error={error(`shades.${index}.code`)} onChange={event => updateShade(index, 'code', event.target.value || undefined)} />
                            <Input id={fieldId(`shade-${index}-color`)} label={`Shade ${index + 1} RGB reference`} disabled={disabled} value={text(row.color)} maxLength={7} placeholder="#RRGGBB" helperText="Optional six-digit hex value. Names keep shades distinct." error={error(`shades.${index}.color`)} onChange={event => updateShade(index, 'color', event.target.value || undefined)} />
                        </div>
                        <Textarea id={fieldId(`shade-${index}-ingredients`)} label={`Shade ${index + 1} ingredients`} disabled={disabled} value={text(row.ingredients)} rows={3} maxLength={6000} error={error(`shades.${index}.ingredients`)} onChange={event => updateShade(index, 'ingredients', event.target.value || undefined)} />
                        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => removeShade(index)}><Trash2 size={16} aria-hidden="true" />Remove shade {index + 1}</Button>
                    </fieldset>;
                })}
                <Button id={fieldId('add-shade')} type="button" variant="secondary" disabled={disabled || !selectedOption?.values.length || rows.length >= 100} onClick={() => update('shades', [...rows, { value: '' }])}><Plus size={16} aria-hidden="true" />Add named shade</Button>
            </fieldset>
            <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => { if (!disabled) onChange(null); }}>Clear all care facts</Button>
        </fieldset>
    </details>;
}
