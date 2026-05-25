// ============================================================
// DOMAIN MAPPING SERVICE (SIMPLIFIED FOR VERCEL)
// Handles store publish events - DNS is handled by Cloudflare wildcard
// ============================================================

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Helper: Update provisioning status in Firestore
 */
async function updateProvisioningStatus(
    storeRef: admin.firestore.DocumentReference,
    stage: string,
    progress: number,
    message: string,
    error?: string
): Promise<void> {
    const updateData: Record<string, unknown> = {
        "provisioningStatus.stage": stage,
        "provisioningStatus.progress": progress,
        "provisioningStatus.message": message,
        "provisioningStatus.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
    };
    if (error) {
        updateData["provisioningStatus.error"] = error;
    }
    await storeRef.update(updateData);
    console.log(`📊 [${storeRef.id}] Stage: ${stage}, Progress: ${progress}%, Message: ${message}`);
}

/**
 * Helper: Check if domain is accessible via HTTPS
 */
async function checkDomainAccessible(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, {
            method: "HEAD",
            redirect: "follow"
        });
        return response.ok || response.status === 200;
    } catch {
        return false;
    }
}

/**
 * Helper: Sleep for ms
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🚀 AUTO-TRIGGER: Updates store status when published
 * With Vercel + Cloudflare wildcard DNS, stores go live instantly!
 */
export const onStorePublished = functions
    .runWith({ timeoutSeconds: 60 })
    .firestore
    .document("stores/{storeId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const storeId = context.params.storeId;
        const storeRef = change.after.ref;

        // Only proceed if:
        // 1. Status changed to 'published'
        // 2. Subdomain exists
        // 3. Domain mapping not already created
        const statusChangedToPublished = before.status !== "published" && after.status === "published";
        const hasSubdomain = after.subdomain && after.subdomain.trim() !== "";
        const domainNotMapped = after.domainStatus !== "mapped" && after.domainStatus !== "pending";

        if (!statusChangedToPublished || !hasSubdomain || !domainNotMapped) {
            return;
        }

        console.log(`\n${"=".repeat(60)}`);
        console.log(`🚀 [${storeId}] STORE PUBLISHED - Vercel + Cloudflare (instant)`);
        console.log(`📍 Subdomain: ${after.subdomain}`);
        console.log(`${"=".repeat(60)}\n`);

        const subdomain = after.subdomain;
        const domain = `${subdomain}.letbuyy.store`;

        try {
            // STAGE 1: Store marked as published
            await storeRef.update({
                domainStatus: "pending",
                "provisioningStatus.stage": "store_created",
                "provisioningStatus.progress": 20,
                "provisioningStatus.message": "Store published",
                "provisioningStatus.startedAt": admin.firestore.FieldValue.serverTimestamp(),
                "provisioningStatus.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ [${storeId}] Stage 1: Store published`);

            // STAGE 2: DNS Ready (Cloudflare wildcard)
            await updateProvisioningStatus(storeRef, "dns_ready", 50, "DNS configured (Cloudflare wildcard)");
            console.log(`⚡ [${storeId}] Stage 2: Cloudflare wildcard DNS ready`);

            // STAGE 3: Vercel Ready
            await updateProvisioningStatus(storeRef, "vercel_ready", 80, "Vercel proxy ready");
            console.log(`⚡ [${storeId}] Stage 3: Vercel deployment ready`);

            // Wait briefly for propagation
            await sleep(2000);

            // STAGE 4: Verify accessibility
            const isAccessible = await checkDomainAccessible(`https://${domain}`);

            if (isAccessible) {
                // LIVE! 🎉
                await storeRef.update({
                    domainStatus: "mapped",
                    liveUrl: `https://${domain}`,
                    domainMappedAt: admin.firestore.FieldValue.serverTimestamp(),
                    dnsRecordCreated: true,
                    "provisioningStatus.stage": "live",
                    "provisioningStatus.progress": 100,
                    "provisioningStatus.message": "🎉 Store is live!",
                    "provisioningStatus.completedAt": admin.firestore.FieldValue.serverTimestamp(),
                    "provisioningStatus.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`\n${"🎉".repeat(20)}`);
                console.log(`✅ [${storeId}] STORE IS LIVE at: https://${domain}`);
                console.log(`${"🎉".repeat(20)}\n`);
            } else {
                // Mark as pending verification (might just need DNS propagation)
                await storeRef.update({
                    domainStatus: "mapped",
                    liveUrl: `https://${domain}`,
                    "provisioningStatus.stage": "live",
                    "provisioningStatus.progress": 100,
                    "provisioningStatus.message": "Store is live (verification pending)",
                    "provisioningStatus.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`⏳ [${storeId}] Store marked live, accessibility check pending`);
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`\n${"❌".repeat(20)}`);
            console.error(`❌ [${storeId}] ERROR: ${errorMessage}`);
            console.error(`${"❌".repeat(20)}\n`);

            await storeRef.update({
                domainStatus: "error",
                domainError: errorMessage,
                domainErrorAt: admin.firestore.FieldValue.serverTimestamp(),
                "provisioningStatus.stage": "error",
                "provisioningStatus.progress": 0,
                "provisioningStatus.message": errorMessage,
                "provisioningStatus.error": errorMessage,
                "provisioningStatus.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    });

/**
 * Callable function to manually update store domain status
 * Used if automatic trigger doesn't fire
 */
export const markStoreAsLive = functions.https.onCall(
    async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
        }

        const { storeId, subdomain } = data;
        if (!storeId || !subdomain) {
            throw new functions.https.HttpsError("invalid-argument", "storeId and subdomain required");
        }

        const domain = `${subdomain}.letbuyy.store`;

        await db.collection("stores").doc(storeId).update({
            domainStatus: "mapped",
            liveUrl: `https://${domain}`,
            domainMappedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            domain: domain,
            message: `Store marked live at https://${domain}`,
        };
    }
);
