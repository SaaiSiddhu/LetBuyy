// Real production worker/auth/wiring/RPC/PostgREST/owned PostgreSQL proof.
// Provider HTTP is controlled locally; this is not actual-provider acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { Gateway, buyerHeaders, gatewayEnv, newIdentityKeys, seedBuyerAccount, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
const owned = requireOwnedDatabase();
const route = '/v1/storefront/buyer/assistant';
const endpoint = 'https://buyer-ai-owned.invalid/chat/completions';
const privateMarker = 'N8_SYNTHETIC_PRIVATE_CONTENT';
const profile = { approved: true, purpose: 'buyer_shopping_public', content_scope: 'submitted_message_and_visible_chat', provider: 'openai_compatible', id: 'synthetic-owned', endpoint, model: 'synthetic-no-live-model', requests_per_day: 2, token_bound_per_day: 100000, max_input_bytes: 8000, max_output_tokens: 50, timeout_ms: 20000, input_token_bound_per_byte: 1, input_framing_token_bound: 1000 };
const gateways: Gateway[] = []; const originalFetch = globalThis.fetch;
afterEach(async () => { await Promise.all(gateways.splice(0).map(g => g.settle())); globalThis.fetch = originalFetch; });
const request = () => ({ request_id: crypto.randomUUID(), conversation_id: crypto.randomUUID(), prompt: privateMarker, history: [] });
async function fixture(label: string, override: Record<string, unknown> = {}) {
 const keys = await newIdentityKeys(); const a = seedBuyerAccount(owned.psql, `n8-${label}-a`); const b = seedBuyerAccount(owned.psql, `n8-${label}-b`);
 const gateway = new Gateway(gatewayEnv(owned, keys, { BUYER_AI_ENABLED: 'true', BUYER_AI_PROFILE: JSON.stringify(profile), BUYER_AI_API_KEY: 'synthetic-not-a-credential', BUYER_AI_FINGERPRINT_KEY: 'synthetic-fingerprint-key-at-least-32-characters', ...override })); gateways.push(gateway);
 const headers = await buyerHeaders(keys, a.id, { epoch: 1 }); const headersB = await buyerHeaders(keys, b.id, { epoch: 1 });
 let calls = 0; let release: (() => void) | undefined; let entered: (() => void) | undefined; let fail = false;
 let gate: Promise<void> | undefined;
 globalThis.fetch = (async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(`${owned.restUrl}/rest/v1/`)) return originalFetch(input, init);
  assert.equal(url, endpoint, 'No unowned/external request is permitted'); calls++; entered?.(); await gate;
  if (fail) throw new Error(privateMarker);
  const body = JSON.parse(init!.body as string); assert.equal(body.tools, undefined);
  assert.equal(body.messages.at(-1).content, privateMarker);
  assert.equal(body.messages.length, 2, 'No hidden profile/orders/support context');
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: privateMarker } }], usage: { prompt_tokens: 20, completion_tokens: 5 } }));
 }) as typeof fetch;
 return { a, b, gateway, keys, headers, headersB, calls: () => calls, fail: () => { fail = true; },
  hold: () => { const started = new Promise<void>(r => { entered = r; }); gate = new Promise<void>(r => { release = r; }); return { started, release: () => release!() }; },
  post: (body: object, credential = headers) => gateway.request(route, { method: 'POST', headers: { ...credential, 'X-Idempotency-Key': (body as {request_id?: string}).request_id ?? 'synthetic-invalid' }, body: JSON.stringify(body) }),
 };
}
function totals(buyer: string) { return JSON.parse(owned.psql(`SELECT json_build_object('requests',coalesce(sum(requests_reserved),0),'tokens',coalesce(sum(tokens_reserved),0)) FROM buyer_ai_daily_quotas WHERE buyer_account_id='${buyer}';`)); }
function state(buyer: string, id: string) { return owned.psql(`SELECT state FROM buyer_ai_operations WHERE buyer_account_id='${buyer}' AND request_id='${id}';`).trim(); }
function reserve(buyer: string, id: string, conversation: string, cap = 2, tokenCap = 1000, tokens = 100) {
 return `SELECT reserve_buyer_ai_request('${buyer}',1,'${conversation}','${id}','${'a'.repeat(64)}','synthetic',${cap},${tokenCap},${tokens})->>'status';`;
}

//350 AFTER retirement proof. Isolated retained-family/drift setups abort;
//natural writers retain their legitimate committed effects. Original first13
//test bodies and the final fresh-buyer completion/replay obligations remain.
function withoutOuterTransaction(sql: string) {
 assert.equal((sql.match(/^BEGIN;$/gm) || []).length, 1);
 assert.equal((sql.match(/^COMMIT;$/gm) || []).length, 1);
 return sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
}
const protectedOwnedTables = ['buyer_accounts', 'ad_credit_accounts', 'ad_campaigns',
 'ad_credit_ledger_entries', 'billing_history', 'ledger_accounts', 'ledger_transactions',
 'ledger_entries', 'orders', 'order_items', 'loyalty_accounts', 'loyalty_ledger_entries',
 'idempotency_keys'] as const;
function completeAiRetentionSnapshot() {
 const protectedRows = protectedOwnedTables.map(table =>
  `'${table}',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM public.${table} r)`).join(',');
 return owned.psql(`WITH relations AS (
   SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ('buyer_ai_daily_quotas','buyer_ai_operations')
  ), functions AS (
   SELECT p.* FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('reserve_buyer_ai_request','transition_buyer_ai_request')
  ) SELECT jsonb_build_object(
   'relations',(SELECT jsonb_agg(jsonb_build_object('oid',r.oid,'namespace',r.relnamespace,
     'name',r.relname,'owner',r.relowner,'acl',r.relacl,'kind',r.relkind,'persistence',r.relpersistence,
     'row_security',r.relrowsecurity,'force_row_security',r.relforcerowsecurity,
     'replica_identity',r.relreplident,'partition',r.relispartition,'partition_bound',r.relpartbound::text)
     ORDER BY r.oid) FROM relations r),
   'columns',(SELECT jsonb_agg(jsonb_build_object('catalog',to_jsonb(a),'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid))
     ORDER BY a.attrelid,a.attnum) FROM pg_catalog.pg_attribute a
     LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
     WHERE a.attrelid IN(SELECT oid FROM relations) AND a.attnum>0),
   'constraints',(SELECT jsonb_agg(jsonb_build_object('catalog',to_jsonb(c),'definition',pg_catalog.pg_get_constraintdef(c.oid))
     ORDER BY c.oid) FROM pg_catalog.pg_constraint c WHERE c.conrelid IN(SELECT oid FROM relations) OR c.confrelid IN(SELECT oid FROM relations)),
   'indexes',(SELECT jsonb_agg(jsonb_build_object('catalog',to_jsonb(i),'definition',pg_catalog.pg_get_indexdef(i.indexrelid),
     'owner',c.relowner,'acl',c.relacl) ORDER BY i.indexrelid) FROM pg_catalog.pg_index i
     JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid WHERE i.indrelid IN(SELECT oid FROM relations)),
   'policies',(SELECT jsonb_agg(jsonb_build_object('catalog',to_jsonb(p),
     'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))
     ORDER BY p.oid) FROM pg_catalog.pg_policy p WHERE p.polrelid IN(SELECT oid FROM relations)),
   'triggers',(SELECT jsonb_agg(jsonb_build_object('catalog',to_jsonb(t),'definition',pg_catalog.pg_get_triggerdef(t.oid))
     ORDER BY t.oid) FROM pg_catalog.pg_trigger t WHERE t.tgrelid IN(SELECT oid FROM relations) OR t.tgconstrrelid IN(SELECT oid FROM relations)),
   'functions',(SELECT jsonb_agg(jsonb_build_object('catalog',to_jsonb(p),'definition',pg_catalog.pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM functions p),
   'dependencies',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype)
     FROM pg_catalog.pg_depend d WHERE d.objid IN(SELECT oid FROM relations UNION ALL SELECT oid FROM functions)
       OR d.refobjid IN(SELECT oid FROM relations UNION ALL SELECT oid FROM functions)),
   'effective_table_access',(SELECT jsonb_agg(jsonb_build_object('role',roles.name,'relation',r.relname,
     'select',pg_catalog.has_table_privilege(roles.name,r.oid,'SELECT'),'insert',pg_catalog.has_table_privilege(roles.name,r.oid,'INSERT'),
     'update',pg_catalog.has_table_privilege(roles.name,r.oid,'UPDATE'),'delete',pg_catalog.has_table_privilege(roles.name,r.oid,'DELETE'))
     ORDER BY roles.name,r.oid) FROM relations r CROSS JOIN (VALUES('anon'),('authenticated'),('app_tenant'),('service_role')) roles(name)),
   'effective_function_access',(SELECT jsonb_agg(jsonb_build_object('role',roles.name,'function',p.oid,
     'execute',pg_catalog.has_function_privilege(roles.name,p.oid,'EXECUTE'),
     'grant_option',pg_catalog.has_function_privilege(roles.name,p.oid,'EXECUTE WITH GRANT OPTION')) ORDER BY roles.name,p.oid)
     FROM functions p CROSS JOIN (VALUES('anon'),('authenticated'),('app_tenant'),('service_role')) roles(name)),
   'daily_quotas',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY buyer_account_id,quota_day),'[]'::jsonb) FROM public.buyer_ai_daily_quotas q),
   'operations',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY buyer_account_id,request_id),'[]'::jsonb) FROM public.buyer_ai_operations q),
   'protected_owned_rows',jsonb_build_object(${protectedRows}));`).trim();
}


const rollback350 = readFileSync(new URL('../../../../../database/supabase/rollback/350_buyer_ai_request_quotas.rollback.sql', import.meta.url), 'utf8');
const forward350 = readFileSync(new URL('../../../../../database/supabase/migrations/350_buyer_ai_request_quotas.sql', import.meta.url), 'utf8');
const reserve350Signature = 'public.reserve_buyer_ai_request(uuid,bigint,uuid,uuid,text,text,integer,bigint,integer)';
const transition350Signature = 'public.transition_buyer_ai_request(uuid,bigint,uuid,text,text)';
const q350 = (value: string) => `'${value.replaceAll("'", "''")}'`;
function retained350Refusal(setup: string, expected: RegExp = /350 refuses retained/) {
 const before = completeAiRetentionSnapshot();
 const error = owned.psqlExpectError(`BEGIN; ${setup}\n${withoutOuterTransaction(rollback350)}\nROLLBACK;`);
 assert.match(error, expected);
 assert.equal(completeAiRetentionSnapshot(), before, 'Aborted refusal conserves exact schema, all rows and privileges');
}
async function waitFor350Sql(sql: string, message: string) {
 const deadline = Date.now() + 15000;
 while (Date.now() < deadline) {
  if (owned.psql(sql).trim() === 't') return;
  await new Promise(resolve => setTimeout(resolve, 25));
 }
 assert.fail(message);
}
function protected350Rows(snapshot = completeAiRetentionSnapshot()) {
 return JSON.stringify(JSON.parse(snapshot).protected_owned_rows);
}
function schema350(snapshot = completeAiRetentionSnapshot()) {
 const value = JSON.parse(snapshot); delete value.operations; delete value.daily_quotas; delete value.protected_owned_rows;
 return JSON.stringify(value);
}
function isolated350Operation(buyer: string, state: string) {
 return `INSERT INTO public.buyer_ai_operations(buyer_account_id,request_id,conversation_id,
  session_epoch,payload_hash,profile_id,reserved_tokens,state)
  VALUES(${q350(buyer)}::uuid,'${crypto.randomUUID()}','${crypto.randomUUID()}',1,
   '${'b'.repeat(64)}','synthetic-independent-retained-family',100,${q350(state)});`;
}

test('350 refuses a real prepared canonical reservation before any blocking relation lock and conserves full outside state', async () => {
 assert.equal(owned.psql("SELECT current_setting('max_prepared_transactions');"),'2',
  'Mandatory real PREPARE requires the separately reviewed owned startup opt-in; no skip or default-disabled substitute');
 assert.equal(owned.psql('SELECT count(*) FROM pg_catalog.pg_prepared_xacts;'),'0','Fresh owned cluster has no pre-existing prepared transactions');
 const f=await fixture('prepared'); const before=completeAiRetentionSnapshot();
 assert.match(owned.runId,/^[a-f0-9]{12}$/); assert.match(owned.database,/^letbuyy_exec_[a-z0-9_]+$/);
 const prefix='n8-ai350:'+owned.runId+':'+owned.database+':';
 const gid=prefix+crypto.randomUUID(); assert.ok(Buffer.byteLength(gid,'utf8')<200);
 const preparedRow=()=>owned.psql(`SELECT coalesce((SELECT jsonb_build_object(
  'gid',gid,'transaction',transaction::text,'prepared',prepared::text,'database',database::text,'owner',owner::text)::text
  FROM pg_catalog.pg_prepared_xacts WHERE gid=${q350(gid)} AND database=current_database() AND owner=current_user),'');`);
 let error=''; let during='';
 try {
  const reserved=owned.script(`BEGIN; SET LOCAL statement_timeout='2000ms'; SET LOCAL ROLE service_role;
   ${reserve(f.a.id,crypto.randomUUID(),crypto.randomUUID())} RESET ROLE; PREPARE TRANSACTION ${q350(gid)};`);
  assert.equal(reserved,'reserved','Prepare actual canonical reservation effects through the real service_role RPC');
  during=preparedRow(); assert.ok(during,'Exact GID/database/owner prepared row must exist before the guard');
  assert.equal(owned.psql('SELECT count(*) FROM pg_catalog.pg_prepared_xacts;'),'1');
  const held=owned.psql(`SELECT count(DISTINCT relation) FROM pg_catalog.pg_locks WHERE pid IS NULL AND granted
   AND locktype='relation' AND mode IN('RowShareLock','RowExclusiveLock')
   AND relation IN('public.buyer_accounts'::regclass,'public.buyer_ai_operations'::regclass,'public.buyer_ai_daily_quotas'::regclass);`);
  assert.equal(held,'3','The real prepared reservation retains each canonical admission/operation/quota relation lock');
  assert.equal(completeAiRetentionSnapshot(),before,'Prepared effects stay invisible and all committed schema/data/ACL remain unchanged');
  error=owned.psqlExpectError(`SET statement_timeout='2000ms'; ${rollback350}`);
  console.info('N8_AI350_PREPARED_REFUSAL',JSON.stringify({gid,database:owned.database,
   prepared:JSON.parse(during),error,prepared_after:preparedRow(),held_relation_locks:Number(held)}));
  assert.equal(preparedRow(),during,'Guard must not commit, cancel or replace the prepared transaction');
  assert.equal(completeAiRetentionSnapshot(),before,'Refused guard conserves full committed schema, quotas, receipts and protected rows');
 } finally {
  // Only this exact GID in this verified run/database and owner may be cleaned.
  // Never COMMIT a test reservation or sweep another transaction's GID.
  const row=preparedRow();
  if(row) {
   const metadata=JSON.parse(row); assert.equal(metadata.gid,gid); assert.equal(metadata.database,owned.database);
   assert.equal(metadata.owner,owned.psql('SELECT current_user;'));
   owned.script(`ROLLBACK PREPARED ${q350(gid)};`);
  }
  assert.equal(preparedRow(),'','Exact prepared GID cleanup completed');
  assert.equal(owned.psql(`SELECT count(*) FROM pg_catalog.pg_prepared_xacts
   WHERE database=current_database() AND owner=current_user AND left(gid,${prefix.length})=${q350(prefix)};`),'0');
  assert.equal(completeAiRetentionSnapshot(),before,'Prepared rollback conserves every committed outside row and full installed profile');
  assert.equal(f.calls(),0,'No provider dispatch while preparing or refusing retirement');
 }
 assert.doesNotMatch(error,/statement timeout|lock timeout|canceling statement|prepared transactions are disabled/i,
  'Timeout/configuration rejection is failure, never evidence of the intended prepared refusal');
 assert.match(error,new RegExp('rollback350 refuses concurrent/prepared writes or non-read-committed state'));
});

test('350 revalidates a canonical writer that prepares after retirement entered actual relation contention', async () => {
 assert.equal(owned.psql("SELECT current_setting('max_prepared_transactions');"),'2');
 assert.equal(owned.psql('SELECT count(*) FROM pg_catalog.pg_prepared_xacts;'),'0');
 const f=await fixture('late-prepared'); const before=completeAiRetentionSnapshot();
 const prefix='n8-ai350-late:'+owned.runId+':'+owned.database+':';
 const gid=prefix+crypto.randomUUID(); assert.ok(Buffer.byteLength(gid,'utf8')<200);
 const suffix=crypto.randomUUID().slice(0,8),writerName='n8-ai350-preparing-'+suffix,guardName='n8-ai350-late-retire-'+suffix;
 const preparedRow=()=>owned.psql(`SELECT coalesce((SELECT jsonb_build_object('gid',gid,'owner',owner::text,
  'database',database::text,'prepared',prepared::text,'transaction',transaction::text)::text
  FROM pg_catalog.pg_prepared_xacts WHERE gid=${q350(gid)} AND database=current_database() AND owner=current_user),'');`);
 const writer=owned.psqlAsync(`SET application_name=${q350(writerName)}; BEGIN; SET LOCAL ROLE service_role;
  ${reserve(f.a.id,crypto.randomUUID(),crypto.randomUUID())} SELECT pg_sleep(3); RESET ROLE; PREPARE TRANSACTION ${q350(gid)};`);
 let retirement:Promise<string>|undefined,error='';
 try {
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(writerName)} AND a.wait_event='PgSleep' AND l.granted
   AND l.relation='public.buyer_ai_operations'::regclass AND l.mode='RowExclusiveLock');`,'Actual canonical writer did not retain its operation lock');
  assert.equal(owned.psql('SELECT count(*) FROM pg_catalog.pg_prepared_xacts;'),'0','No PREPARE before retirement starts');
  retirement=owned.psqlAsync(`SET application_name=${q350(guardName)}; SET statement_timeout='6000ms'; ${rollback350}`).then(()=>'',e=>String(e.message));
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(guardName)} AND l.relation='public.buyer_accounts'::regclass
   AND l.mode='AccessExclusiveLock' AND NOT l.granted)
   AND EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${q350(writerName)} AND wait_event='PgSleep')
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts);`,'Retirement must actually wait after its early prepared check and before the real writer prepares');
  assert.match(await writer,/\breserved\b/,'Real canonical reserve succeeded before PREPARE');
  const prepared=preparedRow(); assert.ok(prepared); assert.equal(JSON.parse(prepared).owner,owned.psql('SELECT current_user;'));
  assert.equal(owned.psql(`SELECT count(DISTINCT relation) FROM pg_catalog.pg_locks WHERE pid IS NULL AND granted
   AND mode IN('RowShareLock','RowExclusiveLock') AND relation IN('public.buyer_accounts'::regclass,
    'public.buyer_ai_daily_quotas'::regclass,'public.buyer_ai_operations'::regclass);`),'3');
  error=await retirement;
  assert.equal(preparedRow(),prepared,'Bounded retirement never resolves or replaces the prepared write');
  assert.equal(completeAiRetentionSnapshot(),before);
  console.info('N8_AI350_LATER_PREPARED',JSON.stringify({gid,database:owned.database,observed_wait_before_prepare:true,
   prepared:JSON.parse(prepared),prepared_after:preparedRow(),error}));
 } finally {
  await Promise.allSettled([writer,retirement]);
  const prepared=preparedRow();
  if(prepared) {
   const metadata=JSON.parse(prepared);assert.equal(metadata.gid,gid);assert.equal(metadata.database,owned.database);
   assert.equal(metadata.owner,owned.psql('SELECT current_user;'));owned.script(`ROLLBACK PREPARED ${q350(gid)};`);
  }
  assert.equal(preparedRow(),'');
  assert.equal(owned.psql(`SELECT count(*) FROM pg_catalog.pg_prepared_xacts WHERE database=current_database()
   AND owner=current_user AND left(gid,${prefix.length})=${q350(prefix)};`),'0');
  assert.equal(completeAiRetentionSnapshot(),before);assert.equal(f.calls(),0);
 }
 assert.doesNotMatch(error,/statement timeout|lock timeout|canceling statement|deadline exceeded|prepared transactions are disabled/i,
  'A timeout/deadline is an error, never the later-prepared refusal certificate');
 assert.match(error,new RegExp('rollback350 refuses concurrent/prepared writes or non-read-committed state'));
});

test('350 lock acquisition deadline is a distinct bounded error with exact outside conservation', async () => {
 const before=completeAiRetentionSnapshot(); const suffix=crypto.randomUUID().slice(0,8);
 const readerName='n8-ai350-deadline-reader-'+suffix,guardName='n8-ai350-deadline-guard-'+suffix;
 assert.equal(owned.psql('SELECT count(*) FROM pg_catalog.pg_prepared_xacts;'),'0');
 const reader=owned.psqlAsync(`SET application_name=${q350(readerName)}; BEGIN;
  SELECT count(*) FROM public.buyer_ai_daily_quotas; SELECT pg_sleep(12); COMMIT;`);
 let retirement:Promise<string>|undefined,error='';const started=Date.now();
 try {
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(readerName)} AND a.wait_event='PgSleep' AND l.granted
   AND l.relation='public.buyer_ai_daily_quotas'::regclass AND l.mode='AccessShareLock');`,'Actual reader did not retain the quota relation');
  retirement=owned.psqlAsync(`SET application_name=${q350(guardName)}; SET statement_timeout='12000ms'; ${rollback350}`).then(()=>'',e=>String(e.message));
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(guardName)} AND l.relation='public.buyer_accounts'::regclass
   AND l.mode='AccessExclusiveLock' AND l.granted)
   AND EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(guardName)} AND l.relation='public.buyer_ai_daily_quotas'::regclass
   AND l.mode='AccessExclusiveLock' AND NOT l.granted);`,'Earlier successful admission lock must remain owned during bounded quota waits');
  error=await retirement;
  assert.ok(Date.now()-started<16000,'Guard acquisition has a finite operational budget');
  assert.match(error,/rollback350 lock acquisition deadline exceeded/);
  assert.doesNotMatch(error,/rollback350 refuses|statement timeout|canceling statement/,'Deadline is not genuine precondition refusal');
  assert.equal(owned.psql('SELECT count(*) FROM pg_catalog.pg_prepared_xacts;'),'0');
  console.info('N8_AI350_LOCK_DEADLINE',JSON.stringify({error,elapsed_ms:Date.now()-started,prepared_count:0}));
 } finally {await Promise.allSettled([reader,retirement]);}
 assert.equal(completeAiRetentionSnapshot(),before);
});


// These cases run while both AI families are empty, before the retained13
// original tests create their independent buyers/operations. Each isolated
// family or drift is entirely aborted, retaining every previously owned row.
test('350 empty clean retirement/reapply keeps protected owned rows and restores fail-closed roles', async () => {
 assert.equal(owned.psql('SELECT count(*) FROM buyer_ai_operations;'), '0');
 assert.equal(owned.psql('SELECT count(*) FROM buyer_ai_daily_quotas;'), '0');
 const protectedBefore = protected350Rows();
 owned.script(rollback350);
 assert.equal(owned.psql("SELECT to_regclass('public.buyer_ai_operations') IS NULL AND to_regclass('public.buyer_ai_daily_quotas') IS NULL;"), 't');
 assert.equal(owned.psql(`SELECT to_regprocedure('${reserve350Signature}') IS NULL AND to_regprocedure('${transition350Signature}') IS NULL;`), 't');
 owned.script(forward350);
 assert.equal(protected350Rows(), protectedBefore);
 const f = await fixture('empty-reapply'); const id = crypto.randomUUID();
 const before = completeAiRetentionSnapshot();
 const result = owned.script(`BEGIN; SET LOCAL ROLE service_role; ${reserve(f.a.id,id,crypto.randomUUID())} ROLLBACK;`);
 assert.equal(result.trim(), 'reserved');
 assert.equal(completeAiRetentionSnapshot(), before);
 for (const role of ['anon','authenticated','app_tenant'])
  assert.match(owned.psqlExpectError(`SET ROLE ${role};${reserve(f.a.id,crypto.randomUUID(),crypto.randomUUID())}`), /permission denied/);
 assert.equal(f.calls(), 0);
});
for (const retainedState of ['reserved','dispatched','completed','outcome_unknown']) {
 test(`350 refuses operation-only ${retainedState} receipts with exact outside conservation`, async () => {
  const f = await fixture('op-' + retainedState.replaceAll('_','-'));
  retained350Refusal(isolated350Operation(f.a.id, retainedState));
  assert.equal(f.calls(), 0);
 });
}
for (const [label,requests,tokens,day] of [['zero',0,0,0],['reserved',1,100,0],['historical-zero',0,0,1],['historical-reserved',1,100,1]] as const) {
 test(`350 refuses quota-only ${label} row without choosing an erasure/reset policy`, async () => {
  const f = await fixture('q-' + label.replace('historical','hist'));
  retained350Refusal(`INSERT INTO buyer_ai_daily_quotas VALUES('${f.a.id}',current_date-${day},${requests},${tokens});`);
  assert.equal(f.calls(), 0);
 });
}
test('350 refuses both retained families and preserves the canonical reservation', async () => {
 const f = await fixture('retained-both');
 retained350Refusal(`SET LOCAL ROLE service_role; ${reserve(f.a.id,crypto.randomUUID(),crypto.randomUUID())} RESET ROLE;`);
 assert.equal(f.calls(), 0);
});

const current350FunctionDefinitions = ['reserve_buyer_ai_request','transition_buyer_ai_request'].map(name => {
 const definition = forward350.match(new RegExp('CREATE FUNCTION public\\.' + name + '[\\s\\S]*?\\n\\$\\$;'))?.[0];
 assert.ok(definition); return definition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
});
const drifts350 = [
 ['missing operation relation','DROP TABLE public.buyer_ai_operations;'],
 ['missing quota relation','DROP TABLE public.buyer_ai_daily_quotas;'],
 ['missing canonical function',`DROP FUNCTION ${reserve350Signature};`],
 ['unknown extra function overload',"CREATE FUNCTION public.reserve_buyer_ai_request(uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;"],
 ['changed input name',`DROP FUNCTION ${reserve350Signature}; ${current350FunctionDefinitions[0].replaceAll('p_profile_id','p_unreviewed_profile')}`],
 ['changed result ABI',`DROP FUNCTION ${transition350Signature}; CREATE FUNCTION ${transition350Signature} RETURNS text LANGUAGE sql AS $$ SELECT 'synthetic'::text $$;`],
 ['set returning ABI',`DROP FUNCTION ${transition350Signature}; CREATE FUNCTION ${transition350Signature} RETURNS SETOF boolean LANGUAGE sql AS $$ SELECT true $$;`],
 ['procedure kind',`DROP FUNCTION ${transition350Signature}; CREATE PROCEDURE ${transition350Signature} LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;`],
 ['changed defaults',current350FunctionDefinitions[1].replace('p_to_state text','p_to_state text DEFAULT NULL')],
 ['unknown newer body',current350FunctionDefinitions[1].replace('\n$$;', () => '\n-- synthetic unreviewed body\n$$;')],
 ['foreign function owner',`ALTER FUNCTION ${reserve350Signature} OWNER TO service_role;`],
 ['named Data API execute',`GRANT EXECUTE ON FUNCTION ${reserve350Signature} TO authenticated;`],
 ['backend grant option',`GRANT EXECUTE ON FUNCTION ${reserve350Signature} TO service_role WITH GRANT OPTION;`],
 ['missing backend execution',`REVOKE EXECUTE ON FUNCTION ${reserve350Signature} FROM service_role;`],
 ['changed definer',`ALTER FUNCTION ${reserve350Signature} SECURITY INVOKER;`],
 ['changed strict profile',`ALTER FUNCTION ${reserve350Signature} STRICT;`],
 ['changed cost',`ALTER FUNCTION ${reserve350Signature} COST 123;`],
 ['changed search path',`ALTER FUNCTION ${reserve350Signature} SET search_path=public,pg_temp;`],
 ['unknown operation column','ALTER TABLE buyer_ai_operations ADD COLUMN synthetic_drift text;'],
 ['renamed column','ALTER TABLE buyer_ai_operations RENAME COLUMN profile_id TO synthetic_profile;'],
 ['changed column type','ALTER TABLE buyer_ai_operations ALTER COLUMN profile_id TYPE varchar(80);'],
 ['changed timestamp default',"ALTER TABLE buyer_ai_operations ALTER COLUMN created_at SET DEFAULT '2000-01-01'::timestamptz;"],
 ['changed nullability','ALTER TABLE buyer_ai_operations ALTER COLUMN conversation_id DROP NOT NULL;'],
 ['missing state constraint','ALTER TABLE buyer_ai_operations DROP CONSTRAINT buyer_ai_operations_state_check;'],
 ['changed quota check','ALTER TABLE buyer_ai_daily_quotas DROP CONSTRAINT buyer_ai_daily_quotas_requests_reserved_check; ALTER TABLE buyer_ai_daily_quotas ADD CHECK(requests_reserved>=-1);'],
 ['missing primary key','ALTER TABLE buyer_ai_operations DROP CONSTRAINT buyer_ai_operations_pkey;'],
 ['changed foreign key','ALTER TABLE buyer_ai_operations DROP CONSTRAINT buyer_ai_operations_buyer_account_id_fkey; ALTER TABLE buyer_ai_operations ADD FOREIGN KEY(buyer_account_id) REFERENCES buyer_accounts(id) ON DELETE RESTRICT;'],
 ['foreign table owner','ALTER TABLE buyer_ai_operations OWNER TO service_role;'],
 ['named table access','GRANT SELECT ON buyer_ai_operations TO service_role;'],
 ['column access','GRANT SELECT(state) ON buyer_ai_operations TO authenticated;'],
 ['disabled RLS','ALTER TABLE buyer_ai_operations DISABLE ROW LEVEL SECURITY;'],
 ['unforced RLS','ALTER TABLE buyer_ai_daily_quotas NO FORCE ROW LEVEL SECURITY;'],
 ['changed policy','ALTER POLICY buyer_ai_operation_owner ON buyer_ai_operations USING(true);'],
 ['extra policy','CREATE POLICY n8_unreviewed_policy ON buyer_ai_operations USING(true);'],
 ['extra index','CREATE INDEX n8_unreviewed_index ON buyer_ai_operations(state);'],
 ['external reference','CREATE VIEW public.n8_ai350_unreviewed_view AS SELECT * FROM buyer_ai_operations;'],
 ['extra trigger',`CREATE FUNCTION public.n8_ai350_unreviewed_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
   CREATE TRIGGER n8_ai350_unreviewed_trigger BEFORE INSERT ON buyer_ai_operations FOR EACH ROW EXECUTE FUNCTION public.n8_ai350_unreviewed_trigger();`],
] as const;
for (const [label,drift] of drifts350) {
 test(`350 refuses ${label} before retirement and conserves exact outside state`, () => retained350Refusal(drift, /350 refuses/));
}
for (const isolation of ['repeatable read','serializable']) {
 test(`350 refuses ${isolation} catalog snapshots`, () => {
  const before = completeAiRetentionSnapshot();
  assert.match(owned.psqlExpectError(`BEGIN ISOLATION LEVEL ${isolation}; ${withoutOuterTransaction(rollback350)} ROLLBACK;`), /350 refuses/);
  assert.equal(completeAiRetentionSnapshot(), before);
 });
}

test('350 serializes natural external-view DDL and refuses the new dependency before dropping any function or table', async () => {
 const before = completeAiRetentionSnapshot();
 const suffix = crypto.randomUUID().replaceAll('-','').slice(0,12);
 const ddlName = 'n8-ai350-ddl-' + suffix, rollbackName = 'n8-ai350-retire-' + suffix;
 const view = 'n8_ai350_view_' + suffix;
 const ddl = owned.psqlAsync(`SET application_name=${q350(ddlName)}; BEGIN;
  CREATE VIEW public.${view} AS SELECT * FROM public.buyer_ai_operations; SELECT pg_sleep(3); COMMIT;`);
 let retirement: Promise<string> | undefined;
 try {
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(ddlName)} AND a.wait_event='PgSleep'
   AND l.relation='public.buyer_ai_operations'::regclass AND l.mode='AccessShareLock' AND l.granted);`, 'Natural view DDL did not retain its relation lock');
  retirement=owned.psqlAsync(`SET application_name=${q350(rollbackName)}; ${rollback350}`).then(()=>'',error=>String(error.message));
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(rollbackName)} AND l.mode IN('AccessExclusiveLock','ShareRowExclusiveLock') AND NOT l.granted);`, 'Rollback must wait behind actual catalog/relation DDL');
  await ddl; assert.match(await retirement,/350 refuses/);
  assert.equal(owned.psql(`SELECT to_regclass('public.${view}') IS NOT NULL;`),'t','Outside reference survives refused retirement');
 } finally {
  await Promise.allSettled([ddl,retirement]); owned.script(`DROP VIEW IF EXISTS public.${view};`);
 }
 assert.equal(completeAiRetentionSnapshot(),before);
});

test('350 retirement blocks a newly arriving canonical reservation through the empty-to-drop boundary', async () => {
 const f=await fixture('retirement-wins'); const protectedBefore=protected350Rows();
 const suffix=crypto.randomUUID().slice(0,8), readerName='n8-ai350-reader-'+suffix;
 const rollbackName='n8-ai350-winning-retire-'+suffix, writerName='n8-ai350-new-writer-'+suffix;
 const reader=owned.psqlAsync(`SET application_name=${q350(readerName)}; BEGIN;
  SELECT count(*) FROM public.buyer_ai_daily_quotas; SELECT pg_sleep(3); COMMIT;`);
 let retirement: Promise<string> | undefined, writer: Promise<string> | undefined;
 try {
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(readerName)} AND a.wait_event='PgSleep'
   AND l.relation='public.buyer_ai_daily_quotas'::regclass AND l.mode='AccessShareLock' AND l.granted);`, 'Actual quota reader did not retain its relation lock');
  retirement=owned.psqlAsync(`SET application_name=${q350(rollbackName)}; ${rollback350}`).then(()=>'',error=>String(error.message));
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(rollbackName)} AND l.relation='public.buyer_accounts'::regclass
   AND l.mode='AccessExclusiveLock' AND l.granted)
   AND EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(rollbackName)} AND l.relation='public.buyer_ai_daily_quotas'::regclass
   AND l.mode='AccessExclusiveLock' AND NOT l.granted);`, 'Retirement must own the admission relation while waiting for the actual quota reader');
  writer=owned.psqlAsync(`SET application_name=${q350(writerName)}; BEGIN; SET LOCAL ROLE service_role;
   ${reserve(f.a.id,crypto.randomUUID(),crypto.randomUUID())} COMMIT;`).then(()=>'',error=>String(error.message));
  await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
   WHERE a.application_name=${q350(writerName)} AND l.relation='public.buyer_accounts'::regclass
   AND l.mode IN('AccessShareLock','RowShareLock') AND NOT l.granted
   AND EXISTS(SELECT 1 FROM pg_stat_activity blocker WHERE blocker.pid=ANY(pg_blocking_pids(a.pid))
    AND blocker.application_name=${q350(rollbackName)}));`, 'New canonical admission must wait behind the retiring schema boundary');
  console.info('N8_AI350_ADMISSION_BLOCKER', owned.psql(`SELECT jsonb_agg(jsonb_build_object(
   'relation',c.relname,'mode',l.mode,'granted',l.granted,'wait_event',a.wait_event,
   'blocker',blocker.application_name) ORDER BY l.mode,blocker.application_name)
   FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid JOIN pg_class c ON c.oid=l.relation
   JOIN pg_stat_activity blocker ON blocker.pid=ANY(pg_blocking_pids(a.pid))
   WHERE a.application_name=${q350(writerName)} AND c.oid='public.buyer_accounts'::regclass
   AND NOT l.granted;`).trim());
  await reader; assert.equal(await retirement,'','Verified empty retirement may commit');
  assert.match(await writer,/does not exist|cache lookup failed|could not open relation/,'The arriving request cannot commit a new reservation through retirement');
  assert.equal(owned.psql("SELECT to_regclass('public.buyer_ai_operations') IS NULL AND to_regclass('public.buyer_ai_daily_quotas') IS NULL;"),'t');
 } finally {
  await Promise.allSettled([reader,retirement,writer]);
  if (owned.psql("SELECT to_regclass('public.buyer_ai_operations') IS NULL AND to_regclass('public.buyer_ai_daily_quotas') IS NULL;")==='t') owned.script(forward350);
 }
 assert.equal(owned.psql('SELECT count(*) FROM buyer_ai_operations;'),'0');
 assert.equal(owned.psql('SELECT count(*) FROM buyer_ai_daily_quotas;'),'0');
 assert.equal(protected350Rows(),protectedBefore);assert.equal(f.calls(),0);
});

test('350 waits behind actual canonical reserve and transition writers and retains every committed effect', async () => {
 const f=await fixture('natural-writers'); const id=crypto.randomUUID(), conversation=crypto.randomUUID();
 const protectedBefore=protected350Rows(), schemaBefore=schema350();
 for (const [label,statement,expectedState] of [
  ['reserve',reserve(f.a.id,id,conversation),'reserved'],
  ['transition',`SELECT public.transition_buyer_ai_request('${f.a.id}',1,'${id}','reserved','dispatched');`,'dispatched'],
 ] as const) {
  const suffix=crypto.randomUUID().slice(0,8), writerName='n8-ai350-writer-'+suffix, rollbackName='n8-ai350-rollback-'+suffix;
  const writer=owned.psqlAsync(`SET application_name=${q350(writerName)}; BEGIN; SET LOCAL ROLE service_role; ${statement} SELECT pg_sleep(3); COMMIT;`);
  let retirement: Promise<string> | undefined;
  try {
   await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
    WHERE a.application_name=${q350(writerName)} AND a.wait_event='PgSleep'
    AND l.relation='public.buyer_ai_operations'::regclass AND l.mode='RowExclusiveLock' AND l.granted);`, `Actual ${label} writer did not retain its effect lock`);
   retirement=owned.psqlAsync(`SET application_name=${q350(rollbackName)}; ${rollback350}`).then(()=>'',error=>String(error.message));
   await waitFor350Sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid
    WHERE a.application_name=${q350(rollbackName)} AND l.mode='AccessExclusiveLock' AND NOT l.granted);`, `Retirement must wait for actual ${label} writer`);
   await writer; assert.match(await retirement,/350 refuses retained/);
  } finally { await Promise.allSettled([writer,retirement]); }
  assert.equal(state(f.a.id,id),expectedState); assert.deepEqual(totals(f.a.id),{requests:1,tokens:100});
  assert.equal(protected350Rows(),protectedBefore); assert.equal(schema350(),schemaBefore); assert.equal(f.calls(),0);
 }
});

test('production BUYER mount completes once, returns current transient text, and replay has no stored answer or second dispatch', async () => {
 const f = await fixture('positive'); const body = request(); const first = await f.post(body);
 assert.equal(first.status, 200, first.text); assert.equal(first.json?.data.status, 'completed'); assert.equal(first.json?.data.text, privateMarker);
 assert.match(first.headers.get('cache-control') ?? '', /(?:^|,\s*)no-store(?:,|$)/); assert.equal(f.calls(), 1); assert.equal(totals(f.a.id).requests, 1);
 const replay = await f.post(body); assert.equal(replay.status, 200, replay.text); assert.equal(replay.json?.data.status, 'result_unavailable'); assert.equal(replay.json?.data.text, undefined); assert.equal(f.calls(), 1);
 assert.equal((await f.post({ ...body, prompt: 'Changed payload' })).status, 409); assert.equal(f.calls(), 1);
 const rows = owned.psql(`SELECT row_to_json(o)::text FROM buyer_ai_operations o WHERE buyer_account_id='${f.a.id}';`);
 assert.doesNotMatch(rows, /N8_SYNTHETIC_PRIVATE_CONTENT/); assert.equal(state(f.a.id, body.request_id), 'completed');
 assert.equal(owned.psql("SELECT count(*) FROM idempotency_keys WHERE response_body::text LIKE '%N8_SYNTHETIC_PRIVATE_CONTENT%';").trim(), '0', 'Generic HTTP receipts must never store buyer answer content');
 const columns = owned.psql("SELECT string_agg(column_name,',') FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('buyer_ai_operations','buyer_ai_daily_quotas');");
 assert.doesNotMatch(columns, /prompt|history|response|output|api_key/);
});

test('disabled or missing approved configuration is unavailable with zero quota writes and provider calls', async () => {
 for (const [label, override] of [['disabled',{ BUYER_AI_ENABLED: 'false' }],['profile',{ BUYER_AI_PROFILE: undefined }],['caps',{ BUYER_AI_PROFILE: JSON.stringify({ ...profile, requests_per_day: 0 }) }],['key',{ BUYER_AI_API_KEY: undefined }]] as const) {
  const f = await fixture(label, override); const response = await f.post(request()); assert.equal(response.status, 200, response.text);
  assert.equal(response.json?.data.status, 'unavailable'); assert.equal(f.calls(), 0); assert.equal(totals(f.a.id).requests, 0); await f.gateway.settle();
 }
});

test('real current buyer auth denies guest, merchant, expired, revoked and disabled sessions before any admission', async () => {
 const f = await fixture('auth'); const body = request();
 assert.equal((await f.post(body, {})).status, 401);
 const wrong = await buyerHeaders(f.keys, f.a.id, { realm: 'merchant', audience: 'letbuyy:merchant-session', tokenUse: 'merchant_session' });
 const expired = await buyerHeaders(f.keys, f.a.id, { epoch: 1, expiresInSeconds: -60 });
 for (const headers of [wrong, expired]) assert.equal((await f.post(body, headers)).status, 401);
 owned.psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${f.a.id}';`); assert.equal((await f.post(body)).status, 401);
 const current = await buyerHeaders(f.keys, f.a.id, { epoch: 2 }); owned.psql(`UPDATE buyer_accounts SET status='disabled' WHERE id='${f.a.id}';`);
 assert.equal((await f.post(body, current)).status, 403); assert.equal(f.calls(), 0); assert.equal(totals(f.a.id).requests, 0);
});

test('concurrent same request during held provider dispatch and another buyer remain separately scoped', async () => {
 const f = await fixture('same'); const body = request(); const held = f.hold(); const first = f.post(body); await held.started;
 const concurrent = await f.post(body); assert.equal(concurrent.status, 200, concurrent.text); assert.equal(concurrent.json?.data.status, 'in_progress'); assert.equal(f.calls(), 1);
 held.release(); assert.equal((await first).json?.data.status, 'completed'); assert.equal(totals(f.a.id).requests, 1);
 assert.equal((await f.post(body, f.headersB)).json?.data.status, 'completed'); assert.equal(f.calls(), 2); assert.equal(totals(f.b.id).requests, 1);
});

test('actual concurrent SQL admission caps distinct requests and one identical key atomically', async () => {
 const f = await fixture('quota'); const conversation = crypto.randomUUID(); const ids = Array.from({ length: 3 }, () => crypto.randomUUID());
 const results = await Promise.all(ids.map(id => owned.psqlAsync(`SET ROLE service_role;${reserve(f.a.id,id,conversation,2,200,100)}`)));
 assert.equal(results.filter(x => x.trim().endsWith('reserved')).length, 2); assert.equal(results.filter(x => x.trim().endsWith('quota_exceeded')).length, 1);
 assert.deepEqual(totals(f.a.id), { requests: 2, tokens: 200 });
 const id = crypto.randomUUID(); const same = await Promise.all([0,1].map(() => owned.psqlAsync(`SET ROLE service_role;${reserve(f.b.id,id,conversation)}`)));
 assert.equal(same.filter(x => x.trim().endsWith('reserved')).length, 1); assert.equal(same.filter(x => x.trim().endsWith('in_progress')).length, 1); assert.equal(totals(f.b.id).requests, 1);
 assert.equal(f.calls(), 0);
});

test('real quota exhaustion denies new HTTP dispatch and preserves reservation rather than refunding an estimate', async () => {
 const f = await fixture('httpcap', { BUYER_AI_PROFILE: JSON.stringify({ ...profile, requests_per_day: 1 }) });
 assert.equal((await f.post(request())).json?.data.status, 'completed');
 const denied = await f.post(request()); assert.equal(denied.json?.data.status, 'quota_exceeded'); assert.equal(f.calls(), 1); assert.equal(totals(f.a.id).requests, 1);
});

test('current authority is rechecked inside SQL immediately before dispatch and after held provider output', async () => {
 const f = await fixture('recheck'); const body = request(); let revoked = false;
 const tap = tapRest(owned.restUrl, async (call, forward) => {
  if (!revoked && call.resource === 'rpc/transition_buyer_ai_request') { revoked = true; owned.psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${f.a.id}';`); }
  return forward();
 });
 try { assert.equal((await f.post(body)).status, 401); assert.equal(f.calls(), 0); assert.equal(state(f.a.id, body.request_id), 'reserved'); }
 finally { tap.restore(); }
 const other = await fixture('recheck2'); const input = request(); const held = other.hold(); const started = other.post(input); await held.started;
 owned.psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${other.a.id}';`); held.release();
 const result = await started; assert.equal(result.status, 401); assert.doesNotMatch(result.text, /N8_SYNTHETIC_PRIVATE_CONTENT/); assert.equal(other.calls(), 1);
 const fresh = await buyerHeaders(other.keys, other.a.id, { epoch: 2 }); assert.equal((await other.post(input, fresh)).status, 409); assert.equal(other.calls(), 1);
});

test('reservation response loss and provider ambiguity replay as non-content state without another dispatch', async () => {
 for (const fault of ['reserve','provider']) {
  const f = await fixture(`loss-${fault}`); const body = request(); let injected = false;
  const tap = tapRest(owned.restUrl, async (call, forward) => {
   const response = await forward();
   if (fault === 'reserve' && !injected && call.resource === 'rpc/reserve_buyer_ai_request') { injected = true; return new Response(JSON.stringify({ message: privateMarker }), { status: 503 }); }
   return response;
  });
  if (fault === 'provider') f.fail();
  try {
   const first = await f.post(body); assert.equal(first.json?.data.status, 'outcome_unknown', first.text); assert.doesNotMatch(first.text, /N8_SYNTHETIC_PRIVATE_CONTENT/);
   const count = f.calls();
   if (fault === 'provider') {
    const offline = await f.gateway.request(route, { method: 'POST', headers: { ...f.headers, 'X-Idempotency-Key': body.request_id }, body: JSON.stringify(body) }, { ...f.gateway.env, BUYER_AI_ENABLED: 'false' });
    assert.equal(offline.json?.data.status, 'unavailable'); assert.equal(f.calls(), count);
   }
   const repeat = await f.post(body); assert.ok(['in_progress','outcome_unknown'].includes(repeat.json?.data.status), repeat.text);
   assert.equal(f.calls(), count); assert.equal(totals(f.a.id).requests, 1);
  } finally { tap.restore(); await f.gateway.settle(); }
 }
});

test('operation insert fault rolls back quota and receipt together; completion response loss never recovers unstored answer', async () => {
 const f = await fixture('fault'); const body = request();
 owned.script("CREATE FUNCTION public.n8_owned_ai_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic owned fault'; END;$$; CREATE TRIGGER n8_owned_ai_fault BEFORE INSERT ON buyer_ai_operations FOR EACH ROW EXECUTE FUNCTION public.n8_owned_ai_fault();");
 try { const response = await f.post(body); assert.equal(response.json?.data.status, 'outcome_unknown'); assert.equal(totals(f.a.id).requests, 0); assert.equal(state(f.a.id,body.request_id), ''); assert.equal(f.calls(), 0); }
 finally { owned.script('DROP TRIGGER n8_owned_ai_fault ON buyer_ai_operations;DROP FUNCTION public.n8_owned_ai_fault();'); }
 const next = request(); let failed = false;
 const tap = tapRest(owned.restUrl, async (call, forward) => {
  const response = await forward();
  if (!failed && call.resource === 'rpc/transition_buyer_ai_request' && (call.json as any)?.p_to_state === 'completed') { failed = true; return new Response('{}', { status: 503 }); }
  return response;
 });
 try {
  const response = await f.post(next); assert.equal(response.json?.data.status, 'outcome_unknown'); assert.equal(state(f.a.id,next.request_id), 'completed');
  const replay = await f.post(next); assert.equal(replay.json?.data.status, 'result_unavailable'); assert.equal(replay.json?.data.text, undefined); assert.equal(f.calls(), 1);
 } finally { tap.restore(); }
});

test('real runtime role privileges and forced ownership policies deny unscoped/cross-buyer receipt reads and direct mutation', async () => {
 const f = await fixture('roles'); const body = request(); assert.equal((await f.post(body)).json?.data.status, 'completed');
 for (const role of ['anon','authenticated','app_tenant']) {
  assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT * FROM buyer_ai_operations;`), /permission denied/);
  assert.match(owned.psqlExpectError(`SET ROLE ${role};${reserve(f.a.id,crypto.randomUUID(),body.conversation_id)}`), /permission denied/);
 }
 for (const [context, count] of [['',0],[f.b.id,0],[f.a.id,1]] as const) {
  const output = owned.script(`BEGIN;GRANT SELECT ON buyer_ai_operations TO app_tenant;SET LOCAL ROLE app_tenant;SET LOCAL app.buyer_account_id='${context}';SELECT json_build_object('count',count(*)) FROM buyer_ai_operations WHERE request_id='${body.request_id}';ROLLBACK;`);
  assert.equal(JSON.parse(output).count, count);
 }
 assert.match(owned.psqlExpectError(`SET ROLE service_role;DELETE FROM buyer_ai_operations WHERE buyer_account_id='${f.a.id}';`), /permission denied/);
 assert.equal(owned.psql("SELECT count(*) FROM pg_class WHERE oid IN ('buyer_ai_operations'::regclass,'buyer_ai_daily_quotas'::regclass) AND relrowsecurity AND relforcerowsecurity;").trim(), '2');
});

test('production ingress never logs a raw body-stream error before the authenticated parser', async () => {
 const f = await fixture('ingress'); const warnings: string[] = []; const warn = console.warn;
 console.warn = (...items: unknown[]) => { warnings.push(items.map(String).join(' ')); };
 try {
  const broken = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error(privateMarker)); } });
  const failed = await f.gateway.request(route, { method: 'POST', headers: f.headers, body: broken, duplex: 'half' } as RequestInit);
  assert.equal(failed.status, 400, failed.text); assert.equal(f.calls(), 0);
  assert.equal(warnings.some(warning => warning.includes(privateMarker)), false, 'Raw ingress exception must not cross diagnostic boundary');
 } finally { console.warn = warn; }
});

test('production ingress rejects64KiB while consuming fewer than20chunks of a2MiB stream', async () => {
 const f = await fixture('oversize');
  let pulls = 0;
  const large = new ReadableStream<Uint8Array>({ pull(controller) {
   pulls++; if (pulls > 128) controller.close(); else controller.enqueue(new Uint8Array(16384).fill(120));
  } });
  const oversized = await f.gateway.request(route, { method: 'POST', headers: f.headers, body: large, duplex: 'half' } as RequestInit);
  assert.equal(oversized.status, 400, oversized.text); assert.ok(pulls < 20, 'Reject64KiB without reading the2MiB body');
  assert.equal(f.calls(), 0); assert.equal(totals(f.a.id).requests, 0);
});

test('quota guard negative control fails open only when its real SQL bound is removed, then exact function is restored', async () => {
 const f = await fixture('negative'); const conversation = crypto.randomUUID();
 const migration = readFileSync(new URL('../../../../../database/supabase/migrations/350_buyer_ai_request_quotas.sql', import.meta.url), 'utf8');
 const extracted = migration.match(/CREATE FUNCTION public\.reserve_buyer_ai_request[\s\S]*?\n\$\$;/)?.[0]; assert.ok(extracted);
 const original = extracted.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
 assert.ok(original.includes('AND requests_reserved < p_request_limit')); assert.ok(original.includes('AND tokens_reserved <= p_token_limit-p_reserved_tokens'));
 const weakened = original.replace('AND requests_reserved < p_request_limit','AND true').replace('AND tokens_reserved <= p_token_limit-p_reserved_tokens','AND true');
 try {
  owned.script(weakened);
  for (let i = 0; i < 2; i++) assert.equal(owned.psql(reserve(f.a.id,crypto.randomUUID(),conversation,1,100,100)).trim(), 'reserved');
  assert.deepEqual(totals(f.a.id), { requests: 2, tokens: 200 }, 'Actual removed SQL safeguard admits beyond approved bounds');
 } finally { owned.script(original); }
 assert.equal(owned.psql(reserve(f.b.id,crypto.randomUUID(),conversation,1,100,100)).trim(), 'reserved');
 assert.equal(owned.psql(reserve(f.b.id,crypto.randomUUID(),conversation,1,100,100)).trim(), 'quota_exceeded');
 assert.deepEqual(totals(f.b.id), { requests: 1, tokens: 100 }); assert.equal(f.calls(), 0);
});


test('350 current-safe rollback retains ambiguous dispatch authority, quota, schema and fresh-buyer completion/replay', async () => {
 await Promise.all(gateways.splice(0).map(g => g.settle()));
 const ambiguous=await fixture('safe-rollback',{BUYER_AI_PROFILE:JSON.stringify({...profile,requests_per_day:1})});
 const inputBefore=request();ambiguous.fail();
 assert.equal((await ambiguous.post(inputBefore)).json?.data.status,'outcome_unknown');
 await ambiguous.gateway.settle();
 assert.equal(state(ambiguous.a.id,inputBefore.request_id),'outcome_unknown');
 assert.equal(totals(ambiguous.a.id).requests,1);assert.equal(ambiguous.calls(),1);
 const before=completeAiRetentionSnapshot();
 assert.match(owned.psqlExpectError(rollback350),/350 refuses retained/);
 assert.equal(completeAiRetentionSnapshot(),before);
 assert.equal((await ambiguous.post(inputBefore)).json?.data.status,'outcome_unknown');
 assert.equal((await ambiguous.post(request())).json?.data.status,'quota_exceeded');
 assert.equal(totals(ambiguous.a.id).requests,1);assert.equal(ambiguous.calls(),1);
 const f = await fixture('reapply'); const input = request(); assert.equal((await f.post(input)).json?.data.status, 'completed');
 assert.equal(totals(f.a.id).requests, 1); assert.equal((await f.post(input)).json?.data.status, 'result_unavailable'); assert.equal(f.calls(), 1);
});
