// APPID-P4d — what the marketplace app calls with the platform buyer session identity-platform minted
// for it (migration 259, D-ONE-IDENTITY).
//
// /buyer/account — who the session is. The app reads it after signing in and whenever it resumes,
// which is how an ended session (expiry, password reset, "sign out everywhere", a disabled account)
// reaches the app: requireBuyerSession refuses it and the app signs out.
//
// /buyer/firebase-link — the migration bridge. The app is still signed in to Firebase, and FB-4 moves
// each screen's Firestore data to its buyer; that needs to know which buyer a Firebase uid belongs to.
// This records it, and nothing else, when the Firebase ID token and the buyer session prove the same
// verified address. The uid is the verified token's subject, never a body field, and the buyer is the
// session's. link_buyer_firebase_uid never creates, merges or re-points an account.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import type { FirebaseTokenCheck } from '../../lib/firebase-id-token';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import { publicBuyerAccount, type BuyerAccountRow } from './buyer-account-routes';
import type { AppContext } from './customer-engagement-routes';

/// link_buyer_firebase_uid (259).
export type FirebaseLinkOutcome =
    | { outcome: 'linked' | 'already_linked' | 'conflict' | 'unverified' | 'email_mismatch' | 'buyer_unavailable' };

export interface BuyerAppRoutesDeps {
    loadBuyerById: (c: AppContext, id: string) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    verifyFirebaseToken: (c: AppContext, token: string) => Promise<FirebaseTokenCheck>;
    linkFirebaseUid: (
        c: AppContext,
        input: { buyerAccountId: string; firebaseUid: string; firebaseProject: string; firebaseEmail: string },
    ) => Promise<{ data: FirebaseLinkOutcome | null; error: unknown }>;
}

const failure = (code: string, message: string) => ({ success: false, error: { code, message } });

export function registerBuyerAppRoutes(router: Hono<{ Bindings: Env }>, deps: BuyerAppRoutesDeps): void {
    const { loadBuyerById, verifyFirebaseToken, linkFirebaseUid } = deps;

    router.get('/buyer/account', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);
        const { data: buyer, error } = await loadBuyerById(c, session.buyerAccountId);
        if (error) return c.json(dbFailureBody(), 500);
        if (!buyer) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);
        return c.json(success({ buyer: publicBuyerAccount(buyer) }), 200, { 'Cache-Control': 'no-store' });
    });

    router.post('/buyer/firebase-link', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);

        const body = await c.req.json().catch(() => null) as { id_token?: unknown } | null;
        if (typeof body?.id_token !== 'string' || !body.id_token) {
            return c.json(failure('INVALID_REQUEST', 'A Firebase ID token is required.'), 400);
        }

        const checked = await verifyFirebaseToken(c, body.id_token);
        if (!checked.ok) {
            if (checked.reason === 'unavailable') {
                return c.json(failure('FIREBASE_KEYS_UNAVAILABLE', 'Your old account could not be checked. Try again shortly.'), 503);
            }
            if (checked.reason === 'unlinkable') {
                return c.json(failure('FIREBASE_EMAIL_UNVERIFIED', 'Your old account has no verified email address to match.'), 422);
            }
            return c.json(failure('INVALID_FIREBASE_TOKEN', 'Your old account could not be verified. Sign in to it again.'), 400);
        }

        const { data: linked, error } = await linkFirebaseUid(c, {
            buyerAccountId: session.buyerAccountId,
            firebaseUid: checked.identity.uid,
            firebaseProject: checked.identity.project,
            firebaseEmail: checked.identity.email,
        });
        if (error || !linked) return c.json(dbFailureBody(), 500);

        switch (linked.outcome) {
            case 'linked':
            case 'already_linked':
                return c.json(success({ linked: true, outcome: linked.outcome }));
            case 'unverified':
                return c.json(failure('EMAIL_NOT_VERIFIED', 'Verify your LetBuyy email address first.'), 403);
            case 'email_mismatch':
                return c.json(failure('EMAIL_MISMATCH', 'Your old account uses a different email address.'), 409);
            case 'conflict':
                return c.json(failure('FIREBASE_LINK_CONFLICT', 'Your old account is already linked to another LetBuyy account.'), 409);
            case 'buyer_unavailable':
                return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
            default:
                return c.json(dbFailureBody(), 500);
        }
    });
}
