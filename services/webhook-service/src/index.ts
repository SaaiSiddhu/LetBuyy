import { Hono } from "hono";
import {
    createRazorpayPaymentProvider,
    getRazorpayOrderNotes as fetchRazorpayOrderNotes,
    hmacSha256Hex,
    timingSafeEqual,
} from "@letbuyy/infrastructure/razorpay-adapter";
import { createPayPalPaymentProvider } from "@letbuyy/infrastructure/paypal-adapter";
import { createStripePaymentProvider } from "@letbuyy/infrastructure/stripe-adapter";
import {
    insertSupabaseRows,
    patchSupabaseRows,
    selectSupabaseRows,
    supabaseServiceHeaders,
    upsertSupabaseRows,
} from "@letbuyy/infrastructure/supabase-adapter";
import { dispatchLetBuyyWebhook } from "./app-lifecycle-dispatch";

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
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_SECRET_KEY?: string;
    INTERNAL_API_SECRET?: string;
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

type PaymentProvider = "razorpay" | "stripe" | "paypal";
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

interface OrderInventoryItem {
    product_id?: string | null;
    quantity?: number | string | null;
}

interface ProductInventoryRow {
    id: string;
    stock?: number | string | null;
    track_inventory?: boolean | null;
}

interface SiteRow {
    id: string;
    user_id?: string | null;
    custom_user_id?: string | null;
    site_type?: string | null;
    name?: string | null;
    store_name?: string | null;
}

interface PlanRow {
    id: string;
    name: string;
    slug: string;
    price_monthly_inr?: number | null;
    price_yearly_inr?: number | null;
    promo_price_inr?: number | null;
    promo_months?: number | null;
    products_limit?: number | null;
}

interface SubscriptionRow {
    id: string;
    user_id: string;
    store_id?: string | null;
    external_subscription_id?: string | null;
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

async function patchRows<T>(
    env: Env,
    table: string,
    params: Record<string, string>,
    body: Record<string, unknown>,
    prefer = "return=representation"
): Promise<T[]> {
    return patchSupabaseRows<T>(env, table, params, body, prefer);
}

async function insertRows<T>(
    env: Env,
    table: string,
    rows: Record<string, unknown> | Array<Record<string, unknown>>
): Promise<T[]> {
    return insertSupabaseRows<T>(env, table, rows);
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
    try {
        await upsertSupabaseRows(env, "outbox_events", {
            store_id: params.storeId || null,
            aggregate_type: params.aggregateType,
            aggregate_id: params.aggregateId,
            event_type: params.eventType,
            payload: {
                provider: params.provider,
                provider_event_id: params.providerEventId,
                ...(params.payload || {}),
            },
            idempotency_key: `payment-webhook:${params.provider}:${params.providerEventId}:${params.eventType}`,
        }, { onConflict: "idempotency_key" });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("outbox_events") && (message.includes("schema cache") || message.includes("does not exist"))) {
            console.warn("[Webhooks] Optional outbox_events table unavailable; domain event skipped", {
                eventType: params.eventType,
                provider: params.provider,
            });
            return;
        }

        throw error;
    }
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

function orderItemsFromJson(order: WebhookOrderRow): OrderInventoryItem[] {
    if (!Array.isArray(order.items)) return [];

    return order.items.map((item) => {
        const record = asObject(item);
        return {
            product_id: textValue(record.product_id) || textValue(record.productId),
            quantity: numberValue(record.quantity) || 0,
        };
    });
}

async function loadOrderInventoryItems(env: Env, order: WebhookOrderRow): Promise<OrderInventoryItem[]> {
    const rows = await selectRows<OrderInventoryItem>(env, "order_items", {
        select: "product_id,quantity",
        order_id: `eq.${order.id}`,
    }).catch(() => []);

    const normalizedRows = rows.filter((item) => item.product_id && Number(item.quantity) > 0);
    return normalizedRows.length > 0 ? normalizedRows : orderItemsFromJson(order);
}

async function adjustInventory(env: Env, order: WebhookOrderRow, direction: "reserve" | "release"): Promise<void> {
    const items = await loadOrderInventoryItems(env, order);

    for (const item of items) {
        const productId = textValue(item.product_id);
        const quantity = numberValue(item.quantity) || 0;
        if (!productId || quantity <= 0) continue;

        const [product] = await selectRows<ProductInventoryRow>(env, "products", {
            select: "id,stock,track_inventory",
            id: `eq.${productId}`,
            limit: "1",
        });

        if (!product || product.track_inventory === false) continue;

        const currentStock = numberValue(product.stock) || 0;
        const nextStock = direction === "reserve"
            ? Math.max(0, currentStock - quantity)
            : currentStock + quantity;

        await patchRows(env, "products", { id: `eq.${productId}` }, { stock: nextStock }, "return=minimal");
    }
}

async function markOrderPaid(
    env: Env,
    order: WebhookOrderRow,
    params: {
        provider: PaymentProvider;
        paymentId: string;
        providerEventId: string;
        eventType?: string;
    }
): Promise<void> {
    if (!order.inventory_reserved_at) {
        await adjustInventory(env, order, "reserve");
    }

    await patchRows(env, "orders", { id: `eq.${order.id}` }, {
        payment_status: "paid",
        status: "confirmed",
        payment_id: params.paymentId,
        payment_gateway: params.provider,
        payment_processed_at: new Date().toISOString(),
        inventory_reserved_at: order.inventory_reserved_at || new Date().toISOString(),
        last_payment_event_id: params.providerEventId,
    }, "return=minimal");

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

    await patchRows(env, "orders", { id: `eq.${order.id}` }, {
        payment_status: "failed",
        status: "cancelled",
        payment_id: params.paymentId || order.payment_id || null,
        payment_failure_reason: params.reason || null,
        last_payment_event_id: params.providerEventId,
    }, "return=minimal");

    await emitPaymentDomainEvent(env, {
        provider: params.provider || "razorpay",
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
    if (order.inventory_reserved_at && !order.inventory_released_at) {
        await adjustInventory(env, order, "release");
    }

    await patchRows(env, "orders", { id: `eq.${order.id}` }, {
        payment_status: "refunded",
        status: "refunded",
        inventory_released_at: order.inventory_released_at || new Date().toISOString(),
        last_payment_event_id: providerEventId,
    }, "return=minimal");

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

function periodEndFromBillingPeriod(billingPeriod: string): string {
    const end = new Date();
    if (billingPeriod === "yearly") {
        end.setFullYear(end.getFullYear() + 1);
    } else {
        end.setMonth(end.getMonth() + 1);
    }
    return end.toISOString();
}

function invoiceNumber(prefix: string): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    return `${prefix}-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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
    const [store] = await selectRows<SiteRow>(env, "sites", {
        select: "id,user_id,custom_user_id,site_type,name,store_name",
        id: `eq.${params.storeId}`,
        limit: "1",
    });

    if (!store) throw new Error("Subscription store not found");

    const userId = params.userId || store.custom_user_id || store.user_id;
    if (!userId) throw new Error("Subscription store has no owner user");

    const billingPeriod = params.billingPeriod === "yearly" ? "yearly" : "monthly";
    const siteType = store.site_type || "store";
    const [plan] = await selectRows<PlanRow>(env, "plans", {
        select: "*",
        site_type: `eq.${siteType}`,
        slug: `eq.${params.planSlug}`,
        is_active: "eq.true",
        limit: "1",
    });

    if (!plan) throw new Error("Subscription plan not found");

    const now = new Date().toISOString();
    const periodEnd = periodEndFromBillingPeriod(billingPeriod);
    const promoEndsAt = billingPeriod === "monthly" && Number(plan.promo_price_inr || 0) > 0 && Number(plan.promo_months || 0) > 0
        ? (() => {
            const date = new Date();
            date.setMonth(date.getMonth() + Number(plan.promo_months || 0));
            return date.toISOString();
        })()
        : null;

    const amountPaid = params.amountPaid ?? (
        billingPeriod === "yearly"
            ? Number(plan.price_yearly_inr || 0) * 12
            : promoEndsAt
                ? Number(plan.promo_price_inr || 0)
                : Number(plan.price_monthly_inr || 0)
    );

    await patchRows(env, "subscriptions", {
        store_id: `eq.${params.storeId}`,
        status: "eq.active",
    }, {
        status: "cancelled",
        cancelled_at: now,
    }, "return=minimal");

    const [subscription] = await insertRows<SubscriptionRow>(env, "subscriptions", {
        user_id: userId,
        store_id: params.storeId,
        plan: plan.slug,
        plan_id: plan.id,
        status: "active",
        billing_period: billingPeriod,
        current_period_start: now,
        current_period_end: periodEnd,
        promo_ends_at: promoEndsAt,
        payment_gateway: params.provider,
        external_subscription_id: params.externalSubscriptionId || params.providerOrderId || null,
        razorpay_order_id: params.provider === "razorpay" ? params.providerOrderId || null : null,
        razorpay_payment_id: params.provider === "razorpay" ? params.providerPaymentId || null : null,
        amount_paid: amountPaid,
        currency: "INR",
        products_limit: plan.products_limit,
        stores_limit: 1,
    });

    await patchRows(env, "sites", { id: `eq.${params.storeId}` }, {
        trial_status: "paid",
        updated_at: now,
    }, "return=minimal");

    await insertRows(env, "billing_history", {
        user_id: userId,
        store_id: params.storeId,
        subscription_id: subscription?.id || null,
        invoice_number: invoiceNumber("INV"),
        description: `${plan.name} plan - ${billingPeriod === "yearly" ? "Annual" : "Monthly"}`,
        amount: amountPaid,
        currency: "INR",
        tax_amount: Math.round(amountPaid * 0.18),
        total_amount: amountPaid + Math.round(amountPaid * 0.18),
        payment_gateway: params.provider,
        payment_id: params.providerPaymentId || params.externalSubscriptionId || params.providerOrderId || null,
        payment_status: "paid",
        period_start: now,
        period_end: periodEnd,
    });

    await emitPaymentDomainEvent(env, {
        provider: params.provider,
        providerEventId: params.providerEventId || params.providerPaymentId || params.externalSubscriptionId || params.providerOrderId || subscription?.id || params.storeId,
        eventType: params.eventType || "payment.subscription.activated",
        aggregateType: "subscription",
        aggregateId: subscription?.id || params.storeId,
        storeId: params.storeId,
        payload: {
            store_id: params.storeId,
            subscription_id: subscription?.id || null,
            plan_slug: plan.slug,
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

    await patchRows(env, "subscriptions", {
        external_subscription_id: `eq.${subscriptionId}`,
    }, {
        status: mappedStatus,
        current_period_start: currentPeriodStart ? new Date(currentPeriodStart * 1000).toISOString() : undefined,
        current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : undefined,
        cancelled_at: mappedStatus === "cancelled" ? new Date().toISOString() : null,
    }, "return=minimal");
}

// ─── Health Check ───────────────────────────────────────────────────

app.get("/health", (c) => {
    return c.json({
        service: "webhooks",
        status: "healthy",
        timestamp: new Date().toISOString(),
    });
});

function isProductionWebhookEnvironment(env: Env): boolean {
    return [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV, env.DEPLOYMENT_ENV]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === "production" || String(value).toLowerCase() === "prod");
}

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
    }, fetch, {
        allowLocalhost: !isProductionWebhookEnvironment(c.env),
    });

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
        }, fetch, {
            allowLocalhost: !isProductionWebhookEnvironment(env),
        });

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
                        await patchRows(c.env, "orders", { id: `eq.${order.id}` }, {
                            last_payment_event_id: providerEventId,
                        }, "return=minimal");
                    }
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
                    const [subscription] = await selectRows<SubscriptionRow>(c.env, "subscriptions", {
                        select: "id,user_id,store_id,external_subscription_id",
                        external_subscription_id: `eq.${subscriptionId}`,
                        limit: "1",
                    });

                    if (subscription?.store_id) {
                        const now = new Date().toISOString();
                        await insertRows(c.env, "billing_history", {
                            user_id: subscription.user_id,
                            store_id: subscription.store_id,
                            subscription_id: subscription.id,
                            invoice_number: textValue(invoice?.number) || invoiceNumber("STRIPE"),
                            description: "Stripe subscription invoice",
                            amount: numberValue(invoice?.amount_paid) || 0,
                            currency: String(invoice?.currency || "INR").toUpperCase(),
                            tax_amount: numberValue(invoice?.tax) || 0,
                            total_amount: numberValue(invoice?.amount_paid) || 0,
                            payment_gateway: "stripe",
                            payment_id: textValue(invoice?.payment_intent) || textValue(invoice?.id) || providerEventId,
                            payment_status: "paid",
                            period_start: now,
                            period_end: now,
                        });
                    }
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
                    await patchRows(c.env, "subscriptions", {
                        external_subscription_id: `eq.${subscriptionId}`,
                    }, {
                        status: "past_due",
                    }, "return=minimal");
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

// ─── Error Handler ──────────────────────────────────────────────────

app.onError((err, c) => {
    console.error("Webhook Error:", {
        message: err.message,
        stack: c.env.ENVIRONMENT === "development" ? err.stack : undefined,
    });
    return c.json({ error: "Internal error" }, 500);
});

export default app;
