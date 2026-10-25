import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import * as domain from '@letbuyy/theme-engine';
import { helpers } from './theme-draft-document.test.mjs';

const require = createRequire(import.meta.url);
const actions = require('../src/components/theme-editor/editor-block-actions.ts');
const pagePath = new URL('../src/app/[store]/online-store/themes/[themeId]/editor/page.tsx', import.meta.url);
const page = ts.createSourceFile(pagePath.pathname, readFileSync(pagePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function expression(name, callback = true) {
    let found;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(page) === name) found = callback && ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : !callback ? node.initializer : undefined;
        ts.forEachChild(node, visit);
    }
    visit(page); assert.ok(found, `Missing production callback ${name}`); return found.getText(page);
}
function execute(code, dependencies = {}) {
    const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    return new Function('exports', ...Object.keys(dependencies), js)({}, ...Object.values(dependencies));
}
function local(name, dependencies) {
    const node = page.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(node); return execute(`${node.getText(page)}; return ${name}`, dependencies);
}
function document(bundleInput, sectionType = 'trust-badges') {
    // Use the real unmodified reusable definition for the positive roundtrip.
    const bundle = bundleInput || domain.createLetbuyyCoreLiquidThemeBundleFixture();
    assert.equal(bundle.blocks.badge.schema.allowed_child_types, undefined);
    bundle.templates.index.sections.actions = { type: sectionType, settings: {}, blocks: {}, block_order: [], disabled: false };
    bundle.templates.index.order.push('actions');
    const adapterPath = new URL('../../../../services/api-gateway/src/execution/schema-registry-execution.adapter.ts', import.meta.url);
    const adapter = ts.createSourceFile(adapterPath.pathname, readFileSync(adapterPath, 'utf8'), ts.ScriptTarget.Latest, true);
    const code = adapter.statements.filter(node => ts.isFunctionDeclaration(node) && ['asRecord', 'isLiquidBundle', 'buildBundleTemplateConfig'].includes(node.name?.text)).map(node => node.getText(adapter)).join('\n');
    const base = execute(`${code};return buildBundleTemplateConfig`)(bundle);
    const manifest = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
    const settings = helpers.normalizeSettingsSchema(manifest.settings_schema);
    const state = helpers.normalizeEditorState(base, bundle.package.slug, 'index', manifest.section_schemas, settings);
    return { bundle, base, state, settings, schemas: manifest.section_schemas, catalog: actions.editorBlockCatalog(manifest.section_schemas[sectionType], bundle) };
}

test('actual page actions preserve confirmed deletion, selection, history and canonical saved identities/order/visibility', () => {
    const doc = document();
    const context = { state: doc.state, history: { past: [], future: [] }, selection: null, removal: null, dirty: false };
    const getSectionById = local('getSectionById', { getAllSections: helpers.getAllSections });
    const coerceFieldValue = local('coerceFieldValue', { numberValue: local('numberValue') });
    const instantiate = name => execute(`return (${expression(name)})`, {
        ...actions, ...helpers, getSectionById, coerceFieldValue,
        editorState: context.state, savedState: doc.state,
        blockCatalogs: { 'trust-badges': doc.catalog }, settingsSchema: doc.settings,
        blockPendingRemoval: context.removal,
        setEditorState: update => { context.state = typeof update === 'function' ? update(context.state) : update; },
        setHistory: update => { context.history = update(context.history); },
        setIsDirty: value => { context.dirty = value; },
        setSelection: value => { context.selection = value; },
        setBlockPendingRemoval: value => { context.removal = value; },
        ...(name === 'applyChange' ? {} : { applyChange: instantiate('applyChange') }),
        ...(name === 'addChildBlock' ? { addBlock: instantiate('addBlock') } : {}),
    });
    instantiate('addBlock')('actions', 'badge');
    const first = context.selection.blockId;
    instantiate('addBlock')('actions', 'badge');
    const second = context.selection.blockId;
    const added = context.state;
    instantiate('moveBlock')('actions', 'actions', second, -1);
    instantiate('toggleBlockVisibility')('actions', first);
    instantiate('addChildBlock')('actions', second, 'badge');
    const child = context.selection.blockId;
    const textField = Object.keys(doc.catalog.schemas.badge.fields)[0];
    instantiate('updateBlockSetting')('actions', child, textField, 'Saved nested marker');
    assert.equal(helpers.getBlockById(getSectionById(context.state, 'actions'), child).settings[textField], 'Saved nested marker');
    const beforeRefusal = context.state, historySize = context.history.past.length;
    instantiate('addBlock')('actions', '@app');
    instantiate('requestRemoveChildBlock')('actions', first, child);
    assert.equal(context.removal, null);
    assert.equal(context.state, beforeRefusal);
    assert.equal(context.history.past.length, historySize);
    const config = helpers.buildDraftConfig(doc.base, doc.bundle.package.slug, context.state, 'index');
    const compiled = domain.compilePortableToLiquidBundle(config, { baseBundle: doc.bundle }).bundle;
    const portable = compiled.templates.index.sections.actions;
    assert.deepEqual(portable.block_order, [second, first]);
    assert.equal(portable.blocks[first].disabled, true);
    assert.deepEqual(portable.blocks[second].block_order, [child]);
    assert.equal(portable.blocks[second].blocks[child].settings[textField], 'Saved nested marker');
    const canonical = domain.toThemeDocumentV2(compiled);
    assert.deepEqual(domain.fromThemeDocumentV2(canonical).templates.index.sections.actions, portable);
    const reloaded = helpers.normalizeEditorState(config, doc.bundle.package.slug, 'index', doc.schemas, doc.settings);
    assert.equal(helpers.getBlockById(getSectionById(reloaded, 'actions'), first).visible, false);
    instantiate('requestRemoveChildBlock')('actions', second, child);
    assert.equal(context.state, beforeRefusal, 'opening confirmation must not delete');
    assert.equal(context.removal.block.id, child);
    instantiate('removeBlock')();
    assert.equal(helpers.getBlockById(getSectionById(context.state, 'actions'), child), null);
    assert.deepEqual(context.selection, { kind: 'section', sectionId: 'actions' });
    instantiate('undo')();
    assert.ok(helpers.getBlockById(getSectionById(context.state, 'actions'), child));
    instantiate('redo')();
    assert.equal(helpers.getBlockById(getSectionById(context.state, 'actions'), child), null);
    instantiate('addChildBlock')('actions', second, 'badge');
    assert.notEqual(context.selection.blockId, child, 're-add obtains a new canonical instance identity');
    assert.equal(getSectionById(added, 'actions').blocks[0].visible, true, 'earlier undo snapshot remains immutable');
});

test('the page passes executed actions to its tree, and actual flat/nested row affordances bind exact IDs and bounds', () => {
    const tree = [];
    function visit(node) {
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === 'SectionTreePanel') tree.push(node);
        ts.forEachChild(node, visit);
    }
    visit(page); assert.equal(tree.length, 1);
    const props = Object.fromEntries(tree[0].attributes.properties.filter(ts.isJsxAttribute).map(attribute => [attribute.name.getText(page), attribute.initializer?.expression?.getText(page)]));
    assert.equal(props.onAddChildBlock, 'addChildBlock');
    assert.equal(props.onRemoveChildBlock, 'requestRemoveChildBlock');
    assert.equal(props.onMoveChildBlock, 'moveBlock');
    assert.equal(props.onToggleBlock, 'toggleBlockVisibility');
    const file = new URL('../src/components/theme-editor/BlockChildRow.tsx', import.meta.url);
    const source = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const node = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'BlockChildRow');
    const { Button } = require('@letbuyy/ui'), icons = require('lucide-react');
    const row = execute(`${node.getText(source).replace(/^export /, "")};return BlockChildRow`, { require, Button, ...icons, MAX_EDITOR_BLOCK_DEPTH: domain.MAX_BUNDLE_BLOCK_NESTING_DEPTH });
    const calls = [], doc = document();
    const inputs = { block: { id: 'p', type: 'badge', visible: true, settings: {}, children: [] }, depth: 1, sectionId: 'actions', parentBlockId: 'actions', selectedBlockId: 'p', siblingIndex: 0, siblingCount: 2, allowedChildTypes: ['badge'], blockCatalog: doc.catalog, onSelectBlock: id => calls.push(['select', id]), onMoveChildBlock: (...args) => calls.push(['move', ...args]), onToggleBlock: (...args) => calls.push(['toggle', ...args]), onRemoveChildBlock: (...args) => calls.push(['remove', ...args]), onAddChildBlock: (...args) => calls.push(['add', ...args]) };
    const buttons = element => {
        if (!element || typeof element !== 'object') return [];
        const children = [element.props?.children].flat(Infinity);
        return [...(element.type === Button ? [element.props] : []), ...children.flatMap(buttons)];
    };
    const rendered = buttons(row(inputs));
    assert.equal(rendered.find(button => button['aria-label'] === 'Move badge block up').disabled, true);
    rendered.find(button => button['aria-label'] === 'Move badge block down').onClick();
    rendered.find(button => button['aria-label'] === 'Toggle badge block visibility').onClick();
    rendered.find(button => button['aria-label'] === 'Remove badge block').onClick();
    rendered.find(button => button['aria-label']?.startsWith('Add child block:')).onClick();
    assert.deepEqual(calls, [['move', 'actions', 'actions', 'p', 1], ['toggle', 'actions', 'p'], ['remove', 'actions', 'actions', 'p'], ['add', 'actions', 'p', 'badge']]);
    const nested = buttons(row({ ...inputs, depth: 3, parentBlockId: 'parent', siblingCount: 1 }));
    assert.equal(nested.some(button => button['aria-label']?.startsWith('Add child block:')), false);
    assert.equal(nested.find(button => button['aria-label'] === 'Move child block down').disabled, true);
});

test('actual389 inline/reusable collisions reload and compile without inventing child defaults or dropping saved unknown values', () => {
    const sql = readFileSync(new URL('../../../../database/supabase/migrations/389_niche_theme_catalog_v2.sql', import.meta.url), 'utf8');
    const artifacts = JSON.parse(sql.match(/\$liquidbundle\$([\s\S]*?)\$liquidbundle\$/)[1]);
    for (const slug of ['letbuyy-dawn', 'letbuyy-nova']) {
        const original = artifacts.find(row => row.slug === slug), base = structuredClone(original.document);
        const bundle = domain.parseLiquidThemePackageBundle(base.liquidBundle), definitions = JSON.stringify(bundle.blocks);
        const manifest = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
        const settings = helpers.normalizeSettingsSchema(manifest.settings_schema), catalog = actions.editorBlockCatalog(manifest.section_schemas['trust-badges'], bundle);
        base.templates.index.sections['collision-probe'] = { type: 'trust-badges', settings: {}, blocks: {}, block_order: [], disabled: false };
        base.templates.index.order.push('collision-probe');
        const state = helpers.normalizeEditorState(base, slug, 'index', manifest.section_schemas, settings);
        const initial = helpers.getAllSections(state).find(section => section.id === 'collision-probe');
        const parent = helpers.createBlockFromSchema('badge', actions.editorBlockSchema(catalog, 'badge', 1), 10);
        parent.settings.description = 'Root inline description';
        const child = helpers.createBlockFromSchema('badge', actions.editorBlockSchema(catalog, 'badge', 2), 10);
        child.settings.savedFutureValue = 'Retain existing unknown data';
        assert.equal(Object.hasOwn(child.settings, 'description'), false);
        const added = actions.addEditorBlock(initial, catalog, initial.id, parent);
        const nested = actions.addEditorBlock(added, catalog, parent.id, child);
        const next = helpers.updateSectionById(state, initial.id, () => nested);
        const saved = helpers.buildDraftConfig(base, slug, next, 'index');
        const reload = helpers.normalizeEditorState(saved, slug, 'index', manifest.section_schemas, settings);
        const section = helpers.getAllSections(reload).find(section => section.id === initial.id);
        const reloadedChild = helpers.getBlockById(section, child.id);
        assert.equal(helpers.getBlockById(section, parent.id).settings.description, 'Root inline description');
        assert.equal(Object.hasOwn(reloadedChild.settings, 'description'), false, 'reload must not inject an inline default into a reusable child');
        assert.equal(reloadedChild.settings.savedFutureValue, 'Retain existing unknown data');
        const selectedDescriptor = selectedBlock => execute(`return (${expression('selectedBlockSchema', false)})`, {
            selectedSection: section, selectedBlock, blockCatalogs: { 'trust-badges': catalog }, ...actions,
        });
        assert.equal(selectedDescriptor(reloadedChild).fields.description, undefined);
        assert.ok(selectedDescriptor(helpers.getBlockById(section, parent.id)).fields.description);
        let controlWrites = 0;
        const update = execute(`return (${expression('updateBlockSetting')})`, {
            editorState: reload, blockCatalogs: { 'trust-badges': catalog }, ...actions, ...helpers,
            getSectionById: local('getSectionById', { getAllSections: helpers.getAllSections }),
            coerceFieldValue: local('coerceFieldValue', { numberValue: local('numberValue') }),
            applyChange: updater => { controlWrites++; updater(reload); },
        });
        update(initial.id, child.id, 'description', 'Unsupported child field');
        assert.equal(controlWrites, 0, 'the actual callback rejects an unsupported child control');
        update(initial.id, parent.id, 'description', 'Supported root field');
        assert.equal(controlWrites, 1);
        const compiled = domain.compilePortableToLiquidBundle(helpers.buildDraftConfig(saved, slug, reload, 'index'), { baseBundle: bundle }).bundle;
        const final = domain.fromThemeDocumentV2(domain.toThemeDocumentV2(compiled));
        const persisted = final.templates.index.sections[initial.id].blocks[parent.id];
        assert.equal(persisted.settings.description, 'Root inline description');
        assert.equal(Object.hasOwn(persisted.blocks[child.id].settings, 'description'), false);
        assert.equal(persisted.blocks[child.id].settings.savedFutureValue, 'Retain existing unknown data');
        assert.equal(JSON.stringify(bundle.blocks), definitions, 'actual captured definitions remain unchanged');
    }
});


test('actual page callbacks complete each qualified theme inline-parent edit cycle through the canonical compiler and reload', () => {
    for (const listing of domain.firstPartyThemeListings({ designVersion: '2.0.0' })) {
        const bundle = domain.createFirstPartyCatalogBundle(listing.slug, { customizationVersion: '2.1.0' });
        for (const sectionType of Object.keys(bundle.sections)) for (const parentType of domain.qualifiedFirstPartyInlineChildParents(bundle, sectionType)) {
            const doc = document(structuredClone(bundle), sectionType);
            const context = { state: doc.state, history: { past: [], future: [] }, selection: null, removal: null, dirty: false };
            const getSectionById = local('getSectionById', { getAllSections: helpers.getAllSections });
            const coerceFieldValue = local('coerceFieldValue', { numberValue: local('numberValue') });
            const instantiate = name => execute(`return (${expression(name)})`, {
                ...actions, ...helpers, getSectionById, coerceFieldValue,
                editorState: context.state, savedState: doc.state,
                blockCatalogs: { [sectionType]: doc.catalog }, settingsSchema: doc.settings,
                blockPendingRemoval: context.removal,
                setEditorState: update => { context.state = typeof update === 'function' ? update(context.state) : update; },
                setHistory: update => { context.history = update(context.history); },
                setIsDirty: value => { context.dirty = value; }, setSelection: value => { context.selection = value; },
                setBlockPendingRemoval: value => { context.removal = value; },
                ...(name === 'applyChange' ? {} : { applyChange: instantiate('applyChange') }),
                ...(name === 'addChildBlock' ? { addBlock: instantiate('addBlock') } : {}),
            });
            instantiate('addBlock')('actions', parentType);
            const parent = context.selection.blockId;
            instantiate('addChildBlock')('actions', parent, 'badge'); const first = context.selection.blockId;
            instantiate('updateBlockSetting')('actions', first, 'label', 'Saved customization ' + listing.name);
            instantiate('addChildBlock')('actions', parent, 'badge'); const second = context.selection.blockId;
            instantiate('moveBlock')('actions', parent, second, -1);
            instantiate('toggleBlockVisibility')('actions', first);
            const config = helpers.buildDraftConfig(doc.base, bundle.package.slug, context.state, 'index');
            const compiled = domain.compilePortableToLiquidBundle(config, { baseBundle: doc.bundle }).bundle;
            const final = domain.fromThemeDocumentV2(domain.toThemeDocumentV2(compiled)).templates.index.sections.actions.blocks[parent];
            assert.deepEqual(final.block_order, [second, first], listing.name + '/' + sectionType);
            assert.equal(final.blocks[first].settings.label, 'Saved customization ' + listing.name);
            assert.equal(final.blocks[first].disabled, true);
            const reloaded = helpers.normalizeEditorState(config, bundle.package.slug, 'index', doc.schemas, doc.settings);
            assert.equal(helpers.getBlockById(getSectionById(reloaded, 'actions'), first).visible, false);
            const beforeRefusal = context.state, historySize = context.history.past.length;
            instantiate('addChildBlock')('actions', parent, '@app');
            instantiate('addChildBlock')('actions', parent, 'missing');
            assert.equal(context.state, beforeRefusal); assert.equal(context.history.past.length, historySize);
            instantiate('requestRemoveChildBlock')('actions', parent, first);
            assert.equal(context.removal.block.id, first); assert.equal(context.state, beforeRefusal);
            instantiate('removeBlock')(); assert.equal(helpers.getBlockById(getSectionById(context.state, 'actions'), first), null);
            instantiate('addChildBlock')('actions', parent, 'badge'); assert.notEqual(context.selection.blockId, first);
        }
    }
});
