import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StorefrontCreateOrderSchema,
  generateGstInvoice,
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
});
