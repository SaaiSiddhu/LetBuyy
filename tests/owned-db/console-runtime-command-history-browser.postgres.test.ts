// Normal local Identity forms/TOTP, Console SSR, real Worker/PostgREST/owned PG.
// Synthetic retained records are not command approval, execution or provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { tapRest, restJson } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { withConsoleBrowser } from '../../services/api-gateway/src/__tests__/owned-db/console-browser-fixture';
const owned=requireOwnedDatabase();
const legacyPath='/v1/operations/runtime/control-commands';
const canonicalPath='/v1/internal/console/operations/runtime/control-commands';
const unavailableMessage='No runtime command can be submitted here. Use the documented recovery procedure for the affected queue, outbox or provider.';
const historyWarning='Historical records below are retained evidence. Their stored status does not establish independent approval or a completed operational effect.';
test('normal MFA super reads retained command history without enabling controls, recovers an outage and logs out', {timeout:300000},async()=>{
 const suffix=crypto.randomUUID(),prefix='SYN-CMD-'+suffix+'-',marker='synthetic-private-command-'+suffix;
 const command=(n:number)=>prefix+n;
 const visible=(n:number)=>command(n)+' | queue:synthetic-queue-'+n;
 owned.script(`INSERT INTO runtime_control_commands(command_id,operation,target_type,target_id,reason,status,result,correlation_id,created_at)
  SELECT '${prefix}'||n,'pause-queue','queue','synthetic-queue-'||n,'${marker}',
   (ARRAY['accepted','running','completed','failed','cancelled'])[(n%5)+1],jsonb_build_object('private_marker','${marker}'),
   'synthetic-history-correlation-'||n,now()-n*interval '1 minute' FROM generate_series(0,17)n;
  INSERT INTO runtime_control_commands(command_id,operation,target_type,target_id,reason,status,correlation_id,created_at,deleted_at)
  VALUES('${prefix}deleted','pause-queue','queue','synthetic-deleted-command','${marker}','accepted','synthetic-deleted-correlation',now(),now());`);
 const digest=()=>owned.psql(`SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(c)ORDER BY id)::text,'[]'),'sha256'),'hex')FROM runtime_control_commands c;`);
 const claimAuthority=()=>owned.psql(`SELECT encode(extensions.digest(jsonb_build_object(
  'claim',(SELECT to_jsonb(p)FROM pg_proc p WHERE oid='public.claim_operational_control_command(text,integer)'::regprocedure),
  'journal',(SELECT jsonb_agg(to_jsonb(j)ORDER BY object_signature,grantee,privilege,action)FROM migration_privilege_journal j WHERE migration='320'))::text,'sha256'),'hex');`);
 const before=digest(),authorityBefore=claimAuthority();
 assert.equal(owned.psql(`SELECT count(*)FROM runtime_control_commands WHERE command_id LIKE '${prefix}%';`),'19');
 await withConsoleBrowser(owned,async({origin,identityOrigin,actors:[operator],login,calls})=>{
  const signedIn=await login(operator);
  try{
   await signedIn.page.goto(origin+'/operations?history_probe=retained&oncall_page=1&page=1');
   assert.ok(calls.some(call=>call.path==='/v1/internal/console/sessions/current'&&call.status===200));
   assert.ok(calls.some(call=>call.path==='/v1/internal/console/platform-jobs'&&call.status===200));
   assert.ok(calls.some(call=>call.path==='/v1/internal/console/operations/oncall/schedules'&&call.status===200));
   await expect(signedIn.page.getByText(unavailableMessage,{exact:true})).toBeVisible();
   await expect(signedIn.page.getByText(historyWarning,{exact:true})).toBeVisible();
   // Current source fails here: legacy history401 becomes a false empty list.
   await expect(signedIn.page.getByText(visible(0),{exact:true})).toBeVisible();
   await expect(signedIn.page.getByText('No runtime commands returned.',{exact:true})).toHaveCount(0);
   assert.ok(calls.some(call=>call.path===canonicalPath&&call.status===200));
   assert.doesNotMatch(await signedIn.page.locator('body').innerText(),new RegExp(marker+'|synthetic-deleted-command'));
   await signedIn.page.getByRole('link',{name:'Next command records',exact:true}).click();
   const page2=new URL(signedIn.page.url());assert.equal(page2.searchParams.get('commands_page'),'2');
   assert.equal(page2.searchParams.get('oncall_page'),'1');assert.equal(page2.searchParams.get('page'),'1');assert.equal(page2.searchParams.get('history_probe'),'retained');
   await expect(signedIn.page.getByText(visible(17),{exact:true})).toBeVisible();
   await expect(signedIn.page.getByText(visible(0),{exact:true})).toHaveCount(0);
   await expect(signedIn.page.getByRole('link',{name:'Next command records',exact:true})).toHaveCount(0);
   await signedIn.page.getByRole('link',{name:'Previous command records',exact:true}).click();
   await expect(signedIn.page.getByText(visible(0),{exact:true})).toBeVisible();
   const reads=calls.filter(call=>call.path===canonicalPath&&call.status===200).length;let faults=0;
   const outage=tapRest(owned.restUrl,async(call,forward)=>{
    if(call.resource==='rpc/read_console_runtime_command_history_v1'){faults++;return restJson(503,{message:'synthetic-runtime-history-read-fault'});}
    return forward();
   });
   try{
    await signedIn.page.reload();
    await expect(signedIn.page.getByText('Runtime command history unavailable.',{exact:true})).toBeVisible();
    await expect(signedIn.page.getByText('No runtime commands returned.',{exact:true})).toHaveCount(0);
    await expect(signedIn.page.getByText(visible(0),{exact:true})).toHaveCount(0);
    await expect(signedIn.page.getByText(unavailableMessage,{exact:true})).toBeVisible();
    await expect(signedIn.page.getByText(historyWarning,{exact:true})).toBeVisible();
    assert.ok(faults>0);assert.equal(digest(),before);assert.equal(claimAuthority(),authorityBefore);
    assert.doesNotMatch(await signedIn.page.locator('body').innerText(),/synthetic-runtime-history-read-fault|synthetic-private-command/);
   }finally{outage.restore();}
   await signedIn.page.getByRole('link',{name:'Reload command history',exact:true}).click();
   await expect(signedIn.page.getByText(visible(0),{exact:true})).toBeVisible();
   await expect(signedIn.page.getByText('Runtime command history unavailable.',{exact:true})).toHaveCount(0);
   assert.ok(calls.filter(call=>call.path===canonicalPath&&call.status===200).length>reads);
   const sessionId=owned.psql(`SELECT s.id FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id WHERE p.legacy_user_id='${operator.id}'AND s.realm='admin'AND s.status='active'AND s.metadata->>'protocol'='platform-console-v1'AND s.metadata->>'mfa_verified_at'IS NOT NULL ORDER BY s.issued_at DESC LIMIT 1;`);
   assert.match(sessionId,/^[0-9a-f-]{36}$/);
   await signedIn.page.getByRole('button',{name:'Logout',exact:true}).click();
   await signedIn.page.waitForURL(url=>url.pathname==='/login');
   assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${sessionId}';`),'revoked');
   const afterLogout=calls.length;await signedIn.page.goto(origin+'/operations');
   await signedIn.page.waitForURL(url=>url.origin===identityOrigin&&url.pathname==='/lookup');
   assert.equal(calls.slice(afterLogout).filter(call=>call.path===canonicalPath&&call.status===200).length,0);
   assert.equal(digest(),before);assert.equal(claimAuthority(),authorityBefore);
  }catch(error){
   process.stdout.write(JSON.stringify({observation:'runtime-command-history-normal-browser',calls:calls.filter(call=>[legacyPath,canonicalPath,'/v1/internal/console/sessions/current','/v1/internal/console/platform-jobs','/v1/internal/console/operations/oncall/schedules'].includes(call.path)),falseEmptyVisible:await signedIn.page.getByText('No runtime commands returned.',{exact:true}).isVisible().catch(()=>false),expectedRecordVisible:await signedIn.page.getByText(visible(0),{exact:true}).isVisible().catch(()=>false),allCommandRowsConserved:digest()===before,legacyClaimAuthorityConserved:claimAuthority()===authorityBefore})+'\n');throw error;
  }finally{assert.equal(digest(),before,'history read must retain all command rows and stored statuses');assert.equal(claimAuthority(),authorityBefore,'history read must preserve320 claim body/ACL/journal');}
 },{makerRole:'super'});
});
