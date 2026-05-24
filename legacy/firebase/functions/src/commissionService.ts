// ============================================================
// COMMISSION SERVICE - LetBuyy Seller Commission System
// Handles commission calculation, order processing, tier updates
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ============================================================
// TYPES
// ============================================================

interface CommissionSnapshot {
    categoryPath: string[];
    resolvedFrom: string;
    categoryPercent: number;
    tierModifier: number;
    isAdOrder: boolean;
    adDiscount: number;
    finalPercent: number;
    commissionAmount: number;
    sellerEarnings: number;
    status: "pending" | "deducted" | "refunded";
    deductedAt: admin.firestore.Timestamp | null;
    refundedAt: admin.firestore.Timestamp | null;
}

interface TierConfig {
    maxRevenue: number | null;
    modifier: number;
}

interface CommissionSettings {
    tiers: {
        newSeller: TierConfig;
        standard: TierConfig;
        verified: TierConfig;
        premium: TierConfig;
    };
    holdDays: number;
    defaultAdDiscount: number;
    minCommission: number;
    maxCommission: number;
    defaultPercent: number;
}

// ============================================================
// HELPER: Get Commission Settings
// ============================================================

async function getCommissionSettings(): Promise<CommissionSettings> {
    const doc = await db.doc("settings/commission").get();
    if (!doc.exists) {
        // Return defaults if not configured
        return {
            tiers: {
                newSeller: { maxRevenue: 50000, modifier: 2.0 },
                standard: { maxRevenue: 200000, modifier: 0.0 },
                verified: { maxRevenue: 1000000, modifier: -1.0 },
                premium: { maxRevenue: null, modifier: -2.0 },
            },
            holdDays: 7,
            defaultAdDiscount: 4.0,
            minCommission: 0.0,
            maxCommission: 10.0,
            defaultPercent: 5.0,
        };
    }
    return doc.data() as CommissionSettings;
}

// ============================================================
// HELPER: Resolve Category Commission (Walk Tree)
// ============================================================

async function resolveCategoryCommission(
    categoryId: string
): Promise<{ percent: number; adDiscount: number | null; resolvedFrom: string; categoryPath: string[] }> {
    const categoryPath: string[] = [];
    let currentId: string | null = categoryId;
    let resolvedPercent: number | null = null;
    let resolvedAdDiscount: number | null = null;
    let resolvedFrom: string = categoryId;

    // Walk up the category tree
    while (currentId) {
        categoryPath.unshift(currentId);
        const catDoc = await db.collection("categories").doc(currentId).get();

        if (!catDoc.exists) break;

        const catData = catDoc.data();
        const commission = catData?.commission;

        // Check if this category has explicit commission
        if (commission?.percent !== null && commission?.percent !== undefined) {
            if (resolvedPercent === null) {
                resolvedPercent = commission.percent;
                resolvedFrom = currentId;
            }
        }

        // Check for ad discount
        if (commission?.adDiscount !== null && commission?.adDiscount !== undefined) {
            if (resolvedAdDiscount === null) {
                resolvedAdDiscount = commission.adDiscount;
            }
        }

        // Move to parent
        currentId = catData?.parentId || null;
    }

    // Get global defaults if needed
    const settings = await getCommissionSettings();

    return {
        percent: resolvedPercent ?? settings.defaultPercent,
        adDiscount: resolvedAdDiscount,
        resolvedFrom,
        categoryPath,
    };
}

// ============================================================
// HELPER: Get Seller Tier Modifier
// ============================================================

async function getSellerTierModifier(
    sellerId: string
): Promise<{ tier: string; modifier: number }> {
    const sellerDoc = await db.collection("sellers").doc(sellerId).get();

    if (!sellerDoc.exists) {
        return { tier: "newSeller", modifier: 2.0 };
    }

    const sellerData = sellerDoc.data();
    const commission = sellerData?.commission;

    // If seller has custom override, return 0 modifier (override applies separately)
    if (commission?.customOverride !== null && commission?.customOverride !== undefined) {
        return { tier: "custom", modifier: 0 };
    }

    return {
        tier: commission?.tier || "newSeller",
        modifier: commission?.tierModifier ?? 2.0,
    };
}

// ============================================================
// FUNCTION: Calculate Commission for Order
// Called when order is created
// ============================================================

export const calculateOrderCommission = functions.https.onCall(
    async (data: { orderId: string; sellerId: string; productId?: string; categoryId?: string; orderTotal: number; isAdOrder: boolean }) => {
        try {
            const { orderId, sellerId, productId, orderTotal, isAdOrder } = data;
            let { categoryId } = data;

            if (!orderId || !sellerId || orderTotal === undefined) {
                throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
            }

            // If categoryId not provided, look it up from productId
            if (!categoryId && productId) {
                const productDoc = await db.collection("products").doc(productId).get();
                if (productDoc.exists) {
                    categoryId = productDoc.data()?.categoryId || productDoc.data()?.category?.id;
                }
            }

            // Default to generic category if still not found
            if (!categoryId) {
                console.warn(`⚠️ No category found for product ${productId}, using defaults`);
                categoryId = "default";
            }

            // 1. Get category commission (walk tree)
            const categoryCommission = await resolveCategoryCommission(categoryId);

            // 2. Get seller tier modifier
            const sellerTier = await getSellerTierModifier(sellerId);

            // 3. Get global settings for ad discount and limits
            const settings = await getCommissionSettings();

            // 4. Check for custom override
            const sellerDoc = await db.collection("sellers").doc(sellerId).get();
            const customOverride = sellerDoc.data()?.commission?.customOverride;

            // 5. Calculate final commission
            let finalPercent: number;

            if (customOverride !== null && customOverride !== undefined) {
                // Admin override takes priority
                finalPercent = customOverride;
            } else {
                // Formula: Category Base + Tier Modifier - Ad Discount
                finalPercent = categoryCommission.percent + sellerTier.modifier;

                if (isAdOrder) {
                    const adDiscount = categoryCommission.adDiscount ?? settings.defaultAdDiscount;
                    finalPercent -= adDiscount;
                }

                // Clamp to min/max
                finalPercent = Math.max(
                    settings.minCommission,
                    Math.min(settings.maxCommission, finalPercent)
                );
            }

            // 6. Calculate amounts
            const commissionAmount = (orderTotal * finalPercent) / 100;
            const sellerEarnings = orderTotal - commissionAmount;

            // 7. Create snapshot
            const snapshot: CommissionSnapshot = {
                categoryPath: categoryCommission.categoryPath,
                resolvedFrom: categoryCommission.resolvedFrom,
                categoryPercent: categoryCommission.percent,
                tierModifier: sellerTier.modifier,
                isAdOrder,
                adDiscount: isAdOrder ? (categoryCommission.adDiscount ?? settings.defaultAdDiscount) : 0,
                finalPercent,
                commissionAmount,
                sellerEarnings,
                status: "pending",
                deductedAt: null,
                refundedAt: null,
            };

            // 8. Update order with commission snapshot
            await db.collection("orders").doc(orderId).update({
                commissionSnapshot: snapshot,
            });

            console.log(`✅ Commission calculated for order ${orderId}: ${finalPercent}% = ₹${commissionAmount}`);

            return {
                success: true,
                snapshot,
            };
        } catch (error) {
            console.error("❌ Error calculating commission:", error);
            throw new functions.https.HttpsError("internal", "Failed to calculate commission");
        }
    }
);

// ============================================================
// FUNCTION: Process Delivered Order
// Called when order status changes to "delivered"
// ============================================================

export const processDeliveredOrderCommission = functions.https.onCall(
    async (data: { orderId: string }) => {
        try {
            const { orderId } = data;

            if (!orderId) {
                throw new functions.https.HttpsError("invalid-argument", "Order ID required");
            }

            const orderDoc = await db.collection("orders").doc(orderId).get();

            if (!orderDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Order not found");
            }

            const orderData = orderDoc.data();
            const commission = orderData?.commissionSnapshot as CommissionSnapshot;

            if (!commission) {
                throw new functions.https.HttpsError("failed-precondition", "No commission snapshot");
            }

            if (commission.status !== "pending") {
                return { success: true, message: "Commission already processed" };
            }

            const sellerId = orderData?.sellerId;
            const settings = await getCommissionSettings();

            // Calculate hold release date
            const holdReleaseDate = new Date();
            holdReleaseDate.setDate(holdReleaseDate.getDate() + settings.holdDays);

            // Use batch for atomic operations
            const batch = db.batch();

            // 1. Update order commission status
            batch.update(orderDoc.ref, {
                "commissionSnapshot.status": "deducted",
                "commissionSnapshot.deductedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            // 2. Update seller wallet
            const sellerRef = db.collection("sellers").doc(sellerId);
            batch.update(sellerRef, {
                pendingAmount: admin.firestore.FieldValue.increment(commission.sellerEarnings),
                lifetimeEarnings: admin.firestore.FieldValue.increment(orderData?.total ?? 0),
                lifetimeFees: admin.firestore.FieldValue.increment(commission.commissionAmount),
            });

            // 3. Create pending payout record
            const payoutRef = db.collection("sellers").doc(sellerId).collection("pendingPayouts").doc();
            batch.set(payoutRef, {
                orderId,
                amount: commission.sellerEarnings,
                commission: commission.commissionAmount,
                commissionPercent: commission.finalPercent,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                releaseAt: admin.firestore.Timestamp.fromDate(holdReleaseDate),
                status: "holding",
            });

            // 4. Log commission deduction
            const logRef = db.collection("commissionLogs").doc();
            batch.set(logRef, {
                orderId,
                sellerId,
                type: "deduction",
                orderTotal: orderData?.total ?? 0,
                commissionPercent: commission.finalPercent,
                commissionAmount: commission.commissionAmount,
                sellerEarnings: commission.sellerEarnings,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            await batch.commit();

            console.log(`✅ Commission deducted for order ${orderId}: ₹${commission.commissionAmount}`);

            return {
                success: true,
                commissionDeducted: commission.commissionAmount,
                sellerEarnings: commission.sellerEarnings,
                releaseDate: holdReleaseDate.toISOString(),
            };
        } catch (error) {
            console.error("❌ Error processing delivered order:", error);
            throw new functions.https.HttpsError("internal", "Failed to process commission");
        }
    }
);

// ============================================================
// FUNCTION: Handle Return Commission Refund
// Called when return is approved
// ============================================================

export const handleReturnCommission = functions.https.onCall(
    async (data: { orderId: string; refundType: "full" | "partial"; partialAmount?: number }) => {
        try {
            const { orderId, refundType, partialAmount } = data;

            const orderDoc = await db.collection("orders").doc(orderId).get();

            if (!orderDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Order not found");
            }

            const orderData = orderDoc.data();
            const commission = orderData?.commissionSnapshot as CommissionSnapshot;
            const sellerId = orderData?.sellerId;

            if (!commission || commission.status !== "deducted") {
                return { success: false, message: "No deducted commission to refund" };
            }

            // Calculate refund amount
            let refundAmount: number;
            if (refundType === "full") {
                refundAmount = commission.commissionAmount;
            } else {
                // Partial refund: proportional commission refund
                const refundRatio = (partialAmount ?? 0) / (orderData?.total ?? 1);
                refundAmount = commission.commissionAmount * refundRatio;
            }

            const batch = db.batch();

            // 1. Update order commission status
            batch.update(orderDoc.ref, {
                "commissionSnapshot.status": "refunded",
                "commissionSnapshot.refundedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            // 2. Deduct from seller's pending/wallet (they don't pay commission on returned items)
            const sellerRef = db.collection("sellers").doc(sellerId);
            batch.update(sellerRef, {
                lifetimeFees: admin.firestore.FieldValue.increment(-refundAmount),
            });

            // 3. Log refund
            const logRef = db.collection("commissionLogs").doc();
            batch.set(logRef, {
                orderId,
                sellerId,
                type: "refund",
                refundType,
                commissionRefunded: refundAmount,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            await batch.commit();

            console.log(`✅ Commission refunded for order ${orderId}: ₹${refundAmount}`);

            return {
                success: true,
                refundedAmount: refundAmount,
            };
        } catch (error) {
            console.error("❌ Error handling return commission:", error);
            throw new functions.https.HttpsError("internal", "Failed to refund commission");
        }
    }
);

// ============================================================
// FUNCTION: Update Seller Tiers (Scheduled - Weekly)
// ============================================================

export const updateSellerTiers = functions.pubsub
    .schedule("every monday 00:00")
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        try {
            const settings = await getCommissionSettings();
            const tiers = settings.tiers;

            // Get all active sellers
            const sellersSnap = await db.collection("sellers")
                .where("isActive", "==", true)
                .get();

            let updated = 0;
            const batch = db.batch();

            for (const doc of sellersSnap.docs) {
                const sellerData = doc.data();
                const totalRevenue = sellerData.totalRevenue ?? 0;
                const currentTier = sellerData.commission?.tier ?? "newSeller";

                // Determine new tier based on revenue
                let newTier: string;
                let newModifier: number;

                if (totalRevenue < (tiers.newSeller.maxRevenue ?? Infinity)) {
                    newTier = "newSeller";
                    newModifier = tiers.newSeller.modifier;
                } else if (totalRevenue < (tiers.standard.maxRevenue ?? Infinity)) {
                    newTier = "standard";
                    newModifier = tiers.standard.modifier;
                } else if (totalRevenue < (tiers.verified.maxRevenue ?? Infinity)) {
                    newTier = "verified";
                    newModifier = tiers.verified.modifier;
                } else {
                    newTier = "premium";
                    newModifier = tiers.premium.modifier;
                }

                // Update if tier changed
                if (newTier !== currentTier) {
                    batch.update(doc.ref, {
                        "commission.tier": newTier,
                        "commission.tierModifier": newModifier,
                        "commission.lastTierUpdate": admin.firestore.FieldValue.serverTimestamp(),
                    });
                    updated++;
                }
            }

            if (updated > 0) {
                await batch.commit();
            }

            console.log(`✅ Seller tier update complete: ${updated} sellers updated`);
            return null;
        } catch (error) {
            console.error("❌ Error updating seller tiers:", error);
            return null;
        }
    });

// ============================================================
// FUNCTION: Release Held Payouts (Scheduled - Daily)
// ============================================================

export const releaseHeldPayouts = functions.pubsub
    .schedule("every day 02:00")
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        try {
            const now = admin.firestore.Timestamp.now();

            // Find all pending payouts that are ready to release
            const payoutsSnap = await db.collectionGroup("pendingPayouts")
                .where("status", "==", "holding")
                .where("releaseAt", "<=", now)
                .get();

            let released = 0;

            for (const doc of payoutsSnap.docs) {
                const payoutData = doc.data();
                const sellerId = doc.ref.parent.parent?.id;

                if (!sellerId) continue;

                const batch = db.batch();

                // Move from pending to wallet balance
                const sellerRef = db.collection("sellers").doc(sellerId);
                batch.update(sellerRef, {
                    pendingAmount: admin.firestore.FieldValue.increment(-payoutData.amount),
                    walletBalance: admin.firestore.FieldValue.increment(payoutData.amount),
                });

                // Update payout status
                batch.update(doc.ref, {
                    status: "released",
                    releasedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                await batch.commit();
                released++;
            }

            console.log(`✅ Released ${released} held payouts`);
            return null;
        } catch (error) {
            console.error("❌ Error releasing payouts:", error);
            return null;
        }
    });

// ============================================================
// FUNCTION: Get Commission Analytics (Admin)
// ============================================================

export const getCommissionAnalytics = functions.https.onCall(
    async (data: { startDate: string; endDate: string }) => {
        try {
            const { startDate, endDate } = data;

            const start = admin.firestore.Timestamp.fromDate(new Date(startDate));
            const end = admin.firestore.Timestamp.fromDate(new Date(endDate));

            const logsSnap = await db.collection("commissionLogs")
                .where("timestamp", ">=", start)
                .where("timestamp", "<=", end)
                .get();

            let totalCommission = 0;
            let totalRefunded = 0;
            let orderCount = 0;

            for (const doc of logsSnap.docs) {
                const log = doc.data();
                if (log.type === "deduction") {
                    totalCommission += log.commissionAmount ?? 0;
                    orderCount++;
                } else if (log.type === "refund") {
                    totalRefunded += log.commissionRefunded ?? 0;
                }
            }

            return {
                success: true,
                totalCommission,
                totalRefunded,
                netCommission: totalCommission - totalRefunded,
                orderCount,
                avgCommission: orderCount > 0 ? totalCommission / orderCount : 0,
            };
        } catch (error) {
            console.error("❌ Error getting analytics:", error);
            throw new functions.https.HttpsError("internal", "Failed to get analytics");
        }
    }
);
