import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test, { afterEach } from "node:test";
import * as webhookModule from "../../services/webhook-service/src/index.ts";

// F-PAY8-1 (LB-PAY-008) — a Razorpay retry of an event whose first attempt failed must be processed.
//
// POST /razorpay records every event in payment_webhook_events with an ignore-duplicates upsert. It used
// to read "the row already exists" as "already handled" and answer 200 {duplicate: true}. The failure
// path marks the row 'failed' and answers 500, and a 500 is exactly what makes Razorpay retry. So every
// retry of a failed event was acknowledged and dropped, and a captured payment stayed unrecorded unless
// the buyer's own verify callback landed.
//
// These tests drive the REAL route. services/webhook-service/test/payment-webhook-retirement.test.mjs
// asserts on source text because mounting the app "resolved to a plain Object". That quirk has a
// measured cause. The package has no "type": "module", so tsx loads src/index.ts as CommonJS and the
// Hono app sits at default.default. Node's own type stripping, that package's runner, cannot load
// index.ts at all, because index.ts imports its siblings without a file extension.
//
// That is also why this test lives in the contracts lane rather than beside the service. The package
// runner passes --experimental-strip-types, which Node 20 does not have, and ci.yml runs Node 20. The
// package's tests only run in the local gate's --full mode. This lane (tsx --test) runs in CI and in
// every default gate, and it needs no dependency the service would have to declare.
//
// Supabase is a fake PostgREST behind a stubbed global fetch, and the gateway is a fake service binding.
// The fake's conditional PATCH is atomic because JavaScript is single-threaded. That Postgres gives the
// same exclusivity is proven separately, against real Postgres, in
// tests/executable/payment-webhook-event-reclaim-postgres.test.mjs.

type Row = Record<string, unknown>;
type Json = Record<string, any>;
type Delivery = { status: number; body: Json };
type GatewayResponder = (attempt: number) => Response | Promise<Response>;
type Condition = { column: string; op: string; value: string };

const loaded = webhookModule as unknown as { default?: { request?: unknown; default?: unknown } };
const app = (typeof loaded.default?.request === "function" ? loaded.default : loaded.default?.default) as {
    request(path: string, init: RequestInit, env: Record<string, unknown>): Promise<Response>;
};

const WEBHOOK_SECRET = "test-razorpay-webhook-secret";
const ORDER_ID = "8c1d2f7e-4b3a-4e6f-9a1b-2c3d4e5f6a7b";
const STORE_ID = "5e0c7a1b-2d3f-4a5b-8c6d-7e8f9a0b1c2d";
const USER_ID = "0f1e2d3c-4b5a-4c6d-9e8f-7a6b5c4d3e2f";
const STALE_MS = 10 * 60 * 1000;

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// PostgREST filters as this service writes them: col=eq.v, col=lt.v, and or=(col.eq.v,...).
function parseCondition(column: string, expression: string): Condition {
    const dot = expression.indexOf(".");
    return { column, op: expression.slice(0, dot), value: expression.slice(dot + 1) };
}

function conditionHolds(row: Row, { column, op, value }: Condition): boolean {
    const actual = row[column];
    if (op === "eq") return actual !== null && actual !== undefined && String(actual) === value;
    if (op === "lt") return actual !== null && actual !== undefined && Date.parse(String(actual)) < Date.parse(value);
    if (op === "is" && value === "null") return actual === null || actual === undefined;
    throw new Error(`fake PostgREST: unsupported operator ${op} on ${column}`);
}

function rowFilter(searchParams: URLSearchParams): (row: Row) => boolean {
    const conditions: Condition[] = [];
    let alternatives: Condition[] | null = null;
    for (const [key, expression] of searchParams) {
        if (["select", "limit", "on_conflict", "order"].includes(key)) continue;
        if (key === "or") {
            alternatives = expression.replace(/^\(|\)$/g, "").split(",").map((part) => {
                const [column, ...rest] = part.split(".");
                return parseCondition(column, rest.join("."));
            });
            continue;
        }
        conditions.push(parseCondition(key, expression));
    }
    return (row) => conditions.every((condition) => conditionHolds(row, condition))
        && (!alternatives || alternatives.some((condition) => conditionHolds(row, condition)));
}

function createHarness({
    orders = [],
    subscriptions = [],
    webhookEvents = [],
    confirm,
    domainEvent,
    refundReconcile,
    eventReadsToAlign = 0,
}: {
    orders?: Row[];
    subscriptions?: Row[];
    webhookEvents?: Row[];
    confirm?: GatewayResponder;
    domainEvent?: GatewayResponder;
    refundReconcile?: GatewayResponder;
    // Hold every read of payment_webhook_events until this many have arrived, so concurrent deliveries
    // all see the same row state before any of them writes. A timer stops a missing read from hanging.
    eventReadsToAlign?: number;
} = {}) {
    let eventReads = 0;
    let alignReads: () => void = () => {};
    const readsAligned = new Promise<void>((resolve) => { alignReads = resolve; });
    if (eventReadsToAlign > 0) setTimeout(() => alignReads(), 1000).unref();
    const tables: Record<string, Row[]> = {
        payment_webhook_events: webhookEvents.map((row) => ({ error_message: null, processed_at: null, ...row })),
        orders: orders.map((row) => ({ ...row })),
        subscriptions: subscriptions.map((row) => ({ ...row })),
    };
    const calls = { confirm: [] as Json[], failure: [] as Json[], orderEvents: [] as Json[], refundReconcile: [] as Json[], activate: [] as Json[], domainEvents: [] as Json[], orderLookups: 0 };

    async function supabaseFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
        const url = new URL(String(input));
        const table = url.pathname.replace(/^\/rest\/v1\//, "");
        const rows = tables[table];
        if (!rows) throw new Error(`fake PostgREST: unexpected table ${table}`);
        const method = (init.method || "GET").toUpperCase();
        const prefer = new Headers(init.headers).get("Prefer") || "";
        const now = new Date().toISOString();

        if (method === "GET") {
            if (table === "orders") calls.orderLookups += 1;
            const limit = Number(url.searchParams.get("limit") || rows.length);
            const result = rows.filter(rowFilter(url.searchParams)).slice(0, limit).map((row) => ({ ...row }));
            if (table === "payment_webhook_events" && eventReadsToAlign > 0) {
                eventReads += 1;
                if (eventReads >= eventReadsToAlign) alignReads();
                await readsAligned;
            }
            return jsonResponse(result);
        }
        if (method === "POST" && table === "payment_webhook_events") {
            assert.match(prefer, /resolution=ignore-duplicates/);
            const body = JSON.parse(String(init.body)) as Row;
            const exists = rows.some((row) => row.provider === body.provider && row.provider_event_id === body.provider_event_id);
            if (exists) return jsonResponse([], 201);
            const row = { id: randomUUID(), error_message: null, processed_at: null, created_at: now, updated_at: now, ...body };
            rows.push(row);
            return jsonResponse([row], 201);
        }
        if (method === "PATCH") {
            const body = JSON.parse(String(init.body)) as Row;
            const matched = rows.filter(rowFilter(url.searchParams));
            // The table's BEFORE UPDATE trigger (update_updated_at) stamps updated_at on every update.
            for (const row of matched) Object.assign(row, body, { updated_at: now });
            return prefer.includes("return=minimal") ? new Response(null, { status: 204 }) : jsonResponse(matched);
        }
        throw new Error(`fake PostgREST: unexpected ${method} on ${table}`);
    }

    const gateway = {
        async fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
            const path = new URL(String(input)).pathname;
            const body = JSON.parse(String(init.body || "{}")) as Json;
            if (path === "/v1/storefront/internal/payments/confirm") {
                calls.confirm.push(body);
                return confirm ? confirm(calls.confirm.length) : jsonResponse({ success: true, data: { order: { id: body.orderId } } });
            }
            if (path === "/v1/storefront/internal/payments/failure") {
                calls.failure.push(body);
                return jsonResponse({ success: true, data: { order: { id: body.orderId } } });
            }
            if (path === "/v1/storefront/internal/payments/event") {
                calls.orderEvents.push(body);
                return jsonResponse({ success: true, data: { order: { id: body.orderId } } });
            }
            if (path === "/v1/storefront/internal/payments/refund-event") {
                calls.refundReconcile.push(body);
                return refundReconcile
                    ? refundReconcile(calls.refundReconcile.length)
                    : jsonResponse({ success: true, data: { matched: false } });
            }
            if (path === "/v1/internal/events/domain") {
                calls.domainEvents.push(body);
                return domainEvent ? domainEvent(calls.domainEvents.length) : jsonResponse({ success: true, data: { event: { id: randomUUID() } } });
            }
            if (path === "/v1/internal/billing/subscriptions/activate") {
                calls.activate.push(body);
                // Gateway contract fixture: its real ownership/idempotency is
                // proved by owned-db/subscription-payment-ownership, not this stub.
                const existing=tables.subscriptions.find(row=>row.razorpay_payment_id===body.providerPaymentId);
                if(existing&&existing.store_id!==body.storeId)return jsonResponse({error:{code:'SUBSCRIPTION_PAYMENT_CONFLICT'}},409);
                const subscription=existing||{id:randomUUID(),store_id:body.storeId,plan:body.planSlug,razorpay_payment_id:body.providerPaymentId};
                if(!existing)tables.subscriptions.push(subscription);
                return jsonResponse({success:true,data:{subscription}});
            }
            throw new Error(`fake gateway: unexpected ${path}`);
        },
    };

    const env = {
        SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
        RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
        INTERNAL_API_SECRET: "test-internal-secret",
        API_GATEWAY_SERVICE: gateway,
        ENVIRONMENT: "test",
    };

    async function deliver(event: Json): Promise<Delivery> {
        globalThis.fetch = supabaseFetch as typeof fetch;
        const rawBody = JSON.stringify(event);
        const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
        const response = await app.request("/razorpay", {
            method: "POST",
            body: rawBody,
            headers: { "content-type": "application/json", "x-razorpay-signature": signature },
        }, env);
        return { status: response.status, body: await response.json() as Json };
    }

    const eventRow = (providerEventId: string): Row => {
        const row = tables.payment_webhook_events.find((candidate) => candidate.provider_event_id === providerEventId);
        assert.ok(row, `no payment_webhook_events row for ${providerEventId}`);
        return row;
    };
    return { calls, tables, deliver, eventRow };
}

// Razorpay's body carries no top-level id, so the event id is derived from the payment and is identical on
// every retry — the property the whole dedupe rests on.
function capturedEvent({ paymentId, providerOrderId, notes }: { paymentId: string; providerOrderId: string; notes: Json }): Json {
    return {
        entity: "event",
        account_id: "acc_test",
        event: "payment.captured",
        contains: ["payment"],
        payload: {
            payment: {
                entity: { id: paymentId, entity: "payment", amount: 75000, currency: "INR", status: "captured", order_id: providerOrderId, notes },
            },
        },
        created_at: Math.floor(Date.now() / 1000),
    };
}

const orderPayment = () => capturedEvent({ paymentId: "pay_LBPAY008", providerOrderId: "order_LBPAY008", notes: { order_id: ORDER_ID } });
const ORDER_EVENT_ID = "payment.captured:pay_LBPAY008";
const orderRow = (): Row => ({
    id: ORDER_ID,
    store_id: STORE_ID,
    total: 750,
    payment_id: "order_LBPAY008",
    payment_status: "pending",
    status: "pending",
    inventory_reserved_at: null,
    inventory_released_at: null,
});
const failFirst = (failures: number): GatewayResponder => (attempt) => attempt <= failures
    ? jsonResponse({ success: false, error: { code: "UPSTREAM", message: "transient" } }, 503)
    : jsonResponse({ success: true, data: { order: { id: ORDER_ID } } });
const eventRowSeed = (processingStatus: string, updatedAt: string): Row => ({
    id: randomUUID(),
    provider: "razorpay",
    provider_event_id: ORDER_EVENT_ID,
    event_type: "payment.captured",
    signature_valid: true,
    processing_status: processingStatus,
    created_at: updatedAt,
    updated_at: updatedAt,
});

const subscriptionPayment = (paymentId: string) => capturedEvent({
    paymentId,
    providerOrderId: `order_${paymentId}`,
    notes: { store_id: STORE_ID, plan_slug: "growth", billing_period: "monthly", user_id: USER_ID },
});

function providerRefundEvent(input: {
    event: "refund.created" | "refund.processed" | "refund.failed";
    refundId: string;
    paymentId?: string;
    amount?: number;
    currency?: string;
    status?: string;
}): Json {
    const status = input.status || (input.event === "refund.created" ? "created" : input.event === "refund.processed" ? "processed" : "failed");
    return {
        entity: "event",
        account_id: "acc_test",
        event: input.event,
        contains: ["refund", "payment"],
        payload: {
            refund: {
                entity: {
                    id: input.refundId,
                    entity: "refund",
                    amount: input.amount ?? 75000,
                    currency: input.currency ?? "INR",
                    payment_id: input.paymentId || "pay_LBPAY_REFUND",
                    status,
                },
            },
        },
        created_at: Math.floor(Date.now() / 1000),
    };
}

test("the real Hono app is mounted, not a source-text stand-in", () => {
    assert.equal(typeof app?.request, "function");
});

test("LB-PAY-008: a retry of an event whose first attempt failed is processed, with the same idempotency key", async () => {
    const harness = createHarness({ orders: [orderRow()], confirm: failFirst(1) });
    const event = orderPayment();

    const first = await harness.deliver(event);
    assert.equal(first.status, 500, "the first attempt fails at the gateway");
    assert.equal(harness.eventRow(ORDER_EVENT_ID).processing_status, "failed");

    const retry = await harness.deliver(event);
    assert.equal(retry.status, 200);
    assert.notEqual(retry.body.duplicate, true, "a retry of a FAILED event must not be acknowledged as a duplicate");
    assert.equal(harness.calls.confirm.length, 2, "the retry must reach the gateway's payment confirmation again");
    assert.equal(
        harness.calls.confirm[1].idempotencyKey,
        `payment-webhook:razorpay:${ORDER_EVENT_ID}:paid`,
        "the replay must reuse the first attempt's key: that key is what makes confirm_order_payment_with_ledger post one ledger transaction",
    );
    assert.equal(harness.calls.confirm[1].idempotencyKey, harness.calls.confirm[0].idempotencyKey);
    assert.equal(harness.eventRow(ORDER_EVENT_ID).processing_status, "processed");
});

test("a genuine duplicate of a processed event is acknowledged and not reprocessed", async () => {
    const harness = createHarness({ orders: [orderRow()] });
    const event = orderPayment();

    assert.equal((await harness.deliver(event)).status, 200);
    assert.equal(harness.eventRow(ORDER_EVENT_ID).processing_status, "processed");

    const duplicate = await harness.deliver(event);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(harness.calls.confirm.length, 1, "a processed event is never confirmed twice");
});

test("a signed late capture booked as refund-owed never emits a normal paid domain event", async () => {
    const harness = createHarness({
        orders: [{ ...orderRow(), status: "cancelled", inventory_released_at: new Date().toISOString() }],
        confirm: () => jsonResponse({ success: true, data: {
            order: { id: ORDER_ID, status: "cancelled", refund_status: "pending" },
            capture_outcome: "captured_unfulfillable", fulfillable: false,
        } }),
    });
    const first = await harness.deliver(orderPayment());
    assert.equal(first.status, 200);
    assert.equal(harness.calls.confirm.length, 1, "the Gateway still books the captured funds and refund obligation");
    assert.equal(harness.calls.domainEvents.length, 0, "an unfulfillable order cannot announce payment as fulfilled");
    assert.equal(harness.eventRow(ORDER_EVENT_ID).processing_status, "processed");
    const retry = await harness.deliver(orderPayment());
    assert.equal(retry.body.duplicate, true);
    assert.equal(harness.calls.confirm.length, 1);
    assert.equal(harness.calls.domainEvents.length, 0);
});

test("a duplicate of an ignored event is acknowledged and not reprocessed", async () => {
    const harness = createHarness();
    const event = capturedEvent({ paymentId: "pay_NOCONTEXT", providerOrderId: "order_NOCONTEXT", notes: {} });

    const first = await harness.deliver(event);
    assert.equal(first.status, 200);
    assert.equal(first.body.ignored, true);
    assert.equal(harness.eventRow("payment.captured:pay_NOCONTEXT").processing_status, "ignored");

    const duplicate = await harness.deliver(event);
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(harness.calls.orderLookups, 1, "an ignored event is not looked up again");
});

test("two concurrent retries of one failed event: exactly one reclaims it and reaches the gateway", async () => {
    // The race that matters is the one where BOTH deliveries read the row as 'failed' before either
    // writes. The harness aligns their reads, so both reach the reclaim holding the same stale view,
    // and only the conditional update can split them. The winner is then held at the gateway until the
    // other delivery has answered. If both reclaimed, both would be held; the timer releases them so the
    // assertions fail rather than the test hanging.
    let release: () => void = () => {};
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const harness = createHarness({
        orders: [orderRow()],
        webhookEvents: [eventRowSeed("failed", new Date().toISOString())],
        eventReadsToAlign: 2,
        confirm: async () => {
            await hold;
            return jsonResponse({ success: true, data: { order: { id: ORDER_ID } } });
        },
    });
    const event = orderPayment();

    const deliveries = [harness.deliver(event), harness.deliver(event)];
    const timer = setTimeout(() => release(), 2000);
    const firstAnswer = await Promise.race(deliveries);
    release();
    clearTimeout(timer);
    const outcomes = await Promise.all(deliveries);

    assert.equal(firstAnswer.status, 409, "the delivery that lost the reclaim answers while the winner is still processing");
    assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [200, 409]);
    assert.equal(harness.calls.confirm.length, 1, "only the delivery that won the reclaim may process the event");
    assert.equal(harness.eventRow(ORDER_EVENT_ID).processing_status, "processed");
});

test("a duplicate that arrives while the first attempt is still in flight is refused with 409, not acknowledged", async () => {
    const harness = createHarness({
        orders: [orderRow()],
        webhookEvents: [eventRowSeed("received", new Date().toISOString())],
    });

    const inFlight = await harness.deliver(orderPayment());
    assert.equal(inFlight.status, 409, "acknowledging it would tell Razorpay the event was delivered while its outcome is unknown");
    assert.equal(harness.calls.confirm.length, 0);
    assert.equal(harness.eventRow(ORDER_EVENT_ID).processing_status, "received");
});

test("a 'received' row abandoned past the reclaim lease is reclaimed and processed", async () => {
    // What a dead attempt leaves behind: an isolate killed mid-flight, or a failure it could not record
    // because the database was the thing failing, so the row never reached 'failed'.
    const harness = createHarness({
        orders: [orderRow()],
        webhookEvents: [eventRowSeed("received", new Date(Date.now() - STALE_MS).toISOString())],
    });

    const retry = await harness.deliver(orderPayment());
    assert.equal(retry.status, 200);
    assert.notEqual(retry.body.duplicate, true);
    assert.equal(harness.calls.confirm.length, 1);
    assert.equal(harness.eventRow(ORDER_EVENT_ID).processing_status, "processed");
});

test("a subscription payment the merchant's verify route already applied is not activated a second time", async () => {
    // LB-BIL-001, the webhook's half: the verify route activates first (it stores the Razorpay payment id),
    // and payment.captured then used to activate again. That cancelled the verify route's subscription and
    // wrote a second invoice for one payment.
    const verified = { id: randomUUID(), store_id: STORE_ID, plan: "growth", razorpay_payment_id: "pay_SUBVERIFIED" };
    const harness = createHarness({ subscriptions: [verified] });

    const response = await harness.deliver(subscriptionPayment("pay_SUBVERIFIED"));
    assert.equal(response.status, 200);
    assert.equal(harness.calls.activate.length, 1, "the Gateway owns receipt recovery; the satellite does not skip ownership validation");
    assert.equal(harness.calls.domainEvents.length, 1);
    assert.equal(harness.calls.domainEvents[0].eventType, "payment.subscription.activated");
    assert.equal(harness.calls.domainEvents[0].aggregateId, verified.id);
    assert.equal(harness.eventRow("payment.captured:pay_SUBVERIFIED").processing_status, "processed");
});

test("a subscription payment found at another store is refused by the canonical Gateway and emits no success event",async()=>{
    const foreign={id:randomUUID(),store_id:randomUUID(),plan:"growth",razorpay_payment_id:"pay_SUBFOREIGN"};
    const harness=createHarness({subscriptions:[foreign]});
    const response=await harness.deliver(subscriptionPayment("pay_SUBFOREIGN"));
    assert.equal(response.status,500);assert.equal(harness.calls.activate.length,1);
    assert.equal(harness.calls.domainEvents.length,0);
    assert.equal(harness.eventRow("payment.captured:pay_SUBFOREIGN").processing_status,"failed");
});

test("a subscription payment nobody has applied is still activated by the webhook", async () => {
    const harness = createHarness();

    const response = await harness.deliver(subscriptionPayment("pay_SUBNEW"));
    assert.equal(response.status, 200);
    assert.equal(harness.calls.activate.length, 1, "the webhook stays the backstop when the verify route never landed");
    assert.equal(harness.calls.activate[0].providerPaymentId, "pay_SUBNEW");
});

test("a reclaimed retry of a subscription event whose activation already landed does not activate again", async () => {
    // Attempt 1 activates, then fails emitting its domain event, so the row is 'failed'. The retry reclaims
    // the row and delegates to the canonical idempotent activation again.
    const harness = createHarness({ domainEvent: failFirst(1) });
    const event = subscriptionPayment("pay_SUBREPLAY");

    assert.equal((await harness.deliver(event)).status, 500);
    assert.equal(harness.calls.activate.length, 1);
    assert.equal(harness.eventRow("payment.captured:pay_SUBREPLAY").processing_status, "failed");

    const retry = await harness.deliver(event);
    assert.equal(retry.status, 200);
    assert.equal(harness.calls.activate.length, 2, "a reclaimed delivery delegates safe receipt recovery to the canonical Gateway again");
    assert.equal(harness.calls.domainEvents.length, 2);
    assert.equal(harness.eventRow("payment.captured:pay_SUBREPLAY").processing_status, "processed");
});

test("refund.created records provider progress but does not claim the refund succeeded", async () => {
    const harness = createHarness({ orders: [{ ...orderRow(), payment_id: "pay_LBPAY_REFUND", payment_status: "paid", status: "cancelled" }] });
    const event = providerRefundEvent({ event: "refund.created", refundId: "rfnd_CREATED" });

    const first = await harness.deliver(event);
    assert.equal(first.status, 200);
    assert.equal(harness.calls.failure.length, 0, "provider creation is not proof that the refund was processed");
    assert.equal(harness.calls.orderEvents.length, 1);
    assert.equal(harness.calls.orderEvents[0].eventType, "refund.created");
    assert.equal(harness.calls.domainEvents.length, 0);
    assert.equal(harness.eventRow("refund.created:rfnd_CREATED").processing_status, "processed");

    const duplicate = await harness.deliver(event);
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(harness.calls.orderEvents.length, 1);
});

test("refund.created entity statuses from Razorpay normalize to a pending lifecycle", async () => {
    for (const status of ["processed", "pending"]) {
        const refundId = `rfnd_CREATED_${status.toUpperCase()}`;
        const harness = createHarness({
            orders: [{ ...orderRow(), payment_id: "pay_LBPAY_REFUND", payment_status: "paid", status: "cancelled" }],
            refundReconcile: () => jsonResponse({ success: true, data: { matched: true, result: { outcome: "pending" } } }),
        });
        const response = await harness.deliver(providerRefundEvent({ event: "refund.created", refundId, status }));

        assert.equal(response.status, 200);
        assert.equal(harness.calls.refundReconcile.length, 1);
        assert.deepEqual(harness.calls.refundReconcile[0], {
            provider: "razorpay",
            providerPaymentId: "pay_LBPAY_REFUND",
            providerRefundId: refundId,
            providerEventId: `refund.created:${refundId}`,
            eventType: "refund.created",
            status: "created",
            amountMinor: 75000,
            currency: "INR",
        });
        assert.equal(harness.calls.failure.length, 0, "refund.created must never post a refund reversal");
        assert.equal(harness.calls.domainEvents.length, 0, "refund.created must not emit payment.refunded");
        assert.equal(harness.calls.orderEvents.length, 0, "a matched payment-session attempt stays on the canonical path");
    }
});

test("refund.processed posts one full-order reversal and emits the contracted payment.refunded event", async () => {
    const harness = createHarness({ orders: [{ ...orderRow(), payment_id: "pay_LBPAY_REFUND", payment_status: "paid", status: "cancelled" }] });
    const response = await harness.deliver(providerRefundEvent({ event: "refund.processed", refundId: "rfnd_PROCESSED" }));

    assert.equal(response.status, 200);
    assert.equal(harness.calls.failure.length, 1);
    assert.equal(harness.calls.failure[0].paymentStatus, "refunded");
    assert.equal(harness.calls.failure[0].orderStatus, "refunded");
    assert.equal(harness.calls.failure[0].reason, "refund_processed");
    assert.equal(harness.calls.failure[0].providerEventId, "refund.processed:rfnd_PROCESSED");
    assert.equal(harness.calls.domainEvents.length, 1);
    assert.equal(harness.calls.domainEvents[0].eventType, "payment.refunded");
    assert.equal(harness.eventRow("refund.processed:rfnd_PROCESSED").processing_status, "processed");
});

test("a refund matched to a payment-session attempt is reconciled by Gateway and skips the legacy order refund writer", async () => {
    const harness = createHarness({
        orders: [{ ...orderRow(), payment_id: "pay_LBPAY_REFUND", payment_status: "paid", status: "cancelled" }],
        refundReconcile: () => jsonResponse({ success: true, data: { matched: true, result: { outcome: "processed" } } }),
    });
    const response = await harness.deliver(providerRefundEvent({ event: "refund.processed", refundId: "rfnd_PAYMENT_SESSION" }));

    assert.equal(response.status, 200);
    assert.equal(harness.calls.refundReconcile.length, 1);
    assert.deepEqual(harness.calls.refundReconcile[0], {
        provider: "razorpay",
        providerPaymentId: "pay_LBPAY_REFUND",
        providerRefundId: "rfnd_PAYMENT_SESSION",
        providerEventId: "refund.processed:rfnd_PAYMENT_SESSION",
        eventType: "refund.processed",
        status: "processed",
        amountMinor: 75000,
        currency: "INR",
    });
    assert.equal(harness.calls.failure.length, 0, "the order-level writer must not reverse the same payment a second time");
    assert.equal(harness.eventRow("refund.processed:rfnd_PAYMENT_SESSION").processing_status, "processed");
});

test("refund.failed, partial processed, and malformed processed events never post a full-order reversal", async () => {
    const harness = createHarness({ orders: [{ ...orderRow(), payment_id: "pay_LBPAY_REFUND", payment_status: "paid", status: "cancelled" }] });

    for (const event of [
        providerRefundEvent({ event: "refund.failed", refundId: "rfnd_FAILED" }),
        providerRefundEvent({ event: "refund.processed", refundId: "rfnd_PARTIAL", amount: 1200 }),
        providerRefundEvent({ event: "refund.processed", refundId: "rfnd_MISSING_STATUS", status: "created" }),
        providerRefundEvent({ event: "refund.processed", refundId: "rfnd_MISSING_AMOUNT", amount: 0 }),
        providerRefundEvent({ event: "refund.processed", refundId: "rfnd_WRONG_CURRENCY", currency: "USD" }),
    ]) {
        assert.equal((await harness.deliver(event)).status, 200);
    }

    assert.equal(harness.calls.failure.length, 0);
    assert.equal(harness.calls.orderEvents.length, 5, "each nonterminal or unsupported event is retained for reconciliation");
    assert.equal(harness.calls.domainEvents.length, 0);
});

test("separate refund IDs for one payment retain distinct webhook idempotency identities", async () => {
    const harness = createHarness({ orders: [{ ...orderRow(), payment_id: "pay_LBPAY_REFUND", payment_status: "paid", status: "cancelled" }] });

    for (const refundId of ["rfnd_PARTIAL_A", "rfnd_PARTIAL_B"]) {
        assert.equal((await harness.deliver(providerRefundEvent({ event: "refund.processed", refundId, amount: 1200 }))).status, 200);
    }

    assert.ok(harness.eventRow("refund.processed:rfnd_PARTIAL_A"));
    assert.ok(harness.eventRow("refund.processed:rfnd_PARTIAL_B"));
    assert.equal(harness.calls.orderEvents.length, 2);
});
