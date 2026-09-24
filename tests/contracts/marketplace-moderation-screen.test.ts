// CAP-ADM-2 — the marketplace moderation screen's non-negotiables.
//
// A source contract, because the failure modes here are future edits rather than runtime bugs:
// nothing throws if a reject stops requiring a reason, and nothing fails a build if the screen starts
// reaching the gateway through a new API route.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildListingDecisionBody } from '../../apps/internal/console/src/lib/listing-decision';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = join(root, 'apps/internal/console/src/app/(dashboard)/marketplace-listings/page.tsx');
const page = readFileSync(pagePath, 'utf8');
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = stripComments(page);
// F-ADM4-1: the decision body — reason check included — is built in one place shared with the contract
// test that parses it against the gateway schema (tests/contracts/admin-listing-decision-body.test.ts).
const decisionCode = stripComments(readFileSync(join(root, 'apps/internal/console/src/lib/listing-decision.ts'), 'utf8'));

test('the moderation screen exists and lists the review queue', () => {
    // Without it nothing can reach 'approved', so marketplace_feed returns zero rows forever and
    // MKT-2, MKT-3, PHASE-ADM-1 and FB-2 are all inert.
    assert.ok(existsSync(pagePath));
    assert.match(code, /pending_review/);
    assert.match(code, /\/operations\/marketplace-listings/);
});

test('all three operator decisions are wired', () => {
    for (const decision of ['approve', 'reject', 'take-down']) {
        assert.ok(
            code.includes(`'${decision}'`) || code.includes(`/${decision}`),
            `the ${decision} decision must be reachable from the screen`,
        );
    }
});

test('reject and take down REQUIRE a reason', () => {
    // The gateway refuses a reasonless negative decision (validateSensitiveReason). If the screen
    // stopped requiring one, every rejection would round-trip and fail — and, worse, a reviewer could
    // believe a decision landed when it did not.
    //
    // F-ADM4-1 moved the check out of the page into lib/listing-decision.ts. Re-anchored stronger, not
    // looser: the page must route every decision through that builder, the builder must carry the check,
    // the builder must actually refuse (behaviour, not just text), and the textareas must stay required.
    assert.match(code, /const body = buildListingDecisionBody\(\{/);
    assert.match(decisionCode, /input\.decision !== 'approve'/);
    assert.match(decisionCode, /reason\.length < MIN_DECISION_REASON \|\| reason\.length > MAX_DECISION_REASON/);
    for (const decision of ['reject', 'take-down'] as const) {
        for (const reason of ['', '   ', 'short']) {
            assert.throws(
                () => buildListingDecisionBody({ decision, reason, idempotencyKey: 'admin-web:listing:test-key' }),
                /requires a reason/,
                `${decision} with reason ${JSON.stringify(reason)} must be refused before the round trip`,
            );
        }
    }
    assert.match(code, /required/);
});

test('the screen adds NO app-local API route', () => {
    // letbuyy-boundaries/no-new-next-api-route freezes them, and BUYER-4 has just been through that
    // collision. Reads use fetchConsoleApi and writes are server actions; a server action is not an
    // API route, so the freeze is respected rather than exempted.
    assert.ok(
        !existsSync(join(root, 'apps/internal/console/src/app/api/marketplace-listings')),
        'no API route directory may be added for this screen',
    );
    assert.match(code, /fetchConsoleApi/);
    assert.match(code, /'use server'/);
});

test('every decision re-checks the console session server-side', () => {
    // A server action is a public endpoint. Rendering the page behind auth does not protect the
    // actions, so each one must authenticate again rather than trusting that the page was reached.
    const actions = code.split("'use server';").slice(1);
    assert.equal(actions.length, 3, 'approve, reject and take down should each be a server action');
    for (const action of actions) {
        assert.match(
            action.slice(0, 400),
            /requireConsoleSession/,
            'each server action must re-check the console session before acting',
        );
    }
});

test('the screen composes @letbuyy/ui, not raw controls', () => {
    assert.match(code, /from '@letbuyy\/ui'/);
    for (const raw of ['<button', '<textarea', '<input']) {
        assert.ok(!code.includes(raw), `raw ${raw} bypasses the design system's tokens and a11y defaults`);
    }
});
