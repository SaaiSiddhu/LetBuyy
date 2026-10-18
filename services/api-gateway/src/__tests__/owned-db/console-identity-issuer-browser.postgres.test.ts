// Normal Console -> real Gateway/PostgREST/DB. Local magic links send no email.
// This regression demands the governed asymmetric Identity operator issuer;
// it does not count a valid legacy shared-secret cookie as canonical issuance.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
import {withConsoleBrowser} from './console-browser-fixture';
const owned=requireOwnedDatabase();
test('normal operator sign-in and durable MFA produce an Identity-issued audience-bound asymmetric session',{timeout:360000},async()=>{
 await withConsoleBrowser(owned,async f=>{
  const actor=f.actors[1],{context,page}=await f.login(actor);
  const cookie=(await context.cookies()).find(c=>c.name==='lb_console_session');assert.ok(cookie,'normal callback and MFA must set the actual cookie');
  const root=ownedTmpDir() + '/letbuyy-operator-browser-'+owned.runId;mkdirSync(root,{recursive:true});await page.screenshot({path:root+'/identity-issued-dashboard.png'});
  const parts=cookie.value.split('.');
  const observation={run_id:owned.runId,normalLocalMagicLink:true,normalConfiguredTotp:true,dashboardReadback:true,positiveCredentialInjection:false,tokenParts:parts.length,actualGatewaySessionRegistrations:f.calls.filter(c=>c.path==='/v1/internal/identity/operator/exchange'&&c.status===200).length,actualGatewayMfaTransitions:f.calls.filter(c=>c.path==='/v1/internal/identity/operator/mfa'&&c.status===200).length,scope:'Actual normal local browser and durable DB; local link sends no email; no provider/hosted proof; raw cookie and secret never logged'};
  writeFileSync(ownedTmpDir() + '/letbuyy-console-issuer-'+owned.runId+'.json',JSON.stringify(observation,null,2)+'\n');console.info('OWNED_OPERATOR_ISSUER_OBSERVATION '+JSON.stringify(observation));
  assert.equal(observation.actualGatewaySessionRegistrations,1);assert.equal(observation.actualGatewayMfaTransitions,1);
  assert.equal(parts.length,3,'ART-05/R-14: normal operator cookie must be an asymmetric Identity JWT, not a Console-minted symmetric envelope');
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString()),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());
  assert.ok(['ES256','EdDSA'].includes(header.alg));assert.equal(claims.realm,'platform');assert.equal(claims.token_use,'platform_session');assert.equal(claims.sub,actor.id);assert.ok(typeof claims.iss==='string'&&claims.iss.length>0);assert.equal(claims.aud,'letbuyy:platform-session');
  await context.close();
 });
});

test('real Identity outage preserves the generated proof; a committed lost reply recovers through a fresh normal sign-in',{timeout:360000},async()=>{
 await withConsoleBrowser(owned,async f=>{
  const actor=f.actors[0],context=await f.browser.newContext(),page=await context.newPage();
  const denied=await context.request.post(f.identityOrigin+'/api/operator/console',{data:{operation:'magic',email:actor.email}});assert.equal(denied.status(),401);
  const cross=await context.request.post(f.origin+'/api/console-auth/login',{headers:{Origin:'https://sibling-store.example.invalid'},form:{email:actor.email}});assert.equal(cross.status(),403);
  await page.goto(f.origin+'/login');await page.getByLabel('Email',{exact:true}).fill(actor.email);await page.getByRole('button',{name:'Send magic link',exact:true}).click();
  const href=await page.getByRole('link',{name:'Open local development magic link',exact:true}).getAttribute('href');assert.ok(href);
  const link=new URL(href,f.origin),magic=link.searchParams.get('token');assert.ok(magic);const jti=JSON.parse(Buffer.from(magic.split('.')[1],'base64url').toString()).jti;assert.match(jti,/^[0-9a-f-]{36}$/);
  await f.setIssuerAvailable(false);await page.goto(link.href);await page.waitForURL(url=>url.pathname==='/login'&&url.searchParams.has('error'));
  assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${jti}';`),'0');assert.equal((await context.cookies()).filter(c=>c.name==='lb_console_session').length,0);
  await f.setIssuerAvailable(true);f.loseNextOperatorExchangeReply();await page.goto(link.href);await page.waitForURL(url=>url.pathname==='/login'&&url.searchParams.has('error'));
  assert.equal(owned.psql(`SELECT count(*) FROM console_magic_link_consumptions WHERE jti='${jti}';`),'1');assert.equal((await context.cookies()).filter(c=>c.name==='lb_console_session').length,0);
  await context.close();const recovered=await f.login(actor);await recovered.page.reload();await recovered.page.waitForURL(url=>url.pathname==='/dashboard');
  const root=ownedTmpDir() + '/letbuyy-operator-browser-'+owned.runId;mkdirSync(root,{recursive:true});await recovered.page.screenshot({path:root+'/issuer-outage-fresh-login-recovery.png'});
  const response=await recovered.context.request.get(link.href,{maxRedirects:0});assert.equal(response.status(),303);
  const location=new URL(response.headers().location,f.origin);assert.equal(location.pathname,'/login');assert.equal(location.searchParams.get('error'),'invalid_magic_link');
  await recovered.context.close();
 });
});
