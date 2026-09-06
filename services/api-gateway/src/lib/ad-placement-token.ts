// F-ADS-1c — server-issued placement tokens for the ad event ingress.
//
// The problem this exists for: /storefront/ads/event is a PUBLIC endpoint that spends a merchant's
// prepaid balance. Without proof that the platform itself served the placement, anyone who can send
// a request can drain any campaign. So the endpoint accepts only a token this module minted.
//
// The token binds the four things a charge must not be free to choose — site, campaign, product and
// an expiry — plus a nonce that makes each issuance unique. The nonce becomes record_ad_spend's
// idempotency key, so one token bills exactly once no matter how many times it is replayed: the
// duplicate-suppression is the money RPC's, not a set this module would have to keep.
//
// WHERE THIS MUST BE CALLED, and it is not obvious: the sponsored feed is response-cached. A token
// minted inside the cached body is handed to every buyer who hits that TTL — one nonce, therefore
// one billable event per cache period instead of one per impression, with every later click silently
// free. Tokens are minted per RESPONSE, outside the cached region. A biller that got this backwards
// would undercount by exactly the cache hit rate and look like it was working.

import { hmacSha256Hex, timingSafeEqualHex } from './crypto';

// Version prefix so the format can change without a token from the old format being accepted by the
// new verifier -- the payload is signed WITH the version, so a downgrade is a signature failure.
const TOKEN_VERSION = 'v1';
const FIELD_SEPARATOR = '.';
export const AD_PLACEMENT_TOKEN_TTL_SECONDS = 900;

export interface AdPlacementClaims {
    siteId: string;
    campaignId: string;
    productId: string;
    /// Seconds since the epoch. Bounds how long a harvested token is worth anything.
    expiresAt: number;
    /// Unique per issuance. Becomes the idempotency key, so it is what makes a token single-use.
    nonce: string;
}

// Every field is UUID-or-hex and separator-free, so a token cannot be made ambiguous by a value that
// contains the separator -- checked rather than assumed, because a smuggled separator would let a
// signature cover a different field split than the one the parser produces.
const SAFE_FIELD = /^[0-9a-fA-F-]{1,64}$/;

function payloadOf(claims: AdPlacementClaims): string {
    return [TOKEN_VERSION, claims.siteId, claims.campaignId, claims.productId, String(claims.expiresAt), claims.nonce]
        .join(FIELD_SEPARATOR);
}

function randomNonceHex(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function issueAdPlacementToken(
    secret: string,
    claims: Omit<AdPlacementClaims, 'expiresAt' | 'nonce'>,
    nowSeconds: number = Math.floor(Date.now() / 1000),
    ttlSeconds: number = AD_PLACEMENT_TOKEN_TTL_SECONDS,
): Promise<string | null> {
    const full: AdPlacementClaims = { ...claims, expiresAt: nowSeconds + ttlSeconds, nonce: randomNonceHex() };
    for (const value of [full.siteId, full.campaignId, full.productId, full.nonce]) {
        // A value that cannot round-trip is not signed at all. Returning null drops the placement's
        // token rather than minting one whose parse disagrees with its signature.
        if (!SAFE_FIELD.test(value)) return null;
    }
    const payload = payloadOf(full);
    return `${payload}${FIELD_SEPARATOR}${await hmacSha256Hex(secret, payload)}`;
}

export async function verifyAdPlacementToken(
    secret: string,
    token: string,
    nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<AdPlacementClaims | null> {
    if (typeof token !== 'string' || token.length > 512) return null;
    const parts = token.split(FIELD_SEPARATOR);
    // version, site, campaign, product, expiry, nonce, signature — exactly seven. A token with more
    // parts is not "extra data to ignore", it is a different field split than the signer intended.
    if (parts.length !== 7) return null;

    const [version, siteId, campaignId, productId, expiresAtRaw, nonce, signature] = parts;
    if (version !== TOKEN_VERSION) return null;
    for (const value of [siteId, campaignId, productId, nonce]) {
        if (!SAFE_FIELD.test(value)) return null;
    }
    if (!/^[0-9]{1,15}$/.test(expiresAtRaw)) return null;

    const expiresAt = Number.parseInt(expiresAtRaw, 10);
    const claims: AdPlacementClaims = { siteId, campaignId, productId, expiresAt, nonce };

    // Signature BEFORE expiry: an expired token and a forged one should be indistinguishable in how
    // long they take to reject, and the expiry of an unsigned token means nothing anyway.
    const expected = await hmacSha256Hex(secret, payloadOf(claims));
    if (!timingSafeEqualHex(expected, signature)) return null;
    if (!Number.isFinite(expiresAt) || expiresAt <= nowSeconds) return null;

    return claims;
}

// The idempotency key a verified token yields. Derived from the nonce alone: the same token must map
// to the same key every time, and two different tokens must never collide.
export function adEventIdempotencyKey(claims: AdPlacementClaims): string {
    return `ad.event:${claims.nonce}`;
}
