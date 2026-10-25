import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as domain from '@letbuyy/theme-engine';

const storeA='11111111-1111-4111-8111-111111111111';
const storeB='22222222-2222-4222-8222-222222222222';
class MerchantApiRequestError extends Error {
    constructor(message,status,payload) { super(message);this.status=status;this.payload=payload; }
}
function route(relative,{actor='actor-a',resolvedStore=storeA}={}) {
    const calls={auth:0,resolve:0,save:[],publish:[],editor:[],preview:[]};
    const modules={
        'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
        '@letbuyy/theme-engine':domain,
        '@/lib/auth/session':{getSessionUser:async()=>{calls.auth++;return actor?{id:actor}:null;}},
        '@/lib/stores/resolve-owned-store':{resolveOwnedStoreId:async()=>{calls.resolve++;return {storeId:resolvedStore};}},
        '@/lib/api/client':{
            MerchantApiRequestError,
            merchantApiErrorResponse:error=>{if(error instanceof MerchantApiRequestError)return Response.json(error.payload,{status:error.status});throw error;},
            createMerchantApiClient:()=>({themes:{
                editor:async(slug,site,options)=>{calls.editor.push({slug,site,options});return {store:{id:resolvedStore},theme:{slug:'modern'},version:1,template_config:{},draft:{exists:true},schemas:{}};},
                saveDraft:async(slug,input)=>{calls.save.push({slug,input});return {saved_at:'2026-10-18T00:00:00Z',version:2,current_version:2,replayed:false};},
                publish:async(slug,input)=>{calls.publish.push({slug,input});return {release:{published_at:'2026-10-18T00:00:00Z'},version:2,current_version:2,replayed:false};},
                previewSession:async(slug,input)=>{calls.preview.push({slug,input});return {preview_session_id:'synthetic-session'};},
            }}),
        },
    };
    const source=readFileSync(new URL(relative,import.meta.url),'utf8');
    const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const exports={};new Function('require','exports',js)(name=>{assert.ok(modules[name],`Unexpected import ${name}`);return modules[name];},exports);
    return {...exports,calls};
}
const paths={save:'../src/app/api/themes/[themeId]/editor/draft/route.ts',publish:'../src/app/api/themes/[themeId]/editor/route.ts',preview:'../src/app/api/themes/[themeId]/preview-session/route.ts'};
const input={actorId:'actor-a',storeId:storeA,draftConfig:{owned:'saved draft'},baseVersion:1,idempotencyKey:'owned-key-12345678'};
const request=(operation,body)=>new Request('http://merchant.invalid/api/themes/modern/editor?store_name=store-a&template=index',{method:operation==='save'?'POST':'PUT',body:JSON.stringify(body)});
const params={params:Promise.resolve({themeId:'modern'})};
for (const operation of ['save','publish']) {
    test(`actual ${operation} BFF rejects actor switch, missing actor and signed-out context before a mutation`,async()=>{
        for(const [actor,body,status] of [['actor-b',input,403],['actor-a',{...input,actorId:undefined},403],[null,input,401]]) {
            const r=route(paths[operation],{actor});const response=await r[operation==='save'?'POST':'PUT'](request(operation,body),params);
            assert.equal(response.status,status);assert.equal(r.calls.auth,1);assert.equal(r.calls.resolve,0);
            assert.equal(r.calls.save.length+r.calls.publish.length,0);
        }
    });
    test(`actual ${operation} BFF rejects a changed canonical store and forwards the captured stable intent only for matching context`,async()=>{
        const changed=route(paths[operation],{resolvedStore:storeB});
        assert.equal((await changed[operation==='save'?'POST':'PUT'](request(operation,input),params)).status,403);
        assert.equal(changed.calls.save.length+changed.calls.publish.length,0);
        const valid=route(paths[operation]);
        assert.equal((await valid[operation==='save'?'POST':'PUT'](request(operation,input),params)).status,200);
        const sent=valid.calls[operation].at(-1).input;
        assert.equal(sent.store_id,storeA);assert.equal(sent.base_version,1);assert.equal(sent.idempotency_key,input.idempotencyKey);
    });
}
test('actual editor GET exposes its authenticated actor and canonical store together',async()=>{
    const r=route(paths.publish);const response=await r.GET(new Request('http://merchant.invalid/api/themes/modern/editor?store_name=store-a'),params);
    assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.actorId,'actor-a');assert.equal(payload.store.id,storeA);
});

for(const key of ['page.faq','product.alternate','customers/account']) {
    test(`actual editor BFF load/save/publish/preview preserve the selected template ${key}`,async()=>{
        const get=route(paths.publish);
        assert.equal((await get.GET(new Request(`http://merchant.invalid/api/themes/modern/editor?store_name=store-a&template=${encodeURIComponent(key)}`),params)).status,200);
        assert.equal(get.calls.editor[0].options.query.template_key,key);
        for(const [operation,method] of [['save','POST'],['publish','PUT'],['preview','POST']]) {
            const r=route(paths[operation]);
            const response=await r[method](new Request('http://merchant.invalid/api/themes/modern/editor?store_name=store-a',{method,body:JSON.stringify({...input,store_name:'store-a',templateKey:key})}),params);
            assert.equal(response.status,200);
            assert.equal(r.calls[operation][0].input.template_key,key);
        }
    });
}
for(const key of ['','../private','constructor','prototype','Page','page.faq/other']) {
    test(`actual BFF boundaries reject invalid template ${JSON.stringify(key)} without touching the API`,async()=>{
        const get=route(paths.publish);
        assert.equal((await get.GET(new Request(`http://merchant.invalid/api/themes/modern/editor?store_name=store-a&template=${encodeURIComponent(key)}`),params)).status,400);
        assert.equal(get.calls.editor.length,0);
        for(const [operation,method] of [['save','POST'],['publish','PUT'],['preview','POST']]) {
            const r=route(paths[operation]);
            assert.equal((await r[method](new Request('http://merchant.invalid/api/themes/modern/editor?store_name=store-a',{method,body:JSON.stringify({...input,store_name:'store-a',templateKey:key})}),params)).status,400);
            assert.equal(r.calls[operation].length,0);
        }
    });
}
