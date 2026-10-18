// Cross-runtime integration: normal Identity -> Merchant Next -> Gateway -> owned PG.
// No positive credential injection, fake collection API, or provider transaction.
import assert from 'node:assert/strict';
import test, {after, before} from 'node:test';
import {createServer, type Server} from 'node:http';
import {exportJWK} from 'jose';
import {chromium, expect, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {storefrontCacheKey, storefrontCacheRequest} from '../../services/api-gateway/src/lib/storefront-cache';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET, tapRest, restJson, type RestTap} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime,
    type OwnedClientProcess, type OwnedPooledSqlProxy} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant, seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned=requireOwnedDatabase(),site=newSyntheticTenant('cm-browser');
const ownerId=crypto.randomUUID();
const email=(id:string)=>`syn-cm-browser-${id}@example.invalid`;
let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway|undefined,browser:Browser|undefined;
let identityOrigin='',merchantOrigin='',commerceOrigin='';
let commerce:OwnedClientProcess|undefined,retiredIdentityPid:number|undefined;
const runtimeTransitions:string[]=[];
let failProductReads=false, failedProductReads=0, failAssignedReads=false, failedAssignedReads=0, restTap:RestTap|undefined;
let loseNextMembershipReply=false, lostCommittedReplies=0;
// Explicit Cloudflare Cache API adapter seam. A stale entry is seeded only
// from a prior real Gateway response, never a fabricated successful endpoint.
const priorCaches=Object.getOwnPropertyDescriptor(globalThis,'caches'),cacheEntries=new Map<string,Response>();
let cacheReads=0,cacheWrites=0;
const cacheUrl=(request:Request|string)=>typeof request==='string'?request:request.url;

let owner:BrowserContext;
const calls:{path:string;method:string;status:number;query:string;wireStatus:number}[]=[];
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
    Object.defineProperty(globalThis,'caches',{configurable:true,value:{default:{
        async match(request:Request|string){cacheReads++;return cacheEntries.get(cacheUrl(request))?.clone();},
        async put(request:Request|string,response:Response){cacheWrites++;cacheEntries.set(cacheUrl(request),response.clone());},
        async delete(request:Request|string){return cacheEntries.delete(cacheUrl(request));},
    }}});

    // The actual Gateway may reach only this fixture's loopback services.
    // Identity's existing official challenge-test transport is a separate child.
    globalThis.fetch=(async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
        if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.hostname.endsWith('.localhost')){
            refusedGatewayExternalRequests++;throw new Error('Owned collection membership browser fixture refused a nonlocal Gateway request');
        }
        return originalFetch(input,init);
    }) as typeof fetch;
    seedSyntheticTenant(owned.psql,site);
    const password='Synthetic-collection-browser-pass-'+crypto.randomUUID(),hash=await hashMerchantPassword(password);
    owned.psql("INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('"+ownerId+"','"+email(ownerId)+"',true,'Synthetic Membership Owner','"+hash+"'); UPDATE sites SET custom_user_id='"+ownerId+"'WHERE id='"+site.siteId+"';");
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
            const lose=loseNextMembershipReply&&method==='PUT'&&/^\/v1\/products\/collections\/[^/]+\/products$/.test(path)&&result.status===200;
            if(lose){loseNextMembershipReply=false;lostCommittedReplies++;}
            calls.push({path,method,status:result.status,query:new URL(req.url??'/',apiOrigin).search,wireStatus:lose?503:result.status});
            if(lose){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'OWNED_NEGATIVE_LOST_REPLY',message:'Synthetic committed response lost'}}));}
            else{res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);}
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
    restTap=tapRest(owned.restUrl,async(call,forward)=>{
        if(failAssignedReads&&call.method==='GET'&&call.resource==='collection_products'){failedAssignedReads++;return restJson(503,{code:'XX000',message:'syn_private_membership_fault'});}
        if(failProductReads&&call.method==='GET'&&call.resource==='products'){
            failedProductReads++;
            return restJson(503,{code:'XX000',message:'relation "syn_private_preview_fault" does not exist',details:'synthetic-private-detail'});
        }
        return forward();
    });
    browser=await chromium.launch({headless:true});owner=await browser.newContext();
    owner.setDefaultTimeout(30000);owner.setDefaultNavigationTimeout(90000);
    await signIn(owner,ownerId,password);
    checkpoints.push('one_normal_identity_owner_sign_in');
    // Proposed resource extension: stop the actually authenticated issuer UI
    // before starting Commerce, retaining the normal Gateway session verifier.
    // There are never three simultaneous Next runtimes.
    const issuer=identity;assert.ok(issuer);retiredIdentityPid=issuer.pid;
    await stopOwnedClientRuntime(issuer);identity=undefined;
    runtimeTransitions.push('normal_identity_login_then_owned_identity_supervisor_stopped');
    const commercePort=await freePort();commerceOrigin=`http://${site.subdomain}.localhost:${commercePort}`;
    commerce=startOwnedClientRuntime(owned,'commerce-next',{port:commercePort,env:{
        INTERNAL_API_SECRET:INTERNAL_SECRET,LETBUYY_INTERNAL_API_SECRET:INTERNAL_SECRET,
        LETBUYY_API_BASE_URL:apiOrigin+'/v1',LETBUYY_API_URL:apiOrigin+'/v1',
        NEXT_PUBLIC_API_BASE_URL:apiOrigin+'/v1',NEXT_PUBLIC_API_URL:apiOrigin+'/v1',
        NEXT_PUBLIC_STORE_ROOT_DOMAIN:'localhost',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:'',
    }});
    runtimeTransitions.push('commerce_started_with_merchant_only_max2Next');
    await ready('http://localhost:'+commercePort,commerce);

},{timeout:660000});
after(async()=>{
    console.info('OWNED_COLLECTION_MEMBERSHIP_BROWSER '+JSON.stringify({runId:owned.runId,checkpoints,
        normalSignIns:checkpoints.includes('one_normal_identity_owner_sign_in')?1:0,
        positiveCredentialInjection:false,positiveAPIFake:false,
        fixtureKind:'local Next development runtimes + actual Gateway/PostgREST/owned PostgreSQL',
        membershipAndChoicesCalls:calls.filter(c=>c.path.startsWith('/v1/products')),
        lostCommittedReplies,failedAssignedReads,cacheReads,cacheWrites,cacheAdapter:"Owned memory Cache API adapter; seeded stale entry copies an earlier REAL Gateway response. Hosted CDN unverified.",
        failedProductReads,gatewayExternalRequestsRefused:refusedGatewayExternalRequests,
        challengeMode:'Existing official Turnstile test-key transport; production anti-bot unverified',
        runtimeSupervisors:[{kind:'merchant-next',pid:merchant?.pid},{kind:'identity-next',pid:identity?.pid??retiredIdentityPid},{kind:'commerce-next',pid:commerce?.pid}],
        runtimeTransitions,maxSimultaneousNextRuntimes:2,normalCommerceBoundary:'Actual public tenant hostname -> existing proxy -> Next SSR page -> shared SDK -> real Gateway/ownedPG; local development mode, hostedCDN unverified',
        providerTransactions:0,hostedVerified:false,privateScreenshots:false}));
    failProductReads=false;failAssignedReads=false;loseNextMembershipReply=false;
    await browser?.close();await stopOwnedClientRuntime(commerce);await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);
    await gateway?.settle();restTap?.restore();await closePooledSqlClients();await proxy?.stop();
    if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
    globalThis.fetch=originalFetch;
    if(priorCaches)Object.defineProperty(globalThis,'caches',priorCaches);else Reflect.deleteProperty(globalThis,'caches');
    assert.equal(refusedGatewayExternalRequests,0,'The membership journey attempted an undeclared external Gateway request');
});


const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
function manualCollection(tag:string,count=4){
    const id=crypto.randomUUID(),name='Synthetic manual '+tag+' '+id,products=Array.from({length:count},()=>crypto.randomUUID());
    for(const[index,pid]of products.entries())owned.psql('INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,created_at)VALUES('+[quote(pid),quote(site.siteId),quote(site.siteId),quote('Synthetic '+tag+' product '+index),quote('syn-cm-'+pid),'100','5','true',quote('active'),"'2026-01-01'::timestamptz+interval '1 second'*"+index].join(',')+');');
    owned.psql('INSERT INTO collections(id,store_id,title,is_active)VALUES('+[quote(id),quote(site.siteId),quote(name),'true'].join(',')+');INSERT INTO collection_products(collection_id,product_id,position)VALUES('+[quote(id),quote(products[0]),'0'].join(',')+'),('+[quote(id),quote(products[1]),'1'].join(',')+');');
    return{id,name,products,tag};
}
type Manual=ReturnType<typeof manualCollection>;
function state(){
    const predicates:Record<string,string>={collections:'store_id='+quote(site.siteId),collection_products:'collection_id IN(SELECT id FROM collections WHERE store_id='+quote(site.siteId)+')',products:'store_id='+quote(site.siteId),
        inventory_levels:'store_id='+quote(site.siteId),inventory_adjustments:'product_id IN(SELECT id FROM products WHERE store_id='+quote(site.siteId)+')',
        outbox_events:'store_id='+quote(site.siteId)+' OR site_id='+quote(site.siteId),audit_activity_events:'store_id='+quote(site.siteId),idempotency_keys:'site_id='+quote(site.siteId)};
    for(const table of ['collection_membership_receipts','product_edit_receipts','inventory_adjustment_receipts'])if(owned.psql("SELECT to_regclass('public."+table+"')IS NOT NULL;")==='t')predicates[table]='store_id='+quote(site.siteId);
    return Object.fromEntries(Object.entries(predicates).map(([table,predicate])=>[table,JSON.parse(owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY to_jsonb(t)::text),'[]'::jsonb)FROM public."+table+' t WHERE '+predicate+';'))]));
}
function assigned(saved:Manual){return JSON.parse(owned.psql("SELECT coalesce(jsonb_agg(product_id ORDER BY position,product_id),'[]'::jsonb)FROM collection_products WHERE collection_id="+quote(saved.id)+';'))as string[];}
const membershipPath=(saved:Manual)=>'/api/stores/'+site.subdomain+'/collections/'+saved.id+'/products';
async function openManage(saved:Manual){
    const page=await owner.newPage();
    try{
        const[listed]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/stores/'+site.subdomain+'/collections'&&r.request().method()==='GET'),page.goto(merchantOrigin+'/'+site.subdomain+'/products/collections')]);
        assert.equal(listed.status(),200);
        const row=page.getByRole('row').filter({has:page.getByText(saved.name,{exact:true})});await expect(row).toBeVisible();
        const choiceReply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/stores/'+site.subdomain+'/products'&&r.request().method()==='GET');
        const[reply]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===membershipPath(saved)&&r.request().method()==='GET'),row.getByRole('button',{name:'Manage products',exact:true}).click()]);
        const choices=await choiceReply;
        console.info('OWNED_COLLECTION_MEMBERSHIP_NORMAL_OPEN '+JSON.stringify({collectionStatus:reply.status(),choiceStatus:choices.status(),choiceQuery:new URL(choices.url()).search,normalIdentity:true,positiveFake:false}));
        return{page,reply,choices};
    }catch(error){await page.close();throw error;}
}
async function loaded(saved:Manual){
    const h=await openManage(saved);
    try{assert.equal(h.choices.status(),200,await h.choices.text());assert.equal(h.reply.status(),200,await h.reply.text());const data=(await h.reply.json()).data;
        assert.equal(data.collection_id,saved.id);assert.equal(data.store_id,site.siteId);assert.ok(Number.isInteger(data.membership_version)&&data.membership_version>0);assert.deepEqual(data.product_ids,assigned(saved));return{...h,data};
    }catch(error){await h.page.close();throw error;}
}
async function save(page:Page,saved:Manual,label='Save products'){
    const[reply]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===membershipPath(saved)&&r.request().method()==='PUT'),page.getByRole('button',{name:label,exact:true}).click()]);return reply;
}
async function publicRead(saved:Manual){return gateway!.request('/v1/storefront/'+site.subdomain+'/collections/'+saved.id);}

test('normal owner loads complete membership and existing catalog pagination reaches a later product without effects',{timeout:300000},async()=>{
    const saved=manualCollection('page',105),before=state(),h=await loaded(saved);
    try{
        assert.deepEqual(h.data.product_ids,saved.products.slice(0,2));assert.ok(Number(new URL(h.choices.url()).searchParams.get('limit'))<=100);
        const name='Synthetic '+saved.tag+' product 2';
        // Assigned membership is complete even before this choice appears.
        assert.equal(h.data.product_ids.includes(saved.products[0]),true);
        while(await h.page.getByRole('button',{name:'Load more products',exact:true}).count()){
            const[reply]=await Promise.all([h.page.waitForResponse(r=>new URL(r.url()).pathname==='/api/stores/'+site.subdomain+'/products'&&r.request().method()==='GET'),h.page.getByRole('button',{name:'Load more products',exact:true}).click()]);assert.equal(reply.status(),200);
        }
        assert.ok(calls.some(c=>c.path==='/v1/products'&&Number(new URLSearchParams(c.query).get('page'))>=2),'Normal BFF reached a continuation page');
        await expect(h.page.getByRole('checkbox',{name,exact:true})).not.toBeChecked();await h.page.getByRole('checkbox',{name,exact:true}).check();
        await expect(h.page.getByRole('checkbox',{name:'Synthetic page product 0',exact:true})).toBeChecked();assert.deepEqual(state(),before);
        checkpoints.push('normal_owner_complete_membership_page_continuation_no_effects');
    }finally{await h.page.close();}
});

test('real membership read failure fences Save; explicit retry restores selected products without mutation',{timeout:300000},async()=>{
    const saved=manualCollection('readfail'),before=state(),hits=failedAssignedReads;failAssignedReads=true;
    let page:Page|undefined;
    try{
        const h=await openManage(saved);page=h.page;assert.equal(h.reply.status(),500);assert.equal(failedAssignedReads-hits,1,'Named junction read fault was actually reached');
        await expect(page.getByRole('button',{name:'Save products',exact:true})).toBeDisabled();await expect(page.getByText('Could not load collection products',{exact:true})).toBeVisible();
        assert.deepEqual(state(),before);failAssignedReads=false;
        const[restored]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname===membershipPath(saved)&&r.request().method()==='GET'),page.getByRole('button',{name:'Retry products',exact:true}).click()]);
        assert.equal(restored.status(),200);assert.deepEqual((await restored.json()).data.product_ids,saved.products.slice(0,2));await expect(page.getByRole('checkbox',{name:'Synthetic readfail product 0',exact:true})).toBeChecked();assert.deepEqual(state(),before);
        checkpoints.push('real_negative_assigned_read_visible_save_fenced_restored_retry');
    }finally{failAssignedReads=false;await page?.close();}
});

test('normal owner membership save is visible at the existing public URL and a stale editor cannot overwrite it',{timeout:300000},async()=>{
    const saved=manualCollection('stale'),first=await loaded(saved),second=await loaded(saved);
    try{
        const warm=await publicRead(saved);assert.equal(warm.status,200,warm.text);assert.deepEqual(warm.json?.data.products.map((p:{id:string})=>p.id).sort(),saved.products.slice(0,2).sort());
        const staleCacheKey=storefrontCacheRequest(storefrontCacheKey('storefront-rest','collection-detail','0',site.subdomain,saved.id)).url;
        cacheEntries.set(staleCacheKey,new Response(warm.text,{status:warm.status,headers:warm.headers}));
        const cacheReadsBefore=cacheReads;
        await first.page.getByRole('checkbox',{name:'Synthetic stale product 2',exact:true}).check();
        const success=await save(first.page,saved);assert.equal(success.status(),200);const body=success.request().postDataJSON();assert.equal(body.expected_version,first.data.membership_version);assert.match(body.idempotency_key,/^[0-9a-f-]{36}$/i);assert.equal(success.request().headers()['x-idempotency-key'],body.idempotency_key);
        assert.deepEqual(assigned(saved),[...saved.products.slice(0,2),saved.products[2]]);
        const fresh=await publicRead(saved);assert.equal(fresh.status,200,fresh.text);assert.equal(cacheReads,cacheReadsBefore,'Mutable collection detail bypassed the deliberately stale cache entry');assert.match(fresh.headers.get('Cache-Control')??'',/no-store/);assert.deepEqual(fresh.json?.data.products.map((p:{id:string})=>p.id).sort(),[...saved.products.slice(0,2),saved.products[2]].sort());
        await second.page.getByRole('checkbox',{name:'Synthetic stale product 3',exact:true}).check();const beforeConflict=state(),conflict=await save(second.page,saved);assert.equal(conflict.status(),409);assert.deepEqual(state(),beforeConflict);await expect(second.page.getByText('Collection membership changed',{exact:true})).toBeVisible();
        const[reloaded]=await Promise.all([second.page.waitForResponse(r=>new URL(r.url()).pathname===membershipPath(saved)&&r.request().method()==='GET'),second.page.getByRole('button',{name:'Reload current products',exact:true}).click()]);assert.equal(reloaded.status(),200);await expect(second.page.getByRole('checkbox',{name:'Synthetic stale product 2',exact:true})).toBeChecked();
        failProductReads=true;const faultsBefore=failedProductReads;
        try{const failed=await publicRead(saved);assert.equal(failed.status,500,failed.text);assert.ok(failedProductReads>faultsBefore);assert.equal(failed.json?.data,undefined);assert.doesNotMatch(failed.text,/syn_private_preview_fault|synthetic-private-detail/);}
        finally{failProductReads=false;}
        assert.equal((await publicRead(saved)).status,200);checkpoints.push('normal_atomic_save_public_current_no_store_stale_conflict_error_retry');
    }finally{await first.page.close();await second.page.close();}
});

test('a lost committed reply survives reload and exact replay never overwrites an independent later save',{timeout:300000},async()=>{
    const saved=manualCollection('replay'),original=await loaded(saved);
    let later:Awaited<ReturnType<typeof loaded>>|undefined;
    try{
        await original.page.getByRole('checkbox',{name:'Synthetic replay product 2',exact:true}).check();loseNextMembershipReply=true;
        const lost=await save(original.page,saved);assert.equal(lost.status(),503);assert.equal(lostCommittedReplies,1);const captured=lost.request().postDataJSON();assert.ok(assigned(saved).includes(saved.products[2]));
        later=await loaded(saved);await later.page.getByRole('checkbox',{name:'Synthetic replay product 3',exact:true}).check();assert.equal((await save(later.page,saved)).status(),200);const beforeReplay=state();
        await original.page.reload();const row=original.page.getByRole('row').filter({has:original.page.getByText(saved.name,{exact:true})});await row.getByRole('button',{name:'Manage products',exact:true}).click();
        const replay=await save(original.page,saved,'Retry same save');assert.equal(replay.status(),200);assert.deepEqual(replay.request().postDataJSON(),captured);assert.deepEqual(state(),beforeReplay);assert.ok(assigned(saved).includes(saved.products[3]));
        const count=Number(owned.psql("SELECT count(*)FROM collection_membership_receipts WHERE collection_id="+quote(saved.id)+';'));assert.equal(count,2);checkpoints.push('real_commit_negative_lost_reply_reload_exact_receipt_after_newer_save_no_rewrite');
    }finally{loseNextMembershipReply=false;await original.page.close();await later?.page.close();}
});


test('normal public Commerce render recovers from a real outage and shows the current owner-saved membership',{timeout:300000},async()=>{
    const saved=manualCollection('render'),consumer=await browser!.newContext(),page=await consumer.newPage();
    const url=commerceOrigin+'/collections/'+saved.id;
    let edit:Awaited<ReturnType<typeof loaded>>|undefined;
    try{
        // This is the actual tenant-host public URL. Direct /store/<tenant>
        // navigation is deliberately denied by the canonical proxy.
        await page.goto(url);await expect(page.getByRole('heading',{name:saved.name,exact:true})).toBeVisible();
        await expect(page.getByText('Synthetic render product 0',{exact:true}).first()).toBeVisible();
        const publicReadsBefore=calls.filter(c=>c.path==='/v1/storefront/'+site.subdomain+'/collections/'+saved.id).length;
        failProductReads=true;const faultHitsBefore=failedProductReads;
        try{
            await page.reload();
            await expect(page.getByRole('heading',{name:'Something went wrong',exact:true})).toBeVisible();
            await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeVisible();
            await expect(page.getByRole('heading',{name:'Page not found',exact:true})).toHaveCount(0);
            await expect(page.getByText('Synthetic render product 0',{exact:true})).toHaveCount(0);
            assert.ok(failedProductReads>faultHitsBefore,'Named real public product read fault was reached; a stale cache cannot stand in for a failed refresh');
        }finally{failProductReads=false;}
        await page.getByRole('button',{name:'Try again',exact:true}).click();
        await expect(page.getByRole('heading',{name:saved.name,exact:true})).toBeVisible();
        await expect(page.getByText('Synthetic render product 0',{exact:true}).first()).toBeVisible();
        edit=await loaded(saved);
        await edit.page.getByRole('checkbox',{name:'Synthetic render product 0',exact:true}).uncheck();
        await edit.page.getByRole('checkbox',{name:'Synthetic render product 2',exact:true}).check();
        assert.equal((await save(edit.page,saved)).status(),200);
        const beforeRender=state();await page.reload();
        await expect(page.getByText('Synthetic render product 0',{exact:true})).toHaveCount(0);
        await expect(page.getByText('Synthetic render product 1',{exact:true}).first()).toBeVisible();
        await expect(page.getByText('Synthetic render product 2',{exact:true}).first()).toBeVisible();
        assert.ok(calls.filter(c=>c.path==='/v1/storefront/'+site.subdomain+'/collections/'+saved.id).length>publicReadsBefore);
        assert.deepEqual(state(),beforeRender);
        for(const id of [crypto.randomUUID(),saved.id]){
            if(id===saved.id)owned.psql('UPDATE collections SET is_active=false WHERE id='+quote(id)+';');
            await page.goto(commerceOrigin+'/collections/'+id);
            await expect(page.getByRole('heading',{name:'Page not found',exact:true})).toBeVisible();
            await expect(page.getByRole('heading',{name:'Something went wrong',exact:true})).toHaveCount(0);
        }
        checkpoints.push('normal_public_tenant_proxy_actualCommerceSSR_fault_retry_current_membership_and_true404');
    }finally{failProductReads=false;await edit?.page.close();await consumer.close();}
});
