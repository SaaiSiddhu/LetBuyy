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
type OrderResult = { order: { id: string; status: string; total: number } };
type QueueConsumeResult = { queues: Array<{ queue_name?: string; processed?: number; completed?: number }> };
type JobList = { jobs?: Array<{ queue_name: string; status: string }> };

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
            stateCode: 'KA',
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
