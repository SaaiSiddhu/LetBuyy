import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
const core = await import(pathToFileURL(resolve(process.cwd(), 'packages/commerce-core/src/storefront-discovery.ts')));
const out = resolve(process.cwd(), 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/facet-private-implementation-03');
const evaluate = (path, imports) => {
  const source = readFileSync(path, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', result)(name => { assert.ok(Object.hasOwn(imports, name), `unbound actual import: ${name}`);return imports[name]; }, exports);
  return exports;
};
const route = evaluate(resolve(process.cwd(), 'apps/commerce/web/src/lib/theme-engine/discovery-route-query.ts'), { '@letbuyy/commerce-core': core });
const app = evaluate(resolve(process.cwd(), 'apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts'), { '@letbuyy/commerce-core': core, './discovery-route-query': route });
const productId = '22222222-2222-4222-8222-222222222222';
const fixture = (query, facets = [], total = 1) => ({ data: total ? [{ id: productId, price: 1200 }] : [], total, page: query.page, limit: query.limit, has_more: false,
  discovery: { query, facets, matches: total ? [{ product_id: productId, price: 1200, variant_ids: [] }] : [] } });

test('both canonical controls normalize strict scalar inputs without weakening existing ten-theme keys', () => {
  const parsed = core.StorefrontDiscoveryQuerySchema.parse({ electronics_manufacturer: ' Synthetic Lab ', compatibility_evidence: 'supplied', connector: ['usb-c','hdmi'], power_output_w: '45', books_language: 'Hindi', pack_size: 'g:250' });
  assert.equal(parsed.electronics_manufacturer, 'Synthetic Lab');assert.equal(parsed.compatibility_evidence, 'supplied');
  assert.equal(parsed.books_language, 'Hindi');assert.equal(parsed.pack_size, 'g:250');assert.equal(parsed.power_output_w, 45);
  assert.equal(core.StorefrontDiscoveryQuerySchema.parse({ electronics_manufacturer: ' ', compatibility_evidence: '' }).electronics_manufacturer, undefined);
  for (const bad of [{ electronics_manufacturer: 'x'.repeat(121) }, { electronics_manufacturer: 1 }, { electronics_manufacturer: ['A','B'] }, { compatibility_evidence: true }, { compatibility_evidence: 'compatible' }, { compatibility_evidence: ['supplied','unconfirmed'] }, { compatibility_evidence: 'SUPPLIED' }, { manufacturer: 'A' }, { compatible: true }]) assert.equal(core.StorefrontDiscoveryQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
});
test('actual route parser and clear URLs retain all other scopes and refuse repeated scalar ambiguity', () => {
  const parsed = route.discoveryRouteQuery(new URLSearchParams('electronics_manufacturer=Synthetic+Lab&compatibility_evidence=supplied&connector=usb-c&connector=hdmi&search=Synthetic+H1&sort=price-asc&page=3'));
  const cleared = new URL(core.clearStorefrontDiscoveryFilterUrl('/store/circuit/products', parsed, 'compatibility_evidence'), 'https://example.invalid');
  assert.equal(cleared.searchParams.has('compatibility_evidence'), false);assert.equal(cleared.searchParams.has('page'), false);
  assert.equal(cleared.searchParams.get('electronics_manufacturer'), 'Synthetic Lab');assert.equal(cleared.searchParams.get('search'), 'Synthetic H1');assert.equal(cleared.searchParams.get('sort'), 'price-asc');assert.deepEqual(cleared.searchParams.getAll('connector'), ['hdmi','usb-c']);
  assert.throws(() => route.discoveryRouteQuery(new URLSearchParams('electronics_manufacturer=A&electronics_manufacturer=B')));
  assert.throws(() => route.discoveryRouteQuery(new URLSearchParams('compatibility_evidence=supplied&compatibility_evidence=unconfirmed')));
  const hostile = "x%' OR 1=1; -- <img>";
  assert.equal(route.discoveryRouteQuery(new URLSearchParams({ electronics_manufacturer: hostile })).electronics_manufacturer, hostile);
});
test('same-response public facets label evidence precisely and retain available count/selection', () => {
  const query = core.StorefrontDiscoveryQuerySchema.parse({ electronics_manufacturer: 'SYNTHETIC LAB', compatibility_evidence: 'supplied' });
  const facets = [{ key: 'electronics_manufacturer', value: 'synthetic lab', label: 'Synthetic Lab', count: 1 }, { key: 'compatibility_evidence', value: 'supplied', label: 'supplied', count: 1 }];
  const page = fixture(query, facets);app.validateDiscoveryProductPage(page, query);
  const result = app.projectDiscoveryPage(page, '/products', query);
  assert.equal(result.collection.capabilities.electronics_filters, true);
  assert.deepEqual(result.collection.electronics_facets.map(x => [x.key,x.label,x.count,x.selected]), [['electronics_manufacturer','Synthetic Lab',1,true],['compatibility_evidence','Device references supplied',1,true]]);
  assert.equal(result.collection.active_filters.find(x => x.key === 'compatibility_evidence').label, 'Device compatibility evidence: Device references supplied');
  assert.equal(page.data[0].price, 1200);
});
test('valid unconfirmed evidence remains explicit; absent metadata never advertises the new controls', () => {
  const query = core.StorefrontDiscoveryQuerySchema.parse({ compatibility_evidence: 'unconfirmed' });
  const page = fixture(query, [{ key: 'compatibility_evidence', value: 'unconfirmed', label: 'unconfirmed', count: 1 }]);
  const projected = app.projectDiscoveryPage(page, '/products', query);
  assert.equal(projected.collection.electronics_facets[0].label, 'Device compatibility unconfirmed');
  const basic = { ...fixture(query), discovery: undefined };
  assert.throws(() => app.validateDiscoveryProductPage(basic, query), app.StorefrontDiscoveryUnsupportedError);
  const plainQuery = core.StorefrontDiscoveryQuerySchema.parse({}), plain = { ...fixture(plainQuery), discovery: undefined };
  assert.equal(app.projectDiscoveryPage(plain, '/products', plainQuery).collection.capabilities.electronics_filters, false);
});
test('zero-result selected evidence is retained with zero count and clear one/all navigation', () => {
  const query = core.StorefrontDiscoveryQuerySchema.parse({ electronics_manufacturer: 'Synthetic Lab', compatibility_evidence: 'supplied', search: 'not found', sort: 'newest' });
  const page = fixture(query, [], 0);app.validateDiscoveryProductPage(page, query);
  const projection = app.projectDiscoveryPage(page, '/products', query);
  assert.equal(projection.collection.total, 0);
  assert.equal(projection.collection.electronics_facets.length, 2);
  assert.equal(projection.collection.electronics_facets.find(x => x.key === 'compatibility_evidence').label, 'Device references supplied');
  assert.equal(projection.collection.electronics_facets.every(x => x.count === 0 && x.selected), true);
  const clearAll = new URL(projection.collection.clear_filters_url, 'https://example.invalid');
  assert.equal(clearAll.searchParams.has('electronics_manufacturer'), false);assert.equal(clearAll.searchParams.has('compatibility_evidence'), false);
  assert.equal(clearAll.searchParams.get('search'), 'not found');assert.equal(clearAll.searchParams.get('sort'), 'newest');
});
test('malformed facet enums/counts are rejected by actual public response admission', () => {
  const query = core.StorefrontDiscoveryQuerySchema.parse({});
  for (const facet of [{ key: 'compatibility_evidence', value: 'guaranteed', label: 'Guaranteed', count: 1 }, { key: 'compatibility_evidence', value: 'supplied', label: 'supplied', count: 2 }, { key: 'electronics_manufacturer', value: '', label: 'Empty', count: 1 }, { key: 'compatibility_evidence', value: ' ', label: 'Empty', count: 1 }]) assert.throws(() => app.validateDiscoveryProductPage(fixture(query, [facet]), query));
});
test('SQL proposal changes only the intended two helper bodies and keeps the existing full profile fences', () => {
  const conservation = JSON.parse(readFileSync(resolve(out, 'sql-source-conservation.json'), 'utf8'));
  assert.deepEqual(conservation.changedFunctions.map(f => f.name), ['storefront_discovery_shape_v1','storefront_discovery_flat_v1']);
  for (const file of ['UNNUMBERED_circuit_facets.up.proposal.sql','UNNUMBERED_circuit_facets.down.proposal.sql']) {
    const sql = readFileSync(resolve(out, file), 'utf8');
    assert.equal((sql.match(/EXECUTE \$replacement\$CREATE OR REPLACE FUNCTION/g) ?? []).length, 2);
    assert.equal(sql.includes('EXECUTE $replacement$CREATE OR REPLACE FUNCTION public.browse_storefront_products_v1'), false);
    assert.equal((sql.match(/DO \$profile\$/g) ?? []).length, 2);
    assert.match(sql, /before_dependencies IS DISTINCT FROM/);assert.match(sql, /before_shared_dependencies IS DISTINCT FROM/);
    assert.doesNotMatch(sql, /CREATE TABLE|CREATE INDEX|ALTER ROLE|GRANT EXECUTE|DROP FUNCTION/);
  }
  assert.equal(conservation.databaseExecuted, false);
});
test('standalone UP/DOWN bodies preserve regex dollar literals and exact product/variant guards', () => {
  const up = readFileSync(resolve(out, 'UNNUMBERED_circuit_facets.up.proposal.sql'), 'utf8');
  const down = readFileSync(resolve(out, 'UNNUMBERED_circuit_facets.down.proposal.sql'), 'utf8');
  const extract = script => [...script.matchAll(/EXECUTE \$replacement\$([\s\S]*?)\$replacement\$;/g)].map(m => m[1]);
  const next = extract(up), old = extract(down).reverse();
  assert.equal(next.length, 2);assert.equal(old.length, 2);
  for (const ddl of [...old, ...next]) assert.equal(ddl.split('$fn$').length, 3);
  const afterQuery = ddl => ddl.slice(ddl.indexOf(' IF variant THEN'));
  assert.deepEqual(afterQuery(next[0]), afterQuery(old[0]), 'all product and variant shape branches exact');
  assert.ok(next[0].length - old[0].length < 2500, 'two scalar keys cannot expand the whole body');
  assert.match(next[0], /'electronics_manufacturer'/);assert.match(next[0], /'compatibility_evidence'/);
  assert.equal(next[0].split("IF namespace='$query' THEN RETURN").length, 2);
});
