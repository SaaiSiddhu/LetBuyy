import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync}from'node:fs';
import {requireOwnedDatabase}from'../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
test('capture current canonical browse and scalar inventory read definitions from the owned schema',()=>{
 const profiles=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,'acl',coalesce(p.proacl,acldefault('f',p.proowner)))ORDER BY p.proname)FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN('browse_storefront_products_v1','catalog_available_quantity')`));assert.equal(profiles.length,2);
 writeFileSync('docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/buyer-inventory440-owned-provenance.json',JSON.stringify({run_id:owned.runId,scope:'Owned schema definitions/role metadata only; no account or commerce rows',profiles},null,2)+'\n',{flag:'wx',mode:0o600});
});
