import { z } from 'zod';

/** Private operator configuration in the existing encryption binding. This
 * rotates wrapping keys, never a merchant's provider secret or account. */
export const PAYMENT_KEYRING_PREFIX = 'PAYMENT_CONFIG_KEYRING_V1:';
const KeyringSchema = z.object({
    active: z.string().min(32).max(4096).regex(/^[^\s\u0000-\u001f\u007f]+$/),
    previous: z.array(z.string().min(16).max(4096)).max(4),
    // Unbound IV:ciphertext has no encoded version. An operator must name its
    // one historical key explicitly; never try every retained key against it.
    legacy_version: z.string().regex(/^[0-9a-f]{16}$/).optional(),
}).strict();
export type PaymentEncryptionKey = { version: string; secret: string };

async function version(secret: string): Promise<string> {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
    return Array.from(bytes.slice(0, 8), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function paymentEncryptionKeyring(configuration: string): Promise<{
    active: PaymentEncryptionKey; byVersion: ReadonlyMap<string, PaymentEncryptionKey>; legacyVersion?: string;
}> {
    if (configuration.length < 16 || configuration.length > 24_000) throw new Error('Payment encryption key is unavailable');
    if (!configuration.startsWith(PAYMENT_KEYRING_PREFIX)) {
        const key = { version: await version(configuration), secret: configuration };
        return { active: key, byVersion: new Map([[key.version, key]]), legacyVersion: key.version };
    }
    let value: unknown;
    try { value = JSON.parse(configuration.slice(PAYMENT_KEYRING_PREFIX.length)); }
    catch { throw new Error('Payment encryption keyring is unavailable'); }
    const parsed = KeyringSchema.safeParse(value);
    if (!parsed.success) throw new Error('Payment encryption keyring is unavailable');
    const keys = await Promise.all([parsed.data.active, ...parsed.data.previous].map(async secret => ({ version: await version(secret), secret })));
    const byVersion = new Map(keys.map(key => [key.version, key]));
    if (byVersion.size !== keys.length || (parsed.data.legacy_version && !byVersion.has(parsed.data.legacy_version))) {
        throw new Error('Payment encryption keyring is unavailable');
    }
    return { active: keys[0], byVersion, legacyVersion: parsed.data.legacy_version };
}
