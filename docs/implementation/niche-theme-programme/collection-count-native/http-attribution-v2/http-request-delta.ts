// Version2 test-only attribution: exact existing request records plus one canonical alert ONLY for expected503.
// Qualified beafe publisher helper stays unchanged. No database/request/production writer or permissive fallback.
import assert from 'node:assert/strict';
export interface HttpExpectation {requestId:string;traceId:string;jtiHash:string;actorId:string;method:string;route:string;status:number;errorCode:string|null;siteId:string|null;ip:string;userAgent:string}
export interface HttpFamily {base:string;parent:string;leaves:string[]}
export interface HttpSnapshot {at:string;hashes:Record<string,string>;rows:Record<string,unknown[]>;families:HttpFamily[]}
const object=(v:unknown):Record<string,unknown>=>{assert(v!==null&&typeof v==='object'&&!Array.isArray(v));return v as Record<string,unknown>;};
function instant(v:unknown):bigint{assert.equal(typeof v,'string');const m=String(v).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);assert(m,'timestamp must retain microsecond precision');const seconds=Date.parse(m[1]+m[3]);assert(Number.isFinite(seconds));return BigInt(seconds)*1000n+BigInt((m[2]||'').padEnd(6,'0'));}
function keys(v:Record<string,unknown>,expected:string[]){assert.deepEqual(Object.keys(v).sort(),[...expected].sort(),'Unexpected row fields');}
function appendOnly(before:unknown[],after:unknown[],key:(row:Record<string,unknown>)=>string){const prior=new Map<string,Record<string,unknown>>();for(const v of before){const row=object(v),k=key(row);assert(!prior.has(k));prior.set(k,row);}const seen=new Set<string>(),added:Record<string,unknown>[]=[];for(const v of after){const row=object(v),k=key(row);assert(!seen.has(k));seen.add(k);const old=prior.get(k);if(old)assert.deepEqual(row,old,'Existing request row changed');else added.push(row);}for(const k of prior.keys())assert(seen.has(k),'Existing request row deleted');return added;}
function within(v:unknown,before:HttpSnapshot,after:HttpSnapshot){const value=instant(v);assert(value>=instant(before.at)&&value<=instant(after.at),'Request row outside bounded request window');}
function physicalRows(s:HttpSnapshot,table:string){const rows=s.rows[table];assert(Array.isArray(rows),'Complete operational rows required: '+table);return rows.map(object);}
function recordRows(s:HttpSnapshot,table:string){return physicalRows(s,table).map(v=>object(v.row));}
const recordKey=(v:Record<string,unknown>)=>String(object(v.row).id)+'|'+String(object(v.row).created_at);
function sortedRows(rows:Record<string,unknown>[]){return rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)));}
function checkFamily(f:HttpFamily,s:HttpSnapshot){
 assert(['worker_request_logs','runtime_telemetry_metrics'].includes(f.base));assert.equal(f.parent,f.base+'_partitioned');assert(f.leaves.length>0);assert.equal(new Set(f.leaves).size,f.leaves.length);
 for(const leaf of f.leaves)assert(new RegExp('^'+f.parent+'_(?:\\d{4}_\\d{2}|default)$').test(leaf));
 for(const table of [f.base,f.parent,...f.leaves])for(const row of physicalRows(s,table)){
  keys(row,['physical_table','row']);const physical=row.physical_table;assert(typeof physical==='string');
  assert(table===f.base?physical===f.base:table===f.parent?f.leaves.includes(physical):physical===table,'Incorrect physical table attribution');
 }
 assert.deepEqual(sortedRows(recordRows(s,f.base)),sortedRows(recordRows(s,f.parent)),'Mirror parent differs from base');assert.deepEqual(sortedRows(f.leaves.flatMap(l=>recordRows(s,l))),sortedRows(recordRows(s,f.parent)),'Physical leaf union differs from parent');
}
function expectedLeaf(f:HttpFamily,row:Record<string,unknown>){const utc=new Date(Number(instant(row.created_at)/1000n)).toISOString();const monthly=f.parent+'_'+utc.slice(0,4)+'_'+utc.slice(5,7);const leaf=f.leaves.includes(monthly)?monthly:f.parent+'_default';assert(f.leaves.includes(leaf),'Actual partition missing');return leaf;}
function logRow(row:Record<string,unknown>,m:HttpExpectation,before:HttpSnapshot,after:HttpSnapshot){
 keys(row,['id','site_id','request_id','trace_id','method','path','route','status_code','latency_ms','user_id','auth_source','ip_address','user_agent','error_code','metadata','created_by','updated_by','created_at','updated_at','deleted_at']);assert.match(String(row.id),/^[a-f0-9-]{36}$/);
 for(const[k,v]of Object.entries({site_id:m.siteId,request_id:m.requestId,trace_id:m.traceId,method:m.method,path:m.route,route:m.route,status_code:m.status,user_id:m.actorId,auth_source:'internal-sso',ip_address:m.ip,user_agent:m.userAgent,error_code:m.errorCode,created_by:m.actorId,updated_by:m.actorId,deleted_at:null}))assert.deepEqual(row[k],v,'Unattributed request log '+k);
 assert(typeof row.latency_ms==='number'&&Number.isSafeInteger(row.latency_ms)&&row.latency_ms>=0);assert(BigInt(row.latency_ms)*1000n<=instant(after.at)-instant(before.at)+1_000_000n,'Unbounded latency');within(row.created_at,before,after);assert.equal(instant(row.updated_at),instant(row.created_at));assert.deepEqual(row.metadata,{country:null,colo:null,request_log_sample_reason:m.status>=400?'error':'authenticated',request_log_sample_rate:1});return row.latency_ms;
}
function metricRow(row:Record<string,unknown>,m:HttpExpectation,latency:number,before:HttpSnapshot,after:HttpSnapshot){
 keys(row,['id','metric_name','metric_value','unit','runtime_name','site_id','dimensions','request_id','correlation_id','trace_id','recorded_at','created_by','updated_by','created_at','updated_at','deleted_at']);assert.match(String(row.id),/^[a-f0-9-]{36}$/);
 for(const[k,v]of Object.entries({metric_name:'letbuyy.runtime.request',metric_value:1,unit:'count',runtime_name:'api-gateway',site_id:m.siteId,request_id:m.requestId,correlation_id:m.requestId,trace_id:m.traceId,created_by:null,updated_by:null,deleted_at:null}))assert.deepEqual(row[k],v,'Unattributed metric '+k);
 assert.deepEqual(row.dimensions,{route:m.route,method:m.method,status_code:m.status,status_class:Math.floor(m.status/100)+'xx',latency_ms:latency,server_error_count:m.status>=500?1:0,client_error_count:m.status>=400&&m.status<500?1:0,success_count:m.status<400?1:0,auth_source:'internal-sso',country:null,colo:null});within(row.created_at,before,after);assert.equal(instant(row.updated_at),instant(row.created_at));assert.equal(instant(row.recorded_at),instant(row.created_at));
}
function serverAlertMetricRow(row:Record<string,unknown>,m:HttpExpectation,before:HttpSnapshot,after:HttpSnapshot){
 assert.equal(m.status,503,'Server alert allowance is restricted to an explicitly expected503');
 keys(row,['id','metric_name','metric_value','unit','runtime_name','site_id','dimensions','request_id','correlation_id','trace_id','recorded_at','created_by','updated_by','created_at','updated_at','deleted_at']);
 assert.match(String(row.id),/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
 for(const[k,v]of Object.entries({metric_name:'letbuyy.alert.runtime.error',metric_value:1,unit:'count',runtime_name:'api-gateway',site_id:m.siteId,request_id:m.requestId,correlation_id:m.requestId,trace_id:m.traceId,created_by:null,updated_by:null,deleted_at:null}))assert.deepEqual(row[k],v,'Unattributed server alert '+k);
 // Literal profile from canonical runtime-alerting.ts for the owned gateway test environment and expected503/sev2.
 assert.deepEqual(row.dimensions,{source:'api-gateway.observability',route:m.route,method:m.method,status_code:503,severity:'sev2',error_code:m.errorCode,auth_source:'internal-sso',country:null,colo:null,deployment_env:'test',telemetry_env:'test'});
 within(row.created_at,before,after);assert.equal(instant(row.updated_at),instant(row.created_at));assert.equal(instant(row.recorded_at),instant(row.created_at));
}
function authDelta(before:HttpSnapshot,after:HttpSnapshot,m:HttpExpectation){
 const old=before.rows.internal_auth_replay_claims.map(object),now=after.rows.internal_auth_replay_claims.map(object);const key=(r:Record<string,unknown>)=>String(r.auth_kind)+'|'+String(r.jti_hash);const prior=new Map(old.map(r=>[key(r),r])),next=new Map(now.map(r=>[key(r),r]));assert.equal(prior.size,old.length);assert.equal(next.size,now.length);const added=now.filter(r=>!prior.has(key(r)));assert.equal(added.length,1,'Exactly one fresh auth replay claim is required');const claim=added[0];keys(claim,['auth_kind','jti_hash','claimed_at','expires_at','row_hash']);assert.equal(claim.auth_kind,'identity');assert.equal(claim.jti_hash,m.jtiHash);assert.match(String(claim.row_hash),/^[a-f0-9]{64}$/);within(claim.claimed_at,before,after);assert.equal(instant(claim.expires_at)-instant(claim.claimed_at),300_000_000n,'Canonical identity claim TTL');
 for(const row of now){const previous=prior.get(key(row));if(previous)assert.deepEqual(row,previous,'Existing auth replay claim changed');}
 const removed=old.filter(r=>!next.has(key(r))),expired=old.filter(r=>instant(r.expires_at)<=instant(claim.claimed_at));assert.equal(removed.length,Math.min(100,expired.length),'Canonical bounded expired-claim cleanup count');for(const row of removed)assert(instant(row.expires_at)<=instant(claim.claimed_at),'Active/unrelated auth claim deleted');if(removed.length){const max=removed.reduce((a,b)=>instant(a.expires_at)>instant(b.expires_at)?a:b);for(const row of expired.filter(r=>next.has(key(r))))assert(instant(row.expires_at)>=instant(max.expires_at),'Expired cleanup did not remove earliest eligible claims');}
 return{inserted:1,expiredRemoved:removed.length,jtiHash:m.jtiHash};
}
export function assertHttpNoDomainEffects(before:HttpSnapshot,after:HttpSnapshot,m:HttpExpectation){
 assert(instant(after.at)>=instant(before.at));assert.deepEqual(Object.keys(before.hashes).sort(),Object.keys(after.hashes).sort(),'Complete all-table hash keys must remain');assert.deepEqual(after.families,before.families,'Partition topology changed');assert.equal(before.families.length,2);assert.deepEqual(before.families.map(f=>f.base).sort(),['runtime_telemetry_metrics','worker_request_logs']);
 const allowed=new Set(['internal_auth_replay_claims',...before.families.flatMap(f=>[f.base,f.parent,...f.leaves])]);assert.deepEqual(Object.keys(before.rows).sort(),[...allowed].sort());assert.deepEqual(Object.keys(after.rows).sort(),[...allowed].sort());
 for(const table of allowed)assert(Object.hasOwn(before.hashes,table),'Operational table missing from complete hashes: '+table);
 for(const table of Object.keys(before.hashes)){assert.match(before.hashes[table],/^[a-f0-9]{64}$/);assert.match(after.hashes[table],/^[a-f0-9]{64}$/);if(!allowed.has(table))assert.equal(after.hashes[table],before.hashes[table],'Unexpected domain/unclassified table change: '+table);}
 const auth=authDelta(before,after,m);assert.notEqual(before.hashes.internal_auth_replay_claims,after.hashes.internal_auth_replay_claims);
 const baseNew=new Map<string,Record<string,unknown>[]>();
 for(const f of before.families){
  checkFamily(f,before);checkFamily(f,after);
  const added=appendOnly(physicalRows(before,f.base),physicalRows(after,f.base),recordKey);
  const expectedCount=f.base==='runtime_telemetry_metrics'&&m.status===503?2:1;
  assert.equal(added.length,expectedCount,'Exact attributed request base row count required');
  for(const wrapper of added)assert.equal(wrapper.physical_table,f.base);
  baseNew.set(f.base,added.map(wrapper=>object(wrapper.row)));assert.notEqual(before.hashes[f.base],after.hashes[f.base]);
  // Each added row is bound to its exact parent/UTC leaf. Do not assume two metrics cannot cross a month boundary.
  for(const table of [f.parent,...f.leaves]){
   const expected=added.filter(wrapper=>table===f.parent||expectedLeaf(f,object(wrapper.row))===table);
   const delta=appendOnly(physicalRows(before,table),physicalRows(after,table),recordKey);
   assert.equal(delta.length,expected.length,'Unexpected request partition delta: '+table);
   const expectedByKey=new Map(expected.map(wrapper=>[recordKey(wrapper),wrapper]));
   for(const wrapper of delta){const original=expectedByKey.get(recordKey(wrapper));assert(original,'Unbound partition record');assert.deepEqual(wrapper.row,original.row);assert.equal(wrapper.physical_table,expectedLeaf(f,object(original.row)));}
   if(expected.length)assert.notEqual(before.hashes[table],after.hashes[table]);else assert.equal(before.hashes[table],after.hashes[table],'Unexpected non-target partition hash change');
  }
 }
 const logs=baseNew.get('worker_request_logs')!;assert.equal(logs.length,1);const latency=logRow(logs[0],m,before,after);
 const metrics=baseNew.get('runtime_telemetry_metrics')!,requests=metrics.filter(row=>row.metric_name==='letbuyy.runtime.request'),alerts=metrics.filter(row=>row.metric_name==='letbuyy.alert.runtime.error');
 assert.equal(requests.length,1,'Exactly one canonical request metric required');assert.equal(alerts.length,m.status===503?1:0,'Only expected503 has exactly one canonical server alert');assert.equal(requests.length+alerts.length,metrics.length,'Unrelated metric is forbidden');
 metricRow(requests[0],m,latency,before,after);if(m.status===503)serverAlertMetricRow(alerts[0],m,before,after);
 return{allTableHashesRetained:Object.keys(before.hashes).length,domainAndAllUnclassifiedHashesExact:true,auth,requestLogRows:1,requestMetricRows:1,...(m.status===503?{serverAlertMetricRows:1}:{}),latencyMs:latency,requestId:m.requestId,traceId:m.traceId,actorId:m.actorId,route:m.route,status:m.status,partitionCopiesExact:true};
}
