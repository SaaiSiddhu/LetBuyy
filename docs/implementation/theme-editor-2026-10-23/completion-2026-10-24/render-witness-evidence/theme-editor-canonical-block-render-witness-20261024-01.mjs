import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='/Volumes/Projects/LetBuyy', req=createRequire(root+'/apps/merchant/web/package.json'), engine=req('@letbuyy/theme-engine');
const sha=value=>createHash('sha256').update(value).digest('hex');
const sqlPath='database/supabase/migrations/389_niche_theme_catalog_v2.sql', sql=readFileSync(root+'/'+sqlPath,'utf8');
const captured=JSON.parse(sql.match(/\$liquidbundle\$([\s\S]*?)\$liquidbundle\$/)[1]);
const core=engine.createLetbuyyCoreLiquidThemeBundleFixture(), bloom=captured.find(row=>row.slug==='letbuyy-bloom').document.liquidBundle;
const rows=[];
async function render(bundle){return new engine.LiquidRenderer().render({context:{storeId:'11111111-1111-4111-8111-111111111111',subdomain:'owned-source-render-probe',path:'/',previewMode:false,locale:'en-IN'},storeTemplate:{themeId:bundle.package.slug,themeSettings:engine.DEFAULT_THEME_SETTINGS,sections:[]},routeTemplate:{id:'index',type:'index',layoutKey:'theme',sections:[]},liquidBundle:bundle,liquidTemplateKey:'index',liquidContext:{shop:{name:'Synthetic source render'},collection:{products:[]}}});}
for(const [name,original]of [['unmodified-core',core],['captured-Playfield2.0.0',bloom]]){
 const before=JSON.stringify(original), bundle=structuredClone(original), sectionType=name==='unmodified-core'?'spotlight':'spotlight';
 bundle.templates.index={sections:{'render-probe':{type:sectionType,settings:{heading:'Source witness'},disabled:false,blocks:{parent:{type:'badge',settings:{label:'PARENT_BLOCK_SOURCE_WITNESS'},disabled:false,blocks:{child:{type:'badge',settings:{label:'CHILD_BLOCK_SOURCE_WITNESS'},disabled:false,blocks:{},block_order:[]}},block_order:['child']}},block_order:['parent']}},order:['render-probe']};
 const accepted=engine.parseLiquidThemePackageBundle(bundle);engine.fromThemeDocumentV2(engine.toThemeDocumentV2(accepted));
 const baseline=await render(accepted);assert.equal(baseline.status,'rendered');const html=baseline.liquid.contentForLayout;
 const nestedControl=structuredClone(accepted);nestedControl.blocks.badge.source+='\n{% for child in block.sub_blocks %}{{ child.html }}{% endfor %}';
 if(name!=='unmodified-core')nestedControl.sections.spotlight.source+='\n{% for block in section.blocks %}{{ block.html }}{% endfor %}';
 const controlled=await render(engine.parseLiquidThemePackageBundle(nestedControl));assert.equal(controlled.status,'rendered');
 assert.ok(controlled.liquid.contentForLayout.includes('PARENT_BLOCK_SOURCE_WITNESS'));assert.ok(controlled.liquid.contentForLayout.includes('CHILD_BLOCK_SOURCE_WITNESS'));
 assert.equal(JSON.stringify(original),before);
 rows.push({source:name,canonicalParseAndDocumentRoundtrip:'PASS',baseline:{renderStatus:baseline.status,parentVisible:html.includes('PARENT_BLOCK_SOURCE_WITNESS'),childVisible:html.includes('CHILD_BLOCK_SOURCE_WITNESS')},syntheticPositiveControl:{renderStatus:controlled.status,parentVisible:true,childVisible:true,changes:'Test-only clone appends explicit child html iteration; capturedPlayfield clone additionally consumes root section.blocks html. No source file or captured artifact changed.'},unmodifiedInputSHA256:sha(before),preserved:true});
}
const result={recordedAt:new Date().toISOString(),classification:'ACTUAL_CANONICAL_LIQUID_RENDER_SOURCE_WITNESS_NOT_INSTALLED_OR_BROWSER',sourceInput:{path:sqlPath,sha256:sha(sql)},rows,conclusion:'Canonical acceptance and saved hierarchy do not prove visible block output. Default reusable badge source omits its child HTML. CapturedPlayfield spotlight additionally ignores section.blocks; arbitrary root-block exposure there would save hidden data. Preserve theme/package identity and reconcile supported output through a versioned scoped correction or independently reviewed applicability, not an invented host or broad picker.',notExecuted:['Browser/editor saves/publication','Fresh installed2.0.1 qualification','Database or provider actions'],sourceWrites:0};
const path=root+'/docs/implementation/theme-editor-2026-10-23/completion-2026-10-24/CANONICAL_BLOCK_RENDER_WITNESS_01.json';writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
