// Explicit allocator admission and the canonical owned runner are mandatory.
// Native/API qualification only; no browser, provider or theme certification.
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { setImmediate as yieldToTransport } from 'node:timers/promises';
import { z } from 'zod';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { StorefrontDiscoveryQuerySchema, StorefrontDiscoveryMetadataSchema, ElectronicsFactsSchema, normalizeStorefrontManufacturerKey } from '@letbuyy/commerce-core';
import { readStorefrontDiscoveryPayload } from '../../lib/storefront-discovery';
import { Gateway, gatewayEnv, newIdentityKeys, tapRest, type RestTap } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(), root = resolve(process.cwd());
const docs = 'docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/facet-private-implementation-03';
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const j = (value: unknown) => q(JSON.stringify(value)) + '::jsonb';
const ident = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const up = read(docs + '/UNNUMBERED_circuit_facets.up.proposal.sql'), down = read(docs + '/UNNUMBERED_circuit_facets.down.proposal.sql');
const changes = z.array(z.object({ name: z.string(), signature: z.string(), beforeMd5: z.string(), afterMd5: z.string() })).parse(JSON.parse(read(docs + '/sql-source-conservation.json')).changedFunctions);
const evidenceDirectory = mkdtempSync(join(tmpdir(), 'letbuyy-circuit-facets-' + owned.runId + '-'));
let sequence = 0, gateway: Gateway | undefined, proxy: OwnedPooledSqlProxy | undefined, tap: RestTap | undefined, outage = false;
function proof(operation: string, value: unknown) {
  const path = join(evidenceDirectory, String(++sequence).padStart(4,'0') + '-' + operation + '.json');
  const text = JSON.stringify({ runId: owned.runId, operation, value }, null, 2) + '\n';
  writeFileSync(path, text, { mode: 0o600, flag: 'wx' });
  console.info('CIRCUIT_FACET_PROVENANCE', JSON.stringify({ path, sha256: sha(text) }));
}
const parse = (sql: string): unknown => JSON.parse(owned.psql(sql));
const a = newSyntheticTenant('facet-a'), b = newSyntheticTenant('facet-b');
const observedHttp: Array<{requestId:string;traceId:string;route:string;status:number;errorCode:string|null}> = [];
const ids: Record<string,string> = {}, variants: Record<string,string> = {}, makers: string[] = [];
const device = { manufacturer: 'Synthetic Devices', model: 'Fixture Host 1', reference: 'Synthetic merchant document A', source_date: '2026-10-24' };
const facts = { manufacturer: 'Synthetic Lab', model: 'Facet H1', kind: 'hub', connectors: [{ kind: 'usb-c', role: 'power-input', count: 1 }, { kind: 'usb-c', role: 'power-output', count: 2 }, { kind: 'hdmi', role: 'video', count: 1 }], power_input_w: 65, power_output_w: 45, pass_through_output_w: 60, compatible_devices: [device, { ...device, model: 'Fixture Host 2' }] };
const manufacturerCases = [['SYNTHETIC LAB','synthetic lab'],['नमूना','नमूना'],['மாதிரி','மாதிரி'],['İSTANBUL','istanbul'],['ΟΣ','οσ'],['MÜLLER','müller'],['I\u0307','i\u0307']] as const;

function product(site: SyntheticTenant, name: string, metadata: unknown, price = 1200, stock = 8) {
  const id = randomUUID();
  owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,category,country_of_origin,metadata) VALUES(${q(id)},${q(site.siteId)},${q(site.siteId)},${q(name)},${q('syn-'+id)},${price},${stock},true,'active','Circuit facets','India',${j(metadata)});`);
  return id;
}
function browse(query: Record<string,unknown>, site = a, only?: string[]) {
  const parsed = StorefrontDiscoveryQuerySchema.parse(query);
  const raw = parse(`SELECT public.browse_storefront_products_v1(${q(site.siteId)},${j(parsed)},${only ? `ARRAY[${only.map(q)}]::uuid[]` : 'NULL'});`);
  proof('browse', { siteId: site.siteId, query: parsed, only, raw });
  return readStorefrontDiscoveryPayload(raw, parsed);
}
function tableHashes() {
  const names = z.array(z.string()).min(1).parse(parse("SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p');"));
  const output = owned.scriptLarge('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL jit=off;' + names.map(name => `SELECT jsonb_build_object('table',${q(name)},'hash',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]')::text,'UTF8')),'hex')) FROM public.${ident(name)} x;`).join('\n') + 'COMMIT;');
  const rows = output.split(/\r?\n/).filter(line => line.startsWith('{')).map(line => z.object({ table: z.string(), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(JSON.parse(line)));
  assert.deepEqual(rows.map(row => row.table), names);
  const result = Object.fromEntries(rows.map(row => [row.table,row.hash]));proof('all-public-table-hashes', result);return result;
}
function catalog(): Array<Record<string,unknown>> {
  return z.array(z.record(z.string(),z.unknown())).parse(parse(`SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(p),'comment',obj_description(p.oid,'pg_proc'),'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database()))) ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND(p.proname LIKE 'storefront_discovery_%_v1' OR p.proname IN('browse_storefront_products_v1','browse_storefront_apparel_v1'));`));
}
const withoutChangedBodies = (rows: Array<Record<string,unknown>>) => rows.map(entry => {
  const row = z.record(z.string(),z.unknown()).parse(entry.row);
  return { ...entry, row: changes.some(change => change.name === row.proname) ? { ...row, prosrc: '<only-allowed-body-change>' } : row };
});
function expectBodies(which: 'beforeMd5' | 'afterMd5') {
  for (const change of changes) assert.equal(owned.psql(`SELECT md5(prosrc) FROM pg_proc WHERE oid=${q(change.signature)}::regprocedure;`), change[which]);
}
function flat(metadata: unknown) { return z.record(z.string(),z.unknown()).parse(parse(`SELECT public.storefront_discovery_flat_v1(${j(metadata)},'{}',false,'{}','[]');`)); }
async function http(site: SyntheticTenant, query: Record<string,string>, uuidRoute = false) {
  assert(gateway);await yieldToTransport();
  const path = `/v1/storefront/${uuidRoute ? 'store/' + site.siteId : site.subdomain}/products?` + new URLSearchParams(query);
  const requestId=randomUUID(),traceId=randomUUID(),route=uuidRoute?'/v1/storefront/store/:storeId/products':'/v1/storefront/:subdomain/products';
  const result = await gateway.request(path,{headers:{'X-Request-ID':requestId,'X-Trace-ID':traceId}});await gateway.settle();
  assert.equal(result.headers.get('X-Request-ID'),requestId);assert.equal(result.headers.get('X-Trace-ID'),traceId);
  // The outer security middleware adds its public error header after the
  // inner observability middleware has recorded this direct JSON response.
  observedHttp.push({requestId,traceId,route,status:result.status,errorCode:null});
  proof('actual-worker-http', { path, status: result.status, requestId: result.headers.get('x-request-id'), body: result.json });return result;
}
let baselineCatalog: Array<Record<string,unknown>>, baselineRows: Record<string,string>;
const legacyQueries = [{ age_band:'6-8', interest:'art' }, { pack_size:'g:250' }, { material:'wood', max_width_cm:61 }, { occasion:'birthday',recipient:'friend' }, { personalization_method:'engrave' }, { routine_stage:'care' }, { activity:'badminton',length_value:675,length_unit:'mm' }, { books_language:'Hindi', books_subject:'Fiction' }, { connector:['usb-c','hdmi'],power_output_w:45 }, { search:'LegacyModel',sort:'price-asc' }];
let legacyBefore: ReturnType<typeof browse>[] = [];

after(async () => { await gateway?.settle();tap?.restore();await closePooledSqlClients();await proxy?.stop(); });
test('Circuit facets: one admitted owned qualification, eight ordered stages', async t => {
  const stage = async (name: string, run: () => void | Promise<void>) => {
    let failure: unknown;
    await t.test(name, async () => { try { await run(); } catch (error) { failure = error;throw error; } });
    if (failure) throw failure; // Stop after the first failed stage; no repair/retry.
  };
  await stage('1 exact admission, fresh synthetic scope and baseline defect', () => {
    const admission = z.object({ status: z.literal('ROOT_ACCEPTED_FOR_OWNED_NATIVE_QUALIFICATION'), upSha256: z.string(), downSha256: z.string(), suiteSha256: z.string(), migrationCeiling: z.null(), sourceFiles: z.array(z.object({ path:z.string(), sha256:z.string() })).min(2) }).parse(JSON.parse(read(docs + '/admission.json')));
    assert.equal(sha(up), admission.upSha256);assert.equal(sha(down), admission.downSha256);assert.equal(sha(readFileSync(new URL(import.meta.url),'utf8')), admission.suiteSha256);
    for (const file of admission.sourceFiles) assert.equal(sha(read(file.path)),file.sha256,file.path);
    proof('source-admission', admission);expectBodies('beforeMd5');
    seedSyntheticTenant(owned.psql,a);seedSyntheticTenant(owned.psql,b);
    ids.hub=product(a,'Circuit facet hub',{electronics:facts});ids.foreign=product(b,'Foreign facet hub',{electronics:facts});
    ids.empty=product(a,'Empty electronics',{electronics:{}});ids.absent=product(a,'Absent electronics',{});
    ids.sheet=product(a,'General sheet',{electronics:{kind:'other',fact_sheet:{reference:'Synthetic sheet',source_date:'2026-10-24'}}});
    ids.connector=product(a,'Connector only',{electronics:{kind:'cable',connectors:[{kind:'usb-c',role:'host',count:1}]}});
    ids.variant=product(a,'Variant accessory',{electronics:{...facts,manufacturer:'Synthetic Variant Lab',model:'Tuple common'}},2000);
    owned.psql(`INSERT INTO product_options(product_id,name,position,values) VALUES(${q(ids.variant)},'Color',0,'["Graphite","Silver"]');`);
    for (const [color,price,stock] of [['Graphite',1900,3],['Silver',700,0]] as const) {
      const id=randomUUID();variants[color]=id;
      owned.psql(`INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1,metadata) VALUES(${q(id)},${q(ids.variant)},${q(color)},${price},${stock},${q(color)},'{}');SELECT public.set_inventory_level_available(${q(ids.variant)},${q(id)},${q(a.locationId)},${stock},NULL);`);
    }
    ids.aCollection=randomUUID();ids.bCollection=randomUUID();
    owned.psql(`INSERT INTO collections(id,store_id,title,is_active) VALUES(${q(ids.aCollection)},${q(a.siteId)},'Owned A collection',true),(${q(ids.bCollection)},${q(b.siteId)},'Owned B collection',true);INSERT INTO collection_products(collection_id,product_id,position) VALUES(${q(ids.aCollection)},${q(ids.hub)},0),(${q(ids.bCollection)},${q(ids.foreign)},0);`);
    const legacy={ electronics:{...facts,model:'LegacyModel'},toys:{ageBands:['6-8'],interests:['art']},food:{netQuantity:{value:250,unit:'g'}},furniture:{assembled:{width:61,depth:70,unit:'cm'},materials:['Wood']},gifts:{occasions:['birthday'],recipients:['friend']},personalization:{version:1,revision:1,methods:[{id:'engrave',label:'Engrave',min_graphemes:1,max_graphemes:12,character_set:'latin-name',styles:[{id:'sans',label:'Sans'}],placements:[{id:'front',label:'Front'}]}]},beauty:{routineStage:'care'},sports:{activity:'badminton',equipmentType:'racket',length:{value:67.5,unit:'cm'}},books:{kind:'book',language:'Hindi',subjects:['Fiction']} };
    ids.legacy=product(a,'All-theme fact carrier',legacy);
    for(let index=0;index<42;index++) makers.push(product(a,'Maker '+index,{electronics:{manufacturer:'Maker '+index,kind:'other'}},100));
    manufacturerCases.forEach(([manufacturer], index) => { ids['unicode-'+index] = product(a,'Unicode manufacturer '+index,{electronics:{manufacturer,kind:'other'}}); });
    legacyBefore=legacyQueries.map(query=>browse(query,a,[ids.legacy]));
    assert.equal(owned.psql(`SELECT public.storefront_discovery_shape_v1(${j({page:1,limit:20,sort:'display_order',electronics_manufacturer:'Synthetic Lab'})},'$query');`),'f');
    baselineCatalog=catalog();assert.equal(baselineCatalog.length,13);baselineRows=tableHashes();
  });
  await stage('2 exact helper UP and full catalogue/data conservation', () => {
    owned.script(up);expectBodies('afterMd5');assert.deepEqual(withoutChangedBodies(catalog()),withoutChangedBodies(baselineCatalog));assert.deepEqual(tableHashes(),baselineRows);
  });
  await stage('3 strict query parity, evidence/unknown facts and role denial', () => {
    const inputs=[{electronics_manufacturer:' Synthetic Lab ',compatibility_evidence:'supplied'},{compatibility_evidence:'unconfirmed'},{electronics_manufacturer:'x'.repeat(121)},{compatibility_evidence:'guaranteed'},{compatibility_evidence:['supplied','unconfirmed']},{manufacturer:'wrong-key'}];
    for(const input of inputs){const parsed=StorefrontDiscoveryQuerySchema.safeParse(input);const value=parsed.success?parsed.data:{page:1,limit:20,sort:'display_order',...input};assert.equal(owned.psql(`SELECT public.storefront_discovery_shape_v1(${j(value)},'$query');`),parsed.success?'t':'f',JSON.stringify(input));}
    assert.deepEqual(flat({electronics:facts}).compatibility_evidence,['supplied']);
    for(const metadata of [{electronics:{}},{electronics:{fact_sheet:{reference:'Synthetic',source_date:'2026-10-24'}}},{electronics:{connectors:[{kind:'usb-c',role:'host',count:1}]}}])assert.deepEqual(flat(metadata).compatibility_evidence,['unconfirmed']);
    for(const metadata of [{},{electronics:{...facts,compatible_devices:[{...device,source_date:'2026-02-30'}]}},{electronics:{...facts,compatible_devices:[{...device,model:'all devices'}]}}])assert.equal(flat(metadata).compatibility_evidence,undefined);
    assert.equal(ElectronicsFactsSchema.safeParse(facts).success,true);
    for(const change of changes)for(const role of ['anon','authenticated','app_tenant','authenticator'])assert.equal(owned.psql(`SELECT has_function_privilege(${q(role)},${q(change.signature)},'EXECUTE');`),'f');
    const deny=owned.psqlExpectError(`SET ROLE app_tenant;SELECT public.browse_storefront_products_v1(${q(a.siteId)},${j(StorefrontDiscoveryQuerySchema.parse({compatibility_evidence:'supplied'}))});`);assert.match(deny,/permission denied/);proof('roles-denied',{error:deny});
  });
  await stage('4 genuine own/foreign collection controls and actual Worker routes', async () => {
    assert.deepEqual(browse({collection_id:ids.aCollection,compatibility_evidence:'supplied'}).data.map(row=>row.id),[ids.hub]);
    assert.deepEqual(browse({collection_id:ids.bCollection,compatibility_evidence:'supplied'},b).data.map(row=>row.id),[ids.foreign]);
    assert.equal(browse({collection_id:ids.bCollection,compatibility_evidence:'supplied'}).count,0);
    proxy=await startOwnedPooledSqlProxy(owned);gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys(),{...proxy.env(),REQUEST_LOG_SAMPLE_RATE:'1'}));
    tap=tapRest(owned.restUrl,async(call,forward)=>outage&&call.resource==='rpc/browse_storefront_products_v1'?Response.json({message:'PRIVATE-FACET-FAULT',code:'XXFAC'},{status:500}):forward());
    for(const uuidRoute of [false,true]){const result=await http(a,{electronics_manufacturer:'Synthetic Lab',compatibility_evidence:'supplied',search:'Facet H1',collection_id:ids.aCollection},uuidRoute);assert.equal(result.status,200,result.text);assert.deepEqual(result.json?.data.map((row:{id:string})=>row.id),[ids.hub]);assert.equal(result.json?.meta.total,1);StorefrontDiscoveryMetadataSchema.parse(result.json?.discovery);}
    const denied=await http(a,{collection_id:ids.bCollection,compatibility_evidence:'supplied'});assert.equal(denied.status,200);assert.deepEqual(denied.json?.data,[]);assert.equal(denied.json?.meta.total,0);
  });
  await stage('5 same candidate price/stock/UUID, model search and all existing theme predicates', () => {
    const yes=browse({electronics_manufacturer:'synthetic variant lab',compatibility_evidence:'supplied',color:'Graphite',min_price:1800,max_price:2000,connector:['hdmi','usb-c'],power_output_w:45});
    assert.deepEqual(yes.discovery.matches,[{product_id:ids.variant,price:1900,variant_ids:[variants.Graphite]}]);assert.equal(yes.data[0].price,2000);
    for(const query of [{color:'Silver'},{max_price:1000},{power_output_w:65}])assert.equal(browse({electronics_manufacturer:'Synthetic Variant Lab',compatibility_evidence:'supplied',...query}).count,0);
    assert.equal(browse({electronics_manufacturer:'Synthetic Devices',compatibility_evidence:'supplied'},a,[ids.hub]).count,0);
    assert.deepEqual(browse({search:'Facet H1',compatibility_evidence:'supplied'},a,[ids.hub]).data.map(row=>row.id),[ids.hub]);
    for(const[index,query]of legacyQueries.entries()){const after=browse(query,a,[ids.legacy]),before=legacyBefore[index];assert.equal(before.count,1,JSON.stringify(query));assert.deepEqual(after.data,before.data);assert.deepEqual(after.discovery.matches,before.discovery.matches);assert.equal(after.count,before.count);assert.deepEqual(after.discovery.facets.filter(f=>!['electronics_manufacturer','compatibility_evidence'].includes(f.key)),before.discovery.facets);assert.deepEqual(after.discovery.measurement_capabilities,before.discovery.measurement_capabilities);}
  });
  await stage('6 truthful product counts, cap/pagination and native Unicode normalization', () => {
    const pages=[1,2,3].map(page=>browse({search:'Maker',compatibility_evidence:'unconfirmed',limit:20,page,sort:'price-asc'}));
    assert.deepEqual(pages.map(page=>page.data.length),[20,20,2]);assert.equal(pages.every(page=>page.count===42),true);assert.deepEqual(pages.flatMap(page=>page.data.map(row=>row.id)),[...makers].sort());
    assert.equal(pages[0].discovery.facets.filter(f=>f.key==='electronics_manufacturer').length,40);
    assert.equal(browse({compatibility_evidence:'supplied'},a,[ids.variant]).count,1);
    for(const [index,[manufacturer,expected]] of manufacturerCases.entries()) {
      const value=z.array(z.string()).parse(flat({electronics:{manufacturer}}).electronics_manufacturer)[0];
      const normalized=owned.psql(`SELECT lower(public.storefront_discovery_trim_v1(${q(value)}));`);
      assert.equal(normalized,expected,'Pinned native simple-case contract');
      assert.equal(normalizeStorefrontManufacturerKey(manufacturer),expected,'Actual public frontend key matches native contract');
      const result=browse({electronics_manufacturer:manufacturer},a,[ids['unicode-'+index]]);
      assert.deepEqual(result.data.map(row=>row.id),[ids['unicode-'+index]]);
      const facet=result.discovery.facets.find(f=>f.key==='electronics_manufacturer');
      assert.equal(facet?.value,expected);assert.equal(facet?.label,manufacturer);
      assert.equal(normalizeStorefrontManufacturerKey(manufacturer),normalizeStorefrontManufacturerKey(facet!.value));
      proof('native-normalization',{manufacturer,value,normalized,frontendKey:normalizeStorefrontManufacturerKey(manufacturer),matchedId:result.data[0].id,facet});
    }
  });
  await stage('7 poisoned profile refusal, actual outage sanitization and bounded plan witness', async () => {
    for(const change of changes){const before=catalog();try{owned.psql(`ALTER FUNCTION ${change.signature} COST 101;`);const poisoned=catalog();const error=owned.psqlScriptExpectError(down);assert.match(error,/discovery function profile changed/);assert.deepEqual(catalog(),poisoned);proof('profile-refusal',{signature:change.signature,error});}finally{owned.psql(`ALTER FUNCTION ${change.signature} COST 100;`);}assert.deepEqual(catalog(),before);}
    outage=true;try{const failed=await http(a,{search:'Uncached facet fault',compatibility_evidence:'supplied'});assert.equal(failed.status,500);assert.doesNotMatch(failed.text,/PRIVATE-FACET-FAULT|XXFAC/);}finally{outage=false;}
    const query=StorefrontDiscoveryQuerySchema.parse({electronics_manufacturer:'Synthetic Lab',compatibility_evidence:'supplied'});
    const plan=z.array(z.record(z.string(),z.unknown())).parse(parse(`EXPLAIN(ANALYZE,FORMAT JSON) SELECT public.browse_storefront_products_v1(${q(a.siteId)},${j(query)});`));
    const ms=z.number().nonnegative().parse(plan[0]['Execution Time']);assert.ok(ms<1000,`finite fixture budget1000ms, observed${ms}`);proof('bounded-plan',{query,plan,thresholdMs:1000,indexedPredicateAcceptance:'NOT_PROVEN_BY_OUTER_RPC_PLAN',productionScaleProof:false});
  });
  await stage('8 attributed HTTP telemetry, paired DOWN/replay and all-public-table conservation', async () => {
    await gateway?.settle();
    const before=tableHashes();
    const families=z.array(z.object({base:z.string(),parent:z.string(),leaves:z.array(z.string()).min(1)})).length(2).parse(parse(`SELECT jsonb_agg(jsonb_build_object('base',v.base,'parent',v.parent,'leaves',(SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_partition_tree(('public.'||v.parent)::regclass) t JOIN pg_class c ON c.oid=t.relid WHERE t.isleaf))) FROM (VALUES ('worker_request_logs','worker_request_logs_partitioned'),('runtime_telemetry_metrics','runtime_telemetry_metrics_partitioned')) v(base,parent);`));
    const operational=new Set(families.flatMap(f=>[f.base,f.parent,...f.leaves]));
    assert.equal(observedHttp.length,4);
    for(const table of Object.keys(before)) if(!operational.has(table))assert.equal(before[table],baselineRows[table],'Unexpected business/unclassified table change: '+table);
    for(const family of families){
      assert.equal(family.parent,family.base+'_partitioned');
      for(const leaf of family.leaves)assert(new RegExp('^'+family.parent+'_(?:\\d{4}_\\d{2}|default)$').test(leaf));
      const rows=(table:string)=>z.array(z.record(z.string(),z.unknown())).parse(parse(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id),'[]') FROM public.${ident(table)} x;`));
      const baseRows=rows(family.base);proof('raw-operational-attribution-before-assertions',{family,requests:observedHttp,rows:baseRows});
      assert.equal(baseRows.length,observedHttp.length+(family.base==='runtime_telemetry_metrics'?observedHttp.filter(r=>r.status>=500).length:0));
      assert.equal(baselineRows[family.base],sha('[]'),'No pre-existing operational rows may be discarded');
      assert.deepEqual(rows(family.parent),baseRows);
      assert.deepEqual(family.leaves.flatMap(rows).sort((x,y)=>String(x.id).localeCompare(String(y.id))),[...baseRows].sort((x,y)=>String(x.id).localeCompare(String(y.id))));
      for(const request of observedHttp){
        const matches=baseRows.filter(row=>row.request_id===request.requestId);assert.equal(matches.length,family.base==='runtime_telemetry_metrics'&&request.status>=500?2:1);const row=matches.find(r=>family.base==='worker_request_logs'||r.metric_name==='letbuyy.runtime.request');assert(row);
        assert.equal(row.trace_id,request.traceId);assert.equal(row.site_id,null);assert.equal(row.deleted_at,null);assert.equal(row.created_by,null);assert.equal(row.updated_by,null);
        if(family.base==='worker_request_logs'){
          assert.equal(row.route,request.route);assert.equal(row.path,request.route);assert.equal(row.method,'GET');assert.equal(row.status_code,request.status);assert.equal(row.user_id,null);assert.equal(row.auth_source,null);
          assert.deepEqual(row.metadata,{country:null,colo:null,request_log_sample_reason:request.status>=400?'error':'sampled-storefront',request_log_sample_rate:1});
        }else{
          assert.equal(row.metric_name,'letbuyy.runtime.request');assert.equal(row.metric_value,1);assert.equal(row.correlation_id,request.requestId);assert.equal(row.runtime_name,'api-gateway');
          const dimensions=z.record(z.string(),z.unknown()).parse(row.dimensions);const latency=z.number().int().nonnegative().parse(dimensions.latency_ms);
          assert.deepEqual(dimensions,{route:request.route,method:'GET',status_code:request.status,status_class:Math.floor(request.status/100)+'xx',latency_ms:latency,server_error_count:request.status>=500?1:0,client_error_count:request.status>=400&&request.status<500?1:0,success_count:request.status<400?1:0,auth_source:null,country:null,colo:null});
          if(request.status>=500){
            const alert=matches.find(r=>r.metric_name==='letbuyy.alert.runtime.error');assert(alert);assert.equal(alert.request_id,request.requestId);assert.equal(alert.trace_id,request.traceId);assert.equal(alert.correlation_id,request.requestId);assert.equal(alert.metric_value,1);assert.equal(alert.unit,'count');assert.equal(alert.runtime_name,'api-gateway');assert.equal(alert.site_id,null);assert.equal(alert.created_by,null);assert.equal(alert.updated_by,null);assert.equal(alert.deleted_at,null);
            assert.deepEqual(alert.dimensions,{source:'api-gateway.observability',route:request.route,method:'GET',status_code:request.status,severity:'sev3',error_code:request.errorCode,auth_source:null,country:null,colo:null,deployment_env:gateway!.env.DEPLOYMENT_ENV||gateway!.env.ENVIRONMENT,telemetry_env:gateway!.env.TELEMETRY_ENV||gateway!.env.ENVIRONMENT});
          }
        }
      }
      proof('actual-public-http-operational-attribution',{family,requests:observedHttp,rows:baseRows});
    }
    // Every table, including all attributed log/metric mirrors, is immutable
    // across both SQL directions. HTTP effects are not migration effects.
    owned.script(down);expectBodies('beforeMd5');assert.deepEqual(catalog(),baselineCatalog);assert.deepEqual(tableHashes(),before);
    owned.script(up);expectBodies('afterMd5');assert.deepEqual(withoutChangedBodies(catalog()),withoutChangedBodies(baselineCatalog));assert.deepEqual(tableHashes(),before);proof('qualification-terminal',{functionalNativeStages:8,nativePassed:true,installedPassed:false,providerPassed:false,indexedPredicateAcceptance:false,allTenCertified:false});
  });
});
