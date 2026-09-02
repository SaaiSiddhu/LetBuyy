import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const mcpSrc = join(repoRoot, 'apps/merchant_web/src');

function source(relativePath) {
    return readFileSync(join(mcpSrc, relativePath), 'utf8');
}

// ─── LB-34-A: StepUpDialog exists and covers both actions ────────────────────
test('LB-34-A: StepUpDialog component exists and references both step-up actions', () => {
    const src = source('components/security/StepUpDialog.tsx');

    assert.match(src, /refund\.approve/, 'StepUpDialog must reference refund.approve action');
    assert.match(src, /payout\.release/, 'StepUpDialog must reference payout.release action');
    assert.match(src, /StepUpAction/, 'StepUpAction type must be exported');
    assert.match(src, /StepUpResult/, 'StepUpResult type must be exported');
    assert.match(src, /onSuccess/, 'StepUpDialog must accept onSuccess callback');
    assert.match(src, /X-Step-Up-Token|step-up/, 'StepUpDialog must forward to step-up endpoint');
});

// ─── LB-34-B: Orders page contains Refund action wired to refund proxy ───────
test('LB-34-B: orders page imports StepUpDialog and contains Refund action wired to refund route', () => {
    const src = source('app/[store]/orders/page.tsx');

    assert.match(src, /StepUpDialog/, 'orders page must import StepUpDialog');
    assert.match(src, /refund\.approve/, 'orders page must pass refund.approve to StepUpDialog');
    assert.match(src, /\/orders\/.*\/refund/, 'orders page must call the refund proxy route');
    assert.match(src, /payment_status.*paid|paid.*payment_status/, 'orders page must gate Refund button on payment_status paid');
    assert.match(src, /handleRefundStepUpSuccess|onSuccess.*refund/, 'orders page must handle step-up success for refund');
});

// ─── LB-34-C: Refund proxy route forwards X-Step-Up-Token ────────────────────
test('LB-34-C: orders/[orderId]/refund proxy route forwards X-Step-Up-Token header', () => {
    const src = source('app/api/stores/[store]/orders/[orderId]/refund/route.ts');

    assert.match(src, /X-Step-Up-Token/, 'refund proxy must set X-Step-Up-Token header');
    assert.match(src, /X-Step-Up-Verified-At/, 'refund proxy must set X-Step-Up-Verified-At header');
    assert.match(
        src,
        /\/payments\/.*\/refund|payments.*paymentId.*refund/,
        'refund proxy must call gateway /payments/:id/refund'
    );
    assert.match(src, /payment_id|paymentId/, 'refund proxy must resolve payment_id from order');
});

// ─── LB-34-D: Payouts page exists with payout.release wiring ────────────────
test('LB-34-D: payouts page exists and wires payout.release through StepUpDialog', () => {
    const src = source('app/[store]/payouts/page.tsx');

    assert.match(src, /StepUpDialog/, 'payouts page must import StepUpDialog');
    assert.match(src, /payout\.release/, 'payouts page must pass payout.release to StepUpDialog');
    assert.match(
        src,
        /\/payouts\/.*\/settle|payouts.*payoutId.*settle/,
        'payouts page must call the settle proxy route'
    );
    assert.match(src, /Release/, 'payouts page must render a Release button for pending payouts');
});

// ─── LB-34-D2: Payouts proxy routes exist ────────────────────────────────────
test('LB-34-D2: payouts and payout settle proxy routes exist and forward step-up headers', () => {
    const listSrc = source('app/api/stores/[store]/payouts/route.ts');
    const settleSrc = source('app/api/stores/[store]/payouts/[payoutId]/settle/route.ts');

    assert.match(listSrc, /\/payouts/, 'payouts list proxy must call /payouts on gateway');
    assert.match(settleSrc, /X-Step-Up-Token/, 'payout settle proxy must forward X-Step-Up-Token');
    assert.match(settleSrc, /X-Step-Up-Verified-At/, 'payout settle proxy must forward X-Step-Up-Verified-At');
    assert.match(settleSrc, /\/settle/, 'payout settle proxy must call /payouts/:id/settle');
});

// ─── LB-34-E: Security settings page no longer renders BackendNeededPane ─────
test('LB-34-E: security settings page does not render BackendNeededPane', () => {
    const src = source('app/[store]/settings/security/page.tsx');

    assert.doesNotMatch(
        src,
        /BackendNeededPane/,
        'security settings page must not render BackendNeededPane'
    );
    assert.match(src, /two-factor|2fa|totp/i, 'security settings page must include 2FA/TOTP UI');
    assert.match(src, /enroll|Enroll|Set up/, 'security settings page must include enrollment flow');
});

// ─── LB-34-F: Step-up proxy routes exist ─────────────────────────────────────
test('LB-34-F: step-up and two-factor proxy routes exist with correct gateway paths', () => {
    const stepUpSrc = source('app/api/stores/[store]/security/step-up/route.ts');
    const enrollSrc = source('app/api/stores/[store]/security/two-factor/enroll/route.ts');
    const verifySrc = source('app/api/stores/[store]/security/two-factor/verify/route.ts');
    const disableSrc = source('app/api/stores/[store]/security/two-factor/disable/route.ts');
    const overviewSrc = source('app/api/stores/[store]/security/two-factor/route.ts');

    assert.match(stepUpSrc, /\/security\/step-up\/challenges/, 'step-up proxy must call /security/step-up/challenges');
    assert.match(enrollSrc, /\/2fa\/totp\/enroll/, '2fa enroll proxy must call /2fa/totp/enroll');
    assert.match(verifySrc, /\/2fa\/totp\/verify/, '2fa verify proxy must call /2fa/totp/verify');
    assert.match(disableSrc, /\/2fa\/disable/, '2fa disable proxy must call /2fa/disable');
    assert.match(overviewSrc, /\/2fa/, '2fa overview proxy must call /2fa');
});
