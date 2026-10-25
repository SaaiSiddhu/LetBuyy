'use client';

import React, { useId } from 'react';
import { ToyAgeBandSchema, ToyFactsSchema, ToyVariantFactsSchema, type ToyFacts } from '@letbuyy/commerce-core';
import { Button, Checkbox, Input, Select, Textarea } from '@letbuyy/ui';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { NicheVariantFactsEditorProps } from '../niche-facts-editor-types';
import styles from './playfield-facts-editor.module.css';
import variantStyles from './playfield-variant-facts-editor.module.css';

type Draft = Record<string, unknown>;
const record = (value: unknown): Draft => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Draft : {};
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const numeric = (value: unknown): number | string => typeof value === 'number' || typeof value === 'string' ? value : '';
const numberInput = (value: string): number | undefined => value === '' ? undefined : Number(value);
const measuredText = (measured: NonNullable<ToyFacts['dimensions']>): string => [measured.label, ...(['length', 'width', 'height'] as const).flatMap(axis => measured[axis] === undefined ? [] : [`${axis}: ${measured[axis]} ${measured.unit}`])].filter(Boolean).join(' · ');

/** Partial namespace only; variant identity and the atomic save belong to the parent. */
export function PlayfieldVariantFactsEditor({ value, onChange, disabled = false, commonFacts }: NicheVariantFactsEditorProps) {
  const id = useId();
  const draft = record(value);
  const has = (key: string) => Object.hasOwn(draft, key);
  const parsed = value == null ? null : ToyVariantFactsSchema.safeParse(value);
  const issues = parsed && !parsed.success ? parsed.error.issues : [];
  const common = commonFacts == null ? null : ToyFactsSchema.safeParse(commonFacts);
  const error = (...path: (string | number)[]) => issues.filter(issue => issue.path.join('.') === path.join('.')).map(issue => issue.message).join(' ') || undefined;
  const patch = (changes: Draft, omit: string[] = []) => {
    if (disabled) return;
    const next = { ...draft, ...changes };
    for (const key of omit) delete next[key];
    onChange(Object.keys(next).length ? next : null);
  };
  const update = (key: string, next: unknown) => next === undefined ? patch({}, [key]) : patch({ [key]: next });
  const updateRow = (key: string, index: number, field: string, next: unknown) => update(key, rows(draft[key]).map((row, position) => {
    if (position !== index) return row;
    const changed = { ...record(row) };
    if (next === undefined) delete changed[field]; else changed[field] = next;
    return changed;
  }));
  const removeRow = (key: string, index: number) => update(key, rows(draft[key]).filter((_, position) => position !== index));
  const status = (key: string, label: string) => <p className={styles.help}>{!has(key) ? `Using common ${label}.` : draft[key] === null || draft[key] === '' || (Array.isArray(draft[key]) && draft[key].length === 0) ? `Common ${label} cleared for this edition.` : `Edition ${label} supplied below.`}</p>;
  const groupError = (key: string) => error(key) ? <p id={`${id}-${key}-error`} className={styles.error}>{error(key)}</p> : null;
  const inherit = (key: string, label: string) => <Button type="button" variant="ghost" disabled={disabled || !has(key)} onClick={() => update(key, undefined)}><RotateCcw aria-hidden="true" />Use common {label}</Button>;
  const clearList = (key: string, label: string) => <Button type="button" variant="ghost" disabled={disabled} onClick={() => update(key, [])}><Trash2 aria-hidden="true" />Clear edition {label}</Button>;

  const dimensions = (current: unknown, prefix: string, path: (string | number)[], change: (key: string, next: unknown) => void, part: boolean) => {
    const measured = record(current);
    const labelError = error(...path, 'label') ?? (part && !text(measured.label) ? error(...path) : undefined);
    return <>
      <div className={styles.grid}>
        <Input id={`${id}-${prefix}-label`} label={part ? 'Edition measured part label' : 'Edition measured object label (optional)'} maxLength={160} value={text(measured.label)} disabled={disabled} error={labelError} onChange={event => change('label', event.target.value || undefined)} />
        <Select id={`${id}-${prefix}-unit`} label="Edition measurement unit" value={text(measured.unit)} disabled={disabled} error={error(...path, 'unit')} options={[{ value: '', label: 'Choose a unit' }, { value: 'cm', label: 'Centimetres (cm)' }, { value: 'mm', label: 'Millimetres (mm)' }]} onChange={event => change('unit', event.target.value || undefined)} />
        {(['length', 'width', 'height'] as const).map(axis => <Input key={axis} id={`${id}-${prefix}-${axis}`} label={`Edition ${axis} (optional)`} type="number" inputMode="decimal" min="0" max="10000" step="any" value={numeric(measured[axis])} disabled={disabled} error={error(...path, axis)} onChange={event => change(axis, numberInput(event.target.value))} />)}
      </div>
      {error(...path) && <p className={styles.error}>{error(...path)}</p>}
    </>;
  };

  const textOverride = (key: string, label: string, maxLength: number, clearable = true, multiline = true) => {
    const Field = multiline ? Textarea : Input;
    return <fieldset className={styles.group} key={key}>
      <legend>{label}</legend>
      {!clearable && has(key) && draft[key] === '' ? <p className={styles.help}>Enter an edition product type or use the common value.</p> : key === 'ageStatement' && has('ageBands') && !has(key) ? <p className={styles.help}>No edition age prose supplied. Common age prose is not inherited when edition age bands are changed.</p> : status(key, label.toLowerCase())}
      <Field id={`${id}-${key}`} label={`Edition ${label.toLowerCase()}`} value={text(draft[key])} maxLength={maxLength} disabled={disabled} error={error(key)} helperText={clearable ? 'Typing supplies this edition’s value. Empty text clears this fact; use the common action to inherit again.' : 'Use a lowercase code with hyphens. An empty code is invalid; use the common action to inherit again.'} onChange={event => update(key, event.target.value)} />
      <div className={styles.choices}>{inherit(key, label.toLowerCase())}{clearable && <Button type="button" variant="ghost" disabled={disabled} onClick={() => update(key, '')}><Trash2 aria-hidden="true" />Clear edition {label.toLowerCase()}</Button>}</div>
    </fieldset>;
  };

  return <fieldset className={`${styles.root} ${variantStyles.root}`} disabled={disabled} aria-describedby={`${id}-help`}>
    <legend className={styles.legend}>Edition toy fact overrides (optional)</legend>
    <p id={`${id}-help`} className={styles.help}>Omitted overrides use common product facts. Clear a fact only when it should be unknown for this edition. Supplied measurements and warnings describe this edition; they do not certify safety.</p>
    {issues.length > 0 && <div className={styles.validation} role="status" aria-live="polite"><p>Correct these edition facts before saving. Your partial draft is still editable.</p><ul>{issues.map((issue, index) => <li key={`${issue.path.join('.')}-${index}`}>{issue.path.length ? `${issue.path.join(' → ')}: ` : ''}{issue.message}</li>)}</ul></div>}
    {common?.success ? <details className={`${styles.item} ${variantStyles.context}`}>
      <summary>Common toy facts (read only)</summary>
      <p className={styles.help}>These values are context, not new edition overrides.</p>
      <dl>
        <dt>Age</dt><dd>{common.data.ageStatement || common.data.ageBands.join(', ') || 'Not supplied'}</dd>
        <dt>Contents</dt><dd>{common.data.contents.length ? common.data.contents.map(item => `${item.quantity} × ${item.label}`).join(' · ') : 'Not supplied'}</dd>
        <dt>Contents completeness</dt><dd>{common.data.contentsComplete ? 'Supplied as a complete list' : 'Not stated as complete'}</dd>
        <dt>Primary dimensions</dt><dd>{common.data.dimensions ? measuredText(common.data.dimensions) : 'Not supplied'}</dd>
        <dt>Measured parts</dt><dd>{common.data.additionalDimensions.length ? common.data.additionalDimensions.map(measuredText).join('; ') : 'Not supplied'}</dd>
        <dt>Materials</dt><dd>{common.data.materials || 'Not supplied'}</dd>
        <dt>Warnings and sources</dt><dd>{common.data.warnings.length ? common.data.warnings.map(warning => `${warning.text} — Source: ${warning.sourceLabel}${warning.editionLabel ? ` · ${warning.editionLabel}` : ''}`).join('; ') : 'Not supplied'}</dd>
      </dl>
    </details> : <p className={styles.help}>{common ? 'Common toy facts are not valid for this editor. No values have been copied.' : 'No common toy facts supplied. Omitted facts remain unknown.'}</p>}

    <fieldset className={styles.group} aria-describedby={error('ageBands') ? `${id}-ageBands-error` : undefined}>
      <legend>Age bands</legend>{status('ageBands', 'age bands')}
      <div className={styles.choices}>{ToyAgeBandSchema.options.map(band => <Checkbox id={`${id}-age-${band}`} key={band} label={`Edition ${band.replace('-', '–')} years`} checked={rows(draft.ageBands).includes(band)} disabled={disabled} onChange={event => update('ageBands', event.target.checked ? [...rows(draft.ageBands).filter(value => value !== band), band] : rows(draft.ageBands).filter(value => value !== band))} />)}</div>
      {groupError('ageBands')}<div className={styles.choices}>{inherit('ageBands', 'age bands')}{clearList('ageBands', 'age bands')}</div>
    </fieldset>
    {textOverride('ageStatement', 'Age statement', 200, true, false)}

    <fieldset className={styles.group}>
      <legend>Interests</legend>{status('interests', 'interests')}
      {rows(draft.interests).map((interest, index) => <div key={index} className={styles.row}>
        <Input id={`${id}-interest-${index}`} label={`Edition interest ${index + 1}`} value={text(interest)} maxLength={40} disabled={disabled} error={error('interests', index)} helperText="Use a lowercase code with hyphens." onChange={event => update('interests', rows(draft.interests).map((item, position) => position === index ? event.target.value : item))} />
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('interests', index)}><Trash2 aria-hidden="true" />Remove edition interest {index + 1}</Button>
      </div>)}
      {groupError('interests')}<Button type="button" variant="secondary" disabled={disabled || rows(draft.interests).length >= 12} onClick={() => update('interests', [...rows(draft.interests), ''])}><Plus aria-hidden="true" />Add edition interest</Button>
      <div className={styles.choices}>{inherit('interests', 'interests')}{clearList('interests', 'interests')}</div>
    </fieldset>
    {textOverride('productType', 'Product type', 40, false, false)}

    <fieldset className={styles.group}>
      <legend>Contents for this edition</legend>{status('contents', 'contents')}
      <p className={styles.help}>An edition list replaces the whole common list. If you do not mark it complete, it is treated as partial.</p>
      {rows(draft.contents).map((content, index) => { const item = record(content); return <fieldset key={index} className={styles.item}>
        <legend>Edition contents item {index + 1}</legend><div className={styles.grid}>
          <Input id={`${id}-contents-${index}-label`} label="Edition included item" value={text(item.label)} maxLength={120} disabled={disabled} error={error('contents', index, 'label')} onChange={event => updateRow('contents', index, 'label', event.target.value)} />
          <Input id={`${id}-contents-${index}-quantity`} label="Edition included quantity" type="number" min="1" max="10000" step="1" value={numeric(item.quantity)} disabled={disabled} error={error('contents', index, 'quantity')} onChange={event => updateRow('contents', index, 'quantity', numberInput(event.target.value))} />
        </div><Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('contents', index)}><Trash2 aria-hidden="true" />Remove edition contents item {index + 1}</Button>
      </fieldset>; })}
      {groupError('contents')}
      <Button type="button" variant="secondary" disabled={disabled || rows(draft.contents).length >= 30} onClick={() => update('contents', [...rows(draft.contents), { label: '' }])}><Plus aria-hidden="true" />Add edition contents item</Button>
      <p className={styles.help}>{!has('contentsComplete') ? has('contents') ? 'This replacement list is not marked complete and is treated as partial.' : 'Completeness follows the common contents list.' : draft.contentsComplete === true ? 'This edition list is marked complete.' : 'The edition list is marked partial.'}</p>
      <Checkbox id={`${id}-complete`} label="Confirm the edition contents list is complete" checked={draft.contentsComplete === true} disabled={disabled} error={error('contentsComplete')} onChange={event => update('contentsComplete', event.target.checked)} />
      <div className={styles.choices}>
        <Button type="button" variant="ghost" disabled={disabled || (!has('contents') && !has('contentsComplete'))} onClick={() => patch({}, ['contents', 'contentsComplete'])}><RotateCcw aria-hidden="true" />Use common contents and completeness</Button>
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => patch({ contents: [], contentsComplete: false })}><Trash2 aria-hidden="true" />Clear edition contents</Button>
        <Button type="button" variant="ghost" disabled={disabled || !has('contentsComplete')} onClick={() => update('contentsComplete', undefined)}><RotateCcw aria-hidden="true" />Use default list completeness</Button>
      </div>
    </fieldset>

    <fieldset className={styles.group}>
      <legend>Primary dimensions</legend>{status('dimensions', 'primary dimensions')}
      {has('dimensions') && draft.dimensions !== null && <fieldset className={styles.item}><legend>Edition primary dimensions</legend>{dimensions(draft.dimensions, 'primary', ['dimensions'], (key, next) => {
        const changed = { ...record(draft.dimensions) };if (next === undefined) delete changed[key]; else changed[key] = next;update('dimensions', changed);
      }, false)}</fieldset>}
      <div className={styles.choices}>
        <Button type="button" variant="secondary" disabled={disabled || (has('dimensions') && draft.dimensions !== null)} onClick={() => update('dimensions', {})}><Plus aria-hidden="true" />Set edition primary dimensions</Button>
        {inherit('dimensions', 'primary dimensions')}
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => update('dimensions', null)}><Trash2 aria-hidden="true" />Clear edition primary dimensions</Button>
      </div>
    </fieldset>
    <fieldset className={styles.group}>
      <legend>Additional measured parts</legend>{status('additionalDimensions', 'measured parts')}
      {rows(draft.additionalDimensions).map((part, index) => <fieldset key={index} className={styles.item}>
        <legend>Edition measured part {index + 1}</legend>
        {dimensions(part, `part-${index}`, ['additionalDimensions', index], (key, next) => updateRow('additionalDimensions', index, key, next), true)}
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('additionalDimensions', index)}><Trash2 aria-hidden="true" />Remove edition measured part {index + 1}</Button>
      </fieldset>)}
      {groupError('additionalDimensions')}<Button type="button" variant="secondary" disabled={disabled || rows(draft.additionalDimensions).length >= 20} onClick={() => update('additionalDimensions', [...rows(draft.additionalDimensions), {}])}><Plus aria-hidden="true" />Add edition measured part</Button>
      <div className={styles.choices}>{inherit('additionalDimensions', 'measured parts')}{clearList('additionalDimensions', 'measured parts')}</div>
    </fieldset>

    {textOverride('materials', 'Materials', 2000)}
    {textOverride('finish', 'Finish', 1000)}
    {textOverride('care', 'Care', 2000)}

    <fieldset className={styles.group}>
      <legend>Warnings for this edition</legend>{status('warnings', 'warnings')}
      <p className={styles.help}>Supply sourced warning text. An edition warning list replaces the whole common warning list; clear it only deliberately.</p>
      {rows(draft.warnings).map((warning, index) => { const item = record(warning); return <fieldset key={index} className={styles.item}>
        <legend>Edition warning {index + 1}</legend>
        <Textarea id={`${id}-warning-${index}`} label="Edition warning text" value={text(item.text)} maxLength={2000} disabled={disabled} error={error('warnings', index, 'text')} onChange={event => updateRow('warnings', index, 'text', event.target.value)} />
        <div className={styles.grid}>
          <Input id={`${id}-source-${index}`} label="Edition warning source" value={text(item.sourceLabel)} maxLength={120} disabled={disabled} error={error('warnings', index, 'sourceLabel')} onChange={event => updateRow('warnings', index, 'sourceLabel', event.target.value)} />
          <Input id={`${id}-edition-${index}`} label="Edition warning label (optional)" value={text(item.editionLabel)} maxLength={120} disabled={disabled} error={error('warnings', index, 'editionLabel')} onChange={event => updateRow('warnings', index, 'editionLabel', event.target.value || undefined)} />
        </div><Button type="button" variant="ghost" disabled={disabled} onClick={() => removeRow('warnings', index)}><Trash2 aria-hidden="true" />Remove edition warning {index + 1}</Button>
      </fieldset>; })}
      {groupError('warnings')}<Button type="button" variant="secondary" disabled={disabled || rows(draft.warnings).length >= 20} onClick={() => update('warnings', [...rows(draft.warnings), { text: '', sourceLabel: '' }])}><Plus aria-hidden="true" />Add edition warning</Button>
      <div className={styles.choices}>{inherit('warnings', 'warnings')}{clearList('warnings', 'warnings')}</div>
    </fieldset>
    <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => { if (!disabled) onChange(null); }}><Trash2 aria-hidden="true" />Remove all edition toy overrides</Button>
  </fieldset>;
}
