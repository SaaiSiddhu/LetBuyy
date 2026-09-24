import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import { LETBUYY_BUYER_SESSION_EPOCH_CLAIM } from '@letbuyy/auth-core';
import type { Env } from '../index';

const MERCHANT_SESSION_AUDIENCE = 'letbuyy:merchant-session';
// D-8 (2026-09-05): the marketplace buyer realm. A DISTINCT audience is what makes cross-realm
// acceptance impossible rather than merely unlikely.
const BUYER_SESSION_AUDIENCE = 'letbuyy:buyer-session';
const DEFAULT_IDENTITY_ISSUER = 'https://accounts.letbuyy.com';

/// What distinguishes one realm's session from another's. Everything else about verification is
/// identical, which is exactly why this is parameterised rather than copied: a second 100-line
/// verifier would drift from the first, and a verifier that has drifted is one that accepts
/// something it should not. The label exists only so a rejection reason names the realm the caller
/// actually asked about.
interface SessionRealmContract {
    readonly realm: string;
    readonly tokenUse: string;
    readonly audience: string;
    readonly label: string;
}

const MERCHANT_REALM: SessionRealmContract = {
    realm: 'merchant',
    tokenUse: 'merchant_session',
    audience: MERCHANT_SESSION_AUDIENCE,
    label: 'merchant session',
};

const BUYER_REALM: SessionRealmContract = {
    realm: 'buyer',
    tokenUse: 'buyer_session',
    audience: BUYER_SESSION_AUDIENCE,
    label: 'buyer session',
};

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function identityIssuer(env: Env): string {
    return String(env.LETBUYY_IDENTITY_ISSUER || DEFAULT_IDENTITY_ISSUER).replace(/\/+$/, '');
}

function parseIdentityPublicJwks(env: Env): JSONWebKeySet | null {
    const raw = env.LETBUYY_IDENTITY_PUBLIC_JWKS?.trim();
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as JSONWebKeySet | (JSONWebKeySet['keys'][number]);
        if (parsed && typeof parsed === 'object' && Array.isArray((parsed as JSONWebKeySet).keys)) {
            return parsed as JSONWebKeySet;
        }
        if (parsed && typeof parsed === 'object') {
            return { keys: [parsed as JSONWebKeySet['keys'][number]] };
        }
    } catch {
        return null;
    }

    return null;
}

async function validateIdentityIssuedSessionToken(
    env: Env,
    token: string,
    subject: string,
    contract: SessionRealmContract,
): Promise<{ ok: boolean; reason?: string; claims?: Record<string, unknown> }> {
    const { label } = contract;

    if (token.length > 4096 || token.split('.').length !== 3 || !/^[A-Za-z0-9._~-]+$/.test(token)) {
        return { ok: false, reason: `${label} token is malformed` };
    }

    const [encodedHeader, encodedPayload] = token.split('.');
    const header = decodeBase64UrlJson(encodedHeader);
    const payload = decodeBase64UrlJson(encodedPayload);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (!header || !payload) return { ok: false, reason: `${label} token is malformed` };
    if (header.alg !== 'ES256' && header.alg !== 'EdDSA') {
        return { ok: false, reason: `${label} token must use an asymmetric algorithm` };
    }
    if (payload.sub !== subject) return { ok: false, reason: `${label} subject mismatch` };
    if (payload.aud !== contract.audience) return { ok: false, reason: `${label} audience mismatch` };
    if (payload.realm !== contract.realm || payload.token_use !== contract.tokenUse) {
        return { ok: false, reason: `${label} token use mismatch` };
    }
    if (payload.iss !== identityIssuer(env)) {
        return { ok: false, reason: `${label} issuer mismatch` };
    }
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
        return { ok: false, reason: `${label} token is expired` };
    }
    if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 60) {
        return { ok: false, reason: `${label} token issue time is invalid` };
    }
    if (typeof payload.jti !== 'string' || payload.jti.length < 16) {
        return { ok: false, reason: `${label} replay id is missing` };
    }

    const jwks = parseIdentityPublicJwks(env);
    if (!jwks) {
        return { ok: false, reason: 'identity public JWKS is required' };
    }

    let verifiedClaims: Record<string, unknown>;
    try {
        const { payload: verifiedPayload, protectedHeader } = await jwtVerify(
            token,
            createLocalJWKSet(jwks),
            {
                issuer: identityIssuer(env),
                audience: contract.audience,
                algorithms: ['ES256', 'EdDSA'],
                subject,
            },
        );

        if (protectedHeader.alg !== 'ES256' && protectedHeader.alg !== 'EdDSA') {
            return { ok: false, reason: `${label} token must use an asymmetric algorithm` };
        }
        // Re-checked on the VERIFIED payload, not the pre-parse above. The pre-parse reads an
        // unverified token and exists only to reject cheaply; trusting it for realm separation would
        // mean the claim deciding which realm a caller belongs to was never authenticated.
        //
        // HONESTLY: for a well-formed JWT these two payloads are the same bytes, so the pre-parse
        // check above already rejects anything this would catch, and NO TEST CAN REACH THIS LINE.
        // Verified by planting its removal — all seven buyer tests still passed. It is kept anyway,
        // because its value is surviving a future change that relaxes or reorders the cheap
        // pre-parse, at which point this becomes the only realm check left. Do not "cover" it with
        // an assertion that cannot fail; an unfalsifiable test here would be worse than none, since
        // it would claim the separation is proven when the proof is the audience check.
        if (verifiedPayload.realm !== contract.realm || verifiedPayload.token_use !== contract.tokenUse) {
            return { ok: false, reason: `${label} token use mismatch` };
        }
        if (typeof verifiedPayload.jti !== 'string' || verifiedPayload.jti.length < 16) {
            return { ok: false, reason: `${label} replay id is missing` };
        }
        verifiedClaims = verifiedPayload as Record<string, unknown>;
    } catch {
        return { ok: false, reason: `${label} signature verification failed` };
    }

    return { ok: true, claims: verifiedClaims };
}

export async function validateIdentityIssuedMerchantSessionToken(
    env: Env,
    token: string,
    userId: string,
): Promise<{ ok: boolean; reason?: string }> {
    // The merchant contract is unchanged by APPID-P4a: the verified claims the buyer path needs for
    // its session epoch are not part of what this returns.
    const result = await validateIdentityIssuedSessionToken(env, token, userId, MERCHANT_REALM);
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

/// Verifies a marketplace buyer session (D-8). `buyerAccountId` is a buyer_accounts.id.
///
/// Buyer auth must never grant merchant or operator rights, and the separation is not a convention
/// here: a merchant token fails the audience check, and would fail realm and token_use even if the
/// audience somehow matched.
export async function validateIdentityIssuedBuyerSessionToken(
    env: Env,
    token: string,
    buyerAccountId: string,
): Promise<{ ok: boolean; reason?: string; claims?: Record<string, unknown> }> {
    return validateIdentityIssuedSessionToken(env, token, buyerAccountId, BUYER_REALM);
}

/// Verifies a buyer session and returns WHO it authenticates.
///
/// The strict verifier above takes an expected subject, because the merchant path always knows whose
/// token it is checking — it verifies a token it just issued for a known user. A cookie-borne buyer
/// session is the opposite question: "who is this?".
///
/// `subject` is deliberately NOT made optional in the shared core. Doing so would silently stop
/// checking `sub` for any caller that omitted it, including the merchant path, and a security check
/// that disappears when an argument is forgotten is worse than one that was never there.
///
/// So the unverified `sub` is read here and fed straight back as the EXPECTED subject of a full
/// verification. That is safe, and the reason is worth stating because "read the unverified payload"
/// is normally a red flag: the value is never trusted on its own. If the token is forged, signature
/// verification fails. If `sub` was tampered with, it no longer matches the signed payload and
/// jwtVerify's own subject check rejects it. The unverified read only chooses which claim to prove.
///
/// It also returns the SESSION EPOCH the token was issued in (APPID-P4a, migration 257), read from
/// the verified payload's `sep` claim (LETBUYY_BUYER_SESSION_EPOCH_CLAIM). The caller compares it
/// with buyer_accounts.session_epoch; a password reset or "sign out everywhere" advances that, and
/// every older token stops working. A token without the claim was issued before epochs existed and
/// counts as epoch 1, the column's starting value, so those sessions end at the account's first
/// reset rather than all at once. A claim that is present but not a positive integer is refused:
/// nothing identity-platform issues looks like that.
export async function resolveIdentityIssuedBuyerSession(
    env: Env,
    token: string,
): Promise<{ ok: true; buyerAccountId: string; sessionEpoch: number } | { ok: false; reason: string }> {
    if (token.length > 4096 || token.split('.').length !== 3) {
        return { ok: false, reason: 'buyer session token is malformed' };
    }

    const claimed = decodeBase64UrlJson(token.split('.')[1]);
    const subject = typeof claimed?.sub === 'string' ? claimed.sub : null;
    if (!subject) return { ok: false, reason: 'buyer session subject is missing' };

    const verified = await validateIdentityIssuedBuyerSessionToken(env, token, subject);
    if (!verified.ok) return { ok: false, reason: verified.reason || 'buyer session verification failed' };

    const epoch = verified.claims?.[LETBUYY_BUYER_SESSION_EPOCH_CLAIM];
    if (epoch === undefined) return { ok: true, buyerAccountId: subject, sessionEpoch: 1 };
    if (typeof epoch !== 'number' || !Number.isInteger(epoch) || epoch < 1) {
        return { ok: false, reason: 'buyer session epoch is invalid' };
    }
    return { ok: true, buyerAccountId: subject, sessionEpoch: epoch };
}
