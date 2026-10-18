import { sha256Hex } from './crypto';
import { AppError } from './errors';
import { verifySensitiveActionStepUp, type StepUpEvidenceInput, type StepUpEvidenceResult } from './security-controls';
import type { getSupabaseAdmin } from './supabase';

// The pure MAC verifier remains useful as a cryptographic primitive. Merchant
// action routes also require this persisted, live authority check.
export async function verifyMerchantStepUp(db: ReturnType<typeof getSupabaseAdmin>, input: StepUpEvidenceInput): Promise<StepUpEvidenceResult> {
    const verified = await verifySensitiveActionStepUp(input);
    if (!verified.ok) return verified;
    const metadata = { ...verified.metadata, token_sha256: await sha256Hex(input.token!.trim()) };
    const { data, error } = await db.rpc('verify_merchant_step_up_v1', {
        p_site: input.siteId, p_actor: input.actorId, p_action: input.action, p_evidence: metadata,
    });
    if (error) throw new AppError('Approval verification is temporarily unavailable. Retry this action.', 503, 'STEP_UP_STATE_UNAVAILABLE');
    return data === true ? { ok: true, metadata } : { ok: false, code: 'STEP_UP_INVALID', metadata: { step_up_required: true } };
}
