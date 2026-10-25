/** Targeted read-only follow-up of the32 primary Circuit choices and count0/1 variants.
 * Parse released HTML only: no rendering, query parser, source writes or browser/AT claim. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=new URL('../../../../../../',import.meta.url);
const previous=new URL('../',import.meta.url);
const releaseDir='docs/implementation/niche-themes-2026-10-23/circuit/discovery/accessibility-counts/';
const released=new URL(releaseDir,root);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const uiRequire=createRequire(new URL('packages/typescript/ui/package.json',root));
const {JSDOM}=uiRequire('jsdom');
const nameRequire=createRequire(uiRequire.resolve('@testing-library/dom'));
const {computeAccessibleName,computeAccessibleDescription,getRole}=nameRequire('dom-accessibility-api');
const sourceReleaseBytes=await readFile(new URL('source-release.json',released));
const sourceRelease=JSON.parse(sourceReleaseBytes);assert.equal(sourceRelease.status,'RELEASED');
const ownerReportBytes=await readFile(new URL('report.json',released));
const ownerReport=JSON.parse(ownerReportBytes);assert.equal(ownerReport.choices.length,96);
const runtimeBytes=await readFile(new URL('runtime.json',released));
const oldInputsBytes=await readFile(new URL('inputs.json',previous)),oldInputs=JSON.parse(oldInputsBytes);
const oldFindingsBytes=await readFile(new URL('findings.json',previous)),oldFindings=JSON.parse(oldFindingsBytes);
const issue=oldFindings.findings.find(row=>row.id==='FILTER-A11Y-001');assert.equal(issue.affectedControls.length,32);
const oldIntegrityBytes=await readFile(new URL('review-integrity.json',previous)),oldIntegrity=JSON.parse(oldIntegrityBytes);
for(const row of oldIntegrity.outputs)assert.equal(sha(await readFile(new URL(row.file,previous))),row.sha256,'Historical review output changed: '+row.file);
for(const row of oldInputs.artifacts)assert.equal(sha(await readFile(new URL(row.path,root))),row.sha256,'Historical artifact changed: '+row.path);
const sources=new Map([...Object.entries(sourceRelease.sourceHashes),...Object.entries(ownerReport.sourceHashes)]);
for(const[path,expected]of sources)assert.equal(sha(await readFile(new URL(path,root))),expected,'Released source drift: '+path);
const oldFunctionalBytes=await readFile(new URL(oldInputs.report.path,root)),oldFunctional=JSON.parse(oldFunctionalBytes);
const post390ReceiptPath='docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract/green-55-after390-consumers-accessible-counts/frozen-source-receipt.json';
const post390ReceiptBytes=await readFile(new URL(post390ReceiptPath,root)),post390Receipt=JSON.parse(post390ReceiptBytes);
assert.equal(post390Receipt.tests.pass,55);assert.equal(post390Receipt.tests.fail,0);
const version=async entry=>JSON.parse(await readFile(new URL('../package.json',pathToFileURL(entry)),'utf8')).version;
const inputs={scope:'TARGETED_CIRCUIT_COUNT_NAME_FOLLOW_UP_ONLY',release:{path:releaseDir+'source-release.json',sha256:sha(sourceReleaseBytes)},ownerReport:{path:releaseDir+'report.json',sha256:sha(ownerReportBytes)},ownerRuntime:{path:releaseDir+'runtime.json',sha256:sha(runtimeBytes)},declaredCatalogBundleSha256:sourceRelease.catalogBundleSha256,sourceHashes:Object.fromEntries(sources),historicalReview:{findingsSha256:sha(oldFindingsBytes),inputsSha256:sha(oldInputsBytes),integritySha256:sha(oldIntegrityBytes),artifactCount:24},functionalContext:{path:post390ReceiptPath,sha256:sha(post390ReceiptBytes),tests:post390Receipt.tests,note:'Receipt context only; this review does not rerun functional or SQL qualification.'},tools:{jsdom:await version(uiRequire.resolve('jsdom')),domAccessibilityApi:await version(nameRequire.resolve('dom-accessibility-api'))},artifacts:[]};
const observations=[];let primaryChecked=0,networkCalls=0;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('Network forbidden in read-only artifact review');};
try{
 for(const route of ['collection','search'])for(const count of [4,0,1]){
  const file=`${route}-count-${count}.html`,bytes=await readFile(new URL(file,released));
  const artifact={route,count,path:releaseDir+file,sha256:sha(bytes),classification:count===4?'PRIMARY32_CONTROL_FOLLOW_UP':'COUNT_VARIANT'};inputs.artifacts.push(artifact);
  const dom=new JSDOM(bytes.toString('utf8'));
  const doc=dom.window.document,forms=[...doc.querySelectorAll('.ct-facets')];assert.equal(forms.length,2);
  assert.ok(doc.querySelector('style')?.textContent.includes('.lb-sr-only'));
  const oldArtifact=oldInputs.artifacts.find(row=>row.file===`circuit-${route}.html`);
  const oldDom=new JSDOM(await readFile(new URL(oldArtifact.path,root),'utf8'));
  const baseline=oldFunctional.rows.find(row=>row.slug==='letbuyy-forge'&&row.route===route);
  for(const affected of issue.affectedControls.filter(row=>row.file===`circuit-${route}.html`)){
   const matches=doc.querySelectorAll(affected.selector);assert.equal(matches.length,1,affected.selector);
   const input=matches[0],oldInput=oldDom.window.document.querySelector(affected.selector);assert.ok(oldInput);
   for(const attr of ['type','name','value','id'])assert.equal(input.getAttribute(attr),oldInput.getAttribute(attr),attr+' identity changed');
   assert.equal(input.checked,oldInput.checked,'Selected state changed');assert.equal(input.disabled,oldInput.disabled,'Disabled state changed');
   const facet=baseline.facets.find(row=>row.key===input.name&&row.value===input.value);assert.ok(facet);
   const expectedName=`${facet.label} (${count} matching product${count===1?'':'s'})`;
   const actualName=computeAccessibleName(input,{computedStyleSupportsPseudoElements:false});
   assert.equal(actualName,expectedName);assert.equal(getRole(input),input.type);
   const label=input.closest('label');assert.ok(label&&[...input.labels].includes(label));
   const visibleCount=label.querySelector('span[aria-hidden="true"]'),meaning=label.querySelector('.lb-sr-only');
   assert.ok(visibleCount&&meaning);assert.equal(visibleCount.textContent,String(count));
   assert.equal(meaning.textContent.trim(),`(${count} matching product${count===1?'':'s'})`);
   assert.equal(meaning.hasAttribute('aria-hidden'),false);assert.equal(input.hasAttribute('aria-label'),false);
   const separator=visibleCount.previousSibling;assert.equal(separator.nodeType,3);assert.match(separator.textContent,/\s$/);assert.match(meaning.textContent,/^\s/);
   const helperRules=[];const walkRules=(rules,parents=[])=>{for(const rule of rules){if(rule.selectorText==='.lb-sr-only')helperRules.push({parents,cssText:rule.cssText});if(rule.cssRules)walkRules(rule.cssRules,[...parents,rule.name??rule.conditionText??'group']);}};for(const sheet of doc.styleSheets)walkRules(sheet.cssRules);assert.ok(helperRules.some(rule=>rule.cssText.includes('position: absolute')&&rule.cssText.includes('overflow: hidden')));
   const style=dom.window.getComputedStyle(meaning);assert.notEqual(style.display,'none');assert.notEqual(style.visibility,'hidden');
   const fieldset=input.closest('fieldset'),legend=fieldset.querySelector('legend');assert.ok(legend);
   const groupName=computeAccessibleName(fieldset,{computedStyleSupportsPseudoElements:false});assert.equal(groupName,legend.textContent.trim());
   assert.equal(groupName,oldInput.closest('fieldset').querySelector('legend').textContent.trim());
   const panel=input.closest('aside.ct-desktop-facets')?'desktop':'mobile';
   const ownerWitness=ownerReport.choices.find(row=>row.route===route&&row.count===count&&row.form===(panel==='desktop'?0:1)&&row.key===input.name&&row.value===input.value);assert.ok(ownerWitness);assert.equal(ownerWitness.accessibleName,actualName);
   observations.push({...artifact,panel,selector:affected.selector,name:input.name,value:input.value,role:getRole(input),checked:input.checked,previousCount4Name:affected.accessibleName,accessibleName:actualName,accessibleDescription:computeAccessibleDescription(input),groupName,visibleCountAriaHidden:true,meaningfulCountExposed:true,separatingTextNode:separator.textContent,separatorLocation:'after option value and before aria-hidden visual count',clippedHelperDeclaration:helperRules,meaningStyle:{display:style.display,visibility:style.visibility,position:style.position,width:style.width,height:style.height,overflow:style.overflow},labelHtml:label.outerHTML,identityAndSelectedStateUnchanged:true});
   if(count===4)primaryChecked++;
  }
  oldDom.window.close();dom.window.close();
 }
}finally{globalThis.fetch=originalFetch;}
assert.equal(networkCalls,0);assert.equal(primaryChecked,32);assert.equal(observations.length,96);
for(const row of inputs.artifacts)assert.equal(sha(await readFile(new URL(row.path,root))),row.sha256,'Released HTML drift');
assert.equal(sha(await readFile(new URL('source-release.json',released))),inputs.release.sha256);
assert.equal(sha(await readFile(new URL('report.json',released))),inputs.ownerReport.sha256);
assert.equal(sha(await readFile(new URL('runtime.json',released))),inputs.ownerRuntime.sha256);
for(const[path,expected]of sources)assert.equal(sha(await readFile(new URL(path,root))),expected,'Released source changed during follow-up');
assert.equal(sha(await readFile(new URL('review-integrity.json',previous))),inputs.historicalReview.integritySha256);
for(const row of oldIntegrity.outputs)assert.equal(sha(await readFile(new URL(row.file,previous))),row.sha256,'Historical review output changed');
for(const row of oldInputs.artifacts)assert.equal(sha(await readFile(new URL(row.path,root))),row.sha256,'Historical artifact changed');
const result={findingId:'FILTER-A11Y-001',status:'CLOSED_FOR_RELEASED_HTML_COMPUTED_NAME_SCOPE',primaryControlsReviewed:primaryChecked,countVariantControlsReviewed:64,totalComputedNames:observations.length,artifacts:6,countFixtures:[0,1,4],routes:['collection','search'],panels:['desktop','mobile'],networkCalls,sourceEdits:false,historical24HtmlAndReviewUnchanged:true,conclusion:'Every targeted native choice retains its identity, checked state and named fieldset. Bare visual count is aria-hidden; meaningful singular/plural count is exposed with a separating text node. Computed names match the independent baseline facet label plus an unambiguous count phrase.',limits:['No browser or assistive-technology run; exact speech, visual layout and responsive focus exposure remain unqualified', 'The clipped helper declaration is inside CSS @layer; JSDOM does not apply that layer in computed style here, so visual clipping is not verified by this name computation','Previous R01 visible-purpose candidates and R02 responsive focus review remain open; they were not re-reviewed here','Count fixtures are rendered contract artifacts, not real merchant counts or SQL qualification','Post390 functional55 receipt is recorded as context, not rerun by this review']};
await writeFile(new URL('inputs.json',import.meta.url),JSON.stringify(inputs,null,2)+'\n');
await writeFile(new URL('observations.json',import.meta.url),JSON.stringify(observations,null,2)+'\n');
await writeFile(new URL('result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,primary:primaryChecked,total:observations.length,artifacts:6,networkCalls}));
