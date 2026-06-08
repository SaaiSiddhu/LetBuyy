export type SensitiveSecurityAction = 'refund.approve' | 'payout.release' | 'customer.dsr.export' | 'customer.dsr.erase';

export interface StepUpEvidenceInput {
    action: SensitiveSecurityAction;
    actorId?: string | null;
    siteId?: string | null;
    token?: string | null;
    verifiedAt?: string | null;
    nowMs?: number;
}

export interface StepUpEvidenceResult {
    ok: boolean;
    code?: 'STEP_UP_REQUIRED' | 'STEP_UP_EXPIRED' | 'STEP_UP_INVALID';
    metadata: Record<string, unknown>;
}

const STEP_UP_WINDOW_MS = 10 * 60 * 1000;

function plausibleToken(token: string | null | undefined): boolean {
    return typeof token === 'string'
        && token.trim().length >= 12
        && !token.startsWith('SKIP_NEEDS_HUMAN_')
        && !token.includes('replace-with');
}

export function verifySensitiveActionStepUp(input: StepUpEvidenceInput): StepUpEvidenceResult {
    const token = input.token?.trim() || null;
    const verifiedAt = input.verifiedAt?.trim() || null;
    const nowMs = input.nowMs ?? Date.now();

    if (!plausibleToken(token) || !verifiedAt) {
        return {
            ok: false,
            code: 'STEP_UP_REQUIRED',
            metadata: {
                step_up_required: true,
                action: input.action,
                site_id: input.siteId || null,
                actor_id: input.actorId || null,
            },
        };
    }

    const verifiedAtMs = Date.parse(verifiedAt);
    if (!Number.isFinite(verifiedAtMs)) {
        return {
            ok: false,
            code: 'STEP_UP_INVALID',
            metadata: {
                step_up_required: true,
                action: input.action,
                site_id: input.siteId || null,
                actor_id: input.actorId || null,
            },
        };
    }

    if (nowMs - verifiedAtMs > STEP_UP_WINDOW_MS || verifiedAtMs - nowMs > 60_000) {
        return {
            ok: false,
            code: 'STEP_UP_EXPIRED',
            metadata: {
                step_up_required: true,
                action: input.action,
                site_id: input.siteId || null,
                actor_id: input.actorId || null,
                verified_at: verifiedAt,
            },
        };
    }

    return {
        ok: true,
        metadata: {
            step_up_verified: true,
            action: input.action,
            site_id: input.siteId || null,
            actor_id: input.actorId || null,
            verified_at: verifiedAt,
        },
    };
}

export function stepUpErrorBody(result: StepUpEvidenceResult) {
    return {
        error: {
            code: result.code || 'STEP_UP_REQUIRED',
            message: 'Step-up verification is required for this sensitive action.',
        },
    };
}
