export const MERCHANT_NATIVE_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type MerchantNativeEnvironment = typeof MERCHANT_NATIVE_ENVIRONMENTS[number];

/** Exact, fixed first-party redirect registry, shared with the generated Dart client. */
export function merchantNativeCallback(clientId: string, callbackId: string, environment: MerchantNativeEnvironment): string | null {
    if (clientId === 'merchant_ios' && callbackId === 'ios_session') {
        return `com.letbuyy.store.accounts${environment === 'production' ? '' : `.${environment}`}://auth/callback`;
    }
    if (clientId === 'merchant_android' && callbackId === 'android_https') {
        const origin = { production: 'https://accounts.letbuyy.com', staging: 'https://accounts-staging.letbuyy.com', development: 'http://localhost:9002' }[environment];
        return `${origin}/merchant/auth/callback`;
    }
    return null;
}
