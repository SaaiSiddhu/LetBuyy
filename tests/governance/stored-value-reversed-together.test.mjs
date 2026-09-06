// F-LOY-4 — the two stored-value instruments must be reversed by the SAME event, in the same place.
//
// Loyalty points became spendable as checkout tender in migration 234 and nothing gave them back,
// while a gift card redeemed on the same order was correctly restored. The defect was not that the
// restore was wrong — it was that one instrument had a reversal and the other did not, and nothing
// noticed. This guard makes that asymmetry a gate failure: wherever a refund restores a gift card,
// it must restore loyalty too.
//
// It deliberately checks CO-LOCATION rather than mere presence. Both calls existing in the codebase
// somewhere would satisfy a naive check while one of them sat behind a different condition — which
// is exactly how two reversals of the same event drift apart.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GIFT_CARD_RPC = "restore_gift_card_on_refund";
const LOYALTY_RPC = "restore_loyalty_on_refund";

// Every non-test source file that reverses a gift card on refund.
const routeFiles = ['services/api-gateway/src/routes/orders.ts', 'services/api-gateway/src/routes/order-risk.ts'];

test('the files that restore a gift card on refund are the ones this guard knows about', () => {
    // Non-vacuity, and a tripwire: a THIRD refund path that restores gift cards would not be covered
    // by the assertions below, so the guard fails until it is added here.
    // The CALL shape, not the bare name. Searching for the name alone returns six packages/lcis-*
    // files that merely mention it in analysis data — dev-time tooling, classified TOOLING and not a
    // runtime path. That is the mention-versus-use trap this repository keeps finding, and it would
    // have made this guard permanently red for files that call nothing.
    const found = execFileSync('git', ['grep', '-l', `.rpc('${GIFT_CARD_RPC}'`, '--', 'services', 'apps'], {
        cwd: root, encoding: 'utf8',
    }).split('\n').filter(Boolean).filter((f) => !/__tests__|\.test\./.test(f)).sort();
    assert.deepEqual(found, routeFiles.slice().sort(),
        'a refund path restores gift cards without this guard covering it — add it, then make sure it restores loyalty too');
});

for (const file of routeFiles) {
    const source = readFileSync(join(root, file), 'utf8');

    test(`${file} restores loyalty wherever it restores a gift card`, () => {
        const giftCard = source.indexOf(`'${GIFT_CARD_RPC}'`);
        const loyalty = source.indexOf(`'${LOYALTY_RPC}'`);
        assert.ok(giftCard > -1, 'sanity: this file is supposed to restore gift cards');
        assert.ok(loyalty > -1, `${file} reverses a gift card on refund but not loyalty points — a buyer who paid with points loses them`);

        // Co-located: the loyalty restore must sit within a short distance of the gift-card one, not
        // in some other branch reached under different conditions.
        assert.ok(Math.abs(loyalty - giftCard) < 1200,
            'the two reversals must sit together; separated, they drift apart under different conditions');
    });

    test(`${file} passes the resolved tenant, not request input, to the loyalty restore`, () => {
        const call = source.slice(source.indexOf(`'${LOYALTY_RPC}'`), source.indexOf(`'${LOYALTY_RPC}'`) + 400);
        assert.match(call, /p_site_id: tenant\.siteId/, 'the site must come from the resolved tenant');
        assert.match(call, /p_order_id: orderId/);
    });
}
