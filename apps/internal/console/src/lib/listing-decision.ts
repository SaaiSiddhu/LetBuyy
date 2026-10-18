// F-ADM4-1 — the request body admin_web's moderation queue sends to the gateway, built in one place.
//
// The gateway's OperatorListingDecisionSchema (services/api-gateway/src/schemas/channel-listing.schema.ts)
// is `.strict()` and REQUIRES idempotency_key. The queue used to send `{}` for approve and `{ reason }` for
// reject/take-down, so every decision was refused 400 before it could reach transition_channel_listing.
// tests/contracts/admin-listing-decision-body.test.ts parses what this builds with the gateway's own schema,
// so the two cannot drift apart again.

export const LISTING_DECISIONS = ['approve', 'reject', 'take-down'] as const;
export type ListingDecision = (typeof LISTING_DECISIONS)[number];

/// The gateway enforces the same bounds (validateSensitiveReason). They are repeated here so a reviewer is
/// told before the round trip, not after; the server action still refuses, so the form limit is a courtesy.
export const MIN_DECISION_REASON = 8;
export const MAX_DECISION_REASON = 1000;
const MAX_IDEMPOTENCY_KEY = 200;

/// One key per rendered decision form. A double submit of the same form carries the same key, so
/// transition_channel_listing replays the first decision instead of recording a second one.
export function newListingDecisionKey(decision: ListingDecision, listingId: string): string {
    return `admin-web:listing:${decision}:${listingId}:${crypto.randomUUID()}`;
}

export function newListingClaimKey(listingId: string): string {
    return `admin-web:listing:claim:${listingId}:${crypto.randomUUID()}`;
}

export function newListingAssignmentKey(listingId: string): string {
    return `admin-web:listing:assign:${listingId}:${crypto.randomUUID()}`;
}

export function buildListingDecisionBody(input: {
    decision: ListingDecision;
    reason: string;
    idempotencyKey: string;
    operatorUserId: string;
}): { idempotency_key: string; operator_user_id: string; reason?: string } {
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY) {
        throw new Error('This decision could not be submitted. Reload the page and try again.');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operatorUserId)) {
        throw new Error('The signed-in operator identity is unavailable. Sign in again before deciding.');
    }

    // A negative moderation decision with nothing recorded is one nobody can audit or explain to the
    // merchant afterwards; the gateway refuses it too.
    const reason = input.reason.trim();
    if (input.decision !== 'approve' && (reason.length < MIN_DECISION_REASON || reason.length > MAX_DECISION_REASON)) {
        throw new Error(`A ${input.decision} requires a reason of ${MIN_DECISION_REASON} to ${MAX_DECISION_REASON} characters.`);
    }

    return reason
        ? { idempotency_key: idempotencyKey, operator_user_id: input.operatorUserId, reason }
        : { idempotency_key: idempotencyKey, operator_user_id: input.operatorUserId };
}
