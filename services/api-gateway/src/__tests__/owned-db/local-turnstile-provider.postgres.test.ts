// Tests the isolated test provider, not production anti-bot or human verification.
import assert from 'node:assert/strict';
import test from 'node:test';
import type {BrowserContext} from '@playwright/test';
import {createLocalTurnstileProvider,LOCAL_TURNSTILE_SECRET} from './local-turnstile-provider.fixture';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime} from './owned-db-support';

const owned=requireOwnedDatabase();

test('the local challenge provider requires its owned capability and consumes only its own tokens once',async()=>{
    await assert.rejects(createLocalTurnstileProvider({...owned}),/verified owned database/);
    const first=await createLocalTurnstileProvider(owned);
    let second:Awaited<ReturnType<typeof createLocalTurnstileProvider>>|undefined;
    try {
        second=await createLocalTurnstileProvider(owned);
        const url=first.profile.origin+'/turnstile/siteverify';
        const headers={'X-Owned-Provider-Capability':first.profile.capability};
        const form=(token:string,secret=LOCAL_TURNSTILE_SECRET)=>new URLSearchParams({secret,response:token});
        assert.equal((await fetch(url,{method:'POST',body:form(first.issue())})).status,403);
        const marker=await fetch(first.profile.origin+'/_owned_provider_fixture',{headers});
        assert.deepEqual(await marker.json(),{kind:first.profile.kind,runId:owned.runId,database:owned.database});
        const own=first.issue();
        const invalidSecret=await fetch(url,{method:'POST',headers,body:form(own,'synthetic-wrong-secret')});
        assert.equal(invalidSecret.status,400);
        assert.deepEqual(await invalidSecret.json(),{success:false,'error-codes':['invalid-input-secret']});
        const accepted=await fetch(url,{method:'POST',headers,body:form(own)});
        assert.deepEqual(await accepted.json(),{success:true,'error-codes':[]},'wrong secret must not consume the valid challenge');
        const replay=await fetch(url,{method:'POST',headers,body:form(own)});
        assert.deepEqual(await replay.json(),{success:false,'error-codes':['timeout-or-duplicate']});
        const foreign=await fetch(url,{method:'POST',headers,body:form(second.issue())});
        assert.deepEqual(await foreign.json(),{success:false,'error-codes':['timeout-or-duplicate']},'another fixture cannot supply an accepted challenge');
        assert.equal((await fetch(first.profile.origin+'/unexpected',{headers})).status,404);
        assert.equal((await fetch(url,{method:'POST',headers,body:'x'.repeat(8193)})).status,413);
        assert.equal(first.counts.verified,1);
        assert.equal(first.counts.refused,3);
        assert.throws(()=>first.enableNativeSdk(['https://accounts.letbuyy.com']),/local origins/);
        const nativeOrigin='http://localhost:49152';
        assert.equal((await fetch(first.profile.origin+'/fixtures/turnstile/api.js')).status,403);
        first.enableNativeSdk([nativeOrigin]);
        const sdk=await fetch(first.profile.origin+'/fixtures/turnstile/api.js',{headers:{Referer:nativeOrigin+'/login'}});
        assert.equal(sdk.status,200);assert.equal(sdk.headers.get('content-type'),'application/javascript');
        const document=await sdk.text();assert.equal(document.includes(first.profile.capability),false);
        assert.equal(document.includes('api/auth/login'),false);
        assert.equal((await fetch(first.profile.origin+'/fixtures/turnstile/challenge',{method:'POST'})).status,403);
        const challenge=await fetch(first.profile.origin+'/fixtures/turnstile/challenge',{method:'POST',headers:{Origin:nativeOrigin}});
        assert.equal(challenge.status,200);assert.equal(challenge.headers.get('access-control-allow-origin'),nativeOrigin);
        const payload=await challenge.json()as {token:string};
        const nativeProof=await fetch(url,{method:'POST',headers,body:form(payload.token)});
        assert.deepEqual(await nativeProof.json(),{success:true,'error-codes':[]});
        assert.equal(first.counts.nativeIssued,1);assert.equal(first.counts.verified,2);
        let bindings=0,routes=0;
        const browser={exposeBinding:async()=>{bindings++;},route:async()=>{routes++;}}as unknown as BrowserContext;
        for(const origin of ['https://store.localhost:49152','http://store.localhost.evil.invalid:49152','http://example.invalid:49152','http://user:pass@store.localhost:49152'])await assert.rejects(first.attachBrowser(browser,[origin]),/explicit loopback origins/);
        assert.equal(bindings,0);assert.equal(routes,0);
        await first.attachBrowser(browser,['http://synthetic-store.localhost:49152']);assert.equal(bindings,1);assert.equal(routes,1);
    } finally {
        await second?.close();
        await first.close();
    }
});

test('provider configuration cannot select another runtime, override the preload or forge fixture ownership',async()=>{
    const provider=await createLocalTurnstileProvider(owned);
    try {
        assert.throws(()=>startOwnedClientRuntime(owned,'lifecycle-probe',{env:{},providerFixture:provider.profile}),/Identity/);
        assert.throws(()=>startOwnedClientRuntime(owned,'identity-next-production',{port:32123,env:{LETBUYY_OWNED_PROVIDER_PROFILE:'{}'}}),/verified helper option/);
        const child=startOwnedClientRuntime(owned,'identity-next-production',{
            port:32123,
            env:{LETBUYY_API_URL:owned.restEnv().SUPABASE_URL+'/v1'},
            providerFixture:{...provider.profile,capability:'0'.repeat(64)},
        });
        let stdout='',stderr='';
        child.stdout.on('data',chunk=>{stdout+=chunk.toString();});
        child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
        try {
            assert.equal(await new Promise<number|null>(resolve=>child.once('close',resolve)),70);
            assert.equal(stdout,'','no app/build may start without the provider ownership handshake');
            assert.match(stderr,/provider.*ownership|provider.*handshake/i);
            assert.equal(stderr.includes(provider.profile.capability),false);
        } finally {await stopOwnedClientRuntime(child);}
    } finally {await provider.close();}
});
