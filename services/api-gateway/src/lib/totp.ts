import { timingSafeEqualText } from './crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

function base32Encode(bytes: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return output;
}

function base32Decode(value: string): Uint8Array {
    const normalized = value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
    const bytes: number[] = [];
    let bits = 0;
    let buffer = 0;

    for (const char of normalized) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1) throw new Error('Invalid TOTP secret');
        buffer = (buffer << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((buffer >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return new Uint8Array(bytes);
}

function counterBytes(counter: number): Uint8Array {
    const bytes = new Uint8Array(8);
    let value = BigInt(counter);
    for (let index = 7; index >= 0; index -= 1) {
        bytes[index] = Number(value & 0xffn);
        value >>= 8n;
    }
    return bytes;
}

export function generateTotpSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return base32Encode(bytes);
}

export function otpauthUri(input: { issuer: string; label: string; secret: string; accountName: string }): string {
    const label = `${input.issuer}:${input.accountName || input.label}`;
    const params = new URLSearchParams({
        secret: input.secret,
        issuer: input.issuer,
        algorithm: 'SHA1',
        digits: String(DEFAULT_DIGITS),
        period: String(DEFAULT_STEP_SECONDS),
    });
    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

async function hotp(secret: string, counter: number, digits = DEFAULT_DIGITS): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        base32Decode(secret),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes(counter)));
    const offset = signature[signature.length - 1] & 0x0f;
    const binary = ((signature[offset] & 0x7f) << 24)
        | ((signature[offset + 1] & 0xff) << 16)
        | ((signature[offset + 2] & 0xff) << 8)
        | (signature[offset + 3] & 0xff);
    return String(binary % (10 ** digits)).padStart(digits, '0');
}

export async function verifyTotpCode(input: {
    secret: string;
    code: string;
    nowMs?: number;
    window?: number;
}): Promise<boolean> {
    return (await matchingTotpCounter(input)) !== null;
}

/** Login consumes the matched counter durably; validation alone grants no session. */
export async function matchingTotpCounter(input: { secret: string; code: string; nowMs?: number; window?: number }): Promise<number | null> {
    const normalized = input.code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(normalized)) return null;
    const step = DEFAULT_STEP_SECONDS * 1000;
    const counter = Math.floor((input.nowMs || Date.now()) / step);
    const window = input.window ?? 1;

    for (let offset = -window; offset <= window; offset += 1) {
        const expected = await hotp(input.secret, counter + offset);
        if (timingSafeEqualText(expected, normalized)) return counter + offset;
    }

    return null;
}
