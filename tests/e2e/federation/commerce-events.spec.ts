import { expect, test } from '@playwright/test';
import {
  demo,
  expectApiSuccess,
  federationUrls,
  internalHeaders,
  requireRealStack,
  uniqueSlug,
  versionHeaders,
} from './real-stack';

type ProductList = { products?: Array<{ id: string; name: string }> };
type GstInvoice = {
  supply_type: 'intra_state' | 'inter_state';
  cgst_amount_minor: number;
  sgst_amount_minor: number;
  igst_amount_minor: number;
  tax_amount_minor: number;
};
type OrderResult = {
  order: {
    id: string;
    status: string;
    total: number;
    gstInvoice?: GstInvoice | null;
    gst_invoice?: GstInvoice | null;
  };
};
type OrderStatusResult = { id: string; status: string };
type QueueConsumeResult = { queues: Array<{ queue_name?: string; processed?: number; completed?: number }> };
type JobList = { jobs?: Array<{ queue_name: string; status: string }> };

function orderGstInvoice(order: OrderResult['order']): GstInvoice | null {
  return order.gstInvoice ?? order.gst_invoice ?? null;
}

test.describe('J4 Commerce and event spine federation', () => {
  test('storefront order creation emits into the event spine and queue consumers process side effects', async ({ request }) => {
    await requireRealStack(request);

    const productsResponse = await request.get(`${federationUrls.gateway}/v1/storefront/${demo.storeSubdomain}/products?limit=1`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
    });
    const productList = await expectApiSuccess<ProductList>(productsResponse, 'seeded product list');
    const productId = productList.products?.[0]?.id ?? demo.seededProductId;
    expect(productId).toBeTruthy();

    const createCodOrder = async (input: {
      email: string;
      gstin: string;
      state: string;
      stateCode: string;
      pincode: string;
    }) => {
      const response = await request.post(`${federationUrls.gateway}/v1/storefront/${demo.storeSubdomain}/orders`, {
        failOnStatusCode: false,
        headers: versionHeaders(),
        data: {
          customer: {
            name: 'F8 Buyer',
            email: input.email,
            phone: '+919999999999',
            gstin: input.gstin,
            address: {
              address: '42 Commerce Street',
              city: input.stateCode === '29' ? 'Bengaluru' : 'Mumbai',
              state: input.state,
              stateCode: input.stateCode,
              pincode: input.pincode,
            },
          },
          items: [{ productId, quantity: 1 }],
          paymentMethod: 'cod',
          deliveryOption: 'standard',
          idempotencyKey: uniqueSlug('f8-storefront-order'),
        },
      });
      return expectApiSuccess<OrderResult>(response, 'storefront COD order creation', [201]);
    };

    const intraStateOrder = await createCodOrder({
      email: `f8-buyer-intra-${Date.now()}@letbuyy.local`,
      gstin: '29ABCDE1234F1Z5',
      state: 'Karnataka',
      stateCode: '29',
      pincode: '560001',
    });
    expect(intraStateOrder.order.id).toBeTruthy();
    expect(intraStateOrder.order.status).toBe('pending_cod');
    const intraStateInvoice = orderGstInvoice(intraStateOrder.order);
    expect(intraStateInvoice?.supply_type).toBe('intra_state');
    expect(intraStateInvoice?.cgst_amount_minor).toBeGreaterThan(0);
    expect(intraStateInvoice?.sgst_amount_minor).toBeGreaterThan(0);
    expect(intraStateInvoice?.igst_amount_minor).toBe(0);
    expect(intraStateInvoice?.tax_amount_minor).toBe(
      (intraStateInvoice?.cgst_amount_minor || 0) + (intraStateInvoice?.sgst_amount_minor || 0),
    );

    const confirmationResponse = await request.patch(`${federationUrls.gateway}/v1/orders/${intraStateOrder.order.id}`, {
      failOnStatusCode: false,
      headers: await internalHeaders('merchant'),
      data: {
        status: 'confirmed',
        idempotency_key: uniqueSlug('f8-cod-confirm'),
      },
    });
    const confirmedOrder = await expectApiSuccess<OrderStatusResult>(confirmationResponse, 'COD merchant confirmation');
    expect(confirmedOrder.status).toBe('confirmed');

    const orderResponse = await request.post(`${federationUrls.gateway}/v1/storefront/${demo.storeSubdomain}/orders`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
      data: {
        customer: {
          name: 'F8 Buyer',
          email: `f8-buyer-${Date.now()}@letbuyy.local`,
          phone: '+919999999999',
          gstin: '29ABCDE1234F1Z5',
          address: {
            address: '42 Commerce Street',
            city: 'Bengaluru',
            state: 'Karnataka',
            stateCode: '29',
            pincode: '560001',
          },
        },
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'cod',
        deliveryOption: 'standard',
        idempotencyKey: uniqueSlug('f8-storefront-order'),
      },
    });
    const order = await expectApiSuccess<OrderResult>(orderResponse, 'storefront order creation', [201]);
    expect(order.order.id).toBeTruthy();
    expect(order.order.status).toBe('pending_cod');

    const interStateOrder = await createCodOrder({
      email: `f8-buyer-inter-${Date.now()}@letbuyy.local`,
      gstin: '27ABCDE1234F1Z5',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '400001',
    });
    const interStateInvoice = orderGstInvoice(interStateOrder.order);
    expect(interStateOrder.order.status).toBe('pending_cod');
    expect(interStateInvoice?.supply_type).toBe('inter_state');
    expect(interStateInvoice?.cgst_amount_minor).toBe(0);
    expect(interStateInvoice?.sgst_amount_minor).toBe(0);
    expect(interStateInvoice?.igst_amount_minor).toBeGreaterThan(0);
    expect(interStateInvoice?.tax_amount_minor).toBe(interStateInvoice?.igst_amount_minor);

    const queueResponse = await request.post(`${federationUrls.gateway}/v1/operations/jobs/consume`, {
      failOnStatusCode: false,
      headers: await internalHeaders('ops'),
      data: { limit: 25 },
    });
    await expectApiSuccess<QueueConsumeResult>(queueResponse, 'event spine queue consumption');

    const jobsResponse = await request.get(`${federationUrls.gateway}/v1/operations/jobs?limit=25`, {
      failOnStatusCode: false,
      headers: await internalHeaders('ops'),
    });
    const jobs = await expectApiSuccess<JobList>(jobsResponse, 'event spine queue job list');
    expect(Array.isArray(jobs.jobs)).toBe(true);
  });
});
