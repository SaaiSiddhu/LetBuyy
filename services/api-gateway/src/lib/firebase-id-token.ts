// APPID-P4d — verifies a Firebase ID token for ONE purpose: recording which Firebase user a LetBuyy
// buyer is (buyer_firebase_links, migration 259), so FB-4 can move each screen's Firestore data to the
// right buyer. A verified token here grants nothing: no session, no access, no account. Firebase is
// never an issuer for LetBuyy (ART-05). This file is retired with the Firebase project at FB-5.
//
// The checks are Firebase's own list for verifying an ID token with a third-party JWT library:
// RS256, signed by a key Google publishes for securetoken@system.gserviceaccount.com; aud is the
// project; iss is https://securetoken.google.com/<project>; sub is a non-empty uid of at most 128
// characters; iat and auth_time are in the past; exp is in the future.
//
// Linking also needs an address both sides have PROVEN, so the token must carry email_verified ===
// true, and come from a provider that proves the address: Firebase email/password (true only after
// the user followed Firebase's verification link) or Google. Anonymous, phone and custom-token users
// carry no proven address and cannot be linked this way; that is reported, never guessed around.

import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

/// The live marketplace app's Firebase project. A public identifier (it is in the app's own config),
/// not a secret; named here because this bridge serves exactly this project and dies with it.
export const FIREBASE_PROJECT_ID = 'letbuy-y';

const GOOGLE_SIGNING_KEYS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const LINKABLE_PROVIDERS = new Set(['password', 'google.com']);
const CLOCK_TOLERANCE_SECONDS = 60;

// Google's public keys, cached by jose per isolate. A cache of public keys is disposable: losing it
// costs one fetch, and it decides nothing about orders, money or tenants.
let securetokenKeys: JWTVerifyGetKey | null = null;
export function firebaseSigningKeys(): JWTVerifyGetKey {
    securetokenKeys ??= createRemoteJWKSet(new URL(GOOGLE_SIGNING_KEYS_URL), { timeoutDuration: 5000 });
    return securetokenKeys;
}

export interface FirebaseIdentity {
    uid: string;
    email: string;
    project: string;
}

export type FirebaseTokenCheck =
    | { ok: true; identity: FirebaseIdentity }
    /// invalid: not a valid ID token for this project. unlinkable: valid, but carries no proven
    /// address. unavailable: Google's keys could not be fetched, so nothing was decided.
    | { ok: false; reason: 'invalid' | 'unlinkable' | 'unavailable' };

// jose's codes for a token that is wrong, as opposed to a key set that could not be read.
const TOKEN_ERROR_CODES = new Set([
    errors.JWTExpired.code,
    errors.JWTClaimValidationFailed.code,
    errors.JWTInvalid.code,
    errors.JWSInvalid.code,
    errors.JWSSignatureVerificationFailed.code,
    errors.JOSEAlgNotAllowed.code,
    errors.JOSENotSupported.code,
    errors.JWKSNoMatchingKey.code,
    errors.JWKSMultipleMatchingKeys.code,
]);

export async function verifyFirebaseIdToken(
    token: string,
    keys: JWTVerifyGetKey,
    options: { projectId?: string; now?: Date } = {},
): Promise<FirebaseTokenCheck> {
    const projectId = options.projectId ?? FIREBASE_PROJECT_ID;
    if (typeof token !== 'string' || token.length === 0 || token.length > 8192) return { ok: false, reason: 'invalid' };

    let payload: Record<string, unknown>;
    try {
        ({ payload } = await jwtVerify(token, keys, {
            algorithms: ['RS256'],
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
            requiredClaims: ['sub', 'iat', 'exp', 'auth_time'],
            clockTolerance: CLOCK_TOLERANCE_SECONDS,
            currentDate: options.now,
        }));
    } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        return { ok: false, reason: typeof code === 'string' && TOKEN_ERROR_CODES.has(code) ? 'invalid' : 'unavailable' };
    }

    const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000) + CLOCK_TOLERANCE_SECONDS;
    const uid = payload.sub;
    if (typeof uid !== 'string' || uid.length === 0 || uid.length > 128) return { ok: false, reason: 'invalid' };
    if (typeof payload.iat !== 'number' || payload.iat > nowSeconds) return { ok: false, reason: 'invalid' };
    if (typeof payload.auth_time !== 'number' || payload.auth_time > nowSeconds) return { ok: false, reason: 'invalid' };

    const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined;
    const provider = typeof firebase?.sign_in_provider === 'string' ? firebase.sign_in_provider : null;
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!provider || !LINKABLE_PROVIDERS.has(provider) || payload.email_verified !== true || !email) {
        return { ok: false, reason: 'unlinkable' };
    }

    return { ok: true, identity: { uid, email, project: projectId } };
}
