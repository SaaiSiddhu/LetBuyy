function hexToBytes(hex: string): Uint8Array {
    const normalized = hex.toLowerCase();
    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < normalized.length; index += 2) {
        bytes[index / 2] = parseInt(normalized.slice(index, index + 2), 16);
    }
    return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

export function timingSafeEqualText(left: string | null | undefined, right: string | null | undefined): boolean {
    if (typeof left !== 'string' || typeof right !== 'string') return false;
    if (!left || !right || left.length !== right.length) return false;

    let diff = 0;
    for (let index = 0; index < left.length; index += 1) {
        diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return diff === 0;
}

export function timingSafeEqualHex(leftHex: string | null | undefined, rightHex: string | null | undefined): boolean {
    if (!leftHex || !rightHex) return false;
    if (leftHex.length !== rightHex.length) return false;
    if (leftHex.length % 2 !== 0) return false;
    if (!/^[a-f0-9]+$/i.test(leftHex) || !/^[a-f0-9]+$/i.test(rightHex)) return false;

    const left = hexToBytes(leftHex);
    const right = hexToBytes(rightHex);
    let diff = 0;
    for (let index = 0; index < left.length; index += 1) {
        diff |= left[index] ^ right[index];
    }
    return diff === 0;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signatureBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function aesGcmKey(secret: string): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptTextAesGcm(secret: string, plaintext: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await aesGcmKey(secret);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
    );
    return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptTextAesGcm(secret: string, token: string): Promise<string> {
    const [ivValue, ciphertextValue] = token.split('.');
    if (!ivValue || !ciphertextValue) throw new Error('Invalid encrypted payload');
    const key = await aesGcmKey(secret);
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64UrlToBytes(ivValue) },
        key,
        base64UrlToBytes(ciphertextValue)
    );
    return new TextDecoder().decode(plaintext);
}

export type KmsMode = 'sandbox' | 'live';

export interface KmsProvider {
    mode: KmsMode;
    keyId: string;
    encryptDataKey(dataKey: string): Promise<string>;
    decryptDataKey(encryptedDataKey: string): Promise<string>;
}

export interface KmsEnvelope {
    version: 1;
    mode: KmsMode;
    key_id: string;
    encrypted_data_key: string;
    ciphertext: string;
}

export class KmsHumanRequiredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'KmsHumanRequiredError';
    }
}

function encodeEnvelope(envelope: KmsEnvelope): string {
    const bytes = new TextEncoder().encode(JSON.stringify(envelope));
    return `kms.${bytesToBase64Url(bytes)}`;
}

function decodeEnvelope(token: string): KmsEnvelope {
    if (!token.startsWith('kms.')) {
        throw new Error('Invalid KMS envelope');
    }

    const payload = new TextDecoder().decode(base64UrlToBytes(token.slice(4)));
    const envelope = JSON.parse(payload) as KmsEnvelope;
    if (envelope.version !== 1 || !envelope.key_id || !envelope.encrypted_data_key || !envelope.ciphertext) {
        throw new Error('Invalid KMS envelope payload');
    }
    return envelope;
}

export function createSandboxKmsProvider(options: { keyId?: string; secret?: string } = {}): KmsProvider {
    const keyId = options.keyId || 'sandbox-local-kms-key';
    const secret = options.secret || 'letbuyy-local-sandbox-kms-envelope-secret';

    return {
        mode: 'sandbox',
        keyId,
        encryptDataKey(dataKey: string) {
            return encryptTextAesGcm(`${secret}:${keyId}`, dataKey);
        },
        decryptDataKey(encryptedDataKey: string) {
            return decryptTextAesGcm(`${secret}:${keyId}`, encryptedDataKey);
        },
    };
}

export function createLiveKmsProvider(): KmsProvider {
    return {
        mode: 'live',
        keyId: 'SKIP_NEEDS_HUMAN_KMS_KEY_ID',
        encryptDataKey() {
            // [HUMAN-REQUIRED] Live KMS provider credentials and key policy must be configured outside git.
            throw new KmsHumanRequiredError('Live KMS encryption requires provider credentials and key policy');
        },
        decryptDataKey() {
            // [HUMAN-REQUIRED] Live KMS provider credentials and key policy must be configured outside git.
            throw new KmsHumanRequiredError('Live KMS decryption requires provider credentials and key policy');
        },
    };
}

export function resolveKmsProviderFromEnv(env: {
    LETBUYY_KMS_MODE?: string;
    LETBUYY_KMS_SANDBOX_SECRET?: string;
    LETBUYY_KMS_KEY_ID?: string;
    LETBUYY_ALLOW_SANDBOX_KMS?: string;
    NODE_ENV?: string;
    APP_ENV?: string;
    VERCEL_ENV?: string;
}): KmsProvider {
    const mode = (env.LETBUYY_KMS_MODE || 'sandbox').trim().toLowerCase();
    if (mode === 'live') {
        if (!env.LETBUYY_KMS_KEY_ID || env.LETBUYY_KMS_KEY_ID.startsWith('SKIP_NEEDS_HUMAN_')) {
            // [HUMAN-REQUIRED] Live KMS key id must be installed in the environment before live mode is usable.
            throw new KmsHumanRequiredError('Live KMS mode requires LETBUYY_KMS_KEY_ID');
        }
        return createLiveKmsProvider();
    }

    // SEC-C3 (Wave 0): the sandbox provider wraps field-level encryption with an in-repo
    // literal secret ('letbuyy-local-sandbox-kms-envelope-secret'). It must never run
    // silently in a production-like runtime. Fail closed unless an operator has
    // explicitly opted in for the KMS migration window (LETBUYY_ALLOW_SANDBOX_KMS=true).
    // [HUMAN-REQUIRED] Provision a live KMS (LETBUYY_KMS_MODE=live + key id/policy) and
    // remove the escape hatch before production. Tracked as HR-KMS-LIVE.
    const penv = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
    const isProductionRuntime =
        (env.NODE_ENV ?? penv.NODE_ENV) === 'production' ||
        (env.APP_ENV ?? penv.APP_ENV) === 'production' ||
        (env.VERCEL_ENV ?? penv.VERCEL_ENV) === 'production';
    const allowSandboxInProd = (env.LETBUYY_ALLOW_SANDBOX_KMS ?? penv.LETBUYY_ALLOW_SANDBOX_KMS) === 'true';
    if (isProductionRuntime && !allowSandboxInProd) {
        throw new KmsHumanRequiredError(
            'Sandbox KMS is not permitted in production; set LETBUYY_KMS_MODE=live with a provisioned key (or LETBUYY_ALLOW_SANDBOX_KMS=true only during migration)'
        );
    }

    return createSandboxKmsProvider({
        keyId: env.LETBUYY_KMS_KEY_ID || 'sandbox-local-kms-key',
        secret: env.LETBUYY_KMS_SANDBOX_SECRET,
    });
}

export async function encryptFieldWithKms(provider: KmsProvider, plaintext: string): Promise<string> {
    const dataKey = crypto.randomUUID();
    const [encryptedDataKey, ciphertext] = await Promise.all([
        provider.encryptDataKey(dataKey),
        encryptTextAesGcm(dataKey, plaintext),
    ]);

    return encodeEnvelope({
        version: 1,
        mode: provider.mode,
        key_id: provider.keyId,
        encrypted_data_key: encryptedDataKey,
        ciphertext,
    });
}

export async function decryptFieldWithKms(provider: KmsProvider, token: string): Promise<string> {
    const envelope = decodeEnvelope(token);
    if (envelope.key_id !== provider.keyId) {
        throw new Error('KMS envelope key mismatch');
    }
    const dataKey = await provider.decryptDataKey(envelope.encrypted_data_key);
    return decryptTextAesGcm(dataKey, envelope.ciphertext);
}
