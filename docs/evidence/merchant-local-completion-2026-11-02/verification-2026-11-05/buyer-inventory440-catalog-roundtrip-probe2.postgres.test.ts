import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
test('compare catalogue rows entirely inside the owned database across439/440 roundtrip',()=>{
 owned.psql(`CREATE SCHEMA synthetic_probe440;CREATE TABLE synthetic_probe440.functions AS SELECT p.oid,to_jsonb(p) AS row FROM pg_proc p WHERE p.pronamespace='public'::regnamespace`);
 for(const path of ['migrations/439_catalog_available_quantity.sql','migrations/440_buyer_inventory_projection.sql','rollback/440_buyer_inventory_projection.rollback.sql','rollback/439_catalog_available_quantity.rollback.sql'])owned.script(readFileSync('database/supabase/'+path,'utf8'));
 const changes=JSON.parse(owned.psql(`WITH after AS(SELECT p.oid,to_jsonb(p)AS row FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),changes AS(SELECT b.oid,b.row AS before,a.row AS after FROM synthetic_probe440.functions b FULL JOIN after a USING(oid)WHERE b.row IS DISTINCT FROM a.row)SELECT coalesce(jsonb_agg(jsonb_build_object('oid',c.oid,'name',coalesce(c.before,c.after)->>'proname','fields',(SELECT jsonb_object_agg(k,jsonb_build_object('before',CASE WHEN k='proargdefaults' THEN c.before->k ELSE to_jsonb(encode(sha256(convert_to(coalesce((c.before->k)::text,''),'UTF8')),'hex'))END,'after',CASE WHEN k='proargdefaults' THEN c.after->k ELSE to_jsonb(encode(sha256(convert_to(coalesce((c.after->k)::text,''),'UTF8')),'hex'))END))FROM(SELECT jsonb_object_keys(coalesce(c.before,'{}')||coalesce(c.after,'{}'))k)keys WHERE c.before->k IS DISTINCT FROM c.after->k))),'[]')FROM changes c`));
 console.info('OWNED_CATALOG440_ROUNDTRIP '+JSON.stringify({run_id:owned.runId,changes}));assert.deepEqual(changes,[]);
});
