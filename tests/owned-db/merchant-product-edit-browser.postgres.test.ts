// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Cross-runtime integration: normal Identity -> Merchant Next -> Gateway -> owned PG.
// No positive credential injection, fake product API, or provider transaction.
import assert from 'node:assert/strict';
import test, {after, before} from 'node:test';
import {createServer, type Server} from 'node:http';
import {readFileSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {exportJWK} from 'jose';
import {chromium, expect, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {hashMerchantPassword} from '../../services/api-gateway/src/lib/merchant-password';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {Gateway, gatewayEnv, newIdentityKeys, INTERNAL_SECRET} from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime,
    type OwnedClientProcess, type OwnedPooledSqlProxy} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant, seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned=requireOwnedDatabase(),site=newSyntheticTenant('product-browser');
const ownerId=crypto.randomUUID(),staffId=crypto.randomUUID();
const email=(id:string)=>`syn-product-browser-${id}@example.invalid`;
let bridge:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined;
let proxy:OwnedPooledSqlProxy|undefined,gateway:Gateway|undefined,browser:Browser|undefined;
let exportStorage:Miniflare|undefined;
let identityOrigin='',merchantOrigin='',loseReplyFor='';
let ownerA:BrowserContext,ownerB:BrowserContext,staff:BrowserContext;
const calls:{path:string;method:string;status:number;lost:boolean;key:string|null;productBody?:string}[]=[];
const checkpoints:string[]=[];
const readProfiles:{route:string;sample:number;usefulMilliseconds:number;gatewayReads:number;gatewayBytes:number}[]=[];
let profileReads:{bytes:number}[]|null=null;
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
    exportStorage=new Miniflare({modules:true,script:'export default {fetch(){return new Response("Not found",{status:404})}}',compatibilityDate:'2026-05-25',cf:false,r2Buckets:['R2_BUCKET'],r2Persist:false});
    await exportStorage.ready;
    gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin,R2_BUCKET:await exportStorage.getR2Bucket('R2_BUCKET'),...proxy.env()}));
    bridge=createServer(async(req,res)=>{
        const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString();
        const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);
        try{
            const path=(req.url??'/').split('?')[0],method=req.method??'GET';
            const result=await gateway!.request(req.url??'/',{method,headers,...(body?{body}:{})});
            if(method==='GET' && profileReads)profileReads.push({bytes:Buffer.byteLength(result.text)});
            const productPatch=method==='PATCH'&&/^\/v1\/products\/[0-9a-f-]+$/.test(path);
            const lost=productPatch&&path.endsWith('/'+loseReplyFor)&&result.status===200;
            calls.push({path,method,status:result.status,lost,key:productPatch?headers.get('X-Idempotency-Key'):null,...(productPatch?{productBody:body}:{})});
            if(lost){loseReplyFor='';res.destroy();return;} // Backend response consumed after its real SQL commit.
            res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);
        }catch{if(!res.destroyed){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":{"code":"OWNED_BRIDGE_ERROR","message":"Owned bridge unavailable"}}');}}
    });
    await new Promise<void>(r=>bridge!.listen(0,'127.0.0.1',r));
    const apiOrigin=`http://127.0.0.1:${(bridge.address() as {port:number}).port}`;
    const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
    identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,
        LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),
        ACCOUNTS_COOKIE_SECRET:crypto.randomUUID()+crypto.randomUUID(),COOKIE_DOMAIN:'',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:'1x0000000000000000000000000000000AA',
        LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
    merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1'}});
    await Promise.all([ready(identityOrigin+'/login',identity),ready(merchantOrigin,merchant)]);
    browser=await chromium.launch({headless:true});ownerA=await browser.newContext();ownerB=await browser.newContext();staff=await browser.newContext();
    for(const context of [ownerA,ownerB,staff]){context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(90000);}
    await signIn(ownerA,ownerId,password);await signIn(ownerB,ownerId,password);await signIn(staff,staffId,password);
    checkpoints.push('three_normal_identity_sign_ins');
},{timeout:660000});
after(async()=>{
    console.info('OWNED_PRODUCT_BROWSER '+JSON.stringify({runId:owned.runId,checkpoints,normalSignIns:checkpoints.includes('three_normal_identity_sign_ins')?3:0,
        positiveCredentialInjection:false,readProfiles,fixtureKind:'local Next production builds + actual Gateway/PostgREST/owned PostgreSQL',
        calls:calls.filter(c=>c.productBody!==undefined).map(({path,method,status,lost,key})=>({path,method,status,lost,key})),
        gatewayExternalRequestsRefused:refusedGatewayExternalRequests,
        challengeMode:'Existing official Turnstile test-key transport; production anti-bot unverified',
        providerTransactions:0,hostedVerified:false,privateScreenshots:false}));
    await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);
    await gateway?.settle();await exportStorage?.dispose();await closePooledSqlClients();await proxy?.stop();
    if(bridge){bridge.closeAllConnections();await new Promise<void>(r=>bridge!.close(()=>r()));}
    globalThis.fetch=originalFetch;
    assert.equal(refusedGatewayExternalRequests,0,'The product journey attempted an undeclared external Gateway request');
});

function product(){const id=crypto.randomUUID(),variantId=crypto.randomUUID();owned.psql(`
    INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,country_of_origin)
    VALUES('${id}','${site.siteId}','${site.siteId}','Synthetic browser product','syn-browser-${id}',100,5,true,'active','India');
    INSERT INTO product_options(product_id,name,position,values)VALUES('${id}','Size',0,'["M"]');
    INSERT INTO product_variants(id,product_id,title,sku,price,inventory_qty,option1)VALUES('${variantId}','${id}','M','SYN-BROWSER-M',100,0,'M');
    SELECT set_inventory_level_available('${id}','${variantId}','${site.locationId}',5,'${ownerId}');`);return{id,variantId};}
const endpoint=(id:string)=>`${merchantOrigin}/api/stores/${site.subdomain}/products/${id}`;
const version=(id:string)=>Number(owned.psql(`SELECT version FROM products WHERE id='${id}';`));
const receiptCount=(id:string)=>Number(owned.psql(`SELECT count(*) FROM product_edit_receipts WHERE product_id='${id}';`));
async function editor(context:BrowserContext,id:string){const page=await context.newPage();await page.goto(`${merchantOrigin}/${site.subdomain}/products/${id}`);await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Synthetic browser product');return page;}
async function save(page:Page,id:string,label='Save product'){const[reply]=await Promise.all([page.waitForResponse(r=>r.url()===endpoint(id)&&r.request().method()==='PATCH'),page.getByRole('button',{name:label,exact:true}).first().click()]);return reply;}

test('production navigation preserves the shell and settles useful nonzero catalog data',{timeout:150000},async()=>{
    const fixture=product();
    owned.psql(`UPDATE products SET name='Synthetic performance notebook' WHERE id='${fixture.id}';`);
    const page=await ownerA.newPage();
    try{
        for(const route of ['products','orders'])for(let sample=1;sample<=3;sample++){
            const reads:{bytes:number}[]=[];profileReads=reads;const started=performance.now();
            await page.goto(`${merchantOrigin}/${site.subdomain}/${route}`);
            if(route==='products')await expect(page.locator('table').getByText('Synthetic performance notebook',{exact:true})).toBeVisible();
            else await expect(page.getByRole('heading',{name:'No orders yet',exact:true})).toBeVisible();
            readProfiles.push({route,sample,usefulMilliseconds:Math.round((performance.now()-started)*10)/10,gatewayReads:reads.length,gatewayBytes:reads.reduce((total,read)=>total+read.bytes,0)});
            profileReads=null;
        }
        await page.goto(`${merchantOrigin}/${site.subdomain}/products`);
        await expect(page.locator('table').getByText('Synthetic performance notebook',{exact:true})).toBeVisible();
        const marker=await page.evaluate(()=>{const value=crypto.randomUUID();(window as unknown as Record<string,unknown>).merchantNavigationSentinel=value;return value;});
        await page.getByRole('link',{name:'Orders',exact:true}).first().click();
        await expect(page.getByRole('heading',{name:'No orders yet',exact:true})).toBeVisible();
        assert.equal(await page.evaluate(()=>(window as unknown as Record<string,unknown>).merchantNavigationSentinel),marker,'sidebar navigation must retain the document and shared shell');
        await page.locator('header').getByRole('link',{name:'Products',exact:true}).click();
        await expect(page.locator('table').getByText('Synthetic performance notebook',{exact:true})).toBeVisible();
        assert.equal(await page.evaluate(()=>(window as unknown as Record<string,unknown>).merchantNavigationSentinel),marker,'page-header navigation must retain the document and shared shell');
        checkpoints.push('production_nonzero_catalog_empty_orders_three_samples_retained_client_navigation');
    }finally{profileReads=null;await page.close();}
});

test('production AI and operations pages settle complete large-history values',{timeout:150000},async()=>{
    const source=crypto.randomUUID(),destination=crypto.randomUUID();
    owned.psql(`INSERT INTO ai_credits(store_id,plan_credits,bonus_credits,total_purchased) VALUES('${site.siteId}',3000,10,20);
      INSERT INTO ai_usage(store_id,feature,credits_used,status,tokens_input,tokens_output)
      SELECT '${site.siteId}','custom',2,'completed',10,7 FROM generate_series(1,1103);
      INSERT INTO inventory_locations(id,store_id,name) VALUES
      ('${source}','${site.siteId}','Synthetic browser source'),('${destination}','${site.siteId}','Synthetic browser destination');
      INSERT INTO inventory_transfers(site_id,transfer_number,source_location_id,destination_location_id,status,idempotency_key)
      SELECT '${site.siteId}','SYN-BROWSER-TR-'||n,'${source}','${destination}',CASE WHEN n<=1100 THEN 'shipped' ELSE 'received' END,
      'syn-browser-tr-'||gen_random_uuid() FROM generate_series(1,1103)n;`);
    const page=await ownerA.newPage();
    try {
        for(const route of ['ai','products/operations-dashboard']) {
            const reads:{bytes:number}[]=[];profileReads=reads;const started=performance.now();
            await page.goto(`${merchantOrigin}/${site.subdomain}/${route}`);
            if(route==='ai') {
                await expect(page.getByText('824',{exact:true})).toBeVisible();
                await expect(page.getByText('3,030 total credits',{exact:true})).toBeVisible();
                await expect(page.getByText('Latest 20 AI usage events',{exact:true})).toBeVisible();
                await expect(page.locator('main')).not.toContainText('NaN');
            } else {
                await expect(page.getByText('1103',{exact:true})).toBeVisible();
                await expect(page.getByText('1100',{exact:true})).toBeVisible();
                await expect(page.getByText('In transit',{exact:true}).last()).toBeVisible();
            }
            readProfiles.push({route,sample:1,usefulMilliseconds:Math.round((performance.now()-started)*10)/10,gatewayReads:reads.length,gatewayBytes:reads.reduce((total,read)=>total+read.bytes,0)});
            profileReads=null;
        }
    } finally {profileReads=null;await page.close()}
});

test('production export UI prepares the complete file through the canonical job and downloads without leaving the page',{timeout:150000},async()=>{
    const page=await ownerA.newPage(),styles:Promise<string>[]=[];
    page.on('response',response=>{if(response.url().includes('/_next/static/css/'))styles.push(response.text());});
    try{
        await page.goto(`${merchantOrigin}/${site.subdomain}/export`);
        await expect(page.getByRole('heading',{name:'Export and import',exact:true})).toBeVisible();
        await page.getByRole('button',{name:'Export Products',exact:true}).click();
        await expect(page.getByText('Export ready',{exact:true})).toBeVisible({timeout:30000});
        const count=Number(owned.psql(`SELECT count(*) FROM products WHERE store_id='${site.siteId}' AND deleted_at IS NULL`));
        await expect(page.getByText(`${count.toLocaleString('en-IN')} records are ready to download.`,{exact:true})).toBeVisible();
        const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download CSV',exact:true}).click()]);
        assert.equal(await download.failure(),null);
        const path=await download.path();assert.ok(path);const csv=readFileSync(path,'utf8');
        assert.equal(download.suggestedFilename(),'products.csv');
        assert.ok(csv.startsWith('id,name,description,price,'));
        const expected=JSON.parse(owned.psql(`SELECT json_agg(id) FROM products WHERE store_id='${site.siteId}' AND deleted_at IS NULL`)) as string[];
        for(const id of expected)assert.ok(csv.includes(id));
        await expect(page.getByRole('heading',{name:'Export and import',exact:true})).toBeVisible();
        assert.equal(new URL(page.url()).pathname,`/${site.subdomain}/export`);
        const css=await Promise.all(styles);assert.ok(css.length>0,'observe actual loaded production styles');
        assert.ok(css.every(text=>!text.includes('.theme-os{')),'ordinary merchant page must not load editor-only CSS');
        checkpoints.push('production_complete_export_download_current_actor_native_r2_no_editor_css');
    }finally{await page.close();}
});

test('production import UI refuses invalid later rows, then tracks a quoted multiline import to completion',{timeout:150000},async()=>{
    const page=await ownerA.newPage();
    const count=()=>Number(owned.psql(`SELECT count(*) FROM products WHERE store_id='${site.siteId}'`));
    const before=count();
    try{
        await page.goto(`${merchantOrigin}/${site.subdomain}/export`);
        await page.locator('input[type="file"]').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('name,price\nSynthetic valid,10\nSynthetic invalid,3oops')});
        const [refused]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/products/import')&&r.request().method()==='POST'),page.getByRole('button',{name:'Import CSV',exact:true}).click()]);
        assert.equal(refused.status(),400,await refused.text());
        await expect(page.getByText('CSV row 3 has an invalid price.',{exact:true}).first()).toBeVisible();
        assert.equal(count(),before);
        const csv='name,description,price,stock\r\n"Synthetic browser CSV 東京","  First\r\nSecond ""quoted""  ",12.34,3\r\n';
        await page.locator('input[type="file"]').setInputFiles({name:'quoted.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
        await page.getByRole('button',{name:'Import CSV',exact:true}).click();
        await expect(page.getByText('Import complete',{exact:true})).toBeVisible({timeout:45000});
        await expect(page.getByText('1 product imported.',{exact:true})).toBeVisible();
        assert.equal(count(),before+1);
        const persisted=JSON.parse(owned.psql(`SELECT json_build_object('description',description,'price',price,'stock',stock) FROM products WHERE store_id='${site.siteId}' AND name='Synthetic browser CSV 東京'`));
        assert.deepEqual(persisted,{description:'  First\r\nSecond "quoted"  ',price:12.34,stock:3});
        assert.equal(new URL(page.url()).pathname,`/${site.subdomain}/export`);
        checkpoints.push('production_import_invalid_later_row_no_products_quoted_multiline_progress_complete');
    }finally{await page.close();}
});

test('normal product read and edit use actual positive version, stable variant ID and canonical stock',{timeout:150000},async()=>{
    const {id,variantId}=product(),expected=version(id),level=owned.psql(`SELECT id FROM inventory_levels WHERE variant_id='${variantId}';`);
    const page=await editor(ownerA,id);
    try{
        await page.getByLabel('Title',{exact:true}).fill('Synthetic browser saved');
        await page.getByLabel('SKU for M',{exact:true}).fill('SYN-BROWSER-RENAMED');
        await page.getByLabel('Stock for M',{exact:true}).fill('7');
        const reply=await save(page,id);assert.equal(reply.status(),200,await reply.text());const body=reply.request().postDataJSON();
        assert.equal(body.version,expected);assert.ok(expected>0);assert.equal(body.variants[0].id,variantId);assert.ok(body.idempotency_key);
        await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Synthetic browser saved');
        assert.equal(owned.psql(`SELECT id||'|'||available FROM inventory_levels WHERE variant_id='${variantId}';`),level+'|7');
        assert.equal(owned.psql(`SELECT sku FROM product_variants WHERE id='${variantId}';`),'SYN-BROWSER-RENAMED');
        assert.ok(version(id)>expected);assert.equal(receiptCount(id),1);checkpoints.push('actual_version_stable_variant_stock');
    }finally{await page.close();}
});
test('two independent normal contexts preserve a stale draft until explicit latest reload',{timeout:150000},async()=>{
    const {id}=product(),a=await editor(ownerA,id),b=await editor(ownerB,id),expected=version(id);
    try{
        await a.getByLabel('Title',{exact:true}).fill('Synthetic winning browser');await b.getByLabel('Title',{exact:true}).fill('Synthetic stale unsaved draft');
        assert.equal((await save(a,id)).status(),200);const stale=await save(b,id);assert.equal(stale.status(),409);
        assert.equal(stale.request().postDataJSON().version,expected);assert.equal(receiptCount(id),1);
        await expect(b.getByLabel('Title',{exact:true})).toHaveValue('Synthetic stale unsaved draft');
        await expect(b.getByRole('button',{name:'Reload latest and discard my edits',exact:true})).toBeVisible();
        await b.getByRole('button',{name:'Reload latest and discard my edits',exact:true}).click();
        await expect(b.getByLabel('Title',{exact:true})).toHaveValue('Synthetic winning browser');
        await b.getByLabel('Title',{exact:true}).fill('Synthetic reviewed browser draft');const nextVersion=version(id),reviewed=await save(b,id);
        assert.equal(reviewed.status(),200);assert.equal(reviewed.request().postDataJSON().version,nextVersion);
        assert.notEqual(reviewed.request().postDataJSON().idempotency_key,stale.request().postDataJSON().idempotency_key);
        assert.equal(receiptCount(id),2);checkpoints.push('two_context_stale_conflict_and_explicit_reload');
    }finally{await a.close();await b.close();}
});
test('committed HTTP response loss survives page reload and recovers the exact captured key and payload once',{timeout:150000},async()=>{
    const {id}=product(),page=await editor(ownerA,id);
    try{
        await page.getByLabel('Title',{exact:true}).fill('Synthetic committed reply lost');loseReplyFor=id;
        const lost=await save(page,id);assert.ok(lost.status()>=500);const captured=lost.request().postData()!;
        assert.equal(receiptCount(id),1);const committedVersion=version(id);
        const first=calls.find(c=>c.lost&&c.path.endsWith('/'+id));assert.ok(first);assert.equal(first.status,200);
        await expect(page.getByRole('button',{name:'Retry pending save',exact:true}).first()).toBeVisible();
        await page.reload();
        await expect(page.getByRole('button',{name:'Retry pending save',exact:true}).first()).toBeVisible();
        const retry=await save(page,id,'Retry pending save');assert.equal(retry.status(),200,await retry.text());
        assert.equal(retry.request().postData(),captured);assert.equal(receiptCount(id),1);assert.equal(version(id),committedVersion);
        const requests=calls.filter(c=>c.productBody!==undefined&&c.path.endsWith('/'+id));assert.equal(requests.length,2);
        assert.equal(requests[0].key,requests[1].key);assert.equal(requests[0].productBody,requests[1].productBody);
        assert.equal(owned.psql(`SELECT count(*) FROM audit_activity_events WHERE resource_id='${id}';`),'1');
        assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${id}' AND event_type='product.updated';`),'1');
        checkpoints.push('committed_http_loss_reload_same_key_payload_one_effect');
    }finally{loseReplyFor='';await page.close();}
});
test('a captured owner form refuses an authorized different account cookie before product effect',{timeout:150000},async()=>{
    const {id}=product(),original=await ownerA.cookies(merchantOrigin),page=await editor(ownerA,id);
    // Both accounts were authenticated normally. Replacement models an account
    // switch after this owner's form captured its context, then restores it.
    try{
        await page.getByLabel('Title',{exact:true}).fill('Synthetic old owner captured draft');const expected=version(id);
        try{
            await ownerA.addCookies(await staff.cookies(merchantOrigin));
            const denied=await save(page,id);assert.equal(denied.status(),409);
            assert.equal((await denied.json()).error.code,'SESSION_CONTEXT_CHANGED');
            assert.equal(receiptCount(id),0);assert.equal(version(id),expected);
            assert.equal(owned.psql(`SELECT name FROM products WHERE id='${id}';`),'Synthetic browser product');
            await expect(page.getByText(/Account or store access changed|signed-in account changed|Reload this page/).first()).toBeVisible();
            checkpoints.push('authorized_cookie_switch_captured_actor_denied_before_effect');
        }finally{await ownerA.addCookies(original);}
    }finally{await page.close();}
});
test('normal already-loaded owner and staff forms recheck live permissions before effects',{timeout:150000},async()=>{
    const ownerProduct=product(),staffProduct=product(),a=await editor(ownerA,ownerProduct.id),b=await editor(staff,staffProduct.id);
    try{
        await a.getByLabel('Title',{exact:true}).fill('Synthetic revoked owner draft');
        owned.psql(`UPDATE sites SET custom_user_id='${staffId}' WHERE id='${site.siteId}';`);
        try{const denied=await save(a,ownerProduct.id);assert.ok([403,404].includes(denied.status()));assert.equal(receiptCount(ownerProduct.id),0);}
        finally{owned.psql(`UPDATE sites SET custom_user_id='${ownerId}' WHERE id='${site.siteId}';`);}
        await b.getByLabel('Title',{exact:true}).fill('Synthetic revoked staff draft');
        owned.psql(`UPDATE employees SET permissions='{"granted":["products:read"]}' WHERE user_id='${staffId}' AND store_id='${site.siteId}';`);
        try{const denied=await save(b,staffProduct.id);assert.equal(denied.status(),403);assert.equal(receiptCount(staffProduct.id),0);}
        finally{owned.psql(`UPDATE employees SET permissions='{"granted":["products:write"]}' WHERE user_id='${staffId}' AND store_id='${site.siteId}';`);}
        checkpoints.push('live_owner_staff_denial_before_effect');
    }finally{await a.close();await b.close();}
});
test('actual authenticated browser request cannot omit the loaded version',{timeout:120000},async()=>{
    const{id}=product(),page=await editor(ownerA,id),expected=version(id);
    try{
        const status=await page.evaluate(async({url,actorId})=>{const key=crypto.randomUUID();return(await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json','X-Idempotency-Key':key,'X-LetBuyy-Merchant-Context':actorId},body:JSON.stringify({name:'Synthetic missing version',idempotency_key:key})})).status;},{url:endpoint(id),actorId:ownerId});
        assert.equal(status,400);assert.equal(receiptCount(id),0);assert.equal(version(id),expected);checkpoints.push('actual_browser_missing_version_denied');
    }finally{await page.close();}
});
