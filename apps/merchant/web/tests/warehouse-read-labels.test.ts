import assert from 'node:assert/strict';
import test from 'node:test';
import {WarehousePurchaseOrderSchema,WarehouseTransferSchema} from '@letbuyy/shared-types';
import {warehouseLineLabel,warehouseLocationLabel} from '../src/lib/inventory/warehouse-labels';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,date='2026-11-03T00:00:00Z';
for(const transfer of [false,true])test(`${transfer?'transfer':'PO'} presentation uses verified current names/variant SKU and explicit historical states`,()=>{
 const product={id:id(3),store_id:id(1),name:'Synthetic cotton tote',sku:'SYN-P',deleted_at:null},location={id:id(5),store_id:id(1),name:'Synthetic warehouse',deleted_at:null};
 const raw={id:id(2),site_id:id(1),notes:null,created_at:date,status:'partially_received',lines:[{id:id(4),site_id:id(1),product_id:id(3),variant_id:id(6),created_at:date,quantity_received:1,product,variant:{id:id(6),product_id:id(3),title:'Synthetic blue',sku:'SYN-B'},...(transfer?{transfer_id:id(2),quantity_requested:2,quantity_shipped:2}:{purchase_order_id:id(2),quantity_ordered:2,unit_cost:1})}],...(transfer?{transfer_number:'TR-SYN',source_location_id:id(5),destination_location_id:id(7),shipped_at:date,received_at:null,source_location:location,destination_location:{...location,id:id(7)}}:{po_number:'PO-SYN',supplier_id:null,location_id:id(5),expected_at:null,subtotal:2,total:2,currency:'INR',location})};
 const row=transfer?WarehouseTransferSchema.parse(raw):WarehousePurchaseOrderSchema.parse(raw);
 assert.equal(warehouseLineLabel(row.lines[0]),'Synthetic cotton tote / Synthetic blue / SYN-B');
 assert.equal(warehouseLocationLabel(location,location.id),'Synthetic warehouse');
 assert.equal(warehouseLineLabel({...row.lines[0],product:{...product,deleted_at:date}}),'Synthetic cotton tote (deleted) / Synthetic blue / SYN-B');
 assert.equal(warehouseLocationLabel({...location,deleted_at:date},location.id),'Synthetic warehouse (deleted)');
 assert.equal(warehouseLineLabel({...row.lines[0],product:null,variant:null}),`Product unavailable (${id(3).slice(0,8)}) / Variant unavailable (${id(6).slice(0,8)})`);
 assert.equal(warehouseLocationLabel(null,id(5)),`Location unavailable (${id(5).slice(0,8)})`);
 assert.equal(warehouseLocationLabel(null,null),'No location');
});
