/**
 * Admin TOTP (Time-based One-Time Password) 2FA Functions
 * 
 * Provides Two-Factor Authentication using Google Authenticator
 * for the Admin Portal login
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

// Enable CORS for all origins
const cors = require("cors")({ origin: true });

// TOTP library - using otplib
const { authenticator } = require("otplib");

const log = {
    info: (msg: string) => console.log(`ℹ️ [AdminTOTP] ${msg}`),
    success: (msg: string) => console.log(`✅ [AdminTOTP] ${msg}`),
    error: (msg: string) => console.error(`❌ [AdminTOTP] ${msg}`)
};

// Encryption key for storing TOTP secrets (from Firebase config)
const getEncryptionKey = (): string => {
    try {
        return functions.config().totp?.encryption_key || "letbuyy-admin-totp-key-32chars!!";
    } catch {
        return process.env.TOTP_ENCRYPTION_KEY || "letbuyy-admin-totp-key-32chars!!";
    }
};

/**
 * Encrypt TOTP secret for storage
 */
function encryptSecret(secret: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(secret, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt TOTP secret for verification
 */
function decryptSecret(encryptedData: string): string {
    const key = getEncryptionKey();
    const [ivHex, encrypted] = encryptedData.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

/**
 * Initialize TOTP setup for admin
 * Returns secret and QR code URI for Google Authenticator
 */
export const initAdminTOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { userId } = req.body;

            if (!userId) {
                res.status(400).json({ success: false, error: "User ID is required" });
                return;
            }

            log.info(`Initializing TOTP for admin: ${userId}`);

            // Verify user exists and is admin
            const userDoc = await admin.firestore().collection("users").doc(userId).get();

            if (!userDoc.exists) {
                res.status(404).json({ success: false, error: "User not found" });
                return;
            }

            const userData = userDoc.data()!;
            if (userData.role !== "admin") {
                res.status(403).json({ success: false, error: "Admin access only" });
                return;
            }

            // Check if 2FA is already enabled
            if (userData.twoFactorAuth?.enabled) {
                res.status(400).json({ success: false, error: "2FA is already enabled. Disable it first to set up again." });
                return;
            }

            // Generate new TOTP secret
            const secret = authenticator.generateSecret();

            // Create otpauth URI for QR code
            const email = userData.email || "admin@letbuyy.com";
            const otpauthUri = authenticator.keyuri(email, "LetBuyy Admin", secret);

            // Store pending secret (not enabled yet, waiting for verification)
            await admin.firestore().collection("users").doc(userId).update({
                "twoFactorAuth.pendingSecret": encryptSecret(secret),
                "twoFactorAuth.pendingAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            log.success(`TOTP initialized for admin: ${userId}`);

            res.status(200).json({
                success: true,
                secret: secret,  // Plain text for manual entry
                qrCodeUri: otpauthUri,  // For QR code generation
                message: "Scan the QR code with Google Authenticator, then verify with a code",
            });

        } catch (error: any) {
            log.error(`Error initializing TOTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Enable TOTP after verification
 * User must provide valid TOTP code to activate 2FA
 */
export const enableAdminTOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { userId, totpCode } = req.body;

            if (!userId || !totpCode) {
                res.status(400).json({ success: false, error: "User ID and TOTP code are required" });
                return;
            }

            log.info(`Enabling TOTP for admin: ${userId}`);

            // Get user document
            const userRef = admin.firestore().collection("users").doc(userId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                res.status(404).json({ success: false, error: "User not found" });
                return;
            }

            const userData = userDoc.data()!;

            // Check for pending secret
            if (!userData.twoFactorAuth?.pendingSecret) {
                res.status(400).json({ success: false, error: "No pending TOTP setup. Please initialize first." });
                return;
            }

            // Decrypt and verify the code
            const secret = decryptSecret(userData.twoFactorAuth.pendingSecret);
            const isValid = authenticator.verify({ token: totpCode, secret });

            if (!isValid) {
                res.status(401).json({ success: false, error: "Invalid TOTP code. Please try again." });
                return;
            }

            // Enable 2FA
            await userRef.update({
                "twoFactorAuth.enabled": true,
                "twoFactorAuth.totpSecret": userData.twoFactorAuth.pendingSecret,  // Already encrypted
                "twoFactorAuth.enabledAt": admin.firestore.FieldValue.serverTimestamp(),
                "twoFactorAuth.pendingSecret": admin.firestore.FieldValue.delete(),
                "twoFactorAuth.pendingAt": admin.firestore.FieldValue.delete(),
            });

            log.success(`TOTP enabled for admin: ${userId}`);

            res.status(200).json({
                success: true,
                message: "Two-Factor Authentication enabled successfully!",
            });

        } catch (error: any) {
            log.error(`Error enabling TOTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Disable TOTP 2FA
 * Requires valid TOTP code to disable
 */
export const disableAdminTOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { userId, totpCode } = req.body;

            if (!userId || !totpCode) {
                res.status(400).json({ success: false, error: "User ID and TOTP code are required" });
                return;
            }

            log.info(`Disabling TOTP for admin: ${userId}`);

            // Get user document
            const userRef = admin.firestore().collection("users").doc(userId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                res.status(404).json({ success: false, error: "User not found" });
                return;
            }

            const userData = userDoc.data()!;

            // Check if 2FA is enabled
            if (!userData.twoFactorAuth?.enabled || !userData.twoFactorAuth?.totpSecret) {
                res.status(400).json({ success: false, error: "2FA is not enabled" });
                return;
            }

            // Verify TOTP code
            const secret = decryptSecret(userData.twoFactorAuth.totpSecret);
            const isValid = authenticator.verify({ token: totpCode, secret });

            if (!isValid) {
                res.status(401).json({ success: false, error: "Invalid TOTP code" });
                return;
            }

            // Disable 2FA
            await userRef.update({
                "twoFactorAuth.enabled": false,
                "twoFactorAuth.totpSecret": admin.firestore.FieldValue.delete(),
                "twoFactorAuth.disabledAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            log.success(`TOTP disabled for admin: ${userId}`);

            res.status(200).json({
                success: true,
                message: "Two-Factor Authentication disabled successfully",
            });

        } catch (error: any) {
            log.error(`Error disabling TOTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Get admin 2FA status
 */
export const getAdmin2FAStatus = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { userId } = req.body;

            if (!userId) {
                res.status(400).json({ success: false, error: "User ID is required" });
                return;
            }

            // Get user document
            const userDoc = await admin.firestore().collection("users").doc(userId).get();

            if (!userDoc.exists) {
                res.status(404).json({ success: false, error: "User not found" });
                return;
            }

            const userData = userDoc.data()!;
            const twoFactorAuth = userData.twoFactorAuth || {};

            res.status(200).json({
                success: true,
                is2FAEnabled: twoFactorAuth.enabled === true,
                enabledAt: twoFactorAuth.enabledAt?.toDate?.() || null,
            });

        } catch (error: any) {
            log.error(`Error getting 2FA status: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Verify TOTP code (used during login)
 * This is called internally by verifyAdminOTP when 2FA is enabled
 */
export const verifyAdminTOTPCode = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { userId, totpCode } = req.body;

            if (!userId || !totpCode) {
                res.status(400).json({ success: false, error: "User ID and TOTP code are required" });
                return;
            }

            log.info(`Verifying TOTP for admin: ${userId}`);

            // Get user document
            const userDoc = await admin.firestore().collection("users").doc(userId).get();

            if (!userDoc.exists) {
                res.status(404).json({ success: false, error: "User not found" });
                return;
            }

            const userData = userDoc.data()!;

            // Check if 2FA is enabled
            if (!userData.twoFactorAuth?.enabled || !userData.twoFactorAuth?.totpSecret) {
                res.status(400).json({ success: false, error: "2FA is not enabled for this account" });
                return;
            }

            // Verify TOTP code
            const secret = decryptSecret(userData.twoFactorAuth.totpSecret);
            const isValid = authenticator.verify({ token: totpCode, secret });

            if (!isValid) {
                res.status(401).json({ success: false, error: "Invalid authenticator code" });
                return;
            }

            // Update last used
            await admin.firestore().collection("users").doc(userId).update({
                "twoFactorAuth.lastUsedAt": admin.firestore.FieldValue.serverTimestamp(),
            });

            log.success(`TOTP verified for admin: ${userId}`);

            res.status(200).json({
                success: true,
                message: "TOTP verified successfully",
            });

        } catch (error: any) {
            log.error(`Error verifying TOTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
