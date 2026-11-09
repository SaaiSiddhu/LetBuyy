// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Cross-runtime integration: normal Identity -> Merchant Next -> Gateway -> owned PG.
// No positive credential injection, fake inventory API, or provider transaction.
import assert from 'node:assert/strict';
import test, {after, before} from 'node:test';
import {createServer, type Server} from 'node:http';
import {exportJWK} from 'jose';
import {chromium, expect, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime,
    type OwnedClientProcess, type OwnedPooledSqlProxy} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant, seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {createLocalTurnstileProvider, LOCAL_TURNSTILE_SECRET} from '../fixtures/local-turnstile-provider';

let challenge:Awaited<ReturnType<typeof createLocalTurnstileProvider>>|undefined;
const owned=requireOwnedDatabase(),site=newSyntheticTenant('stock-recovery');
const ownerId=crypto.randomUUID(),staffId=crypto.randomUUID();
const email=(id:string)=>`syn-stock-browser-${id}@example.invalid`;
let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway|undefined,browser:Browser|undefined;
let identityOrigin='',merchantOrigin='',loseReplyFor='';
let ownerA:BrowserContext,ownerB:BrowserContext,staff:BrowserContext;
const calls:{path:string;method:string;status:number;lost:boolean;key:string|null;inventoryBody?:string;productId?:string}[]=[];
const checkpoints:string[]=[];
const originalFetch=globalThis.fetch;
let refusedGatewayExternalRequests=0;

async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const p=(s.address() as {port:number}).port;await new Promise<void>(r=>s.close(()=>r()));return p;}
async function ready(url:string,app:OwnedClientProcess){const until=Date.now()+360000;while(Date.now()<until){if(app.exitCode!==null||app.signalCode!==null)throw new Error('Owned browser runtime stopped before readiness');try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).status<500)return;}catch{/* bounded owned startup */}await new Promise(r=>setTimeout(r,200));}throw new Error('Owned browser runtime readiness timed out');}
async function signIn(context:BrowserContext,id:string,password:string){
    const page=await context.newPage();let stage='Identity navigation';
    try{
        await page.goto(identityOrigin+'/login');stage='challenge';
        await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:45000});
        stage='email';await page.getByLabel('Email',{exact:true}).fill(email(id));
        await page.getByRole('button',{name:'Continue with email',exact:true}).click();
        stage='password';await page.getByLabel('Password',{exact:true}).fill(password);
        const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST'),page.getByRole('button',{name:'Log in',exact:true}).click()]);
        stage='issuer response';assert.equal(response.status(),200);
        stage='normal Merchant redirect';await page.waitForURL(url=>url.origin===merchantOrigin,{timeout:60000});
    }catch{throw new Error('Normal Identity sign-in failed at '+stage+'; private controls and responses were not retained.');}
    finally{await page.close();}
}
before(async()=>{
    // The actual Gateway may reach only this fixture's loopback services.
    // Identity verifies one-use challenges only through this run's owned local provider.
    globalThis.fetch=(async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
        if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.hostname.endsWith('.localhost')){
            refusedGatewayExternalRequests++;throw new Error('Owned stock browser fixture refused a nonlocal Gateway request');
        }
        return originalFetch(input,init);
    }) as typeof fetch;
    seedSyntheticTenant(owned.psql,site);
    const password='Synthetic-stock-browser-pass-'+crypto.randomUUID(),hash=await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES
        ('${ownerId}','${email(ownerId)}',true,'Synthetic Stock Owner','${hash}'),
        ('${staffId}','${email(staffId)}',true,'Synthetic Stock Staff','${hash}');
        UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${site.siteId}';
        INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES
        ('${staffId}','${email(staffId)}','${site.siteId}','editor','active',true,'{"granted":["products:read","products:write"]}');`);
    const identityPort=await freePort(),merchantPort=await freePort();
    identityOrigin=`http://localhost:${identityPort}`;merchantOrigin=`http://localhost:${merchantPort}`;
    proxy=await startOwnedPooledSqlProxy(owned);const keys=await newIdentityKeys();
    gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,...proxy.env()}));
    bridge=createServer(async(req,res)=>{
        const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString();
        const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
        try{
            const path=(req.url??'/').split('?')[0],method=req.method??'GET';
            const result=await gateway!.request(req.url??'/',{method,headers,...(body?{body}:{})});
            const inventoryPost=method==='POST'&&path==='/v1/inventory/adjust';
            const productId=inventoryPost?JSON.parse(body).product_id:undefined;
            const lost=inventoryPost&&productId===loseReplyFor&&result.status===200;
            calls.push({path,method,status:result.status,lost,key:inventoryPost?headers.get('X-Idempotency-Key'):null,...(inventoryPost?{inventoryBody:body,productId}:{})});
            if(lost){loseReplyFor='';res.destroy();return;} // Real stock/audit/outbox/receipt already committed.
            res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
        }catch{if(!res.destroyed){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"OWNED_BRIDGE_ERROR","message":"Owned bridge unavailable"}}');}}
    });
    await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));
    const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
    const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
    challenge=await createLocalTurnstileProvider(owned);
    identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,providerFixture:challenge.profile,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
        LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
        ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,
        LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
    merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
    await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
    browser=await chromium.launch({headless:true});ownerA=await browser.newContext();ownerB=await browser.newContext();staff=await browser.newContext();
    for(const context of [ownerA,ownerB,staff]){await challenge.attachBrowser(context,[identityOrigin,merchantOrigin]);context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(90000);}
    await signIn(ownerA,ownerId,password);await signIn(ownerB,ownerId,password);await signIn(staff,staffId,password);
    checkpoints.push('three_normal_identity_sign_ins');
},{timeout:660000});
after(async()=>{
    console.info('OWNED_INVENTORY_ADJUSTMENT_BROWSER '+JSON.stringify({runId:owned.runId,checkpoints,normalSignIns:checkpoints.includes('three_normal_identity_sign_ins')?3:0,
        positiveCredentialInjection:false,fixtureKind:'local Next production builds + actual Gateway/PostgREST/owned PostgreSQL',
        calls:calls.filter(c=>c.inventoryBody!==undefined).map(({path,method,status,lost,key,productId})=>({path,method,status,lost,key,productId})),
        gatewayExternalRequestsRefused:refusedGatewayExternalRequests,
        challengeMode:'Owned local one-use challenge provider; production anti-bot unverified',localChallengeCounts:challenge?.counts,
        runtimeSupervisors:[{kind:"merchant-next-production",pid:merchant?.pid},{kind:"identity-next-production",pid:identity?.pid}],providerTransactions:0,hostedVerified:false,privateScreenshots:false}));
    await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await challenge?.close();
    await gateway?.settle();await closePooledSqlClients();await proxy?.stop();
    if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
    globalThis.fetch=originalFetch;
    assert.equal(refusedGatewayExternalRequests,0,'The stock journey attempted an undeclared external Gateway request');
});

function product(name:string){const id=crypto.randomUUID(),variantId=crypto.randomUUID();owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status)VALUES('${id}','${site.siteId}','${site.siteId}','${name}','syn-${id}',100,10,true,'active');INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty)VALUES('${variantId}','${id}','M','SYN-STOCK-${id}',100,0);WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${site.siteId}',true)) SELECT set_inventory_level_available('${id}','${variantId}','${site.locationId}',10,'${ownerId}') FROM _fixture_inventory_scope436;`);return{id,variantId,name,levelId:owned.psql(`SELECT id FROM inventory_levels WHERE product_id='${id}' AND variant_id='${variantId}' AND location_id='${site.locationId}';`)};}
type Stock=ReturnType<typeof product>;
const endpoint=()=>`${merchantOrigin}/api/stores/${site.subdomain}/inventory/adjust`;
const row=(page:Page,p:Stock)=>page.getByRole('row').filter({has:page.getByText(p.name,{exact:true})});
function state(p:Stock){return JSON.parse(owned.psql(`SELECT jsonb_build_object('level',(SELECT to_jsonb(t)FROM inventory_levels t WHERE id='${p.levelId}'),'variant',(SELECT to_jsonb(t)FROM product_variants t WHERE id='${p.variantId}'),'product',(SELECT to_jsonb(t)FROM products t WHERE id='${p.id}'),'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY idempotency_key),'[]')FROM inventory_adjustment_receipts t WHERE product_id='${p.id}'),'audit',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')FROM inventory_adjustments t WHERE product_id='${p.id}'),'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY id),'[]')FROM outbox_events t WHERE aggregate_id='${p.id}'AND event_type='inventory.level.adjusted'))::text;`));}
const adjustments=(p:Stock)=>state(p).audit.filter((r:{note:string})=>r.note==='Adjusted from admin inventory screen');
async function inventory(context:BrowserContext,p:Stock){const page=await context.newPage();const[reply]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${site.subdomain}/inventory/levels`),page.goto(`${merchantOrigin}/${site.subdomain}/products/inventory`)]);assert.equal(reply.status(),200);const loaded=(await reply.json()).data.find((r:{id:string})=>r.id===p.levelId);assert.ok(loaded);assert.equal(loaded.product_id,p.id);assert.equal(loaded.variant_id,p.variantId);assert.equal(loaded.location_id,site.locationId);assert.equal(loaded.available,state(p).level.available);await expect(row(page,p)).toBeVisible();return page;}
async function waitAdjustment(page:Page,p:Stock,action:()=>Promise<unknown>){const[reply]=await Promise.all([page.waitForResponse(r=>r.url()===endpoint()&&r.request().method()==='POST'&&r.request().postDataJSON().product_id===p.id),action()]);return reply;}
async function adjust(page:Page,p:Stock,target:number){await row(page,p).getByRole('button',{name:'Adjust',exact:true}).click();await row(page,p).getByRole('spinbutton',{name:'Available quantity',exact:true}).fill(String(target));return waitAdjustment(page,p,()=>row(page,p).getByRole('button',{name:'Save',exact:true}).click());}
async function retry(page:Page,p:Stock){return waitAdjustment(page,p,()=>page.getByRole('button',{name:'Retry pending adjustment',exact:true}).click());}

test('normal staff reads and adjusts one captured stock level with one actor-bound command and mandatory audit/outbox',{timeout:300000},async()=>{
 const p=product('Synthetic staff stock '+crypto.randomUUID()),page=await inventory(staff,p);
 try{const reply=await adjust(page,p,12);assert.equal(reply.status(),200,await reply.text());const body=reply.request().postDataJSON();assert.equal(body.adjustment,2);assert.equal(body.variant_id,p.variantId);assert.equal(body.location_id,site.locationId);assert.equal(reply.request().headers()['x-letbuyy-merchant-context'],staffId);assert.ok(reply.request().headers()['x-idempotency-key']);const committed=state(p);assert.equal(committed.level.available,12);assert.equal(committed.level.id,p.levelId);assert.equal(committed.variant.inventory_qty,12);assert.equal(committed.receipts.length,1);assert.equal(committed.receipts[0].actor_id,staffId);assert.equal(adjustments(p).length,1);assert.equal(adjustments(p)[0].created_by,staffId);assert.equal(committed.outbox.length,1);await expect(row(page,p).getByRole('cell').nth(2)).toHaveText('12');checkpoints.push('normal_staff_captured_level_delta_actor_one_receipt_audit_outbox');}finally{await page.close();}
});

test('committed stock HTTP loss reloads the same command and preserves an independent normal stock adjustment',{timeout:240000},async()=>{
 const p=product('Synthetic lost stock '+crypto.randomUUID()),page=await inventory(staff,p);
 try{loseReplyFor=p.id;const lost=await adjust(page,p,12);assert.ok(lost.status()>=500);const original=lost.request().postData(),key=lost.request().headers()['x-idempotency-key'];assert.equal(state(p).level.available,12);assert.equal(state(p).receipts.length,1);await expect(page.getByRole('button',{name:'Retry pending adjustment',exact:true})).toBeVisible();
  const other=await inventory(ownerB,p);try{assert.equal((await adjust(other,p,9)).status(),200);}finally{await other.close();}const before=state(p);assert.equal(before.level.available,9);assert.equal(before.receipts.length,2);
  await page.reload();await expect(page.getByRole('button',{name:'Retry pending adjustment',exact:true})).toBeVisible();const recovered=await retry(page,p);assert.equal(recovered.status(),200);assert.equal(recovered.request().postData(),original);assert.equal(recovered.request().headers()['x-idempotency-key'],key);assert.deepEqual(state(p),before);await expect(row(page,p).getByRole('cell').nth(2)).toHaveText('9');assert.equal(adjustments(p).length,2);assert.equal(before.outbox.length,2);checkpoints.push('real_committed_HTTP_loss_reload_exact_body_key_preserves_other_delta');
 }finally{loseReplyFor='';await page.close();}
});

test('two normal stock views retain their originally captured additive deltas and show the actual current result',{timeout:240000},async()=>{
 const p=product('Synthetic concurrent stock '+crypto.randomUUID()),a=await inventory(ownerA,p),b=await inventory(ownerB,p);
 try{const first=await adjust(a,p,12),second=await adjust(b,p,13);assert.equal(first.status(),200);assert.equal(second.status(),200);assert.equal(first.request().postDataJSON().adjustment,2);assert.equal(second.request().postDataJSON().adjustment,3);assert.notEqual(first.request().headers()['x-idempotency-key'],second.request().headers()['x-idempotency-key']);assert.equal(state(p).level.available,15);assert.equal(state(p).receipts.length,2);assert.equal(adjustments(p).length,2);assert.equal(state(p).outbox.length,2);await expect(row(b,p).getByRole('cell').nth(2)).toHaveText('15');checkpoints.push('normal_independent_views_signed_deltas_additive_no_silent_retarget');}finally{await a.close();await b.close();}
});

test('a captured staff stock form refuses another normally signed-in account and recovers only after the intended account returns',{timeout:240000},async()=>{
 const p=product('Synthetic stock account '+crypto.randomUUID()),page=await inventory(staff,p),cookies=await staff.cookies(merchantOrigin);
 try{const before=state(p);await staff.addCookies(await ownerA.cookies(merchantOrigin));const denied=await adjust(page,p,12);assert.equal(denied.status(),409);assert.equal((await denied.json()).error.code,'SESSION_CONTEXT_CHANGED');assert.deepEqual(state(p),before);await expect(page.getByRole('heading',{name:'Account or store access changed',exact:true})).toBeVisible();const original=denied.request().postData(),key=denied.request().headers()['x-idempotency-key'];await staff.addCookies(cookies);await page.reload();const recovered=await retry(page,p);assert.equal(recovered.status(),200);assert.equal(recovered.request().postData(),original);assert.equal(recovered.request().headers()['x-idempotency-key'],key);assert.equal(state(p).level.available,12);assert.equal(state(p).receipts.length,1);assert.equal(state(p).receipts[0].actor_id,staffId);assert.equal(adjustments(p).length,1);checkpoints.push('normally_authenticated_cookie_switch_refused_before_effect_same_command_recovered');}finally{await staff.addCookies(cookies);await page.close();}
});

test('live staff and owner revocation block committed receipt recovery until authority is restored',{timeout:300000},async()=>{
 for(const kind of ['staff','owner']){
  const p=product('Synthetic stock revoked '+kind+' '+crypto.randomUUID()),context=kind==='staff'?staff:ownerA,page=await inventory(context,p);
  try{loseReplyFor=p.id;const lost=await adjust(page,p,12);assert.ok(lost.status()>=500);const original=lost.request().postData(),key=lost.request().headers()['x-idempotency-key'],before=state(p);assert.equal(before.receipts.length,1);
   if(kind==='staff')owned.psql(`UPDATE employees SET permissions='{"granted":["products:read"]}'WHERE user_id='${staffId}'AND store_id='${site.siteId}';`);else owned.psql(`UPDATE sites SET custom_user_id='${staffId}'WHERE id='${site.siteId}';`);
   try{const denied=await retry(page,p);assert.ok([403,404].includes(denied.status()));assert.equal(denied.request().postData(),original);assert.deepEqual(state(p),before);}finally{if(kind==='staff')owned.psql(`UPDATE employees SET permissions='{"granted":["products:read","products:write"]}'WHERE user_id='${staffId}'AND store_id='${site.siteId}';`);else owned.psql(`UPDATE sites SET custom_user_id='${ownerId}'WHERE id='${site.siteId}';`);}
   await page.reload();const recovered=await retry(page,p);assert.equal(recovered.status(),200);assert.equal(recovered.request().postData(),original);assert.equal(recovered.request().headers()['x-idempotency-key'],key);assert.deepEqual(state(p),before);assert.equal(adjustments(p).length,1);assert.equal(before.outbox.length,1);
  }finally{loseReplyFor='';await page.close();}
 }
 checkpoints.push('live_staff_write_and_owner_revocation_before_committed_receipt_replay');
});
