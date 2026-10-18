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
import { buildMarketplaceRevisionDiff, getSafeMarketplaceEvidenceLinks } from '../../apps/internal/console/src/lib/marketplace-revision-diff';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = join(root, 'apps/internal/console/src/app/(dashboard)/marketplace-listings/page.tsx');
const detailPath = join(root, 'apps/internal/console/src/app/(dashboard)/marketplace-listings/[id]/page.tsx');
const actionsPath = join(root, 'apps/internal/console/src/app/(dashboard)/marketplace-listings/actions.ts');
const page = readFileSync(pagePath, 'utf8');
const detail = readFileSync(detailPath, 'utf8');
const actions = readFileSync(actionsPath, 'utf8');
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = stripComments(page);
const detailCode = stripComments(detail);
const actionCode = stripComments(actions);
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
            actionCode.includes(`'${decision}'`) || detailCode.includes(`"${decision}"`),
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
    assert.match(actionCode, /const body = buildListingDecisionBody\(\{/);
    assert.match(decisionCode, /input\.decision !== 'approve'/);
    assert.match(decisionCode, /reason\.length < MIN_DECISION_REASON \|\| reason\.length > MAX_DECISION_REASON/);
    for (const decision of ['reject', 'take-down'] as const) {
        for (const reason of ['', '   ', 'short']) {
            assert.throws(
                () => buildListingDecisionBody({ decision, reason, idempotencyKey: 'admin-web:listing:test-key', operatorUserId: 'cccccccc-0000-4000-8000-0000000000c1' }),
                /requires a reason/,
                `${decision} with reason ${JSON.stringify(reason)} must be refused before the round trip`,
            );
        }
    }
    assert.match(detailCode, /reasonRequired/);
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
    assert.match(actionCode, /'use server'/);
});

test('every decision re-checks the console session server-side', () => {
    // A server action is a public endpoint. Rendering the page behind auth does not protect the
    // actions, so each one must authenticate again rather than trusting that the page was reached.
    assert.match(actionCode, /requireConsoleSession\(\{ mfa: true \}\)/, 'server action must re-check session and MFA before acting');
    for (const action of ['approveListing', 'rejectListing', 'takeDownListing']) assert.match(actionCode, new RegExp(`export async function ${action}`));
});

test('decisions require the reviewer to open submitted evidence and compare revisions first', () => {
    assert.match(code, /Review listing/);
    assert.match(detailCode, /Revision comparison/);
    assert.match(detailCode, /approved_product_snapshot/);
    assert.match(detailCode, /submitted_product_snapshot/);
    assert.match(detailCode, /noopener/);
    assert.doesNotMatch(code, /action=\{(approveListing|rejectListing|takeDownListing)\}/);
});

test('revision diff reports nested additions, removals and edits while evidence links reject unsafe schemes', () => {
    assert.deepEqual(buildMarketplaceRevisionDiff(
        { product: { name: 'Old name', tags: ['one'] }, obsolete: true },
        { product: { name: 'New name', tags: ['one', 'two'] }, added: false },
    ), [
        { path: 'product.name', before: 'Old name', after: 'New name' },
        { path: 'obsolete', before: 'true', after: '—' },
        { path: 'product.tags[1]', before: '—', after: 'two' },
        { path: 'added', before: '—', after: 'false' },
    ]);
    assert.deepEqual(getSafeMarketplaceEvidenceLinks({
        product: { images: ['https://images.example/item.png', 'javascript:alert(1)', '/relative.png'] },
        variants: [{ image_url: 'http://cdn.example/variant.png' }],
    }), ['https://images.example/item.png', 'http://cdn.example/variant.png']);
});

test('the screen composes @letbuyy/ui, not raw controls', () => {
    assert.match(detailCode, /from '@letbuyy\/ui'/);
    for (const raw of ['<button', '<textarea', '<input']) {
        assert.ok(!detailCode.includes(raw), `raw ${raw} bypasses the design system's tokens and a11y defaults`);
    }
});
