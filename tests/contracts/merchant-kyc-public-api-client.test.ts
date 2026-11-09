import assert from 'node:assert/strict';
import test from 'node:test';
import {createLetbuyyApiClient,LetbuyyApiError} from '../../packages/typescript/api-client/src/index';
const site='8a55c36a-1460-42bb-8fa4-f499c92b5c01';
const other='8a55c36a-1460-42bb-8fa4-f499c92b5c02';
const doc=()=>({id:'8a55c36a-1460-42bb-8fa4-f499c92b5c11',site_id:site,document_type:'bank_proof',status:'submitted',provider:'letbuyy_sandbox_kyc',provider_mode:'sandbox',has_private_upload:true,created_at:'2026-11-06T00:00:00Z',updated_at:'2026-11-06T00:00:00+00:00'});
const overview=()=>({site_id:site,overall_status:'in_progress',provider_mode:'sandbox',private_upload_available:true,documents:[doc()],required_documents:[]});
test('web KYC public populated response remains available and scope is captured before await',async()=>{
 const input={store_id:site};const client=createLetbuyyApiClient({baseUrl:'https://gateway.test/v1',fetch:async()=>{input.store_id=other;return Response.json({data:overview()});}});
 assert.equal((await client.kyc.overview(input)).documents.length,1);
});
for(const fault of ['sparse','foreign-overview','foreign-document','private-object','coerced-flag','duplicate','invalid-date'])test('web KYC rejects '+fault+' without exposing raw validation payload',async()=>{
 const row:Record<string,unknown>=overview();const document:Record<string,unknown>=doc();row.documents=[document];
 switch(fault){case'sparse':delete row.overall_status;break;case'foreign-overview':row.site_id=other;break;case'foreign-document':document.site_id=other;break;case'private-object':document.private_object_key='synthetic-private-key';break;case'coerced-flag':row.private_upload_available='true';break;case'duplicate':row.documents=[document,document];break;case'invalid-date':document.updated_at='2026-02-30T00:00:00Z';break;}
 const client=createLetbuyyApiClient({baseUrl:'https://gateway.test/v1',fetch:async()=>Response.json({data:row})});
 await assert.rejects(client.kyc.overview({store_id:site}),(e:unknown)=>e instanceof LetbuyyApiError&&e.code==='KYC_INVALID_RESPONSE'&&e.body===undefined);
});
