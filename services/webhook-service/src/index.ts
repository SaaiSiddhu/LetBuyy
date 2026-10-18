import { Hono } from "hono";
import {
    createRazorpayPaymentProvider,
    getRazorpayOrderNotes as fetchRazorpayOrderNotes,
    hmacSha256Hex,
    timingSafeEqual,
} from "@letbuyy/infrastructure/razorpay-adapter";
import {
    patchSupabaseRows,
    selectSupabaseRows,
    supabaseServiceHeaders,
    upsertSupabaseRows,
} from "@letbuyy/infrastructure/supabase-adapter";
import { emitGatewayDomainEvent, type GatewayServiceBinding } from "@letbuyy/infrastructure/gateway-events-adapter";
import { dispatchLetBuyyWebhook } from "./app-lifecycle-dispatch";
import {
    confirmGatewayOrderPayment,
    recordGatewayOrderPaymentEvent,
    recordGatewayOrderPaymentFailure,
} from "./gateway-order-transitions";
import { activateGatewayStoreSubscription } from "./gateway-billing-transitions";
import { normalizeRazorpayRefundLifecycle, reconcileGatewayPaymentRefund } from "./gateway-refund-transitions";

// ============================================================
// WEBHOOK HANDLER — Payment Provider Signature Verification
// Uses Web Crypto API (native on CF Workers, zero dependencies)
// ============================================================

interface Env {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    RAZORPAY_WEBHOOK_SECRET: string;
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    PAYPAL_CLIENT_ID?: string;
    PAYPAL_CLIENT_SECRET?: string;
    PAYPAL_WEBHOOK_ID?: string;
    PAYPAL_MODE?: "sandbox" | "live";
    CASHFREE_APP_ID?: string;
    CASHFREE_SECRET_KEY?: string;
    CASHFREE_ENVIRONMENT?: "sandbox" | "production";
    CASHFREE_API_VERSION?: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_SECRET_KEY?: string;
    INTERNAL_API_SECRET?: string;
    API_GATEWAY_SERVICE?: GatewayServiceBinding;
    ENVIRONMENT: string;
    APP_ENV?: string;
    NODE_ENV?: string;
    DEPLOYMENT_ENV?: string;
    TELEMETRY_ENV?: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── Helpers ────────────────────────────────────────────────────────

// LB-PAY-008 (F-PAY8-1): a conflict on (provider, provider_event_id) means the provider has sent this
// event before, not that it was handled. Acknowledging every conflict as a duplicate meant an event
// whose first attempt failed (row 'failed', 500 returned, so Razorpay retries) was never processed
// again. Only a terminal row is a duplicate. A 'failed' row, or a 'received' row nobody has touched
// for WEBHOOK_EVENT_RECLAIM_AFTER_MS (its attempt died, or could not record its own failure), is
// reclaimed by a conditional PATCH. Postgres re-checks the predicate under the row lock, so exactly
// one concurrent delivery gets the row back (tests/executable/payment-webhook-event-reclaim-postgres).
// Any other row is still being processed; that delivery is refused so the provider retries it later,
// instead of counting an event with an unknown outcome as delivered.
const WEBHOOK_EVENT_RECLAIM_AFTER_MS = 5 * 60 * 1000;
const TERMINAL_WEBHOOK_EVENT_STATUSES = new Set(["processed", "ignored"]);

type WebhookEventClaim = "new" | "reclaimed" | "duplicate" | "in_progress";

async function claimWebhookEvent(
    env: Env,
    event: {
        provider: PaymentProvider;
        provider_event_id: string;
        event_type: string;
        signature_valid: boolean;
        raw_payload: unknown;
    }
): Promise<WebhookEventClaim> {
    const rows = await upsertSupabaseRows(env, "payment_webhook_events", {
            provider: event.provider,
            provider_event_id: event.provider_event_id,
            event_type: event.event_type,
            signature_valid: event.signature_valid,
            raw_payload: event.raw_payload,
            processing_status: "received",
        },
        { onConflict: "provider,provider_event_id" }
    );
    if (!Array.isArray(rows) || rows.length > 0) return "new";

    const eventKey = {
        provider: `eq.${event.provider}`,
        provider_event_id: `eq.${event.provider_event_id}`,
    };
    const [existing] = await selectSupabaseRows<{ processing_status: string; updated_at: string }>(
        env,
        "payment_webhook_events",
        { ...eventKey, select: "processing_status,updated_at", limit: "1" },
    );
    if (!existing) return "in_progress";
    if (TERMINAL_WEBHOOK_EVENT_STATUSES.has(existing.processing_status)) return "duplicate";

    const failed = existing.processing_status === "failed";
    const staleBefore = new Date(Date.now() - WEBHOOK_EVENT_RECLAIM_AFTER_MS).toISOString();
    if (!failed && !(Date.parse(existing.updated_at) < Date.parse(staleBefore))) return "in_progress";

    const reclaimed = await patchSupabaseRows(env, "payment_webhook_events", {
        ...eventKey,
        processing_status: `eq.${existing.processing_status}`,
        ...(failed ? {} : { updated_at: `lt.${staleBefore}` }),
    }, {
        processing_status: "received",
        processed_at: null,
        // Set here as well as by the table's update trigger: the next claimant's predicate must stop
        // matching the moment this update commits.
        updated_at: new Date().toISOString(),
    });
    return reclaimed.length > 0 ? "reclaimed" : "in_progress";
}

async function markWebhookEvent(
    env: Env,
    provider: PaymentProvider,
    providerEventId: string,
    status: "processed" | "failed" | "ignored",
    errorMessage?: string
) {
    await patchSupabaseRows(env, "payment_webhook_events", {
        provider: `eq.${provider}`,
        provider_event_id: `eq.${providerEventId}`,
    }, {
            processing_status: status,
            processed_at: new Date().toISOString(),
            error_message: errorMessage || null,
    }, "return=minimal");
}

function razorpayProviderEventId(
    event: {
        event: string;
        payload: Record<string, { entity: Record<string, unknown> }>;
        created_at?: number;
    },
    signature: string
): string {
    const paymentId = event.payload?.payment?.entity?.id;
    const refundId = event.payload?.refund?.entity?.id;
    const orderId = event.payload?.order?.entity?.id;
    return String(refundId || paymentId || orderId || `${event.event}:${event.created_at || "unknown"}:${signature.slice(0, 24)}`);
}

// Phase M5, DOC 03 row 11 "Payments": narrowed after confirming every
// usage (writeWebhookEvent -> payment_webhook_events.provider,
// markWebhookEvent, markOrderPaid, markOrderFailed, markOrderRefunded,
// and emitPaymentDomainEvent transitively through those three) traces back
// to a hardcoded "razorpay" literal inside the single surviving /razorpay
// handler below -- Phase M1 W4 retired every other provider's webhook
// route, confirmed fresh via `grep -n '^app\.post('` (exactly 3 routes:
// /app-lifecycle/dispatch, /webhook-deliveries/dispatch, /razorpay).
type PaymentProvider = "razorpay";
type PaymentDomainEventType = "payment.captured" | "payment.failed" | "payment.refunded" | "refund.created" | "payment.subscription.activated";
type JsonObject = Record<string, unknown>;

interface WebhookOrderRow {
    id: string;
    store_id: string;
    total?: number | string | null;
    items?: unknown;
    payment_id?: string | null;
    payment_status?: string | null;
    status?: string | null;
    inventory_reserved_at?: string | null;
    inventory_released_at?: string | null;
}

interface WebhookDeliveryClaim {
    id: string;
    site_id: string;
    subscription_id: string;
    event_id: string;
    event_type: string;
    target_url: string;
    payload: JsonObject;
    signing_secret: string;
    request_id: string | null;
    trace_id: string | null;
    idempotency_key: string;
    schema_version: number;
    attempts: number;
    max_attempts: number;
}

function asObject(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as JsonObject
        : {};
}

function textValue(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function selectRows<T>(
    env: Env,
    table: string,
    params: Record<string, string>
): Promise<T[]> {
    return selectSupabaseRows<T>(env, table, params);
}

async function callSupabaseRpc<T>(
    env: Env,
    functionName: string,
    body: Record<string, unknown>,
): Promise<T> {
    const response = await fetch(new URL(`/rest/v1/rpc/${functionName}`, env.SUPABASE_URL), {
        method: "POST",
        headers: supabaseServiceHeaders(env),
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(`Supabase RPC failed for ${functionName}: ${response.status} ${message}`);
    }

    return response.json() as Promise<T>;
}

// Founding Merchant slot reclaim on a subscription-payment refund. Subscription
// payments are NOT orders, so this complements the order-refund path. The RPC itself
// enforces the ≤14-day window and no-ops when the payment is not a founder's
// subscription payment — so this is safe to call for every refund. Best-effort.
async function reclaimFoundingOnRefund(env: Env, paymentId: string | undefined): Promise<void> {
    if (!paymentId) return;
    try {
        const subs = await selectRows<{ store_id?: string; site_id?: string }>(env, "subscriptions", {
            razorpay_payment_id: `eq.${paymentId}`,
            select: "store_id,site_id",
            limit: "1",
        });
        const siteId = subs[0]?.site_id || subs[0]?.store_id;
        if (!siteId) return;
        await callSupabaseRpc(env, "reclaim_founding_merchant", {
            p_site_id: siteId,
            p_reason: "subscription_refund",
            p_actor_type: "system",
            p_force: false,
        });
        console.info("[Founding] subscription refund reclaim attempted", { siteId, paymentId });
    } catch (error) {
        console.warn("[Founding] reclaim on refund failed", { paymentId, error: String(error) });
    }
}

function webhookRetryDelaySeconds(attempts: number, baseSeconds = 120): number {
    const boundedAttempts = Math.max(0, Math.min(attempts, 8));
    return Math.min(baseSeconds * Math.pow(2, boundedAttempts), 60 * 60);
}

function requestHeaderMap(headers: Headers): Record<string, string> {
    const mapped: Record<string, string> = {};
    headers.forEach((value, key) => {
        mapped[key] = value;
    });
    return mapped;
}

function razorpayWebhookProvider(env: Env) {
    return createRazorpayPaymentProvider({
        keyId: env.RAZORPAY_KEY_ID || "webhook-service",
        keySecret: env.RAZORPAY_KEY_SECRET || env.RAZORPAY_WEBHOOK_SECRET,
    });
}

async function verifyRazorpayWebhookSignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
): Promise<boolean> {
    if (!signature || !secret) return false;
    const expected = await hmacSha256Hex(secret, rawBody);
    return timingSafeEqual(expected, signature);
}

async function emitPaymentDomainEvent(
    env: Env,
    params: {
        // PAYMENT-RAIL-VALIDATOR: BILLING-DOMAIN-EXEMPT -- deliberately
        // wider than PaymentProvider: this is a generic domain-event
        // emitter shared by BOTH the Payments domain (order events, always
        // "razorpay") and the Billing domain (subscription events via
        // activateStoreSubscription, which can be "stripe") -- see
        // aggregateType below. It only forwards provider into an event
        // payload/idempotency-key string; it gates nothing.
        provider: PaymentProvider | "stripe";
        providerEventId: string;
        eventType: string;
        aggregateType: "order" | "subscription";
        aggregateId: string;
        storeId?: string | null;
        payload?: JsonObject;
    }
): Promise<void> {
    const domainEventType = normalizePaymentDomainEventType(params.aggregateType, params.eventType);
    await emitGatewayDomainEvent(env, {
        storeId: params.storeId || null,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: domainEventType,
        payload: {
            provider: params.provider,
            provider_event_id: params.providerEventId,
            provider_event_type: params.eventType,
            ...(params.payload || {}),
        },
        idempotencyKey: `payment-webhook:${params.provider}:${params.providerEventId}:${domainEventType}`,
    });
}

function normalizePaymentDomainEventType(
    aggregateType: "order" | "subscription",
    providerEventType: string
): PaymentDomainEventType {
    if (aggregateType === "subscription") return "payment.subscription.activated";

    const normalized = providerEventType.trim().toLowerCase();
    if (normalized === "refund.processed") return "payment.refunded";
    if (normalized === "refund.created") return "refund.created";
    if (normalized.includes("fail") || normalized.includes("denied") || normalized.includes("declined")) {
        return "payment.failed";
    }
    return "payment.captured";
}

async function findOrderByPaymentCandidates(
    env: Env,
    candidates: Array<string | undefined | null>
): Promise<WebhookOrderRow | null> {
    const unique = uniqueStrings(candidates);
    if (unique.length === 0) return null;

    const filters = unique.flatMap((candidate) => {
        const clauses = [`payment_id.eq.${candidate}`];
        if (isUuid(candidate)) clauses.push(`id.eq.${candidate}`);
        return clauses;
    });

    const rows = await selectRows<WebhookOrderRow>(env, "orders", {
        select: "id,store_id,total,items,payment_id,payment_status,status,inventory_reserved_at,inventory_released_at",
        or: `(${filters.join(",")})`,
        limit: "1",
    });

    return rows[0] || null;
}

async function markOrderPaid(
    env: Env,
    order: WebhookOrderRow,
    params: {
        provider: PaymentProvider;
        paymentId: string;
        providerOrderId?: string | null;
        providerEventId: string;
        eventType?: string;
    }
): Promise<void> {
    await confirmGatewayOrderPayment(env, {
        orderId: order.id,
        provider: params.provider,
        paymentId: params.paymentId,
        providerOrderId: params.providerOrderId || order.payment_id || null,
        providerEventId: params.providerEventId,
        idempotencyKey: `payment-webhook:${params.provider}:${params.providerEventId}:paid`,
    });

    await emitPaymentDomainEvent(env, {
        provider: params.provider,
        providerEventId: params.providerEventId,
        eventType: params.eventType || "payment.captured",
        aggregateType: "order",
        aggregateId: order.id,
        storeId: order.store_id,
        payload: {
            order_id: order.id,
            payment_id: params.paymentId,
            payment_status: "paid",
        },
    });
}

async function markOrderFailed(
    env: Env,
    order: WebhookOrderRow,
    params: {
        paymentId?: string;
        reason?: string;
        providerEventId: string;
        provider?: PaymentProvider;
        eventType?: string;
    }
): Promise<void> {
    if (order.payment_status === "paid") return;

    const provider = params.provider || "razorpay";
    await recordGatewayOrderPaymentFailure(env, {
        orderId: order.id,
        provider,
        providerEventId: params.providerEventId,
        paymentStatus: "failed",
        orderStatus: "cancelled",
        reason: params.reason || null,
        // T12: this was hardcoded false with no comment -- an oversight, not a
        // decision. markOrderRefunded (below) already computes this correctly;
        // a payment.failed webhook is exactly the explicit signal that should
        // release a committed-but-unpaid reservation immediately, same as a
        // refund does, rather than waiting for the TTL sweep
        // (expire_unpaid_committed_reservations, 211) to catch it later.
        releaseInventory: Boolean(order.inventory_reserved_at && !order.inventory_released_at),
        idempotencyKey: `payment-webhook:${provider}:${params.providerEventId}:failed`,
    });

    await emitPaymentDomainEvent(env, {
        provider,
        providerEventId: params.providerEventId,
        eventType: params.eventType || "payment.failed",
        aggregateType: "order",
        aggregateId: order.id,
        storeId: order.store_id,
        payload: {
            order_id: order.id,
            payment_id: params.paymentId || order.payment_id || null,
            payment_status: "failed",
            reason: params.reason || null,
        },
    });
}

async function markOrderRefunded(
    env: Env,
    order: WebhookOrderRow,
    providerEventId: string,
    provider: PaymentProvider = "razorpay",
    eventType = "refund.processed"
): Promise<void> {
    // G7 — only apply a refund to an order that was actually captured. A refund webhook arriving before
    // the capture webhook (out-of-order delivery) must NOT flip an unpaid order to "refunded" — that
    // would corrupt order + inventory state. Mirrors the markOrderFailed paid-guard. The skipped event
    // is logged so reconciliation can catch it; once the capture lands, the refund can be reconciled.
    if (order.payment_status !== "paid") {
        console.warn(JSON.stringify({
            level: "warn",
            event: "refund_webhook_skipped_order_not_captured",
            order_id: order.id,
            payment_status: order.payment_status ?? null,
            provider_event_id: providerEventId,
        }));
        return;
    }

    await recordGatewayOrderPaymentFailure(env, {
        orderId: order.id,
        provider,
        providerEventId,
        paymentStatus: "refunded",
        orderStatus: "refunded",
        reason: "refund_processed",
        releaseInventory: Boolean(order.inventory_reserved_at && !order.inventory_released_at),
        idempotencyKey: `payment-webhook:${provider}:${providerEventId}:refunded`,
    });

    await emitPaymentDomainEvent(env, {
        provider,
        providerEventId,
        eventType,
        aggregateType: "order",
        aggregateId: order.id,
        storeId: order.store_id,
        payload: {
            order_id: order.id,
            payment_status: "refunded",
        },
    });
}

async function getRazorpayOrderNotes(env: Env, orderId: string): Promise<JsonObject> {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return {};
    return fetchRazorpayOrderNotes({
        keyId: env.RAZORPAY_KEY_ID,
        keySecret: env.RAZORPAY_KEY_SECRET,
    }, orderId);
}

async function resolveRazorpayNotes(env: Env, payment: JsonObject): Promise<JsonObject> {
    const directNotes = asObject(payment.notes);
    if (directNotes.store_id || directNotes.order_id || directNotes.plan_slug) {
        return directNotes;
    }

    const orderId = textValue(payment.order_id);
    return orderId ? getRazorpayOrderNotes(env, orderId) : {};
}

async function activateStoreSubscription(
    env: Env,
    params: {
        storeId: string;
        planSlug: string;
        billingPeriod?: string;
        // PAYMENT-RAIL-VALIDATOR: BILLING-DOMAIN-EXEMPT -- this activates a
        // store's SUBSCRIPTION plan (LetBuyy invoicing MERCHANTS for
        // platform access) via activateGatewayStoreSubscription, imported
        // from ./gateway-billing-transitions -- the same Billing domain DOC
        // 03 draws as a separate winner from customer-checkout Payments
        // (row 11). It stays wide for the same reason
        // gateway-billing-transitions.ts's own "razorpay" | "stripe" types
        // do, even though this wrapper physically lives in index.ts.
        provider: "razorpay" | "stripe";
        providerOrderId?: string;
        providerPaymentId?: string;
        providerEventId?: string;
        eventType?: string;
        externalSubscriptionId?: string;
        userId?: string;
        amountPaid?: number;
    }
): Promise<void> {
    const billingPeriod = params.billingPeriod === "yearly" ? "yearly" : "monthly";
    // Gateway is the sole activation/replay owner. A global pre-read here could
    // mistake another store's receipt for this charge and emit a false success.
    const activation = asObject(await activateGatewayStoreSubscription(env, {
        storeId: params.storeId,
        planSlug: params.planSlug,
        billingPeriod,
        provider: params.provider,
        providerOrderId: params.providerOrderId || null,
        providerPaymentId: params.providerPaymentId || null,
        externalSubscriptionId: params.externalSubscriptionId || null,
        userId: params.userId || null,
        amountPaid: params.amountPaid ?? null,
    }));
    const responseData = asObject(asObject(activation).data);
    const subscription = asObject(responseData.subscription);
    const subscriptionId = textValue(subscription.id);
    if(!subscriptionId)throw new Error('Gateway did not return a durable subscription receipt');
    const planSlug = textValue(subscription.plan) || params.planSlug;

    await emitPaymentDomainEvent(env, {
        provider: params.provider,
        providerEventId: params.providerEventId || params.providerPaymentId || params.externalSubscriptionId || params.providerOrderId || subscriptionId || params.storeId,
        eventType: params.eventType || "payment.subscription.activated",
        aggregateType: "subscription",
        aggregateId: subscriptionId || params.storeId,
        storeId: params.storeId,
        payload: {
            store_id: params.storeId,
            subscription_id: subscriptionId || null,
            plan_slug: planSlug,
            billing_period: billingPeriod,
            payment_id: params.providerPaymentId || null,
        },
    });
}

// ─── Health Check ───────────────────────────────────────────────────

app.get("/health", (c) => {
    return c.json({
        service: "webhooks",
        status: "healthy",
        timestamp: new Date().toISOString(),
    });
});

function internalDispatchSecret(env: Env): string | undefined {
    return env.INTERNAL_API_SECRET || undefined;
}

function dispatchAuthHeader(headers: Headers): string | null {
    const direct = headers.get("X-LetBuyy-Internal-Secret");
    if (direct) return direct;

    const authorization = headers.get("Authorization") || "";
    return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;
}

function asDispatchRecord(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

// ─── Internal App Lifecycle Webhook Dispatch ────────────────────────
// API Gateway owns app install/uninstall state. This service owns signed
// outbound lifecycle webhook delivery so app callbacks stay out of UI apps.

app.post("/app-lifecycle/dispatch", async (c) => {
    const secret = internalDispatchSecret(c.env);
    if (!secret) {
        return c.json({ error: { code: "SERVER_MISCONFIGURED", message: "Internal dispatch secret is not configured" } }, 500);
    }

    if (dispatchAuthHeader(c.req.raw.headers) !== secret) {
        return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid internal dispatch secret" } }, 401);
    }

    const body = asDispatchRecord(await c.req.json().catch(() => null));
    const targetUrl = typeof body.target_url === "string" ? body.target_url : "";
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    const eventType = typeof body.event_type === "string" ? body.event_type : "";
    const signingSecret = typeof body.signing_secret === "string" ? body.signing_secret : "";
    const payload = asDispatchRecord(body.payload);

    if (!targetUrl || !eventId || !eventType || !signingSecret) {
        return c.json({ error: { code: "VALIDATION", message: "target_url, event_id, event_type, and signing_secret are required" } }, 400);
    }

    const result = await dispatchLetBuyyWebhook({
        target_url: targetUrl,
        event_id: eventId,
        event_type: eventType,
        payload,
        signing_secret: signingSecret,
        request_id: typeof body.request_id === "string" ? body.request_id : null,
        trace_id: typeof body.trace_id === "string" ? body.trace_id : null,
    }, fetch);

    return c.json({ data: result }, result.ok ? 200 : 502);
});

async function dispatchWebhookDeliveries(
    env: Env,
    input: { dispatcherId: string; limit: number },
): Promise<{ dispatcher_id: string; claimed: number; succeeded: number; failed: number }> {
    const deliveries = await callSupabaseRpc<WebhookDeliveryClaim[]>(env, "claim_webhook_deliveries", {
        p_dispatcher_id: input.dispatcherId,
        p_limit: input.limit,
        p_lock_seconds: 120,
    });
    let succeeded = 0;
    let failed = 0;

    for (const delivery of deliveries) {
        const result = await dispatchLetBuyyWebhook({
            target_url: delivery.target_url,
            event_id: delivery.event_id,
            event_type: delivery.event_type,
            payload: delivery.payload,
            signing_secret: delivery.signing_secret,
            request_id: delivery.request_id,
            trace_id: delivery.trace_id,
        }, fetch);

        if (result.ok) {
            await callSupabaseRpc(env, "complete_webhook_delivery", {
                p_delivery_id: delivery.id,
                p_dispatcher_id: input.dispatcherId,
                p_response_status: result.status || 200,
                p_response_body_preview: result.response_preview,
            });
            succeeded += 1;
        } else {
            await callSupabaseRpc(env, "fail_webhook_delivery", {
                p_delivery_id: delivery.id,
                p_dispatcher_id: input.dispatcherId,
                p_error_message: result.error || "Webhook delivery failed",
                p_response_status: result.status,
                p_response_body_preview: result.response_preview,
                p_retry_seconds: webhookRetryDelaySeconds(delivery.attempts),
            });
            failed += 1;
        }
    }

    return {
        dispatcher_id: input.dispatcherId,
        claimed: deliveries.length,
        succeeded,
        failed,
    };
}

// ─── Internal Outbound Webhook Delivery ─────────────────────────────
// Outbox fanout may create webhook delivery rows, but this service owns the
// partner HTTPS delivery, HMAC signature, and retry completion/failure path.

app.post("/webhook-deliveries/dispatch", async (c) => {
    const secret = internalDispatchSecret(c.env);
    if (!secret) {
        return c.json({ error: { code: "SERVER_MISCONFIGURED", message: "Internal dispatch secret is not configured" } }, 500);
    }

    if (dispatchAuthHeader(c.req.raw.headers) !== secret) {
        return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid internal dispatch secret" } }, 401);
    }

    const body = asDispatchRecord(await c.req.json().catch(() => null));
    const dispatcherId = typeof body.dispatcher_id === "string" && body.dispatcher_id
        ? body.dispatcher_id
        : `webhook-service:${crypto.randomUUID()}`;
    const limitValue = typeof body.limit === "number" ? body.limit : Number(body.limit || 25);
    const limit = Math.min(Math.max(Number.isFinite(limitValue) ? limitValue : 25, 1), 100);
    const result = await dispatchWebhookDeliveries(c.env, { dispatcherId, limit });

    return c.json({ data: result });
});

// ─── Razorpay Webhooks ──────────────────────────────────────────────
// Razorpay sends: x-razorpay-signature header = HMAC-SHA256(body, secret)
// Docs: https://razorpay.com/docs/webhooks/validate-test/

app.post("/razorpay", async (c) => {
    const body = await c.req.text();
    const signature = c.req.header("x-razorpay-signature");
    const timingSafeSignatureValid = await verifyRazorpayWebhookSignature(
        body,
        signature,
        c.env.RAZORPAY_WEBHOOK_SECRET,
    );
    const verification = await razorpayWebhookProvider(c.env).webhookVerify({
        provider: "razorpay",
        rawBody: body,
        headers: requestHeaderMap(c.req.raw.headers),
        secret: c.env.RAZORPAY_WEBHOOK_SECRET,
        receivedAt: new Date().toISOString(),
    });

    if (!timingSafeSignatureValid || !verification.verified) {
        console.error("[Razorpay] Invalid signature", { code: verification.failureCode });
        return c.json({ error: verification.failureCode === "RAZORPAY_WEBHOOK_SIGNATURE_MISSING" ? "Missing signature" : "Invalid signature" }, 400);
    }

    // Step 1: Parse and validate the verified event
    let event: {
        event: string;
        payload: Record<string, { entity: Record<string, unknown> }>;
        created_at?: number;
    };

    try {
        event = JSON.parse(body);
    } catch {
        console.error("[Razorpay] Invalid JSON body");
        return c.json({ error: "Invalid payload" }, 400);
    }

    // Step 2: Timestamp observation. Razorpay can retry old but valid signed events;
    // idempotency is enforced by payment_webhook_events, so do not reject by age.
    if (event.created_at) {
        const eventAge = Date.now() / 1000 - event.created_at;
        if (eventAge > 300) {
            console.warn("[Razorpay] Processing older signed event", { age: eventAge, type: event.event });
        }
    }

    // Step 3: Route event by type
    const eventType = event.event;
    const providerEventId = verification.event?.id || razorpayProviderEventId(event, signature || "verified");

    const claim = await claimWebhookEvent(c.env, {
        provider: "razorpay",
        provider_event_id: providerEventId,
        event_type: eventType,
        signature_valid: true,
        raw_payload: event,
    });

    if (claim === "duplicate") {
        return c.json({ received: true, duplicate: true, event: eventType });
    }
    if (claim === "in_progress") {
        return c.json({ error: "Event is still being processed", event: eventType }, 409);
    }

    console.info(`[Razorpay] Verified event: ${eventType}`, { providerEventId, retry: claim === "reclaimed" });

    try {
        switch (eventType) {
            case "payment.captured": {
                const payment = event.payload?.payment?.entity;
                const paymentRecord = asObject(payment);
                const notes = await resolveRazorpayNotes(c.env, paymentRecord);
                const paymentId = textValue(paymentRecord.id);
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(notes.order_id),
                    textValue(paymentRecord.order_id),
                    paymentId,
                ]);
                console.info("[Razorpay] Payment captured", {
                    paymentId: payment?.id,
                    orderId: payment?.order_id,
                    amount: payment?.amount,
                });

                if (order) {
                    await markOrderPaid(c.env, order, {
                        provider: "razorpay",
                        paymentId: paymentId || providerEventId,
                        providerOrderId: textValue(paymentRecord.order_id),
                        providerEventId,
                        eventType,
                    });
                } else if (notes.store_id && notes.plan_slug) {
                    await activateStoreSubscription(c.env, {
                        storeId: String(notes.store_id),
                        planSlug: String(notes.plan_slug),
                        billingPeriod: textValue(notes.billing_period),
                        provider: "razorpay",
                        providerOrderId: textValue(paymentRecord.order_id),
                        providerPaymentId: textValue(paymentRecord.id),
                        providerEventId,
                        eventType,
                        userId: textValue(notes.user_id),
                        amountPaid: numberValue(paymentRecord.amount),
                    });
                } else {
                    await markWebhookEvent(c.env, "razorpay", providerEventId, "ignored", "No matching order or subscription context");
                    return c.json({ received: true, event: eventType, ignored: true });
                }
                break;
            }

            case "subscription.authenticated":
            case "subscription.activated":
            case "subscription.charged": {
                const subscription = asObject(event.payload?.subscription?.entity);
                const payment = asObject(event.payload?.payment?.entity);
                // Mandate/state notifications alone never grant paid access.
                // Captured first charges can accompany authenticated/activated;
                // each successful recurring charge is also subscription.charged.
                if (eventType !== "subscription.charged" && payment.status !== "captured") {
                    await markWebhookEvent(c.env, "razorpay", providerEventId, "ignored", "Subscription mandate/state has no captured payment");
                    return c.json({ received: true, event: eventType, ignored: true });
                }
                const notes = asObject(subscription.notes);
                const subscriptionId = textValue(subscription.id);
                const paymentId = textValue(payment.id);
                const orderId = textValue(payment.order_id);
                const invoiceId = textValue(payment.invoice_id);
                const storeId = textValue(notes.store_id);
                const userId = textValue(notes.user_id);
                const planSlug = textValue(notes.plan_slug);
                const billingPeriod = textValue(notes.billing_period);
                const amount = payment.amount;
                if (subscription.entity !== "subscription" || payment.entity !== "payment" || payment.status !== "captured"
                    || !subscriptionId || !/^sub_[A-Za-z0-9]{1,116}$/.test(subscriptionId)
                    || !paymentId || !/^pay_[A-Za-z0-9]{1,116}$/.test(paymentId)
                    || !orderId || !/^order_[A-Za-z0-9]{1,114}$/.test(orderId)
                    || !invoiceId || !/^inv_[A-Za-z0-9]{1,116}$/.test(invoiceId)
                    || !storeId || !isUuid(storeId) || !userId || !isUuid(userId)
                    || !planSlug || planSlug.length > 120 || (billingPeriod !== "monthly" && billingPeriod !== "yearly")
                    || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647
                    || payment.currency !== "INR") {
                    throw new Error("Subscription captured invoice context requires review");
                }
                // These are signed transport hints, never quote/tax/period
                // authority. Gateway must fetch and bind this payment's invoice
                // and subscription to its retained checkout before any effect.
                // In particular, do not forward current_start/end or paid_count
                // as the period/phase of an older retried payment.
                await activateStoreSubscription(c.env, {
                    storeId, userId, planSlug, billingPeriod, provider: "razorpay",
                    providerOrderId: orderId, providerPaymentId: paymentId,
                    externalSubscriptionId: subscriptionId, amountPaid: amount,
                    providerEventId, eventType,
                });
                break;
            }

            case "payment.failed": {
                const payment = event.payload?.payment?.entity;
                const paymentRecord = asObject(payment);
                const notes = await resolveRazorpayNotes(c.env, paymentRecord);
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(notes.order_id),
                    textValue(paymentRecord.order_id),
                    textValue(paymentRecord.id),
                ]);
                console.info("[Razorpay] Payment failed", {
                    paymentId: payment?.id,
                    orderId: payment?.order_id,
                    reason: payment?.error_reason,
                });

                if (order) {
                    await markOrderFailed(c.env, order, {
                        paymentId: textValue(paymentRecord.id),
                        reason: textValue(paymentRecord.error_reason) || textValue(paymentRecord.error_description),
                        providerEventId,
                        provider: "razorpay",
                        eventType,
                    });
                }
                break;
            }

            case "refund.created":
            case "refund.processed":
            case "refund.failed": {
                const refund = event.payload?.refund?.entity;
                const refundRecord = asObject(refund);
                const refundAmount = numberValue(refundRecord.amount);
                const refundCurrency = textValue(refundRecord.currency)?.toUpperCase();
                const refundId = textValue(refundRecord.id);
                const refundPaymentId = textValue(refundRecord.payment_id);
                const refundStatus = textValue(refundRecord.status);
                const refundLifecycle = normalizeRazorpayRefundLifecycle(eventType, refundStatus);
                if (refundId && refundPaymentId && typeof refundAmount === "number"
                    && Number.isSafeInteger(refundAmount) && refundAmount > 0 && refundCurrency === "INR"
                    && refundLifecycle) {
                    const reconciliation = await reconcileGatewayPaymentRefund(c.env, {
                        providerPaymentId: refundPaymentId,
                        providerRefundId: refundId,
                        providerEventId,
                        eventType: refundLifecycle.eventType,
                        status: refundLifecycle.status,
                        amountMinor: refundAmount,
                        currency: refundCurrency,
                    });
                    const reconciliationData = asObject(reconciliation.data);
                    if (reconciliationData.matched === true) {
                        if (reconciliationData.reconciliation_required === true) {
                            console.warn(JSON.stringify({
                                level: "warn",
                                event: reconciliationData.ambiguous === true
                                    ? "provider_refund_attempt_ambiguous"
                                    : "provider_refund_attempt_unmatched",
                                provider_event_id: providerEventId,
                                provider_payment_id: refundPaymentId,
                                provider_refund_id: refundId,
                            }));
                        }
                        break;
                    }
                }
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(refundRecord.payment_id),
                    textValue(refundRecord.id),
                ]);
                console.info("[Razorpay] Refund event", {
                    event: eventType,
                    refundId: refund?.id,
                    paymentId: refund?.payment_id,
                    amount: refund?.amount,
                    status: refundRecord.status,
                });

                if (!order) break;

                const orderTotalMinor = Math.round(Number(order.total || 0) * 100);
                const validAmount = typeof refundAmount === "number" && Number.isSafeInteger(refundAmount) && refundAmount > 0;
                const validCurrency = refundCurrency === "INR";
                const providerRefundProcessed = eventType === "refund.processed" && refundRecord.status === "processed";

                if (providerRefundProcessed && validAmount && validCurrency && refundAmount === orderTotalMinor) {
                    await markOrderRefunded(c.env, order, providerEventId, "razorpay", eventType);
                } else {
                    // refund.created means the provider created a refund request, not that it
                    // returned the money. Failed, partial, malformed, mismatched-currency, or
                    // unexpected-status events must not post a full-order refund reversal.
                    await recordGatewayOrderPaymentEvent(c.env, {
                        orderId: order.id,
                        provider: "razorpay",
                        providerEventId,
                        eventType,
                        idempotencyKey: `payment-webhook:razorpay:${providerEventId}:${eventType}`,
                    });
                    if (eventType === "refund.processed" && providerRefundProcessed && validAmount && refundAmount !== orderTotalMinor) {
                        console.warn(JSON.stringify({
                            level: "warn",
                            event: "partial_refund_reconciliation_required",
                            order_id: order.id,
                            provider_event_id: providerEventId,
                            refund_id: textValue(refundRecord.id),
                            refund_amount_minor: refundAmount,
                            order_total_minor: orderTotalMinor,
                        }));
                    }
                }

                if (providerRefundProcessed && validAmount && validCurrency && refundAmount === orderTotalMinor) {
                    // Founding Merchant reclaim: subscription refunds are not orders, so
                    // attempt a founder slot reclaim only once the provider says it processed.
                    await reclaimFoundingOnRefund(c.env, textValue(refundRecord.payment_id));
                }
                break;
            }

            case "payment.authorized": {
                console.info("[Razorpay] Payment authorized (auto-capture expected)");
                break;
            }

            default:
                console.info(`[Razorpay] Unhandled event type: ${eventType}`);
                await markWebhookEvent(c.env, "razorpay", providerEventId, "ignored");
                return c.json({ received: true, event: eventType, ignored: true });
        }

        await markWebhookEvent(c.env, "razorpay", providerEventId, "processed");
    } catch (err) {
        await markWebhookEvent(c.env, "razorpay", providerEventId, "failed", err instanceof Error ? err.message : "Unknown error");
        throw err;
    }

    return c.json({ received: true, event: eventType });
});

// ─── Error Handler ──────────────────────────────────────────────────

app.onError((err, c) => {
    console.error("Webhook Error:", {
        message: err.message,
        stack: c.env.ENVIRONMENT === "development" ? err.stack : undefined,
    });
    return c.json({ error: "Internal error" }, 500);
});

export default app;
