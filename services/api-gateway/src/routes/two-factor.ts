import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { resolveCustomUser, type CustomUser } from '../lib/auth-user';
import {
    decryptTextAesGcm,
    encryptTextAesGcm,
    sha256Hex,
} from '../lib/crypto';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { generateTotpSecret, otpauthUri, verifyTotpCode } from '../lib/totp';
import { validate } from '../middleware/validation';
import { AppError } from '../lib/errors';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

const VerifyTotpSchema = z.object({
    factor_id: z.string().uuid(),
    code: z.string().min(6).max(12),
});

const DisableFactorSchema = z.object({
    factor_id: z.string().uuid(),
    code: z.string().min(6).max(12).optional(),
    recovery_code: z.string().trim().min(11).max(40).optional(),
}).refine((input) => !(input.code && input.recovery_code), { message: 'Use one verification method.' });

interface TwoFactorRow extends Record<string, unknown> {
    id: string;
    custom_user_id: string;
    factor_type: 'totp' | 'passkey';
    status: 'pending' | 'active' | 'disabled';
    issuer: string;
    label: string;
    secret_ciphertext: string;
    recovery_code_hashes?: string[] | null;
    last_verified_at?: string | null;
    enrolled_at?: string | null;
    disabled_at?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

interface SessionRow extends Record<string, unknown> {
    id: string;
    device_id?: string | null;
    expires_at?: string | null;
    created_at?: string | null;
    last_active?: string | null;
}

function configuredSecret(env: Env): string | null {
    const secret = env.TOTP_ENCRYPTION_KEY;
    if (!secret || secret.startsWith('SKIP_NEEDS_HUMAN_') || secret.includes('replace-with')) return null;
    return secret;
}

async function requireCustomUser(c: AppContext): Promise<CustomUser> {
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const user = await resolveCustomUser(db, auth.user);
    if (!user) throw new Error('Merchant profile lookup failed');
    return user;
}

function serializeFactor(row: TwoFactorRow) {
    return {
        id: row.id,
        custom_user_id: row.custom_user_id,
        factor_type: row.factor_type,
        status: row.status,
        issuer: row.issuer,
        label: row.label,
        last_verified_at: row.last_verified_at || null,
        enrolled_at: row.enrolled_at || null,
        disabled_at: row.disabled_at || null,
        metadata: { algorithm: 'SHA1', digits: 6, period: 30 },
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
    };
}

function serializeSession(row: SessionRow) {
    return {
        id: row.id,
        device_id: row.device_id || null,
        expires_at: row.expires_at || null,
        created_at: row.created_at || null,
        last_active: row.last_active || null,
    };
}

async function loadFactors(db: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<TwoFactorRow[]> {
    const { data, error } = await db
        .from('merchant_2fa_factors')
        .select('*')
        .eq('custom_user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
    if (error) throw new Error(`2FA factor lookup failed: ${error.message}`);
    return (data || []) as unknown as TwoFactorRow[];
}

async function loadSessions(db: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<SessionRow[]> {
    const { data, error } = await db
        .from('sessions')
        .select('id, device_id, expires_at, created_at, last_active')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('last_active', { ascending: false })
        .limit(25);
    if (error) throw new Error(`Session lookup failed: ${error.message}`);
    return (data || []) as unknown as SessionRow[];
}

function buildOverview(user: CustomUser, factors: TwoFactorRow[], sessions: SessionRow[]) {
    return {
        custom_user_id: user.id,
        email: user.email,
        mfa_enabled: factors.some((factor) => factor.status === 'active'),
        factors: factors.map(serializeFactor),
        sessions: sessions.map(serializeSession),
    };
}

async function loadOwnedFactor(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    factorId: string,
): Promise<TwoFactorRow | null> {
    const { data, error } = await db
        .from('merchant_2fa_factors')
        .select('*')
        .eq('id', factorId)
        .eq('custom_user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw new Error(`2FA factor lookup failed: ${error.message}`);
    return (data as unknown as TwoFactorRow | null) || null;
}

function generateRecoveryCodes(): string[] {
    return Array.from({ length: 8 }, () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
            .match(/.{8}/g)!.join('-')
            .toUpperCase();
    });
}

async function recoveryCodeHashes(factorId: string, codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => sha256Hex(`${factorId}:${code}`)));
}

// These routes bypass generic store-selected HTTP caching. Every mutation still
// requires a logical command key and commits its actor-bound receipt atomically.
router.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    await next();
});

async function commandKey(c: AppContext): Promise<string> {
    const header = c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key');
    const raw = await c.req.text();
    let bodyKey: string | undefined;
    if (raw.trim()) {
        let input: unknown;
        try { input = JSON.parse(raw); } catch { throw new AppError('The command body must be valid JSON.', 400, 'VALIDATION_ERROR'); }
        const parsed = z.object({ idempotency_key: z.string().trim().min(8).max(200).optional() }).safeParse(input);
        if (!parsed.success) throw new AppError('A valid command key is required.', 400, 'IDEMPOTENCY_KEY_REQUIRED');
        bodyKey = parsed.data.idempotency_key;
    }
    const key = (header || bodyKey || '').trim();
    if (key.length < 8 || key.length > 200 || (header && bodyKey && key !== bodyKey)) {
        throw new AppError('A matching command key of 8–200 characters is required.', 400, 'IDEMPOTENCY_KEY_REQUIRED');
    }
    return key;
}

async function command(db: ReturnType<typeof getSupabaseAdmin>, actor: string, action: 'enroll' | 'verify' | 'disable', key: string, input: Record<string, unknown>) {
    const { data, error } = await db.rpc('execute_merchant_totp_command_v1', { p_actor_id: actor, p_command: action, p_key: key, p_input: input });
    if (error || !data || typeof data !== 'object') throw new AppError('Account security could not be updated. Retry the same command.', 503, 'TWO_FACTOR_STATE_UNAVAILABLE');
    const result = data as { accepted: boolean; code?: string; factor: TwoFactorRow; result_ciphertext?: string };
    if (!result.accepted) {
        const code = result.code || 'TWO_FACTOR_STATE_CHANGED';
        throw new AppError('Account security changed. Reload security settings before retrying.', code === 'TWO_FACTOR_NOT_FOUND' ? 404 : 409, code);
    }
    return result;
}

router.get('/', async (c) => {
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const [factors, sessions] = await Promise.all([
        loadFactors(db, user.id),
        loadSessions(db, user.id),
    ]);
    return c.json(success(buildOverview(user, factors, sessions)));
});

router.get('/sessions', async (c) => {
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const sessions = await loadSessions(db, user.id);
    return c.json(success({ sessions: sessions.map(serializeSession) }));
});

router.post('/totp/enroll', async (c) => {
    const key = await commandKey(c);
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const encryptionSecret = configuredSecret(c.env);
    if (!encryptionSecret) throw new AppError('Two-factor setup is temporarily unavailable.', 503, 'TWO_FACTOR_UNAVAILABLE');
    const label = user.email || 'LetBuyy Merchant';
    const result = await command(db, user.id, 'enroll', key, {
        secret_ciphertext: await encryptTextAesGcm(encryptionSecret, generateTotpSecret()), label,
    });
    const totpSecret = await decryptTextAesGcm(encryptionSecret, result.factor.secret_ciphertext);
    return c.json(success({
        factor: serializeFactor(result.factor), secret: totpSecret,
        otpauth_uri: otpauthUri({ issuer: 'LetBuyy', label: result.factor.label, accountName: user.email, secret: totpSecret }),
    }), 201);
});

router.post('/totp/verify', validate('json', VerifyTotpSchema), async (c) => {
    const body = c.get('validatedBody') as z.infer<typeof VerifyTotpSchema>;
    const key = await commandKey(c);
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const encryptionSecret = configuredSecret(c.env);
    if (!encryptionSecret) throw new AppError('Two-factor verification is temporarily unavailable.', 503, 'TWO_FACTOR_UNAVAILABLE');
    const factor = await loadOwnedFactor(db, user.id, body.factor_id);
    if (!factor || factor.factor_type !== 'totp' || factor.status === 'disabled') throw new AppError('Two-factor factor not found.', 404, 'TWO_FACTOR_NOT_FOUND');
    const secret = await decryptTextAesGcm(encryptionSecret, factor.secret_ciphertext);
    if (!await verifyTotpCode({ secret, code: body.code })) throw new AppError('Verification code is invalid.', 400, 'TWO_FACTOR_CODE_INVALID');
    const codes = generateRecoveryCodes();
    const result = await command(db, user.id, 'verify', key, {
        factor_id: factor.id, secret_sha256: await sha256Hex(factor.secret_ciphertext), proof_kind: 'totp', proof_verified: true,
        recovery_hashes: await recoveryCodeHashes(factor.id, codes),
        result_ciphertext: await encryptTextAesGcm(encryptionSecret, JSON.stringify({ actor: user.id, factor: factor.id, key, recovery_codes: codes })),
    });
    if (!result.result_ciphertext) throw new Error('Missing encrypted activation receipt');
    const recovered = JSON.parse(await decryptTextAesGcm(encryptionSecret, result.result_ciphertext)) as { actor: string; factor: string; key: string; recovery_codes: string[] };
    if (recovered.actor !== user.id || recovered.factor !== factor.id || recovered.key !== key || !Array.isArray(recovered.recovery_codes)) throw new Error('Activation receipt binding mismatch');
    return c.json(success({ factor: serializeFactor(result.factor), recovery_codes: recovered.recovery_codes }));
});

router.post('/disable', validate('json', DisableFactorSchema), async (c) => {
    const body = c.get('validatedBody') as z.infer<typeof DisableFactorSchema>;
    const key = await commandKey(c);
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const factor = await loadOwnedFactor(db, user.id, body.factor_id);
    if (!factor || factor.factor_type !== 'totp') throw new AppError('Two-factor factor not found.', 404, 'TWO_FACTOR_NOT_FOUND');
    let proofKind = 'none', verified = false;
    if (factor.status === 'active') {
        if (body.recovery_code) proofKind = 'recovery';
        else {
            const encryptionSecret = configuredSecret(c.env);
            if (!encryptionSecret || !body.code) throw new AppError('Verification code is required.', 400, 'TWO_FACTOR_CODE_REQUIRED');
            const secret = await decryptTextAesGcm(encryptionSecret, factor.secret_ciphertext);
            verified = await verifyTotpCode({ secret, code: body.code });
            if (!verified) throw new AppError('Verification code is invalid.', 400, 'TWO_FACTOR_CODE_INVALID');
            proofKind = 'totp';
        }
    }
    const result = await command(db, user.id, 'disable', key, {
        factor_id: factor.id, secret_sha256: await sha256Hex(factor.secret_ciphertext), expected_status: factor.status,
        proof_kind: proofKind, proof_verified: verified,
        recovery_hash: body.recovery_code ? await sha256Hex(`${factor.id}:${body.recovery_code.trim().toUpperCase()}`) : null,
    });
    return c.json(success({ factor: serializeFactor(result.factor) }));
});

export default router;
