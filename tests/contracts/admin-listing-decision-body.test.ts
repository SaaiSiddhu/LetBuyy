// F-ADM4-1 — the moderation queue's request body must satisfy the gateway schema it is sent to.
//
// Two hand-declared shapes for one request body is the failure mode that let the React renderer's whole
// cart 400 silently for three months (memory: duplicate wire contracts). Here the admin_web page sent
// `{}` / `{ reason }` while the gateway's OperatorListingDecisionSchema is `.strict()` and requires
// idempotency_key, so every decision was refused. This parses what admin_web actually builds with the
// gateway's own schema — the two sides are compared, not described.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { OperatorListingDecisionSchema } from '../../services/api-gateway/src/schemas/channel-listing.schema';
import {
    LISTING_DECISIONS,
    buildListingDecisionBody,
    newListingDecisionKey,
} from '../../apps/internal/console/src/lib/listing-decision';

const testDir = dirname(fileURLToPath(import.meta.url));
const LISTING = 'cccccccc-0000-4000-8000-0000000000c1';
const REASON = 'Images show a counterfeit brand mark.';

test('every body the moderation queue builds is accepted by the gateway schema', () => {
    for (const decision of LISTING_DECISIONS) {
        const body = buildListingDecisionBody({
            decision,
            reason: decision === 'approve' ? '' : REASON,
            idempotencyKey: newListingDecisionKey(decision, LISTING),
        });
        const parsed = OperatorListingDecisionSchema.safeParse(body);
        assert.ok(parsed.success, `${decision}: ${JSON.stringify(parsed.error?.issues)}`);
    }
    // An approve may carry an optional note; it must still parse.
    assert.ok(OperatorListingDecisionSchema.safeParse(buildListingDecisionBody({
        decision: 'approve', reason: 'Checked against the brand register.', idempotencyKey: newListingDecisionKey('approve', LISTING),
    })).success);
});

test('the bodies the page sent before F-ADM4-1 are exactly the ones the gateway refuses', () => {
    // The defect, pinned: shown present in the old shapes so the passing test above means something.
    assert.equal(OperatorListingDecisionSchema.safeParse({}).success, false, 'approve sent {}');
    assert.equal(OperatorListingDecisionSchema.safeParse({ reason: REASON }).success, false, 'reject / take-down sent { reason }');
});

test('keys are per form and fit the gateway bound; a negative decision without a real reason is refused locally', () => {
    const first = newListingDecisionKey('approve', LISTING);
    const second = newListingDecisionKey('approve', LISTING);
    assert.notEqual(first, second, 'each rendered form gets its own key');
    assert.ok(first.length <= 200, 'within the schema max');
    assert.throws(() => buildListingDecisionBody({ decision: 'reject', reason: 'short', idempotencyKey: first }), /requires a reason/);
    assert.throws(() => buildListingDecisionBody({ decision: 'approve', reason: '', idempotencyKey: '   ' }), /could not be submitted/);
});

test('the page builds its body through buildListingDecisionBody and renders a key into every decision form', () => {
    const page = readFileSync(join(testDir, '../../apps/internal/console/src/app/(dashboard)/marketplace-listings/page.tsx'), 'utf8');
    assert.match(page, /const body = buildListingDecisionBody\(\{/);
    assert.match(page, /\{ method: 'POST', body \}/);
    assert.doesNotMatch(page, /body: reason \? \{ reason \} : \{\}/, 'the old key-less body must not come back');
    assert.equal((page.match(/name="idempotency_key"/g) || []).length, 3, 'approve, reject and take-down each carry a key');
});
