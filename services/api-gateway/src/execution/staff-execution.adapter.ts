import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { applyStorePlanTierDefaults, type BillingPlanCatalogRecord } from '@letbuyy/billing-core';
import { AppError } from '../lib/errors';
import type { WorkerAuthUser } from '../lib/auth-user';

export async function readStaffSeatPolicy(db: SupabaseClient, actor: WorkerAuthUser, storeId: string) {
    const { data, error } = await db.rpc('merchant_staff_policy_snapshot_v1', {
        p_actor_id: actor.id, p_store_id: storeId, p_bound_site_id: actor.storeId || null,
    });
    if (error || !data || typeof data.source_hash !== 'string' || typeof data.slug !== 'string') {
        throw new AppError('Staff plan state is unavailable. Retry this request.', 503, 'STAFF_STATE_UNAVAILABLE');
    }
    const plan = applyStorePlanTierDefaults((data.plan || {
        slug: data.slug, site_type: data.site_type, name: data.slug,
    }) as BillingPlanCatalogRecord);
    if (plan.staff_limit !== null && typeof plan.staff_limit !== 'number') throw new AppError('Staff plan state is unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');
    const limit = typeof plan.staff_limit === 'number' ? plan.staff_limit : null;
    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 0)) {
        throw new AppError('Staff plan state is unavailable.', 503, 'STAFF_STATE_UNAVAILABLE');
    }
    return { limit, plan_slug: plan.slug || data.slug, plan_name: plan.name || data.slug, source_hash: data.source_hash };
}

const messages: Record<string, string> = {
    FORBIDDEN: 'Not authorized for this staff member or store.',
    VALIDATION: 'Invalid staff lifecycle request.',
    IDEMPOTENCY_CONFLICT: 'This retry key belongs to a different staff change.',
    EMPLOYEE_ALREADY_EXISTS: 'This email is already registered as staff.',
    STAFF_VERSION_REQUIRED: 'Reload this staff member before making a change.',
    STAFF_VERSION_CONFLICT: 'This staff member changed. Reload before making another change.',
    STAFF_POLICY_CHANGED: 'The store plan changed. Retry this request.',
    STAFF_LIMIT_REACHED: 'The store has reached its plan staff limit.',
    STAFF_ACCOUNT_VERIFICATION_REQUIRED: 'This account is not verified. Send a staff invitation instead.',
    STAFF_STATE_UNAVAILABLE: 'Staff state is unavailable. Retry this request.',
};

/** Bridges canonical auth/plan inputs to the single database effect/audit/receipt transaction. */
export async function executeStaffMutation(input: {
    db: SupabaseClient; actor: WorkerAuthUser; storeId: string; operation: 'create' | 'update' | 'remove';
    intent: Record<string, unknown>; key: string; employeeId?: string; expectedUpdatedAt?: string; requestId?: string;
}) {
    const policy = input.operation === 'create' ? await readStaffSeatPolicy(input.db, input.actor, input.storeId) : null;
    const { data, error } = await input.db.rpc('mutate_merchant_staff_v1', {
        p_actor_id: input.actor.id, p_store_id: input.storeId, p_operation: input.operation,
        p_intent: input.intent, p_key: input.key, p_employee_id: input.employeeId || null,
        p_expected_updated_at: input.expectedUpdatedAt || null, p_policy_hash: policy?.source_hash || null,
        p_seat_limit: policy?.limit ?? null, p_bound_site_id: input.actor.storeId || null,
        p_request_id: input.requestId || null,
    });
    if (error || !data || ![200,201,400,403,409,503].includes(data.status)) {
        throw new AppError('Staff state is unavailable. Retry with the same request key.', 503, 'STAFF_STATE_UNAVAILABLE');
    }
    if (data.error) {
        const code = typeof data.error === 'string' && data.error in messages ? data.error : 'STAFF_STATE_UNAVAILABLE';
        return { status: data.status as 400 | 403 | 409 | 503, body: { error: { code, message: messages[code],
            ...(code === 'STAFF_LIMIT_REACHED' ? { details: { staff_limit: data.staff_limit, staff_used: data.staff_used } } : {}),
        } }, replayed: false };
    }
    return { status: data.status as 200 | 201, body: { data: data.data }, replayed: data.replayed === true };
}
