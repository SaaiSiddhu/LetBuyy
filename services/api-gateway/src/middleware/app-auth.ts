import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import {
    getLetbuyyInternalAuthSecret,
    sha256Hex,
    verifyAppScopedAccessToken,
    type LetbuyyAppAccessTokenPayload,
} from '@letbuyy/auth-core';
import {
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    parseAppStoreJsonRecord as parseJsonRecord,
} from '@letbuyy/app-engine';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';

export interface AppAuthContext {
    app: {
        appId: string;
        installationId: string;
        storeId: string;
        installedBy: string;
        scopes: string[];
    };
}

export interface AppInstallationAuthRow {
    id?: unknown;
    app_id?: unknown;
    store_id?: unknown;
    installed_by?: unknown;
    status?: unknown;
    scopes_granted?: unknown;
    config?: unknown;
}

export type AppInstallationAuthorizationResult =
    | { ok: true; context: AppAuthContext }
    | { ok: false; status: 401 | 403; code: string; message: string };

declare module 'hono' {
    interface ContextVariableMap {
        appAuth: AppAuthContext;
    }
}

function readBearerToken(value: string | undefined): string | null {
    if (!value?.startsWith('Bearer ')) return null;
    const token = value.slice('Bearer '.length).trim();
    return token || null;
}

function hasRequiredScopes(scopes: string[], requiredScopes: string[]): boolean {
    return requiredScopes.every((scope) => scopes.includes(scope));
}

function authorizationFailure(
    status: 401 | 403,
    code: string,
    message: string,
): Extract<AppInstallationAuthorizationResult, { ok: false }> {
    return { ok: false, status, code, message };
}

export function authorizeVerifiedAppInstallation(input: {
    payload: LetbuyyAppAccessTokenPayload;
    installation: AppInstallationAuthRow | null | undefined;
    tokenHash: string;
    requiredScopes: string[];
}): AppInstallationAuthorizationResult {
    const installation = input.installation;
    if (!installation || stringOrNull(installation.status) !== 'active') {
        return authorizationFailure(401, 'UNAUTHORIZED', 'App installation is not active');
    }

    if (
        stringOrNull(installation.id) !== input.payload.installationId
        || stringOrNull(installation.app_id) !== input.payload.appId
        || stringOrNull(installation.store_id) !== input.payload.storeId
        || stringOrNull(installation.installed_by) !== input.payload.installedBy
    ) {
        return authorizationFailure(401, 'UNAUTHORIZED', 'App token does not match the active installation');
    }

    const grantedScopes = stringArray(installation.scopes_granted);
    if (!hasRequiredScopes(grantedScopes, input.requiredScopes)) {
        return authorizationFailure(403, 'INSUFFICIENT_SCOPE', 'App installation is missing the required scope');
    }

    const tokenScopes = stringArray(input.payload.scopes);
    if (!tokenScopes.every((scope) => grantedScopes.includes(scope))) {
        return authorizationFailure(403, 'INSUFFICIENT_SCOPE', 'App token includes scopes no longer granted to the installation');
    }

    const oauth = parseJsonRecord(parseJsonRecord(installation.config).oauth);
    const isKnownToken = stringOrNull(oauth.access_token_hash) === input.tokenHash
        || stringOrNull(oauth.bridge_token_hash) === input.tokenHash;
    if (!isKnownToken) {
        return authorizationFailure(401, 'UNAUTHORIZED', 'App token has been revoked or replaced');
    }

    return {
        ok: true,
        context: {
            app: {
                appId: input.payload.appId,
                installationId: input.payload.installationId,
                storeId: input.payload.storeId,
                installedBy: input.payload.installedBy,
                scopes: tokenScopes,
            },
        },
    };
}

function appAuthError(status: 401 | 403 | 500, code: string, message: string) {
    return {
        body: { error: { code, message } },
        status,
    };
}

export function appAuthMiddleware(requiredScopes: string[]) {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const token = readBearerToken(c.req.header('Authorization'));
        if (!token) {
            const error = appAuthError(401, 'UNAUTHORIZED', 'App bearer token required');
            return c.json(error.body, error.status);
        }

        const secret = getLetbuyyInternalAuthSecret(c.env);
        if (!secret) {
            const error = appAuthError(500, 'SERVER_MISCONFIGURED', 'App token verification secret is not configured');
            return c.json(error.body, error.status);
        }

        const verification = await verifyAppScopedAccessToken(token, secret, { requiredScopes });
        if (!verification.accepted || !verification.payload) {
            const status = verification.status === 'insufficient_scope' ? 403 : 401;
            const code = verification.status === 'insufficient_scope' ? 'INSUFFICIENT_SCOPE' : 'UNAUTHORIZED';
            const error = appAuthError(status, code, 'App token is invalid or lacks the required scope');
            return c.json(error.body, error.status);
        }
        const payload = verification.payload;

        const db = getSupabaseAdmin(c as Context<{ Bindings: Env }>);
        const { data: installation, error: installError } = await db
            .from('app_installations')
            .select('id, app_id, store_id, installed_by, status, scopes_granted, config')
            .eq('id', payload.installationId)
            .eq('app_id', payload.appId)
            .eq('store_id', payload.storeId)
            .eq('status', 'active')
            .maybeSingle();

        if (installError) {
            const error = appAuthError(500, 'DB_ERROR', 'Database operation failed');
            return c.json(error.body, error.status);
        }

        const tokenHash = await sha256Hex(token);
        const authorization = authorizeVerifiedAppInstallation({
            payload,
            installation: installation as AppInstallationAuthRow | null,
            tokenHash,
            requiredScopes,
        });

        if (!authorization.ok) {
            return c.json(
                { error: { code: authorization.code, message: authorization.message } },
                authorization.status,
            );
        }

        c.set('appAuth', authorization.context);
        await next();
    });
}
