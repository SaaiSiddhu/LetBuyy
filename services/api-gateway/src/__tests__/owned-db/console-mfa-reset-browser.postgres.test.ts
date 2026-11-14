// Three actual normal local-development operator sign-ins and configured TOTP
// factors. Actual Console/Gateway/PostgREST/database; no positive credential
// injection, MFA bypass, provider email or hosted configuration change.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {expect} from '@playwright/test';
import {LETBUYY_PLATFORM_SESSION_COOKIE} from '@letbuyy/auth-core';
import {withConsoleBrowser, expectConsoleAccount,consoleBrowserTotp} from './console-browser-fixture';
import {requireOwnedDatabase} from './owned-db-support';
const owned=requireOwnedDatabase();

test('normal Console recovery binds three real sign-ins, survives lost request/effect replies, retires the old factor and accepts only the configured replacement',{timeout:600_000},async()=>{
 const evidenceRoot=ownedTmpDir() + '/letbuyy-mfa-reset-browser-'+owned.runId;mkdirSync(evidenceRoot,{recursive:true});
 await withConsoleBrowser(owned,async({origin,identityOrigin,actors:[maker,checker,target],login,calls,loseNextApprovalReply,loseNextMfaExecutionReply,rotateConfiguredFactor})=>{
  assert.ok(target);assert.notEqual(maker.factor,checker.factor);assert.notEqual(checker.factor,target.factor);const originalFactor=target.factor;
  const a=await login(maker),b=await login(checker),t=await login(target);
  // Finish on-demand protected route compilation using the cookie obtained by
  // actual forms before either operator starts a mutating approval journey.
  await a.context.request.get(origin+'/approvals');await a.context.request.get(origin+'/approvals/'+crypto.randomUUID());
  await Promise.all([a.page.waitForLoadState('networkidle'),b.page.waitForLoadState('networkidle'),t.page.waitForLoadState('networkidle')]);
  for(const headers of [{},{origin:'https://evil-store.letbuyy.com'}] as Record<string,string>[]){
   const count=calls.length,r=await a.context.request.post(origin+'/api/approvals/request-mfa-reset',{headers,form:{operator_id:target.id,reason:'Synthetic forbidden origin recovery',request_key:crypto.randomUUID()},maxRedirects:0});assert.equal(r.status(),403);assert.equal(calls.length,count,'origin denial must precede private operator lookup and mutation');
  }
  await a.page.goto(origin+'/approvals');
  const form=a.page.locator('form').filter({has:a.page.getByRole('button',{name:'Request operator MFA reset',exact:true})});await expect(form).toHaveAttribute('data-enhanced','true');
  await form.locator('select[name="operator_id"]').selectOption(target.id);await form.locator('textarea[name="reason"]').fill('Synthetic independently verified lost authenticator recovery');
  const requestKey=await form.locator('input[name="request_key"]').inputValue();loseNextApprovalReply();await form.getByRole('button',{name:'Request operator MFA reset',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('Retry the same form');await expect(form.locator('input[name="request_key"]')).toHaveValue(requestKey);await expect(form.locator('select[name="operator_id"]')).toHaveValue(target.id);await expect(form.locator('textarea[name="reason"]')).toHaveValue('Synthetic independently verified lost authenticator recovery');
  assert.equal(owned.psql(`SELECT count(*) FROM sensitive_action_approvals WHERE request_key='${requestKey}' AND action='operator.mfa.reset';`),'1');
  await form.getByRole('button',{name:'Request operator MFA reset',exact:true}).click();await a.page.waitForURL(url=>/^\/approvals\/[0-9a-f-]{36}$/.test(url.pathname));const id=new URL(a.page.url()).pathname.split('/').at(-1)!;
  await expect(a.page.getByRole('button',{name:'Approve this request',exact:true})).toHaveCount(0);await expect(a.page.getByText('A different active platform super admin must decide this request.',{exact:true})).toBeVisible();
  await a.page.screenshot({path:evidenceRoot+'/requested-recovery.png',fullPage:true});
  await b.page.goto(origin+'/approvals/'+id);const consent=b.page.locator('form').filter({has:b.page.getByRole('button',{name:'Approve this request',exact:true})});await expect(consent).toHaveAttribute('data-enhanced','true');
  await b.page.getByLabel('I independently verified this operator recovery request and reviewed the account, reason and reset effect.',{exact:true}).check();await b.page.getByRole('button',{name:'Approve this request',exact:true}).click();await expect(b.page.getByRole('button',{name:'Approve this request',exact:true})).toHaveCount(0);
  await t.page.reload();await expectConsoleAccount(t.page,target.email);assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${target.id}';`),'0','consent alone must not reset the operator');
  await a.page.reload();const execute=a.page.locator('form').filter({has:a.page.getByRole('button',{name:'Execute approved action',exact:true})});await expect(execute).toHaveAttribute('data-enhanced','true');loseNextMfaExecutionReply();
  await execute.getByRole('button',{name:'Execute approved action',exact:true}).click();await expect(execute.getByRole('alert')).toContainText('Retry the same form');
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${target.id}';`),'1');
  await execute.getByRole('button',{name:'Execute approved action',exact:true}).click();await expect(a.page.getByText(/Executed at /)).toBeVisible();await expect(a.page.getByText(/Security notification was queued at execution/)).toBeVisible();await a.page.screenshot({path:evidenceRoot+'/executed-recovery.png',fullPage:true});
  await t.page.goto(origin+'/dashboard');await t.page.waitForURL(url=>url.pathname==='/login');
  const old=await login(target,{stopAtMfa:true});await old.page.getByLabel('Authenticator code',{exact:true}).fill(consoleBrowserTotp(originalFactor));await old.page.getByRole('button',{name:'Verify',exact:true}).click();await old.page.waitForURL(url=>url.pathname==='/mfa'&&url.searchParams.get('error')==='administrator_reset_required');await expect(old.page.getByText('Administrator recovery and a newly configured authenticator are required. Contact your platform administrator.',{exact:true})).toBeVisible();await old.page.getByLabel('Authenticator code',{exact:true}).fill('');await old.page.screenshot({path:evidenceRoot+'/retired-factor-refused.png',fullPage:true});
  const blocked=await old.context.request.get(origin+'/dashboard',{maxRedirects:0});assert.ok([303,307].includes(blocked.status()));assert.match(blocked.headers().location??'',/\/mfa/);
  await rotateConfiguredFactor(target,'ONSWG4TFOQXW4ZLO');
  const restored=await login(target);await expectConsoleAccount(restored.page,target.email);await restored.page.screenshot({path:evidenceRoot+'/configured-replacement-signed-in.png',fullPage:true});
  assert.equal(owned.psql(`SELECT (metadata->'console_mfa_factor'->>'reset_required')::boolean FROM principals WHERE realm='admin' AND legacy_user_id='${target.id}';`),'f');
  await a.page.goto(origin+'/approvals/'+id);await expect(a.page.getByText(/Executed at /)).toBeVisible();await b.page.goto(origin+'/approvals/'+id);await expect(b.page.getByText(/Executed at /)).toBeVisible();
  // Configuration rollback must not revive a deliberately retired factor.
  await rotateConfiguredFactor(target,originalFactor);const rollback=await login(target,{stopAtMfa:true});await rollback.page.getByLabel('Authenticator code',{exact:true}).fill(consoleBrowserTotp(originalFactor));await rollback.page.getByRole('button',{name:'Verify',exact:true}).click();await rollback.page.waitForURL(url=>url.pathname==='/mfa'&&url.searchParams.get('error')==='administrator_reset_required');await rollback.page.getByLabel('Authenticator code',{exact:true}).fill('');await rollback.page.screenshot({path:evidenceRoot+'/retired-configuration-rollback-refused.png',fullPage:true});
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${target.id}';`),'1');assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE job_type='email.operator_mfa_reset' AND event_id='${id}';`),'1');
  // A currently authenticated administrator can request recovery of their own
  // factor, but a different active super admin must approve. The real BFF must
  // clear the revoked cookie and send them back through normal sign-in.
  await a.page.goto(origin+'/approvals');await a.page.waitForLoadState('networkidle');const selfForm=a.page.locator('form').filter({has:a.page.getByRole('button',{name:'Request operator MFA reset',exact:true})});await expect(selfForm).toHaveAttribute('data-enhanced','true');
  await selfForm.getByLabel('Operator',{exact:true}).selectOption(maker.id);await selfForm.getByLabel('Recovery reason',{exact:true}).fill('Synthetic independently reviewed self account authenticator recovery');
  await expect(selfForm.getByLabel('Operator',{exact:true})).toHaveValue(maker.id);
  const selfReply=a.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/approvals/request-mfa-reset'&&response.request().method()==='POST');
  await selfForm.getByRole('button',{name:'Request operator MFA reset',exact:true}).click();const savedSelf=await selfReply;assert.equal(savedSelf.status(),200);
  await a.page.waitForURL(url=>/^\/approvals\/[0-9a-f-]{36}$/.test(url.pathname));const selfId=new URL(a.page.url()).pathname.split('/').at(-1)!;
  await expect(a.page.getByRole('button',{name:'Approve this request',exact:true})).toHaveCount(0);await expect(a.page.getByText('The affected operator cannot decide this recovery.',{exact:true})).toBeVisible();
  await b.page.goto(origin+'/approvals/'+selfId);await b.page.getByLabel('I independently verified this operator recovery request and reviewed the account, reason and reset effect.',{exact:true}).check();await b.page.getByRole('button',{name:'Approve this request',exact:true}).click();await expect(b.page.getByRole('button',{name:'Approve this request',exact:true})).toHaveCount(0);
  await a.page.reload();await a.page.getByRole('button',{name:'Execute approved action',exact:true}).click();await a.page.waitForURL(url=>url.pathname==='/login'&&url.searchParams.get('notice')==='operator_mfa_reset');
  await expect(a.page.getByText('Your operator authenticator was reset and you were signed out. Sign in after your configuration custodian provides a replacement factor.',{exact:true})).toBeVisible();
  assert.equal((await a.context.cookies()).some(cookie=>cookie.name===LETBUYY_PLATFORM_SESSION_COOKIE),false,'confirmed self recovery must clear the revoked browser cookie');
  await a.page.screenshot({path:evidenceRoot+'/self-recovery-signed-out.png',fullPage:true});
  const signedOut=await a.context.request.get(origin+'/dashboard',{maxRedirects:0});assert.ok([303,307].includes(signedOut.status()));
  // With no operator or merchant cookie, the existing proxy returns the
  // canonical Accounts lookup entry. Inspect the redirect without visiting it.
  const signIn=new URL(signedOut.headers().location!);assert.equal(signIn.origin,new URL(identityOrigin).origin);assert.equal(signIn.pathname,'/lookup');assert.equal(signIn.searchParams.get('return_to'),origin+'/dashboard');
  await rotateConfiguredFactor(maker,'MFRGGZDFMZTWQ2LK');
  const last=Number(owned.psql(`SELECT metadata->'console_mfa_guard'->>'last_counter' FROM principals WHERE realm='admin' AND legacy_user_id='${maker.id}';`));
  while(Math.floor(Date.now()/30000)<=last)await new Promise(resolve=>setTimeout(resolve,100));
  const selfRestored=await login(maker);await selfRestored.page.goto(origin+'/approvals/'+selfId);await expect(selfRestored.page.getByText(/Executed at /)).toBeVisible();await expect(selfRestored.page.getByRole('button',{name:'Execute approved action',exact:true})).toHaveCount(0);await selfRestored.page.screenshot({path:evidenceRoot+'/self-recovery-restored-receipt.png',fullPage:true});
  assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='operator.mfa.reset' AND resource_id='${maker.id}';`),'1');assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE job_type='email.operator_mfa_reset' AND event_id='${selfId}';`),'1');
  const verdict={run_id:owned.runId,independentlyAuthenticatedActors:3,normalMagicLinkAndDistinctConfiguredTotp:true,positiveCredentialInjection:false,mfaBypass:false,lostRequestAndResetRepliesRecovered:true,oldFactorRefused:true,configuredReplacementAccepted:true,retiredConfigRollbackRefused:true,selfRequestIndependentConsentAndCookieCleared:true,selfReauthenticationReceiptRecovered:true,effectAudits:2,notificationJobs:2,providerDelivery:'pending approved access',hosted:'not applied',calls:calls.length};writeFileSync(evidenceRoot+'/verdict.json',JSON.stringify(verdict,null,2)+'\n');console.info('OWNED_OPERATOR_MFA_RECOVERY_BROWSER '+JSON.stringify(verdict));
 },{makerRole:'admin',targetRole:'lead'});
});
