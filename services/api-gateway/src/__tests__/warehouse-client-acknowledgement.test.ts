import assert from 'node:assert/strict';
import test from 'node:test';
import {createLetbuyyApiClient,LetbuyyApiError,type LetbuyyApiClient} from '@letbuyy/api-client';
import {prepareWarehouseCommand} from '@letbuyy/commerce-core';
import type {WarehouseCommandOperation} from '@letbuyy/shared-types';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const operations:WarehouseCommandOperation[]=['purchase_order.create','purchase_order.receive','transfer.create','transfer.ship','transfer.receive'];
function body(op:WarehouseCommandOperation) {
 const common={store_id:id(1),idempotency_key:id(2)};
 if(op==='purchase_order.create')return {...common,location_id:id(5),lines:[{product_id:id(6),quantity:4,unit_cost:12.25}]};
 if(op==='transfer.create')return {...common,source_location_id:id(5),destination_location_id:id(7),lines:[{product_id:id(6),quantity:4}]};
 if(op==='transfer.ship')return common;
 return {...common,lines:[{[op==='purchase_order.receive'?'purchase_order_line_id':'transfer_line_id']:id(4),quantity:2}]};
}
function ack(op:WarehouseCommandOperation,cancelled=false) {
 const po=op.startsWith('purchase_order.'),create=op.endsWith('.create'),receiving=op.endsWith('.receive'),intent=prepareWarehouseCommand(op,create?null:id(3),body(op));
 return {command_receipt:{id:id(8),key:id(2),site_id:id(1),actor_id:id(9),operation:op,target_id:cancelled&&create?null:id(3),
  outcome:cancelled?'cancelled':'applied',command:intent.command,effective_lines:!cancelled&&op.endsWith('.receive')?intent.command.lines:null},
  ...(!cancelled?{[po?'purchase_order':'transfer']:{id:id(3),site_id:id(1),status:create?(po?'ordered':'reserved'):receiving?'partially_received':'shipped'}}:{}),
  lines:cancelled?[]:[{id:id(4),site_id:id(1),[po?'purchase_order_id':'transfer_id']:id(3),product_id:id(6),variant_id:null,
    ...(po?{quantity_ordered:4,quantity_received:receiving?2:0,unit_cost:12.25}:{quantity_requested:4,quantity_shipped:create?0:4,quantity_received:receiving?2:0})}]};
}
function send(api:LetbuyyApiClient,op:WarehouseCommandOperation) {
 const options={storeId:id(1)};
 switch(op) {
  case 'purchase_order.create':return api.inventory.purchaseOrders.create({store_id:id(1),location_id:id(5),lines:[{product_id:id(6),quantity:4,unit_cost:12.25}],idempotency_key:id(2)},options);
  case 'purchase_order.receive':return api.inventory.purchaseOrders.receive(id(3),{lines:[{purchase_order_line_id:id(4),quantity:2}],idempotency_key:id(2)},options);
  case 'transfer.create':return api.inventory.transfers.create({store_id:id(1),source_location_id:id(5),destination_location_id:id(7),lines:[{product_id:id(6),quantity:4}],idempotency_key:id(2)},options);
  case 'transfer.ship':return api.inventory.transfers.ship(id(3),{store_id:id(1),idempotency_key:id(2)},options);
  case 'transfer.receive':return api.inventory.transfers.receive(id(3),{store_id:id(1),lines:[{transfer_line_id:id(4),quantity:2}],idempotency_key:id(2)},options);
 }
}
for(const op of operations) {
 test(op+' SDK pins the request identity and decodes a populated scoped acknowledgement',async()=>{
  const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',storeId:id(99),fetch:async(_url,init)=>{
   const headers=new Headers(init?.headers),payload=JSON.parse(String(init?.body));
   assert.equal(headers.get('X-Store-ID'),id(1));assert.equal(headers.get('X-Idempotency-Key'),id(2));assert.equal(headers.get('X-LetBuyy-Warehouse-Protocol'),'1');assert.equal(payload.idempotency_key,id(2));return Response.json({data:ack(op)});
  }});
  assert.equal((await send(api,op)).command_receipt.operation,op);
 });
 for(const fault of ['key','site','operation','shape'])test(op+' SDK refuses mismatched '+fault,async()=>{
  const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',fetch:async()=>{
   const data=ack(op);
   if(fault==='key')data.command_receipt.key=id(99);
   if(fault==='site')data.command_receipt.site_id=id(99);
   if(fault==='operation')data.command_receipt.operation=op==='transfer.ship'?'transfer.receive':'transfer.ship';
   if(fault==='shape')data.lines=[];
   return Response.json({data});
  }});
  await assert.rejects(()=>send(api,op),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_ACKNOWLEDGEMENT_UNVERIFIED');
 });
 test(op+' SDK stop preserves both applied and cancelled outcomes',async()=>{
  for(const cancelled of [false,true]) {
   const desired=prepareWarehouseCommand(op,op.endsWith('.create')?null:id(3),body(op));
   const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',storeId:id(99),fetch:async(url)=>{
    assert.match(String(url),/\/inventory\/commands\/stop$/);return Response.json({data:ack(op,cancelled)});
   }});
   assert.equal((await api.inventory.stopCommand({store_id:id(1),idempotency_key:id(2),...desired})).command_receipt.outcome,cancelled?'cancelled':'applied');
  }
 });
}
test('SDK rejects a header/body key conflict without dispatching a warehouse effect',async()=>{
 let calls=0;const api=createLetbuyyApiClient({baseUrl:'https://gateway.test',fetch:async()=>{calls++;return Response.json({});}});
 await assert.rejects(()=>api.inventory.transfers.ship(id(3),{store_id:id(1),idempotency_key:id(2)},
  {idempotencyKey:id(99)}),e=>e instanceof LetbuyyApiError&&e.code==='WAREHOUSE_KEY_CONFLICT');assert.equal(calls,0);
});
