// Real catalog refusals and rollback isolation in an owned synthetic database.
// No hosted recovery archive or provider request is accepted by this suite.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';

const owned=requireOwnedDatabase();
const directory='database/supabase/rollback';
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const catalog=()=>owned.psql(`SELECT md5(coalesce(jsonb_agg(jsonb_build_array(p.oid,p.proname,pg_get_functiondef(p.oid),p.proowner,p.proacl) ORDER BY p.oid),'[]'::jsonb)::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f';`);

for(const number of [401,410,411,412,414]){
 const file=readdirSync(directory).find(name=>name.startsWith(number+'_'))!;
 const source=readFileSync(directory+'/'+file,'utf8');
 const end=source.indexOf('END $rollback_typed_family$;')+'END $rollback_typed_family$;'.length;
 assert.ok(end>0);
 const prefix=source.slice(0,end);
 const signatures=[...prefix.matchAll(/\('(public\.[^']+)',ARRAY/g)].map(match=>match[1]);
 assert.ok(signatures.length>0);
 test(`rollback${number} accepts its current ABI without changing any function`,()=>{
  const before=catalog();owned.script(prefix+'\nROLLBACK;');assert.equal(catalog(),before);
 });
 test(`rollback${number} refuses overload and return-type drift atomically`,()=>{
  for(const signature of signatures){
   const name=signature.slice(7,signature.indexOf('('));const before=catalog();
   const args=owned.psql(`SELECT pg_get_function_identity_arguments(${quote(signature)}::regprocedure);`);
   for(const drift of [
    `CREATE FUNCTION public.${name}(synthetic_extra_input integer) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;`,
    `DROP FUNCTION ${signature} CASCADE; CREATE FUNCTION public.${name}(${args}) RETURNS text LANGUAGE sql AS $$ SELECT 'synthetic ABI drift'::text $$;`,
   ]){
    // Insert synthetic drift before the real guard, in the same transaction.
    const sql=prefix.replace('BEGIN;',()=>'BEGIN;\n'+drift)+'\nCOMMIT;';
    assert.match(owned.psqlScriptExpectError(sql),new RegExp(`Rollback${number} refuses changed typed function family`));
    assert.equal(catalog(),before,'refusal rolls back the entire synthetic mutation');
   }
  }
 });
 if(number===410||number===414)test(`rollback${number} complete historical script executes before use and rolls back its own probe`,()=>{
  const before=catalog();owned.script(source.replace(/COMMIT;\s*$/,'ROLLBACK;'));assert.equal(catalog(),before);
 });
}
