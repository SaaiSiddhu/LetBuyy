'use client';

import * as React from 'react';
import { FurnitureVariantFactsSchema, buildProductFactPresentation, readFurnitureFacts } from '@letbuyy/commerce-core';
import { Button, Input, Select, Textarea } from '@letbuyy/ui';
import type { NicheVariantFactsEditorProps } from '../niche-facts-editor-types';

// An incomplete controlled form value, not another furniture domain contract.
type DraftRecord = Record<string, unknown>;
const record = (value: unknown): DraftRecord => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as DraftRecord : {};
const textValue = (value: unknown): string => typeof value === 'string' ? value : '';
const numberValue = (value: unknown): number | string => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' ? value : '';
const lengthUnits = [{ label: 'Choose a unit', value: '' }, { label: 'Millimetres (mm)', value: 'mm' }, { label: 'Centimetres (cm)', value: 'cm' }, { label: 'Inches (in)', value: 'in' }];
const groupClass = 'space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]';
const gridClass = 'grid gap-[var(--lb-space-3)] sm:grid-cols-2';
const errorClass = 'text-[var(--lb-color-critical)] text-[length:var(--lb-font-size-caption)]';

/** Controlled override facts for one enclosing variant; canonical variant identity and saving stay in the parent. */
export function HabitatVariantFactsEditor({ value, onChange, disabled = false, commonFacts }: NicheVariantFactsEditorProps) {
    const prefix = React.useId();
    const draft = record(value);
    const parsed = FurnitureVariantFactsSchema.safeParse(value ?? {});
    const issues = parsed.success ? [] : parsed.error.issues;
    const error = (path: string) => issues.filter(issue => issue.path.map(String).join('.') === path).map(issue => issue.message).join(' ') || undefined;
    const fieldId = (path: string) => `${prefix}-variant-furniture-${path.replaceAll('.', '-')}`;
    const emit = (next: DraftRecord) => { if (!disabled) onChange(Object.keys(next).length ? next : null); };
    const change = (key: string, next: unknown) => {
        const updated = { ...draft };
        if (next === undefined) delete updated[key]; else updated[key] = next;
        emit(updated);
    };
    const groupChange = (name: string, key: string, next: unknown) => {
        const updated = { ...record(draft[name]) };
        if (next === undefined) delete updated[key]; else updated[key] = next;
        change(name, Object.keys(updated).length ? updated : undefined);
    };
    const numericChange = (name: string, key: string, raw: string) => groupChange(name, key, raw === '' ? undefined : Number(raw));
    const numericField = (group: string, key: string, label: string) => <Input
        id={fieldId(`${group}.${key}`)} label={label} type="number" max="100000" step="any" helperText="Use a positive supplied value in the selected unit."
        value={numberValue(record(draft[group])[key])} disabled={disabled} error={error(`${group}.${key}`)}
        onChange={event => numericChange(group, key, event.target.value)}
    />;
    const dimensions = (name: 'assembled' | 'package', label: string) => <fieldset className={groupClass} aria-describedby={error(name) ? fieldId(`${name}-error`) : undefined}>
        <legend className="font-medium">{label}</legend>
        <Select id={fieldId(`${name}.unit`)} label={`${label} unit`} value={textValue(record(draft[name]).unit)} options={lengthUnits}
            disabled={disabled} error={error(`${name}.unit`)} onChange={event => groupChange(name, 'unit', event.target.value || undefined)} />
        <div className={gridClass}>
            {(['width', 'depth', 'height', 'diameter'] as const).map(key => <React.Fragment key={key}>{numericField(name, key, `${label} ${key}`)}</React.Fragment>)}
        </div>
        {error(name) && <p id={fieldId(`${name}-error`)} className={errorClass} role="alert">{error(name)}</p>}
        <Button type="button" variant="secondary" disabled={disabled || draft[name] === undefined} onClick={() => change(name, undefined)}>Use product {label.toLowerCase()}</Button>
    </fieldset>;
    const materials = Array.isArray(draft.materials) ? draft.materials : [];
    const assembly = record(draft.assembly);
    const common = readFurnitureFacts({ furniture: commonFacts });
    const commonDisplay = record(buildProductFactPresentation({ facts: { furniture: common } }).furniture_display);
    const reference = [
        ['Assembled dimensions', commonDisplay.assembled], ['Package dimensions', commonDisplay.package],
        ['Seat height', commonDisplay.seat_height], ['Product weight', commonDisplay.weight],
        ['Materials', commonDisplay.materials], ['Finish', common?.finish],
        ['Assembly', commonDisplay.assembly], ['Care', commonDisplay.care],
    ].filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);


    return <details className="rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
        <summary className="cursor-pointer font-medium">Furniture facts for this variant (optional)</summary>
        <div className="mt-[var(--lb-space-4)] space-y-[var(--lb-space-4)]">
            <p className="text-[var(--lb-color-text-secondary)]">Product facts apply unless overridden here. Omit an override to use the product facts again. Supply a complete measurement group with its own unit: it replaces that whole product group, so omitted dimensions in the override stay unknown. Photographs do not establish measurements or delivery dates.</p>
            <section aria-labelledby={fieldId('product-reference')} className={groupClass}>
                <h3 id={fieldId('product-reference')} className="font-medium">Product facts (reference)</h3>
                {reference.length > 0 ? <dl className={gridClass}>{reference.map(([label, supplied]) => <div key={label} className="min-w-0 break-words"><dt className="font-medium">{label}</dt><dd>{supplied}</dd></div>)}</dl> : <p>No readable product furniture facts supplied.</p>}
            </section>
            {issues.length > 0 && <p role="status" className={errorClass}>Review variant furniture overrides before saving.{error('') ? ` ${error('')}` : ''}</p>}
            {dimensions('assembled', 'Assembled dimensions')}
            {dimensions('package', 'Package dimensions')}
            <fieldset className={groupClass} aria-describedby={error('seat_height') ? fieldId('seat-height-error') : undefined}>
                <legend className="font-medium">Seat height</legend>
                <div className={gridClass}>
                    {numericField('seat_height', 'value', 'Seat height value')}
                    <Select id={fieldId('seat_height.unit')} label="Seat height unit" value={textValue(record(draft.seat_height).unit)} options={lengthUnits}
                        disabled={disabled} error={error('seat_height.unit')} onChange={event => groupChange('seat_height', 'unit', event.target.value || undefined)} />
                </div>
                {error('seat_height') && <p id={fieldId('seat-height-error')} className={errorClass} role="alert">{error('seat_height')}</p>}
                <Button type="button" variant="secondary" disabled={disabled || draft.seat_height === undefined} onClick={() => change('seat_height', undefined)}>Use product seat height</Button>
            </fieldset>
            <fieldset className={groupClass} aria-describedby={error('weight') ? fieldId('weight-error') : undefined}>
                <legend className="font-medium">Product weight</legend>
                <div className={gridClass}>
                    {numericField('weight', 'value', 'Product weight value')}
                    <Select id={fieldId('weight.unit')} label="Product weight unit" value={textValue(record(draft.weight).unit)}
                        options={[{ label: 'Choose a unit', value: '' }, { label: 'Grams (g)', value: 'g' }, { label: 'Kilograms (kg)', value: 'kg' }]}
                        disabled={disabled} error={error('weight.unit')} onChange={event => groupChange('weight', 'unit', event.target.value || undefined)} />
                </div>
                {error('weight') && <p id={fieldId('weight-error')} className={errorClass} role="alert">{error('weight')}</p>}
                <Button type="button" variant="secondary" disabled={disabled || draft.weight === undefined} onClick={() => change('weight', undefined)}>Use product weight</Button>
            </fieldset>
            <fieldset className={groupClass} aria-describedby={error('materials') ? fieldId('materials-error') : undefined}>
                <legend className="font-medium">Materials</legend>
                <p className="text-[var(--lb-color-text-secondary)]">The supplied list replaces product materials. Remove the last override material to use product materials again.</p>
                {materials.map((material, index) => <div key={index} className="space-y-[var(--lb-space-2)]">
                    <Input id={fieldId(`materials.${index}`)} label={`Material ${index + 1}`} value={textValue(material)} maxLength={200} disabled={disabled} error={error(`materials.${index}`)}
                        onChange={event => change('materials', materials.map((row, position) => position === index ? event.target.value : row))} />
                    <Button type="button" variant="secondary" disabled={disabled} onClick={() => { const next = materials.filter((_, position) => position !== index); change('materials', next.length ? next : undefined); }}>Remove override material {index + 1}</Button>
                </div>)}
                {error('materials') && <p id={fieldId('materials-error')} className={errorClass} role="alert">{error('materials')}</p>}
                <Button type="button" variant="secondary" disabled={disabled || materials.length >= 20} onClick={() => change('materials', [...materials, ''])}>Add material</Button>
            </fieldset>
            <Input id={fieldId('finish')} label="Finish (optional)" value={textValue(draft.finish)} maxLength={200} disabled={disabled} error={error('finish')}
                onChange={event => change('finish', event.target.value === '' ? undefined : event.target.value)} />
            <fieldset className={groupClass} aria-describedby={error('assembly') ? fieldId('assembly-error') : undefined}>
                <legend className="font-medium">Assembly</legend>
                <p className="text-[var(--lb-color-text-secondary)]">A supplied assembly group replaces the product status, instructions and tools together.</p>
                <Select id={fieldId('assembly.status')} label="Assembly status" value={textValue(assembly.status)} disabled={disabled} error={error('assembly.status')}
                    options={[{ label: 'No status override', value: '' }, { label: 'Arrives assembled', value: 'assembled' }, { label: 'Assembly required', value: 'required' }, { label: 'Information not supplied', value: 'not_supplied' }]}
                    onChange={event => groupChange('assembly', 'status', event.target.value || undefined)} />
                <Textarea id={fieldId('assembly.instructions')} label="Assembly instructions (optional)" value={textValue(assembly.instructions)} rows={3} maxLength={2000} disabled={disabled} error={error('assembly.instructions')}
                    onChange={event => groupChange('assembly', 'instructions', event.target.value === '' ? undefined : event.target.value)} />
                <Input id={fieldId('assembly.tools')} label="Assembly tools (optional)" value={textValue(assembly.tools)} maxLength={500} disabled={disabled} error={error('assembly.tools')}
                    onChange={event => groupChange('assembly', 'tools', event.target.value === '' ? undefined : event.target.value)} />
                {error('assembly') && <p id={fieldId('assembly-error')} className={errorClass} role="alert">{error('assembly')}</p>}
                <Button type="button" variant="secondary" disabled={disabled || draft.assembly === undefined} onClick={() => change('assembly', undefined)}>Use product assembly facts</Button>
            </fieldset>
            <Textarea id={fieldId('care')} label="Care instructions (optional)" value={textValue(draft.care)} rows={3} maxLength={2000} disabled={disabled} error={error('care')}
                onChange={event => change('care', event.target.value === '' ? undefined : event.target.value)} />
            <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => { if (!disabled) onChange(null); }}>Use all product furniture facts</Button>
        </div>
    </details>;
}
