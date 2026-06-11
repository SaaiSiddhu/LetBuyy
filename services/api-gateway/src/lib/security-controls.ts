export type SensitiveSecurityAction = 'refund.approve' | 'payout.release' | 'customer.dsr.export' | 'customer.dsr.erase';

export interface StepUpEvidenceInput {
    action: SensitiveSecurityAction;
    actorId?: string | null;
    siteId?: string | null;
    token?: string | null;
    verifiedAt?: string | null;
    signingSecret?: string | null;
    nowMs?: number;
}

export interface SignStepUpEvidenceInput {
    action: SensitiveSecurityAction;
    actorId: string;
    siteId: string;
    challengeId: string;
    signingSecret?: string | null;
    verifiedAt?: string;
    nowMs?: number;
}

export interface StepUpEvidenceResult {
    ok: boolean;
    code?: 'STEP_UP_REQUIRED' | 'STEP_UP_EXPIRED' | 'STEP_UP_INVALID';
    metadata: Record<string, unknown>;
}

const STEP_UP_WINDOW_MS = 10 * 60 * 1000;
const STEP_UP_TOKEN_PREFIX = 'lb-stepup-v1';
const STEP_UP_TOKEN_TYPE = 'letbuyy.step_up';
const encoder = new TextEncoder();

interface StepUpTokenPayload {
    v: 1;
    typ: typeof STEP_UP_TOKEN_TYPE;
    action: SensitiveSecurityAction;
    actor_id: string;
    site_id: string;
    challenge_id: string;
    jti: string;
    verified_at: string;
    exp: number;
}

function configuredSecret(secret: string | null | undefined): secret is string {
    return typeof secret === 'string'
        && secret.trim().length >= 32
        && !secret.startsWith('SKIP_NEEDS_HUMAN_')
        && !secret.includes('replace-with');
}

function base64UrlEncode(value: string | Uint8Array): string {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array | null {
    try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    } catch {
        return null;
    }
}

function decodeText(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

async function hmacSha256(secret: string, value: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
    return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let index = 0; index < a.length; index += 1) {
        diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return diff === 0;
}

function parsePayload(encoded: string): StepUpTokenPayload | null {
    const bytes = base64UrlDecode(encoded);
    if (!bytes) return null;
    try {
        const parsed = JSON.parse(decodeText(bytes)) as Partial<StepUpTokenPayload>;
        if (
            parsed.v !== 1
            || parsed.typ !== STEP_UP_TOKEN_TYPE
            || typeof parsed.action !== 'string'
            || typeof parsed.actor_id !== 'string'
            || typeof parsed.site_id !== 'string'
            || typeof parsed.challenge_id !== 'string'
            || typeof parsed.jti !== 'string'
            || typeof parsed.verified_at !== 'string'
            || typeof parsed.exp !== 'number'
        ) {
            return null;
        }
        return parsed as StepUpTokenPayload;
    } catch {
        return null;
    }
}

export async function signSensitiveActionStepUp(input: SignStepUpEvidenceInput): Promise<{
    token: string;
    verifiedAt: string;
    expiresAt: string;
    jti: string;
}> {
    if (!configuredSecret(input.signingSecret)) {
        throw new Error('STEP_UP_SIGNING_SECRET_REQUIRED');
    }
    const nowMs = input.nowMs ?? Date.now();
    const verifiedAt = input.verifiedAt || new Date(nowMs).toISOString();
    const exp = nowMs + STEP_UP_WINDOW_MS;
    const payload: StepUpTokenPayload = {
        v: 1,
        typ: STEP_UP_TOKEN_TYPE,
        action: input.action,
        actor_id: input.actorId,
        site_id: input.siteId,
        challenge_id: input.challengeId,
        jti: crypto.randomUUID(),
        verified_at: verifiedAt,
        exp,
    };
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signedValue = `${STEP_UP_TOKEN_PREFIX}.${encodedPayload}`;
    const signature = await hmacSha256(input.signingSecret, signedValue);
    return {
        token: `${signedValue}.${signature}`,
        verifiedAt,
        expiresAt: new Date(exp).toISOString(),
        jti: payload.jti,
    };
}

export async function verifySensitiveActionStepUp(input: StepUpEvidenceInput): Promise<StepUpEvidenceResult> {
    const token = input.token?.trim() || null;
    const verifiedAt = input.verifiedAt?.trim() || null;
    const nowMs = input.nowMs ?? Date.now();

    if (!configuredSecret(input.signingSecret) || !token || !verifiedAt) {
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

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== STEP_UP_TOKEN_PREFIX) {
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

    const payload = parsePayload(parts[1]);
    const expectedSignature = await hmacSha256(input.signingSecret, `${parts[0]}.${parts[1]}`);
    if (
        !payload
        || !constantTimeEqual(expectedSignature, parts[2])
        || payload.action !== input.action
        || payload.actor_id !== input.actorId
        || payload.site_id !== input.siteId
        || payload.verified_at !== verifiedAt
    ) {
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

    const verifiedAtMs = Date.parse(payload.verified_at);
    if (!Number.isFinite(verifiedAtMs) || nowMs - verifiedAtMs > STEP_UP_WINDOW_MS || verifiedAtMs - nowMs > 60_000 || nowMs > payload.exp) {
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
            step_up_crypto: 'hmac-sha256',
            action: input.action,
            site_id: input.siteId || null,
            actor_id: input.actorId || null,
            verified_at: verifiedAt,
            expires_at: new Date(payload.exp).toISOString(),
            challenge_id: payload.challenge_id,
            jti: payload.jti,
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
