// ============================================================
// RAZORPAY PAYMENT SERVICE - CLOUD FUNCTIONS
// Handle order creation, payment verification, VPA validation
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

const db = admin.firestore();

// ============================================================
// CONFIGURATION
// Get from Firebase environment config or use defaults for testing
// To set config: firebase functions:config:set razorpay.key_id="rzp_xxx" razorpay.key_secret="xxx"
// ============================================================

const getRazorpayConfig = () => {
    const config = functions.config().razorpay || {};
    return {
        // No hardcoded fallback: this bridge is explicitly not wired into any live
        // path (see services/compatibility/firebase_bridge/README.md); a missing
        // config value must fail loud, never silently fall back to a literal key.
        keyId: config.key_id || "",
        keySecret: config.key_secret || "", // MUST be set in production
    };
};

// ============================================================
// HELPER: Make Razorpay API Call
// ============================================================

async function razorpayApiCall(
    endpoint: string,
    method: "GET" | "POST",
    body?: object
): Promise<any> {
    const config = getRazorpayConfig();
    const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
        method,
        headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { description?: string } };
        console.error(`Razorpay API error: ${response.status}`, errorData);
        throw new Error(errorData.error?.description || `Razorpay API error: ${response.status}`);
    }

    return response.json();
}

// ============================================================
// CALLABLE: CREATE RAZORPAY ORDER
// Creates an order on Razorpay servers for payment processing
// ============================================================

export const createRazorpayOrder = functions.https.onCall(
    async (data, context) => {
        // Authentication check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required to create order"
            );
        }

        const { amount, currency = "INR", receipt, notes } = data;

        // Validate amount
        if (!amount || typeof amount !== "number" || amount <= 0) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Valid amount is required"
            );
        }

        console.log(`💳 Creating Razorpay order: ₹${amount / 100} for ${context.auth.uid}`);

        try {
            // Create order via Razorpay API
            const order = await razorpayApiCall("/orders", "POST", {
                amount: Math.round(amount), // Amount in paise
                currency,
                receipt: receipt || `rcpt_${Date.now()}`,
                notes: {
                    ...notes,
                    user_id: context.auth.uid,
                    created_at: new Date().toISOString(),
                },
            });

            console.log(`✅ Razorpay order created: ${order.id}`);

            // Store order in Firestore for tracking
            await db.collection("razorpay_orders").doc(order.id).set({
                orderId: order.id,
                userId: context.auth.uid,
                amount: order.amount,
                amountPaid: order.amount_paid,
                amountDue: order.amount_due,
                currency: order.currency,
                receipt: order.receipt,
                status: order.status,
                notes: order.notes,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
                success: true,
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
                keyId: getRazorpayConfig().keyId,
            };
        } catch (error: any) {
            console.error(`❌ Create order error: ${error.message}`);
            throw new functions.https.HttpsError(
                "internal",
                error.message || "Failed to create order"
            );
        }
    }
);

// ============================================================
// CALLABLE: VERIFY PAYMENT SIGNATURE
// Verifies the payment signature after successful payment
// ============================================================

export const verifyPaymentSignature = functions.https.onCall(
    async (data, context) => {
        // Authentication check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Order ID, Payment ID, and Signature are required"
            );
        }

        console.log(`🔐 Verifying payment: ${razorpayPaymentId} for order ${razorpayOrderId}`);

        try {
            const config = getRazorpayConfig();

            // Generate expected signature
            const expectedSignature = crypto
                .createHmac("sha256", config.keySecret)
                .update(`${razorpayOrderId}|${razorpayPaymentId}`)
                .digest("hex");

            const isValid = expectedSignature === razorpaySignature;

            if (isValid) {
                console.log(`✅ Payment verified: ${razorpayPaymentId}`);

                // Update order status in Firestore
                await db.collection("razorpay_orders").doc(razorpayOrderId).update({
                    paymentId: razorpayPaymentId,
                    signature: razorpaySignature,
                    status: "paid",
                    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Fetch payment details from Razorpay
                const payment = await razorpayApiCall(`/payments/${razorpayPaymentId}`, "GET");

                return {
                    success: true,
                    verified: true,
                    paymentId: razorpayPaymentId,
                    orderId: razorpayOrderId,
                    method: payment.method,
                    amount: payment.amount,
                    email: payment.email,
                    contact: payment.contact,
                };
            } else {
                console.error(`❌ Signature mismatch for payment: ${razorpayPaymentId}`);

                // Log failed verification
                await db.collection("razorpay_orders").doc(razorpayOrderId).update({
                    paymentId: razorpayPaymentId,
                    status: "verification_failed",
                    failedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                return {
                    success: false,
                    verified: false,
                    error: "Signature verification failed",
                };
            }
        } catch (error: any) {
            console.error(`❌ Verification error: ${error.message}`);
            throw new functions.https.HttpsError(
                "internal",
                error.message || "Verification failed"
            );
        }
    }
);

// ============================================================
// CALLABLE: VALIDATE UPI VPA
// Validates a UPI ID (Virtual Payment Address) via Razorpay
// ============================================================

export const validateVPA = functions.https.onCall(
    async (data, context) => {
        // Authentication check
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        const { vpa } = data;

        if (!vpa || typeof vpa !== "string") {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Valid VPA (UPI ID) is required"
            );
        }

        // Basic VPA format validation
        const vpaRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
        if (!vpaRegex.test(vpa)) {
            return {
                success: false,
                valid: false,
                error: "Invalid UPI ID format",
            };
        }

        console.log(`🔍 Validating VPA: ${vpa}`);

        try {
            // Validate VPA via Razorpay API
            const result = await razorpayApiCall("/payments/validate/vpa", "POST", {
                vpa: vpa.toLowerCase(),
            });

            console.log(`✅ VPA validation result:`, result);

            return {
                success: true,
                valid: result.success === true,
                customerName: result.customer_name || null,
                vpa: result.vpa,
            };
        } catch (error: any) {
            console.error(`❌ VPA validation error: ${error.message}`);

            // Return invalid for VPA errors (not a server error)
            if (error.message?.includes("Invalid VPA")) {
                return {
                    success: true,
                    valid: false,
                    error: "Invalid UPI ID",
                };
            }

            throw new functions.https.HttpsError(
                "internal",
                error.message || "VPA validation failed"
            );
        }
    }
);

// ============================================================
// CALLABLE: SAVE CARD (TOKENIZED)
// Saves a card token for future payments (not actual card details)
// ============================================================

export const saveCardToken = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        const { cardToken, last4, network, cardType, cardholderName } = data;

        if (!cardToken || !last4 || !network) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Card token, last4, and network are required"
            );
        }

        console.log(`💾 Saving card token for user: ${context.auth.uid}`);

        try {
            // Hash the token for storage
            const hashedToken = crypto
                .createHash("sha256")
                .update(cardToken + context.auth.uid)
                .digest("hex");

            // Store in user's saved cards collection
            const cardRef = await db.collection("users")
                .doc(context.auth.uid)
                .collection("saved_cards")
                .add({
                    tokenHash: hashedToken,
                    last4,
                    network, // visa, mastercard, rupay, etc.
                    cardType, // credit, debit
                    cardholderName: cardholderName || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    isActive: true,
                });

            console.log(`✅ Card saved: ${cardRef.id}`);

            return {
                success: true,
                cardId: cardRef.id,
                last4,
                network,
            };
        } catch (error: any) {
            console.error(`❌ Save card error: ${error.message}`);
            throw new functions.https.HttpsError(
                "internal",
                error.message || "Failed to save card"
            );
        }
    }
);

// ============================================================
// CALLABLE: GET SAVED CARDS
// Returns user's saved cards (only non-sensitive data)
// ============================================================

export const getSavedCards = functions.https.onCall(
    async (_data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        console.log(`📋 Getting saved cards for user: ${context.auth.uid}`);

        try {
            const cardsSnapshot = await db.collection("users")
                .doc(context.auth.uid)
                .collection("saved_cards")
                .where("isActive", "==", true)
                .orderBy("createdAt", "desc")
                .get();

            const cards = cardsSnapshot.docs.map(doc => ({
                id: doc.id,
                last4: doc.data().last4,
                network: doc.data().network,
                cardType: doc.data().cardType,
                cardholderName: doc.data().cardholderName,
            }));

            return {
                success: true,
                cards,
            };
        } catch (error: any) {
            console.error(`❌ Get cards error: ${error.message}`);
            throw new functions.https.HttpsError(
                "internal",
                error.message || "Failed to get cards"
            );
        }
    }
);

// ============================================================
// CALLABLE: DELETE SAVED CARD
// Removes a saved card from user's collection
// ============================================================

export const deleteSavedCard = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Authentication required"
            );
        }

        const { cardId } = data;

        if (!cardId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Card ID is required"
            );
        }

        console.log(`🗑️ Deleting card ${cardId} for user: ${context.auth.uid}`);

        try {
            await db.collection("users")
                .doc(context.auth.uid)
                .collection("saved_cards")
                .doc(cardId)
                .update({
                    isActive: false,
                    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

            console.log(`✅ Card deleted: ${cardId}`);

            return { success: true };
        } catch (error: any) {
            console.error(`❌ Delete card error: ${error.message}`);
            throw new functions.https.HttpsError(
                "internal",
                error.message || "Failed to delete card"
            );
        }
    }
);
