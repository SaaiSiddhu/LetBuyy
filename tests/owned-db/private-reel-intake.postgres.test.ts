import { fileURLToPath } from 'node:url';
import {nativeGatewayWasmPlugin,nativeGatewayModules,NATIVE_GATEWAY_MODULE_ROOT} from '../helpers/native-gateway-wasm';
// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Reviewed-source candidate: actual Gateway workerd + native local R2 + owned
// PostgreSQL/PostgREST + ordinary merchant browser. No provider proof/activation.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { createRequire, builtinModules } from 'node:module';
import { Script } from 'node:vm';
import { createServer, type Server } from 'node:http';
import { exportJWK } from 'jose';
import { chromium, expect as playwrightExpect, type Page, type BrowserContext } from '@playwright/test';
import { Miniflare } from 'miniflare';
import { createLetbuyyInternalSessionHeaders } from '@letbuyy/auth-core';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { gatewayEnv, newIdentityKeys, nextClientAddress, INTERNAL_SECRET, type GatewayResponse } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { ReelUploadReadbackSchema } from '@letbuyy/shared-types';
import { OutboxExecutionAdapter } from '../../services/api-gateway/src/execution/outbox-execution.adapter';
const owned = requireOwnedDatabase();
const expect = playwrightExpect.configure({ timeout: 30000 });
const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const json = (value: unknown) => quote(JSON.stringify(value)) + '::jsonb';
const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const original = (size = 4096) => { const bytes = new Uint8Array(size); bytes.set([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0]); return bytes; };
// Explicit synthetic local budgets; no account/business/provider approval claim.
const syntheticProfile = { private_upload_enabled: true, processing_enabled: false, inspection_enabled: false, approved_profile_ref: 'synthetic-owned-intake-only', profile: {
 binding_ref: 'REEL_ORIGINALS_BUCKET', accepted_types: ['video/mp4','video/webm'], max_bytes: 2*1024*1024, max_intents: 100, max_charged_bytes: 32*1024*1024,
 reservation_ttl_seconds: 120, lease_seconds: 8, max_wall_ms: 4000, gateway_ingress_max_bytes: 2*1024*1024, merchant_ingress_max_bytes: 2*1024*1024,
} };
class NativeGateway {
 private constructor(readonly mf: Miniflare, readonly restOrigin: string, readonly tap: { beforeFinish?: () => Promise<void>; loseFinishReply?: boolean }) {}
 static async create(env: Record<string, unknown>) {
  // Reuse the already locked Gateway Wrangler compiler; no added compiler package,
  // downloads, subprocess command, synthetic route, or Node crypto polyfill.
  const gatewayRequire = createRequire(new URL('../../services/api-gateway/package.json', import.meta.url));
  const compiler = createRequire(gatewayRequire.resolve('wrangler'))('esbuild') as { build(options: unknown): Promise<{ outputFiles?: { text: string }[] }> };
  const bundle = await compiler.build({ entryPoints: [fileURLToPath(new URL('../../services/api-gateway/src/index.ts', import.meta.url))], absWorkingDir: fileURLToPath(new URL('../..', import.meta.url)),
   bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
   banner: {js: "import { createRequire as nativeCreateRequire } from 'node:module'; const require = nativeCreateRequire('file:///letbuyy-owned-gateway.mjs');"}, tsconfig: 'services/api-gateway/tsconfig.json', external: ['cloudflare:*','node:*'], conditions: ['workerd','worker','browser'], logLevel: 'silent',
   // Match Wrangler's Node compatibility resolution while retaining native
   // implementations. No crypto, storage or route implementation is replaced.
   plugins: [nativeGatewayWasmPlugin(),{ name: 'native-node-builtins', setup(build: {onResolve(options: {filter: RegExp}, handler: (args: {path:string}) => {path:string;external:true}|undefined):void}) {
    const native = new Set(builtinModules);
    build.onResolve({filter:/^[a-z][\w/]*$/}, args => native.has(args.path) ? {path:'node:'+args.path,external:true} : undefined);
   }}] });
  assert.equal(bundle.outputFiles?.length, 1);
  const origin = new URL(String(env.SUPABASE_URL)).origin;
  const tap: { beforeFinish?: () => Promise<void>; loseFinishReply?: boolean } = {};
  const mf = new Miniflare({ modules: nativeGatewayModules(bundle.outputFiles![0].text), modulesRoot:NATIVE_GATEWAY_MODULE_ROOT, compatibilityDate: '2026-05-25', compatibilityFlags: ['nodejs_compat'], cf: false,
   bindings: env as never, r2Buckets: ['REEL_ORIGINALS_BUCKET'], r2Persist: false,
   outboundService: async (request: Request) => {
    const url = new URL(request.url);
    assert.equal(url.origin, origin, 'only this verified owned PostgREST origin is reachable');
    let finish = false;
    if(url.pathname.endsWith('/rpc/reel_upload_v1')) {
     const command = await request.clone().json() as { p_action?: string }; finish = command.p_action === 'finish';
     if(finish && tap.beforeFinish) { const barrier=tap.beforeFinish;tap.beforeFinish=undefined;await barrier(); }
    }
    const response=await fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers.entries()),body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half',redirect:'error'} as RequestInit);
    if(finish && tap.loseFinishReply && response.ok) { tap.loseFinishReply=false;return new Response('{"error":{"code":"SYNTHETIC_COMMITTED_REPLY_LOSS"}}',{status:503,headers:{'Content-Type':'application/json'}}) as never; }
    return response as never;
   },
  });
  try { await mf.ready; return new NativeGateway(mf, origin, tap); }
  catch(error) {
   try { await mf.dispose(); }
   catch(cleanupError) { throw new AggregateError([error,cleanupError],'Owned native Gateway startup and disposal both failed'); }
   throw error;
  }
 }
 async request(path: string, init: RequestInit = {}): Promise<GatewayResponse> {
  const headers = new Headers(init.headers); headers.set('CF-Connecting-IP', nextClientAddress());
  const response = await this.mf.dispatchFetch('https://gateway.test'+path, { ...init, headers } as never), text = await response.text();
  let parsed: Record<string, any> | null = null; try { parsed = JSON.parse(text); } catch { /* negative response */ }
  return { status: response.status, text, json: parsed, headers: new Headers(response.headers) };
 }
 async settle() { await this.mf.dispose(); }
}
const snapshot = () => owned.psql(`SELECT jsonb_build_object(
 'intent',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM reel_upload_intents x),
 'media',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM media_assets x),
 'provenance',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM reel_asset_provenance x),
 'audit',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM audit_logs x WHERE resource_type='reel_upload'),
 'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM outbox_events x WHERE event_type='reel.upload.changed'));`);

test('private-original canonical native intake and conservative reverse retirement', async t => {
 const forward = readFileSync(new URL('../../database/supabase/migrations/359_private_reel_intake.sql', import.meta.url),'utf8');
 const retirement = readFileSync(new URL('../../database/supabase/rollback/359_private_reel_intake.rollback.sql', import.meta.url),'utf8');
 const oldRetirement = readFileSync(new URL('../../database/supabase/rollback/345_canonical_reel_review.rollback.sql', import.meta.url),'utf8');
 const oldForward = readFileSync(new URL('../../database/supabase/migrations/345_canonical_reel_review.sql', import.meta.url),'utf8');
 const body = retirement.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 const catalog = () => owned.psql(`SELECT jsonb_build_object('functions',(SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl) ORDER BY oid::regprocedure::text) FROM pg_proc WHERE proname~'(^|_)reels?(_|$)'),
  'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attrelid,attnum) FROM pg_attribute a WHERE attrelid='reel_upload_intents'::regclass AND attnum>0));`);
 const conserved = () => JSON.stringify([snapshot(),catalog()]);
 const refuse = (setup: string, reason: RegExp) => { const before=conserved();assert.match(owned.psqlExpectError(`BEGIN;${setup}\n${body}\nROLLBACK;`),reason);assert.equal(conserved(),before); };
 await t.test('empty359 blocks345; only reverse empty retirement and paired reapplication succeeds',()=>{
  assert.equal(owned.psql('SELECT count(*) FROM reel_upload_intents;'),'0');
  const before=conserved();assert.match(owned.psqlExpectError(oldRetirement),/REEL_ROLLBACK_UNKNOWN_FUNCTION_FAMILY/);assert.equal(conserved(),before);
  const strip=(sql:string)=>sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
  assert.match(owned.psqlExpectError('BEGIN;'+strip(retirement)+strip(retirement)+'ROLLBACK;'),/does not exist/);
  // Keep the complete native reverse/reapply chain in one transaction so
  // PostgREST cannot race a schema reload between two committed retirements.
  owned.script('BEGIN;'+strip(retirement)+`DO $empty$ BEGIN IF to_regclass('public.reel_upload_intents') IS NOT NULL THEN RAISE EXCEPTION 'retirement did not remove own empty family';END IF;END $empty$;`+strip(oldRetirement)+strip(oldForward)+strip(forward)+'COMMIT;');
  assert.equal(snapshot(),JSON.parse(before)[0]);
 });
 await t.test('empty359 refuses ABI/body/owner/ACL/schema/policy/trigger/dependency drift and preserves catalogs',()=>{
  const fn='public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)';
  for(const setup of [`ALTER FUNCTION ${fn} OWNER TO service_role;`,`GRANT EXECUTE ON FUNCTION ${fn} TO authenticated;`,`GRANT EXECUTE ON FUNCTION ${fn} TO service_role WITH GRANT OPTION;`,
   `ALTER FUNCTION ${fn} SET search_path=public;`,`ALTER TABLE reel_upload_intents ADD COLUMN synthetic_future text;`,`ALTER POLICY tenant_read ON reel_upload_intents USING(true);`,
   `ALTER TABLE reel_upload_intents DISABLE TRIGGER protect_reel_upload_intent;`,`ALTER TABLE reel_upload_intents DISABLE ROW LEVEL SECURITY;`,`GRANT SELECT ON reel_upload_intents TO app_tenant;`,
   `CREATE VIEW public.synthetic_intake_dependency AS SELECT id FROM reel_upload_intents;`,`CREATE FUNCTION public.reel_future_v99() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;`,
   `COMMENT ON TABLE reel_upload_intents IS 'synthetic retained annotation';`,`SET LOCAL session_replication_role=replica;`,`SET LOCAL TRANSACTION ISOLATION LEVEL REPEATABLE READ;`])
    refuse(setup,/REEL_.*ROLLBACK_/);
  for(const role of ['anon','authenticated','app_tenant','service_role'])refuse(`DO $fixture_role$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN;END IF;END $fixture_role$;SET LOCAL ROLE ${role};`,/permission denied|UNSAFE|LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
 });
 await t.test('mandatory DROP fault aborts eligible retirement before any source family is lost',()=>{
  owned.psql(`CREATE FUNCTION public.synthetic_intake_drop_fault() RETURNS event_trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'SYNTHETIC_INTAKE_DROP_FAULT';END$$;CREATE EVENT TRIGGER synthetic_intake_drop_fault ON sql_drop EXECUTE FUNCTION public.synthetic_intake_drop_fault();`);
  try { refuse('',/SYNTHETIC_INTAKE_DROP_FAULT/); } finally { owned.psql('DROP EVENT TRIGGER synthetic_intake_drop_fault;DROP FUNCTION synthetic_intake_drop_fault();'); }
 });
 const tenant=newSyntheticTenant('intake-native'),other=newSyntheticTenant('intake-other');seedSyntheticTenant(owned.psql,tenant);seedSyntheticTenant(owned.psql,other);
 const actor=randomUUID(),otherActor=randomUUID(),staff=randomUUID(),email=`syn-intake-${actor}@example.invalid`,password='Synthetic-intake-only!42';
 const passwordHash=await hashMerchantPassword(password);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,password_hash) VALUES('${actor}',${quote(email)},true,${quote(passwordHash)}),('${otherActor}','syn-intake-other-${otherActor}@example.invalid',true,${quote(passwordHash)}),('${staff}','syn-intake-staff-${staff}@example.invalid',true,${quote(passwordHash)});
 UPDATE sites SET custom_user_id='${actor}' WHERE id='${tenant.siteId}';UPDATE sites SET custom_user_id='${otherActor}' WHERE id='${other.siteId}';`);
 const session=randomUUID(),token=randomUUID()+randomUUID();
 owned.psql(`INSERT INTO sessions(id,user_id,token,expires_at) VALUES('${session}','${actor}',${quote(token)},now()+interval '1 hour');`);
 const keys=await newIdentityKeys();
 const headers=async(sessionToken=token)=>{const plan=await createLetbuyyInternalSessionHeaders(sessionToken,INTERNAL_SECRET);assert.ok(plan.ok&&plan.headers);return {...plan.headers,'Content-Type':'application/json'};};
 await t.test('ordinary roles cannot read or mutate the raw intake table or execute intake RPCs; canonical service RPC remains positive',()=>{
  const cmd={idempotency_key:randomUUID(),filename:'role-boundary.mp4',content_type:'video/mp4',size_bytes:4096,checksum_sha256:digest(original())};
  const p=syntheticProfile.profile,admission={profile_ref:syntheticProfile.approved_profile_ref,profile_digest:digest(JSON.stringify(syntheticProfile)),max_bytes:p.max_bytes,max_intents:p.max_intents,max_charged_bytes:p.max_charged_bytes,reservation_ttl_seconds:p.reservation_ttl_seconds,lease_seconds:p.lease_seconds,max_wall_ms:p.max_wall_ms};
  const rpc=(name:string,action:string,id:string|null,command:unknown=null,limits:unknown=null)=>`public.${name}(${quote(token)},'${actor}','${tenant.siteId}',${quote(action)},${id?quote(id)+'::uuid':'NULL'},${json(command)},${json(limits)},NULL)`;
  const trusted=JSON.parse(owned.script(`BEGIN;SET LOCAL ROLE service_role;SELECT ${rpc('reel_upload_v1','begin',null,cmd,admission)};COMMIT;`)).data;
  assert.equal(trusted.state,'reserved');assert.equal(trusted.idempotency_key,cmd.idempotency_key);
  const before=snapshot();
  const readback=JSON.parse(owned.script(`BEGIN;SET LOCAL ROLE service_role;SELECT ${rpc('reel_upload_v1','read',trusted.id)};COMMIT;`)).data;
  assert.equal(readback.id,trusted.id);assert.equal(readback.checksum_sha256,cmd.checksum_sha256);assert.equal(snapshot(),before);
  const retained=JSON.parse(owned.psql(`SELECT to_jsonb(i) FROM public.reel_upload_intents i WHERE id='${trusted.id}';`));
  const insertRow={...retained,id:randomUUID(),idempotency_key:randomUUID(),object_nonce:randomUUID()};
  const statements=[`SELECT * FROM public.reel_upload_intents WHERE id='${trusted.id}'`,
   `INSERT INTO public.reel_upload_intents SELECT (jsonb_populate_record(NULL::public.reel_upload_intents,${json(insertRow)})).*`,
   `UPDATE public.reel_upload_intents SET updated_at=clock_timestamp() WHERE id='${trusted.id}'`,
   `DELETE FROM public.reel_upload_intents WHERE id='${trusted.id}'`,`TRUNCATE TABLE public.reel_upload_intents`];
  for(const role of ['anon','authenticated','app_tenant']) {
   const asRole=(sql:string)=>`BEGIN;SET LOCAL ROLE ${role};SET LOCAL app.site_id='${tenant.siteId}';${sql};ROLLBACK;`;
   for(const statement of statements) { assert.match(owned.psqlExpectError(asRole(statement)),/permission denied for table reel_upload_intents/);assert.equal(snapshot(),before); }
   for(const name of ['reel_upload_v1','reel_upload_backend_v1']) {
    assert.match(owned.psqlExpectError(asRole(`SELECT ${rpc(name,'read',trusted.id)}`)),new RegExp('permission denied for function '+name));assert.equal(snapshot(),before);
    assert.equal(owned.psql(`SELECT has_function_privilege('${role}','public.${name}(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb)','EXECUTE');`),'f');
   }
   for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(owned.psql(`SELECT has_table_privilege('${role}','public.reel_upload_intents','${privilege}');`),'f');
  }
 });
 const disabled=await NativeGateway.create(gatewayEnv(owned,keys) as unknown as Record<string,unknown>);
 try { await t.test('actual native default-off configuration exposes no upload capability and creates no reservation/object',async()=>{
  const before=snapshot(),response=await disabled.request(`/v1/reels/uploads?store_id=${tenant.siteId}`,{method:'POST',headers:await headers(),body:JSON.stringify({idempotency_key:randomUUID(),filename:'disabled.mp4',content_type:'video/mp4',size_bytes:4096,checksum_sha256:digest(original())})});assert.equal(response.status,503,response.text);assert.equal(snapshot(),before);
  const capability=await disabled.request(`/v1/reels/uploads/capabilities?store_id=${tenant.siteId}`,{headers:await headers()});assert.equal(capability.status,200,capability.text);assert.equal(capability.json!.data.private_upload_enabled,false);assert.equal(capability.json!.data.max_bytes,null);
  assert.equal((await(await disabled.mf.getR2Bucket('REEL_ORIGINALS_BUCKET')).list()).objects.length,0);
 }); } finally { await disabled.settle(); }
 await t.test('reserved expiry returns HTTP409 and commits one expired transition without releasing its key, charge or mandatory events',async()=>{
  const profile={...syntheticProfile,profile:{...syntheticProfile.profile,reservation_ttl_seconds:1}};
  const expiry=await NativeGateway.create(gatewayEnv(owned,keys,{REEL_CUSTODY_PROFILE:JSON.stringify(profile)}) as unknown as Record<string,unknown>);
  try {
   const cmd={idempotency_key:randomUUID(),filename:'expired-original.mp4',content_type:'video/mp4',size_bytes:4096,checksum_sha256:digest(original())};
   const reserved=await expiry.request(`/v1/reels/uploads?store_id=${tenant.siteId}`,{method:'POST',headers:await headers(),body:JSON.stringify(cmd)});assert.equal(reserved.status,201,reserved.text);
   const id=reserved.json!.data.id,sqlRow=()=>JSON.parse(owned.psql(`SELECT to_jsonb(i) FROM reel_upload_intents i WHERE id='${id}';`)),initial=sqlRow();assert.equal(initial.state,'reserved');assert.equal(initial.version,1);
   const charged=owned.psql(`SELECT count(*)||'|'||sum(charged_bytes) FROM reel_upload_intents WHERE site_id='${tenant.siteId}';`);
   const deadline=Date.now()+5000;
   while(owned.psql(`SELECT clock_timestamp()>=expires_at FROM reel_upload_intents WHERE id='${id}';`)!=='t') { assert.ok(Date.now()<deadline,'owned DB clock must reach reservation expiry');await new Promise(resolve=>setTimeout(resolve,25)); }
   const claim=async(version:number)=>expiry.request(`/v1/reels/uploads/${id}/content?store_id=${tenant.siteId}`,{method:'PUT',headers:{...await headers(),'Content-Type':cmd.content_type,'X-Idempotency-Key':cmd.idempotency_key,'X-Reel-Upload-Version':String(version)},body:original()});
   const expired=await claim(initial.version);assert.equal(expired.status,409,expired.text);assert.equal(expired.json!.error.code,'REEL_UPLOAD_EXPIRED');
   const current=sqlRow();assert.equal(current.state,'expired');assert.equal(current.version,2);
   for(const field of ['id','site_id','actor_id','session_id','idempotency_key','request_sha256','object_nonce','charged_bytes','size_bytes','checksum_sha256','profile_ref','profile_digest','admission','expires_at','created_at'])assert.deepEqual(current[field],initial[field]);
   for(const field of ['media_asset_id','provenance_id','object_version','completion_sha256','lease_sha256','lease_expires_at'])assert.equal(current[field],null);
   assert.equal(owned.psql(`SELECT count(*)||'|'||sum(charged_bytes) FROM reel_upload_intents WHERE site_id='${tenant.siteId}';`),charged);
   const audits=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('action',action,'metadata',metadata) ORDER BY (metadata->>'version')::int) FROM audit_logs WHERE resource_type='reel_upload' AND resource_id='${id}';`));
   assert.deepEqual(audits,[{action:'reel.upload.reserve',metadata:{site_id:tenant.siteId,state:'reserved',version:1}},{action:'reel.upload.expire',metadata:{site_id:tenant.siteId,state:'expired',version:2}}]);
   const events=JSON.parse(owned.psql(`SELECT jsonb_agg(payload ORDER BY (payload->>'version')::int) FROM outbox_events WHERE event_type='reel.upload.changed' AND aggregate_id='${id}';`));
   assert.deepEqual(events,[{site_id:tenant.siteId,intent_id:id,state:'reserved',version:1},{site_id:tenant.siteId,intent_id:id,state:'expired',version:2}]);
   assert.equal((await(await expiry.mf.getR2Bucket('REEL_ORIGINALS_BUCKET')).list()).objects.length,0);
   const before=snapshot(),again=await claim(current.version);assert.equal(again.status,409,again.text);assert.equal(again.json!.error.code,'REEL_UPLOAD_EXPIRED');assert.equal(snapshot(),before);
  } finally { await expiry.settle(); }
 });
 const gateway=await NativeGateway.create(gatewayEnv(owned,keys,{REEL_CUSTODY_PROFILE:JSON.stringify(syntheticProfile)}) as unknown as Record<string,unknown>);
 const command=(bytes=original(),key=randomUUID())=>({idempotency_key:key,filename:'synthetic-original.mp4',content_type:'video/mp4',size_bytes:bytes.length,checksum_sha256:digest(bytes)});
 const begin=async(cmd=command())=>gateway.request(`/v1/reels/uploads?store_id=${tenant.siteId}`,{method:'POST',headers:await headers(),body:JSON.stringify(cmd)});
 const read=async(id:string)=>gateway.request(`/v1/reels/uploads/${id}?store_id=${tenant.siteId}`,{headers:await headers()});
 const transfer=async(row:any,bytes=original())=>gateway.request(`/v1/reels/uploads/${row.id}/content?store_id=${tenant.siteId}`,{method:'PUT',headers:{...await headers(),'Content-Type':row.content_type,'X-Idempotency-Key':row.idempotency_key,'X-Reel-Upload-Version':String(row.version)},body:bytes});
 const reconcile=async(row:any)=>gateway.request(`/v1/reels/uploads/${row.id}?store_id=${tenant.siteId}`,{method:'POST',headers:await headers(),body:JSON.stringify({idempotency_key:row.idempotency_key,expected_version:row.version})});
 let receipt:any;
 try {
  await t.test('signed merchant reserve/transfer finalizes exact native bytes as private pending media/provenance with mandatory metadata audit/outbox',async()=>{
   const bytes=original(128*1024+7),cmd=command(bytes),reserved=await begin(cmd);assert.equal(reserved.status,201,reserved.text);
   const before=reserved.json!.data;assert.equal(before.state,'reserved');
   const received=await transfer(before,bytes);assert.equal(received.status,200,received.text);receipt=received.json!.data;
   assert.equal(receipt.state,'received_unprocessed');assert.equal(receipt.processing_available,false);assert.equal(receipt.inspection_available,false);
   for(const field of ['internal','object_nonce','object_key','lease_token','public_url','provider_asset_id'])assert.equal(field in receipt,false);
   const result=JSON.parse(owned.psql(`SELECT jsonb_build_object('intent',to_jsonb(i),'media',to_jsonb(m),'provenance',to_jsonb(p)) FROM reel_upload_intents i JOIN media_assets m ON m.id=i.media_asset_id JOIN reel_asset_provenance p ON p.id=i.provenance_id WHERE i.id='${receipt.id}';`));
   const bucket=await gateway.mf.getR2Bucket('REEL_ORIGINALS_BUCKET'),stored=await bucket.get(result.media.object_key);assert.ok(stored);
   assert.equal(digest(new Uint8Array(await stored.arrayBuffer())),cmd.checksum_sha256);assert.equal(stored.version,result.intent.object_version);
   assert.equal(result.media.public_url,null);assert.equal(result.media.processing_status,'pending');assert.equal(result.provenance.provider_asset_id,null);
   assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_type='reel_upload' AND resource_id='${receipt.id}';`),'3');
   assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE event_type='reel.upload.changed' AND aggregate_id='${receipt.id}';`),'3');
   assert.equal(owned.psql(`SELECT count(*) FROM reel_processing_receipts WHERE provenance_id='${receipt.provenance_id}';`),'0');
   assert.equal(owned.psql(`SELECT count(*) FROM reel_review_inspections WHERE site_id='${tenant.siteId}';`),'0');
   const replay=await reconcile(receipt);assert.equal(replay.status,200,replay.text);assert.equal(replay.json!.data.replayed,true);assert.equal(replay.json!.data.version,receipt.version);
   assert.equal((await bucket.list()).objects.length,1);
   const again=await begin(cmd);assert.equal(again.status,201);assert.equal(again.json!.data.id,receipt.id);
   const conflict=await begin({...cmd,filename:'different.mp4'});assert.equal(conflict.status,409);
  });
  await t.test('received replay rejects canonical media path drift despite unchanged real native object bytes',async()=>{
   const prior=owned.psql(`SELECT storage_path FROM media_assets WHERE id='${receipt.media_asset_id}';`);
   owned.psql(`UPDATE media_assets SET storage_path='synthetic-replaced-private-path' WHERE id='${receipt.media_asset_id}';`);
   try { const before=snapshot(),denied=await reconcile(receipt);assert.equal(denied.status,503,denied.text);assert.equal(snapshot(),before); }
   finally { owned.psql(`UPDATE media_assets SET storage_path=${quote(prior)} WHERE id='${receipt.media_asset_id}';`); }
  });
  await t.test('concurrent reservation deduplicates same key; same-site quota, key/version fencing and concurrent claim remain durable',async()=>{
   const cmd=command(),results=await Promise.all([begin(cmd),begin(cmd)]);for(const value of results)assert.equal(value.status,201,value.text);assert.equal(results[0].json!.data.id,results[1].json!.data.id);
   const row=results[0].json!.data,results2=await Promise.all([transfer(row),transfer(row)]);assert.equal(results2.filter(x=>x.status===200).length>=1,true);
   assert.ok(results2.every(x=>[200,409].includes(x.status)));
   const current=(await read(row.id)).json!.data;assert.equal(current.state,'received_unprocessed');
   const bad=await transfer({...current,idempotency_key:'different-key'});assert.equal(bad.status,409);
  });
  await t.test('native activated intake rejects oversized metadata and binary mislabeled as JSON without reservation/custody side effects',async()=>{
   const before=snapshot();
   const large=await gateway.request(`/v1/reels/uploads?store_id=${tenant.siteId}`,{method:'POST',headers:await headers(),body:JSON.stringify({filename:'界'.repeat(10000)})});assert.equal(large.status,413,large.text);assert.equal(snapshot(),before);
   const reserved=await begin();assert.equal(reserved.status,201,reserved.text);const row=reserved.json!.data,after=snapshot();
   const mislabeled=await gateway.request(`/v1/reels/uploads/${row.id}/content?store_id=${tenant.siteId}`,{method:'PUT',headers:{...await headers(),'X-Idempotency-Key':row.idempotency_key,'X-Reel-Upload-Version':String(row.version)},body:new Uint8Array(2*1024*1024)});assert.equal(mislabeled.status,415,mislabeled.text);assert.equal(snapshot(),after);
  });
  await t.test('short/long/checksum/container faults never finalize; unknown outcomes retain exactly one key and charge',async()=>{
   for(const mode of ['short','long','checksum','container']){
    let bytes=original();let cmd=command();if(mode==='short')bytes=bytes.subarray(0,4000);if(mode==='long')bytes=new Uint8Array(4100);if(mode==='checksum')cmd.checksum_sha256='f'.repeat(64);if(mode==='container'){bytes=new Uint8Array(4096);cmd.checksum_sha256=digest(bytes);}
    const reserved=await begin(cmd);assert.equal(reserved.status,201,reserved.text);const row=reserved.json!.data;
    const failed=await transfer(row,bytes);assert.equal(failed.status,503,failed.text);
    const retained=JSON.parse(owned.psql(`SELECT to_jsonb(x) FROM reel_upload_intents x WHERE id='${row.id}';`));assert.equal(retained.state,'transfer_unknown');assert.equal(retained.charged_bytes,cmd.size_bytes);assert.equal(retained.media_asset_id,null);
    assert.equal(owned.psql(`SELECT count(*) FROM reel_upload_intents WHERE id='${row.id}';`),'1');
   }
  });
  await t.test('each mandatory media/provenance/audit/outbox fault conserves finalization and recovers the same native object',async()=>{
   for(const target of ['media_assets','reel_asset_provenance','audit_logs','outbox_events']){
    const reserved=await begin();assert.equal(reserved.status,201,reserved.text);const row=reserved.json!.data;
    owned.psql(`CREATE FUNCTION public.synthetic_intake_effect_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'SYNTHETIC_INTAKE_EFFECT_FAULT';END$$;CREATE TRIGGER synthetic_intake_effect_fault BEFORE INSERT ON ${target} FOR EACH ROW WHEN(${target==='audit_logs'?"NEW.action='reel.upload.receive'":target==='outbox_events'?"NEW.event_type='reel.upload.changed' AND NEW.payload->>'state'='received_unprocessed'":'true'}) EXECUTE FUNCTION synthetic_intake_effect_fault();`);
    try {
     const failed=await transfer(row);assert.equal(failed.status,503,failed.text);
     assert.equal(owned.psql(`SELECT count(*) FROM media_assets WHERE metadata->>'source'='private-reel-intake' AND object_key LIKE '%/${row.id}/%';`),'0');
     const current=(await read(row.id)).json!.data;assert.equal(current.state,'receiving');assert.equal(current.media_asset_id,null);
     assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_type='reel_upload' AND resource_id='${row.id}' AND action='reel.upload.receive';`),'0');
     assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${row.id}' AND event_type='reel.upload.changed' AND payload->>'state'='received_unprocessed';`),'0');
    } finally { owned.psql(`DROP TRIGGER synthetic_intake_effect_fault ON ${target};DROP FUNCTION synthetic_intake_effect_fault();`); }
    await new Promise(resolve=>setTimeout(resolve,8100));
    const current=(await read(row.id)).json!.data,recovered=await reconcile(current);assert.equal(recovered.status,200,recovered.text);assert.equal(recovered.json!.data.state,'received_unprocessed');
   }
  });
  await t.test('current revoked session denies an already completed receipt replay without finalization effects',async()=>{
   const current=(await read(receipt.id)).json!.data;
   owned.psql(`UPDATE sessions SET revoked_at=now(),revoked_reason='synthetic-intake-revocation' WHERE id='${session}';`);
   const before=snapshot(),denied=await reconcile(current);assert.equal(denied.status,401,denied.text);assert.equal(snapshot(),before);
   owned.psql(`UPDATE sessions SET revoked_at=NULL,revoked_reason=NULL WHERE id='${session}';`);
  });

  await t.test('actual stored bytes survive session revocation between transfer and the final RPC; a fresh canonical session recovers same key',async()=>{
   const reserved=await begin();assert.equal(reserved.status,201,reserved.text);const row=reserved.json!.data;
   gateway.tap.beforeFinish=async()=>{owned.psql(`UPDATE sessions SET revoked_at=now(),revoked_reason='synthetic-mid-transfer' WHERE id='${session}';`);};
   const failed=await transfer(row);assert.equal(failed.status,401,failed.text);
   const intent=JSON.parse(owned.psql(`SELECT to_jsonb(x) FROM reel_upload_intents x WHERE id='${row.id}';`));assert.equal(intent.state,'receiving');assert.equal(intent.charged_bytes,row.size_bytes);assert.equal(intent.media_asset_id,null);
   const bucket=await gateway.mf.getR2Bucket('REEL_ORIGINALS_BUCKET'),key=`private-reel-originals/${tenant.siteId}/${row.id}/${intent.object_nonce}`,stored=await bucket.head(key);assert.ok(stored);
   const fresh=randomUUID()+randomUUID();owned.psql(`INSERT INTO sessions(user_id,token,expires_at) VALUES('${actor}',${quote(fresh)},now()+interval '1 hour');`);
   await new Promise(resolve=>setTimeout(resolve,8100));
   const current=await gateway.request(`/v1/reels/uploads/${row.id}?store_id=${tenant.siteId}`,{headers:await headers(fresh)});assert.equal(current.status,200,current.text);
   const recovered=await gateway.request(`/v1/reels/uploads/${row.id}?store_id=${tenant.siteId}`,{method:'POST',headers:await headers(fresh),body:JSON.stringify({idempotency_key:row.idempotency_key,expected_version:current.json!.data.version})});assert.equal(recovered.status,200,recovered.text);
   assert.equal((await bucket.head(key))!.version,stored.version);
   owned.psql(`UPDATE sessions SET revoked_at=NULL,revoked_reason=NULL WHERE id='${session}';`);
  });
  await t.test('live staff permission loss after stored transfer blocks finish and replay, with no receipt or replacement key',async()=>{
   owned.psql(`INSERT INTO employees(user_id,email,role,store_id,status,is_active,permissions) VALUES('${staff}','syn-intake-staff-${staff}@example.invalid','editor','${tenant.siteId}','active',true,'{"granted":["content:write"]}');`);
   const staffToken=randomUUID()+randomUUID();owned.psql(`INSERT INTO sessions(user_id,token,expires_at) VALUES('${staff}',${quote(staffToken)},now()+interval '1 hour');`);
   const cmd=command(),reserved=await gateway.request(`/v1/reels/uploads?store_id=${tenant.siteId}`,{method:'POST',headers:await headers(staffToken),body:JSON.stringify(cmd)});assert.equal(reserved.status,201,reserved.text);const row=reserved.json!.data;
   gateway.tap.beforeFinish=async()=>{owned.psql(`UPDATE employees SET permissions='{"granted":[]}' WHERE user_id='${staff}' AND store_id='${tenant.siteId}';`);};
   const failed=await gateway.request(`/v1/reels/uploads/${row.id}/content?store_id=${tenant.siteId}`,{method:'PUT',headers:{...await headers(staffToken),'Content-Type':row.content_type,'X-Idempotency-Key':row.idempotency_key,'X-Reel-Upload-Version':String(row.version)},body:original()});assert.equal(failed.status,403,failed.text);
   const saved=JSON.parse(owned.psql(`SELECT to_jsonb(x) FROM reel_upload_intents x WHERE id='${row.id}';`));assert.equal(saved.state,'receiving');assert.equal(saved.media_asset_id,null);
   const before=snapshot(),denied=await gateway.request(`/v1/reels/uploads/${row.id}?store_id=${tenant.siteId}`,{headers:await headers(staffToken)});assert.equal(denied.status,403,denied.text);assert.equal(snapshot(),before);
  });
  await t.test('lost committed reply replays received-unprocessed with full native version recheck and zero duplicate effects',async()=>{
   const reserved=await begin();assert.equal(reserved.status,201,reserved.text);const row=reserved.json!.data;
   gateway.tap.loseFinishReply=true;const failed=await transfer(row);assert.equal(failed.status,503,failed.text);
   const current=(await read(row.id)).json!.data;assert.equal(current.state,'received_unprocessed');const before=snapshot();
   const recovered=await reconcile(current);assert.equal(recovered.status,200,recovered.text);assert.equal(recovered.json!.data.replayed,true);assert.equal(snapshot(),before);
  });
  await t.test('cross actor/site cannot inspect another intent even with a valid canonical owner session',async()=>{
   const otherToken=randomUUID()+randomUUID();owned.psql(`INSERT INTO sessions(user_id,token,expires_at) VALUES('${otherActor}',${quote(otherToken)},now()+interval '1 hour');`);
   const before=snapshot();
   const wrongSite=await gateway.request(`/v1/reels/uploads/${receipt.id}?store_id=${tenant.siteId}`,{headers:await headers(otherToken)});assert.equal(wrongSite.status,403,wrongSite.text);
   const wrongIntent=await gateway.request(`/v1/reels/uploads/${receipt.id}?store_id=${other.siteId}`,{headers:await headers(otherToken)});assert.equal(wrongIntent.status,404,wrongIntent.text);assert.equal(snapshot(),before);
  });
  await t.test('canonical per-site quota serializes distinct keys across concurrent current sessions and retains expired charges',async()=>{
   const site=newSyntheticTenant('intake-quota');seedSyntheticTenant(owned.psql,site);owned.psql(`UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';`);
   const tokens=[randomUUID()+randomUUID(),randomUUID()+randomUUID()];for(const value of tokens)owned.psql(`INSERT INTO sessions(user_id,token,expires_at) VALUES('${actor}',${quote(value)},now()+interval '1 hour');`);
   const limits={profile_ref:'synthetic-quota-only',profile_digest:'b'.repeat(64),max_bytes:4096,max_intents:1,max_charged_bytes:4096,reservation_ttl_seconds:1,lease_seconds:8,max_wall_ms:4000};
   const call=(token:string,cmd:unknown)=>`SET ROLE service_role;SELECT reel_upload_v1(${quote(token)},'${actor}','${site.siteId}','begin',NULL,${json(cmd)},${json(limits)},NULL);`;
   const outcomes=await Promise.allSettled(tokens.map(value=>owned.psqlAsync(call(value,command()))));assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
   assert.equal(owned.psql(`SELECT count(*)||'|'||sum(charged_bytes) FROM reel_upload_intents WHERE site_id='${site.siteId}';`),'1|4096');
   await new Promise(resolve=>setTimeout(resolve,1100));assert.match(owned.psqlExpectError(call(tokens[0],command())),/REEL_UPLOAD_QUOTA/);
  });
  await t.test('private intake event has zero external fanout; ordinary wildcard media event still dispatches',async()=>{
   const subscription=randomUUID();owned.psql(`INSERT INTO webhook_subscriptions(id,site_id,name,target_url,event_types,signing_secret) VALUES('${subscription}','${tenant.siteId}','Synthetic intake wildcard','https://webhook.example.com/synthetic-intake',ARRAY['*'],'synthetic-not-a-real-signing-secret');`);
   const ordinary=randomUUID();owned.psql(`INSERT INTO outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key) VALUES('${tenant.siteId}','${tenant.siteId}','media','${ordinary}','media.processed',jsonb_build_object('site_id','${tenant.siteId}','media_id','${ordinary}'),'synthetic-ordinary-${ordinary}');`);
   const dispatcher=new OutboxExecutionAdapter(createSupabaseServiceClient(owned.restEnv()));const result=await dispatcher.dispatchBatch({dispatcherId:randomUUID(),outboxLimit:100});assert.equal(result.failed,0);
   assert.equal(owned.psql(`SELECT count(*) FROM webhook_deliveries d JOIN outbox_events e ON e.id=d.outbox_event_id WHERE e.event_type='reel.upload.changed';`),'0');
   assert.equal(owned.psql(`SELECT count(*) FROM webhook_deliveries d JOIN outbox_events e ON e.id=d.outbox_event_id WHERE e.idempotency_key='synthetic-ordinary-${ordinary}';`),'1');
  });
  await t.test('retained reservation/received receipts/audit refuse retirement without deleting physical or canonical history',async()=>{
   refuse('',/REEL_UPLOAD_ROLLBACK_RETAINED_DATA/);const before=conserved();assert.match(owned.psqlExpectError(oldRetirement),/UNKNOWN_FUNCTION_FAMILY/);assert.equal(conserved(),before);
  });
 } finally { await gateway.settle(); }
 await t.test('ordinary password/session merchant browser transfers through signed BFF and recovers received-unprocessed after reload',async()=>{
  await withMerchantReelBrowser(async fixture=>{
   const {page}=await fixture.login(email,password,tenant.subdomain);await page.goto(`${fixture.origin}/${tenant.subdomain}/content/reels`);
   await expect(page.getByLabel('Original video')).toBeVisible();const bytes=original(128*1024+7);
   await page.getByLabel('Original video').setInputFiles({name:'browser-original.mp4',mimeType:'video/mp4',buffer:Buffer.from(bytes)});
   await expect(page.getByRole('button',{name:'Transfer same original',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Transfer same original',exact:true}).click();
   await expect(page.getByText(/Private original received\. Processing and reviewer playback remain unavailable/)).toBeVisible();
   await page.reload();await expect(page.getByText(/Server state: received_unprocessed/)).toBeVisible();await page.getByRole('button',{name:'Check same intake',exact:true}).click();
   await expect(page.getByText(/Private original received\. Processing and reviewer playback remain unavailable/)).toBeVisible();assert.equal(await page.locator('video').count(),0);
   await page.screenshot({path:fixture.evidence+'/received-unprocessed.png',fullPage:true});
  });
 });
 await t.test('normal merchant browser recovers a lost committed content reply after reload with the same intake and no duplicate effects',async()=>{
  await withMerchantReelBrowser(async fixture=>{
   const {page}=await fixture.login(email,password,tenant.subdomain);await page.goto(`${fixture.origin}/${tenant.subdomain}/content/reels`);
   const bytes=original(128*1024+13);await page.getByLabel('Original video').setInputFiles({name:'lost-browser-original.mp4',mimeType:'video/mp4',buffer:Buffer.from(bytes)});
   const transferButton=page.getByRole('button',{name:'Transfer same original',exact:true});await expect(transferButton).toBeEnabled();fixture.loseReply();
   const lostResponse=page.waitForResponse(response=>response.request().method()==='PUT'&&/\/reels\/uploads\/[a-f0-9-]{36}\/content$/.test(new URL(response.url()).pathname));await transferButton.click();const lost=await lostResponse;assert.equal(lost.status(),503);
   await expect(page.getByText(/The outcome needs confirmation/)).toBeVisible();assert.equal(await page.getByText(/^Private original received\./).count(),0);
   const key=lost.request().headers()['x-idempotency-key'];assert.ok(key);const committed=retainedBrowserIntake(key);
   assert.equal(committed.row.state,'received_unprocessed');assert.equal(committed.row.version,3);assert.equal(committed.row.charged_bytes,bytes.length);assert.equal(committed.row.checksum_sha256,digest(bytes));assert.deepEqual(committed.effects,{audit:3,outbox:3,media:1,provenance:1});
   assert.ok(new URL(lost.url()).pathname.endsWith('/'+committed.row.id+'/content'));
   const physical=await fixture.privateOriginalState(committed.objectKey);assert.deepEqual(physical,{count:1,version:committed.row.object_version});const before=snapshot();
   await page.reload();await expect(page.getByText(/Server state: received_unprocessed/)).toBeVisible();
   const replayResponse=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname.endsWith('/reels/uploads/'+committed.row.id));await page.getByRole('button',{name:'Check same intake',exact:true}).click();const replay=await replayResponse;assert.equal(replay.status(),200);const readback=(await replay.json()).data;
   assert.equal(replay.request().headers()['x-idempotency-key'],key);assert.equal(readback.id,committed.row.id);assert.equal(readback.idempotency_key,key);assert.equal(readback.checksum_sha256,digest(bytes));assert.equal(readback.state,'received_unprocessed');assert.equal(readback.replayed,true);
   await expect(page.getByText(/^Private original received\./)).toBeVisible();assert.equal(snapshot(),before);assert.deepEqual(await fixture.privateOriginalState(committed.objectKey),physical);assert.deepEqual(retainedBrowserIntake(key),committed);
   await page.screenshot({path:fixture.evidence+'/lost-content-reply-recovered.png',fullPage:true});
  });
 });
 await t.test('normal merchant browser rejects valid-shaped wrong id/key/checksum and non-received completion, preserving the same request for recovery',async()=>{
  await withMerchantReelBrowser(async fixture=>{
   const {page}=await fixture.login(email,password,tenant.subdomain);await page.goto(`${fixture.origin}/${tenant.subdomain}/content/reels`);
   for(const fault of ['id','idempotency_key','checksum_sha256','state'] as const) {
    const bytes=original(128*1024+29),filename=`binding-${fault}.mp4`;await page.getByLabel('Original video').setInputFiles({name:filename,mimeType:'video/mp4',buffer:Buffer.from(bytes)});
    const button=page.getByRole('button',{name:'Transfer same original',exact:true});await expect(button).toBeEnabled();
    let injected=false,key='',actualId='',wrongId='';const pattern='**/api/stores/*/reels/uploads**';
    await page.route(pattern,async route=>{
     const request=route.request(),path=new URL(request.url()).pathname;
     const isBegin=request.method()==='POST'&&/\/reels\/uploads$/.test(path),isContent=request.method()==='PUT'&&/\/reels\/uploads\/[a-f0-9-]{36}\/content$/.test(path);
     if(injected||!(fault==='state'?isContent:isBegin)){await route.continue();return;}
     const response=await route.fetch();assert.equal(response.status(),fault==='state'?200:201);const payload=await response.json();key=payload.data.idempotency_key;actualId=payload.data.id;injected=true;
     if(fault==='id'){wrongId=randomUUID();payload.data.id=wrongId;}
     else if(fault==='idempotency_key')payload.data.idempotency_key=randomUUID();
     else if(fault==='checksum_sha256')payload.data.checksum_sha256='f'.repeat(64);
     else {payload.data.state='receiving';payload.data.media_asset_id=null;payload.data.provenance_id=null;}
     assert.equal(ReelUploadReadbackSchema.safeParse(payload.data).success,true,'adversarial reply is structurally valid');
     await route.fulfill({response,json:payload});
    });
    await button.click();await expect(page.getByText(/The outcome needs confirmation/)).toBeVisible();assert.equal(injected,true);assert.equal(await page.getByText(/^Private original received\./).count(),0);
    await page.unroute(pattern);
    const saved=await page.evaluate(({actor,store})=>{
     const storage=(globalThis as unknown as {sessionStorage:{getItem(key:string):string|null}}).sessionStorage;
     return JSON.parse(storage.getItem(`letbuyy:private-reel-intake:v1:${actor}:${store}`) || 'null');
    },{actor,store:tenant.subdomain});
    assert.equal(saved.command.idempotency_key,key);assert.equal(saved.command.checksum_sha256,digest(bytes));assert.equal(saved.id,fault==='state'?actualId:null);
    if(fault==='id') {assert.notEqual(actualId,wrongId);assert.equal(owned.psql(`SELECT count(*) FROM reel_upload_intents WHERE id='${wrongId}';`),'0');}
    const rejected=retainedBrowserIntake(key);assert.equal(rejected.row.id,actualId);assert.equal(rejected.row.charged_bytes,bytes.length);assert.equal(rejected.row.checksum_sha256,digest(bytes));
    assert.equal(rejected.row.state,fault==='state'?'received_unprocessed':'reserved');assert.deepEqual(rejected.effects,fault==='state'?{audit:3,outbox:3,media:1,provenance:1}:{audit:1,outbox:1,media:0,provenance:0});
    const priorPhysical=await fixture.privateOriginalState(rejected.objectKey);assert.equal(priorPhysical.count,fault==='state'?1:0);const before=snapshot();
    if(fault==='state')await page.getByRole('button',{name:'Check same intake',exact:true}).click();else await button.click();
    await expect(page.getByText(/^Private original received\./)).toBeVisible();const recovered=retainedBrowserIntake(key);
    assert.equal(recovered.row.id,actualId);assert.equal(recovered.row.state,'received_unprocessed');assert.equal(recovered.row.version,3);assert.deepEqual(recovered.effects,{audit:3,outbox:3,media:1,provenance:1});
    const physical=await fixture.privateOriginalState(recovered.objectKey);assert.deepEqual(physical,{count:1,version:recovered.row.object_version});
    if(fault==='state'){assert.equal(snapshot(),before);assert.deepEqual(physical,priorPhysical);}
    await page.screenshot({path:fixture.evidence+'/binding-'+fault+'-recovered.png',fullPage:true});await page.getByRole('button',{name:'Start another original',exact:true}).click();
   }
  });
 });
});

function retainedBrowserIntake(key:string) {
 const rows=JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') FROM reel_upload_intents i WHERE idempotency_key=${quote(key)};`));
 assert.equal(rows.length,1,'exactly one durable intake for the retained browser key');const row=rows[0];
 const count=(sql:string)=>Number(owned.psql(sql));
 const effects={audit:count(`SELECT count(*) FROM audit_logs WHERE resource_type='reel_upload' AND resource_id='${row.id}';`),outbox:count(`SELECT count(*) FROM outbox_events WHERE event_type='reel.upload.changed' AND aggregate_id='${row.id}';`),media:count(`SELECT count(*) FROM media_assets WHERE id='${row.media_asset_id || '00000000-0000-0000-0000-000000000000'}';`),provenance:count(`SELECT count(*) FROM reel_asset_provenance WHERE id='${row.provenance_id || '00000000-0000-0000-0000-000000000000'}';`)};
 return {row,effects,objectKey:`private-reel-originals/${row.site_id}/${row.id}/${row.object_nonce}`};
}

async function withMerchantReelBrowser(run: (fixture: {
  origin: string; evidence: string; readOutage(value: boolean): void; loseReply(): void;
  privateOriginalState(key: string): Promise<{ count: number; version: string | null }>;
  login(email: string, password: string, subdomain: string): Promise<{ page: Page; context: BrowserContext }>;
}) => Promise<void>) {
  async function port() { const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const value = (server.address() as { port: number }).port; await new Promise<void>(resolve => server.close(() => resolve())); return value; }
  async function ready(url: string, child: OwnedClientProcess) {
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) { if (child.exitCode !== null || child.signalCode !== null) throw new Error('Owned N5 app stopped before readiness'); try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* bounded local startup */ } await new Promise(resolve => setTimeout(resolve, 150)); }
    throw new Error('Owned N5 app startup timed out');
  }
  const identityPort = await port(), merchantPort = await port(), identityOrigin = `http://localhost:${identityPort}`, origin = `http://localhost:${merchantPort}`;
  let proxy: Awaited<ReturnType<typeof startOwnedPooledSqlProxy>> | undefined;
  let gateway: NativeGateway | undefined;
  let primaryFailure: { error: unknown } | undefined;
  let bridge: Server | undefined, identity: OwnedClientProcess | undefined, merchant: OwnedClientProcess | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const pages: Page[] = [], errors: string[] = [], calls: { path: string; status: number; key: string | null }[] = [], diagnostics: string[] = [];
  const scriptFailures: unknown[] = [];
  const scriptNetwork: unknown[] = [];
  let outage = false, lose = false;
  const evidence = `${ownedTmpDir()}/letbuyy-n5-intake-browser-${owned.runId}-${randomUUID().slice(0, 8)}`; mkdirSync(evidence, { recursive: true });
  try {
    proxy = await startOwnedPooledSqlProxy(owned);
    const keys = await newIdentityKeys();
    gateway = await NativeGateway.create(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin, ...proxy.env(), REEL_CUSTODY_PROFILE: JSON.stringify(syntheticProfile) }) as unknown as Record<string,unknown>);
    const activeGateway = gateway;
    bridge = createServer(async (req, res) => {
      const headers = new Headers();
      for (const [name,value] of Object.entries(req.headers)) if(typeof value==='string' && !['host','connection','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
      const iterator=req[Symbol.asyncIterator](), aborted=new AbortController();req.on('aborted',()=>aborted.abort());
      const body = ['GET','HEAD'].includes(req.method || 'GET') ? undefined : new ReadableStream<Uint8Array>({
        async pull(controller) { try { const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(new Uint8Array(next.value)); } catch(error) { controller.error(error); } },
        cancel() { req.destroy(); },
      });
      try {
        const path = (req.url ?? '/').split('?')[0];
        if (outage && req.method === 'GET' && path === '/v1/reels') { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_REEL_READ_OUTAGE', message: 'Synthetic private read outage. Retry loading.' } })); return; }
        const result = await activeGateway.request(req.url ?? '/', { method: req.method, headers, ...(body ? { body, duplex: 'half', signal: aborted.signal } : {}) });
        calls.push({ path, status: result.status, key: headers.get('X-Idempotency-Key') });
        if (lose && req.method === 'PUT' && /^\/v1\/reels\/uploads\/[a-f0-9-]{36}\/content$/.test(path) && result.status === 200) { lose = false; res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_COMMITTED_REPLY_LOSS', message: 'The save outcome is unknown. Retry the same request.' } })); return; }
        res.writeHead(result.status, Object.fromEntries(result.headers.entries())); res.end(result.text);
      } catch { res.writeHead(500); res.end('{}'); }
    });
    await new Promise<void>(resolve => bridge!.listen(0, '127.0.0.1', resolve)); const api = `http://127.0.0.1:${(bridge.address() as { port: number }).port}/v1`;
    const shared = { INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: origin };
    identity = startOwnedClientRuntime(owned, 'identity-next', { port: identityPort, env: { ...shared, LETBUYY_API_URL: api, LETBUYY_IDENTITY_ISSUER: identityOrigin,
      LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }), ACCOUNTS_COOKIE_SECRET: randomUUID() + randomUUID(), COOKIE_DOMAIN: '',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } });
    merchant = startOwnedClientRuntime(owned, 'merchant-next', { port: merchantPort, env: { ...shared, LETBUYY_API_BASE_URL: api } });
    for (const app of [identity, merchant]) for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { diagnostics.push(data.toString().replace(/\?[^\s]+/g, '?redacted').slice(0, 700)); if (diagnostics.length > 20) diagnostics.shift(); });
    await Promise.all([ready(identityOrigin + '/login', identity), ready(origin, merchant)]);
    browser = await chromium.launch({ headless: true });
    await run({ origin, evidence, readOutage: value => { outage = value; }, loseReply: () => { lose = true; }, privateOriginalState: async key => { const bucket=await activeGateway.mf.getR2Bucket('REEL_ORIGINALS_BUCKET'), head=await bucket.head(key);return {count:(await bucket.list({prefix:key})).objects.filter(object=>object.key===key).length,version:head?.version ?? null}; }, login: async (email, password, subdomain) => {
      const context = await browser!.newContext(), page = await context.newPage(); pages.push(page); page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(90000); page.on('pageerror', error => errors.push((error.stack || error.message).replace(/\?[^\s]+/g, '?redacted').slice(0, 2000)));
      const cdp = await context.newCDPSession(page); await cdp.send('Runtime.enable'); await cdp.send('Debugger.enable');
      await cdp.send('Network.enable');
      const layoutRequests = new Map<string, { path: string; decodedBytes: number }>();
      cdp.on('Network.requestWillBeSent', value => {
        const path = new URL(value.request.url).pathname;
        if (path === '/_next/static/chunks/app/layout.js') { layoutRequests.set(value.requestId, { path, decodedBytes: 0 }); scriptNetwork.push({ kind: 'request', requestId: value.requestId, path, timestamp: value.timestamp }); }
      });
      cdp.on('Network.responseReceived', value => {
        if (!layoutRequests.has(value.requestId)) return;
        const headers = Object.fromEntries(Object.entries(value.response.headers).filter(([name]) => /^(content-length|content-encoding|transfer-encoding|content-type)$/i.test(name)));
        scriptNetwork.push({ kind: 'response', requestId: value.requestId, status: value.response.status, headers, timestamp: value.timestamp });
      });
      cdp.on('Network.dataReceived', value => { const request = layoutRequests.get(value.requestId); if (request) request.decodedBytes += value.dataLength; });
      cdp.on('Network.loadingFinished', value => { const request = layoutRequests.get(value.requestId); if (request) scriptNetwork.push({ kind: 'finished', requestId: value.requestId, decodedBytes: request.decodedBytes, encodedBytes: value.encodedDataLength, timestamp: value.timestamp }); });
      cdp.on('Network.loadingFailed', value => { const request = layoutRequests.get(value.requestId); if (request) scriptNetwork.push({ kind: 'failed', requestId: value.requestId, decodedBytes: request.decodedBytes, canceled: value.canceled, error: value.errorText, timestamp: value.timestamp }); });
      page.on('console', message => { if (message.type() === 'error') scriptNetwork.push({ kind: 'browser-error', message: message.text().replace(/\?[^\s]+/g, '?redacted').slice(0, 1000) }); });
      cdp.on('Runtime.exceptionThrown', value => { const d = value.exceptionDetails; scriptFailures.push({ kind: 'uncaught', text: d.text, url: d.url, line: d.lineNumber, column: d.columnNumber, description: d.exception?.description, stack: d.stackTrace }); });
      cdp.on('Debugger.scriptFailedToParse', value => {
        if (scriptFailures.length >= 8) return;
        const file = evidence + '/failed-script-' + String(value.scriptId).replace(/[^a-z0-9_-]/gi, '') + '.js';
        scriptFailures.push({ kind: 'script-parse', url: value.url, line: value.startLine, column: value.startColumn, file });
        void cdp.send('Debugger.getScriptSource', { scriptId: value.scriptId }).then(result => writeFileSync(file, result.scriptSource)).catch(() => undefined);
      });
      await page.goto(identityOrigin + '/login?return_to=' + encodeURIComponent(origin + '/' + subdomain + '/content/reels')); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByRole('button', { name: 'Continue with email', exact: true }).click(); await page.getByLabel('Password', { exact: true }).fill(password);
      const [response] = await Promise.all([page.waitForResponse(reply => reply.url().endsWith('/api/auth/login') && reply.request().method() === 'POST'), page.getByRole('button', { name: 'Log in', exact: true }).click()]); assert.equal(response.status(), 200, 'Actual password/session sign-in must succeed'); await page.waitForURL(url => url.origin === origin);
      // As in the canonical Console fixture, finish the journey route's dev
      // compilation before browser navigation. A cold webpack response has
      // repeatedly ended mid-layout.js (HTTP200/gzip, no canceled request).
      // These are real authenticated read-only requests, not an auth bypass,
      // browser reload/retry or a substitute for any mounted workflow assertion.
      const store = new URL(page.url()).pathname.split('/')[1]; assert.ok(store);
      const warmPath = '/' + store + '/content/reels';
      const compiledRoute = await context.request.get(origin + warmPath, { timeout: 120000 }); assert.equal(compiledRoute.status(), 200);
      const compiledLayout = await context.request.get(origin + '/_next/static/chunks/app/layout.js', { timeout: 120000 }); assert.equal(compiledLayout.status(), 200);
      const layoutSource = await compiledLayout.text(); new Script(layoutSource);
      scriptNetwork.push({ kind: 'compiler-readiness', path: warmPath, routeStatus: compiledRoute.status(), layoutStatus: compiledLayout.status(), layoutBytes: Buffer.byteLength(layoutSource), completeOuterParse: true });
      return { context, page };
    } });
    assert.deepEqual(errors, [], 'no uncaught errors in the mounted merchant workflow');
    writeFileSync(evidence + '/result.json.tmp', JSON.stringify({ runId: owned.runId, localPasswordSignIns: pages.length, botChallenge: 'official always-pass Turnstile test keys; both development auth bypass flags false; actual widget and server Siteverify transport required; no production antibot proof', clientRuntimeMode: 'owned identity-next and merchant-next development runtimes', providerCustody: false, scriptNetwork, calls: calls.filter(call => call.path.startsWith('/v1/reels')) }, null, 2) + '\n'); renameSync(evidence + '/result.json.tmp', evidence + '/result.json');
    console.info('OWNED_N5_MERCHANT_REEL_BROWSER ' + JSON.stringify({ runId: owned.runId, evidence, localPasswordSignIns: pages.length, providerCustody: false }));
  } catch (error) {
    primaryFailure = { error };
    console.info('OWNED_N5_REEL_BROWSER_FAILURE ' + JSON.stringify({ calls: calls.slice(-20), errors, scriptFailures, scriptNetwork, diagnostics, pages: await Promise.all(pages.map(async page => ({ path: new URL(page.url()).pathname, visible: await page.locator('body').innerText().catch(() => '') }))) }));
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: evidence + `/failure-${i}.png`, fullPage: true }).catch(() => undefined);
    throw error;
  } finally {
    const failures: unknown[] = [];
    const cleanup = async (resource: string, dispose: () => Promise<unknown>) => {
      try { await dispose(); }
      catch(error) { failures.push(new Error('Owned N5 cleanup failed: '+resource,{cause:error})); }
    };
    await cleanup('Chromium',async()=>{await browser?.close();});
    // Attempt both process stops even if either fails; each helper tracks its
    // own process group. No name-based/global process cleanup is introduced.
    await Promise.all([
      cleanup('merchant Next process',async()=>{await stopOwnedClientRuntime(merchant);}),
      cleanup('Identity Next process',async()=>{await stopOwnedClientRuntime(identity);}),
    ]);
    await cleanup('HTTP bridge',async()=>{
      if(bridge){bridge.closeAllConnections();if(bridge.listening)await new Promise<void>((resolve,reject)=>bridge!.close(error=>error?reject(error):resolve()));}
    });
    await cleanup('native Gateway',async()=>{await gateway?.settle();});
    await cleanup('owned SQL proxy',async()=>{await proxy?.stop();});
    if(failures.length)throw new AggregateError([...(primaryFailure?[primaryFailure.error]:[]),...failures],'Owned N5 browser cleanup failed; all acquired resource stops were attempted');
  }
}
