import { createMiddleware } from 'hono/factory';
import {
    createSupabaseAnonClient,
    createSupabaseServiceClient,
} from '@letbuyy/infrastructure/supabase-adapter';
import {
    getLetbuyyInternalAuthSecret,
    getLetbuyyRoleCategories,
    isAuthUuid,
    isFreshLetbuyyInternalTimestamp,
    isSafeAuthEmail,
    normalizeLetbuyyRoleAssignments,
    verifyLetbuyyInternalSessionHeaders,
    verifyLetbuyySignedPayload,
    type LetbuyyRoleAssignment,
    type RbacRoleCategory,
} from '@letbuyy/auth-core';
import type { Context } from 'hono';
import type { Env } from '../index';
import { timingSafeEqualText } from '../lib/crypto';

interface AuthContext {
    user: {
        id: string;
        email: string;
        role?: string;
        roles?: LetbuyyRoleAssignment[];
        roleCategories?: RbacRoleCategory[];
        storeId?: string;
        authSource?: 'supabase' | 'internal-sso' | 'platform-console';
    };
}

declare module 'hono' {
    interface ContextVariableMap {
        auth: AuthContext;
        requestStartTime: number;
    }
}

function buildAuthContextUser(input: {
    id: string;
    email: string;
    role?: unknown;
    roles?: unknown;
    storeId?: string;
    authSource: 'supabase' | 'internal-sso' | 'platform-console';
}): AuthContext['user'] {
    const roleAssignments = normalizeLetbuyyRoleAssignments([
        input.role,
        ...(Array.isArray(input.roles) ? input.roles : [input.roles]),
    ]);

    return {
        id: input.id,
        email: input.email,
        role: roleAssignments[0]?.name || (typeof input.role === 'string' ? input.role : undefined),
        roles: roleAssignments,
        roleCategories: getLetbuyyRoleCategories(roleAssignments),
        storeId: input.storeId,
        authSource: input.authSource,
    };
}

function readBearerToken(value: string | undefined): string | null {
    if (!value?.startsWith('Bearer ')) return null;
    return value.slice('Bearer '.length).trim() || null;
}

function isReadOnlyPlatformConsoleOperationsRequest(c: Context<{ Bindings: Env }>): boolean {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return false;
    if (!c.req.path.startsWith('/v1/operations/')) return false;

    const expectedToken = c.env.PLATFORM_CONSOLE_API_TOKEN;
    if (!expectedToken) return false;

    const token = readBearerToken(c.req.header('Authorization')) || c.req.header('X-Platform-Console-Token');
    return Boolean(token && timingSafeEqualText(token, expectedToken));
}

async function getInternalAuthContext(c: Context<{ Bindings: Env }>): Promise<AuthContext | null> {
    const secret = getLetbuyyInternalAuthSecret(c.env);
    if (!secret) return null;

    const userId = c.req.header('X-LetBuyy-Internal-User-ID');
    const email = c.req.header('X-LetBuyy-Internal-Email');
    const storeId = c.req.header('X-LetBuyy-Internal-Store-ID') || undefined;
    const timestampHeader = c.req.header('X-LetBuyy-Internal-Timestamp');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');

    if (!userId || !isAuthUuid(userId) || !isSafeAuthEmail(email) || !timestampHeader || !signature) {
        return null;
    }

    if (storeId && !isAuthUuid(storeId)) {
        return null;
    }

    if (!isFreshLetbuyyInternalTimestamp(timestampHeader)) {
        return null;
    }

    const payload = `${userId}.${email}.${storeId || ''}.${timestampHeader}`;
    if (!(await verifyLetbuyySignedPayload(secret, payload, signature))) {
        return null;
    }

    return {
        user: buildAuthContextUser({
            id: userId,
            email,
            storeId,
            authSource: 'internal-sso',
        }),
    };
}

async function getInternalSessionAuthContext(c: Context<{ Bindings: Env }>): Promise<AuthContext | null> {
    const secret = getLetbuyyInternalAuthSecret(c.env);
    if (!secret) return null;

    const sessionToken = c.req.header('X-LetBuyy-Internal-Session-Token');
    const timestampHeader = c.req.header('X-LetBuyy-Internal-Timestamp');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');
    const sessionVerification = await verifyLetbuyyInternalSessionHeaders({
        sessionToken,
        timestamp: timestampHeader,
        signature,
        secret,
    });

    if (!sessionVerification.accepted || !sessionVerification.token) {
        return null;
    }

    const supabase = createSupabaseServiceClient(c.env);

    const { data: session } = await supabase
        .from('sessions')
        .select('id, user_id, expires_at')
        .eq('token', sessionVerification.token)
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

    if (!user || !isSafeAuthEmail(user.email)) {
        return null;
    }

    await supabase
        .from('sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('id', session.id);

    return {
        user: buildAuthContextUser({
            id: user.id,
            email: user.email,
            authSource: 'internal-sso',
        }),
    };
}

/**
 * Standard auth middleware — requires a valid Supabase Bearer token or a
 * signed internal SSO identity from a server-side LetBuyy app boundary.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        if (isReadOnlyPlatformConsoleOperationsRequest(c)) {
            c.set('auth', {
                user: buildAuthContextUser({
                    id: '00000000-0000-4000-8000-000000000000',
                    email: 'platform-console@letbuyy.local',
                    role: 'super_admin',
                    authSource: 'platform-console',
                }),
            });
            await next();
            return;
        }

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
                user: buildAuthContextUser({
                    id: user.id,
                    email: user.email!,
                    // Prefer server-controlled app_metadata over client-writable
                    // user_metadata. user_metadata can be set by the user via
                    // auth.updateUser, so it must never be the source of truth for
                    // privileged role/category decisions (those are DB-backed in rbac.ts).
                    role: user.app_metadata?.role ?? user.user_metadata?.role,
                    roles: user.app_metadata?.roles ?? user.user_metadata?.roles,
                    authSource: 'supabase',
                }),
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
                        user: buildAuthContextUser({
                            id: user.id,
                            email: user.email!,
                            role: user.app_metadata?.role ?? user.user_metadata?.role,
                            roles: user.app_metadata?.roles ?? user.user_metadata?.roles,
                            authSource: 'supabase',
                        }),
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
