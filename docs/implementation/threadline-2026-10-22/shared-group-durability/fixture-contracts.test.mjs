// Validate prepared native edit fixtures with actual shared validators/compiler.
// No database, browser, app, HTTP transport or native test module is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as domain from '../../../../packages/theme-engine/src/index.ts';
const root=new URL('../../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
const path='services/api-gateway/src/__tests__/owned-db/theme-shared-groups.postgres.test.ts';
const source=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true);
const wanted=new Set(['record','chooseField','setField','fieldValue','projected','pinnedThreadlineInput']);
const declarations=[];
for(const node of source.statements){
 if(ts.isFunctionDeclaration(node)&&wanted.has(node.name?.text))declarations.push(node.getText(source));
 if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&wanted.has(d.name.text)))declarations.push(node.getText(source));
}
assert.equal(declarations.length,wanted.size);
const js=ts.transpileModule(declarations.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const helpers=new Function('assert','LiquidThemePackageBundleSchema','compilePortableToLiquidBundle','read','sha',js+';return {chooseField,setField,fieldValue,projected,pinnedThreadlineInput};')
 (assert,domain.LiquidThemePackageBundleSchema,domain.compilePortableToLiquidBundle,read,sha);
const directory='docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/';
const manifest=JSON.parse(read(directory+'manifest.json'));
assert.equal(sha(read(directory+'manifest.json')),'c0e8d5b7338a70a797a2acc24976700a146f8df4f9a3716d55fab4c03e8cf515');
const inputs=manifest.artifacts.map(row=>{const bytes=read(directory+row.file);assert.equal(sha(bytes),row.fileSha256);return{slug:row.slug,artifact:JSON.parse(bytes)};});
assert.equal(inputs.length,9);inputs.push(helpers.pinnedThreadlineInput(manifest));assert.equal(new Set(inputs.map(row=>row.slug)).size,10);
for(const row of inputs)test(row.slug+': actual pinned changed-value and missing-group inputs validate; three fields project while base stays immutable',()=>{
 const {artifact}=row,config=structuredClone(artifact.document),base=JSON.stringify(config.liquidBundle);
 const schema=row.slug==='letbuyy-sense'?{section_schemas:artifact.sectionSchemas,settings_schema:artifact.settingsSchema}:artifact.persistence.schemaManifest;
 const schemas={sections:schema.section_schemas};
 const fields=['header','footer','index'].map(template=>helpers.chooseField(config,schemas,template));
 fields.forEach((field,index)=>helpers.setField(config,field,`Native391 fixture ${index} ${row.slug}`));
 config.templates.page.name=`Native391 saved page ${row.slug}`;
 config.templates['page.fixture391']={...structuredClone(config.templates.page),name:`Native391 saved alternate ${row.slug}`};
 const issues=domain.collectThemeTemplateValidationIssues({templateConfig:config,runtime:{sectionSchemas:schema.section_schemas,settingsSchema:schema.settings_schema},themeSlug:row.slug});
 assert.deepEqual(issues,[]);
 const compiled=helpers.projected(config);
 fields.forEach((field,index)=>assert.equal(helpers.fieldValue({templates:compiled.templates},field),`Native391 fixture ${index} ${row.slug}`));
 assert.equal(JSON.stringify(config.liquidBundle),base);
 for(const omitted of [['header'],['footer'],['header','footer']]){
  const partial=structuredClone(config);for(const key of omitted)delete partial.templates[key];
  const partialIssues=domain.collectThemeTemplateValidationIssues({templateConfig:partial,runtime:{sectionSchemas:schema.section_schemas,settingsSchema:schema.settings_schema},themeSlug:row.slug});
  assert.deepEqual(partialIssues,[],`missing ${omitted.join('/')} is a valid actual runtime payload; saved-group preservation still requires native SQL qualification`);
  assert.equal(JSON.stringify(partial.liquidBundle),base);
 }
 const invalid=structuredClone(config);invalid.templates.header.sections={unapproved:{type:'unapproved-native391',settings:{}}};
 const refused=domain.collectThemeTemplateValidationIssues({templateConfig:invalid,runtime:{sectionSchemas:schema.section_schemas,settingsSchema:schema.settings_schema},themeSlug:row.slug});
 assert(refused.some(issue=>issue.includes('unapproved-native391')),'actual shared runtime validator rejects the prepared invalid section');
});
