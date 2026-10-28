import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test,{after} from 'node:test';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
import {MerchantPayoutListSchema,MerchantPayoutSummarySchema} from '@letbuyy/shared-types';

const owned=requireOwnedDatabase(),site=newSyntheticTenant('payout-page'),other=newSyntheticTenant('payout-other');
let gateway:Gateway;const actor=randomUUID(),email=`syn-payout-${actor}@example.invalid`;
after(async()=>{await gateway?.settle();});
const up=readFileSync('database/supabase/migrations/407_complete_payout_statement_reads.sql','utf8');
const down=readFileSync('database/supabase/rollback/407_complete_payout_statement_reads.rollback.sql','utf8');
const digest=()=>owned.psql("SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY id),'')) FROM payout_statements p;");
const read=async(query='')=>gateway.request(`/v1/payouts?store_id=${site.siteId}${query}`,{headers:await signedIdentityHeaders(actor,email,site.siteId)});

test('complete statement reads split environments, paginate tied dates without loss and aggregate beyond either former cap',async()=>{
 seedSyntheticTenant(owned.psql,site);seedSyntheticTenant(owned.psql,other);
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic Statement Reader');
  UPDATE sites SET custom_user_id='${actor}' WHERE id IN('${site.siteId}','${other.siteId}');
  INSERT INTO payout_statements(site_id,statement_number,status,provider_mode,gross_amount_minor,net_amount_minor,created_at,metadata)
  SELECT '${site.siteId}','SYN-READ-'||n,CASE WHEN n%4=0 THEN 'pending' WHEN n%4=1 THEN 'processing' WHEN n%4=2 THEN 'released' ELSE 'failed' END,
   'sandbox',100000000,100000000,'2026-10-01T00:00:00Z','{"synthetic_read_fixture":true}' FROM generate_series(1,125) n;
  INSERT INTO payout_statements(site_id,statement_number,status,provider_mode,gross_amount_minor,net_amount_minor,metadata)
  VALUES('${site.siteId}','SYN-LIVE','released','live',300,300,'{"synthetic_read_fixture":true}'),
   ('${other.siteId}','SYN-FOREIGN','pending','sandbox',900,900,'{"synthetic_read_fixture":true}');`);
 gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
 const before=digest(),seen:string[]=[];let cursor:string|null=null;let pages=0;
 do {
  const response=await read(`&mode=sandbox&limit=17${cursor?'&cursor='+encodeURIComponent(cursor):''}`);
  assert.equal(response.status,200,response.text);
  const page=MerchantPayoutListSchema.parse(response.json?.data);
  assert.equal(page.summary.statement_count,125);assert.equal(page.pagination.matching_count,125);
  assert.equal(page.summary.pending_minor,3100000000);assert.equal(page.summary.processing_minor,3200000000);
  assert.equal(page.summary.released_minor,3100000000);assert.equal(page.summary.failed_minor,3100000000);
  assert.equal(page.summary.bank_settlement,'not_observed','a released transfer never manufactures bank evidence');
  assert.ok(page.payouts.every(row=>row.site_id===site.siteId && row.provider_mode==='sandbox'));
  seen.push(...page.payouts.map(row=>row.id));cursor=page.pagination.next_cursor;pages++;
  assert.equal(page.pagination.has_more,Boolean(cursor));assert.ok(pages<=8);
 }while(cursor);
 assert.equal(pages,8);assert.equal(seen.length,125);assert.equal(new Set(seen).size,125);
 const expected=owned.psql(`SELECT string_agg(id::text,',' ORDER BY created_at DESC,id DESC) FROM payout_statements WHERE site_id='${site.siteId}' AND provider_mode='sandbox';`).split(',');
 assert.deepEqual(seen,expected);
 const live=await read('&mode=live');assert.equal(live.status,200,live.text);
 assert.equal(live.json?.data.payouts.length,1);assert.equal(live.json?.data.summary.released_minor,300);
 const filtered=await read('&mode=sandbox&status=pending&limit=1');assert.equal(filtered.status,200,filtered.text);
 assert.equal(filtered.json?.data.pagination.matching_count,31);
 assert.equal(filtered.json?.data.summary.statement_count,125,'status/page filters do not relabel a partial population as the full total');
 const summary=await gateway.request(`/v1/payouts/summary?store_id=${site.siteId}&mode=sandbox`,{headers:await signedIdentityHeaders(actor,email,site.siteId)});
 assert.equal(summary.status,200,summary.text);
 assert.deepEqual(MerchantPayoutSummarySchema.parse(summary.json?.data),filtered.json?.data.summary);
 assert.equal(digest(),before,'read-only commands preserve exact source statement rows');
 assert.equal(owned.psql(`SELECT count(*) FROM ledger_transactions WHERE site_id='${site.siteId}';`),'0');
});

test('cursor scope, malformed queries, current ownership and RPC roles are enforced independently',async()=>{
 const first=await read('&mode=sandbox&limit=2');const cursor=first.json?.data.pagination.next_cursor;
 assert.equal(typeof cursor,'string');
 for(const query of [`&mode=live&cursor=${cursor}`,`&status=pending&cursor=${cursor}`,'&cursor=bad-cursor','&limit=51','&mode=mock']) {
  assert.equal((await read(query)).status,400,query);
 }
 const stolen=await gateway.request(`/v1/payouts?store_id=${other.siteId}&mode=sandbox&cursor=${cursor}`,{headers:await signedIdentityHeaders(actor,email,other.siteId)});
 assert.equal(stolen.status,400,'even an owner of both stores cannot carry cursor scope across stores');
 const unauthorized=await gateway.request(`/v1/payouts?store_id=${site.siteId}`,{headers:await signedIdentityHeaders(randomUUID(),'foreign@example.invalid',site.siteId)});
 assert.ok([401,403,404].includes(unauthorized.status));
 for(const role of ['anon','authenticated','app_tenant']) assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT read_payout_statement_page_v1('${site.siteId}','sandbox');`),/permission denied/);
 const guc=(id:string|null)=>`BEGIN;SET LOCAL ROLE app_tenant;${id?`SELECT set_config('app.site_id','${id}',true);`:''} SELECT count(*) FROM payout_statements WHERE site_id='${site.siteId}';ROLLBACK;`;
 assert.equal(owned.psql(guc(site.siteId)).split('\n').at(-2),'126');
 assert.equal(owned.psql(guc(other.siteId)).split('\n').at(-2),'0');assert.equal(owned.psql(guc(null)).split('\n').at(-2),'0');
});

test('407 DOWN/up conserves statement history; unknown currency fails closed instead of becoming INR or zero',async()=>{
 const before=digest();owned.script(down);assert.equal(digest(),before);owned.script(up);assert.equal(digest(),before);
 const bad=randomUUID();owned.psql(`INSERT INTO payout_statements(id,site_id,statement_number,currency,net_amount_minor) VALUES('${bad}','${site.siteId}','SYN-BAD-CURRENCY','USD',100);`);
 const unavailable=await read('&mode=sandbox');assert.equal(unavailable.status,503,unavailable.text);
 assert.equal(unavailable.json?.error.code,'PAYOUT_READ_UNAVAILABLE');assert.equal(unavailable.json?.data,undefined);
 assert.doesNotMatch(unavailable.text,/SQLSTATE|PGRST|currency requires review/);
});
