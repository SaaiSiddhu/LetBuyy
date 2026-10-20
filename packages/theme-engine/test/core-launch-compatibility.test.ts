import { resolveRenderableThemeTemplateConfig } from '../src/index';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getDefaultStorefrontThemeTemplate } from '../src/theme-registry';
import { parseLiquidThemePackageBundle } from '../src/theme-bundle';
import { compilePortableToLiquidBundle } from '../src/portable-to-liquid';

const base = parseLiquidThemePackageBundle(JSON.parse(readFileSync(new URL('../../../database/supabase/seeds/generated/letbuyy-core-liquid-bundle.json', import.meta.url), 'utf8')));
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
