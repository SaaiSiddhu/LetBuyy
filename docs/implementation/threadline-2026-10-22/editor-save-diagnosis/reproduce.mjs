// Read-only production-source extraction; no browser, DB, network or app startup.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as domain from '../../../../packages/theme-engine/src/index.ts';
import draftClientModule from '../../../../apps/merchant/web/src/lib/theme-draft-client.ts';
const { ThemeDraftClient, ThemeDraftConflictError } = draftClientModule;

const root = new URL('../../../../', import.meta.url);
const output = new URL('./', import.meta.url);
const page = 'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx';
const candidateRoot = '/private/tmp/theme-editor-candidate-20261023-final02/';
const registry = 'services/api-gateway/src/execution/schema-registry-execution.adapter.ts';
const sqlPath = 'database/supabase/migrations/384_theme_editor_template_keys.sql';
const artifactPath = 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-aura-2.0.0.json';
const inputs = [page, registry, sqlPath, artifactPath,
  'apps/merchant/web/src/lib/theme-draft-client.ts',
  'apps/merchant/web/src/app/api/themes/[themeId]/editor/draft/route.ts',
  'packages/theme-engine/src/portable-to-liquid.ts',
  'apps/commerce/web/src/lib/store-service.ts',
  'services/api-gateway/src/lib/theme-release-bundle.ts'];
const read = path => readFileSync(new URL(path, root), 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const before = Object.fromEntries(inputs.map(path => [path,digest(read(path))]));
const sourceText = read(page);
const candidateText = readFileSync(candidateRoot + page, 'utf8');
const source = ts.createSourceFile(page,sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations = new Map();
for (const node of source.statements) {
  if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text,node.getText(source));
  if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations)
    if (ts.isIdentifier(d.name)) declarations.set(d.name.text,node.getText(source));
}
const needed = new Set(['normalizeSettingsSchema','normalizeEditorState','buildDraftConfig','getAllSections','getSectionById','updateSectionById','coerceFieldValue']);
for (const name of needed) {
  assert(declarations.has(name), 'Actual helper unavailable: ' + name);
  const tree = ts.createSourceFile('helper.ts',declarations.get(name),ts.ScriptTarget.Latest,true);
  const visit = node => { if(ts.isIdentifier(node) && declarations.has(node.text)) needed.add(node.text); ts.forEachChild(node,visit); };
  visit(tree);
}
const transpile = text => ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const dependencies = ['getDefaultStorefrontThemeTemplate','hasRenderableThemeTemplate','letbuyyPrimitiveTokens','isUnchangedCoreDemoCategoryBlocks','isFirstPartyCoreBundleSlug','MAX_BUNDLE_BLOCK_NESTING_DEPTH','ThemeEditorTemplateKeySchema','normalizeEditorSchemaField','resolveFieldDefault'];
const tokens = createRequire(new URL('apps/merchant/web/package.json',root).pathname)('@letbuyy/ui/tokens').letbuyyPrimitiveTokens;
const helperCode = [...needed].map(name=>declarations.get(name)).join('\n');
const helpers = new Function(...dependencies,transpile(helperCode)+';return {'+[...needed].join(',')+'};')(...dependencies.map(name=>name==='letbuyyPrimitiveTokens'?tokens:domain[name]));
const inner = source.statements.find(node=>ts.isFunctionDeclaration(node) && node.name?.text==='ThemeEditorInner');
assert(inner?.body);
function callback(name) {
  for(const statement of inner.body.statements) if(ts.isVariableStatement(statement))
    for(const declaration of statement.declarationList.declarations)
      if(ts.isIdentifier(declaration.name) && declaration.name.text===name) {
        assert(ts.isCallExpression(declaration.initializer));
        return declaration.initializer.arguments[0].getText(source);
      }
  throw Error('Actual callback unavailable: '+name);
}
const instantiateCallback = (name, bindings) => new Function(...Object.keys(bindings),transpile('return '+callback(name)+';'))(...Object.values(bindings));
const registryAst = ts.createSourceFile(registry,read(registry),ts.ScriptTarget.Latest,true);
const registryHelpers = registryAst.statements.filter(node=>ts.isFunctionDeclaration(node) && ['asRecord','isLiquidBundle','buildBundleTemplateConfig'].includes(node.name?.text)).map(node=>node.getText(registryAst)).join('\n');
const buildRegistryConfig = new Function(transpile(registryHelpers)+';return buildBundleTemplateConfig;')();
const storeAst=ts.createSourceFile('store-service.ts',read('apps/commerce/web/src/lib/store-service.ts'),ts.ScriptTarget.Latest,true);
const mapper=storeAst.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='mapSupabaseToStore');
const mapperProjection=mapper.body.statements.filter(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&['liquidBundleResult','liquidBundle'].includes(d.name.text))).map(node=>node.getText(storeAst)).join('\n');
const actualStoreProjection=new Function('templateConfig','LiquidThemePackageBundleSchema','compilePortableToLiquidBundle',transpile(mapperProjection)+';return liquidBundle;');
const artifact = JSON.parse(read(artifactPath));
const bundle = domain.parseLiquidThemePackageBundle(artifact.document.liquidBundle);
const base = buildRegistryConfig(bundle);
const schema = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
const settings = helpers.normalizeSettingsSchema(schema.settings_schema);
const state = helpers.normalizeEditorState(base,bundle.package.slug,'index',schema.section_schemas,settings);
const announcement = state.sections.header.find(section=>section.type==='announcement-bar');
const local = state.sections.template.find(section=>schema.section_schemas[section.type]?.settings_schema?.heading?.type==='text');
assert(announcement && local,'Use actual declared text fields, never invented IDs/settings');
const edits = [
  {name:'header-announcement',group:'header',sectionId:announcement.id,key:'text',value:'Dewdrop fixture A 9cd50e893016'},
  {name:'template-local-heading',group:'index',sectionId:local.id,key:'heading',value:'Dewdrop local fixture B 9cd50e893016'},
];
function applyActualCallback(input,edit) {
  let changed=input;
  const update = instantiateCallback('updateSectionSetting',{
    editorState:input,sectionSchemas:schema.section_schemas,
    getSectionById:helpers.getSectionById,coerceFieldValue:helpers.coerceFieldValue,
    updateSectionById:helpers.updateSectionById,applyChange:updater=>{changed=updater(changed);},
  });
  update(edit.sectionId,edit.key,edit.value);
  return changed;
}
const valueAt = (templates,edit) => templates[edit.group].sections[edit.sectionId].settings[edit.key];
const checks = [];
function check(name, work) {
  try { work(); checks.push({name,passed:true}); }
  catch(error) { checks.push({name,passed:false,error:error.message.split('\n').slice(0,8).join('\n')}); }
}
const results=[];
check('main and actual candidate editor bytes match',()=>assert.equal(sourceText,candidateText));
for(const edit of edits) {
  const changed=applyActualCallback(state,edit);
  const draft=helpers.buildDraftConfig(base,bundle.package.slug,changed,'index');
  let sent=null,acknowledgedState=null,dirty=true,ackVersion=null,nextBase=base;
  const initialConfig=helpers.buildDraftConfig(base,bundle.package.slug,state,'index');
  const client=new ThemeDraftClient(1,async intent=>{sent=JSON.parse(JSON.stringify(intent));return {version:2,currentVersion:2,savedAt:'2026-10-23T00:00:00.000Z'};},initialConfig,true,()=>`diagnosis-${edit.name}`,'diagnosis-actor','diagnosis-store');
  const refs={current:client};
  const save=instantiateCallback('saveDraft',{
    draftClientRef:refs,draftClientScopeRef:{current:`diagnosis-actor:diagnosis-store:${bundle.package.slug}:index:diagnosis-store-name`},
    themeId:bundle.package.slug,selectedTemplateKey:'index',store:'diagnosis-store-name',editorState:changed,baseConfig:base,
    buildDraftConfig:helpers.buildDraftConfig,ThemeDraftConflictError,
    setBaseConfig:update=>{nextBase=typeof update==='function'?update(nextBase):update;},
    setSavedState:value=>{acknowledgedState=value;},setDraftVersion:value=>{ackVersion=value;},setSavedAt:()=>{},
    latestEditorState:{current:changed},setIsDirty:value=>{dirty=value;},setReplacementVersion:()=>{},setHasConflict:()=>{},setConflictSource:()=>{},
  });
  const ack=await save();
  assert(sent,'Changed callback sends an actual new immutable client intent');
  const wire=sent.draftConfig;
  const compiled=domain.compilePortableToLiquidBundle(wire,{baseBundle:bundle}).bundle;
  const mapped=actualStoreProjection(wire,domain.LiquidThemePackageBundleSchema,domain.compilePortableToLiquidBundle);
  const reloaded=helpers.normalizeEditorState(wire,bundle.package.slug,'index',schema.section_schemas,settings);
  const stateValue=helpers.getSectionById(changed,edit.sectionId).settings[edit.key];
  const reloadValue=helpers.getSectionById(reloaded,edit.sectionId).settings[edit.key];
  const embedded=valueAt(wire.liquidBundle.templates,edit),projected=valueAt(wire.templates,edit),compiledValue=valueAt(compiled.templates,edit);
  check(edit.name+': actual settings callback preserves edit in EditorState',()=>assert.equal(stateValue,edit.value));
  check(edit.name+': actual save callback/client wire keeps edited root template',()=>assert.equal(projected,edit.value));
  check(edit.name+': actual client ack advances v2 and marks edited snapshot clean',()=>{assert.equal(ack.version,2);assert.equal(ackVersion,2);assert.equal(dirty,false);assert.equal(acknowledgedState,changed);});
  check(edit.name+': unchanged server echo reloads the edited root field',()=>assert.equal(reloadValue,edit.value));
  check(edit.name+': embedded captured bundle remains unchanged while root overlay changes',()=>assert.equal(embedded,valueAt(bundle.templates,edit)));
  check(edit.name+': existing canonical compiler projects edit correctly when invoked',()=>assert.equal(compiledValue,edit.value));
  check(edit.name+': actual store mapper projection fragment renders saved overlay',()=>assert.equal(valueAt(mapped.templates,edit),edit.value));
  results.push({edit,original:valueAt(bundle.templates,edit),callbackState:stateValue,wireRoot:projected,wireEmbeddedLiquid:embedded,
    explicitCanonicalCompiler:compiledValue,echoReload:reloadValue,ackVersion,uiDirtyAfterAck:dirty,
    validationIssues:domain.collectThemeTemplateValidationIssues({templateConfig:wire,runtime:{sectionSchemas:schema.section_schemas,settingsSchema:settings},themeSlug:bundle.package.slug})});
  client.dispose();
}
const sql=read(sqlPath);
const sqlEvidence={path:sqlPath,sha256:before[sqlPath],statements:[
  "IF d.id IS NOT NULL THEN v_templates:=v_templates||coalesce(d.working_manifest->'templates','{}'); END IF;",
  "IF jsonb_typeof(v_input->'templates'->p_template_key)='object' THEN",
  "v_templates:=jsonb_set(v_templates,ARRAY[p_template_key],v_input->'templates'->p_template_key,true);",
]};
for(const statement of sqlEvidence.statements)assert(sql.includes(statement),'Actual SQL source evidence changed');
const after=Object.fromEntries(inputs.map(path=>[path,digest(read(path))]));
assert.deepEqual(after,before,'Production inputs changed during diagnosis');
const ownerEvidencePath='docs/implementation/theme-editor-2026-10-23/evidence/dewdrop-shared-header-readonly-diagnostic.json';
const ownerEvidenceBytes=read(ownerEvidencePath);
const report={createdAt:new Date().toISOString(),classification:'IN_PROCESS_ACTUAL_HELPER_CALLBACK_CLIENT_CHARACTERIZATION_NOT_SQL_OR_BROWSER_EXECUTION',
  sourceHashes:before,candidateEditorSha256:digest(candidateText),productionInputsUnchanged:true,
  actualCallbacks:{updateSectionSetting:callback('updateSectionSetting'),saveDraft:callback('saveDraft')},actualStoreMapperProjection:mapperProjection,
  passed:checks.filter(row=>row.passed).length,failed:checks.filter(row=>!row.passed).length,checks,results,sqlEvidence,
  claimLimits:['Controlled client transport ack; no DB/network/browser/React render or actual server receipt executed.',
    'An echoed header edit reloads correctly in actual normalization. store-service.ts660 projects root overlays with the canonical compiler; unchanged captured bundle is not a second bug.',
    'Owner-provided read-only9cd saved patches confirm canonical header loss; incoming network payload was not captured.',
    'Explicit compiler success is a narrow projection proof, not a complete frontend/SQL repair or release gate.'],
  ownerServerEvidence:{path:ownerEvidencePath,sha256:digest(ownerEvidenceBytes),
    observed:'Saved patch revisions2/3 have edited compatibility sections.header.text but canonical templates.header original; embedded bundle original expected; later active11 original. Incoming transport not captured.'},
  conclusion:'Shared global-group SQL merge is the concrete durability defect; actual editor callbacks/client and commerce mapper preserve/project root edits. Unchanged embedded package is intentional; no second renderer bug established.'};
writeFileSync(new URL('report.json',output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({classification:report.classification,passed:report.passed,failed:report.failed,results:results.map(row=>({name:row.edit.name,expected:row.edit.value,state:row.callbackState,root:row.wireRoot,embedded:row.wireEmbeddedLiquid,compiler:row.explicitCanonicalCompiler,echoReload:row.echoReload,ackVersion:row.ackVersion,dirty:row.uiDirtyAfterAck})),productionInputsUnchanged:true},null,2));
if(report.failed)process.exitCode=1;
