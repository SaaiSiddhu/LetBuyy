// Source-only inventory. No apps, runtime, database, browser or provider is started.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { createFirstPartyCatalogBundle } from '../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';

const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../../../../..');
const own = dirname(out);
const rel = p => relative(root, p);
const read = p => readFileSync(resolve(root, p), 'utf8');
const sha = data => createHash('sha256').update(data).digest('hex');
const pin = p => ({ path: p, sha256: sha(readFileSync(resolve(root, p))) });
const json = p => JSON.parse(read(p));
const save = (name, value) => writeFileSync(resolve(out, name), JSON.stringify(value, null, 2) + '\n');
const bundle = createFirstPartyCatalogBundle('letbuyy-nova', { designVersion: '2.0.0' });
const editorPath = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const formPath = 'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx';
const merchantPath = 'apps/merchant/web/src/components/products/niche-facts/madeyours-facts-editor.tsx';
const story = 'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/madeyours-storybook';
const form = read(formPath);
const controlTypes = [...form.matchAll(/case '([^']+)':/g)].map(m => m[1]);
const controls = new Set(controlTypes);
const resources = new Set(['product', 'collection', 'blog', 'page', 'menu']);
const media = new Set(['image', 'video', 'video_url']);
const field = (f, path, value) => ({
  capabilityId: path, ...f, initialValue: value ?? null,
  editorSource: formPath,
  sourceControl: controls.has(f.type) ? 'DECLARED_RENDERER_BRANCH' : 'UNKNOWN_READ_ONLY_PRESERVATION',
  browserControlVerified: false, resourceBinding: resources.has(f.type), mediaBinding: media.has(f.type),
  valueCases: [...new Set(['valid', ...(f.required ? ['required-empty'] : ['clear-or-empty']),
    ...(['text', 'textarea', 'richtext', 'url'].includes(f.type) ? ['long', 'Hindi', 'Tamil', 'escaped-markup'] : []),
    ...(['number', 'range'].includes(f.type) ? ['minimum', 'maximum', 'outside-bounds', 'zero-if-permitted'] : []),
    ...(['toggle', 'checkbox'].includes(f.type) ? ['false', 'true'] : []),
    ...(['select', 'radio'].includes(f.type) ? ['each-declared-option', 'unknown-preserved-or-refused'] : []),
    ...(resources.has(f.type) ? ['owned-resource', 'clear', 'missing-deleted-resource', 'foreign-denial', 'unavailable-distinct-from-empty'] : []),
    ...(media.has(f.type) ? ['upload', 'library', 'replace', 'remove', 'missing-asset', 'declared-alt-crop-if-present'] : []),
    ...(f.visible_if ? ['condition-false', 'condition-true', 'hidden-value-preserved'] : [])])],
});
const blockTypes = (blocks, path) => (blocks || []).map(b => ({
  capabilityId: `${path}/block/${b.type}`, type: b.type, name: b.name,
  frozenSeam: b.type === '@app', schema: b,
  settings: (b.settings || []).map(f => field(f, `${path}/block/${b.type}/field/${f.id}`)),
  children: blockTypes(b.blocks, `${path}/block/${b.type}`),
}));
const blockInstances = (blocks, order, path) => Object.entries(blocks || {}).map(([id, b]) => ({
  capabilityId: `${path}/block-instance/${id}`, id, type: b.type, order: (order || []).indexOf(id),
  settings: b.settings, disabled: b.disabled === true,
  children: blockInstances(b.blocks, b.block_order, `${path}/block-instance/${id}`),
}));
const templates = Object.entries(bundle.templates).map(([key, t]) => ({
  capabilityId: `template/${key}`, key, name: t.name, layout: t.layout,
  kind: ['header', 'footer'].includes(key) ? 'SHARED_GROUP' : 'TEMPLATE',
  order: t.order,
  sections: Object.entries(t.sections).map(([id, s]) => ({
    capabilityId: `template/${key}/section-instance/${id}`, id, type: s.type,
    order: t.order.indexOf(id), disabled: s.disabled === true, settings: s.settings,
    blocks: blockInstances(s.blocks, s.block_order, `template/${key}/section-instance/${id}`),
  })),
}));
const sections = Object.entries(bundle.sections).map(([type, file]) => ({
  capabilityId: `section/${type}`, type, name: file.schema.name, path: file.path,
  sourceSha256: sha(file.source), schema: file.schema,
  instances: templates.flatMap(t => t.sections.filter(s => s.type === type).map(s => s.capabilityId)),
  pinnedGroup: ['header', 'footer'].includes(type), frozenSeam: type === 'app-block-slot',
  settings: file.schema.settings.map(f => field(f, `section/${type}/field/${f.id}`)),
  blocks: blockTypes(file.schema.blocks, `section/${type}`),
  applicability: type === 'app-block-slot' ? 'FROZEN_SEAM_REQUIRES_REVIEW_DO_NOT_ACTIVATE' : 'REQUIRED_DECLARED_LIBRARY',
}));
const themeSettings = Object.entries(bundle.config.settings_schema.settings).map(([group, schema]) => ({
  capabilityId: `theme-settings/${group}`, group, label: schema.label,
  fields: Object.entries(schema.fields).map(([id, f]) => field({ id, ...f }, `theme-settings/${group}/${id}`, bundle.config.settings_data.current[id])),
}));

// Bind all relative source imports in the factory graph. External packages are
// represented by manifests/lockfile; vendor/build output is never source authority.
const graph = new Set(); const edges = []; const unresolved = [];
function visit(path) {
  path = resolve(path); if (graph.has(path)) return; graph.add(path);
  const src = readFileSync(path, 'utf8');
  const tree = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true);
  const imports = [];
  function walk(n) {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) imports.push(n.moduleSpecifier.text);
    ts.forEachChild(n, walk);
  }
  walk(tree);
  for (const spec of imports) if (spec.startsWith('.')) {
    const base = resolve(dirname(path), spec);
    const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, resolve(base, 'index.ts')].find(p => existsSync(p) && /\.(ts|tsx|mjs|json)$/.test(p));
    if (!target) { unresolved.push({ from: rel(path), spec }); continue; }
    edges.push({ from: rel(path), spec, to: rel(target) }); visit(target);
  }
}
visit(resolve(root, 'packages/theme-engine/src/first-party-theme-catalog.ts'));
const supplementary = [editorPath, formPath, merchantPath,
  'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx',
  'apps/merchant/web/src/components/theme-editor/BlockChildRow.tsx',
  'apps/merchant/web/src/components/theme-editor/controls/ImagePickerControl.tsx',
  'apps/merchant/web/src/components/theme-editor/controls/ResourcePickerControl.tsx',
  'packages/commerce-core/src/madeyours-facts.ts', 'packages/theme-engine/src/portable-to-liquid.ts',
  'apps/commerce/web/src/lib/theme-engine/madeyours-personalization.ts',
  'apps/commerce/web/src/lib/theme-engine/personalization-review-client.ts',
  'apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx',
  'apps/commerce/web/src/lib/buyer-order-drop.ts',
  'apps/commerce/web/src/app/store/[subdomain]/checkout/checkout-client.tsx',
  'apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx',
  'apps/platform/identity/src/app/buyer/recover/page.tsx',
  'services/webhook-service/src/index.ts',
  'services/webhook-service/src/gateway-order-transitions.ts',
  'services/webhook-service/src/gateway-refund-transitions.ts',
  'services/api-gateway/src/routes/checkout.ts', 'services/api-gateway/src/routes/storefront/cart-routes.ts',
  'services/api-gateway/src/lib/payment-route-support.ts', 'services/api-gateway/src/lib/provider-payment-verification.ts',
  'services/api-gateway/src/execution/payment-execution.adapter.ts',
  'services/api-gateway/src/routes/storefront/checkout-payment-routes.ts',
  'services/api-gateway/src/routes/storefront/internal-payment-routes.ts',
  'packages/infrastructure/razorpay-adapter/index.ts', 'packages/theme-engine/package.json', 'pnpm-lock.yaml',
  `${story}/capabilities.json`, `${story}/README.md`, `${story}/accepted-freeze.json`,
  'docs/implementation/niche-theme-programme/completion-2026-10-24/EXECUTION_RUNBOOK.md',
  'docs/implementation/niche-theme-programme/completion-2026-10-24/EXECUTION_STATE.json',
  'docs/implementation/niche-theme-programme/completion-2026-10-24/PHASE0_INDEPENDENT_REVIEW.json',
].filter(p => existsSync(resolve(root, p)));
const inputs = [...new Set([...graph].map(rel).concat(supplementary))].sort().map(pin);
const ledger = json(rel(resolve(own, 'installed-buyer-runtime-results.json')));
const originalPins = ledger.frozenSourceCheckpoint.map(p => ({ ...p, currentSha256: pin(p.path).sha256, exactOriginal: pin(p.path).sha256 === p.sha256 }));
const privateRoot = '/private/tmp/madeyours-checkout-reentry-proposal-20261024-05';
const handoffPath = `${privateRoot}/implementation-handoff.json`;
const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
const privateCheck = handoff.files.map(f => ({ ...f,
  currentMainSha256: existsSync(resolve(root, f.path)) ? pin(f.path).sha256 : null,
  actualProposalSha256: sha(readFileSync(resolve(privateRoot, 'implementation', f.path))),
}));
const createdAt = new Date().toISOString();
const inventory = {
  schemaVersion: 1, theme: 'MadeYours', preset: 'nova', classification: 'SOURCE_ENUMERATION_ONLY_NO_RUNTIME_ACCEPTANCE',
  createdAt, source: { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    bundle: bundle.package, bundleJsonSha256: sha(JSON.stringify(bundle)), inputs,
    graph: { relativeEdges: edges.length, unresolved }, candidateAdmission: null },
  authorization: { verifiedHumanThread: '01a16ce5-e5ba-7191-ab2c-a1b76947d2b5',
    turnId: '01a16cf8-99f0-7f51-852c-d0fd6ea08262', humanMessageId: '01a16cf8-9a07-7cc3-ada1-739b7457b14f',
    scope: 'PHASE0_OWN_EVIDENCE_AND_PRIVATE_PROPOSALS', activeBrowserLease: null, activeSharedWriter: null },
  themeSettings, templates, sections,
  cataloguePersonalization: { source: merchantPath, schemaSource: 'packages/commerce-core/src/madeyours-facts.ts',
    storage: 'products.metadata.personalization', immutableFormatVersion: 1,
    fields: [
      { path: 'revision', label: 'Personalization revision', type: 'integer', min: 1, max: 2147483647 },
      { path: 'methods[].id', label: 'Method ID', type: 'stable-id', maxLength: 40 },
      { path: 'methods[].label', label: 'Method label', type: 'text', maxLength: 100 },
      { path: 'methods[].min_graphemes', label: 'Minimum characters', type: 'integer', min: 1, max: 80 },
      { path: 'methods[].max_graphemes', label: 'Maximum characters', type: 'integer', min: 1, max: 80 },
      { path: 'methods[].character_set', label: 'Allowed characters', type: 'select', options: ['latin-name', 'unicode-letters'] },
      { path: 'methods[].styles[].id', label: 'Style ID', type: 'stable-id', maxLength: 40 },
      { path: 'methods[].styles[].label', label: 'Style label', type: 'text', maxLength: 100 },
      { path: 'methods[].placements[].id', label: 'Placement ID', type: 'stable-id', maxLength: 40 },
      { path: 'methods[].placements[].label', label: 'Placement label', type: 'text', maxLength: 100 },
      { path: 'production_note', label: 'Production note (optional)', type: 'textarea', maxLength: 1000 },
    ],
    arrays: [{ path: 'methods', min: 1, max: 4 }, { path: 'methods[].styles', min: 1, max: 8 }, { path: 'methods[].placements', min: 1, max: 8 }],
    operations: ['add-facts', 'edit', 'add-method', 'remove-method', 'add-style', 'remove-style', 'add-placement', 'remove-placement', 'clear-note', 'clear-facts', 'save-reload', 'revision-freshness'],
    constraints: ['stable unique IDs', 'minimum <= maximum', 'strict unknown-field refusal', 'visible trimmed labels', 'capability changes require new revision', 'omit untouched inventory'],
  },
  buyerPersonalization: { source: 'packages/theme-engine/src/madeyours-theme.ts',
    controls: ['personalization_method_id', 'personalization_text', 'personalization_style_id', 'personalization_placement_id', 'data-lb-personalization-review', 'data-lb-personalization-edit'],
    states: ['context-loading', 'context-unavailable', 'specify', 'invalid-draft-last-valid-preview', 'normalization-suggestion-explicit-acceptance', 'review', 'selection-changed-review-invalidated', 'cart-refusal-draft-retained', 'retry'],
    authority: 'Server current variant/revision and opaque review fingerprint; illustrative preview never replaces written accepted instructions',
  },
  advertisedDesignCapabilities: json(`${story}/capabilities.json`).map((v, index) => ({
    capabilityId: `advertised/${index + 1}`, ...v, historicalSupportText: true,
    applicability: v.class === 'E' ? 'EXPLICITLY_EXCLUDED_BOUNDED_SCOPE_PENDING_REVIEW' : 'REQUIRED',
    currentAcceptance: 'NOT_RUN',
  })),
  independentApplicability: {
    evidence: pin('docs/implementation/niche-theme-programme/completion-2026-10-24/PHASE0_INDEPENDENT_REVIEW.json'),
    appSeamDecision: 'APP-SEAM-01: Activation CONSTITUTIONALLY_EXCLUDED; required restriction/preservation/no misleading control acceptance stays NOT_RUN. No new human architectural decision needed.',
    configuredCartEditDecision: 'MY-G05-REVIEW: OPEN. Agent remove/re-add amendment cannot remove the approved inline edit promise. No direct human acceptance changing it established here. See CONFIGURED_CART_EDIT_CONTRACT.md.',
  },
  gapsAndLimitations: [
    { id: 'MY-G01', classification: 'EXECUTION_DEPENDENCY', description: 'No current source/native/browser lease; helper resumption pending in execution state.' },
    { id: 'MY-G02', classification: 'PROVIDER_PREREQUISITE_UNVERIFIED', description: 'No admitted Test Mode credential/account/webhook ingress receipt; no credential files inspected.' },
    { id: 'MY-G03', classification: 'CANONICAL_CONSTRAINT', description: 'Header/footer are pinned groups; do not pretend they can be deleted/re-added from template Add section. Test supported group settings/blocks and group persistence.' },
    { id: 'MY-G04', classification: 'ACTIVATION_CONSTITUTIONALLY_EXCLUDED_SAFETY_PROOF_PENDING', description: 'APP-SEAM-01 independently resolves inherited @app activation as forbidden. Inventory and test dormant restriction/preservation/no misleading active control; no activation or new human architectural decision.' },
    { id: 'MY-G05', classification: 'OPEN_APPROVED_DESIGN_CONTROL', description: 'MY-G05-REVIEW keeps the approved inline configured-cart edit promise required. Agent remove/re-add amendment cannot remove it; preserve original line until acknowledged replacement, using existing canonical review/cart flow. See private contract; no implementation claimed.' },
    { id: 'MY-G06', classification: 'UNVERIFIED_LIVE_CONTROLS', description: 'Declared renderer branch is source presence only. Catalogue/editor/runtime wiring and every public result still require installed tests.' },
  ],
  counts: { templatesIncludingGroups: templates.length, editableTemplatesExcludingGroups: templates.filter(t => t.kind === 'TEMPLATE').length,
    sectionTypes: sections.length, sectionInstances: templates.reduce((n,t) => n+t.sections.length,0),
    sectionFields: sections.reduce((n,s) => n+s.settings.length,0), themeFields: themeSettings.reduce((n,g) => n+g.fields.length,0),
    blockTypesWithinSections: sections.reduce((n,s) => n+s.blocks.length,0), blockFields: sections.flatMap(s => s.blocks).reduce((n,b) => n+b.settings.length,0),
    mediaBindings: sections.flatMap(s => [...s.settings,...s.blocks.flatMap(b => b.settings)]).filter(f => f.mediaBinding).length,
    resourceBindings: sections.flatMap(s => [...s.settings,...s.blocks.flatMap(b => b.settings)]).filter(f => f.resourceBinding).length,
    unknownFieldTypes: [...new Set(sections.flatMap(s => [...s.settings,...s.blocks.flatMap(b => b.settings)]).concat(themeSettings.flatMap(g => g.fields)).filter(f => f.sourceControl !== 'DECLARED_RENDERER_BRANCH').map(f => f.type))],
    executedAcceptanceCases: 0 },
};
save('CAPABILITY_INVENTORY.json', inventory);
save('SOURCE_RECONCILIATION.json', {
  classification: 'READ_ONLY_SOURCE_AND_PRIOR_EVIDENCE_RECONCILIATION', createdAt,
  originalCaseLedger: pin(rel(resolve(own, 'installed-buyer-runtime-results.json'))), originalSummary: ledger.summary,
  originalFrozenPins: originalPins,
  originalPinDeltas: originalPins.filter(p => !p.exactOriginal),
  originalPinDeltaExplanation: 'Previously allocator-admitted Circuit commerce-core/api-client exports; original pins are retained. No source mutation performed here.',
  phase0SourceSnapshot: inputs,
  privateCheckout05: { handoff: { path: handoffPath, sha256: sha(readFileSync(handoffPath)) }, patch: handoff.patch,
    files: privateCheck, allPrivateFilesMatchSeal: privateCheck.every(f => f.actualProposalSha256 === f.proposalSha256),
    allMainBasesMatchSeal: privateCheck.every(f => f.currentMainSha256 === f.baseSha256),
    cleanupAlreadyCompleted: handoff.followUp, inheritedSourceValidation: handoff.sourceValidation,
    nativeProposal: handoff.nativeProposal, status: 'READY_FOR_ALLOCATOR_REVIEW_NOT_APPLIED_NOT_NATIVE_TESTED' },
  resourcesTouched: { mainSourceWrites: 0, ownEvidencePreparationScripts: readdirSync(out).filter(p => p.endsWith('.mjs')).length, ownCompletionSubtreeOnly: true, database: 0, browser: 0, builds: 0, providers: 0, originalEvidenceOverwrites: 0 },
});
console.log(JSON.stringify({ classification: inventory.classification, counts: inventory.counts,
  original: ledger.summary, checkout05PrivateSealMatches: privateCheck.every(f => f.actualProposalSha256 === f.proposalSha256),
  checkout05MainBaseMatches: privateCheck.every(f => f.currentMainSha256 === f.baseSha256),
  originalFrozenDeltaPaths: originalPins.filter(p => !p.exactOriginal).map(p => p.path), unresolved: unresolved.length }));
