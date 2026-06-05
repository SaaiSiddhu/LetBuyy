import assert from 'node:assert/strict';
import test from 'node:test';
import {
    planScheduledDispatchQueueTriggers,
    scheduledDispatchHasPlatformQueueWork,
} from '../execution/cloudflare-queue-triggers';

test('scheduled dispatch planner emits runtime lifecycle triggers without platform drain work', () => {
    const plans = planScheduledDispatchQueueTriggers({
        status: 'completed',
        dispatcherId: 'dispatcher-1',
        workerId: 'worker-1',
        eventId: 'event-1',
        environment: 'staging',
    });

    assert.deepEqual(plans.map((plan) => plan.binding), ['EVENT_QUEUE', 'RUNTIME_QUEUE']);
    assert.equal(scheduledDispatchHasPlatformQueueWork({
        status: 'completed',
        dispatcherId: 'dispatcher-1',
        workerId: 'worker-1',
        eventId: 'event-1',
    }), false);
});

test('scheduled dispatch planner emits analytics, search, and notification drain triggers for platform queue work', () => {
    const plans = planScheduledDispatchQueueTriggers({
        status: 'completed',
        dispatcherId: 'dispatcher-2',
        workerId: 'worker-2',
        eventId: 'event-2',
        environment: 'production',
        outboxQueuedJobs: 3,
        queueClaimedJobs: 2,
        queueSucceededJobs: 2,
        webhookDeliveries: 1,
    });

    assert.deepEqual(plans.map((plan) => plan.binding), [
        'EVENT_QUEUE',
        'RUNTIME_QUEUE',
        'ANALYTICS_QUEUE',
        'SEARCH_QUEUE',
        'NOTIFICATION_QUEUE',
    ]);

    const searchTrigger = plans.find((plan) => plan.binding === 'SEARCH_QUEUE');
    assert.equal(searchTrigger?.jobType, 'platform.queue.drain');
    assert.equal(searchTrigger?.payload.platform_queue_name, 'search-indexing');

    const notificationTrigger = plans.find((plan) => plan.binding === 'NOTIFICATION_QUEUE');
    assert.equal(notificationTrigger?.jobType, 'platform.queue.drain');
    assert.equal(notificationTrigger?.payload.platform_queue_name, 'analytics-events');
    assert.equal(notificationTrigger?.payload.notification_side_effects, true);
});

test('scheduled dispatch planner does not emit drain triggers for failed dispatch events', () => {
    const plans = planScheduledDispatchQueueTriggers({
        status: 'failed',
        dispatcherId: 'dispatcher-3',
        workerId: 'worker-3',
        eventId: 'event-3',
        environment: 'production',
        outboxQueuedJobs: 5,
        error: 'claim failed',
    });

    assert.deepEqual(plans.map((plan) => plan.binding), ['EVENT_QUEUE', 'RUNTIME_QUEUE']);
    assert.equal(plans[0]?.payload.error, 'claim failed');
});
