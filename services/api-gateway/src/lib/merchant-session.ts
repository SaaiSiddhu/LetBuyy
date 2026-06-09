type MerchantSessionDb = {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<{
        data: unknown;
        error: { message?: string } | null;
    }>;
};

type MerchantSessionStatus =
    | 'accepted'
    | 'malformed'
    | 'missing'
    | 'expired'
    | 'idle_timeout'
    | 'revoked'
    | 'reuse_detected'
    | 'error';

export interface MerchantSessionValidationResult {
    accepted: boolean;
    status: MerchantSessionStatus;
    sessionId: string | null;
    userId: string | null;
    token: string | null;
    rotated: boolean;
    expiresAt: string | null;
}

interface MerchantSessionRpcRow {
    accepted?: boolean;
    status?: string;
    session_id?: string | null;
    user_id?: string | null;
    token?: string | null;
    rotated?: boolean;
    expires_at?: string | null;
}

export const MERCHANT_SESSION_IDLE_TIMEOUT_SECONDS = 8 * 60 * 60;
export const MERCHANT_SESSION_ROTATION_INTERVAL_SECONDS = 10 * 60;

function firstRpcRow(data: unknown): MerchantSessionRpcRow | null {
    if (Array.isArray(data)) return (data[0] as MerchantSessionRpcRow | undefined) || null;
    if (data && typeof data === 'object') return data as MerchantSessionRpcRow;
    return null;
}

function normalizeSessionStatus(value: unknown): MerchantSessionStatus {
    switch (value) {
        case 'accepted':
        case 'malformed':
        case 'missing':
        case 'expired':
        case 'idle_timeout':
        case 'revoked':
        case 'reuse_detected':
            return value;
        default:
            return 'error';
    }
}

export async function validateMerchantSessionToken(
    db: MerchantSessionDb,
    token: string,
    options: { rotate?: boolean } = {},
): Promise<MerchantSessionValidationResult> {
    const { data, error } = await db.rpc('validate_and_rotate_merchant_session', {
        p_token: token,
        p_rotate: options.rotate === true,
        p_idle_timeout_seconds: MERCHANT_SESSION_IDLE_TIMEOUT_SECONDS,
        p_rotation_interval_seconds: MERCHANT_SESSION_ROTATION_INTERVAL_SECONDS,
    });

    if (error) {
        return {
            accepted: false,
            status: 'error',
            sessionId: null,
            userId: null,
            token: null,
            rotated: false,
            expiresAt: null,
        };
    }

    const row = firstRpcRow(data);
    return {
        accepted: row?.accepted === true && row?.status === 'accepted',
        status: normalizeSessionStatus(row?.status),
        sessionId: row?.session_id || null,
        userId: row?.user_id || null,
        token: row?.token || null,
        rotated: row?.rotated === true,
        expiresAt: row?.expires_at || null,
    };
}
