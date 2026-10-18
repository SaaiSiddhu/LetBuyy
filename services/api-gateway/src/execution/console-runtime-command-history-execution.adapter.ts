import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../index';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';
import { credentialArguments, requireAcceptedConsoleResult, requireConsolePermission } from '../identity-foundation/console-approval-repository';
export const ConsoleRuntimeCommandHistoryQuerySchema=z.object({
 page:z.coerce.number().int().min(1).max(10000).default(1),
 limit:z.coerce.number().int().min(1).max(200).default(50),
}).strict();
export type ConsoleRuntimeCommandHistoryQuery=z.infer<typeof ConsoleRuntimeCommandHistoryQuerySchema>;
// These are stored historical labels, never authority or operational-effect proof.
// Preserve DB-valid legacy text; do not apply the disabled intake's producer enum.
export const ConsoleRuntimeCommandRecordSchema=z.object({
 command_id:z.string(),operation:z.string(),target_type:z.string(),target_id:z.string(),
 status:z.enum(['accepted','running','completed','failed','cancelled']),
}).strict();
const Result=z.object({accepted:z.literal(true),items:ConsoleRuntimeCommandRecordSchema.array().max(200),
 total:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),page:z.number().int().min(1).max(10000),limit:z.number().int().min(1).max(200)}).strict();
export function parseConsoleRuntimeCommandHistory(value:unknown,query:ConsoleRuntimeCommandHistoryQuery){
 requireAcceptedConsoleResult(value);const result=Result.safeParse(value);
 const unavailable=()=>new AppError('The runtime command history response is unavailable.',503,'CONSOLE_RUNTIME_COMMAND_HISTORY_RESPONSE_UNAVAILABLE');
 if(!result.success)throw unavailable();const{items,total,page,limit}=result.data;
 if(page!==query.page||limit!==query.limit||items.length!==Math.min(limit,Math.max(total-(page-1)*limit,0))
  ||new Set(items.map(item=>item.command_id)).size!==items.length)throw unavailable();
 return{items,total,page,limit,has_next:page*limit<total};
}
export async function readConsoleRuntimeCommandHistory(c:Context<{Bindings:Env}>,query:ConsoleRuntimeCommandHistoryQuery){
 const{credential,witness,state}=await requireConsolePermission(c,'incident:view',false);
 if(!state.is_super_admin)throw new AppError('An active platform super admin is required.',403,'INDEPENDENT_SUPER_ADMIN_REQUIRED');
 const{data,error}=await getSupabaseAdmin(c).rpc('read_console_runtime_command_history_v1',{
  ...credentialArguments(credential),p_permission_hash:witness,p_page:query.page,p_limit:query.limit,
 });
 if(error)throw new AppError('Runtime command history is temporarily unavailable. Reload to try again.',503,'CONSOLE_RUNTIME_COMMAND_HISTORY_UNAVAILABLE');
 return parseConsoleRuntimeCommandHistory(data,query);
}
