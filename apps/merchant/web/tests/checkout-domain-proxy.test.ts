import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server';
import {createLetbuyyApiClient} from '@letbuyy/api-client';
import {validateMerchantMutationRequest} from '../src/lib/api/request-origin';

const site='11111111-1111-4111-8111-111111111111',admin='https://admin.example.invalid';
const key='synthetic-checkout-domain-request';
const setup={site_id:site,hostname:'checkout.qa.shops.example.invalid',parent_hostname:'shops.example.invalid',source:'platform',status:'active',ssl_status:'active',checkout_origin:'https://checkout.qa.shops.example.invalid',fallback_origin:'https://checkout.letbuyy.com',reason:null,dns_records:[]};
function load(denied=false){
    const calls:Array<{kind:string;input?:unknown;method?:string;key?:string|null}>=[];
    const api=createLetbuyyApiClient({baseUrl:'https://api.synthetic.invalid/v1',fetch:async(input,init)=>{
        const request=new Request(input,init),url=new URL(request.url);
        assert.equal(url.pathname,'/v1/custom/checkout-domain');
        calls.push({kind:'gateway',method:request.method,key:request.headers.get('X-Idempotency-Key'),input:request.method==='POST'?await request.json():url.searchParams.get('site_id')});
        return Response.json({success:true,data:setup});
    }});
    const dependencies:Record<string,unknown>={
        'next/server':{NextRequest,NextResponse},
        '@/lib/api/request-origin':{validateMerchantMutationRequest},
        '@/lib/api/client':{createMerchantApiClient:()=>api,merchantApiErrorResponse:()=>NextResponse.json({error:'Unavailable'},{status:503})},
        '@/lib/stores/resolve-owned-store':{resolveOwnedStoreId:async(store:string)=>{calls.push({kind:'owner',input:store});return denied?{error:NextResponse.json({error:'Unavailable'},{status:404})}:{storeId:site};}},
    };
    const source=readFileSync(new URL('../src/app/api/stores/[store]/domains/checkout/route.ts',import.meta.url),'utf8');
    const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    const handlers={} as {GET:(request:NextRequest,context:{params:Promise<{store:string}>})=>Promise<Response>;POST:(request:NextRequest,context:{params:Promise<{store:string}>})=>Promise<Response>|Response};
    new Function('require','exports',js)((name:string)=>{assert.ok(dependencies[name],name);return dependencies[name];},handlers);
    return {...handlers,calls};
}
function request(method='POST',headers:Record<string,string>={}){return new NextRequest(admin+'/api/stores/qa/domains/checkout',{method,headers:{host:'admin.example.invalid',origin:admin,'X-Idempotency-Key':key,...headers}});}
const context=()=>({params:Promise.resolve({store:'qa'})});
async function configured(run:()=>Promise<void>){const previous=process.env.NEXT_PUBLIC_ADMIN_URL;process.env.NEXT_PUBLIC_ADMIN_URL=admin;try{await run();}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_ADMIN_URL;else process.env.NEXT_PUBLIC_ADMIN_URL=previous;}}

test('actual checkout readiness BFF and SDK retain the owned site and canonical caller key',async()=>configured(async()=>{
    const route=load();assert.equal((await route.GET(request('GET'),context())).status,200);
    assert.equal((await route.POST(request(),context())).status,200);
    assert.deepEqual(route.calls,[{kind:'owner',input:'qa'},{kind:'gateway',method:'GET',key:null,input:site},{kind:'owner',input:'qa'},{kind:'gateway',method:'POST',key,input:{site_id:site}}]);
}));
test('foreign/missing browser origin, forged Host and missing key stop before ownership or provider work',async()=>configured(async()=>{
    for(const [headers,status] of [[{origin:'https://foreign.example.invalid'},403],[{origin:''},403],[{host:'attacker.example.invalid'},403],[{'X-Idempotency-Key':''},400]] as Array<[Record<string,string>,number]>){const route=load();assert.equal((await route.POST(request('POST',headers),context())).status,status);assert.equal(route.calls.length,0);}
}));
test('a foreign store never reaches the canonical checkout setup command',async()=>configured(async()=>{
    const route=load(true);assert.equal((await route.POST(request(),context())).status,404);assert.deepEqual(route.calls,[{kind:'owner',input:'qa'}]);
}));
