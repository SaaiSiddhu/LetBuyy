import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { decodeJwt } from 'jose';
import {
    MerchantNativeRequestSchema, MerchantNativeBindingSchema, MerchantNativeCompletionSchema,
    MerchantNativeExchangeSchema, MerchantNativeCancelSchema, MerchantNativeSecretSchema,
    merchantNativeCallback, merchantNativeChallenge, merchantNativeHash,
} from '@letbuyy/auth-core';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';
import { AppError } from '../lib/errors';
import { validateMerchantSessionToken } from '../lib/merchant-session';
import { validateIdentityIssuedMerchantSessionToken } from '../lib/identity-session-verifier';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Create = MerchantNativeRequestSchema.extend({ id: z.uuid(), launchHash: Hash, managementHash: Hash, sessionToken: z.string().min(32).max(8192).optional() }).strict();
const Approve = z.object({ requestId: z.uuid(), browserProof: MerchantNativeSecretSchema, sessionToken: z.string().min(32).max(8192) }).strict();
const Exchange = MerchantNativeExchangeSchema.extend({ token: z.string().min(32).max(4096).optional() }).strict();

/** Accounts is the issuer; this adapter only validates and persists its narrow requests. */
export function registerMerchantMobileRoutes(auth: Hono<{ Bindings: Env }>, accountsOnly: (c: Context<{ Bindings: Env }>) => Promise<Response | null>) {
    auth.use('/custom/mobile/*', async (c, next) => {
        c.header('Cache-Control', 'private, no-store');
        const denied = await accountsOnly(c);
        if (denied) return denied;
        if (Number(c.req.header('Content-Length') || 0) > 16384) throw new AppError('Request is too large', 413, 'INVALID_INPUT');
        await next();
    });
    async function rpc(c: Context<{ Bindings: Env }>, name: string, args: Record<string, unknown>) {
        const { data, error } = await getSupabaseAdmin(c).rpc(name, args);
        if (error) throw new AppError('Account sign-in is temporarily unavailable. Please retry.', 503, 'MOBILE_AUTH_UNAVAILABLE');
        if (!data) throw new AppError('This sign-in request expired or is no longer valid. Start again from the app.', 400, 'MOBILE_AUTH_INVALID');
        return data;
    }
    function body<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
        const parsed = schema.safeParse(input);
        if (!parsed.success) throw new AppError('Invalid account request', 400, 'INVALID_INPUT');
        return parsed.data;
    }
    auth.post('/custom/mobile/requests', async c => {
        const input = body(Create, await c.req.json().catch(() => null));
        const estate = String(c.env.APP_ENV || c.env.ENVIRONMENT || 'production');
        const environment = ['local', 'test', 'development'].includes(estate) ? 'development' : estate;
        const redirectUri = merchantNativeCallback(input.clientId, input.callbackId, input.environment);
        if (environment !== input.environment || !redirectUri) throw new AppError('Invalid app configuration', 400, 'MOBILE_CLIENT_INVALID');
        let expectedUserId: string | undefined;
        if (input.purpose === 'create_store' || input.purpose === 'manage_security') {
            const session = await validateMerchantSessionToken(getSupabaseAdmin(c), input.sessionToken || '');
            if (session.status === 'error') throw new AppError('Account verification is unavailable', 503, 'SESSION_UNAVAILABLE');
            if (!session.accepted || !session.userId) throw new AppError('Sign in again to continue', 401, 'UNAUTHORIZED');
            expectedUserId = session.userId;
        }
        const { sessionToken: _sessionToken, ...request } = input;
        return c.json({ data: await rpc(c, 'create_merchant_mobile_request', { p_input: { ...request, redirectUri, expectedUserId } }) }, 201);
    });
    auth.post('/custom/mobile/bind', async c => {
        const input = body(MerchantNativeBindingSchema, await c.req.json().catch(() => null));
        return c.json({ data: await rpc(c, 'bind_merchant_mobile_request', { p_request_id: input.requestId, p_launch_hash: await merchantNativeHash(input.launchProof), p_browser_hash: await merchantNativeHash(input.browserProof) }) });
    });
    auth.post('/custom/mobile/approve', async c => {
        const input = body(Approve, await c.req.json().catch(() => null));
        return c.json({ data: await rpc(c, 'approve_merchant_mobile_request', { p_request_id: input.requestId, p_browser_hash: await merchantNativeHash(input.browserProof), p_session_token: input.sessionToken }) });
    });
    auth.post('/custom/mobile/complete', async c => {
        const input = body(MerchantNativeCompletionSchema, await c.req.json().catch(() => null));
        return c.json({ data: await rpc(c, 'complete_merchant_mobile_request', { p_request_id: input.requestId, p_browser_hash: await merchantNativeHash(input.browserProof), p_session_token: input.sessionToken, p_code_hash: input.codeHash, p_site_id: input.siteId || null }) });
    });
    auth.post('/custom/mobile/exchange', async c => {
        const input = body(Exchange, await c.req.json().catch(() => null));
        const proof = { requestId: input.requestId, clientId: input.clientId, callbackId: input.callbackId, environment: input.environment, state: input.state, codeHash: await merchantNativeHash(input.code), challenge: await merchantNativeChallenge(input.verifier) };
        const context = await rpc(c, 'inspect_merchant_mobile_exchange', { p_input: proof }) as { userId: string };
        if (!input.token) return c.json({ data: context }); // Private signing preparation; never public.
        const verified = await validateIdentityIssuedMerchantSessionToken(c.env, input.token, context.userId);
        if (!verified.ok) throw new AppError('Account session issuance is unavailable', 503, 'IDENTITY_ISSUER_REQUIRED');
        const claims = decodeJwt(input.token);
        return c.json({ data: await rpc(c, 'exchange_merchant_mobile_request', { p_input: proof, p_user_id: context.userId, p_token: input.token, p_jti: claims.jti, p_expires_at: new Date(claims.exp! * 1000).toISOString() }) });
    });
    auth.post('/custom/mobile/cancel', async c => {
        const input = body(MerchantNativeCancelSchema, await c.req.json().catch(() => null));
        const { data, error } = await getSupabaseAdmin(c).rpc('cancel_merchant_mobile_request', { p_request_id: input.requestId, p_management_hash: await merchantNativeHash(input.managementProof) });
        if (error) throw new AppError('Cancellation is unavailable', 503, 'MOBILE_AUTH_UNAVAILABLE');
        return c.json({ data: { cancelled: data === true } });
    });
}
