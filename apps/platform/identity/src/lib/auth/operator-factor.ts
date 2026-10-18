import { createHmac, timingSafeEqual } from 'node:crypto';
function normalizeConsoleEmail(email:string) { return email.trim().toLowerCase(); }

const textEncoder = new TextEncoder();

function configured(value: string | undefined): value is string {
    if (!value) return false;
    if (value.includes('replace-with')) return false;
    if (value.startsWith('dev-only-placeholder')) return false;
    return true;
}

export type ConsoleLoginOutcome =
    | { kind: 'proceed' }
    | { kind: 'magic_link_delivery_not_configured' }
    | { kind: 'access_denied' };

/**
 * Phase 2 / D04 (Mandate 6, Section 10): the ORDER of these two checks is itself the security
 * property, not an implementation detail -- pulled out as its own pure, unit-testable function so
 * that property stays enforced even if the route handler is edited later without re-reading this
 * comment. `isProduction` must be checked first: in production every submission ends at
 * `magic_link_delivery_not_configured` today (no delivery is wired), so checking that FIRST means
 * every production response is identical regardless of whether the submitted email is on the
 * allowlist. Checking the allowlist first would let `access_denied` (not allowed) and
 * `magic_link_delivery_not_configured` (allowed) leak, one guess at a time, exactly which candidate
 * emails are real platform-operator accounts.
 */
export function resolveConsoleLoginOutcome(input: { isProduction: boolean; isAllowed: boolean }): ConsoleLoginOutcome {
    if (input.isProduction) return { kind: 'magic_link_delivery_not_configured' };
    if (!input.isAllowed) return { kind: 'access_denied' };
    return { kind: 'proceed' };
}

function parsePerPrincipalTotpSecrets(): Record<string, string> {
    const raw = process.env.PLATFORM_CONSOLE_TOTP_SECRETS || '';
    if (!raw.trim()) return {};

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(parsed)
                .map(([email, secret]) => [normalizeConsoleEmail(email), typeof secret === 'string' ? secret.trim() : ''])
                .filter(([, secret]) => configured(secret)),
        );
    } catch {
        return Object.fromEntries(
            raw.split(',')
                .map((entry) => entry.split(':'))
                .filter((parts) => parts.length >= 2)
                .map(([email, ...secretParts]) => [normalizeConsoleEmail(email || ''), secretParts.join(':').trim()])
                .filter(([email, secret]) => Boolean(email && configured(secret))),
        );
    }
}

function isProductionConsoleRuntime() {
    return process.env.NODE_ENV === 'production'
        || process.env.APP_ENV === 'production'
        || process.env.VERCEL_ENV === 'production';
}

function canUseConsoleDevMfaBypass() {
    return !isProductionConsoleRuntime()
        && process.env.NODE_ENV === 'development'
        && process.env.LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true';
}

export function getConsoleTotpSecretForPrincipal(email: string): string | null {
    const secrets = parsePerPrincipalTotpSecrets();
    const perPrincipal = secrets[normalizeConsoleEmail(email)];
    if (perPrincipal) return perPrincipal;

    if (!isProductionConsoleRuntime()) {
        const devFallback = process.env.PLATFORM_CONSOLE_TOTP_SECRET;
        return configured(devFallback) ? devFallback : null;
    }

    return null;
}

/** Non-secret key identifier, bound to the effective HOTP key and account. The
 * factor itself remains configured on the canonical Identity server. */
export function getConsoleFactorFingerprint(email:string):string|null {
    const secret=getConsoleTotpSecretForPrincipal(email);
    if(!secret)return null;
    return createHmac('sha256',Buffer.from(decodeBase32(secret))).update('letbuyy-console-factor-v1\0'+normalizeConsoleEmail(email)).digest('hex');
}
function decodeBase32(secret: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const normalized = secret.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
    if (!normalized || /[^A-Z2-7]/.test(normalized)) {
        return textEncoder.encode(secret);
    }

    const bytes: number[] = [];
    let bits = 0;
    let value = 0;

    for (const char of normalized) {
        value = (value << 5) | alphabet.indexOf(char);
        bits += 5;

        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Uint8Array.from(bytes);
}

function hotp(secret: Uint8Array, counter: number) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const digest = createHmac('sha1', Buffer.from(secret)).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code = (
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)
    ) % 1_000_000;

    return code.toString().padStart(6, '0');
}

export type ConsoleTotpMatch =
    | { ok: true; counter: number }
    | { ok: false; reason: 'invalid' | 'unavailable' };

function constantTimeEquals(a: string, b: string): boolean {
    const left=Buffer.from(a),right=Buffer.from(b);
    return left.length===right.length && timingSafeEqual(left,right);
}

/** Pure configured-factor matching only. This is never authorization: the
 * Gateway's durable actor/session transaction owns attempts and one-use state. */
export function matchConsoleTotpCounter(code: string, email: string): ConsoleTotpMatch {
    const value=code.trim(),counter=Math.floor(Date.now()/30000);
    const devCode=process.env.PLATFORM_CONSOLE_DEV_MFA_CODE;
    if(canUseConsoleDevMfaBypass() && devCode && constantTimeEquals(value,devCode))return {ok:true,counter};
    const secret=getConsoleTotpSecretForPrincipal(email);
    if(!secret)return {ok:false,reason:'unavailable'};
    if(!/^\d{6}$/.test(value))return {ok:false,reason:'invalid'};
    const bytes=decodeBase32(secret);
    for(const offset of [-1,0,1]) {
        const candidate=counter+offset;
        if(constantTimeEquals(hotp(bytes,candidate),value))return {ok:true,counter:candidate};
    }
    return {ok:false,reason:'invalid'};
}
