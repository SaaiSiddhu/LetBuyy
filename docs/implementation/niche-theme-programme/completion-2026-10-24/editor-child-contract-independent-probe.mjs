import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const req = createRequire('/Volumes/Projects/LetBuyy/apps/merchant/web/package.json');
const engine = req('@letbuyy/theme-engine');
const actions = req('./src/components/theme-editor/editor-block-actions.ts');
const bundle = engine.createLetbuyyCoreLiquidThemeBundleFixture();
assert.equal(bundle.blocks.badge.schema.allowed_child_types, undefined);
const parentId = crypto.randomUUID(), childId = crypto.randomUUID();
bundle.templates.index.sections['contract-review-only'] = {
  type: 'trust-badges', settings: {}, disabled: false, block_order: [parentId],
  blocks: { [parentId]: { type: 'badge', settings: { label: 'Parent' }, disabled: false, block_order: [childId], blocks: {
    [childId]: { type: 'badge', settings: { label: 'Child' }, disabled: false, block_order: [], blocks: {} },
  } } },
};
bundle.templates.index.order.push('contract-review-only');
engine.parseLiquidThemePackageBundle(bundle);
const manifest = engine.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
const catalog = actions.editorBlockCatalog(manifest.section_schemas['trust-badges'], bundle);
const section = { id: 'contract-review-only', type: 'trust-badges', blocks: [{ id: parentId, type: 'badge', visible: true, settings: { label: 'Parent' }, order: 10, children: [] }] };
const result = { recordedAt: new Date().toISOString(), classification: 'INDEPENDENT_CANONICAL_CHILD_CONTRACT_COMPARISON_SOURCE_ONLY', canonicalReusableDefinition: 'allowed_child_types is absent; canonical schema documents unrestricted', canonicalNestedBundleAccepted: true, editorAllowsSameExistingFirstPartyChild: actions.canAddEditorBlock(section, catalog, parentId, 'badge'), actualEditorChildTypes: catalog.childTypes.badge, sourceFilesChanged: false, browser: false, database: false, providerCalls: 0 };
writeFileSync(new URL('editor-child-contract-independent-review.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
