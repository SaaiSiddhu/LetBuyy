import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstPartyCatalogBundle, createLetbuyyCoreLiquidThemeBundleFixture, getDefaultStorefrontThemeTemplate,
    getSectionSchemas, getThemeSettingsSchema } from '@letbuyy/theme-engine';
import { ThemeExecutionAdapter } from '../execution/theme-execution.adapter';
import { AppError } from '../lib/errors';
import type { ThemeRuntimeSchema } from '../execution/schema-registry-execution.adapter';
const source = { id: '7b669c70-f000-4000-8000-000000000001', slug: 'letbuyy-sense', name: 'Threadline', version: '2.0.0', schema_version: '1.0.0', renderer_version: '0.1.0' };
const adapter = new ThemeExecutionAdapter({} as ConstructorParameters<typeof ThemeExecutionAdapter>[0]);
const definition = Reflect.get(adapter, 'privateThemeDefinition') as (source: Record<string, unknown>, config: Record<string, unknown>) => Record<string, unknown>;
test('a private Threadline copy retains its confirmed commerce version independently of schema/renderer formats', () => {
    const config = { themeId: 'private-copy', liquidBundle: createFirstPartyCatalogBundle('letbuyy-sense') };
    const copy = definition.call(adapter, source, config);
    assert.equal(copy.version, '2.0.0'); assert.equal(copy.schema_version, '1.0.0'); assert.equal(copy.renderer_version, '0.1.0');
    assert.deepEqual(copy.default_template, config);
});
test('missing source version may use a strictly parsed embedded version without inventing a1default', () => {
    const copy = definition.call(adapter, { ...source, version: undefined }, { liquidBundle: createFirstPartyCatalogBundle('letbuyy-sense') });
    assert.equal(copy.version, '2.0.0');
});
test('a private copy refuses mismatched, malformed and unprovable source version metadata', () => {
    for (const [record, config] of [
        [{ ...source, version: '1.0.0' }, { liquidBundle: createFirstPartyCatalogBundle('letbuyy-sense') }],
        [{ ...source, version: ' invalid' }, { liquidBundle: createFirstPartyCatalogBundle('letbuyy-sense') }],
        [{ ...source, version: undefined }, { liquidBundle: {} }],
        [{ ...source, version: undefined }, {}],
    ]) assert.throws(() => definition.call(adapter, record, config), (error: unknown) => error instanceof AppError && error.code === 'THEME_STATE_UNAVAILABLE');
});

function blankFixture() {
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    const core = { ...source, slug: 'letbuyy-core', version: '1.0.0', section_schemas: {}, settings_schema: {}, renderer_manifest: {} };
    const config = { ...getDefaultStorefrontThemeTemplate('letbuyy-core', {}), liquidBundle: bundle, themeId: 'site-theme-synthetic-blank' };
    config.sections.template = [];
    const runtime: ThemeRuntimeSchema = { source: 'database', themePackageId: source.id,
        themePackageVersionId: '7b669c70-f000-4000-8000-000000000002', schemaManifestVersion: '1.0.0', rendererVersion: '1.0.0',
        sectionSchemas: getSectionSchemas('letbuyy-core'), settingsSchema: getThemeSettingsSchema('letbuyy-core'),
        blockSchemas: {}, templateSchema: {}, layoutSchema: {}, rendererManifest: bundle.renderer,
        approvedRendererKeys: ['letbuyy-core', 'default'], assetManifest: {}, performanceBudget: {} };
    const target = new ThemeExecutionAdapter({} as ConstructorParameters<typeof ThemeExecutionAdapter>[0]);
    Reflect.set(target, 'schemaRegistry', { resolveThemeRuntime: async () => runtime });
    const capture = Reflect.get(target, 'privateBlankThemeDefinition') as (theme: Record<string, unknown>, config: Record<string, unknown>, slug: string) => Promise<Record<string, unknown>>;
    return { core, config, runtime, capture: () => capture.call(target, core, config, 'site-theme-synthetic-blank') };
}
test('a new blank copies its validated immutable Core contract before private package materialization', async () => {
    const f = blankFixture(), before = structuredClone(f.runtime), copy = await f.capture();
    assert.deepEqual(copy.section_schemas, f.runtime.sectionSchemas);
    assert.deepEqual(copy.settings_schema, f.runtime.settingsSchema);
    assert.deepEqual(copy.renderer_manifest, f.runtime.rendererManifest);
    assert.equal(copy.schema_version, f.runtime.schemaManifestVersion);
    assert.equal(copy.renderer_version, f.runtime.rendererVersion);
    assert.equal(copy.version, '1.0.0');
    assert.deepEqual(copy.default_template, f.config);
    assert.notEqual(copy.section_schemas, f.runtime.sectionSchemas);
    assert.deepEqual(f.runtime, before);
    assert.deepEqual(f.core.section_schemas, {}, 'the canonical source row is never rewritten');
});
test('a blank fails before private persistence when source capture is unconfirmed or defaults contain unknown fields', async () => {
    const unconfirmed = blankFixture(); unconfirmed.runtime.source = 'legacy';
    await assert.rejects(unconfirmed.capture(), (error: unknown) => error instanceof AppError && error.code === 'THEME_STATE_UNAVAILABLE');
    const invalid = blankFixture(); invalid.config.sections.header.settings.unverifiedAlias = true;
    await assert.rejects(invalid.capture(), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
    const foreignIdentity = blankFixture(); foreignIdentity.config.themeId = 'another-theme';
    await assert.rejects(foreignIdentity.capture(), (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR');
});
