// Pure source-input preparation; the shared harness is not executed here.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFirstPartyCatalogBundle } from '../../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import { buildLiquidThemePackagePersistencePayload } from '../../../../../../packages/theme-engine/src/theme-bundle.ts';

const root = new URL('../../../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(read(path));
const sha = value => createHash('sha256').update(value).digest('hex');
const hashValue = value => sha(JSON.stringify(value));
const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const parent = 'docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/';
const borrowedInput = 'docs/implementation/niche-theme-programme/completion-marginalia-shared-source-input-20261024-01.json';
const shared = 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/shared-roundtrip-harness/';
const priorInventory = json(parent + 'CAPABILITY_INVENTORY.json');
const priorCoverage = json(parent + 'COVERAGE.json');
const prior201 = json(parent + 'private-control-mapping-resume01/BUNDLE_DIFF.json');
const input = json(borrowedInput);
const pins = new Map(input.sourcePins.map(pin => [pin.path, pin.sha256]));
for (const name of ['run.mjs', 'canonical-adapters.mjs', 'theme-data-contract.mjs']) {
  const path = shared + name, actual = sha(read(path));
  if (pins.has(path)) assert.equal(pins.get(path), actual, `Shared harness drift: ${path}`);
  pins.set(path, actual);
}
const self = fileURLToPath(import.meta.url).slice(fileURLToPath(root).length);
pins.set(self, sha(readFileSync(new URL('./prepare.mjs', import.meta.url))));
const before = [...pins].sort(([a], [b]) => a.localeCompare(b)).map(([path, expected]) => ({ path, sha256: expected, actual: sha(read(path)) }));
const drift = before.filter(pin => pin.sha256 !== pin.actual);
if (drift.length) {
  save('REFUSAL.json', { classification: 'PREPARATION_REFUSED_SOURCE_DRIFT_NO_EXECUTION', drift });
  throw new Error('Source inputs drifted; owner review/rebind required, no automatic retry.');
}
save('source-pins-before.json', before);

// Expected hashes come from earlier independent input receipts, never this return value.
const frozen = createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0' });
const current = createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0', pantryVersion: '2.0.1' });
assert.equal(frozen.package.version, '2.0.0');
assert.equal(hashValue(frozen), priorInventory.derivation.rawFactoryJsonSha256);
assert.equal(current.package.version, '2.0.1');
assert.equal(hashValue(current), prior201.inputBundleSha256);
const proposed = json(parent + 'private-control-mapping-resume01/PROPOSED_BUNDLE.json');
assert.equal(hashValue(proposed), prior201.outputBundleSha256);

function inventory(bundle) {
  const descriptors = {};
  const sections = Object.entries(bundle.sections).map(([type, file]) => {
    for (const field of file.schema.settings) descriptors[`section:${type}.${field.id}`] = field;
    const blocks = file.schema.blocks.map(block => {
      const fields = block.type === '@app' ? [] : block.settings?.length ? block.settings : bundle.blocks[block.type]?.schema.settings ?? [];
      for (const field of fields) descriptors[`block:${type}/${block.type}.${field.id}`] = field;
      return { type: block.type, fixedAppSeam: block.type === '@app', fields, limit: block.limit ?? null };
    });
    return { type, fields: file.schema.settings, blocks, sourceSha256: sha(file.source), instantiatedAt: Object.entries(bundle.templates).flatMap(([template, config]) => config.order.filter(id => config.sections[id].type === type).map(sectionId => ({ template, sectionId }))) };
  });
  for (const [group, definition] of Object.entries(bundle.config.settings_schema.settings)) {
    for (const [id, field] of Object.entries(definition.fields)) descriptors[`global:${group}.${id}`] = field;
  }
  const projection = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
  return {
    package: { slug: bundle.package.slug, version: bundle.package.version, versionNumber: bundle.package.version_number },
    rawBundleSha256: hashValue(bundle), schemaManifestSha256: hashValue(projection),
    counts: { templates: Object.keys(bundle.templates).length, templateSectionInstances: Object.values(bundle.templates).reduce((sum, t) => sum + t.order.length, 0), sectionTypes: sections.length, sectionFields: Object.keys(descriptors).filter(id => id.startsWith('section:')).length, effectiveBlockFields: Object.keys(descriptors).filter(id => id.startsWith('block:')).length, globalFields: Object.keys(descriptors).filter(id => id.startsWith('global:')).length },
    templates: Object.entries(bundle.templates).map(([key, template]) => ({ key, order: template.order, sections: Object.fromEntries(template.order.map(id => [id, { type: template.sections[id].type, settings: template.sections[id].settings }])) })),
    sections, descriptors,
  };
}
const v200 = inventory(frozen), v201 = inventory(current), privateOverlay = inventory(proposed);
const delta = (a, b) => ({
  added: Object.keys(b.descriptors).filter(id => !Object.hasOwn(a.descriptors, id)).map(id => ({ id, descriptor: b.descriptors[id] })),
  removed: Object.keys(a.descriptors).filter(id => !Object.hasOwn(b.descriptors, id)),
  changed: Object.keys(a.descriptors).filter(id => Object.hasOwn(b.descriptors, id) && hashValue(a.descriptors[id]) !== hashValue(b.descriptors[id])).map(id => ({ id, before: a.descriptors[id], after: b.descriptors[id] })),
});
const successorDelta = delta(v200, v201), futureDelta = delta(v201, privateOverlay);
const existingIds = new Set(priorCoverage.expandedCases.map(row => row.caseId));
const pendingAddedRows = successorDelta.added.map(({ id, descriptor }) => ({ caseId: `ED-FIELD:${id}`, required: true, descriptor, status: 'NOT_RUN', sourceVersion: '2.0.1', runtimeVersionAdmission: 'PENDING', existingOriginalCoverageRow: existingIds.has(`ED-FIELD:${id}`), requiredStates: ['normal typed edit', 'true_and_false', 'save acknowledgement/full reload', 'private preview', 'publish/fresh public output', 'clear/default', 'invalid/unsafe values', 'responsive keyboard and accessible label'], runtimeEvidence: [] }));
save('CONTROL_RECONCILIATION.json', {
  recordedAt: new Date().toISOString(), classification: 'SOURCE_VERSION_RECONCILIATION_NOT_INSTALLED_CONTROL_ACCEPTANCE',
  sourceReceipts: { frozenInventory: parent + 'CAPABILITY_INVENTORY.json', frozenCoverage: parent + 'COVERAGE.json', previouslySealed201Input: parent + 'private-control-mapping-resume01/BUNDLE_DIFF.json' },
  frozen200: v200, Main201: v201, privateUnadmittedOverlay: privateOverlay,
  sourceSuccessorDelta: successorDelta, futurePrivateControlDelta: futureDelta,
  pendingAddedRows, originalExpandedRows: priorCoverage.expandedCases.length,
  originalExpandedStatusesRetained: priorCoverage.expandedCounts,
  limits: ['Original281 composite rows remain unexecuted.', 'One new Main201 descriptor needs an additive row; no old case is replaced.', 'Eight private overlay descriptors require a separately selected successor/capture strategy and actual execution.', 'Declared fields, pure source roundtrips and original200 browser evidence cannot certify a201 or future installed package.', 'App seams remain dormant; source harness excludes them without claiming third-party activation.'],
});
const expectedIdentity = { slug: 'letbuyy-refresh', version: '2.0.1', bundleSha256: prior201.inputBundleSha256 };
save('harness-input.PROPOSAL.json', {
  classification: 'PANTRY_CURRENT201_SHARED_SOURCE_CONTRACT_INPUT_PROPOSAL_NOT_ADMITTED',
  admissionRequired: true,
  sourceAdmissionReference: 'docs/implementation/niche-theme-programme/heading-successor-integrations/03-shared-order-heading/source-result.json',
  expectedIdentity,
  expectedIdentityEvidence: parent + 'private-control-mapping-resume01/BUNDLE_DIFF.json',
  bundleFactory: { module: 'packages/theme-engine/src/first-party-theme-catalog.ts', export: 'createFirstPartyCatalogBundle', args: ['letbuyy-refresh', { designVersion: '2.0.0', pantryVersion: '2.0.1' }] },
  adapters: input.adapters,
  sourcePins: before.map(({ path, sha256 }) => ({ path, sha256 })),
  templateKey: 'index', fixtures: input.fixtures,
  fixtureLimit: 'Existing shared source-only retention UUID/approved font samples; no actual product, tenant, resource, installation or browser fixture.',
});
const after = before.map(pin => ({ ...pin, actual: sha(read(pin.path)) }));
assert.ok(after.every(pin => pin.sha256 === pin.actual), 'Source changed during preparation');
save('source-pins-after.json', after);
const output = parent + 'shared-source-contract-run01';
assert.equal(existsSync(new URL(output, root)), false, 'Proposed fresh result path is already occupied');
save('HANDOFF.json', {
  recordedAt: new Date().toISOString(), status: 'CONCRETE_PANTRY_INPUT_READY_FOR_SINGLE_SERIAL_SOURCE_GRANT_NOT_EXECUTED',
  expectedIdentity, pinsExact: before.length,
  input: parent + 'shared-source-contract-input01/harness-input.PROPOSAL.json',
  sourceReconciliation: parent + 'shared-source-contract-input01/CONTROL_RECONCILIATION.json',
  proposedCommand: `node --import tsx ${shared}run.mjs --input=${parent}shared-source-contract-input01/harness-input.PROPOSAL.json --output=${output}`,
  proposedOutput: output,
  harnessRewritten: false, sourceContractExecuted: false, installedAcceptance: false,
  rootReviewNeeded: 'Review current201 identity/input pins and serial source slot; this proposal is not the old Circuit or Marginalia grant.',
  originalMatrixLane: 'Frozen200 original P09-P12 remains separate and does not wait on this201 source input. Current original-matrix decision still has no runtime/browser/TLS lease.',
  sourceDelta: { successorAdded: successorDelta.added.map(x => x.id), successorRemoved: successorDelta.removed, privateFutureAdded: futureDelta.added.map(x => x.id) },
  goal: 'Full original and expanded Pantry, own real RazorpayTest purchase, immutable histories and independent review remain required; no certification issued.',
  operations: { sharedWrites: 0, harnessRuns: 0, nativeBuildRuntimeBrowserDbProvider: 0 },
});
console.log(JSON.stringify({ status: 'PROPOSED_NOT_EXECUTED', pinsExact: before.length, counts200: v200.counts, counts201: v201.counts, futurePrivateCounts: privateOverlay.counts, added201: successorDelta.added.map(x => x.id) }));
