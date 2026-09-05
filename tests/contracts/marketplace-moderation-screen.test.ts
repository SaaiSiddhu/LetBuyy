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

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = join(root, 'apps/admin_web/src/app/(dashboard)/marketplace-listings/page.tsx');
const page = readFileSync(pagePath, 'utf8');
const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

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
    assert.match(code, /decision !== 'approve'/);
    assert.match(code, /reason\.length < MIN_REASON \|\| reason\.length > MAX_REASON/);
    assert.match(code, /required/);
});

test('the screen adds NO app-local API route', () => {
    // letbuyy-boundaries/no-new-next-api-route freezes them, and BUYER-4 has just been through that
    // collision. Reads use fetchConsoleApi and writes are server actions; a server action is not an
    // API route, so the freeze is respected rather than exempted.
    assert.ok(
        !existsSync(join(root, 'apps/admin_web/src/app/api/marketplace-listings')),
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
