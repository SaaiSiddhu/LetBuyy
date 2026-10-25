'use client';

import React from 'react';
import { Button, Input, Select } from '@letbuyy/ui';
import { SportsVariantFactsSchema, buildProductFactPresentation } from '@letbuyy/commerce-core';
import type { NicheVariantFactsEditorProps } from '../niche-facts-editor-types';

type Draft = Record<string, unknown>;
const record = (value: unknown): Draft => value && typeof value === 'object' && !Array.isArray(value) ? value as Draft : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const numericText = (value: unknown) => typeof value === 'number' || typeof value === 'string' ? String(value) : '';
const numericDraft = (value: string): number | string => /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value)) ? Number(value) : value;
const distanceUnits = [{ value: '', label: 'Select a unit' }, { value: 'mm', label: 'Millimetres (mm)' }, { value: 'cm', label: 'Centimetres (cm)' }, { value: 'm', label: 'Metres (m)' }, { value: 'in', label: 'Inches (in)' }];
const massUnits = [{ value: '', label: 'Select a unit' }, { value: 'g', label: 'Grams (g)' }, { value: 'kg', label: 'Kilograms (kg)' }];
const panel = 'min-w-0 space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-3)]';
const grid = 'grid gap-[var(--lb-space-3)] sm:grid-cols-2';

/** One enclosing variant supplies its identity. Only measurement overrides leave this component. */
export function TrailmarkVariantFactsEditor({ value, onChange, commonFacts, disabled = false }: NicheVariantFactsEditorProps) {
    const id = React.useId();
    const present = value !== null && value !== undefined;
    const supportedShape = !present || Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const draft = record(value);
    const parsed = present ? SportsVariantFactsSchema.safeParse(value) : null;
    const issues = parsed && !parsed.success ? parsed.error.issues : [];
    const error = (path: string) => issues.filter(issue => issue.path.map(String).join('.') === path).map(issue => issue.message).join(' ') || undefined;
    // commonFacts is the raw product.sports namespace. Presentation validates it before flattening.
    const commonPresentation = buildProductFactPresentation({ facts: { sports: commonFacts } });
    const common = record(commonPresentation.sports_display);
    const invalidCommon = commonFacts !== null && commonFacts !== undefined && !commonPresentation.sports;
    const commonText = (key: string) => text(common[key]) || 'Not supplied';
    const update = (key: string, next: unknown) => {
        if (disabled) return;
        const output = { ...draft };
        if (next === undefined) delete output[key]; else output[key] = next;
        onChange(Object.keys(output).length ? output : null);
    };
    const updateMeasurement = (key: string, field: string, next: unknown) => {
        const output = { ...record(draft[key]) };
        if (next === undefined) delete output[field]; else output[field] = next;
        update(key, output);
    };

    return <section className={panel} aria-labelledby={`${id}-heading`}>
        <div className="flex flex-wrap items-start justify-between gap-[var(--lb-space-3)]">
            <h4 id={`${id}-heading`} className="font-medium">Variant equipment measurements</h4>
            {present && <Button type="button" variant="secondary" disabled={disabled} onClick={() => { if (!disabled) onChange(null); }}>Clear all measurement overrides</Button>}
        </div>
        <p className="text-[var(--lb-color-text-secondary)]">An absent measurement uses the common product value. An override supplies its own complete value and unit. Clothing sizes are separate.</p>
        {invalidCommon && <p className="text-[var(--lb-color-text-secondary)]">Common product facts are incomplete or unsupported. Check the product facts before relying on inherited measurements.</p>}
        {!supportedShape ? <p role="alert" className="text-[var(--lb-color-critical)]">Existing variant measurements have an unsupported shape. Clear the overrides to use common product values.</p>
            : <fieldset disabled={disabled} className="min-w-0 space-y-[var(--lb-space-3)]">
                <legend className="sr-only">Variant measurement overrides</legend>
                {error('') && <p role="alert" className="text-[var(--lb-color-critical)]">{error('')}</p>}
                {([{ key: 'length', displayKey: 'length', label: 'Overall length', units: distanceUnits }, { key: 'weight', displayKey: 'weight', label: 'Weight', units: massUnits }, { key: 'gripCircumference', displayKey: 'grip', label: 'Grip circumference', units: distanceUnits }] as const).map(measurement => {
                    const supplied = draft[measurement.key] !== undefined;
                    const current = record(draft[measurement.key]);
                    return <fieldset key={measurement.key} className={panel}>
                        <legend className="font-medium">{measurement.label}</legend>
                        <p className="text-[var(--lb-color-text-secondary)]">Common product {measurement.label.toLowerCase()}: {commonText(measurement.displayKey)}</p>
                        {error(measurement.key) && <p role="alert" className="text-[var(--lb-color-critical)]">{error(measurement.key)}</p>}
                        {supplied ? <>
                            <div className={grid}>
                                <Input id={`${id}-${measurement.key}-value`} label={`Variant ${measurement.label.toLowerCase()} value`} type="text" inputMode="decimal" value={numericText(current.value)} disabled={disabled} error={error(`${measurement.key}.value`)} helperText="Greater than 0; maximum 100,000." onChange={event => updateMeasurement(measurement.key, 'value', numericDraft(event.target.value))} />
                                <Select id={`${id}-${measurement.key}-unit`} label={`Variant ${measurement.label.toLowerCase()} unit`} value={text(current.unit)} options={measurement.units} disabled={disabled} error={error(`${measurement.key}.unit`)} onChange={event => updateMeasurement(measurement.key, 'unit', event.target.value)} />
                            </div>
                            <Button type="button" variant="secondary" disabled={disabled} onClick={() => update(measurement.key, undefined)}>Use common {measurement.label.toLowerCase()}</Button>
                        </> : <Button type="button" variant="secondary" disabled={disabled} onClick={() => update(measurement.key, {})}>Override {measurement.label.toLowerCase()}</Button>}
                    </fieldset>;
                })}
                <fieldset className={panel}>
                    <legend className="font-medium">Dimensions</legend>
                    <p className="text-[var(--lb-color-text-secondary)]">Common product dimensions: {commonText('dimensions')}</p>
                    {error('dimensions') && <p role="alert" className="text-[var(--lb-color-critical)]">{error('dimensions')}</p>}
                    {draft.dimensions !== undefined ? <>
                        <p className="text-[var(--lb-color-text-secondary)]">Supply length, width and unit together. Height is optional. This replaces the common dimensions as one set.</p>
                        <div className={grid}>
                            {(['length', 'width', 'height'] as const).map(key => <Input key={key} id={`${id}-dimensions-${key}`} label={`Variant dimension ${key}${key === 'height' ? ' (optional)' : ''}`} type="text" inputMode="decimal" value={numericText(record(draft.dimensions)[key])} disabled={disabled} error={error(`dimensions.${key}`)} onChange={event => updateMeasurement('dimensions', key, key === 'height' && event.target.value === '' ? undefined : numericDraft(event.target.value))} />)}
                            <Select id={`${id}-dimensions-unit`} label="Variant dimensions unit" value={text(record(draft.dimensions).unit)} options={distanceUnits} disabled={disabled} error={error('dimensions.unit')} onChange={event => updateMeasurement('dimensions', 'unit', event.target.value)} />
                        </div>
                        <Button type="button" variant="secondary" disabled={disabled} onClick={() => update('dimensions', undefined)}>Use common dimensions</Button>
                    </> : <Button type="button" variant="secondary" disabled={disabled} onClick={() => update('dimensions', {})}>Override dimensions</Button>}
                </fieldset>
            </fieldset>}
    </section>;
}
