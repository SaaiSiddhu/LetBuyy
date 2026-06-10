// ============================================================
// SETTLEMENT SERVICE CLOUD FUNCTIONS
// Handles order settlements, invoicing, RTO charges, and payouts
// Uses FeeConfigModel from delivery_settings/fees
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ============================================================
// TYPES
// ============================================================

interface FeeConfig {
    platformFee: number;
    deliveryMarkupPercent: number;
    codFee: number;
    paymentGatewayPercent: number;
    rtoFeeRefusedPercent: number;
    rtoFeeReturnPercent: number;
    qualityPenalty: number;
    freeDeliveryEnabled: boolean;
    freeDeliveryThreshold: number;
    settlementHoldDays: number;
    codEnabled: boolean;
}

interface ItemCommission {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    categoryId: string;
    categoryCommission: number;
    tierModifier: number;
    finalPercent: number;
    commissionAmount: number;
}

interface OrderInvoice {
    id: string;
    orderId: string;
    orderNumber: string;
    sellerId: string;
    orderTotal: number;
    itemCommissions: ItemCommission[];
    totalCommission: number;
    platformFee: number;
    deliveryFee: number;
    codFee: number;
    paymentGatewayFee: number;
    rtoFee: number;
    qualityPenalty: number;
    rtoReason: string | null;
    netPayout: number;
    status: "pending" | "processing" | "paid" | "onHold";
    createdAt: admin.firestore.FieldValue;
    releaseDate: admin.firestore.Timestamp | null;
    paidAt: admin.firestore.Timestamp | null;
}

// ============================================================
// HELPER: Get Fee Configuration
// ============================================================

async function getFeeConfig(): Promise<FeeConfig> {
    const doc = await db.doc("delivery_settings/fees").get();

    if (!doc.exists) {
        // Return defaults if no config exists
        return {
            platformFee: 20,
            deliveryMarkupPercent: 0,
            codFee: 40,
            paymentGatewayPercent: 2,
            rtoFeeRefusedPercent: 200,
            rtoFeeReturnPercent: 100,
            qualityPenalty: 50,
            freeDeliveryEnabled: true,
            freeDeliveryThreshold: 499,
            settlementHoldDays: 7,
            codEnabled: true,
        };
    }

    return doc.data() as FeeConfig;
}

// ============================================================
// HELPER: Get Category Commission
// ============================================================

async function getCategoryCommission(categoryId: string): Promise<number> {
    try {
        const doc = await db.collection("categories").doc(categoryId).get();
        if (doc.exists) {
            return doc.data()?.commissionPercent ?? 10;
        }
        return 10; // Default 10%
    } catch {
        return 10;
    }
}

// ============================================================
// HELPER: Get Seller Tier Modifier
// ============================================================

async function getSellerTierModifier(sellerId: string): Promise<number> {
    try {
        const sellerDoc = await db.collection("sellers").doc(sellerId).get();
        if (sellerDoc.exists) {
            const tier = sellerDoc.data()?.tier || "newSeller";

            // Tier modifiers (negative = discount for seller)
            const modifiers: Record<string, number> = {
                newSeller: 0,
                standard: -1,
                verified: -2,
                premium: -3,
            };

            return modifiers[tier] ?? 0;
        }
        return 0;
    } catch {
        return 0;
    }
}

// ============================================================
// FUNCTION: Generate Invoice on Order Delivery
// Triggered via Firestore or called from Flutter
// ============================================================

export const generateSettlementInvoice = functions.https.onCall(
    async (data: { orderId: string }) => {
        const { orderId } = data;

        if (!orderId) {
            throw new functions.https.HttpsError("invalid-argument", "Order ID required");
        }

        console.log(`📄 Generating settlement invoice for order: ${orderId}`);

        try {
            // Check if invoice already exists
            const existingInvoice = await db.collection("order_invoices").doc(orderId).get();
            if (existingInvoice.exists) {
                console.log(`⚠️ Invoice already exists for order: ${orderId}`);
                return { success: true, invoice: existingInvoice.data() };
            }

            // Get order data
            const orderDoc = await db.collection("orders").doc(orderId).get();
            if (!orderDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Order not found");
            }

            const order = orderDoc.data()!;
            const sellerId = order.sellerId;
            const orderNumber = order.orderNumber || orderId.substring(0, 8).toUpperCase();

            // Get fee configuration
            const feeConfig = await getFeeConfig();

            // Get seller tier modifier
            const tierModifier = await getSellerTierModifier(sellerId);

            // Calculate item commissions
            const itemCommissions: ItemCommission[] = [];
            let totalCommission = 0;

            for (const item of order.items || []) {
                const categoryCommission = await getCategoryCommission(item.categoryId || order.categoryId);
                const finalPercent = Math.max(0, categoryCommission + tierModifier);
                const subtotal = (item.price || 0) * (item.quantity || 1);
                const commissionAmount = (subtotal * finalPercent) / 100;

                itemCommissions.push({
                    productId: item.productId || "",
                    productName: item.productName || item.name || "Unknown",
                    quantity: item.quantity || 1,
                    unitPrice: item.price || 0,
                    subtotal,
                    categoryId: item.categoryId || order.categoryId || "",
                    categoryCommission,
                    tierModifier,
                    finalPercent,
                    commissionAmount,
                });

                totalCommission += commissionAmount;
            }

            // Calculate fees
            const orderTotal = order.total || order.subtotal || 0;
            const deliveryFee = order.deliveryCharge || 0;
            const paymentMethod = order.paymentMethod?.toLowerCase() || "";
            const isCOD = paymentMethod === "cod" || paymentMethod === "cash on delivery";

            const codFee = isCOD ? feeConfig.codFee : 0;
            const paymentGatewayFee = !isCOD ? (orderTotal * feeConfig.paymentGatewayPercent) / 100 : 0;

            // Calculate total deductions
            const totalDeductions =
                totalCommission +
                feeConfig.platformFee +
                deliveryFee +
                codFee +
                paymentGatewayFee;

            // Calculate net payout
            const netPayout = orderTotal - totalDeductions;

            // Calculate release date (after settlement hold period)
            const releaseDate = admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + feeConfig.settlementHoldDays * 24 * 60 * 60 * 1000)
            );

            // Create invoice document
            const invoice: OrderInvoice = {
                id: orderId,
                orderId,
                orderNumber,
                sellerId,
                orderTotal,
                itemCommissions,
                totalCommission,
                platformFee: feeConfig.platformFee,
                deliveryFee,
                codFee,
                paymentGatewayFee,
                rtoFee: 0,
                qualityPenalty: 0,
                rtoReason: null,
                netPayout,
                status: "pending",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                releaseDate,
                paidAt: null,
            };

            // Save invoice
            await db.collection("order_invoices").doc(orderId).set(invoice);

            // Update order with invoice reference
            await orderDoc.ref.update({
                hasInvoice: true,
                invoiceGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`✅ Invoice generated for ${orderId}: Net payout ₹${netPayout.toFixed(2)}`);

            return {
                success: true,
                invoice: {
                    ...invoice,
                    totalDeductions,
                },
            };
        } catch (error: any) {
            console.error(`❌ Error generating invoice: ${error.message}`);
            throw new functions.https.HttpsError("internal", `Failed to generate invoice: ${error.message}`);
        }
    }
);

// ============================================================
// FUNCTION: Apply RTO Charges
// Called when a return is processed
// ============================================================

export const applyRTOCharges = functions.https.onCall(
    async (data: { orderId: string; reason: string; isDefective?: boolean }) => {
        const { orderId, reason, isDefective = false } = data;

        if (!orderId || !reason) {
            throw new functions.https.HttpsError("invalid-argument", "Order ID and reason required");
        }

        console.log(`📦 Applying RTO charges for order: ${orderId}, reason: ${reason}`);

        try {
            // Get invoice
            const invoiceDoc = await db.collection("order_invoices").doc(orderId).get();
            if (!invoiceDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Invoice not found");
            }

            const invoice = invoiceDoc.data() as OrderInvoice;

            // Get fee configuration
            const feeConfig = await getFeeConfig();

            // Determine RTO fee based on reason
            let rtoFee = 0;
            let qualityPenalty = 0;

            const reasonLower = reason.toLowerCase();

            if (reasonLower.includes("refused") || reasonLower.includes("reject")) {
                // Customer refused delivery - Seller pays 200% of shipping
                rtoFee = (invoice.deliveryFee * feeConfig.rtoFeeRefusedPercent) / 100;
            } else if (reasonLower.includes("defective") || reasonLower.includes("damaged") || isDefective) {
                // Defective product - Seller pays return shipping + quality penalty
                rtoFee = invoice.deliveryFee; // 100% of original shipping
                qualityPenalty = feeConfig.qualityPenalty;
            } else if (reasonLower.includes("return") || reasonLower.includes("exchange")) {
                // Normal customer return - Seller pays return shipping only
                rtoFee = (invoice.deliveryFee * feeConfig.rtoFeeReturnPercent) / 100;
            }

            // Calculate new net payout
            const newNetPayout = invoice.netPayout - rtoFee - qualityPenalty;

            // Update invoice
            await invoiceDoc.ref.update({
                rtoFee,
                qualityPenalty,
                rtoReason: reason,
                netPayout: newNetPayout,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`✅ RTO charges applied: RTO Fee ₹${rtoFee}, Penalty ₹${qualityPenalty}`);

            return {
                success: true,
                rtoFee,
                qualityPenalty,
                newNetPayout,
            };
        } catch (error: any) {
            console.error(`❌ Error applying RTO charges: ${error.message}`);
            throw new functions.https.HttpsError("internal", `Failed to apply RTO charges: ${error.message}`);
        }
    }
);

// ============================================================
// FUNCTION: Process Weekly Payouts (Scheduled)
// Runs every Monday at 6 AM IST
// ============================================================

export const processWeeklyPayouts = functions.pubsub
    .schedule("every monday 06:00")
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        console.log("💰 Starting weekly payout processing...");

        try {
            // Get all invoices ready for payout
            const now = admin.firestore.Timestamp.now();

            const readyInvoices = await db.collection("order_invoices")
                .where("status", "==", "pending")
                .where("releaseDate", "<=", now)
                .get();

            console.log(`📋 Found ${readyInvoices.size} invoices ready for payout`);

            if (readyInvoices.empty) {
                return { processed: 0 };
            }

            // Group by seller
            const sellerPayouts: Map<string, { invoices: string[]; totalAmount: number }> = new Map();

            readyInvoices.forEach((doc) => {
                const invoice = doc.data() as OrderInvoice;
                const current = sellerPayouts.get(invoice.sellerId) || { invoices: [], totalAmount: 0 };
                current.invoices.push(invoice.orderId);
                current.totalAmount += invoice.netPayout;
                sellerPayouts.set(invoice.sellerId, current);
            });

            // Process each seller's payout
            const batch = db.batch();
            let processedCount = 0;

            for (const [sellerId, payout] of sellerPayouts) {
                if (payout.totalAmount <= 0) continue;

                // Create payout record
                const payoutRef = db.collection("seller_payouts").doc();
                batch.set(payoutRef, {
                    sellerId,
                    invoiceIds: payout.invoices,
                    invoiceCount: payout.invoices.length,
                    amount: payout.totalAmount,
                    status: "pending", // Will be processed by payment gateway
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Update invoices to processing
                for (const invoiceId of payout.invoices) {
                    const invoiceRef = db.collection("order_invoices").doc(invoiceId);
                    batch.update(invoiceRef, {
                        status: "processing",
                        payoutId: payoutRef.id,
                    });
                }

                // Update seller pending payout
                const sellerRef = db.collection("sellers").doc(sellerId);
                batch.update(sellerRef, {
                    pendingPayout: admin.firestore.FieldValue.increment(payout.totalAmount),
                    lastPayoutScheduled: admin.firestore.FieldValue.serverTimestamp(),
                });

                processedCount++;
            }

            await batch.commit();

            console.log(`✅ Weekly payout processed: ${processedCount} sellers, ${readyInvoices.size} invoices`);

            return {
                processed: processedCount,
                invoices: readyInvoices.size,
            };
        } catch (error: any) {
            console.error(`❌ Weekly payout error: ${error.message}`);
            throw error;
        }
    });

// ============================================================
// FUNCTION: Get Seller Settlement Summary
// Returns payout summary for seller dashboard
// ============================================================

export const getSellerSettlementSummary = functions.https.onCall(
    async (data: { sellerId: string }, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required");
        }

        const { sellerId } = data;

        if (!sellerId) {
            throw new functions.https.HttpsError("invalid-argument", "Seller ID required");
        }

        try {
            // Get all invoices for seller
            const invoicesSnap = await db.collection("order_invoices")
                .where("sellerId", "==", sellerId)
                .orderBy("createdAt", "desc")
                .limit(100)
                .get();

            let pendingPayout = 0;
            let processingPayout = 0;
            let totalPaid = 0;
            let totalDeductions = 0;
            let rtoCharges = 0;
            const recentInvoices: any[] = [];

            invoicesSnap.forEach((doc) => {
                const inv = doc.data();

                // Calculate totals
                const deductions =
                    (inv.totalCommission || 0) +
                    (inv.platformFee || 0) +
                    (inv.deliveryFee || 0) +
                    (inv.codFee || 0) +
                    (inv.paymentGatewayFee || 0) +
                    (inv.rtoFee || 0) +
                    (inv.qualityPenalty || 0);

                totalDeductions += deductions;
                rtoCharges += (inv.rtoFee || 0) + (inv.qualityPenalty || 0);

                switch (inv.status) {
                    case "pending":
                        pendingPayout += inv.netPayout || 0;
                        break;
                    case "processing":
                        processingPayout += inv.netPayout || 0;
                        break;
                    case "paid":
                        totalPaid += inv.netPayout || 0;
                        break;
                }

                // Include in recent invoices (limit 10)
                if (recentInvoices.length < 10) {
                    recentInvoices.push({
                        orderId: inv.orderId,
                        orderNumber: inv.orderNumber,
                        orderTotal: inv.orderTotal,
                        netPayout: inv.netPayout,
                        status: inv.status,
                        createdAt: inv.createdAt,
                        releaseDate: inv.releaseDate,
                    });
                }
            });

            return {
                success: true,
                summary: {
                    pendingPayout,
                    processingPayout,
                    totalPaid,
                    totalDeductions,
                    rtoCharges,
                    invoiceCount: invoicesSnap.size,
                },
                recentInvoices,
            };
        } catch (error: any) {
            console.error(`❌ Error getting settlement summary: ${error.message}`);
            throw new functions.https.HttpsError("internal", "Failed to get settlement summary");
        }
    }
);

// ============================================================
// FUNCTION: Admin Update Invoice Status
// Allows admin to override or adjust invoices
// ============================================================

export const adminUpdateInvoiceStatus = functions.https.onCall(
    async (data: { invoiceId: string; status: string; adjustedPayout?: number; reason?: string }, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Authentication required");
        }

        // TODO: Verify admin role

        const { invoiceId, status, adjustedPayout, reason } = data;

        if (!invoiceId || !status) {
            throw new functions.https.HttpsError("invalid-argument", "Invoice ID and status required");
        }

        console.log(`👑 Admin updating invoice ${invoiceId} to ${status}`);

        try {
            const invoiceRef = db.collection("order_invoices").doc(invoiceId);
            const invoiceDoc = await invoiceRef.get();

            if (!invoiceDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Invoice not found");
            }

            const updates: Record<string, any> = {
                status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                adminUpdatedBy: context.auth.uid,
            };

            if (adjustedPayout !== undefined) {
                updates.netPayout = adjustedPayout;
                updates.adminAdjusted = true;
                updates.adjustmentReason = reason || "Admin adjustment";
            }

            if (status === "paid") {
                updates.paidAt = admin.firestore.FieldValue.serverTimestamp();
            }

            await invoiceRef.update(updates);

            console.log(`✅ Invoice ${invoiceId} updated to ${status}`);

            return { success: true };
        } catch (error: any) {
            console.error(`❌ Error updating invoice: ${error.message}`);
            throw new functions.https.HttpsError("internal", "Failed to update invoice");
        }
    }
);
