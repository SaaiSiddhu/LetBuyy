import { Hono } from "hono";
import {
    createRazorpayPaymentProvider,
    getRazorpayOrderNotes as fetchRazorpayOrderNotes,
    hmacSha256Hex,
    timingSafeEqual,
} from "@letbuyy/infrastructure/razorpay-adapter";
import { createCashfreePaymentProvider } from "@letbuyy/infrastructure/cashfree-adapter";
import { createPayPalPaymentProvider } from "@letbuyy/infrastructure/paypal-adapter";
import { createStripePaymentProvider } from "@letbuyy/infrastructure/stripe-adapter";
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
import {
    activateGatewayStoreSubscription,
    recordGatewaySubscriptionInvoice,
    syncGatewayStoreSubscription,
} from "./gateway-billing-transitions";

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
    AUTH_SECRET?: string;
    ENVIRONMENT: string;
    APP_ENV?: string;
    NODE_ENV?: string;
    DEPLOYMENT_ENV?: string;
    TELEMETRY_ENV?: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── Helpers ────────────────────────────────────────────────────────

async function writeWebhookEvent(
    env: Env,
    event: {
        provider: PaymentProvider;
        provider_event_id: string;
        event_type: string;
        signature_valid: boolean;
        raw_payload: unknown;
    }
): Promise<{ duplicate: boolean }> {
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
    return { duplicate: Array.isArray(rows) && rows.length === 0 };
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
    return String(paymentId || refundId || orderId || `${event.event}:${event.created_at || "unknown"}:${signature.slice(0, 24)}`);
}

type PaymentProvider = "razorpay" | "stripe" | "paypal" | "cashfree";
type PaymentDomainEventType = "payment.captured" | "payment.failed" | "refund.created" | "payment.subscription.activated";
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

function stripeWebhookProvider(env: Env) {
    return createStripePaymentProvider({
        secretKey: env.STRIPE_SECRET_KEY,
    });
}

function paypalWebhookProvider(env: Env) {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET || !env.PAYPAL_WEBHOOK_ID) {
        throw new Error("PayPal webhook credentials are not configured");
    }

    return createPayPalPaymentProvider({
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        webhookId: env.PAYPAL_WEBHOOK_ID,
        mode: env.PAYPAL_MODE === "live" ? "live" : "sandbox",
    });
}

function cashfreeWebhookProvider(env: Env) {
    if (!env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY) {
        throw new Error("Cashfree webhook credentials are not configured");
    }

    return createCashfreePaymentProvider({
        appId: env.CASHFREE_APP_ID,
        secretKey: env.CASHFREE_SECRET_KEY,
        environment: env.CASHFREE_ENVIRONMENT === "production" ? "production" : "sandbox",
        apiVersion: env.CASHFREE_API_VERSION || "2025-01-01",
    });
}

async function emitPaymentDomainEvent(
    env: Env,
    params: {
        provider: PaymentProvider;
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
    if (normalized.includes("refund")) return "refund.created";
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
        releaseInventory: false,
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
    eventType = "refund.created"
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
        reason: "refund_created",
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

function normalizeSubscriptionStatus(status: string): "active" | "cancelled" | "past_due" | "trialing" {
    if (status === "active") return "active";
    if (status === "trialing") return "trialing";
    if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
    return "cancelled";
}

async function activateStoreSubscription(
    env: Env,
    params: {
        storeId: string;
        planSlug: string;
        billingPeriod?: string;
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
    const responseData = asObject(activation.data);
    const subscription = asObject(responseData.subscription);
    const subscriptionId = textValue(subscription.id);
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

async function syncStripeSubscription(
    env: Env,
    subscription: JsonObject,
    statusOverride?: "active" | "cancelled" | "past_due" | "trialing"
): Promise<void> {
    const subscriptionId = textValue(subscription.id);
    if (!subscriptionId) return;

    const status = statusOverride || textValue(subscription.status) || "active";
    const mappedStatus = normalizeSubscriptionStatus(status);
    const currentPeriodStart = numberValue(subscription.current_period_start);
    const currentPeriodEnd = numberValue(subscription.current_period_end);

    await syncGatewayStoreSubscription(env, {
        externalSubscriptionId: subscriptionId,
        status: mappedStatus,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
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
    return env.INTERNAL_API_SECRET || env.AUTH_SECRET || undefined;
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

    const recorded = await writeWebhookEvent(c.env, {
        provider: "razorpay",
        provider_event_id: providerEventId,
        event_type: eventType,
        signature_valid: true,
        raw_payload: event,
    });

    if (recorded.duplicate) {
        return c.json({ received: true, duplicate: true, event: eventType });
    }

    console.info(`[Razorpay] Verified event: ${eventType}`);

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

            case "refund.created": {
                const refund = event.payload?.refund?.entity;
                const refundRecord = asObject(refund);
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(refundRecord.payment_id),
                    textValue(refundRecord.id),
                ]);
                console.info("[Razorpay] Refund created", {
                    refundId: refund?.id,
                    paymentId: refund?.payment_id,
                    amount: refund?.amount,
                });

                if (order) {
                    const refundAmount = numberValue(refundRecord.amount);
                    const orderTotalMinor = Math.round(Number(order.total || 0) * 100);
                    if (!refundAmount || refundAmount >= orderTotalMinor) {
                        await markOrderRefunded(c.env, order, providerEventId, "razorpay", eventType);
                    } else {
                        await recordGatewayOrderPaymentEvent(c.env, {
                            orderId: order.id,
                            provider: "razorpay",
                            providerEventId,
                            eventType,
                            idempotencyKey: `payment-webhook:razorpay:${providerEventId}:partial-refund`,
                        });
                    }
                }
                // Founding Merchant reclaim: subscription refunds are not orders, so
                // attempt a founder slot reclaim by the refunded payment id (≤14d → release).
                await reclaimFoundingOnRefund(c.env, textValue(refundRecord.payment_id));
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

// ─── Stripe Webhooks ────────────────────────────────────────────────
// Stripe sends: stripe-signature header = "t=timestamp,v1=hmac,v0=hmac"
// The HMAC is SHA-256 of "${timestamp}.${body}" using the webhook secret
// Docs: https://stripe.com/docs/webhooks/signatures

app.post("/stripe", async (c) => {
    const body = await c.req.text();
    const verification = await stripeWebhookProvider(c.env).webhookVerify({
        provider: "stripe",
        rawBody: body,
        headers: requestHeaderMap(c.req.raw.headers),
        secret: c.env.STRIPE_WEBHOOK_SECRET,
        receivedAt: new Date().toISOString(),
    });

    if (!verification.verified) {
        console.error("[Stripe] Invalid signature", { code: verification.failureCode });
        const error = verification.failureCode === "STRIPE_WEBHOOK_SIGNATURE_MISSING"
            ? "Missing signature"
            : verification.failureCode === "STRIPE_WEBHOOK_TIMESTAMP_OUTSIDE_TOLERANCE"
                ? "Timestamp too old"
                : "Invalid signature";
        return c.json({ error }, 401);
    }

    // Step 1: Parse the verified event
    let event: {
        id: string;
        type: string;
        data: { object: Record<string, unknown> };
        created: number;
    };

    try {
        event = JSON.parse(body);
    } catch {
        console.error("[Stripe] Invalid JSON body");
        return c.json({ error: "Invalid payload" }, 400);
    }

    // Step 2: Route event by type
    const eventType = event.type;
    const providerEventId = verification.event?.id || event.id;
    const recorded = await writeWebhookEvent(c.env, {
        provider: "stripe",
        provider_event_id: providerEventId,
        event_type: eventType,
        signature_valid: true,
        raw_payload: event,
    });

    if (recorded.duplicate) {
        return c.json({ received: true, duplicate: true, event: eventType });
    }

    console.info(`[Stripe] Verified event: ${eventType} (${providerEventId})`);

    try {
        switch (eventType) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const metadata = asObject(session?.metadata);
                const orderId = textValue(metadata.order_id) || textValue(metadata.orderId);
                const order = await findOrderByPaymentCandidates(c.env, [
                    orderId,
                    textValue(session?.id),
                    textValue(session?.payment_intent),
                ]);
                console.info("[Stripe] Checkout completed", {
                    sessionId: session?.id,
                    customerId: session?.customer,
                    subscriptionId: session?.subscription,
                });

                if (order) {
                    await markOrderPaid(c.env, order, {
                        provider: "stripe",
                        paymentId: textValue(session?.payment_intent) || textValue(session?.id) || providerEventId,
                        providerEventId,
                        eventType,
                    });
                } else if (metadata.store_id && metadata.plan_slug) {
                    await activateStoreSubscription(c.env, {
                        storeId: String(metadata.store_id),
                        planSlug: String(metadata.plan_slug),
                        billingPeriod: textValue(metadata.billing_period),
                        provider: "stripe",
                        externalSubscriptionId: textValue(session?.subscription) || textValue(session?.id),
                        providerPaymentId: textValue(session?.payment_intent),
                        providerEventId,
                        eventType,
                        userId: textValue(metadata.user_id),
                        amountPaid: numberValue(session?.amount_total),
                    });
                } else {
                    await markWebhookEvent(c.env, "stripe", providerEventId, "ignored", "No matching order or subscription context");
                    return c.json({ received: true, event: eventType, ignored: true });
                }
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object;
                console.info("[Stripe] Subscription updated", {
                    subscriptionId: subscription?.id,
                    status: subscription?.status,
                });
                await syncStripeSubscription(c.env, asObject(subscription));
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                console.info("[Stripe] Subscription canceled", {
                    subscriptionId: subscription?.id,
                });
                await syncStripeSubscription(c.env, asObject(subscription), "cancelled");
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object;
                const subscriptionId = textValue(invoice?.subscription);
                console.info("[Stripe] Invoice paid", {
                    invoiceId: invoice?.id,
                    amount: invoice?.amount_paid,
                });
                if (subscriptionId) {
                    const now = new Date().toISOString();
                    await recordGatewaySubscriptionInvoice(c.env, {
                        externalSubscriptionId: subscriptionId,
                        provider: "stripe",
                        invoiceNumber: textValue(invoice?.number) || `STRIPE-${providerEventId}`,
                        description: "Stripe subscription invoice",
                        amount: numberValue(invoice?.amount_paid) || 0,
                        currency: String(invoice?.currency || "INR").toUpperCase(),
                        taxAmount: numberValue(invoice?.tax) || 0,
                        totalAmount: numberValue(invoice?.amount_paid) || 0,
                        paymentId: textValue(invoice?.payment_intent) || textValue(invoice?.id) || providerEventId,
                        paymentStatus: "paid",
                        periodStart: now,
                        periodEnd: now,
                    });
                }
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object;
                const subscriptionId = textValue(invoice?.subscription);
                console.info("[Stripe] Invoice payment failed", {
                    invoiceId: invoice?.id,
                    attemptCount: invoice?.attempt_count,
                });
                if (subscriptionId) {
                    await syncGatewayStoreSubscription(c.env, {
                        externalSubscriptionId: subscriptionId,
                        status: "past_due",
                    });
                }
                break;
            }

            case "payment_intent.succeeded": {
                const paymentIntent = event.data.object;
                const metadata = asObject(paymentIntent?.metadata);
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(metadata.order_id) || textValue(metadata.orderId),
                    textValue(paymentIntent?.id),
                ]);
                console.info("[Stripe] Payment intent succeeded", {
                    paymentIntentId: paymentIntent?.id,
                    amount: paymentIntent?.amount,
                });
                if (order) {
                    await markOrderPaid(c.env, order, {
                        provider: "stripe",
                        paymentId: textValue(paymentIntent?.id) || providerEventId,
                        providerEventId,
                        eventType,
                    });
                }
                break;
            }

            default:
                console.info(`[Stripe] Unhandled event type: ${eventType}`);
                await markWebhookEvent(c.env, "stripe", providerEventId, "ignored");
                return c.json({ received: true, event: eventType, ignored: true });
        }

        await markWebhookEvent(c.env, "stripe", providerEventId, "processed");
    } catch (err) {
        await markWebhookEvent(c.env, "stripe", providerEventId, "failed", err instanceof Error ? err.message : "Unknown error");
        throw err;
    }

    return c.json({ received: true, event: eventType });
});

// ─── PayPal Webhooks ────────────────────────────────────────────────
// PayPal verification calls the provider verification API with the raw body,
// provider headers, and configured webhook id before any side effects run.

app.post("/paypal", async (c) => {
    const body = await c.req.text();
    const receivedAt = new Date().toISOString();
    const verification = await paypalWebhookProvider(c.env).webhookVerify({
        provider: "paypal",
        rawBody: body,
        headers: requestHeaderMap(c.req.raw.headers),
        secret: c.env.PAYPAL_WEBHOOK_ID || "paypal-webhook",
        receivedAt,
    });

    if (!verification.verified) {
        console.error("[PayPal] Invalid signature", { code: verification.failureCode });
        return c.json({ error: "Invalid signature" }, 400);
    }

    let event: {
        id?: string;
        event_type?: string;
        create_time?: string;
        resource?: Record<string, unknown>;
    };

    try {
        event = JSON.parse(body);
    } catch {
        console.error("[PayPal] Invalid JSON body");
        return c.json({ error: "Invalid payload" }, 400);
    }

    const eventType = event.event_type || verification.event?.type || "unknown";
    const providerEventId = verification.event?.id || event.id || `paypal:${receivedAt}`;
    const resource = asObject(event.resource);
    const relatedIds = asObject(asObject(resource.supplementary_data).related_ids);

    const recorded = await writeWebhookEvent(c.env, {
        provider: "paypal",
        provider_event_id: providerEventId,
        event_type: eventType,
        signature_valid: true,
        raw_payload: event,
    });

    if (recorded.duplicate) {
        return c.json({ received: true, duplicate: true, event: eventType });
    }

    console.info(`[PayPal] Verified event: ${eventType} (${providerEventId})`);

    try {
        switch (eventType) {
            case "CHECKOUT.ORDER.APPROVED": {
                console.info("[PayPal] Checkout order approved; capture confirmation remains authoritative for paid state");
                break;
            }

            case "PAYMENT.CAPTURE.COMPLETED": {
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(resource.custom_id),
                    textValue(resource.invoice_id),
                    textValue(relatedIds.order_id),
                    textValue(resource.id),
                    verification.event?.references.providerOrderId,
                    verification.event?.references.providerPaymentId,
                ]);

                if (order) {
                    await markOrderPaid(c.env, order, {
                        provider: "paypal",
                        paymentId: textValue(resource.id) || verification.event?.references.providerPaymentId || providerEventId,
                        providerOrderId: textValue(relatedIds.order_id) || verification.event?.references.providerOrderId,
                        providerEventId,
                        eventType,
                    });
                } else {
                    await markWebhookEvent(c.env, "paypal", providerEventId, "ignored", "No matching order context");
                    return c.json({ received: true, event: eventType, ignored: true });
                }
                break;
            }

            case "PAYMENT.CAPTURE.DENIED":
            case "PAYMENT.CAPTURE.DECLINED": {
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(resource.custom_id),
                    textValue(resource.invoice_id),
                    textValue(relatedIds.order_id),
                    textValue(resource.id),
                    verification.event?.references.providerOrderId,
                    verification.event?.references.providerPaymentId,
                ]);

                if (order) {
                    await markOrderFailed(c.env, order, {
                        provider: "paypal",
                        paymentId: textValue(resource.id),
                        reason: textValue(resource.status_details) || textValue(resource.status),
                        providerEventId,
                        eventType,
                    });
                }
                break;
            }

            case "PAYMENT.CAPTURE.REFUNDED": {
                const order = await findOrderByPaymentCandidates(c.env, [
                    textValue(resource.custom_id),
                    textValue(resource.invoice_id),
                    textValue(relatedIds.order_id),
                    textValue(resource.id),
                    verification.event?.references.providerOrderId,
                    verification.event?.references.providerPaymentId,
                ]);

                if (order) {
                    await markOrderRefunded(c.env, order, providerEventId, "paypal", eventType);
                }
                break;
            }

            default:
                console.info(`[PayPal] Unhandled event type: ${eventType}`);
                await markWebhookEvent(c.env, "paypal", providerEventId, "ignored");
                return c.json({ received: true, event: eventType, ignored: true });
        }

        await markWebhookEvent(c.env, "paypal", providerEventId, "processed");
    } catch (err) {
        await markWebhookEvent(c.env, "paypal", providerEventId, "failed", err instanceof Error ? err.message : "Unknown error");
        throw err;
    }

    return c.json({ received: true, event: eventType });
});

// ─── Cashfree Webhooks ──────────────────────────────────────────────
// Cashfree sends x-webhook-signature = base64(HMAC-SHA256(timestamp + rawBody, secret)).

app.post("/cashfree", async (c) => {
    if (!c.env.CASHFREE_APP_ID || !c.env.CASHFREE_SECRET_KEY) {
        return c.json({ error: "Cashfree is not configured" }, 503);
    }

    const body = await c.req.text();
    const receivedAt = new Date().toISOString();
    const verification = await cashfreeWebhookProvider(c.env).webhookVerify({
        provider: "cashfree",
        rawBody: body,
        headers: requestHeaderMap(c.req.raw.headers),
        secret: c.env.CASHFREE_SECRET_KEY,
        receivedAt,
    });

    if (!verification.verified) {
        console.error("[Cashfree] Invalid signature", { code: verification.failureCode });
        return c.json({ error: verification.failureCode === "CASHFREE_WEBHOOK_SIGNATURE_MISSING" ? "Missing signature" : "Invalid signature" }, 400);
    }

    let event: {
        type?: string;
        event?: string;
        event_time?: string;
        data?: Record<string, unknown>;
    };

    try {
        event = JSON.parse(body);
    } catch {
        console.error("[Cashfree] Invalid JSON body");
        return c.json({ error: "Invalid payload" }, 400);
    }

    const eventType = event.type || event.event || verification.event?.type || "unknown";
    const providerEventId = verification.event?.id || `cashfree:${receivedAt}`;
    const data = asObject(event.data);
    const orderRecord = asObject(data.order);
    const paymentRecord = asObject(data.payment);
    const refundRecord = asObject(data.refund);
    const paymentId = textValue(paymentRecord.cf_payment_id) || textValue(refundRecord.cf_payment_id) || verification.event?.references.providerPaymentId;
    const providerOrderId = textValue(orderRecord.order_id) || textValue(paymentRecord.order_id) || textValue(refundRecord.order_id) || verification.event?.references.providerOrderId;

    const recorded = await writeWebhookEvent(c.env, {
        provider: "cashfree",
        provider_event_id: providerEventId,
        event_type: eventType,
        signature_valid: true,
        raw_payload: event,
    });

    if (recorded.duplicate) {
        return c.json({ received: true, duplicate: true, event: eventType });
    }

    console.info(`[Cashfree] Verified event: ${eventType} (${providerEventId})`);

    try {
        const order = await findOrderByPaymentCandidates(c.env, [
            providerOrderId,
            paymentId,
            verification.event?.references.providerOrderId,
            verification.event?.references.providerPaymentId,
        ]);
        const paymentStatus = textValue(paymentRecord.payment_status);
        const refundStatus = textValue(refundRecord.refund_status);
        const normalizedType = eventType.toUpperCase();

        if (normalizedType.includes("REFUND") && refundStatus === "SUCCESS") {
            if (order) {
                await markOrderRefunded(c.env, order, providerEventId, "cashfree", eventType);
            } else {
                await markWebhookEvent(c.env, "cashfree", providerEventId, "ignored", "No matching order context");
                return c.json({ received: true, event: eventType, ignored: true });
            }
        } else if (paymentStatus === "SUCCESS" || normalizedType.includes("SUCCESS")) {
            if (order) {
                await markOrderPaid(c.env, order, {
                    provider: "cashfree",
                    paymentId: paymentId || providerEventId,
                    providerOrderId,
                    providerEventId,
                    eventType,
                });
            } else {
                await markWebhookEvent(c.env, "cashfree", providerEventId, "ignored", "No matching order context");
                return c.json({ received: true, event: eventType, ignored: true });
            }
        } else if (paymentStatus === "FAILED" || normalizedType.includes("FAILED")) {
            if (order) {
                await markOrderFailed(c.env, order, {
                    provider: "cashfree",
                    paymentId,
                    reason: textValue(paymentRecord.payment_message) || textValue(asObject(paymentRecord.error_details).error_description),
                    providerEventId,
                    eventType,
                });
            }
        } else {
            await markWebhookEvent(c.env, "cashfree", providerEventId, "ignored");
            return c.json({ received: true, event: eventType, ignored: true });
        }

        await markWebhookEvent(c.env, "cashfree", providerEventId, "processed");
    } catch (err) {
        await markWebhookEvent(c.env, "cashfree", providerEventId, "failed", err instanceof Error ? err.message : "Unknown error");
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
