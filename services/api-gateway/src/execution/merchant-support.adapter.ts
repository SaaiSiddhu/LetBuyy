import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS,
    SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS,
} from '@letbuyy/shared-types';
import {
    AppError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
} from '../lib/errors';
import { IdempotencyExecutionAdapter } from './idempotency-execution.adapter';
export async function executeMerchantSupport(
    db: SupabaseClient,
    input: {
        actorId: string;
        siteId: string;
        operation: 'create' | 'reply' | 'recover_create' | 'recover_reply';
        ticketId: string | null;
        key: string;
        payload: Record<string, unknown>;
    },
) {
    const key = IdempotencyExecutionAdapter.normalizeKey(input.key);
    const { data, error } = await db.rpc(
        'execute_merchant_support_mutation_v1',
        {
            p_actor_id: input.actorId,
            p_site_id: input.siteId,
            p_operation: input.operation,
            p_ticket_id: input.ticketId,
            p_key: key,
            p_payload: input.payload,
            p_first_response_hours: SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS,
            p_resolution_business_days:
                SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS,
        },
    );
    if (error) {
        if (error.code === '42501')
            throw new ForbiddenError('Support access to this store changed.');
        if (error.code === 'P0002')
            throw new NotFoundError('Support ticket not found.');
        if (error.code === 'PT409')
            throw new ConflictError(
                'This request conflicts with its saved outcome, or the ticket is resolved. Reload the ticket before continuing.',
            );
        if (['22023', '23514', '22P02'].includes(error.code || ''))
            throw new ValidationError('Invalid support request.');
        throw new AppError(
            'Support is unavailable. Check the original request before retrying.',
            503,
            'SUPPORT_UNAVAILABLE',
        );
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new AppError(
            'Support returned no durable result.',
            503,
            'SUPPORT_UNAVAILABLE',
        );
    return data as Record<string, unknown>;
}
