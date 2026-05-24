import { Hono } from "hono";
import {
    getRazorpayOrderNotes as fetchRazorpayOrderNotes,
    hmacSha256Hex,
    timingSafeEqual,
} from "@letbuyy/infrastructure/razorpay-adapter";
import {
    insertSupabaseRows,
    patchSupabaseRows,
    selectSupabaseRows,
    upsertSupabaseRows,
} from "@letbuyy/infrastructure/supabase-adapter";

// ============================================================
// WEBHOOK HANDLER — Razorpay & Stripe Signature Verification
// Uses Web Crypto API (native on CF Workers, zero dependencies)
// ============================================================

interface Env {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    RAZORPAY_WEBHOOK_SECRET: string;
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    STRIPE_WEBHOOK_SECRET: string;
    ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── Helpers ────────────────────────────────────────────────────────

async function writeWebhookEvent(
    env: Env,
    event: {
        provider: "razorpay" | "stripe";
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
    provider: "razorpay" | "stripe",
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

type PaymentProvider = "razorpay" | "stripe";
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
}

async function markOrderFailed(
    env: Env,
    order: WebhookOrderRow,
    params: {
        paymentId?: string;
        reason?: string;
        providerEventId: string;
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
}

async function markOrderRefunded(
    env: Env,
    order: WebhookOrderRow,
    providerEventId: string
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

// ─── Razorpay Webhooks ──────────────────────────────────────────────
// Razorpay sends: x-razorpay-signature header = HMAC-SHA256(body, secret)
// Docs: https://razorpay.com/docs/webhooks/validate-test/

app.post("/razorpay", async (c) => {
    const body = await c.req.text();
    const signature = c.req.header("x-razorpay-signature");

    if (!signature) {
        console.error("[Razorpay] Missing x-razorpay-signature header");
        return c.json({ error: "Missing signature" }, 401);
    }

    // Step 1: Verify signature (HMAC-SHA256 of raw body with webhook secret)
    const expectedSignature = await hmacSha256Hex(c.env.RAZORPAY_WEBHOOK_SECRET, body);

    if (!timingSafeEqual(signature, expectedSignature)) {
        console.error("[Razorpay] Invalid signature");
        return c.json({ error: "Invalid signature" }, 401);
    }

    // Step 2: Parse and validate the event
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

    // Step 3: Timestamp observation. Razorpay can retry old but valid signed events;
    // idempotency is enforced by payment_webhook_events, so do not reject by age.
    if (event.created_at) {
        const eventAge = Date.now() / 1000 - event.created_at;
        if (eventAge > 300) {
            console.warn("[Razorpay] Processing older signed event", { age: eventAge, type: event.event });
        }
    }

    // Step 4: Route event by type
    const eventType = event.event;
    const providerEventId = razorpayProviderEventId(event, signature);

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
                    });
                } else if (notes.store_id && notes.plan_slug) {
                    await activateStoreSubscription(c.env, {
                        storeId: String(notes.store_id),
                        planSlug: String(notes.plan_slug),
                        billingPeriod: textValue(notes.billing_period),
                        provider: "razorpay",
                        providerOrderId: textValue(paymentRecord.order_id),
                        providerPaymentId: textValue(paymentRecord.id),
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
                        await markOrderRefunded(c.env, order, providerEventId);
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
    const signatureHeader = c.req.header("stripe-signature");

    if (!signatureHeader) {
        console.error("[Stripe] Missing stripe-signature header");
        return c.json({ error: "Missing signature" }, 401);
    }

    // Step 1: Parse Stripe signature header
    // Format: "t=1614904145,v1=xxxxxxxx,v0=yyyyyy"
    const elements = signatureHeader.split(",");
    const sigMap: Record<string, string> = {};
    for (const element of elements) {
        const [key, value] = element.split("=", 2);
        if (key && value) {
            sigMap[key] = value;
        }
    }

    const timestamp = sigMap["t"];
    const v1Signature = sigMap["v1"];

    if (!timestamp || !v1Signature) {
        console.error("[Stripe] Malformed signature header");
        return c.json({ error: "Malformed signature" }, 401);
    }

    // Step 2: Timestamp validation — reject events older than 5 minutes (300 seconds)
    const timestampSeconds = parseInt(timestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);

    if (isNaN(timestampSeconds) || Math.abs(currentSeconds - timestampSeconds) > 300) {
        console.error("[Stripe] Timestamp too old or invalid", {
            eventTimestamp: timestampSeconds,
            currentTime: currentSeconds,
        });
        return c.json({ error: "Timestamp too old" }, 401);
    }

    // Step 3: Verify signature — HMAC-SHA256("${timestamp}.${body}", secret)
    const signedPayload = `${timestamp}.${body}`;
    const expectedSignature = await hmacSha256Hex(c.env.STRIPE_WEBHOOK_SECRET, signedPayload);

    if (!timingSafeEqual(v1Signature, expectedSignature)) {
        console.error("[Stripe] Invalid v1 signature");
        return c.json({ error: "Invalid signature" }, 401);
    }

    // Step 4: Parse event
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

    // Step 5: Route event by type
    const eventType = event.type;
    const recorded = await writeWebhookEvent(c.env, {
        provider: "stripe",
        provider_event_id: event.id,
        event_type: eventType,
        signature_valid: true,
        raw_payload: event,
    });

    if (recorded.duplicate) {
        return c.json({ received: true, duplicate: true, event: eventType });
    }

    console.info(`[Stripe] Verified event: ${eventType} (${event.id})`);

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
                        paymentId: textValue(session?.payment_intent) || textValue(session?.id) || event.id,
                        providerEventId: event.id,
                    });
                } else if (metadata.store_id && metadata.plan_slug) {
                    await activateStoreSubscription(c.env, {
                        storeId: String(metadata.store_id),
                        planSlug: String(metadata.plan_slug),
                        billingPeriod: textValue(metadata.billing_period),
                        provider: "stripe",
                        externalSubscriptionId: textValue(session?.subscription) || textValue(session?.id),
                        providerPaymentId: textValue(session?.payment_intent),
                        userId: textValue(metadata.user_id),
                        amountPaid: numberValue(session?.amount_total),
                    });
                } else {
                    await markWebhookEvent(c.env, "stripe", event.id, "ignored", "No matching order or subscription context");
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
                            payment_id: textValue(invoice?.payment_intent) || textValue(invoice?.id) || event.id,
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
                        paymentId: textValue(paymentIntent?.id) || event.id,
                        providerEventId: event.id,
                    });
                }
                break;
            }

            default:
                console.info(`[Stripe] Unhandled event type: ${eventType}`);
                await markWebhookEvent(c.env, "stripe", event.id, "ignored");
                return c.json({ received: true, event: eventType, ignored: true });
        }

        await markWebhookEvent(c.env, "stripe", event.id, "processed");
    } catch (err) {
        await markWebhookEvent(c.env, "stripe", event.id, "failed", err instanceof Error ? err.message : "Unknown error");
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
