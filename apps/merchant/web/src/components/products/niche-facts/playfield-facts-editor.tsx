'use client';

import React, { useId } from 'react';
import { ToyAgeBandSchema, ToyFactsSchema } from '@letbuyy/commerce-core';
import { Button, Checkbox, Input, Select, Textarea } from '@letbuyy/ui';
import { Plus, Trash2 } from 'lucide-react';
import type { NicheFactsEditorProps } from '../niche-facts-editor-types';
import styles from './playfield-facts-editor.module.css';

type Draft = Record<string, unknown>;
const record = (value: unknown): Draft => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Draft : {};
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const numeric = (value: unknown): string | number => typeof value === 'number' || typeof value === 'string' ? value : '';
const numberInput = (value: string): number | undefined => value === '' ? undefined : Number(value);

/** Product namespace editor. The parent owns draft recovery, validation and atomic saving. */
export function PlayfieldFactsEditor({ value, onChange, disabled = false }: NicheFactsEditorProps) {
  const id = useId();
  const draft = record(value);
  const result = value == null ? null : ToyFactsSchema.safeParse(value);
  const issues = result && !result.success ? result.error.issues : [];
  const error = (...path: (string | number)[]) => issues.filter(issue => issue.path.join('.') === path.join('.')).map(issue => issue.message).join(' ') || undefined;

  const emit = (next: Draft) => { if (!disabled) onChange(Object.keys(next).length ? next : null); };
  const update = (key: string, next: unknown) => {
    const updated = { ...draft };
    if (next === undefined) delete updated[key]; else updated[key] = next;
    emit(updated);
  };
  const optionalText = (key: string, next: string) => update(key, next === '' ? undefined : next);
  const updateRow = (key: string, index: number, field: string, next: unknown) => update(key, rows(draft[key]).map((row, position) => {
    if (position !== index) return row;
    const changed = { ...record(row) };
    if (next === undefined) delete changed[field]; else changed[field] = next;
    return changed;
  }));
  const removeRow = (key: string, index: number) => {
    const remaining = rows(draft[key]).filter((_, position) => position !== index);
    update(key, remaining.length ? remaining : undefined);
  };
  const groupError = (key: string) => error(key) ? <p id={`${id}-${key}-error`} className={styles.error}>{error(key)}</p> : null;
  const ageBands = rows(draft.ageBands);

  const measurementFields = (current: unknown, prefix: string, path: (string | number)[], change: (field: string, next: unknown) => void, requiredLabel: boolean) => {
    const measured = record(current);
    const labelError = error(...path, 'label') ?? (requiredLabel && !text(measured.label) ? error(...path) : undefined);
    return <>
      <div className={styles.grid}>
        <Input id={`${id}-${prefix}-label`} label={requiredLabel ? 'Measured part label' : 'Measured object label (optional)'} value={text(measured.label)} maxLength={160} disabled={disabled} error={labelError} helperText="Identify the measured object, such as a tray or an individual tile." onChange={event => change('label', event.target.value === '' ? undefined : event.target.value)} />
        <Select id={`${id}-${prefix}-unit`} label="Measurement unit" value={text(measured.unit)} disabled={disabled} error={error(...path, 'unit')} options={[{ value: '', label: 'Choose a unit' }, { value: 'cm', label: 'Centimetres (cm)' }, { value: 'mm', label: 'Millimetres (mm)' }]} onChange={event => change('unit', event.target.value || undefined)} />
        {(['length', 'width', 'height'] as const).map(axis => <Input key={axis} id={`${id}-${prefix}-${axis}`} label={`${axis[0].toUpperCase() + axis.slice(1)} (optional)`} type="number" inputMode="decimal" min="0" max="10000" step="any" value={numeric(measured[axis])} disabled={disabled} error={error(...path, axis)} onChange={event => change(axis, numberInput(event.target.value))} />)}
      </div>
      {error(...path) && <p id={`${id}-${prefix}-error`} className={styles.error}>{error(...path)}</p>}
    </>;
  };

  return <fieldset className={styles.root} disabled={disabled} aria-describedby={`${id}-help`}>
    <legend className={styles.legend}>Toy and activity facts (optional)</legend>
    <p id={`${id}-help`} className={styles.help}>Supply product facts for the adult choosing the activity. Leave unknown facts empty. Age recommendations and warnings are merchant statements, not platform safety certifications.</p>
    {issues.length > 0 && <div className={styles.validation} role="status" aria-live="polite">
      <p>Correct these toy facts before saving. Your draft is still editable.</p>
      <ul>{issues.map((issue, index) => <li key={`${issue.path.join('.')}-${index}`}>{issue.path.length ? `${issue.path.join(' → ')}: ` : ''}{issue.message}</li>)}</ul>
    </div>}

    <fieldset className={styles.group} aria-describedby={error('ageBands') ? `${id}-ageBands-error` : undefined}>
      <legend>Age recommendations</legend>
      <div className={styles.choices}>{ToyAgeBandSchema.options.map(band => <Checkbox key={band} id={`${id}-age-${band}`} label={`${band.replace('-', '–')} years`} checked={ageBands.includes(band)} disabled={disabled} onChange={event => {
        const next = event.target.checked ? [...ageBands.filter(value => value !== band), band] : ageBands.filter(value => value !== band);
        update('ageBands', next.length ? next : undefined);
      }} />)}</div>
      {groupError('ageBands')}
      <Input id={`${id}-age-statement`} label="Supplied age statement (optional)" value={text(draft.ageStatement)} maxLength={200} disabled={disabled} error={error('ageStatement')} helperText="Use the merchant’s supplied wording. Selecting an age does not verify product safety." onChange={event => optionalText('ageStatement', event.target.value)} />
    </fieldset>

    <fieldset className={styles.group}>
      <legend>Interests and product type</legend>
      <p className={styles.help}>Use lowercase codes with hyphens, for example art or building. Only enter interests that describe this product.</p>
      {rows(draft.interests).map((interest, index) => <div key={index} className={styles.row}>
        <Input id={`${id}-interest-${index}`} label={`Interest ${index + 1}`} value={text(interest)} maxLength={40} disabled={disabled} error={error('interests', index)} onChange={event => update('interests', rows(draft.interests).map((item, position) => position === index ? event.target.value : item))} />
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('interests', index)}><Trash2 aria-hidden="true" />Remove interest {index + 1}</Button>
      </div>)}
      {groupError('interests')}
      <Button type="button" variant="secondary" disabled={disabled || rows(draft.interests).length >= 12} onClick={() => update('interests', [...rows(draft.interests), ''])}><Plus aria-hidden="true" />Add interest</Button>
      <Input id={`${id}-product-type`} label="Product type code (optional)" value={text(draft.productType)} maxLength={40} disabled={disabled} error={error('productType')} onChange={event => optionalText('productType', event.target.value)} />
    </fieldset>

    <fieldset className={styles.group}>
      <legend>Contents</legend>
      <p className={styles.help}>List supplied items and their quantities. Photographic props and illustrative examples do not count as included items.</p>
      {rows(draft.contents).map((content, index) => { const item = record(content); return <fieldset key={index} className={styles.item}>
        <legend>Contents item {index + 1}</legend>
        <div className={styles.grid}>
          <Input id={`${id}-contents-${index}-label`} label="Included item" value={text(item.label)} maxLength={120} disabled={disabled} error={error('contents', index, 'label')} onChange={event => updateRow('contents', index, 'label', event.target.value)} />
          <Input id={`${id}-contents-${index}-quantity`} label="Included quantity" type="number" min="1" max="10000" step="1" value={numeric(item.quantity)} disabled={disabled} error={error('contents', index, 'quantity')} onChange={event => updateRow('contents', index, 'quantity', numberInput(event.target.value))} />
        </div>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('contents', index)}><Trash2 aria-hidden="true" />Remove contents item {index + 1}</Button>
      </fieldset>; })}
      {groupError('contents')}
      <Button type="button" variant="secondary" disabled={disabled || rows(draft.contents).length >= 30} onClick={() => update('contents', [...rows(draft.contents), { label: '' }])}><Plus aria-hidden="true" />Add contents item</Button>
      <Checkbox id={`${id}-contents-complete`} label="This is the complete contents list supplied by the merchant" checked={draft.contentsComplete === true} disabled={disabled} error={error('contentsComplete')} onChange={event => update('contentsComplete', event.target.checked ? true : undefined)} />
    </fieldset>

    <fieldset className={styles.group}>
      <legend>Measured dimensions</legend>
      <p className={styles.help}>Enter only measured values. Keep the whole object and its individual parts distinctly labelled.</p>
      {draft.dimensions != null && <fieldset className={styles.item}>
        <legend>Primary dimensions</legend>
        {measurementFields(draft.dimensions, 'primary', ['dimensions'], (field, next) => {
          const changed = { ...record(draft.dimensions) };
          if (next === undefined) delete changed[field]; else changed[field] = next;
          update('dimensions', changed);
        }, false)}
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => update('dimensions', undefined)}><Trash2 aria-hidden="true" />Remove primary dimensions</Button>
      </fieldset>}
      {draft.dimensions == null && <Button type="button" variant="secondary" disabled={disabled} onClick={() => update('dimensions', {})}><Plus aria-hidden="true" />Add primary dimensions</Button>}
      {rows(draft.additionalDimensions).map((measured, index) => <fieldset key={index} className={styles.item}>
        <legend>Additional measured part {index + 1}</legend>
        {measurementFields(measured, `part-${index}`, ['additionalDimensions', index], (field, next) => updateRow('additionalDimensions', index, field, next), true)}
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('additionalDimensions', index)}><Trash2 aria-hidden="true" />Remove measured part {index + 1}</Button>
      </fieldset>)}
      {groupError('additionalDimensions')}
      <Button type="button" variant="secondary" disabled={disabled || rows(draft.additionalDimensions).length >= 20} onClick={() => update('additionalDimensions', [...rows(draft.additionalDimensions), {}])}><Plus aria-hidden="true" />Add measured part</Button>
    </fieldset>

    <fieldset className={styles.group}>
      <legend>Materials and care</legend>
      <Textarea id={`${id}-materials`} label="Materials (optional)" value={text(draft.materials)} maxLength={2000} disabled={disabled} error={error('materials')} onChange={event => optionalText('materials', event.target.value)} />
      <Textarea id={`${id}-finish`} label="Finish (optional)" value={text(draft.finish)} maxLength={1000} disabled={disabled} error={error('finish')} onChange={event => optionalText('finish', event.target.value)} />
      <Textarea id={`${id}-care`} label="Care instructions (optional)" value={text(draft.care)} maxLength={2000} disabled={disabled} error={error('care')} onChange={event => optionalText('care', event.target.value)} />
    </fieldset>

    <fieldset className={styles.group}>
      <legend>Supplied warnings</legend>
      <p className={styles.help}>Include the warning text and its source. Do not infer certification or safety from an age range or photograph.</p>
      {rows(draft.warnings).map((warning, index) => { const item = record(warning); return <fieldset key={index} className={styles.item}>
        <legend>Warning {index + 1}</legend>
        <Textarea id={`${id}-warning-${index}-text`} label="Warning text" value={text(item.text)} maxLength={2000} disabled={disabled} error={error('warnings', index, 'text')} onChange={event => updateRow('warnings', index, 'text', event.target.value)} />
        <div className={styles.grid}>
          <Input id={`${id}-warning-${index}-source`} label="Warning source" value={text(item.sourceLabel)} maxLength={120} disabled={disabled} error={error('warnings', index, 'sourceLabel')} onChange={event => updateRow('warnings', index, 'sourceLabel', event.target.value)} />
          <Input id={`${id}-warning-${index}-edition`} label="Warning edition label (optional)" value={text(item.editionLabel)} maxLength={120} disabled={disabled} error={error('warnings', index, 'editionLabel')} onChange={event => updateRow('warnings', index, 'editionLabel', event.target.value === '' ? undefined : event.target.value)} />
        </div>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('warnings', index)}><Trash2 aria-hidden="true" />Remove warning {index + 1}</Button>
      </fieldset>; })}
      {groupError('warnings')}
      <Button type="button" variant="secondary" disabled={disabled || rows(draft.warnings).length >= 20} onClick={() => update('warnings', [...rows(draft.warnings), { text: '', sourceLabel: '' }])}><Plus aria-hidden="true" />Add warning</Button>
    </fieldset>

    <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => { if (!disabled) onChange(null); }}><Trash2 aria-hidden="true" />Remove all toy facts</Button>
  </fieldset>;
}
