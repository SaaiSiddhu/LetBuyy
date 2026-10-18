// Normal local Identity magic-link and TOTP sign-ins, mounted Console forms,
// real Gateway/PostgREST/353 transactions and original loyalty worker. Only
// named error replies are lost after the actual transaction commits.
import assert from 'node:assert/strict';
import test from 'node:test';
import {expect} from '@playwright/test';
import {withConsoleBrowser} from '../../services/api-gateway/src/__tests__/owned-db/console-browser-fixture';
import {tapRest,restJson} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {consumeLoyaltyRefundJobs} from '../../services/queue-workers/src/platform-queue-consumer';
const owned=requireOwnedDatabase();

async function exhaustedDebt() {
 const site=newSyntheticTenant('jobrec-'+crypto.randomUUID().slice(0,8));seedSyntheticTenant(owned.psql,site);
 const owner=crypto.randomUUID(),buyer=crypto.randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified)VALUES('${owner}','syn-job-owner-${owner}@example.invalid',true);
 UPDATE sites SET custom_user_id='${owner}'WHERE id='${site.siteId}';
 INSERT INTO buyer_accounts(id,email,email_verified)VALUES('${buyer}','syn-job-buyer-${buyer}@example.invalid',true);
 SELECT set_loyalty_program('${site.siteId}',p_is_active=>true,p_earn_rate_bps=>10000,p_actor_id=>'${owner}',p_actor_type=>'user');`);
 const paid=seedSyntheticOrder(owned.psql,site);
 owned.psql(`UPDATE orders SET payment_status='paid'WHERE id='${paid.orderId}';
 INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis)VALUES('${paid.orderId}','${buyer}','${site.siteId}','authenticated_checkout');
 SELECT award_loyalty_points('${site.siteId}','${buyer}','${paid.orderId}','syn-job-earn-${paid.orderId}');`);
 const order=owned.psql(`SELECT create_checkout_order_for_buyer('${buyer}',1,'${site.siteId}','Synthetic Job Buyer','syn-job-buyer-${buyer}@example.invalid','9000000099',
 '{"line1":"Fixture","city":"Bengaluru","state":"Karnataka","state_code":"29"}',
 '[{"product_id":"${paid.productId}","quantity":1}]','cod',NULL,NULL,NULL,'standard','syn-job-checkout-${crypto.randomUUID()}',NULL,NULL,NULL,NULL,NULL,NULL,50)->>'id';`);
 owned.psql(`UPDATE orders SET status='cancelled'WHERE id='${order}';SELECT enqueue_pending_loyalty_refunds_v1(100);`);
 const job=owned.psql(`SELECT id FROM platform_queue_jobs WHERE queue_name='loyalty-refunds'AND site_id='${site.siteId}';`);
 assert.ok(job);
 // Simulated exhausted retry state, retaining the canonical persisted job/source.
 owned.psql(`UPDATE platform_queue_jobs SET status='dead',attempts=max_attempts,failed_at=now(),error_message='Synthetic exhausted transient recovery',result='{"synthetic_private_marker":"do-not-project"}'WHERE id='${job}';`);
 const balance=()=>owned.psql(`SELECT loyalty_balance(id)FROM loyalty_accounts WHERE site_id='${site.siteId}'AND buyer_account_id='${buyer}';`);
 const credits=()=>owned.psql(`SELECT count(*)FROM loyalty_ledger_entries WHERE order_id='${order}'AND entry_type='refund_credit';`);
 return {...site,owner,buyer,order,job,balance,credits};
}

test('normal distinct super admins inspect, independently approve and recover lost review/execution replies with one original worker credit', {timeout:300000},async()=>{
 const debt=await exhaustedDebt();
 await withConsoleBrowser(owned,async({origin,actors:[maker,checker],login,calls,loseNextJobApprovalReply,loseNextJobExecutionReply})=>{
  const a=await login(maker),b=await login(checker);
  for(const operation of ['request-job-recovery','decision','execute']){
   const denied=await a.context.request.post(origin+'/api/approvals/'+operation,{headers:{Origin:'https://hostile.example.invalid'},form:{job_id:debt.job},maxRedirects:0});
   assert.equal(denied.status(),403);
  }
  await a.page.goto(origin+'/operations?site_id='+crypto.randomUUID());
  await expect(a.page.getByText('No exhausted loyalty jobs found.',{exact:true})).toBeVisible();
  const outage=tapRest(owned.restUrl,async(call,forward)=>call.resource==='rpc/read_console_platform_jobs_v1'
   ?restJson(503,{message:'Synthetic private job inspection failure'}):forward());
  try{
   await a.page.goto(origin+'/operations?job_id='+debt.job);
   await expect(a.page.getByText(/Recovery inspection unavailable\./)).toBeVisible();
   await expect(a.page.getByRole('button',{name:'Request independent recovery approval',exact:true})).toHaveCount(0);
   assert.doesNotMatch(await a.page.locator('body').innerText(),/Synthetic private job inspection failure|do-not-project|synthetic_private_marker/);
  }finally{outage.restore();}
  await a.page.goto(origin+'/operations?job_id='+debt.job);
  await expect(a.page.getByRole('heading',{name:'Exhausted loyalty recovery',exact:true})).toBeVisible();
  const card=a.page.getByRole('article',{name:'Recovery job '+debt.job,exact:true}),form=card.locator('form');
  await expect(form).toHaveAttribute('data-enhanced','true');
  await expect(card.getByText('dead · 10 attempts used of 10',{exact:true})).toBeVisible();
  const reason='Synthetic browser independently reviewed original loyalty debt';
  await form.getByLabel('Recovery reason',{exact:true}).fill(reason);
  await expect(form.getByLabel('Recovery reason',{exact:true})).toHaveValue(reason);
  const requestKey=await form.locator('input[name="request_key"]').inputValue();
  const sessionId=await form.locator('input[name="expected_session_id"]').inputValue();
  // Observe the real committed request while withholding its reply briefly;
  // the named fixture hook then replaces only that reply with an error.
  let release!:()=>void,committed!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;}),seen=new Promise<void>(resolve=>{committed=resolve;});
  let observing=true;
  const observer=tapRest(owned.restUrl,async(call,forward)=>{
   const response=await forward();
   if(observing&&call.resource==='rpc/create_console_platform_job_recovery_v1'){
    observing=false;committed();await Promise.race([held,new Promise<void>(resolve=>setTimeout(resolve,15000))]);
   }
   return response;
  });
  loseNextJobApprovalReply();
  try{
   await form.getByRole('button',{name:'Request independent recovery approval',exact:true}).click();
   await seen;
   await expect(form.getByRole('button',{name:'Saving review…',exact:true})).toBeDisabled();
   await expect(form.locator('fieldset')).toHaveAttribute('disabled','');
   await expect(form.getByLabel('Recovery reason',{exact:true})).toBeDisabled();
  }finally{release();observer.restore();}
  await expect(form.getByRole('alert')).toContainText('Retry the same form');
  const count=()=>owned.psql(`SELECT count(*)FROM sensitive_action_approvals WHERE action='platform.job.redrive'AND resource_id='${debt.job}';`);
  assert.equal(count(),'1');assert.equal(debt.credits(),'0');assert.equal(debt.balance(),'149');
  await a.page.reload();
  const restored=a.page.getByRole('article',{name:'Recovery job '+debt.job,exact:true}).locator('form');
  await expect(restored).toHaveAttribute('data-enhanced','true');
  await expect(restored.getByLabel('Recovery reason',{exact:true})).toHaveValue(reason);
  await expect(restored.locator('input[name="request_key"]')).toHaveValue(requestKey);
  await expect(restored.locator('input[name="expected_session_id"]')).toHaveValue(sessionId);
  await restored.getByRole('button',{name:'Request independent recovery approval',exact:true}).click();
  await a.page.waitForURL(url=>/^\/approvals\/[0-9a-f-]{36}$/.test(url.pathname));
  const id=new URL(a.page.url()).pathname.split('/').at(-1)!;
  assert.equal(count(),'1');
  await expect(a.page.locator('dd').filter({hasText:debt.order})).toBeVisible();
  await expect(a.page.getByText('dead · 10 used of 10',{exact:true})).toHaveCount(2);
  await expect(a.page.getByRole('button',{name:'Approve this request',exact:true})).toHaveCount(0);
  await expect(a.page.getByRole('button',{name:'Execute approved action',exact:true})).toHaveCount(0);
  // A captured real browser session is still refused by the canonical maker /
  // checker protocol when it tries to approve its own request.
  const hash=owned.psql(`SELECT payload_hash FROM sensitive_action_approvals WHERE id='${id}';`);
  const self=await a.context.request.post(origin+'/api/approvals/decision',{headers:{Origin:origin,Accept:'application/json'},form:{approval_id:id,payload_hash:hash,decision:'approve',reviewed:'yes'},maxRedirects:0});
  assert.equal(self.status(),403);assert.equal(debt.credits(),'0');
  await b.page.goto(origin+'/approvals/'+id);
  const review=b.page.locator('form').filter({has:b.page.getByRole('button',{name:'Approve this request',exact:true})});
  await expect(review).toHaveAttribute('data-enhanced','true');
  await expect(b.page.locator('dd').filter({hasText:debt.order})).toBeVisible();
  await review.getByLabel('I reviewed this job, original order, recorded points and one-attempt retry.',{exact:true}).check();
  await review.getByRole('button',{name:'Approve this request',exact:true}).click();
  await expect(b.page.getByRole('button',{name:'Approve this request',exact:true})).toHaveCount(0);
  assert.equal(owned.psql(`SELECT checker_actor_id FROM sensitive_action_approvals WHERE id='${id}';`),checker.id);
  assert.equal(debt.credits(),'0');assert.equal(owned.psql(`SELECT max_attempts FROM platform_queue_jobs WHERE id='${debt.job}';`),'10');
  await a.page.reload();
  const execute=a.page.locator('form').filter({has:a.page.getByRole('button',{name:'Execute approved action',exact:true})});
  await expect(execute).toHaveAttribute('data-enhanced','true');
  loseNextJobExecutionReply();
  await execute.getByRole('button',{name:'Execute approved action',exact:true}).click();
  await expect(execute.getByRole('alert')).toContainText('Retry the same form');
  const state=()=>owned.psql(`SELECT status||'|'||attempts||'|'||max_attempts FROM platform_queue_jobs WHERE id='${debt.job}';`);
  assert.equal(state(),'queued|10|11');assert.equal(debt.credits(),'0');
  await execute.getByRole('button',{name:'Execute approved action',exact:true}).click();
  await expect(a.page.getByText(/Executed at /)).toBeVisible();
  assert.equal(state(),'queued|10|11');
  assert.equal(owned.psql(`SELECT count(*)FROM audit_logs WHERE action='platform.job.redriven'AND resource_id='${debt.job}';`),'1');
  await consumeLoyaltyRefundJobs(owned.restEnv(),'syn-browser-redrive-'+crypto.randomUUID());
  assert.equal(state(),'succeeded|11|11');assert.equal(debt.credits(),'1');assert.equal(debt.balance(),'199');
  await a.page.reload();
  await expect(a.page.getByText('succeeded · 11 used of 11',{exact:true})).toBeVisible();
  await expect(a.page.getByText('One additional attempt was authorized. The current job state above reports worker progress; approval alone does not establish a point restoration.',{exact:true})).toBeVisible();
  await a.page.goto(origin+'/operations?job_id='+debt.job);
  await expect(a.page.getByRole('button',{name:'Request independent recovery approval',exact:true})).toHaveCount(0);
  assert.equal(debt.credits(),'1');
  assert.ok(calls.some(row=>row.path.endsWith('/platform-jobs/'+debt.job+'/approvals')&&row.status===201));
  assert.ok(calls.some(row=>row.path.endsWith('/platform-jobs/'+debt.job+'/redrive')&&row.status===200));
  console.info('OWNED_JOB_RECOVERY_BROWSER '+JSON.stringify({normalDistinctSuperTotpSignIns:2,wrongOriginDenied:true,selfApprovalDenied:true,
   inspectionEmptyAndFailureStates:true,pendingState:true,scopedDraftSurvivesLostCommitReplyAndReload:true,oneReview:true,
   executionReplyRecovered:true,oneAttemptGranted:true,oneOriginalWorkerCredit:true,privateJobPayloadNotProjected:true,localOnly:true,emailDelivery:'pending'}));
  await a.context.close();await b.context.close();
 },{makerRole:'super'});
});
