// The console's email allowlist and TOTP MFA — pure logic, no `next/headers`/`next/navigation`, no
// `server-only` guard, so it is importable from a plain `node --test` run and not only from inside
// a Next.js Server Component. console-auth-server.ts re-exports everything here for its own
// callers; nothing about the split changes behavior.

import { createHmac, timingSafeEqual } from 'node:crypto';

const textEncoder = new TextEncoder();

function configured(value: string | undefined): value is string {
    if (!value) return false;
    if (value.includes('replace-with')) return false;
    if (value.startsWith('dev-only-placeholder')) return false;
    return true;
}

export function normalizeConsoleEmail(email: string) {
    return email.trim().toLowerCase();
}

export function getAllowedConsoleEmails() {
    return (process.env.PLATFORM_CONSOLE_ALLOWED_EMAILS || '')
        .split(',')
        .map((email) => normalizeConsoleEmail(email))
        .filter(Boolean);
}

export function isConsoleEmailAllowed(email: string) {
    const allowedEmails = getAllowedConsoleEmails();
    if (allowedEmails.length === 0) return false;
    return allowedEmails.includes(normalizeConsoleEmail(email));
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

export type MfaVerificationResult =
    | { ok: true }
    | { ok: false; reason: 'invalid' | 'locked' };

// SUSTAINED-E: verifyConsoleTotp had none of the three things an OTP check needs against a live
// guesser -- a lockout, replay rejection and a constant-time comparison. A caller holding only the
// pre-MFA session cookie (set the moment step 1's magic link is followed, before MFA) could POST
// /api/console-auth/mfa without limit: 10^6 codes, 3 valid 30s windows accepted per submission,
// and nothing counted a failure. `===` also leaks per-character timing. None of that needs the
// bigger identity-platform migration decision (BRANCH_DISPOSITIONS.md's row for this phase) to
// fix -- it is a property of this endpoint alone.
//
// Process-local by design and documented as a floor, not the final answer: a real multi-instance
// deployment needs a shared store (KV/Postgres) for both maps below, the same way any of this
// repository's other rate limits do once they leave a single process. `apps/internal/console` has
// no such store wired today (no identity-platform integration at all -- see the BLOCKED_DECISION
// row for this phase), so this is the improvement available without inventing one.
const MFA_MAX_ATTEMPTS = 5;
const MFA_LOCKOUT_MS = 5 * 60_000;
const mfaAttempts = new Map<string, { failures: number; lockedUntil: number }>();
const mfaLastAcceptedCounter = new Map<string, number>();

function constantTimeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

function recordMfaFailure(principal: string, now: number): void {
    const current = mfaAttempts.get(principal) ?? { failures: 0, lockedUntil: 0 };
    const failures = current.failures + 1;
    mfaAttempts.set(principal, {
        failures,
        lockedUntil: failures >= MFA_MAX_ATTEMPTS ? now + MFA_LOCKOUT_MS : 0,
    });
}

/// Test-only: clears this module's in-memory MFA guard state so tests do not bleed into each other.
export function resetConsoleMfaGuardStateForTests(): void {
    mfaAttempts.clear();
    mfaLastAcceptedCounter.clear();
}

export function verifyConsoleTotp(code: string, email: string): MfaVerificationResult {
    const principal = normalizeConsoleEmail(email);
    const now = Date.now();

    const lockState = mfaAttempts.get(principal);
    if (lockState && lockState.lockedUntil > now) {
        return { ok: false, reason: 'locked' };
    }

    const normalizedCode = code.trim();
    const devCode = process.env.PLATFORM_CONSOLE_DEV_MFA_CODE;

    if (canUseConsoleDevMfaBypass() && devCode && constantTimeEquals(normalizedCode, devCode)) {
        mfaAttempts.delete(principal);
        return { ok: true };
    }

    const secret = getConsoleTotpSecretForPrincipal(email);
    if (!secret || !/^\d{6}$/.test(normalizedCode)) {
        recordMfaFailure(principal, now);
        return { ok: false, reason: 'invalid' };
    }

    const secretBytes = decodeBase32(secret);
    const counter = Math.floor(now / 30_000);
    const priorAccepted = mfaLastAcceptedCounter.get(principal) ?? -1;

    for (let offset = -1; offset <= 1; offset += 1) {
        const candidateCounter = counter + offset;
        // A code already accepted for this or an earlier window is a replay, not a fresh proof --
        // checked even before the comparison, so a resubmitted VALID code costs nothing extra but
        // is still refused.
        if (candidateCounter <= priorAccepted) continue;
        if (constantTimeEquals(hotp(secretBytes, candidateCounter), normalizedCode)) {
            mfaLastAcceptedCounter.set(principal, candidateCounter);
            mfaAttempts.delete(principal);
            return { ok: true };
        }
    }

    recordMfaFailure(principal, now);
    return { ok: false, reason: 'invalid' };
}
