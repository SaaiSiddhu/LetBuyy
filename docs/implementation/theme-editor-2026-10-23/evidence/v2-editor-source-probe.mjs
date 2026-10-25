// Reproducible source-only probe; never evidence of installed/public acceptance.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import ts from 'typescript';
import * as domain from '../../../../packages/theme-engine/src/index.ts';
import { firstPartyThemeListings, createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
const root=new URL('../../../../', import.meta.url).pathname;
const controlsOnly=process.argv.includes('--controls-only');
if(process.argv.slice(2).some(arg=>arg!=='--controls-only'))throw Error('Unknown source-probe option');
const editorPath='apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const registryPath='services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const inputPaths=[editorPath,registryPath,'apps/merchant/web/src/components/theme-editor/editor-view-state.ts',
 ...readdirSync(root+'packages/theme-engine/src').filter(path=>path.endsWith('.ts')).map(path=>'packages/theme-engine/src/'+path)];
const hashFile=path=>createHash('sha256').update(readFileSync(root+path)).digest('hex');
const inputs=inputPaths.map(path=>({path,sha256:hashFile(path)}));
const source=ts.createSourceFile(editorPath,readFileSync(root+editorPath,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations=new Map();
for(const node of source.statements){if(ts.isFunctionDeclaration(node)&&node.name)declarations.set(node.name.text,node.getText(source));if(ts.isVariableStatement(node))for(const d of node.declarationList.declarations)if(ts.isIdentifier(d.name))declarations.set(d.name.text,node.getText(source));}
const needed=new Set(['normalizeSettingsSchema','normalizeEditorState','buildDraftConfig','getAllSections']);
for(const name of needed){if(!declarations.has(name))throw Error('Missing actual editor helper '+name);const tree=ts.createSourceFile('helper.ts',declarations.get(name),ts.ScriptTarget.Latest,true);const visit=node=>{if(ts.isIdentifier(node)&&declarations.has(node.text))needed.add(node.text);ts.forEachChild(node,visit)};visit(tree);}
const code=ts.transpileModule([...needed].map(name=>declarations.get(name)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const deps=['getDefaultStorefrontThemeTemplate','hasRenderableThemeTemplate','letbuyyPrimitiveTokens','isUnchangedCoreDemoCategoryBlocks','isFirstPartyCoreBundleSlug','MAX_BUNDLE_BLOCK_NESTING_DEPTH','ThemeEditorTemplateKeySchema','normalizeEditorSchemaField','resolveFieldDefault'];
const tokens=createRequire(root+'apps/merchant/web/package.json')('@letbuyy/ui/tokens').letbuyyPrimitiveTokens;
const helpers=new Function(...deps,code+';return {normalizeSettingsSchema,normalizeEditorState,buildDraftConfig,getAllSections};')(...deps.map(name=>name==='letbuyyPrimitiveTokens'?tokens:domain[name]));
const registry=ts.createSourceFile(registryPath,readFileSync(root+registryPath,'utf8'),ts.ScriptTarget.Latest,true);
const registryCode=registry.statements.filter(node=>ts.isFunctionDeclaration(node)&&['asRecord','isLiquidBundle','buildBundleTemplateConfig'].includes(node.name?.text)).map(node=>node.getText(registry)).join('\n');
const build=new Function(ts.transpileModule(registryCode,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return buildBundleTemplateConfig;')();
const report={createdAt:new Date().toISOString(),classification:'SOURCE_CONTRACT_ONLY_NOT_INSTALLED_OR_BROWSER_ACCEPTANCE',scope:controlsOnly?'PROBE_CONTROLS_ONLY_NOT_FINAL_TEN_THEME_GATE':'FINAL_TEN_THEME_SOURCE_GATE',inputs,themes:[]};
for(const listing of firstPartyThemeListings({designVersion:'2.0.0'}).filter(listing=>!controlsOnly||['letbuyy-sense','letbuyy-craft'].includes(listing.slug))){
 const bundle=createFirstPartyCatalogBundle(listing.slug,{designVersion:'2.0.0'}),base=build(bundle),manifest=domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
 const settings=helpers.normalizeSettingsSchema(manifest.settings_schema),runtime={sectionSchemas:manifest.section_schemas,settingsSchema:settings};
 const row={slug:listing.slug,name:bundle.package.name,version:bundle.package.version,bundleSha256:createHash('sha256').update(JSON.stringify(bundle)).digest('hex'),baselineValidationIssues:domain.collectThemeTemplateValidationIssues({templateConfig:base,runtime,themeSlug:listing.slug}),baselineWireValidationIssues:domain.collectThemeTemplateValidationIssues({templateConfig:JSON.parse(JSON.stringify(base)),runtime,themeSlug:listing.slug}),baselineSettings:Object.entries(base.themeSettings||{}).map(([key,value])=>({key,type:typeof value,...(value!==undefined?{value}:{}),wireOwn:value!==undefined})),inheritedSettings:['list-collections','search'].map(key=>({key,sections:base.templates[key]?.sections})),templates:[]};
 for(const key of Object.keys(bundle.templates).filter(key=>!['header','footer'].includes(key))){
  try{const state=helpers.normalizeEditorState(base,listing.slug,key,runtime.sectionSchemas,settings),draft=helpers.buildDraftConfig(base,listing.slug,state,key),issues=domain.collectThemeTemplateValidationIssues({templateConfig:draft,runtime,themeSlug:listing.slug});
   const wire=JSON.parse(JSON.stringify(draft)),wireValidationIssues=domain.collectThemeTemplateValidationIssues({templateConfig:wire,runtime,themeSlug:listing.slug});
   const compiled=domain.compilePortableToLiquidBundle(wire,{baseBundle:bundle}).bundle;
   const reloaded=helpers.normalizeEditorState(wire,listing.slug,key,runtime.sectionSchemas,settings);
   const identities=domain.createEditorPreviewIdentityIndex(helpers.getAllSections(state));
   const reloadedIdentities=domain.createEditorPreviewIdentityIndex(helpers.getAllSections(reloaded));
   const documentWire=JSON.parse(JSON.stringify(domain.toThemeDocumentV2(compiled)));
   const documentBundle=domain.fromThemeDocumentV2(documentWire);
   row.templates.push({key,headerSections:state.sections.header.length,footerSections:state.sections.footer.length,sections:state.sections.template.length,identities:Object.keys(identities).length,
    stableGroupIds:JSON.stringify(compiled.templates.header?.order)===JSON.stringify(state.sections.header.map(s=>s.id))&&JSON.stringify(compiled.templates.footer?.order)===JSON.stringify(state.sections.footer.map(s=>s.id)),
    stableEditorState:isDeepStrictEqual(JSON.parse(JSON.stringify(state)),JSON.parse(JSON.stringify(reloaded))),
    stablePreviewIdentities:isDeepStrictEqual(identities,reloadedIdentities),
    stableDocumentTemplates:isDeepStrictEqual(documentBundle.templates,compiled.templates),
    stableDocumentSettings:isDeepStrictEqual(documentBundle.config.settings_data,compiled.config.settings_data),
    validationIssues:issues,wireValidationIssues});
  }catch(error){row.templates.push({key,error:error.message});}
 }
 report.themes.push(row);
}
report.changedInputs=inputs.filter(input=>hashFile(input.path)!==input.sha256).map(input=>input.path);
report.sourceStable=report.changedInputs.length===0;
const out=root+'docs/implementation/theme-editor-2026-10-23/evidence/'+(controlsOnly?'v2-editor-source-probe-controls.json':'v2-editor-source-roundtrip.json');writeFileSync(out,JSON.stringify(report,null,2)+'\n');
const summaries=report.themes.map(theme=>({slug:theme.slug,version:theme.version,templates:theme.templates.length,failed:theme.templates.filter(item=>item.error||item.validationIssues.length||item.wireValidationIssues.length||!item.stableGroupIds||!item.stableEditorState||!item.stablePreviewIdentities||!item.stableDocumentTemplates||!item.stableDocumentSettings).length,baselineValidationIssues:theme.baselineValidationIssues,baselineWireValidationIssues:theme.baselineWireValidationIssues,undefinedBaselineSettings:theme.baselineSettings.filter(item=>!item.wireOwn).map(item=>item.key),uniqueWireIssues:[...new Set(theme.templates.flatMap(item=>item.error?[item.error]:item.wireValidationIssues))]}));
console.log(JSON.stringify({sourceStable:report.sourceStable,changedInputs:report.changedInputs,themes:summaries}));if(!report.sourceStable||summaries.some(theme=>theme.failed||theme.baselineValidationIssues.length||theme.baselineWireValidationIssues.length))process.exitCode=1;
