'use client';

import React from 'react';
import { Button, Input, Select, Textarea } from '@letbuyy/ui';
import { SportsFactsSchema } from '@letbuyy/commerce-core';
import type { NicheFactsEditorProps } from '../niche-facts-editor-types';

// Form draft only: invalid/incomplete values stay controlled until the parent validates its save.
type Draft = Record<string, unknown>;
const record = (value: unknown): Draft => value && typeof value === 'object' && !Array.isArray(value) ? value as Draft : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const numericText = (value: unknown) => typeof value === 'number' || typeof value === 'string' ? String(value) : '';
const numericDraft = (value: string): number | string => /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number.isFinite(Number(value)) ? Number(value) : value;
const distanceUnits = [{ value: '', label: 'Select a unit' }, { value: 'mm', label: 'Millimetres (mm)' }, { value: 'cm', label: 'Centimetres (cm)' }, { value: 'm', label: 'Metres (m)' }, { value: 'in', label: 'Inches (in)' }];
const massUnits = [{ value: '', label: 'Select a unit' }, { value: 'g', label: 'Grams (g)' }, { value: 'kg', label: 'Kilograms (kg)' }];
const panel = 'space-y-[var(--lb-space-4)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]';
const grid = 'grid gap-[var(--lb-space-3)] sm:grid-cols-2';

/** Equipment metadata only. The parent owns product save, version/conflict, recovery and authorization. */
export function TrailmarkFactsEditor({ value, onChange, disabled = false }: NicheFactsEditorProps) {
    const id = React.useId();
    const enabled = value !== null && value !== undefined;
    const supportedShape = Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    const draft = record(value);
    const parsed = enabled ? SportsFactsSchema.safeParse(value) : null;
    const issues = parsed && !parsed.success ? parsed.error.issues : [];
    const error = (path: string) => issues.filter(issue => issue.path.map(String).join('.') === path).map(issue => issue.message).join(' ') || undefined;
    const update = (key: string, next: unknown) => {
        if (disabled) return;
        const output = { ...draft };
        if (next === undefined) delete output[key]; else output[key] = next;
        onChange(output);
    };
    const updateMeasurement = (key: string, field: string, next: unknown) => {
        const output = { ...record(draft[key]) };
        if (next === undefined) delete output[field]; else output[field] = next;
        update(key, output);
    };
    const contents = Array.isArray(draft.contents) ? draft.contents : [];
    const compatibility = record(draft.compatibility);
    const compatibilityStatus = text(compatibility.status);
    const clear = () => { if (!disabled) onChange(null); };

    return <section className={panel} aria-labelledby={`${id}-heading`}>
        <div className="flex flex-wrap items-start justify-between gap-[var(--lb-space-3)]">
            <div>
                <h3 id={`${id}-heading`} className="font-medium">Recreational equipment facts</h3>
                <p className="text-[var(--lb-color-text-secondary)]">Optional merchant-supplied measurements and use conditions. Clothing sizes belong in apparel facts.</p>
            </div>
            {enabled && <Button type="button" variant="secondary" disabled={disabled} onClick={clear}>Clear equipment facts</Button>}
        </div>
        {!enabled ? <Button type="button" variant="secondary" disabled={disabled} onClick={() => { if (!disabled) onChange({}); }}>Add equipment facts</Button>
            : !supportedShape ? <p role="alert" className="text-[var(--lb-color-critical)]">Existing equipment facts have an unsupported shape. Clear them to enter new facts.</p>
                : <fieldset disabled={disabled} className="min-w-0 space-y-[var(--lb-space-4)]">
                    <legend className="sr-only">Equipment details</legend>
                    {error('') && <p role="alert" className="text-[var(--lb-color-critical)]">{error('')}</p>}
                    {error('version') && <p role="alert" className="text-[var(--lb-color-critical)]">{error('version')} Clear equipment facts to replace this unsupported version.</p>}
                    <div className={grid}>
                        <Input id={`${id}-activity`} label="Activity" value={text(draft.activity)} maxLength={80} disabled={disabled} error={error('activity')} onChange={event => update('activity', event.target.value)} />
                        <Select id={`${id}-type`} label="Equipment category" value={text(draft.equipmentType)} disabled={disabled} error={error('equipmentType')} options={[{ value: '', label: 'Select equipment category' }, { value: 'racket', label: 'Racket' }, { value: 'shuttles', label: 'Shuttles' }, { value: 'storage', label: 'Storage' }, { value: 'recreational-accessory', label: 'Recreational accessory' }]} onChange={event => update('equipmentType', event.target.value)} />
                    </div>
                    <p className="text-[var(--lb-color-text-secondary)]">Leave unknown measurements absent. Add a measurement only when its value and unit are supplied. Supply common product measurements here.</p>
                    {([{ key: 'length', label: 'Overall length', units: distanceUnits }, { key: 'weight', label: 'Weight', units: massUnits }, { key: 'gripCircumference', label: 'Grip circumference', units: distanceUnits }] as const).map(measurement => {
                        const supplied = draft[measurement.key] !== undefined;
                        const current = record(draft[measurement.key]);
                        return <fieldset key={measurement.key} className={panel}>
                            <legend className="font-medium">{measurement.label}</legend>
                            {error(measurement.key) && <p role="alert" className="text-[var(--lb-color-critical)]">{error(measurement.key)}</p>}
                            {supplied ? <>
                                <div className={grid}>
                                    <Input id={`${id}-${measurement.key}-value`} label={`${measurement.label} value`} type="text" inputMode="decimal" value={numericText(current.value)} disabled={disabled} error={error(`${measurement.key}.value`)} helperText="Greater than 0; maximum 100,000." onChange={event => updateMeasurement(measurement.key, 'value', numericDraft(event.target.value))} />
                                    <Select id={`${id}-${measurement.key}-unit`} label={`${measurement.label} unit`} value={text(current.unit)} options={measurement.units} disabled={disabled} error={error(`${measurement.key}.unit`)} onChange={event => updateMeasurement(measurement.key, 'unit', event.target.value)} />
                                </div>
                                <Button type="button" variant="secondary" disabled={disabled} onClick={() => update(measurement.key, undefined)}>Clear {measurement.label.toLowerCase()}</Button>
                            </> : <Button type="button" variant="secondary" disabled={disabled} onClick={() => update(measurement.key, {})}>Add {measurement.label.toLowerCase()}</Button>}
                        </fieldset>;
                    })}
                    <fieldset className={panel}>
                        <legend className="font-medium">Dimensions</legend>
                        {error('dimensions') && <p role="alert" className="text-[var(--lb-color-critical)]">{error('dimensions')}</p>}
                        {draft.dimensions !== undefined ? <>
                            <div className={grid}>
                                {(['length', 'width', 'height'] as const).map(key => <Input key={key} id={`${id}-dimensions-${key}`} label={`Dimension ${key}${key === 'height' ? ' (optional)' : ''}`} type="text" inputMode="decimal" value={numericText(record(draft.dimensions)[key])} disabled={disabled} error={error(`dimensions.${key}`)} onChange={event => updateMeasurement('dimensions', key, key === 'height' && event.target.value === '' ? undefined : numericDraft(event.target.value))} />)}
                                <Select id={`${id}-dimensions-unit`} label="Dimensions unit" value={text(record(draft.dimensions).unit)} options={distanceUnits} disabled={disabled} error={error('dimensions.unit')} onChange={event => updateMeasurement('dimensions', 'unit', event.target.value)} />
                            </div>
                            <Button type="button" variant="secondary" disabled={disabled} onClick={() => update('dimensions', undefined)}>Clear dimensions</Button>
                        </> : <Button type="button" variant="secondary" disabled={disabled} onClick={() => update('dimensions', {})}>Add dimensions</Button>}
                    </fieldset>
                    <Textarea id={`${id}-material`} label="Material (optional)" value={text(draft.material)} maxLength={1000} disabled={disabled} error={error('material')} onChange={event => update('material', event.target.value === '' ? undefined : event.target.value)} />
                    <fieldset className={panel}>
                        <legend className="font-medium">Included contents (optional)</legend>
                        <p className="text-[var(--lb-color-text-secondary)]">Supply up to 30 included items. Leave the list absent when contents are unknown.</p>
                        {error('contents') && <p role="alert" className="text-[var(--lb-color-critical)]">{error('contents')}</p>}
                        {contents.slice(0, 30).map((item, index) => <div key={index} className="space-y-[var(--lb-space-2)]">
                            <Input id={`${id}-content-${index}`} label={`Included item ${index + 1}`} value={text(item)} maxLength={200} disabled={disabled} error={error(`contents.${index}`)} onChange={event => update('contents', contents.map((row, position) => position === index ? event.target.value : row))} />
                            <Button type="button" variant="secondary" disabled={disabled} onClick={() => { const next = contents.filter((_, position) => position !== index); update('contents', next.length ? next : undefined); }}>Remove included item {index + 1}</Button>
                        </div>)}
                        <Button type="button" variant="secondary" disabled={disabled || contents.length >= 30} onClick={() => update('contents', [...contents, ''])}>Add included item</Button>
                        {draft.contents !== undefined && <Button type="button" variant="secondary" disabled={disabled} onClick={() => update('contents', undefined)}>Clear included contents</Button>}
                    </fieldset>
                    <Textarea id={`${id}-conditions`} label="Use conditions (optional)" value={text(draft.conditions)} maxLength={2000} disabled={disabled} error={error('conditions')} onChange={event => update('conditions', event.target.value === '' ? undefined : event.target.value)} />
                    <Textarea id={`${id}-care`} label="Care instructions (optional)" value={text(draft.care)} maxLength={2000} disabled={disabled} error={error('care')} onChange={event => update('care', event.target.value === '' ? undefined : event.target.value)} />
                    <fieldset className={panel}>
                        <legend className="font-medium">Compatibility (optional)</legend>
                        {error('compatibility') && <p role="alert" className="text-[var(--lb-color-critical)]">{error('compatibility')}</p>}
                        <Select id={`${id}-compatibility-status`} label="Compatibility status" value={compatibilityStatus} disabled={disabled} error={error('compatibility.status')} options={[{ value: '', label: 'No compatibility information supplied' }, { value: 'unconfirmed', label: 'Unconfirmed' }, { value: 'merchant-supplied', label: 'Merchant-supplied reference' }]} onChange={event => update('compatibility', event.target.value === '' ? undefined : { status: event.target.value, ...(compatibility.note !== undefined ? { note: compatibility.note } : {}), ...(event.target.value === 'merchant-supplied' ? { reference: text(compatibility.reference) } : {}) })} />
                        {compatibilityStatus === 'merchant-supplied' && <Textarea id={`${id}-compatibility-reference`} label="Merchant compatibility reference" value={text(compatibility.reference)} maxLength={1000} disabled={disabled} error={error('compatibility.reference')} helperText="Supply the source or specific equipment reference. This does not establish safety certification." onChange={event => update('compatibility', { ...compatibility, reference: event.target.value })} />}
                        {compatibilityStatus && <Textarea id={`${id}-compatibility-note`} label="Compatibility note (optional)" value={text(compatibility.note)} maxLength={1000} disabled={disabled} error={error('compatibility.note')} onChange={event => { const next = { ...compatibility }; if (event.target.value === '') delete next.note; else next.note = event.target.value; update('compatibility', next); }} />}
                    </fieldset>
                </fieldset>}
    </section>;
}
