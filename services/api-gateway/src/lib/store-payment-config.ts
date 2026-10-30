import { type RazorpayCredentials, verifyRazorpayCredentials as verifyRazorpayCredentialsWithAdapter } from '@letbuyy/infrastructure/razorpay-adapter';
import { deriveStorePaymentSetup } from '@letbuyy/payments';
import type { StorePaymentConfig, StorePaymentSettings } from '@letbuyy/shared-types';
import { paymentEncryptionKeyring } from './payment-encryption-keyring';

export type PaymentSettings = {
    mode?: 'shared' | 'ownAccount';
    gateways?: string[];
    razorpay?: {
        credential_id?: string;
        key_id?: string;
        key_secret_ciphertext?: string;
        webhook_secret_ciphertext?: string;
        test_mode?: boolean;
        verified?: boolean;
        connected_at?: string;
        updated_at?: string;
    };
};

export type ProviderMode = 'sandbox' | 'live' | null;

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

export type PaymentSecretContext = { siteId: string; keyId: string; environment: 'sandbox' | 'live'; credentialId?: string };

function paymentSecretContext(context: PaymentSecretContext, keyVersion: string, purpose: 'api' | 'webhook' = 'api'): Uint8Array {
    if (!/^[0-9a-f-]{36}$/i.test(context.siteId) || !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(context.keyId)
        || context.keyId.startsWith('rzp_test_') !== (context.environment === 'sandbox')) {
        throw new Error('Invalid payment credential context');
    }
    if (context.credentialId && !/^[0-9a-f-]{36}$/i.test(context.credentialId)) throw new Error('Invalid credential version');
    const fields = [purpose === 'webhook' ? 'letbuyy:store-payment-webhook-secret' : 'letbuyy:store-payment-secret', context.credentialId ? 3 : 2, keyVersion,
        context.siteId.toLowerCase(), 'razorpay', 'ownAccount', context.keyId, context.environment];
    if (context.credentialId) fields.push(context.credentialId.toLowerCase());
    return new TextEncoder().encode(JSON.stringify(fields));
}

/** V3 binds new saves to their immutable version; omitting its ID retains the explicit V2 fixture/migration format. */
export async function encryptPaymentSecret(secret: string, encryptionKey: string, context: PaymentSecretContext): Promise<string> {
    const selected = (await paymentEncryptionKeyring(encryptionKey)).active;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importPaymentEncryptionKey(selected.secret);
    const version = selected.version;
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: paymentSecretContext(context, version) },
        key,
        new TextEncoder().encode(secret)
    );

    const prefix = context.credentialId ? `v3:${version}:${context.credentialId.toLowerCase()}` : `v2:${version}`;
    return `${prefix}:${base64EncodeBytes(iv)}:${base64EncodeBytes(new Uint8Array(ciphertext))}`;
}

/** The Razorpay dashboard webhook secret is separate from its API secret. Keep
 * their authenticated encryption purposes disjoint even under one keyring. */
export async function encryptPaymentWebhookSecret(secret: string, encryptionKey: string, context: PaymentSecretContext): Promise<string> {
    if (!context.credentialId || secret.length < 16 || secret.length > 256 || /[\s\u0000-\u001f]/.test(secret)) {
        throw new Error('Invalid payment webhook secret');
    }
    const selected = (await paymentEncryptionKeyring(encryptionKey)).active;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importPaymentEncryptionKey(selected.secret);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: paymentSecretContext(context, selected.version, 'webhook') },
        key, new TextEncoder().encode(secret)
    );
    return `v3:${selected.version}:${context.credentialId.toLowerCase()}:${base64EncodeBytes(iv)}:${base64EncodeBytes(new Uint8Array(ciphertext))}`;
}

export async function verifyRazorpayCredentials(keyId: string, keySecret: string): Promise<boolean> {
    return verifyRazorpayCredentialsWithAdapter({ keyId, keySecret });
}

export function sanitizePaymentSettings(settings: PaymentSettings | null | undefined): StorePaymentSettings {
    const razorpay = settings?.razorpay;

    return {
        mode: settings?.mode || 'unconfigured',
        gateways: settings?.gateways || [],
        razorpay: razorpay
            ? {
                key_id: maskKeyId(razorpay.key_id),
                test_mode: Boolean(razorpay.test_mode),
                verified: Boolean(razorpay.verified),
                connected_at: razorpay.connected_at || null,
                updated_at: razorpay.updated_at || null,
                secret_configured: Boolean(razorpay.key_secret_ciphertext),
                webhook_secret_configured: Boolean(razorpay.webhook_secret_ciphertext),
            }
            : null,
    };
}

/** Only an exact, tenant- and credential-version-bound webhook secret can be read.
 * Legacy unbound ciphertext is intentionally unsupported for this purpose. */
export async function readStoreRazorpayWebhookSecret(settings: PaymentSettings | null | undefined,
    encryptionKey: string | undefined, siteId: string): Promise<string | null> {
    const configured = settings?.razorpay;
    const cipher = configured?.webhook_secret_ciphertext;
    if (settings?.mode !== 'ownAccount' || !configured?.verified || configured.test_mode !== true
        || !configured.key_id?.startsWith('rzp_test_') || !configured.credential_id || !cipher
        || !encryptionKey || encryptionKey.length < 16 || cipher.length > 4096) return null;
    try {
        const parts = cipher.split(':');
        if (parts.length !== 5 || parts[0] !== 'v3' || parts[2] !== configured.credential_id.toLowerCase()) return null;
        const keyring = await paymentEncryptionKeyring(encryptionKey);
        const selected = keyring.byVersion.get(parts[1]);
        if (!selected) return null;
        const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
        const iv = decode(parts[3]);
        if (iv.length !== 12) return null;
        const key = await importPaymentEncryptionKey(selected.secret);
        const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv,
            additionalData: paymentSecretContext({ siteId, keyId: configured.key_id,
                environment: 'sandbox', credentialId: configured.credential_id }, parts[1], 'webhook') }, key, decode(parts[4]));
        const secret = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
        return secret.length >= 16 && secret.length <= 256 && !/[\s\u0000-\u001f]/.test(secret) ? secret : null;
    } catch { return null; }
}

export function paymentConfigProviderMode(input: {
    onlinePaymentEnabled?: boolean | null;
    settings?: PaymentSettings | null;
}): ProviderMode {
    const razorpay = input.settings?.razorpay;
    if (!razorpay?.key_secret_ciphertext || !razorpay.key_id) return null;
    if (razorpay.test_mode === true && razorpay.key_id.startsWith('rzp_test_')) return 'sandbox';
    if (razorpay.test_mode === false && razorpay.key_id.startsWith('rzp_live_')) return 'live';
    return null;
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
        online_payment_enabled: false,
        cod_enabled: false,
        provider_mode: null,
        payment_settings: sanitizePaymentSettings(null),
        schema_ready: false,
        revision: null,
        setup: deriveStorePaymentSetup({ schemaReady: false, onlineRequested: false, hasCredentials: false,
            credentialVerified: false, credentialsUsable: false, environment: null }),
    };
}

export type StorePaymentRow = {
    id: string;
    payment_settings?: PaymentSettings | null;
    online_payment_enabled?: boolean | null;
    cod_enabled?: boolean | null;
    updated_at?: string | null;
};

/** Public projection shares the actual hosted test-credential gate; never returns encrypted material. */
export async function projectStorePaymentConfig(row: StorePaymentRow, encryptionKey?: string): Promise<StorePaymentConfig> {
    const settings = row.payment_settings;
    const environment = paymentConfigProviderMode({ settings });
    const credentialsUsable = Boolean(await readStoreRazorpayTestCredentials(settings, encryptionKey, row.id));
    return {
        store_id: row.id,
        online_payment_enabled: row.online_payment_enabled === true,
        cod_enabled: row.cod_enabled === true,
        provider_mode: environment,
        payment_settings: sanitizePaymentSettings(settings),
        revision: row.updated_at || null,
        schema_ready: true,
        setup: deriveStorePaymentSetup({ schemaReady: true, onlineRequested: row.online_payment_enabled === true,
            accountMode: settings?.mode, hasCredentials: Boolean(settings?.razorpay?.key_secret_ciphertext),
            credentialVerified: settings?.razorpay?.verified === true, credentialsUsable, environment }),
    };
}

/** Reads the existing Merchant-owned encrypted settings; hosted live payments remain gated. */
export async function readStoreRazorpayTestCredentials(settings: PaymentSettings | null | undefined, encryptionKey: string | undefined, siteId: string): Promise<RazorpayCredentials | null> {
    const configured = settings?.razorpay;
    if (settings?.mode !== 'ownAccount' || !configured?.verified || configured.test_mode !== true || !configured.key_id?.startsWith('rzp_test_')
        || !configured.key_secret_ciphertext || !encryptionKey || encryptionKey.length < 16) return null;
    try {
        const parts = configured.key_secret_ciphertext.split(':');
        const v3 = parts[0] === 'v3', bound = v3 || parts[0] === 'v2';
        if (!(v3 ? parts.length === 5 : bound ? parts.length === 4 : parts.length === 2) || configured.key_secret_ciphertext.length > 4096) return null;
        const keyring = await paymentEncryptionKeyring(encryptionKey);
        const selected = keyring.byVersion.get(bound ? parts[1] : keyring.legacyVersion ?? '');
        if (!selected) return null;
        if (v3 && (!configured.credential_id || parts[2] !== configured.credential_id.toLowerCase())) return null;
        const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));
        const iv = decode(parts[v3 ? 3 : bound ? 2 : 0]);
        if (iv.length !== 12) return null;
        const key = await importPaymentEncryptionKey(selected.secret);
        // Legacy IV:ciphertext remains read-only for an explicit migration/drain.
        // It has no authenticated tenant context; do not use this bridge as evidence that B04 is complete.
        const additionalData = bound ? paymentSecretContext({ siteId, keyId: configured.key_id, environment: 'sandbox',
            ...(v3 ? { credentialId: configured.credential_id } : {}) }, parts[1]) : undefined;
        const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, key, decode(parts[v3 ? 4 : bound ? 3 : 1]));
        const keySecret = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
        if (keySecret.length < 16 || keySecret.length > 256 || /[\s\u0000-\u001f]/.test(keySecret)) return null;
        return { keyId: configured.key_id, keySecret };
    } catch {
        return null;
    }
}
