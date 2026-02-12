import { Hono } from "hono";

interface Env {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    RAZORPAY_WEBHOOK_SECRET: string;
    STRIPE_WEBHOOK_SECRET: string;
    ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get("/health", (c) => {
    return c.json({
        service: "webhooks",
        status: "healthy",
        timestamp: new Date().toISOString(),
    });
});

// ─── Razorpay Webhooks ──────────────────────────────────────────────
app.post("/razorpay", async (c) => {
    const body = await c.req.text();
    const signature = c.req.header("x-razorpay-signature");

    if (!signature) {
        return c.json({ error: "Missing signature" }, 401);
    }

    // TODO: Verify Razorpay webhook signature using HMAC-SHA256
    // TODO: Parse event type (payment.captured, payment.failed, refund.created)
    // TODO: Update order payment_status in Supabase
    // TODO: Send confirmation email to customer via Resend
    // TODO: Send notification to store owner via FCM

    console.log("[Razorpay Webhook]", body.substring(0, 200));
    return c.json({ received: true });
});

// ─── Stripe Webhooks ────────────────────────────────────────────────
app.post("/stripe", async (c) => {
    const body = await c.req.text();
    const signature = c.req.header("stripe-signature");

    if (!signature) {
        return c.json({ error: "Missing signature" }, 401);
    }

    // TODO: Verify Stripe webhook signature
    // TODO: Parse event type (checkout.session.completed, payment_intent.succeeded)
    // TODO: Handle subscription events (customer.subscription.created, updated, deleted)
    // TODO: Update order/subscription status in Supabase
    // TODO: Send confirmation email via Resend

    console.log("[Stripe Webhook]", body.substring(0, 200));
    return c.json({ received: true });
});

// Error handler
app.onError((err, c) => {
    console.error("Webhook Error:", err);
    return c.json({ error: "Internal error" }, 500);
});

export default app;
