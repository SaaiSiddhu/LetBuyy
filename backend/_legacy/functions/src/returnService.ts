// ============================================================
// RETURN SERVICE CLOUD FUNCTIONS
// Handle return requests, status changes, notifications, refunds
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();
const messaging = admin.messaging();

// ============================================================
// TYPES
// ============================================================

interface ReturnRequest {
    id: string;
    orderId: string;
    orderNumber: string;
    productId: string;
    productName: string;
    userId: string;
    userName: string;
    userPhone?: string;
    sellerId: string;
    sellerName: string;
    type: "refund" | "exchange";
    status: string;
    reasonCode: string;
    reasonTitle: string;
    refundAmount: number;
    createdAt: admin.firestore.Timestamp;
}

// ============================================================
// TRIGGER: ON RETURN REQUEST CREATED
// ============================================================

export const onReturnRequested = functions.firestore
    .document("return_requests/{returnId}")
    .onCreate(async (snapshot, context) => {
        const returnId = context.params.returnId;
        const returnData = snapshot.data() as ReturnRequest;

        console.log(`📦 New return request: ${returnId}`);

        try {
            // 1. Notify the seller about new return request
            await notifySellerNewReturn(returnData, returnId);

            // 2. Notify the customer that request is received
            await notifyCustomerReturnReceived(returnData, returnId);

            // 3. Check for auto-approval eligibility
            await checkAutoApproval(returnData, returnId);

            console.log(`✅ Return request processed: ${returnId}`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Error processing return request: ${error}`);
            throw error;
        }
    });

// ============================================================
// TRIGGER: ON RETURN STATUS CHANGED
// ============================================================

export const onReturnStatusChanged = functions.firestore
    .document("return_requests/{returnId}")
    .onUpdate(async (change, context) => {
        const returnId = context.params.returnId;
        const before = change.before.data() as ReturnRequest;
        const after = change.after.data() as ReturnRequest;

        // Only process if status changed
        if (before.status === after.status) {
            return null;
        }

        console.log(
            `📦 Return status changed: ${returnId} | ${before.status} → ${after.status}`
        );

        try {
            // Notify customer about status change
            await notifyCustomerStatusChange(after, returnId);

            // Handle specific status transitions
            switch (after.status) {
                case "approved":
                    await handleReturnApproved(after, returnId);
                    break;
                case "rejected":
                    await handleReturnRejected(after, returnId);
                    break;
                case "pickupCompleted":
                    await handlePickupCompleted(after, returnId);
                    break;
                case "qcFailed":
                    await handleQCFailed(after, returnId);
                    break;
                case "refundInitiated":
                    await handleRefundInitiated(after, returnId);
                    break;
                case "refundCompleted":
                    await handleRefundCompleted(after, returnId);
                    break;
                case "exchangeShipped":
                    await handleExchangeShipped(after, returnId);
                    break;
                case "exchangeDelivered":
                    await handleExchangeDelivered(after, returnId);
                    break;
            }

            return { success: true };
        } catch (error) {
            console.error(`❌ Error on status change: ${error}`);
            throw error;
        }
    });

// ============================================================
// SCHEDULED: AUTO-REJECT PENDING RETURNS
// ============================================================

export const autoRejectStaleReturns = functions.pubsub
    .schedule("every 6 hours")
    .onRun(async () => {
        console.log("🔄 Checking for stale return requests...");

        try {
            // Get policy settings
            const policyDoc = await db.doc("settings/return_policy").get();
            const policy = policyDoc.data() || {};

            if (!policy.autoRejectEnabled) {
                console.log("⏭️ Auto-reject disabled");
                return null;
            }

            const autoRejectDays = policy.autoRejectDays || 7;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - autoRejectDays);

            // Find old pending requests
            const staleReturns = await db
                .collection("return_requests")
                .where("status", "==", "requested")
                .where("createdAt", "<", admin.firestore.Timestamp.fromDate(cutoffDate))
                .get();

            console.log(`Found ${staleReturns.size} stale returns`);

            const batch = db.batch();
            staleReturns.forEach((doc) => {
                batch.update(doc.ref, {
                    status: "rejected",
                    sellerRejectionReason: "Auto-rejected: No response from seller",
                    closedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });

            await batch.commit();
            console.log(`✅ Auto-rejected ${staleReturns.size} returns`);

            return { processed: staleReturns.size };
        } catch (error) {
            console.error(`❌ Auto-reject error: ${error}`);
            throw error;
        }
    });

// ============================================================
// CALLABLE: PROCESS REFUND
// ============================================================

export const processReturnRefund = functions.https.onCall(
    async (data, context) => {
        const { returnId, transactionId } = data;

        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        console.log(`💰 Processing refund for return: ${returnId}`);

        try {
            const returnDoc = await db.doc(`return_requests/${returnId}`).get();
            if (!returnDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Return not found");
            }

            const returnData = returnDoc.data() as ReturnRequest;

            // Update return status
            await db.doc(`return_requests/${returnId}`).update({
                status: "refundCompleted",
                refundTransactionId: transactionId,
                refundCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
                closedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Update order status
            await db.doc(`orders/${returnData.orderId}`).update({
                status: "refunded",
                refundAmount: returnData.refundAmount,
                refundTransactionId: transactionId,
                refundedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Notify customer
            await sendPushToUser(returnData.userId, {
                title: "Refund Completed! 💰",
                body: `₹${returnData.refundAmount} has been credited for ${returnData.productName}`,
                data: { type: "return_refunded", returnId },
            });

            console.log(`✅ Refund processed: ${returnId}`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Refund error: ${error}`);
            throw new functions.https.HttpsError("internal", `Refund failed: ${error}`);
        }
    }
);

// ============================================================
// CALLABLE: CREATE EXCHANGE ORDER
// ============================================================

export const createExchangeOrder = functions.https.onCall(
    async (data, context) => {
        const { returnId, newVariantId, newVariantInfo } = data;

        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        console.log(`🔄 Creating exchange order for return: ${returnId}`);

        try {
            const returnDoc = await db.doc(`return_requests/${returnId}`).get();
            if (!returnDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Return not found");
            }

            const returnData = returnDoc.data() as ReturnRequest;

            // Get original order
            const orderDoc = await db.doc(`orders/${returnData.orderId}`).get();
            if (!orderDoc.exists) {
                throw new functions.https.HttpsError(
                    "not-found",
                    "Original order not found"
                );
            }

            const originalOrder = orderDoc.data()!;

            // Create new exchange order
            const exchangeOrderRef = db.collection("orders").doc();
            const exchangeOrderData = {
                ...originalOrder,
                id: exchangeOrderRef.id,
                orderNumber: `EXC-${Date.now().toString().slice(-8)}`,
                isExchangeOrder: true,
                originalOrderId: returnData.orderId,
                returnRequestId: returnId,
                status: "processing",
                paymentStatus: "completed", // No payment needed for exchange
                items: [
                    {
                        ...originalOrder.items[0],
                        variant: newVariantInfo,
                        variantId: newVariantId,
                    },
                ],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            await exchangeOrderRef.set(exchangeOrderData);

            // Update return with exchange order ID
            await db.doc(`return_requests/${returnId}`).update({
                exchangeOrderId: exchangeOrderRef.id,
                status: "exchangeShipped",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Notify customer
            await sendPushToUser(returnData.userId, {
                title: "Exchange Order Created! 📦",
                body: `Your replacement for ${returnData.productName} is being processed`,
                data: { type: "exchange_order", orderId: exchangeOrderRef.id },
            });

            console.log(`✅ Exchange order created: ${exchangeOrderRef.id}`);
            return { success: true, exchangeOrderId: exchangeOrderRef.id };
        } catch (error) {
            console.error(`❌ Exchange order error: ${error}`);
            throw new functions.https.HttpsError(
                "internal",
                `Exchange order failed: ${error}`
            );
        }
    }
);

// ============================================================
// HELPER: NOTIFY SELLER ABOUT NEW RETURN
// ============================================================

async function notifySellerNewReturn(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    // Get seller FCM token
    const sellerDoc = await db.doc(`sellers/${returnData.sellerId}`).get();
    if (!sellerDoc.exists) return;

    const sellerData = sellerDoc.data()!;
    const fcmToken = sellerData.fcmToken;

    if (!fcmToken) {
        console.log("⚠️ Seller has no FCM token");
        return;
    }

    const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
            title: `📦 New ${returnData.type === "refund" ? "Return" : "Exchange"} Request`,
            body: `${returnData.userName} requested ${returnData.type} for ${returnData.productName}`,
        },
        data: {
            type: "new_return_request",
            returnId: returnId,
            orderId: returnData.orderId,
        },
        android: {
            priority: "high",
            notification: {
                channelId: "returns",
                priority: "high",
            },
        },
        apns: {
            payload: {
                aps: {
                    badge: 1,
                    sound: "default",
                },
            },
        },
    };

    try {
        await messaging.send(message);
        console.log(`📱 Notified seller: ${returnData.sellerId}`);
    } catch (error) {
        console.error(`❌ Failed to notify seller: ${error}`);
    }

    // Also create in-app notification
    await db.collection("notifications").add({
        userId: returnData.sellerId,
        userType: "seller",
        title: `New ${returnData.type === "refund" ? "Return" : "Exchange"} Request`,
        body: `${returnData.userName} requested ${returnData.type} for ${returnData.productName}`,
        type: "return_request",
        data: { returnId, orderId: returnData.orderId },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// ============================================================
// HELPER: NOTIFY CUSTOMER ABOUT RETURN RECEIVED
// ============================================================

async function notifyCustomerReturnReceived(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    await sendPushToUser(returnData.userId, {
        title: "Return Request Received! 📋",
        body: `Your ${returnData.type} request for ${returnData.productName} is under review`,
        data: { type: "return_received", returnId },
    });

    // Create in-app notification
    await db.collection("notifications").add({
        userId: returnData.userId,
        userType: "customer",
        title: "Return Request Received",
        body: `Your ${returnData.type} request is under review. The seller will respond soon.`,
        type: "return_status",
        data: { returnId, status: "requested" },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// ============================================================
// HELPER: CHECK AUTO-APPROVAL ELIGIBILITY
// ============================================================

async function checkAutoApproval(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    // Get policy settings
    const policyDoc = await db.doc("settings/return_policy").get();
    const policy = policyDoc.data() || {};

    if (!policy.autoApproveEnabled) {
        console.log("⏭️ Auto-approve disabled");
        return;
    }

    const threshold = policy.autoApproveThreshold || 500;

    if (returnData.refundAmount <= threshold) {
        console.log(
            `✅ Auto-approving return (₹${returnData.refundAmount} <= ₹${threshold})`
        );

        await db.doc(`return_requests/${returnId}`).update({
            status: "approved",
            sellerNotes: `Auto-approved (amount ≤ ₹${threshold})`,
            sellerRespondedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
}

// ============================================================
// HELPER: NOTIFY CUSTOMER STATUS CHANGE
// ============================================================

async function notifyCustomerStatusChange(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    const statusMessages: Record<string, { title: string; body: string }> = {
        approved: {
            title: "Return Approved! ✅",
            body: "Your return request has been approved. Pickup will be scheduled soon.",
        },
        rejected: {
            title: "Return Request Declined",
            body: "Unfortunately, your return request could not be approved.",
        },
        pickupScheduled: {
            title: "Pickup Scheduled! 📅",
            body: "Your return pickup has been scheduled.",
        },
        pickupCompleted: {
            title: "Item Picked Up! 📦",
            body: "Your item has been picked up successfully.",
        },
        qcFailed: {
            title: "Quality Check Issue",
            body: "There was an issue during the quality check.",
        },
        refundInitiated: {
            title: "Refund Processing 💳",
            body: "Your refund is being processed.",
        },
        refundCompleted: {
            title: "Refund Completed! 💰",
            body: `₹${returnData.refundAmount} has been credited to your account.`,
        },
        exchangeShipped: {
            title: "Exchange Shipped! 🚚",
            body: "Your replacement item is on the way.",
        },
        exchangeDelivered: {
            title: "Exchange Complete! ✅",
            body: "Your exchange has been completed successfully.",
        },
    };

    const message = statusMessages[returnData.status];
    if (!message) return;

    // Send push notification
    await sendPushToUser(returnData.userId, {
        title: message.title,
        body: message.body,
        data: { type: "return_status", returnId, status: returnData.status },
    });

    // Create in-app notification
    await db.collection("notifications").add({
        userId: returnData.userId,
        userType: "customer",
        title: message.title.replace(/[!✅💰📦📅💳🚚]/g, "").trim(),
        body: message.body,
        type: "return_status",
        data: { returnId, status: returnData.status },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email notification
    await sendReturnEmail(returnData.userId, "customer", message.title, message.body, {
        returnId,
        status: returnData.status,
        productName: returnData.productName,
        refundAmount: returnData.refundAmount,
    });

    // Also notify seller about customer status changes
    await notifySellerStatusChange(returnData, returnId);

    // Notify admin about all return events
    await notifyAdminReturnEvent(returnData, returnId);
}

// ============================================================
// HELPER: NOTIFY SELLER STATUS CHANGE
// ============================================================

async function notifySellerStatusChange(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    const statusMessages: Record<string, { title: string; body: string }> = {
        approved: {
            title: "Return Approved",
            body: `You approved return for ${returnData.productName}. Schedule pickup now.`,
        },
        rejected: {
            title: "Return Rejected",
            body: `Return for ${returnData.productName} was rejected.`,
        },
        pickupScheduled: {
            title: "Pickup Scheduled 📅",
            body: `Pickup scheduled for ${returnData.productName}.`,
        },
        pickupCompleted: {
            title: "Item Picked Up 📦",
            body: `Return item picked up: ${returnData.productName}. QC pending.`,
        },
        qcFailed: {
            title: "QC Failed ⚠️",
            body: `Quality check failed for ${returnData.productName}. Item returned to customer.`,
        },
        refundInitiated: {
            title: "Refund Processing 💳",
            body: `Refund of ₹${returnData.refundAmount} initiated for ${returnData.productName}.`,
        },
        refundCompleted: {
            title: "Refund Completed 💰",
            body: `₹${returnData.refundAmount} refunded for ${returnData.productName}.`,
        },
        exchangeShipped: {
            title: "Exchange Shipped 🚚",
            body: `Replacement shipped for ${returnData.productName}.`,
        },
        exchangeDelivered: {
            title: "Exchange Delivered ✅",
            body: `Exchange completed for ${returnData.productName}.`,
        },
    };

    const message = statusMessages[returnData.status];
    if (!message) return;

    // Get seller FCM tokens
    const sellerDoc = await db.doc(`sellers/${returnData.sellerId}`).get();
    if (!sellerDoc.exists) return;

    const sellerData = sellerDoc.data()!;
    const fcmTokens: string[] = sellerData.fcmTokens || [];
    const fcmToken = sellerData.fcmToken;

    // Send push notification to all seller devices
    const tokens = fcmToken ? [...fcmTokens, fcmToken] : fcmTokens;
    const uniqueTokens = [...new Set(tokens.filter(t => t))];

    if (uniqueTokens.length > 0) {
        try {
            const pushMessage: admin.messaging.MulticastMessage = {
                tokens: uniqueTokens,
                notification: {
                    title: message.title,
                    body: message.body,
                },
                data: {
                    type: "return_status",
                    returnId,
                    status: returnData.status,
                },
                android: {
                    priority: "high",
                    notification: {
                        channelId: "returns",
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            badge: 1,
                            sound: "default",
                        },
                    },
                },
            };
            await messaging.sendEachForMulticast(pushMessage);
            console.log(`📱 Notified seller ${returnData.sellerId} about status: ${returnData.status}`);
        } catch (error) {
            console.error(`❌ Failed to notify seller: ${error}`);
        }
    }

    // Create in-app notification for seller
    await db.collection("notifications").add({
        userId: returnData.sellerId,
        userType: "seller",
        title: message.title.replace(/[📅📦⚠️💳💰🚚✅]/g, "").trim(),
        body: message.body,
        type: "return_status",
        data: { returnId, status: returnData.status, orderId: returnData.orderId },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send email to seller
    const sellerEmail = sellerData.email;
    if (sellerEmail) {
        await sendReturnEmail(returnData.sellerId, "seller", message.title, message.body, {
            returnId,
            status: returnData.status,
            productName: returnData.productName,
            customerName: returnData.userName,
            refundAmount: returnData.refundAmount,
        });
    }
}

// ============================================================
// HELPER: NOTIFY ADMIN RETURN EVENT
// ============================================================

async function notifyAdminReturnEvent(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    const statusMessages: Record<string, { title: string; body: string }> = {
        requested: {
            title: "New Return Request",
            body: `${returnData.userName} requested ${returnData.type} for ${returnData.productName} (₹${returnData.refundAmount})`,
        },
        approved: {
            title: "Return Approved",
            body: `${returnData.sellerName} approved return: ${returnData.productName}`,
        },
        rejected: {
            title: "Return Rejected",
            body: `${returnData.sellerName} rejected return: ${returnData.productName}`,
        },
        pickupScheduled: {
            title: "Pickup Scheduled",
            body: `Pickup scheduled for ${returnData.productName}`,
        },
        pickupCompleted: {
            title: "Pickup Completed",
            body: `Item picked up: ${returnData.productName}`,
        },
        qcFailed: {
            title: "QC Failed ⚠️",
            body: `Quality check failed: ${returnData.productName}`,
        },
        refundInitiated: {
            title: "Refund Initiated",
            body: `Refund of ₹${returnData.refundAmount} initiated`,
        },
        refundCompleted: {
            title: "Refund Completed",
            body: `₹${returnData.refundAmount} refunded to ${returnData.userName}`,
        },
        exchangeShipped: {
            title: "Exchange Shipped",
            body: `Replacement shipped for ${returnData.productName}`,
        },
        exchangeDelivered: {
            title: "Exchange Delivered",
            body: `Exchange completed: ${returnData.productName}`,
        },
    };

    const message = statusMessages[returnData.status];
    if (!message) return;

    // Get all admin users
    const adminsQuery = await db.collection("admins").where("isActive", "==", true).get();

    for (const adminDoc of adminsQuery.docs) {
        const adminData = adminDoc.data();
        const adminId = adminDoc.id;

        // Send push notification to admin
        const fcmTokens: string[] = adminData.fcmTokens || [];
        const fcmToken = adminData.fcmToken;
        const tokens = fcmToken ? [...fcmTokens, fcmToken] : fcmTokens;
        const uniqueTokens = [...new Set(tokens.filter(t => t))];

        if (uniqueTokens.length > 0) {
            try {
                const pushMessage: admin.messaging.MulticastMessage = {
                    tokens: uniqueTokens,
                    notification: {
                        title: message.title,
                        body: message.body,
                    },
                    data: {
                        type: "admin_return_alert",
                        returnId,
                        status: returnData.status,
                    },
                    android: {
                        priority: "high",
                        notification: {
                            channelId: "admin_alerts",
                        },
                    },
                };
                await messaging.sendEachForMulticast(pushMessage);
            } catch (error) {
                console.error(`❌ Failed to notify admin ${adminId}: ${error}`);
            }
        }

        // Create in-app notification for admin
        await db.collection("notifications").add({
            userId: adminId,
            userType: "admin",
            title: message.title,
            body: message.body,
            type: "return_alert",
            data: {
                returnId,
                status: returnData.status,
                sellerId: returnData.sellerId,
                customerId: returnData.userId,
            },
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send email to admin
        const adminEmail = adminData.email;
        if (adminEmail) {
            await sendReturnEmail(adminId, "admin", message.title, message.body, {
                returnId,
                status: returnData.status,
                productName: returnData.productName,
                customerName: returnData.userName,
                sellerName: returnData.sellerName,
                refundAmount: returnData.refundAmount,
            });
        }
    }

    console.log(`📢 Notified ${adminsQuery.size} admins about return event: ${returnData.status}`);
}

// ============================================================
// HELPER: SEND RETURN EMAIL
// ============================================================

async function sendReturnEmail(
    userId: string,
    userType: "customer" | "seller" | "admin",
    subject: string,
    body: string,
    data: Record<string, any>
): Promise<void> {
    try {
        // Get user email based on user type
        let email: string | null = null;

        if (userType === "customer") {
            const userDoc = await db.doc(`users/${userId}`).get();
            email = userDoc.data()?.email;
        } else if (userType === "seller") {
            const sellerDoc = await db.doc(`sellers/${userId}`).get();
            email = sellerDoc.data()?.email;
        } else if (userType === "admin") {
            const adminDoc = await db.doc(`admins/${userId}`).get();
            email = adminDoc.data()?.email;
        }

        if (!email) {
            console.log(`⚠️ No email found for ${userType} ${userId}`);
            return;
        }

        // Add to email queue for processing
        await db.collection("email_queue").add({
            to: email,
            template: `return_${data.status}`,
            subject: subject.replace(/[✅💰📦📅💳🚚⚠️]/g, "").trim(),
            data: {
                ...data,
                userType,
                body,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "pending",
        });

        console.log(`📧 Email queued for ${userType}: ${email}`);
    } catch (error) {
        console.error(`❌ sendReturnEmail error: ${error}`);
    }
}


// ============================================================
// STATUS HANDLERS
// ============================================================

async function handleReturnApproved(
    _returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`✅ Return approved: ${returnId}`);
    // Seller will schedule pickup manually
}

async function handleReturnRejected(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`❌ Return rejected: ${returnId}`);
    // Update order to remove return flag
    await db.doc(`orders/${returnData.orderId}`).update({
        hasReturnRequest: false,
        returnRequestId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function handlePickupCompleted(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`📦 Pickup completed: ${returnId}`);
    // If auto-refund is enabled, initiate refund
    const policyDoc = await db.doc("settings/return_policy").get();
    const policy = policyDoc.data() || {};

    if (policy.autoRefundOnQcPass && returnData.type === "refund") {
        await db.doc(`return_requests/${returnId}`).update({
            status: "refundInitiated",
            refundInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
}

async function handleQCFailed(
    _returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`⚠️ QC failed: ${returnId}`);
    // Mark as closed, product returned to customer
}

async function handleRefundInitiated(
    _returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`💳 Refund initiated: ${returnId}`);
    // Actual refund processing would happen here or via Razorpay webhook
}

async function handleRefundCompleted(
    returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`💰 Refund completed: ${returnId}`);
    // Update order status
    await db.doc(`orders/${returnData.orderId}`).update({
        status: "refunded",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function handleExchangeShipped(
    _returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`🚚 Exchange shipped: ${returnId}`);
}

async function handleExchangeDelivered(
    _returnData: ReturnRequest,
    returnId: string
): Promise<void> {
    console.log(`✅ Exchange delivered: ${returnId}`);
}

// ============================================================
// HELPER: SEND PUSH TO USER
// ============================================================

async function sendPushToUser(
    userId: string,
    notification: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
    // Get user FCM tokens (supports both fcmTokens array and legacy fcmToken field)
    const userDoc = await db.doc(`users/${userId}`).get();
    if (!userDoc.exists) {
        console.log(`⚠️ User ${userId} not found`);
        return;
    }

    const userData = userDoc.data()!;

    // Collect all tokens - fcmTokens array and legacy fcmToken field
    const fcmTokensArray: string[] = userData.fcmTokens || [];
    const legacyToken = userData.fcmToken;
    const allTokens = legacyToken
        ? [...new Set([...fcmTokensArray, legacyToken])]
        : fcmTokensArray;

    const validTokens = allTokens.filter((t: string) => t && t.length > 0);

    if (validTokens.length === 0) {
        console.log(`⚠️ User ${userId} has no FCM tokens`);
        return;
    }

    console.log(`📱 Sending push to ${validTokens.length} tokens for user ${userId}`);

    const message: admin.messaging.MulticastMessage = {
        tokens: validTokens,
        notification: {
            title: notification.title,
            body: notification.body,
        },
        data: notification.data || {},
        android: {
            priority: "high",
            notification: {
                channelId: "returns",
            },
        },
        apns: {
            payload: {
                aps: {
                    badge: 1,
                    sound: "default",
                },
            },
        },
    };

    try {
        const response = await messaging.sendEachForMulticast(message);
        console.log(`📱 Push sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failed`);

        // Clean up invalid tokens
        if (response.failureCount > 0) {
            const invalidTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                    invalidTokens.push(validTokens[idx]);
                }
            });

            if (invalidTokens.length > 0) {
                await db.doc(`users/${userId}`).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
                });
                console.log(`🧹 Cleaned ${invalidTokens.length} invalid tokens`);
            }
        }
    } catch (error) {
        console.error(`❌ Failed to notify user ${userId}: ${error}`);
    }
}

// ============================================================
// CALLABLE: GET RETURN ANALYTICS
// ============================================================

export const getReturnAnalytics = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        const { sellerId, startDate, endDate } = data;

        try {
            let query: admin.firestore.Query = db.collection("return_requests");

            if (sellerId) {
                query = query.where("sellerId", "==", sellerId);
            }

            if (startDate) {
                query = query.where(
                    "createdAt",
                    ">=",
                    admin.firestore.Timestamp.fromDate(new Date(startDate))
                );
            }

            if (endDate) {
                query = query.where(
                    "createdAt",
                    "<=",
                    admin.firestore.Timestamp.fromDate(new Date(endDate))
                );
            }

            const snapshot = await query.get();

            const stats = {
                total: 0,
                byStatus: {} as Record<string, number>,
                byType: { refund: 0, exchange: 0 },
                byReason: {} as Record<string, number>,
                totalRefundAmount: 0,
                avgProcessingTime: 0,
            };

            let totalProcessingDays = 0;
            let closedCount = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                stats.total++;

                // By status
                stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;

                // By type
                if (data.type === "refund") stats.byType.refund++;
                else if (data.type === "exchange") stats.byType.exchange++;

                // By reason
                stats.byReason[data.reasonCode] =
                    (stats.byReason[data.reasonCode] || 0) + 1;

                // Total refund
                if (data.status === "refundCompleted") {
                    stats.totalRefundAmount += data.refundAmount || 0;
                }

                // Processing time
                if (data.closedAt && data.createdAt) {
                    const created = data.createdAt.toDate();
                    const closed = data.closedAt.toDate();
                    const days = Math.ceil(
                        (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    totalProcessingDays += days;
                    closedCount++;
                }
            });

            if (closedCount > 0) {
                stats.avgProcessingTime = Math.round(totalProcessingDays / closedCount);
            }

            return stats;
        } catch (error) {
            console.error(`❌ Analytics error: ${error}`);
            throw new functions.https.HttpsError(
                "internal",
                `Analytics failed: ${error}`
            );
        }
    }
);
