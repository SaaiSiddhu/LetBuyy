import assert from 'node:assert/strict';
import test from 'node:test';
import {WarehouseCommandResultSchema} from '@letbuyy/shared-types';
const uuid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function result(transfer=false) {
 const line:Record<string,unknown>={id:uuid(5),site_id:uuid(1),product_id:uuid(6),variant_id:null,quantity_received:2,
  ...(transfer?{transfer_id:uuid(4),quantity_requested:5,quantity_shipped:3}:{purchase_order_id:uuid(4),quantity_ordered:5,unit_cost:12.25})};
 return {command_receipt:{id:uuid(7),key:'synthetic-command-key',site_id:uuid(1),actor_id:uuid(2),
  operation:transfer?'transfer.receive':'purchase_order.receive',outcome:'applied',target_id:uuid(4),command:{lines:null},
  effective_lines:[{[transfer?'transfer_line_id':'purchase_order_line_id']:uuid(5),quantity:2}]},
  [transfer?'transfer':'purchase_order']:{id:uuid(4),site_id:uuid(1),status:'partially_received'},lines:[line]};
}
for(const transfer of [true,false]) {
 test((transfer?'transfer':'PO')+' acknowledgement accepts a populated scoped partial receipt',()=>{
  assert.equal(WarehouseCommandResultSchema.safeParse(result(transfer)).success,true);
 });
 for(const fault of ['foreign-line','foreign-parent','target','duplicate','fraction','missing-count','over-received','state']) {
  test((transfer?'transfer':'PO')+' acknowledgement rejects '+fault,()=>{
   const body=result(transfer),line=body.lines[0];
   if(fault==='foreign-line')line.site_id=uuid(9);
   if(fault==='foreign-parent')line[transfer?'transfer_id':'purchase_order_id']=uuid(9);
   if(fault==='target')body.command_receipt.target_id=uuid(9);
   if(fault==='duplicate')body.lines.push({...line});
   if(fault==='fraction')line.quantity_received=1.5;
   if(fault==='missing-count')delete line.quantity_received;
   if(fault==='over-received')line.quantity_received=6;
   if(fault==='state')(body[transfer?'transfer':'purchase_order'] as Record<string,unknown>).status='invented';
   assert.equal(WarehouseCommandResultSchema.safeParse(body).success,false);
  });
 }
}
test('a transfer acknowledgement cannot claim more received units than were shipped',()=>{
 const body=result(true);body.lines[0].quantity_received=4;
 assert.equal(WarehouseCommandResultSchema.safeParse(body).success,false);
});

