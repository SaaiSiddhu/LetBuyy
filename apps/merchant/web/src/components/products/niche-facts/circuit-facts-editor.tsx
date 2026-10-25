'use client';

import React, { useId } from 'react';
import { ElectronicsConnectorSchema, ElectronicsFactsSchema } from '@letbuyy/commerce-core';
import { Button, Input, Select, Textarea } from '@letbuyy/ui';
import type { NicheFactsEditorProps } from '../niche-facts-editor-types';

type Draft = Record<string, unknown>;
const record = (value: unknown): Draft => value && typeof value === 'object' && !Array.isArray(value) ? value as Draft : {};
const string = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const numeric = (value: string): unknown => /^[+-]?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : value;
const box = 'space-y-[var(--lb-space-3)] rounded-lb-md border border-[var(--lb-color-border)] p-[var(--lb-space-4)]';
const grid = 'grid gap-[var(--lb-space-3)] sm:grid-cols-2';
const help = 'text-[length:var(--lb-font-size-small)] text-[var(--lb-color-text-secondary)]';
const connectorLabels: Record<string, string> = { 'usb-c': 'USB-C', 'usb-a': 'USB-A', hdmi: 'HDMI', displayport: 'DisplayPort', sd: 'SD', microsd: 'microSD', 'audio-3.5mm': '3.5 mm audio', 'ac-plug': 'AC plug', other: 'Other' };
const roleLabels: Record<string, string> = { host: 'Host connection', 'power-input': 'Power input', 'power-output': 'Power output', data: 'Data', video: 'Video', 'card-reader': 'Card reader', audio: 'Audio' };

/** Controlled draft only. The enclosing product editor owns validation, save, conflict and recovery. */
export function CircuitFactsEditor({ value, onChange, disabled = false }: NicheFactsEditorProps) {
  const id = useId(), draft = record(value), parsed = ElectronicsFactsSchema.safeParse(value ?? {});
  const issues = parsed.success ? [] : parsed.error.issues;
  const error = (path: string) => issues.filter(issue => issue.path.join('.') === path).map(issue => issue.message).join(' ') || undefined;
  const fieldId = (path: string) => `${id}-${path.replace(/[^a-z0-9-]/gi, '-')}`;
  const emit = (next: Draft | null) => { if (!disabled) onChange(next && Object.keys(next).length ? next : null); };
  const update = (key: string, next: unknown) => {
    const updated = { ...draft };
    if (next === '' || next === undefined) delete updated[key];else updated[key] = next;
    emit(updated);
  };
  const nested = (group: string, key: string, next: unknown) => {
    const updated = { ...record(draft[group]) };
    if (next === '') delete updated[key];else updated[key] = next;
    update(group, Object.keys(updated).length ? updated : undefined);
  };
  const rows = (key: string, maximum: number): unknown[] => Array.isArray(draft[key]) ? draft[key].slice(0, maximum + 1) : [];
  const changeRow = (key: string, maximum: number, index: number, patch: Draft) => update(key, rows(key, maximum).map((row, i) => i === index ? { ...record(row), ...patch } : row));
  const removeRow = (key: string, maximum: number, index: number) => {
    const next = rows(key, maximum).filter((_, i) => i !== index);update(key, next.length ? next : undefined);
  };
  const optionalText = (key: string, label: string, maximum: number) => <Input id={fieldId(key)} key={key} label={label} value={string(draft[key])} maxLength={maximum} error={error(key)} onChange={event => update(key, event.target.value)} />;
  const measurement = (key: string, label: string) => <Input id={fieldId(key)} key={key} label={label} inputMode="decimal" maxLength={32} value={string(draft[key])} error={error(key)} onChange={event => update(key, numeric(event.target.value))} />;
  const groupNumber = (group: string, key: string, label: string) => <Input id={fieldId(`${group}.${key}`)} key={key} label={label} inputMode="decimal" maxLength={32} value={string(record(draft[group])[key])} error={error(`${group}.${key}`)} onChange={event => nested(group, key, numeric(event.target.value))} />;
  const references = rows('compatible_devices', 30), connectors = rows('connectors', 20), contents = rows('box_contents', 30), requirements = rows('host_requirements', 20);

  return <fieldset disabled={disabled} className={box} aria-describedby={`${id}-help`}>
    <legend className="font-medium">Electronics specifications (optional)</legend>
    <p id={`${id}-help`} className={help}>Supply product facts from a reliable product reference. Leave unknown values empty. A matching connector alone does not establish device compatibility.</p>
    <div className={grid}>
      {optionalText('manufacturer', 'Manufacturer', 120)}
      {optionalText('model', 'Exact product model', 120)}
      <Select id={fieldId('kind')} label="Product kind" value={string(draft.kind)} error={error('kind')} options={[{ label: 'Not supplied', value: '' }, ...['hub', 'adapter', 'charger', 'cable', 'audio', 'device', 'other'].map(item => ({ value: item, label: item[0].toUpperCase() + item.slice(1) }))]} onChange={event => update('kind', event.target.value)} />
    </div>

    <fieldset className={box}><legend className="font-medium">Power, data and length</legend>
      <p className={help}>Enter watts (W), megabits per second (Mb/s) and millimetres (mm). For example, 5 Gb/s is 5000 Mb/s and 1 m is 1000 mm. Power input, output, cable capacity and laptop pass-through are separate facts.</p>
      <div className={grid}>
        {measurement('power_input_w', 'Power input maximum (W)')}
        {measurement('power_output_w', 'Power output maximum (W)')}
        {measurement('power_capacity_w', 'Cable power capacity maximum (W)')}
        {measurement('pass_through_output_w', 'Laptop pass-through maximum (W)')}
        {measurement('data_rate_mbps', 'Data transfer maximum (Mb/s)')}
        {measurement('length_mm', 'Cable length (mm)')}
      </div>
    </fieldset>

    <fieldset className={box}><legend className="font-medium">Connector roles</legend>
      <p className={help}>Count each connector kind and role once. Keep the host connection separate from the accessory ports.</p>
      {connectors.map((value, index) => { const row = record(value), prefix = `connectors.${index}`;return <fieldset className={box} key={index}>
        <legend>Connector {index + 1}</legend><div className={grid}>
          <Select id={fieldId(`${prefix}.kind`)} label={`Connector ${index + 1} kind`} value={string(row.kind)} error={error(`${prefix}.kind`)} options={[{ value: '', label: 'Choose connector' }, ...ElectronicsConnectorSchema.shape.kind.options.map(item => ({ value: item, label: connectorLabels[item] }))]} onChange={event => changeRow('connectors', 20, index, { kind: event.target.value })} />
          <Select id={fieldId(`${prefix}.role`)} label={`Connector ${index + 1} role`} value={string(row.role)} error={error(`${prefix}.role`)} options={[{ value: '', label: 'Choose role' }, ...ElectronicsConnectorSchema.shape.role.options.map(item => ({ value: item, label: roleLabels[item] }))]} onChange={event => changeRow('connectors', 20, index, { role: event.target.value })} />
          <Input id={fieldId(`${prefix}.count`)} label={`Connector ${index + 1} count`} inputMode="numeric" value={string(row.count)} error={error(`${prefix}.count`)} onChange={event => changeRow('connectors', 20, index, { count: numeric(event.target.value) })} />
        </div><Button type="button" variant="secondary" onClick={() => removeRow('connectors', 20, index)}>Remove connector {index + 1}</Button>
      </fieldset>; })}
      <Button type="button" variant="secondary" disabled={disabled || connectors.length >= 20} onClick={() => update('connectors', [...connectors, { kind: '', role: '', count: '' }])}>Add connector</Button>
    </fieldset>

    <fieldset className={box}><legend className="font-medium">Video output maximum</legend>
      <p className={help}>Supply all three values only when video output is documented. Do not infer video support from USB-C.</p>
      <div className={grid}>{groupNumber('video', 'width_px', 'Video width (px)')}{groupNumber('video', 'height_px', 'Video height (px)')}{groupNumber('video', 'refresh_hz', 'Video refresh rate (Hz)')}</div>
      <Button type="button" variant="secondary" disabled={disabled || draft.video === undefined} onClick={() => update('video', undefined)}>Clear video specification</Button>
    </fieldset>
    <fieldset className={box}><legend className="font-medium">Product dimensions</legend>
      <div className={grid}>{groupNumber('dimensions_mm', 'length', 'Product length (mm)')}{groupNumber('dimensions_mm', 'width', 'Product width (mm)')}{groupNumber('dimensions_mm', 'height', 'Product height (mm)')}</div>
      <Button type="button" variant="secondary" disabled={disabled || draft.dimensions_mm === undefined} onClick={() => update('dimensions_mm', undefined)}>Clear product dimensions</Button>
    </fieldset>

    <fieldset className={box}><legend className="font-medium">Host requirements</legend>
      {requirements.map((row, index) => <div className={box} key={index}>
        <Textarea id={fieldId(`host_requirements.${index}`)} label={`Host requirement ${index + 1}`} maxLength={500} rows={2} value={string(row)} error={error(`host_requirements.${index}`)} onChange={event => update('host_requirements', requirements.map((item, i) => i === index ? event.target.value : item))} />
        <Button type="button" variant="secondary" onClick={() => removeRow('host_requirements', 20, index)}>Remove requirement {index + 1}</Button>
      </div>)}
      <Button type="button" variant="secondary" disabled={disabled || requirements.length >= 20} onClick={() => update('host_requirements', [...requirements, ''])}>Add host requirement</Button>
    </fieldset>
    <fieldset className={box}><legend className="font-medium">Box contents</legend>
      {contents.map((value, index) => { const row = record(value);return <fieldset className={box} key={index}>
        <legend>Included item {index + 1}</legend><div className={grid}>
          <Input id={fieldId(`box_contents.${index}.label`)} label={`Included item ${index + 1} label`} maxLength={200} value={string(row.label)} error={error(`box_contents.${index}.label`)} onChange={event => changeRow('box_contents', 30, index, { label: event.target.value })} />
          <Input id={fieldId(`box_contents.${index}.quantity`)} label={`Included item ${index + 1} quantity`} inputMode="numeric" value={string(row.quantity)} error={error(`box_contents.${index}.quantity`)} onChange={event => changeRow('box_contents', 30, index, { quantity: numeric(event.target.value) })} />
        </div><Button type="button" variant="secondary" onClick={() => removeRow('box_contents', 30, index)}>Remove included item {index + 1}</Button>
      </fieldset>; })}
      <Button type="button" variant="secondary" disabled={disabled || contents.length >= 30} onClick={() => update('box_contents', [...contents, { label: '', quantity: '' }])}>Add included item</Button>
    </fieldset>

    <fieldset className={box}><legend className="font-medium">Product fact-sheet source</legend>
      <p className={help}>A product fact sheet does not establish compatibility with an unnamed device.</p>
      <div className={grid}>
        <Input id={fieldId('fact_sheet.reference')} label="Product fact-sheet reference" maxLength={500} value={string(record(draft.fact_sheet).reference)} error={error('fact_sheet.reference')} onChange={event => nested('fact_sheet', 'reference', event.target.value)} />
        <Input id={fieldId('fact_sheet.source_date')} label="Product fact-sheet source date" type="date" value={string(record(draft.fact_sheet).source_date)} error={error('fact_sheet.source_date')} onChange={event => nested('fact_sheet', 'source_date', event.target.value)} />
      </div>
      <Button type="button" variant="secondary" disabled={disabled || draft.fact_sheet === undefined} onClick={() => update('fact_sheet', undefined)}>Clear product fact-sheet source</Button>
    </fieldset>
    <fieldset className={box}><legend className="font-medium">Specific-device references</legend>
      <p className={help}>Without a referenced exact device model, compatibility stays unconfirmed. These are merchant references, not platform certification. Do not use “all devices”.</p>
      {references.map((value, index) => { const row = record(value), prefix = `compatible_devices.${index}`;return <fieldset className={box} key={index}>
        <legend>Device reference {index + 1}</legend><div className={grid}>
          {(['manufacturer', 'model', 'reference', 'source_date'] as const).map(key => <Input key={key} id={fieldId(`${prefix}.${key}`)} label={`Device ${index + 1} ${key === 'source_date' ? 'source date' : key}`} type={key === 'source_date' ? 'date' : 'text'} maxLength={key === 'reference' ? 500 : 120} value={string(row[key])} error={error(`${prefix}.${key}`)} onChange={event => changeRow('compatible_devices', 30, index, { [key]: event.target.value })} />)}
        </div><Button type="button" variant="secondary" onClick={() => removeRow('compatible_devices', 30, index)}>Remove device reference {index + 1}</Button>
      </fieldset>; })}
      <Button type="button" variant="secondary" disabled={disabled || references.length >= 30} onClick={() => update('compatible_devices', [...references, { manufacturer: '', model: '', reference: '', source_date: '' }])}>Add device reference</Button>
    </fieldset>
    <Textarea id={fieldId('notes')} label="Electronics notes" rows={3} maxLength={2000} value={string(draft.notes)} error={error('notes')} onChange={event => update('notes', event.target.value)} />
    {issues.length > 0 && <div role="status" aria-live="polite" className="rounded-lb-md border border-[var(--lb-color-critical)] p-[var(--lb-space-3)] text-[var(--lb-color-critical)]">
      <p>Check the electronics facts before saving. Your draft is kept.</p><ul>{issues.map((issue, index) => <li key={index}>{issue.path.join('.') || 'Electronics facts'}: {issue.message}</li>)}</ul>
    </div>}
    <Button type="button" variant="secondary" disabled={disabled || value == null} onClick={() => emit(null)}>Clear all electronics facts</Button>
  </fieldset>;
}
