import { z } from 'zod';
import { MERCHANT_NATIVE_ENVIRONMENTS, merchantNativeCallback } from './merchant-native-registry';
export { merchantNativeCallback } from './merchant-native-registry';
export type { MerchantNativeEnvironment } from './merchant-native-registry';

/** First-party public clients only (Constitution Amendment 3). No OIDC activation. */
export const MERCHANT_NATIVE_REQUEST_TTL_SECONDS = 900;
export const MERCHANT_NATIVE_CODE_TTL_SECONDS = 60;
export const MerchantNativeEnvironmentSchema = z.enum(MERCHANT_NATIVE_ENVIRONMENTS);
export const MerchantNativePurposeSchema = z.enum(['login', 'signup', 'create_store', 'switch_account', 'manage_security']);
export const MerchantNativeClientSchema = z.enum(['merchant_android', 'merchant_ios']);
export const MerchantNativeCallbackSchema = z.enum(['android_https', 'ios_session']);
export const MerchantNativeSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const MerchantNativeRequestSchema = z.object({
    clientId: MerchantNativeClientSchema,
    callbackId: MerchantNativeCallbackSchema,
    environment: MerchantNativeEnvironmentSchema,
    purpose: MerchantNativePurposeSchema,
    challenge: MerchantNativeSecretSchema,
    state: MerchantNativeSecretSchema,
}).strict();
export const MerchantNativeExchangeSchema = MerchantNativeRequestSchema.pick({ clientId: true, callbackId: true, environment: true, state: true }).extend({
    requestId: z.uuid(),
    code: MerchantNativeSecretSchema,
    verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
}).strict();
export const MerchantNativeCancelSchema = z.object({ requestId: z.uuid(), managementProof: MerchantNativeSecretSchema }).strict();
export const MerchantNativeBindingSchema = z.object({ requestId: z.uuid(), launchProof: MerchantNativeSecretSchema, browserProof: MerchantNativeSecretSchema }).strict();
export const MerchantNativeCompletionSchema = z.object({ requestId: z.uuid(), browserProof: MerchantNativeSecretSchema, sessionToken: z.string().min(32).max(8192), codeHash: z.string().regex(/^[a-f0-9]{64}$/), siteId: z.uuid().optional() }).strict();

export async function merchantNativeHash(value: string): Promise<string> {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function merchantNativeChallenge(verifier: string): Promise<string> {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseMerchantNativeCallback(url: string, expected: { redirectUri: string; requestId: string; state: string }): { code: string } | null {
    try {
        const actual = new URL(url), redirect = new URL(expected.redirectUri);
        if (url.split('?')[0] !== expected.redirectUri || actual.protocol !== redirect.protocol || actual.host !== redirect.host || actual.pathname !== redirect.pathname
            || actual.username || actual.password || actual.hash || actual.port !== redirect.port) return null;
        const allowed = ['request', 'state', 'code'];
        if ([...actual.searchParams.keys()].some(key => !allowed.includes(key)) || allowed.some(key => actual.searchParams.getAll(key).length !== 1)) return null;
        const code = actual.searchParams.get('code');
        return actual.searchParams.get('request') === expected.requestId && actual.searchParams.get('state') === expected.state
            && MerchantNativeSecretSchema.safeParse(code).success ? { code: code! } : null;
    } catch { return null; }
}

/** A package-bound Android launch of the SAME registered callback, not another
 * redirect authority. Ordinary same-origin web navigation can stay in Chrome,
 * particularly for the debug loopback host which cannot use Digital Asset Links.
 * No caller-controlled package, component, extras or fallback origin is accepted.
 */
export function merchantNativeAndroidReturnIntent(callback: string): string | null {
    try {
        if (callback.length > 1024) return null;
        const redirectUri = callback.split('?')[0];
        if (!MERCHANT_NATIVE_ENVIRONMENTS.some(environment => merchantNativeCallback('merchant_android', 'android_https', environment) === redirectUri)) return null;
        const actual = new URL(callback), requestId = actual.searchParams.get('request'), state = actual.searchParams.get('state');
        if (!z.uuid().safeParse(requestId).success || !MerchantNativeSecretSchema.safeParse(state).success
            || !parseMerchantNativeCallback(callback, { redirectUri, requestId: requestId!, state: state! })) return null;
        const query = new URLSearchParams({ request: requestId!, state: state!, code: actual.searchParams.get('code')! });
        return `intent://${actual.host}${actual.pathname}?${query}#Intent;scheme=${actual.protocol.slice(0, -1)};package=com.letbuyy.store;end`;
    } catch { return null; }
}
