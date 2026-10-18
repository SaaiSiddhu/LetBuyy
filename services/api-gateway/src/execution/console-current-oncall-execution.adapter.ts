import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../index';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';
import { credentialArguments, requireAcceptedConsoleResult, requireConsolePermission } from '../identity-foundation/console-approval-repository';

// A current rotation is a bounded display projection, not a complete schedule.
export const ConsoleCurrentOncallSchema = z.object({
    id: z.string().uuid(), team_name: z.string().min(2).max(120), rotation_name: z.string().min(2).max(160),
    primary_employee_id: z.string().uuid().nullable(), paging_adapter: z.enum(['dry_run', 'pagerduty', 'opsgenie']),
}).strict();
const ResultSchema = z.object({ accepted: z.literal(true), schedule: ConsoleCurrentOncallSchema.nullable() }).strict();
export function parseConsoleCurrentOncall(value: unknown) {
    requireAcceptedConsoleResult(value);
    const parsed = ResultSchema.safeParse(value);
    if (!parsed.success) throw new AppError('The current rotation response is unavailable.', 503, 'CONSOLE_CURRENT_ONCALL_RESPONSE_UNAVAILABLE');
    return parsed.data.schedule;
}
export async function readConsoleCurrentOncall(c: Context<{ Bindings: Env }>) {
    const { credential, witness, state } = await requireConsolePermission(c, 'incident:view', false);
    if (!state.is_super_admin) throw new AppError('An active platform super admin is required.', 403, 'INDEPENDENT_SUPER_ADMIN_REQUIRED');
    const { data, error } = await getSupabaseAdmin(c).rpc('read_console_current_oncall_v1', {
        ...credentialArguments(credential), p_permission_hash: witness,
    });
    if (error) throw new AppError('The current rotation is temporarily unavailable. Reload to try again.', 503, 'CONSOLE_CURRENT_ONCALL_UNAVAILABLE');
    return parseConsoleCurrentOncall(data);
}
