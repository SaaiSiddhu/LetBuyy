import assert from 'node:assert/strict';
import test from 'node:test';
import {InventoryReservationSchema}from '@letbuyy/shared-types';
import {projectInventoryReservationRead}from '../lib/inventory-reservation-read';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,date='2026-11-03T00:00:00Z';
function source(){return{id:id(1),store_id:id(2),product_id:id(3),variant_id:null,location_id:id(4),order_id:null,quantity:4,status:'active',expires_at:'infinity',created_at:date,updated_at:date,products:{id:id(3),store_id:id(2),name:'Synthetic product'},transfer_line:{id:id(5),site_id:id(2),transfer_id:id(6),reservation_id:id(1),product_id:id(3),variant_id:null,quantity_requested:4,quantity_received:0,metadata:{},transfer:{id:id(6),site_id:id(2),transfer_number:'TR-SYN',status:'reserved',source_location_id:id(4)}}};}
test('canonical temporary and transfer-bound reservation lifetimes remain distinct',()=>{
 const temporary={...source(),expires_at:date,transfer_line:null};const ttl=InventoryReservationSchema.parse(projectInventoryReservationRead(temporary));assert.equal(ttl.expires_at,date);assert.equal(ttl.transfer,null);
 const held=InventoryReservationSchema.parse(projectInventoryReservationRead(source()));assert.equal(held.expires_at,null);assert.equal(held.transfer?.id,id(6));assert.equal(held.transfer?.reservation_id,id(1));assert.equal(held.transfer?.source_location_id,id(4));assert.equal(held.transfer?.base_received,0);assert.equal('transfer_line'in held,false,'Private SQL metadata is not a client contract');
 const shipped=source();shipped.status='committed';shipped.transfer_line.transfer.status='partially_received';shipped.transfer_line.quantity_received=1;assert.equal(InventoryReservationSchema.parse(projectInventoryReservationRead(shipped)).transfer?.quantity_received,1);
 const retained=source();retained.status='committed';retained.quantity=3;retained.transfer_line.transfer.status='partially_received';retained.transfer_line.quantity_received=1;retained.transfer_line.metadata={canonical_reservation436:{base_received:1}};assert.equal(InventoryReservationSchema.parse(projectInventoryReservationRead(retained)).transfer?.base_received,1);
});
for(const fault of ['unbound','unknown-expiry','negative-infinity','finite-transfer','parent-id','parent-site','line-site','reservation-id','product','variant','location','quantity','bad-base','received','status','product-join'])test('reservation read refuses '+fault,()=>{
 const row=source()as Record<string,unknown>,line=row.transfer_line as Record<string,unknown>,parent=line.transfer as Record<string,unknown>;
 if(fault==='unbound')row.transfer_line=null;
 if(fault==='unknown-expiry')row.expires_at='unknown';if(fault==='negative-infinity')row.expires_at='-infinity';if(fault==='finite-transfer')row.expires_at=date;
 if(fault==='parent-id')parent.id=id(99);if(fault==='parent-site')parent.site_id=id(99);if(fault==='line-site')line.site_id=id(99);if(fault==='reservation-id')line.reservation_id=id(99);
 if(fault==='product')line.product_id=id(99);if(fault==='variant')line.variant_id=id(99);if(fault==='location')parent.source_location_id=id(99);if(fault==='quantity')line.quantity_requested=5;
 if(fault==='bad-base')line.metadata={canonical_reservation436:{base_received:'1'}};if(fault==='received')line.quantity_received=5;if(fault==='status')row.status='committed';if(fault==='product-join')(row.products as Record<string,unknown>).id=id(99);
 assert.equal(InventoryReservationSchema.safeParse(projectInventoryReservationRead(row)).success,false);
});
