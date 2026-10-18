import { createMiddleware } from 'hono/factory';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    getLetbuyyRoleCategories,
    isAuthUuid,
    isSafeAuthEmail,
    normalizeLetbuyyRoleAssignments,
    type LetbuyyRoleAssignment,
    type RbacRoleCategory,
} from '@letbuyy/auth-core';
import type { Context } from 'hono';
import type { Env } from '../index';
import {
    AUTH_VERIFIER_REGISTRY,
    type AuthVerifierName,
} from '../identity-foundation/auth-verifier-registry';
import { verifyInternalIdentityPayload, verifyInternalSessionHeaders } from '../lib/internal-auth';
import { AppError } from '../lib/errors';
import { validateMerchantSessionToken } from '../lib/merchant-session';

interface AuthContext {
    user: {
        id: string;
        email: string;
        role?: string;
        roles?: LetbuyyRoleAssignment[];
        roleCategories?: RbacRoleCategory[];
        storeId?: string;
        authSource?: 'supabase' | 'internal-sso';
    };
}

export const authMiddlewareVerifierRegistry = AUTH_VERIFIER_REGISTRY;

interface GatewayAuthVerifier {
    name: AuthVerifierName;
    shouldAttempt(c: Context<{ Bindings: Env }>, authHeader: string | undefined): boolean;
    verify(c: Context<{ Bindings: Env }>, authHeader: string | undefined): Promise<AuthContext | null>;
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
    authSource: 'supabase' | 'internal-sso';
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

async function getInternalAuthContext(c: Context<{ Bindings: Env }>): Promise<AuthContext | null> {
    const userId = c.req.header('X-LetBuyy-Internal-User-ID');
    const email = c.req.header('X-LetBuyy-Internal-Email');
    const storeId = c.req.header('X-LetBuyy-Internal-Store-ID') || undefined;
    const timestampHeader = c.req.header('X-LetBuyy-Internal-Timestamp');
    const jti = c.req.header('X-LetBuyy-Internal-JTI');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');

    if (!userId || !isAuthUuid(userId) || !isSafeAuthEmail(email) || !timestampHeader || !jti || !signature) {
        return null;
    }

    if (storeId && !isAuthUuid(storeId)) {
        return null;
    }

    if (!(await verifyInternalIdentityPayload(c.env, {
        userId,
        email,
        storeId,
        timestamp: timestampHeader,
        jti,
        signature,
    }))) {
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
    const sessionToken = c.req.header('X-LetBuyy-Internal-Session-Token');
    const timestampHeader = c.req.header('X-LetBuyy-Internal-Timestamp');
    const jti = c.req.header('X-LetBuyy-Internal-JTI');
    const signature = c.req.header('X-LetBuyy-Internal-Signature');
    const sessionVerification = await verifyInternalSessionHeaders(c.env, {
        sessionToken,
        timestamp: timestampHeader,
        jti,
        signature,
    });

    if (!sessionVerification.accepted || !sessionVerification.token) {
        return null;
    }

    const supabase = createSupabaseServiceClient(c.env);

    try {
        const session = await validateMerchantSessionToken(supabase, sessionVerification.token, { rotate: false });
        if (session.status === 'error') throw new Error('Merchant session lookup failed');
        if (!session.accepted || !session.userId) return null;

        const { data: user, error } = await supabase
            .from('users_custom')
            .select('id, email')
            .eq('id', session.userId)
            .maybeSingle();
        if (error) throw new Error('Merchant account lookup failed');
        if (user && isSafeAuthEmail(user.email)) {
            return {
                user: buildAuthContextUser({
                    id: user.id,
                    email: user.email,
                    authSource: 'internal-sso',
                }),
            };
        }
    } catch {
        // Local and hosted requests share the same authority. A revoked session
        // never becomes a development identity; outages remain retryable errors.
        throw new AppError('Your merchant session could not be checked. Try again shortly.', 503, 'MERCHANT_SESSION_UNAVAILABLE');
    }

    return null;
}

export const legacyGatewayAuthVerifiers: GatewayAuthVerifier[] = [
    {
        name: 'internal-session-hmac',
        shouldAttempt: (c) => Boolean(c.req.header('X-LetBuyy-Internal-Session-Token')),
        verify: (c) => getInternalSessionAuthContext(c),
    },
    {
        name: 'internal-identity-hmac',
        shouldAttempt: (c) => Boolean(c.req.header('X-LetBuyy-Internal-User-ID')),
        verify: (c) => getInternalAuthContext(c),
    },
];

export function legacyGatewayAuthVerifierNames(): AuthVerifierName[] {
    return legacyGatewayAuthVerifiers.map((verifier) => verifier.name);
}

/**
 * Standard auth middleware — requires a signed internal SSO identity
 * (session or identity assertion) from a server-side LetBuyy app boundary.
 * No verifier here accepts a raw `Authorization: Bearer` token; identity-
 * platform is the sole issuer and every caller reaches the gateway through
 * an internal HMAC-signed header instead (Phase N3 closed ART-05).
 */
export const authMiddleware = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        if (c.get('auth')) {
            await next();
            return;
        }

        const authHeader = c.req.header('Authorization');

        for (const verifier of legacyGatewayAuthVerifiers) {
            if (!verifier.shouldAttempt(c, authHeader)) continue;

            const auth = await verifier.verify(c, authHeader);
            if (!auth) continue;

            c.set('auth', auth);
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
);

/**
 * Optional auth middleware — does NOT reject unauthenticated requests.
 * If a valid token is present, sets auth context. Otherwise continues.
 * Useful for public routes that enhance behavior for logged-in users.
 */
export const optionalAuth = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        const sessionAuth = await getInternalSessionAuthContext(c);
        if (sessionAuth) {
            c.set('auth', sessionAuth);
        } else {
            const internalAuth = await getInternalAuthContext(c);
            if (internalAuth) {
                c.set('auth', internalAuth);
            }
        }

        await next();
    }
);
