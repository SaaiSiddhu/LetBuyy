import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createLetbuyyCoreLiquidThemeBundleFixture, buildLiquidThemePackagePersistencePayload, parseLiquidThemePackageBundle } from '@letbuyy/theme-engine'
import type { ExtendedSectionSchema } from '@letbuyy/theme-engine'
import { addEditorBlock, canAddEditorBlock, editorBlockCatalog, editorBlockSchema, editorBlockSiblings, findEditorBlock, moveEditorBlock, toggleEditorBlock } from './editor-block-actions'
import type { BlockEntry, SectionEntry } from './editor-view-state'

const block = (id: string, type = 'badge', children?: BlockEntry[]): BlockEntry => ({ id, type, order: 10, visible: true, settings: { text: 'Same label' }, ...(children ? { children } : {}) })
const section = (blocks: BlockEntry[] = []): SectionEntry => ({ id: 'owned', type: 'trust-badges', order: 10, visible: true, settings: {}, blocks })
function fixture() {
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture()
    const schema = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas['trust-badges'] as ExtendedSectionSchema
    return { bundle, schema, catalog: editorBlockCatalog(schema, bundle) }
}

test('unmodified installed definitions preserve canonical unrestricted first-party nesting and keep app seams/unknown types dormant', () => {
    const { bundle, schema, catalog } = fixture()
    assert.deepEqual(catalog.childTypes.badge, ['badge'])
    assert.equal(canAddEditorBlock(section(), catalog, 'owned', '@app'), false)
    assert.equal(canAddEditorBlock(section(), catalog, 'owned', 'app:forbidden'), false)
    assert.equal(canAddEditorBlock(section(), catalog, 'owned', 'missing'), false)
    assert.equal(canAddEditorBlock(section([block('parent')]), catalog, 'absent', 'badge'), false)
    assert.equal(bundle.blocks.badge.schema.allowed_child_types, undefined)
    assert.deepEqual(editorBlockCatalog(schema, bundle).childTypes.badge, ['badge'])
    assert.equal(canAddEditorBlock(section([block('parent')]), catalog, 'parent', 'badge'), true)
    assert.equal(canAddEditorBlock(section([block('parent')]), editorBlockCatalog(schema), 'parent', 'badge'), false)
    assert.equal(parseLiquidThemePackageBundle(bundle).blocks.badge.schema.allowed_child_types, undefined)
})


test('canonical explicit empty and allowlist definitions restrict only eligible reusable children', () => {
    const { bundle, schema } = fixture()
    bundle.blocks.notice = { ...structuredClone(bundle.blocks.badge), path: 'blocks/notice.liquid' }
    bundle.blocks.badge.schema.allowed_child_types = []
    const empty = editorBlockCatalog(schema, bundle), parent = section([block('parent')])
    assert.deepEqual(empty.childTypes.badge, [])
    assert.equal(canAddEditorBlock(parent, empty, 'parent', 'badge'), false)
    bundle.blocks.badge.schema.allowed_child_types = ['badge', '@app', 'app:forbidden', 'missing', 'faq-item']
    const restricted = editorBlockCatalog(schema, bundle)
    assert.deepEqual(restricted.childTypes.badge, ['badge'])
    assert.equal(canAddEditorBlock(parent, restricted, 'parent', 'badge'), true)
    assert.equal(canAddEditorBlock(parent, restricted, 'parent', 'notice'), false)
    assert.equal(canAddEditorBlock(parent, restricted, 'parent', 'faq-item'), false)
    assert.deepEqual(editorBlockCatalog(schema, bundle).childTypes.notice, ['badge', 'notice'])
})

test('section-inline parents do not offer children the actual renderer cannot recurse into', () => {
    const { bundle } = fixture()
    const schema = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas['banner-carousel'] as ExtendedSectionSchema
    const catalog = editorBlockCatalog(schema, bundle)
    const inline = { ...section([block('slide-parent', 'slide')]), type: 'banner-carousel' }
    assert.ok(catalog.rootTypes.includes('slide'))
    assert.equal(bundle.blocks.slide, undefined)
    assert.equal(canAddEditorBlock(inline, catalog, 'slide-parent', 'badge'), false)
})

test('actual captured Marginalia/MadeYours collision keeps root inline and nested reusable descriptors separate', () => {
    const sql = readFileSync(new URL('../../../../../../database/supabase/migrations/389_niche_theme_catalog_v2.sql', import.meta.url), 'utf8')
    const artifacts = JSON.parse(sql.match(/\$liquidbundle\$([\s\S]*?)\$liquidbundle\$/)![1]) as Array<{ slug: string; document: { liquidBundle: unknown } }>
    for (const slug of ['letbuyy-dawn', 'letbuyy-nova']) {
        const bundle = parseLiquidThemePackageBundle(artifacts.find(row => row.slug === slug)!.document.liquidBundle)
        const schema = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas['trust-badges'] as ExtendedSectionSchema
        const catalog = editorBlockCatalog(schema, bundle)
        assert.equal(bundle.blocks.badge.schema.allowed_child_types, undefined)
        assert.ok(editorBlockSchema(catalog, 'badge', 1)?.fields.description)
        assert.equal(editorBlockSchema(catalog, 'badge', 2)?.fields.description, undefined)
        assert.equal(editorBlockSchema(catalog, 'badge', 3)?.fields.description, undefined)
        assert.deepEqual(Object.keys(catalog.reusableSchemas.badge.fields), ['label'])
    }
})

test('adding preserves instance IDs and history and rejects duplicate or prebuilt hidden subtrees', () => {
    const { catalog } = fixture(), before = section([block('parent')]), snapshot = structuredClone(before)
    const after = addEditorBlock(before, catalog, 'parent', block('child'))
    assert.deepEqual(before, snapshot)
    assert.equal(after.blocks[0].id, 'parent')
    assert.equal(findEditorBlock(after.blocks, 'child')?.depth, 2)
    assert.equal(addEditorBlock(after, catalog, 'owned', block('child')), after)
    assert.equal(addEditorBlock(before, catalog, 'owned', block('owned')), before)
    assert.equal(addEditorBlock(before, catalog, 'owned', block('tree', 'badge', [block('hidden')])), before)
    assert.equal(editorBlockSiblings(after, 'parent')?.[0].id, 'child')
})

test('depth, direct DTO count, nested canonical count and declared type limits refuse without mutation', () => {
    const { catalog } = fixture()
    const deepest = section([block('one', 'badge', [block('two', 'badge', [block('three')])])])
    assert.equal(canAddEditorBlock(deepest, catalog, 'two', 'badge'), true)
    assert.equal(addEditorBlock(deepest, catalog, 'three', block('four')), deepest)
    const fullRoot = section(Array.from({ length: 50 }, (_, i) => block(`r${i}`)))
    assert.equal(addEditorBlock(fullRoot, catalog, 'owned', block('extra')), fullRoot)
    const fullChildren = section([block('parent', 'badge', Array.from({ length: 100 }, (_, i) => block(`c${i}`)))])
    assert.equal(addEditorBlock(fullChildren, catalog, 'parent', block('extra')), fullChildren)
    const limited = { ...catalog, rootLimits: { badge: 1 } }, once = section([block('one')])
    assert.equal(addEditorBlock(once, limited, 'owned', block('two')), once)
})

test('flat/nested reorder uses exact sibling identities and refuses cross-parent or edge moves', () => {
    const original = section([block('p', 'badge', [block('a'), block('b')]), block('q', 'badge', [block('c')])])
    const nested = moveEditorBlock(original, 'p', 'b', -1)
    assert.deepEqual(nested.blocks[0].children?.map(row => row.id), ['b', 'a'])
    assert.equal(nested.blocks[1], original.blocks[1])
    assert.equal(moveEditorBlock(original, 'q', 'b', -1), original)
    assert.equal(moveEditorBlock(original, 'p', 'a', -1), original)
    assert.equal(moveEditorBlock(original, 'p', 'b', 1), original)
    const flat = moveEditorBlock(nested, 'owned', 'q', -1)
    assert.deepEqual(flat.blocks.map(row => [row.id, row.order]), [['q', 10], ['p', 20]])
    assert.deepEqual(original.blocks[0].children?.map(row => row.id), ['a', 'b'])
})

test('visibility targets the exact flat/nested instance, preserves unrelated values and round trips twice', () => {
    const original = section([block('a', 'badge', [block('child')]), block('b')])
    const hidden = toggleEditorBlock(original, 'child')
    assert.equal(hidden.blocks[0].children?.[0].visible, false)
    assert.equal(hidden.blocks[1], original.blocks[1])
    assert.deepEqual(toggleEditorBlock(hidden, 'child'), original)
    assert.equal(toggleEditorBlock(original, 'missing'), original)
    assert.equal(toggleEditorBlock(original, 'b').blocks[1].visible, false)
})

// Source-only current211 qualification. Execute the actual page callbacks and
// existing canonical serializer/compiler; no mounted browser, HTTP save or DB.
async function heading211Harness(slug: string) {
    const ts = (await import('typescript')).default
    const domain = await import('@letbuyy/theme-engine')
    const actions = await import('./editor-block-actions')
    const { createRequire } = await import('node:module')
    const tokens = createRequire(import.meta.url)('@letbuyy/ui/tokens').letbuyyPrimitiveTokens
    const file = new URL('../../app/[store]/online-store/themes/[themeId]/editor/page.tsx', import.meta.url)
    const source = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    // Reuse the unchanged existing test's actual-declaration extractor. It
    // contains no duplicated serializer and imports no Next/browser runtime.
    const existing = readFileSync(new URL('../../../tests/theme-draft-document.test.mjs', import.meta.url), 'utf8')
    const start = existing.indexOf('const declarations = new Map();'), end = existing.indexOf('\nfunction document()')
    assert.ok(start >= 0 && end > start)
    const extractor = existing.slice(start, end).replace('export const helpers', 'const helpers')
    const h = new Function('source', 'ts', 'assert', 'domain', 'letbuyyPrimitiveTokens', extractor + ';return helpers')(source, ts, assert, domain, tokens) as Record<string, Function>
    const execute = (code: string, dependencies: Record<string, unknown> = {}) => new Function('exports', ...Object.keys(dependencies), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)({}, ...Object.values(dependencies))
    const local = (name: string, dependencies: Record<string, unknown>) => {
        const node = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
        assert.ok(node); return execute(`${node.getText(source)};return ${name}`, dependencies) as Function
    }
    const expression = (name: string) => {
        let result: string | undefined
        const visit = (node: import('typescript').Node) => {
            if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isCallExpression(node.initializer)) result = node.initializer.arguments[0].getText(source)
            ts.forEachChild(node, visit)
        }; visit(source); assert.ok(result, `Actual callback ${name}`); return result
    }
    const bundle = domain.createFirstPartyCatalogBundle(slug, { customizationVersion: '2.1.1' })
    bundle.templates.index.sections['heading211-actions'] = { type: 'banner-carousel', settings: {}, disabled: false, blocks: {}, block_order: [] }
    bundle.templates.index.order.push('heading211-actions')
    const adapterPath = new URL('../../../../../../services/api-gateway/src/execution/schema-registry-execution.adapter.ts', import.meta.url)
    const tree = ts.createSourceFile(adapterPath.pathname, readFileSync(adapterPath, 'utf8'), ts.ScriptTarget.Latest, true)
    const code = tree.statements.filter(node => ts.isFunctionDeclaration(node) && ['asRecord', 'isLiquidBundle', 'buildBundleTemplateConfig'].includes(node.name?.text || '')).map(node => node.getText(tree)).join('\n')
    const base = execute(`${code};return buildBundleTemplateConfig`)(bundle)
    const manifest = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest
    const settings = h.normalizeSettingsSchema(manifest.settings_schema)
    const catalogs = Object.fromEntries(Object.entries(manifest.section_schemas).map(([key, schema]) => [key, actions.editorBlockCatalog(schema as ExtendedSectionSchema, bundle)]))
    const initial = h.normalizeEditorState(base, slug, 'index', manifest.section_schemas, settings) as import('./editor-view-state').EditorState
    const context: { state: typeof initial; history: { past: typeof initial[]; future: typeof initial[] }; selection: { kind: string; sectionId?: string; blockId?: string } | null; removal: unknown; dirty: boolean } = { state: initial, history: { past: [], future: [] }, selection: null, removal: null, dirty: false }
    const getSectionById = local('getSectionById', { getAllSections: h.getAllSections })
    const coerceFieldValue = local('coerceFieldValue', { numberValue: local('numberValue', {}) })
    const call = (name: string): Function => execute(`return (${expression(name)})`, {
        ...actions, ...h, getSectionById, coerceFieldValue, editorState: context.state, savedState: initial,
        history: context.history, blockCatalogs: catalogs, sectionSchemas: manifest.section_schemas, settingsSchema: settings, blockPendingRemoval: context.removal,
        setEditorState: (update: Function | typeof initial) => { context.state = typeof update === 'function' ? update(context.state) : update },
        setHistory: (update: Function) => { context.history = update(context.history) }, setIsDirty: (value: boolean) => { context.dirty = value },
        setSelection: (value: typeof context.selection) => { context.selection = value }, setBlockPendingRemoval: (value: unknown) => { context.removal = value },
        ...(name === 'applyChange' ? {} : { applyChange: call('applyChange') }), ...(name === 'addChildBlock' ? { addBlock: call('addBlock') } : {}),
    }) as Function
    const save = (templateKey = 'index') => {
        const wire = JSON.parse(JSON.stringify(h.buildDraftConfig(base, slug, context.state, templateKey)))
        assert.deepEqual(domain.collectThemeTemplateValidationIssues({ templateConfig: wire, runtime: { sectionSchemas: manifest.section_schemas, settingsSchema: settings }, themeSlug: slug }), [])
        const compiled = domain.compilePortableToLiquidBundle(wire, { baseBundle: bundle })
        assert.deepEqual(compiled.warnings, []); assert.equal(compiled.bundle.package.version, '2.1.1')
        assert.deepEqual(domain.fromThemeDocumentV2(JSON.parse(JSON.stringify(domain.toThemeDocumentV2(compiled.bundle)))), compiled.bundle)
        return { wire, bundle: compiled.bundle, reloaded: h.normalizeEditorState(wire, slug, templateKey, manifest.section_schemas, settings) }
    }
    return { domain, h, base, bundle, manifest, settings, context, getSectionById, call, save }
}
for (const slug of ['letbuyy-craft', 'letbuyy-dawn', 'letbuyy-nova', 'letbuyy-summit']) {
    test(`${slug}:actual211 page child callbacks, heading edit, compiler/document roundtrip and immutable editor undo snapshots`, async () => {
        const x = await heading211Harness(slug), id = 'heading211-actions'
        x.call('addBlock')(id, 'slide'); const first = x.context.selection!.blockId!
        x.call('addBlock')(id, 'slide'); const second = x.context.selection!.blockId!
        x.call('addChildBlock')(id, first, 'badge'); const child = x.context.selection!.blockId!
        x.call('updateBlockSetting')(id, child, 'label', 'Saved211 child')
        x.call('addChildBlock')(id, child, 'badge'); const grand = x.context.selection!.blockId!
        x.call('updateBlockSetting')(id, grand, 'label', 'Saved211 grandchild')
        const beforeRefusal = x.context.state, beforeHistory = x.context.history.past.length
        x.call('addChildBlock')(id, grand, 'badge'); x.call('addChildBlock')(id, first, '@app'); x.call('addChildBlock')(id, first, 'missing')
        x.call('requestRemoveChildBlock')(id, second, child)
        assert.equal(x.context.state, beforeRefusal); assert.equal(x.context.history.past.length, beforeHistory); assert.equal(x.context.removal, null)
        x.call('addChildBlock')(id, first, 'badge'); const sibling = x.context.selection!.blockId!
        x.call('moveBlock')(id, first, sibling, -1); x.call('toggleBlockVisibility')(id, child)
        const saved = x.save(), portable = saved.bundle.templates.index.sections[id]
        assert.deepEqual(portable.block_order, [first, second]); assert.deepEqual(portable.blocks[first].block_order, [sibling, child])
        assert.equal(portable.blocks[first].blocks[child].disabled, true); assert.equal(portable.blocks[first].blocks[child].blocks[grand].settings.label, 'Saved211 grandchild')
        assert.equal(x.h.getBlockById(x.getSectionById(saved.reloaded, id), child).visible, false)
        const earlierSnapshot = JSON.stringify(saved.bundle)
        const beforeDelete = x.context.state
        x.call('requestRemoveChildBlock')(id, first, child); assert.equal(x.context.state, beforeDelete, 'confirmation is not deletion')
        x.call('removeBlock')(); assert.equal(x.h.getBlockById(x.getSectionById(x.context.state, id), child), null)
        x.call('undo')(); assert.ok(x.h.getBlockById(x.getSectionById(x.context.state, id), child))
        x.call('redo')(); assert.equal(x.h.getBlockById(x.getSectionById(x.context.state, id), child), null)
        x.call('addChildBlock')(id, first, 'badge'); assert.notEqual(x.context.selection!.blockId, child)
        x.save(); assert.equal(JSON.stringify(saved.bundle), earlierSnapshot, 'earlier editor snapshot remains immutable')
        x.context.state = x.h.normalizeEditorState(x.base, slug, 'customers/order', x.manifest.section_schemas, x.settings)
        x.context.history = { past: [], future: [] }
        const detail = x.context.state.sections.template.find(section => section.type === 'customer-order-detail')!
        x.call('updateSectionSetting')(detail.id, 'heading', 'Editor211 heading')
        const orderSaved = x.save('customers/order')
        assert.equal(orderSaved.bundle.templates['customers/order'].sections[detail.id].settings.heading, 'Editor211 heading')
        assert.equal(orderSaved.reloaded.sections.template.find((section: SectionEntry) => section.id === detail.id).settings.heading, 'Editor211 heading')
        const rendered = await new x.domain.LiquidRenderer().render({context:{storeId:'source-only',subdomain:'synthetic',path:'/account/orders/source-only',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:slug,themeSettings:x.domain.DEFAULT_THEME_SETTINGS,sections:[]},liquidBundle:orderSaved.bundle,liquidTemplateKey:'customers/order',liquidContext:{shop:{name:'Source-only'},buyer:{id:'source-only'},order:{number:'ROUNDTRIP',status:'pending_cod',currency:'INR',total:100,line_items:[{title:'Saved source-only line',quantity:1,line_price:100,niche_facts_text:'Saved immutable source facts'}]}}})
        assert.equal(rendered.status, 'rendered'); assert.ok(rendered.liquid!.contentForLayout.includes('Editor211 heading #ROUNDTRIP'))
        assert.ok(rendered.liquid!.contentForLayout.includes('Saved immutable source facts'))
    })
}
