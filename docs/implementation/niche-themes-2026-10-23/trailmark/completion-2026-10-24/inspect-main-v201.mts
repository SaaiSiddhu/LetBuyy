// Pure source inspection only. No renderer, server, browser, DB, native or provider operation.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const root = '/Volumes/Projects/LetBuyy';
const source = resolve(root, 'packages/theme-engine/src/first-party-theme-catalog.ts');
const seen = new Set<string>();
function collect(path: string) {
  if (seen.has(path)) return;
  seen.add(path);
  for (const match of readFileSync(path, 'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const base = resolve(dirname(path), match[1]);
    const next = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts')].find(p => existsSync(p));
    if (next) collect(next);
  }
}
collect(source);
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputs = [...seen].sort().map(path => ({ path: path.slice(root.length+1), sha256: hash(path) }));
const { createFirstPartyCatalogBundle, firstPartyThemeListings } = await import(source);
const old = createFirstPartyCatalogBundle('letbuyy-ride', { designVersion: '2.0.0' });
const next = createFirstPartyCatalogBundle('letbuyy-ride', { designVersion: '2.0.0', trailmarkVersion: '2.0.1' });
if (inputs.some(item => hash(resolve(root,item.path)) !== item.sha256)) throw new Error('Source changed during inspection; refuse mixed lineage.');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const previousSourceBundleSHA256 = '127a261320b208ec845277abe51c176921767934988f98a2ce73188bfa95c224';
const result = {
  schemaVersion: 1, recordedAt: new Date().toISOString(),
  classification: 'ACTUAL_MAIN_SOURCE_INTEGRATION_INSPECTION_NOT_PACKAGE_PROMOTION_OR_RUNTIME_ADMISSION',
  sourceInputs: inputs, allInputsStableDuringInspection: true,
  package: next.package, catalogIdentity: firstPartyThemeListings({ designVersion: '2.0.0' }).find(x => x.slug === 'letbuyy-ride'),
  default200SourceBundleSHA256: digest(old), expectedPrior200SourceBundleSHA256: previousSourceBundleSHA256,
  default200Unchanged: digest(old) === previousSourceBundleSHA256,
  successorSourceBundleSHA256: digest(next),
  successorModuleSHA256: hash(resolve(root,'packages/theme-engine/src/trailmark-theme-v201.ts')),
  proposedModuleSHA256: 'b381b79035f94dff3e3dfc0e2b87d81cb1a90624ef98e876feb1d7f1cac1a5f8',
  templates: next.templates,
  sectionSchemas: Object.fromEntries(Object.entries(next.sections).map(([type,section]) => [type, section.schema])),
  counts: { templates: Object.keys(next.templates).length, sectionTypes: Object.keys(next.sections).length,
    sectionInstances: Object.values(next.templates).reduce((n,t) => n + Object.keys(t.sections).length,0),
    sectionSettings: Object.values(next.sections).reduce((n,s) => n+s.schema.settings.length,0) },
  sourceIntegration: 'OBSERVED_IN_MAIN', formalRootSuccessorAdmission: 'AWAITING_RECEIPT_RECONCILIATION',
  promotedReleaseId: null, installedRuntimeRunId: null, directRuntimeActions: [], sourceEdits: [],
};
if (!result.default200Unchanged || result.successorModuleSHA256 !== result.proposedModuleSHA256 || next.package.version !== '2.0.1') throw new Error('Observed source disagrees with sealed/default lineage.');
writeFileSync(resolve(root,'docs/implementation/niche-themes-2026-10-23/trailmark/completion-2026-10-24/MAIN_V201_SOURCE_INTEGRATION.json'),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({ MainSuccessorObserved: true, moduleExact: true, default200Unchanged: true,
  sourceInputs: inputs.length, counts: result.counts, installedProof: false })+'\n');
