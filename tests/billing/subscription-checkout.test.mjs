import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const BILLING_CORE_SOURCE = 'packages/billing-core/src/index.ts';
const RAZORPAY_ADAPTER_SOURCE = 'packages/infrastructure/razorpay-adapter/index.ts';

function loadTypeScriptModule(sourcePath, requireMap) {
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier in requireMap) return requireMap[specifier];
      throw new Error(`Unexpected test require from ${sourcePath}: ${specifier}`);
    },
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    atob: globalThis.atob ?? ((value) => Buffer.from(value, 'base64').toString('binary')),
    btoa: globalThis.btoa ?? ((value) => Buffer.from(value, 'binary').toString('base64')),
    fetch: globalThis.fetch,
    Response: globalThis.Response,
    URL,
    Date,
    Math,
    Number,
    Boolean,
    String,
    RegExp,
    JSON,
    Uint8Array,
    Array,
    ArrayBuffer,
    Set,
    Object,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });
  return module.exports;
}

function createSchema(parseFn = (value) => ({ success: true, data: value })) {
  const schema = function schema() {};
  const chain = new Proxy(schema, {
    get(target, property) {
      if (property === 'safeParse') return parseFn;
      if (property === 'parse') return (value) => parseFn(value).data;
      return () => chain;
    },
    apply: () => chain,
  });
  return chain;
}

function createZodStub() {
  const generic = createSchema();
  const z = {
    string: () => generic,
    number: () => generic,
    unknown: () => generic,
    enum: () => generic,
    array: () => generic,
    record: () => generic,
    object: (shape) => createSchema((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { success: false, error: new Error('Expected object') };
      }

      const record = { ...value };
      if (shape?.quantity && record.quantity === undefined) record.quantity = 1;
      return { success: true, data: record };
    }),
  };

  return { z };
}

const billingCore = loadTypeScriptModule(BILLING_CORE_SOURCE, {
  zod: createZodStub(),
});

const paymentsMock = {
  inrMoney(amountMinor) {
    return { currency: 'INR', amountMinor };
  },
  normalizeIdempotencyKey(value) {
    return String(value || '').trim();
  },
  normalizePaymentMoney(value) {
    if (typeof value === 'number') return { currency: 'INR', amountMinor: value };
    return {
      currency: value?.currency || 'INR',
      amountMinor: Number(value?.amountMinor || value?.amount_minor || 0),
    };
  },
};

const razorpayAdapter = loadTypeScriptModule(RAZORPAY_ADAPTER_SOURCE, {
  '@letbuyy/payments': paymentsMock,
});

test('billing core plans recurring Razorpay subscriptions with merchant-approved usage add-ons', async () => {
  const approvedUsageCharges = billingCore.normalizeMerchantApprovedUsageCharges([
    {
      meter_name: 'api_requests',
      description: 'API request overage',
      amount_minor: 2500,
      quantity: 2,
      idempotency_key: 'usage-api-requests-june',
    },
  ]);
  const checkout = billingCore.planMerchantRazorpayBillingCheckout({
    plan: {
      id: 'plan_row_business',
      slug: 'business',
      name: 'Business',
      price_monthly_inr: 99900,
      price_yearly_inr: 79900,
      razorpay_plan_id_monthly: 'plan_rzp_business_monthly',
      razorpay_plan_id_yearly: 'plan_rzp_business_yearly',
    },
    storeId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    billingPeriod: 'monthly',
    approvedUsageCharges,
    nowMs: 1_780_272_000_000,
  });

  assert.equal(checkout.mode, 'razorpay_subscription');
  assert.equal(checkout.amount_minor, 99900);
  assert.equal(checkout.subscription.plan_id, 'plan_rzp_business_monthly');
  assert.equal(checkout.subscription.total_count, 1200);
  assert.equal(checkout.subscription.addons.length, 1);
  assert.equal(checkout.subscription.addons[0].item.amount, 2500);
  assert.equal(checkout.subscription.addons[0].quantity, 2);

  const requests = [];
  const result = await razorpayAdapter.createRazorpaySubscription(
    { keyId: 'rzp_test_key', keySecret: 'rzp_test_secret' },
    checkout.subscription,
    {
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(JSON.stringify({
          id: 'sub_test_business_monthly',
          status: 'created',
          short_url: 'https://rzp.io/i/sub-test',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    },
  );

  assert.equal(result.id, 'sub_test_business_monthly');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.razorpay.com/v1/subscriptions');
  assert.equal(
    requests[0].init.headers.Authorization,
    `Basic ${Buffer.from('rzp_test_key:rzp_test_secret').toString('base64')}`,
  );

  const requestBody = JSON.parse(requests[0].init.body);
  assert.equal(requestBody.plan_id, 'plan_rzp_business_monthly');
  assert.equal(requestBody.customer_notify, true);
  assert.equal(requestBody.notes.store_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(requestBody.addons[0].item.name, 'API request overage');
});

test('billing checkout keeps order fallback and verifies the correct Razorpay signature payloads', () => {
  const fallback = billingCore.planMerchantRazorpayBillingCheckout({
    plan: {
      id: 'plan_row_starter',
      slug: 'starter',
      name: 'Starter',
      price_monthly_inr: 39900,
      price_yearly_inr: 29900,
      razorpay_plan_id_monthly: null,
      razorpay_plan_id_yearly: null,
    },
    storeId: '33333333-3333-4333-8333-333333333333',
    userId: '44444444-4444-4444-8444-444444444444',
    billingPeriod: 'yearly',
    nowMs: 1_780_272_000_000,
  });

  assert.equal(fallback.mode, 'razorpay_order');
  assert.equal(fallback.amount_minor, 358800);
  assert.equal(fallback.order.amount, 358800);
  assert.equal(fallback.order.receipt, 'sub_33333333_1780272000000');
  assert.equal(
    billingCore.razorpayBillingSignaturePayload({ orderId: 'order_test', paymentId: 'pay_test' }),
    'order_test|pay_test',
  );
  assert.equal(
    billingCore.razorpayBillingSignaturePayload({ subscriptionId: 'sub_test', paymentId: 'pay_test' }),
    'pay_test|sub_test',
  );
});

test('billing core exposes India-first tier defaults and free activation planning', () => {
  const tiers = billingCore.getStoreBillingTierDefinitions();
  assert.deepEqual(JSON.parse(JSON.stringify(tiers.map((tier) => tier.slug))), ['free', 'starter', 'business', 'enterprise']);
  assert.equal(tiers.find((tier) => tier.slug === 'free').price_monthly_inr, 0);
  assert.equal(tiers.find((tier) => tier.slug === 'starter').price_monthly_inr, 39900);
  assert.equal(tiers.find((tier) => tier.slug === 'business').price_monthly_inr, 99900);

  const freeCheckout = billingCore.planMerchantRazorpayBillingCheckout({
    plan: {
      id: 'plan_row_free',
      slug: 'free',
      name: 'Free',
      price_monthly_inr: 0,
      price_yearly_inr: 0,
      razorpay_plan_id_monthly: null,
      razorpay_plan_id_yearly: null,
    },
    storeId: '55555555-5555-4555-8555-555555555555',
    userId: '66666666-6666-4666-8666-666666666666',
    billingPeriod: 'monthly',
  });

  assert.equal(freeCheckout.mode, 'free_activation');
  assert.equal(freeCheckout.amount_minor, 0);
  assert.equal(freeCheckout.order, undefined);
  assert.equal(freeCheckout.subscription, undefined);
});

test('billing entitlement snapshots gate usage limits in test mode', () => {
  const freeSnapshot = billingCore.resolvePlanEntitlementSnapshot('free');
  assert.equal(freeSnapshot.limits.products, 25);
  assert.equal(freeSnapshot.entitlements.custom_domain, false);

  const atLimit = billingCore.evaluatePlanLimit({
    plan: 'free',
    limitName: 'products',
    currentUsage: 25,
    increment: 1,
  });
  assert.equal(atLimit.allowed, false);
  assert.equal(atLimit.limit, 25);

  const businessAllowed = billingCore.evaluatePlanLimit({
    plan: 'business',
    limitName: 'products',
    currentUsage: 999,
    increment: 1,
  });
  assert.equal(businessAllowed.allowed, true);
  assert.equal(businessAllowed.limit, 1000);
});
