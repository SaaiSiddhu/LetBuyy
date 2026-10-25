/** Bounded cross-boundary evidence; no DB, app server, React section or runtime registration. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    buildLiquidThemePackagePersistencePayload, collectLiquidThemePackageBundleIssues,
    collectThemeTemplateValidationIssues, DEFAULT_THEME_SETTINGS, getSectionSchemas, LiquidRenderer,
    type ThemeTemplateValidationRuntime,
} from '../../../../packages/theme-engine/src/index';
import { createHabitatTheme } from '../../../../packages/theme-engine/src/habitat-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core';
import { fromThemeDocumentV2, parseThemeDocument, toThemeDocumentV2 } from '../../../../packages/theme-engine/src/theme-document';
import { resolveStorefrontTemplate } from '../../../../apps/commerce/web/src/lib/theme-engine/template-resolver';
import type { StoreModel } from '../../../../packages/tenant-core/src/index';

const guideType = 'habitat-measurement-guide';
const guideId = 'habitat-measurement-guide';
function fixture() {
    const bundle = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture());
    bundle.templates.index.sections[guideId].settings.title = 'Merchant measurement instructions';
    return fromThemeDocumentV2(parseThemeDocument(toThemeDocumentV2(bundle)));
}

test('the guide is a strict roundtrippable bundle-owned Liquid section in the canonical persistence manifest', () => {
    const bundle = fixture();
    assert.deepEqual(collectLiquidThemePackageBundleIssues(bundle), []);
    assert.deepEqual(fromThemeDocumentV2(parseThemeDocument(toThemeDocumentV2(bundle))), bundle);
    const payload = buildLiquidThemePackagePersistencePayload(bundle);
    const schema = payload.schemaManifest.section_schemas[guideType] as Record<string, unknown>;
    assert.ok(schema); assert.equal(schema.type, guideType);
    assert.equal(schema.renderer_key, `liquid.section.${guideType}`);
    assert.equal(schema.source_path, `sections/${guideType}.liquid`);
    assert.ok((schema.settings_schema as Record<string, unknown>).step1Text);
    assert.ok(payload.rendererManifest.approved_renderer_keys.includes(`liquid.section.${guideType}`));
    const invalid = structuredClone(bundle); delete invalid.sections[guideType];
    assert.ok(collectLiquidThemePackageBundleIssues(invalid).length > 0, 'Removing the actual section file is rejected');
});

test('canonical draft validator accepts the full Habitat template and bundle using its package schemas, and fails closed without the guide schema', () => {
    const bundle = fixture();
    const payload = buildLiquidThemePackagePersistencePayload(bundle);
    const templateConfig = {
        themeId: bundle.package.slug,
        themeSettings: bundle.config.settings_data.current,
        sections: {},
        templates: bundle.templates,
        liquidBundle: bundle,
    };
    const runtime: ThemeTemplateValidationRuntime = {
        sectionSchemas: payload.schemaManifest.section_schemas as ThemeTemplateValidationRuntime['sectionSchemas'],
        settingsSchema: payload.schemaManifest.settings_schema as unknown as ThemeTemplateValidationRuntime['settingsSchema'],
    };
    const validate = (sectionSchemas: ThemeTemplateValidationRuntime['sectionSchemas']) => collectThemeTemplateValidationIssues({ templateConfig, themeSlug: bundle.package.slug, runtime: { ...runtime, sectionSchemas } });
    assert.deepEqual(validate(runtime.sectionSchemas), []);
    const globals = getSectionSchemas(bundle.package.slug);
    assert.equal(globals[guideType], undefined, 'This is not claimed as globally registered');
    assert.ok(validate(globals).some(issue => issue.includes(guideType) && issue.includes('not registered')));
});

test('canonical storefront resolver retains the guide and the real data planner needs no product service for its text settings', async () => {
    const bundle = fixture();
    const store: StoreModel = {
        id: '11111111-1111-4111-8111-111111111111', sellerId: '22222222-2222-4222-8222-222222222222',
        name: 'Owned Habitat section fixture', subdomain: 'habitat-section-acceptance', siteType: 'store', status: 'draft',
        selectedProductIds: [], createdAt: '2026-10-23T00:00:00.000Z',
        templateConfig: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [], liquidBundle: bundle, liquidRenderingCanary: true },
    };
    const route = { type: 'index' as const, path: '/', subdomain: store.subdomain };
    const plan = resolveStorefrontTemplate(store, route);
    assert.equal(plan.rendererEngine, 'liquid'); assert.equal(plan.liquidTemplateMiss, false);
    const guide = plan.template.sections.find(section => section.id === guideId);
    assert.ok(guide); assert.equal(guide.type, guideType); assert.equal(guide.rendererKey, `liquid.section.${guideType}`);
    assert.equal(guide.settings.title, 'Merchant measurement instructions');
    const file = new URL('../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts', import.meta.url);
    const requireLocal = createRequire(file);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    let serviceCalls = 0;
    const service = new Proxy({}, { get: () => async () => { serviceCalls++; throw new Error('Actual product service positive control'); } });
    const compiled = { exports: {} };
    const appSrc = new URL('../../../../apps/commerce/web/src/', import.meta.url);
    new Function('require', 'module', 'exports', code)((id: string) => {
        if (id === '@/lib/product-service') return { ProductService: service };
        // Resolve the host's normal @/ alias to real source; only the side-effect
        // boundary above is guarded, exactly as in the existing app tests.
        return requireLocal(id.startsWith('@/') ? fileURLToPath(new URL(id.slice(2), appSrc)) : id);
    }, compiled, compiled.exports);
    const { buildSectionDataPlan } = compiled.exports as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/data-binding-engine');
    const data = await buildSectionDataPlan({ store, route, sections: [guide] });
    assert.equal(data.size, 0); assert.equal(serviceCalls, 0, 'Text-only guide needs no independent product resource binding');
    const rendered = await new LiquidRenderer().render({
        context: { storeId: store.id, subdomain: store.subdomain, path: '/', previewMode: true, locale: 'en-IN' },
        storeTemplate: store.templateConfig, routeTemplate: plan.template,
        liquidBundle: plan.liquidBundle, liquidTemplateKey: plan.liquidTemplateKey,
        liquidContext: { shop: { name: store.name }, collection: { products: [] }, collections: [] },
    });
    assert.equal(rendered.status, 'rendered'); assert.deepEqual(rendered.warnings, []);
    assert.match(rendered.liquid!.contentForLayout, /Merchant measurement instructions/);
    assert.doesNotMatch(rendered.liquid!.contentForLayout, /data-theme-section-fallback="true"/);
    await assert.rejects(buildSectionDataPlan({ store, route, sections: [{ ...guide, id: 'positive-product-section', type: 'product-grid', rendererKey: 'liquid.section.product-grid', settings: {} }] }), /Actual product service positive control/);
    assert.ok(serviceCalls > 0, 'A product section reaches the live service guard; this is not an inert data planner');
});
