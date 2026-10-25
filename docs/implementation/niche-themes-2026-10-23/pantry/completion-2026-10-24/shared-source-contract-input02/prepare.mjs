// Reuse the allocator's complete current closure; never run or clone the shared harness here.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createFirstPartyCatalogBundle } from '../../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';

const root = new URL('../../../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const json = path => JSON.parse(read(path));
const sha = value => createHash('sha256').update(value).digest('hex');
const save = (name, value) => writeFileSync(new URL(name, import.meta.url), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const oldPath = 'docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/shared-source-contract-input01/harness-input.PROPOSAL.json';
const contextPath = 'docs/implementation/niche-theme-programme/completion-threadline-shared-source-input-20261024-01.json';
const old = json(oldPath), context = json(contextPath);
assert.equal(context.classification, 'ROOT_ADMITTED_CURRENT_THREADLINE201_ONE_SERIAL_SOURCE_RUN');
assert.equal(context.sourcePins.length, 179);
assert.deepEqual(old.adapters, context.adapters);
assert.equal(old.bundleFactory.module, context.bundleFactory.module);
const paths = new Map(context.sourcePins.map(pin => [pin.path, pin.sha256]));
for (const path of ['packages/theme-engine/src/pantry-theme.ts', 'packages/theme-engine/src/pantry-theme-v201.ts', 'packages/theme-engine/src/niche-order-presentation.ts']) assert.ok(paths.has(path), `Complete admitted closure missing Pantry source ${path}`);
const self = fileURLToPath(import.meta.url).slice(fileURLToPath(root).length); paths.set(self, sha(readFileSync(new URL('./prepare.mjs', import.meta.url))));
const before = [...paths].sort(([a], [b]) => a.localeCompare(b)).map(([path, expected]) => ({ path, sha256: expected, actual: sha(read(path)) }));
const drift = before.filter(pin => pin.sha256 !== pin.actual);
save('source-pins-before.json', before);
if (drift.length) { save('REFUSAL.json', { classification: 'CURRENT_COMPLETE_INPUT_REFUSED_SOURCE_DRIFT_NO_EXECUTION', drift }); throw new Error('Admitted common source closure changed; no automatic rebind or retry.'); }

// Independent expected identity is retained from the earlier sealed Pantry input, not derived here.
assert.equal(old.expectedIdentity.slug, 'letbuyy-refresh'); assert.equal(old.expectedIdentity.version, '2.0.1');
assert.equal(old.expectedIdentity.bundleSha256, '1f883e68d1738e8fe4b402049fdc77f25763f600800b5ec068f3dfbdae7fa244');
const bundle = createFirstPartyCatalogBundle(...old.bundleFactory.args);
assert.equal(bundle.package.slug, old.expectedIdentity.slug); assert.equal(bundle.package.version, old.expectedIdentity.version);
assert.equal(sha(JSON.stringify(bundle)), old.expectedIdentity.bundleSha256, 'Current source differs from the retained independently supplied Pantry identity');
const after = before.map(pin => ({ ...pin, actual: sha(read(pin.path)) }));
assert.ok(after.every(pin => pin.sha256 === pin.actual), 'Current source changed during preparation'); save('source-pins-after.json', after);
const output = 'docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/shared-source-contract-run01';
assert.equal(existsSync(new URL(output, root)), false, 'Fresh proposed output is occupied');
save('harness-input.PROPOSAL.json', {
  classification: 'PANTRY_CURRENT201_COMPLETE_CURRENT_SOURCE_CLOSURE_PROPOSAL_NOT_EXECUTION_ADMISSION',
  expectedIdentity: old.expectedIdentity, bundleFactory: old.bundleFactory, adapters: context.adapters,
  sourcePins: before.map(({ path, sha256 }) => ({ path, sha256 })), templateKey: old.templateKey, fixtures: old.fixtures,
  admissionRequired: true,
  independentExpectedIdentity: { path: oldPath, sha256: sha(read(oldPath)), earlierSealedWitness: 'docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/private-control-mapping-resume01/BUNDLE_DIFF.json' },
  commonClosure: { path: contextPath, sha256: sha(read(contextPath)), pins: context.sourcePins.length, scope: 'Same current canonical factory/domain/editor/registry/token graph; additional closure is a superset, not Threadline permission or result reuse.' },
  currentDeltasReviewed: { firstProposalHeld: 'Two changed files were not blind-rebound.', fullCurrentClosureConsumed: true, identicalPantryRawOutputConfirmed: true, newSourceAcceptanceNotClaimed: true },
});
save('HANDOFF.json', {
  recordedAt: new Date().toISOString(), status: 'CURRENT_COMPLETE_PANTRY_INPUT_PREPARED_SINGLE_SERIAL_GRANT_PENDING_NOT_EXECUTED',
  oldInputPreserved: oldPath, completeCurrentContext: contextPath, commonPins: 179, ownPinnedPreparer: 1, pinsExactBeforeAfter: before.length,
  expectedIdentity: old.expectedIdentity,
  input: 'docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/shared-source-contract-input02/harness-input.PROPOSAL.json',
  output,
  command: `node --import tsx docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/shared-roundtrip-harness/run.mjs --input=docs/implementation/niche-themes-2026-10-23/pantry/completion-2026-10-24/shared-source-contract-input02/harness-input.PROPOSAL.json --output=${output}`,
  sharedHarnessModified: false, sharedHarnessExecuted: false, ThreadlineGrantAdopted: false,
  ownership: 'Threadline remains next admitted serial runner. Themes must grant Pantry its own finite input/output slot.',
  sourceEvidenceLimit: 'Bundle construction/hash and current closure preservation only; no data-contract case or actual editor/browser action executed.',
  runtimeLimit: 'Separate frozen200 original P09-P12, actual RazorpayTest purchase, expanded browser controls and independent full review remain required; native06 is not qualification PASS.',
});
console.log(JSON.stringify({ status: 'PROPOSED_NOT_EXECUTED', pinsExact: before.length, independentPantryRawHashMatches: true, currentClosurePins: context.sourcePins.length, proposedOutput: output }));
