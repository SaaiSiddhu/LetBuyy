import assert from 'node:assert/strict';
import test from 'node:test';
import { createLetbuyyApiClient, LetbuyyApiError } from '../../packages/typescript/api-client/src/index';
const store='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function page(number:number,total=53) {
 return {success:true,data:Array.from({length:Math.max(0,Math.min(50,total-(number-1)*50))},(_,i)=>({id:'staff-'+((number-1)*50+i),store_id:store,email:'syn-staff@example.invalid'})),
 meta:{page:number,per_page:50,total,total_pages:Math.ceil(total/50),has_prev:number>1,has_next:number*50<total}};
}
test('complete SDK roster composes53staff while preserving the existing array contract',async()=>{
 const calls:URL[]=[];const client=createLetbuyyApiClient({baseUrl:'https://gateway.test/v1',fetch:async(input)=>{const url=new URL(String(input));calls.push(url);return Response.json(page(Number(url.searchParams.get('page'))));}});
 const rows=await client.employees.list({store_id:store});assert.equal(rows.length,53);assert.equal(new Set(rows.map(row=>row.id)).size,53);
 assert.deepEqual(calls.map(url=>Object.fromEntries(url.searchParams)),[{store_id:store,page:'1',limit:'50'},{store_id:store,page:'2',limit:'50'}]);
});
test('confirmed empty roster performs one read',async()=>{let calls=0;const client=createLetbuyyApiClient({baseUrl:'https://gateway.test',fetch:async()=>{calls++;return Response.json(page(1,0));}});assert.deepEqual(await client.employees.list({store_id:store}),[]);assert.equal(calls,1);});
for(const fault of ['missing-meta','missing-count','wrong-page','wrong-size','wrong-end','count-change','duplicate','foreign-store','short-tail','tail-denial','tail-outage'])test('SDK '+fault+' never publishes a partial roster',async()=>{
 let calls=0;const client=createLetbuyyApiClient({baseUrl:'https://gateway.test',fetch:async()=>{
 const n=++calls;if(n===2&&fault.startsWith('tail-')&&fault!=='tail-outage'&&fault!=='tail-denial')throw new Error('Unexpected fixture');
 if(n===2&&['tail-denial','tail-outage'].includes(fault))return Response.json({error:{code:'SYNTHETIC',message:'Synthetic unavailable'}},{status:fault==='tail-denial'?403:503});
 const body:Record<string,unknown>=page(n);const meta=body.meta as Record<string,unknown>;
 if(n===2)switch(fault){case 'missing-meta':delete body.meta;break;case 'missing-count':delete meta.total;break;case 'wrong-page':meta.page=1;break;case 'wrong-size':meta.per_page=49;break;case 'wrong-end':meta.has_next=true;break;case 'count-change':meta.total=54;break;case 'duplicate':(body.data as Array<{id:string}>)[0].id='staff-0';break;case 'foreign-store':(body.data as Array<{store_id:string}>)[0].store_id='foreign';break;case 'short-tail':(body.data as unknown[]).pop();break;}
 return Response.json(body);}});
 await assert.rejects(client.employees.list({store_id:store}),(error:unknown)=>error instanceof LetbuyyApiError&&error.status===(fault==='tail-denial'?403:503));assert.equal(calls,2);
});
test('caller mutation cannot retarget the remaining roster pages',async()=>{const query={store_id:store};const calls:string[]=[];const client=createLetbuyyApiClient({baseUrl:'https://gateway.test',fetch:async(input)=>{const url=new URL(String(input));calls.push(url.searchParams.get('store_id')!);query.store_id='foreign';return Response.json(page(calls.length));}});assert.equal((await client.employees.list(query)).length,53);assert.deepEqual(calls,[store,store]);});
