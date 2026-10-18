// Normal local forms/TOTP + real Console SSR/Gateway/PostgREST/owned PostgreSQL.
// Pre-provisioned synthetic history only; no assignment, paging or provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { tapRest, restJson } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { withConsoleBrowser } from '../../services/api-gateway/src/__tests__/owned-db/console-browser-fixture';
const owned = requireOwnedDatabase();
const canonicalPath='/v1/internal/console/operations/oncall/schedules';
const legacyPath='/v1/operations/oncall/schedules';
test('normal MFA operator reads schedule history, pages, recovers an outage and durably logs out', { timeout:300000 }, async()=>{
    const suffix=crypto.randomUUID(), team='synthetic-list-'+suffix, current='Synthetic current '+suffix;
    const history=(n:number)=>'Synthetic history '+n+' '+suffix;
    const marker='synthetic-private-list-'+suffix;
    owned.script(`INSERT INTO oncall_schedules(team_name,rotation_name,starts_at,ends_at,active,paging_adapter,metadata)
      VALUES('${team}','${current}',now()-interval '10 minutes',NULL,true,'dry_run',jsonb_build_object('private_marker','${marker}'));
      INSERT INTO oncall_schedules(team_name,rotation_name,starts_at,ends_at,active,paging_adapter,metadata)
      SELECT '${team}','Synthetic history '||n||' ${suffix}',now()-interval '1 day'-n*interval '1 minute',now()-interval '1 hour',false,'dry_run',jsonb_build_object('private_marker','${marker}')FROM generate_series(0,16)n;
      INSERT INTO oncall_schedules(team_name,rotation_name,starts_at,active,paging_adapter,metadata,deleted_at)
      VALUES('${team}','Synthetic deleted ${suffix}',now(),true,'dry_run','{}',now());`);
    const digest=()=>owned.psql(`SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'[]'),'sha256'),'hex')FROM oncall_schedules s;`);
    const before=digest();
    assert.equal(owned.psql(`SELECT count(*)FROM oncall_schedules WHERE team_name='${team}';`),'19');
    await withConsoleBrowser(owned,async({origin,identityOrigin,actors:[operator],login,calls})=>{
        const signedIn=await login(operator);
        try{
            await signedIn.page.goto(origin+'/operations?oncall_probe=retained');
            assert.ok(calls.some(call=>call.path==='/v1/internal/console/sessions/current'&&call.status===200));
            assert.ok(calls.some(call=>call.path==='/v1/internal/console/platform-jobs'&&call.status===200));
            assert.ok(calls.some(call=>call.path==='/v1/internal/console/operations/oncall/current'&&call.status===200));
            await expect(signedIn.page.getByText(team+' | '+current,{exact:true})).toBeVisible();
            // The current implementation fails here: legacy list401 becomes false-empty.
            await expect(signedIn.page.getByText(history(0),{exact:true})).toBeVisible();
            await expect(signedIn.page.getByText('No on-call schedules returned.',{exact:true})).toHaveCount(0);
            assert.ok(calls.some(call=>call.path===canonicalPath&&call.status===200));
            assert.doesNotMatch(await signedIn.page.locator('body').innerText(),new RegExp(marker+'|Synthetic deleted'));
            await signedIn.page.getByRole('link',{name:'Next schedules',exact:true}).click();
            assert.equal(new URL(signedIn.page.url()).searchParams.get('oncall_page'),'2');
            assert.equal(new URL(signedIn.page.url()).searchParams.get('oncall_probe'),'retained');
            await expect(signedIn.page.getByText(history(16),{exact:true})).toBeVisible();
            await expect(signedIn.page.getByText(history(0),{exact:true})).toHaveCount(0);
            await expect(signedIn.page.getByRole('link',{name:'Next schedules',exact:true})).toHaveCount(0);
            await signedIn.page.getByRole('link',{name:'Previous schedules',exact:true}).click();
            await expect(signedIn.page.getByText(history(0),{exact:true})).toBeVisible();
            const reads=calls.filter(call=>call.path===canonicalPath&&call.status===200).length;
            let faults=0;
            const outage=tapRest(owned.restUrl,async(call,forward)=>{
                if(call.resource==='rpc/read_console_oncall_schedules_v1'){faults++;return restJson(503,{message:'synthetic-list-rpc-fault'});}
                return forward();
            });
            try{
                await signedIn.page.reload();
                await expect(signedIn.page.getByText('On-call schedules unavailable.',{exact:true})).toBeVisible();
                await expect(signedIn.page.getByText('No on-call schedules returned.',{exact:true})).toHaveCount(0);
                await expect(signedIn.page.getByText(history(0),{exact:true})).toHaveCount(0);
                assert.ok(faults>0);assert.equal(digest(),before);
                assert.doesNotMatch(await signedIn.page.locator('body').innerText(),/synthetic-list-rpc-fault|synthetic-private-list/);
            }finally{outage.restore();}
            await signedIn.page.getByRole('link',{name:'Reload schedules',exact:true}).click();
            await expect(signedIn.page.getByText(history(0),{exact:true})).toBeVisible();
            await expect(signedIn.page.getByText('On-call schedules unavailable.',{exact:true})).toHaveCount(0);
            assert.ok(calls.filter(call=>call.path===canonicalPath&&call.status===200).length>reads);
            const sessionId=owned.psql(`SELECT s.id FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id WHERE p.legacy_user_id='${operator.id}'AND s.realm='admin'AND s.status='active'AND s.metadata->>'protocol'='platform-console-v1'AND s.metadata->>'mfa_verified_at'IS NOT NULL ORDER BY s.issued_at DESC LIMIT 1;`);
            assert.match(sessionId,/^[0-9a-f-]{36}$/);
            await signedIn.page.getByRole('button',{name:'Logout',exact:true}).click();
            await signedIn.page.waitForURL(url=>url.pathname==='/login');
            assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${sessionId}';`),'revoked');
            const afterLogout=calls.length;
            await signedIn.page.goto(origin+'/operations');
            await signedIn.page.waitForURL(url=>url.origin===identityOrigin&&url.pathname==='/lookup');
            assert.equal(calls.slice(afterLogout).filter(call=>call.path===canonicalPath&&call.status===200).length,0);
            assert.equal(digest(),before);
        }catch(error){
            process.stdout.write(JSON.stringify({observation:'oncall-schedules-normal-browser',calls:calls.filter(call=>[legacyPath,canonicalPath,'/v1/internal/console/sessions/current','/v1/internal/console/platform-jobs','/v1/internal/console/operations/oncall/current'].includes(call.path)),falseEmptyVisible:await signedIn.page.getByText('No on-call schedules returned.',{exact:true}).isVisible().catch(()=>false),expectedHistoryVisible:await signedIn.page.getByText(history(0),{exact:true}).isVisible().catch(()=>false),allScheduleRowsConserved:digest()===before})+'\n');throw error;
        }finally{assert.equal(digest(),before,'read-only list must conserve every schedule row');}
    },{makerRole:'super'});
});
