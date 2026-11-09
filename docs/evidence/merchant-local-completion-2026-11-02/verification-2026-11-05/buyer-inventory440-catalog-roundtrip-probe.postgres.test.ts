import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
test('capture schema-only catalogue differences across439/440 roundtrip',()=>{
 const read=()=>JSON.parse(owned.psql(`SELECT jsonb_object_agg(p.oid,to_jsonb(p)) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace`));
 const before=read();
 for(const path of ['migrations/439_catalog_available_quantity.sql','migrations/440_buyer_inventory_projection.sql','rollback/440_buyer_inventory_projection.rollback.sql','rollback/439_catalog_available_quantity.rollback.sql'])owned.script(readFileSync('database/supabase/'+path,'utf8'));
 const after=read(),changes=[];
 for(const id of new Set([...Object.keys(before),...Object.keys(after)])){
  const b=before[id],a=after[id];
  if(JSON.stringify(b)!==JSON.stringify(a))changes.push({id,name:b?.proname??a?.proname,fields:Object.fromEntries([...new Set([...Object.keys(b??{}),...Object.keys(a??{})])].filter(k=>JSON.stringify(b?.[k])!==JSON.stringify(a?.[k])).map(k=>[k,{before:b?.[k],after:a?.[k]}]))});
 }
 console.info('OWNED_CATALOG440_ROUNDTRIP '+JSON.stringify({run_id:owned.runId,changes}));
 assert.deepEqual(changes,[]);
});
