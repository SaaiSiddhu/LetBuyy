// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Cross-runtime integration: normal Identity -> Merchant Next -> Gateway -> owned PG.
// No positive credential injection, fake product API, or provider transaction.
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

const owned=requireOwnedDatabase(),site=newSyntheticTenant('product-status');
const ownerId=crypto.randomUUID(),staffId=crypto.randomUUID();
const email=(id:string)=>`syn-status-browser-${id}@example.invalid`;
let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway|undefined,browser:Browser|undefined;
let identityOrigin='',merchantOrigin='',loseReplyFor='',holdReplyFor='',replyHeld=false;
let releaseReply:(()=>void)|undefined;
let ownerA:BrowserContext,ownerB:BrowserContext,staff:BrowserContext;
const calls:{path:string;method:string;status:number;lost:boolean;key:string|null;productBody?:string}[]=[];
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
    // Identity's existing official challenge-test transport is a separate child.
    globalThis.fetch=(async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
        if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.hostname.endsWith('.localhost')){
            refusedGatewayExternalRequests++;throw new Error('Owned product browser fixture refused a nonlocal Gateway request');
        }
        return originalFetch(input,init);
    }) as typeof fetch;
    seedSyntheticTenant(owned.psql,site);
    const password='Synthetic-product-browser-pass-'+crypto.randomUUID(),hash=await hashMerchantPassword(password);
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES
        ('${ownerId}','${email(ownerId)}',true,'Synthetic Product Owner','${hash}'),
        ('${staffId}','${email(staffId)}',true,'Synthetic Product Staff','${hash}');
        UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${site.siteId}';
        INSERT INTO employees(user_id,email,store_id,role,status,is_active,permissions)VALUES
        ('${staffId}','${email(staffId)}','${site.siteId}','editor','active',true,'{"granted":["products:write"]}');`);
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
            const productPatch=method==='PATCH'&&/^\/v1\/products\/[0-9a-f-]+$/.test(path);
            const lost=productPatch&&path.endsWith('/'+loseReplyFor)&&result.status===200;
            calls.push({path,method,status:result.status,lost,key:productPatch?headers.get('X-Idempotency-Key'):null,...(productPatch?{productBody:body}:{})});
            if(lost){loseReplyFor='';res.destroy();return;} // Deliberate loss after real SQL commit.
            if(productPatch&&holdReplyFor&&path.endsWith('/'+holdReplyFor)&&result.status===200){holdReplyFor='';replyHeld=true;await new Promise<void>(resolve=>{releaseReply=resolve;});}
            res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
        }catch{if(!res.destroyed){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"OWNED_BRIDGE_ERROR","message":"Owned bridge unavailable"}}');}}
    });
    await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));
    const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
    const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
    identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
        LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
        ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',
        LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
    merchant=startOwnedClientRuntime(owned,'merchant-next',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
    await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
    browser=await chromium.launch({headless:true});ownerA=await browser.newContext();ownerB=await browser.newContext();staff=await browser.newContext();
    for(const context of [ownerA,ownerB,staff]){context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(90000);}
    await signIn(ownerA,ownerId,password);await signIn(ownerB,ownerId,password);await signIn(staff,staffId,password);
    checkpoints.push('three_normal_identity_sign_ins');
},{timeout:660000});
after(async()=>{
    releaseReply?.();
    console.info('OWNED_PRODUCT_STATUS_BROWSER '+JSON.stringify({runId:owned.runId,checkpoints,normalSignIns:checkpoints.includes('three_normal_identity_sign_ins')?3:0,
        positiveCredentialInjection:false,fixtureKind:'local Next development runtimes + actual Gateway/PostgREST/owned PostgreSQL',
        calls:calls.filter(c=>c.productBody!==undefined).map(({path,method,status,lost,key})=>({path,method,status,lost,key})),
        gatewayExternalRequestsRefused:refusedGatewayExternalRequests,
        challengeMode:'Existing official Turnstile test-key transport; production anti-bot unverified',
        runtimeSupervisors:[{kind:"merchant-next",pid:merchant?.pid},{kind:"identity-next",pid:identity?.pid}],providerTransactions:0,hostedVerified:false,privateScreenshots:false}));
    await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);
    await gateway?.settle();await closePooledSqlClients();await proxy?.stop();
    if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
    globalThis.fetch=originalFetch;
    assert.equal(refusedGatewayExternalRequests,0,'The product journey attempted an undeclared external Gateway request');
});

type Status="active"|"draft"|"archived";
function product(name:string,status:Status="active"){const id=crypto.randomUUID(),variantId=crypto.randomUUID();owned.psql(`
    INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,country_of_origin)
    VALUES('${id}','${site.siteId}','${site.siteId}','${name.replaceAll("'","''")}','syn-browser-${id}',100,5,${status==='active'},'${status}','India');
    INSERT INTO product_options(product_id,name,position,values)VALUES('${id}','Size',0,'["M"]');
    INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty,option1)VALUES('${variantId}','${id}','M','SYN-BROWSER-M',100,0,'M');
    SELECT set_inventory_level_available('${id}','${variantId}','${site.locationId}',5,'${ownerId}');`);return{id,variantId,name};}
const endpoint=(id:string)=>`${merchantOrigin}/api/stores/${site.subdomain}/products/${id}`;
const version=(id:string)=>Number(owned.psql(`SELECT version FROM products WHERE id='${id}';`));
const receiptCount=(id:string)=>Number(owned.psql(`SELECT count(*) FROM product_edit_receipts WHERE product_id='${id}';`));
type Product=ReturnType<typeof product>;
const row=(page:Page,name:string)=>page.getByRole('row').filter({has:page.getByText(name,{exact:true})});
const input=(page:Page,p:Product)=>page.getByRole('combobox',{name:`Change status for ${p.name}`,exact:true});
const count=(table:string,id:string,column='product_id')=>Number(owned.psql(`SELECT count(*) FROM ${table} WHERE ${column}='${id}';`));
function state(id:string){return JSON.parse(owned.psql(`SELECT jsonb_build_object('version',version,'status',status,'is_active',is_active,'receipts',(SELECT count(*) FROM product_edit_receipts WHERE product_id='${id}'),'audit',(SELECT count(*) FROM audit_activity_events WHERE resource_id='${id}'),'outbox',(SELECT count(*) FROM outbox_events WHERE aggregate_id='${id}' AND event_type='product.updated')) FROM products WHERE id='${id}';`));}
async function list(context:BrowserContext){const page=await context.newPage();const[reply]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===`/api/stores/${site.subdomain}/products`&&r.request().method()==='GET'),page.goto(`${merchantOrigin}/${site.subdomain}/products`)]);assert.equal(reply.status(),200);const data=(await reply.json()).data as {id:string;version:number}[];assert.ok(data.length>0);assert.ok(data.every(p=>Number.isInteger(p.version)&&p.version>0),'actual collection rows carry positive versions');await expect(page.getByLabel('Search products',{exact:true})).toBeVisible();return{page,data};}
async function change(page:Page,p:Product,status:Status){const[reply]=await Promise.all([page.waitForResponse(r=>r.url()===endpoint(p.id)&&r.request().method()==='PATCH'),input(page,p).selectOption(status)]);return reply;}
async function select(page:Page,products:Product[]){for(const p of products)await row(page,p.name).getByRole('checkbox').check();}
async function draftBulk(page:Page){await page.getByRole('button',{name:'Set as draft',exact:true}).click();}
async function waitItemPatch(page:Page,p:Product,action:()=>Promise<unknown>){const[reply]=await Promise.all([page.waitForResponse(r=>r.url()===endpoint(p.id)&&r.request().method()==='PATCH'),action()]);return reply;}
async function reviewAndApply(page:Page,p:Product){await page.getByRole('button',{name:`Review latest for ${p.name}`,exact:true}).click();return waitItemPatch(page,p,()=>page.getByRole('button',{name:`Apply requested status for ${p.name}`,exact:true}).click());}

test('normal single status action preserves loaded versions, three canonical states, key/context and stable stock',{timeout:180000},async()=>{
 const p=product('Synthetic single '+crypto.randomUUID()),{page,data}=await list(ownerA);const level=owned.psql(`SELECT id FROM inventory_levels WHERE variant_id='${p.variantId}';`);let expected=data.find(v=>v.id===p.id)!.version;
 try{
  for(const status of ['draft','active','archived'] as Status[]){const reply=await change(page,p,status);assert.equal(reply.status(),200,await reply.text());const body=reply.request().postDataJSON();assert.equal(body.version,expected);assert.equal(body.status,status);assert.equal(body.is_active,status==='active');assert.equal(reply.request().headers()['x-idempotency-key'],body.idempotency_key);assert.equal(reply.request().headers()['x-letbuyy-merchant-context'],ownerId);const current=state(p.id);assert.equal(current.status,status);assert.equal(current.is_active,status==='active');assert.ok(current.version>expected);expected=current.version;await expect(input(page,p)).toHaveValue(status);}
  assert.equal(receiptCount(p.id),3);assert.equal(owned.psql(`SELECT id||'|'||available FROM inventory_levels WHERE variant_id='${p.variantId}';`),level+'|5');
  await page.goto(`${merchantOrigin}/${site.subdomain}/products/${p.id}`);await expect(page.getByLabel('Title',{exact:true})).toHaveValue(p.name);
  await page.getByLabel('Title',{exact:true}).fill(p.name+' details');const detail=await waitItemPatch(page,p,()=>page.getByRole('button',{name:'Save product',exact:true}).first().click());assert.equal(detail.status(),200,await detail.text());assert.equal(detail.request().postDataJSON().status,'archived');assert.equal(detail.request().postDataJSON().is_active,false);assert.equal(state(p.id).status,'archived');assert.equal(receiptCount(p.id),4);assert.equal(owned.psql(`SELECT id||'|'||available FROM inventory_levels WHERE variant_id='${p.variantId}';`),level+'|5');
  const before=state(p.id);const invalid=await page.evaluate(async({url,actorId,version})=>{const key=crypto.randomUUID();return(await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json','X-LetBuyy-Merchant-Context':actorId,'X-Idempotency-Key':key},body:JSON.stringify({version,idempotency_key:key,status:'archived',is_active:true})})).status;},{url:endpoint(p.id),actorId:ownerId,version:before.version});assert.equal(invalid,400);assert.deepEqual(state(p.id),before);checkpoints.push('single_three_states_exact_version_key_context_stock_and_invalid_pair');
 }finally{await page.close();}
});

test('two normal status lists refuse a stale change until explicit latest review and a new approved command',{timeout:180000},async()=>{
 const p=product('Synthetic stale '+crypto.randomUUID()),a=(await list(ownerA)).page,b=(await list(ownerB)).page,expected=version(p.id);
 try{
  assert.equal((await change(a,p,'draft')).status(),200);const denied=await change(b,p,'archived');assert.equal(denied.status(),409);const old=denied.request().postDataJSON();assert.equal(old.version,expected);assert.equal(receiptCount(p.id),1);
  await expect(b.getByText(`Requested Archived for ${p.name}`,{exact:true})).toBeVisible();const latest=version(p.id);const accepted=await reviewAndApply(b,p);assert.equal(accepted.status(),200);const fresh=accepted.request().postDataJSON();assert.equal(fresh.version,latest);assert.notEqual(fresh.idempotency_key,old.idempotency_key);assert.equal(state(p.id).status,'archived');assert.equal(receiptCount(p.id),2);checkpoints.push('stale_status_retained_until_explicit_latest_approval');
 }finally{await a.close();await b.close();}
});

test('committed single-status HTTP loss reloads and recovers the same command once',{timeout:180000},async()=>{
 const p=product('Synthetic lost '+crypto.randomUUID()),{page}=await list(ownerA);
 try{
  loseReplyFor=p.id;const lost=await change(page,p,'draft');assert.ok(lost.status()>=500);const body=lost.request().postData(),before=state(p.id);assert.equal(before.receipts,1);assert.equal(before.status,'draft');
  await expect(page.getByText('1 uncertain',{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Retry uncertain changes',exact:true})).toBeVisible();
  const retry=await waitItemPatch(page,p,()=>page.getByRole('button',{name:'Retry uncertain changes',exact:true}).click());assert.equal(retry.status(),200);assert.equal(retry.request().postData(),body);assert.deepEqual(state(p.id),before);assert.equal(before.audit,1);assert.equal(before.outbox,1);
  const records=calls.filter(c=>c.productBody&&c.path.endsWith('/'+p.id));assert.equal(records.length,2);assert.equal(records[0].key,records[1].key);assert.equal(records[0].productBody,records[1].productBody);checkpoints.push('single_lost_reply_reload_same_key_body_one_effect');
 }finally{loseReplyFor='';await page.close();}
});

test('mixed bulk outcomes remain per item and reload retries only the uncertain command',{timeout:240000},async()=>{
 const prefix='Synthetic partial '+crypto.randomUUID(),a=product(prefix+' A'),b=product(prefix+' B'),c=product(prefix+' C');const owner=(await list(ownerA)).page,second=(await list(ownerB)).page;
 try{
  assert.equal((await change(second,c,'archived')).status(),200);await owner.getByLabel('Search products',{exact:true}).fill(prefix);await select(owner,[a,b,c]);loseReplyFor=b.id;
  const [first,lost,conflict]=await Promise.all([owner.waitForResponse(r=>r.url()===endpoint(a.id)&&r.request().method()==='PATCH'),owner.waitForResponse(r=>r.url()===endpoint(b.id)&&r.request().method()==='PATCH'),owner.waitForResponse(r=>r.url()===endpoint(c.id)&&r.request().method()==='PATCH'),draftBulk(owner)]);
  assert.equal(first.status(),200);assert.ok(lost.status()>=500);assert.equal(conflict.status(),409);const uncertain=lost.request().postData(),committedB=state(b.id);
  await expect(owner.getByText('1 confirmed',{exact:true})).toBeVisible();await expect(owner.getByText('1 uncertain',{exact:true})).toBeVisible();await expect(owner.getByText('1 needs review',{exact:true})).toBeVisible();assert.equal(receiptCount(a.id),1);assert.equal(receiptCount(b.id),1);assert.equal(receiptCount(c.id),1);
  await owner.reload();await expect(owner.getByRole('button',{name:'Retry uncertain changes',exact:true})).toBeVisible();const retry=await waitItemPatch(owner,b,()=>owner.getByRole('button',{name:'Retry uncertain changes',exact:true}).click());assert.equal(retry.status(),200);assert.equal(retry.request().postData(),uncertain);assert.deepEqual(state(b.id),committedB);
  await expect(owner.getByText('2 confirmed',{exact:true})).toBeVisible();await expect(owner.getByText('1 needs review',{exact:true})).toBeVisible();assert.equal(calls.filter(x=>x.productBody&&x.path.endsWith('/'+a.id)).length,1,'known successful A was not repeated');assert.equal(calls.filter(x=>x.productBody&&x.path.endsWith('/'+b.id)).length,2);
  const expected=version(c.id),oldKey=conflict.request().postDataJSON().idempotency_key,reviewed=await reviewAndApply(owner,c);assert.equal(reviewed.status(),200);assert.equal(reviewed.request().postDataJSON().version,expected);assert.notEqual(reviewed.request().postDataJSON().idempotency_key,oldKey);assert.equal(state(c.id).status,'draft');assert.equal(receiptCount(c.id),2);checkpoints.push('bulk_partial_truth_reload_retries_only_uncertain_and_explicit_conflict_review');
 }finally{loseReplyFor='';await owner.close();await second.close();}
});

test('captured account switch and live owner/staff revocations refuse status effects',{timeout:240000},async()=>{
 const switched=product('Synthetic account '+crypto.randomUUID()),{page}=await list(ownerA),cookies=await ownerA.cookies(merchantOrigin);
 try{const before=state(switched.id);await ownerA.addCookies(await staff.cookies(merchantOrigin));const denied=await change(page,switched,'draft');assert.equal(denied.status(),409);assert.equal((await denied.json()).error.code,'SESSION_CONTEXT_CHANGED');assert.deepEqual(state(switched.id),before);await expect(page.getByText('Account or store access changed',{exact:true})).toBeVisible();}
 finally{await ownerA.addCookies(cookies);await page.close();}
 const ownerProduct=product('Synthetic revoked owner '+crypto.randomUUID()),staffProduct=product('Synthetic revoked staff '+crypto.randomUUID()),owner=(await list(ownerA)).page,employee=(await list(staff)).page;
 try{
  const ownerBefore=state(ownerProduct.id);owned.psql(`UPDATE sites SET custom_user_id='${staffId}' WHERE id='${site.siteId}';`);try{const denied=await change(owner,ownerProduct,'draft');assert.ok([403,404].includes(denied.status()));assert.deepEqual(state(ownerProduct.id),ownerBefore);}finally{owned.psql(`UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${site.siteId}';`);}
  const staffBefore=state(staffProduct.id);owned.psql(`UPDATE employees SET permissions='{"granted":["products:read"]}' WHERE user_id='${staffId}' AND store_id='${site.siteId}';`);try{const denied=await change(employee,staffProduct,'draft');assert.equal(denied.status(),403);assert.deepEqual(state(staffProduct.id),staffBefore);}finally{owned.psql(`UPDATE employees SET permissions='{"granted":["products:write"]}' WHERE user_id='${staffId}' AND store_id='${site.siteId}';`);}
  checkpoints.push('captured_cookie_switch_and_live_owner_staff_denied_before_effects');
 }finally{await owner.close();await employee.close();}
});

test('bulk stops after a captured account changes between committed items without resending known success',{timeout:180000},async()=>{
 const prefix='Synthetic held '+crypto.randomUUID(),a=product(prefix+' A'),b=product(prefix+' B'),c=product(prefix+' C'),{page}=await list(ownerA),cookies=await ownerA.cookies(merchantOrigin);
 try{
  await page.getByLabel('Search products',{exact:true}).fill(prefix);await select(page,[a,b,c]);holdReplyFor=a.id;replyHeld=false;await draftBulk(page);await expect.poll(()=>replyHeld,{timeout:15000}).toBe(true);assert.equal(state(a.id).receipts,1);
  await ownerA.addCookies(await staff.cookies(merchantOrigin));const next=page.waitForResponse(r=>r.url()===endpoint(b.id)&&r.request().method()==='PATCH');releaseReply!();const denied=await next;assert.equal(denied.status(),409);assert.equal((await denied.json()).error.code,'SESSION_CONTEXT_CHANGED');
  await expect(page.getByText('Account or store access changed',{exact:true})).toBeVisible();assert.equal(receiptCount(a.id),1);assert.equal(receiptCount(b.id),0);assert.equal(receiptCount(c.id),0);assert.equal(calls.filter(x=>x.productBody&&x.path.endsWith('/'+a.id)).length,1);assert.equal(calls.filter(x=>x.productBody&&x.path.endsWith('/'+c.id)).length,0);await expect(page.getByText('1 confirmed',{exact:true})).toBeVisible();await expect(page.getByText('1 not sent',{exact:true})).toBeVisible();checkpoints.push('mid_bulk_cookie_switch_stops_unstarted_items_preserves_confirmed');
 }finally{releaseReply?.();holdReplyFor='';replyHeld=false;await ownerA.addCookies(cookies);await page.close();}
});

test('normal catalog status views distinguish archived from draft without mixing inactive states',{timeout:180000},async()=>{
 const prefix='Synthetic views '+crypto.randomUUID(),archived=product(prefix+' archived','archived'),draft=product(prefix+' draft','draft'),active=product(prefix+' active','active'),{page}=await list(ownerA);
 try{
  await page.getByLabel('Search products',{exact:true}).fill(prefix);await page.getByRole('button',{name:'Archived',exact:true}).click();await expect(row(page,archived.name)).toBeVisible();await expect(row(page,draft.name)).toHaveCount(0);await expect(row(page,active.name)).toHaveCount(0);
  await page.getByRole('button',{name:'Draft',exact:true}).click();await expect(row(page,draft.name)).toBeVisible();await expect(row(page,archived.name)).toHaveCount(0);
  await page.getByRole('button',{name:'Active',exact:true}).click();await expect(row(page,active.name)).toBeVisible();await expect(row(page,draft.name)).toHaveCount(0);await expect(row(page,archived.name)).toHaveCount(0);checkpoints.push('actual_status_views_use_distinct_archived_draft_active');
 }finally{await page.close();}
});
