// ============================================================
//  LETBUYY - ENHANCED NOTIFICATION CLOUD FUNCTIONS
//  Node.js 20 / firebase-functions (callable) / multicast optimized
//  Any signed-in user may call these functions (no admin role required)
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// ❌ REMOVE THIS LINE - Already initialized in index.ts
// admin.initializeApp();

// ============================================================
//  APP CONSTANTS
// ============================================================
const APP_ICON = "https://letbuy-y.web.app/assets/icons/app_icon.png";
const DEFAULT_COLOR = "#0F5257"; // brand color
const NOTIFICATION_SOUND = "default";
const APP_DEEP_LINK_PREFIX = "https://letbuy-y.web.app";
// Note: We use individual send() calls instead of sendMulticast for reliability

// ============================================================
// LOGGING UTILITIES
// ============================================================
const log = {
  info: (msg: string) => console.log(`ℹ️ [Notifications] ${msg}`),
  success: (msg: string) => console.log(`✅ [Notifications] ${msg}`),
  warn: (msg: string) => console.warn(`⚠️ [Notifications] ${msg}`),
  error: (msg: string) => console.error(`❌ [Notifications] ${msg}`)
};

// ============================================================
// TYPES / INTERFACES
// ============================================================
interface NotificationData {
  title?: string;
  body?: string;
  imageUrl?: string;
  actionUrl?: string;
  type?: string;
  productId?: string;

  // user/order related
  userId?: string;
  sellerId?: string;      // ✅ ADDED: For seller notifications
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  orderTotal?: number;    // ✅ ADDED: Order total for seller notification
  itemCount?: number;     // ✅ ADDED: Item count for seller notification
  customerName?: string;  // ✅ ADDED: Customer name for seller notification
}

interface NotificationStats {
  totalNotifications: number;
  totalSuccessful: number;
  totalFailed: number;
  byType: Record<string, { count: number; successful: number; failed: number }>;
}

// ============================================================
// DEEP LINK PROCESSING
// ============================================================
function processDeepLink(actionUrl?: string): string | undefined {
  if (!actionUrl) return undefined;
  const trimmed = actionUrl.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `${APP_DEEP_LINK_PREFIX}${trimmed}`;
  }
  return `${APP_DEEP_LINK_PREFIX}/${trimmed}`;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================
function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch (_) {
    // allow relative paths like /orders/123 or 'product/123'
    return /^[/a-zA-Z0-9-_]+$/.test(str);
  }
}

function validateNotificationData(
  title?: string,
  body?: string,
  imageUrl?: string,
  actionUrl?: string
): string[] {
  const errors: string[] = [];
  if (!title || !title.trim()) errors.push("Title is required");
  if (!body || !body.trim()) errors.push("Body is required");

  if (title && title.length > 200) errors.push("Title must be <= 200 chars");
  if (body && body.length > 4000) errors.push("Body must be <= 4000 chars");

  if (imageUrl && !isValidUrl(imageUrl)) errors.push("Invalid image URL");
  if (actionUrl && !isValidUrl(actionUrl)) errors.push("Invalid action URL");

  return errors;
}

// ============================================================
// MULTICAST MESSAGE BUILDER
// ============================================================
function buildMulticastMessage(
  tokens: string[],
  title: string,
  body: string,
  imageUrl?: string,
  actionUrl?: string,
  type?: string,
  orderId?: string,
  orderNumber?: string,
  orderStatus?: string
): admin.messaging.MulticastMessage {
  const deepLink = processDeepLink(actionUrl) || APP_DEEP_LINK_PREFIX;

  const dataPayload: Record<string, string> = {
    click_action: "FLUTTER_NOTIFICATION_CLICK",
    type: type || "general",
    timestamp: Date.now().toString()
  };

  if (orderId) dataPayload.orderId = orderId;
  if (orderNumber) dataPayload.orderNumber = orderNumber;
  if (orderStatus) dataPayload.orderStatus = orderStatus;
  if (imageUrl) dataPayload.imageUrl = imageUrl;
  if (deepLink) dataPayload.actionUrl = deepLink;

  const multicast: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data: dataPayload,
    android: {
      priority: "high",
      notification: {
        channelId: "default_channel",
        icon: "ic_notification",
        color: DEFAULT_COLOR,
        sound: NOTIFICATION_SOUND,
        // imageUrl is allowed in Android notification object
        ...(imageUrl ? { imageUrl } : {})
      }
    },
    webpush: {
      notification: {
        icon: APP_ICON,
        badge: APP_ICON,
        vibrate: [200, 100, 200],
        ...(imageUrl ? { image: imageUrl } : {}),
        // `image` property cannot be conditionally set in TS easily; we'll set via cast
        ...(imageUrl ? ({ image: imageUrl } as any) : {})
      },
      fcmOptions: {
        link: deepLink
      }
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: {
        aps: {
          alert: { title, body },
          sound: NOTIFICATION_SOUND,
          badge: 1
        }
      }
    }
  };

  return multicast;
}

// ============================================================
// SEND IN CHUNKS (uses individual send() for reliability)
// Changed from sendMulticast due to /batch endpoint issues
// ============================================================
async function sendInBatchesAndCleanup(
  allTokens: string[],
  buildMsgFn: (tokens: string[]) => admin.messaging.MulticastMessage
): Promise<{ successCount: number; failureCount: number; removedTokens: string[] }> {
  let successCount = 0;
  let failureCount = 0;
  const removedTokens: string[] = [];

  // Build a sample message to extract notification and data
  const sampleMsg = buildMsgFn(allTokens.slice(0, 1));

  // Send to each token individually (more reliable than batch)
  for (const token of allTokens) {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: sampleMsg.notification,
        data: sampleMsg.data,
        android: sampleMsg.android,
        apns: sampleMsg.apns,
        webpush: sampleMsg.webpush,
      };

      await admin.messaging().send(message);
      successCount++;
    } catch (err: any) {
      failureCount++;
      const code = err?.code;
      log.error(`send() error for token ${token.substring(0, 20)}...: ${code || err?.message || err}`);

      // Check if token is invalid and should be removed
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-argument"
      ) {
        removedTokens.push(token);
      }
    }
  }

  // Remove invalid tokens from users collection
  if (removedTokens.length) {
    const uniqueRemoved = Array.from(new Set(removedTokens));
    for (const token of uniqueRemoved) {
      // Find the user(s) with this token
      const q = await admin.firestore().collection("users").where("fcmTokens", "array-contains", token).get();
      q.forEach(async (doc) => {
        try {
          await admin.firestore().collection("users").doc(doc.id).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
          });
        } catch (e: any) {
          log.warn(`Failed to remove token from user ${doc.id}: ${e?.message || e}`);
        }
      });
    }
  }

  return { successCount, failureCount, removedTokens };
}

// ============================================================
// 1️⃣ BROADCAST - Any signed-in user may call
// ============================================================
// ✅ CHANGED FROM: exports.sendBroadcastNotification
export const sendBroadcastNotification = functions.https.onCall(
  async (data: NotificationData, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
      }

      const title = (data.title || "").trim();
      const body = (data.body || "").trim();
      const imageUrl = data.imageUrl;
      const actionUrl = data.actionUrl;
      const type = data.type;
      const productId = data.productId;

      const errors = validateNotificationData(title, body, imageUrl, actionUrl);
      if (errors.length) {
        throw new functions.https.HttpsError("invalid-argument", errors.join("; "));
      }

      log.info(`Broadcast requested by ${context.auth.uid || "unknown"}`);
      log.info(`Title: ${title} | Action: ${actionUrl || "N/A"}`);

      const usersSnap = await admin.firestore().collection("users").get();
      if (usersSnap.empty) {
        return { success: true, successCount: 0, failureCount: 0, message: "No users found" };
      }

      // Aggregate all tokens
      const allTokens: string[] = [];
      usersSnap.forEach((doc) => {
        const tks = doc.data().fcmTokens || [];
        if (Array.isArray(tks) && tks.length) {
          tks.forEach((tk: string) => allTokens.push(tk));
        }
      });

      if (!allTokens.length) {
        return { success: true, successCount: 0, failureCount: 0, message: "No FCM tokens found" };
      }

      log.info(`Found ${allTokens.length} tokens across ${usersSnap.size} users`);

      // Send in batches using sendMulticast
      const result = await sendInBatchesAndCleanup(allTokens, (tokensChunk) =>
        buildMulticastMessage(tokensChunk, title, body, imageUrl, actionUrl, type)
      );

      // Save in notification_history
      await admin.firestore().collection("notification_history").add({
        type: "broadcast",
        title,
        body,
        imageUrl: imageUrl || null,
        actionUrl: processDeepLink(actionUrl) || null,
        notificationType: type || "general",
        productId: productId || null,
        totalUsers: usersSnap.size,
        totalTokens: allTokens.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
        removedTokens: result.removedTokens || [],
        sentBy: context.auth?.uid || null,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      log.success(`Broadcast complete — ${result.successCount} success, ${result.failureCount} fail`);
      return {
        success: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
        removedTokens: result.removedTokens,
        message: `Notification sent to ${result.successCount} device(s)`
      };
    } catch (err: any) {
      log.error(`Broadcast error: ${err?.message || err}`);
      throw new functions.https.HttpsError("internal", err?.message || String(err));
    }
  }
);

// ============================================================
// 2️⃣ SEND TO SINGLE USER - Any signed-in user may call
// ============================================================
// ✅ CHANGED FROM: exports.sendNotificationToUser
export const sendNotificationToUser = functions.https.onCall(
  async (data: NotificationData, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
      }

      const userId = data.userId;
      const title = (data.title || "").trim();
      const body = (data.body || "").trim();
      const imageUrl = data.imageUrl;
      const actionUrl = data.actionUrl;
      const type = data.type;
      const orderId = data.orderId;
      const orderNumber = data.orderNumber;
      const orderStatus = data.orderStatus;

      if (!userId) {
        throw new functions.https.HttpsError("invalid-argument", "userId is required");
      }

      const errors = validateNotificationData(title, body, imageUrl, actionUrl);
      if (errors.length) {
        throw new functions.https.HttpsError("invalid-argument", errors.join("; "));
      }

      log.info(`SendNotificationToUser requested by ${context.auth.uid} -> ${userId}`);

      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
      }

      const tokens = (userDoc.data()?.fcmTokens as string[]) || [];
      if (!tokens.length) {
        return { success: true, successCount: 0, failureCount: 0, message: "No tokens found for user" };
      }

      // Use sendMulticast (single chunk likely)
      const result = await sendInBatchesAndCleanup(tokens, (tokensChunk) =>
        buildMulticastMessage(tokensChunk, title, body, imageUrl, actionUrl, type, orderId, orderNumber, orderStatus)
      );

      // Log history
      await admin.firestore().collection("notification_history").add({
        type: "single",
        userId,
        title,
        body,
        imageUrl: imageUrl || null,
        actionUrl: processDeepLink(actionUrl) || null,
        notificationType: type || "general",
        orderId: orderId || null,
        orderNumber: orderNumber || null,
        orderStatus: orderStatus || null,
        successCount: result.successCount,
        failureCount: result.failureCount,
        removedTokens: result.removedTokens || [],
        sentBy: context.auth?.uid || null,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      log.success(`Notification to ${userId}: ${result.successCount} sent, ${result.failureCount} failed`);
      return {
        success: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
        removedTokens: result.removedTokens
      };
    } catch (err: any) {
      log.error(`sendNotificationToUser error: ${err?.message || err}`);
      throw new functions.https.HttpsError("internal", err?.message || String(err));
    }
  }
);

// ============================================================
// 3️⃣ ORDER UPDATE - Any signed-in user may call
// ============================================================
// ✅ CHANGED FROM: exports.sendOrderUpdateNotification
export const sendOrderUpdateNotification = functions.https.onCall(
  async (data: NotificationData, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
      }

      const orderId = data.orderId;
      const orderNumber = data.orderNumber;
      const orderStatus = data.orderStatus;

      if (!orderId || !orderNumber || !orderStatus) {
        throw new functions.https.HttpsError("invalid-argument", "orderId, orderNumber and orderStatus are required");
      }

      log.info(`Order update requested: ${orderNumber} (${orderId})`);

      const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();
      if (!orderDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Order not found");
      }

      const order = orderDoc.data() as any;
      const userId = order?.userId;
      if (!userId) {
        throw new functions.https.HttpsError("invalid-argument", "Order missing userId");
      }

      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
      }

      const tokens = (userDoc.data()?.fcmTokens as string[]) || [];
      if (!tokens.length) {
        return { success: true, successCount: 0, failureCount: 0, message: "No tokens for order user" };
      }

      const statusMessages: Record<string, string> = {
        pending: "Your order has been placed!",
        confirmed: "Your order is confirmed!",
        processing: "Your order is being prepared!",
        shipped: "Your order is shipped!",
        outForDelivery: "Your order is out for delivery!",
        delivered: "Your order has been delivered!",
        cancelled: "Your order has been cancelled.",
        returned: "Your order has been returned.",
        refunded: "Your refund has been processed."
      };

      const title = `Order ${orderNumber} Update`;
      const finalBody = (data.body && data.body.trim()) || statusMessages[orderStatus] || `Status: ${orderStatus}`;
      const deepLink = `/orders/${orderId}`;

      const result = await sendInBatchesAndCleanup(tokens, (tokensChunk) =>
        buildMulticastMessage(tokensChunk, title, finalBody, undefined, deepLink, "order_update", orderId, orderNumber, orderStatus)
      );

      await admin.firestore().collection("notification_history").add({
        type: "order_update",
        orderId,
        orderNumber,
        userId,
        title,
        body: finalBody,
        actionUrl: processDeepLink(deepLink) || null,
        orderStatus,
        notificationType: "order_update",
        successCount: result.successCount,
        failureCount: result.failureCount,
        removedTokens: result.removedTokens || [],
        sentBy: context.auth?.uid || null,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      log.success(`Order update sent: ${result.successCount} OK, ${result.failureCount} failed`);
      return { success: true, successCount: result.successCount, failureCount: result.failureCount, removedTokens: result.removedTokens };
    } catch (err: any) {
      log.error(`sendOrderUpdateNotification error: ${err?.message || err}`);
      throw new functions.https.HttpsError("internal", err?.message || String(err));
    }
  }
);

// ============================================================
// 4️⃣ SEND NEW ORDER NOTIFICATION TO SELLER - Push notification for new orders
// ============================================================
export const sendNewOrderNotificationToSeller = functions.https.onCall(
  async (data: NotificationData, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
      }

      const sellerId = data.sellerId;
      const orderId = data.orderId;
      const orderNumber = data.orderNumber;
      const orderTotal = data.orderTotal;
      const itemCount = data.itemCount;
      const customerName = data.customerName;

      if (!sellerId) {
        throw new functions.https.HttpsError("invalid-argument", "sellerId is required");
      }

      if (!orderId || !orderNumber) {
        throw new functions.https.HttpsError("invalid-argument", "orderId and orderNumber are required");
      }

      log.info(`Sending new order notification to seller: ${sellerId}, order: ${orderNumber}`);

      // Fetch seller's FCM tokens from 'sellers' collection
      const sellerDoc = await admin.firestore().collection("sellers").doc(sellerId).get();
      if (!sellerDoc.exists) {
        log.warn(`Seller not found: ${sellerId}`);
        return { success: true, successCount: 0, failureCount: 0, message: "Seller not found" };
      }

      const tokens = (sellerDoc.data()?.fcmTokens as string[]) || [];
      if (!tokens.length) {
        log.warn(`No FCM tokens found for seller: ${sellerId}`);
        return { success: true, successCount: 0, failureCount: 0, message: "No tokens found for seller" };
      }

      log.info(`Found ${tokens.length} FCM token(s) for seller ${sellerId}`);

      // Build notification content
      const title = "🛒 New Order Received!";
      let body = `Order #${orderNumber}`;
      if (orderTotal) {
        body += ` - ₹${orderTotal.toFixed(2)}`;
      }
      if (itemCount) {
        body += ` (${itemCount} item${itemCount > 1 ? 's' : ''})`;
      }
      if (customerName) {
        body += `\nCustomer: ${customerName}`;
      }

      const deepLink = `/seller/orders/${orderId}`;

      // Send push notification
      const result = await sendInBatchesAndCleanup(tokens, (tokensChunk) =>
        buildMulticastMessage(
          tokensChunk,
          title,
          body,
          undefined,
          deepLink,
          "new_order",
          orderId,
          orderNumber,
          "pending"
        )
      );

      // Handle invalid token cleanup for sellers collection
      if (result.removedTokens && result.removedTokens.length > 0) {
        for (const token of result.removedTokens) {
          try {
            await admin.firestore().collection("sellers").doc(sellerId).update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
            });
          } catch (e: any) {
            log.warn(`Failed to remove invalid token from seller ${sellerId}: ${e?.message || e}`);
          }
        }
      }

      // Log to notification history
      await admin.firestore().collection("notification_history").add({
        type: "seller_new_order",
        sellerId,
        orderId,
        orderNumber,
        title,
        body,
        actionUrl: processDeepLink(deepLink) || null,
        notificationType: "new_order",
        orderTotal: orderTotal || null,
        itemCount: itemCount || null,
        customerName: customerName || null,
        successCount: result.successCount,
        failureCount: result.failureCount,
        removedTokens: result.removedTokens || [],
        sentBy: context.auth?.uid || null,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      log.success(`Seller notification sent: ${result.successCount} OK, ${result.failureCount} failed`);
      return {
        success: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
        removedTokens: result.removedTokens
      };
    } catch (err: any) {
      log.error(`sendNewOrderNotificationToSeller error: ${err?.message || err}`);
      throw new functions.https.HttpsError("internal", err?.message || String(err));
    }
  }
);

// ============================================================
// 5️⃣ GET NOTIFICATION STATS - Any signed-in user may call
// ============================================================
export const getNotificationStats = functions.https.onCall(async (_data, context) => {  // ✅ FIXED: Added underscore prefix
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }

    const snapshot = await admin.firestore().collection("notification_history").get();
    const stats: NotificationStats = {
      totalNotifications: snapshot.size,
      totalSuccessful: 0,
      totalFailed: 0,
      byType: {}
    };

    snapshot.forEach((doc) => {
      const d = doc.data() as any;
      stats.totalSuccessful += d.successCount || 0;
      stats.totalFailed += d.failureCount || 0;
      const type = d.notificationType || d.type || "general";
      if (!stats.byType[type]) stats.byType[type] = { count: 0, successful: 0, failed: 0 };
      stats.byType[type].count++;
      stats.byType[type].successful += d.successCount || 0;
      stats.byType[type].failed += d.failureCount || 0;
    });

    log.success("Notification stats retrieved");
    return { success: true, stats };
  } catch (err: any) {
    log.error(`getNotificationStats error: ${err?.message || err}`);
    throw new functions.https.HttpsError("internal", err?.message || String(err));
  }
});


// ============================================================
// 5️⃣ SCHEDULED DAILY CLEANUP - background job (no auth)
// ============================================================
// ✅ CHANGED FROM: exports.cleanupInvalidTokens
export const cleanupInvalidTokens = functions.pubsub
  .schedule("every day 03:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    try {
      log.info("Starting scheduled token cleanup");

      const users = await admin.firestore().collection("users").get();
      let removed = 0;
      let updatedUsers = 0;

      for (const doc of users.docs) {
        const tokens = doc.data().fcmTokens || [];
        if (!tokens.length) continue;

        // For scheduled cleanup we try to send a tiny message to each token individually,
        // because we want to catch per-token registration-not-registered errors reliably.
        const valid: string[] = [];

        for (const token of tokens) {
          try {
            await admin.messaging().send({
              token,
              notification: { title: "Token Check", body: "Verifying token" },
              data: { verification: "true" }
            });
            valid.push(token);
          } catch (err: any) {
            if (
              err &&
              (err.code === "messaging/registration-token-not-registered" ||
                err.code === "messaging/invalid-registration-token")
            ) {
              removed++;
            } else {
              // keep token on unknown errors
              valid.push(token);
            }
          }
        }

        if (valid.length !== tokens.length) {
          updatedUsers++;
          await admin.firestore().collection("users").doc(doc.id).update({ fcmTokens: valid });
        }
      }

      log.success(`Cleanup complete — removed ${removed} tokens from ${updatedUsers} users`);
      return { success: true, removed, updatedUsers };
    } catch (err: any) {
      log.error(`cleanupInvalidTokens error: ${err?.message || err}`);
      return { success: false, error: err?.message || String(err) };
    }
  });

// ============================================================
// READY LOG
// ============================================================
log.success("✅ Notification functions loaded");
