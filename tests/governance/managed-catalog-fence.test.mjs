import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { normalizeVerifiedManagedCatalogFences } from '../../scripts/governance/managed-catalog-fence.mjs';
import { rollbackSignatureGuards } from '../../scripts/governance/rollback-signature-guards.mjs';
const source = readFileSync('database/supabase/rollback/349_money_ledger_reconciliation_traversal.rollback.sql','utf8');

test('a native/provider-admin fence retains a full traversal proof and all source offsets',()=>{
 const normalized=normalizeVerifiedManagedCatalogFences(source);
 assert.notEqual(normalized,source);
 assert.equal(normalized.length,source.length);
 assert.equal(rollbackSignatureGuards(source).length,1);
 assert.equal(source.indexOf('DROP FUNCTION'),normalized.indexOf('DROP FUNCTION'));
});
const changes=[
 ['weakened native mode','IN SHARE ROW EXCLUSIVE MODE NOWAIT;','IN ACCESS SHARE MODE NOWAIT;'],
 ['missing superuser owner','AND r.rolsuper','AND true'],
 ['changed helper body',"4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc",'0'.repeat(64)],
 ['public helper ACL','a.grantee NOT IN(p.proowner,\'postgres\'::regrole)','false'],
 ['missing held-lock witness','l.relation=catalog_oid','true'],
 ['different backend','l.pid=pg_catalog.pg_backend_pid()','true'],
 ['weak refusal',"RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED'","RAISE WARNING 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED'"],
 ['early return','PERFORM letbuyy_maintenance.lock_catalogs_v1();','RETURN; PERFORM letbuyy_maintenance.lock_catalogs_v1();'],
];
for(const [name,before,after] of changes)test('catalog proof refuses '+name,()=>{
 assert.ok(source.includes(before),before);
 const changed=source.replace(before,after);
 assert.equal(normalizeVerifiedManagedCatalogFences(changed),changed);
 assert.deepEqual(rollbackSignatureGuards(changed),[]);
});
