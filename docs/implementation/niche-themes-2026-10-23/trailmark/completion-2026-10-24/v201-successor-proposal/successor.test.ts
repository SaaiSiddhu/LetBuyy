import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFirstPartyCatalogBundle as catalog, firstPartyThemeListings } from '../packages/theme-engine/src/first-party-theme-catalog.ts';
import { createTrailmarkThemeV201 } from '../packages/theme-engine/src/trailmark-theme-v201.ts';
import { createFirstPartyCatalogBundle as mainCatalog } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/first-party-theme-catalog.ts';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, type LiquidThemePackageBundle } from '../packages/theme-engine/src/theme-bundle.ts';
import { LiquidRenderer } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-settings.ts';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-document.ts';
import { createRequire } from 'node:module';
const { orderItemFactsText } = createRequire(import.meta.url)('/Volumes/Projects/LetBuyy/apps/commerce/web/src/lib/order-fact-readback.ts') as typeof import('/Volumes/Projects/LetBuyy/apps/commerce/web/src/lib/order-fact-readback.ts');

const epoch = process.env.TRAILMARK_SUCCESSOR_EPOCH;
assert.ok(epoch && /^(red|green)\d{2}$/.test(epoch));
const output = `/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/trailmark/completion-2026-10-24/v201-successor-proposal/test-results/${epoch}`;
assert.ok(!existsSync(output), 'Preserve every test epoch');
mkdirSync(output, { recursive: true });
const old = () => catalog('letbuyy-ride', { designVersion: '2.0.0' });
const next = () => catalog('letbuyy-ride', { designVersion: '2.0.0', trailmarkVersion: '2.0.1' } as Parameters<typeof catalog>[1]);
type Key = 'collection' | 'search' | 'customers/order';
const saved = { version: 1, facts: { sports: { version: 1, activity: 'Badminton', equipmentType: 'racket', length: { value: 26.5, unit: 'in' }, weight: { value: 80, unit: 'g' }, dimensions: { length: 26.5, width: 10, unit: 'in' }, compatibility: { status: 'unconfirmed' } } }, selected_options: [{ name: 'Length', value: '26.5 in' }] };
const savedText = orderItemFactsText({ niche_snapshot: saved });
assert.ok(savedText?.includes('26.5 in') && savedText.includes('80 g'));
function edit(bundle: LiquidThemePackageBundle, key: Key, field: string, value: string) {
  const b = structuredClone(bundle);
  const section = Object.values(b.templates[key].sections).find(s => s.type === (key === 'customers/order' ? 'customer-order-detail' : 'collection-product-list'))!;
  section.settings[field] = value;
  return b;
}
async function render(bundle: LiquidThemePackageBundle, key: Key, collectionTitle = 'Court time', facts: string | null = savedText, currentLength = '27 in') {
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'trailmark-source-only', path: '/'+key, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-ride', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'customers/order' ? 'customer_order' : key, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic source-only' }, collection: { title: collectionTitle, products: [], total: 0 },
      product: { sports_display: { length: currentLength, weight: '82 g' } }, buyer: { id: 'source-only-unpersisted' },
      order: { number: 'SOURCE-1042', status: 'pending_cod', currency: 'INR', total: 180000, line_items: [{ title: 'Synthetic recorded racket', quantity: 1, line_price: 180000, niche_facts_text: facts }] } },
  });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
  const rendered = { html: result.liquid!.contentForLayout, style: result.liquid!.headStyleText };
  const hash = createHash('sha256').update(rendered.html).digest('hex');
  writeFileSync(`${output}/${hash}.html`, rendered.html);
  appendFileSync(`${output}/renders.jsonl`, JSON.stringify({ key, version: bundle.package.version, htmlSha256: hash, styleSha256: createHash('sha256').update(rendered.style || '').digest('hex') })+'\n');
  return rendered;
}

test('explicit Trailmark opt-in advances only the stable package version/number', () => {
  const b=next(); assert.equal(b.package.slug,'letbuyy-ride'); assert.equal(b.package.name,'Trailmark');
  assert.equal(b.package.version,'2.0.1'); assert.equal(b.package.version_number,3); assert.equal(old().package.version,'2.0.0');
  assert.equal(firstPartyThemeListings({designVersion:'2.0.0'}).find(x=>x.slug==='letbuyy-ride')?.id,'7b669c70-0000-4000-8000-000000000006');
});
test('all ten legacy and2.0.0 default catalogue outputs remain exact', () => {
  for (const listing of firstPartyThemeListings({designVersion:'2.0.0'})) {
    assert.deepEqual(catalog(listing.slug),mainCatalog(listing.slug));
    assert.deepEqual(catalog(listing.slug,{designVersion:'2.0.0'}),mainCatalog(listing.slug,{designVersion:'2.0.0'}));
  }
});
test('Trailmark option alone does not opt legacy or another theme into successor', () => {
  assert.deepEqual(catalog('letbuyy-ride',{trailmarkVersion:'2.0.1'} as Parameters<typeof catalog>[1]),mainCatalog('letbuyy-ride'));
  for (const slug of ['letbuyy-forge','letbuyy-bloom','letbuyy-sense']) assert.deepEqual(catalog(slug,{designVersion:'2.0.0',trailmarkVersion:'2.0.1'} as Parameters<typeof catalog>[1]),mainCatalog(slug,{designVersion:'2.0.0'}));
});
test('actual schema and JSON document roundtrip retain custom collection/search/order headings', () => {
  const b=edit(edit(edit(next(),'collection','headingOverride','Club equipment'),'search','headingOverride','Find court gear'),'customers/order','heading','Your equipment order');
  assert.ok(LiquidThemePackageBundleSchema.safeParse(b).success);
  const schemas=buildLiquidThemePackagePersistencePayload(b).schemaManifest.section_schemas as Record<string,{settings_schema:Record<string,{type:string;default?:unknown;label:string}>}>;
  assert.equal(schemas['collection-product-list'].settings_schema.headingOverride.type,'text');
  assert.equal(schemas['collection-product-list'].settings_schema.headingOverride.default,'');
  assert.equal(schemas['collection-product-list'].settings_schema.title.label,'Fallback heading');
  assert.equal(schemas['customer-order-detail'].settings_schema.heading.type,'text');
  assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(b)))),b);
});
for (const key of ['collection','search'] as const) {
  test(`${key}: a custom heading changes the normal named collection H1`,async()=>{
    const a=await render(edit(next(),key,'headingOverride','CLUB_ALPHA'),key),b=await render(edit(next(),key,'headingOverride','CLUB_BETA'),key);
    assert.match(a.html,/<h1>CLUB_ALPHA<\/h1>/);assert.match(b.html,/<h1>CLUB_BETA<\/h1>/);assert.notDeepEqual(a,b);
  });
  test(`${key}: blank/absent override preserves exact default output and legacy fallback`,async()=>{
    const prior=await render(old(),key);assert.deepEqual(await render(next(),key),prior);
    assert.deepEqual(await render(edit(next(),key,'headingOverride',''),key),prior);
    assert.match((await render(edit(next(),key,'title','Legacy fallback'),key,'')).html,/<h1>Legacy fallback<\/h1>/);
    assert.match((await render(edit(next(),key,'title','Legacy fallback'),key)).html,/<h1>Court time<\/h1>/);
  });
  test(`${key}: actual canonical escaping retains hostile heading as text`,async()=>{
    const r=await render(edit(next(),key,'headingOverride','<img src=x onerror=alert(1)>'),key);
    assert.match(r.html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(r.html,/<img\b[^>]*onerror=/i);
  });
}
test('order heading consumes declared setting and retains authoritative number',async()=>{
  const a=await render(edit(next(),'customers/order','heading','RECEIPT_ALPHA'),'customers/order');
  const b=await render(edit(next(),'customers/order','heading','RECEIPT_BETA'),'customers/order');
  assert.match(a.html,/<h1>RECEIPT_ALPHA #SOURCE-1042<\/h1>/);assert.match(b.html,/<h1>RECEIPT_BETA #SOURCE-1042<\/h1>/);assert.notDeepEqual(a,b);
});
test('order defaults/clear preserve exact prior output including canonical saved equipment facts',async()=>{
  const prior=await render(old(),'customers/order');assert.deepEqual(await render(next(),'customers/order'),prior);
  assert.deepEqual(await render(edit(next(),'customers/order','heading',''),'customers/order'),prior);
  assert.match(prior.html,/26.5 in/);assert.match(prior.html,/80 g/);assert.doesNotMatch(prior.html,/27 in|82 g/);
});
test('order heading is escaped; recorded facts never fall back to current catalogue',async()=>{
  const b=edit(next(),'customers/order','heading','<script>HEADING</script>');
  const a=await render(b,'customers/order'),changed=await render(b,'customers/order','Court time',savedText,'700 mm');assert.deepEqual(changed,a);
  assert.match(a.html,/&lt;script&gt;HEADING&lt;\/script&gt; #SOURCE-1042/);assert.doesNotMatch(a.html,/<script>HEADING|700 mm|82 g/);
  const missing=await render(next(),'customers/order','Court time',null);assert.match(missing.html,/Product details were not recorded with this order/);assert.doesNotMatch(missing.html,/27 in|82 g/);
});
test('only version metadata and two section outputs differ from canonical2.0.0',()=>{
  const b=next(),before=old(),rest=structuredClone(b);rest.package=before.package;rest.sections['collection-product-list']=before.sections['collection-product-list'];rest.sections['customer-order-detail']=before.sections['customer-order-detail'];assert.deepEqual(rest,before);
  assert.equal(b.sections['customer-order-detail'].source.split('lb:niche-order-presentation:v1').length,2);
});
test('successor is pure/idempotent, preserves merchant values/IDs and discards stale checksum',()=>{
  let base=edit(edit(old(),'collection','title','Existing fallback'),'customers/order','heading','Existing heading');
  base.templates.collection.sections['ride-collection'].settings.unrelated='retained';base.package.checksum='a'.repeat(64);
  const before=structuredClone(base),b=createTrailmarkThemeV201(base);assert.deepEqual(base,before);assert.deepEqual(createTrailmarkThemeV201(b),b);
  assert.deepEqual(b.templates,base.templates);assert.equal(b.templates.collection.sections['ride-collection'].settings.unrelated,'retained');assert.equal(b.package.checksum,undefined);
});
test('unknown successor or altered base contracts fail closed',()=>{
  const bad=structuredClone(next());bad.package.version='2.0.1';bad.sections['customer-order-detail'].source=bad.sections['customer-order-detail'].source.replace('lb:niche-order-presentation:v1','removed');
  assert.throws(()=>createTrailmarkThemeV201(bad),/requires/);
  const altered=old();altered.sections['collection-product-list'].source=altered.sections['collection-product-list'].source.replace('{{ collection.title | default: section.settings.title }}','Changed upstream contract');
  assert.throws(()=>createTrailmarkThemeV201(altered),/requires/);
});
