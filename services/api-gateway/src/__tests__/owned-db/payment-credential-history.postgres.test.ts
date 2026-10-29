import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, seedSyntheticOrder } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const up = readFileSync('database/supabase/migrations/404_store_payment_credential_history.sql','utf8');
const down = readFileSync('database/supabase/rollback/404_store_payment_credential_history.rollback.sql','utf8');
const site = newSyntheticTenant('credential-history'), other = newSyntheticTenant('credential-other');
const keyId = () => ['rzp','test',randomUUID().replaceAll('-','')].join('_');
const quote = (v:string) => "'" + v.replaceAll("'","''") + "'";
function insert(id:string, tenant=site.siteId, root=id, version=1, key=keyId(), mode='sandbox') {
 return `INSERT INTO payment_credentials(id,site_id,provider,mode,status,connection_id,credential_version,provider_key_id,last_verified_at,encrypted_credentials)
 VALUES('${id}','${tenant}','razorpay','${mode}','active','${root}',${version},${quote(key)},now(),'{"synthetic":"encrypted test bytes"}');`;
}

test('404 expand/down/up conserves the existing credential owner and former grants before any new history exists', () => {
 owned.script(down);
 seedSyntheticTenant(owned.psql,site); seedSyntheticTenant(owned.psql,other);
 const legacy=randomUUID();
 owned.psql(`INSERT INTO payment_credentials(id,site_id,provider,mode,status,metadata) VALUES('${legacy}','${site.siteId}','razorpay','sandbox','needs_verification','{"legacy":"preserved"}');`);
 const original=owned.psql(`SELECT to_jsonb(c)::text FROM payment_credentials c WHERE id='${legacy}';`);
 const grant=owned.psql(`SELECT has_table_privilege('app_tenant','payment_credentials','UPDATE')::text||':'||has_table_privilege('service_role','payment_credentials','DELETE')::text;`);
 owned.script(up);
 assert.equal(owned.psql(`SELECT (to_jsonb(c)-ARRAY['connection_id','credential_version','provider_key_id','provider_account_id','selected_for_checkout'])::text FROM payment_credentials c WHERE id='${legacy}';`),original);
 assert.equal(owned.psql(`SELECT connection_id=id AND NOT selected_for_checkout FROM payment_credentials WHERE id='${legacy}';`),'t');
 owned.script(down);
 assert.equal(owned.psql(`SELECT to_jsonb(c)::text FROM payment_credentials c WHERE id='${legacy}';`),original);
 assert.equal(owned.psql(`SELECT has_table_privilege('app_tenant','payment_credentials','UPDATE')::text||':'||has_table_privilege('service_role','payment_credentials','DELETE')::text;`),grant);
 owned.script(up);
});

test('one store/environment owns a connection; old and replacement versions remain independently addressable', async () => {
 const root=randomUUID(), replacement=randomUUID(), key=keyId();
 owned.psql(insert(root,site.siteId,root,1,key));
 owned.psql(insert(replacement,site.siteId,root,2,key));
 assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE connection_id='${root}' AND site_id='${site.siteId}';`),'2');
 assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE connection_id='${root}' AND selected_for_checkout;`),'0','save is not activation');
 assert.match(owned.psqlExpectError(insert(randomUUID(),other.siteId,root,3,key)),/scope cannot change/);
 assert.match(owned.psqlExpectError(insert(randomUUID(),site.siteId,root,3,key.replace('_test_','_live_'),'live')),/scope cannot change/);
 assert.match(owned.psqlExpectError(insert(randomUUID(),other.siteId,undefined,1,key)),/payment_credentials_one_manual_key/,'same key cannot acquire a different store owner');
 const races=await Promise.allSettled([owned.psqlAsync(insert(randomUUID(),site.siteId,root,3,key)),owned.psqlAsync(insert(randomUUID(),site.siteId,root,3,key))]);
 assert.equal(races.filter(x=>x.status==='fulfilled').length,1,'one exact version under real concurrent INSERT');
 assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE connection_id='${root}' AND credential_version=3;`),'1');
 for(const update of ["mode='live'","site_id='"+other.siteId+"'","encrypted_credentials='{}'","provider_account_id='synthetic-other-account'","credential_version=9","deleted_at=now()"])
  assert.match(owned.psqlExpectError(`UPDATE payment_credentials SET ${update} WHERE id='${root}';`),/history is immutable/);
 assert.match(owned.psqlExpectError(`DELETE FROM payment_credentials WHERE id='${root}';`),/history cannot be deleted/);
 assert.match(owned.psqlExpectError(`SET ROLE service_role;UPDATE payment_credentials SET encrypted_credentials='{}' WHERE id='${replacement}';`),/permission denied/);
 assert.match(owned.psqlExpectError(`SET ROLE service_role;DELETE FROM payment_credentials WHERE id='${replacement}';`),/permission denied/);
});

test('database selection is exclusive per store/environment and cannot activate live or unverified credentials', async () => {
 const a=randomUUID(),b=randomUUID(),unverified=randomUUID();
 owned.psql(insert(a)); owned.psql(insert(b));
 const results=await Promise.allSettled([owned.psqlAsync(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${a}';`),owned.psqlAsync(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${b}';`)]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(owned.psql(`SELECT count(*) FROM payment_credentials WHERE site_id='${site.siteId}' AND mode='sandbox' AND selected_for_checkout;`),'1');
 owned.psql(`INSERT INTO payment_credentials(id,site_id,provider,mode) VALUES('${unverified}','${other.siteId}','razorpay','sandbox');`);
 assert.match(owned.psqlExpectError(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${unverified}';`),/selected_ready/);
 const live=randomUUID();owned.psql(insert(live,other.siteId,live,1,keyId().replace('_test_','_live_'),'live'));
 assert.match(owned.psqlExpectError(`UPDATE payment_credentials SET selected_for_checkout=true WHERE id='${live}';`),/selected_ready/);
});

test('payments and refund attempts retain exact credential scope after another version becomes available', () => {
 const order=seedSyntheticOrder(owned.psql,site), root=randomUUID(), next=randomUUID(), key=keyId(), payment=randomUUID(),attempt=randomUUID();
 owned.psql(insert(root,site.siteId,root,1,key));owned.psql(insert(next,site.siteId,root,2,key));
 owned.psql(`INSERT INTO payments(id,site_id,order_id,provider,mode,status,amount_minor,credential_id,idempotency_key)
  VALUES('${payment}','${site.siteId}','${order.orderId}','razorpay','sandbox','pending',100,'${root}','syn-${payment}');
  INSERT INTO payment_attempts(id,site_id,order_id,provider,attempt_type,status,amount,payment_id,credential_id,credential_mode)
  VALUES('${attempt}','${site.siteId}','${order.orderId}','razorpay','refund','pending',1,'${payment}','${root}','sandbox');`);
 for(const table of ['payments','payment_attempts']) {
  assert.equal(owned.psql(`SELECT credential_id FROM ${table} WHERE id='${table==='payments'?payment:attempt}';`),root);
  assert.match(owned.psqlExpectError(`UPDATE ${table} SET credential_id='${next}' WHERE id='${table==='payments'?payment:attempt}';`),/binding is immutable/);
 }
 assert.match(owned.psqlExpectError(`INSERT INTO payments(site_id,order_id,provider,mode,status,amount_minor,credential_id,idempotency_key)
  VALUES('${other.siteId}','${order.orderId}','razorpay','sandbox','pending',100,'${root}','syn-foreign-${randomUUID()}');`),/credential_scope_fk/);
 assert.match(owned.psqlExpectError(`UPDATE payment_attempts SET credential_mode='live' WHERE id='${attempt}';`),/environment is immutable/);
 const before=owned.psql(`SELECT md5(string_agg(to_jsonb(c)::text,'|' ORDER BY id)) FROM payment_credentials c;`);
 assert.match(owned.psqlScriptExpectError(down),/404 rollback requires/);
 assert.equal(owned.psql(`SELECT md5(string_agg(to_jsonb(c)::text,'|' ORDER BY id)) FROM payment_credentials c;`),before);
});

test('tenant positive control and unset/foreign GUC denial remain on the credential owner', () => {
 const query=(tenant:string|null)=>`BEGIN;SET LOCAL ROLE app_tenant;${tenant?`SELECT set_config('app.site_id','${tenant}',true);`:''} SELECT count(*) FROM payment_credentials WHERE site_id='${site.siteId}';ROLLBACK;`;
 assert.ok(Number(owned.psql(query(site.siteId)).split('\n').at(-2))>0);
 assert.equal(owned.psql(query(other.siteId)).split('\n').at(-2),'0');
 assert.equal(owned.psql(query(null)).split('\n').at(-2),'0');
});
