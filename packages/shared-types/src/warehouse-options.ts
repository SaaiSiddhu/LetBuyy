import {z} from 'zod';
import {warehouseDocumentPageSchema} from './warehouse-documents';

const id=z.string().uuid(),date=z.string().datetime({offset:true}),name=z.string().trim().min(1).max(200);
const status=z.enum(['active','inactive']);
export const WarehouseOptionListQuerySchema=z.object({
 store_id:id,page:z.coerce.number().int().min(1).max(1000000).default(1),limit:z.coerce.number().int().min(1).max(100).default(20),
 search:z.string().trim().max(80).optional(),status:z.enum(['all','active','inactive']).default('all'),sort:z.enum(['name_asc','name_desc']).default('name_asc'),
}).strict();
export type WarehouseOptionListQuery=z.input<typeof WarehouseOptionListQuerySchema>;
export const WarehouseLocationInputSchema=z.object({
 store_id:id,name,address:z.string().max(500).optional(),city:z.string().max(100).optional(),state:z.string().max(100).optional(),
 country:z.string().length(2).toUpperCase().default('IN'),is_default:z.boolean().default(false),
});
export type WarehouseLocationInput=z.input<typeof WarehouseLocationInputSchema>;
export const WarehouseLocationSchema=z.object({
 id,store_id:id,site_id:id.optional(),name,status,is_default:z.boolean(),created_at:date,
 address:z.record(z.string(),z.unknown()).nullable(),
 deleted_at:z.null().optional(),
}).passthrough().refine(row=>row.site_id===undefined||row.site_id===row.store_id,'Warehouse location scope could not be confirmed.');
export const WarehouseSupplierSchema=z.object({
 id,site_id:id,store_id:id.optional(),name,status,created_at:date,contact_name:z.string().nullable(),email:z.string().nullable(),phone:z.string().nullable(),
 address:z.record(z.string(),z.unknown()),
 deleted_at:z.null().optional(),
}).passthrough().refine(row=>row.store_id===undefined||row.store_id===row.site_id,'Warehouse supplier scope could not be confirmed.');
export const WarehouseLocationPageSchema=warehouseDocumentPageSchema(WarehouseLocationSchema,'store_id');
export const WarehouseSupplierPageSchema=warehouseDocumentPageSchema(WarehouseSupplierSchema);
export type WarehouseLocation=z.infer<typeof WarehouseLocationSchema>;
export type WarehouseSupplier=z.infer<typeof WarehouseSupplierSchema>;
