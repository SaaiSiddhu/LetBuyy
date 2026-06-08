import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StorefrontCreateOrderSchema,
  assessOrderRisk,
  assertBrandingIsDataOnly,
  generateGstInvoice,
  normalizeCheckoutChannel,
  planDiscountStack,
  planCheckoutStateTransition,
  planShippingServiceability,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';

test('storefront order creation requires idempotency and bounded cart lines', () => {
  const validOrder = {
    customer: {
      name: 'Asha Merchant',
      email: 'asha@example.test',
      address: {
        address: '221 MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '400001',
      },
    },
    items: [{ productId: PRODUCT_ID, quantity: 2 }],
    paymentMethod: 'cod',
    idempotencyKey: 'checkout-order-001',
  };

  assert.equal(StorefrontCreateOrderSchema.safeParse(validOrder).success, true);
  assert.equal(StorefrontCreateOrderSchema.safeParse({ ...validOrder, idempotencyKey: 'short' }).success, false);
  assert.equal(
    StorefrontCreateOrderSchema.safeParse({ ...validOrder, items: [{ productId: PRODUCT_ID, quantity: 1_000 }] }).success,
    false,
  );
  assert.equal(StorefrontCreateOrderSchema.safeParse({ ...validOrder, paymentMethod: 'wire' }).success, false);
});

test('GST invoice generation separates intra-state CGST/SGST from inter-state IGST', () => {
  const base = {
    order_id: 'order_1',
    order_number: 'LB-1001',
    invoice_date: '2026-06-06T00:00:00.000Z',
    currency: 'INR',
    supplier: {
      name: 'LetBuyy Seller',
      gstin: '27ABCDE1234F1Z5',
      state_code: '27',
    },
    lines: [{
      product_id: PRODUCT_ID,
      description: 'Kurta',
      hsn_code: '6204',
      quantity: 2,
      unit_amount_minor: 10_000,
      gst_rate_bps: 1_800,
    }],
  };

  const intraState = generateGstInvoice({
    ...base,
    recipient: { name: 'Mumbai Buyer', gstin: '27ABCDE1234F1Z5', state_code: '27' },
    place_of_supply_state_code: '27',
  });
  assert.equal(intraState.supply_type, 'intra_state');
  assert.equal(intraState.cgst_amount_minor, 1_800);
  assert.equal(intraState.sgst_amount_minor, 1_800);
  assert.equal(intraState.igst_amount_minor, 0);
  assert.equal(intraState.total_amount_minor, 23_600);

  const interState = generateGstInvoice({
    ...base,
    recipient: { name: 'Bengaluru Buyer', gstin: '29ABCDE1234F1Z5', state_code: '29' },
    place_of_supply_state_code: '29',
  });
  assert.equal(interState.supply_type, 'inter_state');
  assert.equal(interState.cgst_amount_minor, 0);
  assert.equal(interState.sgst_amount_minor, 0);
  assert.equal(interState.igst_amount_minor, 3_600);
  assert.equal(interState.total_amount_minor, 23_600);

  const tcsInvoice = generateGstInvoice({
    ...base,
    recipient: { name: 'Bengaluru Buyer', gstin: '29ABCDE1234F1Z5', state_code: '29' },
    place_of_supply_state_code: '29',
    marketplace_tcs_bps: 100,
  });
  assert.equal(tcsInvoice.tcs_amount_minor, 200);
  assert.equal(tcsInvoice.marketplace_tcs_bps, 100);
  assert.match(tcsInvoice.irp.irn, /^MOCK-IRN-/);
  assert.match(tcsInvoice.irp.qr_payload, /^letbuyy:\/\/gst-invoice\//);
});

test('discount stack planner applies product, order, and shipping classes deterministically', () => {
  const plan = planDiscountStack({
    subtotalMinor: 10_000,
    shippingMinor: 500,
    candidates: [
      {
        id: 'order-10',
        code: 'ORDER10',
        discountClass: 'order',
        amountMinor: 1_000,
        priority: 20,
        combinesWith: { product: true, shipping: true },
      },
      {
        id: 'ship-free',
        code: 'FREESHIP',
        discountClass: 'shipping',
        amountMinor: 900,
        priority: 10,
        combinesWith: { product: true, order: true },
      },
      {
        id: 'product-5',
        code: 'PRODUCT5',
        discountClass: 'product',
        amountMinor: 500,
        priority: 10,
        combinesWith: { order: true, shipping: true },
      },
    ],
  });

  assert.deepEqual(plan.allocations.map((allocation) => allocation.discountId), ['product-5', 'order-10', 'ship-free']);
  assert.equal(plan.allocations.find((allocation) => allocation.discountId === 'ship-free')?.amountMinor, 500);
  assert.equal(plan.totalDiscountMinor, 2_000);
  assert.deepEqual(plan.rejected, []);
});

test('discount stack planner rejects non-combinable discounts instead of reordering them', () => {
  const plan = planDiscountStack({
    subtotalMinor: 5_000,
    shippingMinor: 0,
    candidates: [
      { id: 'order-a', code: 'A', discountClass: 'order', amountMinor: 1_000, priority: 10 },
      {
        id: 'order-b',
        code: 'B',
        discountClass: 'order',
        amountMinor: 1_000,
        priority: 20,
        combinesWith: { order: true },
      },
    ],
  });

  assert.deepEqual(plan.allocations.map((allocation) => allocation.discountId), ['order-a']);
  assert.equal(plan.rejected[0]?.discountId, 'order-b');
  assert.equal(plan.rejected[0]?.reason, 'combine_blocked');
});

test('shipping serviceability planner enforces pincode, COD, amount, and weight limits', () => {
  const rules = [{
    provider: 'shiprocket' as const,
    pincode: '560001',
    serviceable: true,
    cod_available: true,
    min_cod_amount_minor: 10_000,
    max_cod_amount_minor: 100_000,
    min_weight_grams: 100,
    max_weight_grams: 5_000,
    estimated_days_min: 2,
    estimated_days_max: 5,
  }];

  assert.deepEqual(planShippingServiceability({
    store_id: STORE_ID,
    pincode: '560001',
    cod: true,
    order_amount_minor: 25_000,
    weight_grams: 500,
  }, rules), {
    pincode: '560001',
    serviceable: true,
    cod_available: true,
    provider: 'shiprocket',
    estimated_days_min: 2,
    estimated_days_max: 5,
    reason: 'matched_rule',
  });

  assert.equal(planShippingServiceability({
    store_id: STORE_ID,
    pincode: '560001',
    cod: true,
    order_amount_minor: 5_000,
    weight_grams: 500,
  }, rules).reason, 'amount_out_of_range');

  assert.equal(planShippingServiceability({
    store_id: STORE_ID,
    pincode: '999999',
    cod: false,
    order_amount_minor: 0,
    weight_grams: 500,
  }, rules).serviceable, false);
});

test('checkout state transitions move forward and stop at terminal states', () => {
  assert.deepEqual(planCheckoutStateTransition(null, 'contact'), { allowed: true, reason: 'initial' });
  assert.deepEqual(planCheckoutStateTransition('contact', 'delivery'), { allowed: true, reason: 'forward' });
  assert.deepEqual(planCheckoutStateTransition('delivery', 'contact'), { allowed: false, reason: 'backwards' });
  assert.deepEqual(planCheckoutStateTransition('completed', 'delivery'), { allowed: false, reason: 'terminal' });
  assert.equal(normalizeCheckoutChannel('whatsapp'), 'whatsapp');
  assert.equal(normalizeCheckoutChannel('unknown'), 'web');
});

test('store branding is constrained to data, not executable checkout code', () => {
  assert.equal(assertBrandingIsDataOnly({
    logo_url: 'https://cdn.example.test/logo.png',
    primary_color: '#111827',
    accent_color: '#2563EB',
    checkout_theme: 'system',
    tokens: { radius: 8 },
  }).tokens.radius, 8);

  assert.throws(() => assertBrandingIsDataOnly({
    primary_color: '#111827',
    accent_color: '#2563EB',
    checkout_theme: 'system',
    tokens: { malicious: '<script>alert(1)</script>' },
  }), /data-only/);
});

test('order risk heuristic requests COD confirmation without fraud ML', () => {
  const highRisk = assessOrderRisk({
    store_id: STORE_ID,
    payment_method: 'cod',
    order_total_minor: 125_000,
    pincode: '560001',
    phone: '9999999999',
    prior_rto_count: 2,
  });
  assert.equal(highRisk.risk_level, 'high');
  assert.equal(highRisk.actions.includes('request_cod_confirmation'), true);
  assert.equal(highRisk.actions.includes('hold_fulfillment'), true);
  assert.equal(highRisk.reasons.includes('prior_rto'), true);

  const prepaid = assessOrderRisk({
    store_id: STORE_ID,
    payment_method: 'upi',
    order_total_minor: 10_000,
    pincode: '560001',
    phone: '9999999999',
    prior_rto_count: 0,
  });
  assert.deepEqual(prepaid.actions, ['allow']);
  assert.equal(prepaid.risk_level, 'low');
});
