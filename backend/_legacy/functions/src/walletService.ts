// ============================================================
//  LETBUYY - WALLET SERVICE CLOUD FUNCTIONS
//  Production-grade seller payout system
//  Node.js 20 / firebase-functions
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// ============================================================
//  CONSTANTS
// ============================================================
const GATEWAY_FEE_RATE = 0.03;      // 3% payment gateway fee
const PLATFORM_FEE_RATE = 0.01;     // 1% platform fee
const GST_RATE = 0.18;              // 18% GST on fees
const MIN_WITHDRAWAL = 500;         // Minimum withdrawal amount
const WEEKLY_WITHDRAWAL_LIMIT = 2000; // Weekly manual withdrawal limit

// ============================================================
// LOGGING UTILITIES
// ============================================================
const log = {
    info: (msg: string) => console.log(`ℹ️ [Wallet] ${msg}`),
    success: (msg: string) => console.log(`✅ [Wallet] ${msg}`),
    warn: (msg: string) => console.warn(`⚠️ [Wallet] ${msg}`),
    error: (msg: string) => console.error(`❌ [Wallet] ${msg}`)
};

// ============================================================
// FEE CALCULATION
// ============================================================
interface FeeBreakdown {
    grossAmount: number;
    gatewayFee: number;
    platformFee: number;
    gstOnFees: number;
    totalFees: number;
    netAmount: number;
}

function calculateFees(grossAmount: number): FeeBreakdown {
    const gatewayFee = grossAmount * GATEWAY_FEE_RATE;
    const platformFee = grossAmount * PLATFORM_FEE_RATE;
    const gstOnFees = (gatewayFee + platformFee) * GST_RATE;
    const totalFees = gatewayFee + platformFee + gstOnFees;
    const netAmount = grossAmount - totalFees;

    return {
        grossAmount,
        gatewayFee: Math.round(gatewayFee * 100) / 100,
        platformFee: Math.round(platformFee * 100) / 100,
        gstOnFees: Math.round(gstOnFees * 100) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        netAmount: Math.round(netAmount * 100) / 100,
    };
}

// ============================================================
// NOTIFICATION HELPERS
// ============================================================
async function sendWalletNotification(
    sellerId: string,
    title: string,
    body: string,
    type: string,
    orderId?: string,
    amount?: number
): Promise<void> {
    try {
        const db = admin.firestore();

        // Get seller FCM tokens
        const sellerDoc = await db.collection("sellers").doc(sellerId).get();
        if (!sellerDoc.exists) return;

        const sellerData = sellerDoc.data()!;
        const tokens = (sellerData.fcmTokens as string[]) || [];
        const email = sellerData.email;

        // Send push notification
        if (tokens.length > 0) {
            for (const token of tokens) {
                try {
                    await admin.messaging().send({
                        token,
                        notification: { title, body },
                        data: {
                            type,
                            sellerId,
                            orderId: orderId || "",
                            amount: amount?.toString() || "",
                            timestamp: Date.now().toString(),
                        },
                        android: {
                            priority: "high",
                            notification: {
                                channelId: "wallet_channel",
                                icon: "ic_notification",
                                color: "#0F5257",
                                sound: "default",
                            },
                        },
                        apns: {
                            payload: {
                                aps: {
                                    alert: { title, body },
                                    sound: "default",
                                    badge: 1,
                                },
                            },
                        },
                    });
                } catch (err: any) {
                    log.warn(`Failed to send push to token: ${err?.message}`);
                }
            }
        }

        // Save in-app notification (bell icon) - Use ROOT notifications collection
        // This matches the seller app's NotificationProvider which reads from 'notifications' with 'userId'
        await db.collection("notifications").add({
            userId: sellerId,  // This is the key field for seller app
            userType: "seller",
            title,
            body,
            type,
            icon: type === "wallet_credit" ? "payment" :
                type === "withdrawal_requested" ? "withdrawal" :
                    type === "payout_completed" ? "payment" :
                        type === "payout_failed" ? "error" :
                            type === "auto_payout" ? "withdrawal" : "notifications",
            orderId: orderId || null,
            amount: amount || null,
            read: false,
            data: {
                orderId: orderId || null,
                amount: amount || null,
                type,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send email notification (if email exists)
        if (email) {
            // Add to email queue (processed by separate function)
            await db.collection("email_queue").add({
                to: email,
                template: `wallet_${type}`,
                subject: title,
                data: { title, body, amount, orderId },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "pending",
            });
        }

        log.success(`Wallet notification sent to seller ${sellerId}`);
    } catch (err: any) {
        log.error(`sendWalletNotification error: ${err?.message}`);
    }
}

// ============================================================
// 1️⃣ ON ORDER DELIVERED - Firestore Trigger
// Credits wallet when order is marked as delivered
// ============================================================
export const onOrderDelivered = functions.firestore
    .document("orders/{orderId}")
    .onUpdate(async (change, context) => {
        try {
            const orderId = context.params.orderId;
            const before = change.before.data();
            const after = change.after.data();

            // Only process when status changes to 'delivered'
            if (before.orderStatus === after.orderStatus) return null;
            if (after.orderStatus?.toLowerCase() !== "delivered") return null;

            // ✅ CRITICAL: Skip if already credited (prevents duplicate credits)
            if (after.walletCredited === true) {
                log.info(`Order ${orderId} already credited to wallet, skipping`);
                return null;
            }

            log.info(`Order ${orderId} marked as delivered, processing wallet credit`);

            const sellerId = after.sellerId;
            const orderNumber = after.orderNumber || orderId;
            const grossAmount = after.sellerAmount || after.total || 0;

            if (!sellerId || grossAmount <= 0) {
                log.warn(`Invalid order data: sellerId=${sellerId}, amount=${grossAmount}`);
                return null;
            }

            const db = admin.firestore();

            // Calculate fees
            const fees = calculateFees(grossAmount);

            // Get current seller data
            const sellerRef = db.collection("sellers").doc(sellerId);
            const sellerDoc = await sellerRef.get();

            if (!sellerDoc.exists) {
                log.error(`Seller not found: ${sellerId}`);
                return null;
            }

            const sellerData = sellerDoc.data()!;
            const currentBalance = sellerData.walletBalance || 0;
            const currentPending = sellerData.pendingAmount || 0;
            const lifetimeEarnings = sellerData.lifetimeEarnings || 0;
            const lifetimeFees = sellerData.lifetimeFees || 0;
            const netLifetimeEarnings = sellerData.netLifetimeEarnings || 0;

            // Create wallet transaction
            const transactionRef = db.collection("wallet_transactions").doc();
            const transactionData = {
                sellerId,
                orderId,
                type: "order_credit",
                status: "completed",
                grossAmount: fees.grossAmount,
                gatewayFee: fees.gatewayFee,
                platformFee: fees.platformFee,
                gstOnFees: fees.gstOnFees,
                totalFees: fees.totalFees,
                netAmount: fees.netAmount,
                description: `Payment for Order #${orderNumber}`,
                balanceType: "withdrawable",
                balanceBefore: currentBalance,
                balanceAfter: currentBalance + fees.netAmount,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    orderNumber,
                    productName: after.items?.[0]?.productName || "Order",
                },
            };

            // Batch update
            const batch = db.batch();

            // Update seller wallet
            batch.update(sellerRef, {
                walletBalance: currentBalance + fees.netAmount,
                pendingAmount: Math.max(0, currentPending - fees.grossAmount),
                lifetimeEarnings: lifetimeEarnings + fees.grossAmount,
                lifetimeFees: lifetimeFees + fees.totalFees,
                netLifetimeEarnings: netLifetimeEarnings + fees.netAmount,
            });

            // Create transaction record
            batch.set(transactionRef, transactionData);

            // Update order with wallet info
            batch.update(change.after.ref, {
                walletCredited: true,
                walletTransactionId: transactionRef.id,
                walletCreditedAt: admin.firestore.FieldValue.serverTimestamp(),
                netSellerAmount: fees.netAmount,
                platformFees: fees.totalFees,
            });

            await batch.commit();

            // Send notifications
            await sendWalletNotification(
                sellerId,
                "💰 Payment Received!",
                `₹${fees.netAmount.toFixed(2)} credited to your wallet for Order #${orderNumber}`,
                "wallet_credit",
                orderId,
                fees.netAmount
            );

            log.success(`Wallet credited: ₹${fees.netAmount} to seller ${sellerId}`);
            return { success: true, netAmount: fees.netAmount };

        } catch (err: any) {
            log.error(`onOrderDelivered error: ${err?.message || err}`);
            return { success: false, error: err?.message };
        }
    });

// ============================================================
// 2️⃣ REQUEST WITHDRAWAL - HTTP Callable
// Manual withdrawal request by seller
// ============================================================
export const requestWithdrawal = functions.https.onCall(
    async (data, context) => {
        try {
            if (!context.auth) {
                throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
            }

            const sellerId = data.sellerId || context.auth.uid;
            const amount = data.amount;

            if (!sellerId || !amount || typeof amount !== "number") {
                throw new functions.https.HttpsError("invalid-argument", "sellerId and amount are required");
            }

            // Validate minimum amount
            if (amount < MIN_WITHDRAWAL) {
                throw new functions.https.HttpsError(
                    "invalid-argument",
                    `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}`
                );
            }

            const db = admin.firestore();
            const sellerRef = db.collection("sellers").doc(sellerId);
            const sellerDoc = await sellerRef.get();

            if (!sellerDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Seller not found");
            }

            const sellerData = sellerDoc.data()!;
            const walletBalance = sellerData.walletBalance || 0;
            const weeklyWithdrawn = sellerData.weeklyWithdrawn || 0;
            const lastWeeklyReset = sellerData.lastWeeklyReset?.toDate();
            const storeName = sellerData.storeName || sellerData.name || "";

            // Check available balance
            if (amount > walletBalance) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    `Insufficient balance. Available: ₹${walletBalance.toFixed(2)}`
                );
            }

            // Check weekly limit
            const now = new Date();
            let effectiveWeeklyWithdrawn = weeklyWithdrawn;

            // Reset if last reset was before this Monday
            if (lastWeeklyReset) {
                const thisMonday = getThisMonday();
                if (lastWeeklyReset < thisMonday) {
                    effectiveWeeklyWithdrawn = 0;
                }
            }

            if (effectiveWeeklyWithdrawn + amount > WEEKLY_WITHDRAWAL_LIMIT) {
                const remaining = WEEKLY_WITHDRAWAL_LIMIT - effectiveWeeklyWithdrawn;
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    `Weekly limit exceeded. Remaining: ₹${remaining.toFixed(2)}`
                );
            }

            // Validate bank details - check seller document first, then kyc_submissions as fallback
            let bankDetails = {
                accountNumber: sellerData.bankAccountNumber || "",
                ifscCode: sellerData.bankIfscCode || "",
                accountHolderName: sellerData.bankAccountHolderName || "",
                bankName: sellerData.bankName || "",
            };

            // Fallback: Check kyc_submissions if bank details not in seller document
            if (!bankDetails.accountNumber || !bankDetails.ifscCode) {
                const kycDoc = await db.collection("kyc_submissions").doc(sellerId).get();
                if (kycDoc.exists) {
                    const kycData = kycDoc.data();
                    const kycBankDetails = kycData?.bankDetails;
                    if (kycBankDetails) {
                        bankDetails = {
                            accountNumber: kycBankDetails.accountNumber || "",
                            ifscCode: kycBankDetails.ifscCode || "",
                            accountHolderName: kycBankDetails.accountHolderName || "",
                            bankName: kycBankDetails.bankName || "",
                        };
                        log.info(`Using bank details from kyc_submissions for seller ${sellerId}`);
                    }
                }
            }

            if (!bankDetails.accountNumber || !bankDetails.ifscCode) {
                throw new functions.https.HttpsError(
                    "failed-precondition",
                    "Please add bank details before withdrawing"
                );
            }

            // Create payout request
            const payoutRef = db.collection("payout_requests").doc();
            const payoutData = {
                sellerId,
                sellerName: sellerData.name || "",
                storeName,
                type: "manual",
                amount,
                status: "pending",
                priority: "high",
                bankDetails,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                scheduledFor: null,
                processedAt: null,
                completedAt: null,
                utrNumber: null,
                bankResponseCode: null,
                processedBy: null,
                notes: null,
                failureReason: null,
                retryCount: 0,
                notificationsSent: { push: false, email: false, inApp: false },
            };

            // Create transaction record
            const transactionRef = db.collection("wallet_transactions").doc();
            const transactionData = {
                sellerId,
                orderId: null,
                type: "withdrawal",
                status: "pending",
                grossAmount: amount,
                gatewayFee: 0,
                platformFee: 0,
                gstOnFees: 0,
                totalFees: 0,
                netAmount: amount,
                description: "Manual Withdrawal Request",
                balanceType: "withdrawable",
                balanceBefore: walletBalance,
                balanceAfter: walletBalance - amount,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                completedAt: null,
                metadata: { payoutRequestId: payoutRef.id },
            };

            // Batch update
            const batch = db.batch();

            batch.set(payoutRef, payoutData);
            batch.set(transactionRef, transactionData);
            batch.update(sellerRef, {
                walletBalance: walletBalance - amount,
                inTransitAmount: (sellerData.inTransitAmount || 0) + amount,
                weeklyWithdrawn: effectiveWeeklyWithdrawn + amount,
                lastWeeklyReset: effectiveWeeklyWithdrawn === 0 ? now : lastWeeklyReset,
            });

            await batch.commit();

            // Send notification
            await sendWalletNotification(
                sellerId,
                "💸 Withdrawal Requested",
                `₹${amount.toFixed(2)} withdrawal initiated. Processing within 1-3 business days.`,
                "withdrawal_requested",
                undefined,
                amount
            );

            log.success(`Withdrawal request created: ₹${amount} for seller ${sellerId}`);

            return {
                success: true,
                payoutRequestId: payoutRef.id,
                transactionId: transactionRef.id,
                amount,
                message: `Withdrawal of ₹${amount} requested successfully`,
            };

        } catch (err: any) {
            log.error(`requestWithdrawal error: ${err?.message || err}`);
            if (err instanceof functions.https.HttpsError) throw err;
            throw new functions.https.HttpsError("internal", err?.message || String(err));
        }
    }
);

// ============================================================
// 3️⃣ ADMIN PROCESS PAYOUT - HTTP Callable (Admin only)
// ============================================================
export const adminProcessPayout = functions.https.onCall(
    async (data, context) => {
        try {
            if (!context.auth) {
                throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
            }

            // TODO: Add admin role verification
            // const isAdmin = await checkIfAdmin(context.auth.uid);
            // if (!isAdmin) throw new functions.https.HttpsError("permission-denied", "Admin only");

            const payoutRequestId = data.payoutRequestId;
            const action = data.action; // 'approve', 'reject', 'complete', 'fail', 'hold'
            const utrNumber = data.utrNumber;
            const notes = data.notes;
            const failureReason = data.failureReason;

            if (!payoutRequestId || !action) {
                throw new functions.https.HttpsError("invalid-argument", "payoutRequestId and action required");
            }

            const db = admin.firestore();
            const payoutRef = db.collection("payout_requests").doc(payoutRequestId);
            const payoutDoc = await payoutRef.get();

            if (!payoutDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Payout request not found");
            }

            const payoutData = payoutDoc.data()!;
            const sellerId = payoutData.sellerId;
            const amount = payoutData.amount;

            const sellerRef = db.collection("sellers").doc(sellerId);
            const batch = db.batch();

            const adminId = context.auth.uid;
            const now = admin.firestore.FieldValue.serverTimestamp();

            switch (action) {
                case "approve":
                case "processing":
                    batch.update(payoutRef, {
                        status: "processing",
                        processedAt: now,
                        processedBy: adminId,
                        notes: notes || null,
                    });
                    break;

                case "complete":
                    // Mark as completed
                    batch.update(payoutRef, {
                        status: "completed",
                        completedAt: now,
                        utrNumber: utrNumber || null,
                        notes: notes || null,
                    });

                    // Update seller
                    const sellerDoc = await sellerRef.get();
                    if (sellerDoc.exists) {
                        const sellerData = sellerDoc.data()!;
                        batch.update(sellerRef, {
                            inTransitAmount: Math.max(0, (sellerData.inTransitAmount || 0) - amount),
                            totalWithdrawn: (sellerData.totalWithdrawn || 0) + amount,
                            lastPayoutDate: now,
                            lastPayoutAmount: amount,
                        });
                    }

                    // Update transaction
                    const transactionQuery = await db.collection("wallet_transactions")
                        .where("metadata.payoutRequestId", "==", payoutRequestId)
                        .limit(1)
                        .get();

                    if (!transactionQuery.empty) {
                        batch.update(transactionQuery.docs[0].ref, {
                            status: "completed",
                            completedAt: now,
                            updatedAt: now,
                            "metadata.bankReference": utrNumber || null,
                        });
                    }

                    // Send notification
                    await sendWalletNotification(
                        sellerId,
                        "✅ Payout Completed!",
                        `₹${amount.toFixed(2)} has been transferred to your bank account.${utrNumber ? ` UTR: ${utrNumber}` : ""}`,
                        "payout_completed",
                        undefined,
                        amount
                    );
                    break;

                case "fail":
                    // Return money to wallet
                    const sellerDocFail = await sellerRef.get();
                    if (sellerDocFail.exists) {
                        const sellerData = sellerDocFail.data()!;
                        batch.update(sellerRef, {
                            walletBalance: (sellerData.walletBalance || 0) + amount,
                            inTransitAmount: Math.max(0, (sellerData.inTransitAmount || 0) - amount),
                            weeklyWithdrawn: Math.max(0, (sellerData.weeklyWithdrawn || 0) - amount),
                        });
                    }

                    batch.update(payoutRef, {
                        status: "failed",
                        failureReason: failureReason || "Bank transfer failed",
                        notes: notes || null,
                        completedAt: now,
                    });

                    // Update transaction
                    const failTransactionQuery = await db.collection("wallet_transactions")
                        .where("metadata.payoutRequestId", "==", payoutRequestId)
                        .limit(1)
                        .get();

                    if (!failTransactionQuery.empty) {
                        batch.update(failTransactionQuery.docs[0].ref, {
                            status: "failed",
                            updatedAt: now,
                            "metadata.failureReason": failureReason || "Bank transfer failed",
                        });
                    }

                    await sendWalletNotification(
                        sellerId,
                        "❌ Payout Failed",
                        `₹${amount.toFixed(2)} payout failed. Reason: ${failureReason || "Bank transfer failed"}. Amount returned to wallet.`,
                        "payout_failed",
                        undefined,
                        amount
                    );
                    break;

                case "hold":
                    batch.update(payoutRef, {
                        status: "onHold",
                        notes: notes || null,
                        processedBy: adminId,
                    });
                    break;

                default:
                    throw new functions.https.HttpsError("invalid-argument", `Invalid action: ${action}`);
            }

            await batch.commit();

            log.success(`Payout ${payoutRequestId} ${action} by admin ${adminId}`);

            return { success: true, action, payoutRequestId };

        } catch (err: any) {
            log.error(`adminProcessPayout error: ${err?.message || err}`);
            if (err instanceof functions.https.HttpsError) throw err;
            throw new functions.https.HttpsError("internal", err?.message || String(err));
        }
    }
);

// ============================================================
// 4️⃣ RESET WEEKLY LIMITS - Scheduled (Every Monday 00:01 IST)
// ============================================================
export const resetWeeklyLimits = functions.pubsub
    .schedule("1 0 * * 1") // Every Monday at 00:01
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        try {
            log.info("Starting weekly limit reset...");

            const db = admin.firestore();
            const sellersSnapshot = await db
                .collection("sellers")
                .where("weeklyWithdrawn", ">", 0)
                .get();

            if (sellersSnapshot.empty) {
                log.info("No sellers to reset");
                return { success: true, count: 0 };
            }

            const batch = db.batch();
            const now = admin.firestore.FieldValue.serverTimestamp();

            sellersSnapshot.forEach((doc) => {
                batch.update(doc.ref, {
                    weeklyWithdrawn: 0,
                    lastWeeklyReset: now,
                });
            });

            await batch.commit();

            log.success(`Weekly limits reset for ${sellersSnapshot.size} sellers`);
            return { success: true, count: sellersSnapshot.size };

        } catch (err: any) {
            log.error(`resetWeeklyLimits error: ${err?.message || err}`);
            return { success: false, error: err?.message };
        }
    });

// ============================================================
// 5️⃣ PROCESS AUTO PAYOUTS - Scheduled (Mon-Wed 6:00 AM IST)
// ============================================================
export const processAutoPayouts = functions.pubsub
    .schedule("0 6 * * 1,2,3") // Mon, Tue, Wed at 6:00 AM
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        try {
            log.info("Starting auto-payout processing...");

            const db = admin.firestore();

            // Find sellers with withdrawable balance
            const sellersSnapshot = await db
                .collection("sellers")
                .where("walletBalance", ">", 0)
                .where("payoutEnabled", "==", true)
                .get();

            if (sellersSnapshot.empty) {
                log.info("No sellers with balance for auto-payout");
                return { success: true, count: 0 };
            }

            let processedCount = 0;
            const errors: string[] = [];

            for (const sellerDoc of sellersSnapshot.docs) {
                try {
                    const sellerData = sellerDoc.data();
                    const sellerId = sellerDoc.id;
                    const walletBalance = sellerData.walletBalance || 0;

                    // Skip if balance below minimum
                    if (walletBalance < MIN_WITHDRAWAL) continue;

                    // Check if bank details exist
                    if (!sellerData.bankAccountNumber || !sellerData.bankIfscCode) {
                        log.warn(`Seller ${sellerId} has no bank details, skipping`);
                        continue;
                    }

                    // Create auto-payout request
                    const payoutRef = db.collection("payout_requests").doc();
                    const payoutData = {
                        sellerId,
                        sellerName: sellerData.name || "",
                        storeName: sellerData.storeName || "",
                        type: "auto",
                        amount: walletBalance,
                        status: "pending",
                        priority: "normal",
                        bankDetails: {
                            accountNumber: sellerData.bankAccountNumber || "",
                            ifscCode: sellerData.bankIfscCode || "",
                            accountHolderName: sellerData.bankAccountHolderName || "",
                            bankName: sellerData.bankName || "",
                        },
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
                        processedAt: null,
                        completedAt: null,
                        utrNumber: null,
                        notes: "Auto-payout",
                        retryCount: 0,
                        notificationsSent: { push: false, email: false, inApp: false },
                    };

                    // Create transaction
                    const transactionRef = db.collection("wallet_transactions").doc();
                    const transactionData = {
                        sellerId,
                        orderId: null,
                        type: "auto_payout",
                        status: "pending",
                        grossAmount: walletBalance,
                        gatewayFee: 0,
                        platformFee: 0,
                        gstOnFees: 0,
                        totalFees: 0,
                        netAmount: walletBalance,
                        description: "Weekly Auto Payout",
                        balanceType: "withdrawable",
                        balanceBefore: walletBalance,
                        balanceAfter: 0,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        completedAt: null,
                        metadata: { payoutRequestId: payoutRef.id },
                    };

                    // Batch update
                    const batch = db.batch();
                    batch.set(payoutRef, payoutData);
                    batch.set(transactionRef, transactionData);
                    batch.update(sellerDoc.ref, {
                        walletBalance: 0,
                        inTransitAmount: (sellerData.inTransitAmount || 0) + walletBalance,
                    });

                    await batch.commit();

                    // Send notification
                    await sendWalletNotification(
                        sellerId,
                        "💳 Auto Payout Initiated",
                        `₹${walletBalance.toFixed(2)} weekly payout initiated to your bank account.`,
                        "auto_payout",
                        undefined,
                        walletBalance
                    );

                    processedCount++;

                } catch (err: any) {
                    errors.push(`Seller ${sellerDoc.id}: ${err?.message || err}`);
                }
            }

            log.success(`Auto-payout: ${processedCount} processed, ${errors.length} errors`);

            return {
                success: true,
                processedCount,
                totalSellers: sellersSnapshot.size,
                errors: errors.length > 0 ? errors : undefined,
            };

        } catch (err: any) {
            log.error(`processAutoPayouts error: ${err?.message || err}`);
            return { success: false, error: err?.message };
        }
    });

// ============================================================
// 6️⃣ GET SELLER WALLET STATS - HTTP Callable
// ============================================================
export const getSellerWalletStats = functions.https.onCall(
    async (data, context) => {
        try {
            if (!context.auth) {
                throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
            }

            const sellerId = data.sellerId || context.auth.uid;

            const db = admin.firestore();
            const sellerDoc = await db.collection("sellers").doc(sellerId).get();

            if (!sellerDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Seller not found");
            }

            const sellerData = sellerDoc.data()!;

            // Check if weekly limit needs reset
            let weeklyWithdrawn = sellerData.weeklyWithdrawn || 0;
            const lastWeeklyReset = sellerData.lastWeeklyReset?.toDate();

            if (lastWeeklyReset) {
                const thisMonday = getThisMonday();
                if (lastWeeklyReset < thisMonday) {
                    weeklyWithdrawn = 0;
                }
            }

            return {
                success: true,
                stats: {
                    walletBalance: sellerData.walletBalance || 0,
                    pendingAmount: sellerData.pendingAmount || 0,
                    inTransitAmount: sellerData.inTransitAmount || 0,
                    lifetimeEarnings: sellerData.lifetimeEarnings || 0,
                    lifetimeFees: sellerData.lifetimeFees || 0,
                    netLifetimeEarnings: sellerData.netLifetimeEarnings || 0,
                    weeklyWithdrawn,
                    weeklyRemaining: WEEKLY_WITHDRAWAL_LIMIT - weeklyWithdrawn,
                    totalWithdrawn: sellerData.totalWithdrawn || 0,
                    lastPayoutDate: sellerData.lastPayoutDate?.toDate() || null,
                    lastPayoutAmount: sellerData.lastPayoutAmount || 0,
                    payoutEnabled: sellerData.payoutEnabled ?? true,
                    minWithdrawal: MIN_WITHDRAWAL,
                    weeklyLimit: WEEKLY_WITHDRAWAL_LIMIT,
                },
            };

        } catch (err: any) {
            log.error(`getSellerWalletStats error: ${err?.message || err}`);
            if (err instanceof functions.https.HttpsError) throw err;
            throw new functions.https.HttpsError("internal", err?.message || String(err));
        }
    }
);

// ============================================================
// HELPER: Get this Monday at 00:00
// ============================================================
function getThisMonday(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// ============================================================
// READY LOG
// ============================================================
log.success("✅ Wallet Service functions loaded");
