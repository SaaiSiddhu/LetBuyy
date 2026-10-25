import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const positive = (max: number) => z.number().finite().positive().max(max);
const sourceDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date in YYYY-MM-DD form.');

import { ElectronicsConnectorSchema } from '@letbuyy/shared-types';
export { ElectronicsConnectorSchema } from '@letbuyy/shared-types';

const DeviceReferenceSchema = z.object({
  manufacturer: text(120),
  model: text(120).refine(value => !/^(\*|all(?: devices| models)?|any(?: device| model)?|universal)$/i.test(value), 'Name a specific device model.'),
  reference: text(500),
  source_date: sourceDate,
}).strict();

/** Merchant-authored public facts. Values are canonical units, never inferred from media. */
export const ElectronicsFactsSchema = z.object({
  version: z.literal(1).default(1),
  manufacturer: text(120).optional(),
  model: text(120).optional(),
  kind: z.enum(['hub', 'adapter', 'charger', 'cable', 'audio', 'device', 'other']).optional(),
  connectors: z.array(ElectronicsConnectorSchema).max(20).default([]),
  power_input_w: positive(10000).optional(),
  power_output_w: positive(10000).optional(),
  power_capacity_w: positive(10000).optional(),
  pass_through_output_w: positive(10000).optional(),
  data_rate_mbps: positive(1000000).optional(),
  length_mm: positive(100000).optional(),
  dimensions_mm: z.object({ length: positive(100000), width: positive(100000), height: positive(100000) }).strict().optional(),
  video: z.object({ width_px: z.number().int().min(1).max(16384), height_px: z.number().int().min(1).max(16384), refresh_hz: positive(1000) }).strict().optional(),
  box_contents: z.array(z.object({ label: text(200), quantity: z.number().int().min(1).max(1000) }).strict()).max(30).default([]),
  host_requirements: z.array(text(500)).max(20).default([]),
  fact_sheet: z.object({ reference: text(500), source_date: sourceDate }).strict().optional(),
  // These are references, not a platform certification or an assertion that every device fits.
  compatible_devices: z.array(DeviceReferenceSchema).max(30).default([]),
  notes: text(2000).optional(),
}).strict().superRefine((facts, ctx) => {
  const connectorKeys = new Set<string>();
  for (const [index, row] of facts.connectors.entries()) {
    const key = `${row.kind}:${row.role}`;
    if (connectorKeys.has(key)) ctx.addIssue({ code: 'custom', path: ['connectors', index], message: 'Each connector kind and role must appear once; use count.' });
    connectorKeys.add(key);
  }
  const devices = new Set<string>();
  for (const [index, row] of facts.compatible_devices.entries()) {
    const key = `${row.manufacturer}:${row.model}`.toLocaleLowerCase('en');
    if (devices.has(key)) ctx.addIssue({ code: 'custom', path: ['compatible_devices', index], message: 'Each referenced device model must appear once.' });
    devices.add(key);
  }
  if (facts.pass_through_output_w !== undefined && facts.power_input_w !== undefined && facts.pass_through_output_w > facts.power_input_w) {
    ctx.addIssue({ code: 'custom', path: ['pass_through_output_w'], message: 'Pass-through output cannot exceed the stated power input.' });
  }
});
export type ElectronicsFacts = z.infer<typeof ElectronicsFactsSchema>;

/** Read only the own, validated electronics namespace; never expose unrelated/private metadata. */
export function readElectronicsFacts(metadata: unknown): ElectronicsFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(metadata, 'electronics');
    if (!descriptor || !('value' in descriptor)) return null;
    const result = ElectronicsFactsSchema.safeParse(descriptor.value);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Explicit conversion at merchant input boundaries; do not compare different physical quantities. */
export function normalizeElectronicsMeasurement(value: number, unit: 'W' | 'mW' | 'Mb/s' | 'Gb/s' | 'mm' | 'cm' | 'm'): { value: number; unit: 'W' | 'Mb/s' | 'mm' } | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const scale = { W: 1, mW: 0.001, 'Mb/s': 1, 'Gb/s': 1000, mm: 1, cm: 10, m: 1000 }[unit];
  if (scale === undefined) return null;
  const normalized = value * scale;
  const target = unit === 'W' || unit === 'mW' ? 'W' : unit === 'Mb/s' || unit === 'Gb/s' ? 'Mb/s' : 'mm';
  if (!Number.isFinite(normalized) || normalized > (target === 'W' ? 10000 : target === 'mm' ? 100000 : 1000000)) return null;
  return { value: normalized, unit: target };
}
