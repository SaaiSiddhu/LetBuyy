// Real current server helper with controlled SDK transport;
// controlled SDK transport only, not browser/backend acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
class ApiError extends Error {
  constructor(input) {super(input.message||input.code);this.status=input.status;this.code=input.code;}
}
class MerchantError extends Error {}
function load(relative,modules) {
  const js=ts.transpileModule(readFileSync(resolve(root,relative),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText;
  const exports={};
  new Function('require','exports',js)(name=>{
    if(name==='@/lib/api/read-retry')return load('apps/merchant/web/src/lib/api/read-retry.ts',{
      '@letbuyy/api-client':{LetbuyyApiError:ApiError},'./client':{MerchantApiRequestError:MerchantError},
    });
    assert(name in modules,'Unexpected helper dependency: '+name);return modules[name];
  },exports);
  return exports;
}
const member=n=>({id:`synthetic-member-${n}`,name:`Synthetic member ${n}`,store_name:`synthetic-${n}`,
  subdomain:`synthetic-${n}`,site_type:'store',status:'published'});
const response=(page,total=53)=>({data:Array.from({length:Math.max(0,Math.min(50,total-(page-1)*50))},(_,i)=>member((page-1)*50+i+1)),
  total,page,limit:50,has_more:page*50<total,next_cursor:null,total_is_exact:true});
function fixture(reply) {
  const calls=[];
  const api={stores:{list:async(query,options)=>{
    calls.push({query,options});return reply(query?.page??1,calls.length);
  }}};
  const session=load('apps/merchant/web/src/lib/auth/session.ts',{
    react:{cache:fn=>fn},'@letbuyy/api-client':{LetbuyyApiError:ApiError},
    '@/lib/api/client':{createMerchantApiClient:()=>api,MerchantApiRequestError:MerchantError},
  });
  return {calls,getUserStores:session.getUserStores};
}
test('web store header includes every current membership beyond page50',async()=>{
  const f=fixture(page=>response(page));
  const rows=await f.getUserStores('compatibility-hint-does-not-grant-access');
  assert.equal(rows.length,53);
  assert.equal(rows.at(-1).id,member(53).id);
  assert.deepEqual(f.calls.map(call=>call.query),[{page:1,limit:50},{page:2,limit:50}]);
  for(const call of f.calls) {
    assert.equal(call.options?.storeId,'');
    assert(!('actor_id' in call.query));
  }
});
test('web confirmed empty membership population remains empty',async()=>{
  const f=fixture(page=>response(page,0));assert.deepEqual(await f.getUserStores('actor-a'),[]);
  assert.equal(f.calls.length,1);
});
for(const defect of ['duplicate','count-change','missing-tail','wrong-page','wrong-size','false-end']) {
  test(`web ${defect} refuses a partial complete membership projection`,async()=>{
    const f=fixture(page=>{
      const result=response(page);
      if(page===2)switch(defect) {
        case 'duplicate':result.data[0]=member(1);break;
        case 'count-change':result.total=54;break;
        case 'missing-tail':result.data.pop();break;
        case 'wrong-page':result.page=1;break;
        case 'wrong-size':result.limit=49;break;
        case 'false-end':result.has_more=true;break;
      }
      return result;
    });
    await assert.rejects(f.getUserStores('actor-a'),error=>error.status===503&&error.code==='STORE_LIST_UNVERIFIED');
  });
}
test('tail auth denial never returns the already-read first page',async()=>{
  const f=fixture(page=>{if(page===2)throw new ApiError({status:403,code:'FORBIDDEN'});return response(page);});
  assert.deepEqual(await f.getUserStores('actor-a'),[]);
  assert.equal(f.calls.length,2);
});
test('tail outage remains an unavailable read without returning partial rows',async()=>{
  const f=fixture(page=>{if(page===2)throw new ApiError({status:503,code:'SYNTHETIC_OUTAGE'});return response(page);});
  await assert.rejects(f.getUserStores('actor-a'),error=>error.status===503);
  assert(f.calls.filter(call=>call.query.page===2).length>=1);
});
