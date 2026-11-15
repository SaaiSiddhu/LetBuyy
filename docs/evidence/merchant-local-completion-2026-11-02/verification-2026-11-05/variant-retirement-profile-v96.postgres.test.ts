// Read-only catalog qualification of this owned fresh database; no hosted source.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync}from'node:fs';
import {requireOwnedDatabase}from'../../../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
const owned=requireOwnedDatabase();
test('capture current canonical function and open-work table profiles for reviewed438 source',()=>{
 const functions=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'definition',pg_get_functiondef(oid),'hash',encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex'),'owner',proowner,'acl',proacl))FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('apply_product_edit_v1','product_edit_snapshot_v1','create_order_with_inventory_reservations','set_inventory_level_available','adjust_inventory_level','reserve_inventory')`));
 const tables=JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object('name',c.relname,'columns',(SELECT jsonb_agg(a.attname ORDER BY a.attnum)FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'checks',(SELECT jsonb_agg(pg_get_constraintdef(k.oid))FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='c')))FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN('inventory_levels','inventory_reservations','inventory_transfer_lines','inventory_transfers','purchase_order_lines','purchase_orders','fulfillment_order_lines','fulfillment_orders','order_items','orders','return_lines','returns')`));
 assert.ok(functions.length>=6);writeFileSync('docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05/variant-retirement-v96-owned-profiles.json',JSON.stringify({run_id:owned.runId,functions,tables},null,2)+'\n',{flag:'wx',mode:0o600});
});
