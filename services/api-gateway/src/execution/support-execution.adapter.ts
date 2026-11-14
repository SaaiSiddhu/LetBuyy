import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS, SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS, SUPPORT_ESCALATION_KEYWORDS } from '@letbuyy/shared-types';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../lib/errors';
import { IdempotencyExecutionAdapter } from './idempotency-execution.adapter';

export type SupportMutation = 'create' | 'reply' | 'assign' | 'escalate' | 'resolve' | 'csat' | 'macro';

/** Service-local contract: DB action and response receipt must commit together. No dev fallback. */
export class SupportExecutionAdapter {
    constructor(private readonly db: SupabaseClient) {}

    async execute(input: {
        actorId: string; actorEmail: string | null; operation: SupportMutation;
        targetId: string | null; key: string | null; alternateKey?: string | null; payload: Record<string, unknown>;
    }): Promise<Record<string, unknown>> {
        if (input.key && input.alternateKey && input.key.trim() !== input.alternateKey.trim()) {
            throw new ValidationError('Idempotency headers must agree');
        }
        const key = IdempotencyExecutionAdapter.normalizeKey(input.key || input.alternateKey);
        const { data, error } = await this.db.rpc('execute_operator_support_mutation', {
            p_actor_id: input.actorId, p_actor_email: input.actorEmail,
            p_operation: input.operation, p_target_id: input.targetId, p_idempotency_key: key,
            p_payload: input.payload, p_escalation_keywords: [...SUPPORT_ESCALATION_KEYWORDS],
            p_first_response_hours: SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS,
            p_resolution_business_days: SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS,
        });
        if (error) {
            if (error.code === 'PT412') throw new ConflictError('This ticket changed or is closed. Reload it before changing ownership or priority.');
            if (error.code === 'PT409') throw new ConflictError('Idempotency key was already used with a different request body');
            if (error.code === '23505' && /support_ticket_privacy_request_conflict|support_tickets_privacy_open_request_uidx/.test(error.message)) {
                throw new ConflictError('The ticket cannot move to that status: its requester already has an unresolved privacy request of the same type.');
            }
            if (error.code === 'P0002') throw new NotFoundError(input.operation === 'csat' ? 'CSAT survey or support ticket not found' : 'Support ticket not found');
            if (error.code === '23503') throw new ValidationError('The request refers to a record that does not exist');
            if (error.code === '22023' || error.code === '23514') throw new ValidationError('Invalid support mutation');
            // Never reflect PostgREST, constraints, payloads or internal fault details to the caller.
            throw new AppError('Support action failed', 500, 'DB_ERROR');
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Support action failed', 500, 'DB_ERROR');
        return data as Record<string, unknown>;
    }
}
