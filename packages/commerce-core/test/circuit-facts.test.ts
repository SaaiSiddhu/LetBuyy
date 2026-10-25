import assert from 'node:assert/strict';
import test from 'node:test';
import { ElectronicsFactsSchema, normalizeElectronicsMeasurement, readElectronicsFacts } from '../src/circuit-facts';

const facts = { manufacturer: 'Nodeworks', model: 'CG-7', kind: 'hub', power_input_w: 100, pass_through_output_w: 85, data_rate_mbps: 5000, length_mm: 100, connectors: [{ kind: 'usb-c', role: 'host', count: 1 }], fact_sheet: { reference: 'NW-CG7-F1', source_date: '2026-10-22' } };
test('electronics validates strict bounded merchant facts in explicit units', () => {
  const result = ElectronicsFactsSchema.parse(facts);
  assert.equal(result.power_input_w, 100);
  assert.equal(result.pass_through_output_w, 85);
  assert.equal(result.data_rate_mbps, 5000);
  assert.deepEqual(result.compatible_devices, []);
  assert.deepEqual(result.box_contents, []);
});
test('missing facts remain absent, not inferred from input power or connector shape', () => {
  const minimal = ElectronicsFactsSchema.parse({ power_input_w: 65 });
  assert.equal(minimal.pass_through_output_w, undefined);
  assert.equal(minimal.power_output_w, undefined);
  assert.deepEqual(minimal.compatible_devices, []);
  assert.equal(readElectronicsFacts({ supplier_private: { key: 'private' } }), null);
});
test('read extracts only its own electronics namespace and never runs a namespace getter', () => {
  assert.deepEqual(readElectronicsFacts({ electronics: facts, supplier_private: 'never public' }), ElectronicsFactsSchema.parse(facts));
  assert.equal(readElectronicsFacts(Object.create({ electronics: facts })), null);
  assert.equal(readElectronicsFacts(Object.defineProperty({}, 'electronics', { get() { throw new Error('must not run'); } })), null);
  for (const value of [null, [], 'text', 5, { electronics: null }, { electronics: { secret_key: 'no' } }]) assert.equal(readElectronicsFacts(value), null);
});
test('invalid values, unknown fields, oversized arrays and inconsistent watts are rejected', () => {
  for (const invalid of [
    { ...facts, arbitrary: 'no' }, { ...facts, power_input_w: -1 }, { ...facts, data_rate_mbps: Infinity },
    { ...facts, length_mm: NaN }, { ...facts, power_input_w: 65, pass_through_output_w: 85 },
    { ...facts, model: 'x'.repeat(121) }, { ...facts, fact_sheet: { reference: 'x', source_date: '2026-02-30' } },
    { ...facts, connectors: Array.from({ length: 21 }, () => ({ kind: 'usb-c', role: 'host', count: 1 })) },
    { ...facts, connectors: [{ kind: 'usb-c', role: 'host', count: 1 }, { kind: 'usb-c', role: 'host', count: 2 }] },
    { ...facts, video: { width_px: 3840, height_px: 2160, refresh_hz: 30, invented_certification: true } },
  ]) assert.equal(ElectronicsFactsSchema.safeParse(invalid).success, false);
});
test('a compatible device requires a specific model, reference and real source date', () => {
  const device = { manufacturer: 'Fictional Devices', model: 'Desk 14 A', reference: 'Merchant reference A', source_date: '2026-10-22' };
  assert.equal(ElectronicsFactsSchema.safeParse({ compatible_devices: [device] }).success, true);
  for (const models of [[{ ...device, model: '*' }], [{ ...device, model: 'all devices' }], [{ manufacturer: 'Fictional', model: 'Desk' }], [device, { ...device, model: 'desk 14 a' }]]) {
    assert.equal(ElectronicsFactsSchema.safeParse({ compatible_devices: models }).success, false);
  }
});
test('normalization preserves physical quantity and never substitutes input W for pass-through W', () => {
  assert.deepEqual(normalizeElectronicsMeasurement(5, 'Gb/s'), { value: 5000, unit: 'Mb/s' });
  assert.deepEqual(normalizeElectronicsMeasurement(0.1, 'm'), { value: 100, unit: 'mm' });
  assert.deepEqual(normalizeElectronicsMeasurement(10, 'cm'), { value: 100, unit: 'mm' });
  assert.deepEqual(normalizeElectronicsMeasurement(65000, 'mW'), { value: 65, unit: 'W' });
  for (const value of [0, -1, Infinity, NaN]) assert.equal(normalizeElectronicsMeasurement(value, 'W'), null);
  assert.equal(normalizeElectronicsMeasurement(10001, 'W'), null);
});
