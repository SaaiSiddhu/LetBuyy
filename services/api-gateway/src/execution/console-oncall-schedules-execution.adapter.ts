import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../index';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';
import { credentialArguments, requireAcceptedConsoleResult, requireConsolePermission } from '../identity-foundation/console-approval-repository';

export const ConsoleOncallSchedulesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    active: z.enum(['true', 'false', 'all']).default('true'),
    team_name: z.string().trim().min(1).max(120).optional(),
}).strict();
export type ConsoleOncallSchedulesQuery = z.infer<typeof ConsoleOncallSchedulesQuerySchema>;
export const ConsoleOncallScheduleSchema = z.object({
    id: z.string().uuid(), team_name: z.string().min(2).max(120), rotation_name: z.string().min(2).max(160),
    primary_employee_id: z.string().uuid().nullable(), starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).nullable(), active: z.boolean(),
}).strict();
const ResultSchema = z.object({
    accepted: z.literal(true), items: ConsoleOncallScheduleSchema.array().max(100),
    total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    page: z.number().int().min(1).max(10000), limit: z.number().int().min(1).max(100),
}).strict();
export function parseConsoleOncallSchedules(value: unknown, query: ConsoleOncallSchedulesQuery) {
    requireAcceptedConsoleResult(value);
    const result = ResultSchema.safeParse(value);
    const unavailable = () => new AppError('The on-call schedules response is unavailable.', 503, 'CONSOLE_ONCALL_SCHEDULES_RESPONSE_UNAVAILABLE');
    if (!result.success) throw unavailable();
    const { items, total, page, limit } = result.data;
    if (page !== query.page || limit !== query.limit || items.length !== Math.min(limit, Math.max(total - (page - 1) * limit, 0))
        || new Set(items.map(item => item.id)).size !== items.length
        || items.some(item => (query.active !== 'all' && item.active !== (query.active === 'true')) || (query.team_name !== undefined && item.team_name !== query.team_name))) throw unavailable();
    return { items, total, page, limit, has_next: page * limit < total };
}
export async function readConsoleOncallSchedules(c: Context<{ Bindings: Env }>, query: ConsoleOncallSchedulesQuery) {
    const { credential, witness, state } = await requireConsolePermission(c, 'incident:view', false);
    if (!state.is_super_admin) throw new AppError('An active platform super admin is required.', 403, 'INDEPENDENT_SUPER_ADMIN_REQUIRED');
    const { data, error } = await getSupabaseAdmin(c).rpc('read_console_oncall_schedules_v1', {
        ...credentialArguments(credential), p_permission_hash: witness,
        p_page: query.page, p_limit: query.limit, p_active: query.active, p_team_name: query.team_name ?? null,
    });
    if (error) throw new AppError('On-call schedules are temporarily unavailable. Reload to try again.', 503, 'CONSOLE_ONCALL_SCHEDULES_UNAVAILABLE');
    return parseConsoleOncallSchedules(data, query);
}
