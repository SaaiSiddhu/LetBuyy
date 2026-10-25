'use client';

import React, { useId, useState } from 'react';
import { Banner, Button, Select } from '@letbuyy/ui';
import type { NicheVariantFactsEditorProps } from './niche-facts-editor-types';
import { isVariantFactsNamespace, readVariantFactsDraft, updateVariantFactsDraft, validateVariantFactsDraft, VARIANT_FACT_NAMESPACES, type VariantFactsNamespace } from '../../lib/variant-facts-draft';
import { PlayfieldVariantFactsEditor } from './niche-facts/playfield-variant-facts-editor';
import { PantryVariantFactsEditor } from './niche-facts/pantry-variant-facts-editor';
import { HabitatVariantFactsEditor } from './niche-facts/habitat-variant-facts-editor';
import { TrailmarkVariantFactsEditor } from './niche-facts/trailmark-variant-facts-editor';
import { MarginaliaVariantFactsEditor } from './niche-facts/marginalia-variant-facts-editor';

const editors = {
  toys: { label: 'Toys and activities', Component: PlayfieldVariantFactsEditor },
  food: { label: 'Food net contents', Component: PantryVariantFactsEditor },
  furniture: { label: 'Furniture measurements', Component: HabitatVariantFactsEditor },
  sports: { label: 'Sports measurements', Component: TrailmarkVariantFactsEditor },
  books: { label: 'Books and stationery', Component: MarginaliaVariantFactsEditor },
} satisfies Record<VariantFactsNamespace, { label: string; Component: React.ComponentType<NicheVariantFactsEditorProps> }>;

export interface VariantFactsEditorProps {
  value: unknown;
  onChange: (metadata: Record<string, unknown>) => void;
  /** Product/common metadata containing namespaces; each leaf receives only its own raw value. */
  commonFacts?: unknown;
  resources?: NicheVariantFactsEditorProps['resources'];
  disabled?: boolean;
}

function ownNamespace(value: unknown, namespace: VariantFactsNamespace): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, namespace);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

/** Controlled fact metadata for one enclosing row. View selection never changes metadata. */
export function VariantFactsEditor({ value, onChange, commonFacts, resources, disabled = false }: VariantFactsEditorProps) {
  const id = useId();
  const [selection, setSelection] = useState<VariantFactsNamespace | '' | null>(null);
  let draft: Record<string, unknown>;
  try { draft = readVariantFactsDraft(value); }
  catch {
    return <Banner variant="critical" title="Variant facts could not be read">
      <p>Recover the saved facts in the product editor, or clear these fact overrides explicitly. No draft has been replaced automatically.</p>
      <Button type="button" variant="secondary" disabled={disabled} onClick={() => { if (!disabled) onChange({}); }}>Clear unreadable variant facts</Button>
    </Banner>;
  }
  const validation = validateVariantFactsDraft(draft);
  const firstPresent = VARIANT_FACT_NAMESPACES.find(namespace => Object.hasOwn(draft, namespace));
  const selected = selection ?? firstPresent ?? '';
  const Component = selected ? editors[selected].Component : null;
  const update = (namespace: VariantFactsNamespace, next: unknown | null) => {
    if (!disabled) onChange(updateVariantFactsDraft(draft, namespace, next));
  };

  return <section className="min-w-0 space-y-[var(--lb-space-4)]" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className="font-medium">Variant-specific facts</h3>
    <p className="text-[length:var(--lb-font-size-small)] text-[var(--lb-color-text-secondary)]">Edit supplied facts for this variant. Common product information is read-only context; missing or deliberately cleared facts follow each category’s rules. Changes are saved with the variant.</p>
    {!validation.success && <Banner variant="critical" title="Review variant facts before saving">
      <p>Keep editing to correct these fields. Your partial draft is retained.</p>
      <ul className="list-inside list-disc">{validation.error.issues.map((issue, index) => <li key={`${issue.path.join('.')}-${index}`}>{issue.path.length ? `${issue.path.join(' → ')}: ` : ''}{issue.message}</li>)}</ul>
    </Banner>}
    <Select id={`${id}-category`} label="Variant facts category" value={selected} disabled={disabled} options={[{ value: '', label: 'Choose variant information to edit' }, ...VARIANT_FACT_NAMESPACES.map(namespace => ({ value: namespace, label: editors[namespace].label }))]} onChange={event => { if (!disabled && (event.target.value === '' || isVariantFactsNamespace(event.target.value))) setSelection(event.target.value); }} />
    {Component && selected && <Component key={selected} value={draft[selected]} commonFacts={ownNamespace(commonFacts, selected)} resources={resources} disabled={disabled} onChange={next => update(selected, next)} />}
    <div className="flex flex-wrap gap-[var(--lb-space-3)]">
      <Button type="button" variant="secondary" disabled={disabled || !selected || !Object.hasOwn(draft, selected)} onClick={() => { if (selected) update(selected, null); }}>Clear selected variant facts</Button>
      <Button type="button" variant="secondary" disabled={disabled || Object.keys(draft).length === 0} onClick={() => { if (!disabled) onChange({}); }}>Clear all variant fact overrides</Button>
    </div>
  </section>;
}
