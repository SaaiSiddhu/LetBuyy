/**
 * Store Builder Authentication Functions
 * 
 * Handles cross-app authentication between Store Builder app and Seller app
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Interface for store auth request
 */
interface StoreAuthRequest {
    id: string;
    sellerId: string;
    sellerEmail: string;
    deviceInfo: string;
    ipAddress?: string;
    location?: string;
    status: "pending" | "approved" | "rejected" | "expired";
    authToken?: string;
    requestedAt: admin.firestore.Timestamp;
    expiresAt: admin.firestore.Timestamp;
    respondedAt?: admin.firestore.Timestamp;
}

/**
 * Send Store Auth Request
 * 
 * Called from Store App when user clicks "Continue with Seller App"
 * Creates auth request document and sends push notification to seller
 */
export const sendStoreAuthRequest = functions.https.onCall(
    async (data, _context) => {
        const { email, deviceInfo } = data;

        if (!email) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Email is required"
            );
        }

        // Find seller by email
        const sellersSnapshot = await db
            .collection("sellers")
            .where("email", "==", email.toLowerCase().trim())
            .limit(1)
            .get();

        if (sellersSnapshot.empty) {
            throw new functions.https.HttpsError(
                "not-found",
                "No seller account found with this email"
            );
        }

        const sellerDoc = sellersSnapshot.docs[0];
        const sellerData = sellerDoc.data();
        const sellerId = sellerDoc.id;

        // Check verification status (KYC)
        if (sellerData.verificationStatus !== "verified") {
            throw new functions.https.HttpsError(
                "permission-denied",
                "Your KYC is not verified. Please complete KYC in Seller App."
            );
        }

        // Create auth request
        const now = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + 5 * 60 * 1000 // 5 minutes
        );

        const requestRef = db.collection("store_auth_requests").doc();
        const request: StoreAuthRequest = {
            id: requestRef.id,
            sellerId,
            sellerEmail: email.toLowerCase().trim(),
            deviceInfo: deviceInfo || "Unknown device",
            status: "pending",
            requestedAt: now,
            expiresAt,
        };

        await requestRef.set(request);

        // Send push notification to seller
        try {
            const fcmToken = sellerData.fcmToken;
            if (fcmToken) {
                await admin.messaging().send({
                    token: fcmToken,
                    notification: {
                        title: "🏬 Store Builder Login Request",
                        body: `Someone is trying to log in from ${deviceInfo || "a device"}`,
                    },
                    data: {
                        type: "store_auth_request",
                        requestId: requestRef.id,
                        deviceInfo: deviceInfo || "Unknown device",
                    },
                    android: {
                        priority: "high",
                        notification: {
                            channelId: "store_auth",
                            priority: "high",
                            defaultSound: true,
                        },
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: "default",
                                badge: 1,
                            },
                        },
                    },
                });

                functions.logger.info(`Push notification sent to seller ${sellerId}`);
            }
        } catch (error) {
            functions.logger.warn("Failed to send push notification:", error);
            // Continue even if notification fails
        }

        return {
            success: true,
            requestId: requestRef.id,
            expiresAt: expiresAt.toMillis(),
        };
    }
);

/**
 * Send Store Auth Notification
 * 
 * Sends push notification to seller for store auth request
 */
export const sendStoreAuthNotification = functions.https.onCall(
    async (data, _context) => {
        const { requestId, sellerId, deviceInfo } = data;

        if (!requestId || !sellerId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "requestId and sellerId are required"
            );
        }

        // Get seller FCM token
        const sellerDoc = await db.collection("sellers").doc(sellerId).get();
        if (!sellerDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "Seller not found"
            );
        }

        const sellerData = sellerDoc.data();
        const fcmToken = sellerData?.fcmToken;

        if (!fcmToken) {
            functions.logger.warn(`No FCM token for seller ${sellerId}`);
            return { success: true, notificationSent: false };
        }

        try {
            await admin.messaging().send({
                token: fcmToken,
                notification: {
                    title: "🏬 Store Builder Login Request",
                    body: `Login request from ${deviceInfo || "a device"}. Open app to approve.`,
                },
                data: {
                    type: "store_auth_request",
                    requestId,
                    deviceInfo: deviceInfo || "Unknown",
                    click_action: "FLUTTER_NOTIFICATION_CLICK",
                },
                android: {
                    priority: "high",
                    notification: {
                        channelId: "store_auth",
                    },
                },
            });

            return { success: true, notificationSent: true };
        } catch (error) {
            functions.logger.error("Error sending notification:", error);
            return { success: true, notificationSent: false };
        }
    }
);

/**
 * Approve Store Auth Request
 * 
 * Called from Seller App when seller approves the request
 * Generates custom auth token and updates request status
 */
export const approveStoreAuth = functions.https.onCall(
    async (data, context) => {
        // Verify caller is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Must be logged in to approve requests"
            );
        }

        const { requestId } = data;

        if (!requestId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "requestId is required"
            );
        }

        // Get the request
        const requestRef = db.collection("store_auth_requests").doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "Auth request not found"
            );
        }

        const request = requestDoc.data() as StoreAuthRequest;

        // Verify the caller owns this request
        if (request.sellerId !== context.auth.uid) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "You can only approve your own requests"
            );
        }

        // Check if request is still pending
        if (request.status !== "pending") {
            throw new functions.https.HttpsError(
                "failed-precondition",
                `Request is already ${request.status}`
            );
        }

        // Check if request is expired
        if (request.expiresAt.toMillis() < Date.now()) {
            await requestRef.update({ status: "expired" });
            throw new functions.https.HttpsError(
                "deadline-exceeded",
                "Request has expired"
            );
        }

        // Generate custom auth token for the seller
        const customToken = await admin.auth().createCustomToken(context.auth.uid, {
            storeBuilder: true,
            sellerId: context.auth.uid,
        });

        // Update request with approval
        await requestRef.update({
            status: "approved",
            authToken: customToken,
            respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(`Store auth approved for seller ${context.auth.uid}`);

        return {
            success: true,
            message: "Request approved",
        };
    }
);

/**
 * Reject Store Auth Request
 * 
 * Called from Seller App when seller denies the request
 */
export const rejectStoreAuth = functions.https.onCall(
    async (data, context) => {
        // Verify caller is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Must be logged in to reject requests"
            );
        }

        const { requestId } = data;

        if (!requestId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "requestId is required"
            );
        }

        // Get the request
        const requestRef = db.collection("store_auth_requests").doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            throw new functions.https.HttpsError(
                "not-found",
                "Auth request not found"
            );
        }

        const request = requestDoc.data() as StoreAuthRequest;

        // Verify the caller owns this request
        if (request.sellerId !== context.auth.uid) {
            throw new functions.https.HttpsError(
                "permission-denied",
                "You can only reject your own requests"
            );
        }

        // Update request with rejection
        await requestRef.update({
            status: "rejected",
            respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(`Store auth rejected for seller ${context.auth.uid}`);

        return {
            success: true,
            message: "Request rejected",
        };
    }
);

/**
 * Check Subdomain Availability
 * 
 * Real-time check if a store subdomain is available
 */
export const checkSubdomainAvailability = functions.https.onCall(
    async (data, _context) => {
        const { subdomain } = data;

        if (!subdomain || subdomain.length < 3) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Subdomain must be at least 3 characters"
            );
        }

        const normalized = subdomain.toLowerCase().trim();

        // Reserved subdomains
        const reserved = [
            "admin", "seller", "store", "api", "www", "app",
            "letbuyy", "letbuy", "support", "help", "contact",
            "shop", "marketplace", "dashboard", "settings",
        ];

        if (reserved.includes(normalized)) {
            return {
                available: false,
                reason: "This subdomain is reserved",
                suggestions: getSuggestions(normalized),
            };
        }

        // Check if subdomain exists
        const storesSnapshot = await db
            .collection("stores")
            .where("subdomain", "==", normalized)
            .limit(1)
            .get();

        if (!storesSnapshot.empty) {
            return {
                available: false,
                reason: "This subdomain is already taken",
                suggestions: await getSuggestions(normalized),
            };
        }

        return {
            available: true,
            subdomain: normalized,
            url: `https://${normalized}-letbuy-y.web.app`,
        };
    }
);

/**
 * Get subdomain suggestions
 */
async function getSuggestions(baseSubdomain: string): Promise<string[]> {
    const suggestions: string[] = [];

    for (let i = 1; i <= 5; i++) {
        const suggestion = `${baseSubdomain}${i}`;
        const exists = await db
            .collection("stores")
            .where("subdomain", "==", suggestion)
            .limit(1)
            .get();

        if (exists.empty) {
            suggestions.push(suggestion);
            if (suggestions.length >= 3) break;
        }
    }

    return suggestions;
}

/**
 * Cleanup Expired Auth Requests
 * 
 * Scheduled function to clean up expired auth requests
 * Runs every hour
 */
export const cleanupExpiredAuthRequests = functions.pubsub
    .schedule("every 1 hours")
    .onRun(async () => {
        const now = admin.firestore.Timestamp.now();

        const expiredRequests = await db
            .collection("store_auth_requests")
            .where("status", "==", "pending")
            .where("expiresAt", "<", now)
            .get();

        const batch = db.batch();
        expiredRequests.docs.forEach((doc) => {
            batch.update(doc.ref, { status: "expired" });
        });

        await batch.commit();

        functions.logger.info(
            `Cleaned up ${expiredRequests.docs.length} expired auth requests`
        );

        return null;
    });
