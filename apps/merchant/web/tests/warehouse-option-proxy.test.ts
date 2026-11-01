import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server';
import {createLetbuyyApiClient,LetbuyyApiError} from '@letbuyy/api-client';
import * as shared from '@letbuyy/shared-types';
import {validateMerchantMutationRequest} from '../src/lib/api/request-origin';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),site=id(1),actor=id(2);
function evaluate<T>(path:string,deps:Record<string,unknown>):T {
 const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};new Function('require','exports',js)((name:string)=>{assert.ok(deps[name],name);return deps[name];},exports);return exports as T;
}
for(const supplier of [false,true])for(const fault of ['none','session','owner','actor','query','missing-meta','foreign-row','denied'])test(
 (supplier?'suppliers':'locations')+' actual Next/SDK GET boundary '+fault,async()=>{
 const calls:string[]=[];
 const api=createLetbuyyApiClient({baseUrl:'https://gateway.synthetic.invalid/v1',storeId:id(99),fetch:async(input,init)=>{
  const req=new Request(input,init),url=new URL(req.url);calls.push(url.pathname);
  if(url.pathname.endsWith('/auth/custom/session'))return Response.json({authenticated:fault!=='session',user:fault==='session'?null:{id:actor}});
  assert.equal(req.headers.get('X-Store-ID'),site);assert.equal(url.searchParams.get('store_id'),site);assert.equal(url.searchParams.get('status'),'active');
  if(fault==='denied')return Response.json({error:{code:'FORBIDDEN',message:'Denied'}},{status:403});
  const row={id:id(3),[supplier?'site_id':'store_id']:fault==='foreign-row'?id(99):site,name:'Synthetic choice',status:'active',created_at:'2026-11-01T00:00:00Z',address:{},
   ...(supplier?{contact_name:null,email:null,phone:null}:{is_default:false})};
  return Response.json({data:[row],...(fault==='missing-meta'?{}:{meta:{store_id:site,page:2,per_page:2,total:3,total_is_exact:true,has_next:false}})});
 }});
 const client={createMerchantApiClient:()=>api,merchantApiErrorResponse:(error:unknown)=>NextResponse.json({error:{code:error instanceof LetbuyyApiError?error.code:'UNAVAILABLE'}},{status:error instanceof LetbuyyApiError?error.status:503})};
 const owner={resolveOwnedStoreId:async()=>fault==='owner'?{error:NextResponse.json({error:{code:'NOT_FOUND'}},{status:404})}:{storeId:site}};
 const security=evaluate<Record<string,unknown>>('../src/lib/api/merchant-security-scope.ts',{'next/server':{NextRequest,NextResponse},'./client':client,'./request-origin':{validateMerchantMutationRequest},'@/lib/stores/resolve-owned-store':owner});
 const warehouse=evaluate<Record<string,unknown>>('../src/lib/api/merchant-warehouse-scope.ts',{'next/server':{NextRequest,NextResponse},'./merchant-security-scope':security});
 const route=evaluate<{GET:(r:NextRequest,c:{params:Promise<{store:string}>})=>Promise<Response>}>(`../src/app/api/stores/[store]/${supplier?'suppliers':'inventory-locations'}/route.ts`,{
  'next/server':{NextRequest,NextResponse},'@/lib/api/client':client,'@/lib/stores/resolve-owned-store':owner,'@letbuyy/shared-types':shared,'@/lib/api/merchant-security-scope':security,'@/lib/api/merchant-warehouse-scope':warehouse});
 const query=fault==='query'?'page=0':'page=2&limit=2&status=active&store_id='+id(99);
 const result=await route.GET(new NextRequest('https://merchant.synthetic.invalid/api/stores/syn/options?'+query,{headers:{'X-LetBuyy-Merchant-Context':fault==='actor'?id(99):actor}}),{params:Promise.resolve({store:'syn'})});
 const body=await result.json();
 const status:Record<string,number>={none:200,session:401,owner:404,actor:409,query:400,'missing-meta':503,'foreign-row':503,denied:403};
 assert.equal(result.status,status[fault],JSON.stringify(body));assert.match(result.headers.get('Cache-Control')??'',/private.*no-store/);
 if(fault==='none'){assert.equal(body.data.length,1);assert.equal(body.meta.total,3);assert.equal(body.meta.store_id,site);}
 else assert.equal(body.data,undefined);
 if(['session','owner','actor','query'].includes(fault))assert.equal(calls.filter(path=>path.includes('/inventory/')).length,0);
});
