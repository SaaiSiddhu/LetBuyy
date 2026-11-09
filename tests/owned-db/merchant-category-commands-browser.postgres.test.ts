import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Cross-runtime integration: normal Identity -> Merchant Next -> Gateway -> owned PG.
// No positive credential injection, fake collection API, or provider transaction.
import assert from 'node:assert/strict';
import {createHash}from 'node:crypto';
import {createLocalTurnstileProvider,LOCAL_TURNSTILE_SECRET} from '../fixtures/local-turnstile-provider';
import test, {after, before} from 'node:test';
import {createServer, type Server} from 'node:http';
import {exportJWK} from 'jose';
import {chromium, expect, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET, tapRest, restJson, type RestTap} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime,
    type OwnedClientProcess, type OwnedPooledSqlProxy} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant, seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

let challenge:Awaited<ReturnType<typeof createLocalTurnstileProvider>>|undefined;
const owned=requireOwnedDatabase(),site=newSyntheticTenant('category-browser');
const screenshotRoot=join(tmpdir(),'letbuyy-collections-browser-'+owned.runId),screenshots:string[]=[];
const ownerId=crypto.randomUUID();
const email=(id:string)=>`syn-category-browser-${id}@example.invalid`;
let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway|undefined,browser:Browser|undefined;
let identityOrigin='',merchantOrigin='';
let failProductReads=false, failedProductReads=0, restTap:RestTap|undefined;
let owner:BrowserContext;
let loseNextCategoryReply=false,lostReplies=0,loseCollectionReplies=false,lostCollectionReplies=0,loseNextMembershipReply=false,lostMembershipReplies=0;
const calls:{path:string;method:string;status:number;wireStatus:number;key:string|null;bodySha256:string}[]=[];
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
    mkdirSync(screenshotRoot,{mode:0o700});
    // The actual Gateway may reach only this fixture's loopback services.
    // Identity verifies one-use challenges only through this run's owned local provider.
    globalThis.fetch=(async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
        if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.hostname.endsWith('.localhost')){
            refusedGatewayExternalRequests++;throw new Error('Owned category browser fixture refused a nonlocal Gateway request');
        }
        return originalFetch(input,init);
    }) as typeof fetch;
    seedSyntheticTenant(owned.psql,site);
    const password='Synthetic-collection-browser-pass-'+crypto.randomUUID(),hash=await hashMerchantPassword(password);
    owned.psql("INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('"+ownerId+"','"+email(ownerId)+"',true,'Synthetic Collection Owner','"+hash+"'); UPDATE sites SET custom_user_id='"+ownerId+"'WHERE id='"+site.siteId+"';");
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
            const categoryLoss=loseNextCategoryReply&&method==='PATCH'&&path.startsWith('/v1/categories/')&&result.status===200;
            const collectionLoss=loseCollectionReplies&&['POST','PATCH','DELETE'].includes(method)&&/^\/v1\/(?:products\/collections|smart-collections)(?:\/[^/]+)?$/.test(path)&&result.status<300;
            const membershipLoss=loseNextMembershipReply&&method==='PUT'&&/^\/v1\/products\/collections\/[^/]+\/products$/.test(path)&&result.status===200;
            if(membershipLoss){loseNextMembershipReply=false;lostMembershipReplies++;}
            const lose=categoryLoss||collectionLoss||membershipLoss;
            if(categoryLoss){loseNextCategoryReply=false;lostReplies++;}
            if(collectionLoss)lostCollectionReplies++;
            const wireStatus=lose?503:result.status;
            calls.push({path,method,status:result.status,wireStatus,key:headers.get('x-idempotency-key'),bodySha256:createHash('sha256').update(body).digest('hex')});
            res.writeHead(wireStatus,lose?{'Content-Type':'application/json'}:Object.fromEntries(result.headers.entries()));res.end(lose?JSON.stringify({error:{code:'SYNTHETIC_REPLY_LOST',message:'The save reply was lost. Recover the original request.'}}):result.text);
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
    restTap=tapRest(owned.restUrl,async(call,forward)=>{
        if(failProductReads&&call.method==='GET'&&call.resource==='products'){
            failedProductReads++;
            return restJson(503,{code:'XX000',message:'relation "syn_private_preview_fault" does not exist',details:'synthetic-private-detail'});
        }
        return forward();
    });
    browser=await chromium.launch({headless:true});owner=await browser.newContext();
    await challenge.attachBrowser(owner,[identityOrigin,merchantOrigin]);owner.setDefaultTimeout(30000);owner.setDefaultNavigationTimeout(90000);
    await signIn(owner,ownerId,password);
    for(const name of ['Synthetic red cotton','Synthetic blue cotton']){
      const id=crypto.randomUUID();owned.psql(`INSERT INTO products(id,store_id,name,slug,price,is_active,category,status,stock)VALUES('${id}','${site.siteId}','${name}','syn-${id}',99,true,'Synthetic cotton','active',5);`);
    }
    checkpoints.push('one_normal_identity_owner_sign_in');
},{timeout:660000});
after(async()=>{
    console.info('OWNED_CATEGORY_BROWSER '+JSON.stringify({runId:owned.runId,checkpoints,
        normalSignIns:checkpoints.includes('one_normal_identity_owner_sign_in')?1:0,
        positiveCredentialInjection:false,positiveAPIFake:false,
        fixtureKind:'compiled production-mode local Next runtimes + actual Gateway/PostgREST/owned PostgreSQL',
        categoryCalls:calls.filter(c=>c.path.startsWith('/v1/categories')),
        collectionCalls:calls.filter(c=>/^\/v1\/(?:products\/collections|smart-collections)/.test(c.path)),lostCollectionReplies,lostMembershipReplies,
        failedProductReads,gatewayExternalRequestsRefused:refusedGatewayExternalRequests,
        challengeMode:'Owned local one-use challenge provider; production anti-bot unverified',localChallengeCounts:challenge?.counts,
        runtimeSupervisors:[{kind:'merchant-next-production',pid:merchant?.pid},{kind:'identity-next-production',pid:identity?.pid}],
        providerTransactions:0,hostedVerified:false,syntheticScreenshots:screenshots.map(name=>join(screenshotRoot,name))}));
    failProductReads=false;loseNextMembershipReply=false;
    await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await challenge?.close();
    await gateway?.settle();restTap?.restore();await closePooledSqlClients();await proxy?.stop();
    if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
    globalThis.fetch=originalFetch;
    assert.equal(refusedGatewayExternalRequests,0,'The preview journey attempted an undeclared external Gateway request');
});

const categoryPath='/api/stores/'+site.subdomain+'/categories';
async function openCategories(){
 const page=await owner.newPage();await page.goto(merchantOrigin+'/'+site.subdomain+'/categories');
 await expect(page.getByText('Synthetic cotton',{exact:true})).toBeVisible();return page;
}
test('normal owner category rename recovers a committed reply loss after reload with one effect',{timeout:300000},async()=>{
 const page=await openCategories(),id=owned.psql(`SELECT id FROM product_categories WHERE store_id='${site.siteId}'AND name='Synthetic cotton'AND deleted_at IS NULL`);
 try{
  await page.getByRole('button',{name:'Edit category Synthetic cotton',exact:true}).click();await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Synthetic cotton');
  await page.getByLabel('Name',{exact:true}).fill('Synthetic renamed cotton');loseNextCategoryReply=true;
  const [lost]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===categoryPath+'/'+id&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Update category',exact:true}).click()]);
  assert.equal(lost.status(),503,await lost.text());
  await expect(page.getByRole('button',{name:'Retry original category request',exact:true})).toBeEnabled();assert.equal(lostReplies,1);
  await page.reload();await expect(page.getByRole('button',{name:'Retry original category request',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry original category request',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry original category request',exact:true})).toHaveCount(0);await expect(page.getByText('Category saved. 2 assigned products updated.',{exact:true})).toBeVisible();
  const writes=calls.filter(c=>c.method==='PATCH'&&c.path==='/v1/categories/'+id);assert.equal(writes.length,2);assert.deepEqual(writes.map(c=>c.wireStatus),[503,200]);assert.equal(writes[0].key,writes[1].key);assert.equal(writes[0].bodySha256,writes[1].bodySha256);
  assert.equal(owned.psql(`SELECT count(*)FROM products WHERE store_id='${site.siteId}'AND category='Synthetic renamed cotton'AND deleted_at IS NULL`),'2');
  assert.equal(owned.psql(`SELECT count(*)FROM product_category_command_receipts WHERE category_id='${id}'`),'1');
  assert.equal(owned.psql(`SELECT count(*)FROM product_edit_receipts WHERE store_id='${site.siteId}'`),'2');
  assert.equal(owned.psql(`SELECT count(*)FROM audit_activity_events WHERE resource_type='product_category'AND resource_id='${id}'AND action='category.update'`),'1');
  assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE event_type='category.metadata.updated'AND aggregate_id='${id}'`),'1');
  checkpoints.push('normal_web_rename_restart_original_key_recovery_one_receipt_audit_outbox_two_canonical_product_edits');
 }finally{await page.close();}
});
test('normal owner creates and deletes an empty category with confirmed readback',{timeout:300000},async()=>{
 const page=await owner.newPage();
 try{
  await page.goto(merchantOrigin+'/'+site.subdomain+'/categories');await expect(page.getByText(/^Synthetic(?: renamed)? cotton$/)).toBeVisible();
  await page.getByRole('button',{name:'Add category',exact:true}).click();await expect(page.getByLabel('Name',{exact:true})).toBeVisible();
  await page.getByLabel('Name',{exact:true}).fill('Synthetic empty web category');
  await expect(page.getByRole('button',{name:'Add category',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Discard category fields',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Discard unsaved category fields?',exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Synthetic empty web category');
  await page.getByRole('button',{name:'Create category',exact:true}).click();
  await expect(page.getByText('Synthetic empty web category',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Delete category Synthetic empty web category',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Delete category',exact:true}).click();
  await expect(page.getByText('Category deleted.',{exact:true})).toBeVisible();await expect(page.getByText('Synthetic empty web category',{exact:true})).toHaveCount(0);
  assert.equal(owned.psql(`SELECT count(*)FROM product_categories WHERE store_id='${site.siteId}'AND name='Synthetic empty web category'AND deleted_at IS NOT NULL`),'1');
  checkpoints.push('normal_web_create_confirmed_readback_then_empty_soft_delete');
 }finally{await page.close();}
});
test('signed-in BFF rejects stale actor, cross-origin and mismatched store before mutation',{timeout:300000},async()=>{
 const page=await owner.newPage();try{
  await page.goto(merchantOrigin+'/'+site.subdomain+'/categories');await expect(page.getByText(/^Synthetic(?: renamed)? cotton$/)).toBeVisible();
  const count=()=>owned.psql(`SELECT count(*)FROM product_category_command_receipts WHERE store_id='${site.siteId}'`),before=count();
  const key=crypto.randomUUID(),body={store_id:site.siteId,idempotency_key:key,name:'Synthetic rejected request'};
  for(const [headers,data,status]of [
   [{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':crypto.randomUUID(),'X-Idempotency-Key':key},body,409],
   [{Origin:'https://foreign.synthetic.invalid','X-LetBuyy-Merchant-Context':ownerId,'X-Idempotency-Key':key},body,403],
   [{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':ownerId,'X-Idempotency-Key':key},{...body,store_id:crypto.randomUUID()},400],
  ]as const){const response=await page.request.post(merchantOrigin+categoryPath,{headers,data});assert.equal(response.status(),status);assert.equal(response.headers()['cache-control'],'private, no-store');}
  assert.equal(count(),before);checkpoints.push('normal_session_bff_stale_actor_origin_and_store_denials_zero_effects');
 }finally{await page.close();}
});

test('normal manual collection creation survives committed reply loss and page restart with one exact receipt',{timeout:300000},async()=>{
 const page=await owner.newPage(),title='Synthetic recovered manual collection';
 try{
  await page.goto(`${merchantOrigin}/${site.subdomain}/products/collections`);
  await expect(page.getByRole('button',{name:'New collection',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'New collection',exact:true}).click();
  await page.getByLabel('Collection title',{exact:true}).fill(title);
  loseCollectionReplies=true;
  await page.getByRole('button',{name:'Create collection',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry original collection save',exact:true})).toBeEnabled();
  assert(lostCollectionReplies>0);
  await page.reload();await expect(page.getByRole('button',{name:'Retry original collection save',exact:true})).toBeVisible();
  await page.screenshot({path:join(screenshotRoot,'manual-original-recovery.png'),fullPage:true});screenshots.push('manual-original-recovery.png');
  loseCollectionReplies=false;await page.getByRole('button',{name:'Retry original collection save',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry original collection save',exact:true})).toHaveCount(0);
  await expect(page.getByRole('row').filter({hasText:title})).toBeVisible();
  const id=owned.psql(`SELECT id FROM collections WHERE store_id='${site.siteId}'AND title='${title}'`);
  assert.match(id,/^[a-f0-9-]{36}$/);assert.equal(owned.psql(`SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${id}'`),'1');
  assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE event_type='collection.metadata.updated'AND aggregate_id='${id}'`),'1');
  const writes=calls.filter(c=>c.path==='/v1/products/collections'&&c.method==='POST');assert(writes.length>=2);
  assert.equal(new Set(writes.map(c=>c.key)).size,1);assert.notEqual(writes[0].key,null);assert.equal(new Set(writes.map(c=>c.bodySha256)).size,1);
  checkpoints.push('normal_manual_collection_create_reply_loss_reload_exact_key_body_one_effect');
 }finally{loseCollectionReplies=false;await page.close();}
});
test('normal smart rule publication reaches public collection results and stale tabs keep their edits',{timeout:300000},async()=>{
 const a=await owner.newPage(),b=await owner.newPage(),title='Synthetic published smart collection';
 try{
  await a.goto(`${merchantOrigin}/${site.subdomain}/products/smart-collections`);
  await expect(a.getByRole('button',{name:'Create collection',exact:true})).toBeEnabled();
  await a.getByRole('button',{name:'Create collection',exact:true}).click();
  await a.getByLabel('Collection name',{exact:true}).fill(title);await a.getByLabel('Slug',{exact:true}).fill('synthetic-smart-public');
  await a.getByRole('button',{name:'Add condition',exact:true}).click();await a.getByLabel('Rule 1 value',{exact:true}).fill('cotton');
  await a.getByLabel('Published on storefront',{exact:true}).check();await a.getByRole('button',{name:'Save collection',exact:true}).click();
  await expect(a.getByRole('button',{name:'Edit '+title,exact:true})).toBeVisible();
  const id=owned.psql(`SELECT id FROM collections WHERE store_id='${site.siteId}'AND title='${title}'`);assert.match(id,/^[a-f0-9-]{36}$/);
  await a.getByRole('button',{name:'Edit '+title,exact:true}).click();await a.getByRole('button',{name:'Preview saved rules',exact:true}).click();
  await expect(a.getByRole('status').filter({hasText:'2 matching products'})).toBeVisible();
  const publicResult=await gateway!.request(`/v1/storefront/${site.subdomain}/collections/${id}`);assert.equal(publicResult.status,200,publicResult.text);
  await a.screenshot({path:join(screenshotRoot,'smart-published-rules-preview.png'),fullPage:true});screenshots.push('smart-published-rules-preview.png');
  assert.equal(publicResult.json?.data.products.length,2);assert(publicResult.json?.data.products.every((p:{name:string})=>p.name.toLowerCase().includes('cotton')));
  await b.goto(`${merchantOrigin}/${site.subdomain}/products/smart-collections`);await b.getByRole('button',{name:'Edit '+title,exact:true}).click();
  await a.getByLabel('Description',{exact:true}).fill('Synthetic first editor change');await a.getByRole('button',{name:'Save collection',exact:true}).click();
  await expect(a.getByText('Collection saved.',{exact:true})).toBeVisible();
  await b.getByLabel('Description',{exact:true}).fill('Synthetic kept second draft');await b.getByRole('button',{name:'Save collection',exact:true}).click();
  await expect(b.getByRole('button',{name:'Review current version and kept edits',exact:true})).toBeVisible();
  await b.screenshot({path:join(screenshotRoot,'smart-stale-draft-recovery.png'),fullPage:true});screenshots.push('smart-stale-draft-recovery.png');
  assert.equal(owned.psql(`SELECT description FROM collections WHERE id='${id}'`),'Synthetic first editor change');
  await b.getByRole('button',{name:'Review current version and kept edits',exact:true}).click();
  await expect(b.getByLabel('Description',{exact:true})).toHaveValue('Synthetic kept second draft');
  await b.getByRole('button',{name:'Save collection',exact:true}).click();await expect(b.getByText('Collection saved.',{exact:true})).toBeVisible();
  assert.equal(owned.psql(`SELECT version FROM collections WHERE id='${id}'`),'3');assert.equal(owned.psql(`SELECT description FROM collections WHERE id='${id}'`),'Synthetic kept second draft');
  assert.equal(owned.psql(`SELECT count(*)FROM collection_metadata_receipts WHERE collection_id='${id}'`),'3');
  checkpoints.push('normal_smart_create_publish_saved_preview_public_two_products_stale_tab_explicit_review_kept_draft');
 }finally{await a.close();await b.close();}
});
test('signed-in collection BFF refuses stale actor, foreign origin and mismatched site with zero effects',{timeout:300000},async()=>{
 const page=await owner.newPage();try{
  await page.goto(`${merchantOrigin}/${site.subdomain}/products/smart-collections`);await expect(page.getByRole('button',{name:'Create collection',exact:true})).toBeEnabled();
  const before=owned.psql(`SELECT count(*)FROM collection_metadata_receipts WHERE store_id='${site.siteId}'`),key=crypto.randomUUID();
  const body={collection_type:'smart',store_id:site.siteId,idempotency_key:key,title:'Synthetic refused collection',slug:'synthetic-refused',conditions:[],match_type:'all'};
  for(const [headers,data,status]of [
   [{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':crypto.randomUUID(),'X-Idempotency-Key':key},body,409],
   [{Origin:'https://foreign.synthetic.invalid','X-LetBuyy-Merchant-Context':ownerId,'X-Idempotency-Key':key},body,403],
   [{Origin:merchantOrigin,'X-LetBuyy-Merchant-Context':ownerId,'X-Idempotency-Key':key},{...body,store_id:crypto.randomUUID()},400],
  ]as const){const response=await page.request.post(`${merchantOrigin}/api/stores/${site.subdomain}/smart-collections`,{headers,data});assert.equal(response.status(),status);assert.equal(response.headers()['cache-control'],'private, no-store');}
  assert.equal(owned.psql(`SELECT count(*)FROM collection_metadata_receipts WHERE store_id='${site.siteId}'`),before);checkpoints.push('normal_collection_bff_stale_actor_foreign_origin_and_store_denials_zero_effects');
 }finally{await page.close();}
});


async function createRecoveryCollection(page:Page,title:string){
 await page.goto(`${merchantOrigin}/${site.subdomain}/products/collections`);
 await page.getByRole('button',{name:'New collection',exact:true}).click();
 await page.getByLabel('Collection title',{exact:true}).fill(title);
 await page.getByRole('button',{name:'Create collection',exact:true}).click();
 const row=page.getByRole('table').getByRole('row').filter({hasText:title});await expect(row).toBeVisible();
 const id=owned.psql(`SELECT id FROM collections WHERE store_id='${site.siteId}'AND title='${title}'AND deleted_at IS NULL`);assert.match(id,/^[a-f0-9-]{36}$/);
 await row.getByRole('button',{name:'Manage products',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save products',exact:true})).toBeEnabled();
 await page.getByRole('checkbox',{name:'Synthetic red cotton',exact:true}).check();return id;
}
async function deleteRecoveryCollection(page:Page,title:string){
 await page.goto(`${merchantOrigin}/${site.subdomain}/products/collections`);
 await page.getByRole('table').getByRole('row').filter({hasText:title}).getByRole('button',{name:'Edit details',exact:true}).click();
 await page.getByRole('button',{name:'Delete collection',exact:true}).click();
 const [deleted]=await Promise.all([page.waitForResponse(r=>/\/collections\/[a-f0-9-]{36}$/.test(new URL(r.url()).pathname)&&r.request().method()==='DELETE'),page.getByRole('dialog').getByRole('button',{name:'Delete collection',exact:true}).click()]);
 assert.equal(deleted.status(),200);await expect(page.getByRole('table').getByRole('row').filter({hasText:title})).toHaveCount(0);
}
const receiptDigest=(id:string)=>createHash('sha256').update(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(r)ORDER BY idempotency_key),'[]'::jsonb)FROM collection_membership_receipts r WHERE collection_id='${id}'`)).digest('hex');
test('normal browser discovers and confirms a committed product selection after another editor deletes the collection',{timeout:300000},async()=>{
 const a=await owner.newPage(),b=await owner.newPage(),title='Synthetic retired committed selection';
 try{
  const id=await createRecoveryCollection(a,title),path=`/v1/products/collections/${id}/products`;
  loseNextMembershipReply=true;await a.getByRole('button',{name:'Save products',exact:true}).click();
  await expect(a.getByRole('button',{name:'Retry same save',exact:true})).toBeVisible();assert.equal(lostMembershipReplies,1);
  const first=calls.filter(c=>c.path===path&&c.method==='PUT');assert.equal(first.length,1);assert.equal(first[0].status,200);assert.equal(first[0].wireStatus,503);
  const receipt=receiptDigest(id);assert.equal(owned.psql(`SELECT count(*)FROM collection_membership_receipts WHERE collection_id='${id}'`),'1');
  await deleteRecoveryCollection(b,title);await a.reload();await expect(a.getByRole('row').filter({hasText:title})).toHaveCount(0);
  await expect(a.getByRole('button',{name:'Retry saved product selection',exact:true})).toBeVisible();
  await a.getByRole('button',{name:'Retry saved product selection',exact:true}).click();
  await expect(a.getByText('Original product selection confirmed.',{exact:true})).toBeVisible();
  await expect(a.getByRole('button',{name:'Retry saved product selection',exact:true})).toHaveCount(0);
  assert.equal(receiptDigest(id),receipt);const retries=calls.filter(c=>c.path===path&&c.method==='PUT');assert.equal(retries.length,2);
  assert.equal(retries[1].status,200);assert.equal(retries[1].key,first[0].key);assert.equal(retries[1].bodySha256,first[0].bodySha256);
  assert.equal(owned.psql(`SELECT count(*)FROM audit_activity_events WHERE resource_id='${id}'AND action='collection.membership.updated'`),'1');
  assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE aggregate_id='${id}'AND event_type='collection.membership.updated'`),'1');
  assert.equal(owned.psql(`SELECT count(*)FROM products WHERE store_id='${site.siteId}'AND name='Synthetic red cotton'AND deleted_at IS NULL`),'1');
  await a.screenshot({path:join(screenshotRoot,'web-retired-membership-confirmed.png'),fullPage:true});screenshots.push('web-retired-membership-confirmed.png');
  checkpoints.push('normal_web_commit_reply503_second_editor_delete_reload_discover_exact_receipt_no_duplicate_effect');
 }finally{loseNextMembershipReply=false;await a.close();await b.close();}
});
test('normal browser keeps a never-committed missing selection through reload and Cancel, then rechecks before explicit dismissal',{timeout:300000},async()=>{
 const a=await owner.newPage(),b=await owner.newPage(),title='Synthetic retired rejected selection';
 try{
  const id=await createRecoveryCollection(a,title),path=`/v1/products/collections/${id}/products`;
  await deleteRecoveryCollection(b,title);await a.getByRole('button',{name:'Save products',exact:true}).click();
  await expect(a.getByRole('button',{name:'Retry same save',exact:true})).toBeVisible();await a.reload();
  await expect(a.getByRole('button',{name:'Discard rejected product selection',exact:true})).toBeVisible();
  await a.getByRole('button',{name:'Discard rejected product selection',exact:true}).click();await a.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(a.getByRole('button',{name:'Retry saved product selection',exact:true})).toBeVisible();
  await a.getByRole('button',{name:'Discard rejected product selection',exact:true}).click();await a.getByRole('dialog').getByRole('button',{name:'Discard selection',exact:true}).click();
  await expect(a.getByText('Rejected product selection discarded. The collection remains deleted.',{exact:true})).toBeVisible();
  await expect(a.getByRole('button',{name:'Retry saved product selection',exact:true})).toHaveCount(0);
  const attempts=calls.filter(c=>c.path===path&&c.method==='PUT');assert.equal(attempts.length,2);assert(attempts.every(c=>c.status===404&&c.wireStatus===404));
  assert.equal(new Set(attempts.map(c=>c.key)).size,1);assert.notEqual(attempts[0].key,null);assert.equal(new Set(attempts.map(c=>c.bodySha256)).size,1);
  assert.equal(owned.psql(`SELECT count(*)FROM collection_membership_receipts WHERE collection_id='${id}'`),'0');
  assert.equal(owned.psql(`SELECT count(*)FROM outbox_events WHERE aggregate_id='${id}'AND event_type='collection.membership.updated'`),'0');
  assert.equal(owned.psql(`SELECT count(*)FROM products WHERE store_id='${site.siteId}'AND name='Synthetic red cotton'AND deleted_at IS NULL`),'1');
  await a.screenshot({path:join(screenshotRoot,'web-missing-membership-dismissed.png'),fullPage:true});screenshots.push('web-missing-membership-dismissed.png');
  checkpoints.push('normal_web_second_editor_delete_unsaved_selection404_reload_cancel_original_recheck404_explicit_discard_zero_effect');
 }finally{await a.close();await b.close();}
});
