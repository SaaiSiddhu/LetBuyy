import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeferredGatewayHandler } from '../lib/deferred-worker';
import type { Env } from '../index';

const env = {} as Env;
function context() {
    const work: Promise<unknown>[] = [];
    const ctx = {
        waitUntil(value: Promise<unknown>) { work.push(value); },
        passThroughOnException() {},
    } as ExecutionContext;
    return { ctx, work };
}
function held<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>((resolve) => { release = resolve; });
    return { promise, release };
}
function runtime(response = new Response('canonical response')) {
    return { fetch: async () => response, scheduled: () => {} };
}

test('constructing the deployment entry does not initialize the application', () => {
    let calls = 0;
    createDeferredGatewayHandler(async () => { calls++; return runtime(); });
    assert.equal(calls, 0);
});

test('concurrent first requests share one initialization and retain the original responses', async () => {
    const ready = held<ReturnType<typeof runtime>>();
    let loads = 0;
    const handler = createDeferredGatewayHandler(() => { loads++; return ready.promise; });
    const { ctx } = context();
    const requests = [1, 2, 3].map(() => handler.fetch(new Request('https://api.letbuyy.com/v1/health'), env, ctx));
    await Promise.resolve();
    assert.equal(loads, 1);
    const response = new Response('canonical response');
    ready.release(runtime(response));
    for (const result of await Promise.all(requests)) assert.equal(result, response);
});

test('private requests retain the same request, environment, context and canonical denial', async () => {
    const { ctx } = context();
    const request = new Request('https://api.letbuyy.com/v1/internal/store-access/resolve');
    const denied = Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    const handler = createDeferredGatewayHandler(async () => ({
        async fetch(actualRequest, actualEnv, actualContext) {
            assert.equal(actualRequest, request);
            assert.equal(actualEnv, env);
            assert.equal(actualContext, ctx);
            return denied;
        }, scheduled() {},
    }));
    assert.equal(await handler.fetch(request, env, ctx), denied);
});

test('a first scheduled event keeps initialization and canonical work in its event lifetime', async () => {
    const { ctx, work } = context();
    const controller = { scheduledTime: 123, cron: '*/15 * * * *', noRetry() {} } as ScheduledController;
    let calls = 0;
    const inner = Promise.resolve();
    const handler = createDeferredGatewayHandler(async () => ({
        fetch: async () => new Response(),
        scheduled(actualController, actualEnv, actualContext) {
            calls++;
            assert.equal(actualController, controller);
            assert.equal(actualEnv, env);
            assert.equal(actualContext, ctx);
            ctx.waitUntil(inner);
        },
    }));
    handler.scheduled(controller, env, ctx);
    assert.equal(work.length, 1);
    await work[0];
    assert.equal(calls, 1);
    assert.equal(work[1], inner);
});

test('failed initialization dispatches nothing and a later event may retry initialization', async () => {
    const { ctx } = context();
    const failure = new Error('initialization failed');
    let attempts = 0;
    const response = new Response('recovered');
    const handler = createDeferredGatewayHandler(() => {
        attempts++;
        if (attempts === 1) throw failure;
        return Promise.resolve(runtime(response));
    });
    const request = new Request('https://api.letbuyy.com/v1/health');
    await assert.rejects(handler.fetch(request, env, ctx), (error) => error === failure);
    assert.equal(await handler.fetch(request, env, ctx), response);
    assert.equal(attempts, 2);
});

test('a handler failure is never retried or treated as an initialization failure', async () => {
    const { ctx } = context();
    const failure = new Error('canonical command failure');
    let loads = 0;
    let commands = 0;
    const handler = createDeferredGatewayHandler(async () => {
        loads++;
        return { async fetch() { commands++; throw failure; }, scheduled() {} };
    });
    const request = new Request('https://api.letbuyy.com/v1/orders', { method: 'POST' });
    await assert.rejects(handler.fetch(request, env, ctx), (error) => error === failure);
    assert.equal(loads, 1);
    assert.equal(commands, 1);
});

test('scheduled handler failures remain visible to waitUntil', async () => {
    const { ctx, work } = context();
    const failure = new Error('canonical scheduled failure');
    const handler = createDeferredGatewayHandler(async () => ({ fetch: async () => new Response(), scheduled() { throw failure; } }));
    handler.scheduled({} as ScheduledController, env, ctx);
    await assert.rejects(work[0], (error) => error === failure);
});

test('independent worker instances retain separate initialization lifetimes', async () => {
    const { ctx } = context();
    let calls = 0;
    const load = async () => { calls++; return runtime(); };
    const first = createDeferredGatewayHandler(load);
    const second = createDeferredGatewayHandler(load);
    await first.fetch(new Request('https://api.letbuyy.com/health'), env, ctx);
    await second.fetch(new Request('https://api.letbuyy.com/health'), env, ctx);
    assert.equal(calls, 2);
});
