import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,realpathSync,openSync,closeSync,copyFileSync,chmodSync,constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {exportJWK} from 'jose';
import {chromium,expect,type Browser,type Page} from '@playwright/test';
import {closePooledSqlClients} from '@letbuyy/infrastructure/pooled-sql-adapter';
import mobileBff from '../../../../services/mobile-bff/src/index';
import {hashMerchantPassword} from '../../../../services/api-gateway/src/lib/merchant-password';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,INTERNAL_SECRET} from '../../../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from '../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticProductInventory} from '../../../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {createLocalTurnstileProvider,LOCAL_TURNSTILE_SECRET} from '../../../../tests/fixtures/local-turnstile-provider';
import {createOwnedProviderFetch} from '../../../../scripts/governance/owned-provider-network.mjs';
import {validateOwnedNextDirectoryReceipt} from '../../../../scripts/governance/owned-next-directory.mjs';
import {NativeGateway} from '../../../../tests/helpers/native-owned-gateway';
import {NativeMobileBff} from '../../../../tests/helpers/native-owned-mobile-bff';

async function freePort() {
    const s = createServer(); await new Promise<void>(r => s.listen(0,'127.0.0.1',r));
    const p = (s.address() as {port:number}).port; await new Promise<void>(r=>s.close(()=>r())); return p;
}
async function ready(origin:string, child:OwnedClientProcess) {
    const deadline = Date.now()+300_000;
    while(Date.now()<deadline) {
        if(child.exitCode!==null || child.signalCode!==null) throw new Error('Owned app stopped before readiness');
        try { if((await fetch(origin,{signal:AbortSignal.timeout(2000)})).status<500)return; } catch { /* owned build/start */ }
        await new Promise(r=>setTimeout(r,200));
    }
    throw new Error('Owned app did not become ready');
}
async function signIn(page:Page, origin:string, email:string, password:string, merchantOrigin:string) {
    await page.goto(origin+'/login');
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/,{timeout:30_000});
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByRole('button',{name:'Continue with email',exact:true}).click();
    await page.getByLabel('Password',{exact:true}).fill(password);
    const [login] = await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST'),
        page.getByRole('button',{name:'Log in',exact:true}).click()]);
    assert.equal(login.status(),200,'Normal password sign-in must succeed before navigating to Merchant');
    await page.waitForURL(url=>url.origin===merchantOrigin,{timeout:60_000});
}


const owned=requireOwnedDatabase();
test('diagnostic actual Merchant image source, wire response and decoding',{timeout:780_000},async()=>{
 const tenant=newSyntheticTenant('image-probe');seedSyntheticTenant(owned.psql,tenant);const ownerId=randomUUID(),email=`syn-media-${ownerId}@example.invalid`,password=randomUUID()+'Aa1',hash=await hashMerchantPassword(password),productId=randomUUID();
 owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)VALUES('${ownerId}','${email}',true,'Synthetic media owner','${hash}');UPDATE sites SET custom_user_id='${ownerId}'WHERE id='${tenant.siteId}';`);
 const identityPort=await freePort(),merchantPort=await freePort(),identityOrigin=`http://localhost:${identityPort}`,merchantOrigin=`http://localhost:${merchantPort}`,keys=await newIdentityKeys(),provider=await createLocalTurnstileProvider(owned),gateway=new Gateway(gatewayEnv(owned,keys,{ENVIRONMENT:'local',LETBUYY_IDENTITY_ISSUER:identityOrigin}));
 let server:Server|undefined,identity:OwnedClientProcess|undefined,merchant:OwnedClientProcess|undefined,browser:Browser|undefined;let imageReads=0;const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGOYNH3Rf2TMQLoAAOM/LKFDq3imAAAAAElFTkSuQmCC','base64');
 try{
 server=createServer(async(req,res)=>{
  if(req.url==='/__owned__/product.png'){imageReads++;res.writeHead(200,{'Content-Type':'image/png'});res.end(png);return;}
  const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const body=Buffer.concat(chunks).toString(),headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(k))headers.set(k,v);try{const result=await gateway.request(req.url??'/',{method:req.method,headers,...(body?{body}:{})});res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(result.text);}catch{res.writeHead(500);res.end('{}');}});
 await new Promise<void>(r=>server!.listen(0,'127.0.0.1',r));const apiOrigin=`http://127.0.0.1:${(server.address()as{port:number}).port}`,imageUrl=apiOrigin+'/__owned__/product.png';
 owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,images)VALUES('${productId}','${tenant.siteId}','${tenant.siteId}','Synthetic diagnostic product','syn-media-${productId}',100,3,true,'active',ARRAY['${imageUrl}']::text[]);`);
 const shared={INTERNAL_API_SECRET:INTERNAL_SECRET,NEXT_PUBLIC_ACCOUNTS_URL:identityOrigin,NEXT_PUBLIC_ADMIN_URL:merchantOrigin};
 identity=startOwnedClientRuntime(owned,'identity-next-production',{port:identityPort,providerFixture:provider.profile,env:{...shared,LETBUYY_API_URL:apiOrigin+'/v1',LETBUYY_IDENTITY_ISSUER:identityOrigin,LETBUYY_IDENTITY_PRIVATE_JWK:JSON.stringify({...await exportJWK(keys.privateKey),alg:'ES256',kid:keys.kid}),ACCOUNTS_COOKIE_SECRET:randomUUID()+randomUUID(),COOKIE_DOMAIN:'',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA',TURNSTILE_SECRET_KEY:LOCAL_TURNSTILE_SECRET,LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS:'false',RESEND_API_KEY:'',LETBUYY_EMAIL_API_KEY:''}});
 merchant=startOwnedClientRuntime(owned,'merchant-next-production',{port:merchantPort,env:{...shared,LETBUYY_API_BASE_URL:apiOrigin+'/v1',NEXT_PUBLIC_API_BASE_URL:apiOrigin+'/v1'}});
 await ready(identityOrigin+'/login',identity);await ready(merchantOrigin,merchant);browser=await chromium.launch({headless:true});const context=await browser.newContext();await provider.attachBrowser(context,[identityOrigin,merchantOrigin,apiOrigin]);const page=await context.newPage(),events:object[]=[];page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(60_000);
 page.on('requestfailed',r=>{if(r.url()===imageUrl)events.push({kind:'image-failure',error:r.failure()?.errorText});});page.on('response',r=>{if(r.url()===imageUrl)events.push({kind:'image-response',status:r.status(),type:r.headers()['content-type']});});page.on('console',m=>{if(m.type()==='error'&&/image|product\.png|content.security/i.test(m.text()))events.push({kind:'image-console',message:m.text().replaceAll(imageUrl,'[owned-image]')});});
 await signIn(page,identityOrigin,email,password,merchantOrigin);const html=await page.goto(`${merchantOrigin}/${tenant.subdomain}/products`);const link=page.getByRole('link').filter({has:page.getByText('Synthetic diagnostic product',{exact:true})});await expect(link).toHaveCount(1);const img=link.locator('img');await expect(img).toHaveCount(1);
 const result=await img.evaluate(async node=>{let error:string|null=null;try{await node.decode()}catch(e){error=(e as Error).name;}return{src:node.getAttribute('src'),currentSrc:node.currentSrc,complete:node.complete,width:node.naturalWidth,height:node.naturalHeight,error};});
 const direct=await fetch(imageUrl);assert.equal(direct.status,200);assert.deepEqual(Buffer.from(await direct.arrayBuffer()),png);
 writeFileSync(resolve('docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/native59-owned-media-probe-v2.json'),JSON.stringify({run_id:owned.runId,scope:'Actual normal Accounts/Merchant/ownedGateway/database diagnostic;no device/provider/full journey acceptance',expected_src:imageUrl,actual:result,events,image_reads:imageReads,direct_bytes_equal:true,img_src_csp:html?.headers()['content-security-policy']?.split(';').find(s=>s.trim().startsWith('img-src'))??null,provider_counts:provider.counts},null,2)+'\n',{flag:'wx'});
 assert.equal(result.src,imageUrl);assert.equal(result.width,4);assert.equal(result.height,4);
 }finally{await browser?.close();await stopOwnedClientRuntime(merchant);await stopOwnedClientRuntime(identity);await gateway.settle();if(server){server.closeAllConnections();await new Promise<void>(r=>server!.close(()=>r()));}await provider.close();}
});
