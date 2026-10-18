// Actual Dart SDK -> loopback production Gateway -> owned PostgREST/PostgreSQL.
// The private control path changes only fixed fixture state; it never answers
// a canonical API request or substitutes a provider/normal device sign-in proof.
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import test from 'node:test';
import {Gateway,gatewayEnv,newIdentityKeys,mintSession,seedBuyerAccount} from './gateway-harness';
import {requireOwnedDatabase,startOwnedClientRuntime,stopOwnedClientRuntime,type OwnedClientProcess} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';

const owned=requireOwnedDatabase();
test('canonical Dart buyer-order transport proves real ownership, cursor pagination, revocation and database recovery',{timeout:120_000},async(context)=>{
 const keys=await newIdentityKeys(),gateway=new Gateway(gatewayEnv(owned,keys));
 const sites=[newSyntheticTenant('dart-orders-a'),newSyntheticTenant('dart-orders-b')];for(const site of sites)seedSyntheticTenant(owned.psql,site);
 const a=seedBuyerAccount(owned.psql,'dart-orders-a'),b=seedBuyerAccount(owned.psql,'dart-orders-b');
 function link(buyer:string,index:number){const {orderId}=seedSyntheticOrder(owned.psql,sites[index]);owned.psql(`INSERT INTO buyer_order_links(order_id,buyer_account_id,site_id,link_basis,linked_at) VALUES('${orderId}','${buyer}','${sites[index].siteId}','authenticated_checkout','2026-10-01T10:00:00Z');`);return orderId;}
 const ordersA=[link(a.id,0),link(a.id,1)],orderB=link(b.id,0),nonce=crypto.randomUUID();
 const token=(id:string)=>mintSession(keys,id,{epoch:1});
 const fixture={run_id:owned.runId,token_a:await token(a.id),token_b:await token(b.id),orders_a:ordersA,order_b:orderB,control_nonce:nonce,
  expired_token:await mintSession(keys,a.id,{epoch:1,expiresInSeconds:-60}),wrong_realm_token:await mintSession(keys,a.id,{audience:'letbuyy:storefront-session',tokenUse:'storefront_session',epoch:1,extraClaims:{site_id:sites[0].siteId}})};
 const originalAcl=owned.psql("SELECT relacl::text FROM pg_class WHERE oid='public.orders'::regclass;");
 const calls:{path:string;status:number}[]=[];let adapter:Server|undefined,client:OwnedClientProcess|undefined;let stdout='',stderr='',ordersUnavailable=false;
 const abort=()=>{if(client?.exitCode===null&&client.signalCode===null)client.kill('SIGTERM');};
 context.signal.addEventListener('abort',abort,{once:true});
 try {
  context.signal.throwIfAborted();
  adapter=createServer(async(request,response)=>{
   const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString();
   if(request.url==='/_owned/buyer-orders/control'){
    if(request.method!=='POST'||request.headers['x-owned-test-nonce']!==nonce){response.writeHead(403);response.end();return;}
    try{const action=JSON.parse(body).action;
     if(action==='revoke_a')owned.psql(`UPDATE buyer_accounts SET session_epoch=2 WHERE id='${a.id}';`);
     // A real, reversible relation outage in this disposable database. Revoking
     // a direct SELECT grant did not deny effective reads in the prior fixture;
     // do not label that ineffective attempt a database-role proof.
     else if(action==='interrupt_order_reads'){
      if(ordersUnavailable)throw new Error('Order relation already unavailable');
      owned.psql('ALTER TABLE public.orders RENAME TO owned_buyer_orders_unavailable;');ordersUnavailable=true;
      assert.equal(owned.psql("SELECT to_regclass('public.orders') IS NULL;"),'t');
     }
     else if(action==='restore_order_reads'){
      if(!ordersUnavailable)throw new Error('Order relation is not unavailable');
      owned.psql('ALTER TABLE public.owned_buyer_orders_unavailable RENAME TO orders;');ordersUnavailable=false;
     }
     else{response.writeHead(400);response.end();return;}
     response.writeHead(204);response.end();
    }catch{response.writeHead(500);response.end();}return;
   }
   const headers=new Headers();for(const[name,value]of Object.entries(request.headers))if(typeof value==='string'&&!['host','connection','content-length','transfer-encoding','accept-encoding'].includes(name))headers.set(name,value);
   try{const result=await gateway.request(request.url??'/',{method:request.method,headers,...(body?{body}:{})});calls.push({path:request.url??'/',status:result.status});response.writeHead(result.status,Object.fromEntries(result.headers.entries()));response.end(result.text);}catch{response.writeHead(500);response.end('{}');}
  });
  await new Promise<void>(resolve=>adapter!.listen(0,'127.0.0.1',resolve));
  client=startOwnedClientRuntime(owned,'buyer-orders-dart',{env:{LETBUYY_API_URL:`http://127.0.0.1:${(adapter.address() as {port:number}).port}/v1`,LETBUYY_BUYER_ORDERS_FIXTURE:JSON.stringify(fixture)}});
  client.stdout.on('data',data=>{stdout+=data.toString();});client.stderr.on('data',data=>{stderr+=data.toString();});
  const code=await new Promise<number|null>(resolve=>client!.once('close',resolve));context.signal.throwIfAborted();assert.equal(code,0,stdout+'\n'+stderr);assert.match(stdout,/All tests passed/);
  assert.ok(calls.filter(call=>call.path.startsWith('/v1/storefront/buyer/orders')&&call.status===200).length>=7);
  assert.ok(calls.some(call=>call.status===404));assert.ok(calls.some(call=>call.status===401));assert.ok(calls.some(call=>call.status===500));
  assert.equal(owned.psql("SELECT relacl::text FROM pg_class WHERE oid='public.orders'::regclass;"),originalAcl,'the restored relation preserves its exact original ACL');
 }finally{
  context.signal.removeEventListener('abort',abort);
  if(ordersUnavailable)owned.psql('ALTER TABLE public.owned_buyer_orders_unavailable RENAME TO orders;');await stopOwnedClientRuntime(client);await gateway.settle();if(adapter){adapter.closeAllConnections();await new Promise<void>(resolve=>adapter!.close(()=>resolve()));}
 }
});
