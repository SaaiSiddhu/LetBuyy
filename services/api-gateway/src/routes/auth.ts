import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    createSupabaseAnonClient,
    createSupabaseServiceClient,
} from '@letbuyy/infrastructure/supabase-adapter';
import { resolveCustomUser } from '../lib/auth-user';
import { bytesToHex, verifyInternalAppRequest } from '../lib/internal-auth';
import { dbErrorBody, errorBody, getSupabaseAdmin } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
    SignUpSchema,
    SignInSchema,
    OtpRequestSchema,
    OtpVerifySchema,
    PasswordResetRequestSchema,
    PasswordUpdateSchema,
} from '../schemas/auth.schema';
import { validateSubdomainFormat } from '@letbuyy/tenant-core';

const auth = new Hono<{ Bindings: import('../index').Env }>();

type TokenType = 'email_verify' | 'magic_link' | 'password_reset';

const TOKEN_EXPIRY_MS: Record<TokenType, number> = {
    email_verify: 60 * 60 * 1000,
    magic_link: 15 * 60 * 1000,
    password_reset: 60 * 60 * 1000,
};

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

async function requireAccountsInternal(c: Context<{ Bindings: import('../index').Env }>) {
    if (await verifyInternalAppRequest(c, 'accounts')) return null;
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid internal auth signature' } }, 401);
}

function randomHex(byteCount: number): string {
    const bytes = new Uint8Array(byteCount);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes.buffer);
}

function randomOtp(): string {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return (100000 + (bytes[0] % 900000)).toString();
}

function parseDeviceName(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    let browser = 'Unknown Browser';
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('edg')) browser = 'Edge';

    let os = 'Unknown OS';
    if (ua.includes('iphone')) os = 'iPhone';
    else if (ua.includes('ipad')) os = 'iPad';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('linux')) os = 'Linux';

    return `${browser} on ${os}`;
}

async function getOrCreateDevice(db: ReturnType<typeof getSupabaseAdmin>, userId: string, fingerprint: string, userAgent: string) {
    const deviceName = parseDeviceName(userAgent);
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

// GET /auth/custom/session — Validate LetBuyy opaque session token via worker auth middleware
auth.get('/custom/session', authMiddleware, async (c) => {
    const authContext = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, authContext.user);

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
    });
});

auth.post('/custom/users/by-email', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const email = String(body.email || '').toLowerCase().trim();
    if (!email) {
        return c.json({ error: { code: 'VALIDATION', message: 'email is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('users_custom')
        .select('id, email, password_hash, email_verified, full_name, avatar_url')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: data || null });
});

auth.post('/custom/users/first-store', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    if (!UUID_REGEX.test(userId)) {
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
        return c.json(
            { valid: false, reason: 'error', message: 'Unable to verify availability' },
            500
        );
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
    const email = String(body.email || '').toLowerCase().trim();
    if (!email) {
        return c.json({ error: { code: 'VALIDATION', message: 'email is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: existing } = await db
        .from('users_custom')
        .select('id, email, email_verified, full_name, avatar_url')
        .eq('email', email)
        .maybeSingle();

    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };
    if (body.email_verified !== undefined) updates.email_verified = Boolean(body.email_verified);
    if (typeof body.full_name === 'string') updates.full_name = body.full_name;
    if (typeof body.avatar_url === 'string') updates.avatar_url = body.avatar_url;
    if (typeof body.auth_provider === 'string') updates.auth_provider = body.auth_provider;

    if (existing) {
        const { data, error } = await db
            .from('users_custom')
            .update(updates)
            .eq('id', existing.id)
            .select('id, email, email_verified, full_name, avatar_url')
            .single();

        if (error) {
            return c.json(dbErrorBody(), 500);
        }
        return c.json({ data });
    }

    const { data, error } = await db
        .from('users_custom')
        .insert({
            email,
            email_verified: Boolean(body.email_verified),
            full_name: typeof body.full_name === 'string' ? body.full_name : null,
            avatar_url: typeof body.avatar_url === 'string' ? body.avatar_url : null,
            auth_provider: typeof body.auth_provider === 'string' ? body.auth_provider : 'email',
        })
        .select('id, email, email_verified, full_name, avatar_url')
        .single();

    if (error) {
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
    else if (body.email) query = query.eq('email', String(body.email).toLowerCase().trim());
    else return c.json({ error: { code: 'VALIDATION', message: 'user_id or email is required' } }, 400);

    const { data, error } = await query.select('id, email, full_name, avatar_url, email_verified').single();

    if (error || !data) {
        return c.json(errorBody('NOT_FOUND', 'User not found'), 404);
    }

    return c.json({ data });
});

auth.post('/custom/users/set-password', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    const email = String(body.email || '').toLowerCase().trim();
    const passwordHash = String(body.password_hash || '');

    if (!userId || !email || !passwordHash) {
        return c.json({ error: { code: 'VALIDATION', message: 'user_id, email, and password_hash are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: user } = await db
        .from('users_custom')
        .select('id, email, email_verified, full_name, avatar_url')
        .eq('id', userId)
        .eq('email', email)
        .maybeSingle();

    if (!user) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    }

    if (!user.email_verified) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Email not verified' } }, 403);
    }

    const { data, error } = await db
        .from('users_custom')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id, email, full_name, avatar_url')
        .single();

    if (error) {
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
    } catch {
        return c.json(dbErrorBody('Device registration failed'), 500);
    }
});

auth.post('/custom/devices/trusted', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const userId = String(body.user_id || '');
    const fingerprint = String(body.fingerprint || '');
    if (!UUID_REGEX.test(userId) || !fingerprint) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid user_id and fingerprint are required' } }, 400);
    }

    const { data, error } = await getSupabaseAdmin(c)
        .from('devices')
        .select('trusted')
        .eq('user_id', userId)
        .eq('fingerprint', fingerprint)
        .maybeSingle();

    if (error) {
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
    if (!userId) {
        return c.json({ error: { code: 'VALIDATION', message: 'user_id is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const token = randomHex(32);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    const { error } = await db.from('sessions').insert({
        user_id: userId,
        device_id: deviceId,
        token,
        expires_at: expiresAt,
    });

    if (error) {
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
    const email = String(body.email || '').toLowerCase().trim();
    const type = body.type as TokenType;
    if (!email || !TOKEN_EXPIRY_MS[type]) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid email and token type are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    await db.from('verification_tokens').update({ used: true }).eq('email', email).eq('type', type).eq('used', false);

    const token = type === 'email_verify' && body.otp === true ? randomOtp() : randomHex(32);
    const expiresAt = new Date(Date.now() + (body.otp === true ? OTP_EXPIRY_MS : TOKEN_EXPIRY_MS[type])).toISOString();
    const { error } = await db.from('verification_tokens').insert({
        email,
        token,
        type,
        user_id: body.user_id || null,
        expires_at: expiresAt,
    });

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: { token, expires_at: expiresAt } }, 201);
});

auth.post('/custom/tokens/validate', async (c) => {
    const unauthorized = await requireAccountsInternal(c);
    if (unauthorized) return unauthorized;

    const body = await c.req.json();
    const token = String(body.token || '');
    const type = body.type as TokenType;
    const email = body.email ? String(body.email).toLowerCase().trim() : null;
    if (!token || !TOKEN_EXPIRY_MS[type]) {
        return c.json({ error: { code: 'VALIDATION', message: 'valid token and type are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    let query = db
        .from('verification_tokens')
        .select('id, email, user_id, expires_at, used')
        .eq('token', token)
        .eq('type', type);
    if (email) query = query.eq('email', email);

    const { data } = await query.maybeSingle();
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
        redirectTo: 'https://accounts.letbuyy.store/reset-password',
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
