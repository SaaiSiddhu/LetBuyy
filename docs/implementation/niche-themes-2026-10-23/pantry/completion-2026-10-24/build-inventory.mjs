// Pure source inventory. No app, browser, database, fixture or provider is started.
// This generated evidence is subordinate to the hand-authored project governance.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createFirstPartyCatalogBundle } from '../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import { buildLiquidThemePackagePersistencePayload } from '../../../../../packages/theme-engine/src/theme-bundle.ts';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const out = fileURLToPath(new URL('./', import.meta.url));
const own = 'docs/implementation/niche-themes-2026-10-23/pantry/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(root + path, 'utf8');
const json = path => JSON.parse(read(path));
const ref = path => ({ path, sha256: hash(readFileSync(root + path)) });
const save = (name, value) => writeFileSync(out + name, JSON.stringify(value, null, 2) + '\n');
const stable = value => value === null || typeof value !== 'object' ? value : Array.isArray(value)
  ? value.map(stable) : Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => [k,stable(v)]));
const equal = (a,b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const now = new Date().toISOString();
const head = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:root,encoding:'utf8'}).trim();
const branch = execFileSync('git', ['branch', '--show-current'], {cwd:root,encoding:'utf8'}).trim();
const packagePath = 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-refresh-2.0.0.json';
const admitted = json(packagePath);
const bundle = createFirstPartyCatalogBundle('letbuyy-refresh', {designVersion:'2.0.0'});
const payload = buildLiquidThemePackagePersistencePayload(bundle);
const registry = payload.schemaManifest;
const sourcePaths = [
  'GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md', 'AGENTS.md',
  'GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md', 'docs/implementation/AGENTS.md',
  'packages/theme-engine/AGENTS.md', 'apps/merchant/web/AGENTS.md', 'apps/commerce/web/AGENTS.md',
  'packages/theme-engine/src/pantry-theme.ts', 'packages/theme-engine/src/pantry-styles.ts',
  'packages/theme-engine/src/pantry-discovery.ts', 'packages/theme-engine/src/first-party-theme-catalog.ts',
  'packages/theme-engine/src/theme-bundle-core.ts', 'packages/theme-engine/src/theme-bundle.ts',
  'packages/theme-engine/src/niche-order-presentation.ts', 'packages/theme-engine/src/theme-document.ts',
  'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx',
  'apps/merchant/web/src/components/theme-editor/SectionTreePanel.tsx',
  'apps/merchant/web/src/components/theme-editor/BlockChildRow.tsx',
  'apps/merchant/web/src/components/theme-editor/TemplateSwitcherPanel.tsx',
  'apps/merchant/web/src/components/theme-editor/controls/ResourcePickerControl.tsx',
  'apps/merchant/web/src/components/theme-editor/controls/ImagePickerControl.tsx',
  'apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx',
  'apps/merchant/web/src/lib/theme-schemas.ts',
  'apps/commerce/web/src/lib/theme-engine/data-binding-engine.ts',
  'apps/merchant/web/src/components/products/niche-facts/pantry-facts-editor.tsx',
  'packages/commerce-core/src/pantry-facts.ts',
  'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/pantry-storybook/capabilities.json',
  'docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/letbuyy-design-blueprints/04-refresh-pantry.md',
  'docs/implementation/niche-theme-programme/OWNERSHIP.md',
  'docs/implementation/niche-theme-programme/completion-2026-10-24/EXECUTION_RUNBOOK.md',
  'docs/implementation/niche-theme-programme/completion-2026-10-24/COMMON_EXECUTION_PROMPT.md',
  'docs/implementation/niche-theme-programme/completion-2026-10-24/assignments/pantry.md',
  'apps/merchant/web/src/components/products/niche-facts/pantry-variant-facts-editor.tsx',
  'apps/merchant/web/src/components/products/VariantFactsEditor.tsx',
];
const controls = {text:'TextInput',textarea:'TextareaInput',richtext:'TextareaInput',color:'ColorInput',image:'ImagePickerControl',select:'SelectInput',toggle:'ToggleInput',range:'RangeInput',url:'UrlInput',number:'NumberInput',product:'ResourcePickerControl(product)',collection:'ResourcePickerControl(collection)',blog:'ResourcePickerControl(blog)',page:'ResourcePickerControl(page)',menu:'ResourcePickerControl(menu)'};
const fieldCases = field => {
  const states=['valid','save_full_reload','private_preview','publish_public_readback','clear_or_default','invalid_or_boundary','long_english_hindi_tamil','keyboard_label_focus'];
  if (['toggle','checkbox'].includes(field.type)) states.push('true_and_false');
  if (['number','range'].includes(field.type)) states.push('min_max_step_zero_and_outside');
  if (field.options) states.push('every_declared_option');
  if (field.visible_if) states.push('conditional_visibility');
  if (['image','product','collection','blog','page','menu'].includes(field.type)) states.push('bind_replace_clear','deleted_foreign_unavailable_resource','reload_same_identity');
  if (field.type==='image') states.push('owned_upload_library','alt_binding','focal_crop_if_declared');
  return states;
};
const fields = (schema, prefix, liquid, target='section') => schema.map(f => ({
  capabilityId:`${prefix}.${f.id}`, descriptor:f, controlSource:controls[f.type] || 'NOT_MAPPED_REQUIRES_TRACE',
  editorAvailability:'SOURCE_DESCRIPTOR_ONLY_BROWSER_NOT_RUN',
  directLiquidReference:liquid.includes(`${target}.settings.${f.id}`),
  referenceLimit:'A false direct reference is not a proven defect: canonical binding or layout may consume it.',
  requiredStates:fieldCases(f), acceptanceCase:`ED-FIELD:${prefix}.${f.id}`,
}));
const templates=Object.entries(bundle.templates).map(([key,t]) => ({
  key,name:t.name,layout:t.layout,order:t.order,
  group:['header','footer'].includes(key)?'SHARED_PINNED_GROUP':'TEMPLATE',
  sections:t.order.map(id=>({id,...t.sections[id]})),
  schemaDefined:true,installedAvailability:'REQUIRES_CURRENT_INSTANCE_READBACK',
  acceptanceCase:`ED-TEMPLATE:${key}`,
}));
const sections=Object.entries(bundle.sections).map(([type,file]) => ({
  type,path:file.path,name:file.schema.name,sourceSha256:hash(file.source),schema:file.schema,
  instantiatedAt:templates.flatMap(t=>t.sections.filter(s=>s.type===type).map(s=>({template:t.key,sectionId:s.id}))),
  settings:fields(file.schema.settings,`section:${type}`,file.source),
  blocks:file.schema.blocks.map(b=>({type:b.type,name:b.name,limit:b.limit ?? null,
    fixedSeam:b.type==='@app',
    effectiveSchema:b.type!=='@app' && !b.settings?.length && bundle.blocks[b.type] ? bundle.blocks[b.type].schema : b,
    schemaOrigin:b.type!=='@app' && !b.settings?.length && bundle.blocks[b.type] ? `blocks/${b.type}.liquid` : file.path,
    settings:b.type==='@app'?[]:fields(b.settings?.length?b.settings:bundle.blocks[b.type]?.schema.settings||[],`block:${type}/${b.type}`,file.source,'block'),
    acceptanceCase:b.type==='@app'?`SEC-APP-SEAM:${type}`:`ED-BLOCK:${type}/${b.type}`,
  })),
  operationPolicy:['header','footer'].includes(type)?'PINNED_GROUP_EDIT_BLOCKS_HIDE_AS_SUPPORTED_NO_ROOT_DELETE':'SCHEMA_ELIGIBLE_SACRIFICIAL_DRAFT',
  acceptanceCase:`ED-SECTION:${type}`,
}));
const globals=Object.entries(bundle.config.settings_schema.settings).map(([key,g])=>({key,label:g.label,description:g.description,
  fields:Object.entries(g.fields).map(([id,f])=>({capabilityId:`global:${key}.${id}`,id,descriptor:f,current:bundle.config.settings_data.current[id],controlSource:controls[f.type]||'TRACE_REQUIRED',requiredStates:fieldCases(f),acceptanceCase:`ED-FIELD:global:${key}.${id}`}))}));
const reusable=Object.entries(bundle.blocks).map(([type,file])=>({type,path:file.path,schema:file.schema,sourceSha256:hash(file.source),settings:fields(file.schema.settings,`reusable:${type}`,file.source,'block'),declaredChildTypes:file.schema.blocks || file.schema.allowed_child_types || null,acceptanceCase:`ED-REUSABLE:${type}`}));
const oldLedger=json(own+'installed-buyer-lifecycle-coordination.json');
const latest=oldLedger.nextRun;
const nichePromises=json(sourcePaths[26]).capabilities;
const catalogueFields=[
  ['ingredients','textarea','optional; max6000'], ['allergens.status','select','unknown or supplied'],
  ['allergens.statement','textarea','required when supplied; max4000'], ['allergens.source','text','required when supplied; max1000'],
  ['netQuantity.value','number','unvarianted only; positive integer<=1000000000'], ['netQuantity.unit','select','unvarianted only; g or ml'],
  ['storage','textarea','optional; max2000'], ['preparation','textarea','optional; max4000'], ['nutritionText','textarea','optional; max4000'],
  ['clear_net_quantity','action','explicit clear'], ['clear_all_food','action','explicit null'],
  ['variant.metadata.food.netQuantity.value','number','same real UUID; omission preserves; explicit metadata{} clears'],
  ['variant.metadata.food.netQuantity.unit','select','g or ml'], ['variant.clear_net_contents','action','explicit clear through parent command'],
  ['variant.price','money','canonical catalogue authority'], ['variant.option_values','option-map','preserve UUID on label/SKU edit'],
  ['variant.stock','inventory','only deliberate inventory edits; omit untouched stock'], ['product.images','media','canonical catalogue media binding'],
];
const gapNotes=[
  {id:'PANTRY-COMP-DECLARED-01',status:'SOURCE_TRACE_REQUIRED',target:'section:collection-product-list.title',finding:'Declared editable Heading has no direct section.settings.title reference in the Pantry collection rows body. Trace confirms product binding consumes product selectors, not this title; source-only inert-field candidate, normal editor reproduction not yet run.',owner:'Pantry leaf proposal; allocator admission required before source modification',next:'Private minimal proposal only; do not replace captured2.0.0 bytes.'},
  {id:'PANTRY-COMP-DECLARED-02',status:'SOURCE_TRACE_REQUIRED',target:'section:customer-order-detail.heading',finding:'Inherited schema declares heading; current order-detail body uses fixed Order # plus actual order number, without a heading setting reference. No normal editor reproduction claimed. Preserve essential order identity when resolving the advertised control.',owner:'Existing shared base/order presentation owner; no Pantry shared edit'},
  {id:'PANTRY-COMP-PROMISE-01',status:'OPEN_REQUIREMENT_MAPPING',target:'Approved blueprint editor controls',finding:'Blueprint mentions permitted card facts, supported layout choices, type scale limits and shelf-life policy. Current package exposes fixed Pantry composition, six colors/two font families/corner radius, and food nutrition toggle; no dedicated card-fact/layout-choice/type-scale/shelf-life-policy descriptors were found. Determine existing canonical settings/policy destination and applicability with independent reviewer; no blanket N/A or new design.',owner:'Shared schema/editor/catalogue owners; exact allocation pending'},
  {id:'PANTRY-COMP-APP-01',status:'PROTECTED_SEAM_REVIEW',target:'app-block-slot and spotlight @app declarations',finding:'Inherited @app declarations are inventoried. Constitution NEVER-R3 keeps third-party app blocks dormant. Required coverage verifies safe restriction and clear UI; this assignment does not authorize activation.',owner:'Shared editor/allocator'},
];
const inventory={schemaVersion:1,generatedAt:now,classification:'SOURCE_DERIVED_EVIDENCE_NOT_GOVERNANCE_NOT_RUNTIME_ACCEPTANCE',theme:'Pantry',preset:'refresh',branch,head,
  humanMandate:{verifiedInChat:'01a16ce5-e5ba-7191-ab2c-a1b76947d2b5',userMessageId:'01a16cf8-9a07-7cc3-ada1-739b7457b14f',scope:'Ten-theme completion; Pantry recipient explicitly named; runtime and shared leases remain separate'},
  derivation:{canonicalFactory:'createFirstPartyCatalogBundle(letbuyy-refresh,{designVersion:2.0.0})',canonicalSchemaProjection:'buildLiquidThemePackagePersistencePayload(bundle).schemaManifest',executed:'Pure local factory/schema introspection only; no tests/build/browser/database/network/provider',rawFactoryJsonSha256:hash(JSON.stringify(bundle)),canonicalFactoryJsonSha256:hash(JSON.stringify(stable(bundle))),package:bundle.package,admittedPackage:ref(packagePath),admittedBundleClaim:admitted.bundleSha256,admittedBundleSemanticallyEqual:equal(bundle,admitted.document.liquidBundle),admittedTemplatesEqual:equal(bundle.templates,admitted.document.liquidBundle.templates),admittedSectionSchemasEqual:equal(Object.fromEntries(Object.entries(bundle.sections).map(([k,v])=>[k,v.schema])),Object.fromEntries(Object.entries(admitted.document.liquidBundle.sections).map(([k,v])=>[k,v.schema]))),note:'Current source schema inventory; installed serving bundle/revision and current candidate lineage remain an execution gate.'},
  counts:{templates:templates.length,templateSectionInstances:templates.reduce((n,t)=>n+t.sections.length,0),sectionTypes:sections.length,inlineBlockDeclarations:sections.reduce((n,s)=>n+s.blocks.length,0),reusableBlockTypes:reusable.length,globalFields:globals.reduce((n,g)=>n+g.fields.length,0),sectionFields:sections.reduce((n,s)=>n+s.settings.length,0),effectiveInlineBlockFields:sections.reduce((n,s)=>n+s.blocks.reduce((m,b)=>m+b.settings.length,0),0)},
  templates,sections,reusableBlocks:reusable,globalSettings:globals,
  settingsDataPresets:bundle.config.settings_data.presets,
  layoutAndLocale:{layouts:Object.entries(bundle.layout).map(([key,v])=>({key,path:v.path,sourceSha256:hash(v.source)})),locales:Object.keys(bundle.locales),renderer:bundle.renderer,declaredAssetManifest:payload.rendererManifest.asset_manifest,assetLimit:'Empty captured asset manifest is actual. Merchant images and public approved files require bound resource/network proof; file existence alone is not a loaded-asset PASS.'},
  runtimeSchema:{section_schemas:registry.section_schemas,settings_schema:registry.settings_schema,block_schemas:registry.block_schemas ?? null},
  sharedGroups:{representation:'header/footer template keys in this bundle, not a separate section_groups export',header:templates.find(t=>t.key==='header'),footer:templates.find(t=>t.key==='footer')},
  catalogueControls:catalogueFields.map(([path,type,constraints])=>({path,type,constraints,authority:'Canonical product editor/commerce-core; never theme price/stock data',acceptanceCase:`CAT:${path}`})),
  mediaAndResources:[...sections.flatMap(s=>[
    ...s.settings.filter(f=>['image','product','collection','blog','page','menu','url'].includes(f.descriptor.type)).map(f=>({section:s.type,...f})),
    ...s.blocks.flatMap(b=>b.settings.filter(f=>['image','product','collection','blog','page','menu','url'].includes(f.descriptor.type)).map(f=>({section:s.type,block:b.type,...f}))),
  ]),...globals.flatMap(g=>g.fields.filter(f=>['image','product','collection','blog','page','menu','url'].includes(f.descriptor.type)).map(f=>({globalGroup:g.key,...f})))],
  advertisedCapabilities:nichePromises.map((p,i)=>({...p,id:`PROMISE:${String(i+1).padStart(2,'0')}`,evidenceClass:'APPROVED_DESIGN_PROMISE_NOT_IMPLEMENTATION_PROOF',coverageRequired:p.class!=='E',acceptanceCase:`DESIGN:${String(i+1).padStart(2,'0')}`})),
  interactionStates:['loading','empty','missing_media','unknown_food_facts','unselected_variant','known_available','known_oos','label_only_unknown','fractional_or_blank_pack_count','pending_duplicate_block','server_refusal','network_failure','expired_identity','stale_draft','lost_acknowledgement','resource_deleted','stale_cart_after_same_uuid_edit','immutable_history'],
  openGaps:gapNotes,sources:sourcePaths.map(ref),
  limitations:['Declarations and source mappings do not prove connected live controls.','No fresh fixture or installed package read was performed.','All new required browser/provider cases start NOT_RUN.','Private resource bindings and credentials are omitted.'],
};
save('CAPABILITY_INVENTORY.json',inventory);

const lifecycleOps=['add_apply','edit','reorder','hide_show','save_full_reload','private_preview','publish_public_readback','delete_save_reload_public_absence','readd_rebind_publish','undo_redo','validation_conflict_reauth_lost_response_recovery'];
const rows=[];
const add=(caseId,requirement,operation,extra={})=>rows.push({caseId,requirement,operation,required:true,applicability:{value:'APPLICABLE',reason:'Declared capability or explicit human requirement; constraints retained',reviewer:null},status:'NOT_RUN',source:{head,closureManifest:null,artifactHash:null,buildId:null,schemaVersion:bundle.schema_version},runtime:{runId:null,mode:null,siteId:null,actorRealm:null,scopeReference:null},expected:{ui:'Declared control and exact acknowledged persisted output; no fabricated data',http:'Actual request status/code/correlation where a request occurs',businessEffects:'Only permitted owned changes; authoritative readback and protected-state comparison',providerEffects:null},observed:null,evidence:[],commands:[],review:{status:'PENDING',reviewer:null,evidence:[]},limitations:['Source enumeration only; actual execution required'],nextAction:'Await current exact controller/source/runtime grant; use owned sacrificial scope',...extra});
for(const t of templates) add(`ED-TEMPLATE:${t.key}`,`Correct resource context and every instantiated section in ${t.key}`,'select_template_resource; exact_section_block_selection; save_reload_preview_publish; inspect_public_privacy',{template:t.key,sectionInstances:t.sections.map(s=>({id:s.id,type:s.type})),perInstanceCoverage:t.sections.map(s=>({sectionId:s.id,sectionType:s.type,fields:sections.find(x=>x.type===s.type).settings.map(f=>f.capabilityId),status:'NOT_RUN'}))});
for(const s of sections){
 add(s.acceptanceCase,`Every declared ${s.type} section operation`,s.operationPolicy==='PINNED_GROUP_EDIT_BLOCKS_HIDE_AS_SUPPORTED_NO_ROOT_DELETE'?'edit_save_reload_preview_publish; pinned_group_constraint; block_lifecycle':lifecycleOps.join('; '),{sectionType:s.type,declaredOn:s.instantiatedAt,operationResults:Object.fromEntries((s.operationPolicy==='PINNED_GROUP_EDIT_BLOCKS_HIDE_AS_SUPPORTED_NO_ROOT_DELETE'?['edit','save_full_reload','private_preview','publish_public_readback','pinned_root_constraint']:lifecycleOps).map(o=>[o,'NOT_RUN'])),templateEligibility:{enabled_on:s.schema.enabled_on,disabled_on:s.schema.disabled_on}});
 for(const f of s.settings) add(f.acceptanceCase,`Persist and render ${f.capabilityId}`,f.requiredStates.join('; '),{sectionType:s.type,field:f.descriptor.id,descriptor:f.descriptor,declaredOn:s.instantiatedAt,stateResults:Object.fromEntries(f.requiredStates.map(o=>[o,'NOT_RUN']))});
 for(const b of s.blocks){
  add(b.acceptanceCase,b.fixedSeam?'Dormant app-block seam is safely restricted':`Full block lifecycle ${s.type}/${b.type}`,b.fixedSeam?'verify_unauthorized_activation_denied_and_clear_state':lifecycleOps.join('; '),{sectionType:s.type,blockType:b.type,declaredSchema:b.effectiveSchema});
  for(const f of b.settings) add(f.acceptanceCase,`Persist/render exact block setting ${f.capabilityId}`,f.requiredStates.join('; '),{sectionType:s.type,blockType:b.type,field:f.descriptor.id,descriptor:f.descriptor});
 }
}
for(const g of globals)for(const f of g.fields)add(f.acceptanceCase,`Global ${g.key}/${f.id}`,f.requiredStates.join('; '),{field:f.id,globalGroup:g.key,descriptor:f.descriptor});
for(const [name,values] of Object.entries(bundle.config.settings_data.presets))add(`ED-PRESET:${name}`,`Declared preset ${name} applies only the supported style/composition scope with safe review`, 'preview_difference; apply_supported_mode; preserve_content_identity; save_reload; private_preview; publish_public_readback; undo_restore',{preset:name,declaredValues:values});
for(const b of reusable){add(b.acceptanceCase,`Reusable ${b.type} block inheritance and supported nested child identity`,lifecycleOps.join('; '),{blockType:b.type,declaredChildTypes:b.declaredChildTypes});for(const f of b.settings)add(f.acceptanceCase,`Reusable ${b.type}/${f.descriptor.id}`,f.requiredStates.join('; '),{blockType:b.type,field:f.descriptor.id});}
for(const f of inventory.catalogueControls)add(f.acceptanceCase,`Canonical product ${f.path} control`,'valid_invalid_clear_save_reload; same_uuid; parent_command; omit_untouched_stock; public_readback',{field:f.path,priorEvidence:['P01','P02','P03','P04','P05'].map(id=>({caseId:id,runId:latest.runId,reuse:'Specific accepted components only; not expanded coverage PASS'}))});
for(const p of inventory.advertisedCapabilities)if(p.coverageRequired)add(p.acceptanceCase,p.feature,'trace_control_binding; normal_save_reload_preview_publish; niche_acceptance',{designPromise:p});
const common=[
 ['ED-RECOVERY','Exact draft A/B seven-check cycle, revision conflict, duplicate, lost response/re-auth and unsaved navigation preservation'],
 ['ED-PREVIEW-SEC','Forged/stale preview messages, exact nested selection, correct template/resource; no public private inspector/draft identifiers'],
 ['ID-SIGNUP','Normal new LetBuyy buyer registration and configured security/verification via local capture where actually required'],
 ['ID-MERCHANT','Normal canonical LetBuyy merchant signup/signin/onboarding where required for theme ownership, with realm/site membership and draft preservation; seeded fixture login is setup, not signup proof'],
 ['ID-SIGNIN','Signin, explicit consent/callback to Pantry, fullreload, signout, signin and recovery'],
 ['ID-CUSTOMER','Supported store-bound customer entry, profile, address create/edit/default/delete, direct owned order navigation'],
 ['ID-DENIAL','Own positive control then wrong-store callback/state-PKCE-code replay/expired session/cross-buyer-store/realm denial; independent sessions conserved'],
 ['CART-RECOVERY','Normal variant add/update/remove/readd/reload; pending duplicate protection; network/lost response recovery using original intent'],
 ['CHECKOUT-QUOTE','Actual server address/shipping/discount/tax/eligible payment quote and trusted normal hosted entry; no client authority'],
 ['COD-RECOVERY','Normal local COD purchase plus uncertain commit and same-claim original-intent retry exactly once'],
 ['RP-PURCHASE','Actual Pantry browser Razorpay Test Mode purchase; redacted provider order/payment/event linkage, server verification, canonical order/ledger and both views'],
 ['RP-ADVERSARIAL','Reuse once-qualified same-source shared provider negatives/races/idempotency/signature/amount/currency/order/site/expiry and PSP-success-local-failure reconciliation'],
 ['RP-REVERSAL','Applicable test-mode cancellation/refund/reversal through canonical authorities, exactly-once balanced ledger and reconciliation'],
 ['HISTORY-IMMUTABLE','Both buyer/merchant persisted selected pack/options/food/price immutable after same-UUID facts/title/media/price edit; supported missing/malformed historic controls'],
 ['QA-RESPONSIVE','Measured content320/390/768/834/1440, long English/Hindi/Tamil,200% text/zoom, fonts/images, safe unknown/OOS/error and reduced motion'],
 ['QA-A11Y','Composed keyboard/focus/return, accessible names/semantics/announcements/contrast and reflow; scans supplement manual output'],
 ['QA-PERF','Representative useful readiness/interaction with stated conditions, sample/percentile/request-byte-work scope and existing explicit budget'],
 ['SEC-LIQUID','Relevant Liquid sandbox/SSTI/stored XSS/escaping/resource privacy positive and negative controls on exact admitted artifact'],
 ['SEC-TENANT','Actual mounted Worker/owned-PG positive-control-first tenant/auth denial, raw private snapshot never public'],
 ['LINEAGE','Exact source/artifact/build/schema/runtime installed/serving lineage; admit changed-input affected regression'],
 ['PRESERVE-CLEANUP','Before/after protected apps/drafts/orders/inventory/session state; only owned cleanup; all failure evidence retained'],
 ['REVIEW','Independent acceptance review of original13 plus all expanded applicable cases; no missing provider result or invented N/A'],
];
for(const [id,req] of common)add(id,req,'complete finite contract with actual UI/HTTP/DB/provider evidence as applicable',id.startsWith('RP-')?{providerRequired:true}:{});
const original=Object.entries(latest.rows).map(([caseId,r])=>({caseId,required:true,status:r.status.replaceAll(' ','_'),runId:latest.runId,evidence:r.audit?[r.audit]:[],reason:r.reason||null,repairAndReverificationRequired:r.repairAndReverificationRequired||false,newCandidateStatus:'NOT_RUN',reuseDisposition:caseId<='P08'?'Retain actual936 acceptance; reuse only with matching inputs and environment assumptions; not a new-candidate PASS.':caseId==='P09'?'Retain both actual failures and exact HTTP/code unobserved limit; owner repair then normal UI reverify.':'Actual936 NOT_RUN; historicalf607 is not substitution.'}));
save('COVERAGE.json',{schemaVersion:1,updatedAt:now,classification:'ORIGINAL_ACTUAL_RESULTS_PLUS_UNEXECUTED_ADDITIVE_COVERAGE',theme:'Pantry',inventory:ref(own+'completion-2026-10-24/CAPABILITY_INVENTORY.json'),originalMatrix:ref(own+'installed-buyer-lifecycle-matrix.md'),originalLedger:ref(own+'installed-buyer-lifecycle-coordination.json'),originalCases:original,originalActualCounts:latest.resultCounts,historicalRuns:[{run:'9cd50e893016',scope:'old top-level rows; retained only'},{run:'f6074d90e894',counts:{PASS:11,BLOCKED:2},fixture:'CLOSED_DB_REMOVED',limits:'P08/P12 exact surfaced response missing; never promoted with936 proof'}],expandedCases:rows,expandedCounts:{NOT_RUN:rows.length},countLimits:'Composite obligation rows; operation/state children are unexecuted subcoverage, never counted as extra lifecycle passes.',p12Required:true,p12Sequence:['P09 real normal Pantry COD order','P10 both saved histories and immutable snapshot hash','distinct normally accepted active250g cart BEFORE P11','P11 same UUID300g240INR and supplied allergen edit, stock omitted','P12 one stale confirm: actual409/code/requestId; no new order/inventory effect; expected checkout/outbox deltas separately','both old histories/hash unchanged; normal current300g reaccept within remaining stock'],certification:{LOCAL_E2E_VERIFIED:false,RAZORPAY_TEST_VERIFIED:false,REVIEW_ACCEPTED:false,FULL_THEME_CERTIFIED:false,PRODUCTION_DEPLOYED:'NOT_REQUESTED'},nextExecutableSlice:'Source-only inert-heading proposal and precise file-based controller/runtime request; no active shared/browser lease'});
save('SOURCE_MANIFEST.json',{recordedAt:now,branch,head,scope:'Finite inputs for source-derived inventory; dirty shared tree is not represented by HEAD alone',sourceInputs:sourcePaths.map(ref),package:ref(packagePath),matrix:ref(own+'installed-buyer-lifecycle-matrix.md'),historicalAdmissions:[ref('docs/implementation/niche-theme-programme/editor-stable392-02-runtime-admission.json'),ref('docs/implementation/niche-theme-programme/editor-font-axis-runtime-admission-02.json')],activeRuntimeLease:null,activeBrowserLease:null,activeSharedWriterLease:null,helperActivation:json('docs/implementation/niche-theme-programme/completion-2026-10-24/EXECUTION_STATE.json').helperActivation,protectedResources:'Existing Marketplace, user tabs/accounts/cookies, original drafts/releases, all existing carts/orders/inventory and env/signing files; old936/f607/9cd not adopted',actions:'Pure source reads/factory/schema projection and own evidence writes only'});
console.log(JSON.stringify({inventory:inventory.counts,rawFactorySha:inventory.derivation.rawFactoryJsonSha256,admittedTemplatesEqual:inventory.derivation.admittedTemplatesEqual,admittedSectionSchemasEqual:inventory.derivation.admittedSectionSchemasEqual,original:latest.resultCounts,expandedNotRun:rows.length,sourceInputs:sourcePaths.length}));
