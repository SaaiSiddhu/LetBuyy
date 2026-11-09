// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Cross-runtime integration: normal Identity -> Merchant Next -> Gateway -> owned PG.
// No positive credential injection, fake collection API, or provider transaction.
import assert from 'node:assert/strict';
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
const owned=requireOwnedDatabase(),site=newSyntheticTenant('sc-preview');
const ownerId=crypto.randomUUID();
const email=(id:string)=>`syn-sc-browser-${id}@example.invalid`;
let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway|undefined,browser:Browser|undefined;
let identityOrigin='',merchantOrigin='';
let failProductReads=false, failedProductReads=0, restTap:RestTap|undefined;
let owner:BrowserContext;
const calls:{path:string;method:string;status:number}[]=[];
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
            refusedGatewayExternalRequests++;throw new Error('Owned smart collection browser fixture refused a nonlocal Gateway request');
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
            calls.push({path,method,status:result.status});
            res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
        }catch{if(!res.destroyed){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"OWNED_BRIDGE_ERROR","message":"Owned bridge unavailable"}}');}}
    });
    await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));
    const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
    const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
    challenge=await createLocalTurnstileProvider(owned);
    identity=startOwnedClientRuntime(owned,'identity-next',{port:identityPort,providerFixture:challenge.profile,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
        LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
        ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,
        LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
    merchant=startOwnedClientRuntime(owned,'merchant-next',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
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
    checkpoints.push('one_normal_identity_owner_sign_in');
},{timeout:660000});
after(async()=>{
    console.info('OWNED_SMART_COLLECTION_PREVIEW_BROWSER '+JSON.stringify({runId:owned.runId,checkpoints,
        normalSignIns:checkpoints.includes('one_normal_identity_owner_sign_in')?1:0,
        positiveCredentialInjection:false,positiveAPIFake:false,
        fixtureKind:'local Next development runtimes + actual Gateway/PostgREST/owned PostgreSQL',
        previewCalls:calls.filter(c=>c.path.startsWith('/v1/smart-collections')),
        failedProductReads,gatewayExternalRequestsRefused:refusedGatewayExternalRequests,
        challengeMode:'Owned local one-use challenge provider; production anti-bot unverified',localChallengeCounts:challenge?.counts,
        runtimeSupervisors:[{kind:'merchant-next',pid:merchant?.pid},{kind:'identity-next',pid:identity?.pid}],
        providerTransactions:0,hostedVerified:false,privateScreenshots:false}));
    failProductReads=false;
    await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await challenge?.close();
    await gateway?.settle();restTap?.restore();await closePooledSqlClients();await proxy?.stop();
    if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
    globalThis.fetch=originalFetch;
    assert.equal(refusedGatewayExternalRequests,0,'The preview journey attempted an undeclared external Gateway request');
});

const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
function savedCollection(){
    const id=crypto.randomUUID(),match=crypto.randomUUID(),other=crypto.randomUUID(),name='Synthetic saved rules '+id;
    owned.psql('INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status) VALUES '+
        '('+[quote(match),quote(site.siteId),quote(site.siteId),quote('SYN-MATCH '+id+' Collection Shoe'),quote('syn-sc-'+match),'100','5','true',quote('active')].join(',')+'),'+
        '('+[quote(other),quote(site.siteId),quote(site.siteId),quote('Synthetic Other'),quote('syn-sc-'+other),'50','0','true',quote('active')].join(',')+');'+
        'INSERT INTO smart_collections(id,store_id,name,slug,conditions,match_type) VALUES('+[quote(id),quote(site.siteId),quote(name),quote('syn-sc-'+id),
        quote(JSON.stringify([{field:'title',op:'contains',value:'SYN-MATCH '+id},{field:'inventory_quantity',op:'gt',value:'0'}]))+'::jsonb',quote('all')].join(',')+');');
    return{id,match,other,name};
}
type Saved=ReturnType<typeof savedCollection>;
function state(){
    const predicates:Record<string,string>={smart_collections:'store_id='+quote(site.siteId),products:'store_id='+quote(site.siteId),
        product_variants:'product_id IN(SELECT id FROM products WHERE store_id='+quote(site.siteId)+')',
        inventory_levels:'store_id='+quote(site.siteId),inventory_adjustments:'product_id IN(SELECT id FROM products WHERE store_id='+quote(site.siteId)+')',
        outbox_events:'store_id='+quote(site.siteId)+' OR site_id='+quote(site.siteId),idempotency_keys:'site_id='+quote(site.siteId)};
    if(owned.psql("SELECT to_regclass('public.inventory_adjustment_receipts') IS NOT NULL;")==='t')predicates.inventory_adjustment_receipts='store_id='+quote(site.siteId);
    const result:Record<string,unknown>={};
    for(const[table,predicate]of Object.entries(predicates))result[table]=JSON.parse(owned.psql("SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY to_jsonb(t)::text),'[]'::jsonb)FROM public."+table+' t WHERE '+predicate+';'));
    return result;
}
const bffListPath='/api/stores/'+site.subdomain+'/smart-collections';
async function openSaved(saved:Saved){
    const page=await owner.newPage();
    try{
        const[listed]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname===bffListPath&&response.request().method()==='GET',{timeout:90000}),
            page.goto(merchantOrigin+'/'+site.subdomain+'/products/smart-collections')]);
        assert.equal(listed.status(),200);
        const row=page.getByRole('row').filter({has:page.getByText(saved.name,{exact:true})});
        await expect(row).toBeVisible();await row.getByRole('button',{name:'Edit',exact:true}).click();
        const dialog=page.getByRole('dialog',{name:'Edit smart collection',exact:true});await expect(dialog).toBeVisible();
        await expect(dialog.getByLabel('Collection name',{exact:true})).toHaveValue(saved.name);
        return page;
    }catch(error){await page.close();throw error;}
}
async function preview(page:Page,saved:Saved){
    const[reply]=await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname===bffListPath+'/'+saved.id+'/preview'&&response.request().method()==='GET'),
        page.getByRole('dialog').getByRole('button',{name:/Preview (?:matching products|saved rules)/}).click()]);
    return reply;
}

test('a normally signed-in owner previews saved rules through the maintained page and canonical name/stock projection',{timeout:300000},async()=>{
    const saved=savedCollection(),page=await openSaved(saved),before=state();
    try{
        const reply=await preview(page,saved);assert.equal(reply.status(),200);
        const data=(await reply.json()).data;
        assert.equal(data.collection_id,saved.id);assert.equal(data.count,1);assert.equal(data.condition_count,2);
        assert.equal(data.match_type,'all');assert.deepEqual(data.sample_product_ids,[saved.match]);
        assert.equal(data.evaluated_of,Number(owned.psql('SELECT count(*)FROM products WHERE store_id='+quote(site.siteId)+' AND is_active AND deleted_at IS NULL;')));
        assert.equal(data.capped_at,500);
        await expect(page.getByRole('dialog')).toContainText('1 product match');
        assert.deepEqual(state(),before);
        assert.ok(calls.filter(call=>call.path.startsWith('/v1/smart-collections')).every(call=>call.method==='GET'));
        checkpoints.push('normal_owner_saved_rules_real_name_stock_preview_no_effects');
    }finally{await page.close();}
});

test('a real preview product-read fault is visible and an explicit restored retry shows the current saved-rule result',{timeout:300000},async()=>{
    const saved=savedCollection(),page=await openSaved(saved),before=state(),beforeFailures=failedProductReads;
    try{
        failProductReads=true;
        try{
            const failed=await preview(page,saved);assert.equal(failed.status(),500);
            assert.equal(failedProductReads-beforeFailures,1);
            const errorBody=await failed.text();assert.doesNotMatch(errorBody,/syn_private_preview_fault|synthetic-private-detail/);
            await expect(page.getByText('Unable to load preview. Please try again.',{exact:true})).toBeVisible();
            await expect(page.getByRole('dialog')).not.toContainText('0 products match');
            assert.deepEqual(state(),before);
        }finally{failProductReads=false;}
        const restored=await preview(page,saved);assert.equal(restored.status(),200);
        const data=(await restored.json()).data;
        assert.equal(data.count,1);assert.equal(data.evaluated_of,Number(owned.psql('SELECT count(*)FROM products WHERE store_id='+quote(site.siteId)+' AND is_active AND deleted_at IS NULL;')));
        assert.equal(data.capped_at,500);assert.deepEqual(data.sample_product_ids,[saved.match]);
        await expect(page.getByRole('dialog')).toContainText('1 product match');
        await expect(page.getByText('Unable to load preview. Please try again.',{exact:true})).toHaveCount(0);
        assert.deepEqual(state(),before);
        assert.ok(calls.filter(call=>call.path.startsWith('/v1/smart-collections')).every(call=>call.method==='GET'));
        checkpoints.push('negative_only_real_REST_fault_visible_then_explicit_successful_read_retry_no_effects');
    }finally{failProductReads=false;await page.close();}
});

