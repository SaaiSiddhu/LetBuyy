import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// A finite observation of the current canonical boundary, not a proposed matcher.
const root = process.cwd();
const queryPath = 'packages/commerce-core/src/storefront-discovery.ts';
const factsPath = 'packages/commerce-core/src/circuit-facts.ts';
const { StorefrontDiscoveryQuerySchema } = await import(pathToFileURL(resolve(root, queryPath)));
const { ElectronicsFactsSchema, readElectronicsFacts } = await import(pathToFileURL(resolve(root, factsPath)));
const observations = [];
const record = (id, expected, actual) => {
  assert.deepEqual(actual, expected, id);
  observations.push({ id, expected, actual, matchedExpectation: true });
};
record('Existing electronics query positive control', true,
  StorefrontDiscoveryQuerySchema.safeParse({ electronics_kind: 'hub', connector: ['usb-c', 'hdmi'] }).success);
for (const [key, value] of [['electronics_manufacturer', 'Synthetic Lab'], ['compatibility_evidence', 'supplied']]) {
  const result = StorefrontDiscoveryQuerySchema.safeParse({ [key]: value });
  record(`Proposed ${key} is currently rejected`, false, result.success);
  assert.equal(result.error.issues.some(issue => issue.code === 'unrecognized_keys' && issue.keys.includes(key)), true);
}
const sourced = { kind: 'hub', manufacturer: 'Synthetic Lab', compatible_devices: [
  { manufacturer: 'Synthetic Devices', model: 'Fixture Model 1', reference: 'Synthetic merchant document A', source_date: '2026-10-24' },
] };
record('Specific device with dated source is accepted', true, ElectronicsFactsSchema.safeParse(sourced).success);
record('General fact sheet alone supplies no device reference', 0,
  ElectronicsFactsSchema.parse({ kind: 'hub', fact_sheet: { reference: 'Synthetic general sheet', source_date: '2026-10-24' } }).compatible_devices.length);
record('Connector shape alone supplies no device reference', 0,
  ElectronicsFactsSchema.parse({ connectors: [{ kind: 'usb-c', role: 'host', count: 1 }] }).compatible_devices.length);
record('Malformed device date invalidates public namespace', null,
  readElectronicsFacts({ electronics: { ...sourced, compatible_devices: [{ ...sourced.compatible_devices[0], source_date: '2026-02-30' }] } }));
record('Absent electronics namespace is unconfirmed', null, readElectronicsFacts({}));

const sourcePaths = [queryPath, factsPath,
  'apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts',
  'packages/theme-engine/src/circuit-discovery.ts',
  'database/supabase/migrations/386_storefront_discovery.sql',
  'database/supabase/migrations/392_storefront_electronics_search.sql',
  'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/circuit-storybook/capabilities.json'];
const pins = [];
for (const path of sourcePaths) {
  const data = await readFile(resolve(root, path));
  pins.push({ path, sha256: createHash('sha256').update(data).digest('hex'), bytes: data.length });
}
const result = {
  recordedAt: new Date().toISOString(), classification: 'CURRENT_SOURCE_GAP_OBSERVATION',
  status: 'CIR_C02_TWO_QUERY_KEYS_ABSENT', observations, sourcePins: pins,
  proposedFiltersImplemented: false, nativeCasesExecuted: 0, installedCasesAdded: 0,
  paymentOrCertificationProof: false,
};
await writeFile(resolve(fileURLToPath(new URL('.', import.meta.url)), 'current-observation.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ status: result.status, observations: observations.length, sourcePins: pins.length }) + '\n');
