// ============================================================
// LETBUYY - ORDER NOTIFICATION SERVICE
// Firestore triggers for automatic order notifications
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// ============================================================
// LOGGING UTILITIES
// ============================================================
const log = {
    info: (msg: string) => console.log(`ℹ️ [OrderNotifications] ${msg}`),
    success: (msg: string) => console.log(`✅ [OrderNotifications] ${msg}`),
    warn: (msg: string) => console.warn(`⚠️ [OrderNotifications] ${msg}`),
    error: (msg: string) => console.error(`❌ [OrderNotifications] ${msg}`)
};

// ============================================================
// ORDER CREATED - FIRESTORE TRIGGER
// Automatically sends push notification to seller when order is created
// ============================================================
export const onOrderCreated = functions
    .region("us-central1")
    .firestore.document("orders/{orderId}")
    .onCreate(async (snapshot, context) => {
        const orderId = context.params.orderId;
        const orderData = snapshot.data();

        log.info(`New order created: ${orderId}`);

        try {
            // Extract order details
            const sellerId = orderData?.sellerId;
            const orderNumber = orderData?.orderNumber;
            const orderTotal = orderData?.pricing?.total;
            const itemCount = orderData?.items?.length || 0;
            const customerName = orderData?.customer?.name;

            if (!sellerId) {
                log.warn(`Order ${orderId} has no sellerId, skipping notification`);
                return;
            }

            log.info(`Notifying seller ${sellerId} about order ${orderNumber}`);

            // Get seller's FCM tokens
            const sellerDoc = await admin.firestore().collection("sellers").doc(sellerId).get();

            if (!sellerDoc.exists) {
                log.warn(`Seller ${sellerId} not found`);
                return;
            }

            const sellerData = sellerDoc.data();
            const fcmTokens = sellerData?.fcmTokens || [];
            const sellerEmail = sellerData?.email;

            // Build notification content
            const title = "🛒 New Order Received!";
            let body = `Order #${orderNumber}`;
            if (orderTotal) {
                body += ` - ₹${orderTotal.toFixed(0)}`;
            }
            if (itemCount > 0) {
                body += ` (${itemCount} item${itemCount > 1 ? 's' : ''})`;
            }
            if (customerName) {
                body += `\nCustomer: ${customerName}`;
            }

            // Send push notification if tokens exist
            if (fcmTokens.length > 0) {
                log.info(`Found ${fcmTokens.length} FCM token(s) for seller`);

                let successCount = 0;
                let failureCount = 0;
                const removedTokens: string[] = [];

                for (const token of fcmTokens) {
                    try {
                        await admin.messaging().send({
                            token,
                            notification: { title, body },
                            data: {
                                type: "new_order",
                                orderId,
                                orderNumber: orderNumber || "",
                                click_action: "FLUTTER_NOTIFICATION_CLICK"
                            },
                            android: {
                                priority: "high",
                                notification: {
                                    channelId: "orders_channel",
                                    icon: "ic_notification",
                                    color: "#0F5257",
                                    sound: "default"
                                }
                            },
                            apns: {
                                headers: { "apns-priority": "10" },
                                payload: {
                                    aps: {
                                        alert: { title, body },
                                        sound: "default",
                                        badge: 1
                                    }
                                }
                            }
                        });
                        successCount++;
                    } catch (err: any) {
                        failureCount++;
                        const code = err?.code;
                        log.error(`FCM send error: ${code || err?.message}`);

                        if (
                            code === "messaging/invalid-registration-token" ||
                            code === "messaging/registration-token-not-registered"
                        ) {
                            removedTokens.push(token);
                        }
                    }
                }

                // Remove invalid tokens
                if (removedTokens.length > 0) {
                    await admin.firestore().collection("sellers").doc(sellerId).update({
                        fcmTokens: admin.firestore.FieldValue.arrayRemove(...removedTokens)
                    });
                    log.info(`Removed ${removedTokens.length} invalid token(s)`);
                }

                log.success(`Push notifications sent: ${successCount} success, ${failureCount} failed`);
            } else {
                log.warn(`No FCM tokens found for seller ${sellerId}`);
            }

            // Send email notification (optional - if seller has email)
            if (sellerEmail) {
                // Note: Email sending would require Nodemailer or similar
                // For now, just log that we would send email
                log.info(`Would send email to ${sellerEmail} about order ${orderNumber}`);

                // TODO: Implement email sending with Nodemailer
                // await sendOrderEmail(sellerEmail, orderNumber, orderTotal, customerName);
            }

            // Log notification history
            await admin.firestore().collection("notification_history").add({
                type: "order_created_trigger",
                sellerId,
                orderId,
                orderNumber,
                title,
                body,
                notificationType: "new_order",
                orderTotal: orderTotal || null,
                itemCount,
                customerName: customerName || null,
                fcmTokensCount: fcmTokens.length,
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            log.success(`Order notification complete for ${orderNumber}`);
        } catch (err: any) {
            log.error(`onOrderCreated error: ${err?.message || err}`);
        }
    });
