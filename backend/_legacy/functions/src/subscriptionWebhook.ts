// ============================================================
// SUBSCRIPTION WEBHOOK SERVICE - Razorpay Subscription Events
// Handles subscription payment events from Razorpay webhooks
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {
    PLAN_CONFIGS,
    freezeStoreInternal,
    unfreezeStoreInternal,
    sendSubscriptionEmail,
} from "./subscriptionService";

const db = admin.firestore();

// ============================================================
// HELPER: Verify Razorpay Webhook Signature
// ============================================================

function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

// ============================================================
// HELPER: Get Webhook Secret
// ============================================================

function getWebhookSecret(): string {
    return (
        process.env.RAZORPAY_WEBHOOK_SECRET ||
        functions.config().razorpay?.webhook_secret ||
        ""
    );
}

// ============================================================
// WEBHOOK: Process Subscription Payment
// Handles: subscription.charged, subscription.halted, subscription.cancelled
// ============================================================

export const processSubscriptionPayment = functions.https.onRequest(
    async (req, res) => {
        // Only accept POST requests
        if (req.method !== "POST") {
            console.warn("❌ Non-POST request to webhook endpoint");
            res.status(405).send("Method Not Allowed");
            return;
        }

        const signature = req.headers["x-razorpay-signature"] as string;
        const webhookSecret = getWebhookSecret();

        if (!webhookSecret) {
            console.error("❌ Webhook secret not configured");
            res.status(500).send("Webhook configuration error");
            return;
        }

        // Verify signature
        const rawBody = JSON.stringify(req.body);

        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
            console.error("❌ Invalid webhook signature");
            res.status(401).send("Invalid signature");
            return;
        }

        const event = req.body;
        const eventType = event.event;
        const payload = event.payload;

        console.log(`📩 Received webhook event: ${eventType}`);

        try {
            switch (eventType) {
                // ==========================================
                // Subscription charged successfully
                // ==========================================
                case "subscription.charged":
                    await handleSubscriptionCharged(payload);
                    break;

                // ==========================================
                // Payment failed - subscription at risk
                // ==========================================
                case "subscription.pending":
                    await handleSubscriptionPending(payload);
                    break;

                // ==========================================
                // Subscription halted (payment failed multiple times)
                // ==========================================
                case "subscription.halted":
                    await handleSubscriptionHalted(payload);
                    break;

                // ==========================================
                // Subscription cancelled by user
                // ==========================================
                case "subscription.cancelled":
                    await handleSubscriptionCancelled(payload);
                    break;

                // ==========================================
                // Subscription activated (first payment success)
                // ==========================================
                case "subscription.activated":
                    await handleSubscriptionActivated(payload);
                    break;

                // ==========================================
                // Subscription completed (all cycles done)
                // ==========================================
                case "subscription.completed":
                    await handleSubscriptionCompleted(payload);
                    break;

                default:
                    console.log(`ℹ️ Unhandled event type: ${eventType}`);
            }

            res.status(200).send("OK");
        } catch (error: any) {
            console.error(`❌ Webhook processing error: ${error.message}`);
            // Return 200 to prevent Razorpay from retrying
            // Log the error for manual investigation
            await logWebhookError(event, error.message);
            res.status(200).send("Processed with errors");
        }
    }
);

// ============================================================
// Handler: Subscription Charged
// ============================================================

async function handleSubscriptionCharged(payload: any): Promise<void> {
    const subscription = payload.subscription?.entity;
    const payment = payload.payment?.entity;

    if (!subscription) {
        console.error("No subscription entity in payload");
        return;
    }

    const razorpaySubId = subscription.id;
    const amountPaid = payment?.amount || subscription.charge_at;
    const paidCount = subscription.paid_count;

    console.log(`💰 Subscription charged: ${razorpaySubId}, amount: ${amountPaid}`);

    // Find subscription by Razorpay ID
    const subsQuery = await db
        .collection("subscriptions")
        .where("razorpaySubscriptionId", "==", razorpaySubId)
        .limit(1)
        .get();

    if (subsQuery.empty) {
        console.warn(`Subscription not found for Razorpay ID: ${razorpaySubId}`);
        // Try to find by notes (storeId might be in notes)
        const storeId = subscription.notes?.store_id;
        if (storeId) {
            console.log(`Found storeId in notes: ${storeId}`);
            await updateStorePaymentSuccess(storeId, amountPaid);
        }
        return;
    }

    const subDoc = subsQuery.docs[0];
    const subData = subDoc.data();
    const storeId = subData.storeId;
    const now = admin.firestore.Timestamp.now();

    // Calculate next billing date (30 days from now)
    const nextBillingDate = admin.firestore.Timestamp.fromMillis(
        Date.now() + 30 * 24 * 60 * 60 * 1000
    );

    // Update subscription
    await subDoc.ref.update({
        status: "active",
        lastPaymentDate: now,
        lastPaymentAmount: amountPaid / 100, // Convert from paise
        nextBillingDate,
        paidCount,
        updatedAt: now,
    });

    // Unfreeze store if it was frozen
    const storeDoc = await db.collection("stores").doc(storeId).get();
    if (storeDoc.data()?.isFrozen) {
        await unfreezeStoreInternal(storeId);
    }

    // Update store with payment info
    await storeDoc.ref.update({
        subscriptionStatus: "active",
        updatedAt: now,
    });

    // Send payment confirmation email
    await sendSubscriptionEmail(storeId, "payment_success", {
        amount: (amountPaid / 100).toFixed(2),
        nextBillingDate: nextBillingDate.toDate().toLocaleDateString("en-IN"),
    });

    console.log(`✅ Subscription payment processed for store: ${storeId}`);
}

// Helper for when subscription doc not found but storeId is available
async function updateStorePaymentSuccess(
    storeId: string,
    amountPaid: number
): Promise<void> {
    const now = admin.firestore.Timestamp.now();

    await db.collection("stores").doc(storeId).update({
        subscriptionStatus: "active",
        isFrozen: false,
        frozenAt: null,
        freezeReason: null,
        updatedAt: now,
    });

    await sendSubscriptionEmail(storeId, "payment_success", {
        amount: (amountPaid / 100).toFixed(2),
    });
}

// ============================================================
// Handler: Subscription Pending (Payment Failed - Retry)
// ============================================================

async function handleSubscriptionPending(payload: any): Promise<void> {
    const subscription = payload.subscription?.entity;

    if (!subscription) return;

    const razorpaySubId = subscription.id;
    console.log(`⚠️ Subscription payment pending: ${razorpaySubId}`);

    const subsQuery = await db
        .collection("subscriptions")
        .where("razorpaySubscriptionId", "==", razorpaySubId)
        .limit(1)
        .get();

    if (subsQuery.empty) return;

    const subDoc = subsQuery.docs[0];
    const storeId = subDoc.data().storeId;
    const now = admin.firestore.Timestamp.now();

    // Update status to pastDue (grace period)
    await subDoc.ref.update({
        status: "pastDue",
        updatedAt: now,
    });

    await db.collection("stores").doc(storeId).update({
        subscriptionStatus: "pastDue",
        updatedAt: now,
    });

    // Send payment failed email
    await sendSubscriptionEmail(storeId, "payment_failed", {
        message: "Your subscription payment failed. Please update your payment method to avoid service interruption.",
    });

    console.log(`⚠️ Store ${storeId} now in grace period`);
}

// ============================================================
// Handler: Subscription Halted (Multiple Failures)
// ============================================================

async function handleSubscriptionHalted(payload: any): Promise<void> {
    const subscription = payload.subscription?.entity;

    if (!subscription) return;

    const razorpaySubId = subscription.id;
    console.log(`🧊 Subscription halted: ${razorpaySubId}`);

    const subsQuery = await db
        .collection("subscriptions")
        .where("razorpaySubscriptionId", "==", razorpaySubId)
        .limit(1)
        .get();

    if (subsQuery.empty) return;

    const subDoc = subsQuery.docs[0];
    const storeId = subDoc.data().storeId;
    const now = admin.firestore.Timestamp.now();

    // Update subscription status
    await subDoc.ref.update({
        status: "frozen",
        haltedAt: now,
        updatedAt: now,
    });

    // Freeze the store
    await freezeStoreInternal(storeId, "payment_halted");

    // Send halted email
    await sendSubscriptionEmail(storeId, "subscription_halted", {
        message: "Your subscription has been halted due to payment failures. Your store is now read-only.",
    });

    console.log(`🧊 Store ${storeId} frozen due to halted subscription`);
}

// ============================================================
// Handler: Subscription Cancelled
// ============================================================

async function handleSubscriptionCancelled(payload: any): Promise<void> {
    const subscription = payload.subscription?.entity;

    if (!subscription) return;

    const razorpaySubId = subscription.id;
    const cancelledAt = subscription.ended_at;

    console.log(`❌ Subscription cancelled: ${razorpaySubId}`);

    const subsQuery = await db
        .collection("subscriptions")
        .where("razorpaySubscriptionId", "==", razorpaySubId)
        .limit(1)
        .get();

    if (subsQuery.empty) return;

    const subDoc = subsQuery.docs[0];
    const storeId = subDoc.data().storeId;
    const currentPlan = subDoc.data().plan;
    const now = admin.firestore.Timestamp.now();

    // Update subscription status
    await subDoc.ref.update({
        status: "canceled",
        cancelledAt: cancelledAt
            ? admin.firestore.Timestamp.fromMillis(cancelledAt * 1000)
            : now,
        updatedAt: now,
    });

    // Downgrade to trial with limited features
    const trialConfig = PLAN_CONFIGS.trial;

    await db.collection("stores").doc(storeId).update({
        subscriptionPlan: "trial",
        subscriptionStatus: "active",
        productLimit: trialConfig.productLimit,
        commissionPercent: trialConfig.commissionPercent,
        previousPlan: currentPlan,
        planChangedAt: now,
        updatedAt: now,
    });

    // Send cancellation email
    await sendSubscriptionEmail(storeId, "subscription_cancelled", {
        previousPlan: currentPlan,
    });

    console.log(`❌ Store ${storeId} downgraded to trial after cancellation`);
}

// ============================================================
// Handler: Subscription Activated (First Payment)
// ============================================================

async function handleSubscriptionActivated(payload: any): Promise<void> {
    const subscription = payload.subscription?.entity;

    if (!subscription) return;

    const razorpaySubId = subscription.id;
    const planId = subscription.plan_id;
    const storeId = subscription.notes?.store_id;

    console.log(`🎉 Subscription activated: ${razorpaySubId}, plan: ${planId}`);

    if (!storeId) {
        console.warn("No store_id in subscription notes");
        return;
    }

    const now = admin.firestore.Timestamp.now();

    // Find or create subscription record
    const subsQuery = await db
        .collection("subscriptions")
        .where("storeId", "==", storeId)
        .where("status", "in", ["active", "trial"])
        .limit(1)
        .get();

    if (!subsQuery.empty) {
        const subDoc = subsQuery.docs[0];
        await subDoc.ref.update({
            razorpaySubscriptionId: razorpaySubId,
            razorpayPlanId: planId,
            status: "active",
            startDate: now,
            updatedAt: now,
        });
    }

    // Ensure store is active
    await db.collection("stores").doc(storeId).update({
        subscriptionStatus: "active",
        isFrozen: false,
        frozenAt: null,
        freezeReason: null,
        updatedAt: now,
    });

    // Send activation email
    await sendSubscriptionEmail(storeId, "subscription_activated", {});

    console.log(`🎉 Store ${storeId} subscription activated`);
}

// ============================================================
// Handler: Subscription Completed (All Cycles Done)
// ============================================================

async function handleSubscriptionCompleted(payload: any): Promise<void> {
    const subscription = payload.subscription?.entity;

    if (!subscription) return;

    const razorpaySubId = subscription.id;
    console.log(`✅ Subscription completed: ${razorpaySubId}`);

    const subsQuery = await db
        .collection("subscriptions")
        .where("razorpaySubscriptionId", "==", razorpaySubId)
        .limit(1)
        .get();

    if (subsQuery.empty) return;

    const subDoc = subsQuery.docs[0];
    const storeId = subDoc.data().storeId;
    const now = admin.firestore.Timestamp.now();

    // Mark as expired
    await subDoc.ref.update({
        status: "expired",
        endDate: now,
        updatedAt: now,
    });

    await db.collection("stores").doc(storeId).update({
        subscriptionStatus: "expired",
        updatedAt: now,
    });

    // Send renewal reminder
    await sendSubscriptionEmail(storeId, "subscription_ended", {
        message: "Your subscription has ended. Renew now to keep your store active.",
    });
}

// ============================================================
// Helper: Log Webhook Errors
// ============================================================

async function logWebhookError(event: any, errorMessage: string): Promise<void> {
    try {
        await db.collection("webhook_errors").add({
            event: event.event,
            payload: JSON.stringify(event.payload),
            error: errorMessage,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.error("Failed to log webhook error:", e);
    }
}
