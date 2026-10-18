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
const recoveryFile = 'services/api-gateway/src/lib/gift-card-refund-recovery.ts';

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
    assert.deepEqual(found, [...routeFiles,recoveryFile].sort(),
        'a refund path restores gift cards without this guard covering it — add it, then make sure it restores loyalty too');
});

const code = file => readFileSync(join(root,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' ');
function assertPaired(source) {
    const calls=[...source.matchAll(/\.rpc\('restore_gift_card_on_refund'/g)];
    assert.ok(calls.length>0);
    for (const call of calls) {
        const block=source.slice(call.index,call.index+1200);
        assert.match(block,/p_store_id: tenant\.siteId/);
        assert.match(block,/p_order_id: orderId/);
        assert.match(block,/await tryRestoreRedeemedLoyalty\(db,\s*\{\s*\.\.\.tenant,\s*orderId\s*\}\)/,
            'every gift-card restoration must be followed by the loyalty recovery with the same tenant and order');
    }
}
for (const file of routeFiles) {
    test(`${file} pairs every direct gift-card restore with same-tenant loyalty recovery`, () => assertPaired(code(file)));
}
test('verified whole-order recovery pairs both instruments in the refund completion handler',()=>{
    const orders=code(routeFiles[0]);
    const calls=[...orders.matchAll(/await tryRestoreGiftCardForReversedOrder\(db,/g)];
    assert.equal(calls.length,1);
    assert.match(orders.slice(calls[0].index,calls[0].index+300),
        /tryRestoreGiftCardForReversedOrder\(db,\s*\{\s*\.\.\.tenant,\s*orderId\s*\},\s*data\.order\);\s*await tryRestoreRedeemedLoyalty\(db,\s*\{\s*\.\.\.tenant,\s*orderId\s*\}\)/);
    const recovery=code(recoveryFile);
    assert.match(recovery,/order\.id!==input\.orderId\|\|order\.store_id!==input\.siteId/);
    assert.match(recovery,/p_store_id:input\.siteId,p_order_id:input\.orderId/);
});
test('loyalty helper binds the actual RPC to the supplied tenant and order',()=>{
    const helper=code('services/api-gateway/src/lib/loyalty-refund-recovery.ts');
    assert.match(helper,/\.rpc\('restore_loyalty_on_refund',\s*\{\s*p_site_id: input\.siteId, p_order_id: input\.orderId/);
    assert.ok(helper.includes(LOYALTY_RPC));
});
test('the co-location guard rejects a deleted recovery call or a different tenant',()=>{
    const source=code(routeFiles[1]);
    assert.throws(()=>assertPaired(source.replace('await tryRestoreRedeemedLoyalty','await unrelated')));
    assert.throws(()=>assertPaired(source.replace('p_store_id: tenant.siteId','p_store_id: body.siteId')));
});
