/**
 * Store Deployment Functions
 * 
 * Handles deploying seller stores to Firebase Hosting
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { generateStoreHtml } from "./storeTemplates";

const db = admin.firestore();

/**
 * Deploy Store to Firebase Hosting
 * 
 * Called when seller publishes their store.
 * Generates static HTML and stores it for serving.
 */
export const deployStore = functions.https.onCall(
    async (data, context) => {
        // Verify caller is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "Must be logged in to deploy a store"
            );
        }

        const { storeId } = data;
        const sellerId = context.auth.uid;

        if (!storeId) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "storeId is required"
            );
        }

        try {
            // Get store document
            const storeDoc = await db.collection("stores").doc(storeId).get();
            if (!storeDoc.exists) {
                throw new functions.https.HttpsError(
                    "not-found",
                    "Store not found"
                );
            }

            const storeData = storeDoc.data()!;

            // Verify ownership
            if (storeData.sellerId !== sellerId) {
                throw new functions.https.HttpsError(
                    "permission-denied",
                    "You can only deploy your own stores"
                );
            }

            // Get seller's products
            const productsSnapshot = await db
                .collection("products")
                .where("sellerId", "==", sellerId)
                .where("isActive", "==", true)
                .orderBy("createdAt", "desc")
                .limit(100)
                .get();

            const products = productsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as {
                id: string;
                name: string;
                description: string;
                price: number;
                mrp?: number;
                images: string[];
                category?: string;
                sellerId: string;
            }[];

            // Filter to selected products if specified
            let selectedProducts = products;
            if (storeData.selectedProductIds && storeData.selectedProductIds.length > 0) {
                selectedProducts = products.filter((p) =>
                    storeData.selectedProductIds.includes(p.id)
                );
            }

            // Generate HTML
            const storeConfig = {
                id: storeId,
                name: storeData.name || "My Store",
                tagline: storeData.tagline || "",
                logoUrl: storeData.logoUrl,
                bannerUrl: storeData.bannerUrl,
                themeId: storeData.themeId || "modern",
                themeCustomization: storeData.themeCustomization,
                sellerId,
                subdomain: storeData.subdomain,
            };

            const html = generateStoreHtml(storeConfig, selectedProducts);

            // Store the generated HTML in Firestore for serving
            await db.collection("store_sites").doc(storeId).set({
                html,
                storeId,
                sellerId,
                subdomain: storeData.subdomain,
                name: storeData.name,
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                productCount: selectedProducts.length,
            });

            // Update store with published status
            const storeUrl = `https://${storeData.subdomain}.letbuyy.com`;
            await db.collection("stores").doc(storeId).update({
                status: "published",
                storeUrl,
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastDeployedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.info(`Store ${storeId} deployed successfully`, {
                storeUrl,
                productCount: selectedProducts.length,
            });

            return {
                success: true,
                storeUrl,
                subdomain: storeData.subdomain,
                productCount: selectedProducts.length,
            };
        } catch (error) {
            functions.logger.error("Error deploying store:", error);
            throw new functions.https.HttpsError(
                "internal",
                "Failed to deploy store"
            );
        }
    }
);

/**
 * Serve Store Site
 * 
 * HTTP endpoint to serve published stores
 * Supports both path-based (stores-letbuy-y.web.app/subdomain) and 
 * subdomain-based (subdomain-letbuy-y.web.app) routing
 */
export const serveStore = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Methods", "GET");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.status(204).send("");
        return;
    }

    const host = req.headers.host || "";
    let subdomain = "";

    // Method 1: Path-based routing (e.g., stores-letbuy-y.web.app/check)
    const pathParts = req.path.split("/").filter(Boolean);
    if (pathParts.length > 0 && pathParts[0] !== "index.html") {
        subdomain = pathParts[0].toLowerCase();
    }

    // Method 2: Subdomain-based routing (e.g., check-letbuy-y.web.app)
    if (!subdomain) {
        const subdomainMatch = host.match(/^([a-z0-9-]+)-letbuy-y\.web\.app$/i);
        if (subdomainMatch && subdomainMatch[1] !== "stores") {
            subdomain = subdomainMatch[1].toLowerCase();
        }
    }

    // Method 3: Query param fallback for testing
    if (!subdomain) {
        subdomain = (req.query.store as string || "").toLowerCase();
    }

    if (!subdomain) {
        // Return a nice landing page
        res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>LetBuyy Stores</title>
                <style>
                    body { font-family: Inter, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #6366F1, #8B5CF6); }
                    .container { text-align: center; color: white; }
                    h1 { font-size: 3rem; margin-bottom: 0.5rem; }
                    p { opacity: 0.8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🛍️ LetBuyy Stores</h1>
                    <p>Create your own online store at letbuyy.store</p>
                </div>
            </body>
            </html>
        `);
        return;
    }

    try {
        // Find store by subdomain
        const storesSnapshot = await db
            .collection("store_sites")
            .where("subdomain", "==", subdomain)
            .limit(1)
            .get();

        if (storesSnapshot.empty) {
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head><title>Store Not Found</title>
                <style>body{font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:white;text-align:center;}</style>
                </head>
                <body><div><h1>Store Not Found</h1><p>The store "${subdomain}" doesn't exist or is not published.</p></div></body>
                </html>
            `);
            return;
        }

        const siteData = storesSnapshot.docs[0].data();

        // Send HTML with caching headers
        res.set("Cache-Control", "public, max-age=300"); // 5 min cache
        res.set("Content-Type", "text/html; charset=utf-8");
        res.send(siteData.html);
    } catch (error) {
        functions.logger.error("Error serving store:", error);
        res.status(500).send("Error loading store");
    }
});

/**
 * Update Store Site
 * 
 * Regenerates the store HTML when products change
 */
export const updateStoreSite = functions.firestore
    .document("products/{productId}")
    .onWrite(async (change, context) => {
        const productId = context.params.productId;

        // Get the product data (new or old)
        const productData = change.after.exists
            ? change.after.data()
            : change.before.data();

        if (!productData) return;

        const sellerId = productData.sellerId;

        // Find published stores for this seller
        const storesSnapshot = await db
            .collection("stores")
            .where("sellerId", "==", sellerId)
            .where("status", "==", "published")
            .get();

        if (storesSnapshot.empty) return;

        functions.logger.info(`Product ${productId} changed, updating ${storesSnapshot.size} stores`);

        // Note: We don't auto-rebuild stores here to avoid excessive function calls
        // The seller can manually republish their store to update products
    });
