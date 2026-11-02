import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createFirstPartyCatalogBundle, buildPortableThemePackagePersistencePayload, createLetbuyyCoreLiquidThemeBundleFixture,
    getDefaultStorefrontThemeTemplate, getSectionSchemas, getThemeSettingsSchema, collectThemeTemplateValidationIssues, firstPartyThemeListings, ThemeBundleJsonObjectSchema } from '@letbuyy/theme-engine';
import { SchemaRegistryExecutionAdapter, type ThemeRegistryThemeInput } from '../execution/schema-registry-execution.adapter';
import { AppError } from '../lib/errors';

type Row = Record<string, unknown>;
const packageId = '7b669c70-f000-4000-8000-000000000020';
const themeId = '7b669c70-0000-4000-8000-000000000002';
const original = () => createFirstPartyCatalogBundle('letbuyy-sense');
function fixture() {
    const tables: Record<string, Row[]> = { theme_packages: [{ id: packageId, slug: 'letbuyy-sense', legacy_theme_id: themeId }],
        theme_package_versions: [], theme_schema_manifests: [], theme_renderer_manifests: [] };
    let failTable: string | undefined;
    const mutations: string[] = [];
    const db = { from(table: string) {
        const predicates: Array<(row: Row) => boolean> = [];
        let write: { row: Row; conflict: string[]; ignore: boolean } | undefined;
        const execute = () => {
            if (write) {
                if (failTable === table) { failTable = undefined; return { data: null, error: { code: 'SYNTHETIC_FAILURE', message: 'Synthetic write failure' } }; }
                const existing = tables[table].find(row => write!.conflict.every(key => row[key] === write!.row[key]));
                if (existing && !write.ignore) { Object.assign(existing, structuredClone(write.row)); mutations.push(table + ':update'); }
                if (!existing) { tables[table].push({ id: randomUUID(), ...structuredClone(write.row) }); mutations.push(table + ':insert'); }
                return { data: null, error: null };
            }
            return { data: tables[table].filter(row => predicates.every(predicate => predicate(row)))[0] || null, error: null };
        };
        const chain = {
            select(_columns: string) { return chain; },
            eq(key: string, value: unknown) { predicates.push(row => row[key] === value); return chain; },
            is(key: string, _value: null) { predicates.push(row => row[key] == null); return chain; },
            or(expression: string) { predicates.push(row => expression.split(',').some(clause => { const [key, , value] = clause.split('.'); return row[key] === value; })); return chain; },
            upsert(row: Row, options: { onConflict: string; ignoreDuplicates?: boolean }) { write = { row, conflict: options.onConflict.split(','), ignore: options.ignoreDuplicates === true }; return chain; },
            maybeSingle: async () => execute(),
            then(resolve: (result: ReturnType<typeof execute>) => unknown) { return Promise.resolve(execute()).then(resolve); },
        };
        return chain;
    } } as unknown as ConstructorParameters<typeof SchemaRegistryExecutionAdapter>[0];
    const theme = (bundle = original()): ThemeRegistryThemeInput => ({ id: themeId, slug: bundle.package.slug, name: bundle.package.name,
        version: bundle.package.version, schema_version: '1.0.0', renderer_version: '1.0.0', default_template: { liquidBundle: bundle } });
    const seedVersion = (bundle = original(), overrides: Row = {}) => {
        const payload = buildPortableThemePackagePersistencePayload(bundle), id = randomUUID();
        tables.theme_package_versions.push({ id, theme_package_id: packageId, ...payload.themePackageVersion, ...overrides });
        tables.theme_schema_manifests.push({ theme_package_version_id: id, ...payload.schemaManifest });
        tables.theme_renderer_manifests.push({ theme_package_version_id: id, ...payload.rendererManifest });
        return id;
    };
    return { tables, mutations, adapter: new SchemaRegistryExecutionAdapter(db), theme, seedVersion,
        failNext: (table: string) => { failTable = table; } };
}
const unavailable = (error: unknown) => error instanceof AppError && error.code === 'THEME_RUNTIME_UNAVAILABLE';

test('catalog2 materialization appends exact embedded commerce version without replacing captured1 or its stable package', async () => {
    const f = fixture(), old = original(); old.package.version = '1.0.0'; old.package.version_number = 1;
    const oldId = f.seedVersion(old), before = structuredClone(f.tables.theme_package_versions[0]);
    const runtime = await f.adapter.ensureThemePackageRuntime(f.theme()); assert.ok(runtime);
    assert.equal(runtime.themePackageId, packageId); assert.notEqual(runtime.themePackageVersionId, oldId);
    const current = f.tables.theme_package_versions.find(row => row.id === runtime.themePackageVersionId)!;
    assert.equal(current.version, '2.0.0'); assert.equal(current.version_number, 2);
    assert.equal(current.schema_version, original().schema_version); assert.notEqual(current.version, current.schema_version);
    assert.deepEqual(f.tables.theme_package_versions[0], before);
    const saved = structuredClone(f.tables);
    assert.deepEqual(await f.adapter.ensureThemePackageRuntime(f.theme()), runtime);
    assert.deepEqual(f.tables, saved, 'replay never updates captured content or timestamps');
    assert.ok(f.mutations.every(mutation => !mutation.endsWith(':update')));
});
test('exact semantic version is selected even when another published version has a larger ordering number', async () => {
    const f = fixture(), bundle = original(), expected = f.seedVersion(bundle);
    const newer = original(); newer.package.version = '3.0.0'; newer.package.version_number = 99; f.seedVersion(newer);
    assert.equal((await f.adapter.ensureThemePackageRuntime(f.theme(bundle)))?.themePackageVersionId, expected);
    assert.equal(f.tables.theme_package_versions.length, 2);
});
test('catalog/bundle version mismatch and an unpublished source refuse before registry writes', async () => {
    const f = fixture();
    await assert.rejects(f.adapter.ensureThemePackageRuntime({ ...f.theme(), version: '1.0.0' }), unavailable);
    const draft = original(); draft.package.release_status = 'draft';
    await assert.rejects(f.adapter.ensureThemePackageRuntime(f.theme(draft)), unavailable);
    await assert.rejects(f.adapter.ensureThemePackageRuntime({ ...f.theme(), default_template: { liquidBundle: {} } }), unavailable);
    assert.deepEqual(f.mutations, []);
});
test('a changed bundle cannot overwrite or impersonate an already captured semantic version', async () => {
    const f = fixture(); f.seedVersion(); const before = structuredClone(f.tables), changed = original();
    changed.config.settings_data.current.primaryColor = '#123456';
    await assert.rejects(f.adapter.ensureThemePackageRuntime(f.theme(changed)), (error: unknown) => error instanceof AppError && error.code === 'THEME_PACKAGE_VERSION_CONFLICT');
    assert.deepEqual(f.tables, before); assert.deepEqual(f.mutations, []);
});
test('a bundled catalog cannot use an exact legacy version without an immutable bundle capture', async () => {
    const f = fixture(); f.seedVersion(original(), { package_manifest: { source: 'legacy-theme' } });
    const before = structuredClone(f.tables);
    await assert.rejects(f.adapter.ensureThemePackageRuntime(f.theme()), unavailable);
    assert.deepEqual(f.tables, before); assert.deepEqual(f.mutations, []);
});
test('the existing non-bundle legacy schema contract remains readable without manufacturing a bundle capture', async () => {
    const f = fixture();
    const id = f.seedVersion(original(), { version: '1.0.0', schema_version: '1.0.0', package_manifest: { source: 'legacy-theme' } });
    const runtime = await f.adapter.ensureThemePackageRuntime({ ...f.theme(), version: '1.0.0', default_template: { themeId: 'letbuyy-sense' } });
    assert.equal(runtime?.themePackageVersionId, id); assert.equal(runtime?.schemaVersion, '1.0.0');
    assert.deepEqual(f.tables.theme_package_versions[0].package_manifest, { source: 'legacy-theme' });
});
test('failed manifest materialization retries missing inserts and preserves the already captured version', async () => {
    const f = fixture(); f.failNext('theme_schema_manifests');
    await assert.rejects(f.adapter.ensureThemePackageRuntime(f.theme()), unavailable);
    assert.equal(f.tables.theme_package_versions.length, 1); assert.equal(f.tables.theme_schema_manifests.length, 0);
    const version = structuredClone(f.tables.theme_package_versions[0]), renderer = structuredClone(f.tables.theme_renderer_manifests);
    await f.adapter.ensureThemePackageRuntime(f.theme());
    assert.deepEqual(f.tables.theme_package_versions[0], version); assert.deepEqual(f.tables.theme_renderer_manifests, renderer);
    assert.equal(f.tables.theme_schema_manifests.length, 1);
});
test('historical bundle captures cannot manufacture missing validation manifests from the current catalog', async () => {
    const f = fixture(); f.seedVersion(); f.tables.theme_schema_manifests = [];
    const before = structuredClone(f.tables);
    await assert.rejects(f.adapter.ensureThemePackageRuntime(f.theme()), unavailable);
    assert.deepEqual(f.tables, before); assert.deepEqual(f.mutations, []);
});
test('captured empty global schemas declare no fields and incomplete historical manifests cannot inherit current defaults', async () => {
    const f = fixture(), id = f.seedVersion();
    const schema = f.tables.theme_schema_manifests.find(row => row.theme_package_version_id === id)!;
    schema.settings_schema = {};
    const runtime = await f.adapter.resolveThemeRuntime(f.theme());
    assert.deepEqual(runtime.settingsSchema.settings, {});
    for (const settings_schema of [null, [], { settings: null }]) {
        schema.settings_schema = settings_schema;
        await assert.rejects(f.adapter.resolveThemeRuntime(f.theme()), unavailable);
    }
    schema.settings_schema = {};
    delete schema.section_schemas;
    await assert.rejects(f.adapter.resolveThemeRuntime(f.theme()), unavailable);
});
function legacyCore() {
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    const document = { ...getDefaultStorefrontThemeTemplate('letbuyy-core', {}), liquidBundle: bundle, themeId: 'letbuyy-sense' };
    return { id: themeId, slug: 'letbuyy-sense', name: 'Legacy Core style', version: bundle.package.version,
        schema_version: '1.0.0', default_template: document, renderer_manifest: bundle.renderer,
        section_schemas: getSectionSchemas('letbuyy-core'), settings_schema: { ...getThemeSettingsSchema('letbuyy-core') } };
}
test('the genuine Core/372 legacy slot contract and a private Core copy retain strict default roundtrips', async () => {
    for (const is_site_private of [false, true]) {
        const f = fixture(), theme = { ...legacyCore(), is_site_private };
        const runtime = await f.adapter.resolveThemeRuntime(theme);
        assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: theme.default_template, runtime, themeSlug: theme.slug }), []);
        const manifest = f.tables.theme_package_versions[0].package_manifest as Row;
        assert.equal((manifest.registry_validation_capture as Row).format, 'catalog-legacy-slots-v1');
    }
});
function historical372() {
    const listing = firstPartyThemeListings().find(item => item.slug === 'letbuyy-forge')!;
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    bundle.package.slug = listing.slug;
    bundle.package.name = listing.name;
    bundle.config.settings_data.current = ThemeBundleJsonObjectSchema.parse({ ...bundle.config.settings_data.current, ...listing.settings });
    const document = { ...getDefaultStorefrontThemeTemplate('letbuyy-core', {}), themeId: listing.slug,
        experienceId: listing.presetId, rendererEngine: 'liquid', liquidBundle: bundle };
    document.themeSettings = { ...document.themeSettings, ...listing.settings };
    // Persisted Core/372 appearance schema observed in run54884f7b6bbd;
    // unlike today's source helper, it also declares surface/body-font fields.
    const settings_schema = { schema_version: '1.0', settings: { appearance: { label: 'Appearance', fields: {
        ...Object.fromEntries(['textColor', 'fontFamily', 'accentColor', 'primaryColor', 'surfaceColor', 'bodyFontFamily',
            'secondaryColor', 'backgroundColor', 'headingFontFamily'].map(id => [id, { type: 'text', label: id }])),
        ...Object.fromEntries(['isDark', 'enableShadows', 'enableAnimations'].map(id => [id, { type: 'toggle', label: id }])),
        borderRadius: { type: 'number', label: 'Corner radius' },
    } } } };
    return { ...legacyCore(), id: listing.id, slug: listing.slug, config: { preset_id: listing.presetId },
        default_template: document, section_schemas: {}, settings_schema };
}
test('actual372 empty-map catalog defaults capture the existing strict canonical contract without altering immutable retries', async () => {
    const f = fixture(), theme = historical372();
    const runtime = await f.adapter.resolveThemeRuntime(theme);
    assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: theme.default_template, runtime, themeSlug: theme.slug }), []);
    assert.deepEqual(runtime.sectionSchemas, getSectionSchemas(theme.slug));
    const before = structuredClone(f.tables);
    assert.equal(((before.theme_package_versions[0].package_manifest as Row).registry_validation_capture as Row).format, 'catalog-legacy-slots-v1');
    await f.adapter.resolveThemeRuntime(theme);
    assert.deepEqual(f.tables, before, 'same historical package retry cannot rewrite its captures or manifests');
    const changed = structuredClone(theme.default_template);
    changed.sections.header.settings.unverifiedAlias = true;
    assert.ok(collectThemeTemplateValidationIssues({ templateConfig: changed, runtime, themeSlug: theme.slug }).some(issue => issue.includes('unverifiedAlias is not defined')));
});
test('the exact public Core empty-map footprint captures canonical schemas while foreign/private identities stay portable', async () => {
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    const core = { ...legacyCore(), slug: 'letbuyy-core', config: {}, section_schemas: {},
        default_template: { ...getDefaultStorefrontThemeTemplate('letbuyy-core', {}), liquidBundle: bundle, rendererEngine: 'liquid' } };
    const f = fixture(), runtime = await f.adapter.resolveThemeRuntime(core);
    assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: core.default_template, runtime, themeSlug: core.slug }), []);
    assert.deepEqual(runtime.sectionSchemas, getSectionSchemas('letbuyy-core'));
    for (const patch of [{ is_site_private: true }, { slug: 'private-core-copy' }, { config: { preset_id: 'forge' } }]) {
        const denied = fixture();
        await denied.adapter.resolveThemeRuntime({ ...core, ...patch });
        assert.equal(((denied.tables.theme_package_versions[0].package_manifest as Row).registry_validation_capture as Row).format, 'portable-bundle-v1');
    }
});
test('the observed197 Core row without a root renderer flag requires exact provenance and retains strict immutable schemas', async () => {
    const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
    const document = { ...getDefaultStorefrontThemeTemplate('letbuyy-core', {}), liquidBundle: bundle };
    Reflect.deleteProperty(document, 'rendererEngine');
    document.themeSettings = { ...document.themeSettings, surfaceColor: '#FFFFFF', bodyFontFamily: 'Inter' };
    const renderer_manifest = { engine: 'theme-engine-v1', provenance: { mode: 'insert', migration: '197_letbuyy_core_first_class_theme' } };
    const core = { ...legacyCore(), slug: 'letbuyy-core', config: {}, section_schemas: {}, renderer_manifest,
        settings_schema: historical372().settings_schema, default_template: document };
    const f = fixture(), runtime = await f.adapter.resolveThemeRuntime(core);
    assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: document, runtime, themeSlug: core.slug }), []);
    assert.equal(((f.tables.theme_package_versions[0].package_manifest as Row).registry_validation_capture as Row).format, 'catalog-legacy-slots-v1');
    const before = structuredClone(f.tables);
    await f.adapter.resolveThemeRuntime(core);
    assert.deepEqual(f.tables, before);
    for (const patch of [{ renderer_manifest: {} },
        { renderer_manifest: { ...renderer_manifest, provenance: { mode: 'insert', migration: 'unverified' } } },
        { default_template: { ...document, rendererEngine: null } }, { is_site_private: true }, { owned_by_site_id: randomUUID() }]) {
        const rejected = fixture();
        const foreign = { ...core, ...patch };
        const strictRuntime = await rejected.adapter.resolveThemeRuntime(foreign);
        assert.equal(((rejected.tables.theme_package_versions[0].package_manifest as Row).registry_validation_capture as Row).format, 'portable-bundle-v1');
        assert.ok(collectThemeTemplateValidationIssues({ templateConfig: foreign.default_template, runtime: strictRuntime, themeSlug: foreign.slug }).length > 0);
    }
});
test('empty-map recognition requires the exact historical identity/preset/slots and never widens private or portable contracts', async () => {
    const historical = historical372();
    for (const patch of [
        { id: randomUUID() }, { slug: 'third-party-design' }, { config: { preset_id: 'sense' } },
        { is_site_private: true }, { owned_by_site_id: randomUUID() }, { config: { preset_id: 'forge', theme_bundle: true } },
        { default_template: { ...historical.default_template, experienceId: 'sense' } },
        { default_template: { ...historical.default_template, themeId: 'letbuyy-sense' } },
        { default_template: { ...historical.default_template, schema_version: '1.0.0' } },
        { default_template: { ...historical.default_template, rendererEngine: 'json' } },
        { default_template: { ...historical.default_template, sections: { ...historical.default_template.sections,
            header: { ...historical.default_template.sections.header, type: 'third-party-header' } } } },
    ]) {
        const f = fixture(), theme = { ...historical, ...patch };
        const runtime = await f.adapter.resolveThemeRuntime(theme);
        assert.equal(((f.tables.theme_package_versions[0].package_manifest as Row).registry_validation_capture as Row).format, 'portable-bundle-v1');
        assert.ok(collectThemeTemplateValidationIssues({ templateConfig: theme.default_template, runtime, themeSlug: theme.slug }).length > 0);
    }
});
test('modern portable1 and2 never acquire legacy aliases from a populated section map or catalog schemas', async () => {
    for (const version of ['1.0.0', '2.0.0']) {
        const f = fixture(), bundle = original(); bundle.package.version = version;
        const legacy = legacyCore();
        const theme = { ...f.theme(bundle), section_schemas: legacy.section_schemas, settings_schema: legacy.settings_schema,
            default_template: { ...legacy.default_template, schema_version: bundle.schema_version, liquidBundle: bundle } };
        const runtime = await f.adapter.resolveThemeRuntime(theme);
        const manifest = f.tables.theme_package_versions[0].package_manifest as Row;
        assert.equal((manifest.registry_validation_capture as Row).format, 'portable-bundle-v1');
        assert.ok(collectThemeTemplateValidationIssues({ templateConfig: theme.default_template, runtime, themeSlug: theme.slug }).some(issue => issue.includes('logoUrl is not defined')));
        const pure = { themeId: theme.slug, schema_version: bundle.schema_version, liquidBundle: bundle,
            themeSettings: bundle.config.settings_data.current, templates: bundle.templates, sections: {} };
        assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: pure, runtime, trustedPreviousConfig: { templates: bundle.templates }, themeSlug: theme.slug }), []);
        if (version === '1.0.0') {
            const marked = fixture();
            const markedTheme = { ...theme, config: { theme_bundle: true }, default_template: { ...legacy.default_template, liquidBundle: bundle } };
            const markedRuntime = await marked.adapter.resolveThemeRuntime(markedTheme);
            assert.ok(collectThemeTemplateValidationIssues({ templateConfig: markedTheme.default_template, runtime: markedRuntime, themeSlug: theme.slug }).some(issue => issue.includes('logoUrl is not defined')));
        }
    }
});
test('validation captures reject executable and oversized values before any materialization', async () => {
    for (const renderer_manifest of [{ unexpected: () => true }, { unexpected: 'x'.repeat(256_001) }]) {
        const f = fixture();
        await assert.rejects(f.adapter.ensureThemePackageRuntime({ ...legacyCore(), renderer_manifest }), unavailable);
        assert.deepEqual(f.mutations, []);
    }
});
test('partial legacy manifest retry uses its capture; changed same-version schemas fail without writes', async () => {
    const f = fixture(), theme = legacyCore(); f.failNext('theme_schema_manifests');
    await assert.rejects(f.adapter.ensureThemePackageRuntime(theme), unavailable);
    const before = structuredClone(f.tables), mutated = structuredClone(theme);
    mutated.section_schemas.header.settings_schema.unverifiedAlias = { type: 'text', label: 'Unverified alias' };
    await assert.rejects(f.adapter.ensureThemePackageRuntime(mutated), (error: unknown) => error instanceof AppError && error.code === 'THEME_PACKAGE_VERSION_CONFLICT');
    assert.deepEqual(f.tables, before);
    await f.adapter.ensureThemePackageRuntime({ ...theme, name: 'Metadata-only change' });
    assert.deepEqual(f.tables.theme_package_versions, before.theme_package_versions);
    assert.deepEqual(f.tables.theme_renderer_manifests, before.theme_renderer_manifests);
    const capture = (f.tables.theme_package_versions[0].package_manifest as Row).registry_validation_capture as Row;
    const expected = capture.schema as Row;
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(f.tables.theme_schema_manifests[0][key], value);
});
test('revoked exact versions stay revoked and historical package aliases keep their UUID', async () => {
    const f = fixture(); f.seedVersion(original(), { release_status: 'revoked' });
    const before = structuredClone(f.tables);
    await assert.rejects(f.adapter.ensureThemePackageRuntime(f.theme()), unavailable);
    assert.deepEqual(f.tables, before);
    const aliases = fixture(); aliases.tables.theme_packages[0].slug = 'historical-package-alias';
    const runtime = await aliases.adapter.ensureThemePackageRuntime(aliases.theme());
    assert.equal(runtime?.themePackageId, packageId); assert.equal(aliases.tables.theme_packages.length, 1);
});
