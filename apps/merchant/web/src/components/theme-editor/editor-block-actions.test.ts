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
