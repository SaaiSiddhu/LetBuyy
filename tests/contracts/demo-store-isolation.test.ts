import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const testDir = dirname(fileURLToPath(import.meta.url));
const storeServicePath = join(testDir, '../../apps/commerce/web/src/lib/store-service.ts');
const productServicePath = join(testDir, '../../apps/commerce/web/src/lib/product-service.ts');
const previewPagePath = join(testDir, '../../apps/commerce/web/src/app/preview/preview-content.tsx');
const demoShortcutPath = join(testDir, '../../apps/commerce/web/src/app/demo/urban-kicks/page.tsx');
const editorPagePath = join(testDir, '../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx');
const themeGovernancePath = join(testDir, '../../docs/governance/theme-engine-governance.md');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

// Extract the exact method or cache-wrapped property with the TypeScript parser.
// Prefix names, nested functions and declaration order cannot change its boundary.
function methodBody(source: string, methodName: string): string {
    const tree = ts.createSourceFile('service.ts', source, ts.ScriptTarget.Latest, true);
    const bodies: string[] = [];
    const visit = (node: ts.Node) => {
        if ((ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node))
            && node.name.getText(tree) === methodName) {
            if (ts.isMethodDeclaration(node) && node.body) bodies.push(node.body.getText(tree));
            if (ts.isPropertyAssignment(node)) {
                let value = node.initializer;
                if (ts.isCallExpression(value) && ts.isIdentifier(value.expression)
                    && value.expression.text === 'cache' && value.arguments.length === 1) value = value.arguments[0];
                assert.ok(ts.isArrowFunction(value) || ts.isFunctionExpression(value), `${methodName} must contain an actual function`);
                bodies.push(value.body.getText(tree));
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.equal(bodies.length, 1, `${methodName} must have exactly one declaration`);
    return bodies[0];
}

// The OLD helper, reproduced here only so this self-test can prove it was wrong — never applied to
// real source. A synthetic decoy stands in for store-service.ts's two same-prefix methods, in both
// possible declaration orders, since the real file's current order cannot demonstrate the failure.
function oldMethodBody(source: string, methodName: string): string {
    const marker = `async ${methodName}`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${methodName} must exist`);
    const nextMethod = source.indexOf('\n    async ', start + marker.length);
    return nextMethod === -1 ? source.slice(start) : source.slice(start, nextMethod);
}

function decoySource(longNameFirst: boolean): string {
    const shortMethod = `    async getStoreBySubdomain(subdomain: string) {\n        return SAFE_IMPLEMENTATION;\n    }\n`;
    const longMethod = `    async getStoreBySubdomainAnyStatus(subdomain: string) {\n        return isUrbanKicksDemoSubdomain(subdomain);\n    }\n`;
    return longNameFirst ? `class C {\n${longMethod}${shortMethod}}\n` : `class C {\n${shortMethod}${longMethod}}\n`;
}

test('TEST-2 self-test: the old extraction was genuinely wrong when the longer name is declared first, and the new one is correct in both orders', () => {
    const vulnerable = decoySource(true);

    // The defect, demonstrated: asking for the SHORT method's body returns the LONG method's body
    // instead, because "async getStoreBySubdomain" is a literal prefix of
    // "async getStoreBySubdomainAnyStatus" and indexOf finds whichever occurs first in the source.
    const oldBody = oldMethodBody(vulnerable, 'getStoreBySubdomain');
    assert.match(oldBody, /isUrbanKicksDemoSubdomain/, 'the old helper must be shown returning the WRONG (long-named) method\'s body — this is the failure being fixed, not a false alarm');

    // The fix: the same request on the same decoy returns the correct, short-named method's body.
    const newBody = methodBody(vulnerable, 'getStoreBySubdomain');
    assert.doesNotMatch(newBody, /isUrbanKicksDemoSubdomain/, 'the new helper must return the short method\'s own body, not the long one\'s');
    assert.match(newBody, /SAFE_IMPLEMENTATION/);

    // And it must not depend on which order the methods happen to be declared in.
    const otherOrder = decoySource(false);
    assert.doesNotMatch(methodBody(otherOrder, 'getStoreBySubdomain'), /isUrbanKicksDemoSubdomain/);
    assert.match(methodBody(otherOrder, 'getStoreBySubdomainAnyStatus'), /isUrbanKicksDemoSubdomain/);
});

test('cached declarations keep same-prefix and nested helper bodies separate in either order', () => {
    const short = 'getStoreBySubdomain: cache(async (handle: string) => { const nested = async () => SAFE_IMPLEMENTATION; return nested(); })';
    const long = 'getStoreBySubdomainAnyStatus: cache(async () => isUrbanKicksDemoSubdomain())';
    for (const properties of [[short, long], [long, short]]) {
        const source = `const service = { ${properties.join(',')} };`;
        assert.match(methodBody(source, 'getStoreBySubdomain'), /SAFE_IMPLEMENTATION/);
        assert.doesNotMatch(methodBody(source, 'getStoreBySubdomain'), /isUrbanKicksDemoSubdomain/);
        assert.match(methodBody(source, 'getStoreBySubdomainAnyStatus'), /isUrbanKicksDemoSubdomain/);
    }
});

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
