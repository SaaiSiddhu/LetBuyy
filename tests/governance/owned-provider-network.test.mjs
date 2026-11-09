import assert from 'node:assert/strict';
import test from 'node:test';
import {createOwnedProviderFetch,validateOwnedProviderFixture}from '../../scripts/governance/owned-provider-network.mjs';
const profile={kind:'turnstile-local-v1',origin:'http://127.0.0.1:54321',capability:'a'.repeat(64)};

test('owned provider admission rejects external, ambiguous, credentialed and executable profiles',()=>{
 assert.equal(validateOwnedProviderFixture(profile).origin,profile.origin);
 for(const origin of ['https://127.0.0.1:54321','http://localhost:54321','http://127.0.0.1:80','http://127.0.0.1:54321/path',
  'http://127.0.0.1:54321?query=1','http://user:pass@127.0.0.1:54321','http://127.0.0.1.example.test:54321','http://127.1:54321'])
  assert.throws(()=>validateOwnedProviderFixture({...profile,origin}));
 for(const bad of [{...profile,kind:'arbitrary-proxy'},{...profile,capability:'short'},{...profile,loader:'/tmp/loader.mjs'}])assert.throws(()=>validateOwnedProviderFixture(bad));
});
test('only exact siteverify POST is redirected to the fixed owned fixture and headers are rebuilt',async()=>{
 const calls=[];const guarded=createOwnedProviderFetch(async(input,init)=>{calls.push({input,init});return Response.json({success:true});},profile);
 const source='secret=synthetic&response=owned-token';
 await guarded('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:source,headers:{Authorization:'must-not-forward'}});
 assert.equal(calls.length,1);assert.equal(calls[0].input,profile.origin+'/turnstile/siteverify');assert.equal(calls[0].init.redirect,'error');
 assert.equal(calls[0].init.headers.Authorization,undefined);assert.equal(calls[0].init.headers['X-Owned-Provider-Capability'],profile.capability);
 assert.equal(new TextDecoder().decode(calls[0].init.body),source);
 for(const url of ['https://challenges.cloudflare.com/turnstile/v0/siteverify?x=1','https://challenges.cloudflare.com/turnstile/v0/other','https://api.resend.com/emails','https://api.staging.letbuyy.com/v1'])await assert.rejects(()=>guarded(url));
 await assert.rejects(()=>guarded('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'GET'}));assert.equal(calls.length,1);
});
test('allowed local fetches cannot follow redirects to an external host',async()=>{
 const calls=[];const guarded=createOwnedProviderFetch(async(input,init)=>{calls.push({input,init});return Response.json({});},profile);
 await guarded('http://localhost:9002/api/auth/session',{redirect:'follow'});
 assert.equal(calls[0].init.redirect,'error');
 await guarded('http://localhost:9002/login',{redirect:'manual'});
 assert.equal(calls[1].init.redirect,'manual','manual observation cannot follow a hosted redirect');
 for(const url of ['http://localhost.example.test:9002','http://user:pass@localhost:9002','file:///etc/hosts'])await assert.rejects(()=>guarded(url));
 assert.equal(calls.length,2);
});
test('oversized provider bodies are refused without dispatch',async()=>{
 let calls=0;const guarded=createOwnedProviderFetch(async()=>{calls++;return Response.json({});},profile);
 await assert.rejects(()=>guarded('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:'x'.repeat(8193)}));assert.equal(calls,0);
});

test('an explicit local deny list refuses unrelated listeners before any fetch without widening provider authority', async () => {
    let reached=0;const profile={kind:'turnstile-local-v1',origin:'http://127.0.0.1:19001',capability:'a'.repeat(64)};
    const fetcher=createOwnedProviderFetch(async()=>{reached++;return Response.json({ok:true})},profile,[9002]);
    for(const host of ['localhost','127.0.0.1','[::1]'])await assert.rejects(fetcher(`http://${host}:9002/`),/unrelated local listener/);
    assert.equal(reached,0);await fetcher('http://127.0.0.1:19001/_owned_provider_fixture');assert.equal(reached,1);
    for(const ports of [null,'9002',[0],[65536],[9002.5]])assert.throws(()=>createOwnedProviderFetch(async()=>Response.json({}),profile,ports),/deny list refused/);
});
