// functions/src/sellerAuth.ts
// 🔐 SELLER OTP AUTHENTICATION
// Matches Admin OTP Login Flow Exactly

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { createEmailTransporter, EMAIL_CONFIG } from "./config/email.config";

const cors = require("cors")({ origin: true });

const log = {
    info: (msg: string) => console.log(`ℹ️ [SellerAuth] ${msg}`),
    success: (msg: string) => console.log(`✅ [SellerAuth] ${msg}`),
    error: (msg: string) => console.error(`❌ [SellerAuth] ${msg}`),
};

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email type for different contexts
type EmailType = 'signup' | 'login';

function getSellerOTPEmailHTML(
    otp: string,
    options: {
        sellerName?: string;
        storeName?: string;
        emailType?: EmailType;
    } = {}
): string {
    const currentYear = new Date().getFullYear();
    const { sellerName, storeName, emailType = 'login' } = options;

    // Use seller name for signup, store name for login
    const displayName = emailType === 'signup'
        ? (sellerName || 'New Seller')
        : (storeName || sellerName || 'Seller');

    // Context text based on email type
    const contextText = emailType === 'signup'
        ? 'We received a request to complete your seller registration on LetBuyy. Please use the verification code below to verify your email address.'
        : 'We received a request to sign in to your LetBuyy Seller account. Please use the verification code below to complete your secure login.';

    const greetingText = emailType === 'signup'
        ? `Welcome, ${displayName}!`
        : `Hello, ${displayName}!`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    /* Reset & Typography */
    body, table, td, div, p, a { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { width: 100% !important; height: 100% !important; margin: 0; padding: 0; background-color: #F8FAFC; }
    
    /* Responsive Helpers */
    @media screen and (max-width: 600px) {
      .responsive-table { width: 100% !important; }
      .mobile-pad { padding: 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-block { display: block !important; width: 100% !important; }
      .header-text { padding-top: 10px !important; padding-left: 0 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC;">
  
  <!-- OUTER WRAPPER (Edge-to-Edge Background) -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC;">
    
    <!-- FULL WIDTH HEADER with GRADIENT -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%);">
        <table align="center" width="600" cellpadding="0" cellspacing="0" border="0" class="responsive-table" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="padding: 40px 20px;">
              <!-- Header Content: Logo Left, Text Right -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Logo -->
                  <td width="60" valign="middle" class="mobile-block mobile-center">
                    <img src="https://storage.googleapis.com/letbuy-y.firebasestorage.app/branding/seller_logo.png" alt="LB" width="56" height="56" style="display: block; width: 56px; height: 56px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1);">
                  </td>
                  <!-- Text -->
                  <td valign="middle" class="mobile-block mobile-center header-text" style="padding-left: 20px;">
                    <div style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin-bottom: 4px;">LetBuyy Seller Portal</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">Secure Business Platform</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- MAIN CONTENT SECTION (Overlapping Card Style optional, keeping clean flat for now) -->
    <tr>
      <td style="padding: 40px 20px;">
        <table align="center" width="600" cellpadding="0" cellspacing="0" border="0" class="responsive-table" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); overflow: hidden;">
          
          <!-- Content Padding -->
          <tr>
            <td class="mobile-pad" style="padding: 40px;">
              
              <!-- Greeting -->
              <h1 style="color: #0F172A; font-size: 24px; font-weight: 800; margin: 0 0 16px 0; letter-spacing: -0.5px;">
                👋 ${greetingText}
              </h1>
              
              <!-- Context -->
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                ${contextText}
              </p>
              
              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
                <tr>
                  <td style="padding: 32px; text-align: center;">
                    <p style="color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin: 0 0 12px 0;">Verification Code</p>
                    <div style="font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 42px; font-weight: 700; color: #0F172A; letter-spacing: 8px; margin-bottom: 16px;">
                      ${otp}
                    </div>
                    <div style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-size: 13px; font-weight: 600; padding: 6px 16px; border-radius: 20px;">
                      ⏱ Valid for 10 minutes
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 10px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="24" valign="top" style="padding-right: 12px; font-size: 18px;">🛡️</td>
                        <td style="color: #92400E; font-size: 14px; line-height: 1.5; font-weight: 500;">
                          <strong style="display: block; margin-bottom: 2px; color: #78350F;">Security Notice</strong>
                          Never share this code with anyone. LetBuyy support will never verify you via phone or SMS.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA / Portal Link -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 32px;">
                <tr>
                  <td align="center">
                    <a href="https://seller.letbuyy.com" style="display: inline-block; background: linear-gradient(135deg, #0F2027 0%, #203A43 100%); color: #FFFFFF; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                      Go to Seller Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Ignore Text -->
              <p style="text-align: center; color: #94A3B8; font-size: 13px; font-style: italic; margin: 24px 0 0 0;">
                If you didn't request this email, you can safely ignore it.
              </p>

            </td>
          </tr>
          
          <!-- Support Footer inside card (refined) -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px; text-align: center;">
              <p style="color: #64748B; font-size: 14px; margin: 0;">
                Need help? <a href="mailto:support@letbuyy.com" style="color: #0F172A; font-weight: 600; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- GLOBAL FOOTER -->
    <tr>
      <td style="padding: 0 20px 40px 20px; text-align: center;">
        <p style="color: #94A3B8; font-size: 12px; margin: 0 0 10px 0;">
          &copy; ${currentYear} LetBuyy Technologies Pvt Ltd.
        </p>
        <p style="margin: 0; font-size: 12px;">
          <a href="https://letbuyy.com/privacy" style="color: #64748B; text-decoration: none; margin: 0 8px;">Privacy Policy</a>
          <span style="color: #CBD5E1;">&bull;</span>
          <a href="https://letbuyy.com/terms" style="color: #64748B; text-decoration: none; margin: 0 8px;">Terms of Service</a>
        </p>
      </td>
    </tr>
    
  </table>
</body>
</html>
`;
}

/**
 * Send OTP to seller email for authentication
 */
export const sendSellerLoginOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email } = req.body;

            if (!email) {
                log.error("Email is required");
                res.status(400).json({ success: false, error: "Email is required" });
                return;
            }

            log.info(`Seller login OTP request for: ${email}`);

            // Check if seller exists
            const sellersRef = admin.firestore().collection("sellers");
            const sellerQuery = await sellersRef
                .where("email", "==", email.toLowerCase())
                .get();

            if (sellerQuery.empty) {
                log.error(`Seller not found: ${email}`);
                res.status(404).json({
                    success: false,
                    error: "Seller account not found. Please register first.",
                });
                return;
            }

            const sellerDoc = sellerQuery.docs[0];
            const sellerData = sellerDoc.data();

            // Check if seller is verified
            if (sellerData.verificationStatus === "suspended") {
                log.error(`Seller account suspended: ${email}`);
                res.status(403).json({
                    success: false,
                    error: "Your account has been suspended. Contact support.",
                });
                return;
            }

            // Generate OTP
            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

            // Store OTP in Firestore
            await admin
                .firestore()
                .collection("seller_otp")
                .doc(email.toLowerCase())
                .set({
                    otp,
                    email: email.toLowerCase(),
                    sellerId: sellerDoc.id,
                    storeName: sellerData.storeName || "",
                    expiresAt,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    verified: false,
                    attempts: 0,
                });

            // Send email
            const transporter = await createEmailTransporter();

            await transporter.sendMail({
                from: `"LetBuyy Seller" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                to: email,
                subject: "🔐 Seller Login Verification - LetBuyy",
                html: getSellerOTPEmailHTML(otp, { storeName: sellerData.storeName, emailType: 'login' }),
            });

            log.success(`OTP sent to seller: ${email}`);

            res.status(200).json({
                success: true,
                message: "OTP sent successfully",
                expiresIn: 600, // 10 minutes in seconds
                storeName: sellerData.storeName || "",
            });
        } catch (error: any) {
            log.error(`Error sending seller OTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Verify seller OTP and create custom token for login
 */
export const verifySellerOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                res
                    .status(400)
                    .json({ success: false, error: "Email and OTP are required" });
                return;
            }

            log.info(`Verifying seller OTP for: ${email}`);

            // Get stored OTP
            const otpDoc = await admin
                .firestore()
                .collection("seller_otp")
                .doc(email.toLowerCase())
                .get();

            if (!otpDoc.exists) {
                res.status(404).json({
                    success: false,
                    error: "OTP not found. Please request a new one.",
                });
                return;
            }

            const otpData = otpDoc.data()!;

            // Check expiration
            if (Date.now() > otpData.expiresAt) {
                await otpDoc.ref.delete();
                res.status(410).json({
                    success: false,
                    error: "OTP expired. Please request a new one.",
                });
                return;
            }

            // Check attempts
            if (otpData.attempts >= 5) {
                await otpDoc.ref.delete();
                res.status(429).json({
                    success: false,
                    error: "Too many attempts. Please request a new OTP.",
                });
                return;
            }

            // Verify OTP
            if (otpData.otp !== otp) {
                await otpDoc.ref.update({
                    attempts: admin.firestore.FieldValue.increment(1),
                });
                const remaining = 5 - (otpData.attempts + 1);
                res.status(401).json({
                    success: false,
                    error: `Invalid OTP. ${remaining} attempts remaining.`,
                });
                return;
            }

            // Get seller document (by original sellerId from OTP data)
            const originalSellerId = otpData.sellerId;
            const sellerDoc = await admin
                .firestore()
                .collection("sellers")
                .doc(originalSellerId)
                .get();

            if (!sellerDoc.exists) {
                res.status(404).json({ success: false, error: "Seller account not found" });
                return;
            }

            const sellerData = sellerDoc.data()!;

            // Get or create Firebase Auth user
            let uid = sellerData.uid;
            let needsMigration = false;

            if (!uid) {
                // Try to find by email
                try {
                    const userRecord = await admin.auth().getUserByEmail(email.toLowerCase());
                    uid = userRecord.uid;
                    needsMigration = true;
                } catch (authError: any) {
                    if (authError.code === "auth/user-not-found") {
                        // Create new Firebase Auth user
                        const newUser = await admin.auth().createUser({
                            email: email.toLowerCase(),
                            emailVerified: true,
                            displayName: sellerData.storeName || sellerData.name || "Seller",
                        });
                        uid = newUser.uid;
                        needsMigration = true;
                    } else {
                        throw authError;
                    }
                }
            }

            // 🔥 CRITICAL FIX: Migrate seller document to use Firebase UID as document ID
            let finalSellerId = originalSellerId;
            if (needsMigration && uid !== originalSellerId) {
                log.info(`Migrating seller doc from ${originalSellerId} to UID ${uid}`);

                // Check if a doc with UID already exists (edge case)
                const existingUidDoc = await admin.firestore().collection("sellers").doc(uid).get();

                if (!existingUidDoc.exists) {
                    // Copy seller data to new document with UID as ID
                    const migratedData = {
                        ...sellerData,
                        uid,
                        sellerId: uid, // Update sellerId to match UID
                        emailVerified: true,
                        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                        migratedFrom: originalSellerId,
                        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                    };

                    await admin.firestore().collection("sellers").doc(uid).set(migratedData);

                    // Delete old document
                    await sellerDoc.ref.delete();

                    log.success(`Migrated seller doc to UID: ${uid}`);
                } else {
                    // UID doc already exists, just update it
                    await admin.firestore().collection("sellers").doc(uid).update({
                        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                        emailVerified: true,
                    });
                }

                finalSellerId = uid;
            } else {
                // No migration needed, just update the existing doc
                await sellerDoc.ref.update({
                    uid,
                    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                    emailVerified: true,
                });
                finalSellerId = originalSellerId;
            }

            // Create custom token with correct sellerId
            const customToken = await admin.auth().createCustomToken(uid, {
                role: "seller",
                sellerId: finalSellerId,
            });

            // Mark OTP as verified and delete
            await otpDoc.ref.delete();

            // Log seller login
            await admin.firestore().collection("seller_login_logs").add({
                sellerId: finalSellerId,
                email: email.toLowerCase(),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                success: true,
            });

            log.success(`Seller verified successfully: ${email} (UID: ${uid})`);

            res.status(200).json({
                success: true,
                message: "OTP verified successfully",
                customToken,
                sellerId: finalSellerId,
                storeName: otpData.storeName,
            });
        } catch (error: any) {
            log.error(`Error verifying seller OTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Resend seller OTP
 */
export const resendSellerOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email } = req.body;

            if (!email) {
                res.status(400).json({ success: false, error: "Email is required" });
                return;
            }

            // Check last OTP time to prevent spam
            const existingOtp = await admin
                .firestore()
                .collection("seller_otp")
                .doc(email.toLowerCase())
                .get();

            if (existingOtp.exists) {
                const data = existingOtp.data()!;
                const timeSinceLastOtp =
                    Date.now() - (data.createdAt?.toMillis() || 0);

                if (timeSinceLastOtp < 60000) {
                    // 60 seconds cooldown
                    const waitTime = Math.ceil((60000 - timeSinceLastOtp) / 1000);
                    res.status(429).json({
                        success: false,
                        error: `Please wait ${waitTime} seconds before requesting a new OTP.`,
                    });
                    return;
                }
            }

            log.info(`Resending seller OTP to: ${email}`);

            // Check if seller exists
            const sellersRef = admin.firestore().collection("sellers");
            const sellerQuery = await sellersRef
                .where("email", "==", email.toLowerCase())
                .get();

            if (sellerQuery.empty) {
                res.status(404).json({ success: false, error: "Seller account not found" });
                return;
            }

            const sellerDoc = sellerQuery.docs[0];
            const sellerData = sellerDoc.data();

            // Generate new OTP
            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000;

            // Store OTP
            await admin
                .firestore()
                .collection("seller_otp")
                .doc(email.toLowerCase())
                .set({
                    otp,
                    email: email.toLowerCase(),
                    sellerId: sellerDoc.id,
                    storeName: sellerData.storeName || "",
                    expiresAt,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    verified: false,
                    attempts: 0,
                });

            // Send email
            const transporter = await createEmailTransporter();

            await transporter.sendMail({
                from: `"LetBuyy Seller" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                to: email,
                subject: "🔐 Seller Login Verification - LetBuyy",
                html: getSellerOTPEmailHTML(otp, { storeName: sellerData.storeName, emailType: 'login' }),
            });

            log.success(`OTP resent to seller: ${email}`);

            res.status(200).json({
                success: true,
                message: "OTP resent successfully",
                expiresIn: 600,
            });
        } catch (error: any) {
            log.error(`Error resending seller OTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Verify seller email and password for login
 * Returns Firebase custom token on success
 */
export const verifySellerPassword = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({
                    success: false,
                    error: "Email and password are required"
                });
                return;
            }

            // Find seller by email
            const sellersSnapshot = await admin
                .firestore()
                .collection("sellers")
                .where("email", "==", email.toLowerCase())
                .limit(1)
                .get();

            if (sellersSnapshot.empty) {
                log.error(`Seller not found: ${email}`);
                res.status(404).json({
                    success: false,
                    error: "Account not found. Please sign up first."
                });
                return;
            }

            const sellerDoc = sellersSnapshot.docs[0];
            const sellerData = sellerDoc.data();

            // Check if account is suspended
            if (sellerData.verificationStatus === "suspended") {
                res.status(403).json({
                    success: false,
                    error: "Your account has been suspended. Contact support.",
                });
                return;
            }

            // Check if password exists in database
            if (!sellerData.password) {
                res.status(400).json({
                    success: false,
                    error: "Password not set. Please use OTP login or reset password.",
                });
                return;
            }

            // Verify password using bcrypt
            const isPasswordValid = await bcrypt.compare(password, sellerData.password);

            if (!isPasswordValid) {
                log.error(`Invalid password for seller: ${email}`);
                res.status(401).json({
                    success: false,
                    error: "Invalid email or password"
                });
                return;
            }

            // Password is valid - get or create Firebase Auth user
            let uid = sellerData.uid;
            const originalSellerId = sellerDoc.id;

            if (!uid) {
                try {
                    const userRecord = await admin.auth().getUserByEmail(email.toLowerCase());
                    uid = userRecord.uid;
                } catch (authError: any) {
                    if (authError.code === "auth/user-not-found") {
                        const newUser = await admin.auth().createUser({
                            email: email.toLowerCase(),
                            emailVerified: sellerData.emailVerified || false,
                            displayName: sellerData.storeName || sellerData.name,
                        });
                        uid = newUser.uid;
                        log.info(`Created new Firebase Auth user for seller: ${uid}`);
                    } else {
                        throw authError;
                    }
                }
            }

            // Update seller document with UID if needed
            if (!sellerData.uid) {
                await sellerDoc.ref.update({
                    uid,
                    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                await sellerDoc.ref.update({
                    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            // Create custom token
            const customToken = await admin.auth().createCustomToken(uid, {
                sellerId: originalSellerId,
                role: "seller",
            });

            log.success(`Seller logged in with password: ${email} (UID: ${uid})`);

            res.status(200).json({
                success: true,
                message: "Login successful",
                customToken,
                sellerId: originalSellerId,
                storeName: sellerData.storeName || "",
            });
        } catch (error: any) {
            log.error(`Error verifying seller password: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ============================================================
// 🔐 SELLER PASSWORD RESET FUNCTIONS
// ============================================================

function generateResetToken(): string {
    return crypto.randomBytes(32).toString("hex");
}

function getSellerPasswordResetEmailHTML(
    storeName: string,
    resetLink: string,
    expiryMinutes: number
): string {
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    body, table, td, div, p, a { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { width: 100% !important; height: 100% !important; margin: 0; padding: 0; background-color: #F8FAFC; }
    @media screen and (max-width: 600px) {
      .responsive-table { width: 100% !important; }
      .mobile-pad { padding: 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-block { display: block !important; width: 100% !important; }
      .header-text { padding-top: 10px !important; padding-left: 0 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC;">
    
    <!-- HEADER with GRADIENT -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%);">
        <table align="center" width="600" cellpadding="0" cellspacing="0" border="0" class="responsive-table" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="padding: 40px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="60" valign="middle" class="mobile-block mobile-center">
                    <img src="https://storage.googleapis.com/letbuy-y.firebasestorage.app/branding/seller_logo.png" alt="LB" width="56" height="56" style="display: block; width: 56px; height: 56px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.1);">
                  </td>
                  <td valign="middle" class="mobile-block mobile-center header-text" style="padding-left: 20px;">
                    <div style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin-bottom: 4px;">LetBuyy Seller Portal</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 500;">Secure Password Reset</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- MAIN CONTENT -->
    <tr>
      <td style="padding: 40px 20px;">
        <table align="center" width="600" cellpadding="0" cellspacing="0" border="0" class="responsive-table" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); overflow: hidden;">
          
          <tr>
            <td class="mobile-pad" style="padding: 40px;">
              
              <!-- Greeting -->
              <h1 style="color: #0F172A; font-size: 24px; font-weight: 800; margin: 0 0 16px 0; letter-spacing: -0.5px;">
                🔐 Password Reset Request
              </h1>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 8px 0;">
                Hello, <strong>${storeName}</strong>!
              </p>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                We received a request to reset the password for your LetBuyy Seller account. Click the button below to create a new password.
              </p>
              
              <!-- Reset Button Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px;">
                <tr>
                  <td style="padding: 32px; text-align: center;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #0F2027 0%, #203A43 100%); color: #FFFFFF; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 48px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                      Reset My Password
                    </a>
                    <div style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-size: 13px; font-weight: 600; padding: 6px 16px; border-radius: 20px; margin-top: 20px;">
                      ⏱ Valid for ${expiryMinutes} minutes
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #F1F5F9; border-radius: 10px;">
                    <p style="color: #64748B; font-size: 13px; margin: 0 0 8px 0;">If the button doesn't work, copy and paste this link:</p>
                    <p style="color: #0F172A; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace; margin: 0; background-color: #FFFFFF; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0;">${resetLink}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                <tr>
                  <td style="padding: 16px; background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 10px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="24" valign="top" style="padding-right: 12px; font-size: 18px;">🛡️</td>
                        <td style="color: #92400E; font-size: 14px; line-height: 1.5; font-weight: 500;">
                          <strong style="display: block; margin-bottom: 2px; color: #78350F;">Security Notice</strong>
                          If you didn't request this password reset, please ignore this email. Your password will remain unchanged. Never share this link with anyone.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
          
          <!-- Support Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px; text-align: center;">
              <p style="color: #64748B; font-size: 14px; margin: 0;">
                Need help? <a href="mailto:support@letbuyy.com" style="color: #0F172A; font-weight: 600; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- GLOBAL FOOTER -->
    <tr>
      <td style="padding: 0 20px 40px 20px; text-align: center;">
        <p style="color: #94A3B8; font-size: 12px; margin: 0 0 10px 0;">
          &copy; ${currentYear} LetBuyy Technologies Pvt Ltd.
        </p>
        <p style="margin: 0; font-size: 12px;">
          <a href="https://letbuyy.com/privacy" style="color: #64748B; text-decoration: none; margin: 0 8px;">Privacy Policy</a>
          <span style="color: #CBD5E1;">&bull;</span>
          <a href="https://letbuyy.com/terms" style="color: #64748B; text-decoration: none; margin: 0 8px;">Terms of Service</a>
        </p>
      </td>
    </tr>
    
  </table>
</body>
</html>
`;
}

/**
 * Request password reset for seller - sends email with reset link
 */
export const requestSellerPasswordReset = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email } = req.body;

            if (!email) {
                res.status(400).json({ success: false, error: "Email is required" });
                return;
            }

            log.info(`Password reset requested for seller: ${email}`);

            // Find seller by email
            const sellersSnapshot = await admin
                .firestore()
                .collection("sellers")
                .where("email", "==", email.toLowerCase())
                .limit(1)
                .get();

            // For security, always return success even if not found
            if (sellersSnapshot.empty) {
                log.info(`Seller not found for password reset: ${email}`);
                res.status(200).json({
                    success: true,
                    message: "If an account exists, a reset link has been sent.",
                });
                return;
            }

            const sellerDoc = sellersSnapshot.docs[0];
            const sellerData = sellerDoc.data();
            const sellerId = sellerDoc.id;

            // Check if suspended
            if (sellerData.verificationStatus === "suspended") {
                res.status(403).json({
                    success: false,
                    error: "Your account has been suspended. Contact support.",
                });
                return;
            }

            // Generate secure token
            const resetToken = generateResetToken();
            const expiresAt = admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
            );

            // Store reset request
            await admin.firestore().collection("seller_password_resets").doc(sellerId).set({
                email: email.toLowerCase(),
                token: resetToken,
                sellerId,
                expiresAt,
                used: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Create reset link (universal link)
            const resetLink = `https://seller-letbuy-y.web.app/reset-password?token=${resetToken}&uid=${sellerId}`;

            // Send email
            const transporter = await createEmailTransporter();
            await transporter.sendMail({
                from: `"LetBuyy Seller Security" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                to: email,
                subject: "🔐 Reset Your LetBuyy Seller Password",
                html: getSellerPasswordResetEmailHTML(
                    sellerData.storeName || sellerData.name || "Seller",
                    resetLink,
                    30
                ),
            });

            log.success(`Password reset email sent to seller: ${email}`);

            res.status(200).json({
                success: true,
                message: "If an account exists, a reset link has been sent.",
            });
        } catch (error: any) {
            log.error(`Error requesting seller password reset: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Verify seller password reset token
 */
export const verifySellerResetToken = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { token, sellerId } = req.body;

            if (!token || !sellerId) {
                res.status(400).json({ success: false, error: "Token and sellerId are required" });
                return;
            }

            log.info(`Verifying reset token for seller: ${sellerId}`);

            const docRef = admin.firestore().collection("seller_password_resets").doc(sellerId);
            const doc = await docRef.get();

            if (!doc.exists) {
                res.status(404).json({ success: false, error: "Invalid or expired reset link" });
                return;
            }

            const resetData = doc.data();

            // Check if already used
            if (resetData?.used) {
                res.status(400).json({ success: false, error: "This reset link has already been used" });
                return;
            }

            // Check expiration
            const now = admin.firestore.Timestamp.now();
            if (resetData?.expiresAt < now) {
                res.status(400).json({ success: false, error: "This reset link has expired" });
                return;
            }

            // Verify token
            if (resetData?.token !== token) {
                res.status(401).json({ success: false, error: "Invalid reset link" });
                return;
            }

            log.success(`Reset token verified for seller: ${sellerId}`);

            res.status(200).json({
                success: true,
                message: "Reset token is valid",
                email: resetData?.email || "",
            });
        } catch (error: any) {
            log.error(`Error verifying seller reset token: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Reset seller password with bcrypt hashing
 */
export const resetSellerPassword = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { token, sellerId, newPassword } = req.body;

            if (!token || !sellerId || !newPassword) {
                res.status(400).json({ success: false, error: "Token, sellerId, and newPassword are required" });
                return;
            }

            // Validate password strength
            if (newPassword.length < 8) {
                res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
                return;
            }

            log.info(`Resetting password for seller: ${sellerId}`);

            const docRef = admin.firestore().collection("seller_password_resets").doc(sellerId);
            const doc = await docRef.get();

            if (!doc.exists) {
                res.status(404).json({ success: false, error: "Invalid or expired reset link" });
                return;
            }

            const resetData = doc.data();

            // Verify token and expiration
            if (resetData?.used) {
                res.status(400).json({ success: false, error: "This reset link has already been used" });
                return;
            }

            const now = admin.firestore.Timestamp.now();
            if (resetData?.expiresAt < now) {
                res.status(400).json({ success: false, error: "This reset link has expired" });
                return;
            }

            if (resetData?.token !== token) {
                res.status(401).json({ success: false, error: "Invalid reset link" });
                return;
            }

            // Hash the new password with bcrypt (same as signup)
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update seller password in Firestore
            await admin.firestore().collection("sellers").doc(sellerId).update({
                password: hashedPassword,
                passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Mark token as used
            await docRef.update({
                used: true,
                usedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            log.success(`Password reset successfully for seller: ${sellerId}`);

            res.status(200).json({
                success: true,
                message: "Password reset successfully. You can now login with your new password.",
            });
        } catch (error: any) {
            log.error(`Error resetting seller password: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Register new seller (minimal - just email, creates record for OTP login)
 */
export const registerSellerForOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email, name, phone, storeName, password, emailVerified } = req.body;

            if (!email || !name || !storeName) {
                res.status(400).json({
                    success: false,
                    error: "Email, name, and store name are required",
                });
                return;
            }

            // Validate password
            if (!password || password.length < 6) {
                res.status(400).json({
                    success: false,
                    error: "Password must be at least 6 characters",
                });
                return;
            }

            log.info(`Registering new seller: ${email}${emailVerified ? ' (email pre-verified)' : ''}`);

            // Hash the password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Check if seller already exists
            const sellersRef = admin.firestore().collection("sellers");
            const existingQuery = await sellersRef
                .where("email", "==", email.toLowerCase())
                .get();

            if (!existingQuery.empty) {
                res.status(409).json({
                    success: false,
                    error: "An account with this email already exists. Please login.",
                });
                return;
            }

            // Create seller record with hashed password
            // If emailVerified flag is true, mark email as verified (skip second OTP)
            const sellerRef = await sellersRef.add({
                email: email.toLowerCase(),
                name,
                phone: phone || "",
                storeName,
                password: hashedPassword, // Store hashed password
                businessLegalName: storeName,
                businessType: "individual",
                businessAddress: "",
                businessCity: "",
                businessState: "",
                businessPincode: "",
                businessContact: phone || "",
                panNumber: "",
                gstNumber: "",
                gstExempt: true,
                verificationStatus: "pending",
                emailVerified: emailVerified === true, // Mark verified if inline OTP was verified
                phoneVerified: false,
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Only send OTP email if email was NOT already verified inline
            if (emailVerified !== true) {
                // Generate and send OTP
                const otp = generateOTP();
                const expiresAt = Date.now() + 10 * 60 * 1000;

                await admin
                    .firestore()
                    .collection("seller_otp")
                    .doc(email.toLowerCase())
                    .set({
                        otp,
                        email: email.toLowerCase(),
                        sellerId: sellerRef.id,
                        storeName,
                        expiresAt,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        verified: false,
                        attempts: 0,
                    });

                // Send verification email
                const transporter = await createEmailTransporter();

                await transporter.sendMail({
                    from: `"LetBuyy Seller" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                    to: email,
                    subject: "🎉 Welcome to LetBuyy Seller - Verify Your Email",
                    html: getSellerOTPEmailHTML(otp, { sellerName: name, storeName, emailType: 'signup' }),
                });

                log.success(`Seller registered and OTP sent: ${email}`);

                res.status(201).json({
                    success: true,
                    message: "Registration successful. Please verify your email.",
                    sellerId: sellerRef.id,
                    expiresIn: 600,
                    requiresOTP: true,
                });
            } else {
                // Email was already verified inline - account is ready
                log.success(`Seller registered with pre-verified email: ${email}`);

                res.status(201).json({
                    success: true,
                    message: "Registration successful! Your account is ready.",
                    sellerId: sellerRef.id,
                    requiresOTP: false,
                });
            }
        } catch (error: any) {
            log.error(`Error registering seller: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// INLINE SIGNUP VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if email is available for new registration
 */
export const checkEmailAvailability = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email } = req.body;

            if (!email) {
                res.status(400).json({ success: false, error: "Email is required" });
                return;
            }

            log.info(`Checking email availability: ${email}`);

            const sellersRef = admin.firestore().collection("sellers");
            const existingQuery = await sellersRef
                .where("email", "==", email.toLowerCase())
                .get();

            const available = existingQuery.empty;

            res.status(200).json({
                success: true,
                available,
                message: available ? "Email is available" : "Email is already registered",
            });
        } catch (error: any) {
            log.error(`Error checking email: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Send OTP for new email verification during signup
 */
export const sendSignupEmailOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email, name } = req.body; // Extract name

            if (!email) {
                res.status(400).json({ success: false, error: "Email is required" });
                return;
            }

            log.info(`Sending signup OTP to: ${email} (Name: ${name || 'Not provided'})`);

            // Check if email is already registered
            const sellersRef = admin.firestore().collection("sellers");
            const existingQuery = await sellersRef
                .where("email", "==", email.toLowerCase())
                .get();

            if (!existingQuery.empty) {
                res.status(409).json({
                    success: false,
                    error: "This email is already registered. Please login instead.",
                });
                return;
            }

            // Check cooldown for spam prevention
            const existingOtp = await admin
                .firestore()
                .collection("signup_email_otp")
                .doc(email.toLowerCase())
                .get();

            if (existingOtp.exists) {
                const data = existingOtp.data()!;
                const timeSinceLastOtp = Date.now() - (data.createdAt?.toMillis() || 0);

                if (timeSinceLastOtp < 60000) {
                    const waitTime = Math.ceil((60000 - timeSinceLastOtp) / 1000);
                    res.status(429).json({
                        success: false,
                        error: `Please wait ${waitTime} seconds before requesting a new OTP.`,
                    });
                    return;
                }
            }

            // Generate OTP
            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000;

            // Store OTP
            await admin
                .firestore()
                .collection("signup_email_otp")
                .doc(email.toLowerCase())
                .set({
                    otp,
                    email: email.toLowerCase(),
                    expiresAt,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    verified: false,
                    attempts: 0,
                });

            // Send email
            const transporter = await createEmailTransporter();

            await transporter.sendMail({
                from: `"LetBuyy Seller" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
                to: email,
                subject: "🔐 Verify Your Email - LetBuyy Seller Registration",
                html: getSellerOTPEmailHTML(otp, {
                    emailType: 'signup',
                    sellerName: name, // Pass seller name to template
                }),
            });

            log.success(`Signup OTP sent to: ${email}`);

            res.status(200).json({
                success: true,
                message: "OTP sent successfully",
                expiresIn: 600,
            });
        } catch (error: any) {
            log.error(`Error sending signup OTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Verify email OTP during signup (does not create account yet)
 */
export const verifySignupEmailOTP = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                res.status(400).json({ success: false, error: "Email and OTP are required" });
                return;
            }

            log.info(`Verifying signup OTP for: ${email}`);

            // Get stored OTP
            const otpDoc = await admin
                .firestore()
                .collection("signup_email_otp")
                .doc(email.toLowerCase())
                .get();

            if (!otpDoc.exists) {
                res.status(404).json({
                    success: false,
                    error: "OTP not found. Please request a new one.",
                });
                return;
            }

            const otpData = otpDoc.data()!;

            // Check expiration
            if (Date.now() > otpData.expiresAt) {
                await otpDoc.ref.delete();
                res.status(410).json({
                    success: false,
                    error: "OTP expired. Please request a new one.",
                });
                return;
            }

            // Check attempts
            if (otpData.attempts >= 5) {
                await otpDoc.ref.delete();
                res.status(429).json({
                    success: false,
                    error: "Too many attempts. Please request a new OTP.",
                });
                return;
            }

            // Verify OTP
            if (otpData.otp !== otp) {
                await otpDoc.ref.update({
                    attempts: admin.firestore.FieldValue.increment(1),
                });
                const remaining = 5 - (otpData.attempts + 1);
                res.status(401).json({
                    success: false,
                    error: `Invalid OTP. ${remaining} attempts remaining.`,
                });
                return;
            }

            // Mark as verified
            await otpDoc.ref.update({ verified: true });

            log.success(`Signup email OTP verified: ${email}`);

            res.status(200).json({
                success: true,
                verified: true,
                message: "Email verified successfully!",
            });
        } catch (error: any) {
            log.error(`Error verifying signup OTP: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Check if phone number is available for new registration
 */
export const checkPhoneAvailability = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { phone } = req.body;

            if (!phone) {
                res.status(400).json({ success: false, error: "Phone number is required" });
                return;
            }

            log.info(`Checking phone availability: ${phone}`);

            // Normalize phone number (remove +91 prefix if present)
            const normalizedPhone = phone.replace(/^\+91/, "").replace(/\s/g, "");

            const sellersRef = admin.firestore().collection("sellers");

            // Check with and without +91 prefix
            const query1 = await sellersRef.where("phone", "==", normalizedPhone).get();
            const query2 = await sellersRef.where("phone", "==", `+91${normalizedPhone}`).get();

            const available = query1.empty && query2.empty;

            res.status(200).json({
                success: true,
                available,
                message: available ? "Phone number is available" : "Phone number is already registered",
            });
        } catch (error: any) {
            log.error(`Error checking phone: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

/**
 * Check if store name is available for new registration
 */
export const checkStoreNameAvailability = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        try {
            const { storeName } = req.body;

            if (!storeName) {
                res.status(400).json({ success: false, error: "Store name is required" });
                return;
            }

            log.info(`Checking store name availability: ${storeName}`);

            const sellersRef = admin.firestore().collection("sellers");

            // Case-insensitive check by converting to lowercase
            const normalizedName = storeName.trim().toLowerCase();

            // Firestore doesn't support case-insensitive queries directly,
            // so we store a normalized version or query all and filter
            const allSellers = await sellersRef.get();

            let available = true;
            for (const doc of allSellers.docs) {
                const data = doc.data();
                if (data.storeName?.toLowerCase() === normalizedName) {
                    available = false;
                    break;
                }
            }

            res.status(200).json({
                success: true,
                available,
                message: available ? "Store name is available" : "Store name is already taken",
            });
        } catch (error: any) {
            log.error(`Error checking store name: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});
