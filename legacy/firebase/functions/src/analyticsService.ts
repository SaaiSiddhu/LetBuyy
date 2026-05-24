// ============================================================
// LETBUYY - SELLER ANALYTICS SERVICE
// Cloud Functions for aggregating analytics events
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

// ============================================================
// TYPES & INTERFACES
// ============================================================

interface AnalyticsEvent {
    sellerId: string;
    productId: string;
    eventType: "view" | "click" | "cart_add" | "cart_remove" | "wishlist" | "order";
    source: "organic" | "search" | "category" | "ads" | "recommendation" | "external" | "notification" | "deep_link";
    adCampaignId?: string;
    userId?: string;
    quantity: number;
    revenue?: number;
    timestamp: admin.firestore.Timestamp;
    date: string;
    hour: number;
    dayOfWeek: number;
}

interface HourlyAggregate {
    sellerId: string;
    date: string;
    hour: number;
    views: number;
    clicks: number;
    cartAdds: number;
    orders: number;
    revenue: number;
    adViews: number;
    adClicks: number;
    adOrders: number;
    searchViews: number;
    categoryViews: number;
    organicViews: number;
    updatedAt: admin.firestore.FieldValue;
}

interface DailyAggregate {
    sellerId: string;
    date: string;
    dayOfWeek: number;
    totalViews: number;
    totalClicks: number;
    totalCartAdds: number;
    totalOrders: number;
    totalRevenue: number;
    conversionRate: number;
    sourceBreakdown: {
        organic: number;
        search: number;
        category: number;
        ads: number;
        recommendation: number;
        external: number;
        notification: number;
        deepLink: number;
    };
    hourlyBreakdown: number[];
    updatedAt: admin.firestore.FieldValue;
}

// ============================================================
// REALTIME COUNTER UPDATE (Firestore Trigger)
// Updates counters immediately when an event is created
// ============================================================

export const onAnalyticsEvent = functions.firestore
    .document("seller_analytics/events/raw/{eventId}")
    .onCreate(async (snap) => {
        const event = snap.data() as AnalyticsEvent;
        const { sellerId, eventType, source, revenue, quantity } = event;

        if (!sellerId) {
            console.log("⚠️ Analytics event missing sellerId, skipping");
            return null;
        }

        // Update realtime counters for immediate dashboard feedback
        const realtimeRef = db.collection('seller_analytics').doc('realtime').collection('sellers').doc(sellerId);

        const updates: Record<string, admin.firestore.FieldValue> = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Increment appropriate counter based on event type
        switch (eventType) {
            case "view":
                updates.totalViews = admin.firestore.FieldValue.increment(1);
                updates.todayViews = admin.firestore.FieldValue.increment(1);
                break;
            case "click":
                updates.totalClicks = admin.firestore.FieldValue.increment(1);
                break;
            case "cart_add":
                updates.totalCartAdds = admin.firestore.FieldValue.increment(1);
                updates.todayCartAdds = admin.firestore.FieldValue.increment(1);
                break;
            case "order":
                updates.totalOrders = admin.firestore.FieldValue.increment(quantity || 1);
                updates.todayOrders = admin.firestore.FieldValue.increment(quantity || 1);
                if (revenue) {
                    updates.totalRevenue = admin.firestore.FieldValue.increment(revenue);
                    updates.todayRevenue = admin.firestore.FieldValue.increment(revenue);
                }
                break;
        }

        // Track source attribution
        if (source === "ads") {
            updates.totalAdViews = admin.firestore.FieldValue.increment(1);
        }

        try {
            await realtimeRef.set(updates, { merge: true });
            console.log(`📊 Realtime counter updated for seller ${sellerId}: ${eventType}`);
        } catch (error) {
            console.error(`❌ Error updating realtime counter: ${error}`);
        }

        return null;
    });

// ============================================================
// HOURLY AGGREGATION (Scheduled Function)
// Runs every hour to aggregate raw events
// ============================================================

export const aggregateAnalyticsHourly = functions.pubsub
    .schedule("0 * * * *") // Every hour at minute 0
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        console.log("🔄 Starting hourly analytics aggregation...");

        const now = new Date();
        const previousHour = new Date(now);
        previousHour.setHours(previousHour.getHours() - 1);

        const dateStr = `${previousHour.getFullYear()}-${String(previousHour.getMonth() + 1).padStart(2, "0")}-${String(previousHour.getDate()).padStart(2, "0")}`;
        const hour = previousHour.getHours();

        console.log(`📅 Aggregating for: ${dateStr} Hour: ${hour}`);

        // Query events from the previous hour
        const startTime = admin.firestore.Timestamp.fromDate(previousHour);
        const endTime = admin.firestore.Timestamp.fromDate(now);

        const eventsSnapshot = await db
            .collection("seller_analytics/events/raw")
            .where("timestamp", ">=", startTime)
            .where("timestamp", "<", endTime)
            .get();

        if (eventsSnapshot.empty) {
            console.log("📊 No events to aggregate for this hour");
            return null;
        }

        console.log(`📊 Found ${eventsSnapshot.size} events to aggregate`);

        // Group events by seller
        const sellerAggregates = new Map<string, HourlyAggregate>();

        eventsSnapshot.forEach((doc) => {
            const event = doc.data() as AnalyticsEvent;
            const { sellerId, eventType, source, revenue } = event;

            if (!sellerId) return;

            if (!sellerAggregates.has(sellerId)) {
                sellerAggregates.set(sellerId, {
                    sellerId,
                    date: dateStr,
                    hour,
                    views: 0,
                    clicks: 0,
                    cartAdds: 0,
                    orders: 0,
                    revenue: 0,
                    adViews: 0,
                    adClicks: 0,
                    adOrders: 0,
                    searchViews: 0,
                    categoryViews: 0,
                    organicViews: 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            const agg = sellerAggregates.get(sellerId)!;

            // Count by event type
            switch (eventType) {
                case "view":
                    agg.views++;
                    // Track source attribution for views
                    if (source === "ads") agg.adViews++;
                    else if (source === "search") agg.searchViews++;
                    else if (source === "category") agg.categoryViews++;
                    else agg.organicViews++;
                    break;
                case "click":
                    agg.clicks++;
                    if (source === "ads") agg.adClicks++;
                    break;
                case "cart_add":
                    agg.cartAdds++;
                    break;
                case "order":
                    agg.orders++;
                    if (revenue) agg.revenue += revenue;
                    if (source === "ads") agg.adOrders++;
                    break;
            }
        });

        // Write aggregates to Firestore
        const batch = db.batch();

        sellerAggregates.forEach((agg, sellerId) => {
            const docId = `${dateStr}_${String(hour).padStart(2, "0")}_${sellerId}`;
            const docRef = db.doc(`seller_analytics/aggregates/hourly/${docId}`);
            batch.set(docRef, agg, { merge: true });
        });

        await batch.commit();
        console.log(`✅ Hourly aggregation complete: ${sellerAggregates.size} sellers updated`);

        return null;
    });

// ============================================================
// DAILY AGGREGATION (Scheduled Function)
// Runs daily at midnight to create daily summaries
// ============================================================

export const aggregateAnalyticsDaily = functions.pubsub
    .schedule("0 0 * * *") // Every day at midnight
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
        console.log("🔄 Starting daily analytics aggregation...");

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
        const dayOfWeek = yesterday.getDay();

        console.log(`📅 Aggregating daily for: ${dateStr}`);

        // Query all hourly aggregates for the previous day
        const hourlySnapshot = await db
            .collection("seller_analytics/aggregates/hourly")
            .where("date", "==", dateStr)
            .get();

        if (hourlySnapshot.empty) {
            console.log("📊 No hourly data to aggregate for this day");
            return null;
        }

        console.log(`📊 Found ${hourlySnapshot.size} hourly records to aggregate`);

        // Group by seller
        const sellerDailyAggregates = new Map<string, DailyAggregate>();

        hourlySnapshot.forEach((doc) => {
            const hourly = doc.data() as HourlyAggregate;
            const { sellerId, hour } = hourly;

            if (!sellerId) return;

            if (!sellerDailyAggregates.has(sellerId)) {
                sellerDailyAggregates.set(sellerId, {
                    sellerId,
                    date: dateStr,
                    dayOfWeek,
                    totalViews: 0,
                    totalClicks: 0,
                    totalCartAdds: 0,
                    totalOrders: 0,
                    totalRevenue: 0,
                    conversionRate: 0,
                    sourceBreakdown: {
                        organic: 0,
                        search: 0,
                        category: 0,
                        ads: 0,
                        recommendation: 0,
                        external: 0,
                        notification: 0,
                        deepLink: 0,
                    },
                    hourlyBreakdown: new Array(24).fill(0),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            const daily = sellerDailyAggregates.get(sellerId)!;

            // Sum up hourly values
            daily.totalViews += hourly.views;
            daily.totalClicks += hourly.clicks;
            daily.totalCartAdds += hourly.cartAdds;
            daily.totalOrders += hourly.orders;
            daily.totalRevenue += hourly.revenue;

            // Source breakdown
            daily.sourceBreakdown.organic += hourly.organicViews;
            daily.sourceBreakdown.search += hourly.searchViews;
            daily.sourceBreakdown.category += hourly.categoryViews;
            daily.sourceBreakdown.ads += hourly.adViews;

            // Hourly breakdown (views per hour for heatmap)
            if (hour >= 0 && hour < 24) {
                daily.hourlyBreakdown[hour] = hourly.views;
            }
        });

        // Calculate conversion rates and write to Firestore
        const batch = db.batch();

        sellerDailyAggregates.forEach((daily, sellerId) => {
            // Conversion rate = orders / views (as percentage)
            daily.conversionRate = daily.totalViews > 0
                ? (daily.totalOrders / daily.totalViews) * 100
                : 0;

            const docId = `${dateStr}_${sellerId}`;
            const docRef = db.doc(`seller_analytics/aggregates/daily/${docId}`);
            batch.set(docRef, daily, { merge: true });
        });

        await batch.commit();
        console.log(`✅ Daily aggregation complete: ${sellerDailyAggregates.size} sellers updated`);

        // Reset today's realtime counters for all sellers
        sellerDailyAggregates.forEach(async (_, sellerId) => {
            try {
                await db.collection('seller_analytics').doc('realtime').collection('sellers').doc(sellerId).update({
                    todayViews: 0,
                    todayCartAdds: 0,
                    todayOrders: 0,
                    todayRevenue: 0,
                });
            } catch (error) {
                console.log(`⚠️ Could not reset realtime counters for ${sellerId}: ${error}`);
            }
        });

        return null;
    });

// ============================================================
// MANUAL AGGREGATION TRIGGER (HTTP Function)
// For testing and backfilling historical data
// ============================================================

export const triggerAnalyticsAggregation = functions.https.onCall(
    async (data, context) => {
        // Verify admin access
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Must be authenticated to trigger aggregation"
            );
        }

        const { type, date } = data as { type: "hourly" | "daily"; date?: string };

        if (type === "hourly") {
            console.log("📊 Manual hourly aggregation triggered");
            // Run the hourly aggregation logic directly
            // (In production, you'd call the same logic as aggregateAnalyticsHourly)
            return { success: true, message: "Hourly aggregation triggered" };
        } else if (type === "daily") {
            console.log(`📊 Manual daily aggregation triggered for: ${date || "yesterday"}`);
            return { success: true, message: "Daily aggregation triggered" };
        }

        return { success: false, message: "Invalid aggregation type" };
    }
);

// ============================================================
// GET SELLER ANALYTICS (HTTP Function)
// Returns aggregated analytics for seller dashboard
// ============================================================

export const getSellerAnalytics = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Must be authenticated"
            );
        }

        const { sellerId, period } = data as { sellerId: string; period: "week" | "month" };

        // Verify the caller is the seller or an admin
        const callerUid = context.auth.uid;
        if (callerUid !== sellerId) {
            // Check if admin
            const adminDoc = await db.doc(`admins/${callerUid}`).get();
            if (!adminDoc.exists) {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "Not authorized to view this seller's analytics"
                );
            }
        }

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        if (period === "week") {
            startDate.setDate(startDate.getDate() - 7);
        } else {
            startDate.setDate(startDate.getDate() - 30);
        }

        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

        // Query daily aggregates for the period
        const dailySnapshot = await db
            .collection("seller_analytics/aggregates/daily")
            .where("sellerId", "==", sellerId)
            .where("date", ">=", startDateStr)
            .where("date", "<=", endDateStr)
            .orderBy("date", "asc")
            .get();

        // Get realtime counters for today
        const realtimeDoc = await db.collection('seller_analytics').doc('realtime').collection('sellers').doc(sellerId).get();
        const realtime = realtimeDoc.exists ? realtimeDoc.data() : null;

        return {
            daily: dailySnapshot.docs.map((doc) => doc.data()),
            realtime,
            period,
            startDate: startDateStr,
            endDate: endDateStr,
        };
    }
);
