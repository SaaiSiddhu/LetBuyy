import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createPantryTheme as currentFactory } from '../../../../../../packages/theme-engine/src/pantry-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../../../packages/theme-engine/src/theme-bundle-core.ts';
import { LiquidRenderer } from '../../../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../../packages/theme-engine/src/theme-settings.ts';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload } from '../../../../../../packages/theme-engine/src/theme-bundle.ts';
import { collectThemeTemplateValidationIssues } from '../../../../../../packages/theme-engine/src/index.ts';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../../../../../../packages/theme-engine/src/theme-document.ts';
import { compilePortableToLiquidBundle } from '../../../../../../packages/theme-engine/src/portable-to-liquid.ts';

const root = new URL('../../../../../../', import.meta.url);
const privateFactory: typeof currentFactory = createRequire(import.meta.url)('./src/pantry-theme.ts').createPantryTheme;
const { JSDOM } = createRequire(new URL('packages/theme-engine/package.json', root))('jsdom');
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const mainPath = new URL('packages/theme-engine/src/pantry-theme.ts', root);
const mainBefore = sha(readFileSync(mainPath));
type Bundle = ReturnType<typeof privateFactory>;
const observations: Record<string, unknown>[] = [];
const rice = { id:'7b669c70-1005-4000-8000-000000000002', title:'Basmati rice', price:220, currency:'INR', url:'/product/rice', images:[], featured_image:'', available:true, variants:[], options:[], food:{ ingredients:'Basmati rice (100%).', allergens:{status:'not_supplied'}, storage:'Keep cool and dry.', netQuantityValue:1000, netQuantityUnit:'g', unitPriceMinor:2200, basisQuantity:100 } };
const bundle = (factory = privateFactory): Bundle => factory(createLetbuyyCoreLiquidThemeBundleFixture());

function installRows(b: Bundle, template: 'search' | 'collection', settings: Record<string, string | boolean>) {
  const id = template === 'search' ? 'search-results' : 'pantry-results';
  const instance = b.templates[template].sections[id];
  b.templates[template].sections[id] = { ...instance, type:'collection-product-list', settings };
  return id;
}

async function render(b: Bundle, key: 'search' | 'collection' | 'index' | 'product', empty = false, collectionTitle = 'Current named shelf') {
  const products = empty ? [] : [rice];
  const result = await new LiquidRenderer().render({
    context: {storeId:'11111111-1111-4111-8111-111111111111', subdomain:'pantry-pure-render', path:key === 'search'?'/search':key === 'collection'?'/collections/rice':'/', previewMode:false, locale:'en-IN'},
    storeTemplate: {themeId:'letbuyy-refresh', themeSettings:{...DEFAULT_THEME_SETTINGS,...b.config.settings_data.current}, sections:[]},
    routeTemplate: {id:key, type:key, layoutKey:'theme', sections:[]},
    liquidBundle:b, liquidTemplateKey:key,
    liquidContext:{shop:{name:'Synthetic Pantry'}, product:rice, collection:{title:collectionTitle, products, pagination:{page:1,next_url:'/collections/rice?page=2&sort=price-desc'}}, section_products:{'pantry-staples':products,'pantry-results':products,'search-results':products}},
  });
  assert.equal(result.status,'rendered',JSON.stringify(result.warnings));
  assert.ok(result.liquid);
  assert.deepEqual(result.warnings,[]);
  observations.push({template:key, empty, collectionTitle, htmlSha256:sha(result.liquid.contentForLayout), styleSha256:sha(result.liquid.headStyleText || '')});
  return result.liquid;
}

function row(html: string, id: string) {
  const dom = new JSDOM(html);
  const section = dom.window.document.querySelector(`[data-section-id="${id}"]`);
  assert.ok(section, `Actual row section ${id} missing`);
  const value = {
    headings:[...section.querySelectorAll('h2')].map((el: Element) => el.textContent),
    cards:section.querySelectorAll('.pn-card').length,
    empty:section.querySelector('.pn-empty')?.textContent ?? null,
    next:section.querySelector('.pn-pagination a')?.getAttribute('href') ?? null,
    unsafe:section.querySelector('script,img[src="x"],[onerror]') !== null,
    text:section.textContent,
  };
  dom.window.close();
  return value;
}

function config(b: Bundle) {
  return {themeId:b.package.slug,schema_version:b.schema_version,engineVersion:b.renderer.renderer_version,rendererEngine:'liquid',liquidBundle:b,sections:{},templates:b.templates,themeSettings:b.config.settings_data.current};
}

test('applied private factory adds a canonical opt-in toggle while retaining every existing default and template', () => {
  const before=bundle(currentFactory), after=bundle();
  const beforeSchema=before.sections['collection-product-list'].schema;
  const afterSchema=after.sections['collection-product-list'].schema;
  assert.deepEqual(afterSchema.settings.filter(field=>field.id!=='showHeading'),beforeSchema.settings);
  assert.deepEqual(afterSchema.settings.find(field=>field.id==='showHeading'),{id:'showHeading',type:'toggle',label:'Show heading',default:false});
  assert.deepEqual(after.templates,before.templates);
  assert.deepEqual(after.config,before.config);
  assert.deepEqual(after.package,before.package);
  assert.deepEqual(after.layout,before.layout);
  for(const [type,file] of Object.entries(before.sections))if(type!=='collection-product-list')assert.deepEqual(after.sections[type],file,type);
  assert.deepEqual(LiquidThemePackageBundleSchema.parse(after),after);
});

test('negative control: unchanged current factory ignores heading edits on a populated named collection', async () => {
  const b=bundle(currentFactory), id=installRows(b,'collection',{title:'Merchant custom heading'});
  const value=row((await render(b,'collection')).contentForLayout,id);
  assert.deepEqual(value.headings,[]);
  assert.equal(value.cards,1);
});

test('enabled heading A/B edits affect normal populated search rows despite a nonblank collection title', async () => {
  const b=bundle(), id=installRows(b,'search',{showHeading:true,title:'Merchant heading A'});
  const a=row((await render(b,'search')).contentForLayout,id);
  b.templates.search.sections[id].settings.title='Merchant heading B';
  const z=row((await render(b,'search')).contentForLayout,id);
  assert.deepEqual(a.headings,['Merchant heading A']);
  assert.deepEqual(z.headings,['Merchant heading B']);
  assert.equal(z.cards,1);
  assert.match(z.text,/Basmati rice/);
  assert.match(z.text,/1000 g net per pack/);
});

test('enabled heading A/B edits affect the intended populated collection rows while preserving product and page resources', async () => {
  const b=bundle(), id=installRows(b,'collection',{showHeading:true,title:'Rice shelf A'});
  const a=row((await render(b,'collection')).contentForLayout,id);
  b.templates.collection.sections[id].settings.title='Rice shelf B';
  const z=row((await render(b,'collection')).contentForLayout,id);
  assert.deepEqual(a.headings,['Rice shelf A']);assert.deepEqual(z.headings,['Rice shelf B']);
  assert.equal(z.cards,1);assert.equal(z.next,'/collections/rice?page=2&sort=price-desc');
});

test('empty search and collection results retain a custom heading and honest empty state without invented products', async () => {
  for(const key of ['search','collection'] as const){
    const b=bundle(),id=installRows(b,key,{showHeading:true,title:'No supplied staples'});
    const value=row((await render(b,key,true)).contentForLayout,id);
    assert.deepEqual(value.headings,['No supplied staples']);assert.equal(value.cards,0);assert.match(value.empty,/No matching products/);
  }
});

test('cleared and whitespace headings fall back to the current collection title when enabled', async () => {
  for(const title of ['','   ']){
    const b=bundle();const settings: Record<string,string|boolean>={showHeading:true,title};
    const id=installRows(b,'collection',settings);
    for(const empty of [false,true])assert.deepEqual(row((await render(b,'collection',empty,'Canonical shelf fallback')).contentForLayout,id).headings,['Canonical shelf fallback']);
  }
});

test('an omitted title retains the existing schema default rather than treating omission as an explicit clear', async () => {
  const b=bundle(),id=installRows(b,'collection',{showHeading:true});
  for(const empty of [false,true])assert.deepEqual(row((await render(b,'collection',empty,'Different live collection')).contentForLayout,id).headings,['Everyday staples']);
});

test('enabled blank heading plus missing collection title never emits an empty heading', async () => {
  const b=bundle(),id=installRows(b,'search',{showHeading:true,title:''});
  for(const empty of [false,true])assert.deepEqual(row((await render(b,'search',empty,'')).contentForLayout,id).headings,[]);
});

test('hostile markup and Hindi/Tamil text remain escaped heading text through the canonical sanitizer', async () => {
  const title='<script>headingAttack()</script><img src=x onerror=headingAttack()> & चावल / அரிசி';
  for(const key of ['search','collection'] as const){
    const b=bundle(),id=installRows(b,key,{showHeading:true,title});
    const value=row((await render(b,key)).contentForLayout,id);
    assert.deepEqual(value.headings,[title]);assert.equal(value.unsafe,false);assert.equal(value.cards,1);
  }
});

test('unchanged defaults render byte-identical body and style for home, PDP, collection and search, populated and empty', async () => {
  for(const key of ['index','product','collection','search'] as const)for(const empty of [false,true]){
    const before=await render(bundle(currentFactory),key,empty);
    const after=await render(bundle(),key,empty);
    assert.equal(after.contentForLayout,before.contentForLayout,`${key}/${empty} body`);
    assert.equal(after.headStyleText,before.headStyleText,`${key}/${empty} styles`);
  }
});

test('explicit false or legacy omitted toggle preserves the original row display even with a supplied title', async () => {
  for(const showHeading of [false,undefined]){
    const before=bundle(currentFactory),after=bundle();
    const settings:Record<string,string|boolean>={title:'Saved existing title'};if(showHeading!==undefined)settings.showHeading=showHeading;
    const id=installRows(before,'search',settings);installRows(after,'search',settings);
    const a=await render(before,'search'),z=await render(after,'search');
    assert.deepEqual(row(z.contentForLayout,id).headings,[]);assert.equal(z.contentForLayout,a.contentForLayout);
  }
});

test('actual schema manifest, JSON wire, ThemeDocument and portable compile retain enabled edits and explicit false', () => {
  for(const showHeading of [true,false]){
    const b=bundle();installRows(b,'search',{showHeading,title:'Preserved merchant heading'});
    const manifest=buildLiquidThemePackagePersistencePayload(b).schemaManifest;
    const runtime={sectionSchemas:manifest.section_schemas,settingsSchema:manifest.settings_schema};
    const wire=JSON.parse(JSON.stringify(config(b)));
    assert.deepEqual(collectThemeTemplateValidationIssues({templateConfig:wire,runtime,themeSlug:b.package.slug}),[]);
    const descriptor=manifest.section_schemas['collection-product-list'].settings_schema.showHeading;
    assert.equal(descriptor.type,'toggle');assert.equal(descriptor.default,false);
    const restored=fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(b))));
    assert.deepEqual(restored,b);
    const compiled=compilePortableToLiquidBundle(wire,{baseBundle:b});
    assert.deepEqual(compiled.warnings,[]);assert.deepEqual(compiled.bundle.templates,b.templates);
    const invalid=structuredClone(wire);invalid.templates.search.sections['search-results'].settings.undeclaredHeading='Do not silently accept';
    assert.ok(collectThemeTemplateValidationIssues({templateConfig:invalid,runtime,themeSlug:b.package.slug}).some(issue=>issue.includes('undeclaredHeading')));
  }
});

test('Main source remains byte-identical and the executed factory is the materialized private module', () => {
  assert.equal(sha(readFileSync(mainPath)),mainBefore);
  assert.equal(mainBefore,'9c440d32f146b8155ba78f522da52979fd09a0f3d32c4b25e5c3e289ef390925');
  assert.notEqual(privateFactory,currentFactory);
  assert.match(readFileSync(new URL('./src/pantry-theme.ts',import.meta.url),'utf8'),/showHeading/);
});

test.after(()=>{
  const rootPath=realpathSync(root);
  const runtimeSourceFiles=Object.keys(createRequire(import.meta.url).cache).filter(path=>path.startsWith(rootPath+'/')&&!path.includes('/node_modules/')).sort().map(path=>({path:path.slice(rootPath.length+1),sha256:sha(readFileSync(path))}));
  assert.ok(runtimeSourceFiles.some(file=>file.path.endsWith('/applied-private-heading-20261024-01/src/pantry-theme.ts')),'Actual loaded-module cache must include the materialized private factory');
  writeFileSync(new URL('render-observations.json',import.meta.url),JSON.stringify({recordedAt:new Date().toISOString(),classification:'PRIVATE_FACTORY_CANONICAL_SCHEMA_LIQUID_SOURCE_TESTS_NOT_INSTALLED_ACCEPTANCE',privateFactoryPath:new URL('./src/pantry-theme.ts',import.meta.url).pathname,privateFactorySha256:sha(readFileSync(new URL('./src/pantry-theme.ts',import.meta.url))),mainSha256:sha(readFileSync(mainPath)),runtimeSourceFiles,observations,liveEffects:0},null,2)+'\n');
});
