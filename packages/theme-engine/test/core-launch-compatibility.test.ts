import { resolveRenderableThemeTemplateConfig } from '../src/index';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getDefaultStorefrontThemeTemplate } from '../src/theme-registry';
import { parseLiquidThemePackageBundle } from '../src/theme-bundle';
import { compilePortableToLiquidBundle, isUnchangedCoreDemoCategoryBlocks } from '../src/portable-to-liquid';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';

const base = parseLiquidThemePackageBundle(JSON.parse(readFileSync(new URL('../../../database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json', import.meta.url), 'utf8')));
test('Threadline v2 projects its own saved composition and schema without Core starter migration', () => {
 const bundle = createFirstPartyCatalogBundle('letbuyy-sense');
 const templates = structuredClone(bundle.templates);
 templates.index.sections['sense-heroBanner-index'].settings.heading = 'Saved apparel campaign';
 const input = { templates, themeSettings: bundle.config.settings_data.current };
 const before = structuredClone(input);
 const result = compilePortableToLiquidBundle(input, { baseBundle: bundle });
 assert.deepEqual(input, before);
 assert.equal(result.bundle.templates.index.sections['sense-heroBanner-index'].settings.heading, 'Saved apparel campaign');
 assert.deepEqual(result.bundle.templates.index.order, bundle.templates.index.order);
 assert.equal(result.bundle.sections['hero-banner'].source, bundle.sections['hero-banner'].source);
 assert.deepEqual(result.warnings, []);
});
test('a captured Sense v1 package retains the conservative Core compatibility upgrade', () => {
 const captured = structuredClone(base);
 captured.package.slug = 'letbuyy-sense'; captured.package.version = '1.0.0';
 const input = getDefaultStorefrontThemeTemplate('letbuyy-core', {});
 const result = compilePortableToLiquidBundle(input, { baseBundle: captured });
 assert.equal(Object.keys(result.bundle.templates.index.sections['category-grid-default'].blocks).length, 0);
 assert.equal(result.bundle.package.version, '1.0.0');
 assert.doesNotMatch(result.bundle.sections['product-detail'].source, /Garment measurements/);
});
for (const listing of firstPartyThemeListings().filter(theme => theme.presetId !== 'sense')) {
 test(`${listing.name} preserves preset defaults and upgrades only unchanged legacy starter blocks`, () => {
  const bundle = createFirstPartyCatalogBundle(listing.slug);
  const input = getDefaultStorefrontThemeTemplate('letbuyy-core', {});
  input.themeSettings = { ...input.themeSettings, ...listing.settings };
  const before = structuredClone(input);
  const result = compilePortableToLiquidBundle(input, { baseBundle: bundle });
  assert.deepEqual(input, before);
  for (const [key, value] of Object.entries(listing.settings)) assert.deepEqual(result.bundle.config.settings_data.current[key], value);
  assert.equal(Object.keys(result.bundle.templates.index.sections['category-grid-default'].blocks).length, 0);
  input.sections.template.find(section => section.id === 'category-grid-default')!.blocks![0].settings.name = 'Merchant collection';
  assert.throws(() => compilePortableToLiquidBundle(input, { baseBundle: bundle }), /Block.*category.*not allowed/);
 });
}
test('persisted Core bundle compiles unchanged legacy default category placeholders without discarding merchant edits', () => {
    const input = getDefaultStorefrontThemeTemplate('letbuyy-core', {});
    const before = structuredClone(input);
    const result = compilePortableToLiquidBundle(input, { baseBundle: base });
    assert.equal(result.warnings.length, 1);
    assert.deepEqual(input, before, 'compile does not mutate saved data');
    assert.equal(result.bundle.templates.index.sections['featured-collection-default'].settings.viewAllLabel,'View collection');
    assert.equal(result.bundle.templates.index.sections['featured-collection-default'].settings.viewAllHref,'/products');
    assert.equal(result.bundle.templates.index.sections['announcement-default'],undefined,'unchanged duplicate announcement is rendered once');
    assert.equal(Object.keys(result.bundle.templates.index.sections['category-grid-default'].blocks).length, 0);
    const changed = structuredClone(input);
    const category = changed.sections.template.find(section => section.id === 'category-grid-default')!;
    category.blocks![0].settings.name = 'Actual merchant category';
    assert.throws(() => compilePortableToLiquidBundle(changed, { baseBundle: base }), (error: unknown) => error instanceof Error && error.message.includes('not allowed') && error.message.includes('category'),
        'a changed merchant block requires explicit migration, never silent deletion');
});
test('saved editor object-map demo blocks and portable arrays use the same conservative upgrade',()=>{
 const input=getDefaultStorefrontThemeTemplate('letbuyy-core',{});
 const category=input.sections.template.find(s=>s.id==='category-grid-default')!;
 const record={type:category.type,settings:category.settings,blocks:Object.fromEntries(category.blocks!.map(b=>[b.id,{type:b.type,visible:b.visible,settings:b.settings}])),block_order:category.blocks!.map(b=>b.id)};
 const result=compilePortableToLiquidBundle({...input,templates:{index:{sections:{'category-grid-default':record},order:['category-grid-default']}}},{baseBundle:base});
 assert.equal(Object.keys(result.bundle.templates.index.sections['category-grid-default'].blocks).length,0);
});
test('installing another Liquid package does not inherit incompatible outgoing theme settings',()=>{
 const previous={themeId:'letbuyy-core',themeSettings:{isDark:false,fontFamily:'Inter',enableShadows:true,enableAnimations:true},sections:{template:[]}};
 const fallback={themeId:'private-core',liquidBundle:base,themeSettings:{primaryColor:'#123456'},sections:{},templates:base.templates};
 const result=resolveRenderableThemeTemplateConfig(previous,{slug:'private-core',default_template:fallback});
 assert.deepEqual(result.themeSettings,fallback.themeSettings);assert.equal(previous.themeSettings.fontFamily,'Inter');
});
for (const [name, preset] of Object.entries(base.config.settings_data.presets)) {
    test(`persisted Core preset ${name} compiles to exact saved values`, () => {
        const input = getDefaultStorefrontThemeTemplate('letbuyy-core', {});
        input.themeSettings = { ...input.themeSettings, ...preset };
        const result = compilePortableToLiquidBundle(input, { baseBundle: base });
        for (const [key, value] of Object.entries(preset)) assert.deepEqual(result.bundle.config.settings_data.current[key], value);
    });
}

test('a complete imported Core template map preserves the canonical password page without exposing credential fields',()=>{
 const result=compilePortableToLiquidBundle({templates:base.templates,themeSettings:{password:'synthetic-private-value'}},{baseBundle:base});
 assert.ok(result.bundle.templates.password);
 assert.equal(result.bundle.config.settings_data.current.password,undefined);
 assert.throws(()=>compilePortableToLiquidBundle({templates:{index:{sections:{password:{type:'hero-banner'}}}}},{baseBundle:base}),/Invalid portable Liquid instance id/);
});
test('older captured Core instances obtain omitted CTA defaults from their own schema',()=>{
 const older=structuredClone(base);older.templates.index.sections['featured-collection-default'].settings={title:'Old captured title'};
 const result=compilePortableToLiquidBundle({templates:{index:{sections:{'featured-collection-default':{type:'featured-products',settings:{title:'Merchant title'}}}}}},{baseBundle:older});
 assert.equal(result.bundle.templates.index.sections['featured-collection-default'].settings.title,'Merchant title');
 assert.equal(result.bundle.templates.index.sections['featured-collection-default'].settings.viewAllLabel,'View collection');
 assert.equal(result.bundle.templates.index.sections['featured-collection-default'].settings.viewAllHref,'/products');
});


test('new Core announcement retires only the unchanged frozen duplicate, preserving merchant copy and styles',()=>{
 for(const [key,value] of [['text','Merchant delivery offer'],['linkHref','/shipping'],['backgroundColor','#123456']]){
  const input=getDefaultStorefrontThemeTemplate('letbuyy-core',{});
  const announcement=input.sections.template.find(section=>section.id==='announcement-default')!;
  announcement.settings[key]=value;
  const result=compilePortableToLiquidBundle(input,{baseBundle:base});
  assert.equal(result.bundle.templates.index.sections['announcement-default'].settings[key],value);
  assert.equal(announcement.settings[key],value,'input is never rewritten');
 }
});


test('PostgreSQL jsonb key order does not hide unchanged Core demo defaults; merchant edits still refuse',()=>{
 const input=getDefaultStorefrontThemeTemplate('letbuyy-core',{});
 const category=input.sections.template.find(s=>s.id==='category-grid-default')!;
 const byId=Object.fromEntries(category.blocks!.map(b=>[b.id,{type:b.type,settings:b.settings}]));
 const keys=['category-apparel','category-sneakers','category-accessories'];
 const captured={type:category.type,settings:category.settings,blocks:Object.fromEntries(keys.map(k=>[k,byId[k]])),block_order:category.blocks!.map(b=>b.id)};
 const config={templates:{index:{sections:{'category-grid-default':captured},order:['category-grid-default']}}};
 const before=structuredClone(config);
 const result=compilePortableToLiquidBundle(config,{baseBundle:base});
 assert.equal(Object.keys(result.bundle.templates.index.sections['category-grid-default'].blocks).length,0);
 assert.deepEqual(config,before,'saved database document is not rewritten');
 captured.blocks['category-apparel'].settings.name='Merchant authored category';
 assert.throws(()=>compilePortableToLiquidBundle(config,{baseBundle:base}),/Block.*category.*not allowed/);
});

test('normal editor metadata cannot resurrect obsolete Core category cards; real child content stays protected',()=>{
 const input=getDefaultStorefrontThemeTemplate('letbuyy-core',{});
 const category=input.sections.template.find(s=>s.id==='category-grid-default')!;
 const normalized=category.blocks!.map((block,i)=>({...block,order:i*10,children:[]}));
 assert.equal(isUnchangedCoreDemoCategoryBlocks(normalized),true);
 const portable=Object.fromEntries(normalized.map(b=>[b.id,{type:b.type,visible:b.visible,settings:b.settings,blocks:{},block_order:[]}]));
 assert.equal(isUnchangedCoreDemoCategoryBlocks(portable,normalized.map(b=>b.id)),true);
 const result=compilePortableToLiquidBundle({templates:{index:{sections:{'category-grid-default':{type:category.type,settings:category.settings,blocks:portable,block_order:normalized.map(b=>b.id)}},order:['category-grid-default']}}},{baseBundle:base});
 assert.deepEqual(result.bundle.templates.index.sections['category-grid-default'].blocks,{});
 assert.equal(isUnchangedCoreDemoCategoryBlocks(normalized.map((b,i)=>i?b:{...b,children:[{id:'merchant-child'}]})),false);
 assert.equal(isUnchangedCoreDemoCategoryBlocks({...portable,'category-apparel':{...portable['category-apparel'],blocks:{child:{type:'text'}}}},normalized.map(b=>b.id)),false);
 assert.equal(isUnchangedCoreDemoCategoryBlocks(normalized.map((b,i)=>i?b:{...b,order:900})),false);
});
