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

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

const VerifyTotpSchema = z.object({
    factor_id: z.string().uuid(),
    code: z.string().min(6).max(12),
});

const DisableFactorSchema = z.object({
    factor_id: z.string().uuid(),
    code: z.string().min(6).max(12).optional(),
});

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
        metadata: row.metadata || {},
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
        const bytes = crypto.getRandomValues(new Uint8Array(5));
        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
            .replace(/^(.{5})(.{5})$/, '$1-$2')
            .toUpperCase();
    });
}

async function recoveryCodeHashes(factorId: string, codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => sha256Hex(`${factorId}:${code}`)));
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
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const secret = configuredSecret(c.env);
    if (!secret) {
        return c.json({ error: { code: 'TWO_FACTOR_UNAVAILABLE', message: 'Two-factor setup is temporarily unavailable.' } }, 503);
    }

    const factors = await loadFactors(db, user.id);
    const existing = factors.find((factor) => factor.factor_type === 'totp' && factor.status !== 'disabled');
    if (existing?.status === 'active') {
        return c.json({ error: { code: 'TWO_FACTOR_ALREADY_ENABLED', message: 'Two-factor authentication is already enabled.' } }, 409);
    }

    const factorId = existing?.id || crypto.randomUUID();
    const totpSecret = generateTotpSecret();
    const encrypted = await encryptTextAesGcm(secret, totpSecret);
    const label = user.email || 'LetBuyy Merchant';
    const values = {
        custom_user_id: user.id,
        factor_type: 'totp',
        status: 'pending',
        issuer: 'LetBuyy',
        label,
        secret_ciphertext: encrypted,
        recovery_code_hashes: [],
        metadata: { algorithm: 'SHA1', digits: 6, period: 30 },
        updated_by: user.id,
    };

    const result = existing
        ? await db.from('merchant_2fa_factors').update(values).eq('id', factorId).select('*').single()
        : await db.from('merchant_2fa_factors').insert({ id: factorId, ...values, created_by: user.id }).select('*').single();

    if (result.error) throw new Error(`2FA enrollment failed: ${result.error.message}`);
    const factor = result.data as unknown as TwoFactorRow;
    return c.json(success({
        factor: serializeFactor(factor),
        secret: totpSecret,
        otpauth_uri: otpauthUri({
            issuer: 'LetBuyy',
            label,
            accountName: user.email,
            secret: totpSecret,
        }),
    }), 201);
});

router.post('/totp/verify', validate('json', VerifyTotpSchema), async (c) => {
    const body = c.get('validatedBody') as z.infer<typeof VerifyTotpSchema>;
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const encryptionSecret = configuredSecret(c.env);
    if (!encryptionSecret) {
        return c.json({ error: { code: 'TWO_FACTOR_UNAVAILABLE', message: 'Two-factor verification is temporarily unavailable.' } }, 503);
    }

    const factor = await loadOwnedFactor(db, user.id, body.factor_id);
    if (!factor || factor.factor_type !== 'totp' || factor.status === 'disabled') {
        return c.json({ error: { code: 'TWO_FACTOR_NOT_FOUND', message: 'Two-factor factor not found.' } }, 404);
    }

    const secret = await decryptTextAesGcm(encryptionSecret, factor.secret_ciphertext);
    const accepted = await verifyTotpCode({ secret, code: body.code });
    if (!accepted) {
        return c.json({ error: { code: 'TWO_FACTOR_CODE_INVALID', message: 'Verification code is invalid.' } }, 400);
    }

    const now = new Date().toISOString();
    const recoveryCodes = generateRecoveryCodes();
    const { data, error } = await db
        .from('merchant_2fa_factors')
        .update({
            status: 'active',
            enrolled_at: factor.enrolled_at || now,
            last_verified_at: now,
            recovery_code_hashes: await recoveryCodeHashes(factor.id, recoveryCodes),
            updated_by: user.id,
        })
        .eq('id', factor.id)
        .select('*')
        .single();
    if (error) throw new Error(`2FA verification failed: ${error.message}`);

    return c.json(success({
        factor: serializeFactor(data as unknown as TwoFactorRow),
        recovery_codes: recoveryCodes,
    }));
});

router.post('/disable', validate('json', DisableFactorSchema), async (c) => {
    const body = c.get('validatedBody') as z.infer<typeof DisableFactorSchema>;
    const db = getSupabaseAdmin(c);
    const user = await requireCustomUser(c);
    const factor = await loadOwnedFactor(db, user.id, body.factor_id);
    if (!factor || factor.status === 'disabled') {
        return c.json({ error: { code: 'TWO_FACTOR_NOT_FOUND', message: 'Two-factor factor not found.' } }, 404);
    }

    if (factor.status === 'active') {
        const encryptionSecret = configuredSecret(c.env);
        if (!encryptionSecret || !body.code) {
            return c.json({ error: { code: 'TWO_FACTOR_CODE_REQUIRED', message: 'Verification code is required.' } }, 400);
        }
        const secret = await decryptTextAesGcm(encryptionSecret, factor.secret_ciphertext);
        const accepted = await verifyTotpCode({ secret, code: body.code });
        if (!accepted) {
            return c.json({ error: { code: 'TWO_FACTOR_CODE_INVALID', message: 'Verification code is invalid.' } }, 400);
        }
    }

    const now = new Date().toISOString();
    const { data, error } = await db
        .from('merchant_2fa_factors')
        .update({
            status: 'disabled',
            disabled_at: now,
            recovery_code_hashes: [],
            updated_by: user.id,
        })
        .eq('id', factor.id)
        .select('*')
        .single();
    if (error) throw new Error(`2FA disable failed: ${error.message}`);

    return c.json(success({ factor: serializeFactor(data as unknown as TwoFactorRow) }));
});

export default router;
