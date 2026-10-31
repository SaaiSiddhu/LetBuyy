import {z} from 'zod';

const id=z.string().uuid(),count=z.number().int().min(0).max(999999);
export const WarehouseDocumentScopeQuerySchema=z.object({store_id:id}).strict();
export const WarehouseDocumentParamsSchema=z.object({id}).strict();
const date=z.string().datetime({offset:true});
const amount=z.number().finite().nonnegative().refine(n=>Math.round(n*100)/100===n,'Amounts must use whole paise.');
export const WarehousePurchaseOrderLineSchema=z.object({
 id,site_id:id,purchase_order_id:id,product_id:id,variant_id:id.nullable(),
 quantity_ordered:count.min(1),quantity_received:count,unit_cost:amount,
 created_at:date,updated_at:date.nullable().optional(),
}).passthrough().refine(row=>row.quantity_received<=row.quantity_ordered,'Received quantity exceeds ordered quantity.');
export const WarehouseTransferLineSchema=z.object({
 id,site_id:id,transfer_id:id,product_id:id,variant_id:id.nullable(),
 quantity_requested:count.min(1),quantity_shipped:count,quantity_received:count,
 created_at:date,updated_at:date.nullable().optional(),
}).passthrough().refine(row=>row.quantity_received<=row.quantity_shipped&&row.quantity_shipped<=row.quantity_requested,
 'Transfer quantities could not be confirmed.');
export const WarehousePurchaseOrderSchema=z.object({
 id,site_id:id,supplier_id:id.nullable(),location_id:id.nullable(),po_number:z.string().min(1),
 status:z.enum(['draft','ordered','partially_received','received','cancelled','closed']),
 expected_at:date.nullable(),notes:z.string().nullable(),subtotal:amount,total:amount,currency:z.literal('INR'),
 created_at:date,updated_at:date.nullable().optional(),
 supplier:z.object({id,site_id:id,name:z.string()}).passthrough().nullable().optional(),
 lines:WarehousePurchaseOrderLineSchema.array().min(1).max(200),
}).passthrough().superRefine((row,ctx)=>{
 const ids=new Set<string>();
 if(row.supplier&&(row.supplier.site_id!==row.site_id||row.supplier.id!==row.supplier_id))
  ctx.addIssue({code:z.ZodIssueCode.custom,message:'Supplier scope could not be confirmed.'});
 for(const line of row.lines) {
  if(line.site_id!==row.site_id||line.purchase_order_id!==row.id||ids.has(line.id))
   ctx.addIssue({code:z.ZodIssueCode.custom,message:'Purchase order line scope could not be confirmed.'});
  ids.add(line.id);
 }
});
export const WarehouseTransferSchema=z.object({
 id,site_id:id,transfer_number:z.string().min(1),source_location_id:id,destination_location_id:id,
 status:z.enum(['reserved','shipped','partially_received','received','cancelled']),
 notes:z.string().nullable(),shipped_at:date.nullable(),received_at:date.nullable(),
 created_at:date,updated_at:date.nullable().optional(),
 lines:WarehouseTransferLineSchema.array().min(1).max(200),
}).passthrough().superRefine((row,ctx)=>{
 const ids=new Set<string>();
 if(row.source_location_id===row.destination_location_id)
  ctx.addIssue({code:z.ZodIssueCode.custom,message:'Transfer locations must differ.'});
 for(const line of row.lines) {
  if(line.site_id!==row.site_id||line.transfer_id!==row.id||ids.has(line.id))
   ctx.addIssue({code:z.ZodIssueCode.custom,message:'Transfer line scope could not be confirmed.'});
  ids.add(line.id);
 }
});
export type WarehousePurchaseOrder=z.infer<typeof WarehousePurchaseOrderSchema>;
export type WarehousePurchaseOrderLine=z.infer<typeof WarehousePurchaseOrderLineSchema>;
export type WarehouseTransfer=z.infer<typeof WarehouseTransferSchema>;
export type WarehouseTransferLine=z.infer<typeof WarehouseTransferLineSchema>;

const warehouseListQuery=z.object({
 store_id:id,page:z.coerce.number().int().min(1).max(1000000).default(1),
 limit:z.coerce.number().int().min(1).max(100).default(20),
 search:z.string().trim().max(80).optional(),sort:z.enum(['newest','oldest']).default('newest'),
});
export const WarehousePurchaseOrderListQuerySchema=warehouseListQuery.extend({status:WarehousePurchaseOrderSchema.shape.status.optional()}).strict();
export const WarehouseTransferListQuerySchema=warehouseListQuery.extend({status:WarehouseTransferSchema.shape.status.optional()}).strict();
export type WarehousePurchaseOrderListQuery=z.input<typeof WarehousePurchaseOrderListQuerySchema>;
export type WarehouseTransferListQuery=z.input<typeof WarehouseTransferListQuerySchema>;
export const WarehouseDocumentPageMetaSchema=z.object({
 store_id:id,page:z.number().int().positive(),per_page:z.number().int().min(1).max(100),
 total:z.number().int().nonnegative().safe(),total_is_exact:z.literal(true),has_next:z.boolean(),
}).passthrough();
/** One current page and its matching population. It is not a cross-page snapshot. */
export function warehouseDocumentPageSchema<T extends z.ZodTypeAny>(document:T) {
 return z.object({data:document.array(),meta:WarehouseDocumentPageMetaSchema}).passthrough().superRefine((value,ctx)=>{
  const {total,page,per_page:limit,has_next:more,store_id:site}=value.meta;
  const expected=Math.min(limit,Math.max(0,total-(page-1)*limit));
  const rows=value.data as Array<{id:string;site_id:string}>;
  if(rows.length!==expected||more!==(page*limit<total)||new Set(rows.map(row=>row.id)).size!==rows.length||rows.some(row=>row.site_id!==site))
   ctx.addIssue({code:z.ZodIssueCode.custom,message:'Warehouse page population could not be confirmed.'});
 });
}
export const WarehousePurchaseOrderPageSchema=warehouseDocumentPageSchema(WarehousePurchaseOrderSchema);
export const WarehouseTransferPageSchema=warehouseDocumentPageSchema(WarehouseTransferSchema);
