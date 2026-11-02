import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { Gateway, gatewayEnv, newIdentityKeys } from './gateway-harness';

const owned = requireOwnedDatabase();
let gateway: Gateway;
after(async () => { await gateway?.settle(); });

type CompareItem = { label: string; description: string; launch: boolean | string; growth: boolean | string; scale: boolean | string; commerce_os: boolean | string };
type CompareGroup = { category: string; items: CompareItem[] };

test('public pricing shows provider gates and survives paired catalog rollback', async () => {
    gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
    const readPlans = async () => {
        const response = await gateway.request('/v1/pricing');
        assert.equal(response.status, 200, response.text);
        const plans = response.json?.data?.plans as Array<{ slug: string; compare_features: CompareGroup[] }>;
        assert.deepEqual(plans.map(plan => plan.slug), ['launch', 'growth', 'scale', 'commerce_os']);
        return plans;
    };
    const findItem = (plan: { compare_features: CompareGroup[] }, category: string, label: string) =>
        plan.compare_features.find(group => group.category === category)?.items.find(item => item.label === label);

    const gated = await readPlans();
    for (const plan of gated) {
        const kyc = findItem(plan, 'Security', 'Private KYC document upload');
        assert.ok(kyc, `${plan.slug} must explain the KYC setup gate`);
        assert.equal(kyc.description, 'Secure storage and provider onboarding are required before this feature opens.');
        for (const slug of ['launch', 'growth', 'scale', 'commerce_os'] as const) assert.equal(kyc[slug], 'In setup');
        const payments = findItem(plan, 'Payments', 'Payment records');
        assert.ok(payments, `${plan.slug} must describe records rather than provider settlements`);
        assert.equal(payments.description, 'View order payment records; provider statements show actual settlements, fees, refunds and holds.');
        assert.equal(findItem(plan, 'Payments', 'Wallet & payouts'), undefined);
        assert.equal(findItem(plan, 'Security', 'KYC verification'), undefined);
    }

    const down = readFileSync(new URL('../../../../../database/supabase/rollback/423_provider_gated_pricing_copy.rollback.sql', import.meta.url), 'utf8');
    const up = readFileSync(new URL('../../../../../database/supabase/migrations/423_provider_gated_pricing_copy.sql', import.meta.url), 'utf8');
    owned.script(down);
    const rolledBack = await readPlans();
    for (const plan of rolledBack) {
        assert.ok(findItem(plan, 'Payments', 'Wallet & payouts'));
        const kyc = findItem(plan, 'Security', 'KYC verification');
        assert.ok(kyc);
        for (const slug of ['launch', 'growth', 'scale', 'commerce_os'] as const) assert.equal(kyc[slug], true);
    }
    owned.script(up);
    assert.deepEqual(await readPlans(), gated, 'forward replay must restore exactly the public plan catalog');
});
