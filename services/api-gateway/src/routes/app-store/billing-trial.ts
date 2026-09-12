// F-ROUTELEN-5 — lifted verbatim out of billing-oauth-routes.ts, which sat 22 lines under the
// 1,500-line route-file limit that scripts/validators/route-line-count-validator.mjs enforces.
//
// This is the one piece of non-routing logic that file held: it belongs with billing, not with route
// wiring, and it is the only reason the route file imported isAppBillingTrialExpired. The body below
// is a byte-level transplant — no behaviour was changed as part of the move, deliberately, so that
// the unchanged gate is a meaningful proof rather than a coincidence.

import type { getSupabaseAdmin } from '../../lib/supabase';
import {
    appStoreStringOrNull as stringOrNull,
    parseAppStoreJsonRecord as parseJsonRecord,
    type AppEngineJsonRecord,
} from '@letbuyy/shared-types';
import { isAppBillingTrialExpired } from '@letbuyy/billing-core';
import { insertAppChargeOutbox, type AppBillingChargeRecord } from './shared';

export async function activateExpiredTrialCharge(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        charge: AppEngineJsonRecord;
        actorId?: string | null;
        requestId: string;
    },
): Promise<{ charge: AppEngineJsonRecord; activated: boolean; error?: { code: string; message: string } }> {
    const trialEndsAt = stringOrNull(input.charge.trial_ends_at);
    if (!isAppBillingTrialExpired({ status: stringOrNull(input.charge.status), trialEndsAt })) {
        return { charge: input.charge, activated: false };
    }

    const chargeId = stringOrNull(input.charge.id);
    if (!chargeId) {
        return { charge: input.charge, activated: false, error: { code: 'VALIDATION', message: 'Trial charge id is missing' } };
    }

    const now = new Date().toISOString();
    const billingStartsAt = stringOrNull(input.charge.billing_starts_at) || trialEndsAt || now;
    const metadata = parseJsonRecord(input.charge.metadata);
    const trialMetadata = parseJsonRecord(metadata.trial);
    const { data: activatedCharge, error } = await db
        .from('app_billing_charges')
        .update({
            status: 'active',
            activated_at: stringOrNull(input.charge.activated_at) || now,
            billing_starts_at: billingStartsAt,
            updated_by: input.actorId || null,
            metadata: {
                ...metadata,
                trial: {
                    ...trialMetadata,
                    status: 'completed',
                    completed_at: now,
                    billing_starts_at: billingStartsAt,
                },
            },
        })
        .eq('id', chargeId)
        .eq('status', 'trialing')
        .select()
        .single();

    if (error) {
        return { charge: input.charge, activated: false, error: { code: 'DB_ERROR', message: error.message } };
    }

    await insertAppChargeOutbox(db, {
        charge: activatedCharge as AppBillingChargeRecord,
        eventType: 'app.charge.activated',
        actorId: input.actorId || '',
        requestId: input.requestId,
    });

    return { charge: activatedCharge as AppEngineJsonRecord, activated: true };
}
