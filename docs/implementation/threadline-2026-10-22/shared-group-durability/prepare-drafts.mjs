// Source-only preparation. Writes this documentation directory, never active SQL.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=new URL('../../../../',import.meta.url),out=new URL('./',import.meta.url);
const path='database/supabase/migrations/384_theme_editor_template_keys.sql';
const source=readFileSync(new URL(path,root),'utf8');
const sha=text=>createHash('sha256').update(text).digest('hex');
const md5=text=>createHash('md5').update(text).digest('hex');
const definition=source.match(/CREATE OR REPLACE FUNCTION public\.mutate_owned_theme_draft_v1\([\s\S]*?END \$fn\$;/)?.[0];assert(definition);
const body=text=>text.split('$fn$')[1];
const baseline=md5(body(definition));assert.equal(baseline,'2a6e74135720d0557ba921d517e88a13');
const anchor="  v_config:=v_input||jsonb_build_object('templates',v_templates);";assert.equal(definition.split(anchor).length,2);
const addition=`  -- Shared groups are explicit document-wide edits, not unselected pages.
  -- Reapply only supplied header/footer groups after preserving prior pages.
  IF jsonb_typeof(v_input#>'{templates,header}')='object' THEN
   v_templates:=jsonb_set(v_templates,'{header}',v_input#>'{templates,header}',true); END IF;
  IF jsonb_typeof(v_input#>'{templates,footer}')='object' THEN
   v_templates:=jsonb_set(v_templates,'{footer}',v_input#>'{templates,footer}',true); END IF;
`;
const fixed=definition.replace(anchor,addition+anchor),expanded=md5(body(fixed));
assert.equal(fixed.replace(addition,''),definition,'Only explicit shared-group merge changes');
const fence=source.match(/DO \$managed_catalog_fence\$[\s\S]*?END \$managed_catalog_fence\$;/)?.[0];assert(fence);
const originalProfile=source.match(/DO \$template_key_contract\$[\s\S]*?END \$template_key_contract\$;/)?.[0];assert(originalProfile);
function profile(hashes) {
 let text=originalProfile.replaceAll('$template_key_contract$','$shared_group_contract$')
  .replace("p.oid IS NULL OR p.prokind<>'f'","p.oid IS NULL OR p.pronargs<>12 OR p.prokind<>'f'")
  .replace("pg_catalog.md5(p.prosrc) NOT IN('b770c5c649eee8eca3b5cc8f5e488c69','2a6e74135720d0557ba921d517e88a13')",`pg_catalog.md5(p.prosrc) NOT IN(${hashes.map(value=>`'${value}'`).join(',')})`)
  .replace("OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')",`OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
 OR NOT pg_catalog.has_function_privilege(p.proowner,p.oid,'EXECUTE')
 OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
 OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE')
 OR pg_catalog.has_function_privilege('authenticator',p.oid,'EXECUTE')`)
  .replace('WHERE a.grantee NOT IN(', 'WHERE a.grantor<>p.proowner OR a.grantee NOT IN(')
  .replace('Migration384 refuses changed draft definition, owner or privileges','Draft391 refuses changed draft definition, owner, grantor or effective privileges');
 assert(text.includes("a.grantor<>p.proowner"));assert(text.includes('p.pronargs<>12'));
 return text;
}
function leg(name,ddl,expected) {
 return `-- DRAFT391 ${name}: documentation only, requires root review and owned qualification.
-- Completes the existing global-group merge; no schema, captured bundle or data rewrite.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('migration391:shared-group-durability',0));
${fence}
${profile([baseline,expanded])}
DO $body_only$
DECLARE old_row pg_catalog.pg_proc%ROWTYPE;new_row pg_catalog.pg_proc%ROWTYPE;
 old_comment text;old_dependencies jsonb;old_shared_dependencies jsonb;
BEGIN
 SELECT * INTO STRICT old_row FROM pg_catalog.pg_proc
  WHERE oid='public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)'::regprocedure;
 old_comment:=pg_catalog.obj_description(old_row.oid,'pg_proc');
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') INTO old_dependencies
  FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=old_row.oid;
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') INTO old_shared_dependencies
  FROM pg_catalog.pg_shdepend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=old_row.oid
   AND d.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database());
 -- No leading newline in the executed DDL: raw default-AST source locations
 -- remain identical to qualified384, as do all non-body pg_proc fields.
 EXECUTE $replacement$${ddl}$replacement$;
 SELECT * INTO STRICT new_row FROM pg_catalog.pg_proc WHERE oid=old_row.oid;
 IF (to_jsonb(old_row)-'prosrc') IS DISTINCT FROM (to_jsonb(new_row)-'prosrc')
  OR old_comment IS DISTINCT FROM pg_catalog.obj_description(new_row.oid,'pg_proc')
  OR old_dependencies IS DISTINCT FROM(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]')
    FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=new_row.oid)
  OR old_shared_dependencies IS DISTINCT FROM(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]')
    FROM pg_catalog.pg_shdepend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=new_row.oid
     AND d.dbid=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())) THEN
  RAISE EXCEPTION 'Draft391 refuses non-body catalog/default-AST/ACL/dependency drift';
 END IF;
END $body_only$;
${profile([expected])}
NOTIFY pgrst,'reload schema';
COMMIT;
`;
}
const files=[['391_shared_group_durability.up.draft.sql',leg('UP',fixed,expanded)],['391_shared_group_durability.down.draft.sql',leg('DOWN',definition,baseline)]];
for(const [name,text]of files)writeFileSync(new URL(name,out),text);
const evidence={recordedAt:new Date().toISOString(),status:'PREPARED_NOT_SQL_EXECUTED_NOT_ROOT_ADMITTED',
 source:{path,sha256:sha(source)},function:'public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)',
 baselineProsrcMd5:baseline,proposedProsrcMd5:expanded,addition,
 drafts:files.map(([path,text])=>({path,sha256:sha(text),bytes:Buffer.byteLength(text)})),
 scope:'Only reapply explicitly supplied header/footer AFTER old unselected-page preservation; selected-page logic, locks/CAS/idempotency/tenancy/atomicity unchanged.',
 defaultAst:'Exact original CREATE header starts at byte0 of dynamicDDL; no field ignored/normalized.',
 active391FilesCreated:false,databaseStarted:false,providerFenceExecuted:false};
writeFileSync(new URL('source-evidence.json',out),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
