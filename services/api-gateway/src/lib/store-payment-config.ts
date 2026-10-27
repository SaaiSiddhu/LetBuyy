import { type RazorpayCredentials, verifyRazorpayCredentials as verifyRazorpayCredentialsWithAdapter } from '@letbuyy/infrastructure/razorpay-adapter';

export type PaymentSettings = {
    mode?: 'shared' | 'ownAccount';
    gateways?: string[];
    razorpay?: {
        key_id?: string;
        key_secret_ciphertext?: string;
        test_mode?: boolean;
        verified?: boolean;
        connected_at?: string;
        updated_at?: string;
    };
};

export type ProviderMode = 'sandbox' | 'live';

function base64EncodeBytes(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function maskKeyId(keyId?: string): string | null {
    if (!keyId) return null;
    if (keyId.length <= 8) return keyId;
    return `${keyId.slice(0, 8)}...${keyId.slice(-4)}`;
}

async function importPaymentEncryptionKey(secret: string): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
    return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptPaymentSecret(secret: string, encryptionKey: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importPaymentEncryptionKey(encryptionKey);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(secret)
    );

    return `${base64EncodeBytes(iv)}:${base64EncodeBytes(new Uint8Array(ciphertext))}`;
}

export async function verifyRazorpayCredentials(keyId: string, keySecret: string): Promise<boolean> {
    return verifyRazorpayCredentialsWithAdapter({ keyId, keySecret });
}

export function sanitizePaymentSettings(settings: PaymentSettings | null | undefined) {
    const razorpay = settings?.razorpay;

    return {
        mode: settings?.mode || 'shared',
        gateways: settings?.gateways || ['razorpay'],
        razorpay: razorpay
            ? {
                key_id: maskKeyId(razorpay.key_id),
                test_mode: Boolean(razorpay.test_mode),
                verified: Boolean(razorpay.verified),
                connected_at: razorpay.connected_at || null,
                updated_at: razorpay.updated_at || null,
                secret_configured: Boolean(razorpay.key_secret_ciphertext),
            }
            : null,
    };
}

export function paymentConfigProviderMode(input: {
    onlinePaymentEnabled?: boolean | null;
    settings?: PaymentSettings | null;
}): ProviderMode {
    const razorpay = input.settings?.razorpay;
    if (input.onlinePaymentEnabled === false || !razorpay?.key_secret_ciphertext) return 'sandbox';
    return razorpay.test_mode === false ? 'live' : 'sandbox';
}

export function isMissingSitesPaymentColumnError(error: { message?: string } | null | undefined): boolean {
    const message = error?.message || '';
    return (
        message.includes('sites.payment_settings') ||
        message.includes('sites.online_payment_enabled') ||
        message.includes('sites.cod_enabled')
    ) && message.includes('does not exist');
}

export function defaultPaymentConfig(storeId: string) {
    return {
        store_id: storeId,
        online_payment_enabled: true,
        cod_enabled: true,
        provider_mode: 'sandbox' as ProviderMode,
        payment_settings: sanitizePaymentSettings(null),
        schema_ready: false,
    };
}

/** Reads the existing Merchant-owned encrypted settings; hosted live payments remain gated. */
export async function readStoreRazorpayTestCredentials(settings: PaymentSettings | null | undefined, encryptionKey: string | undefined): Promise<RazorpayCredentials | null> {
    const configured = settings?.razorpay;
    if (!configured?.verified || configured.test_mode !== true || !configured.key_id?.startsWith('rzp_test_')
        || !configured.key_secret_ciphertext || !encryptionKey || encryptionKey.length < 16) return null;
    try {
        const parts = configured.key_secret_ciphertext.split(':');
        if (parts.length !== 2 || parts[1].length > 4096) return null;
        const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
        const iv = decode(parts[0]);
        if (iv.length !== 12) return null;
        const key = await importPaymentEncryptionKey(encryptionKey);
        const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, decode(parts[1]));
        const keySecret = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
        if (keySecret.length < 16 || keySecret.length > 256 || /[\s\u0000-\u001f]/.test(keySecret)) return null;
        return { keyId: configured.key_id, keySecret };
    } catch {
        return null;
    }
}
