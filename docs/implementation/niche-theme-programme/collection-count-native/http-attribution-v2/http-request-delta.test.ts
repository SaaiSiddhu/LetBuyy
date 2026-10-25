// Pure replay of preserved actual native01 observations; no DB, Gateway, browser or infrastructure import.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertHttpNoDomainEffects,type HttpSnapshot,type HttpExpectation} from './http-request-delta';
import {assertHttpNoDomainEffects as qualifiedBeafe} from '../../publisher-acl393/http-attribution-repair/http-request-delta';
type RecordValue=Record<string,unknown>;
type Observation={before:HttpSnapshot;after:HttpSnapshot;expected:HttpExpectation};
const fixtureDigests={
 'native01-http-200-a.json':'ae63f381e33886501b50f1d0e1148eabbce2de47441402c23f9a5de9107c6e53',
 'native01-http-200-b.json':'44f6f162ddca9749dc2adaa4dcfb95384d58e314aa09bf0d28639ff984f3a385',
 'native01-http-403.json':'881b34d8cd365dd92fcf8850a88ba2664b564cab627f72382b0ea0a68424ea0c',
 'native01-http-503.json':'b5e3980675bb0d134cbffbb7ba600b8955ee5ce650d5041b4f990fb116e132b6',
};
function fixture(name:keyof typeof fixtureDigests='native01-http-503.json'):Observation{
 const bytes=readFileSync(new URL('../http-alert-repair/fixtures/'+name,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),fixtureDigests[name]);
 const value=JSON.parse(bytes.toString())as{runId:string;value:Observation};assert.equal(value.runId,'999176baae6b');return structuredClone(value.value);
}
const object=(v:unknown):RecordValue=>{assert(v!==null&&typeof v==='object'&&!Array.isArray(v));return v as RecordValue;};
const row=(v:unknown)=>object(object(v).row);
function family(s:HttpSnapshot,base:string){const f=s.families.find(f=>f.base===base);assert(f);return f;}
function everyMirror(s:HttpSnapshot,base:string,change:(r:RecordValue)=>void,predicate:(r:RecordValue)=>boolean){const f=family(s,base);for(const table of[f.base,f.parent,...f.leaves])for(const wrapper of s.rows[table]){const r=row(wrapper);if(predicate(r))change(r);}}
const alert=(r:RecordValue)=>r.metric_name==='letbuyy.alert.runtime.error';
function alertChange(o:Observation,change:(r:RecordValue)=>void){everyMirror(o.after,'runtime_telemetry_metrics',change,alert);}
function removeAlert(o:Observation){const f=family(o.after,'runtime_telemetry_metrics');for(const table of[f.base,f.parent,...f.leaves])o.after.rows[table]=o.after.rows[table].filter(v=>!alert(row(v)));}
function appendMetric(o:Observation,name='letbuyy.alert.runtime.error'){
 const f=family(o.after,'runtime_telemetry_metrics'),wrapper=object(o.after.rows[f.base].find(v=>alert(row(v))));const extra=structuredClone(row(wrapper));extra.id='99999999-9999-4999-8999-999999999999';extra.metric_name=name;
 const physical=object(o.after.rows[f.parent].find(v=>alert(row(v)))).physical_table as string;
 o.after.rows[f.base].push({physical_table:f.base,row:structuredClone(extra)});o.after.rows[f.parent].push({physical_table:physical,row:structuredClone(extra)});o.after.rows[physical].push({physical_table:physical,row:structuredClone(extra)});
}
function rejects(name:string,mutate:(o:Observation)=>void){test(name,()=>{const o=fixture();mutate(o);assert.throws(()=>assertHttpNoDomainEffects(o.before,o.after,o.expected));});}

test('qualified beafe boundary still rejects actual034 with two503 metrics',()=>{const o=fixture();assert.throws(()=>qualifiedBeafe(o.before,o.after,o.expected),/Exactly one attributed request base row is required/);});
test('v2 accepts actual034 with exactly one source-bound503 alert and all487 table hashes retained',()=>{const o=fixture(),r=assertHttpNoDomainEffects(o.before,o.after,o.expected);assert.equal(r.serverAlertMetricRows,1);assert.equal(r.requestLogRows,1);assert.equal(r.requestMetricRows,1);assert.equal(r.allTableHashesRetained,487);assert.equal(r.domainAndAllUnclassifiedHashesExact,true);assert.equal(r.partitionCopiesExact,true);});
for(const name of['native01-http-200-a.json','native01-http-200-b.json','native01-http-403.json']as const)test('unchanged non503 behavior and return shape: '+name,()=>{const o=fixture(name);assert.deepEqual(assertHttpNoDomainEffects(o.before,o.after,o.expected),qualifiedBeafe(o.before,o.after,o.expected));});
rejects('503 requires the canonical alert; it cannot be silently omitted',removeAlert);
rejects('an extra canonical alert is rejected',o=>appendMetric(o));
rejects('an unrelated metric is rejected',o=>appendMetric(o,'letbuyy.unrelated.metric'));
rejects('foreign alert request is rejected',o=>alertChange(o,r=>{r.request_id='foreign-request';}));
rejects('foreign alert trace is rejected',o=>alertChange(o,r=>{r.trace_id='foreign-trace';}));
rejects('foreign alert site is rejected',o=>alertChange(o,r=>{r.site_id='99999999-9999-4999-8999-999999999999';}));
rejects('foreign alert correlation is rejected',o=>alertChange(o,r=>{r.correlation_id='foreign-correlation';}));
rejects('malformed alert value is rejected',o=>alertChange(o,r=>{r.metric_value='1';}));
rejects('malformed alert id is rejected',o=>alertChange(o,r=>{r.id='not-a-uuid';}));
rejects('alert with an extra row field is rejected',o=>alertChange(o,r=>{r.unclassified=true;}));
rejects('alert with an extra dimension is rejected',o=>alertChange(o,r=>{object(r.dimensions).unclassified=true;}));
rejects('wrong alert status is rejected',o=>alertChange(o,r=>{object(r.dimensions).status_code=500;}));
rejects('wrong deployment environment is rejected',o=>alertChange(o,r=>{object(r.dimensions).deployment_env='production';}));
rejects('wrong telemetry environment is rejected',o=>alertChange(o,r=>{object(r.dimensions).telemetry_env='production';}));
rejects('wrong source is rejected',o=>alertChange(o,r=>{object(r.dimensions).source='unrelated.observability';}));
rejects('wrong severity is rejected',o=>alertChange(o,r=>{object(r.dimensions).severity='sev1';}));
rejects('wrong route is rejected',o=>alertChange(o,r=>{object(r.dimensions).route='/v1/foreign';}));
rejects('wrong alert auth source is rejected',o=>alertChange(o,r=>{object(r.dimensions).auth_source='anonymous';}));
rejects('wrong alert error code is rejected',o=>alertChange(o,r=>{object(r.dimensions).error_code='UNRELATED';}));
rejects('alert timestamps must be within this request window',o=>alertChange(o,r=>{r.created_at='2099-01-01T00:00:00Z';r.updated_at=r.created_at;r.recorded_at=r.created_at;}));
rejects('alert recorded timestamp must equal its actual creation timestamp',o=>alertChange(o,r=>{r.recorded_at='2026-10-24T06:21:48.839201+00:00';}));
rejects('non503 does not receive a server-alert exception even with consistent row status502',o=>{
 o.expected.status=502;everyMirror(o.after,'worker_request_logs',r=>{r.status_code=502;},r=>r.request_id===o.expected.requestId);
 everyMirror(o.after,'runtime_telemetry_metrics',r=>{object(r.dimensions).status_code=502;},r=>r.request_id===o.expected.requestId);
});
rejects('altered prior metric rows are rejected',o=>{
 const f=family(o.before,'runtime_telemetry_metrics'),prior=row(o.before.rows[f.base][0]);assert(prior.id);
 everyMirror(o.after,f.base,r=>{r.metric_value=2;},r=>r.id===prior.id);
});
rejects('deleted prior metric rows are rejected',o=>{
 const f=family(o.before,'runtime_telemetry_metrics'),prior=row(o.before.rows[f.base][0]);for(const table of[f.base,f.parent,...f.leaves])o.after.rows[table]=o.after.rows[table].filter(v=>row(v).id!==prior.id);
});
rejects('domain table effects are rejected',o=>{assert(o.after.hashes.collections);o.after.hashes.collections='f'.repeat(64);});
rejects('alert parent mirror omission is rejected',o=>{const f=family(o.after,'runtime_telemetry_metrics');o.after.rows[f.parent]=o.after.rows[f.parent].filter(v=>!alert(row(v)));});
rejects('wrong alert physical leaf is rejected',o=>{const f=family(o.after,'runtime_telemetry_metrics');for(const wrapper of o.after.rows[f.parent])if(alert(row(wrapper)))object(wrapper).physical_table='runtime_telemetry_metrics_partitioned_2099_01';});
rejects('a foreign worker actor cannot be hidden behind a matching alert',o=>everyMirror(o.after,'worker_request_logs',r=>{r.user_id='99999999-9999-4999-8999-999999999999';r.created_by=r.user_id;r.updated_by=r.user_id;},r=>r.request_id===o.expected.requestId));
