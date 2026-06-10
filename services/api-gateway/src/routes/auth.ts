import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    createSupabaseAnonClient,
    createSupabaseServiceClient,
} from '@letbuyy/infrastructure/supabase-adapter';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import { resolveCustomUser } from '../lib/auth-user';
import { bytesToHex, verifyInternalAppRequest, verifyInternalSessionHeaders } from '../lib/internal-auth';
import { dbErrorBody, errorBody, getSupabaseAdmin, isLocalSupabaseEnvironment, shouldReturnEmptyForMissingLocalSchema } from '../lib/supabase';
import { checkRateLimitKey } from '../middleware/rateLimit';
import { validate } from '../middleware/validation';
import { hashMerchantPassword, verifyMerchantPassword } from '../lib/merchant-password';
import { validateMerchantSessionToken } from '../lib/merchant-session';
import { decryptTextAesGcm } from '../lib/crypto';
import { validateIdentityIssuedMerchantSessionToken } from '../lib/identity-session-verifier';
import { verifyTotpCode } from '../lib/totp';
import {
    AUTH_OTP_EXPIRY_MS,
    AUTH_SESSION_DURATION_MS,
    AUTH_TOKEN_EXPIRY_MS,
    SignUpSchema,
    SignInSchema,
    OtpRequestSchema,
    OtpVerifySchema,
    PasswordResetRequestSchema,
    PasswordUpdateSchema,
    isAuthTokenType,
    isAuthUuid,
    normalizeAuthEmail,
    parseAuthDeviceName,
    planCustomUserEnsure,
    type AuthTokenType,
} from '../schemas/auth.schema';
import { validateSubdomainFormat } from '@letbuyy/tenant-core';

const auth = new Hono<{ Bindings: import('../index').Env }>();
const MERCHANT_PASSWORD_HASH_COLUMN = 'password_hash';
const AUTH_RATE_LIMITS = {
    lookup: { limit: 10, windowMs: 15 * 60_000, prefix: 'rl:lookup' },
    signup: { limit: 3, windowMs: 60 * 60_000, prefix: 'rl:signup' },
    login: { limit: 5, windowMs: 15 * 60_000, prefix: 'rl:login' },
    'send-magic': { limit: 3, windowMs: 15 * 60_000, prefix: 'rl:magic' },
    'send-reset': { limit: 3, windowMs: 15 * 60_000, prefix: 'rl:reset' },
    'set-password': { limit: 5, windowMs: 15 * 60_000, prefix: 'rl:setpw' },
    'reset-password': { limit: 5, windowMs: 15 * 60_000, prefix: 'rl:resetpw' },
    verify: { limit: 10, windowMs: 15 * 60_000, prefix: 'rl:verify' },
    verify_otp: { limit: 5, windowMs: 15 * 60_000, prefix: 'rl:verify_otp' },
} as const;
const PASSWORD_SET_INTENT_TTL_SECONDS = 15 * 60;

type LocalAuthUser = {
    id: string;
    email: string;
    email_verified: boolean;
    full_name: string | null;
    avatar_url: string | null;
    password_hash?: string | null;
};

type LocalAuthToken = {
    id: string;
    email: string;
    user_id: string | null;
    token: string;
    type: AuthTokenType;
    expires_at: string;
    used: boolean;
};

type LocalPasswordSetIntent = {
    id: string;
    user_id: string;
    email: string;
    expires_at: string;
    used_at: string | null;
};

type LocalAuthSession = {
    token: string;
    user_id: string;
    device_id: string | null;
    expires_at: string;
    last_active: string;
};

const localAuthUsersByEmail = new Map<string, LocalAuthUser>();
const localAuthTokens = new Map<string, LocalAuthToken>();
const localPasswordSetIntents = new Map<string, LocalPasswordSetIntent>();
const localAuthSessions = new Map<string, LocalAuthSession>();

async function requireAccountsInternal(c: Context<{ Bindings: import('../index').Env }>) {
    if (await verifyInternalAppRequest(c, 'accounts')) return null;
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid internal auth signature' } }, 401);
}

function isLocalAuthRuntime(c: Context<{ Bindings: import('../index').Env }>): boolean {
    const hostname = (() => {
        try {
            return new URL(c.req.url).hostname.toLowerCase();
        } catch {
            return '';
        }
    })();

    if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
        return true;
    }

    return ['local', 'development'].includes(String(c.env.ENVIRONMENT || '').toLowerCase())
        || ['local', 'development'].includes(String(c.env.APP_ENV || '').toLowerCase())
        || String(c.env.NODE_ENV || '').toLowerCase() === 'development';
}

function isPlaceholderSecret(value: string | undefined): boolean {
    const normalized = String(value || '').toLowerCase();
    return !normalized
        || normalized.includes('placeholder')
        || normalized.includes('replace-with')
        || normalized.includes('dev-only');
}

function isLocalEmailProviderFailure(error: string | undefined): boolean {
    const normalized = String(error || '').toLowerCase();
    return normalized.includes('api key is invalid')
        || normalized.includes('api key')
        || normalized.includes('resend');
}

function isAuthRateLimitEndpoint(endpoint: string): endpoint is keyof typeof AUTH_RATE_LIMITS {
    return endpoint in AUTH_RATE_LIMITS;
}

function configuredTotpEncryptionSecret(env: import('../index').Env): string | null {
    const secret = env.TOTP_ENCRYPTION_KEY;
    if (!secret || secret.startsWith('SKIP_NEEDS_HUMAN_') || secret.includes('replace-with')) return null;
    return secret;
}

async function enforceMerchantMfaIfEnrolled(
    c: Context<{ Bindings: import('../index').Env }>,
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    rawCode: unknown,
) {
    const { data, error } = await db
        .from('merchant_2fa_factors')
        .select('id, secret_ciphertext')
        .eq('custom_user_id', userId)
        .eq('factor_type', 'totp')
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(1);

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) return null;
        return c.json(dbErrorBody(), 500);
    }

    const factor = Array.isArray(data) ? data[0] as { id: string; secret_ciphertext: string } | undefined : undefined;
    if (!factor) return null;

    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (!code) {
        return c.json({
            error: {
                code: 'MFA_REQUIRED',
                message: 'Enter your authenticator code to continue',
            },
            mfa_required: true,
        }, 403);
    }

    const encryptionSecret = configuredTotpEncryptionSecret(c.env);
    if (!encryptionSecret) {
        return c.json({
            error: {
                code: 'MFA_UNAVAILABLE',
                message: 'Two-factor verification is temporarily unavailable',
            },
        }, 503);
    }

    const totpSecret = await decryptTextAesGcm(encryptionSecret, factor.secret_ciphertext);
    const accepted = await verifyTotpCode({ secret: totpSecret, code });
    if (!accepted) {
        return c.json({
            error: {
                code: 'MFA_INVALID',
                message: 'Authenticator code is invalid',
            },
            mfa_required: true,
        }, 401);
    }

    await db
        .from('merchant_2fa_factors')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('id', factor.id);

    return null;
}

function randomHex(byteCount: number): string {
    const bytes = new Uint8Array(byteCount);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes.buffer);
}

function isProductionGatewayRuntime(env: import('../index').Env): boolean {
    return ['production', 'prod'].includes(String(env.APP_ENV || env.ENVIRONMENT || env.NODE_ENV || '').toLowerCase());
}

function randomOtp(): string {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return (100000 + (bytes[0] % 900000)).toString();
}

async function localAuthUuid(seed: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`letbuyy-local-auth:${seed}`)
    );
    const hex = bytesToHex(digest);
    const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
        .toString(16)
        .padStart(2, '0');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

async function getOrCreateLocalAuthUser(email: string, emailVerified = false): Promise<LocalAuthUser> {
    const existing = localAuthUsersByEmail.get(email);
    if (existing) {
        if (emailVerified && !existing.email_verified) existing.email_verified = true;
        return existing;
    }

    const user: LocalAuthUser = {
        id: await localAuthUuid(`user:${email}`),
        email,
        email_verified: emailVerified,
        full_name: null,
        avatar_url: null,
        password_hash: null,
    };
    localAuthUsersByEmail.set(email, user);
    return user;
}

function findLocalAuthUserById(userId: string): LocalAuthUser | null {
    for (const user of localAuthUsersByEmail.values()) {
        if (user.id === userId) return user;
    }
    return null;
}

function localAuthUserPayload(user: LocalAuthUser) {
    return {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
    };
}

function localAuthTokenKey(type: AuthTokenType, email: string, token: string): string {
    return `${type}:${email}:${token}`;
}

async function createLocalPasswordSetIntent(userId: string, email: string): Promise<LocalPasswordSetIntent> {
    const intent: LocalPasswordSetIntent = {
        id: await localAuthUuid(`password-set-intent:${userId}:${email}:${randomHex(8)}`),
        user_id: userId,
        email,
        expires_at: new Date(Date.now() + PASSWORD_SET_INTENT_TTL_SECONDS * 1000).toISOString(),
        used_at: null,
    };
    localPasswordSetIntents.set(intent.id, intent);
    return intent;
}

function consumeLocalPasswordSetIntent(intentId: string): LocalPasswordSetIntent | null {
    const intent = localPasswordSetIntents.get(intentId);
    if (!intent || intent.used_at || new Date(intent.expires_at).getTime() < Date.now()) {
        return null;
    }

    intent.used_at = new Date().toISOString();
    return intent;
}

async function getOrCreateDevice(db: ReturnType<typeof getSupabaseAdmin>, userId: string, fingerprint: string, userAgent: string) {
    const deviceName = parseAuthDeviceName(userAgent);
    const { data: existing } = await db
        .from('devices')
        .select('id')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .maybeSingle();

    if (existing) {
        await db
            .from('devices')
            .update({ last_used: new Date().toISOString(), name: deviceName })
            .eq('id', existing.id);
        return { device_id: existing.id as string, is_new: false };
    }

    const { data: device, error } = await db
        .from('devices')
        .insert({
            user_id: userId,
            fingerprint,
            name: deviceName,
        })
        .select('id')
        .single();

    if (error || !device) {
        throw new Error(error?.message || 'Failed to create device');
    }

    return { device_id: device.id as string, is_new: true };
}

function accountsPasswordResetUrl(c: Context<{ Bindings: import('../index').Env }>): string {
    const rawDomain = c.env.LETBUYY_PLATFORM_DOMAIN
        || c.env.NEXT_PUBLIC_PLATFORM_DOMAIN
        || c.env.PLATFORM_ROOT_DOMAIN
        || 'letbuyy.com';
    const domain = rawDomain
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/^\.+|\.+$/g, '');
    return `https://accounts.${domain || 'letbuyy.com'}/reset-password`;
}

// GET /auth/custom/session — Validate LetBuyy opaque session token from a signed
// internal app boundary. Local Wrangler sessions can live in-memory when the
// custom auth schema is absent.
auth.get('/custom/session', async (c) => {
    const sessionVerification = await verifyInternalSessionHeaders(c.env, {
        sessionToken: c.req.header('X-LetBuyy-Internal-Session-Token'),
        timestamp: c.req.header('X-LetBuyy-Internal-Timestamp'),
        signature: c.req.header('X-LetBuyy-Internal-Signature'),
    });

    if (!sessionVerification.accepted || !sessionVerification.token) {
        return c.json({
            error: {
                code: 'UNAUTHORIZED',
                message: sessionVerification.reason || 'Authentication required',
            },
        }, 401);
    }

    const token = sessionVerification.token;
    const localSession = localAuthSessions.get(token);
    if (localSession) {
        if (new Date(localSession.expires_at).getTime() < Date.now()) {
            localAuthSessions.delete(token);
            return c.json({ authenticated: false }, 401);
        }

        const localUser = findLocalAuthUserById(localSession.user_id);
        if (localUser) {
            localSession.last_active = new Date().toISOString();
            return c.json({
                authenticated: true,
                user: {
                    id: localUser.id,
                    email: localUser.email,
                    fullName: localUser.full_name || null,
                },
                expires_at: localSession.expires_at,
                devOnly: true,
            });
        }
    }

    const db = getSupabaseAdmin(c);
    const session = await validateMerchantSessionToken(db, token, { rotate: true });
    if (session.status === 'error') {
        return c.json(dbErrorBody(), 500);
    }

    if (!session.accepted || !session.userId) {
        return c.json({ authenticated: false, reason: session.status }, 401);
    }

    const customUser = await resolveCustomUser(db, { id: session.userId, email: '' });

    if (!customUser) {
        return c.json({ authenticated: false }, 401);
    }

    return c.json({
        authenticated: true,
        user: {
            id: customUser.id,
            email: customUser.email,
            fullName: customUser.full_name || null,
        },
        expires_at: session.expiresAt,
        rotated_session_token: session.rotated ? session.token : undefined,
    });
});

auth.post('/custom/users/by-email', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const email = normalizeAuthEmail(body.email);
    if (!email) {
        return c.json({ error: { code: 'VALIDATION', message: 'email is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('users_custom')
        .select(`id, email, ${MERCHANT_PASSWORD_HASH_COLUMN}, email_verified, full_name, avatar_url`)
        .eq('email', email)
        .maybeSingle();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const localUser = localAuthUsersByEmail.get(email);
            if (!localUser) {
                return c.json({ data: null, local_schema_missing: true });
            }

            return c.json({
                data: {
                    ...localAuthUserPayload(localUser),
                    has_password: Boolean(localUser[MERCHANT_PASSWORD_HASH_COLUMN]),
                },
                local_schema_missing: true,
                devOnly: true,
            });
        }
        return c.json(dbErrorBody(), 500);
    }

    if (!data) {
        return c.json({ data: null });
    }

    const user = data as {
        id: string;
        email: string;
        email_verified: boolean | null;
        full_name: string | null;
        avatar_url: string | null;
        [MERCHANT_PASSWORD_HASH_COLUMN]?: string | null;
};

    return c.json({
        data: {
            id: user.id,
            email: user.email,
            email_verified: Boolean(user.email_verified),
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            has_password: Boolean(user[MERCHANT_PASSWORD_HASH_COLUMN]),
        },
    });
});

auth.post('/custom/users/authenticate', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const rawBody = await c.req.json();
    const email = normalizeAuthEmail(rawBody.email);
    const password = typeof rawBody.password === 'string' ? rawBody.password : '';
    const parsed = SignInSchema.safeParse({ email, password });

    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid email and password are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: user, error } = await db
        .from('users_custom')
        .select('id, email, password_hash, email_verified, full_name, avatar_url')
        .eq('email', parsed.data.email)
        .maybeSingle();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const localUser = await getOrCreateLocalAuthUser(parsed.data.email);
            if (!localUser.password_hash) {
                return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
            }

            const localPasswordMatches = await verifyMerchantPassword(password, localUser.password_hash);
            if (!localPasswordMatches || !localUser.email_verified) {
                return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
            }

            return c.json({
                data: {
                    id: localUser.id,
                    email: localUser.email,
                    email_verified: localUser.email_verified,
                    full_name: localUser.full_name,
                    avatar_url: localUser.avatar_url,
                },
                local_schema_missing: true,
                devOnly: true,
            });
        }
        return c.json(dbErrorBody(), 500);
    }

    if (!user?.password_hash) {
        return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
    }

    const passwordMatches = await verifyMerchantPassword(password, String(user.password_hash));
    if (!passwordMatches) {
        return c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
    }

    if (!user.email_verified) {
        return c.json({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email first' } }, 403);
    }

    const mfaResponse = await enforceMerchantMfaIfEnrolled(
        c,
        db,
        String(user.id),
        rawBody.mfa_code ?? rawBody.totp_code,
    );
    if (mfaResponse) return mfaResponse;

    return c.json({
        data: {
            id: user.id,
            email: user.email,
            email_verified: Boolean(user.email_verified),
            full_name: user.full_name,
            avatar_url: user.avatar_url,
        },
    });
});

auth.post('/custom/rate-limit/check', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const endpoint = String(body.endpoint || '');
    const identifier = String(body.identifier || '');
    if (!isAuthRateLimitEndpoint(endpoint) || !identifier) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid endpoint and identifier are required' } }, 400);
    }

    const config = AUTH_RATE_LIMITS[endpoint];

    if (isLocalAuthRuntime(c)) {
        return c.json({
            data: {
                allowed: true,
            },
        });
    }

    const result = await checkRateLimitKey(c.env, {
        key: identifier,
        max: config.limit,
        windowMs: config.windowMs,
        prefix: config.prefix,
    });

    if (result.unavailable) {
        return c.json({ error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Rate limiting infrastructure is unavailable' } }, 503);
    }

    return c.json({
        data: {
            allowed: result.allowed,
            retryAfter: result.allowed ? undefined : Math.ceil((result.resetAt - Date.now()) / 1000),
        },
    });
});

auth.post('/custom/emails/send', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const to = body.to;
    const subject = typeof body.subject === 'string' ? body.subject : '';
    const html = typeof body.html === 'string' ? body.html : undefined;
    const text = typeof body.text === 'string' ? body.text : undefined;
    const from = typeof body.from === 'string'
        ? body.from
        : `LetBuyy <${c.env.RESEND_FROM_EMAIL || 'noreply@letbuyy.com'}>`;

    if ((!Array.isArray(to) && typeof to !== 'string') || !subject || (!html && !text)) {
        return c.json({ error: { code: 'VALIDATION', message: 'to, subject, and html or text are required' } }, 400);
    }

    if (isLocalAuthRuntime(c) && isPlaceholderSecret(c.env.RESEND_API_KEY)) {
        console.info(JSON.stringify({
            level: 'info',
            service: 'letbuyy-api',
            route: 'auth.custom.emails.send',
            status_code: 200,
            reason: 'local_email_sink',
            to,
            subject,
        }));
        return c.json({ data: { success: true, devOnly: true } });
    }

    try {
        const result = await sendResendEmail({
            apiKey: c.env.RESEND_API_KEY,
            from,
            to,
            subject,
            html,
            text,
        });

        if (!result.success && isLocalAuthRuntime(c) && isLocalEmailProviderFailure(result.error)) {
            console.info(JSON.stringify({
                level: 'info',
                service: 'letbuyy-api',
                route: 'auth.custom.emails.send',
                status_code: 200,
                reason: 'local_email_provider_failure_suppressed',
                error: result.error,
                to,
                subject,
            }));
            return c.json({ data: { success: true, devOnly: true, suppressedError: result.error } });
        }

        return c.json({ data: result });
    } catch (error) {
        if (isLocalAuthRuntime(c) && isLocalEmailProviderFailure(error instanceof Error ? error.message : undefined)) {
            console.info(JSON.stringify({
                level: 'info',
                service: 'letbuyy-api',
                route: 'auth.custom.emails.send',
                status_code: 200,
                reason: 'local_email_exception_suppressed',
                error: error instanceof Error ? error.message : 'Email provider request failed',
                to,
                subject,
            }));
            return c.json({ data: { success: true, devOnly: true } });
        }

        console.error(JSON.stringify({
            level: 'error',
            service: 'letbuyy-api',
            route: 'auth.custom.emails.send',
            status_code: 502,
            reason: 'email_provider_failed',
            error: error instanceof Error ? error.message : 'Email provider request failed',
        }));
        return c.json({ data: { success: false, error: 'Email provider request failed' } });
    }
});

auth.post('/custom/users/first-store', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    if (!isAuthUuid(userId)) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid user_id is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('sites')
        .select('id, name, store_name, subdomain, site_type, status')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json({ data: null, local_schema_missing: true, devOnly: true });
        }
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: data || null });
});

auth.post('/custom/subdomains/validate', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const subdomain = String(body.subdomain || '').toLowerCase().trim();
    const format = validateSubdomainFormat(subdomain);

    if (!format.valid) {
        return c.json(format);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('sites')
        .select('id')
        .or(`subdomain.eq.${subdomain},store_name.eq.${subdomain}`)
        .limit(1);

    if (error) {
        // Local dev resilience (matches /custom/users/first-store and the
        // internal-console handlers): when the local Supabase has no `sites`
        // table yet — or the local database is otherwise unreachable — there is
        // nothing to conflict with, so don't block onboarding. Format and
        // reserved-word checks have already passed above. This NEVER relaxes in
        // production: isLocalSupabaseEnvironment is false unless SUPABASE_URL
        // points at localhost / 127.0.0.1.
        if (isLocalSupabaseEnvironment(c.env)) {
            return c.json({
                valid: true,
                reason: 'available',
                message: 'Available!',
                devOnly: true,
            });
        }
        return c.json({
            valid: false,
            reason: 'unverified',
            message: 'Unable to verify availability right now',
        });
    }

    if (data && data.length > 0) {
        return c.json({ valid: false, reason: 'taken', message: 'This subdomain is already taken' });
    }

    return c.json({ valid: true, reason: 'available', message: 'Available!' });
});

auth.post('/custom/users/ensure', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userPlan = planCustomUserEnsure(body, new Date().toISOString());
    if (!userPlan) {
        return c.json({ error: { code: 'VALIDATION', message: 'email is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: existing, error: existingError } = await db
        .from('users_custom')
        .select('id, email, email_verified, full_name, avatar_url')
        .eq('email', userPlan.email)
        .maybeSingle();

    if (existingError) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, existingError)) {
            const localUser = await getOrCreateLocalAuthUser(userPlan.email);
            return c.json({ data: localAuthUserPayload(localUser), local_schema_missing: true, devOnly: true }, 201);
        }
        return c.json(dbErrorBody(), 500);
    }

    if (existing) {
        const { data, error } = await db
            .from('users_custom')
            .update(userPlan.updates)
            .eq('id', existing.id)
            .select('id, email, email_verified, full_name, avatar_url')
            .single();

        if (error) {
            if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
                const localUser = await getOrCreateLocalAuthUser(userPlan.email, Boolean(existing.email_verified));
                return c.json({ data: localAuthUserPayload(localUser), local_schema_missing: true, devOnly: true });
            }
            return c.json(dbErrorBody(), 500);
        }
        return c.json({ data });
    }

    const { data, error } = await db
        .from('users_custom')
        .insert(userPlan.insert)
        .select('id, email, email_verified, full_name, avatar_url')
        .single();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const localUser = await getOrCreateLocalAuthUser(userPlan.email);
            return c.json({ data: localAuthUserPayload(localUser), local_schema_missing: true, devOnly: true }, 201);
        }
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data }, 201);
});

auth.post('/custom/users/verify-email', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    let query = db.from('users_custom').update({ email_verified: true, updated_at: new Date().toISOString() });

    if (body.user_id) query = query.eq('id', body.user_id);
    else if (body.email) query = query.eq('email', normalizeAuthEmail(body.email));
    else return c.json({ error: { code: 'VALIDATION', message: 'user_id or email is required' } }, 400);

    const { data, error } = await query.select('id, email, full_name, avatar_url, email_verified').single();

    if (error || !data) {
        if (error && shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const email = body.email ? normalizeAuthEmail(body.email) : null;
            const localUser = email
                ? await getOrCreateLocalAuthUser(email, true)
                : findLocalAuthUserById(String(body.user_id || ''));

            if (localUser) {
                localUser.email_verified = true;
                return c.json({
                    data: {
                        id: localUser.id,
                        email: localUser.email,
                        full_name: localUser.full_name,
                        avatar_url: localUser.avatar_url,
                        email_verified: localUser.email_verified,
                    },
                    local_schema_missing: true,
                    devOnly: true,
                });
            }
        }
        return c.json(errorBody('NOT_FOUND', 'User not found'), 404);
    }

    return c.json({ data });
});

auth.post('/custom/password-set-intents/create', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    const email = normalizeAuthEmail(body.email);

    if (!isAuthUuid(userId) || !email) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid user_id and email are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: user, error: userError } = await db
        .from('users_custom')
        .select('id, email, email_verified')
        .eq('id', userId)
        .eq('email', email)
        .maybeSingle();

    if (userError) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, userError)) {
            const localUser = await getOrCreateLocalAuthUser(email, true);
            if (localUser.id !== userId) {
                return c.json(errorBody('NOT_FOUND', 'User not found'), 404);
            }
            const intent = await createLocalPasswordSetIntent(userId, email);
            return c.json({ data: intent, local_schema_missing: true, devOnly: true }, 201);
        }
        return c.json(dbErrorBody(), 500);
    }

    if (!user) {
        return c.json(errorBody('NOT_FOUND', 'User not found'), 404);
    }

    if (!user.email_verified) {
        return c.json(errorBody('FORBIDDEN', 'Email not verified'), 403);
    }

    const now = new Date().toISOString();
    await db
        .from('auth_password_set_intents')
        .update({ used_at: now })
        .eq('user_id', userId)
        .eq('email', email)
        .is('used_at', null)
        .is('deleted_at', null);

    const expiresAt = new Date(Date.now() + PASSWORD_SET_INTENT_TTL_SECONDS * 1000).toISOString();
    const { data: intent, error: intentError } = await db
        .from('auth_password_set_intents')
        .insert({
            user_id: userId,
            email,
            expires_at: expiresAt,
        })
        .select('id, user_id, email, expires_at')
        .single();

    if (intentError || !intent) {
        if (intentError && shouldReturnEmptyForMissingLocalSchema(c.env, intentError)) {
            const localIntent = await createLocalPasswordSetIntent(userId, email);
            return c.json({ data: localIntent, local_schema_missing: true, devOnly: true }, 201);
        }
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: intent }, 201);
});

auth.post('/custom/password-set-intents/consume', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const intentId = String(body.intent_id || '');

    if (!isAuthUuid(intentId)) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid intent_id is required' } }, 400);
    }

    const now = new Date().toISOString();
    const { data: intent, error } = await getSupabaseAdmin(c)
        .from('auth_password_set_intents')
        .update({ used_at: now })
        .eq('id', intentId)
        .is('used_at', null)
        .is('deleted_at', null)
        .gt('expires_at', now)
        .select('id, user_id, email, expires_at, used_at')
        .maybeSingle();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const localIntent = consumeLocalPasswordSetIntent(intentId);
            if (localIntent) {
                return c.json({ data: localIntent, local_schema_missing: true, devOnly: true });
            }
            return c.json(errorBody('FORBIDDEN', 'Password set intent is invalid or expired'), 403);
        }
        return c.json(dbErrorBody(), 500);
    }

    if (!intent) {
        return c.json(errorBody('FORBIDDEN', 'Password set intent is invalid or expired'), 403);
    }

    return c.json({ data: intent });
});

auth.post('/custom/users/set-password', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    const email = normalizeAuthEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const parsed = PasswordUpdateSchema.safeParse({ password });

    if (!userId || !email || !parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'user_id, email, and valid password are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: user, error: userError } = await db
        .from('users_custom')
        .select('id, email, email_verified, full_name, avatar_url')
        .eq('id', userId)
        .eq('email', email)
        .maybeSingle();

    if (userError) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, userError)) {
            const localUser = await getOrCreateLocalAuthUser(email, true);
            if (localUser.id !== userId) {
                return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
            }

            localUser.password_hash = await hashMerchantPassword(password);
            return c.json({
                data: {
                    id: localUser.id,
                    email: localUser.email,
                    full_name: localUser.full_name,
                    avatar_url: localUser.avatar_url,
                },
                local_schema_missing: true,
                devOnly: true,
            });
        }
        return c.json(dbErrorBody(), 500);
    }

    if (!user) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    }

    if (!user.email_verified) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Email not verified' } }, 403);
    }

    const passwordHash = await hashMerchantPassword(password);
    const { data, error } = await db
        .from('users_custom')
        .update({ [MERCHANT_PASSWORD_HASH_COLUMN]: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id, email, full_name, avatar_url')
        .single();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const localUser = await getOrCreateLocalAuthUser(email, true);
            localUser.password_hash = passwordHash;
            return c.json({
                data: {
                    id: localUser.id,
                    email: localUser.email,
                    full_name: localUser.full_name,
                    avatar_url: localUser.avatar_url,
                },
                local_schema_missing: true,
                devOnly: true,
            });
        }
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data });
});

auth.post('/custom/devices/get-or-create', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    const fingerprint = String(body.fingerprint || '');
    const userAgent = String(body.user_agent || '');
    if (!userId || !fingerprint) {
        return c.json({ error: { code: 'VALIDATION', message: 'user_id and fingerprint are required' } }, 400);
    }

    try {
        const device = await getOrCreateDevice(getSupabaseAdmin(c), userId, fingerprint, userAgent);
        return c.json({ data: device }, device.is_new ? 201 : 200);
    } catch (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json({
                data: {
                    device_id: await localAuthUuid(`device:${userId}:${fingerprint}`),
                    is_new: false,
                },
                local_schema_missing: true,
                devOnly: true,
            }, 201);
        }
        return c.json(dbErrorBody('Device registration failed'), 500);
    }
});

auth.post('/custom/devices/trusted', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    const fingerprint = String(body.fingerprint || '');
    if (!isAuthUuid(userId) || !fingerprint) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid user_id and fingerprint are required' } }, 400);
    }

    const { data, error } = await getSupabaseAdmin(c)
        .from('devices')
        .select('trusted')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .maybeSingle();

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json({ data: { trusted: false }, local_schema_missing: true, devOnly: true });
        }
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: { trusted: Boolean(data?.trusted) } });
});

auth.post('/custom/sessions/create', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    const deviceId = body.device_id ? String(body.device_id) : null;
    const providedToken = typeof body.token === 'string' ? body.token.trim() : '';
    if (!userId) {
        return c.json({ error: { code: 'VALIDATION', message: 'user_id is required' } }, 400);
    }

    if (!providedToken && isProductionGatewayRuntime(c.env)) {
        return c.json({
            error: {
                code: 'IDENTITY_ISSUER_REQUIRED',
                message: 'Identity-issued merchant session token is required',
            },
        }, 503);
    }

    if (providedToken) {
        const tokenValidation = await validateIdentityIssuedMerchantSessionToken(c.env, providedToken, userId);
        if (!tokenValidation.ok) {
            return c.json({
                error: {
                    code: 'INVALID_IDENTITY_SESSION_TOKEN',
                    message: tokenValidation.reason || 'Identity-issued merchant session token is invalid',
                },
            }, 400);
        }
    }

    const db = getSupabaseAdmin(c);
    const token = providedToken || randomHex(32);
    const expiresAt = new Date(Date.now() + AUTH_SESSION_DURATION_MS).toISOString();
    const { error } = await db.from('sessions').insert({
        user_id: userId,
        device_id: deviceId,
        token,
        expires_at: expiresAt,
    });

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            localAuthSessions.set(token, {
                token,
                user_id: userId,
                device_id: deviceId,
                expires_at: expiresAt,
                last_active: new Date().toISOString(),
            });

            return c.json({
                data: {
                    token,
                    expires_at: expiresAt,
                },
                local_schema_missing: true,
                devOnly: true,
            }, 201);
        }
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: { token, expires_at: expiresAt } }, 201);
});

auth.post('/custom/sessions/destroy', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const token = String(body.token || '');
    if (!token) {
        return c.json({ error: { code: 'VALIDATION', message: 'token is required' } }, 400);
    }

    await getSupabaseAdmin(c).from('sessions').delete().eq('token', token);
    return c.json({ data: { deleted: true } });
});

auth.post('/custom/sessions/destroy-all', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    if (!userId) {
        return c.json({ error: { code: 'VALIDATION', message: 'user_id is required' } }, 400);
    }

    await getSupabaseAdmin(c).from('sessions').delete().eq('user_id', userId);
    return c.json({ data: { deleted: true } });
});

auth.post('/custom/tokens/create', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const email = normalizeAuthEmail(body.email);
    if (!email || !isAuthTokenType(body.type)) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid email and token type are required' } }, 400);
    }
    const type: AuthTokenType = body.type;

    const db = getSupabaseAdmin(c);
    await db.from('verification_tokens').update({ used: true }).eq('email', email).eq('type', type).eq('used', false);

    const token = type === 'email_verify' && body.otp === true ? randomOtp() : randomHex(32);
    const expiresAt = new Date(Date.now() + (body.otp === true ? AUTH_OTP_EXPIRY_MS : AUTH_TOKEN_EXPIRY_MS[type])).toISOString();
    const { error } = await db.from('verification_tokens').insert({
        email,
        token,
        type,
        user_id: body.user_id || null,
        expires_at: expiresAt,
    });

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const userId = typeof body.user_id === 'string' && body.user_id
                ? body.user_id
                : (await getOrCreateLocalAuthUser(email)).id;
            const localToken: LocalAuthToken = {
                id: await localAuthUuid(`token:${type}:${email}:${token}`),
                email,
                user_id: userId,
                token,
                type,
                expires_at: expiresAt,
                used: false,
            };

            for (const storedToken of localAuthTokens.values()) {
                if (storedToken.email === email && storedToken.type === type && !storedToken.used) {
                    storedToken.used = true;
                }
            }
            localAuthTokens.set(localAuthTokenKey(type, email, token), localToken);

            return c.json({
                data: { token, expires_at: expiresAt },
                local_schema_missing: true,
                devOnly: true,
            }, 201);
        }
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: { token, expires_at: expiresAt } }, 201);
});

auth.post('/custom/tokens/validate', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const token = String(body.token || '');
    const email = body.email ? normalizeAuthEmail(body.email) : null;
    if (!token || !isAuthTokenType(body.type)) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid token and type are required' } }, 400);
    }
    const type: AuthTokenType = body.type;

    const db = getSupabaseAdmin(c);
    let query = db
        .from('verification_tokens')
        .select('id, email, user_id, expires_at, used')
        .eq('token', token)
        .eq('type', type);
    if (email) query = query.eq('email', email);

    const { data, error } = await query.maybeSingle();
    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error) && email) {
            const localToken = localAuthTokens.get(localAuthTokenKey(type, email, token));
            if (!localToken || localToken.used || new Date(localToken.expires_at).getTime() < Date.now()) {
                return c.json({ data: null });
            }

            localToken.used = true;
            return c.json({
                data: { email: localToken.email, user_id: localToken.user_id },
                local_schema_missing: true,
                devOnly: true,
            });
        }
        return c.json(dbErrorBody(), 500);
    }

    if (!data || data.used || new Date(data.expires_at).getTime() < Date.now()) {
        return c.json({ data: null });
    }

    await db.from('verification_tokens').update({ used: true }).eq('id', data.id);
    return c.json({ data: { email: data.email, user_id: data.user_id } });
});

// POST /auth/signup — Register new user
// FIX: Strong password validation via Zod (8+ chars, upper/lower/number/special)
auth.post('/signup', validate('json', SignUpSchema), async (c) => {
    const body = c.get('validatedBody') as { email: string; password: string; name?: string };

    const supabase = createSupabaseServiceClient(c.env);

    const { data, error } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        user_metadata: { name: body.name || '', role: 'seller' },
        email_confirm: true,
    });

    if (error) {
        return c.json(errorBody('AUTH_ERROR', 'Unable to create account'), 400);
    }

    // Create user_profiles record
    if (data.user) {
        await supabase.from('user_profiles').insert({
            id: data.user.id,
            email: body.email,
            full_name: body.name || '',
            role: 'seller',
        });
    }

    return c.json({ data: { user: data.user } }, 201);
});

// POST /auth/signin — Email + password login
auth.post('/signin', validate('json', SignInSchema), async (c) => {
    const body = c.get('validatedBody') as { email: string; password: string };

    const supabase = createSupabaseAnonClient(c.env);

    const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
    });

    if (error) {
        return c.json(errorBody('AUTH_ERROR', 'Invalid email or password'), 401);
    }

    return c.json({
        data: {
            user: data.user,
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        },
    });
});

// POST /auth/signin/otp — Request OTP
auth.post('/signin/otp', validate('json', OtpRequestSchema), async (c) => {
    const body = c.get('validatedBody') as { email: string };

    const supabase = createSupabaseAnonClient(c.env);

    const { error } = await supabase.auth.signInWithOtp({ email: body.email });

    if (error) {
        return c.json(errorBody('AUTH_ERROR', 'Unable to send OTP'), 400);
    }

    return c.json({ data: { message: 'OTP sent successfully' } });
});

// POST /auth/signin/otp/verify — Verify OTP
auth.post('/signin/otp/verify', validate('json', OtpVerifySchema), async (c) => {
    const body = c.get('validatedBody') as { email: string; token: string };

    const supabase = createSupabaseAnonClient(c.env);

    const { data, error } = await supabase.auth.verifyOtp({
        email: body.email,
        token: body.token,
        type: 'email',
    });

    if (error) {
        return c.json(errorBody('AUTH_ERROR', 'Invalid or expired OTP'), 401);
    }

    return c.json({
        data: {
            user: data.user,
            session: data.session
                ? {
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token,
                    expires_at: data.session.expires_at,
                }
                : null,
        },
    });
});

// POST /auth/signout — Logout
auth.post('/signout', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ data: { message: 'Signed out' } });
    }

    const supabase = createSupabaseAnonClient(c.env, {
        global: { headers: { Authorization: authHeader } },
    });

    await supabase.auth.signOut();

    return c.json({ data: { message: 'Signed out successfully' } });
});

// POST /auth/password/reset — Request password reset
auth.post('/password/reset', validate('json', PasswordResetRequestSchema), async (c) => {
    const body = c.get('validatedBody') as { email: string };

    const supabase = createSupabaseAnonClient(c.env);

    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
        redirectTo: accountsPasswordResetUrl(c),
    });

    if (error) {
        return c.json(errorBody('AUTH_ERROR', 'Unable to send password reset email'), 400);
    }

    return c.json({ data: { message: 'Password reset email sent' } });
});

// POST /auth/password/update — Update password (requires valid session)
// FIX: Strong password validation (was only checking length >= 6)
auth.post('/password/update', validate('json', PasswordUpdateSchema), async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json(
            { error: { code: 'UNAUTHORIZED', message: 'Token required' } },
            401
        );
    }

    const body = c.get('validatedBody') as { password: string };

    const supabase = createSupabaseAnonClient(c.env, {
        global: { headers: { Authorization: authHeader } },
    });

    const { error } = await supabase.auth.updateUser({ password: body.password });

    if (error) {
        return c.json(errorBody('AUTH_ERROR', 'Unable to update password'), 400);
    }

    return c.json({ data: { message: 'Password updated successfully' } });
});

export default auth;
