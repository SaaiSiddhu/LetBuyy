import { createMiddleware } from 'hono/factory';
import {
    createSupabaseAnonClient,
    createSupabaseServiceClient,
} from '@letbuyy/infrastructure/supabase-adapter';
import type { Context } from 'hono';
import type { Env } from '../index';

interface AuthContext {
    user: {
        id: string;
        email: string;
        role?: string;
        storeId?: string;
        authSource?: 'supabase' | 'internal-sso';
    };
}

declare module 'hono' {
    interface ContextVariableMap {
        auth: AuthContext;
        requestStartTime: number;
    }
}

const INTERNAL_AUTH_MAX_AGE_MS = 5 * 60 * 1000;

const textEncoder = new TextEncoder();

function getInternalAuthSecret(env: Env): string | undefined {
    return env.INTERNAL_API_SECRET || env.AUTH_SECRET;
}

function isUuid(value: string | undefined): value is string {
    return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSafeEmail(value: string | undefined): value is string {
    return !!value && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSafeSessionToken(value: string | undefined): value is string {
    return !!value && value.length >= 32 && value.length <= 4096 && /^[A-Za-z0-9._~-]+$/.test(value);
}

function bytesToHex(bytes: ArrayBuffer): string {
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(left: string, right: string): boolean {
    if (left.length !== right.length) return false;

    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return mismatch === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
    return bytesToHex(signature);
}

async function getInternalAuthContext(c: Context<{ Bindings: Env }>): Promise<AuthContext | null> {
    const secret = getInternalAuthSecret(c.env);
    if (!secret) return null;

    const userId = c.req.header('X-LetBuyy-Internal-User-ID');
    const email = c.req.header('X-LetBuyy-Internal-Email');
    const storeId = c.req.header('X-LetBuyy-Internal-Store-ID') || undefined;
    const timestampHeader = c.req.header('X-LetBuyy-Internal-Timestamp');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');

    if (!isUuid(userId) || !isSafeEmail(email) || !timestampHeader || !signature) {
        return null;
    }

    if (storeId && !isUuid(storeId)) {
        return null;
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > INTERNAL_AUTH_MAX_AGE_MS) {
        return null;
    }

    const payload = `${userId}.${email}.${storeId || ''}.${timestampHeader}`;
    const expectedSignature = await hmacSha256Hex(secret, payload);

    if (!timingSafeEqualHex(expectedSignature, signature)) {
        return null;
    }

    return {
        user: {
            id: userId,
            email,
            storeId,
            authSource: 'internal-sso',
        },
    };
}

async function getInternalSessionAuthContext(c: Context<{ Bindings: Env }>): Promise<AuthContext | null> {
    const secret = getInternalAuthSecret(c.env);
    if (!secret) return null;

    const sessionToken = c.req.header('X-LetBuyy-Internal-Session-Token');
    const timestampHeader = c.req.header('X-LetBuyy-Internal-Timestamp');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');

    if (!isSafeSessionToken(sessionToken) || !timestampHeader || !signature) {
        return null;
    }

    const timestamp = Number(timestampHeader);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > INTERNAL_AUTH_MAX_AGE_MS) {
        return null;
    }

    const payload = `session.${sessionToken}.${timestampHeader}`;
    const expectedSignature = await hmacSha256Hex(secret, payload);
    if (!timingSafeEqualHex(expectedSignature, signature)) {
        return null;
    }

    const supabase = createSupabaseServiceClient(c.env);

    const { data: session } = await supabase
        .from('sessions')
        .select('id, user_id, expires_at')
        .eq('token', sessionToken)
        .maybeSingle();

    if (!session) {
        return null;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
        await supabase.from('sessions').delete().eq('id', session.id);
        return null;
    }

    const { data: user } = await supabase
        .from('users_custom')
        .select('id, email')
        .eq('id', session.user_id)
        .maybeSingle();

    if (!user || !isSafeEmail(user.email)) {
        return null;
    }

    await supabase
        .from('sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('id', session.id);

    return {
        user: {
            id: user.id,
            email: user.email,
            authSource: 'internal-sso',
        },
    };
}

/**
 * Standard auth middleware — requires a valid Supabase Bearer token or a
 * signed internal SSO identity from a server-side LetBuyy app boundary.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        const authHeader = c.req.header('Authorization');

        if (!authHeader?.startsWith('Bearer ')) {
            const sessionAuth = await getInternalSessionAuthContext(c);
            if (sessionAuth) {
                c.set('auth', sessionAuth);
                await next();
                return;
            }

            const internalAuth = await getInternalAuthContext(c);
            if (internalAuth) {
                c.set('auth', internalAuth);
                await next();
                return;
            }

            return c.json(
                {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Missing or invalid authorization header',
                    },
                },
                401
            );
        }

        const token = authHeader.slice(7);

        try {
            const supabase = createSupabaseAnonClient(c.env);

            const {
                data: { user },
                error,
            } = await supabase.auth.getUser(token);

            if (error || !user) {
                return c.json(
                    {
                        error: {
                            code: 'UNAUTHORIZED',
                            message: 'Invalid or expired token',
                        },
                    },
                    401
                );
            }

            c.set('auth', {
                user: {
                    id: user.id,
                    email: user.email!,
                    role: user.user_metadata?.role,
                    authSource: 'supabase',
                },
            });

            await next();
        } catch (err) {
            console.error(JSON.stringify({
                level: 'error',
                service: 'letbuyy-api',
                route: c.req.path,
                method: c.req.method,
                status_code: 401,
                error: err instanceof Error ? err.message : 'Authentication failed',
            }));
            return c.json(
                {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication failed',
                    },
                },
                401
            );
        }
    }
);

/**
 * Optional auth middleware — does NOT reject unauthenticated requests.
 * If a valid token is present, sets auth context. Otherwise continues.
 * Useful for public routes that enhance behavior for logged-in users.
 */
export const optionalAuth = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        const authHeader = c.req.header('Authorization');

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            try {
                const supabase = createSupabaseAnonClient(c.env);
                const {
                    data: { user },
                } = await supabase.auth.getUser(token);

                if (user) {
                    c.set('auth', {
                        user: {
                            id: user.id,
                            email: user.email!,
                            role: user.user_metadata?.role,
                        },
                    });
                }
            } catch {
                // Silently continue without auth context
            }
        } else {
            const sessionAuth = await getInternalSessionAuthContext(c);
            if (sessionAuth) {
                c.set('auth', sessionAuth);
            } else {
                const internalAuth = await getInternalAuthContext(c);
                if (internalAuth) {
                    c.set('auth', internalAuth);
                }
            }
        }

        await next();
    }
);
