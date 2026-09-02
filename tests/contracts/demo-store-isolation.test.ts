import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const storeServicePath = join(testDir, '../../apps/customer_web/src/lib/store-service.ts');
const productServicePath = join(testDir, '../../apps/customer_web/src/lib/product-service.ts');
const previewPagePath = join(testDir, '../../apps/customer_web/src/app/preview/page.tsx');
const demoShortcutPath = join(testDir, '../../apps/customer_web/src/app/demo/urban-kicks/page.tsx');
const editorPagePath = join(testDir, '../../apps/merchant_web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx');
const themeGovernancePath = join(testDir, '../../docs/governance/theme-engine-governance.md');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

function methodBody(source: string, methodName: string): string {
    const marker = `async ${methodName}`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${methodName} must exist`);
    const nextMethod = source.indexOf('\n    async ', start + marker.length);
    return nextMethod === -1 ? source.slice(start) : source.slice(start, nextMethod);
}

test('real storefront store reads do not short-circuit to the Urban Kicks demo fixture', () => {
    const source = read(storeServicePath);

    for (const method of ['getStoreBySubdomain', 'getPreviewStoreBySubdomain', 'getStoreBySubdomainAnyStatus', 'getStoreById']) {
        const body = methodBody(source, method);
        assert.doesNotMatch(body, /isUrbanKicksDemoSubdomain/);
        assert.doesNotMatch(body, /getUrbanKicksDemoStore\(/);
        assert.doesNotMatch(body, /demo-urban-kicks-store/);
    }

    assert.match(source, /getUrbanKicksDemoStore\(\): StoreModel/);
});

test('real storefront product reads do not short-circuit to demo products', () => {
    const source = read(productServicePath);

    for (const method of ['getProductsByIds', 'getProductsByStoreSubdomain', 'getProductsByStoreId', 'getProductById']) {
        const body = methodBody(source, method);
        assert.doesNotMatch(body, /isUrbanKicksDemoSubdomain/);
        assert.doesNotMatch(body, /getUrbanKicksDemoProduct/);
        assert.doesNotMatch(body, /getUrbanKicksDemoProducts/);
        assert.doesNotMatch(body, /demo-urban-kicks-store/);
    }

    assert.match(source, /getUrbanKicksDemoProducts\(productIds\?: string\[\]\): Promise<ProductModel\[\]>/);
});

test('Urban Kicks demo preview is explicit and does not masquerade as a tenant store', () => {
    const preview = read(previewPagePath);
    const shortcut = read(demoShortcutPath);

    assert.match(shortcut, /\/preview\?demo=urban-kicks&subdomain=/);
    assert.match(preview, /demo\?: string \| string\[\]/);
    assert.match(preview, /isUrbanKicksDemoPreview\(query/);
    assert.match(preview, /StoreService\.getUrbanKicksDemoStore\(\)/);
    assert.match(preview, /ProductService\.getUrbanKicksDemoProducts/);
    assert.doesNotMatch(preview, /return URBAN_KICKS_DEMO_SUBDOMAIN;/);
    assert.match(preview, /Open Urban Kicks demo/);
    assert.match(preview, /demo=urban-kicks/);
});

test('theme editor does not force-inject Urban Kicks sections into every theme', () => {
    const source = read(editorPagePath);

    assert.doesNotMatch(source, /REQUIRED_URBAN_KICKS_SECTIONS/);
    assert.doesNotMatch(source, /fallbackTemplateEntries/);
    assert.doesNotMatch(source, /announcementBar[\s\S]*heroBanner[\s\S]*categoryGrid[\s\S]*featuredProducts[\s\S]*productGrid[\s\S]*newsletter/);
});

test('theme orphan tables are documented as reserved or read-only instead of claimed live', () => {
    const source = read(themeGovernancePath);
    const tables = [
        'theme_assets',
        'theme_layouts',
        'theme_templates',
        'theme_section_definitions',
        'theme_block_definitions',
        'theme_template_assignments',
        'theme_migrations',
        'theme_presets',
        'theme_draft_patches',
        'theme_reviews',
    ];

    for (const table of tables) {
        assert.match(source, new RegExp(`\\b${table}\\b`), `${table} must be dispositioned`);
    }
    assert.match(source, /schema-reserved/);
    assert.match(source, /write-only audit/);
    assert.match(source, /review submission surface is not implemented/);
});
