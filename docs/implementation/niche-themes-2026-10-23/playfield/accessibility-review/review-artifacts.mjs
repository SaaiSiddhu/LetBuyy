/** Read-only DOM accessibility inventory of the accepted immutable HTML checkpoint.
 * No catalogue/query parser, source mutation, rendering, browser or network calls. */
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=new URL('../../../../../',import.meta.url);
const archivePath='docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract/green-55-before390/';
const archive=new URL(archivePath,root);
const uiRequire=createRequire(new URL('packages/typescript/ui/package.json',root));
const {JSDOM}=uiRequire('jsdom');
const nameRequire=createRequire(uiRequire.resolve('@testing-library/dom'));
const {computeAccessibleName,computeAccessibleDescription,getRole}=nameRequire('dom-accessibility-api');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const owners={'playfield':'Playfield','circuit':'Circuit','pantry':'Pantry','habitat':'Habitat','kindred':'Kindred','madeyours':'MadeYours','dewdrop':'Dewdrop','trailmark':'Trailmark','marginalia':'Marginalia'};
const receiptBytes=await readFile(new URL('frozen-source-receipt.json',archive));
const reportBytes=await readFile(new URL('report.json',archive));
const receipt=JSON.parse(receiptBytes), report=JSON.parse(reportBytes);
if(receipt.tests.pass!==55||receipt.tests.fail||receipt.networkCalls||receipt.sourceChangedDuringRun.length)throw Error('Unexpected stable checkpoint contract');
if(sha(reportBytes)!==receipt.reportSha256)throw Error('Archived report hash does not match receipt');
const harnessBytes=await readFile(new URL('ui-facet-contract.test.ts',archive));
if(sha(harnessBytes)!==receipt.harnessSha256)throw Error('Archived oracle hash does not match receipt');
const jsdomVersion=JSON.parse(await readFile(new URL('../package.json',pathToFileURL(uiRequire.resolve('jsdom'))),'utf8')).version;
const accessibleNameVersion=JSON.parse(await readFile(new URL('../package.json',pathToFileURL(nameRequire.resolve('dom-accessibility-api'))),'utf8')).version;
const files=(await readdir(archive)).filter(file=>file.endsWith('.html')).sort();
if(files.length!==24)throw Error('Expected 18 primary plus six supplementary artifacts');
const inputs={classification:'READ_ONLY_FROZEN_HTML_ACCESSIBILITY_REVIEW_NOT_BROWSER_AT_OR_SQL_ACCEPTANCE',stableCheckpointConfirmedByCoordinator:true,archivePath,receipt:{path:archivePath+'frozen-source-receipt.json',sha256:sha(receiptBytes)},report:{path:archivePath+'report.json',sha256:sha(reportBytes),createdAt:report.createdAt},oracle:{path:archivePath+'ui-facet-contract.test.ts',sha256:sha(harnessBytes)},functionalQualification:receipt.tests,backend390PhysicalCapabilityStatus:receipt.backend390PhysicalCapabilityStatus,tools:{jsdomVersion,accessibleNameVersion,jsdomEntry:uiRequire.resolve('jsdom'),accessibleNameEntry:nameRequire.resolve('dom-accessibility-api')},artifacts:[]};
const inventory=[],candidates=[];
const nativeInvalid=control=>['valueMissing','typeMismatch','patternMismatch','tooLong','tooShort','rangeUnderflow','rangeOverflow','stepMismatch','badInput','customError'].filter(flag=>control.validity?.[flag]);
for(const file of files){
 const bytes=await readFile(new URL(file,archive));
 const owner=owners[file.split('-')[0]],route=file.includes('-search')?'search':'collection';
 const scope=file.includes('synthetic-physical')?'SUPPLEMENTAL_SYNTHETIC_PHYSICAL_CAPABILITY_NOT_REAL_SQL390':file.includes('-stationery')?'SUPPLEMENTAL_STATIONERY_FIXTURE':'PRIMARY';
 const input={owner,route,file,path:archivePath+file,sha256:sha(bytes),scope};inputs.artifacts.push(input);
 const dom=new JSDOM(bytes.toString('utf8'),{url:'https://frozen-artifact.example/'+route});
 const doc=dom.window.document;
 const name=el=>text(computeAccessibleName(el,{computedStyleSupportsPseudoElements:false}));
 const description=el=>text(computeAccessibleDescription(el,{computedStyleSupportsPseudoElements:false}));
 const ids=new Map();for(const el of doc.querySelectorAll('[id]'))ids.set(el.id,[...(ids.get(el.id)??[]),el]);
 function selector(el){
  if(el.id&&ids.get(el.id)?.length===1)return `[id=${JSON.stringify(el.id)}]`;
  const classes=[...el.classList].filter(value=>/^[a-zA-Z_][\w-]*$/.test(value));
  if(classes.length){const simple=el.tagName.toLowerCase()+'.'+classes.join('.');if(doc.querySelectorAll(simple).length===1)return simple;}
  if(el.form&&el.name){const simple=el.tagName.toLowerCase()+`[name=${JSON.stringify(el.name)}]`;if(el.form.querySelectorAll(simple).length===1)return selector(el.form)+' '+simple;}
  if(el===doc.body)return 'body';
  const siblings=el.parentElement?[...el.parentElement.children].filter(item=>item.tagName===el.tagName):[el];
  return (el.parentElement?selector(el.parentElement)+' > ':'')+el.tagName.toLowerCase()+`:nth-of-type(${siblings.indexOf(el)+1})`;
 }
 const excerpt=el=>el.outerHTML.slice(0,1200);
 const add=(kind,el,details,severity='review')=>candidates.push({...input,kind,severity,selector:selector(el),html:excerpt(el),...details});
 const hiddenLabel=el=>Boolean(el.closest('[hidden],[aria-hidden="true"]'))||[el,...function*(){for(let p=el.parentElement;p;p=p.parentElement)yield p;}()].some(node=>/(?:^|\s)(?:[\w-]*sr-only|visually-hidden)(?:\s|$)/.test(node.className??'')||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(node.getAttribute('style')??''));
 function labelInfo(control){return [...(control.labels??[])].map(label=>{const clone=label.cloneNode(true);for(const child of clone.querySelectorAll('input,select,textarea,button,svg,script,style'))child.remove();return {selector:selector(label),for:label.getAttribute('for'),text:text(clone.textContent),screenReaderOnlyOrHiddenMarker:hiddenLabel(label)};});}
 const controls=[...doc.querySelectorAll('input:not([type="hidden"]),select,textarea')].map(el=>{
  const labels=labelInfo(el),visibleLabels=labels.filter(label=>!label.screenReaderOnlyOrHiddenMarker&&label.text);
  const row={selector:selector(el),tag:el.tagName.toLowerCase(),type:el.type,name:el.name,id:el.id,form:el.form?selector(el.form):null,value:el.value,accessibleName:name(el),accessibleDescription:description(el),role:getRole(el),labels,visibleLabelText:visibleLabels.map(label=>label.text).join(' '),ariaLabel:el.getAttribute('aria-label'),ariaLabelledby:el.getAttribute('aria-labelledby'),placeholder:el.getAttribute('placeholder'),required:el.required,disabled:el.matches(':disabled'),willValidate:el.willValidate,invalidFlags:nativeInvalid(el),min:el.getAttribute('min'),max:el.getAttribute('max'),step:el.getAttribute('step'),html:excerpt(el)};
  if(el.type==='checkbox'||el.type==='radio')for(const label of el.labels??[])for(const count of label.querySelectorAll('span')){
    if(/^\d+$/.test(text(count.textContent))&&!count.closest('[aria-hidden="true"]')&&count.previousSibling?.nodeType===3&&/\S$/.test(count.previousSibling.textContent??''))add('choice-label-count-concatenation',el,{accessibleName:row.accessibleName,labelSelector:selector(label),labelHtml:excerpt(label),countText:text(count.textContent)});
  }
  if(!row.accessibleName)add('missing-accessible-name',el,{controlName:el.name},'P2');
  if(!visibleLabels.length)add('visible-label-review',el,{accessibleName:row.accessibleName,labels,placeholder:row.placeholder});
  if(row.willValidate&&row.invalidFlags.length)add('current-native-constraint-invalid',el,{value:row.value,invalidFlags:row.invalidFlags,min:row.min,max:row.max,step:row.step},'P2');
  return row;
 });
 const relationships=[];
 for(const el of doc.querySelectorAll('label[for],[aria-labelledby],[aria-describedby],[aria-errormessage],[aria-controls]'))for(const attr of ['for','aria-labelledby','aria-describedby','aria-errormessage','aria-controls']){
  const value=el.getAttribute(attr);if(!value)continue;
  for(const id of attr==='for'?[value]:value.split(/\s+/)){
   const targets=ids.get(id)??[];const row={selector:selector(el),attribute:attr,id,targetCount:targets.length,targets:targets.map(selector)};relationships.push(row);
   if(targets.length!==1)add('broken-or-ambiguous-reference',el,row,'P2');
  }
 }
 const duplicateIds=[...ids].filter(([,els])=>els.length>1).map(([id,els])=>({id,selectors:els.map(selector),references:relationships.filter(row=>row.id===id)}));
 for(const row of duplicateIds)add('duplicate-id',ids.get(row.id)[0],row,row.references.length?'P2':'review');
 const groups=[];
 for(const form of doc.querySelectorAll('form')){
  const choiceGroups=new Map();
  for(const el of form.querySelectorAll('input[type="checkbox"],input[type="radio"]')){const key=el.type+':'+el.name;choiceGroups.set(key,[...(choiceGroups.get(key)??[]),el]);}
  for(const [key,els]of choiceGroups){
   const contexts=[...new Set(els.map(el=>el.closest('fieldset,[role="group"],[role="radiogroup"]')).filter(Boolean))];
   const group={form:selector(form),key,type:els[0].type,name:els[0].name,controls:els.map(el=>({selector:selector(el),accessibleName:name(el),value:el.value,checked:el.checked})),contexts:contexts.map(el=>({selector:selector(el),role:getRole(el),accessibleName:name(el),legend:text(el.querySelector(':scope > legend')?.textContent)}))};groups.push(group);
   if(group.type==='radio'&&!group.name)add('radio-without-group-name',els[0],group,'P2');
   if(els.length>1&&!group.contexts.some(context=>context.accessibleName||context.legend))add('choice-group-context-review',els[0],group);
  }
 }
 const buttons=[...doc.querySelectorAll('button,input[type="submit"],input[type="reset"],input[type="button"]')].map(el=>{
  const row={selector:selector(el),form:el.form?selector(el.form):null,typeAttribute:el.getAttribute('type'),computedType:el.type,accessibleName:name(el),text:text(el.textContent),html:excerpt(el)};
  if(!row.accessibleName)add('unnamed-button',el,row,'P2');
  if(!row.typeAttribute)add('implicit-button-type',el,row);
  return row;
 });
 const forms=[...doc.querySelectorAll('form')].map(form=>{
  const invalid=[...form.elements].filter(el=>el.willValidate&&!el.validity.valid).map(el=>({selector:selector(el),name:el.name,flags:nativeInvalid(el)}));
  const pair=form.querySelector('[name="length_value"]:not([type="hidden"])'),unit=form.querySelector('[name="length_unit"]:not([type="hidden"])');
  const pairStates=[];
  if(pair||unit){
   for(const state of ['current','bothBlank','valueOnly','unitOnly']){
    const clone=form.cloneNode(true),value=clone.querySelector('[name="length_value"]:not([type="hidden"])'),units=clone.querySelector('[name="length_unit"]:not([type="hidden"])');
    if(state==='bothBlank'||state==='unitOnly')if(value)value.value='';
    if(state==='bothBlank'||state==='valueOnly')if(units)units.value='';
    pairStates.push({state,valuePresent:Boolean(value),unitPresent:Boolean(units),value:value?.value,unit:units?.value,emptyUnitOptionOffered:units?.tagName==='SELECT'?[...units.options].some(option=>option.value===''):null,invalid:[...clone.elements].filter(el=>el.willValidate&&!el.validity.valid).map(el=>({name:el.name,flags:nativeInvalid(el)}))});
   }
  }
  return {selector:selector(form),role:getRole(form),accessibleName:name(form),action:form.getAttribute('action'),method:form.method,noValidate:form.noValidate,currentNativeInvalid:invalid,pairStates};
 });
 const focusCandidates=[...doc.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]')].filter(el=>{
  if(el.matches(':disabled')||el.closest('[hidden],[inert]')||el.tabIndex<0)return false;
  for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!(el.tagName==='SUMMARY'&&el.parentElement===p))return false;
  return true;
 }).map((el,index)=>{
  const row={domIndex:index+1,selector:selector(el),role:getRole(el),accessibleName:name(el),tabIndex:el.tabIndex,form:el.form?selector(el.form):null,underAriaHidden:Boolean(el.closest('[aria-hidden="true"]'))};
  if(row.tabIndex>0)add('positive-tabindex-review',el,row);
  if(row.underAriaHidden)add('focus-candidate-under-aria-hidden',el,row,'P2');
  return row;
 });
 inventory.push({...input,forms,controls,buttons,relationships,duplicateIds,choiceGroups:groups,domFocusCandidates:focusCandidates,limits:['No theme CSS/layout or hydration is executed','Focus candidates are not an actual browser Tab order; radio traversal and AT behavior need later testing','Only contentForLayout is present; header/footer composition is not covered','Pair state diagnostics use detached native HTML constraints, not a copied domain validator']});
 dom.window.close();
}
for(const input of inputs.artifacts)if(sha(await readFile(new URL(input.file,archive)))!==input.sha256)throw Error('Immutable artifact changed during review: '+input.file);
if(sha(await readFile(new URL('frozen-source-receipt.json',archive)))!==inputs.receipt.sha256)throw Error('Archive receipt changed during review');
await writeFile(new URL('inputs.json',import.meta.url),JSON.stringify(inputs,null,2)+'\n');
await writeFile(new URL('inventory.json',import.meta.url),JSON.stringify(inventory,null,2)+'\n');
await writeFile(new URL('candidates.json',import.meta.url),JSON.stringify(candidates,null,2)+'\n');
const counts={};for(const row of candidates)counts[row.kind]=(counts[row.kind]??0)+1;
console.log(JSON.stringify({artifacts:inventory.length,primary:inventory.filter(row=>row.scope==='PRIMARY').length,forms:inventory.reduce((n,row)=>n+row.forms.length,0),controls:inventory.reduce((n,row)=>n+row.controls.length,0),candidates:counts}));
