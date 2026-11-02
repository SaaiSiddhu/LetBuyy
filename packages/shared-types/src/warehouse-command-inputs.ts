import {z} from 'zod';
import {WarehouseLocationInputSchema} from './warehouse-options';
import {StopWarehouseCommandInputSchema,type WarehouseCommandOperation,type WarehouseCommandIntent} from './warehouse-command';
// Pure wire validation/normalization. Execution authority remains the monolith and SQL owner.
const UuidSchema=z.string().uuid(),EmailSchema=z.string().email().max(320).toLowerCase();

export const CreateLocationSchema=WarehouseLocationInputSchema.extend({idempotency_key:z.string().min(8).max(200)});

export const CreateSupplierSchema = z.object({
  store_id: UuidSchema,
  idempotency_key:z.string().min(8).max(200),
  name: z.string().trim().min(1).max(200),
  contact_name: z.string().max(200).nullish(),
  email: EmailSchema.max(254).nullish(),
  phone: z.string().max(30).nullish(),
  address: z.record(z.string(), z.unknown()).optional(),
});

export const PurchaseOrderLineSchema = z.object({
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999999),
  unit_cost: z.number().min(0).max(999999)
    .refine(value=>Math.round(value*100)/100===value,'Unit cost must use whole paise.').default(0),
});

export const CreatePurchaseOrderSchema = z.object({
  store_id: UuidSchema,
  supplier_id: UuidSchema.optional().nullable(),
  location_id: UuidSchema,
  expected_at: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(PurchaseOrderLineSchema).min(1).max(200),
  idempotency_key: z.string().min(8).max(200),
});

export const ReceivePurchaseOrderLineSchema = z.object({
  purchase_order_line_id: UuidSchema,
  quantity: z.number().int().min(1).max(999999),
});

export const ReceivePurchaseOrderSchema = z.object({
  lines: z.array(ReceivePurchaseOrderLineSchema).min(1).max(200).optional(),
  idempotency_key: z.string().min(8).max(200),
});

export const TransferLineSchema = z.object({
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999999),
});

export const CreateTransferSchema = z.object({
  store_id: UuidSchema,
  source_location_id: UuidSchema,
  destination_location_id: UuidSchema,
  notes: z.string().max(1000).optional(),
  lines: z.array(TransferLineSchema).min(1).max(200),
  idempotency_key: z.string().min(8).max(200),
});

export const ReceiveTransferLineSchema = z.object({
  transfer_line_id: UuidSchema,
  quantity: z.number().int().min(1).max(999999),
});

export const ReceiveTransferSchema = z.object({
  lines: z.array(ReceiveTransferLineSchema).min(1).max(200).optional(),
  idempotency_key: z.string().min(8).max(200),
});

export const ShipTransferSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
});

// The original normalized intent is also the authority for stopping an uncertain command.
const NormalizedWarehouseCommands = {
  'location.create':CreateLocationSchema.omit({store_id:true,idempotency_key:true}).extend({address:z.string().max(500),city:z.string().max(100),state:z.string().max(100)}).strict(),
  'supplier.create':CreateSupplierSchema.omit({store_id:true,idempotency_key:true}).extend({contact_name:z.string().max(200).nullable(),email:EmailSchema.max(254).nullable(),phone:z.string().max(30).nullable(),address:z.record(z.string(),z.unknown())}).strict(),
  'purchase_order.create': CreatePurchaseOrderSchema.omit({store_id:true,idempotency_key:true}).extend({
    supplier_id:UuidSchema.nullable(), expected_at:z.string().datetime({offset:true}).nullable(),
    notes:CreatePurchaseOrderSchema.shape.notes.unwrap().nullable(),
    lines:z.array(PurchaseOrderLineSchema.extend({variant_id:UuidSchema.nullable()}).strict()).min(1).max(200),
  }).strict(),
  'transfer.create': CreateTransferSchema.omit({store_id:true,idempotency_key:true}).extend({
    notes:CreateTransferSchema.shape.notes.unwrap().nullable(),
    lines:z.array(TransferLineSchema.extend({variant_id:UuidSchema.nullable()}).strict()).min(1).max(200),
  }).strict(),
  'purchase_order.receive':z.object({lines:z.array(ReceivePurchaseOrderLineSchema.strict()).min(1).max(200).nullable()}).strict(),
  'transfer.receive':z.object({lines:z.array(ReceiveTransferLineSchema.strict()).min(1).max(200).nullable()}).strict(),
  'transfer.ship':z.object({}).strict(),
};
export const StopWarehouseCommandSchema=StopWarehouseCommandInputSchema.superRefine((value,ctx)=>{
  const create=value.operation.endsWith('.create');
  const parsed=NormalizedWarehouseCommands[value.operation].safeParse(value.command);
  const missingCost=value.operation==='purchase_order.create'&&Array.isArray(value.command.lines)&&
    value.command.lines.some(line=>!line||typeof line!=='object'||!Object.prototype.hasOwnProperty.call(line,'unit_cost'));
  if(create!==(value.target_id===null)||!parsed.success||missingCost)ctx.addIssue({
    code:z.ZodIssueCode.custom,path:['command'],message:'Supply the complete original normalized warehouse request.',
  });
});


/** One normalization owner for Gateway execution and durable client recovery. */
export function prepareWarehouseCommand(operation:WarehouseCommandOperation,
 targetId:string|null,input:unknown):WarehouseCommandIntent {
 let command:Record<string,unknown>;
 switch(operation) {
  case 'location.create': {const body=CreateLocationSchema.parse(input);command={name:body.name,address:body.address?.trim()??'',city:body.city?.trim()??'',state:body.state?.trim()??'',country:body.country,pincode:body.pincode,is_default:body.is_default};break;}
  case 'supplier.create': {const body=CreateSupplierSchema.parse(input);command={name:body.name,contact_name:body.contact_name?.trim()||null,email:body.email?.trim().toLowerCase()||null,phone:body.phone?.trim()||null,address:body.address??{}};break;}
  case 'purchase_order.create': {
   const body=CreatePurchaseOrderSchema.parse(input);
   command={supplier_id:body.supplier_id??null,location_id:body.location_id,
    expected_at:body.expected_at?.toISOString()??null,notes:body.notes??null,
    lines:body.lines.map(line=>({...line,variant_id:line.variant_id??null}))};break;
  }
  case 'transfer.create': {
   const body=CreateTransferSchema.parse(input);
   command={source_location_id:body.source_location_id,destination_location_id:body.destination_location_id,
    notes:body.notes??null,lines:body.lines.map(line=>({...line,variant_id:line.variant_id??null}))};break;
  }
  case 'purchase_order.receive': command={lines:ReceivePurchaseOrderSchema.parse(input).lines??null};break;
  case 'transfer.receive': command={lines:ReceiveTransferSchema.parse(input).lines??null};break;
  case 'transfer.ship': ShipTransferSchema.parse(input);command={};break;
  default:throw new Error('The warehouse operation could not be confirmed.');
 }
 const create=operation.endsWith('.create');
 if(create!==(targetId===null)||(!create&&!UuidSchema.safeParse(targetId).success))throw new Error('The warehouse target could not be confirmed.');
 return {operation,target_id:targetId,command};
}
