import { z } from 'zod';

export const WAREHOUSE_COMMAND_PROTOCOL_HEADER='X-LetBuyy-Warehouse-Protocol';
export const WAREHOUSE_COMMAND_PROTOCOL_VERSION='1';
export const WarehouseCommandCapabilitiesQuerySchema=z.object({store_id:z.string().uuid()}).strict();
export type WarehouseCommandCapabilitiesQuery=z.infer<typeof WarehouseCommandCapabilitiesQuerySchema>;
/** Describes the guarded code path, not migration readiness or a permission lease. */
export const WarehouseCommandCapabilitiesSchema=z.object({
 store_id:z.string().uuid(),actor_id:z.string().uuid(),protocol_version:z.literal(WAREHOUSE_COMMAND_PROTOCOL_VERSION),
 effect_policy:z.literal('atomic_receipt_or_unavailable'),stop_supported:z.literal(true),
}).strict();
export type WarehouseCommandCapabilities=z.infer<typeof WarehouseCommandCapabilitiesSchema>;
export function isWarehouseCommandPath(path:string):boolean {
 const value=path.startsWith('/v1/')?path.slice(3):path;
 return value==='/inventory/commands/stop'||/^\/inventory\/(?:purchase-orders|transfers)$/.test(value)||
  /^\/inventory\/purchase-orders\/[^/]+\/receive$/.test(value)||/^\/inventory\/transfers\/[^/]+\/(?:ship|receive)$/.test(value);
}

export const WarehouseCommandOperationSchema = z.enum([
  'purchase_order.create', 'purchase_order.receive', 'transfer.create', 'transfer.ship', 'transfer.receive',
]);
export type WarehouseCommandOperation = z.infer<typeof WarehouseCommandOperationSchema>;
export const WarehouseCommandReceiptSchema = z.object({
  id: z.string().uuid(), key: z.string().min(8).max(200),
  site_id: z.string().uuid(), actor_id: z.string().uuid(),
  operation: WarehouseCommandOperationSchema, target_id: z.string().uuid().nullable(),
  outcome: z.enum(['applied','cancelled']),
  command: z.record(z.string(), z.unknown()),
  effective_lines: z.array(z.record(z.string(), z.unknown())).max(200).nullable(),
}).strict();
export type WarehouseCommandReceipt = z.infer<typeof WarehouseCommandReceiptSchema>;
export type WarehouseCommandIntent = Pick<WarehouseCommandReceipt,'operation'|'target_id'|'command'>;

/** Acknowledgement snapshots, not a replacement purchase-order or transfer model. */
export const WarehouseCommandResultSchema = z.object({
  command_receipt: WarehouseCommandReceiptSchema,
  purchase_order: z.record(z.string(), z.unknown()).optional(),
  transfer: z.record(z.string(), z.unknown()).optional(),
  lines: z.array(z.record(z.string(), z.unknown())).max(200),
}).strict().superRefine((value, ctx) => {
  const receipt=value.command_receipt, po=receipt.operation.startsWith('purchase_order.');
  const header=po?value.purchase_order:value.transfer;
  const opposite=po?value.transfer:value.purchase_order;
  const integer=(n:unknown,min:number,max:number)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
  const invalid=()=>ctx.addIssue({code:z.ZodIssueCode.custom,message:'The warehouse acknowledgement scope or quantities are invalid.'});
  if(receipt.outcome==='cancelled') {
    const create=receipt.operation==='purchase_order.create'||receipt.operation==='transfer.create';
    if(value.purchase_order||value.transfer||value.lines.length||receipt.effective_lines!==null||create!==(receipt.target_id===null)) invalid();
    return;
  }
  const states=po?['draft','ordered','partially_received','received','cancelled','closed']:['reserved','shipped','partially_received','received','cancelled'];
  if(!receipt.target_id||!value.lines.length||!header||opposite||header.id!==receipt.target_id||header.site_id!==receipt.site_id||!states.includes(String(header.status))) invalid();
  const ids=new Set<string>();
  for(const line of value.lines) {
    const ordered=po?line.quantity_ordered:line.quantity_requested;
    if(!z.string().uuid().safeParse(line.id).success||ids.has(String(line.id))||
      !z.string().uuid().safeParse(line.product_id).success||
      (line.variant_id!==null&&line.variant_id!==undefined&&!z.string().uuid().safeParse(line.variant_id).success)||
      line.site_id!==receipt.site_id||line[po?'purchase_order_id':'transfer_id']!==receipt.target_id||
      !integer(ordered,1,999999)||!integer(line.quantity_received,0,Number(ordered))||
      (!po&&(!integer(line.quantity_shipped,0,Number(ordered))||Number(line.quantity_received)>Number(line.quantity_shipped)))) invalid();
    ids.add(String(line.id));
  }
  if(receipt.operation.endsWith('.receive')) {
    const seen=new Set<string>(),idKey=po?'purchase_order_line_id':'transfer_line_id';
    if(!receipt.effective_lines?.length) invalid();
    for(const effective of receipt.effective_lines??[]) {
      const id=effective[idKey],line=value.lines.find(row=>row.id===id);
      if(Object.keys(effective).length!==2||!Object.prototype.hasOwnProperty.call(effective,idKey)||
        !Object.prototype.hasOwnProperty.call(effective,'quantity')||typeof id!=='string'||seen.has(id)||
        !line||!integer(effective.quantity,1,Number(line.quantity_received))) invalid();
      if(typeof id==='string')seen.add(id);
    }
  } else if(receipt.effective_lines!==null) invalid();
});
export type WarehouseCommandResult = z.infer<typeof WarehouseCommandResultSchema>;

/** The domain package additionally validates the normalized command by operation. */
export const StopWarehouseCommandInputSchema=z.object({
  store_id:z.string().uuid(),idempotency_key:z.string().min(8).max(200),
  operation:WarehouseCommandOperationSchema,target_id:z.string().uuid().nullable(),
  command:z.record(z.string(),z.unknown()),
}).strict();
export type StopWarehouseCommandInput=z.infer<typeof StopWarehouseCommandInputSchema>;

