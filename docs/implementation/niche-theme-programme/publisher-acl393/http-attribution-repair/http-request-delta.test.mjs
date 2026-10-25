// Pure synthetic row/hash regressions. No native import, owned handle, request or database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {assertHttpNoDomainEffects}=require('./http-request-delta.ts');

const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const domainTables=['sites','theme_instances','theme_editor_drafts','theme_instance_drafts','theme_draft_patches','theme_draft_mutation_receipts','theme_releases','audit_activity_events','outbox_events','outbox_events_partitioned','outbox_events_partitioned_default','runtime_telemetry_spans','operation_metrics','unrelated_table'];
const families=['worker_request_logs','runtime_telemetry_metrics'].map(base=>({base,parent:base+'_partitioned',leaves:[base+'_partitioned_2026_06',base+'_partitioned_2026_07',base+'_partitioned_default']}));
const timestamp=(month,seconds)=>`2026-${month}-24T05:00:${seconds}Z`;
function log(m,created_at,id){return{id,site_id:m.siteId,request_id:m.requestId,trace_id:m.traceId,method:m.method,path:m.route,route:m.route,status_code:m.status,latency_ms:120,user_id:m.actorId,auth_source:'internal-sso',ip_address:m.ip,user_agent:m.userAgent,error_code:m.errorCode,metadata:{country:null,colo:null,request_log_sample_reason:m.status>=400?'error':'authenticated',request_log_sample_rate:1},created_by:m.actorId,updated_by:m.actorId,created_at,updated_at:created_at,deleted_at:null};}
function metric(m,created_at,id){return{id,metric_name:'letbuyy.runtime.request',metric_value:1,unit:'count',runtime_name:'api-gateway',site_id:m.siteId,dimensions:{route:m.route,method:m.method,status_code:m.status,status_class:Math.floor(m.status/100)+'xx',latency_ms:120,server_error_count:m.status>=500?1:0,client_error_count:m.status>=400&&m.status<500?1:0,success_count:m.status<400?1:0,auth_source:'internal-sso',country:null,colo:null},request_id:m.requestId,correlation_id:m.requestId,trace_id:m.traceId,recorded_at:created_at,created_by:null,updated_by:null,created_at,updated_at:created_at,deleted_at:null};}
function claim(hash,claimed_at,expires_at){return{auth_kind:'identity',jti_hash:hash,claimed_at,expires_at,row_hash:sha({hash,claimed_at,expires_at})};}
function addMirrored(s,f,row){const leaf=f.leaves.find(l=>l.endsWith(row.created_at.slice(0,7).replace('-','_')))||f.parent+'_default';s.rows[f.base].push({physical_table:f.base,row:structuredClone(row)});s.rows[f.parent].push({physical_table:leaf,row:structuredClone(row)});s.rows[leaf].push({physical_table:leaf,row:structuredClone(row)});}
function rehash(s){for(const table of Object.keys(s.rows))s.hashes[table]=sha(s.rows[table]);}
function fixture({status=200,actorId=uuid(1),month='10'}={}){
 const m={requestId:uuid(10),traceId:uuid(11),jtiHash:sha('fresh-jti'),actorId,method:'POST',route:'/v1/themes/:slug/releases/:releaseId/rollback',status,errorCode:null,siteId:null,ip:'2001:db8:feed::5',userAgent:'LetBuyy-ACL393-owned-native'};
 const rows=Object.fromEntries(['internal_auth_replay_claims',...families.flatMap(f=>[f.base,f.parent,...f.leaves])].map(t=>[t,[]]));
 const before={at:timestamp(month,'00.000000'),hashes:Object.fromEntries(domainTables.map(t=>[t,sha({table:t,rows:['unchanged synthetic domain row']})])),rows,families:structuredClone(families)};
 const previous={...m,requestId:uuid(20),traceId:uuid(21),jtiHash:sha('earlier-jti')};
 before.rows.internal_auth_replay_claims.push(claim(previous.jtiHash,`2026-${month}-24T04:59:00.000000Z`,`2026-${month}-24T05:04:00.000000Z`));
 for(const f of families)addMirrored(before,f,f.base==='worker_request_logs'?log(previous,`2026-${month}-24T04:59:00.100000Z`,uuid(30)):metric(previous,`2026-${month}-24T04:59:00.200000Z`,uuid(31)));
 rehash(before);const after=structuredClone(before);after.at=timestamp(month,'02.000000');
 after.rows.internal_auth_replay_claims.push(claim(m.jtiHash,timestamp(month,'00.500000'),`2026-${month}-24T05:05:00.500000Z`));
 for(const f of families)addMirrored(after,f,f.base==='worker_request_logs'?log(m,timestamp(month,'00.750000'),uuid(40)):metric(m,timestamp(month,'00.850000'),uuid(41)));
 rehash(after);return{before,after,m};
}
function rejected(edit,options){const f=fixture(options);edit(f);rehash(f.after);assert.throws(()=>assertHttpNoDomainEffects(f.before,f.after,f.m),{code:'ERR_ASSERTION'});}
function editNew(f,base,edit){for(const table of [base,base+'_partitioned',...f.after.families.find(x=>x.base===base).leaves])for(const wrapper of f.after.rows[table])if(wrapper.row.request_id===f.m.requestId)edit(wrapper.row);}

test('one known request claim/log/metric passes with exact default or monthly partition copies, including409/403',()=>{
 for(const options of [{},{status:409},{status:403,actorId:uuid(2)},{month:'06'}]){const f=fixture(options),r=assertHttpNoDomainEffects(f.before,f.after,f.m);assert.equal(r.allTableHashesRetained,Object.keys(f.before.hashes).length);assert.equal(r.auth.inserted,1);assert.equal(r.requestLogRows,1);assert.equal(r.requestMetricRows,1);assert.equal(r.partitionCopiesExact,true);}
});
test('commerce/site/draft/audit/outbox and every unclassified table mutation fails',()=>{
 for(const table of domainTables)rejected(f=>{f.after.hashes[table]=sha('unexpected mutation: '+table);});
});
test('an unrelated request/actor/route/status/IP/auth-source or extra request count is never exempted',()=>{
 for(const [field,value] of [['request_id',uuid(99)],['trace_id',uuid(99)],['user_id',uuid(99)],['created_by',uuid(99)],['route','/v1/unrelated'],['path','/v1/unrelated'],['method','GET'],['status_code',201],['ip_address','2001:db8::99'],['auth_source','customer'],['site_id',uuid(99)],['user_agent','another-client'],['error_code','UNRELATED']])rejected(f=>editNew(f,'worker_request_logs',row=>{row[field]=value;}));
 rejected(f=>addMirrored(f.after,f.after.families[0],log({...f.m,requestId:uuid(90)},timestamp('10','01.000000'),uuid(91))));
});
test('an unrelated/extra metric, altered dimensions, count/value, or actor binding fails',()=>{
 for(const [field,value] of [['metric_name','unrelated.metric'],['metric_value',2],['request_id',uuid(99)],['correlation_id',uuid(99)],['trace_id',uuid(99)],['unit','milliseconds'],['runtime_name','other-runtime'],['site_id',uuid(99)],['created_by',uuid(99)]])rejected(f=>editNew(f,'runtime_telemetry_metrics',row=>{row[field]=value;}));
 for(const [field,value] of [['route','/unrelated'],['method','GET'],['status_code',201],['status_class','5xx'],['latency_ms',121],['server_error_count',1],['client_error_count',1],['success_count',0],['auth_source','customer'],['country','IN'],['colo','unexpected']])rejected(f=>editNew(f,'runtime_telemetry_metrics',row=>{row.dimensions[field]=value;}));
 rejected(f=>addMirrored(f.after,f.after.families[1],metric({...f.m,requestId:uuid(90)},timestamp('10','01.000000'),uuid(91))));
});
test('existing operational rows cannot change or disappear even when the new request is valid',()=>{
 for(const base of ['worker_request_logs','runtime_telemetry_metrics']){
  rejected(f=>{for(const table of [base,base+'_partitioned',base+'_partitioned_default'])f.after.rows[table][0].row.deleted_at=timestamp('10','01.000000');});
  rejected(f=>{for(const table of [base,base+'_partitioned',base+'_partitioned_default'])f.after.rows[table].shift();});
 }
 rejected(f=>{f.after.rows.internal_auth_replay_claims[0].row_hash=sha('changed earlier auth claim');});
 rejected(f=>{f.after.rows.internal_auth_replay_claims.shift();});
});
test('claim hash/type/count/TTL/time and bounded request timestamps are enforced',()=>{
 for(const [field,value] of [['jti_hash',sha('unrelated')],['auth_kind','session'],['row_hash','invalid'],['expires_at','2026-10-24T05:05:01.500000Z'],['claimed_at','2026-10-24T04:59:59.500000Z']])rejected(f=>{f.after.rows.internal_auth_replay_claims.at(-1)[field]=value;});
 rejected(f=>f.after.rows.internal_auth_replay_claims.push(claim(sha('extra'),'2026-10-24T05:00:00.500000Z','2026-10-24T05:05:00.500000Z')));
 for(const base of ['worker_request_logs','runtime_telemetry_metrics']){
  rejected(f=>editNew(f,base,row=>{row.created_at='2026-10-24T05:00:03.000000Z';row.updated_at=row.created_at;if(base==='runtime_telemetry_metrics')row.recorded_at=row.created_at;}));
  rejected(f=>editNew(f,base,row=>{row.updated_at='2026-10-24T05:00:00.999999Z';}));
 }
 rejected(f=>{editNew(f,'worker_request_logs',row=>{row.latency_ms=4000;});editNew(f,'runtime_telemetry_metrics',row=>{row.dimensions.latency_ms=4000;});});
});
test('real mirror topology, physical aliases and untouched leaf hashes are mandatory',()=>{
 rejected(f=>{f.after.families[0].leaves.push('worker_request_logs_partitioned_unrelated');});
 rejected(f=>{f.after.rows.worker_request_logs_partitioned_default.pop();});
 rejected(f=>{f.after.rows.worker_request_logs_partitioned.at(-1).physical_table='worker_request_logs_partitioned_2026_06';});
 rejected(f=>{f.after.rows.worker_request_logs_partitioned_default.at(-1).row.route='/unrelated';});
 const f=fixture();f.after.hashes.worker_request_logs_partitioned_2026_06=sha('unrelated partition mutation');assert.throws(()=>assertHttpNoDomainEffects(f.before,f.after,f.m),{code:'ERR_ASSERTION'});
});
test('complete table hashes and all operational rows are required; no unknown-family allowance',()=>{
 rejected(f=>{delete f.after.hashes.sites;});
 rejected(f=>{delete f.after.rows.worker_request_logs;});
 rejected(f=>{f.before.families[0].base='outbox_events';f.after.families[0].base='outbox_events';});
 const f=fixture();for(const s of [f.before,f.after])delete s.hashes.worker_request_logs_partitioned_2026_06;assert.throws(()=>assertHttpNoDomainEffects(f.before,f.after,f.m),{code:'ERR_ASSERTION'});
});
test('canonical auth cleanup admits exactly the oldest up-to100 expired rows and preserves active claims',()=>{
 function expiredFixture(){const f=fixture();for(let i=0;i<105;i++)f.before.rows.internal_auth_replay_claims.push(claim(sha('expired'+i),'2026-10-24T04:50:00.000000Z',`2026-10-24T04:59:00.${String(i).padStart(6,'0')}Z`));f.after.rows.internal_auth_replay_claims=[f.before.rows.internal_auth_replay_claims[0],...f.before.rows.internal_auth_replay_claims.slice(101),f.after.rows.internal_auth_replay_claims.at(-1)];rehash(f.before);rehash(f.after);return f;}
 const valid=expiredFixture();assert.equal(assertHttpNoDomainEffects(valid.before,valid.after,valid.m).auth.expiredRemoved,100);
 for(const edit of [f=>f.after.rows.internal_auth_replay_claims.splice(1,1),f=>f.after.rows.internal_auth_replay_claims.push(f.before.rows.internal_auth_replay_claims[1]),f=>{f.after.rows.internal_auth_replay_claims[1]=f.before.rows.internal_auth_replay_claims[1];},f=>f.after.rows.internal_auth_replay_claims.shift()]){const f=expiredFixture();edit(f);rehash(f.after);assert.throws(()=>assertHttpNoDomainEffects(f.before,f.after,f.m),{code:'ERR_ASSERTION'});}
});
