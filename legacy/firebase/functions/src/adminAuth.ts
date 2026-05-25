import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { createEmailTransporter, EMAIL_CONFIG } from "./config/email.config";

// Enable CORS for all origins
const cors = require("cors")({ origin: true });

// Firebase API key for password verification. Legacy functions must read this from runtime config.
const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY || functions.config().firebase?.web_api_key || "";

// Helper function to verify password via Firebase Auth REST API
async function verifyPasswordWithFirebaseAuth(email: string, password: string): Promise<boolean> {
  try {
    if (!FIREBASE_API_KEY) return false;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

const log = {
  info: (msg: string) => console.log(`ℹ️ [AdminAuth] ${msg}`),
  success: (msg: string) => console.log(`✅ [AdminAuth] ${msg}`),
  error: (msg: string) => console.error(`❌ [AdminAuth] ${msg}`)
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================
// 🔒 LOGIN LOCKOUT HELPER FUNCTIONS
// ============================================================

const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface LockoutStatus {
  locked: boolean;
  remainingMs?: number;
  lockedUntil?: Date;
  reason?: string;
}

/**
 * Check if user is locked out
 */
async function isUserLockedOut(email: string): Promise<LockoutStatus> {
  try {
    const lockoutDoc = await admin.firestore()
      .collection("admin_login_lockouts")
      .doc(email.toLowerCase())
      .get();

    if (!lockoutDoc.exists) {
      return { locked: false };
    }

    const data = lockoutDoc.data()!;
    const lockedUntil = data.lockedUntil?.toDate();

    if (!lockedUntil || Date.now() > lockedUntil.getTime()) {
      // Lockout expired, delete it
      await lockoutDoc.ref.delete();
      return { locked: false };
    }

    const remainingMs = lockedUntil.getTime() - Date.now();
    return {
      locked: true,
      remainingMs,
      lockedUntil,
      reason: data.reason
    };
  } catch (error) {
    log.error(`Error checking lockout: ${error}`);
    return { locked: false };
  }
}

/**
 * Set lockout for user (30 minutes)
 */
async function setUserLockout(email: string, reason: "password" | "otp" | "2fa"): Promise<Date> {
  const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

  await admin.firestore()
    .collection("admin_login_lockouts")
    .doc(email.toLowerCase())
    .set({
      email: email.toLowerCase(),
      lockedUntil: admin.firestore.Timestamp.fromDate(lockedUntil),
      reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

  log.info(`Lockout set for ${email} until ${lockedUntil.toISOString()} (reason: ${reason})`);
  return lockedUntil;
}

/**
 * Clear lockout for user (called on password reset)
 */
async function clearUserLockout(email: string): Promise<void> {
  try {
    await admin.firestore()
      .collection("admin_login_lockouts")
      .doc(email.toLowerCase())
      .delete();

    // Also clear any attempt tracking
    await admin.firestore()
      .collection("admin_login_attempts")
      .doc(email.toLowerCase())
      .delete();

    log.info(`Lockout and attempts cleared for ${email}`);
  } catch (error) {
    log.error(`Error clearing lockout: ${error}`);
  }
}

/**
 * Get/increment login attempts
 */
async function getLoginAttempts(email: string): Promise<{ password: number; otp: number }> {
  const doc = await admin.firestore()
    .collection("admin_login_attempts")
    .doc(email.toLowerCase())
    .get();

  if (!doc.exists) {
    return { password: 0, otp: 0 };
  }

  const data = doc.data()!;
  return {
    password: data.passwordAttempts || 0,
    otp: data.otpAttempts || 0
  };
}

async function incrementPasswordAttempts(email: string): Promise<number> {
  const attemptsRef = admin.firestore()
    .collection("admin_login_attempts")
    .doc(email.toLowerCase());

  await attemptsRef.set({
    passwordAttempts: admin.firestore.FieldValue.increment(1),
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const doc = await attemptsRef.get();
  return doc.data()?.passwordAttempts || 1;
}

async function incrementOtpAttempts(email: string): Promise<number> {
  const attemptsRef = admin.firestore()
    .collection("admin_login_attempts")
    .doc(email.toLowerCase());

  await attemptsRef.set({
    otpAttempts: admin.firestore.FieldValue.increment(1),
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const doc = await attemptsRef.get();
  return doc.data()?.otpAttempts || 1;
}

async function clearLoginAttempts(email: string): Promise<void> {
  await admin.firestore()
    .collection("admin_login_attempts")
    .doc(email.toLowerCase())
    .delete();
}

/**
 * Format lockout time for error message (in IST - India Standard Time)
 */
function formatLockoutTime(lockedUntil: Date): string {
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istTime = new Date(lockedUntil.getTime() + istOffset);
  const hours = istTime.getUTCHours().toString().padStart(2, '0');
  const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getAdminOTPEmailHTML(otp: string, adminName: string = "Admin"): string {
  const baseUrl = "https://firebasestorage.googleapis.com/v0/b/letbuy-y.firebasestorage.app/o/email-assets%2F";
  const bannerUrl = `${baseUrl}email_banner.png?alt=media`;
  const instagramIcon = `${baseUrl}instagram_icon.png?alt=media`;
  const telegramIcon = `${baseUrl}telegram_icon.png?alt=media`;
  const whatsappIcon = `${baseUrl}whatsapp_icon.png?alt=media`;
  const xIcon = `${baseUrl}x_icon.png?alt=media`;
  const youtubeIcon = `${baseUrl}youtube_icon.png?alt=media`;
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background-color: #f3f4f6; 
      padding: 20px;
    }
    .container { 
      max-width: 500px; 
      margin: 20px auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden; 
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
    }
    .banner {
      width: 100%;
      display: block;
    }
    .content { 
      padding: 32px; 
    }
    .greeting { 
      color: #111827; 
      font-size: 18px; 
      font-weight: 600; 
      margin-bottom: 16px; 
    }
    .text { 
      color: #4b5563; 
      font-size: 15px; 
      line-height: 1.6; 
      margin-bottom: 24px; 
    }
    .otp-box { 
      background: linear-gradient(135deg, #1A6B70 0%, #0F5257 100%);
      border: 2px solid #0D4A4F;
      border-radius: 16px; 
      padding: 28px; 
      text-align: center;
      margin-bottom: 24px; 
    }
    .otp-code { 
      font-size: 36px; 
      font-weight: 700; 
      color: #ffffff; 
      letter-spacing: 12px; 
      font-family: 'Courier New', monospace;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .signature {
      color: #111827;
      font-size: 15px;
      font-weight: 600;
      margin-top: 24px;
    }
    .footer { 
      padding: 20px; 
      text-align: center; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .social-icons {
      margin-bottom: 16px;
    }
    .social-icons a {
      display: inline-block;
      margin: 0 6px;
      text-decoration: none;
    }
    .social-icons img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    .footer-text { 
      color: #9ca3af; 
      font-size: 12px; 
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="${bannerUrl}" alt="LetBuyy Admin" class="banner" />
    
    <div class="content">
      <p class="greeting">Hello ${adminName},</p>
      
      <p class="text">
        Your One-Time Password (OTP) to access the LetBuyy Admin Panel is:
      </p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      
      <div class="info">⏱️ This OTP is valid for 5 minutes.</div>
      <div class="info">🔒 Do not share this code with anyone.</div>
      
      <p class="signature">— Team LetBuyy</p>
    </div>
    
    <div class="footer">
      <div class="social-icons">
        <a href="https://www.instagram.com/letbuy.y" title="Instagram"><img src="${instagramIcon}" alt="Instagram" /></a>
        <a href="https://x.com/letbuyy" title="X"><img src="${xIcon}" alt="X" /></a>
        <a href="https://youtube.com/@letbuyy" title="YouTube"><img src="${youtubeIcon}" alt="YouTube" /></a>
        <a href="https://t.me/letbuyy" title="Telegram"><img src="${telegramIcon}" alt="Telegram" /></a>
        <a href="https://wa.me/918610787151" title="WhatsApp"><img src="${whatsappIcon}" alt="WhatsApp" /></a>
      </div>
      <p class="footer-text">© ${year} LetBuyy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}


/**
 * Send OTP to admin email for authentication
 */
export const sendAdminLoginOTP = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { email, password } = req.body;

      if (!email) {
        log.error("Email is required");
        res.status(400).json({ success: false, error: "Email is required" });
        return;
      }

      if (!password) {
        log.error("Password is required");
        res.status(400).json({ success: false, error: "Password is required" });
        return;
      }

      log.info(`Admin login OTP request for: ${email}`);

      // Check if user is locked out
      const lockoutStatus = await isUserLockedOut(email);
      if (lockoutStatus.locked) {
        const tryAgainTime = formatLockoutTime(lockoutStatus.lockedUntil!);
        log.error(`User locked out: ${email} until ${tryAgainTime}`);
        res.status(429).json({
          success: false,
          error: `Account temporarily locked. Try again at ${tryAgainTime} or reset your password.`,
          lockedUntil: lockoutStatus.lockedUntil?.toISOString()
        });
        return;
      }

      // Check if user exists and is admin
      const usersRef = admin.firestore().collection("users");
      const userQuery = await usersRef.where("email", "==", email.toLowerCase()).get();

      if (userQuery.empty) {
        log.error(`User not found: ${email}`);
        res.status(404).json({ success: false, error: "Admin account not found" });
        return;
      }

      const userDoc = userQuery.docs[0];
      let userData = userDoc.data();

      if (userData.role !== "admin") {
        log.error(`User is not admin: ${email}`);
        res.status(403).json({ success: false, error: "Access denied. Admin access only." });
        return;
      }

      // If the document ID doesn't match the uid field, we need to fetch by uid
      // because 2FA data is stored on the document with ID = Firebase Auth UID
      const firebaseUid = userData.uid || userDoc.id;
      if (firebaseUid && firebaseUid !== userDoc.id) {
        log.info(`Document ID mismatch. Doc ID: ${userDoc.id}, UID: ${firebaseUid}. Re-fetching...`);
        const uidDoc = await admin.firestore().collection("users").doc(firebaseUid).get();
        if (uidDoc.exists) {
          userData = uidDoc.data()!;
          log.info(`Re-fetched user data by UID: ${firebaseUid}`);
        }
      }

      // Verify password using Firebase Auth REST API
      const isPasswordValid = await verifyPasswordWithFirebaseAuth(email, password);
      if (!isPasswordValid) {
        // Increment password attempts and check if should lock out
        const attempts = await incrementPasswordAttempts(email);
        const remaining = 3 - attempts;

        if (attempts >= 3) {
          const lockedUntil = await setUserLockout(email, "password");
          const tryAgainTime = formatLockoutTime(lockedUntil);
          log.error(`Password lockout triggered for: ${email}`);
          res.status(429).json({
            success: false,
            error: `Too many failed attempts. Account locked until ${tryAgainTime}. Reset password to unlock.`,
            lockedUntil: lockedUntil.toISOString()
          });
        } else {
          log.error(`Invalid password for admin: ${email} (${remaining} attempts remaining)`);
          res.status(401).json({
            success: false,
            error: `Invalid password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          });
        }
        return;
      }

      // Password verified - clear any previous password attempts
      await clearLoginAttempts(email);
      log.success(`Password verified for admin: ${email}`);

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP in Firestore
      await admin.firestore().collection("admin_otp").doc(email.toLowerCase()).set({
        otp,
        email: email.toLowerCase(),
        userId: userDoc.id,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        verified: false,
        attempts: 0,
      });

      // Send email
      const transporter = await createEmailTransporter();

      // Get admin display name
      const adminName = userData.displayName || userData.name || email.split('@')[0];

      await transporter.sendMail({
        from: `"LetBuyy Admin" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: "🔐 Admin Login Verification - LetBuyy",
        html: getAdminOTPEmailHTML(otp, adminName),
      });

      // Check if 2FA is enabled for this admin
      const is2FAEnabled = userData.twoFactorAuth?.enabled === true;

      log.success(`OTP sent to admin: ${email} (2FA enabled: ${is2FAEnabled})`);

      res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        expiresIn: 600, // 10 minutes in seconds
        is2FAEnabled: is2FAEnabled,  // Tell frontend if TOTP is required
      });

    } catch (error: any) {
      log.error(`Error sending admin OTP: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Send OTP to admin email after Google Sign-In verification
 * This bypasses password check but still requires OTP (and TOTP if 2FA enabled)
 */
export const sendAdminLoginOTPWithGoogle = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { idToken } = req.body;

      if (!idToken) {
        log.error("Google ID token is required");
        res.status(400).json({ success: false, error: "Google ID token is required" });
        return;
      }

      log.info("Verifying Google Sign-In for admin login...");

      // Verify Google ID token using Firebase Admin SDK
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (tokenError: any) {
        log.error(`Invalid Google ID token: ${tokenError.message}`);
        res.status(401).json({ success: false, error: "Invalid or expired Google credentials" });
        return;
      }

      const email = decodedToken.email?.toLowerCase();

      if (!email) {
        log.error("No email found in Google token");
        res.status(400).json({ success: false, error: "No email found in Google account" });
        return;
      }

      log.info(`Google Sign-In verified for: ${email}`);

      // Check if user is locked out
      const lockoutStatus = await isUserLockedOut(email);
      if (lockoutStatus.locked) {
        const tryAgainTime = formatLockoutTime(lockoutStatus.lockedUntil!);
        log.error(`User locked out: ${email} until ${tryAgainTime}`);
        res.status(429).json({
          success: false,
          error: `Account temporarily locked. Try again at ${tryAgainTime} or reset your password.`,
          lockedUntil: lockoutStatus.lockedUntil?.toISOString()
        });
        return;
      }

      // Check if user exists and is admin
      const usersRef = admin.firestore().collection("users");
      const userQuery = await usersRef.where("email", "==", email).get();

      if (userQuery.empty) {
        log.error(`Admin not found: ${email}`);
        res.status(404).json({ success: false, error: "Admin account not found for this Google account" });
        return;
      }

      const userDoc = userQuery.docs[0];
      let userData = userDoc.data();

      if (userData.role !== "admin") {
        log.error(`User is not admin: ${email}`);
        res.status(403).json({ success: false, error: "Access denied. Admin access only." });
        return;
      }

      // If the document ID doesn't match the uid field, we need to fetch by uid
      // because 2FA data is stored on the document with ID = Firebase Auth UID
      const firebaseUid = userData.uid || userDoc.id;
      if (firebaseUid && firebaseUid !== userDoc.id) {
        log.info(`Document ID mismatch. Doc ID: ${userDoc.id}, UID: ${firebaseUid}. Re-fetching...`);
        const uidDoc = await admin.firestore().collection("users").doc(firebaseUid).get();
        if (uidDoc.exists) {
          userData = uidDoc.data()!;
          log.info(`Re-fetched user data by UID: ${firebaseUid}`);
        }
      }

      log.success(`Admin verified via Google: ${email}`);

      // Generate OTP (same logic as sendAdminLoginOTP)
      const otp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP in Firestore
      await admin.firestore().collection("admin_otp").doc(email).set({
        otp,
        email: email,
        userId: userDoc.id,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        verified: false,
        attempts: 0,
        signInMethod: "google",  // Track that this was via Google Sign-In
      });

      // Send email
      const transporter = await createEmailTransporter();

      // Get admin display name
      const adminName = userData.displayName || userData.name || email.split('@')[0];

      await transporter.sendMail({
        from: `"LetBuyy Admin" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: "🔐 Admin Login Verification - LetBuyy",
        html: getAdminOTPEmailHTML(otp, adminName),
      });

      // Check if 2FA is enabled for this admin
      const is2FAEnabled = userData.twoFactorAuth?.enabled === true;

      log.success(`OTP sent to admin (Google Sign-In): ${email} (2FA enabled: ${is2FAEnabled})`);

      res.status(200).json({
        success: true,
        message: "Email verified via Google. OTP sent to your email.",
        expiresIn: 600, // 10 minutes in seconds
        is2FAEnabled: is2FAEnabled,  // Tell frontend if TOTP is required
        email: email,  // Return email for display
      });

    } catch (error: any) {
      log.error(`Error in Google Sign-In admin OTP: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Verify admin OTP and create custom token for login
 */
export const verifyAdminOTP = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { email, otp, totpCode } = req.body;

      if (!email || !otp) {
        res.status(400).json({ success: false, error: "Email and OTP are required" });
        return;
      }

      log.info(`Verifying admin OTP for: ${email}`);

      // Check if user is locked out
      const lockoutStatus = await isUserLockedOut(email);
      if (lockoutStatus.locked) {
        const tryAgainTime = formatLockoutTime(lockoutStatus.lockedUntil!);
        log.error(`User locked out: ${email} until ${tryAgainTime}`);
        res.status(429).json({
          success: false,
          error: `Account temporarily locked. Try again at ${tryAgainTime} or reset your password.`,
          lockedUntil: lockoutStatus.lockedUntil?.toISOString()
        });
        return;
      }

      // Get stored OTP
      const otpDoc = await admin.firestore()
        .collection("admin_otp")
        .doc(email.toLowerCase())
        .get();

      if (!otpDoc.exists) {
        res.status(404).json({ success: false, error: "OTP not found. Please request a new one." });
        return;
      }

      const otpData = otpDoc.data()!;

      // Check expiration
      if (Date.now() > otpData.expiresAt) {
        await otpDoc.ref.delete();
        res.status(410).json({ success: false, error: "OTP expired. Please request a new one." });
        return;
      }

      // Get user document to check if 2FA is enabled (need this to determine max attempts)
      const userDoc = await admin.firestore().collection("users").doc(otpData.userId).get();
      const userData = userDoc.data();
      const is2FAEnabled = userData?.twoFactorAuth?.enabled === true;

      // Determine max attempts: 3 for OTP-only, 5 for 2FA
      const maxAttempts = is2FAEnabled ? 5 : 3;
      const lockoutReason = is2FAEnabled ? "2fa" : "otp";

      // Get current attempts
      const currentAttempts = await getLoginAttempts(email);

      // Check if already at max attempts
      if (currentAttempts.otp >= maxAttempts) {
        await otpDoc.ref.delete();
        const lockedUntil = await setUserLockout(email, lockoutReason as "otp" | "2fa");
        const tryAgainTime = formatLockoutTime(lockedUntil);
        res.status(429).json({
          success: false,
          error: `Too many failed attempts. Account locked until ${tryAgainTime}. Reset password to unlock.`,
          lockedUntil: lockedUntil.toISOString()
        });
        return;
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        const attempts = await incrementOtpAttempts(email);
        const remaining = maxAttempts - attempts;

        if (attempts >= maxAttempts) {
          await otpDoc.ref.delete();
          const lockedUntil = await setUserLockout(email, lockoutReason as "otp" | "2fa");
          const tryAgainTime = formatLockoutTime(lockedUntil);
          log.error(`OTP lockout triggered for: ${email}`);
          res.status(429).json({
            success: false,
            error: `Too many failed attempts. Account locked until ${tryAgainTime}. Reset password to unlock.`,
            lockedUntil: lockedUntil.toISOString()
          });
        } else {
          log.error(`Invalid OTP for admin: ${email} (${remaining} attempts remaining)`);
          res.status(401).json({
            success: false,
            error: `Invalid email OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          });
        }
        return;
      }

      // === 2FA VERIFICATION ===
      // Already have userDoc and userData from earlier - check if 2FA is enabled
      if (is2FAEnabled) {
        log.info(`2FA is enabled for admin: ${email}, verifying TOTP...`);

        // TOTP code is required
        if (!totpCode) {
          res.status(400).json({
            success: false,
            error: "Please enter your authenticator code",
            requires2FA: true
          });
          return;
        }

        // Import authenticator for TOTP verification 
        const { authenticator } = require("otplib");

        // Get and decrypt the stored secret (stored as totpSecret, already encrypted)
        const encryptedSecret = userData?.twoFactorAuth?.totpSecret;
        if (!encryptedSecret) {
          log.error(`No TOTP secret found for admin: ${email}`);
          res.status(500).json({ success: false, error: "2FA configuration error. Please contact support." });
          return;
        }

        // Decrypt the secret (using same logic as adminTOTP.ts)
        const cryptoModule = require("crypto");
        const getEncryptionKey = (): string => {
          try {
            return functions.config().totp?.encryption_key || "letbuyy-admin-totp-key-32chars!!";
          } catch {
            return process.env.TOTP_ENCRYPTION_KEY || "letbuyy-admin-totp-key-32chars!!";
          }
        };

        const decryptSecret = (encryptedData: string): string => {
          const key = getEncryptionKey();
          const [ivHex, encrypted] = encryptedData.split(":");
          const iv = Buffer.from(ivHex, "hex");
          const decipher = cryptoModule.createDecipheriv("aes-256-cbc", Buffer.from(key.padEnd(32).slice(0, 32)), iv);
          let decrypted = decipher.update(encrypted, "hex", "utf8");
          decrypted += decipher.final("utf8");
          return decrypted;
        };

        try {
          const secret = decryptSecret(encryptedSecret);
          const isValid = authenticator.verify({ token: totpCode, secret });

          if (!isValid) {
            // Use unified attempt tracking for TOTP failures too
            const attempts = await incrementOtpAttempts(email);
            const remaining = maxAttempts - attempts;

            if (attempts >= maxAttempts) {
              await otpDoc.ref.delete();
              const lockedUntil = await setUserLockout(email, "2fa");
              const tryAgainTime = formatLockoutTime(lockedUntil);
              log.error(`TOTP lockout triggered for: ${email}`);
              res.status(429).json({
                success: false,
                error: `Too many failed attempts. Account locked until ${tryAgainTime}. Reset password to unlock.`,
                lockedUntil: lockedUntil.toISOString()
              });
            } else {
              log.error(`Invalid TOTP code for admin: ${email}. ${remaining} attempts remaining.`);
              res.status(401).json({
                success: false,
                error: `Invalid authenticator code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
                requires2FA: true
              });
            }
            return;
          }

          log.success(`TOTP verified for admin: ${email}`);
        } catch (decryptError: any) {
          log.error(`Error decrypting TOTP secret: ${decryptError.message}`);
          res.status(500).json({ success: false, error: "Error verifying authenticator code" });
          return;
        }
      }

      // OTP (and TOTP if required) verified - clear attempts and create custom token
      await clearLoginAttempts(email);
      const customToken = await admin.auth().createCustomToken(otpData.userId, {
        role: "admin",
      });

      // Mark OTP as verified and delete
      await otpDoc.ref.delete();

      // Log admin login
      await admin.firestore().collection("admin_login_logs").add({
        userId: otpData.userId,
        email: email.toLowerCase(),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        success: true,
        used2FA: userData?.twoFactorAuth?.enabled === true,
      });

      log.success(`Admin verified successfully: ${email}`);

      res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        customToken,
        userId: otpData.userId,
      });

    } catch (error: any) {
      log.error(`Error verifying admin OTP: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Resend admin OTP
 */
export const resendAdminOTP = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Set CORS headers
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
      const existingOtp = await admin.firestore()
        .collection("admin_otp")
        .doc(email.toLowerCase())
        .get();

      if (existingOtp.exists) {
        const data = existingOtp.data()!;
        const timeSinceLastOtp = Date.now() - (data.createdAt?.toMillis() || 0);

        if (timeSinceLastOtp < 60000) { // 60 seconds cooldown
          const waitTime = Math.ceil((60000 - timeSinceLastOtp) / 1000);
          res.status(429).json({
            success: false,
            error: `Please wait ${waitTime} seconds before requesting a new OTP.`
          });
          return;
        }
      }

      log.info(`Resending admin OTP to: ${email}`);

      // Check if user exists and is admin
      const usersRef = admin.firestore().collection("users");
      const userQuery = await usersRef.where("email", "==", email.toLowerCase()).get();

      if (userQuery.empty) {
        res.status(404).json({ success: false, error: "Admin account not found" });
        return;
      }

      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();

      if (userData.role !== "admin") {
        res.status(403).json({ success: false, error: "Access denied. Admin access only." });
        return;
      }

      // Generate new OTP
      const otp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      // Store OTP
      await admin.firestore().collection("admin_otp").doc(email.toLowerCase()).set({
        otp,
        email: email.toLowerCase(),
        userId: userDoc.id,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        verified: false,
        attempts: 0,
      });

      // Send email
      const transporter = await createEmailTransporter();

      // Get admin display name
      const adminName = userData.displayName || userData.name || email.split('@')[0];

      await transporter.sendMail({
        from: `"LetBuyy Admin" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: "🔐 Admin Login Verification - LetBuyy",
        html: getAdminOTPEmailHTML(otp, adminName),
      });

      log.success(`OTP resent to admin: ${email}`);

      res.status(200).json({
        success: true,
        message: "OTP resent successfully",
        expiresIn: 600,
      });

    } catch (error: any) {
      log.error(`Error resending admin OTP: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// ============================================================
// 🔐 ADMIN PASSWORD RESET FUNCTIONS
// ============================================================

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getAdminPasswordResetEmailHTML(
  adminName: string,
  resetLink: string,
  expiryMinutes: number
): string {
  const baseUrl = "https://firebasestorage.googleapis.com/v0/b/letbuy-y.firebasestorage.app/o/email-assets%2F";
  const bannerUrl = `${baseUrl}email_banner.png?alt=media`;
  const instagramIcon = `${baseUrl}instagram_icon.png?alt=media`;
  const telegramIcon = `${baseUrl}telegram_icon.png?alt=media`;
  const whatsappIcon = `${baseUrl}whatsapp_icon.png?alt=media`;
  const xIcon = `${baseUrl}x_icon.png?alt=media`;
  const youtubeIcon = `${baseUrl}youtube_icon.png?alt=media`;
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background-color: #f3f4f6; 
      padding: 20px;
    }
    .container { 
      max-width: 500px; 
      margin: 20px auto; 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden; 
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
    }
    .banner { width: 100%; display: block; }
    .content { padding: 32px; }
    .greeting { color: #111827; font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .text { color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    .button-box { text-align: center; margin-bottom: 24px; }
    .reset-button {
      display: inline-block;
      background: linear-gradient(135deg, #1A6B70 0%, #0F5257 100%);
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      padding: 16px 48px;
      border-radius: 12px;
    }
    .info { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
    .signature { color: #111827; font-size: 15px; font-weight: 600; margin-top: 24px; }
    .footer { padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .social-icons { margin-bottom: 16px; }
    .social-icons a { display: inline-block; margin: 0 6px; text-decoration: none; }
    .social-icons img { width: 32px; height: 32px; border-radius: 8px; }
    .footer-text { color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <img src="${bannerUrl}" alt="LetBuyy Admin" class="banner" />
    
    <div class="content">
      <p class="greeting">Hello ${adminName},</p>
      
      <p class="text">
        We received a request to reset your password. Click the button below to create a new password:
      </p>
      
      <div class="button-box">
        <a href="${resetLink}" class="reset-button">Reset Password</a>
      </div>
      
      <div class="info">⏱️ This link expires in ${expiryMinutes} minutes.</div>
      <div class="info">🔒 If you didn't request this, ignore this email.</div>
      
      <p class="signature">— Team LetBuyy</p>
    </div>
    
    <div class="footer">
      <div class="social-icons">
        <a href="https://www.instagram.com/letbuy.y" title="Instagram"><img src="${instagramIcon}" alt="Instagram" /></a>
        <a href="https://x.com/letbuyy" title="X"><img src="${xIcon}" alt="X" /></a>
        <a href="https://youtube.com/@letbuyy" title="YouTube"><img src="${youtubeIcon}" alt="YouTube" /></a>
        <a href="https://t.me/letbuyy" title="Telegram"><img src="${telegramIcon}" alt="Telegram" /></a>
        <a href="https://wa.me/918610787151" title="WhatsApp"><img src="${whatsappIcon}" alt="WhatsApp" /></a>
      </div>
      <p class="footer-text">© ${year} LetBuyy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Request password reset for admin - sends email with reset link
 */
export const requestAdminPasswordReset = functions.https.onRequest((req, res) => {
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

      log.info(`Password reset requested for admin: ${email}`);

      // Step 1: Check if email is registered at all
      const allUsersSnapshot = await admin
        .firestore()
        .collection("users")
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();

      if (allUsersSnapshot.empty) {
        log.info(`Email not found in database: ${email}`);
        res.status(404).json({
          success: false,
          error: "No account found with this email address.",
        });
        return;
      }

      // Step 2: Check if user has admin role
      const userData = allUsersSnapshot.docs[0].data();
      if (userData.role !== "admin") {
        log.info(`User is not admin: ${email} (role: ${userData.role})`);
        res.status(403).json({
          success: false,
          error: "This email is not registered as an admin account.",
        });
        return;
      }

      const userDoc = allUsersSnapshot.docs[0];
      const userId = userDoc.id;

      // Generate secure token
      const resetToken = generateResetToken();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      );

      // Store reset request
      await admin.firestore().collection("admin_password_resets").doc(userId).set({
        email: email.toLowerCase(),
        token: resetToken,
        userId,
        expiresAt,
        used: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create reset link
      const resetLink = `https://admin-letbuy-y.web.app/reset-password?token=${resetToken}&uid=${userId}`;

      // Send email
      const transporter = await createEmailTransporter();
      await transporter.sendMail({
        from: `"LetBuyy Admin Security" <${EMAIL_CONFIG.NO_REPLY_EMAIL}>`,
        to: email,
        subject: "🔐 Reset Your LetBuyy Admin Password",
        html: getAdminPasswordResetEmailHTML(
          userData.name || "Admin",
          resetLink,
          30
        ),
      });

      log.success(`Password reset email sent to admin: ${email}`);

      res.status(200).json({
        success: true,
        message: "If an admin account exists, a reset link has been sent.",
      });
    } catch (error: any) {
      log.error(`Error requesting admin password reset: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Verify admin password reset token
 */
export const verifyAdminResetToken = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { token, uid } = req.body;

      if (!token || !uid) {
        res.status(400).json({ success: false, error: "Token and uid are required" });
        return;
      }

      log.info(`Verifying reset token for admin: ${uid}`);

      const docRef = admin.firestore().collection("admin_password_resets").doc(uid);
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

      log.success(`Reset token verified for admin: ${uid}`);

      res.status(200).json({
        success: true,
        message: "Reset token is valid",
        email: resetData?.email || "",
      });
    } catch (error: any) {
      log.error(`Error verifying admin reset token: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/**
 * Reset admin password using Firebase Auth
 */
export const resetAdminPassword = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { token, uid, newPassword } = req.body;

      if (!token || !uid || !newPassword) {
        res.status(400).json({ success: false, error: "Token, uid, and newPassword are required" });
        return;
      }

      // Validate password strength
      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
        return;
      }

      log.info(`Resetting password for admin: ${uid}`);

      const docRef = admin.firestore().collection("admin_password_resets").doc(uid);
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

      // Update password in Firebase Auth
      await admin.auth().updateUser(uid, {
        password: newPassword,
      });

      // Mark token as used
      await docRef.update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update user document
      await admin.firestore().collection("users").doc(uid).update({
        passwordChangedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Clear any login lockouts so user can login immediately
      if (resetData?.email) {
        await clearUserLockout(resetData.email);
        log.info(`Lockout cleared for ${resetData.email} after password reset`);
      }

      log.success(`Password reset successfully for admin: ${uid}`);

      res.status(200).json({
        success: true,
        message: "Password reset successfully. You can now login with your new password.",
      });
    } catch (error: any) {
      log.error(`Error resetting admin password: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});
