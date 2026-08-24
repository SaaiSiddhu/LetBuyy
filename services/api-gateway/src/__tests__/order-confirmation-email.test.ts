import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { enqueueOrderConfirmationEmail } from '../lib/order-confirmation-email';
import { enqueueContactOwnerNotificationEmail } from '../lib/transactional-email';
import type { Env } from '../index';

type QueryResponse = {
    data?: unknown;
};

function createQuery(response: QueryResponse) {
    return {
        select() { return this; },
        eq() { return this; },
        order() { return Promise.resolve(response); },
        maybeSingle() { return Promise.resolve(response); },
    };
}

function createDb() {
    return {
        from(table: string) {
            if (table === 'orders') {
                return createQuery({
                    data: {
                        id: 'order-1',
                        store_id: 'store-1',
                        order_number: 'LB-1001',
                        customer_name: 'Asha',
                        customer_email: 'asha@example.com',
                        total: '1299.00',
                        currency: 'INR',
                    },
                });
            }

            if (table === 'order_items') {
                return createQuery({
                    data: [
                        {
                            title: 'Urban Runner',
                            quantity: 2,
                            unit_price: '499.50',
                            total: '999.00',
                        },
                        {
                            title: 'Shipping',
                            quantity: 1,
                            unit_price: '300.00',
                            total: '300.00',
                        },
                    ],
                });
            }

            throw new Error(`Unexpected table ${table}`);
        },
    } as unknown as SupabaseClient;
}

test('order confirmation email queues one relational receipt payload with deterministic idempotency', async () => {
    const sent: Array<Record<string, unknown>> = [];
    const env = {
        ENVIRONMENT: 'test',
        RESEND_API_KEY: 'SKIP_NEEDS_HUMAN_TEST_RESEND_API_KEY',
        NOTIFICATION_QUEUE: {
            send: async (body: Record<string, unknown>) => {
                sent.push(body);
            },
        },
    } as unknown as Pick<Env, 'NOTIFICATION_QUEUE' | 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL' | 'ENVIRONMENT'>;

    await enqueueOrderConfirmationEmail(env, createDb(), {
        orderId: 'order-1',
        storeId: 'store-1',
        requestId: 'req-1',
        idempotencyKey: 'paid-event-1',
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.jobType, 'email.order_confirmation');
    assert.equal(sent[0]?.idempotencyKey, 'email.order_confirmation:store-1:order-1');
    assert.equal(sent[0]?.siteId, 'store-1');
    assert.match(JSON.stringify(sent[0]?.payload), /Urban Runner/);
    assert.match(JSON.stringify(sent[0]?.payload), /INR 1299\.00/);
    assert.match(JSON.stringify(sent[0]?.payload), /asha@example\.com/);
});

test('transactional contact-owner email enqueues a signed tenant-scoped job', async () => {
    const sent: Array<Record<string, unknown>> = [];
    const env = {
        ENVIRONMENT: 'test',
        QUEUE_TENANT_ENVELOPE_SECRET: 'test-queue-envelope-secret',
        NOTIFICATION_QUEUE: {
            send: async (body: Record<string, unknown>) => {
                sent.push(body);
            },
        },
    } as unknown as Pick<
        Env,
        | 'NOTIFICATION_QUEUE'
        | 'INTERNAL_API_SECRET'
        | 'QUEUE_TENANT_ENVELOPE_SECRET'
        | 'ENVIRONMENT'
    >;

    await enqueueContactOwnerNotificationEmail(env, {
        submissionId: 'contact-1',
        storeId: 'store-1',
        storeName: 'Urban Kicks',
        ownerEmail: 'owner@example.com',
        customerName: 'Asha',
        customerEmail: 'asha@example.com',
        customerPhone: '+919999999999',
        message: 'Do you ship to Mumbai?',
        requestId: 'req-contact',
    });

    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.jobType, 'email.contact_owner_notification');
    assert.equal(sent[0]?.idempotencyKey, 'email.contact_owner_notification:store-1:contact-1');
    assert.equal(sent[0]?.siteId, 'store-1');
    assert.match(JSON.stringify(sent[0]?.payload), /owner@example\.com/);
    assert.match(JSON.stringify(sent[0]?.payload), /Do you ship to Mumbai/);
    assert.equal(typeof sent[0]?.tenantEnvelope, 'object');
});

test('queue worker dispatches the canonical transactional email job allowlist', () => {
    const worker = readFileSync(new URL('../../../../services/queue-workers/src/index.ts', import.meta.url), 'utf8');

    assert.match(worker, /function isTransactionalEmailJob/);
    assert.match(worker, /jobType === 'email\.order_confirmation'/);
    assert.match(worker, /jobType === 'email\.employee_invite'/);
    assert.match(worker, /jobType === 'email\.contact_owner_notification'/);
    assert.match(worker, /!isTransactionalEmailJob\(delivery\.input\.jobType\)/);
    assert.match(worker, /invite_id: payload\.inviteId/);
    assert.match(worker, /contact_submission_id: payload\.contactSubmissionId/);
});
