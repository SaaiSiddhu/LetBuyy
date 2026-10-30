import {WarehouseCommandResultSchema,type WarehouseCommandOperation,type WarehouseCommandResult} from '@letbuyy/shared-types';
import {canonicalizeExecutionPayload} from '@letbuyy/event-core';
import type {Env} from '../index';
import {AppError,ForbiddenError,NotFoundError,ValidationError} from '../lib/errors';
import {withTenantTx,TenantTransactionUnavailableError} from '../lib/tenant-transaction';
import {IdempotencyExecutionAdapter} from './idempotency-execution.adapter';

export const APPLY_WAREHOUSE_COMMAND_SQL='SELECT public.apply_warehouse_command_v1($1::uuid,$2::uuid,$3::text,$4::text,$5::uuid,$6::text::jsonb,$7::text) AS result';

/** One database transaction owns existing stock effects and their mandatory receipt. */
export async function executeWarehouseCommand(env:Env,siteId:string,actorId:string,key:string,
 operation:WarehouseCommandOperation,targetId:string|null,command:Record<string,unknown>,requestId:string|null):Promise<WarehouseCommandResult> {
 const normalizedKey=IdempotencyExecutionAdapter.normalizeKey(key), traceId=requestId||crypto.randomUUID();
 try {
  return await withTenantTx(env,{siteId,requestId:traceId},async sql=>{
   await sql.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)',
    ['app.actor_id',actorId,'request.jwt.claim.sub',actorId]);
   const rows=await sql.unsafe(APPLY_WAREHOUSE_COMMAND_SQL,[siteId,actorId,normalizedKey,operation,targetId,JSON.stringify(command),traceId]);
   const parsed=WarehouseCommandResultSchema.safeParse(rows[0]?.result);
   if(!parsed.success||parsed.data.command_receipt.key!==normalizedKey||
    parsed.data.command_receipt.site_id!==siteId||parsed.data.command_receipt.actor_id!==actorId||
    parsed.data.command_receipt.operation!==operation||
    (targetId!==null&&parsed.data.command_receipt.target_id!==targetId)||
    canonicalizeExecutionPayload(parsed.data.command_receipt.command)!==canonicalizeExecutionPayload(command)) {
    throw new AppError('The warehouse acknowledgement could not be confirmed. Retry the original request.',503,'WAREHOUSE_ACK_UNVERIFIED');
   }
   return parsed.data;
  });
 } catch(error) {
  const code=(error as {code?:string})?.code,message=error instanceof Error?error.message:'';
  if(error instanceof TenantTransactionUnavailableError||code==='42883'||code==='42703') throw new AppError('Warehouse saving is unavailable. Keep the original request and retry.',503,'WAREHOUSE_UNAVAILABLE');
  if(code==='42501'||/WAREHOUSE_FORBIDDEN|PRODUCT_EDIT_FORBIDDEN/.test(message)) throw new ForbiddenError('Your access to this store changed.');
  if(message.includes('WAREHOUSE_NOT_FOUND')) throw new NotFoundError('The warehouse record is no longer available.');
  if(message.includes('WAREHOUSE_KEY_CONFLICT')) throw new AppError('This key belongs to a different warehouse request. Recover the original request.',409,'WAREHOUSE_KEY_CONFLICT');
  if(message.includes('WAREHOUSE_LEGACY_KEY')) throw new AppError('This earlier warehouse request needs review. Its outcome cannot be safely reapplied.',409,'WAREHOUSE_LEGACY_KEY');
  if(message.includes('WAREHOUSE_STATE_CONFLICT')||code==='40P01'||code==='40001'||code==='23505'||
   /cannot be.*status|receive quantity|quantity.*exceed|insufficient|not enough/i.test(message)) throw new AppError('Warehouse stock or status changed. Retry the same request or reload the current record.',409,'WAREHOUSE_CONFLICT');
  if(message.includes('WAREHOUSE_INVALID')||code==='23503'||code==='23514'||code?.startsWith('22')) throw new ValidationError('The warehouse request details are invalid.');
  throw error;
 }
}

