import { InternalConsoleSummarySchema, InternalConsoleAnalyticsSchema } from '@letbuyy/shared-types';
import type { Context } from 'hono';
import type { Env } from '../index';
import { requireConsolePermission, credentialArguments, requireAcceptedConsoleResult } from '../identity-foundation/console-approval-repository';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';

export async function readConsoleOverview(c: Context<{ Bindings: Env }>, kind: 'summary' | 'analytics') {
    const { credential, witness } = await requireConsolePermission(c, 'exec:view', false);
    const { data, error } = await getSupabaseAdmin(c).rpc('read_console_overview_v1', {
        ...credentialArguments(credential), p_permission_hash: witness, p_kind: kind,
    });
    if (error) throw new AppError('The platform overview is temporarily unavailable. Try again shortly.', 503, 'CONSOLE_OVERVIEW_UNAVAILABLE');
    requireAcceptedConsoleResult(data);
    const parsed = (kind === 'summary' ? InternalConsoleSummarySchema : InternalConsoleAnalyticsSchema).safeParse(data.overview);
    if (!parsed.success) throw new AppError('The platform overview response is unavailable.', 503, 'CONSOLE_OVERVIEW_RESPONSE_UNAVAILABLE');
    return parsed.data;
}
