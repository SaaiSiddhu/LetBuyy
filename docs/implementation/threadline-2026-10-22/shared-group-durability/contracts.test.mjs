import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const source=read('../../../../database/supabase/migrations/384_theme_editor_template_keys.sql');
const up=read('391_shared_group_durability.up.draft.sql'),down=read('391_shared_group_durability.down.draft.sql');
const evidence=JSON.parse(read('source-evidence.json'));
const definition=text=>text.match(/CREATE OR REPLACE FUNCTION public\.mutate_owned_theme_draft_v1\([\s\S]*?END \$fn\$;/)[0];
const md5=text=>createHash('md5').update(definition(text).split('$fn$')[1]).digest('hex');
test('UP changes only explicit incoming global groups; qualified384 remains byte-identical after removing insertion',()=>{
 assert.equal(definition(up).replace(evidence.addition,''),definition(source));
 assert.equal(md5(source),evidence.baselineProsrcMd5);assert.equal(md5(up),evidence.proposedProsrcMd5);
 assert(evidence.addition.includes("jsonb_typeof(v_input#>'{templates,header}')='object'"));
 assert(evidence.addition.includes("jsonb_typeof(v_input#>'{templates,footer}')='object'"));
 assert(!/templates\s*:=.*\|\|.*v_input/.test(evidence.addition),'do not restore every stale incoming page');
});
test('selected page, nonselected draft/page/alternate preservation and global revision/idempotency/security writes stay exact',()=>{
 const body=definition(up);const inherited=body.replace(evidence.addition,'');assert.equal(inherited,definition(source));
 const before=body.indexOf("IF d.id IS NOT NULL THEN v_templates:=v_templates||coalesce(d.working_manifest->'templates','{}'); END IF;");
 const selected=body.indexOf("v_templates:=jsonb_set(v_templates,ARRAY[p_template_key],v_input->'templates'->p_template_key,true);");
 const groups=body.indexOf(evidence.addition),finish=body.indexOf("v_config:=v_input||jsonb_build_object('templates',v_templates);");
 assert(before<selected&&selected<groups&&groups<finish);
 for(const token of ['FOR UPDATE','theme_draft_actor_site_v1','v_current<>p_base_version','receipt.request_hash IS DISTINCT FROM v_hash','theme.draft.saved','theme_draft_patches','publish_theme_release'])assert(inherited.includes(token));
});
test('DOWN is the exact qualified384 definition and preserves the complete schema/constraint/data surface',()=>{
 assert.equal(definition(down),definition(source));assert.equal(md5(down),evidence.baselineProsrcMd5);
 for(const sql of [up,down])assert(!/^\s*(?:CREATE TABLE|ALTER TABLE|DROP TABLE|GRANT |REVOKE )/m.test(sql));
});
test('both legs conserve raw default-AST positions and every non-body profile/catalog dependency',()=>{
 for(const sql of [up,down]){
  const ddl=sql.match(/EXECUTE \$replacement\$([\s\S]*?)\$replacement\$;/)[1];assert(ddl.startsWith('CREATE OR REPLACE FUNCTION '));
  assert.equal(ddl.split(' AS $fn$')[0],definition(source).split(' AS $fn$')[0]);
  for(const token of ["to_jsonb(old_row)-'prosrc'","to_jsonb(new_row)-'prosrc'",'old_dependencies IS DISTINCT FROM','old_shared_dependencies IS DISTINCT FROM','old_comment IS DISTINCT FROM'])assert(sql.includes(token));
 }
});
test('both legs admit owner grantors and effective service-role privilege, reject inherited untrusted execution, retain native provider fence',()=>{
 for(const sql of [up,down]){
  const contracts=[...sql.matchAll(/DO \$shared_group_contract\$[\s\S]*?END \$shared_group_contract\$;/g)].map(match=>match[0]);
  assert.equal(contracts.length,2);
  for(const contract of contracts)assert.equal((contract.match(/a\.grantor<>p\.proowner/g)||[]).length,1);
  for(const role of ['anon','authenticated','app_tenant','authenticator'])assert.equal((sql.match(new RegExp("has_function_privilege\\('"+role+"',p.oid,'EXECUTE'\\)",'g'))||[]).length,2);
  for(const token of ['LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE','LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED','LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED','4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc'])assert(sql.includes(token));
 }
});
test('reviewable current/proposed source profiles retain the same complete declared signature/attributes and exact paired DOWN',()=>{
 const profile=JSON.parse(read('profile-contract.json'));
 assert.equal(profile.classification,'SOURCE_DECLARED_CURRENT_PROPOSED_PROFILE_NOT_LIVE_DATABASE_INSPECTION');
 const sha=text=>createHash('sha256').update(text).digest('hex');
 for(const [key,sql]of [['currentSource',source],['proposedUp',up],['pairedDown',down]]){
  assert.equal(profile[key].fileSha256,sha(sql));assert.equal(profile[key].definitionSha256,sha(definition(sql)));
  assert.equal(profile[key].prosrcMd5,md5(sql));assert.equal(profile[key].ddlHeader,definition(sql).split(' AS $fn$')[0]);
 }
 assert.equal(profile.currentSource.ddlHeader,profile.proposedUp.ddlHeader);
 assert.equal(profile.currentSource.definitionSha256,profile.pairedDown.definitionSha256);
 assert.equal(profile.sharedDeclaredAttributes.pronargs,12);assert.equal(profile.sharedDeclaredAttributes.pronargdefaults,5);
 assert.deepEqual(profile.sharedDeclaredAttributes.proconfig,['search_path=pg_catalog, public']);
 assert.deepEqual(profile.sharedDeclaredAttributes.effectiveExecution,{owner:true,service_role:true,anon:false,authenticated:false,app_tenant:false,authenticator:false});
});
