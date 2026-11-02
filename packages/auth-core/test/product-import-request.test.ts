import assert from 'node:assert/strict';
import test from 'node:test';
import {createProductImportRequestHeaders,verifyProductImportRequest,PRODUCT_IMPORT_REQUEST_PATH} from '../src/index';
const input={secret:'synthetic-product-import-purpose-key-only-0123456789',environment:'staging' as const,
 method:'POST',url:'https://gateway.synthetic.invalid'+PRODUCT_IMPORT_REQUEST_PATH,body:new TextEncoder().encode('{}'),nowMs:1793000000000};
const verify=(headers:Record<string,string>,extra:object={})=>verifyProductImportRequest({...input,headers:new Headers(headers),...extra});
test('fixed import transport verifies without transmitting the dedicated key',async()=>{
 const headers=await createProductImportRequestHeaders(input);assert.equal((await verify(headers)).status,'accepted');
 assert.equal(Object.values(headers).includes(input.secret),false);assert.equal(headers['X-Internal-API-Secret'],undefined);
});
test('import transport binds the exact purpose, method, body, deployment and freshness',async()=>{
 const headers=await createProductImportRequestHeaders(input);
 for(const change of [{method:'GET'},{url:input.url+'/extra'},{url:input.url+'?limit=1'},{url:input.url+'#fragment'},
  {body:new TextEncoder().encode('{ }')},{environment:'production'},{secret:input.secret+'different'},
  {nowMs:input.nowMs+120001},{nowMs:input.nowMs-120001}])assert.notEqual((await verify(headers,change)).status,'accepted');
 for(const name of ['X-LetBuyy-Internal-Version','X-LetBuyy-Internal-Caller','X-LetBuyy-Internal-App','X-LetBuyy-Internal-Environment',
  'X-LetBuyy-Internal-Timestamp','X-LetBuyy-Internal-JTI','X-LetBuyy-Internal-Signature'])assert.notEqual((await verify({...headers,[name]:'tampered'})).status,'accepted');
});
test('weak/unconfigured keys and arbitrary internal targets cannot sign imports',async()=>{
 for(const secret of ['', 'short','SKIP_NEEDS_HUMAN_PRODUCT_IMPORT_SECRET'])await assert.rejects(createProductImportRequestHeaders({...input,secret}));
 for(const url of ['https://gateway.synthetic.invalid/v1/internal/identity/operator','https://gateway.synthetic.invalid/v1/internal/notification-jobs/execute'])await assert.rejects(createProductImportRequestHeaders({...input,url}));
 await assert.rejects(createProductImportRequestHeaders({...input,body:new Uint8Array(65)}));
});
