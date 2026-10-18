// Development rollback contract proof only, on the existing verified owned fixture.
// Kept separate from normal checkout/provider API acceptance; no retained row deletion.
import assert from 'node:assert/strict';
import test,{before} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase();
// The current tax writer owns this family. Prove stale retirement is refused,
// then use its reviewed, empty-only rollback for the historical 347 control.
before(()=>{
 const signature='public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)';
 const current=owned.psql(`SELECT pg_get_functiondef('${signature}'::regprocedure);`);
 assert.match(owned.psqlExpectError(readFileSync('database/supabase/rollback/347_free_subscription_checkout_receipts.rollback.sql','utf8')),/360 refuses/);
 assert.equal(owned.psql(`SELECT pg_get_functiondef('${signature}'::regprocedure);`),current);
 owned.script(readFileSync('database/supabase/rollback/360_subscription_tax_quote_snapshot.rollback.sql','utf8'));
});
const migration=(direction:'migrations'|'rollback')=>readFileSync(new URL('../../../../../database/supabase/'+direction+'/347_free_subscription_checkout_receipts'+(direction==='rollback'?'.rollback':'')+'.sql',import.meta.url),'utf8');
const names=['claim_merchant_subscription_checkout_v1','bind_merchant_subscription_checkout_v1','read_merchant_subscription_checkout_v1','activate_merchant_subscription_v1'];
function functions(){return owned.psql(`SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY p.proname,p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('${names.join("','")}');`);}
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
function rows(){return owned.psql(`SELECT md5(jsonb_build_object('subscriptions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM subscriptions s),'billing_history',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM billing_history b),'audit_logs',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_logs a),'idempotency_keys',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM idempotency_keys i))::text);`);}

for(const name of names)test('DEV-347: unexpected overload of '+name+' refuses rollback without mutations',()=>{
 const forward=migration('migrations');
 owned.psql(`CREATE FUNCTION public.${name}(p_unexpected_overload integer) RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$ SELECT '{}'::jsonb $$;REVOKE ALL ON FUNCTION public.${name}(integer) FROM PUBLIC;`);
 const before=hash(functions()),data=rows();
 try{
  const error=owned.psqlExpectError(migration('rollback')),after=hash(functions());
  console.info('N2_ROLLBACK_OVERLOAD '+JSON.stringify({name,refused:!!error,before,after,rowsUnchanged:rows()===data}));
  assert.match(error,/347 rollback refuses changed function ABI/);
  assert.equal(after,before,'body/ACL/OID definitions must remain unchanged');assert.equal(rows(),data);
 }finally{owned.psql(`DROP FUNCTION public.${name}(integer);`);owned.script(forward);}
});
