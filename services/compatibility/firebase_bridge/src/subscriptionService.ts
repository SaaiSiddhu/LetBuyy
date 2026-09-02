// ============================================================
// SUBSCRIPTION SERVICE - LetBuyy SaaS Subscription Management
// Handles subscription creation, trial management, plan upgrades,
// product limits, store freezing, and Razorpay integration
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const db = admin.firestore();

// ============================================================
// TYPES
// ============================================================

type SubscriptionPlan = "trial" | "starter" | "business" | "professional";
type SubscriptionStatus = "active" | "expired" | "canceled" | "frozen" | "pastDue";

interface PlanConfig {
    productLimit: number;  // -1 = unlimited
    commissionPercent: number;
    priceInPaise: number;
    features: {
        customDomain: boolean;
        inventory: boolean;
        coupons: boolean;
        analytics: boolean;
        advancedAnalytics: boolean;
        teamAccess: boolean;
        ownRazorpay: boolean;
        apiAccess: boolean;
        removeBadge: boolean;
    };
}

interface SubscriptionData {
    id: string;
    storeId: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    productLimit: number;
    commissionPercent: number;
    startDate: admin.firestore.Timestamp;
    trialEndsAt: admin.firestore.Timestamp | null;
    nextBillingDate: admin.firestore.Timestamp | null;
    razorpaySubscriptionId: string | null;
    razorpayPlanId: string | null;
    lastPaymentDate: admin.firestore.Timestamp | null;
    lastPaymentAmount: number;
    currentProductCount: number;
    createdAt: admin.firestore.Timestamp;
}

// ============================================================
// PLAN CONFIGURATIONS
// ============================================================

const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
    trial: {
        productLimit: 50,
        commissionPercent: 3,
        priceInPaise: 0,
        features: {
            customDomain: false,
            inventory: true,
            coupons: false,
            analytics: true,
            advancedAnalytics: false,
            teamAccess: false,
            ownRazorpay: false,
            apiAccess: false,
            removeBadge: false,
        },
    },
    starter: {
        productLimit: 5,
        commissionPercent: 5,
        priceInPaise: 9900, // ₹99
        features: {
            customDomain: false,
            inventory: false,
            coupons: false,
            analytics: false,
            advancedAnalytics: false,
            teamAccess: false,
            ownRazorpay: false,
            apiAccess: false,
            removeBadge: false,
        },
    },
    business: {
        productLimit: 30,
        commissionPercent: 3,
        priceInPaise: 39900, // ₹399
        features: {
            customDomain: true,
            inventory: true,
            coupons: true,
            analytics: true,
            advancedAnalytics: false,
            teamAccess: false,
            ownRazorpay: false,
            apiAccess: false,
            removeBadge: true,
        },
    },
    professional: {
        productLimit: -1, // Unlimited
        commissionPercent: 0,
        priceInPaise: 79900, // ₹799
        features: {
            customDomain: true,
            inventory: true,
            coupons: true,
            analytics: true,
            advancedAnalytics: true,
            teamAccess: true,
            ownRazorpay: true,
            apiAccess: true,
            removeBadge: true,
        },
    },
};

const TRIAL_DAYS = 30;

// ============================================================
// HELPER: Get Razorpay Config
// ============================================================

function getRazorpayConfig() {
    return {
        keyId: process.env.LETBUYY_RAZORPAY_KEY_ID || functions.config().razorpay?.key_id || "",
        keySecret: process.env.LETBUYY_RAZORPAY_KEY_SECRET || functions.config().razorpay?.key_secret || "",
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || functions.config().razorpay?.webhook_secret || "",
    };
}

// ============================================================
// HELPER: Encryption for API Keys
// ============================================================

function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || functions.config().encryption?.key || "";
    if (!key) {
        throw new Error("Encryption key not configured");
    }
    return Buffer.from(key, "hex");
}

function encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

function decrypt(ciphertext: string): string {
    const [ivHex, encrypted] = ciphertext.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// ============================================================
// HELPER: Send Subscription Email
// ============================================================

async function sendSubscriptionEmail(
    storeId: string,
    template: string,
    data: Record<string, unknown>
): Promise<void> {
    try {
        const storeDoc = await db.collection("stores").doc(storeId).get();
        if (!storeDoc.exists) return;

        const store = storeDoc.data();
        const ownerDoc = await db.collection("users").doc(store?.sellerId).get();
        const owner = ownerDoc.data();

        if (!owner?.email) {
            console.warn(`No email found for store owner: ${storeId}`);
            return;
        }

        // Queue email for sending
        await db.collection("mail").add({
            to: owner.email,
            template: {
                name: `subscription_${template}`,
                data: {
                    storeName: store?.name,
                    ownerName: owner?.name || "Store Owner",
                    ...data,
                },
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`📧 Queued ${template} email for store: ${storeId}`);
    } catch (error) {
        console.error(`Failed to send email: ${error}`);
    }
}

// ============================================================
// FUNCTION: Create Subscription
// Called when user signs up or upgrades plan
// ============================================================

export const createSubscription = functions.https.onCall(
    async (
        data: {
            storeId: string;
            plan: SubscriptionPlan;
            paymentMethodId?: string;
        },
        context
    ) => {
        // 1. Validate authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required to create subscription"
            );
        }

        const { storeId, plan } = data;

        if (!storeId || !plan) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Store ID and plan are required"
            );
        }

        // 2. Validate plan
        if (!PLAN_CONFIGS[plan]) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                `Invalid plan: ${plan}`
            );
        }

        console.log(`📦 Creating ${plan} subscription for store: ${storeId}`);

        try {
            // 3. Verify store ownership
            const storeDoc = await db.collection("stores").doc(storeId).get();
            if (!storeDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Store not found");
            }

            const store = storeDoc.data();
            if (store?.sellerId !== context.auth.uid) {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "You don't own this store"
                );
            }

            // 4. Check for existing subscription
            const existingSubQuery = await db
                .collection("subscriptions")
                .where("storeId", "==", storeId)
                .where("status", "in", ["active", "trial"])
                .limit(1)
                .get();

            if (!existingSubQuery.empty) {
                // Handle upgrade/downgrade
                const existingSub = existingSubQuery.docs[0];
                console.log(`Upgrading from ${existingSub.data().plan} to ${plan}`);
                // TODO: Handle plan change logic
            }

            // 5. Get plan configuration
            const config = PLAN_CONFIGS[plan];
            const now = admin.firestore.Timestamp.now();

            // 6. Calculate trial end date (only for trial plan)
            const trialEndsAt =
                plan === "trial"
                    ? admin.firestore.Timestamp.fromMillis(
                        Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
                    )
                    : null;

            // 7. Create subscription document
            const subscriptionId = `sub_${storeId}_${Date.now()}`;
            const subscriptionData: SubscriptionData = {
                id: subscriptionId,
                storeId,
                plan,
                status: "active",
                productLimit: config.productLimit,
                commissionPercent: config.commissionPercent,
                startDate: now,
                trialEndsAt,
                nextBillingDate: plan !== "trial"
                    ? admin.firestore.Timestamp.fromMillis(
                        Date.now() + 30 * 24 * 60 * 60 * 1000
                    )
                    : null,
                razorpaySubscriptionId: null,
                razorpayPlanId: null,
                lastPaymentDate: null,
                lastPaymentAmount: 0,
                currentProductCount: store?.currentProductCount || 0,
                createdAt: now,
            };

            await db.collection("subscriptions").doc(subscriptionId).set(subscriptionData);

            // 8. Update store document with subscription info
            await storeDoc.ref.update({
                subscriptionPlan: plan,
                subscriptionStatus: "active",
                productLimit: config.productLimit,
                commissionPercent: config.commissionPercent,
                trialEndsAt,
                isFrozen: false,
                frozenAt: null,
                freezeReason: null,
                updatedAt: now,
            });

            // 9. Send welcome email
            await sendSubscriptionEmail(storeId, "welcome", {
                plan,
                planDisplayName: plan.charAt(0).toUpperCase() + plan.slice(1),
                productLimit: config.productLimit === -1 ? "Unlimited" : config.productLimit,
                commissionPercent: config.commissionPercent,
                trialDays: plan === "trial" ? TRIAL_DAYS : null,
            });

            console.log(`✅ Created ${plan} subscription: ${subscriptionId}`);

            return {
                success: true,
                subscriptionId,
                plan,
                productLimit: config.productLimit,
                commissionPercent: config.commissionPercent,
                trialEndsAt: trialEndsAt?.toDate().toISOString() || null,
            };
        } catch (error: any) {
            console.error(`❌ Create subscription error: ${error.message}`);
            throw new functions.https.HttpsError(
                "internal",
                error.message || "Failed to create subscription"
            );
        }
    }
);

// ============================================================
// FUNCTION: Check Trial Status (Scheduled - Daily)
// Runs at midnight IST to check trial expirations
// ============================================================

export const checkTrialStatus = functions.pubsub
    .schedule("0 0 * * *") // Every day at midnight
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        console.log("🔍 Running daily trial status check...");

        const today = new Date();

        let warningsSent = 0;
        let storesFrozen = 0;

        try {
            // 1. TRIALS EXPIRING SOON - Send warnings
            const expiringTrials = await db
                .collection("stores")
                .where("subscriptionPlan", "==", "trial")
                .where("subscriptionStatus", "==", "active")
                .where("isFrozen", "==", false)
                .get();

            for (const doc of expiringTrials.docs) {
                const store = doc.data();
                if (!store.trialEndsAt) continue;

                const trialEnd = store.trialEndsAt.toDate();
                const daysLeft = Math.ceil(
                    (trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                );

                // Send warnings at 5 days and 2 days
                if (daysLeft === 5 || daysLeft === 2) {
                    await sendSubscriptionEmail(doc.id, "trial_warning", {
                        daysLeft,
                        trialEndsAt: trialEnd.toLocaleDateString("en-IN"),
                    });
                    warningsSent++;
                    console.log(`⚠️ Sent ${daysLeft}-day warning to store: ${doc.id}`);
                }

                // Trial expired - freeze store
                if (daysLeft <= 0) {
                    await freezeStoreInternal(doc.id, "trial_expired");
                    await sendSubscriptionEmail(doc.id, "trial_expired", {});
                    storesFrozen++;
                    console.log(`🧊 Froze expired trial store: ${doc.id}`);
                }
            }

            console.log(
                `✅ Trial check complete. Warnings sent: ${warningsSent}, Stores frozen: ${storesFrozen}`
            );

            return null;
        } catch (error: any) {
            console.error(`❌ Trial check error: ${error.message}`);
            return null;
        }
    });

// ============================================================
// FUNCTION: Freeze Store
// Makes store read-only when trial expires or payment fails
// ============================================================

export const freezeStore = functions.https.onCall(
    async (
        data: { storeId: string; reason: string },
        context
    ) => {
        // Admin-only or system function
        if (!context.auth?.token?.admin) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "Admin access required"
            );
        }

        const { storeId, reason } = data;

        if (!storeId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Store ID is required"
            );
        }

        return await freezeStoreInternal(storeId, reason);
    }
);

// Internal freeze function used by scheduled jobs
async function freezeStoreInternal(
    storeId: string,
    reason: string
): Promise<{ success: boolean; frozenAt: Date }> {
    const now = admin.firestore.Timestamp.now();

    console.log(`🧊 Freezing store: ${storeId}, reason: ${reason}`);

    // Update store
    await db.collection("stores").doc(storeId).update({
        isFrozen: true,
        frozenAt: now,
        freezeReason: reason,
        subscriptionStatus: "frozen",
        updatedAt: now,
    });

    // Update subscription
    const subscriptions = await db
        .collection("subscriptions")
        .where("storeId", "==", storeId)
        .where("status", "==", "active")
        .get();

    for (const sub of subscriptions.docs) {
        await sub.ref.update({
            status: "frozen",
            frozenAt: now,
            freezeReason: reason,
        });
    }

    // Log event
    await db.collection("store_events").add({
        storeId,
        event: "store_frozen",
        reason,
        timestamp: now,
    });

    return { success: true, frozenAt: now.toDate() };
}

// Unfreeze store when user upgrades or pays
async function unfreezeStoreInternal(storeId: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();

    console.log(`🔓 Unfreezing store: ${storeId}`);

    await db.collection("stores").doc(storeId).update({
        isFrozen: false,
        frozenAt: null,
        freezeReason: null,
        subscriptionStatus: "active",
        updatedAt: now,
    });

    // Log event
    await db.collection("store_events").add({
        storeId,
        event: "store_unfrozen",
        timestamp: now,
    });
}

// ============================================================
// FUNCTION: Enforce Product Limit
// Firestore trigger to block adding products over limit
// ============================================================

export const enforceProductLimit = functions.firestore
    .document("stores/{storeId}/products/{productId}")
    .onCreate(async (snap, context) => {
        const { storeId } = context.params;

        console.log(`📦 Checking product limit for store: ${storeId}`);

        try {
            // Get store data
            const storeDoc = await db.collection("stores").doc(storeId).get();
            if (!storeDoc.exists) {
                console.error(`Store not found: ${storeId}`);
                return;
            }

            const store = storeDoc.data();

            // Check if store is frozen
            if (store?.isFrozen) {
                console.log(`🧊 Store is frozen, deleting product: ${snap.id}`);
                await snap.ref.delete();
                throw new Error("Store is frozen. Upgrade your plan to add products.");
            }

            // Get product limit
            const limit = store?.productLimit ?? 50;

            // Unlimited products (-1)
            if (limit === -1) {
                // Update product count
                await storeDoc.ref.update({
                    currentProductCount: admin.firestore.FieldValue.increment(1),
                });
                return;
            }

            // Get current product count
            const productsSnap = await db
                .collection("stores")
                .doc(storeId)
                .collection("products")
                .count()
                .get();

            const currentCount = productsSnap.data().count;

            // Check if over limit
            if (currentCount > limit) {
                console.log(
                    `❌ Product limit exceeded: ${currentCount}/${limit} for store: ${storeId}`
                );

                // Delete the just-created product
                await snap.ref.delete();

                // Get upgrade message based on plan
                const plan = store?.subscriptionPlan || "trial";
                const upgradeMessages: Record<string, string> = {
                    trial: "Your free trial allows 50 products. Upgrade to continue adding products.",
                    starter: "Your Starter plan allows 5 products. Upgrade to Business for 30 products.",
                    business: "Your Business plan allows 30 products. Upgrade to Professional for unlimited products.",
                };

                throw new Error(upgradeMessages[plan] || "Product limit reached.");
            }

            // Update product count
            await storeDoc.ref.update({
                currentProductCount: currentCount,
            });

            console.log(`✅ Product added. Count: ${currentCount}/${limit}`);
        } catch (error: any) {
            console.error(`Product limit error: ${error.message}`);
            throw error;
        }
    });

// Decrement count on product delete
export const decrementProductCount = functions.firestore
    .document("stores/{storeId}/products/{productId}")
    .onDelete(async (_snap, context) => {
        const { storeId } = context.params;

        try {
            await db.collection("stores").doc(storeId).update({
                currentProductCount: admin.firestore.FieldValue.increment(-1),
            });
            console.log(`📉 Decremented product count for store: ${storeId}`);
        } catch (error: any) {
            console.error(`Decrement error: ${error.message}`);
        }
    });

// ============================================================
// FUNCTION: Connect Own Razorpay
// Allows Professional plan users to connect their own Razorpay
// ============================================================

export const connectOwnRazorpay = functions.https.onCall(
    async (
        data: {
            storeId: string;
            keyId: string;
            keySecret: string;
            testMode?: boolean;
        },
        context
    ) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        const { storeId, keyId, keySecret, testMode = false } = data;

        if (!storeId || !keyId || !keySecret) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Store ID, Key ID, and Key Secret are required"
            );
        }

        console.log(`🔑 Connecting own Razorpay for store: ${storeId}`);

        try {
            // 1. Verify store ownership and Professional plan
            const storeDoc = await db.collection("stores").doc(storeId).get();
            if (!storeDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Store not found");
            }

            const store = storeDoc.data();
            if (store?.sellerId !== context.auth.uid) {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "You don't own this store"
                );
            }

            // Check for Professional plan
            if (store?.subscriptionPlan !== "professional") {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    `Own Razorpay is only available on Professional plan. Current plan: ${store?.subscriptionPlan}`
                );
            }

            // 2. Validate Razorpay credentials
            console.log("🔐 Validating Razorpay credentials...");

            const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
            const response = await fetch("https://api.razorpay.com/v1/payments?count=1", {
                headers: {
                    Authorization: `Basic ${auth}`,
                },
            });

            if (response.status === 401) {
                // Save failed attempt
                await db
                    .collection("stores")
                    .doc(storeId)
                    .collection("payment_config")
                    .doc("razorpay")
                    .set({
                        mode: "shared",
                        verified: false,
                        verificationError: "Invalid API credentials",
                        lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                throw new functions.https.HttpsError(
                    "invalid-argument",
                    "Invalid Razorpay API credentials"
                );
            }

            if (!response.ok) {
                throw new functions.https.HttpsError(
                    "internal",
                    "Failed to validate Razorpay credentials"
                );
            }

            // 3. Encrypt and store keys
            const encryptedKeyId = encrypt(keyId);
            const encryptedKeySecret = encrypt(keySecret);

            await db
                .collection("stores")
                .doc(storeId)
                .collection("payment_config")
                .doc("razorpay")
                .set({
                    mode: "ownAccount",
                    razorpayKeyId: encryptedKeyId,
                    razorpayKeySecret: encryptedKeySecret,
                    verified: true,
                    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                    testMode,
                    connectedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

            // 4. Update store payment mode
            await storeDoc.ref.update({
                paymentMode: "ownAccount",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 5. Send confirmation email
            await sendSubscriptionEmail(storeId, "razorpay_connected", {});

            console.log(`✅ Own Razorpay connected for store: ${storeId}`);

            return {
                success: true,
                message: "Razorpay account connected successfully. All payments will now go directly to your account.",
            };
        } catch (error: any) {
            console.error(`❌ Connect Razorpay error: ${error.message}`);

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                "internal",
                error.message || "Failed to connect Razorpay"
            );
        }
    }
);

// ============================================================
// FUNCTION: Get Payment Config for Order
// Returns appropriate Razorpay keys based on store's plan
// ============================================================

export const getPaymentConfigForOrder = functions.https.onCall(
    async (data: { storeId: string }, _context) => {
        const { storeId } = data;

        if (!storeId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Store ID is required"
            );
        }

        try {
            const storeDoc = await db.collection("stores").doc(storeId).get();
            if (!storeDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Store not found");
            }

            const store = storeDoc.data();

            // Check if store is frozen
            if (store?.isFrozen) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "Store is currently unavailable"
                );
            }

            // Check if using own Razorpay (Professional plan)
            if (
                store?.subscriptionPlan === "professional" &&
                store?.paymentMode === "ownAccount"
            ) {
                const configDoc = await db
                    .collection("stores")
                    .doc(storeId)
                    .collection("payment_config")
                    .doc("razorpay")
                    .get();

                const config = configDoc.data();

                if (config?.verified) {
                    return {
                        useOwnAccount: true,
                        keyId: decrypt(config.razorpayKeyId),
                        commissionPercent: 0,
                        testMode: config.testMode || false,
                    };
                }
            }

            // Use Letbuyy's shared Razorpay
            const razorpayConfig = getRazorpayConfig();

            return {
                useOwnAccount: false,
                keyId: razorpayConfig.keyId,
                commissionPercent: store?.commissionPercent ?? 3,
                testMode: false,
            };
        } catch (error: any) {
            console.error(`Get payment config error: ${error.message}`);

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                "internal",
                "Failed to get payment configuration"
            );
        }
    }
);

// ============================================================
// FUNCTION: Upgrade Subscription
// Handles plan upgrades/downgrades
// ============================================================

export const upgradeSubscription = functions.https.onCall(
    async (
        data: {
            storeId: string;
            newPlan: SubscriptionPlan;
            paymentId?: string;
        },
        context
    ) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        const { storeId, newPlan } = data;

        if (!storeId || !newPlan) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Store ID and new plan are required"
            );
        }

        console.log(`📈 Upgrading store ${storeId} to ${newPlan}`);

        try {
            // 1. Verify ownership
            const storeDoc = await db.collection("stores").doc(storeId).get();
            if (!storeDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Store not found");
            }

            const store = storeDoc.data();
            if (store?.sellerId !== context.auth.uid) {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "You don't own this store"
                );
            }

            const currentPlan = store?.subscriptionPlan || "trial";
            const newConfig = PLAN_CONFIGS[newPlan];
            const now = admin.firestore.Timestamp.now();

            // 2. Check product count for downgrade
            if (newConfig.productLimit !== -1) {
                const currentCount = store?.currentProductCount || 0;
                if (currentCount > newConfig.productLimit) {
                    throw new functions.https.HttpsError(
                        "failed-precondition",
                        `You have ${currentCount} products but ${newPlan} plan only allows ${newConfig.productLimit}. Please delete ${currentCount - newConfig.productLimit} products before downgrading.`
                    );
                }
            }

            // 3. Update store
            await storeDoc.ref.update({
                subscriptionPlan: newPlan,
                subscriptionStatus: "active",
                productLimit: newConfig.productLimit,
                commissionPercent: newConfig.commissionPercent,
                previousPlan: currentPlan,
                planChangedAt: now,
                isFrozen: false,
                frozenAt: null,
                freezeReason: null,
                updatedAt: now,
            });

            // 4. Update or create subscription
            const newSubscriptionId = `sub_${storeId}_${Date.now()}`;
            await db.collection("subscriptions").doc(newSubscriptionId).set({
                id: newSubscriptionId,
                storeId,
                plan: newPlan,
                status: "active",
                productLimit: newConfig.productLimit,
                commissionPercent: newConfig.commissionPercent,
                startDate: now,
                previousPlan: currentPlan,
                planChangedAt: now,
                createdAt: now,
            });

            // 5. If upgrading from frozen state, unfreeze
            if (store?.isFrozen) {
                await unfreezeStoreInternal(storeId);
            }

            // 6. Send upgrade confirmation
            await sendSubscriptionEmail(storeId, "plan_upgraded", {
                previousPlan: currentPlan,
                newPlan,
                newProductLimit:
                    newConfig.productLimit === -1 ? "Unlimited" : newConfig.productLimit,
                newCommission: newConfig.commissionPercent,
            });

            console.log(`✅ Upgraded store ${storeId} from ${currentPlan} to ${newPlan}`);

            return {
                success: true,
                previousPlan: currentPlan,
                newPlan,
                productLimit: newConfig.productLimit,
                commissionPercent: newConfig.commissionPercent,
            };
        } catch (error: any) {
            console.error(`❌ Upgrade error: ${error.message}`);

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                "internal",
                error.message || "Failed to upgrade subscription"
            );
        }
    }
);

// ============================================================
// EXPORTS for use in other functions
// ============================================================

export {
    PLAN_CONFIGS,
    freezeStoreInternal,
    unfreezeStoreInternal,
    sendSubscriptionEmail,
    encrypt,
    decrypt,
};
